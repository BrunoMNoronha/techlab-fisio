// TechLab Fisio — L-07 (PBACK-AUD-09) — o emissor `AuditoriaNegacaoAutorizacao`
// em isolamento: SEM banco e SEM servidor. Persistência e writer são dublês
// controlados; o caminho real (guard → emissor → transação dedicada →
// `AuditWriter` → PostgreSQL) é medido na suíte de integração
// `test/integration/recuperacao-senha.integration.spec.ts`.
//
// Propriedades medidas aqui:
//   D-1 (R)  lista FECHADA: só `senha.recuperar_terceiro` emite; qualquer
//            outra permissão do catálogo não abre sequer a transação;
//   D-4 (R)  o evento entregue ao writer é EXATAMENTE o contrato: ação,
//            NEGADO, ator da sessão, `permissao`/`permissao.id`, sem contexto,
//            sem justificativa, `correlacao_id` uuid novo por chamada;
//   D-2 (Q2) falha da transação, do writer (validator) ou permissão não
//            persistida: NÃO lança, NÃO tenta de novo, registra UM log técnico
//            com classe + correlação e SEM `message`/`stack`/dado sensível;
//   D-3 (V0) N chamadas => N escritas, sem dedupe;
//   fronteira: a leitura de `permissao` e a escrita ocorrem na MESMA transação
//            dedicada, aberta pela fronteira única (`DatabaseService.transacao`).

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Logger } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import type { AuditWriter, EventoAuditoriaCandidato } from "../src/audit/audit-writer.js";
import { ErroContextoAuditoria } from "../src/audit/audit-context.validator.js";
import {
  ACAO_AUTORIZACAO_NEGADA,
  ALVO_TIPO_PERMISSAO,
  AuditoriaNegacaoAutorizacao,
  PERMISSOES_COM_AUDITORIA_DE_NEGACAO,
  negacaoAuditavel,
} from "../src/authz/auditoria-negacao-autorizacao.js";
import { PERMISSOES } from "../src/authz/permissoes.catalogo.js";
import type { DatabaseService } from "../src/database/database.service.js";

const ATOR = "11111111-1111-4111-8111-111111111111";
const PERMISSAO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Marcador que NUNCA pode aparecer em log — simula conteúdo sensível na mensagem do driver. */
const SENSIVEL = "SENSIVEL-hash_segredo=abc token=xyz cookie=tlf senha=123";

interface Dubles {
  readonly database: DatabaseService;
  readonly writer: AuditWriter;
  readonly eventos: Array<{ tx: unknown; evento: EventoAuditoriaCandidato }>;
  readonly transacoesAbertas: () => number;
  readonly consultas: string[];
}

/**
 * Persistência controlada: `transacao` entrega um `tx` sintético cujo
 * `permissao.findUnique` registra o código consultado e devolve a linha
 * configurada. O writer registra o evento recebido e o `tx` com que foi
 * chamado — para provar que leitura e escrita partilham a transação.
 */
function dubles(opcoes: {
  readonly linha?: { id: string } | null;
  readonly falhaTransacao?: Error;
  readonly falhaWriter?: Error;
} = {}): Dubles {
  const eventos: Dubles["eventos"] = [];
  const consultas: string[] = [];
  let abertas = 0;
  const tx = {
    permissao: {
      async findUnique(args: { where: { codigo: string } }): Promise<{ id: string } | null> {
        consultas.push(args.where.codigo);
        return opcoes.linha === undefined ? { id: PERMISSAO_ID } : opcoes.linha;
      },
    },
  };
  const database = {
    async transacao<T>(corpo: (t: TransacaoPersistencia) => Promise<T>): Promise<T> {
      abertas += 1;
      if (opcoes.falhaTransacao !== undefined) throw opcoes.falhaTransacao;
      return corpo(tx as unknown as TransacaoPersistencia);
    },
  } as unknown as DatabaseService;
  const writer = {
    async registrar(t: unknown, evento: EventoAuditoriaCandidato): Promise<void> {
      if (opcoes.falhaWriter !== undefined) throw opcoes.falhaWriter;
      eventos.push({ tx: t, evento });
    },
  } as unknown as AuditWriter;
  return { database, writer, eventos, transacoesAbertas: () => abertas, consultas };
}

