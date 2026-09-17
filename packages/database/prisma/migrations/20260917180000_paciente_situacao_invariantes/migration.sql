-- Migration: paciente_situacao_invariantes (PAC-A, D-PAC-09)
-- Garantia FÍSICA da fatia mínima de pacientes (docs/17 §4.9), aprovada
-- expressamente por Bruno Menezes Noronha em 17/09/2026 (P-PAC-09):
--   - coerência entre `ativo` e `inativado_em` (D-PAC-05);
--   - índice por `data_nascimento` para a detecção de coincidência forte
--     (D-PAC-03) e a busca por data (D-PAC-04).
-- `data_nascimento` permanece anulável no banco (a obrigatoriedade é da API).
-- Não altera colunas, FKs nem dados de outras tabelas.

ALTER TABLE "paciente"
  ADD CONSTRAINT "ck_paciente_situacao"
    CHECK ("ativo" = ("inativado_em" IS NULL));

CREATE INDEX "ix_paciente_data_nascimento" ON "paciente" ("data_nascimento");
