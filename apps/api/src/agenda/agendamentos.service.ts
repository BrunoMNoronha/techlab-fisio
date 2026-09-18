// TechLab Fisio — serviço da agenda (AGD-A + AGD-B; `docs/15` D-AGD-02..D-AGD-14;
// `docs/07` §17.4 T-01, §24).
//
// Materializa:
//   - D-AGD-04: a ORDEM homologada das verificações de criação, com os códigos
//     homologados e SEM mutação em qualquer falha. Identificador inexistente e
//     inativo recebem o MESMO código — sem oráculo de existência;
//   - D-AGD-05: AGD-A grava somente `modalidade = AVULSO`; `pacote_id`
//     permanece nulo e nenhum caminho o preenche;
//   - D-AGD-06: remarcação altera SOMENTE `inicio`/`fim`, revalida os itens 3 e
//     5..11 contra a grade, a disponibilidade e o fuso VIGENTES, e devolve um
//     `CONFIRMADO` a `AGENDADO`;
//   - D-AGD-07: cancelamento exige motivo padronizado existente e ATIVO, lido
//     sob `FOR SHARE`, e grava os quatro campos de cancelamento juntos — o que
//     a migration `20260917230000_agendamento_cancelamento_coerente` passa a
//     exigir fisicamente;
//   - D-AGD-09: UMA linha de `historico_agendamento` por mutação EFETIVA, na
//     mesma transação; no-op, rejeição e negação não escrevem linha alguma;
//   - D-AGD-10: UM evento por criação, remarcação e cancelamento efetivos, com
//     `contexto` VAZIO e o MESMO `correlacao_id` da linha de histórico; a
//     confirmação fica SÓ no histórico;
//   - D-AGD-11: exclusion constraints decidem o conflito temporal na gravação;
//     confirmação, remarcação e cancelamento leem a linha sob
//     `SELECT ... FOR UPDATE` antes de avaliar o estado; ordem de locks
//     `agendamento -> motivo (FOR SHARE)`. Sem coluna de versão e sem
//     `If-Match` (D-AGD-08);
//   - D-AGD-12: o escopo do ator decide o que a leitura enxerga, o que a
//     mutação por id alcança e para quem a criação é permitida;
//   - D-AGD-14: a consulta devolve os agendamentos que INTERSECTAM `[de, ate)`,
//     em todos os estados, na ordem `inicio, id`, sem paginação.
//
// CORRELAÇÃO HISTÓRICO x AUDITORIA — decisão LOCAL de implementação, declarada:
// `historico_agendamento` NÃO possui coluna `correlacao_id` (a persistência da
// Fase 2 está encerrada e esta fatia só foi autorizada a criar o CHECK de
// `D-AGD-07`). A exigência de `docs/07` §22.4 e de `D-AGD-10` — "as duas linhas
// com o mesmo `correlacao_id`" — é materializada usando o MESMO UUID como
// `historico_agendamento.id` e como `evento_auditoria.correlacao_id`, de modo
// que a junção `evento_auditoria.correlacao_id = historico_agendamento.id` é
// exata. Nenhuma coluna nova, nenhuma migration além da autorizada.
//
// RACE RESIDUAL ACEITA (D-AGD-11, `R2.2-09`, `D-CFG-63`): horário de
// funcionamento, disponibilidade e bloqueio são validados SEM lock. Uma
// alteração concorrente da grade, da disponibilidade ou dos bloqueios entre a
// validação e a gravação não é detectada. Só o conflito temporal entre
// agendamentos é estrutural — e esse é garantido pelas exclusion constraints.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import {
  CONSTRAINTS_CONFLITO_AGENDA,
  ehConflitoAgenda,
  identificarViolacao,
  type TransacaoPersistencia,
} from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import { DatabaseService } from "../database/database.service.js";
import {
  EscopoAgendaService,
  PERMISSAO_AGENDA_CHECKIN,
  PERMISSAO_AGENDA_FALTA,
  escopoAlcanca,
  restricaoDaLeitura,
} from "./agenda.escopo.js";
import type { EscopoAgenda } from "./agenda.escopo.js";
import {
  avaliarConfirmacao,
  checkInNaJanelaTemporal,
  estadoAposCheckIn,
  estadoAposFalta,
  estadoAposRemarcacao,
  faltaNaJanelaTemporal,
  permiteCheckIn,
  permiteCancelamento,
  permiteFalta,
  permiteRemarcacao,
  type EstadoAgendamento,
  type OperacaoHistorico,
} from "./agenda.estados.js";
import type { DadosCriacaoValidados, FiltroAgenda, IntervaloValidado } from "./agenda.dto.js";
import { VerificadorDisponibilidadeProfissional } from "./verificador-disponibilidade-profissional.js";
import { VerificadorHorarioFuncionamento } from "./verificador-horario-funcionamento.js";

