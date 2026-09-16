// TechLab Fisio — T-AUD-CONTEXTO (parte de integração) — Etapa 2.3A.
//
// Prova que a política exercida pela APLICAÇÃO é a MESMA testada
// unitariamente: o provider é resolvido a partir do módulo raiz real
// (AppModule → AuditModule), pelo container de injeção do NestJS — não uma
// fixture desconectada. Qualquer divergência entre o que o container entrega
// e o que os testes unitários cobrem falharia aqui.

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import {
  AuditContextValidator,
  ErroContextoAuditoria,
} from "../src/audit/audit-context.validator.js";

/** Captura o erro tipado lançado, falhando se nada for lançado. */
function capturar(acao: () => unknown): ErroContextoAuditoria {
  try {
    acao();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroContextoAuditoria);
    return erro as ErroContextoAuditoria;
  }
  throw new Error("Esperava rejeição, mas o contexto foi aceito.");
}

describe("AuditModule via container NestJS real (AppModule)", () => {
  let moduleRef: TestingModule;
  let validator: AuditContextValidator;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    validator = moduleRef.get(AuditContextValidator);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("o provider resolvido é a implementação única do validator", () => {
    expect(validator).toBeInstanceOf(AuditContextValidator);
  });

  it("aceita, através do container, o par homologado de desconto", () => {
    expect(
      validator.validar("cobranca.desconto_aplicado", {
        valor_desconto_anterior: "10.00",
        valor_desconto_novo: "15.00",
      }),
    ).toBe("cobranca.desconto_aplicado");
  });

  it("rejeita, através do container, ação desconhecida", () => {
    expect(() => validator.validar("acao.inexistente", {})).toThrow(
      ErroContextoAuditoria,
    );
  });

  it("rejeita, através do container, contexto não vazio em whitelist vazia", () => {
    expect(() =>
      validator.validar("pagamento.registrado", { pagamento_id: "p1" }),
    ).toThrow(ErroContextoAuditoria);
  });

  it("rejeita, através do container, a chave recusada autor_original_usuario_id", () => {
    expect(() =>
      validator.validar("retificacao_clinica.efetivada_terceiro", {
        autor_original_usuario_id: "u1",
      }),
    ).toThrow(ErroContextoAuditoria);
  });

  // D-AUD-09 (docs/09 §14) — a semântica das duas whitelists positivas
  // restantes também é exercida pelo provider que a APLICAÇÃO resolve, não
  // apenas pela instância construída à mão nos testes unitários.
  it("aceita, através do container, o par de datas civis canônicas", () => {
    expect(
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_anterior: "2026-08-31",
        data_referencia_nova: "2024-02-29",
      }),
    ).toBe("cobranca.data_referencia_recalculada");
  });

  it("rejeita, através do container, data inexistente no calendário gregoriano", () => {
    const erro = capturar(() =>
      validator.validar("cobranca.data_referencia_recalculada", {
        data_referencia_nova: "1900-02-29",
      }),
    );
    expect(erro.motivo).toBe("VALOR_SEMANTICAMENTE_INVALIDO");
    expect(erro.chaves).toEqual(["data_referencia_nova"]);
    expect(erro.message).not.toContain("1900-02-29");
  });

  it("aceita, através do container, registro_original_id em uuid canônico", () => {
    expect(
      validator.validar("retificacao_clinica.efetivada_terceiro", {
        registro_original_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toBe("retificacao_clinica.efetivada_terceiro");
  });

  it("rejeita, através do container, uuid não canônico (maiúsculas)", () => {
    const erro = capturar(() =>
      validator.validar("retificacao_clinica.efetivada_terceiro", {
        registro_original_id: "550E8400-E29B-41D4-A716-446655440000",
      }),
    );
    expect(erro.motivo).toBe("VALOR_SEMANTICAMENTE_INVALIDO");
    expect(erro.chaves).toEqual(["registro_original_id"]);
    expect(erro.message).not.toContain("550E8400");
  });
});
