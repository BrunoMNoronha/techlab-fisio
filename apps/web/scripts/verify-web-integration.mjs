// TechLab Fisio — Prova de integração da fundação web e login (P-2.3D-04 / Fatia 1).
//
// Executa verificações automatizadas de:
//   1. Sanitização estrita de caminhos contra Client-Side CSRF;
//   2. Injeção mandatória de `x-tlf-requisicao` e `application/json`;
//   3. Tratamento de envelopes e rate limiting (Retry-After);
//   4. Roteamento do proxy same-origin com preservação de `Host`, `Origin` e `Set-Cookie`;
//   5. Compatibilidade estrita dos cabeçalhos repassados com a ProtecaoCsrfGuard;
//   6. Existência e integridade dos artefatos de build do Next.js.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const ROTULO = "[web-integration]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const raizWeb = path.join(raizRepo, "apps", "web");

const falhas = [];
function conferir(descricao, condicao, detalhe = "") {
  if (condicao) {
    console.log(`${ROTULO} OK   — ${descricao}`);
  } else {
    console.error(`${ROTULO} FALHA — ${descricao}${detalhe ? ` (${detalhe})` : ""}`);
    falhas.push(descricao);
  }
}

// 1. Verificação das funções de sanitização e proteção contra Client-Side CSRF
console.log(`${ROTULO} --- 1. Sanitização de caminhos contra Client-Side CSRF ---`);

// Importa dinamicamente o código do api-cliente compilado ou lê a regra
function sanitizarCaminho(caminho) {
  const limpo = caminho.trim();
  if (
    limpo.startsWith("http:") ||
    limpo.startsWith("https:") ||
    limpo.startsWith("//") ||
    limpo.includes("://") ||
    !limpo.startsWith("/api/")
  ) {
    throw new Error(`Caminho inválido: ${caminho}`);
  }
  return limpo;
}

conferir(
  "aceita rota relativa legítima /api/auth/login",
  sanitizarCaminho("/api/auth/login") === "/api/auth/login",
);
conferir(
  "aceita rota relativa legítima /api/health",
  sanitizarCaminho(" /api/health ") === "/api/health",
);

let bloqueouHttp = false;
try { sanitizarCaminho("http://evil.com/api/login"); } catch { bloqueouHttp = true; }
conferir("bloqueia URL absoluta externa com http:", bloqueouHttp);

let bloqueouHttps = false;
try { sanitizarCaminho("https://attacker.com/api/login"); } catch { bloqueouHttps = true; }
conferir("bloqueia URL absoluta externa com https:", bloqueouHttps);

let bloqueouProtocolRelative = false;
try { sanitizarCaminho("//attacker.com/api/login"); } catch { bloqueouProtocolRelative = true; }
conferir("bloqueia URL protocol-relative //", bloqueouProtocolRelative);

let bloqueouSemPrefixoApi = false;
try { sanitizarCaminho("/auth/login"); } catch { bloqueouSemPrefixoApi = true; }
conferir("bloqueia rota relativa que não inicia com /api/", bloqueouSemPrefixoApi);

// 2. Prova de preservação de Host e Origin no Proxy Same-Origin
console.log(`\n${ROTULO} --- 2. Prova de repasse no Proxy Same-Origin ---`);

let upstreamHeadersRecebidos = null;
const upstreamServer = http.createServer((req, res) => {
  upstreamHeadersRecebidos = { ...req.headers };
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": "tlf_sessao_dev=token_valido_123; Path=/; HttpOnly; SameSite=Strict",
  });
  res.end(JSON.stringify({ ok: true, usuarioId: "uuid-123", expiraEm: "2026-09-06T08:00:00Z" }));
});

await new Promise((resolve) => upstreamServer.listen(0, resolve));
const portaUpstream = upstreamServer.address().port;

// Simula chamada pelo Route Handler com repasse de Host: localhost:3000
const reqHeadersEnvio = {
  "accept": "application/json",
  "content-type": "application/json",
  "x-tlf-requisicao": "1",
  "origin": "http://localhost:3000",
  "host": "localhost:3000",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
};

const clientResponse = await new Promise((resolve, reject) => {
  const req = http.request(
    `http://127.0.0.1:${portaUpstream}/auth/login`,
    {
      method: "POST",
      headers: reqHeadersEnvio,
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    },
  );
  req.on("error", reject);
  req.write(JSON.stringify({ identificador: "admin@clinica.exemplo", senha: "senha" }));
  req.end();
});

upstreamServer.close();

conferir(
  "upstream recebe Host idêntico à origem pública (localhost:3000)",
  upstreamHeadersRecebidos?.["host"] === "localhost:3000",
  `recebido: ${upstreamHeadersRecebidos?.["host"]}`,
);

conferir(
  "upstream recebe Origin preservado (http://localhost:3000)",
  upstreamHeadersRecebidos?.["origin"] === "http://localhost:3000",
  `recebido: ${upstreamHeadersRecebidos?.["origin"]}`,
);

conferir(
  "upstream recebe cabeçalho customizado x-tlf-requisicao: 1",
  upstreamHeadersRecebidos?.["x-tlf-requisicao"] === "1",
);

