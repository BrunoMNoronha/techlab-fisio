// TechLab Fisio — integração contra PostgreSQL REAL do cadastro de
// profissionais (fatia PRO-A; `docs/18` §4, D-PRO1-02..D-PRO1-10; matriz TP-01..TP-13).
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
import { DatabaseService } from "../../src/database/database.service.js";
import { ERRO_PROFISSIONAL } from "../../src/profissional/profissionais.dto.js";

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
const BASE = "/profissionais";

function corpo(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return { nome: "Ana Sintética", registroProfissional: "REG-SINT-001", usuarioId: null, ...sobrescrever };
}

async function criarUsuario(opcoes: { ativo?: boolean } = {}): Promise<string> {
  return database.transacao(async (tx) => {
    const ativo = opcoes.ativo ?? true;
    const u = await tx.usuario.create({
      data: {
        email: `pro-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-pro",
        nome: "Usuário Sintético PRO",
        ativo,
        ...(ativo ? {} : { inativadoEm: new Date() }),
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
  await darPermissao(id, "profissionais.gerenciar");
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
  const res = await requisitar("POST", BASE, { cookie, corpo: corpo(sobrescrever) });
  expect(res.status).toBe(201);
  return res.body;
}

async function lerProfissionais(): Promise<unknown[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<unknown[]>`
      SELECT id, nome, registro_profissional, usuario_id, ativo, inativado_em FROM profissional ORDER BY id`,
  );
}

async function lerAssociacoes(): Promise<Array<{ profissional_id: string; servico_id: string }>> {
  return database.transacao((tx) =>
    tx.$queryRaw<Array<{ profissional_id: string; servico_id: string }>>`
      SELECT profissional_id, servico_id FROM profissional_servico ORDER BY profissional_id, servico_id`,
  );
}

async function eventos(): Promise<Array<{ acao: string; alvo_tipo: string; alvo_id: string | null; ator_usuario_id: string | null; contexto: unknown }>> {
  return database.transacao((tx) =>
    tx.$queryRaw<Array<{ acao: string; alvo_tipo: string; alvo_id: string | null; ator_usuario_id: string | null; contexto: unknown }>>`
      SELECT acao, alvo_tipo, alvo_id, ator_usuario_id, contexto FROM evento_auditoria ORDER BY ocorrido_em`,
  );
}

async function xmin(tabela: "profissional", id: string): Promise<string | undefined> {
  const r = await database.transacao((tx) =>
    tabela === "profissional"
      ? tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM profissional WHERE id = ${id}::uuid`
      : Promise.resolve([]),
  );
  return r[0]?.x;
}

async function criarServico(nome: string, ativo = true): Promise<string> {
  return database.transacao(async (tx) => {
    let clinica = await tx.clinica.findFirst({ select: { id: true } });
    if (clinica === null) {
      clinica = await tx.clinica.create({
        data: { nomeCadastral: "Clínica Sintética Ltda.", fusoHorario: "America/Sao_Paulo" },
        select: { id: true },
      });
    }
    const s = await tx.servico.create({
      data: {
        clinicaId: clinica.id,
        nome,
        duracaoMin: 50,
        precoReferencia: "100.00",
        ativo,
        inativadoEm: ativo ? null : new Date(),
      },
      select: { id: true },
    });
    return s.id;
  });
}

async function criarAgendamento(profissionalId: string, servicoId: string, criadoPor: string): Promise<string> {
  return database.transacao(async (tx) => {
    const paciente = await tx.paciente.create({ data: { nome: "Paciente Sintético PRO", ativo: true }, select: { id: true } });
    const a = await tx.agendamento.create({
      data: {
        pacienteId: paciente.id,
        profissionalId,
        servicoId,
        inicio: new Date("2026-10-01T13:00:00Z"),
        fim: new Date("2026-10-01T13:50:00Z"),
        estado: "AGENDADO",
        modalidade: "AVULSO",
        criadoPorUsuarioId: criadoPor,
      },
      select: { id: true },
    });
    return a.id;
  });
}

async function lerAgendamentos(): Promise<unknown[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<unknown[]>`SELECT id, profissional_id, servico_id, estado::text, inicio, fim, atualizado_em FROM agendamento ORDER BY id`,
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
// TP-10 — segurança
// ---------------------------------------------------------------------------

const ROTAS: Array<[Metodo, string, unknown]> = [
  ["GET", BASE, undefined],
  ["GET", `${BASE}/${ID_INEXISTENTE}`, undefined],
  ["POST", BASE, corpo()],
  ["PUT", `${BASE}/${ID_INEXISTENTE}`, corpo()],
  ["PATCH", `${BASE}/${ID_INEXISTENTE}/situacao`, { ativo: false }],
  ["GET", `${BASE}/${ID_INEXISTENTE}/servicos`, undefined],
  ["PUT", `${BASE}/${ID_INEXISTENTE}/servicos`, { servicoIds: [] }],
];

describe("PRO-A — autenticação, autorização e CSRF (TP-10, D-PRO1-09)", () => {
  it.each(ROTAS)("%s %s sem sessão -> 401 SESSAO_INVALIDA", async (metodo, caminho, c) => {
    const res = await requisitar(metodo, caminho, { corpo: c });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    expect(await lerProfissionais()).toHaveLength(0);
  });

  it.each(ROTAS)("%s %s sem profissionais.gerenciar (ex.: clinica.configurar) -> 403 sem evento", async (metodo, caminho, c) => {
    const operador = await criarUsuario();
    await darPermissao(operador, "clinica.configurar");
    const res = await requisitar(metodo, caminho, { cookie: await cookieDe(operador), corpo: c });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await lerProfissionais()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each(ROTAS.filter(([m]) => m !== "GET"))(
    "%s %s sem x-tlf-requisicao -> 403 REQUISICAO_NAO_AUTORIZADA, mesmo com permissão",
    async (metodo, caminho, c) => {
      const { cookie } = await administrador();
      const res = await requisitar(metodo, caminho, { cookie, corpo: c, csrf: false });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
      expect(await lerProfissionais()).toHaveLength(0);
    },
  );

  it("os GETs não exigem CSRF e respondem Cache-Control: no-store; não existe DELETE", async () => {
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    for (const caminho of [BASE, `${BASE}/${criado.id}`, `${BASE}/${criado.id}/servicos`]) {
      const res = await requisitar("GET", caminho, { cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    const del = await fetch(`${baseUrl}${BASE}/${criado.id}`, {
      method: "DELETE",
      headers: { cookie, [CABECALHO_REQUISICAO_TLF]: "1", "sec-fetch-site": "same-origin" },
    });
    expect(del.status).toBe(404);
    expect(await lerProfissionais()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TP-01..TP-06 — cadastro
// ---------------------------------------------------------------------------

describe("PRO-A — cadastro (TP-01..TP-06, D-PRO1-02..D-PRO1-04, D-PRO1-08)", () => {
  it("TP-01: cria ativo sem vínculo; resposta com exatamente 6 campos; sem evento de auditoria", async () => {
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, {
      cookie,
      corpo: corpo({ nome: "  Beatriz Sintética  ", registroProfissional: "  REG-123  " }),
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["ativo", "id", "inativadoEm", "nome", "registroProfissional", "usuarioId"]);
    expect(res.body).toMatchObject({
      nome: "Beatriz Sintética",
      registroProfissional: "REG-123",
      usuarioId: null,
      ativo: true,
      inativadoEm: null,
    });
    expect(await eventos()).toHaveLength(0);
  });

  it("TP-01: cria sem registro e com usuário ativo vinculado (normalizado em minúsculas)", async () => {
    const { cookie } = await administrador();
    const fisio = await criarUsuario();
    const res = await requisitar("POST", BASE, {
      cookie,
      corpo: corpo({ registroProfissional: null, usuarioId: fisio.toUpperCase() }),
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ registroProfissional: null, usuarioId: fisio });
  });

  it("D-PRO1-03: homônimos e registros repetidos NÃO são bloqueados", async () => {
    const { cookie } = await administrador();
    await criarViaApi(cookie);
    await criarViaApi(cookie);
    expect(await lerProfissionais()).toHaveLength(2);
  });

  const invalidos: Array<[string, unknown]> = [
    ["nome vazio", corpo({ nome: "  " })],
    ["nome acima de 200", corpo({ nome: "a".repeat(201) })],
    ["registro vazio após trim", corpo({ registroProfissional: "   " })],
    ["registro acima de 50", corpo({ registroProfissional: "a".repeat(51) })],
    ["usuarioId malformado", corpo({ usuarioId: "123" })],
    ["chave ativo", corpo({ ativo: false })],
    ["chave ausente", { nome: "Ana", registroProfissional: null }],
    ["array", [corpo()]],
  ];

  it.each(invalidos)("TP-02: %s -> 400 sem escrita", async (_rotulo, c) => {
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: c });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerProfissionais()).toHaveLength(0);
  });

  it("TP-03: usuário inexistente ou inativo -> 422 USUARIO_INELEGIVEL sem escrita", async () => {
    const { cookie } = await administrador();
    const inativo = await criarUsuario({ ativo: false });
    for (const usuarioId of [ID_INEXISTENTE, inativo]) {
      const res = await requisitar("POST", BASE, { cookie, corpo: corpo({ usuarioId }) });
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ erro: ERRO_PROFISSIONAL.USUARIO_INELEGIVEL });
    }
    expect(await lerProfissionais()).toHaveLength(0);
  });

  it("TP-04: usuário já vinculado a outro profissional -> 409 USUARIO_JA_VINCULADO (POST e PUT)", async () => {
    const { cookie } = await administrador();
    const fisio = await criarUsuario();
    const primeiro = await criarViaApi(cookie, { usuarioId: fisio });
    const segundo = await criarViaApi(cookie, { nome: "Outro" });

    const post = await requisitar("POST", BASE, { cookie, corpo: corpo({ usuarioId: fisio }) });
    expect(post.status).toBe(409);
    expect(post.body).toEqual({ erro: ERRO_PROFISSIONAL.USUARIO_JA_VINCULADO });

    const put = await requisitar("PUT", `${BASE}/${segundo.id}`, { cookie, corpo: corpo({ nome: "Outro", usuarioId: fisio }) });
    expect(put.status).toBe(409);
    expect(put.body).toEqual({ erro: ERRO_PROFISSIONAL.USUARIO_JA_VINCULADO });

    expect(await lerProfissionais()).toHaveLength(2);
    const vinculado = (await requisitar("GET", `${BASE}/${primeiro.id}`, { cookie })).body;
    expect(vinculado.usuarioId).toBe(fisio);
  });

  it("TP-04: criações concorrentes com o mesmo usuário -> exatamente um 201 e um 409", async () => {
    const { cookie } = await administrador();
    const fisio = await criarUsuario();
    const respostas = await Promise.all([
      requisitar("POST", BASE, { cookie, corpo: corpo({ usuarioId: fisio }) }),
      requisitar("POST", BASE, { cookie, corpo: corpo({ nome: "Concorrente", usuarioId: fisio }) }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await lerProfissionais()).toHaveLength(1);
  });

  it("TP-05: PUT idêntico (inclusive após trim e caixa do UUID) -> 200 sem UPDATE (xmin)", async () => {
    const { cookie } = await administrador();
    const fisio = await criarUsuario();
    const criado = await criarViaApi(cookie, { usuarioId: fisio });
    const antes = await xmin("profissional", criado.id);
    for (const c of [corpo({ usuarioId: fisio }), corpo({ nome: "  Ana Sintética ", usuarioId: fisio.toUpperCase() })]) {
      const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: c });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(criado);
    }
    expect(await xmin("profissional", criado.id)).toBe(antes);
  });

  it("TP-05: troca e remoção de vínculo; edição de inativo não altera a situação", async () => {
    const { cookie } = await administrador();
    const u1 = await criarUsuario();
    const u2 = await criarUsuario();
    const criado = await criarViaApi(cookie, { usuarioId: u1 });

    const troca = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo({ usuarioId: u2, registroProfissional: null }) });
    expect(troca.status).toBe(200);
    expect(troca.body).toMatchObject({ usuarioId: u2, registroProfissional: null });

    // u1 ficou livre para outro profissional.
    await criarViaApi(cookie, { nome: "Usa u1", usuarioId: u1 });

    const inativo = await requisitar("PATCH", `${BASE}/${criado.id}/situacao`, { cookie, corpo: { ativo: false } });
    const remocao = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo({ nome: "Renomeada", usuarioId: null }) });
    expect(remocao.status).toBe(200);
    expect(remocao.body).toMatchObject({ nome: "Renomeada", usuarioId: null, ativo: false, inativadoEm: inativo.body.inativadoEm });
  });

  it("D-PRO1-04: manter o vínculo com usuário que ficou inativo é permitido; vincular um NOVO inativo não", async () => {
    const { cookie } = await administrador();
    const u1 = await criarUsuario();
    const criado = await criarViaApi(cookie, { usuarioId: u1 });
    await database.transacao((tx) => tx.$executeRaw`UPDATE usuario SET ativo = false, inativado_em = now() WHERE id = ${u1}::uuid`);

    const mantendo = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo({ nome: "Só renomeia", usuarioId: u1 }) });
    expect(mantendo.status).toBe(200);

    const u2 = await criarUsuario({ ativo: false });
    const trocando = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo({ usuarioId: u2 }) });
    expect(trocando.status).toBe(422);
    expect(trocando.body).toEqual({ erro: ERRO_PROFISSIONAL.USUARIO_INELEGIVEL });
  });

  it("TP-06: listagem em ordem ativo DESC, nome sem caixa, id; filtro; GET por id 200/404/400", async () => {
    const { cookie } = await administrador();
    const zeta = await criarViaApi(cookie, { nome: "zeta" });
    const alfa = await criarViaApi(cookie, { nome: "Alfa" });
    const beta = await criarViaApi(cookie, { nome: "beta" });
    await requisitar("PATCH", `${BASE}/${alfa.id}/situacao`, { cookie, corpo: { ativo: false } });

    expect((await requisitar("GET", BASE, { cookie })).body.map((p: any) => p.nome)).toEqual(["beta", "zeta", "Alfa"]);
    expect((await requisitar("GET", `${BASE}?ativo=true`, { cookie })).body.map((p: any) => p.id)).toEqual([beta.id, zeta.id]);
    expect((await requisitar("GET", `${BASE}?ativo=false`, { cookie })).body.map((p: any) => p.id)).toEqual([alfa.id]);
    expect((await requisitar("GET", `${BASE}?ativo=1`, { cookie })).status).toBe(400);

    expect((await requisitar("GET", `${BASE}/${beta.id}`, { cookie })).body).toEqual(beta);
    const ausente = await requisitar("GET", `${BASE}/${ID_INEXISTENTE}`, { cookie });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
    expect((await requisitar("GET", `${BASE}/nao-uuid`, { cookie })).status).toBe(400);
    expect((await requisitar("PUT", `${BASE}/${ID_INEXISTENTE}`, { cookie, corpo: corpo() })).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TP-07 — serviços realizados
// ---------------------------------------------------------------------------

describe("PRO-A — serviços realizados (TP-07, D-PRO1-05)", () => {
  it("substitui o conjunto, lista em ordem de nome e não gera evento", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const pilates = await criarServico("Pilates");
    const rpg = await criarServico("rpg");
    const acup = await criarServico("Acupuntura");

    const r1 = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [rpg, pilates, acup] } });
    expect(r1.status).toBe(200);
    expect(r1.body.map((s: any) => s.nome)).toEqual(["Acupuntura", "Pilates", "rpg"]);
    expect(Object.keys(r1.body[0]).sort()).toEqual(["ativo", "nome", "servicoId"]);

    const r2 = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [pilates] } });
    expect(r2.body.map((s: any) => s.servicoId)).toEqual([pilates]);
    expect(await lerAssociacoes()).toEqual([{ profissional_id: pro.id, servico_id: pilates }]);

    const vazio = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [] } });
    expect(vazio.body).toEqual([]);
    expect((await requisitar("GET", `${BASE}/${pro.id}/servicos`, { cookie })).body).toEqual([]);
    expect(await eventos()).toHaveLength(0);
  });

  it("conjunto idêntico (em outra ordem) -> 200 sem escrita", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const a = await criarServico("A");
    const b = await criarServico("B");
    await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [a, b] } });
    const antes = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM profissional_servico ORDER BY servico_id`,
    );
    const res = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [b.toUpperCase(), a] } });
    expect(res.status).toBe(200);
    const depois = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM profissional_servico ORDER BY servico_id`,
    );
    expect(depois).toEqual(antes);
  });

  it("serviço NOVO inexistente ou inativo -> 422 SERVICO_INELEGIVEL, nada alterado", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const ativo = await criarServico("Ativo");
    const inativo = await criarServico("Inativo", false);
    await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [ativo] } });

    for (const servicoIds of [[ativo, ID_INEXISTENTE], [inativo]]) {
      const res = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds } });
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ erro: ERRO_PROFISSIONAL.SERVICO_INELEGIVEL });
      expect(await lerAssociacoes()).toEqual([{ profissional_id: pro.id, servico_id: ativo }]);
    }
  });

  it("associação MANTIDA com serviço que ficou inativo é preservada e listada", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const s1 = await criarServico("Mantido");
    const s2 = await criarServico("Novo");
    await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [s1] } });
    await database.transacao((tx) => tx.$executeRaw`UPDATE servico SET ativo = false, inativado_em = now() WHERE id = ${s1}::uuid`);

    const res = await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [s1, s2] } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { servicoId: s1, nome: "Mantido", ativo: false },
      { servicoId: s2, nome: "Novo", ativo: true },
    ]);
  });

  it("duplicata -> 400; profissional inexistente -> 404; profissional inativo pode receber serviços", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const s = await criarServico("S");
    expect((await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [s, s] } })).status).toBe(400);

    const ausente = await requisitar("PUT", `${BASE}/${ID_INEXISTENTE}/servicos`, { cookie, corpo: { servicoIds: [s] } });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
    expect((await requisitar("GET", `${BASE}/${ID_INEXISTENTE}/servicos`, { cookie })).status).toBe(404);

    await requisitar("PATCH", `${BASE}/${pro.id}/situacao`, { cookie, corpo: { ativo: false } });
    expect((await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [s] } })).status).toBe(200);
  });

  it("remover serviço não altera agendamento existente", async () => {
    const admin = await administrador();
    const pro = await criarViaApi(admin.cookie);
    const s = await criarServico("Com agenda");
    await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie: admin.cookie, corpo: { servicoIds: [s] } });
    await criarAgendamento(pro.id, s, admin.id);
    const antes = await lerAgendamentos();

    await requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie: admin.cookie, corpo: { servicoIds: [] } });
    expect(await lerAgendamentos()).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------
