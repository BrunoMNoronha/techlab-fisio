// TechLab Fisio — testes unitários dos DTOs e validação de sessão administrativa (P-2.3D-07).
//
// Prova estrutural isolada de validação de UUID e dos contratos de erro e módulo.

import "reflect-metadata";

import { describe, expect, it } from "@jest/globals";

import { AuditModule } from "../src/audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../src/auth/protecao-csrf.guard.js";
import { AuthzModule } from "../src/authz/authz.module.js";
import { PermissoesGuard } from "../src/authz/permissoes.guard.js";
import { SessaoAutenticadaGuard } from "../src/authz/sessao-autenticada.guard.js";
import { SessoesController } from "../src/sessoes/sessoes.controller.js";
import { ehUuidValido, ErroSessaoAdministrativaDto } from "../src/sessoes/sessoes.dto.js";
import { SessoesModule } from "../src/sessoes/sessoes.module.js";

describe("ehUuidValido", () => {
  it("aceita UUID v4 minúsculo e maiúsculo válido", () => {
    expect(ehUuidValido("a0000000-0000-4000-8000-000000000001")).toBe(true);
    expect(ehUuidValido("A0000000-0000-4000-8000-000000000001")).toBe(true);
    expect(ehUuidValido("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["número", 12345],
    ["objeto", {}],
    ["array", ["a0000000-0000-4000-8000-000000000001"]],
    ["string vazia", ""],
    ["string curta", "123e4567-e89b-12d3"],
    ["string sem hífens", "123e4567e89b12d3a456426614174000"],
    ["caracteres não-hex", "g0000000-0000-0000-0000-000000000000"],
    ["UUID com espaços", " a0000000-0000-4000-8000-000000000001 "],
    ["UUID com trailing slash", "a0000000-0000-4000-8000-000000000001/"],
  ])("rejeita %s", (_rotulo, valor) => {
    expect(ehUuidValido(valor)).toBe(false);
  });
});

describe("SessoesModule — fronteira", () => {
  it("importa EXCLUSIVAMENTE AuthzModule e AuditModule", () => {
    const imports: unknown = Reflect.getMetadata("imports", SessoesModule);
    expect(imports ?? []).toEqual([AuthzModule, AuditModule]);
  });

  it("declara EXCLUSIVAMENTE o SessoesController", () => {
    const controllers: unknown = Reflect.getMetadata("controllers", SessoesModule);
    expect(controllers ?? []).toEqual([SessoesController]);
  });

  it("não exporta nada — nenhum módulo consome SessoesModule", () => {
    const exports: unknown = Reflect.getMetadata("exports", SessoesModule);
    expect(exports ?? []).toEqual([]);
  });

  it("a rota de revogação declara a permissão homologada sessoes.revogar_terceiro no handler", () => {
    const permissao: unknown = Reflect.getMetadata(
      "tlf:permissao_exigida",
      SessoesController.prototype.revogarSessao,
    );
    expect(permissao).toBe("sessoes.revogar_terceiro");
  });

  it("a listagem de sessões (D-2.3D-22) exige a MESMA permissão sessoes.revogar_terceiro", () => {
    const permissao: unknown = Reflect.getMetadata(
      "tlf:permissao_exigida",
      SessoesController.prototype.listarSessoesDoUsuario,
    );
    expect(permissao).toBe("sessoes.revogar_terceiro");
  });

  it("a listagem é método seguro: guards são sessão e permissão, SEM ProtecaoCsrfGuard", () => {
    const guards: unknown = Reflect.getMetadata(
      "__guards__",
      SessoesController.prototype.listarSessoesDoUsuario,
    );
    expect(guards).toEqual([SessaoAutenticadaGuard, PermissoesGuard]);
    expect(Reflect.getMetadata("__guards__", SessoesController) ?? []).toEqual([]);
  });

  it("a revogação mantém a CSRF avaliada ANTES da sessão e da permissão", () => {
    const guards: unknown = Reflect.getMetadata(
      "__guards__",
      SessoesController.prototype.revogarSessao,
    );
    expect(guards).toEqual([ProtecaoCsrfGuard, SessaoAutenticadaGuard, PermissoesGuard]);
  });
});
