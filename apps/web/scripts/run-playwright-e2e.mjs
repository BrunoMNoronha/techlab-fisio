// TechLab Fisio — Orquestrador oficial da suíte Playwright (CI-E2E0).
//
// Comando oficial (local e CI): `pnpm run test:e2e` na raiz
// (= `pnpm --filter @techlab-fisio/web run test:e2e`).
// Pré-requisitos: Docker ativo, `.env` sintético (cópia de `.env.example`),
// `pnpm run build` e `pnpm --filter @techlab-fisio/web exec playwright install chromium`.
//
// A cada execução prepara um ambiente NOVO — nada é reaproveitado de execuções
// anteriores nem de servidores já iniciados na máquina:
//   1. PostgreSQL 18 descartável (container + volume novos, initdb versionado);
//   2. `prisma migrate deploy` com a role de migration;
//   3. Administrador e clínica SINTÉTICOS pelo CLI compilado real da API;
//   4. API NestJS compilada (`apps/api/dist/main.js`) em porta efêmera, role
//      `tlf_app`, `TLF_AMBIENTE=teste`; readiness por `GET /health` = 200;
//   5. `playwright test`: o `webServer` do `playwright.config.ts` sobe o
//      Next.js compilado em OUTRA porta efêmera, com `URL_API_INTERNA` apontando
//      para a API, e só libera os testes quando `GET /api/health` responde 200
//      PELO PROXY same-origin (navegador → Next.js `/api/*` → NestJS).
//
// Nenhum controle de segurança é relaxado (CSRF, cookie HttpOnly/SameSite).
// Argumentos extras são repassados ao `playwright test`.
// O exit code é o do `playwright test`; resíduo descartável também reprova.
// Limpeza garantida (finally), inclusive em Ctrl+C/SIGTERM; órfãos de execuções
// interrompidas à força são removidos no início (fail-closed por prefixo).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import {
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  migrateDeploy,
  removerOrfaos,
} from "../../../scripts/lib/instancia-descartavel.mjs";
import {
  aguardarHttpOk,
  encerrarArvoreGraciosamente,
  encerrarProcesso,
  executarCliProvisionamento,
  obterPortaLivre,
} from "./lib/processos.mjs";

const PREFIXO = "techlab-fisio-pwe2e-";
const ROTULO = "[playwright-e2e]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const raizWeb = path.join(raizRepo, "apps", "web");
const raizApi = path.join(raizRepo, "apps", "api");

// Dados EXCLUSIVAMENTE sintéticos, válidos só no banco descartável desta execução.
const ADMIN_EMAIL = "admin.playwright@clinica.exemplo";
const ADMIN_NOME = "Administrador Playwright E2E";
const ADMIN_SENHA = "SenhaPlaywright123!@#";
const ADMIN_JUSTIFICATIVA = "Bootstrap para suite Playwright E2E (CI-E2E0)";
const CLINICA_NOME = "Clinica Playwright E2E";
const CLINICA_FUSO = "America/Sao_Paulo";
const CLINICA_JUSTIFICATIVA = "Bootstrap da clinica para suite Playwright E2E (CI-E2E0)";

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

