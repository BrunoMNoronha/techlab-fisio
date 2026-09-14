// TechLab Fisio — testes unitários do SessoesService (P-2.3D-07).

import "reflect-metadata";

import { describe, expect, it, jest, beforeEach } from "@jest/globals";

import { SessoesService } from "../src/sessoes/sessoes.service.js";

describe("SessoesService — unitário", () => {
  let sessoesService: SessoesService;
  let databaseMock: { transacao: any };
  let sessaoServiceMock: { revogarPorAdministradorEm: any };
  let auditWriterMock: { registrar: any };

  beforeEach(() => {
    databaseMock = {
      transacao: jest.fn().mockImplementation(async (callback: any) => {
        const tx = { fakeTx: true };
        return callback(tx);
      }),
    };
    sessaoServiceMock = {
      revogarPorAdministradorEm: jest.fn(),
    };
    auditWriterMock = {
      registrar: jest.fn().mockResolvedValue(undefined as never),
    };

    sessoesService = new SessoesService(
      databaseMock as any,
      sessaoServiceMock as any,
      auditWriterMock as any,
    );
  });

  it("quando mutacaoExecutada é true: escreve auditoria com usuario.sessao.revogacao e retorna sucesso", async () => {
    const dataEncerrada = new Date();
    sessaoServiceMock.revogarPorAdministradorEm.mockResolvedValue({
      mutacaoExecutada: true,
      sessaoId: "11111111-1111-4111-8111-111111111111",
      usuarioId: "22222222-2222-4222-8222-222222222222",
      revogadaPorUsuarioId: "33333333-3333-4333-8333-333333333333",
      encerradaEm: dataEncerrada,
    });

    const resultado = await sessoesService.revogarSessaoDeTerceiro({
      sessaoId: "11111111-1111-4111-8111-111111111111",
      atorUsuarioId: "33333333-3333-4333-8333-333333333333",
    });

    expect(resultado.mutacaoExecutada).toBe(true);
    expect(auditWriterMock.registrar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        acao: "usuario.sessao.revogacao",
        atorUsuarioId: "33333333-3333-4333-8333-333333333333",
        alvoTipo: "sessao_autenticacao",
        alvoId: "11111111-1111-4111-8111-111111111111",
        resultado: "SUCESSO",
        justificativa: null,
      }),
    );
  });

  it("quando mutacaoExecutada é false: NÃO emite evento de auditoria", async () => {
    for (const motivo of [
      "SESSAO_INEXISTENTE",
      "SESSAO_REVOGADA",
      "SESSAO_EXPIRADA",
      "AUTORREVOGACAO_RECUSADA",
    ]) {
      auditWriterMock.registrar.mockClear();
      sessaoServiceMock.revogarPorAdministradorEm.mockResolvedValue({
        mutacaoExecutada: false,
        motivo,
      });

      const resultado = await sessoesService.revogarSessaoDeTerceiro({
        sessaoId: "11111111-1111-4111-8111-111111111111",
        atorUsuarioId: "33333333-3333-4333-8333-333333333333",
      });

      expect(resultado.mutacaoExecutada).toBe(false);
      expect(auditWriterMock.registrar).not.toHaveBeenCalled();
    }
  });

  it("se auditWriter falhar: lança erro (forçando rollback da transação)", async () => {
    sessaoServiceMock.revogarPorAdministradorEm.mockResolvedValue({
      mutacaoExecutada: true,
      sessaoId: "11111111-1111-4111-8111-111111111111",
      usuarioId: "22222222-2222-4222-8222-222222222222",
      revogadaPorUsuarioId: "33333333-3333-4333-8333-333333333333",
      encerradaEm: new Date(),
    });
    auditWriterMock.registrar.mockRejectedValue(new Error("falha simulada de auditoria") as never);

    await expect(
      sessoesService.revogarSessaoDeTerceiro({
        sessaoId: "11111111-1111-4111-8111-111111111111",
        atorUsuarioId: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow("falha simulada de auditoria");
  });
});
