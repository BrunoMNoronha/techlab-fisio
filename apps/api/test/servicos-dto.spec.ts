// TechLab Fisio — testes unitários da validação do catálogo de serviços
// (CFG-003; `docs/14` D-CFG-24, D-CFG-25, D-CFG-26, D-CFG-27, D-CFG-28).

import { describe, expect, it } from "@jest/globals";

import {
  LIMITES_SERVICO,
  validarCorpoServico,
  validarCorpoSituacaoServico,
  validarFiltroServicos,
} from "../src/servicos/servicos.dto.js";

function corpoValido(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return { nome: "Fisioterapia ortopédica", duracaoMin: 50, precoReferencia: "150.00", ...sobrescrever };
}

function invalido(corpo: unknown): void {
  expect(validarCorpoServico(corpo).valido).toBe(false);
}

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const DEL = String.fromCharCode(0x7f);
const C1 = String.fromCharCode(0x85);

describe("D-CFG-24 / D-CFG-26 — corpo estrito de POST e PUT", () => {
  it("aceita exatamente nome, duracaoMin e precoReferencia", () => {
    expect(validarCorpoServico(corpoValido())).toEqual({ valido: true, valor: corpoValido() });
  });

  it.each([null, undefined, "texto", 42, true, [], [corpoValido()]])("rejeita corpo não objeto: %p", (corpo) => {
    invalido(corpo);
  });

  it("rejeita objeto com protótipo não plano", () => {
    invalido(Object.assign(Object.create({ herdado: 1 }), corpoValido()));
  });

  it.each(["ativo", "id", "clinicaId", "inativadoEm", "descricao"])("rejeita chave extra %s", (chave) => {
    invalido(corpoValido({ [chave]: chave === "ativo" ? true : "x" }));
  });

  it.each(["nome", "duracaoMin", "precoReferencia"])("rejeita chave ausente %s", (chave) => {
    const corpo = corpoValido();
    delete corpo[chave];
    invalido(corpo);
  });
});

describe("D-CFG-27 — nome", () => {
  it("aplica trim", () => {
    const r = validarCorpoServico(corpoValido({ nome: "   Pilates   " }));
    expect(r).toEqual({ valido: true, valor: corpoValido({ nome: "Pilates" }) });
  });

  it("aceita 200 caracteres (code points, inclusive não BMP) e rejeita 201", () => {
    expect(validarCorpoServico(corpoValido({ nome: "a".repeat(LIMITES_SERVICO.NOME) })).valido).toBe(true);
    expect(validarCorpoServico(corpoValido({ nome: "😀".repeat(LIMITES_SERVICO.NOME) })).valido).toBe(true);
    invalido(corpoValido({ nome: "a".repeat(LIMITES_SERVICO.NOME + 1) }));
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "    "],
    ["NUL interno", `Fisio${NUL}terapia`],
    ["TAB nas bordas", `${TAB}Fisioterapia`],
    ["LF final", `Fisioterapia${LF}`],
    ["DEL", `Fisio${DEL}`],
    ["C1", `Fisio${C1}`],
  ])("rejeita nome %s", (_rotulo, nome) => {
    invalido(corpoValido({ nome }));
  });

  it.each([null, 42, true, ["Fisioterapia"], { valor: "Fisioterapia" }])("rejeita nome não string: %p", (nome) => {
    invalido(corpoValido({ nome }));
  });
});

describe("D-CFG-27 — duração", () => {
  it.each([1, 50, 1440])("aceita %p", (duracaoMin) => {
    expect(validarCorpoServico(corpoValido({ duracaoMin })).valido).toBe(true);
  });

  it.each([0, -1, 1441, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "50", null, true, [50]])("rejeita %p", (duracaoMin) => {
    invalido(corpoValido({ duracaoMin }));
  });
});

describe("D-CFG-27 — preço de referência", () => {
  it.each(["0.00", "0.01", "150.00", "9999999999.99"])("aceita %p", (precoReferencia) => {
    expect(validarCorpoServico(corpoValido({ precoReferencia })).valido).toBe(true);
  });

  it.each([
    "-1.00",
    "-0.00",
    "150",
    "150.0",
    "150.000",
    "01.00",
    "1e2",
    "150,00",
    " 150.00",
    "10000000000.00",
    "",
    150,
    150.5,
    null,
  ])("rejeita %p", (precoReferencia) => {
    invalido(corpoValido({ precoReferencia }));
  });
});

describe("D-CFG-25 — corpo de situação", () => {
  it.each([true, false])("aceita { ativo: %p }", (ativo) => {
    expect(validarCorpoSituacaoServico({ ativo })).toEqual({ valido: true, valor: { ativo } });
  });

  it.each([
    {},
    { ativo: "true" },
    { ativo: 1 },
    { ativo: null },
    { ativo: true, nome: "x" },
    [{ ativo: true }],
    null,
  ])("rejeita %p", (corpo) => {
    expect(validarCorpoSituacaoServico(corpo).valido).toBe(false);
  });
});

describe("D-CFG-28 — filtro da listagem", () => {
  it("sem query ou query vazia -> sem filtro", () => {
    expect(validarFiltroServicos(undefined)).toEqual({ valido: true, valor: null });
    expect(validarFiltroServicos({})).toEqual({ valido: true, valor: null });
    expect(validarFiltroServicos(Object.create(null))).toEqual({ valido: true, valor: null });
  });

  it("ativo=true|false", () => {
    expect(validarFiltroServicos({ ativo: "true" })).toEqual({ valido: true, valor: true });
    expect(validarFiltroServicos({ ativo: "false" })).toEqual({ valido: true, valor: false });
  });

  it.each([
    { ativo: "TRUE" },
    { ativo: "1" },
    { ativo: "" },
    { ativo: ["true", "false"] },
    { ativo: "true", pagina: "1" },
    { nome: "x" },
  ])("rejeita %p", (query) => {
    expect(validarFiltroServicos(query).valido).toBe(false);
  });
});