function espiarLog(): jest.SpiedFunction<Logger["error"]> {
  return jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("D-1 — lista FECHADA de permissões auditáveis", () => {
  it("contém exatamente `senha.recuperar_terceiro`", () => {
    expect([...PERMISSOES_COM_AUDITORIA_DE_NEGACAO]).toEqual(["senha.recuperar_terceiro"]);
  });

  it.each(PERMISSOES.filter((p) => p !== "senha.recuperar_terceiro"))(
    "%s NÃO é auditável: nenhuma transação é aberta, nenhum evento é escrito",
    async (permissao) => {
      expect(negacaoAuditavel(permissao)).toBe(false);
      const d = dubles();
      const log = espiarLog();
      await new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
        atorUsuarioId: ATOR,
        permissao,
      });
      expect(d.transacoesAbertas()).toBe(0);
      expect(d.eventos).toEqual([]);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("controle positivo: `senha.recuperar_terceiro` É auditável e escreve", async () => {
    expect(negacaoAuditavel("senha.recuperar_terceiro")).toBe(true);
    const d = dubles();
    await new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
      atorUsuarioId: ATOR,
      permissao: "senha.recuperar_terceiro",
    });
    expect(d.transacoesAbertas()).toBe(1);
    expect(d.eventos).toHaveLength(1);
  });
});

describe("D-4 — contrato do evento", () => {
  it("entrega ao writer EXATAMENTE o evento homologado, sem contexto", async () => {
    const d = dubles();
    const antes = Date.now();
    await new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
      atorUsuarioId: ATOR,
      permissao: "senha.recuperar_terceiro",
    });
    const { evento } = d.eventos[0] as Dubles["eventos"][number];
    expect(Object.keys(evento).sort()).toEqual(
      ["acao", "alvoId", "alvoTipo", "atorUsuarioId", "correlacaoId", "justificativa", "ocorridoEm", "resultado"].sort(),
    );
    expect(evento).toMatchObject({
      acao: ACAO_AUTORIZACAO_NEGADA,
      resultado: "NEGADO",
      atorUsuarioId: ATOR,
      alvoTipo: ALVO_TIPO_PERMISSAO,
      alvoId: PERMISSAO_ID,
      justificativa: null,
    });
    expect(ACAO_AUTORIZACAO_NEGADA).toBe("autorizacao.negada");
    expect(ALVO_TIPO_PERMISSAO).toBe("permissao");
    expect("contexto" in evento).toBe(false);
    expect(evento.correlacaoId).toMatch(UUID);
    expect(evento.ocorridoEm.getTime()).toBeGreaterThanOrEqual(antes);
    expect(evento.ocorridoEm.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("o alvo é resolvido pelo BACKEND a partir do código exigido — leitura e escrita na MESMA transação", async () => {
    const d = dubles();
    await new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
      atorUsuarioId: ATOR,
      permissao: "senha.recuperar_terceiro",
    });
    expect(d.consultas).toEqual(["senha.recuperar_terceiro"]);
    expect(d.transacoesAbertas()).toBe(1);
    // O `tx` recebido pelo writer é o mesmo cliente transacional da leitura.
    expect(d.eventos[0]?.tx).toBeDefined();
    expect((d.eventos[0]?.tx as { permissao: unknown }).permissao).toBeDefined();
  });

  it("`correlacao_id` é NOVO a cada negação (D-3 V0: N chamadas => N eventos independentes)", async () => {
    const d = dubles();
    const emissor = new AuditoriaNegacaoAutorizacao(d.database, d.writer);
    const negacao = { atorUsuarioId: ATOR, permissao: "senha.recuperar_terceiro" as const };
    await Promise.all([emissor.registrarNegacao(negacao), emissor.registrarNegacao(negacao), emissor.registrarNegacao(negacao)]);
    expect(d.eventos).toHaveLength(3);
    expect(new Set(d.eventos.map((e) => e.evento.correlacaoId)).size).toBe(3);
    expect(d.transacoesAbertas()).toBe(3);
  });
});

