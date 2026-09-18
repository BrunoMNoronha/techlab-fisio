// TechLab Fisio — integração contra PostgreSQL REAL das fatias AGD-A/AGD-B
// (`docs/15` §6).
//
// Runtime exclusivamente `tlf_app`; HTTP real via `app.listen(0)`; limpeza por
// TRUNCATE entre testes (setup-db.ts). Dados 100% sintéticos (TLF-BASE §10):
// nenhum nome real, nenhum CPF, nenhum contato, nenhum conteúdo clínico.
//
// TEMPO — a fatia recusa lançamento retroativo (D-AGD-03), então nenhuma data
// fixa serve: um instante literal envelhece e a suíte passaria a falhar sozinha.
// Todos os cenários são ancorados na PRÓXIMA segunda-feira local da clínica, a
// pelo menos três dias do agora, e a grade/disponibilidade são montadas para
// esse dia da semana. A conversão hora-de-parede -> instante usa `Intl`, a
// mesma base de D-CFG-60.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { ERRO_AGENDAMENTO } from "../../src/agenda/agenda.dto.js";
import { ERRO_AGENDA } from "../../src/agenda/verificador-horario-funcionamento.js";
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
// Tempo — hora de parede da clínica -> instante
// ---------------------------------------------------------------------------

const FUSO = "America/Sao_Paulo";
const AGENDAMENTOS = "/agendamentos";
const ID_INEXISTENTE = "0191f5a0-0000-7000-8000-000000000000";

function partesLocais(instante: Date): { data: string; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const parte of fmt.formatToParts(instante)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  const ano = p["year"] as number;
  const mes = p["month"] as number;
  const dia = p["day"] as number;
  return {
    data: `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    diaSemana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(),
  };
}

/** Deslocamento do fuso, em ms, no instante informado. */
function deslocamento(instante: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const parte of fmt.formatToParts(instante)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  return (
    Date.UTC(
      p["year"] as number,
      (p["month"] as number) - 1,
      p["day"] as number,
      p["hour"] as number,
      p["minute"] as number,
      p["second"] as number,
    ) - instante.getTime()
  );
}

/** Instante correspondente a `dataLocal` + `HH:MM` na hora de parede da clínica. */
function instante(dataLocal: string, hora: string): Date {
  const ingenuo = new Date(`${dataLocal}T${hora}:00.000Z`);
  const aproximado = new Date(ingenuo.getTime() - deslocamento(ingenuo));
  // Segunda passada: fecha o caso de transição de horário de verão.
  return new Date(ingenuo.getTime() - deslocamento(aproximado));
}

function iso(dataLocal: string, hora: string): string {
  return instante(dataLocal, hora).toISOString();
}

/** DIA_SEMANA da grade montada pelos testes: segunda-feira. */
const DIA_GRADE = 1;

/** Próxima segunda-feira local, a pelo menos três dias do agora. */
function proximaSegunda(): string {
  const agora = Date.now();
  for (let d = 3; d < 30; d += 1) {
    const candidato = new Date(agora + d * 86_400_000);
    const local = partesLocais(candidato);
    if (local.diaSemana === DIA_GRADE) return local.data;
  }
  throw new Error("Nenhuma segunda-feira encontrada em 30 dias — impossível.");
}

/** Terça-feira seguinte à segunda de referência — dia SEM janela na grade. */
function tercaSeguinte(segunda: string): string {
  return partesLocais(new Date(instante(segunda, "12:00").getTime() + 86_400_000)).data;
}

const SEGUNDA = proximaSegunda();
const TERCA = tercaSeguinte(SEGUNDA);

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

interface RespostaHttp {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
}

type Metodo = "GET" | "POST";

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
    ...(mutacao
      ? { body: typeof opcoes.corpo === "string" ? opcoes.corpo : JSON.stringify(opcoes.corpo ?? {}) }
      : {}),
  });
  const texto = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = texto;
  try {
    body = JSON.parse(texto);
  } catch {
    /* corpo não-JSON preservado como texto */
  }
  return { status: res.status, body, headers: res.headers };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Cenario {
  clinicaId: string;
  pacienteId: string;
  paciente2Id: string;
  profissionalId: string;
  profissional2Id: string;
  servicoId: string;
  motivoId: string;
  admin: { id: string; cookie: string };
}

async function criarUsuario(prefixo: string): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `${prefixo}-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-agd",
        nome: "Usuário Sintético AGD",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

/** Concede `codigo` ao usuário por um papel de `codigoPapel` (criado se faltar). */
async function darPermissaoPorPapel(
  usuarioId: string,
  codigoPapel: string,
  codigoPermissao: string,
): Promise<void> {
  await database.transacao(async (tx) => {
    const papelExistente = await tx.papel.findUnique({
      where: { codigo: codigoPapel },
      select: { id: true },
    });
    const papel =
      papelExistente ??
      (await tx.papel.create({ data: { codigo: codigoPapel, nome: codigoPapel }, select: { id: true } }));
    const permissaoExistente = await tx.permissao.findUnique({
      where: { codigo: codigoPermissao },
      select: { id: true },
    });
    const permissao =
      permissaoExistente ??
      (await tx.permissao.create({
        data: { codigo: codigoPermissao, nome: codigoPermissao },
        select: { id: true },
      }));
    const vinculo = await tx.papelPermissao.findUnique({
      where: { papelId_permissaoId: { papelId: papel.id, permissaoId: permissao.id } },
      select: { papelId: true },
    });
    if (vinculo === null) {
      await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
    }
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
  });
}

/** Papel SEM permissão alguma — prova que o papel por si não concede escopo. */
async function darPapelSemPermissao(usuarioId: string, codigoPapel: string): Promise<void> {
  await database.transacao(async (tx) => {
    const existente = await tx.papel.findUnique({ where: { codigo: codigoPapel }, select: { id: true } });
    const papel =
      existente ??
      (await tx.papel.create({ data: { codigo: codigoPapel, nome: codigoPapel }, select: { id: true } }));
    await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });
  });
}

async function cookieDe(usuarioId: string): Promise<string> {
  const emitida = await sessoes.emitir({ usuarioId });
  return `${politicaCookie.nome}=${emitida.token}`;
}

async function ator(codigoPapel: string, permissao = "agenda.gerenciar"): Promise<{ id: string; cookie: string }> {
  const id = await criarUsuario(codigoPapel.toLowerCase());
  await darPermissaoPorPapel(id, codigoPapel, permissao);
  return { id, cookie: await cookieDe(id) };
}

/**
 * Cenário base: clínica com grade de segunda 08:00–12:00 e 14:00–18:00; dois
 * profissionais ativos com disponibilidade de segunda 08:00–12:00; dois
 * pacientes ativos; um serviço ativo habilitado aos dois; um motivo ativo.
 */
async function montarCenario(): Promise<Cenario> {
  const dados = await database.transacao(async (tx) => {
    const clinica = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética AGD", fusoHorario: FUSO },
      select: { id: true },
    });
    for (const [horaInicio, horaFim] of [
      ["08:00", "12:00"],
      ["14:00", "18:00"],
    ]) {
      await tx.$executeRaw`
        INSERT INTO horario_funcionamento (id, clinica_id, dia_semana, hora_inicio, hora_fim)
        VALUES (${randomUUID()}::uuid, ${clinica.id}::uuid, ${DIA_GRADE}::smallint,
                ${horaInicio}::time, ${horaFim}::time)`;
    }

    const servico = await tx.servico.create({
      data: {
        clinicaId: clinica.id,
        nome: "Fisioterapia Sintética",
        duracaoMin: 50,
        precoReferencia: "100.00",
        ativo: true,
      },
      select: { id: true },
    });
    const motivo = await tx.motivoCancelamento.create({
      data: { clinicaId: clinica.id, descricao: "Paciente desistiu", ativo: true },
      select: { id: true },
    });

    const profissionais: string[] = [];
    for (const nome of ["Profissional Sintético Um", "Profissional Sintético Dois"]) {
      const p = await tx.profissional.create({ data: { nome, ativo: true }, select: { id: true } });
      await tx.profissionalServico.create({ data: { profissionalId: p.id, servicoId: servico.id } });
      await tx.disponibilidadeProfissional.create({
        data: {
          profissionalId: p.id,
          diaSemana: DIA_GRADE,
          horaInicio: new Date("1970-01-01T08:00:00Z"),
          horaFim: new Date("1970-01-01T12:00:00Z"),
          vigenciaInicio: new Date("2020-01-01T00:00:00Z"),
          vigenciaFim: null,
        },
      });
      profissionais.push(p.id);
    }

    const pacientes: string[] = [];
    for (const nome of ["Paciente Sintético Um", "Paciente Sintético Dois"]) {
      const p = await tx.paciente.create({ data: { nome, ativo: true }, select: { id: true } });
      pacientes.push(p.id);
    }

    return {
      clinicaId: clinica.id,
      servicoId: servico.id,
      motivoId: motivo.id,
      profissionalId: profissionais[0] as string,
      profissional2Id: profissionais[1] as string,
      pacienteId: pacientes[0] as string,
      paciente2Id: pacientes[1] as string,
    };
  });

  return { ...dados, admin: await ator("ADMINISTRADOR") };
}

