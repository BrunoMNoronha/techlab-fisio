// TechLab Fisio — E-12 — Testes permanentes do mapeamento de erro por
// constraint (decisão C-6; verificação V-03; docs/07 §16.4, §18 C-01/C-04).
//
// EXECUÇÃO: este arquivo foi PREPARADO na E-12 e pertence à infraestrutura
// formal de testes de integração que a E-13 criará (Jest 30 + ESM + PostgreSQL
// real — docs/08 §13 `E-13`, verificação V-05). Ele NÃO foi executado pelo
// Jest durante a E-12, porque o Jest ainda não existe no workspace — a
// evidência empírica equivalente da E-12 foi produzida por probe transitório
// (removido), registrado na revisão de execução da E-12 em docs/08.
//
// SEM MOCKS: constraints só se testam no banco (docs/08 §13 `E-13`). Todos os
// cenários rodam contra o PostgreSQL real, dentro de transações interativas
// SEMPRE revertidas por sentinela — nenhum dado sintético persiste.
// Fixtures 100% sintéticos (TLF-BASE-V1 §10).

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client.js";
import {
  CONSTRAINT_CONSUMO_UNICO,
  ehConflitoAgenda,
  ehConsumoDuplicado,
  identificarViolacao,
} from "../src/errors/constraint-map.js";

type Tx = Prisma.TransactionClient;

let prisma: PrismaClient;

beforeAll(() => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ausente — testes de integração exigem o PostgreSQL real.");
  }
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Sentinela que derruba a transação inteira ao final de cada cenário. */
class RollbackSentinel extends Error {}

interface Fixtures {
  usuarioId: string;
  servicoId: string;
  profissionalId: string;
  paciente1Id: string;
  paciente2Id: string;
}

async function setupFixtures(tx: Tx): Promise<Fixtures> {
  const sufixo = randomUUID().slice(0, 8);
  const usuario = await tx.usuario.create({
    data: {
      email: `spec-e12-${sufixo}@sintetico.local`,
      senhaHash: "hash-sintetico-spec",
      nome: "Usuário Sintético Spec",
      ativo: true,
    },
  });
  const clinica = await tx.clinica.create({
    data: { nomeCadastral: "Clínica Sintética Spec", fusoHorario: "America/Sao_Paulo" },
  });
  const servico = await tx.servico.create({
    data: {
      clinicaId: clinica.id,
      nome: "Serviço Sintético Spec",
      duracaoMin: 60,
      precoReferencia: "100.00",
      ativo: true,
    },
  });
  const profissional = await tx.profissional.create({
    data: { nome: "Profissional Sintético Spec", ativo: true },
  });
  const paciente1 = await tx.paciente.create({
    data: { nome: "Paciente Sintético Um Spec", ativo: true },
  });
  const paciente2 = await tx.paciente.create({
    data: { nome: "Paciente Sintético Dois Spec", ativo: true },
  });
  return {
    usuarioId: usuario.id,
    servicoId: servico.id,
    profissionalId: profissional.id,
    paciente1Id: paciente1.id,
    paciente2Id: paciente2.id,
  };
}

/** Executa o cenário numa transação SEMPRE revertida — zero resíduo. */
async function emTransacaoRevertida(
  corpo: (tx: Tx, f: Fixtures) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const f = await setupFixtures(tx);
      await corpo(tx, f);
      throw new RollbackSentinel();
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }
}

function criarAgendamento(
  tx: Tx,
  f: Fixtures,
  opts: { pacienteId: string; inicio: string; fim: string },
) {
  return tx.agendamento.create({
    data: {
      pacienteId: opts.pacienteId,
      profissionalId: f.profissionalId,
      servicoId: f.servicoId,
      inicio: new Date(opts.inicio),
      fim: new Date(opts.fim),
      estado: "AGENDADO",
      modalidade: "AVULSO",
      criadoPorUsuarioId: f.usuarioId,
    },
  });
}

async function criarAtendimentoComPacote(tx: Tx, f: Fixtures) {
  const agendamento = await criarAgendamento(tx, f, {
    pacienteId: f.paciente1Id,
    inicio: "2026-09-01T13:00:00Z",
    fim: "2026-09-01T14:00:00Z",
  });
  const atendimento = await tx.atendimento.create({
    data: {
      agendamentoId: agendamento.id,
      pacienteId: f.paciente1Id,
      iniciadoEm: new Date("2026-09-01T13:05:00Z"),
    },
  });
  const pacote = await tx.pacote.create({
    data: {
      pacienteId: f.paciente1Id,
      servicoId: f.servicoId,
      quantidadeContratada: 10,
      dataContratacao: new Date("2026-09-01"),
      criadoPorUsuarioId: f.usuarioId,
    },
  });
  return { atendimento, pacote };
}

