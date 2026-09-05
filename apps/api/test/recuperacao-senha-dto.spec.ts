// TechLab Fisio — Etapa 2.3D-B / F6 — validação estrutural dos corpos de
// início e conclusão da recuperação de senha, e fronteira do módulo.
//
// A validação é a barreira que separa "payload rejeitado ANTES" (sem rate
// limit, sem evento, sem Argon2) de "tentativa" — por isso é testada
// isoladamente, como `auth-dto.spec.ts` faz para o login.

import "reflect-metadata";

import { describe, expect, it } from "@jest/globals";

import { AuditModule } from "../src/audit/audit.module.js";
import { MAXIMO_IDENTIFICADOR, MAXIMO_SENHA } from "../src/auth/auth.dto.js";
import { AuthzModule } from "../src/authz/authz.module.js";
import { RecuperacaoSenhaController } from "../src/recuperacao-senha/recuperacao-senha.controller.js";
import {
  ERRO_RECUPERACAO,
  MAXIMO_SEGREDO_RECUPERACAO,
  validarCorpoConcluirRecuperacao,
  validarCorpoIniciarRecuperacao,
} from "../src/recuperacao-senha/recuperacao-senha.dto.js";
import { RecuperacaoSenhaModule } from "../src/recuperacao-senha/recuperacao-senha.module.js";

describe("validarCorpoIniciarRecuperacao", () => {
  it("aceita identificador não vazio e entrega o valor CRU (D-2.3D-03 tem um dono só)", () => {
    const r = validarCorpoIniciarRecuperacao({ identificador: "  Alvo@Clinica.Local " });
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.valor).toEqual({ identificador: "  Alvo@Clinica.Local " });
  });

  it("ignora campos extras — em particular, um `atorUsuarioId` no corpo não existe para o contrato", () => {
    const r = validarCorpoIniciarRecuperacao({
      identificador: "u@c.local",
      atorUsuarioId: "00000000-0000-0000-0000-000000000000",
      usuarioId: "x",
    });
    expect(r.valido).toBe(true);
    if (r.valido) expect(Object.keys(r.valor)).toEqual(["identificador"]);
  });

  it.each([
    ["null", null],
    ["array", [{ identificador: "u@c.local" }]],
    ["string", "u@c.local"],
    ["campo ausente", {}],
    ["tipo errado", { identificador: 1 }],
    ["vazio", { identificador: "" }],
    ["só espaços", { identificador: "   " }],
    ["acima do teto", { identificador: `${"a".repeat(MAXIMO_IDENTIFICADOR + 1)}` }],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoIniciarRecuperacao(corpo).valido).toBe(false);
  });

  it("aceita exatamente o teto", () => {
    expect(
      validarCorpoIniciarRecuperacao({ identificador: "a".repeat(MAXIMO_IDENTIFICADOR) }).valido,
    ).toBe(true);
  });
});

describe("validarCorpoConcluirRecuperacao", () => {
  it("aceita segredo e nova senha não vazios, sem normalizar a senha", () => {
    const r = validarCorpoConcluirRecuperacao({ segredo: "x", novaSenha: "  nova  " });
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.valor).toEqual({ segredo: "x", novaSenha: "  nova  " });
  });

  it("NÃO valida a FORMA do segredo — isso é tentativa, contabilizada e recusada adiante", () => {
    // Um segredo de forma errada precisa chegar ao serviço para ser contado
    // pelo limitador; a fronteira só impõe teto de recurso.
    expect(validarCorpoConcluirRecuperacao({ segredo: "abc", novaSenha: "s" }).valido).toBe(true);
  });

  it.each([
    ["null", null],
    ["array", []],
    ["segredo ausente", { novaSenha: "s" }],
    ["senha ausente", { segredo: "s" }],
    ["tipos errados", { segredo: 1, novaSenha: 2 }],
    ["segredo vazio", { segredo: "", novaSenha: "s" }],
    ["senha vazia", { segredo: "s", novaSenha: "" }],
    ["segredo acima do teto", { segredo: "a".repeat(MAXIMO_SEGREDO_RECUPERACAO + 1), novaSenha: "s" }],
    ["senha acima do teto", { segredo: "s", novaSenha: "a".repeat(MAXIMO_SENHA + 1) }],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoConcluirRecuperacao(corpo).valido).toBe(false);
  });

  it("os códigos de erro da fatia são exatamente dois, estáveis", () => {
    expect(ERRO_RECUPERACAO).toEqual({
      ALVO_NAO_ELEGIVEL: "ALVO_NAO_ELEGIVEL",
      RECUPERACAO_INVALIDA: "RECUPERACAO_INVALIDA",
    });
    expect(Object.isFrozen(ERRO_RECUPERACAO)).toBe(true);
  });
});

describe("RecuperacaoSenhaModule — fronteira", () => {
  it("importa EXCLUSIVAMENTE AuthzModule e AuditModule", () => {
    const imports: unknown = Reflect.getMetadata("imports", RecuperacaoSenhaModule);
    expect(imports ?? []).toEqual([AuthzModule, AuditModule]);
  });

  it("declara EXCLUSIVAMENTE o RecuperacaoSenhaController", () => {
    const controllers: unknown = Reflect.getMetadata("controllers", RecuperacaoSenhaModule);
    expect(controllers ?? []).toEqual([RecuperacaoSenhaController]);
  });

  it("não exporta nada — nenhum módulo consome a recuperação de senha", () => {
    const exports: unknown = Reflect.getMetadata("exports", RecuperacaoSenhaModule);
    expect(exports ?? []).toEqual([]);
  });

  it("a rota de início declara a permissão homologada `senha.recuperar_terceiro` no handler", () => {
    const permissao: unknown = Reflect.getMetadata(
      "tlf:permissao_exigida",
      RecuperacaoSenhaController.prototype.iniciar,
    );
    expect(permissao).toBe("senha.recuperar_terceiro");
  });

  it("a rota de conclusão NÃO exige permissão nem sessão (recuperar a própria senha — todos os papéis)", () => {
    const permissao: unknown = Reflect.getMetadata(
      "tlf:permissao_exigida",
      RecuperacaoSenhaController.prototype.concluir,
    );
    expect(permissao).toBeUndefined();
    const guards: unknown = Reflect.getMetadata(
      "__guards__",
      RecuperacaoSenhaController.prototype.concluir,
    );
    expect(guards).toBeUndefined();
  });
});