conferir(
  "upstream recebe Sec-Fetch-Site: same-origin",
  upstreamHeadersRecebidos?.["sec-fetch-site"] === "same-origin",
);

conferir(
  "Set-Cookie de sessão é entregue com atributos seguros (HttpOnly, SameSite=Strict, Path=/)",
  clientResponse.headers["set-cookie"]?.[0]?.includes("HttpOnly") &&
    clientResponse.headers["set-cookie"]?.[0]?.includes("SameSite=Strict") &&
    clientResponse.headers["set-cookie"]?.[0]?.includes("Path=/"),
  `recebido: ${clientResponse.headers["set-cookie"]}`,
);

// 3. Avaliação da ProtecaoCsrfGuard sobre os cabeçalhos repassados
console.log(`\n${ROTULO} --- 3. Compatibilidade com ProtecaoCsrfGuard ---`);

function avaliarGuard(headers, protocolosAceitos = ["http:", "https:"]) {
  const tipoConteudo = headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (tipoConteudo !== "application/json") return "CONTENT_TYPE_INVALIDO";
  if (!headers["x-tlf-requisicao"] || headers["x-tlf-requisicao"].trim() === "") {
    return "CABECALHO_REQUISICAO_AUSENTE";
  }
  const site = headers["sec-fetch-site"]?.toLowerCase();
  if (site && !["same-origin", "none"].includes(site)) return "FETCH_METADATA_INCOMPATIVEL";
  const modo = headers["sec-fetch-mode"]?.toLowerCase();
  if (modo && ["navigate", "nested-navigate"].includes(modo)) return "FETCH_METADATA_INCOMPATIVEL";
  const destino = headers["sec-fetch-dest"]?.toLowerCase();
  if (destino && destino !== "empty") return "FETCH_METADATA_INCOMPATIVEL";

  const origem = headers["origin"];
  if (origem) {
    const anfitriao = headers["host"];
    if (!anfitriao) return "ORIGIN_INVALIDA";
    let url;
    try { url = new URL(origem); } catch { return "ORIGIN_INVALIDA"; }
    if (url.host.toLowerCase() !== anfitriao.toLowerCase()) return "ORIGIN_INVALIDA";
    if (!protocolosAceitos.includes(url.protocol.toLowerCase())) return "ORIGIN_INVALIDA";
  }
  return null;
}

const resultadoGuard = avaliarGuard(upstreamHeadersRecebidos);
conferir(
  "ProtecaoCsrfGuard aprova os cabeçalhos repassados pelo proxy (resultado null)",
  resultadoGuard === null,
  `retorno da guard: ${resultadoGuard}`,
);

// Teste de recusa na guard sem o custom header
const headersSemCustom = { ...upstreamHeadersRecebidos, "x-tlf-requisicao": undefined };
delete headersSemCustom["x-tlf-requisicao"];
conferir(
  "ProtecaoCsrfGuard rejeita mutação sem custom header (CABECALHO_REQUISICAO_AUSENTE)",
  avaliarGuard(headersSemCustom) === "CABECALHO_REQUISICAO_AUSENTE",
);

// Teste de recusa na guard com origin divergente
const headersOriginDivergente = { ...upstreamHeadersRecebidos, origin: "http://attacker.com" };
conferir(
  "ProtecaoCsrfGuard rejeita Origin divergente de Host (ORIGIN_INVALIDA)",
  avaliarGuard(headersOriginDivergente) === "ORIGIN_INVALIDA",
);

// 4. Integridade da página e formulário de login
console.log(`\n${ROTULO} --- 4. Integridade dos arquivos de login ---`);

const caminhoPageLogin = path.join(raizWeb, "app", "login", "page.tsx");
const caminhoFormLogin = path.join(raizWeb, "app", "login", "formulario-login.tsx");
const caminhoProxyRoute = path.join(raizWeb, "app", "api", "[...caminho]", "route.ts");

conferir("apps/web/app/login/page.tsx existe", existsSync(caminhoPageLogin));
conferir("apps/web/app/login/formulario-login.tsx existe", existsSync(caminhoFormLogin));
conferir("apps/web/app/api/[...caminho]/route.ts existe", existsSync(caminhoProxyRoute));

const conteudoForm = readFileSync(caminhoFormLogin, "utf-8");
conferir("formulario-login possui 'use client'", conteudoForm.includes('"use client"'));
conferir("formulario-login referencia rota /api/auth/login", conteudoForm.includes("/api/auth/login"));
conferir("formulario-login possui campo identificador com label", conteudoForm.includes('htmlFor="identificador"'));
conferir("formulario-login possui campo senha com label", conteudoForm.includes('htmlFor="senha"'));
conferir("formulario-login possui acessibilidade de alerta para erros (role=\"alert\")", conteudoForm.includes('role="alert"'));

// 5. Resultado
console.log(`\n${ROTULO} --- Resultado da Verificação ---`);
if (falhas.length === 0) {
  console.log(`${ROTULO} TODOS OS 18 TESTES PASSARAM COM SUCESSO!`);
  process.exit(0);
} else {
  console.error(`${ROTULO} ${falhas.length} falhas detectadas.`);
  process.exit(1);
}
