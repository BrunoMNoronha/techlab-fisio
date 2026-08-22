-- Migration E-11: append_only
-- Implementação da proteção de integridade histórica homologada em docs/07 §22.2 / docs/08 §13

-- 1. Proteção append-only pura via REVOKE UPDATE, DELETE da role tlf_app
REVOKE UPDATE, DELETE ON TABLE "evento_auditoria" FROM "tlf_app";
REVOKE UPDATE, DELETE ON TABLE "movimento_sessao" FROM "tlf_app";
REVOKE UPDATE, DELETE ON TABLE "pagamento" FROM "tlf_app";
REVOKE UPDATE, DELETE ON TABLE "estorno" FROM "tlf_app";
REVOKE UPDATE, DELETE ON TABLE "historico_agendamento" FROM "tlf_app";

-- 2. Trigger condicional de imutabilidade de registro_clinico após finalização
CREATE OR REPLACE FUNCTION fn_registro_clinico_bloquear_finalizado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'registro clinico finalizado e imutavel';
END;
$$;

CREATE TRIGGER trg_registro_clinico_imutavel_finalizado
BEFORE UPDATE OR DELETE ON "registro_clinico"
FOR EACH ROW
WHEN (OLD."estado" = 'FINALIZADO')
EXECUTE FUNCTION fn_registro_clinico_bloquear_finalizado();

-- 3. Trigger condicional de imutabilidade de retificacao_clinica após efetivação
CREATE OR REPLACE FUNCTION fn_retificacao_clinica_bloquear_efetivada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'retificacao clinica efetivada e imutavel';
END;
$$;

CREATE TRIGGER trg_retificacao_clinica_imutavel_efetivada
BEFORE UPDATE OR DELETE ON "retificacao_clinica"
FOR EACH ROW
WHEN (OLD."estado" = 'EFETIVADA')
EXECUTE FUNCTION fn_retificacao_clinica_bloquear_efetivada();