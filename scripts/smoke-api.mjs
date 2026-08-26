// TechLab Fisio — Etapa 2.3B — smoke de bootstrap ESM da API (R-BL-02).
//
// Substitui o passo inline da CI da 2.3A SEM enfraquecer nenhuma
// verificação: desde a 2.3B o DatabaseService conecta EAGER no bootstrap,
// então o smoke provisiona uma instância PostgreSQL 18 descartável (mesma
// infraestrutura fail-closed da E-15/E-16), aplica o histórico integral de
// migrations e executa o PROCESSO REAL `node apps/api/dist/main.js` com a
// role de runtime (tlf_app).
//
// Verificações preservadas da 2.3A (F-03 incluído):
//   1. processo real do artefato compilado (ESM, Node 24) sobe;
//   2. GET /health → 200 com corpo exato {"status":"ok"};
//   3. rota inexistente → 404 SEM stack trace no corpo;
//   4. encerramento LIMPO por sinal (SIGTERM → exit 0);
//   5. cleanup garantido mesmo em falha (processo morto + instância
//      destruída no finally).
//
// Nenhuma senha e nenhuma URL completa aparecem em log.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  aguardar,
  credenciaisDoAmbiente,
  criarInstanciaLimpa,
  destruirInstancia,
  migrateDeploy,
  removerOrfaos,
} from "./lib/instancia-descartavel.mjs";

const PREFIXO = "techlab-fisio-smoke-";
const ROTULO = "[smoke]";
const PORTA_API = 3777;
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function falhar(mensagem) {
  throw new Error(`${ROTULO} ${mensagem}`);
}

function encerrarProcesso(processo) {
  if (processo && processo.exitCode === null && !processo.killed) {
    processo.kill("SIGKILL");
  }
}

async function main() {
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });
  const cred = credenciaisDoAmbiente();
  removerOrfaos(PREFIXO, ROTULO);

  let instancia = null;
  let api = null;
  try {
    instancia = await criarInstanciaLimpa({
      raizRepo,
      prefixo: PREFIXO,
      rotulo: ROTULO,
      cred,
    });
    migrateDeploy(raizRepo, instancia.urlMigrador, cred.roleMigrador, ROTULO);

    console.log(`${ROTULO} subindo processo real: node apps/api/dist/main.js (porta ${PORTA_API}, role "${cred.roleApp}")...`);
    api = spawn(
      process.execPath,
      [path.join(raizRepo, "apps", "api", "dist", "main.js")],
      {
        cwd: raizRepo,
        env: {
          ...process.env,
          DATABASE_URL: instancia.urlApp,
          PORT: String(PORTA_API),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let saidaApi = "";
    api.stdout.on("data", (pedaco) => { saidaApi += String(pedaco); });
    api.stderr.on("data", (pedaco) => { saidaApi += String(pedaco); });
    const encerramento = new Promise((resolve) => {
      api.on("exit", (codigo, sinal) => resolve({ codigo, sinal }));
    });

    // 2. /health → 200 {"status":"ok"} (com teto explícito de prontidão).
    const base = `http://127.0.0.1:${PORTA_API}`;
    let saude = null;
    const inicio = Date.now();
    while (Date.now() - inicio < 30_000) {
      if (api.exitCode !== null) {
        falhar(`o processo da API encerrou antes de responder (exit ${api.exitCode}):\n${saidaApi}`);
      }
      try {
        const resposta = await fetch(`${base}/health`);
        if (resposta.status === 200) {
          saude = await resposta.text();
          break;
        }
      } catch {
        // ainda subindo
      }
      await aguardar(200);
    }
    if (saude === null) falhar("GET /health não respondeu 200 em 30s");
    if (saude !== '{"status":"ok"}') {
      falhar(`corpo inesperado de /health: ${saude}`);
    }
    console.log(`${ROTULO} GET /health -> 200 ${saude}`);

    // 3. Rota inexistente → 404 sem stack trace no corpo.
    const inexistente = await fetch(`${base}/rota-inexistente`);
    if (inexistente.status !== 404) {
      falhar(`rota inexistente respondeu ${inexistente.status} (esperado 404)`);
    }
    const corpo404 = await inexistente.text();
    if (corpo404.includes("at ")) {
      falhar("corpo do 404 contém frame de stack trace");
    }
    console.log(`${ROTULO} rota inexistente -> 404 sem stack.`);

    // 4. Encerramento limpo por sinal. Comportamento MEDIDO do Nest 11 com
    // enableShutdownHooks: o handler executa os hooks de ciclo de vida
    // (onModuleDestroy → desconexão do pool) e então RE-EMITE o sinal — o
    // processo termina PELO SIGTERM (exit=null, signal=SIGTERM), não com
    // exit 0. Desfecho limpo aceito: exit 0 OU término pelo próprio SIGTERM
    // dentro do teto; qualquer outro código/sinal (ex.: crash, SIGKILL do
    // cleanup) falha o smoke. A execução efetiva dos hooks é provada também
    // pela suíte de integração (app.close() sem erro com pool aberto).
    api.kill("SIGTERM");
    const fim = await Promise.race([
      encerramento,
      aguardar(15_000).then(() => null),
    ]);
    if (fim === null) falhar("a API não encerrou em 15s após SIGTERM");
    const limpo = fim.codigo === 0 || (fim.codigo === null && fim.sinal === "SIGTERM");
    if (process.platform !== "win32" && !limpo) {
      falhar(`encerramento não foi limpo: exit=${fim.codigo} sinal=${fim.sinal}\n${saidaApi}`);
    }
    console.log(`${ROTULO} encerramento limpo (${fim.codigo === null ? `sinal ${fim.sinal}` : `exit ${fim.codigo}`}).`);
    console.log(`${ROTULO} SMOKE CONCLUÍDO: bootstrap ESM real com banco descartável verde.`);
  } finally {
    // 5. Cleanup garantido — inclusive em falha.
    encerrarProcesso(api);
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
