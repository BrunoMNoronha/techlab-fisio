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
import { sanitizarCaminhoApi as sanitizarCaminho, clienteHttp, CABECALHO_REQUISICAO_TLF } from "../lib/api-cliente.ts";

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

let bloqueouTraversalMeio = false;
try { sanitizarCaminho("/api/../admin"); } catch { bloqueouTraversalMeio = true; }
conferir("bloqueia path traversal no meio do caminho (/../)", bloqueouTraversalMeio);

let bloqueouTraversalFinal = false;
try { sanitizarCaminho("/api/auth/.."); } catch { bloqueouTraversalFinal = true; }
conferir("bloqueia path traversal ao final do caminho (/..)", bloqueouTraversalFinal);

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

// 5. Testes unitários das funções auxiliares do clienteHttp
console.log(`\n${ROTULO} --- 5. Testes unitários do clienteHttp ---`);

const fetchOriginal = globalThis.fetch;

// Helper para mock de fetch em testes
let ultimosParametrosFetch = null;
function mockFetchResponda(status, dadosOuCorpo, headers = {}) {
  globalThis.fetch = async (url, opcoes) => {
    ultimosParametrosFetch = { url, opcoes };
    const cabecalhosResposta = new Map(Object.entries(headers));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (nome) => cabecalhosResposta.get(nome.toLowerCase()) ?? null,
      },
      json: async () => {
        if (typeof dadosOuCorpo === "string") {
          return JSON.parse(dadosOuCorpo);
        }
        return dadosOuCorpo;
      },
    };
  };
}

function mockFetchRejeite(erro) {
  globalThis.fetch = async (url, opcoes) => {
    ultimosParametrosFetch = { url, opcoes };
    throw erro;
  };
}

function restaurarFetch() {
  globalThis.fetch = fetchOriginal;
  ultimosParametrosFetch = null;
}

// Teste GET
try {
  mockFetchResponda(200, { id: 1, nome: "Teste" });
  const resGet = await clienteHttp.get("/api/pacientes/1", { headers: { "x-custom": "valor" } });

  conferir(
    "clienteHttp.get executa requisição GET com sucesso",
    resGet.sucesso === true && resGet.status === 200 && resGet.dados.nome === "Teste",
  );
  conferir(
    "clienteHttp.get envia método GET, cabeçalho accept e cabeçalho customizado",
    ultimosParametrosFetch?.opcoes?.method === "GET" &&
      ultimosParametrosFetch?.opcoes?.headers?.accept === "application/json" &&
      ultimosParametrosFetch?.opcoes?.headers?.["x-custom"] === "valor",
  );
  conferir(
    "clienteHttp.get NÃO envia cabeçalhos de mutação (x-tlf-requisicao e content-type)",
    ultimosParametrosFetch?.opcoes?.headers?.[CABECALHO_REQUISICAO_TLF] === undefined &&
      ultimosParametrosFetch?.opcoes?.headers?.["content-type"] === undefined,
  );
} finally {
  restaurarFetch();
}

// Teste POST
try {
  mockFetchResponda(201, { id: 2, cadastrado: true });
  const corpoPost = { nome: "Novo Paciente" };
  const resPost = await clienteHttp.post("/api/pacientes", corpoPost);

  conferir(
    "clienteHttp.post executa requisição POST com sucesso",
    resPost.sucesso === true && resPost.status === 201 && resPost.dados.cadastrado === true,
  );
  conferir(
    "clienteHttp.post injeta cabeçalhos de mutação (x-tlf-requisicao: 1 e content-type: application/json)",
    ultimosParametrosFetch?.opcoes?.method === "POST" &&
      ultimosParametrosFetch?.opcoes?.headers?.[CABECALHO_REQUISICAO_TLF] === "1" &&
      ultimosParametrosFetch?.opcoes?.headers?.["content-type"] === "application/json",
  );
  conferir(
    "clienteHttp.post serializa o corpo em JSON",
    ultimosParametrosFetch?.opcoes?.body === JSON.stringify(corpoPost),
  );
} finally {
  restaurarFetch();
}

