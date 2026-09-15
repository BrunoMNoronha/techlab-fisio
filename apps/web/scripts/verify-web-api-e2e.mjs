// TechLab Fisio — Prova E2E real same-origin (P-2.3D-08 / D-2.3D-20).
//
// Executa o ciclo de vida completo:
//   - PostgreSQL 18 real em container descartável;
//   - NestJS compilado real (node apps/api/dist/main.js);
//   - Next.js compilado real (next start) com Route Handler de proxy same-origin;
//   - ProtecaoCsrfGuard real do backend;
//   - Cookie de sessão real emitido e transitado pelo proxy;
//   - GET /auth/sessao validado de ponta a ponta (status 200, Cache-Control: no-store,
//     zero auditoria, identificadores autoritativos usuarioId e sessaoId);
//   - Casos negativos de sessão (ausente, inválida, revogada) e defesas CSRF (X-TLF-Requisicao, Origin).
//
// Sem mocks. Limpeza garantida de processos e container (finally).

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import {
  comCliente,
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  migrateDeploy,
  removerOrfaos,
} from "../../../scripts/lib/instancia-descartavel.mjs";

const PREFIXO = "techlab-fisio-webe2e-";
const ROTULO = "[web-api-e2e]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const raizWeb = path.join(raizRepo, "apps", "web");
const raizApi = path.join(raizRepo, "apps", "api");

const ADMIN_EMAIL = "admin.e2e@clinica.exemplo";
const ADMIN_NOME = "Administrador E2E";
const ADMIN_SENHA = "SenhaE2E123!@#";
const ADMIN_JUSTIFICATIVA = "Bootstrap para prova E2E same-origin";

const falhas = [];
let totalTestes = 0;

function conferir(descricao, condicao, detalhe = "") {
  totalTestes += 1;
  if (condicao) {
    console.log(`${ROTULO} OK   — ${descricao}`);
  } else {
    console.error(`${ROTULO} FALHA — ${descricao}${detalhe ? ` (${detalhe})` : ""}`);
    falhas.push(descricao);
  }
}

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

