// TechLab Fisio — E-15 — Reconstrução a partir de banco vazio
// (docs/08 §13 `E-15`; política de migrations §10, ponto 7).
//
// PROVA CENTRAL: uma instância PostgreSQL 18 LIMPA (container + volume novos,
// initdb do zero) é reconstruída EXCLUSIVAMENTE por:
//
//   1. bootstrap versionado de roles/bancos (infra/postgres/initdb/01-roles.sh,
//      executado pelo entrypoint da imagem oficial — mesmo bootstrap do
//      desenvolvimento e do CI; nenhum passo manual);
//   2. `prisma migrate deploy` — replay integral do histórico versionado,
//      inclusive `CREATE EXTENSION btree_gist` (nenhuma criação manual);
//   3. verificações de catálogo dos objetos das Categorias B e C, cuja lista
//      vem da FONTE ÚNICA `packages/database/protected-objects.json`
//      (compartilhada com as Guardas 1 e 2 da E-16) — a Categoria A é
//      exercitada pela própria suíte;
//   4. suíte integral de integração (Jest 30 + ESM + Prisma Client 7 +
//      adapter-pg) apontada para a instância reconstruída — o globalSetup da
//      E-13 cria seu banco descartável DENTRO dela e replica o histórico de
//      novo, sem nenhuma modificação da infraestrutura de testes;
//   5. limpeza: container e volume descartáveis destruídos SEMPRE (finally),
//      inclusive em falha.
//
// PROIBIDO e AUSENTE por construção: `db push`, `db pull`, `migrate reset`,
// SQL ad hoc pós-deploy, criação manual de constraint/índice/trigger/função/
// extensão, edição de migration, dependência do volume de desenvolvimento.
//
// ISOLAMENTO FAIL-CLOSED (mecânica compartilhada em
// scripts/lib/instancia-descartavel.mjs — extraída na E-16 SEM alteração de
// comportamento):
//   - container `techlab-fisio-e15-<sufixo>` e volume homônimo `-data`,
//     porta efêmera em 127.0.0.1 atribuída pelo Docker — nunca a instância
//     de desenvolvimento; o script só destrói recursos com esse prefixo;
//   - nenhuma senha e nenhuma URL completa é impressa (somente roles, banco,
//     host/porta e nomes de recursos);
//   - a suíte herda as guardas da E-13 (prefixo `techlab_fisio_it_`).

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  comCliente,
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  imagemDoCompose,
  migrateDeploy,
  provarBancoVazio,
  removerOrfaos,
} from "./lib/instancia-descartavel.mjs";

const PREFIXO_E15 = "techlab-fisio-e15-";
const ROTULO = "[e15]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

// ---------------------------------------------------------------------------
// Objetos das Categorias B e C — FONTE ÚNICA compartilhada com as Guardas 1 e
// 2 da E-16 (nomes determinísticos de C-6; docs/08 REV. 8, 9 e 10).
// ---------------------------------------------------------------------------
const inventario = JSON.parse(
  readFileSync(path.join(raizRepo, "packages", "database", "protected-objects.json"), "utf8"),
);
const EXTENSAO = inventario.extensao.nome;
const EXCLUSIONS = inventario.exclusionConstraints.map((o) => o.nome);
const INDICES_PARCIAIS_UNICOS = inventario.indicesParciaisUnicos.map((o) => o.nome);
const INDICES_PARCIAIS_SIMPLES = inventario.indicesParciaisSimples.map((o) => o.nome);
const CHECKS = inventario.checkConstraints.map((o) => o.nome);
const TRIGGERS = inventario.triggers;
const FUNCOES = inventario.funcoes.map((o) => o.nome);
const TABELAS_APPEND_ONLY = inventario.tabelasAppendOnly.map((o) => o.tabela);

function contarMigrationsVersionadas() {
  const dir = path.join(raizRepo, "packages", "database", "prisma", "migrations");
  const entradas = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const e of entradas) {
    readFileSync(path.join(dir, e.name, "migration.sql"), "utf8"); // deve existir
  }
  if (entradas.length === 0) falhar("nenhuma migration versionada encontrada");
  return entradas.length;
}

