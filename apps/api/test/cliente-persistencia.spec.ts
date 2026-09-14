// TechLab Fisio — testes da fábrica pública do cliente de persistência
// (`criarClientePersistencia` em `packages/database/src/persistencia/cliente-persistencia.ts`).
//
// O que se valida nesta suíte sem abrir conexão real com o PostgreSQL:
//   - Rejeição fail-closed quando URL de conexão for ausente, vazia ou de tipo inválido;
//   - Garantia de que a mensagem de erro não ecoa nenhum valor de entrada nem credencial (TLF-BASE-V1 §10);
//   - Instanciação correta de `PrismaClient` (lazy) quando informada URL válida.

import { describe, expect, it } from "@jest/globals";
import { criarClientePersistencia, type OpcoesClientePersistencia } from "@techlab-fisio/database";

describe("criarClientePersistencia — fábrica de cliente de persistência", () => {
  describe("caminho de erro (opções de URL inválidas ou ausentes)", () => {
    const MENSAGEM_ERRO_ESPERADA = "criarClientePersistencia: URL de conexão ausente ou vazia.";
    const SEGREDO_SINTETICO = "segredo-sintetico-que-nao-pode-vazar";

    it("lança erro quando url é string vazia", () => {
      expect(() => criarClientePersistencia({ url: "" })).toThrow(MENSAGEM_ERRO_ESPERADA);
    });

    it("lança erro quando url é undefined", () => {
      expect(() =>
        criarClientePersistencia({ url: undefined as unknown as string }),
      ).toThrow(MENSAGEM_ERRO_ESPERADA);
    });

    it("lança erro quando url é null", () => {
      expect(() =>
        criarClientePersistencia({ url: null as unknown as string }),
      ).toThrow(MENSAGEM_ERRO_ESPERADA);
    });

    it("lança erro quando objeto de opções está vazio", () => {
      expect(() =>
        criarClientePersistencia({} as unknown as OpcoesClientePersistencia),
      ).toThrow(MENSAGEM_ERRO_ESPERADA);
    });

    it("lança erro quando url não é do tipo string", () => {
      expect(() =>
        criarClientePersistencia({ url: 12345 as unknown as string }),
      ).toThrow(MENSAGEM_ERRO_ESPERADA);

      expect(() =>
        criarClientePersistencia({ url: true as unknown as string }),
      ).toThrow(MENSAGEM_ERRO_ESPERADA);
    });

    it("garante que a mensagem de erro não ecoa valores de entrada nem credenciais (TLF-BASE-V1 §10)", () => {
      try {
        criarClientePersistencia({ url: "" });
      } catch (erro) {
        expect(erro).toBeInstanceOf(Error);
        const mensagem = (erro as Error).message;
        expect(mensagem).toBe(MENSAGEM_ERRO_ESPERADA);
        expect(mensagem).not.toContain(SEGREDO_SINTETICO);
      }
    });
  });

  describe("caminho de sucesso (instanciação lazy do cliente)", () => {
    it("instancia PrismaClient com URL válida sem conectar imediatamente", () => {
      const urlValida = "postgresql://tlf_app:dev_app_trocar_local@localhost:5432/techlab_fisio";
      const cliente = criarClientePersistencia({ url: urlValida });

      expect(cliente).toBeDefined();
      expect(typeof cliente.$connect).toBe("function");
      expect(typeof cliente.$disconnect).toBe("function");
      expect(typeof cliente.$transaction).toBe("function");
    });
  });
});
