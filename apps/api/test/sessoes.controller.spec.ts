// TechLab Fisio — testes unitários do SessoesService e SessoesController (P-2.3D-07).

import "reflect-metadata";

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { ERRO } from "../src/auth/auth.dto.js";
import { SessoesController } from "../src/sessoes/sessoes.controller.js";
import { SessoesService } from "../src/sessoes/sessoes.service.js";

describe("SessoesController — unitário", () => {
  let controller: SessoesController;
  let sessoesServiceMock: { revogarSessaoDeTerceiro: jest.Mock };

  beforeEach(() => {
    sessoesServiceMock = {
      revogarSessaoDeTerceiro: jest.fn<any>().mockResolvedValue({
        mutacaoExecutada: true,
        sessaoId: "11111111-1111-4111-8111-111111111111",
        usuarioId: "22222222-2222-4222-8222-222222222222",
        revogadaPorUsuarioId: "33333333-3333-4333-8333-333333333333",
        encerradaEm: new Date(),
      }),
    };
    controller = new SessoesController(sessoesServiceMock as unknown as SessoesService);
  });

  it("rejeita sessaoId inválido com BadRequestException (REQUISICAO_INVALIDA)", async () => {
    await expect(
      controller.revogarSessao("id-invalido", {
        usuarioId: "33333333-3333-4333-8333-333333333333",
        sessaoId: "44444444-4444-4444-8444-444444444444",
      }),
    ).rejects.toThrow(BadRequestException);

    try {
      await controller.revogarSessao("id-invalido", {
        usuarioId: "33333333-3333-4333-8333-333333333333",
        sessaoId: "44444444-4444-4444-8444-444444444444",
      });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    expect(sessoesServiceMock.revogarSessaoDeTerceiro).not.toHaveBeenCalled();
  });

  it("repassa sessaoId e atorUsuarioId ao SessoesService quando UUID é válido", async () => {
    const sessaoId = "11111111-1111-4111-8111-111111111111";
    const ator = {
      usuarioId: "33333333-3333-4333-8333-333333333333",
      sessaoId: "44444444-4444-4444-8444-444444444444",
    };

    await expect(controller.revogarSessao(sessaoId, ator)).resolves.toBeUndefined();

    expect(sessoesServiceMock.revogarSessaoDeTerceiro).toHaveBeenCalledWith({
      sessaoId,
      atorUsuarioId: ator.usuarioId,
    });
  });
});
