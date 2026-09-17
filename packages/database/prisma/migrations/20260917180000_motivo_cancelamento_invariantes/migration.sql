-- Migration: motivo_cancelamento_invariantes (CFG-005, D-CFG-46, D-CFG-47)
-- Garantia FÍSICA das invariantes dos motivos de cancelamento (docs/14 §3.13),
-- autorizada por Bruno Menezes Noronha em 17/09/2026:
--   - descrição única por clínica, ativos E inativos, sem distinção de caixa e
--     sem espaços de borda (D-CFG-46) — violação: SQLSTATE 23505;
--   - coerência entre `ativo` e `inativado_em` (D-CFG-47).
-- Nenhuma restrição em `agendamento` ou `historico_agendamento` (D-CFG-51).
-- Não altera colunas, FKs nem dados de outras tabelas.

CREATE UNIQUE INDEX "ux_motivo_cancelamento_clinica_descricao"
  ON "motivo_cancelamento" ("clinica_id", lower(btrim("descricao")));

ALTER TABLE "motivo_cancelamento"
  ADD CONSTRAINT "ck_motivo_cancelamento_situacao"
    CHECK ("ativo" = ("inativado_em" IS NULL));
