// TechLab Fisio — tradução do `23505` nas formas de pagamento (CFG-004;
// `docs/14` D-CFG-34): SOMENTE a violação do índice
// `ux_forma_pagamento_clinica_descricao` vira `FORMA_PAGAMENTO_DUPLICADA`;
// `23505` em qualquer outra restrição — e qualquer outra classe de violação —
// segue como falha não controlada (fail closed). Mesmo desenho de
// `servicos-duplicidade.spec.ts` (achado B-2 da revisão da PR #80).

import { describe, expect, it } from "@jest/globals";

import type { AuditWriter } from "../src/audit/audit-writer.js";
import type { DatabaseService } from "../src/database/database.service.js";
import {
  ErroFormaPagamento,
  ehDescricaoDuplicada,
  FormasPagamentoService,
  INDICE_DESCRICAO_FORMA_PAGAMENTO,
} from "../src/formas-pagamento/formas-pagamento.service.js";

/** Forma MEDIDA (V-03) do erro que chega à aplicação — mesma de `database-integration.spec.ts`. */
function erroSintetico(sqlstate: string, mensagem: string): Record<string, unknown> {
  return {
    code: "P2039",
    meta: { driverAdapterError: { cause: { originalCode: sqlstate, originalMessage: mensagem } } },
  };
}

const UNIQUE_DA_DESCRICAO = erroSintetico(
  "23505",
  `duplicate key value violates unique constraint "${INDICE_DESCRICAO_FORMA_PAGAMENTO}"`,
);

const OUTRAS_VIOLACOES: Array<[string, Record<string, unknown> | Error]> = [
  ["23505 na chave primária de forma_pagamento", erroSintetico("23505", 'duplicate key value violates unique constraint "forma_pagamento_pkey"')],
  ["23505 no índice de nome de serviço", erroSintetico("23505", 'duplicate key value violates unique constraint "ux_servico_clinica_nome"')],
  ["23505 sem nome de restrição legível", erroSintetico("23505", "duplicate key value")],
  ["23514 em CHECK de forma_pagamento", erroSintetico("23514", 'new row for relation "forma_pagamento" violates check constraint "ck_forma_pagamento_situacao"')],
  ["erro sem forma de violação", new Error("falha qualquer")],
];

describe("D-CFG-34 — ehDescricaoDuplicada", () => {
  it("reconhece o 23505 do índice de descrição", () => {
    expect(INDICE_DESCRICAO_FORMA_PAGAMENTO).toBe("ux_forma_pagamento_clinica_descricao");
    expect(ehDescricaoDuplicada(UNIQUE_DA_DESCRICAO)).toBe(true);
  });

  it.each(OUTRAS_VIOLACOES)("NÃO reconhece %s", (_rotulo, erro) => {
    expect(ehDescricaoDuplicada(erro)).toBe(false);
  });
});

describe("D-CFG-34 — tradução no FormasPagamentoService (criar e atualizar)", () => {
  function servicoQueFalhaCom(erro: unknown): FormasPagamentoService {
    const database = { transacao: async () => Promise.reject(erro) } as unknown as DatabaseService;
    return new FormasPagamentoService(database, {} as AuditWriter);
  }

  const dados = { descricao: "PIX" };
  const operacoes: Array<[string, (s: FormasPagamentoService) => Promise<unknown>]> = [
    ["criar", (s) => s.criar({ atorUsuarioId: "ator", dados })],
    ["atualizar", (s) => s.atualizar({ atorUsuarioId: "ator", formaPagamentoId: "id", dados })],
  ];

  it.each(operacoes)("%s: 23505 do índice de descrição -> FORMA_PAGAMENTO_DUPLICADA", async (_op, executar) => {
    const promessa = executar(servicoQueFalhaCom(UNIQUE_DA_DESCRICAO));
    await expect(promessa).rejects.toBeInstanceOf(ErroFormaPagamento);
    await expect(promessa).rejects.toMatchObject({ motivo: "FORMA_PAGAMENTO_DUPLICADA" });
  });

  it.each(
    operacoes.flatMap(([op, executar]) => OUTRAS_VIOLACOES.map(([rotulo, erro]) => [op, rotulo, executar, erro] as const)),
  )("%s: %s -> erro original propagado, sem tradução", async (_op, _rotulo, executar, erro) => {
    const promessa = executar(servicoQueFalhaCom(erro));
    await expect(promessa).rejects.toBe(erro);
  });
});
