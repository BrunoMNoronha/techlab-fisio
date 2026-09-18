// TechLab Fisio — testes unitários dos contratos e validações puras de bloqueios de agenda (AGD-C / Issue #107).
//
// Validações estritas, isoladas e puras: corpo estrito, UUID, instantes ISO-8601 com offset,
// normalização e limites de motivo, regras temporais de criação com `agora` determinístico,
// consulta com janela de 7 dias e guardas contra implementação indevida.

import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  avaliarTempoBloqueio,
  ERRO_BLOQUEIO,
  LIMITES_BLOQUEIO,
  validarConsultaBloqueios,
  validarCriacaoBloqueio,
} from "../src/agenda/agenda-bloqueios.dto.js";

const UUID_VALIDO = "00000000-0000-7000-8000-000000000001";
const UUID_VALIDO_2 = "0191f5a0-0000-7000-8000-0000000000b2";

function corpoBase(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    profissionalId: UUID_VALIDO,
    inicio: "2028-10-15T08:00:00-03:00",
    fim: "2028-10-15T18:00:00-03:00",
    ...extra,
  };
}

describe("8.1 Corpo estrito na criação de bloqueio (D-AGDC-03)", () => {
  it("aceita objeto válido com os quatro campos permitidos", () => {
    const res = validarCriacaoBloqueio(
      corpoBase({ motivo: "Manutenção preventiva" }),
    );
    expect(res.valido).toBe(true);
    if (res.valido) {
      expect(res.valor.profissionalId).toBe(UUID_VALIDO);
      expect(res.valor.inicio.toISOString()).toBe("2028-10-15T11:00:00.000Z");
      expect(res.valor.fim.toISOString()).toBe("2028-10-15T21:00:00.000Z");
      expect(res.valor.motivo).toBe("Manutenção preventiva");
    }
  });

  it("aceita objeto válido sem o campo motivo", () => {
    const res = validarCriacaoBloqueio(corpoBase());
    expect(res.valido).toBe(true);
    if (res.valido) {
      expect(res.valor.motivo).toBeNull();
    }
  });

  it("rejeita valores não-objeto plano (null, array, primitivos)", () => {
    expect(validarCriacaoBloqueio(null).valido).toBe(false);
    expect(validarCriacaoBloqueio([]).valido).toBe(false);
    expect(validarCriacaoBloqueio("texto").valido).toBe(false);
    expect(validarCriacaoBloqueio(12345).valido).toBe(false);
    expect(validarCriacaoBloqueio(true).valido).toBe(false);
    expect(validarCriacaoBloqueio(undefined).valido).toBe(false);
  });

  it("rejeita objeto vazio", () => {
    expect(validarCriacaoBloqueio({}).valido).toBe(false);
  });

  it("rejeita ausência individual de cada campo obrigatório", () => {
    const semProfissional = { inicio: "2028-10-15T08:00:00Z", fim: "2028-10-15T18:00:00Z" };
    const semInicio = { profissionalId: UUID_VALIDO, fim: "2028-10-15T18:00:00Z" };
    const semFim = { profissionalId: UUID_VALIDO, inicio: "2028-10-15T08:00:00Z" };

    expect(validarCriacaoBloqueio(semProfissional).valido).toBe(false);
    expect(validarCriacaoBloqueio(semInicio).valido).toBe(false);
    expect(validarCriacaoBloqueio(semFim).valido).toBe(false);
  });

  it("rejeita corpo com qualquer chave adicional desconhecida", () => {
    expect(validarCriacaoBloqueio(corpoBase({ chaveInesperada: "valor" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ extra: 123 })).valido).toBe(false);
  });

  it("rejeita especificamente chaves proibidas de ator, metadados ou auditoria (id, criadoPorUsuarioId, criadoEm, observacao)", () => {
    expect(validarCriacaoBloqueio(corpoBase({ id: UUID_VALIDO })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ criadoPorUsuarioId: UUID_VALIDO })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ criadoEm: "2026-09-18T10:00:00Z" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ observacao: "nota" })).valido).toBe(false);
  });

  it("rejeita tipos incorretos para cada campo", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: 12345 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: ["array"] })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ inicio: 1700000000000 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ fim: true })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: 999 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: ["lista"] })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: {} })).valido).toBe(false);
  });
});

