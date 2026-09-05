// TechLab Fisio — Etapa 2.3D-B / F6 — recuperação de senha ponta a ponta
// contra PostgreSQL REAL (`T-AUTH-RECOVERY`, `docs/05` FC-01: "D-04 completo,
// incluindo reutilização e expiração do token").
//
// Caminho provado, inteiro e sem mock no meio: servidor HTTP real (porta
// efêmera) → `ProtecaoCsrfGuard` → [`SessaoAutenticadaGuard` →
// `PermissoesGuard`] → `RecuperacaoSenhaController` →
// `RecuperacaoSenhaService` → `LimitadorRecuperacao` / `CredencialService`
// (Argon2 real) / `SessaoService` / `AuditWriter` → `DatabaseService` →
// `tlf_app` → PostgreSQL 18 → `usuario`, `segredo_recuperacao_senha`,
// `sessao_autenticacao`, `evento_auditoria`.
//
// Propriedades MEDIDAS:
//   AUT-004 / D-04   início por Administrador autorizado; segredo apresentado
//                    uma vez; conclusão pelo usuário; senha nova autentica,
//                    antiga não; segredo invalidado; sessões revogadas;
//   `D-2.3D-08`      256 bits; só o hash persistido; 30 min; no máximo um
//                    pendente por usuário; conclusão não cria sessão;
//   RN-005 / T-07    consumo + senha + revogação + evento ATÔMICOS; replay e
//                    duplicidade impossíveis; concorrência determinística;
//   `D-2.3D-06`      10 tentativas / 15 min por IP, `429` + `Retry-After`,
//                    gate ANTES do Argon2;
//   RN-006           respostas uniformes; nenhum identificador no contrato de
//                    conclusão; nenhum segredo/senha/hash em log, resposta ou
//                    auditoria (TLF-BASE-V1 §10; `D-AUD-07`).
//
// DOIS RELÓGIOS CONTROLADOS, e só eles (precedente da F3): o da política de
// sessão/recuperação (`RELOGIO_SESSAO`) e o do limitador. Tudo o mais é real.
//
// Fixtures 100 % sintéticas; limpeza determinística entre testes (setup-db).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { criarClientePersistencia } from "@techlab-fisio/database";
import type { ClientePersistencia } from "@techlab-fisio/database";

import { AppModule } from "../../src/app.module.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { JANELA_MS } from "../../src/auth/dimensao-limite.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { POLITICA_SESSAO, SessaoService } from "../../src/auth/sessao.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import {
  LIMITE_TENTATIVAS_RECUPERACAO_POR_IP,
  LimitadorRecuperacao,
} from "../../src/recuperacao-senha/limitador-recuperacao.js";
import { POLITICA_RECUPERACAO } from "../../src/recuperacao-senha/recuperacao-senha.service.js";
import { calcularHashSegredoRecuperacao } from "../../src/recuperacao-senha/segredo-recuperacao.js";
import { urlObrigatoria } from "./helpers-integracao.js";

const MINUTO = 60_000;

/** Instante-base fixo — a suíte nunca depende do relógio da máquina. */
const T0 = new Date("2026-08-25T10:00:00.000Z");

/** Senhas sintéticas. Nenhum dado real. */
const SENHA = "senha-sintetica-f6-antiga";
const NOVA_SENHA = "senha-sintetica-f6-NOVA";

const ROTA_INICIO = "/auth/recuperacao-senha";
const ROTA_CONCLUSAO = "/auth/recuperacao-senha/concluir";

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

class RelogioLimitador {
  #agora = T0.getTime();
  ler = (): number => this.#agora;
  avancar(ms: number): void {
    this.#agora += ms;
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
const relogioLimitador = new RelogioLimitador();
const limitador = new LimitadorRecuperacao({ agora: relogioLimitador.ler });

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RELOGIO_SESSAO)
    .useValue(relogio)
    .overrideProvider(LimitadorRecuperacao)
    .useValue(limitador)
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
  // Todas as requisições saem do mesmo socket de loopback: avança a janela do
  // limitador entre testes pelo comportamento de PRODUÇÃO (expiração), nunca
  // por reset artificial.
  relogioLimitador.avancar(JANELA_MS + 1);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface UsuarioFixture {
  readonly id: string;
  readonly email: string;
}

async function criarUsuario(opcoes?: { ativo?: boolean; email?: string }): Promise<UsuarioFixture> {
  const email = opcoes?.email ?? `f6-${randomUUID().slice(0, 8)}@sintetico.local`;
  return database.transacao(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { email, senhaHash: hashDaSenha, nome: "Usuário Sintético F6", ativo: opcoes?.ativo ?? true },
      select: { id: true },
    });
    return { id: usuario.id, email };
  });
}

/** Papel de teste com as permissões informadas, vinculado ao usuário. */
async function darPapel(usuarioId: string, codigos: readonly string[]): Promise<void> {
  await database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `papel-f6-${randomUUID().slice(0, 8)}`, nome: "Papel F6" },
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

/** Administrador sintético: usuário + papel com `senha.recuperar_terceiro` + sessão. */
async function criarAdministrador(): Promise<UsuarioFixture & { cookie: string }> {
  const admin = await criarUsuario();
  await darPapel(admin.id, ["senha.recuperar_terceiro"]);
  return { ...admin, cookie: await cookieDe(admin.id) };
}

async function cookieDe(usuarioId: string): Promise<string> {
  const emitida = await sessoes.emitir({ usuarioId });
  return `${politicaCookie.nome}=${emitida.token}`;
}

async function inativar(usuarioId: string): Promise<void> {
  // Estado ARTIFICIAL, escrito diretamente na persistência: AUT-005 (fluxo de
  // inativação de usuário) NÃO está materializada e esta suíte não a prova.
  await database.transacao(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { ativo: false } });
  });
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

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

async function postar(
  rota: string,
  corpo: unknown,
  opcoes?: { cabecalhos?: Record<string, string>; corpoBruto?: string },
): Promise<RespostaMedida> {
  return medir(
    await fetch(`${baseUrl}${rota}`, {
      method: "POST",
      headers: opcoes?.cabecalhos ?? cabecalhosLegitimos(),
      body: opcoes?.corpoBruto ?? JSON.stringify(corpo),
    }),
  );
}

async function iniciar(cookie: string, identificador: string): Promise<RespostaMedida> {
  return postar(ROTA_INICIO, { identificador }, { cabecalhos: cabecalhosLegitimos({ cookie }) });
}

