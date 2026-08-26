// TechLab Fisio — DatabaseService contra PostgreSQL REAL (Etapa 2.3B).
//
// O que se prova aqui, com banco descartável (globalSetup E-13) e role de
// runtime real:
//   - o provider resolve pelo container Nest REAL (AppModule) e conecta
//     eager no init com a role de aplicação (`tlf_app` no ambiente padrão);
//   - a postura de privilégios exigida é aceita para a role de runtime;
//   - a role privilegiada (`tlf_migrator`, dona do schema — possui UPDATE/
//     DELETE/TRUNCATE) é REJEITADA e o bootstrap aborta;
//   - o provider é singleton e um segundo onModuleInit é recusado (nenhum
//     pool duplicado);
//   - transações interativas funcionam e o shutdown é limpo;
//   - na prática, a role de runtime NÃO consegue UPDATE/DELETE em
//     `evento_auditoria` (E-11) — a guarda de bootstrap não é a única
//     barreira.

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

import { AppModule } from "../../src/app.module.js";
import { DatabaseModule } from "../../src/database/database.module.js";
import {
  DatabaseService,
  ErroPersistencia,
} from "../../src/database/database.service.js";
import { urlObrigatoria } from "./helpers-integracao.js";

function roleDaUrl(url: string): string {
  return decodeURIComponent(new URL(url).username);
}

describe("DatabaseService — container Nest real + PostgreSQL real (role de runtime)", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // init dispara onModuleInit → conexão EAGER + guarda de postura.
    await app.init();
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    // Encerramento limpo: onModuleDestroy desconecta o pool sem erro.
    await app.close();
  });

  it("conecta eager com a role de runtime e serve transação interativa válida", async () => {
    const linhas = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<{ role: string; ok: number }>>`
        SELECT current_user::text AS role, 1 AS ok
      `,
    );
    expect(linhas[0]?.ok).toBe(1);
    // Capability-based, mas o ambiente de teste conecta como a role de
    // aplicação publicada pelo globalSetup (tlf_app por padrão).
    expect(linhas[0]?.role).toBe(roleDaUrl(urlObrigatoria("DATABASE_URL")));
  });

  it("é singleton no container", () => {
    expect(moduleRef.get(DatabaseService)).toBe(database);
  });

  it("recusa um segundo onModuleInit (nenhum pool duplicado)", async () => {
    await expect(database.onModuleInit()).rejects.toMatchObject({
      motivo: "CICLO_DE_VIDA_INVALIDO",
    });
  });

  it("a role de runtime NÃO consegue UPDATE em evento_auditoria (E-11)", async () => {
    await expect(
      database.transacao(async (tx) =>
        tx.$executeRaw`UPDATE "evento_auditoria" SET "resultado" = 'X'`,
      ),
    ).rejects.toThrow();
  });

  it("a role de runtime NÃO consegue DELETE em evento_auditoria (E-11)", async () => {
    await expect(
      database.transacao(async (tx) =>
        tx.$executeRaw`DELETE FROM "evento_auditoria"`,
      ),
    ).rejects.toThrow();
  });
});

describe("DatabaseService — role privilegiada é rejeitada no bootstrap", () => {
  it("aborta com POSTURA_DE_PRIVILEGIOS_INVALIDA quando a URL usa o migrator", async () => {
    const urlOriginal = process.env["DATABASE_URL"];
    // A URL administrativa do banco descartável (tlf_migrator, dono do
    // schema: UPDATE/DELETE/TRUNCATE permitidos — postura proibida).
    process.env["DATABASE_URL"] = urlObrigatoria("TLF_IT_MIGRATE_URL");
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      let falha: unknown = null;
      try {
        await app.init();
      } catch (erro) {
        falha = erro;
      } finally {
        await app.close();
      }
      expect(falha).toBeInstanceOf(ErroPersistencia);
      expect(falha).toMatchObject({ motivo: "POSTURA_DE_PRIVILEGIOS_INVALIDA" });
      // Falha ruidosa SEM vazar credencial/URL.
      const mensagem = falha instanceof Error ? falha.message : "";
      expect(mensagem).not.toContain("postgresql://");
    } finally {
      if (urlOriginal === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = urlOriginal;
      }
    }
  });
});
