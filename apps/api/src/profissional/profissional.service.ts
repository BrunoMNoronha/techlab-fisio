// TechLab Fisio — fluxo interno `profissional.situacao.alterada`
// (Etapa 2.3B; PRO-005, D-AUD-01 docs/09 §12.2, D-1 da autorização da 2.3B).
//
// EXPOSIÇÃO HTTP (fatia PRO-A, `docs/18` D-PRO1-06): a operação é exposta por
// `PATCH /profissionais/:profissionalId/situacao`, sob
// `@RequerPermissao("profissionais.gerenciar")` — a autorização vive no
// controller. A validação de ator EXISTENTE e ATIVO permanece como
// INTEGRIDADE da operação (o evento precisa de ator real e válido — RN-061),
// nunca como autorização.
//
// PROPRIEDADE TRANSACIONAL (obrigatória): mutação de negócio + evento de
// auditoria = UMA única transação. Falha da auditoria → rollback da mutação;
// falha da mutação → zero evento. O cliente transacional é passado
// explicitamente ao AuditWriter.
//
// CONCORRÊNCIA (D-PRO1-10): a linha do profissional é lida com
// `SELECT ... FOR UPDATE` ANTES de decidir — a mesma serialização do cadastro
// (`PUT`, `PUT .../servicos`). O no-op (D-PRO1-06: 200 sem mutação e sem
// evento) é decidido SOB o lock, sobre o estado commitado. Só a mutação
// condicional não bastava: sob READ COMMITTED, um `UPDATE ... WHERE ativo = X`
// cuja linha não casa com o snapshot NÃO espera o lock de uma transição
// oposta ainda não commitada — devolvia no-op sobre o estado antigo e a
// transição concorrente sobrescrevia a pedida em seguida (revisão da PR #86).
// A mutação permanece condicional como defesa adicional.
//
// AUDITORIA (whitelist VAZIA — D-AUD-07): nenhum contexto é persistido —
// nem `ativo_anterior`/`ativo_novo`/`campos_alterados` (chaves apenas
// propostas, não homologadas). `justificativa` = NULL (a fonte não a exige).
// `correlacao_id` é gerado UMA vez por operação.

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import { lerLinhaProfissional, mapearProfissional, type DadosProfissional } from "./profissional.leitura.js";

export type MotivoRejeicaoSituacaoProfissional =
  | "PROFISSIONAL_INEXISTENTE"
  | "ATOR_INEXISTENTE"
  | "ATOR_INATIVO";

export class ErroSituacaoProfissional extends Error {
  override readonly name = "ErroSituacaoProfissional";

  constructor(readonly motivo: MotivoRejeicaoSituacaoProfissional) {
    // Mensagem estável e sem dados além do motivo (nenhum valor ecoado).
    super(`Alteração de situação de profissional rejeitada: ${motivo}.`);
  }
}

export interface ComandoAlterarSituacaoProfissional {
  readonly profissionalId: string;
  /** Ator da operação — validado como EXISTENTE e ATIVO (integridade). */
  readonly atorUsuarioId: string;
  /** Nova situação desejada. */
  readonly ativo: boolean;
}

export interface ResultadoAlterarSituacaoProfissional {
  readonly profissionalId: string;
  readonly ativo: boolean;
  /** Estado vigente completo após a operação (inclusive no no-op). */
  readonly profissional: DadosProfissional;
  /** `false` quando o estado pedido já era o vigente (D-PRO1-06). */
  readonly mutacaoExecutada: boolean;
  /** Correlação persistida no evento; `null` no no-op (nenhum evento). */
  readonly correlacaoId: string | null;
}

@Injectable()
export class ProfissionalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Ativação/inativação de profissional (PRO-005; exposta em D-PRO1-06),
   * atômica com seu evento de auditoria obrigatório.
   */
  async alterarSituacao(
    comando: ComandoAlterarSituacaoProfissional,
  ): Promise<ResultadoAlterarSituacaoProfissional> {
    // Uma correlação por OPERAÇÃO — não por tentativa de escrita interna.
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      // 1. Integridade do ator (NÃO é autorização — ver cabeçalho).
      const ator = await tx.usuario.findUnique({
        where: { id: comando.atorUsuarioId },
        select: { ativo: true },
      });
      if (ator === null) {
        throw new ErroSituacaoProfissional("ATOR_INEXISTENTE");
      }
      if (!ator.ativo) {
        throw new ErroSituacaoProfissional("ATOR_INATIVO");
      }

      // 2. Leitura SOB lock (D-PRO1-10): inexistência e no-op decididos sobre
      //    o estado commitado, depois de qualquer transição concorrente.
      const vigente = await lerLinhaProfissional(tx, comando.profissionalId, true);
      if (vigente === null) {
        throw new ErroSituacaoProfissional("PROFISSIONAL_INEXISTENTE");
      }
      if (vigente.ativo === comando.ativo) {
        // D-PRO1-06: no-op idempotente — sem mutação, sem evento.
        return {
          profissionalId: vigente.id,
          ativo: vigente.ativo,
          profissional: mapearProfissional(vigente),
          mutacaoExecutada: false,
          correlacaoId: null,
        };
      }

      // 3. Mutação CONDICIONAL (defesa adicional sob o lock já adquirido).
      const ocorridoEm = new Date();
      const mutacao = await tx.profissional.updateMany({
        where: { id: comando.profissionalId, ativo: !comando.ativo },
        data: {
          ativo: comando.ativo,
          inativadoEm: comando.ativo ? null : ocorridoEm,
        },
      });
      if (mutacao.count !== 1) {
        throw new Error("Transição de situação não aplicada sob o lock da linha.");
      }

      // 4. Evento de auditoria obrigatório — MESMA transação, mesmo tx.
      await this.auditWriter.registrar(tx, {
        acao: "profissional.situacao.alterada",
        ocorridoEm,
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: "profissional",
        alvoId: comando.profissionalId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
        // Sem `contexto`: whitelist VAZIA (D-AUD-07) — coluna fica NULL.
      });

      const atualizado = await lerLinhaProfissional(tx, comando.profissionalId, false);
      if (atualizado === null) {
        throw new Error("Profissional desapareceu dentro da própria transação.");
      }
      return {
        profissionalId: comando.profissionalId,
        ativo: comando.ativo,
        profissional: mapearProfissional(atualizado),
        mutacaoExecutada: true,
        correlacaoId,
      };
    });
  }
}
