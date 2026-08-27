// TechLab Fisio — T-AUD-CONTEXTO (parte unitária) — Etapa 2.3A.
//
// Materializa o teste RECLASSIFICADO em docs/09 §12.7 como teste de regra de
// aplicação/backend: valida o comportamento fail-closed do
// AuditContextValidator contra o catálogo homologado (D-AUD-01, D-AUD-07).
// A parte de integração (mesma política através do container NestJS real)
// está em audit.module.integration.spec.ts.

import { describe, expect, it } from "@jest/globals";

import {
  ACOES_AUDITORIA,
  WHITELIST_CONTEXTO,
} from "../src/audit/audit.catalog.js";
import {
  AuditContextValidator,
  ErroContextoAuditoria,
} from "../src/audit/audit-context.validator.js";
import { RESULTADOS_AUDITORIA } from "../src/audit/audit.types.js";
import type { ContextoCandidato } from "../src/audit/audit.types.js";

const validator = new AuditContextValidator();

/** Captura o erro tipado lançado, falhando se nada for lançado. */
function rejeicao(
  acao: string,
  contexto?: ContextoCandidato,
): ErroContextoAuditoria {
  try {
    validator.validar(acao, contexto);
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroContextoAuditoria);
    return erro as ErroContextoAuditoria;
  }
  throw new Error(
    `Esperava rejeição para a ação "${acao}", mas o contexto foi aceito.`,
  );
}

describe("catálogo homologado (D-AUD-01 / D-AUD-02)", () => {
  it("contém exatamente as 24 ações homologadas em docs/09 §12.2", () => {
    expect(ACOES_AUDITORIA).toHaveLength(24);
    expect(new Set(ACOES_AUDITORIA).size).toBe(24);
  });

  it("o catálogo de resultado é exatamente SUCESSO | NEGADO | FALHA", () => {
    expect(RESULTADOS_AUDITORIA).toEqual(["SUCESSO", "NEGADO", "FALHA"]);
  });

  it("a whitelist declara TODAS as 24 ações e somente três não vazias (D-AUD-07)", () => {
    expect(Object.keys(WHITELIST_CONTEXTO).sort()).toEqual(
      [...ACOES_AUDITORIA].sort(),
    );
    const naoVazias = Object.entries(WHITELIST_CONTEXTO)
      .filter(([, chaves]) => chaves.length > 0)
      .map(([acao]) => acao)
      .sort();
    expect(naoVazias).toEqual([
      "cobranca.data_referencia_recalculada",
      "cobranca.desconto_aplicado",
      "retificacao_clinica.efetivada_terceiro",
    ]);
  });

  it.each([...ACOES_AUDITORIA])(
    "reconhece a ação homologada %s com contexto vazio e com contexto ausente",
    (acao) => {
      expect(validator.validar(acao, {})).toBe(acao);
      expect(validator.validar(acao)).toBe(acao);
    },
  );
});

describe("ação desconhecida → rejeição explícita", () => {
  it.each([
    "acao.inexistente",
    "paciente.cadastro.alterado", // SF — D-AUD-05: fora por decisão
    "prontuario.acessado", // SF — D-AUD-05
    "autorizacao.negada", // SF — D-AUD-05
    "auditoria.consultada", // SF — D-AUD-05
    "agendamento.confirmado", // RC — D-AUD-04: adiada, não homologada
    "USUARIO.AUTENTICACAO", // caixa diferente não é a ação homologada
    "",
  ])('rejeita "%s" mesmo com contexto vazio', (acao) => {
    const erro = rejeicao(acao, {});
    expect(erro.motivo).toBe("ACAO_DESCONHECIDA");
    expect(erro.acao).toBe(acao);
  });
});