function corpoCriacao(
  c: Cenario,
  opcoes: { inicio?: string; fim?: string; pacienteId?: string; profissionalId?: string; servicoId?: string } = {},
): Record<string, unknown> {
  return {
    pacienteId: opcoes.pacienteId ?? c.pacienteId,
    profissionalId: opcoes.profissionalId ?? c.profissionalId,
    servicoId: opcoes.servicoId ?? c.servicoId,
    inicio: opcoes.inicio ?? iso(SEGUNDA, "09:00"),
    fim: opcoes.fim ?? iso(SEGUNDA, "09:50"),
  };
}

async function criar(
  c: Cenario,
  opcoes: Parameters<typeof corpoCriacao>[1] = {},
  cookie = c.admin.cookie,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = await requisitar("POST", AGENDAMENTOS, { cookie, corpo: corpoCriacao(c, opcoes) });
  expect(res.status).toBe(201);
  return res.body;
}

async function ajustarHorarioAgendamento(
  agendamentoId: string,
  inicio: Date,
  fim: Date,
): Promise<void> {
  await database.transacao(async (tx) => {
    await tx.$executeRaw`
      UPDATE agendamento
         SET inicio = ${inicio},
             fim = ${fim}
       WHERE id = ${agendamentoId}::uuid
    `;
  });
}

// ---------------------------------------------------------------------------
// Leitura direta da persistência
// ---------------------------------------------------------------------------

interface LinhaAgendamento {
  id: string;
  estado: string;
  modalidade: string;
  pacote_id: string | null;
  inicio: Date;
  fim: Date;
  motivo_cancelamento_id: string | null;
  cancelado_em: Date | null;
  cancelado_por_usuario_id: string | null;
  criado_por_usuario_id: string;
}

async function agendamentos(): Promise<LinhaAgendamento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaAgendamento[]>`
      SELECT id, estado::text AS estado, modalidade::text AS modalidade, pacote_id, inicio, fim,
             motivo_cancelamento_id, cancelado_em, cancelado_por_usuario_id, criado_por_usuario_id
        FROM agendamento ORDER BY inicio, id`,
  );
}

interface LinhaHistorico {
  id: string;
  agendamento_id: string;
  operacao: string;
  estado_anterior: string | null;
  estado_novo: string | null;
  inicio_anterior: Date | null;
  fim_anterior: Date | null;
  inicio_novo: Date | null;
  fim_novo: Date | null;
  ator_usuario_id: string;
  motivo_cancelamento_id: string | null;
}

async function historicos(): Promise<LinhaHistorico[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaHistorico[]>`
      SELECT id, agendamento_id, operacao, estado_anterior::text AS estado_anterior,
             estado_novo::text AS estado_novo, inicio_anterior, fim_anterior, inicio_novo, fim_novo,
             ator_usuario_id, motivo_cancelamento_id
        FROM historico_agendamento ORDER BY ocorrido_em, id`,
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

async function eventos(): Promise<LinhaEvento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaEvento[]>`
      SELECT acao, ator_usuario_id, alvo_tipo, alvo_id, resultado::text AS resultado,
             justificativa, contexto, correlacao_id
        FROM evento_auditoria ORDER BY ocorrido_em, correlacao_id`,
  );
}

async function eventosDaAgenda(): Promise<LinhaEvento[]> {
  return (await eventos()).filter((e) => e.acao.startsWith("agendamento."));
}

// ---------------------------------------------------------------------------
// TA-01 — criação válida
// ---------------------------------------------------------------------------

describe("TA-01 — criação válida", () => {
  it("201 AGENDADO, uma linha de histórico CRIADO e um agendamento.criado com o MESMO correlacao_id", async () => {
    const c = await montarCenario();
    const recepcao = await ator("RECEPCIONISTA");

    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: recepcao.cookie,
      corpo: corpoCriacao(c),
    });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe("AGENDADO");
    expect(res.body.modalidade).toBe("AVULSO");
    expect(res.body.motivoCancelamentoId).toBeNull();
    expect(res.body.canceladoEm).toBeNull();
    expect(res.body.inicio).toBe(iso(SEGUNDA, "09:00"));
    expect(res.body.fim).toBe(iso(SEGUNDA, "09:50"));
    expect(res.body.paciente).toEqual({ id: c.pacienteId, nome: "Paciente Sintético Um" });
    expect(res.body.profissional).toEqual({ id: c.profissionalId, nome: "Profissional Sintético Um" });
    expect(res.body.servico).toEqual({ id: c.servicoId, nome: "Fisioterapia Sintética" });
    // Resposta EXATA de D-AGD-05 — nenhum campo a mais.
    expect(Object.keys(res.body).sort()).toEqual([
      "canceladoEm",
      "estado",
      "fim",
      "id",
      "inicio",
      "modalidade",
      "motivoCancelamentoId",
      "paciente",
      "profissional",
      "servico",
    ]);

    const linhas = await agendamentos();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.modalidade).toBe("AVULSO");
    expect(linhas[0]?.pacote_id).toBeNull();
    expect(linhas[0]?.criado_por_usuario_id).toBe(recepcao.id);

    const hist = await historicos();
    expect(hist).toHaveLength(1);
    expect(hist[0]?.operacao).toBe("CRIADO");
    expect(hist[0]?.estado_anterior).toBeNull();
    expect(hist[0]?.estado_novo).toBe("AGENDADO");
    expect(hist[0]?.inicio_novo?.toISOString()).toBe(iso(SEGUNDA, "09:00"));
    expect(hist[0]?.ator_usuario_id).toBe(recepcao.id);

    const evs = await eventosDaAgenda();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({
      acao: "agendamento.criado",
      ator_usuario_id: recepcao.id,
      alvo_tipo: "agendamento",
      alvo_id: res.body.id,
      resultado: "SUCESSO",
      justificativa: null,
    });
    expect(evs[0]?.contexto).toEqual({});
    // Correlação histórico x auditoria (D-AGD-10).
    expect(evs[0]?.correlacao_id).toBe(hist[0]?.id);
  });

  it("o `fim` pode divergir da duração do serviço (D-AGD-05) — 20 e 180 minutos", async () => {
    const c = await montarCenario();
    const curto = await criar(c, { inicio: iso(SEGUNDA, "08:00"), fim: iso(SEGUNDA, "08:20") });
    expect(curto.estado).toBe("AGENDADO");
    const longo = await criar(c, {
      inicio: iso(SEGUNDA, "09:00"),
      fim: iso(SEGUNDA, "12:00"),
      pacienteId: c.paciente2Id,
      profissionalId: c.profissional2Id,
    });
    expect(longo.estado).toBe("AGENDADO");
  });
});

// ---------------------------------------------------------------------------
// TA-02 / TA-03 — elegibilidade e habilitação
// ---------------------------------------------------------------------------

describe("TA-02 — elegibilidade de paciente, profissional e serviço", () => {
  it("inexistente e inativo recebem o MESMO código, sem escrever linha alguma", async () => {
    const c = await montarCenario();

    const casos: Array<[string, Record<string, unknown>, string]> = [
      ["paciente inexistente", { pacienteId: ID_INEXISTENTE }, ERRO_AGENDAMENTO.PACIENTE_INELEGIVEL],
      ["profissional inexistente", { profissionalId: ID_INEXISTENTE }, ERRO_AGENDAMENTO.PROFISSIONAL_INELEGIVEL],
      ["serviço inexistente", { servicoId: ID_INEXISTENTE }, ERRO_AGENDAMENTO.SERVICO_INELEGIVEL],
    ];
    for (const [, sobrescrita, esperado] of casos) {
      const res = await requisitar("POST", AGENDAMENTOS, {
        cookie: c.admin.cookie,
        corpo: corpoCriacao(c, sobrescrita),
      });
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ erro: esperado });
    }

    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE paciente SET ativo = false, inativado_em = now() WHERE id = ${c.pacienteId}::uuid`;
    });
    const inativo = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c),
    });
    expect(inativo.status).toBe(422);
    expect(inativo.body).toEqual({ erro: ERRO_AGENDAMENTO.PACIENTE_INELEGIVEL });

    expect(await agendamentos()).toHaveLength(0);
    expect(await historicos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);
  });

  it("profissional inativo e serviço inativo também são 422 (PRO-005, D-CFG-33)", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE profissional SET ativo = false, inativado_em = now() WHERE id = ${c.profissionalId}::uuid`;
      await tx.$executeRaw`UPDATE servico SET ativo = false, inativado_em = now() WHERE id = ${c.servicoId}::uuid`;
    });
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c),
    });
    // O profissional é verificado ANTES do serviço (D-AGD-04, itens 5 e 6).
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.PROFISSIONAL_INELEGIVEL });
    expect(await agendamentos()).toHaveLength(0);
  });
});

