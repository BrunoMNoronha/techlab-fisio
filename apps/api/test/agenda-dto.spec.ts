// TechLab Fisio — contratos de entrada da agenda (AGD-A; `docs/15` D-AGD-03,
// D-AGD-04, D-AGD-05, D-AGD-06, D-AGD-07, D-AGD-14).
//
// Cobre a camada PURA: corpo estrito, sem coerção de tipos, instantes com
// offset explícito e minutos inteiros, duração limitada e janela de consulta.
// A regra do passado (`422`) NÃO pertence a esta camada — ela depende do
// relógio do servidor e é provada na integração.

import { describe, expect, it } from "@jest/globals";

import {
  analisarInstanteAgendamento,
  LIMITES_AGENDA,
  validarCorpoCancelamento,
  validarCorpoCheckIn,
  validarCorpoConfirmacao,
  validarCorpoCriacao,
  validarCorpoFalta,
  validarCorpoRemarcacao,
  validarFiltroAgenda,
  validarIntervalo,
} from "../src/agenda/agenda.dto.js";

const PACIENTE = "0191f5a0-0000-7000-8000-0000000000a1";
const PROFISSIONAL = "0191f5a0-0000-7000-8000-0000000000b2";
const SERVICO = "0191f5a0-0000-7000-8000-0000000000c3";
const MOTIVO = "0191f5a0-0000-7000-8000-0000000000d4";

function corpoCriacao(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pacienteId: PACIENTE,
    profissionalId: PROFISSIONAL,
    servicoId: SERVICO,
    inicio: "2026-10-01T13:00:00Z",
    fim: "2026-10-01T13:50:00Z",
    ...extra,
  };
}

describe("analisarInstanteAgendamento — D-AGD-04 item 2 e 3", () => {
  it("aceita `Z` e offset explícito, com segundos e milissegundos zerados", () => {
    expect(analisarInstanteAgendamento("2026-10-01T13:00:00Z")?.toISOString()).toBe(
      "2026-10-01T13:00:00.000Z",
    );
    expect(analisarInstanteAgendamento("2026-10-01T10:00:00.000-03:00")?.toISOString()).toBe(
      "2026-10-01T13:00:00.000Z",
    );
  });

  it("recusa instante sem fuso — data local ambígua nunca vira agendamento", () => {
    expect(analisarInstanteAgendamento("2026-10-01T13:00:00")).toBeNull();
    expect(analisarInstanteAgendamento("2026-10-01")).toBeNull();
  });

  it("recusa segundos e milissegundos não nulos — minutos inteiros", () => {
    expect(analisarInstanteAgendamento("2026-10-01T13:00:30Z")).toBeNull();
    expect(analisarInstanteAgendamento("2026-10-01T13:00:00.500Z")).toBeNull();
  });

  it("a precisão é medida no instante ABSOLUTO, não na forma escrita", () => {
    // Offset de 30 minutos continua caindo em minuto inteiro.
    expect(analisarInstanteAgendamento("2026-10-01T13:30:00+05:30")).not.toBeNull();
    // Offsets de minuto inteiro nunca introduzem segundos.
    expect(analisarInstanteAgendamento("2026-10-01T13:00:01+05:30")).toBeNull();
  });

  it("recusa data civil impossível e tipo que não é string", () => {
    expect(analisarInstanteAgendamento("2026-02-30T13:00:00Z")).toBeNull();
    expect(analisarInstanteAgendamento(17_000_000_000)).toBeNull();
    expect(analisarInstanteAgendamento(null)).toBeNull();
    expect(analisarInstanteAgendamento(new Date())).toBeNull();
  });
});

describe("validarIntervalo — duração de 1 a 1440 minutos", () => {
  it("aceita o mínimo e o máximo homologados", () => {
    expect(validarIntervalo("2026-10-01T13:00:00Z", "2026-10-01T13:01:00Z").valido).toBe(true);
    expect(validarIntervalo("2026-10-01T13:00:00Z", "2026-10-02T13:00:00Z").valido).toBe(true);
    expect(LIMITES_AGENDA.DURACAO_MAX).toBe(1440);
  });

  it("recusa `fim <= inicio` e duração acima de 1440 minutos", () => {
    expect(validarIntervalo("2026-10-01T13:00:00Z", "2026-10-01T13:00:00Z").valido).toBe(false);
    expect(validarIntervalo("2026-10-01T13:00:00Z", "2026-10-01T12:00:00Z").valido).toBe(false);
    expect(validarIntervalo("2026-10-01T13:00:00Z", "2026-10-02T13:01:00Z").valido).toBe(false);
  });
});

