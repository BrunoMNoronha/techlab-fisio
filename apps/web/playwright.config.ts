import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// TechLab Fisio — Configuração de Testes E2E com Playwright (FRONT-E2E0 / CI-E2E0).
//
// Decisão local: Chromium é o navegador de prova. A matriz definitiva de
// navegadores permanece decisão futura.
//
// CI-E2E0: execute SEMPRE pelo comando oficial `pnpm run test:e2e`, que roda
// `scripts/run-playwright-e2e.mjs`. Ele provisiona PostgreSQL descartável,
// Administrador/clínica sintéticos e a API compilada, e repassa:
//   - TLF_E2E_PORTA_WEB   — porta efêmera livre para o `next start`;
//   - URL_API_INTERNA     — API real para o proxy same-origin `/api/*`;
//   - TLF_E2E_ADMIN_*     — credencial sintética usada por `autenticacao.spec.ts`.
// Sem elas a configuração falha de imediato: nunca cai nos defaults
// conflitantes (API e `next start` em 3000; proxy em 3001), que poderiam
// testar em silêncio um servidor alheio.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function variavelDoOrquestrador(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`${nome} ausente. Execute a suíte pelo comando oficial: pnpm run test:e2e`);
  }
  return valor;
}

const PORTA_WEB = Number(variavelDoOrquestrador("TLF_E2E_PORTA_WEB"));
variavelDoOrquestrador("URL_API_INTERNA");
const baseURL = `http://127.0.0.1:${PORTA_WEB}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // Falha nunca é mascarada por nova tentativa.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    // F-E2E0-01: com retries: 0, "on-first-retry" nunca gravava trace.
    // "retain-on-failure" grava sempre e só preserva o trace de testes que falharam.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Herda URL_API_INTERNA do orquestrador: o proxy same-origin aponta para a API real.
    command: `pnpm exec next start -p ${PORTA_WEB} -H 127.0.0.1`,
    // Readiness pela cadeia real navegador → Next.js → proxy → NestJS:
    // só libera os testes quando o `/health` da API responde 200 PELO proxy.
    url: `${baseURL}/api/health`,
    // Nunca reutilizar: um servidor já escutando na porta (ex.: outro checkout)
    // seria testado em silêncio no lugar do build desta árvore.
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 120_000,
  },
});
