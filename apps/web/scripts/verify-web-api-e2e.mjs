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
//   - Casos negativos de sessão (ausente, inválida, revogada) e defesas CSRF (X-TLF-Requisicao, Origin);
//   - Tela de horário de funcionamento (CFG-002, `docs/14` D-CFG-66) dirigida em Chromium real
//     (Playwright) contra a mesma pilha: login pelo formulário, edição, persistência, auditoria,
//     rejeições do backend sem mutação e no-op;
//   - 403 sem `clinica.configurar` na tela e na API, com Recepcionista real (senha definida
//     pelo fluxo real de recuperação, login pelo formulário), sem mutação nem auditoria.
//
// Sem mocks. Limpeza garantida de processos e container (finally).

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";

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
const CLINICA_NOME = "Clinica E2E";
const CLINICA_FUSO = "America/Sao_Paulo";
const CLINICA_JUSTIFICATIVA = "Bootstrap da clinica para prova E2E same-origin";
const ROTA_HORARIO = "/configuracoes/horario-funcionamento";
const RECEPCAO_EMAIL = "recepcao.e2e@clinica.exemplo";
const RECEPCAO_NOME = "Recepcionista E2E";
const RECEPCAO_SENHA = "SenhaRecepcaoE2E456!@#";

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

// Cenário 8 — Tela de horário de funcionamento em Chromium real (CFG-002, D-CFG-66).
async function cenarioHorarioFuncionamento(urlWeb, instancia) {
  console.log(`${ROTULO} --- Cenário 8: Tela de horário de funcionamento (Chromium real, sem mocks) ---`);

  const lerGrade = () =>
    comCliente(instancia.conexaoMigrador, async (c) => {
      const r = await c.query(
        "SELECT dia_semana, to_char(hora_inicio, 'HH24:MI') AS inicio, to_char(hora_fim, 'HH24:MI') AS fim " +
          "FROM horario_funcionamento ORDER BY dia_semana, hora_inicio",
      );
      return r.rows.map((l) => `${l.dia_semana} ${l.inicio}-${l.fim}`);
    });
  // Eventos de alteração da grade: alvo clinica com ator de sessão (o bootstrap tem ator NULL — D-CFG-09).
  const contarEventosClinica = () =>
    comCliente(instancia.conexaoMigrador, async (c) => {
      const r = await c.query(
        "SELECT count(*)::int AS n FROM evento_auditoria " +
          "WHERE acao = 'configuracao.alterada' AND alvo_tipo = 'clinica' AND ator_usuario_id IS NOT NULL",
      );
      return r.rows[0].n;
    });

  const navegador = await chromium.launch();
  try {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    const errosPagina = [];
    page.on("pageerror", (e) => errosPagina.push(`[pageerror] ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // Único erro de console esperado: o 401 real de GET /api/horario-funcionamento antes do login.
      if (msg.text().startsWith("Failed to load resource:") && msg.location().url.includes("/api/horario-funcionamento")) return;
      errosPagina.push(`[console.error] ${msg.text()}`);
    });

    // 8.1/8.2 Sem sessão: a tela reflete o 401 real do backend
    await page.goto(`${urlWeb}${ROTA_HORARIO}`);
    const linkLogin = page.getByRole("link", { name: "Ir para o login" });
    await linkLogin.waitFor({ timeout: 15_000 }).catch(() => {});
    conferir("8.1 sem sessão, a tela orienta novo login (401 real via proxy)", await linkLogin.isVisible());
    conferir("8.2 sem sessão, o editor não é exibido", (await page.getByRole("button", { name: "Salvar horário" }).count()) === 0);

    // 8.3 Login pelo formulário real
    await page.goto(`${urlWeb}/login`);
    await page.getByLabel("E-mail ou usuário").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill(ADMIN_SENHA);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(`${urlWeb}/`, { timeout: 15_000 }).catch(() => {});
    const cookies = await contexto.cookies();
    conferir("8.3 login pelo formulário emite cookie de sessão no navegador", cookies.some((c) => c.name.includes("tlf_sessao")));

    // 8.4 Grade inicial vazia: todos os dias fechados
    await page.goto(`${urlWeb}${ROTA_HORARIO}`);
    const segunda = page.getByRole("group", { name: "Segunda-feira" });
    await segunda.waitFor({ timeout: 15_000 }).catch(() => {});
    const checkboxes = page.getByRole("main").getByRole("checkbox");
    const marcados = await checkboxes.evaluateAll((els) => els.filter((e) => e.checked).length);
    conferir("8.4 Administrador vê 7 dias, todos fechados (grade vazia real)", (await checkboxes.count()) === 7 && marcados === 0);

    const eventosAntes = await contarEventosClinica();

    // 8.5 Edição: segunda 08:00–12:00 + 14:00–18:00; sábado 08:00–12:00
    await segunda.getByRole("checkbox").check();
    await segunda.getByLabel("Início da janela 1 de segunda-feira").fill("08:00");
    await segunda.getByLabel("Fim da janela 1 de segunda-feira").fill("12:00");
    await segunda.getByRole("button", { name: /adicionar janela/i }).click();
    await segunda.getByLabel("Início da janela 2 de segunda-feira").fill("14:00");
    await segunda.getByLabel("Fim da janela 2 de segunda-feira").fill("18:00");
    const sabado = page.getByRole("group", { name: "Sábado" });
    await sabado.getByRole("checkbox").check();
    await sabado.getByLabel("Início da janela 1 de sábado").fill("08:00");
    await sabado.getByLabel("Fim da janela 1 de sábado").fill("12:00");
    await page.getByRole("button", { name: "Salvar horário" }).click();
    const statusSalvo = page.getByRole("main").getByRole("status");
    await statusSalvo.waitFor({ timeout: 15_000 }).catch(() => {});
    conferir("8.5 salvar pela tela confirma sucesso", ((await statusSalvo.textContent().catch(() => "")) ?? "").includes("salvo"));

    const gradeEsperada = ["1 08:00-12:00", "1 14:00-18:00", "6 08:00-12:00"];
    const gradePersistida = await lerGrade();
    conferir(
      "8.6 PostgreSQL contém exatamente a grade editada na tela",
      JSON.stringify(gradePersistida) === JSON.stringify(gradeEsperada),
      JSON.stringify(gradePersistida),
    );
    conferir(
      "8.7 salvamento emite exatamente um configuracao.alterada (alvo clinica, ator da sessão)",
      (await contarEventosClinica()) === eventosAntes + 1,
    );

    // 8.8 Recarga: a tela reflete o estado persistido
    await page.reload();
    const fimSegunda2 = segunda.getByLabel("Fim da janela 2 de segunda-feira");
    await fimSegunda2.waitFor({ timeout: 15_000 }).catch(() => {});
    conferir(
      "8.8 após recarregar, a tela exibe a grade persistida",
      (await fimSegunda2.inputValue().catch(() => "")) === "18:00" &&
        (await page.getByRole("group", { name: "Domingo" }).getByRole("checkbox").isChecked()) === false,
    );

    // 8.9 Adjacência bloqueada na tela: nenhum PUT sai do navegador
    let putsEnviados = 0;
    const contarPut = (req) => {
      if (req.method() === "PUT" && req.url().includes("/api/horario-funcionamento")) putsEnviados += 1;
    };
    page.on("request", contarPut);
    await segunda.getByLabel("Início da janela 2 de segunda-feira").fill("12:00");
    await page.getByRole("button", { name: "Salvar horário" }).click();
    await page.getByRole("main").getByRole("alert").waitFor({ timeout: 10_000 }).catch(() => {});
    conferir(
      "8.9 adjacência indicada na tela e nenhum PUT enviado",
      putsEnviados === 0 && (await segunda.getByText(/Use uma única janela/).isVisible()),
    );
    page.off("request", contarPut);
    await page.getByRole("button", { name: "Descartar alterações" }).click();

    // 8.10 O backend real rejeita adjacência mesmo sem a validação da tela (mesma sessão e origem)
    const rejeicao = await page.evaluate(async () => {
      const r = await fetch("/api/horario-funcionamento", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-tlf-requisicao": "1" },
        body: JSON.stringify({
          janelas: [
            { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
            { diaSemana: 1, horaInicio: "12:00", horaFim: "18:00" },
          ],
        }),
      });
      return { status: r.status, corpo: await r.json() };
    });
    conferir(
      "8.10 PUT com adjacência direto na API retorna 400 REQUISICAO_INVALIDA",
      rejeicao.status === 400 && rejeicao.corpo.erro === "REQUISICAO_INVALIDA",
      JSON.stringify(rejeicao),
    );

    // 8.11 Mutação sem cabeçalho anti-CSRF é recusada
    const semCsrf = await page.evaluate(async () => {
      const r = await fetch("/api/horario-funcionamento", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ janelas: [] }),
      });
      return r.status;
    });
    conferir("8.11 PUT sem X-TLF-Requisicao retorna 403", semCsrf === 403, `status=${semCsrf}`);

    // 8.12 Rejeições não mutaram nem auditaram
    conferir(
      "8.12 rejeições (tela, 400 e 403) não alteraram a grade nem emitiram auditoria",
      JSON.stringify(await lerGrade()) === JSON.stringify(gradeEsperada) && (await contarEventosClinica()) === eventosAntes + 1,
    );

    // 8.13 PUT idêntico ao vigente é no-op (D-CFG-15)
    const noop = await page.evaluate(async () => {
      const r = await fetch("/api/horario-funcionamento", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-tlf-requisicao": "1" },
        body: JSON.stringify({
          janelas: [
            { diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" },
            { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
            { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
          ],
        }),
      });
      return r.status;
    });
    conferir(
      "8.13 grade idêntica (em outra ordem) retorna 200 sem novo evento de auditoria",
      noop === 200 && (await contarEventosClinica()) === eventosAntes + 1,
      `status=${noop}`,
    );

    // 8.14 Fechar todos os dias pela tela persiste grade vazia
    await page.reload();
    await segunda.waitFor({ timeout: 15_000 }).catch(() => {});
    for (const nome of ["Segunda-feira", "Sábado"]) {
      await page.getByRole("group", { name: nome }).getByRole("checkbox").uncheck();
    }
    await page.getByRole("button", { name: "Salvar horário" }).click();
    await page.getByRole("main").getByRole("status").waitFor({ timeout: 15_000 }).catch(() => {});
    conferir(
      "8.14 fechar todos os dias pela tela persiste grade vazia e audita uma vez",
      (await lerGrade()).length === 0 && (await contarEventosClinica()) === eventosAntes + 2,
    );

    // 8.15 Sem overflow horizontal no mobile
    await page.setViewportSize({ width: 375, height: 812 });
    const metricas = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    conferir("8.15 tela sem overflow horizontal em 375px", metricas.s <= metricas.c, JSON.stringify(metricas));

    conferir("8.16 nenhum erro de página ou console inesperado", errosPagina.length === 0, errosPagina.join(" | "));
  } finally {
    await navegador.close();
  }
}

// Cenário 9 — 403 sem `clinica.configurar` na tela e na API reais (D-CFG-21, D-CFG-65, L-07).
//
// Não existe API de criação de usuário; o ÚNICO passo por SQL insere a linha do
// usuário com `senha_hash` não verificável e o vínculo ao papel `RECEPCIONISTA`
// semeado por `provisionar`. A senha utilizável é definida pelo fluxo real de
// recuperação (AUT-004) e o login ocorre pelo formulário real.
async function cenarioHorarioSemPermissao(urlWeb, instancia) {
  console.log(`${ROTULO} --- Cenário 9: 403 sem clinica.configurar (Recepcionista real, Chromium real) ---`);

  const consultar = (sql, params = []) =>
    comCliente(instancia.conexaoMigrador, async (c) => (await c.query(sql, params)).rows);
  const lerGrade = async () =>
    (
      await consultar(
        "SELECT dia_semana, to_char(hora_inicio, 'HH24:MI') AS inicio, to_char(hora_fim, 'HH24:MI') AS fim " +
          "FROM horario_funcionamento ORDER BY dia_semana, hora_inicio",
      )
    ).map((l) => `${l.dia_semana} ${l.inicio}-${l.fim}`);
  const totalEventos = async () => (await consultar("SELECT count(*)::int AS n FROM evento_auditoria"))[0].n;

  // 9.1 Fixture mínima: usuário ativo com papel RECEPCIONISTA e sem senha utilizável
  const permissoesRecepcao = await consultar(
    "SELECT pe.codigo FROM papel p JOIN papel_permissao pp ON pp.papel_id = p.id " +
      "JOIN permissao pe ON pe.id = pp.permissao_id WHERE p.codigo = 'RECEPCIONISTA'",
  );
  conferir(
    "9.1 papel RECEPCIONISTA provisionado tem permissões e NÃO tem clinica.configurar",
    permissoesRecepcao.length > 0 && !permissoesRecepcao.some((l) => l.codigo === "clinica.configurar"),
    JSON.stringify(permissoesRecepcao.map((l) => l.codigo)),
  );
  await consultar(
    "WITH u AS (INSERT INTO usuario (id, email, senha_hash, nome, ativo, atualizado_em) " +
      "VALUES (gen_random_uuid(), $1, '!senha-nao-definida', $2, true, now()) RETURNING id) " +
      "INSERT INTO usuario_papel (usuario_id, papel_id) SELECT u.id, p.id FROM u, papel p WHERE p.codigo = 'RECEPCIONISTA'",
    [RECEPCAO_EMAIL, RECEPCAO_NOME],
  );

  const navegador = await chromium.launch();
  try {
    // 9.2 Administrador: login pela tela, grade conhecida e início da recuperação de senha
    const ctxAdmin = await navegador.newContext();
    const admin = await ctxAdmin.newPage();
    await admin.goto(`${urlWeb}/login`);
    await admin.getByLabel("E-mail ou usuário").fill(ADMIN_EMAIL);
    await admin.getByLabel("Senha").fill(ADMIN_SENHA);
    await admin.getByRole("button", { name: /^entrar$/i }).click();
    await admin.waitForURL(`${urlWeb}/`, { timeout: 15_000 }).catch(() => {});

    const preparo = await admin.evaluate(async (email) => {
      const put = await fetch("/api/horario-funcionamento", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-tlf-requisicao": "1" },
        body: JSON.stringify({ janelas: [{ diaSemana: 3, horaInicio: "09:00", horaFim: "17:00" }] }),
      });
      const rec = await fetch("/api/auth/recuperacao-senha", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tlf-requisicao": "1" },
        body: JSON.stringify({ identificador: email }),
      });
      const corpo = await rec.json().catch(() => ({}));
      return { put: put.status, rec: rec.status, segredo: typeof corpo.segredo === "string" ? corpo.segredo : "" };
    }, RECEPCAO_EMAIL);
    conferir(
      "9.2 Administrador define a grade e inicia a recuperação de senha do Recepcionista (200 e 201)",
      preparo.put === 200 && preparo.rec === 201 && preparo.segredo.length > 0,
      `put=${preparo.put} rec=${preparo.rec}`,
    );
    await ctxAdmin.close();

    // 9.3 Conclusão da recuperação pelo próprio usuário, sem sessão
    const resConcluir = await fetch(`${urlWeb}/api/auth/recuperacao-senha/concluir`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tlf-requisicao": "1", origin: urlWeb },
      body: JSON.stringify({ segredo: preparo.segredo, novaSenha: RECEPCAO_SENHA }),
    });
    conferir("9.3 recuperação concluída pelo Recepcionista (204)", resConcluir.status === 204, `status=${resConcluir.status}`);

    // 9.4 Login real do Recepcionista pelo formulário
    const ctx = await navegador.newContext();
    const page = await ctx.newPage();
    const errosPagina = [];
    page.on("pageerror", (e) => errosPagina.push(`[pageerror] ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      // Esperado: os 403 reais de /api/horario-funcionamento.
      if (msg.text().startsWith("Failed to load resource:") && msg.location().url.includes("/api/horario-funcionamento")) return;
      errosPagina.push(`[console.error] ${msg.text()}`);
    });
    await page.goto(`${urlWeb}/login`);
    await page.getByLabel("E-mail ou usuário").fill(RECEPCAO_EMAIL);
    await page.getByLabel("Senha").fill(RECEPCAO_SENHA);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(`${urlWeb}/`, { timeout: 15_000 }).catch(() => {});
    conferir(
      "9.4 Recepcionista autentica pelo formulário (cookie de sessão emitido)",
      (await ctx.cookies()).some((c) => c.name.includes("tlf_sessao")),
    );

    const gradeAntes = await lerGrade();
    const eventosAntes = await totalEventos();

    // 9.5/9.6 Tela: mensagem de ausência de permissão, sem editor
    await page.goto(`${urlWeb}${ROTA_HORARIO}`);
    const alerta = page.getByRole("main").getByRole("alert");
    await alerta.waitFor({ timeout: 15_000 }).catch(() => {});
    conferir(
      "9.5 tela informa ausência de permissão (403 real via proxy)",
      ((await alerta.textContent().catch(() => "")) ?? "").includes("não tem permissão"),
    );
    conferir(
      "9.6 editor e botão de salvar não são exibidos ao Recepcionista",
      (await page.getByRole("button", { name: "Salvar horário" }).count()) === 0 &&
        (await page.getByRole("main").getByRole("checkbox").count()) === 0,
    );

    // 9.7/9.8 A autorização é do backend: chamadas diretas com a sessão real também recebem 403
    const diretas = await page.evaluate(async () => {
      const get = await fetch("/api/horario-funcionamento");
      const put = await fetch("/api/horario-funcionamento", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-tlf-requisicao": "1" },
        body: JSON.stringify({ janelas: [] }),
      });
      return {
        get: { status: get.status, corpo: await get.json().catch(() => null) },
        put: { status: put.status, corpo: await put.json().catch(() => null) },
      };
    });
    conferir(
      "9.7 GET direto com sessão do Recepcionista retorna 403 ACESSO_NEGADO",
      diretas.get.status === 403 && diretas.get.corpo?.erro === "ACESSO_NEGADO",
      JSON.stringify(diretas.get),
    );
    conferir(
      "9.8 PUT direto (com cabeçalho anti-CSRF válido) retorna 403 ACESSO_NEGADO",
      diretas.put.status === 403 && diretas.put.corpo?.erro === "ACESSO_NEGADO",
      JSON.stringify(diretas.put),
    );

    // 9.9 Nenhuma mutação e nenhum evento (403 não é auditado — lista fechada de L-07)
    const gradeDepois = await lerGrade();
    conferir(
      "9.9 403 não alterou a grade e não gerou evento de auditoria",
      JSON.stringify(gradeDepois) === JSON.stringify(gradeAntes) &&
        JSON.stringify(gradeAntes) === JSON.stringify(["3 09:00-17:00"]) &&
        (await totalEventos()) === eventosAntes,
      `grade=${JSON.stringify(gradeDepois)}`,
    );

    conferir("9.10 nenhum erro de página ou console inesperado", errosPagina.length === 0, errosPagina.join(" | "));
  } finally {
    await navegador.close();
  }
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

    // 2b. Provisionar a linha única da clínica (CFG-001B) — pré-requisito da tela de horário
    console.log(`${ROTULO} provisionando a clínica via CLI compilado...`);
    const resultadoClinica = spawnSync(
      process.execPath,
      [path.join(raizApi, "dist", "provisionamento", "cli.js"), "bootstrap-clinica"],
      {
        cwd: raizApi,
        env: {
          ...process.env,
          DATABASE_URL: instancia.urlApp,
          TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL: CLINICA_NOME,
          TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: CLINICA_FUSO,
          TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA: CLINICA_JUSTIFICATIVA,
        },
        encoding: "utf8",
      },
    );
    if (resultadoClinica.status !== 0) {
      falhar(`bootstrap-clinica via CLI falhou (exit ${resultadoClinica.status}): ${resultadoClinica.stderr || resultadoClinica.stdout}`);
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

    await cenarioHorarioFuncionamento(urlWeb, instancia);
    await cenarioHorarioSemPermissao(urlWeb, instancia);

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
