// TechLab Fisio — validação pura do contrato da disponibilidade do
// profissional (PRO-003; `docs/16` D-PRO3-01 invariante 3, D-PRO3-02; matriz
// TD-06).
//
// Corpo estrito, sem coerção: chave extra, chave faltante, tipo errado e
// prototype poluído são rejeitados ANTES de qualquer acesso ao banco.

import { describe, expect, it } from "@jest/globals";

import {
  CHAVES_CORPO_DISPONIBILIDADE,
  deslocarDataCivil,
  ehDataCivilValida,
  ERRO_DISPONIBILIDADE,
  validarCorpoDisponibilidade,
} from "../src/profissional/disponibilidade.dto.js";

const J = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });
const corpo = (janelas: unknown[], vigenciaInicio = "2026-10-01") => ({ vigenciaInicio, janelas });

describe("PRO-003 — contrato do PUT de disponibilidade (D-PRO3-02)", () => {
  it("as chaves aceitas são EXATAMENTE vigenciaInicio e janelas", () => {
    expect([...CHAVES_CORPO_DISPONIBILIDADE].sort()).toEqual(["janelas", "vigenciaInicio"]);
  });

  it("o código de erro próprio da fatia é VIGENCIA_RETROATIVA e só ele", () => {
    expect(Object.values(ERRO_DISPONIBILIDADE)).toEqual(["VIGENCIA_RETROATIVA"]);
  });

  it("aceita uma grade válida e devolve as janelas em ordem canônica", () => {
    const r = validarCorpoDisponibilidade(corpo([J(3, "09:00", "17:30"), J(1, "13:00", "18:00"), J(1, "08:00", "12:00")]));
    expect(r.valido).toBe(true);
    if (!r.valido) return;
    expect(r.valor.vigenciaInicio).toBe("2026-10-01");
    expect(r.valor.janelas).toEqual([J(1, "08:00", "12:00"), J(1, "13:00", "18:00"), J(3, "09:00", "17:30")]);
  });

  it("a ORDEM do pedido não afeta a validade — a mesma grade embaralhada é aceita igual", () => {
    const a = validarCorpoDisponibilidade(corpo([J(1, "08:00", "12:00"), J(0, "07:00", "08:00")]));
    const b = validarCorpoDisponibilidade(corpo([J(0, "07:00", "08:00"), J(1, "08:00", "12:00")]));
    expect(a.valido && b.valido).toBe(true);
    if (!a.valido || !b.valido) return;
    expect(a.valor.janelas).toEqual(b.valor.janelas);
  });

  it("aceita janelas vazias — encerramento sem nova versão (D-PRO3-03, regra 5)", () => {
    const r = validarCorpoDisponibilidade(corpo([]));
    expect(r.valido).toBe(true);
    if (!r.valido) return;
    expect(r.valor.janelas).toEqual([]);
  });

  it("aceita 00:00 como início e 23:59 como fim", () => {
    expect(validarCorpoDisponibilidade(corpo([J(2, "00:00", "23:59")])).valido).toBe(true);
  });

  it("aceita exatamente 4 janelas no mesmo dia e rejeita a quinta", () => {
    const quatro = [J(1, "08:00", "09:00"), J(1, "10:00", "11:00"), J(1, "12:00", "13:00"), J(1, "14:00", "15:00")];
    expect(validarCorpoDisponibilidade(corpo(quatro)).valido).toBe(true);
    expect(validarCorpoDisponibilidade(corpo([...quatro, J(1, "16:00", "17:00")])).valido).toBe(false);
  });

  it("dias diferentes com os mesmos horários são aceitos", () => {
    expect(validarCorpoDisponibilidade(corpo([J(1, "08:00", "12:00"), J(2, "08:00", "12:00")])).valido).toBe(true);
  });

  it.each([
    ["sobreposição no mesmo dia", [J(1, "08:00", "12:00"), J(1, "11:00", "13:00")]],
    ["adjacência no mesmo dia", [J(1, "08:00", "12:00"), J(1, "12:00", "14:00")]],
    ["janela duplicada", [J(1, "08:00", "12:00"), J(1, "08:00", "12:00")]],
    ["24:00 como fim", [J(1, "08:00", "24:00")]],
    ["segundos no horário", [J(1, "08:00:00", "12:00:00")]],
    ["atravessa a meia-noite", [J(1, "22:00", "02:00")]],
    ["fim igual ao início", [J(1, "08:00", "08:00")]],
    ["diaSemana 7", [J(7, "08:00", "12:00")]],
    ["diaSemana -1", [J(-1, "08:00", "12:00")]],
    ["diaSemana fracionário", [J(1.5, "08:00", "12:00")]],
    ["diaSemana como string", [{ diaSemana: "1", horaInicio: "08:00", horaFim: "12:00" }]],
    ["chave extra na janela", [{ ...J(1, "08:00", "12:00"), observacao: "x" }]],
    ["chave faltante na janela", [{ diaSemana: 1, horaInicio: "08:00" }]],
    ["hora com espaço", [J(1, " 08:00", "12:00")]],
  ] as Array<[string, unknown[]]>)("rejeita %s", (_titulo, janelas) => {
    expect(validarCorpoDisponibilidade(corpo(janelas)).valido).toBe(false);
  });

  it.each([
    ["corpo não objeto (string)", "x"],
    ["corpo nulo", null],
    ["corpo array", []],
    ["chave extra no corpo", { vigenciaInicio: "2026-10-01", janelas: [], extra: 1 }],
    ["sem vigenciaInicio", { janelas: [] }],
    ["sem janelas", { vigenciaInicio: "2026-10-01" }],
    ["janelas não array", { vigenciaInicio: "2026-10-01", janelas: {} }],
    ["janelas nulo", { vigenciaInicio: "2026-10-01", janelas: null }],
    ["vigenciaInicio nula", { vigenciaInicio: null, janelas: [] }],
    ["vigenciaInicio numérica", { vigenciaInicio: 20261001, janelas: [] }],
    ["vigenciaInicio com instante", { vigenciaInicio: "2026-10-01T00:00:00Z", janelas: [] }],
    ["vigenciaInicio sem zero à esquerda", { vigenciaInicio: "2026-1-01", janelas: [] }],
  ] as Array<[string, unknown]>)("rejeita %s", (_titulo, corpoInvalido) => {
    expect(validarCorpoDisponibilidade(corpoInvalido).valido).toBe(false);
  });
});

