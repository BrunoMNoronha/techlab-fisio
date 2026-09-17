// TechLab Fisio — serviço do catálogo de serviços (CFG-003; `docs/14` §3.11).
//
// Materializa:
//   - D-CFG-22: unicidade FÍSICA `ux_servico_clinica_nome`; o 23505 DAQUELE
//     índice vira SERVICO_DUPLICADO — qualquer outra violação segue como falha
//     não controlada (fail closed);
//   - D-CFG-24: `clinica_id` resolvido no servidor pela linha única; nenhum
//     caminho de exclusão;
//   - D-CFG-25/26: criação sempre ativa; situação só pela operação própria;
//     inativação grava `inativado_em = now()`, reativação o anula;
//   - D-CFG-27: preço lido do banco como `::text` (numeric(12,2) já canônico),
//     comparado como string canônica — nenhum float participa;
//   - D-CFG-28: ordem `ativo DESC, lower(nome), id`;
//   - D-CFG-29: `SELECT ... FOR UPDATE` na linha do serviço; no-op decidido
//     SOB o lock; última escrita válida prevalece;
//   - D-CFG-31: edição permitida em serviço inativo, sem mudar a situação;
//   - D-CFG-32: toda mutação efetiva emite `configuracao.alterada`, alvo
//     `servico`, contexto VAZIO, na MESMA transação (rollback conjunto);
//     no-op não emite.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { identificarViolacao, type TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import type { DadosServicoValidados } from "./servicos.dto.js";

const ALVO_SERVICO = "servico";

/** Índice único de D-CFG-22 (migration `20260917120000_servico_catalogo_invariantes`). */
export const INDICE_NOME_SERVICO = "ux_servico_clinica_nome";

export type MotivoRejeicaoServico =
  | "CLINICA_NAO_CONFIGURADA"
  | "SERVICO_NAO_ENCONTRADO"
  | "SERVICO_DUPLICADO";

export class ErroServico extends Error {
  override readonly name = "ErroServico";

  constructor(readonly motivo: MotivoRejeicaoServico) {
    super(`Operação do catálogo de serviços rejeitada: ${motivo}.`);
  }
}

export interface DadosServico extends DadosServicoValidados {
  readonly id: string;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
}

export interface ResultadoMutacaoServico {
  readonly servico: DadosServico;
  readonly mutacaoExecutada: boolean;
}

interface LinhaServico {
  id: string;
  nome: string;
  duracao_min: number;
  preco_referencia: string;
  ativo: boolean;
  inativado_em: Date | null;
}

function mapear(linha: LinhaServico): DadosServico {
  return {
    id: linha.id,
    nome: linha.nome,
    duracaoMin: linha.duracao_min,
    precoReferencia: linha.preco_referencia,
    ativo: linha.ativo,
    inativadoEm: linha.inativado_em,
  };
}

/** `true` sse o erro é a violação do índice único de nome — e de nenhuma outra restrição. */
export function ehNomeDuplicado(erro: unknown): boolean {
  const violacao = identificarViolacao(erro);
  return violacao !== null && violacao.classe === "UNIQUE" && violacao.constraint === INDICE_NOME_SERVICO;
}

async function traduzirDuplicidade<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehNomeDuplicado(erro)) throw new ErroServico("SERVICO_DUPLICADO");
    throw erro;
  }
}

