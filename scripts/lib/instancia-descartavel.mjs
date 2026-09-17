// TechLab Fisio — infraestrutura de instância PostgreSQL DESCARTÁVEL.
//
// Extraída de scripts/verify-from-scratch.mjs (E-15) na E-16, SEM alteração de
// comportamento, para ser compartilhada com scripts/schema-snapshot.mjs
// (Guarda 3 de docs/08 §9.3). Os invariantes de segurança da E-15 permanecem:
//
//   - container `<prefixo><sufixo>` e volume homônimo `-data`, porta efêmera
//     em 127.0.0.1 atribuída pelo Docker — NUNCA a instância de
//     desenvolvimento; toda destruição é fail-closed por prefixo;
//   - mesma tag de imagem extraída do docker-compose.yml versionado e mesmo
//     bootstrap initdb versionado (infra/postgres/initdb);
//   - nenhuma senha e nenhuma URL completa em log (somente roles, banco,
//     host/porta e nomes de recursos);
//   - prontidão por condição real (conexão TCP como tlf_migrator, que só
//     existe após o initdb), com teto explícito.
//
// Execuções concorrentes (mesmo prefixo, mesma máquina): cada container e
// volume nasce com labels de DONO (host + PID do processo que o criou). A
// limpeza de órfãos só remove recurso cujo dono comprovadamente morreu — nunca
// o de uma execução viva — e a checagem final de resíduo olha apenas os
// recursos da própria execução.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

export function envObrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

export function docker(args, opts = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", ...opts });
  if (r.error) throw new Error(`docker ${args[0]} falhou: ${r.error.message}`);
  return r;
}

