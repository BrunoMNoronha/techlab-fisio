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
});