describe("TA-03 — serviço não habilitado ao profissional (PRO-004)", () => {
  it("422 SERVICO_NAO_HABILITADO quando falta a linha de profissional_servico", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM profissional_servico
         WHERE profissional_id = ${c.profissionalId}::uuid AND servico_id = ${c.servicoId}::uuid`;
    });
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.SERVICO_NAO_HABILITADO });
    expect(await agendamentos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TA-04 / TA-05 — RN-014 nas duas camadas
// ---------------------------------------------------------------------------

describe("TA-04 — fora da grade da clínica (D-CFG-61)", () => {
  it("dia sem janela, antes da abertura, depois do fechamento e atravessando a janela → 422 sem evento", async () => {
    const c = await montarCenario();
    const casos: Array<[string, string, string]> = [
      ["dia sem janela", iso(TERCA, "09:00"), iso(TERCA, "09:50")],
      ["antes da abertura", iso(SEGUNDA, "07:00"), iso(SEGUNDA, "07:50")],
      ["depois do fechamento", iso(SEGUNDA, "18:30"), iso(SEGUNDA, "19:00")],
      ["cruza o intervalo entre janelas", iso(SEGUNDA, "11:30"), iso(SEGUNDA, "14:30")],
    ];
    for (const [, inicio, fim] of casos) {
      const res = await requisitar("POST", AGENDAMENTOS, {
        cookie: c.admin.cookie,
        corpo: corpoCriacao(c, { inicio, fim }),
      });
      expect(res.status).toBe(422);
      expect(res.body).toEqual({ erro: ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO });
    }
    expect(await agendamentos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);
    expect(await historicos()).toHaveLength(0);
  });

  it("as bordas exatas da janela são ACEITAS (08:00 e 12:00 locais)", async () => {
    const c = await montarCenario();
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(SEGUNDA, "08:00"), fim: iso(SEGUNDA, "12:00") }),
    });
    expect(res.status).toBe(201);
  });
});

describe("TA-05 — fora da disponibilidade do profissional (D-PRO3-04)", () => {
  it("dentro da grade da clínica mas fora da disponibilidade → 422 FORA_DA_DISPONIBILIDADE", async () => {
    const c = await montarCenario();
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(SEGUNDA, "15:00"), fim: iso(SEGUNDA, "15:50") }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDA.FORA_DA_DISPONIBILIDADE });
    expect(await agendamentos()).toHaveLength(0);
  });

  it("profissional SEM versão de disponibilidade é fail-closed (D-PRO3-10)", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.$executeRaw`DELETE FROM disponibilidade_profissional WHERE profissional_id = ${c.profissionalId}::uuid`;
    });
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDA.FORA_DA_DISPONIBILIDADE });
  });

  it("a grade da clínica é verificada ANTES da disponibilidade (ordem de D-AGD-04)", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.$executeRaw`DELETE FROM disponibilidade_profissional WHERE profissional_id = ${c.profissionalId}::uuid`;
    });
    // Intervalo fora das DUAS camadas: o código devolvido é o da clínica.
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(TERCA, "09:00"), fim: iso(TERCA, "09:50") }),
    });
    expect(res.body).toEqual({ erro: ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO });
  });
});

// ---------------------------------------------------------------------------
// TA-06 / TA-07 / TA-08 — conflitos
// ---------------------------------------------------------------------------

describe("TA-06 — conflito com bloqueio de agenda (RN-015.2)", () => {
  it("409 CONFLITO_BLOQUEIO na sobreposição; borda adjacente é aceita", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.bloqueioAgenda.create({
        data: {
          profissionalId: c.profissionalId,
          inicio: instante(SEGUNDA, "09:00"),
          fim: instante(SEGUNDA, "10:00"),
          motivo: "Bloqueio sintético",
          criadoPorUsuarioId: c.admin.id,
        },
      });
    });

    const sobreposto = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(SEGUNDA, "09:30"), fim: iso(SEGUNDA, "10:30") }),
    });
    expect(sobreposto.status).toBe(409);
    expect(sobreposto.body).toEqual({ erro: ERRO_AGENDAMENTO.CONFLITO_BLOQUEIO });
    expect(await agendamentos()).toHaveLength(0);

    // `[inicio, fim)`: começar exatamente no fim do bloqueio NÃO é conflito.
    const adjacente = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(SEGUNDA, "10:00"), fim: iso(SEGUNDA, "10:50") }),
    });
    expect(adjacente.status).toBe(201);

    // O bloqueio de OUTRO profissional não interfere.
    const outro = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, {
        inicio: iso(SEGUNDA, "09:30"),
        fim: iso(SEGUNDA, "10:00"),
        profissionalId: c.profissional2Id,
        pacienteId: c.paciente2Id,
      }),
    });
    expect(outro.status).toBe(201);
  });
});

describe("TA-07 — conflito do profissional e borda adjacente (RN-015.1)", () => {
  it("sobreposição total e parcial → 409 CONFLITO_PROFISSIONAL; 10:00/10:00 → 201", async () => {
    const c = await montarCenario();
    await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });

    for (const [inicio, fim] of [
      [iso(SEGUNDA, "09:00"), iso(SEGUNDA, "10:00")],
      [iso(SEGUNDA, "09:30"), iso(SEGUNDA, "10:30")],
      [iso(SEGUNDA, "08:30"), iso(SEGUNDA, "09:30")],
      [iso(SEGUNDA, "08:00"), iso(SEGUNDA, "11:00")],
    ]) {
      const res = await requisitar("POST", AGENDAMENTOS, {
        cookie: c.admin.cookie,
        corpo: corpoCriacao(c, { inicio, fim, pacienteId: c.paciente2Id }),
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.CONFLITO_PROFISSIONAL });
    }

    const adjacente = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, {
        inicio: iso(SEGUNDA, "10:00"),
        fim: iso(SEGUNDA, "11:00"),
        pacienteId: c.paciente2Id,
      }),
    });
    expect(adjacente.status).toBe(201);
    expect(await agendamentos()).toHaveLength(2);
    expect(await historicos()).toHaveLength(2);
    expect(await eventosDaAgenda()).toHaveLength(2);
  });

  it("um agendamento CANCELADO libera o horário — a exclusion constraint é parcial", async () => {
    const c = await montarCenario();
    const criado = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    const cancelamento = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    expect(cancelamento.status).toBe(200);

    const novo = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") }),
    });
    expect(novo.status).toBe(201);
  });
});

describe("TA-08 — conflito do paciente com outro profissional (RN-015.3)", () => {
  it("409 CONFLITO_PACIENTE, sem expor o recurso conflitante", async () => {
    const c = await montarCenario();
    await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });

    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, {
        inicio: iso(SEGUNDA, "09:30"),
        fim: iso(SEGUNDA, "10:30"),
        profissionalId: c.profissional2Id,
      }),
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.CONFLITO_PACIENTE });
    expect(Object.keys(res.body)).toEqual(["erro"]);
    expect(await agendamentos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TA-09 — concorrência real
// ---------------------------------------------------------------------------

describe("TA-09 — duas criações concorrentes no mesmo intervalo", () => {
  it("exatamente UMA recebe 201; a outra recebe 409 CONFLITO_PROFISSIONAL", async () => {
    const c = await montarCenario();
    const corpoA = corpoCriacao(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    const corpoB = corpoCriacao(c, {
      inicio: iso(SEGUNDA, "09:00"),
      fim: iso(SEGUNDA, "10:00"),
      pacienteId: c.paciente2Id,
    });

    const [a, b] = await Promise.all([
      requisitar("POST", AGENDAMENTOS, { cookie: c.admin.cookie, corpo: corpoA }),
      requisitar("POST", AGENDAMENTOS, { cookie: c.admin.cookie, corpo: corpoB }),
    ]);

    const status = [a.status, b.status].sort();
    expect(status).toEqual([201, 409]);
    const perdedor = a.status === 409 ? a : b;
    expect(perdedor.body).toEqual({ erro: ERRO_AGENDAMENTO.CONFLITO_PROFISSIONAL });

    // A transação perdedora não deixou resíduo algum.
    expect(await agendamentos()).toHaveLength(1);
    expect(await historicos()).toHaveLength(1);
    expect(await eventosDaAgenda()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TA-10 — regra temporal
// ---------------------------------------------------------------------------

describe("TA-10 — início no passado (D-AGD-03)", () => {
  it("422 AGENDAMENTO_NO_PASSADO, sem mutação", async () => {
    const c = await montarCenario();
    // Uma segunda-feira JÁ PASSADA, dentro da grade — só a regra temporal rejeita.
    const segundaPassada = partesLocais(
      new Date(instante(SEGUNDA, "09:00").getTime() - 14 * 86_400_000),
    ).data;
    const res = await requisitar("POST", AGENDAMENTOS, {
      cookie: c.admin.cookie,
      corpo: corpoCriacao(c, {
        inicio: iso(segundaPassada, "09:00"),
        fim: iso(segundaPassada, "09:50"),
      }),
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.AGENDAMENTO_NO_PASSADO });
    expect(await agendamentos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);
  });

  it("400 para intervalo malformado: fim <= inicio, segundos, duração acima de 1440 e sem fuso", async () => {
    const c = await montarCenario();
    const corpos: Array<Record<string, unknown>> = [
      corpoCriacao(c, { fim: iso(SEGUNDA, "09:00") }),
      corpoCriacao(c, { inicio: iso(SEGUNDA, "10:00"), fim: iso(SEGUNDA, "09:00") }),
      { ...corpoCriacao(c), inicio: "2027-01-04T09:00:30Z" },
      { ...corpoCriacao(c), inicio: "2027-01-04T09:00:00", fim: "2027-01-04T09:50:00" },
      corpoCriacao(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(TERCA, "09:01") }),
      { ...corpoCriacao(c), modalidade: "AVULSO" },
    ];
    for (const corpo of corpos) {
      const res = await requisitar("POST", AGENDAMENTOS, { cookie: c.admin.cookie, corpo });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    expect(await agendamentos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TA-11 — confirmação
// ---------------------------------------------------------------------------

describe("TA-11 — confirmação e no-op", () => {
  it("AGENDADO → CONFIRMADO grava histórico e NENHUM evento; reconfirmar é no-op puro", async () => {
    const c = await montarCenario();
    const criado = await criar(c);

    const primeira = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(primeira.status).toBe(200);
    expect(primeira.body.estado).toBe("CONFIRMADO");

    let hist = await historicos();
    expect(hist).toHaveLength(2);
    expect(hist[1]?.operacao).toBe("CONFIRMADO");
    expect(hist[1]?.estado_anterior).toBe("AGENDADO");
    expect(hist[1]?.estado_novo).toBe("CONFIRMADO");
    expect(hist[1]?.inicio_novo).toBeNull();
    // A confirmação NÃO está no catálogo de auditoria (D-AGD-10).
    expect(await eventosDaAgenda()).toHaveLength(1);

    const segunda = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(segunda.status).toBe(200);
    expect(segunda.body.estado).toBe("CONFIRMADO");
    hist = await historicos();
    expect(hist).toHaveLength(2);
    expect(await eventosDaAgenda()).toHaveLength(1);
  });

  it("corpo diferente de `{}` é 400 e não muda estado algum", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
      cookie: c.admin.cookie,
      corpo: { estado: "CONFIRMADO" },
    });
    expect(res.status).toBe(400);
    expect((await agendamentos())[0]?.estado).toBe("AGENDADO");
    expect(await historicos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TA-12 / TA-13 — remarcação
// ---------------------------------------------------------------------------

describe("TA-12 — remarcação válida", () => {
  it("200, histórico REMARCADO com antes/depois, evento agendamento.remarcado e CONFIRMADO volta a AGENDADO", async () => {
    const c = await montarCenario();
    const criado = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
      cookie: c.admin.cookie,
      corpo: {},
    });

    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/remarcacao`, {
      cookie: c.admin.cookie,
      corpo: { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:30") },
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("AGENDADO");
    expect(res.body.inicio).toBe(iso(SEGUNDA, "10:30"));
    expect(res.body.fim).toBe(iso(SEGUNDA, "11:30"));

    const hist = await historicos();
    expect(hist).toHaveLength(3);
    const remarcado = hist[2] as LinhaHistorico;
    expect(remarcado.operacao).toBe("REMARCADO");
    expect(remarcado.estado_anterior).toBe("CONFIRMADO");
    expect(remarcado.estado_novo).toBe("AGENDADO");
    expect(remarcado.inicio_anterior?.toISOString()).toBe(iso(SEGUNDA, "09:00"));
    expect(remarcado.fim_anterior?.toISOString()).toBe(iso(SEGUNDA, "10:00"));
    expect(remarcado.inicio_novo?.toISOString()).toBe(iso(SEGUNDA, "10:30"));
    expect(remarcado.fim_novo?.toISOString()).toBe(iso(SEGUNDA, "11:30"));

    const evs = await eventosDaAgenda();
    expect(evs.map((e) => e.acao)).toEqual(["agendamento.criado", "agendamento.remarcado"]);
    expect(evs[1]?.correlacao_id).toBe(remarcado.id);
    expect(evs[1]?.contexto).toEqual({});
  });

  it("remarcar para o MESMO intervalo é no-op: 200 sem histórico e sem evento", async () => {
    const c = await montarCenario();
    const criado = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/remarcacao`, {
      cookie: c.admin.cookie,
      corpo: { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") },
    });
    expect(res.status).toBe(200);
    expect(await historicos()).toHaveLength(1);
    expect(await eventosDaAgenda()).toHaveLength(1);
  });

  it("remarcação NÃO troca profissional, serviço nem paciente — corpo com esses campos é 400", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/remarcacao`, {
      cookie: c.admin.cookie,
      corpo: {
        inicio: iso(SEGUNDA, "10:30"),
        fim: iso(SEGUNDA, "11:30"),
        profissionalId: c.profissional2Id,
      },
    });
    expect(res.status).toBe(400);
  });
});

