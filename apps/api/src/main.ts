// TechLab Fisio — bootstrap do backend (Etapa 2.3A, Bloco D).
//
// ESM real (D-ESM-01, docs/08 §16): este arquivo é compilado por `tsc` para
// módulos ES nativos (`module: nodenext`) e executado diretamente por
// `node dist/main.js` em Node 24 — sem loaders experimentais, sem CommonJS.

import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

const PORTA_PADRAO = 3000;

function portaDoAmbiente(): number {
  const bruto = process.env["PORT"];
  if (bruto === undefined || bruto === "") return PORTA_PADRAO;
  const porta = Number.parseInt(bruto, 10);
  if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
    throw new Error(`PORT inválida: valor fora da faixa 0..65535.`);
  }
  return porta;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Encerramento correto (R-BL-02, ponto 5): SIGTERM/SIGINT fecham o servidor
  // HTTP e disparam os hooks de ciclo de vida dos módulos antes de sair.
  app.enableShutdownHooks();

  await app.listen(portaDoAmbiente());
}

await bootstrap();
