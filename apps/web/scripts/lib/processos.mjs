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

function encerrado(proc) {
  return !proc || proc.exitCode !== null || proc.signalCode !== null;
}

/**
 * Encerra o processo e toda a sua árvore, à força.
 *
 * Windows: `taskkill /T` alcança os descendentes. POSIX: `ChildProcess.kill()`
 * sinaliza SOMENTE o filho direto, então processos criados com `detached: true`
 * (líderes de grupo) são encerrados pelo GRUPO (`kill(-pid)`) — sem isso, um
 * `next start` neto sobreviveria ao encerramento do pai.
 */
export function encerrarProcesso(proc) {
  if (encerrado(proc)) return;
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // processo já encerrado
    }
    return;
  }
  try {
    process.kill(-proc.pid, "SIGKILL"); // grupo (processos detached)
  } catch {
    try {
      proc.kill("SIGKILL"); // não é líder de grupo: só o filho direto
    } catch {
      // processo já encerrado
    }
  }
}

/**
 * Pede encerramento GRACIOSO da árvore e resolve quando ela termina — ou força
 * o encerramento ao fim de `prazoMs`.
 *
 * Existe para o `playwright test`: ele precisa executar o próprio teardown
 * (derrubar o `webServer`, fechar o navegador, gravar relatório). Um `SIGKILL`
 * direto no Playwright deixaria o `next start` órfão em POSIX.
 */
export async function encerrarArvoreGraciosamente(proc, prazoMs = 20_000) {
  if (encerrado(proc)) return;
  const fim = new Promise((resolve) => proc.once("exit", resolve));
  if (process.platform === "win32") {
    // O console já entrega o Ctrl+C a todo o grupo; um SIGTERM emulado pelo Node
    // seria terminação abrupta. Aguarda o teardown e força só se ele não vier.
    proc.kill("SIGINT");
  } else {
    try {
      process.kill(-proc.pid, "SIGINT"); // grupo inteiro: Playwright + webServer
    } catch {
      try {
        proc.kill("SIGINT");
      } catch {
        return;
      }
    }
  }
  let prazo;
  await Promise.race([
    fim,
    new Promise((resolve) => {
      prazo = setTimeout(() => {
        encerrarProcesso(proc);
        resolve();
      }, prazoMs);
    }),
  ]);
  clearTimeout(prazo);
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