describe("TA-13 — remarcação rejeitada preserva integralmente o intervalo original", () => {
  it("conflito, fora da grade, fora da disponibilidade, bloqueio e passado não mutam nada", async () => {
    const c = await montarCenario();
    const alvo = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    await criar(c, {
      inicio: iso(SEGUNDA, "11:00"),
      fim: iso(SEGUNDA, "12:00"),
      pacienteId: c.paciente2Id,
    });
    await database.transacao(async (tx) => {
      await tx.bloqueioAgenda.create({
        data: {
          profissionalId: c.profissionalId,
          inicio: instante(SEGUNDA, "10:00"),
          fim: instante(SEGUNDA, "10:30"),
          motivo: "Bloqueio sintético",
          criadoPorUsuarioId: c.admin.id,
        },
      });
    });
    const segundaPassada = partesLocais(
      new Date(instante(SEGUNDA, "09:00").getTime() - 14 * 86_400_000),
    ).data;

    const casos: Array<[Record<string, string>, number, string]> = [
      [
        { inicio: iso(SEGUNDA, "11:30"), fim: iso(SEGUNDA, "11:45") },
        409,
        ERRO_AGENDAMENTO.CONFLITO_PROFISSIONAL,
      ],
      [
        { inicio: iso(TERCA, "09:00"), fim: iso(TERCA, "09:50") },
        422,
        ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO,
      ],
      [
        { inicio: iso(SEGUNDA, "15:00"), fim: iso(SEGUNDA, "15:50") },
        422,
        ERRO_AGENDA.FORA_DA_DISPONIBILIDADE,
      ],
      [
        { inicio: iso(SEGUNDA, "10:15"), fim: iso(SEGUNDA, "10:45") },
        409,
        ERRO_AGENDAMENTO.CONFLITO_BLOQUEIO,
      ],
      [
        { inicio: iso(segundaPassada, "09:00"), fim: iso(segundaPassada, "09:50") },
        422,
        ERRO_AGENDAMENTO.AGENDAMENTO_NO_PASSADO,
      ],
    ];

    for (const [corpo, status, erro] of casos) {
      const res = await requisitar("POST", `${AGENDAMENTOS}/${alvo.id}/remarcacao`, {
        cookie: c.admin.cookie,
        corpo,
      });
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ erro });
    }

    const linhas = await agendamentos();
    const original = linhas.find((l) => l.id === alvo.id) as LinhaAgendamento;
    expect(original.inicio.toISOString()).toBe(iso(SEGUNDA, "09:00"));
    expect(original.fim.toISOString()).toBe(iso(SEGUNDA, "10:00"));
    expect(original.estado).toBe("AGENDADO");
    // Duas criações; nenhuma remarcação efetiva.
    expect(await historicos()).toHaveLength(2);
    expect(await eventosDaAgenda()).toHaveLength(2);
  });

  it("remarcar um profissional inativado depois da criação é 422 e preserva o intervalo", async () => {
    const c = await montarCenario();
    const alvo = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE profissional SET ativo = false, inativado_em = now() WHERE id = ${c.profissionalId}::uuid`;
    });
    const res = await requisitar("POST", `${AGENDAMENTOS}/${alvo.id}/remarcacao`, {
      cookie: c.admin.cookie,
      corpo: { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:30") },
    });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.PROFISSIONAL_INELEGIVEL });
    expect((await agendamentos())[0]?.inicio.toISOString()).toBe(iso(SEGUNDA, "09:00"));
  });
});

// ---------------------------------------------------------------------------
// TA-14 — cancelamento
// ---------------------------------------------------------------------------

describe("TA-14 — cancelamento com motivo padronizado (D-AGD-07)", () => {
  it("motivo ativo → 200, quatro campos gravados juntos, histórico e evento correlacionados", async () => {
    const c = await montarCenario();
    const criado = await criar(c);

    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("CANCELADO");
    expect(res.body.motivoCancelamentoId).toBe(c.motivoId);
    expect(typeof res.body.canceladoEm).toBe("string");

    const linha = (await agendamentos())[0] as LinhaAgendamento;
    expect(linha.estado).toBe("CANCELADO");
    expect(linha.motivo_cancelamento_id).toBe(c.motivoId);
    expect(linha.cancelado_em).not.toBeNull();
    expect(linha.cancelado_por_usuario_id).toBe(c.admin.id);

    const hist = await historicos();
    expect(hist).toHaveLength(2);
    const cancelado = hist[1] as LinhaHistorico;
    expect(cancelado.operacao).toBe("CANCELADO");
    expect(cancelado.estado_anterior).toBe("AGENDADO");
    expect(cancelado.estado_novo).toBe("CANCELADO");
    expect(cancelado.motivo_cancelamento_id).toBe(c.motivoId);

    const evs = await eventosDaAgenda();
    expect(evs.map((e) => e.acao)).toEqual(["agendamento.criado", "agendamento.cancelado"]);
    expect(evs[1]?.correlacao_id).toBe(cancelado.id);
    expect(evs[1]?.alvo_tipo).toBe("agendamento");
    expect(evs[1]?.justificativa).toBeNull();
  });

  it("cancelar um CONFIRMADO também é permitido", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("CANCELADO");
  });

  it("sem motivo no corpo → 400; motivo inexistente, inativo e catálogo vazio → 422, sem mutação", async () => {
    const c = await montarCenario();
    const criado = await criar(c);

    const semMotivo = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(semMotivo.status).toBe(400);
    expect(semMotivo.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });

    const inexistente = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: ID_INEXISTENTE },
    });
    expect(inexistente.status).toBe(422);
    expect(inexistente.body).toEqual({ erro: ERRO_AGENDAMENTO.MOTIVO_CANCELAMENTO_INELEGIVEL });

    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE motivo_cancelamento SET ativo = false, inativado_em = now() WHERE id = ${c.motivoId}::uuid`;
    });
    const inativo = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    expect(inativo.status).toBe(422);
    expect(inativo.body).toEqual({ erro: ERRO_AGENDAMENTO.MOTIVO_CANCELAMENTO_INELEGIVEL });

    // Catálogo sem motivo algum: o cancelamento é impossível (consequência de D-AGD-07).
    await database.transacao(async (tx) => {
      await tx.$executeRaw`DELETE FROM motivo_cancelamento`;
    });
    const vazio = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    expect(vazio.status).toBe(422);
    expect(vazio.body).toEqual({ erro: ERRO_AGENDAMENTO.MOTIVO_CANCELAMENTO_INELEGIVEL });

    expect((await agendamentos())[0]?.estado).toBe("AGENDADO");
    expect(await historicos()).toHaveLength(1);
    expect(await eventosDaAgenda()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AGD-B — check-in e falta
// ---------------------------------------------------------------------------

describe("AGD-B — check-in e falta", () => {
  async function fisioterapeutaVinculadoAgdB(
    profissionalId: string,
    permissao: "agenda.checkin" | "agenda.falta",
  ): Promise<{ id: string; cookie: string }> {
    const id = await criarUsuario("fisio-agd-b");
    await darPermissaoPorPapel(id, "FISIOTERAPEUTA", permissao);
    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE profissional SET usuario_id = ${id}::uuid WHERE id = ${profissionalId}::uuid`;
    });
    return { id, cookie: await cookieDe(id) };
  }

  it("check-in válido → 200 AGUARDANDO, histórico CHECKIN e sem auditoria nova", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const agora = new Date();
    await ajustarHorarioAgendamento(
      criado.id,
      new Date(agora.getTime() - 30 * 60_000),
      new Date(agora.getTime() + 20 * 60_000),
    );

    const antesEventos = (await eventosDaAgenda()).length;
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/check-in`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("AGUARDANDO");
    expect((await agendamentos())[0]?.estado).toBe("AGUARDANDO");
    expect((await historicos()).map((h) => h.operacao)).toEqual(["CRIADO", "CHECKIN"]);
    expect(await eventosDaAgenda()).toHaveLength(antesEventos);
  });

  it("falta válida (após início) → 200 FALTA, histórico FALTA e sem auditoria nova", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const agora = new Date();
    await ajustarHorarioAgendamento(
      criado.id,
      new Date(agora.getTime() - 2 * 60 * 60_000),
      new Date(agora.getTime() - 70 * 60_000),
    );

    const antesEventos = (await eventosDaAgenda()).length;
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/falta`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("FALTA");
    expect((await agendamentos())[0]?.estado).toBe("FALTA");
    expect((await historicos()).map((h) => h.operacao)).toEqual(["CRIADO", "FALTA"]);
    expect(await eventosDaAgenda()).toHaveLength(antesEventos);
  });

  it("permissões são independentes: check-in não concede falta e vice-versa", async () => {
    const c = await montarCenario();
    const criadoCheckIn = await criar(c);
    const criadoFalta = await criar(c, { inicio: iso(SEGUNDA, "10:00"), fim: iso(SEGUNDA, "10:50") });
    const agora = new Date();
    await ajustarHorarioAgendamento(
      criadoCheckIn.id,
      new Date(agora.getTime() - 15 * 60_000),
      new Date(agora.getTime() + 35 * 60_000),
    );
    await ajustarHorarioAgendamento(
      criadoFalta.id,
      new Date(agora.getTime() - 2 * 60 * 60_000),
      new Date(agora.getTime() - 90 * 60_000),
    );

    const recepcaoCheckIn = await ator("RECEPCIONISTA", "agenda.checkin");
    const recepcaoFalta = await ator("RECEPCIONISTA", "agenda.falta");

    const checkInOk = await requisitar("POST", `${AGENDAMENTOS}/${criadoCheckIn.id}/check-in`, {
      cookie: recepcaoCheckIn.cookie,
      corpo: {},
    });
    expect(checkInOk.status).toBe(200);

    const faltaNegada = await requisitar("POST", `${AGENDAMENTOS}/${criadoCheckIn.id}/falta`, {
      cookie: recepcaoCheckIn.cookie,
      corpo: {},
    });
    expect(faltaNegada.status).toBe(403);
    expect(faltaNegada.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });

    const faltaOk = await requisitar("POST", `${AGENDAMENTOS}/${criadoFalta.id}/falta`, {
      cookie: recepcaoFalta.cookie,
      corpo: {},
    });
    expect(faltaOk.status).toBe(200);

    const checkInNegado = await requisitar("POST", `${AGENDAMENTOS}/${criadoFalta.id}/check-in`, {
      cookie: recepcaoFalta.cookie,
      corpo: {},
    });
    expect(checkInNegado.status).toBe(403);
    expect(checkInNegado.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
  });

  it("fora da janela temporal retorna 422 FORA_DA_JANELA_TEMPORAL", async () => {
    const c = await montarCenario();
    const agendamentoCheckIn = await criar(c);
    const agendamentoFalta = await criar(c, { inicio: iso(SEGUNDA, "10:00"), fim: iso(SEGUNDA, "10:50") });

    const checkIn = await requisitar("POST", `${AGENDAMENTOS}/${agendamentoCheckIn.id}/check-in`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(checkIn.status).toBe(422);
    expect(checkIn.body).toEqual({ erro: ERRO_AGENDAMENTO.FORA_DA_JANELA_TEMPORAL });

    const falta = await requisitar("POST", `${AGENDAMENTOS}/${agendamentoFalta.id}/falta`, {
      cookie: c.admin.cookie,
      corpo: {},
    });
    expect(falta.status).toBe(422);
    expect(falta.body).toEqual({ erro: ERRO_AGENDAMENTO.FORA_DA_JANELA_TEMPORAL });
  });

  it("validação de entrada: UUID inválido e corpo não-{} retornam 400", async () => {
    const c = await montarCenario();
    for (const [caminho, corpo] of [
      [`${AGENDAMENTOS}/nao-e-uuid/check-in`, {}],
      [`${AGENDAMENTOS}/nao-e-uuid/falta`, {}],
      [`${AGENDAMENTOS}/${ID_INEXISTENTE}/check-in`, { extra: true }],
      [`${AGENDAMENTOS}/${ID_INEXISTENTE}/falta`, null],
      [`${AGENDAMENTOS}/${ID_INEXISTENTE}/check-in`, []],
    ] as Array<[string, unknown]>) {
      const res = await requisitar("POST", caminho, { cookie: c.admin.cookie, corpo });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    }
  });

  it("escopo próprio não revela existência: recurso alheio retorna 404 AGENDAMENTO_NAO_ENCONTRADO", async () => {
    const c = await montarCenario();
    const proprio = await criar(c);
    const alheio = await criar(c, {
      inicio: iso(SEGUNDA, "10:00"),
      fim: iso(SEGUNDA, "10:50"),
      profissionalId: c.profissional2Id,
      pacienteId: c.paciente2Id,
    });
    const fisio = await fisioterapeutaVinculadoAgdB(c.profissionalId, "agenda.checkin");
    const agora = new Date();
    await ajustarHorarioAgendamento(
      proprio.id,
      new Date(agora.getTime() - 20 * 60_000),
      new Date(agora.getTime() + 30 * 60_000),
    );
    await ajustarHorarioAgendamento(
      alheio.id,
      new Date(agora.getTime() - 20 * 60_000),
      new Date(agora.getTime() + 30 * 60_000),
    );

    const foraDoEscopo = await requisitar("POST", `${AGENDAMENTOS}/${alheio.id}/check-in`, {
      cookie: fisio.cookie,
      corpo: {},
    });
    expect(foraDoEscopo.status).toBe(404);
    expect(foraDoEscopo.body).toEqual({ erro: ERRO_AGENDAMENTO.AGENDAMENTO_NAO_ENCONTRADO });

    const proprioOk = await requisitar("POST", `${AGENDAMENTOS}/${proprio.id}/check-in`, {
      cookie: fisio.cookie,
      corpo: {},
    });
    expect(proprioOk.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// TA-15 — estados terminais
// ---------------------------------------------------------------------------

describe("TA-15 — transição a partir de estado terminal (RN-020)", () => {
  it("confirmar, remarcar e cancelar um CANCELADO → 409 TRANSICAO_INVALIDA sem mutação", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });

    const historicoAntes = (await historicos()).length;
    const eventosAntes = (await eventosDaAgenda()).length;

    const tentativas: Array<[string, Record<string, unknown>]> = [
      [`${AGENDAMENTOS}/${criado.id}/confirmacao`, {}],
      [
        `${AGENDAMENTOS}/${criado.id}/remarcacao`,
        { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:30") },
      ],
      [`${AGENDAMENTOS}/${criado.id}/cancelamento`, { motivoCancelamentoId: c.motivoId }],
    ];
    for (const [caminho, corpo] of tentativas) {
      const res = await requisitar("POST", caminho, { cookie: c.admin.cookie, corpo });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.TRANSICAO_INVALIDA });
    }

    expect((await agendamentos())[0]?.estado).toBe("CANCELADO");
    expect(await historicos()).toHaveLength(historicoAntes);
    expect(await eventosDaAgenda()).toHaveLength(eventosAntes);
  });

  it("remarcar o MESMO intervalo de um CANCELADO é 409, não no-op — o estado é avaliado primeiro", async () => {
    const c = await montarCenario();
    const criado = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });
    const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/remarcacao`, {
      cookie: c.admin.cookie,
      corpo: { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") },
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.TRANSICAO_INVALIDA });
  });

  it("estados de AGD-B/AGD-E, gravados diretamente, também recusam as transições de AGD-A", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    for (const estado of ["AGUARDANDO", "EM_ATENDIMENTO", "CONCLUIDO", "FALTA"]) {
      await database.transacao(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE agendamento SET estado = '${estado}'::estado_agendamento WHERE id = $1::uuid`,
          criado.id,
        );
      });
      const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`, {
        cookie: c.admin.cookie,
        corpo: {},
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.TRANSICAO_INVALIDA });
    }
  });
});

