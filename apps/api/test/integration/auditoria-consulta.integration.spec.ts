// TechLab Fisio — AUD-004 / `PBACK-AUD-08` (`docs/09` §13.9) — integração
// contra PostgreSQL REAL da consulta da trilha de auditoria.
//
// Eventos SINTÉTICOS inseridos diretamente em `evento_auditoria`; nenhum dado
// real. Prova RBAC (401/403/200), cada filtro, combinação, paginação sem perda
// nem duplicidade sob empate de `ocorrido_em`, rejeição de filtros proibidos,
// ausência de dados resolvidos do ator/alvo e ausência de auto-auditoria.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { ERRO } from "../../src/auth/auth.dto.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { SessaoService } from "../../src/auth/sessao.service.js";
import { ERRO_AUTORIZACAO } from "../../src/authz/erro-autorizacao.js";
import { DatabaseService } from "../../src/database/database.service.js";

jest.setTimeout(120_000);

let moduleRef: TestingModule;
let app: INestApplication;
let baseUrl: string;
let database: DatabaseService;
let sessoes: SessaoService;
let politicaCookie: PoliticaCookieSessao;
let hashDaSenha: string;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = await app.getUrl();
  database = moduleRef.get(DatabaseService);
  sessoes = moduleRef.get(SessaoService);
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
  hashDaSenha = await moduleRef.get(CredencialService).gerarHash("senha-sintetica-aud004");
}, 180_000);

afterAll(async () => {
  await app.close();
});

const NOME_ATOR = "Pessoa Sintetica Ator Aud004";

