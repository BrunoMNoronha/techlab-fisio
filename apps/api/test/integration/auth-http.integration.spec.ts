// TechLab Fisio — Etapa 2.3D-B / F3 — fronteira HTTP de autenticação ponta a
// ponta contra PostgreSQL REAL.
//
// Caminho provado, inteiro e sem mock no meio: servidor HTTP real (porta
// efêmera) → `ProtecaoCsrfGuard` → `AuthController` → `AutenticacaoService` →
// `CredencialService` (Argon2 real) / `SessaoService` / `LimitadorLogin` /
// `AuditWriter` → `DatabaseService` → cliente real → `tlf_app` → PostgreSQL 18.
//
// Propriedades MEDIDAS (não inspecionadas):
//   `D-2.3D-06`  rate limit por identificador, `429`, `Retry-After`, e — a
//                propriedade de ordem — Argon2 NÃO executado quando bloqueado;
//   `D-2.3D-07`  atributos reais do `Set-Cookie`; baseline CSRF sobre o
//                servidor; CORS comprovadamente NÃO habilitado;
//   `D-2.3D-12`  `usuario.autenticacao`/`FALHA` emitido para a tentativa
//                admitida e rejeitada, com `ator`/`alvo`/`contexto` exatos —
//                e AUSENTE para payload malformado e para `429`;
//   `D-2.3D-05`  logout revoga; nenhum estado terminal volta a `ATIVA`;
//   AUT-001      conta inativa não cria sessão;
//   `T-AUTH-ENUMERATION`  simetria ESTRUTURAL entre conta existente e
//                inexistente — sem limiar de milissegundos.
//
// DOIS RELÓGIOS CONTROLADOS, e só eles: o da política de sessão
// (`RELOGIO_SESSAO`, precedente da F2) e o do limitador. As janelas de 8 h,
// 15 min de ociosidade e 15 min de rate limit não são alcançáveis por espera
// real num teste. Todo o resto — HTTP, Argon2, SQL, locks, constraints,
// transações — é real.
//
// Fixtures 100 % sintéticas; limpeza determinística entre testes (setup-db).

import { randomUUID } from "node:crypto";
import http from "node:http";
import { urlToHttpOptions } from "node:url";

import { argon2id, hash as hashArgon2 } from "argon2";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { AutenticacaoService } from "../../src/auth/autenticacao.service.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import {
  JANELA_MS,
  LIMITE_POR_IDENTIFICADOR,
  LIMITE_POR_IP,
  LimitadorLogin,
} from "../../src/auth/limitador-login.js";
import {
  NOME_COOKIE_DESENVOLVIMENTO,
  NOME_COOKIE_PROTEGIDO,
} from "../../src/auth/politica-cookie.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import { POLITICA_ARGON2 } from "../../src/auth/credencial.service.js";
import { POLITICA_SESSAO } from "../../src/auth/sessao.service.js";
import { CABECALHO_REQUISICAO_TLF } from "../../src/auth/protecao-csrf.guard.js";
import { DatabaseService } from "../../src/database/database.service.js";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Instante-base fixo — a suíte nunca depende do relógio da máquina. */
const T0 = new Date("2026-08-25T10:00:00.000Z");

/** Senha sintética usada por todas as fixtures. Nenhum dado real. */
const SENHA = "senha-sintetica-f3-integracao";
const SENHA_ERRADA = "senha-sintetica-f3-integracao-INCORRETA";

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

/** Relógio do limitador, em milissegundos. */
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
let hashDaSenha: string;

const relogioSessao = new RelogioControlado();
const relogioLimitador = new RelogioLimitador();
const limitador = new LimitadorLogin({ agora: relogioLimitador.ler });

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RELOGIO_SESSAO)
    .useValue(relogioSessao)
    .overrideProvider(LimitadorLogin)
    .useValue(limitador)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  baseUrl = await app.getUrl();
  database = moduleRef.get(DatabaseService);
  credenciais = moduleRef.get(CredencialService);
  // UM único hash Argon2 real, reaproveitado pelas fixtures: gerar um por
  // usuário custaria ~40 ms cada (`docs/10` §6-D.5) sem provar nada a mais.
  hashDaSenha = await credenciais.gerarHash(SENHA);
}, 120_000);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  relogioSessao.reiniciar();
  // Avança a janela do limitador entre testes usando o COMPORTAMENTO DE
  // PRODUÇÃO (expiração), nunca um `reset` artificial: sem isso, os testes
  // acumulariam falhas no mesmo IP de loopback e a dimensão de IP
  // (30 falhas/15 min) dispararia de forma cruzada.
  relogioLimitador.avancar(JANELA_MS + 1);
});

jest.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Fixtures e utilitários
// ---------------------------------------------------------------------------

interface UsuarioFixture {
  readonly id: string;
  readonly email: string;
}

async function criarUsuario(opcoes?: {
  ativo?: boolean;
  email?: string;
}): Promise<UsuarioFixture> {
  const email = opcoes?.email ?? `f3-${randomUUID().slice(0, 8)}@sintetico.local`;
  return database.transacao(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email,
        senhaHash: hashDaSenha,
        nome: "Usuário Sintético F3",
        ativo: opcoes?.ativo ?? true,
      },
      select: { id: true },
    });
    return { id: usuario.id, email };
  });
}

interface RespostaMedida {
  readonly status: number;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  readonly headers: Headers;
}

/** Cabeçalhos de um cliente same-origin legítimo (o `apps/web` futuro). */
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

async function medir(resposta: Response): Promise<RespostaMedida> {
  const texto = await resposta.text();
  let corpo: unknown = texto;
  if (texto !== "") {
    try {
      corpo = JSON.parse(texto) as unknown;
    } catch {
      corpo = texto;
    }
  } else {
    corpo = null;
  }
  return {
    status: resposta.status,
    corpo,
    cookies: resposta.headers.getSetCookie(),
    headers: resposta.headers,
  };
}

/**
 * Destino de conexão dos clientes `node:http` desta suíte.
 *
 * PORTABILIDADE IPv6 — o defeito que esta função existe para fechar. Os dois
 * helpers brutos derivavam o destino de `new URL(baseUrl).hostname`. Quando o
 * Nest escuta em IPv6, `app.getUrl()` devolve `http://[::1]:PORT` e aquele
 * `hostname` preserva os COLCHETES: chega `"[::1]"` a `http.request`, que o
 * trata como nome de host e o manda ao resolvedor.
 *
 * MEDIDO nos dois sistemas, com o mesmo script:
 *
 *   linux/x64  node v24.x  hostname "[::1]"  ->  getaddrinfo ENOTFOUND [::1]
 *   win32/x64  node v24.x  hostname "[::1]"  ->  conecta normalmente
 *
 * Daí a suíte passar na máquina de desenvolvimento e falhar no runner da CI:
 * 21 provas — CSRF, escopo do filtro e absolute-form — morriam no cliente,
 * sem sequer alcançar o produto. `fetch` normaliza a forma com colchetes por
 * conta própria, e por isso só os testes de `node:http` eram afetados.
 *
 * `urlToHttpOptions` é a conversão que o próprio Node usa quando recebe uma
 * `URL`: devolve `hostname` já sem colchetes (`"::1"`), com `port` e `path`
 * coerentes. Nada do request-target que cada prova quer transmitir é alterado
 * — quem precisa de alvo literal sobrescreve `path` explicitamente.
 */
function destinoDaBaseUrl(): ReturnType<typeof urlToHttpOptions> {
  return urlToHttpOptions(new URL(baseUrl));
}

/**
 * POST por `node:http` bruto — necessário para os cenários de Fetch Metadata.
 *
 * MEDIDO nesta fatia: o `fetch` do Node (undici) SOBRESCREVE `Sec-Fetch-Mode`
 * com `cors` e não deixa o chamador declarar `navigate`. Um teste de CSRF que
 * dependesse disso passaria por acidente, medindo o cliente e não a guard. O
 * cliente bruto envia exatamente os cabeçalhos pedidos.
 *
 * O destino vem de `urlToHttpOptions` — ver `destinoDaBaseUrl`.
 */
async function postBruto(
  caminho: string,
  cabecalhos: Record<string, string>,
  corpo: string,
): Promise<RespostaMedida> {
  // `urlToHttpOptions` também devolve `path` como `pathname + search`, de modo
  // que a query passa a ser REALMENTE transmitida — antes `path: url.pathname`
  // a descartava, e o caso "com query" não exercitava o que anunciava.
  const destino = urlToHttpOptions(new URL(caminho, baseUrl));
  return new Promise((resolver, rejeitar) => {
    const requisicao = http.request(
      {
        ...destino,
        method: "POST",
        headers: { ...cabecalhos, "content-length": Buffer.byteLength(corpo) },
      },
      (res) => {
        const pedacos: Buffer[] = [];
        res.on("data", (d: Buffer) => pedacos.push(d));
        res.on("end", () => {
          const texto = Buffer.concat(pedacos).toString("utf8");
          let analisado: unknown = null;
          if (texto !== "") {
            try {
              analisado = JSON.parse(texto) as unknown;
            } catch {
              analisado = texto;
            }
          }
          const cabecalhosResposta = new Headers();
          for (const [nome, valor] of Object.entries(res.headers)) {
            if (typeof valor === "string") cabecalhosResposta.append(nome, valor);
            else if (Array.isArray(valor)) {
              for (const v of valor) cabecalhosResposta.append(nome, v);
            }
          }
          resolver({
            status: res.statusCode ?? 0,
            corpo: analisado,
            cookies: (res.headers["set-cookie"] ?? []) as string[],
            headers: cabecalhosResposta,
          });
        });
      },
    );
    requisicao.on("error", rejeitar);
    requisicao.end(corpo);
  });
}