// ---------------------------------------------------------------------------
// TA-16 — escopo próprio
// ---------------------------------------------------------------------------

describe("TA-16 — escopo próprio do Fisioterapeuta (D-AGD-12)", () => {
  async function fisioterapeutaVinculado(profissionalId: string): Promise<{ id: string; cookie: string }> {
    const id = await criarUsuario("fisio");
    await darPermissaoPorPapel(id, "FISIOTERAPEUTA", "agenda.gerenciar");
    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE profissional SET usuario_id = ${id}::uuid WHERE id = ${profissionalId}::uuid`;
    });
    return { id, cookie: await cookieDe(id) };
  }

  it("lista SOMENTE os próprios agendamentos, ainda que peça outro profissionalId", async () => {
    const c = await montarCenario();
    const proprio = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    const alheio = await criar(c, {
      inicio: iso(SEGUNDA, "09:00"),
      fim: iso(SEGUNDA, "10:00"),
      profissionalId: c.profissional2Id,
      pacienteId: c.paciente2Id,
    });
    const fisio = await fisioterapeutaVinculado(c.profissionalId);

    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;
    const lista = await requisitar("GET", `${AGENDAMENTOS}?${janela}`, { cookie: fisio.cookie });
    expect(lista.status).toBe(200);
    expect(lista.body.map((a: { id: string }) => a.id)).toEqual([proprio.id]);

    const forcada = await requisitar(
      "GET",
      `${AGENDAMENTOS}?${janela}&profissionalId=${c.profissional2Id}`,
      { cookie: fisio.cookie },
    );
    expect(forcada.status).toBe(200);
    expect(forcada.body.map((a: { id: string }) => a.id)).toEqual([proprio.id]);

    // O Administrador continua enxergando os dois.
    const admin = await requisitar("GET", `${AGENDAMENTOS}?${janela}`, { cookie: c.admin.cookie });
    expect(admin.body.map((a: { id: string }) => a.id).sort()).toEqual([proprio.id, alheio.id].sort());
  });

  it("consulta e mutação por id fora do escopo → 404; dentro do escopo → sucesso", async () => {
    const c = await montarCenario();
    const proprio = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    const alheio = await criar(c, {
      inicio: iso(SEGUNDA, "09:00"),
      fim: iso(SEGUNDA, "10:00"),
      profissionalId: c.profissional2Id,
      pacienteId: c.paciente2Id,
    });
    const fisio = await fisioterapeutaVinculado(c.profissionalId);

    for (const [metodo, caminho, corpo] of [
      ["GET", `${AGENDAMENTOS}/${alheio.id}`, undefined],
      ["POST", `${AGENDAMENTOS}/${alheio.id}/confirmacao`, {}],
      ["POST", `${AGENDAMENTOS}/${alheio.id}/remarcacao`, { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:30") }],
      ["POST", `${AGENDAMENTOS}/${alheio.id}/cancelamento`, { motivoCancelamentoId: c.motivoId }],
    ] as Array<[Metodo, string, Record<string, unknown> | undefined]>) {
      const res = await requisitar(metodo, caminho, { cookie: fisio.cookie, corpo });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ erro: ERRO_AGENDAMENTO.AGENDAMENTO_NAO_ENCONTRADO });
    }

    const proprioOk = await requisitar("POST", `${AGENDAMENTOS}/${proprio.id}/confirmacao`, {
      cookie: fisio.cookie,
      corpo: {},
    });
    expect(proprioOk.status).toBe(200);
    // O agendamento alheio ficou intacto.
    expect((await agendamentos()).find((l) => l.id === alheio.id)?.estado).toBe("AGENDADO");
  });

  it("criar para OUTRO profissional → 403 ACESSO_NEGADO, sem mutação e sem evento", async () => {
    const c = await montarCenario();
    const fisio = await fisioterapeutaVinculado(c.profissionalId);

    const negado = await requisitar("POST", AGENDAMENTOS, {
      cookie: fisio.cookie,
      corpo: corpoCriacao(c, { profissionalId: c.profissional2Id }),
    });
    expect(negado.status).toBe(403);
    expect(negado.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    expect(await agendamentos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);

    const permitido = await requisitar("POST", AGENDAMENTOS, {
      cookie: fisio.cookie,
      corpo: corpoCriacao(c),
    });
    expect(permitido.status).toBe(201);
  });

  it("Fisioterapeuta SEM profissional vinculado tem escopo VAZIO — lista vazia, 404 e 403", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const orfao = await ator("FISIOTERAPEUTA");

    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;
    const lista = await requisitar("GET", `${AGENDAMENTOS}?${janela}`, { cookie: orfao.cookie });
    expect(lista.status).toBe(200);
    expect(lista.body).toEqual([]);

    const consulta = await requisitar("GET", `${AGENDAMENTOS}/${criado.id}`, { cookie: orfao.cookie });
    expect(consulta.status).toBe(404);

    const criacao = await requisitar("POST", AGENDAMENTOS, {
      cookie: orfao.cookie,
      corpo: corpoCriacao(c),
    });
    expect(criacao.status).toBe(403);
  });

  it("papel customizado que concede a permissão recebe escopo PRÓPRIO — fail-closed", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const custom = await ator("COORDENACAO_CLINICA");
    const consulta = await requisitar("GET", `${AGENDAMENTOS}/${criado.id}`, { cookie: custom.cookie });
    expect(consulta.status).toBe(404);
  });

  it("papel RECEPCIONISTA que NÃO concede a permissão não confere escopo operacional", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    // A permissão vem de um papel customizado; RECEPCIONISTA entra sem conceder nada.
    const id = await criarUsuario("misto");
    await darPermissaoPorPapel(id, "COORDENACAO_CLINICA", "agenda.gerenciar");
    await darPapelSemPermissao(id, "RECEPCIONISTA");
    const cookie = await cookieDe(id);

    const consulta = await requisitar("GET", `${AGENDAMENTOS}/${criado.id}`, { cookie });
    expect(consulta.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TA-17 — autenticação, RBAC e CSRF
// ---------------------------------------------------------------------------

describe("TA-17 — autenticação, autorização e CSRF", () => {
  it("sem sessão → 401 em toda rota da agenda", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;

    const rotas: Array<[Metodo, string]> = [
      ["GET", `${AGENDAMENTOS}?${janela}`],
      ["GET", `${AGENDAMENTOS}/${criado.id}`],
      ["GET", "/agenda/opcoes"],
      ["POST", AGENDAMENTOS],
      ["POST", `${AGENDAMENTOS}/${criado.id}/confirmacao`],
      ["POST", `${AGENDAMENTOS}/${criado.id}/check-in`],
      ["POST", `${AGENDAMENTOS}/${criado.id}/falta`],
      ["POST", `${AGENDAMENTOS}/${criado.id}/remarcacao`],
      ["POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`],
    ];
    for (const [metodo, caminho] of rotas) {
      const res = await requisitar(metodo, caminho, { corpo: {} });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ erro: ERRO.SESSAO_INVALIDA });
    }
  });

  it("Gestor (sem agenda.gerenciar) → 403 ACESSO_NEGADO, sem evento da agenda", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const gestorId = await criarUsuario("gestor");
    await darPermissaoPorPapel(gestorId, "GESTOR", "indicadores.globais.ler");
    const cookie = await cookieDe(gestorId);
    const eventosAntes = (await eventosDaAgenda()).length;

    for (const [metodo, caminho] of [
      ["GET", `${AGENDAMENTOS}/${criado.id}`],
      ["GET", "/agenda/opcoes"],
      ["POST", AGENDAMENTOS],
    ] as Array<[Metodo, string]>) {
      const res = await requisitar(metodo, caminho, { cookie, corpo: corpoCriacao(c) });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    }
    expect(await eventosDaAgenda()).toHaveLength(eventosAntes);
  });

  it("mutação sem o custom header CSRF → 403 REQUISICAO_NAO_AUTORIZADA e nenhuma mutação", async () => {
    const c = await montarCenario();
    const criado = await criar(c);

    for (const [caminho, corpo] of [
      [AGENDAMENTOS, corpoCriacao(c, { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:00") })],
      [`${AGENDAMENTOS}/${criado.id}/confirmacao`, {}],
      [`${AGENDAMENTOS}/${criado.id}/check-in`, {}],
      [`${AGENDAMENTOS}/${criado.id}/falta`, {}],
      [`${AGENDAMENTOS}/${criado.id}/remarcacao`, { inicio: iso(SEGUNDA, "10:30"), fim: iso(SEGUNDA, "11:30") }],
      [`${AGENDAMENTOS}/${criado.id}/cancelamento`, { motivoCancelamentoId: c.motivoId }],
    ] as Array<[string, Record<string, unknown>]>) {
      const res = await requisitar("POST", caminho, { cookie: c.admin.cookie, corpo, csrf: false });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_NAO_AUTORIZADA });
    }

    expect(await agendamentos()).toHaveLength(1);
    expect((await agendamentos())[0]?.estado).toBe("AGENDADO");
    expect(await historicos()).toHaveLength(1);
  });

  it("os GETs da agenda são métodos seguros: sem CSRF e com Cache-Control: no-store", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;
    for (const caminho of [`${AGENDAMENTOS}?${janela}`, `${AGENDAMENTOS}/${criado.id}`, "/agenda/opcoes"]) {
      const res = await requisitar("GET", caminho, { cookie: c.admin.cookie });
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("identificador malformado na rota → 400, nunca 500", async () => {
    const c = await montarCenario();
    const res = await requisitar("GET", `${AGENDAMENTOS}/nao-e-uuid`, { cookie: c.admin.cookie });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("payload acima do limite do parser retorna 413 antes de sessão/permissão/CSRF", async () => {
    const corpoGigante = `{ "x": "${"a".repeat(2_000_000)}" }`;
    const res = await requisitar("POST", `${AGENDAMENTOS}/${ID_INEXISTENTE}/check-in`, {
      corpo: corpoGigante,
      csrf: false,
    });
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// TA-18 — janela de consulta
// ---------------------------------------------------------------------------

describe("TA-18 — janela de consulta (D-AGD-14)", () => {
  it("devolve o que INTERSECTA [de, ate), em todos os estados, ordenado por inicio e id", async () => {
    const c = await montarCenario();
    const tarde = await criar(c, { inicio: iso(SEGUNDA, "11:00"), fim: iso(SEGUNDA, "12:00") });
    const cedo = await criar(c, {
      inicio: iso(SEGUNDA, "08:00"),
      fim: iso(SEGUNDA, "09:00"),
      pacienteId: c.paciente2Id,
    });
    await requisitar("POST", `${AGENDAMENTOS}/${cedo.id}/cancelamento`, {
      cookie: c.admin.cookie,
      corpo: { motivoCancelamentoId: c.motivoId },
    });

    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;
    const res = await requisitar("GET", `${AGENDAMENTOS}?${janela}`, { cookie: c.admin.cookie });
    expect(res.status).toBe(200);
    // Ordem por `inicio`; o CANCELADO continua na lista.
    expect(res.body.map((a: { id: string; estado: string }) => [a.id, a.estado])).toEqual([
      [cedo.id, "CANCELADO"],
      [tarde.id, "AGENDADO"],
    ]);
  });

  it("intersecção é meio aberta: o agendamento que só encosta na borda fica de fora", async () => {
    const c = await montarCenario();
    await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });

    const dentro = `de=${encodeURIComponent(iso(SEGUNDA, "09:30"))}&ate=${encodeURIComponent(iso(SEGUNDA, "11:00"))}`;
    expect((await requisitar("GET", `${AGENDAMENTOS}?${dentro}`, { cookie: c.admin.cookie })).body).toHaveLength(1);

    const depois = `de=${encodeURIComponent(iso(SEGUNDA, "10:00"))}&ate=${encodeURIComponent(iso(SEGUNDA, "11:00"))}`;
    expect((await requisitar("GET", `${AGENDAMENTOS}?${depois}`, { cookie: c.admin.cookie })).body).toHaveLength(0);

    const antes = `de=${encodeURIComponent(iso(SEGUNDA, "08:00"))}&ate=${encodeURIComponent(iso(SEGUNDA, "09:00"))}`;
    expect((await requisitar("GET", `${AGENDAMENTOS}?${antes}`, { cookie: c.admin.cookie })).body).toHaveLength(0);
  });

  it("janela ausente, invertida, degenerada, maior que 7 dias ou com parâmetro extra → 400", async () => {
    const c = await montarCenario();
    const de = iso(SEGUNDA, "00:00");
    const consultas = [
      "",
      `de=${encodeURIComponent(de)}`,
      `ate=${encodeURIComponent(de)}`,
      `de=${encodeURIComponent(iso(TERCA, "00:00"))}&ate=${encodeURIComponent(de)}`,
      `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(de)}`,
      `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(
        new Date(instante(SEGUNDA, "00:00").getTime() + 7 * 86_400_000 + 1).toISOString(),
      )}`,
      `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}&pacienteId=${c.pacienteId}`,
      `de=2026-10-01&ate=2026-10-02`,
    ];
    for (const consulta of consultas) {
      const res = await requisitar("GET", `${AGENDAMENTOS}?${consulta}`, { cookie: c.admin.cookie });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    }
  });

  it("exatamente 7 dias é aceito", async () => {
    const c = await montarCenario();
    const de = iso(SEGUNDA, "00:00");
    const ate = new Date(instante(SEGUNDA, "00:00").getTime() + 7 * 86_400_000).toISOString();
    const res = await requisitar(
      "GET",
      `${AGENDAMENTOS}?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`,
      { cookie: c.admin.cookie },
    );
    expect(res.status).toBe(200);
  });

  it("o filtro opcional por profissional restringe a lista no escopo operacional", async () => {
    const c = await montarCenario();
    const um = await criar(c, { inicio: iso(SEGUNDA, "09:00"), fim: iso(SEGUNDA, "10:00") });
    await criar(c, {
      inicio: iso(SEGUNDA, "09:00"),
      fim: iso(SEGUNDA, "10:00"),
      profissionalId: c.profissional2Id,
      pacienteId: c.paciente2Id,
    });
    const janela = `de=${encodeURIComponent(iso(SEGUNDA, "00:00"))}&ate=${encodeURIComponent(iso(TERCA, "00:00"))}`;
    const res = await requisitar(
      "GET",
      `${AGENDAMENTOS}?${janela}&profissionalId=${c.profissionalId}`,
      { cookie: c.admin.cookie },
    );
    expect(res.body.map((a: { id: string }) => a.id)).toEqual([um.id]);
  });
});

// ---------------------------------------------------------------------------
// TA-19 — GET /agenda/opcoes
// ---------------------------------------------------------------------------

describe("TA-19 — GET /agenda/opcoes (D-AGD-13)", () => {
  it("devolve só ativos, sem preço, com a grade vigente e o fuso da clínica", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.servico.create({
        data: {
          clinicaId: c.clinicaId,
          nome: "Serviço Inativo",
          duracaoMin: 30,
          precoReferencia: "50.00",
          ativo: false,
          inativadoEm: new Date(),
        },
      });
      await tx.motivoCancelamento.create({
        data: {
          clinicaId: c.clinicaId,
          descricao: "Motivo Inativo",
          ativo: false,
          inativadoEm: new Date(),
        },
      });
    });

    const res = await requisitar("GET", "/agenda/opcoes", { cookie: c.admin.cookie });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "fusoHorario",
      "horarioFuncionamento",
      "motivosCancelamento",
      "servicos",
    ]);
    expect(res.body.servicos).toEqual([
      { id: c.servicoId, nome: "Fisioterapia Sintética", duracaoMin: 50 },
    ]);
    expect(res.body.motivosCancelamento).toEqual([{ id: c.motivoId, descricao: "Paciente desistiu" }]);
    expect(res.body.horarioFuncionamento).toEqual({
      janelas: [
        { diaSemana: DIA_GRADE, horaInicio: "08:00", horaFim: "12:00" },
        { diaSemana: DIA_GRADE, horaInicio: "14:00", horaFim: "18:00" },
      ],
    });
    expect(res.body.fusoHorario).toBe(FUSO);
    // Nenhum preço em lugar algum da resposta.
    expect(JSON.stringify(res.body)).not.toContain("preco");
    expect(JSON.stringify(res.body)).not.toContain("100.00");
  });

  it("catálogo sem motivo ativo devolve lista vazia — resposta legítima", async () => {
    const c = await montarCenario();
    await database.transacao(async (tx) => {
      await tx.$executeRaw`UPDATE motivo_cancelamento SET ativo = false, inativado_em = now()`;
    });
    const res = await requisitar("GET", "/agenda/opcoes", { cookie: c.admin.cookie });
    expect(res.status).toBe(200);
    expect(res.body.motivosCancelamento).toEqual([]);
  });

  it("sem clínica provisionada → 404 CLINICA_NAO_CONFIGURADA", async () => {
    const admin = await ator("ADMINISTRADOR");
    const res = await requisitar("GET", "/agenda/opcoes", { cookie: admin.cookie });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
  });

  it("NÃO amplia as rotas administrativas: /servicos continua exigindo clinica.configurar", async () => {
    const c = await montarCenario();
    const res = await requisitar("GET", "/servicos", { cookie: c.admin.cookie });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
  });
});

