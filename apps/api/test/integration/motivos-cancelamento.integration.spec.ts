// TechLab Fisio — integração contra PostgreSQL REAL dos motivos de cancelamento
// (CFG-005; `docs/14` §3.13, D-CFG-46..D-CFG-57).
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
import { ERRO_MOTIVO_CANCELAMENTO } from "../../src/motivos-cancelamento/motivos-cancelamento.dto.js";

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
const BASE = "/motivos-cancelamento";

function corpo(descricao = "Paciente desistiu"): Record<string, unknown> {
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
        email: `mot-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-mot",
        nome: "Usuário Sintético MOT",
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

async function criarViaApi(cookie: string, descricao = "Paciente desistiu"): Promise<any> {
  const res = await requisitar("POST", BASE, { cookie, corpo: corpo(descricao) });
  expect(res.status).toBe(201);
  return res.body;
}

async function inativarViaApi(cookie: string, id: string): Promise<any> {
  const res = await requisitar("PATCH", `${BASE}/${id}/situacao`, { cookie, corpo: { ativo: false } });
  expect(res.status).toBe(200);
  return res.body;
}

interface LinhaMotivo {
  id: string;
  clinica_id: string;
  descricao: string;
  ativo: boolean;
  inativado_em: Date | null;
}

async function lerMotivos(): Promise<LinhaMotivo[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaMotivo[]>`
      SELECT id, clinica_id, descricao, ativo, inativado_em
        FROM motivo_cancelamento ORDER BY id`,
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

async function xmin(motivoId: string): Promise<string | undefined> {
  const r = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM motivo_cancelamento WHERE id = ${motivoId}::uuid`,
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
 * Agendamento sintético (AVULSO) — base mínima para referenciar um motivo.
 * `motivoNoAgendamento = null` cria o agendamento SEM motivo; o chamador pode
 * então referenciar o motivo só no histórico (D-CFG-50).
 *
 * ATUALIZADO POR AGD-A (`docs/15` D-AGD-07, migration
 * `20260917230000_agendamento_cancelamento_coerente`): o estado `CANCELADO`
 * passou a exigir FISICAMENTE `motivo_cancelamento_id`, `cancelado_em` e
 * `cancelado_por_usuario_id` juntos. A fixture preenche os três quando o estado
 * pedido é `CANCELADO`; nenhum cenário de CFG-005 muda de sentido com isso —
 * todos continuam medindo o que mediam.
 */
async function criarAgendamento(opcoes: {
  atorId: string;
  clinicaId: string;
  motivoNoAgendamento: string | null;
  estado?: "AGENDADO" | "CANCELADO";
}): Promise<string> {
  return database.transacao(async (tx) => {
    const servico = await tx.servico.create({
      data: {
        clinicaId: opcoes.clinicaId,
        nome: `Serviço ${randomUUID().slice(0, 8)}`,
        duracaoMin: 50,
        precoReferencia: "100.00",
        ativo: true,
      },
      select: { id: true },
    });
    const profissional = await tx.profissional.create({ data: { nome: "Profissional Sintético", ativo: true }, select: { id: true } });
    const paciente = await tx.paciente.create({ data: { nome: "Paciente Sintético", ativo: true }, select: { id: true } });
    const agendamento = await tx.agendamento.create({
      data: {
        pacienteId: paciente.id,
        profissionalId: profissional.id,
        servicoId: servico.id,
        inicio: new Date("2026-10-01T12:00:00Z"),
        fim: new Date("2026-10-01T12:50:00Z"),
        estado: opcoes.estado ?? "CANCELADO",
        modalidade: "AVULSO",
        motivoCancelamentoId: opcoes.motivoNoAgendamento,
        ...((opcoes.estado ?? "CANCELADO") === "CANCELADO"
          ? { canceladoEm: new Date("2026-09-30T12:00:00Z"), canceladoPorUsuarioId: opcoes.atorId }
          : {}),
        criadoPorUsuarioId: opcoes.atorId,
      },
      select: { id: true },
    });
    return agendamento.id;
  });
}

async function registrarHistorico(agendamentoId: string, atorId: string, motivoId: string): Promise<void> {
  await database.transacao((tx) =>
    tx.historicoAgendamento.create({
      data: {
        agendamentoId,
        operacao: "CANCELAMENTO",
        estadoAnterior: "AGENDADO",
        estadoNovo: "CANCELADO",
        atorUsuarioId: atorId,
        ocorridoEm: new Date(),
        motivoCancelamentoId: motivoId,
      },
    }),
  );
}

async function referenciasDaAgenda(): Promise<unknown> {
  return database.transacao(async (tx) => ({
    agendamentos: await tx.agendamento.findMany({ orderBy: { id: "asc" } }),
    historicos: await tx.historicoAgendamento.findMany({ orderBy: { id: "asc" } }),
  }));
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

describe("CFG-005 — autenticação, autorização e CSRF (D-CFG-55)", () => {
  it.each(ROTAS)("%s %s sem sessão -> 401 SESSAO_INVALIDA", async (metodo, caminho, c) => {
    await provisionarClinica();
    const res = await requisitar(metodo, caminho, { corpo: c });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    expect(await lerMotivos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each(ROTAS)("%s %s sem clinica.configurar (ex.: agenda.gerenciar) -> 403 ACESSO_NEGADO sem evento", async (metodo, caminho, c) => {
    await provisionarClinica();
    const operador = await criarUsuario();
    await darPermissao(operador, "agenda.gerenciar");
    const res = await requisitar(metodo, caminho, { cookie: await cookieDe(operador), corpo: c });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await lerMotivos()).toHaveLength(0);
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
      expect(await lerMotivos()).toHaveLength(0);
    },
  );

  it("os GETs não exigem CSRF e respondem Cache-Control: no-store", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    for (const caminho of [BASE, `${BASE}/${criado.id}`]) {
      const res = await requisitar("GET", caminho, { cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("usuário inativado pela AUT-005 perde o acesso (sessões revogadas -> 401)", async () => {
    await provisionarClinica();
    const admin = await administrador();
    expect((await requisitar("GET", BASE, { cookie: admin.cookie })).status).toBe(200);

    const gestorContas = await criarUsuario();
    await darPermissao(gestorContas, "usuarios.gerenciar");
    const inativacao = await requisitar("PATCH", `/auth/usuarios/${admin.id}/situacao`, {
      cookie: await cookieDe(gestorContas),
      corpo: { ativo: false },
    });
    expect(inativacao.status).toBe(200);

    const res = await requisitar("GET", BASE, { cookie: admin.cookie });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("não existe DELETE (D-CFG-48, D-CFG-54)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const res = await fetch(`${baseUrl}${BASE}/${criado.id}`, {
      method: "DELETE",
      headers: { cookie, [CABECALHO_REQUISICAO_TLF]: "1", "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(404);
    expect(await lerMotivos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

describe("CFG-005 — criação (D-CFG-46, D-CFG-48, D-CFG-49, D-CFG-56)", () => {
  it("cria ativo, responde exatamente os 4 campos e emite 1 evento sem a descrição", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();

    const res = await requisitar("POST", BASE, { cookie: admin.cookie, corpo: corpo("  Paciente desistiu  ") });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["ativo", "descricao", "id", "inativadoEm"]);
    expect(res.body).toMatchObject({ descricao: "Paciente desistiu", ativo: true, inativadoEm: null });

    const [linha] = await lerMotivos();
    expect(linha).toEqual({
      id: res.body.id,
      clinica_id: clinicaId,
      descricao: "Paciente desistiu",
      ativo: true,
      inativado_em: null,
    });

    const lista = await eventos();
    expect(lista).toHaveLength(1);
    const evento = lista[0] as LinhaEvento;
    expect(evento).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: admin.id,
      alvo_tipo: "motivo_cancelamento",
      alvo_id: res.body.id,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(contextoVazio(evento)).toBe(true);
    expect(JSON.stringify(evento)).not.toContain("desistiu");
  });

  it("aceita descrição de 1 e de 100 caracteres", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    expect((await criarViaApi(cookie, "X")).descricao).toBe("X");
    expect((await criarViaApi(cookie, "m".repeat(100))).descricao).toHaveLength(100);
  });

  it("sem clínica provisionada -> 404 CLINICA_NAO_CONFIGURADA, nada criado", async () => {
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: corpo() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
    expect(await lerMotivos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it.each([
    ["mesma descrição", "Paciente desistiu"],
    ["tudo maiúsculo", "PACIENTE DESISTIU"],
    ["tudo minúsculo", "paciente desistiu"],
    ["espaços de borda", "  paciente DESISTIU "],
  ])("%s -> 409 MOTIVO_CANCELAMENTO_DUPLICADO sem segundo registro nem evento", async (_rotulo, descricao) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, "Paciente desistiu");
    const antesEventos = (await eventos()).length;

    const res = await requisitar("POST", BASE, { cookie, corpo: corpo(descricao) });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO });
    expect(await lerMotivos()).toHaveLength(1);
    expect(await eventos()).toHaveLength(antesEventos);
  });

  it("a descrição de motivo INATIVO não é liberada para reuso (criar, inativar, recriar com outra caixa -> 409)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie, "Paciente desistiu");
    await inativarViaApi(cookie, criado.id);

    const res = await requisitar("POST", BASE, { cookie, corpo: corpo("PACIENTE DESISTIU") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO });
    expect(await lerMotivos()).toHaveLength(1);
  });

  it("descrição apenas semelhante (não equivalente) é permitida", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await criarViaApi(cookie, "Paciente desistiu");
    await criarViaApi(cookie, "Paciente desistiu do tratamento");
    await criarViaApi(cookie, "Paciente  desistiu");
    expect(await lerMotivos()).toHaveLength(3);
  });

  const invalidos: Array<[string, unknown]> = [
    ["descrição vazia", corpo("   ")],
    ["descrição acima de 100", corpo("a".repeat(101))],
    ["descrição com caractere de controle", corpo(`Paciente${String.fromCharCode(10)}desistiu`)],
    ["descrição number", { descricao: 42 }],
    ["chave extra ativo", { descricao: "Paciente desistiu", ativo: false }],
    ["chave extra id", { descricao: "Paciente desistiu", id: ID_INEXISTENTE }],
    ["chave ausente", {}],
    ["array", [corpo()]],
  ];

  it.each(invalidos)("%s -> 400 REQUISICAO_INVALIDA sem escrita", async (_rotulo, c) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: c });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerMotivos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it("JSON `null` é recusado pelo body parser antes do roteamento -> 400 sem escrita", async () => {
    // Limite conhecido (`erro-motivos-cancelamento.filter.ts`): o corpo do erro é o padrão da plataforma.
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("POST", BASE, { cookie, corpo: "null" });
    expect(res.status).toBe(400);
    expect(await lerMotivos()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

describe("CFG-005 — consulta (D-CFG-54)", () => {
  it("sem motivos pré-cadastrados (D-CFG-52): lista vazia -> 200 []", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("GET", BASE, { cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("ordem ativo DESC, descrição sem caixa, id; filtro ativo; consulta não audita", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const zeta = await criarViaApi(cookie, "zeta");
    const alfa = await criarViaApi(cookie, "Alfa");
    const beta = await criarViaApi(cookie, "beta");
    const gama = await criarViaApi(cookie, "Gama");
    await inativarViaApi(cookie, alfa.id);
    await inativarViaApi(cookie, gama.id);
    const eventosAntes = (await eventos()).length;

    const todos = await requisitar("GET", BASE, { cookie });
    expect(todos.body.map((m: any) => m.descricao)).toEqual(["beta", "zeta", "Alfa", "Gama"]);

    const ativos = await requisitar("GET", `${BASE}?ativo=true`, { cookie });
    expect(ativos.body.map((m: any) => m.id)).toEqual([beta.id, zeta.id]);

    const inativos = await requisitar("GET", `${BASE}?ativo=false`, { cookie });
    expect(inativos.body.map((m: any) => m.id)).toEqual([alfa.id, gama.id]);
    for (const m of inativos.body) {
      expect(Object.keys(m).sort()).toEqual(["ativo", "descricao", "id", "inativadoEm"]);
      expect(m.ativo).toBe(false);
      expect(typeof m.inativadoEm).toBe("string");
      expect(new Date(m.inativadoEm).toISOString()).toBe(m.inativadoEm);
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

  it("GET por id — encontrado, inexistente (404) e malformado (400)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    const ok = await requisitar("GET", `${BASE}/${criado.id}`, { cookie });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(criado);

    const ausente = await requisitar("GET", `${BASE}/${ID_INEXISTENTE}`, { cookie });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_NAO_ENCONTRADO });

    const malformado = await requisitar("GET", `${BASE}/nao-e-uuid`, { cookie });
    expect(malformado.status).toBe(400);
    expect(malformado.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });
});

// ---------------------------------------------------------------------------
// Atualização
// ---------------------------------------------------------------------------

describe("CFG-005 — atualização (D-CFG-46, D-CFG-48, D-CFG-50, D-CFG-53)", () => {
  it("edição efetiva persiste, responde o estado vigente e emite 1 evento sem a descrição", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);

    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie: admin.cookie, corpo: corpo("Paciente remarcou por conta própria") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: criado.id, descricao: "Paciente remarcou por conta própria", ativo: true, inativadoEm: null });

    const lista = await eventos();
    expect(lista).toHaveLength(2);
    const ultimo = lista[1] as LinhaEvento;
    expect(ultimo).toMatchObject({ alvo_tipo: "motivo_cancelamento", alvo_id: criado.id, ator_usuario_id: admin.id });
    expect(contextoVazio(ultimo)).toBe(true);
    expect(JSON.stringify(ultimo)).not.toContain("remarcou");
  });

  it("alterar só a caixa do próprio motivo é edição efetiva e auditada", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie, "Paciente desistiu");
    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo("PACIENTE DESISTIU") });
    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe("PACIENTE DESISTIU");
    expect(await eventos()).toHaveLength(2);
  });

  it("PUT idêntico (inclusive após trim) -> 200 sem UPDATE (xmin) e sem evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const antes = await xmin(criado.id);

    for (const c of [corpo(), corpo("  Paciente desistiu  ")]) {
      const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: c });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(criado);
    }
    expect(await xmin(criado.id)).toBe(antes);
    expect(await eventos()).toHaveLength(1);
  });

  it.each([
    ["ativo", false],
    ["inativo", true],
  ])("renomear para descrição equivalente a OUTRO motivo %s -> 409 DUPLICADO sem alteração", async (_rotulo, inativarOutro) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const outro = await criarViaApi(cookie, "Paciente desistiu");
    if (inativarOutro) await inativarViaApi(cookie, outro.id);
    const alvo = await criarViaApi(cookie, "Chuva forte");
    const antes = await lerMotivos();
    const eventosAntes = (await eventos()).length;

    const res = await requisitar("PUT", `${BASE}/${alvo.id}`, { cookie, corpo: corpo("paciente DESISTIU") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO });
    expect(await lerMotivos()).toEqual(antes);
    expect(await eventos()).toHaveLength(eventosAntes);
  });

  it("PUT em inexistente -> 404; id malformado -> 400; corpo com ativo -> 400", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    const ausente = await requisitar("PUT", `${BASE}/${ID_INEXISTENTE}`, { cookie, corpo: corpo() });
    expect(ausente.status).toBe(404);
    expect(ausente.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_NAO_ENCONTRADO });

    expect((await requisitar("PUT", `${BASE}/123`, { cookie, corpo: corpo() })).status).toBe(400);

    const comAtivo = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: { descricao: "Outro", ativo: false } });
    expect(comAtivo.status).toBe(400);
    expect((await lerMotivos())[0]).toMatchObject({ descricao: "Paciente desistiu", ativo: true });
  });

  it("edição de motivo inativo e sem uso é permitida e não altera a situação", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const inativado = await inativarViaApi(cookie, criado.id);

    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo("Desistência do paciente") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: criado.id, descricao: "Desistência do paciente", ativo: false, inativadoEm: inativado.inativadoEm });
  });

  it("D-CFG-50: motivo referenciado por agendamento -> 409 EM_USO, sem mutação e sem evento", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: criado.id });
    const antes = await lerMotivos();
    const xminAntes = await xmin(criado.id);

    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie: admin.cookie, corpo: corpo("Outra descrição") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_EM_USO });
    expect(await lerMotivos()).toEqual(antes);
    expect(await xmin(criado.id)).toBe(xminAntes);
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-50: motivo referenciado SOMENTE pelo histórico -> 409 EM_USO", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    const agendamentoId = await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: null, estado: "AGENDADO" });
    await registrarHistorico(agendamentoId, admin.id, criado.id);

    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie: admin.cookie, corpo: corpo("Outra descrição") });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_EM_USO });
    expect((await lerMotivos())[0]?.descricao).toBe("Paciente desistiu");
    expect(await eventos()).toHaveLength(1);
  });

  it("D-CFG-50: o no-op precede a verificação de uso — PUT idêntico sobre motivo em uso -> 200 sem evento", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: criado.id });

    const res = await requisitar("PUT", `${BASE}/${criado.id}`, { cookie: admin.cookie, corpo: corpo(" Paciente desistiu ") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(criado);
    expect(await eventos()).toHaveLength(1);
  });

  it("motivo não referenciado ao lado de outro em uso continua editável", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const usado = await criarViaApi(admin.cookie, "Paciente desistiu");
    const livre = await criarViaApi(admin.cookie, "Chuva forte");
    await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: usado.id });

    const res = await requisitar("PUT", `${BASE}/${livre.id}`, { cookie: admin.cookie, corpo: corpo("Temporal") });
    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe("Temporal");
  });
});

