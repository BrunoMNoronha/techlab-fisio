// TechLab Fisio — E-14 — primitivas de coordenação determinística para os
// testes de concorrência real (T-AGD-CONCURRENCY, T-PKG-CONCURRENCY,
// T-FIN-OVERPAY — docs/07 §25 cenários 1, 5 e 8; docs/08 §14).
//
// O padrão dos três testes é o mesmo e NÃO usa sleeps arbitrários como
// mecanismo de sincronização:
//   1. T1 abre transação, executa sua escrita/lock e sinaliza por um portão;
//   2. T2 abre transação em OUTRA conexão, publica seu pid e tenta a operação
//      que disputa o mesmo recurso — ficando fisicamente BLOQUEADA no
//      PostgreSQL (lock de linha `FOR UPDATE` ou espera de exclusion/unique
//      sobre linha não commitada);
//   3. o orquestrador comprova o bloqueio consultando `pg_locks`
//      (`granted = false` para o pid de T2) — evidência de que as duas
//      transações estiveram simultaneamente abertas disputando;
//   4. só então T1 recebe autorização para commitar; T2 acorda e observa o
//      desfecho (erro de constraint ou releitura do estado commitado).
//
// `pg_locks` é visível integralmente para qualquer role — nenhum privilégio
// adicional é necessário para `tlf_app`.

import type { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

/** Portão de sinalização entre transações coordenadas (promise diferida). */
export interface Portao<T = void> {
  promessa: Promise<T>;
  abrir: (valor: T) => void;
}

export function criarPortao<T = void>(): Portao<T> {
  let abrir!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => {
    abrir = resolve;
  });
  return { promessa, abrir };
}

/** pid do backend PostgreSQL que atende esta transação. */
export async function obterPidBackend(tx: Prisma.TransactionClient): Promise<number> {
  const linhas = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
  const pid = linhas[0]?.pid;
  if (typeof pid !== "number") {
    throw new Error("pg_backend_pid() não retornou pid");
  }
  return pid;
}

/**
 * Aguarda até o backend `pid` estar efetivamente em espera de lock
 * (`pg_locks.granted = false`). É espera por CONDIÇÃO REAL do PostgreSQL com
 * teto explícito — não um sleep arbitrário: o teste falha ruidosamente se o
 * bloqueio esperado nunca se materializar.
 */
export async function aguardarEsperaDeLock(
  monitor: PrismaClient,
  pid: number,
  timeoutMs = 15_000,
): Promise<void> {
  const inicio = Date.now();
  for (;;) {
    const linhas = await monitor.$queryRaw<Array<{ aguardando: bigint }>>`
      SELECT count(*) AS aguardando FROM pg_locks WHERE pid = ${pid} AND NOT granted
    `;
    if (Number(linhas[0]?.aguardando ?? 0n) > 0) return;
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(
        `backend ${pid} não entrou em espera de lock em ${timeoutMs}ms — a disputa esperada não ocorreu`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * Opções de transação para os testes sob contenção deliberada de lock.
 *
 * `R-BL-08` (docs/08 §15): o timeout padrão de 5 s do `$transaction` abortaria
 * a transação bloqueada enquanto o orquestrador ainda comprova a disputa.
 * Valores explícitos e folgados: a transação vencedora fica aberta apenas o
 * tempo da coordenação; a perdedora precisa sobreviver à espera de lock.
 */
export const OPCOES_TRANSACAO_SOB_CONTENCAO = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

/** Timeout de teste (Jest) para os cenários de concorrência coordenada. */
export const TIMEOUT_TESTE_CONCORRENCIA_MS = 60_000;
