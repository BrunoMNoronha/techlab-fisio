// TechLab Fisio — máquina de estados do agendamento e catálogo de operações do
// histórico (`docs/15` D-AGD-02, D-AGD-03, D-AGD-06, D-AGD-07, D-AGD-09;
// `docs/05` §3; RN-020).
//
// Funções PURAS, sem I/O — a decisão de transição é testável sem banco e é a
// MESMA que o serviço aplica sob `SELECT ... FOR UPDATE`.
//
// AGD-A opera confirmação, remarcação e cancelamento.
// AGD-B opera check-in e falta.
// `EM_ATENDIMENTO` e `CONCLUIDO` pertencem à AGD-E.
//
// `AGUARDANDO -> CANCELADO` NÃO é oferecido (P-AGD-02, homologada): não há
// permissão excepcional nem coluna de justificativa (FA-03).

import { paraInstanteLocal } from "./horario-funcionamento.regra.js";

/** Os sete estados de `estado_agendamento` (`docs/03` §5.1). */
export type EstadoAgendamento =
  | "AGENDADO"
  | "CONFIRMADO"
  | "AGUARDANDO"
  | "EM_ATENDIMENTO"
  | "CONCLUIDO"
  | "FALTA"
  | "CANCELADO";

/** Estados terminais — RN-020. */
export const ESTADOS_TERMINAIS: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>([
  "CANCELADO",
  "FALTA",
  "CONCLUIDO",
]);

/**
 * Catálogo FECHADO de `historico_agendamento.operacao` (D-AGD-09). A coluna é
 * `text` porque AGD-009 não enumera operações (`docs/07` §11.1); o conjunto
 * fechado vive aqui, na aplicação.
 *
 * AGD-A usa os QUATRO primeiros. `CHECKIN` e `FALTA` pertencem a AGD-B;
 * `INICIADO` e `CONCLUIDO`, a AGD-E. O catálogo permanece único para todas as
 * fatias que escrevem histórico.
 */
export const OPERACOES_HISTORICO = Object.freeze([
  "CRIADO",
  "CONFIRMADO",
  "REMARCADO",
  "CANCELADO",
  "CHECKIN",
  "FALTA",
  "INICIADO",
  "CONCLUIDO",
] as const);

export type OperacaoHistorico = (typeof OPERACOES_HISTORICO)[number];

/** As quatro operações que AGD-A pode escrever. */
export const OPERACOES_AGD_A: readonly OperacaoHistorico[] = Object.freeze([
  "CRIADO",
  "CONFIRMADO",
  "REMARCADO",
  "CANCELADO",
]);

/** Estados a partir dos quais a confirmação é admitida (D-AGD-02). */
const ORIGENS_CONFIRMACAO: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>(["AGENDADO"]);

/** Estados a partir dos quais remarcação e cancelamento são admitidos (D-AGD-06, D-AGD-07). */
const ORIGENS_REMARCACAO: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>([
  "AGENDADO",
  "CONFIRMADO",
]);
const ORIGENS_CANCELAMENTO: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>([
  "AGENDADO",
  "CONFIRMADO",
]);
const ORIGENS_CHECKIN: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>([
  "AGENDADO",
  "CONFIRMADO",
]);
const ORIGENS_FALTA: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>([
  "AGENDADO",
  "CONFIRMADO",
]);

/**
 * Desfecho de uma confirmação (D-AGD-02):
 *   - `AGENDADO` .......... transição efetiva para `CONFIRMADO`;
 *   - `CONFIRMADO` ........ **no-op**: `200` sem histórico e sem auditoria
 *                           (precedente `D-CFG-06`);
 *   - qualquer outro ...... `409 TRANSICAO_INVALIDA`, sem mutação.
 */
export type DesfechoConfirmacao = "TRANSICIONA" | "NO_OP" | "INVALIDA";
export type DesfechoMutacaoAgenda = "ADMITE" | "TRANSICAO_INVALIDA" | "FORA_DA_JANELA_TEMPORAL";

export function avaliarConfirmacao(estado: EstadoAgendamento): DesfechoConfirmacao {
  if (ORIGENS_CONFIRMACAO.has(estado)) return "TRANSICIONA";
  if (estado === "CONFIRMADO") return "NO_OP";
  return "INVALIDA";
}

/** `true` sse a remarcação é admitida a partir deste estado (D-AGD-06). */
export function permiteRemarcacao(estado: EstadoAgendamento): boolean {
  return ORIGENS_REMARCACAO.has(estado);
}

/** `true` sse o cancelamento é admitido a partir deste estado (D-AGD-07). */
export function permiteCancelamento(estado: EstadoAgendamento): boolean {
  return ORIGENS_CANCELAMENTO.has(estado);
}

/** `true` sse check-in é admitido a partir deste estado (AGD-B). */
export function permiteCheckIn(estado: EstadoAgendamento): boolean {
  return ORIGENS_CHECKIN.has(estado);
}

/** `true` sse falta é admitida a partir deste estado (AGD-B). */
export function permiteFalta(estado: EstadoAgendamento): boolean {
  return ORIGENS_FALTA.has(estado);
}

export function avaliarCheckIn(entrada: {
  readonly estado: EstadoAgendamento;
  readonly inicio: Date;
  readonly agora: Date;
  readonly fusoHorario: string;
}): DesfechoMutacaoAgenda {
  const { estado, inicio, agora, fusoHorario } = entrada;
  if (!permiteCheckIn(estado)) return "TRANSICAO_INVALIDA";
  return paraInstanteLocal(inicio, fusoHorario).data === paraInstanteLocal(agora, fusoHorario).data
    ? "ADMITE"
    : "FORA_DA_JANELA_TEMPORAL";
}

export function avaliarFalta(entrada: {
  readonly estado: EstadoAgendamento;
  readonly inicio: Date;
  readonly agora: Date;
  readonly fusoHorario: string;
}): DesfechoMutacaoAgenda {
  const { estado, inicio, agora } = entrada;
  if (!permiteFalta(estado)) return "TRANSICAO_INVALIDA";
  return agora.getTime() > inicio.getTime() ? "ADMITE" : "FORA_DA_JANELA_TEMPORAL";
}

/**
 * Estado resultante de uma remarcação efetiva (D-AGD-06): remarcar um
 * `CONFIRMADO` o devolve a `AGENDADO` — a confirmação referia-se ao horário
 * anterior. `AGENDADO` permanece `AGENDADO`.
 */
export function estadoAposRemarcacao(estado: EstadoAgendamento): EstadoAgendamento {
  return estado === "CONFIRMADO" ? "AGENDADO" : estado;
}