function criarConsumo(
  tx: Tx,
  f: Fixtures,
  dados: { pacoteId: string; atendimentoId: string },
) {
  return tx.movimentoSessao.create({
    data: {
      pacoteId: dados.pacoteId,
      tipo: "CONSUMO",
      quantidade: 1,
      atendimentoId: dados.atendimentoId,
      usuarioResponsavelId: f.usuarioId,
    },
  });
}

/**
 * Padrão de escrita de docs/07 §16.4, na forma exigida pelo fato medido em
 * V-03: dentro de transação, a violação aborta a transação PostgreSQL
 * (25P02); o INSERT de consumo é portanto protegido por SAVEPOINT para que a
 * tradução em sucesso idempotente possa prosseguir na MESMA transação (T-02).
 */
async function registrarConsumoIdempotente(
  tx: Tx,
  f: Fixtures,
  dados: { pacoteId: string; atendimentoId: string },
): Promise<{ inseriuAgora: boolean; movimentoId: string }> {
  await tx.$executeRaw`SAVEPOINT sp_consumo`;
  try {
    const criado = await criarConsumo(tx, f, dados);
    await tx.$executeRaw`RELEASE SAVEPOINT sp_consumo`;
    return { inseriuAgora: true, movimentoId: criado.id };
  } catch (erro) {
    if (!ehConsumoDuplicado(erro)) throw erro; // desconhecido: propaga
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT sp_consumo`;
    const existente = await tx.movimentoSessao.findFirstOrThrow({
      where: { pacoteId: dados.pacoteId, atendimentoId: dados.atendimentoId, tipo: "CONSUMO" },
    });
    return { inseriuAgora: false, movimentoId: existente.id };
  }
}

async function capturarErro(acao: () => Promise<unknown>): Promise<unknown> {
  try {
    await acao();
  } catch (erro) {
    return erro;
  }
  throw new Error("a violação esperada não ocorreu");
}

describe("constraint-map — identificação das quatro classes medidas em V-03", () => {
  it("identifica violação de UNIQUE parcial (consumo único, U-03/IDX-M2)", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      const { atendimento, pacote } = await criarAtendimentoComPacote(tx, f);
      await criarConsumo(tx, f, { pacoteId: pacote.id, atendimentoId: atendimento.id });
      const erro = await capturarErro(() =>
        criarConsumo(tx, f, { pacoteId: pacote.id, atendimentoId: atendimento.id }),
      );
      const v = identificarViolacao(erro);
      expect(v).not.toBeNull();
      expect(v?.classe).toBe("UNIQUE");
      expect(v?.sqlstate).toBe("23505");
      expect(v?.codigoPrisma).toBe("P2002");
      expect(v?.constraint).toBe(CONSTRAINT_CONSUMO_UNICO);
    });
  });

  it("identifica violação de CHECK (ck_paciente_cpf_formato)", async () => {
    await emTransacaoRevertida(async (tx) => {
      const erro = await capturarErro(() =>
        tx.paciente.create({
          data: { nome: "Paciente CPF Inválido Spec", ativo: true, cpf: "123" },
        }),
      );
      const v = identificarViolacao(erro);
      expect(v?.classe).toBe("CHECK");
      expect(v?.sqlstate).toBe("23514");
      expect(v?.constraint).toBe("ck_paciente_cpf_formato");
    });
  });

  it("identifica violação de EXCLUSION (ex_agendamento_profissional)", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      await criarAgendamento(tx, f, {
        pacienteId: f.paciente1Id,
        inicio: "2026-09-01T13:00:00Z",
        fim: "2026-09-01T14:00:00Z",
      });
      // Pacientes distintos isolam o conflito no profissional (IDX-A1).
      const erro = await capturarErro(() =>
        criarAgendamento(tx, f, {
          pacienteId: f.paciente2Id,
          inicio: "2026-09-01T13:30:00Z",
          fim: "2026-09-01T14:30:00Z",
        }),
      );
      const v = identificarViolacao(erro);
      expect(v?.classe).toBe("EXCLUSION");
      expect(v?.sqlstate).toBe("23P01");
      expect(v?.constraint).toBe("ex_agendamento_profissional");
    });
  });

  it("identifica violação de FOREIGN KEY (contato_emergencia -> paciente)", async () => {
    await emTransacaoRevertida(async (tx) => {
      const erro = await capturarErro(() =>
        tx.contatoEmergencia.create({
          data: {
            pacienteId: randomUUID(), // paciente inexistente
            nome: "Contato Sintético Spec",
            telefone: "+55 00 00000-0000",
          },
        }),
      );
      const v = identificarViolacao(erro);
      expect(v?.classe).toBe("FOREIGN_KEY");
      expect(v?.sqlstate).toBe("23503");
      expect(v?.codigoPrisma).toBe("P2003");
      expect(v?.constraint).toBe("contato_emergencia_paciente_id_fkey");
    });
  });
});

describe("C-04 — retry de consumo duplicado é SUCESSO IDEMPOTENTE", () => {
  it("não gera segunda baixa e devolve o mesmo movimento", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      const { atendimento, pacote } = await criarAtendimentoComPacote(tx, f);
      const chave = { pacoteId: pacote.id, atendimentoId: atendimento.id };

      const primeira = await registrarConsumoIdempotente(tx, f, chave);
      expect(primeira.inseriuAgora).toBe(true);

      // Retry — cenário 4 de docs/07 §25.
      const retry = await registrarConsumoIdempotente(tx, f, chave);
      expect(retry.inseriuAgora).toBe(false);
      expect(retry.movimentoId).toBe(primeira.movimentoId);

      const total = await tx.movimentoSessao.count({
        where: { pacoteId: pacote.id, tipo: "CONSUMO" },
      });
      expect(total).toBe(1);
    });
  });
});

describe("C-01 — conflito de agenda é ERRO DE CONFLITO", () => {
  it("sobreposição do mesmo profissional é rejeitada e classificada como conflito", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      await criarAgendamento(tx, f, {
        pacienteId: f.paciente1Id,
        inicio: "2026-09-01T13:00:00Z",
        fim: "2026-09-01T14:00:00Z",
      });
      const erro = await capturarErro(() =>
        criarAgendamento(tx, f, {
          pacienteId: f.paciente2Id,
          inicio: "2026-09-01T13:30:00Z",
          fim: "2026-09-01T14:30:00Z",
        }),
      );
      expect(ehConflitoAgenda(erro)).toBe(true);
    });
  });
});

describe("segurança do mapeamento — fail closed", () => {
  it("erro desconhecido NUNCA é classificado como idempotência nem como conflito", () => {
    const desconhecido = new Error("erro qualquer");
    expect(identificarViolacao(desconhecido)).toBeNull();
    expect(ehConsumoDuplicado(desconhecido)).toBe(false);
    expect(ehConflitoAgenda(desconhecido)).toBe(false);
    expect(ehConsumoDuplicado(null)).toBe(false);
    expect(ehConflitoAgenda(undefined)).toBe(false);
  });

  it("P2002 de OUTRA unique (usuario.email) não vira idempotência de consumo", async () => {
    await emTransacaoRevertida(async (tx) => {
      const email = `dup-${randomUUID().slice(0, 8)}@sintetico.local`;
      await tx.usuario.create({ data: { email, senhaHash: "h", nome: "Dup 1", ativo: true } });
      const erro = await capturarErro(() =>
        tx.usuario.create({ data: { email, senhaHash: "h", nome: "Dup 2", ativo: true } }),
      );
      expect(identificarViolacao(erro)?.classe).toBe("UNIQUE");
      expect(ehConsumoDuplicado(erro)).toBe(false);
      expect(ehConflitoAgenda(erro)).toBe(false);
    });
  });

  it("prevenção explícita da inversão: agenda nunca vira idempotência", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      await criarAgendamento(tx, f, {
        pacienteId: f.paciente1Id,
        inicio: "2026-09-01T13:00:00Z",
        fim: "2026-09-01T14:00:00Z",
      });
      const erro = await capturarErro(() =>
        criarAgendamento(tx, f, {
          pacienteId: f.paciente2Id,
          inicio: "2026-09-01T13:30:00Z",
          fim: "2026-09-01T14:30:00Z",
        }),
      );
      expect(ehConflitoAgenda(erro)).toBe(true);
      expect(ehConsumoDuplicado(erro)).toBe(false);
    });
  });

  it("prevenção explícita da inversão: consumo duplicado nunca vira conflito de agenda", async () => {
    await emTransacaoRevertida(async (tx, f) => {
      const { atendimento, pacote } = await criarAtendimentoComPacote(tx, f);
      await criarConsumo(tx, f, { pacoteId: pacote.id, atendimentoId: atendimento.id });
      const erro = await capturarErro(() =>
        criarConsumo(tx, f, { pacoteId: pacote.id, atendimentoId: atendimento.id }),
      );
      expect(ehConsumoDuplicado(erro)).toBe(true);
      expect(ehConflitoAgenda(erro)).toBe(false);
    });
  });
});
