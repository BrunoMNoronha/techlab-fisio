// TechLab Fisio — testes unitários da gestão de situação de usuários (AUT-005 / D-2.3D-21).

import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";

import {
  ehUuidValido,
  validarCorpoAlterarSituacao,
} from "../src/auth/usuarios.dto.js";
import { UsuariosController } from "../src/auth/usuarios.controller.js";
import {
  ErroSituacaoUsuario,
  UsuariosService,
} from "../src/auth/usuarios.service.js";

describe("AUT-005 — Validação estrutural de DTOs", () => {
  it("ehUuidValido aceita UUIDs canônicos v4/v7 válidos e rejeita inválidos", () => {
    expect(ehUuidValido("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(ehUuidValido("0191ed4f-3766-7359-866f-bb426d03d97f")).toBe(true);
    expect(ehUuidValido("invalido")).toBe(false);
    expect(ehUuidValido("123e4567-e89b-12d3-a456")).toBe(false);
    expect(ehUuidValido(12345)).toBe(false);
    expect(ehUuidValido(null)).toBe(false);
    expect(ehUuidValido(undefined)).toBe(false);
  });

  it("validarCorpoAlterarSituacao aceita boolean puro e rejeita tipos espúrios ou chaves extras", () => {
    expect(validarCorpoAlterarSituacao({ ativo: true })).toEqual({
      valido: true,
      valor: { ativo: true },
    });
    expect(validarCorpoAlterarSituacao({ ativo: false })).toEqual({
      valido: true,
      valor: { ativo: false },
    });

    // Rejeita conversões implícitas
    expect(validarCorpoAlterarSituacao({ ativo: "true" })).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao({ ativo: "false" })).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao({ ativo: 1 })).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao({ ativo: 0 })).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao({ ativo: null })).toEqual({ valido: false });

    // Rejeita chave extra (inclusive tentativa de forjar ator)
    expect(validarCorpoAlterarSituacao({ ativo: false, atorUsuarioId: "123" })).toEqual({
      valido: false,
    });
    expect(validarCorpoAlterarSituacao({ ativo: false, extra: "foo" })).toEqual({
      valido: false,
    });

    // Rejeita corpo não-objeto
    expect(validarCorpoAlterarSituacao(null)).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao([])).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao("ativo")).toEqual({ valido: false });
    expect(validarCorpoAlterarSituacao({})).toEqual({ valido: false });
  });
});

describe("AUT-005 — UsuariosController", () => {
  it("lança BadRequestException se usuarioId não for UUID válido", async () => {
    const serviceMock = { alterarSituacao: jest.fn() } as unknown as UsuariosService;
    const controller = new UsuariosController(serviceMock);

    await expect(
      controller.alterarSituacao(
        "id-invalido",
        { ativo: false },
        { usuarioId: "0191ed4f-3766-7359-866f-bb426d03d97f", sessaoId: "sessao-1" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lança BadRequestException se o corpo for inválido", async () => {
    const serviceMock = { alterarSituacao: jest.fn() } as unknown as UsuariosService;
    const controller = new UsuariosController(serviceMock);

    await expect(
      controller.alterarSituacao(
        "123e4567-e89b-12d3-a456-426614174000",
        { ativo: "falso" as unknown as boolean },
        { usuarioId: "0191ed4f-3766-7359-866f-bb426d03d97f", sessaoId: "sessao-1" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("mapeia USUARIO_INEXISTENTE para NotFoundException (404)", async () => {
    const serviceMock = {
      alterarSituacao: jest.fn<() => Promise<never>>().mockRejectedValue(
        new ErroSituacaoUsuario("USUARIO_INEXISTENTE"),
      ),
    } as unknown as UsuariosService;
    const controller = new UsuariosController(serviceMock);

    await expect(
      controller.alterarSituacao(
        "123e4567-e89b-12d3-a456-426614174000",
        { ativo: false },
        { usuarioId: "0191ed4f-3766-7359-866f-bb426d03d97f", sessaoId: "sessao-1" },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("mapeia AUTO_INATIVACAO_PROIBIDA para UnprocessableEntityException (422)", async () => {
    const serviceMock = {
      alterarSituacao: jest.fn<() => Promise<never>>().mockRejectedValue(
        new ErroSituacaoUsuario("AUTO_INATIVACAO_PROIBIDA"),
      ),
    } as unknown as UsuariosService;
    const controller = new UsuariosController(serviceMock);

    await expect(
      controller.alterarSituacao(
        "0191ed4f-3766-7359-866f-bb426d03d97f",
        { ativo: false },
        { usuarioId: "0191ed4f-3766-7359-866f-bb426d03d97f", sessaoId: "sessao-1" },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("retorna DTO correto em caso de sucesso", async () => {
    const inativadoEm = new Date("2026-09-16T20:00:00.000Z");
    const serviceMock = {
      alterarSituacao: jest.fn<any>().mockResolvedValue({
        usuarioId: "123e4567-e89b-12d3-a456-426614174000",
        ativo: false,
        inativadoEm,
        mutacaoExecutada: true,
      }),
    } as unknown as UsuariosService;
    const controller = new UsuariosController(serviceMock);

    const res = await controller.alterarSituacao(
      "123e4567-e89b-12d3-a456-426614174000",
      { ativo: false },
      { usuarioId: "0191ed4f-3766-7359-866f-bb426d03d97f", sessaoId: "sessao-1" },
    );

    expect(res).toEqual({
      usuarioId: "123e4567-e89b-12d3-a456-426614174000",
      ativo: false,
      inativadoEm: inativadoEm.toISOString(),
    });
  });
});
