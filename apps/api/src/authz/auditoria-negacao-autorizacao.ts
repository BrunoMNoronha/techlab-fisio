// TechLab Fisio — auditoria RESTRITA de negações de autorização (L-07;
// PBACK-AUD-09, `docs/09` §13.4.1; pacote decisório `docs/13`).
//
// O emissor de `autorizacao.negada`, e NADA além dele. Materializa as
// decisões de Bruno Menezes Noronha sobre o pacote `docs/13`:
//
//   D-1 (R)   auditoria RESTRITA — lista FECHADA de permissões, hoje com um
//             único item: `senha.recuperar_terceiro`. Nenhum outro `403`,
//             nenhuma outra guard e nenhuma outra permissão é auditada por
//             esta implementação; ampliar a lista exige decisão expressa;
//   D-2 (Q2)  falha ao persistir o evento NÃO altera a resposta: a negação
//             continua `403 ACESSO_NEGADO`, e a falha vira log técnico
//             estruturado com correlação — classe do erro e `correlacao_id`,
//             nunca `message`/`stack` (mesma disciplina do
//             `FiltroErroAutenticacao`: mensagens do driver podem carregar
//             consulta e parâmetros). Não é engolida: é registrada;
//   D-3 (V0)  sem limitação adicional — um evento por tentativa
//             efetivamente negada, sem `DimensaoLimite`, sem agregação, sem
//             amostragem. Risco de volume por insider autenticado registrado
//             em `docs/10`, não mitigado aqui;
//   D-4 (R)   ação `autorizacao.negada`; `resultado = NEGADO`; ator = usuário
//             da SESSÃO persistida; `alvo_tipo = "permissao"` (nome físico da
//             tabela — `D-AUD-03`); `alvo_id = permissao.id` resolvido pelo
//             próprio backend a partir do código exigido pelo handler;
//             contexto VAZIO; `correlacao_id` novo por negação.
//
// DE ONDE VÊM OS DADOS — e de onde NÃO vêm: o ator vem do contexto
// autenticado (linha persistida de `sessao_autenticacao`); a permissão vem da
// METADATA do handler (declarada no servidor por `@RequerPermissao`); o
// `alvo_id` vem de `SELECT id FROM permissao WHERE codigo = ...`. Corpo,
// query string, cabeçalhos, cookie e token da requisição NÃO participam —
// este arquivo sequer recebe a requisição. O alvo pretendido pelo cliente
// (usuário cuja senha se queria recuperar) é DESCONHECIDO no ponto da negação
// e não é inferido: `docs/13` F-04.
//
// FRONTEIRA TRANSACIONAL (T1 de `docs/13` §6.1): no ponto da negação não há
// mutação de negócio nem transação a compartilhar — o handler nunca executa.
// A escrita abre uma transação DEDICADA e curta pela fronteira única da
// aplicação (`DatabaseService.transacao`), reutilizando o `AuditWriter` como
// está — o invariante "writer exige cliente transacional" é preservado, não
// relaxado. Precedente parcial: `PermissoesService` já abre transação própria
// só de leitura.
//
// O QUE ESTE ARQUIVO NÃO FAZ: não decide autorização (a decisão é da
// `PermissoesGuard`, que chama este emissor DEPOIS de decidir negar e ANTES
// de lançar); não trata `401`, CSRF, `422` de negócio nem `500` técnico; não
// relança falha de auditoria; não tenta de novo; não escreve senha, token,
// cookie, corpo, e-mail, IP ou id de usuário em log.

import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import type { Permissao } from "./permissoes.catalogo.js";

/** Ação homologada por PBACK-AUD-09 (`docs/09` §13.4.1). */
export const ACAO_AUTORIZACAO_NEGADA = "autorizacao.negada";

/** `alvo_tipo` — nome físico da tabela do alvo (`D-AUD-03`). */
export const ALVO_TIPO_PERMISSAO = "permissao";

