// TechLab Fisio — integração contra PostgreSQL REAL do verificador de RN-014,
// parcela do profissional (`docs/16` D-PRO3-04, D-PRO3-05, D-PRO3-10). TD-11.
//
// Runtime exclusivamente `tlf_app`; limpeza por TRUNCATE entre testes
// (setup-db.ts). Dados 100% sintéticos. As versões são gravadas pelo serviço
// REAL de PRO-003 (mesmo caminho do `PUT .../disponibilidade`), de modo que o
// que a agenda lê é exatamente o que a fatia escreve.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";

import {
  ERRO_AGENDA,
  ErroForaDoHorarioFuncionamento,
  VerificadorHorarioFuncionamento,
} from "../../src/agenda/verificador-horario-funcionamento.js";
import {
  ErroForaDaDisponibilidade,
  VerificadorDisponibilidadeProfissional,
} from "../../src/agenda/verificador-disponibilidade-profissional.js";
import { AppModule } from "../../src/app.module.js";
import { ErroClinica } from "../../src/clinica/clinica.service.js";
import { HorarioFuncionamentoService } from "../../src/clinica/horario-funcionamento.service.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { DisponibilidadeService } from "../../src/profissional/disponibilidade.service.js";

let moduleRef: TestingModule;
let database: DatabaseService;
let disponibilidade: DisponibilidadeService;
let horarios: HorarioFuncionamentoService;
const verificador = new VerificadorDisponibilidadeProfissional();
const verificadorClinica = new VerificadorHorarioFuncionamento();

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  await moduleRef.init();
  database = moduleRef.get(DatabaseService);
  disponibilidade = moduleRef.get(DisponibilidadeService);
  horarios = moduleRef.get(HorarioFuncionamentoService);
}, 180_000);

afterAll(async () => {
  await moduleRef.close();
});

const j = (diaSemana: number, horaInicio: string, horaFim: string) => ({ diaSemana, horaInicio, horaFim });

/** 2026-09-21 é SEGUNDA-FEIRA; São Paulo = UTC-03 nessa data. */
const segundaSP = (inicio: string, fim: string) => ({
  inicio: new Date(`2026-09-21T${inicio}-03:00`),
  fim: new Date(`2026-09-21T${fim}-03:00`),
});

async function provisionarClinica(fusoHorario = "America/Sao_Paulo"): Promise<string> {
  return database.transacao(async (tx) => {
    const c = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética PRO-003/RN-014", fusoHorario },
      select: { id: true },
    });
    return c.id;
  });
}

async function criarProfissional(): Promise<string> {
  return database.transacao(async (tx) => {
    const p = await tx.profissional.create({
      data: { nome: "Profissional Sintético PRO-003", ativo: true },
      select: { id: true },
    });
    return p.id;
  });
}

async function usuarioId(): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `pro3rn-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-pro3rn",
        nome: "Usuário Sintético PRO-003/RN-014",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

/**
 * Semeia uma versão com vigência ARBITRÁRIA (inclusive passada), o que o `PUT`
 * deliberadamente não permite (D-PRO3-03, regra 1). É o único jeito de montar
 * o histórico que a agenda precisa consultar.
 */
async function semear(
  profissionalId: string,
  vigenciaInicio: string,
  vigenciaFim: string | null,
  janelas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }>,
): Promise<void> {
  await database.transacao(async (tx) => {
    for (const janela of janelas) {
      await tx.$executeRawUnsafe(
        `INSERT INTO disponibilidade_profissional
           (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
         VALUES ($1::uuid, $2::uuid, $3::smallint, $4::time, $5::time, $6::date, $7::date)`,
        randomUUID(),
        profissionalId,
        janela.diaSemana,
        janela.horaInicio,
        janela.horaFim,
        vigenciaInicio,
        vigenciaFim,
      );
    }
  });
}

async function verificar(profissionalId: string, intervalo: { inicio: Date; fim: Date }): Promise<unknown> {
  try {
    await database.transacao((tx) => verificador.exigirDisponivel(tx, profissionalId, intervalo));
    return "DISPONIVEL";
  } catch (erro) {
    return erro;
  }
}

async function contarEventos(): Promise<number> {
  const r = await database.transacao((tx) => tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM evento_auditoria`);
  return Number(r[0]?.n ?? 0);
}

