// TechLab Fisio — provisionamento da linha única de `clinica` contra
// PostgreSQL REAL (fatia CFG-001B; `docs/14` D-CFG-01, D-CFG-09..D-CFG-12).
//
// Duas camadas:
//   1. SERVIÇO resolvido pelo contexto mínimo real (`BootstrapClinicaModule`),
//      para atomicidade (sabotagem do AuditWriter) e trilha;
//   2. CLI COMPILADO em processos reais (`dist/provisionamento/cli.js`), para
//      códigos de saída, fronteira de saída, concorrência entre processos e o
//      efeito observável em `GET /clinica`.
// Sem `dist/`, a camada 2 é PULADA de forma explícita.

import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../../src/app.module.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { POLITICA_COOKIE_SESSAO } from "../../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../../src/auth/politica-cookie.js";
import { SessaoService } from "../../src/auth/sessao.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { BootstrapClinicaModule } from "../../src/provisionamento/bootstrap-clinica.module.js";
import {
  BootstrapClinicaService,
  ErroBootstrapClinica,
} from "../../src/provisionamento/bootstrap-clinica.service.js";
import { urlObrigatoria } from "./helpers-integracao.js";

const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(RAIZ_API, "dist", "provisionamento", "cli.js");
const TEM_DIST = existsSync(CLI);

const NOME = "Clínica Sintética Provisionada";
const FUSO = "America/Sao_Paulo";
const JUSTIFICATIVA = "chamado SINTETICO-CFG-001B";

jest.setTimeout(180_000);

let moduloServico: TestingModule;
let servico: BootstrapClinicaService;
let database: DatabaseService;
let auditWriter: AuditWriter;

beforeAll(async () => {
  moduloServico = await Test.createTestingModule({ imports: [BootstrapClinicaModule] }).compile();
  await moduloServico.init();
  servico = moduloServico.get(BootstrapClinicaService);
  database = moduloServico.get(DatabaseService);
  auditWriter = moduloServico.get(AuditWriter);
}, 180_000);

afterAll(async () => {
  await moduloServico.close();
});

interface LinhaEvento {
  acao: string;
  ator_usuario_id: string | null;
  alvo_tipo: string;
  alvo_id: string | null;
  resultado: string;
  justificativa: string | null;
  contexto: unknown;
}

async function clinicas(): Promise<Array<{ id: string; nome_cadastral: string; fuso_horario: string; nome_operacional: string | null; email: string | null }>> {
  return database.transacao((tx) =>
    tx.$queryRaw`SELECT id, nome_cadastral, fuso_horario, nome_operacional, email FROM clinica`,
  );
}

async function eventos(): Promise<LinhaEvento[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaEvento[]>`
      SELECT acao, ator_usuario_id, alvo_tipo, alvo_id, resultado::text AS resultado,
             justificativa, contexto
        FROM evento_auditoria`,
  );
}

async function motivoDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof ErroBootstrapClinica) return erro.motivo;
    throw erro;
  }
  throw new Error("esperada recusa");
}