// ---------------------------------------------------------------------------
// Situação e preservação histórica
// ---------------------------------------------------------------------------

describe("CFG-005 — situação (D-CFG-49) e preservação histórica (D-CFG-54)", () => {
  it("inativa e reativa, cada mudança auditada; repetições idempotentes sem evento", async () => {
    await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    const caminho = `${BASE}/${criado.id}/situacao`;

    const inativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativo.status).toBe(200);
    expect(inativo.body.ativo).toBe(false);
    expect(inativo.body.inativadoEm).not.toBeNull();
    expect((await lerMotivos())[0]?.inativado_em).not.toBeNull();
    expect(await eventos()).toHaveLength(2);

    const antes = await xmin(criado.id);
    const repetido = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(repetido.status).toBe(200);
    expect(repetido.body).toEqual(inativo.body);
    expect(await xmin(criado.id)).toBe(antes);
    expect(await eventos()).toHaveLength(2);

    const ativo = await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativo.status).toBe(200);
    expect(ativo.body).toEqual({ id: criado.id, descricao: "Paciente desistiu", ativo: true, inativadoEm: null });
    expect((await lerMotivos())[0]?.inativado_em).toBeNull();
    const lista = await eventos();
    expect(lista).toHaveLength(3);
    expect(lista.every((e) => e.alvo_tipo === "motivo_cancelamento" && e.alvo_id === criado.id && contextoVazio(e))).toBe(true);

    expect((await requisitar("PATCH", caminho, { cookie: admin.cookie, corpo: { ativo: true } })).status).toBe(200);
    expect(await eventos()).toHaveLength(3);
  });

  it.each([[{}], [{ ativo: "false" }], [{ ativo: false, descricao: "x" }], [null]])(
    "corpo de situação inválido %p -> 400 sem mutação",
    async (c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criado = await criarViaApi(cookie);
      const res = await requisitar("PATCH", `${BASE}/${criado.id}/situacao`, { cookie, corpo: c });
      expect(res.status).toBe(400);
      expect((await lerMotivos())[0]?.ativo).toBe(true);
    },
  );

  it("PATCH em inexistente -> 404; id malformado -> 400", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("PATCH", `${BASE}/${ID_INEXISTENTE}/situacao`, { cookie, corpo: { ativo: false } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_NAO_ENCONTRADO });
    expect((await requisitar("PATCH", `${BASE}/x/situacao`, { cookie, corpo: { ativo: false } })).status).toBe(400);
  });

  it("inativar e reativar motivo EM USO é permitido e nunca altera agendamento nem historico_agendamento", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    const agendamentoId = await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: criado.id });
    await registrarHistorico(agendamentoId, admin.id, criado.id);
    const antes = await referenciasDaAgenda();

    const inativo = await requisitar("PATCH", `${BASE}/${criado.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: false } });
    expect(inativo.status).toBe(200);
    expect(await referenciasDaAgenda()).toEqual(antes);

    // Motivo inativo permanece consultável e referenciado (D-CFG-54).
    const consulta = await requisitar("GET", `${BASE}/${criado.id}`, { cookie: admin.cookie });
    expect(consulta.body).toMatchObject({ descricao: "Paciente desistiu", ativo: false });

    const ativo = await requisitar("PATCH", `${BASE}/${criado.id}/situacao`, { cookie: admin.cookie, corpo: { ativo: true } });
    expect(ativo.status).toBe(200);
    expect(await referenciasDaAgenda()).toEqual(antes);
    expect(await lerMotivos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Atomicidade, concorrência e invariantes físicas
// ---------------------------------------------------------------------------

describe("CFG-005 — atomicidade, concorrência e invariantes físicas (D-CFG-46, D-CFG-47, D-CFG-53)", () => {
  it.each([
    ["POST", () => BASE, () => corpo("Novo motivo")],
    ["PUT", (id: string) => `${BASE}/${id}`, () => corpo("Renomeado")],
    ["PATCH", (id: string) => `${BASE}/${id}/situacao`, () => ({ ativo: false })],
  ] as Array<[Metodo, (id: string) => string, () => unknown]>)(
    "%s com falha na auditoria -> 500 FALHA_INTERNA e rollback conjunto",
    async (metodo, caminho, c) => {
      await provisionarClinica();
      const { cookie } = await administrador();
      const criado = await criarViaApi(cookie);
      const antes = await lerMotivos();
      const eventosAntes = (await eventos()).length;

      const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
      try {
        const res = await requisitar(metodo, caminho(criado.id), { cookie, corpo: c() });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      } finally {
        espia.mockRestore();
      }
      expect(await lerMotivos()).toEqual(antes);
      expect(await eventos()).toHaveLength(eventosAntes);
    },
  );

  it("criações concorrentes equivalentes -> exatamente um 201 e um 409 DUPLICADO, sem vazar erro do banco", async () => {
    await provisionarClinica();
    const a = await administrador();
    const b = await administrador();
    for (let rodada = 0; rodada < 3; rodada++) {
      const descricao = `Falta de transporte ${rodada}`;
      const respostas = await Promise.all([
        requisitar("POST", BASE, { cookie: a.cookie, corpo: corpo(descricao) }),
        requisitar("POST", BASE, { cookie: b.cookie, corpo: corpo(` ${descricao.toUpperCase()} `) }),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
      const conflito = respostas.find((r) => r.status === 409) as RespostaHttp;
      expect(conflito.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO });
    }
    expect(await lerMotivos()).toHaveLength(3);
    expect(await eventos()).toHaveLength(3);
  });

  it("renomeações concorrentes para a mesma descrição -> um 200 e um 409 DUPLICADO", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const um = await criarViaApi(cookie, "Motivo um");
    const dois = await criarViaApi(cookie, "Motivo dois");
    const respostas = await Promise.all([
      requisitar("PUT", `${BASE}/${um.id}`, { cookie, corpo: corpo("Feriado local") }),
      requisitar("PUT", `${BASE}/${dois.id}`, { cookie, corpo: corpo("FERIADO LOCAL") }),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((respostas.find((r) => r.status === 409) as RespostaHttp).body).toEqual({
      erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO,
    });
    expect(await eventos()).toHaveLength(3);
  });

  it("o PUT lê SOB o lock (SELECT ... FOR UPDATE) — enxerga a escrita concorrente", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM motivo_cancelamento WHERE id = ${criado.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`
        UPDATE motivo_cancelamento SET descricao = 'Gravado pelo Concorrente' WHERE id = ${criado.id}::uuid`;
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo("Gravado pelo Concorrente") }).then((r) => {
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

  it("a verificação de uso ocorre SOB o lock — referência gravada enquanto o PUT espera -> 409 EM_USO", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const criado = await criarViaApi(admin.cookie);
    const agendamentoId = await criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: null, estado: "AGENDADO" });

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    // Simula o contrato de D-CFG-57: o cancelamento bloqueia a linha do motivo e referencia-o.
    const cancelamento = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM motivo_cancelamento WHERE id = ${criado.id}::uuid FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`
        UPDATE agendamento
           SET estado = 'CANCELADO',
               motivo_cancelamento_id = ${criado.id}::uuid,
               cancelado_em = now(),
               cancelado_por_usuario_id = ${admin.id}::uuid
         WHERE id = ${agendamentoId}::uuid`;
    });
    await adquirido;

    const put = requisitar("PUT", `${BASE}/${criado.id}`, { cookie: admin.cookie, corpo: corpo("Outra descrição") });
    await new Promise((res) => setTimeout(res, 300));
    liberar();
    await cancelamento;

    const res = await put;
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_EM_USO });
    expect((await lerMotivos())[0]?.descricao).toBe("Paciente desistiu");
  });

  it("PUT e PATCH concorrentes serializam — ambos aplicados, 2 eventos", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const criado = await criarViaApi(cookie);
    const [put, patch] = await Promise.all([
      requisitar("PUT", `${BASE}/${criado.id}`, { cookie, corpo: corpo("Desistência") }),
      requisitar("PATCH", `${BASE}/${criado.id}/situacao`, { cookie, corpo: { ativo: false } }),
    ]);
    expect(put.status).toBe(200);
    expect(patch.status).toBe(200);
    const [linha] = await lerMotivos();
    expect(linha).toMatchObject({ descricao: "Desistência", ativo: false });
    expect(linha?.inativado_em).not.toBeNull();
    expect(await eventos()).toHaveLength(3);
  });

  it("D-CFG-47: o banco rejeita situação incoerente e descrição equivalente (caixa/bordas, inclusive de inativo)", async () => {
    const clinicaId = await provisionarClinica();
    const inserir = (descricao: string, ativo: boolean, inativado: boolean) =>
      erroSql((tx) =>
        tx.$executeRaw`
          INSERT INTO motivo_cancelamento (id, clinica_id, descricao, ativo, inativado_em)
          VALUES (gen_random_uuid(), ${clinicaId}::uuid, ${descricao}, ${ativo},
                  CASE WHEN ${inativado} THEN now() ELSE NULL END)`,
      );

    expect(await inserir("A", true, true)).toContain("ck_motivo_cancelamento_situacao");
    expect(await inserir("B", false, false)).toContain("ck_motivo_cancelamento_situacao");

    await database.transacao((tx) =>
      tx.$executeRaw`
        INSERT INTO motivo_cancelamento (id, clinica_id, descricao, ativo, inativado_em)
        VALUES (gen_random_uuid(), ${clinicaId}::uuid, 'Paciente desistiu', false, now())`,
    );
    for (const equivalente of ["  PACIENTE DESISTIU ", "paciente desistiu"]) {
      const duplicado = await inserir(equivalente, true, false);
      expect(duplicado).toContain("23505");
      expect(duplicado).toContain("ux_motivo_cancelamento_clinica_descricao");
    }
    expect(await lerMotivos()).toHaveLength(1);

    const incoerente = await erroSql((tx) =>
      tx.$executeRaw`UPDATE motivo_cancelamento SET ativo = true WHERE clinica_id = ${clinicaId}::uuid`,
    );
    expect(incoerente).toContain("ck_motivo_cancelamento_situacao");
  });

  // D-CFG-51 ("nenhuma restrição nova em agendamento") foi SUPERADA por
  // `docs/15` D-AGD-07, que a resolve expressamente e autoriza o CHECK de
  // coerência do cancelamento. O teste original — que afirmava que um
  // agendamento CANCELADO sem motivo continuava aceito pelo banco — deixou de
  // descrever o estado vigente e foi substituído pela medição da restrição que
  // passou a valer. Nenhuma decisão de CFG-005 foi reaberta: a de CFG-005
  // registrava o estado de então, e a decisão posterior da agenda o alterou.
  it("D-AGD-07 (supera D-CFG-51): o banco rejeita CANCELADO sem motivo, sem instante ou sem ator", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();
    const motivo = await criarViaApi(admin.cookie, "Motivo para cancelar");

    // Cancelamento coerente é aceito.
    const coerente = await criarAgendamento({
      atorId: admin.id,
      clinicaId,
      motivoNoAgendamento: motivo.id,
      estado: "CANCELADO",
    });
    expect(coerente).toMatch(/^[0-9a-f-]{36}$/);

    // Sem motivo -> rejeitado pela CHECK.
    await expect(
      criarAgendamento({ atorId: admin.id, clinicaId, motivoNoAgendamento: null, estado: "CANCELADO" }),
    ).rejects.toThrow();

    // Um agendamento AGENDADO não pode carregar o TRIO de cancelamento — a
    // equivalência da CHECK vale nos dois sentidos.
    const agendado = await criarAgendamento({
      atorId: admin.id,
      clinicaId,
      motivoNoAgendamento: null,
      estado: "AGENDADO",
    });
    await expect(
      database.transacao(
        (tx) => tx.$executeRaw`
          UPDATE agendamento
             SET motivo_cancelamento_id = ${motivo.id}::uuid,
                 cancelado_em = now(),
                 cancelado_por_usuario_id = ${admin.id}::uuid
           WHERE id = ${agendado}::uuid`,
      ),
    ).rejects.toThrow();
  });
});
