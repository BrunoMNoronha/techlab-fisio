// TechLab Fisio — Etapa 2.3D-B / F6 — primitivas do segredo de recuperação
// (`D-2.3D-08`: 256 bits; somente o hash é persistido).

import { describe, expect, it } from "@jest/globals";
import { createHash } from "node:crypto";

import {
  HASH_SINTETICO_DE_AUSENCIA,
  calcularHashSegredoRecuperacao,
  ehSegredoRecuperacaoBemFormado,
  gerarSegredoRecuperacao,
  hashSegredoRecuperacaoConfere,
} from "../src/recuperacao-senha/segredo-recuperacao.js";

describe("D-2.3D-08 — geração do segredo", () => {
  it("produz 43 caracteres base64url — 32 bytes, 256 bits", () => {
    for (let i = 0; i < 50; i += 1) {
      const segredo = gerarSegredoRecuperacao();
      expect(segredo).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(segredo, "base64url")).toHaveLength(32);
    }
  });

  it("segredos sucessivos são distintos (CSPRNG, não contador)", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i += 1) vistos.add(gerarSegredoRecuperacao());
    expect(vistos.size).toBe(200);
  });
});

describe("forma do segredo — fail-closed", () => {
  it("aceita exatamente a forma gerada", () => {
    expect(ehSegredoRecuperacaoBemFormado(gerarSegredoRecuperacao())).toBe(true);
  });

  it.each([
    ["vazio", ""],
    ["curto", "abc"],
    ["42 caracteres", "a".repeat(42)],
    ["44 caracteres", "a".repeat(44)],
    ["alfabeto base64 padrão (+)", `${"a".repeat(42)}+`],
    ["alfabeto base64 padrão (/)", `${"a".repeat(42)}/`],
    ["com preenchimento", `${"a".repeat(42)}=`],
    ["com separador", `${"a".repeat(21)}.${"a".repeat(21)}`],
    ["com espaço", `${"a".repeat(42)} `],
    ["número", 123],
    ["null", null],
    ["undefined", undefined],
    ["objeto", { segredo: "a".repeat(43) }],
  ])("rejeita %s", (_rotulo, valor) => {
    expect(ehSegredoRecuperacaoBemFormado(valor)).toBe(false);
  });
});

describe("hash e comparação", () => {
  it("o hash é o SHA-256 hexadecimal do segredo — determinístico, sem sal", () => {
    const segredo = gerarSegredoRecuperacao();
    const esperado = createHash("sha256").update(segredo, "utf8").digest("hex");
    expect(calcularHashSegredoRecuperacao(segredo)).toBe(esperado);
    expect(calcularHashSegredoRecuperacao(segredo)).toHaveLength(64);
    expect(calcularHashSegredoRecuperacao(segredo)).toBe(
      calcularHashSegredoRecuperacao(segredo),
    );
  });

  it("o hash NÃO contém o segredo e não é reversível por forma", () => {
    const segredo = gerarSegredoRecuperacao();
    expect(calcularHashSegredoRecuperacao(segredo)).not.toContain(segredo);
  });

  it("confere o segredo correto e recusa qualquer outro", () => {
    const segredo = gerarSegredoRecuperacao();
    const hash = calcularHashSegredoRecuperacao(segredo);
    expect(hashSegredoRecuperacaoConfere(hash, segredo)).toBe(true);
    expect(hashSegredoRecuperacaoConfere(hash, gerarSegredoRecuperacao())).toBe(false);
    // Um caractere de diferença basta.
    const alterado = `${segredo.slice(0, 42)}${segredo.endsWith("A") ? "B" : "A"}`;
    expect(hashSegredoRecuperacaoConfere(hash, alterado)).toBe(false);
  });

  it("hash persistido malformado ou de tamanho inesperado é fail-closed", () => {
    const segredo = gerarSegredoRecuperacao();
    for (const persistido of ["", "abc", "zz".repeat(32), "a".repeat(63), "a".repeat(65)]) {
      expect(hashSegredoRecuperacaoConfere(persistido, segredo)).toBe(false);
    }
  });

  it("o hash sintético de ausência nunca confere com segredo algum de forma válida", () => {
    expect(HASH_SINTETICO_DE_AUSENCIA).toHaveLength(64);
    for (let i = 0; i < 20; i += 1) {
      expect(
        hashSegredoRecuperacaoConfere(HASH_SINTETICO_DE_AUSENCIA, gerarSegredoRecuperacao()),
      ).toBe(false);
    }
  });
});
