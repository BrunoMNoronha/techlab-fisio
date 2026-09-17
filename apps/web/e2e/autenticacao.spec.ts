import { test, expect, type Page } from "@playwright/test";

// TechLab Fisio — E2E de autenticação real no navegador (CI-E2E0).
//
// Executado pelo orquestrador oficial `scripts/run-playwright-e2e.mjs`
// (`pnpm run test:e2e`): PostgreSQL 18 descartável, Administrador e clínica
// sintéticos, API NestJS compilada e Next.js compilado. Topologia exercitada:
// Chromium → Next.js (`/api/*`, proxy same-origin) → NestJS → PostgreSQL.
// Nenhum mock (`page.route`) e nenhum controle de segurança relaxado: CSRF
// (`X-TLF-Requisicao` + `Origin`/`Host`), cookie HttpOnly e SameSite=Strict
// são os reais.
//
// Cada teste usa um contexto novo do navegador (sem cookie herdado). O teste de
// credencial inválida usa um identificador sintético INEXISTENTE, para não
// consumir a janela anti-abuso do Administrador (D-2.3D-06) e não criar
// dependência de ordem entre os testes.

const NOME_COOKIE_SESSAO = "tlf_sessao_dev"; // TLF_AMBIENTE=teste (D-2.3D-07)
const ROTA_PROTEGIDA = "/configuracoes/horario-funcionamento";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    // Fail-closed: sem o ambiente do orquestrador a prova nunca é pulada em silêncio.
    throw new Error(`${nome} ausente. Execute a suíte pelo comando oficial: pnpm run test:e2e`);
  }
  return valor;
}

const IDENTIFICADOR = variavelObrigatoria("TLF_E2E_ADMIN_IDENTIFICADOR");
const SENHA = variavelObrigatoria("TLF_E2E_ADMIN_SENHA");

interface RespostaNavegador {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly corpo: Record<string, unknown> | null;
}

// Requisição disparada DE DENTRO da página: é o navegador que decide enviar o
// cookie HttpOnly e os cabeçalhos Origin/Sec-Fetch-*, como no cliente HTTP da aplicação.
async function requisitarNoNavegador(
  page: Page,
  metodo: "GET" | "POST",
  caminho: string,
  headers: Record<string, string> = {},
): Promise<RespostaNavegador> {
  return page.evaluate(
    async ({ metodo, caminho, headers }) => {
      const res = await fetch(caminho, {
        method: metodo,
        headers: { accept: "application/json", ...headers },
        body: metodo === "POST" ? "{}" : undefined,
      });
      const texto = await res.text();
      return {
        status: res.status,
        cacheControl: res.headers.get("cache-control"),
        corpo: texto ? (JSON.parse(texto) as Record<string, unknown>) : null,
      };
    },
    { metodo, caminho, headers },
  );
}

async function preencherLogin(page: Page, identificador: string, senha: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail ou usuário").fill(identificador);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: /^entrar$/i }).click();
}

function aguardarRespostaLogin(page: Page) {
  return page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/login" && r.request().method() === "POST",
  );
}

// Toda requisição HTTP do navegador vai à origem do Next.js: a API interna
// nunca é contatada diretamente (topologia same-origin).
function registrarOrigensHttp(page: Page): Set<string> {
  const origens = new Set<string>();
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol === "http:" || url.protocol === "https:") origens.add(url.origin);
  });
  return origens;
}

// Mensagens de console esperadas: "Failed to load resource" dos 401 reais da API
// (sessão ausente/revogada ou credencial inválida). Qualquer outra reprova.
function monitorarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    let caminho = "";
    try {
      caminho = new URL(msg.location().url).pathname;
    } catch {
      // mensagem sem URL de origem: nunca é tolerada
    }
    if (msg.text().startsWith("Failed to load resource:") && caminho.startsWith("/api/")) return;
    erros.push(`[console.error] ${msg.text()}`);
  });
  return erros;
}

