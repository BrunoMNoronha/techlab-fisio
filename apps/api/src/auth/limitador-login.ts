// TechLab Fisio — anti-abuso do login (Etapa 2.3D-B / F3).
//
// Materializa a metade "login" de `D-2.3D-06` (`docs/12` §5.6):
//
//   por identificador normalizado E HASHEADO ....  5 falhas / 15 minutos
//   por IP .....................................  30 falhas / 15 minutos
//
// Regras vinculantes da decisão, e onde cada uma vive neste arquivo:
//   - mecanismo INTERNO ao monólito, sem infraestrutura nova ....... `#dimensao`
//   - SEM lockout duro (o limite é temporal, não permanente) ....... janela deslizante
//   - `429` uniforme com `Retry-After` ............................. `#retryAfter`
//   - rate limit ANTES da operação custosa de Argon2 ............... `adquirir`
//   - expiração/poda + LIMITE MÁXIMO de entradas ................... `#podar`/`#reservar`
//   - identificador entra HASHEADO, nunca em claro ................. `#chaveDoIdentificador`
//   - restart zera os contadores .................................. limitação homologada
//
// CORREÇÃO `F-01` (revisão independente da F3) — RESERVA DE TENTATIVA EM VOO.
// A versão anterior era um CHECK-THEN-ACT: `consultar()` só lia, e a falha só
// era contabilizada ~40 ms depois (leitura no banco + Argon2). Sob
// concorrência, TODAS as requisições em voo passavam o gate — medido pela
// revisão: 12 concorrentes contra o limite 5 produziram 12 execuções de Argon2
// e ZERO bloqueios; 45 concorrentes contra o limite 30 de IP, idem. O limite
// homologado deixava de valer, e 45 Argon2 simultâneos (19 MiB cada) viravam
// vetor de esgotamento de memória.
//
// A correção é conceitualmente simples: o gate passa a decidir sobre
//
//     falhas_vivas_na_janela + tentativas_em_voo
//
// e a admissão RESERVA a vaga de forma síncrona, antes de qualquer `await`. A
// reserva é depois convertida em falha real (rejeição) ou simplesmente
// liberada (sucesso ou erro técnico) — sempre em `finally`, para que nenhuma
// reserva vaze.
//
// CORREÇÃO `F-05` — política de despejo. A heurística anterior removia a
// entrada de expiração mais próxima, que é justamente a da VÍTIMA bloqueada há
// mais tempo: saturar o mapa zerava o bloqueio do alvo (medido pela revisão).
// Agora nenhum bucket BLOQUEADO ou COM RESERVA EM VOO é despejável, e a
// escolha entre os candidatos seguros prefere o de MENOR número de falhas.
//
// CORREÇÃO `F3R-03` (segunda revisão independente) — INANIÇÃO DA AMOSTRAGEM.
// A amostra de `F-05` recomeçava SEMPRE no primeiro elemento do `Map`. Como o
// `Map` preserva ordem de inserção e um bucket bloqueado nunca é despejado, os
// bloqueados mais antigos FIXAVAM-SE na cabeça e eram reexaminados a cada
// admissão. Medido pela revisão: com 64 bloqueados na cabeça e 49 936
// candidatos seguros depois deles, 2 000 de 2 000 identificadores novos foram
// recusados — 100 %. Agravante medido: a elegibilidade lia `falhas.length` SEM
// podar, de modo que um bucket cuja janela inteira já vencera continuava
// contando como bloqueado até a varredura periódica passar.
//
// Duas correções, ambas de custo constante:
//
//   1. CURSOR PERSISTENTE por dimensão. A amostra continua de onde a anterior
//      parou, e o iterador do `Map` é recriado apenas quando se esgota. Não é
//      "pular N desde o início" — isso voltaria a ser O(n) por requisição;
//      é um iterador vivo, cujo `next()` é O(1).
//   2. PODA LOCAL do candidato amostrado, com o MESMO instante monotônico da
//      operação, ANTES de classificá-lo. Só os até 64 candidatos amostrados
//      são podados — nenhuma varredura global é reintroduzida. Um bucket que
//      fica vazio após a poda é lixo puro: é removido na hora, sem sacrificar
//      informação protetiva alguma.
//
// CORREÇÃO `F-09` — o relógio é de fato MONOTÔNICO (`performance.now()`), e
// não mais `Date.now()`. Como os contadores já morrem no restart por decisão
// homologada, a janela nunca precisou de tempo de calendário; e um passo
// regressivo de NTP produzia `Retry-After` acima da janela de 15 min.
//
// CORREÇÃO `F-10` — o IP é normalizado quanto à forma IPv4-mapped IPv6 antes
// de indexar o bucket, para que `::ffff:127.0.0.1` e `127.0.0.1` não sejam
// dois orçamentos distintos.
//
// FRONTEIRA (`docs/12` §5.6 tem DUAS metades): este limitador cobre EXCLUSIVAMENTE
// o login. O limite de conclusão de recuperação de senha (10 tentativas / 15 min
// por IP) pertence à F6 e NÃO é implementado, preparado nem parametrizado aqui.
//
// SEM REDIS, SEM ARMAZENAMENTO EXTERNO, SEM DEPENDÊNCIA NOVA: dois `Map` de
// processo. `R-2.3D-02`/`P-2.3D-06` registram a limitação aceita do MVP —
// contadores zerados por restart e não compartilhados entre instâncias.

