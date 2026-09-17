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
// CONCORRÊNCIA: a mutação é CONDICIONAL (`updateMany` com o estado anterior
// no WHERE), o que toma o lock da linha — a mesma linha que o cadastro
// bloqueia com `FOR UPDATE` (D-PRO1-10). Sob READ COMMITTED, uma segunda
// transação concorrente bloqueia e reavalia o predicado sobre o estado
// commitado — para o mesmo novo estado, exatamente uma muta (count=1) e a
// outra observa count=0 e devolve o estado vigente como NO-OP (D-PRO1-06:
// 200 sem mutação e sem evento). Não há SELECT → decisão em memória →
// UPDATE incondicional.
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

      // 2. Mutação CONDICIONAL: só transiciona a partir do estado oposto.
      const ocorridoEm = new Date();
      const mutacao = await tx.profissional.updateMany({
        where: { id: comando.profissionalId, ativo: !comando.ativo },
        data: {
          ativo: comando.ativo,
          inativadoEm: comando.ativo ? null : ocorridoEm,
        },
      });

      if (mutacao.count === 0) {
        // Nada mudou: distinguir inexistência de estado já vigente. A leitura
        // acontece DEPOIS da tentativa condicional — a decisão nunca é feita
        // sobre snapshot anterior à disputa de lock.
        const vigente = await lerLinhaProfissional(tx, comando.profissionalId, false);
        if (vigente === null) {
          throw new ErroSituacaoProfissional("PROFISSIONAL_INEXISTENTE");
        }
        // D-PRO1-06: no-op idempotente — sem mutação, sem evento.
        return {
          profissionalId: vigente.id,
          ativo: vigente.ativo,
          profissional: mapearProfissional(vigente),
          mutacaoExecutada: false,
          correlacaoId: null,
        };
      }

      // 3. Evento de auditoria obrigatório — MESMA transação, mesmo tx.
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
