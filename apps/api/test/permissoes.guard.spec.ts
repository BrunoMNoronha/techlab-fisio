// TechLab Fisio — Etapa 2.3D-B / F4 (fatia corretiva) — `PermissoesGuard` e
// o contexto autenticado.
//
// Suíte SEM banco e SEM servidor: prova a DECISÃO da guard contra um
// resolvedor controlado, e prova o contexto autenticado como estrutura. O
// caminho real — decorator, cookie, sessão, PostgreSQL, HTTP — é medido na
// suíte de integração `test/integration/authz-rbac.integration.spec.ts`.
//
// Propriedades medidas aqui:
//   - concessão e negação sobre UMA permissão (sem composição);
//   - fail-closed em metadata ausente, inválida e em LISTA;
//   - fail-closed em contexto ausente, usuário inexistente e usuário inativo;
//   - `403` — jamais `401` — para toda negação de autorização;
//   - falha TÉCNICA sobe como exceção e NÃO vira `403`;
//   - `R4-01`: a identidade VALIDADA sobrescreve qualquer contexto semeado,
//     e é ela que a guard consulta;
//   - a identidade não vem do pedido, e não vaza entre usuários.

import { describe, expect, it } from "@jest/globals";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import {
  anexarContextoAutenticado,
  lerContextoAutenticado,
} from "../src/authz/contexto-autenticado.js";
import { CHAVE_PERMISSAO_EXIGIDA } from "../src/authz/permissao-exigida.metadata.js";
import { PermissoesGuard } from "../src/authz/permissoes.guard.js";
import type { PermissoesService } from "../src/authz/permissoes.service.js";
import type { ResultadoPermissoesEfetivas } from "../src/authz/permissoes.service.js";
import { RequerPermissao } from "../src/authz/requer-permissao.decorator.js";

const USUARIO_A = "11111111-1111-4111-8111-111111111111";
const USUARIO_B = "22222222-2222-4222-8222-222222222222";
const SESSAO = "33333333-3333-4333-8333-333333333333";

/** Falha técnica sintética — representa banco indisponível/erro de driver. */
class FalhaTecnicaSintetica extends Error {
  override readonly name = "FalhaTecnicaSintetica";
}

/**
 * Resolvedor controlado. Registra QUAL `usuarioId` foi consultado — é assim
 * que se prova que a identidade veio do contexto validado, e não de outra
 * fonte.
 */
function resolvedor(
  porUsuario: Readonly<Record<string, ResultadoPermissoesEfetivas>>,
  opcoes: { readonly lancar?: boolean } = {},
): { servico: PermissoesService; consultados: string[] } {
  const consultados: string[] = [];
  const servico = {
    async resolverDoUsuario(usuarioId: unknown): Promise<ResultadoPermissoesEfetivas> {
      consultados.push(String(usuarioId));
      if (opcoes.lancar === true) throw new FalhaTecnicaSintetica("banco indisponível");
      return (
        porUsuario[String(usuarioId)] ?? {
          resolvido: false as const,
          motivo: "USUARIO_INEXISTENTE" as const,
        }
      );
    },
  } as unknown as PermissoesService;
  return { servico, consultados };
}

/** Requisição sintética; `extras` simulam corpo/query/cabeçalhos forjados. */
function requisicao(extras: Record<string, unknown> = {}): Record<string, unknown> {
  return { headers: {}, ...extras };
}

/** `ExecutionContext` mínimo — o handler é sempre um alvo real decorado. */
function contextoDe(requisicaoHttp: unknown, handler: unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => requisicaoHttp }),
  } as unknown as ExecutionContext;
}

/** Handler decorado de verdade com `@RequerPermissao`. */
function handlerExigindo(permissao: string): unknown {
  class Controlador {
    acao(): void {}
  }
  (RequerPermissao as unknown as (p: string) => MethodDecorator)(permissao)(
    Controlador.prototype,
    "acao",
    Object.getOwnPropertyDescriptor(Controlador.prototype, "acao") as PropertyDescriptor,
  );
  return Controlador.prototype.acao;
}

/** Handler com metadata escrita à mão — para os casos de metadata inválida. */
function handlerComMetadataBruta(valor: unknown): unknown {
  class Controlador {
    acao(): void {}
  }
  Reflect.defineMetadata(CHAVE_PERMISSAO_EXIGIDA, valor, Controlador.prototype.acao);
  return Controlador.prototype.acao;
}

function autorizado(permissoes: readonly string[]): ResultadoPermissoesEfetivas {
  return { resolvido: true, permissoes: [...permissoes] };
}

function comContexto(usuarioId: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  const req = requisicao(extras);
  anexarContextoAutenticado(req, { usuarioId, sessaoId: SESSAO });
  return req;
}

