// TechLab Fisio — integração contra PostgreSQL REAL da disponibilidade
// versionada do profissional (PRO-003; `docs/16` §4, D-PRO3-01..D-PRO3-10;
// matriz TD-01..TD-10, TD-12, TD-13).
//
// Runtime exclusivamente `tlf_app`; HTTP real via `app.listen(0)`; limpeza por
// TRUNCATE entre testes (setup-db.ts). Dados 100% sintéticos.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { ERRO } from "../../src/auth/auth.dto.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { SessaoService } from "../../src/auth/sessao.service.js";
import { ERRO_AUTORIZACAO } from "../../src/authz/erro-autorizacao.js";
import { ERRO_CLINICA } from "../../src/clinica/clinica.dto.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { ERRO_DISPONIBILIDADE } from "../../src/profissional/disponibilidade.dto.js";
import { ERRO_PROFISSIONAL } from "../../src/profissional/profissionais.dto.js";

let moduleRef: TestingModule;
let app: INestApplication;
let baseUrl: string;
let database: DatabaseService;
let sessoes: SessaoService;
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
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
}, 180_000);

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ID_INEXISTENTE = "0191f5a0-0000-7000-8000-000000000000";
const FUSO_PADRAO = "America/Sao_Paulo";

const J = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });
const MANHA = [J(1, "08:00", "12:00")];
const TARDE = [J(1, "13:00", "18:00")];

function caminho(profissionalId: string): string {
  return `/profissionais/${profissionalId}/disponibilidade`;
}

async function provisionarClinica(fusoHorario = FUSO_PADRAO): Promise<string> {
  return database.transacao(async (tx) => {
    const existente = await tx.clinica.findFirst({ select: { id: true } });
    if (existente !== null) {
      await tx.clinica.update({ where: { id: existente.id }, data: { fusoHorario } });
      return existente.id;
    }
    const c = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética PRO-003", fusoHorario },
      select: { id: true },
    });
    return c.id;
  });
}

async function criarUsuario(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `pro3-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-pro3",
        nome: "Usuário Sintético PRO-003",
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

/** Ator com `profissionais.gerenciar` — o Administrador de D-PRO3-08. */
async function administrador(): Promise<{ id: string; cookie: string }> {
  const id = await criarUsuario();
  await darPermissao(id, "profissionais.gerenciar");
  return { id, cookie: await cookieDe(id) };
}

/** Ator autenticado SEM `profissionais.gerenciar` (Recepção/Fisioterapeuta). */
async function semPermissao(codigo: string): Promise<{ id: string; cookie: string }> {
  const id = await criarUsuario();
  await darPermissao(id, codigo);
  return { id, cookie: await cookieDe(id) };
}

async function criarProfissional(opcoes: { ativo?: boolean; usuarioId?: string } = {}): Promise<string> {
  const ativo = opcoes.ativo ?? true;
  return database.transacao(async (tx) => {
    const p = await tx.profissional.create({
      data: {
        nome: "Ana Sintética PRO-003",
        registroProfissional: null,
        usuarioId: opcoes.usuarioId ?? null,
        ativo,
        inativadoEm: ativo ? null : new Date(),
      },
      select: { id: true },
    });
    return p.id;
  });
}

interface RespostaHttp {
  status: number;
  body: any;
  headers: Headers;
}

async function requisitar(
  metodo: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
  rota: string,
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
  const res = await fetch(`${baseUrl}${rota}`, {
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

interface LinhaDisponibilidade {
  profissional_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

/** Leitura FÍSICA — independente do serviço, para provar o efeito no banco. */
async function lerLinhas(profissionalId?: string): Promise<LinhaDisponibilidade[]> {
  return database.transacao((tx) =>
    profissionalId === undefined
      ? tx.$queryRaw<LinhaDisponibilidade[]>`
          SELECT profissional_id, dia_semana,
                 to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
                 to_char(hora_fim, 'HH24:MI') AS hora_fim,
                 to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
                 to_char(vigencia_fim, 'YYYY-MM-DD') AS vigencia_fim
            FROM disponibilidade_profissional
           ORDER BY profissional_id, vigencia_inicio, dia_semana, hora_inicio`
      : tx.$queryRaw<LinhaDisponibilidade[]>`
          SELECT profissional_id, dia_semana,
                 to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
                 to_char(hora_fim, 'HH24:MI') AS hora_fim,
                 to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
                 to_char(vigencia_fim, 'YYYY-MM-DD') AS vigencia_fim
            FROM disponibilidade_profissional
           WHERE profissional_id = ${profissionalId}::uuid
           ORDER BY vigencia_inicio, dia_semana, hora_inicio`,
  );
}

/** `xmin` de cada linha — muda a qualquer UPDATE; some/aparece em DELETE/INSERT. */
async function assinaturaFisica(profissionalId: string): Promise<string[]> {
  const linhas = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ id: string; x: string }>>`
      SELECT id::text AS id, xmin::text AS x
        FROM disponibilidade_profissional
       WHERE profissional_id = ${profissionalId}::uuid
       ORDER BY id`,
  );
  return linhas.map((l) => `${l.id}:${l.x}`);
}

async function totalEventos(): Promise<number> {
  const r = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM evento_auditoria`,
  );
  return Number(r[0]?.n ?? 0);
}

