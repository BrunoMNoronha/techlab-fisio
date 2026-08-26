// TechLab Fisio — E-13 — globalSetup do Jest (docs/08 §13 `E-13`).
//
// Cria o BANCO DESCARTÁVEL POR EXECUÇÃO:
//
//   1. varre e remove bancos descartáveis órfãos de execuções anteriores;
//   2. cria `techlab_fisio_it_<sufixo>` como `tlf_migrator` (role com CREATEDB);
//   3. replica, no banco novo, o bootstrap de privilégios POR BANCO de
//      `infra/postgres/initdb/01-roles.sh` (GRANT CONNECT/USAGE e
//      ALTER DEFAULT PRIVILEGES) — no compose o initdb só faz isso para o
//      banco de desenvolvimento e o shadow database;
//   4. executa `prisma migrate deploy` como `tlf_migrator` contra o banco novo
//      (replay integral do histórico versionado, incluindo os REVOKEs de E-11);
//   5. publica em `process.env` as URLs que a suíte usará:
//      - DATABASE_URL       -> tlf_app      @ banco descartável (testes);
//      - TLF_IT_MIGRATE_URL -> tlf_migrator @ banco descartável (limpeza);
//      - TLF_IT_DBNAME      -> nome, para o globalTeardown destruir.
//
// POR QUE `.mjs` + driver `pg` direto (fato medido na E-13): o Jest carrega
// globalSetup/globalTeardown FORA do pipeline de transform — o Node os resolve
// nativamente, e o Prisma Client gerado (.ts com especificadores `.js`) não é
// carregável nesse caminho. O `pg` (dependência que o `@prisma/adapter-pg` já
// traz, aqui declarada e pinada na mesma versão) é usado SOMENTE para as
// operações administrativas do banco descartável; os testes continuam usando
// exclusivamente Prisma Client + adapter (helpers/db.ts).
//
// Nenhuma senha é logada: somente nomes de role e de banco aparecem na saída.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

// Mantido em sincronia com PREFIXO_BANCO_DESCARTAVEL de helpers/db.ts
// (este arquivo não pode importar o .ts — ver nota de cabeçalho).
const PREFIXO = "techlab_fisio_it_";

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function urlObrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

function trocarBanco(url, banco) {
  const nova = new URL(url);
  nova.pathname = `/${banco}`;
  return nova.toString();
}

function papel(url) {
  return decodeURIComponent(new URL(url).username);
}

async function comCliente(url, corpo) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return await corpo(cliente);
  } finally {
    await cliente.end();
  }
}

export default async function globalSetup() {
  // `.env` da raiz (dev local). No CI as variáveis podem vir do ambiente;
  // dotenv nunca sobrescreve variável já definida.
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });

  const urlMigradorDev = urlObrigatoria("MIGRATE_DATABASE_URL");
  const urlAppDev = urlObrigatoria("DATABASE_URL");
  const roleMigrador = papel(urlMigradorDev);
  const roleApp = papel(urlAppDev);

  const nome = `${PREFIXO}${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;

  await comCliente(urlMigradorDev, async (admin) => {
    const quemSou = await admin.query("SELECT current_user AS usuario");
    console.log(
      `[e13] bootstrap conectado como "${quemSou.rows[0].usuario}" (esperado: "${roleMigrador}")`,
    );

    // 1. Bancos descartáveis órfãos de execuções interrompidas.
    const orfaos = await admin.query(
      "SELECT datname FROM pg_database WHERE datname LIKE $1",
      [`${PREFIXO}%`],
    );
    for (const { datname } of orfaos.rows) {
      console.log(`[e13] removendo banco descartável órfão "${datname}"`);
      await admin.query(`DROP DATABASE "${datname}" WITH (FORCE)`);
    }

    // 2. Banco descartável desta execução.
    await admin.query(`CREATE DATABASE "${nome}"`);
    console.log(`[e13] banco descartável criado: "${nome}" (owner: "${roleMigrador}")`);
  });

  const urlMigradorTeste = trocarBanco(urlMigradorDev, nome);
  const urlAppTeste = trocarBanco(urlAppDev, nome);

  // 3. Bootstrap de privilégios por banco — espelho de 01-roles.sh.
  await comCliente(urlMigradorTeste, async (adminTeste) => {
    await adminTeste.query(`GRANT CONNECT ON DATABASE "${nome}" TO "${roleApp}"`);
    await adminTeste.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await adminTeste.query(`GRANT USAGE ON SCHEMA public TO "${roleApp}"`);
    await adminTeste.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${roleMigrador}" IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${roleApp}"`,
    );
    await adminTeste.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE "${roleMigrador}" IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO "${roleApp}"`,
    );
  });

  // 4. Replay do histórico versionado como tlf_migrator (inclui REVOKEs E-11).
  console.log(`[e13] prisma migrate deploy como "${roleMigrador}" em "${nome}"...`);
  const deploy = spawnSync(
    process.execPath,
    [path.join(raizRepo, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    {
      cwd: raizRepo,
      env: { ...process.env, MIGRATE_DATABASE_URL: urlMigradorTeste },
      encoding: "utf8",
    },
  );
  if (deploy.status !== 0) {
    throw new Error(
      `prisma migrate deploy falhou (exit ${deploy.status}):\n${deploy.stdout}\n${deploy.stderr}`,
    );
  }
  const resumo = deploy.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /migration/i.test(l))
    .join(" | ");
  console.log(`[e13] migrate deploy ok: ${resumo}`);

  // 5. URLs efetivas da suíte. O Jest propaga process.env aos workers.
  process.env.DATABASE_URL = urlAppTeste;
  process.env.TLF_IT_MIGRATE_URL = urlMigradorTeste;
  process.env.TLF_IT_DBNAME = nome;
  console.log(
    `[e13] suíte: testes como "${papel(urlAppTeste)}" · limpeza como "${papel(urlMigradorTeste)}" · banco "${nome}"`,
  );
}
