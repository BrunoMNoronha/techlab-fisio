// TechLab Fisio — Etapa 2.3D-B / F1 — normalização do identificador de login.
//
// Prova `D-2.3D-03` (`docs/12` §5.3): `trim` + `lowercase`, determinística,
// idempotente e locale-invariante.
//
// Todos os identificadores são SINTÉTICOS (TLF-BASE-V1 §10): nenhum e-mail
// real, nenhum dado pessoal.

import { describe, expect, it } from "@jest/globals";

import { normalizarIdentificadorLogin } from "../src/auth/identificador-login.js";

describe("D-2.3D-03 — normalização do identificador de login", () => {
  it("remove espaços em volta (trim)", () => {
    expect(normalizarIdentificadorLogin("  usuario@exemplo.local  ")).toBe(
      "usuario@exemplo.local",
    );
    expect(normalizarIdentificadorLogin("\t\n usuario@exemplo.local \r\n")).toBe(
      "usuario@exemplo.local",
    );
  });

  it("converte para minúsculas (lowercase)", () => {
    expect(normalizarIdentificadorLogin("USUARIO@EXEMPLO.LOCAL")).toBe(
      "usuario@exemplo.local",
    );
  });

  it("aplica trim e lowercase combinados — o exemplo canônico da decisão", () => {
    expect(normalizarIdentificadorLogin(" Usuario@Exemplo.LOCAL ")).toBe(
      "usuario@exemplo.local",
    );
  });

  it("é idempotente: normalizar o já normalizado não muda nada", () => {
    const entradas = [
      " Usuario@Exemplo.LOCAL ",
      "USUARIO@EXEMPLO.LOCAL",
      "usuario@exemplo.local",
      "",
      "   ",
    ];
    for (const entrada of entradas) {
      const uma = normalizarIdentificadorLogin(entrada);
      expect(normalizarIdentificadorLogin(uma)).toBe(uma);
    }
  });

  it("é determinística: mesma entrada, mesma saída em chamadas repetidas", () => {
    const entrada = " Usuario@Exemplo.LOCAL ";
    const resultados = new Set(
      Array.from({ length: 5 }, () => normalizarIdentificadorLogin(entrada)),
    );
    expect(resultados.size).toBe(1);
  });

  it("NÃO altera o que está fora do escopo da normalização homologada", () => {
    // Espaço INTERNO é preservado — `trim` opera só nas bordas.
    expect(normalizarIdentificadorLogin(" a b@exemplo.local ")).toBe("a b@exemplo.local");
    // Pontos, `+` e hífen são preservados: nenhuma canonicalização de e-mail
    // (remoção de pontos, corte de sufixo `+tag`) está homologada.
    expect(normalizarIdentificadorLogin("Nome.Sobrenome+Tag@Exemplo.local")).toBe(
      "nome.sobrenome+tag@exemplo.local",
    );
    // Acentos são preservados; nenhuma normalização Unicode NFC/NFKC é aplicada.
    expect(normalizarIdentificadorLogin(" JOÃO@Exemplo.local ")).toBe(
      "joão@exemplo.local",
    );
    // Dígitos e sublinhados intactos.
    expect(normalizarIdentificadorLogin("User_42@Exemplo.local")).toBe(
      "user_42@exemplo.local",
    );
  });

  it("preserva a cadeia vazia e a cadeia só de espaços colapsa para vazia", () => {
    expect(normalizarIdentificadorLogin("")).toBe("");
    expect(normalizarIdentificadorLogin("     ")).toBe("");
  });

  it("é locale-invariante: usa toLowerCase, nunca toLocaleLowerCase", () => {
    // O `I` maiúsculo tem mapeamento dependente de locale em turco
    // (`toLocaleLowerCase("tr")` produz "ı", sem ponto). A normalização
    // homologada precisa produzir o MESMO resultado em qualquer máquina.
    expect(normalizarIdentificadorLogin("INDEX@Exemplo.local")).toBe(
      "index@exemplo.local",
    );
    expect(normalizarIdentificadorLogin("INDEX@Exemplo.local")).not.toBe(
      "ındex@exemplo.local",
    );
  });
});