/** Data civil de HOJE no fuso da clínica, deslocada em `dias`. */
function dataLocal(dias = 0, fuso = FUSO_PADRAO): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + dias * 86_400_000));
  return partes;
}

/** Semeia uma versão diretamente no banco, sem passar pela API. */
async function semear(
  profissionalId: string,
  vigenciaInicio: string,
  vigenciaFim: string | null,
  janelas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>,
): Promise<void> {
  await database.transacao(async (tx) => {
    for (const janela of janelas) {
      await tx.$executeRawUnsafe(
        `INSERT INTO disponibilidade_profissional
           (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
         VALUES ($1::uuid, $2::uuid, $3::smallint, $4::time, $5::time, $6::date, $7::date)`,
        randomUUID(),
        profissionalId,
        janela.diaSemana,
        janela.horaInicio,
        janela.horaFim,
        vigenciaInicio,
        vigenciaFim,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// TD-09 — sessão, autorização e CSRF (D-PRO3-08)
// ---------------------------------------------------------------------------

describe("TD-09 — sessão, autorização e CSRF (D-PRO3-08)", () => {
  it("sem sessão: GET e PUT respondem 401 SESSAO_INVALIDA", async () => {
    const profissionalId = await criarProfissional();
    const get = await requisitar("GET", caminho(profissionalId));
    expect(get.status).toBe(401);
    expect(get.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    const put = await requisitar("PUT", caminho(profissionalId), { corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    expect(put.status).toBe(401);
    expect(put.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it.each([
    ["Recepcionista", "pacientes.gerenciar"],
    ["Fisioterapeuta", "prontuario.registrar"],
  ])("%s (sem profissionais.gerenciar): 403 ACESSO_NEGADO no GET e no PUT, sem evento", async (_perfil, permissao) => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await semPermissao(permissao);
    const get = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(get.status).toBe(403);
    expect(get.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    const put = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: MANHA },
    });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await lerLinhas()).toHaveLength(0);
    // L-07: negação de autorização NÃO gera evento nestas rotas.
    expect(await totalEventos()).toBe(0);
  });

  it("D-PRO3-08: o Fisioterapeuta vinculado ao PRÓPRIO profissional continua sem acesso", async () => {
    await provisionarClinica();
    const { id: usuarioId, cookie } = await semPermissao("prontuario.registrar");
    const profissionalId = await criarProfissional({ usuarioId });
    const get = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(get.status).toBe(403);
    const put = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: MANHA },
    });
    expect(put.status).toBe(403);
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("PUT sem o custom header CSRF: 403 REQUISICAO_NAO_AUTORIZADA e nenhuma escrita", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      csrf: false,
      corpo: { vigenciaInicio: dataLocal(), janelas: MANHA },
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("GET é método seguro: funciona SEM o header CSRF e responde Cache-Control: no-store", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("D-PRO3-02: não existe POST, PATCH nem DELETE de disponibilidade", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    for (const metodo of ["POST", "PATCH", "DELETE"] as const) {
      const res = await requisitar(metodo, caminho(profissionalId), { cookie, corpo: {} });
      expect(res.status).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// TD-01, TD-02, TD-03, TD-05 — semântica do PUT (D-PRO3-03)
// ---------------------------------------------------------------------------

describe("TD-01..TD-05 — semântica do PUT (D-PRO3-03)", () => {
  it("TD-01: PUT com vigenciaInicio = hoje e grade válida, sem versões -> 200 e UMA versão aberta", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: hoje, janelas: [J(3, "09:00", "17:30"), ...MANHA, ...TARDE] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      versoes: [
        {
          vigenciaInicio: hoje,
          vigenciaFim: null,
          janelas: [J(1, "08:00", "12:00"), J(1, "13:00", "18:00"), J(3, "09:00", "17:30")],
        },
      ],
    });
    const linhas = await lerLinhas(profissionalId);
    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.vigencia_inicio === hoje && l.vigencia_fim === null)).toBe(true);
    // D-PRO3-09: nenhuma auditoria.
    expect(await totalEventos()).toBe(0);
  });

  it("TD-02: nova versão em D futuro encerra a aberta anterior em D-1 e nasce aberta", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const futuro = dataLocal(10);
    const vespera = dataLocal(9);

    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } });
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: futuro, janelas: TARDE } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      versoes: [
        { vigenciaInicio: futuro, vigenciaFim: null, janelas: TARDE },
        { vigenciaInicio: hoje, vigenciaFim: vespera, janelas: MANHA },
      ],
    });
    expect(await lerLinhas(profissionalId)).toEqual([
      expect.objectContaining({ vigencia_inicio: hoje, vigencia_fim: vespera, hora_inicio: "08:00" }),
      expect.objectContaining({ vigencia_inicio: futuro, vigencia_fim: null, hora_inicio: "13:00" }),
    ]);
  });

  it("TD-03: PUT com D anterior a uma versão futura já programada SUBSTITUI essa versão", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const d5 = dataLocal(5);
    const d20 = dataLocal(20);

    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } });
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d20, janelas: TARDE } });
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: d5, janelas: [J(5, "10:00", "11:00")] },
    });

    expect(res.status).toBe(200);
    expect(res.body.versoes.map((v: any) => [v.vigenciaInicio, v.vigenciaFim])).toEqual([
      [d5, null],
      [hoje, dataLocal(4)],
    ]);
    // A versão futura sumiu FISICAMENTE.
    const linhas = await lerLinhas(profissionalId);
    expect(linhas.some((l) => l.vigencia_inicio === d20)).toBe(false);
    expect(linhas).toHaveLength(2);
  });

  it("TD-03b: PUT com D IGUAL ao início de uma versão futura a substitui", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const d7 = dataLocal(7);
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d7, janelas: MANHA } });
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d7, janelas: TARDE } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ versoes: [{ vigenciaInicio: d7, vigenciaFim: null, janelas: TARDE }] });
    expect(await lerLinhas(profissionalId)).toHaveLength(1);
  });

  it("TD-05: janelas vazias encerram a versão anterior em D-1 e NÃO criam versão nova", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const d3 = dataLocal(3);

    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } });
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d3, janelas: [] } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ versoes: [{ vigenciaInicio: hoje, vigenciaFim: dataLocal(2), janelas: MANHA }] });
    // Nenhuma linha "de versão vazia" foi persistida (D-PRO3-01, invariante 5).
    const linhas = await lerLinhas(profissionalId);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.vigencia_fim).toBe(dataLocal(2));
  });

  it("TD-05b: janelas vazias a partir de hoje, sem versão anterior -> estado vazio e nenhuma escrita", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: [] } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ versoes: [] });
    expect(await lerLinhas(profissionalId)).toHaveLength(0);
  });

  it("o PASSADO não é reescrito: uma versão inteiramente anterior a D fica intacta", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await semear(profissionalId, "2026-01-01", "2026-03-31", TARDE);
    await semear(profissionalId, "2026-04-01", null, MANHA);
    const hoje = dataLocal();

    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: [J(5, "10:00", "11:00")] } });
    expect(res.status).toBe(200);
    expect(res.body.versoes.map((v: any) => [v.vigenciaInicio, v.vigenciaFim])).toEqual([
      [hoje, null],
      ["2026-04-01", dataLocal(-1)],
      ["2026-01-01", "2026-03-31"],
    ]);
  });

  it("TD-04: vigenciaInicio de ONTEM no fuso da clínica -> 422 VIGENCIA_RETROATIVA e ZERO mutações", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    const antes = await assinaturaFisica(profissionalId);

    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(-1), janelas: TARDE } });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_DISPONIBILIDADE.VIGENCIA_RETROATIVA });
    expect(await assinaturaFisica(profissionalId)).toEqual(antes);
  });

  it("TD-04b: a data de corte é a do FUSO DA CLÍNICA, mesmo quando o UTC já virou o dia", async () => {
    // `Pacific/Kiritimati` (UTC+14) está SEMPRE à frente do UTC: existem
    // instantes em que a data local já é "amanhã" em relação ao UTC. A data
    // local dessa clínica é a única que vale para `hoje`.
    await provisionarClinica("Pacific/Kiritimati");
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hojeLocal = dataLocal(0, "Pacific/Kiritimati");
    const hojeUtc = new Date().toISOString().slice(0, 10);

    // Aceita a data civil LOCAL, ainda que possa ser posterior à data UTC.
    const ok = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hojeLocal, janelas: MANHA } });
    expect(ok.status).toBe(200);
    expect(ok.body.versoes[0].vigenciaInicio).toBe(hojeLocal);

    // E rejeita a véspera LOCAL — mesmo quando ela ainda é "hoje" em UTC.
    const ontemLocal = dataLocal(-1, "Pacific/Kiritimati");
    const retro = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: ontemLocal, janelas: TARDE } });
    expect(retro.status).toBe(422);
    expect(retro.body).toEqual({ erro: ERRO_DISPONIBILIDADE.VIGENCIA_RETROATIVA });

    // A prova só é significativa se as duas datas puderem divergir: registramos
    // explicitamente a relação medida (local >= UTC em UTC+14).
    expect(hojeLocal >= hojeUtc).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TD-06 — validação do corpo (400 sem mutação)
