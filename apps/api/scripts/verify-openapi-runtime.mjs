// TechLab Fisio — Etapa 2.3D-B / F3 — prova de runtime ESM do OpenAPI
// (`D-2.3D-11`, `P-2.3D-03`, `R-2.3D-06`).
//
// POR QUE ESTE SCRIPT EXISTE: `D-2.3D-11` manda MEDIR a compatibilidade real
// de `@nestjs/swagger@11.4.7` com ESM/`nodenext` (`D-ESM-01`) — "não é
// assumida". Nem o typecheck nem o Jest fazem essa medição: o Jest transpila
// e executa num runtime de VM próprio, e uma biblioteca pode funcionar lá e
// falhar em `node dist/main.js`. `@nestjs/swagger` depende de `lodash`,
// `js-yaml`, `path-to-regexp` e `@microsoft/tsdoc` — pacotes CommonJS cujo
// interop ESM só se prova executando.
//
// O que é provado, sobre o ARTEFATO COMPILADO (`dist/`), fora do Jest:
//   1. `documento-openapi.js` importa por ESM real;
//   2. `@nestjs/swagger` carrega no mesmo runtime e `DocumentBuilder` opera;
//   3. o documento é construído a partir do `AppModule` COMPILADO, com os
//      decorators resolvidos por `reflect-metadata`;
//   4. as rotas, os schemas e o security scheme da F3 estão no documento;
//   5. nenhum campo secreto aparece nos schemas de resposta;
//   6. em ambiente de DESENVOLVIMENTO a rota do documento é servida por HTTP
//      real e devolve JSON válido;
//   7. em ambiente PROTEGIDO (`producao`) a rota NÃO é montada — e o cookie
//      resolvido é o seguro, o que exercita `R-2.3D-04` no mesmo passo.
//
// Falha => exit 1. Nenhum banco é usado: `DatabaseService` é o ÚNICO provider
// substituído (seu `onModuleInit` conecta EAGER), mesma técnica já adotada em
// `auth.module.integration.spec.ts`. Nenhum segredo real; nada é persistido.
//
// Uso:
//   npm run build --workspace @techlab-fisio/api
//   npm run verify:openapi-runtime --workspace @techlab-fisio/api

import "reflect-metadata";

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROTULO = "[openapi-runtime]";
const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raizApi, "dist");

function urlDe(...partes) {
  return new URL(`file://${path.join(dist, ...partes).replaceAll("\\", "/")}`).href;
}

for (const alvo of [
  ["openapi", "documento-openapi.js"],
  ["app.module.js"],
  ["auth", "politica-cookie.js"],
  ["database", "database.service.js"],
]) {
  if (!existsSync(path.join(dist, ...alvo))) {
    console.error(
      `${ROTULO} dist ausente — esta prova exige o artefato COMPILADO.\n` +
        "  npm run build --workspace @techlab-fisio/api",
    );
    process.exit(2);
  }
}

const falhas = [];
let verificacoes = 0;
function conferir(rotulo, condicao, detalhe = "") {
  verificacoes += 1;
  if (condicao) {
    console.log(`${ROTULO} OK   — ${rotulo}`);
  } else {
    console.error(`${ROTULO} FALHA — ${rotulo}${detalhe ? ` (${detalhe})` : ""}`);
    falhas.push(rotulo);
  }
}

// 1. Import ESM real dos artefatos compilados.
const moduloOpenApi = await import(urlDe("openapi", "documento-openapi.js"));
const { AppModule } = await import(urlDe("app.module.js"));
const { DatabaseService } = await import(urlDe("database", "database.service.js"));
const { NOME_COOKIE_PROTEGIDO, POLITICA_COOKIE_SESSAO } = await import(
  urlDe("auth", "politica-cookie.js")
);
const {
  NOME_ESQUEMA_SESSAO,
  TITULO_CONTRATO,
  VERSAO_CONTRATO,
  deveExporDocumento,
  montarDocumentoOpenApi,
} = moduloOpenApi;

conferir(
  "documento-openapi compilado importado por ESM real (dist/, fora do Jest)",
  typeof montarDocumentoOpenApi === "function" &&
    typeof deveExporDocumento === "function",
);

// 2. O pacote carrega no MESMO runtime e a API pública opera.
const swagger = await import("@nestjs/swagger");
const configuracaoSonda = new swagger.DocumentBuilder()
  .setTitle("sonda")
  .setVersion("0")
  .build();
