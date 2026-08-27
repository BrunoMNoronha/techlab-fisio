// TechLab Fisio — Etapa 2.3D-B / F1 — prova de runtime ESM + addon nativo.
//
// POR QUE ESTE SCRIPT EXISTE: `argon2` é um pacote CommonJS com componente
// NATIVO (`node-gyp-build` + prebuilds N-API). Nem o typecheck nem o Jest
// provam que ele carrega e executa no caminho de produção real — `apps/api`
// roda como ESM puro (`module: nodenext`, `node dist/main.js`, D-ESM-01).
// Uma biblioteca pode funcionar sob o runtime de VM do Jest e falhar no
// `dist/`. Esta prova fecha exatamente essa lacuna.
//
// O que é provado, sobre o ARTEFATO COMPILADO (`dist/`), fora do Jest:
//   1. o serviço compilado importa por ESM real;
//   2. o addon nativo do `argon2` carrega;
//   3. `hash` produz PHC Argon2id com m=19456, t=2, p=1;
//   4. `verify` aceita a senha correta e recusa a incorreta;
//   5. `precisaRehash` responde corretamente para vigente e defasado;
//   6. o caminho dummy não autentica e não regenera o dummy por chamada.
//
// Falha => exit 1. Nenhum segredo real; senhas 100% sintéticas.
//
// Uso:
//   npm run build --workspace @techlab-fisio/api
//   npm run verify:argon2-runtime --workspace @techlab-fisio/api

import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROTULO = "[argon2-runtime]";
const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicoCompilado = path.join(raizApi, "dist", "auth", "credencial.service.js");

if (!existsSync(servicoCompilado)) {
  console.error(
    `${ROTULO} dist ausente — esta prova exige o artefato COMPILADO.\n` +
      "  npm run build --workspace @techlab-fisio/api",
  );
  process.exit(2);
}

const falhas = [];
function conferir(rotulo, condicao, detalhe = "") {
  if (condicao) {
    console.log(`${ROTULO} OK   — ${rotulo}`);
  } else {
    console.error(`${ROTULO} FALHA — ${rotulo}${detalhe ? ` (${detalhe})` : ""}`);
    falhas.push(rotulo);
  }
}

const SENHA = "senha-sintetica-runtime-f1";
const SENHA_ERRADA = "senha-sintetica-runtime-f1-incorreta";

// 1. Import ESM real do artefato compilado.
const modulo = await import(
  new URL(`file://${servicoCompilado.replaceAll("\\", "/")}`).href
);
const { CredencialService, POLITICA_ARGON2 } = modulo;
conferir(
  "serviço compilado importado por ESM real (dist/, fora do Jest)",
  typeof CredencialService === "function",
);

const require = createRequire(import.meta.url);
const versaoArgon2 = require("argon2/package.json").version;
console.log(`${ROTULO} node ${process.version} · ${process.platform}/${process.arch} · argon2 ${versaoArgon2}`);

const servico = new CredencialService();

// 2 + 3. Addon nativo carrega e produz PHC sob a política homologada.
const digest = await servico.gerarHash(SENHA);
conferir("addon nativo do argon2 carregou e gerou hash", typeof digest === "string");
conferir("saída é PHC Argon2id", digest.startsWith("$argon2id$"), digest.slice(0, 10));
const parametros = digest.split("$")[3] ?? "";
const pares = new Map(parametros.split(",").map((p) => p.split("=")));
conferir("PHC registra m=19456", pares.get("m") === "19456", parametros);
conferir("PHC registra t=2", pares.get("t") === "2", parametros);
conferir("PHC registra p=1", pares.get("p") === "1", parametros);
conferir(
  "política compilada é a homologada",
  POLITICA_ARGON2.memoryCost === 19456 &&
    POLITICA_ARGON2.timeCost === 2 &&
    POLITICA_ARGON2.parallelism === 1,
);

// 4. Verificação real.
conferir("verify aceita a senha correta", (await servico.verificarSenha(digest, SENHA)) === true);
conferir(
  "verify recusa a senha incorreta",
  (await servico.verificarSenha(digest, SENHA_ERRADA)) === false,
);
conferir(
  "digest malformado falha fechado (não autentica, não lança)",
  (await servico.verificarSenha("nao-e-phc", SENHA)) === false,
);

// 5. Rehash.
conferir("hash vigente não precisa de rehash", servico.precisaRehash(digest) === false);
conferir(
  "digest de variante/parâmetros não vigentes precisa de rehash",
  servico.precisaRehash("$argon2i$v=19$m=19456,p=1,t=2$YWJj$YWJj") === true,
);

// 6. Caminho dummy.
conferir(
  "ausência de hash não autentica",
  (await servico.verificarComCaminhoDummy(null, SENHA)) === false,
);
const dummyAntes = await servico.obterHashDummyParaProva();
await servico.verificarComCaminhoDummy(null, SENHA);
await servico.verificarComCaminhoDummy(undefined, SENHA_ERRADA);
const dummyDepois = await servico.obterHashDummyParaProva();
conferir(
  "o hash dummy é reutilizado — nenhum hash() novo por tentativa",
  dummyAntes === dummyDepois,
);
conferir("o dummy usa a política Argon2id vigente", dummyAntes.startsWith("$argon2id$"));

if (falhas.length > 0) {
  console.error(`${ROTULO} PROVA FALHOU — ${falhas.length} verificação(ões): ${falhas.join("; ")}`);
  process.exit(1);
}
console.log(`${ROTULO} PROVA CONCLUÍDA: argon2 carrega e opera no ESM compilado.`);