describe("whitelist vazia → nenhum contexto não vazio (21 ações)", () => {
  const acoesComWhitelistVazia = Object.entries(WHITELIST_CONTEXTO)
    .filter(([, chaves]) => chaves.length === 0)
    .map(([acao]) => acao);

  it("são exatamente 21 ações", () => {
    expect(acoesComWhitelistVazia).toHaveLength(21);
  });

  it.each(acoesComWhitelistVazia)(
    "%s rejeita qualquer chave, inclusive as apenas propostas em docs/09 §§1..11",
    (acao) => {
      const erro = rejeicao(acao, { chave_arbitraria: 1 });
      expect(erro.motivo).toBe("CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA");
      expect(erro.chaves).toEqual(["chave_arbitraria"]);
    },
  );

  // Chaves que docs/09 §§1..11 chegaram a propor e que NÃO foram homologadas
  // (docs/09 §12.6) — não podem passar a valer por implicação.
  it.each([
    ["usuario.situacao.alterada", "ativo_anterior"],
    ["usuario.situacao.alterada", "ativo_novo"],
    ["configuracao.alterada", "campos_alterados"],
    ["sessao.consumida", "atendimento_id"],
    ["sessao.consumida", "pacote_id"],
    ["agendamento.cancelado", "motivo_cancelamento_id"],
    ["pagamento.estornado", "pagamento_id"],
    ["prontuario.exportado", "formato"],
    ["sessao.ajustada", "tipo"],
    ["sessao.ajustada", "quantidade"],
    ["atendimento.iniciado", "agendamento_id"],
    ["usuario.papeis.alterados", "papeis_anteriores"],
    ["usuario.papeis.alterados", "papeis_novos"],
  ])("%s rejeita a chave proposta e não homologada %s", (acao, chave) => {
    const erro = rejeicao(acao, { [chave]: "x" });
    expect(erro.motivo).toBe("CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA");
    expect(erro.chaves).toEqual([chave]);
  });
});

describe("cobranca.desconto_aplicado (whitelist: par de desconto)", () => {
  it("aceita exatamente as duas chaves homologadas", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_anterior: "10.00",
        valor_desconto_novo: "15.00",
      }),
    ).toBe("cobranca.desconto_aplicado");
  });

  it("aceita subconjunto das chaves permitidas", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_novo: "15.00",
      }),
    ).toBe("cobranca.desconto_aplicado");
  });

  it("rejeita chave extra ao lado das permitidas — operação inteira", () => {
    const erro = rejeicao("cobranca.desconto_aplicado", {
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "15.00",
      cobranca_id: "b0c1", // não homologada
    });
    expect(erro.motivo).toBe("CHAVE_FORA_DA_WHITELIST");
    expect(erro.chaves).toEqual(["cobranca_id"]);
  });
});

describe("cobranca.data_referencia_recalculada (whitelist: par de datas)", () => {
  it("aceita exatamente as duas chaves homologadas", () => {
    expect(
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_anterior: "2026-08-01",
        data_referencia_nova: "2026-09-01",
      }),
    ).toBe("cobranca.data_referencia_recalculada");
  });

  it("rejeita chave extra — operação inteira", () => {
    const erro = rejeicao("cobranca.data_referencia_recalculada", {
      data_referencia_anterior: "2026-08-01",
      data_referencia_nova: "2026-09-01",
      motivo: "reajuste",
    });
    expect(erro.motivo).toBe("CHAVE_FORA_DA_WHITELIST");
    expect(erro.chaves).toEqual(["motivo"]);
  });
});

describe("retificacao_clinica.efetivada_terceiro", () => {
  it("aceita registro_original_id (única chave homologada)", () => {
    expect(
      validator.validar("retificacao_clinica.efetivada_terceiro", {
        registro_original_id: "3f1a2b3c-0000-4000-8000-000000000001",
      }),
    ).toBe("retificacao_clinica.efetivada_terceiro");
  });

  it("rejeita autor_original_usuario_id — chave EXPRESSAMENTE recusada em docs/09 §12.6", () => {
    const erro = rejeicao("retificacao_clinica.efetivada_terceiro", {
      registro_original_id: "3f1a2b3c-0000-4000-8000-000000000001",
      autor_original_usuario_id: "9f1a2b3c-0000-4000-8000-000000000002",
    });
    expect(erro.motivo).toBe("CHAVE_FORA_DA_WHITELIST");
    expect(erro.chaves).toEqual(["autor_original_usuario_id"]);
  });
});

