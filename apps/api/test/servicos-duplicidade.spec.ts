// TechLab Fisio — tradução do `23505` no catálogo de serviços (CFG-003;
// `docs/14` D-CFG-22): SOMENTE a violação do índice `ux_servico_clinica_nome`
// vira `SERVICO_DUPLICADO`; `23505` em qualquer outra restrição — e qualquer
// outra classe de violação — segue como falha não controlada (fail closed).
//
// Reforço pós-integração (revisão independente da PR #80, achado B-2): a suíte
// de integração só provava o sentido positivo; esta prova fecha o negativo sem
// depender de provocar, via HTTP, um `23505` alheio ao nome.

import { describe, expect, it } from "@jest/globals";

import type { AuditWriter } from "../src/audit/audit-writer.js";
import type { DatabaseService } from "../src/database/database.service.js";
import {
  ErroServico,
  ehNomeDuplicado,
  INDICE_NOME_SERVICO,
  ServicosService,
} from "../src/servicos/servicos.service.js";

/** Forma MEDIDA (V-03) do erro que chega à aplicação — mesma de `database-integration.spec.ts`. */
function erroSintetico(sqlstate: string, mensagem: string): Record<string, unknown> {
  return {
    code: "P2039",
    meta: { driverAdapterError: { cause: { originalCode: sqlstate, originalMessage: mensagem } } },
  };
}

const UNIQUE_DO_NOME = erroSintetico(
  "23505",
  `duplicate key value violates unique constraint "${INDICE_NOME_SERVICO}"`,
);

const OUTRAS_VIOLACOES: Array<[string, Record<string, unknown> | Error]> = [
  ["23505 na chave primária de servico", erroSintetico("23505", 'duplicate key value violates unique constraint "servico_pkey"')],
  ["23505 em índice único de outra tabela", erroSintetico("23505", 'duplicate key value violates unique constraint "usuario_email_key"')],
  ["23505 sem nome de restrição legível", erroSintetico("23505", "duplicate key value")],
  ["23514 em CHECK de servico", erroSintetico("23514", 'new row for relation "servico" violates check constraint "ck_servico_situacao"')],
  ["erro sem forma de violação", new Error("falha qualquer")],
];

describe("D-CFG-22 — ehNomeDuplicado", () => {
  it("reconhece o 23505 do índice de nome", () => {
    expect(INDICE_NOME_SERVICO).toBe("ux_servico_clinica_nome");
    expect(ehNomeDuplicado(UNIQUE_DO_NOME)).toBe(true);
  });

  it.each(OUTRAS_VIOLACOES)("NÃO reconhece %s", (_rotulo, erro) => {
    expect(ehNomeDuplicado(erro)).toBe(false);
  });
});

describe("D-CFG-22 — tradução no ServicosService (criar e atualizar)", () => {
  function servicoQueFalhaCom(erro: unknown): ServicosService {
    const database = { transacao: async () => Promise.reject(erro) } as unknown as DatabaseService;
    return new ServicosService(database, {} as AuditWriter);
  }

  const dados = { nome: "Pilates", duracaoMin: 50, precoReferencia: "150.00" };
  const operacoes: Array<[string, (s: ServicosService) => Promise<unknown>]> = [
    ["criar", (s) => s.criar({ atorUsuarioId: "ator", dados })],
    ["atualizar", (s) => s.atualizar({ atorUsuarioId: "ator", servicoId: "id", dados })],
  ];

  it.each(operacoes)("%s: 23505 do índice de nome -> ErroServico SERVICO_DUPLICADO", async (_op, executar) => {
    const promessa = executar(servicoQueFalhaCom(UNIQUE_DO_NOME));
    await expect(promessa).rejects.toBeInstanceOf(ErroServico);
    await expect(promessa).rejects.toMatchObject({ motivo: "SERVICO_DUPLICADO" });
  });

  it.each(operacoes.flatMap(([op, executar]) => OUTRAS_VIOLACOES.map(([rotulo, erro]) => [op, rotulo, executar, erro] as const)))(
    "%s: %s -> erro original propagado, sem tradução",
    async (_op, _rotulo, executar, erro) => {
      const promessa = executar(servicoQueFalhaCom(erro));
      await expect(promessa).rejects.toBe(erro);
    },
  );
});