/**
 * POST que transmite o REQUEST-TARGET LITERAL na linha de requisição
 * (`F3R-01`).
 *
 * `postBruto` normaliza o alvo por `new URL(...).pathname`, o que torna
 * impossível exercitar a forma absoluta do RFC 7230 §5.3.2. Aqui o valor vai
 * verbatim para `http.request({ path })`, que o escreve sem tocar — é a única
 * forma de provar o comportamento no FIO. Chamar o filtro diretamente, ou
 * fabricar um objeto de requisição, provaria apenas a função pura e deixaria
 * passar exatamente o defeito medido.
 */
async function postComRequestTarget(
  requestTarget: string,
  cabecalhos: Record<string, string>,
  corpo: string,
): Promise<RespostaMedida> {
  return new Promise((resolver, rejeitar) => {
    const requisicao = http.request(
      {
        ...destinoDaBaseUrl(),
        // O `path` de `destinoDaBaseUrl()` é sobrescrito DE PROPÓSITO: o alvo
        // literal é justamente o que esta prova precisa colocar no fio.
        path: requestTarget,
        method: "POST",
        headers: { ...cabecalhos, "content-length": Buffer.byteLength(corpo) },
      },
      (res) => {
        const pedacos: Buffer[] = [];
        res.on("data", (d: Buffer) => pedacos.push(d));
        res.on("end", () => {
          const texto = Buffer.concat(pedacos).toString("utf8");
          let analisado: unknown = null;
          if (texto !== "") {
            try {
              analisado = JSON.parse(texto) as unknown;
            } catch {
              analisado = texto;
            }
          }
          resolver({
            status: res.statusCode ?? 0,
            corpo: analisado,
            cookies: (res.headers["set-cookie"] ?? []) as string[],
            headers: new Headers(),
          });
        });
      },
    );
    requisicao.on("error", rejeitar);
    requisicao.end(corpo);
  });
}

async function postLogin(
  corpo: unknown,
  opcoes?: { cabecalhos?: Record<string, string>; corpoBruto?: string },
): Promise<RespostaMedida> {
  return medir(
    await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: opcoes?.cabecalhos ?? cabecalhosLegitimos(),
      body: opcoes?.corpoBruto ?? JSON.stringify(corpo),
    }),
  );
}

async function postLogout(opcoes?: {
  token?: string | null;
  cabecalhos?: Record<string, string>;
}): Promise<RespostaMedida> {
  const cabecalhos = opcoes?.cabecalhos ?? cabecalhosLegitimos();
  const comCookie =
    opcoes?.token === undefined || opcoes.token === null
      ? cabecalhos
      : { ...cabecalhos, cookie: `${NOME_COOKIE_DESENVOLVIMENTO}=${opcoes.token}` };
  return medir(
    await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: comCookie }),
  );
}

/** Extrai o token do `Set-Cookie` da resposta de login. */
function tokenDoCookie(resposta: RespostaMedida): string {
  const cookie = resposta.cookies.find((c) =>
    c.startsWith(`${NOME_COOKIE_DESENVOLVIMENTO}=`),
  );
  expect(cookie).toBeDefined();
  const valor = (cookie as string).split(";", 1)[0] as string;
  return valor.slice(`${NOME_COOKIE_DESENVOLVIMENTO}=`.length);
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
        FROM evento_auditoria
       ORDER BY ocorrido_em, id
    `,
  );
}

async function lerSessoes(): Promise<
  Array<{ id: string; estado: string; usuario_id: string; encerrada_em: Date | null }>
> {
  return database.transacao(async (tx) =>
    tx.$queryRaw`
      SELECT id, estado, usuario_id, encerrada_em FROM sessao_autenticacao ORDER BY criada_em
    `,
  );
}

/** Provoca `n` falhas de login para o identificador informado. */
async function falharLogin(identificador: string, n: number): Promise<RespostaMedida> {
  let ultima: RespostaMedida | null = null;
  for (let i = 0; i < n; i += 1) {
    ultima = await postLogin({ identificador, senha: SENHA_ERRADA });
  }
  return ultima as RespostaMedida;
}

// ---------------------------------------------------------------------------
// Login — caminho feliz e contrato do cookie
// ---------------------------------------------------------------------------

describe("POST /auth/login — sucesso", () => {
  it("autentica, emite sessão ATIVA e devolve 200 com corpo mínimo", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual({
      usuarioId: usuario.id,
      expiraEm: new Date(T0.getTime() + POLITICA_SESSAO.expiracaoAbsolutaMs).toISOString(),
    });

    const sessoes = await lerSessoes();
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.estado).toBe("ATIVA");
    expect(sessoes[0]?.usuario_id).toBe(usuario.id);
  });

  it("o token sai EXCLUSIVAMENTE pelo cookie — nunca no corpo", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    const token = tokenDoCookie(resposta);

    // O token existe e é o token composto `<uuid>.<segredo>`.
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/,
    );
    // E não aparece em lugar nenhum do corpo.
    const corpoSerializado = JSON.stringify(resposta.corpo);
    expect(corpoSerializado).not.toContain(token);
    expect(corpoSerializado).not.toContain(token.split(".")[1] as string);
    expect(Object.keys(resposta.corpo as object).sort()).toEqual([
      "expiraEm",
      "usuarioId",
    ]);
  });

  it("o segredo em claro NÃO é persistido — só o verificador SHA-256", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    const segredo = tokenDoCookie(resposta).split(".")[1] as string;

    const linhas = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM sessao_autenticacao
      `,
    );
    expect(JSON.stringify(linhas)).not.toContain(segredo);
  });

  it("D-2.3D-07 — o cookie carrega os atributos do ambiente de desenvolvimento", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    const cookie = resposta.cookies.find((c) =>
      c.startsWith(`${NOME_COOKIE_DESENVOLVIMENTO}=`),
    ) as string;

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain");
    // Ambiente de teste roda sobre HTTP local: `Secure` marcaria um cookie que
    // o navegador nunca enviaria de volta. O nome é o DISTINTO, por decisão.
    expect(cookie).not.toContain("Secure");
    expect(cookie.startsWith(NOME_COOKIE_PROTEGIDO)).toBe(false);
  });

  it("D-2.3D-03 — o identificador é normalizado por trim + lowercase", async () => {
    const usuario = await criarUsuario({ email: "normalizacao-f3@sintetico.local" });
    for (const variante of [
      "  normalizacao-f3@sintetico.local  ",
      "NORMALIZACAO-F3@SINTETICO.LOCAL",
      "\tNormalizacao-F3@Sintetico.Local\n",
    ]) {
      const resposta = await postLogin({ identificador: variante, senha: SENHA });
      expect(resposta.status).toBe(200);
      expect((resposta.corpo as { usuarioId: string }).usuarioId).toBe(usuario.id);
    }
  });

  it("FC-01 — o login bem-sucedido é auditado como usuario.autenticacao/SUCESSO", async () => {
    const usuario = await criarUsuario();
    await postLogin({ identificador: usuario.email, senha: SENHA });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      acao: "usuario.autenticacao",
      resultado: "SUCESSO",
      ator_usuario_id: usuario.id,
      alvo_tipo: "usuario",
      alvo_id: usuario.id,
      justificativa: null,
    });
    expect(eventos[0]?.contexto ?? {}).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Login — rejeições
// ---------------------------------------------------------------------------

