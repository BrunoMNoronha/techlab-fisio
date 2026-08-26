// TechLab Fisio — setup por arquivo da suíte de INTEGRAÇÃO de `apps/api`
// (Etapa 2.3B). Registrado em `setupFilesAfterEnv` de
// jest.integration.config.mjs. Mesmo contrato do setup da E-13:
//   - a suíte só roda apontada para banco descartável (guarda);
//   - limpeza determinística entre testes (TRUNCATE como tlf_migrator);
//   - fechamento da conexão de limpeza ao final de cada arquivo.

import { afterAll, afterEach, beforeAll } from "@jest/globals";

import {
  encerrarClienteLimpeza,
  garantirBancoDescartavel,
  limparTabelasDeDominio,
} from "./helpers-integracao.js";

beforeAll(() => {
  garantirBancoDescartavel();
});

afterEach(async () => {
  await limparTabelasDeDominio();
});

afterAll(async () => {
  await encerrarClienteLimpeza();
});