describe("`PermissoesGuard` — concede quando, e somente quando, deve", () => {
  it("permite: a permissão exigida está entre as efetivas", async () => {
    const { servico, consultados } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar", "auditoria.ler"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar"))),
    ).resolves.toBe(true);
    // Controle positivo de não vacuidade: a decisão realmente consultou o
    // usuário do contexto — não passou por algum atalho anterior.
    expect(consultados).toEqual([USUARIO_A]);
  });

  it("nega com 403: usuário autenticado sem a permissão exigida", async () => {
    const { servico } = resolvedor({ [USUARIO_A]: autorizado(["auditoria.ler"]) });
    const guard = new PermissoesGuard(new Reflector(), servico);
    const promessa = guard.canActivate(
      contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar")),
    );
    await expect(promessa).rejects.toBeInstanceOf(ForbiddenException);
    // `403` e NUNCA `401`: falta de permissão não é falta de autenticação.
    await expect(promessa).rejects.not.toBeInstanceOf(UnauthorizedException);
    await promessa.catch((erro: unknown) => {
      expect((erro as ForbiddenException).getStatus()).toBe(403);
      expect((erro as ForbiddenException).getResponse()).toEqual({ erro: "ACESSO_NEGADO" });
    });
  });

  it("nega: usuário sem papel algum — conjunto efetivo vazio", async () => {
    const { servico } = resolvedor({ [USUARIO_A]: autorizado([]) });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permissão repetida no conjunto efetivo não altera o resultado", async () => {
    const { servico } = resolvedor({
      [USUARIO_A]: autorizado(["agenda.gerenciar", "agenda.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("agenda.gerenciar"))),
    ).resolves.toBe(true);
  });

  it("possuir OUTRAS permissões não substitui a exigida", async () => {
    const { servico } = resolvedor({
      [USUARIO_A]: autorizado(["auditoria.ler", "agenda.gerenciar", "prontuario.ler"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("`PermissoesGuard` — fail-closed", () => {
  it("metadata AUSENTE nega — guard aplicada à mão sem declaração", async () => {
    const { servico, consultados } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    class SemMetadata {
      acao(): void {}
    }
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), SemMetadata.prototype.acao)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Nem chegou a consultar: a recusa é anterior a qualquer acesso a dados.
    expect(consultados).toEqual([]);
  });

  it("metadata INVÁLIDA nega, mesmo com o usuário plenamente permissionado", async () => {
    const { servico } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar", "permissoes.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    for (const invalida of [
      [],
      ["usuarios.gerenciar"],
      ["usuarios.gerenciar", "permissoes.gerenciar"],
      "permissao.inexistente",
      "",
      {},
      0,
      null,
    ]) {
      await expect(
        guard.canActivate(
          contextoDe(comContexto(USUARIO_A), handlerComMetadataBruta(invalida)),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("contexto autenticado AUSENTE nega — e não tenta autenticar", async () => {
    const { servico, consultados } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    const promessa = guard.canActivate(
      contextoDe(requisicao(), handlerExigindo("usuarios.gerenciar")),
    );
    await expect(promessa).rejects.toBeInstanceOf(ForbiddenException);
    await expect(promessa).rejects.not.toBeInstanceOf(UnauthorizedException);
    expect(consultados).toEqual([]);
  });

  it("usuário INEXISTENTE nega", async () => {
    const { servico } = resolvedor({
      [USUARIO_A]: { resolvido: false, motivo: "USUARIO_INEXISTENTE" },
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("usuário INATIVO nega — defesa em profundidade, não AUT-005", async () => {
    // Ver §6-K de `docs/10`: cobertura PARCIAL. Esta negação NÃO materializa
    // a revogação de sessões exigida por AUT-005/RN-001.
    const { servico } = resolvedor({
      [USUARIO_A]: { resolvido: false, motivo: "USUARIO_INATIVO" },
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("falha TÉCNICA sobe como exceção — não é maquiada como `403`", async () => {
    // Fail-closed é "o handler não é alcançado", não "responde 403 sempre".
    const { servico } = resolvedor({}, { lancar: true });
    const guard = new PermissoesGuard(new Reflector(), servico);
    const promessa = guard.canActivate(
      contextoDe(comContexto(USUARIO_A), handlerExigindo("usuarios.gerenciar")),
    );
    await expect(promessa).rejects.toBeInstanceOf(FalhaTecnicaSintetica);
    await expect(promessa).rejects.not.toBeInstanceOf(ForbiddenException);
  });
});

describe("`R4-01` — a identidade VALIDADA é autoritativa", () => {
  it("contexto inexistente: a identidade validada é gravada", () => {
    const req = requisicao();
    anexarContextoAutenticado(req, { usuarioId: USUARIO_A, sessaoId: SESSAO });
    expect(lerContextoAutenticado(req)).toEqual({ usuarioId: USUARIO_A, sessaoId: SESSAO });
  });

  it("contexto SEMEADO com outra identidade é SOBRESCRITO pela validada", () => {
    // O símbolo é recuperável de uma requisição já processada — foi assim que
    // a revisão independente semeou o contexto. A defesa não é o sigilo da
    // chave: é esta sobrescrita.
    const processada: Record<string, unknown> = requisicao();
    anexarContextoAutenticado(processada, { usuarioId: USUARIO_A, sessaoId: SESSAO });
    const chave = Object.getOwnPropertySymbols(processada)[0] as symbol;

    const nova: Record<string | symbol, unknown> = requisicao();
    nova[chave] = { usuarioId: USUARIO_A, sessaoId: "semeada" };
    anexarContextoAutenticado(nova, { usuarioId: USUARIO_B, sessaoId: "real" });

    expect(lerContextoAutenticado(nova)).toEqual({ usuarioId: USUARIO_B, sessaoId: "real" });
  });

  it("a guard consulta a identidade VALIDADA, não a semeada", async () => {
    const processada: Record<string, unknown> = requisicao();
    anexarContextoAutenticado(processada, { usuarioId: "x", sessaoId: "s" });
    const chave = Object.getOwnPropertySymbols(processada)[0] as symbol;

    const { servico, consultados } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar"]), // vítima, permissionada
      [USUARIO_B]: autorizado([]), // dono real da sessão, sem permissão
    });
    const guard = new PermissoesGuard(new Reflector(), servico);

    const req: Record<string | symbol, unknown> = requisicao();
    req[chave] = { usuarioId: USUARIO_A, sessaoId: "semeada" };
    anexarContextoAutenticado(req, { usuarioId: USUARIO_B, sessaoId: "real" });

    await expect(
      guard.canActivate(contextoDe(req, handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Prova positiva: quem foi consultado foi o dono REAL da sessão.
    expect(consultados).toEqual([USUARIO_B]);
  });

  it("controle positivo: sem contaminação, o dono real permissionado passa", async () => {
    const { servico, consultados } = resolvedor({
      [USUARIO_B]: autorizado(["usuarios.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_B), handlerExigindo("usuarios.gerenciar"))),
    ).resolves.toBe(true);
    expect(consultados).toEqual([USUARIO_B]);
  });
});

describe("`PermissoesGuard` — a identidade não vem do pedido", () => {
  it("corpo, query e cabeçalhos forjados NÃO alteram o usuário consultado", async () => {
    const { servico, consultados } = resolvedor({
      [USUARIO_A]: autorizado([]),
      [USUARIO_B]: autorizado(["usuarios.gerenciar"]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    const req = comContexto(USUARIO_A, {
      body: { usuarioId: USUARIO_B, permissoes: ["usuarios.gerenciar"] },
      query: { usuarioId: USUARIO_B, papel: "Administrador" },
      headers: {
        "x-usuario-id": USUARIO_B,
        "x-papel": "Administrador",
        "x-permissoes": "usuarios.gerenciar",
      },
      user: { id: USUARIO_B },
      usuarioId: USUARIO_B,
    });

    await expect(
      guard.canActivate(contextoDe(req, handlerExigindo("usuarios.gerenciar"))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(consultados).toEqual([USUARIO_A]);
  });

  it("a permissão de um usuário não serve a outro", async () => {
    const { servico } = resolvedor({
      [USUARIO_A]: autorizado(["usuarios.gerenciar"]),
      [USUARIO_B]: autorizado([]),
    });
    const guard = new PermissoesGuard(new Reflector(), servico);
    const handler = handlerExigindo("usuarios.gerenciar");
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_A), handler)),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextoDe(comContexto(USUARIO_B), handler)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("contexto autenticado — estrutura e limites declarados", () => {
  it("a chave NÃO é o símbolo do registro global", () => {
    const req = comContexto(USUARIO_A);
    expect(
      (req as Record<symbol, unknown>)[Symbol.for("tlf.contexto_autenticado")],
    ).toBeUndefined();
  });

  it("o contexto não é enumerável nem serializado em JSON", () => {
    const req = comContexto(USUARIO_A);
    expect(Object.keys(req)).not.toContain("contexto_autenticado");
    expect(JSON.stringify(req)).not.toContain(USUARIO_A);
  });

  it("o valor gravado é congelado", () => {
    const req = comContexto(USUARIO_A);
    expect(Object.isFrozen(lerContextoAutenticado(req))).toBe(true);
  });

  it("a leitura é fail-closed para requisição e contexto degenerados", () => {
    for (const invalida of [null, undefined, 0, "req", requisicao()]) {
      expect(lerContextoAutenticado(invalida)).toBeNull();
    }
    const processada = comContexto(USUARIO_A);
    const chave = Object.getOwnPropertySymbols(processada)[0] as symbol;
    for (const ruim of [
      { usuarioId: "", sessaoId: "s" },
      { usuarioId: USUARIO_A, sessaoId: "" },
      { usuarioId: 1, sessaoId: "s" },
      null,
      "texto",
    ]) {
      const r: Record<string | symbol, unknown> = {};
      r[chave] = ruim;
      expect(lerContextoAutenticado(r)).toBeNull();
    }
  });

  it("não confunde propriedades homônimas do pedido com o contexto", () => {
    const req = requisicao({
      contexto_autenticado: { usuarioId: USUARIO_B, sessaoId: SESSAO },
      usuarioId: USUARIO_B,
    });
    expect(lerContextoAutenticado(req)).toBeNull();
  });
});