/** `alvo_tipo` dos eventos de auditoria desta fatia (D-AUD-03 — nome físico). */
const ALVO_AGENDAMENTO = "agendamento";

export type MotivoRejeicaoAgendamento =
  | "ACESSO_NEGADO"
  | "AGENDAMENTO_NAO_ENCONTRADO"
  | "AGENDAMENTO_NO_PASSADO"
  | "PACIENTE_INELEGIVEL"
  | "PROFISSIONAL_INELEGIVEL"
  | "SERVICO_INELEGIVEL"
  | "SERVICO_NAO_HABILITADO"
  | "MOTIVO_CANCELAMENTO_INELEGIVEL"
  | "FORA_DA_JANELA_TEMPORAL"
  | "TRANSICAO_INVALIDA"
  | "CONFLITO_BLOQUEIO"
  | "CONFLITO_PROFISSIONAL"
  | "CONFLITO_PACIENTE";

export class ErroAgendamento extends Error {
  override readonly name = "ErroAgendamento";

  constructor(readonly motivo: MotivoRejeicaoAgendamento) {
    super(`Operação da agenda rejeitada: ${motivo}.`);
  }
}

export interface ReferenciaNomeada {
  readonly id: string;
  readonly nome: string;
}

export interface DadosAgendamento {
  readonly id: string;
  readonly paciente: ReferenciaNomeada;
  readonly profissional: ReferenciaNomeada;
  readonly servico: ReferenciaNomeada;
  readonly inicio: Date;
  readonly fim: Date;
  readonly estado: EstadoAgendamento;
  readonly modalidade: string;
  readonly motivoCancelamentoId: string | null;
  readonly canceladoEm: Date | null;
}

export interface ResultadoMutacaoAgendamento {
  readonly agendamento: DadosAgendamento;
  /** `false` no no-op de confirmação e de remarcação (sem histórico e sem evento). */
  readonly mutacaoExecutada: boolean;
}

interface LinhaAgendamento {
  id: string;
  inicio: Date;
  fim: Date;
  estado: EstadoAgendamento;
  modalidade: string;
  motivo_cancelamento_id: string | null;
  cancelado_em: Date | null;
  paciente_id: string;
  paciente_nome: string;
  profissional_id: string;
  profissional_nome: string;
  servico_id: string;
  servico_nome: string;
}

function mapear(linha: LinhaAgendamento): DadosAgendamento {
  return {
    id: linha.id,
    paciente: { id: linha.paciente_id, nome: linha.paciente_nome },
    profissional: { id: linha.profissional_id, nome: linha.profissional_nome },
    servico: { id: linha.servico_id, nome: linha.servico_nome },
    inicio: linha.inicio,
    fim: linha.fim,
    estado: linha.estado,
    modalidade: linha.modalidade,
    motivoCancelamentoId: linha.motivo_cancelamento_id,
    canceladoEm: linha.cancelado_em,
  };
}

/** Linha mínima para decidir escopo e transição sob o lock. */
interface LinhaControle {
  id: string;
  estado: EstadoAgendamento;
  inicio: Date;
  fim: Date;
  profissional_id: string;
  servico_id: string;
}

const [CONSTRAINT_CONFLITO_PROFISSIONAL, CONSTRAINT_CONFLITO_PACIENTE] =
  CONSTRAINTS_CONFLITO_AGENDA;

/**
 * Traduz a violação `23P01` — e SOMENTE ela, e somente nas duas exclusion
 * constraints conhecidas da agenda — no código de conflito correspondente
 * (D-AGD-04 item 11). Qualquer outro erro do PostgreSQL passa intacto: um
 * `23P01` de uma exclusion constraint futura desconhecida NÃO vira conflito de
 * agenda (fail closed, `ehConflitoAgenda`).
 */
