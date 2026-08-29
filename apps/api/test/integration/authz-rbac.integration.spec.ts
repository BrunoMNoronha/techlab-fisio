// TechLab Fisio — Etapa 2.3D-B / F4 — RBAC ponta a ponta contra PostgreSQL REAL.
//
// Caminho provado, inteiro e sem mock no meio: servidor HTTP real (porta
// efêmera) → cookie de sessão de `D-2.3D-07` → `SessaoAutenticadaGuard` →
// `SessaoService` (F2) → `PermissoesGuard` → `PermissoesService` →
// `DatabaseService` → cliente real → `tlf_app` → PostgreSQL 18 → `usuario`,
// `usuario_papel`, `papel`, `papel_permissao`, `permissao`.
//
// Propriedades MEDIDAS (não inspecionadas):
//   `D-2.3D-09`  união de permissões sobre MÚLTIPLOS papéis; duplicidade
//                indiferente; ausência de papel não concede nada;
//   `AUT-003`    autorização validada NO BACKEND; chamada direta à API sem
//                permissão é rejeitada; `401` e `403` não se confundem;
//   `R4-03`      `@RequerPermissao(P)` SOZINHO autentica e autoriza — as
//                rotas protegidas desta fixture não têm `@UseGuards` algum;
//   `R4-01`      a identidade validada é a que decide;
//   identidade   corpo, query e cabeçalhos forjados NÃO alteram a decisão;
//   isolamento   a permissão de um usuário não serve a outro;
//   sessão       sessão revogada e sessão expirada NÃO viram usuário
//                autorizado (`D-2.3D-04`, `D-2.3D-05`).
//
// UM ÚNICO RELÓGIO CONTROLADO — o da política de sessão (`RELOGIO_SESSAO`,
// precedente da F2/F3): a janela absoluta de 8 h não é alcançável por espera
// real. Todo o resto — HTTP, SQL, locks, constraints, transações, Argon2 do
// login — é real.
//
// AS FIXTURES DE PAPEL/PERMISSÃO SÃO FIXTURES DE TESTE, E SOMENTE ISSO. Elas
// nascem e morrem dentro desta suíte (limpeza determinística do `setup-db`).
// NÃO existe seed, script de seed, associação automática papel↔permissão nem
// bootstrap de Administrador: F5 permanece NÃO INICIADA (`docs/12` §9).
//
// Fixtures 100 % sintéticas; nenhum dado real (TLF-BASE-V1 §10).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { POLITICA_SESSAO, SessaoService } from "../../src/auth/sessao.service.js";
import { PermissoesService } from "../../src/authz/permissoes.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { ModuloFixtureF4, PREFIXO_FIXTURE } from "./fixture-rbac.controller.js";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Instante-base fixo — a suíte nunca depende do relógio da máquina. */
const T0 = new Date("2026-08-25T10:00:00.000Z");

/** Senha sintética das fixtures que passam pelo login real. */
const SENHA = "senha-sintetica-f4-integracao";

class RelogioControlado implements RelogioSessao {
  #instante = new Date(T0.getTime());
  agora(): Date {
    return new Date(this.#instante.getTime());
  }
  definir(instante: Date): void {
    this.#instante = new Date(instante.getTime());
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
let permissoes: PermissoesService;
let politicaCookie: PoliticaCookieSessao;
let hashDaSenha: string;

const relogio = new RelogioControlado();

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    // `AppModule` REAL + o módulo de fixture, que por sua vez importa o
    // `AuthzModule` REAL. Nenhum provider da F4 é substituído.
    imports: [AppModule, ModuloFixtureF4],
  })
    .overrideProvider(RELOGIO_SESSAO)
    .useValue(relogio)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = await app.getUrl();
  database = moduleRef.get(DatabaseService);
  sessoes = moduleRef.get(SessaoService);
  permissoes = moduleRef.get(PermissoesService);
  politicaCookie = moduleRef.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
  hashDaSenha = await moduleRef.get(CredencialService).gerarHash(SENHA);
}, 180_000);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  relogio.reiniciar();
});

// ---------------------------------------------------------------------------
// Fixtures — usuário, papéis, permissões e vínculos
// ---------------------------------------------------------------------------

interface UsuarioFixture {
  readonly id: string;
  readonly email: string;
}

