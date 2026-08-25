// TechLab Fisio — E-16 — GUARDA 3: snapshot golden de schema (docs/08 §9.3)
// + alarme complementar `prisma migrate diff --exit-code`.
//
// O snapshot é produzido SOMENTE a partir de uma instância PostgreSQL 18
// LIMPA, reconstruída EXCLUSIVAMENTE pelas migrations versionadas
// (`prisma migrate deploy`), reaproveitando a infraestrutura fail-closed da
// E-15 (scripts/lib/instancia-descartavel.mjs). Nunca a instância de
// desenvolvimento: o que entra no golden é, por construção, o que o histórico
// versionado produz do zero.
//
// COMANDO-BASE HOMOLOGADO (docs/08 §9.3):
//   pg_dump --schema-only --no-owner --no-privileges
//
// DETERMINISMO (PostgreSQL 18): o pg_dump 18 emite `\restrict <chave>` com
// chave ALEATÓRIA quando nenhuma é fornecida, o que tornaria o dump
// irreproduzível byte a byte. Por isso o comando usa também:
//   --restrict-key=<CHAVE FIXA>
// A chave abaixo NÃO é segredo: é um valor alfanumérico fixo e documentado,
// que existe apenas para tornar dois dumps comparáveis. O pg_dump é executado
// DENTRO do próprio container `postgres:18-bookworm` (mesma major do servidor,
// nunca uma versão eventualmente instalada no host/runner), via socket local.
//
// LIMITE DECLARADO: `--no-privileges` exclui GRANT/REVOKE do golden — a
// proteção dos REVOKEs append-only NÃO depende desta guarda; ela é provada
// explicitamente pela GUARDA 2 (guard-anti-drift.spec.ts, matriz de
// privilégios + efeito 42501).
//
// Modos:
//   --update  gera/atualiza deliberadamente packages/database/schema.golden.sql
//             (ato explícito, versionado e revisável — o CI NUNCA o executa);
//   --verify  reconstrói do zero, gera o dump e compara BYTE A BYTE com o
//             golden versionado; divergência => exit 1. Em seguida executa o
//             alarme complementar:
//               prisma migrate diff --from-migrations <migrations>
//                                   --to-schema <schema.prisma> --exit-code
//             (CLI real do Prisma 7.9.1: o flag é `--to-schema`; o
//             `--to-schema-datamodel` citado no texto histórico de §9.3 foi
//             removido — registro operacional em docs/08 REV. 11. O shadow
//             database vem de prisma.config.ts, apontado para o shadow da
//             própria instância descartável.)
//             Interpretação: exit 0 = sem diferença; exit 2 = drift detectado
//             (falha); qualquer outro = erro operacional (falha). É ALARME,
//             não correção: nada é alterado.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  docker,
  migrateDeploy,
  provarBancoVazio,
  removerOrfaos,
} from "./lib/instancia-descartavel.mjs";

const PREFIXO_E16 = "techlab-fisio-e16-";
const ROTULO = "[guarda-3]";
// Chave fixa de `\restrict` — NÃO é segredo; só torna o dump reproduzível.
const RESTRICT_KEY = "tlfgoldene16";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const caminhoGolden = path.join(raizRepo, "packages", "database", "schema.golden.sql");

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

function pgDumpNoContainer(container, cred) {
  const versao = docker(["exec", container, "pg_dump", "--version"]);
  if (versao.status !== 0) falhar(`pg_dump --version falhou: ${versao.stderr}`);
  console.log(`${ROTULO} ${versao.stdout.trim()} (dentro do container — mesma major do servidor)`);

  // Socket local do container (auth local trust da imagem oficial); nenhuma
  // senha trafega. `--restrict-key` fixa a chave de `\restrict` do PG 18.
  const dump = spawnSync(
    "docker",
    [
      "exec", container,
      "pg_dump",
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      `--restrict-key=${RESTRICT_KEY}`,
      "-U", cred.roleMigrador,
      "-d", cred.bancoApp,
    ],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
  );
  if (dump.status !== 0) {
    falhar(`pg_dump falhou (exit ${dump.status}): ${dump.stderr.toString("utf8")}`);
  }
  return dump.stdout; // Buffer — comparação byte a byte, sem normalização
}