describe("8.2 Validação de UUID de profissional (D-AGDC-03)", () => {
  it("aceita UUID canônico válido", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: UUID_VALIDO })).valido).toBe(true);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: UUID_VALIDO_2 })).valido).toBe(true);
  });

  it("rejeita string vazia ou em branco", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: "" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: "   " })).valido).toBe(false);
  });

  it("rejeita UUID malformado ou com formato incorreto", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: "nao-eh-um-uuid" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: "00000000-0000-7000-8000" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: "00000000-0000-7000-8000-00000000000Z" })).valido).toBe(false);
  });

  it("rejeita UUID com caracteres adicionais nas extremidades", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: ` ${UUID_VALIDO} ` })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: `prefix-${UUID_VALIDO}` })).valido).toBe(false);
  });

  it("rejeita identificador numérico, booleano, array ou objeto", () => {
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: 1 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: true })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: [UUID_VALIDO] })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ profissionalId: { id: UUID_VALIDO } })).valido).toBe(false);
  });
});

describe("8.3 Instantes ISO-8601 e intervalo estrutural (D-AGDC-03, D-AGDC-04)", () => {
  it("aceita instante com sufixo Z (UTC)", () => {
    const res = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T08:00:00Z",
        fim: "2028-10-15T18:00:00Z",
      }),
    );
    expect(res.valido).toBe(true);
  });

  it("aceita instantes com offset positivo e negativo", () => {
    const resPos = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T08:00:00+02:00",
        fim: "2028-10-15T18:00:00+02:00",
      }),
    );
    expect(resPos.valido).toBe(true);

    const resNeg = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T08:00:00-03:00",
        fim: "2028-10-15T18:00:00-03:00",
      }),
    );
    expect(resNeg.valido).toBe(true);
  });

  it("exige segundos obrigatórios", () => {
    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00Z",
          fim: "2028-10-15T18:00:00Z",
        }),
      ).valido,
    ).toBe(false);
  });

  it("aceita instantes com milissegundos ausentes ou com 1, 2 e 3 dígitos", () => {
    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00:00.1Z",
          fim: "2028-10-15T18:00:00Z",
        }),
      ).valido,
    ).toBe(true);

    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00:00.12Z",
          fim: "2028-10-15T18:00:00Z",
        }),
      ).valido,
    ).toBe(true);

    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00:00.123Z",
          fim: "2028-10-15T18:00:00.999Z",
        }),
      ).valido,
    ).toBe(true);
  });

  it("rejeita precisão superior a 3 dígitos de milissegundo", () => {
    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00:00.1234Z",
          fim: "2028-10-15T18:00:00Z",
        }),
      ).valido,
    ).toBe(false);
  });

  it("rejeita instante sem offset explícito", () => {
    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-10-15T08:00:00",
          fim: "2028-10-15T18:00:00Z",
        }),
      ).valido,
    ).toBe(false);
  });

  it("rejeita data civil impossível (ex.: 30 de fevereiro)", () => {
    expect(
      validarCriacaoBloqueio(
        corpoBase({
          inicio: "2028-02-30T08:00:00Z",
          fim: "2028-02-30T18:00:00Z",
        }),
      ).valido,
    ).toBe(false);
  });

  it("rejeita texto corrompido ou tipo não-string", () => {
    expect(validarCriacaoBloqueio(corpoBase({ inicio: "data-invalida" })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ inicio: 20281015 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ fim: null })).valido).toBe(false);
  });

  it("rejeita fim === inicio", () => {
    const res = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T10:00:00Z",
        fim: "2028-10-15T10:00:00Z",
      }),
    );
    expect(res.valido).toBe(false);
  });

  it("rejeita fim < inicio", () => {
    const res = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T12:00:00Z",
        fim: "2028-10-15T10:00:00Z",
      }),
    );
    expect(res.valido).toBe(false);
  });

  it("aceita fim > inicio com offsets distintos representando a ordem correta", () => {
    // 10:00:00-03:00 = 13:00:00 UTC; 14:00:00Z = 14:00:00 UTC (fim > inicio em 1 hora)
    const res = validarCriacaoBloqueio(
      corpoBase({
        inicio: "2028-10-15T10:00:00-03:00",
        fim: "2028-10-15T14:00:00Z",
      }),
    );
    expect(res.valido).toBe(true);
  });
});

