-- Migration B: exclusion_agenda (E-10)
-- Implementação das duas exclusion constraints homologadas em docs/07 §10-A, §17 / docs/08 §13

-- IDX-A1: Conflito de agenda por profissional em estados que ocupam horário (AGD-005, RN-015.1, C-01)
ALTER TABLE "agendamento" ADD CONSTRAINT "ex_agendamento_profissional"
  EXCLUDE USING gist (
    "profissional_id" WITH =,
    tstzrange("inicio", "fim", '[)') WITH &&
  )
  WHERE ("estado" IN ('AGENDADO', 'CONFIRMADO', 'AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO'));

-- IDX-A2: Conflito de agenda por paciente em estados que ocupam horário (D-06, RN-015.3)
ALTER TABLE "agendamento" ADD CONSTRAINT "ex_agendamento_paciente"
  EXCLUDE USING gist (
    "paciente_id" WITH =,
    tstzrange("inicio", "fim", '[)') WITH &&
  )
  WHERE ("estado" IN ('AGENDADO', 'CONFIRMADO', 'AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO'));