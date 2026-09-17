// TechLab Fisio — contrato HTTP e validação da consulta da trilha de auditoria
// (AUD-004 / `PBACK-AUD-08`, `docs/09` §13.9).
//
// Política NORMATIVA (§13.9): permissão exclusiva `auditoria.ler`; somente
// leitura; filtros fechados sobre colunas próprias de `evento_auditoria`
// (período, ator, ação do catálogo, alvo_tipo, alvo_id, correlação,
// resultado); paginação obrigatória com limite imposto pelo servidor; sem busca
// livre, sem filtro por `contexto`/`justificativa`, sem resolver/expandir o
// alvo; `auditoria.consultada` NÃO existe.
//
// Escolhas TÉCNICAS LOCAIS desta fatia (reversíveis, registradas em
// `docs/10` §7.6): nomes dos parâmetros, limite padrão 20 / máximo 50 com
// rejeição (não clamp), cursor opaco keyset sobre (ocorrido_em DESC, id DESC).
//
// Validação por funções puras, fail-closed, sem dependência nova.

import { BadRequestException } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { ehUuidValido } from "../sessoes/sessoes.dto.js";
import { ACOES_AUDITORIA, ehAcaoAuditoria, type AcaoAuditoria } from "./audit.catalog.js";
import {
  RESULTADOS_AUDITORIA,
  type ResultadoAuditoria,
  type ValorContexto,
} from "./audit.types.js";

export const LIMITE_PADRAO = 20;
export const LIMITE_MAXIMO = 50;

/** Tamanho máximo aceito para o cursor opaco (bytes de texto). */
export const TAMANHO_MAXIMO_CURSOR = 256;

/**
 * Conjunto FECHADO de parâmetros de query. Qualquer outro nome — inclusive
 * `contexto`, `justificativa`, `q`, `busca`, `nome`, `email`, `cpf` — é `400`.
 */
export const PARAMETROS_CONSULTA_AUDITORIA: readonly string[] = Object.freeze([
  "ocorridoDe",
  "ocorridoAte",
  "atorUsuarioId",
  "acao",
  "alvoTipo",
  "alvoId",
  "correlacaoId",
  "resultado",
  "limite",
  "cursor",
]);

const PARAMETROS_PERMITIDOS: ReadonlySet<string> = new Set(PARAMETROS_CONSULTA_AUDITORIA);
const RESULTADOS: ReadonlySet<string> = new Set(RESULTADOS_AUDITORIA);

/**
 * `alvo_tipo` é o nome físico da tabela do alvo (`D-AUD-03`) — texto
 * controlado, sem catálogo próprio. A consulta aceita apenas a forma de um
 * identificador SQL simples em minúsculas; nada é normalizado.
 */
const REGEX_ALVO_TIPO = /^[a-z][a-z0-9_]{0,62}$/;

/** ISO-8601 com data, hora e fuso EXPLÍCITO (`Z` ou `±HH:MM`). */
const REGEX_INSTANTE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/;

const LIMITE_REGEX = /^[1-9]\d{0,2}$/;

export function ehResultadoAuditoria(valor: string): valor is ResultadoAuditoria {
  return RESULTADOS.has(valor);
}

