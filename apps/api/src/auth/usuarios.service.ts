// TechLab Fisio — serviço de gestão de situação de usuários (AUT-005 / D-2.3D-21).
//
// Materializa a regra de negócio e a transação atômica aprovadas por Bruno Menezes Noronha:
//   - D21-01: Proibição de auto-inativação (alvoId === atorId -> AUTO_INATIVACAO_PROIBIDA);
//   - D21-02: Reativação limpa inativado_em e inativado_por_usuario_id para NULL;
//   - D21-03: No-op idempotente retorna 200 com estado corrente sem mutação e sem auditoria;
//   - Transação atômica única: usuário + sessões + auditoria usuario.situacao.alterada;
//   - Rollback conjunto em falha de escrita de auditoria;
//   - Whitelist de contexto estritamente vazia (D-AUD-07).

import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import { RELOGIO_SESSAO, type RelogioSessao } from "./relogio-sessao.js";
import { SessaoService } from "./sessao.service.js";

const ALVO_USUARIO = "usuario";

export type MotivoRejeicaoSituacaoUsuario =
  | "USUARIO_INEXISTENTE"
  | "AUTO_INATIVACAO_PROIBIDA";

export class ErroSituacaoUsuario extends Error {
  override readonly name = "ErroSituacaoUsuario";

  constructor(readonly motivo: MotivoRejeicaoSituacaoUsuario) {
    super(`Alteração de situação de usuário rejeitada: ${motivo}.`);
  }
}

export interface ComandoAlterarSituacaoUsuario {
  readonly usuarioId: string;
  readonly atorUsuarioId: string;
  readonly ativo: boolean;
}

export interface ResultadoAlterarSituacaoUsuario {
  readonly usuarioId: string;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
  readonly mutacaoExecutada: boolean;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessoes: SessaoService,
    private readonly auditWriter: AuditWriter,
    @Inject(RELOGIO_SESSAO) private readonly relogio: RelogioSessao,
  ) {}

  /**
   * Executa a alteração atômica de situação de usuário (AUT-005, RN-001, D-2.3D-21).
   */
  async alterarSituacao(
    comando: ComandoAlterarSituacaoUsuario,
  ): Promise<ResultadoAlterarSituacaoUsuario> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      // 1. Obter e bloquear o usuário-alvo com semântica equivalente a SELECT ... FOR UPDATE
      const linhas = await tx.$queryRaw<
        Array<{
          id: string;
          ativo: boolean;
          inativado_em: Date | null;
        }>
      >`
        SELECT id, ativo, inativado_em
          FROM usuario
         WHERE id = ${comando.usuarioId}::uuid
           FOR UPDATE
      `;

      const usuario = linhas[0];
      if (!usuario) {
        throw new ErroSituacaoUsuario("USUARIO_INEXISTENTE");
      }

      // 2. D21-01 — Auto-inativação proibida
      if (!comando.ativo && comando.usuarioId === comando.atorUsuarioId) {
        throw new ErroSituacaoUsuario("AUTO_INATIVACAO_PROIBIDA");
      }

      // 3. D21-03 — Idempotência (no-op seguro sem mutação, sem timestamp e sem auditoria)
      if (usuario.ativo === comando.ativo) {
        return {
          usuarioId: usuario.id,
          ativo: usuario.ativo,
          inativadoEm: usuario.inativado_em,
          mutacaoExecutada: false,
        };
      }

      const agora = this.relogio.agora();

      // 4. Mutação do usuário
      if (comando.ativo) {
        // D21-02 — Reativação: limpa inativado_em e inativado_por_usuario_id para NULL
        await tx.$executeRaw`
          UPDATE usuario
             SET ativo                    = true,
                 inativado_em             = NULL,
                 inativado_por_usuario_id = NULL,
                 atualizado_em            = ${agora}::timestamptz
           WHERE id = ${comando.usuarioId}::uuid
        `;
      } else {
        // Inativação: preenche inativado_em e inativado_por_usuario_id
        await tx.$executeRaw`
          UPDATE usuario
             SET ativo                    = false,
                 inativado_em             = ${agora}::timestamptz,
                 inativado_por_usuario_id = ${comando.atorUsuarioId}::uuid,
                 atualizado_em            = ${agora}::timestamptz
           WHERE id = ${comando.usuarioId}::uuid
        `;

        // Revoga em massa todas as sessões ativas com o admin executor como autor
        await this.sessoes.revogarTodasPorAdministradorEm(
          tx,
          comando.usuarioId,
          comando.atorUsuarioId,
        );
      }

      // 5. Auditoria obrigatória na MESMA transação
      await this.auditWriter.registrar(tx, {
        acao: "usuario.situacao.alterada",
        ocorridoEm: agora,
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: ALVO_USUARIO,
        alvoId: comando.usuarioId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
        // D-AUD-07: whitelist estritamente vazia
      });

      return {
        usuarioId: comando.usuarioId,
        ativo: comando.ativo,
        inativadoEm: comando.ativo ? null : agora,
        mutacaoExecutada: true,
      };
    });
  }
}
