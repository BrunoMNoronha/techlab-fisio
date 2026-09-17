// TechLab Fisio — testes unitários da validação das formas de pagamento
// (CFG-004; `docs/14` D-CFG-36, D-CFG-37, D-CFG-38, D-CFG-42).

import { describe, expect, it } from "@jest/globals";

import {
  LIMITE_DESCRICAO_FORMA_PAGAMENTO,
  validarCorpoFormaPagamento,
  validarCorpoSituacaoFormaPagamento,
  validarFiltroFormasPagamento,
} from "../src/formas-pagamento/formas-pagamento.dto.js";

function invalido(corpo: unknown): void {
  expect(validarCorpoFormaPagamento(corpo).valido).toBe(false);
}

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const DEL = String.fromCharCode(0x7f);
const C1 = String.fromCharCode(0x85);

describe("D-CFG-36 / D-CFG-37 — corpo estrito de POST e PUT", () => {
  it("aceita exatamente { descricao }", () => {
    expect(validarCorpoFormaPagamento({ descricao: "PIX" })).toEqual({ valido: true, valor: { descricao: "PIX" } });
  });

  it.each([null, undefined, "texto", 42, true, [], [{ descricao: "PIX" }]])("rejeita corpo não objeto: %p", (corpo) => {
    invalido(corpo);
  });

  it("rejeita objeto com protótipo não plano", () => {
    invalido(Object.assign(Object.create({ herdado: 1 }), { descricao: "PIX" }));
  });

  it.each(["ativo", "id", "clinicaId", "inativadoEm", "tipo", "nome"])("rejeita chave extra %s", (chave) => {
    invalido({ descricao: "PIX", [chave]: chave === "ativo" ? true : "x" });
  });

  it("rejeita corpo vazio (chave ausente)", () => {
    invalido({});
  });
});

describe("D-CFG-38 — descrição", () => {
  it("aplica trim", () => {
    expect(validarCorpoFormaPagamento({ descricao: "   Cartão de crédito   " })).toEqual({
      valido: true,
      valor: { descricao: "Cartão de crédito" },
    });
  });

  it("aceita 100 caracteres (code points, inclusive não BMP) e rejeita 101", () => {
    expect(LIMITE_DESCRICAO_FORMA_PAGAMENTO).toBe(100);
    expect(validarCorpoFormaPagamento({ descricao: "a".repeat(100) }).valido).toBe(true);
    expect(validarCorpoFormaPagamento({ descricao: "😀".repeat(100) }).valido).toBe(true);
    invalido({ descricao: "a".repeat(101) });
    invalido({ descricao: "😀".repeat(101) });
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "    "],
    ["NUL interno", `Car${NUL}tão`],
    ["TAB nas bordas", `${TAB}PIX`],
    ["LF final", `PIX${LF}`],
    ["DEL", `PIX${DEL}`],
    ["C1", `PIX${C1}`],
  ])("rejeita descrição %s", (_rotulo, descricao) => {
    invalido({ descricao });
  });

  it.each([null, 42, true, ["PIX"], { valor: "PIX" }])("rejeita descrição não string: %p", (descricao) => {
    invalido({ descricao });
  });
});

describe("D-CFG-37 — corpo de situação", () => {
  it.each([true, false])("aceita { ativo: %p }", (ativo) => {
    expect(validarCorpoSituacaoFormaPagamento({ ativo })).toEqual({ valido: true, valor: { ativo } });
  });

  it.each([{}, { ativo: "true" }, { ativo: 1 }, { ativo: null }, { ativo: true, descricao: "x" }, [{ ativo: true }], null])(
    "rejeita %p",
    (corpo) => {
      expect(validarCorpoSituacaoFormaPagamento(corpo).valido).toBe(false);
    },
  );
});

describe("D-CFG-42 — filtro da listagem", () => {
  it("sem query ou query vazia -> sem filtro", () => {
    expect(validarFiltroFormasPagamento(undefined)).toEqual({ valido: true, valor: null });
    expect(validarFiltroFormasPagamento({})).toEqual({ valido: true, valor: null });
    expect(validarFiltroFormasPagamento(Object.create(null))).toEqual({ valido: true, valor: null });
  });

  it("ativo=true|false", () => {
    expect(validarFiltroFormasPagamento({ ativo: "true" })).toEqual({ valido: true, valor: true });
    expect(validarFiltroFormasPagamento({ ativo: "false" })).toEqual({ valido: true, valor: false });
  });

  it.each([{ ativo: "TRUE" }, { ativo: "1" }, { ativo: "" }, { ativo: ["true", "false"] }, { ativo: "true", pagina: "1" }, { descricao: "x" }])(
    "rejeita %p",
    (query) => {
      expect(validarFiltroFormasPagamento(query).valido).toBe(false);
    },
  );
});
