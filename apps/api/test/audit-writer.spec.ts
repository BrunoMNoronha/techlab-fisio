// TechLab Fisio — AuditWriter (Etapa 2.3B) — parte unitária, sem banco.
//
// Prova o CONTRATO do writer com um cliente transacional falso que apenas
// captura chamadas:
//   - política sempre executada antes da escrita (validator no caminho);
//   - mapeamento explícito campo a campo (nenhum campo extra, nenhum spread
//     do candidato);
//   - somente create — a superfície pública não oferece update/delete;
//   - rejeições do validator propagadas sem sanitização e sem escrita;
//   - nenhum VALOR de contexto vaza em mensagem de erro;
//   - defesa em profundidade: cliente raiz (não transacional) é recusado.
//
// A prova REAL de atomicidade (rollback no PostgreSQL) está na suíte de
// integração — mock não é prova suficiente e não é tratado como tal.

import { describe, expect, it } from "@jest/globals";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditContextValidator, ErroContextoAuditoria } from "../src/audit/audit-context.validator.js";
import { AuditWriter, ErroEscritaAuditoria } from "../src/audit/audit-writer.js";
import type { EventoAuditoriaCandidato } from "../src/audit/audit-writer.js";

interface ChamadaCreate {
  data: Record<string, unknown>;
}

function criarTxFalsa(): { tx: TransacaoPersistencia; chamadas: ChamadaCreate[] } {
  const chamadas: ChamadaCreate[] = [];
  const tx = {
    eventoAuditoria: {
      create: async (chamada: ChamadaCreate) => {
        chamadas.push(chamada);
        return {};
      },
    },
  } as unknown as TransacaoPersistencia;
  return { tx, chamadas };
}

function criarWriter(): AuditWriter {
  return new AuditWriter(new AuditContextValidator());
}

function candidatoBase(
  sobrescrever?: Partial<EventoAuditoriaCandidato>,
): EventoAuditoriaCandidato {
  return {
    acao: "profissional.situacao.alterada",
    ocorridoEm: new Date("2026-08-26T12:00:00Z"),
    atorUsuarioId: "0198f3f0-0000-7000-8000-000000000001",
    alvoTipo: "profissional",
    alvoId: "0198f3f0-0000-7000-8000-000000000002",
    resultado: "SUCESSO",
    justificativa: null,
    correlacaoId: "0198f3f0-0000-7000-8000-000000000003",
    ...sobrescrever,
  };
}

describe("AuditWriter — escrita válida", () => {
  it("persiste evento de whitelist vazia com mapeamento explícito e SEM contexto", async () => {
    const { tx, chamadas } = criarTxFalsa();
    await criarWriter().registrar(tx, candidatoBase());

    expect(chamadas).toHaveLength(1);
    const dados = chamadas[0]?.data ?? {};
    expect(dados).toEqual({
      acao: "profissional.situacao.alterada",
      ocorridoEm: new Date("2026-08-26T12:00:00Z"),
      atorUsuarioId: "0198f3f0-0000-7000-8000-000000000001",
      alvoTipo: "profissional",
      alvoId: "0198f3f0-0000-7000-8000-000000000002",
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId: "0198f3f0-0000-7000-8000-000000000003",
    });
    // Ausência de contexto => a chave nem aparece (coluna fica NULL).
    expect(Object.keys(dados)).not.toContain("contexto");
  });

  it("persiste o par homologado de desconto EXATAMENTE como validado", async () => {
    const { tx, chamadas } = criarTxFalsa();
    const contexto = {
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "15.00",
    };
    await criarWriter().registrar(
      tx,
      candidatoBase({
        acao: "cobranca.desconto_aplicado",
        alvoTipo: "cobranca",
        contexto,
      }),
    );
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.data["contexto"]).toEqual({
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "15.00",
    });
    // Nenhuma cópia filtrada/sanitizada: o objeto persiste como enviado.
    expect(contexto).toEqual({
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "15.00",
    });
  });
});