import { createHmac, randomBytes } from "node:crypto";

/** Janela de observação — `D-2.3D-06`, ambas as dimensões. */
export const JANELA_MS = 15 * 60 * 1000;

/** Limite por identificador normalizado e hasheado — `D-2.3D-06`. */
export const LIMITE_POR_IDENTIFICADOR = 5;

/** Limite por IP — `D-2.3D-06`. */
export const LIMITE_POR_IP = 30;

/**
 * Teto absoluto de `Retry-After`, em segundos (`F-09`).
 *
 * Nenhuma causa legítima pode exigir espera maior que a própria janela
 * homologada. O teto existe para que um relógio anômalo ou um defeito futuro
 * não produzam um valor fora do contrato — a resposta erra para o lado de
 * pedir MENOS espera, nunca mais.
 */
export const RETRY_AFTER_MAXIMO_SEGUNDOS = JANELA_MS / 1000;

/**
 * `Retry-After` das saturações TRANSITÓRIAS — aquelas causadas por tentativas
 * concorrentes em voo, e não por falhas já persistidas na janela.
 *
 * DECISÃO LOCAL DE IMPLEMENTAÇÃO (não é norma): as reservas concorrentes se
 * desfazem em dezenas de milissegundos; mandar o cliente legítimo esperar 15
 * minutos por uma disputa momentânea seria desproporcional. Quando a mesma
 * chave também tem falhas persistidas suficientes, prevalece o cálculo real da
 * janela — ver `#retryAfterDaDimensao`.
 */
const RETRY_AFTER_TRANSITORIO_SEGUNDOS = 1;

/**
 * Teto de entradas POR DIMENSÃO — `D-2.3D-06` ("limite máximo de entradas").
 *
 * DECISÃO LOCAL DE IMPLEMENTAÇÃO do valor: a decisão homologada exige que o
 * teto EXISTA, não fixa o número.
 */
export const MAXIMO_DE_ENTRADAS = 50_000;

/**
 * Poda global oportunista: a cada N admissões, uma varredura remove entradas
 * inteiramente vencidas. Não existe timer — nenhum `setInterval` é criado,
 * para que o limitador não segure o event loop no encerramento do processo.
 */
const INTERVALO_DE_VARREDURA = 1_000;

/**
 * Quantas entradas o despejo examina antes de decidir (`F-05`).
 *
 * DECISÃO LOCAL: varrer o mapa inteiro a cada admissão no teto seria O(n) por
 * requisição — sob saturação sustentada, o próprio mecanismo de defesa viraria
 * amplificador de CPU. Uma amostra das entradas mais antigas mantém o custo
 * constante e preserva integralmente a propriedade que importa: bucket
 * bloqueado ou com reserva em voo NUNCA é despejado. Quando a amostra não tem
 * candidato seguro, a admissão é recusada — nunca se sacrifica um bloqueio.
 */
export const AMOSTRA_DE_DESPEJO = 64;

