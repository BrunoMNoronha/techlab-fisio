// TechLab Fisio — Etapa 2.3D-B / F5 — o CLI COMPILADO, em processos reais.
//
// Esta suíte não importa serviço algum: ela executa `dist/provisionamento/cli.js`
// como processo separado, exatamente como o operador faz, contra o mesmo
// PostgreSQL descartável das demais suítes de integração. É a única forma de
// medir de fato: precedência da senha, encerramento por sinal, códigos de
// saída, fronteira de erros e a corrida ENTRE PROCESSOS que as revisões
// independentes reproduziram.
//
// PRÉ-REQUISITO: `dist/` construído (`npm run build`). Sem ele a suíte é
// PULADA de forma explícita — nunca silenciosamente aprovada.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import { criarClientePersistencia } from "@techlab-fisio/database";
import type { ClientePersistencia } from "@techlab-fisio/database";

import { limparTabelasDeDominio, urlObrigatoria } from "./helpers-integracao.js";

const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(RAIZ_API, "dist", "provisionamento", "cli.js");
const TEM_DIST = existsSync(CLI);

const SENHA = "senha-cli-sintetica-f5";
const JUSTIFICATIVA = "chamado SINTETICO-CLI-001";
const EMAIL = "admin.cli@sintetico.local";

let cliente: ClientePersistencia;

beforeAll(() => {
  cliente = criarClientePersistencia({ url: urlObrigatoria("DATABASE_URL") });
});

afterEach(async () => {
  await limparTabelasDeDominio();
});

interface Execucao {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function ambiente(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: urlObrigatoria("DATABASE_URL"),
    TLF_BOOTSTRAP_ADMIN_EMAIL: EMAIL,
    TLF_BOOTSTRAP_ADMIN_NOME: "Administrador CLI",
    TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA: JUSTIFICATIVA,
    // Encurta a espera por EOF para tornar o cenário de pipe ocioso rápido.
    TLF_BOOTSTRAP_STDIN_TIMEOUT_MS: "1500",
  };
  delete base["TLF_BOOTSTRAP_ADMIN_SENHA"];
  for (const [chave, valor] of Object.entries(extra)) {
    if (valor === undefined) delete base[chave];
    else base[chave] = valor;
  }
  return base;
}

function rodar(
  argumentos: readonly string[],
  opcoes: { entrada?: string | null; env?: Record<string, string | undefined> } = {},
): Execucao {
  const resultado = spawnSync(process.execPath, [CLI, ...argumentos], {
    cwd: RAIZ_API,
    env: ambiente(opcoes.env),
    encoding: "utf8",
    input: opcoes.entrada ?? undefined,
    timeout: 60_000,
  });
  return {
    status: resultado.status,
    stdout: resultado.stdout ?? "",
    stderr: resultado.stderr ?? "",
  };
}

async function estado(): Promise<{
  papeis: number;
  permissoes: number;
  vinculos: number;
  usuarios: number;
  administradores: number;
  eventos: number;
}> {
  return {
    papeis: await cliente.papel.count(),
    permissoes: await cliente.permissao.count(),
    vinculos: await cliente.papelPermissao.count(),
    usuarios: await cliente.usuario.count(),
    administradores: await cliente.usuarioPapel.count({
      where: { papel: { codigo: "ADMINISTRADOR" } },
    }),
    eventos: await cliente.eventoAuditoria.count(),
  };
}

const talvez = TEM_DIST ? describe : describe.skip;

/**
 * Sinais POSIX não existem no Windows: `SIGTERM` nunca é entregue ao handler
 * do Node (documentado pelo próprio Node), e `child.kill()` recorre a
 * `TerminateProcess`, que mata o processo sem executar handler algum. O
 * contrato de encerramento gracioso, portanto, só é MEDÍVEL em POSIX — que é
 * a plataforma de execução real (a CI roda em `ubuntu-latest` e o alvo de
 * implantação é Linux).
 *
 * O bloco é PULADO no Windows de forma EXPLÍCITA e visível na saída do Jest,
 * nunca silenciosamente aprovado. A implementação em si não é condicional:
 * `cli.ts` registra os handlers em qualquer plataforma.
 */
const EH_WINDOWS = process.platform === "win32";
const talvezSinais = TEM_DIST && !EH_WINDOWS ? describe : describe.skip;

