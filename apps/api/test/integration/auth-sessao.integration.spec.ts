// TechLab Fisio — Etapa 2.3D-B / P-2.3D-08 — consulta da sessão autenticada atual
// ponta a ponta contra PostgreSQL REAL (D-2.3D-20; A-01..A-22).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { SessaoService } from "../../src/auth/sessao.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { ERRO } from "../../src/auth/auth.dto.js";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const T0 = new Date("2026-08-25T10:00:00.000Z");
const SENHA = "senha-sintetica-sessao-atual";

class RelogioControlado implements RelogioSessao {
  #instante = new Date(T0.getTime());
  agora(): Date {
    return new Date(this.#instante.getTime());
  }
  definir(instante: Date): void {
    this.#instante = new Date(instante.getTime());
  }
  avancar(ms: number): void {
    this.#instante = new Date(this.#instante.getTime() + ms);
  }
  reiniciar(): void {
    this.#instante = new Date(T0.getTime());
  }
}

let moduleRef: TestingModule;
let app: INestApplication;
let baseUrl: string;
let database: DatabaseService;
let credenciais: CredencialService;
let sessoes: SessaoService;
let politicaCookie: PoliticaCookieSessao;
let hashDaSenha: string;

const relogio = new RelogioControlado();

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RELOGIO_SESSAO)
    .useValue(relogio)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = await app.getUrl();
  database = moduleRef.get(DatabaseService);
  credenciais = moduleRef.get(CredencialService);
  sessoes = moduleRef.get(SessaoService);
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
  hashDaSenha = await credenciais.gerarHash(SENHA);
}, 180_000);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  relogio.reiniciar();
});

interface UsuarioFixture {
  readonly id: string;
  readonly email: string;
}

async function criarUsuario(opcoes?: { ativo?: boolean; email?: string }): Promise<UsuarioFixture> {
  const email = opcoes?.email ?? `user-${randomUUID().slice(0, 8)}@sintetico.local`;
  return database.transacao(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { email, senhaHash: hashDaSenha, nome: "Usuário Sintético", ativo: opcoes?.ativo ?? true },
      select: { id: true },
    });
    return { id: usuario.id, email };
  });
}

async function cookieDe(usuarioId: string): Promise<{ cookie: string; sessaoId: string; token: string }> {
  const emitida = await sessoes.emitir({ usuarioId });
  return {
    cookie: `${politicaCookie.nome}=${emitida.token}`,
    sessaoId: emitida.sessaoId,
    token: emitida.token,
  };
}

interface RespostaMedida {
  readonly status: number;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  readonly headers: Headers;
}

async function medir(resposta: Response): Promise<RespostaMedida> {
  const texto = await resposta.text();
  let corpo: unknown = null;
  if (texto !== "") {
    try {
      corpo = JSON.parse(texto) as unknown;
    } catch {
      corpo = texto;
    }
  }
  return { status: resposta.status, corpo, cookies: resposta.headers.getSetCookie(), headers: resposta.headers };
}

async function requisicaoGetSessao(opcoes?: {
  cabecalhos?: Record<string, string>;
  cookie?: string;
}): Promise<RespostaMedida> {
  const headers: Record<string, string> = {
    ...(opcoes?.cookie ? { cookie: opcoes.cookie } : {}),
    ...(opcoes?.cabecalhos ?? {}),
  };
  return medir(
    await fetch(`${baseUrl}/auth/sessao`, {
      method: "GET",
      headers,
    }),
  );
}

async function contarEventosAuditoria(): Promise<number> {
  return database.transacao(async (tx) => {
    return tx.eventoAuditoria.count();
  });
}

describe("P-2.3D-08 / D-2.3D-20 — Consulta da sessão autenticada atual", () => {
  it("A-01, A-02: sessão ativa retorna 200 com usuarioId e sessaoId autoritativos", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });

    expect(res.status).toBe(200);
    expect(res.corpo).toEqual({
      usuarioId: usuario.id,
      sessaoId: infoSessao.sessaoId,
    });
    // Sem Set-Cookie (não rotaciona nem emite novo cookie na leitura)
    expect(res.cookies).toHaveLength(0);
  });

  it("A-03, A-04: resposta inclui Cache-Control: no-store e nenhum cabeçalho CSRF é exigido", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    // Requisição SEM qualquer cabeçalho customizado (sem X-TLF-Requisicao)
    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get("cache-control");
    expect(cacheControl).toBe("no-store");
  });

  it("A-05, A-06: estritamente ZERO eventos de auditoria são gerados na consulta (usuario.sessao.consultada é proibido)", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    const eventosAntes = await contarEventosAuditoria();

    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });
    expect(res.status).toBe(200);

    const eventosDepois = await contarEventosAuditoria();
    expect(eventosDepois).toBe(eventosAntes);
  });

  it("A-07: requisição sem cookie de sessão retorna 401 com erro SESSAO_INVALIDA", async () => {
    const eventosAntes = await contarEventosAuditoria();

    const res = await requisicaoGetSessao();

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const eventosDepois = await contarEventosAuditoria();
    expect(eventosDepois).toBe(eventosAntes);
  });

  it("A-08: requisição com cookie malformado ou token inexistente retorna 401 uniforme", async () => {
    const eventosAntes = await contarEventosAuditoria();

    const res = await requisicaoGetSessao({
      cookie: `${politicaCookie.nome}=token_sintetico_totalmente_inexistente_123456`,
    });

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const eventosDepois = await contarEventosAuditoria();
    expect(eventosDepois).toBe(eventosAntes);
  });

  it("A-09: requisição com sessão revogada retorna 401 uniforme", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    // Revoga a sessão
    const revogada = await sessoes.revogar(infoSessao.token);
    expect(revogada.revogada).toBe(true);

    const eventosAntes = await contarEventosAuditoria();

    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const eventosDepois = await contarEventosAuditoria();
    expect(eventosDepois).toBe(eventosAntes);
  });

  it("A-10: requisição com sessão expirada por ociosidade (>15 min) retorna 401 uniforme", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    // Avança o relógio além dos 15 minutos de inatividade
    relogio.avancar(15 * MINUTO + 1_000);

    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("A-11: requisição com sessão expirada pelo teto absoluto (>8 h) retorna 401 uniforme", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    // Avança o relógio além de 8 horas absolutas
    relogio.avancar(8 * HORA + 1_000);

    const res = await requisicaoGetSessao({ cookie: infoSessao.cookie });

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("A-12: requisição com token sem formato válido (sem ponto ou uuid inválido) retorna 401 uniforme", async () => {
    const res = await requisicaoGetSessao({
      cookie: `${politicaCookie.nome}=token-sem-ponto-nem-uuid`,
    });

    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("A-13: não é afetado pelo ProtecaoCsrfGuard (GET seguro não exige X-TLF-Requisicao nem bloqueia cross-origin)", async () => {
    const usuario = await criarUsuario();
    const infoSessao = await cookieDe(usuario.id);

    // Simula uma requisição com headers cross-site típicos
    const res = await requisicaoGetSessao({
      cookie: infoSessao.cookie,
      cabecalhos: {
        origin: "https://atacante.exemplo",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
      },
    });

    // Como GET /auth/sessao é seguro (D-2.3D-20), não possui ProtecaoCsrfGuard, retornando 200
    expect(res.status).toBe(200);
    expect(res.corpo).toEqual({
      usuarioId: usuario.id,
      sessaoId: infoSessao.sessaoId,
    });
  });
});
