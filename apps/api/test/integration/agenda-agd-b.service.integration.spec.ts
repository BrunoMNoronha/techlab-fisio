import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AgendamentosService, ErroAgendamento } from "../../src/agenda/agendamentos.service.js";
import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/database.service.js";

let moduleRef: TestingModule;
let app: INestApplication;
let database: DatabaseService;
let agendamentos: AgendamentosService;

jest.setTimeout(120_000);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  database = moduleRef.get(DatabaseService);
  agendamentos = moduleRef.get(AgendamentosService);
}, 180_000);

afterAll(async () => {
  await app.close();
});

const FUSO = "America/Sao_Paulo";
const INEXISTENTE = "0191f5a0-0000-7000-8000-000000000000";

function partesLocais(instante: Date): { data: string } {
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
  };
}

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

function instanteLocal(dataLocal: string, hora: string): Date {
  const ingenuo = new Date(`${dataLocal}T${hora}:00.000Z`);
  const aproximado = new Date(ingenuo.getTime() - deslocamento(ingenuo));
  return new Date(ingenuo.getTime() - deslocamento(aproximado));
}

interface Cenario {
  pacienteId: string;
  profissionalAId: string;
  profissionalBId: string;
  servicoId: string;
}

async function criarUsuario(prefixo: string): Promise<string> {
  return database.transacao(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        email: `${prefixo}-${randomUUID().slice(0, 8)}@sintetico.local`,
        senhaHash: "hash-sintetico-agd-b",
        nome: "Usuário Sintético AGD-B",
        ativo: true,
      },
      select: { id: true },
    });
    return u.id;
  });
}

