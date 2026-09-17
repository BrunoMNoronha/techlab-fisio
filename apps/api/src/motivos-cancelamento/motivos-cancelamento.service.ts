// TechLab Fisio — serviço dos motivos de cancelamento (CFG-005; `docs/14` §3.13).
//
// Materializa:
//   - D-CFG-46: unicidade FÍSICA `ux_motivo_cancelamento_clinica_descricao`;
//     o 23505 DAQUELE índice vira MOTIVO_CANCELAMENTO_DUPLICADO — qualquer outra
//     violação segue como falha não controlada (fail closed); nenhuma
//     comparação de caixa em JavaScript;
//   - D-CFG-48: `clinica_id` resolvido no servidor pela linha única; nenhum
//     caminho de exclusão;
//   - D-CFG-49: criação sempre ativa; situação só pela operação própria;
//     inativação grava `inativado_em = now()`, reativação o anula;
//   - D-CFG-50: `PUT` sobre motivo referenciado por `agendamento` OU
//     `historico_agendamento` → MOTIVO_CANCELAMENTO_EM_USO; o no-op precede a
//     verificação de uso; ambos sob o lock;
//   - D-CFG-53: `SELECT ... FOR UPDATE` na linha do motivo; última escrita
//     válida prevalece;
//   - D-CFG-54: ordem `ativo DESC, lower(descricao), id`; nunca altera
//     `agendamento` nem `historico_agendamento`;
//   - D-CFG-56: toda mutação efetiva emite `configuracao.alterada`, alvo
//     `motivo_cancelamento`, contexto VAZIO, na MESMA transação (rollback
//     conjunto); no-op não emite.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { identificarViolacao, type TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import type { DadosMotivoCancelamentoValidados } from "./motivos-cancelamento.dto.js";

const ALVO_MOTIVO_CANCELAMENTO = "motivo_cancelamento";

/** Índice único de D-CFG-46 (migration `20260917180000_motivo_cancelamento_invariantes`). */
export const INDICE_DESCRICAO_MOTIVO_CANCELAMENTO = "ux_motivo_cancelamento_clinica_descricao";

export type MotivoRejeicaoMotivoCancelamento =
  | "CLINICA_NAO_CONFIGURADA"
  | "MOTIVO_CANCELAMENTO_NAO_ENCONTRADO"
  | "MOTIVO_CANCELAMENTO_DUPLICADO"
  | "MOTIVO_CANCELAMENTO_EM_USO";

export class ErroMotivoCancelamento extends Error {
  override readonly name = "ErroMotivoCancelamento";

  constructor(readonly motivo: MotivoRejeicaoMotivoCancelamento) {
    super(`Operação dos motivos de cancelamento rejeitada: ${motivo}.`);
  }
}

export interface DadosMotivoCancelamento extends DadosMotivoCancelamentoValidados {
  readonly id: string;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
}

export interface ResultadoMutacaoMotivoCancelamento {
  readonly motivoCancelamento: DadosMotivoCancelamento;
  readonly mutacaoExecutada: boolean;
}

interface LinhaMotivoCancelamento {
  id: string;
  descricao: string;
  ativo: boolean;
  inativado_em: Date | null;
}

function mapear(linha: LinhaMotivoCancelamento): DadosMotivoCancelamento {
  return {
    id: linha.id,
    descricao: linha.descricao,
    ativo: linha.ativo,
    inativadoEm: linha.inativado_em,
  };
}

/** `true` sse o erro é a violação do índice único de descrição — e de nenhuma outra restrição. */
export function ehDescricaoDuplicada(erro: unknown): boolean {
  const violacao = identificarViolacao(erro);
  return (
    violacao !== null &&
    violacao.classe === "UNIQUE" &&
    violacao.constraint === INDICE_DESCRICAO_MOTIVO_CANCELAMENTO
  );
}

async function traduzirDuplicidade<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehDescricaoDuplicada(erro)) throw new ErroMotivoCancelamento("MOTIVO_CANCELAMENTO_DUPLICADO");
    throw erro;
  }
}

