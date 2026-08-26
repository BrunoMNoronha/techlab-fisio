// TechLab Fisio — E-16 — GUARDA 1: lint de migrations (docs/08 §9.3).
//
// Varre TODAS as migrations versionadas e FALHA quando uma migration posterior
// à criação de um objeto protegido contém uma operação de remoção homologada
// como perigosa — exatamente a disciplina de §9.3:
//
//   DROP INDEX · DROP CONSTRAINT · DROP TRIGGER · DROP EXTENSION
//
// contra qualquer nome da lista única de objetos protegidos
// (packages/database/protected-objects.json — fonte compartilhada com a
// Guarda 2 e com scripts/verify-from-scratch.mjs; nenhum objeto pode
// desaparecer da lista por esquecimento porque a lista é uma só).
//
// EXCEÇÕES admitidas (fail-closed):
//   1. a própria migration de ORIGEM do objeto (padrão legítimo de
//      drop-and-recreate dentro da migration que o cria);
//   2. anotação `-- INTENCIONAL: <justificativa não vazia>` no bloco de
//      comentários imediatamente acima da linha do DROP — revisável no diff.
//
// DECISÕES DE ROBUSTEZ (contra falso negativo óbvio):
//   - comentários `--` e `/* */` são removidos ANTES da varredura: um DROP
//     dentro de comentário não dispara, e um DROP real não se esconde atrás
//     de um comentário na mesma linha;
//   - strings e corpos dollar-quoted NÃO são removidos: um DROP dentro de
//     `EXECUTE '...'`/`$$...$$` pode ser SQL dinâmico real — fail closed, e a
//     exceção INTENCIONAL resolve o falso positivo legítimo;
//   - identificadores são normalizados (aspas duplas removidas, qualificação
//     de schema descartada, caixa ignorada em palavra-chave; identificadores
//     do projeto são minúsculos por convenção);
//   - um DROP das quatro classes cujo identificador não puder ser extraído
//     também FALHA (fail closed — nunca "não entendi, deixa passar").
//
// FORA DO ESCOPO DESTA GUARDA (coberto pelas Guardas 2 e 3):
//   - `DROP FUNCTION`/`DROP TABLE`/`DROP COLUMN` (a expressão da coluna gerada
//     e as funções de trigger são provadas por existência+efeito na Guarda 2 e
//     pelo golden na Guarda 3 — §9.3 homologa exatamente as quatro operações
//     acima para o lint).
//
// Esta guarda NUNCA executa SQL: análise exclusivamente de arquivos.
//
// Uso:
//   node scripts/lint-migrations.mjs             # migrations versionadas
//   node scripts/lint-migrations.mjs --dir <p>   # diretório alternativo
//                                                # (usado pelo teste negativo)

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function carregarObjetosProtegidos() {
  const bruto = readFileSync(
    path.join(raizRepo, "packages", "database", "protected-objects.json"),
    "utf8",
  );
  const inv = JSON.parse(bruto);
  // nome normalizado -> { tipoEsperado, origem }
  const porNome = new Map();
  const registrar = (nome, classe, origem) => {
    porNome.set(nome.toLowerCase(), { classe, origem });
  };
  registrar(inv.extensao.nome, "EXTENSION", inv.extensao.origem);
  for (const o of inv.exclusionConstraints) registrar(o.nome, "CONSTRAINT", o.origem);
  for (const o of inv.checkConstraints) registrar(o.nome, "CONSTRAINT", o.origem);
  for (const o of [...inv.indicesParciaisUnicos, ...inv.indicesParciaisSimples]) {
    registrar(o.nome, "INDEX", o.origem);
  }
  for (const o of inv.triggers) registrar(o.nome, "TRIGGER", o.origem);
  return porNome;
}

/**
 * Remove comentários `--` e `/* *​/` preservando o número de linhas e
 * devolvendo também as linhas ORIGINAIS (para localizar anotações
 * INTENCIONAL). Strings e dollar-quotes são mantidos no texto varrido
 * (fail closed — ver cabeçalho).
 */
