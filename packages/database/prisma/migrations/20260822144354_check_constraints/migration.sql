-- E-09 — CHECK constraints de integridade de domínio.
-- docs/08 §13 `E-09`, docs/07 §10.2;
-- Requisitos e regras: AGD-001, AGD-004, PKG-001, PKG-003, PKG-005, PKG-007,
-- RN-024, RN-027, RN-031, RN-033, RN-034, RN-038, RN-042, FIN-004, AUT-002,
-- CFG-002, PRO-003, H2.2-13, D-01, D-06, docs/06 §9, docs/07 §19.1.
--
-- TODAS AS 25 CHECK CONSTRAINTS HOMOLOGADAS EM docs/07 §10.2:
-- Nomes determinísticos seguindo a convenção `ck_<tabela>_<regra>`.
--
-- O QUE ESTA MIGRATION NÃO FAZ (pertence a E-10+ e NÃO foi antecipado):
-- - Índices parciais (IDX-M2/U-03, IDX-R2/U-04, IDX-R1, IDX-A4, IDX-P2, IDX-C2) -> E-10
-- - Exclusion constraints (ex_agendamento_profissional, ex_agendamento_paciente) -> E-10
-- - Triggers de imutabilidade e append-only -> E-11
-- - Revogações de privilégio (REVOKE) -> E-11

-- 1. agendamento (AGD-001, PKG-003)
ALTER TABLE "agendamento"
  ADD CONSTRAINT "ck_agendamento_intervalo"
    CHECK ("fim" > "inicio"),
  ADD CONSTRAINT "ck_agendamento_modalidade_pacote"
    CHECK (
      ("modalidade" = 'PACOTE' AND "pacote_id" IS NOT NULL) OR
      ("modalidade" = 'AVULSO' AND "pacote_id" IS NULL)
    );

-- 2. bloqueio_agenda (AGD-004)
ALTER TABLE "bloqueio_agenda"
  ADD CONSTRAINT "ck_bloqueio_agenda_intervalo"
    CHECK ("fim" > "inicio");

-- 3. movimento_sessao (RN-031, RN-033/034, PKG-005, RN-038, PKG-007)
ALTER TABLE "movimento_sessao"
  ADD CONSTRAINT "ck_movimento_sessao_quantidade_positiva"
    CHECK ("quantidade" > 0),
  ADD CONSTRAINT "ck_movimento_sessao_tipo_atendimento"
    CHECK (
      ("tipo" = 'CONSUMO' AND "atendimento_id" IS NOT NULL) OR
      ("tipo" <> 'CONSUMO' AND "atendimento_id" IS NULL)
    ),
  ADD CONSTRAINT "ck_movimento_sessao_consumo_unitario"
    CHECK (
      "tipo" <> 'CONSUMO' OR "quantidade" = 1
    ),
  ADD CONSTRAINT "ck_movimento_sessao_justificativa_ajuste"
    CHECK (
      "tipo" = 'CONSUMO' OR ("justificativa" IS NOT NULL AND trim("justificativa") <> '')
    );

-- 4. reserva_sessao (docs/07 §13.2)
ALTER TABLE "reserva_sessao"
  ADD CONSTRAINT "ck_reserva_sessao_encerramento"
    CHECK (
      ("encerrada_em" IS NULL AND "motivo_encerramento" IS NULL) OR
      ("encerrada_em" IS NOT NULL AND "motivo_encerramento" IS NOT NULL)
    ),
  ADD CONSTRAINT "ck_reserva_sessao_consumo_movimento"
    CHECK (
      ("motivo_encerramento" = 'CONSUMO' AND "movimento_consumo_id" IS NOT NULL) OR
      (("motivo_encerramento" IS NULL OR "motivo_encerramento" <> 'CONSUMO') AND "movimento_consumo_id" IS NULL)
    );

