// TechLab Fisio — integração contra PostgreSQL REAL do catálogo de serviços
// (CFG-003; `docs/14` §3.11, D-CFG-22..D-CFG-33).
//
// Runtime exclusivamente `tlf_app`; HTTP real via `app.listen(0)`; limpeza por
// TRUNCATE entre testes (setup-db.ts). Dados 100% sintéticos.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { ERRO } from "../../src/auth/auth.dto.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { SessaoService } from "../../src/auth/sessao.service.js";
import { ERRO_AUTORIZACAO } from "../../src/authz/erro-autorizacao.js";
import { ERRO_CLINICA } from "../../src/clinica/clinica.dto.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { ERRO_SERVICO } from "../../src/servicos/servicos.dto.js";

let moduleRef: TestingModule;
let app: INestApplication;
let baseUrl: string;
let database: DatabaseService;
let sessoes: SessaoService;
let auditWriter: AuditWriter;
let politicaCookie: PoliticaCookieSessao;

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = await app.getUrl();
  database = moduleRef.get(DatabaseService);
  sessoes = moduleRef.get(SessaoService);
  auditWriter = moduleRef.get(AuditWriter);
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
}, 180_000);

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ID_INEXISTENTE = "0191f5a0-0000-7000-8000-000000000000";

function corpo(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return { nome: "Fisioterapia ortopédica", duracaoMin: 50, precoReferencia: "150.00", ...sobrescrever };
}

async function provisionarClinica(): Promise<string> {
  return database.transacao(async (tx) => {
    const c = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética Ltda.", fusoHorario: "America/Sao_Paulo" },
      select: { id: true },
    });
    return c.id;
  });
}

async function criarUsuario(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `srv-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-srv",
        nome: "Usuário Sintético SRV",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

async function darPermissao(usuarioId: string, codigo: string): Promise<void> {
  await database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `papel-${randomUUID().slice(0, 8)}`, nome: "Papel Teste" },
      select: { id: true },
    });
    const existente = await tx.permissao.findUnique({ where: { codigo }, select: { id: true } });
    const permissao =
      existente ?? (await tx.permissao.create({ data: { codigo, nome: codigo }, select: { id: true } }));
    await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
  });
}

async function cookieDe(usuarioId: string): Promise<string> {
  const emitida = await sessoes.emitir({ usuarioId });
  return `${politicaCookie.nome}=${emitida.token}`;
}

async function administrador(): Promise<{ id: string; cookie: string }> {
  const id = await criarUsuario();
  await darPermissao(id, "clinica.configurar");
  return { id, cookie: await cookieDe(id) };
}

interface RespostaHttp {
  status: number;
  body: any;
  headers: Headers;
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH";

async function requisitar(
  metodo: Metodo,
  caminho: string,
  opcoes: { cookie?: string; corpo?: unknown; csrf?: boolean } = {},
): Promise<RespostaHttp> {
  const headers: Record<string, string> = {
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    ...(opcoes.cookie ? { cookie: opcoes.cookie } : {}),
  };
  const mutacao = metodo !== "GET";
  if (mutacao) {
    headers["content-type"] = "application/json";
    if (opcoes.csrf !== false) headers[CABECALHO_REQUISICAO_TLF] = "1";
  }
  const res = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers,
    ...(mutacao
      ? { body: typeof opcoes.corpo === "string" ? opcoes.corpo : JSON.stringify(opcoes.corpo) }
      : {}),
  });
  const texto = await res.text();
  let body: any = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* corpo não-JSON preservado como texto */
  }
  return { status: res.status, body, headers: res.headers };
}

async function criarViaApi(cookie: string, sobrescrever: Record<string, unknown> = {}): Promise<any> {
  const res = await requisitar("POST", "/servicos", { cookie, corpo: corpo(sobrescrever) });
  expect(res.status).toBe(201);
  return res.body;
}

interface LinhaServico {
  id: string;
  clinica_id: string;
  nome: string;
  duracao_min: number;
  preco_referencia: string;
  ativo: boolean;
  inativado_em: Date | null;
}

async function lerServicos(): Promise<LinhaServico[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaServico[]>`
      SELECT id, clinica_id, nome, duracao_min, preco_referencia::text AS preco_referencia, ativo, inativado_em
        FROM servico ORDER BY id`,
  );
}

interface LinhaEvento {
  acao: string;
  ator_usuario_id: string | null;
  alvo_tipo: string;
  alvo_id: string | null;
  resultado: string;
  justificativa: string | null;
  contexto: unknown;
  correlacao_id: string;
}

async function eventos(): Promise<LinhaEvento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaEvento[]>`
      SELECT acao, ator_usuario_id, alvo_tipo, alvo_id, resultado::text AS resultado,
             justificativa, contexto, correlacao_id
        FROM evento_auditoria
       ORDER BY ocorrido_em`,
  );
}

function contextoVazio(evento: LinhaEvento): boolean {
  return evento.contexto === null || JSON.stringify(evento.contexto) === "{}";
}

async function xmin(servicoId: string): Promise<string | undefined> {
  const r = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM servico WHERE id = ${servicoId}::uuid`,
  );
  return r[0]?.x;
}