describe("D-2 — Q2: falha na gravação NÃO lança, NÃO repete, e gera log técnico SEGURO", () => {
  it("transação indisponível: resolve normalmente; um log com classe + correlação; sem message/stack", async () => {
    const falha = new Error(`banco indisponivel ${SENSIVEL}`);
    falha.name = "PrismaClientInitializationError";
    const d = dubles({ falhaTransacao: falha });
    const log = espiarLog();
    await expect(
      new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
        atorUsuarioId: ATOR,
        permissao: "senha.recuperar_terceiro",
      }),
    ).resolves.toBeUndefined();
    expect(d.transacoesAbertas()).toBe(1); // nenhuma segunda tentativa
    expect(d.eventos).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    const mensagem = String(log.mock.calls[0]?.[0]);
    expect(mensagem).toContain("autorizacao.negada");
    expect(mensagem).toContain("classe=PrismaClientInitializationError");
    expect(mensagem).toContain("permissao=senha.recuperar_terceiro");
    expect(mensagem).toMatch(/correlacao=[0-9a-f-]{36}/);
    for (const proibido of [SENSIVEL, "hash_segredo", "token=", "cookie=", "senha=", "banco indisponivel", "    at ", ATOR]) {
      expect(mensagem).not.toContain(proibido);
    }
  });

  it("writer rejeita (política de auditoria): mesmo comportamento — a política não vira 500", async () => {
    const d = dubles({
      falhaWriter: new ErroContextoAuditoria("ACAO_DESCONHECIDA", "autorizacao.negada", [], `rejeitado ${SENSIVEL}`),
    });
    const log = espiarLog();
    await expect(
      new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
        atorUsuarioId: ATOR,
        permissao: "senha.recuperar_terceiro",
      }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    const mensagem = String(log.mock.calls[0]?.[0]);
    expect(mensagem).toContain("classe=ErroContextoAuditoria");
    expect(mensagem).not.toContain(SENSIVEL);
  });

  it("permissão NÃO persistida (seed ausente): sem alvo NULL, sem sentinela — falha técnica Q2, sem escrita", async () => {
    const d = dubles({ linha: null });
    const log = espiarLog();
    await expect(
      new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
        atorUsuarioId: ATOR,
        permissao: "senha.recuperar_terceiro",
      }),
    ).resolves.toBeUndefined();
    expect(d.eventos).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("classe=ErroPermissaoNaoPersistida");
  });

  it("valor lançado que não é Error: ainda assim não propaga e registra o tipo", async () => {
    const d = dubles({ falhaTransacao: "texto cru" as unknown as Error });
    const log = espiarLog();
    await expect(
      new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
        atorUsuarioId: ATOR,
        permissao: "senha.recuperar_terceiro",
      }),
    ).resolves.toBeUndefined();
    expect(String(log.mock.calls[0]?.[0])).toContain("classe=string");
    expect(String(log.mock.calls[0]?.[0])).not.toContain("texto cru");
  });

  it("controle positivo: sem falha, NENHUM log de erro é emitido", async () => {
    const d = dubles();
    const log = espiarLog();
    await new AuditoriaNegacaoAutorizacao(d.database, d.writer).registrarNegacao({
      atorUsuarioId: ATOR,
      permissao: "senha.recuperar_terceiro",
    });
    expect(log).not.toHaveBeenCalled();
  });
});
