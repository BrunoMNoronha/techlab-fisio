// TechLab Fisio — fluxo interno `profissional.situacao.alterada`
// (Etapa 2.3B; PRO-005, D-AUD-01 docs/09 §12.2, D-1 da autorização da 2.3B).
//
// FATIA TÉCNICA INTERNA — LIMITE DE AUTORIZAÇÃO (vinculante):
//   - NÃO existe controller, endpoint ou rota para esta operação; ela é
//     exercitada exclusivamente por testes de integração;
//   - a validação de ator EXISTENTE e ATIVO é INTEGRIDADE da operação
//     (o evento de auditoria precisa de um ator real e válido — RN-061),
//     NUNCA autorização: RBAC/`profissionais.gerenciar` NÃO está
//     implementado nesta fatia e continua obrigatório antes de qualquer
//     exposição futura do fluxo;
//   - a funcionalidade administrativa de gestão de profissionais NÃO está
//     disponível ao usuário.
//
// PROPRIEDADE TRANSACIONAL (obrigatória): mutação de negócio + evento de
// auditoria = UMA única transação. Falha da auditoria → rollback da mutação;
// falha da mutação → zero evento. O cliente transacional é passado
// explicitamente ao AuditWriter.
//
// CONCORRÊNCIA: a mutação é CONDICIONAL (`updateMany` com o estado anterior
// no WHERE). Sob READ COMMITTED, uma segunda transação concorrente bloqueia
// no lock da linha e reavalia o predicado sobre o estado commitado — para o
// mesmo novo estado, exatamente uma vence (count=1) e a outra observa
// count=0 (SITUACAO_JA_VIGENTE), sem evento duplicado. Não há SELECT →
// decisão em memória → UPDATE incondicional.
//
// AUDITORIA (whitelist VAZIA — D-AUD-07): nenhum contexto é persistido —
// nem `ativo_anterior`/`ativo_novo`/`campos_alterados` (chaves apenas
// propostas, não homologadas). `justificativa` = NULL (a fonte não a exige).
// `correlacao_id` é gerado UMA vez por operação.

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";

export type MotivoRejeicaoSituacaoProfissional =
  | "PROFISSIONAL_INEXISTENTE"
  | "ATOR_INEXISTENTE"
  | "ATOR_INATIVO"
  | "SITUACAO_JA_VIGENTE";

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
  /** Correlação da operação — a mesma persistida no evento de auditoria. */
  readonly correlacaoId: string;
}

@Injectable()
export class ProfissionalService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Operação INTERNA de ativação/inativação de profissional (PRO-005),
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
        const profissional = await tx.profissional.findUnique({
          where: { id: comando.profissionalId },
          select: { id: true },
        });
        throw new ErroSituacaoProfissional(
          profissional === null ? "PROFISSIONAL_INEXISTENTE" : "SITUACAO_JA_VIGENTE",
        );
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

      return {
        profissionalId: comando.profissionalId,
        ativo: comando.ativo,
        correlacaoId,
      };
    });
  }
}
