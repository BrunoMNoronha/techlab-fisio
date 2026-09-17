-- Migration: profissional_situacao_coerente (PRO-005, D-PRO1-07)
-- Garantia FÍSICA da coerência entre `ativo` e `inativado_em` em
-- `profissional` (docs/18 §4.7), autorizada expressamente por Bruno Menezes
-- Noronha em 17/09/2026, no precedente de ck_servico_situacao (D-CFG-23) e
-- ck_forma_pagamento_situacao (D-CFG-35). Nenhuma unicidade nova.
-- Não altera colunas, FKs nem dados de outras tabelas.

ALTER TABLE "profissional"
  ADD CONSTRAINT "ck_profissional_situacao"
    CHECK ("ativo" = ("inativado_em" IS NULL));