async function criarUsuario(opcoes?: { ativo?: boolean }): Promise<UsuarioFixture> {
  const email = `f4-${randomUUID().slice(0, 8)}@sintetico.local`;
  return database.transacao(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email,
        senhaHash: hashDaSenha,
        nome: "Usuário Sintético F4",
        ativo: opcoes?.ativo ?? true,
      },
      select: { id: true },
    });
    return { id: usuario.id, email };
  });
}

/**
 * Cria um papel com as permissões informadas e o vincula ao usuário.
 *
 * As permissões são criadas sob demanda e REUTILIZADAS quando já existirem —
 * `permissao.codigo` é `U-11` (único), e dois papéis podem legitimamente
 * conceder a mesma permissão. É exatamente esse caso que prova a
 * deduplicação.
 */
async function darPapel(
  usuarioId: string,
  rotuloPapel: string,
  codigos: readonly string[],
): Promise<{ papelId: string; permissaoIds: readonly string[] }> {
  return database.transacao(async (tx) => {
    const papel = await tx.papel.create({
      data: { codigo: `${rotuloPapel}-${randomUUID().slice(0, 8)}`, nome: rotuloPapel },
      select: { id: true },
    });
    const permissaoIds: string[] = [];
    for (const codigo of codigos) {
      const existente = await tx.permissao.findUnique({
        where: { codigo },
        select: { id: true },
      });
      const permissao =
        existente ??
        (await tx.permissao.create({
          data: { codigo, nome: codigo },
          select: { id: true },
        }));
      permissaoIds.push(permissao.id);
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
    }
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
    return { papelId: papel.id, permissaoIds };
  });
}

/**
 * Controle de não vacuidade das fixtures: confirma NO BANCO que o vínculo
 * usuário↔papel↔permissão existe de fato. Sem isto, um teste que espera `403`
 * passaria mesmo que a fixture nunca tivesse gravado nada.
 */
