-- E-07 — Relações, FKs, unicidades simples e índices simples.
-- docs/08 §13 `E-07`; `docs/07` §8 (cardinalidades), §9.2 (política de ON
-- DELETE), §10.1 (unicidades), §10-A (índices), §28.2 (Categoria A).
--
-- Gerada por `prisma migrate diff --from-migrations --to-schema --script`,
-- revisada integralmente e aplicada por `prisma migrate deploy`.
-- `prisma migrate dev --create-only` não pôde ser usada: exige TTY para
-- confirmar o aviso de criação de unicidade e falha em ambiente não
-- interativo (docs/08 §10, ponto 8). Nenhuma política foi violada —
-- `db push` e `db pull` NÃO foram usados (docs/08 §9.3, §10.2).
--
-- CONTEÚDO (contagens conferidas contra `docs/07`):
--
--   70 FOREIGN KEY, TODAS com ON DELETE RESTRICT (`docs/07` §9.2, §28.2
--      "todas as FKs"). Nas relações OPCIONAIS o RESTRICT explícito é
--      indispensável: o padrão do Prisma nelas seria SET NULL.
--
--   ON UPDATE RESTRICT nas 70 — DECISÃO DE IMPLEMENTAÇÃO, não requisito
--      homologado. Nenhuma fonte fixa política de ON UPDATE; §9.2 trata de
--      deleção. Não há opção neutra: omitir a ação no Prisma produz o
--      comportamento em cascata por padrão, igualmente não homologado. Adotou-se
--      RESTRICT por ser a conservadora e a coerente com o racional de §9.2 —
--      propagar alteração de PK reescreveria FKs silenciosamente em todo o
--      grafo, a classe de reescrita que RN-007/RN-024/RN-044/RN-066 proíbem.
--      NÃO se alega equivalência semântica com a alternativa em cascata: as duas
--      só coincidem enquanto nenhuma PK for alterada. NÃO se invoca a Guarda 1
--      de docs/08 §9.3, que varre remoções de objeto protegido e não ações
--      referenciais. Decisão aprovada por Bruno na revisão pré-versionamento.
--
--   12 CREATE UNIQUE INDEX — U-01, U-02, U-05, U-06, U-07, U-08, U-09, U-10,
--      U-11 (duas tabelas: papel.codigo e permissao.codigo), U-12 e
--      U-13 (= IDX-N2). Exatamente a enumeração de `docs/07` §10.1 e §28.2.
--      `movimento_sessao.chave_idempotencia` NÃO recebe unicidade — `DIV-04`
--      (docs/08 §11), decidida por Bruno. A coluna permanece; a unicidade de
--      `docs/07` §14 é resíduo editorial contradito por §10.1, §10-A, §18,
--      §24.2 e §28.2, e sua citação a C-06 está fora de escopo, pois `docs/06`
--      §13 define C-06 para M8 (pagamento/estorno). Nenhum `U-14` foi criado.
--
--   17 CREATE INDEX simples — IDX-A3, A5, A6, M1, P1, C1, F1, F2, F3, N1, N3,
--      N4, U1, U2, U3, S1 e **IDX-R3** `reserva_sessao(agendamento_id)`.
--      IDX-R3 entra por `DIV-05` (docs/08 §11), decidido por Bruno: `docs/07`
--      §10-A o define como índice simples e não parcial, e §28.2 o omitiu das
--      Categorias A e B. Não é coberto por IDX-R2 (`E-10`), que é parcial.
--      Com IDX-N2 e IDX-F4, que são os uniques acima, esta etapa cobre os 18
--      objetos de §10-A que lhe pertencem.
--
-- AUSÊNCIAS DELIBERADAS — verificadas sobre o DDL EXECUTÁVEL desta migration,
-- isto é, ignorando este bloco de comentário:
--   nenhuma ação referencial em cascata; nenhuma remoção de objeto; nenhum
--   predicado de índice parcial (parciais são `E-10`); nenhuma CHECK (`E-09`);
--   nenhuma coluna gerada (`E-08`); nenhum gatilho nem revogação de privilégio
--   (`E-11`); NENHUMA FK sobre `evento_auditoria.alvo_id`, que permanece sem FK
--   porque o alvo é polimórfico (`docs/07` §22.3).

-- CreateIndex
CREATE INDEX "agendamento_inicio_idx" ON "agendamento"("inicio");

