// TechLab Fisio — Etapa 2.3D-B / F3 — anti-abuso do login (`D-2.3D-06`).
//
// Prova as DUAS dimensões, a janela, o `Retry-After`, a poda/expiração, o teto
// de entradas e — a propriedade que a decisão exige em letra — que o
// identificador NUNCA entra em claro no contador.
//
// Cobre também as correções da revisão independente:
//   `F-01` reserva de tentativa EM VOO — o gate passa a valer sob concorrência;
//   `F-05` despejo que nunca sacrifica um bucket bloqueado ou reservado;
//   `F-09` `Retry-After` limitado à janela homologada;
//   `F-10` `::ffff:a.b.c.d` e `a.b.c.d` são o MESMO bucket.
//
// O relógio é injetado: as bordas de uma janela de 15 minutos só são
// alcançáveis no instante exato com controle do tempo, e um teste que
// dependesse de espera real seria lento e não determinístico. A estrutura
// medida é a de produção, integralmente.

import { describe, expect, it } from "@jest/globals";

import {
  AMOSTRA_DE_DESPEJO,
  JANELA_MS,
  LIMITE_POR_IDENTIFICADOR,
  LIMITE_POR_IP,
  LimitadorLogin,
  MAXIMO_DE_ENTRADAS,
  RETRY_AFTER_MAXIMO_SEGUNDOS,
  normalizarIp,
} from "../src/auth/limitador-login.js";
import type { ReservaTentativa } from "../src/auth/limitador-login.js";

const IDENTIFICADOR = "usuario-sintetico@clinica.local";
const IP = "203.0.113.7";

/** Relógio controlado em milissegundos (monotônico por construção). */
class Relogio {
  #agora = 1_000_000;
  ler = (): number => this.#agora;
  avancar(ms: number): void {
    this.#agora += ms;
  }
}

function novoLimitador(): { limitador: LimitadorLogin; relogio: Relogio } {
  const relogio = new Relogio();
  return { limitador: new LimitadorLogin({ agora: relogio.ler }), relogio };
}

/**
 * Uma tentativa COMPLETA que termina em falha: adquire e converte a reserva.
 * Devolve `false` quando o gate recusou a admissão.
 */
function tentarEFalhar(
  limitador: LimitadorLogin,
  identificador: string,
  ip: string,
): boolean {
  const aquisicao = limitador.adquirir(identificador, ip);
  if (!aquisicao.admitida) return false;
  aquisicao.reserva.registrarFalha();
  return true;
}

