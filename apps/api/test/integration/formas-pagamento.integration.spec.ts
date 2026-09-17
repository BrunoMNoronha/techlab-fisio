// TechLab Fisio — integração contra PostgreSQL REAL das formas de pagamento
// (CFG-004; `docs/14` §3.12, D-CFG-34..D-CFG-45).
//
// Runtime exclusivamente `tlf_app`; HTTP real via `app.listen(0)`; limpeza por
// TRUNCATE entre testes (setup-db.ts). Dados 100% sintéticos. Mesmo desenho de
// `servicos-catalogo.integration.spec.ts`, acrescido das provas de D-CFG-40
// (forma referenciada por `pagamento`).

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
import { ERRO_FORMA_PAGAMENTO } from "../../src/formas-pagamento/formas-pagamento.dto.js";

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
const BASE = "/formas-pagamento";

function corpo(descricao = "Cartão de crédito"): Record<string, unknown> {
  return { descricao };
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
        email: `fp-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-fp",
        nome: "Usuário Sintético FP",
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

async function criarViaApi(cookie: string, descricao = "Cartão de crédito"): Promise<any> {
  const res = await requisitar("POST", BASE, { cookie, corpo: corpo(descricao) });
  expect(res.status).toBe(201);
  return res.body;
}

interface LinhaForma {
  id: string;
  clinica_id: string;
  descricao: string;
  ativo: boolean;
  inativado_em: Date | null;
}

async function lerFormas(): Promise<LinhaForma[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaForma[]>`
      SELECT id, clinica_id, descricao, ativo, inativado_em FROM forma_pagamento ORDER BY id`,
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

async function xmin(formaPagamentoId: string): Promise<string | undefined> {
  const r = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM forma_pagamento WHERE id = ${formaPagamentoId}::uuid`,
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

/**
 * Registra um pagamento sintético referenciando a forma, pela cadeia mínima
 * de FKs (paciente → cobrança → pagamento). Não existe runtime de pagamentos:
 * a escrita é direta, como `tlf_app`, e respeita as restrições do banco.
 */
async function registrarPagamento(formaPagamentoId: string, registradoPorUsuarioId: string, tx?: any): Promise<string> {
  const corpoTx = async (t: any) => {
    const paciente = await t.paciente.create({ data: { nome: "Paciente Sintético FP", ativo: true }, select: { id: true } });
    const cobranca = await t.cobranca.create({
      data: {
        pacienteId: paciente.id,
        origemTipo: "ADMINISTRATIVA",
        valorBruto: "100.00",
        dataReferencia: new Date("2026-09-17"),
        criadoPorUsuarioId: registradoPorUsuarioId,
      },
      select: { id: true },
    });
    const pagamento = await t.pagamento.create({
      data: {
        cobrancaId: cobranca.id,
        valor: "40.00",
        formaPagamentoId,
        recebidoEm: new Date(),
        registradoPorUsuarioId,
      },
      select: { id: true },
    });
    return pagamento.id as string;
  };
  return tx ? corpoTx(tx) : database.transacao(corpoTx);
}

async function lerPagamentos(): Promise<unknown[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<unknown[]>`
      SELECT id, cobranca_id, valor::text AS valor, forma_pagamento_id, recebido_em, registrado_por_usuario_id
        FROM pagamento ORDER BY id`,
  );
}

async function esperarAlguemBloqueado(): Promise<number> {
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
  return esperando;
}

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

const ROTAS: Array<[Metodo, string, unknown]> = [
  ["GET", BASE, undefined],
  ["GET", `${BASE}/${ID_INEXISTENTE}`, undefined],
  ["POST", BASE, corpo()],
  ["PUT", `${BASE}/${ID_INEXISTENTE}`, corpo()],
  ["PATCH", `${BASE}/${ID_INEXISTENTE}/situacao`, { ativo: false }],
];

