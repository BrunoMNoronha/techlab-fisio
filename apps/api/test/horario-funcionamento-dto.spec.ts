// TechLab Fisio — testes unitários da validação de `PUT /horario-funcionamento`
// (CFG-002; `docs/14` D-CFG-13, D-CFG-14, D-CFG-18).

import { describe, expect, it } from "@jest/globals";

import {
  LIMITES_HORARIO,
  validarCorpoGradeFuncionamento,
} from "../src/clinica/horario-funcionamento.dto.js";

const j = (diaSemana: unknown, horaInicio: unknown, horaFim: unknown) => ({ diaSemana, horaInicio, horaFim });

describe("CFG-002 — validarCorpoGradeFuncionamento", () => {
  it("aceita grade vazia (clínica fechada todos os dias — D-CFG-13)", () => {
    expect(validarCorpoGradeFuncionamento({ janelas: [] })).toEqual({ valido: true, valor: [] });
  });

  it("aceita turnos no mesmo dia e devolve a grade em ordem canônica (dia, início)", () => {
    const r = validarCorpoGradeFuncionamento({
      janelas: [j(2, "14:00", "18:00"), j(0, "08:00", "12:00"), j(2, "08:00", "12:00")],
    });
    expect(r).toEqual({
      valido: true,
      valor: [j(0, "08:00", "12:00"), j(2, "08:00", "12:00"), j(2, "14:00", "18:00")],
    });
  });

  it("aceita os extremos 00:00 e 23:59 e os dias 0 e 6", () => {
    expect(validarCorpoGradeFuncionamento({ janelas: [j(0, "00:00", "23:59"), j(6, "00:00", "00:01")] }).valido).toBe(true);
  });

  it(`aceita exatamente ${LIMITES_HORARIO.JANELAS_POR_DIA} janelas por dia`, () => {
    const janelas = [j(1, "06:00", "07:00"), j(1, "08:00", "09:00"), j(1, "10:00", "11:00"), j(1, "12:00", "13:00")];
    expect(validarCorpoGradeFuncionamento({ janelas }).valido).toBe(true);
  });

  const invalidos: Array<[string, unknown]> = [
    ["corpo não objeto", [j(1, "08:00", "12:00")]],
    ["corpo null", null],
    ["chave extra no corpo", { janelas: [], clinicaId: "x" }],
    ["sem janelas", {}],
    ["janelas não array", { janelas: {} }],
    ["janela com chave extra", { janelas: [{ ...j(1, "08:00", "12:00"), id: "x" }] }],
    ["janela com chave ausente", { janelas: [{ diaSemana: 1, horaInicio: "08:00" }] }],
    ["janela não objeto", { janelas: ["08:00-12:00"] }],
    ["diaSemana string (sem coerção)", { janelas: [j("1", "08:00", "12:00")] }],
    ["diaSemana fracionário", { janelas: [j(1.5, "08:00", "12:00")] }],
    ["diaSemana 7", { janelas: [j(7, "08:00", "12:00")] }],
    ["diaSemana negativo", { janelas: [j(-1, "08:00", "12:00")] }],
    ["hora com segundos", { janelas: [j(1, "08:00:00", "12:00")] }],
    ["hora sem zero à esquerda", { janelas: [j(1, "8:00", "12:00")] }],
    ["hora 24:00", { janelas: [j(1, "08:00", "24:00")] }],
    ["minuto 60", { janelas: [j(1, "08:60", "12:00")] }],
    ["hora com espaço", { janelas: [j(1, " 08:00", "12:00")] }],
    ["hora numérica", { janelas: [j(1, 800, "12:00")] }],
    ["fim igual ao início", { janelas: [j(1, "08:00", "08:00")] }],
    ["fim antes do início (cruza meia-noite — D-CFG-14)", { janelas: [j(1, "22:00", "02:00")] }],
    ["sobreposição no mesmo dia", { janelas: [j(1, "08:00", "12:00"), j(1, "11:00", "14:00")] }],
    ["janela contida em outra", { janelas: [j(1, "08:00", "18:00"), j(1, "09:00", "10:00")] }],
    ["janelas idênticas", { janelas: [j(1, "08:00", "12:00"), j(1, "08:00", "12:00")] }],
    ["adjacência no mesmo dia (D-CFG-13)", { janelas: [j(1, "08:00", "12:00"), j(1, "12:00", "14:00")] }],
    [
      "5 janelas no mesmo dia",
      { janelas: [j(1, "06:00", "07:00"), j(1, "08:00", "09:00"), j(1, "10:00", "11:00"), j(1, "12:00", "13:00"), j(1, "14:00", "15:00")] },
    ],
    ["mais de 28 janelas", { janelas: Array.from({ length: 29 }, (_, i) => j(i % 7, "08:00", "09:00")) }],
  ];

  it.each(invalidos)("%s -> inválido", (_rotulo, corpo) => {
    expect(validarCorpoGradeFuncionamento(corpo)).toEqual({ valido: false });
  });

  it("a mesma janela em dias diferentes não é sobreposição", () => {
    expect(validarCorpoGradeFuncionamento({ janelas: [j(1, "08:00", "12:00"), j(2, "08:00", "12:00")] }).valido).toBe(true);
  });
});
