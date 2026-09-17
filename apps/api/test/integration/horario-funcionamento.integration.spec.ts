// TechLab Fisio — integração contra PostgreSQL REAL do horário de funcionamento
// da clínica única (CFG-002; `docs/14` D-CFG-13..D-CFG-21).
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

const CAMINHO = "/horario-funcionamento";

const j = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });

const GRADE_A = [j(1, "08:00", "12:00"), j(1, "13:00", "18:00"), j(3, "09:00", "17:30")];
const GRADE_B = [j(0, "07:00", "11:00"), j(6, "08:00", "12:00")];

async function provisionarClinica(): Promise<string> {
  return database.transacao(async (tx) => {
    const c = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética CFG-002", fusoHorario: "America/Sao_Paulo" },
      select: { id: true },
    });
    return c.id;
  });
}

async function criarUsuario(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `cfg2-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-cfg2",
        nome: "Usuário Sintético CFG-002",
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

async function requisitar(
  metodo: "GET" | "PUT",
  opcoes: { cookie?: string; corpo?: unknown; csrf?: boolean } = {},
): Promise<RespostaHttp> {
  const headers: Record<string, string> = {
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    ...(opcoes.cookie ? { cookie: opcoes.cookie } : {}),
  };
  if (metodo === "PUT") {
    headers["content-type"] = "application/json";
    if (opcoes.csrf !== false) headers[CABECALHO_REQUISICAO_TLF] = "1";
  }
  const res = await fetch(`${baseUrl}${CAMINHO}`, {
    method: metodo,
    headers,
    ...(metodo === "PUT"
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

interface LinhaJanela {
  id: string;
  clinica_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

async function lerJanelas(): Promise<LinhaJanela[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaJanela[]>`
      SELECT id::text AS id, clinica_id::text AS clinica_id, dia_semana,
             hora_inicio::text AS hora_inicio, hora_fim::text AS hora_fim
        FROM horario_funcionamento
       ORDER BY dia_semana, hora_inicio`,
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

async function eventosConfiguracao(): Promise<LinhaEvento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaEvento[]>`
      SELECT acao, ator_usuario_id, alvo_tipo, alvo_id, resultado::text AS resultado,
             justificativa, contexto, correlacao_id
        FROM evento_auditoria
       WHERE acao = 'configuracao.alterada'
       ORDER BY ocorrido_em`,
  );
}

async function totalEventos(): Promise<number> {
  const r = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM evento_auditoria`,
  );
  return Number(r[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("CFG-002 — autenticação, autorização e CSRF (D-CFG-21)", () => {
  it("sem sessão, GET e PUT retornam 401 SESSAO_INVALIDA sem mutação nem evento", async () => {
    await provisionarClinica();

    const get = await requisitar("GET");
    expect(get.status).toBe(401);
    expect(get.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const put = await requisitar("PUT", { corpo: { janelas: GRADE_A } });
    expect(put.status).toBe(401);
    expect(put.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    expect(await lerJanelas()).toHaveLength(0);
    expect(await totalEventos()).toBe(0);
  });

  it("sem clinica.configurar, GET e PUT retornam 403 ACESSO_NEGADO", async () => {
    await provisionarClinica();
    const operador = await criarUsuario();
    await darPermissao(operador, "usuarios.gerenciar");
    const cookie = await cookieDe(operador);

    const get = await requisitar("GET", { cookie });
    expect(get.status).toBe(403);
    expect(get.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    const put = await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    expect(await lerJanelas()).toHaveLength(0);
    expect(await totalEventos()).toBe(0);
  });

  it("PUT sem x-tlf-requisicao retorna 403 REQUISICAO_NAO_AUTORIZADA sem mutação", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const put = await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A }, csrf: false });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    expect(await lerJanelas()).toHaveLength(0);
  });

  it("a CSRF é avaliada antes da sessão (sem cookie e sem header -> 403)", async () => {
    const put = await requisitar("PUT", { corpo: { janelas: GRADE_A }, csrf: false });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
  });
});

describe("CFG-002 — consulta", () => {
  it("clínica sem grade: GET 200 com lista vazia, no-store e sem auditoria", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("GET", { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body).toEqual({ janelas: [] });
    expect(await totalEventos()).toBe(0);
  });

  it("sem linha de clinica: GET e PUT retornam 404 CLINICA_NAO_CONFIGURADA sem escrita", async () => {
    const { cookie } = await administrador();

    const get = await requisitar("GET", { cookie });
    expect(get.status).toBe(404);
    expect(get.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });

    const put = await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });
    expect(put.status).toBe(404);
    expect(put.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });

    expect(await lerJanelas()).toHaveLength(0);
    expect(await totalEventos()).toBe(0);
  });

  it("GET devolve a grade ordenada por dia e início, em HH:MM", async () => {
    const clinicaId = await provisionarClinica();
    await database.transacao(async (tx) => {
      for (const [dia, ini, fim] of [[3, "09:00", "17:30"], [1, "13:00", "18:00"], [1, "08:00", "12:00"]] as const) {
        await tx.$executeRaw`
          INSERT INTO horario_funcionamento (id, clinica_id, dia_semana, hora_inicio, hora_fim)
          VALUES (gen_random_uuid(), ${clinicaId}::uuid, ${dia}::smallint, ${ini}::time, ${fim}::time)`;
      }
    });
    const { cookie } = await administrador();
    const res = await requisitar("GET", { cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ janelas: GRADE_A });
  });
});