async function erroSql(sql: (tx: any) => Promise<unknown>): Promise<string> {
  let erro: unknown;
  try {
    await database.transacao(sql);
  } catch (e) {
    erro = e;
  }
  expect(erro).toBeDefined();
  return JSON.stringify(erro, Object.getOwnPropertyNames(erro as object));
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

const ROTAS: Array<[Metodo, string, unknown]> = [
  ["GET", "/servicos", undefined],
  ["GET", `/servicos/${ID_INEXISTENTE}`, undefined],
  ["POST", "/servicos", corpo()],
  ["PUT", `/servicos/${ID_INEXISTENTE}`, corpo()],
  ["PATCH", `/servicos/${ID_INEXISTENTE}/situacao`, { ativo: false }],
];

describe("CFG-003 — autenticação, autorização e CSRF (D-CFG-30)", () => {
  it.each(ROTAS)("%s %s sem sessão -> 401 SESSAO_INVALIDA", async (metodo, caminho, c) => {
    await provisionarClinica();
    const res = await requisitar(metodo, caminho, { corpo: c });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    expect(await lerServicos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each(ROTAS)("%s %s sem clinica.configurar -> 403 ACESSO_NEGADO sem evento", async (metodo, caminho, c) => {
    await provisionarClinica();
    const operador = await criarUsuario();
    await darPermissao(operador, "agenda.gerenciar");
    const res = await requisitar(metodo, caminho, { cookie: await cookieDe(operador), corpo: c });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await lerServicos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each(ROTAS.filter(([m]) => m !== "GET"))(
    "%s %s sem x-tlf-requisicao -> 403 REQUISICAO_NAO_AUTORIZADA, mesmo com permissão",
    async (metodo, caminho, c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const res = await requisitar(metodo, caminho, { cookie, corpo: c, csrf: false });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
      expect(await lerServicos()).toHaveLength(0);
    },
  );

  it("os GETs não exigem CSRF e respondem Cache-Control: no-store", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    for (const caminho of ["/servicos", `/servicos/${criado.id}`]) {
      const res = await requisitar("GET", caminho, { cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("usuário inativado pela AUT-005 perde o acesso (sessões revogadas -> 401)", async () => {
    await provisionarClinica();
    const admin = await administrador();
    expect((await requisitar("GET", "/servicos", { cookie: admin.cookie })).status).toBe(200);

    const gestorContas = await criarUsuario();
    await darPermissao(gestorContas, "usuarios.gerenciar");
    const inativacao = await requisitar("PATCH", `/auth/usuarios/${admin.id}/situacao`, {
      cookie: await cookieDe(gestorContas),
      corpo: { ativo: false },
    });
    expect(inativacao.status).toBe(200);

    const res = await requisitar("GET", "/servicos", { cookie: admin.cookie });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("não existe DELETE (D-CFG-24)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const res = await fetch(`${baseUrl}/servicos/${criado.id}`, {
      method: "DELETE",
      headers: { cookie, [CABECALHO_REQUISICAO_TLF]: "1", "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(404);
    expect(await lerServicos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

describe("CFG-003 — criação (D-CFG-24, D-CFG-26, D-CFG-27, D-CFG-32)", () => {
  it("CA-SRV-01: cria ativo, responde exatamente os 6 campos e emite 1 evento sem valores", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();

    const res = await requisitar("POST", "/servicos", {
      cookie: admin.cookie,
      corpo: corpo({ nome: "  Pilates clínico  ", precoReferencia: "1234.56", duracaoMin: 45 }),
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ["ativo", "duracaoMin", "id", "inativadoEm", "nome", "precoReferencia"],
    );
    expect(res.body).toMatchObject({
      nome: "Pilates clínico",
      duracaoMin: 45,
      precoReferencia: "1234.56",
      ativo: true,
      inativadoEm: null,
    });

    const [linha] = await lerServicos();
    expect(linha).toEqual({
      id: res.body.id,
      clinica_id: clinicaId,
      nome: "Pilates clínico",
      duracao_min: 45,
      preco_referencia: "1234.56",
      ativo: true,
      inativado_em: null,
    });

    const lista = await eventos();
    expect(lista).toHaveLength(1);
    const evento = lista[0] as LinhaEvento;
    expect(evento).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: admin.id,
      alvo_tipo: "servico",
      alvo_id: res.body.id,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(contextoVazio(evento)).toBe(true);
    // Valores escolhidos para não colidir com UUIDs/hex: nome e preço nunca aparecem;
    // a duração (inteiro) é coberta por `contexto` vazio e `justificativa` nula.
    const serializado = JSON.stringify(evento);
    for (const valor of ["Pilates", "1234.56"]) expect(serializado).not.toContain(valor);
  });

  it("aceita preço 0.00 e os limites 1 e 1440 de duração", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    expect((await criarViaApi(cookie, { nome: "Avaliação", precoReferencia: "0.00", duracaoMin: 1 })).precoReferencia).toBe("0.00");
    expect((await criarViaApi(cookie, { nome: "Imersão", precoReferencia: "9999999999.99", duracaoMin: 1440 })).duracaoMin).toBe(1440);
  });

  it("CA-SRV-06: sem clínica provisionada -> 404 CLINICA_NAO_CONFIGURADA, nada criado", async () => {
    const { cookie } = await administrador();
    const res = await requisitar("POST", "/servicos", { cookie, corpo: corpo() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
    expect(await lerServicos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each([
    ["mesmo nome", "Fisioterapia ortopédica"],
    ["caixa diferente", "FISIOTERAPIA ORTOPÉDICA"],
    ["espaços de borda", "  fisioterapia ortopédica "],
  ])("CA-SRV-05: %s -> 409 SERVICO_DUPLICADO sem segundo registro nem evento", async (_rotulo, nome) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie);
    const antesEventos = (await eventos()).length;

    const res = await requisitar("POST", "/servicos", { cookie, corpo: corpo({ nome }) });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_SERVICO.SERVICO_DUPLICADO });
    expect(await lerServicos()).toHaveLength(1);
    expect(await eventos()).toHaveLength(antesEventos);
  });

  it("CA-SRV-05: o nome de serviço INATIVO não é liberado para reuso", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    expect((await requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: { ativo: false } })).status).toBe(200);

    const res = await requisitar("POST", "/servicos", { cookie, corpo: corpo() });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_SERVICO.SERVICO_DUPLICADO });
  });

  it("nome apenas semelhante (não equivalente) é permitido", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, { nome: "Fisioterapia" });
    await criarViaApi(cookie, { nome: "Fisioterapia Ortopédica" });
    expect(await lerServicos()).toHaveLength(2);
  });

  const invalidos: Array<[string, unknown]> = [
    ["nome vazio", corpo({ nome: "   " })],
    ["nome acima de 200", corpo({ nome: "a".repeat(201) })],
    ["nome com caractere de controle", corpo({ nome: `Fisio${String.fromCharCode(10)}terapia` })],
    ["duração zero", corpo({ duracaoMin: 0 })],
    ["duração 1441", corpo({ duracaoMin: 1441 })],
    ["duração fracionária", corpo({ duracaoMin: 50.5 })],
    ["duração string", corpo({ duracaoMin: "50" })],
    ["preço negativo", corpo({ precoReferencia: "-1.00" })],
    ["preço number", corpo({ precoReferencia: 150 })],
    ["preço sem casas", corpo({ precoReferencia: "150" })],
    ["chave extra ativo", corpo({ ativo: false })],
    ["chave extra id", corpo({ id: ID_INEXISTENTE })],
    ["chave ausente", { nome: "X", duracaoMin: 10 }],
    ["array", [corpo()]],
  ];

  it.each(invalidos)("CA-SRV-02..04/15: %s -> 400 REQUISICAO_INVALIDA sem escrita", async (_rotulo, c) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("POST", "/servicos", { cookie, corpo: c });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerServicos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it("JSON `null` é recusado pelo body parser antes do roteamento -> 400 sem escrita", async () => {
    // Limite conhecido (`erro-servicos.filter.ts`): o corpo do erro é o padrão da plataforma.
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("POST", "/servicos", { cookie, corpo: "null" });
    expect(res.status).toBe(400);
    expect(await lerServicos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

describe("CFG-003 — consulta (D-CFG-28)", () => {
  it("catálogo vazio -> 200 []", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("GET", "/servicos", { cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("CA-SRV-07: ordem ativo DESC, nome sem caixa, id; filtro ativo; consulta não audita", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const zeta = await criarViaApi(cookie, { nome: "zeta" });
    const alfa = await criarViaApi(cookie, { nome: "Alfa" });
    const beta = await criarViaApi(cookie, { nome: "beta" });
    const gama = await criarViaApi(cookie, { nome: "Gama" });
    await requisitar("PATCH", `/servicos/${alfa.id}/situacao`, { cookie, corpo: { ativo: false } });
    await requisitar("PATCH", `/servicos/${gama.id}/situacao`, { cookie, corpo: { ativo: false } });
    const eventosAntes = (await eventos()).length;

    const todos = await requisitar("GET", "/servicos", { cookie });
    expect(todos.body.map((s: any) => s.nome)).toEqual(["beta", "zeta", "Alfa", "Gama"]);

    const ativos = await requisitar("GET", "/servicos?ativo=true", { cookie });
    expect(ativos.body.map((s: any) => s.id)).toEqual([beta.id, zeta.id]);

    const inativos = await requisitar("GET", "/servicos?ativo=false", { cookie });
    expect(inativos.body.map((s: any) => s.id)).toEqual([alfa.id, gama.id]);
    for (const s of inativos.body) {
      expect(s.ativo).toBe(false);
      expect(typeof s.inativadoEm).toBe("string");
      expect(new Date(s.inativadoEm).toISOString()).toBe(s.inativadoEm);
    }

    expect(await eventos()).toHaveLength(eventosAntes);
  });

  it.each(["?ativo=TRUE", "?ativo=1", "?ativo=true&ativo=false", "?pagina=1", "?ativo=true&nome=x"])(
    "filtro inválido %s -> 400",
    async (query) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const res = await requisitar("GET", `/servicos${query}`, { cookie });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    },
  );

  it("CA-SRV-08: GET por id — encontrado, inexistente (404) e malformado (400)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    const ok = await requisitar("GET", `/servicos/${criado.id}`, { cookie });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(criado);

    const ausente = await requisitar("GET", `/servicos/${ID_INEXISTENTE}`, { cookie });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_SERVICO.SERVICO_NAO_ENCONTRADO });

    const malformado = await requisitar("GET", "/servicos/nao-e-uuid", { cookie });
    expect(malformado.status).toBe(400);
    expect(malformado.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });
});

// ---------------------------------------------------------------------------
// Atualização
// ---------------------------------------------------------------------------

describe("CFG-003 — atualização (D-CFG-24, D-CFG-29, D-CFG-31)", () => {
  it("CA-SRV-09: edição efetiva persiste, responde o estado vigente e emite 1 evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);

    const res = await requisitar("PUT", `/servicos/${criado.id}`, {
      cookie: admin.cookie,
      corpo: { nome: "Fisioterapia esportiva", duracaoMin: 60, precoReferencia: "180.50" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: criado.id,
      nome: "Fisioterapia esportiva",
      duracaoMin: 60,
      precoReferencia: "180.50",
      ativo: true,
      inativadoEm: null,
    });

    const lista = await eventos();
    expect(lista).toHaveLength(2);
    const ultimo = lista[1] as LinhaEvento;
    expect(ultimo).toMatchObject({ alvo_tipo: "servico", alvo_id: criado.id, ator_usuario_id: admin.id });
    expect(contextoVazio(ultimo)).toBe(true);
    expect(JSON.stringify(ultimo)).not.toContain("180.50");
  });

  it.each([
    ["só nome", { nome: "Outro nome" }],
    ["só duração", { duracaoMin: 55 }],
    ["só preço", { precoReferencia: "150.01" }],
    ["só a caixa do nome no próprio serviço", { nome: "FISIOTERAPIA ORTOPÉDICA" }],
  ])("alteração de %s é efetiva e auditada", async (_rotulo, mudanca) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const res = await requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: corpo(mudanca) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(mudanca);
    expect(await eventos()).toHaveLength(2);
  });

  it("CA-SRV-09: PUT idêntico (inclusive após trim) -> 200 sem UPDATE (xmin) e sem evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const antes = await xmin(criado.id);

    for (const c of [corpo(), corpo({ nome: "  Fisioterapia ortopédica  " })]) {
      const res = await requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: c });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(criado);
    }
    expect(await xmin(criado.id)).toBe(antes);
    expect(await eventos()).toHaveLength(1);
  });

  it("renomear para nome equivalente a OUTRO serviço -> 409 sem alteração", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, { nome: "Pilates" });
    const outro = await criarViaApi(cookie, { nome: "RPG" });
    const antes = await lerServicos();

    const res = await requisitar("PUT", `/servicos/${outro.id}`, { cookie, corpo: corpo({ nome: "pilates" }) });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_SERVICO.SERVICO_DUPLICADO });
    expect(await lerServicos()).toEqual(antes);
    expect(await eventos()).toHaveLength(2);
  });

  it("PUT em inexistente -> 404; id malformado -> 400; corpo com ativo -> 400", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    const ausente = await requisitar("PUT", `/servicos/${ID_INEXISTENTE}`, { cookie, corpo: corpo() });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_SERVICO.SERVICO_NAO_ENCONTRADO });

    expect((await requisitar("PUT", "/servicos/123", { cookie, corpo: corpo() })).status).toBe(400);

    const comAtivo = await requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: corpo({ ativo: false }) });
    expect(comAtivo.status).toBe(400);
    expect((await lerServicos())[0]?.ativo).toBe(true);
  });

  it("D-CFG-31: edição de serviço inativo é permitida e não altera a situação", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const inativado = await requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: { ativo: false } });

    const res = await requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: corpo({ precoReferencia: "99.90" }) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ativo: false, inativadoEm: inativado.body.inativadoEm, precoReferencia: "99.90" });
  });
});

