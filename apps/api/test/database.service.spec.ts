// TechLab Fisio — DatabaseService: validação de configuração e ciclo de vida
// (Etapa 2.3B) — parte SEM banco.
//
// O que se prova aqui, sem abrir conexão com PostgreSQL real:
//   - configuração ausente/inválida aborta o bootstrap com motivo estável;
//   - nenhuma mensagem de erro ecoa a URL, credencial ou valor de variável;
//   - erro de conexão (endpoint inalcançável) vira falha ruidosa de bootstrap;
//   - transação é indisponível antes do init (fail-closed);
//   - shutdown sem init é um no-op limpo;
//   - o provider é singleton no container Nest.
//
// A parte com PostgreSQL real (tlf_app aceito, role privilegiada rejeitada,
// postura SELECT/INSERT/UPDATE/DELETE/TRUNCATE, transações e shutdown após
// conexão) vive em test/integration/.

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { DatabaseModule } from "../src/database/database.module.js";
import {
  DatabaseService,
  ErroPersistencia,
} from "../src/database/database.service.js";

const SEGREDO_SINTETICO = "segredo-sintetico-que-nao-pode-vazar";

let databaseUrlOriginal: string | undefined;

beforeEach(() => {
  databaseUrlOriginal = process.env["DATABASE_URL"];
});

afterEach(() => {
  if (databaseUrlOriginal === undefined) {
    delete process.env["DATABASE_URL"];
  } else {
    process.env["DATABASE_URL"] = databaseUrlOriginal;
  }
});

async function capturarFalhaDeInit(): Promise<ErroPersistencia> {
  const service = new DatabaseService();
  try {
    await service.onModuleInit();
  } catch (erro) {
    if (erro instanceof ErroPersistencia) return erro;
    throw erro;
  }
  await service.onModuleDestroy();
  throw new Error("onModuleInit deveria ter falhado e não falhou");
}

describe("DatabaseService — configuração (fail-fast, sem vazar valor)", () => {
  it("aborta com CONFIGURACAO_AUSENTE quando DATABASE_URL não existe", async () => {
    delete process.env["DATABASE_URL"];
    const erro = await capturarFalhaDeInit();
    expect(erro.motivo).toBe("CONFIGURACAO_AUSENTE");
  });

  it("aborta com CONFIGURACAO_AUSENTE quando DATABASE_URL é vazia", async () => {
    process.env["DATABASE_URL"] = "";
    const erro = await capturarFalhaDeInit();
    expect(erro.motivo).toBe("CONFIGURACAO_AUSENTE");
  });

  it("aborta com CONFIGURACAO_INVALIDA para valor que não é URL, sem ecoá-lo", async () => {
    process.env["DATABASE_URL"] = `valor-invalido-${SEGREDO_SINTETICO}`;
    const erro = await capturarFalhaDeInit();
    expect(erro.motivo).toBe("CONFIGURACAO_INVALIDA");
    expect(erro.message).not.toContain(SEGREDO_SINTETICO);
  });

  it("aborta com CONFIGURACAO_INVALIDA para esquema não-PostgreSQL, sem ecoar credencial", async () => {
    process.env["DATABASE_URL"] = `mysql://usuario:${SEGREDO_SINTETICO}@localhost:3306/banco`;
    const erro = await capturarFalhaDeInit();
    expect(erro.motivo).toBe("CONFIGURACAO_INVALIDA");
    expect(erro.message).not.toContain(SEGREDO_SINTETICO);
  });
});

describe("DatabaseService — erro de conexão (fail-fast ruidoso)", () => {
  it("aborta com CONEXAO_FALHOU para endpoint inalcançável, sem ecoar URL nem senha", async () => {
    // Porta 1 em 127.0.0.1: recusa imediata; nenhum servidor é necessário.
    process.env["DATABASE_URL"] = `postgresql://tlf_app:${SEGREDO_SINTETICO}@127.0.0.1:1/techlab_fisio`;
    const erro = await capturarFalhaDeInit();
    expect(erro.motivo).toBe("CONEXAO_FALHOU");
    expect(erro.message).not.toContain(SEGREDO_SINTETICO);
    expect(erro.message).not.toContain("postgresql://");
  });
});

describe("DatabaseService — ciclo de vida fora de ordem", () => {
  it("transacao() antes do init é rejeitada com CLIENTE_NAO_INICIADO", async () => {
    const service = new DatabaseService();
    await expect(
      service.transacao(async () => "nunca-executa"),
    ).rejects.toMatchObject({ motivo: "CLIENTE_NAO_INICIADO" });
  });

  it("onModuleDestroy sem init é um no-op limpo", async () => {
    const service = new DatabaseService();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});

describe("DatabaseModule — resolução pelo container", () => {
  it("entrega o MESMO singleton em resoluções repetidas", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
    try {
      const a = moduleRef.get(DatabaseService);
      const b = moduleRef.get(DatabaseService);
      expect(a).toBeInstanceOf(DatabaseService);
      expect(a).toBe(b);
    } finally {
      // close() dispara onModuleDestroy — sem init, deve encerrar limpo.
      await moduleRef.close();
    }
  });
});