async function concluir(segredo: unknown, novaSenha: unknown = NOVA_SENHA): Promise<RespostaMedida> {
  return postar(ROTA_CONCLUSAO, { segredo, novaSenha });
}

/** Início bem-sucedido, devolvendo o segredo apresentado uma única vez. */
async function emitirSegredo(alvo: UsuarioFixture): Promise<{ segredo: string; expiraEm: string }> {
  const admin = await criarAdministrador();
  const resposta = await iniciar(admin.cookie, alvo.email);
  expect(resposta.status).toBe(201);
  const corpo = resposta.corpo as { segredo: string; expiraEm: string };
  expect(corpo.segredo).toMatch(/^[A-Za-z0-9_-]{43}$/);
  return corpo;
}

async function login(identificador: string, senha: string): Promise<RespostaMedida> {
  return postar("/auth/login", { identificador, senha });
}

async function logout(token: string): Promise<RespostaMedida> {
  return medir(
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: cabecalhosLegitimos({ cookie: `${politicaCookie.nome}=${token}` }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Leituras do banco
// ---------------------------------------------------------------------------

interface SegredoLinha {
  id: string;
  usuario_id: string;
  hash_segredo: string;
  expira_em: Date;
  consumido_em: Date | null;
  criado_por_usuario_id: string;
  criado_em: Date;
}

async function lerSegredos(): Promise<SegredoLinha[]> {
  return database.transacao(async (tx) =>
    tx.$queryRaw<SegredoLinha[]>`
      SELECT id, usuario_id, hash_segredo, expira_em, consumido_em, criado_por_usuario_id, criado_em
        FROM segredo_recuperacao_senha ORDER BY criado_em, id
    `,
  );
}

async function contarPendentes(usuarioId: string): Promise<number> {
  const agora = relogio.agora();
  return database.transacao(async (tx) =>
    tx.segredoRecuperacaoSenha.count({
      where: { usuarioId, consumidoEm: null, expiraEm: { gt: agora } },
    }),
  );
}

interface EventoMedido {
  acao: string;
  resultado: string;
  ator_usuario_id: string | null;
  alvo_tipo: string;
  alvo_id: string | null;
  contexto: unknown;
  justificativa: string | null;
}

async function lerEventos(): Promise<EventoMedido[]> {
  return database.transacao(async (tx) =>
    tx.$queryRaw<EventoMedido[]>`
      SELECT acao, resultado, ator_usuario_id, alvo_tipo, alvo_id, contexto, justificativa
        FROM evento_auditoria ORDER BY ocorrido_em, id
    `,
  );
}

function eventosDe(eventos: readonly EventoMedido[], acao: string): EventoMedido[] {
  return eventos.filter((e) => e.acao === acao);
}

interface SessaoLinha {
  id: string;
  estado: string;
  usuario_id: string;
  encerrada_em: Date | null;
  revogada_por_usuario_id: string | null;
  expira_em: Date;
}

async function lerSessoesDe(usuarioId: string): Promise<SessaoLinha[]> {
  return database.transacao(async (tx) =>
    tx.$queryRaw<SessaoLinha[]>`
      SELECT id, estado, usuario_id, encerrada_em, revogada_por_usuario_id, expira_em
        FROM sessao_autenticacao WHERE usuario_id = ${usuarioId}::uuid ORDER BY criada_em
    `,
  );
}

async function hashDaSenhaDe(usuarioId: string): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { senhaHash: true } });
    return u.senhaHash;
  });
}

// ===========================================================================
// INÍCIO — POST /auth/recuperacao-senha
// ===========================================================================