function separarCodigoEComentarios(sql) {
  const linhasOriginais = sql.split("\n");
  let codigo = "";
  let emBloco = false;
  for (let i = 0; i < sql.length; i += 1) {
    const dupla = sql.slice(i, i + 2);
    if (emBloco) {
      if (dupla === "*/") {
        emBloco = false;
        i += 1;
      } else if (sql[i] === "\n") {
        codigo += "\n";
      }
      continue;
    }
    if (dupla === "/*") {
      emBloco = true;
      i += 1;
      continue;
    }
    if (dupla === "--") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      codigo += "\n";
      continue;
    }
    codigo += sql[i];
  }
  return { codigo, linhasOriginais };
}

const RE_INTENCIONAL = /^\s*--\s*INTENCIONAL:\s*(\S.*)$/;

/** A linha do DROP é precedida (bloco contíguo de comentários/vazias) por `-- INTENCIONAL: ...`? */
function temAnotacaoIntencional(linhasOriginais, linhaDrop) {
  for (let i = linhaDrop - 2; i >= 0; i -= 1) {
    const linha = linhasOriginais[i] ?? "";
    if (linha.trim() === "") continue;
    if (!linha.trimStart().startsWith("--")) return false;
    if (RE_INTENCIONAL.test(linha)) return true;
  }
  return false;
}

function normalizarIdentificador(bruto) {
  const semEspacos = bruto.trim();
  // descarta qualificação de schema; remove aspas duplas de cada segmento
  const segmentos = [];
  let atual = "";
  let emAspas = false;
  for (const ch of semEspacos) {
    if (ch === '"') {
      emAspas = !emAspas;
      continue;
    }
    if (ch === "." && !emAspas) {
      segmentos.push(atual);
      atual = "";
      continue;
    }
    atual += ch;
  }
  segmentos.push(atual);
  const ultimo = segmentos[segmentos.length - 1] ?? "";
  return ultimo.toLowerCase();
}

