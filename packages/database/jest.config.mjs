// TechLab Fisio — configuração do Jest 30 para a suíte de integração do
// pacote de banco (docs/08 §13 `E-13`; verificação V-05).
//
// ESM DE VERDADE (D-ESM-01): os testes executam como módulos ES nativos no
// runtime de VM do Jest (`node --experimental-vm-modules`), preservando
// `module: nodenext` do projeto. Nada é convertido para CommonJS.
//
// NOTA (docs/08 §13 `E-13`): o plano listava `jest.config.ts` como arquivo
// previsto. Carregar configuração .ts exigiria instalar `ts-node` apenas como
// loader instrumental; `.mjs` elimina essa dependência sem alterar nenhum
// comportamento. Divergência de NOME registrada em docs/08 como detalhe de
// implementação.
//
// Transformer: ts-jest 29.4.x (linha com suporte documentado a Jest 30,
// TypeScript 6 e ESM via `useESM: true`). Como `tsconfig.base.json` define
// `isolatedModules: true`, o ts-jest transpila arquivo a arquivo; a checagem
// de tipos dos testes é papel do `tsc --noEmit -p tsconfig.test.json`
// (script `typecheck` do pacote).

import { createDefaultEsmPreset } from "ts-jest";

const presetEsm = createDefaultEsmPreset({
  tsconfig: "<rootDir>/tsconfig.test.json",
});

/** @type {import('jest').Config} */
export default {
  ...presetEsm,
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],

  // O Prisma Client gerado usa especificadores ESM com extensão `.js`
  // (`./enums.js`) apontando para arquivos `.ts` — padrão nodenext. Este
  // mapeamento remove a extensão APENAS de imports relativos, deixando o
  // resolver do ts-jest encontrar o `.ts` correspondente.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Banco descartável por execução: criado/migrado no globalSetup
  // (tlf_migrator) e destruído no globalTeardown (docs/08 §13 `E-13`).
  // `.mjs`: esses hooks rodam FORA do pipeline de transform do Jest (fato
  // medido na E-13) — ver nota de cabeçalho em test/global-setup.mjs.
  globalSetup: "<rootDir>/test/global-setup.mjs",
  globalTeardown: "<rootDir>/test/global-teardown.mjs",

  // Limpeza determinística de dados entre testes (truncamento) e guarda de
  // segurança contra execução fora do banco descartável.
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],

  // A suíte compartilha um único banco descartável; execução serial evita que
  // o truncamento de um arquivo interfira em transações de outro. E-14 pode
  // reavaliar (ex.: um banco por worker) se o tempo de execução justificar.
  maxWorkers: 1,
};
