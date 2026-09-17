// TechLab Fisio — regra PURA de disponibilidade do profissional consumida pela
// agenda (PRO-003; `docs/16` D-PRO3-04, D-PRO3-10; conversão de D-CFG-60).
// Matriz TD-11.
//
// Sem I/O, sem banco e sem mock: a função recebe as versões e devolve o
// veredito. O fuso é aplicado pelas regras IANA do runtime.

import { describe, expect, it } from "@jest/globals";

import {
  avaliarDisponibilidadeProfissional,
  versaoAplicavel,
  type VersaoDisponibilidade,
} from "../src/agenda/disponibilidade-profissional.regra.js";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";

const J = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });

const versao = (
  vigenciaInicio: string,
  vigenciaFim: string | null,
  janelas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>,
): VersaoDisponibilidade => ({ vigenciaInicio, vigenciaFim, janelas });

function avaliar(versoes: VersaoDisponibilidade[], inicio: string, fim: string, fusoHorario = SP) {
  return avaliarDisponibilidadeProfissional({
    inicio: new Date(inicio),
    fim: new Date(fim),
    fusoHorario,
    versoes,
  });
}

// 2026-10-05 é uma SEGUNDA-FEIRA (diaSemana 1); 2026-10-07, uma QUARTA (3).
const ABERTA = versao("2026-10-01", null, [J(1, "08:00", "12:00"), J(1, "13:00", "18:00"), J(3, "09:00", "17:30")]);
const ANTIGA = versao("2026-01-01", "2026-09-30", [J(1, "07:00", "11:00")]);

describe("TD-11 — versão aplicável (D-PRO3-04)", () => {
  it("escolhe a versão que contém a data; a encerrada vale até o último dia inclusive", () => {
    const versoes = [ABERTA, ANTIGA];
    expect(versaoAplicavel(versoes, "2026-10-05")).toBe(ABERTA);
    expect(versaoAplicavel(versoes, "2026-09-30")).toBe(ANTIGA);
    expect(versaoAplicavel(versoes, "2026-10-01")).toBe(ABERTA);
  });

  it("não há versão aplicável antes da primeira vigência nem em lacuna entre versões", () => {
    expect(versaoAplicavel([ABERTA, ANTIGA], "2025-12-31")).toBeUndefined();
    const comLacuna = [versao("2026-01-01", "2026-03-31", [J(1, "08:00", "12:00")]), ABERTA];
    expect(versaoAplicavel(comLacuna, "2026-05-10")).toBeUndefined();
  });

  it("entre candidatas vence a de maior vigenciaInicio — busca determinística", () => {
    const antiga = versao("2026-01-01", null, [J(1, "07:00", "08:00")]);
    const recente = versao("2026-06-01", null, [J(1, "09:00", "10:00")]);
    expect(versaoAplicavel([antiga, recente], "2026-10-05")).toBe(recente);
    expect(versaoAplicavel([recente, antiga], "2026-10-05")).toBe(recente);
  });

  it("a ordem da lista não altera o resultado", () => {
    expect(versaoAplicavel([ANTIGA, ABERTA], "2026-10-05")).toBe(ABERTA);
  });
});