describe("8.4 Normalização e limites de motivo (D-AGDC-03)", () => {
  it("normaliza motivo ausente para null", () => {
    const res = validarCriacaoBloqueio(corpoBase());
    expect(res.valido).toBe(true);
    if (res.valido) expect(res.valor.motivo).toBeNull();
  });

  it("normaliza motivo null para null", () => {
    const res = validarCriacaoBloqueio(corpoBase({ motivo: null }));
    expect(res.valido).toBe(true);
    if (res.valido) expect(res.valor.motivo).toBeNull();
  });

  it("normaliza string vazia para null", () => {
    const res = validarCriacaoBloqueio(corpoBase({ motivo: "" }));
    expect(res.valido).toBe(true);
    if (res.valido) expect(res.valor.motivo).toBeNull();
  });

  it("normaliza string contendo apenas espaços para null", () => {
    const res = validarCriacaoBloqueio(corpoBase({ motivo: "     " }));
    expect(res.valido).toBe(true);
    if (res.valido) expect(res.valor.motivo).toBeNull();
  });

  it("aplica trim em espaços nas extremidades de texto válido", () => {
    const res = validarCriacaoBloqueio(corpoBase({ motivo: "   Férias anuais   " }));
    expect(res.valido).toBe(true);
    if (res.valido) expect(res.valor.motivo).toBe("Férias anuais");
  });

  it("aceita motivo com exatamente 500 caracteres após trim", () => {
    const exato500 = "A".repeat(500);
    const res = validarCriacaoBloqueio(corpoBase({ motivo: `  ${exato500}  ` }));
    expect(res.valido).toBe(true);
    if (res.valido) {
      expect(res.valor.motivo).toBe(exato500);
      expect(res.valor.motivo?.length).toBe(500);
    }
  });

  it("rejeita motivo com 501 caracteres após trim (sem truncamento silencioso)", () => {
    const excessivo501 = "B".repeat(501);
    const res = validarCriacaoBloqueio(corpoBase({ motivo: excessivo501 }));
    expect(res.valido).toBe(false);
  });

  it("rejeita motivo com tipos não-string (número, array, objeto, booleano)", () => {
    expect(validarCriacaoBloqueio(corpoBase({ motivo: 12345 })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: ["férias"] })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: { texto: "motivo" } })).valido).toBe(false);
    expect(validarCriacaoBloqueio(corpoBase({ motivo: true })).valido).toBe(false);
  });
});

