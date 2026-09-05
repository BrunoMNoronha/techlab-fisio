// TechLab Fisio — anti-abuso da CONCLUSÃO de recuperação de senha
// (Etapa 2.3D-B / F6).
//
// Materializa a SEGUNDA metade de `D-2.3D-06` (`docs/12` §5.6):
//
//   Conclusão de recuperação de senha — por IP ... 10 tentativas / 15 minutos
//
// com as MESMAS regras vinculantes da decisão, pelo MESMO mecanismo da F3
// (`DimensaoLimite`, extraído de `limitador-login.ts` sem mudança de
// contrato): interno ao monólito; sem lockout duro; `429` uniforme com
// `Retry-After`; gate ANTES do Argon2; poda e teto de entradas; restart zera
// os contadores (`R-2.3D-02`/`P-2.3D-06`). A dimensão é UMA só — IP — porque a
// decisão fixa uma só; nenhuma dimensão por segredo ou por usuário é
// inventada (o segredo de 256 bits não é enumerável, e um identificador de
// usuário não participa do contrato de conclusão).
//
// "TENTATIVAS", NÃO "FALHAS" — leitura LITERAL da decisão, declarada como
// decisão local `L-F6-05`: a metade do login fala em "5 falhas / 15 min"; a
// da recuperação, em "10 tentativas / 15 min". Aqui toda tentativa ADMITIDA
// pelo gate é contabilizada NO ATO DA ADMISSÃO, qualquer que seja o desfecho.
// Consequência deliberada: não existe estado "em voo" separado da contagem
// — a admissão já É a ocorrência —, portanto o check-then-act que `F-01`
// corrigiu no login (e que `D-2.3D-13` homologou) não se reproduz aqui: N
// requisições simultâneas contra o limite 10 admitem no máximo 10, de forma
// síncrona, antes de qualquer `await`. Nenhuma proteção de concorrência
// adicional é necessária nem introduzida.
//
// O IP é normalizado quanto à forma IPv4-mapped IPv6 pela MESMA função da F3
// (`normalizarIp`, `F-10`) e vem do SOCKET (decisão local `L-05` da F3).

import { DimensaoLimite, VEREDICTO_TRANSITORIO } from "../auth/dimensao-limite.js";
import type { VeredictoLimite } from "../auth/dimensao-limite.js";
import { normalizarIp } from "../auth/limitador-login.js";

export { JANELA_MS } from "../auth/dimensao-limite.js";

/** Limite por IP para a conclusão de recuperação — `D-2.3D-06`. */
export const LIMITE_TENTATIVAS_RECUPERACAO_POR_IP = 10;

export interface OpcoesLimitadorRecuperacao {
  /** Relógio MONOTÔNICO em ms. Substituído APENAS em teste. */
  readonly agora?: () => number;
}

/**
 * Contador de tentativas de conclusão de recuperação, em memória de processo.
 *
 * NÃO conhece segredo, usuário, senha ou banco: recebe o IP como string
 * opaca e decide.
 */
export class LimitadorRecuperacao {
  readonly #agora: () => number;

  readonly #porIp = new DimensaoLimite(LIMITE_TENTATIVAS_RECUPERACAO_POR_IP);

  constructor(opcoes?: OpcoesLimitadorRecuperacao) {
    this.#agora = opcoes?.agora ?? ((): number => performance.now());
  }

  /**
   * GATE de `D-2.3D-06` (segunda metade): decide e, se admitir, CONTABILIZA a
   * tentativa imediatamente — de forma síncrona, antes de qualquer `await` do
   * chamador. Bloqueada => `429` sem consultar o banco e sem Argon2.
   */
  tentar(ip: string): VeredictoLimite {
    const agora = this.#agora();
    const chave = normalizarIp(ip);
    const veredicto = this.#porIp.avaliar(chave, agora);
    if (veredicto.bloqueado) return veredicto;
    // Sem espaço seguro no teto: saturação transitória, nunca despejo de um
    // bloqueio vigente (`F-05`).
    if (!this.#porIp.reservar(chave, agora)) return VEREDICTO_TRANSITORIO;
    // A admissão É a tentativa: a reserva vira ocorrência no mesmo instante.
    this.#porIp.encerrarReserva(chave, agora);
    return veredicto;
  }

  /** Leitura SEM contabilizar — inspeção e prova. */
  consultar(ip: string): VeredictoLimite {
    return this.#porIp.avaliar(normalizarIp(ip), this.#agora());
  }

  /** Quantidade de IPs vivos — exposto para prova de poda e de teto. */
  medirEntradas(): number {
    return this.#porIp.medirEntradas();
  }
}