async function obterPortaLivre() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function encerrarProcesso(proc) {
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

async function aguardarHttpOk(url, limiteMs = 30_000) {
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

async function main() {
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });
  const cred = credenciaisDoAmbiente();
  removerOrfaos(PREFIXO, ROTULO);

  const apiDist = path.join(raizApi, "dist", "main.js");
  if (!existsSync(apiDist)) {
    falhar(`artefato compilado da API não encontrado em ${apiDist}. Execute 'pnpm run build' primeiro.`);
  }

  const nextDir = path.join(raizWeb, ".next");
  if (!existsSync(nextDir)) {
    falhar(`artefato compilado do frontend não encontrado em ${nextDir}. Execute 'pnpm run build' primeiro.`);
  }

  const requireWeb = createRequire(path.join(raizWeb, "package.json"));
  const nextBin = path.join(path.dirname(requireWeb.resolve("next/package.json")), "dist", "bin", "next");

  let instancia = null;
  let processoApi = null;
  let processoWeb = null;

  try {
    // 1. Provisionar PostgreSQL 18 descartável
    instancia = await criarInstanciaLimpa({
      raizRepo,
      prefixo: PREFIXO,
      rotulo: ROTULO,
      cred,
    });
    migrateDeploy(raizRepo, instancia.urlMigrador, cred.roleMigrador, ROTULO);

    // 2. Provisionar Administrador inicial pelo CLI real compilado
    console.log(`${ROTULO} provisionando Administrador inicial via CLI compilado...`);
    const resultadoCli = spawnSync(
      process.execPath,
      [path.join(raizApi, "dist", "provisionamento", "cli.js"), "provisionar"],
      {
        cwd: raizApi,
        env: {
          ...process.env,
          DATABASE_URL: instancia.urlApp,
          TLF_BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
          TLF_BOOTSTRAP_ADMIN_NOME: ADMIN_NOME,
          TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA: ADMIN_JUSTIFICATIVA,
          TLF_BOOTSTRAP_ADMIN_SENHA: ADMIN_SENHA,
        },
        encoding: "utf8",
      },
    );
    if (resultadoCli.status !== 0) {
      falhar(`provisionamento via CLI falhou (exit ${resultadoCli.status}): ${resultadoCli.stderr || resultadoCli.stdout}`);
    }

    // 3. Alocar portas efêmeras para API e Web
    const portaApi = await obterPortaLivre();
    const portaWeb = await obterPortaLivre();
    console.log(`${ROTULO} portas alocadas: API=${portaApi}, Web=${portaWeb}`);

    // 4. Iniciar processo da API NestJS real
    console.log(`${ROTULO} iniciando servidor NestJS compilado (porta ${portaApi})...`);
    processoApi = spawn(
      process.execPath,
      [apiDist],
      {
        cwd: raizRepo,
        env: {
          ...process.env,
          DATABASE_URL: instancia.urlApp,
          PORT: String(portaApi),
          TLF_AMBIENTE: "desenvolvimento",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let saidaApi = "";
    processoApi.stdout.on("data", (d) => { saidaApi += String(d); });
    processoApi.stderr.on("data", (d) => { saidaApi += String(d); });

    const apiPronta = await aguardarHttpOk(`http://127.0.0.1:${portaApi}/health`, 30_000);
    if (!apiPronta) {
      falhar(`API não respondeu com 200 no /health dentro do limite:\n${saidaApi}`);
    }
    console.log(`${ROTULO} API NestJS saudável e pronta.`);

    // 5. Iniciar processo do Next.js real
    console.log(`${ROTULO} iniciando servidor Next.js compilado (porta ${portaWeb})...`);
    processoWeb = spawn(
      process.execPath,
      [nextBin, "start", "-p", String(portaWeb), "-H", "127.0.0.1"],
      {
        cwd: raizWeb,
        env: {
          ...process.env,
          PORT: String(portaWeb),
          URL_API_INTERNA: `http://127.0.0.1:${portaApi}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let saidaWeb = "";
    processoWeb.stdout.on("data", (d) => { saidaWeb += String(d); });
    processoWeb.stderr.on("data", (d) => { saidaWeb += String(d); });

    const webPronta = await aguardarHttpOk(`http://127.0.0.1:${portaWeb}/`, 30_000);
    if (!webPronta) {
      falhar(`Next.js não respondeu na porta ${portaWeb} dentro do limite:\n${saidaWeb}`);
    }
    console.log(`${ROTULO} Next.js servidor saudável e pronto.`);

    // 6. Execução dos cenários E2E através do proxy same-origin
    const urlWeb = `http://127.0.0.1:${portaWeb}`;

    console.log(`${ROTULO} --- Cenário 1: Login same-origin via POST /api/auth/login ---`);
    const resLogin = await fetch(`${urlWeb}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tlf-requisicao": "1",
        origin: urlWeb,
        host: `127.0.0.1:${portaWeb}`,
      },
      body: JSON.stringify({ identificador: ADMIN_EMAIL, senha: ADMIN_SENHA }),
    });
    conferir("1.1 POST /api/auth/login retorna 200 OK", resLogin.status === 200, `status=${resLogin.status}`);
    const corpoLogin = await resLogin.json();
    conferir("1.2 corpo do login expõe usuarioId válido", typeof corpoLogin.usuarioId === "string" && corpoLogin.usuarioId.length > 0);

    const cookiesLogin = resLogin.headers.getSetCookie();
    conferir("1.3 Set-Cookie entregue pelo proxy same-origin", cookiesLogin.length > 0);
    const cookieSessaoStr = cookiesLogin.find((c) => c.includes("tlf_sessao"));
    conferir("1.4 cookie de sessão presente no Set-Cookie", !!cookieSessaoStr);
    const cookieValor = cookieSessaoStr?.split(";")[0]?.trim() ?? "";

    console.log(`${ROTULO} --- Cenário 2: Consulta da sessão via GET /api/auth/sessao (D-2.3D-20) ---`);
    const resSessao = await fetch(`${urlWeb}/api/auth/sessao`, {
      method: "GET",
      headers: {
        cookie: cookieValor,
        host: `127.0.0.1:${portaWeb}`,
      },
    });
    conferir("2.1 GET /api/auth/sessao retorna 200 OK", resSessao.status === 200, `status=${resSessao.status}`);
    conferir("2.2 Cache-Control: no-store presente na resposta", resSessao.headers.get("cache-control") === "no-store");
    conferir("2.3 Não reemite Set-Cookie na leitura", resSessao.headers.getSetCookie().length === 0);
    const corpoSessao = await resSessao.json();
    conferir("2.4 corpo da sessão devolve usuarioId idêntico", corpoSessao.usuarioId === corpoLogin.usuarioId);
    conferir("2.5 corpo da sessão devolve sessaoId uuid", typeof corpoSessao.sessaoId === "string" && corpoSessao.sessaoId.length === 36);

    // Validação de persistência no PostgreSQL 18
    await comCliente(instancia.conexaoMigrador, async (c) => {
      const r = await c.query(
        "SELECT id, usuario_id, estado FROM sessao_autenticacao WHERE id = $1",
        [corpoSessao.sessaoId],
      );
      conferir(
        "2.6 registro físico da sessão no PostgreSQL é ATIVA e pertence ao usuário",
        r.rows.length === 1 && r.rows[0].estado === "ATIVA" && r.rows[0].usuario_id === corpoSessao.usuarioId,
      );
    });

    console.log(`${ROTULO} --- Cenário 3: Consulta sem cookie via GET /api/auth/sessao ---`);
    const resSemCookie = await fetch(`${urlWeb}/api/auth/sessao`, {
      method: "GET",
      headers: {
        host: `127.0.0.1:${portaWeb}`,
      },
    });
    conferir("3.1 requisição sem cookie retorna 401 Unauthorized", resSemCookie.status === 401, `status=${resSemCookie.status}`);
    const corpoSemCookie = await resSemCookie.json();
    conferir("3.2 corpo de erro é SESSAO_INVALIDA", corpoSemCookie.erro === "SESSAO_INVALIDA");

    console.log(`${ROTULO} --- Cenário 4: Consulta com cookie malformado / inexistente ---`);
    const resCookieInvalido = await fetch(`${urlWeb}/api/auth/sessao`, {
      method: "GET",
      headers: {
        cookie: "tlf_sessao=token_sintetico_totalmente_inexistente_12345",
        host: `127.0.0.1:${portaWeb}`,
      },
    });
    conferir("4.1 cookie inexistente retorna 401 Unauthorized", resCookieInvalido.status === 401, `status=${resCookieInvalido.status}`);
    const corpoCookieInvalido = await resCookieInvalido.json();
    conferir("4.2 corpo de erro uniforme é SESSAO_INVALIDA", corpoCookieInvalido.erro === "SESSAO_INVALIDA");

    console.log(`${ROTULO} --- Cenário 5: Encerramento de sessão (Logout) e invalidação subsequente ---`);
    const resLogout = await fetch(`${urlWeb}/api/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tlf-requisicao": "1",
        origin: urlWeb,
        host: `127.0.0.1:${portaWeb}`,
        cookie: cookieValor,
      },
      body: "{}",
    });
    conferir("5.1 POST /api/auth/logout retorna 204 No Content", resLogout.status === 204, `status=${resLogout.status}`);
    conferir("5.2 Set-Cookie de limpeza entregue pelo proxy", resLogout.headers.getSetCookie().length > 0);

    const resSessaoPosLogout = await fetch(`${urlWeb}/api/auth/sessao`, {
      method: "GET",
      headers: {
        cookie: cookieValor,
        host: `127.0.0.1:${portaWeb}`,
      },
    });
    conferir("5.3 GET /api/auth/sessao com cookie revogado retorna 401 Unauthorized", resSessaoPosLogout.status === 401, `status=${resSessaoPosLogout.status}`);
    const corpoPosLogout = await resSessaoPosLogout.json();
    conferir("5.4 corpo de erro uniforme é SESSAO_INVALIDA", corpoPosLogout.erro === "SESSAO_INVALIDA");

    await comCliente(instancia.conexaoMigrador, async (c) => {
      const r = await c.query(
        "SELECT estado FROM sessao_autenticacao WHERE id = $1",
        [corpoSessao.sessaoId],
      );
      conferir("5.5 estado da sessão no PostgreSQL transitou para REVOGADA", r.rows.length === 1 && r.rows[0].estado === "REVOGADA");
    });

    console.log(`${ROTULO} --- Cenário 6: Proteções CSRF através do proxy same-origin ---`);
    // 6.1 Mutação sem custom header CSRF
    const resSemCsrf = await fetch(`${urlWeb}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: urlWeb,
        host: `127.0.0.1:${portaWeb}`,
      },
      body: JSON.stringify({ identificador: ADMIN_EMAIL, senha: ADMIN_SENHA }),
    });
    conferir("6.1 POST /api/auth/login sem X-TLF-Requisicao retorna 403 Forbidden", resSemCsrf.status === 403, `status=${resSemCsrf.status}`);
    const corpoSemCsrf = await resSemCsrf.json();
    conferir("6.2 corpo de erro é REQUISICAO_NAO_AUTORIZADA", corpoSemCsrf.erro === "REQUISICAO_NAO_AUTORIZADA");

    // 6.2 Mutação com Origin estrangeira
    const resOriginInvalida = await fetch(`${urlWeb}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tlf-requisicao": "1",
        origin: "http://atacante.exemplo",
        host: `127.0.0.1:${portaWeb}`,
      },
      body: JSON.stringify({ identificador: ADMIN_EMAIL, senha: ADMIN_SENHA }),
    });
    conferir("6.3 POST /api/auth/login com Origin estrangeira retorna 403 Forbidden", resOriginInvalida.status === 403, `status=${resOriginInvalida.status}`);
    const corpoOriginInvalida = await resOriginInvalida.json();
    conferir("6.4 corpo de erro é REQUISICAO_NAO_AUTORIZADA", corpoOriginInvalida.erro === "REQUISICAO_NAO_AUTORIZADA");

    console.log(`${ROTULO} --- Cenário 7: Verificação estrita de ausência de eventos de auditoria na leitura ---`);
    await comCliente(instancia.conexaoMigrador, async (c) => {
      const r = await c.query(
        "SELECT count(*)::int AS n FROM evento_auditoria WHERE acao = 'usuario.sessao.consultada' OR acao LIKE '%sessao%consult%'",
      );
      conferir("7.1 zero eventos de auditoria emitidos para consulta de sessão (proibido por D-2.3D-20)", r.rows[0].n === 0);
    });

    if (falhas.length > 0) {
      falhar(`${falhas.length} de ${totalTestes} verificações FALHARAM.`);
    }

    console.log(`${ROTULO} PROVA E2E CONCLUÍDA COM SUCESSO: ${totalTestes} verificações OK.`);
  } finally {
    console.log(`${ROTULO} encerrando processos e limpando recursos...`);
    encerrarProcesso(processoWeb);
    encerrarProcesso(processoApi);
    if (instancia) {
      await destruirInstancia(instancia.container, instancia.volume, PREFIXO, ROTULO);
    }
  }
}

main().catch((err) => {
  console.error(`${ROTULO} ERRO FATAL:`, err);
  process.exit(1);
});
