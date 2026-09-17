import { test, expect, type Locator, type Page } from "@playwright/test";

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

// rota404Esperada: somente no cenário 404, tolera o erro de console que o
// navegador emite para o próprio documento com status 404 — identificado pela
// URL de origem da mensagem, nunca por substring do texto.
function instalarMonitores(page: Page, rota404Esperada?: string): Monitor {
  const erros: string[] = [];
  const requisicoesExternas: string[] = [];

  page.on("pageerror", (erro) => {
    erros.push(`[pageerror] ${erro.message}`);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const texto = msg.text();
    let caminhoOrigem = "";
    try {
      caminhoOrigem = new URL(msg.location().url).pathname;
    } catch {
      // mensagem sem URL de origem: nunca é tolerada
    }
    const erro404Esperado =
      rota404Esperada !== undefined &&
      caminhoOrigem === rota404Esperada &&
      texto.startsWith("Failed to load resource:") &&
      texto.includes("404");
    if (!erro404Esperado) {
      erros.push(`[console.error] ${texto}`);
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

// Foco visível: o elemento focado por teclado casa com :focus-visible e o
// indicador (outline de globals.css) não foi removido nem zerado.
async function validarFocoVisivel(elemento: Locator, rotulo: string): Promise<void> {
  const foco = await elemento.evaluate((el) => {
    const estilo = getComputedStyle(el);
    return {
      focusVisible: el.matches(":focus-visible"),
      outlineStyle: estilo.outlineStyle,
      outlineWidth: Number.parseFloat(estilo.outlineWidth),
      outlineColor: estilo.outlineColor,
    };
  });
  // Cor computada vem como rgb(r, g, b) ou rgba(r, g, b, a) / rgb(r g b / a);
  // alfa ausente equivale a opaco. Alfa 0 (ex.: transparent) = foco invisível.
  const canais = /rgba?\(([^)]*)\)/.exec(foco.outlineColor)?.[1]?.split(/[\s,/]+/).filter(Boolean);
  const alfa = canais?.[3] !== undefined ? Number.parseFloat(canais[3]) : 1;
  expect(foco.focusVisible, `${rotulo}: deveria casar com :focus-visible`).toBe(true);
  expect(foco.outlineStyle, `${rotulo}: indicador de foco removido (outline-style)`).not.toBe("none");
  expect(foco.outlineWidth, `${rotulo}: indicador de foco sem espessura`).toBeGreaterThan(0);
  expect(canais, `${rotulo}: cor de outline em formato inesperado (${foco.outlineColor})`).toBeDefined();
  expect(alfa, `${rotulo}: indicador de foco transparente (${foco.outlineColor})`).toBeGreaterThan(0);
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
    await validarFocoVisivel(inputSenha, "campo Senha");

    await page.keyboard.press("Tab");
    await expect(botaoEntrar).toBeFocused();
    await validarFocoVisivel(botaoEntrar, "botão Entrar");

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
    const rotaInexistente = "/__front_e2e0_rota_inexistente__";
    const monitor = instalarMonitores(page, rotaInexistente);

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
    await expect(linkRetorno).toHaveAttribute("href", "/");

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
