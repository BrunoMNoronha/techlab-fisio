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
//
// Listagem administrativa das sessões ativas de um usuário (D-2.3D-22):
//   - somente leitura: nenhuma escrita, nem a detecção persistente de expiração;
//   - somente sessões ATIVA ainda válidas pela política temporal de D-2.3D-04;
//   - projeção fechada, sem token/hash; nenhum evento de auditoria.

import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { RELOGIO_SESSAO } from "../auth/relogio-sessao.js";
import type { RelogioSessao } from "../auth/relogio-sessao.js";
import { POLITICA_SESSAO, SessaoService } from "../auth/sessao.service.js";
import type { ResultadoRevogacaoAdministrativaSessao } from "../auth/sessao.service.js";
import { DatabaseService } from "../database/database.service.js";

const ALVO_SESSAO = "sessao_autenticacao";

export interface ComandoRevogarSessaoAdministrativa {
  readonly sessaoId: string;
  readonly atorUsuarioId: string;
}

export interface SessaoAtivaUsuario {
  readonly sessaoId: string;
  readonly criadaEm: Date;
  readonly ultimaAtividadeEm: Date;
  readonly expiraEm: Date;
}

@Injectable()
export class SessoesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly sessoes: SessaoService,
    private readonly auditWriter: AuditWriter,
    @Inject(RELOGIO_SESSAO) private readonly relogio: RelogioSessao,
  ) {}

  /**
   * Lista as sessões ATIVAS e temporalmente válidas de um usuário (D-2.3D-22).
   *
   * Os predicados temporais espelham D-2.3D-04 com o MESMO relógio da
   * validação: uma sessão vencida e ainda não detectada como EXPIRADA não é
   * listada, e não é escrita aqui — GET permanece sem efeito colateral.
   * Usuário inexistente resulta em lista vazia.
   */
  async listarSessoesAtivasDoUsuario(usuarioId: string): Promise<SessaoAtivaUsuario[]> {
    const agora = this.relogio.agora();
    const limiteOcioso = new Date(agora.getTime() - POLITICA_SESSAO.timeoutOciosoMs);

    const linhas = await this.database.transacao(async (tx) =>
      tx.sessaoAutenticacao.findMany({
        where: {
          usuarioId,
          estado: "ATIVA",
          expiraEm: { gt: agora },
          ultimaAtividadeEm: { gt: limiteOcioso },
        },
        select: { id: true, criadaEm: true, ultimaAtividadeEm: true, expiraEm: true },
        orderBy: [{ criadaEm: "asc" }, { id: "asc" }],
      }),
    );

    return linhas.map((linha) => ({
      sessaoId: linha.id,
      criadaEm: linha.criadaEm,
      ultimaAtividadeEm: linha.ultimaAtividadeEm,
      expiraEm: linha.expiraEm,
    }));
  }

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