// ---------------------------------------------------------------------------
// Situação e preservação histórica
// ---------------------------------------------------------------------------

describe("CFG-003 — situação (D-CFG-25) e histórico (D-CFG-33)", () => {
  it("CA-SRV-10/11: inativa e reativa, cada mudança auditada; repetições idempotentes sem evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    const caminho = `/servicos/${criado.id}/situacao`;

    const inativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativo.status).toBe(200);
    expect(inativo.body.ativo).toBe(false);
    expect(inativo.body.inativadoEm).not.toBeNull();
    expect((await lerServicos())[0]?.inativado_em).not.toBeNull();
    expect(await eventos()).toHaveLength(2);

    const antes = await xmin(criado.id);
    const repetido = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(repetido.status).toBe(200);
    expect(repetido.body).toEqual(inativo.body);
    expect(await xmin(criado.id)).toBe(antes);
    expect(await eventos()).toHaveLength(2);

    const ativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativo.status).toBe(200);
    expect(ativo.body).toMatchObject({ ativo: true, inativadoEm: null });
    const lista = await eventos();
    expect(lista).toHaveLength(3);
    expect(lista.every((e) => e.alvo_tipo === "servico" && e.alvo_id === criado.id && contextoVazio(e))).toBe(true);

    expect((await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } })).status).toBe(200);
    expect(await eventos()).toHaveLength(3);
  });

  it.each([[{}], [{ ativo: "false" }], [{ ativo: false, nome: "x" }], [null]])(
    "corpo de situação inválido %p -> 400 sem mutação",
    async (c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criado = await criarViaApi(cookie);
      const res = await requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: c });
      expect(res.status).toBe(400);
      expect((await lerServicos())[0]?.ativo).toBe(true);
    },
  );

  it("PATCH em inexistente -> 404 SERVICO_NAO_ENCONTRADO", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("PATCH", `/servicos/${ID_INEXISTENTE}/situacao`, { cookie, corpo: { ativo: false } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_SERVICO.SERVICO_NAO_ENCONTRADO });
  });

  it("CA-SRV-12: inativar/editar não altera profissional_servico nem pacote que referenciam o serviço", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);

    await database.transacao(async (tx) => {
      const profissional = await tx.profissional.create({ data: { nome: "Profissional Sintético", ativo: true }, select: { id: true } });
      await tx.profissionalServico.create({ data: { profissionalId: profissional.id, servicoId: criado.id } });
      const paciente = await tx.paciente.create({ data: { nome: "Paciente Sintético", ativo: true }, select: { id: true } });
      await tx.pacote.create({
        data: {
          pacienteId: paciente.id,
          servicoId: criado.id,
          quantidadeContratada: 10,
          dataContratacao: new Date("2026-09-01"),
          criadoPorUsuarioId: admin.id,
        },
      });
    });
    const referencias = async () =>
      database.transacao(async (tx) => ({
        associacoes: await tx.profissionalServico.findMany({ where: { servicoId: criado.id } }),
        pacotes: await tx.pacote.findMany({ where: { servicoId: criado.id } }),
      }));
    const antes = await referencias();

    await requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: false } });
    await requisitar("PUT", `/servicos/${criado.id}`, { cookie: admin.cookie, corpo: corpo({ precoReferencia: "1.00" }) });

    expect(await referencias()).toEqual(antes);
    expect(await lerServicos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Atomicidade, concorrência e invariantes físicas
// ---------------------------------------------------------------------------

describe("CFG-003 — atomicidade, concorrência e invariantes físicas (D-CFG-22, D-CFG-23, D-CFG-29)", () => {
  it.each([
    ["POST", () => "/servicos", () => corpo({ nome: "Novo" })],
    ["PUT", (id: string) => `/servicos/${id}`, () => corpo({ nome: "Renomeado" })],
    ["PATCH", (id: string) => `/servicos/${id}/situacao`, () => ({ ativo: false })],
  ] as Array<[Metodo, (id: string) => string, () => unknown]>)(
    "CA-SRV-16: %s com falha na auditoria -> 500 FALHA_INTERNA e rollback conjunto",
    async (metodo, caminho, c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criado = await criarViaApi(cookie);
      const antes = await lerServicos();
      const eventosAntes = (await eventos()).length;

      const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
      try {
        const res = await requisitar(metodo, caminho(criado.id), { cookie, corpo: c() });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      } finally {
        espia.mockRestore();
      }
      expect(await lerServicos()).toEqual(antes);
      expect(await eventos()).toHaveLength(eventosAntes);
    },
  );

  it("CA-SRV-17: criações concorrentes equivalentes -> exatamente um 201 e um 409", async () => {
    await provisionarClinica();
    const a = await administrador();
    const b = await administrador();
    const respostas = await Promise.all([
      requisitar("POST", "/servicos", { cookie: a.cookie, corpo: corpo({ nome: "Drenagem" }) }),
      requisitar("POST", "/servicos", { cookie: b.cookie, corpo: corpo({ nome: "DRENAGEM " }) }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await lerServicos()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-SRV-17: o PUT lê SOB o lock (SELECT ... FOR UPDATE) — enxerga a escrita concorrente", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const alvo = corpo({ nome: "Gravado pelo Concorrente", duracaoMin: 70, precoReferencia: "70.00" });

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM servico WHERE id = ${criado.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`
        UPDATE servico SET nome = 'Gravado pelo Concorrente', duracao_min = 70, preco_referencia = 70.00
         WHERE id = ${criado.id}::uuid`;
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: alvo }).then((r) => {
      concluido = true;
      return r;
    });

    let esperando = 0;
    for (let i = 0; i < 50 && esperando === 0; i++) {
      const r = await database.transacao((tx) =>
        tx.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_stat_activity
           WHERE wait_event_type = 'Lock' AND datname = current_database()`,
      );
      esperando = Number(r[0]?.n ?? 0);
      if (esperando === 0) await new Promise((res) => setTimeout(res, 100));
    }
    expect(esperando).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);

    liberar();
    await bloqueador;
    const res = await put;
    expect(res.status).toBe(200);
    // Leitura sob lock: o estado já é o pedido -> no-op, nenhum evento além da criação.
    expect(await eventos()).toHaveLength(1);
  });

  // Colunas disjuntas: este teste prova que as duas mutações concorrentes são
  // aplicadas e auditadas, NÃO que a leitura do PATCH ocorre sob o lock — essa
  // prova está nos dois testes seguintes (revisão pós-merge, achado B-1).
  it("CA-SRV-17: PUT e PATCH concorrentes — ambos aplicados, 2 eventos", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const [put, patch] = await Promise.all([
      requisitar("PUT", `/servicos/${criado.id}`, { cookie, corpo: corpo({ precoReferencia: "200.00" }) }),
      requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: { ativo: false } }),
    ]);
    expect(put.status).toBe(200);
    expect(patch.status).toBe(200);
    const [linha] = await lerServicos();
    expect(linha).toMatchObject({ preco_referencia: "200.00", ativo: false });
    expect(linha?.inativado_em).not.toBeNull();
    expect(await eventos()).toHaveLength(3);
  });

  it("CA-SRV-17: o PATCH lê SOB o lock (SELECT ... FOR UPDATE) — enxerga a inativação concorrente", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM servico WHERE id = ${criado.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`UPDATE servico SET ativo = false, inativado_em = now() WHERE id = ${criado.id}::uuid`;
    });
    await adquirido;

    let concluido = false;
    const patch = requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: { ativo: false } }).then(
      (r) => {
        concluido = true;
        return r;
      },
    );

    let esperando = 0;
    for (let i = 0; i < 50 && esperando === 0; i++) {
      const r = await database.transacao((tx) =>
        tx.$queryRaw<Array<{ n: bigint }>>`
          SELECT count(*) AS n FROM pg_stat_activity
           WHERE wait_event_type = 'Lock' AND datname = current_database()`,
      );
      esperando = Number(r[0]?.n ?? 0);
      if (esperando === 0) await new Promise((res) => setTimeout(res, 100));
    }
    expect(esperando).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);

    liberar();
    await bloqueador;
    const [gravadaPeloConcorrente] = await lerServicos();
    const res = await patch;
    expect(res.status).toBe(200);
    // Leitura sob lock: o serviço já está inativo -> no-op, `inativado_em` do
    // concorrente preservado e nenhum evento além da criação. Sem o lock, o
    // PATCH leria `ativo = true`, regravaria `inativado_em` e auditaria.
    expect(res.body).toMatchObject({ ativo: false });
    expect(await lerServicos()).toEqual([gravadaPeloConcorrente]);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-SRV-17: PATCHs concorrentes de inativação -> exatamente 1 mutação e 1 evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    const respostas = await Promise.all(
      Array.from({ length: 6 }, () =>
        requisitar("PATCH", `/servicos/${criado.id}/situacao`, { cookie, corpo: { ativo: false } }),
      ),
    );
    expect(respostas.every((r) => r.status === 200)).toBe(true);
    const [linha] = await lerServicos();
    for (const r of respostas) {
      expect(r.body.inativadoEm).toBe(linha?.inativado_em?.toISOString());
    }
    expect(await eventos()).toHaveLength(2);
  });

  it("D-CFG-23: o banco rejeita duração <= 0, preço negativo, situação incoerente e nome equivalente", async () => {
    const clinicaId = await provisionarClinica();
    const inserir = (nome: string, duracao: number, preco: string, ativo: boolean, inativado: boolean) =>
      erroSql((tx) =>
        tx.$executeRaw`
          INSERT INTO servico (id, clinica_id, nome, duracao_min, preco_referencia, ativo, inativado_em)
          VALUES (gen_random_uuid(), ${clinicaId}::uuid, ${nome}, ${duracao}, ${preco}::numeric(12,2), ${ativo},
                  CASE WHEN ${inativado} THEN now() ELSE NULL END)`,
      );

    expect(await inserir("A", 0, "1.00", true, false)).toContain("ck_servico_duracao_positiva");
    expect(await inserir("B", 10, "-0.01", true, false)).toContain("ck_servico_preco_nao_negativo");
    expect(await inserir("C", 10, "1.00", true, true)).toContain("ck_servico_situacao");
    expect(await inserir("D", 10, "1.00", false, false)).toContain("ck_servico_situacao");

    await database.transacao((tx) =>
      tx.$executeRaw`
        INSERT INTO servico (id, clinica_id, nome, duracao_min, preco_referencia, ativo)
        VALUES (gen_random_uuid(), ${clinicaId}::uuid, 'Pilates', 50, 10.00, true)`,
    );
    const duplicado = await inserir("  PILATES ", 10, "1.00", true, false);
    expect(duplicado).toContain("23505");
    expect(duplicado).toContain("ux_servico_clinica_nome");
    expect(await lerServicos()).toHaveLength(1);
  });
});