/** Veredicto do limitador. Não carrega identificador, IP nem contadores. */
export interface VeredictoLimite {
  readonly bloqueado: boolean;
  /**
   * Segundos até a tentativa mais antiga da janela vencer — valor do
   * cabeçalho `Retry-After`. Sempre `>= 1` quando bloqueado e nunca acima de
   * `RETRY_AFTER_MAXIMO_SEGUNDOS`; `0` quando não bloqueado.
   */
  readonly retryAfterSegundos: number;
}

const LIBERADO: VeredictoLimite = Object.freeze({
  bloqueado: false,
  retryAfterSegundos: 0,
});

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

interface Bucket {
  /** Instantes monotônicos das falhas dentro da janela. */
  readonly falhas: number[];
  /** Tentativas admitidas e ainda não encerradas. */
  emVoo: number;
}

interface Dimensao {
  readonly limite: number;
  /** chave já hasheada/normalizada → bucket. */
  readonly entradas: Map<string, Bucket>;
  /**
   * Cursor de despejo (`F3R-03`): iterador VIVO do `Map`, preservado entre
   * admissões para que a amostra avance em vez de recomeçar na cabeça.
   * `null` quando ainda não existe ou quando se esgotou — recriá-lo é O(1).
   * Iteradores de `Map` toleram remoção de entradas durante a iteração.
   */
  cursor: Iterator<[string, Bucket]> | null;
}

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

  readonly #porIdentificador: Dimensao = {
    limite: LIMITE_POR_IDENTIFICADOR,
    entradas: new Map(),
    cursor: null,
  };

  readonly #porIp: Dimensao = {
    limite: LIMITE_POR_IP,
    entradas: new Map(),
    cursor: null,
  };

  #admissoesDesdeVarredura = 0;

  /**
   * Total de candidatos examinados pela política de despejo desde a criação —
   * exposto EXCLUSIVAMENTE para que o teste prove que o custo por admissão
   * fica limitado pela amostra e não cresce com o tamanho do mapa (`F3R-03`).
   * Não participa de nenhuma decisão.
   */
  #candidatosVisitados = 0;

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
   * também sob concorrência.
   */
  adquirir(identificadorNormalizado: string, ip: string): ResultadoAquisicao {
    const agora = this.#agora();
    const chaveId = this.#chaveDoIdentificador(identificadorNormalizado);
    const chaveIp = normalizarIp(ip);

    const porIdentificador = this.#avaliar(this.#porIdentificador, chaveId, agora);
    const porIp = this.#avaliar(this.#porIp, chaveIp, agora);
    if (porIdentificador.bloqueado || porIp.bloqueado) {
      return { admitida: false, veredicto: this.#pior(porIdentificador, porIp) };
    }

    // Reserva efetiva. Se a segunda dimensão não couber no mapa, a primeira é
    // desfeita — nunca se reserva uma dimensão deixando a outra sem reserva.
    if (!this.#reservar(this.#porIdentificador, chaveId, agora)) {
      return { admitida: false, veredicto: this.#transitorio() };
    }
    if (!this.#reservar(this.#porIp, chaveIp, agora)) {
      this.#encerrarReserva(this.#porIdentificador, chaveId, null);
      return { admitida: false, veredicto: this.#transitorio() };
    }

    let encerrada = false;
    const encerrar = (instanteDaFalha: number | null): void => {
      if (encerrada) return;
      encerrada = true;
      this.#encerrarReserva(this.#porIdentificador, chaveId, instanteDaFalha);
      this.#encerrarReserva(this.#porIp, chaveIp, instanteDaFalha);
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
    return this.#pior(
      this.#avaliar(
        this.#porIdentificador,
        this.#chaveDoIdentificador(identificadorNormalizado),
        agora,
      ),
      this.#avaliar(this.#porIp, normalizarIp(ip), agora),
    );
  }

  /** Quantidade de chaves vivas por dimensão — exposto para prova de poda. */
  medirEntradas(): { readonly identificadores: number; readonly ips: number } {
    return {
      identificadores: this.#porIdentificador.entradas.size,
      ips: this.#porIp.entradas.size,
    };
  }

  /** Total de reservas em voo — exposto para provar que nenhuma vaza. */
  medirEmVoo(): { readonly identificadores: number; readonly ips: number } {
    const somar = (d: Dimensao): number => {
      let total = 0;
      for (const bucket of d.entradas.values()) total += bucket.emVoo;
      return total;
    };
    return {
      identificadores: somar(this.#porIdentificador),
      ips: somar(this.#porIp),
    };
  }

  /**
   * Candidatos examinados pela política de despejo desde a criação — exposto
   * EXCLUSIVAMENTE para prova de complexidade (`F3R-03`). O teste mede o
   * DELTA por admissão e exige que ele fique limitado por `AMOSTRA_DE_DESPEJO`,
   * provando que nenhuma admissão varre o mapa inteiro.
   */
  medirCandidatosVisitados(): number {
    return this.#candidatosVisitados;
  }

  /**
   * Chaves vivas da dimensão de identificador — exposto EXCLUSIVAMENTE para
   * que o teste prove que nenhuma delas é (ou contém) um identificador em
   * claro. São digests HMAC hexadecimais; conhecê-los não revela o
   * identificador sem a chave do processo.
   */
  listarChavesDeIdentificadorParaProva(): readonly string[] {
    return [...this.#porIdentificador.entradas.keys()];
  }

  #chaveDoIdentificador(identificadorNormalizado: string): string {
    return createHmac("sha256", this.#chaveHmac)
      .update(identificadorNormalizado, "utf8")
      .digest("hex");
  }

  /** Pior (mais restritivo) de dois vereditos. */
  #pior(a: VeredictoLimite, b: VeredictoLimite): VeredictoLimite {
    if (!a.bloqueado && !b.bloqueado) return LIBERADO;
    return {
      bloqueado: true,
      retryAfterSegundos: Math.min(
        RETRY_AFTER_MAXIMO_SEGUNDOS,
        Math.max(a.retryAfterSegundos, b.retryAfterSegundos),
      ),
    };
  }

  #transitorio(): VeredictoLimite {
    return {
      bloqueado: true,
      retryAfterSegundos: RETRY_AFTER_TRANSITORIO_SEGUNDOS,
    };
  }

  /**
   * Avalia uma dimensão contra `falhas_vivas + emVoo`, podando a própria chave
   * antes de decidir.
   *
   * A poda por chave acontece em TODA leitura: sem ela, uma janela vencida
   * continuaria bloqueando até que algo mais a limpasse — o limite deixaria de
   * ser temporal e viraria lockout, contra `D-2.3D-06`.
   */
  #avaliar(dimensao: Dimensao, chave: string, agora: number): VeredictoLimite {
    const bucket = dimensao.entradas.get(chave);
    if (bucket === undefined) return LIBERADO;
    this.#podarChave(bucket, agora);
    this.#descartarSeVazio(dimensao, chave, bucket);
    if (bucket.falhas.length + bucket.emVoo < dimensao.limite) return LIBERADO;
    return {
      bloqueado: true,
      retryAfterSegundos: this.#retryAfterDaDimensao(bucket, dimensao, agora),
    };
  }

  /**
   * `Retry-After` de uma dimensão bloqueada.
   *
   * Se o bloqueio decorre de falhas JÁ PERSISTIDAS suficientes, o valor é o
   * tempo real até a mais antiga sair da janela. Se decorre apenas de
   * tentativas em voo, é a espera transitória — as reservas concorrentes se
   * desfazem em milissegundos e não há motivo para mandar esperar 15 minutos.
   */
  #retryAfterDaDimensao(bucket: Bucket, dimensao: Dimensao, agora: number): number {
    if (bucket.falhas.length < dimensao.limite) {
      return RETRY_AFTER_TRANSITORIO_SEGUNDOS;
    }
    const maisAntiga = bucket.falhas[0] as number;
    const restanteMs = maisAntiga + JANELA_MS - agora;
    return Math.min(
      RETRY_AFTER_MAXIMO_SEGUNDOS,
      Math.max(1, Math.ceil(restanteMs / 1000)),
    );
  }

  /**
   * Reserva UMA vaga na dimensão. `false` quando o mapa está no teto e não há
   * candidato SEGURO a despejo — caso em que o chamador devolve saturação
   * transitória em vez de expulsar um bloqueio vigente (`F-05`).
   */
  #reservar(dimensao: Dimensao, chave: string, agora: number): boolean {
    const existente = dimensao.entradas.get(chave);
    if (existente !== undefined) {
      existente.emVoo += 1;
      return true;
    }
    if (!this.#abrirEspaco(dimensao, agora)) return false;
    dimensao.entradas.set(chave, { falhas: [], emVoo: 1 });
    return true;
  }

  /**
   * Encerra UMA reserva. Com `instanteDaFalha` não nulo, a vaga vira falha
   * real na janela; com `null`, apenas desaparece.
   */
  #encerrarReserva(
    dimensao: Dimensao,
    chave: string,
    instanteDaFalha: number | null,
  ): void {
    const bucket = dimensao.entradas.get(chave);
    if (bucket === undefined) return;
    if (bucket.emVoo > 0) bucket.emVoo -= 1;
    if (instanteDaFalha !== null) {
      this.#podarChave(bucket, instanteDaFalha);
      bucket.falhas.push(instanteDaFalha);
      // O array de uma chave nunca cresce além do limite: instantes excedentes
      // não acrescentam informação — a decisão só olha o mais antigo dos
      // `limite` últimos. Consumo por chave O(limite), constante.
      if (bucket.falhas.length > dimensao.limite) {
        bucket.falhas.splice(0, bucket.falhas.length - dimensao.limite);
      }
    }
    this.#descartarSeVazio(dimensao, chave, bucket);
  }

  /**
   * Remove desta chave as falhas fora da janela. NÃO apaga a chave — a
   * deleção pertence aos chamadores, porque `#encerrarReserva` poda ANTES de
   * acrescentar a falha nova e uma deleção aqui deixaria o bucket órfão do
   * mapa (a falha seria empilhada num objeto já descartado).
   */
  #podarChave(bucket: Bucket, agora: number): void {
    const corte = agora - JANELA_MS;
    let vencidas = 0;
    while (vencidas < bucket.falhas.length && (bucket.falhas[vencidas] as number) <= corte) {
      vencidas += 1;
    }
    if (vencidas > 0) bucket.falhas.splice(0, vencidas);
  }

  /**
   * Descarta a chave quando o bucket ficou sem falhas vivas E sem reserva em
   * voo. Uma chave com reserva NUNCA é apagada: apagá-la perderia o contador
   * de concorrência daquela tentativa.
   */
  #descartarSeVazio(dimensao: Dimensao, chave: string, bucket: Bucket): void {
    if (bucket.falhas.length === 0 && bucket.emVoo === 0) {
      dimensao.entradas.delete(chave);
    }
  }

  /**
   * Garante espaço para uma chave NOVA, respeitando `MAXIMO_DE_ENTRADAS`.
   *
   * `F-05` — política de despejo corrigida. A versão anterior removia a
   * entrada de expiração mais próxima, que é exatamente a da vítima bloqueada
   * há mais tempo: saturar o mapa RESETAVA o bloqueio do alvo. Agora:
   *
   *   1. varredura de vencidos primeiro — nada vivo é sacrificado se houver
   *      lixo a recolher;
   *   2. NUNCA é despejável um bucket BLOQUEADO (`falhas + emVoo >= limite`)
   *      nem um bucket COM RESERVA EM VOO;
   *   3. entre os candidatos seguros, vence o de MENOR número de falhas; no
   *      empate, o mais antigo — perde-se o mínimo de informação protetiva;
   *   4. se não houver candidato seguro, a admissão é RECUSADA (`false`) e o
   *      chamador responde saturação transitória. Recusar é conservador:
   *      preserva todos os bloqueios vigentes e mantém o teto de memória.
   *
   * `F3R-03` acrescenta o CURSOR e a PODA LOCAL. É legítimo que UMA admissão
   * seja recusada porque sua amostra de 64 não continha candidato seguro; o
   * que deixou de ser possível é a inanição INDEFINIDA por posição no `Map`:
   * a amostra seguinte continua adiante, e um prefixo inelegível de `k`
   * entradas é atravessado em ~`ceil(k / AMOSTRA_DE_DESPEJO)` admissões.
   */
  #abrirEspaco(dimensao: Dimensao, agora: number): boolean {
    this.#admissoesDesdeVarredura += 1;
    // A varredura é PERIÓDICA, nunca disparada por estar no teto: disparar a
    // cada admissão saturada custaria O(n) por requisição hostil — a mesma
    // amplificação de CPU que a amostragem de despejo existe para evitar.
    if (this.#admissoesDesdeVarredura >= INTERVALO_DE_VARREDURA) {
      this.#admissoesDesdeVarredura = 0;
      this.#varrer(agora);
    }
    if (dimensao.entradas.size < MAXIMO_DE_ENTRADAS) return true;

    // AMOSTRAGEM LIMITADA E ROTATIVA, nunca varredura total. Um laço sobre as
    // 50 000 entradas a cada admissão tornaria a própria saturação um
    // amplificador de CPU — O(n) por requisição hostil, justamente quando o
    // serviço está sob pressão.
    let vitima: string | null = null;
    let melhorFalhas = Number.POSITIVE_INFINITY;
    let melhorInstante = Number.POSITIVE_INFINITY;

    for (let examinadas = 0; examinadas < AMOSTRA_DE_DESPEJO; examinadas += 1) {
      const candidato = this.#proximoCandidato(dimensao);
      if (candidato === null) break;
      const [chave, bucket] = candidato;
      this.#candidatosVisitados += 1;

      // PODA LOCAL antes de classificar (`F3R-03`): sem ela, um bucket cuja
      // janela inteira já venceu continuaria contando como bloqueado, e a
      // expiração só seria reconhecida pela varredura periódica.
      this.#podarChave(bucket, agora);

      // Reserva em voo é intocável — `F-05`, primeira guarda.
      if (bucket.emVoo > 0) continue;

      // Vazio após a poda: lixo puro. Remover não sacrifica informação
      // protetiva alguma, e é estritamente melhor que despejar um bucket vivo.
      if (bucket.falhas.length === 0) {
        dimensao.entradas.delete(chave);
        return true;
      }

      // Bloqueado é intocável — `F-05`, segunda guarda, agora avaliada sobre
      // as falhas EFETIVAMENTE vivas.
      if (bucket.falhas.length + bucket.emVoo >= dimensao.limite) continue;

      const primeira = bucket.falhas[0] as number;
      if (
        bucket.falhas.length < melhorFalhas ||
        (bucket.falhas.length === melhorFalhas && primeira < melhorInstante)
      ) {
        melhorFalhas = bucket.falhas.length;
        melhorInstante = primeira;
        vitima = chave;
      }
    }
    // Nenhum candidato seguro NESTA amostra => RECUSA a admissão. Conservador
    // por desenho: preserva todo bloqueio vigente e o teto de memória, ao
    // preço de recusar transitoriamente uma chave nova. A amostra seguinte
    // retoma adiante, de modo que a recusa não se perpetua (`F3R-03`).
    if (vitima === null) return false;
    dimensao.entradas.delete(vitima);
    return true;
  }

  /**
   * Próximo candidato do cursor rotativo (`F3R-03`).
   *
   * Custo O(1): um `next()` no iterador vivo do `Map`. Quando o iterador se
   * esgota, é recriado — o que reinicia o giro, não o ancora. As duas
   * tentativas cobrem exatamente o caso "cursor esgotado nesta chamada"; com o
   * mapa não vazio, a segunda sempre produz valor.
   */
  #proximoCandidato(dimensao: Dimensao): [string, Bucket] | null {
    if (dimensao.entradas.size === 0) return null;
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      dimensao.cursor ??= dimensao.entradas.entries();
      const passo = dimensao.cursor.next();
      if (passo.done !== true) return passo.value;
      dimensao.cursor = null;
    }
    return null;
  }

  /**
   * Varredura global: apaga toda entrada cuja janela inteira já venceu e que
   * não tenha reserva em voo.
   */
  #varrer(agora: number): void {
    const corte = agora - JANELA_MS;
    for (const dimensao of [this.#porIdentificador, this.#porIp]) {
      for (const [chave, bucket] of dimensao.entradas) {
        if (bucket.emVoo > 0) continue;
        const maisRecente = bucket.falhas[bucket.falhas.length - 1];
        if (maisRecente === undefined || maisRecente <= corte) {
          dimensao.entradas.delete(chave);
        }
      }
    }
  }
}
