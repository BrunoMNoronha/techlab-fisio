-- Migration A: indices_parciais (E-10)
-- Implementação dos seis índices parciais homologados em docs/07 §10-A / docs/08 §13

-- IDX-M2 / U-03: Consumo único por atendimento e pacote (H2-05, RN-034, I-26)
CREATE UNIQUE INDEX "ux_movimento_sessao_consumo_atendimento_pacote" ON "movimento_sessao" ("atendimento_id", "pacote_id") WHERE "tipo" = 'CONSUMO';

-- IDX-R2 / U-04: Reserva ativa única por agendamento (D-07, docs/07 §13.4)
CREATE UNIQUE INDEX "ux_reserva_sessao_ativa_agendamento" ON "reserva_sessao" ("agendamento_id") WHERE "encerrada_em" IS NULL;

-- IDX-R1: Reservas ativas do pacote para disponibilidade (D-07, I-24, H2-10)
CREATE INDEX "ix_reserva_sessao_ativa_pacote" ON "reserva_sessao" ("pacote_id") WHERE "encerrada_em" IS NULL;

-- IDX-A4: Agendamentos vinculados a pacote (HOM-05, RN-071)
CREATE INDEX "ix_agendamento_pacote" ON "agendamento" ("pacote_id") WHERE "pacote_id" IS NOT NULL;

-- IDX-P2: Pacotes não cancelados por data de validade (IND-007, D-05, RN-058)
CREATE INDEX "ix_pacote_validade_ativa" ON "pacote" ("validade_ate") WHERE "cancelado_em" IS NULL;

-- IDX-C2: Cobranças não canceladas por data de referência (IND-005, RN-068, HOM-02)
CREATE INDEX "ix_cobranca_data_referencia_ativa" ON "cobranca" ("data_referencia") WHERE "cancelada_em" IS NULL;