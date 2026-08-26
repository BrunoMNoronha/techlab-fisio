// TechLab Fisio — configuração do Jest 30 para a suíte de `apps/api`
// (Etapa 2.3A). Espelha deliberadamente o padrão já medido e homologado de
// `packages/database/jest.config.mjs` (V-05, D-ESM-01): ESM de verdade no
// runtime de VM do Jest (`node --experimental-vm-modules`), transformer
// ts-jest 29.4.x com `useESM`, sem conversão para CommonJS.
//
// Diferenças em relação ao pacote de banco, e por quê:
//   - sem globalSetup/globalTeardown: esta suíte não abre banco — bootstrap,
//     health e a política de auditoria (T-AUD-CONTEXTO) são regras de
//     aplicação, testadas contra o container NestJS real, não contra o
//     PostgreSQL;
//   - `@techlab-fisio/database` é mapeado para o MESMO ponto de entrada
//     público (`src/index.ts`) que a condição `types` do pacote declara —
//     nenhum caminho interno do pacote é importado; o mapeamento apenas
//     dispensa o build prévio de `dist/` durante os testes. O runtime real
//     (node dist/main.js) resolve pelo `exports` do pacote, sem mapeamento.

import { createDefaultEsmPreset } from "ts-jest";

const presetEsm = createDefaultEsmPreset({
  tsconfig: "<rootDir>/tsconfig.test.json",
});

/** @type {import('jest').Config} */
export default {
  ...presetEsm,
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],

  moduleNameMapper: {
    "^@techlab-fisio/database$": "<rootDir>/../../packages/database/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // `reflect-metadata` precisa estar carregado antes de qualquer decorator
  // do NestJS ser avaliado (main.ts faz o mesmo no runtime real).
  setupFiles: ["<rootDir>/test/setup.ts"],
};