// ---------------------------------------------------------------------------
// Atomicidade — agendamento × histórico × auditoria
// ---------------------------------------------------------------------------

describe("Atomicidade da transação (D-AGD-09, D-AGD-10)", () => {
  it("falha na auditoria faz rollback do agendamento E do histórico", async () => {
    const c = await montarCenario();
    const espia = jest
      .spyOn(auditWriter, "registrar")
      .mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      const res = await requisitar("POST", AGENDAMENTOS, {
        cookie: c.admin.cookie,
        corpo: corpoCriacao(c),
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ erro: ERRO.FALHA_INTERNA });
    } finally {
      espia.mockRestore();
    }
    expect(await agendamentos()).toHaveLength(0);
    expect(await historicos()).toHaveLength(0);
    expect(await eventosDaAgenda()).toHaveLength(0);
  });

  it("falha na auditoria do cancelamento preserva o estado anterior por inteiro", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const espia = jest
      .spyOn(auditWriter, "registrar")
      .mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      const res = await requisitar("POST", `${AGENDAMENTOS}/${criado.id}/cancelamento`, {
        cookie: c.admin.cookie,
        corpo: { motivoCancelamentoId: c.motivoId },
      });
      expect(res.status).toBe(500);
    } finally {
      espia.mockRestore();
    }
    const linha = (await agendamentos())[0] as LinhaAgendamento;
    expect(linha.estado).toBe("AGENDADO");
    expect(linha.motivo_cancelamento_id).toBeNull();
    expect(linha.cancelado_em).toBeNull();
    expect(linha.cancelado_por_usuario_id).toBeNull();
    expect(await historicos()).toHaveLength(1);
    expect(await eventosDaAgenda()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Fronteira de AGD-A — nenhuma rota das fatias seguintes
// ---------------------------------------------------------------------------

describe("Fronteira da fatia (D-AGD-01, D-AGD-17)", () => {
  it("nenhuma rota de bloqueio, pacote, início ou conclusão responde", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    for (const caminho of [
      `${AGENDAMENTOS}/${criado.id}/atendimento`,
      "/bloqueios",
      "/agenda/bloqueios",
    ]) {
      const res = await requisitar("POST", caminho, { cookie: c.admin.cookie, corpo: {} });
      expect(res.status).toBe(404);
    }
  });

  it("agendamento nunca é removido — não existe DELETE em rota alguma da agenda", async () => {
    const c = await montarCenario();
    const criado = await criar(c);
    const res = await fetch(`${baseUrl}${AGENDAMENTOS}/${criado.id}`, {
      method: "DELETE",
      headers: { cookie: c.admin.cookie, [CABECALHO_REQUISICAO_TLF]: "1" },
    });
    expect(res.status).toBe(404);
    expect(await agendamentos()).toHaveLength(1);
  });
});
