// TechLab Fisio — contratos HTTP da disponibilidade do profissional
// (PRO-003; `docs/16` §4, D-PRO3-01..D-PRO3-03, D-PRO3-10).
//
// Materializa:
//   - D-PRO3-02: corpo do `PUT` com EXATAMENTE { vigenciaInicio, janelas };
//     cada janela com EXATAMENTE { diaSemana, horaInicio, horaFim }; resposta
//     EXATA { versoes: [{ vigenciaInicio, vigenciaFim, janelas }] }; corpo
//     estrito, sem coerção; `vigenciaInicio` é data civil `YYYY-MM-DD` REAL do
//     calendário gregoriano (`2026-02-30` é rejeitada);
//   - D-PRO3-01, invariante 3: as janelas da versão seguem as MESMAS regras da
//     grade da clínica — no máximo 4 por dia, sem sobreposição e sem
//     adjacência, `HH:MM` 00:00..23:59, `horaFim > horaInicio`, sem atravessar
//     a meia-noite (D-CFG-13, D-CFG-14, D-CFG-18, D-CFG-59).
//
// A validação das JANELAS não é reimplementada: reusa
// `validarCorpoGradeFuncionamento` (CFG-002), que já é a função pura
// homologada dessas mesmas regras. A ordem do pedido é irrelevante para a
// validade; a saída volta em ordem canônica (dia, início).
//
// Validação pura sem class-validator (mesmo padrão de `profissionais.dto.ts`).

import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import {
  LIMITES_HORARIO,
  validarCorpoGradeFuncionamento,
  type JanelaFuncionamento,
} from "../clinica/horario-funcionamento.dto.js";
import { ERRO_PROFISSIONAL } from "./profissionais.dto.js";

/** Chaves EXATAS aceitas por `PUT /profissionais/:id/disponibilidade` (D-PRO3-02). */
export const CHAVES_CORPO_DISPONIBILIDADE = Object.freeze(["vigenciaInicio", "janelas"] as const);

/** Código de erro específico da disponibilidade (D-PRO3-03, D-PRO3-10). */
export const ERRO_DISPONIBILIDADE = Object.freeze({
  /** `422` — `vigenciaInicio` anterior a hoje no fuso da clínica. */
  VIGENCIA_RETROATIVA: "VIGENCIA_RETROATIVA",
} as const);

/** `YYYY-MM-DD` — forma; a EXISTÊNCIA da data é verificada à parte. */
const FORMA_DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PADRAO_DATA_OPENAPI = "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$";

/**
 * `true` sse `texto` é uma data civil REAL do calendário gregoriano proléptico.
 * Rejeita `2026-02-30` e `2027-02-29`; aceita `2028-02-29`. A verificação usa
 * `Date.UTC` apenas como calendário — nenhum fuso é aplicado, e o valor jamais
 * é interpretado como instante.
 */
export function ehDataCivilValida(texto: string): boolean {
  if (!FORMA_DATA.test(texto)) return false;
  const ano = Number(texto.slice(0, 4));
  const mes = Number(texto.slice(5, 7));
  const dia = Number(texto.slice(8, 10));
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** `YYYY-MM-DD` deslocada em `dias` no calendário civil, sem qualquer fuso. */
export function deslocarDataCivil(data: string, dias: number): string {
  const base = Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10)));
  const d = new Date(base + dias * 86_400_000);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

export class JanelaDisponibilidadeDto {
  @ApiProperty({ description: "Dia da semana: 0 = domingo .. 6 = sábado.", minimum: 0, maximum: 6, example: 1 })
  readonly diaSemana!: number;

  @ApiProperty({ description: "Início da janela, HH:MM (24h).", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "08:00" })
  readonly horaInicio!: string;

  @ApiProperty({ description: "Fim da janela, HH:MM (24h); maior que o início.", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "12:00" })
  readonly horaFim!: string;
}

/** Corpo de `PUT /profissionais/:profissionalId/disponibilidade` (D-PRO3-02). */
export class DisponibilidadeRequisicaoDto {
  @ApiProperty({
    description:
      "Data civil a partir da qual a nova versão vale, no fuso da clínica. Nunca anterior a hoje (422 VIGENCIA_RETROATIVA).",
    pattern: PADRAO_DATA_OPENAPI,
    example: "2026-10-01",
  })
  readonly vigenciaInicio!: string;