// ---------------------------------------------------------------------------

describe("TD-06 — corpo inválido -> 400 REQUISICAO_INVALIDA sem mutação", () => {
  const invalidos: Array<[string, unknown]> = [
    ["sobreposição", { vigenciaInicio: "", janelas: [J(1, "08:00", "12:00"), J(1, "11:00", "13:00")] }],
    ["adjacência", { vigenciaInicio: "", janelas: [J(1, "08:00", "12:00"), J(1, "12:00", "14:00")] }],
    ["quinta janela no dia", {
      vigenciaInicio: "",
      janelas: [J(1, "08:00", "09:00"), J(1, "10:00", "11:00"), J(1, "12:00", "13:00"), J(1, "14:00", "15:00"), J(1, "16:00", "17:00")],
    }],
    ["24:00", { vigenciaInicio: "", janelas: [J(1, "08:00", "24:00")] }],
    ["segundos", { vigenciaInicio: "", janelas: [J(1, "08:00:00", "12:00:00")] }],
    ["atravessa a meia-noite", { vigenciaInicio: "", janelas: [J(1, "22:00", "02:00")] }],
    ["diaSemana fracionário", { vigenciaInicio: "", janelas: [{ diaSemana: 1.5, horaInicio: "08:00", horaFim: "12:00" }] }],
    ["janela duplicada", { vigenciaInicio: "", janelas: [J(1, "08:00", "12:00"), J(1, "08:00", "12:00")] }],
    ["chave extra na janela", { vigenciaInicio: "", janelas: [{ ...J(1, "08:00", "12:00"), obs: "x" }] }],
    ["chave extra no corpo", { vigenciaInicio: "", janelas: [], extra: 1 }],
    ["sem janelas", { vigenciaInicio: "" }],
    ["janelas nulo", { vigenciaInicio: "", janelas: null }],
    ["corpo array", []],
  ];

  it.each(invalidos)("rejeita %s", async (_titulo, corpoBase) => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const corpo =
      corpoBase !== null && !Array.isArray(corpoBase) && typeof corpoBase === "object" && "vigenciaInicio" in corpoBase
        ? { ...(corpoBase as Record<string, unknown>), vigenciaInicio: dataLocal() }
        : corpoBase;
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it.each([
    ["2026-02-30", "data civil inexistente"],
    ["2027-02-29", "29/02 em ano não bissexto"],
    ["2026-13-01", "mês 13"],
    ["2026-1-01", "mês sem zero à esquerda"],
    ["2026-10-01T00:00:00Z", "instante em vez de data civil"],
  ])("rejeita vigenciaInicio %s (%s)", async (data) => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: data, janelas: MANHA } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("corpo JSON `null` -> 400 e nenhuma mutação (corpo padrão da plataforma, limite conhecido)", async () => {
    // LIMITE JÁ VIGENTE em toda a API (ver cabeçalho de
    // `erro-profissionais.filter.ts`): o body parser rejeita `null` ANTES do
    // roteamento, então o filtro de controller não alcança a resposta. O
    // STATUS é o correto e nada é escrito — que é o que a decisão exige.
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: null });
    expect(res.status).toBe(400);
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("aceita 00:00 e 23:59 como bordas do dia", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: [J(2, "00:00", "23:59")] },
    });
    expect(res.status).toBe(200);
    expect(res.body.versoes[0].janelas).toEqual([J(2, "00:00", "23:59")]);
  });

  it("aceita 29/02 de ano bissexto como vigência futura", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: "2028-02-29", janelas: MANHA },
    });
    expect(res.status).toBe(200);
    expect(res.body.versoes[0].vigenciaInicio).toBe("2028-02-29");
  });

  it("UUID malformado no caminho -> 400, antes de qualquer leitura", async () => {
    const { cookie } = await administrador();
    expect((await requisitar("GET", "/profissionais/nao-e-uuid/disponibilidade", { cookie })).status).toBe(400);
    const put = await requisitar("PUT", "/profissionais/nao-e-uuid/disponibilidade", {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: MANHA },
    });
    expect(put.status).toBe(400);
    expect(put.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });
});