export function dockerOk(args) {
  const r = docker(args);
  if (r.status !== 0) {
    throw new Error(`docker ${args.join(" ")} (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout.trim();
}

export async function comCliente(config, corpo) {
  const cliente = new pg.Client(config);
  await cliente.connect();
  try {
    return await corpo(cliente);
  } finally {
    await cliente.end();
  }
}

export function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fonte única da tag: o próprio docker-compose.yml versionado. */
export function imagemDoCompose(raizRepo) {
  const compose = readFileSync(path.join(raizRepo, "docker-compose.yml"), "utf8");
  const m = /^\s*image:\s*(postgres:\S+)\s*$/m.exec(compose);
  if (!m) throw new Error("tag de imagem postgres não encontrada em docker-compose.yml");
  return m[1];
}

export const LABEL_HOST = "br.techlab-fisio.descartavel.host";
export const LABEL_PID = "br.techlab-fisio.descartavel.pid";

/**
 * Recurso sem dono verificável (sem labels, criado em outro host ou com PID
 * vivo possivelmente reusado pelo sistema) só vira órfão depois deste prazo —
 * nenhuma verificação descartável dura tanto.
 */
export const PRAZO_ORFAO_SEM_DONO_MS = 6 * 60 * 60 * 1000;

function processoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // existe, mas pertence a outro usuário
  }
}

/**
 * Decisão pura: o recurso descartável é órfão?
 * `recurso`: { labels, criadoEm (ms epoch) }; `ambiente`: { host, agora, vivo(pid) }.
 */
export function ehOrfao(recurso, ambiente) {
  const labels = recurso.labels ?? {};
  const pid = Number(labels[LABEL_PID]);
  const donoLocal =
    labels[LABEL_HOST] === ambiente.host && Number.isSafeInteger(pid) && pid > 0;
  if (donoLocal && !ambiente.vivo(pid)) return true;
  const idade = ambiente.agora - recurso.criadoEm;
  return Number.isFinite(idade) && idade > PRAZO_ORFAO_SEM_DONO_MS;
}

function inspecionar(tipo, nome) {
  const r = docker([tipo, "inspect", nome]);
  if (r.status !== 0) return null; // sumiu entre a listagem e a inspeção
  const [dado] = JSON.parse(r.stdout);
  const labels = tipo === "container" ? dado.Config?.Labels : dado.Labels;
  const criado = tipo === "container" ? dado.Created : dado.CreatedAt;
  return { labels: labels ?? {}, criadoEm: Date.parse(criado) };
}

/**
 * Remove containers/volumes ÓRFÃOS do prefixo dado (fail-closed por prefixo).
 * Recurso de execução em andamento — mesmo host e PID do dono vivo — é
 * preservado, para que verificações concorrentes não derrubem umas às outras.
 */
export function removerOrfaos(prefixo, rotulo) {
  const ambiente = { host: os.hostname(), agora: Date.now(), vivo: processoVivo };
  const containers = dockerOk([
    "ps", "-a", "--filter", `name=${prefixo}`, "--format", "{{.Names}}",
  ]);
  for (const nome of containers.split("\n").filter(Boolean)) {
    if (!nome.startsWith(prefixo)) continue; // fail-closed
    const recurso = inspecionar("container", nome);
    if (recurso === null) continue;
    if (!ehOrfao(recurso, ambiente)) {
      console.log(`${rotulo} preservando container de execução em andamento "${nome}"`);
      continue;
    }
    console.log(`${rotulo} removendo container órfão "${nome}"`);
    docker(["rm", "-f", "-v", nome]);
  }
  const volumes = dockerOk(["volume", "ls", "-q", "--filter", `name=${prefixo}`]);
  for (const nome of volumes.split("\n").filter(Boolean)) {
    if (!nome.startsWith(prefixo)) continue; // fail-closed
    const recurso = inspecionar("volume", nome);
    if (recurso === null) continue;
    if (!ehOrfao(recurso, ambiente)) {
      console.log(`${rotulo} preservando volume de execução em andamento "${nome}"`);
      continue;
    }
    console.log(`${rotulo} removendo volume órfão "${nome}"`);
    // Sem -f de propósito: volume ainda montado por container existente não sai.
    docker(["volume", "rm", nome]);
  }
}

/** Credenciais sintéticas obrigatórias do ambiente (.env/.env.example). */
export function credenciaisDoAmbiente() {
  return {
    superuser: envObrigatoria("POSTGRES_SUPERUSER"),
    superuserPwd: envObrigatoria("POSTGRES_SUPERUSER_PASSWORD"),
    bancoApp: envObrigatoria("POSTGRES_DB"),
    roleMigrador: envObrigatoria("TLF_MIGRATOR_USER"),
    migradorPwd: envObrigatoria("TLF_MIGRATOR_PASSWORD"),
    roleApp: envObrigatoria("TLF_APP_USER"),
    appPwd: envObrigatoria("TLF_APP_PASSWORD"),
    bancoShadow: envObrigatoria("TLF_SHADOW_DB"),
  };
}

/**
 * Cria uma instância PostgreSQL LIMPA (container + volume novos, initdb do
 * zero com o bootstrap versionado) e espera prontidão real.
 *
 * Devolve identificadores, porta e URLs de conexão (nunca logadas).
 */
export async function criarInstanciaLimpa({ raizRepo, prefixo, rotulo, cred }) {
  const imagem = imagemDoCompose(raizRepo);
  const sufixo = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const container = `${prefixo}${sufixo}`;
  const volume = `${container}-data`;

  console.log(`${rotulo} criando instância limpa "${container}" (volume "${volume}", imagem ${imagem})...`);
  const labelsDono = [
    "--label", `${LABEL_HOST}=${os.hostname()}`,
    "--label", `${LABEL_PID}=${process.pid}`,
  ];
  dockerOk(["volume", "create", ...labelsDono, volume]);
  // A partir daqui os recursos JÁ EXISTEM: qualquer falha do bootstrap (container
  // que morre no initdb, prontidão que nunca chega, porta não publicada) precisa
  // destruí-los AQUI — o chamador ainda não recebeu os identificadores, e o
  // `finally` dele não teria o que limpar. Sem isto o resíduo só sairia na
  // varredura de órfãos de uma execução posterior.
  try {
    dockerOk([
      "run", "-d",
      "--name", container,
      ...labelsDono,
      "-v", `${volume}:/var/lib/postgresql`,
      "-v", `${path.join(raizRepo, "infra", "postgres", "initdb")}:/docker-entrypoint-initdb.d:ro`,
      "-p", "127.0.0.1::5432",
      "-e", `POSTGRES_USER=${cred.superuser}`,
      "-e", `POSTGRES_PASSWORD=${cred.superuserPwd}`,
      "-e", `POSTGRES_DB=${cred.bancoApp}`,
      "-e", `TLF_MIGRATOR_USER=${cred.roleMigrador}`,
      "-e", `TLF_MIGRATOR_PASSWORD=${cred.migradorPwd}`,
      "-e", `TLF_APP_USER=${cred.roleApp}`,
      "-e", `TLF_APP_PASSWORD=${cred.appPwd}`,
      "-e", `TLF_SHADOW_DB=${cred.bancoShadow}`,
      imagem,
    ]);

    const portaLinha = dockerOk(["port", container, "5432/tcp"])
      .split("\n")
      .find((l) => l.startsWith("127.0.0.1:"));
    if (!portaLinha) throw new Error("porta publicada em 127.0.0.1 não encontrada");
    const porta = Number(portaLinha.slice(portaLinha.lastIndexOf(":") + 1));
    console.log(`${rotulo} instância em 127.0.0.1:${porta} (porta efêmera do Docker)`);

    const conexaoMigrador = {
      host: "127.0.0.1",
      port: porta,
      user: cred.roleMigrador,
      password: cred.migradorPwd,
      database: cred.bancoApp,
      connectionTimeoutMillis: 2_000,
    };
    const inicio = Date.now();
    for (;;) {
      try {
        await comCliente(conexaoMigrador, async () => {});
        break;
      } catch {
        const rodando = dockerOk(["inspect", "-f", "{{.State.Running}}", container]);
        if (rodando !== "true") {
          const logs = docker(["logs", "--tail", "40", container]);
          throw new Error(`container encerrou durante o bootstrap:\n${logs.stdout}\n${logs.stderr}`);
        }
        if (Date.now() - inicio > 180_000) throw new Error("instância não ficou pronta em 180s");
        await aguardar(1_000);
      }
    }
    console.log(`${rotulo} bootstrap initdb concluído (roles "${cred.roleMigrador}"/"${cred.roleApp}").`);

    const urlBase = (role, pwd, banco) =>
      `postgresql://${encodeURIComponent(role)}:${encodeURIComponent(pwd)}` +
      `@127.0.0.1:${porta}/${banco}`;

    return {
      container,
      volume,
      porta,
      imagem,
      conexaoMigrador,
      urlMigrador: urlBase(cred.roleMigrador, cred.migradorPwd, cred.bancoApp),
      urlApp: urlBase(cred.roleApp, cred.appPwd, cred.bancoApp),
      urlShadow: urlBase(cred.roleMigrador, cred.migradorPwd, cred.bancoShadow),
    };
  } catch (erro) {
    console.error(`${rotulo} falha ao criar a instância — destruindo recursos parciais...`);
    destruirInstancia(container, volume, prefixo, rotulo);
    throw erro;
  }
}

/** Prova que o schema `public` está vazio e a major é PostgreSQL 18. */
export async function provarBancoVazio(conexaoMigrador, bancoApp, rotulo) {
  await comCliente(conexaoMigrador, async (c) => {
    const versao = await c.query("SELECT version() AS v");
    if (!/^PostgreSQL 18\./.test(versao.rows[0].v)) {
      throw new Error(`versão inesperada: ${versao.rows[0].v}`);
    }
    const tabelas = await c.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'",
    );
    if (tabelas.rows[0].n !== 0) {
      throw new Error(`banco não está vazio: ${tabelas.rows[0].n} tabela(s) em public`);
    }
    console.log(
      `${rotulo} confirmado: schema public vazio em "${bancoApp}" (${versao.rows[0].v.split(" on ")[0]}).`,
    );
  });
}

