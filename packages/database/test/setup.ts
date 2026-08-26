// TechLab Fisio — E-13 — setup por arquivo de teste (docs/08 §13 `E-13`).
//
// Registrado em `setupFilesAfterEnv`. Garante:
//   - que a suíte só roda apontada para um banco descartável (guarda);
//   - limpeza determinística de dados entre testes (truncamento como
//     `tlf_migrator` — ver helpers/db.ts);
//   - fechamento da conexão de limpeza ao final de cada arquivo.
//
// Nenhum teste depende de dados deixados por outro teste ou por outro arquivo.

import { afterAll, afterEach, beforeAll } from "@jest/globals";
import {
  encerrarClienteLimpeza,
  garantirBancoDescartavel,
  limparTabelasDeDominio,
} from "./helpers/db.js";

beforeAll(() => {
  garantirBancoDescartavel();
});

afterEach(async () => {
  await limparTabelasDeDominio();
});

afterAll(async () => {
  await encerrarClienteLimpeza();
});