conferir(
  "@nestjs/swagger carrega sob ESM/nodenext e DocumentBuilder produz objeto OpenAPI",
  configuracaoSonda.openapi?.startsWith("3.") === true,
  `openapi=${String(configuracaoSonda.openapi)}`,
);

const { Test } = await import("@nestjs/testing");

/**
 * Monta a aplicação COMPILADA no ambiente informado, sem banco — e SEM
 * `init()`.
 *
 * A ordem importa e foi MEDIDA aqui: o Nest registra o handler de rota
 * desconhecida durante a inicialização, de modo que uma rota montada DEPOIS
 * fica atrás dele e responde 404. Por isso `montarDocumentoOpenApi` roda entre
 * a criação e o `listen()` — exatamente a ordem de `main.ts`.
 */
async function montarAplicacao(ambiente) {
  const anterior = process.env.TLF_AMBIENTE;
  process.env.TLF_AMBIENTE = ambiente;
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();
    return moduleRef.createNestApplication();
  } finally {
    if (anterior === undefined) delete process.env.TLF_AMBIENTE;
    else process.env.TLF_AMBIENTE = anterior;
  }
}

// 3..6. Ambiente de desenvolvimento: documento construído E servido.
const appDev = await montarAplicacao("desenvolvimento");
let documento;
try {
  documento = montarDocumentoOpenApi(appDev, "desenvolvimento");

  conferir(
    "documento construído a partir do AppModule COMPILADO",
    documento?.info?.title === TITULO_CONTRATO &&
      documento?.info?.version === VERSAO_CONTRATO,
  );

  const caminhos = Object.keys(documento.paths ?? {}).sort();
  conferir(
    "rotas da F3 e da F6 presentes e nenhuma outra vazou",
    JSON.stringify(caminhos) ===
      JSON.stringify([
        "/auth/login",
        "/auth/logout",
        "/auth/recuperacao-senha",
        "/auth/recuperacao-senha/concluir",
        "/health",
      ]),
    `caminhos=${caminhos.join(", ")}`,
  );

  // F6 — as duas rotas de recuperação de senha, com decorators resolvidos.
  const statusInicio = Object.keys(
    documento.paths["/auth/recuperacao-senha"]?.post?.responses ?? {},
  )
    .sort()
    .join(",");
  conferir(
    "POST /auth/recuperacao-senha documenta 201,400,401,403,413,422,500",
    statusInicio === "201,400,401,403,413,422,500",
    `status=${statusInicio}`,
  );
  const statusConclusao = Object.keys(
    documento.paths["/auth/recuperacao-senha/concluir"]?.post?.responses ?? {},
  )
    .sort()
    .join(",");
  conferir(
    "POST /auth/recuperacao-senha/concluir documenta 204,400,401,403,413,429,500",
    statusConclusao === "204,400,401,403,413,429,500",
    `status=${statusConclusao}`,
  );

  const statusLogin = Object.keys(documento.paths["/auth/login"]?.post?.responses ?? {})
    .sort()
    .join(",");
  conferir(
    "POST /auth/login documenta 200,400,401,403,413,429,500 com decorators resolvidos",
    statusLogin === "200,400,401,403,413,429,500",
    `status=${statusLogin}`,
  );

  const statusLogout = Object.keys(
    documento.paths["/auth/logout"]?.post?.responses ?? {},
  )
    .sort()
    .join(",");
  conferir(
    "POST /auth/logout documenta 204,401,403,413,500",
    statusLogout === "204,401,403,413,500",
    `status=${statusLogout}`,
  );

  const esquemas = documento.components?.securitySchemes ?? {};
  conferir(
    "security scheme é cookie (nunca bearer/JWT) e nomeia o cookie de D-2.3D-07",
    esquemas[NOME_ESQUEMA_SESSAO]?.in === "cookie" &&
      esquemas[NOME_ESQUEMA_SESSAO]?.name === NOME_COOKIE_PROTEGIDO,
  );

  const propriedades = (nome) =>
    Object.keys(documento.components?.schemas?.[nome]?.properties ?? {});
  conferir(
    "LoginRespostaDto expõe SÓ usuarioId e expiraEm — o token sai pelo cookie",
    JSON.stringify(propriedades("LoginRespostaDto").sort()) ===
      JSON.stringify(["expiraEm", "usuarioId"]),
    propriedades("LoginRespostaDto").join(", "),
  );
  const PROIBIDAS = new Set([
    "token",
    "tokenhash",
    "segredo",
    "senhahash",
    "hash",
    "cookie",
    "sessaoid",
  ]);
  const vazamentos = [
    "LoginRespostaDto",
    "ErroAutenticacaoDto",
    "ErroRecuperacaoSenhaDto",
  ].flatMap((nome) => propriedades(nome).filter((p) => PROIBIDAS.has(p.toLowerCase())));
  conferir(
    "nenhum schema de resposta declara campo secreto",
    vazamentos.length === 0,
    vazamentos.join(", "),
  );
  // F6 — a ÚNICA exceção homologada (AUT-004, passo 3): a apresentação única
  // do segredo de recuperação, e nada além de `segredo` + `expiraEm`.
  conferir(
    "IniciarRecuperacaoRespostaDto expõe SÓ segredo e expiraEm (apresentação única, AUT-004)",
    JSON.stringify(propriedades("IniciarRecuperacaoRespostaDto").sort()) ===
      JSON.stringify(["expiraEm", "segredo"]),
    propriedades("IniciarRecuperacaoRespostaDto").join(", "),
  );

  // 6. A rota é de fato servida — HTTP real, no artefato compilado.
  await appDev.listen(0);
  const baseDev = await appDev.getUrl();
  const respostaDev = await fetch(`${baseDev}/openapi.json`);
  const corpoDev = respostaDev.ok ? await respostaDev.json() : null;
  conferir(
    "desenvolvimento serve GET /openapi.json com JSON válido",
    respostaDev.status === 200 && corpoDev?.info?.title === TITULO_CONTRATO,
    `status=${respostaDev.status}`,
  );
  const respostaUi = await fetch(`${baseDev}/openapi`);
  conferir(
    "a interface do Swagger UI NÃO é servida em caminho algum",
    respostaUi.status === 404 &&
      (await respostaUi.text()).includes("swagger-ui") === false,
    `status=${respostaUi.status}`,
  );
  const respostaYaml = await fetch(`${baseDev}/openapi.yaml`);
  conferir(
    "somente JSON é servido — nenhuma segunda representação do contrato",
    respostaYaml.status === 404,
    `status=${respostaYaml.status}`,
  );
} finally {
  await appDev.close();
}

