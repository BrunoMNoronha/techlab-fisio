// TechLab Fisio — máquina de estados do agendamento e catálogo de operações do
// histórico (`docs/15` D-AGD-02, D-AGD-06, D-AGD-07, D-AGD-09; `docs/05` §3;
// RN-020).
//
// Funções PURAS, sem I/O — a decisão de transição é testável sem banco e é a
// MESMA que o serviço aplica sob `SELECT ... FOR UPDATE`.
//
// FRONTEIRA DESTA FATIA: AGD-A opera confirmação, remarcação e cancelamento.
// `AGUARDANDO` (check-in), `FALTA`, `EM_ATENDIMENTO` e `CONCLUIDO` pertencem a
// AGD-B e AGD-E e NÃO são alcançáveis por nenhuma rota desta fatia — a tabela
// de transições abaixo declara a máquina completa de `docs/05` §3 apenas para
// que os estados terminais sejam reconhecidos corretamente na rejeição.
//
// `AGUARDANDO -> CANCELADO` NÃO é oferecido (P-AGD-02, homologada): não há
// permissão excepcional nem coluna de justificativa (FA-03).
//
// AGD-B acrescenta duas decisões PURAS e sem relógio global, derivadas da
// máquina homologada (D-AGD-02) e das regras temporais (D-AGD-03):
//   - check-in: `AGENDADO|CONFIRMADO -> AGUARDANDO`, somente na mesma data civil
//     local do `inicio` (D-AGD-03);
//   - falta: `AGENDADO|CONFIRMADO -> FALTA`, somente após o `inicio`
//     estritamente (`agora > inicio`) (D-AGD-03).
// Em ambas, a origem é validada ANTES da janela temporal.

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
 * AGD-A usa os QUATRO primeiros. `CHECKIN`, `FALTA`, `INICIADO` e `CONCLUIDO`
 * pertencem a AGD-B e AGD-E e são declarados para que o catálogo permaneça
 * único — nenhuma rota desta fatia os escreve.
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
const ORIGENS_CHECKIN_E_FALTA: ReadonlySet<EstadoAgendamento> = new Set<EstadoAgendamento>(["AGENDADO", "CONFIRMADO"]);

/**
 * Desfecho de uma confirmação (D-AGD-02):
 *   - `AGENDADO` .......... transição efetiva para `CONFIRMADO`;
 *   - `CONFIRMADO` ........ **no-op**: `200` sem histórico e sem auditoria
 *                           (precedente `D-CFG-06`);
 *   - qualquer outro ...... `409 TRANSICAO_INVALIDA`, sem mutação.
 */
export type DesfechoConfirmacao = "TRANSICIONA" | "NO_OP" | "INVALIDA";

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

/**
 * Estado resultante de uma remarcação efetiva (D-AGD-06): remarcar um
 * `CONFIRMADO` o devolve a `AGENDADO` — a confirmação referia-se ao horário
 * anterior. `AGENDADO` permanece `AGENDADO`.
 */
export function estadoAposRemarcacao(estado: EstadoAgendamento): EstadoAgendamento {
  return estado === "CONFIRMADO" ? "AGENDADO" : estado;
}

export type MotivoRejeicaoCheckInOuFalta = "TRANSICAO_INVALIDA" | "FORA_DA_JANELA_TEMPORAL";

export type DesfechoCheckIn =
  | { readonly permitido: true; readonly estadoNovo: "AGUARDANDO" }
  | { readonly permitido: false; readonly motivo: MotivoRejeicaoCheckInOuFalta };

export type DesfechoFalta =
  | { readonly permitido: true; readonly estadoNovo: "FALTA" }
  | { readonly permitido: false; readonly motivo: MotivoRejeicaoCheckInOuFalta };

/**
 * Check-in (AGD-B; D-AGD-02 para a máquina, D-AGD-03 para a janela temporal):
 *   - `AGENDADO|CONFIRMADO` ............. transição efetiva para `AGUARDANDO`;
 *   - qualquer outra origem ............. `TRANSICAO_INVALIDA`;
 *   - origem válida fora da data local .. `FORA_DA_JANELA_TEMPORAL`.
 */
export function avaliarCheckIn(
  estado: EstadoAgendamento,
  inicio: Date,
  agora: Date,
  fusoHorario: string,
): DesfechoCheckIn {
  if (!ORIGENS_CHECKIN_E_FALTA.has(estado)) return { permitido: false, motivo: "TRANSICAO_INVALIDA" };

  const dataAgora = paraInstanteLocal(agora, fusoHorario).data;
  const dataInicio = paraInstanteLocal(inicio, fusoHorario).data;
  if (dataAgora !== dataInicio) return { permitido: false, motivo: "FORA_DA_JANELA_TEMPORAL" };

  return { permitido: true, estadoNovo: "AGUARDANDO" };
}

/**
 * Falta (AGD-B; D-AGD-02 para a máquina, D-AGD-03 para a janela temporal):
 *   - `AGENDADO|CONFIRMADO` ... transição efetiva para `FALTA`;
 *   - qualquer outra origem ... `TRANSICAO_INVALIDA`;
 *   - `agora <= inicio` ....... `FORA_DA_JANELA_TEMPORAL`.
 */
export function avaliarFalta(estado: EstadoAgendamento, inicio: Date, agora: Date): DesfechoFalta {
  if (!ORIGENS_CHECKIN_E_FALTA.has(estado)) return { permitido: false, motivo: "TRANSICAO_INVALIDA" };
  if (agora.getTime() <= inicio.getTime()) return { permitido: false, motivo: "FORA_DA_JANELA_TEMPORAL" };
  return { permitido: true, estadoNovo: "FALTA" };
}