describe("Início — caminho feliz (AUT-004 passos 1–3; D-2.3D-08)", () => {
  it("Administrador autorizado recebe 201 com o segredo apresentado UMA vez e expiraEm = +30 min", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const resposta = await iniciar(admin.cookie, alvo.email);

    expect(resposta.status).toBe(201);
    expect(Object.keys(resposta.corpo as object).sort()).toEqual(["expiraEm", "segredo"]);
    const corpo = resposta.corpo as { segredo: string; expiraEm: string };
    expect(corpo.segredo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(corpo.expiraEm).toBe(new Date(T0.getTime() + POLITICA_RECUPERACAO.validadeMs).toISOString());
    expect(POLITICA_RECUPERACAO.validadeMs).toBe(30 * MINUTO);
    // Nenhum cookie e nenhum usuarioId do alvo saem daqui.
    expect(resposta.cookies).toEqual([]);
    expect(JSON.stringify(resposta.corpo)).not.toContain(alvo.id);
  });

  it("só o HASH SHA-256 é persistido — o segredo em claro não aparece em coluna alguma", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const { segredo } = (await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string };

    const linhas = await lerSegredos();
    expect(linhas).toHaveLength(1);
    const linha = linhas[0] as SegredoLinha;
    expect(linha.usuario_id).toBe(alvo.id);
    expect(linha.criado_por_usuario_id).toBe(admin.id);
    expect(linha.hash_segredo).toBe(calcularHashSegredoRecuperacao(segredo));
    expect(linha.consumido_em).toBeNull();
    expect(linha.expira_em.getTime()).toBe(T0.getTime() + POLITICA_RECUPERACAO.validadeMs);
    // O instante de criação vem do RELÓGIO DA APLICAÇÃO, não do default do banco.
    expect(linha.criado_em.getTime()).toBe(T0.getTime());
    expect(JSON.stringify(linhas)).not.toContain(segredo);
  });

  it("é auditado como usuario.senha.recuperacao_iniciada/SUCESSO — ator Administrador, alvo usuário, sem contexto", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const { segredo } = (await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string };

    const eventos = eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      resultado: "SUCESSO",
      ator_usuario_id: admin.id,
      alvo_tipo: "usuario",
      alvo_id: alvo.id,
      justificativa: null,
    });
    expect(eventos[0]?.contexto ?? {}).toEqual({});
    const serializado = JSON.stringify(
      await database.transacao(async (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM evento_auditoria`),
    );
    expect(serializado).not.toContain(segredo);
    expect(serializado).not.toContain(calcularHashSegredoRecuperacao(segredo));
    expect(serializado).not.toContain(alvo.email);
  });

  it("o início NÃO afeta as sessões do alvo nem a senha dele", async () => {
    const alvo = await criarUsuario();
    const antes = await hashDaSenhaDe(alvo.id);
    const { token } = await sessoes.emitir({ usuarioId: alvo.id });
    await emitirSegredo(alvo);

    expect((await lerSessoesDe(alvo.id)).map((s) => s.estado)).toEqual(["ATIVA"]);
    expect(await hashDaSenhaDe(alvo.id)).toBe(antes);
    expect((await logout(token)).status).toBe(204);
  });

  it("D-2.3D-03 — o identificador do alvo é normalizado por trim + lowercase", async () => {
    const alvo = await criarUsuario({ email: "alvo-normalizado-f6@sintetico.local" });
    const admin = await criarAdministrador();
    const resposta = await iniciar(admin.cookie, "  ALVO-NORMALIZADO-F6@SINTETICO.LOCAL  ");
    expect(resposta.status).toBe(201);
    expect((await lerSegredos())[0]?.usuario_id).toBe(alvo.id);
  });
});

describe("Início — autenticação, autorização e CSRF", () => {
  it("sem sessão => 401 SESSAO_INVALIDA; nada é emitido nem auditado", async () => {
    const alvo = await criarUsuario();
    const resposta = await postar(ROTA_INICIO, { identificador: alvo.email });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
    expect(await lerSegredos()).toHaveLength(0);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("sessão revogada => 401", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const token = admin.cookie.split("=")[1] as string;
    await sessoes.revogar(token);
    expect((await iniciar(admin.cookie, alvo.email)).status).toBe(401);
    expect(await lerSegredos()).toHaveLength(0);
  });

  it("autenticado SEM senha.recuperar_terceiro => 403 ACESSO_NEGADO — inclusive com usuarios.gerenciar", async () => {
    const alvo = await criarUsuario();
    const semPermissao = await criarUsuario();
    const outraPermissao = await criarUsuario();
    await darPapel(outraPermissao.id, ["usuarios.gerenciar", "permissoes.gerenciar"]);
    for (const usuario of [semPermissao, outraPermissao]) {
      const resposta = await iniciar(await cookieDe(usuario.id), alvo.email);
      expect(resposta.status).toBe(403);
      expect(resposta.corpo).toEqual({ erro: "ACESSO_NEGADO" });
    }
    expect(await lerSegredos()).toHaveLength(0);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(0);
  });

  it("sem o custom header CSRF => 403 REQUISICAO_NAO_AUTORIZADA, mesmo com sessão e permissão", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const resposta = await postar(
      ROTA_INICIO,
      { identificador: alvo.email },
      { cabecalhos: { "content-type": "application/json", cookie: admin.cookie } },
    );
    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_NAO_AUTORIZADA" });
    expect(await lerSegredos()).toHaveLength(0);
  });

  it("o ator do evento é a identidade da SESSÃO — um `atorUsuarioId` no corpo é ignorado", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const forjado = randomUUID();
    const resposta = await postar(
      ROTA_INICIO,
      { identificador: alvo.email, atorUsuarioId: forjado, usuarioId: forjado },
      { cabecalhos: cabecalhosLegitimos({ cookie: admin.cookie }) },
    );
    expect(resposta.status).toBe(201);
    expect((await lerSegredos())[0]?.criado_por_usuario_id).toBe(admin.id);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")[0]?.ator_usuario_id).toBe(admin.id);
  });
});

describe("Início — rejeições uniformes", () => {
  it.each([
    ["campo ausente", {}],
    ["tipo errado", { identificador: 7 }],
    ["vazio", { identificador: "" }],
    ["só espaços", { identificador: "   " }],
    ["array", [{ identificador: "a@b.local" }]],
  ])("payload inválido (%s) => 400 sem segredo e sem evento", async (_rotulo, corpo) => {
    const admin = await criarAdministrador();
    const resposta = await postar(ROTA_INICIO, corpo, { cabecalhos: cabecalhosLegitimos({ cookie: admin.cookie }) });
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    expect(await lerSegredos()).toHaveLength(0);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(0);
  });

  it("JSON sintaticamente inválido devolve o CONTRATO FECHADO, não o erro do parser", async () => {
    const admin = await criarAdministrador();
    const resposta = await postar(ROTA_INICIO, null, {
      cabecalhos: cabecalhosLegitimos({ cookie: admin.cookie }),
      corpoBruto: "{não é json",
    });
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
  });

  it("alvo INEXISTENTE, INATIVO e o PRÓPRIO ator recebem o MESMO 422 — sem segredo, sem evento", async () => {
    const admin = await criarAdministrador();
    const inativo = await criarUsuario({ ativo: false });
    const respostas = [
      await iniciar(admin.cookie, "inexistente-f6@sintetico.local"),
      await iniciar(admin.cookie, inativo.email),
      await iniciar(admin.cookie, admin.email),
    ];
    for (const resposta of respostas) {
      expect(resposta.status).toBe(422);
      expect(resposta.corpo).toEqual({ erro: "ALVO_NAO_ELEGIVEL" });
      expect(resposta.cookies).toEqual([]);
    }
    const [a, b, c] = respostas.map((r) => [...r.headers.keys()].filter((h) => h !== "date").sort().join(","));
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(await lerSegredos()).toHaveLength(0);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(0);
  });

  it("falha na auditoria REVERTE o início: 500 FALHA_INTERNA e nenhum segredo persistido", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const auditWriter = moduleRef.get(AuditWriter);
    const original = auditWriter.registrar.bind(auditWriter);
    const espia = jest.spyOn(auditWriter, "registrar").mockImplementation(async (tx, evento) => {
      if (evento.acao === "usuario.senha.recuperacao_iniciada") {
        throw new Error("falha sintetica de auditoria: hash_segredo=nao-deve-vazar");
      }
      return original(tx, evento);
    });
    try {
      const resposta = await iniciar(admin.cookie, alvo.email);
      expect(resposta.status).toBe(500);
      expect(resposta.corpo).toEqual({ erro: "FALHA_INTERNA" });
      expect(JSON.stringify(resposta.corpo)).not.toContain("nao-deve-vazar");
    } finally {
      espia.mockRestore();
    }
    expect(await lerSegredos()).toHaveLength(0);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(0);
  });
});

describe("D-2.3D-08 — no máximo UM segredo pendente por usuário", () => {
  it("um novo início EXPIRA o anterior: o segredo antigo é recusado e só o novo conclui", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const primeiro = ((await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string }).segredo;
    relogio.avancar(5 * MINUTO);
    const segundo = ((await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string }).segredo;
    expect(segundo).not.toBe(primeiro);

    const linhas = await lerSegredos();
    expect(linhas).toHaveLength(2);
    // O anterior foi EXPIRADO (expira_em = instante da nova emissão), não "consumido".
    expect(linhas[0]?.expira_em.getTime()).toBe(T0.getTime() + 5 * MINUTO);
    expect(linhas[0]?.consumido_em).toBeNull();
    expect(await contarPendentes(alvo.id)).toBe(1);

    const antiga = await concluir(primeiro);
    expect(antiga.status).toBe(401);
    expect(antiga.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
    expect((await concluir(segundo)).status).toBe(204);
  });

  it("dois inícios CONCORRENTES para o mesmo alvo: ambos 201, EXATAMENTE um pendente, um só conclui", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const [a, b] = await Promise.all([iniciar(admin.cookie, alvo.email), iniciar(admin.cookie, alvo.email)]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(await contarPendentes(alvo.id)).toBe(1);
    expect(await lerSegredos()).toHaveLength(2);

    const segredos = [a, b].map((r) => (r.corpo as { segredo: string }).segredo);
    const desfechos = [];
    for (const segredo of segredos) desfechos.push((await concluir(segredo)).status);
    expect(desfechos.sort()).toEqual([204, 401]);
  });

  it("segredos pendentes de usuários DIFERENTES não interferem", async () => {
    const a = await criarUsuario();
    const b = await criarUsuario();
    const admin = await criarAdministrador();
    const sa = ((await iniciar(admin.cookie, a.email)).corpo as { segredo: string }).segredo;
    const sb = ((await iniciar(admin.cookie, b.email)).corpo as { segredo: string }).segredo;
    expect(await contarPendentes(a.id)).toBe(1);
    expect(await contarPendentes(b.id)).toBe(1);
    expect((await concluir(sa)).status).toBe(204);
    expect((await concluir(sb)).status).toBe(204);
  });
});

// ===========================================================================
// CONCLUSÃO — POST /auth/recuperacao-senha/concluir
// ===========================================================================

describe("Conclusão — caminho feliz (AUT-004 passos 4–7; RN-005; T-07)", () => {
  it("204 sem corpo e SEM cookie; a nova senha autentica e a antiga não", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    const resposta = await concluir(segredo);
    expect(resposta.status).toBe(204);
    expect(resposta.corpo).toBeNull();
    expect(resposta.cookies).toEqual([]);

    expect((await login(alvo.email, SENHA)).status).toBe(401);
    const nova = await login(alvo.email, NOVA_SENHA);
    expect(nova.status).toBe(200);
    expect((nova.corpo as { usuarioId: string }).usuarioId).toBe(alvo.id);
  });

  it("a senha é processada pelo Argon2id da F1 — digest PHC novo, distinto do anterior, e a senha em claro não é persistida", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    await concluir(segredo);
    const hash = await hashDaSenhaDe(alvo.id);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toBe(hashDaSenha);
    expect(hash).not.toContain(NOVA_SENHA);
    expect(credenciais.precisaRehash(hash)).toBe(false);
    expect(await credenciais.verificarSenha(hash, NOVA_SENHA)).toBe(true);
  });

  it("o segredo é CONSUMIDO (consumido_em = instante) e deixa de estar pendente", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    relogio.avancar(2 * MINUTO);
    await concluir(segredo);
    const linha = (await lerSegredos())[0] as SegredoLinha;
    expect(linha.consumido_em?.getTime()).toBe(T0.getTime() + 2 * MINUTO);
    expect(await contarPendentes(alvo.id)).toBe(0);
  });

  it("TODAS as sessões ATIVA anteriores viram REVOGADA, com revogada_por = o próprio usuário — e deixam de autorizar", async () => {
    const alvo = await criarUsuario();
    const s1 = await sessoes.emitir({ usuarioId: alvo.id });
    const s2 = await sessoes.emitir({ usuarioId: alvo.id });
    const outro = await criarUsuario();
    const sOutro = await sessoes.emitir({ usuarioId: outro.id });
    const { segredo } = await emitirSegredo(alvo);
    relogio.avancar(3 * MINUTO);

    expect((await concluir(segredo)).status).toBe(204);

    const linhas = await lerSessoesDe(alvo.id);
    expect(linhas).toHaveLength(2);
    for (const linha of linhas) {
      expect(linha.estado).toBe("REVOGADA");
      expect(linha.revogada_por_usuario_id).toBe(alvo.id);
      expect(linha.encerrada_em?.getTime()).toBe(T0.getTime() + 3 * MINUTO);
    }
    // AUT-002: token de sessão encerrada não autoriza novas operações.
    for (const token of [s1.token, s2.token]) {
      const r = await logout(token);
      expect(r.status).toBe(401);
      expect(r.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
    }
    // Sessões de OUTRO usuário não são tocadas.
    expect((await lerSessoesDe(outro.id))[0]?.estado).toBe("ATIVA");
    expect((await logout(sOutro.token)).status).toBe(204);
  });

  it("sessão já vencida por ociosidade é fechada como EXPIRADA, não REVOGADA (estado verdadeiro, precedente C-01)", async () => {
    const alvo = await criarUsuario();
    await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);
    relogio.avancar(POLITICA_SESSAO.timeoutOciosoMs);
    const viva = await sessoes.emitir({ usuarioId: alvo.id });
    expect((await concluir(segredo)).status).toBe(204);
    const linhas = await lerSessoesDe(alvo.id);
    expect(linhas.map((l) => l.estado)).toEqual(["EXPIRADA", "REVOGADA"]);
    expect(linhas[0]?.revogada_por_usuario_id).toBeNull();
    expect((await logout(viva.token)).status).toBe(401);
  });

  it("é auditado como usuario.senha.recuperacao_concluida/SUCESSO — ator = usuário, alvo = usuário, sem contexto, sem segredo/senha", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    await concluir(segredo);
    const eventos = eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      resultado: "SUCESSO",
      ator_usuario_id: alvo.id,
      alvo_tipo: "usuario",
      alvo_id: alvo.id,
      justificativa: null,
    });
    expect(eventos[0]?.contexto ?? {}).toEqual({});
    const serializado = JSON.stringify(
      await database.transacao(async (tx) => tx.$queryRaw<unknown[]>`SELECT * FROM evento_auditoria`),
    );
    for (const proibido of [segredo, NOVA_SENHA, SENHA, "$argon2", calcularHashSegredoRecuperacao(segredo)]) {
      expect(serializado).not.toContain(proibido);
    }
  });

  it("a conclusão NÃO cria sessão (D-2.3D-08) — nenhuma linha nova em sessao_autenticacao", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    await concluir(segredo);
    expect(await lerSessoesDe(alvo.id)).toHaveLength(0);
  });

  it("depois de concluída, um NOVO início emite um novo segredo que também conclui (ciclo completo, sem resíduo)", async () => {
    const alvo = await criarUsuario();
    const primeiro = (await emitirSegredo(alvo)).segredo;
    expect((await concluir(primeiro, "senha-f6-um")).status).toBe(204);
    const segundo = (await emitirSegredo(alvo)).segredo;
    expect((await concluir(segundo, "senha-f6-dois")).status).toBe(204);
    expect((await login(alvo.email, "senha-f6-um")).status).toBe(401);
    expect((await login(alvo.email, "senha-f6-dois")).status).toBe(200);
  });
});

describe("Conclusão — replay, expiração, inválido, inativo (respostas uniformes)", () => {
  it("REPLAY: o segundo uso do MESMO segredo é recusado; a senha permanece a da primeira conclusão; um único evento", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    expect((await concluir(segredo, "senha-f6-primeira")).status).toBe(204);
    const replay = await concluir(segredo, "senha-f6-replay");
    expect(replay.status).toBe(401);
    expect(replay.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
    expect((await login(alvo.email, "senha-f6-primeira")).status).toBe(200);
    expect((await login(alvo.email, "senha-f6-replay")).status).toBe(401);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(1);
  });

  it("EXPIRAÇÃO: um milissegundo antes de 30 min conclui; EXATAMENTE em 30 min é recusado", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    relogio.definir(new Date(T0.getTime() + POLITICA_RECUPERACAO.validadeMs));
    const expirado = await concluir(segredo);
    expect(expirado.status).toBe(401);
    expect(expirado.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashDaSenha);

    const alvo2 = await criarUsuario();
    relogio.reiniciar();
    const s2 = (await emitirSegredo(alvo2)).segredo;
    relogio.definir(new Date(T0.getTime() + POLITICA_RECUPERACAO.validadeMs - 1));
    expect((await concluir(s2)).status).toBe(204);
  });

  it("segredo malformado, inexistente e ALTERADO em um caractere recebem o MESMO 401 — sem Argon2", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    const alterado = `${segredo.slice(0, 42)}${segredo.endsWith("A") ? "B" : "A"}`;
    const espia = jest.spyOn(credenciais, "gerarHash");
    try {
      const respostas = [
        await concluir("malformado"),
        await concluir("a".repeat(43)),
        await concluir(alterado),
        await concluir(`${segredo}x`),
      ];
      for (const r of respostas) {
        expect(r.status).toBe(401);
        expect(r.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
        expect(r.cookies).toEqual([]);
      }
      expect(espia).not.toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
    expect(await contarPendentes(alvo.id)).toBe(1);
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashDaSenha);
  });

  it("controle positivo: o segredo válido DE FATO executa o Argon2", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    const espia = jest.spyOn(credenciais, "gerarHash");
    try {
      expect((await concluir(segredo)).status).toBe(204);
      expect(espia).toHaveBeenCalledTimes(1);
    } finally {
      espia.mockRestore();
    }
  });

  it("usuário INATIVADO após a emissão é recusado com o MESMO 401; segredo não consumido; senha intacta", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    await inativar(alvo.id);
    const resposta = await concluir(segredo);
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
    expect((await lerSegredos())[0]?.consumido_em).toBeNull();
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashDaSenha);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(0);
  });

  it("nenhuma tentativa RECUSADA gera evento de auditoria (só a conclusão é auditada)", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    await concluir("a".repeat(43));
    relogio.definir(new Date(T0.getTime() + POLITICA_RECUPERACAO.validadeMs));
    await concluir(segredo);
    const eventos = await lerEventos();
    expect(eventosDe(eventos, "usuario.senha.recuperacao_concluida")).toHaveLength(0);
    expect(eventos.every((e) => e.acao === "usuario.senha.recuperacao_iniciada")).toBe(true);
  });

  it.each([
    ["segredo ausente", { novaSenha: "x" }],
    ["senha ausente", { segredo: "a".repeat(43) }],
    ["tipos errados", { segredo: 1, novaSenha: 2 }],
    ["senha vazia", { segredo: "a".repeat(43), novaSenha: "" }],
  ])("payload inválido (%s) => 400 e NÃO conta como tentativa", async (_rotulo, corpo) => {
    // Poda as entradas vencidas do loopback (qualquer forma) pelo comportamento
    // de produção, para que o contador parta de um estado conhecido.
    for (const ip of ["127.0.0.1", "::1"]) limitador.consultar(ip);
    const antes = limitador.medirEntradas();
    expect(antes).toBe(0);
    const resposta = await postar(ROTA_CONCLUSAO, corpo);
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    expect(limitador.medirEntradas()).toBe(antes);
    // Controle positivo: uma tentativa BEM-FORMADA de fato conta.
    expect((await concluir("a".repeat(43))).status).toBe(401);
    expect(limitador.medirEntradas()).toBe(1);
  });

  it("sem o custom header CSRF => 403, sem tocar o segredo", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    const resposta = await postar(
      ROTA_CONCLUSAO,
      { segredo, novaSenha: NOVA_SENHA },
      { cabecalhos: { "content-type": "application/json" } },
    );
    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_NAO_AUTORIZADA" });
    expect(await contarPendentes(alvo.id)).toBe(1);
  });

  it("nenhuma resposta de erro carrega stack, hash, SQL, segredo ou senha", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    const admin = await criarAdministrador();
    const respostas = [
      await concluir("x"),
      await concluir(segredo, ""),
      await postar(ROTA_CONCLUSAO, null, { corpoBruto: "{quebrado" }),
      await iniciar(admin.cookie, "ninguem@sintetico.local"),
      await postar(ROTA_INICIO, { identificador: alvo.email }),
    ];
    for (const r of respostas) {
      const texto = JSON.stringify(r.corpo);
      for (const proibido of ["at ", "$argon2", "prisma", "Prisma", "SELECT", "segredo_recuperacao", "senha_hash", segredo, NOVA_SENHA, "Bad Request", "position"]) {
        expect(texto).not.toContain(proibido);
      }
    }
  });
});

describe("D-2.3D-06 — rate limiting da conclusão (10 tentativas / 15 min por IP)", () => {
  it("a 11ª tentativa do mesmo IP recebe 429 com Retry-After — mesmo com o segredo CORRETO", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) {
      expect((await concluir("a".repeat(43))).status).toBe(401);
    }
    const bloqueada = await concluir(segredo);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.corpo).toEqual({ erro: "TENTATIVAS_EXCEDIDAS" });
    const retryAfter = Number.parseInt(bloqueada.headers.get("retry-after") ?? "", 10);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(JANELA_MS / 1000);
    // O segredo correto NÃO foi consumido pela tentativa bloqueada.
    expect(await contarPendentes(alvo.id)).toBe(1);
  });

  it("ORDEM — a tentativa bloqueada não consulta o banco nem executa Argon2", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) await concluir("a".repeat(43));
    const espiaHash = jest.spyOn(credenciais, "gerarHash");
    const espiaBanco = jest.spyOn(database, "transacao");
    try {
      expect((await concluir(segredo)).status).toBe(429);
      expect(espiaHash).not.toHaveBeenCalled();
      expect(espiaBanco).not.toHaveBeenCalled();
    } finally {
      espiaHash.mockRestore();
      espiaBanco.mockRestore();
    }
  });

  it("a janela LIBERA após 15 minutos — não existe lockout duro", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) await concluir("a".repeat(43));
    expect((await concluir(segredo)).status).toBe(429);
    relogioLimitador.avancar(JANELA_MS + 1);
    expect((await concluir(segredo)).status).toBe(204);
  });

  it("tentativas BEM-SUCEDIDAS também contam (leitura literal: 'tentativas')", async () => {
    const admin = await criarAdministrador();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) {
      const alvo = await criarUsuario();
      const s = ((await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string }).segredo;
      expect((await concluir(s)).status).toBe(204);
    }
    expect((await concluir("a".repeat(43))).status).toBe(429);
  });

  it("X-Forwarded-For NÃO abre orçamento novo — a dimensão de IP é do socket (L-05)", async () => {
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) await concluir("a".repeat(43));
    const resposta = await postar(
      ROTA_CONCLUSAO,
      { segredo: "a".repeat(43), novaSenha: NOVA_SENHA },
      { cabecalhos: cabecalhosLegitimos({ "x-forwarded-for": "198.51.100.77" }) },
    );
    expect(resposta.status).toBe(429);
  });
});

describe("T-07 — atomicidade, rollback e concorrência", () => {
  it("falha na auditoria REVERTE tudo: 500, segredo pendente, senha antiga, sessões ATIVA — e o segredo continua utilizável", async () => {
    const alvo = await criarUsuario();
    const sessao = await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);
    const auditWriter = moduleRef.get(AuditWriter);
    const original = auditWriter.registrar.bind(auditWriter);
    const espia = jest.spyOn(auditWriter, "registrar").mockImplementation(async (tx, evento) => {
      if (evento.acao === "usuario.senha.recuperacao_concluida") throw new Error("falha sintetica de auditoria");
      return original(tx, evento);
    });
    try {
      const resposta = await concluir(segredo);
      expect(resposta.status).toBe(500);
      expect(resposta.corpo).toEqual({ erro: "FALHA_INTERNA" });
    } finally {
      espia.mockRestore();
    }
    expect((await lerSegredos())[0]?.consumido_em).toBeNull();
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashDaSenha);
    expect((await lerSessoesDe(alvo.id))[0]?.estado).toBe("ATIVA");
    expect((await login(alvo.email, SENHA)).status).toBe(200);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(0);
    // Nada foi consumido: a mesma recuperação conclui quando a auditoria volta.
    expect((await concluir(segredo)).status).toBe(204);
    expect((await logout(sessao.token)).status).toBe(401);
  });

  it("falha do HASHING (Argon2) => 500; segredo não consumido; senha intacta; sessões intactas", async () => {
    const alvo = await criarUsuario();
    await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);
    const espia = jest.spyOn(credenciais, "gerarHash").mockRejectedValue(new Error("addon nativo indisponivel"));
    try {
      const resposta = await concluir(segredo);
      expect(resposta.status).toBe(500);
      expect(resposta.corpo).toEqual({ erro: "FALHA_INTERNA" });
    } finally {
      espia.mockRestore();
    }
    expect((await lerSegredos())[0]?.consumido_em).toBeNull();
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashDaSenha);
    expect((await lerSessoesDe(alvo.id))[0]?.estado).toBe("ATIVA");
    expect((await concluir(segredo)).status).toBe(204);
  });

  it("DUAS conclusões SIMULTÂNEAS com o mesmo segredo: exatamente uma vence; a outra recebe o 401 uniforme", async () => {
    const alvo = await criarUsuario();
    await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);

    // Barreira no Argon2: as duas passam a verificação de aptidão e entram na
    // transação de consumo ao mesmo tempo — o estado exato em que só o UPDATE
    // condicional decide.
    let chegaram = 0;
    let abrir: () => void = () => undefined;
    const barreira = new Promise<void>((resolver) => {
      abrir = resolver;
    });
    const original = credenciais.gerarHash.bind(credenciais);
    const espia = jest.spyOn(credenciais, "gerarHash").mockImplementation(async (senha) => {
      chegaram += 1;
      await barreira;
      return original(senha);
    });
    try {
      const lote = Promise.all([concluir(segredo, "senha-f6-A"), concluir(segredo, "senha-f6-B")]);
      for (let i = 0; i < 600 && chegaram < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
      expect(chegaram).toBe(2);
      abrir();
      const [a, b] = await lote;
      expect([a.status, b.status].sort()).toEqual([204, 401]);
      const perdedora = a.status === 401 ? a : b;
      expect(perdedora.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });
    } finally {
      espia.mockRestore();
    }

    const linhas = await lerSegredos();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.consumido_em).not.toBeNull();
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(1);
    const hash = await hashDaSenhaDe(alvo.id);
    const aceitaA = await credenciais.verificarSenha(hash, "senha-f6-A");
    const aceitaB = await credenciais.verificarSenha(hash, "senha-f6-B");
    expect([aceitaA, aceitaB].filter(Boolean)).toHaveLength(1);
    expect((await lerSessoesDe(alvo.id))[0]?.estado).toBe("REVOGADA");
  });

  it("login concorrente com a senha ANTIGA não ressuscita a credencial superada (rehash condicionado — F-04)", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    expect((await concluir(segredo)).status).toBe(204);
    // Depois da conclusão, a senha antiga é simplesmente inválida.
    expect((await login(alvo.email, SENHA)).status).toBe(401);
    expect((await login(alvo.email, NOVA_SENHA)).status).toBe(200);
  });
});

// ===========================================================================
// ORDEM DE LOCKS — serialização MEDIDA, não inferida
//
// Os dois testes abaixo não observam apenas o estado final: eles constatam,
// consultando `pg_stat_activity`/`pg_blocking_pids` do próprio PostgreSQL,
// que a transação que deveria esperar está DE FATO esperando um lock. É essa
// constatação — e não um `Promise.all` cujo entrelaçamento o scheduler
// decide — que dá poder de mutação às provas:
//
//   - remover o `FOR UPDATE` de `iniciar` faz o segundo início atravessar sem
//     bloquear: a espera por um backend bloqueado estoura com mensagem
//     própria, e o estado final passa a ter DOIS segredos pendentes;
//   - restaurar a ordem antiga de locks em `concluir` (segredo antes de
//     `usuario`) fecha o ciclo de espera: o PostgreSQL aborta um dos lados com
//     `40P01` e a resposta correspondente vira `500 FALHA_INTERNA`.
// ===========================================================================

/**
 * Espera BALIZADA por uma condição, com mensagem própria ao estourar — o
 * fracasso é atribuível à condição violada, e não ao timeout global do Jest.
 */
async function esperarAte(
  condicao: () => Promise<boolean> | boolean,
  oQue: string,
  limiteMs = 3_000,
): Promise<void> {
  const fim = Date.now() + limiteMs;
  for (;;) {
    if (await condicao()) return;
    if (Date.now() >= fim) {
      throw new Error(`Tempo esgotado (${String(limiteMs)} ms) esperando ${oQue}.`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Quantos backends deste banco estão parados esperando um lock AGORA. */
async function backendsBloqueadosEmLock(): Promise<number> {
  const linhas = await database.transacao(async (tx) =>
    tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND cardinality(pg_blocking_pids(pid)) > 0
    `,
  );
  return linhas[0]?.n ?? 0;
}

/** Cliente PRÓPRIO da porta de largada — fora do pool servido pela API. */
let clientePorta: ClientePersistencia | null = null;
function porta(): ClientePersistencia {
  clientePorta ??= criarClientePersistencia({ url: urlObrigatoria("DATABASE_URL") });
  return clientePorta;
}
afterAll(async () => {
  if (clientePorta !== null) {
    const cliente = clientePorta;
    clientePorta = null;
    await cliente.$disconnect();
  }
});

interface PortaDeLargada {
  /** Resolve quando a linha do usuário já está travada. */
  readonly pronta: Promise<void>;
  /** Libera a linha (commit da transação da porta). */
  readonly abrir: () => void;
  /** Resolve quando a transação da porta terminou de fato. */
  readonly terminou: Promise<void>;
}

/**
 * Porta de largada: transação própria que detém o lock da linha de `usuario`
 * até ser aberta. Serve para ENFILEIRAR, em ordem conhecida, as transações
 * reais que serão medidas — a fila de espera por lock de linha do PostgreSQL
 * é FIFO, então quem pede primeiro recebe primeiro.
 */
function segurarLinhaDoUsuario(usuarioId: string): PortaDeLargada {
  let sinalizarPronta: () => void = () => undefined;
  const pronta = new Promise<void>((resolver) => {
    sinalizarPronta = resolver;
  });
  let liberar: () => void = () => undefined;
  const liberada = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  const terminou = porta().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${usuarioId}::uuid FOR UPDATE`;
      sinalizarPronta();
      await liberada;
    },
    { timeout: 60_000, maxWait: 30_000 },
  );
  return { pronta, abrir: () => liberar(), terminou };
}

describe("Ordem de locks — dois INÍCIOS serializam no FOR UPDATE de `usuario`", () => {
  it("o segundo início fica MEDIDAMENTE bloqueado enquanto o primeiro detém a linha; ao final, UM pendente", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();

    // Barreira DENTRO da transação do primeiro início: o `AuditWriter` é o
    // último passo de `iniciar`, logo, quando ela prende, a transação já
    // adquiriu o `FOR UPDATE` da linha do usuário e ainda não commitou.
    let chegaramAoEvento = 0;
    let abrirBarreira: () => void = () => undefined;
    const barreira = new Promise<void>((resolver) => {
      abrirBarreira = resolver;
    });
    const auditWriter = moduleRef.get(AuditWriter);
    const original = auditWriter.registrar.bind(auditWriter);
    const espia = jest.spyOn(auditWriter, "registrar").mockImplementation(async (tx, evento) => {
      if (evento.acao === "usuario.senha.recuperacao_iniciada") {
        chegaramAoEvento += 1;
        if (chegaramAoEvento === 1) await barreira;
      }
      return original(tx, evento);
    });

    try {
      const primeiro = iniciar(admin.cookie, alvo.email);
      await esperarAte(() => chegaramAoEvento === 1, "o primeiro início alcançar a barreira");

      // A linha do usuário está travada pelo primeiro início. O segundo é
      // disparado e DEVE parar no `FOR UPDATE`.
      const segundo = iniciar(admin.cookie, alvo.email);

      // PROVA POSITIVA — e é aqui que a mutação morre: sem o `FOR UPDATE` de
      // `iniciar`, nada bloqueia o segundo (o segredo recém-inserido pelo
      // primeiro é invisível sob READ COMMITTED e não há índice único que os
      // faça colidir), nenhum backend fica em espera de lock e esta condição
      // nunca se satisfaz.
      await esperarAte(
        async () => (await backendsBloqueadosEmLock()) >= 1,
        "o segundo início ficar bloqueado na fila do lock de `usuario`",
      );
      // Bloqueado significa: NÃO chegou ao próprio evento de auditoria.
      expect(chegaramAoEvento).toBe(1);

      abrirBarreira();
      const [a, b] = await Promise.all([primeiro, segundo]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(chegaramAoEvento).toBe(2);
    } finally {
      espia.mockRestore();
    }

    // Executaram um APÓS o outro: dois segredos emitidos, o primeiro expirado
    // pelo segundo, exatamente um pendente (`D-2.3D-08`).
    expect(await lerSegredos()).toHaveLength(2);
    expect(await contarPendentes(alvo.id)).toBe(1);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(2);
  });
});

describe("Ordem de locks — INÍCIO × CONCLUSÃO concorrentes não produzem deadlock (M-01)", () => {
  it("início 1º na fila do lock: as duas transações serializam, sem 40P01 e sem 500", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    const { token } = await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);
    const hashAntes = await hashDaSenhaDe(alvo.id);

    const largada = segurarLinhaDoUsuario(alvo.id);
    await largada.pronta;

    // 1º na fila do lock de `usuario`: o INÍCIO.
    const inicio = iniciar(admin.cookie, alvo.email);
    await esperarAte(
      async () => (await backendsBloqueadosEmLock()) >= 1,
      "o início entrar na fila do lock de `usuario`",
    );

    // 2ª na fila: a CONCLUSÃO. Na ORDEM ANTIGA ela consumia a linha do segredo
    // ANTES de pedir `usuario` — e, ao ser liberada, o início (1º da fila, já
    // dono de `usuario`) pediria justamente aquela linha de segredo: ciclo de
    // espera fechado e `40P01`. Na ordem corrigida ela pede `usuario`
    // primeiro, sem deter nada, e as duas simplesmente se enfileiram.
    const conclusao = concluir(segredo);
    await esperarAte(
      async () => (await backendsBloqueadosEmLock()) >= 2,
      "a conclusão entrar na fila do lock de `usuario`",
    );

    largada.abrir();
    await largada.terminou;
    const [respostaInicio, respostaConclusao] = await Promise.all([inicio, conclusao]);

    // Nenhum dos lados foi abortado pelo detector de deadlock.
    expect(respostaInicio.status).not.toBe(500);
    expect(respostaConclusao.status).not.toBe(500);
    expect(JSON.stringify([respostaInicio.corpo, respostaConclusao.corpo])).not.toContain("FALHA_INTERNA");

    // Desfecho DETERMINÍSTICO da ordem da fila: o início venceu e expirou o
    // segredo apresentado; a conclusão reavaliou o predicado sobre a versão
    // commitada, casou zero linhas e recebeu o 401 uniforme.
    expect(respostaInicio.status).toBe(201);
    expect(respostaConclusao.status).toBe(401);
    expect(respostaConclusao.corpo).toEqual({ erro: "RECUPERACAO_INVALIDA" });

    // Nenhuma transação ficou parcialmente aplicada.
    expect(await hashDaSenhaDe(alvo.id)).toBe(hashAntes);
    const linhas = await lerSegredos();
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.consumido_em === null)).toBe(true);
    expect(await contarPendentes(alvo.id)).toBe(1);
    expect((await lerSessoesDe(alvo.id)).map((s) => s.estado)).toEqual(["ATIVA"]);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(0);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_iniciada")).toHaveLength(2);
    // A sessão anterior segue valendo — nada foi revogado pela conclusão recusada.
    expect((await logout(token)).status).toBe(204);
  });

  it("conclusão 1ª na fila do lock: ela vence, revoga as sessões, e o início seguinte emite normalmente", async () => {
    const alvo = await criarUsuario();
    const admin = await criarAdministrador();
    await sessoes.emitir({ usuarioId: alvo.id });
    const { segredo } = await emitirSegredo(alvo);

    const largada = segurarLinhaDoUsuario(alvo.id);
    await largada.pronta;

    const conclusao = concluir(segredo);
    await esperarAte(
      async () => (await backendsBloqueadosEmLock()) >= 1,
      "a conclusão entrar na fila do lock de `usuario`",
    );
    const inicio = iniciar(admin.cookie, alvo.email);
    await esperarAte(
      async () => (await backendsBloqueadosEmLock()) >= 2,
      "o início entrar na fila do lock de `usuario`",
    );

    largada.abrir();
    await largada.terminou;
    const [respostaConclusao, respostaInicio] = await Promise.all([conclusao, inicio]);

    expect(respostaConclusao.status).toBe(204);
    expect(respostaInicio.status).toBe(201);
    expect(JSON.stringify([respostaInicio.corpo, respostaConclusao.corpo])).not.toContain("FALHA_INTERNA");

    // T-07 aplicou-se por inteiro; o início seguinte não desfez nada dela.
    expect((await login(alvo.email, NOVA_SENHA)).status).toBe(200);
    expect((await lerSessoesDe(alvo.id)).some((s) => s.estado === "REVOGADA")).toBe(true);
    const linhas = await lerSegredos();
    expect(linhas).toHaveLength(2);
    expect(linhas.filter((l) => l.consumido_em !== null)).toHaveLength(1);
    expect(await contarPendentes(alvo.id)).toBe(1);
    expect(eventosDe(await lerEventos(), "usuario.senha.recuperacao_concluida")).toHaveLength(1);
  });
});

describe("TLF-BASE-V1 §10 — nenhum segredo em log", () => {
  it("nenhuma escrita em console carrega segredo, senha, hash ou identificador", async () => {
    const capturado: string[] = [];
    const metodos = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const espias = metodos.map((m) =>
      jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        capturado.push(args.map((a) => String(a)).join(" "));
      }),
    );
    try {
      const alvo = await criarUsuario();
      const admin = await criarAdministrador();
      const { segredo } = (await iniciar(admin.cookie, alvo.email)).corpo as { segredo: string };
      await iniciar(admin.cookie, "ninguem-f6@sintetico.local");
      await concluir("a".repeat(43));
      await concluir(segredo);
      await postar(ROTA_CONCLUSAO, null, { corpoBruto: "{quebrado" });
      const tudo = capturado.join("\n");
      for (const proibido of [segredo, calcularHashSegredoRecuperacao(segredo), NOVA_SENHA, SENHA, alvo.email, admin.email, "ninguem-f6", "$argon2"]) {
        expect(tudo).not.toContain(proibido);
      }
    } finally {
      for (const espia of espias) espia.mockRestore();
    }
  });
});

describe("D-2.3D-11 — contrato e runtime coerentes nas rotas da F6", () => {
  it("todos os status documentados para a conclusão ocorrem de fato (exceto 413/500, provados noutros blocos)", async () => {
    const alvo = await criarUsuario();
    const { segredo } = await emitirSegredo(alvo);
    expect((await postar(ROTA_CONCLUSAO, {})).status).toBe(400);
    expect((await concluir("a".repeat(43))).status).toBe(401);
    expect(
      (await postar(ROTA_CONCLUSAO, { segredo, novaSenha: NOVA_SENHA }, { cabecalhos: { "content-type": "application/json" } }))
        .status,
    ).toBe(403);
    expect((await concluir(segredo)).status).toBe(204);
  });

  it("corpo acima do limite devolve 413 com o contrato fechado", async () => {
    const resposta = await postar(ROTA_CONCLUSAO, { segredo: "a".repeat(43), novaSenha: "x".repeat(200_000) });
    expect(resposta.status).toBe(413);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
  });
});
