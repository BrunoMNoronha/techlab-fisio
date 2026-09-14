// TechLab Fisio — teste unitário de HealthController.
//
// Valida que o HealthController instancia corretamente e retorna a resposta
// com o contrato mínimo de infraestrutura `{ status: "ok" }`.

import { describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";

import { HealthController } from "../src/health/health.controller.js";
import { HealthModule } from "../src/health/health.module.js";

describe("HealthController", () => {
  it("retorna { status: 'ok' } quando chamado diretamente", () => {
    const controller = new HealthController();
    const resposta = controller.verificar();

    expect(resposta).toEqual({ status: "ok" });
  });

  it("retorna { status: 'ok' } quando resolvido pelo container de DI do NestJS", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    const controller = moduleRef.get<HealthController>(HealthController);
    expect(controller).toBeDefined();
    expect(controller.verificar()).toEqual({ status: "ok" });
  });
});
