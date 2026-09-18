// TechLab Fisio — contratos HTTP da fatia AGD-A (`docs/15` D-AGD-03,
// D-AGD-04, D-AGD-05, D-AGD-06, D-AGD-07, D-AGD-13, D-AGD-14).
//
// Materializa:
//   - D-AGD-05: corpos EXATOS de cada rota (`POST /agendamentos` com
//     `{ pacienteId, profissionalId, servicoId, inicio, fim }`; confirmação com
//     `{}`; remarcação com `{ inicio, fim }`; cancelamento com
//     `{ motivoCancelamentoId }`); resposta EXATA, com instantes ISO-8601 UTC,
//     sem dado clínico e sem campo de auditoria; `modalidade` nunca vem do
//     cliente (AGD-A cria somente `AVULSO`);
//   - D-AGD-04 item 2 e 3: corpo estrito, sem coerção de tipos; instantes
//     ISO-8601 com offset explícito; `fim > inicio`; segundos e milissegundos
//     zerados; duração de 1 a 1440 minutos. Tudo isso é `400`; o `inicio` no
//     passado é `422 AGENDAMENTO_NO_PASSADO` e é decidido no serviço, contra o
//     relógio do servidor no instante da transação — não aqui;
//   - D-AGD-14: `de` e `ate` obrigatórios, janela `[de, ate)` de no máximo
//     7 dias, `profissionalId` opcional; qualquer outro parâmetro é rejeitado;
//   - D-AGD-13: forma da resposta de `GET /agenda/opcoes`.
//
// Validação PURA, sem class-validator — mesmo padrão de `servicos.dto.ts`,
// `motivos-cancelamento.dto.ts` e `disponibilidade.dto.ts`. Nenhuma dependência
// nova.
//
// REUSO DELIBERADO: `analisarInstante` é a função já homologada de
// `audit/audit-query.dto.ts` (AUD-004) — mesma exigência de ISO-8601 com fuso
// explícito, mesma recusa de data civil impossível e de precisão acima do
// milissegundo. Reimplementá-la aqui criaria duas definições divergentes do
// mesmo formato.

import { ApiProperty } from "@nestjs/swagger";

import { analisarInstante } from "../audit/audit-query.dto.js";
import { ERRO } from "../auth/auth.dto.js";
import { ehUuidValido } from "../auth/usuarios.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { ERRO_AGENDA } from "./verificador-horario-funcionamento.js";

/** Limites homologados por D-AGD-04 (item 3) e D-AGD-14. */
export const LIMITES_AGENDA = Object.freeze({
  /** Duração mínima, em minutos. */
  DURACAO_MIN: 1,
  /** Duração máxima, em minutos. */
  DURACAO_MAX: 1440,
  /** Janela máxima de consulta, em dias (visões diária e semanal). */
  JANELA_CONSULTA_DIAS: 7,
} as const);

const MS_MINUTO = 60_000;
const MS_DIA = 86_400_000;

/**
 * Códigos de erro específicos de AGD-A (D-AGD-02, D-AGD-04, D-AGD-05,
 * D-AGD-07). `FORA_DO_HORARIO_FUNCIONAMENTO` e `FORA_DA_DISPONIBILIDADE`
 * NÃO são redeclarados: pertencem a `ERRO_AGENDA`, já homologado por
 * `D-CFG-61` e `D-PRO3-04`.
 */
export const ERRO_AGENDAMENTO = Object.freeze({
  /** `404` — também para recurso fora do escopo do ator (D-AGD-12). */
  AGENDAMENTO_NAO_ENCONTRADO: "AGENDAMENTO_NAO_ENCONTRADO",
  /** `422` — D-AGD-03: sem lançamento retroativo. */
  AGENDAMENTO_NO_PASSADO: "AGENDAMENTO_NO_PASSADO",
  /** `422` — RN-013: inexistente e inativo recebem o MESMO código. */
  PACIENTE_INELEGIVEL: "PACIENTE_INELEGIVEL",
  /** `422` — RN-008, PRO-005. */
  PROFISSIONAL_INELEGIVEL: "PROFISSIONAL_INELEGIVEL",
  /** `422` — RN-008, D-CFG-33. */
  SERVICO_INELEGIVEL: "SERVICO_INELEGIVEL",
  /** `422` — PRO-004: falta a linha de `profissional_servico`. */
  SERVICO_NAO_HABILITADO: "SERVICO_NAO_HABILITADO",
  /** `422` — D-AGD-07: motivo inexistente, inativo ou catálogo sem ativos. */
  MOTIVO_CANCELAMENTO_INELEGIVEL: "MOTIVO_CANCELAMENTO_INELEGIVEL",
  /** `422` — AGD-B: operação fora da janela temporal homologada. */
  FORA_DA_JANELA_TEMPORAL: "FORA_DA_JANELA_TEMPORAL",
  /** `409` — D-AGD-02: transição fora da máquina de estados. */
  TRANSICAO_INVALIDA: "TRANSICAO_INVALIDA",
  /** `409` — RN-015.2: sobreposição com `bloqueio_agenda`. */
  CONFLITO_BLOQUEIO: "CONFLITO_BLOQUEIO",
  /** `409` — RN-015.1: `ex_agendamento_profissional`. */
  CONFLITO_PROFISSIONAL: "CONFLITO_PROFISSIONAL",
  /** `409` — RN-015.3: `ex_agendamento_paciente`. */
  CONFLITO_PACIENTE: "CONFLITO_PACIENTE",
} as const);

