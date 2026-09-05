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

describe("catálogo homologado (D-AUD-01 / D-AUD-02 / PBACK-AUD-09)", () => {
  it("contém exatamente as 24 ações de docs/09 §12.2 + `autorizacao.negada` (§13.4.1) = 25", () => {
    expect(ACOES_AUDITORIA).toHaveLength(25);
    expect(new Set(ACOES_AUDITORIA).size).toBe(25);
    // A 25ª é a ÚNICA acrescentada depois de D-AUD-01, e fica ao final para
    // que a ordem da fonte original permaneça reconhecível.
    expect(ACOES_AUDITORIA[24]).toBe("autorizacao.negada");
  });

  it("o catálogo de resultado é exatamente SUCESSO | NEGADO | FALHA", () => {
    expect(RESULTADOS_AUDITORIA).toEqual(["SUCESSO", "NEGADO", "FALHA"]);
  });

  it("a whitelist declara TODAS as 25 ações e somente três não vazias (D-AUD-07)", () => {
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

// As ações abaixo estão FORA do catálogo por decisão homologada, e continuam
// fora após docs/09 §13 (PBACK-AUD-01..PBACK-AUD-04), que fechou as matérias
// correspondentes sem acrescentar ação alguma. Este bloco é a trava: incluir
// qualquer uma delas no catálogo faz este teste falhar, de modo que a
// introdução exige alterar DECISÃO e TESTE — nunca só o código.
//
// Isto registra o estado normativo VIGENTE, não uma proibição eterna — e o
// precedente é `autorizacao.negada`: esteve nesta lista até PBACK-AUD-09
// (docs/09 §13.4.1, 05/09/2026) decidir sua entrada, com whitelist VAZIA e
// emissão restrita; saiu daqui por DECISÃO e TESTE, como a trava exige.
describe("ação desconhecida → rejeição explícita", () => {
  it.each([
    "acao.inexistente",
    // SF — D-AUD-05, confirmados por docs/09 §13:
    "paciente.cadastro.alterado", // §13.5 — política de L-08 fechada; ação NÃO criada
    // `prontuario.acessado`: L-06 permanece ABERTA / BLOQUEADA (docs/09
    // §13.3). A matéria NÃO foi encerrada — TLF-BASE-V1 §10 exige trilha de
    // auditoria para ACESSO a dados sensíveis —, mas a ação não pode ser
    // definida sem `P2.2-05` e sem superfície real de leitura clínica.
    // Qualquer inclusão futura depende de DECISÃO FORMAL própria; até lá, a
    // rejeição é o comportamento correto e este teste a protege.
    "prontuario.acessado",
    "auditoria.consultada", // §13.9 — expressamente não criada
    "AUTORIZACAO.NEGADA", // caixa diferente não é a ação homologada por §13.4.1
    "autorizacao.negada.senha", // variantes não existem: a ação é única e restrita pelo EMISSOR
    // RC — D-AUD-04, confirmadas por docs/09 §13.2 (PBACK-AUD-01): as
    // transições de agenda fora das 4 ações homologadas seguem atribuíveis
    // por `historico_agendamento`, não por evento de auditoria.
    "agendamento.confirmado",
    "agendamento.checkin",
    "agendamento.falta_registrada",
    "agendamento.concluido",
    "bloqueio_agenda.criado",
    "paciente.situacao.alterada", // RC — §13.5: não criada com a política de L-08
    "USUARIO.AUTENTICACAO", // caixa diferente não é a ação homologada
    "",
  ])('rejeita "%s" mesmo com contexto vazio', (acao) => {
    const erro = rejeicao(acao, {});
    expect(erro.motivo).toBe("ACAO_DESCONHECIDA");
    expect(erro.acao).toBe(acao);
  });
});

describe("whitelist vazia → nenhum contexto não vazio (22 ações)", () => {
  const acoesComWhitelistVazia = Object.entries(WHITELIST_CONTEXTO)
    .filter(([, chaves]) => chaves.length === 0)
    .map(([acao]) => acao);

  it("são exatamente 22 ações (21 de D-AUD-07 + `autorizacao.negada` de PBACK-AUD-09)", () => {
    expect(acoesComWhitelistVazia).toHaveLength(22);
    expect(acoesComWhitelistVazia).toContain("autorizacao.negada");
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
    ["configuracao.alterada", "campos_alterados"], // §13.6 — whitelist FECHADA COMO VAZIA
    ["sessao.consumida", "atendimento_id"],
    ["sessao.consumida", "pacote_id"],
    ["agendamento.cancelado", "motivo_cancelamento_id"],
    ["pagamento.estornado", "pagamento_id"],
    ["prontuario.exportado", "formato"], // §13.7 — alvo fechado como `paciente`, SEM chave
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

// docs/13 A-12 — a 25ª ação entra com whitelist VAZIA. As chaves abaixo foram
// cogitadas no pacote decisório (R′: `permissao_requerida`; R″: `motivo`) ou
// são dado pessoal/controlado pelo cliente (`ip`, `identificador`, ...) e
// PBACK-AUD-09 recusou TODAS: a permissão exigida é o ALVO do evento, não uma
// chave de contexto. O par positivo (contexto vazio/ausente aceito, no bloco
// `it.each(ACOES_AUDITORIA)` acima) impede que estas rejeições sejam
// vacuamente verdes.
describe("autorizacao.negada (PBACK-AUD-09 — whitelist VAZIA por decisão)", () => {
  it("aceita contexto vazio e ausente; `resultado` NEGADO é homologado por D-AUD-02", () => {
    expect(validator.validar("autorizacao.negada", {})).toBe("autorizacao.negada");
    expect(validator.validar("autorizacao.negada")).toBe("autorizacao.negada");
    expect(RESULTADOS_AUDITORIA).toContain("NEGADO");
  });

  it.each([
    "permissao_requerida",
    "motivo",
    "ip",
    "identificador",
    "email",
    "corpo",
    "rota",
    "sessao_id",
    "usuario_alvo_id",
  ])("rejeita a chave %s — nenhuma chave foi homologada para a ação", (chave) => {
    const erro = rejeicao("autorizacao.negada", { [chave]: "x" });
    expect(erro.motivo).toBe("CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA");
    expect(erro.chaves).toEqual([chave]);
    expect(erro.message).not.toContain('"x"');
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

  // Rejeição confirmada por docs/09 §13.8 (PBACK-AUD-07) após a recusa
  // original de D-AUD-07 (§12.6): a informação é derivável por
  // `registro_original_id` -> `registro_clinico.autor_usuario_id`, sobre
  // valor tornado imutável pelo trigger de append-only. O teste positivo
  // acima (aceita `registro_original_id`) impede que este par fique
  // vacuamente verde.
  it("rejeita autor_original_usuario_id — chave recusada em docs/09 §12.6 e confirmada em §13.8", () => {
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

  it("aceita escalares JSON em chave permitida SEM regra semântica registrada", () => {
    // F-2.3C-REV-01: as chaves monetárias de `cobranca.desconto_aplicado`
    // ganharam regra semântica própria (ver bloco no fim do arquivo); a
    // aceitação estrutural genérica de escalares continua valendo apenas
    // para chaves homologadas SEM regra registrada — nenhuma regra foi
    // inventada para datas/uuid nesta correção.
    expect(
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_anterior: null,
        data_referencia_nova: 15,
      }),
    ).toBe("cobranca.data_referencia_recalculada");
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
  ])("continua aceitando %s em chave SEM regra semântica", (_rotulo, valor) => {
    // Desde F-2.3C-REV-01, número finito deixou de ser aceito nas chaves
    // MONETÁRIAS (regra semântica própria — bloco abaixo); a aceitação
    // estrutural de números finitos permanece para chave sem regra.
    expect(Number.isFinite(valor)).toBe(true);
    expect(
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_nova: valor,
      }),
    ).toBe("cobranca.data_referencia_recalculada");
  });
});

describe("F-2.3C-REV-01 — validação semântica das chaves monetárias de cobranca.desconto_aplicado", () => {
  it("aceita o par canônico mínimo", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_anterior: "0.00",
        valor_desconto_novo: "10.00",
      }),
    ).toBe("cobranca.desconto_aplicado");
  });

  it("aceita o limite superior de numeric(12,2)", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_anterior: "9999999999.98",
        valor_desconto_novo: "9999999999.99",
      }),
    ).toBe("cobranca.desconto_aplicado");
  });

  const invalidosEscalares: Array<[string, unknown]> = [
    ['string "10" (sem casas)', "10"],
    ['string "10.0" (uma casa)', "10.0"],
    ['string "01.00" (zero à esquerda)', "01.00"],
    ['string "-1.00" (sinal negativo)', "-1.00"],
    ['string "+1.00" (sinal positivo)', "+1.00"],
    ['string "1e2" (notação científica)', "1e2"],
    ['string "10,00" (vírgula)', "10,00"],
    ['string "abc"', "abc"],
    ["string vazia", ""],
    ['string " 10.00" (espaço à esquerda)', " 10.00"],
    ['string "10.00 " (espaço à direita)', "10.00 "],
    ['string "10000000000.00" (11 dígitos inteiros)', "10000000000.00"],
    ["number 10", 10],
    ["number 10.5", 10.5],
    ["null", null],
    ["boolean true", true],
    ["boolean false", false],
  ];

  for (const chave of ["valor_desconto_anterior", "valor_desconto_novo"]) {
    describe(`chave ${chave}`, () => {
      it.each(invalidosEscalares)(
        "rejeita %s como VALOR_SEMANTICAMENTE_INVALIDO",
        (_rotulo, valor) => {
          const contexto = {
            valor_desconto_anterior: "0.00",
            valor_desconto_novo: "10.00",
            [chave]: valor,
          };
          const erro = rejeicao("cobranca.desconto_aplicado", contexto);
          expect(erro.motivo).toBe("VALOR_SEMANTICAMENTE_INVALIDO");
          expect(erro.chaves).toEqual([chave]);
        },
      );

      it.each([
        ["NaN", Number.NaN],
        ["Infinity", Number.POSITIVE_INFINITY],
      ])(
        "rejeita %s ANTES, pela barreira estrutural (VALOR_NAO_ESCALAR)",
        (_rotulo, valor) => {
          const erro = rejeicao("cobranca.desconto_aplicado", {
            [chave]: valor,
          });
          expect(erro.motivo).toBe("VALOR_NAO_ESCALAR");
        },
      );

      it.each([
        ["objeto", { valor: "10.00" }],
        ["array", ["10.00"]],
      ])("rejeita %s pela barreira estrutural (VALOR_NAO_ESCALAR)", (_rotulo, valor) => {
        const erro = rejeicao("cobranca.desconto_aplicado", {
          [chave]: valor,
        });
        expect(erro.motivo).toBe("VALOR_NAO_ESCALAR");
      });
    });
  }

  it("as DUAS chaves inválidas são citadas juntas, sem valores na mensagem", () => {
    const erro = rejeicao("cobranca.desconto_aplicado", {
      valor_desconto_anterior: "SEGREDO-A-NAO-VAZAR",
      valor_desconto_novo: "10,00",
    });
    expect(erro.motivo).toBe("VALOR_SEMANTICAMENTE_INVALIDO");
    expect(erro.chaves).toEqual([
      "valor_desconto_anterior",
      "valor_desconto_novo",
    ]);
    expect(erro.message).not.toContain("SEGREDO-A-NAO-VAZAR");
    expect(erro.message).not.toContain("10,00");
  });

  it("nenhuma conversão/normalização: o candidato rejeitado não é mutado", () => {
    const contexto = { valor_desconto_novo: "10" };
    const antes = JSON.stringify(contexto);
    rejeicao("cobranca.desconto_aplicado", contexto);
    expect(JSON.stringify(contexto)).toBe(antes);
  });

  it("NÃO amplia silenciosamente para as demais whitelists positivas", () => {
    // Datas e uuid não ganharam regra nesta correção (sem fonte homologada):
    // continuam sob as barreiras estruturais apenas.
    expect(
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_anterior: "qualquer-string",
      }),
    ).toBe("cobranca.data_referencia_recalculada");
    expect(
      validator.validar("retificacao_clinica.efetivada_terceiro", {
        registro_original_id: "qualquer-string",
      }),
    ).toBe("retificacao_clinica.efetivada_terceiro");
  });
});
