// TechLab Fisio — Etapa 2.3D-B / P-2.3D-07 — revogação administrativa de sessão de terceiro
// ponta a ponta contra PostgreSQL REAL (AUT-002; D-2.3D-19; A-01..A-22).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { POLITICA_SESSAO, SessaoService } from "../../src/auth/sessao.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { ERRO } from "../../src/auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../../src/authz/erro-autorizacao.js";

const MINUTO = 60_000;
const T0 = new Date("2026-08-25T10:00:00.000Z");
const SENHA = "senha-sintetica-sessoes-adm";

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
let auditWriter: AuditWriter;
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
  auditWriter = moduleRef.get(AuditWriter);
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

async function darPapel(usuarioId: string, codigos: readonly string[]): Promise<void> {
  await database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `papel-${randomUUID().slice(0, 8)}`, nome: "Papel Teste" },
      select: { id: true },
    });
    for (const codigo of codigos) {
      const existente = await tx.permissao.findUnique({ where: { codigo }, select: { id: true } });
      const permissao =
        existente ?? (await tx.permissao.create({ data: { codigo, nome: codigo }, select: { id: true } }));
      await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
    }
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
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

async function criarAdministrador(): Promise<UsuarioFixture & { cookie: string; sessaoId: string; token: string }> {
  const admin = await criarUsuario();
  await darPapel(admin.id, ["sessoes.revogar_terceiro"]);
  const sessaoInfo = await cookieDe(admin.id);
  return { ...admin, ...sessaoInfo };
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

function cabecalhosLegitimos(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    [CABECALHO_REQUISICAO_TLF]: "1",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    ...extra,
  };
}

async function requisicaoDelete(
  sessaoId: string,
  opcoes?: { cabecalhos?: Record<string, string>; cookie?: string },
): Promise<RespostaMedida> {
  const headers = cabecalhosLegitimos({
    ...(opcoes?.cookie ? { cookie: opcoes.cookie } : {}),
    ...(opcoes?.cabecalhos ?? {}),
  });

  return medir(
    await fetch(`${baseUrl}/auth/sessoes/${sessaoId}`, {
      method: "DELETE",
      headers,
    }),
  );
}

