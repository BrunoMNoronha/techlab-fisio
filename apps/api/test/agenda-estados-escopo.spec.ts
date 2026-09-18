// TechLab Fisio — máquina de estados e escopo da agenda (AGD-A; `docs/15`
// D-AGD-02, D-AGD-06, D-AGD-07, D-AGD-09, D-AGD-12, D-AGD-14).
//
// Camadas PURAS. A prova de que o serviço realmente aplica estas funções — sob
// `SELECT ... FOR UPDATE` e contra PostgreSQL real — está na suíte de
// integração; aqui prova-se a REGRA, isolada do banco.

import { describe, expect, it } from "@jest/globals";

import {
  avaliarCheckIn,
  avaliarFalta,
  avaliarConfirmacao,
  estadoAposRemarcacao,
  ESTADOS_TERMINAIS,
  OPERACOES_AGD_A,
  OPERACOES_HISTORICO,
  permiteCheckIn,
  permiteCancelamento,
  permiteFalta,
  permiteRemarcacao,
  type EstadoAgendamento,
} from "../src/agenda/agenda.estados.js";
import { PAPEIS, ehCodigoPapel } from "../src/provisionamento/catalogo-rbac.js";
import {
  escopoAlcanca,
  PERMISSAO_AGENDA_CHECKIN,
  PERMISSAO_AGENDA_FALTA,
  PERMISSAO_AGENDA_GERENCIAR,
  PAPEIS_ESCOPO_OPERACIONAL,
  restricaoDaLeitura,
  type EscopoAgenda,
} from "../src/agenda/agenda.escopo.js";

const TODOS: readonly EstadoAgendamento[] = [
  "AGENDADO",
  "CONFIRMADO",
  "AGUARDANDO",
  "EM_ATENDIMENTO",
  "CONCLUIDO",
  "FALTA",
  "CANCELADO",
];

const PROPRIO = "0191f5a0-0000-7000-8000-0000000000b2";
const OUTRO = "0191f5a0-0000-7000-8000-0000000000b3";
const FUSO = "America/Sao_Paulo";
const NY = "America/New_York";

describe("D-AGD-09 — catálogo fechado de operações do histórico", () => {
  it("declara as oito operações e AGD-A usa somente as quatro primeiras", () => {
    expect([...OPERACOES_HISTORICO]).toEqual([
      "CRIADO",
      "CONFIRMADO",
      "REMARCADO",
      "CANCELADO",
      "CHECKIN",
      "FALTA",
      "INICIADO",
      "CONCLUIDO",
    ]);
    expect([...OPERACOES_AGD_A]).toEqual(["CRIADO", "CONFIRMADO", "REMARCADO", "CANCELADO"]);
  });
});

describe("D-AGD-02 — confirmação", () => {
  it("`AGENDADO` transiciona; `CONFIRMADO` é no-op; todo o resto é inválido", () => {
    expect(avaliarConfirmacao("AGENDADO")).toBe("TRANSICIONA");
    expect(avaliarConfirmacao("CONFIRMADO")).toBe("NO_OP");
    for (const estado of TODOS) {
      if (estado === "AGENDADO" || estado === "CONFIRMADO") continue;
      expect(avaliarConfirmacao(estado)).toBe("INVALIDA");
    }
  });

  it("nenhum estado terminal admite confirmação (RN-020)", () => {
    for (const estado of ESTADOS_TERMINAIS) {
      expect(avaliarConfirmacao(estado)).toBe("INVALIDA");
    }
    expect([...ESTADOS_TERMINAIS].sort()).toEqual(["CANCELADO", "CONCLUIDO", "FALTA"]);
  });
});

