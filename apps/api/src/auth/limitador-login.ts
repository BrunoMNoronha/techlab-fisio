// TechLab Fisio — anti-abuso do login (Etapa 2.3D-B / F3).
//
// Materializa a metade "login" de `D-2.3D-06` (`docs/12` §5.6):
//
//   por identificador normalizado E HASHEADO ....  5 falhas / 15 minutos
//   por IP .....................................  30 falhas / 15 minutos
//
// Regras vinculantes da decisão, e onde cada uma vive:
//   - mecanismo INTERNO ao monólito, sem infraestrutura nova ....... `DimensaoLimite`
//   - SEM lockout duro (o limite é temporal, não permanente) ....... janela deslizante
//   - `429` uniforme com `Retry-After` ............................. veredicto
//   - rate limit ANTES da operação custosa de Argon2 ............... `adquirir`
//   - expiração/poda + LIMITE MÁXIMO de entradas ................... `DimensaoLimite`
//   - identificador entra HASHEADO, nunca em claro ................. `#chaveDoIdentificador`
//   - restart zera os contadores .................................. limitação homologada
//
// CORREÇÃO `F-01` (revisão independente da F3) — RESERVA DE TENTATIVA EM VOO
// (`D-2.3D-13`). O gate decide sobre `falhas_vivas_na_janela +
// tentativas_em_voo` e a admissão RESERVA a vaga de forma síncrona, antes de
// qualquer `await`. A reserva é depois convertida em falha real (rejeição) ou
// simplesmente liberada (sucesso ou erro técnico) — sempre em `finally`.
//
// CORREÇÕES `F-05` e `F3R-03` — política de despejo que nunca sacrifica um
// bucket bloqueado ou com reserva em voo, com amostra rotativa e poda local.
// CORREÇÃO `F-09` — relógio MONOTÔNICO (`performance.now()`) e `Retry-After`
// limitado à janela. CORREÇÃO `F-10` — IPv4-mapped IPv6 normalizado.
//
// F6 — EXTRAÇÃO SEM MUDANÇA DE CONTRATO: a mecânica de janela, poda, teto,
// despejo e reserva por dimensão vive agora em `dimensao-limite.ts`, para que
// o limite de conclusão de recuperação de senha (segunda metade de
// `D-2.3D-06`, `LimitadorRecuperacao`) use EXATAMENTE o mesmo mecanismo em vez
// de uma cópia. A API pública desta classe, os limites, a janela, o HMAC do
// identificador e a semântica de reserva permanecem idênticos; a suíte da F3
// (`limitador-login.spec.ts`) é a prova. A única diferença de comportamento —
// a cadência da varredura periódica passar a ser por dimensão — está declarada
// no cabeçalho de `dimensao-limite.ts`.

import { createHmac, randomBytes } from "node:crypto";

import {
  DimensaoLimite,
  LIBERADO,
  piorVeredicto,
  VEREDICTO_TRANSITORIO,
} from "./dimensao-limite.js";
import type { VeredictoLimite } from "./dimensao-limite.js";

export {
  AMOSTRA_DE_DESPEJO,
  JANELA_MS,
  MAXIMO_DE_ENTRADAS,
  RETRY_AFTER_MAXIMO_SEGUNDOS,
} from "./dimensao-limite.js";
export type { VeredictoLimite } from "./dimensao-limite.js";

/** Limite por identificador normalizado e hasheado — `D-2.3D-06`. */
export const LIMITE_POR_IDENTIFICADOR = 5;

/** Limite por IP — `D-2.3D-06`. */
export const LIMITE_POR_IP = 30;

/**
 * Vaga reservada por UMA tentativa admitida, nas DUAS dimensões.
 *
 * O chamador é obrigado a encerrá-la exatamente uma vez — `registrarFalha()`
 * quando a autenticação rejeitar, `liberar()` em qualquer outro desfecho. As
 * duas operações são IDEMPOTENTES, de modo que o `finally` do chamador pode
 * chamar `liberar()` incondicionalmente sem desfazer uma falha já registrada
 * nem decrementar duas vezes o contador de tentativas em voo.
 */
