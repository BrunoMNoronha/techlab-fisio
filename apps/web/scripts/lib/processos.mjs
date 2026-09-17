// TechLab Fisio — utilitários de processo das provas E2E de apps/web.
//
// Compartilhados por `verify-web-api-e2e.mjs` (prova same-origin roteirizada)
// e `run-playwright-e2e.mjs` (orquestrador da suíte Playwright — CI-E2E0).

import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";

/** Porta TCP livre em 127.0.0.1, escolhida pelo sistema operacional. */
export async function obterPortaLivre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Encerra o processo e toda a sua árvore (Windows: taskkill /T). */
export function encerrarProcesso(proc) {
  if (!proc) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {
    // processo já encerrado
  }
}

/** Espera até `url` responder 200 ou o limite expirar. */
export async function aguardarHttpOk(url, limiteMs = 30_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        return true;
      }
    } catch {
      // espera nova tentativa
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Executa um subcomando do CLI de provisionamento COMPILADO da API
 * (`apps/api/dist/provisionamento/cli.js`) contra `databaseUrl`.
 * Lança erro com a saída do CLI se o exit code for diferente de zero.
 */
export function executarCliProvisionamento(raizApi, subcomando, databaseUrl, envExtra, rotulo) {
  const resultado = spawnSync(
    process.execPath,
    [path.join(raizApi, "dist", "provisionamento", "cli.js"), subcomando],
    {
      cwd: raizApi,
      env: { ...process.env, DATABASE_URL: databaseUrl, ...envExtra },
      encoding: "utf8",
    },
  );
  if (resultado.status !== 0) {
    throw new Error(
      `${rotulo} ${subcomando} via CLI falhou (exit ${resultado.status}): ${resultado.stderr || resultado.stdout}`,
    );
  }
}
