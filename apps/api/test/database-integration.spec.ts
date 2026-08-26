// TechLab Fisio — integração mínima com `packages/database` (Etapa 2.3A,
// Bloco C).
//
// Prova que `apps/api` consome a API PÚBLICA do workspace de persistência
// (`@techlab-fisio/database` — ponto de entrada declarado no `exports` do
// pacote), sem importar caminhos internos. Nenhuma conexão real é aberta:
// o mapeamento de erros por constraint (V-03, decisão C-6) é código puro e
// fail-closed, verificável com formas de erro sintéticas idênticas às
// medidas em V-03. A suíte de integração com PostgreSQL real permanece no
// próprio pacote de banco, inalterada.

import { describe, expect, it } from "@jest/globals";

import {
  CONSTRAINT_CONSUMO_UNICO,
  CONSTRAINTS_CONFLITO_AGENDA,
  ehConflitoAgenda,
  ehConsumoDuplicado,
  identificarViolacao,
} from "@techlab-fisio/database";

/** Reproduz a forma MEDIDA (V-03) do erro que chega à aplicação. */
function erroSintetico(
  sqlstate: string,
  mensagem: string,
): Record<string, unknown> {
  return {
    code: "P2039",
    meta: {
      driverAdapterError: {
        cause: { originalCode: sqlstate, originalMessage: mensagem },
      },
    },
  };
}

describe("consumo da API pública de @techlab-fisio/database", () => {
  it("expõe as constantes homologadas das constraints críticas", () => {
    expect(CONSTRAINT_CONSUMO_UNICO).toBe(
      "ux_movimento_sessao_consumo_atendimento_pacote",
    );
    expect(CONSTRAINTS_CONFLITO_AGENDA).toEqual([
      "ex_agendamento_profissional",
      "ex_agendamento_paciente",
    ]);
  });

  it("identifica violação de exclusion de agenda (forma medida em V-03)", () => {
    const erro = erroSintetico(
      "23P01",
      'conflicting key value violates exclusion constraint "ex_agendamento_profissional"',
    );
    const violacao = identificarViolacao(erro);
    expect(violacao?.classe).toBe("EXCLUSION");
    expect(violacao?.constraint).toBe("ex_agendamento_profissional");
    expect(ehConflitoAgenda(erro)).toBe(true);
    expect(ehConsumoDuplicado(erro)).toBe(false);
  });

  it("permanece fail-closed para erro desconhecido (docs/07 §18)", () => {
    const erroQualquer = new Error("falha desconhecida");
    expect(identificarViolacao(erroQualquer)).toBeNull();
    expect(ehConsumoDuplicado(erroQualquer)).toBe(false);
    expect(ehConflitoAgenda(erroQualquer)).toBe(false);
  });
});
