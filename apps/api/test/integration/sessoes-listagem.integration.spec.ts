// TechLab Fisio — P-2.3D-10 — listagem administrativa das sessões ativas de um usuário
// ponta a ponta contra PostgreSQL REAL (AUT-002; D-2.3D-22; L-01..L-16).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { ERRO } from "../../src/auth/auth.dto.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { POLITICA_SESSAO, SessaoService } from "../../src/auth/sessao.service.js";
import { ERRO_AUTORIZACAO } from "../../src/authz/erro-autorizacao.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { SessoesService } from "../../src/sessoes/sessoes.service.js";

const MINUTO = 60_000;
const T0 = new Date("2026-08-25T10:00:00.000Z");
const SENHA = "senha-sintetica-sessoes-listagem";
const CAMPOS_HOMOLOGADOS = ["criadaEm", "expiraEm", "sessaoId", "ultimaAtividadeEm"];

class RelogioControlado implements RelogioSessao {
  #instante = new Date(T0.getTime());
  agora(): Date {
    return new Date(this.#instante.getTime());
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
  sessoes = moduleRef.get(SessaoService);
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
  hashDaSenha = await moduleRef.get(CredencialService).gerarHash(SENHA);
}, 180_000);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  relogio.reiniciar();
});

async function criarUsuario(): Promise<string> {
  const email = `listagem-${randomUUID().slice(0, 8)}@sintetico.local`;
  const usuario = await database.transacao((tx) =>
    tx.usuario.create({
      data: { email, senhaHash: hashDaSenha, nome: "Usuário Sintético", ativo: true },
      select: { id: true },
    }),
  );
  return usuario.id;
}

async function darPapel(usuarioId: string, codigos: readonly string[]): Promise<void> {
  await database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `papel-${randomUUID().slice(0, 8)}`, nome: "Papel Teste" },
      select: { id: true },
    });
    for (const codigo of codigos) {
      const existente = await tx.permissao.findUnique({ where: { codigo }, select: { id: true } });
      const permissao =
        existente ??
        (await tx.permissao.create({ data: { codigo, nome: codigo }, select: { id: true } }));
      await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
    }
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
  });
}

async function emitir(usuarioId: string): Promise<{ cookie: string; sessaoId: string; token: string }> {
  const emitida = await sessoes.emitir({ usuarioId });
  return {
    cookie: `${politicaCookie.nome}=${emitida.token}`,
    sessaoId: emitida.sessaoId,
    token: emitida.token,
  };
}

async function criarAdministrador(): Promise<{ id: string; cookie: string; sessaoId: string; token: string }> {
  const id = await criarUsuario();
  await darPapel(id, ["sessoes.revogar_terceiro"]);
  return { id, ...(await emitir(id)) };
}

interface RespostaMedida {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly headers: Headers;
}

/** GET mínimo: somente o cookie — nenhum cabeçalho CSRF ou Fetch Metadata. */
async function listar(usuarioId: string, cookie?: string): Promise<RespostaMedida> {
  const resposta = await fetch(`${baseUrl}/auth/usuarios/${usuarioId}/sessoes`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
  });
  const texto = await resposta.text();
  let corpo: unknown = null;
  if (texto !== "") corpo = JSON.parse(texto) as unknown;
  return { status: resposta.status, texto, corpo, headers: resposta.headers };
}

async function contarEventosAuditoria(): Promise<number> {
  return database.transacao((tx) => tx.eventoAuditoria.count());
}