describe("validarCorpoCriacao — D-AGD-05", () => {
  it("aceita exatamente as cinco chaves homologadas", () => {
    const r = validarCorpoCriacao(corpoCriacao());
    expect(r.valido).toBe(true);
    if (r.valido) {
      expect(r.valor.pacienteId).toBe(PACIENTE);
      expect(r.valor.inicio.toISOString()).toBe("2026-10-01T13:00:00.000Z");
      expect(r.valor.fim.toISOString()).toBe("2026-10-01T13:50:00.000Z");
    }
  });

  it("recusa `modalidade` e `pacoteId` — AGD-A cria somente AVULSO (D-AGD-15)", () => {
    expect(validarCorpoCriacao(corpoCriacao({ modalidade: "AVULSO" })).valido).toBe(false);
    expect(validarCorpoCriacao(corpoCriacao({ modalidade: "PACOTE" })).valido).toBe(false);
    expect(validarCorpoCriacao(corpoCriacao({ pacoteId: SERVICO })).valido).toBe(false);
  });

  it("recusa chave extra, chave ausente, tipo errado e identificador malformado", () => {
    expect(validarCorpoCriacao(corpoCriacao({ estado: "AGENDADO" })).valido).toBe(false);
    const semServico = corpoCriacao();
    delete semServico["servicoId"];
    expect(validarCorpoCriacao(semServico).valido).toBe(false);
    expect(validarCorpoCriacao(corpoCriacao({ pacienteId: 42 })).valido).toBe(false);
    expect(validarCorpoCriacao(corpoCriacao({ pacienteId: "nao-e-uuid" })).valido).toBe(false);
  });

  it("recusa corpo que não é objeto plano", () => {
    for (const corpo of [null, undefined, "texto", 7, [], [corpoCriacao()], new Date()]) {
      expect(validarCorpoCriacao(corpo).valido).toBe(false);
    }
  });
});

describe("validarCorpoConfirmacao — corpo exato `{}`", () => {
  it("aceita somente o objeto vazio", () => {
    expect(validarCorpoConfirmacao({}).valido).toBe(true);
    expect(validarCorpoConfirmacao({ estado: "CONFIRMADO" }).valido).toBe(false);
    expect(validarCorpoConfirmacao(null).valido).toBe(false);
    expect(validarCorpoConfirmacao([]).valido).toBe(false);
  });

  describe("validarCorpoCheckIn — corpo exato `{}`", () => {
    it("aceita somente o objeto vazio", () => {
      expect(validarCorpoCheckIn({}).valido).toBe(true);
      expect(validarCorpoCheckIn({ estado: "AGUARDANDO" }).valido).toBe(false);
      expect(validarCorpoCheckIn(null).valido).toBe(false);
      expect(validarCorpoCheckIn([]).valido).toBe(false);
    });
  });

  describe("validarCorpoFalta — corpo exato `{}`", () => {
    it("aceita somente o objeto vazio", () => {
      expect(validarCorpoFalta({}).valido).toBe(true);
      expect(validarCorpoFalta({ estado: "FALTA" }).valido).toBe(false);
      expect(validarCorpoFalta(null).valido).toBe(false);
      expect(validarCorpoFalta([]).valido).toBe(false);
    });
  });
});