-- 5. pacote (PKG-001, H2-09, docs/07 §7.7)
ALTER TABLE "pacote"
  ADD CONSTRAINT "ck_pacote_quantidade_positiva"
    CHECK ("quantidade_contratada" > 0),
  ADD CONSTRAINT "ck_pacote_cancelamento"
    CHECK (
      ("cancelado_em" IS NULL AND "cancelado_por_usuario_id" IS NULL AND "motivo_cancelamento" IS NULL) OR
      ("cancelado_em" IS NOT NULL AND "cancelado_por_usuario_id" IS NOT NULL)
    );

-- 6. cobranca (RN-042, FIN-003, docs/06 §9, docs/07 §19.1)
ALTER TABLE "cobranca"
  ADD CONSTRAINT "ck_cobranca_valor_bruto_nao_negativo"
    CHECK ("valor_bruto" >= 0),
  ADD CONSTRAINT "ck_cobranca_valor_desconto_nao_negativo"
    CHECK ("valor_desconto" >= 0),
  ADD CONSTRAINT "ck_cobranca_valor_liquido_nao_negativo"
    CHECK ("valor_bruto" - "valor_desconto" >= 0),
  ADD CONSTRAINT "ck_cobranca_origem"
    CHECK (
      ("origem_tipo" = 'AGENDAMENTO_AVULSO' AND "origem_agendamento_id" IS NOT NULL AND "origem_pacote_id" IS NULL) OR
      ("origem_tipo" = 'PACOTE' AND "origem_pacote_id" IS NOT NULL AND "origem_agendamento_id" IS NULL) OR
      ("origem_tipo" = 'ADMINISTRATIVA' AND "origem_agendamento_id" IS NULL AND "origem_pacote_id" IS NULL)
    );

-- 7. pagamento (FIN-004)
ALTER TABLE "pagamento"
  ADD CONSTRAINT "ck_pagamento_valor_positivo"
    CHECK ("valor" > 0);

-- 8. paciente (H2.2-13, docs/07 §11.4.1)
ALTER TABLE "paciente"
  ADD CONSTRAINT "ck_paciente_cpf_formato"
    CHECK ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$');

-- 9. registro_clinico (RN-024, PRN-004)
ALTER TABLE "registro_clinico"
  ADD CONSTRAINT "ck_registro_clinico_finalizacao"
    CHECK (
      ("estado" = 'FINALIZADO' AND "finalizado_em" IS NOT NULL) OR
      ("estado" = 'EM_ELABORACAO' AND "finalizado_em" IS NULL)
    );

-- 10. retificacao_clinica (RN-027, D-01)
ALTER TABLE "retificacao_clinica"
  ADD CONSTRAINT "ck_retificacao_clinica_efetivacao"
    CHECK (
      ("estado" = 'EFETIVADA' AND "efetivada_em" IS NOT NULL) OR
      ("estado" = 'EM_ELABORACAO' AND "efetivada_em" IS NULL)
    ),
  ADD CONSTRAINT "ck_retificacao_clinica_justificativa"
    CHECK (trim("justificativa") <> '');

-- 11. horario_funcionamento (CFG-002, PRO-003)
ALTER TABLE "horario_funcionamento"
  ADD CONSTRAINT "ck_horario_funcionamento_intervalo"
    CHECK ("hora_fim" > "hora_inicio"),
  ADD CONSTRAINT "ck_horario_funcionamento_dia_semana"
    CHECK ("dia_semana" >= 0 AND "dia_semana" <= 6);

-- 12. disponibilidade_profissional (CFG-002, PRO-003)
ALTER TABLE "disponibilidade_profissional"
  ADD CONSTRAINT "ck_disponibilidade_profissional_intervalo"
    CHECK ("hora_fim" > "hora_inicio"),
  ADD CONSTRAINT "ck_disponibilidade_profissional_dia_semana"
    CHECK ("dia_semana" >= 0 AND "dia_semana" <= 6);

-- 13. sessao_autenticacao (AUT-002)
ALTER TABLE "sessao_autenticacao"
  ADD CONSTRAINT "ck_sessao_autenticacao_expiracao"
    CHECK ("expira_em" > "criada_em");