// TechLab Fisio — configuração do Jest para a suíte de INTEGRAÇÃO de
// `apps/api` (Etapa 2.3B): API → DatabaseService → cliente real (fábrica
// pública) → tlf_app → PostgreSQL 18.
//
// Reusa, sem duplicar, a infraestrutura de banco descartável da E-13
// (packages/database/test/global-setup.mjs / global-teardown.mjs): o
// globalSetup cria um banco `techlab_fisio_it_%` na instância apontada por
// MIGRATE_DATABASE_URL/DATABASE_URL, aplica o histórico integral de
// migrations como `tlf_migrator` e publica DATABASE_URL (tlf_app) +
// TLF_IT_MIGRATE_URL (limpeza) no ambiente da suíte. O RUNTIME dos testes
// usa exclusivamente `tlf_app`; o migrator aparece apenas em setup/limpeza.
//
// Execução:
//   - local: docker compose up -d (instância de desenvolvimento) e
//     `npm run test:integration -w @techlab-fisio/api` (lê .env);
//   - CI: `npm run verify:api-integration` provisiona uma instância
//     PostgreSQL 18 descartável e exporta as URLs antes de rodar esta suíte.

import { createDefaultEsmPreset } from "ts-jest";

const presetEsm = createDefaultEsmPreset({
  tsconfig: "<rootDir>/tsconfig.test.json",
});

/** @type {import('jest').Config} */
export default {
  ...presetEsm,
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/integration/**/*.spec.ts"],

  moduleNameMapper: {
    "^@techlab-fisio/database$": "<rootDir>/../../packages/database/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  setupFiles: ["<rootDir>/test/setup.ts"],

  globalSetup: "<rootDir>/../../packages/database/test/global-setup.mjs",
  globalTeardown: "<rootDir>/../../packages/database/test/global-teardown.mjs",

  // Bootstrap eager + transações reais + cenários de concorrência: folga
  // acima do default de 5s, sem mascarar travamento indefinido.
  testTimeout: 30_000,
};
