// TechLab Fisio — contrato de erro da fronteira de autorização (Etapa 2.3D-B / F4).
//
// Testes unitários para as constantes de erro de autorização ERRO_AUTORIZACAO.

import { describe, expect, it } from "@jest/globals";

import { ERRO_AUTORIZACAO } from "../src/authz/erro-autorizacao.js";

describe("ERRO_AUTORIZACAO — catálogo de erros de autorização", () => {
  it("o objeto está congelado (immutável / fail-closed)", () => {
    expect(Object.isFrozen(ERRO_AUTORIZACAO)).toBe(true);
  });

  it("possuir as chaves e valores homologados", () => {
    expect(Object.keys(ERRO_AUTORIZACAO).sort()).toEqual(["ACESSO_NEGADO"]);
    expect(ERRO_AUTORIZACAO.ACESSO_NEGADO).toBe("ACESSO_NEGADO");
  });

  it("nenhum código carrega detalhe interno, papel faltante ou informação de usuário", () => {
    for (const codigo of Object.values(ERRO_AUTORIZACAO)) {
      expect(codigo).toMatch(/^[A-Z_]+$/);
      expect(codigo).not.toContain("PERMISSAO");
      expect(codigo).not.toContain("PAPEL");
      expect(codigo).not.toContain("USUARIO");
      expect(codigo).not.toContain("INATIVO");
    }
  });
});
