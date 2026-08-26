// TechLab Fisio — E-14 — T-FIN-OVERPAY, T-FIN-REFUND e T-FIN-IDEMP —
// invariantes financeiras sob o protocolo de lock homologado.
//
// Fontes: docs/07 §17.3 (H2.2-07: lock da linha `cobranca` — raiz de
// serialização financeira), §19.3/§19.4 (H2.2-08: estorno único e integral;
// derivação de recebido líquido), §25 cenário 5 (RN-046), C-05/C-06,
// U-05/U-09/U-10; docs/08 §14.
//
// `pagarSobLock` é TEST HARNESS da persistência: executa o protocolo T-03
// homologado (lock → recalcular recebido líquido → RN-046 → inserir)
// diretamente sobre Prisma/PostgreSQL. Nenhuma semântica HTTP e nenhum
// mecanismo de geração/transporte de chave de idempotência é inventado —
// isso pertence à API (docs/07 §28.3).
//
// Valores monetários dos cenários (100.00 / 80.00 / 40.00 / 10.00) são exatos
// em numeric(12,2) e em float8 — o cast `::float8` nas leituras do harness não
// introduz arredondamento nesses valores.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { identificarViolacao } from "../src/errors/constraint-map.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  OPCOES_TRANSACAO_SOB_CONTENCAO,
  TIMEOUT_TESTE_CONCORRENCIA_MS,
  aguardarEsperaDeLock,
  criarPortao,
  obterPidBackend,
} from "./helpers/concorrencia.js";
import { criarClienteApp } from "./helpers/db.js";
import { capturarErro } from "./helpers/erros.js";
import { criarBaseSintetica, type BaseSintetica } from "./helpers/fixtures.js";

type Tx = Prisma.TransactionClient;

let prisma: PrismaClient;
let clienteA: PrismaClient;
let clienteB: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
  clienteA = criarClienteApp();
  clienteB = criarClienteApp();
});

afterAll(async () => {
  await Promise.all([prisma.$disconnect(), clienteA.$disconnect(), clienteB.$disconnect()]);
});

/** Rejeição de domínio do harness: pagamento excederia o devido (RN-046). */
class PagamentoExcedenteError extends Error {}

/**
 * Lock da linha da cobrança (docs/07 §17.3) — retorna `valor_liquido` lido
 * SOB o lock. Cobrança é a raiz de serialização financeira homologada (H2-06).
 */
async function travarCobranca(tx: Tx, cobrancaId: string): Promise<number> {
  const linhas = await tx.$queryRaw<Array<{ valor_liquido: number }>>`
    SELECT "valor_liquido"::float8 AS valor_liquido
    FROM "cobranca" WHERE "id" = ${cobrancaId}::uuid FOR UPDATE
  `;
  const valorLiquido = linhas[0]?.valor_liquido;
  if (typeof valorLiquido !== "number") {
    throw new Error(`cobranca ${cobrancaId} inexistente — lock impossível`);
  }
  return valorLiquido;
}

/** `recebido_liquido` de docs/07 §19.4: pagamentos sem estorno. */
async function calcularRecebidoLiquido(tx: Tx, cobrancaId: string): Promise<number> {
  const linhas = await tx.$queryRaw<Array<{ recebido: number }>>`
    SELECT COALESCE(SUM(p."valor"), 0)::float8 AS recebido
    FROM "pagamento" p
    WHERE p."cobranca_id" = ${cobrancaId}::uuid
      AND NOT EXISTS (SELECT 1 FROM "estorno" e WHERE e."pagamento_id" = p."id")
  `;
  return linhas[0]?.recebido ?? 0;
}

/** Protocolo T-03 homologado: lock → recebido líquido → RN-046 → inserir. */
async function pagarSobLock(
  tx: Tx,
  dados: { cobrancaId: string; valor: number; formaPagamentoId: string; usuarioId: string },
): Promise<string> {
  const valorLiquido = await travarCobranca(tx, dados.cobrancaId);
  const recebido = await calcularRecebidoLiquido(tx, dados.cobrancaId);
  if (recebido + dados.valor > valorLiquido) {
    throw new PagamentoExcedenteError(
      `recebido=${recebido} + valor=${dados.valor} > valor_liquido=${valorLiquido} (RN-046)`,
    );
  }
  const pagamento = await tx.pagamento.create({
    data: {
      cobrancaId: dados.cobrancaId,
      valor: dados.valor.toFixed(2),
      formaPagamentoId: dados.formaPagamentoId,
      recebidoEm: new Date(),
      registradoPorUsuarioId: dados.usuarioId,
    },
  });
  return pagamento.id;
}

