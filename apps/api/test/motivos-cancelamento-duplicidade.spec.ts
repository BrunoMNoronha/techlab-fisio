// TechLab Fisio — tradução do `23505` nos motivos de cancelamento (CFG-005;
// `docs/14` D-CFG-46): SOMENTE a violação do índice
// `ux_motivo_cancelamento_clinica_descricao` vira `MOTIVO_CANCELAMENTO_DUPLICADO`;
// `23505` em qualquer outra restrição — e qualquer outra classe de violação —
// segue como falha não controlada (fail closed). Mesmo desenho de
// `formas-pagamento-duplicidade.spec.ts` e de `servicos-duplicidade.spec.ts`
// (achado B-2 da revisão da PR #80); o ramo negativo é inalcançável por HTTP,
// pois a tabela só tem uma restrição única além da PK.

import { describe, expect, it } from "@jest/globals";

import type { AuditWriter } from "../src/audit/audit-writer.js";
import type { DatabaseService } from "../src/database/database.service.js";
import {
  ErroMotivoCancelamento,
  ehDescricaoDuplicada,
  INDICE_DESCRICAO_MOTIVO_CANCELAMENTO,
  MotivosCancelamentoService,
} from "../src/motivos-cancelamento/motivos-cancelamento.service.js";

/** Forma MEDIDA (V-03) do erro que chega à aplicação — mesma de `database-integration.spec.ts`. */
function erroSintetico(sqlstate: string, mensagem: string): Record<string, unknown> {
  return {
    code: "P2039",
    meta: { driverAdapterError: { cause: { originalCode: sqlstate, originalMessage: mensagem } } },
  };
}

const UNIQUE_DA_DESCRICAO = erroSintetico(
  "23505",
  `duplicate key value violates unique constraint "${INDICE_DESCRICAO_MOTIVO_CANCELAMENTO}"`,
);

const OUTRAS_VIOLACOES: Array<[string, Record<string, unknown> | Error]> = [
  ["23505 na chave primária de motivo_cancelamento", erroSintetico("23505", 'duplicate key value violates unique constraint "motivo_cancelamento_pkey"')],
  ["23505 no índice de descrição das formas de pagamento", erroSintetico("23505", 'duplicate key value violates unique constraint "ux_forma_pagamento_clinica_descricao"')],
  ["23505 sem nome de restrição legível", erroSintetico("23505", "duplicate key value")],
  ["23514 em CHECK de motivo_cancelamento", erroSintetico("23514", 'new row for relation "motivo_cancelamento" violates check constraint "ck_motivo_cancelamento_situacao"')],
  ["erro sem forma de violação", new Error("falha qualquer")],
];

describe("D-CFG-46 — ehDescricaoDuplicada", () => {
  it("reconhece o 23505 do índice de descrição", () => {
    expect(INDICE_DESCRICAO_MOTIVO_CANCELAMENTO).toBe("ux_motivo_cancelamento_clinica_descricao");
    expect(ehDescricaoDuplicada(UNIQUE_DA_DESCRICAO)).toBe(true);
  });

  it.each(OUTRAS_VIOLACOES)("NÃO reconhece %s", (_rotulo, erro) => {
    expect(ehDescricaoDuplicada(erro)).toBe(false);
  });
});

describe("D-CFG-46 — tradução no MotivosCancelamentoService (criar e atualizar)", () => {
  function servicoQueFalhaCom(erro: unknown): MotivosCancelamentoService {
    const database = { transacao: async () => Promise.reject(erro) } as unknown as DatabaseService;
    return new MotivosCancelamentoService(database, {} as AuditWriter);
  }

  const dados = { descricao: "Paciente desistiu" };
  const operacoes: Array<[string, (s: MotivosCancelamentoService) => Promise<unknown>]> = [
    ["criar", (s) => s.criar({ atorUsuarioId: "ator", dados })],
    ["atualizar", (s) => s.atualizar({ atorUsuarioId: "ator", motivoCancelamentoId: "id", dados })],
  ];

  it.each(operacoes)("%s: 23505 do índice de descrição -> MOTIVO_CANCELAMENTO_DUPLICADO", async (_op, executar) => {
    const promessa = executar(servicoQueFalhaCom(UNIQUE_DA_DESCRICAO));
    await expect(promessa).rejects.toBeInstanceOf(ErroMotivoCancelamento);
    await expect(promessa).rejects.toMatchObject({ motivo: "MOTIVO_CANCELAMENTO_DUPLICADO" });
  });

  it.each(
    operacoes.flatMap(([op, executar]) => OUTRAS_VIOLACOES.map(([rotulo, erro]) => [op, rotulo, executar, erro] as const)),
  )("%s: %s -> erro original propagado, sem tradução", async (_op, _rotulo, executar, erro) => {
    const promessa = executar(servicoQueFalhaCom(erro));
    await expect(promessa).rejects.toBe(erro);
  });
});
