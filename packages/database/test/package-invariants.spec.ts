// TechLab Fisio — E-14 — T-PKG-CONCURRENCY e T-PKG-AJUSTE — invariantes do
// agregado Pacote sob o protocolo de lock homologado.
//
// Fontes: docs/07 §12.1 (fórmulas de saldo/reservas/disponível), §17.1
// (H2.2-05: `SELECT ... FROM pacote ... FOR UPDATE` — mecanismo homologado,
// sem advisory lock, sem SERIALIZABLE, sem versão otimista), §17.4 (ordem das
// verificações de T-01 e T-06), §25 cenários 1 e 2; H2-10/C-09; docs/08 §14.
//
// Os helpers `reservarSobLock`/`ajustarNegativoSobLock` são TEST HARNESS da
// persistência (docs/08 §14 via prompt E-14 §5): executam o protocolo
// homologado diretamente sobre Prisma/PostgreSQL. Não são serviços de
// produção e nenhum módulo NestJS/API é criado.
//
// T-PKG-RETRY: NÃO reimplementado aqui — prova permanente integral em
// constraint-errors.spec.ts (E-12, "C-04 — retry de consumo duplicado é
// SUCESSO IDEMPOTENTE"): primeiro consumo criado, retry traduzido em sucesso
// idempotente via SAVEPOINT, mesmo movimento retornado, total final = 1.
// Registrado como reuso na matriz de cobertura da E-14 (docs/08 §13 `E-14`).

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  OPCOES_TRANSACAO_SOB_CONTENCAO,
  TIMEOUT_TESTE_CONCORRENCIA_MS,
  aguardarEsperaDeLock,
  criarPortao,
  obterPidBackend,
} from "./helpers/concorrencia.js";
import { criarClienteApp } from "./helpers/db.js";
import { criarAgendamento, criarBaseSintetica, type BaseSintetica } from "./helpers/fixtures.js";

type Tx = Prisma.TransactionClient;

let prisma: PrismaClient;
let clienteA: PrismaClient;
let clienteB: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
  clienteA = criarClienteApp();
  clienteB = criarClienteApp();
});

afterAll(async () => {
  await Promise.all([prisma.$disconnect(), clienteA.$disconnect(), clienteB.$disconnect()]);
});

/** Rejeição de domínio do harness: reserva sem disponibilidade (D-07). */
class DisponibilidadeInsuficienteError extends Error {}

/** Rejeição de domínio do harness: ajuste negativo inválido (H2-10/C-09). */
class AjusteNegativoInvalidoError extends Error {}

/**
 * Passo 5 de T-01/T-06 (docs/07 §17.4): lock da linha do `pacote` — a raiz de
 * serialização homologada (H2-06). Retorna `quantidade_contratada` lida SOB o
 * lock. Bloqueia se outra transação detém o lock; ao acordar, as leituras
 * seguintes observam o estado commitado (READ COMMITTED).
 */
async function travarPacote(tx: Tx, pacoteId: string): Promise<number> {
  const linhas = await tx.$queryRaw<Array<{ quantidade_contratada: number }>>`
    SELECT "quantidade_contratada" FROM "pacote" WHERE "id" = ${pacoteId}::uuid FOR UPDATE
  `;
  const contratada = linhas[0]?.quantidade_contratada;
  if (typeof contratada !== "number") {
    throw new Error(`pacote ${pacoteId} inexistente — lock impossível`);
  }
  return contratada;
}