describe("CFG-004 — autenticação, autorização e CSRF (D-CFG-43)", () => {
  it.each(ROTAS)("%s %s sem sessão -> 401 SESSAO_INVALIDA", async (metodo, caminho, c) => {
    await provisionarClinica();
    const res = await requisitar(metodo, caminho, { corpo: c });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    expect(await lerFormas()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each(ROTAS)("%s %s sem clinica.configurar -> 403 ACESSO_NEGADO sem evento", async (metodo, caminho, c) => {
    await provisionarClinica();
    const operador = await criarUsuario();
    await darPermissao(operador, "pacientes.localizar");
    const res = await requisitar(metodo, caminho, { cookie: await cookieDe(operador), corpo: c });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await lerFormas()).toHaveLength(0);
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
      expect(await lerFormas()).toHaveLength(0);
      expect(await eventos()).toHaveLength(0);
    },
  );

  it("CSRF é avaliada antes da sessão: mutação sem sessão e sem header -> 403", async () => {
    await provisionarClinica();
    const res = await requisitar("POST", BASE, { corpo: corpo(), csrf: false });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
  });

  it("os GETs não exigem CSRF e respondem Cache-Control: no-store", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    for (const caminho of [BASE, `${BASE}/${criada.id}`]) {
      const res = await requisitar("GET", caminho, { cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("não existe DELETE (D-CFG-36)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    const res = await fetch(`${baseUrl}${BASE}/${criada.id}`, {
      method: "DELETE",
      headers: { cookie, [CABECALHO_REQUISICAO_TLF]: "1", "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(404);
    expect(await lerFormas()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

describe("CFG-004 — criação (D-CFG-36, D-CFG-37, D-CFG-38, D-CFG-39, D-CFG-44)", () => {
  it("cria ativa, responde exatamente os 4 campos e emite 1 evento sem valores", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();

    const res = await requisitar("POST", BASE, { cookie: admin.cookie, corpo: corpo("  Transferência Zeta  ") });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["ativo", "descricao", "id", "inativadoEm"]);
    expect(res.body).toMatchObject({ descricao: "Transferência Zeta", ativo: true, inativadoEm: null });

    const [linha] = await lerFormas();
    expect(linha).toEqual({
      id: res.body.id,
      clinica_id: clinicaId,
      descricao: "Transferência Zeta",
      ativo: true,
      inativado_em: null,
    });

    const lista = await eventos();
    expect(lista).toHaveLength(1);
    const evento = lista[0] as LinhaEvento;
    expect(evento).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: admin.id,
      alvo_tipo: "forma_pagamento",
      alvo_id: res.body.id,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(contextoVazio(evento)).toBe(true);
    expect(JSON.stringify(evento)).not.toContain("Zeta");
  });

  it("D-CFG-39: nenhuma forma pré-cadastrada — listagem inicial vazia", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("GET", BASE, { cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("sem clínica provisionada -> 404 CLINICA_NAO_CONFIGURADA, nada criado", async () => {
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: corpo() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
    expect(await lerFormas()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each([
    ["mesma descrição", "Cartão de crédito"],
    ["caixa diferente", "CARTÃO DE CRÉDITO"],
    ["espaços de borda", "  cartão de crédito "],
  ])("D-CFG-34: %s -> 409 FORMA_PAGAMENTO_DUPLICADA sem segundo registro nem evento", async (_rotulo, descricao) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie);
    const antesEventos = (await eventos()).length;

    const res = await requisitar("POST", BASE, { cookie, corpo: corpo(descricao) });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_DUPLICADA });
    expect(await lerFormas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(antesEventos);
  });

  it("D-CFG-34: a descrição de forma INATIVA não é liberada para reuso", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    expect((await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie, corpo: { ativo: false } })).status).toBe(200);

    const res = await requisitar("POST", BASE, { cookie, corpo: corpo() });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_DUPLICADA });
  });

  it("descrição apenas semelhante (não equivalente) é permitida", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, "Cartão");
    await criarViaApi(cookie, "Cartão de débito");
    expect(await lerFormas()).toHaveLength(2);
  });

  it("aceita 100 caracteres", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    expect((await criarViaApi(cookie, "a".repeat(100))).descricao).toHaveLength(100);
  });

  const invalidos: Array<[string, unknown]> = [
    ["descrição vazia", corpo("   ")],
    ["descrição acima de 100", corpo("a".repeat(101))],
    ["descrição com caractere de controle", corpo(`Car${String.fromCharCode(10)}tão`)],
    ["descrição number", { descricao: 10 }],
    ["descrição null", { descricao: null }],
    ["chave extra ativo", { descricao: "PIX", ativo: false }],
    ["chave extra tipo", { descricao: "PIX", tipo: "PIX" }],
    ["chave ausente", {}],
    ["array", [corpo()]],
  ];

  it.each(invalidos)("%s -> 400 REQUISICAO_INVALIDA sem escrita", async (_rotulo, c) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: c });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerFormas()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

describe("CFG-004 — consulta (D-CFG-42)", () => {
  it("ordem ativo DESC, descrição sem caixa, id; filtro ativo; consulta não audita", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const zeta = await criarViaApi(cookie, "zeta");
    const alfa = await criarViaApi(cookie, "Alfa");
    const beta = await criarViaApi(cookie, "beta");
    const gama = await criarViaApi(cookie, "Gama");
    await requisitar("PATCH", `${BASE}/${alfa.id}/situacao`, { cookie, corpo: { ativo: false } });
    await requisitar("PATCH", `${BASE}/${gama.id}/situacao`, { cookie, corpo: { ativo: false } });
    const eventosAntes = (await eventos()).length;

    const todas = await requisitar("GET", BASE, { cookie });
    expect(todas.body.map((f: any) => f.descricao)).toEqual(["beta", "zeta", "Alfa", "Gama"]);

    const ativas = await requisitar("GET", `${BASE}?ativo=true`, { cookie });
    expect(ativas.body.map((f: any) => f.id)).toEqual([beta.id, zeta.id]);

    const inativas = await requisitar("GET", `${BASE}?ativo=false`, { cookie });
    expect(inativas.body.map((f: any) => f.id)).toEqual([alfa.id, gama.id]);
    for (const f of inativas.body) {
      expect(f.ativo).toBe(false);
      expect(new Date(f.inativadoEm).toISOString()).toBe(f.inativadoEm);
    }

    expect(await eventos()).toHaveLength(eventosAntes);
  });

  it.each(["?ativo=TRUE", "?ativo=1", "?ativo=true&ativo=false", "?pagina=1", "?ativo=true&descricao=x"])(
    "filtro inválido %s -> 400",
    async (query) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const res = await requisitar("GET", `${BASE}${query}`, { cookie });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    },
  );

  it("GET por id — encontrada, inexistente (404) e malformado (400)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);

    const ok = await requisitar("GET", `${BASE}/${criada.id}`, { cookie });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(criada);

    const ausente = await requisitar("GET", `${BASE}/${ID_INEXISTENTE}`, { cookie });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_NAO_ENCONTRADA });

    const malformado = await requisitar("GET", `${BASE}/nao-e-uuid`, { cookie });
    expect(malformado.status).toBe(400);
    expect(malformado.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });
});

// ---------------------------------------------------------------------------
// Atualização e uso por pagamento
// ---------------------------------------------------------------------------

describe("CFG-004 — atualização (D-CFG-36, D-CFG-40, D-CFG-41)", () => {
  it("edição efetiva persiste, responde o estado vigente e emite 1 evento sem valores", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);

    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie: admin.cookie, corpo: corpo("Boleto Ômega") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: criada.id, descricao: "Boleto Ômega", ativo: true, inativadoEm: null });

    const lista = await eventos();
    expect(lista).toHaveLength(2);
    const ultimo = lista[1] as LinhaEvento;
    expect(ultimo).toMatchObject({ alvo_tipo: "forma_pagamento", alvo_id: criada.id, ator_usuario_id: admin.id });
    expect(contextoVazio(ultimo)).toBe(true);
    expect(JSON.stringify(ultimo)).not.toContain("Ômega");
  });

  it("mudar só a caixa da própria descrição é efetivo e auditado", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie, corpo: corpo("CARTÃO DE CRÉDITO") });
    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe("CARTÃO DE CRÉDITO");
    expect(await eventos()).toHaveLength(2);
  });

  it("PUT idêntico (inclusive após trim) -> 200 sem UPDATE (xmin) e sem evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    const antes = await xmin(criada.id);

    for (const c of [corpo(), corpo("  Cartão de crédito  ")]) {
      const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie, corpo: c });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(criada);
    }
    expect(await xmin(criada.id)).toBe(antes);
    expect(await eventos()).toHaveLength(1);
  });

  it("renomear para descrição equivalente a OUTRA forma -> 409 sem alteração", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, "PIX");
    const outra = await criarViaApi(cookie, "Dinheiro");
    const antes = await lerFormas();

    const res = await requisitar("PUT", `${BASE}/${outra.id}`, { cookie, corpo: corpo("pix") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_DUPLICADA });
    expect(await lerFormas()).toEqual(antes);
    expect(await eventos()).toHaveLength(2);
  });

  it("PUT em inexistente -> 404; id malformado -> 400; corpo com ativo -> 400", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);

    const ausente = await requisitar("PUT", `${BASE}/${ID_INEXISTENTE}`, { cookie, corpo: corpo() });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_NAO_ENCONTRADA });

    expect((await requisitar("PUT", `${BASE}/123`, { cookie, corpo: corpo() })).status).toBe(400);

    const comAtivo = await requisitar("PUT", `${BASE}/${criada.id}`, {
      cookie,
      corpo: { descricao: "Outra", ativo: false },
    });
    expect(comAtivo.status).toBe(400);
    expect((await lerFormas())[0]).toMatchObject({ ativo: true, descricao: "Cartão de crédito" });
  });

  it("D-CFG-40: edição de forma inativa SEM pagamento é permitida e não altera a situação", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);
    const inativada = await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie, corpo: { ativo: false } });

    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie, corpo: corpo("Cartão antigo") });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ativo: false, inativadoEm: inativada.body.inativadoEm, descricao: "Cartão antigo" });
  });

  it("D-CFG-40: PUT sobre forma referenciada por pagamento -> 409 FORMA_PAGAMENTO_EM_USO, sem mutação nem evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);
    await registrarPagamento(criada.id, admin.id);
    const antes = await xmin(criada.id);
    const pagamentosAntes = await lerPagamentos();

    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie: admin.cookie, corpo: corpo("Renomeada") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_EM_USO });
    expect(await xmin(criada.id)).toBe(antes);
    expect((await lerFormas())[0]?.descricao).toBe("Cartão de crédito");
    expect(await lerPagamentos()).toEqual(pagamentosAntes);
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-40: o no-op PRECEDE a verificação de uso — PUT idêntico sobre forma em uso -> 200 sem evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);
    await registrarPagamento(criada.id, admin.id);

    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie: admin.cookie, corpo: corpo("  Cartão de crédito ") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(criada);
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-40: PUT sobre forma INATIVA em uso também -> 409 FORMA_PAGAMENTO_EM_USO", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);
    await registrarPagamento(criada.id, admin.id);
    await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: false } });

    const res = await requisitar("PUT", `${BASE}/${criada.id}`, { cookie: admin.cookie, corpo: corpo("Outra") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_EM_USO });
  });

  it("D-CFG-40: o uso de OUTRA forma não bloqueia a edição desta", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const usada = await criarViaApi(admin.cookie, "PIX");
    const livre = await criarViaApi(admin.cookie, "Dinheiro");
    await registrarPagamento(usada.id, admin.id);

    const res = await requisitar("PUT", `${BASE}/${livre.id}`, { cookie: admin.cookie, corpo: corpo("Dinheiro em espécie") });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Situação e preservação histórica
// ---------------------------------------------------------------------------

describe("CFG-004 — situação (D-CFG-37) e preservação de pagamentos (D-CFG-45)", () => {
  it("inativa e reativa, cada mudança auditada; repetições idempotentes sem evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);
    const caminho = `${BASE}/${criada.id}/situacao`;

    const inativa = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativa.status).toBe(200);
    expect(inativa.body.ativo).toBe(false);
    expect(inativa.body.inativadoEm).not.toBeNull();
    expect(await eventos()).toHaveLength(2);

    const antes = await xmin(criada.id);
    const repetida = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(repetida.status).toBe(200);
    expect(repetida.body).toEqual(inativa.body);
    expect(await xmin(criada.id)).toBe(antes);
    expect(await eventos()).toHaveLength(2);

    const ativa = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativa.status).toBe(200);
    expect(ativa.body).toMatchObject({ ativo: true, inativadoEm: null });
    const lista = await eventos();
    expect(lista).toHaveLength(3);
    expect(lista.every((e) => e.alvo_tipo === "forma_pagamento" && e.alvo_id === criada.id && contextoVazio(e))).toBe(true);

    expect((await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } })).status).toBe(200);
    expect(await eventos()).toHaveLength(3);
  });

  it.each([[{}], [{ ativo: "false" }], [{ ativo: false, descricao: "x" }], [null]])(
    "corpo de situação inválido %p -> 400 sem mutação",
    async (c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criada = await criarViaApi(cookie);
      const res = await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie, corpo: c });
      expect(res.status).toBe(400);
      expect((await lerFormas())[0]?.ativo).toBe(true);
    },
  );

  it("PATCH em inexistente -> 404 FORMA_PAGAMENTO_NAO_ENCONTRADA", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("PATCH", `${BASE}/${ID_INEXISTENTE}/situacao`, { cookie, corpo: { ativo: false } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_NAO_ENCONTRADA });
  });

  it("D-CFG-37: inativar e reativar forma EM USO é permitido e nunca altera pagamento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);
    await registrarPagamento(criada.id, admin.id);
    const pagamentosAntes = await lerPagamentos();

    const inativa = await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativa.status).toBe(200);
    expect(await lerPagamentos()).toEqual(pagamentosAntes);

    const ativa = await requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativa.status).toBe(200);
    expect(await lerPagamentos()).toEqual(pagamentosAntes);
    expect(await eventos()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Atomicidade, concorrência e invariantes físicas
// ---------------------------------------------------------------------------

describe("CFG-004 — atomicidade, concorrência e invariantes físicas (D-CFG-34, D-CFG-35, D-CFG-41, D-CFG-44)", () => {
  it.each([
    ["POST", () => BASE, () => corpo("Nova")],
    ["PUT", (id: string) => `${BASE}/${id}`, () => corpo("Renomeada")],
    ["PATCH", (id: string) => `${BASE}/${id}/situacao`, () => ({ ativo: false })],
  ] as Array<[Metodo, (id: string) => string, () => unknown]>)(
    "%s com falha na auditoria -> 500 FALHA_INTERNA e rollback conjunto",
    async (metodo, caminho, c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criada = await criarViaApi(cookie);
      const antes = await lerFormas();
      const eventosAntes = (await eventos()).length;

      const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
      try {
        const res = await requisitar(metodo, caminho(criada.id), { cookie, corpo: c() });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      } finally {
        espia.mockRestore();
      }
      expect(await lerFormas()).toEqual(antes);
      expect(await eventos()).toHaveLength(eventosAntes);
    },
  );

  it("criações concorrentes equivalentes -> exatamente um 201 e um 409", async () => {
    await provisionarClinica();
    const a = await administrador();
    const b = await administrador();
    const respostas = await Promise.all([
      requisitar("POST", BASE, { cookie: a.cookie, corpo: corpo("Débito") }),
      requisitar("POST", BASE, { cookie: b.cookie, corpo: corpo("DÉBITO ") }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await lerFormas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-41: o PUT lê SOB o lock — enxerga a escrita concorrente e vira no-op", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM forma_pagamento WHERE id = ${criada.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`UPDATE forma_pagamento SET descricao = 'Gravada pelo Concorrente' WHERE id = ${criada.id}::uuid`;
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", `${BASE}/${criada.id}`, { cookie, corpo: corpo("Gravada pelo Concorrente") }).then((r) => {
      concluido = true;
      return r;
    });

    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);

    liberar();
    await bloqueador;
    const res = await put;
    expect(res.status).toBe(200);
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-40/41: a verificação de uso ocorre SOB o lock — pagamento registrado pelo concorrente bloqueia a edição", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criada = await criarViaApi(admin.cookie);

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    // Contrato de D-CFG-45: o registro de pagamento (T-03, futuro) bloqueia a
    // linha da forma com FOR SHARE antes de referenciá-la.
    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM forma_pagamento WHERE id = ${criada.id}::uuid FOR SHARE`;
      lockAdquirido();
      await barreira;
      await registrarPagamento(criada.id, admin.id, tx);
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", `${BASE}/${criada.id}`, { cookie: admin.cookie, corpo: corpo("Renomeada") }).then((r) => {
      concluido = true;
      return r;
    });

    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);

    liberar();
    await bloqueador;
    const res = await put;
    // Sem a verificação sob o lock, o PUT teria lido "sem uso" antes do
    // pagamento concorrente e renomeado a forma já referenciada.
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_EM_USO });
    expect((await lerFormas())[0]?.descricao).toBe("Cartão de crédito");
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-41: o PATCH lê SOB o lock — enxerga a inativação concorrente", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM forma_pagamento WHERE id = ${criada.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`UPDATE forma_pagamento SET ativo = false, inativado_em = now() WHERE id = ${criada.id}::uuid`;
    });
    await adquirido;

    let concluido = false;
    const patch = requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie, corpo: { ativo: false } }).then((r) => {
      concluido = true;
      return r;
    });

    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);

    liberar();
    await bloqueador;
    const [gravadaPeloConcorrente] = await lerFormas();
    const res = await patch;
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ativo: false });
    expect(await lerFormas()).toEqual([gravadaPeloConcorrente]);
    expect(await eventos()).toHaveLength(1);
  });

  it("PATCHs concorrentes de inativação -> exatamente 1 mutação e 1 evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criada = await criarViaApi(cookie);

    const respostas = await Promise.all(
      Array.from({ length: 6 }, () => requisitar("PATCH", `${BASE}/${criada.id}/situacao`, { cookie, corpo: { ativo: false } })),
    );
    expect(respostas.every((r) => r.status === 200)).toBe(true);
    const [linha] = await lerFormas();
    for (const r of respostas) {
      expect(r.body.inativadoEm).toBe(linha?.inativado_em?.toISOString());
    }
    expect(await eventos()).toHaveLength(2);
  });

  it("D-CFG-35: o banco rejeita situação incoerente e descrição equivalente", async () => {
    const clinicaId = await provisionarClinica();
    const inserir = (descricao: string, ativo: boolean, inativado: boolean) =>
      erroSql((tx) =>
        tx.$executeRaw`
          INSERT INTO forma_pagamento (id, clinica_id, descricao, ativo, inativado_em)
          VALUES (gen_random_uuid(), ${clinicaId}::uuid, ${descricao}, ${ativo},
                  CASE WHEN ${inativado} THEN now() ELSE NULL END)`,
      );

    expect(await inserir("A", true, true)).toContain("ck_forma_pagamento_situacao");
    expect(await inserir("B", false, false)).toContain("ck_forma_pagamento_situacao");

    await database.transacao((tx) =>
      tx.$executeRaw`
        INSERT INTO forma_pagamento (id, clinica_id, descricao, ativo)
        VALUES (gen_random_uuid(), ${clinicaId}::uuid, 'PIX', true)`,
    );
    const duplicado = await inserir("  pix ", true, false);
    expect(duplicado).toContain("23505");
    expect(duplicado).toContain("ux_forma_pagamento_clinica_descricao");
    expect(await lerFormas()).toHaveLength(1);
  });
});