// TP-08, TP-09 — situação
// ---------------------------------------------------------------------------

describe("PRO-A — situação (TP-08, TP-09, D-PRO1-06)", () => {
  it("inativa e reativa com 1 evento cada; repetição 200 sem evento; agendamentos intactos", async () => {
    const admin = await administrador();
    const pro = await criarViaApi(admin.cookie);
    const s = await criarServico("Serviço");
    await criarAgendamento(pro.id, s, admin.id);
    const agendamentos = await lerAgendamentos();
    const caminho = `${BASE}/${pro.id}/situacao`;

    const inativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativo.status).toBe(200);
    expect(inativo.body).toMatchObject({ id: pro.id, ativo: false });
    expect(new Date(inativo.body.inativadoEm).toISOString()).toBe(inativo.body.inativadoEm);

    const repetido = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(repetido.status).toBe(200);
    expect(repetido.body).toEqual(inativo.body);

    const ativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativo.body).toMatchObject({ ativo: true, inativadoEm: null });

    const lista = await eventos();
    expect(lista).toHaveLength(2);
    for (const e of lista) {
      expect(e).toMatchObject({ acao: "profissional.situacao.alterada", alvo_tipo: "profissional", alvo_id: pro.id, ator_usuario_id: admin.id });
      expect(e.contexto === null || JSON.stringify(e.contexto) === "{}").toBe(true);
    }
    expect(await lerAgendamentos()).toEqual(agendamentos);
  });

  it.each([[{}], [{ ativo: "false" }], [{ ativo: false, nome: "x" }]])("corpo inválido %p -> 400", async (c) => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    expect((await requisitar("PATCH", `${BASE}/${pro.id}/situacao`, { cookie, corpo: c })).status).toBe(400);
  });

  it("PATCH em inexistente -> 404 PROFISSIONAL_NAO_ENCONTRADO", async () => {
    const { cookie } = await administrador();
    const res = await requisitar("PATCH", `${BASE}/${ID_INEXISTENTE}/situacao`, { cookie, corpo: { ativo: false } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
  });

  it("TP-09: falha da auditoria -> 500 FALHA_INTERNA e rollback", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const antes = await lerProfissionais();
    const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      const res = await requisitar("PATCH", `${BASE}/${pro.id}/situacao`, { cookie, corpo: { ativo: false } });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
    } finally {
      espia.mockRestore();
    }
    expect(await lerProfissionais()).toEqual(antes);
    expect(await eventos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TP-11, TP-12 — concorrência e invariante física
// ---------------------------------------------------------------------------

describe("PRO-A — concorrência e invariante física (TP-11, TP-12, D-PRO1-07, D-PRO1-10)", () => {
  async function comLockNoProfissional(profissionalId: string, escrita: (tx: any) => Promise<unknown>) {
    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let adquirido!: () => void;
    const lock = new Promise<void>((r) => (adquirido = r));
    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profissional WHERE id = ${profissionalId}::uuid FOR UPDATE`;
      adquirido();
      await barreira;
      await escrita(tx);
    });
    await lock;
    return { liberar, bloqueador };
  }

  it("o PUT lê SOB o lock — enxerga a escrita concorrente e vira no-op", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const { liberar, bloqueador } = await comLockNoProfissional(pro.id, (tx) =>
      tx.$executeRaw`UPDATE profissional SET nome = 'Gravado pelo Concorrente' WHERE id = ${pro.id}::uuid`,
    );
    let concluido = false;
    const put = requisitar("PUT", `${BASE}/${pro.id}`, { cookie, corpo: corpo({ nome: "Gravado pelo Concorrente" }) }).then((r) => {
      concluido = true;
      return r;
    });
    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);
    liberar();
    await bloqueador;
    const antes = await xmin("profissional", pro.id);
    const res = await put;
    expect(res.status).toBe(200);
    expect(await xmin("profissional", pro.id)).toBe(antes);
  });

  it("o PUT de serviços lê SOB o lock — enxerga a associação concorrente e vira no-op", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const s = await criarServico("Concorrente");
    const { liberar, bloqueador } = await comLockNoProfissional(pro.id, (tx) =>
      tx.$executeRaw`INSERT INTO profissional_servico (profissional_id, servico_id) VALUES (${pro.id}::uuid, ${s}::uuid)`,
    );
    let concluido = false;
    const put = requisitar("PUT", `${BASE}/${pro.id}/servicos`, { cookie, corpo: { servicoIds: [s] } }).then((r) => {
      concluido = true;
      return r;
    });
    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);
    liberar();
    await bloqueador;
    const res = await put;
    // Sem o lock, o PUT leria "sem associação" e tentaria inserir -> 23505 na PK -> 500.
    expect(res.status).toBe(200);
    expect(await lerAssociacoes()).toEqual([{ profissional_id: pro.id, servico_id: s }]);
  });

  it("o PATCH de situação serializa com o cadastro — enxerga a inativação concorrente como no-op", async () => {
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const { liberar, bloqueador } = await comLockNoProfissional(pro.id, (tx) =>
      tx.$executeRaw`UPDATE profissional SET ativo = false, inativado_em = now() WHERE id = ${pro.id}::uuid`,
    );
    let concluido = false;
    const patch = requisitar("PATCH", `${BASE}/${pro.id}/situacao`, { cookie, corpo: { ativo: false } }).then((r) => {
      concluido = true;
      return r;
    });
    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);
    liberar();
    await bloqueador;
    const res = await patch;
    expect(res.status).toBe(200);
    expect(await eventos()).toHaveLength(0);
  });

  it("o PATCH de situação serializa com a transição OPOSTA — espera o lock e reativa sobre o estado commitado", async () => {
    // D-PRO1-10: no-op decidido SOB o lock. Sem `FOR UPDATE`, o `UPDATE ... WHERE ativo = false`
    // não casa com o snapshot (ainda ativo), não espera o lock e a releitura sem lock devolve o
    // estado antigo como no-op — a inativação concorrente commita depois e a reativação se perde.
    const { cookie } = await administrador();
    const pro = await criarViaApi(cookie);
    const { liberar, bloqueador } = await comLockNoProfissional(pro.id, (tx) =>
      tx.$executeRaw`UPDATE profissional SET ativo = false, inativado_em = now() WHERE id = ${pro.id}::uuid`,
    );
    let concluido = false;
    const patch = requisitar("PATCH", `${BASE}/${pro.id}/situacao`, { cookie, corpo: { ativo: true } }).then((r) => {
      concluido = true;
      return r;
    });
    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);
    liberar();
    await bloqueador;
    const res = await patch;
    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(true);
    expect(await lerProfissionais()).toEqual([expect.objectContaining({ id: pro.id, ativo: true, inativado_em: null })]);
    expect((await eventos()).map((e) => e.acao)).toEqual(["profissional.situacao.alterada"]);
  });

  it("TP-12: o banco rejeita situação incoerente (ck_profissional_situacao)", async () => {
    const inserir = (ativo: boolean, inativado: boolean) =>
      erroSql((tx) =>
        tx.$executeRaw`
          INSERT INTO profissional (id, nome, ativo, inativado_em)
          VALUES (gen_random_uuid(), 'X', ${ativo}, CASE WHEN ${inativado} THEN now() ELSE NULL END)`,
      );
    expect(await inserir(true, true)).toContain("ck_profissional_situacao");
    expect(await inserir(false, false)).toContain("ck_profissional_situacao");
    expect(await lerProfissionais()).toHaveLength(0);
  });
});
