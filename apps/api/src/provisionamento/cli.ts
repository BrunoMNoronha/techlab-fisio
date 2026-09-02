// TechLab Fisio — CLI de provisionamento (Etapa 2.3D-B / F5).
//
// O ÚNICO acionador do seed RBAC (`D-2.3D-09`) e do bootstrap do primeiro
// Administrador (`D-2.3D-10`). Processo PRÓPRIO, iniciado deliberadamente:
//
//   node dist/provisionamento/cli.js seed [--estrito]
//   node dist/provisionamento/cli.js bootstrap-admin
//   node dist/provisionamento/cli.js provisionar [--estrito]
//
// NÃO EXISTE BOOTSTRAP AUTOMÁTICO. Este arquivo não é importado por `main.ts`,
// por `app.module.ts` nem por módulo algum da aplicação; `SeedModule` e
// `BootstrapModule` não pertencem ao `AppModule`. Subir a API não semeia nada
// e não cria Administrador algum. Os contextos aqui são
// `createApplicationContext` — sem servidor HTTP, sem porta, sem rota.
//
// ---------------------------------------------------------------------------
// IMPORTAÇÃO DINÂMICA DO BOOTSTRAP — e por que ela é obrigatória
// ---------------------------------------------------------------------------
// `BootstrapModule` provê `CredencialService`, que carrega o addon nativo do
// Argon2 no momento do `import`. Um `import` estático aqui faria o comando
// `seed` FALHAR em qualquer máquina onde esse addon não carregue — situação
// real e medida no host Windows deste projeto. Por isso o módulo do bootstrap
// é importado com `await import(...)` DENTRO do ramo que precisa dele.
//
// ---------------------------------------------------------------------------
// FRONTEIRA DE ERROS (correção `F5-R-06`)
// ---------------------------------------------------------------------------
// A revisão independente apurou que o `catch` global imprimia `Error.message`
// de QUALQUER origem — Prisma, PostgreSQL, Nest, Argon2 — contra o precedente
// `L-10` (`docs/10` §9), que declara que mensagens do Prisma podem carregar a
// consulta e seus parâmetros.
//
// Agora a saída é construída AQUI, a partir de um `motivo` de conjunto
// fechado; nem mesmo a `message` dos erros PRÓPRIOS é ecoada. Erro de origem
// desconhecida vira mensagem genérica + identificador de incidente. Nunca
// aparecem SQL, nome de modelo, índice, URL de banco, e-mail, nome, senha,
// digest, justificativa ou parâmetro interno.
//
// ---------------------------------------------------------------------------
// ENTRADA DA CREDENCIAL — precedência determinística
// ---------------------------------------------------------------------------
//   1. `TLF_BOOTSTRAP_ADMIN_SENHA`, se definida e não vazia. Quando ela
//      existe, o stdin NÃO é lido — um pipe ocioso não trava o comando
//      (correção `F5-R-07`/pipe pendente);
//   2. stdin, quando NÃO for TTY: leitura limitada em tamanho e em tempo;
//   3. caso contrário, erro controlado.
//
// A senha NUNCA vem de `argv` — visível na lista de processos. Não existe
// senha padrão nem credencial versionada. Espaços são preservados; qualquer
// CARACTERE DE CONTROLE (NUL, CR, LF, ...) é RECUSADO: um arquivo de senha
// com linha em branco ao final produzia, antes, uma senha com `\n` embutido
// que o operador jamais conseguiria digitar.
//
// SEGREDO NUNCA VERSIONADO (TLF-BASE-V1 §14): nenhum arquivo deste
// repositório contém credencial de bootstrap.

import { randomUUID } from "node:crypto";

import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";

import { SeedModule } from "./seed.module.js";
import { SeedRbacService } from "./seed-rbac.service.js";

const COMANDOS = ["seed", "bootstrap-admin", "provisionar"] as const;
type Comando = (typeof COMANDOS)[number];

/** Códigos de saída — contrato estável, verificado por teste. */
const SAIDA_OK = 0;
const SAIDA_FALHA_CONTROLADA = 1;
const SAIDA_USO_INVALIDO = 2;
const SAIDA_DIVERGENCIA_ESTRITA = 3;
const SAIDA_SIGINT = 130;
const SAIDA_SIGTERM = 143;