  @ApiProperty({
    description:
      "Janelas da nova versão. Até 4 por dia, sem sobreposição nem adjacência no mesmo dia. " +
      "Lista vazia encerra a versão anterior sem criar nova — o profissional fica sem disponibilidade a partir da data.",
    type: [JanelaDisponibilidadeDto],
    maxItems: LIMITES_HORARIO.JANELAS_POR_DIA * LIMITES_HORARIO.DIAS_SEMANA,
  })
  readonly janelas!: JanelaDisponibilidadeDto[];
}

/** Uma versão da disponibilidade nas respostas (D-PRO3-02). */
export class VersaoDisponibilidadeDto {
  @ApiProperty({ description: "Início da vigência (data civil).", pattern: PADRAO_DATA_OPENAPI, example: "2026-10-01" })
  readonly vigenciaInicio!: string;

  @ApiProperty({
    description: "Fim da vigência (data civil, inclusivo) ou null na versão ABERTA.",
    pattern: PADRAO_DATA_OPENAPI,
    nullable: true,
    type: String,
    example: null,
  })
  readonly vigenciaFim!: string | null;

  @ApiProperty({ description: "Janelas da versão, em ordem canônica (dia, início).", type: [JanelaDisponibilidadeDto] })
  readonly janelas!: JanelaDisponibilidadeDto[];
}

/** Resposta EXATA de `GET` e `PUT` (D-PRO3-02): todas as versões, mais recente primeiro. */
export class DisponibilidadeRespostaDto {
  @ApiProperty({
    description:
      "Todas as versões do profissional, ordenadas por vigenciaInicio DECRESCENTE. " +
      "Lista vazia = profissional sem disponibilidade definida (nunca significa 'sempre disponível').",
    type: [VersaoDisponibilidadeDto],
  })
  readonly versoes!: VersaoDisponibilidadeDto[];
}

/** Corpo de erro padronizado da disponibilidade. */
export class ErroDisponibilidadeDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO,
      ERRO_CLINICA.CLINICA_NAO_CONFIGURADA,
      ERRO_DISPONIBILIDADE.VIGENCIA_RETROATIVA,
    ],
  })
  readonly erro!: string;
}

export interface DisponibilidadeValidada {
  /** `YYYY-MM-DD`, data civil real. */
  readonly vigenciaInicio: string;
  /** Janelas em ordem canônica; pode ser vazia (D-PRO3-03, regra 5). */
  readonly janelas: readonly JanelaFuncionamento[];
}

type Validacao<T> = { readonly valido: true; readonly valor: T } | { readonly valido: false };

function ehObjetoPlano(corpo: unknown): corpo is Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return false;
  const prototipo = Object.getPrototypeOf(corpo);
  return prototipo === Object.prototype || prototipo === null;
}

function temExatamente(corpo: Record<string, unknown>, chaves: readonly string[]): boolean {
  const presentes = Object.keys(corpo);
  return (
    presentes.length === chaves.length &&
    chaves.every((chave) => Object.prototype.hasOwnProperty.call(corpo, chave))
  );
}

/**
 * Validação do corpo de `PUT /profissionais/:profissionalId/disponibilidade`
 * — pura e fail-closed. Devolve as janelas em ordem canônica.
 */
export function validarCorpoDisponibilidade(corpo: unknown): Validacao<DisponibilidadeValidada> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO_DISPONIBILIDADE)) return { valido: false };

  const vigenciaInicio = corpo["vigenciaInicio"];
  if (typeof vigenciaInicio !== "string" || !ehDataCivilValida(vigenciaInicio)) return { valido: false };

  // As janelas são exatamente a grade de CFG-002 (D-PRO3-01, invariante 3):
  // a função pura homologada é reutilizada, nunca reimplementada.
  const grade = validarCorpoGradeFuncionamento({ janelas: corpo["janelas"] });
  if (!grade.valido) return { valido: false };

  return { valido: true, valor: { vigenciaInicio, janelas: grade.valor } };
}
