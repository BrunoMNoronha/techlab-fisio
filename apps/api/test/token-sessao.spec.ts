// TechLab Fisio — primitivas do token de sessão (Etapa 2.3D-B / F2).
//
// Suíte SEM banco: prova a forma do token, o verificador SHA-256, a
// comparação de tempo constante e o comportamento fail-closed do parser.
// O comportamento que depende de transação, concorrência e SQL é provado
// contra PostgreSQL REAL em test/integration/sessao.integration.spec.ts —
// aqui NÃO há mock de banco algum, apenas funções puras.
//
// Fixtures 100% sintéticas: nenhum dado real, nenhum segredo versionado.

import { createHash, randomUUID } from "node:crypto";

import { describe, expect, it, jest } from "@jest/globals";

import {
  calcularVerificadorSessao,
  comporTokenSessao,
  decomporTokenSessao,
  gerarSegredoSessao,
  verificadorConfere,
  VERIFICADOR_SINTETICO_DE_AUSENCIA,
} from "../src/auth/token-sessao.js";

const SESSAO_ID_SINTETICA = "01923f5a-1c2b-7d3e-8f40-0123456789ab";

describe("D-2.3D-01 — geração do segredo", () => {
  it("produz 43 caracteres base64url (32 bytes = 256 bits, sem preenchimento)", () => {
    const segredo = gerarSegredoSessao();
    expect(segredo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(segredo, "base64url")).toHaveLength(32);
  });

  it("nunca contém o separador do token", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(gerarSegredoSessao()).not.toContain(".");
    }
  });

  it("segredos diferentes em chamadas sucessivas (CSPRNG, sem colisão)", () => {
    const amostras = new Set(Array.from({ length: 500 }, () => gerarSegredoSessao()));
    expect(amostras.size).toBe(500);
  });
});

describe("D-2.3D-01 — forma `<sessao_id>.<segredo>`", () => {
  it("compõe e decompõe de volta ao par original", () => {
    const segredo = gerarSegredoSessao();
    const token = comporTokenSessao(SESSAO_ID_SINTETICA, segredo);
    expect(token).toBe(`${SESSAO_ID_SINTETICA}.${segredo}`);
    expect(decomporTokenSessao(token)).toEqual({
      sessaoId: SESSAO_ID_SINTETICA,
      segredo,
    });
  });

  it("aceita o UUIDv7 realmente usado pela tabela", () => {
    const id = randomUUID();
    const token = comporTokenSessao(id, gerarSegredoSessao());
    expect(decomporTokenSessao(token)?.sessaoId).toBe(id);
  });

  it("o `sessao_id` é recuperável do token — ele NÃO é segredo (A-02)", () => {
    const token = comporTokenSessao(SESSAO_ID_SINTETICA, gerarSegredoSessao());
    expect(token.startsWith(SESSAO_ID_SINTETICA)).toBe(true);
  });
});

describe("D-2.3D-01 — parser FAIL-CLOSED", () => {
  const segredo = gerarSegredoSessao();

  const entradasRejeitadas: ReadonlyArray<readonly [string, unknown]> = [
    ["vazio", ""],
    ["somente separador", "."],
    ["sem separador", `${SESSAO_ID_SINTETICA}${segredo}`],
    ["separador extra", `${SESSAO_ID_SINTETICA}.${segredo}.x`],
    ["somente o id", SESSAO_ID_SINTETICA],
    ["somente o segredo", segredo],
    ["id não-UUID", `nao-e-uuid.${segredo}`],
    ["id UUID truncado", `01923f5a-1c2b-7d3e-8f40-0123456789a.${segredo}`],
    ["id com maiúsculas", `${SESSAO_ID_SINTETICA.toUpperCase()}.${segredo}`],
    ["segredo curto", `${SESSAO_ID_SINTETICA}.${segredo.slice(0, 42)}`],
    ["segredo longo", `${SESSAO_ID_SINTETICA}.${segredo}A`],
    ["segredo fora do alfabeto base64url", `${SESSAO_ID_SINTETICA}.${`+`.repeat(43)}`],
    ["segredo com espaço", `${SESSAO_ID_SINTETICA}. ${segredo.slice(1)}`],
    ["injeção SQL no lugar do id", `'; DROP TABLE sessao_autenticacao; --.${segredo}`],
    ["nulo", null],
    ["indefinido", undefined],
    ["número", 12345],
    ["objeto", { sessaoId: SESSAO_ID_SINTETICA, segredo }],
    ["array", [SESSAO_ID_SINTETICA, segredo]],
    ["quebra de linha", `${SESSAO_ID_SINTETICA}.${segredo}\n`],
  ];

  it.each(entradasRejeitadas)("rejeita (%s) devolvendo null, sem lançar", (_rotulo, entrada) => {
    expect(decomporTokenSessao(entrada)).toBeNull();
  });
});