/** Teto de leitura do stdin — 4 KiB é ordens de grandeza acima de uma senha. */
const LIMITE_SENHA_BYTES = 4096;
/** Espera máxima por EOF no stdin. Configurável apenas para teste. */
const LIMITE_STDIN_MS_PADRAO = 10_000;
/** Espera máxima pelo fechamento do contexto durante encerramento por sinal. */
const LIMITE_ENCERRAMENTO_MS = 5_000;

/** Qualquer caractere de controle C0/C1 — inclui NUL, CR e LF. */
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;

const USO = [
  "Uso: node dist/provisionamento/cli.js <comando> [--estrito]",
  "",
  "Comandos:",
  "  seed             aplica o seed idempotente de papéis, permissões e matriz",
  "  bootstrap-admin  cria/eleva o primeiro Administrador (idempotente)",
  "  provisionar      executa `seed` e, em seguida, `bootstrap-admin`",
  "",
  "Opções:",
  "  --estrito        aplica/completa a matriz canônica sem remover excedentes",
  "                   e termina com saída 3 quando persistirem divergências",
  "                   (papéis, permissões ou associações além da matriz)",
  "",
  "Variáveis de ambiente do bootstrap (todas obrigatórias):",
  "  TLF_BOOTSTRAP_ADMIN_EMAIL",
  "  TLF_BOOTSTRAP_ADMIN_NOME",
  "  TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA   motivo operacional; vai para a trilha",
  "                                      de auditoria e nunca é impresso",
  "",
  "Senha — precedência determinística, nesta ordem:",
  "  1. TLF_BOOTSTRAP_ADMIN_SENHA, se definida e não vazia (stdin NÃO é lido)",
  "  2. stdin redirecionado (não-TTY): até 4096 bytes, até 10s por EOF",
  "  3. caso contrário: erro controlado",
  "Espaços são preservados. Caracteres de controle (NUL, CR, LF) são recusados.",
  "Senha por argumento de linha de comando NÃO é aceita.",
  "",
  "Códigos de saída: 0 ok · 1 falha controlada · 2 uso inválido ·",
  "                  3 divergência em modo estrito · 130 SIGINT · 143 SIGTERM",
].join("\n");

type MotivoCli =
  | "COMANDO_AUSENTE"
  | "COMANDO_DESCONHECIDO"
  | "OPCAO_DESCONHECIDA"
  | "VARIAVEL_OBRIGATORIA_AUSENTE"
  | "SENHA_NAO_FORNECIDA"
  | "SENHA_COM_CARACTERE_DE_CONTROLE"
  | "SENHA_ACIMA_DO_LIMITE"
  | "STDIN_SEM_EOF"
  | "STDIN_ILEGIVEL";

class ErroCli extends Error {
  override readonly name = "ErroCli";

  constructor(
    readonly motivo: MotivoCli,
    /** Complemento SEGURO — apenas nomes de variável/opção, nunca valores. */
    readonly detalhe: string | null = null,
  ) {
    super(motivo);
  }
}

/**
 * Nomes dos erros de conjunto fechado desta fatia. A detecção é por `name` +
 * formato do `motivo`, e NÃO por `instanceof`: o erro do bootstrap vem de um
 * módulo carregado dinamicamente, e um `instanceof` exigiria importá-lo
 * estaticamente — justamente o que quebraria o comando `seed` sem Argon2.
 */
const ERROS_PROPRIOS = new Set(["ErroCli", "ErroBootstrapAdministrador", "ErroSeedRbac"]);
const FORMATO_MOTIVO = /^[A-Z][A-Z0-9_]*$/;

interface ErroProprio {
  readonly name: string;
  readonly motivo: string;
  readonly detalhe?: string | null;
}

function ehErroProprio(causa: unknown): causa is ErroProprio {
  if (typeof causa !== "object" || causa === null) return false;
  const candidato = causa as { name?: unknown; motivo?: unknown };
  return (
    typeof candidato.name === "string" &&
    ERROS_PROPRIOS.has(candidato.name) &&
    typeof candidato.motivo === "string" &&
    FORMATO_MOTIVO.test(candidato.motivo)
  );
}

