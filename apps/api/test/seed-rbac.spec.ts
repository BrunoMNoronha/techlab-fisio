// TechLab Fisio — Unit test & query counter for SeedRbacService

import { describe, expect, it } from "@jest/globals";
import type { DatabaseService } from "../src/database/database.service.js";
import { SeedRbacService } from "../src/provisionamento/seed-rbac.service.js";
import { PERMISSOES } from "../src/authz/permissoes.catalogo.js";
import { PAPEIS, ASSOCIACOES_SEED } from "../src/provisionamento/catalogo-rbac.js";

function criarMockTx() {
  const storePapeis: Array<{ id: string; codigo: string; nome: string }> = [];
  const storePermissoes: Array<{ id: string; codigo: string; nome: string }> = [];
  const storeVinculos: Array<{ papelId: string; permissaoId: string }> = [];

  let queryCount = 0;

  const mockTx = {
    $executeRawUnsafe: async (..._args: unknown[]) => {
      queryCount++;
      return 1;
    },
    $executeRaw: async (..._args: unknown[]) => {
      queryCount++;
      return 1;
    },
    papel: {
      findMany: async (args?: any) => {
        queryCount++;
        let res = storePapeis;
        if (args?.where?.codigo?.in) {
          const cods = new Set(args.where.codigo.in);
          res = storePapeis.filter((p) => cods.has(p.codigo));
        }
        return res.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome }));
      },
      create: async (args: any) => {
        queryCount++;
        const item = {
          id: `uuid-papel-${args.data.codigo}`,
          codigo: args.data.codigo,
          nome: args.data.nome,
        };
        storePapeis.push(item);
        return { ...item };
      },
      createManyAndReturn: async (args: any) => {
        queryCount++;
        const criados = args.data.map((d: any) => {
          const item = {
            id: `uuid-papel-${d.codigo}`,
            codigo: d.codigo,
            nome: d.nome,
          };
          storePapeis.push(item);
          return { ...item };
        });
        return criados;
      },
      update: async (args: any) => {
        queryCount++;
        const item = storePapeis.find((p) => p.id === args.where.id);
        if (item) item.nome = args.data.nome;
        return item;
      },
    },
    permissao: {
      findMany: async (args?: any) => {
        queryCount++;
        let res = storePermissoes;
        if (args?.where?.codigo?.in) {
          const cods = new Set(args.where.codigo.in);
          res = storePermissoes.filter((p) => cods.has(p.codigo));
        }
        return res.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome }));
      },
      create: async (args: any) => {
        queryCount++;
        const item = {
          id: `uuid-perm-${args.data.codigo}`,
          codigo: args.data.codigo,
          nome: args.data.nome,
        };
        storePermissoes.push(item);
        return { ...item };
      },
      createManyAndReturn: async (args: any) => {
        queryCount++;
        const criados = args.data.map((d: any) => {
          const item = {
            id: `uuid-perm-${d.codigo}`,
            codigo: d.codigo,
            nome: d.nome,
          };
          storePermissoes.push(item);
          return { ...item };
        });
        return criados;
      },
      update: async (args: any) => {
        queryCount++;
        const item = storePermissoes.find((p) => p.id === args.where.id);
        if (item) item.nome = args.data.nome;
        return item;
      },
    },
    papelPermissao: {
      findMany: async (args?: any) => {
        queryCount++;
        let res = storeVinculos;
        if (args?.where?.papelId?.in) {
          const ids = new Set(args.where.papelId.in);
          res = storeVinculos.filter((v) => ids.has(v.papelId));
        }
        return res.map((v) => ({ papelId: v.papelId, permissaoId: v.permissaoId }));
      },
      create: async (args: any) => {
        queryCount++;
        const item = {
          papelId: args.data.papelId,
          permissaoId: args.data.permissaoId,
        };
        storeVinculos.push(item);
        return { ...item };
      },
      createMany: async (args: any) => {
        queryCount++;
        for (const d of args.data) {
          storeVinculos.push({ papelId: d.papelId, permissaoId: d.permissaoId });
        }
        return { count: args.data.length };
      },
    },
  };

  return {
    mockTx,
    get queryCount() {
      return queryCount;
    },
    resetQueryCount() {
      queryCount = 0;
    },
    storePapeis,
    storePermissoes,
    storeVinculos,
  };
}

function criarMockDatabaseService(mockTx: any): DatabaseService {
  return {
    transacao: async (corpo: any) => corpo(mockTx),
  } as unknown as DatabaseService;
}

describe("SeedRbacService — performance and correctness", () => {
  it("semear banco vazio cria todos os registros e retorna resultado correto", async () => {
    const mock = criarMockTx();
    const db = criarMockDatabaseService(mock.mockTx);
    const service = new SeedRbacService(db);

    const res = await service.executar();

    expect(res.papeisCriados).toBe(PAPEIS.length); // 4
    expect(res.permissoesCriadas).toBe(PERMISSOES.length); // 29
    expect(res.associacoesCriadas).toBe(ASSOCIACOES_SEED.length); // 37
    expect(res.papeisAtualizados).toBe(0);
    expect(res.permissoesAtualizadas).toBe(0);
    expect(res.jaConforme).toBe(false);

    expect(mock.storePapeis).toHaveLength(4);
    expect(mock.storePermissoes).toHaveLength(29);
    expect(mock.storeVinculos).toHaveLength(37);
  });

  it("segunda execução é idempotente (jaConforme)", async () => {
    const mock = criarMockTx();
    const db = criarMockDatabaseService(mock.mockTx);
    const service = new SeedRbacService(db);

    await service.executar();
    const res2 = await service.executar();

    expect(res2.papeisCriados).toBe(0);
    expect(res2.permissoesCriadas).toBe(0);
    expect(res2.associacoesCriadas).toBe(0);
    expect(res2.jaConforme).toBe(true);
  });

  it("execução otimizada em banco vazio faz no máximo 10 consultas no banco", async () => {
    const mock = criarMockTx();
    const db = criarMockDatabaseService(mock.mockTx);
    const service = new SeedRbacService(db);

    await service.executar();
    expect(mock.queryCount).toBeLessThanOrEqual(10);
  });
});