function relatarDivergencia(esperado, obtido) {
  const linhasEsperado = esperado.toString("utf8").split("\n");
  const linhasObtido = obtido.toString("utf8").split("\n");
  const max = Math.max(linhasEsperado.length, linhasObtido.length);
  let mostradas = 0;
  for (let i = 0; i < max && mostradas < 40; i += 1) {
    if (linhasEsperado[i] !== linhasObtido[i]) {
      console.error(`  linha ${i + 1}:`);
      console.error(`    golden : ${linhasEsperado[i] ?? "<ausente>"}`);
      console.error(`    obtido : ${linhasObtido[i] ?? "<ausente>"}`);
      mostradas += 1;
    }
  }
  if (mostradas === 40) console.error("  ... (divergências adicionais omitidas)");
}

function alarmeMigrateDiff(instancia) {
  console.log(
    `${ROTULO} alarme complementar: prisma migrate diff --from-migrations ` +
      `packages/database/prisma/migrations --to-schema packages/database/prisma/schema.prisma --exit-code`,
  );
  const diff = spawnSync(
    process.execPath,
    [
      path.join(raizRepo, "node_modules", "prisma", "build", "index.js"),
      "migrate", "diff",
      "--from-migrations", path.join(raizRepo, "packages", "database", "prisma", "migrations"),
      "--to-schema", path.join(raizRepo, "packages", "database", "prisma", "schema.prisma"),
      "--exit-code",
    ],
    {
      cwd: raizRepo,
      env: {
        ...process.env,
        MIGRATE_DATABASE_URL: instancia.urlMigrador,
        SHADOW_DATABASE_URL: instancia.urlShadow,
      },
      encoding: "utf8",
    },
  );
  if (diff.status === 0) {
    console.log(`${ROTULO} alarme migrate diff: exit 0 — histórico e schema.prisma sem diferença.`);
    return;
  }
  if (diff.status === 2) {
    falhar(
      `alarme migrate diff: exit 2 — DRIFT entre o histórico de migrations e o schema.prisma:\n` +
        `${diff.stdout}\n${diff.stderr}`,
    );
  }
  falhar(
    `alarme migrate diff: exit ${diff.status} — erro operacional:\n${diff.stdout}\n${diff.stderr}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const atualizar = args.includes("--update");
  const verificar = args.includes("--verify");
  if (atualizar === verificar) {
    console.error(`${ROTULO} uso: schema-snapshot.mjs (--update | --verify)`);
    process.exit(2);
  }

  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });
  const cred = credenciaisDoAmbiente();
  removerOrfaos(PREFIXO_E16, ROTULO);

  let instancia = null;
  try {
    instancia = await criarInstanciaLimpa({
      raizRepo,
      prefixo: PREFIXO_E16,
      rotulo: ROTULO,
      cred,
    });
    await provarBancoVazio(instancia.conexaoMigrador, cred.bancoApp, ROTULO);
    migrateDeploy(raizRepo, instancia.urlMigrador, cred.roleMigrador, ROTULO);

    const dump = pgDumpNoContainer(instancia.container, cred);
    console.log(`${ROTULO} dump gerado: ${dump.length} bytes (restrict-key fixa "${RESTRICT_KEY}").`);

    if (atualizar) {
      writeFileSync(caminhoGolden, dump);
      console.log(
        `${ROTULO} golden ATUALIZADO deliberadamente em packages/database/schema.golden.sql — ` +
          `revise o diff antes de versionar.`,
      );
    } else {
      if (!existsSync(caminhoGolden)) {
        falhar("packages/database/schema.golden.sql não existe — gere com --update e versione.");
      }
      const golden = readFileSync(caminhoGolden);
      if (Buffer.compare(golden, dump) !== 0) {
        console.error(
          `${ROTULO} FALHA — o schema reconstruído do zero DIVERGE do golden versionado ` +
            `(golden ${golden.length} bytes × obtido ${dump.length} bytes):`,
        );
        relatarDivergencia(golden, dump);
        console.error(
          `${ROTULO} O CI nunca atualiza o golden. Se a mudança é deliberada, execute ` +
            `\`npm run schema:golden:update\` localmente, revise o diff e versione.`,
        );
        falhar("golden schema divergente");
      }
      console.log(`${ROTULO} OK — dump byte a byte idêntico ao golden versionado (${golden.length} bytes).`);

      alarmeMigrateDiff(instancia);
    }
  } finally {
    if (instancia !== null) {
      const residuo = destruirInstancia(
        instancia.container, instancia.volume, PREFIXO_E16, ROTULO,
      );
      if (residuo) process.exitCode = 1;
    }
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