// ---------------------------------------------------------------------------
// Argumentos — `argv` é lido AQUI e em nenhum outro lugar, e jamais carrega
// credencial: o resultado é um par fechado (comando, estrito).
// ---------------------------------------------------------------------------

interface Argumentos {
  readonly comando: Comando;
  readonly estrito: boolean;
}

function analisarArgumentos(argumentos: readonly string[]): Argumentos {
  const [primeiro, ...resto] = argumentos;
  if (primeiro === undefined) throw new ErroCli("COMANDO_AUSENTE");
  if (!(COMANDOS as readonly string[]).includes(primeiro)) {
    throw new ErroCli("COMANDO_DESCONHECIDO");
  }
  let estrito = false;
  for (const opcao of resto) {
    if (opcao === "--estrito") {
      estrito = true;
      continue;
    }
    // Qualquer outro argumento é recusado — inclusive uma tentativa de passar
    // a senha por linha de comando, que assim nunca é sequer considerada.
    throw new ErroCli("OPCAO_DESCONHECIDA");
  }
  return { comando: primeiro as Comando, estrito };
}

function exigirVariavel(nome: string): string {
  const valor = process.env[nome];
  if (valor === undefined || valor.trim() === "") {
    // O NOME da variável aparece; o VALOR, nunca.
    throw new ErroCli("VARIAVEL_OBRIGATORIA_AUSENTE", nome);
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------------

function limiteStdinMs(): number {
  const bruto = process.env["TLF_BOOTSTRAP_STDIN_TIMEOUT_MS"];
  if (bruto === undefined || bruto === "") return LIMITE_STDIN_MS_PADRAO;
  const valor = Number.parseInt(bruto, 10);
  return Number.isInteger(valor) && valor > 0 ? valor : LIMITE_STDIN_MS_PADRAO;
}

/**
 * Lê a senha do stdin redirecionado, com teto de tamanho e de tempo. Remove
 * apenas a quebra de linha FINAL — a que `echo`/arquivo acrescentam. Nenhum
 * outro `trim`: espaço pode ser parte legítima de uma senha.
 */
async function lerSenhaDoStdin(): Promise<string> {
  const entrada = process.stdin;
  return new Promise<string>((resolver, rejeitar) => {
    const pedacos: Buffer[] = [];
    let total = 0;
    let concluido = false;

    const finalizar = (acao: () => void): void => {
      if (concluido) return;
      concluido = true;
      clearTimeout(relogio);
      entrada.removeListener("data", aoReceber);
      entrada.removeListener("end", aoTerminar);
      entrada.removeListener("error", aoFalhar);
      entrada.pause();
      acao();
    };

    const relogio = setTimeout(() => {
      finalizar(() => rejeitar(new ErroCli("STDIN_SEM_EOF")));
    }, limiteStdinMs());

    const aoReceber = (pedaco: Buffer): void => {
      total += pedaco.length;
      if (total > LIMITE_SENHA_BYTES) {
        finalizar(() => rejeitar(new ErroCli("SENHA_ACIMA_DO_LIMITE")));
        return;
      }
      pedacos.push(Buffer.from(pedaco));
    };
    const aoTerminar = (): void => {
      finalizar(() =>
        resolver(Buffer.concat(pedacos).toString("utf8").replace(/\r?\n$/, "")),
      );
    };
    // A causa original é DESCARTADA de propósito: ela pertence ao runtime e
    // não deve alcançar a saída.
    const aoFalhar = (): void => {
      finalizar(() => rejeitar(new ErroCli("STDIN_ILEGIVEL")));
    };

    entrada.on("data", aoReceber);
    entrada.on("end", aoTerminar);
    entrada.on("error", aoFalhar);
    entrada.resume();
  });
}

async function obterSenha(): Promise<string> {
  // 1. Ambiente tem PRECEDÊNCIA — com ela definida, o stdin nunca é tocado e
  //    um pipe ocioso não trava o processo.
  const doAmbiente = process.env["TLF_BOOTSTRAP_ADMIN_SENHA"];
  let senha: string | null =
    doAmbiente !== undefined && doAmbiente !== "" ? doAmbiente : null;

  // 2. stdin redirecionado.
  if (senha === null && process.stdin.isTTY !== true) {
    const doStdin = await lerSenhaDoStdin();
    if (doStdin !== "") senha = doStdin;
  }

  // 3. Erro controlado.
  if (senha === null) throw new ErroCli("SENHA_NAO_FORNECIDA");

  if (CONTROLE.test(senha)) throw new ErroCli("SENHA_COM_CARACTERE_DE_CONTROLE");
  if (Buffer.byteLength(senha, "utf8") > LIMITE_SENHA_BYTES) {
    throw new ErroCli("SENHA_ACIMA_DO_LIMITE");
  }
  return senha;
}

// ---------------------------------------------------------------------------
// Saída e contextos
// ---------------------------------------------------------------------------

function imprimir(linha: string): void {
  process.stdout.write(`${linha}\n`);
}

let contextoAtivo: INestApplicationContext | null = null;

/** Fechamento IDEMPOTENTE: uma segunda chamada não faz nada. */
async function fecharContextoAtivo(): Promise<void> {
  const contexto = contextoAtivo;
  if (contexto === null) return;
  contextoAtivo = null;
  await contexto.close();
}

/**
 * Executa `corpo` com um contexto Nest do módulo indicado, garantindo o
 * fechamento. Uma falha no FECHAMENTO nunca substitui a falha original: ela é
 * descartada quando já existe erro em curso, e só propaga quando o corpo
 * terminou bem.
 */
async function comContexto<T>(
  modulo: unknown,
  corpo: (contexto: INestApplicationContext) => Promise<T>,
): Promise<T> {
  const contexto = await NestFactory.createApplicationContext(
    modulo as Parameters<typeof NestFactory.createApplicationContext>[0],
    { abortOnError: false },
  );
  contextoAtivo = contexto;
  let concluiu = false;
  try {
    const resultado = await corpo(contexto);
    concluiu = true;
    return resultado;
  } finally {
    try {
      await fecharContextoAtivo();
    } catch (falhaDeFechamento) {
      if (concluiu) throw falhaDeFechamento;
      // Erro em curso: preserva-se o original.
    }
  }
}

// ---------------------------------------------------------------------------
// Encerramento por sinal
// ---------------------------------------------------------------------------

let encerrando = false;

function encerrarPorSinal(codigo: number): void {
  if (encerrando) return;
  encerrando = true;
  process.exitCode = codigo;
  // Teto de tempo: um fechamento travado não impede o processo de sair. A
  // transação em curso sofre ROLLBACK quando a conexão é encerrada — e o
  // advisory lock transacional é liberado com ela.
  const forcar = setTimeout(() => process.exit(codigo), LIMITE_ENCERRAMENTO_MS);
  forcar.unref();
  void fecharContextoAtivo()
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(forcar);
      process.exit(codigo);
    });
}