// ---------------------------------------------------------------------------
// Corpos de requisição
// ---------------------------------------------------------------------------

const CHAVES_CRIACAO = Object.freeze([
  "pacienteId",
  "profissionalId",
  "servicoId",
  "inicio",
  "fim",
] as const);
const CHAVES_REMARCACAO = Object.freeze(["inicio", "fim"] as const);
const CHAVES_CANCELAMENTO = Object.freeze(["motivoCancelamentoId"] as const);

const DESCRICAO_INSTANTE =
  "Instante ISO-8601 com offset explícito (`Z` ou `±HH:MM`), com segundos e " +
  "milissegundos zerados.";

export class CriarAgendamentoRequisicaoDto {
  @ApiProperty({ description: "Paciente do agendamento.", format: "uuid" })
  readonly pacienteId!: string;

  @ApiProperty({ description: "Profissional que atenderá.", format: "uuid" })
  readonly profissionalId!: string;

  @ApiProperty({ description: "Serviço a ser realizado.", format: "uuid" })
  readonly servicoId!: string;

  @ApiProperty({ description: `Início. ${DESCRICAO_INSTANTE}`, example: "2026-10-01T13:00:00Z" })
  readonly inicio!: string;

  @ApiProperty({
    description:
      `Fim. ${DESCRICAO_INSTANTE} A interface propõe ` +
      "`inicio + servico.duracaoMin`, mas o backend aceita duração diferente " +
      "(D-AGD-05), limitada a 1..1440 minutos.",
    example: "2026-10-01T13:50:00Z",
  })
  readonly fim!: string;
}

/** Corpo de `POST /agendamentos/:agendamentoId/confirmacao` — objeto vazio. */
export class ConfirmarAgendamentoRequisicaoDto {}
/** Corpo de `POST /agendamentos/:agendamentoId/check-in` — objeto vazio. */
export class CheckInAgendamentoRequisicaoDto {}
/** Corpo de `POST /agendamentos/:agendamentoId/falta` — objeto vazio. */
export class RegistrarFaltaAgendamentoRequisicaoDto {}

export class RemarcarAgendamentoRequisicaoDto {
  @ApiProperty({ description: `Novo início. ${DESCRICAO_INSTANTE}`, example: "2026-10-02T13:00:00Z" })
  readonly inicio!: string;

  @ApiProperty({ description: `Novo fim. ${DESCRICAO_INSTANTE}`, example: "2026-10-02T13:50:00Z" })
  readonly fim!: string;
}

export class CancelarAgendamentoRequisicaoDto {
  @ApiProperty({
    description: "Motivo padronizado, obrigatório e ativo (D-AGD-07).",
    format: "uuid",
  })
  readonly motivoCancelamentoId!: string;
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export class ReferenciaNomeadaDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty()
  readonly nome!: string;
}

/** Resposta EXATA de D-AGD-05 — sem dado clínico (RN-009) e sem auditoria. */
export class AgendamentoRespostaDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty({ type: ReferenciaNomeadaDto })
  readonly paciente!: ReferenciaNomeadaDto;

  @ApiProperty({ type: ReferenciaNomeadaDto })
  readonly profissional!: ReferenciaNomeadaDto;

  @ApiProperty({ type: ReferenciaNomeadaDto })
  readonly servico!: ReferenciaNomeadaDto;

  @ApiProperty({ description: "Início em ISO-8601 UTC.", format: "date-time" })
  readonly inicio!: string;

  @ApiProperty({ description: "Fim em ISO-8601 UTC.", format: "date-time" })
  readonly fim!: string;

  @ApiProperty({
    description: "Estado operacional do agendamento.",
    enum: ["AGENDADO", "CONFIRMADO", "AGUARDANDO", "EM_ATENDIMENTO", "CONCLUIDO", "FALTA", "CANCELADO"],
  })
  readonly estado!: string;

  @ApiProperty({ description: "AGD-A cria somente AVULSO.", enum: ["AVULSO", "PACOTE"] })
  readonly modalidade!: string;

  @ApiProperty({ nullable: true, type: String, format: "uuid" })
  readonly motivoCancelamentoId!: string | null;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  readonly canceladoEm!: string | null;
}