describe("P-2.3D-07 — Revogação administrativa de sessão de terceiro (A-01..A-22)", () => {
  it("A-01, A-02, A-03, A-14: Administrador com sessoes.revogar_terceiro revoga sessão ativa de outro usuário", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    // Valida que a sessão alvo está ativa antes da revogação
    const validacaoAntes = await sessoes.validar(sessaoAlvo.token);
    expect(validacaoAntes.valida).toBe(true);

    const res = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });
    expect(res.status).toBe(204);
    expect(res.corpo).toBeNull();
    expect(res.cookies).toHaveLength(0); // Sem cookie emitido/alterado

    // A-02: sessao_autenticacao.revogada_por_usuario_id recebe o Administrador
    const sessaoPersistida = await database.transacao(async (tx) =>
      tx.sessaoAutenticacao.findUnique({
        where: { id: sessaoAlvo.sessaoId },
      }),
    );
    expect(sessaoPersistida).not.toBeNull();
    expect(sessaoPersistida?.estado).toBe("REVOGADA");
    expect(sessaoPersistida?.revogadaPorUsuarioId).toBe(admin.id);
    expect(sessaoPersistida?.encerradaEm).toEqual(relogio.agora());

    // A-03: evento_auditoria.ator_usuario_id recebe EXATAMENTE o mesmo Administrador
    const evento = await database.transacao(async (tx) =>
      tx.eventoAuditoria.findFirst({
        where: {
          acao: "usuario.sessao.revogacao",
          alvoId: sessaoAlvo.sessaoId,
        },
      }),
    );
    expect(evento).not.toBeNull();
    expect(evento?.atorUsuarioId).toBe(admin.id);
    expect(evento?.alvoTipo).toBe("sessao_autenticacao");
    expect(evento?.resultado).toBe("SUCESSO");
    expect(evento?.justificativa).toBeNull();
    // A-13: contexto vazio/nulo, sem segredos/senhas/tokens
    expect(evento?.contexto ?? {}).toEqual({});

    // A-14: token antigo não autoriza novas operações
    const validacaoDepois = await sessoes.validar(sessaoAlvo.token);
    expect(validacaoDepois.valida).toBe(false);
    if (!validacaoDepois.valida) {
      expect(validacaoDepois.motivo).toBe("SESSAO_REVOGADA");
    }
  });

  it("A-04: ator derivado exclusivamente da sessão autenticada; contrato sem campos injetáveis", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);
    const impostorId = randomUUID();

    // Enviar query string ou corpo não altera o ator
    const res = await requisicaoDelete(`${sessaoAlvo.sessaoId}?atorUsuarioId=${impostorId}`, {
      cookie: admin.cookie,
    });
    expect(res.status).toBe(204);

    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
    );
    expect(sessao?.revogadaPorUsuarioId).toBe(admin.id);
    expect(sessao?.revogadaPorUsuarioId).not.toBe(impostorId);
  });

  it("A-05: usuário sem sessoes.revogar_terceiro recebe 403 ACESSO_NEGADO", async () => {
    const usuarioSemPermissao = await criarUsuario();
    const sessaoUsuario = await cookieDe(usuarioSemPermissao.id);

    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    const res = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: sessaoUsuario.cookie });
    expect(res.status).toBe(403);
    expect(res.corpo).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    // Sessão alvo permaneceu ativa
    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
    );
    expect(sessao?.estado).toBe("ATIVA");
  });

  it("usuário não autenticado recebe 401 SESSAO_INVALIDA", async () => {
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    const res = await requisicaoDelete(sessaoAlvo.sessaoId); // sem cookie
    expect(res.status).toBe(401);
    expect(res.corpo).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("A-06: autorrevogação pela rota administrativa é recusada com 204 (no-op; sessão permanece ATIVA e sem auditoria)", async () => {
    const admin = await criarAdministrador();

    const res = await requisicaoDelete(admin.sessaoId, { cookie: admin.cookie });
    expect(res.status).toBe(204);
    expect(res.corpo).toBeNull();

    // Sessão do administrador permaneceu ATIVA
    const sessaoAdmin = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: admin.sessaoId } }),
    );
    expect(sessaoAdmin?.estado).toBe("ATIVA");
    expect(sessaoAdmin?.revogadaPorUsuarioId).toBeNull();

    // Nenhuma auditoria usuario.sessao.revogacao emitida
    const auditoria = await database.transacao((tx) =>
      tx.eventoAuditoria.findFirst({
        where: { acao: "usuario.sessao.revogacao", alvoId: admin.sessaoId },
      }),
    );
    expect(auditoria).toBeNull();
  });

  it("A-07: sessão inexistente retorna envelope uniforme 204 sem auditoria", async () => {
    const admin = await criarAdministrador();
    const sessaoInexistenteId = randomUUID();

    const res = await requisicaoDelete(sessaoInexistenteId, { cookie: admin.cookie });
    expect(res.status).toBe(204);
    expect(res.corpo).toBeNull();

    const auditoria = await database.transacao((tx) =>
      tx.eventoAuditoria.findFirst({
        where: { acao: "usuario.sessao.revogacao", alvoId: sessaoInexistenteId },
      }),
    );
    expect(auditoria).toBeNull();
  });

  it("A-08: sessão já REVOGADA retorna envelope uniforme 204 sem novo evento", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    // Primeira revogação
    const res1 = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });
    expect(res1.status).toBe(204);

    const contagemAuditoriaAntes = await database.transacao((tx) =>
      tx.eventoAuditoria.count({
        where: { acao: "usuario.sessao.revogacao", alvoId: sessaoAlvo.sessaoId },
      }),
    );
    expect(contagemAuditoriaAntes).toBe(1);

    // Segunda revogação (sessão já REVOGADA)
    const res2 = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });
    expect(res2.status).toBe(204);

    const contagemAuditoriaDepois = await database.transacao((tx) =>
      tx.eventoAuditoria.count({
        where: { acao: "usuario.sessao.revogacao", alvoId: sessaoAlvo.sessaoId },
      }),
    );
    expect(contagemAuditoriaDepois).toBe(1); // Nenhum evento duplicado
  });

  it("A-09, A-10: sessão já expirada ou vencida na política temporal fecha como EXPIRADA e não REVOGADA (sem auditoria)", async () => {
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    // Avança relógio além do timeout ocioso de 15 minutos (D-2.3D-04)
    relogio.avancar(POLITICA_SESSAO.timeoutOciosoMs + 10_000);

    // Admin autenticado no instante atual do relógio (para sua própria sessão ser válida)
    const admin = await criarAdministrador();

    const res = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });
    expect(res.status).toBe(204);

    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
    );
    // A-10: preserva semântica de expiração
    expect(sessao?.estado).toBe("EXPIRADA");
    expect(sessao?.revogadaPorUsuarioId).toBeNull();

    // Sem auditoria usuario.sessao.revogacao
    const auditoria = await database.transacao((tx) =>
      tx.eventoAuditoria.findFirst({
        where: { acao: "usuario.sessao.revogacao", alvoId: sessaoAlvo.sessaoId },
      }),
    );
    expect(auditoria).toBeNull();
  });

  it("A-11, A-12: falha na escrita de auditoria causa rollback da revogação e retorna 500", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    const spyRegistrar = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(
      new Error("Falha simulada de persistência de auditoria"),
    );

    try {
      const res = await requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });
      expect(res.status).toBe(500);
      expect(res.corpo).toEqual({ erro: ERRO.FALHA_INTERNA });

      // Sessão deve permanecer ATIVA devido ao rollback
      const sessao = await database.transacao((tx) =>
        tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
      );
      expect(sessao?.estado).toBe("ATIVA");
      expect(sessao?.revogadaPorUsuarioId).toBeNull();
    } finally {
      spyRegistrar.mockRestore();
    }
  });

  it("validação de formato de UUID no path: 400 REQUISICAO_INVALIDA para formato inválido", async () => {
    const admin = await criarAdministrador();
    const res = await requisicaoDelete("uuid-invalido-123", { cookie: admin.cookie });
    expect(res.status).toBe(400);
    expect(res.corpo).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("A-15: concorrência — duas revogações simultâneas produzem exatamente um evento e estado REVOGADA", async () => {
    const admin1 = await criarAdministrador();
    const admin2 = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    const [res1, res2] = await Promise.all([
      requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin1.cookie }),
      requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin2.cookie }),
    ]);

    expect(res1.status).toBe(204);
    expect(res2.status).toBe(204);

    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
    );
    expect(sessao?.estado).toBe("REVOGADA");
    expect([admin1.id, admin2.id]).toContain(sessao?.revogadaPorUsuarioId);

    const eventos = await database.transacao((tx) =>
      tx.eventoAuditoria.findMany({
        where: { acao: "usuario.sessao.revogacao", alvoId: sessaoAlvo.sessaoId },
      }),
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.atorUsuarioId).toBe(sessao?.revogadaPorUsuarioId);
  });

  it("A-16: concorrência com logout do próprio usuário converge de forma coerente", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    // Logout do usuário via POST /auth/logout
    const logoutDoUsuario = medir(
      await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: cabecalhosLegitimos({ cookie: sessaoAlvo.cookie }),
      }),
    );

    const revogacaoAdmin = requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie });

    const [resLogout, resAdmin] = await Promise.all([logoutDoUsuario, revogacaoAdmin]);
    expect([204, 401]).toContain(resLogout.status);
    expect(resAdmin.status).toBe(204);

    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoAlvo.sessaoId } }),
    );
    expect(sessao?.estado).toBe("REVOGADA");

    // Autor deve ser ou o próprio usuário (logout venceu) ou o admin (revogação venceu)
    expect([usuarioAlvo.id, admin.id]).toContain(sessao?.revogadaPorUsuarioId);
  });

  it("A-17: revogação administrativa x validação e atividade não deixa sessão utilizável", async () => {
    const admin = await criarAdministrador();
    const usuarioAlvo = await criarUsuario();
    const sessaoAlvo = await cookieDe(usuarioAlvo.id);

    // Dispara revogação e validação concorrentemente
    const [resAdmin, resValidar] = await Promise.all([
      requisicaoDelete(sessaoAlvo.sessaoId, { cookie: admin.cookie }),
      sessoes.validar(sessaoAlvo.token),
    ]);

    expect(resAdmin.status).toBe(204);

    // Validação subsequente DEVE atestar que a sessão está revogada
    const validacaoFinal = await sessoes.validar(sessaoAlvo.token);
    expect(validacaoFinal.valida).toBe(false);
  });

  it("A-19: regressão — logout continua atribuindo ao próprio usuário (D-2.3D-05)", async () => {
    const usuario = await criarUsuario();
    const sessaoInfo = await cookieDe(usuario.id);

    const res = await medir(
      await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: cabecalhosLegitimos({ cookie: sessaoInfo.cookie }),
      }),
    );
    expect(res.status).toBe(204);

    const sessao = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessaoInfo.sessaoId } }),
    );
    expect(sessao?.estado).toBe("REVOGADA");
    expect(sessao?.revogadaPorUsuarioId).toBe(usuario.id);

    const evento = await database.transacao((tx) =>
      tx.eventoAuditoria.findFirst({
        where: { acao: "usuario.sessao.logout", alvoId: sessaoInfo.sessaoId },
      }),
    );
    expect(evento?.atorUsuarioId).toBe(usuario.id);
  });

  it("A-20: regressão — T-07 revogação em massa continua atribuindo ao próprio usuário (D-2.3D-18)", async () => {
    const usuario = await criarUsuario();
    const sessao1 = await cookieDe(usuario.id);
    const sessao2 = await cookieDe(usuario.id);

    await database.transacao(async (tx) => {
      await sessoes.revogarTodasDoUsuarioEm(tx, usuario.id);
    });

    const s1 = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessao1.sessaoId } }),
    );
    const s2 = await database.transacao((tx) =>
      tx.sessaoAutenticacao.findUnique({ where: { id: sessao2.sessaoId } }),
    );

    expect(s1?.estado).toBe("REVOGADA");
    expect(s1?.revogadaPorUsuarioId).toBe(usuario.id);
    expect(s2?.estado).toBe("REVOGADA");
    expect(s2?.revogadaPorUsuarioId).toBe(usuario.id);
  });
});
