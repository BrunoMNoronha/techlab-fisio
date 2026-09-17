// TechLab Fisio — testes de integração E2E contra PostgreSQL REAL da gestão de situação de usuários
// (AUT-005 / RN-001 / D-2.3D-21 / A-01..A-18).

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
import { ERRO_USUARIOS } from "../../src/auth/usuarios.dto.js";
import { AutenticacaoService } from "../../src/auth/autenticacao.service.js";
import { RecuperacaoSenhaService } from "../../src/recuperacao-senha/recuperacao-senha.service.js";

const MINUTO = 60_000;
const T0 = new Date("2026-08-25T10:00:00.000Z");
const SENHA = "senha-sintetica-usuarios-adm";

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
let autenticacao: AutenticacaoService;
let auditWriter: AuditWriter;
let recuperacao: RecuperacaoSenhaService;
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
  autenticacao = moduleRef.get(AutenticacaoService);
  auditWriter = moduleRef.get(AuditWriter);
  recuperacao = moduleRef.get(RecuperacaoSenhaService);
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

async function darPermissao(usuarioId: string, permissaoCodigo: string): Promise<void> {
  await database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `papel-${randomUUID().slice(0, 8)}`, nome: "Papel Teste" },
      select: { id: true },
    });
    const existente = await tx.permissao.findUnique({ where: { codigo: permissaoCodigo }, select: { id: true } });
    const permissao =
      existente ?? (await tx.permissao.create({ data: { codigo: permissaoCodigo, nome: permissaoCodigo }, select: { id: true } }));
    await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
  });
}

async function emitirCookieSessao(usuarioId: string): Promise<{ cookie: string; token: string; sessaoId: string }> {
  const emitida = await sessoes.emitir({ usuarioId });
  return {
    cookie: `${politicaCookie.nome}=${emitida.token}`,
    token: emitida.token,
    sessaoId: emitida.sessaoId,
  };
}

async function requisitarAlterarSituacao(
  usuarioId: string,
  body: unknown,
  cookie?: string,
  customHeaders?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [CABECALHO_REQUISICAO_TLF]: "1",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    ...(cookie ? { cookie } : {}),
    ...(customHeaders ?? {}),
  };

  const res = await fetch(`${baseUrl}/auth/usuarios/${usuarioId}/situacao`, {
    method: "PATCH",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  const texto = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = texto;
  }
  return { status: res.status, body: json };
}

