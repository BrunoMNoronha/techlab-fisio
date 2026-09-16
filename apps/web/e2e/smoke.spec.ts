import { test, expect, type Page } from "@playwright/test";

// TechLab Fisio — Smoke Tests E2E da Fundação Frontend (FRONT-E2E0).
//
// Valida os três cenários frontend reais existentes sobre o build de produção:
// 1. E2E-01: Página inicial (/)
// 2. E2E-02: Página de login (/login)
// 3. E2E-03: Página 404 (rota inexistente)
//
// Validações estruturais de acessibilidade semântica, ausência de erros de
// página/console, responsividade sem overflow horizontal e ausência de
// dependência de recursos externos.

const VIEWPORTS = [
  { nome: "mobile (375x812)", width: 375, height: 812 },
  { nome: "tablet (768x1024)", width: 768, height: 1024 },
  { nome: "desktop (1280x720)", width: 1280, height: 720 },
] as const;

interface Monitor {
  readonly erros: string[];
  readonly requisicoesExternas: string[];
  verificarAusenciaDeErros(): void;
}

function instalarMonitores(page: Page): Monitor {
  const erros: string[] = [];
  const requisicoesExternas: string[] = [];

  page.on("pageerror", (erro) => {
    erros.push(`[pageerror] ${erro.message}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const texto = msg.text();
      // Permite o erro esperado de recurso 404 da própria rota de prova e favicon ausente
      if (
        !texto.includes("favicon.ico") &&
        !texto.includes("__front_e2e0_rota_inexistente__") &&
        !texto.includes("404")
      ) {
        erros.push(`[console.error] ${texto}`);
      }
    }
  });

  page.on("request", (req) => {
    try {
      const url = new URL(req.url());
      if (
        url.protocol.startsWith("http") &&
        url.hostname !== "127.0.0.1" &&
        url.hostname !== "localhost"
      ) {
        requisicoesExternas.push(`[rede-externa] ${req.url()}`);
      }
    } catch {
      // URLs especiais (data:, etc.)
    }
  });

  return {
    erros,
    requisicoesExternas,
    verificarAusenciaDeErros: () => {
      expect(erros, "Nenhum erro de console ou pageerror inesperado").toEqual([]);
      expect(requisicoesExternas, "Nenhuma chamada a recursos externos de terceiros").toEqual([]);
    },
  };
}

async function validarSemOverflowHorizontal(page: Page, rotulo: string): Promise<void> {
  const metricas = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metricas.scrollWidth,
    `Overflow horizontal detectado na viewport ${rotulo}: scrollWidth=${metricas.scrollWidth} > clientWidth=${metricas.clientWidth}`,
  ).toBeLessThanOrEqual(metricas.clientWidth);
}

test.describe("FRONT-E2E0 — Smoke E2E da Fundação Frontend", () => {
  test("E2E-01 — Página inicial (/) carrega com semântica, idioma pt-BR e responsividade", async ({
    page,
  }) => {
    const monitor = instalarMonitores(page);

    const resposta = await page.goto("/");
    expect(resposta?.status()).toBe(200);

    // Idioma pt-BR
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    // Landmark main acessível
    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Heading de nível 1 coerente
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/TechLab Fisio/);

    // Link para acesso ao login presente
    const linkLogin = page.getByRole("link", { name: /acessar login/i });
    await expect(linkLogin).toBeVisible();
    await expect(linkLogin).toHaveAttribute("href", "/login");

    // Responsividade sem overflow em todas as viewports alvo
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await validarSemOverflowHorizontal(page, vp.nome);
    }

    monitor.verificarAusenciaDeErros();
  });

  test("E2E-02 — Página de login (/login) exibe formulário acessível e campos sem erro", async ({
    page,
  }) => {
    const monitor = instalarMonitores(page);

    const resposta = await page.goto("/login");
    expect(resposta?.status()).toBe(200);

    // Idioma pt-BR
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    // Landmark main
    await expect(page.getByRole("main")).toBeVisible();

    // Título da página
    const h1 = page.getByRole("heading", { level: 1, name: /TechLab Fisio/ });
    await expect(h1).toBeVisible();

    // Campos acessíveis por label e role
    const inputIdentificador = page.getByLabel("E-mail ou usuário");
    await expect(inputIdentificador).toBeVisible();
    await expect(inputIdentificador).toHaveAttribute("type", "text");
    await expect(inputIdentificador).toHaveAttribute("autoComplete", "username");

    const inputSenha = page.getByLabel("Senha");
    await expect(inputSenha).toBeVisible();
    await expect(inputSenha).toHaveAttribute("type", "password");
    await expect(inputSenha).toHaveAttribute("autoComplete", "current-password");

    const botaoEntrar = page.getByRole("button", { name: /^entrar$/i });
    await expect(botaoEntrar).toBeVisible();
    await expect(botaoEntrar).toHaveAttribute("type", "submit");

    // Link de retorno para a página inicial
    const linkVoltar = page.getByRole("link", { name: /voltar para a página inicial/i });
    await expect(linkVoltar).toBeVisible();
    await expect(linkVoltar).toHaveAttribute("href", "/");

    // Navegação via teclado: foco sequencial identificador -> senha -> botão
    await inputIdentificador.focus();
    await expect(inputIdentificador).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(inputSenha).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(botaoEntrar).toBeFocused();

    // Responsividade sem overflow
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await validarSemOverflowHorizontal(page, vp.nome);
    }

    monitor.verificarAusenciaDeErros();
  });

  test("E2E-03 — Rota inexistente (404) apresenta página própria em pt-BR e retorno funcional", async ({
    page,
  }) => {
    const monitor = instalarMonitores(page);

    const rotaInexistente = "/__front_e2e0_rota_inexistente__";
    const resposta = await page.goto(rotaInexistente);
    expect(resposta?.status()).toBe(404);

    // Idioma pt-BR
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

    // Landmark main
    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    // Heading de erro 404 próprio
    const h1 = page.getByRole("heading", { level: 1, name: /página não encontrada/i });
    await expect(h1).toBeVisible();

    // Link de retorno para a aplicação
    const linkRetorno = page.getByRole("link", { name: /voltar para a página inicial/i });
    await expect(linkRetorno).toBeVisible();

    // Responsividade sem overflow na página 404
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await validarSemOverflowHorizontal(page, vp.nome);
    }

    // Navegação funcional do link de volta para a raiz
    await linkRetorno.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: /TechLab Fisio/ })).toBeVisible();

    monitor.verificarAusenciaDeErros();
  });
});
