// TechLab Fisio — testes unitários para `permissao-exigida.metadata.ts`.
//
// Valida a constante da chave de metadata e a função pura `normalizarPermissaoExigida`.

import { describe, expect, it } from "@jest/globals";

import {
  CHAVE_PERMISSAO_EXIGIDA,
  normalizarPermissaoExigida,
} from "../src/authz/permissao-exigida.metadata.js";
import { PERMISSOES } from "../src/authz/permissoes.catalogo.js";

describe("`CHAVE_PERMISSAO_EXIGIDA`", () => {
  it("tem o valor esperado para a chave de metadata", () => {
    expect(CHAVE_PERMISSAO_EXIGIDA).toBe("tlf:permissao_exigida");
  });
});

describe("`normalizarPermissaoExigida` — fail-closed", () => {
  it("aceita cada uma das permissões homologadas no catálogo", () => {
    expect(PERMISSOES.length).toBeGreaterThan(0);
    for (const permissao of PERMISSOES) {
      expect(normalizarPermissaoExigida(permissao)).toBe(permissao);
    }
  });

  it("recusa array de permissões (seja único ou múltiplo) — contrato estritamente escalar", () => {
    expect(normalizarPermissaoExigida(["usuarios.gerenciar"])).toBeNull();
    expect(
      normalizarPermissaoExigida(["usuarios.gerenciar", "permissoes.gerenciar"]),
    ).toBeNull();
    expect(normalizarPermissaoExigida([])).toBeNull();
  });

  it("recusa valores primitivos e não-string", () => {
    for (const invalido of [
      undefined,
      null,
      0,
      1,
      -1,
      true,
      false,
      {},
      { permissao: "usuarios.gerenciar" },
      Symbol("permissao"),
      () => "usuarios.gerenciar",
    ]) {
      expect(normalizarPermissaoExigida(invalido)).toBeNull();
    }
  });

  it("recusa strings inválidas, com espaços, caixa errada ou fora do catálogo", () => {
    for (const invalido of [
      "",
      "   ",
      " usuarios.gerenciar",
      "usuarios.gerenciar ",
      "USUARIOS.GERENCIAR",
      "admin",
      "*",
      "usuarios.*",
      "permissao.inexistente",
      "usuarios.gerenciarr",
    ]) {
      expect(normalizarPermissaoExigida(invalido)).toBeNull();
    }
  });
});