describe("D-2.3D-06 — limites homologados", () => {
  it("os limites e a janela são exatamente os da decisão", () => {
    expect(LIMITE_POR_IDENTIFICADOR).toBe(5);
    expect(LIMITE_POR_IP).toBe(30);
    expect(JANELA_MS).toBe(15 * 60 * 1000);
    expect(RETRY_AFTER_MAXIMO_SEGUNDOS).toBe(900);
  });

  it("5 falhas por identificador em 15 min bloqueiam a 6ª tentativa", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      // IPs distintos a cada falha: isola a dimensão de identificador.
      expect(tentarEFalhar(limitador, IDENTIFICADOR, `198.51.100.${String(i)}`)).toBe(true);
    }
    expect(tentarEFalhar(limitador, IDENTIFICADOR, "198.51.100.200")).toBe(false);
  });

  it("30 falhas por IP em 15 min bloqueiam a 31ª tentativa", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IP; i += 1) {
      expect(tentarEFalhar(limitador, `alvo-${String(i)}@clinica.local`, IP)).toBe(true);
    }
    expect(tentarEFalhar(limitador, "alvo-novo@clinica.local", IP)).toBe(false);
  });

  it("as duas dimensões são independentes — bloquear uma não bloqueia a outra", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, IP);
    }
    expect(limitador.consultar(IDENTIFICADOR, "192.0.2.9").bloqueado).toBe(true);
    expect(limitador.consultar("outro@clinica.local", IP).bloqueado).toBe(false);
  });

  it("não existe lockout duro: a janela LIBERA quando a falha mais antiga vence", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, IP);
    }
    expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(true);
    relogio.avancar(JANELA_MS - 1);
    expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(true);
    relogio.avancar(1);
    expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(false);
  });

  it("Retry-After reflete o tempo até a falha mais antiga sair da janela", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, IP);
    }
    expect(limitador.consultar(IDENTIFICADOR, IP).retryAfterSegundos).toBe(
      JANELA_MS / 1000,
    );
    relogio.avancar(10 * 60 * 1000);
    expect(limitador.consultar(IDENTIFICADOR, IP).retryAfterSegundos).toBe(5 * 60);
    relogio.avancar(JANELA_MS - 10 * 60 * 1000 - 1);
    const veredicto = limitador.consultar(IDENTIFICADOR, IP);
    expect(veredicto.bloqueado).toBe(true);
    expect(veredicto.retryAfterSegundos).toBeGreaterThanOrEqual(1);
  });

  it("F-09 — Retry-After NUNCA excede a janela homologada, nem sob relógio anômalo", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, IP);
    }
    // Regressão de 5 min: com `Date.now()` isto produzia 1200 s — acima dos
    // 900 s da janela. O relógio de produção agora é monotônico, e o teto é a
    // segunda barreira.
    relogio.avancar(-5 * 60_000);
    const veredicto = limitador.consultar(IDENTIFICADOR, IP);
    expect(veredicto.bloqueado).toBe(true);
    expect(veredicto.retryAfterSegundos).toBeLessThanOrEqual(
      RETRY_AFTER_MAXIMO_SEGUNDOS,
    );
  });

  it("quando as duas dimensões bloqueiam, prevalece o MAIOR Retry-After", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IP; i += 1) {
      tentarEFalhar(limitador, `ruido-${String(i)}@clinica.local`, IP);
    }
    relogio.avancar(10 * 60 * 1000);
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, "192.0.2.50");
    }
    expect(limitador.consultar(IDENTIFICADOR, IP).retryAfterSegundos).toBe(15 * 60);
  });

  it("consultar NÃO contabiliza nem reserva — só a tentativa completa conta", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < 100; i += 1) {
      expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(false);
    }
    expect(limitador.medirEntradas()).toEqual({ identificadores: 0, ips: 0 });
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("tentativa já bloqueada não estende a janela — sem lockout progressivo", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, IP);
    }
    for (let i = 0; i < 50; i += 1) {
      expect(limitador.adquirir(IDENTIFICADOR, IP).admitida).toBe(false);
    }
    relogio.avancar(JANELA_MS);
    expect(limitador.adquirir(IDENTIFICADOR, IP).admitida).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// `F-01` — reserva de tentativa em voo
// ---------------------------------------------------------------------------