async function darPermissaoPorPapel(
  usuarioId: string,
  codigoPapel: string,
  codigoPermissao: string,
): Promise<void> {
  await database.transacao(async (tx) => {
    const papelExistente = await tx.papel.findUnique({ where: { codigo: codigoPapel }, select: { id: true } });
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

async function montarCenario(): Promise<Cenario> {
  return database.transacao(async (tx) => {
    const clinica = await tx.clinica.create({
      data: { nomeCadastral: "Clínica Sintética AGD-B", fusoHorario: FUSO },
      select: { id: true },
    });

    const servico = await tx.servico.create({
      data: {
        clinicaId: clinica.id,
        nome: "Fisioterapia AGD-B",
        duracaoMin: 50,
        precoReferencia: "100.00",
        ativo: true,
      },
      select: { id: true },
    });

    const profissionalA = await tx.profissional.create({
      data: { nome: "Profissional A", ativo: true },
      select: { id: true },
    });
    const profissionalB = await tx.profissional.create({
      data: { nome: "Profissional B", ativo: true },
      select: { id: true },
    });
    await tx.profissionalServico.createMany({
      data: [
        { profissionalId: profissionalA.id, servicoId: servico.id },
        { profissionalId: profissionalB.id, servicoId: servico.id },
      ],
    });

    const paciente = await tx.paciente.create({
      data: { nome: "Paciente AGD-B", ativo: true },
      select: { id: true },
    });

    return {
      pacienteId: paciente.id,
      profissionalAId: profissionalA.id,
      profissionalBId: profissionalB.id,
      servicoId: servico.id,
    };
  });
}

async function vincularProfissionalAoUsuario(profissionalId: string, usuarioId: string): Promise<void> {
  await database.transacao((tx) =>
    tx.$executeRaw`UPDATE profissional SET usuario_id = ${usuarioId}::uuid WHERE id = ${profissionalId}::uuid`,
  );
}

async function criarAgendamento(
  c: Cenario,
  opcoes: {
    estado: "AGENDADO" | "CONFIRMADO";
    profissionalId?: string;
    inicio?: Date;
    criadoPorUsuarioId: string;
  },
): Promise<string> {
  const inicio = opcoes.inicio ?? new Date(Date.now() + 3_600_000);
  const fim = new Date(inicio.getTime() + 50 * 60_000);
  return database.transacao(async (tx) => {
    const a = await tx.agendamento.create({
      data: {
        pacienteId: c.pacienteId,
        profissionalId: opcoes.profissionalId ?? c.profissionalAId,
        servicoId: c.servicoId,
        inicio,
        fim,
        estado: opcoes.estado,
        modalidade: "AVULSO",
        criadoPorUsuarioId: opcoes.criadoPorUsuarioId,
      },
      select: { id: true },
    });
    return a.id;
  });
}

interface LinhaHistorico {
  agendamento_id: string;
  operacao: string;
  estado_anterior: string | null;
  estado_novo: string | null;
  ator_usuario_id: string;
}

async function historicosDoAgendamento(agendamentoId: string): Promise<LinhaHistorico[]> {
  return database.transacao((tx) =>
    tx.$queryRaw<LinhaHistorico[]>`
      SELECT agendamento_id, operacao, estado_anterior::text AS estado_anterior,
             estado_novo::text AS estado_novo, ator_usuario_id
        FROM historico_agendamento
       WHERE agendamento_id = ${agendamentoId}::uuid
       ORDER BY ocorrido_em, id`,
  );
}

async function estadoAtual(agendamentoId: string): Promise<string> {
  const linhas = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ estado: string }>>`
      SELECT estado::text AS estado FROM agendamento WHERE id = ${agendamentoId}::uuid`,
  );
  return (linhas[0] as { estado: string }).estado;
}

async function totalEventosAgenda(): Promise<number> {
  const linhas = await database.transacao((tx) =>
    tx.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total FROM evento_auditoria WHERE acao LIKE 'agendamento.%'`,
  );
  return Number(linhas[0]?.total ?? 0n);
}

describe("AGD-B — check-in/falta transacionais no serviço", () => {
  it("check-in usa a permissão efetiva (agenda.checkin), não agenda.gerenciar, para resolver escopo", async () => {
    const c = await montarCenario();
    const atorOperacional = await criarUsuario("operacional-checkin");
    await darPermissaoPorPapel(atorOperacional, "ADMINISTRADOR", "agenda.checkin");
    const criador = await criarUsuario("criador-checkin");
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      profissionalId: c.profissionalBId,
      criadoPorUsuarioId: criador,
    });

    const resultado = await agendamentos.checkin({
      atorUsuarioId: atorOperacional,
      agendamentoId,
    });

    expect(resultado.mutacaoExecutada).toBe(true);
    expect(resultado.agendamento.estado).toBe("AGUARDANDO");
    expect(await estadoAtual(agendamentoId)).toBe("AGUARDANDO");
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("inexistente e fora do escopo são indistinguíveis (404 lógico)", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("fisioterapeuta-checkin");
    await darPermissaoPorPapel(atorId, "FISIOTERAPEUTA", "agenda.checkin");
    await vincularProfissionalAoUsuario(c.profissionalAId, atorId);

    const criador = await criarUsuario("criador-fora-escopo");
    const foraDoEscopo = await criarAgendamento(c, {
      estado: "AGENDADO",
      profissionalId: c.profissionalBId,
      criadoPorUsuarioId: criador,
    });

    await expect(agendamentos.checkin({ atorUsuarioId: atorId, agendamentoId: INEXISTENTE })).rejects.toMatchObject({
      motivo: "AGENDAMENTO_NAO_ENCONTRADO",
    });
    await expect(agendamentos.checkin({ atorUsuarioId: atorId, agendamentoId: foraDoEscopo })).rejects.toMatchObject({
      motivo: "AGENDAMENTO_NAO_ENCONTRADO",
    });
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("check-in fora da data civil local rejeita com FORA_DA_JANELA_TEMPORAL sem mutação", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("janela-checkin");
    await darPermissaoPorPapel(atorId, "ADMINISTRADOR", "agenda.checkin");
    const criador = await criarUsuario("criador-janela-checkin");
    const ontem = new Date(Date.now() - 24 * 60 * 60_000);
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: criador,
      inicio: ontem,
    });

    await expect(agendamentos.checkin({ atorUsuarioId: atorId, agendamentoId })).rejects.toMatchObject({
      motivo: "FORA_DA_JANELA_TEMPORAL",
    });
    expect(await estadoAtual(agendamentoId)).toBe("AGENDADO");
    expect(await historicosDoAgendamento(agendamentoId)).toHaveLength(0);
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("falta antes do início rejeita com FORA_DA_JANELA_TEMPORAL sem mutação", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("janela-falta");
    await darPermissaoPorPapel(atorId, "ADMINISTRADOR", "agenda.falta");
    const criador = await criarUsuario("criador-janela-falta");
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: criador,
      inicio: new Date(Date.now() + 60 * 60_000),
    });

    await expect(agendamentos.falta({ atorUsuarioId: atorId, agendamentoId })).rejects.toMatchObject({
      motivo: "FORA_DA_JANELA_TEMPORAL",
    });
    expect(await estadoAtual(agendamentoId)).toBe("AGENDADO");
    expect(await historicosDoAgendamento(agendamentoId)).toHaveLength(0);
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("se a gravação do histórico falha após o update, a transação faz rollback integral", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("rollback-checkin");
    await darPermissaoPorPapel(atorId, "ADMINISTRADOR", "agenda.checkin");
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: atorId,
    });
    const transacaoOriginal = database.transacao.bind(database);
    const espia = jest.spyOn(database, "transacao").mockImplementationOnce(async (corpo) =>
      transacaoOriginal((tx) => {
        const txComFalha = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === "historicoAgendamento") {
              return new Proxy(Reflect.get(target, prop, receiver) as object, {
                get(modelo, modelProp, modelReceiver) {
                  if (modelProp === "create") {
                    return async () => {
                      throw new Error("FALHA_SIMULADA_HISTORICO");
                    };
                  }
                  return Reflect.get(modelo, modelProp, modelReceiver);
                },
              });
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        return corpo(txComFalha);
      }),
    );
    try {
      await expect(
        agendamentos.checkin({
          atorUsuarioId: atorId,
          agendamentoId,
        }),
      ).rejects.toThrow("FALHA_SIMULADA_HISTORICO");
    } finally {
      espia.mockRestore();
    }

    expect(await estadoAtual(agendamentoId)).toBe("AGENDADO");
    expect(await historicosDoAgendamento(agendamentoId)).toHaveLength(0);
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("concorrência check-in × check-in: uma transação vence e a outra falha com TRANSICAO_INVALIDA", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("conc-checkin-a");
    await darPermissaoPorPapel(atorId, "ADMINISTRADOR", "agenda.checkin");
    const criador = await criarUsuario("criador-conc-checkin");
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: criador,
    });

    const [r1, r2] = await Promise.allSettled([
      agendamentos.checkin({ atorUsuarioId: atorId, agendamentoId }),
      agendamentos.checkin({ atorUsuarioId: atorId, agendamentoId }),
    ]);

    const sucessos = [r1, r2].filter((r) => r.status === "fulfilled");
    const falhas = [r1, r2].filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect((falhas[0] as PromiseRejectedResult).reason).toMatchObject({
      motivo: "TRANSICAO_INVALIDA",
    } as Partial<ErroAgendamento>);

    const historico = await historicosDoAgendamento(agendamentoId);
    expect(historico).toHaveLength(1);
    expect(historico[0]?.operacao).toBe("CHECKIN");
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("concorrência falta × falta: uma transação vence e a outra falha com TRANSICAO_INVALIDA", async () => {
    const c = await montarCenario();
    const atorId = await criarUsuario("conc-falta-a");
    await darPermissaoPorPapel(atorId, "ADMINISTRADOR", "agenda.falta");
    const criador = await criarUsuario("criador-conc-falta");
    const hoje = partesLocais(new Date()).data;
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: criador,
      inicio: instanteLocal(hoje, "00:00"),
    });

    const [r1, r2] = await Promise.allSettled([
      agendamentos.falta({ atorUsuarioId: atorId, agendamentoId }),
      agendamentos.falta({ atorUsuarioId: atorId, agendamentoId }),
    ]);

    const sucessos = [r1, r2].filter((r) => r.status === "fulfilled");
    const falhas = [r1, r2].filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect((falhas[0] as PromiseRejectedResult).reason).toMatchObject({
      motivo: "TRANSICAO_INVALIDA",
    } as Partial<ErroAgendamento>);

    const historico = await historicosDoAgendamento(agendamentoId);
    expect(historico).toHaveLength(1);
    expect(historico[0]?.operacao).toBe("FALTA");
    expect(await totalEventosAgenda()).toBe(0);
  });

  it("concorrência check-in × falta: ambas elegíveis, uma vence e a outra falha com TRANSICAO_INVALIDA", async () => {
    const c = await montarCenario();
    const atorCheckin = await criarUsuario("conc-mista-checkin");
    const atorFalta = await criarUsuario("conc-mista-falta");
    await darPermissaoPorPapel(atorCheckin, "ADMINISTRADOR", "agenda.checkin");
    await darPermissaoPorPapel(atorFalta, "ADMINISTRADOR", "agenda.falta");
    const criador = await criarUsuario("criador-conc-mista");
    const hoje = partesLocais(new Date()).data;
    const agendamentoId = await criarAgendamento(c, {
      estado: "AGENDADO",
      criadoPorUsuarioId: criador,
      inicio: instanteLocal(hoje, "00:00"),
    });

    const [r1, r2] = await Promise.allSettled([
      agendamentos.checkin({ atorUsuarioId: atorCheckin, agendamentoId }),
      agendamentos.falta({ atorUsuarioId: atorFalta, agendamentoId }),
    ]);

    const sucessos = [r1, r2].filter((r) => r.status === "fulfilled");
    const falhas = [r1, r2].filter((r) => r.status === "rejected");
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect((falhas[0] as PromiseRejectedResult).reason).toMatchObject({
      motivo: "TRANSICAO_INVALIDA",
    } as Partial<ErroAgendamento>);

    const historico = await historicosDoAgendamento(agendamentoId);
    expect(historico).toHaveLength(1);
    expect(["CHECKIN", "FALTA"]).toContain(historico[0]?.operacao);
    expect(await totalEventosAgenda()).toBe(0);
  });
});