describe("TD-11 — avaliação do intervalo (D-PRO3-04)", () => {
  it("dentro da janela da versão aplicável: DISPONÍVEL", () => {
    // 2026-10-05 12:00Z = 09:00 local (segunda), dentro de 08:00–12:00.
    expect(avaliar([ABERTA], "2026-10-05T12:00:00Z", "2026-10-05T13:00:00Z")).toEqual({ disponivel: true });
  });

  it("bordas exatas da janela são aceitas (mesmo predicado de D-CFG-61)", () => {
    // 11:00Z = 08:00 local; 15:00Z = 12:00 local.
    expect(avaliar([ABERTA], "2026-10-05T11:00:00Z", "2026-10-05T15:00:00Z")).toEqual({ disponivel: true });
  });

  it("data coberta por versão ANTIGA é avaliada pela grade dessa versão, não pela aberta", () => {
    // 2026-09-28 é segunda. Versão antiga: 07:00–11:00; a aberta (08:00–12:00)
    // ainda não vigorava.
    expect(avaliar([ABERTA, ANTIGA], "2026-09-28T10:00:00Z", "2026-09-28T11:00:00Z")).toEqual({ disponivel: true });
    // 11:15–11:45 local (14:15Z–14:45Z) estaria DENTRO da versão aberta
    // (08:00–12:00) e está FORA da antiga (07:00–11:00): a data manda.
    expect(avaliar([ABERTA, ANTIGA], "2026-09-28T14:15:00Z", "2026-09-28T14:45:00Z")).toEqual({
      disponivel: false,
      motivo: "FORA_DAS_JANELAS",
    });
    expect(avaliar([ABERTA], "2026-10-05T14:15:00Z", "2026-10-05T14:45:00Z")).toEqual({ disponivel: true });
  });

  it("SEM versão aplicável: NÃO disponível — ausência nunca é 'sempre disponível' (D-PRO3-10)", () => {
    expect(avaliar([], "2026-10-05T12:00:00Z", "2026-10-05T13:00:00Z")).toEqual({
      disponivel: false,
      motivo: "SEM_VERSAO_APLICAVEL",
    });
    expect(avaliar([ABERTA], "2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z")).toEqual({
      disponivel: false,
      motivo: "SEM_VERSAO_APLICAVEL",
    });
  });

  it("fora das janelas do dia: NÃO disponível", () => {
    // 2026-10-05 16:00Z = 13:00... na verdade 12:30 local: início 15:30Z.
    expect(avaliar([ABERTA], "2026-10-05T15:30:00Z", "2026-10-05T15:45:00Z")).toEqual({
      disponivel: false,
      motivo: "FORA_DAS_JANELAS",
    });
  });

  it("dia local SEM janela: NÃO disponível", () => {
    // 2026-10-06 é terça (diaSemana 2) — a versão aberta não tem janela nesse dia.
    expect(avaliar([ABERTA], "2026-10-06T12:00:00Z", "2026-10-06T13:00:00Z")).toEqual({
      disponivel: false,
      motivo: "DIA_SEM_JANELA",
    });
  });

  it("nunca soma janelas: intervalo que cruza o intervalo de almoço é rejeitado", () => {
    // 11:30–13:30 local, entre 08:00–12:00 e 13:00–18:00.
    expect(avaliar([ABERTA], "2026-10-05T14:30:00Z", "2026-10-05T16:30:00Z")).toEqual({
      disponivel: false,
      motivo: "FORA_DAS_JANELAS",
    });
  });

  it("dia local DIFERENTE do dia UTC: avalia pelo dia LOCAL", () => {
    // 2026-10-06T02:00Z é ainda 2026-10-05 23:00 em São Paulo (segunda).
    const noturna = [versao("2026-10-01", null, [J(1, "22:00", "23:59")])];
    expect(avaliar(noturna, "2026-10-06T01:00:00Z", "2026-10-06T02:00:00Z")).toEqual({ disponivel: true });
    // A mesma versão avaliada como se fosse terça (dia UTC) não teria janela.
    expect(noturna[0]?.janelas.some((j) => j.diaSemana === 2)).toBe(false);
  });

  it("a VERSÃO também é escolhida pela data LOCAL do início, não pela UTC", () => {
    // 2026-10-01T02:00Z = 2026-09-30 23:00 local => versão ANTIGA, não a aberta.
    const antigaTerca = versao("2026-01-01", "2026-09-30", [J(3, "22:00", "23:59")]);
    // 2026-09-30 é uma QUARTA (diaSemana 3).
    expect(avaliar([ABERTA, antigaTerca], "2026-10-01T01:00:00Z", "2026-10-01T02:00:00Z")).toEqual({
      disponivel: true,
    });
  });

  it("início e fim em dias civis LOCAIS distintos: NÃO disponível", () => {
    const madrugada = [versao("2026-10-01", null, [J(1, "23:00", "23:59"), J(2, "00:00", "01:00")])];
    // 2026-10-06T02:30Z–03:30Z = 23:30 (seg) até 00:30 (ter) local.
    expect(avaliar(madrugada, "2026-10-06T02:30:00Z", "2026-10-06T03:30:00Z")).toEqual({
      disponivel: false,
      motivo: "ATRAVESSA_MEIA_NOITE_LOCAL",
    });
  });

  it("intervalo degenerado ou invertido: NÃO disponível", () => {
    expect(avaliar([ABERTA], "2026-10-05T12:00:00Z", "2026-10-05T12:00:00Z")).toEqual({
      disponivel: false,
      motivo: "INTERVALO_INVALIDO",
    });
    expect(avaliar([ABERTA], "2026-10-05T13:00:00Z", "2026-10-05T12:00:00Z")).toEqual({
      disponivel: false,
      motivo: "INTERVALO_INVALIDO",
    });
  });

  it("aplica a hora de PAREDE em fuso com horário de verão", () => {
    // 2026-10-05 é segunda também em Nova York (EDT, UTC-4): 13:00Z = 09:00.
    const emNY = [versao("2026-10-01", null, [J(1, "09:00", "10:00")])];
    expect(avaliar(emNY, "2026-10-05T13:00:00Z", "2026-10-05T14:00:00Z", NY)).toEqual({ disponivel: true });
    // Em São Paulo o mesmo instante é 10:00 — fora da janela 09:00–10:00.
    expect(avaliar(emNY, "2026-10-05T13:00:00Z", "2026-10-05T14:00:00Z", SP)).toEqual({
      disponivel: false,
      motivo: "FORA_DAS_JANELAS",
    });
  });

  it("NÃO confronta a grade da clínica — a camada é independente (D-CFG-62)", () => {
    // Janela do profissional 06:00–07:00, fora de qualquer horário comercial:
    // a regra de disponibilidade a aceita; a contenção na clínica é outra etapa.
    const cedo = [versao("2026-10-01", null, [J(1, "06:00", "07:00")])];
    expect(avaliar(cedo, "2026-10-05T09:00:00Z", "2026-10-05T10:00:00Z")).toEqual({ disponivel: true });
  });
});
