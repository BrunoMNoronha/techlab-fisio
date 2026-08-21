-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "inativado_por_usuario_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papel" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissao" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_papel" (
    "usuario_id" UUID NOT NULL,
    "papel_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_papel_pkey" PRIMARY KEY ("usuario_id","papel_id")
);

-- CreateTable
CREATE TABLE "papel_permissao" (
    "papel_id" UUID NOT NULL,
    "permissao_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papel_permissao_pkey" PRIMARY KEY ("papel_id","permissao_id")
);

-- CreateTable
CREATE TABLE "sessao_autenticacao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado" "estado_sessao_autenticacao" NOT NULL,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(6),
    "revogada_por_usuario_id" UUID,

    CONSTRAINT "sessao_autenticacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segredo_recuperacao_senha" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "hash_segredo" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "consumido_em" TIMESTAMPTZ(6),
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segredo_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinica" (
    "id" UUID NOT NULL,
    "nome_cadastral" TEXT NOT NULL,
    "nome_operacional" TEXT,
    "endereco" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "logotipo_chave" TEXT,
    "fuso_horario" TEXT NOT NULL,
    "duracao_padrao_atendimento_min" INTEGER,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_funcionamento" (
    "id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horario_funcionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servico" (
    "id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "duracao_min" INTEGER NOT NULL,
    "preco_referencia" DECIMAL(12,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forma_pagamento" (
    "id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forma_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motivo_cancelamento" (
    "id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motivo_cancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "nome" TEXT NOT NULL,
    "registro_profissional" TEXT,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especialidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional_especialidade" (
    "profissional_id" UUID NOT NULL,
    "especialidade_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissional_especialidade_pkey" PRIMARY KEY ("profissional_id","especialidade_id")
);

-- CreateTable
CREATE TABLE "profissional_servico" (
    "profissional_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissional_servico_pkey" PRIMARY KEY ("profissional_id","servico_id")
);

-- CreateTable
CREATE TABLE "disponibilidade_profissional" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "vigencia_inicio" DATE,
    "vigencia_fim" DATE,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidade_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "data_nascimento" DATE,
    "cpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contato_emergencia" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contato_emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsavel_legal" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsavel_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimento" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "concedido_em" TIMESTAMPTZ(6) NOT NULL,
    "revogado_em" TIMESTAMPTZ(6),
    "registrado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observacao_administrativa" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "autor_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observacao_administrativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "fim" TIMESTAMPTZ(6) NOT NULL,
    "estado" "estado_agendamento" NOT NULL,
    "modalidade" "modalidade_agendamento" NOT NULL,
    "pacote_id" UUID,
    "motivo_cancelamento_id" UUID,
    "cancelado_em" TIMESTAMPTZ(6),
    "cancelado_por_usuario_id" UUID,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueio_agenda" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "fim" TIMESTAMPTZ(6) NOT NULL,
    "motivo" TEXT,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueio_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_agendamento" (
    "id" UUID NOT NULL,
    "agendamento_id" UUID NOT NULL,
    "operacao" TEXT NOT NULL,
    "estado_anterior" "estado_agendamento",
    "estado_novo" "estado_agendamento",
    "inicio_anterior" TIMESTAMPTZ(6),
    "fim_anterior" TIMESTAMPTZ(6),
    "inicio_novo" TIMESTAMPTZ(6),
    "fim_novo" TIMESTAMPTZ(6),
    "ator_usuario_id" UUID NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL,
    "motivo_cancelamento_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento" (
    "id" UUID NOT NULL,
    "agendamento_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "iniciado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_clinico" (
    "id" UUID NOT NULL,
    "atendimento_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "autor_usuario_id" UUID NOT NULL,
    "estado" "estado_registro_clinico" NOT NULL,
    "finalizado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_clinico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retificacao_clinica" (
    "id" UUID NOT NULL,
    "registro_original_id" UUID NOT NULL,
    "autor_usuario_id" UUID NOT NULL,
    "justificativa" TEXT NOT NULL,
    "estado" "estado_retificacao_clinica" NOT NULL,
    "efetivada_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retificacao_clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo_clinico" (
    "id" UUID NOT NULL,
    "registro_clinico_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "chave_objeto" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "enviado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_clinico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "quantidade_contratada" INTEGER NOT NULL,
    "data_contratacao" DATE NOT NULL,
    "validade_ate" DATE,
    "cancelado_em" TIMESTAMPTZ(6),
    "cancelado_por_usuario_id" UUID,
    "motivo_cancelamento" TEXT,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_sessao" (
    "id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "agendamento_id" UUID NOT NULL,
    "criada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criada_por_usuario_id" UUID NOT NULL,
    "encerrada_em" TIMESTAMPTZ(6),
    "motivo_encerramento" "motivo_encerramento_reserva",
    "movimento_consumo_id" UUID,

    CONSTRAINT "reserva_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimento_sessao" (
    "id" UUID NOT NULL,
    "pacote_id" UUID NOT NULL,
    "tipo" "tipo_movimento_sessao" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "atendimento_id" UUID,
    "usuario_responsavel_id" UUID NOT NULL,
    "justificativa" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chave_idempotencia" TEXT,

    CONSTRAINT "movimento_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobranca" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "origem_tipo" "origem_cobranca" NOT NULL,
    "origem_agendamento_id" UUID,
    "origem_pacote_id" UUID,
    "valor_bruto" DECIMAL(12,2) NOT NULL,
    "valor_desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valor_liquido" DECIMAL(12,2) NOT NULL,
    "data_referencia" DATE NOT NULL,
    "desconto_por_usuario_id" UUID,
    "cancelada_em" TIMESTAMPTZ(6),
    "cancelada_por_usuario_id" UUID,
    "motivo_cancelamento" TEXT,
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento" (
    "id" UUID NOT NULL,
    "cobranca_id" UUID NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "forma_pagamento_id" UUID NOT NULL,
    "recebido_em" TIMESTAMPTZ(6) NOT NULL,
    "registrado_por_usuario_id" UUID NOT NULL,
    "chave_idempotencia" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estorno" (
    "id" UUID NOT NULL,
    "pagamento_id" UUID NOT NULL,
    "estornado_em" TIMESTAMPTZ(6) NOT NULL,
    "estornado_por_usuario_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "chave_idempotencia" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estorno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_auditoria" (
    "id" UUID NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL,
    "ator_usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "alvo_tipo" TEXT NOT NULL,
    "alvo_id" UUID,
    "resultado" TEXT NOT NULL,
    "justificativa" TEXT,
    "correlacao_id" UUID NOT NULL,
    "contexto" JSONB,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_auditoria_pkey" PRIMARY KEY ("id")
);