export class ServicoOpcaoDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty()
  readonly nome!: string;

  @ApiProperty({ description: "Duração de referência do serviço, em minutos." })
  readonly duracaoMin!: number;
}

export class MotivoCancelamentoOpcaoDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty()
  readonly descricao!: string;
}

export class JanelaOpcaoDto {
  @ApiProperty({ description: "0 = domingo .. 6 = sábado.", minimum: 0, maximum: 6 })
  readonly diaSemana!: number;

  @ApiProperty({ example: "08:00" })
  readonly horaInicio!: string;

  @ApiProperty({ example: "12:00" })
  readonly horaFim!: string;
}

export class HorarioFuncionamentoOpcaoDto {
  @ApiProperty({ type: [JanelaOpcaoDto] })
  readonly janelas!: JanelaOpcaoDto[];
}

/** Resposta de `GET /agenda/opcoes` (D-AGD-13) — só ativos, sem preço. */
export class AgendaOpcoesRespostaDto {
  @ApiProperty({ type: [ServicoOpcaoDto], description: "Somente serviços ativos; sem preço de referência." })
  readonly servicos!: ServicoOpcaoDto[];

  @ApiProperty({ type: [MotivoCancelamentoOpcaoDto], description: "Somente motivos ativos." })
  readonly motivosCancelamento!: MotivoCancelamentoOpcaoDto[];

  @ApiProperty({ type: HorarioFuncionamentoOpcaoDto })
  readonly horarioFuncionamento!: HorarioFuncionamentoOpcaoDto;

  @ApiProperty({ description: "Identificador IANA do fuso da clínica.", example: "America/Sao_Paulo" })
  readonly fusoHorario!: string;
}

/** Corpo de erro padronizado da agenda. */
export class ErroAgendamentoDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_CLINICA.CLINICA_NAO_CONFIGURADA,
      ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO,
      ERRO_AGENDA.FORA_DA_DISPONIBILIDADE,
      ...Object.values(ERRO_AGENDAMENTO),
    ],
  })
  readonly erro!: string;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export type Validacao<T> =
  | { readonly valido: true; readonly valor: T }
  | { readonly valido: false };

const INVALIDO: Validacao<never> = { valido: false };

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const prototipo: unknown = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

function temExatamente(objeto: Record<string, unknown>, chaves: readonly string[]): boolean {
  const presentes = Object.keys(objeto);
  return (
    presentes.length === chaves.length &&
    chaves.every((chave) => Object.prototype.hasOwnProperty.call(objeto, chave))
  );
}

/**
 * Instante de agendamento (D-AGD-04, item 3): ISO-8601 com offset explícito e
 * com **segundos e milissegundos zerados** — "minutos inteiros". A precisão é
 * verificada no instante ABSOLUTO, não no texto: `13:00:00.000-03:00` é aceito
 * e `13:00:30Z` é recusado, independentemente da forma escrita.
 */
export function analisarInstanteAgendamento(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const instante = analisarInstante(valor);
  if (instante === null) return null;
  return instante.getTime() % MS_MINUTO === 0 ? instante : null;
}

export interface IntervaloValidado {
  readonly inicio: Date;
  readonly fim: Date;
}

/**
 * Intervalo `[inicio, fim)`: ambos os instantes válidos, `fim > inicio` e
 * duração entre 1 e 1440 minutos. NÃO decide nada sobre o passado — isso é
 * `422` e pertence ao serviço (D-AGD-03).
 */
export function validarIntervalo(inicioBruto: unknown, fimBruto: unknown): Validacao<IntervaloValidado> {
  const inicio = analisarInstanteAgendamento(inicioBruto);
  const fim = analisarInstanteAgendamento(fimBruto);
  if (inicio === null || fim === null) return INVALIDO;
  const duracaoMin = (fim.getTime() - inicio.getTime()) / MS_MINUTO;
  if (duracaoMin < LIMITES_AGENDA.DURACAO_MIN || duracaoMin > LIMITES_AGENDA.DURACAO_MAX) {
    return INVALIDO;
  }
  return { valido: true, valor: { inicio, fim } };
}

