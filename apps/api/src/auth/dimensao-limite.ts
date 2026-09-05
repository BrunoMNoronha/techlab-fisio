// TechLab Fisio — dimensão de limite em janela deslizante (Etapa 2.3D-B / F6).
//
// EXTRAÇÃO, NÃO INVENÇÃO. Todo o mecanismo deste arquivo já existia em
// `limitador-login.ts` (F3), como métodos privados operando sobre um objeto
// `Dimensao` — janela deslizante por chave, poda em toda leitura, teto de
// entradas com despejo amostrado e rotativo (`F-05`, `F3R-03`), reserva em
// voo (`F-01`), `Retry-After` limitado à janela (`F-09`). A F6 precisa da
// MESMA mecânica para a segunda metade de `D-2.3D-06` — o limite de conclusão
// de recuperação de senha, 10 tentativas / 15 min por IP —, e a alternativa a
// esta extração era copiar ~250 linhas revisadas e homologadas para um
// segundo arquivo, com duas cópias para divergir. A classe é consumida por
// EXATAMENTE dois limitadores (`LimitadorLogin` e `LimitadorRecuperacao`),
// ambos com fonte normativa própria; ela não é abstração antecipada para uso
// futuro (TLF-BASE-V1 §4.5).
//
// O QUE MUDOU DE COMPORTAMENTO NA EXTRAÇÃO — e é a única mudança: a varredura
// periódica de vencidos (`INTERVALO_DE_VARREDURA`) passa a ser contada e
// executada POR DIMENSÃO, e não mais por um contador único compartilhado pelas
// duas dimensões do login. Cada dimensão continua recolhendo suas entradas
// vencidas a cada 1 000 admissões de chave nova PRÓPRIA; a poda por chave em
// toda leitura, o teto, o despejo e a reserva em voo são idênticos. Não é
// parâmetro homologado (`D-2.3D-06` exige que a poda EXISTA; a cadência é
// local) e a suíte da F3 mede o efeito, não o contador.
//
// SEMÂNTICA NEUTRA: aqui uma entrada na janela é uma OCORRÊNCIA. Para o login
// a ocorrência é uma FALHA (`D-2.3D-06`: "5 falhas / 15 min"); para a
// recuperação é uma TENTATIVA admitida ("10 tentativas / 15 min"). A leitura
// literal de cada metade da decisão pertence ao limitador que a materializa,
// não a esta classe.
//
// SEM REDIS, SEM ARMAZENAMENTO EXTERNO, SEM DEPENDÊNCIA NOVA: um `Map` por
// dimensão, em memória de processo (`R-2.3D-02`/`P-2.3D-06`).

/** Janela de observação — `D-2.3D-06`, todas as dimensões das duas metades. */
export const JANELA_MS = 15 * 60 * 1000;

/**
 * Teto absoluto de `Retry-After`, em segundos (`F-09`). Nenhuma causa legítima
 * exige espera maior que a própria janela homologada.
 */
export const RETRY_AFTER_MAXIMO_SEGUNDOS = JANELA_MS / 1000;

/**
 * `Retry-After` das saturações TRANSITÓRIAS — causadas por reservas em voo ou
 * pela recusa de chave nova no teto, não por ocorrências persistidas.
 * DECISÃO LOCAL (não é norma): as reservas se desfazem em milissegundos.
 */
export const RETRY_AFTER_TRANSITORIO_SEGUNDOS = 1;

/**
 * Teto de entradas POR DIMENSÃO — `D-2.3D-06` ("limite máximo de entradas").
 * DECISÃO LOCAL do valor: a decisão exige que o teto EXISTA, não fixa o número.
 */
export const MAXIMO_DE_ENTRADAS = 50_000;

/**
 * Poda global oportunista: a cada N admissões de chave nova na dimensão, uma
 * varredura remove entradas inteiramente vencidas. Sem timer — nenhum
 * `setInterval` segura o event loop no encerramento do processo.
 */