async function main() {
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });
  const cred = credenciaisDoAmbiente();

  const apiDist = path.join(raizApi, "dist", "main.js");
  if (!existsSync(apiDist) || !existsSync(path.join(raizApi, "dist", "provisionamento", "cli.js"))) {
    falhar(`artefato compilado da API ausente (${apiDist}). Execute 'pnpm run build' primeiro.`);
  }
  if (!existsSync(path.join(raizWeb, ".next", "BUILD_ID"))) {
    falhar("build de produção do frontend ausente (apps/web/.next). Execute 'pnpm run build' primeiro.");
  }

  const requireWeb = createRequire(path.join(raizWeb, "package.json"));
  const playwrightCli = requireWeb.resolve("@playwright/test/cli");

  removerOrfaos(PREFIXO, ROTULO);

  let instancia = null;
  let processoApi = null;
  let processoPlaywright = null;
  let interrompido = false;
  let codigoSaida = 1;

  // Ctrl+C/SIGTERM: pede encerramento GRACIOSO da árvore do Playwright — ele
  // precisa rodar o próprio teardown e derrubar o `webServer` (`next start`),
  // que em POSIX é neto deste processo. Só depois o `finally` destrói API e
  // banco; sem o handler, o Node sairia na hora e deixaria tudo de pé.
  const aoInterromper = (sinal) => {
    interrompido = true;
    console.error(`${ROTULO} ${sinal} recebido — encerrando e limpando...`);
    if (processoPlaywright) void encerrarArvoreGraciosamente(processoPlaywright);
  };
  process.on("SIGINT", aoInterromper);
  process.on("SIGTERM", aoInterromper);

  try {
    instancia = await criarInstanciaLimpa({ raizRepo, prefixo: PREFIXO, rotulo: ROTULO, cred });
    migrateDeploy(raizRepo, instancia.urlMigrador, cred.roleMigrador, ROTULO);
    if (interrompido) falhar("interrompido antes do provisionamento.");

    console.log(`${ROTULO} provisionando Administrador e clínica sintéticos via CLI compilado...`);
    executarCliProvisionamento(
      raizApi,
      "provisionar",
      instancia.urlApp,
      {
        TLF_BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
        TLF_BOOTSTRAP_ADMIN_NOME: ADMIN_NOME,
        TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA: ADMIN_JUSTIFICATIVA,
        TLF_BOOTSTRAP_ADMIN_SENHA: ADMIN_SENHA,
      },
      ROTULO,
    );
    executarCliProvisionamento(
      raizApi,
      "bootstrap-clinica",
      instancia.urlApp,
      {
        TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL: CLINICA_NOME,
        TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: CLINICA_FUSO,
        TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA: CLINICA_JUSTIFICATIVA,
      },
      ROTULO,
    );

    // Portas explícitas e efêmeras: nunca os defaults (API e `next start` usam
    // 3000; o proxy assume 3001), nunca um servidor já em execução.
    const portaApi = await obterPortaLivre();
    console.log(`${ROTULO} iniciando API NestJS compilada (porta ${portaApi})...`);
    processoApi = spawn(process.execPath, [apiDist], {
      cwd: raizRepo,
      env: {
        ...process.env,
        DATABASE_URL: instancia.urlApp,
        PORT: String(portaApi),
        TLF_AMBIENTE: "teste",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let saidaApi = "";
    processoApi.stdout.on("data", (d) => { saidaApi += String(d); });
    processoApi.stderr.on("data", (d) => { saidaApi += String(d); });

    if (!(await aguardarHttpOk(`http://127.0.0.1:${portaApi}/health`, 30_000))) {
      falhar(`API não respondeu 200 em /health dentro do limite:\n${saidaApi}`);
    }
    console.log(`${ROTULO} API saudável.`);
    if (interrompido) falhar("interrompido antes do playwright test.");

    const portaWeb = await obterPortaLivre();
    console.log(`${ROTULO} executando playwright test (Next.js na porta ${portaWeb})...`);
    processoPlaywright = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
      cwd: raizWeb,
      // POSIX: líder do próprio grupo, para que a interrupção alcance também o
      // `webServer` que o Playwright cria (`kill(-pid)`). No Windows o console
      // já entrega o Ctrl+C à árvore, e `detached` abriria outra janela.
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        TLF_E2E_PORTA_WEB: String(portaWeb),
        URL_API_INTERNA: `http://127.0.0.1:${portaApi}`,
        TLF_E2E_ADMIN_IDENTIFICADOR: ADMIN_EMAIL,
        TLF_E2E_ADMIN_SENHA: ADMIN_SENHA,
      },
      stdio: "inherit",
    });
    codigoSaida = await new Promise((resolve) => {
      processoPlaywright.on("error", () => resolve(1));
      processoPlaywright.on("exit", (codigo) => resolve(codigo ?? 1));
    });
    if (interrompido && codigoSaida === 0) codigoSaida = 1;
    if (codigoSaida !== 0) {
      console.error(
        `${ROTULO} playwright test terminou com exit ${codigoSaida}. Últimas linhas da API:\n` +
          saidaApi.split("\n").slice(-40).join("\n"),
      );
    }
  } finally {
    console.log(`${ROTULO} encerrando API e destruindo instância descartável...`);
    encerrarProcesso(processoApi);
    if (instancia) {
      const residuo = destruirInstancia(instancia.container, instancia.volume, PREFIXO, ROTULO);
      if (residuo) codigoSaida = 1;
    }
  }
  return codigoSaida;
}

main().then(
  (codigo) => process.exit(codigo),
  (err) => {
    console.error(`${ROTULO} ERRO FATAL:`, err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