/** Cobrança sintética ADMINISTRATIVA (origem sem FKs — ck_cobranca_origem). */
async function criarCobrancaSintetica(base: BaseSintetica, valorBruto: string) {
  return prisma.cobranca.create({
    data: {
      pacienteId: base.paciente1Id,
      origemTipo: "ADMINISTRATIVA",
      valorBruto,
      dataReferencia: new Date("2026-09-01"),
      criadoPorUsuarioId: base.usuarioId,
    },
  });
}

describe("T-FIN-OVERPAY — pagamentos concorrentes não excedem o devido (C-05, RN-046)", () => {
  it(
    "valor_liquido=100, A paga 80 ‖ B paga 80: um persiste, outro é rejeitado",
    async () => {
      const base = await criarBaseSintetica(prisma);
      const cobranca = await criarCobrancaSintetica(base, "100.00");

      const t1Pagou = criarPortao();
      const pidT2 = criarPortao<number>();
      const t1PodeCommitar = criarPortao();

      // T1: lock da cobrança, verificação RN-046 (0 + 80 <= 100), insere e
      // mantém a transação aberta até T2 estar bloqueada no MESMO lock.
      const t1 = clienteA.$transaction(async (tx) => {
        const pagamentoId = await pagarSobLock(tx, {
          cobrancaId: cobranca.id,
          valor: 80,
          formaPagamentoId: base.formaPagamentoId,
          usuarioId: base.usuarioId,
        });
        t1Pagou.abrir();
        await t1PodeCommitar.promessa;
        return pagamentoId;
      }, OPCOES_TRANSACAO_SOB_CONTENCAO);

      await t1Pagou.promessa;

      // T2: mesmo protocolo — a disputa é resolvida pelo PostgreSQL no lock
      // da linha `cobranca`, não por serialização em JavaScript.
      const t2 = clienteB
        .$transaction(async (tx) => {
          pidT2.abrir(await obterPidBackend(tx));
          return pagarSobLock(tx, {
            cobrancaId: cobranca.id,
            valor: 80,
            formaPagamentoId: base.formaPagamentoId,
            usuarioId: base.usuarioId,
          });
        }, OPCOES_TRANSACAO_SOB_CONTENCAO)
        .then((id) => ({ venceu: true as const, id }))
        .catch((erro: unknown) => ({ venceu: false as const, erro }));

      const pid = await pidT2.promessa;
      await aguardarEsperaDeLock(prisma, pid);

      t1PodeCommitar.abrir();
      const pagamentoVencedor = await t1;

      // T2 acordou APÓS o commit de T1: recebido=80, 80+80 > 100 → RN-046.
      const resultadoT2 = await t2;
      expect(resultadoT2.venceu).toBe(false);
      if (!resultadoT2.venceu) {
        expect(resultadoT2.erro).toBeInstanceOf(PagamentoExcedenteError);
      }

      // Estado final no banco: exatamente um pagamento de 80; jamais 160.
      const pagamentos = await prisma.pagamento.findMany({
        where: { cobrancaId: cobranca.id },
      });
      expect(pagamentos).toHaveLength(1);
      expect(pagamentos[0]?.id).toBe(pagamentoVencedor);
      expect(Number(pagamentos[0]?.valor)).toBe(80);
    },
    TIMEOUT_TESTE_CONCORRENCIA_MS,
  );
});

