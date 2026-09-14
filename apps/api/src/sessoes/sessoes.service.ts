// TechLab Fisio — serviço de gestão administrativa de sessões (P-2.3D-07 / AUT-002).
//
// Materializa D-2.3D-19 (docs/12 §5.19) e os critérios de aceite A-01..A-18:
//   - Ator derivado exclusivamente do contexto autenticado;
//   - Transição ATIVA -> REVOGADA e auditoria usuario.sessao.revogacao ATÔMICAS;
//   - Se a auditoria falhar, a revogação sofre rollback;
//   - Resposta uniforme (204) para sucesso, inexistente, já revogada, já expirada
//     ou autorrevogação recusada;
//   - No-op NÃO emite auditoria falsa de sucesso;
//   - Zero vazamento de tokens, senhas ou segredos.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { SessaoService } from "../auth/sessao.service.js";
import type { ResultadoRevogacaoAdministrativaSessao } from "../auth/sessao.service.js";
import { DatabaseService } from "../database/database.service.js";

const ALVO_SESSAO = "sessao_autenticacao";

export interface ComandoRevogarSessaoAdministrativa {
  readonly sessaoId: string;
  readonly atorUsuarioId: string;
}

@Injectable()
export class SessoesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessoes: SessaoService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Executa a revogação administrativa de sessão de terceiro.
   *
   * A mutação e o evento de auditoria ocorrem estritamente na MESMA transação
   * de banco de dados. Caso a escrita de auditoria falhe, a transação inteira
   * é abortada e a revogação não persiste (A-11, A-12).
   */
  async revogarSessaoDeTerceiro(
    comando: ComandoRevogarSessaoAdministrativa,
  ): Promise<ResultadoRevogacaoAdministrativaSessao> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      const resultado = await this.sessoes.revogarPorAdministradorEm(
        tx,
        comando.sessaoId,
        comando.atorUsuarioId,
      );

      if (!resultado.mutacaoExecutada) {
        // No-op não produz auditoria falsa de sucesso (D-2.3D-19, docs/12 §5.19).
        // Se houver transição interna ATIVA -> EXPIRADA por prazo, ela commita normalmente.
        return resultado;
      }

      // Transição efetiva ATIVA -> REVOGADA: emissão obrigatória do evento na mesma tx.
      await this.auditWriter.registrar(tx, {
        acao: "usuario.sessao.revogacao",
        ocorridoEm: resultado.encerradaEm,
        atorUsuarioId: resultado.revogadaPorUsuarioId,
        alvoTipo: ALVO_SESSAO,
        alvoId: resultado.sessaoId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      });

      return resultado;
    });
  }
}