-- CreateIndex
CREATE INDEX "anexo_clinico_registro_clinico_id_idx" ON "anexo_clinico"("registro_clinico_id");

-- CreateIndex
CREATE UNIQUE INDEX "atendimento_agendamento_id_key" ON "atendimento"("agendamento_id");

-- CreateIndex
CREATE INDEX "bloqueio_agenda_profissional_id_inicio_fim_idx" ON "bloqueio_agenda"("profissional_id", "inicio", "fim");

-- CreateIndex
CREATE INDEX "cobranca_paciente_id_idx" ON "cobranca"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "estorno_pagamento_id_key" ON "estorno"("pagamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "estorno_chave_idempotencia_key" ON "estorno"("chave_idempotencia");

-- CreateIndex
CREATE INDEX "evento_auditoria_alvo_tipo_alvo_id_ocorrido_em_idx" ON "evento_auditoria"("alvo_tipo", "alvo_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "evento_auditoria_ator_usuario_id_ocorrido_em_idx" ON "evento_auditoria"("ator_usuario_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "evento_auditoria_correlacao_id_idx" ON "evento_auditoria"("correlacao_id");

-- CreateIndex
CREATE INDEX "historico_agendamento_agendamento_id_ocorrido_em_idx" ON "historico_agendamento"("agendamento_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "movimento_sessao_pacote_id_tipo_idx" ON "movimento_sessao"("pacote_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cpf_key" ON "paciente"("cpf");

-- CreateIndex
CREATE INDEX "pacote_paciente_id_idx" ON "pacote"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_chave_idempotencia_key" ON "pagamento"("chave_idempotencia");

-- CreateIndex
CREATE INDEX "pagamento_cobranca_id_idx" ON "pagamento"("cobranca_id");

-- CreateIndex
CREATE INDEX "pagamento_recebido_em_idx" ON "pagamento"("recebido_em");

-- CreateIndex
CREATE INDEX "pagamento_forma_pagamento_id_idx" ON "pagamento"("forma_pagamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "papel_codigo_key" ON "papel"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permissao_codigo_key" ON "permissao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_usuario_id_key" ON "profissional"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "registro_clinico_atendimento_id_key" ON "registro_clinico"("atendimento_id");

-- CreateIndex
CREATE INDEX "registro_clinico_paciente_id_criado_em_idx" ON "registro_clinico"("paciente_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_sessao_movimento_consumo_id_key" ON "reserva_sessao"("movimento_consumo_id");

-- CreateIndex
CREATE INDEX "reserva_sessao_agendamento_id_idx" ON "reserva_sessao"("agendamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsavel_legal_paciente_id_key" ON "responsavel_legal"("paciente_id");

-- CreateIndex
CREATE INDEX "retificacao_clinica_registro_original_id_idx" ON "retificacao_clinica"("registro_original_id");

-- CreateIndex
CREATE INDEX "sessao_autenticacao_usuario_id_estado_idx" ON "sessao_autenticacao"("usuario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_inativado_por_usuario_id_fkey" FOREIGN KEY ("inativado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "usuario_papel" ADD CONSTRAINT "usuario_papel_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "usuario_papel" ADD CONSTRAINT "usuario_papel_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papel"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "papel_permissao" ADD CONSTRAINT "papel_permissao_papel_id_fkey" FOREIGN KEY ("papel_id") REFERENCES "papel"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "papel_permissao" ADD CONSTRAINT "papel_permissao_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "permissao"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessao_autenticacao" ADD CONSTRAINT "sessao_autenticacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessao_autenticacao" ADD CONSTRAINT "sessao_autenticacao_revogada_por_usuario_id_fkey" FOREIGN KEY ("revogada_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "segredo_recuperacao_senha" ADD CONSTRAINT "segredo_recuperacao_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "segredo_recuperacao_senha" ADD CONSTRAINT "segredo_recuperacao_senha_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "horario_funcionamento" ADD CONSTRAINT "horario_funcionamento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "servico" ADD CONSTRAINT "servico_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "forma_pagamento" ADD CONSTRAINT "forma_pagamento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "motivo_cancelamento" ADD CONSTRAINT "motivo_cancelamento_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinica"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profissional_especialidade" ADD CONSTRAINT "profissional_especialidade_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profissional_especialidade" ADD CONSTRAINT "profissional_especialidade_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidade"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profissional_servico" ADD CONSTRAINT "profissional_servico_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "profissional_servico" ADD CONSTRAINT "profissional_servico_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disponibilidade_profissional" ADD CONSTRAINT "disponibilidade_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contato_emergencia" ADD CONSTRAINT "contato_emergencia_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "responsavel_legal" ADD CONSTRAINT "responsavel_legal_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_registrado_por_usuario_id_fkey" FOREIGN KEY ("registrado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "observacao_administrativa" ADD CONSTRAINT "observacao_administrativa_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "observacao_administrativa" ADD CONSTRAINT "observacao_administrativa_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_motivo_cancelamento_id_fkey" FOREIGN KEY ("motivo_cancelamento_id") REFERENCES "motivo_cancelamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_cancelado_por_usuario_id_fkey" FOREIGN KEY ("cancelado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "bloqueio_agenda" ADD CONSTRAINT "bloqueio_agenda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "bloqueio_agenda" ADD CONSTRAINT "bloqueio_agenda_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "historico_agendamento" ADD CONSTRAINT "historico_agendamento_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "historico_agendamento" ADD CONSTRAINT "historico_agendamento_ator_usuario_id_fkey" FOREIGN KEY ("ator_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "historico_agendamento" ADD CONSTRAINT "historico_agendamento_motivo_cancelamento_id_fkey" FOREIGN KEY ("motivo_cancelamento_id") REFERENCES "motivo_cancelamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "registro_clinico" ADD CONSTRAINT "registro_clinico_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "registro_clinico" ADD CONSTRAINT "registro_clinico_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "registro_clinico" ADD CONSTRAINT "registro_clinico_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "retificacao_clinica" ADD CONSTRAINT "retificacao_clinica_registro_original_id_fkey" FOREIGN KEY ("registro_original_id") REFERENCES "registro_clinico"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "retificacao_clinica" ADD CONSTRAINT "retificacao_clinica_autor_usuario_id_fkey" FOREIGN KEY ("autor_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "anexo_clinico" ADD CONSTRAINT "anexo_clinico_registro_clinico_id_fkey" FOREIGN KEY ("registro_clinico_id") REFERENCES "registro_clinico"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "anexo_clinico" ADD CONSTRAINT "anexo_clinico_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "anexo_clinico" ADD CONSTRAINT "anexo_clinico_enviado_por_usuario_id_fkey" FOREIGN KEY ("enviado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_cancelado_por_usuario_id_fkey" FOREIGN KEY ("cancelado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reserva_sessao" ADD CONSTRAINT "reserva_sessao_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reserva_sessao" ADD CONSTRAINT "reserva_sessao_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reserva_sessao" ADD CONSTRAINT "reserva_sessao_criada_por_usuario_id_fkey" FOREIGN KEY ("criada_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reserva_sessao" ADD CONSTRAINT "reserva_sessao_movimento_consumo_id_fkey" FOREIGN KEY ("movimento_consumo_id") REFERENCES "movimento_sessao"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "movimento_sessao" ADD CONSTRAINT "movimento_sessao_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "movimento_sessao" ADD CONSTRAINT "movimento_sessao_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "movimento_sessao" ADD CONSTRAINT "movimento_sessao_usuario_responsavel_id_fkey" FOREIGN KEY ("usuario_responsavel_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_origem_agendamento_id_fkey" FOREIGN KEY ("origem_agendamento_id") REFERENCES "agendamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_origem_pacote_id_fkey" FOREIGN KEY ("origem_pacote_id") REFERENCES "pacote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_desconto_por_usuario_id_fkey" FOREIGN KEY ("desconto_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_cancelada_por_usuario_id_fkey" FOREIGN KEY ("cancelada_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "cobranca" ADD CONSTRAINT "cobranca_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobranca"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_forma_pagamento_id_fkey" FOREIGN KEY ("forma_pagamento_id") REFERENCES "forma_pagamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_registrado_por_usuario_id_fkey" FOREIGN KEY ("registrado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "estorno" ADD CONSTRAINT "estorno_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "estorno" ADD CONSTRAINT "estorno_estornado_por_usuario_id_fkey" FOREIGN KEY ("estornado_por_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_ator_usuario_id_fkey" FOREIGN KEY ("ator_usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