export interface DadosCriacaoValidados extends IntervaloValidado {
  readonly pacienteId: string;
  readonly profissionalId: string;
  readonly servicoId: string;
}

/** Corpo de `POST /agendamentos` (D-AGD-05). */
export function validarCorpoCriacao(corpo: unknown): Validacao<DadosCriacaoValidados> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CRIACAO)) return INVALIDO;
  const { pacienteId, profissionalId, servicoId } = corpo;
  if (!ehUuidValido(pacienteId) || !ehUuidValido(profissionalId) || !ehUuidValido(servicoId)) {
    return INVALIDO;
  }
  const intervalo = validarIntervalo(corpo["inicio"], corpo["fim"]);
  if (!intervalo.valido) return INVALIDO;
  return {
    valido: true,
    valor: {
      pacienteId,
      profissionalId,
      servicoId,
      inicio: intervalo.valor.inicio,
      fim: intervalo.valor.fim,
    },
  };
}

/** Corpo de `POST /agendamentos/:agendamentoId/confirmacao` — exatamente `{}`. */
function validarCorpoVazio(corpo: unknown): Validacao<Record<string, never>> {
  if (!ehObjetoPlano(corpo) || Object.keys(corpo).length !== 0) return INVALIDO;
  return { valido: true, valor: {} };
}

/** Corpo de `POST /agendamentos/:agendamentoId/confirmacao` — exatamente `{}`. */
export function validarCorpoConfirmacao(corpo: unknown): Validacao<Record<string, never>> {
  return validarCorpoVazio(corpo);
}

/** Corpo de `POST /agendamentos/:agendamentoId/check-in` — exatamente `{}`. */
export function validarCorpoCheckIn(corpo: unknown): Validacao<Record<string, never>> {
  return validarCorpoVazio(corpo);
}

/** Corpo de `POST /agendamentos/:agendamentoId/falta` — exatamente `{}`. */
export function validarCorpoFalta(corpo: unknown): Validacao<Record<string, never>> {
  return validarCorpoVazio(corpo);
}

/** Corpo de `POST /agendamentos/:agendamentoId/remarcacao` (D-AGD-06). */
export function validarCorpoRemarcacao(corpo: unknown): Validacao<IntervaloValidado> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_REMARCACAO)) return INVALIDO;
  return validarIntervalo(corpo["inicio"], corpo["fim"]);
}

/** Corpo de `POST /agendamentos/:agendamentoId/cancelamento` (D-AGD-07). */
export function validarCorpoCancelamento(
  corpo: unknown,
): Validacao<{ readonly motivoCancelamentoId: string }> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CANCELAMENTO)) return INVALIDO;
  const motivoCancelamentoId = corpo["motivoCancelamentoId"];
  if (!ehUuidValido(motivoCancelamentoId)) return INVALIDO;
  return { valido: true, valor: { motivoCancelamentoId } };
}

export interface FiltroAgenda {
  readonly de: Date;
  readonly ate: Date;
  /** `null` quando o cliente não restringiu a um profissional. */
  readonly profissionalId: string | null;
}

/**
 * Query de `GET /agendamentos` (D-AGD-14): `de` e `ate` obrigatórios,
 * `profissionalId` opcional, nenhum outro parâmetro. Janela `[de, ate)` com
 * `ate > de` e no máximo 7 dias.
 *
 * Os limites da janela NÃO exigem minutos inteiros: são uma consulta, não um
 * agendamento. Exigem apenas a mesma forma ISO-8601 com offset explícito.
 */
export function validarFiltroAgenda(query: unknown): Validacao<FiltroAgenda> {
  if (!ehObjetoPlano(query)) return INVALIDO;
  for (const chave of Object.keys(query)) {
    if (chave !== "de" && chave !== "ate" && chave !== "profissionalId") return INVALIDO;
  }

  const deBruto = query["de"];
  const ateBruto = query["ate"];
  if (typeof deBruto !== "string" || typeof ateBruto !== "string") return INVALIDO;
  const de = analisarInstante(deBruto);
  const ate = analisarInstante(ateBruto);
  if (de === null || ate === null) return INVALIDO;

  const duracaoMs = ate.getTime() - de.getTime();
  if (duracaoMs <= 0 || duracaoMs > LIMITES_AGENDA.JANELA_CONSULTA_DIAS * MS_DIA) return INVALIDO;

  if (!Object.prototype.hasOwnProperty.call(query, "profissionalId")) {
    return { valido: true, valor: { de, ate, profissionalId: null } };
  }
  const profissionalId = query["profissionalId"];
  if (!ehUuidValido(profissionalId)) return INVALIDO;
  return { valido: true, valor: { de, ate, profissionalId } };
}
