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
//   3-B. (F3) GET /openapi.json → 200 com as rotas de autenticação, e
//        POST /auth/login sem o custom header CSRF → 403 sem cookie;
//   3-C. (F3, correção F-02) sem TLF_AMBIENTE o bootstrap ABORTA;
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
          // `F-02` — `TLF_AMBIENTE` e OBRIGATORIA desde a correcao pos-revisao:
          // a aplicacao nao assume ambiente por omissao, e sem esta linha o
          // bootstrap falharia de proposito. O smoke exercita o ambiente de
          // desenvolvimento, que e onde o documento OpenAPI e servido.
          TLF_AMBIENTE: "desenvolvimento",
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

    // 3-B (Etapa 2.3D-B / F3). Duas provas que SÓ o processo real dá, e que
    // nem o Jest nem `verify:openapi-runtime` cobrem: elas exercitam o
    // bootstrap de `main.ts` como ele roda em produção.
    //
    //   (a) `D-2.3D-11` — a rota do documento OpenAPI é montada ENTRE
    //       `NestFactory.create` e `listen`. Montá-la depois da inicialização
    //       a deixaria atrás do handler de rota desconhecida e ela
    //       responderia 404 — modo de falha MEDIDO nesta fatia;
    //   (b) `D-2.3D-07` — a baseline CSRF está aplicada às mutações no
    //       processo real: uma tentativa de login sem o custom request header
    //       é recusada com 403, sem autenticar e sem cookie.
    const documento = await fetch(`${base}/openapi.json`);
    if (documento.status !== 200) {
      falhar(`GET /openapi.json respondeu ${documento.status} (esperado 200)`);
    }
    const contrato = await documento.json();
    for (const rota of [
      "/auth/login",
      "/auth/logout",
      "/auth/recuperacao-senha",
      "/auth/recuperacao-senha/concluir",
    ]) {
      if (contrato?.paths?.[rota]?.post === undefined) {
        falhar(`o documento OpenAPI servido não descreve POST ${rota}`);
      }
    }
    console.log(`${ROTULO} GET /openapi.json -> 200 com as rotas da F3 e da F6.`);

    const semCabecalho = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identificador: "smoke-sintetico@local",
        senha: "senha-sintetica-smoke",
      }),
    });
    if (semCabecalho.status !== 403) {
      falhar(
        `POST /auth/login sem o custom header respondeu ${semCabecalho.status} (esperado 403)`,
      );
    }
    if (semCabecalho.headers.getSetCookie().length > 0) {
      falhar("a recusa CSRF emitiu Set-Cookie");
    }
    const corpoCsrf = await semCabecalho.text();
    if (corpoCsrf !== '{"erro":"REQUISICAO_NAO_AUTORIZADA"}') {
      falhar(`corpo inesperado da recusa CSRF: ${corpoCsrf}`);
    }
    console.log(`${ROTULO} POST /auth/login sem custom header -> 403 sem cookie.`);

    // 3-C (correcao `F-02`). Prova de FAIL-CLOSED no processo REAL: sem
    // `TLF_AMBIENTE` a aplicacao nao pode subir. E a unica forma de provar que
    // um deploy que esqueca a variavel nao sobe emitindo cookie de
    // desenvolvimento — o risco `R-2.3D-04` que a revisao independente mediu
    // como aberto.
    const envSemAmbiente = {
      ...process.env,
      DATABASE_URL: instancia.urlApp,
      PORT: String(PORTA_API + 1),
    };
    delete envSemAmbiente.TLF_AMBIENTE;
    const semAmbiente = spawn(
      process.execPath,
      [path.join(raizRepo, "apps", "api", "dist", "main.js")],
      { cwd: raizRepo, env: envSemAmbiente, stdio: ["ignore", "pipe", "pipe"] },
    );
    let saidaSemAmbiente = "";
    semAmbiente.stdout.on("data", (pedaco) => { saidaSemAmbiente += String(pedaco); });
    semAmbiente.stderr.on("data", (pedaco) => { saidaSemAmbiente += String(pedaco); });
    const desfechoSemAmbiente = await Promise.race([
      new Promise((resolve) => semAmbiente.on("exit", (codigo) => resolve(codigo))),
      aguardar(20_000).then(() => "TIMEOUT"),
    ]);
    if (desfechoSemAmbiente === "TIMEOUT") {
      semAmbiente.kill("SIGKILL");
      falhar("a API SUBIU sem TLF_AMBIENTE — fail-closed de R-2.3D-04 inativo");
    }
    if (desfechoSemAmbiente === 0) {
      falhar("a API encerrou com exit 0 sem TLF_AMBIENTE — esperado bootstrap abortado");
    }
    if (!saidaSemAmbiente.includes("TLF_AMBIENTE")) {
      falhar("o bootstrap abortou sem citar a variavel ausente");
    }
    console.log(`${ROTULO} sem TLF_AMBIENTE -> bootstrap abortado (exit ${desfechoSemAmbiente}).`);

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
