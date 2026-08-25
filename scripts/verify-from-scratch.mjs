// TechLab Fisio — E-15 — Reconstrução a partir de banco vazio
// (docs/08 §13 `E-15`; política de migrations §10, ponto 7).
//
// PROVA CENTRAL: uma instância PostgreSQL 18 LIMPA (container + volume novos,
// initdb do zero) é reconstruída EXCLUSIVAMENTE por:
//
//   1. bootstrap versionado de roles/bancos (infra/postgres/initdb/01-roles.sh,
//      executado pelo entrypoint da imagem oficial — mesmo bootstrap do
//      desenvolvimento e do CI; nenhum passo manual);
//   2. `prisma migrate deploy` — replay integral do histórico versionado,
//      inclusive `CREATE EXTENSION btree_gist` (nenhuma criação manual);
//   3. verificações de catálogo dos objetos das Categorias B e C (nomes
//      determinísticos das migrations E-04..E-11, já registrados em docs/08
//      REV. 8–10) — a Categoria A é exercitada pela própria suíte;
//   4. suíte integral de integração (Jest 30 + ESM + Prisma Client 7 +
//      adapter-pg) apontada para a instância reconstruída — o globalSetup da
//      E-13 cria seu banco descartável DENTRO dela e replica o histórico de
//      novo, sem nenhuma modificação da infraestrutura de testes;
//   5. limpeza: container e volume descartáveis destruídos SEMPRE (finally),
//      inclusive em falha.
//
// PROIBIDO e AUSENTE por construção: `db push`, `db pull`, `migrate reset`,
// SQL ad hoc pós-deploy, criação manual de constraint/índice/trigger/função/
// extensão, edição de migration, dependência do volume de desenvolvimento.
//
// ISOLAMENTO FAIL-CLOSED:
//   - container `techlab-fisio-e15-<sufixo>` e volume homônimo `-data`,
//     porta efêmera em 127.0.0.1 atribuída pelo Docker — nunca a instância
//     de desenvolvimento; o script só destrói recursos com esse prefixo;
//   - nenhuma senha e nenhuma URL completa é impressa (somente roles, banco,
//     host/porta e nomes de recursos);
//   - a suíte herda as guardas da E-13 (prefixo `techlab_fisio_it_`).
//
// NÃO é a E-16: nenhum golden schema, nenhum lint de migration, nenhum teste
// negativo de guarda, nenhum `migrate diff` — a tríade anti-drift/V-04
// pertence à etapa própria. Aqui se prova RECONSTRUÇÃO, não preservação.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const PREFIXO_E15 = "techlab-fisio-e15-";
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function falhar(mensagem) {
  throw new Error(`[e15] ${mensagem}`);
}

function envObrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) falhar(`variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

function docker(args, opts = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", ...opts });
  if (r.error) falhar(`docker ${args[0]} falhou: ${r.error.message}`);
  return r;
}

function dockerOk(args) {
  const r = docker(args);
  if (r.status !== 0) {
    falhar(`docker ${args.join(" ")} (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout.trim();
}

async function comCliente(config, corpo) {
  const cliente = new pg.Client(config);
  await cliente.connect();
  try {
    return await corpo(cliente);
  } finally {
    await cliente.end();
  }
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Objetos das Categorias B e C — nomes determinísticos (C-6) das migrations
// E-04..E-11; listas conferem com os registros de docs/08 REV. 8, 9 e 10.
// ---------------------------------------------------------------------------
const EXTENSAO = "btree_gist";
const EXCLUSIONS = ["ex_agendamento_profissional", "ex_agendamento_paciente"];
const INDICES_PARCIAIS_UNICOS = [
  "ux_movimento_sessao_consumo_atendimento_pacote",
  "ux_reserva_sessao_ativa_agendamento",
];
const INDICES_PARCIAIS_SIMPLES = [
  "ix_reserva_sessao_ativa_pacote",
  "ix_agendamento_pacote",
  "ix_pacote_validade_ativa",
  "ix_cobranca_data_referencia_ativa",
];
const CHECKS = [
  "ck_agendamento_intervalo",
  "ck_agendamento_modalidade_pacote",
  "ck_bloqueio_agenda_intervalo",
  "ck_movimento_sessao_quantidade_positiva",
  "ck_movimento_sessao_tipo_atendimento",
  "ck_movimento_sessao_consumo_unitario",
  "ck_movimento_sessao_justificativa_ajuste",
  "ck_reserva_sessao_encerramento",
  "ck_reserva_sessao_consumo_movimento",
  "ck_pacote_quantidade_positiva",
  "ck_pacote_cancelamento",
  "ck_cobranca_valor_bruto_nao_negativo",
  "ck_cobranca_valor_desconto_nao_negativo",
  "ck_cobranca_valor_liquido_nao_negativo",
  "ck_cobranca_origem",
  "ck_pagamento_valor_positivo",
  "ck_paciente_cpf_formato",
  "ck_registro_clinico_finalizacao",
  "ck_retificacao_clinica_efetivacao",
  "ck_retificacao_clinica_justificativa",
  "ck_horario_funcionamento_intervalo",
  "ck_horario_funcionamento_dia_semana",
  "ck_disponibilidade_profissional_intervalo",
  "ck_disponibilidade_profissional_dia_semana",
  "ck_sessao_autenticacao_expiracao",
];
const TRIGGERS = [
  { nome: "trg_registro_clinico_imutavel_finalizado", tabela: "registro_clinico" },
  { nome: "trg_retificacao_clinica_imutavel_efetivada", tabela: "retificacao_clinica" },
];
const FUNCOES = [
  "fn_registro_clinico_bloquear_finalizado",
  "fn_retificacao_clinica_bloquear_efetivada",
];
const TABELAS_APPEND_ONLY = [
  "evento_auditoria",
  "movimento_sessao",
  "pagamento",
  "estorno",
  "historico_agendamento",
];

function imagemDoCompose() {
  // Fonte única da tag: o próprio docker-compose.yml versionado.
  const compose = readFileSync(path.join(raizRepo, "docker-compose.yml"), "utf8");
  const m = /^\s*image:\s*(postgres:\S+)\s*$/m.exec(compose);
  if (!m) falhar("tag de imagem postgres não encontrada em docker-compose.yml");
  return m[1];
}

function contarMigrationsVersionadas() {
  const dir = path.join(raizRepo, "packages", "database", "prisma", "migrations");
  const entradas = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const e of entradas) {
    readFileSync(path.join(dir, e.name, "migration.sql"), "utf8"); // deve existir
  }
  if (entradas.length === 0) falhar("nenhuma migration versionada encontrada");
  return entradas.length;
}

function removerOrfaos() {
  const containers = dockerOk([
    "ps", "-a", "--filter", `name=${PREFIXO_E15}`, "--format", "{{.Names}}",
  ]);
  for (const nome of containers.split("\n").filter(Boolean)) {
    if (!nome.startsWith(PREFIXO_E15)) continue; // fail-closed
    console.log(`[e15] removendo container órfão "${nome}"`);
    docker(["rm", "-f", "-v", nome]);
  }
  const volumes = dockerOk(["volume", "ls", "-q", "--filter", `name=${PREFIXO_E15}`]);
  for (const nome of volumes.split("\n").filter(Boolean)) {
    if (!nome.startsWith(PREFIXO_E15)) continue; // fail-closed
    console.log(`[e15] removendo volume órfão "${nome}"`);
    docker(["volume", "rm", "-f", nome]);
  }
}

async function main() {
  // `.env` local (dev) ou copiado de `.env.example` (CI). dotenv nunca
  // sobrescreve variável já definida no ambiente.
  dotenv.config({ path: path.join(raizRepo, ".env"), quiet: true });

  const superuser = envObrigatoria("POSTGRES_SUPERUSER");
  const superuserPwd = envObrigatoria("POSTGRES_SUPERUSER_PASSWORD");
  const bancoApp = envObrigatoria("POSTGRES_DB");
  const roleMigrador = envObrigatoria("TLF_MIGRATOR_USER");
  const migradorPwd = envObrigatoria("TLF_MIGRATOR_PASSWORD");
  const roleApp = envObrigatoria("TLF_APP_USER");
  const appPwd = envObrigatoria("TLF_APP_PASSWORD");
  const bancoShadow = envObrigatoria("TLF_SHADOW_DB");

  const imagem = imagemDoCompose();
  const totalMigrations = contarMigrationsVersionadas();
  const sufixo = `${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const container = `${PREFIXO_E15}${sufixo}`;
  const volume = `${container}-data`;

  console.log(`[e15] imagem: ${imagem} · migrations versionadas: ${totalMigrations}`);
  removerOrfaos();

  let criado = false;
  try {
    // -----------------------------------------------------------------------
    // 1. Instância LIMPA: container + volume novos; initdb roda do zero.
    // -----------------------------------------------------------------------
    console.log(`[e15] criando instância limpa "${container}" (volume "${volume}")...`);
    dockerOk([
      "run", "-d",
      "--name", container,
      "-v", `${volume}:/var/lib/postgresql`,
      "-v", `${path.join(raizRepo, "infra", "postgres", "initdb")}:/docker-entrypoint-initdb.d:ro`,
      "-p", "127.0.0.1::5432",
      "-e", `POSTGRES_USER=${superuser}`,
      "-e", `POSTGRES_PASSWORD=${superuserPwd}`,
      "-e", `POSTGRES_DB=${bancoApp}`,
      "-e", `TLF_MIGRATOR_USER=${roleMigrador}`,
      "-e", `TLF_MIGRATOR_PASSWORD=${migradorPwd}`,
      "-e", `TLF_APP_USER=${roleApp}`,
      "-e", `TLF_APP_PASSWORD=${appPwd}`,
      "-e", `TLF_SHADOW_DB=${bancoShadow}`,
      imagem,
    ]);
    criado = true;

    const portaLinha = dockerOk(["port", container, "5432/tcp"])
      .split("\n")
      .find((l) => l.startsWith("127.0.0.1:"));
    if (!portaLinha) falhar("porta publicada em 127.0.0.1 não encontrada");
    const porta = Number(portaLinha.slice(portaLinha.lastIndexOf(":") + 1));
    console.log(`[e15] instância em 127.0.0.1:${porta} (porta efêmera do Docker)`);

    // Pronta quando aceitar conexão TCP como tlf_migrator: a role só existe
    // após o initdb concluir e o servidor definitivo subir. Espera por
    // condição real, com teto explícito.
    const conexaoMigrador = {
      host: "127.0.0.1",
      port: porta,
      user: roleMigrador,
      password: migradorPwd,
      database: bancoApp,
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
          falhar(`container encerrou durante o bootstrap:\n${logs.stdout}\n${logs.stderr}`);
        }
        if (Date.now() - inicio > 180_000) falhar("instância não ficou pronta em 180s");
        await aguardar(1_000);
      }
    }
    console.log(`[e15] bootstrap initdb concluído (roles "${roleMigrador}"/"${roleApp}").`);

    // -----------------------------------------------------------------------
    // 2. Prova de banco realmente VAZIO antes do deploy.
    // -----------------------------------------------------------------------
    await comCliente(conexaoMigrador, async (c) => {
      const versao = await c.query("SELECT version() AS v");
      if (!/^PostgreSQL 18\./.test(versao.rows[0].v)) {
        falhar(`versão inesperada: ${versao.rows[0].v}`);
      }
      const tabelas = await c.query(
        "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'",
      );
      if (tabelas.rows[0].n !== 0) {
        falhar(`banco não está vazio: ${tabelas.rows[0].n} tabela(s) em public`);
      }
      console.log(`[e15] confirmado: schema public vazio em "${bancoApp}" (${versao.rows[0].v.split(" on ")[0]}).`);
    });

    // -----------------------------------------------------------------------
    // 3. Reconstrução: APENAS `prisma migrate deploy` (histórico versionado).
    // -----------------------------------------------------------------------
    const urlMigrador =
      `postgresql://${encodeURIComponent(roleMigrador)}:${encodeURIComponent(migradorPwd)}` +
      `@127.0.0.1:${porta}/${bancoApp}`;
    const urlApp =
      `postgresql://${encodeURIComponent(roleApp)}:${encodeURIComponent(appPwd)}` +
      `@127.0.0.1:${porta}/${bancoApp}`;

    console.log(`[e15] prisma migrate deploy como "${roleMigrador}" na instância limpa...`);
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
      falhar(`prisma migrate deploy falhou (exit ${deploy.status}):\n${deploy.stdout}\n${deploy.stderr}`);
    }
    const resumo = deploy.stdout
      .split("\n").map((l) => l.trim())
      .filter((l) => /migration/i.test(l)).join(" | ");
    console.log(`[e15] migrate deploy ok: ${resumo}`);

    // -----------------------------------------------------------------------
    // 4. Verificações de catálogo — todas as migrations aplicadas e todos os
    //    objetos das Categorias B/C presentes, sem qualquer intervenção.
    // -----------------------------------------------------------------------
    await comCliente(conexaoMigrador, async (c) => {
      const m = await c.query(`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE finished_at IS NULL)::int AS pendentes
        FROM "_prisma_migrations"
      `);
      if (m.rows[0].total !== totalMigrations || m.rows[0].pendentes !== 0) {
        falhar(
          `histórico incompleto: aplicadas ${m.rows[0].total}/${totalMigrations}, ` +
          `pendentes ${m.rows[0].pendentes}`,
        );
      }
      console.log(`[e15] ${m.rows[0].total}/${totalMigrations} migrations aplicadas, 0 pendentes.`);

      const ext = await c.query("SELECT 1 FROM pg_extension WHERE extname = $1", [EXTENSAO]);
      if (ext.rowCount !== 1) falhar(`extensão ausente: ${EXTENSAO}`);

      const excl = await c.query(
        "SELECT conname FROM pg_constraint WHERE contype = 'x' AND conname = ANY($1)",
        [EXCLUSIONS],
      );
      if (excl.rowCount !== EXCLUSIONS.length) {
        falhar(`exclusion constraints ausentes: esperadas ${EXCLUSIONS.join(", ")}`);
      }

      const idx = await c.query(
        `SELECT i.indexrelid::regclass::text AS nome, i.indisunique
         FROM pg_index i
         WHERE i.indpred IS NOT NULL
           AND i.indexrelid::regclass::text = ANY($1)`,
        [[...INDICES_PARCIAIS_UNICOS, ...INDICES_PARCIAIS_SIMPLES]],
      );
      const porNome = new Map(idx.rows.map((r) => [r.nome, r.indisunique]));
      for (const nome of INDICES_PARCIAIS_UNICOS) {
        if (porNome.get(nome) !== true) falhar(`índice único parcial ausente/errado: ${nome}`);
      }
      for (const nome of INDICES_PARCIAIS_SIMPLES) {
        if (porNome.get(nome) !== false) falhar(`índice parcial ausente/errado: ${nome}`);
      }

      const cks = await c.query(
        "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname = ANY($1)",
        [CHECKS],
      );
      if (cks.rowCount !== CHECKS.length) {
        const presentes = new Set(cks.rows.map((r) => r.conname));
        falhar(`CHECKs ausentes: ${CHECKS.filter((n) => !presentes.has(n)).join(", ")}`);
      }

      for (const t of TRIGGERS) {
        const trg = await c.query(
          `SELECT 1 FROM pg_trigger WHERE tgname = $1 AND tgrelid = $2::regclass`,
          [t.nome, t.tabela],
        );
        if (trg.rowCount !== 1) falhar(`trigger ausente: ${t.nome} em ${t.tabela}`);
      }
      const fns = await c.query(
        "SELECT proname FROM pg_proc WHERE proname = ANY($1)",
        [FUNCOES],
      );
      if (fns.rowCount !== FUNCOES.length) falhar(`funções de trigger ausentes`);

      const gerada = await c.query(`
        SELECT attgenerated FROM pg_attribute
        WHERE attrelid = 'cobranca'::regclass AND attname = 'valor_liquido'
      `);
      if (gerada.rows[0]?.attgenerated !== "s") {
        falhar("cobranca.valor_liquido não é coluna gerada STORED");
      }

      for (const tabela of TABELAS_APPEND_ONLY) {
        const priv = await c.query(
          `SELECT has_table_privilege($1, $2, 'SELECT') AS s,
                  has_table_privilege($1, $2, 'INSERT') AS i,
                  has_table_privilege($1, $2, 'UPDATE') AS u,
                  has_table_privilege($1, $2, 'DELETE') AS d`,
          [roleApp, tabela],
        );
        const p = priv.rows[0];
        if (!(p.s && p.i && !p.u && !p.d)) {
          falhar(`privilégios append-only errados em ${tabela}: ${JSON.stringify(p)}`);
        }
      }
      console.log(
        `[e15] catálogo ok: extensão, ${EXCLUSIONS.length} exclusion, ` +
        `${INDICES_PARCIAIS_UNICOS.length + INDICES_PARCIAIS_SIMPLES.length} índices parciais, ` +
        `${CHECKS.length} CHECKs, ${TRIGGERS.length} triggers + ${FUNCOES.length} funções, ` +
        `coluna gerada, append-only (${TABELAS_APPEND_ONLY.length} tabelas).`,
      );
    });

    // -----------------------------------------------------------------------
    // 5. Nenhuma migration (nem schema) modificada pelo processo.
    // -----------------------------------------------------------------------
    const sujo = spawnSync(
      "git",
      ["status", "--porcelain", "--", "packages/database/prisma"],
      { cwd: raizRepo, encoding: "utf8" },
    );
    if (sujo.status !== 0 || sujo.stdout.trim() !== "") {
      falhar(`packages/database/prisma foi modificado durante a prova:\n${sujo.stdout}`);
    }
    console.log("[e15] schema.prisma e migrations intactos (git status limpo).");

    // -----------------------------------------------------------------------
    // 6. Suíte INTEGRAL de integração contra a instância reconstruída.
    //    O globalSetup da E-13 cria o banco descartável `techlab_fisio_it_%`
    //    DENTRO desta instância e replica o histórico novamente — nenhuma
    //    alteração na infraestrutura de testes.
    // -----------------------------------------------------------------------
    console.log("[e15] executando a suíte integral de integração na instância reconstruída...");
    const suite = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        path.join(raizRepo, "node_modules", "jest", "bin", "jest.js"),
        "--config", path.join(raizRepo, "packages", "database", "jest.config.mjs"),
      ],
      {
        cwd: raizRepo,
        env: { ...process.env, DATABASE_URL: urlApp, MIGRATE_DATABASE_URL: urlMigrador },
        stdio: "inherit",
      },
    );
    if (suite.status !== 0) falhar(`suíte de integração falhou (exit ${suite.status})`);

    // -----------------------------------------------------------------------
    // 7. Zero resíduos dentro da instância (bancos descartáveis da suíte).
    // -----------------------------------------------------------------------
    await comCliente(conexaoMigrador, async (c) => {
      const resto = await c.query(
        "SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'techlab_fisio_it_%'",
      );
      if (resto.rows[0].n !== 0) {
        falhar(`${resto.rows[0].n} banco(s) descartável(is) da suíte remanescente(s)`);
      }
    });
    console.log("[e15] 0 bancos techlab_fisio_it_% remanescentes na instância.");

    console.log("[e15] PROVA CONCLUÍDA: histórico de migrations é autossuficiente.");
  } finally {
    // -----------------------------------------------------------------------
    // 8. Limpeza SEMPRE — inclusive em falha.
    // -----------------------------------------------------------------------
    if (criado) {
      console.log(`[e15] destruindo "${container}" e volume "${volume}"...`);
      docker(["rm", "-f", "-v", container]);
      docker(["volume", "rm", "-f", volume]);
      const restoC = dockerOk(["ps", "-a", "--filter", `name=${PREFIXO_E15}`, "--format", "{{.Names}}"]);
      const restoV = dockerOk(["volume", "ls", "-q", "--filter", `name=${PREFIXO_E15}`]);
      if (restoC.trim() !== "" || restoV.trim() !== "") {
        console.error(`[e15] AVISO: resíduo descartável detectado: ${restoC} ${restoV}`);
        process.exitCode = 1;
      } else {
        console.log("[e15] 0 containers e 0 volumes descartáveis remanescentes.");
      }
    }
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