test.describe("CI-E2E0 — Autenticação real no navegador (same-origin)", () => {
  test("AUT-E2E-01 — Rota protegida sem sessão orienta login e a API responde 401", async ({
    page,
    context,
    baseURL,
  }) => {
    const erros = monitorarErros(page);
    const origens = registrarOrigensHttp(page);

    await page.goto(ROTA_PROTEGIDA);
    await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar horário" })).toHaveCount(0);

    const sessao = await requisitarNoNavegador(page, "GET", "/api/auth/sessao");
    expect(sessao.status).toBe(401);
    expect(sessao.corpo?.["erro"]).toBe("SESSAO_INVALIDA");
    expect(await context.cookies()).toEqual([]);

    expect([...origens]).toEqual([new URL(baseURL!).origin]);
    expect(erros).toEqual([]);
  });

  test("AUT-E2E-02 — Credencial inválida exibe erro, não cria sessão e mantém o login", async ({
    page,
    context,
  }) => {
    const erros = monitorarErros(page);

    const respostaLogin = aguardarRespostaLogin(page);
    await preencherLogin(page, "inexistente.playwright@clinica.exemplo", `${SENHA}-incorreta`);
    expect((await respostaLogin).status()).toBe(401);

    // Filtro por texto: o Next.js mantém o próprio `role="alert"` (route announcer).
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Senha")).toBeEnabled();
    expect((await context.cookies()).find((c) => c.name === NOME_COOKIE_SESSAO)).toBeUndefined();

    const sessao = await requisitarNoNavegador(page, "GET", "/api/auth/sessao");
    expect(sessao.status).toBe(401);
    expect(sessao.corpo?.["erro"]).toBe("SESSAO_INVALIDA");

    expect(erros).toEqual([]);
  });

  test("AUT-E2E-03 — Login, sessão autenticada refletida na tela, CSRF, logout e revogação", async ({
    page,
    context,
    baseURL,
  }) => {
    const erros = monitorarErros(page);
    const origens = registrarOrigensHttp(page);

    // 1. Login pelo formulário real → 200 pelo proxy same-origin → navegação para "/".
    const respostaLogin = aguardarRespostaLogin(page);
    await preencherLogin(page, IDENTIFICADOR, SENHA);
    const login = await respostaLogin;
    expect(login.status()).toBe(200);
    expect(new URL(login.url()).origin).toBe(new URL(baseURL!).origin);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: /TechLab Fisio/ })).toBeVisible();

    // 2. Cookie de sessão real, com os atributos protegidos e invisível ao JavaScript.
    const cookieSessao = (await context.cookies()).find((c) => c.name === NOME_COOKIE_SESSAO);
    expect(cookieSessao, "cookie de sessão emitido pelo proxy same-origin").toBeDefined();
    expect(cookieSessao?.httpOnly).toBe(true);
    expect(cookieSessao?.sameSite).toBe("Strict");
    expect(cookieSessao?.path).toBe("/");
    expect(await page.evaluate(() => document.cookie)).not.toContain(NOME_COOKIE_SESSAO);

    // 3. GET /auth/sessao pela topologia same-origin (D-2.3D-20).
    const sessao = await requisitarNoNavegador(page, "GET", "/api/auth/sessao");
    expect(sessao.status).toBe(200);
    expect(sessao.cacheControl).toBe("no-store");
    expect(sessao.corpo?.["usuarioId"]).toMatch(UUID);
    expect(sessao.corpo?.["sessaoId"]).toMatch(UUID);

    // 4. O frontend reflete a sessão: a rota protegida exibe o editor, não o convite ao login.
    await page.goto(ROTA_PROTEGIDA);
    await expect(page.getByRole("button", { name: "Salvar horário" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("checkbox")).toHaveCount(7);
    await expect(page.getByRole("link", { name: "Ir para o login" })).toHaveCount(0);

    // 5. Mutação sem X-TLF-Requisicao é recusada pelo guard CSRF e NÃO revoga a sessão.
    const logoutSemCsrf = await requisitarNoNavegador(page, "POST", "/api/auth/logout", {
      "content-type": "application/json",
    });
    expect(logoutSemCsrf.status).toBe(403);
    expect(logoutSemCsrf.corpo?.["erro"]).toBe("REQUISICAO_NAO_AUTORIZADA");
    expect((await requisitarNoNavegador(page, "GET", "/api/auth/sessao")).status).toBe(200);

    // 6. Logout real (mesmos cabeçalhos do cliente HTTP da aplicação).
    const logout = await requisitarNoNavegador(page, "POST", "/api/auth/logout", {
      "content-type": "application/json",
      "x-tlf-requisicao": "1",
    });
    expect(logout.status).toBe(204);
    expect((await context.cookies()).find((c) => c.name === NOME_COOKIE_SESSAO)).toBeUndefined();

    const posLogout = await requisitarNoNavegador(page, "GET", "/api/auth/sessao");
    expect(posLogout.status).toBe(401);
    expect(posLogout.corpo?.["erro"]).toBe("SESSAO_INVALIDA");

    await page.reload();
    await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar horário" })).toHaveCount(0);

    // 7. Revogação é do SERVIDOR, não só remoção do cookie: reinjetar o valor antigo não dá acesso.
    await context.addCookies([cookieSessao!]);
    const reuso = await requisitarNoNavegador(page, "GET", "/api/auth/sessao");
    expect(reuso.status).toBe(401);
    expect(reuso.corpo?.["erro"]).toBe("SESSAO_INVALIDA");

    expect([...origens]).toEqual([new URL(baseURL!).origin]);
    expect(erros).toEqual([]);
  });
});
