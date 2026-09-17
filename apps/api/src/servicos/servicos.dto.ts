// TechLab Fisio — contratos HTTP do catálogo de serviços (CFG-003; `docs/14` §3.11).
//
// Materializa:
//   - D-CFG-24: corpo de POST/PUT com EXATAMENTE { nome, duracaoMin,
//     precoReferencia }; resposta EXATA { id, nome, duracaoMin,
//     precoReferencia, ativo, inativadoEm }; códigos novos somente
//     SERVICO_NAO_ENCONTRADO e SERVICO_DUPLICADO;
//   - D-CFG-25: corpo de PATCH /situacao com EXATAMENTE { ativo: boolean };
//   - D-CFG-26: `ativo` NÃO é aceito na criação nem na edição;
//   - D-CFG-27: nome com trim, 1–200 caracteres, sem caractere de controle;
//     duração inteira 1..1440; preço como STRING decimal canônica não negativa
//     de `numeric(12,2)` (mesma fronteira de `ehDecimalMonetarioCanonico`);
//     sem coerção de tipos; sem dependência nova;
//   - D-CFG-28: única query aceita na listagem é `ativo=true|false`.
//
// Validação pura sem class-validator (mesmo padrão de `clinica.dto.ts`).

import { ApiProperty } from "@nestjs/swagger";

import { ehDecimalMonetarioCanonico } from "../audit/audit.catalog.js";
import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { contarCaracteres, ERRO_CLINICA } from "../clinica/clinica.dto.js";

/** Limites homologados por D-CFG-27. */
export const LIMITES_SERVICO = Object.freeze({
  NOME: 200,
  DURACAO_MIN: 1,
  DURACAO_MAX: 1440,
} as const);

/** Chaves EXATAS aceitas por `POST /servicos` e `PUT /servicos/:servicoId` (D-CFG-24). */
export const CHAVES_CORPO_SERVICO = Object.freeze(["nome", "duracaoMin", "precoReferencia"] as const);

/** Códigos de erro específicos do catálogo de serviços (D-CFG-24). */
export const ERRO_SERVICO = Object.freeze({
  SERVICO_NAO_ENCONTRADO: "SERVICO_NAO_ENCONTRADO",
  SERVICO_DUPLICADO: "SERVICO_DUPLICADO",
} as const);

/** Qualquer caractere de controle C0/C1 — inclui NUL, TAB, CR e LF. */
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;

/** Corpo aceito por `POST /servicos` e `PUT /servicos/:servicoId`. */
export class ServicoRequisicaoDto {
  @ApiProperty({ description: "Nome do serviço; trim aplicado; único por clínica sem distinção de caixa.", minLength: 1, maxLength: LIMITES_SERVICO.NOME, example: "Fisioterapia ortopédica" })
  readonly nome!: string;

  @ApiProperty({ description: "Duração padrão em minutos inteiros.", type: "integer", minimum: LIMITES_SERVICO.DURACAO_MIN, maximum: LIMITES_SERVICO.DURACAO_MAX, example: 50 })
  readonly duracaoMin!: number;

  @ApiProperty({ description: "Preço de referência em BRL, string decimal canônica com duas casas, não negativo.", pattern: "^(0|[1-9]\\d{0,9})\\.\\d{2}$", example: "150.00" })
  readonly precoReferencia!: string;
}

/** Corpo aceito por `PATCH /servicos/:servicoId/situacao`. */
export class SituacaoServicoRequisicaoDto {
  @ApiProperty({ description: "`true` ativa; `false` inativa.", type: Boolean, example: false })
  readonly ativo!: boolean;
}

/** Representação de um serviço nas respostas. */
export class ServicoRespostaDto {
  @ApiProperty({ description: "Identificador UUID estável do serviço.", format: "uuid" })
  readonly id!: string;

  @ApiProperty({ example: "Fisioterapia ortopédica" })
  readonly nome!: string;

  @ApiProperty({ type: "integer", example: 50 })
  readonly duracaoMin!: number;

  @ApiProperty({ description: "String decimal canônica com duas casas.", example: "150.00" })
  readonly precoReferencia!: string;

  @ApiProperty()
  readonly ativo!: boolean;

  @ApiProperty({ description: "Instante da inativação (ISO-8601) ou null quando ativo.", nullable: true, type: String, format: "date-time" })
  readonly inativadoEm!: string | null;
}

/** Corpo de erro padronizado do catálogo de serviços. */
export class ErroServicoDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_CLINICA.CLINICA_NAO_CONFIGURADA,
      ERRO_SERVICO.SERVICO_NAO_ENCONTRADO,
      ERRO_SERVICO.SERVICO_DUPLICADO,
    ],
  })
  readonly erro!: string;
}

export interface DadosServicoValidados {
  readonly nome: string;
  readonly duracaoMin: number;
  readonly precoReferencia: string;
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
 * Nome (D-CFG-27): string; caractere de controle é rejeitado em QUALQUER
 * posição (antes do trim — nenhum controle é "aparado" para dentro do aceite);
 * 1..200 caracteres (code points) após trim. `undefined` indica inválido.
 */
export function normalizarNomeServico(valor: unknown): string | undefined {
  if (typeof valor !== "string" || CONTROLE.test(valor)) return undefined;
  const aparado = valor.trim();
  if (aparado.length === 0 || contarCaracteres(aparado) > LIMITES_SERVICO.NOME) return undefined;
  return aparado;
}

/** Duração (D-CFG-27): number inteiro de 1 a 1440 — sem coerção. */
export function ehDuracaoValida(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor >= LIMITES_SERVICO.DURACAO_MIN &&
    valor <= LIMITES_SERVICO.DURACAO_MAX
  );
}

/** Validação do corpo de `POST /servicos` e `PUT /servicos/:servicoId`. */
export function validarCorpoServico(corpo: unknown): Validacao<DadosServicoValidados> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO_SERVICO)) return { valido: false };

  const nome = normalizarNomeServico(corpo["nome"]);
  const duracaoMin = corpo["duracaoMin"];
  const precoReferencia = corpo["precoReferencia"];
  if (nome === undefined || !ehDuracaoValida(duracaoMin) || !ehDecimalMonetarioCanonico(precoReferencia)) {
    return { valido: false };
  }
  return { valido: true, valor: { nome, duracaoMin, precoReferencia } };
}

/** Validação do corpo de `PATCH /servicos/:servicoId/situacao` (D-CFG-25). */
export function validarCorpoSituacaoServico(corpo: unknown): Validacao<{ readonly ativo: boolean }> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, ["ativo"])) return { valido: false };
  const ativo = corpo["ativo"];
  if (typeof ativo !== "boolean") return { valido: false };
  return { valido: true, valor: { ativo } };
}

/**
 * Query de `GET /servicos` (D-CFG-28): vazia ou exatamente `ativo=true|false`.
 * Parâmetro desconhecido, repetido (array) ou outro valor → inválido.
 * `valor = null` significa sem filtro.
 */
export function validarFiltroServicos(query: unknown): Validacao<boolean | null> {
  if (query === undefined || query === null) return { valido: true, valor: null };
  if (!ehObjetoPlano(query)) return { valido: false };
  const chaves = Object.keys(query);
  if (chaves.length === 0) return { valido: true, valor: null };
  if (chaves.length !== 1 || chaves[0] !== "ativo") return { valido: false };
  const valor = query["ativo"];
  if (valor === "true") return { valido: true, valor: true };
  if (valor === "false") return { valido: true, valor: false };
  return { valido: false };
}