describe("CFG-002 — substituição (D-CFG-15, D-CFG-17)", () => {
  it("PUT válido persiste a grade, responde em ordem canônica e emite 1 evento alvo clinica sem valores", async () => {
    const clinicaId = await provisionarClinica();
    const admin = await administrador();

    const res = await requisitar("PUT", { cookie: admin.cookie, corpo: { janelas: [...GRADE_A].reverse() } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ janelas: GRADE_A });

    const linhas = await lerJanelas();
    expect(linhas.map((l) => [l.clinica_id, l.dia_semana, l.hora_inicio, l.hora_fim])).toEqual([
      [clinicaId, 1, "08:00:00", "12:00:00"],
      [clinicaId, 1, "13:00:00", "18:00:00"],
      [clinicaId, 3, "09:00:00", "17:30:00"],
    ]);

    const eventos = await eventosConfiguracao();
    expect(eventos).toHaveLength(1);
    const evento = eventos[0] as LinhaEvento;
    expect(evento).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: admin.id,
      alvo_tipo: "clinica",
      alvo_id: clinicaId,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(evento.contexto === null || JSON.stringify(evento.contexto) === "{}").toBe(true);
    const serializado = JSON.stringify(evento);
    for (const hora of ["08:00", "12:00", "13:00", "18:00", "17:30"]) {
      expect(serializado).not.toContain(hora);
    }
  });

  it("substituição remove as janelas anteriores (exclusão física aceita por D-CFG-15)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });
    const idsAntes = (await lerJanelas()).map((l) => l.id);

    const res = await requisitar("PUT", { cookie, corpo: { janelas: GRADE_B } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ janelas: GRADE_B });

    const depois = await lerJanelas();
    expect(depois).toHaveLength(2);
    expect(depois.some((l) => idsAntes.includes(l.id))).toBe(false);
    expect(await eventosConfiguracao()).toHaveLength(2);
  });

  it("PUT com lista vazia fecha a clínica todos os dias e audita", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });

    const res = await requisitar("PUT", { cookie, corpo: { janelas: [] } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ janelas: [] });
    expect(await lerJanelas()).toHaveLength(0);
    expect(await eventosConfiguracao()).toHaveLength(2);
  });

  it("grade idêntica (em qualquer ordem) retorna 200 sem escrita e sem evento", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });
    const antes = await lerJanelas();

    const res = await requisitar("PUT", { cookie, corpo: { janelas: [...GRADE_A].reverse() } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ janelas: GRADE_A });
    expect(await lerJanelas()).toEqual(antes);
    expect(await eventosConfiguracao()).toHaveLength(1);

    // grade vazia sobre grade vazia também é no-op
    await requisitar("PUT", { cookie, corpo: { janelas: [] } });
    const res2 = await requisitar("PUT", { cookie, corpo: { janelas: [] } });
    expect(res2.status).toBe(200);
    expect(await eventosConfiguracao()).toHaveLength(2);
  });
});

