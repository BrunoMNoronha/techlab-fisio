// TechLab Fisio — tradução do `23505` no vínculo profissional ↔ usuário
// (fatia PRO-A; `docs/18` D-PRO1-04, D-PRO1-10): SOMENTE a violação de
// `profissional_usuario_id_key` (U-08) vira `USUARIO_JA_VINCULADO`; `23505` em
// qualquer outra restrição — e qualquer outra classe de violação — segue como
// falha não controlada (fail closed).

import { describe, expect, it } from "@jest/globals";

import type { DatabaseService } from "../src/database/database.service.js";
import {
  ErroProfissional,
  ehUsuarioJaVinculado,
  INDICE_USUARIO_PROFISSIONAL,
  ProfissionaisService,
} from "../src/profissional/profissionais.service.js";

/** Forma MEDIDA (V-03) do erro que chega à aplicação — mesma de `database-integration.spec.ts`. */
function erroSintetico(sqlstate: string, mensagem: string): Record<string, unknown> {
  return {
    code: "P2039",
    meta: { driverAdapterError: { cause: { originalCode: sqlstate, originalMessage: mensagem } } },
  };
}

const UNIQUE_DO_VINCULO = erroSintetico(
  "23505",
  `duplicate key value violates unique constraint "${INDICE_USUARIO_PROFISSIONAL}"`,
);

const OUTRAS_VIOLACOES: Array<[string, Record<string, unknown> | Error]> = [
  ["23505 na chave primária de profissional", erroSintetico("23505", 'duplicate key value violates unique constraint "profissional_pkey"')],
  ["23505 na PK de profissional_servico", erroSintetico("23505", 'duplicate key value violates unique constraint "profissional_servico_pkey"')],
  ["23505 sem nome de restrição legível", erroSintetico("23505", "duplicate key value")],
  ["23514 em CHECK de profissional", erroSintetico("23514", 'new row for relation "profissional" violates check constraint "ck_profissional_situacao"')],
  ["erro sem forma de violação", new Error("falha qualquer")],
];

describe("D-PRO1-04 — ehUsuarioJaVinculado", () => {
  it("reconhece o 23505 de U-08", () => {
    expect(INDICE_USUARIO_PROFISSIONAL).toBe("profissional_usuario_id_key");
    expect(ehUsuarioJaVinculado(UNIQUE_DO_VINCULO)).toBe(true);
  });

  it.each(OUTRAS_VIOLACOES)("NÃO reconhece %s", (_rotulo, erro) => {
    expect(ehUsuarioJaVinculado(erro)).toBe(false);
  });
});

describe("D-PRO1-04 — tradução no ProfissionaisService (criar e atualizar)", () => {
  function servicoQueFalhaCom(erro: unknown): ProfissionaisService {
    const database = { transacao: async () => Promise.reject(erro) } as unknown as DatabaseService;
    return new ProfissionaisService(database);
  }

  const dados = { nome: "Ana", registroProfissional: null, usuarioId: "0191f5a0-0000-7000-8000-00000000000a" };
  const operacoes: Array<[string, (s: ProfissionaisService) => Promise<unknown>]> = [
    ["criar", (s) => s.criar(dados)],
    ["atualizar", (s) => s.atualizar("id", dados)],
  ];

  it.each(operacoes)("%s: 23505 de U-08 -> USUARIO_JA_VINCULADO", async (_op, executar) => {
    const promessa = executar(servicoQueFalhaCom(UNIQUE_DO_VINCULO));
    await expect(promessa).rejects.toBeInstanceOf(ErroProfissional);
    await expect(promessa).rejects.toMatchObject({ motivo: "USUARIO_JA_VINCULADO" });
  });

  it.each(
    operacoes.flatMap(([op, executar]) => OUTRAS_VIOLACOES.map(([rotulo, erro]) => [op, rotulo, executar, erro] as const)),
  )("%s: %s -> erro original propagado, sem tradução", async (_op, _rotulo, executar, erro) => {
    await expect(executar(servicoQueFalhaCom(erro))).rejects.toBe(erro);
  });
});
