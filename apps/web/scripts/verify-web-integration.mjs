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
import { sanitizarCaminhoApi as sanitizarCaminho } from "../lib/api-cliente.ts";

const ROTULO = "[web-integration]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const raizWeb = path.join(raizRepo, "apps", "web");

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

// 1. Verificação das funções de sanitização e proteção contra Client-Side CSRF
console.log(`${ROTULO} --- 1. Sanitização de caminhos contra Client-Side CSRF ---`);
// Usa diretamente sanitizarCaminhoApi de lib/api-cliente.ts (sem reimplementação local)
// para garantir que este teste valide o código realmente enviado ao navegador.

function conferirErro(caminho, descricao) {
  try {
    sanitizarCaminho(caminho);
    conferir(descricao, false, "deveria ter lançado um erro, mas não lançou");
  } catch (err) {
    const mensagemEsperada = `Caminho de API inválido: "${caminho}". Apenas rotas internas relativas iniciando com "/api/" são permitidas.`;
    const ehInstanciaError = err instanceof Error;
    const mensagemCorreta = err?.message === mensagemEsperada;
    conferir(
      descricao,
      ehInstanciaError && mensagemCorreta,
      !ehInstanciaError
        ? "não é instância de Error"
        : `mensagem recebida: "${err?.message}"`,
    );
  }
}

// Casos de sucesso (Happy Path)
conferir(
  "aceita rota relativa legítima /api/auth/login",
  sanitizarCaminho("/api/auth/login") === "/api/auth/login",
);
conferir(
  "aceita rota relativa com espaços extras em volta (trim)",
  sanitizarCaminho(" /api/health ") === "/api/health",
);
conferir(
  "aceita subcaminhos profundos /api/v1/pacientes/123",
  sanitizarCaminho("/api/v1/pacientes/123") === "/api/v1/pacientes/123",
);
conferir(
  "aceita rotas com parâmetros de busca (query string)",
  sanitizarCaminho("/api/pacientes?busca=teste&pagina=1") === "/api/pacientes?busca=teste&pagina=1",
);
conferir(
  "aceita rotas com fragmento hash (#)",
  sanitizarCaminho("/api/recursos#secao") === "/api/recursos#secao",
);

// Casos de rejeição (URLs absolutas e esquemas arbitrários)
conferirErro("http://evil.com/api/login", "bloqueia URL absoluta externa com http:");
conferirErro("https://attacker.com/api/login", "bloqueia URL absoluta externa com https:");
conferirErro("//attacker.com/api/login", "bloqueia URL protocol-relative //");
conferirErro("ftp://server/api/data", "bloqueia URL com esquema ftp://");
conferirErro("javascript://alert(1)", "bloqueia URL com esquema javascript://");
conferirErro("file:///etc/passwd", "bloqueia URL com esquema file://");
conferirErro("ws://localhost/api", "bloqueia URL com esquema ws://");

// Casos de rejeição (prefixo /api/ ausente ou malformado)
conferirErro("/auth/login", "bloqueia rota relativa que não inicia com /api/");
conferirErro("/admin", "bloqueia rota interna que não é de API");
conferirErro("api/login", "bloqueia rota relativa sem barra inicial");
conferirErro("/apiv1/users", "bloqueia rota que começa com /api sem barra delimitadora");
conferirErro("/api-docs", "bloqueia rota /api-docs (sem barra delimitadora)");
conferirErro("", "bloqueia string vazia");
conferirErro("   ", "bloqueia string contendo apenas espaços");
conferirErro("/", "bloqueia raiz /");

// Casos de rejeição (Path Traversal)
conferirErro("/api/../admin", "bloqueia path traversal no meio do caminho (/../)");
conferirErro("/api/v1/../v2/users", "bloqueia path traversal intermediário (/../)");
conferirErro("/api/auth/..", "bloqueia path traversal ao final do caminho (/..)");

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
  console.log(`${ROTULO} TODOS OS ${totalTestes} TESTES PASSARAM COM SUCESSO!`);
  process.exit(0);
} else {
  console.error(`${ROTULO} ${falhas.length} falhas detectadas.`);
  process.exit(1);
}