// ---------------------------------------------------------------------------
// TD-07 — no-op sem escrita
// ---------------------------------------------------------------------------

describe("TD-07 — PUT idêntico ao estado vigente: 200 sem escrita (D-PRO3-03, regra 6)", () => {
  it("nenhuma linha é criada, removida ou atualizada — provado por xmin", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: [...MANHA, ...TARDE] } });
    const antes = await assinaturaFisica(profissionalId);
    expect(antes).toHaveLength(2);

    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      // Mesma grade, ORDEM DIFERENTE: continua sendo o mesmo estado.
      corpo: { vigenciaInicio: hoje, janelas: [...TARDE, ...MANHA] },
    });
    expect(res.status).toBe(200);
    expect(res.body.versoes).toHaveLength(1);
    expect(await assinaturaFisica(profissionalId)).toEqual(antes);
  });

  it("encerramento repetido (janelas vazias) também é no-op na segunda vez", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(3), janelas: [] } });
    const antes = await assinaturaFisica(profissionalId);
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(3), janelas: [] } });
    expect(res.status).toBe(200);
    expect(await assinaturaFisica(profissionalId)).toEqual(antes);
  });

  it("grade diferente NÃO é no-op — a assinatura física muda", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } });
    const antes = await assinaturaFisica(profissionalId);
    await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: TARDE } });
    expect(await assinaturaFisica(profissionalId)).not.toEqual(antes);
  });
});