/** Reconstrói o schema EXCLUSIVAMENTE por `prisma migrate deploy`. */
export function migrateDeploy(raizRepo, urlMigrador, roleMigrador, rotulo) {
  console.log(`${rotulo} prisma migrate deploy como "${roleMigrador}" na instância limpa...`);
  const deploy = spawnSync(
    process.execPath,
    [path.join(raizRepo, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    {
      cwd: raizRepo,
      env: { ...process.env, MIGRATE_DATABASE_URL: urlMigrador },
      encoding: "utf8",
    },
  );
  if (deploy.status !== 0) {
    throw new Error(
      `prisma migrate deploy falhou (exit ${deploy.status}):\n${deploy.stdout}\n${deploy.stderr}`,
    );
  }
  const resumo = deploy.stdout
    .split("\n").map((l) => l.trim())
    .filter((l) => /migration/i.test(l)).join(" | ");
  console.log(`${rotulo} migrate deploy ok: ${resumo}`);
}

/**
 * Destrói container e volume (fail-closed por prefixo) e confirma 0 resíduos
 * DESTA execução — recursos de execuções concorrentes com o mesmo prefixo não
 * contam como resíduo.
 * Devolve `true` se restou resíduo (o chamador decide o exit code).
 */
export function destruirInstancia(container, volume, prefixo, rotulo) {
  if (!container.startsWith(prefixo) || !volume.startsWith(prefixo)) {
    throw new Error(`${rotulo} recusa destruir recurso fora do prefixo "${prefixo}"`);
  }
  console.log(`${rotulo} destruindo "${container}" e volume "${volume}"...`);
  docker(["rm", "-f", "-v", container]);
  docker(["volume", "rm", "-f", volume]);
  const existe = (saida, nome) => saida.split("\n").some((l) => l.trim() === nome);
  const restoC = existe(
    dockerOk(["ps", "-a", "--filter", `name=${container}`, "--format", "{{.Names}}"]),
    container,
  ) ? container : "";
  const restoV = existe(dockerOk(["volume", "ls", "-q", "--filter", `name=${volume}`]), volume)
    ? volume
    : "";
  if (restoC !== "" || restoV !== "") {
    console.error(`${rotulo} AVISO: resíduo descartável detectado: ${restoC} ${restoV}`);
    return true;
  }
  console.log(`${rotulo} 0 containers e 0 volumes descartáveis remanescentes desta execução.`);
  return false;
}