@Injectable()
export class ServicosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async listar(ativo: boolean | null): Promise<DadosServico[]> {
    return this.database.transacao(async (tx) => {
      const linhas =
        ativo === null
          ? await tx.$queryRaw<LinhaServico[]>`
              SELECT id, nome, duracao_min, preco_referencia::text AS preco_referencia, ativo, inativado_em
                FROM servico
               ORDER BY ativo DESC, lower(nome), id`
          : await tx.$queryRaw<LinhaServico[]>`
              SELECT id, nome, duracao_min, preco_referencia::text AS preco_referencia, ativo, inativado_em
                FROM servico
               WHERE ativo = ${ativo}
               ORDER BY ativo DESC, lower(nome), id`;
      return linhas.map(mapear);
    });
  }

  async consultar(servicoId: string): Promise<DadosServico> {
    return this.database.transacao(async (tx) => mapear(await this.#ler(tx, servicoId, false)));
  }

  async criar(comando: { atorUsuarioId: string; dados: DadosServicoValidados }): Promise<DadosServico> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const clinicas = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clinica`;
        if (clinicas.length === 0) throw new ErroServico("CLINICA_NAO_CONFIGURADA");
        if (clinicas.length > 1) {
          throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
        }
        const clinicaId = (clinicas[0] as { id: string }).id;

        const { dados } = comando;
        const criado = await tx.servico.create({
          data: {
            clinicaId,
            nome: dados.nome,
            duracaoMin: dados.duracaoMin,
            precoReferencia: dados.precoReferencia,
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
    servicoId: string;
    dados: DadosServicoValidados;
  }): Promise<ResultadoMutacaoServico> {
    const correlacaoId = randomUUID();
    return traduzirDuplicidade(
      this.database.transacao(async (tx) => {
        const atual = mapear(await this.#ler(tx, comando.servicoId, true));
        const { dados } = comando;

        if (
          atual.nome === dados.nome &&
          atual.duracaoMin === dados.duracaoMin &&
          atual.precoReferencia === dados.precoReferencia
        ) {
          return { servico: atual, mutacaoExecutada: false };
        }

        await tx.$executeRaw`
          UPDATE servico
             SET nome             = ${dados.nome},
                 duracao_min      = ${dados.duracaoMin},
                 preco_referencia = ${dados.precoReferencia}::numeric(12,2)
           WHERE id = ${atual.id}::uuid
        `;
        await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
        return { servico: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
      }),
    );
  }

  async alterarSituacao(comando: {
    atorUsuarioId: string;
    servicoId: string;
    ativo: boolean;
  }): Promise<ResultadoMutacaoServico> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const atual = mapear(await this.#ler(tx, comando.servicoId, true));
      if (atual.ativo === comando.ativo) {
        return { servico: atual, mutacaoExecutada: false };
      }

      if (comando.ativo) {
        await tx.$executeRaw`UPDATE servico SET ativo = true, inativado_em = NULL WHERE id = ${atual.id}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE servico SET ativo = false, inativado_em = now() WHERE id = ${atual.id}::uuid`;
      }
      await this.#auditar(tx, comando.atorUsuarioId, atual.id, correlacaoId);
      return { servico: mapear(await this.#ler(tx, atual.id, false)), mutacaoExecutada: true };
    });
  }

  async #ler(tx: TransacaoPersistencia, servicoId: string, bloquear: boolean): Promise<LinhaServico> {
    const linhas = bloquear
      ? await tx.$queryRaw<LinhaServico[]>`
          SELECT id, nome, duracao_min, preco_referencia::text AS preco_referencia, ativo, inativado_em
            FROM servico
           WHERE id = ${servicoId}::uuid
             FOR UPDATE`
      : await tx.$queryRaw<LinhaServico[]>`
          SELECT id, nome, duracao_min, preco_referencia::text AS preco_referencia, ativo, inativado_em
            FROM servico
           WHERE id = ${servicoId}::uuid`;
    const linha = linhas[0];
    if (linha === undefined) throw new ErroServico("SERVICO_NAO_ENCONTRADO");
    return linha;
  }

  async #auditar(
    tx: TransacaoPersistencia,
    atorUsuarioId: string,
    servicoId: string,
    correlacaoId: string,
  ): Promise<void> {
    await this.auditWriter.registrar(tx, {
      acao: "configuracao.alterada",
      ocorridoEm: new Date(),
      atorUsuarioId,
      alvoTipo: ALVO_SERVICO,
      alvoId: servicoId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId,
    });
  }
}