describe("AUT-005 — Integração E2E contra PostgreSQL Real", () => {
  describe("Autenticação, Autorização e CSRF", () => {
    it("A-01: requisição sem cookie de sessão retorna 401 SESSAO_INVALIDA", async () => {
      const alvo = await criarUsuario();
      const res = await requisitarAlterarSituacao(alvo.id, { ativo: false });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    });

    it("A-02: operador sem permissão usuarios.gerenciar retorna 403 ACESSO_NEGADO", async () => {
      const operador = await criarUsuario();
      const alvo = await criarUsuario();
      const { cookie } = await emitirCookieSessao(operador.id);

      const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookie);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    });

    it("A-03: requisição sem cabeçalho X-TLF-Requisicao retorna 403 REQUISICAO_NAO_AUTORIZADA (CSRF)", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const alvo = await criarUsuario();
      const { cookie } = await emitirCookieSessao(admin.id);

      const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookie, {
        [CABECALHO_REQUISICAO_TLF]: "",
      });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    });

    it("A-04 / A-05: Auto-inativação pelo administrador é rejeitada com 422 AUTO_INATIVACAO_PROIBIDA", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie, sessaoId } = await emitirCookieSessao(admin.id);

      const res = await requisitarAlterarSituacao(admin.id, { ativo: false }, cookie);
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ erro: ERRO_USUARIOS.AUTO_INATIVACAO_PROIBIDA });

      // Provar que o admin permanece ativo e sua sessão não foi revogada
      const usuarioBanco = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: admin.id } }),
      );
      expect(usuarioBanco?.ativo).toBe(true);
      expect(usuarioBanco?.inativadoEm).toBeNull();

      const sessaoBanco = await database.transacao((tx) =>
        tx.sessaoAutenticacao.findUnique({ where: { id: sessaoId } }),
      );
      expect(sessaoBanco?.estado).toBe("ATIVA");
    });

    it("Alvo inexistente retorna 404 USUARIO_INEXISTENTE", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie } = await emitirCookieSessao(admin.id);

      const idInexistente = randomUUID();
      const res = await requisitarAlterarSituacao(idInexistente, { ativo: false }, cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: ERRO_USUARIOS.USUARIO_INEXISTENTE });
    });
  });

  describe("Inativação, Revogação de Sessões e Auditoria (A-06..A-09, A-14)", () => {
    it("Inativação com sucesso revoga atomicamente todas as sessões ativas com o admin como autor e emite auditoria", async () => {
      const alvo = await criarUsuario();
      // Sessão emitida em T0 que vencerá temporalmente por ociosidade (> 15 min)
      const sessao3Vencida = await emitirCookieSessao(alvo.id);

      // Avançar relógio além do timeout ocioso de 15 minutos (D-2.3D-04)
      relogio.avancar(16 * MINUTO);

      // Sessões do alvo e do administrador emitidas no instante atual (ativas)
      const sessao1 = await emitirCookieSessao(alvo.id);
      const sessao2 = await emitirCookieSessao(alvo.id);

      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        usuarioId: alvo.id,
        ativo: false,
        inativadoEm: expect.any(String),
      });

      // Conferir no banco tabela usuario
      const usuarioBanco = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );
      expect(usuarioBanco?.ativo).toBe(false);
      expect(usuarioBanco?.inativadoEm).not.toBeNull();
      expect(usuarioBanco?.inativadoPorUsuarioId).toBe(admin.id);

      // Conferir sessões: sessao1 e sessao2 devem estar REVOGADAS com autor = admin.id
      const s1 = await database.transacao((tx) =>
        tx.sessaoAutenticacao.findUnique({ where: { id: sessao1.sessaoId } }),
      );
      expect(s1?.estado).toBe("REVOGADA");
      expect(s1?.revogadaPorUsuarioId).toBe(admin.id);
      expect(s1?.encerradaEm).not.toBeNull();

      const s2 = await database.transacao((tx) =>
        tx.sessaoAutenticacao.findUnique({ where: { id: sessao2.sessaoId } }),
      );
      expect(s2?.estado).toBe("REVOGADA");
      expect(s2?.revogadaPorUsuarioId).toBe(admin.id);

      // sessao3Vencida deve estar EXPIRADA por prazo, e NÃO REVOGADA pelo admin
      const s3 = await database.transacao((tx) =>
        tx.sessaoAutenticacao.findUnique({ where: { id: sessao3Vencida.sessaoId } }),
      );
      expect(s3?.estado).toBe("EXPIRADA");
      expect(s3?.revogadaPorUsuarioId).toBeNull();

      // Provar que tokens dessas sessões deixam de validar
      const val1 = await sessoes.validar(sessao1.token);
      expect(val1.valida).toBe(false);
      if (!val1.valida) {
        expect(val1.motivo).toBe("SESSAO_REVOGADA");
      }

      // Provar que login posterior falha (AUT-001)
      const resLogin = await autenticacao.autenticar({
        identificador: alvo.email,
        senha: SENHA,
        ip: "127.0.0.1",
      });
      expect(resLogin.desfecho).toBe("CREDENCIAIS_INVALIDAS");

      // Provar evento de auditoria
      const eventos = await database.transacao((tx) =>
        tx.eventoAuditoria.findMany({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(eventos).toHaveLength(1);
      const ev = eventos[0]!;
      expect(ev.atorUsuarioId).toBe(admin.id);
      expect(ev.alvoTipo).toBe("usuario");
      expect(ev.resultado).toBe("SUCESSO");
      expect(ev.contexto ?? {}).toEqual({});
    });
  });

  describe("Reativação (A-10, A-11)", () => {
    it("Reativação bem-sucedida limpa inativado_em e inativado_por_usuario_id para NULL e não cria sessões", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      // Criar usuário inativo com histórico de inativação
      const alvo = await database.transacao(async (tx) => {
        return tx.usuario.create({
          data: {
            email: `inativo-${randomUUID().slice(0, 8)}@sintetico.local`,
            senhaHash: hashDaSenha,
            nome: "Usuário Inativo",
            ativo: false,
            inativadoEm: new Date("2026-08-01T00:00:00.000Z"),
            inativadoPorUsuarioId: admin.id,
          },
          select: { id: true },
        });
      });

      const res = await requisitarAlterarSituacao(alvo.id, { ativo: true }, cookieAdmin);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        usuarioId: alvo.id,
        ativo: true,
        inativadoEm: null,
      });

      // Conferir banco
      const usuarioBanco = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );
      expect(usuarioBanco?.ativo).toBe(true);
      expect(usuarioBanco?.inativadoEm).toBeNull();
      expect(usuarioBanco?.inativadoPorUsuarioId).toBeNull();

      // Provar que nenhuma sessão foi criada
      const totalSessoes = await database.transacao((tx) =>
        tx.sessaoAutenticacao.count({ where: { usuarioId: alvo.id } }),
      );
      expect(totalSessoes).toBe(0);

      // Provar que evento de auditoria de reativação foi emitido
      const eventos = await database.transacao((tx) =>
        tx.eventoAuditoria.findMany({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(eventos).toHaveLength(1);
      const ev = eventos[0]!;
      expect(ev.atorUsuarioId).toBe(admin.id);
      expect(ev.resultado).toBe("SUCESSO");
    });
  });

  describe("Idempotência / No-Op (A-15)", () => {
    it("Ativar usuário já ativo retorna 200 sem mutação, sem alterar timestamp e sem emitir auditoria", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      const alvo = await criarUsuario({ ativo: true });
      const antes = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );

      relogio.avancar(5 * MINUTO);

      const res = await requisitarAlterarSituacao(alvo.id, { ativo: true }, cookieAdmin);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        usuarioId: alvo.id,
        ativo: true,
        inativadoEm: null,
      });

      const depois = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );
      expect(depois?.atualizadoEm.getTime()).toBe(antes?.atualizadoEm.getTime());

      // Zero auditoria emitida
      const eventos = await database.transacao((tx) =>
        tx.eventoAuditoria.findMany({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(eventos).toHaveLength(0);
    });

    it("Inativar usuário já inativo retorna 200 sem mutação e sem emitir auditoria adicional", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      const alvo = await criarUsuario({ ativo: true });
      // Inativação inicial
      await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin);

      const antes = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );
      const auditoriaAntes = await database.transacao((tx) =>
        tx.eventoAuditoria.count({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(auditoriaAntes).toBe(1);

      relogio.avancar(5 * MINUTO);

      // Segunda inativação (no-op)
      const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin);
      expect(res.status).toBe(200);
      expect(res.body.ativo).toBe(false);

      const depois = await database.transacao((tx) =>
        tx.usuario.findUnique({ where: { id: alvo.id } }),
      );
      expect(depois?.atualizadoEm.getTime()).toBe(antes?.atualizadoEm.getTime());

      const auditoriaDepois = await database.transacao((tx) =>
        tx.eventoAuditoria.count({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(auditoriaDepois).toBe(1); // Nenhuma auditoria nova
    });
  });

  describe("Atomicidade e Rollback (A-12, A-13)", () => {
    it("Falha na gravação de auditoria causa rollback total da inativação e preserva as sessões ativas", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      const alvo = await criarUsuario({ ativo: true });
      const sessaoAlvo = await emitirCookieSessao(alvo.id);

      // Espionar AuditWriter.registrar e forçar falha
      const registrarOriginal = auditWriter.registrar.bind(auditWriter);
      const spy = jest.spyOn(auditWriter, "registrar").mockImplementation(async (tx, evento) => {
        if (evento.acao === "usuario.situacao.alterada") {
          throw new Error("FALHA_SIMULADA_AUDITORIA");
        }
        return registrarOriginal(tx, evento);
      });

      try {
        const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin);
        expect(res.status).toBe(500);

        // Provar rollback no banco
        const usuarioBanco = await database.transacao((tx) =>
          tx.usuario.findUnique({ where: { id: alvo.id } }),
        );
        expect(usuarioBanco?.ativo).toBe(true);
        expect(usuarioBanco?.inativadoEm).toBeNull();

        const sessaoBanco = await database.transacao((tx) =>
          tx.sessaoAutenticacao.findUnique({
            where: { id: sessaoAlvo.sessaoId },
          }),
        );
        expect(sessaoBanco?.estado).toBe("ATIVA");
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("Concorrência Real (C1, C3, A-16)", () => {
    it("C1: Dois administradores inativando simultaneamente convergem: exatamente uma mutação e um evento de auditoria", async () => {
      const admin1 = await criarUsuario();
      await darPermissao(admin1.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin1 } = await emitirCookieSessao(admin1.id);

      const admin2 = await criarUsuario();
      await darPermissao(admin2.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin2 } = await emitirCookieSessao(admin2.id);

      const alvo = await criarUsuario({ ativo: true });
      await emitirCookieSessao(alvo.id);

      // Disparar simultaneamente
      const [res1, res2] = await Promise.all([
        requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin1),
        requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin2),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Exatamente 1 evento de auditoria emitido
      const eventos = await database.transacao((tx) =>
        tx.eventoAuditoria.findMany({
          where: { acao: "usuario.situacao.alterada", alvoId: alvo.id },
        }),
      );
      expect(eventos).toHaveLength(1);
    });

    it("C3 / A-16: Login em voo concorrente com inativação não emite sessão utilizável após inativação", async () => {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie: cookieAdmin } = await emitirCookieSessao(admin.id);

      const alvo = await criarUsuario({ ativo: true });

      // Disparar simultaneamente login e inativação
      const [resLogin, resInativacao] = await Promise.all([
        autenticacao.autenticar({ identificador: alvo.email, senha: SENHA, ip: "127.0.0.1" }),
        requisitarAlterarSituacao(alvo.id, { ativo: false }, cookieAdmin),
      ]);

      expect(resInativacao.status).toBe(200);

      // Se o login foi aceito antes da inativação comitar, sua sessão foi obrigatoriamente revogada pela inativação.
      // Se a inativação comitou antes, o login foi recusado (CREDENCIAIS_INVALIDAS).
      if (resLogin.desfecho === "AUTENTICADO") {
        const val = await sessoes.validar(resLogin.token);
        expect(val.valida).toBe(false);
        if (!val.valida) {
          expect(val.motivo).toBe("SESSAO_REVOGADA");
        }
      } else {
        expect(resLogin.desfecho).toBe("CREDENCIAIS_INVALIDAS");
      }

      // Provar que nenhuma sessão ATIVA do usuário permaneceu viva no banco
      const sessoesAtivas = await database.transacao((tx) =>
        tx.sessaoAutenticacao.count({
          where: { usuarioId: alvo.id, estado: "ATIVA" },
        }),
      );
      expect(sessoesAtivas).toBe(0);
    });
  });
  // Reforço de provas de P-2.3D-09 (sem mudança normativa): C2, C5, C6, C7 e
  // rollback por falha na revogação. Cenários concorrentes são repetidos para
  // exercitar as duas ordens de aquisição do lock de `usuario`.
  describe("Reforço de provas — atomicidade e concorrência adicionais", () => {
    const RODADAS = 5;

    async function criarAdministrador(): Promise<{ id: string; cookie: string }> {
      const admin = await criarUsuario();
      await darPermissao(admin.id, "usuarios.gerenciar");
      const { cookie } = await emitirCookieSessao(admin.id);
      return { id: admin.id, cookie };
    }

    async function lerUsuario(id: string) {
      return database.transacao((tx) => tx.usuario.findUnique({ where: { id } }));
    }

    async function lerSessao(id: string) {
      return database.transacao((tx) => tx.sessaoAutenticacao.findUnique({ where: { id } }));
    }

    async function contarSessoesAtivas(usuarioId: string): Promise<number> {
      return database.transacao((tx) =>
        tx.sessaoAutenticacao.count({ where: { usuarioId, estado: "ATIVA" } }),
      );
    }

    async function contarEventos(acao: string, alvoId: string): Promise<number> {
      return database.transacao((tx) => tx.eventoAuditoria.count({ where: { acao, alvoId } }));
    }

    /** Invariante RN-001: usuário inativo nunca convive com sessão ATIVA após o commit. */
    async function provarInvarianteSituacao(usuarioId: string, atoresPossiveis: string[]): Promise<void> {
      const usuario = await lerUsuario(usuarioId);
      if (usuario?.ativo === false) {
        expect(usuario.inativadoEm).not.toBeNull();
        expect(atoresPossiveis).toContain(usuario.inativadoPorUsuarioId);
        expect(await contarSessoesAtivas(usuarioId)).toBe(0);
      } else {
        expect(usuario?.inativadoEm).toBeNull();
        expect(usuario?.inativadoPorUsuarioId).toBeNull();
      }
    }

    it("Falha na revogação das sessões causa rollback conjunto: usuário ativo, sessão ATIVA e nenhuma auditoria", async () => {
      const admin = await criarAdministrador();
      const alvo = await criarUsuario();
      const sessaoAlvo = await emitirCookieSessao(alvo.id);

      const spy = jest
        .spyOn(sessoes, "revogarTodasPorAdministradorEm")
        .mockRejectedValue(new Error("FALHA_SIMULADA_REVOGACAO"));
      try {
        const res = await requisitarAlterarSituacao(alvo.id, { ativo: false }, admin.cookie);
        expect(res.status).toBe(500);
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }

      const usuario = await lerUsuario(alvo.id);
      expect(usuario?.ativo).toBe(true);
      expect(usuario?.inativadoEm).toBeNull();
      expect(usuario?.inativadoPorUsuarioId).toBeNull();
      expect((await lerSessao(sessaoAlvo.sessaoId))?.estado).toBe("ATIVA");
      expect(await contarEventos("usuario.situacao.alterada", alvo.id)).toBe(0);
    });

    it("C2: ativação × inativação concorrentes convergem para estado coerente, com um evento por transição real", async () => {
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const adminInativa = await criarAdministrador();
        const adminAtiva = await criarAdministrador();
        const alvo = await criarUsuario({ ativo: true });
        const sessaoAlvo = await emitirCookieSessao(alvo.id);

        const [resInativa, resAtiva] = await Promise.all([
          requisitarAlterarSituacao(alvo.id, { ativo: false }, adminInativa.cookie),
          requisitarAlterarSituacao(alvo.id, { ativo: true }, adminAtiva.cookie),
        ]);
        expect(resInativa.status).toBe(200);
        expect(resInativa.body.ativo).toBe(false);
        expect(resAtiva.status).toBe(200);
        expect(resAtiva.body.ativo).toBe(true);

        // O alvo começa ativo, então a inativação é sempre transição real. Se a
        // ativação serializou antes, foi no-op (1 evento, final inativo); se
        // depois, reativou (2 eventos, final ativo com metadados limpos).
        const usuario = await lerUsuario(alvo.id);
        expect(await contarEventos("usuario.situacao.alterada", alvo.id)).toBe(usuario?.ativo ? 2 : 1);
        await provarInvarianteSituacao(alvo.id, [adminInativa.id]);

        // Em qualquer ordem a inativação ocorreu: a sessão prévia nunca volta a autorizar.
        const sessao = await lerSessao(sessaoAlvo.sessaoId);
        expect(sessao?.estado).toBe("REVOGADA");
        expect(sessao?.revogadaPorUsuarioId).toBe(adminInativa.id);
        expect((await sessoes.validar(sessaoAlvo.token)).valida).toBe(false);
      }
    });

    it("C5: revogação individual de sessão × inativação concorrentes revogam a sessão exatamente uma vez", async () => {
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const adminInativa = await criarAdministrador();
        const adminRevoga = await criarAdministrador();
        await darPermissao(adminRevoga.id, "sessoes.revogar_terceiro");
        const alvo = await criarUsuario({ ativo: true });
        const sessaoAlvo = await emitirCookieSessao(alvo.id);

        const [resInativa, resRevoga] = await Promise.all([
          requisitarAlterarSituacao(alvo.id, { ativo: false }, adminInativa.cookie),
          fetch(`${baseUrl}/auth/sessoes/${sessaoAlvo.sessaoId}`, {
            method: "DELETE",
            headers: {
              "content-type": "application/json",
              cookie: adminRevoga.cookie,
              [CABECALHO_REQUISICAO_TLF]: "1",
              "sec-fetch-site": "same-origin",
              "sec-fetch-mode": "cors",
              "sec-fetch-dest": "empty",
            },
          }),
        ]);
        expect(resInativa.status).toBe(200);
        expect(resRevoga.status).toBe(204);

        const sessao = await lerSessao(sessaoAlvo.sessaoId);
        expect(sessao?.estado).toBe("REVOGADA");
        expect([adminInativa.id, adminRevoga.id]).toContain(sessao?.revogadaPorUsuarioId);

        // A auditoria da revogação individual só existe se ela foi quem mutou.
        const eventosRevogacao = await contarEventos("usuario.sessao.revogacao", sessaoAlvo.sessaoId);
        expect(eventosRevogacao).toBe(sessao?.revogadaPorUsuarioId === adminRevoga.id ? 1 : 0);
        expect(await contarEventos("usuario.situacao.alterada", alvo.id)).toBe(1);
        await provarInvarianteSituacao(alvo.id, [adminInativa.id]);
      }
    });

    it("C6: conclusão de recuperação de senha × inativação: sem deadlock, sem sessão ATIVA e sem senha trocada quando a inativação vence", async () => {
      const NOVA_SENHA = "nova-senha-sintetica-concorrente-aut005";
      for (let rodada = 0; rodada < RODADAS; rodada++) {
        const admin = await criarAdministrador();
        const alvo = await criarUsuario({ ativo: true });
        await emitirCookieSessao(alvo.id);

        const inicio = await recuperacao.iniciar({ identificador: alvo.email, atorUsuarioId: admin.id });
        if (inicio.desfecho !== "EMITIDO") throw new Error(`início inesperado: ${inicio.desfecho}`);

        const [resConclusao, resInativa] = await Promise.all([
          recuperacao.concluir({ segredo: inicio.segredo, novaSenha: NOVA_SENHA, ip: `10.9.0.${rodada + 1}` }),
          requisitarAlterarSituacao(alvo.id, { ativo: false }, admin.cookie),
        ]);
        expect(resInativa.status).toBe(200);
        expect(["CONCLUIDA", "RECUPERACAO_INVALIDA"]).toContain(resConclusao.desfecho);

        const usuario = await lerUsuario(alvo.id);
        expect(usuario?.ativo).toBe(false);
        await provarInvarianteSituacao(alvo.id, [admin.id]);

        const senhaTrocada = !(await credenciais.verificarSenha(usuario!.senhaHash, SENHA));
        const eventosRecuperacao = await contarEventos("usuario.senha.recuperacao_concluida", alvo.id);
        if (resConclusao.desfecho === "CONCLUIDA") {
          // A recuperação serializou antes da inativação.
          expect(senhaTrocada).toBe(true);
          expect(eventosRecuperacao).toBe(1);
        } else {
          // A inativação venceu: a credencial NÃO pode ter sido trocada nem auditada.
          expect(senhaTrocada).toBe(false);
          expect(eventosRecuperacao).toBe(0);
        }
        expect(await contarEventos("usuario.situacao.alterada", alvo.id)).toBe(1);
      }
    });

    it("C7: requisições autenticadas em voo concorrentes com a inativação não mantêm nem ressuscitam a sessão", async () => {
      const admin = await criarAdministrador();
      const alvo = await criarUsuario({ ativo: true });
      const sessaoAlvo = await emitirCookieSessao(alvo.id);

      const consultar = (): Promise<number> =>
        fetch(`${baseUrl}/auth/sessao`, {
          method: "GET",
          headers: { cookie: sessaoAlvo.cookie, "sec-fetch-site": "same-origin" },
        }).then((r) => r.status);

      const [resInativa, ...statusEmVoo] = await Promise.all([
        requisitarAlterarSituacao(alvo.id, { ativo: false }, admin.cookie),
        ...Array.from({ length: 10 }, () => consultar()),
      ]);
      expect(resInativa.status).toBe(200);
      for (const status of statusEmVoo) expect([200, 401]).toContain(status);

      // Após o commit, nenhuma leitura em voo devolveu a sessão a ATIVA.
      const sessao = await lerSessao(sessaoAlvo.sessaoId);
      expect(sessao?.estado).toBe("REVOGADA");
      expect(sessao?.revogadaPorUsuarioId).toBe(admin.id);
      expect(await consultar()).toBe(401);
      expect((await sessoes.validar(sessaoAlvo.token)).valida).toBe(false);
      await provarInvarianteSituacao(alvo.id, [admin.id]);
    });
    it("C3 determinístico: inativação que comita entre a leitura do login e a emissão impede a sessão", async () => {
      const admin = await criarAdministrador();
      const alvo = await criarUsuario({ ativo: true });

      // Força a pior ordem: o login já leu `ativo = true` e conferiu a senha;
      // a inativação comita ANTES de o login abrir a transação de emissão.
      const original = credenciais.verificarComCaminhoDummy.bind(credenciais);
      let statusInativacao = 0;
      const spy = jest
        .spyOn(credenciais, "verificarComCaminhoDummy")
        .mockImplementationOnce(async (hash, senha) => {
          const confere = await original(hash, senha);
          statusInativacao = (await requisitarAlterarSituacao(alvo.id, { ativo: false }, admin.cookie)).status;
          return confere;
        });
      let resLogin;
      try {
        resLogin = await autenticacao.autenticar({ identificador: alvo.email, senha: SENHA, ip: "10.8.0.1" });
      } finally {
        spy.mockRestore();
      }

      expect(statusInativacao).toBe(200);
      expect(resLogin.desfecho).not.toBe("AUTENTICADO");
      expect(await database.transacao((tx) => tx.sessaoAutenticacao.count({ where: { usuarioId: alvo.id } }))).toBe(0);
      await provarInvarianteSituacao(alvo.id, [admin.id]);
    });

    it("C6 determinístico: inativação que comita durante o Argon2 da recuperação impede a troca de senha", async () => {
      const admin = await criarAdministrador();
      const alvo = await criarUsuario({ ativo: true });
      await emitirCookieSessao(alvo.id);
      const inicio = await recuperacao.iniciar({ identificador: alvo.email, atorUsuarioId: admin.id });
      if (inicio.desfecho !== "EMITIDO") throw new Error(`início inesperado: ${inicio.desfecho}`);

      // A conclusão já validou segredo e `ativo = true`; a inativação comita
      // enquanto o novo hash é calculado, antes da transação T-07.
      const original = credenciais.gerarHash.bind(credenciais);
      let statusInativacao = 0;
      const spy = jest.spyOn(credenciais, "gerarHash").mockImplementationOnce(async (senha) => {
        const hash = await original(senha);
        statusInativacao = (await requisitarAlterarSituacao(alvo.id, { ativo: false }, admin.cookie)).status;
        return hash;
      });
      let resConclusao;
      try {
        resConclusao = await recuperacao.concluir({
          segredo: inicio.segredo,
          novaSenha: "nova-senha-sintetica-deterministica",
          ip: "10.8.0.2",
        });
      } finally {
        spy.mockRestore();
      }

      expect(statusInativacao).toBe(200);
      expect(resConclusao.desfecho).toBe("RECUPERACAO_INVALIDA");
      const usuario = await lerUsuario(alvo.id);
      expect(await credenciais.verificarSenha(usuario!.senhaHash, SENHA)).toBe(true);
      expect(await contarEventos("usuario.senha.recuperacao_concluida", alvo.id)).toBe(0);
      await provarInvarianteSituacao(alvo.id, [admin.id]);
    });
  });
});
