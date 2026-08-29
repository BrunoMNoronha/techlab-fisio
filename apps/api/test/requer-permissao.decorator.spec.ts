// TechLab Fisio — Etapa 2.3D-B / F4 (fatia corretiva) — `@RequerPermissao`.
//
// A propriedade central desta suíte é a correção `R4-03`: o decorator não
// apenas DECLARA a permissão — ele INSTALA as duas guards, na ordem. Antes,
// declarar sem `@UseGuards` deixava a rota completamente desprotegida (medido
// pela revisão independente: `200` sem sessão alguma).
//
// Prova também a simplificação: aridade EXATAMENTE 1, somente método, sem
// metadata de classe, sem composição `AND`/`OR`, sem herança.

import { describe, expect, it } from "@jest/globals";
import { Controller, Get } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";

import { CHAVE_PERMISSAO_EXIGIDA } from "../src/authz/permissao-exigida.metadata.js";
import { normalizarPermissaoExigida } from "../src/authz/permissao-exigida.metadata.js";
import { PERMISSOES } from "../src/authz/permissoes.catalogo.js";
import { PermissoesGuard } from "../src/authz/permissoes.guard.js";
import {
  ErroDeclaracaoPermissao,
  RequerPermissao,
} from "../src/authz/requer-permissao.decorator.js";
import { SessaoAutenticadaGuard } from "../src/authz/sessao-autenticada.guard.js";

const reflector = new Reflector();

/** Aplica o decorator a um método sintético e devolve o handler decorado. */
function metodoDecorado(permissao: string): (...args: unknown[]) => unknown {
  class Controlador {
    acao(): void {}
  }
  const descritor = Object.getOwnPropertyDescriptor(
    Controlador.prototype,
    "acao",
  ) as PropertyDescriptor;
  (RequerPermissao as unknown as (p: string) => MethodDecorator)(permissao)(
    Controlador.prototype,
    "acao",
    descritor,
  );
  return Controlador.prototype.acao as (...args: unknown[]) => unknown;
}

function guardsDe(handler: unknown): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, handler as object) ?? []) as unknown[];
}

describe("C1 — `@RequerPermissao` declara UMA permissão do catálogo", () => {
  it("grava a permissão como VALOR ESCALAR, nunca como lista", () => {
    const handler = metodoDecorado("usuarios.gerenciar");
    const metadata = reflector.get<unknown>(CHAVE_PERMISSAO_EXIGIDA, handler);
    expect(metadata).toBe("usuarios.gerenciar");
    expect(Array.isArray(metadata)).toBe(false);
  });

  it("aceita cada uma das 29 permissões homologadas", () => {
    for (const permissao of PERMISSOES) {
      expect(reflector.get<unknown>(CHAVE_PERMISSAO_EXIGIDA, metodoDecorado(permissao))).toBe(
        permissao,
      );
    }
  });

  it("recusa NA DECLARAÇÃO identificador fora do catálogo de `docs/04` §5", () => {
    for (const invalido of [
      "admin",
      "usuarios.gerenciarr",
      "*",
      "usuarios.*",
      "",
      " usuarios.gerenciar",
      "USUARIOS.GERENCIAR",
    ]) {
      expect(() => metodoDecorado(invalido)).toThrow(ErroDeclaracaoPermissao);
    }
  });

  it("recusa valores que não são string", () => {
    for (const invalido of [null, undefined, 0, true, {}, ["usuarios.gerenciar"]]) {
      expect(() =>
        (RequerPermissao as unknown as (p: unknown) => MethodDecorator)(invalido),
      ).toThrow(ErroDeclaracaoPermissao);
    }
  });

  it("uma LISTA é recusada — a composição deixou de pertencer ao contrato", () => {
    // O tipo já barra em compilação; aqui prova-se o runtime.
    expect(() =>
      (RequerPermissao as unknown as (p: unknown) => MethodDecorator)([
        "usuarios.gerenciar",
        "permissoes.gerenciar",
      ]),
    ).toThrow(ErroDeclaracaoPermissao);
  });
});

describe("C2 — `@RequerPermissao` INSTALA as guards, na ordem (`R4-03`)", () => {
  it("o handler decorado carrega exatamente as duas guards", () => {
    const guards = guardsDe(metodoDecorado("usuarios.gerenciar"));
    expect(guards).toEqual([SessaoAutenticadaGuard, PermissoesGuard]);
  });

  it("a ORDEM é sessão -> permissões — é ela que separa `401` de `403`", () => {
    const guards = guardsDe(metodoDecorado("auditoria.ler"));
    expect(guards.indexOf(SessaoAutenticadaGuard)).toBeLessThan(
      guards.indexOf(PermissoesGuard),
    );
  });

  it("controle negativo: um método SEM o decorator não carrega guard alguma", () => {
    // Sem este controle, `guardsDe` poderia estar lendo a chave errada e as
    // asserções acima passariam por acidente.
    class SemDecorator {
      acao(): void {}
    }
    expect(guardsDe(SemDecorator.prototype.acao)).toEqual([]);
    expect(
      reflector.get<unknown>(CHAVE_PERMISSAO_EXIGIDA, SemDecorator.prototype.acao),
    ).toBeUndefined();
  });

  it("num controller real, cada método decorado recebe suas próprias guards", () => {
    @Controller("sintetico")
    class Controlador {
      @Get("a")
      @RequerPermissao("usuarios.gerenciar")
      a(): void {}

      @Get("b")
      b(): void {}
    }
    expect(guardsDe(Controlador.prototype.a)).toEqual([
      SessaoAutenticadaGuard,
      PermissoesGuard,
    ]);
    // O método vizinho, não decorado, permanece intocado — a proteção é por
    // operação, e não contamina o controller.
    expect(guardsDe(Controlador.prototype.b)).toEqual([]);
    // E nenhuma metadata de CLASSE é escrita: a superfície de classe/herança
    // que produzia `R4-04` deixou de existir.
    expect(reflector.get<unknown>(CHAVE_PERMISSAO_EXIGIDA, Controlador)).toBeUndefined();
    expect(guardsDe(Controlador)).toEqual([]);
  });
});

describe("`normalizarPermissaoExigida` — fail-closed", () => {
  it("aceita identificador homologado", () => {
    expect(normalizarPermissaoExigida("auditoria.ler")).toBe("auditoria.ler");
  });

  it("recusa array — inclusive de permissões válidas", () => {
    expect(normalizarPermissaoExigida(["auditoria.ler"])).toBeNull();
    expect(
      normalizarPermissaoExigida(["auditoria.ler", "usuarios.gerenciar"]),
    ).toBeNull();
  });

  it("recusa ausência, tipo errado e identificador desconhecido", () => {
    for (const invalido of [
      undefined,
      null,
      "",
      " auditoria.ler",
      "auditoria.ler ",
      "AUDITORIA.LER",
      "permissao.inexistente",
      0,
      true,
      {},
      { permissao: "auditoria.ler" },
    ]) {
      expect(normalizarPermissaoExigida(invalido)).toBeNull();
    }
  });
});
