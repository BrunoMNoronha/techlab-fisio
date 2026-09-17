// TechLab Fisio — serviço das formas de pagamento (CFG-004; `docs/14` §3.12).
//
// Materializa:
//   - D-CFG-34: unicidade FÍSICA `ux_forma_pagamento_clinica_descricao`; o
//     23505 DAQUELE índice vira FORMA_PAGAMENTO_DUPLICADA — qualquer outra
//     violação segue como falha não controlada (fail closed); nenhuma
//     comparação de caixa em JavaScript;
//   - D-CFG-36: `clinica_id` resolvido no servidor pela linha única; nenhum
//     caminho de exclusão;
//   - D-CFG-37: criação sempre ativa; situação só pela operação própria;
//     inativação grava `inativado_em = now()`, reativação o anula; nunca
//     altera `pagamento`;
//   - D-CFG-40: PUT sobre forma referenciada por qualquer `pagamento` →
//     FORMA_PAGAMENTO_EM_USO; a comparação de no-op PRECEDE a verificação de
//     uso; ambas SOB o lock;
//   - D-CFG-41: `SELECT ... FOR UPDATE` na linha da forma; última escrita
//     válida prevalece;
//   - D-CFG-42: ordem `ativo DESC, lower(descricao), id`;
//   - D-CFG-44: toda mutação efetiva emite `configuracao.alterada`, alvo
//     `forma_pagamento`, contexto VAZIO, na MESMA transação (rollback
//     conjunto); no-op, 409 e consultas não emitem.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { identificarViolacao, type TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import type { DadosFormaPagamentoValidados } from "./formas-pagamento.dto.js";

const ALVO_FORMA_PAGAMENTO = "forma_pagamento";

/** Índice único de D-CFG-34 (migration `20260917170000_forma_pagamento_invariantes`). */
export const INDICE_DESCRICAO_FORMA_PAGAMENTO = "ux_forma_pagamento_clinica_descricao";

export type MotivoRejeicaoFormaPagamento =
  | "CLINICA_NAO_CONFIGURADA"
  | "FORMA_PAGAMENTO_NAO_ENCONTRADA"
  | "FORMA_PAGAMENTO_DUPLICADA"
  | "FORMA_PAGAMENTO_EM_USO";

export class ErroFormaPagamento extends Error {
  override readonly name = "ErroFormaPagamento";

  constructor(readonly motivo: MotivoRejeicaoFormaPagamento) {
    super(`Operação de forma de pagamento rejeitada: ${motivo}.`);
  }
}

export interface DadosFormaPagamento extends DadosFormaPagamentoValidados {
  readonly id: string;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
}

export interface ResultadoMutacaoFormaPagamento {
  readonly formaPagamento: DadosFormaPagamento;
  readonly mutacaoExecutada: boolean;
}

interface LinhaFormaPagamento {
  id: string;
  descricao: string;
  ativo: boolean;
  inativado_em: Date | null;
}

function mapear(linha: LinhaFormaPagamento): DadosFormaPagamento {
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
    violacao.constraint === INDICE_DESCRICAO_FORMA_PAGAMENTO
  );
}

async function traduzirDuplicidade<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehDescricaoDuplicada(erro)) throw new ErroFormaPagamento("FORMA_PAGAMENTO_DUPLICADA");
    throw erro;
  }
}

