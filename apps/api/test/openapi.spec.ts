// TechLab Fisio — Etapa 2.3D-B / F3 — contrato OpenAPI (`D-2.3D-11`).
//
// O documento é gerado a partir da APLICAÇÃO REAL (`AppModule`), pelo mesmo
// caminho de `main.ts`. Não existe app sintético aqui: se um endpoint sair do
// módulo, ou perder seus decorators, este arquivo falha.
//
// Além da presença das rotas, o teste prova a propriedade que importa para a
// segurança do contrato: NENHUM campo secreto é descrito na saída. O token de
// sessão, o `token_hash` e o hash de senha não podem aparecer como propriedade
// de resposta — nem por acidente de inferência.
//
// SEM BANCO: mesma técnica de `auth.module.integration.spec.ts` — apenas o
// `DatabaseService` é substituído por um valor inerte, porque seu
// `onModuleInit` conecta EAGER. Tudo o mais é real.

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import {
  NOME_ESQUEMA_SESSAO,
  TITULO_CONTRATO,
  VERSAO_CONTRATO,
  construirDocumentoOpenApi,
} from "../src/openapi/documento-openapi.js";

// O `onModuleInit` de `CredencialService` paga um `hash()` Argon2 real.
jest.setTimeout(60_000);

let moduleRef: TestingModule;
let app: INestApplication;
let documento: OpenAPIObject;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({})
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  documento = construirDocumentoOpenApi(app);
});

afterAll(async () => {
  await app.close();
});

function operacao(caminho: string, metodo: "post" | "get"): Record<string, unknown> {
  const item = documento.paths[caminho];
  expect(item).toBeDefined();
  const op = (item as Record<string, unknown>)[metodo];
  expect(op).toBeDefined();
  return op as Record<string, unknown>;
}

function respostas(caminho: string, metodo: "post" | "get"): Record<string, unknown> {
  return operacao(caminho, metodo)["responses"] as Record<string, unknown>;
}

describe("D-2.3D-11 — documento válido", () => {
  it("declara OpenAPI 3, título e versão do contrato", () => {
    expect(documento.openapi.startsWith("3.")).toBe(true);
    expect(documento.info.title).toBe(TITULO_CONTRATO);
    expect(documento.info.version).toBe(VERSAO_CONTRATO);
  });

  it("descreve a sessão por COOKIE — nunca bearer/JWT", () => {
    const esquemas = documento.components?.securitySchemes ?? {};
    const nomes = Object.keys(esquemas);
    expect(nomes).toEqual([NOME_ESQUEMA_SESSAO]);
    expect(JSON.stringify(esquemas)).toContain("__Host-tlf_sessao");
    for (const esquema of Object.values(esquemas)) {
      const tipado = esquema as { type?: string; in?: string; scheme?: string };
      expect(tipado.type).toBe("apiKey");
      expect(tipado.in).toBe("cookie");
      expect(tipado.scheme).toBeUndefined();
    }
    expect(JSON.stringify(esquemas).toLowerCase()).not.toContain("bearer");
  });
});