// ---------------------------------------------------------------------------
// TD-08, GET e estados vazios (D-PRO3-02, D-PRO3-10)
// ---------------------------------------------------------------------------

describe("TD-08 / GET — estados, ordenação e profissional inativo (D-PRO3-02, D-PRO3-10)", () => {
  it("profissional sem versões -> 200 { versoes: [] }", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ versoes: [] });
  });

  it("TD-08: profissional inexistente -> 404 PROFISSIONAL_NAO_ENCONTRADO no GET e no PUT", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const get = await requisitar("GET", caminho(ID_INEXISTENTE), { cookie });
    expect(get.status).toBe(404);
    expect(get.body).toEqual({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
    const put = await requisitar("PUT", caminho(ID_INEXISTENTE), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    expect(put.status).toBe(404);
    expect(put.body).toEqual({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("TD-08: profissional INATIVO pode ser consultado e alterado", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional({ ativo: false });
    const { cookie } = await administrador();
    expect((await requisitar("GET", caminho(profissionalId), { cookie })).status).toBe(200);
    const put = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    expect(put.status).toBe(200);
    expect(await lerLinhas(profissionalId)).toHaveLength(1);
  });

  it("múltiplas versões saem em vigenciaInicio DECRESCENTE e janelas em ordem canônica", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await semear(profissionalId, "2026-01-01", "2026-03-31", [J(3, "09:00", "10:00"), J(1, "14:00", "15:00"), J(1, "08:00", "09:00")]);
    await semear(profissionalId, "2026-04-01", "2026-06-30", TARDE);
    await semear(profissionalId, "2026-07-01", null, MANHA);

    const res = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(res.status).toBe(200);
    expect(res.body.versoes.map((v: any) => v.vigenciaInicio)).toEqual(["2026-07-01", "2026-04-01", "2026-01-01"]);
    expect(res.body.versoes[0].vigenciaFim).toBeNull();
    expect(res.body.versoes[2].janelas).toEqual([J(1, "08:00", "09:00"), J(1, "14:00", "15:00"), J(3, "09:00", "10:00")]);
  });

  it("a resposta não tem chave alguma além de versoes/vigenciaInicio/vigenciaFim/janelas", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await semear(profissionalId, "2026-07-01", null, MANHA);
    const res = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(Object.keys(res.body)).toEqual(["versoes"]);
    expect(Object.keys(res.body.versoes[0]).sort()).toEqual(["janelas", "vigenciaFim", "vigenciaInicio"]);
    expect(Object.keys(res.body.versoes[0].janelas[0]).sort()).toEqual(["diaSemana", "horaFim", "horaInicio"]);
  });

  it("GET NÃO exige clínica configurada (hoje só é necessário no PUT)", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    await semear(profissionalId, "2026-07-01", null, MANHA);
    const res = await requisitar("GET", caminho(profissionalId), { cookie });
    expect(res.status).toBe(200);
    expect(res.body.versoes).toHaveLength(1);
  });

  it("PUT sem linha de clínica -> 404 CLINICA_NAO_CONFIGURADA e nenhuma escrita", async () => {
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: "2030-01-01", janelas: MANHA } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
    expect(await lerLinhas()).toHaveLength(0);
  });

  it("isolamento entre profissionais: o PUT de um não toca no outro", async () => {
    await provisionarClinica();
    const a = await criarProfissional();
    const b = await criarProfissional();
    const { cookie } = await administrador();
    await requisitar("PUT", caminho(a), { cookie, corpo: { vigenciaInicio: dataLocal(), janelas: MANHA } });
    const antesB = await assinaturaFisica(b);
    await semear(b, "2026-07-01", null, TARDE);
    const marcoB = await assinaturaFisica(b);

    await requisitar("PUT", caminho(a), { cookie, corpo: { vigenciaInicio: dataLocal(5), janelas: TARDE } });
    expect(await assinaturaFisica(b)).toEqual(marcoB);
    expect(antesB).toHaveLength(0);
    const respostaB = await requisitar("GET", caminho(b), { cookie });
    expect(respostaB.body).toEqual({ versoes: [{ vigenciaInicio: "2026-07-01", vigenciaFim: null, janelas: TARDE }] });
  });

  it("D-CFG-62: a disponibilidade pode ultrapassar o horário de funcionamento da clínica, sem correção", async () => {
    const clinicaId = await provisionarClinica();
    await database.transacao(async (tx) => {
      await tx.horarioFuncionamento.create({
        data: {
          clinicaId,
          diaSemana: 1,
          horaInicio: new Date("1970-01-01T09:00:00Z"),
          horaFim: new Date("1970-01-01T17:00:00Z"),
        },
      });
    });
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    // 06:00–22:00 na segunda: muito além de 09:00–17:00 da clínica.
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: [J(1, "06:00", "22:00")] },
    });
    expect(res.status).toBe(200);
    expect(res.body.versoes[0].janelas).toEqual([J(1, "06:00", "22:00")]);
  });
});