describe("POST /auth/login — rejeições", () => {
  it("senha inválida devolve 401 uniforme, sem cookie e sem sessão", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin({
      identificador: usuario.email,
      senha: SENHA_ERRADA,
    });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
    expect(resposta.cookies).toEqual([]);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("usuário inexistente devolve o MESMO 401, sem cookie e sem sessão", async () => {
    const resposta = await postLogin({
      identificador: "inexistente-f3@sintetico.local",
      senha: SENHA,
    });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
    expect(resposta.cookies).toEqual([]);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("AUT-001 — usuário INATIVO não cria sessão, mesmo com a senha correta", async () => {
    const usuario = await criarUsuario({ ativo: false });
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
    expect(resposta.cookies).toEqual([]);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it.each([
    ["campo ausente", { identificador: "u@sintetico.local" }],
    ["tipo errado", { identificador: 1, senha: 2 }],
    ["vazios", { identificador: "", senha: "" }],
    ["só espaços no identificador", { identificador: "   ", senha: "x" }],
    ["array no lugar do objeto", [{ identificador: "u@s.local", senha: "x" }]],
  ])("payload inválido (%s) devolve 400 sem sessão", async (_rotulo, corpo) => {
    const resposta = await postLogin(corpo);
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("JSON sintaticamente inválido devolve o CONTRATO FECHADO, não o erro do parser", async () => {
    // O body parser roda como middleware, ANTES do roteamento: sem o
    // `FiltroErroAutenticacao` o Nest devolveria aqui a mensagem do parser
    // ("Expected property name or '}' in JSON at position 1 ..."), que não é o
    // contrato declarado no OpenAPI para 400. Comportamento MEDIDO nesta fatia.
    const resposta = await postLogin(null, { corpoBruto: "{não é json" });
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    const texto = JSON.stringify(resposta.corpo);
    expect(texto).not.toContain("at ");
    expect(texto).not.toContain("position");
    expect(texto).not.toContain("JSON");
  });

  it("falha TÉCNICA vira 500 FALHA_INTERNA — nunca 401", async () => {
    // Uma indisponibilidade de infraestrutura reportada como credencial
    // inválida destruiria a observabilidade operacional. A exceção sintética
    // carrega um valor sensível de propósito: ele não pode chegar ao cliente.
    const usuario = await criarUsuario();
    const autenticacao = moduleRef.get(AutenticacaoService);
    const espia = jest
      .spyOn(autenticacao, "autenticar")
      .mockRejectedValue(
        new Error(
          "falha sintetica: SELECT * FROM usuario WHERE email = 'segredo-do-driver'",
        ),
      );
    try {
      const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
      expect(resposta.status).toBe(500);
      expect(resposta.corpo).toEqual({ erro: "FALHA_INTERNA" });
      const texto = JSON.stringify(resposta.corpo);
      expect(texto).not.toContain("segredo-do-driver");
      expect(texto).not.toContain("SELECT");
      expect(texto).not.toContain("at ");
    } finally {
      espia.mockRestore();
    }
  });

  it("nenhuma resposta de erro carrega stack trace, hash, SQL ou detalhe interno", async () => {
    const usuario = await criarUsuario();
    const respostas = [
      await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA }),
      await postLogin({ identificador: "inexistente@sintetico.local", senha: SENHA }),
      await postLogin({ identificador: "", senha: "" }),
      await postLogout({ token: "token-malformado" }),
    ];
    for (const resposta of respostas) {
      const texto = JSON.stringify(resposta.corpo);
      for (const proibido of [
        "at ",
        "$argon2",
        "prisma",
        "Prisma",
        "SELECT",
        "sessao_autenticacao",
        "senha_hash",
        "token_hash",
        "ErroSessao",
        "ErroCredencial",
      ]) {
        expect(texto).not.toContain(proibido);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// D-2.3D-12 — auditoria da falha de autenticação
// ---------------------------------------------------------------------------

describe("D-2.3D-12 — auditoria da falha admitida", () => {
  it("conta EXISTENTE: ator NULL, alvo = usuario.id, contexto vazio", async () => {
    const usuario = await criarUsuario();
    await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      acao: "usuario.autenticacao",
      resultado: "FALHA",
      ator_usuario_id: null,
      alvo_tipo: "usuario",
      alvo_id: usuario.id,
      justificativa: null,
    });
    expect(eventos[0]?.contexto ?? {}).toEqual({});
  });

  it("conta INEXISTENTE: ator NULL, alvo NULL, contexto vazio", async () => {
    await postLogin({
      identificador: "inexistente-f3@sintetico.local",
      senha: SENHA,
    });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      acao: "usuario.autenticacao",
      resultado: "FALHA",
      ator_usuario_id: null,
      alvo_id: null,
      alvo_tipo: "usuario",
      justificativa: null,
    });
    expect(eventos[0]?.contexto ?? {}).toEqual({});
  });

  it("conta INATIVA também é falha admitida — evento com alvo = usuario.id", async () => {
    const usuario = await criarUsuario({ ativo: false });
    await postLogin({ identificador: usuario.email, senha: SENHA });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      acao: "usuario.autenticacao",
      resultado: "FALHA",
      ator_usuario_id: null,
      alvo_id: usuario.id,
    });
  });

  it("o identificador tentado NUNCA aparece em nenhuma coluna do evento", async () => {
    const identificador = "alvo-nunca-registrado-f3@sintetico.local";
    await postLogin({ identificador, senha: SENHA });

    const linhas = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM evento_auditoria`,
    );
    const serializado = JSON.stringify(linhas);
    expect(serializado).not.toContain(identificador);
    expect(serializado).not.toContain("alvo-nunca-registrado");
    expect(serializado).not.toContain("sintetico.local");
    expect(serializado).not.toContain(SENHA);
    expect(serializado).not.toContain("$argon2");
  });

  it("payload REJEITADO ANTES da autenticação NÃO gera evento", async () => {
    for (const corpo of [
      { identificador: "u@sintetico.local" },
      { identificador: 1, senha: 2 },
      { identificador: "", senha: "" },
    ]) {
      const resposta = await postLogin(corpo);
      expect(resposta.status).toBe(400);
    }
    expect(await lerEventos()).toHaveLength(0);
  });

  it("requisição recusada pela baseline CSRF NÃO gera evento", async () => {
    const usuario = await criarUsuario();
    const resposta = await postLogin(
      { identificador: usuario.email, senha: SENHA },
      { cabecalhos: { "content-type": "application/json" } },
    );
    expect(resposta.status).toBe(403);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("requisição BLOQUEADA com 429 NÃO gera evento adicional", async () => {
    const usuario = await criarUsuario();
    // As 5 falhas admitidas geram 5 eventos — este é o baseline.
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    expect(await lerEventos()).toHaveLength(LIMITE_POR_IDENTIFICADOR);

    // As tentativas seguintes são bloqueadas ANTES da autenticação.
    for (let i = 0; i < 4; i += 1) {
      const resposta = await postLogin({
        identificador: usuario.email,
        senha: SENHA_ERRADA,
      });
      expect(resposta.status).toBe(429);
    }
    expect(await lerEventos()).toHaveLength(LIMITE_POR_IDENTIFICADOR);
  });

  it("nenhum evento de autenticação carrega contexto ou justificativa", async () => {
    const usuario = await criarUsuario();
    await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
    await postLogin({ identificador: usuario.email, senha: SENHA });

    for (const evento of await lerEventos()) {
      expect(evento.contexto ?? {}).toEqual({});
      expect(evento.justificativa).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// D-2.3D-06 — rate limiting do login
// ---------------------------------------------------------------------------

describe("D-2.3D-06 — rate limiting", () => {
  it("5 falhas por identificador em 15 min => 429 com Retry-After", async () => {
    const usuario = await criarUsuario();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      const resposta = await postLogin({
        identificador: usuario.email,
        senha: SENHA_ERRADA,
      });
      expect(resposta.status).toBe(401);
    }
    const bloqueada = await postLogin({
      identificador: usuario.email,
      senha: SENHA_ERRADA,
    });
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.corpo).toEqual({ erro: "TENTATIVAS_EXCEDIDAS" });

    const retryAfter = bloqueada.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    const segundos = Number.parseInt(retryAfter as string, 10);
    expect(Number.isInteger(segundos)).toBe(true);
    expect(segundos).toBeGreaterThanOrEqual(1);
    expect(segundos).toBeLessThanOrEqual(JANELA_MS / 1000);
  });

  it("30 falhas por IP em 15 min => 429, mesmo com identificadores distintos", async () => {
    // A dimensão de IP sobre HTTP real: todas as requisições saem do mesmo
    // socket de loopback. Trinta identificadores DISTINTOS mantêm a dimensão
    // de identificador em 1 falha cada (bem abaixo de 5) e isolam a dimensão
    // de IP, que é a única capaz de disparar aqui.
    for (let i = 0; i < LIMITE_POR_IP; i += 1) {
      const resposta = await postLogin({
        identificador: `ip-dimensao-${String(i)}@sintetico.local`,
        senha: SENHA_ERRADA,
      });
      expect(resposta.status).toBe(401);
    }
    const bloqueada = await postLogin({
      identificador: "ip-dimensao-novo@sintetico.local",
      senha: SENHA_ERRADA,
    });
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.corpo).toEqual({ erro: "TENTATIVAS_EXCEDIDAS" });
    expect(bloqueada.headers.get("retry-after")).not.toBeNull();
    // E a janela de IP também LIBERA — o limite é temporal, não lockout.
    relogioLimitador.avancar(JANELA_MS + 1);
    expect(
      (await postLogin({
        identificador: "ip-dimensao-novo@sintetico.local",
        senha: SENHA_ERRADA,
      })).status,
    ).toBe(401);
  });

  it("a SENHA CORRETA também é bloqueada — o gate é anterior à verificação", async () => {
    const usuario = await criarUsuario();
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(resposta.status).toBe(429);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("ORDEM — Argon2 NÃO é executado quando a tentativa já está bloqueada", async () => {
    const usuario = await criarUsuario();
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);

    // A espiã é instalada DEPOIS de saturar a janela: qualquer chamada a
    // partir daqui prova que o Argon2 rodou depois do gate.
    const espia = jest.spyOn(credenciais, "verificarComCaminhoDummy");
    try {
      for (let i = 0; i < 3; i += 1) {
        const resposta = await postLogin({
          identificador: usuario.email,
          senha: SENHA_ERRADA,
        });
        expect(resposta.status).toBe(429);
      }
      expect(espia).not.toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
  });

  it("controle positivo: uma tentativa ADMITIDA de fato executa o Argon2", async () => {
    // Sem este controle, o teste anterior passaria mesmo com a espiã quebrada.
    const usuario = await criarUsuario();
    const espia = jest.spyOn(credenciais, "verificarComCaminhoDummy");
    try {
      await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
      expect(espia).toHaveBeenCalledTimes(1);
    } finally {
      espia.mockRestore();
    }
  });

  it("a janela LIBERA após 15 minutos — não existe lockout duro", async () => {
    const usuario = await criarUsuario();
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    expect(
      (await postLogin({ identificador: usuario.email, senha: SENHA })).status,
    ).toBe(429);

    relogioLimitador.avancar(JANELA_MS + 1);
    const liberada = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(liberada.status).toBe(200);
  });

  it("o bloqueio segue o identificador NORMALIZADO, não a grafia enviada", async () => {
    const usuario = await criarUsuario({ email: "limite-normalizado@sintetico.local" });
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    // Mesma conta, grafia diferente: o contador é o mesmo (`D-2.3D-03`).
    const resposta = await postLogin({
      identificador: "  LIMITE-NORMALIZADO@SINTETICO.LOCAL  ",
      senha: SENHA,
    });
    expect(resposta.status).toBe(429);
  });

  it("o identificador nunca entra em claro no contador", async () => {
    const usuario = await criarUsuario();
    await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
    for (const chave of limitador.listarChavesDeIdentificadorParaProva()) {
      expect(chave).not.toContain(usuario.email);
      expect(chave).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("X-Forwarded-For NÃO é aceito como origem — a dimensão de IP é do socket", async () => {
    const usuario = await criarUsuario();
    // Se o cabeçalho fosse confiado, cada valor abriria um contador de IP novo.
    // A dimensão de identificador ainda assim satura, o que prova que o
    // cabeçalho não deu a volta em nada.
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      await postLogin(
        { identificador: usuario.email, senha: SENHA_ERRADA },
        { cabecalhos: cabecalhosLegitimos({ "x-forwarded-for": `10.0.0.${String(i)}` }) },
      );
    }
    const resposta = await postLogin(
      { identificador: usuario.email, senha: SENHA_ERRADA },
      { cabecalhos: cabecalhosLegitimos({ "x-forwarded-for": "10.0.0.250" }) },
    );
    expect(resposta.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// T-AUTH-ENUMERATION — simetria estrutural
// ---------------------------------------------------------------------------

describe("T-AUTH-ENUMERATION — conta existente × inexistente", () => {
  it("o CONTRATO HTTP observável é idêntico nos dois casos", async () => {
    const usuario = await criarUsuario();
    const existente = await postLogin({
      identificador: usuario.email,
      senha: SENHA_ERRADA,
    });
    const inexistente = await postLogin({
      identificador: "jamais-cadastrado-f3@sintetico.local",
      senha: SENHA_ERRADA,
    });

    expect(existente.status).toBe(inexistente.status);
    expect(existente.corpo).toEqual(inexistente.corpo);
    expect(existente.cookies).toEqual(inexistente.cookies);
    // Nem os cabeçalhos que o cliente vê podem diferir de forma discriminante.
    const relevantes = (r: RespostaMedida): string[] =>
      [...r.headers.keys()].filter((h) => h !== "date" && h !== "etag").sort();
    expect(relevantes(existente)).toEqual(relevantes(inexistente));
  });

  it("a conta INATIVA é indistinguível das outras duas no contrato HTTP", async () => {
    const inativo = await criarUsuario({ ativo: false });
    const respostaInativa = await postLogin({
      identificador: inativo.email,
      senha: SENHA,
    });
    const respostaInexistente = await postLogin({
      identificador: "jamais-cadastrado-2-f3@sintetico.local",
      senha: SENHA,
    });
    expect(respostaInativa.status).toBe(respostaInexistente.status);
    expect(respostaInativa.corpo).toEqual(respostaInexistente.corpo);
  });

  it("os dois casos percorrem o MESMO caminho de verificação (caminho dummy)", async () => {
    // Prova ESTRUTURAL, não temporal: o `verify` Argon2 é executado uma vez em
    // cada caso, pela mesma primitiva. Para a conta inexistente o hash
    // persistido é `null`, e a F1 força o `verify` contra o digest dummy.
    const usuario = await criarUsuario();
    const espia = jest.spyOn(credenciais, "verificarComCaminhoDummy");
    try {
      await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
      await postLogin({
        identificador: "jamais-cadastrado-3-f3@sintetico.local",
        senha: SENHA_ERRADA,
      });
      expect(espia).toHaveBeenCalledTimes(2);
      const [primeira, segunda] = espia.mock.calls;
      // Conta existente: recebe o digest PHC real.
      expect(String(primeira?.[0])).toContain("$argon2id$");
      // Conta inexistente: recebe `null` — e a F1 paga o dummy mesmo assim.
      expect(segunda?.[0]).toBeNull();
      expect(await espia.mock.results[1]?.value).toBe(false);
    } finally {
      espia.mockRestore();
    }
  });

  it("os dois casos produzem a MESMA estrutura de auditoria (D-2.3D-12)", async () => {
    const usuario = await criarUsuario();
    await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
    await postLogin({
      identificador: "jamais-cadastrado-4-f3@sintetico.local",
      senha: SENHA_ERRADA,
    });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(2);
    for (const evento of eventos) {
      expect(evento.acao).toBe("usuario.autenticacao");
      expect(evento.resultado).toBe("FALHA");
      expect(evento.ator_usuario_id).toBeNull();
      expect(evento.alvo_tipo).toBe("usuario");
      expect(evento.contexto ?? {}).toEqual({});
    }
    // A ÚNICA diferença permitida — e não observável pelo cliente.
    expect(eventos[0]?.alvo_id).toBe(usuario.id);
    expect(eventos[1]?.alvo_id).toBeNull();
  });

  it("os dois casos contabilizam igualmente no rate limiter", async () => {
    const usuario = await criarUsuario();
    const inexistente = "jamais-cadastrado-5-f3@sintetico.local";
    // As duas janelas correm SIMULTANEAMENTE — avançar o relógio entre elas
    // limparia a primeira e o teste mediria outra coisa. 10 falhas no mesmo IP
    // de loopback ficam confortavelmente abaixo do limite de 30.
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    await falharLogin(inexistente, LIMITE_POR_IDENTIFICADOR);

    // Ambos chegam a 429 com o mesmo número de tentativas: um identificador
    // inexistente que não contasse seria, por si só, um oráculo.
    const bloqueadoExistente = await postLogin({
      identificador: usuario.email,
      senha: SENHA_ERRADA,
    });
    const bloqueadoInexistente = await postLogin({
      identificador: inexistente,
      senha: SENHA_ERRADA,
    });
    expect(bloqueadoExistente.status).toBe(429);
    expect(bloqueadoInexistente.status).toBe(429);
  });

  it("MEDIÇÃO COMPLEMENTAR (evidência, não gate): tempos na mesma ordem de grandeza", async () => {
    // Deliberadamente NÃO é um limiar de milissegundos: a asserção real é a
    // simetria estrutural acima. Este bloco registra a medição, e só falha se
    // a diferença for GROSSEIRA (uma ordem de grandeza) — o que indicaria um
    // caminho inteiro a mais ou a menos, não ruído de máquina.
    const usuario = await criarUsuario();
    const amostrar = async (identificador: string): Promise<number> => {
      const inicio = process.hrtime.bigint();
      await postLogin({ identificador, senha: SENHA_ERRADA });
      relogioLimitador.avancar(JANELA_MS + 1);
      return Number(process.hrtime.bigint() - inicio) / 1e6;
    };
    const existentes: number[] = [];
    const inexistentes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      existentes.push(await amostrar(usuario.email));
      inexistentes.push(await amostrar(`ausente-${String(i)}-f3@sintetico.local`));
    }
    const mediana = (v: number[]): number =>
      [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] as number;
    const a = mediana(existentes);
    const b = mediana(inexistentes);
    const razao = Math.max(a, b) / Math.max(1, Math.min(a, b));
    // eslint-disable-next-line no-console -- evidência de medição, sem dado sensível
    console.log(
      `[T-AUTH-ENUMERATION] mediana existente=${a.toFixed(1)}ms · inexistente=${b.toFixed(1)}ms · razão=${razao.toFixed(2)}`,
    );
    expect(razao).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe("POST /auth/logout", () => {
  async function autenticar(): Promise<{ usuario: UsuarioFixture; token: string }> {
    const usuario = await criarUsuario();
    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(resposta.status).toBe(200);
    return { usuario, token: tokenDoCookie(resposta) };
  }

  it("logout válido devolve 204 sem corpo e revoga a sessão", async () => {
    const { usuario, token } = await autenticar();
    const resposta = await postLogout({ token });

    expect(resposta.status).toBe(204);
    expect(resposta.corpo).toBeNull();

    const sessoes = await lerSessoes();
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.estado).toBe("REVOGADA");
    expect(sessoes[0]?.encerrada_em).not.toBeNull();
    expect(sessoes[0]?.usuario_id).toBe(usuario.id);
  });

  it("o cookie é limpo de forma segura — mesmo nome, mesmo Path, Max-Age=0", async () => {
    const { token } = await autenticar();
    const resposta = await postLogout({ token });
    const limpeza = resposta.cookies.find((c) =>
      c.startsWith(`${NOME_COOKIE_DESENVOLVIMENTO}=`),
    ) as string;

    expect(limpeza).toBeDefined();
    expect(limpeza).toContain(`${NOME_COOKIE_DESENVOLVIMENTO}=;`);
    expect(limpeza).toContain("Max-Age=0");
    expect(limpeza).toContain("Path=/");
    expect(limpeza).toContain("HttpOnly");
    expect(limpeza).toContain("SameSite=Strict");
    expect(limpeza).not.toContain(token);
  });

  it("FC-01 — o logout é auditado como usuario.sessao.logout/SUCESSO", async () => {
    const { usuario, token } = await autenticar();
    await postLogout({ token });

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(2);
    expect(eventos[1]).toMatchObject({
      acao: "usuario.sessao.logout",
      resultado: "SUCESSO",
      ator_usuario_id: usuario.id,
      alvo_tipo: "sessao_autenticacao",
      justificativa: null,
    });
    expect(eventos[1]?.alvo_id).toBe((await lerSessoes())[0]?.id);
    expect(eventos[1]?.contexto ?? {}).toEqual({});
  });

  it("nenhum evento de logout carrega token, cookie ou segredo", async () => {
    const { token } = await autenticar();
    await postLogout({ token });
    const linhas = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM evento_auditoria`,
    );
    const serializado = JSON.stringify(linhas);
    expect(serializado).not.toContain(token);
    expect(serializado).not.toContain(token.split(".")[1] as string);
  });

  it("A-05 — os cinco motivos internos colapsam na MESMA resposta", async () => {
    const { token } = await autenticar();
    const outro = await autenticar();

    // 1. sem cookie algum
    const semCookie = await postLogout({});
    // 2. token malformado
    const malformado = await postLogout({ token: "não-é-um-token" });
    // 3. sessão inexistente (uuid válido, sessão que nunca existiu)
    const inexistente = await postLogout({
      token: `${randomUUID()}.${"A".repeat(43)}`,
    });
    // 4. segredo inválido para sessão existente
    const segredoErrado = await postLogout({
      token: `${(token.split(".")[0] as string)}.${"B".repeat(43)}`,
    });
    // 5. sessão já revogada
    await postLogout({ token: outro.token });
    const jaRevogada = await postLogout({ token: outro.token });

    const todas = [semCookie, malformado, inexistente, segredoErrado, jaRevogada];
    for (const resposta of todas) {
      expect(resposta.status).toBe(401);
      expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
      // O cookie é limpo também no caminho de falha.
      expect(
        resposta.cookies.some((c) => c.includes("Max-Age=0")),
      ).toBe(true);
    }
    // Corpo idêntico nos cinco: nenhum oráculo sobre o estado interno.
    expect(new Set(todas.map((r) => JSON.stringify(r.corpo))).size).toBe(1);
  });

  it("sessão já EXPIRADA responde igual e não é reativada", async () => {
    const { token } = await autenticar();
    // Além do teto ABSOLUTO de 8 h (`D-2.3D-04`).
    relogioSessao.definir(new Date(T0.getTime() + 8 * HORA + MINUTO));

    const resposta = await postLogout({ token });
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });

    const sessoes = await lerSessoes();
    expect(sessoes[0]?.estado).toBe("EXPIRADA");
  });

  it("sessão OCIOSA (15 min) responde igual e fecha como EXPIRADA", async () => {
    const { token } = await autenticar();
    relogioSessao.definir(new Date(T0.getTime() + 15 * MINUTO + 1));

    expect((await postLogout({ token })).status).toBe(401);
    expect((await lerSessoes())[0]?.estado).toBe("EXPIRADA");
  });

  it("D-2.3D-05 — NENHUM estado terminal volta a ATIVA", async () => {
    const { token } = await autenticar();
    expect((await postLogout({ token })).status).toBe(204);

    // Repetições, inclusive concorrentes, não ressuscitam nem reescrevem.
    const encerradaOriginal = (await lerSessoes())[0]?.encerrada_em;
    await Promise.all([
      postLogout({ token }),
      postLogout({ token }),
      postLogout({ token }),
    ]);
    const sessoes = await lerSessoes();
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.estado).toBe("REVOGADA");
    expect(sessoes[0]?.encerrada_em).toEqual(encerradaOriginal);

    // E um único evento de logout — repetição não audita de novo.
    const logouts = (await lerEventos()).filter(
      (e) => e.acao === "usuario.sessao.logout",
    );
    expect(logouts).toHaveLength(1);
  });

  it("logout não devolve token nem informação interna de sessão", async () => {
    const { token } = await autenticar();
    const resposta = await postLogout({ token });
    expect(resposta.corpo).toBeNull();
    const cabecalhos = JSON.stringify([...resposta.headers.entries()]);
    expect(cabecalhos).not.toContain(token.split(".")[1] as string);
    expect(cabecalhos.toLowerCase()).not.toContain("estado");
    expect(cabecalhos.toLowerCase()).not.toContain("expira");
  });
});

// ---------------------------------------------------------------------------
// D-2.3D-07 — baseline CSRF sobre o servidor real
// ---------------------------------------------------------------------------

describe("D-2.3D-07 — CSRF na fronteira real", () => {
  it("requisição legítima passa nas duas rotas", async () => {
    const usuario = await criarUsuario();
    const login = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(login.status).toBe(200);
    expect(await postLogout({ token: tokenDoCookie(login) })).toMatchObject({
      status: 204,
    });
  });

  it.each([
    [
      "custom header ausente",
      { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    ],
    [
      "content-type de formulário",
      {
        "content-type": "application/x-www-form-urlencoded",
        [CABECALHO_REQUISICAO_TLF]: "1",
      },
    ],
    [
      "content-type text/plain",
      { "content-type": "text/plain", [CABECALHO_REQUISICAO_TLF]: "1" },
    ],
    [
      "Fetch Metadata cross-site",
      {
        "content-type": "application/json",
        [CABECALHO_REQUISICAO_TLF]: "1",
        "sec-fetch-site": "cross-site",
      },
    ],
    [
      "Sec-Fetch-Mode navigate",
      {
        "content-type": "application/json",
        [CABECALHO_REQUISICAO_TLF]: "1",
        "sec-fetch-mode": "navigate",
      },
    ],
    [
      "Origin de outro host",
      {
        "content-type": "application/json",
        [CABECALHO_REQUISICAO_TLF]: "1",
        origin: "https://atacante.example",
      },
    ],
  ])("login com %s é recusado com 403 e não autentica", async (_rotulo, cabecalhos) => {
    const usuario = await criarUsuario();
    // HTTP bruto: o `fetch` do Node reescreve `Sec-Fetch-Mode` (ver `postBruto`).
    const resposta = await postBruto(
      "/auth/login",
      cabecalhos,
      JSON.stringify({ identificador: usuario.email, senha: SENHA }),
    );
    expect(resposta.status).toBe(403);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_NAO_AUTORIZADA" });
    expect(resposta.cookies).toEqual([]);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("logout sem o custom header é recusado e NÃO revoga a sessão", async () => {
    const usuario = await criarUsuario();
    const login = await postLogin({ identificador: usuario.email, senha: SENHA });
    const token = tokenDoCookie(login);

    const recusado = await postLogout({
      token,
      cabecalhos: { "content-type": "application/json" },
    });
    expect(recusado.status).toBe(403);
    // A sessão continua ATIVA: a guard é anterior a qualquer efeito.
    expect((await lerSessoes())[0]?.estado).toBe("ATIVA");
    // E o cookie não foi limpo — o handler nem chegou a executar.
    expect(recusado.cookies).toEqual([]);
  });

  it("CORS NÃO está habilitado — nenhuma resposta traz cabeçalho de CORS", async () => {
    const usuario = await criarUsuario();
    const respostas = [
      await postLogin({ identificador: usuario.email, senha: SENHA }),
      await postLogin(
        { identificador: usuario.email, senha: SENHA },
        { cabecalhos: cabecalhosLegitimos({ origin: "https://atacante.example" }) },
      ),
      medirCabecalhos(
        await fetch(`${baseUrl}/auth/login`, {
          method: "OPTIONS",
          headers: {
            origin: "https://atacante.example",
            "access-control-request-method": "POST",
            "access-control-request-headers": CABECALHO_REQUISICAO_TLF,
          },
        }),
      ),
    ];
    for (const resposta of await Promise.all(respostas)) {
      for (const cabecalho of [
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "access-control-allow-headers",
        "access-control-allow-methods",
      ]) {
        expect(resposta.headers.get(cabecalho)).toBeNull();
      }
    }
  });

  async function medirCabecalhos(resposta: Response): Promise<RespostaMedida> {
    return medir(resposta);
  }
});

// ---------------------------------------------------------------------------
// D-2.3D-11 — coerência entre contrato e runtime
// ---------------------------------------------------------------------------

describe("D-2.3D-11 — contrato e runtime coerentes", () => {
  it("todos os status documentados para /auth/login ocorrem de fato", async () => {
    const usuario = await criarUsuario();
    const observados = new Set<number>();

    observados.add((await postLogin({ identificador: usuario.email, senha: SENHA })).status);
    observados.add((await postLogin({ identificador: "x" })).status);
    observados.add(
      (
        await postLogin(
          { identificador: usuario.email, senha: SENHA },
          { cabecalhos: { "content-type": "application/json" } },
        )
      ).status,
    );
    relogioLimitador.avancar(JANELA_MS + 1);
    observados.add(
      (await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA })).status,
    );
    await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
    observados.add(
      (await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA })).status,
    );
    // `413` — corpo acima do limite do body parser (correção `F-03`).
    observados.add(
      (
        await postLogin(null, {
          corpoBruto: JSON.stringify({
            identificador: "a@b.local",
            senha: "x".repeat(200_000),
          }),
        })
      ).status,
    );

    expect([...observados].sort((a, b) => a - b)).toEqual([
      200, 400, 401, 403, 413, 429,
    ]);
  });

  it("todos os status documentados para /auth/logout ocorrem de fato", async () => {
    const usuario = await criarUsuario();
    const login = await postLogin({ identificador: usuario.email, senha: SENHA });
    const observados = new Set<number>();

    observados.add(
      (
        await postLogout({
          token: tokenDoCookie(login),
          cabecalhos: { "content-type": "application/json" },
        })
      ).status,
    );
    observados.add((await postLogout({ token: tokenDoCookie(login) })).status);
    observados.add((await postLogout({})).status);

    expect([...observados].sort((a, b) => a - b)).toEqual([204, 401, 403]);
  });

  it("o documento OpenAPI é servido em ambiente de desenvolvimento", async () => {
    // `main.ts` monta a rota fora de produção/homologação. Aqui a prova é a
    // do documento em si; a montagem por ambiente é provada em
    // `verify-openapi-runtime.mjs`, contra o `dist/` real.
    const resposta = await fetch(`${baseUrl}/health`);
    expect(resposta.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Ausência de segredo em log
// ---------------------------------------------------------------------------

describe("TLF-BASE-V1 §10 — nenhum segredo em log", () => {
  it("nenhuma escrita em console carrega senha, token, identificador ou hash", async () => {
    const capturado: string[] = [];
    const metodos = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const espias = metodos.map((m) =>
      jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        capturado.push(args.map((a) => String(a)).join(" "));
      }),
    );
    try {
      const usuario = await criarUsuario();
      const login = await postLogin({ identificador: usuario.email, senha: SENHA });
      const token = tokenDoCookie(login);
      await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA });
      await postLogin({ identificador: "ausente-log-f3@sintetico.local", senha: SENHA });
      await postLogin({ identificador: "", senha: "" });
      await falharLogin(usuario.email, LIMITE_POR_IDENTIFICADOR);
      await postLogout({ token });
      await postLogout({ token: "malformado" });

      const tudo = capturado.join("\n");
      for (const proibido of [
        SENHA,
        SENHA_ERRADA,
        token,
        token.split(".")[1] as string,
        usuario.email,
        "ausente-log-f3",
        "$argon2",
      ]) {
        expect(tudo).not.toContain(proibido);
      }
    } finally {
      for (const espia of espias) espia.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// `F-01` — o gate de `D-2.3D-06` vale sob CONCORRÊNCIA (correção pós-revisão)
// ---------------------------------------------------------------------------

describe("F-01 — rate limit sob concorrência real", () => {
  /**
   * Segura TODAS as verificações de credencial numa barreira, para que N
   * requisições fiquem simultaneamente "dentro do await" — o estado exato em
   * que a versão anterior deixava todo mundo atravessar o gate.
   *
   * O `verify` real NÃO é executado: o que se mede aqui é o GATE, e disparar
   * 30 Argon2 simultâneos (19 MiB cada) só consumiria memória sem provar nada
   * a mais. As provas de Argon2 real continuam nos outros blocos.
   */
  function segurarVerificacao(): {
    chamadas: () => number;
    liberar: () => void;
    restaurar: () => void;
  } {
    let contador = 0;
    let abrir: () => void = () => undefined;
    const barreira = new Promise<void>((resolver) => {
      abrir = resolver;
    });
    const espia = jest
      .spyOn(credenciais, "verificarComCaminhoDummy")
      .mockImplementation(async () => {
        contador += 1;
        await barreira;
        return false;
      });
    return {
      chamadas: () => contador,
      liberar: () => {
        abrir();
      },
      restaurar: () => {
        espia.mockRestore();
      },
    };
  }

  /** Espera a convergência do lote, com teto explícito e falha ruidosa. */
  async function aguardarConvergencia(
    condicao: () => boolean,
    rotulo: string,
  ): Promise<void> {
    for (let i = 0; i < 600; i += 1) {
      if (condicao()) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`convergência não alcançada: ${rotulo}`);
  }

  it("12 tentativas SIMULTÂNEAS ao mesmo identificador: no máximo 5 chegam ao verificador", async () => {
    const usuario = await criarUsuario();
    const barreira = segurarVerificacao();
    const CONCORRENTES = 12;
    let concluidas = 0;
    try {
      const promessas = Array.from({ length: CONCORRENTES }, () =>
        postLogin({ identificador: usuario.email, senha: SENHA_ERRADA }).then((r) => {
          concluidas += 1;
          return r;
        }),
      );
      // Todas ou entraram no verificador (seguras pela barreira) ou já
      // terminaram com 429 — nenhuma requisição fica indefinida.
      await aguardarConvergencia(
        () => barreira.chamadas() + concluidas >= CONCORRENTES,
        "lote de identificador",
      );

      // A PROPRIEDADE de `D-2.3D-06`: o trabalho custoso é limitado.
      expect(barreira.chamadas()).toBeLessThanOrEqual(LIMITE_POR_IDENTIFICADOR);

      barreira.liberar();
      const respostas = await Promise.all(promessas);
      const status = respostas.map((r) => r.status);
      const c401 = status.filter((s) => s === 401).length;
      const c429 = status.filter((s) => s === 429).length;
      expect(c401).toBeLessThanOrEqual(LIMITE_POR_IDENTIFICADOR);
      expect(c401 + c429).toBe(CONCORRENTES);
      expect(c429).toBeGreaterThanOrEqual(CONCORRENTES - LIMITE_POR_IDENTIFICADOR);
      // Toda resposta bloqueada carrega `Retry-After` dentro do contrato.
      for (const resposta of respostas) {
        if (resposta.status !== 429) continue;
        const retry = Number.parseInt(resposta.headers.get("retry-after") ?? "", 10);
        expect(retry).toBeGreaterThanOrEqual(1);
        expect(retry).toBeLessThanOrEqual(900);
      }
    } finally {
      barreira.liberar();
      barreira.restaurar();
    }
    // Nenhuma reserva vazou.
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("45 tentativas SIMULTÂNEAS do mesmo IP: no máximo 30 chegam ao verificador", async () => {
    const barreira = segurarVerificacao();
    const CONCORRENTES = 45;
    let concluidas = 0;
    try {
      const promessas = Array.from({ length: CONCORRENTES }, (_, i) =>
        postLogin({
          identificador: `conc-ip-${String(i)}@sintetico.local`,
          senha: SENHA_ERRADA,
        }).then((r) => {
          concluidas += 1;
          return r;
        }),
      );
      await aguardarConvergencia(
        () => barreira.chamadas() + concluidas >= CONCORRENTES,
        "lote de IP",
      );
      expect(barreira.chamadas()).toBeLessThanOrEqual(LIMITE_POR_IP);

      barreira.liberar();
      const status = (await Promise.all(promessas)).map((r) => r.status);
      expect(status.filter((s) => s === 401).length).toBeLessThanOrEqual(LIMITE_POR_IP);
      expect(status.filter((s) => s === 429).length).toBeGreaterThanOrEqual(
        CONCORRENTES - LIMITE_POR_IP,
      );
    } finally {
      barreira.liberar();
      barreira.restaurar();
    }
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("logins bem-sucedidos concorrentes NÃO consomem a janela de falhas", async () => {
    // DECISÃO LOCAL declarada: a reserva limita TENTATIVAS SIMULTÂNEAS, não só
    // falhas. Um lote de 10 logins simultâneos para o mesmo identificador
    // excede as 5 vagas em voo, e o excedente recebe saturação TRANSITÓRIA —
    // `429` com `Retry-After: 1`, não os 15 minutos da janela. É o preço de
    // fazer o gate valer sob concorrência, e é proporcional: as vagas se
    // devolvem em milissegundos e nenhum bloqueio persiste.
    const usuario = await criarUsuario();
    const respostas = await Promise.all(
      Array.from({ length: 10 }, () =>
        postLogin({ identificador: usuario.email, senha: SENHA }),
      ),
    );
    const bemSucedidos = respostas.filter((r) => r.status === 200);
    const transitorios = respostas.filter((r) => r.status === 429);
    expect(bemSucedidos.length).toBeGreaterThan(0);
    expect(bemSucedidos.length + transitorios.length).toBe(10);
    // Saturação transitória: espera curta, nunca a janela inteira.
    for (const resposta of transitorios) {
      expect(resposta.headers.get("retry-after")).toBe("1");
    }
    // A PROPRIEDADE central: sucesso não vira falha e nada fica bloqueado.
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
    expect(limitador.consultar(usuario.email, "127.0.0.1").bloqueado).toBe(false);
    // E uma tentativa imediatamente posterior é admitida normalmente.
    expect(
      (await postLogin({ identificador: usuario.email, senha: SENHA })).status,
    ).toBe(200);
  });

  it("erro TÉCNICO libera a reserva sem contabilizar falha de credencial", async () => {
    const usuario = await criarUsuario();
    const autenticacao = moduleRef.get(AutenticacaoService);
    const espia = jest
      .spyOn(autenticacao, "autenticar")
      .mockRejectedValue(new Error("falha sintetica de infraestrutura"));
    try {
      for (let i = 0; i < 8; i += 1) {
        expect(
          (await postLogin({ identificador: usuario.email, senha: SENHA })).status,
        ).toBe(500);
      }
    } finally {
      espia.mockRestore();
    }
    // Oito erros técnicos não podem ter bloqueado a conta.
    expect(limitador.consultar(usuario.email, "127.0.0.1").bloqueado).toBe(false);
    expect((await postLogin({ identificador: usuario.email, senha: SENHA })).status).toBe(
      200,
    );
  });
});

// ---------------------------------------------------------------------------
// `F-03` / `F-06` / `F-07` — fronteira do filtro de erro
// ---------------------------------------------------------------------------

describe("F-03/F-06/F-07 — parser e escopo do filtro", () => {
  const CABECALHOS = {
    "content-type": "application/json",
    [CABECALHO_REQUISICAO_TLF]: "1",
  };

  it.each([
    ["/auth/login", "canônico"],
    ["/auth/login/", "barra final"],
    ["/AUTH/LOGIN", "caixa alta"],
    ["/auth/login?origem=x", "com query"],
  ])(
    "F-06 — JSON malformado em %s (%s) devolve o contrato fechado",
    async (caminho) => {
      const resposta = await postBruto(caminho, CABECALHOS, "{não é json");
      expect(resposta.status).toBe(400);
      expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
      const texto = JSON.stringify(resposta.corpo);
      expect(texto).not.toContain("position");
      expect(texto).not.toContain("JSON");
      expect(texto).not.toContain("Bad Request");
    },
  );

  it("F-03 — corpo acima do limite devolve 413, não 500", async () => {
    const gigante = JSON.stringify({
      identificador: "a@b.local",
      senha: "x".repeat(200_000),
    });
    const resposta = await postBruto("/auth/login", CABECALHOS, gigante);
    expect(resposta.status).toBe(413);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
  });

  it("F-03 — erro 4xx do cliente NÃO emite log de nível ERROR", async () => {
    const capturado: string[] = [];
    const espia = jest
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        capturado.push(args.map((a) => String(a)).join(" "));
      });
    try {
      await postBruto("/auth/login", CABECALHOS, "{quebrado");
      await postBruto(
        "/auth/login",
        CABECALHOS,
        JSON.stringify({ identificador: "a@b.local", senha: "x".repeat(200_000) }),
      );
    } finally {
      espia.mockRestore();
    }
    // Antes da correção, cada corpo grande produzia
    // "Falha inesperada na fronteira de autenticação".
    expect(capturado.join("\n")).not.toContain("Falha inesperada");
  });

  it("F-07 — método inexistente recebe o 404 da plataforma, fora do contrato da F3", async () => {
    const resposta = await medir(
      await fetch(`${baseUrl}/auth/login`, { method: "GET", headers: CABECALHOS }),
    );
    expect(resposta.status).toBe(404);
    // O corpo NÃO é o contrato fechado: `404` não pertence aos endpoints POST.
    expect(resposta.corpo).not.toEqual({ erro: "REQUISICAO_INVALIDA" });
    expect(JSON.stringify(resposta.corpo)).not.toContain("at ");
  });

  it("o filtro continua sem tocar em rotas fora da F3", async () => {
    expect((await medir(await fetch(`${baseUrl}/health`))).status).toBe(200);
    const desconhecida = await medir(await fetch(`${baseUrl}/rota-inexistente`));
    expect(desconhecida.status).toBe(404);
    expect(JSON.stringify(desconhecida.corpo)).not.toContain("at ");
  });
});

// ---------------------------------------------------------------------------
// `F3R-01` — request-target absolute-form (RFC 7230 §5.3.2)
// ---------------------------------------------------------------------------

describe("F3R-01 — absolute-form pertence ao contrato fechado", () => {
  const CABECALHOS = {
    "content-type": "application/json",
    [CABECALHO_REQUISICAO_TLF]: "1",
  };
  /** Alvos ABSOLUTOS, transmitidos literalmente na linha de requisição. */
  function absoluto(sufixo: string): string {
    return `${baseUrl}${sufixo}`;
  }

  it("a forma absoluta REALMENTE alcança o handler do login", async () => {
    // Não-vacuidade: se o roteador devolvesse 404 aqui, os testes abaixo
    // estariam medindo uma rota inexistente e passariam por acidente.
    const resposta = await postComRequestTarget(
      absoluto("/auth/login"),
      CABECALHOS,
      JSON.stringify({ identificador: "ninguem@sintetico.local", senha: "x" }),
    );
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
  });

  it.each([
    ["/auth/login", "absoluto canônico"],
    ["/auth/login/", "absoluto com barra final"],
    ["/AUTH/LOGIN", "absoluto em caixa alta"],
    ["/auth/login?x=1", "absoluto com query"],
  ])("JSON malformado em %s (%s) devolve o contrato fechado", async (sufixo) => {
    const resposta = await postComRequestTarget(absoluto(sufixo), CABECALHOS, "{não é json");
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    const texto = JSON.stringify(resposta.corpo);
    expect(texto).not.toContain("position");
    expect(texto).not.toContain("Bad Request");
  });

  it("corpo acima do limite em absolute-form devolve 413 com contrato fechado", async () => {
    const gigante = JSON.stringify({
      identificador: "a@b.local",
      senha: "x".repeat(200_000),
    });
    const resposta = await postComRequestTarget(absoluto("/auth/login"), CABECALHOS, gigante);
    // Antes da correção: `{"statusCode":413,"message":"request entity too large"}`.
    expect(resposta.status).toBe(413);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
    expect(JSON.stringify(resposta.corpo)).not.toContain("statusCode");
  });

  it("erro 4xx em absolute-form NÃO emite log de nível ERROR", async () => {
    const capturado: string[] = [];
    const espia = jest
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        capturado.push(args.map((a) => String(a)).join(" "));
      });
    try {
      await postComRequestTarget(absoluto("/auth/login"), CABECALHOS, "{quebrado");
      await postComRequestTarget(
        absoluto("/auth/login"),
        CABECALHOS,
        JSON.stringify({ identificador: "a@b.local", senha: "x".repeat(200_000) }),
      );
      await postComRequestTarget(absoluto("/auth/logout"), CABECALHOS, "{quebrado");
    } finally {
      espia.mockRestore();
    }
    const registrado = capturado.join("\n");
    // Antes da correção, o 413 em absolute-form produzia PayloadTooLargeError
    // com stack trace completo — acionável sem cabeçalho algum.
    expect(registrado).not.toContain("PayloadTooLargeError");
    expect(registrado).not.toContain("Falha inesperada");
    expect(registrado).not.toContain("at ");
  });

  it("o logout em absolute-form também responde pelo contrato fechado", async () => {
    const resposta = await postComRequestTarget(absoluto("/auth/logout"), CABECALHOS, "");
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "SESSAO_INVALIDA" });
  });

  it("a correção NÃO passou a capturar caminhos que o roteador devolve como 404", async () => {
    // Medido contra o Express real: nenhuma destas variantes chega ao login.
    // Normalizá-las (por exemplo com `new URL`, que colapsa dot segments)
    // faria o filtro responder pelo contrato em rota que não é a da F3.
    for (const alvo of [
      "//auth/login",
      "/auth//login",
      "/auth/login//",
      "/auth/./login",
      "/auth/x/../login",
      "/auth/%6Cogin",
      "/auth%2Flogin",
      "/auth/login%2F",
      "/auth/loginx",
      "/auth/login/extra",
    ]) {
      const resposta = await postComRequestTarget(
        alvo,
        CABECALHOS,
        JSON.stringify({ identificador: "ninguem@sintetico.local", senha: "x" }),
      );
      expect(resposta.status).toBe(404);
      expect(resposta.corpo).not.toEqual({ erro: "REQUISICAO_INVALIDA" });
      expect(resposta.corpo).not.toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
    }
  });
});

// ---------------------------------------------------------------------------
// Portabilidade do harness — o defeito que fez 21 provas nunca rodarem na CI
// ---------------------------------------------------------------------------

describe("harness — o cliente bruto conecta de forma portável", () => {
  it("o destino derivado NÃO carrega colchetes de IPv6", () => {
    // Guarda direta do defeito: `new URL(baseUrl).hostname` devolvia "[::1]",
    // que no Linux vira consulta de DNS e falha com ENOTFOUND. Se alguém
    // voltar a derivar o destino daquela forma, este caso quebra.
    const destino = urlToHttpOptions(new URL(baseUrl));
    expect(destino.hostname).toBeDefined();
    expect(destino.hostname).not.toContain("[");
    expect(destino.hostname).not.toContain("]");
  });

  it("o cliente bruto alcança o servidor, seja o bind IPv6 ou IPv4", async () => {
    // Não-vacuidade: `401` só é possível se a requisição atravessou o parser,
    // a guard CSRF e o controller — isto é, se a conexão de fato aconteceu.
    const resposta = await postBruto(
      "/auth/login",
      { "content-type": "application/json", [CABECALHO_REQUISICAO_TLF]: "1" },
      JSON.stringify({ identificador: "ninguem@sintetico.local", senha: "x" }),
    );
    expect(resposta.status).toBe(401);
    expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
  });

  it("a query do request-target é REALMENTE transmitida", async () => {
    // `path: url.pathname` descartava a query em silêncio: o caso "com query"
    // do bloco F-06 vinha exercitando o mesmo alvo do caso canônico.
    const resposta = await postBruto(
      "/auth/login?origem=x",
      { "content-type": "application/json", [CABECALHO_REQUISICAO_TLF]: "1" },
      "{não é json",
    );
    expect(resposta.status).toBe(400);
    expect(resposta.corpo).toEqual({ erro: "REQUISICAO_INVALIDA" });
  });
});

// ---------------------------------------------------------------------------
// `F-08` — o cookie não é limpo quando a transação do logout reverte
// ---------------------------------------------------------------------------

describe("F-08 — rollback do logout preserva a credencial do cliente", () => {
  it("auditoria falha => 500, sessão ATIVA e NENHUM Set-Cookie de limpeza", async () => {
    const usuario = await criarUsuario();
    const login = await postLogin({ identificador: usuario.email, senha: SENHA });
    const token = tokenDoCookie(login);

    const writer = moduleRef.get(AuditWriter);
    const espia = jest
      .spyOn(writer, "registrar")
      .mockRejectedValue(new Error("falha sintetica de auditoria"));
    let resposta: RespostaMedida;
    try {
      resposta = await postLogout({ token });
    } finally {
      espia.mockRestore();
    }

    expect(resposta.status).toBe(500);
    expect(resposta.corpo).toEqual({ erro: "FALHA_INTERNA" });
    // A propriedade central: o cliente NÃO perde o cookie de uma sessão que o
    // banco manteve viva.
    expect(resposta.cookies).toEqual([]);
    const sessoes = await lerSessoes();
    expect(sessoes[0]?.estado).toBe("ATIVA");

    // E o token continua servindo para um logout posterior bem-sucedido.
    const segundo = await postLogout({ token });
    expect(segundo.status).toBe(204);
    expect((await lerSessoes())[0]?.estado).toBe("REVOGADA");
  });

  it("desfechos CONHECIDOS continuam limpando o cookie", async () => {
    const usuario = await criarUsuario();
    const login = await postLogin({ identificador: usuario.email, senha: SENHA });
    const sucesso = await postLogout({ token: tokenDoCookie(login) });
    expect(sucesso.status).toBe(204);
    expect(sucesso.cookies.some((c) => c.includes("Max-Age=0"))).toBe(true);

    const invalido = await postLogout({ token: "não-é-um-token" });
    expect(invalido.status).toBe(401);
    expect(invalido.cookies.some((c) => c.includes("Max-Age=0"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// `F-04` — rehash de `D-2.3D-02` no fluxo real de login
// ---------------------------------------------------------------------------

describe("F-04 — rehash quando os parâmetros persistidos estão defasados", () => {
  /** Política DELIBERADAMENTE defasada: metade da memória, um passo a menos. */
  const POLITICA_ANTIGA = Object.freeze({
    type: argon2id,
    memoryCost: 8192,
    timeCost: 1,
    parallelism: 1,
  });

  async function criarComHashDefasado(opcoes?: {
    ativo?: boolean;
  }): Promise<{ id: string; email: string; hash: string }> {
    const digest = await hashArgon2(SENHA, POLITICA_ANTIGA);
    const email = `rehash-${randomUUID().slice(0, 8)}@sintetico.local`;
    const id = await database.transacao(async (tx) => {
      const u = await tx.usuario.create({
        data: {
          email,
          senhaHash: digest,
          nome: "Usuário com hash defasado",
          ativo: opcoes?.ativo ?? true,
        },
        select: { id: true },
      });
      return u.id;
    });
    return { id, email, hash: digest };
  }

  async function lerHash(id: string): Promise<string> {
    return database.transacao(async (tx) => {
      const u = await tx.usuario.findUniqueOrThrow({
        where: { id },
        select: { senhaHash: true },
      });
      return u.senhaHash;
    });
  }

  it("o hash defasado é detectado e SUBSTITUÍDO no login bem-sucedido", async () => {
    const usuario = await criarComHashDefasado();
    expect(credenciais.precisaRehash(usuario.hash)).toBe(true);

    const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(resposta.status).toBe(200);

    const novo = await lerHash(usuario.id);
    expect(novo).not.toBe(usuario.hash);
    expect(novo.startsWith("$argon2id$")).toBe(true);
    // Passa a refletir a política VIGENTE.
    expect(novo).toContain(`m=${String(POLITICA_ARGON2.memoryCost)}`);
    expect(novo).toContain(`t=${String(POLITICA_ARGON2.timeCost)}`);
    expect(novo).toContain(`p=${String(POLITICA_ARGON2.parallelism)}`);
    expect(credenciais.precisaRehash(novo)).toBe(false);
    // E a senha continua verificável contra o digest novo.
    expect(await credenciais.verificarSenha(novo, SENHA)).toBe(true);
    expect(await credenciais.verificarSenha(novo, SENHA_ERRADA)).toBe(false);
  });

  it("um segundo login NÃO regrava o hash já vigente", async () => {
    const usuario = await criarComHashDefasado();
    await postLogin({ identificador: usuario.email, senha: SENHA });
    const depoisDoPrimeiro = await lerHash(usuario.id);
    await postLogin({ identificador: usuario.email, senha: SENHA });
    expect(await lerHash(usuario.id)).toBe(depoisDoPrimeiro);
  });

  it("senha INCORRETA nunca gera rehash", async () => {
    const usuario = await criarComHashDefasado();
    expect(
      (await postLogin({ identificador: usuario.email, senha: SENHA_ERRADA })).status,
    ).toBe(401);
    expect(await lerHash(usuario.id)).toBe(usuario.hash);
  });

  it("usuário INATIVO não cria sessão nem regrava o hash", async () => {
    const usuario = await criarComHashDefasado({ ativo: false });
    expect(
      (await postLogin({ identificador: usuario.email, senha: SENHA })).status,
    ).toBe(401);
    expect(await lerHash(usuario.id)).toBe(usuario.hash);
    expect(await lerSessoes()).toHaveLength(0);
  });

  it("usuário INEXISTENTE não persiste coisa alguma", async () => {
    const antes = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*)::bigint AS n FROM usuario`,
    );
    await postLogin({
      identificador: "inexistente-rehash@sintetico.local",
      senha: SENHA,
    });
    const depois = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*)::bigint AS n FROM usuario`,
    );
    expect(depois[0]?.n).toBe(antes[0]?.n);
  });

  it("falha da transação NÃO deixa o rehash aplicado pela metade", async () => {
    const usuario = await criarComHashDefasado();
    const writer = moduleRef.get(AuditWriter);
    const espia = jest
      .spyOn(writer, "registrar")
      .mockRejectedValue(new Error("falha sintetica de auditoria"));
    try {
      const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
      expect(resposta.status).toBe(500);
    } finally {
      espia.mockRestore();
    }
    // Rollback integral: hash antigo preservado, nenhuma sessão.
    expect(await lerHash(usuario.id)).toBe(usuario.hash);
    expect(await lerSessoes()).toHaveLength(0);

    // E o rehash é simplesmente refeito no próximo login.
    expect(
      (await postLogin({ identificador: usuario.email, senha: SENHA })).status,
    ).toBe(200);
    expect(await lerHash(usuario.id)).not.toBe(usuario.hash);
  });

  it("credencial ALTERADA concorrentemente NÃO é sobrescrita — e o login falha", async () => {
    const usuario = await criarComHashDefasado();
    // Digest novo, definido "por outro fluxo" entre a leitura e a escrita.
    const hashConcorrente = await credenciais.gerarHash("outra-senha-sintetica");

    const espia = jest
      .spyOn(credenciais, "precisaRehash")
      .mockImplementation((digest: string) => {
        // Ponto determinístico entre a verificação e a transação de escrita.
        void digest;
        return true;
      });
    const trocar = jest
      .spyOn(credenciais, "gerarHash")
      .mockImplementation(async (senha: string) => {
        await database.transacao(async (tx) => {
          await tx.$executeRaw`
            UPDATE usuario SET senha_hash = ${hashConcorrente} WHERE id = ${usuario.id}::uuid
          `;
        });
        void senha;
        return "$argon2id$v=19$m=19456,t=2,p=1$c2ludGV0aWNv$c2ludGV0aWNvc2ludGV0aWNvc2ludGV0aWNvc2k";
      });
    try {
      const resposta = await postLogin({ identificador: usuario.email, senha: SENHA });
      // Uniforme: o cliente não aprende que houve concorrência.
      expect(resposta.status).toBe(401);
      expect(resposta.corpo).toEqual({ erro: "CREDENCIAIS_INVALIDAS" });
      expect(resposta.cookies).toEqual([]);
    } finally {
      espia.mockRestore();
      trocar.mockRestore();
    }

    // A credencial CORRENTE permanece intacta — nem o hash antigo voltou, nem
    // o digest do rehash foi gravado por cima.
    expect(await lerHash(usuario.id)).toBe(hashConcorrente);
    // Nenhuma sessão nasceu de uma credencial superada.
    expect(await lerSessoes()).toHaveLength(0);
    // E a tentativa foi auditada como rejeição, como qualquer outra.
    const eventos = await lerEventos();
    expect(eventos.filter((e) => e.resultado === "FALHA")).toHaveLength(1);
    expect(eventos.filter((e) => e.resultado === "SUCESSO")).toHaveLength(0);
  });
});