describe("validarCorpoRemarcacao — D-AGD-06", () => {
  it("aceita exatamente `{ inicio, fim }`", () => {
    const r = validarCorpoRemarcacao({ inicio: "2026-10-02T13:00:00Z", fim: "2026-10-02T14:00:00Z" });
    expect(r.valido).toBe(true);
  });

  it("recusa troca de profissional, serviço ou paciente na remarcação", () => {
    expect(
      validarCorpoRemarcacao({
        inicio: "2026-10-02T13:00:00Z",
        fim: "2026-10-02T14:00:00Z",
        profissionalId: PROFISSIONAL,
      }).valido,
    ).toBe(false);
    expect(
      validarCorpoRemarcacao({
        inicio: "2026-10-02T13:00:00Z",
        fim: "2026-10-02T14:00:00Z",
        servicoId: SERVICO,
      }).valido,
    ).toBe(false);
  });
});

describe("validarCorpoCancelamento — D-AGD-07", () => {
  it("exige `motivoCancelamentoId` válido e nada além dele", () => {
    const r = validarCorpoCancelamento({ motivoCancelamentoId: MOTIVO });
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.valor.motivoCancelamentoId).toBe(MOTIVO);
  });

  it("recusa ausência, nulo, tipo errado, uuid malformado e chave extra", () => {
    expect(validarCorpoCancelamento({}).valido).toBe(false);
    expect(validarCorpoCancelamento({ motivoCancelamentoId: null }).valido).toBe(false);
    expect(validarCorpoCancelamento({ motivoCancelamentoId: "x" }).valido).toBe(false);
    expect(
      validarCorpoCancelamento({ motivoCancelamentoId: MOTIVO, justificativa: "texto" }).valido,
    ).toBe(false);
  });
});

describe("validarFiltroAgenda — D-AGD-14", () => {
  const de = "2026-10-01T00:00:00-03:00";

  it("aceita `de`/`ate` e, opcionalmente, `profissionalId`", () => {
    const sem = validarFiltroAgenda({ de, ate: "2026-10-02T00:00:00-03:00" });
    expect(sem.valido).toBe(true);
    if (sem.valido) expect(sem.valor.profissionalId).toBeNull();

    const com = validarFiltroAgenda({
      de,
      ate: "2026-10-02T00:00:00-03:00",
      profissionalId: PROFISSIONAL,
    });
    expect(com.valido).toBe(true);
    if (com.valido) expect(com.valor.profissionalId).toBe(PROFISSIONAL);
  });

  it("aceita exatamente 7 dias e recusa 7 dias e um milissegundo", () => {
    expect(validarFiltroAgenda({ de, ate: "2026-10-08T00:00:00-03:00" }).valido).toBe(true);
    expect(validarFiltroAgenda({ de, ate: "2026-10-08T00:00:00.001-03:00" }).valido).toBe(false);
    expect(LIMITES_AGENDA.JANELA_CONSULTA_DIAS).toBe(7);
  });

  it("recusa janela ausente, invertida, degenerada e sem fuso explícito", () => {
    expect(validarFiltroAgenda({}).valido).toBe(false);
    expect(validarFiltroAgenda({ de }).valido).toBe(false);
    expect(validarFiltroAgenda({ ate: de }).valido).toBe(false);
    expect(validarFiltroAgenda({ de, ate: "2026-09-30T00:00:00-03:00" }).valido).toBe(false);
    expect(validarFiltroAgenda({ de, ate: de }).valido).toBe(false);
    expect(validarFiltroAgenda({ de: "2026-10-01", ate: "2026-10-02" }).valido).toBe(false);
  });

  it("recusa parâmetro desconhecido e valor repetido (array)", () => {
    expect(
      validarFiltroAgenda({ de, ate: "2026-10-02T00:00:00-03:00", pacienteId: PACIENTE }).valido,
    ).toBe(false);
    expect(validarFiltroAgenda({ de: [de, de], ate: "2026-10-02T00:00:00-03:00" }).valido).toBe(false);
    expect(
      validarFiltroAgenda({
        de,
        ate: "2026-10-02T00:00:00-03:00",
        profissionalId: [PROFISSIONAL],
      }).valido,
    ).toBe(false);
  });

  it("a janela de consulta NÃO exige minutos inteiros — é consulta, não agendamento", () => {
    expect(
      validarFiltroAgenda({ de: "2026-10-01T00:00:30Z", ate: "2026-10-02T00:00:30Z" }).valido,
    ).toBe(true);
  });
});