describe("CFG-002 — validação do corpo (D-CFG-13, D-CFG-14, D-CFG-18)", () => {
  const invalidos: Array<[string, unknown]> = [
    ["chave extra", { janelas: GRADE_A, clinicaId: randomUUID() }],
    ["janela com id", { janelas: [{ ...j(1, "08:00", "12:00"), id: randomUUID() }] }],
    ["sobreposição", { janelas: [j(1, "08:00", "12:00"), j(1, "11:59", "14:00")] }],
    ["adjacência", { janelas: [j(1, "08:00", "12:00"), j(1, "12:00", "14:00")] }],
    ["cruza meia-noite", { janelas: [j(5, "22:00", "02:00")] }],
    ["segundos", { janelas: [j(1, "08:00:00", "12:00:00")] }],
    ["diaSemana 7", { janelas: [j(7, "08:00", "12:00")] }],
    ["diaSemana string", { janelas: [{ diaSemana: "1", horaInicio: "08:00", horaFim: "12:00" }] }],
    [
      "5 janelas no dia",
      { janelas: [j(2, "06:00", "07:00"), j(2, "08:00", "09:00"), j(2, "10:00", "11:00"), j(2, "12:00", "13:00"), j(2, "14:00", "15:00")] },
    ],
    ["array na raiz", GRADE_A],
  ];

  it.each(invalidos)("%s -> 400 REQUISICAO_INVALIDA sem mutação nem evento", async (_rotulo, corpo) => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("PUT", { cookie, corpo: { janelas: GRADE_B } });
    const antes = await lerJanelas();

    const res = await requisitar("PUT", { cookie, corpo });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerJanelas()).toEqual(antes);
    expect(await eventosConfiguracao()).toHaveLength(1);
  });
});

describe("CFG-002 — atomicidade e concorrência (D-CFG-15, D-CFG-16)", () => {
  it("falha na auditoria -> 500 FALHA_INTERNA e rollback conjunto (grade anterior intacta)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("PUT", { cookie, corpo: { janelas: GRADE_A } });
    const antes = await lerJanelas();

    const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      const res = await requisitar("PUT", { cookie, corpo: { janelas: GRADE_B } });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      expect(JSON.stringify(res.body)).not.toContain("FALHA_SIMULADA");
    } finally {
      espia.mockRestore();
    }

    expect(await lerJanelas()).toEqual(antes);
    expect(await eventosConfiguracao()).toHaveLength(1);
  });

  it("o PUT espera o lock da linha de clinica e lê a grade SOB o lock", async () => {
    const clinicaId = await provisionarClinica();
    const { cookie } = await administrador();

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    // Concorrente retém o lock e grava EXATAMENTE a grade que o PUT enviará.
    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM clinica FOR UPDATE`;
      lockAdquirido();
      await barreira;
      for (const janela of GRADE_B) {
        await tx.$executeRaw`
          INSERT INTO horario_funcionamento (id, clinica_id, dia_semana, hora_inicio, hora_fim)
          VALUES (gen_random_uuid(), ${clinicaId}::uuid, ${janela.diaSemana}::smallint,
                  ${janela.horaInicio}::time, ${janela.horaFim}::time)`;
      }
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", { cookie, corpo: { janelas: GRADE_B } }).then((r) => {
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

    // Leitura sob lock enxerga a grade já gravada -> no-op, sem evento e sem duplicação.
    expect(await lerJanelas()).toHaveLength(GRADE_B.length);
    expect(await eventosConfiguracao()).toHaveLength(0);
  });

  it("dois PUTs concorrentes serializam — grade final igual a uma delas, sem mistura, 2 eventos", async () => {
    await provisionarClinica();
    const a = await administrador();
    const b = await administrador();

    const [ra, rb] = await Promise.all([
      requisitar("PUT", { cookie: a.cookie, corpo: { janelas: GRADE_A } }),
      requisitar("PUT", { cookie: b.cookie, corpo: { janelas: GRADE_B } }),
    ]);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);

    const final = (await lerJanelas()).map((l) => j(l.dia_semana, l.hora_inicio.slice(0, 5), l.hora_fim.slice(0, 5)));
    expect([GRADE_A, GRADE_B]).toContainEqual(final);

    const eventos = await eventosConfiguracao();
    expect(eventos).toHaveLength(2);
    expect(new Set(eventos.map((e) => e.ator_usuario_id))).toEqual(new Set([a.id, b.id]));
  });
});
