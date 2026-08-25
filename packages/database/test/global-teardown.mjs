// TechLab Fisio — E-13 — globalTeardown do Jest (docs/08 §13 `E-13`).
//
// Destrói o banco descartável criado pelo globalSetup. Roda no MESMO processo
// principal do Jest e lê o nome via `process.env.TLF_IT_DBNAME`. A conexão
// administrativa usa a URL de migration ORIGINAL (banco de desenvolvimento),
// nunca o banco que será derrubado. `.mjs` + `pg` pelo mesmo motivo do
// global-setup.mjs (globalTeardown roda fora do pipeline de transform).

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

// Mantido em sincronia com PREFIXO_BANCO_DESCARTAVEL de helpers/db.ts.
const PREFIXO = "techlab_fisio_it_";

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export default async function globalTeardown() {
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });

  const nome = process.env.TLF_IT_DBNAME;
  const urlMigradorDev = process.env.MIGRATE_DATABASE_URL;
  if (!nome || !urlMigradorDev) {
    console.warn("[e13] teardown: nada a destruir (setup não concluiu).");
    return;
  }
  if (!nome.startsWith(PREFIXO)) {
    throw new Error(`[e13] teardown recusado: "${nome}" não tem o prefixo descartável.`);
  }

  const admin = new pg.Client({ connectionString: urlMigradorDev });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE "${nome}" WITH (FORCE)`);
    console.log(`[e13] banco descartável "${nome}" destruído.`);
  } finally {
    await admin.end();
  }
}
