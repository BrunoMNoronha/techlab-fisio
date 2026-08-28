// TechLab Fisio — Etapa 2.3D-B / F3 — validação estrutural do corpo de login.
//
// A validação é a barreira que separa "payload rejeitado ANTES da
// autenticação" (sem rate limit e SEM evento de auditoria — `D-2.3D-12`) de
// "tentativa rejeitada PELA autenticação" (com ambos). Por isso ela é testada
// isoladamente, além de o ser pela fronteira HTTP.

import { describe, expect, it } from "@jest/globals";

import { ERRO, validarCorpoLogin } from "../src/auth/auth.dto.js";

describe("validarCorpoLogin — aceita o mínimo bem-formado", () => {
  it("aceita identificador e senha não vazios", () => {
    const resultado = validarCorpoLogin({
      identificador: "usuario@clinica.local",
      senha: "senha-sintetica",
    });
    expect(resultado.valido).toBe(true);
    if (resultado.valido) {
      expect(resultado.valor).toEqual({
        identificador: "usuario@clinica.local",
        senha: "senha-sintetica",
      });
    }
  });

  it("NÃO normaliza — entrega o valor cru, para que D-2.3D-03 tenha um dono só", () => {
    const resultado = validarCorpoLogin({
      identificador: "  Usuario@Clinica.Local  ",
      senha: "  senha com espaços  ",
    });
    expect(resultado.valido).toBe(true);
    if (resultado.valido) {
      expect(resultado.valor.identificador).toBe("  Usuario@Clinica.Local  ");
      // A senha NUNCA é normalizada: espaços são caracteres legítimos dela.
      expect(resultado.valor.senha).toBe("  senha com espaços  ");
    }
  });

  it("ignora campos extras em vez de rejeitar", () => {
    const resultado = validarCorpoLogin({
      identificador: "u@c.local",
      senha: "s",
      lembrarDeMim: true,
      __proto__: { poluido: true },
    });
    expect(resultado.valido).toBe(true);
    if (resultado.valido) {
      expect(Object.keys(resultado.valor).sort()).toEqual(["identificador", "senha"]);
    }
  });

  it("não valida FORMATO de e-mail — nenhuma política de formato é homologada", () => {
    expect(validarCorpoLogin({ identificador: "sem-arroba", senha: "s" }).valido).toBe(
      true,
    );
  });
});

describe("validarCorpoLogin — fail-closed", () => {
  it.each([
    ["corpo ausente", undefined],
    ["corpo nulo", null],
    ["corpo string", "identificador=x&senha=y"],
    ["corpo array", [{ identificador: "u@c.local", senha: "s" }]],
    ["corpo número", 42],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoLogin(corpo).valido).toBe(false);
  });

  it.each([
    ["identificador ausente", { senha: "s" }],
    ["senha ausente", { identificador: "u@c.local" }],
    ["identificador não string", { identificador: 1, senha: "s" }],
    ["senha não string", { identificador: "u@c.local", senha: { valor: "s" } }],
    ["identificador nulo", { identificador: null, senha: "s" }],
    ["senha nula", { identificador: "u@c.local", senha: null }],
    ["identificador vazio", { identificador: "", senha: "s" }],
    ["identificador só espaços", { identificador: "     ", senha: "s" }],
    ["senha vazia", { identificador: "u@c.local", senha: "" }],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoLogin(corpo).valido).toBe(false);
  });

  it("rejeita identificador acima do limite RFC 5321 (320)", () => {
    expect(
      validarCorpoLogin({ identificador: "a".repeat(321), senha: "s" }).valido,
    ).toBe(false);
    expect(
      validarCorpoLogin({ identificador: "a".repeat(320), senha: "s" }).valido,
    ).toBe(true);
  });

  it("rejeita senha acima do teto de recurso (4096)", () => {
    expect(
      validarCorpoLogin({ identificador: "u@c.local", senha: "a".repeat(4097) }).valido,
    ).toBe(false);
    expect(
      validarCorpoLogin({ identificador: "u@c.local", senha: "a".repeat(4096) }).valido,
    ).toBe(true);
  });
});

describe("catálogo de erros da fronteira", () => {
  it("os códigos são um conjunto fechado e estável", () => {
    expect(Object.keys(ERRO).sort()).toEqual([
      "CREDENCIAIS_INVALIDAS",
      "FALHA_INTERNA",
      "REQUISICAO_INVALIDA",
      "REQUISICAO_NAO_AUTORIZADA",
      "SESSAO_INVALIDA",
      "TENTATIVAS_EXCEDIDAS",
    ]);
  });

  it("nenhum código carrega detalhe interno, valor recebido ou distinção de conta", () => {
    for (const codigo of Object.values(ERRO)) {
      expect(codigo).toMatch(/^[A-Z_]+$/);
      expect(codigo).not.toContain("USUARIO_INEXISTENTE");
      expect(codigo).not.toContain("SENHA");
      expect(codigo).not.toContain("INATIVO");
    }
  });
});