describe("TD-11 — VerificadorDisponibilidadeProfissional com PostgreSQL real", () => {
  it("usa a versão persistida pelo serviço REAL de PRO-003: dentro, bordas e intervalo", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    // O `PUT` real exige vigência não retroativa: uma versão aberta iniciada
    // hoje cobre 2026-09-21 se hoje <= 21/09/2026; para não depender disso, a
    // vigência de teste é semeada com data anterior.
    await semear(profissionalId, "2026-01-01", null, [j(1, "08:00", "12:00"), j(1, "13:00", "18:00")]);

    expect(await verificar(profissionalId, segundaSP("09:00", "10:00"))).toBe("DISPONIVEL");
    // Bordas exatas.
    expect(await verificar(profissionalId, segundaSP("08:00", "12:00"))).toBe("DISPONIVEL");
    // Atravessa o intervalo entre janelas: janelas NUNCA são somadas.
    const cruzando = await verificar(profissionalId, segundaSP("11:30", "13:30"));
    expect(cruzando).toBeInstanceOf(ErroForaDaDisponibilidade);
    expect((cruzando as ErroForaDaDisponibilidade).codigo).toBe(ERRO_AGENDA.FORA_DA_DISPONIBILIDADE);
  });

  it("o serviço real de PRO-003 alimenta o verificador (mesmo caminho do PUT)", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    // Vigência futura distante, avaliada num instante dentro dela.
    await disponibilidade.substituir(profissionalId, {
      vigenciaInicio: "2030-01-01",
      janelas: [j(2, "08:00", "12:00")],
    });
    // 2030-01-08 é uma TERÇA-FEIRA.
    const terca = { inicio: new Date("2030-01-08T09:00:00-03:00"), fim: new Date("2030-01-08T10:00:00-03:00") };
    expect(await verificar(profissionalId, terca)).toBe("DISPONIVEL");
  });

  it("data coberta pela versão ENCERRADA é avaliada por ela, não pela aberta", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", "2026-09-30", [j(1, "07:00", "11:00")]);
    await semear(profissionalId, "2026-10-01", null, [j(1, "14:00", "18:00")]);

    // 2026-09-21 cai na versão ENCERRADA: 07:00–11:00 vale; 14:00–18:00 não.
    expect(await verificar(profissionalId, segundaSP("08:00", "09:00"))).toBe("DISPONIVEL");
    expect(await verificar(profissionalId, segundaSP("15:00", "16:00"))).toBeInstanceOf(ErroForaDaDisponibilidade);

    // 2026-10-05 (segunda) cai na ABERTA: o inverso.
    const outubro = (inicio: string, fim: string) => ({
      inicio: new Date(`2026-10-05T${inicio}-03:00`),
      fim: new Date(`2026-10-05T${fim}-03:00`),
    });
    expect(await verificar(profissionalId, outubro("15:00", "16:00"))).toBe("DISPONIVEL");
    expect(await verificar(profissionalId, outubro("08:00", "09:00"))).toBeInstanceOf(ErroForaDaDisponibilidade);
  });

  it("APÓS o fim da última versão (sem sucessora): sem versão aplicável", async () => {
    // Discriminante de `vigencia_fim`: a versão começou ANTES da data e é a de
    // maior `vigencia_inicio`; só o fim a exclui. Ignorá-lo daria "disponível".
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", "2026-06-30", [j(1, "08:00", "12:00")]);
    const erro = await verificar(profissionalId, segundaSP("09:00", "10:00"));
    expect(erro).toBeInstanceOf(ErroForaDaDisponibilidade);
    expect((erro as ErroForaDaDisponibilidade).motivo).toBe("SEM_VERSAO_APLICAVEL");
  });

  it("LACUNA entre duas versões: sem versão aplicável, mesmo havendo versão futura", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", "2026-06-30", [j(1, "08:00", "12:00")]);
    await semear(profissionalId, "2026-11-01", null, [j(1, "08:00", "12:00")]);
    const erro = await verificar(profissionalId, segundaSP("09:00", "10:00"));
    expect(erro).toBeInstanceOf(ErroForaDaDisponibilidade);
    expect((erro as ErroForaDaDisponibilidade).motivo).toBe("SEM_VERSAO_APLICAVEL");
  });

  it("SEM versão alguma: fail-closed, nunca 'sempre disponível' (D-PRO3-10)", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    const erro = await verificar(profissionalId, segundaSP("09:00", "10:00"));
    expect(erro).toBeInstanceOf(ErroForaDaDisponibilidade);
    expect((erro as ErroForaDaDisponibilidade).motivo).toBe("SEM_VERSAO_APLICAVEL");
  });

  it("data ANTERIOR à primeira vigência: sem versão aplicável", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-10-01", null, [j(1, "08:00", "12:00")]);
    const erro = await verificar(profissionalId, segundaSP("09:00", "10:00"));
    expect(erro).toBeInstanceOf(ErroForaDaDisponibilidade);
    expect((erro as ErroForaDaDisponibilidade).motivo).toBe("SEM_VERSAO_APLICAVEL");
  });

  it("dia local SEM janela e horário fora das janelas são rejeitados", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", null, [j(1, "08:00", "12:00")]);
    // 2026-09-22 é terça — a versão não tem janela nesse dia.
    const terca = { inicio: new Date("2026-09-22T09:00:00-03:00"), fim: new Date("2026-09-22T10:00:00-03:00") };
    expect((await verificar(profissionalId, terca) as ErroForaDaDisponibilidade).motivo).toBe("DIA_SEM_JANELA");
    expect((await verificar(profissionalId, segundaSP("13:00", "14:00")) as ErroForaDaDisponibilidade).motivo).toBe(
      "FORA_DAS_JANELAS",
    );
  });

  it("dia local DIFERENTE do dia UTC: tanto a versão quanto a janela usam o dia LOCAL", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    // Versão ENCERRADA em 2026-09-30, com janela de quarta à noite.
    // 2026-09-30 é uma QUARTA-FEIRA (diaSemana 3).
    await semear(profissionalId, "2026-01-01", "2026-09-30", [j(3, "22:00", "23:59")]);
    await semear(profissionalId, "2026-10-01", null, [j(4, "08:00", "12:00")]);

    // 2026-10-01T01:00Z–02:00Z = 2026-09-30 22:00–23:00 em São Paulo.
    // Pela data UTC seria 01/10 (versão aberta, quinta) e nada casaria.
    const virada = { inicio: new Date("2026-10-01T01:00:00Z"), fim: new Date("2026-10-01T02:00:00Z") };
    expect(await verificar(profissionalId, virada)).toBe("DISPONIVEL");
  });

  it("início e fim em dias civis LOCAIS distintos são rejeitados", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", null, [j(1, "23:00", "23:59"), j(2, "00:00", "01:00")]);
    const virada = {
      inicio: new Date("2026-09-21T23:30:00-03:00"),
      fim: new Date("2026-09-22T00:30:00-03:00"),
    };
    expect((await verificar(profissionalId, virada) as ErroForaDaDisponibilidade).motivo).toBe(
      "ATRAVESSA_MEIA_NOITE_LOCAL",
    );
  });

  it("sem linha de clínica: CLINICA_NAO_CONFIGURADA (o fuso vem dela)", async () => {
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", null, [j(1, "08:00", "12:00")]);
    expect(await verificar(profissionalId, segundaSP("09:00", "10:00"))).toBeInstanceOf(ErroClinica);
  });

  it("isolamento entre profissionais: a versão de um não vale para o outro", async () => {
    await provisionarClinica();
    const a = await criarProfissional();
    const b = await criarProfissional();
    await semear(a, "2026-01-01", null, [j(1, "08:00", "12:00")]);
    expect(await verificar(a, segundaSP("09:00", "10:00"))).toBe("DISPONIVEL");
    expect(await verificar(b, segundaSP("09:00", "10:00"))).toBeInstanceOf(ErroForaDaDisponibilidade);
  });

  it("D-CFG-62 — as duas camadas são INDEPENDENTES e avaliadas em sequência", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    // Clínica 09:00–17:00 na segunda; profissional 06:00–22:00 na segunda.
    await horarios.substituir({ atorUsuarioId: await usuarioId(), janelas: [j(1, "09:00", "17:00")] });
    await semear(profissionalId, "2026-01-01", null, [j(1, "06:00", "22:00")]);

    const cedo = segundaSP("07:00", "08:00");
    // A disponibilidade do profissional aceita...
    expect(await verificar(profissionalId, cedo)).toBe("DISPONIVEL");
    // ...e a contenção na clínica é quem rejeita, com o SEU código.
    let erroClinica: unknown = "CONFORME";
    try {
      await database.transacao((tx) => verificadorClinica.exigirConforme(tx, cedo));
    } catch (e) {
      erroClinica = e;
    }
    expect(erroClinica).toBeInstanceOf(ErroForaDoHorarioFuncionamento);
    expect((erroClinica as ErroForaDoHorarioFuncionamento).codigo).toBe(ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO);

    // No horário coberto pelas duas, ambas aprovam.
    const comum = segundaSP("10:00", "11:00");
    expect(await verificar(profissionalId, comum)).toBe("DISPONIVEL");
    await expect(database.transacao((tx) => verificadorClinica.exigirConforme(tx, comum))).resolves.toBeUndefined();
  });

  it("a verificação NÃO escreve nada: nenhum evento de auditoria e nenhuma linha nova", async () => {
    await provisionarClinica();
    const profissionalId = await criarProfissional();
    await semear(profissionalId, "2026-01-01", null, [j(1, "08:00", "12:00")]);
    const antes = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM disponibilidade_profissional`,
    );
    await verificar(profissionalId, segundaSP("09:00", "10:00"));
    await verificar(profissionalId, segundaSP("19:00", "20:00"));
    const depois = await database.transacao((tx) =>
      tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM disponibilidade_profissional`,
    );
    expect(Number(depois[0]?.n ?? 0)).toBe(Number(antes[0]?.n ?? 0));
    expect(await contarEventos()).toBe(0);
  });
});