/**
 * LISTA FECHADA das permissões cuja negação deliberada é auditada (D-1 — R).
 *
 * Exatamente um item por decisão. Acrescentar uma permissão aqui é decisão
 * normativa (nova exceção a `D-AUD-05`), nunca ajuste técnico — e a suíte
 * trava o conteúdo desta lista.
 */
export const PERMISSOES_COM_AUDITORIA_DE_NEGACAO: ReadonlySet<Permissao> = new Set<Permissao>([
  "senha.recuperar_terceiro",
]);

/** `true` sse a negação da permissão está no escopo restrito de L-07. */
export function negacaoAuditavel(permissao: Permissao): boolean {
  return PERMISSOES_COM_AUDITORIA_DE_NEGACAO.has(permissao);
}

/**
 * Negação DELIBERADA decidida pela guard: usuário da sessão existe e a
 * resolução de permissões teve sucesso técnico. Casos de fiação (metadata
 * ausente/inválida, contexto ausente) e usuário inexistente NÃO chegam aqui —
 * não são tentativa do usuário, e o ator inexistente violaria a FK de
 * `evento_auditoria.ator_usuario_id`.
 */
export interface NegacaoDeliberada {
  /** `usuarioId` do contexto autenticado — da linha persistida da sessão. */
  readonly atorUsuarioId: string;
  /** Permissão exigida pelo HANDLER (metadata do servidor). */
  readonly permissao: Permissao;
}

/**
 * Sentinela INTERNA: o código exigido não existe em `permissao`. É estado de
 * provisionamento inconsistente (seed da F5 não aplicado), tratado como falha
 * técnica da auditoria (Q2) — jamais como alvo NULL, sentinela ou UUID
 * fictício, todos proibidos por D-4.
 */
class ErroPermissaoNaoPersistida extends Error {
  override readonly name = "ErroPermissaoNaoPersistida";
}

@Injectable()
export class AuditoriaNegacaoAutorizacao {
  readonly #logger = new Logger("Autorizacao");

  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Registra UMA negação deliberada. NUNCA lança (Q2): a resposta funcional
   * pertence à guard, e uma indisponibilidade da trilha não pode convertê-la
   * em `500` nem, muito menos, deixar a requisição prosseguir. Fora da lista
   * fechada, não faz nada — nem abre transação.
   */
  async registrarNegacao(negacao: NegacaoDeliberada): Promise<void> {
    if (!negacaoAuditavel(negacao.permissao)) return;

    // Gerado UMA vez, ANTES da escrita: em caso de falha é o elo entre o log
    // técnico e a investigação, mesmo sem linha persistida.
    const correlacaoId = randomUUID();
    try {
      await this.database.transacao(async (tx) => {
        const linha = await tx.permissao.findUnique({
          where: { codigo: negacao.permissao },
          select: { id: true },
        });
        if (linha === null) throw new ErroPermissaoNaoPersistida();

        await this.auditWriter.registrar(tx, {
          acao: ACAO_AUTORIZACAO_NEGADA,
          ocorridoEm: new Date(),
          atorUsuarioId: negacao.atorUsuarioId,
          alvoTipo: ALVO_TIPO_PERMISSAO,
          alvoId: linha.id,
          resultado: "NEGADO",
          justificativa: null,
          correlacaoId,
          // Contexto OMITIDO — whitelist vazia (PBACK-AUD-09 / D-AUD-07).
        });
      });
    } catch (erro) {
      // Q2 — log técnico SEGURO: classe e correlação, nunca `message`/`stack`
      // (podem carregar consulta e parâmetros); a permissão citada é a
      // metadata do servidor, do catálogo fechado — nunca dado do cliente.
      this.#logger.error(
        `Falha ao persistir auditoria de negação de autorização (autorizacao.negada); ` +
          `a negação permanece efetiva. classe=${
            erro instanceof Error ? erro.name : typeof erro
          } permissao=${negacao.permissao} correlacao=${correlacaoId}`,
      );
    }
  }
}