describe("T-FIN-REFUND — um pagamento admite no máximo um estorno (U-05, H2.2-08)", () => {
  it("rejeita o segundo estorno do mesmo pagamento", async () => {
    const base = await criarBaseSintetica(prisma);
    const cobranca = await criarCobrancaSintetica(base, "100.00");
    const pagamento = await prisma.pagamento.create({
      data: {
        cobrancaId: cobranca.id,
        valor: "100.00",
        formaPagamentoId: base.formaPagamentoId,
        recebidoEm: new Date(),
        registradoPorUsuarioId: base.usuarioId,
      },
    });

    // Primeiro estorno integral (não existe coluna de valor: o valor É o do
    // pagamento — estorno parcial é irrepresentável e NÃO é testado).
    await prisma.estorno.create({
      data: {
        pagamentoId: pagamento.id,
        estornadoEm: new Date(),
        estornadoPorUsuarioId: base.usuarioId,
        motivo: "estorno sintético E-14",
      },
    });

    const erro = await capturarErro(() =>
      prisma.estorno.create({
        data: {
          pagamentoId: pagamento.id,
          estornadoEm: new Date(),
          estornadoPorUsuarioId: base.usuarioId,
          motivo: "segundo estorno sintético E-14",
        },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.modelo).toBe("Estorno");
    expect(v?.camposUnique).toEqual(["pagamento_id"]);

    const estornos = await prisma.estorno.count({ where: { pagamentoId: pagamento.id } });
    expect(estornos).toBe(1);
  });
});

describe("T-FIN-IDEMP — chave_idempotencia duplicada é rejeitada (C-06, U-09/U-10)", () => {
  it("pagamento: segunda escrita com a mesma chave é rejeitada", async () => {
    const base = await criarBaseSintetica(prisma);
    const cobranca = await criarCobrancaSintetica(base, "100.00");
    const chave = "chave-sintetica-e14-pagamento";

    await prisma.pagamento.create({
      data: {
        cobrancaId: cobranca.id,
        valor: "10.00",
        formaPagamentoId: base.formaPagamentoId,
        recebidoEm: new Date(),
        registradoPorUsuarioId: base.usuarioId,
        chaveIdempotencia: chave,
      },
    });
    const erro = await capturarErro(() =>
      prisma.pagamento.create({
        data: {
          cobrancaId: cobranca.id,
          valor: "10.00",
          formaPagamentoId: base.formaPagamentoId,
          recebidoEm: new Date(),
          registradoPorUsuarioId: base.usuarioId,
          chaveIdempotencia: chave,
        },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.modelo).toBe("Pagamento");
    expect(v?.camposUnique).toEqual(["chave_idempotencia"]);

    const total = await prisma.pagamento.count({ where: { chaveIdempotencia: chave } });
    expect(total).toBe(1);
  });

  it("estorno: segunda escrita com a mesma chave é rejeitada", async () => {
    const base = await criarBaseSintetica(prisma);
    const cobranca = await criarCobrancaSintetica(base, "100.00");
    const chave = "chave-sintetica-e14-estorno";

    // Dois pagamentos distintos: cada estorno referencia um pagamento próprio,
    // isolando a colisão exclusivamente na chave de idempotência (U-10) — sem
    // interferência de U-05.
    const criarPagamento = () =>
      prisma.pagamento.create({
        data: {
          cobrancaId: cobranca.id,
          valor: "40.00",
          formaPagamentoId: base.formaPagamentoId,
          recebidoEm: new Date(),
          registradoPorUsuarioId: base.usuarioId,
        },
      });
    const pagamento1 = await criarPagamento();
    const pagamento2 = await criarPagamento();

    await prisma.estorno.create({
      data: {
        pagamentoId: pagamento1.id,
        estornadoEm: new Date(),
        estornadoPorUsuarioId: base.usuarioId,
        motivo: "estorno sintético E-14",
        chaveIdempotencia: chave,
      },
    });
    const erro = await capturarErro(() =>
      prisma.estorno.create({
        data: {
          pagamentoId: pagamento2.id,
          estornadoEm: new Date(),
          estornadoPorUsuarioId: base.usuarioId,
          motivo: "estorno sintético E-14 repetido",
          chaveIdempotencia: chave,
        },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.modelo).toBe("Estorno");
    expect(v?.camposUnique).toEqual(["chave_idempotencia"]);

    const total = await prisma.estorno.count({ where: { chaveIdempotencia: chave } });
    expect(total).toBe(1);
  });
});
