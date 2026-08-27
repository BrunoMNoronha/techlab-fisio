// TechLab Fisio — bootstrap + health check (Etapa 2.3A, Blocos B e D;
// movido para a suíte de INTEGRAÇÃO na Etapa 2.3B).
//
// Prova automatizada de que: o módulo raiz carrega; a aplicação NestJS sobe
// como HTTP server real (porta efêmera); `GET /health` responde o contrato
// mínimo; e a aplicação encerra corretamente. Desde a 2.3B o AppModule
// conecta EAGER ao banco no init (DatabaseModule) — por isso este spec exige
// o banco descartável provisionado pelo globalSetup da suíte de integração.
// O smoke da CI (scripts/smoke-api.mjs) continua provando o processo real
// `node dist/main.js` (R-BL-02).

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "@jest/globals";

import { AppModule } from "../../src/app.module.js";

describe("bootstrap e health", () => {
  it("cria a aplicação a partir do AppModule, responde GET /health e encerra", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0); // porta efêmera — nunca disputa a 3000 local

    try {
      const resposta = await fetch(`${await app.getUrl()}/health`);
      expect(resposta.status).toBe(200);
      // Contrato exato: payload mínimo, sem versão, segredo ou detalhe interno.
      expect(await resposta.json()).toEqual({ status: "ok" });
    } finally {
      await app.close();
    }
  });

  it("rota desconhecida responde 404 sem stack trace no corpo", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    try {
      const resposta = await fetch(`${await app.getUrl()}/rota-inexistente`);
      expect(resposta.status).toBe(404);
      const corpo = await resposta.text();
      expect(corpo).not.toContain("at "); // nenhum frame de stack exposto
    } finally {
      await app.close();
    }
  });
});
