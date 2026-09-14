// TechLab Fisio — testes unitários para contexto-autenticado.ts
//
// Valida anexarContextoAutenticado e lerContextoAutenticado cobrindo
// fail-closed, tipos primitivos, objetos vazios, strings vazias, imutabilidade e descritores.

import { describe, expect, it } from "@jest/globals";
import {
  anexarContextoAutenticado,
  lerContextoAutenticado,
  type ContextoAutenticado,
} from "../src/authz/contexto-autenticado.js";

describe("contexto-autenticado", () => {
  it("anexa e lê contexto válido com sucesso", () => {
    const req: Record<string, unknown> = {};
    const ctx: ContextoAutenticado = {
      usuarioId: "usr-123",
      sessaoId: "ses-456",
    };

    anexarContextoAutenticado(req, ctx);
    const lido = lerContextoAutenticado(req);

    expect(lido).toEqual({
      usuarioId: "usr-123",
      sessaoId: "ses-456",
    });
    expect(Object.isFrozen(lido)).toBe(true);
  });

  it("não vaza em JSON nem em Object.keys (enumerable: false)", () => {
    const req: Record<string, unknown> = { id: "req-1" };
    anexarContextoAutenticado(req, { usuarioId: "usr", sessaoId: "ses" });

    expect(Object.keys(req)).toEqual(["id"]);
    expect(JSON.stringify(req)).toBe('{"id":"req-1"}');
  });

  it("rejeita leitura para requisição null, undefined ou primitiva (fail-closed)", () => {
    expect(lerContextoAutenticado(null)).toBeNull();
    expect(lerContextoAutenticado(undefined)).toBeNull();
    expect(lerContextoAutenticado("string")).toBeNull();
    expect(lerContextoAutenticado(123)).toBeNull();
    expect(lerContextoAutenticado(true)).toBeNull();
  });

  it("rejeita leitura quando requisição não possui contexto anexado", () => {
    expect(lerContextoAutenticado({})).toBeNull();
    expect(lerContextoAutenticado({ outro: "dado" })).toBeNull();
  });

  it("rejeita contexto inválido (campos vazios ou tipos errados)", () => {
    const reqVazioId: Record<any, any> = {};
    anexarContextoAutenticado(reqVazioId, { usuarioId: "", sessaoId: "ses" });
    expect(lerContextoAutenticado(reqVazioId)).toBeNull();

    const reqVazioSessao: Record<any, any> = {};
    anexarContextoAutenticado(reqVazioSessao, { usuarioId: "usr", sessaoId: "" });
    expect(lerContextoAutenticado(reqVazioSessao)).toBeNull();

    const reqSemSessao: Record<any, any> = {};
    anexarContextoAutenticado(reqSemSessao, { usuarioId: "usr" } as any);
    expect(lerContextoAutenticado(reqSemSessao)).toBeNull();

    const reqSemUsuario: Record<any, any> = {};
    anexarContextoAutenticado(reqSemUsuario, { sessaoId: "ses" } as any);
    expect(lerContextoAutenticado(reqSemUsuario)).toBeNull();
  });

  it("ignora anexarContextoAutenticado em alvos não-objeto sem lançar exceção", () => {
    expect(() => anexarContextoAutenticado(null, { usuarioId: "u", sessaoId: "s" })).not.toThrow();
    expect(() => anexarContextoAutenticado(undefined, { usuarioId: "u", sessaoId: "s" })).not.toThrow();
    expect(() => anexarContextoAutenticado("string", { usuarioId: "u", sessaoId: "s" })).not.toThrow();
    expect(() => anexarContextoAutenticado(42, { usuarioId: "u", sessaoId: "s" })).not.toThrow();
  });

  it("sobrescreve contexto preexistente garantindo autoritatividade (R4-01)", () => {
    const req: Record<string, unknown> = {};
    anexarContextoAutenticado(req, { usuarioId: "usr-1", sessaoId: "ses-1" });
    expect(lerContextoAutenticado(req)).toEqual({ usuarioId: "usr-1", sessaoId: "ses-1" });

    anexarContextoAutenticado(req, { usuarioId: "usr-2", sessaoId: "ses-2" });
    expect(lerContextoAutenticado(req)).toEqual({ usuarioId: "usr-2", sessaoId: "ses-2" });
  });
});
