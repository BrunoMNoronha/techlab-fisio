// TechLab Fisio — Etapa 2.3D-B / F1 — benchmark empírico do Argon2id.
//
// Cumpre `P-2.3D-02` (`docs/12` §11): "benchmark empírico obrigatório na F1
// antes de considerar os parâmetros operacionais encerrados" (`D-2.3D-02`).
//
// NÃO É TESTE DE CI. É evidência para decisão operacional. `docs/12` NÃO fixou
// limiar numérico de aprovação, e este script deliberadamente NÃO inventa um:
// ele mede e reporta. Transformar estes números em asserção com limiar rígido
// produziria falha intermitente por variação de máquina/carga, não sinal.
//
// SEM BIBLIOTECA DE BENCHMARK: `process.hrtime.bigint()` (relógio monotônico,
// resolução de nanossegundo) é suficiente — nenhuma dependência é adicionada.
//
// MEDE O CAMINHO REAL: importa o serviço COMPILADO (`dist/`), com a política
// homologada que o backend efetivamente usa. Não reimplementa parâmetros —
// se `POLITICA_ARGON2` mudar, o benchmark muda junto, sem drift.
//
// Uso:
//   npm run build --workspace @techlab-fisio/api
//   npm run bench:argon2 --workspace @techlab-fisio/api
// Opcional: TLF_BENCH_WARMUP=5 TLF_BENCH_AMOSTRAS=30

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicoCompilado = path.join(raizApi, "dist", "auth", "credencial.service.js");

if (!existsSync(servicoCompilado)) {
  console.error(
    "[bench-argon2] dist ausente. Execute antes:\n" +
      "  npm run build --workspace @techlab-fisio/api",
  );
  process.exit(2);
}

const { CredencialService, POLITICA_ARGON2 } = await import(
  new URL(`file://${servicoCompilado.replaceAll("\\", "/")}`).href
);

const require = createRequire(import.meta.url);
const versaoArgon2 = require("argon2/package.json").version;

const WARMUP = Number.parseInt(process.env["TLF_BENCH_WARMUP"] ?? "5", 10);
const AMOSTRAS = Number.parseInt(process.env["TLF_BENCH_AMOSTRAS"] ?? "30", 10);

// Senha SINTÉTICA — nenhum segredo real, nenhum dado de usuário
// (TLF-BASE-V1 §10).
const SENHA = "senha-sintetica-benchmark-f1";
const SENHA_ERRADA = "senha-sintetica-benchmark-f1-incorreta";

/** Nanossegundos decorridos, relógio monotônico. */
async function medir(acao) {
  const inicio = process.hrtime.bigint();
  await acao();
  return Number(process.hrtime.bigint() - inicio) / 1e6; // ms
}

/** Percentil por nearest-rank sobre a amostra ordenada ascendente. */
function percentil(ordenada, pct) {
  const posicao = Math.ceil((pct / 100) * ordenada.length) - 1;
  return ordenada[Math.min(Math.max(posicao, 0), ordenada.length - 1)];
}

function estatisticas(amostras) {
  const ordenada = [...amostras].sort((a, b) => a - b);
  const soma = ordenada.reduce((acc, v) => acc + v, 0);
  return {
    n: ordenada.length,
    min: ordenada[0],
    media: soma / ordenada.length,
    p50: percentil(ordenada, 50),
    p95: percentil(ordenada, 95),
    max: ordenada[ordenada.length - 1],
  };
}

const ms = (v) => `${v.toFixed(2)} ms`;

async function cenario(rotulo, acao) {
  // Warm-up: a PRIMEIRA chamada carrega o addon nativo e aquece o alocador —
  // medi-la junto reportaria custo de inicialização como custo por operação.
  for (let i = 0; i < WARMUP; i += 1) await acao();
  const amostras = [];
  for (let i = 0; i < AMOSTRAS; i += 1) amostras.push(await medir(acao));
  const e = estatisticas(amostras);
  console.log(
    `${rotulo.padEnd(22)} n=${e.n}  min=${ms(e.min)}  media=${ms(e.media)}  ` +
      `p50=${ms(e.p50)}  p95=${ms(e.p95)}  max=${ms(e.max)}`,
  );
  return { rotulo, ...e };
}

const servico = new CredencialService();
const hashReferencia = await servico.gerarHash(SENHA);

console.log("=".repeat(78));
console.log("TechLab Fisio — benchmark Argon2id (P-2.3D-02) — evidência, não teste de CI");
console.log("=".repeat(78));
console.log(`Node .............: ${process.version}`);
console.log(`Plataforma .......: ${process.platform} ${os.release()}`);
console.log(`Arquitetura ......: ${process.arch}`);
console.log(`CPU ..............: ${os.cpus()[0]?.model ?? "desconhecida"} (${os.cpus().length} lógicas)`);
console.log(`Memória total ....: ${(os.totalmem() / 1024 ** 3).toFixed(1)} GiB`);
console.log(`argon2 ...........: ${versaoArgon2}`);
console.log(
  `Parâmetros .......: Argon2id  m=${POLITICA_ARGON2.memoryCost} KiB  ` +
    `t=${POLITICA_ARGON2.timeCost}  p=${POLITICA_ARGON2.parallelism}`,
);
console.log(`Warm-up ..........: ${WARMUP} por cenário`);
console.log(`Amostras .........: ${AMOSTRAS} por cenário`);
console.log("-".repeat(78));

const resultados = [];
resultados.push(await cenario("hash", () => servico.gerarHash(SENHA)));
resultados.push(
  await cenario("verify válido", () => servico.verificarSenha(hashReferencia, SENHA)),
);
resultados.push(
  await cenario("verify inválido", () =>
    servico.verificarSenha(hashReferencia, SENHA_ERRADA),
  ),
);

console.log("-".repeat(78));
const validoP50 = resultados[1].p50;
const invalidoP50 = resultados[2].p50;
const razao = invalidoP50 / validoP50;
console.log(
  `Simetria verify válido × inválido (p50): ${ms(validoP50)} × ${ms(invalidoP50)} ` +
    `— razão ${razao.toFixed(3)}`,
);
console.log(
  "Observação: o Argon2 recomputa o digest integralmente antes de comparar, logo\n" +
    "senha correta e incorreta custam essencialmente o mesmo. Este é o fundamento\n" +
    "do caminho dummy de D-2.3D-02 — a assimetria a eliminar é 'conta existe' ×\n" +
    "'conta não existe', não 'senha certa' × 'senha errada'.",
);
console.log(
  `\nMemória por operação: ~${(POLITICA_ARGON2.memoryCost / 1024).toFixed(0)} MiB ` +
    `(m=${POLITICA_ARGON2.memoryCost} KiB), p=${POLITICA_ARGON2.parallelism}.`,
);
console.log(
  "NENHUM limiar de aprovação é aplicado: `docs/12` não fixou um, e este script\n" +
    "não inventa. Interpretação e eventual reabertura de D-2.3D-02 são decisão de\n" +
    "Bruno, com base nestes números.",
);
console.log("=".repeat(78));
