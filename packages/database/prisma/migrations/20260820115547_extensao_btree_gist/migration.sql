-- E-04 — Primeira migration do histórico (docs/08 §13, Bloco II).
--
-- Objetivo único: instalar a extensão `btree_gist`, pré-requisito das
-- exclusion constraints de agenda (`docs/07` §17.2 / IDX-A1, IDX-A2), que serão
-- criadas somente em `E-10`.
--
-- Decisão C-1 (docs/08 §7): a extensão vive EXCLUSIVAMENTE no histórico de
-- migrations. `postgresqlExtensions` é Preview Feature e não existe no Prisma 7
-- na forma assumida por `docs/07` (DIV-02, docs/08 §11) — por isso nada aqui é
-- declarado em `schema.prisma`.
--
-- Idempotência: `IF NOT EXISTS` torna a aplicação repetível sem erro.
-- Auto-suficiência: nenhum passo manual complementa esta migration.

CREATE EXTENSION IF NOT EXISTS btree_gist;