describe("D-2.3D-11 — rotas da F3 presentes", () => {
  it("POST /auth/login está documentado", () => {
    const op = operacao("/auth/login", "post");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-001"));
    expect(op["tags"]).toEqual(["Autenticação"]);
  });

  it("POST /auth/logout está documentado", () => {
    const op = operacao("/auth/logout", "post");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-002"));
    expect(op["tags"]).toEqual(["Autenticação"]);
  });

  it("o documento reflete o ROUTER real — /health, que não tem decorators, aparece", () => {
    // Prova de que a fonte é a aplicação, e não uma lista escrita à mão: uma
    // rota sem nenhum decorator de OpenAPI ainda assim consta do documento.
    expect(documento.paths["/health"]).toBeDefined();
  });

  it("nenhuma rota de F4+ vazou para o contrato", () => {
    const caminhos = Object.keys(documento.paths);
    expect(caminhos.sort()).toEqual(["/auth/login", "/auth/logout", "/health"]);
    for (const proibido of [
      "recuperacao",
      "senha",
      "papeis",
      "permissoes",
      "profissionais",
      "pacientes",
      "agenda",
      "refresh",
    ]) {
      expect(caminhos.some((c) => c.includes(proibido))).toBe(false);
    }
  });

  it("o custom header CSRF é declarado como obrigatório nas duas rotas", () => {
    for (const caminho of ["/auth/login", "/auth/logout"]) {
      const parametros = operacao(caminho, "post")["parameters"] as Array<
        Record<string, unknown>
      >;
      const header = parametros.find(
        (p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao",
      );
      expect(header).toBeDefined();
      expect(header?.["required"]).toBe(true);
    }
  });
});

describe("D-2.3D-11 — contratos de resposta", () => {
  it("login documenta 200, 400, 401, 403, 413, 429 e 500", () => {
    // `413` entrou com a correção `F-03`: o body parser rejeita corpo acima do
    // limite ANTES do controller, e esse desfecho passou a ser um `413` real —
    // logo tem de constar do contrato.
    expect(Object.keys(respostas("/auth/login", "post")).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "413",
      "429",
      "500",
    ]);
  });

  it("logout documenta 204, 401, 403, 413 e 500", () => {
    expect(Object.keys(respostas("/auth/logout", "post")).sort()).toEqual([
      "204",
      "401",
      "403",
      "413",
      "500",
    ]);
  });

  it("o 429 do login declara o cabeçalho Retry-After (D-2.3D-06)", () => {
    const resposta429 = respostas("/auth/login", "post")["429"] as Record<
      string,
      unknown
    >;
    expect(resposta429["headers"]).toHaveProperty("Retry-After");
  });

  it("o 204 do logout não tem corpo", () => {
    const resposta204 = respostas("/auth/logout", "post")["204"] as Record<
      string,
      unknown
    >;
    expect(resposta204["content"]).toBeUndefined();
  });

  it("todo contrato de erro usa o MESMO schema — resposta uniforme", () => {
    const referencias = new Set<string>();
    for (const caminho of ["/auth/login", "/auth/logout"]) {
      const todas = respostas(caminho, "post");
      for (const [status, corpo] of Object.entries(todas)) {
        if (status === "200" || status === "204") continue;
        const conteudo = (corpo as { content?: Record<string, { schema?: { $ref?: string } }> })
          .content;
        const ref = conteudo?.["application/json"]?.schema?.$ref;
        expect(ref).toBeDefined();
        referencias.add(ref as string);
      }
    }
    expect(referencias.size).toBe(1);
    expect([...referencias][0]).toContain("ErroAutenticacaoDto");
  });

  it("o schema de erro tem UM campo, de conjunto fechado", () => {
    const schema = documento.components?.schemas?.["ErroAutenticacaoDto"] as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(["erro"]);
    expect(schema.properties?.["erro"]?.enum?.sort()).toEqual([
      "CREDENCIAIS_INVALIDAS",
      "FALHA_INTERNA",
      "REQUISICAO_INVALIDA",
      "REQUISICAO_NAO_AUTORIZADA",
      "SESSAO_INVALIDA",
      "TENTATIVAS_EXCEDIDAS",
    ]);
  });
});

describe("D-2.3D-11 — nenhum campo secreto no contrato", () => {
  const PROIBIDAS = [
    "token",
    "tokenhash",
    "token_hash",
    "segredo",
    "senhahash",
    "senha_hash",
    "hash",
    "cookie",
    "sessaoid",
    "sessao_id",
  ];

  function propriedadesDe(nome: string): string[] {
    const schema = documento.components?.schemas?.[nome] as {
      properties?: Record<string, unknown>;
    };
    return Object.keys(schema?.properties ?? {});
  }

  it("a resposta de login expõe SÓ usuarioId e expiraEm — o token sai pelo cookie", () => {
    expect(propriedadesDe("LoginRespostaDto").sort()).toEqual([
      "expiraEm",
      "usuarioId",
    ]);
  });

  it("nenhum schema de RESPOSTA tem propriedade com nome secreto", () => {
    for (const nome of ["LoginRespostaDto", "ErroAutenticacaoDto"]) {
      for (const propriedade of propriedadesDe(nome)) {
        expect(PROIBIDAS).not.toContain(propriedade.toLowerCase());
      }
    }
  });

  it("`senha` existe SOMENTE na requisição de login, nunca em resposta", () => {
    expect(propriedadesDe("LoginRequisicaoDto").sort()).toEqual([
      "identificador",
      "senha",
    ]);
    expect(propriedadesDe("LoginRespostaDto")).not.toContain("senha");
    expect(propriedadesDe("ErroAutenticacaoDto")).not.toContain("senha");
  });

  it("nenhum EXEMPLO ou default do documento carrega valor sensível", () => {
    // Varredura sobre todos os `example`/`default`/`enum` do documento: um
    // exemplo com senha ou token viraria dado sensível publicado no contrato.
    const suspeitos: string[] = [];
    const visitar = (valor: unknown, chave: string): void => {
      if (valor === null || valor === undefined) return;
      if (typeof valor === "object") {
        for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
          visitar(v, k);
        }
        return;
      }
      if (
        (chave === "example" || chave === "default") &&
        typeof valor === "string" &&
        /senha|token|segredo|hash/i.test(valor)
      ) {
        suspeitos.push(`${chave}=${valor}`);
      }
    };
    visitar(documento, "raiz");
    expect(suspeitos).toEqual([]);
  });
});
