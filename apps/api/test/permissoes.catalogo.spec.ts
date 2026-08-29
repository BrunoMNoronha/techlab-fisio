// TechLab Fisio — Etapa 2.3D-B / F4 — o catálogo tipado É `docs/04` §5.
//
// Esta suíte existe para provar que `permissoes.catalogo.ts` NÃO é um
// catálogo paralelo (`D-2.3D-09`, `docs/12` §5.9: "os identificadores
// técnicos de permissão continuam sendo os nomes funcionais homologados em
// `docs/04` §5"). Em vez de reafirmar a lista à mão — o que só provaria que
// alguém a copiou duas vezes —, ela LÊ o documento homologado, extrai os
// identificadores de §5 e compara com o código.
//
// Consequência mecânica: acrescentar, remover, renomear ou reordenar uma
// permissão no código sem a alteração correspondente e homologada em
// `docs/04` faz esta prova falhar. É a mesma disciplina de anti-drift que o
// golden schema exerce sobre a persistência, aplicada ao catálogo funcional.
//
// Precedente de forma: `supply-chain.spec.ts` já lê arquivos do repositório a
// partir da suíte, pelo mesmo mecanismo.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@jest/globals";

import { ehPermissao, PERMISSOES } from "../src/authz/permissoes.catalogo.js";

const raizRepo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const DOCUMENTO = readFileSync(
  path.join(raizRepo, "docs", "04-perfis-permissoes.md"),
  "utf8",
);

const INICIO_SECAO_5 = "# 5. Catálogo funcional de permissões sensíveis";
const INICIO_SECAO_6 = "# 6. Regras de combinação de papéis";

/**
 * Identificadores declarados em `docs/04` §5, na ordem da fonte.
 *
 * A extração é DELIBERADAMENTE literal: só casa cabeçalho `### ` cujo texto
 * inteiro seja um identificador entre crases. Nenhuma normalização é aplicada
 * — se o documento mudar a forma, esta suíte falha e alguém decide, em vez de
 * o teste adivinhar.
 */
function identificadoresDoDocumento(): readonly string[] {
  const inicio = DOCUMENTO.indexOf(INICIO_SECAO_5);
  const fim = DOCUMENTO.indexOf(INICIO_SECAO_6);
  expect(inicio).toBeGreaterThanOrEqual(0);
  expect(fim).toBeGreaterThan(inicio);
  const secao = DOCUMENTO.slice(inicio, fim);
  return [...secao.matchAll(/^### `([a-z0-9_.]+)`\s*$/gm)].map((casamento) =>
    String(casamento[1]),
  );
}

describe("D-2.3D-09 — o catálogo tipado espelha `docs/04` §5, byte a byte", () => {
  it("a extração do documento encontra permissões — controle de não vacuidade", () => {
    // Sem este controle, um regex quebrado devolveria lista vazia e a
    // comparação abaixo passaria a exigir que o CÓDIGO também fosse vazio,
    // transformando a prova em tautologia silenciosa.
    const doDocumento = identificadoresDoDocumento();
    expect(doDocumento.length).toBeGreaterThan(20);
  });

  it("os identificadores do código são EXATAMENTE os do documento, na mesma ordem", () => {
    expect([...PERMISSOES]).toEqual([...identificadoresDoDocumento()]);
  });

  it("o catálogo não possui duplicatas", () => {
    expect(new Set(PERMISSOES).size).toBe(PERMISSOES.length);
  });

  it("as permissões nominalmente citadas por `D-2.3D-09` estão no catálogo", () => {
    // `docs/12` §5.9 exemplifica seis identificadores. São verificados um a um
    // porque a decisão os cita literalmente.
    for (const permissao of [
      "usuarios.gerenciar",
      "permissoes.gerenciar",
      "sessoes.revogar_terceiro",
      "senha.recuperar_terceiro",
      "clinica.configurar",
      "profissionais.gerenciar",
    ]) {
      expect(ehPermissao(permissao)).toBe(true);
    }
  });
});

describe("`ehPermissao` — conjunto fechado, fail-closed", () => {
  it("aceita todos os identificadores homologados", () => {
    for (const permissao of PERMISSOES) expect(ehPermissao(permissao)).toBe(true);
  });

  it("recusa identificador inventado, com erro de digitação ou de outro sistema", () => {
    for (const invalido of [
      "usuarios.gerenciarr",
      "usuarios.Gerenciar",
      "usuarios.gerenciar ",
      " usuarios.gerenciar",
      "admin",
      "*",
      "usuarios.*",
      "",
    ]) {
      expect(ehPermissao(invalido)).toBe(false);
    }
  });

  it("recusa qualquer valor que não seja string", () => {
    for (const invalido of [null, undefined, 0, 1, true, {}, [], Symbol("x")]) {
      expect(ehPermissao(invalido)).toBe(false);
    }
  });

  it("o array exportado é imutável em tipo e congelado na prática", () => {
    // `as const` garante em compilação; aqui prova-se que nenhuma escrita
    // acidental em runtime altera o catálogo compartilhado.
    expect(Object.isFrozen(PERMISSOES)).toBe(true);
  });
});