@Injectable()
export class MotivosCancelamentoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async listar(ativo: boolean | null): Promise<DadosMotivoCancelamento[]> {
    return this.database.transacao(async (tx) => {
      const linhas =
        ativo === null
          ? await tx.$queryRaw<LinhaMotivoCancelamento[]>`
              SELECT id, descricao, ativo, inativado_em
                FROM motivo_cancelamento
               ORDER BY ativo DESC, lower(descricao), id`
          : await tx.$queryRaw<LinhaMotivoCancelamento[]>`
              SELECT id, descricao, ativo, inativado_em
                FROM motivo_cancelamento
               WHERE ativo = ${ativo}
               ORDER BY ativo DESC, lower(descricao), id`;
      return linhas.map(mapear);
    });
  }

  async consultar(motivoCancelamentoId: string): Promise<DadosMotivoCancelamento> {
    return this.database.transacao(async (tx) => mapear(await this.#ler(tx, motivoCancelamentoId, false)));
  }

  async criar(comando: {
    atorUsuarioId: string;
    dados: DadosMotivoCancelamentoValidados;
  }): Promise<DadosMotivoCancelamento> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const clinicas = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clinica`;
        if (clinicas.length === 0) throw new ErroMotivoCancelamento("CLINICA_NAO_CONFIGURADA");
        if (clinicas.length > 1) {
          throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
        }
        const clinicaId = (clinicas[0] as { id: string }).id;

        const criado = await tx.motivoCancelamento.create({
          data: {
            clinicaId,
            descricao: comando.dados.descricao,
            ativo: true,
            inativadoEm: null,
          },
          select: { id: true },
        });

        await this.#auditar(tx, comando.atorUsuarioId, criado.id, correlacaoId);
        return mapear(await this.#ler(tx, criado.id, false));
      }),
    );
  }

  async atualizar(comando: {
    atorUsuarioId: string;
    motivoCancelamentoId: string;
    dados: DadosMotivoCancelamentoValidados;
  }): Promise<ResultadoMutacaoMotivoCancelamento> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const atual = mapear(await this.#ler(tx, comando.motivoCancelamentoId, true));

        if (atual.descricao === comando.dados.descricao) {
          return { motivoCancelamento: atual, mutacaoExecutada: false };
        }

        const uso = await tx.$queryRaw<Array<{ em_uso: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM agendamento WHERE motivo_cancelamento_id = ${atual.id}::uuid)
              OR EXISTS (SELECT 1 FROM historico_agendamento WHERE motivo_cancelamento_id = ${atual.id}::uuid)
                 AS em_uso`;
        if (uso[0]?.em_uso === true) throw new ErroMotivoCancelamento("MOTIVO_CANCELAMENTO_EM_USO");

        await tx.$executeRaw`
          UPDATE motivo_cancelamento
             SET descricao = ${comando.dados.descricao}
           WHERE id = ${atual.id}::uuid
        `;
        await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
        return { motivoCancelamento: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
      }),
    );
  }

  async alterarSituacao(comando: {
    atorUsuarioId: string;
    motivoCancelamentoId: string;
    ativo: boolean;
  }): Promise<ResultadoMutacaoMotivoCancelamento> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const atual = mapear(await this.#ler(tx, comando.motivoCancelamentoId, true));
      if (atual.ativo === comando.ativo) {
        return { motivoCancelamento: atual, mutacaoExecutada: false };
      }

      if (comando.ativo) {
        await tx.$executeRaw`UPDATE motivo_cancelamento SET ativo = true, inativado_em = NULL WHERE id = ${atual.id}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE motivo_cancelamento SET ativo = false, inativado_em = now() WHERE id = ${atual.id}::uuid`;
      }
      await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
      return { motivoCancelamento: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
    });
  }

  async #ler(
    tx: TransacaoPersistencia,
    motivoCancelamentoId: string,
    bloquear: boolean,
  ): Promise<LinhaMotivoCancelamento> {
    const linhas = bloquear
      ? await tx.$queryRaw<LinhaMotivoCancelamento[]>`
          SELECT id, descricao, ativo, inativado_em
            FROM motivo_cancelamento
           WHERE id = ${motivoCancelamentoId}::uuid
             FOR UPDATE`
      : await tx.$queryRaw<LinhaMotivoCancelamento[]>`
          SELECT id, descricao, ativo, inativado_em
            FROM motivo_cancelamento
           WHERE id = ${motivoCancelamentoId}::uuid`;
    const linha = linhas[0];
    if (linha === undefined) throw new ErroMotivoCancelamento("MOTIVO_CANCELAMENTO_NAO_ENCONTRADO");
    return linha;
  }

  async #auditar(
    tx: TransacaoPersistencia,
    atorUsuarioId: string,
    motivoCancelamentoId: string,
    correlacaoId: string,
  ): Promise<void> {
    await this.auditWriter.registrar(tx, {
      acao: "configuracao.alterada",
      ocorridoEm: new Date(),
      atorUsuarioId,
      alvoTipo: ALVO_MOTIVO_CANCELAMENTO,
      alvoId: motivoCancelamentoId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId,
    });
  }
}