describe("PRO-003 — data civil gregoriana real (D-PRO3-02)", () => {
  it.each(["2026-10-01", "2026-01-31", "2026-12-31", "2028-02-29", "2000-02-29"])("aceita %s", (data) => {
    expect(ehDataCivilValida(data)).toBe(true);
    expect(validarCorpoDisponibilidade({ vigenciaInicio: data, janelas: [] }).valido).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2026-02-29",
    "2027-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-10-00",
    "2026-10-32",
    "26-10-01",
    "2026/10/01",
  ])("rejeita %s", (data) => {
    expect(ehDataCivilValida(data)).toBe(false);
    expect(validarCorpoDisponibilidade({ vigenciaInicio: data, janelas: [] }).valido).toBe(false);
  });
});

describe("PRO-003 — deslocamento de data civil (véspera de D-PRO3-03, regra 3)", () => {
  it.each([
    ["2026-10-01", "2026-09-30"],
    ["2026-01-01", "2025-12-31"],
    ["2026-03-01", "2026-02-28"],
    ["2028-03-01", "2028-02-29"],
  ])("a véspera de %s é %s", (data, esperada) => {
    expect(deslocarDataCivil(data, -1)).toBe(esperada);
  });

  it("não depende do fuso do processo — é aritmética de calendário", () => {
    // Um `Date` local levaria 2026-01-01 para 2025-12-31 ou 2026-01-01
    // conforme o offset. Aqui o resultado é sempre o mesmo.
    expect(deslocarDataCivil("2026-01-01", 0)).toBe("2026-01-01");
    expect(deslocarDataCivil("2026-12-31", 1)).toBe("2027-01-01");
  });
});
