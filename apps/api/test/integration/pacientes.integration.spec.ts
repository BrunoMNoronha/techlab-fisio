// TechLab Fisio — integração contra PostgreSQL REAL da fatia mínima de
// pacientes (PAC-A; `docs/17` D-PAC-01..D-PAC-10; matriz TP-01..TP-15).
//
// Runtime exclusivamente `tlf_app`; HTTP real via `app.listen(0)`; limpeza por
// TRUNCATE entre testes (setup-db.ts). Dados 100% sintéticos; CPFs de teste
// com dígitos verificadores válidos.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
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
import { ERRO_PACIENTE } from "../../src/pacientes/pacientes.dto.js";

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

const ID_INEXISTENTE = "0191f5a0-0000-7000-8000-000000000000";
const CPF_A = "52998224725";
const CPF_A_MASCARA = "529.982.247-25";
const CPF_B = "11144477735";
const NOME_SENSIVEL = "Zulmira Sintetica Unica";

const GERENCIAR = "pacientes.administrativo.gerenciar";
const LOCALIZAR = "pacientes.localizar";

function corpoCriar(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nome: "Maria Sintética",
    dataNascimento: "1990-05-17",
    cpf: null,
    telefone: null,
    email: null,
    confirmarPossivelDuplicidade: false,
    ...sobrescrever,
  };
}

function corpoEditar(sobrescrever: Record<string, unknown> = {}): Record<string, unknown> {
  const { confirmarPossivelDuplicidade: _ignorado, ...resto } = corpoCriar(sobrescrever);
  return resto;
}

const BUSCA_VAZIA = { nome: null, cpf: null, dataNascimento: null, ativo: null };

async function provisionarClinica(): Promise<void> {
  await database.transacao((tx) =>
    tx.clinica.create({ data: { nomeCadastral: "Clínica Sintética PAC", fusoHorario: "America/Sao_Paulo" } }),
  );
}