const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?`;

const PADROES = [
  {
    operacao: "DROP INDEX",
    // DROP INDEX [CONCURRENTLY] [IF EXISTS] nome [, nome...]
    re: new RegExp(
      String.raw`\bDROP\s+INDEX\b(\s+CONCURRENTLY)?(\s+IF\s+EXISTS)?\s+(${IDENT}(?:\s*,\s*${IDENT})*)`,
      "gi",
    ),
    grupoLista: 3,
  },
  {
    operacao: "DROP CONSTRAINT",
    // ALTER TABLE ... DROP CONSTRAINT [IF EXISTS] nome
    re: new RegExp(String.raw`\bDROP\s+CONSTRAINT\b(\s+IF\s+EXISTS)?\s+(${IDENT})`, "gi"),
    grupoLista: 2,
  },
  {
    operacao: "DROP TRIGGER",
    // DROP TRIGGER [IF EXISTS] nome ON tabela
    re: new RegExp(String.raw`\bDROP\s+TRIGGER\b(\s+IF\s+EXISTS)?\s+(${IDENT})`, "gi"),
    grupoLista: 2,
  },
  {
    operacao: "DROP EXTENSION",
    // DROP EXTENSION [IF EXISTS] nome [, nome...]
    re: new RegExp(
      String.raw`\bDROP\s+EXTENSION\b(\s+IF\s+EXISTS)?\s+(${IDENT}(?:\s*,\s*${IDENT})*)`,
      "gi",
    ),
    grupoLista: 2,
  },
];

// Detector fail-closed: qualquer DROP das quatro classes, mesmo que os padrões
// acima não consigam extrair o identificador (sintaxe inesperada => falha).
const RE_DROP_BRUTO = /\bDROP\s+(INDEX|CONSTRAINT|TRIGGER|EXTENSION)\b/gi;

function linhaDoIndice(texto, indice) {
  let linha = 1;
  for (let i = 0; i < indice; i += 1) {
    if (texto[i] === "\n") linha += 1;
  }
  return linha;
}

function lintarMigration(nomeMigration, sql, protegidos) {
  const violacoes = [];
  const { codigo, linhasOriginais } = separarCodigoEComentarios(sql);

  const indicesCobertos = new Set();
  for (const padrao of PADROES) {
    padrao.re.lastIndex = 0;
    for (let m = padrao.re.exec(codigo); m !== null; m = padrao.re.exec(codigo)) {
      indicesCobertos.add(m.index);
      const lista = m[padrao.grupoLista] ?? "";
      const linha = linhaDoIndice(codigo, m.index);
      for (const brutoNome of lista.split(",")) {
        const nome = normalizarIdentificador(brutoNome);
        const protegido = protegidos.get(nome);
        if (!protegido) continue;
        if (nomeMigration === protegido.origem) continue; // migration de origem
        if (temAnotacaoIntencional(linhasOriginais, linha)) {
          console.log(
            `[guarda-1] exceção INTENCIONAL aceita: ${nomeMigration} linha ${linha} — ` +
              `${padrao.operacao} ${nome}`,
          );
          continue;
        }
        violacoes.push({
          migration: nomeMigration,
          linha,
          operacao: padrao.operacao,
          objeto: nome,
        });
      }
    }
  }

  // Fail closed: DROP das quatro classes sem identificador extraível.
  RE_DROP_BRUTO.lastIndex = 0;
  for (let m = RE_DROP_BRUTO.exec(codigo); m !== null; m = RE_DROP_BRUTO.exec(codigo)) {
    if (indicesCobertos.has(m.index)) continue;
    const linha = linhaDoIndice(codigo, m.index);
    violacoes.push({
      migration: nomeMigration,
      linha,
      operacao: `DROP ${m[1].toUpperCase()}`,
      objeto: "<identificador não extraível — fail closed>",
    });
  }

  return violacoes;
}

function main() {
  const args = process.argv.slice(2);
  let dirMigrations = path.join(raizRepo, "packages", "database", "prisma", "migrations");
  const flagDir = args.indexOf("--dir");
  if (flagDir !== -1) {
    const valor = args[flagDir + 1];
    if (!valor) {
      console.error("[guarda-1] uso: lint-migrations.mjs [--dir <diretório de migrations>]");
      process.exit(2);
    }
    dirMigrations = path.resolve(valor);
  }

  const protegidos = carregarObjetosProtegidos();
  const migrations = readdirSync(dirMigrations, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (migrations.length === 0) {
    console.error(`[guarda-1] nenhuma migration encontrada em ${dirMigrations}`);
    process.exit(2);
  }

  const violacoes = [];
  for (const nome of migrations) {
    const sql = readFileSync(path.join(dirMigrations, nome, "migration.sql"), "utf8");
    violacoes.push(...lintarMigration(nome, sql, protegidos));
  }

  console.log(
    `[guarda-1] ${migrations.length} migration(s) varrida(s) · ` +
      `${protegidos.size} objeto(s) protegido(s) na lista única.`,
  );
  if (violacoes.length > 0) {
    console.error("[guarda-1] FALHA — remoção de objeto protegido sem anotação INTENCIONAL:");
    for (const v of violacoes) {
      console.error(
        `  - migration ${v.migration}, linha ${v.linha}: ${v.operacao} sobre "${v.objeto}"`,
      );
    }
    console.error(
      "[guarda-1] Se a remoção é deliberada, anote `-- INTENCIONAL: <justificativa>` " +
        "no bloco de comentários imediatamente acima do DROP e submeta à revisão.",
    );
    process.exit(1);
  }
  console.log("[guarda-1] OK — nenhuma remoção de objeto protegido detectada.");
}

main();