function invalida(): BadRequestException {
  return new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

/**
 * Converte instante ISO-8601 com fuso explícito em `Date`. Recusa data local
 * ambígua (sem fuso), data civil impossível (ex.: 30/02 — o `Date` do V8 a
 * "rolaria" para março) e precisão acima de milissegundo.
 */
export function analisarInstante(valor: string): Date | null {
  const m = REGEX_INSTANTE.exec(valor);
  if (m === null) return null;
  const [ano, mes, dia, hora, minuto, segundo] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (mes < 1 || mes > 12 || hora > 23 || minuto > 59 || segundo > 59) return null;
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia < 1 || dia > diasNoMes) return null;
  if (m[8] !== "Z" && (Number(m[9]) > 23 || Number(m[10]) > 59)) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

export interface CursorAuditoria {
  readonly ocorridoEm: Date;
  readonly id: string;
}

export function serializarCursor(cursor: CursorAuditoria): string {
  return Buffer.from(
    JSON.stringify({ o: cursor.ocorridoEm.toISOString(), i: cursor.id }),
    "utf-8",
  ).toString("base64url");
}

/** Decodifica o cursor opaco; qualquer adulteração estrutural é `400`. */
export function deserializarCursor(bruto: string): CursorAuditoria {
  if (bruto === "" || bruto.length > TAMANHO_MAXIMO_CURSOR || !/^[A-Za-z0-9_-]+$/.test(bruto)) {
    throw invalida();
  }
  let objeto: unknown;
  try {
    objeto = JSON.parse(Buffer.from(bruto, "base64url").toString("utf-8"));
  } catch {
    throw invalida();
  }
  if (typeof objeto !== "object" || objeto === null || Array.isArray(objeto)) throw invalida();
  const registro = objeto as Record<string, unknown>;
  if (Object.keys(registro).sort().join(",") !== "i,o") throw invalida();
  const { o, i } = registro;
  if (typeof o !== "string" || typeof i !== "string" || !ehUuidValido(i)) throw invalida();
  const ocorridoEm = analisarInstante(o);
  if (ocorridoEm === null) throw invalida();
  return { ocorridoEm, id: i };
}

export interface FiltrosConsultaAuditoria {
  readonly ocorridoDe?: Date;
  readonly ocorridoAte?: Date;
  readonly atorUsuarioId?: string;
  readonly acao?: AcaoAuditoria;
  readonly alvoTipo?: string;
  readonly alvoId?: string;
  readonly correlacaoId?: string;
  readonly resultado?: ResultadoAuditoria;
  readonly limite: number;
  readonly cursor?: CursorAuditoria;
}

/**
 * Valida a query crua, fail-closed. Parâmetro desconhecido, repetido (array),
 * aninhado (objeto) ou com valor fora da forma é `400 REQUISICAO_INVALIDA`.
 * Nenhum valor é aparado, convertido de caixa ou corrigido.
 */
export function validarConsultaAuditoria(query: unknown): FiltrosConsultaAuditoria {
  if (typeof query !== "object" || query === null || Array.isArray(query)) throw invalida();
  const bruta = query as Record<string, unknown>;
  const valores = new Map<string, string>();
  for (const [nome, valor] of Object.entries(bruta)) {
    if (!PARAMETROS_PERMITIDOS.has(nome) || typeof valor !== "string") throw invalida();
    valores.set(nome, valor);
  }

  const filtros: {
    -readonly [K in keyof FiltrosConsultaAuditoria]: FiltrosConsultaAuditoria[K];
  } = { limite: LIMITE_PADRAO };

  for (const [nome, valor] of valores) {
    switch (nome) {
      case "ocorridoDe":
      case "ocorridoAte": {
        const instante = analisarInstante(valor);
        if (instante === null) throw invalida();
        filtros[nome] = instante;
        break;
      }
      case "atorUsuarioId":
      case "alvoId":
      case "correlacaoId":
        if (!ehUuidValido(valor)) throw invalida();
        filtros[nome] = valor;
        break;
      case "acao":
        if (!ehAcaoAuditoria(valor)) throw invalida();
        filtros.acao = valor;
        break;
      case "resultado":
        if (!ehResultadoAuditoria(valor)) throw invalida();
        filtros.resultado = valor;
        break;
      case "alvoTipo":
        if (!REGEX_ALVO_TIPO.test(valor)) throw invalida();
        filtros.alvoTipo = valor;
        break;
      case "limite": {
        if (!LIMITE_REGEX.test(valor)) throw invalida();
        const limite = Number(valor);
        if (limite > LIMITE_MAXIMO) throw invalida();
        filtros.limite = limite;
        break;
      }
      case "cursor":
        filtros.cursor = deserializarCursor(valor);
        break;
    }
  }

  if (
    filtros.ocorridoDe !== undefined &&
    filtros.ocorridoAte !== undefined &&
    filtros.ocorridoDe.getTime() > filtros.ocorridoAte.getTime()
  ) {
    throw invalida();
  }
  return filtros;
}

/**
 * Evento devolvido pela consulta: SOMENTE colunas próprias de
 * `evento_auditoria`. Nenhum dado do ator ou do alvo é resolvido;
 * `criado_em` (metadado técnico de persistência) não é exposto.
 *
 * `justificativa` é OMITIDA por decisão de Bruno Menezes Noronha
 * (17/09/2026, `docs/10` §7.6.1): é texto livre do operador e poderia levar
 * dado pessoal ou clínico ao visualizador, que `docs/09` §13.9 impede de
 * virar canal indireto de acesso.
 */
export class EventoAuditoriaDto {
  @ApiProperty({ format: "uuid", example: "01900000-0000-7000-8000-000000000001" })
  readonly id!: string;

  @ApiProperty({
    format: "date-time",
    description: "Instante UTC do evento.",
    example: "2026-08-25T10:00:00.000Z",
  })
  readonly ocorridoEm!: string;

  @ApiProperty({
    format: "uuid",
    nullable: true,
    type: String,
    description: "Identificador técnico do ator; nulo somente em ação de sistema. Não é resolvido.",
    example: "01900000-0000-7000-8000-0000000000a1",
  })
  readonly atorUsuarioId!: string | null;

  @ApiProperty({ enum: ACOES_AUDITORIA, example: "usuario.autenticacao" })
  readonly acao!: string;

  @ApiProperty({
    description: "Nome físico da tabela do alvo (D-AUD-03). Não concede acesso ao alvo.",
    example: "usuario",
  })
  readonly alvoTipo!: string;

  @ApiProperty({
    format: "uuid",
    nullable: true,
    type: String,
    description: "Identificador técnico do alvo. Não é resolvido nem expandido.",
    example: "01900000-0000-7000-8000-0000000000b2",
  })
  readonly alvoId!: string | null;

  @ApiProperty({ enum: RESULTADOS_AUDITORIA, example: "SUCESSO" })
  readonly resultado!: string;

  @ApiProperty({ format: "uuid", example: "01900000-0000-7000-8000-0000000000c3" })
  readonly correlacaoId!: string;

  @ApiProperty({
    nullable: true,
    type: "object",
    additionalProperties: true,
    description:
      "Contexto já restrito na escrita à whitelist positiva da ação (D-AUD-07/08, D-AUD-09). " +
      "Não é filtrável.",
    example: null,
  })
  readonly contexto!: Readonly<Record<string, ValorContexto>> | null;
}

export class PaginaEventosAuditoriaDto {
  @ApiProperty({
    type: [EventoAuditoriaDto],
    description: "Eventos em ordem ocorridoEm DESC, id DESC.",
  })
  readonly itens!: EventoAuditoriaDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Cursor opaco da próxima página; nulo quando não há próxima página.",
    example: null,
  })
  readonly proximoCursor!: string | null;
}

export class ErroConsultaAuditoriaDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO.FALHA_INTERNA,
    ],
  })
  readonly erro!: string;
}
