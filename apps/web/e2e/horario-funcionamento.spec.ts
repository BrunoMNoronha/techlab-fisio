import { test, expect, type Page, type Route } from "@playwright/test";

// TechLab Fisio — E2E da tela de horário de funcionamento (CFG-002; `docs/14` D-CFG-66).
//
// A API é simulada no navegador (`page.route`) — esta suíte prova o
// comportamento da tela; o contrato real do backend é provado em `apps/api`
// (`horario-funcionamento.integration.spec.ts`). Chromium registra
// "Failed to load resource" para respostas 4xx simuladas; só essas mensagens,
// originadas de `/api/horario-funcionamento`, são toleradas.

const ROTA = "/configuracoes/horario-funcionamento";
const API = "**/api/horario-funcionamento";

interface Janela {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

function monitorarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const origem = msg.location().url;
    if (msg.text().startsWith("Failed to load resource:") && origem.includes("/api/horario-funcionamento")) return;
    erros.push(`[console.error] ${msg.text()}`);
  });
  return erros;
}

async function simularApi(
  page: Page,
  gradeInicial: Janela[],
): Promise<{ puts: { corpo: unknown; cabecalhos: Record<string, string> }[] }> {
  const puts: { corpo: unknown; cabecalhos: Record<string, string> }[] = [];
  let grade = gradeInicial;
  await page.route(API, async (route: Route) => {
    const req = route.request();
    if (req.method() === "GET") {
      await route.fulfill({ status: 200, json: { janelas: grade } });
      return;
    }
    const corpo = req.postDataJSON() as { janelas: Janela[] };
    puts.push({ corpo, cabecalhos: req.headers() });
    grade = corpo.janelas;
    await route.fulfill({ status: 200, json: { janelas: grade } });
  });
  return { puts };
}

test.describe("CFG-002 — Tela de horário de funcionamento", () => {
  test("HF-01 — carrega a grade vigente com dias abertos e fechados", async ({ page }) => {
    const erros = monitorarErros(page);
    await simularApi(page, [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
      { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
      { diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" },
    ]);

    await page.goto(ROTA);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByRole("heading", { level: 1, name: "Horário de funcionamento" })).toBeVisible();

    const segunda = page.getByRole("group", { name: "Segunda-feira" });
    await expect(segunda.getByRole("checkbox")).toBeChecked();
    await expect(segunda.getByLabel("Início da janela 1 de segunda-feira")).toHaveValue("08:00");
    await expect(segunda.getByLabel("Fim da janela 2 de segunda-feira")).toHaveValue("18:00");

    const domingo = page.getByRole("group", { name: "Domingo" });
    await expect(domingo.getByRole("checkbox")).not.toBeChecked();
    await expect(domingo.getByText("Fechado")).toBeVisible();

    await expect(page.getByRole("button", { name: "Salvar horário" })).toBeDisabled();
    expect(erros).toEqual([]);
  });

  test("HF-02 — adjacência é indicada no cliente e não envia PUT", async ({ page }) => {
    const erros = monitorarErros(page);
    const api = await simularApi(page, [{ diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" }]);
    await page.goto(ROTA);

    const terca = page.getByRole("group", { name: "Terça-feira" });
    await terca.getByRole("button", { name: /adicionar janela/i }).click();
    await terca.getByLabel("Início da janela 2 de terça-feira").fill("12:00");
    await terca.getByLabel("Fim da janela 2 de terça-feira").fill("18:00");
    await page.getByRole("button", { name: "Salvar horário" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText("Corrija os horários");
    await expect(terca.getByText(/Use uma única janela 08:00–18:00/)).toBeVisible();
    await expect(terca.getByLabel("Início da janela 2 de terça-feira")).toHaveAttribute("aria-invalid", "true");
    expect(api.puts).toHaveLength(0);
    expect(erros).toEqual([]);
  });

  test("HF-03 — salvar envia a grade inteira num único PUT com cabeçalho anti-CSRF", async ({ page }) => {
    const erros = monitorarErros(page);
    const api = await simularApi(page, [{ diaSemana: 1, horaInicio: "08:00", horaFim: "18:00" }]);
    await page.goto(ROTA);

    const sabado = page.getByRole("group", { name: "Sábado" });
    await sabado.getByRole("checkbox").check();
    await sabado.getByLabel("Início da janela 1 de sábado").fill("08:00");
    await sabado.getByLabel("Fim da janela 1 de sábado").fill("12:00");

    const segunda = page.getByRole("group", { name: "Segunda-feira" });
    await segunda.getByRole("checkbox").uncheck();

    await page.getByRole("button", { name: "Salvar horário" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("Horário de funcionamento salvo.");

    expect(api.puts).toHaveLength(1);
    expect(api.puts[0]?.corpo).toEqual({ janelas: [{ diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" }] });
    expect(api.puts[0]?.cabecalhos["x-tlf-requisicao"]).toBe("1");
    await expect(page.getByRole("button", { name: "Salvar horário" })).toBeDisabled();
    expect(erros).toEqual([]);
  });

  test("HF-04 — 403 do backend apresenta ausência de permissão sem editor", async ({ page }) => {
    const erros = monitorarErros(page);
    await page.route(API, (route) => route.fulfill({ status: 403, json: { erro: "ACESSO_NEGADO" } }));
    await page.goto(ROTA);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("não tem permissão");
    await expect(page.getByRole("button", { name: "Salvar horário" })).toHaveCount(0);
    expect(erros).toEqual([]);
  });

  test("HF-05 — 401 do backend orienta novo login", async ({ page }) => {
    const erros = monitorarErros(page);
    await page.route(API, (route) => route.fulfill({ status: 401, json: { erro: "SESSAO_INVALIDA" } }));
    await page.goto(ROTA);
    await expect(page.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
    expect(erros).toEqual([]);
  });

  test("HF-06 — 400 do servidor mostra mensagem genérica e preserva o rascunho", async ({ page }) => {
    const erros = monitorarErros(page);
    await page.route(API, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, json: { janelas: [] } })
        : route.fulfill({ status: 400, json: { erro: "REQUISICAO_INVALIDA" } }),
    );
    await page.goto(ROTA);
    const quarta = page.getByRole("group", { name: "Quarta-feira" });
    await quarta.getByRole("checkbox").check();
    await quarta.getByLabel("Início da janela 1 de quarta-feira").fill("09:00");
    await quarta.getByLabel("Fim da janela 1 de quarta-feira").fill("17:00");
    await page.getByRole("button", { name: "Salvar horário" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("O servidor recusou a grade");
    await expect(quarta.getByLabel("Início da janela 1 de quarta-feira")).toHaveValue("09:00");
    expect(erros).toEqual([]);
  });

  test("HF-07 — limite de 4 janelas e ausência de overflow no mobile", async ({ page }) => {
    const erros = monitorarErros(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await simularApi(page, [
      { diaSemana: 5, horaInicio: "06:00", horaFim: "07:00" },
      { diaSemana: 5, horaInicio: "08:00", horaFim: "09:00" },
      { diaSemana: 5, horaInicio: "10:00", horaFim: "11:00" },
      { diaSemana: 5, horaInicio: "12:00", horaFim: "13:00" },
    ]);
    await page.goto(ROTA);
    const sexta = page.getByRole("group", { name: "Sexta-feira" });
    await expect(sexta.getByRole("button", { name: /adicionar janela/i })).toBeDisabled();
    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    expect(erros).toEqual([]);
  });
});