describe("CFG-001B — serviço contra PostgreSQL real", () => {
  it("CA-01 / CA-02: tabela vazia -> cria 1 linha e 1 evento (ator NULL, justificativa, contexto vazio)", async () => {
    const r = await servico.executar({ nomeCadastral: `  ${NOME}  `, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
    expect(r.desfecho).toBe("CLINICA_CRIADA");
    expect(r.correlacaoId).not.toBeNull();

    const linhas = await clinicas();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual({ id: r.clinicaId, nome_cadastral: NOME, fuso_horario: FUSO, nome_operacional: null, email: null });

    const trilha = await eventos();
    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({
      acao: "configuracao.alterada",
      ator_usuario_id: null,
      alvo_tipo: "clinica",
      alvo_id: r.clinicaId,
      resultado: "SUCESSO",
      justificativa: JUSTIFICATIVA,
    });
    const contexto = trilha[0]?.contexto;
    expect(contexto === null || JSON.stringify(contexto) === "{}").toBe(true);
  });

  it("CA-03: reexecução com os mesmos dados (após normalização) -> JA_CONFORME, sem escrita nem evento", async () => {
    const criada = await servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
    const r = await servico.executar({ nomeCadastral: ` ${NOME} `, fusoHorario: FUSO, justificativa: "outra justificativa" });
    expect(r).toEqual({ desfecho: "JA_CONFORME", clinicaId: criada.clinicaId, correlacaoId: null });
    expect(await clinicas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it.each([
    ["nome divergente", { nomeCadastral: "Outra Clínica", fusoHorario: FUSO }],
    ["fuso divergente", { nomeCadastral: NOME, fusoHorario: "UTC" }],
  ])("CA-04: %s -> CLINICA_JA_EXISTE, nada sobrescrito", async (_rotulo, dados) => {
    await servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
    const antes = await clinicas();
    expect(await motivoDe(servico.executar({ ...dados, justificativa: JUSTIFICATIVA }))).toBe("CLINICA_JA_EXISTE");
    expect(await clinicas()).toEqual(antes);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-04: clínica alterada por PUT (opcionais preenchidos) mas com mesmo nome/fuso continua JA_CONFORME", async () => {
    const criada = await servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
    await database.transacao((tx) => tx.$executeRaw`UPDATE clinica SET email = 'contato@clinica.exemplo'`);
    const r = await servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
    expect(r.desfecho).toBe("JA_CONFORME");
    expect((await clinicas())[0]?.email).toBe("contato@clinica.exemplo");
    expect(r.clinicaId).toBe(criada.clinicaId);
  });

  it("CA-07: falha na auditoria -> rollback conjunto (0 linhas, 0 eventos)", async () => {
    const espia = jest.spyOn(auditWriter, "registrar").mockRejectedValueOnce(new Error("FALHA_SIMULADA_AUDITORIA"));
    try {
      await expect(
        servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA }),
      ).rejects.toThrow("FALHA_SIMULADA_AUDITORIA");
    } finally {
      espia.mockRestore();
    }
    expect(await clinicas()).toHaveLength(0);
    expect(await eventos()).toHaveLength(0);
  });

  it("CA-08: criação concorrente perdida (23505) é decidida sobre o estado commitado — 1 linha, 1 evento", async () => {
    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let registrou!: () => void;
    const noAudit = new Promise<void>((r) => (registrou = r));

    // A primeira execução para DENTRO da transação, após o INSERT e antes do
    // commit: a linha existe mas não está visível para a concorrente.
    const original = auditWriter.registrar.bind(auditWriter);
    const espia = jest.spyOn(auditWriter, "registrar").mockImplementationOnce(async (tx, evento) => {
      registrou();
      await barreira;
      return original(tx, evento);
    });

    try {
      const primeira = servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
      await noAudit;
      // A concorrente não vê a linha (READ COMMITTED), tenta INSERT e bloqueia
      // no índice único até a primeira commitar; então recebe 23505.
      const segunda = servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
      await new Promise((r) => setTimeout(r, 300));
      liberar();
      const [r1, r2] = await Promise.all([primeira, segunda]);
      expect(r1.desfecho).toBe("CLINICA_CRIADA");
      expect(r2).toEqual({ desfecho: "JA_CONFORME", clinicaId: r1.clinicaId, correlacaoId: null });
    } finally {
      espia.mockRestore();
    }
    expect(await clinicas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-08: concorrente perdida com dados divergentes -> CLINICA_JA_EXISTE, sem sobrescrever", async () => {
    let liberar!: () => void;
    const barreira = new Promise<void>((r) => (liberar = r));
    let registrou!: () => void;
    const noAudit = new Promise<void>((r) => (registrou = r));
    const original = auditWriter.registrar.bind(auditWriter);
    const espia = jest.spyOn(auditWriter, "registrar").mockImplementationOnce(async (tx, evento) => {
      registrou();
      await barreira;
      return original(tx, evento);
    });
    try {
      const primeira = servico.executar({ nomeCadastral: NOME, fusoHorario: FUSO, justificativa: JUSTIFICATIVA });
      await noAudit;
      const segunda = motivoDe(servico.executar({ nomeCadastral: "Divergente", fusoHorario: FUSO, justificativa: JUSTIFICATIVA }));
      await new Promise((r) => setTimeout(r, 300));
      liberar();
      const [r1, m2] = await Promise.all([primeira, segunda]);
      expect(r1.desfecho).toBe("CLINICA_CRIADA");
      expect(m2).toBe("CLINICA_JA_EXISTE");
    } finally {
      espia.mockRestore();
    }
    expect((await clinicas())[0]?.nome_cadastral).toBe(NOME);
    expect(await eventos()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// CLI compilado
// ---------------------------------------------------------------------------

interface Execucao {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function ambiente(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: urlObrigatoria("DATABASE_URL"),
    TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL: NOME,
    TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: FUSO,
    TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA: JUSTIFICATIVA,
  };
  for (const [chave, valor] of Object.entries(extra)) {
    if (valor === undefined) delete base[chave];
    else base[chave] = valor;
  }
  return base;
}

function rodar(argumentos: readonly string[], env: Record<string, string | undefined> = {}): Execucao {
  const r = spawnSync(process.execPath, [CLI, ...argumentos], {
    cwd: RAIZ_API,
    env: ambiente(env),
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function rodarAssincrono(env: Record<string, string | undefined> = {}): Promise<Execucao> {
  return new Promise((resolver) => {
    const filho = spawn(process.execPath, [CLI, "bootstrap-clinica"], { cwd: RAIZ_API, env: ambiente(env) });
    let stdout = "";
    let stderr = "";
    filho.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    filho.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    filho.on("close", (status) => resolver({ status, stdout, stderr }));
  });
}

function semValores(r: Execucao): void {
  const saida = r.stdout + r.stderr;
  for (const proibido of [NOME, JUSTIFICATIVA, "Foo/Bar", "SELECT", "INSERT", "clinica_pkey", "ux_clinica_linha_unica"]) {
    expect(saida).not.toContain(proibido);
  }
}

const talvez = TEM_DIST ? describe : describe.skip;

talvez("CFG-001B — CLI compilado `bootstrap-clinica`", () => {
  it("CA-01 / CA-09: cria a clínica, saída 0, stdout só com desfecho/id/correlação", async () => {
    const r = rodar(["bootstrap-clinica"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^bootstrap-clinica: CLINICA_CRIADA · clinica=[0-9a-f-]{36} · correlacao=[0-9a-f-]{36}$/m);
    expect(r.stderr).toBe("");
    semValores(r);
    expect(await clinicas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-03: segunda execução idêntica -> JA_CONFORME, saída 0, sem escrita", async () => {
    expect(rodar(["bootstrap-clinica"]).status).toBe(0);
    const r = rodar(["bootstrap-clinica"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^bootstrap-clinica: JA_CONFORME · clinica=[0-9a-f-]{36}$/m);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-04: dados divergentes -> saída 1, CLINICA_JA_EXISTE, linha inalterada", async () => {
    expect(rodar(["bootstrap-clinica"]).status).toBe(0);
    const r = rodar(["bootstrap-clinica"], { TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: "UTC" });
    expect(r.status).toBe(1);
    expect(r.stderr).toBe("provisionamento: CLINICA_JA_EXISTE\n");
    semValores(r);
    expect((await clinicas())[0]?.fuso_horario).toBe(FUSO);
  });

  it.each([
    "TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL",
    "TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO",
    "TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA",
  ])("CA-05: %s ausente -> saída 1, nome da variável, nada escrito", async (variavel) => {
    const r = rodar(["bootstrap-clinica"], { [variavel]: undefined });
    expect(r.status).toBe(1);
    expect(r.stderr).toBe(`provisionamento: VARIAVEL_OBRIGATORIA_AUSENTE (${variavel})\n`);
    expect(await clinicas()).toHaveLength(0);
  });

  it.each([
    [{ TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: "Foo/Bar" }, "FUSO_HORARIO_INVALIDO"],
    [{ TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL: "a".repeat(201) }, "NOME_CADASTRAL_INVALIDO"],
  ])("CA-06: entrada inválida %p -> saída 1 e %s", async (env, esperado) => {
    const r = rodar(["bootstrap-clinica"], env);
    expect(r.status).toBe(1);
    expect(r.stderr).toBe(`provisionamento: ${esperado}\n`);
    semValores(r);
    expect(await clinicas()).toHaveLength(0);
  });

  it.each([
    [{ TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO: "Foo/Bar" }, "FUSO_HORARIO_INVALIDO"],
    [{ TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL: "a".repeat(201) }, "NOME_CADASTRAL_INVALIDO"],
    [{ TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA: "a\u0001b" }, "JUSTIFICATIVA_INVALIDA"],
  ])("entrada inválida %p é recusada ANTES de conectar: banco inalcançável ainda produz %s", (env, esperado) => {
    const r = rodar(["bootstrap-clinica"], {
      ...env,
      DATABASE_URL: "postgresql://tlf_app:x@127.0.0.1:1/banco_inexistente",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toBe(`provisionamento: ${esperado}\n`);
    expect(r.stdout).not.toContain("Starting Nest application");
  });

  it("D-CFG-12: `bootstrap-clinica` não aceita opções (nem --estrito) -> uso inválido (2)", async () => {
    for (const opcao of ["--estrito", "--nome=X"]) {
      const r = rodar(["bootstrap-clinica", opcao]);
      expect(r.status).toBe(2);
    }
    expect(await clinicas()).toHaveLength(0);
  });

  it("CA-08: N processos concorrentes -> 1 linha, 1 evento, nenhuma saída não controlada", async () => {
    const execucoes = await Promise.all(Array.from({ length: 5 }, () => rodarAssincrono()));
    for (const r of execucoes) {
      expect(r.status).toBe(0);
      expect(r.stderr).toBe("");
    }
    expect(execucoes.filter((r) => r.stdout.includes("CLINICA_CRIADA"))).toHaveLength(1);
    expect(execucoes.filter((r) => r.stdout.includes("JA_CONFORME"))).toHaveLength(4);
    expect(await clinicas()).toHaveLength(1);
    expect(await eventos()).toHaveLength(1);
  });

  it("CA-10: após o comando, GET /clinica autorizado passa de 404 para 200", async () => {
    const moduloApp = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app: INestApplication = moduloApp.createNestApplication();
    await app.init();
    await app.listen(0);
    try {
      const url = `${await app.getUrl()}/clinica`;
      const sessoes = moduloApp.get(SessaoService);
      const politica = moduloApp.get<PoliticaCookieSessao>(POLITICA_COOKIE_SESSAO);
      const bancoApp = moduloApp.get(DatabaseService);
      const usuarioId = await bancoApp.transacao(async (tx) => {
        const u = await tx.usuario.create({
          data: { email: `cfg001b-${randomUUID().slice(0, 8)}@sintetico.local`, senhaHash: "hash-sintetico", nome: "Admin Sintético", ativo: true },
          select: { id: true },
        });
        const papel = await tx.papel.create({ data: { codigo: `papel-${randomUUID().slice(0, 8)}`, nome: "Papel" }, select: { id: true } });
        const permissao = await tx.permissao.create({ data: { codigo: "clinica.configurar", nome: "clinica.configurar" }, select: { id: true } });
        await tx.papelPermissao.create({ data: { papelId: papel.id, permissaoId: permissao.id } });
        await tx.usuarioPapel.create({ data: { usuarioId: u.id, papelId: papel.id } });
        return u.id;
      });
      const emitida = await sessoes.emitir({ usuarioId });
      const headers = { cookie: `${politica.nome}=${emitida.token}` };

      expect((await fetch(url, { headers })).status).toBe(404);
      expect(rodar(["bootstrap-clinica"]).status).toBe(0);
      const res = await fetch(url, { headers });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ nomeCadastral: NOME, fusoHorario: FUSO, nomeOperacional: null });
    } finally {
      await app.close();
    }
  });
});
