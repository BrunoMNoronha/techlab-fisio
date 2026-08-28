// TechLab Fisio — bootstrap do backend (Etapa 2.3A, Bloco D).
//
// ESM real (D-ESM-01, docs/08 §16): este arquivo é compilado por `tsc` para
// módulos ES nativos (`module: nodenext`) e executado diretamente por
// `node dist/main.js` em Node 24 — sem loaders experimentais, sem CommonJS.

import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { POLITICA_COOKIE_SESSAO } from "./auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "./auth/politica-cookie.js";
import { montarDocumentoOpenApi } from "./openapi/documento-openapi.js";

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
  // `R-2.3D-04`: a política de cookie é resolvida DENTRO desta chamada, pela
  // fábrica de `AuthModule`. Configuração insegura ou ambígua faz `create`
  // REJEITAR e o processo sair — a aplicação não sobe com cookie de
  // desenvolvimento em ambiente protegido (`D-2.3D-07`).
  const app = await NestFactory.create(AppModule);

  // CORS permanece DESABILITADO (`D-2.3D-07`): a ausência de `enableCors` é
  // deliberada e é parte da baseline CSRF — enquanto a arquitetura for
  // same-origin, não existe origem externa legítima. Habilitá-lo aqui
  // esvaziaria a barreira do custom request header.

  // `D-2.3D-11`: o documento é sempre CONSTRUÍDO — decorator quebrado vira
  // falha de bootstrap. A rota que o serve só é montada fora de
  // produção/homologação (decisão local, ver `documento-openapi.ts`).
  const politicaCookie = app.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
  montarDocumentoOpenApi(app, politicaCookie.ambiente);

  // Encerramento correto (R-BL-02, ponto 5): SIGTERM/SIGINT fecham o servidor
  // HTTP e disparam os hooks de ciclo de vida dos módulos antes de sair.
  app.enableShutdownHooks();

  await app.listen(portaDoAmbiente());
}

await bootstrap();
