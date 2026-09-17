// TechLab Fisio — testes unitários do SessoesService e SessoesController (P-2.3D-07).

import "reflect-metadata";

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { ERRO } from "../src/auth/auth.dto.js";
import { SessoesController } from "../src/sessoes/sessoes.controller.js";
import { SessoesService } from "../src/sessoes/sessoes.service.js";

describe("SessoesController — unitário", () => {
  let controller: SessoesController;
  let sessoesServiceMock: {
    revogarSessaoDeTerceiro: jest.Mock;
    listarSessoesAtivasDoUsuario: jest.Mock;
  };

  beforeEach(() => {
    sessoesServiceMock = {
      revogarSessaoDeTerceiro: jest.fn<any>().mockResolvedValue({
        mutacaoExecutada: true,
        sessaoId: "11111111-1111-4111-8111-111111111111",
        usuarioId: "22222222-2222-4222-8222-222222222222",
        revogadaPorUsuarioId: "33333333-3333-4333-8333-333333333333",
        encerradaEm: new Date(),
      }),
      listarSessoesAtivasDoUsuario: jest.fn<any>().mockResolvedValue([]),
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

  describe("listarSessoesDoUsuario (D-2.3D-22)", () => {
    it("rejeita usuarioId inválido com REQUISICAO_INVALIDA sem consultar o serviço", async () => {
      let capturado: unknown;
      try {
        await controller.listarSessoesDoUsuario("nao-e-uuid");
      } catch (err) {
        capturado = err;
      }
      expect(capturado).toBeInstanceOf(BadRequestException);
      expect((capturado as BadRequestException).getResponse()).toEqual({
        erro: ERRO.REQUISICAO_INVALIDA,
      });
      expect(sessoesServiceMock.listarSessoesAtivasDoUsuario).not.toHaveBeenCalled();
    });

    it("devolve { sessoes: [] } quando não há sessões ativas", async () => {
      await expect(
        controller.listarSessoesDoUsuario("22222222-2222-4222-8222-222222222222"),
      ).resolves.toEqual({ sessoes: [] });
    });

    it("serializa instantes em ISO-8601 e expõe somente os quatro campos homologados", async () => {
      sessoesServiceMock.listarSessoesAtivasDoUsuario.mockResolvedValue([
        {
          sessaoId: "11111111-1111-4111-8111-111111111111",
          criadaEm: new Date("2026-09-17T11:00:00.000Z"),
          ultimaAtividadeEm: new Date("2026-09-17T11:55:00.000Z"),
          expiraEm: new Date("2026-09-17T19:00:00.000Z"),
        },
      ] as never);

      const resposta = await controller.listarSessoesDoUsuario(
        "22222222-2222-4222-8222-222222222222",
      );

      expect(resposta).toEqual({
        sessoes: [
          {
            sessaoId: "11111111-1111-4111-8111-111111111111",
            criadaEm: "2026-09-17T11:00:00.000Z",
            ultimaAtividadeEm: "2026-09-17T11:55:00.000Z",
            expiraEm: "2026-09-17T19:00:00.000Z",
          },
        ],
      });
      expect(sessoesServiceMock.listarSessoesAtivasDoUsuario).toHaveBeenCalledWith(
        "22222222-2222-4222-8222-222222222222",
      );
    });
  });
});
