// TechLab Fisio — testes unitários da validação do cadastro de profissionais
// (fatia PRO-A; `docs/18` D-PRO1-02, D-PRO1-03, D-PRO1-05, D-PRO1-06).

import { describe, expect, it } from "@jest/globals";

import {
  LIMITES_PROFISSIONAL,
  validarCorpoProfissional,
  validarCorpoServicosProfissional,
  validarCorpoSituacaoProfissional,
  validarFiltroProfissionais,
} from "../src/profissional/profissionais.dto.js";

const UUID_A = "0191f5a0-0000-7000-8000-00000000000a";
const UUID_B = "0191f5a0-0000-7000-8000-00000000000b";

function corpoValido(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return { nome: "Ana Souza", registroProfissional: "CREFITO-0 000000-F", usuarioId: UUID_A, ...sobrescrever };
}

function invalido(corpo: unknown): void {
  expect(validarCorpoProfissional(corpo).valido).toBe(false);
}

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const C1 = String.fromCharCode(0x85);

describe("D-PRO1-02 — corpo estrito de POST e PUT", () => {
  it("aceita exatamente nome, registroProfissional e usuarioId", () => {
    expect(validarCorpoProfissional(corpoValido())).toEqual({ valido: true, valor: corpoValido() });
  });

  it("aceita registroProfissional e usuarioId nulos", () => {
    expect(validarCorpoProfissional(corpoValido({ registroProfissional: null, usuarioId: null }))).toEqual({
      valido: true,
      valor: { nome: "Ana Souza", registroProfissional: null, usuarioId: null },
    });
  });

  it.each([null, undefined, "texto", 42, [], [corpoValido()]])("rejeita corpo não objeto: %p", (corpo) => {
    invalido(corpo);
  });

  it("rejeita objeto com protótipo não plano", () => {
    invalido(Object.assign(Object.create({ herdado: 1 }), corpoValido()));
  });

  it.each(["ativo", "id", "inativadoEm", "especialidades", "email"])("rejeita chave extra %s", (chave) => {
    invalido(corpoValido({ [chave]: chave === "ativo" ? true : "x" }));
  });

  it.each(["nome", "registroProfissional", "usuarioId"])("rejeita chave ausente %s (null precisa ser explícito)", (chave) => {
    const corpo = corpoValido();
    delete corpo[chave];
    invalido(corpo);
  });
});

describe("D-PRO1-03 — nome e registro", () => {
  it("aplica trim nos dois campos", () => {
    const r = validarCorpoProfissional(corpoValido({ nome: "  Ana  ", registroProfissional: "  12345  " }));
    expect(r).toEqual({ valido: true, valor: corpoValido({ nome: "Ana", registroProfissional: "12345" }) });
  });

  it("limites: nome 200 e registro 50 code points", () => {
    expect(LIMITES_PROFISSIONAL.NOME).toBe(200);
    expect(LIMITES_PROFISSIONAL.REGISTRO).toBe(50);
    expect(validarCorpoProfissional(corpoValido({ nome: "😀".repeat(200) })).valido).toBe(true);
    invalido(corpoValido({ nome: "a".repeat(201) }));
    expect(validarCorpoProfissional(corpoValido({ registroProfissional: "😀".repeat(50) })).valido).toBe(true);
    invalido(corpoValido({ registroProfissional: "a".repeat(51) }));
  });

  it.each([
    ["nome vazio", { nome: "   " }],
    ["nome com NUL", { nome: `Ana${NUL}` }],
    ["nome com TAB", { nome: `${TAB}Ana` }],
    ["nome com C1", { nome: `Ana${C1}` }],
    ["nome null", { nome: null }],
    ["nome number", { nome: 1 }],
    ["registro vazio após trim (não vira null)", { registroProfissional: "   " }],
    ["registro com LF", { registroProfissional: `123${LF}` }],
    ["registro number", { registroProfissional: 123 }],
  ])("rejeita %s", (_rotulo, sobrescrever) => {
    invalido(corpoValido(sobrescrever));
  });
});

describe("D-PRO1-04 — usuarioId", () => {
  it("normaliza UUID em maiúsculas para minúsculas", () => {
    const r = validarCorpoProfissional(corpoValido({ usuarioId: UUID_A.toUpperCase() }));
    expect(r).toEqual({ valido: true, valor: corpoValido({ usuarioId: UUID_A }) });
  });

  it.each(["nao-uuid", "", 123, true, [UUID_A], { id: UUID_A }])("rejeita %p", (usuarioId) => {
    invalido(corpoValido({ usuarioId }));
  });
});

describe("D-PRO1-06 — corpo de situação", () => {
  it.each([true, false])("aceita { ativo: %p }", (ativo) => {
    expect(validarCorpoSituacaoProfissional({ ativo })).toEqual({ valido: true, valor: { ativo } });
  });

  it.each([{}, { ativo: "true" }, { ativo: 0 }, { ativo: null }, { ativo: true, nome: "x" }, null])("rejeita %p", (corpo) => {
    expect(validarCorpoSituacaoProfissional(corpo).valido).toBe(false);
  });
});

describe("D-PRO1-05 — corpo de serviços", () => {
  it("aceita lista vazia e lista de UUIDs, normalizando a caixa", () => {
    expect(validarCorpoServicosProfissional({ servicoIds: [] })).toEqual({ valido: true, valor: [] });
    expect(validarCorpoServicosProfissional({ servicoIds: [UUID_A, UUID_B.toUpperCase()] })).toEqual({
      valido: true,
      valor: [UUID_A, UUID_B],
    });
  });

  it("aceita 200 itens e rejeita 201", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `0191f5a0-0000-7000-8000-${i.toString(16).padStart(12, "0")}`);
    expect(validarCorpoServicosProfissional({ servicoIds: ids(200) }).valido).toBe(true);
    expect(validarCorpoServicosProfissional({ servicoIds: ids(201) }).valido).toBe(false);
  });

  it.each([
    ["duplicata exata", { servicoIds: [UUID_A, UUID_A] }],
    ["duplicata só de caixa", { servicoIds: [UUID_A, UUID_A.toUpperCase()] }],
    ["item não UUID", { servicoIds: ["x"] }],
    ["item null", { servicoIds: [null] }],
    ["não array", { servicoIds: UUID_A }],
    ["chave extra", { servicoIds: [], ativo: true }],
    ["chave ausente", {}],
    ["corpo array", [UUID_A]],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoServicosProfissional(corpo).valido).toBe(false);
  });
});

describe("filtro da listagem", () => {
  it("sem query -> sem filtro; ativo=true|false", () => {
    expect(validarFiltroProfissionais(undefined)).toEqual({ valido: true, valor: null });
    expect(validarFiltroProfissionais({})).toEqual({ valido: true, valor: null });
    expect(validarFiltroProfissionais({ ativo: "true" })).toEqual({ valido: true, valor: true });
    expect(validarFiltroProfissionais({ ativo: "false" })).toEqual({ valido: true, valor: false });
  });

  it.each([{ ativo: "1" }, { ativo: ["true", "false"] }, { nome: "x" }, { ativo: "true", pagina: "1" }])("rejeita %p", (q) => {
    expect(validarFiltroProfissionais(q).valido).toBe(false);
  });
});
