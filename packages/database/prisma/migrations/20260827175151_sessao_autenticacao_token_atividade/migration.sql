-- Etapa 2.3D-B / F0 — reabertura física CONTROLADA da persistência de sessão.
-- Decisão `D-2.3D-01`, registrada em `docs/12-decisoes-autenticacao-autorizacao.md` §5.1.
-- Requisitos e regras: AUT-001, AUT-002, RN-004; `docs/07` §7.1, §10.2, §22.1;
-- TLF-BASE-V1 §10 ("Não registrar senhas, tokens ... em logs"; "Proteger contra
-- ... abuso de autenticação").
--
-- ÚNICA alteração física autorizada nesta fatia. Nenhum outro objeto — tabela,
-- coluna, índice, enum, trigger, função, REVOKE ou constraint — é tocado.
--
-- 1. `token_hash TEXT NOT NULL`
--    O token de sessão é conceitualmente `<sessao_id>.<segredo>`. O `id` da
--    sessão NÃO é segredo; somente o verificador SHA-256 do segredo é
--    persistido aqui. O segredo em claro NUNCA entra no banco — mesma
--    disciplina já aplicada a `segredo_recuperacao_senha.hash_segredo`
--    (`docs/07` §7.1). Sem DEFAULT: não existe valor neutro legítimo para um
--    verificador, e um default silencioso permitiria criar sessão sem token.
--
-- 2. `ultima_atividade_em TIMESTAMPTZ NOT NULL`
--    Materializa o timeout ocioso de 15 minutos de `D-2.3D-04`. Sem DEFAULT
--    DELIBERADAMENTE: o instante é decidido pela aplicação — na criação e na
--    renovação monotônica —, nunca pelo relógio implícito do banco. Um
--    `DEFAULT now()` faria o backend parecer estar aplicando a regra quando o
--    banco a estivesse preenchendo sozinho.
--    NÃO existe coluna separada de expiração ociosa: `expira_em` continua sendo
--    o prazo ABSOLUTO fixado na criação (8 horas, `D-2.3D-04`) e não é sliding;
--    a expiração ociosa é derivada de `ultima_atividade_em` pelo backend.
--
-- 3. `ck_sessao_autenticacao_atividade`
--    CHECK físico da coerência temporal homologada:
--      `criada_em <= ultima_atividade_em <= expira_em`.
--    Nome pela convenção determinística `ck_<tabela>_<regra>` já vigente em
--    `E-09` (C-6, `docs/08` §10 ponto 5). Complementa — não substitui — a CHECK
--    `ck_sessao_autenticacao_expiracao` (`expira_em > criada_em`), que
--    permanece intacta. As duas convivem: a existente garante janela absoluta
--    não-degenerada; esta garante que a atividade viva DENTRO dessa janela.
--    Os limites são INCLUSIVOS: a sessão recém-criada tem
--    `ultima_atividade_em = criada_em` (caso legítimo), e uma atividade no
--    instante exato de `expira_em` ainda pertence à janela — o corte de
--    expiração é da aplicação, e um `<` estrito rejeitaria fisicamente uma
--    escrita legítima de borda.
--
-- POR QUE O `ADD COLUMN ... NOT NULL` SEM DEFAULT É SEGURO AQUI:
-- `sessao_autenticacao` estava VAZIA quando a decisão foi tomada — 0 linha
-- medida no banco de desenvolvimento em 27/08/2026 — e, no replay do histórico
-- a partir de banco vazio (`E-15`, shadow database, CI), chega a este ponto sem
-- linhas por construção: nenhuma migration anterior insere dados. Por isso
-- NENHUMA estratégia de backfill é necessária. Se, em algum ambiente, a tabela
-- tiver linhas, o PostgreSQL rejeitará este `ALTER` — falha ruidosa e
-- deliberada: popular sessões existentes exigiria decisão própria, não um
-- default improvisado.
--
-- A CHECK É ESCRITA À MÃO porque o Prisma não representa CHECK constraints na
-- Prisma Schema Language (`docs/07` §22.1; `docs/08` §10 ponto 3). O par
-- ALTER TABLE das colunas veio de `prisma migrate dev --create-only`; a CHECK
-- foi acrescentada na revisão do SQL gerado (`docs/08` §10 ponto 4). `db push`
-- e `db pull` NÃO foram usados (`docs/08` §9.3, §10.2).
--
-- O QUE ESTA MIGRATION NÃO FAZ — pertence às fatias F1..F7 da Etapa 2.3D-B e
-- NÃO foi antecipado: hashing de senha (Argon2id, `D-2.3D-02`); normalização de
-- `usuario.email` (`D-2.3D-03` — nenhuma alteração de schema de e-mail, nenhum
-- `citext`, nenhum índice funcional); rate limiting (`D-2.3D-06`); cookies e
-- CSRF (`D-2.3D-07`); recuperação de senha (`D-2.3D-08`); seed de RBAC
-- (`D-2.3D-09`); bootstrap do primeiro Administrador (`D-2.3D-10`); OpenAPI
-- (`D-2.3D-11`); qualquer ação nova de auditoria ou ampliação de whitelist
-- (`D-2.3D-12` opera dentro do catálogo e da whitelist VAZIA já homologados em
-- `docs/09` §12).

-- AlterTable
ALTER TABLE "sessao_autenticacao" ADD COLUMN     "token_hash" TEXT NOT NULL,
ADD COLUMN     "ultima_atividade_em" TIMESTAMPTZ(6) NOT NULL;

-- CHECK de coerência temporal da sessão (AUT-002, RN-004, `D-2.3D-01`/`D-2.3D-04`).
ALTER TABLE "sessao_autenticacao"
  ADD CONSTRAINT "ck_sessao_autenticacao_atividade"
    CHECK (
      "ultima_atividade_em" >= "criada_em"
      AND "ultima_atividade_em" <= "expira_em"
    );
