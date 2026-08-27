// TechLab Fisio — helpers da suíte de INTEGRAÇÃO de `apps/api` (Etapa 2.3B).
//
// Espelha as guardas da E-13 (packages/database/test/helpers/db.ts) sem
// importar caminho interno do pacote de banco: o cliente administrativo de
// LIMPEZA é criado pela FÁBRICA PÚBLICA de `@techlab-fisio/database` — a
// mesma usada pelo runtime — apontada para a URL de `tlf_migrator` que o
// globalSetup publica (TRUNCATE exige ownership; `tlf_app` não o possui,
// deliberadamente). O migrator aparece SOMENTE aqui (setup/limpeza), nunca
// no caminho de runtime dos testes.
//
// Toda operação destrutiva é fail-closed por prefixo de banco descartável.

import { criarClientePersistencia } from "@techlab-fisio/database";
import type { ClientePersistencia } from "@techlab-fisio/database";

/** Mesmo prefixo do globalSetup da E-13 (banco descartável por execução). */
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

function nomeDoBanco(url: string): string {
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

/** Guarda executada no beforeAll de cada arquivo (setup-db.ts). */
export function garantirBancoDescartavel(): void {
  exigirBancoDescartavel(urlObrigatoria("DATABASE_URL"), "suíte de integração da API");
}

let clienteLimpeza: ClientePersistencia | null = null;

function obterClienteLimpeza(): ClientePersistencia {
  if (clienteLimpeza === null) {
    const url = urlObrigatoria("TLF_IT_MIGRATE_URL");
    exigirBancoDescartavel(url, "limpeza");
    clienteLimpeza = criarClientePersistencia({ url });
  }
  return clienteLimpeza;
}

/**
 * Limpeza determinística entre testes — idêntica em contrato à da E-13:
 * lista de tabelas derivada do catálogo, `_prisma_migrations` preservada,
 * um único TRUNCATE, executado como `tlf_migrator`.
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

/** Fecha a conexão de limpeza deste worker (afterAll do setup-db.ts). */
export async function encerrarClienteLimpeza(): Promise<void> {
  if (clienteLimpeza !== null) {
    await clienteLimpeza.$disconnect();
    clienteLimpeza = null;
  }
}
