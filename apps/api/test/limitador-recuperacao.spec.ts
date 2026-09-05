// TechLab Fisio — Etapa 2.3D-B / F6 — anti-abuso da conclusão de recuperação
// (segunda metade de `D-2.3D-06`: 10 tentativas / 15 min por IP).
//
// O relógio é injetado, como na suíte da F3: as bordas de uma janela de 15
// minutos só são alcançáveis no instante exato com controle do tempo.

import { describe, expect, it } from "@jest/globals";

import {
  JANELA_MS,
  MAXIMO_DE_ENTRADAS,
  RETRY_AFTER_MAXIMO_SEGUNDOS,
} from "../src/auth/dimensao-limite.js";
import {
  LIMITE_TENTATIVAS_RECUPERACAO_POR_IP,
  LimitadorRecuperacao,
} from "../src/recuperacao-senha/limitador-recuperacao.js";

const IP = "203.0.113.42";

class Relogio {
  #agora = 1_000_000;
  ler = (): number => this.#agora;
  avancar(ms: number): void {
    this.#agora += ms;
  }
}

function novo(): { limitador: LimitadorRecuperacao; relogio: Relogio } {
  const relogio = new Relogio();
  return { limitador: new LimitadorRecuperacao({ agora: relogio.ler }), relogio };
}

describe("D-2.3D-06 — limite de conclusão homologado", () => {
  it("o limite e a janela são exatamente os da decisão", () => {
    expect(LIMITE_TENTATIVAS_RECUPERACAO_POR_IP).toBe(10);
    expect(JANELA_MS).toBe(15 * 60 * 1000);
  });

  it("10 tentativas por IP em 15 min bloqueiam a 11ª", () => {
    const { limitador } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) {
      expect(limitador.tentar(IP).bloqueado).toBe(false);
    }
    const bloqueada = limitador.tentar(IP);
    expect(bloqueada.bloqueado).toBe(true);
    expect(bloqueada.retryAfterSegundos).toBeGreaterThanOrEqual(1);
    expect(bloqueada.retryAfterSegundos).toBeLessThanOrEqual(RETRY_AFTER_MAXIMO_SEGUNDOS);
  });

  it("toda tentativa ADMITIDA conta — não apenas as que falham (leitura literal: 'tentativas')", () => {
    // Não existe API para "não contar": a admissão já é a ocorrência.
    const { limitador } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    expect(limitador.consultar(IP).bloqueado).toBe(true);
  });

  it("tentativa já bloqueada NÃO estende a janela — sem lockout progressivo", () => {
    const { limitador, relogio } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    relogio.avancar(JANELA_MS - 1000);
    for (let i = 0; i < 5; i += 1) expect(limitador.tentar(IP).bloqueado).toBe(true);
    relogio.avancar(1001);
    expect(limitador.tentar(IP).bloqueado).toBe(false);
  });

  it("não existe lockout duro: a janela LIBERA quando a tentativa mais antiga vence", () => {
    const { limitador, relogio } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    expect(limitador.consultar(IP).bloqueado).toBe(true);
    // Mesma borda da F3 (`DimensaoLimite`): a ocorrência sai da janela
    // EXATAMENTE em 15 min (`instante <= agora - JANELA`), não 1 ms depois.
    relogio.avancar(JANELA_MS - 1);
    expect(limitador.consultar(IP).bloqueado).toBe(true);
    relogio.avancar(1);
    expect(limitador.consultar(IP).bloqueado).toBe(false);
  });

  it("Retry-After reflete o tempo até a tentativa mais antiga sair da janela, nunca acima da janela", () => {
    const { limitador, relogio } = novo();
    limitador.tentar(IP);
    relogio.avancar(5 * 60 * 1000);
    for (let i = 1; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    const veredicto = limitador.tentar(IP);
    expect(veredicto.bloqueado).toBe(true);
    expect(veredicto.retryAfterSegundos).toBe(10 * 60);
    expect(veredicto.retryAfterSegundos).toBeLessThanOrEqual(RETRY_AFTER_MAXIMO_SEGUNDOS);
  });

  it("IPs distintos têm orçamentos independentes", () => {
    const { limitador } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    expect(limitador.tentar("198.51.100.9").bloqueado).toBe(false);
  });

  it("F-10 — IPv4-mapped IPv6 e IPv4 compartilham o MESMO orçamento", () => {
    const { limitador } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) {
      limitador.tentar(i % 2 === 0 ? IP : `::ffff:${IP}`);
    }
    expect(limitador.tentar(IP).bloqueado).toBe(true);
    expect(limitador.tentar(`::ffff:${IP}`).bloqueado).toBe(true);
  });

  it("consultar NÃO contabiliza", () => {
    const { limitador } = novo();
    for (let i = 0; i < 100; i += 1) limitador.consultar(IP);
    expect(limitador.medirEntradas()).toBe(0);
    expect(limitador.tentar(IP).bloqueado).toBe(false);
  });
});

describe("concorrência — o gate é síncrono e a admissão já é a contagem", () => {
  it("N chamadas 'simultâneas' (sem await entre elas) admitem no máximo o limite", () => {
    const { limitador } = novo();
    const vereditos = Array.from({ length: 40 }, () => limitador.tentar(IP));
    const admitidas = vereditos.filter((v) => !v.bloqueado).length;
    expect(admitidas).toBe(LIMITE_TENTATIVAS_RECUPERACAO_POR_IP);
  });
});

describe("D-2.3D-06 — poda e teto", () => {
  it("a entrada é PODADA quando a janela inteira vence", () => {
    const { limitador, relogio } = novo();
    limitador.tentar(IP);
    expect(limitador.medirEntradas()).toBe(1);
    relogio.avancar(JANELA_MS + 1);
    limitador.consultar(IP);
    expect(limitador.medirEntradas()).toBe(0);
  });

  it("o teto NUNCA é excedido e um IP bloqueado sobrevive ao flooding", () => {
    const { limitador, relogio } = novo();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) limitador.tentar(IP);
    relogio.avancar(60_000);
    for (let n = 1; n <= MAXIMO_DE_ENTRADAS + 500; n += 1) {
      limitador.tentar(`10.${String((n >> 16) & 255)}.${String((n >> 8) & 255)}.${String(n & 255)}`);
    }
    expect(limitador.medirEntradas()).toBe(MAXIMO_DE_ENTRADAS);
    expect(limitador.consultar(IP).bloqueado).toBe(true);
  }, 120_000);

  it("nenhuma infraestrutura externa é usada — o estado vive no processo", () => {
    const a = new LimitadorRecuperacao();
    const b = new LimitadorRecuperacao();
    for (let i = 0; i < LIMITE_TENTATIVAS_RECUPERACAO_POR_IP; i += 1) a.tentar(IP);
    expect(a.consultar(IP).bloqueado).toBe(true);
    expect(b.consultar(IP).bloqueado).toBe(false);
  });
});