const INTERVALO_DE_VARREDURA = 1_000;

/**
 * Quantas entradas o despejo examina antes de decidir (`F-05`, `F3R-03`).
 * DECISÃO LOCAL: custo constante por admissão, nunca O(n) sob saturação.
 */
export const AMOSTRA_DE_DESPEJO = 64;

/** Veredicto de uma dimensão. Não carrega chave, IP nem contadores. */
export interface VeredictoLimite {
  readonly bloqueado: boolean;
  /**
   * Segundos até a ocorrência mais antiga da janela vencer — valor do
   * cabeçalho `Retry-After`. Sempre `>= 1` quando bloqueado e nunca acima de
   * `RETRY_AFTER_MAXIMO_SEGUNDOS`; `0` quando não bloqueado.
   */
  readonly retryAfterSegundos: number;
}

export const LIBERADO: VeredictoLimite = Object.freeze({
  bloqueado: false,
  retryAfterSegundos: 0,
});

export const VEREDICTO_TRANSITORIO: VeredictoLimite = Object.freeze({
  bloqueado: true,
  retryAfterSegundos: RETRY_AFTER_TRANSITORIO_SEGUNDOS,
});

/** Pior (mais restritivo) de dois vereditos. */
export function piorVeredicto(a: VeredictoLimite, b: VeredictoLimite): VeredictoLimite {
  if (!a.bloqueado && !b.bloqueado) return LIBERADO;
  return {
    bloqueado: true,
    retryAfterSegundos: Math.min(
      RETRY_AFTER_MAXIMO_SEGUNDOS,
      Math.max(a.retryAfterSegundos, b.retryAfterSegundos),
    ),
  };
}

interface Bucket {
  /** Instantes monotônicos das ocorrências dentro da janela. */
  readonly ocorrencias: number[];
  /** Tentativas admitidas e ainda não encerradas. */
  emVoo: number;
}

/**
 * Uma dimensão de limite: chave já normalizada/hasheada → bucket.
 *
 * A classe NÃO decide o que é a chave (identificador hasheado, IP normalizado)
 * nem o que é a ocorrência (falha, tentativa): recebe ambos do limitador que a
 * possui. Também não conhece HTTP, usuário, senha ou banco.
 */
export class DimensaoLimite {
  readonly #entradas = new Map<string, Bucket>();

  /**
   * Cursor de despejo (`F3R-03`): iterador VIVO do `Map`, preservado entre
   * admissões para que a amostra avance em vez de recomeçar na cabeça.
   * `null` quando ainda não existe ou quando se esgotou — recriá-lo é O(1).
   */
  #cursor: Iterator<[string, Bucket]> | null = null;

  #admissoesDesdeVarredura = 0;

  /**
   * Total de candidatos examinados pela política de despejo — exposto
   * EXCLUSIVAMENTE para prova de complexidade (`F3R-03`).
   */
  #candidatosVisitados = 0;

  constructor(readonly limite: number) {}

  /**
   * Avalia a chave contra `ocorrencias_vivas + emVoo`, podando a própria chave
   * antes de decidir. A poda por chave acontece em TODA leitura: sem ela, uma
   * janela vencida continuaria bloqueando até que algo mais a limpasse — o
   * limite deixaria de ser temporal e viraria lockout, contra `D-2.3D-06`.
   */
  avaliar(chave: string, agora: number): VeredictoLimite {
    const bucket = this.#entradas.get(chave);
    if (bucket === undefined) return LIBERADO;
    this.#podarChave(bucket, agora);
    this.#descartarSeVazio(chave, bucket);
    if (bucket.ocorrencias.length + bucket.emVoo < this.limite) return LIBERADO;
    return {
      bloqueado: true,
      retryAfterSegundos: this.#retryAfter(bucket, agora),
    };
  }