export interface ReservaTentativa {
  /** Converte a reserva em falha real na janela, nas duas dimensões. */
  registrarFalha(): void;
  /** Encerra a reserva SEM contabilizar falha (sucesso ou erro técnico). */
  liberar(): void;
}

export type ResultadoAquisicao =
  | { readonly admitida: true; readonly reserva: ReservaTentativa }
  | { readonly admitida: false; readonly veredicto: VeredictoLimite };

export interface OpcoesLimitadorLogin {
  /** Relógio MONOTÔNICO em ms. Substituído APENAS em teste. */
  readonly agora?: () => number;
}

/**
 * Normaliza a forma textual do IP antes de indexar (`F-10`).
 *
 * Trata exclusivamente o mapeamento IPv4-em-IPv6 (`::ffff:a.b.c.d`), que é a
 * forma que o próprio Node entrega em `socket.remoteAddress` quando o
 * servidor escuta em dual-stack. NÃO é uma biblioteca de rede: não expande
 * abreviações IPv6, não resolve nomes e não interpreta cabeçalho algum — a
 * topologia de proxy continua não homologada (decisão local `L-05`).
 */
export function normalizarIp(ip: string): string {
  const bruto = ip.trim();
  const prefixo = /^::ffff:/i;
  if (!prefixo.test(bruto)) return bruto;
  const resto = bruto.replace(prefixo, "");
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(resto) ? resto : bruto;
}

/**
 * Contadores de falha de login em memória de processo.
 *
 * NÃO É UM SERVIÇO DE AUTENTICAÇÃO: não conhece usuário, senha, sessão ou
 * banco. Recebe o identificador JÁ NORMALIZADO (`D-2.3D-03`) e o hasheia
 * imediatamente; recebe o IP como string opaca, normalizada apenas quanto à
 * forma IPv4-mapped.
 */
export class LimitadorLogin {
  /**
   * Chave HMAC do processo, aleatória e efêmera.
   *
   * POR QUE HMAC E NÃO SHA-256 PURO: um e-mail tem entropia baixíssima. O
   * digest simples de um endereço conhecido é reconstruível por qualquer um
   * que obtenha um dump de memória — o mapa viraria, na prática, uma lista de
   * identificadores tentados, exatamente o que `D-2.3D-06` proíbe ao exigir
   * que o identificador entre "hasheado, nunca em claro". Com chave aleatória
   * de processo, a correspondência só é possível para quem já tem a chave.
   */
  readonly #chaveHmac = randomBytes(32);

  readonly #agora: () => number;

  readonly #porIdentificador = new DimensaoLimite(LIMITE_POR_IDENTIFICADOR);

  readonly #porIp = new DimensaoLimite(LIMITE_POR_IP);

  constructor(opcoes?: OpcoesLimitadorLogin) {
    // `performance.now()` é MONOTÔNICO (`F-09`): imune a passos de NTP e a
    // ajustes manuais de calendário. A janela de 15 min nunca precisou de
    // tempo civil — os contadores já morrem no restart por decisão homologada.
    this.#agora = opcoes?.agora ?? ((): number => performance.now());
  }