async function contarVinculos(usuarioId: string): Promise<{
  papeis: number;
  concessoes: number;
}> {
  return database.transacao(async (tx) => {
    const papeis = await tx.usuarioPapel.count({ where: { usuarioId } });
    const concessoes = await tx.papelPermissao.count({
      where: { papel: { usuarios: { some: { usuarioId } } } },
    });
    return { papeis, concessoes };
  });
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

interface RespostaMedida {
  readonly status: number;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
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
  return {
    status: resposta.status,
    corpo,
    cookies: resposta.headers.getSetCookie(),
  };
}

function cookieDe(token: string): string {
  return `${politicaCookie.nome}=${token}`;
}

/** Emite uma sessão REAL para o usuário e devolve o cookie correspondente. */
async function sessaoDe(usuarioId: string): Promise<{ token: string; cookie: string }> {
  const emitida = await sessoes.emitir({ usuarioId });
  return { token: emitida.token, cookie: cookieDe(emitida.token) };
}

async function obter(
  rota: string,
  cabecalhos: Record<string, string> = {},
): Promise<RespostaMedida> {
  return medir(
    await fetch(`${baseUrl}/${PREFIXO_FIXTURE}/${rota}`, {
      method: "GET",
      headers: cabecalhos,
    }),
  );
}

async function enviar(
  rota: string,
  cabecalhos: Record<string, string>,
  corpo: unknown,
): Promise<RespostaMedida> {
  return medir(
    await fetch(`${baseUrl}/${PREFIXO_FIXTURE}/${rota}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cabecalhos },
      body: JSON.stringify(corpo),
    }),
  );
}

/** Login REAL pela fronteira da F3 — prova a cadeia completa. */
async function logar(email: string): Promise<string> {
  const resposta = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [CABECALHO_REQUISICAO_TLF]: "1",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    },
    body: JSON.stringify({ identificador: email, senha: SENHA }),
  });
  expect(resposta.status).toBe(200);
  const cookie = resposta.headers.getSetCookie()[0];
  expect(cookie).toBeDefined();
  return String(cookie).split(";", 1)[0] as string;
}

// ---------------------------------------------------------------------------
// Caso A — autorizado
// ---------------------------------------------------------------------------

describe("Caso A — usuário autenticado, com papel e permissão exigida", () => {
  it("acessa a rota protegida e o HANDLER é efetivamente alcançado", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelA", ["usuarios.gerenciar"]);

    // Controle positivo: a fixture gravou de fato no banco.
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 1, concessoes: 1 });
    const efetivas = await permissoes.resolverDoUsuario(usuario.id);
    expect(efetivas).toEqual({ resolvido: true, permissoes: ["usuarios.gerenciar"] });

    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await obter("exige-permissao", { cookie });

    expect(resposta.status).toBe(200);
    // Não vacuidade: o corpo só existe se o handler executou.
    expect(resposta.corpo).toMatchObject({
      alcancado: true,
      rota: "exige-permissao",
      usuarioId: usuario.id,
    });
  });

  it("a cadeia inteira funciona a partir do LOGIN real — cookie da F3", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelA", ["usuarios.gerenciar"]);
    const cookie = await logar(usuario.email);

    const resposta = await obter("exige-permissao", { cookie });
    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toMatchObject({ alcancado: true, usuarioId: usuario.id });
  });
});

// ---------------------------------------------------------------------------
// Caso B — não autorizado
// ---------------------------------------------------------------------------

describe("Caso B — autenticado, com papel, SEM a permissão exigida", () => {
  it("recebe 403 — e não 401, 404 ou 500", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelSemP", ["auditoria.ler"]);
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 1, concessoes: 1 });

    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await obter("exige-permissao", { cookie });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ erro: "ACESSO_NEGADO" });
  });

  it("o mesmo usuário É autenticado — o 403 não veio de sessão inválida", async () => {
    // Controle que separa `401` de `403`: a MESMA sessão alcança a rota que
    // exige apenas autenticação. Sem isto, um `403` poderia estar mascarando
    // uma falha anterior ao RBAC.
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelSemP", ["auditoria.ler"]);
    const { cookie } = await sessaoDe(usuario.id);

    const autenticada = await obter("somente-autenticado", { cookie });
    expect(autenticada.status).toBe(200);
    expect(autenticada.corpo).toMatchObject({ usuarioId: usuario.id });

    const negada = await obter("exige-permissao", { cookie });
    expect(negada.status).toBe(403);
  });

  it("a negação não revela qual permissão faltou nem quais o usuário possui", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelSemP", ["auditoria.ler"]);
    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await obter("exige-outra", { cookie });
    expect(resposta.status).toBe(403);
    const serializado = JSON.stringify(resposta.corpo);
    expect(serializado).not.toContain("permissoes.gerenciar");
    expect(serializado).not.toContain("auditoria.ler");
    expect(serializado).not.toContain(usuario.id);
  });
});

// ---------------------------------------------------------------------------
// Caso C — múltiplos papéis
// ---------------------------------------------------------------------------

describe("Caso C — múltiplos papéis (`D-2.3D-09` — união)", () => {
  it("papel A sem P + papel B com P => acesso PERMITIDO", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelSemP", ["auditoria.ler"]);
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 2, concessoes: 2 });

    const efetivas = await permissoes.resolverDoUsuario(usuario.id);
    expect(efetivas).toEqual({
      resolvido: true,
      // União, ordenada e determinística.
      permissoes: ["auditoria.ler", "usuarios.gerenciar"],
    });

    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await obter("exige-permissao", { cookie });
    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toMatchObject({ alcancado: true });
  });

  it("a mesma permissão em DOIS papéis entra uma única vez", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelUm", ["usuarios.gerenciar"]);
    await darPapel(usuario.id, "PapelDois", ["usuarios.gerenciar"]);
    // Duas concessões distintas em `papel_permissao` para a MESMA permissão.
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 2, concessoes: 2 });

    const efetivas = await permissoes.resolverDoUsuario(usuario.id);
    expect(efetivas).toEqual({ resolvido: true, permissoes: ["usuarios.gerenciar"] });

    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);
  });

  it("a exigência é POR OPERAÇÃO — cada rota exige a sua permissão", async () => {
    // Substitui as provas de composição `AND`, removidas com a abstração:
    // não existe mais decorator plural. O que resta provar é que duas rotas
    // distintas exigem, cada uma, a permissão que declararam.
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelUm", ["usuarios.gerenciar"]);
    await darPapel(usuario.id, "PapelDois", ["permissoes.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);
    expect((await obter("exige-outra", { cookie })).status).toBe(200);
  });

  it("possuir a permissão de UMA rota não abre a outra", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelUm", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);
    expect((await obter("exige-outra", { cookie })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Caso D — sem papel
// ---------------------------------------------------------------------------

describe("Caso D — usuário autenticado SEM papel algum", () => {
  it("não recebe privilégio implícito", async () => {
    const usuario = await criarUsuario();
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 0, concessoes: 0 });

    const efetivas = await permissoes.resolverDoUsuario(usuario.id);
    expect(efetivas).toEqual({ resolvido: true, permissoes: [] });

    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(403);
    expect((await obter("exige-outra", { cookie })).status).toBe(403);
    // E continua autenticado — o `403` é de autorização, não de sessão.
    expect((await obter("somente-autenticado", { cookie })).status).toBe(200);
  });

  it("papel SEM permissão alguma também não concede nada", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelVazio", []);
    expect(await contarVinculos(usuario.id)).toEqual({ papeis: 1, concessoes: 0 });
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Caso E — isolamento entre usuários
// ---------------------------------------------------------------------------

describe("Caso E — a permissão de um usuário não serve a outro", () => {
  it("usuário 1 acessa; usuário 2 continua sem acesso", async () => {
    const comPermissao = await criarUsuario();
    await darPapel(comPermissao.id, "PapelComP", ["usuarios.gerenciar"]);
    const semPermissao = await criarUsuario();

    const sessao1 = await sessaoDe(comPermissao.id);
    const sessao2 = await sessaoDe(semPermissao.id);

    expect((await obter("exige-permissao", { cookie: sessao1.cookie })).status).toBe(200);
    expect((await obter("exige-permissao", { cookie: sessao2.cookie })).status).toBe(403);
  });

  it("o cookie do usuário 2 não é aceito como sendo do usuário 1", async () => {
    const comPermissao = await criarUsuario();
    await darPapel(comPermissao.id, "PapelComP", ["usuarios.gerenciar"]);
    const semPermissao = await criarUsuario();
    const sessao2 = await sessaoDe(semPermissao.id);

    // A rota autenticada devolve a identidade REAL da sessão apresentada.
    const resposta = await obter("somente-autenticado", { cookie: sessao2.cookie });
    expect(resposta.corpo).toMatchObject({ usuarioId: semPermissao.id });
    expect(JSON.stringify(resposta.corpo)).not.toContain(comPermissao.id);
  });
});

// ---------------------------------------------------------------------------
// Caso F — identidade forjada
// ---------------------------------------------------------------------------

describe("Caso F — o cliente não controla identidade, papel nem permissão", () => {
  it("cabeçalhos forjados não concedem acesso", async () => {
    const alvo = await criarUsuario();
    await darPapel(alvo.id, "PapelComP", ["usuarios.gerenciar"]);
    const atacante = await criarUsuario();
    const { cookie } = await sessaoDe(atacante.id);

    const resposta = await obter("exige-permissao", {
      cookie,
      "x-usuario-id": alvo.id,
      "x-usuario": alvo.id,
      "x-papel": "Administrador",
      "x-papeis": "Administrador,Gestor",
      "x-permissoes": "usuarios.gerenciar",
      "x-tlf-permissoes": "usuarios.gerenciar",
      authorization: `Bearer ${alvo.id}`,
    });
    expect(resposta.status).toBe(403);
  });

  it("query string forjada não concede acesso", async () => {
    const alvo = await criarUsuario();
    await darPapel(alvo.id, "PapelComP", ["usuarios.gerenciar"]);
    const atacante = await criarUsuario();
    const { cookie } = await sessaoDe(atacante.id);

    const consulta =
      `?usuarioId=${alvo.id}&usuario_id=${alvo.id}` +
      `&papel=Administrador&permissoes=usuarios.gerenciar`;
    const resposta = await medir(
      await fetch(`${baseUrl}/${PREFIXO_FIXTURE}/exige-permissao${consulta}`, {
        method: "GET",
        headers: { cookie },
      }),
    );
    expect(resposta.status).toBe(403);
  });

  it("corpo JSON forjado não concede acesso", async () => {
    const alvo = await criarUsuario();
    await darPapel(alvo.id, "PapelComP", ["usuarios.gerenciar"]);
    const atacante = await criarUsuario();
    const { cookie } = await sessaoDe(atacante.id);

    const resposta = await enviar(
      "exige-permissao",
      { cookie },
      {
        usuarioId: alvo.id,
        usuario: { id: alvo.id, papeis: ["Administrador"] },
        papeis: ["Administrador"],
        permissoes: ["usuarios.gerenciar"],
      },
    );
    expect(resposta.status).toBe(403);
  });

  it("sem cookie algum, nem os forjados autenticam — `401`, nunca `403`", async () => {
    const alvo = await criarUsuario();
    await darPapel(alvo.id, "PapelComP", ["usuarios.gerenciar"]);

    const resposta = await obter("exige-permissao", {
      "x-usuario-id": alvo.id,
      "x-permissoes": "usuarios.gerenciar",
    });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
  });

  it("o mesmo POST forjado, COM a permissão real, é aceito — controle positivo", async () => {
    // Prova que o `403` dos casos acima veio da autorização, e não de o corpo
    // forjado quebrar o roteamento ou o parser.
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await enviar(
      "exige-permissao",
      { cookie },
      { usuarioId: "00000000-0000-4000-8000-000000000000", papeis: ["Nada"] },
    );
    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toMatchObject({
      alcancado: true,
      rota: "exige-permissao-post",
      usuarioId: usuario.id,
    });
  });
});

// ---------------------------------------------------------------------------
// Caso G — sessão inválida ou terminal
// ---------------------------------------------------------------------------

describe("Caso G — o RBAC não ressuscita sessão inválida ou terminal", () => {
  it("sem cookie: `401` `SESSAO_INVALIDA`", async () => {
    expect((await obter("exige-permissao")).status).toBe(401);
    expect((await obter("somente-autenticado")).status).toBe(401);
  });

  it("cookie malformado, inexistente e com segredo errado: `401`", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { token } = await sessaoDe(usuario.id);
    const [sessaoId] = token.split(".", 1);

    const invalidos = [
      "sem-ponto",
      `${randomUUID()}.${"a".repeat(43)}`,
      `${String(sessaoId)}.${"z".repeat(43)}`,
      "",
    ];
    for (const invalido of invalidos) {
      const resposta = await obter("exige-permissao", { cookie: cookieDe(invalido) });
      expect(resposta.status).toBe(401);
    }
    // Controle positivo: o token verdadeiro, no mesmo cookie, funciona.
    expect((await obter("exige-permissao", { cookie: cookieDe(token) })).status).toBe(200);
  });

  it("sessão REVOGADA deixa de autorizar — mesmo com a permissão", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { token, cookie } = await sessaoDe(usuario.id);

    expect((await obter("exige-permissao", { cookie })).status).toBe(200);
    const revogacao = await sessoes.revogar(token);
    expect(revogacao.revogada).toBe(true);

    const resposta = await obter("exige-permissao", { cookie });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
  });

  it("sessão EXPIRADA por prazo absoluto deixa de autorizar", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);

    relogio.definir(new Date(T0.getTime() + 8 * HORA + MINUTO));
    expect((await obter("exige-permissao", { cookie })).status).toBe(401);
  });

  it("sessão EXPIRADA por ociosidade deixa de autorizar", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);

    relogio.definir(new Date(T0.getTime() + POLITICA_SESSAO.timeoutOciosoMs + MINUTO));
    expect((await obter("exige-permissao", { cookie })).status).toBe(401);
  });

  it("usuário INATIVADO depois do login: DEFESA EM PROFUNDIDADE nega o RBAC", async () => {
    // ESTADO ARTIFICIAL — leia antes de interpretar este teste.
    //
    // A inativação abaixo é escrita DIRETAMENTE NA PERSISTÊNCIA. Nenhuma rota
    // de produção a produz: não existe, em `apps/api/src/`, fluxo de ativação
    // ou inativação de USUÁRIO (a única inativação implementada é a de
    // `profissional`, entidade distinta). O cenário existe para exercitar a
    // barreira defensiva do RBAC, não para representar o fluxo real.
    //
    // O QUE ESTE TESTE NÃO PROVA, e não pode ser lido como se provasse:
    //   - NÃO prova AUT-005. A obrigação homologada é "ao inativar, revogar
    //     sessões ativas" (AUT-005; RN-001: "sessões existentes devem ser
    //     revogadas"), e ela pertence ao fluxo que materializar a inativação
    //     de usuários — que não existe. **AUT-005 permanece NÃO MATERIALIZADA
    //     e NÃO ENCERRADA.**
    //   - NÃO prova que a sessão foi revogada. Ela permanece `ATIVA`, e o
    //     `SessaoService` continua considerando-a válida — a F4 não altera a
    //     máquina de estados de `D-2.3D-05`.
    //   - A cobertura é PARCIAL: vale onde a `PermissoesGuard` está aplicada.
    //     Uma rota apenas autenticada continua utilizável por esta sessão.
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);

    await database.transacao(async (tx) =>
      tx.usuario.update({ where: { id: usuario.id }, data: { ativo: false } }),
    );
    expect(await permissoes.resolverDoUsuario(usuario.id)).toEqual({
      resolvido: false,
      motivo: "USUARIO_INATIVO",
    });
    expect((await obter("exige-permissao", { cookie })).status).toBe(403);

    // MEDIÇÃO EXPLÍCITA do limite declarado acima: a mesma sessão continua
    // servindo a rota apenas autenticada. É registro do estado real, não
    // afirmação de conformidade com RN-001.
    expect((await obter("somente-autenticado", { cookie })).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Fiação incorreta e resolução direta
// ---------------------------------------------------------------------------

describe("fiação incorreta — fail-closed", () => {
  it("guard aplicada à mão SEM metadata nega, mesmo para quem tem tudo", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", [
      "usuarios.gerenciar",
      "permissoes.gerenciar",
    ]);
    const { cookie } = await sessaoDe(usuario.id);
    // Controle positivo: este mesmo cookie é autorizado onde deve ser.
    expect((await obter("exige-permissao", { cookie })).status).toBe(200);
    expect((await obter("exige-outra", { cookie })).status).toBe(200);
    expect((await obter("guard-sem-metadata", { cookie })).status).toBe(403);
  });

  it("`PermissoesGuard` sem a guard de sessão nega — e não autentica sozinha", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelComP", ["usuarios.gerenciar"]);
    const { cookie } = await sessaoDe(usuario.id);
    const resposta = await obter("rbac-sem-sessao", { cookie });
    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ erro: "ACESSO_NEGADO" });
  });
});

describe("`PermissoesService` — resolução direta contra o banco real", () => {
  it("usuário inexistente: `USUARIO_INEXISTENTE`, sem exceção", async () => {
    expect(await permissoes.resolverDoUsuario(randomUUID())).toEqual({
      resolvido: false,
      motivo: "USUARIO_INEXISTENTE",
    });
  });

  it("identificador degenerado não vira consulta permissiva", async () => {
    for (const degenerado of ["", null, undefined, 0, {}]) {
      expect(await permissoes.resolverDoUsuario(degenerado)).toEqual({
        resolvido: false,
        motivo: "USUARIO_INEXISTENTE",
      });
    }
  });

  it("a saída é determinística — mesma ordem para o mesmo estado", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelZ", ["prontuario.ler", "agenda.gerenciar"]);
    await darPapel(usuario.id, "PapelA", ["auditoria.ler", "agenda.gerenciar"]);
    const primeira = await permissoes.resolverDoUsuario(usuario.id);
    const segunda = await permissoes.resolverDoUsuario(usuario.id);
    expect(primeira).toEqual(segunda);
    expect(primeira).toEqual({
      resolvido: true,
      permissoes: ["agenda.gerenciar", "auditoria.ler", "prontuario.ler"],
    });
  });

  it("permissão de OUTRO usuário não vaza para a resolução", async () => {
    const outro = await criarUsuario();
    await darPapel(outro.id, "PapelDoOutro", ["usuarios.gerenciar"]);
    const isolado = await criarUsuario();
    await darPapel(isolado.id, "PapelDoIsolado", ["auditoria.ler"]);

    expect(await permissoes.resolverDoUsuario(isolado.id)).toEqual({
      resolvido: true,
      permissoes: ["auditoria.ler"],
    });
  });

  it("código persistido FORA do catálogo de `docs/04` §5 não autoriza nada", async () => {
    const usuario = await criarUsuario();
    await darPapel(usuario.id, "PapelEstranho", ["permissao.fora.do.catalogo"]);
    const efetivas = await permissoes.resolverDoUsuario(usuario.id);
    // A resolução o devolve — ela não sanea —, mas ele jamais casa com uma
    // exigência, que é sempre um identificador do catálogo tipado.
    expect(efetivas).toEqual({
      resolvido: true,
      permissoes: ["permissao.fora.do.catalogo"],
    });
    const { cookie } = await sessaoDe(usuario.id);
    expect((await obter("exige-permissao", { cookie })).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Fronteira — a F4 não muda a F3 nem publica rota
// ---------------------------------------------------------------------------

describe("fronteira — a F4 não altera as rotas publicadas nem a F3", () => {
  it("as rotas de autenticação continuam sem exigir RBAC", async () => {
    const usuario = await criarUsuario();
    // Login sem papel algum continua funcionando — `docs/04` §4:
    // "Autenticar/logout próprio" é permitido a todos os papéis.
    const cookie = await logar(usuario.email);

    const logout = await medir(
      await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CABECALHO_REQUISICAO_TLF]: "1",
          cookie,
        },
      }),
    );
    expect(logout.status).toBe(204);
  });

  it("`/health` continua público e sem autorização", async () => {
    const resposta = await medir(await fetch(`${baseUrl}/health`));
    expect(resposta.status).toBe(200);
  });
});
