// TechLab Fisio — Etapa 2.3B — prova de integração da API com PostgreSQL 18
// REAL, em instância DESCARTÁVEL.
//
// Caminho provado: suíte de integração de `apps/api`
// (jest.integration.config.mjs) → AppModule real → DatabaseService →
// cliente da fábrica pública → role de runtime (tlf_app) → PostgreSQL 18 →
// `profissional` → AuditContextValidator → `evento_auditoria`.
//
// Mecânica (mesma infraestrutura fail-closed da E-15/E-16 —
// scripts/lib/instancia-descartavel.mjs, sem alteração):
//   1. container + volume novos com initdb versionado (roles tlf_migrator/
//      tlf_app), porta efêmera em 127.0.0.1 — nunca a instância de dev;
//   2. a suíte roda com MIGRATE_DATABASE_URL/DATABASE_URL apontadas para a
//      instância; o globalSetup da E-13 cria o banco descartável
//      `techlab_fisio_it_%` DENTRO dela e aplica o histórico integral de
//      migrations (inclusive os REVOKEs de E-11);
//   3. zero resíduos verificados; container e volume destruídos SEMPRE
//      (finally), inclusive em falha.
//
// Nenhuma senha e nenhuma URL completa aparecem em log.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  comCliente,
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  removerOrfaos,
} from "./lib/instancia-descartavel.mjs";

const PREFIXO = "techlab-fisio-apiit-";
const ROTULO = "[api-it]";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

async function main() {
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });
  const cred = credenciaisDoAmbiente();
  removerOrfaos(PREFIXO, ROTULO);

  let instancia = null;
  try {
    instancia = await criarInstanciaLimpa({
      raizRepo,
      prefixo: PREFIXO,
      rotulo: ROTULO,
      cred,
    });

    console.log(`${ROTULO} executando a suíte de integração de apps/api (runtime como "${cred.roleApp}")...`);
    const suite = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        path.join(raizRepo, "node_modules", "jest", "bin", "jest.js"),
        "--config", path.join(raizRepo, "apps", "api", "jest.integration.config.mjs"),
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
    if (suite.status !== 0) falhar(`suíte de integração da API falhou (exit ${suite.status})`);

    // Zero resíduos de bancos descartáveis da suíte dentro da instância.
    await comCliente(instancia.conexaoMigrador, async (c) => {
      const resto = await c.query(
        "SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'techlab_fisio_it_%'",
      );
      if (resto.rows[0].n !== 0) {
        falhar(`${resto.rows[0].n} banco(s) descartável(is) da suíte remanescente(s)`);
      }
    });
    console.log(`${ROTULO} 0 bancos techlab_fisio_it_% remanescentes na instância.`);
    console.log(`${ROTULO} PROVA CONCLUÍDA: integração da API com PostgreSQL real verde.`);
  } finally {
    if (instancia !== null) {
      const residuo = destruirInstancia(instancia.container, instancia.volume, PREFIXO, ROTULO);
      if (residuo) process.exitCode = 1;
    }
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