  /**
   * GATE de `D-2.3D-06`: decide e RESERVA, de forma síncrona e atômica, antes
   * de qualquer `await` do chamador.
   *
   * A decisão considera `falhas_vivas + emVoo` em CADA dimensão. A aquisição é
   * all-or-nothing: se qualquer uma das duas dimensões estiver saturada — ou
   * se não houver espaço seguro no mapa —, NENHUMA reserva permanece.
   *
   * É esta chamada que precede o Argon2. Separá-la da contabilização da falha
   * é o que permite que uma tentativa bloqueada termine em `429` sem pagar um
   * único `verify` (`D-2.3D-06`: "o rate limit ocorre antes da operação
   * custosa de Argon2") — e a reserva é o que faz essa propriedade valer
   * também sob concorrência (`D-2.3D-13`).
   */
  adquirir(identificadorNormalizado: string, ip: string): ResultadoAquisicao {
    const agora = this.#agora();
    const chaveId = this.#chaveDoIdentificador(identificadorNormalizado);
    const chaveIp = normalizarIp(ip);

    const porIdentificador = this.#porIdentificador.avaliar(chaveId, agora);
    const porIp = this.#porIp.avaliar(chaveIp, agora);
    if (porIdentificador.bloqueado || porIp.bloqueado) {
      return { admitida: false, veredicto: piorVeredicto(porIdentificador, porIp) };
    }

    // Reserva efetiva. Se a segunda dimensão não couber no mapa, a primeira é
    // desfeita — nunca se reserva uma dimensão deixando a outra sem reserva.
    if (!this.#porIdentificador.reservar(chaveId, agora)) {
      return { admitida: false, veredicto: VEREDICTO_TRANSITORIO };
    }
    if (!this.#porIp.reservar(chaveIp, agora)) {
      this.#porIdentificador.encerrarReserva(chaveId, null);
      return { admitida: false, veredicto: VEREDICTO_TRANSITORIO };
    }

    let encerrada = false;
    const encerrar = (instanteDaFalha: number | null): void => {
      if (encerrada) return;
      encerrada = true;
      this.#porIdentificador.encerrarReserva(chaveId, instanteDaFalha);
      this.#porIp.encerrarReserva(chaveIp, instanteDaFalha);
    };

    return {
      admitida: true,
      reserva: {
        registrarFalha: (): void => {
          encerrar(this.#agora());
        },
        liberar: (): void => {
          encerrar(null);
        },
      },
    };
  }

  /**
   * Leitura SEM reserva — usada apenas para inspeção e prova. O caminho de
   * produção usa `adquirir`, porque só a reserva torna o limite verdadeiro sob
   * concorrência (`F-01`).
   */
  consultar(identificadorNormalizado: string, ip: string): VeredictoLimite {
    const agora = this.#agora();
    const a = this.#porIdentificador.avaliar(
      this.#chaveDoIdentificador(identificadorNormalizado),
      agora,
    );
    const b = this.#porIp.avaliar(normalizarIp(ip), agora);
    if (!a.bloqueado && !b.bloqueado) return LIBERADO;
    return piorVeredicto(a, b);
  }

  /** Quantidade de chaves vivas por dimensão — exposto para prova de poda. */
  medirEntradas(): { readonly identificadores: number; readonly ips: number } {
    return {
      identificadores: this.#porIdentificador.medirEntradas(),
      ips: this.#porIp.medirEntradas(),
    };
  }

  /** Total de reservas em voo — exposto para provar que nenhuma vaza. */
  medirEmVoo(): { readonly identificadores: number; readonly ips: number } {
    return {
      identificadores: this.#porIdentificador.medirEmVoo(),
      ips: this.#porIp.medirEmVoo(),
    };
  }

  /**
   * Candidatos examinados pela política de despejo, somadas as duas
   * dimensões — exposto EXCLUSIVAMENTE para prova de complexidade (`F3R-03`).
   */
  medirCandidatosVisitados(): number {
    return (
      this.#porIdentificador.medirCandidatosVisitados() +
      this.#porIp.medirCandidatosVisitados()
    );
  }

  /**
   * Chaves vivas da dimensão de identificador — exposto EXCLUSIVAMENTE para
   * que o teste prove que nenhuma delas é (ou contém) um identificador em
   * claro. São digests HMAC hexadecimais; conhecê-los não revela o
   * identificador sem a chave do processo.
   */
  listarChavesDeIdentificadorParaProva(): readonly string[] {
    return this.#porIdentificador.listarChavesParaProva();
  }

  #chaveDoIdentificador(identificadorNormalizado: string): string {
    return createHmac("sha256", this.#chaveHmac)
      .update(identificadorNormalizado, "utf8")
      .digest("hex");
  }
}