  /**
   * Reserva UMA vaga na chave. `false` quando o mapa está no teto e não há
   * candidato SEGURO a despejo — caso em que o chamador devolve saturação
   * transitória em vez de expulsar um bloqueio vigente (`F-05`).
   */
  reservar(chave: string, agora: number): boolean {
    const existente = this.#entradas.get(chave);
    if (existente !== undefined) {
      existente.emVoo += 1;
      return true;
    }
    if (!this.#abrirEspaco(agora)) return false;
    this.#entradas.set(chave, { ocorrencias: [], emVoo: 1 });
    return true;
  }

  /**
   * Encerra UMA reserva. Com `instanteDaOcorrencia` não nulo, a vaga vira
   * ocorrência real na janela; com `null`, apenas desaparece.
   */
  encerrarReserva(chave: string, instanteDaOcorrencia: number | null): void {
    const bucket = this.#entradas.get(chave);
    if (bucket === undefined) return;
    if (bucket.emVoo > 0) bucket.emVoo -= 1;
    if (instanteDaOcorrencia !== null) {
      this.#podarChave(bucket, instanteDaOcorrencia);
      bucket.ocorrencias.push(instanteDaOcorrencia);
      // O array de uma chave nunca cresce além do limite: instantes excedentes
      // não acrescentam informação — a decisão só olha o mais antigo dos
      // `limite` últimos. Consumo por chave O(limite), constante.
      if (bucket.ocorrencias.length > this.limite) {
        bucket.ocorrencias.splice(0, bucket.ocorrencias.length - this.limite);
      }
    }
    this.#descartarSeVazio(chave, bucket);
  }

  /** Quantidade de chaves vivas — exposto para prova de poda e de teto. */
  medirEntradas(): number {
    return this.#entradas.size;
  }

  /** Total de reservas em voo — exposto para provar que nenhuma vaza. */
  medirEmVoo(): number {
    let total = 0;
    for (const bucket of this.#entradas.values()) total += bucket.emVoo;
    return total;
  }

  /** Candidatos examinados pela política de despejo — prova de complexidade. */
  medirCandidatosVisitados(): number {
    return this.#candidatosVisitados;
  }

  /** Chaves vivas — exposto para prova de que nenhuma revela o valor cru. */
  listarChavesParaProva(): readonly string[] {
    return [...this.#entradas.keys()];
  }

  /**
   * `Retry-After` de um bucket bloqueado. Se o bloqueio decorre de ocorrências
   * JÁ PERSISTIDAS suficientes, o valor é o tempo real até a mais antiga sair
   * da janela; se decorre apenas de reservas em voo, é a espera transitória.
   */
  #retryAfter(bucket: Bucket, agora: number): number {
    if (bucket.ocorrencias.length < this.limite) {
      return RETRY_AFTER_TRANSITORIO_SEGUNDOS;
    }
    const maisAntiga = bucket.ocorrencias[0] as number;
    const restanteMs = maisAntiga + JANELA_MS - agora;
    return Math.min(
      RETRY_AFTER_MAXIMO_SEGUNDOS,
      Math.max(1, Math.ceil(restanteMs / 1000)),
    );
  }

  /**
   * Remove desta chave as ocorrências fora da janela. NÃO apaga a chave — a
   * deleção pertence aos chamadores, porque `encerrarReserva` poda ANTES de
   * acrescentar a ocorrência nova e uma deleção aqui deixaria o bucket órfão.
   */
  #podarChave(bucket: Bucket, agora: number): void {
    const corte = agora - JANELA_MS;
    let vencidas = 0;
    while (
      vencidas < bucket.ocorrencias.length &&
      (bucket.ocorrencias[vencidas] as number) <= corte
    ) {
      vencidas += 1;
    }
    if (vencidas > 0) bucket.ocorrencias.splice(0, vencidas);
  }

  /**
   * Descarta a chave quando o bucket ficou sem ocorrências vivas E sem reserva
   * em voo. Uma chave com reserva NUNCA é apagada.
   */
  #descartarSeVazio(chave: string, bucket: Bucket): void {
    if (bucket.ocorrencias.length === 0 && bucket.emVoo === 0) {
      this.#entradas.delete(chave);
    }
  }

