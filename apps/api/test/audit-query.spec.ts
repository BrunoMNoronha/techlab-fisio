// TechLab Fisio — AUD-004 / `PBACK-AUD-08` (`docs/09` §13.9) — testes SEM banco
// da consulta da trilha de auditoria: validação fail-closed dos filtros,
// paginação/limite, cursor, forma da consulta Prisma (sem join, ordem
// determinística) e declaração da rota (RBAC, sem CSRF, sem auto-auditoria).

import "reflect-metadata";

import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";

import {
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  PARAMETROS_CONSULTA_AUDITORIA,
  analisarInstante,
  deserializarCursor,
  serializarCursor,
  validarConsultaAuditoria,
} from "../src/audit/audit-query.dto.js";
import { AuditQueryService, COLUNAS_CONSULTA_AUDITORIA } from "../src/audit/audit-query.service.js";
import { AuditController } from "../src/audit/audit.controller.js";
import { AuditoriaConsultaModule } from "../src/audit/auditoria-consulta.module.js";
import { AuditWriter } from "../src/audit/audit-writer.js";
import { ERRO } from "../src/auth/auth.dto.js";
import { ProtecaoCsrfGuard } from "../src/auth/protecao-csrf.guard.js";
import { CHAVE_PERMISSAO_EXIGIDA } from "../src/authz/permissao-exigida.metadata.js";
import { PermissoesGuard } from "../src/authz/permissoes.guard.js";
import { SessaoAutenticadaGuard } from "../src/authz/sessao-autenticada.guard.js";
import type { DatabaseService } from "../src/database/database.service.js";

const UUID = "01900000-0000-7000-8000-000000000001";

function rejeita(query: unknown): void {
  let erro: unknown;
  try {
    validarConsultaAuditoria(query);
  } catch (e) {
    erro = e;
  }
  expect(erro).toBeInstanceOf(BadRequestException);
  expect((erro as BadRequestException).getResponse()).toEqual({ erro: ERRO.REQUISICAO_INVALIDA });
}

