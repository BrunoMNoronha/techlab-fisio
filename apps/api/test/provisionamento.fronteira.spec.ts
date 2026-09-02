// TechLab Fisio — Etapa 2.3D-B / F5 — a fronteira do provisionamento.
//
// `D-2.3D-10` exige bootstrap MANUAL. "Manual" não é promessa de comentário:
// é propriedade estrutural, medida aqui.
//
// REFORÇOS DESTA RODADA (achado `5.4` da revisão independente):
//   - a varredura cobre TODAS as extensões relevantes de `src/` (`.ts`,
//     `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`), não apenas `.ts`;
//   - o acoplamento é medido por FECHO TRANSITIVO de imports a partir de
//     `main.ts`/`app.module.ts` — um import INDIRETO do provisionamento
//     falharia aqui, e não passaria por um regex de primeiro nível;
//   - o ARTEFATO COMPILADO (`dist/`) é inspecionado quando existe, porque é
//     ele que roda em produção;
//   - contratos de CONJUNTO são comparados como conjunto, sem impor ordem.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { AuditModule } from "../src/audit/audit.module.js";
import { DatabaseModule } from "../src/database/database.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import { BootstrapAdministradorService } from "../src/provisionamento/bootstrap-administrador.service.js";
import { BootstrapModule } from "../src/provisionamento/bootstrap.module.js";
import { SeedModule } from "../src/provisionamento/seed.module.js";
import { SeedRbacService } from "../src/provisionamento/seed-rbac.service.js";

const diretorioTeste = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_API = path.resolve(diretorioTeste, "..");
const RAIZ_SRC = path.join(RAIZ_API, "src");
const RAIZ_DIST = path.join(RAIZ_API, "dist");

const EXTENSOES = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

function arquivosDeCodigo(diretorio: string): readonly string[] {
  if (!existsSync(diretorio)) return [];
  return readdirSync(diretorio).flatMap((entrada) => {
    const completo = path.join(diretorio, entrada);
    if (statSync(completo).isDirectory()) return arquivosDeCodigo(completo);
    return EXTENSOES.includes(path.extname(completo)) ? [completo] : [];
  });
}

const ARQUIVOS_SRC = arquivosDeCodigo(RAIZ_SRC);

function relativoA(raiz: string, arquivo: string): string {
  return path.relative(raiz, arquivo).split(path.sep).join("/");
}

const relativo = (arquivo: string): string => relativoA(RAIZ_SRC, arquivo);

/** Especificadores relativos importados/reexportados por um arquivo. */
function importesDe(arquivo: string): readonly string[] {
  const conteudo = readFileSync(arquivo, "utf8");
  const especificadores: string[] = [];
  const padroes = [
    /\bfrom\s+"([^"]+)"/g, // import ... from "x" / export ... from "x"
    /\bimport\s*\(\s*"([^"]+)"\s*\)/g, // import("x") dinâmico
    /\brequire\s*\(\s*"([^"]+)"\s*\)/g,
  ];
  for (const padrao of padroes) {
    for (const casamento of conteudo.matchAll(padrao)) {
      especificadores.push(String(casamento[1]));
    }
  }
  return especificadores;
}

/**
 * Fecho transitivo de arquivos alcançáveis a partir das raízes, seguindo
 * apenas especificadores RELATIVOS (os pacotes externos não podem alcançar
 * `src/`). Detecta acoplamento INDIRETO, que um regex de um nível não vê.
 */
function alcancaveisDe(raizes: readonly string[]): ReadonlySet<string> {
  const vistos = new Set<string>();
  const fila = [...raizes];
  while (fila.length > 0) {
    const atual = fila.pop();
    if (atual === undefined || vistos.has(atual)) continue;
    if (!existsSync(atual)) continue;
    vistos.add(atual);
    for (const especificador of importesDe(atual)) {
      if (!especificador.startsWith(".")) continue;
      const semExtensao = especificador.replace(/\.js$/, "");
      const base = path.resolve(path.dirname(atual), semExtensao);
      for (const extensao of EXTENSOES) {
        const candidato = `${base}${extensao}`;
        if (existsSync(candidato)) {
          fila.push(candidato);
          break;
        }
      }
    }
  }
  return vistos;
}

describe("`D-2.3D-10` — o bootstrap é MANUAL: o `AppModule` não o alcança", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({} as unknown as DatabaseService)
      .compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("o `AppModule` NÃO resolve `SeedRbacService`", () => {
    expect(() => moduleRef.get(SeedRbacService, { strict: false })).toThrow();
  });

  it("o `AppModule` NÃO resolve `BootstrapAdministradorService`", () => {
    expect(() =>
      moduleRef.get(BootstrapAdministradorService, { strict: false }),
    ).toThrow();
  });

  it("controle positivo — o grafo montado é o real e resolve o que deve", () => {
    expect(moduleRef.get(AuditModule, { strict: false })).toBeInstanceOf(AuditModule);
  });
});

