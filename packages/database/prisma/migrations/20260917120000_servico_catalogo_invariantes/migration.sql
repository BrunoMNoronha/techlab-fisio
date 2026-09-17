-- Migration: servico_catalogo_invariantes (CFG-003, D-CFG-22, D-CFG-23)
-- Garantia FÍSICA das invariantes do catálogo de serviços (docs/14 §3.11),
-- autorizada expressamente por Bruno Menezes Noronha em 17/09/2026:
--   - nome único por clínica, ativos E inativos, sem distinção de caixa e sem
--     espaços de borda (D-CFG-22) — violação: SQLSTATE 23505;
--   - duração positiva e preço de referência não negativo (D-CFG-27);
--   - coerência entre `ativo` e `inativado_em` (D-CFG-25).
-- Não altera colunas, FKs nem dados de outras tabelas.

CREATE UNIQUE INDEX "ux_servico_clinica_nome" ON "servico" ("clinica_id", lower(btrim("nome")));

ALTER TABLE "servico"
  ADD CONSTRAINT "ck_servico_duracao_positiva"
    CHECK ("duracao_min" > 0),
  ADD CONSTRAINT "ck_servico_preco_nao_negativo"
    CHECK ("preco_referencia" >= 0),
  ADD CONSTRAINT "ck_servico_situacao"
    CHECK ("ativo" = ("inativado_em" IS NULL));