describe("F-01 — o gate vale sob CONCORRÊNCIA, não só sequencialmente", () => {
  it("N tentativas simultâneas para o mesmo identificador: só `limite` são admitidas", () => {
    const { limitador } = novoLimitador();
    const CONCORRENTES = 12;
    const reservas: ReservaTentativa[] = [];
    let recusadas = 0;

    // NENHUMA reserva é encerrada durante o laço — é exatamente o estado em
    // que N requisições estão dentro do `await` do banco/Argon2.
    for (let i = 0; i < CONCORRENTES; i += 1) {
      const aquisicao = limitador.adquirir(IDENTIFICADOR, `198.51.100.${String(i)}`);
      if (aquisicao.admitida) reservas.push(aquisicao.reserva);
      else recusadas += 1;
    }

    expect(reservas).toHaveLength(LIMITE_POR_IDENTIFICADOR);
    expect(recusadas).toBe(CONCORRENTES - LIMITE_POR_IDENTIFICADOR);
    expect(limitador.medirEmVoo().identificadores).toBe(LIMITE_POR_IDENTIFICADOR);

    for (const reserva of reservas) reserva.registrarFalha();
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("N tentativas simultâneas do mesmo IP: só `limite` são admitidas", () => {
    const { limitador } = novoLimitador();
    const CONCORRENTES = 45;
    const reservas: ReservaTentativa[] = [];
    for (let i = 0; i < CONCORRENTES; i += 1) {
      const aquisicao = limitador.adquirir(`c-${String(i)}@clinica.local`, IP);
      if (aquisicao.admitida) reservas.push(aquisicao.reserva);
    }
    expect(reservas).toHaveLength(LIMITE_POR_IP);
    expect(limitador.medirEmVoo().ips).toBe(LIMITE_POR_IP);
    for (const reserva of reservas) reserva.liberar();
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("reserva LIBERADA (sucesso) não vira falha — a janela permanece limpa", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < 20; i += 1) {
      const aquisicao = limitador.adquirir(IDENTIFICADOR, IP);
      expect(aquisicao.admitida).toBe(true);
      if (aquisicao.admitida) aquisicao.reserva.liberar();
    }
    expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(false);
    expect(limitador.medirEntradas()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("reserva liberada em ERRO TÉCNICO também não conta falha", () => {
    // Mesma primitiva do caminho de sucesso: o serviço libera no `finally`.
    const { limitador } = novoLimitador();
    for (let i = 0; i < 50; i += 1) {
      const aquisicao = limitador.adquirir(IDENTIFICADOR, IP);
      if (aquisicao.admitida) aquisicao.reserva.liberar();
    }
    expect(limitador.consultar(IDENTIFICADOR, IP).bloqueado).toBe(false);
  });

  it("encerrar a reserva é IDEMPOTENTE — o `finally` do chamador é seguro", () => {
    const { limitador } = novoLimitador();
    const aquisicao = limitador.adquirir(IDENTIFICADOR, IP);
    expect(aquisicao.admitida).toBe(true);
    if (!aquisicao.admitida) return;

    aquisicao.reserva.registrarFalha();
    // O `finally` chama `liberar()` mesmo depois da falha: não pode desfazê-la
    // nem decrementar o contador de novo.
    aquisicao.reserva.liberar();
    aquisicao.reserva.liberar();
    aquisicao.reserva.registrarFalha();

    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
    // Exatamente UMA falha foi contabilizada: faltam 4 para bloquear.
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR - 2; i += 1) {
      expect(tentarEFalhar(limitador, IDENTIFICADOR, IP)).toBe(true);
    }
    expect(tentarEFalhar(limitador, IDENTIFICADOR, IP)).toBe(true);
    expect(tentarEFalhar(limitador, IDENTIFICADOR, IP)).toBe(false);
  });

  it("a aquisição é ATÔMICA nas duas dimensões — nunca reserva só uma", () => {
    const { limitador } = novoLimitador();
    // Satura o IP com identificadores distintos, deixando as reservas em voo.
    const reservas: ReservaTentativa[] = [];
    for (let i = 0; i < LIMITE_POR_IP; i += 1) {
      const a = limitador.adquirir(`s-${String(i)}@clinica.local`, IP);
      if (a.admitida) reservas.push(a.reserva);
    }
    const antes = limitador.medirEmVoo();

    // Uma tentativa nova falha pela dimensão de IP. A dimensão de
    // identificador — que estava livre — NÃO pode ficar com reserva órfã.
    const recusada = limitador.adquirir("virgem@clinica.local", IP);
    expect(recusada.admitida).toBe(false);
    expect(limitador.medirEmVoo()).toEqual(antes);
    expect(
      limitador.listarChavesDeIdentificadorParaProva().length,
    ).toBe(LIMITE_POR_IP);

    for (const r of reservas) r.liberar();
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("saturação transitória devolve Retry-After curto, não 15 minutos", () => {
    const { limitador } = novoLimitador();
    const reservas: ReservaTentativa[] = [];
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      const a = limitador.adquirir(IDENTIFICADOR, `198.51.100.${String(i)}`);
      if (a.admitida) reservas.push(a.reserva);
    }
    const recusada = limitador.adquirir(IDENTIFICADOR, "198.51.100.99");
    expect(recusada.admitida).toBe(false);
    if (!recusada.admitida) {
      // Disputa momentânea: as reservas se desfazem em milissegundos.
      expect(recusada.veredicto.retryAfterSegundos).toBe(1);
    }
    for (const r of reservas) r.liberar();
  });

  it("com falhas PERSISTIDAS, prevalece o cálculo real da janela", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, `198.51.100.${String(i)}`);
    }
    const recusada = limitador.adquirir(IDENTIFICADOR, "198.51.100.99");
    expect(recusada.admitida).toBe(false);
    if (!recusada.admitida) {
      expect(recusada.veredicto.retryAfterSegundos).toBe(JANELA_MS / 1000);
    }
  });
});

describe("D-2.3D-06 — o identificador entra HASHEADO, nunca em claro", () => {
  it("nenhuma chave do contador é, contém ou revela o identificador", () => {
    const { limitador } = novoLimitador();
    tentarEFalhar(limitador, IDENTIFICADOR, IP);
    const chaves = limitador.listarChavesDeIdentificadorParaProva();
    expect(chaves).toHaveLength(1);
    const chave = chaves[0] as string;
    expect(chave).not.toBe(IDENTIFICADOR);
    expect(chave).not.toContain(IDENTIFICADOR);
    expect(chave).not.toContain("usuario-sintetico");
    expect(chave).not.toContain("clinica.local");
    expect(chave).not.toContain("@");
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o digest é keyed por processo — duas instâncias não produzem a mesma chave", () => {
    const a = new LimitadorLogin();
    const b = new LimitadorLogin();
    tentarEFalhar(a, IDENTIFICADOR, IP);
    tentarEFalhar(b, IDENTIFICADOR, IP);
    expect(a.listarChavesDeIdentificadorParaProva()[0]).not.toBe(
      b.listarChavesDeIdentificadorParaProva()[0],
    );
  });

  it("o mesmo identificador cai sempre na mesma chave dentro do processo", () => {
    const { limitador } = novoLimitador();
    tentarEFalhar(limitador, IDENTIFICADOR, IP);
    tentarEFalhar(limitador, IDENTIFICADOR, IP);
    expect(limitador.medirEntradas().identificadores).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// `F-10` — normalização de IP
// ---------------------------------------------------------------------------

describe("F-10 — IPv4-mapped IPv6 e IPv4 são o MESMO bucket", () => {
  it("normalizarIp reduz ::ffff:a.b.c.d a a.b.c.d", () => {
    expect(normalizarIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(normalizarIp("::FFFF:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizarIp("127.0.0.1")).toBe("127.0.0.1");
    // Não é biblioteca de rede: IPv6 real e formas não-IPv4 passam intactas.
    expect(normalizarIp("::1")).toBe("::1");
    expect(normalizarIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizarIp("::ffff:cafe")).toBe("::ffff:cafe");
  });

  it("as duas formas compartilham o orçamento da dimensão de IP", () => {
    const { limitador } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IP; i += 1) {
      expect(
        tentarEFalhar(limitador, `m-${String(i)}@clinica.local`, "127.0.0.1"),
      ).toBe(true);
    }
    // Antes da correção, esta forma abria um segundo orçamento.
    expect(
      tentarEFalhar(limitador, "novo@clinica.local", "::ffff:127.0.0.1"),
    ).toBe(false);
    expect(limitador.medirEntradas().ips).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// `F-05` — saturação e despejo
// ---------------------------------------------------------------------------

describe("F-05 — a saturação NÃO reseta um bloqueio vigente", () => {
  /**
   * Gerador de IPs DISTINTOS.
   *
   * Indispensável para que estes testes não sejam vacuamente verdadeiros: com
   * poucos IPs, a dimensão de IP (30 falhas) satura primeiro, o laço para de
   * admitir e o mapa de identificadores JAMAIS atinge o teto — de modo que
   * nenhum despejo chega a acontecer e o teste passaria mesmo com a política
   * de despejo quebrada. Foi exatamente esse o defeito da primeira versão
   * destes testes, detectado pelo mutation challenge `C-03`.
   */
  function geradorDeIps(): () => string {
    let n = 0;
    return (): string => {
      n += 1;
      return `10.${String((n >> 16) & 255)}.${String((n >> 8) & 255)}.${String(n & 255)}`;
    };
  }

  it("a vítima bloqueada continua bloqueada após flooding além do teto", () => {
    const { limitador, relogio } = novoLimitador();
    const proximoIp = geradorDeIps();
    const VITIMA = "vitima@sintetico.local";
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(limitador, VITIMA, proximoIp());
    }
    expect(limitador.consultar(VITIMA, proximoIp()).bloqueado).toBe(true);

    relogio.avancar(60_000);
    for (let i = 0; i < MAXIMO_DE_ENTRADAS + 500; i += 1) {
      tentarEFalhar(limitador, `flood-${String(i)}@x.local`, proximoIp());
    }

    // NÃO-VACUIDADE: o teto foi de fato atingido, logo houve despejo.
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    // A propriedade central: o bloqueio sobrevive à saturação.
    expect(limitador.consultar(VITIMA, proximoIp()).bloqueado).toBe(true);
  });

  it("com TODOS os candidatos bloqueados, a admissão é RECUSADA em vez de despejar", () => {
    // Caso-limite que isola a guarda "nunca despejar bucket bloqueado": aqui
    // não existe candidato seguro, e a única saída correta é recusar a chave
    // nova. Sem a guarda, o desempate escolheria o bucket MAIS ANTIGO — a
    // primeira vítima — e o bloqueio dela evaporaria.
    const { limitador } = novoLimitador();
    const proximoIp = geradorDeIps();
    for (let k = 0; k < MAXIMO_DE_ENTRADAS; k += 1) {
      for (let f = 0; f < LIMITE_POR_IDENTIFICADOR; f += 1) {
        tentarEFalhar(limitador, `bloq-${String(k)}@x.local`, proximoIp());
      }
    }
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    expect(limitador.consultar("bloq-0@x.local", proximoIp()).bloqueado).toBe(true);

    const nova = limitador.adquirir("nunca-vista@x.local", proximoIp());
    expect(nova.admitida).toBe(false);
    if (!nova.admitida) {
      expect(nova.veredicto.bloqueado).toBe(true);
      expect(nova.veredicto.retryAfterSegundos).toBeGreaterThanOrEqual(1);
    }
    // Nada foi sacrificado: o teto é respeitado E o bloqueio mais antigo vive.
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    expect(limitador.consultar("bloq-0@x.local", proximoIp()).bloqueado).toBe(true);
  }, 120_000);

  it("o teto NUNCA é excedido", () => {
    const { limitador } = novoLimitador();
    const proximoIp = geradorDeIps();
    for (let i = 0; i < MAXIMO_DE_ENTRADAS + 2_000; i += 1) {
      tentarEFalhar(limitador, `k-${String(i)}@x.local`, proximoIp());
    }
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
  });

  it("nenhuma reserva EM VOO é despejada pela saturação", () => {
    const { limitador } = novoLimitador();
    const proximoIp = geradorDeIps();
    const aquisicao = limitador.adquirir("em-voo@sintetico.local", proximoIp());
    expect(aquisicao.admitida).toBe(true);
    for (let i = 0; i < MAXIMO_DE_ENTRADAS + 200; i += 1) {
      tentarEFalhar(limitador, `f2-${String(i)}@x.local`, proximoIp());
    }
    // NÃO-VACUIDADE: o teto foi atingido — houve despejo de verdade.
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    // A reserva sobreviveu: um bucket com tentativa em voo tem ZERO falhas e
    // seria o primeiro escolhido pelo critério de "menor número de falhas" se
    // a guarda não existisse.
    expect(limitador.medirEmVoo().identificadores).toBe(1);
    if (aquisicao.admitida) aquisicao.reserva.liberar();
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("entradas EXPIRADAS são recolhidas antes de qualquer despejo de entrada viva", () => {
    const { limitador, relogio } = novoLimitador();
    const proximoIp = geradorDeIps();
    for (let i = 0; i < 2_000; i += 1) {
      tentarEFalhar(limitador, `velho-${String(i)}@x.local`, proximoIp());
    }
    expect(limitador.medirEntradas().identificadores).toBe(2_000);
    relogio.avancar(JANELA_MS + 1);
    for (let i = 0; i < 1_100; i += 1) {
      tentarEFalhar(limitador, `novo-${String(i)}@x.local`, proximoIp());
    }
    // As 2 000 antigas venceram e foram recolhidas pela varredura oportunista.
    expect(limitador.medirEntradas().identificadores).toBeLessThanOrEqual(1_100);
  });
});

// ---------------------------------------------------------------------------
// `F3R-03` — a amostragem de despejo não pode sofrer inanição por posição
// ---------------------------------------------------------------------------

describe("F3R-03 — cursor rotativo e poda local do candidato amostrado", () => {
  /**
   * Gerador de IPs DISTINTOS — mesma razão de não-vacuidade do bloco `F-05`:
   * com poucos IPs a dimensão de IP satura antes de o mapa de identificadores
   * atingir o teto, e nenhum despejo chegaria a acontecer.
   */
  function geradorDeIps(): () => string {
    let n = 0;
    return (): string => {
      n += 1;
      return `10.${String((n >> 16) & 255)}.${String((n >> 8) & 255)}.${String(n & 255)}`;
    };
  }

  /**
   * Satura o mapa de identificadores com um PREFIXO de buckets inelegíveis
   * (bloqueados, inseridos primeiro e portanto na cabeça do `Map`) seguido de
   * buckets seguros (uma falha cada). É exatamente a topologia adversarial que
   * a revisão mediu: candidatos seguros existem, mas atrás do prefixo.
   */
  function saturarComPrefixoBloqueado(bloqueadosNaCabeca: number): {
    limitador: LimitadorLogin;
    relogio: Relogio;
    proximoIp: () => string;
  } {
    const { limitador, relogio } = novoLimitador();
    const proximoIp = geradorDeIps();
    for (let k = 0; k < bloqueadosNaCabeca; k += 1) {
      for (let f = 0; f < LIMITE_POR_IDENTIFICADOR; f += 1) {
        tentarEFalhar(limitador, `cabeca-${String(k)}@x.local`, proximoIp());
      }
    }
    for (let i = 0; limitador.medirEntradas().identificadores < MAXIMO_DE_ENTRADAS; i += 1) {
      tentarEFalhar(limitador, `seguro-${String(i)}@x.local`, proximoIp());
    }
    return { limitador, relogio, proximoIp };
  }

  it("A — prefixo bloqueado do tamanho da amostra NÃO causa inanição", () => {
    const { limitador, proximoIp } = saturarComPrefixoBloqueado(AMOSTRA_DE_DESPEJO);
    // NÃO-VACUIDADE: o teto foi realmente atingido e há candidato seguro.
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    expect(limitador.consultar("cabeca-0@x.local", proximoIp()).bloqueado).toBe(true);

    // Antes da correção, TODA admissão nova era recusada — a amostra
    // recomeçava na cabeça bloqueada indefinidamente (2 000/2 000 medidos).
    let admitidas = 0;
    for (let i = 0; i < 10; i += 1) {
      const nova = limitador.adquirir(`novo-${String(i)}@x.local`, proximoIp());
      if (nova.admitida) {
        admitidas += 1;
        nova.reserva.liberar();
      }
    }
    expect(admitidas).toBeGreaterThan(0);
    // E o prefixo bloqueado NÃO foi sacrificado para conseguir isso.
    expect(limitador.consultar("cabeca-0@x.local", proximoIp()).bloqueado).toBe(true);
  }, 120_000);

  it("B — prefixo MAIOR que uma amostra é atravessado em amostras sucessivas", () => {
    const PREFIXO = AMOSTRA_DE_DESPEJO * 3 + 8;
    const { limitador, proximoIp } = saturarComPrefixoBloqueado(PREFIXO);
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);

    // O cursor avança ~AMOSTRA_DE_DESPEJO por tentativa; o limite abaixo é
    // usado APENAS para provar progresso — não é contrato público.
    const tetoDeTentativas = Math.ceil(PREFIXO / AMOSTRA_DE_DESPEJO) + 3;
    let tentativas = 0;
    let admitida = false;
    while (tentativas < tetoDeTentativas && !admitida) {
      tentativas += 1;
      const nova = limitador.adquirir(`atravessa-${String(tentativas)}@x.local`, proximoIp());
      if (nova.admitida) {
        admitida = true;
        nova.reserva.liberar();
      }
    }
    expect(admitida).toBe(true);
    expect(tentativas).toBeLessThanOrEqual(tetoDeTentativas);
    expect(limitador.consultar("cabeca-0@x.local", proximoIp()).bloqueado).toBe(true);
  }, 120_000);

  it("C — falha vencida do candidato amostrado é PODADA e ele volta a ser elegível", () => {
    // ISOLAMENTO DA PODA — e por que a construção é esta.
    //
    // Todo bucket do mapa fica PARCIALMENTE vencido: 4 falhas antigas (que
    // vencem) + 1 recente (que sobrevive). Isso separa a poda de duas outras
    // causas que fariam o teste passar sem ela:
    //
    //   - o CURSOR: não adianta ele avançar, porque NENHUM bucket do mapa é
    //     elegível sem poda — todos exibem 5 falhas;
    //   - a VARREDURA periódica: ela só apaga bucket cuja falha MAIS RECENTE
    //     venceu, e a 5ª falha continua viva. Nada aqui é varrível.
    //
    // Sem a poda, portanto, a amostra inteira parece bloqueada e a admissão é
    // recusada. Foi assim que o challenge `C-20` passou a ser detectado: a
    // primeira versão deste teste era vacuamente verdadeira, porque o cursor
    // sozinho já alcançava uma região segura do mapa.
    const { limitador, relogio } = novoLimitador();
    const proximoIp = geradorDeIps();
    const ANTIGAS = LIMITE_POR_IDENTIFICADOR - 1;

    for (let k = 0; k < MAXIMO_DE_ENTRADAS; k += 1) {
      for (let f = 0; f < ANTIGAS; f += 1) {
        tentarEFalhar(limitador, `parcial-${String(k)}@x.local`, proximoIp());
      }
    }
    relogio.avancar(JANELA_MS - 1_000);
    for (let k = 0; k < MAXIMO_DE_ENTRADAS; k += 1) {
      tentarEFalhar(limitador, `parcial-${String(k)}@x.local`, proximoIp());
    }
    // Agora TODOS têm 5 falhas => bloqueados.
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    expect(limitador.consultar("parcial-0@x.local", proximoIp()).bloqueado).toBe(true);

    // As 4 antigas vencem; a 5ª permanece viva — nada vira lixo varrível.
    relogio.avancar(2_000);

    const visitadosAntes = limitador.medirCandidatosVisitados();
    const nova = limitador.adquirir("apos-poda@x.local", proximoIp());

    // Antes da correção a elegibilidade lia `falhas.length` SEM podar: os 5
    // instantes continuavam contando e a admissão era recusada.
    expect(nova.admitida).toBe(true);
    if (nova.admitida) nova.reserva.liberar();
    // O custo continua limitado pela amostra das duas dimensões — a poda é
    // LOCAL aos candidatos amostrados, não uma varredura global disfarçada.
    expect(limitador.medirCandidatosVisitados() - visitadosAntes).toBeLessThanOrEqual(
      AMOSTRA_DE_DESPEJO * 2,
    );
    // E o bucket deixou de ser tratado como bloqueado.
    expect(limitador.consultar("parcial-1@x.local", proximoIp()).bloqueado).toBe(false);
  }, 300_000);

  it("D — bucket com RESERVA EM VOO na cabeça nunca é a vítima", () => {
    const { limitador } = novoLimitador();
    const proximoIp = geradorDeIps();
    // A reserva é a PRIMEIRA entrada do mapa: com zero falhas, seria a vítima
    // preferida pelo critério de "menor número de falhas" sem a guarda.
    const emVoo = limitador.adquirir("primeira-em-voo@x.local", proximoIp());
    expect(emVoo.admitida).toBe(true);
    for (let i = 0; limitador.medirEntradas().identificadores < MAXIMO_DE_ENTRADAS; i += 1) {
      tentarEFalhar(limitador, `enche-${String(i)}@x.local`, proximoIp());
    }
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);
    for (let i = 0; i < 50; i += 1) {
      const nova = limitador.adquirir(`pressao-${String(i)}@x.local`, proximoIp());
      if (nova.admitida) nova.reserva.liberar();
    }
    expect(limitador.medirEmVoo().identificadores).toBe(1);
    if (emVoo.admitida) emVoo.reserva.liberar();
    expect(limitador.medirEmVoo()).toEqual({ identificadores: 0, ips: 0 });
  }, 120_000);

  it("F — nenhuma admissão no teto varre o mapa inteiro", () => {
    const { limitador, proximoIp } = saturarComPrefixoBloqueado(AMOSTRA_DE_DESPEJO);
    expect(limitador.medirEntradas().identificadores).toBe(MAXIMO_DE_ENTRADAS);

    let pior = 0;
    for (let i = 0; i < 40; i += 1) {
      const antes = limitador.medirCandidatosVisitados();
      const nova = limitador.adquirir(`custo-${String(i)}@x.local`, proximoIp());
      if (nova.admitida) nova.reserva.liberar();
      pior = Math.max(pior, limitador.medirCandidatosVisitados() - antes);
    }
    // Duas dimensões, cada uma limitada por AMOSTRA_DE_DESPEJO. O ponto é que
    // o custo NÃO escala com MAXIMO_DE_ENTRADAS.
    expect(pior).toBeLessThanOrEqual(AMOSTRA_DE_DESPEJO * 2);
    expect(pior).toBeLessThan(MAXIMO_DE_ENTRADAS);
  }, 120_000);
});

describe("D-2.3D-06 — expiração e poda", () => {
  it("a entrada é PODADA quando a janela inteira vence", () => {
    const { limitador, relogio } = novoLimitador();
    tentarEFalhar(limitador, IDENTIFICADOR, IP);
    expect(limitador.medirEntradas()).toEqual({ identificadores: 1, ips: 1 });
    relogio.avancar(JANELA_MS + 1);
    limitador.consultar(IDENTIFICADOR, IP);
    expect(limitador.medirEntradas()).toEqual({ identificadores: 0, ips: 0 });
  });

  it("a poda remove SÓ os instantes vencidos, preservando os vivos", () => {
    const { limitador, relogio } = novoLimitador();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR - 1; i += 1) {
      tentarEFalhar(limitador, IDENTIFICADOR, `198.51.100.${String(i)}`);
    }
    relogio.avancar(10 * 60 * 1000);
    tentarEFalhar(limitador, IDENTIFICADOR, "198.51.100.99");
    expect(limitador.consultar(IDENTIFICADOR, "192.0.2.1").bloqueado).toBe(true);
    relogio.avancar(5 * 60 * 1000 + 1);
    expect(limitador.consultar(IDENTIFICADOR, "192.0.2.1").bloqueado).toBe(false);
    expect(limitador.medirEntradas().identificadores).toBe(1);
  });

  it("o teto de entradas existe e é finito", () => {
    expect(Number.isInteger(MAXIMO_DE_ENTRADAS)).toBe(true);
    expect(MAXIMO_DE_ENTRADAS).toBeGreaterThan(0);
    expect(Number.isFinite(MAXIMO_DE_ENTRADAS)).toBe(true);
  });

  it("nenhuma infraestrutura externa é usada — o estado vive no processo", () => {
    const a = new LimitadorLogin();
    const b = new LimitadorLogin();
    for (let i = 0; i < LIMITE_POR_IDENTIFICADOR; i += 1) {
      tentarEFalhar(a, IDENTIFICADOR, IP);
    }
    expect(a.consultar(IDENTIFICADOR, IP).bloqueado).toBe(true);
    expect(b.consultar(IDENTIFICADOR, IP).bloqueado).toBe(false);
    expect(b.medirEntradas()).toEqual({ identificadores: 0, ips: 0 });
  });
});