describe("ausência de sanitização silenciosa", () => {
  it("uma chave inválida entre válidas rejeita a operação inteira — nunca filtra e prossegue", () => {
    const contexto = {
      valor_desconto_anterior: "10.00",
      chave_invalida: "x",
      valor_desconto_novo: "15.00",
    };
    const antes = JSON.stringify(contexto);
    const erro = rejeicao("cobranca.desconto_aplicado", contexto);
    expect(erro.motivo).toBe("CHAVE_FORA_DA_WHITELIST");
    expect(erro.chaves).toEqual(["chave_invalida"]);
    // O candidato não foi mutado: rejeição não é remoção.
    expect(JSON.stringify(contexto)).toBe(antes);
  });

  it("a mensagem de erro cita nomes de chave, nunca valores", () => {
    const erro = rejeicao("cobranca.desconto_aplicado", {
      chave_invalida: "VALOR-SENSIVEL-NAO-PODE-VAZAR",
    });
    expect(erro.message).toContain("chave_invalida");
    expect(erro.message).not.toContain("VALOR-SENSIVEL-NAO-PODE-VAZAR");
  });
});

describe("barreira contra serialização genérica de DTO/request", () => {
  it("rejeita valor objeto em chave permitida (um DTO inteiro não passa)", () => {
    const erro = rejeicao("retificacao_clinica.efetivada_terceiro", {
      registro_original_id: { corpo: "de um DTO inteiro" },
    });
    expect(erro.motivo).toBe("VALOR_NAO_ESCALAR");
    expect(erro.chaves).toEqual(["registro_original_id"]);
  });

  it("rejeita valor array em chave permitida", () => {
    const erro = rejeicao("cobranca.desconto_aplicado", {
      valor_desconto_novo: ["15.00"],
    });
    expect(erro.motivo).toBe("VALOR_NAO_ESCALAR");
    expect(erro.chaves).toEqual(["valor_desconto_novo"]);
  });

  it("rejeita contexto que não é objeto plano (array como contexto)", () => {
    // Um chamador mal tipado pode entregar um array em runtime; o parse de
    // JSON reproduz esse caminho sem burlar o sistema de tipos do validator.
    const contextoArray: ContextoCandidato = JSON.parse(
      '["valor_desconto_novo"]',
    );
    const erro = rejeicao("cobranca.desconto_aplicado", contextoArray);
    expect(erro.motivo).toBe("CONTEXTO_NAO_OBJETO");
  });

  it("aceita escalares JSON nas chaves permitidas (string, number, boolean, null)", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_anterior: null,
        valor_desconto_novo: 15,
      }),
    ).toBe("cobranca.desconto_aplicado");
  });
});

describe("números não finitos NÃO são escalares JSON (F-REV-02)", () => {
  // NaN e ±Infinity não existem em JSON: persistir um deles serializaria
  // silenciosamente para null no jsonb — sanitização silenciosa proibida.
  // Ação homologada com whitelist POSITIVA exercita a validação de VALOR
  // sem implementar nenhum fluxo funcional dessa ação.
  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("rejeita %s em chave permitida, sem mutar o candidato", (_rotulo, valor) => {
    const contexto = { valor_desconto_novo: valor };
    const erro = rejeicao("cobranca.desconto_aplicado", contexto);
    expect(erro.motivo).toBe("VALOR_NAO_ESCALAR");
    expect(erro.chaves).toEqual(["valor_desconto_novo"]);
    // Candidato não mutado: rejeição não é remoção nem substituição por null.
    expect(Object.is(contexto.valor_desconto_novo, valor)).toBe(true);
  });

  it.each([
    ["NaN", Number.NaN, "NaN"],
    ["Infinity", Number.POSITIVE_INFINITY, "Infinity"],
    ["-Infinity", Number.NEGATIVE_INFINITY, "-Infinity"],
  ])(
    "a mensagem de rejeição de %s cita a chave, nunca o valor",
    (_rotulo, valor, formaTextual) => {
      const erro = rejeicao("cobranca.desconto_aplicado", {
        valor_desconto_novo: valor,
      });
      expect(erro.message).toContain("valor_desconto_novo");
      expect(erro.message).not.toContain(formaTextual);
    },
  );

  it.each([
    ["número finito comum", 15.5],
    ["zero", 0],
    ["zero negativo", -0],
    ["Number.MAX_VALUE (finito)", Number.MAX_VALUE],
  ])("continua aceitando %s", (_rotulo, valor) => {
    expect(Number.isFinite(valor)).toBe(true);
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_novo: valor,
      }),
    ).toBe("cobranca.desconto_aplicado");
  });
});