describe("P-2.3D-10 — GET /auth/usuarios/:usuarioId/sessoes (D-2.3D-22)", () => {
  it("L-01, L-02, L-03: Administrador lista as sessões ativas do alvo, com projeção fechada, ordem estável e no-store", async () => {
    const admin = await criarAdministrador();
    const alvo = await criarUsuario();
    const primeira = await emitir(alvo);
    relogio.avancar(MINUTO);
    const segunda = await emitir(alvo);

    const res = await listar(alvo, admin.cookie);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.getSetCookie()).toHaveLength(0);

    const corpo = res.corpo as { sessoes: Array<Record<string, string>> };
    expect(Object.keys(corpo)).toEqual(["sessoes"]);
    expect(corpo.sessoes.map((s) => s["sessaoId"])).toEqual([primeira.sessaoId, segunda.sessaoId]);
    for (const item of corpo.sessoes) {
      expect(Object.keys(item).sort()).toEqual(CAMPOS_HOMOLOGADOS);
    }
    expect(corpo.sessoes[0]).toEqual({
      sessaoId: primeira.sessaoId,
      criadaEm: T0.toISOString(),
      ultimaAtividadeEm: T0.toISOString(),
      expiraEm: new Date(T0.getTime() + POLITICA_SESSAO.expiracaoAbsolutaMs).toISOString(),
    });
  });

  it("L-04: nenhum token, segredo ou hash de token aparece na resposta", async () => {
    const admin = await criarAdministrador();
    const alvo = await criarUsuario();
    const emitida = await emitir(alvo);
    const persistida = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUniqueOrThrow({
        where: { id: emitida.sessaoId },
        select: { tokenHash: true },
      }),
    );

    const res = await listar(alvo, admin.cookie);

    expect(res.status).toBe(200);
    const segredo = emitida.token.slice(emitida.token.indexOf(".") + 1);
    expect(res.texto).not.toContain(emitida.token);
    expect(res.texto).not.toContain(segredo);
    expect(res.texto).not.toContain(persistida.tokenHash);
    expect(res.texto.toLowerCase()).not.toMatch(/token|hash|cookie|segredo|senha/);
  });

  it("L-05: sessões REVOGADA e EXPIRADA persistidas não são listadas", async () => {
    const alvo = await criarUsuario();
    const revogada = await emitir(alvo);
    await sessoes.revogar(revogada.token);
    const expirada = await emitir(alvo);
    const ativa = await emitir(alvo);

    // Expira `expirada` por ociosidade e persiste a detecção; `ativa` é renovada.
    relogio.avancar(POLITICA_SESSAO.timeoutOciosoMs - MINUTO);
    expect((await sessoes.validar(ativa.token)).valida).toBe(true);
    relogio.avancar(2 * MINUTO);
    expect((await sessoes.validar(expirada.token)).valida).toBe(false);

    const admin = await criarAdministrador();
    const res = await listar(alvo, admin.cookie);

    expect(res.status).toBe(200);
    const ids = (res.corpo as { sessoes: Array<{ sessaoId: string }> }).sessoes.map((s) => s.sessaoId);
    expect(ids).toEqual([ativa.sessaoId]);
    const estados = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findMany({
        where: { id: { in: [revogada.sessaoId, expirada.sessaoId] } },
        select: { id: true, estado: true },
      }),
    );
    expect(new Map(estados.map((e) => [e.id, e.estado]))).toEqual(
      new Map([
        [revogada.sessaoId, "REVOGADA"],
        [expirada.sessaoId, "EXPIRADA"],
      ]),
    );
  });

  it("L-06: sessão ATIVA vencida pela política temporal não é listada e NÃO é escrita pela consulta", async () => {
    const alvo = await criarUsuario();
    const ociosa = await emitir(alvo);

    relogio.avancar(POLITICA_SESSAO.timeoutOciosoMs + MINUTO);
    const admin = await criarAdministrador();
    const res = await listar(alvo, admin.cookie);

    expect(res.status).toBe(200);
    expect(res.corpo).toEqual({ sessoes: [] });
    const persistida = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUniqueOrThrow({
        where: { id: ociosa.sessaoId },
        select: { estado: true, encerradaEm: true },
      }),
    );
    expect(persistida).toEqual({ estado: "ATIVA", encerradaEm: null });
  });

  it("L-07: expiração absoluta também exclui a sessão da listagem", async () => {
    const alvo = await criarUsuario();
    const sessao = await emitir(alvo);
    // Mantém a sessão sem ociosidade até o teto absoluto.
    const passo = POLITICA_SESSAO.timeoutOciosoMs - MINUTO;
    let decorrido = 0;
    while (decorrido + passo < POLITICA_SESSAO.expiracaoAbsolutaMs) {
      relogio.avancar(passo);
      decorrido += passo;
      expect((await sessoes.validar(sessao.token)).valida).toBe(true);
    }
    relogio.avancar(POLITICA_SESSAO.expiracaoAbsolutaMs - decorrido);

    const admin = await criarAdministrador();
    const res = await listar(alvo, admin.cookie);

    expect(res.status).toBe(200);
    expect(res.corpo).toEqual({ sessoes: [] });
  });

  it("L-08: usuário inexistente e usuário sem sessões produzem o MESMO envelope 200 { sessoes: [] }", async () => {
    const admin = await criarAdministrador();
    const semSessoes = await criarUsuario();

    const inexistente = await listar(randomUUID(), admin.cookie);
    const vazio = await listar(semSessoes, admin.cookie);

    for (const res of [inexistente, vazio]) {
      expect(res.status).toBe(200);
      expect(res.texto).toBe('{"sessoes":[]}');
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("L-09: usuário autenticado sem sessoes.revogar_terceiro recebe 403 ACESSO_NEGADO", async () => {
    const comum = await criarUsuario();
    await darPapel(comum, ["pacientes.localizar"]);
    const sessaoComum = await emitir(comum);
    const alvo = await criarUsuario();
    await emitir(alvo);

    const res = await listar(alvo, sessaoComum.cookie);

    expect(res.status).toBe(403);
    expect(res.corpo).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(res.texto).not.toContain("sessaoId");
  });

  it("L-10: sem sessão, ou com sessão do operador revogada, recebe 401 SESSAO_INVALIDA", async () => {
    const alvo = await criarUsuario();
    await emitir(alvo);

    const anonimo = await listar(alvo);
    expect(anonimo.status).toBe(401);
    expect(anonimo.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });

    const admin = await criarAdministrador();
    await sessoes.revogar(admin.token);
    const revogado = await listar(alvo, admin.cookie);
    expect(revogado.status).toBe(401);
    expect(revogado.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("L-11: usuarioId estruturalmente inválido recebe 400 REQUISICAO_INVALIDA", async () => {
    const admin = await criarAdministrador();
    const res = await listar("nao-e-uuid", admin.cookie);
    expect(res.status).toBe(400);
    expect(res.corpo).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("L-12: a consulta não emite evento de auditoria", async () => {
    const admin = await criarAdministrador();
    const alvo = await criarUsuario();
    await emitir(alvo);

    const antes = await contarEventosAuditoria();
    expect((await listar(alvo, admin.cookie)).status).toBe(200);
    expect((await listar(randomUUID(), admin.cookie)).status).toBe(200);
    expect(await contarEventosAuditoria()).toBe(antes);
  });

  it("L-13: fluxo vertical — o sessaoId listado é revogado pela rota de D-2.3D-19 e deixa de ser listado", async () => {
    const admin = await criarAdministrador();
    const alvo = await criarUsuario();
    const sessaoAlvo = await emitir(alvo);

    const antes = await listar(alvo, admin.cookie);
    const [item] = (antes.corpo as { sessoes: Array<{ sessaoId: string }> }).sessoes;
    expect(item?.sessaoId).toBe(sessaoAlvo.sessaoId);

    const revogacao = await fetch(`${baseUrl}/auth/sessoes/${String(item?.sessaoId)}`, {
      method: "DELETE",
      headers: {
        cookie: admin.cookie,
        "content-type": "application/json",
        [CABECALHO_REQUISICAO_TLF]: "1",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
      },
    });
    expect(revogacao.status).toBe(204);
    expect((await sessoes.validar(sessaoAlvo.token)).valida).toBe(false);

    const depois = await listar(alvo, admin.cookie);
    expect(depois.corpo).toEqual({ sessoes: [] });
  });

  it("L-14: a mutação DELETE preserva a CSRF antes da sessão — sem cabeçalho e sem cookie continua 403 REQUISICAO_NAO_AUTORIZADA", async () => {
    const res = await fetch(`${baseUrl}/auth/sessoes/${randomUUID()}`, {
      method: "DELETE",
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ erro: "REQUISICAO_NAO_AUTORIZADA" });
  });

  it("L-15: falha técnica na consulta devolve 500 FALHA_INTERNA no envelope fechado, sem detalhe interno", async () => {
    const admin = await criarAdministrador();
    const alvo = await criarUsuario();
    const espiao = jest
      .spyOn(moduleRef.get(SessoesService), "listarSessoesAtivasDoUsuario")
      .mockRejectedValueOnce(new Error("falha simulada de infraestrutura tlf-detalhe-interno"));

    try {
      const res = await listar(alvo, admin.cookie);
      expect(res.status).toBe(500);
      expect(res.corpo).toEqual({ erro: ERRO.FALHA_INTERNA });
      expect(res.texto).not.toContain("tlf-detalhe-interno");
    } finally {
      espiao.mockRestore();
    }
  });

  it("L-16: a consulta não escreve nas sessões do ALVO; a sessão do operador segue o registro de atividade de D-2.3D-04", async () => {
    const alvo = await criarUsuario();
    const sessaoAlvo = await emitir(alvo);
    const admin = await criarAdministrador();

    // Passado o throttle de atividade, a guarda de sessão do operador registra
    // atividade (comportamento vigente de toda rota autenticada, D-2.3D-04);
    // as sessões do alvo, objeto da consulta, permanecem byte a byte iguais.
    relogio.avancar(POLITICA_SESSAO.throttleAtividadeMs + MINUTO);
    const antes = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUniqueOrThrow({ where: { id: sessaoAlvo.sessaoId } }),
    );

    expect((await listar(alvo, admin.cookie)).status).toBe(200);

    const depois = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUniqueOrThrow({ where: { id: sessaoAlvo.sessaoId } }),
    );
    expect(depois).toEqual(antes);
    const operador = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUniqueOrThrow({
        where: { id: admin.sessaoId },
        select: { estado: true, ultimaAtividadeEm: true },
      }),
    );
    expect(operador.estado).toBe("ATIVA");
    expect(operador.ultimaAtividadeEm.getTime()).toBeGreaterThan(T0.getTime());
  });
});