describe("contextos mínimos — seed e bootstrap são independentes", () => {
  it("`SeedModule` resolve o seed e importa SOMENTE `DatabaseModule`", async () => {
    const ref = await Test.createTestingModule({ imports: [SeedModule] })
      .overrideProvider(DatabaseService)
      .useValue({} as unknown as DatabaseService)
      .compile();
    expect(ref.get(SeedRbacService)).toBeInstanceOf(SeedRbacService);
    const importados: unknown[] =
      (Reflect.getMetadata("imports", SeedModule) as unknown[]) ?? [];
    expect(importados).toEqual([DatabaseModule]);
    await ref.close();
  });

  it("`SeedModule` NÃO alcança o `CredencialService` — `seed` não depende de Argon2", () => {
    // Propriedade decisiva: é ela que mantém `seed` utilizável em máquina
    // onde o addon nativo do Argon2 não carregue.
    const alcancaveis = alcancaveisDe([path.join(RAIZ_SRC, "provisionamento", "seed.module.ts")]);
    const relativos = [...alcancaveis].map(relativo);
    expect(relativos).not.toContain("auth/credencial.service.ts");
    expect(relativos.filter((a) => a.startsWith("auth/"))).toEqual([]);
  });

  it("`BootstrapModule` importa `DatabaseModule` e `AuditModule` — como conjunto", () => {
    const importados: unknown[] =
      (Reflect.getMetadata("imports", BootstrapModule) as unknown[]) ?? [];
    // Contrato de CONJUNTO: a ordem dos imports é irrelevante.
    expect(new Set(importados)).toEqual(new Set([DatabaseModule, AuditModule]));
  });

  it("nenhum dos dois módulos publica controller", () => {
    for (const modulo of [SeedModule, BootstrapModule]) {
      const controllers: unknown[] =
        (Reflect.getMetadata("controllers", modulo) as unknown[]) ?? [];
      expect(controllers).toEqual([]);
    }
  });
});

describe("acoplamento — o provisionamento não vaza para a aplicação", () => {
  it("o fecho TRANSITIVO de `main.ts` e `app.module.ts` não alcança a fatia", () => {
    // Mais forte que um regex de primeiro nível: um import indireto, por
    // qualquer profundidade de cadeia, apareceria aqui.
    const alcancaveis = alcancaveisDe([
      path.join(RAIZ_SRC, "main.ts"),
      path.join(RAIZ_SRC, "app.module.ts"),
    ]);
    const daFatia = [...alcancaveis]
      .map(relativo)
      .filter((a) => a.startsWith("provisionamento/"));
    expect(daFatia).toEqual([]);
  });

  it("o fecho transitivo da aplicação é não vazio — controle contra tautologia", () => {
    const alcancaveis = alcancaveisDe([path.join(RAIZ_SRC, "main.ts")]);
    expect(alcancaveis.size).toBeGreaterThan(15);
    expect([...alcancaveis].map(relativo)).toContain("app.module.ts");
  });

  it("nenhum arquivo fora da fatia importa a fatia", () => {
    const infratores = ARQUIVOS_SRC.filter((arquivo) => {
      if (relativo(arquivo).startsWith("provisionamento/")) return false;
      return importesDe(arquivo).some((e) => e.includes("provisionamento/"));
    }).map(relativo);
    expect(infratores).toEqual([]);
  });

  it("o CLI não é importado por arquivo algum — é ponto de entrada", () => {
    const infratores = ARQUIVOS_SRC.filter((arquivo) =>
      importesDe(arquivo).some((e) => /(^|\/)cli(\.js)?$/.test(e)),
    ).map(relativo);
    expect(infratores).toEqual([]);
  });

  it("a varredura de `src/` não é vazia — controle contra tautologia", () => {
    expect(ARQUIVOS_SRC.length).toBeGreaterThan(20);
    expect(
      ARQUIVOS_SRC.map(relativo).filter((a) => a.startsWith("provisionamento/")),
    ).toHaveLength(7);
  });
});

