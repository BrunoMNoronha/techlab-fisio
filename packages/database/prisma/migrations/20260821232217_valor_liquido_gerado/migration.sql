-- E-08 — `cobranca.valor_liquido` como COLUNA GERADA STORED.
-- docs/08 §13 `E-08`, §7 decisão `C-2`, verificação `V-02`;
-- `docs/07` §19.2 (`H2.2-18` — parte), §5 (`numeric(12,2)`, nunca `Float`).
--
-- DECISÃO HOMOLOGADA APLICADA — `docs/07` §19.2, alternativa RECOMENDADA:
-- "Coluna gerada (STORED): fonte única, calculada pelo banco; impossível
-- divergir; indexável". As duas alternativas restantes NÃO foram usadas:
-- a derivação na leitura é apenas "fallback aceitável" (`docs/08` §7 `C-2`,
-- opção c) e só poderia ser acionada se `V-02` demonstrasse atrito real; a
-- persistência pela aplicação está REJEITADA na fonte por admitir divergência.
--
-- POR QUE ESTE SQL É ESCRITO À MÃO:
-- o Prisma NÃO representa `GENERATED` na Prisma Schema Language (`docs/08` §7
-- `C-2`). `prisma migrate diff --from-migrations --to-schema` retorna
-- "This is an empty migration" — confirmado antes de escrever este arquivo.
-- Como em `E-07`, `prisma migrate dev --create-only` não pôde ser usada neste
-- ambiente (docs/08 §10, ponto 8); a migration foi revisada integralmente e
-- aplicada por `prisma migrate deploy`. `db push` e `db pull` NÃO foram usados
-- (`docs/08` §9.3, §10.2).
--
-- POR QUE `DROP` + `ADD`, E NÃO UM `ALTER` NO LUGAR:
-- o PostgreSQL não converte uma coluna comum em coluna gerada. `ALTER COLUMN
-- ... SET EXPRESSION AS (...)` (PostgreSQL 17+) só troca a expressão de uma
-- coluna JÁ gerada, e não existe `SET GENERATED ALWAYS AS`. A recriação é o
-- único caminho suportado.
--
-- A RECRIAÇÃO NÃO PERDE DADO NESTE PONTO DO HISTÓRICO: `cobranca` é criada em
-- `E-06` e, quando o histórico é reexecutado do zero (shadow database, CI,
-- `migrate reset`), chega aqui SEM LINHAS — nenhuma etapa entre `E-06` e `E-08`
-- insere dados. O efeito colateral aceito é a mudança de posição ordinal da
-- coluna, que vai para o fim de `cobranca`; nenhuma fonte homologada fixa
-- ordem de colunas, e o Prisma não a considera no diff.
--
-- FORMA FÍSICA PRESERVADA (`docs/07` §5, §19.2): `numeric(12,2)` — decimal
-- exato; a subtração de dois valores de duas casas é exata, SEM arredondamento.
-- `real`/`double precision`/`money` continuam proibidos. `NOT NULL` explícito é
-- mantido: `valor_bruto` e `valor_desconto` são NOT NULL, logo a expressão
-- nunca produz NULL.
--
-- O QUE ESTA MIGRATION NÃO FAZ — pertence a `E-09` em diante e NÃO foi
-- antecipado: a CHECK de RN-042 (`valor_bruto - valor_desconto >= 0`) e todas
-- as demais CHECKs de `docs/07` §10.2 (`E-09`); índices parciais e exclusion
-- constraints (`E-10`); `REVOKE` (`E-11`); triggers.

ALTER TABLE "cobranca" DROP COLUMN "valor_liquido";

ALTER TABLE "cobranca"
  ADD COLUMN "valor_liquido" numeric(12,2) NOT NULL
  GENERATED ALWAYS AS ("valor_bruto" - "valor_desconto") STORED;
