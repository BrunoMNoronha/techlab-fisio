// TechLab Fisio — testes unitários de RN-014, parcela da clínica
// (`docs/14` D-CFG-60, D-CFG-61; cenários CH-AG-01..CH-AG-09 de §3.14.11).
//
// Datas de referência: 2026-09-21 é segunda-feira. `America/Sao_Paulo` = UTC-03
// (sem horário de verão). Horário de verão exercitado com `America/New_York`
// (início em 2026-03-08, 02:00 EST -> 03:00 EDT).

import { describe, expect, it } from "@jest/globals";

import {
  avaliarHorarioFuncionamento,
  paraInstanteLocal,
  type JanelaGrade,
} from "../src/agenda/horario-funcionamento.regra.js";

const SP = "America/Sao_Paulo";
const j = (diaSemana: number, horaInicio: string, horaFim: string): JanelaGrade => ({ diaSemana, horaInicio, horaFim });
const utc = (iso: string) => new Date(iso);

/** Segunda 08:00–18:00. */
const GRADE_CHEIA = [j(1, "08:00", "18:00")];
/** Segunda 08:00–12:00 + 14:00–18:00. */
const GRADE_ALMOCO = [j(1, "08:00", "12:00"), j(1, "14:00", "18:00")];

/** Intervalo local de segunda 2026-09-21 em São Paulo (UTC-03). */
function segundaSP(inicio: string, fim: string) {
  return { inicio: utc(`2026-09-21T${inicio}-03:00`), fim: utc(`2026-09-21T${fim}-03:00`) };
}

function avaliar(intervalo: { inicio: Date; fim: Date }, janelas: readonly JanelaGrade[], fusoHorario = SP) {
  return avaliarHorarioFuncionamento({ ...intervalo, fusoHorario, janelas });
}

describe("RN-014 / D-CFG-60 — conversão para hora de parede", () => {
  it("usa data, dia da semana e hora local do fuso, não do UTC", () => {
    // 2026-09-22T01:30Z = segunda 21/09 22:30 em São Paulo (terça em UTC).
    const l = paraInstanteLocal(utc("2026-09-22T01:30:15.250Z"), SP);
    expect(l.data).toBe("2026-09-21");
    expect(l.diaSemana).toBe(1);
    expect(l.msDoDia).toBe(((22 * 60 + 30) * 60 + 15) * 1000 + 250);
  });

  it("fuso desconhecido é falha técnica (RangeError)", () => {
    expect(() => avaliar(segundaSP("09:00", "10:00"), GRADE_CHEIA, "Fuso/Inexistente")).toThrow(RangeError);
  });
});