describe("artefato COMPILADO — o que de fato roda", () => {
  const distExiste = existsSync(path.join(RAIZ_DIST, "main.js"));
  const talvez = distExiste ? it : it.skip;

  talvez("o fecho transitivo de `dist/main.js` não alcança o provisionamento", () => {
    const alcancaveis = alcancaveisDe([path.join(RAIZ_DIST, "main.js")]);
    const daFatia = [...alcancaveis]
      .map((a) => relativoA(RAIZ_DIST, a))
      .filter((a) => a.startsWith("provisionamento/"));
    expect(daFatia).toEqual([]);
  });

  talvez("o CLI compilado NÃO importa estaticamente o módulo do bootstrap", () => {
    // Se voltasse a ser estático, `seed` quebraria onde o Argon2 não carrega.
    const cli = readFileSync(path.join(RAIZ_DIST, "provisionamento", "cli.js"), "utf8");
    expect(/^\s*import[^\n]*bootstrap\.module/m.test(cli)).toBe(false);
    expect(cli).toContain("import(");
  });

  talvez("o seed compilado não alcança o `CredencialService`", () => {
    const alcancaveis = alcancaveisDe([
      path.join(RAIZ_DIST, "provisionamento", "seed.module.js"),
    ]);
    expect(
      [...alcancaveis].map((a) => relativoA(RAIZ_DIST, a)).filter((a) => a.startsWith("auth/")),
    ).toEqual([]);
  });
});

describe("segredo nunca versionado — TLF-BASE-V1 §14, `D-2.3D-10`", () => {
  const daFatia = ARQUIVOS_SRC.filter((arquivo) =>
    relativo(arquivo).startsWith("provisionamento/"),
  );

  it("`process.argv` é lido em UM único arquivo e nunca alimenta credencial", () => {
    const comArgv = daFatia
      .filter((arquivo) => readFileSync(arquivo, "utf8").includes("process.argv"))
      .map(relativo);
    expect(comArgv).toEqual(["provisionamento/cli.ts"]);
    const cli = readFileSync(path.join(RAIZ_SRC, "provisionamento", "cli.ts"), "utf8");
    // O resultado do parsing é um par fechado; nenhum campo de credencial.
    expect(cli).toContain("analisarArgumentos");
    for (const proibido of ["senha", "password", "justificativa"]) {
      expect(new RegExp(`argv[^\\n]*${proibido}`, "i").test(cli)).toBe(false);
    }
  });

  it("nenhum arquivo da fatia contém senha embutida ou valor padrão", () => {
    for (const arquivo of daFatia) {
      const conteudo = readFileSync(arquivo, "utf8");
      expect(/senha\s*[:=]\s*"[^"]+"/i.test(conteudo)).toBe(false);
      expect(/password\s*[:=]\s*"[^"]+"/i.test(conteudo)).toBe(false);
      expect(/(\?\?|\|\|)\s*"[^"]*senha[^"]*"/i.test(conteudo)).toBe(false);
    }
  });

  it("nenhum arquivo da fatia escreve em `console` ou em logger externo", () => {
    for (const arquivo of daFatia) {
      const conteudo = readFileSync(arquivo, "utf8");
      expect(/\bconsole\s*\./.test(conteudo)).toBe(false);
      // Logger do Nest e qualquer logger de terceiro também estão fora.
      expect(/\bnew\s+Logger\b/.test(conteudo)).toBe(false);
      expect(/@nestjs\/common['"][^\n]*Logger/.test(conteudo)).toBe(false);
    }
  });

  it("os SERVIÇOS não imprimem nada — é neles que a senha em claro transita", () => {
    for (const arquivo of [
      "seed-rbac.service.ts",
      "bootstrap-administrador.service.ts",
      "bloqueio-provisionamento.ts",
    ]) {
      const conteudo = readFileSync(path.join(RAIZ_SRC, "provisionamento", arquivo), "utf8");
      expect(/process\.std(out|err)/.test(conteudo)).toBe(false);
    }
  });

  it("o CLI nunca ecoa `message`, `stack` ou `code` de exceção", () => {
    const cli = readFileSync(path.join(RAIZ_SRC, "provisionamento", "cli.ts"), "utf8");
    // A saída é construída a partir do `motivo` de conjunto fechado.
    expect(/causa[^\n]*\.message/.test(cli)).toBe(false);
    expect(/causa[^\n]*\.stack/.test(cli)).toBe(false);
    expect(cli).toContain("FALHA_INESPERADA");
    expect(cli).toContain("incidente");
  });

  it("a justificativa nunca é impressa", () => {
    const cli = readFileSync(path.join(RAIZ_SRC, "provisionamento", "cli.ts"), "utf8");
    const linhasDeSaida = cli
      .split("\n")
      .filter((l) => /imprimir\(|process\.std(out|err)\.write/.test(l));
    for (const linha of linhasDeSaida) {
      expect(/justificativa/i.test(linha)).toBe(false);
    }
  });
});