// ---------------------------------------------------------------------------
// TD-10 — concorrência (D-PRO3-07)
// ---------------------------------------------------------------------------

describe("TD-10 — concorrência serializada pelo lock do profissional (D-PRO3-07)", () => {
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

  it("o PUT ESPERA o lock da linha do profissional antes de ler qualquer versão", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();

    // O concorrente, sob o lock, insere a MESMA versão que o PUT vai pedir.
    const { liberar, bloqueador } = await comLockNoProfissional(profissionalId, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO disponibilidade_profissional
           (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
         VALUES ($1::uuid, $2::uuid, 1, '08:00'::time, '12:00'::time, $3::date, NULL)`,
        randomUUID(),
        profissionalId,
        hoje,
      ),
    );

    let concluido = false;
    const put = requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } }).then((r) => {
      concluido = true;
      return r;
    });

    expect(await esperarAlguemBloqueado()).toBeGreaterThanOrEqual(1);
    expect(concluido).toBe(false);
    liberar();
    await bloqueador;

    const marco = await assinaturaFisica(profissionalId);
    const res = await put;
    expect(res.status).toBe(200);
    // Sem `FOR UPDATE`, o PUT teria lido "sem versões", não detectaria o no-op
    // e inseriria uma SEGUNDA linha idêntica — duas versões sobrepostas.
    expect(await assinaturaFisica(profissionalId)).toEqual(marco);
    expect(await lerLinhas(profissionalId)).toHaveLength(1);
  });

  it("dois PUT concorrentes no mesmo profissional são serializados e o estado final é válido", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const d5 = dataLocal(5);

    const [a, b] = await Promise.all([
      requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } }),
      requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d5, janelas: TARDE } }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);

    const versoes = (await requisitar("GET", caminho(profissionalId), { cookie })).body.versoes as Array<{
      vigenciaInicio: string;
      vigenciaFim: string | null;
    }>;

    // Invariantes de D-PRO3-01, qualquer que tenha sido a ordem de execução:
    // (1) versões não se sobrepõem; (2) no máximo UMA aberta; (3) a aberta é a
    // de maior vigenciaInicio.
    const abertas = versoes.filter((v) => v.vigenciaFim === null);
    expect(abertas.length).toBeLessThanOrEqual(1);
    if (abertas.length === 1) {
      expect(abertas[0]?.vigenciaInicio).toBe(versoes[0]?.vigenciaInicio);
    }
    for (let i = 0; i < versoes.length - 1; i++) {
      const recente = versoes[i] as { vigenciaInicio: string; vigenciaFim: string | null };
      const anterior = versoes[i + 1] as { vigenciaInicio: string; vigenciaFim: string | null };
      expect(anterior.vigenciaInicio < recente.vigenciaInicio).toBe(true);
      expect(anterior.vigenciaFim).not.toBeNull();
      expect(anterior.vigenciaFim! < recente.vigenciaInicio).toBe(true);
    }
    expect(await totalEventos()).toBe(0);
  });

  it("dois PUT concorrentes com a MESMA vigência: última escrita válida prevalece, sem duplicar versão", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();

    await Promise.all([
      requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: MANHA } }),
      requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: hoje, janelas: TARDE } }),
    ]);

    const linhas = await lerLinhas(profissionalId);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.vigencia_fim).toBeNull();
    expect(["08:00", "13:00"]).toContain(linhas[0]?.hora_inicio);
  });
});

// ---------------------------------------------------------------------------
// TD-12 — agendamentos existentes (D-PRO3-05)
// ---------------------------------------------------------------------------

describe("TD-12 — alteração de disponibilidade não toca em agendamentos (D-PRO3-05)", () => {
  it("o agendamento existente permanece BYTE A BYTE o mesmo após um PUT que o deixaria fora da grade", async () => {
    // LIMITE DECLARADO: a fatia de agenda (AGD-A, T-01) ainda não existe — não
    // há rota de criação/remarcação. A prova é PROPORCIONAL ao que existe: o
    // agendamento é criado diretamente na persistência e se mostra intacto, com
    // `xmin` inalterado, depois do PUT.
    const clinicaId = await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();

    const agendamentoId = await database.transacao(async (tx) => {
      const paciente = await tx.paciente.create({
        data: { nome: "Paciente Sintético PRO-003", ativo: true },
        select: { id: true },
      });
      const servico = await tx.servico.create({
        data: { clinicaId, nome: "Serviço Sintético PRO-003", duracaoMin: 60, precoReferencia: "100.00", ativo: true },
        select: { id: true },
      });
      const a = await tx.agendamento.create({
        data: {
          pacienteId: paciente.id,
          profissionalId,
          servicoId: servico.id,
          inicio: new Date("2026-10-05T11:00:00Z"),
          fim: new Date("2026-10-05T12:00:00Z"),
          estado: "AGENDADO",
          modalidade: "AVULSO",
          criadoPorUsuarioId: (await tx.usuario.findFirstOrThrow({ select: { id: true } })).id,
        },
        select: { id: true },
      });
      return a.id;
    });

    const antes = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ estado: string; inicio: Date; fim: Date; x: string }>>`
        SELECT estado::text AS estado, inicio, fim, xmin::text AS x
          FROM agendamento WHERE id = ${agendamentoId}::uuid`,
    );

    // Nova versão que NÃO cobre o horário do agendamento existente.
    const res = await requisitar("PUT", caminho(profissionalId), {
      cookie,
      corpo: { vigenciaInicio: dataLocal(), janelas: [J(5, "06:00", "07:00")] },
    });
    expect(res.status).toBe(200);

    const depois = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ estado: string; inicio: Date; fim: Date; x: string }>>`
        SELECT estado::text AS estado, inicio, fim, xmin::text AS x
          FROM agendamento WHERE id = ${agendamentoId}::uuid`,
    );
    expect(depois).toEqual(antes);
    // Nenhum histórico, nenhum evento — o PUT nem consultou a agenda.
    const historico = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM historico_agendamento`,
    );
    expect(Number(historico[0]?.n ?? 0)).toBe(0);
    expect(await totalEventos()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TD-13 — invariantes FÍSICAS (D-PRO3-06)
// ---------------------------------------------------------------------------

describe("TD-13 — o BANCO rejeita estados incoerentes (D-PRO3-06)", () => {
  async function erroSql(sql: () => Promise<unknown>): Promise<string> {
    try {
      await sql();
    } catch (e) {
      return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    throw new Error("a violação esperada não ocorreu");
  }

  it("vigencia_inicio NULL é rejeitada pelo banco (NOT NULL)", async () => {
    const profissionalId = await criarProfissional();
    const mensagem = await erroSql(() =>
      database.transacao((tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO disponibilidade_profissional
             (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
           VALUES ($1::uuid, $2::uuid, 1, '08:00'::time, '12:00'::time, NULL, NULL)`,
          randomUUID(),
          profissionalId,
        ),
      ),
    );
    expect(mensagem).toMatch(/null value in column "vigencia_inicio"|not-null|23502/i);
    expect(await lerLinhas(profissionalId)).toHaveLength(0);
  });

  it("vigencia_fim < vigencia_inicio é rejeitada por ck_disponibilidade_profissional_vigencia", async () => {
    const profissionalId = await criarProfissional();
    const mensagem = await erroSql(() =>
      database.transacao((tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO disponibilidade_profissional
             (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
           VALUES ($1::uuid, $2::uuid, 1, '08:00'::time, '12:00'::time, '2026-10-10'::date, '2026-10-09'::date)`,
          randomUUID(),
          profissionalId,
        ),
      ),
    );
    expect(mensagem).toContain("ck_disponibilidade_profissional_vigencia");
    expect(await lerLinhas(profissionalId)).toHaveLength(0);
  });

  it("o índice ix_disponibilidade_profissional_vigencia existe em (profissional_id, vigencia_inicio)", async () => {
    const linhas = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ definicao: string }>>`
        SELECT indexdef AS definicao FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'disponibilidade_profissional'
           AND indexname = 'ix_disponibilidade_profissional_vigencia'`,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.definicao).toContain("(profissional_id, vigencia_inicio)");
  });

  it("rollback integral: falha APÓS o DELETE e o UPDATE não deixa escrita parcial", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const { cookie } = await administrador();
    const hoje = dataLocal();
    const d5 = dataLocal(5);

    // Estado que obriga o PUT a executar as TRÊS escritas: DELETE da versão
    // futura, UPDATE da anterior e INSERT da nova.
    await semear(profissionalId, "2026-01-01", null, MANHA);
    await semear(profissionalId, dataLocal(20), null, TARDE);
    const antes = await assinaturaFisica(profissionalId);
    expect(antes).toHaveLength(2);

    // Falha injetada no TERCEIRO `$executeRaw` da transação — isto é, no
    // primeiro INSERT, depois de o DELETE e o UPDATE já terem ocorrido.
    const original = database.transacao.bind(database);
    const espia = jest
      .spyOn(database, "transacao")
      .mockImplementation(((corpo: (tx: any) => Promise<unknown>) =>
        original(async (tx: any) => {
          let escritas = 0;
          const observado = new Proxy(tx, {
            get(alvo: any, prop: string | symbol, receptor: unknown) {
              const valor = Reflect.get(alvo, prop, receptor);
              if (prop === "$executeRaw" && typeof valor === "function") {
                return (...args: unknown[]) => {
                  escritas += 1;
                  if (escritas === 3) throw new Error("FALHA_SIMULADA_ANTES_DO_INSERT");
                  return (valor as (...a: unknown[]) => unknown).apply(alvo, args);
                };
              }
              return typeof valor === "function" ? (valor as Function).bind(alvo) : valor;
            },
          });
          return corpo(observado);
        })) as typeof database.transacao);

    let res: RespostaHttp;
    try {
      res = await requisitar("PUT", caminho(profissionalId), { cookie, corpo: { vigenciaInicio: d5, janelas: [...MANHA, ...TARDE] } });
    } finally {
      espia.mockRestore();
    }

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
    // O DELETE e o UPDATE foram desfeitos junto com o INSERT que falhou.
    expect(await assinaturaFisica(profissionalId)).toEqual(antes);
    const versoes = (await requisitar("GET", caminho(profissionalId), { cookie })).body.versoes;
    expect(versoes.map((v: any) => [v.vigenciaInicio, v.vigenciaFim])).toEqual([
      [dataLocal(20), null],
      ["2026-01-01", null],
    ]);
    expect(hoje <= d5).toBe(true);
  });
});
