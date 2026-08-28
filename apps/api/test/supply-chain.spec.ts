// TechLab Fisio — Etapa 2.3D-B / F3 — cadeia de dependências da fatia.
//
// Correção `F-11` (revisão independente): `@nestjs/swagger@11.4.7` traz, por
// cadeia TRANSITIVA, um pacote de telemetria de terceiros —
//
//     @nestjs/swagger -> swagger-ui-dist -> @scarf/scarf
//
// cujo `postinstall` faz requisição de rede. Num projeto de saúde sujeito à
// TLF-BASE-V1 §10/§14 isso precisa ser DECLARADO e desligado explicitamente. O
// opt-out suportado pelo próprio pacote é `scarfSettings.enabled = false` no
// `package.json` da raiz do projeto.
//
// Este teste é o detector: se alguém remover o opt-out, ou reativá-lo, a
// suíte falha. Ele não instala, não atualiza e não consulta a rede — lê os
// arquivos versionados.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@jest/globals";

const raizRepo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

function lerJson(...partes: string[]): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(raizRepo, ...partes), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("F-11 — telemetria transitiva do Scarf está desligada", () => {
  it("o package.json da raiz declara scarfSettings.enabled = false", () => {
    const raiz = lerJson("package.json");
    const scarf = raiz["scarfSettings"] as { enabled?: unknown } | undefined;
    expect(scarf).toBeDefined();
    expect(scarf?.enabled).toBe(false);
  });

  it("o opt-out vive na RAIZ do projeto, que é onde o pacote o procura", () => {
    // O `@scarf/scarf` sobe a árvore a partir de si mesmo até achar o
    // `package.json` do projeto; declarar no workspace da API não bastaria.
    const api = lerJson("apps", "api", "package.json");
    expect(api["scarfSettings"]).toBeUndefined();
  });

  it("o lockfile registra a cadeia exata e nenhuma outra fonte de telemetria", () => {
    const lock = lerJson("package-lock.json");
    const pacotes = lock["packages"] as Record<string, { version?: string }>;
    expect(pacotes["node_modules/@nestjs/swagger"]?.version).toBe("11.4.7");
    expect(pacotes["node_modules/swagger-ui-dist"]).toBeDefined();
    expect(pacotes["node_modules/@scarf/scarf"]).toBeDefined();
  });
});

describe("F3 — dependências da fatia permanecem contidas", () => {
  it("`@nestjs/swagger` é dependência SOMENTE do workspace da API", () => {
    const api = lerJson("apps", "api", "package.json");
    const raiz = lerJson("package.json");
    expect(
      (api["dependencies"] as Record<string, string>)["@nestjs/swagger"],
    ).toBe("11.4.7");
    expect((raiz["dependencies"] as unknown) ?? {}).toEqual({});
  });

  it("nenhum framework de validação foi instalado", () => {
    // A validação da F3 é uma função pura explícita; `class-validator` e
    // `class-transformer` são peers OPCIONAIS de `@nestjs/swagger` e ficaram
    // deliberadamente de fora (TLF-BASE-V1 §14).
    const api = lerJson("apps", "api", "package.json");
    const todas = {
      ...(api["dependencies"] as Record<string, string>),
      ...(api["devDependencies"] as Record<string, string>),
    };
    expect(todas["class-validator"]).toBeUndefined();
    expect(todas["class-transformer"]).toBeUndefined();
  });

  it("nenhuma dependência de rate limit externo, cache ou fila entrou", () => {
    const api = lerJson("apps", "api", "package.json");
    const todas = Object.keys({
      ...(api["dependencies"] as Record<string, string>),
      ...(api["devDependencies"] as Record<string, string>),
    });
    for (const proibida of [
      "redis",
      "ioredis",
      "@nestjs/throttler",
      "rate-limiter-flexible",
      "express-rate-limit",
      "cookie-parser",
      "jsonwebtoken",
      "@nestjs/jwt",
      "@nestjs/passport",
    ]) {
      expect(todas).not.toContain(proibida);
    }
  });
});
