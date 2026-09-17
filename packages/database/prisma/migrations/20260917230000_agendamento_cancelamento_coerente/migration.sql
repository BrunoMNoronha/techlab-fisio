-- TechLab Fisio — AGD-A — coerência física do cancelamento de agendamento.
--
-- Fonte normativa: `docs/15` `D-AGD-07` (homologada por Bruno Menezes Noronha
-- em 17/09/2026, inclusive a alteração estrutural), com autorização expressa
-- de materialização nesta execução. Resolve `D-CFG-51`: a decisão posterior da
-- agenda substitui o registro de CFG-005 de que nenhuma restrição nova entraria
-- em `agendamento`.
--
-- Invariante, literal da decisão:
--   CHECK ((estado = 'CANCELADO') = (motivo_cancelamento_id IS NOT NULL
--          AND cancelado_em IS NOT NULL
--          AND cancelado_por_usuario_id IS NOT NULL))
--
-- Consequências, ambas deliberadas:
--   1. um agendamento CANCELADO sem motivo, sem instante ou sem ator é
--      rejeitado pelo banco — o motivo padronizado de AGD-003 deixa de
--      depender só da aplicação;
--   2. os três campos de cancelamento só existem no estado CANCELADO — nenhum
--      outro estado pode carregá-los, o que impede resíduo de uma remarcação
--      ou confirmação posterior a um cancelamento.
--
-- Verificação prévia de dados legados exigida por `D-AGD-07`: `agendamento` é
-- criada pela migration `20260820121255_entidades_e_colunas` e NENHUMA
-- migration posterior insere linha alguma nela; não há seed, fixture versionada
-- ou carga que a popule. A tabela está vazia em toda reconstrução from-scratch,
-- de modo que a restrição é aplicável sem saneamento.
--
-- Escopo: UMA constraint. Nenhuma coluna, índice, trigger, enum, função ou
-- privilégio é criado, alterado ou removido aqui; nenhuma migration anterior é
-- editada.

ALTER TABLE "agendamento"
  ADD CONSTRAINT "ck_agendamento_cancelamento_coerente"
  CHECK (
    ("estado" = 'CANCELADO') = (
      "motivo_cancelamento_id" IS NOT NULL
      AND "cancelado_em" IS NOT NULL
      AND "cancelado_por_usuario_id" IS NOT NULL
    )
  );
