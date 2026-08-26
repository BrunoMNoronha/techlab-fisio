// TechLab Fisio — fábrica pública do cliente de persistência (Etapa 2.3B).
//
// Este módulo é o ÚNICO ponto do monorepositório autorizado a instanciar o
// Prisma Client: `packages/database` é o proprietário da construção do client
// e do adapter (`@prisma/client` + `@prisma/adapter-pg`). Consumidores
// (`apps/api`) recebem o cliente pronto pela API pública do pacote e NUNCA
// importam `@prisma/client`, `@prisma/adapter-pg` ou `generated/prisma` por
// caminho profundo.
//
// A fábrica NÃO decide credencial, ciclo de vida, pooling adicional nem
// política de conexão: isso pertence ao provider da aplicação (DatabaseService
// em `apps/api`), que valida a configuração e a postura de privilégios da
// role de runtime antes de servir o cliente.
//
// Nenhuma URL de conexão é registrada em log ou mensagem de erro aqui.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Cliente de persistência de runtime — o Prisma Client tipado do schema
 * homologado, conectado via driver adapter `pg`.
 */
export type ClientePersistencia = PrismaClient;

/**
 * Cliente TRANSACIONAL — o que uma transação interativa entrega ao callback.
 * É o tipo que serviços de aplicação devem receber EXPLICITAMENTE para operar
 * dentro de uma fronteira transacional (mutação + auditoria na MESMA
 * transação); não possui `$connect`/`$disconnect`/`$transaction`.
 */
export type TransacaoPersistencia = Prisma.TransactionClient;

export interface OpcoesClientePersistencia {
  /** URL de conexão PostgreSQL da role de RUNTIME (nunca a de migration). */
  readonly url: string;
}

/**
 * Cria um cliente de persistência real (Prisma Client 7 + `@prisma/adapter-pg`)
 * a partir da URL informada. A conexão é lazy — quem controla `$connect`/
 * `$disconnect` é o chamador (provider com ciclo de vida).
 *
 * Cada chamada cria um cliente/pool NOVO: o chamador é responsável por manter
 * uma única instância por processo (singleton no container de DI).
 */
export function criarClientePersistencia(
  opcoes: OpcoesClientePersistencia,
): ClientePersistencia {
  if (typeof opcoes.url !== "string" || opcoes.url.length === 0) {
    // Mensagem deliberadamente sem ecoar valor algum (TLF-BASE-V1 §10).
    throw new Error(
      "criarClientePersistencia: URL de conexão ausente ou vazia.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: opcoes.url }),
  });
}
