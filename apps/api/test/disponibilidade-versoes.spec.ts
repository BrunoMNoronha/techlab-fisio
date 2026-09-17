// TechLab Fisio — regra PURA de versões da disponibilidade (PRO-003;
// `docs/16` D-PRO3-03, regras 2–6). É o núcleo que decide o estado resultante
// do `PUT` e, por comparação, o no-op.
//
// Sem banco e sem mock: `estadoResultante` é função pura sobre a lista de
// versões lida SOB o lock. Os efeitos físicos correspondentes estão provados
// na suíte de integração.

import { describe, expect, it } from "@jest/globals";

import { estadoResultante, type VersaoDisponibilidadeProfissional } from "../src/profissional/disponibilidade.service.js";

const J = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });

const V = (
  vigenciaInicio: string,
  vigenciaFim: string | null,
  janelas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>,
): VersaoDisponibilidadeProfissional => ({ vigenciaInicio, vigenciaFim, janelas });

const MANHA = [J(1, "08:00", "12:00")];
const TARDE = [J(1, "13:00", "18:00")];

describe("D-PRO3-03 — estado resultante do PUT", () => {
  it("regra 4: sem versões, cria UMA versão aberta em D", () => {
    expect(estadoResultante([], "2026-10-01", MANHA)).toEqual([V("2026-10-01", null, MANHA)]);
  });

  it("regra 3: a versão aberta anterior é encerrada na VÉSPERA e a nova nasce aberta em D", () => {
    const vigentes = [V("2026-01-01", null, TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)).toEqual([
      V("2026-10-01", null, MANHA),
      V("2026-01-01", "2026-09-30", TARDE),
    ]);
  });

  it("regra 3: versão anterior com fim POSTERIOR a D também é encerrada na véspera", () => {
    const vigentes = [V("2026-01-01", "2026-12-31", TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)[1]).toEqual(V("2026-01-01", "2026-09-30", TARDE));
  });

  it("regra 2: versões com vigenciaInicio >= D são SUBSTITUÍDAS (somem do estado)", () => {
    const vigentes = [V("2026-11-01", null, TARDE), V("2026-10-01", "2026-10-31", TARDE), V("2026-01-01", "2026-09-30", MANHA)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)).toEqual([
      V("2026-10-01", null, MANHA),
      V("2026-01-01", "2026-09-30", MANHA),
    ]);
  });

  it("o PASSADO não é reescrito: versão inteiramente anterior a D fica intacta", () => {
    const vigentes = [V("2026-01-01", "2026-03-31", TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)).toEqual([
      V("2026-10-01", null, MANHA),
      V("2026-01-01", "2026-03-31", TARDE),
    ]);
  });

  it("regra 5: grade vazia encerra a anterior e NÃO cria versão nova", () => {
    const vigentes = [V("2026-01-01", null, TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", [])).toEqual([V("2026-01-01", "2026-09-30", TARDE)]);
  });

  it("regra 5: grade vazia sem nenhuma versão anterior resulta em estado VAZIO", () => {
    expect(estadoResultante([], "2026-10-01", [])).toEqual([]);
    expect(estadoResultante([V("2026-10-05", null, TARDE)], "2026-10-01", [])).toEqual([]);
  });

  it("regra 6: PUT idêntico ao estado vigente devolve exatamente o estado vigente", () => {
    const vigentes = [V("2026-10-01", null, MANHA), V("2026-01-01", "2026-09-30", TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)).toEqual(vigentes);
  });

  it("regra 6: grade vazia sobre um estado já encerrado na véspera é no-op", () => {
    const vigentes = [V("2026-01-01", "2026-09-30", TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", [])).toEqual(vigentes);
  });

  it("o resultado sai SEMPRE em vigenciaInicio decrescente — a nova versão é a primeira", () => {
    const vigentes = [V("2026-06-01", null, TARDE), V("2026-01-01", "2026-05-31", MANHA)];
    const r = estadoResultante(vigentes, "2026-10-01", MANHA);
    expect(r.map((v) => v.vigenciaInicio)).toEqual(["2026-10-01", "2026-06-01", "2026-01-01"]);
  });

  it("a véspera nunca fica antes do início da versão encerrada (coerência do CHECK físico)", () => {
    // Versão aberta iniciada EXATAMENTE na véspera de D: encerra no próprio dia.
    const vigentes = [V("2026-09-30", null, TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)[1]).toEqual(V("2026-09-30", "2026-09-30", TARDE));
  });

  it("uma versão iniciada no PRÓPRIO dia D é substituída, não encerrada", () => {
    const vigentes = [V("2026-10-01", null, TARDE)];
    expect(estadoResultante(vigentes, "2026-10-01", MANHA)).toEqual([V("2026-10-01", null, MANHA)]);
  });
});