async function criarUsuario(): Promise<{ id: string; email: string }> {
  const email = `aud004-${randomUUID().slice(0, 8)}@sintetico.local`;
  const u = await database.transacao((tx) =>
    tx.usuario.create({
      data: { email, senhaHash: hashDaSenha, nome: NOME_ATOR, ativo: true },
      select: { id: true },
    }),
  );
  return { id: u.id, email };
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

async function administradorAuditor(): Promise<{ id: string; email: string; cookie: string }> {
  const u = await criarUsuario();
  await darPermissao(u.id, "auditoria.ler");
  return { ...u, cookie: await cookieDe(u.id) };
}

interface EventoSintetico {
  id?: string;
  ocorridoEm: Date;
  atorUsuarioId?: string | null;
  acao?: string;
  alvoTipo?: string;
  alvoId?: string | null;
  resultado?: string;
  correlacaoId?: string;
  justificativa?: string | null;
}

async function inserir(eventos: EventoSintetico[]): Promise<string[]> {
  return database.transacao(async (tx) => {
    const ids: string[] = [];
    for (const e of eventos) {
      const criado = await tx.eventoAuditoria.create({
        data: {
          ...(e.id !== undefined ? { id: e.id } : {}),
          ocorridoEm: e.ocorridoEm,
          atorUsuarioId: e.atorUsuarioId ?? null,
          acao: e.acao ?? "usuario.autenticacao",
          alvoTipo: e.alvoTipo ?? "usuario",
          alvoId: e.alvoId ?? null,
          resultado: e.resultado ?? "SUCESSO",
          justificativa: e.justificativa ?? null,
          correlacaoId: e.correlacaoId ?? randomUUID(),
        },
        select: { id: true },
      });
      ids.push(criado.id);
    }
    return ids;
  });
}

async function consultar(
  query: string,
  cookie?: string,
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${baseUrl}/auditoria/eventos${query}`, {
    method: "GET",
    headers: {
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      ...(cookie !== undefined ? { cookie } : {}),
    },
  });
  const texto = await res.text();
  let body: any = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* corpo não JSON */
  }
  return { status: res.status, body, headers: res.headers };
}

async function contarEventos(): Promise<number> {
  return database.transacao((tx) => tx.eventoAuditoria.count());
}

const T0 = new Date("2026-08-25T10:00:00.000Z");
const HORA = 3_600_000;
const em = (horas: number): Date => new Date(T0.getTime() + horas * HORA);

describe("AUD-004 — RBAC", () => {
  it("sem sessão → 401 SESSAO_INVALIDA", async () => {
    const r = await consultar("");
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("cookie com token inválido → 401", async () => {
    const r = await consultar("", `${politicaCookie.nome}=token-invalido`);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("sessão válida sem auditoria.ler (mesmo com outra permissão administrativa) → 403 ACESSO_NEGADO, sem dados", async () => {
    await inserir([{ ocorridoEm: T0 }]);
    const u = await criarUsuario();
    await darPermissao(u.id, "usuarios.gerenciar");
    const r = await consultar("", await cookieDe(u.id));
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
  });

  it("autorizado → 200 com Cache-Control: no-store; parâmetro do cliente não substitui identidade", async () => {
    const admin = await administradorAuditor();
    const semPermissao = await criarUsuario();
    await inserir([{ ocorridoEm: T0 }]);
    // o cliente não consegue "vestir" outra identidade: sessão sem permissão continua 403
    const negado = await consultar(`?atorUsuarioId=${admin.id}`, await cookieDe(semPermissao.id));
    expect(negado.status).toBe(403);
    const r = await consultar("", admin.cookie);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.body.itens).toHaveLength(1);
  });

  it("métodos de escrita não existem na rota (AUD-005)", async () => {
    const admin = await administradorAuditor();
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await fetch(`${baseUrl}/auditoria/eventos`, {
        method,
        headers: { cookie: admin.cookie, "x-tlf-requisicao": "1", "sec-fetch-site": "same-origin" },
      });
      expect(res.status).toBe(404);
    }
  });
});

describe("AUD-004 — lista e filtros", () => {
  it("lista autorizada devolve SÓ colunas próprias, ordem (ocorridoEm DESC, id DESC)", async () => {
    const admin = await administradorAuditor();
    const alvo = randomUUID();
    const correlacao = randomUUID();
    const [antigo, recente] = await inserir([
      { ocorridoEm: em(0), atorUsuarioId: admin.id, alvoId: alvo, correlacaoId: correlacao },
      {
        ocorridoEm: em(1),
        atorUsuarioId: admin.id,
        acao: "usuario.situacao.alterada",
        alvoId: alvo,
        correlacaoId: correlacao,
      },
    ]);
    const r = await consultar("", admin.cookie);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      itens: [
        {
          id: recente,
          ocorridoEm: em(1).toISOString(),
          atorUsuarioId: admin.id,
          acao: "usuario.situacao.alterada",
          alvoTipo: "usuario",
          alvoId: alvo,
          resultado: "SUCESSO",
          correlacaoId: correlacao,
          contexto: null,
        },
        {
          id: antigo,
          ocorridoEm: em(0).toISOString(),
          atorUsuarioId: admin.id,
          acao: "usuario.autenticacao",
          alvoTipo: "usuario",
          alvoId: alvo,
          resultado: "SUCESSO",
          correlacaoId: correlacao,
          contexto: null,
        },
      ],
      proximoCursor: null,
    });
  });

  it("nenhum dado pessoal do ator ou do alvo é resolvido (sem join/expansão)", async () => {
    const admin = await administradorAuditor();
    const alvo = await criarUsuario();
    await inserir([{ ocorridoEm: T0, atorUsuarioId: admin.id, alvoTipo: "usuario", alvoId: alvo.id }]);
    const r = await consultar("", admin.cookie);
    const texto = JSON.stringify(r.body);
    expect(texto).not.toContain(NOME_ATOR);
    expect(texto).not.toContain(admin.email);
    expect(texto).not.toContain(alvo.email);
    expect(texto).not.toMatch(/senha|hash|email|nome|ator"|alvo"/i);
    expect(Object.keys(r.body.itens[0]).sort()).toEqual([
      "acao",
      "alvoId",
      "alvoTipo",
      "atorUsuarioId",
      "contexto",
      "correlacaoId",
      "id",
      "ocorridoEm",
      "resultado",
    ]);
  });

  it("filtros individuais, combinação e página vazia", async () => {
    const admin = await administradorAuditor();
    const outro = await criarUsuario();
    const alvoA = randomUUID();
    const alvoB = randomUUID();
    const corr = randomUUID();
    const ids = await inserir([
      { ocorridoEm: em(0), atorUsuarioId: admin.id, acao: "usuario.autenticacao", alvoTipo: "usuario", alvoId: alvoA, resultado: "SUCESSO", correlacaoId: corr },
      { ocorridoEm: em(1), atorUsuarioId: outro.id, acao: "usuario.autenticacao", alvoTipo: "usuario", alvoId: alvoB, resultado: "FALHA" },
      { ocorridoEm: em(2), atorUsuarioId: admin.id, acao: "autorizacao.negada", alvoTipo: "permissao", alvoId: alvoB, resultado: "NEGADO", correlacaoId: corr },
      { ocorridoEm: em(3), atorUsuarioId: null, acao: "configuracao.alterada", alvoTipo: "configuracao", alvoId: null, resultado: "SUCESSO" },
    ]);
    const [e0, e1, e2, e3] = ids as [string, string, string, string];
    const ids$ = async (q: string): Promise<string[]> => {
      const r = await consultar(q, admin.cookie);
      expect(r.status).toBe(200);
      return r.body.itens.map((i: { id: string }) => i.id);
    };

    expect(await ids$("")).toEqual([e3, e2, e1, e0]);
    // período (inclusivo nas duas pontas, com offset explícito)
    expect(await ids$(`?ocorridoDe=${encodeURIComponent(em(1).toISOString())}`)).toEqual([e3, e2, e1]);
    expect(await ids$(`?ocorridoAte=${encodeURIComponent(em(1).toISOString())}`)).toEqual([e1, e0]);
    expect(
      await ids$(`?ocorridoDe=${encodeURIComponent("2026-08-25T08:00:00-03:00")}&ocorridoAte=${encodeURIComponent(em(2).toISOString())}`),
    ).toEqual([e2, e1]);
    expect(await ids$(`?atorUsuarioId=${admin.id}`)).toEqual([e2, e0]);
    expect(await ids$("?acao=autorizacao.negada")).toEqual([e2]);
    expect(await ids$("?alvoTipo=usuario")).toEqual([e1, e0]);
    expect(await ids$(`?alvoId=${alvoB}`)).toEqual([e2, e1]);
    expect(await ids$(`?correlacaoId=${corr}`)).toEqual([e2, e0]);
    expect(await ids$("?resultado=FALHA")).toEqual([e1]);
    expect(await ids$(`?atorUsuarioId=${admin.id}&correlacaoId=${corr}&resultado=NEGADO&alvoTipo=permissao`)).toEqual([e2]);
    // página vazia
    const vazia = await consultar(`?acao=pagamento.estornado`, admin.cookie);
    expect(vazia.status).toBe(200);
    expect(vazia.body).toEqual({ itens: [], proximoCursor: null });
    expect(await ids$(`?atorUsuarioId=${randomUUID()}`)).toEqual([]);
  });
});

describe("AUD-004 — justificativa omitida (decisão de 17/09/2026)", () => {
  it("evento com justificativa preenchida: o texto e a chave não aparecem na resposta", async () => {
    const admin = await administradorAuditor();
    const TEXTO = "Justificativa sintetica com Nome Paciente Ficticio e CID Z99";
    await inserir([{ ocorridoEm: T0, acao: "usuario.papeis.alterados", justificativa: TEXTO }]);
    const r = await consultar("", admin.cookie);
    expect(r.status).toBe(200);
    expect(r.body.itens).toHaveLength(1);
    expect(r.body.itens[0]).not.toHaveProperty("justificativa");
    expect(JSON.stringify(r.body)).not.toContain(TEXTO);
    expect(JSON.stringify(r.body)).not.toContain("Paciente");
  });
});

describe("AUD-004 — paginação", () => {
  it("empate de ocorrido_em: nenhuma perda nem duplicidade entre páginas; ordem determinística", async () => {
    const admin = await administradorAuditor();
    // ids v4 aleatórios inseridos em ordem aleatória: a ordem física de
    // inserção NÃO coincide com a ordem por id — o desempate precisa existir.
    const lote: EventoSintetico[] = [];
    for (let i = 0; i < 17; i += 1) lote.push({ ocorridoEm: T0, id: randomUUID() });
    for (let i = 0; i < 4; i += 1) lote.push({ ocorridoEm: em(1), id: randomUUID() });
    for (let i = 0; i < 4; i += 1) lote.push({ ocorridoEm: em(-1), id: randomUUID() });
    lote.sort(() => Math.random() - 0.5);
    await inserir(lote);

    const esperado = [...lote]
      .sort((a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime() || (a.id! < b.id! ? 1 : -1))
      .map((e) => e.id);

    const vistos: string[] = [];
    let cursor: string | null = null;
    let paginas = 0;
    do {
      const q: string = `?limite=4${cursor !== null ? `&cursor=${cursor}` : ""}`;
      const r = await consultar(q, admin.cookie);
      expect(r.status).toBe(200);
      expect(r.body.itens.length).toBeLessThanOrEqual(4);
      vistos.push(...r.body.itens.map((i: { id: string }) => i.id));
      cursor = r.body.proximoCursor;
      paginas += 1;
      expect(paginas).toBeLessThan(20);
    } while (cursor !== null);

    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos).toEqual(esperado);
    expect(paginas).toBe(7);

    // mesma consulta repetida devolve a mesma ordem
    const a = await consultar("?limite=50", admin.cookie);
    const b = await consultar("?limite=50", admin.cookie);
    expect(a.body.itens).toEqual(b.body.itens);
    expect(a.body.itens.map((i: { id: string }) => i.id)).toEqual(esperado);
  });

  it("limite padrão 20; limite máximo 50 imposto pelo servidor (51 → 400)", async () => {
    const admin = await administradorAuditor();
    const lote: EventoSintetico[] = [];
    for (let i = 0; i < 55; i += 1) lote.push({ ocorridoEm: new Date(T0.getTime() + i) });
    await inserir(lote);
    const padrao = await consultar("", admin.cookie);
    expect(padrao.body.itens).toHaveLength(20);
    expect(padrao.body.proximoCursor).not.toBeNull();
    const maximo = await consultar("?limite=50", admin.cookie);
    expect(maximo.body.itens).toHaveLength(50);
    for (const limite of ["51", "1000", "0", "-1", "abc"]) {
      const r = await consultar(`?limite=${limite}`, admin.cookie);
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    }
  });

  it("filtros continuam aplicados na página seguinte", async () => {
    const admin = await administradorAuditor();
    const lote: EventoSintetico[] = [];
    for (let i = 0; i < 6; i += 1) {
      lote.push({ ocorridoEm: em(i), resultado: i % 2 === 0 ? "SUCESSO" : "FALHA" });
    }
    await inserir(lote);
    const p1 = await consultar("?resultado=FALHA&limite=2", admin.cookie);
    const p2 = await consultar(`?resultado=FALHA&limite=2&cursor=${p1.body.proximoCursor}`, admin.cookie);
    expect([...p1.body.itens, ...p2.body.itens].every((i: { resultado: string }) => i.resultado === "FALHA")).toBe(true);
    expect(p1.body.itens.length + p2.body.itens.length).toBe(3);
    expect(p2.body.proximoCursor).toBeNull();
  });
});

describe("AUD-004 — filtros proibidos e validação fail-closed (HTTP real)", () => {
  it.each([
    "?contexto=x",
    "?contexto[motivo]=x",
    "?justificativa=x",
    "?q=maria",
    "?busca=x",
    "?nome=x",
    "?email=a@b.c",
    "?cpf=00000000000",
    "?expandir=alvo",
    "?acao=auditoria.consultada",
    "?acao=usuario.autenticacao&acao=usuario.sessao.logout",
    "?acao=usuario",
    "?resultado=sucesso",
    "?alvoId=nao-uuid",
    "?atorUsuarioId=1",
    "?correlacaoId=%27%20OR%201%3D1",
    "?alvoTipo=Usuario",
    "?ocorridoDe=2026-08-25T10:00:00",
    "?ocorridoDe=2026-08-26T00:00:00Z&ocorridoAte=2026-08-25T00:00:00Z",
    "?cursor=adulterado!",
  ])("%s → 400 REQUISICAO_INVALIDA", async (q) => {
    const admin = await administradorAuditor();
    const r = await consultar(q, admin.cookie);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("parâmetro inválido sem sessão continua 401 (autenticação antes da validação)", async () => {
    const r = await consultar("?contexto=x");
    expect(r.status).toBe(401);
  });
});

describe("AUD-004 — consulta não é auditada", () => {
  it("200, 400, 401 e 403 não criam evento; auditoria.consultada não existe", async () => {
    const admin = await administradorAuditor();
    const semPermissao = await criarUsuario();
    const cookieSem = await cookieDe(semPermissao.id);
    await inserir([{ ocorridoEm: T0 }]);
    const antes = await contarEventos();

    expect((await consultar("", admin.cookie)).status).toBe(200);
    expect((await consultar("?limite=1", admin.cookie)).status).toBe(200);
    expect((await consultar("?contexto=x", admin.cookie)).status).toBe(400);
    expect((await consultar("")).status).toBe(401);
    expect((await consultar("", cookieSem)).status).toBe(403);

    expect(await contarEventos()).toBe(antes);
    const consultadas = await database.transacao((tx) =>
      tx.eventoAuditoria.count({ where: { acao: "auditoria.consultada" } }),
    );
    expect(consultadas).toBe(0);
  });
});
