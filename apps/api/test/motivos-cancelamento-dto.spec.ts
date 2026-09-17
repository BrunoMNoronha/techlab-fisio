// TechLab Fisio — testes unitários da validação dos motivos de cancelamento
// (CFG-005; `docs/14` D-CFG-48, D-CFG-49, D-CFG-54).

import { describe, expect, it } from "@jest/globals";

import {
  LIMITES_MOTIVO_CANCELAMENTO,
  validarCorpoMotivoCancelamento,
  validarCorpoSituacaoMotivoCancelamento,
  validarFiltroMotivosCancelamento,
} from "../src/motivos-cancelamento/motivos-cancelamento.dto.js";

function invalido(corpo: unknown): void {
  expect(validarCorpoMotivoCancelamento(corpo).valido).toBe(false);
}

const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const DEL = String.fromCharCode(0x7f);
const C1 = String.fromCharCode(0x85);

describe("D-CFG-48 / D-CFG-49 — corpo estrito de POST e PUT", () => {
  it("aceita exatamente descricao", () => {
    expect(validarCorpoMotivoCancelamento({ descricao: "Paciente desistiu" })).toEqual({
      valido: true,
      valor: { descricao: "Paciente desistiu" },
    });
  });

  it.each([null, undefined, "texto", 42, true, [], [{ descricao: "x" }]])("rejeita corpo não objeto: %p", (corpo) => {
    invalido(corpo);
  });

  it("rejeita objeto com protótipo não plano", () => {
    invalido(Object.assign(Object.create({ herdado: 1 }), { descricao: "Paciente desistiu" }));
  });

  it.each(["ativo", "id", "clinicaId", "inativadoEm", "nome"])("rejeita chave extra %s", (chave) => {
    invalido({ descricao: "Paciente desistiu", [chave]: chave === "ativo" ? true : "x" });
  });

  it("rejeita corpo vazio (chave ausente)", () => {
    invalido({});
  });
});

describe("D-CFG-49 — descrição", () => {
  it("aplica trim", () => {
    expect(validarCorpoMotivoCancelamento({ descricao: "   Paciente desistiu   " })).toEqual({
      valido: true,
      valor: { descricao: "Paciente desistiu" },
    });
  });

  it("preserva a caixa informada (sem normalização além do trim)", () => {
    expect(validarCorpoMotivoCancelamento({ descricao: "PACIENTE Desistiu" })).toEqual({
      valido: true,
      valor: { descricao: "PACIENTE Desistiu" },
    });
  });

  it("aceita 1 e 100 caracteres (code points, inclusive não BMP) e rejeita 101", () => {
    expect(validarCorpoMotivoCancelamento({ descricao: "a" }).valido).toBe(true);
    expect(validarCorpoMotivoCancelamento({ descricao: "a".repeat(LIMITES_MOTIVO_CANCELAMENTO.DESCRICAO) }).valido).toBe(true);
    expect(validarCorpoMotivoCancelamento({ descricao: "😀".repeat(LIMITES_MOTIVO_CANCELAMENTO.DESCRICAO) }).valido).toBe(true);
    invalido({ descricao: "a".repeat(LIMITES_MOTIVO_CANCELAMENTO.DESCRICAO + 1) });
    invalido({ descricao: "😀".repeat(LIMITES_MOTIVO_CANCELAMENTO.DESCRICAO + 1) });
  });

  it.each([
    ["vazia", ""],
    ["só espaços", "    "],
    ["NUL interno", `Paciente${NUL}desistiu`],
    ["TAB nas bordas", `${TAB}Paciente desistiu`],
    ["LF final", `Paciente desistiu${LF}`],
    ["DEL", `Paciente${DEL}`],
    ["C1", `Paciente${C1}`],
  ])("rejeita descrição %s", (_rotulo, descricao) => {
    invalido({ descricao });
  });

  it.each([null, 42, true, ["Paciente desistiu"], { valor: "Paciente desistiu" }])(
    "rejeita descrição não string: %p",
    (descricao) => {
      invalido({ descricao });
    },
  );
});

describe("D-CFG-49 — corpo de situação", () => {
  it.each([true, false])("aceita { ativo: %p }", (ativo) => {
    expect(validarCorpoSituacaoMotivoCancelamento({ ativo })).toEqual({ valido: true, valor: { ativo } });
  });

  it.each([
    {},
    { ativo: "true" },
    { ativo: 1 },
    { ativo: null },
    { ativo: true, descricao: "x" },
    [{ ativo: true }],
    null,
  ])("rejeita %p", (corpo) => {
    expect(validarCorpoSituacaoMotivoCancelamento(corpo).valido).toBe(false);
  });
});

describe("D-CFG-54 — filtro da listagem", () => {
  it("sem query ou query vazia -> sem filtro", () => {
    expect(validarFiltroMotivosCancelamento(undefined)).toEqual({ valido: true, valor: null });
    expect(validarFiltroMotivosCancelamento({})).toEqual({ valido: true, valor: null });
    expect(validarFiltroMotivosCancelamento(Object.create(null))).toEqual({ valido: true, valor: null });
  });

  it("ativo=true|false", () => {
    expect(validarFiltroMotivosCancelamento({ ativo: "true" })).toEqual({ valido: true, valor: true });
    expect(validarFiltroMotivosCancelamento({ ativo: "false" })).toEqual({ valido: true, valor: false });
  });

  it.each([
    { ativo: "TRUE" },
    { ativo: "1" },
    { ativo: "" },
    { ativo: ["true", "false"] },
    { ativo: "true", pagina: "1" },
    { descricao: "x" },
  ])("rejeita %p", (query) => {
    expect(validarFiltroMotivosCancelamento(query).valido).toBe(false);
  });
});