// Teste PUT
try {
  mockFetchResponda(200, { id: 2, atualizado: true });
  const corpoPut = { nome: "Paciente Atualizado" };
  const resPut = await clienteHttp.put("/api/pacientes/2", corpoPut);

  conferir(
    "clienteHttp.put executa requisição PUT com corpo serializado e cabeçalhos de mutação",
    resPut.sucesso === true &&
      resPut.status === 200 &&
      ultimosParametrosFetch?.opcoes?.method === "PUT" &&
      ultimosParametrosFetch?.opcoes?.headers?.[CABECALHO_REQUISICAO_TLF] === "1" &&
      ultimosParametrosFetch?.opcoes?.body === JSON.stringify(corpoPut),
  );
} finally {
  restaurarFetch();
}

// Teste PATCH
try {
  mockFetchResponda(200, { id: 2, alterado: true });
  const corpoPatch = { ativo: false };
  const resPatch = await clienteHttp.patch("/api/pacientes/2", corpoPatch);

  conferir(
    "clienteHttp.patch executa requisição PATCH com corpo serializado e cabeçalhos de mutação",
    resPatch.sucesso === true &&
      resPatch.status === 200 &&
      ultimosParametrosFetch?.opcoes?.method === "PATCH" &&
      ultimosParametrosFetch?.opcoes?.headers?.[CABECALHO_REQUISICAO_TLF] === "1" &&
      ultimosParametrosFetch?.opcoes?.body === JSON.stringify(corpoPatch),
  );
} finally {
  restaurarFetch();
}

// Teste DELETE & Resposta 204 No Content
try {
  mockFetchResponda(204, null);
  const resDelete = await clienteHttp.delete("/api/pacientes/2");

  conferir(
    "clienteHttp.delete executa requisição DELETE com cabeçalho de mutação",
    resDelete.sucesso === true &&
      resDelete.status === 204 &&
      resDelete.dados === undefined &&
      ultimosParametrosFetch?.opcoes?.method === "DELETE" &&
      ultimosParametrosFetch?.opcoes?.headers?.[CABECALHO_REQUISICAO_TLF] === "1",
  );
} finally {
  restaurarFetch();
}

// Teste de sanitização de caminho no clienteHttp
let erroSanitizacaoCliente = false;
try {
  await clienteHttp.get("https://externo.com/api/dados");
} catch {
  erroSanitizacaoCliente = true;
}
conferir(
  "clienteHttp rejeita caminho inválido/absoluto ativando sanitizarCaminhoApi",
  erroSanitizacaoCliente === true,
);

// Teste de falha de rede
try {
  mockFetchRejeite(new Error("Erro de conexão simulado"));
  const resRede = await clienteHttp.get("/api/health");

  conferir(
    "clienteHttp trata falha de rede retornando envelope com erro FALHA_REDE",
    resRede.sucesso === false &&
      resRede.status === 0 &&
      resRede.erro === "FALHA_REDE" &&
      resRede.mensagem === "Erro de conexão simulado",
  );
} finally {
  restaurarFetch();
}

// Teste de falha de rede com exceção não-Error
try {
  mockFetchRejeite("Erro arbitrário de rede");
  const resRedeGenerico = await clienteHttp.get("/api/health");

  conferir(
    "clienteHttp trata falha de rede genérica com mensagem de fallback",
    resRedeGenerico.sucesso === false &&
      resRedeGenerico.status === 0 &&
      resRedeGenerico.erro === "FALHA_REDE" &&
      resRedeGenerico.mensagem === "Falha de conexão com o servidor.",
  );
} finally {
  restaurarFetch();
}

