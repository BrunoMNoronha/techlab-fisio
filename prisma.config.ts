// TechLab Fisio — configuração do CLI do Prisma 7 (docs/08 §13 `E-03`).
//
// Nenhuma credencial pertence a este arquivo: as URLs vêm exclusivamente do
// ambiente. `.env` é ignorado pelo Git; `.env.example` traz apenas valores
// sintéticos de desenvolvimento.
//
// O Prisma 7 NÃO carrega mais `.env` automaticamente (docs/08 §10.1, item 12),
// por isso o carregamento é explícito na primeira linha.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "packages/database/prisma/schema.prisma",

  migrations: {
    path: "packages/database/prisma/migrations",
  },

  datasource: {
    // O CLI de migrations usa a role `tlf_migrator` — NUNCA `tlf_app`,
    // que é a role de runtime e não possui DDL (docs/08 §13 `E-02`).
    url: env("MIGRATE_DATABASE_URL"),

    // Shadow database do `prisma migrate dev` (docs/08 §5.5, ponto 6).
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
