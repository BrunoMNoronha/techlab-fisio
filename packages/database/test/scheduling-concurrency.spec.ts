// TechLab Fisio — E-14 — T-AGD-CONCURRENCY — concorrência real de agenda.
//
// Cenário homologado (docs/07 §25, cenário 8; C-01): horário inicialmente
// livre; duas transações REALMENTE concorrentes, em conexões distintas, tentam
// agendar o MESMO profissional em intervalos incompatíveis. A exclusion
// constraint `ex_agendamento_profissional` (IDX-A1) decide no índice:
// exatamente uma vence, exatamente uma falha por conflito, jamais dois
// agendamentos válidos sobrepostos.
//
// NÃO confundir com o teste sequencial de exclusion já existente em
// constraint-errors.spec.ts (E-12): lá a segunda inserção ocorre APÓS a
// primeira, na mesma transação. Aqui as duas transações ficam simultaneamente
// abertas e a segunda BLOQUEIA fisicamente no PostgreSQL aguardando o desfecho
// da primeira — bloqueio comprovado por `pg_locks` antes do commit
// (helpers/concorrencia.ts). Nenhum sleep arbitrário é usado como mecanismo de
// sincronização.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ehConflitoAgenda, identificarViolacao } from "../src/errors/constraint-map.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  OPCOES_TRANSACAO_SOB_CONTENCAO,
  TIMEOUT_TESTE_CONCORRENCIA_MS,
  aguardarEsperaDeLock,
  criarPortao,
  obterPidBackend,
} from "./helpers/concorrencia.js";
import { criarClienteApp } from "./helpers/db.js";
import { criarBaseSintetica } from "./helpers/fixtures.js";

let prisma: PrismaClient; // monitor e verificação de estado final
let clienteA: PrismaClient; // conexão da transação T1
let clienteB: PrismaClient; // conexão da transação T2

beforeAll(() => {
  prisma = criarClienteApp();
  clienteA = criarClienteApp();
  clienteB = criarClienteApp();
});

afterAll(async () => {
  await Promise.all([prisma.$disconnect(), clienteA.$disconnect(), clienteB.$disconnect()]);
});

describe("T-AGD-CONCURRENCY — duas transações simultâneas, mesmo profissional (C-01)", () => {
  it(
    "exatamente uma vence; a outra falha por conflito; nunca dois sobrepostos",
    async () => {
      const base = await criarBaseSintetica(prisma);
      const janelaT1 = { inicio: "2026-09-03T13:00:00Z", fim: "2026-09-03T14:00:00Z" };
      const janelaT2 = { inicio: "2026-09-03T13:30:00Z", fim: "2026-09-03T14:30:00Z" };

      const t1Inseriu = criarPortao();
      const pidT2 = criarPortao<number>();
      const t1PodeCommitar = criarPortao();

      // T1: insere o agendamento e mantém a transação ABERTA (sem commit) até
      // o orquestrador comprovar que T2 está bloqueada disputando a janela.
      const t1 = clienteA.$transaction(async (tx) => {
        const agendamento = await tx.agendamento.create({
          data: {
            pacienteId: base.paciente1Id,
            profissionalId: base.profissionalId,
            servicoId: base.servicoId,
            inicio: new Date(janelaT1.inicio),
            fim: new Date(janelaT1.fim),
            estado: "AGENDADO",
            modalidade: "AVULSO",
            criadoPorUsuarioId: base.usuarioId,
          },
        });
        t1Inseriu.abrir();
        await t1PodeCommitar.promessa;
        return agendamento.id;
      }, OPCOES_TRANSACAO_SOB_CONTENCAO);

      await t1Inseriu.promessa;

      // T2: pacientes distintos isolam o conflito no PROFISSIONAL (IDX-A1).
      // A inserção fica bloqueada no índice GiST aguardando o desfecho de T1.
      const t2 = clienteB
        .$transaction(async (tx) => {
          pidT2.abrir(await obterPidBackend(tx));
          const agendamento = await tx.agendamento.create({
            data: {
              pacienteId: base.paciente2Id,
              profissionalId: base.profissionalId,
              servicoId: base.servicoId,
              inicio: new Date(janelaT2.inicio),
              fim: new Date(janelaT2.fim),
              estado: "AGENDADO",
              modalidade: "AVULSO",
              criadoPorUsuarioId: base.usuarioId,
            },
          });
          return agendamento.id;
        }, OPCOES_TRANSACAO_SOB_CONTENCAO)
        .then((id) => ({ venceu: true as const, id }))
        .catch((erro: unknown) => ({ venceu: false as const, erro }));

      // Prova de concorrência real: T2 fisicamente em espera de lock ENQUANTO
      // T1 permanece aberta e não commitada.
      const pid = await pidT2.promessa;
      await aguardarEsperaDeLock(prisma, pid);

      t1PodeCommitar.abrir();
      const idVencedor = await t1;

      const resultadoT2 = await t2;
      expect(resultadoT2.venceu).toBe(false);
      if (!resultadoT2.venceu) {
        expect(ehConflitoAgenda(resultadoT2.erro)).toBe(true);
        const v = identificarViolacao(resultadoT2.erro);
        expect(v?.sqlstate).toBe("23P01");
        expect(v?.constraint).toBe("ex_agendamento_profissional");
      }

      // Estado final consultado no banco: exatamente um agendamento persiste
      // para o profissional na janela disputada — o de T1.
      const persistidos = await prisma.agendamento.findMany({
        where: {
          profissionalId: base.profissionalId,
          inicio: { lt: new Date(janelaT2.fim) },
          fim: { gt: new Date(janelaT1.inicio) },
        },
      });
      expect(persistidos).toHaveLength(1);
      expect(persistidos[0]?.id).toBe(idVencedor);
      expect(persistidos[0]?.inicio).toEqual(new Date(janelaT1.inicio));
      expect(persistidos[0]?.fim).toEqual(new Date(janelaT1.fim));
    },
    TIMEOUT_TESTE_CONCORRENCIA_MS,
  );
});