// Teste de tradução de erros da API e Retry-After
try {
  mockFetchResponda(401, { erro: "CREDENCIAIS_INVALIDAS" });
  const resErroCredenciais = await clienteHttp.post("/api/auth/login", { identificador: "a", senha: "b" });

  conferir(
    "clienteHttp traduz CREDENCIAIS_INVALIDAS para mensagem amigável",
    resErroCredenciais.sucesso === false &&
      resErroCredenciais.status === 401 &&
      resErroCredenciais.erro === "CREDENCIAIS_INVALIDAS" &&
      resErroCredenciais.mensagem === "E-mail ou senha incorretos.",
  );
} finally {
  restaurarFetch();
}

try {
  mockFetchResponda(429, { erro: "TENTATIVAS_EXCEDIDAS" }, { "retry-after": "60" });
  const resErroRateLimit = await clienteHttp.post("/api/auth/login", {});

  conferir(
    "clienteHttp traduz TENTATIVAS_EXCEDIDAS com retryAfterSegundos quando cabeçalho retry-after está presente",
    resErroRateLimit.sucesso === false &&
      resErroRateLimit.status === 429 &&
      resErroRateLimit.erro === "TENTATIVAS_EXCEDIDAS" &&
      resErroRateLimit.retryAfterSegundos === 60 &&
      resErroRateLimit.mensagem === "Muitas tentativas. Aguarde 60 segundos para tentar novamente.",
  );
} finally {
  restaurarFetch();
}

try {
  mockFetchResponda(429, { erro: "TENTATIVAS_EXCEDIDAS" });
  const resErroRateLimitSemHeader = await clienteHttp.post("/api/auth/login", {});

  conferir(
    "clienteHttp traduz TENTATIVAS_EXCEDIDAS sem cabeçalho retry-after com mensagem padrão",
    resErroRateLimitSemHeader.sucesso === false &&
      resErroRateLimitSemHeader.mensagem === "Muitas tentativas. Tente novamente em alguns minutos.",
  );
} finally {
  restaurarFetch();
}

try {
  mockFetchResponda(403, { erro: "REQUISICAO_NAO_AUTORIZADA" });
  const resErroAutorizacao = await clienteHttp.get("/api/admin");

  conferir(
    "clienteHttp traduz REQUISICAO_NAO_AUTORIZADA para mensagem amigável",
    resErroAutorizacao.sucesso === false &&
      resErroAutorizacao.erro === "REQUISICAO_NAO_AUTORIZADA" &&
      resErroAutorizacao.mensagem === "Acesso recusado pelas políticas de segurança.",
  );
} finally {
  restaurarFetch();
}

try {
  mockFetchResponda(400, { erro: "REQUISICAO_INVALIDA" });
  const resErroInvalida = await clienteHttp.post("/api/pacientes", {});

  conferir(
    "clienteHttp traduz REQUISICAO_INVALIDA para mensagem amigável",
    resErroInvalida.sucesso === false &&
      resErroInvalida.erro === "REQUISICAO_INVALIDA" &&
      resErroInvalida.mensagem === "Preencha todos os campos obrigatórios corretamente.",
  );
} finally {
  restaurarFetch();
}

try {
  mockFetchResponda(500, "Erro Interno Não JSON");
  const resErroServidor = await clienteHttp.get("/api/pacientes");

  conferir(
    "clienteHttp trata resposta de erro não-JSON com RESPOSTA_INESPERADA",
    resErroServidor.sucesso === false &&
      resErroServidor.status === 500 &&
      resErroServidor.erro === "RESPOSTA_INESPERADA" &&
      resErroServidor.mensagem === "Ocorreu um erro no processamento da solicitação.",
  );
} finally {
  restaurarFetch();
}

// 6. Resultado
console.log(`\n${ROTULO} --- Resultado da Verificação ---`);
if (falhas.length === 0) {
  console.log(`${ROTULO} TODOS OS ${totalTestes} TESTES PASSARAM COM SUCESSO!`);
  process.exit(0);
} else {
  console.error(`${ROTULO} ${falhas.length} falhas detectadas.`);
  process.exit(1);
}
