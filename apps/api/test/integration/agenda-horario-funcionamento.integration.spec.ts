// TechLab Fisio — integração contra PostgreSQL REAL do verificador de RN-014,
// parcela da clínica (`docs/14` D-CFG-60, D-CFG-61, D-CFG-63).
//
// Runtime exclusivamente `tlf_app`; limpeza por TRUNCATE entre testes
// (setup-db.ts). Dados 100% sintéticos. A grade é gravada pelo serviço real de
// CFG-002 (mesmo caminho do `PUT /horario-funcionamento`).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";

import {
  ERRO_AGENDA,
  ErroForaDoHorarioFuncionamento,
  VerificadorHorarioFuncionamento,
} from "../../src/agenda/verificador-horario-funcionamento.js";
import { AppModule } from "../../src/app.module.js";
import { ErroClinica } from "../../src/clinica/clinica.service.js";
import { HorarioFuncionamentoService } from "../../src/clinica/horario-funcionamento.service.js";
import { DatabaseService } from "../../src/database/database.service.js";

let moduleRef: TestingModule;
let database: DatabaseService;
let horarios: HorarioFuncionamentoService;
const verificador = new VerificadorHorarioFuncionamento();

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  await moduleRef.init();
  database = moduleRef.get(DatabaseService);
  horarios = moduleRef.get(HorarioFuncionamentoService);
}, 180_000);

afterAll(async () => {
  await moduleRef.close();
});

const j = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });

/** 2026-09-21 é segunda-feira; São Paulo = UTC-03. */
const segundaSP = (inicio: string, fim: string) => ({
  inicio: new Date(`2026-09-21T${inicio}-03:00`),
  fim: new Date(`2026-09-21T${fim}-03:00`),
});

async function provisionar(fusoHorario = "America/Sao_Paulo"): Promise<string> {
  const clinicaId = await database.transacao(async (tx) => {
    const c = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética RN-014", fusoHorario },
      select: { id: true },
    });
    return c.id;
  });
  return clinicaId;
}

async function administradorId(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `rn014-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-rn014",
        nome: "Usuário Sintético RN-014",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

async function definirGrade(janelas: ReturnType<typeof j>[]): Promise<void> {
  await horarios.substituir({ atorUsuarioId: await administradorId(), janelas });
}

async function verificar(intervalo: { inicio: Date; fim: Date }): Promise<unknown> {
  try {
    await database.transacao((tx) => verificador.exigirConforme(tx, intervalo));
    return "CONFORME";
  } catch (erro) {
    return erro;
  }
}

async function contarEventos(): Promise<number> {
  const r = await database.transacao((tx) => tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM evento_auditoria`);
  return Number(r[0]?.n ?? 0);
}

describe("RN-014 — VerificadorHorarioFuncionamento com PostgreSQL real", () => {
  it("usa a grade persistida por CFG-002: dentro, bordas e almoço", async () => {
    await provisionar();
    await definirGrade([j(1, "08:00", "12:00"), j(1, "14:00", "18:00")]);

    expect(await verificar(segundaSP("08:00", "12:00"))).toBe("CONFORME");
    expect(await verificar(segundaSP("14:00", "18:00"))).toBe("CONFORME");

    const almoco = await verificar(segundaSP("11:30", "12:30"));
    expect(almoco).toBeInstanceOf(ErroForaDoHorarioFuncionamento);
    expect((almoco as ErroForaDoHorarioFuncionamento).codigo).toBe(ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO);
    expect((almoco as ErroForaDoHorarioFuncionamento).motivo).toBe("FORA_DAS_JANELAS");
  });

  it("grade vazia e dia sem janela rejeitam (D-CFG-58)", async () => {
    await provisionar();
    const vazia = await verificar(segundaSP("09:00", "10:00"));
    expect((vazia as ErroForaDoHorarioFuncionamento).motivo).toBe("DIA_SEM_JANELA");

    await definirGrade([j(2, "08:00", "18:00")]);
    const segunda = await verificar(segundaSP("09:00", "10:00"));
    expect((segunda as ErroForaDoHorarioFuncionamento).motivo).toBe("DIA_SEM_JANELA");
  });

  it("aplica o fuso vigente da clínica lido no banco (D-CFG-60, D-CFG-63)", async () => {
    const clinicaId = await provisionar("America/Sao_Paulo");
    await definirGrade([j(1, "08:00", "18:00")]);
    // 11:30Z–12:30Z: 08:30 em São Paulo (conforme); 07:30 em Manaus (fora).
    const intervalo = { inicio: new Date("2026-09-21T11:30:00Z"), fim: new Date("2026-09-21T12:30:00Z") };
    expect(await verificar(intervalo)).toBe("CONFORME");

    await database.transacao((tx) =>
      tx.$executeRaw`UPDATE clinica SET fuso_horario = 'America/Manaus' WHERE id = ${clinicaId}::uuid`,
    );
    expect((await verificar(intervalo)) as ErroForaDoHorarioFuncionamento).toBeInstanceOf(ErroForaDoHorarioFuncionamento);
  });

  it("nova grade vale para validações posteriores (D-CFG-63)", async () => {
    await provisionar();
    await definirGrade([j(1, "08:00", "16:00")]);
    expect(await verificar(segundaSP("17:00", "18:00"))).toBeInstanceOf(ErroForaDoHorarioFuncionamento);
    await definirGrade([j(1, "08:00", "18:00")]);
    expect(await verificar(segundaSP("17:00", "18:00"))).toBe("CONFORME");
  });

  it("sem linha de clínica: CLINICA_NAO_CONFIGURADA", async () => {
    const erro = await verificar(segundaSP("09:00", "10:00"));
    expect(erro).toBeInstanceOf(ErroClinica);
    expect((erro as ErroClinica).motivo).toBe("CLINICA_NAO_CONFIGURADA");
  });

  it("não escreve nem audita, em conformidade ou rejeição", async () => {
    await provisionar();
    await definirGrade([j(1, "08:00", "18:00")]);
    const antes = await contarEventos();
    await verificar(segundaSP("09:00", "10:00"));
    await verificar(segundaSP("19:00", "20:00"));
    expect(await contarEventos()).toBe(antes);
  });

  it("não bloqueia enquanto outra transação mantém FOR UPDATE em clinica (sem lock — D-CFG-61)", async () => {
    await provisionar();
    await definirGrade([j(1, "08:00", "18:00")]);

    let liberar!: () => void;
    const segurando = new Promise<void>((r) => {
      liberar = r;
    });
    let lockObtido!: () => void;
    const obtido = new Promise<void>((r) => {
      lockObtido = r;
    });
    const transacaoTravando = database.transacao(async (tx) => {
      await tx.$queryRaw`SELECT id FROM clinica FOR UPDATE`;
      lockObtido();
      await segurando;
    });
    await obtido;

    try {
      const resultado = await Promise.race([
        verificar(segundaSP("09:00", "10:00")),
        new Promise((r) => setTimeout(() => r("BLOQUEADO"), 3_000)),
      ]);
      expect(resultado).toBe("CONFORME");
    } finally {
      liberar();
      await transacaoTravando;
    }
  });
});