async function criarUsuario(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `pac-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-pac",
        nome: "Usuário Sintético PAC",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

/** Usuário com papel de CÓDIGO dado (o escopo de D-PAC-06 depende do código) e as permissões indicadas. */
async function usuarioComPapel(codigoPapel: string, permissoes: string[]): Promise<{ id: string; cookie: string }> {
  const id = await criarUsuario();
  await database.transacao(async (tx) => {
    const papel =
      (await tx.papel.findUnique({ where: { codigo: codigoPapel }, select: { id: true } })) ??
      (await tx.papel.create({ data: { codigo: codigoPapel, nome: codigoPapel }, select: { id: true } }));
    for (const codigo of permissoes) {
      const permissao =
        (await tx.permissao.findUnique({ where: { codigo }, select: { id: true } })) ??
        (await tx.permissao.create({ data: { codigo, nome: codigo }, select: { id: true } }));
      await tx.papelPermissao.upsert({
        where: { papelId_permissaoId: { papelId: papel.id, permissaoId: permissao.id } },
        create: { papelId: papel.id, permissaoId: permissao.id },
        update: {},
      });
    }
    await tx.usuarioPapel.create({ data: { usuarioId: id, papelId: papel.id } });
  });
  const emitida = await sessoes.emitir({ usuarioId: id });
  return { id, cookie: `${politicaCookie.nome}=${emitida.token}` };
}

const recepcao = () => usuarioComPapel("RECEPCIONISTA", [GERENCIAR, LOCALIZAR]);

interface RespostaHttp {
  status: number;
  body: any;
  texto: string;
  headers: Headers;
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function requisitar(
  metodo: Metodo,
  caminho: string,
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
  const res = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers,
    ...(mutacao ? { body: JSON.stringify(opcoes.corpo ?? {}) } : {}),
  });
  const texto = await res.text();
  let body: any = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* corpo não-JSON preservado */
  }
  return { status: res.status, body, texto, headers: res.headers };
}

async function criarViaApi(cookie: string, sobrescrever: Record<string, unknown> = {}): Promise<any> {
  const res = await requisitar("POST", "/pacientes", { cookie, corpo: corpoCriar(sobrescrever) });
  expect(res.status).toBe(201);
  return res.body;
}

interface LinhaPaciente {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  inativado_em: Date | null;
}

async function lerPacientes(): Promise<LinhaPaciente[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaPaciente[]>`
      SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento, cpf, telefone, email, ativo, inativado_em
        FROM paciente ORDER BY id`,
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
}

async function eventos(): Promise<LinhaEvento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaEvento[]>`
      SELECT acao, ator_usuario_id, alvo_tipo, alvo_id, resultado::text AS resultado, justificativa, contexto
        FROM evento_auditoria ORDER BY ocorrido_em`,
  );
}

function semValores(evento: LinhaEvento): boolean {
  const serializado = JSON.stringify(evento);
  return (
    (evento.contexto === null || JSON.stringify(evento.contexto) === "{}") &&
    evento.justificativa === null &&
    !serializado.includes(CPF_A) &&
    !serializado.includes(CPF_B) &&
    !serializado.includes("Sintética")
  );
}

function dataLocalSaoPaulo(deslocamentoDias: number): string {
  const agora = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

async function erroSql(sql: (tx: any) => Promise<unknown>): Promise<string> {
  let erro: unknown;
  try {
    await database.transacao(sql);
  } catch (e) {
    erro = e;
  }
  expect(erro).toBeDefined();
  return JSON.stringify(erro, Object.getOwnPropertyNames(erro as object));
}

/** Agendamento sintético mínimo ligando paciente ao profissional do usuário (critério "relacionado"). */
async function relacionarPorAgendamento(pacienteId: string, usuarioProfissionalId: string): Promise<void> {
  await database.transacao(async (tx) => {
    const clinica = await tx.clinica.findFirstOrThrow({ select: { id: true } });
    const profissional = await tx.profissional.create({
      data: { nome: "Profissional Sintético", usuarioId: usuarioProfissionalId, ativo: true },
      select: { id: true },
    });
    const servico = await tx.servico.create({
      data: { clinicaId: clinica.id, nome: `Serviço ${randomUUID().slice(0, 6)}`, duracaoMin: 50, precoReferencia: "10.00", ativo: true },
      select: { id: true },
    });
    await tx.agendamento.create({
      data: {
        pacienteId,
        profissionalId: profissional.id,
        servicoId: servico.id,
        inicio: new Date("2030-01-07T12:00:00Z"),
        fim: new Date("2030-01-07T13:00:00Z"),
        estado: "AGENDADO",
        modalidade: "AVULSO",
        criadoPorUsuarioId: usuarioProfissionalId,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Segurança (TP-12, TP-13)
// ---------------------------------------------------------------------------

describe("PAC-A — autenticação, autorização e CSRF (D-PAC-06)", () => {
  const ROTAS: Array<[Metodo, string, unknown]> = [
    ["POST", "/pacientes/busca", { ...BUSCA_VAZIA, nome: "maria" }],
    ["GET", `/pacientes/${ID_INEXISTENTE}`, undefined],
    ["POST", "/pacientes", corpoCriar()],
    ["PUT", `/pacientes/${ID_INEXISTENTE}`, corpoEditar()],
    ["PATCH", `/pacientes/${ID_INEXISTENTE}/situacao`, { ativo: false }],
  ];

  it.each(ROTAS)("%s %s sem sessão -> 401 SESSAO_INVALIDA", async (metodo, caminho, corpo) => {
    await provisionarClinica();
    const res = await requisitar(metodo, caminho, { corpo });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
  });

  it("TP-13: Fisioterapeuta (só pacientes.localizar) não cria, edita nem altera situação -> 403 sem evento", async () => {
    await provisionarClinica();
    const fisio = await usuarioComPapel("FISIOTERAPEUTA", [LOCALIZAR]);
    for (const [metodo, caminho, corpo] of ROTAS.slice(2)) {
      const res = await requisitar(metodo, caminho, { cookie: fisio.cookie, corpo });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    }
    expect(await lerPacientes()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it("TP-12: sem pacientes.localizar -> 403 na busca e no detalhe", async () => {
    await provisionarClinica();
    const sem = await usuarioComPapel("RECEPCIONISTA", [GERENCIAR]);
    for (const [metodo, caminho, corpo] of ROTAS.slice(0, 2)) {
      const res = await requisitar(metodo, caminho, { cookie: sem.cookie, corpo });
      expect(res.status).toBe(403);
    }
    expect(await eventos()).toHaveLength(0);
  });

  it("TP-12: Gestor (só GESTOR, com pacientes.localizar) -> 403 ACESSO_NEGADO na busca e no detalhe", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const criado = await criarViaApi(r.cookie);
    const gestor = await usuarioComPapel("GESTOR", [LOCALIZAR]);
    const busca = await requisitar("POST", "/pacientes/busca", { cookie: gestor.cookie, corpo: { ...BUSCA_VAZIA, nome: "maria" } });
    expect(busca.status).toBe(403);
    expect(busca.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    const detalhe = await requisitar("GET", `/pacientes/${criado.id}`, { cookie: gestor.cookie });
    expect(detalhe.status).toBe(403);
    expect(await eventos()).toHaveLength(0);
  });

  it("TP-13: mutações e busca sem CSRF -> 403 REQUISICAO_NAO_AUTORIZADA; GET sem CSRF funciona com no-store", async () => {
    await provisionarClinica();
    const r = await recepcao();
    for (const [metodo, caminho, corpo] of ROTAS.filter(([m]) => m !== "GET")) {
      const res = await requisitar(metodo, caminho, { cookie: r.cookie, corpo, csrf: false });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    }
    const criado = await criarViaApi(r.cookie);
    const get = await requisitar("GET", `/pacientes/${criado.id}`, { cookie: r.cookie });
    expect(get.status).toBe(200);
    expect(get.headers.get("cache-control")).toBe("no-store");
    const busca = await requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo: { ...BUSCA_VAZIA, nome: "maria" } });
    expect(busca.headers.get("cache-control")).toBe("no-store");
  });

  it("não existe DELETE nem GET de coleção", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const criado = await criarViaApi(r.cookie);
    expect((await requisitar("DELETE", `/pacientes/${criado.id}`, { cookie: r.cookie })).status).toBe(404);
    expect((await requisitar("GET", "/pacientes", { cookie: r.cookie })).status).toBe(404);
    expect(await lerPacientes()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Criação e duplicidade (TP-01..TP-07)
// ---------------------------------------------------------------------------

describe("PAC-A — criação e duplicidade (D-PAC-01, D-PAC-03, D-PAC-07)", () => {
  it("TP-01: sem CPF -> 201 exato, ativo, nenhum evento", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const res = await requisitar("POST", "/pacientes", {
      cookie: r.cookie,
      corpo: corpoCriar({ nome: "  Maria   Sintética ", telefone: " (11) 90000-0000 ", email: " m@sintetico.local " }),
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ["ativo", "cpf", "dataNascimento", "email", "id", "inativadoEm", "nome", "telefone"].sort(),
    );
    expect(res.body).toMatchObject({
      nome: "Maria Sintética",
      dataNascimento: "1990-05-17",
      cpf: null,
      telefone: "(11) 90000-0000",
      email: "m@sintetico.local",
      ativo: true,
      inativadoEm: null,
    });
    expect(await eventos()).toHaveLength(0);
  });

  it("TP-02: CPF mascarado -> persistido com 11 dígitos e UM paciente.cadastro.alterado sem valores", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const criado = await criarViaApi(r.cookie, { cpf: CPF_A_MASCARA });
    expect(criado.cpf).toBe(CPF_A);
    expect((await lerPacientes())[0]?.cpf).toBe(CPF_A);
    const evs = await eventos();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      acao: "paciente.cadastro.alterado",
      ator_usuario_id: r.id,
      alvo_tipo: "paciente",
      alvo_id: criado.id,
      resultado: "SUCESSO",
    });
    expect(semValores(evs[0] as LinhaEvento)).toBe(true);
  });

  it.each([
    ["DV inválido", { cpf: "529.982.247-26" }],
    ["CPF repetido", { cpf: "111.111.111-11" }],
    ["CPF com 10 dígitos", { cpf: "5299822472" }],
    ["data amanhã (fuso da clínica)", { dataNascimento: dataLocalSaoPaulo(2) }],
    ["data < 1900", { dataNascimento: "1899-12-31" }],
    ["nome vazio", { nome: "   " }],
    ["chave extra", { ativo: true }],
    ["confirmação coerida", { confirmarPossivelDuplicidade: "false" }],
  ])("TP-03: %s -> 400 sem persistência e sem ecoar valor", async (_rotulo, sobrescrever) => {
    await provisionarClinica();
    const r = await recepcao();
    const res = await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar(sobrescrever) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(await lerPacientes()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it("data de nascimento igual a hoje (fuso da clínica) é aceita", async () => {
    await provisionarClinica();
    const r = await recepcao();
    await criarViaApi(r.cookie, { dataNascimento: dataLocalSaoPaulo(0) });
  });

  it("sem clínica provisionada -> 404 CLINICA_NAO_CONFIGURADA, nada criado", async () => {
    const r = await recepcao();
    const res = await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
    expect(await lerPacientes()).toHaveLength(0);
  });

  it("TP-04: CPF de paciente INATIVO -> 409 CPF_JA_CADASTRADO sem dados; a busca pelo CPF localiza o inativo", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const existente = await criarViaApi(r.cookie, { cpf: CPF_A, nome: NOME_SENSIVEL });
    await requisitar("PATCH", `/pacientes/${existente.id}/situacao`, { cookie: r.cookie, corpo: { ativo: false } });
    const eventosAntes = (await eventos()).length;

    const res = await requisitar("POST", "/pacientes", {
      cookie: r.cookie,
      corpo: corpoCriar({ cpf: CPF_A_MASCARA, nome: "Outra Pessoa" }),
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_PACIENTE.CPF_JA_CADASTRADO });
    expect(res.texto).not.toContain(existente.id);
    expect(res.texto).not.toContain(NOME_SENSIVEL);
    expect(await lerPacientes()).toHaveLength(1);
    expect(await eventos()).toHaveLength(eventosAntes);

    const busca = await requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo: { ...BUSCA_VAZIA, cpf: CPF_A_MASCARA } });
    expect(busca.status).toBe(200);
    expect(busca.body).toEqual({
      pacientes: [{ id: existente.id, nome: NOME_SENSIVEL, dataNascimento: "1990-05-17", cpf: CPF_A, ativo: false }],
      truncado: false,
    });
  });

  it("TP-05: criações concorrentes com o mesmo CPF -> exatamente um 201 e um 409", async () => {
    await provisionarClinica();
    const a = await recepcao();
    const b = await recepcao();
    const respostas = await Promise.all([
      requisitar("POST", "/pacientes", { cookie: a.cookie, corpo: corpoCriar({ cpf: CPF_B, nome: "Pessoa Um" }) }),
      requisitar("POST", "/pacientes", { cookie: b.cookie, corpo: corpoCriar({ cpf: CPF_B, nome: "Pessoa Dois", dataNascimento: "1980-01-01" }) }),
    ]);
    expect(respostas.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(respostas.find((x) => x.status === 409)?.body).toEqual({ erro: ERRO_PACIENTE.CPF_JA_CADASTRADO });
    expect(await lerPacientes()).toHaveLength(1);
    expect((await eventos()).filter((e) => e.acao === "paciente.cadastro.alterado")).toHaveLength(1);
  });

  it("TP-06: mesmo nome (caixa/acentos/espaços) e mesma data -> 409 POSSIVEL_DUPLICIDADE; confirmado -> 201", async () => {
    await provisionarClinica();
    const r = await recepcao();
    await criarViaApi(r.cookie, { nome: "João da Conceição" });
    const sem = await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar({ nome: "  JOAO  da conceicao " }) });
    expect(sem.status).toBe(409);
    expect(sem.body).toEqual({ erro: ERRO_PACIENTE.POSSIVEL_DUPLICIDADE });
    expect(await lerPacientes()).toHaveLength(1);

    const com = await requisitar("POST", "/pacientes", {
      cookie: r.cookie,
      corpo: corpoCriar({ nome: "  JOAO  da conceicao ", confirmarPossivelDuplicidade: true }),
    });
    expect(com.status).toBe(201);
    expect(await lerPacientes()).toHaveLength(2);
  });

  it("TP-06: coincidência forte também considera paciente inativo", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const p = await criarViaApi(r.cookie);
    await requisitar("PATCH", `/pacientes/${p.id}/situacao`, { cookie: r.cookie, corpo: { ativo: false } });
    const res = await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar() });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_PACIENTE.POSSIVEL_DUPLICIDADE });
  });

  it("TP-07: mesmo nome com data diferente -> 201 sem 409", async () => {
    await provisionarClinica();
    const r = await recepcao();
    await criarViaApi(r.cookie);
    await criarViaApi(r.cookie, { dataNascimento: "1991-05-17" });
    expect(await lerPacientes()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Edição e situação (TP-08, TP-09)
// ---------------------------------------------------------------------------

describe("PAC-A — edição e situação (D-PAC-05, D-PAC-07, D-PAC-08)", () => {
  it("TP-08: telefone sem evento; CPF incluído, alterado e removido com evento cada; idêntico no-op", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const p = await criarViaApi(r.cookie);
    const put = (sobrescrever: Record<string, unknown>) =>
      requisitar("PUT", `/pacientes/${p.id}`, { cookie: r.cookie, corpo: corpoEditar(sobrescrever) });

    const telefone = await put({ telefone: "1234" });
    expect(telefone.status).toBe(200);
    expect(telefone.body.telefone).toBe("1234");
    expect(await eventos()).toHaveLength(0);

    expect((await put({ telefone: "1234", cpf: CPF_A })).body.cpf).toBe(CPF_A);
    expect(await eventos()).toHaveLength(1);
    expect((await put({ telefone: "1234", cpf: CPF_B_MASCARA() })).body.cpf).toBe(CPF_B);
    expect(await eventos()).toHaveLength(2);
    expect((await put({ telefone: "1234", cpf: null })).body.cpf).toBeNull();
    const evs = await eventos();
    expect(evs).toHaveLength(3);
    expect(evs.every((e) => e.acao === "paciente.cadastro.alterado" && e.alvo_id === p.id && semValores(e))).toBe(true);

    const noop = await put({ telefone: " 1234 ", cpf: "" });
    expect(noop.status).toBe(200);
    expect(await eventos()).toHaveLength(3);
  });

  it("edição para CPF de outro paciente -> 409 sem alteração; PUT em inexistente -> 404; id malformado -> 400", async () => {
    await provisionarClinica();
    const r = await recepcao();
    await criarViaApi(r.cookie, { cpf: CPF_A });
    const outro = await criarViaApi(r.cookie, { nome: "Outro Nome" });
    const antes = await lerPacientes();
    const eventosAntes = (await eventos()).length;

    const conflito = await requisitar("PUT", `/pacientes/${outro.id}`, {
      cookie: r.cookie,
      corpo: corpoEditar({ nome: "Outro Nome", cpf: CPF_A }),
    });
    expect(conflito.status).toBe(409);
    expect(conflito.body).toEqual({ erro: ERRO_PACIENTE.CPF_JA_CADASTRADO });
    expect(await lerPacientes()).toEqual(antes);
    expect(await eventos()).toHaveLength(eventosAntes);

    expect((await requisitar("PUT", `/pacientes/${ID_INEXISTENTE}`, { cookie: r.cookie, corpo: corpoEditar() })).body).toEqual({
      erro: ERRO_PACIENTE.PACIENTE_NAO_ENCONTRADO,
    });
    expect((await requisitar("PUT", "/pacientes/nao-uuid", { cookie: r.cookie, corpo: corpoEditar() })).status).toBe(400);
  });

  it("edição NÃO verifica coincidência forte e é permitida em paciente inativo sem mudar a situação", async () => {
    await provisionarClinica();
    const r = await recepcao();
    await criarViaApi(r.cookie, { nome: "Nome Igual" });
    const b = await criarViaApi(r.cookie, { nome: "Nome Diferente", dataNascimento: "1970-01-01" });
    await requisitar("PATCH", `/pacientes/${b.id}/situacao`, { cookie: r.cookie, corpo: { ativo: false } });
    const res = await requisitar("PUT", `/pacientes/${b.id}`, { cookie: r.cookie, corpo: corpoEditar({ nome: "Nome Igual" }) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nome: "Nome Igual", ativo: false });
  });

  it("TP-09: inativa e reativa com evento cada; repetição idempotente sem evento; inativadoEm coerente", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const p = await criarViaApi(r.cookie);
    const patch = (ativo: boolean) =>
      requisitar("PATCH", `/pacientes/${p.id}/situacao`, { cookie: r.cookie, corpo: { ativo } });

    const inativo = await patch(false);
    expect(inativo.status).toBe(200);
    expect(inativo.body.ativo).toBe(false);
    expect(typeof inativo.body.inativadoEm).toBe("string");
    expect((await patch(false)).body.inativadoEm).toBe(inativo.body.inativadoEm);
    expect((await patch(true)).body).toMatchObject({ ativo: true, inativadoEm: null });
    await patch(true);

    const evs = await eventos();
    expect(evs.map((e) => e.acao)).toEqual(["paciente.situacao.alterada", "paciente.situacao.alterada"]);
    expect(evs.every((e) => e.ator_usuario_id === r.id && e.alvo_tipo === "paciente" && semValores(e))).toBe(true);
  });

  it("inativar não altera agendamento existente (PAC-006)", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const p = await criarViaApi(r.cookie);
    const fisio = await usuarioComPapel("FISIOTERAPEUTA", [LOCALIZAR]);
    await relacionarPorAgendamento(p.id, fisio.id);
    await requisitar("PATCH", `/pacientes/${p.id}/situacao`, { cookie: r.cookie, corpo: { ativo: false } });
    const ag = await database.transacao((tx) => tx.agendamento.findMany({ select: { estado: true, pacienteId: true } }));
    expect(ag).toEqual([{ estado: "AGENDADO", pacienteId: p.id }]);
  });

  it.each([
    ["POST", () => "/pacientes", () => corpoCriar({ cpf: CPF_A })],
    ["PUT", (id: string) => `/pacientes/${id}`, () => corpoEditar({ cpf: CPF_B })],
    ["PATCH", (id: string) => `/pacientes/${id}/situacao`, () => ({ ativo: false })],
  ] as Array<[Metodo, (id: string) => string, () => unknown]>)(
    "%s com falha na auditoria -> 500 FALHA_INTERNA e rollback conjunto",
    async (metodo, caminho, c) => {
      await provisionarClinica();
      const r = await recepcao();
      const p = await criarViaApi(r.cookie, { nome: "Base Rollback", dataNascimento: "1970-02-02" });
      const antes = await lerPacientes();
      const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
      try {
        const res = await requisitar(metodo, caminho(p.id), { cookie: r.cookie, corpo: c() });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
      } finally {
        espia.mockRestore();
      }
      expect(await lerPacientes()).toEqual(antes);
      expect(await eventos()).toHaveLength(0);
    },
  );
});

function CPF_B_MASCARA(): string {
  return "111.444.777-35";
}

// ---------------------------------------------------------------------------
// Localização e escopo (TP-10..TP-12)
// ---------------------------------------------------------------------------

describe("PAC-A — localização e escopo (D-PAC-04, D-PAC-06)", () => {
  it("TP-10: nome com 2 caracteres ou sem filtro -> 400", async () => {
    await provisionarClinica();
    const r = await recepcao();
    for (const corpo of [{ ...BUSCA_VAZIA, nome: "ma" }, BUSCA_VAZIA, { ...BUSCA_VAZIA, ativo: true }]) {
      const res = await requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo });
      expect(res.status).toBe(400);
    }
  });

  it("busca por trecho do nome (sem caixa), data e situação; resumo sem telefone/e-mail; não audita", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const a = await criarViaApi(r.cookie, { nome: "Ana Beatriz", telefone: "999", email: "a@b.co" });
    await criarViaApi(r.cookie, { nome: "Bruna Lima", dataNascimento: "1985-01-01" });
    const c = await criarViaApi(r.cookie, { nome: "Beatriz Souza", dataNascimento: "1985-01-01" });
    await requisitar("PATCH", `/pacientes/${c.id}/situacao`, { cookie: r.cookie, corpo: { ativo: false } });
    const eventosAntes = (await eventos()).length;
    const buscar = (corpo: Record<string, unknown>) =>
      requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo: { ...BUSCA_VAZIA, ...corpo } });

    const porNome = await buscar({ nome: "BEAT" });
    expect(porNome.status).toBe(200);
    expect(porNome.body.pacientes.map((p: any) => p.nome)).toEqual(["Ana Beatriz", "Beatriz Souza"]);
    expect(Object.keys(porNome.body.pacientes[0]).sort()).toEqual(["ativo", "cpf", "dataNascimento", "id", "nome"]);
    expect(porNome.texto).not.toContain("a@b.co");

    expect((await buscar({ nome: "beat", ativo: true })).body.pacientes.map((p: any) => p.id)).toEqual([a.id]);
    expect((await buscar({ dataNascimento: "1985-01-01" })).body.pacientes).toHaveLength(2);
    expect((await buscar({ nome: "bea", dataNascimento: "1985-01-01" })).body.pacientes.map((p: any) => p.id)).toEqual([c.id]);
    // curingas do cliente não são interpretados
    expect((await buscar({ nome: "%%%" })).body.pacientes).toHaveLength(0);
    expect(await eventos()).toHaveLength(eventosAntes);
  });

  it("TP-11: mais de 20 resultados -> 20 e truncado = true", async () => {
    await provisionarClinica();
    await database.transacao(async (tx) => {
      for (let i = 0; i < 23; i++) {
        await tx.paciente.create({
          data: { nome: `Paciente Lote ${String(i).padStart(2, "0")}`, dataNascimento: new Date("2000-01-01T00:00:00Z"), ativo: true },
        });
      }
    });
    const r = await recepcao();
    const res = await requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo: { ...BUSCA_VAZIA, nome: "lote" } });
    expect(res.body.pacientes).toHaveLength(20);
    expect(res.body.truncado).toBe(true);
    expect(res.body.pacientes[0].nome).toBe("Paciente Lote 00");
  });

  it("TP-12: Fisioterapeuta vê só pacientes com agendamento seu; detalhe fora do escopo -> 404", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const meu = await criarViaApi(r.cookie, { nome: "Paciente Meu" });
    const alheio = await criarViaApi(r.cookie, { nome: "Paciente Alheio" });
    const fisio = await usuarioComPapel("FISIOTERAPEUTA", [LOCALIZAR]);

    const antes = await requisitar("POST", "/pacientes/busca", { cookie: fisio.cookie, corpo: { ...BUSCA_VAZIA, nome: "paciente" } });
    expect(antes.body).toEqual({ pacientes: [], truncado: false });
    expect((await requisitar("GET", `/pacientes/${meu.id}`, { cookie: fisio.cookie })).status).toBe(404);

    await relacionarPorAgendamento(meu.id, fisio.id);
    const depois = await requisitar("POST", "/pacientes/busca", { cookie: fisio.cookie, corpo: { ...BUSCA_VAZIA, nome: "paciente" } });
    expect(depois.body.pacientes.map((p: any) => p.id)).toEqual([meu.id]);
    expect((await requisitar("GET", `/pacientes/${meu.id}`, { cookie: fisio.cookie })).status).toBe(200);
    const fora = await requisitar("GET", `/pacientes/${alheio.id}`, { cookie: fisio.cookie });
    expect(fora.status).toBe(404);
    expect(fora.body).toEqual({ erro: ERRO_PACIENTE.PACIENTE_NAO_ENCONTRADO });
  });

  it("detalhe: encontrado (8 campos), inexistente (404) e malformado (400)", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const p = await criarViaApi(r.cookie, { cpf: CPF_A, email: "x@y.co" });
    const ok = await requisitar("GET", `/pacientes/${p.id}`, { cookie: r.cookie });
    expect(ok.body).toEqual(p);
    expect((await requisitar("GET", `/pacientes/${ID_INEXISTENTE}`, { cookie: r.cookie })).body).toEqual({
      erro: ERRO_PACIENTE.PACIENTE_NAO_ENCONTRADO,
    });
    expect((await requisitar("GET", "/pacientes/123", { cookie: r.cookie })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Invariantes físicas e dados pessoais em logs (TP-14, TP-15)
// ---------------------------------------------------------------------------

describe("PAC-A — invariantes físicas e ausência de dados pessoais em logs (D-PAC-09, Base §10)", () => {
  it("TP-15: o banco rejeita situação incoerente (ck_paciente_situacao) e CPF não normalizado", async () => {
    const inserir = (ativo: boolean, inativado: boolean, cpf: string | null) =>
      erroSql((tx) =>
        tx.$executeRaw`
          INSERT INTO paciente (id, nome, ativo, inativado_em, cpf)
          VALUES (gen_random_uuid(), 'X', ${ativo}, CASE WHEN ${inativado} THEN now() ELSE NULL END, ${cpf}::text)`,
      );
    expect(await inserir(false, false, null)).toContain("ck_paciente_situacao");
    expect(await inserir(true, true, null)).toContain("ck_paciente_situacao");
    expect(await inserir(true, false, CPF_A_MASCARA)).toContain("ck_paciente_cpf_formato");
  });

  it("TP-14: nenhuma chamada de log recebe nome, CPF ou contato em rejeições e falhas", async () => {
    await provisionarClinica();
    const r = await recepcao();
    const registros: string[] = [];
    const espias = (["log", "error", "warn", "debug", "verbose"] as const).map((nivel) =>
      jest.spyOn(Logger.prototype, nivel).mockImplementation((...args: unknown[]) => {
        registros.push(JSON.stringify(args));
      }),
    );
    const auditoria = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar({ nome: NOME_SENSIVEL, cpf: CPF_A }) });
      await criarViaApi(r.cookie, { nome: NOME_SENSIVEL, cpf: CPF_A, telefone: "5511912345678" });
      await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar({ nome: NOME_SENSIVEL, cpf: CPF_A }) });
      await requisitar("POST", "/pacientes", { cookie: r.cookie, corpo: corpoCriar({ nome: NOME_SENSIVEL, cpf: "529.982.247-26" }) });
      await requisitar("POST", "/pacientes/busca", { cookie: r.cookie, corpo: { ...BUSCA_VAZIA, cpf: CPF_A } });
    } finally {
      auditoria.mockRestore();
      for (const espia of espias) espia.mockRestore();
    }
    const tudo = registros.join("\n");
    expect(tudo).not.toContain(CPF_A);
    expect(tudo).not.toContain("529.982.247");
    expect(tudo).not.toContain(NOME_SENSIVEL);
    expect(tudo).not.toContain("5511912345678");
  });
});