function traduzirConflitoTemporal(erro: unknown): never {
  if (ehConflitoAgenda(erro)) {
    const nome = identificarViolacao(erro)?.constraint;
    if (nome === CONSTRAINT_CONFLITO_PROFISSIONAL) throw new ErroAgendamento("CONFLITO_PROFISSIONAL");
    if (nome === CONSTRAINT_CONFLITO_PACIENTE) throw new ErroAgendamento("CONFLITO_PACIENTE");
  }
  throw erro;
}

async function comConflitoTraduzido<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    traduzirConflitoTemporal(erro);
  }
}

@Injectable()
export class AgendamentosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
    private readonly escopos: EscopoAgendaService,
    private readonly horario: VerificadorHorarioFuncionamento,
    private readonly disponibilidade: VerificadorDisponibilidadeProfissional,
  ) {}

  // -------------------------------------------------------------------------
  // Leitura (D-AGD-14, D-AGD-05)
  // -------------------------------------------------------------------------

  /**
   * Agendamentos que INTERSECTAM `[de, ate)`, em todos os estados, ordem
   * `inicio, id`, sem paginação. No escopo próprio o `profissionalId` pedido é
   * ignorado e substituído pelo do ator.
   */
  async listar(comando: {
    atorUsuarioId: string;
    filtro: FiltroAgenda;
  }): Promise<DadosAgendamento[]> {
    return this.database.transacao(async (tx) => {
      const escopo = await this.escopos.resolver(tx, comando.atorUsuarioId);
      const restricao = restricaoDaLeitura(escopo, comando.filtro.profissionalId);
      if (restricao.tipo === "VAZIO") return [];

      // Intersecção com `[de, ate)`: `inicio < ate AND fim > de`. Um
      // agendamento que apenas encosta na borda da janela NÃO intersecta.
      const { de, ate } = comando.filtro;
      const linhas =
        restricao.tipo === "SEM_RESTRICAO"
          ? await tx.$queryRaw<LinhaAgendamento[]>`
              SELECT a.id, a.inicio, a.fim, a.estado::text AS estado,
                     a.modalidade::text AS modalidade, a.motivo_cancelamento_id, a.cancelado_em,
                     pac.id AS paciente_id, pac.nome AS paciente_nome,
                     pro.id AS profissional_id, pro.nome AS profissional_nome,
                     srv.id AS servico_id, srv.nome AS servico_nome
                FROM agendamento a
                JOIN paciente pac ON pac.id = a.paciente_id
                JOIN profissional pro ON pro.id = a.profissional_id
                JOIN servico srv ON srv.id = a.servico_id
               WHERE a.inicio < ${ate}::timestamptz AND a.fim > ${de}::timestamptz
               ORDER BY a.inicio ASC, a.id ASC`
          : await tx.$queryRaw<LinhaAgendamento[]>`
              SELECT a.id, a.inicio, a.fim, a.estado::text AS estado,
                     a.modalidade::text AS modalidade, a.motivo_cancelamento_id, a.cancelado_em,
                     pac.id AS paciente_id, pac.nome AS paciente_nome,
                     pro.id AS profissional_id, pro.nome AS profissional_nome,
                     srv.id AS servico_id, srv.nome AS servico_nome
                FROM agendamento a
                JOIN paciente pac ON pac.id = a.paciente_id
                JOIN profissional pro ON pro.id = a.profissional_id
                JOIN servico srv ON srv.id = a.servico_id
               WHERE a.inicio < ${ate}::timestamptz AND a.fim > ${de}::timestamptz
                 AND a.profissional_id = ${restricao.profissionalId}::uuid
               ORDER BY a.inicio ASC, a.id ASC`;
      return linhas.map(mapear);
    });
  }

  /** `404` também quando o agendamento existe mas está fora do escopo (D-AGD-12). */
  async consultar(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
  }): Promise<DadosAgendamento> {
    return this.database.transacao(async (tx) => {
      const escopo = await this.escopos.resolver(tx, comando.atorUsuarioId);
      const agendamento = await this.#lerProjecao(tx, comando.agendamentoId);
      if (agendamento === null || !escopoAlcanca(escopo, agendamento.profissional.id)) {
        throw new ErroAgendamento("AGENDAMENTO_NAO_ENCONTRADO");
      }
      return agendamento;
    });
  }

  // -------------------------------------------------------------------------
  // Criação (D-AGD-04, D-AGD-05, T-01)
  // -------------------------------------------------------------------------

  async criar(comando: {
    atorUsuarioId: string;
    dados: DadosCriacaoValidados;
  }): Promise<DadosAgendamento> {
    const correlacaoId = randomUUID();
    const { dados } = comando;

    return comConflitoTraduzido(
      this.database.transacao(async (tx) => {
        // Passo 1 (parte de escopo) — a permissão já foi decidida pelas guards;
        // aqui decide-se PARA QUEM a criação é permitida (D-AGD-12).
        const escopo = await this.escopos.resolver(tx, comando.atorUsuarioId);
        if (!escopoAlcanca(escopo, dados.profissionalId)) {
          throw new ErroAgendamento("ACESSO_NEGADO");
        }

        // Passo 3 — regra temporal (D-AGD-03). A forma do intervalo já foi
        // validada no DTO; aqui só o passado é decidido, contra o relógio do
        // servidor no instante da transação.
        this.#exigirFuturo(dados.inicio);

        // Passos 4..7 — elegibilidade.
        await this.#exigirPacienteElegivel(tx, dados.pacienteId);
        await this.#exigirProfissionalElegivel(tx, dados.profissionalId);
        await this.#exigirServicoElegivel(tx, dados.servicoId);
        await this.#exigirServicoHabilitado(tx, dados.profissionalId, dados.servicoId);

        // Passos 8..10 — RN-014 (clínica e profissional) e bloqueio.
        await this.#exigirIntervaloOperavel(tx, dados.profissionalId, dados);

        // Passo 11 — gravação; as exclusion constraints decidem o conflito.
        const criado = await tx.agendamento.create({
          data: {
            pacienteId: dados.pacienteId,
            profissionalId: dados.profissionalId,
            servicoId: dados.servicoId,
            inicio: dados.inicio,
            fim: dados.fim,
            estado: "AGENDADO",
            modalidade: "AVULSO",
            criadoPorUsuarioId: comando.atorUsuarioId,
          },
          select: { id: true },
        });

        const ocorridoEm = new Date();
        await this.#registrarHistorico(tx, {
          correlacaoId,
          agendamentoId: criado.id,
          operacao: "CRIADO",
          atorUsuarioId: comando.atorUsuarioId,
          ocorridoEm,
          estadoAnterior: null,
          estadoNovo: "AGENDADO",
          inicioAnterior: null,
          fimAnterior: null,
          inicioNovo: dados.inicio,
          fimNovo: dados.fim,
          motivoCancelamentoId: null,
        });
        await this.#auditar(tx, {
          acao: "agendamento.criado",
          agendamentoId: criado.id,
          atorUsuarioId: comando.atorUsuarioId,
          ocorridoEm,
          correlacaoId,
        });

        return this.#exigirProjecao(tx, criado.id);
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Confirmação (D-AGD-02, D-AGD-09, D-AGD-10)
  // -------------------------------------------------------------------------

  async confirmar(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
  }): Promise<ResultadoMutacaoAgendamento> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      const { escopo } = await this.#abrirMutacao(tx, comando);
      const atual = await this.#lerSobLock(tx, comando.agendamentoId, escopo);

      const desfecho = avaliarConfirmacao(atual.estado);
      if (desfecho === "INVALIDA") throw new ErroAgendamento("TRANSICAO_INVALIDA");
      if (desfecho === "NO_OP") {
        // `200` sem histórico e sem auditoria (precedente `D-CFG-06`).
        return {
          agendamento: await this.#exigirProjecao(tx, atual.id),
          mutacaoExecutada: false,
        };
      }

      await tx.$executeRaw`
        UPDATE agendamento SET estado = 'CONFIRMADO' WHERE id = ${atual.id}::uuid
      `;
      await this.#registrarHistorico(tx, {
        correlacaoId,
        agendamentoId: atual.id,
        operacao: "CONFIRMADO",
        atorUsuarioId: comando.atorUsuarioId,
        ocorridoEm: new Date(),
        estadoAnterior: atual.estado,
        estadoNovo: "CONFIRMADO",
        inicioAnterior: null,
        fimAnterior: null,
        inicioNovo: null,
        fimNovo: null,
        motivoCancelamentoId: null,
      });
      // SEM auditoria: `agendamento.confirmado` NÃO pertence ao catálogo
      // homologado (`docs/09` §13.2; D-AGD-10). A confirmação fica só no
      // histórico.

      return { agendamento: await this.#exigirProjecao(tx, atual.id), mutacaoExecutada: true };
    });
  }

  // -------------------------------------------------------------------------
  // Remarcação (D-AGD-06)
  // -------------------------------------------------------------------------

  async remarcar(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
    intervalo: IntervaloValidado;
  }): Promise<ResultadoMutacaoAgendamento> {
    const correlacaoId = randomUUID();
    const { intervalo } = comando;

    return comConflitoTraduzido(
      this.database.transacao(async (tx) => {
        const { escopo } = await this.#abrirMutacao(tx, comando);
        const atual = await this.#lerSobLock(tx, comando.agendamentoId, escopo);

        if (!permiteRemarcacao(atual.estado)) throw new ErroAgendamento("TRANSICAO_INVALIDA");

        // Mesmo intervalo -> `200` no-op, sem histórico e sem auditoria. Vem
        // DEPOIS da checagem de estado: remarcar um terminal para o próprio
        // intervalo continua sendo transição inválida, não no-op.
        if (
          atual.inicio.getTime() === intervalo.inicio.getTime() &&
          atual.fim.getTime() === intervalo.fim.getTime()
        ) {
          return {
            agendamento: await this.#exigirProjecao(tx, atual.id),
            mutacaoExecutada: false,
          };
        }

        // Revalidação de D-AGD-04 itens 3 e 5..11 contra a grade, a
        // disponibilidade e o fuso VIGENTES (RN-016, D-CFG-63). O item 4
        // (paciente) NÃO é revalidado — a decisão enumera 3 e 5..11.
        this.#exigirFuturo(intervalo.inicio);
        await this.#exigirProfissionalElegivel(tx, atual.profissional_id);
        await this.#exigirServicoElegivel(tx, atual.servico_id);
        await this.#exigirServicoHabilitado(tx, atual.profissional_id, atual.servico_id);
        await this.#exigirIntervaloOperavel(tx, atual.profissional_id, intervalo);

        const estadoNovo = estadoAposRemarcacao(atual.estado);
        // O `UPDATE` reavalia as exclusion constraints já EXCLUINDO a própria
        // linha — nenhum filtro adicional é necessário (D-AGD-06).
        await tx.$executeRaw`
          UPDATE agendamento
             SET inicio = ${intervalo.inicio},
                 fim = ${intervalo.fim},
                 estado = ${estadoNovo}::estado_agendamento
           WHERE id = ${atual.id}::uuid
        `;

        const ocorridoEm = new Date();
        await this.#registrarHistorico(tx, {
          correlacaoId,
          agendamentoId: atual.id,
          operacao: "REMARCADO",
          atorUsuarioId: comando.atorUsuarioId,
          ocorridoEm,
          estadoAnterior: atual.estado,
          estadoNovo,
          inicioAnterior: atual.inicio,
          fimAnterior: atual.fim,
          inicioNovo: intervalo.inicio,
          fimNovo: intervalo.fim,
          motivoCancelamentoId: null,
        });
        await this.#auditar(tx, {
          acao: "agendamento.remarcado",
          agendamentoId: atual.id,
          atorUsuarioId: comando.atorUsuarioId,
          ocorridoEm,
          correlacaoId,
        });

        return { agendamento: await this.#exigirProjecao(tx, atual.id), mutacaoExecutada: true };
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Check-in (AGD-B)
  // -------------------------------------------------------------------------

  async checkIn(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
  }): Promise<ResultadoMutacaoAgendamento> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const { escopo } = await this.#abrirMutacao(tx, comando, PERMISSAO_AGENDA_CHECKIN);
      const atual = await this.#lerSobLock(tx, comando.agendamentoId, escopo);
      if (!permiteCheckIn(atual.estado)) throw new ErroAgendamento("TRANSICAO_INVALIDA");

      const agora = new Date();
      const fusoHorario = await this.#exigirFusoHorarioClinica(tx);
      if (!checkInNaJanelaTemporal(atual.inicio, agora, fusoHorario)) {
        throw new ErroAgendamento("FORA_DA_JANELA_TEMPORAL");
      }

      const estadoNovo = estadoAposCheckIn();
      await tx.$executeRaw`
        UPDATE agendamento
           SET estado = ${estadoNovo}::estado_agendamento
         WHERE id = ${atual.id}::uuid
      `;
      await this.#registrarHistorico(tx, {
        correlacaoId,
        agendamentoId: atual.id,
        operacao: "CHECKIN",
        atorUsuarioId: comando.atorUsuarioId,
        ocorridoEm: agora,
        estadoAnterior: atual.estado,
        estadoNovo,
        inicioAnterior: null,
        fimAnterior: null,
        inicioNovo: null,
        fimNovo: null,
        motivoCancelamentoId: null,
      });
      return { agendamento: await this.#exigirProjecao(tx, atual.id), mutacaoExecutada: true };
    });
  }

  // -------------------------------------------------------------------------
  // Falta (AGD-B)
  // -------------------------------------------------------------------------

  async registrarFalta(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
  }): Promise<ResultadoMutacaoAgendamento> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const { escopo } = await this.#abrirMutacao(tx, comando, PERMISSAO_AGENDA_FALTA);
      const atual = await this.#lerSobLock(tx, comando.agendamentoId, escopo);
      if (!permiteFalta(atual.estado)) throw new ErroAgendamento("TRANSICAO_INVALIDA");

      const agora = new Date();
      if (!faltaNaJanelaTemporal(atual.inicio, agora)) {
        throw new ErroAgendamento("FORA_DA_JANELA_TEMPORAL");
      }

      const estadoNovo = estadoAposFalta();
      await tx.$executeRaw`
        UPDATE agendamento
           SET estado = ${estadoNovo}::estado_agendamento
         WHERE id = ${atual.id}::uuid
      `;
      await this.#registrarHistorico(tx, {
        correlacaoId,
        agendamentoId: atual.id,
        operacao: "FALTA",
        atorUsuarioId: comando.atorUsuarioId,
        ocorridoEm: agora,
        estadoAnterior: atual.estado,
        estadoNovo,
        inicioAnterior: null,
        fimAnterior: null,
        inicioNovo: null,
        fimNovo: null,
        motivoCancelamentoId: null,
      });
      return { agendamento: await this.#exigirProjecao(tx, atual.id), mutacaoExecutada: true };
    });
  }

  // -------------------------------------------------------------------------
  // Cancelamento (D-AGD-07)
  // -------------------------------------------------------------------------

  async cancelar(comando: {
    atorUsuarioId: string;
    agendamentoId: string;
    motivoCancelamentoId: string;
  }): Promise<ResultadoMutacaoAgendamento> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      const { escopo } = await this.#abrirMutacao(tx, comando);
      // Ordem de locks homologada (D-AGD-11): `agendamento` -> `motivo`.
      const atual = await this.#lerSobLock(tx, comando.agendamentoId, escopo);
      if (!permiteCancelamento(atual.estado)) throw new ErroAgendamento("TRANSICAO_INVALIDA");

      // `FOR SHARE` na linha do motivo (D-CFG-57): impede que ele seja
      // inativado entre a verificação e a gravação. Motivo inexistente,
      // inativo e catálogo sem motivo ativo algum recebem o MESMO código.
      const motivos = await tx.$queryRaw<Array<{ id: string; ativo: boolean }>>`
        SELECT id, ativo FROM motivo_cancelamento
         WHERE id = ${comando.motivoCancelamentoId}::uuid
           FOR SHARE
      `;
      const motivo = motivos[0];
      if (motivo === undefined || !motivo.ativo) {
        throw new ErroAgendamento("MOTIVO_CANCELAMENTO_INELEGIVEL");
      }

      await tx.$executeRaw`
        UPDATE agendamento
           SET estado = 'CANCELADO',
               motivo_cancelamento_id = ${motivo.id}::uuid,
               cancelado_em = now(),
               cancelado_por_usuario_id = ${comando.atorUsuarioId}::uuid
         WHERE id = ${atual.id}::uuid
      `;

      const ocorridoEm = new Date();
      await this.#registrarHistorico(tx, {
        correlacaoId,
        agendamentoId: atual.id,
        operacao: "CANCELADO",
        atorUsuarioId: comando.atorUsuarioId,
        ocorridoEm,
        estadoAnterior: atual.estado,
        estadoNovo: "CANCELADO",
        inicioAnterior: null,
        fimAnterior: null,
        inicioNovo: null,
        fimNovo: null,
        motivoCancelamentoId: motivo.id,
      });
      await this.#auditar(tx, {
        acao: "agendamento.cancelado",
        agendamentoId: atual.id,
        atorUsuarioId: comando.atorUsuarioId,
        ocorridoEm,
        correlacaoId,
      });

      return { agendamento: await this.#exigirProjecao(tx, atual.id), mutacaoExecutada: true };
    });
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  async #abrirMutacao(
    tx: TransacaoPersistencia,
    comando: { atorUsuarioId: string },
    permissaoExigida?: string,
  ): Promise<{ escopo: EscopoAgenda }> {
    return {
      escopo: await this.escopos.resolver(tx, comando.atorUsuarioId, permissaoExigida),
    };
  }

  async #exigirFusoHorarioClinica(tx: TransacaoPersistencia): Promise<string> {
    const clinicas = await tx.$queryRaw<Array<{ fuso_horario: string }>>`SELECT fuso_horario FROM clinica`;
    const clinica = clinicas[0];
    if (clinica === undefined) {
      throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
    }
    return clinica.fuso_horario;
  }

  /**
   * Lê a linha de controle sob `SELECT ... FOR UPDATE` (D-AGD-11) e aplica o
   * escopo. Inexistente e fora do escopo recebem o MESMO `404` — sem oráculo.
   */
  async #lerSobLock(
    tx: TransacaoPersistencia,
    agendamentoId: string,
    escopo: EscopoAgenda,
  ): Promise<LinhaControle> {
    const linhas = await tx.$queryRaw<LinhaControle[]>`
      SELECT id, estado::text AS estado, inicio, fim, profissional_id, servico_id
        FROM agendamento
       WHERE id = ${agendamentoId}::uuid
         FOR UPDATE
    `;
    const linha = linhas[0];
    if (linha === undefined || !escopoAlcanca(escopo, linha.profissional_id)) {
      throw new ErroAgendamento("AGENDAMENTO_NAO_ENCONTRADO");
    }
    return linha;
  }

  async #lerProjecao(
    tx: TransacaoPersistencia,
    agendamentoId: string,
  ): Promise<DadosAgendamento | null> {
    const linhas = await tx.$queryRaw<LinhaAgendamento[]>`
      SELECT a.id, a.inicio, a.fim, a.estado::text AS estado,
             a.modalidade::text AS modalidade, a.motivo_cancelamento_id, a.cancelado_em,
             pac.id AS paciente_id, pac.nome AS paciente_nome,
             pro.id AS profissional_id, pro.nome AS profissional_nome,
             srv.id AS servico_id, srv.nome AS servico_nome
        FROM agendamento a
        JOIN paciente pac ON pac.id = a.paciente_id
        JOIN profissional pro ON pro.id = a.profissional_id
        JOIN servico srv ON srv.id = a.servico_id
       WHERE a.id = ${agendamentoId}::uuid
    `;
    const linha = linhas[0];
    return linha === undefined ? null : mapear(linha);
  }

  async #exigirProjecao(
    tx: TransacaoPersistencia,
    agendamentoId: string,
  ): Promise<DadosAgendamento> {
    const agendamento = await this.#lerProjecao(tx, agendamentoId);
    if (agendamento === null) {
      // Inalcançável: a linha acabou de ser escrita ou lida sob lock nesta
      // mesma transação. Falha técnica, nunca `404`.
      throw new Error("Agendamento desapareceu dentro da própria transação.");
    }
    return agendamento;
  }

  /** D-AGD-03 — `inicio` não pode ser anterior ao instante do servidor. */
  #exigirFuturo(inicio: Date): void {
    if (inicio.getTime() < Date.now()) throw new ErroAgendamento("AGENDAMENTO_NO_PASSADO");
  }

  async #exigirPacienteElegivel(tx: TransacaoPersistencia, pacienteId: string): Promise<void> {
    const linhas = await tx.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT ativo FROM paciente WHERE id = ${pacienteId}::uuid
    `;
    if (linhas[0]?.ativo !== true) throw new ErroAgendamento("PACIENTE_INELEGIVEL");
  }

  async #exigirProfissionalElegivel(
    tx: TransacaoPersistencia,
    profissionalId: string,
  ): Promise<void> {
    const linhas = await tx.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT ativo FROM profissional WHERE id = ${profissionalId}::uuid
    `;
    if (linhas[0]?.ativo !== true) throw new ErroAgendamento("PROFISSIONAL_INELEGIVEL");
  }

  async #exigirServicoElegivel(tx: TransacaoPersistencia, servicoId: string): Promise<void> {
    const linhas = await tx.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT ativo FROM servico WHERE id = ${servicoId}::uuid
    `;
    if (linhas[0]?.ativo !== true) throw new ErroAgendamento("SERVICO_INELEGIVEL");
  }

  /** PRO-004: a EXISTÊNCIA da linha de `profissional_servico` é a habilitação. */
  async #exigirServicoHabilitado(
    tx: TransacaoPersistencia,
    profissionalId: string,
    servicoId: string,
  ): Promise<void> {
    const linhas = await tx.$queryRaw<Array<{ existe: number }>>`
      SELECT 1 AS existe
        FROM profissional_servico
       WHERE profissional_id = ${profissionalId}::uuid
         AND servico_id = ${servicoId}::uuid
    `;
    if (linhas.length === 0) throw new ErroAgendamento("SERVICO_NAO_HABILITADO");
  }

  /**
   * Passos 8..10 de D-AGD-04, na ordem homologada: grade da clínica,
   * disponibilidade do profissional e ausência de bloqueio. As duas primeiras
   * reutilizam os verificadores já entregues por CFG-002 e PRO-003 — nenhuma
   * regra é reimplementada aqui.
   */
  async #exigirIntervaloOperavel(
    tx: TransacaoPersistencia,
    profissionalId: string,
    intervalo: IntervaloValidado,
  ): Promise<void> {
    await this.horario.exigirConforme(tx, intervalo);
    await this.disponibilidade.exigirDisponivel(tx, profissionalId, intervalo);

    // RN-015.2 — sobreposição com bloqueio, meio aberto `[inicio, fim)`: uma
    // borda coincidente NÃO é conflito, exatamente como nas exclusion
    // constraints da agenda.
    const bloqueios = await tx.$queryRaw<Array<{ existe: number }>>`
      SELECT 1 AS existe
        FROM bloqueio_agenda
       WHERE profissional_id = ${profissionalId}::uuid
         AND tstzrange(inicio, fim, '[)')
             && tstzrange(${intervalo.inicio}::timestamptz, ${intervalo.fim}::timestamptz, '[)')
       LIMIT 1
    `;
    if (bloqueios.length > 0) throw new ErroAgendamento("CONFLITO_BLOQUEIO");
  }

  /** UMA linha por mutação efetiva, na mesma transação (D-AGD-09). */
  async #registrarHistorico(
    tx: TransacaoPersistencia,
    linha: {
      correlacaoId: string;
      agendamentoId: string;
      operacao: OperacaoHistorico;
      atorUsuarioId: string;
      ocorridoEm: Date;
      estadoAnterior: EstadoAgendamento | null;
      estadoNovo: EstadoAgendamento | null;
      inicioAnterior: Date | null;
      fimAnterior: Date | null;
      inicioNovo: Date | null;
      fimNovo: Date | null;
      motivoCancelamentoId: string | null;
    },
  ): Promise<void> {
    await tx.historicoAgendamento.create({
      data: {
        // O id É o `correlacao_id` da operação — ver nota de cabeçalho.
        id: linha.correlacaoId,
        agendamentoId: linha.agendamentoId,
        operacao: linha.operacao,
        estadoAnterior: linha.estadoAnterior,
        estadoNovo: linha.estadoNovo,
        inicioAnterior: linha.inicioAnterior,
        fimAnterior: linha.fimAnterior,
        inicioNovo: linha.inicioNovo,
        fimNovo: linha.fimNovo,
        atorUsuarioId: linha.atorUsuarioId,
        ocorridoEm: linha.ocorridoEm,
        motivoCancelamentoId: linha.motivoCancelamentoId,
      },
    });
  }

  /** UM evento por mutação auditável, `contexto` VAZIO, mesma transação (D-AGD-10). */
  async #auditar(
    tx: TransacaoPersistencia,
    evento: {
      acao: "agendamento.criado" | "agendamento.remarcado" | "agendamento.cancelado";
      agendamentoId: string;
      atorUsuarioId: string;
      ocorridoEm: Date;
      correlacaoId: string;
    },
  ): Promise<void> {
    await this.auditWriter.registrar(tx, {
      acao: evento.acao,
      ocorridoEm: evento.ocorridoEm,
      atorUsuarioId: evento.atorUsuarioId,
      alvoTipo: ALVO_AGENDAMENTO,
      alvoId: evento.agendamentoId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId: evento.correlacaoId,
      contexto: {},
    });
  }
}