process.on("SIGINT", () => encerrarPorSinal(SAIDA_SIGINT));
process.on("SIGTERM", () => encerrarPorSinal(SAIDA_SIGTERM));

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function executarSeed(estrito: boolean): Promise<boolean> {
  const resultado = await comContexto(SeedModule, async (contexto) =>
    contexto.get(SeedRbacService).executar(),
  );

  imprimir(
    `seed: papeis +${resultado.papeisCriados} ~${resultado.papeisAtualizados} · ` +
      `permissoes +${resultado.permissoesCriadas} ~${resultado.permissoesAtualizadas} · ` +
      `associacoes +${resultado.associacoesCriadas}` +
      (resultado.jaConforme ? " · JA_CONFORME (nenhuma escrita, nenhuma divergência)" : ""),
  );

  const d = resultado.divergencias;
  if (d.total > 0) {
    // Somente CONTAGENS e pares cujos dois lados são do catálogo homologado.
    // Códigos fora do catálogo são strings de terceiros e não são ecoados.
    imprimir(
      `seed: DIVERGENCIAS (nenhuma removida — o seed é aditivo): ` +
        `papeis_desconhecidos=${d.papeisDesconhecidos} · ` +
        `permissoes_desconhecidas=${d.permissoesDesconhecidas} · ` +
        `associacoes_excedentes=${d.associacoesExcedentes}`,
    );
    for (const par of d.associacoesExcedentesCanonicas) {
      imprimir(`seed:   associacao excedente (catálogo): ${par}`);
    }
    if (estrito) {
      imprimir(
        "seed: modo estrito — divergências presentes e preservadas; " +
          "a matriz canônica foi aplicada.",
      );
      return false;
    }
  }
  return true;
}