describe("RN-014 / D-CFG-61 — predicado de contenção", () => {
  it("CH-AG-01 — totalmente dentro da janela: conforme", () => {
    expect(avaliar(segundaSP("09:00", "10:00"), GRADE_CHEIA)).toEqual({ conforme: true });
  });

  it("CH-AG-02 — início antes da abertura: FORA_DAS_JANELAS", () => {
    expect(avaliar(segundaSP("07:30", "08:30"), GRADE_CHEIA)).toEqual({ conforme: false, motivo: "FORA_DAS_JANELAS" });
  });

  it("CH-AG-03 — fim depois do fechamento: FORA_DAS_JANELAS", () => {
    expect(avaliar(segundaSP("17:30", "18:30"), GRADE_CHEIA)).toEqual({ conforme: false, motivo: "FORA_DAS_JANELAS" });
  });

  it("CH-AG-04 — atravessa fechamento intermediário: nunca soma janelas", () => {
    expect(avaliar(segundaSP("11:30", "12:30"), GRADE_ALMOCO)).toEqual({ conforme: false, motivo: "FORA_DAS_JANELAS" });
    expect(avaliar(segundaSP("11:00", "15:00"), GRADE_ALMOCO)).toEqual({ conforme: false, motivo: "FORA_DAS_JANELAS" });
    expect(avaliar(segundaSP("14:00", "15:00"), GRADE_ALMOCO)).toEqual({ conforme: true });
  });

  it("CH-AG-05 — início exatamente na abertura: conforme", () => {
    expect(avaliar(segundaSP("08:00", "09:00"), GRADE_CHEIA)).toEqual({ conforme: true });
  });

  it("CH-AG-06 — fim exatamente no fechamento (intervalo semiaberto): conforme", () => {
    expect(avaliar(segundaSP("17:00", "18:00"), GRADE_CHEIA)).toEqual({ conforme: true });
    expect(avaliar(segundaSP("08:00", "18:00"), GRADE_CHEIA)).toEqual({ conforme: true });
  });

  it("borda com precisão integral do instante (milissegundos)", () => {
    expect(avaliar({ inicio: utc("2026-09-21T10:59:59.999Z"), fim: utc("2026-09-21T12:00:00Z") }, GRADE_CHEIA)).toEqual({
      conforme: false,
      motivo: "FORA_DAS_JANELAS",
    });
    expect(avaliar({ inicio: utc("2026-09-21T20:00:00Z"), fim: utc("2026-09-21T21:00:00.001Z") }, GRADE_CHEIA)).toEqual({
      conforme: false,
      motivo: "FORA_DAS_JANELAS",
    });
  });

  it("CH-AG-07 — dia sem janela e grade vazia: DIA_SEM_JANELA", () => {
    expect(avaliar(segundaSP("09:00", "10:00"), [j(2, "08:00", "18:00")])).toEqual({
      conforme: false,
      motivo: "DIA_SEM_JANELA",
    });
    expect(avaliar(segundaSP("09:00", "10:00"), [])).toEqual({ conforme: false, motivo: "DIA_SEM_JANELA" });
  });

  it("CH-AG-08 — atravessa a meia-noite local: ATRAVESSA_MEIA_NOITE_LOCAL", () => {
    const intervalo = { inicio: utc("2026-09-21T23:30:00-03:00"), fim: utc("2026-09-22T00:30:00-03:00") };
    expect(avaliar(intervalo, [j(1, "00:00", "23:59"), j(2, "00:00", "23:59")])).toEqual({
      conforme: false,
      motivo: "ATRAVESSA_MEIA_NOITE_LOCAL",
    });
  });

  it("fim exatamente à meia-noite local seguinte é rejeitado (fim máximo da grade é 23:59 — D-CFG-59)", () => {
    const intervalo = { inicio: utc("2026-09-21T23:00:00-03:00"), fim: utc("2026-09-22T00:00:00-03:00") };
    expect(avaliar(intervalo, [j(1, "00:00", "23:59")]).conforme).toBe(false);
  });

  it("CH-AG-09 — avalia pelo dia local, não pelo dia UTC", () => {
    // Segunda 21:00–22:00 em SP = terça 00:00–01:00 em UTC.
    const intervalo = { inicio: utc("2026-09-22T00:00:00Z"), fim: utc("2026-09-22T01:00:00Z") };
    expect(avaliar(intervalo, [j(1, "20:00", "23:00")])).toEqual({ conforme: true });
    expect(avaliar(intervalo, [j(2, "00:00", "02:00")])).toEqual({ conforme: false, motivo: "DIA_SEM_JANELA" });
  });

  it("mesmo instante UTC muda de resultado com o fuso (troca de fuso — D-CFG-63)", () => {
    // 2026-09-21T11:30Z: 08:30 em São Paulo; 07:30 em Manaus (UTC-04).
    const intervalo = { inicio: utc("2026-09-21T11:30:00Z"), fim: utc("2026-09-21T12:30:00Z") };
    expect(avaliar(intervalo, GRADE_CHEIA, SP)).toEqual({ conforme: true });
    expect(avaliar(intervalo, GRADE_CHEIA, "America/Manaus")).toEqual({ conforme: false, motivo: "FORA_DAS_JANELAS" });
  });

  it("horário de verão: compara hora de parede antes e depois da transição", () => {
    const NY = "America/New_York";
    const manha = [j(1, "08:00", "12:00"), j(5, "08:00", "12:00")];
    // Sexta 2026-03-06 09:00 EST = 14:00Z; segunda 2026-03-09 09:00 EDT = 13:00Z.
    expect(avaliar({ inicio: utc("2026-03-06T14:00:00Z"), fim: utc("2026-03-06T15:00:00Z") }, manha, NY)).toEqual({ conforme: true });
    expect(avaliar({ inicio: utc("2026-03-09T13:00:00Z"), fim: utc("2026-03-09T14:00:00Z") }, manha, NY)).toEqual({ conforme: true });
    // Segunda 2026-03-09 11:30Z = 07:30 EDT (com offset EST fixo seria 06:30): fora nos dois casos, avaliado em EDT.
    expect(avaliar({ inicio: utc("2026-03-09T11:30:00Z"), fim: utc("2026-03-09T12:30:00Z") }, manha, NY)).toEqual({
      conforme: false,
      motivo: "FORA_DAS_JANELAS",
    });
    // Domingo da transição: 01:30 EST (06:30Z) até 03:30 EDT (07:30Z) — uma hora real.
    expect(avaliar({ inicio: utc("2026-03-08T06:30:00Z"), fim: utc("2026-03-08T07:30:00Z") }, [j(0, "01:00", "04:00")], NY)).toEqual({
      conforme: true,
    });
  });

  it("intervalo vazio, invertido ou com data inválida: INTERVALO_INVALIDO", () => {
    const i = utc("2026-09-21T12:00:00Z");
    expect(avaliar({ inicio: i, fim: i }, GRADE_CHEIA)).toEqual({ conforme: false, motivo: "INTERVALO_INVALIDO" });
    expect(avaliar({ inicio: i, fim: utc("2026-09-21T11:00:00Z") }, GRADE_CHEIA)).toEqual({ conforme: false, motivo: "INTERVALO_INVALIDO" });
    expect(avaliar({ inicio: new Date(Number.NaN), fim: i }, GRADE_CHEIA)).toEqual({ conforme: false, motivo: "INTERVALO_INVALIDO" });
  });
});