describe("AUD-004 — parâmetros: conjunto fechado", () => {
  it("o conjunto é exatamente o de §13.9 + paginação", () => {
    expect([...PARAMETROS_CONSULTA_AUDITORIA].sort()).toEqual([
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
  });

  it("sem parâmetros: limite padrão e nenhum filtro", () => {
    expect(validarConsultaAuditoria({})).toEqual({ limite: LIMITE_PADRAO });
  });

  it.each([
    "contexto",
    "justificativa",
    "q",
    "busca",
    "texto",
    "nome",
    "email",
    "cpf",
    "ator",
    "offset",
    "pagina",
    "ordem",
    "incluir",
    "expandir",
  ])("parâmetro proibido/desconhecido `%s` é 400", (nome) => {
    rejeita({ [nome]: "x" });
  });

  it("filtro por chave de contexto aninhada (contexto[motivo]=x) é 400", () => {
    rejeita({ contexto: { motivo: "x" } });
  });

  it("parâmetro repetido (array) é 400", () => {
    rejeita({ acao: ["usuario.autenticacao", "usuario.sessao.logout"] });
  });

  it("aceita todos os filtros válidos combinados", () => {
    const f = validarConsultaAuditoria({
      ocorridoDe: "2026-08-25T00:00:00Z",
      ocorridoAte: "2026-08-25T23:59:59.999Z",
      atorUsuarioId: UUID,
      acao: "autorizacao.negada",
      alvoTipo: "retificacao_clinica",
      alvoId: UUID,
      correlacaoId: UUID,
      resultado: "NEGADO",
      limite: "50",
    });
    expect(f).toEqual({
      ocorridoDe: new Date("2026-08-25T00:00:00.000Z"),
      ocorridoAte: new Date("2026-08-25T23:59:59.999Z"),
      atorUsuarioId: UUID,
      acao: "autorizacao.negada",
      alvoTipo: "retificacao_clinica",
      alvoId: UUID,
      correlacaoId: UUID,
      resultado: "NEGADO",
      limite: 50,
    });
  });
});

describe("AUD-004 — acao e resultado", () => {
  it.each(["usuario.autenticacao", "autorizacao.negada", "prontuario.exportado"])(
    "ação do catálogo `%s` é aceita",
    (acao) => {
      expect(validarConsultaAuditoria({ acao }).acao).toBe(acao);
    },
  );

  it.each([
    "auditoria.consultada",
    "prontuario.acessado",
    "usuario",
    "usuario.%",
    "USUARIO.AUTENTICACAO",
    " usuario.autenticacao",
    "",
  ])("ação fora do catálogo `%s` é 400 (sem busca parcial/normalização)", (acao) => {
    rejeita({ acao });
  });

  it.each(["SUCESSO", "NEGADO", "FALHA"])("resultado `%s` é aceito", (resultado) => {
    expect(validarConsultaAuditoria({ resultado }).resultado).toBe(resultado);
  });

  it.each(["sucesso", "ERRO", "", "SUCESSO "])("resultado `%s` é 400", (resultado) => {
    rejeita({ resultado });
  });
});

describe("AUD-004 — UUIDs e alvoTipo", () => {
  it.each(["atorUsuarioId", "alvoId", "correlacaoId"])("%s malformado é 400", (nome) => {
    for (const valor of ["", "123", `${UUID}x`, ` ${UUID}`, "' OR 1=1 --"]) {
      rejeita({ [nome]: valor });
    }
  });

  it.each(["usuario", "permissao", "retificacao_clinica"])("alvoTipo `%s` é aceito", (alvoTipo) => {
    expect(validarConsultaAuditoria({ alvoTipo }).alvoTipo).toBe(alvoTipo);
  });

  it.each(["", " usuario", "Usuario", "usu%", "usuario;drop", "a".repeat(64)])(
    "alvoTipo `%s` é 400",
    (alvoTipo) => {
      rejeita({ alvoTipo });
    },
  );
});

describe("AUD-004 — período", () => {
  it("instante com offset é convertido para UTC", () => {
    expect(analisarInstante("2026-08-25T10:00:00-03:00")?.toISOString()).toBe(
      "2026-08-25T13:00:00.000Z",
    );
  });

  it.each([
    "2026-08-25",
    "2026-08-25T10:00:00",
    "2026-08-25 10:00:00Z",
    "2026-02-30T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-08-25T24:00:00Z",
    "2026-08-25T10:00:00.1234Z",
    "2026-08-25T10:00:00+03",
    "1756116000000",
  ])("instante ambíguo/inválido `%s` é 400", (valor) => {
    rejeita({ ocorridoDe: valor });
    rejeita({ ocorridoAte: valor });
  });

  it("ocorridoDe == ocorridoAte é aceito; ocorridoDe > ocorridoAte é 400", () => {
    expect(() =>
      validarConsultaAuditoria({ ocorridoDe: "2026-08-25T10:00:00Z", ocorridoAte: "2026-08-25T10:00:00Z" }),
    ).not.toThrow();
    rejeita({ ocorridoDe: "2026-08-25T10:00:00.001Z", ocorridoAte: "2026-08-25T10:00:00Z" });
  });
});

describe("AUD-004 — paginação", () => {
  it("limite 1 e limite máximo são aceitos", () => {
    expect(validarConsultaAuditoria({ limite: "1" }).limite).toBe(1);
    expect(validarConsultaAuditoria({ limite: String(LIMITE_MAXIMO) }).limite).toBe(LIMITE_MAXIMO);
    expect(LIMITE_MAXIMO).toBe(50);
  });

  it.each(["0", "51", "1000", "-1", "1.5", "01", " 5", "", "abc", "1e2"])(
    "limite `%s` é 400 (sem clamp)",
    (limite) => {
      rejeita({ limite });
    },
  );

  it("cursor faz ida e volta", () => {
    const cursor = { ocorridoEm: new Date("2026-08-25T10:00:00.123Z"), id: UUID };
    expect(deserializarCursor(serializarCursor(cursor))).toEqual(cursor);
    expect(validarConsultaAuditoria({ cursor: serializarCursor(cursor) }).cursor).toEqual(cursor);
  });

  it("cursor adulterado é 400", () => {
    const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString("base64url");
    for (const cursor of [
      "",
      "!!!",
      "a".repeat(300),
      b64([]),
      b64({ o: "2026-08-25T10:00:00Z" }),
      b64({ o: "2026-08-25T10:00:00Z", i: "x" }),
      b64({ o: "ontem", i: UUID }),
      b64({ o: "2026-08-25T10:00:00Z", i: UUID, extra: 1 }),
      Buffer.from("nao-json").toString("base64url"),
    ]) {
      rejeita({ cursor });
    }
  });
});

function servicoComBancoFalso(linhas: unknown[]): {
  servico: AuditQueryService;
  findMany: jest.Mock<(args: unknown) => Promise<unknown[]>>;
} {
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>().mockResolvedValue(linhas);
  const database = {
    transacao: (corpo: (tx: unknown) => Promise<unknown>) =>
      corpo({ eventoAuditoria: { findMany } }),
  } as unknown as DatabaseService;
  return { servico: new AuditQueryService(database), findMany };
}

function linha(n: number): Record<string, unknown> {
  return {
    id: `01900000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    ocorridoEm: new Date(Date.UTC(2026, 7, 25, 10, 0, 0, n)),
    atorUsuarioId: null,
    acao: "usuario.autenticacao",
    alvoTipo: "usuario",
    alvoId: null,
    resultado: "SUCESSO",
    justificativa: "texto livre que NÃO pode sair",
    correlacaoId: UUID,
    contexto: null,
  };
}

describe("AUD-004 — forma da consulta (sem join, ordem determinística)", () => {
  it("seleciona SÓ colunas próprias, sem include/relação, ordem (ocorridoEm DESC, id DESC) e take limite+1", async () => {
    const { servico, findMany } = servicoComBancoFalso([]);
    await servico.consultar({ limite: 10 });
    const args = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(["orderBy", "select", "take", "where"]);
    expect(args["select"]).toEqual({
      id: true,
      ocorridoEm: true,
      atorUsuarioId: true,
      acao: true,
      alvoTipo: true,
      alvoId: true,
      resultado: true,
      correlacaoId: true,
      contexto: true,
    });
    expect(Object.values(args["select"] as object).every((v) => v === true)).toBe(true);
    expect(args["orderBy"]).toEqual([{ ocorridoEm: "desc" }, { id: "desc" }]);
    expect(args["take"]).toBe(11);
    expect(args["where"]).toEqual({ AND: [] });
  });

  it("COLUNAS_CONSULTA_AUDITORIA não contém relação (`ator`), `criadoEm` nem `justificativa`", () => {
    expect(Object.keys(COLUNAS_CONSULTA_AUDITORIA)).not.toContain("justificativa");
    expect(Object.keys(COLUNAS_CONSULTA_AUDITORIA)).not.toContain("ator");
    expect(Object.keys(COLUNAS_CONSULTA_AUDITORIA)).not.toContain("criadoEm");
  });

  it("filtros viram igualdade exata sobre colunas próprias; cursor vira keyset com desempate por id", async () => {
    const { servico, findMany } = servicoComBancoFalso([]);
    const de = new Date("2026-08-25T00:00:00Z");
    const ate = new Date("2026-08-26T00:00:00Z");
    const cursor = { ocorridoEm: new Date("2026-08-25T12:00:00Z"), id: UUID };
    await servico.consultar({
      ocorridoDe: de,
      ocorridoAte: ate,
      atorUsuarioId: UUID,
      acao: "usuario.autenticacao",
      alvoTipo: "usuario",
      alvoId: UUID,
      correlacaoId: UUID,
      resultado: "FALHA",
      limite: 5,
      cursor,
    });
    const args = findMany.mock.calls[0]?.[0] as { where: unknown };
    expect(args.where).toEqual({
      AND: [
        { ocorridoEm: { gte: de } },
        { ocorridoEm: { lte: ate } },
        { atorUsuarioId: UUID },
        { acao: "usuario.autenticacao" },
        { alvoTipo: "usuario" },
        { alvoId: UUID },
        { correlacaoId: UUID },
        { resultado: "FALHA" },
        { OR: [{ ocorridoEm: { lt: cursor.ocorridoEm } }, { ocorridoEm: cursor.ocorridoEm, id: { lt: UUID } }] },
      ],
    });
    expect(JSON.stringify(args.where)).not.toMatch(/contains|startsWith|endsWith|search|mode|contexto|justificativa/);
  });

  it("limite+1 linhas: devolve `limite` itens e cursor do último; senão proximoCursor nulo", async () => {
    const { servico } = servicoComBancoFalso([linha(3), linha(2), linha(1)]);
    const pagina = await servico.consultar({ limite: 2 });
    expect(pagina.itens.map((i) => i.id)).toEqual([linha(3)["id"], linha(2)["id"]]);
    expect(deserializarCursor(pagina.proximoCursor as string)).toEqual({
      ocorridoEm: linha(2)["ocorridoEm"],
      id: linha(2)["id"],
    });
    expect(Object.keys(pagina.itens[0] as object).sort()).toEqual(
      Object.keys(COLUNAS_CONSULTA_AUDITORIA).sort(),
    );
    expect(JSON.stringify(pagina)).not.toContain("texto livre");

    const { servico: s2 } = servicoComBancoFalso([linha(1)]);
    expect((await s2.consultar({ limite: 2 })).proximoCursor).toBeNull();
  });
});

describe("AUD-004 — declaração da rota", () => {
  const handler = AuditController.prototype.consultarEventos;

  it("exige exatamente auditoria.ler via SessaoAutenticadaGuard + PermissoesGuard", () => {
    expect(Reflect.getMetadata(CHAVE_PERMISSAO_EXIGIDA, handler)).toBe("auditoria.ler");
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      SessaoAutenticadaGuard,
      PermissoesGuard,
    ]);
  });

  it("NÃO usa ProtecaoCsrfGuard (GET seguro)", () => {
    const guardsClasse = (Reflect.getMetadata(GUARDS_METADATA, AuditController) ?? []) as unknown[];
    const guardsMetodo = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
    expect([...guardsClasse, ...guardsMetodo]).not.toContain(ProtecaoCsrfGuard);
  });

  it("nem o controller nem o serviço dependem do AuditWriter (consulta não é auditada)", () => {
    const deps = [
      ...((Reflect.getMetadata("design:paramtypes", AuditController) ?? []) as unknown[]),
      ...((Reflect.getMetadata("design:paramtypes", AuditQueryService) ?? []) as unknown[]),
    ];
    expect(deps).not.toContain(AuditWriter);
    const providers = (Reflect.getMetadata("providers", AuditoriaConsultaModule) ?? []) as unknown[];
    expect(providers).toEqual([AuditQueryService]);
  });

  it("controller valida antes de consultar: query inválida não chega ao serviço", async () => {
    const consultar = jest.fn<AuditQueryService["consultar"]>();
    const controller = new AuditController({ consultar } as unknown as AuditQueryService);
    await expect(controller.consultarEventos({ contexto: "x" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(consultar).not.toHaveBeenCalled();
  });
});