describe("D-AGD-06 / D-AGD-07 — origens de remarcação e cancelamento", () => {
  it("ambas são admitidas somente em `AGENDADO` e `CONFIRMADO`", () => {
    for (const estado of TODOS) {
      const admitido = estado === "AGENDADO" || estado === "CONFIRMADO";
      expect(permiteRemarcacao(estado)).toBe(admitido);
      expect(permiteCancelamento(estado)).toBe(admitido);
    }
  });

  describe("AGD-B — origens de check-in e falta", () => {
    it("check-in e falta são admitidos somente em `AGENDADO` e `CONFIRMADO`", () => {
      for (const estado of TODOS) {
        const admitido = estado === "AGENDADO" || estado === "CONFIRMADO";
        expect(permiteCheckIn(estado)).toBe(admitido);
        expect(permiteFalta(estado)).toBe(admitido);
      }
    });

    it("check-in exige estado admitido e mesma data civil local do início", () => {
      expect(
        avaliarCheckIn({
          estado: "AGENDADO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T05:00:00.000Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("ADMITE");
      expect(
        avaliarCheckIn({
          estado: "AGENDADO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T02:59:59.000Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("FORA_DA_JANELA_TEMPORAL");
      expect(
        avaliarCheckIn({
          estado: "AGUARDANDO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T15:00:00.000Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("TRANSICAO_INVALIDA");
      expect(
        avaliarCheckIn({
          estado: "CONFIRMADO",
          inicio: new Date("2026-11-01T03:30:00.000Z"),
          agora: new Date("2026-11-01T05:30:00.000Z"),
          fusoHorario: NY,
        }),
      ).toBe("FORA_DA_JANELA_TEMPORAL");
    });

    it("falta exige estado admitido e instante estritamente posterior ao início local", () => {
      expect(
        avaliarFalta({
          estado: "CONFIRMADO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T15:00:00.001Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("ADMITE");
      expect(
        avaliarFalta({
          estado: "CONFIRMADO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T15:00:00.000Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("FORA_DA_JANELA_TEMPORAL");
      expect(
        avaliarFalta({
          estado: "AGUARDANDO",
          inicio: new Date("2026-09-18T15:00:00.000Z"),
          agora: new Date("2026-09-18T16:00:00.000Z"),
          fusoHorario: FUSO,
        }),
      ).toBe("TRANSICAO_INVALIDA");
      expect(
        avaliarFalta({
          estado: "AGENDADO",
          inicio: new Date("2026-11-01T03:30:00.000Z"),
          agora: new Date("2026-11-01T05:30:00.000Z"),
          fusoHorario: NY,
        }),
      ).toBe("ADMITE");
    });
  });

  it("`AGUARDANDO -> CANCELADO` NÃO é oferecido em AGD-A (P-AGD-02)", () => {
    expect(permiteCancelamento("AGUARDANDO")).toBe(false);
  });

  it("remarcar um `CONFIRMADO` o devolve a `AGENDADO`; `AGENDADO` permanece", () => {
    expect(estadoAposRemarcacao("CONFIRMADO")).toBe("AGENDADO");
    expect(estadoAposRemarcacao("AGENDADO")).toBe("AGENDADO");
  });
});

describe("D-AGD-12 — escopo operacional × próprio", () => {
  const operacional: EscopoAgenda = { tipo: "OPERACIONAL" };
  const proprio: EscopoAgenda = { tipo: "PROPRIO", profissionalId: PROPRIO };
  const semVinculo: EscopoAgenda = { tipo: "PROPRIO", profissionalId: null };

  it("materializa a regra sobre a permissão homologada, sem criar permissão nova", () => {
    expect(PERMISSAO_AGENDA_GERENCIAR).toBe("agenda.gerenciar");
    expect(PERMISSAO_AGENDA_CHECKIN).toBe("agenda.checkin");
    expect(PERMISSAO_AGENDA_FALTA).toBe("agenda.falta");
    expect([...PAPEIS_ESCOPO_OPERACIONAL].sort()).toEqual(["ADMINISTRADOR", "RECEPCIONISTA"]);
  });

  it("os dois códigos são papéis homologados de `docs/04` §3 — guarda da duplicação declarada", () => {
    // `agenda.escopo.ts` repete os literais em vez de importar
    // `provisionamento/catalogo-rbac.ts`, para não arrastar a fatia de
    // provisionamento para o fecho da aplicação (`provisionamento.fronteira.spec.ts`).
    // Esta asserção é a guarda dessa duplicação: ela roda no TESTE, que está
    // fora daquele fecho, e falha se um dos códigos divergir do catálogo.
    for (const codigo of PAPEIS_ESCOPO_OPERACIONAL) {
      expect(ehCodigoPapel(codigo)).toBe(true);
    }
    const doCatalogo = PAPEIS.map((p) => p.codigo);
    expect(doCatalogo).toContain("ADMINISTRADOR");
    expect(doCatalogo).toContain("RECEPCIONISTA");
    // O Fisioterapeuta NUNCA entra na lista operacional (D-AGD-12).
    expect(PAPEIS_ESCOPO_OPERACIONAL).not.toContain("FISIOTERAPEUTA");
    expect(PAPEIS_ESCOPO_OPERACIONAL).not.toContain("GESTOR");
  });

  it("o escopo operacional alcança qualquer profissional", () => {
    expect(escopoAlcanca(operacional, PROPRIO)).toBe(true);
    expect(escopoAlcanca(operacional, OUTRO)).toBe(true);
  });

  it("o escopo próprio alcança somente o profissional vinculado", () => {
    expect(escopoAlcanca(proprio, PROPRIO)).toBe(true);
    expect(escopoAlcanca(proprio, OUTRO)).toBe(false);
  });

  it("escopo próprio SEM vínculo não alcança profissional algum — fail-closed", () => {
    expect(escopoAlcanca(semVinculo, PROPRIO)).toBe(false);
    expect(escopoAlcanca(semVinculo, OUTRO)).toBe(false);
  });

  it("a leitura operacional respeita o `profissionalId` pedido, inclusive ausente", () => {
    expect(restricaoDaLeitura(operacional, null)).toEqual({ tipo: "SEM_RESTRICAO" });
    expect(restricaoDaLeitura(operacional, OUTRO)).toEqual({
      tipo: "PROFISSIONAL",
      profissionalId: OUTRO,
    });
  });

  it("a leitura própria IGNORA o `profissionalId` pedido e força o do ator", () => {
    expect(restricaoDaLeitura(proprio, null)).toEqual({
      tipo: "PROFISSIONAL",
      profissionalId: PROPRIO,
    });
    expect(restricaoDaLeitura(proprio, OUTRO)).toEqual({
      tipo: "PROFISSIONAL",
      profissionalId: PROPRIO,
    });
  });

  it("própria SEM vínculo NUNCA colapsa em `SEM_RESTRICAO` — a lista sai vazia", () => {
    expect(restricaoDaLeitura(semVinculo, null)).toEqual({ tipo: "VAZIO" });
    expect(restricaoDaLeitura(semVinculo, OUTRO)).toEqual({ tipo: "VAZIO" });
  });
});