// 7. Ambiente PROTEGIDO: sem rota de documento, e cookie seguro.
const appProd = await montarAplicacao("producao");
try {
  conferir(
    "deveExporDocumento é falso em produção e homologação",
    deveExporDocumento("producao") === false &&
      deveExporDocumento("homologacao") === false &&
      deveExporDocumento("desenvolvimento") === true,
  );
  montarDocumentoOpenApi(appProd, "producao");
  await appProd.listen(0);
  const baseProd = await appProd.getUrl();
  const respostaProd = await fetch(`${baseProd}/openapi.json`);
  conferir(
    "produção NÃO serve GET /openapi.json",
    respostaProd.status === 404,
    `status=${respostaProd.status}`,
  );

  const politica = appProd.get(POLITICA_COOKIE_SESSAO);
  conferir(
    "R-2.3D-04 no artefato compilado: produção resolve o cookie SEGURO",
    politica.nome === NOME_COOKIE_PROTEGIDO &&
      politica.secure === true &&
      politica.httpOnly === true &&
      politica.sameSite === "Strict" &&
      politica.path === "/" &&
      politica.domain === undefined,
  );
} finally {
  await appProd.close();
}

// 8. `F-02` — a política NÃO pode ser resolvida sem ambiente declarado.
{
  const { resolverPoliticaCookieSessao } = await import(
    urlDe("auth", "politica-cookie.js")
  );
  let abortou = false;
  try {
    resolverPoliticaCookieSessao({ DATABASE_URL: "postgresql://x", PORT: "3000" });
  } catch {
    abortou = true;
  }
  conferir(
    "F-02 — sem TLF_AMBIENTE a política de cookie ABORTA (fail-closed)",
    abortou,
  );
}

if (falhas.length > 0) {
  console.error(`${ROTULO} ${String(falhas.length)} verificação(ões) FALHARAM.`);
  process.exit(1);
}
console.log(`${ROTULO} PROVA CONCLUÍDA: ${String(verificacoes - falhas.length)} verificações OK.`);