async function main() {
  // `.env` local (dev) ou copiado de `.env.example` (CI). dotenv nunca
  // sobrescreve variável já definida no ambiente.
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });

  const cred = credenciaisDoAmbiente();
  const totalMigrations = contarMigrationsVersionadas();
  console.log(`${ROTULO} imagem: ${imagemDoCompose(raizRepo)} · migrations versionadas: ${totalMigrations}`);
  removerOrfaos(PREFIXO_E15, ROTULO);

  let instancia = null;
  try {
    // -----------------------------------------------------------------------
    // 1. Instância LIMPA: container + volume novos; initdb roda do zero.
    // -----------------------------------------------------------------------
    instancia = await criarInstanciaLimpa({
      raizRepo,
      prefixo: PREFIXO_E15,
      rotulo: ROTULO,
      cred,
    });

    // -----------------------------------------------------------------------
    // 2. Prova de banco realmente VAZIO antes do deploy.
    // -----------------------------------------------------------------------
    await provarBancoVazio(instancia.conexaoMigrador, cred.bancoApp, ROTULO);

    // -----------------------------------------------------------------------
    // 3. Reconstrução: APENAS `prisma migrate deploy` (histórico versionado).
    // -----------------------------------------------------------------------
    migrateDeploy(raizRepo, instancia.urlMigrador, cred.roleMigrador, ROTULO);

    // -----------------------------------------------------------------------
    // 4. Verificações de catálogo — todas as migrations aplicadas e todos os
    //    objetos das Categorias B/C presentes, sem qualquer intervenção.
    // -----------------------------------------------------------------------
    await comCliente(instancia.conexaoMigrador, async (c) => {
      const m = await c.query(`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE finished_at IS NULL)::int AS pendentes
        FROM "_prisma_migrations"
      `);
      if (m.rows[0].total !== totalMigrations || m.rows[0].pendentes !== 0) {
        falhar(
          `histórico incompleto: aplicadas ${m.rows[0].total}/${totalMigrations}, ` +
          `pendentes ${m.rows[0].pendentes}`,
        );
      }
      console.log(`${ROTULO} ${m.rows[0].total}/${totalMigrations} migrations aplicadas, 0 pendentes.`);

      const ext = await c.query("SELECT 1 FROM pg_extension WHERE extname = $1", [EXTENSAO]);
      if (ext.rowCount !== 1) falhar(`extensão ausente: ${EXTENSAO}`);

      const excl = await c.query(
        "SELECT conname FROM pg_constraint WHERE contype = 'x' AND conname = ANY($1)",
        [EXCLUSIONS],
      );
      if (excl.rowCount !== EXCLUSIONS.length) {
        falhar(`exclusion constraints ausentes: esperadas ${EXCLUSIONS.join(", ")}`);
      }

      const idx = await c.query(
        `SELECT i.indexrelid::regclass::text AS nome, i.indisunique
         FROM pg_index i
         WHERE i.indpred IS NOT NULL
           AND i.indexrelid::regclass::text = ANY($1)`,
        [[...INDICES_PARCIAIS_UNICOS, ...INDICES_PARCIAIS_SIMPLES]],
      );
      const porNome = new Map(idx.rows.map((r) => [r.nome, r.indisunique]));
      for (const nome of INDICES_PARCIAIS_UNICOS) {
        if (porNome.get(nome) !== true) falhar(`índice único parcial ausente/errado: ${nome}`);
      }
      for (const nome of INDICES_PARCIAIS_SIMPLES) {
        if (porNome.get(nome) !== false) falhar(`índice parcial ausente/errado: ${nome}`);
      }

      const cks = await c.query(
        "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname = ANY($1)",
        [CHECKS],
      );
      if (cks.rowCount !== CHECKS.length) {
        const presentes = new Set(cks.rows.map((r) => r.conname));
        falhar(`CHECKs ausentes: ${CHECKS.filter((n) => !presentes.has(n)).join(", ")}`);
      }

      for (const t of TRIGGERS) {
        const trg = await c.query(
          `SELECT 1 FROM pg_trigger WHERE tgname = $1 AND tgrelid = $2::regclass`,
          [t.nome, t.tabela],
        );
        if (trg.rowCount !== 1) falhar(`trigger ausente: ${t.nome} em ${t.tabela}`);
      }
      const fns = await c.query(
        "SELECT proname FROM pg_proc WHERE proname = ANY($1)",
        [FUNCOES],
      );
      if (fns.rowCount !== FUNCOES.length) falhar(`funções de trigger ausentes`);

      const gerada = await c.query(`
        SELECT attgenerated FROM pg_attribute
        WHERE attrelid = 'cobranca'::regclass AND attname = 'valor_liquido'
      `);
      if (gerada.rows[0]?.attgenerated !== "s") {
        falhar("cobranca.valor_liquido não é coluna gerada STORED");
      }

      for (const tabela of TABELAS_APPEND_ONLY) {
        const priv = await c.query(
          `SELECT has_table_privilege($1, $2, 'SELECT') AS s,
                  has_table_privilege($1, $2, 'INSERT') AS i,
                  has_table_privilege($1, $2, 'UPDATE') AS u,
                  has_table_privilege($1, $2, 'DELETE') AS d`,
          [cred.roleApp, tabela],
        );
        const p = priv.rows[0];
        if (!(p.s && p.i && !p.u && !p.d)) {
          falhar(`privilégios append-only errados em ${tabela}: ${JSON.stringify(p)}`);
        }
      }
      console.log(
        `${ROTULO} catálogo ok: extensão, ${EXCLUSIONS.length} exclusion, ` +
        `${INDICES_PARCIAIS_UNICOS.length + INDICES_PARCIAIS_SIMPLES.length} índices parciais, ` +
        `${CHECKS.length} CHECKs, ${TRIGGERS.length} triggers + ${FUNCOES.length} funções, ` +
        `coluna gerada, append-only (${TABELAS_APPEND_ONLY.length} tabelas).`,
      );
    });

    // -----------------------------------------------------------------------
    // 5. Nenhuma migration (nem schema) modificada pelo processo.
    // -----------------------------------------------------------------------
    const sujo = spawnSync(
      "git",
      ["status", "--porcelain", "--", "packages/database/prisma"],
      { cwd: raizRepo, encoding: "utf8" },
    );
    if (sujo.status !== 0 || sujo.stdout.trim() !== "") {
      falhar(`packages/database/prisma foi modificado durante a prova:\n${sujo.stdout}`);
    }
    console.log(`${ROTULO} schema.prisma e migrations intactos (git status limpo).`);

    // -----------------------------------------------------------------------
    // 6. Suíte INTEGRAL de integração contra a instância reconstruída.
    //    O globalSetup da E-13 cria o banco descartável `techlab_fisio_it_%`
    //    DENTRO desta instância e replica o histórico novamente — nenhuma
    //    alteração na infraestrutura de testes.
    // -----------------------------------------------------------------------
    console.log(`${ROTULO} executando a suíte integral de integração na instância reconstruída...`);
    const suite = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        path.join(raizRepo, "node_modules", "jest", "bin", "jest.js"),
        "--config", path.join(raizRepo, "packages", "database", "jest.config.mjs"),
      ],
      {
        cwd: raizRepo,
        env: {
          ...process.env,
          DATABASE_URL: instancia.urlApp,
          MIGRATE_DATABASE_URL: instancia.urlMigrador,
        },
        stdio: "inherit",
      },
    );
    if (suite.status !== 0) falhar(`suíte de integração falhou (exit ${suite.status})`);

    // -----------------------------------------------------------------------
    // 7. Zero resíduos dentro da instância (bancos descartáveis da suíte).
    // -----------------------------------------------------------------------
    await comCliente(instancia.conexaoMigrador, async (c) => {
      const resto = await c.query(
        "SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'techlab_fisio_it_%'",
      );
      if (resto.rows[0].n !== 0) {
        falhar(`${resto.rows[0].n} banco(s) descartável(is) da suíte remanescente(s)`);
      }
    });
    console.log(`${ROTULO} 0 bancos techlab_fisio_it_% remanescentes na instância.`);

    console.log(`${ROTULO} PROVA CONCLUÍDA: histórico de migrations é autossuficiente.`);
  } finally {
    // -----------------------------------------------------------------------
    // 8. Limpeza SEMPRE — inclusive em falha.
    // -----------------------------------------------------------------------
    if (instancia !== null) {
      const residuo = destruirInstancia(
        instancia.container, instancia.volume, PREFIXO_E15, ROTULO,
      );
      if (residuo) process.exitCode = 1;
    }
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
