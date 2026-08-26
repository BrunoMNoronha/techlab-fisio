// TechLab Fisio — E-13 — smoke test da infraestrutura de integração (V-05).
//
// NÃO é cobertura de invariantes (E-14): prova apenas que o ambiente formal
// exigido pela E-13 está de pé — ESM real, Prisma Client ESM + adapter-pg,
// PostgreSQL real, banco descartável, role de runtime correta, migrations
// aplicadas e limpeza determinística entre testes.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { PrismaClient } from "../generated/prisma/client.js";
import { PREFIXO_BANCO_DESCARTAVEL, criarClienteApp } from "./helpers/db.js";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("infraestrutura de integração (E-13 / V-05)", () => {
  it("executa como módulo ES nativo", () => {
    // `import.meta` só existe em ESM — se isto compilar e executar, a suíte
    // não foi silenciosamente convertida para CommonJS.
    expect(typeof import.meta.url).toBe("string");
  });

  it("conecta ao PostgreSQL real como a role de runtime tlf_app", async () => {
    const linhas = await prisma.$queryRaw<
      Array<{ usuario: string; banco: string; versao: string }>
    >`SELECT current_user AS usuario, current_database() AS banco, version() AS versao`;
    const linha = linhas[0];
    expect(linha).toBeDefined();
    expect(linha?.usuario).toBe("tlf_app");
    expect(linha?.banco?.startsWith(PREFIXO_BANCO_DESCARTAVEL)).toBe(true);
    expect(linha?.versao).toMatch(/^PostgreSQL 18\./);
  });

  it("tem o histórico de migrations integralmente aplicado pelo bootstrap", async () => {
    const [aplicadas] = await prisma.$queryRaw<
      Array<{ total: bigint; pendentes: bigint }>
    >`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE finished_at IS NULL) AS pendentes
      FROM "_prisma_migrations"
    `;
    expect(Number(aplicadas?.total)).toBeGreaterThanOrEqual(9);
    expect(Number(aplicadas?.pendentes)).toBe(0);
  });

  it("persiste escrita comum via Prisma Client + adapter-pg (dado sintético)", async () => {
    const criado = await prisma.paciente.create({
      data: { nome: "Paciente Sintético Smoke E-13", ativo: true },
    });
    expect(criado.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(prisma.paciente.count()).resolves.toBe(1);
  });

  it("começa o teste seguinte sem resíduo — limpeza entre testes funciona", async () => {
    // O teste anterior COMITOU um paciente; o afterEach de setup.ts truncou.
    await expect(prisma.paciente.count()).resolves.toBe(0);
  });
});
