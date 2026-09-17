// TechLab Fisio — integração contra PostgreSQL REAL da configuração dos dados
// da clínica única (fatia CFG-001A; `docs/14` D-CFG-01..D-CFG-08; CA-01..CA-17).
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

const CLINICA_INICIAL = {
  nomeCadastral: "Clínica Sintética Inicial Ltda.",
  nomeOperacional: null,
  endereco: null,
  telefone: null,
  email: null,
  fusoHorario: "America/Sao_Paulo",
} as const;

function corpoValido(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nomeCadastral: "Clínica Sintética Atualizada Ltda.",
    nomeOperacional: "Clínica Sintética",
    endereco: "Rua Sintética, 100",
    telefone: "(11) 0000-0000",
    email: "contato@clinica.exemplo",
    fusoHorario: "America/Manaus",
    ...sobrescrever,
  };
}

async function provisionarClinica(): Promise<string> {
  return database.transacao(async (tx) => {
    const c = await tx.clinica.create({ data: { ...CLINICA_INICIAL }, select: { id: true } });
    return c.id;
  });
}

async function criarUsuario(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `cfg-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-cfg",
        nome: "Usuário Sintético CFG",
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
  opcoes: { cookie?: string; corpo?: unknown; csrf?: boolean; caminho?: string } = {},
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
  const res = await fetch(`${baseUrl}${opcoes.caminho ?? "/clinica"}`, {
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

interface LinhaClinica {
  id: string;
  nome_cadastral: string;
  nome_operacional: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  fuso_horario: string;
  logotipo_chave: string | null;
  duracao_padrao_atendimento_min: number | null;
}

async function lerClinicas(): Promise<LinhaClinica[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaClinica[]>`
      SELECT id, nome_cadastral, nome_operacional, endereco, telefone, email, fuso_horario,
             logotipo_chave, duracao_padrao_atendimento_min
        FROM clinica`,
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

describe("CFG-001A — autenticação, autorização e CSRF", () => {
  it("CA-03: sem sessão, GET e PUT retornam 401 SESSAO_INVALIDA sem mutação nem evento", async () => {
    await provisionarClinica();
    const antes = await lerClinicas();

    const get = await requisitar("GET");
    expect(get.status).toBe(401);
    expect(get.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const put = await requisitar("PUT", { corpo: corpoValido() });
    expect(put.status).toBe(401);
    expect(put.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    expect(await lerClinicas()).toEqual(antes);
    expect(await eventosConfiguracao()).toHaveLength(0);
  });

  it("CA-04: autenticado sem clinica.configurar recebe 403 ACESSO_NEGADO em GET e PUT, sem mutação nem evento", async () => {
    await provisionarClinica();
    const antes = await lerClinicas();
    const operador = await criarUsuario();
    await darPermissao(operador, "usuarios.gerenciar");
    const cookie = await cookieDe(operador);

    const get = await requisitar("GET", { cookie });
    expect(get.status).toBe(403);
    expect(get.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    const put = await requisitar("PUT", { cookie, corpo: corpoValido() });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    expect(await lerClinicas()).toEqual(antes);
    expect(await totalEventos()).toBe(0);
  });

  it("CA-05: PUT sem x-tlf-requisicao retorna 403 REQUISICAO_NAO_AUTORIZADA sem mutação", async () => {
    await provisionarClinica();
    const antes = await lerClinicas();
    const { cookie } = await administrador();

    const put = await requisitar("PUT", { cookie, corpo: corpoValido(), csrf: false });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    expect(await lerClinicas()).toEqual(antes);
    expect(await eventosConfiguracao()).toHaveLength(0);
  });

  it("CA-05: a CSRF é avaliada antes da sessão (sem cookie e sem header -> 403)", async () => {
    const put = await requisitar("PUT", { corpo: corpoValido(), csrf: false });
    expect(put.status).toBe(403);
    expect(put.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
  });

  it("GET não exige o header CSRF", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const get = await requisitar("GET", { cookie });
    expect(get.status).toBe(200);
  });
});

describe("CFG-001A — consulta", () => {
  it("CA-01: GET retorna 200 com exatamente os 7 campos e Cache-Control no-store", async () => {
    const id = await provisionarClinica();
    const { cookie } = await administrador();

    const res = await requisitar("GET", { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body).toEqual({ id, ...CLINICA_INICIAL });
    expect(Object.keys(res.body).sort()).toEqual(
      ["email", "endereco", "fusoHorario", "id", "nomeCadastral", "nomeOperacional", "telefone"],
    );
  });

  it("GET não emite evento de auditoria", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    await requisitar("GET", { cookie });
    expect(await totalEventos()).toBe(0);
  });

  it("CA-13: sem linha provisionada, GET e PUT retornam 404 CLINICA_NAO_CONFIGURADA e nada é criado", async () => {
    const { cookie } = await administrador();

    const get = await requisitar("GET", { cookie });
    expect(get.status).toBe(404);
    expect(get.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });

    const put = await requisitar("PUT", { cookie, corpo: corpoValido() });
    expect(put.status).toBe(404);
    expect(put.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });

    expect(await lerClinicas()).toHaveLength(0);
    expect(await totalEventos()).toBe(0);
  });
});

describe("CFG-001A — atualização", () => {
  it("CA-02 / CA-09 / CA-10: PUT válido persiste, responde o estado vigente e emite 1 evento sem valores", async () => {
    const id = await provisionarClinica();
    const admin = await administrador();
    const corpo = corpoValido();

    const res = await requisitar("PUT", { cookie: admin.cookie, corpo });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, ...corpo });

    const [linha] = await lerClinicas();
    expect(linha).toEqual({
      id,
      nome_cadastral: corpo["nomeCadastral"],
      nome_operacional: corpo["nomeOperacional"],
      endereco: corpo["endereco"],
      telefone: corpo["telefone"],
      email: corpo["email"],
      fuso_horario: corpo["fusoHorario"],
      logotipo_chave: null,
      duracao_padrao_atendimento_min: null,
    });

    const eventos = await eventosConfiguracao();
    expect(eventos).toHaveLength(1);
    const evento = eventos[0] as LinhaEvento;
    expect(evento).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: admin.id,
      alvo_tipo: "clinica",
      alvo_id: id,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(evento.contexto === null || JSON.stringify(evento.contexto) === "{}").toBe(true);

    const serializado = JSON.stringify(evento);
    for (const valor of Object.values(corpo)) {
      expect(serializado).not.toContain(String(valor));
    }
  });

  it("D-CFG-04: normaliza trim e opcionais vazios para null antes de persistir", async () => {
    const id = await provisionarClinica();
    const { cookie } = await administrador();

    const res = await requisitar("PUT", {
      cookie,
      corpo: {
        nomeCadastral: "  Clínica Aparada  ",
        nomeOperacional: "   ",
        endereco: "",
        telefone: null,
        email: " contato@clinica.exemplo ",
        fusoHorario: "UTC",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id,
      nomeCadastral: "Clínica Aparada",
      nomeOperacional: null,
      endereco: null,
      telefone: null,
      email: "contato@clinica.exemplo",
      fusoHorario: "UTC",
    });
    const [linha] = await lerClinicas();
    expect(linha?.nome_cadastral).toBe("Clínica Aparada");
    expect(linha?.nome_operacional).toBeNull();
  });

  it("D-CFG-08: a troca de fuso é permitida e persistida", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", { cookie, corpo: corpoValido({ fusoHorario: "Europe/Lisbon" }) });
    expect(res.status).toBe(200);
    expect((await lerClinicas())[0]?.fuso_horario).toBe("Europe/Lisbon");
  });

  it("CA-12: PUT sem alteração efetiva retorna 200 sem UPDATE e sem evento", async () => {
    const id = await provisionarClinica();
    const { cookie } = await administrador();

    const res = await requisitar("PUT", { cookie, corpo: { ...CLINICA_INICIAL } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, ...CLINICA_INICIAL });
    expect(await eventosConfiguracao()).toHaveLength(0);

    // no-op após normalização (trim) também não audita
    const res2 = await requisitar("PUT", {
      cookie,
      corpo: { ...CLINICA_INICIAL, nomeCadastral: `  ${CLINICA_INICIAL.nomeCadastral}  `, email: "" },
    });
    expect(res2.status).toBe(200);
    expect(await eventosConfiguracao()).toHaveLength(0);
  });

  it("CA-12: o no-op não executa UPDATE (xmin da linha inalterado)", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const xmin = async () =>
      (await database.transacao((tx) => tx.$queryRaw<Array<{ x: string }>>`SELECT xmin::text AS x FROM clinica`))[0]?.x;

    const antes = await xmin();
    await requisitar("PUT", { cookie, corpo: { ...CLINICA_INICIAL } });
    expect(await xmin()).toBe(antes);

    await requisitar("PUT", { cookie, corpo: corpoValido() });
    expect(await xmin()).not.toBe(antes);
  });
});

describe("CFG-001A — validação e segurança do corpo", () => {
  const invalidos: Array<[string, unknown]> = [
    ["CA-06 chave extra id", corpoValido({ id: "123e4567-e89b-12d3-a456-426614174000" })],
    ["CA-06 chave extra logotipoChave", corpoValido({ logotipoChave: "logos/x.png" })],
    ["CA-06 chave extra duracaoPadraoAtendimentoMin", corpoValido({ duracaoPadraoAtendimentoMin: 50 })],
    ["CA-06 chave extra atorUsuarioId", corpoValido({ atorUsuarioId: "123e4567-e89b-12d3-a456-426614174000" })],
    ["CA-06 chave ausente", (() => { const c = corpoValido(); delete c["telefone"]; return c; })()],
    ["CA-06 tipo errado", corpoValido({ telefone: 11999999999 })],
    ["CA-06 array no lugar de objeto", [corpoValido()]],
    ["CA-07 fuso inexistente", corpoValido({ fusoHorario: "Foo/Bar" })],
    ["CA-07 fuso em caixa errada", corpoValido({ fusoHorario: "america/sao_paulo" })],
    ["CA-08 nomeCadastral vazio", corpoValido({ nomeCadastral: "   " })],
    ["D-CFG-04 nomeCadastral acima de 200", corpoValido({ nomeCadastral: "a".repeat(201) })],
    ["D-CFG-04 e-mail estruturalmente inválido", corpoValido({ email: "sem-arroba" })],
  ];

  it.each(invalidos)("%s -> 400 REQUISICAO_INVALIDA sem mutação nem evento", async (_rotulo, corpo) => {
    await provisionarClinica();
    const antes = await lerClinicas();
    const { cookie } = await administrador();

    const res = await requisitar("PUT", { cookie, corpo });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerClinicas()).toEqual(antes);
    expect(await totalEventos()).toBe(0);
  });

  it("id no corpo não altera o identificador da clínica mesmo quando igual ao atual", async () => {
    const id = await provisionarClinica();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", { cookie, corpo: corpoValido({ id }) });
    expect(res.status).toBe(400);
    expect((await lerClinicas())[0]?.id).toBe(id);
  });

  it("corpo acima do limite do parser retorna 413 sem mutação", async () => {
    await provisionarClinica();
    const antes = await lerClinicas();
    const { cookie } = await administrador();
    const res = await requisitar("PUT", {
      cookie,
      corpo: JSON.stringify(corpoValido({ endereco: "x".repeat(200_000) })),
    });
    expect(res.status).toBe(413);
    expect(await lerClinicas()).toEqual(antes);
    expect(await totalEventos()).toBe(0);
  });
});

describe("CFG-001A — atomicidade, concorrência e invariante física", () => {
  it("CA-11: falha na escrita da auditoria -> 500 FALHA_INTERNA e rollback conjunto", async () => {
    await provisionarClinica();
    const antes = await lerClinicas();
    const { cookie } = await administrador();

    const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      const res = await requisitar("PUT", { cookie, corpo: corpoValido() });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      expect(JSON.stringify(res.body)).not.toContain("FALHA_SIMULADA");
    } finally {
      espia.mockRestore();
    }

    expect(await lerClinicas()).toEqual(antes);
    expect(await totalEventos()).toBe(0);
  });

  it("CA-14: o banco rejeita uma segunda linha em clinica (23505, ux_clinica_linha_unica)", async () => {
    await provisionarClinica();
    let erro: unknown;
    try {
      await database.transacao((tx) =>
        tx.$executeRaw`INSERT INTO clinica (id, nome_cadastral, fuso_horario) VALUES (gen_random_uuid(), 'Segunda Sintética', 'UTC')`,
      );
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeDefined();
    const texto = JSON.stringify(erro, Object.getOwnPropertyNames(erro as object));
    expect(texto).toContain("23505");
    expect(texto).toContain("ux_clinica_linha_unica");
    expect(await lerClinicas()).toHaveLength(1);
  });

  it("CA-15: o PUT lê SOB o lock (SELECT ... FOR UPDATE) — enxerga a escrita concorrente, sem leitura obsoleta", async () => {
    await provisionarClinica();
    const { cookie } = await administrador();
    const corpo = corpoValido({ nomeCadastral: "Estado Gravado pelo Concorrente" });

    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let lockAdquirido!: () => void;
    const adquirido = new Promise<void>((r) => (lockAdquirido = r));

    // Concorrente retém o lock e grava EXATAMENTE o estado que o PUT enviará.
    const bloqueador = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM clinica FOR UPDATE`;
      lockAdquirido();
      await barreira;
      await tx.$executeRaw`
        UPDATE clinica
           SET nome_cadastral = ${corpo["nomeCadastral"] as string},
               nome_operacional = ${corpo["nomeOperacional"] as string},
               endereco = ${corpo["endereco"] as string},
               telefone = ${corpo["telefone"] as string},
               email = ${corpo["email"] as string},
               fuso_horario = ${corpo["fusoHorario"] as string}`;
    });
    await adquirido;

    let concluido = false;
    const put = requisitar("PUT", { cookie, corpo }).then((r) => {
      concluido = true;
      return r;
    });

    // Prova de bloqueio real: uma sessão fica em espera de Lock.
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

    // Com o lock, a leitura do PUT ocorre DEPOIS do commit concorrente: o
    // estado já é o pedido, logo é no-op (D-CFG-06) — nenhum evento. Uma
    // leitura sem lock compararia com o estado anterior e auditaria.
    expect((await lerClinicas())[0]?.nome_cadastral).toBe("Estado Gravado pelo Concorrente");
    expect(await eventosConfiguracao()).toHaveLength(0);
  });

  it("CA-15: dois PUTs concorrentes serializam — estado final igual a um deles e 2 eventos, sem escrita parcial", async () => {
    await provisionarClinica();
    const a = await administrador();
    const b = await administrador();
    const corpoA = corpoValido({ nomeCadastral: "Versão A", fusoHorario: "UTC" });
    const corpoB = corpoValido({ nomeCadastral: "Versão B", fusoHorario: "Europe/Lisbon" });

    const [ra, rb] = await Promise.all([
      requisitar("PUT", { cookie: a.cookie, corpo: corpoA }),
      requisitar("PUT", { cookie: b.cookie, corpo: corpoB }),
    ]);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);

    const [linha] = await lerClinicas();
    const final = { nome: linha?.nome_cadastral, fuso: linha?.fuso_horario };
    expect([
      { nome: "Versão A", fuso: "UTC" },
      { nome: "Versão B", fuso: "Europe/Lisbon" },
    ]).toContainEqual(final);

    const eventos = await eventosConfiguracao();
    expect(eventos).toHaveLength(2);
    expect(new Set(eventos.map((e) => e.ator_usuario_id))).toEqual(new Set([a.id, b.id]));
    expect(new Set(eventos.map((e) => e.correlacao_id)).size).toBe(2);
  });
});
