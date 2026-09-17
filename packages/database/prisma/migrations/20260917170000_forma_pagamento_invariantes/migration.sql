-- Migration: forma_pagamento_invariantes (CFG-004, D-CFG-34, D-CFG-35)
-- Garantia FÍSICA das invariantes das formas de pagamento (docs/14 §3.12),
-- autorizada expressamente por Bruno Menezes Noronha em 17/09/2026:
--   - descrição única por clínica, ativas E inativas, sem distinção de caixa e
--     sem espaços de borda (D-CFG-34) — violação: SQLSTATE 23505;
--   - coerência entre `ativo` e `inativado_em` (D-CFG-35).
-- Não altera colunas, FKs nem dados de outras tabelas.

CREATE UNIQUE INDEX "ux_forma_pagamento_clinica_descricao" ON "forma_pagamento" ("clinica_id", lower(btrim("descricao")));

ALTER TABLE "forma_pagamento"
  ADD CONSTRAINT "ck_forma_pagamento_situacao"
    CHECK ("ativo" = ("inativado_em" IS NULL));