describe("8.5 Regras temporais puras de criação (avaliarTempoBloqueio / D-AGDC-04)", () => {
  const AGORA = new Date("2026-10-01T12:00:00.000Z");

  it("rejeita término antes de agora (BLOQUEIO_NO_PASSADO)", () => {
    const intervalo = {
      inicio: new Date("2026-09-30T10:00:00.000Z"),
      fim: new Date("2026-09-30T18:00:00.000Z"),
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(false);
    if (!res.valido) expect(res.erro).toBe(ERRO_BLOQUEIO.BLOQUEIO_NO_PASSADO);
  });

  it("rejeita término exatamente igual a agora (fim === agora -> BLOQUEIO_NO_PASSADO)", () => {
    const intervalo = {
      inicio: new Date("2026-10-01T11:00:00.000Z"),
      fim: new Date(AGORA.getTime()),
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(false);
    if (!res.valido) expect(res.erro).toBe(ERRO_BLOQUEIO.BLOQUEIO_NO_PASSADO);
  });

  it("aceita bloqueio iniciado no passado e ainda em andamento (inicio < agora && fim > agora)", () => {
    const intervalo = {
      inicio: new Date("2026-10-01T10:00:00.000Z"), // 2 horas no passado
      fim: new Date("2026-10-01T16:00:00.000Z"),    // 4 horas no futuro
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(true);
  });

  it("aceita bloqueio com início exatamente igual a agora", () => {
    const intervalo = {
      inicio: new Date(AGORA.getTime()),
      fim: new Date("2026-10-01T18:00:00.000Z"),
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(true);
  });

  it("aceita bloqueio totalmente futuro", () => {
    const intervalo = {
      inicio: new Date("2026-10-05T08:00:00.000Z"),
      fim: new Date("2026-10-05T18:00:00.000Z"),
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(true);
  });

  it("aceita bloqueio com duração exatamente igual a 365 dias (8.760 horas)", () => {
    const inicio = new Date("2026-11-01T00:00:00.000Z");
    const fim = new Date(inicio.getTime() + LIMITES_BLOQUEIO.DURACAO_MAX_MS);
    const res = avaliarTempoBloqueio({ inicio, fim }, AGORA);
    expect(res.valido).toBe(true);
  });

  it("rejeita bloqueio com duração 1 milissegundo acima de 365 dias (INTERVALO_EXCESSIVO)", () => {
    const inicio = new Date("2026-11-01T00:00:00.000Z");
    const fim = new Date(inicio.getTime() + LIMITES_BLOQUEIO.DURACAO_MAX_MS + 1);
    const res = avaliarTempoBloqueio({ inicio, fim }, AGORA);
    expect(res.valido).toBe(false);
    if (!res.valido) expect(res.erro).toBe(ERRO_BLOQUEIO.INTERVALO_EXCESSIVO);
  });

  it("aceita início exatamente igual a agora + 730 dias", () => {
    const inicio = new Date(AGORA.getTime() + LIMITES_BLOQUEIO.INICIO_FUTURO_MAX_MS);
    const fim = new Date(inicio.getTime() + 3_600_000); // +1 hora
    const res = avaliarTempoBloqueio({ inicio, fim }, AGORA);
    expect(res.valido).toBe(true);
  });

  it("rejeita início 1 milissegundo acima de agora + 730 dias (INTERVALO_EXCESSIVO)", () => {
    const inicio = new Date(AGORA.getTime() + LIMITES_BLOQUEIO.INICIO_FUTURO_MAX_MS + 1);
    const fim = new Date(inicio.getTime() + 3_600_000);
    const res = avaliarTempoBloqueio({ inicio, fim }, AGORA);
    expect(res.valido).toBe(false);
    if (!res.valido) expect(res.erro).toBe(ERRO_BLOQUEIO.INTERVALO_EXCESSIVO);
  });

  it("aceita bloqueios atravessando meia-noite e cobrindo múltiplos dias", () => {
    const intervalo = {
      inicio: new Date("2026-10-10T22:00:00.000Z"),
      fim: new Date("2026-10-15T06:00:00.000Z"),
    };
    const res = avaliarTempoBloqueio(intervalo, AGORA);
    expect(res.valido).toBe(true);
  });

  it("prova o determinismo completo alterando exclusivamente o argumento agora", () => {
    const intervaloFixo = {
      inicio: new Date("2027-01-01T10:00:00.000Z"),
      fim: new Date("2027-01-01T18:00:00.000Z"),
    };

    // Cenário 1: agora é antes do intervalo -> válido
    const agoraAntes = new Date("2026-12-31T23:59:59.000Z");
    expect(avaliarTempoBloqueio(intervaloFixo, agoraAntes).valido).toBe(true);

    // Cenário 2: agora é depois do término -> BLOQUEIO_NO_PASSADO
    const agoraDepois = new Date("2027-01-01T18:00:00.000Z");
    const resDepois = avaliarTempoBloqueio(intervaloFixo, agoraDepois);
    expect(resDepois.valido).toBe(false);
    if (!resDepois.valido) expect(resDepois.erro).toBe(ERRO_BLOQUEIO.BLOQUEIO_NO_PASSADO);

    // Cenário 3: agora é há mais de 730 dias antes -> INTERVALO_EXCESSIVO
    const agoraMuitoAntes = new Date("2024-01-01T00:00:00.000Z");
    const resMuitoAntes = avaliarTempoBloqueio(intervaloFixo, agoraMuitoAntes);
    expect(resMuitoAntes.valido).toBe(false);
    if (!resMuitoAntes.valido) expect(resMuitoAntes.erro).toBe(ERRO_BLOQUEIO.INTERVALO_EXCESSIVO);
  });
});

describe("8.6 Consulta de bloqueios (validarConsultaBloqueios / D-AGDC-07)", () => {
  it("aceita consulta válida com de e ate (janela <= 7 dias)", () => {
    const res = validarConsultaBloqueios({
      de: "2028-10-15T00:00:00-03:00",
      ate: "2028-10-22T00:00:00-03:00",
    });
    expect(res.valido).toBe(true);
    if (res.valido) {
      expect(res.valor.de.toISOString()).toBe("2028-10-15T03:00:00.000Z");
      expect(res.valor.ate.toISOString()).toBe("2028-10-22T03:00:00.000Z");
      expect(res.valor.profissionalId).toBeUndefined();
    }
  });

  it("aceita consulta com profissionalId opcional válido", () => {
    const res = validarConsultaBloqueios({
      de: "2028-10-15T00:00:00Z",
      ate: "2028-10-20T00:00:00Z",
      profissionalId: UUID_VALIDO,
    });
    expect(res.valido).toBe(true);
    if (res.valido) {
      expect(res.valor.profissionalId).toBe(UUID_VALIDO);
    }
  });

  it("rejeita parâmetros desconhecidos ou chaves adicionais", () => {
    expect(
      validarConsultaBloqueios({
        de: "2028-10-15T00:00:00Z",
        ate: "2028-10-20T00:00:00Z",
        chaveInesperada: "valor",
      }).valido,
    ).toBe(false);
  });

  it("rejeita ausência de de ou de ate", () => {
    expect(validarConsultaBloqueios({ de: "2028-10-15T00:00:00Z" }).valido).toBe(false);
    expect(validarConsultaBloqueios({ ate: "2028-10-20T00:00:00Z" }).valido).toBe(false);
  });

  it("rejeita parâmetros recebidos como array (parâmetro repetido na query)", () => {
    expect(
      validarConsultaBloqueios({
        de: ["2028-10-15T00:00:00Z", "2028-10-16T00:00:00Z"],
        ate: "2028-10-20T00:00:00Z",
      }).valido,
    ).toBe(false);

    expect(
      validarConsultaBloqueios({
        de: "2028-10-15T00:00:00Z",
        ate: "2028-10-20T00:00:00Z",
        profissionalId: [UUID_VALIDO, UUID_VALIDO_2],
      }).valido,
    ).toBe(false);
  });

  it("rejeita profissionalId malformado", () => {
    expect(
      validarConsultaBloqueios({
        de: "2028-10-15T00:00:00Z",
        ate: "2028-10-20T00:00:00Z",
        profissionalId: "uuid-invalido",
      }).valido,
    ).toBe(false);
  });

  it("rejeita de === ate", () => {
    expect(
      validarConsultaBloqueios({
        de: "2028-10-15T10:00:00Z",
        ate: "2028-10-15T10:00:00Z",
      }).valido,
    ).toBe(false);
  });

  it("rejeita de > ate", () => {
    expect(
      validarConsultaBloqueios({
        de: "2028-10-20T10:00:00Z",
        ate: "2028-10-15T10:00:00Z",
      }).valido,
    ).toBe(false);
  });

  it("aceita janela exatamente igual a 7 dias (604.800.000 ms)", () => {
    const deMs = new Date("2028-05-01T00:00:00.000Z").getTime();
    const ateIso = new Date(deMs + LIMITES_BLOQUEIO.JANELA_CONSULTA_MAX_MS).toISOString();
    const res = validarConsultaBloqueios({
      de: "2028-05-01T00:00:00.000Z",
      ate: ateIso,
    });
    expect(res.valido).toBe(true);
  });

  it("rejeita janela 1 milissegundo acima de 7 dias", () => {
    const deMs = new Date("2028-05-01T00:00:00.000Z").getTime();
    const ateIso = new Date(deMs + LIMITES_BLOQUEIO.JANELA_CONSULTA_MAX_MS + 1).toISOString();
    const res = validarConsultaBloqueios({
      de: "2028-05-01T00:00:00.000Z",
      ate: ateIso,
    });
    expect(res.valido).toBe(false);
  });

  it("aceita janela histórica no passado (consulta não tem restrição de passado)", () => {
    const res = validarConsultaBloqueios({
      de: "2020-01-01T00:00:00Z",
      ate: "2020-01-07T00:00:00Z",
    });
    expect(res.valido).toBe(true);
  });

  it("aceita janela futura no futuro distante (consulta não tem restrição de 730 dias)", () => {
    const res = validarConsultaBloqueios({
      de: "2035-01-01T00:00:00Z",
      ate: "2035-01-07T00:00:00Z",
    });
    expect(res.valido).toBe(true);
  });

  it("aceita instantes de consulta com offsets diferentes que formam intervalo válido <= 7 dias", () => {
    const res = validarConsultaBloqueios({
      de: "2028-10-15T00:00:00-03:00", // 03:00 UTC
      ate: "2028-10-22T03:00:00Z",     // 03:00 UTC (exatamente 7 dias)
    });
    expect(res.valido).toBe(true);
  });

  it("rejeita data civil inválida na consulta", () => {
    expect(
      validarConsultaBloqueios({
        de: "2028-02-31T00:00:00Z",
        ate: "2028-03-05T00:00:00Z",
      }).valido,
    ).toBe(false);
  });
});

describe("8.7 Guardas contra implementação indevida e conformidade pura", () => {
  it("comprova ausência de chamadas a Date.now() e new Date() sem argumento no arquivo de DTO", () => {
    const caminhoArquivo = resolve(
      fileURLToPath(import.meta.url),
      "../../src/agenda/agenda-bloqueios.dto.ts",
    );
    const conteudo = readFileSync(caminhoArquivo, "utf-8");

    // Nenhuma chamada a Date.now()
    expect(conteudo).not.toMatch(/Date\.now\(\)/);

    // Nenhuma chamada a new Date() sem parâmetros (relógio global embutido)
    expect(conteudo).not.toMatch(/new\s+Date\(\s*\)/);

    // Nenhuma importação de pacotes proibidos (class-validator, typeorm, prisma, etc.)
    expect(conteudo).not.toMatch(/from\s+["']class-validator["']/);
    expect(conteudo).not.toMatch(/from\s+["']class-transformer["']/);
    expect(conteudo).not.toMatch(/from\s+["']@techlab-fisio\/database["']/);
  });

  it("comprova que a normalização de motivo não realiza corte ou truncamento silencioso", () => {
    const exato500 = "Z".repeat(500);
    const res500 = validarCriacaoBloqueio(corpoBase({ motivo: exato500 }));
    expect(res500.valido).toBe(true);
    if (res500.valido) expect(res500.valor.motivo).toBe(exato500);

    const com501 = "Z".repeat(501);
    const res501 = validarCriacaoBloqueio(corpoBase({ motivo: com501 }));
    // 501 é estritamente rejeitado (false), jamais truncado para 500
    expect(res501.valido).toBe(false);
  });
});