talvez("CLI compilado — comandos e códigos de saída", () => {
  it("sem comando e com comando desconhecido: uso inválido (2) e texto de uso", () => {
    for (const argumentos of [[], ["xpto"]]) {
      const r = rodar(argumentos);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("Uso: node dist/provisionamento/cli.js");
      expect(r.stdout).toBe("");
    }
  });

  it("opção desconhecida é recusada com uso inválido (2)", () => {
    const r = rodar(["seed", "--forcar"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("OPCAO_DESCONHECIDA");
  });

  it("`seed` sobre banco vazio: saída 0 e contagens canônicas", async () => {
    const r = rodar(["seed"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("papeis +4");
    expect(r.stdout).toContain("permissoes +29");
    expect(r.stdout).toContain("associacoes +37");
    expect(await estado()).toMatchObject({ papeis: 4, permissoes: 29, vinculos: 37 });
  });

  it("`seed` repetido: `JA_CONFORME` e nenhuma escrita", async () => {
    rodar(["seed"]);
    const r = rodar(["seed"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("JA_CONFORME");
    expect(await estado()).toMatchObject({ papeis: 4, permissoes: 29, vinculos: 37 });
  });
});

talvez("CLI compilado — `seed` NÃO depende do runtime Argon2", () => {
  it("`seed` conclui mesmo quando o addon nativo do Argon2 falha ao carregar", async () => {
    // Sabotagem determinística: um `NODE_OPTIONS` que injeta um módulo cujo
    // carregamento derruba qualquer `require` de `argon2`. Se `seed` tocasse
    // o Argon2 — direta ou indiretamente — o processo morreria aqui.
    const sabotador = path.join(RAIZ_API, "test", "integration", "sabota-argon2.cjs");
    const r = rodar(["seed"], {
      env: { NODE_OPTIONS: `--require ${JSON.stringify(sabotador)}` },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("papeis +4");
    expect(await estado()).toMatchObject({ papeis: 4, permissoes: 29, vinculos: 37 });
  });

  it("controle positivo — `bootstrap-admin` REALMENTE usa o Argon2 sabotado e falha", async () => {
    // Sem este controle, o teste acima passaria mesmo que a sabotagem não
    // funcionasse.
    rodar(["seed"]);
    const sabotador = path.join(RAIZ_API, "test", "integration", "sabota-argon2.cjs");
    const r = rodar(["bootstrap-admin"], {
      env: {
        NODE_OPTIONS: `--require ${JSON.stringify(sabotador)}`,
        TLF_BOOTSTRAP_ADMIN_SENHA: SENHA,
      },
    });
    expect(r.status).not.toBe(0);
    expect(await estado()).toMatchObject({ usuarios: 0, administradores: 0 });
  });
});

talvez("CLI compilado — entrada da senha", () => {
  it("senha por stdin cria o Administrador", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], { entrada: `${SENHA}\n` });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("USUARIO_CRIADO");
    expect(await estado()).toMatchObject({ usuarios: 1, administradores: 1, eventos: 1 });
  });

  it("senha por ambiente tem PRECEDÊNCIA e não consome o stdin", async () => {
    rodar(["seed"]);
    // stdin traria outra senha; a variável vence e o pipe nem é lido.
    const r = rodar(["bootstrap-admin"], {
      entrada: "senha-do-stdin-que-deve-ser-ignorada\n",
      env: { TLF_BOOTSTRAP_ADMIN_SENHA: SENHA },
    });
    expect(r.status).toBe(0);
    const usuario = await cliente.usuario.findFirstOrThrow();
    // Prova de qual senha entrou: só a do ambiente verifica contra o digest.
    const argon2 = await import("argon2");
    expect(await argon2.verify(usuario.senhaHash, SENHA)).toBe(true);
    expect(
      await argon2.verify(usuario.senhaHash, "senha-do-stdin-que-deve-ser-ignorada"),
    ).toBe(false);
  });

  it("pipe ABERTO e OCIOSO com a variável definida NÃO bloqueia", async () => {
    rodar(["seed"]);
    // Pipe aberto que nunca recebe dados nem EOF durante a medição.
    const filho = spawn(process.execPath, [CLI, "bootstrap-admin"], {
      cwd: RAIZ_API,
      env: ambiente({ TLF_BOOTSTRAP_ADMIN_SENHA: SENHA }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const codigo = await new Promise<number | null>((resolver) => {
      const guarda = setTimeout(() => resolver(null), 30_000);
      filho.on("exit", (c) => {
        clearTimeout(guarda);
        resolver(c);
      });
    });
    filho.stdin.end();
    expect(codigo).toBe(0);
    expect(await estado()).toMatchObject({ administradores: 1 });
  });

  it("pipe ABERTO e OCIOSO sem a variável: TETO DE TEMPO, não travamento", async () => {
    rodar(["seed"]);
    // `spawnSync` FECHA o stdin quando não há `input`, e por isso não serve
    // para medir este caminho (mediria EOF imediato). Aqui o pipe é aberto e
    // deliberadamente NUNCA recebe dados nem EOF: o processo deve terminar
    // pelo teto de tempo (1500 ms neste ambiente), não ficar pendurado.
    const filho = spawn(process.execPath, [CLI, "bootstrap-admin"], {
      cwd: RAIZ_API,
      env: ambiente(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let erro = "";
    filho.stderr.on("data", (d) => (erro += String(d)));
    const inicio = Date.now();
    const codigo = await new Promise<number | null>((resolver) => {
      const guarda = setTimeout(() => resolver(null), 20_000);
      filho.on("exit", (c) => {
        clearTimeout(guarda);
        resolver(c);
      });
    });
    const decorrido = Date.now() - inicio;
    filho.stdin.end();

    expect(codigo).toBe(1);
    expect(erro).toContain("STDIN_SEM_EOF");
    // Terminou por teto de tempo — nem instantâneo, nem pendurado.
    expect(decorrido).toBeGreaterThanOrEqual(1000);
    expect(decorrido).toBeLessThan(20_000);
    expect(await estado()).toMatchObject({ usuarios: 0, eventos: 0 });
  });

  it("stdin VAZIO sem a variável: erro controlado, nada escrito", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], { entrada: "" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("SENHA_NAO_FORNECIDA");
    expect(await estado()).toMatchObject({ usuarios: 0, eventos: 0 });
  });

  it("CRLF final é tolerado; a senha pretendida é a persistida", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], { entrada: `${SENHA}\r\n` });
    expect(r.status).toBe(0);
    const usuario = await cliente.usuario.findFirstOrThrow();
    const argon2 = await import("argon2");
    expect(await argon2.verify(usuario.senhaHash, SENHA)).toBe(true);
  });

  it("duas quebras finais são RECUSADAS — não persistem senha diferente", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], { entrada: `${SENHA}\n\n` });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("SENHA_COM_CARACTERE_DE_CONTROLE");
    expect(await estado()).toMatchObject({ usuarios: 0, eventos: 0 });
  });

  it("caractere de controle embutido é recusado", async () => {
    rodar(["seed"]);
    for (const entrada of [`abc\ndef\n`, `abc\u0000def\n`, `abc\u0007def\n`]) {
      const r = rodar(["bootstrap-admin"], { entrada });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("SENHA_COM_CARACTERE_DE_CONTROLE");
    }
    expect(await estado()).toMatchObject({ usuarios: 0 });
  });

  it("espaços iniciais e finais são PRESERVADOS como parte da senha", async () => {
    rodar(["seed"]);
    const comEspacos = `  ${SENHA}  `;
    const r = rodar(["bootstrap-admin"], { entrada: `${comEspacos}\n` });
    expect(r.status).toBe(0);
    const usuario = await cliente.usuario.findFirstOrThrow();
    const argon2 = await import("argon2");
    expect(await argon2.verify(usuario.senhaHash, comEspacos)).toBe(true);
    expect(await argon2.verify(usuario.senhaHash, SENHA)).toBe(false);
  });

  it("senha por `argv` NÃO é aceita — o argumento é recusado como opção", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin", SENHA], { entrada: "" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("OPCAO_DESCONHECIDA");
    expect(r.stderr).not.toContain(SENHA);
    expect(await estado()).toMatchObject({ usuarios: 0 });
  });

  it("variáveis obrigatórias ausentes: o NOME aparece, o valor nunca", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], {
      entrada: `${SENHA}\n`,
      env: { TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA: undefined },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("VARIAVEL_OBRIGATORIA_AUSENTE");
    expect(r.stderr).toContain("TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA");
    expect(await estado()).toMatchObject({ usuarios: 0 });
  });
});

talvez("CLI compilado — fronteira de erros e sigilo da saída", () => {
  it("falha de infraestrutura NÃO vaza detalhe de Prisma/PostgreSQL", () => {
    const r = rodar(["seed"], {
      env: { DATABASE_URL: "postgresql://u:p@127.0.0.1:1/naoexiste" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("FALHA_INESPERADA");
    expect(r.stderr).toContain("incidente");
    // Nada de SQL, modelo, índice, driver, URL ou credencial.
    for (const proibido of [
      "prisma",
      "Prisma",
      "SELECT",
      "INSERT",
      "usuario_papel",
      "postgresql://",
      "naoexiste",
      "ECONNREFUSED",
      "127.0.0.1",
    ]) {
      expect(r.stderr).not.toContain(proibido);
    }
  });

  it("nenhuma saída contém senha, e-mail, nome, digest ou justificativa", async () => {
    rodar(["seed"]);
    const r = rodar(["bootstrap-admin"], { entrada: `${SENHA}\n` });
    const saida = `${r.stdout}${r.stderr}`;
    for (const proibido of [SENHA, EMAIL, "Administrador CLI", JUSTIFICATIVA, "$argon2id$"]) {
      expect(saida).not.toContain(proibido);
    }
    // E a justificativa ESTÁ na trilha de auditoria, onde deve estar.
    const evento = await cliente.eventoAuditoria.findFirstOrThrow();
    expect(evento.justificativa).toBe(JUSTIFICATIVA);
    expect(evento.atorUsuarioId).toBeNull();
    expect(evento.contexto).toBeNull();
  });

  it("recusa de conflito é mensagem de conjunto fechado", async () => {
    rodar(["seed"]);
    rodar(["bootstrap-admin"], { entrada: `${SENHA}\n` });
    const r = rodar(["bootstrap-admin"], {
      entrada: `${SENHA}\n`,
      env: { TLF_BOOTSTRAP_ADMIN_EMAIL: "outro@sintetico.local" },
    });
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe("provisionamento: ADMINISTRADOR_JA_EXISTE");
    expect(await estado()).toMatchObject({ administradores: 1, eventos: 1 });
  });
});

talvez("CLI compilado — modo estrito do seed", () => {
  it("banco conforme: modo estrito termina com 0", () => {
    rodar(["seed"]);
    const r = rodar(["seed", "--estrito"]);
    expect(r.status).toBe(0);
  });

  it("banco divergente: saída 3, relatório, e NADA é removido", async () => {
    rodar(["seed"]);
    const papel = await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
    const permissao = await cliente.permissao.findUniqueOrThrow({
      where: { codigo: "pacotes.ajustar_sessao" },
    });
    await cliente.papelPermissao.create({
      data: { papelId: papel.id, permissaoId: permissao.id },
    });
    await cliente.papel.create({ data: { codigo: "SUPERADMIN", nome: "Super" } });

    const r = rodar(["seed", "--estrito"]);
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("DIVERGENCIAS");
    expect(r.stdout).toContain("papeis_desconhecidos=1");
    expect(r.stdout).toContain("GESTOR -> pacotes.ajustar_sessao");
    // Códigos de terceiros NÃO são ecoados.
    expect(r.stdout).not.toContain("SUPERADMIN");
    // Não destrutivo: tudo continua lá.
    expect(await estado()).toMatchObject({ papeis: 5, vinculos: 38 });
  });

  it("banco PARCIAL e divergente: completa a matriz, preserva excedentes e não promete read-only", async () => {
    rodar(["seed"]);
    const papel = await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
    const permissao = await cliente.permissao.findUniqueOrThrow({
      where: { codigo: "pacientes.localizar" },
    });
    await cliente.papel.update({
      where: { id: papel.id },
      data: { nome: "Gestor divergente" },
    });
    await cliente.papelPermissao.delete({
      where: {
        papelId_permissaoId: { papelId: papel.id, permissaoId: permissao.id },
      },
    });
    await cliente.papel.create({ data: { codigo: "SUPERADMIN", nome: "Super" } });

    const r = rodar(["seed", "--estrito"]);
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("divergências presentes e preservadas");
    expect(r.stdout).toContain("a matriz canônica foi aplicada");
    expect(r.stdout).not.toContain("nada foi alterado");

    expect(await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } })).toMatchObject({
      nome: "Gestor",
    });
    await expect(
      cliente.papelPermissao.findUniqueOrThrow({
        where: {
          papelId_permissaoId: { papelId: papel.id, permissaoId: permissao.id },
        },
      }),
    ).resolves.toBeDefined();
    expect(await cliente.papel.findUnique({ where: { codigo: "SUPERADMIN" } })).not.toBeNull();
    expect(await estado()).toMatchObject({ papeis: 5, permissoes: 29, vinculos: 37 });
  });

  it("modo normal sobre banco divergente: relata, mas termina com 0", async () => {
    rodar(["seed"]);
    await cliente.papel.create({ data: { codigo: "SUPERADMIN", nome: "Super" } });
    const r = rodar(["seed"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("DIVERGENCIAS");
    expect(r.stdout).not.toContain("JA_CONFORME");
  });
});

talvezSinais("CLI compilado — encerramento por sinal (POSIX; PULADO no Windows)", () => {
  for (const [sinal, esperado] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    it(`${sinal} encerra com ${esperado} e não deixa Administrador parcial`, async () => {
      rodar(["seed"]);
      // Pipe ocioso sem a variável: o processo fica esperando o stdin, que é
      // um ponto de parada determinístico para entregar o sinal.
      const filho = spawn(process.execPath, [CLI, "bootstrap-admin"], {
        cwd: RAIZ_API,
        env: ambiente({ TLF_BOOTSTRAP_STDIN_TIMEOUT_MS: "30000" }),
        stdio: ["pipe", "pipe", "pipe"],
      });
      await new Promise((r) => setTimeout(r, 800));
      filho.kill(sinal);
      const codigo = await new Promise<number | null>((resolver) => {
        const guarda = setTimeout(() => resolver(null), 20_000);
        filho.on("exit", (c) => {
          clearTimeout(guarda);
          resolver(c);
        });
      });
      expect(codigo).toBe(esperado);
      expect(await estado()).toMatchObject({ usuarios: 0, administradores: 0, eventos: 0 });
    });
  }
});

talvez("CLI compilado — corrida ENTRE PROCESSOS (`F5-R-01`)", () => {
  it("N processos, e-mails DIFERENTES: exatamente um Administrador", async () => {
    // É EXATAMENTE o cenário que as duas revisões independentes reproduziram
    // com 2 Administradores criados e ambos os processos em exit 0.
    const N = 4;
    for (let rodada = 0; rodada < 2; rodada += 1) {
      await limparTabelasDeDominio();
      rodar(["seed"]);

      const execucoes = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          new Promise<Execucao>((resolver) => {
            const filho = spawn(process.execPath, [CLI, "bootstrap-admin"], {
              cwd: RAIZ_API,
              env: ambiente({
                TLF_BOOTSTRAP_ADMIN_EMAIL: `corrida.${i}@sintetico.local`,
                TLF_BOOTSTRAP_ADMIN_SENHA: SENHA,
              }),
              stdio: ["ignore", "pipe", "pipe"],
            });
            let saida = "";
            let erro = "";
            filho.stdout.on("data", (d) => (saida += String(d)));
            filho.stderr.on("data", (d) => (erro += String(d)));
            filho.on("exit", (status) =>
              resolver({ status, stdout: saida, stderr: erro }),
            );
          }),
        ),
      );

      const criados = execucoes.filter((e) => e.stdout.includes("USUARIO_CRIADO"));
      const recusados = execucoes.filter((e) =>
        e.stderr.includes("ADMINISTRADOR_JA_EXISTE"),
      );
      expect(criados).toHaveLength(1);
      expect(recusados).toHaveLength(N - 1);
      expect(criados[0]?.status).toBe(0);
      for (const recusado of recusados) expect(recusado.status).toBe(1);
      // Nenhuma saída inesperada — nenhum `P2002` cru, nenhum incidente.
      for (const e of execucoes) expect(e.stderr).not.toContain("FALHA_INESPERADA");

      const final = await estado();
      expect(final.administradores).toBe(1);
      expect(final.usuarios).toBe(1);
      expect(final.eventos).toBe(1);
    }
  });

  it("N processos, MESMO e-mail: um cria e os demais convergem", async () => {
    const N = 4;
    await limparTabelasDeDominio();
    rodar(["seed"]);

    const execucoes = await Promise.all(
      Array.from({ length: N }, () =>
        new Promise<Execucao>((resolver) => {
          const filho = spawn(process.execPath, [CLI, "bootstrap-admin"], {
            cwd: RAIZ_API,
            env: ambiente({ TLF_BOOTSTRAP_ADMIN_SENHA: SENHA }),
            stdio: ["ignore", "pipe", "pipe"],
          });
          let saida = "";
          let erro = "";
          filho.stdout.on("data", (d) => (saida += String(d)));
          filho.stderr.on("data", (d) => (erro += String(d)));
          filho.on("exit", (status) => resolver({ status, stdout: saida, stderr: erro }));
        }),
      ),
    );

    expect(execucoes.filter((e) => e.stdout.includes("USUARIO_CRIADO"))).toHaveLength(1);
    expect(execucoes.filter((e) => e.stdout.includes("JA_CONFORME"))).toHaveLength(N - 1);
    for (const e of execucoes) {
      expect(e.status).toBe(0);
      expect(e.stderr).not.toContain("FALHA_INESPERADA");
    }
    expect(await estado()).toMatchObject({ usuarios: 1, administradores: 1, eventos: 1 });
  });

  it("N processos de `seed` simultâneos: convergem, sem erro e sem duplicata", async () => {
    const N = 4;
    await limparTabelasDeDominio();

    const execucoes = await Promise.all(
      Array.from({ length: N }, () =>
        new Promise<Execucao>((resolver) => {
          const filho = spawn(process.execPath, [CLI, "seed"], {
            cwd: RAIZ_API,
            env: ambiente(),
            stdio: ["ignore", "pipe", "pipe"],
          });
          let saida = "";
          let erro = "";
          filho.stdout.on("data", (d) => (saida += String(d)));
          filho.stderr.on("data", (d) => (erro += String(d)));
          filho.on("exit", (status) => resolver({ status, stdout: saida, stderr: erro }));
        }),
      ),
    );

    for (const e of execucoes) {
      expect(e.status).toBe(0);
      expect(e.stderr).toBe("");
    }
    expect(await estado()).toMatchObject({ papeis: 4, permissoes: 29, vinculos: 37 });
  });
});

// ---------------------------------------------------------------------------
// COMANDO COMPOSTO `provisionar` (`F5H-02`)
// ---------------------------------------------------------------------------
// A homologação técnica final apontou que `seed` e `bootstrap-admin` estavam
// exaustivamente cobertos, mas a COMPOSIÇÃO deles — o comando que o operador
// de fato executa, exposto como `npm run provisionar` — não tinha regressão
// alguma. O que só a composição decide, e por isso só aqui pode ser medido:
//
//   1. a credencial é validada ANTES do seed — entrada malformada não semeia;
//   2. seed e bootstrap correm em UM processo e em transações SEPARADAS, de
//      modo que o seed COMMITA mesmo quando o bootstrap depois recusa;
//   3. `--estrito` com divergência faz CURTO-CIRCUITO: sai 3 e o bootstrap
//      NÃO chega a executar (`D-2.3D-14` aplicada à composição).
//
// Os desfechos individuais de `seed` e de `bootstrap-admin` já são provados
// nos blocos acima e em `provisionamento-rbac.integration.spec.ts`; aqui eles
// aparecem apenas como pós-condição da composição, nunca reprovados isolados.

/** Papel/permissão fora da matriz — excedente que o seed deve PRESERVAR. */
async function injetarExcedentes(): Promise<void> {
  const gestor = await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
  const sensivel = await cliente.permissao.findUniqueOrThrow({
    where: { codigo: "pacotes.ajustar_sessao" },
  });
  await cliente.papelPermissao.create({
    data: { papelId: gestor.id, permissaoId: sensivel.id },
  });
  await cliente.papel.create({ data: { codigo: "SUPERADMIN", nome: "Super" } });
}

/** Torna o banco PARCIAL e com `nome` divergente — o seed deve convergir. */
async function injetarLacunaCanonica(): Promise<void> {
  const gestor = await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
  const localizar = await cliente.permissao.findUniqueOrThrow({
    where: { codigo: "pacientes.localizar" },
  });
  await cliente.papel.update({
    where: { id: gestor.id },
    data: { nome: "Gestor divergente" },
  });
  await cliente.papelPermissao.delete({
    where: { papelId_permissaoId: { papelId: gestor.id, permissaoId: localizar.id } },
  });
}

/** `true` quando os excedentes injetados continuam persistidos. */
async function excedentesPreservados(): Promise<boolean> {
  const superadmin = await cliente.papel.findUnique({ where: { codigo: "SUPERADMIN" } });
  const gestor = await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
  const sensivel = await cliente.permissao.findUniqueOrThrow({
    where: { codigo: "pacotes.ajustar_sessao" },
  });
  const excedente = await cliente.papelPermissao.findUnique({
    where: { papelId_permissaoId: { papelId: gestor.id, permissaoId: sensivel.id } },
  });
  return superadmin !== null && excedente !== null;
}

talvez("comando composto `provisionar` — o que o operador executa (`F5H-02`)", () => {
  it("os scripts públicos apontam para o CLI compilado com o argv medido aqui", () => {
    // Fecha a distância entre `npm run provisionar` e o que esta suíte roda:
    // se o script passar a apontar para outro alvo ou outro argumento, a
    // regressão abaixo deixaria de cobrir o comando real — e este teste cai.
    const manifesto = JSON.parse(
      readFileSync(path.join(RAIZ_API, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifesto.scripts["provisionar"]).toBe(
      "node dist/provisionamento/cli.js provisionar",
    );
    expect(manifesto.scripts["provisionar:seed:estrito"]).toBe(
      "node dist/provisionamento/cli.js seed --estrito",
    );
  });

  it("P1 — banco vazio: semeia, cria o Administrador e audita, em UM processo (saída 0)", async () => {
    // Não vacuidade: o ponto de partida é mesmo o banco vazio.
    expect(await estado()).toMatchObject({ papeis: 0, usuarios: 0, eventos: 0 });

    // Pela senha no stdin — o caminho de credencial do comando composto.
    const r = rodar(["provisionar"], { entrada: `${SENHA}\n` });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("papeis +4");
    expect(r.stdout).toContain("permissoes +29");
    expect(r.stdout).toContain("associacoes +37");
    expect(r.stdout).toContain("bootstrap-admin: USUARIO_CRIADO");
    expect(await estado()).toMatchObject({
      papeis: 4,
      permissoes: 29,
      vinculos: 37,
      usuarios: 1,
      administradores: 1,
      eventos: 1,
    });

    const usuario = await cliente.usuario.findUniqueOrThrow({ where: { email: EMAIL } });
    const evento = await cliente.eventoAuditoria.findFirstOrThrow();
    expect(evento.acao).toBe("usuario.papeis.alterados");
    expect(evento.resultado).toBe("SUCESSO");
    expect(evento.alvoTipo).toBe("usuario");
    expect(evento.alvoId).toBe(usuario.id);
    // `D-2.3D-15`: ator nulo, sem identidade sintética, com justificativa.
    expect(evento.atorUsuarioId).toBeNull();
    expect(evento.justificativa).toBe(JUSTIFICATIVA);
    expect(evento.contexto).toBeNull();
    // Nada da credencial escapa pela saída do comando composto.
    expect(`${r.stdout}${r.stderr}`).not.toContain(SENHA);
    expect(`${r.stdout}${r.stderr}`).not.toContain(JUSTIFICATIVA);
  });

  it("P2 — composição idempotente: segunda execução não escreve nada (saída 0)", async () => {
    rodar(["provisionar"], { env: { TLF_BOOTSTRAP_ADMIN_SENHA: SENHA } });
    const primeiro = await cliente.usuario.findUniqueOrThrow({ where: { email: EMAIL } });

    const r = rodar(["provisionar"], { env: { TLF_BOOTSTRAP_ADMIN_SENHA: SENHA } });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("JA_CONFORME (nenhuma escrita, nenhuma divergência)");
    expect(r.stdout).toContain("bootstrap-admin: JA_CONFORME");
    // Nenhum segundo Administrador, nenhum segundo evento, nenhuma duplicata
    // de catálogo — e a MESMA identidade, não uma recriada.
    expect(await estado()).toMatchObject({
      papeis: 4,
      permissoes: 29,
      vinculos: 37,
      usuarios: 1,
      administradores: 1,
      eventos: 1,
    });
    expect((await cliente.usuario.findUniqueOrThrow({ where: { email: EMAIL } })).id).toBe(
      primeiro.id,
    );
  });

  it("P3 — outro Administrador existe: bootstrap recusa (1), mas o seed já commitou", async () => {
    rodar(["provisionar"], { env: { TLF_BOOTSTRAP_ADMIN_SENHA: SENHA } });
    const titular = await cliente.usuario.findUniqueOrThrow({ where: { email: EMAIL } });
    // Banco deixado simultaneamente EXCEDENTE e PARCIAL: o seed da composição
    // precisa convergir a matriz e preservar o que está além dela, mesmo que
    // o bootstrap logo em seguida recuse.
    await injetarExcedentes();
    await injetarLacunaCanonica();

    const r = rodar(["provisionar"], {
      env: {
        TLF_BOOTSTRAP_ADMIN_EMAIL: "intruso@sintetico.local",
        TLF_BOOTSTRAP_ADMIN_SENHA: SENHA,
      },
    });

    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe("provisionamento: ADMINISTRADOR_JA_EXISTE");
    // Fail-closed: a segunda identidade NÃO nasce, nem sem papel.
    expect(
      await cliente.usuario.findUnique({ where: { email: "intruso@sintetico.local" } }),
    ).toBeNull();
    expect(await estado()).toMatchObject({
      usuarios: 1,
      administradores: 1,
      eventos: 1,
      papeis: 5,
      permissoes: 29,
      vinculos: 38,
    });
    expect((await cliente.usuario.findUniqueOrThrow({ where: { email: EMAIL } })).id).toBe(
      titular.id,
    );
    // Transações SEPARADAS: a recusa do bootstrap não desfaz o seed. A matriz
    // canônica voltou a estar completa (37) e o excedente continua lá (+1).
    expect(
      await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } }),
    ).toMatchObject({ nome: "Gestor" });
    expect(await excedentesPreservados()).toBe(true);
  });

  it("P4 — `provisionar --estrito` com divergência: saída 3 e bootstrap NÃO executado", async () => {
    // O cenário decisivo. O banco é semeado e depois contaminado, e NÃO há
    // Administrador algum — de modo que a única explicação possível para não
    // existir Administrador ao final é o CURTO-CIRCUITO da saída 3, e nunca
    // uma recusa `ADMINISTRADOR_JA_EXISTE`.
    rodar(["seed"]);
    await injetarExcedentes();
    await injetarLacunaCanonica();
    expect(await estado()).toMatchObject({ usuarios: 0, administradores: 0 });

    const r = rodar(["provisionar", "--estrito"], {
      env: {
        TLF_BOOTSTRAP_ADMIN_EMAIL: "estrito@sintetico.local",
        TLF_BOOTSTRAP_ADMIN_SENHA: SENHA,
      },
    });

    expect(r.status).toBe(3);
    // O bootstrap não deixou rastro NENHUM na saída — nem sucesso, nem recusa.
    expect(r.stdout).not.toContain("bootstrap-admin");
    expect(r.stderr).not.toContain("ADMINISTRADOR_JA_EXISTE");
    expect(r.stdout).toContain("modo estrito");
    // Nem no banco: a identidade solicitada não existe, sob nenhuma forma.
    expect(
      await cliente.usuario.findUnique({ where: { email: "estrito@sintetico.local" } }),
    ).toBeNull();
    expect(await estado()).toMatchObject({ usuarios: 0, administradores: 0, eventos: 0 });
    // `D-2.3D-14`: a matriz canônica FOI aplicada e os excedentes PRESERVADOS.
    expect(
      await cliente.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } }),
    ).toMatchObject({ nome: "Gestor" });
    expect(await excedentesPreservados()).toBe(true);
    expect(await estado()).toMatchObject({ papeis: 5, permissoes: 29, vinculos: 38 });
  });

  it("P4b — CONTROLE POSITIVO: o mesmo banco divergente, sem `--estrito`, PROVISIONA", async () => {
    // Sem este controle, P4 passaria mesmo que `provisionar` jamais chamasse o
    // bootstrap. Mesmo estado inicial, mesma identidade, única diferença: a
    // opção. O bootstrap então roda e cria o Administrador.
    rodar(["seed"]);
    await injetarExcedentes();
    await injetarLacunaCanonica();

    const r = rodar(["provisionar"], {
      env: {
        TLF_BOOTSTRAP_ADMIN_EMAIL: "estrito@sintetico.local",
        TLF_BOOTSTRAP_ADMIN_SENHA: SENHA,
      },
    });

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("DIVERGENCIAS");
    expect(r.stdout).toContain("bootstrap-admin: USUARIO_CRIADO");
    expect(await estado()).toMatchObject({ usuarios: 1, administradores: 1, eventos: 1 });
    expect(await excedentesPreservados()).toBe(true);
  });

  it("P5 — credencial inválida é recusada ANTES do seed: nada é semeado", async () => {
    // Ordem interna da composição: toda a entrada é validada antes de abrir
    // contexto ou transação. Se o seed passasse a rodar primeiro, o banco
    // ficaria semeado por um comando que terminou em erro — e isto cairia.
    const r = rodar(["provisionar"], {
      entrada: `${SENHA}\n`,
      env: { TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA: undefined },
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain("VARIAVEL_OBRIGATORIA_AUSENTE");
    expect(r.stderr).toContain("TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA");
    expect(r.stdout).toBe("");
    expect(await estado()).toMatchObject({
      papeis: 0,
      permissoes: 0,
      vinculos: 0,
      usuarios: 0,
      eventos: 0,
    });
  });
});