describe("AuditWriter — rejeições fail-closed (nenhuma escrita)", () => {
  it("ação desconhecida → ErroContextoAuditoria e zero create", async () => {
    const { tx, chamadas } = criarTxFalsa();
    await expect(
      criarWriter().registrar(tx, candidatoBase({ acao: "acao.inexistente" })),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    expect(chamadas).toHaveLength(0);
  });

  it("contexto não vazio em whitelist vazia → rejeição e zero create", async () => {
    const { tx, chamadas } = criarTxFalsa();
    await expect(
      criarWriter().registrar(
        tx,
        candidatoBase({ contexto: { ativo_anterior: true, ativo_novo: false } }),
      ),
    ).rejects.toMatchObject({ motivo: "CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA" });
    expect(chamadas).toHaveLength(0);
  });

  it("chave proibida junto de chave válida → operação INTEIRA rejeitada, sem sanitização", async () => {
    const { tx, chamadas } = criarTxFalsa();
    const contexto = {
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "15.00",
      cpf_paciente: "00000000000",
    };
    await expect(
      criarWriter().registrar(
        tx,
        candidatoBase({ acao: "cobranca.desconto_aplicado", contexto }),
      ),
    ).rejects.toMatchObject({ motivo: "CHAVE_FORA_DA_WHITELIST" });
    expect(chamadas).toHaveLength(0);
    // Nenhuma mutação do candidato (sem remoção de chave e prosseguimento).
    expect(Object.keys(contexto)).toHaveLength(3);
  });

  it("objeto/array em valor de contexto → rejeição estrutural e zero create", async () => {
    const { tx, chamadas } = criarTxFalsa();
    await expect(
      criarWriter().registrar(
        tx,
        candidatoBase({
          acao: "cobranca.desconto_aplicado",
          contexto: { valor_desconto_anterior: { dto: "inteiro" } },
        }),
      ),
    ).rejects.toMatchObject({ motivo: "VALOR_NAO_ESCALAR" });
    expect(chamadas).toHaveLength(0);
  });

  it("número não finito em chave permitida → rejeição do validator e zero create (F-REV-02)", async () => {
    const { tx, chamadas } = criarTxFalsa();
    await expect(
      criarWriter().registrar(
        tx,
        candidatoBase({
          acao: "cobranca.desconto_aplicado",
          contexto: { valor_desconto_novo: Number.NaN },
        }),
      ),
    ).rejects.toMatchObject({ motivo: "VALOR_NAO_ESCALAR" });
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    ['string "10,00" (vírgula)', "10,00"],
    ['string "10" (sem casas)', "10"],
    ["number 10", 10],
    ["string arbitrária com conteúdo sensível", "PACIENTE: DADO QUE NÃO DEVE ENTRAR"],
  ])(
    "F-2.3C-REV-01: chave monetária homologada com %s → zero create e rejeição semântica",
    async (_rotulo, valor) => {
      const { tx, chamadas } = criarTxFalsa();
      await expect(
        criarWriter().registrar(
          tx,
          candidatoBase({
            acao: "cobranca.desconto_aplicado",
            alvoTipo: "cobranca",
            contexto: { valor_desconto_anterior: "0.00", valor_desconto_novo: valor },
          }),
        ),
      ).rejects.toMatchObject({ motivo: "VALOR_SEMANTICAMENTE_INVALIDO" });
      expect(chamadas).toHaveLength(0);
    },
  );

  it("F-2.3C-REV-01: a rejeição semântica não ecoa o valor inválido", async () => {
    const { tx } = criarTxFalsa();
    const valorSensivel = "PACIENTE: DADO QUE NÃO DEVE ENTRAR";
    let mensagem = "";
    try {
      await criarWriter().registrar(
        tx,
        candidatoBase({
          acao: "cobranca.desconto_aplicado",
          alvoTipo: "cobranca",
          contexto: { valor_desconto_novo: valorSensivel },
        }),
      );
    } catch (erro) {
      mensagem = erro instanceof Error ? erro.message : String(erro);
    }
    expect(mensagem).toContain("valor_desconto_novo");
    expect(mensagem).not.toContain(valorSensivel);
    expect(mensagem).not.toContain("PACIENTE");
  });

  it("mensagens de rejeição citam chaves, nunca VALORES", async () => {
    const { tx } = criarTxFalsa();
    const valorSensivel = "dado-sensivel-que-nao-pode-vazar";
    let mensagem = "";
    try {
      await criarWriter().registrar(
        tx,
        candidatoBase({ contexto: { chave_qualquer: valorSensivel } }),
      );
    } catch (erro) {
      mensagem = erro instanceof Error ? erro.message : String(erro);
    }
    expect(mensagem).toContain("chave_qualquer");
    expect(mensagem).not.toContain(valorSensivel);
  });
});

describe("AuditWriter — contrato estrutural", () => {
  it("recusa cliente NÃO transacional (defesa em profundidade)", async () => {
    const chamadas: ChamadaCreate[] = [];
    const clienteRaiz = {
      $transaction: async () => undefined,
      $connect: async () => undefined,
      eventoAuditoria: {
        create: async (chamada: ChamadaCreate) => {
          chamadas.push(chamada);
          return {};
        },
      },
    } as unknown as TransacaoPersistencia;
    await expect(
      criarWriter().registrar(clienteRaiz, candidatoBase()),
    ).rejects.toBeInstanceOf(ErroEscritaAuditoria);
    expect(chamadas).toHaveLength(0);
  });

  it("a superfície pública oferece somente registrar — nenhum update/delete", () => {
    expect(Object.getOwnPropertyNames(AuditWriter.prototype).sort()).toEqual([
      "constructor",
      "registrar",
    ]);
  });
});