async function executarBootstrap(credencial: {
  email: string;
  nome: string;
  senha: string;
  justificativa: string;
}): Promise<void> {
  // IMPORTAÇÃO DINÂMICA — ver cabeçalho: mantém `seed` utilizável quando o
  // runtime Argon2 estiver indisponível.
  const { BootstrapModule } = await import("./bootstrap.module.js");
  const { BootstrapAdministradorService } = await import(
    "./bootstrap-administrador.service.js"
  );

  const resultado = await comContexto(BootstrapModule, async (contexto) =>
    contexto.get(BootstrapAdministradorService).executar(credencial),
  );

  // Somente desfecho, id e correlação — nem e-mail, nem nome, nem senha, nem
  // digest, nem justificativa.
  imprimir(
    `bootstrap-admin: ${resultado.desfecho} · usuario=${resultado.usuarioId}` +
      (resultado.correlacaoId === null ? "" : ` · correlacao=${resultado.correlacaoId}`),
  );
}

async function principal(): Promise<void> {
  const { comando, estrito } = analisarArgumentos(process.argv.slice(2));

  // Toda a entrada é validada ANTES de abrir qualquer contexto ou transação:
  // entrada malformada falha sem sequer conectar ao banco.
  const precisaBootstrap = comando === "bootstrap-admin" || comando === "provisionar";
  const credencial = precisaBootstrap
    ? {
        email: exigirVariavel("TLF_BOOTSTRAP_ADMIN_EMAIL"),
        nome: exigirVariavel("TLF_BOOTSTRAP_ADMIN_NOME"),
        justificativa: exigirVariavel("TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA"),
        senha: await obterSenha(),
      }
    : null;

  if (comando === "seed" || comando === "provisionar") {
    const conforme = await executarSeed(estrito);
    if (!conforme) {
      process.exitCode = SAIDA_DIVERGENCIA_ESTRITA;
      return;
    }
  }

  if (credencial !== null) await executarBootstrap(credencial);
  process.exitCode = SAIDA_OK;
}

try {
  await principal();
} catch (causa) {
  if (ehErroProprio(causa)) {
    // A mensagem é CONSTRUÍDA aqui a partir do motivo de conjunto fechado —
    // nem a `message` do próprio erro é ecoada.
    const complemento =
      typeof causa.detalhe === "string" && causa.detalhe !== "" ? ` (${causa.detalhe})` : "";
    process.stderr.write(`provisionamento: ${causa.motivo}${complemento}\n`);
    if (causa.motivo === "COMANDO_AUSENTE" || causa.motivo === "COMANDO_DESCONHECIDO") {
      process.stderr.write(`${USO}\n`);
    }
    process.exitCode =
      causa.motivo === "COMANDO_AUSENTE" ||
      causa.motivo === "COMANDO_DESCONHECIDO" ||
      causa.motivo === "OPCAO_DESCONHECIDA"
        ? SAIDA_USO_INVALIDO
        : SAIDA_FALHA_CONTROLADA;
  } else {
    // Origem desconhecida (Prisma, PostgreSQL, Nest, Argon2, driver): NADA da
    // exceção é impresso — nem `message`, nem `code`, nem `stack`. Só um
    // identificador de incidente para correlacionar com o diagnóstico feito
    // por quem tiver acesso autorizado ao ambiente.
    process.stderr.write(
      `provisionamento: FALHA_INESPERADA (incidente ${randomUUID()})\n`,
    );
    process.exitCode = SAIDA_FALHA_CONTROLADA;
  }
}
