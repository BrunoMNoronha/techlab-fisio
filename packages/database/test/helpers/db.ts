// TechLab Fisio — E-13 — helpers do ambiente de integração (docs/08 §13 `E-13`).
//
// Separação de roles (condição de segurança da E-13):
//   - os TESTES falam com o banco como `tlf_app` (runtime real, com os REVOKEs
//     de E-11 ativos) — `criarClienteApp()`;
//   - a LIMPEZA entre testes (TRUNCATE) exige ownership e roda como
//     `tlf_migrator`, explicitamente e apenas aqui — nunca a suíte inteira.
//
// Toda operação destrutiva é protegida pela guarda do banco descartável:
// nada trunca fora de um banco cujo nome comece com o prefixo abaixo.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

/** Prefixo dos bancos descartáveis de integração criados pelo globalSetup. */
export const PREFIXO_BANCO_DESCARTAVEL = "techlab_fisio_it_";

export function urlObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${nome} — o globalSetup da suíte de integração deve tê-la definido.`,
    );
  }
  return valor;
}

export function nomeDoBanco(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function exigirBancoDescartavel(url: string, contexto: string): void {
  const banco = nomeDoBanco(url);
  if (!banco.startsWith(PREFIXO_BANCO_DESCARTAVEL)) {
    throw new Error(
      `${contexto}: recusado — o banco "${banco}" não é um banco descartável de integração ` +
        `(prefixo esperado: "${PREFIXO_BANCO_DESCARTAVEL}"). ` +
        `A suíte nunca opera sobre o banco de desenvolvimento.`,
    );
  }
}

/**
 * Cliente do caminho real de runtime: Prisma Client 7 (ESM) +
 * `@prisma/adapter-pg`, conectado como `tlf_app` ao banco descartável.
 */
export function criarClienteApp(): PrismaClient {
  const url = urlObrigatoria("DATABASE_URL");
  exigirBancoDescartavel(url, "criarClienteApp");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

let clienteLimpeza: PrismaClient | null = null;

function obterClienteLimpeza(): PrismaClient {
  if (clienteLimpeza === null) {
    const url = urlObrigatoria("TLF_IT_MIGRATE_URL");
    exigirBancoDescartavel(url, "limpeza");
    clienteLimpeza = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }
  return clienteLimpeza;
}

/**
 * Limpeza determinística entre testes (docs/08 §13 `E-13`: "truncamento").
 *
 * - lista de tabelas DERIVADA do catálogo (`pg_tables`), nunca hardcoded;
 * - exclui `_prisma_migrations` — o histórico de migrations é preservado;
 * - um único `TRUNCATE` com a lista completa satisfaz as FKs sem `CASCADE`;
 * - sem `RESTART IDENTITY` — PKs são UUID, não há sequência a reiniciar;
 * - executa como `tlf_migrator` (TRUNCATE exige ownership; `tlf_app`
 *   deliberadamente não o possui — initdb `01-roles.sh`).
 */
export async function limparTabelasDeDominio(): Promise<void> {
  const cliente = obterClienteLimpeza();
  const confirmacao = await cliente.$queryRaw<
    Array<{ banco: string }>
  >`SELECT current_database() AS banco`;
  const banco = confirmacao[0]?.banco ?? "";
  if (!banco.startsWith(PREFIXO_BANCO_DESCARTAVEL)) {
    throw new Error(
      `limparTabelasDeDominio: conectado a "${banco}", que não é banco descartável — truncamento recusado.`,
    );
  }
  const tabelas = await cliente.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  if (tabelas.length === 0) {
    throw new Error(
      "limparTabelasDeDominio: nenhuma tabela de domínio encontrada — as migrations foram aplicadas?",
    );
  }
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
  await cliente.$executeRawUnsafe(`TRUNCATE TABLE ${lista}`);
}

/** Fecha a conexão de limpeza aberta por este worker (afterAll do setup). */
export async function encerrarClienteLimpeza(): Promise<void> {
  if (clienteLimpeza !== null) {
    await clienteLimpeza.$disconnect();
    clienteLimpeza = null;
  }
}

/** Guarda executada no beforeAll de cada arquivo de teste (setup.ts). */
export function garantirBancoDescartavel(): void {
  exigirBancoDescartavel(urlObrigatoria("DATABASE_URL"), "suíte de integração");
}
