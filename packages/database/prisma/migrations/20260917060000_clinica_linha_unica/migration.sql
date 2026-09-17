-- Migration: clinica_linha_unica (CFG-001A, D-CFG-02)
-- Garantia FÍSICA da invariante de clínica única do MVP (TLF-BASE-V1 §5.2;
-- CFG-001; docs/07 §7.2 "restrição de linha única"; docs/08 §8 Categoria C;
-- docs/14 §3.2). Índice único sobre expressão constante: toda linha de
-- `clinica` produz a mesma chave, logo uma segunda linha viola unicidade
-- (SQLSTATE 23505). Não introduz tenant, coluna nem relacionamento.
CREATE UNIQUE INDEX "ux_clinica_linha_unica" ON "clinica" ((true));
