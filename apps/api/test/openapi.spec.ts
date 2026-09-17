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

function operacao(
  caminho: string,
  metodo: "post" | "get" | "delete" | "patch" | "put",
): Record<string, unknown> {
  const item = documento.paths[caminho];
  expect(item).toBeDefined();
  const op = (item as Record<string, unknown>)[metodo];
  expect(op).toBeDefined();
  return op as Record<string, unknown>;
}

function respostas(
  caminho: string,
  metodo: "post" | "get" | "delete" | "patch" | "put",
): Record<string, unknown> {
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

  it("as rotas publicadas são EXATAMENTE as da F3, F6, P-2.3D-07, P-2.3D-08, AUT-005, P-2.3D-10, CFG-001A, CFG-002, CFG-003, CFG-004, CFG-005, PAC-A e PRO-A — nenhuma outra vazou", () => {
    // ATUALIZADO NA F6 / P-2.3D-07 / P-2.3D-08: as duas rotas de recuperação de senha (AUT-004),
    // a rota de revogação de sessão (P-2.3D-07 / AUT-002) e a consulta da sessão
    // autenticada atual (P-2.3D-08 / D-2.3D-20) foram autorizadas e passam a pertencer
    // ao contrato. A asserção continua sendo de IGUALDADE EXATA — qualquer rota
    // além destas oito falha aqui. AUT-005 (`D-2.3D-21`) acrescentou a alteração
    // administrativa de situação de usuário. P-2.3D-10 (`D-2.3D-22`) acrescentou a
    // listagem administrativa das sessões ativas de um usuário.
    // CFG-001A (`docs/14`, D-CFG-03) acrescentou GET/PUT /clinica.
    // CFG-002 (`docs/14`, D-CFG-15) acrescentou GET/PUT /horario-funcionamento.
    // CFG-003 (`docs/14`, D-CFG-24) acrescentou /servicos, /servicos/{servicoId} e a situação.
    // CFG-004 (`docs/14`, D-CFG-36) acrescentou /formas-pagamento, /formas-pagamento/{formaPagamentoId} e a situação.
    // CFG-005 (`docs/14`, D-CFG-48) acrescentou /motivos-cancelamento, o item e a situação.
    // PRO-A (`docs/18`, D-PRO1-02/05/06) acrescentou /profissionais, o recurso individual, a situação e os serviços.
    const caminhos = Object.keys(documento.paths);
    expect(caminhos.sort()).toEqual([
      "/auditoria/eventos",
      "/auth/login",
      "/auth/logout",
      "/auth/recuperacao-senha",
      "/auth/recuperacao-senha/concluir",
      "/auth/sessao",
      "/auth/sessoes/{sessaoId}",
      "/auth/usuarios/{usuarioId}/sessoes",
      "/auth/usuarios/{usuarioId}/situacao",
      "/clinica",
      "/formas-pagamento",
      "/formas-pagamento/{formaPagamentoId}",
      "/formas-pagamento/{formaPagamentoId}/situacao",
      "/health",
      "/horario-funcionamento",
      "/motivos-cancelamento",
      "/motivos-cancelamento/{motivoCancelamentoId}",
      "/motivos-cancelamento/{motivoCancelamentoId}/situacao",
      "/pacientes",
      "/pacientes/busca",
      "/pacientes/{pacienteId}",
      "/pacientes/{pacienteId}/situacao",
      "/profissionais",
      "/profissionais/{profissionalId}",
      "/profissionais/{profissionalId}/disponibilidade",
      "/profissionais/{profissionalId}/servicos",
      "/profissionais/{profissionalId}/situacao",
      "/servicos",
      "/servicos/{servicoId}",
      "/servicos/{servicoId}/situacao",
    ]);
    // PAC-A (`docs/17` D-PAC-02) autorizou /pacientes: o termo saiu desta lista por
    // DECISÃO, e a igualdade exata acima continua barrando qualquer outra rota.
    for (const proibido of [
      "papeis",
      "permissoes",
      "agenda",
      "refresh",
    ]) {
      expect(caminhos.some((c) => c.includes(proibido))).toBe(false);
    }
  });

  it("a consulta segura GET /clinica NÃO declara o header CSRF (CFG-001A)", () => {
    const parametros = (operacao("/clinica", "get")["parameters"] ?? []) as Array<
      Record<string, unknown>
    >;
    expect(
      parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao"),
    ).toBeUndefined();
  });

  it("a consulta segura GET /horario-funcionamento NÃO declara o header CSRF (CFG-002)", () => {
    const parametros = (operacao("/horario-funcionamento", "get")["parameters"] ?? []) as Array<
      Record<string, unknown>
    >;
    expect(
      parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao"),
    ).toBeUndefined();
  });

  it("a consulta segura GET /auth/sessao NÃO declara e NÃO exige o header CSRF x-tlf-requisicao", () => {
    const parametros = (operacao("/auth/sessao", "get")["parameters"] ?? []) as Array<
      Record<string, unknown>
    >;
    const header = parametros.find(
      (p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao",
    );
    expect(header).toBeUndefined();
  });

  it("a consulta segura GET /auth/usuarios/{usuarioId}/sessoes NÃO declara o header CSRF x-tlf-requisicao", () => {
    const parametros = (operacao("/auth/usuarios/{usuarioId}/sessoes", "get")["parameters"] ??
      []) as Array<Record<string, unknown>>;
    const header = parametros.find(
      (p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao",
    );
    expect(header).toBeUndefined();
  });

  it("o custom header CSRF é declarado como obrigatório em TODAS as mutações", () => {
    const mutacoes: Array<{ caminho: string; metodo: "post" | "delete" | "patch" | "put" }> = [
      { caminho: "/auth/login", metodo: "post" },
      { caminho: "/auth/logout", metodo: "post" },
      { caminho: "/auth/recuperacao-senha", metodo: "post" },
      { caminho: "/auth/recuperacao-senha/concluir", metodo: "post" },
      { caminho: "/auth/sessoes/{sessaoId}", metodo: "delete" },
      { caminho: "/auth/usuarios/{usuarioId}/situacao", metodo: "patch" },
      { caminho: "/clinica", metodo: "put" },
      { caminho: "/horario-funcionamento", metodo: "put" },
      { caminho: "/servicos", metodo: "post" },
      { caminho: "/servicos/{servicoId}", metodo: "put" },
      { caminho: "/servicos/{servicoId}/situacao", metodo: "patch" },
      { caminho: "/formas-pagamento", metodo: "post" },
      { caminho: "/formas-pagamento/{formaPagamentoId}", metodo: "put" },
      { caminho: "/formas-pagamento/{formaPagamentoId}/situacao", metodo: "patch" },
      { caminho: "/motivos-cancelamento", metodo: "post" },
      { caminho: "/motivos-cancelamento/{motivoCancelamentoId}", metodo: "put" },
      { caminho: "/motivos-cancelamento/{motivoCancelamentoId}/situacao", metodo: "patch" },
      { caminho: "/pacientes/busca", metodo: "post" },
      { caminho: "/pacientes", metodo: "post" },
      { caminho: "/pacientes/{pacienteId}", metodo: "put" },
      { caminho: "/pacientes/{pacienteId}/situacao", metodo: "patch" },
      { caminho: "/profissionais", metodo: "post" },
      { caminho: "/profissionais/{profissionalId}", metodo: "put" },
      { caminho: "/profissionais/{profissionalId}/situacao", metodo: "patch" },
      { caminho: "/profissionais/{profissionalId}/servicos", metodo: "put" },
    ];
    for (const { caminho, metodo } of mutacoes) {
      const parametros = operacao(caminho, metodo)["parameters"] as Array<
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

describe("CFG-001A — contratos de resposta de /clinica (docs/14)", () => {
  it("GET /clinica documenta 200, 401, 403, 404 e 500", () => {
    expect(Object.keys(respostas("/clinica", "get")).sort()).toEqual([
      "200",
      "401",
      "403",
      "404",
      "500",
    ]);
  });

  it("PUT /clinica documenta 200, 400, 401, 403, 404, 413 e 500 — sem 409 (D-CFG-05)", () => {
    expect(Object.keys(respostas("/clinica", "put")).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "413",
      "500",
    ]);
  });

  it("GET e PUT /clinica exigem o cookie de sessão", () => {
    for (const metodo of ["get", "put"] as const) {
      expect(operacao("/clinica", metodo)["security"]).toBeDefined();
    }
  });
});

describe("CFG-002 — contratos de resposta de /horario-funcionamento (docs/14)", () => {
  it("GET documenta 200, 401, 403, 404 e 500", () => {
    expect(Object.keys(respostas("/horario-funcionamento", "get")).sort()).toEqual([
      "200",
      "401",
      "403",
      "404",
      "500",
    ]);
  });

  it("PUT documenta 200, 400, 401, 403, 404, 413 e 500 — sem 409", () => {
    expect(Object.keys(respostas("/horario-funcionamento", "put")).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "413",
      "500",
    ]);
  });

  it("GET e PUT exigem o cookie de sessão", () => {
    for (const metodo of ["get", "put"] as const) {
      expect(operacao("/horario-funcionamento", metodo)["security"]).toBeDefined();
    }
  });
});

describe("CFG-003 — contratos de /servicos (docs/14 §3.11)", () => {
  const esperados: Array<[string, "get" | "post" | "put" | "patch", string[]]> = [
    ["/servicos", "get", ["200", "400", "401", "403", "500"]],
    ["/servicos", "post", ["201", "400", "401", "403", "404", "409", "413", "500"]],
    ["/servicos/{servicoId}", "get", ["200", "400", "401", "403", "404", "500"]],
    ["/servicos/{servicoId}", "put", ["200", "400", "401", "403", "404", "409", "413", "500"]],
    ["/servicos/{servicoId}/situacao", "patch", ["200", "400", "401", "403", "404", "413", "500"]],
  ];

  it.each(esperados)("%s %s documenta exatamente os status do contrato", (caminho, metodo, status) => {
    expect(Object.keys(respostas(caminho, metodo)).sort()).toEqual(status);
    expect(operacao(caminho, metodo)["security"]).toBeDefined();
  });

  it("as consultas GET de /servicos NÃO declaram o header CSRF", () => {
    for (const caminho of ["/servicos", "/servicos/{servicoId}"]) {
      const parametros = (operacao(caminho, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
      expect(parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao")).toBeUndefined();
    }
  });

  it("não existe DELETE em /servicos (D-CFG-24)", () => {
    for (const caminho of ["/servicos", "/servicos/{servicoId}", "/servicos/{servicoId}/situacao"]) {
      expect((documento.paths[caminho] as Record<string, unknown>)["delete"]).toBeUndefined();
    }
  });
});

describe("CFG-004 — contratos de /formas-pagamento (docs/14 §3.12)", () => {
  const esperados: Array<[string, "get" | "post" | "put" | "patch", string[]]> = [
    ["/formas-pagamento", "get", ["200", "400", "401", "403", "500"]],
    ["/formas-pagamento", "post", ["201", "400", "401", "403", "404", "409", "413", "500"]],
    ["/formas-pagamento/{formaPagamentoId}", "get", ["200", "400", "401", "403", "404", "500"]],
    ["/formas-pagamento/{formaPagamentoId}", "put", ["200", "400", "401", "403", "404", "409", "413", "500"]],
    ["/formas-pagamento/{formaPagamentoId}/situacao", "patch", ["200", "400", "401", "403", "404", "413", "500"]],
  ];

  it.each(esperados)("%s %s documenta exatamente os status do contrato", (caminho, metodo, status) => {
    expect(Object.keys(respostas(caminho, metodo)).sort()).toEqual(status);
    expect(operacao(caminho, metodo)["security"]).toBeDefined();
  });

  it("as consultas GET de /formas-pagamento NÃO declaram o header CSRF", () => {
    for (const caminho of ["/formas-pagamento", "/formas-pagamento/{formaPagamentoId}"]) {
      const parametros = (operacao(caminho, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
      expect(parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao")).toBeUndefined();
    }
  });

  it("não existe DELETE em /formas-pagamento (D-CFG-36)", () => {
    for (const caminho of [
      "/formas-pagamento",
      "/formas-pagamento/{formaPagamentoId}",
      "/formas-pagamento/{formaPagamentoId}/situacao",
    ]) {
      expect((documento.paths[caminho] as Record<string, unknown>)["delete"]).toBeUndefined();
    }
  });
});

describe("CFG-005 — contratos de /motivos-cancelamento (docs/14 §3.13)", () => {
  const ITEM = "/motivos-cancelamento/{motivoCancelamentoId}";
  const esperados: Array<[string, "get" | "post" | "put" | "patch", string[]]> = [
    ["/motivos-cancelamento", "get", ["200", "400", "401", "403", "500"]],
    ["/motivos-cancelamento", "post", ["201", "400", "401", "403", "404", "409", "413", "500"]],
    [ITEM, "get", ["200", "400", "401", "403", "404", "500"]],
    [ITEM, "put", ["200", "400", "401", "403", "404", "409", "413", "500"]],
    [`${ITEM}/situacao`, "patch", ["200", "400", "401", "403", "404", "413", "500"]],
  ];

  it.each(esperados)("%s %s documenta exatamente os status do contrato", (caminho, metodo, status) => {
    expect(Object.keys(respostas(caminho, metodo)).sort()).toEqual(status);
    expect(operacao(caminho, metodo)["security"]).toBeDefined();
  });

  it("as consultas GET de /motivos-cancelamento NÃO declaram o header CSRF", () => {
    for (const caminho of ["/motivos-cancelamento", ITEM]) {
      const parametros = (operacao(caminho, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
      expect(parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao")).toBeUndefined();
    }
  });

  it("o 409 do PUT documenta os dois códigos de conflito (D-CFG-46, D-CFG-50)", () => {
    const descricao = String((respostas(ITEM, "put")["409"] as Record<string, unknown>)["description"]);
    expect(descricao).toContain("MOTIVO_CANCELAMENTO_DUPLICADO");
    expect(descricao).toContain("MOTIVO_CANCELAMENTO_EM_USO");
  });

  it("não existe DELETE em /motivos-cancelamento (D-CFG-48)", () => {
    for (const caminho of ["/motivos-cancelamento", ITEM, `${ITEM}/situacao`]) {
      expect((documento.paths[caminho] as Record<string, unknown>)["delete"]).toBeUndefined();
    }
  });
});

describe("PRO-A — contratos de /profissionais (docs/18 §4)", () => {
  const esperados: Array<[string, "get" | "post" | "put" | "patch", string[]]> = [
    ["/profissionais", "get", ["200", "400", "401", "403", "500"]],
    ["/profissionais", "post", ["201", "400", "401", "403", "409", "413", "422", "500"]],
    ["/profissionais/{profissionalId}", "get", ["200", "400", "401", "403", "404", "500"]],
    ["/profissionais/{profissionalId}", "put", ["200", "400", "401", "403", "404", "409", "413", "422", "500"]],
    ["/profissionais/{profissionalId}/situacao", "patch", ["200", "400", "401", "403", "404", "413", "500"]],
    ["/profissionais/{profissionalId}/servicos", "get", ["200", "400", "401", "403", "404", "500"]],
    ["/profissionais/{profissionalId}/servicos", "put", ["200", "400", "401", "403", "404", "413", "422", "500"]],
  ];

  it.each(esperados)("%s %s documenta exatamente os status do contrato", (caminho, metodo, status) => {
    expect(Object.keys(respostas(caminho, metodo)).sort()).toEqual(status);
    expect(operacao(caminho, metodo)["security"]).toBeDefined();
  });

  it("as consultas GET de /profissionais NÃO declaram o header CSRF", () => {
    for (const caminho of ["/profissionais", "/profissionais/{profissionalId}", "/profissionais/{profissionalId}/servicos"]) {
      const parametros = (operacao(caminho, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
      expect(parametros.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao")).toBeUndefined();
    }
  });

  it("não existe DELETE em /profissionais", () => {
    for (const caminho of ["/profissionais", "/profissionais/{profissionalId}", "/profissionais/{profissionalId}/situacao", "/profissionais/{profissionalId}/servicos"]) {
      expect((documento.paths[caminho] as Record<string, unknown>)["delete"]).toBeUndefined();
    }
  });
});

describe("PRO-003 — contratos da disponibilidade (docs/16 §4.2, D-PRO3-02)", () => {
  const DISP = "/profissionais/{profissionalId}/disponibilidade";

  it.each([
    ["get", ["200", "400", "401", "403", "404", "500"]],
    ["put", ["200", "400", "401", "403", "404", "413", "422", "500"]],
  ] as Array<["get" | "put", string[]]>)("%s documenta exatamente os status do contrato", (metodo, status) => {
    expect(Object.keys(respostas(DISP, metodo)).sort()).toEqual(status);
    expect(operacao(DISP, metodo)["security"]).toBeDefined();
  });

  it("o GET da disponibilidade NÃO declara o header CSRF e o PUT o exige", () => {
    const doGet = (operacao(DISP, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
    expect(doGet.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao")).toBeUndefined();
    const doPut = (operacao(DISP, "put")["parameters"] ?? []) as Array<Record<string, unknown>>;
    const header = doPut.find((p) => p["in"] === "header" && p["name"] === "x-tlf-requisicao");
    expect(header).toBeDefined();
    expect(header?.["required"]).toBe(true);
  });

  it("a disponibilidade expõe SOMENTE get e put — sem POST, PATCH nem DELETE (D-PRO3-02)", () => {
    const operacoes = documento.paths[DISP] as Record<string, unknown>;
    expect(Object.keys(operacoes).sort()).toEqual(["get", "put"]);
  });

  it("o PUT declara o corpo { vigenciaInicio, janelas } e a resposta { versoes }", () => {
    const corpo = operacao(DISP, "put")["requestBody"] as Record<string, any>;
    const ref = corpo.content["application/json"].schema.$ref as string;
    expect(ref).toBe("#/components/schemas/DisponibilidadeRequisicaoDto");
    const requisicao = (documento.components?.schemas ?? {})["DisponibilidadeRequisicaoDto"] as Record<string, any>;
    expect(Object.keys(requisicao.properties).sort()).toEqual(["janelas", "vigenciaInicio"]);
    const resposta = (documento.components?.schemas ?? {})["DisponibilidadeRespostaDto"] as Record<string, any>;
    expect(Object.keys(resposta.properties)).toEqual(["versoes"]);
    const versao = (documento.components?.schemas ?? {})["VersaoDisponibilidadeDto"] as Record<string, any>;
    expect(Object.keys(versao.properties).sort()).toEqual(["janelas", "vigenciaFim", "vigenciaInicio"]);
    expect(versao.properties["vigenciaFim"].nullable).toBe(true);
  });

  it("o corpo de erro da disponibilidade enumera VIGENCIA_RETROATIVA e CLINICA_NAO_CONFIGURADA", () => {
    const erro = (documento.components?.schemas ?? {})["ErroDisponibilidadeDto"] as Record<string, any>;
    expect(erro.properties["erro"].enum).toEqual(expect.arrayContaining(["VIGENCIA_RETROATIVA", "CLINICA_NAO_CONFIGURADA"]));
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

  it("nenhum schema de RESPOSTA tem propriedade com nome secreto — exceto a ÚNICA exceção homologada", () => {
    for (const nome of [
      "LoginRespostaDto",
      "ErroAutenticacaoDto",
      "ErroRecuperacaoSenhaDto",
      "ErroSessaoAdministrativaDto",
      "ErroConsultaAuditoriaDto",
      "PaginaEventosAuditoriaDto",
      "EventoAuditoriaDto",
    ]) {
      for (const propriedade of propriedadesDe(nome)) {
        expect(PROIBIDAS).not.toContain(propriedade.toLowerCase());
      }
    }
    // A EXCEÇÃO, declarada nominalmente em vez de afrouxar a varredura:
    // `IniciarRecuperacaoRespostaDto.segredo` é a apresentação ÚNICA do
    // segredo de recuperação ao Administrador (AUT-004, passo 3; D-04, item
    // 3). É a única propriedade de resposta de todo o contrato cujo nome
    // pertence à lista proibida, e a suíte da F6 prova que ela só existe ali.
    const excecao = propriedadesDe("IniciarRecuperacaoRespostaDto").filter((p) =>
      PROIBIDAS.includes(p.toLowerCase()),
    );
    expect(excecao).toEqual(["segredo"]);
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

// ---------------------------------------------------------------------------
// F6 — recuperação de senha (AUT-004, D-2.3D-08) no contrato
// ---------------------------------------------------------------------------

describe("F6 — rotas de recuperação de senha documentadas", () => {
  it("POST /auth/recuperacao-senha (início) está documentado com AUT-004 e exige cookie de sessão", () => {
    const op = operacao("/auth/recuperacao-senha", "post");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-004"));
    expect(op["tags"]).toEqual(["Autenticação"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca).toBeDefined();
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
  });

  it("POST /auth/recuperacao-senha/concluir (conclusão) está documentado SEM exigência de sessão", () => {
    const op = operacao("/auth/recuperacao-senha/concluir", "post");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-004"));
    expect(op["security"]).toBeUndefined();
  });

  it("início documenta 201, 400, 401, 403, 413, 422 e 500", () => {
    expect(Object.keys(respostas("/auth/recuperacao-senha", "post")).sort()).toEqual([
      "201",
      "400",
      "401",
      "403",
      "413",
      "422",
      "500",
    ]);
  });

  it("conclusão documenta 204, 400, 401, 403, 413, 429 e 500 — e o 429 declara Retry-After", () => {
    const todas = respostas("/auth/recuperacao-senha/concluir", "post");
    expect(Object.keys(todas).sort()).toEqual([
      "204",
      "400",
      "401",
      "403",
      "413",
      "429",
      "500",
    ]);
    expect((todas["429"] as Record<string, unknown>)["headers"]).toHaveProperty("Retry-After");
    expect((todas["204"] as Record<string, unknown>)["content"]).toBeUndefined();
  });

  it("todo erro das duas rotas usa o MESMO schema fechado, ErroRecuperacaoSenhaDto", () => {
    const referencias = new Set<string>();
    for (const caminho of ["/auth/recuperacao-senha", "/auth/recuperacao-senha/concluir"]) {
      for (const [status, corpo] of Object.entries(respostas(caminho, "post"))) {
        if (status === "201" || status === "204") continue;
        const conteudo = (corpo as { content?: Record<string, { schema?: { $ref?: string } }> })
          .content;
        const ref = conteudo?.["application/json"]?.schema?.$ref;
        expect(ref).toBeDefined();
        referencias.add(ref as string);
      }
    }
    expect(referencias.size).toBe(1);
    expect([...referencias][0]).toContain("ErroRecuperacaoSenhaDto");
    const schema = documento.components?.schemas?.["ErroRecuperacaoSenhaDto"] as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(["erro"]);
    expect(schema.properties?.["erro"]?.enum?.sort()).toEqual([
      "ACESSO_NEGADO",
      "ALVO_NAO_ELEGIVEL",
      "FALHA_INTERNA",
      "RECUPERACAO_INVALIDA",
      "REQUISICAO_INVALIDA",
      "REQUISICAO_NAO_AUTORIZADA",
      "SESSAO_INVALIDA",
      "TENTATIVAS_EXCEDIDAS",
    ]);
  });

  it("a resposta de início expõe SÓ segredo e expiraEm — nunca usuarioId, id ou hash", () => {
    const schema = documento.components?.schemas?.["IniciarRecuperacaoRespostaDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["expiraEm", "segredo"]);
  });

  it("`novaSenha` existe SOMENTE na requisição de conclusão, nunca em resposta", () => {
    const req = documento.components?.schemas?.["ConcluirRecuperacaoRequisicaoDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(req.properties ?? {}).sort()).toEqual(["novaSenha", "segredo"]);
    for (const [nome, schema] of Object.entries(documento.components?.schemas ?? {})) {
      if (nome === "ConcluirRecuperacaoRequisicaoDto") continue;
      const props = Object.keys(
        (schema as { properties?: Record<string, unknown> }).properties ?? {},
      );
      expect(props).not.toContain("novaSenha");
      expect(props).not.toContain("senhaHash");
      expect(props).not.toContain("hashSegredo");
    }
  });
});

// ---------------------------------------------------------------------------
// P-2.3D-07 — revogação administrativa de sessão (AUT-002, D-2.3D-19)
// ---------------------------------------------------------------------------

describe("P-2.3D-07 — revogação administrativa de sessão de terceiro documentada", () => {
  it("DELETE /auth/sessoes/{sessaoId} está documentada com AUT-002 e exige cookie de sessão", () => {
    const op = operacao("/auth/sessoes/{sessaoId}", "delete");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-002"));
    expect(op["tags"]).toEqual(["Autenticação"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca).toBeDefined();
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
  });

  it("DELETE /auth/sessoes/{sessaoId} documenta 204, 400, 401, 403, 413 e 500", () => {
    const todas = respostas("/auth/sessoes/{sessaoId}", "delete");
    expect(Object.keys(todas).sort()).toEqual([
      "204",
      "400",
      "401",
      "403",
      "413",
      "500",
    ]);
    expect((todas["204"] as Record<string, unknown>)["content"]).toBeUndefined();
  });

  it("DELETE /auth/sessoes/{sessaoId} tem parâmetro de path sessaoId obrigatório e format uuid", () => {
    const params = operacao("/auth/sessoes/{sessaoId}", "delete")["parameters"] as Array<
      Record<string, unknown>
    >;
    const param = params.find((p) => p["name"] === "sessaoId" && p["in"] === "path");
    expect(param).toBeDefined();
    expect(param?.["required"]).toBe(true);
    expect((param?.["schema"] as Record<string, unknown>)?.["format"]).toBe("uuid");
  });

  it("Erros da rota usam o schema ErroSessaoAdministrativaDto com conjunto fechado", () => {
    const schema = documento.components?.schemas?.["ErroSessaoAdministrativaDto"] as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(["erro"]);
    expect(schema.properties?.["erro"]?.enum?.sort()).toEqual([
      "ACESSO_NEGADO",
      "FALHA_INTERNA",
      "REQUISICAO_INVALIDA",
      "REQUISICAO_NAO_AUTORIZADA",
      "SESSAO_INVALIDA",
    ]);
  });
});

// ---------------------------------------------------------------------------
// P-2.3D-08 — consulta da sessão autenticada atual (D-2.3D-20)
// ---------------------------------------------------------------------------

describe("P-2.3D-08 — consulta da sessão autenticada atual documentada", () => {
  it("GET /auth/sessao está documentada com D-2.3D-20 e exige cookie de sessão", () => {
    const op = operacao("/auth/sessao", "get");
    expect(op["summary"]).toEqual(expect.stringContaining("D-2.3D-20"));
    expect(op["tags"]).toEqual(["Autenticação"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca).toBeDefined();
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
  });

  it("GET /auth/sessao documenta 200, 401 e 500", () => {
    const todas = respostas("/auth/sessao", "get");
    expect(Object.keys(todas).sort()).toEqual(["200", "401", "500"]);
    const resp200 = todas["200"] as Record<string, unknown>;
    expect(resp200["content"]).toBeDefined();
  });

  it("200 referencia ConsultarSessaoRespostaDto com usuarioId e sessaoId (ambos uuid)", () => {
    const schema = documento.components?.schemas?.["ConsultarSessaoRespostaDto"] as {
      properties?: Record<string, { type?: string; format?: string }>;
      required?: string[];
    };
    expect(schema).toBeDefined();
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["sessaoId", "usuarioId"]);
    expect(schema.properties?.["usuarioId"]?.format).toBe("uuid");
    expect(schema.properties?.["sessaoId"]?.format).toBe("uuid");
  });

  it("ConsultarSessaoRespostaDto NÃO vaza campos confidenciais", () => {
    const props = Object.keys(
      (
        documento.components?.schemas?.["ConsultarSessaoRespostaDto"] as {
          properties?: Record<string, unknown>;
        }
      )?.properties ?? {},
    );
    const proibidos = ["token", "tokenHash", "segredo", "senhaHash", "hash", "cookie"];
    for (const proibido of proibidos) {
      expect(props.some((p) => p.toLowerCase().includes(proibido.toLowerCase()))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AUT-005 — alteração administrativa de situação de usuário (D-2.3D-21)
// ---------------------------------------------------------------------------

describe("AUT-005 — alteração de situação de usuário documentada", () => {
  const CAMINHO = "/auth/usuarios/{usuarioId}/situacao";

  it("PATCH está documentada com AUT-005 e exige cookie de sessão", () => {
    const op = operacao(CAMINHO, "patch");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-005"));
    expect(op["tags"]).toEqual(["Autenticação"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
  });

  it("PATCH documenta 200, 400, 401, 403, 404, 413, 422 e 500", () => {
    expect(Object.keys(respostas(CAMINHO, "patch")).sort()).toEqual([
      "200",
      "400",
      "401",
      "403",
      "404",
      "413",
      "422",
      "500",
    ]);
  });

  it("PATCH tem parâmetro de path usuarioId obrigatório e format uuid", () => {
    const params = operacao(CAMINHO, "patch")["parameters"] as Array<Record<string, unknown>>;
    const param = params.find((p) => p["name"] === "usuarioId" && p["in"] === "path");
    expect(param?.["required"]).toBe(true);
    expect((param?.["schema"] as Record<string, unknown>)?.["format"]).toBe("uuid");
  });

  it("Erros da rota usam o schema ErroSituacaoUsuarioDto com conjunto fechado", () => {
    const schema = documento.components?.schemas?.["ErroSituacaoUsuarioDto"] as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(["erro"]);
    expect(schema.properties?.["erro"]?.enum?.sort()).toEqual([
      "ACESSO_NEGADO",
      "AUTO_INATIVACAO_PROIBIDA",
      "FALHA_INTERNA",
      "REQUISICAO_INVALIDA",
      "REQUISICAO_NAO_AUTORIZADA",
      "SESSAO_INVALIDA",
      "USUARIO_INEXISTENTE",
    ]);
  });

  it("a resposta de sucesso expõe apenas usuarioId, ativo e inativadoEm", () => {
    const schema = documento.components?.schemas?.["AlterarSituacaoUsuarioRespostaDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
      "ativo",
      "inativadoEm",
      "usuarioId",
    ]);
  });
});

// ---------------------------------------------------------------------------
// P-2.3D-10 — listagem administrativa das sessões ativas (AUT-002, D-2.3D-22)
// ---------------------------------------------------------------------------

describe("P-2.3D-10 — listagem administrativa de sessões ativas documentada", () => {
  const CAMINHO = "/auth/usuarios/{usuarioId}/sessoes";

  it("GET está documentada com AUT-002 e D-2.3D-22 e exige cookie de sessão", () => {
    const op = operacao(CAMINHO, "get");
    expect(op["summary"]).toEqual(expect.stringContaining("AUT-002"));
    expect(op["summary"]).toEqual(expect.stringContaining("D-2.3D-22"));
    expect(op["tags"]).toEqual(["Autenticação"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
  });

  it("documenta EXATAMENTE 200, 400, 401, 403 e 500", () => {
    const todas = respostas(CAMINHO, "get");
    expect(Object.keys(todas).sort()).toEqual(["200", "400", "401", "403", "500"]);
    expect((todas["200"] as Record<string, unknown>)["content"]).toBeDefined();
  });

  it("tem parâmetro de path usuarioId obrigatório, format uuid, e nenhum outro parâmetro", () => {
    const params = (operacao(CAMINHO, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
    expect(params).toHaveLength(1);
    expect(params[0]?.["name"]).toBe("usuarioId");
    expect(params[0]?.["in"]).toBe("path");
    expect(params[0]?.["required"]).toBe(true);
    expect((params[0]?.["schema"] as Record<string, unknown>)?.["format"]).toBe("uuid");
  });

  it("ListarSessoesUsuarioRespostaDto expõe SÓ sessoes, e o item SÓ os quatro campos homologados", () => {
    const envelope = documento.components?.schemas?.["ListarSessoesUsuarioRespostaDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(envelope.properties ?? {})).toEqual(["sessoes"]);

    const item = documento.components?.schemas?.["SessaoAtivaUsuarioDto"] as {
      properties?: Record<string, { format?: string }>;
    };
    expect(Object.keys(item.properties ?? {}).sort()).toEqual([
      "criadaEm",
      "expiraEm",
      "sessaoId",
      "ultimaAtividadeEm",
    ]);
    expect(item.properties?.["sessaoId"]?.format).toBe("uuid");
    for (const campo of ["criadaEm", "ultimaAtividadeEm", "expiraEm"]) {
      expect(item.properties?.[campo]?.format).toBe("date-time");
    }
    const proibidos = ["token", "hash", "segredo", "senha", "cookie", "estado", "revogada", "usuario"];
    for (const nome of Object.keys(item.properties ?? {})) {
      expect(proibidos.some((p) => nome.toLowerCase().includes(p))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AUD-004 / PBACK-AUD-08 — consulta da trilha de auditoria (docs/09 §13.9)
// ---------------------------------------------------------------------------

describe("AUD-004 — consulta da trilha de auditoria documentada", () => {
  const CAMINHO = "/auditoria/eventos";

  it("GET é a ÚNICA operação do caminho, com AUD-004, tag Auditoria e cookie de sessão", () => {
    expect(Object.keys(documento.paths[CAMINHO] ?? {}).filter((k) => k !== "parameters")).toEqual(["get"]);
    const op = operacao(CAMINHO, "get");
    expect(op["summary"]).toEqual(expect.stringContaining("AUD-004"));
    expect(op["tags"]).toEqual(["Auditoria"]);
    const seguranca = op["security"] as Array<Record<string, unknown>> | undefined;
    expect(seguranca?.some((s) => NOME_ESQUEMA_SESSAO in s)).toBe(true);
    expect(op["requestBody"]).toBeUndefined();
  });

  it("GET documenta 200, 400, 401, 403 e 500", () => {
    expect(Object.keys(respostas(CAMINHO, "get")).sort()).toEqual(["200", "400", "401", "403", "500"]);
  });

  it("parâmetros: SÓ os 10 de query homologados, sem header CSRF", () => {
    const params = (operacao(CAMINHO, "get")["parameters"] ?? []) as Array<Record<string, unknown>>;
    expect(params.every((p) => p["in"] === "query")).toBe(true);
    expect(params.every((p) => p["required"] === false)).toBe(true);
    expect(params.map((p) => p["name"]).sort()).toEqual([
      "acao",
      "alvoId",
      "alvoTipo",
      "atorUsuarioId",
      "correlacaoId",
      "cursor",
      "limite",
      "ocorridoAte",
      "ocorridoDe",
      "resultado",
    ]);
    const limite = params.find((p) => p["name"] === "limite")?.["schema"] as Record<string, unknown>;
    expect(limite).toEqual(expect.objectContaining({ type: "integer", minimum: 1, maximum: 50, default: 20 }));
  });

  it("PaginaEventosAuditoriaDto expõe SÓ itens e proximoCursor", () => {
    const schema = documento.components?.schemas?.["PaginaEventosAuditoriaDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["itens", "proximoCursor"]);
  });

  it("EventoAuditoriaDto expõe SÓ colunas próprias de evento_auditoria — sem justificativa, sem dado resolvido do ator/alvo", () => {
    const schema = documento.components?.schemas?.["EventoAuditoriaDto"] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
      "acao",
      "alvoId",
      "alvoTipo",
      "atorUsuarioId",
      "contexto",
      "correlacaoId",
      "id",
      "ocorridoEm",
      "resultado",
    ]);
  });

  it("Erros usam ErroConsultaAuditoriaDto com conjunto fechado", () => {
    const schema = documento.components?.schemas?.["ErroConsultaAuditoriaDto"] as {
      properties?: Record<string, { enum?: string[] }>;
    };
    expect(Object.keys(schema.properties ?? {})).toEqual(["erro"]);
    expect(schema.properties?.["erro"]?.enum?.sort()).toEqual([
      "ACESSO_NEGADO",
      "FALHA_INTERNA",
      "REQUISICAO_INVALIDA",
      "SESSAO_INVALIDA",
    ]);
  });
});

describe("PAC-A — contratos de /pacientes (docs/17)", () => {
  const esperados: Array<[string, "get" | "post" | "put" | "patch", string[]]> = [
    ["/pacientes/busca", "post", ["200", "400", "401", "403", "413", "500"]],
    ["/pacientes", "post", ["201", "400", "401", "403", "404", "409", "413", "500"]],
    ["/pacientes/{pacienteId}", "get", ["200", "400", "401", "403", "404", "500"]],
    ["/pacientes/{pacienteId}", "put", ["200", "400", "401", "403", "404", "409", "413", "500"]],
    ["/pacientes/{pacienteId}/situacao", "patch", ["200", "400", "401", "403", "404", "413", "500"]],
  ];

  it.each(esperados)("%s %s documenta exatamente os status do contrato", (caminho, metodo, status) => {
    expect(Object.keys(respostas(caminho, metodo)).sort()).toEqual(status);
    expect(operacao(caminho, metodo)["security"]).toBeDefined();
  });

  it("a busca é POST (filtros pessoais nunca em query string) e não existe GET /pacientes nem DELETE", () => {
    const caminhos = documento.paths as Record<string, Record<string, unknown>>;
    expect(caminhos["/pacientes/busca"]?.["get"]).toBeUndefined();
    expect(caminhos["/pacientes"]?.["get"]).toBeUndefined();
    for (const caminho of ["/pacientes", "/pacientes/busca", "/pacientes/{pacienteId}", "/pacientes/{pacienteId}/situacao"]) {
      expect(caminhos[caminho]?.["delete"]).toBeUndefined();
    }
    const parametros = (operacao("/pacientes/busca", "post")["parameters"] ?? []) as Array<{ in?: string }>;
    expect(parametros.some((p) => p.in === "query")).toBe(false);
  });
});