@Injectable()
export class FormasPagamentoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async listar(ativo: boolean | null): Promise<DadosFormaPagamento[]> {
    return this.database.transacao(async (tx) => {
      const linhas =
        ativo === null
          ? await tx.$queryRaw<LinhaFormaPagamento[]>`
              SELECT id, descricao, ativo, inativado_em
                FROM forma_pagamento
               ORDER BY ativo DESC, lower(descricao), id`
          : await tx.$queryRaw<LinhaFormaPagamento[]>`
              SELECT id, descricao, ativo, inativado_em
                FROM forma_pagamento
               WHERE ativo = ${ativo}
               ORDER BY ativo DESC, lower(descricao), id`;
      return linhas.map(mapear);
    });
  }

  async consultar(formaPagamentoId: string): Promise<DadosFormaPagamento> {
    return this.database.transacao(async (tx) => mapear(await this.#ler(tx, formaPagamentoId, false)));
  }

  async criar(comando: {
    atorUsuarioId: string;
    dados: DadosFormaPagamentoValidados;
  }): Promise<DadosFormaPagamento> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const clinicas = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clinica`;
        if (clinicas.length === 0) throw new ErroFormaPagamento("CLINICA_NAO_CONFIGURADA");
        if (clinicas.length > 1) {
          throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
        }
        const clinicaId = (clinicas[0] as { id: string }).id;

        const criada = await tx.formaPagamento.create({
          data: {
            clinicaId,
            descricao: comando.dados.descricao,
            ativo: true,
            inativadoEm: null,
          },
          select: { id: true },
        });

        await this.#auditar(tx, comando.atorUsuarioId, criada.id, correlacaoId);
        return mapear(await this.#ler(tx, criada.id, false));
      }),
    );
  }

  async atualizar(comando: {
    atorUsuarioId: string;
    formaPagamentoId: string;
    dados: DadosFormaPagamentoValidados;
  }): Promise<ResultadoMutacaoFormaPagamento> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const atual = mapear(await this.#ler(tx, comando.formaPagamentoId, true));

        // D-CFG-40: o no-op precede a verificação de uso.
        if (atual.descricao === comando.dados.descricao) {
          return { formaPagamento: atual, mutacaoExecutada: false };
        }

        const usos = await tx.$queryRaw<Array<{ existe: number }>>`
          SELECT 1 AS existe
            FROM pagamento
           WHERE forma_pagamento_id = ${atual.id}::uuid
           LIMIT 1`;
        if (usos.length > 0) throw new ErroFormaPagamento("FORMA_PAGAMENTO_EM_USO");

        await tx.$executeRaw`
          UPDATE forma_pagamento
             SET descricao = ${comando.dados.descricao}
           WHERE id = ${atual.id}::uuid
        `;
        await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
        return { formaPagamento: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
      }),
    );
  }

  async alterarSituacao(comando: {
    atorUsuarioId: string;
    formaPagamentoId: string;
    ativo: boolean;
  }): Promise<ResultadoMutacaoFormaPagamento> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const atual = mapear(await this.#ler(tx, comando.formaPagamentoId, true));
      if (atual.ativo === comando.ativo) {
        return { formaPagamento: atual, mutacaoExecutada: false };
      }

      if (comando.ativo) {
        await tx.$executeRaw`UPDATE forma_pagamento SET ativo = true, inativado_em = NULL WHERE id = ${atual.id}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE forma_pagamento SET ativo = false, inativado_em = now() WHERE id = ${atual.id}::uuid`;
      }
      await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
      return { formaPagamento: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
    });
  }

  async #ler(
    tx: TransacaoPersistencia,
    formaPagamentoId: string,
    bloquear: boolean,
  ): Promise<LinhaFormaPagamento> {
    const linhas = bloquear
      ? await tx.$queryRaw<LinhaFormaPagamento[]>`
          SELECT id, descricao, ativo, inativado_em
            FROM forma_pagamento
           WHERE id = ${formaPagamentoId}::uuid
             FOR UPDATE`
      : await tx.$queryRaw<LinhaFormaPagamento[]>`
          SELECT id, descricao, ativo, inativado_em
            FROM forma_pagamento
           WHERE id = ${formaPagamentoId}::uuid`;
    const linha = linhas[0];
    if (linha === undefined) throw new ErroFormaPagamento("FORMA_PAGAMENTO_NAO_ENCONTRADA");
    return linha;
  }

  async #auditar(
    tx: TransacaoPersistencia,
    atorUsuarioId: string,
    formaPagamentoId: string,
    correlacaoId: string,
  ): Promise<void> {
    await this.auditWriter.registrar(tx, {
      acao: "configuracao.alterada",
      ocorridoEm: new Date(),
      atorUsuarioId,
      alvoTipo: ALVO_FORMA_PAGAMENTO,
      alvoId: formaPagamentoId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId,
    });
  }
}
