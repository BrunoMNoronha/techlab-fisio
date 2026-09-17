-- Migration: disponibilidade_profissional_vigencia (PRO-003, D-PRO3-06)
-- Invariantes FÍSICAS da disponibilidade versionada (docs/16 §4.6), aprovadas
-- expressamente por Bruno Menezes Noronha (P-PRO3-04):
--   - `vigencia_inicio` obrigatória: a API sempre a preenche (D-PRO3-01) e o
--     `NULL` ambíguo deixa de ser representável. Pré-condição medida (FP-09):
--     a tabela não tem escritor de runtime — nenhuma linha de produção existe;
--   - coerência das datas da versão: `vigencia_fim`, quando presente, nunca
--     antecede `vigencia_inicio`;
--   - índice da leitura da versão aplicável (D-PRO3-04) e da leitura de todas
--     as versões do profissional em ordem de vigência (D-PRO3-02).
-- NÃO se cria exclusion constraint de sobreposição (entre versões ou entre
-- janelas), unicidade artificial, tabela de versão, trigger, função, coluna de
-- versão otimista nem coluna de autoria: a não sobreposição é garantida no
-- backend sob `SELECT ... FOR UPDATE` do profissional (D-PRO3-07), como em
-- D-CFG-16. Nenhuma coluna, FK ou dado de outra tabela é alterado.

ALTER TABLE "disponibilidade_profissional"
  ALTER COLUMN "vigencia_inicio" SET NOT NULL;

ALTER TABLE "disponibilidade_profissional"
  ADD CONSTRAINT "ck_disponibilidade_profissional_vigencia"
    CHECK ("vigencia_fim" IS NULL OR "vigencia_fim" >= "vigencia_inicio");

CREATE INDEX "ix_disponibilidade_profissional_vigencia"
  ON "disponibilidade_profissional" ("profissional_id", "vigencia_inicio");