/** Fórmulas de docs/07 §12.1, calculadas APÓS o lock, dentro da transação. */
async function calcularSaldoEReservas(
  tx: Tx,
  pacoteId: string,
  quantidadeContratada: number,
): Promise<{ saldoDeDireito: number; reservasAtivas: number; disponivel: number }> {
  const somas = await tx.movimentoSessao.groupBy({
    by: ["tipo"],
    where: { pacoteId },
    _sum: { quantidade: true },
  });
  const somaPorTipo = (tipo: "CONSUMO" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO"): number =>
    somas.find((s) => s.tipo === tipo)?._sum.quantidade ?? 0;
  const saldoDeDireito =
    quantidadeContratada +
    somaPorTipo("AJUSTE_POSITIVO") -
    somaPorTipo("AJUSTE_NEGATIVO") -
    somaPorTipo("CONSUMO");
  const reservasAtivas = await tx.reservaSessao.count({
    where: { pacoteId, encerradaEm: null },
  });
  return { saldoDeDireito, reservasAtivas, disponivel: saldoDeDireito - reservasAtivas };
}

/** Protocolo de T-01 (passos 5→8→10 de docs/07 §17.4) para criar reserva. */
async function reservarSobLock(
  tx: Tx,
  dados: { pacoteId: string; agendamentoId: string; usuarioId: string },
): Promise<string> {
  const contratada = await travarPacote(tx, dados.pacoteId);
  const { disponivel } = await calcularSaldoEReservas(tx, dados.pacoteId, contratada);
  if (disponivel < 1) {
    throw new DisponibilidadeInsuficienteError(
      `disponivel=${disponivel} — reserva rejeitada (D-07, PKG-004)`,
    );
  }
  const reserva = await tx.reservaSessao.create({
    data: {
      pacoteId: dados.pacoteId,
      agendamentoId: dados.agendamentoId,
      criadaPorUsuarioId: dados.usuarioId,
    },
  });
  return reserva.id;
}

/** Protocolo de T-06 (docs/07 §17.4) para AJUSTE_NEGATIVO sob H2-10. */
async function ajustarNegativoSobLock(
  tx: Tx,
  dados: { pacoteId: string; quantidade: number; usuarioId: string },
): Promise<string> {
  const contratada = await travarPacote(tx, dados.pacoteId);
  const { saldoDeDireito, reservasAtivas } = await calcularSaldoEReservas(
    tx,
    dados.pacoteId,
    contratada,
  );
  if (saldoDeDireito - dados.quantidade < reservasAtivas) {
    throw new AjusteNegativoInvalidoError(
      `saldo=${saldoDeDireito} − quantidade=${dados.quantidade} < reservas=${reservasAtivas} (H2-10, C-09)`,
    );
  }
  const movimento = await tx.movimentoSessao.create({
    data: {
      pacoteId: dados.pacoteId,
      tipo: "AJUSTE_NEGATIVO",
      quantidade: dados.quantidade,
      usuarioResponsavelId: dados.usuarioId,
      justificativa: "ajuste sintético E-14 (RN-038)",
    },
  });
  return movimento.id;
}

async function criarPacoteComAgendamentos(
  base: BaseSintetica,
  quantidadeContratada: number,
  janelas: Array<{ inicio: string; fim: string }>,
): Promise<{ pacoteId: string; agendamentoIds: string[] }> {
  const pacote = await prisma.pacote.create({
    data: {
      pacienteId: base.paciente1Id,
      servicoId: base.servicoId,
      quantidadeContratada,
      dataContratacao: new Date("2026-09-01"),
      criadoPorUsuarioId: base.usuarioId,
    },
  });
  const agendamentoIds: string[] = [];
  for (const janela of janelas) {
    const agendamento = await criarAgendamento(prisma, base, {
      pacienteId: base.paciente1Id,
      inicio: janela.inicio,
      fim: janela.fim,
      modalidade: "PACOTE",
      pacoteId: pacote.id,
    });
    agendamentoIds.push(agendamento.id);
  }
  return { pacoteId: pacote.id, agendamentoIds };
}

describe("T-PKG-CONCURRENCY — reservas concorrentes não excedem o saldo (C-02)", () => {
  it(
    "com disponível = 1, duas reservas concorrentes: 1 criada, 1 rejeitada",
    async () => {
      const base = await criarBaseSintetica(prisma);
      // Janelas contíguas (semiaberto `[)`) não conflitam na agenda: a disputa
      // fica exclusivamente no saldo do pacote.
      const { pacoteId, agendamentoIds } = await criarPacoteComAgendamentos(base, 1, [
        { inicio: "2026-09-04T10:00:00Z", fim: "2026-09-04T11:00:00Z" },
        { inicio: "2026-09-04T11:00:00Z", fim: "2026-09-04T12:00:00Z" },
      ]);
      const [agendamento1, agendamento2] = agendamentoIds;
      if (!agendamento1 || !agendamento2) throw new Error("fixtures incompletas");

      const t1Reservou = criarPortao();
      const pidT2 = criarPortao<number>();
      const t1PodeCommitar = criarPortao();

      // T1: adquire o lock do pacote, cria a reserva e mantém a transação
      // aberta até T2 estar comprovadamente bloqueada no MESMO lock.
      const t1 = clienteA.$transaction(async (tx) => {
        const reservaId = await reservarSobLock(tx, {
          pacoteId,
          agendamentoId: agendamento1,
          usuarioId: base.usuarioId,
        });
        t1Reservou.abrir();
        await t1PodeCommitar.promessa;
        return reservaId;
      }, OPCOES_TRANSACAO_SOB_CONTENCAO);

      await t1Reservou.promessa;

      // T2: mesmo protocolo, mesmo pacote — bloqueia no FOR UPDATE.
      const t2 = clienteB
        .$transaction(async (tx) => {
          pidT2.abrir(await obterPidBackend(tx));
          return reservarSobLock(tx, {
            pacoteId,
            agendamentoId: agendamento2,
            usuarioId: base.usuarioId,
          });
        }, OPCOES_TRANSACAO_SOB_CONTENCAO)
        .then((id) => ({ venceu: true as const, id }))
        .catch((erro: unknown) => ({ venceu: false as const, erro }));

      const pid = await pidT2.promessa;
      await aguardarEsperaDeLock(prisma, pid);

      t1PodeCommitar.abrir();
      const reservaVencedora = await t1;

      // T2 obteve o lock APÓS o commit de T1 e releu o estado commitado:
      // disponivel = 1 − 1 = 0 → rejeição pelo protocolo, não por acaso.
      const resultadoT2 = await t2;
      expect(resultadoT2.venceu).toBe(false);
      if (!resultadoT2.venceu) {
        expect(resultadoT2.erro).toBeInstanceOf(DisponibilidadeInsuficienteError);
      }

      // Estado final no banco: 1 reserva ativa; invariante I-24 preservada.
      const reservasAtivas = await prisma.reservaSessao.findMany({
        where: { pacoteId, encerradaEm: null },
      });
      expect(reservasAtivas).toHaveLength(1);
      expect(reservasAtivas[0]?.id).toBe(reservaVencedora);
      expect(reservasAtivas[0]?.agendamentoId).toBe(agendamento1);

      const movimentos = await prisma.movimentoSessao.count({ where: { pacoteId } });
      expect(movimentos).toBe(0); // reserva não é movimento (H2-02)
      // reservas_ativas (1) <= saldo_de_direito (1)
      expect(reservasAtivas.length).toBeLessThanOrEqual(1);
    },
    TIMEOUT_TESTE_CONCORRENCIA_MS,
  );
});

describe("T-PKG-AJUSTE — AJUSTE_NEGATIVO sob lock respeita H2-10/C-09", () => {
  it("rejeita ajuste que deixaria saldo_de_direito < reservas_ativas", async () => {
    const base = await criarBaseSintetica(prisma);
    const { pacoteId, agendamentoIds } = await criarPacoteComAgendamentos(base, 3, [
      { inicio: "2026-09-05T10:00:00Z", fim: "2026-09-05T11:00:00Z" },
      { inicio: "2026-09-05T11:00:00Z", fim: "2026-09-05T12:00:00Z" },
    ]);
    for (const agendamentoId of agendamentoIds) {
      await prisma.reservaSessao.create({
        data: { pacoteId, agendamentoId, criadaPorUsuarioId: base.usuarioId },
      });
    }
    // saldo = 3, reservas_ativas = 2 → ajuste de 2 deixaria 1 < 2: inválido.
    await expect(
      prisma.$transaction(
        (tx) => ajustarNegativoSobLock(tx, { pacoteId, quantidade: 2, usuarioId: base.usuarioId }),
        OPCOES_TRANSACAO_SOB_CONTENCAO,
      ),
    ).rejects.toBeInstanceOf(AjusteNegativoInvalidoError);

    const ajustes = await prisma.movimentoSessao.count({
      where: { pacoteId, tipo: "AJUSTE_NEGATIVO" },
    });
    expect(ajustes).toBe(0);
  });

  it("permite o caso de borda em que saldo final == reservas_ativas", async () => {
    const base = await criarBaseSintetica(prisma);
    const { pacoteId, agendamentoIds } = await criarPacoteComAgendamentos(base, 3, [
      { inicio: "2026-09-06T10:00:00Z", fim: "2026-09-06T11:00:00Z" },
      { inicio: "2026-09-06T11:00:00Z", fim: "2026-09-06T12:00:00Z" },
    ]);
    for (const agendamentoId of agendamentoIds) {
      await prisma.reservaSessao.create({
        data: { pacoteId, agendamentoId, criadaPorUsuarioId: base.usuarioId },
      });
    }
    // saldo = 3, reservas_ativas = 2 → ajuste de 1 deixa 2 == 2: permitido —
    // a regra homologada é `saldo − quantidade < reservas` (estrita), e nenhuma
    // regra mais restritiva é criada aqui.
    const movimentoId = await prisma.$transaction(
      (tx) => ajustarNegativoSobLock(tx, { pacoteId, quantidade: 1, usuarioId: base.usuarioId }),
      OPCOES_TRANSACAO_SOB_CONTENCAO,
    );

    const movimento = await prisma.movimentoSessao.findUniqueOrThrow({
      where: { id: movimentoId },
    });
    expect(movimento.tipo).toBe("AJUSTE_NEGATIVO");
    expect(movimento.quantidade).toBe(1);

    // Estado final: saldo_de_direito = 3 − 1 = 2; reservas_ativas = 2.
    const reservasAtivas = await prisma.reservaSessao.count({
      where: { pacoteId, encerradaEm: null },
    });
    expect(reservasAtivas).toBe(2);
  });
});
