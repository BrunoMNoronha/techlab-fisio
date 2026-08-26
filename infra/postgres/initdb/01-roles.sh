#!/usr/bin/env bash
# TechLab Fisio — inicialização de roles do PostgreSQL 18 (docs/08 §13 E-02).
#
# Executado UMA VEZ pelo entrypoint da imagem oficial, com o data directory
# vazio, conectado como superusuário. Torna o ambiente reproduzível a partir de
# container/volume novo: `docker compose down -v && docker compose up -d`
# recria exatamente as mesmas roles e privilégios.
#
# Cria a separação de roles exigida ANTES das proteções de E-11:
#   tlf_migrator — dono do schema, executa migrations, CREATEDB (shadow database)
#   tlf_app      — runtime da aplicação, SEM DDL, não é dona de nenhum objeto
#
# Nenhuma senha é escrita em log: os valores chegam por variável de ambiente e
# são passados ao psql como parâmetros, nunca interpolados em texto ecoado.

set -euo pipefail

: "${TLF_MIGRATOR_USER:?variavel obrigatoria}"
: "${TLF_MIGRATOR_PASSWORD:?variavel obrigatoria}"
: "${TLF_APP_USER:?variavel obrigatoria}"
: "${TLF_APP_PASSWORD:?variavel obrigatoria}"
: "${TLF_SHADOW_DB:?variavel obrigatoria}"

psql -v ON_ERROR_STOP=1 --no-psqlrc --quiet \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v migrator="$TLF_MIGRATOR_USER" -v migrator_pwd="$TLF_MIGRATOR_PASSWORD" \
     -v app="$TLF_APP_USER" -v app_pwd="$TLF_APP_PASSWORD" \
     -v shadow_db="$TLF_SHADOW_DB" -v app_db="$POSTGRES_DB" <<'SQL'
-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
-- Role de migration. Recebe apenas o necessário para migrations:
--   LOGIN     — usada pelo CLI do Prisma
--   CREATEDB  — exigida pelo shadow database do `prisma migrate dev`
-- Deliberadamente SEM SUPERUSER, SEM CREATEROLE, SEM BYPASSRLS, SEM REPLICATION.
CREATE ROLE :"migrator" WITH LOGIN CREATEDB PASSWORD :'migrator_pwd';

-- Role de runtime. Somente LOGIN. Sem DDL, sem CREATEDB, sem ownership.
CREATE ROLE :"app" WITH LOGIN PASSWORD :'app_pwd';

-- ---------------------------------------------------------------------------
-- Ownership do banco da aplicação
-- ---------------------------------------------------------------------------
ALTER DATABASE :"app_db" OWNER TO :"migrator";

-- ---------------------------------------------------------------------------
-- Shadow database do Prisma Migrate, com o mesmo dono
-- ---------------------------------------------------------------------------
CREATE DATABASE :"shadow_db" OWNER :"migrator";
REVOKE ALL ON DATABASE :"shadow_db" FROM PUBLIC;
SQL

# O schema `public` de cada banco precisa pertencer a tlf_migrator, para que ele
# possa criar objetos sem privilégio de superusuário. Isso é feito dentro de
# cada banco, porque ALTER SCHEMA só atua no banco corrente.
for db in "$POSTGRES_DB" "$TLF_SHADOW_DB"; do
  psql -v ON_ERROR_STOP=1 --no-psqlrc --quiet \
       --username "$POSTGRES_USER" --dbname "$db" \
       -v migrator="$TLF_MIGRATOR_USER" -v app="$TLF_APP_USER" <<'SQL'
ALTER SCHEMA public OWNER TO :"migrator";

-- Garantia explícita (já é o padrão desde o PostgreSQL 15): ninguém além do
-- dono cria objetos em `public`.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
done

# Privilégios de runtime — somente no banco da aplicação. O shadow database é
# de uso exclusivo do CLI de migrations e tlf_app não deve alcançá-lo.
psql -v ON_ERROR_STOP=1 --no-psqlrc --quiet \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v migrator="$TLF_MIGRATOR_USER" -v app="$TLF_APP_USER" -v app_db="$POSTGRES_DB" <<'SQL'
GRANT CONNECT ON DATABASE :"app_db" TO :"app";
GRANT USAGE ON SCHEMA public TO :"app";

-- DML apenas, e apenas sobre objetos que tlf_migrator vier a criar.
-- Sem CREATE, sem ownership, sem TRUNCATE, sem REFERENCES, sem TRIGGER.
-- E-11 restringirá ainda mais (REVOKE UPDATE, DELETE nas tabelas append-only).
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app";
SQL

echo "[techlab-fisio] roles tlf_migrator/tlf_app e shadow database inicializados."