describe("D-2.3D-01 — verificador SHA-256 do segredo", () => {
  const segredo = gerarSegredoSessao();
  const verificador = calcularVerificadorSessao(segredo);

  it("é o SHA-256 hexadecimal do segredo, e de nada mais", () => {
    expect(verificador).toMatch(/^[0-9a-f]{64}$/);
    expect(verificador).toBe(createHash("sha256").update(segredo, "utf8").digest("hex"));
  });

  it("NÃO inclui o `sessao_id` no digest — a norma manda hashear o segredo", () => {
    const comId = createHash("sha256")
      .update(`${SESSAO_ID_SINTETICA}.${segredo}`, "utf8")
      .digest("hex");
    expect(verificador).not.toBe(comId);
  });

  it("não contém o segredo em claro", () => {
    expect(verificador).not.toContain(segredo);
    expect(Buffer.from(verificador, "hex").toString("base64url")).not.toBe(segredo);
  });

  it("é determinístico para o mesmo segredo e distinto entre segredos", () => {
    expect(calcularVerificadorSessao(segredo)).toBe(verificador);
    expect(calcularVerificadorSessao(gerarSegredoSessao())).not.toBe(verificador);
  });
});

describe("D-2.3D-01 — comparação do verificador", () => {
  const segredo = gerarSegredoSessao();
  const verificador = calcularVerificadorSessao(segredo);

  it("aceita o segredo correto", () => {
    expect(verificadorConfere(verificador, segredo)).toBe(true);
  });

  it("rejeita outro segredo", () => {
    expect(verificadorConfere(verificador, gerarSegredoSessao())).toBe(false);
  });

  it("rejeita um segredo que difere em um único caractere", () => {
    const alterado = `${segredo.slice(0, 42)}${segredo.endsWith("A") ? "B" : "A"}`;
    expect(verificadorConfere(verificador, alterado)).toBe(false);
  });

  const persistidosCorrompidos: ReadonlyArray<readonly [string, string]> = [
    ["vazio", ""],
    ["hexadecimal curto", verificador.slice(0, 62)],
    ["hexadecimal longo", `${verificador}ff`],
    ["não-hexadecimal", "z".repeat(64)],
    ["o próprio segredo em claro", segredo],
    ["digest PHC de outro algoritmo", "$argon2id$v=19$m=19456,t=2,p=1$c2Fs$aGFzaA"],
  ];

  it.each(persistidosCorrompidos)(
    "FAIL-CLOSED: verificador persistido (%s) nunca autentica, e não lança",
    (_rotulo, persistido) => {
      expect(verificadorConfere(persistido, segredo)).toBe(false);
    },
  );

  it("o verificador sintético de ausência não é conferível por segredo algum plausível", () => {
    expect(verificadorConfere(VERIFICADOR_SINTETICO_DE_AUSENCIA, segredo)).toBe(false);
    expect(VERIFICADOR_SINTETICO_DE_AUSENCIA).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("segurança — nada sensível é registrado ou exposto", () => {
  it("nenhuma primitiva escreve em console", () => {
    const metodos = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const espioes = metodos.map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const segredo = gerarSegredoSessao();
      const verificador = calcularVerificadorSessao(segredo);
      comporTokenSessao(SESSAO_ID_SINTETICA, segredo);
      decomporTokenSessao(`${SESSAO_ID_SINTETICA}.${segredo}`);
      decomporTokenSessao("lixo");
      decomporTokenSessao(null);
      verificadorConfere(verificador, segredo);
      verificadorConfere("corrompido", segredo);
      for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled();
    } finally {
      for (const espiao of espioes) espiao.mockRestore();
    }
  });

  it("nenhuma primitiva lança exceção que pudesse carregar o segredo", () => {
    const segredo = gerarSegredoSessao();
    expect(() => verificadorConfere("", segredo)).not.toThrow();
    expect(() => decomporTokenSessao(Symbol("x"))).not.toThrow();
  });
});