  /**
   * Garante espaço para uma chave NOVA, respeitando `MAXIMO_DE_ENTRADAS`
   * (`F-05` + `F3R-03`, literalmente como na F3):
   *
   *   1. varredura periódica de vencidos — nada vivo é sacrificado se houver
   *      lixo a recolher;
   *   2. NUNCA é despejável um bucket BLOQUEADO nem um COM RESERVA EM VOO;
   *   3. entre os candidatos seguros da amostra, vence o de MENOR número de
   *      ocorrências; no empate, o mais antigo;
   *   4. sem candidato seguro NESTA amostra, a admissão é RECUSADA; a amostra
   *      seguinte retoma adiante pelo cursor, de modo que a recusa não se
   *      perpetua.
   */
  #abrirEspaco(agora: number): boolean {
    this.#admissoesDesdeVarredura += 1;
    // A varredura é PERIÓDICA, nunca disparada por estar no teto: disparar a
    // cada admissão saturada custaria O(n) por requisição hostil.
    if (this.#admissoesDesdeVarredura >= INTERVALO_DE_VARREDURA) {
      this.#admissoesDesdeVarredura = 0;
      this.#varrer(agora);
    }
    if (this.#entradas.size < MAXIMO_DE_ENTRADAS) return true;

    let vitima: string | null = null;
    let melhorOcorrencias = Number.POSITIVE_INFINITY;
    let melhorInstante = Number.POSITIVE_INFINITY;

    for (let examinadas = 0; examinadas < AMOSTRA_DE_DESPEJO; examinadas += 1) {
      const candidato = this.#proximoCandidato();
      if (candidato === null) break;
      const [chave, bucket] = candidato;
      this.#candidatosVisitados += 1;

      // PODA LOCAL antes de classificar (`F3R-03`).
      this.#podarChave(bucket, agora);

      // Reserva em voo é intocável — `F-05`, primeira guarda.
      if (bucket.emVoo > 0) continue;

      // Vazio após a poda: lixo puro; remover não sacrifica informação.
      if (bucket.ocorrencias.length === 0) {
        this.#entradas.delete(chave);
        return true;
      }

      // Bloqueado é intocável — `F-05`, segunda guarda.
      if (bucket.ocorrencias.length + bucket.emVoo >= this.limite) continue;

      const primeira = bucket.ocorrencias[0] as number;
      if (
        bucket.ocorrencias.length < melhorOcorrencias ||
        (bucket.ocorrencias.length === melhorOcorrencias && primeira < melhorInstante)
      ) {
        melhorOcorrencias = bucket.ocorrencias.length;
        melhorInstante = primeira;
        vitima = chave;
      }
    }
    if (vitima === null) return false;
    this.#entradas.delete(vitima);
    return true;
  }

  /**
   * Próximo candidato do cursor rotativo (`F3R-03`). Custo O(1). Quando o
   * iterador se esgota, é recriado — o que reinicia o giro, não o ancora.
   */
  #proximoCandidato(): [string, Bucket] | null {
    if (this.#entradas.size === 0) return null;
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      this.#cursor ??= this.#entradas.entries();
      const passo = this.#cursor.next();
      if (passo.done !== true) return passo.value;
      this.#cursor = null;
    }
    return null;
  }

  /**
   * Varredura: apaga toda entrada cuja janela inteira já venceu e que não
   * tenha reserva em voo.
   */
  #varrer(agora: number): void {
    const corte = agora - JANELA_MS;
    for (const [chave, bucket] of this.#entradas) {
      if (bucket.emVoo > 0) continue;
      const maisRecente = bucket.ocorrencias[bucket.ocorrencias.length - 1];
      if (maisRecente === undefined || maisRecente <= corte) {
        this.#entradas.delete(chave);
      }
    }
  }
}
