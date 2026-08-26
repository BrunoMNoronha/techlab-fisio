--
-- PostgreSQL database dump
--

\restrict tlfgoldene16

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg12+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: estado_agendamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_agendamento AS ENUM (
    'AGENDADO',
    'CONFIRMADO',
    'AGUARDANDO',
    'EM_ATENDIMENTO',
    'CONCLUIDO',
    'FALTA',
    'CANCELADO'
);


--
-- Name: estado_registro_clinico; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_registro_clinico AS ENUM (
    'EM_ELABORACAO',
    'FINALIZADO'
);


--
-- Name: estado_retificacao_clinica; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_retificacao_clinica AS ENUM (
    'EM_ELABORACAO',
    'EFETIVADA'
);


--
-- Name: estado_sessao_autenticacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_sessao_autenticacao AS ENUM (
    'ATIVA',
    'EXPIRADA',
    'REVOGADA'
);


--
-- Name: modalidade_agendamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.modalidade_agendamento AS ENUM (
    'AVULSO',
    'PACOTE'
);


--
-- Name: motivo_encerramento_reserva; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.motivo_encerramento_reserva AS ENUM (
    'CANCELAMENTO',
    'FALTA',
    'DESVINCULACAO',
    'CONSUMO'
);


--
-- Name: origem_cobranca; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.origem_cobranca AS ENUM (
    'AGENDAMENTO_AVULSO',
    'PACOTE',
    'ADMINISTRATIVA'
);


--
-- Name: tipo_movimento_sessao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_movimento_sessao AS ENUM (
    'CONSUMO',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO'
);


--
-- Name: fn_registro_clinico_bloquear_finalizado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_registro_clinico_bloquear_finalizado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'registro clinico finalizado e imutavel';
END;
$$;


--
-- Name: fn_retificacao_clinica_bloquear_efetivada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_retificacao_clinica_bloquear_efetivada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'retificacao clinica efetivada e imutavel';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: agendamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamento (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    profissional_id uuid NOT NULL,
    servico_id uuid NOT NULL,
    inicio timestamp(6) with time zone NOT NULL,
    fim timestamp(6) with time zone NOT NULL,
    estado public.estado_agendamento NOT NULL,
    modalidade public.modalidade_agendamento NOT NULL,
    pacote_id uuid,
    motivo_cancelamento_id uuid,
    cancelado_em timestamp(6) with time zone,
    cancelado_por_usuario_id uuid,
    criado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(6) with time zone NOT NULL,
    CONSTRAINT ck_agendamento_intervalo CHECK ((fim > inicio)),
    CONSTRAINT ck_agendamento_modalidade_pacote CHECK ((((modalidade = 'PACOTE'::public.modalidade_agendamento) AND (pacote_id IS NOT NULL)) OR ((modalidade = 'AVULSO'::public.modalidade_agendamento) AND (pacote_id IS NULL))))
);


--
-- Name: anexo_clinico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anexo_clinico (
    id uuid NOT NULL,
    registro_clinico_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    chave_objeto text NOT NULL,
    nome_original text NOT NULL,
    mime_type text NOT NULL,
    tamanho_bytes integer NOT NULL,
    enviado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: atendimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atendimento (
    id uuid NOT NULL,
    agendamento_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    iniciado_em timestamp(6) with time zone NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bloqueio_agenda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bloqueio_agenda (
    id uuid NOT NULL,
    profissional_id uuid NOT NULL,
    inicio timestamp(6) with time zone NOT NULL,
    fim timestamp(6) with time zone NOT NULL,
    motivo text,
    criado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_bloqueio_agenda_intervalo CHECK ((fim > inicio))
);


--
-- Name: clinica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinica (
    id uuid NOT NULL,
    nome_cadastral text NOT NULL,
    nome_operacional text,
    endereco text,
    telefone text,
    email text,
    logotipo_chave text,
    fuso_horario text NOT NULL,
    duracao_padrao_atendimento_min integer,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cobranca; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobranca (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    origem_tipo public.origem_cobranca NOT NULL,
    origem_agendamento_id uuid,
    origem_pacote_id uuid,
    valor_bruto numeric(12,2) NOT NULL,
    valor_desconto numeric(12,2) DEFAULT 0 NOT NULL,
    data_referencia date NOT NULL,
    desconto_por_usuario_id uuid,
    cancelada_em timestamp(6) with time zone,
    cancelada_por_usuario_id uuid,
    motivo_cancelamento text,
    criado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(6) with time zone NOT NULL,
    valor_liquido numeric(12,2) GENERATED ALWAYS AS ((valor_bruto - valor_desconto)) STORED NOT NULL,
    CONSTRAINT ck_cobranca_origem CHECK ((((origem_tipo = 'AGENDAMENTO_AVULSO'::public.origem_cobranca) AND (origem_agendamento_id IS NOT NULL) AND (origem_pacote_id IS NULL)) OR ((origem_tipo = 'PACOTE'::public.origem_cobranca) AND (origem_pacote_id IS NOT NULL) AND (origem_agendamento_id IS NULL)) OR ((origem_tipo = 'ADMINISTRATIVA'::public.origem_cobranca) AND (origem_agendamento_id IS NULL) AND (origem_pacote_id IS NULL)))),
    CONSTRAINT ck_cobranca_valor_bruto_nao_negativo CHECK ((valor_bruto >= (0)::numeric)),
    CONSTRAINT ck_cobranca_valor_desconto_nao_negativo CHECK ((valor_desconto >= (0)::numeric)),
    CONSTRAINT ck_cobranca_valor_liquido_nao_negativo CHECK (((valor_bruto - valor_desconto) >= (0)::numeric))
);


--
-- Name: consentimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consentimento (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    tipo text NOT NULL,
    concedido_em timestamp(6) with time zone NOT NULL,
    revogado_em timestamp(6) with time zone,
    registrado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: contato_emergencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contato_emergencia (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: disponibilidade_profissional; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disponibilidade_profissional (
    id uuid NOT NULL,
    profissional_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time(6) without time zone NOT NULL,
    hora_fim time(6) without time zone NOT NULL,
    vigencia_inicio date,
    vigencia_fim date,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_disponibilidade_profissional_dia_semana CHECK (((dia_semana >= 0) AND (dia_semana <= 6))),
    CONSTRAINT ck_disponibilidade_profissional_intervalo CHECK ((hora_fim > hora_inicio))
);


--
-- Name: especialidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidade (
    id uuid NOT NULL,
    nome text NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: estorno; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estorno (
    id uuid NOT NULL,
    pagamento_id uuid NOT NULL,
    estornado_em timestamp(6) with time zone NOT NULL,
    estornado_por_usuario_id uuid NOT NULL,
    motivo text NOT NULL,
    chave_idempotencia text,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: evento_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_auditoria (
    id uuid NOT NULL,
    ocorrido_em timestamp(6) with time zone NOT NULL,
    ator_usuario_id uuid,
    acao text NOT NULL,
    alvo_tipo text NOT NULL,
    alvo_id uuid,
    resultado text NOT NULL,
    justificativa text,
    correlacao_id uuid NOT NULL,
    contexto jsonb,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: forma_pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forma_pagamento (
    id uuid NOT NULL,
    clinica_id uuid NOT NULL,
    descricao text NOT NULL,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: historico_agendamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_agendamento (
    id uuid NOT NULL,
    agendamento_id uuid NOT NULL,
    operacao text NOT NULL,
    estado_anterior public.estado_agendamento,
    estado_novo public.estado_agendamento,
    inicio_anterior timestamp(6) with time zone,
    fim_anterior timestamp(6) with time zone,
    inicio_novo timestamp(6) with time zone,
    fim_novo timestamp(6) with time zone,
    ator_usuario_id uuid NOT NULL,
    ocorrido_em timestamp(6) with time zone NOT NULL,
    motivo_cancelamento_id uuid,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: horario_funcionamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horario_funcionamento (
    id uuid NOT NULL,
    clinica_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time(6) without time zone NOT NULL,
    hora_fim time(6) without time zone NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_horario_funcionamento_dia_semana CHECK (((dia_semana >= 0) AND (dia_semana <= 6))),
    CONSTRAINT ck_horario_funcionamento_intervalo CHECK ((hora_fim > hora_inicio))
);


--
-- Name: motivo_cancelamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motivo_cancelamento (
    id uuid NOT NULL,
    clinica_id uuid NOT NULL,
    descricao text NOT NULL,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: movimento_sessao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimento_sessao (
    id uuid NOT NULL,
    pacote_id uuid NOT NULL,
    tipo public.tipo_movimento_sessao NOT NULL,
    quantidade integer NOT NULL,
    atendimento_id uuid,
    usuario_responsavel_id uuid NOT NULL,
    justificativa text,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    chave_idempotencia text,
    CONSTRAINT ck_movimento_sessao_consumo_unitario CHECK (((tipo <> 'CONSUMO'::public.tipo_movimento_sessao) OR (quantidade = 1))),
    CONSTRAINT ck_movimento_sessao_justificativa_ajuste CHECK (((tipo = 'CONSUMO'::public.tipo_movimento_sessao) OR ((justificativa IS NOT NULL) AND (TRIM(BOTH FROM justificativa) <> ''::text)))),
    CONSTRAINT ck_movimento_sessao_quantidade_positiva CHECK ((quantidade > 0)),
    CONSTRAINT ck_movimento_sessao_tipo_atendimento CHECK ((((tipo = 'CONSUMO'::public.tipo_movimento_sessao) AND (atendimento_id IS NOT NULL)) OR ((tipo <> 'CONSUMO'::public.tipo_movimento_sessao) AND (atendimento_id IS NULL))))
);


--
-- Name: observacao_administrativa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observacao_administrativa (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    texto text NOT NULL,
    autor_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: paciente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paciente (
    id uuid NOT NULL,
    nome text NOT NULL,
    data_nascimento date,
    cpf text,
    telefone text,
    email text,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_paciente_cpf_formato CHECK (((cpf IS NULL) OR (cpf ~ '^[0-9]{11}$'::text)))
);


--
-- Name: pacote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacote (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    servico_id uuid NOT NULL,
    quantidade_contratada integer NOT NULL,
    data_contratacao date NOT NULL,
    validade_ate date,
    cancelado_em timestamp(6) with time zone,
    cancelado_por_usuario_id uuid,
    motivo_cancelamento text,
    criado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(6) with time zone NOT NULL,
    CONSTRAINT ck_pacote_cancelamento CHECK ((((cancelado_em IS NULL) AND (cancelado_por_usuario_id IS NULL) AND (motivo_cancelamento IS NULL)) OR ((cancelado_em IS NOT NULL) AND (cancelado_por_usuario_id IS NOT NULL)))),
    CONSTRAINT ck_pacote_quantidade_positiva CHECK ((quantidade_contratada > 0))
);


--
-- Name: pagamento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamento (
    id uuid NOT NULL,
    cobranca_id uuid NOT NULL,
    valor numeric(12,2) NOT NULL,
    forma_pagamento_id uuid NOT NULL,
    recebido_em timestamp(6) with time zone NOT NULL,
    registrado_por_usuario_id uuid NOT NULL,
    chave_idempotencia text,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_pagamento_valor_positivo CHECK ((valor > (0)::numeric))
);


--
-- Name: papel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.papel (
    id uuid NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: papel_permissao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.papel_permissao (
    papel_id uuid NOT NULL,
    permissao_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: permissao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissao (
    id uuid NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: profissional; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional (
    id uuid NOT NULL,
    usuario_id uuid,
    nome text NOT NULL,
    registro_profissional text,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: profissional_especialidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional_especialidade (
    profissional_id uuid NOT NULL,
    especialidade_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: profissional_servico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional_servico (
    profissional_id uuid NOT NULL,
    servico_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: registro_clinico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registro_clinico (
    id uuid NOT NULL,
    atendimento_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    autor_usuario_id uuid NOT NULL,
    estado public.estado_registro_clinico NOT NULL,
    finalizado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_registro_clinico_finalizacao CHECK ((((estado = 'FINALIZADO'::public.estado_registro_clinico) AND (finalizado_em IS NOT NULL)) OR ((estado = 'EM_ELABORACAO'::public.estado_registro_clinico) AND (finalizado_em IS NULL))))
);


--
-- Name: reserva_sessao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserva_sessao (
    id uuid NOT NULL,
    pacote_id uuid NOT NULL,
    agendamento_id uuid NOT NULL,
    criada_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    criada_por_usuario_id uuid NOT NULL,
    encerrada_em timestamp(6) with time zone,
    motivo_encerramento public.motivo_encerramento_reserva,
    movimento_consumo_id uuid,
    CONSTRAINT ck_reserva_sessao_consumo_movimento CHECK ((((motivo_encerramento = 'CONSUMO'::public.motivo_encerramento_reserva) AND (movimento_consumo_id IS NOT NULL)) OR (((motivo_encerramento IS NULL) OR (motivo_encerramento <> 'CONSUMO'::public.motivo_encerramento_reserva)) AND (movimento_consumo_id IS NULL)))),
    CONSTRAINT ck_reserva_sessao_encerramento CHECK ((((encerrada_em IS NULL) AND (motivo_encerramento IS NULL)) OR ((encerrada_em IS NOT NULL) AND (motivo_encerramento IS NOT NULL))))
);


--
-- Name: responsavel_legal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsavel_legal (
    id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: retificacao_clinica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retificacao_clinica (
    id uuid NOT NULL,
    registro_original_id uuid NOT NULL,
    autor_usuario_id uuid NOT NULL,
    justificativa text NOT NULL,
    estado public.estado_retificacao_clinica NOT NULL,
    efetivada_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_retificacao_clinica_efetivacao CHECK ((((estado = 'EFETIVADA'::public.estado_retificacao_clinica) AND (efetivada_em IS NOT NULL)) OR ((estado = 'EM_ELABORACAO'::public.estado_retificacao_clinica) AND (efetivada_em IS NULL)))),
    CONSTRAINT ck_retificacao_clinica_justificativa CHECK ((TRIM(BOTH FROM justificativa) <> ''::text))
);


--
-- Name: segredo_recuperacao_senha; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segredo_recuperacao_senha (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    hash_segredo text NOT NULL,
    expira_em timestamp(6) with time zone NOT NULL,
    consumido_em timestamp(6) with time zone,
    criado_por_usuario_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: servico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servico (
    id uuid NOT NULL,
    clinica_id uuid NOT NULL,
    nome text NOT NULL,
    duracao_min integer NOT NULL,
    preco_referencia numeric(12,2) NOT NULL,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: sessao_autenticacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessao_autenticacao (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    estado public.estado_sessao_autenticacao NOT NULL,
    criada_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expira_em timestamp(6) with time zone NOT NULL,
    encerrada_em timestamp(6) with time zone,
    revogada_por_usuario_id uuid,
    CONSTRAINT ck_sessao_autenticacao_expiracao CHECK ((expira_em > criada_em))
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id uuid NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    nome text NOT NULL,
    ativo boolean NOT NULL,
    inativado_em timestamp(6) with time zone,
    inativado_por_usuario_id uuid,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(6) with time zone NOT NULL
);


--
-- Name: usuario_papel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_papel (
    usuario_id uuid NOT NULL,
    papel_id uuid NOT NULL,
    criado_em timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: agendamento agendamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_pkey PRIMARY KEY (id);


--
-- Name: anexo_clinico anexo_clinico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_clinico
    ADD CONSTRAINT anexo_clinico_pkey PRIMARY KEY (id);


--
-- Name: atendimento atendimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento
    ADD CONSTRAINT atendimento_pkey PRIMARY KEY (id);


--
-- Name: bloqueio_agenda bloqueio_agenda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueio_agenda
    ADD CONSTRAINT bloqueio_agenda_pkey PRIMARY KEY (id);


--
-- Name: clinica clinica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinica
    ADD CONSTRAINT clinica_pkey PRIMARY KEY (id);


--
-- Name: cobranca cobranca_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_pkey PRIMARY KEY (id);


--
-- Name: consentimento consentimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consentimento
    ADD CONSTRAINT consentimento_pkey PRIMARY KEY (id);


--
-- Name: contato_emergencia contato_emergencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_emergencia
    ADD CONSTRAINT contato_emergencia_pkey PRIMARY KEY (id);


--
-- Name: disponibilidade_profissional disponibilidade_profissional_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disponibilidade_profissional
    ADD CONSTRAINT disponibilidade_profissional_pkey PRIMARY KEY (id);


--
-- Name: especialidade especialidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidade
    ADD CONSTRAINT especialidade_pkey PRIMARY KEY (id);


--
-- Name: estorno estorno_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estorno
    ADD CONSTRAINT estorno_pkey PRIMARY KEY (id);


--
-- Name: evento_auditoria evento_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_auditoria
    ADD CONSTRAINT evento_auditoria_pkey PRIMARY KEY (id);


--
-- Name: agendamento ex_agendamento_paciente; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT ex_agendamento_paciente EXCLUDE USING gist (paciente_id WITH =, tstzrange(inicio, fim, '[)'::text) WITH &&) WHERE ((estado = ANY (ARRAY['AGENDADO'::public.estado_agendamento, 'CONFIRMADO'::public.estado_agendamento, 'AGUARDANDO'::public.estado_agendamento, 'EM_ATENDIMENTO'::public.estado_agendamento, 'CONCLUIDO'::public.estado_agendamento])));


--
-- Name: agendamento ex_agendamento_profissional; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT ex_agendamento_profissional EXCLUDE USING gist (profissional_id WITH =, tstzrange(inicio, fim, '[)'::text) WITH &&) WHERE ((estado = ANY (ARRAY['AGENDADO'::public.estado_agendamento, 'CONFIRMADO'::public.estado_agendamento, 'AGUARDANDO'::public.estado_agendamento, 'EM_ATENDIMENTO'::public.estado_agendamento, 'CONCLUIDO'::public.estado_agendamento])));


--
-- Name: forma_pagamento forma_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forma_pagamento
    ADD CONSTRAINT forma_pagamento_pkey PRIMARY KEY (id);


--
-- Name: historico_agendamento historico_agendamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_agendamento
    ADD CONSTRAINT historico_agendamento_pkey PRIMARY KEY (id);


--
-- Name: horario_funcionamento horario_funcionamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_funcionamento
    ADD CONSTRAINT horario_funcionamento_pkey PRIMARY KEY (id);


--
-- Name: motivo_cancelamento motivo_cancelamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motivo_cancelamento
    ADD CONSTRAINT motivo_cancelamento_pkey PRIMARY KEY (id);


--
-- Name: movimento_sessao movimento_sessao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimento_sessao
    ADD CONSTRAINT movimento_sessao_pkey PRIMARY KEY (id);


--
-- Name: observacao_administrativa observacao_administrativa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observacao_administrativa
    ADD CONSTRAINT observacao_administrativa_pkey PRIMARY KEY (id);


--
-- Name: paciente paciente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paciente
    ADD CONSTRAINT paciente_pkey PRIMARY KEY (id);


--
-- Name: pacote pacote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacote
    ADD CONSTRAINT pacote_pkey PRIMARY KEY (id);


--
-- Name: pagamento pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento
    ADD CONSTRAINT pagamento_pkey PRIMARY KEY (id);


--
-- Name: papel_permissao papel_permissao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel_permissao
    ADD CONSTRAINT papel_permissao_pkey PRIMARY KEY (papel_id, permissao_id);


--
-- Name: papel papel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel
    ADD CONSTRAINT papel_pkey PRIMARY KEY (id);


--
-- Name: permissao permissao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissao
    ADD CONSTRAINT permissao_pkey PRIMARY KEY (id);


--
-- Name: profissional_especialidade profissional_especialidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidade
    ADD CONSTRAINT profissional_especialidade_pkey PRIMARY KEY (profissional_id, especialidade_id);


--
-- Name: profissional profissional_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional
    ADD CONSTRAINT profissional_pkey PRIMARY KEY (id);


--
-- Name: profissional_servico profissional_servico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_servico
    ADD CONSTRAINT profissional_servico_pkey PRIMARY KEY (profissional_id, servico_id);


--
-- Name: registro_clinico registro_clinico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_clinico
    ADD CONSTRAINT registro_clinico_pkey PRIMARY KEY (id);


--
-- Name: reserva_sessao reserva_sessao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_sessao
    ADD CONSTRAINT reserva_sessao_pkey PRIMARY KEY (id);


--
-- Name: responsavel_legal responsavel_legal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_legal
    ADD CONSTRAINT responsavel_legal_pkey PRIMARY KEY (id);


--
-- Name: retificacao_clinica retificacao_clinica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retificacao_clinica
    ADD CONSTRAINT retificacao_clinica_pkey PRIMARY KEY (id);


--
-- Name: segredo_recuperacao_senha segredo_recuperacao_senha_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segredo_recuperacao_senha
    ADD CONSTRAINT segredo_recuperacao_senha_pkey PRIMARY KEY (id);


--
-- Name: servico servico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico
    ADD CONSTRAINT servico_pkey PRIMARY KEY (id);


--
-- Name: sessao_autenticacao sessao_autenticacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessao_autenticacao
    ADD CONSTRAINT sessao_autenticacao_pkey PRIMARY KEY (id);


--
-- Name: usuario_papel usuario_papel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_papel
    ADD CONSTRAINT usuario_papel_pkey PRIMARY KEY (usuario_id, papel_id);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);


--
-- Name: agendamento_inicio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agendamento_inicio_idx ON public.agendamento USING btree (inicio);


--
-- Name: anexo_clinico_registro_clinico_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anexo_clinico_registro_clinico_id_idx ON public.anexo_clinico USING btree (registro_clinico_id);


--
-- Name: atendimento_agendamento_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX atendimento_agendamento_id_key ON public.atendimento USING btree (agendamento_id);


--
-- Name: bloqueio_agenda_profissional_id_inicio_fim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bloqueio_agenda_profissional_id_inicio_fim_idx ON public.bloqueio_agenda USING btree (profissional_id, inicio, fim);


--
-- Name: cobranca_paciente_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cobranca_paciente_id_idx ON public.cobranca USING btree (paciente_id);


--
-- Name: estorno_chave_idempotencia_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX estorno_chave_idempotencia_key ON public.estorno USING btree (chave_idempotencia);


--
-- Name: estorno_pagamento_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX estorno_pagamento_id_key ON public.estorno USING btree (pagamento_id);


--
-- Name: evento_auditoria_alvo_tipo_alvo_id_ocorrido_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evento_auditoria_alvo_tipo_alvo_id_ocorrido_em_idx ON public.evento_auditoria USING btree (alvo_tipo, alvo_id, ocorrido_em);


--
-- Name: evento_auditoria_ator_usuario_id_ocorrido_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evento_auditoria_ator_usuario_id_ocorrido_em_idx ON public.evento_auditoria USING btree (ator_usuario_id, ocorrido_em);


--
-- Name: evento_auditoria_correlacao_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evento_auditoria_correlacao_id_idx ON public.evento_auditoria USING btree (correlacao_id);


--
-- Name: historico_agendamento_agendamento_id_ocorrido_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX historico_agendamento_agendamento_id_ocorrido_em_idx ON public.historico_agendamento USING btree (agendamento_id, ocorrido_em);


--
-- Name: ix_agendamento_pacote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agendamento_pacote ON public.agendamento USING btree (pacote_id) WHERE (pacote_id IS NOT NULL);


--
-- Name: ix_cobranca_data_referencia_ativa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cobranca_data_referencia_ativa ON public.cobranca USING btree (data_referencia) WHERE (cancelada_em IS NULL);


--
-- Name: ix_pacote_validade_ativa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pacote_validade_ativa ON public.pacote USING btree (validade_ate) WHERE (cancelado_em IS NULL);


--
-- Name: ix_reserva_sessao_ativa_pacote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reserva_sessao_ativa_pacote ON public.reserva_sessao USING btree (pacote_id) WHERE (encerrada_em IS NULL);


--
-- Name: movimento_sessao_pacote_id_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movimento_sessao_pacote_id_tipo_idx ON public.movimento_sessao USING btree (pacote_id, tipo);


--
-- Name: paciente_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX paciente_cpf_key ON public.paciente USING btree (cpf);


--
-- Name: pacote_paciente_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pacote_paciente_id_idx ON public.pacote USING btree (paciente_id);


--
-- Name: pagamento_chave_idempotencia_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pagamento_chave_idempotencia_key ON public.pagamento USING btree (chave_idempotencia);


--
-- Name: pagamento_cobranca_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagamento_cobranca_id_idx ON public.pagamento USING btree (cobranca_id);


--
-- Name: pagamento_forma_pagamento_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagamento_forma_pagamento_id_idx ON public.pagamento USING btree (forma_pagamento_id);


--
-- Name: pagamento_recebido_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagamento_recebido_em_idx ON public.pagamento USING btree (recebido_em);


--
-- Name: papel_codigo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX papel_codigo_key ON public.papel USING btree (codigo);


--
-- Name: permissao_codigo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissao_codigo_key ON public.permissao USING btree (codigo);


--
-- Name: profissional_usuario_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profissional_usuario_id_key ON public.profissional USING btree (usuario_id);


--
-- Name: registro_clinico_atendimento_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registro_clinico_atendimento_id_key ON public.registro_clinico USING btree (atendimento_id);


--
-- Name: registro_clinico_paciente_id_criado_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registro_clinico_paciente_id_criado_em_idx ON public.registro_clinico USING btree (paciente_id, criado_em);


--
-- Name: reserva_sessao_agendamento_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reserva_sessao_agendamento_id_idx ON public.reserva_sessao USING btree (agendamento_id);


--
-- Name: reserva_sessao_movimento_consumo_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reserva_sessao_movimento_consumo_id_key ON public.reserva_sessao USING btree (movimento_consumo_id);


--
-- Name: responsavel_legal_paciente_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX responsavel_legal_paciente_id_key ON public.responsavel_legal USING btree (paciente_id);


--
-- Name: retificacao_clinica_registro_original_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retificacao_clinica_registro_original_id_idx ON public.retificacao_clinica USING btree (registro_original_id);


--
-- Name: sessao_autenticacao_usuario_id_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessao_autenticacao_usuario_id_estado_idx ON public.sessao_autenticacao USING btree (usuario_id, estado);


--
-- Name: usuario_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX usuario_email_key ON public.usuario USING btree (email);


--
-- Name: ux_movimento_sessao_consumo_atendimento_pacote; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_movimento_sessao_consumo_atendimento_pacote ON public.movimento_sessao USING btree (atendimento_id, pacote_id) WHERE (tipo = 'CONSUMO'::public.tipo_movimento_sessao);


--
-- Name: ux_reserva_sessao_ativa_agendamento; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_reserva_sessao_ativa_agendamento ON public.reserva_sessao USING btree (agendamento_id) WHERE (encerrada_em IS NULL);


--
-- Name: registro_clinico trg_registro_clinico_imutavel_finalizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_registro_clinico_imutavel_finalizado BEFORE DELETE OR UPDATE ON public.registro_clinico FOR EACH ROW WHEN ((old.estado = 'FINALIZADO'::public.estado_registro_clinico)) EXECUTE FUNCTION public.fn_registro_clinico_bloquear_finalizado();


--
-- Name: retificacao_clinica trg_retificacao_clinica_imutavel_efetivada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_retificacao_clinica_imutavel_efetivada BEFORE DELETE OR UPDATE ON public.retificacao_clinica FOR EACH ROW WHEN ((old.estado = 'EFETIVADA'::public.estado_retificacao_clinica)) EXECUTE FUNCTION public.fn_retificacao_clinica_bloquear_efetivada();


--
-- Name: agendamento agendamento_cancelado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_cancelado_por_usuario_id_fkey FOREIGN KEY (cancelado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_motivo_cancelamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_motivo_cancelamento_id_fkey FOREIGN KEY (motivo_cancelamento_id) REFERENCES public.motivo_cancelamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_pacote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_pacote_id_fkey FOREIGN KEY (pacote_id) REFERENCES public.pacote(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissional(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento agendamento_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servico(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: anexo_clinico anexo_clinico_enviado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_clinico
    ADD CONSTRAINT anexo_clinico_enviado_por_usuario_id_fkey FOREIGN KEY (enviado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: anexo_clinico anexo_clinico_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_clinico
    ADD CONSTRAINT anexo_clinico_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: anexo_clinico anexo_clinico_registro_clinico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anexo_clinico
    ADD CONSTRAINT anexo_clinico_registro_clinico_id_fkey FOREIGN KEY (registro_clinico_id) REFERENCES public.registro_clinico(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: atendimento atendimento_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento
    ADD CONSTRAINT atendimento_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: atendimento atendimento_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento
    ADD CONSTRAINT atendimento_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: bloqueio_agenda bloqueio_agenda_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueio_agenda
    ADD CONSTRAINT bloqueio_agenda_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: bloqueio_agenda bloqueio_agenda_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bloqueio_agenda
    ADD CONSTRAINT bloqueio_agenda_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissional(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_cancelada_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_cancelada_por_usuario_id_fkey FOREIGN KEY (cancelada_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_desconto_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_desconto_por_usuario_id_fkey FOREIGN KEY (desconto_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_origem_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_origem_agendamento_id_fkey FOREIGN KEY (origem_agendamento_id) REFERENCES public.agendamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_origem_pacote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_origem_pacote_id_fkey FOREIGN KEY (origem_pacote_id) REFERENCES public.pacote(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cobranca cobranca_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobranca
    ADD CONSTRAINT cobranca_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: consentimento consentimento_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consentimento
    ADD CONSTRAINT consentimento_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: consentimento consentimento_registrado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consentimento
    ADD CONSTRAINT consentimento_registrado_por_usuario_id_fkey FOREIGN KEY (registrado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: contato_emergencia contato_emergencia_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contato_emergencia
    ADD CONSTRAINT contato_emergencia_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: disponibilidade_profissional disponibilidade_profissional_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disponibilidade_profissional
    ADD CONSTRAINT disponibilidade_profissional_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissional(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: estorno estorno_estornado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estorno
    ADD CONSTRAINT estorno_estornado_por_usuario_id_fkey FOREIGN KEY (estornado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: estorno estorno_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estorno
    ADD CONSTRAINT estorno_pagamento_id_fkey FOREIGN KEY (pagamento_id) REFERENCES public.pagamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: evento_auditoria evento_auditoria_ator_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_auditoria
    ADD CONSTRAINT evento_auditoria_ator_usuario_id_fkey FOREIGN KEY (ator_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: forma_pagamento forma_pagamento_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forma_pagamento
    ADD CONSTRAINT forma_pagamento_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinica(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: historico_agendamento historico_agendamento_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_agendamento
    ADD CONSTRAINT historico_agendamento_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: historico_agendamento historico_agendamento_ator_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_agendamento
    ADD CONSTRAINT historico_agendamento_ator_usuario_id_fkey FOREIGN KEY (ator_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: historico_agendamento historico_agendamento_motivo_cancelamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_agendamento
    ADD CONSTRAINT historico_agendamento_motivo_cancelamento_id_fkey FOREIGN KEY (motivo_cancelamento_id) REFERENCES public.motivo_cancelamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: horario_funcionamento horario_funcionamento_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horario_funcionamento
    ADD CONSTRAINT horario_funcionamento_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinica(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: motivo_cancelamento motivo_cancelamento_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motivo_cancelamento
    ADD CONSTRAINT motivo_cancelamento_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinica(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: movimento_sessao movimento_sessao_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimento_sessao
    ADD CONSTRAINT movimento_sessao_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: movimento_sessao movimento_sessao_pacote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimento_sessao
    ADD CONSTRAINT movimento_sessao_pacote_id_fkey FOREIGN KEY (pacote_id) REFERENCES public.pacote(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: movimento_sessao movimento_sessao_usuario_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimento_sessao
    ADD CONSTRAINT movimento_sessao_usuario_responsavel_id_fkey FOREIGN KEY (usuario_responsavel_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: observacao_administrativa observacao_administrativa_autor_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observacao_administrativa
    ADD CONSTRAINT observacao_administrativa_autor_usuario_id_fkey FOREIGN KEY (autor_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: observacao_administrativa observacao_administrativa_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observacao_administrativa
    ADD CONSTRAINT observacao_administrativa_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pacote pacote_cancelado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacote
    ADD CONSTRAINT pacote_cancelado_por_usuario_id_fkey FOREIGN KEY (cancelado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pacote pacote_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacote
    ADD CONSTRAINT pacote_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pacote pacote_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacote
    ADD CONSTRAINT pacote_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pacote pacote_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacote
    ADD CONSTRAINT pacote_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servico(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pagamento pagamento_cobranca_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento
    ADD CONSTRAINT pagamento_cobranca_id_fkey FOREIGN KEY (cobranca_id) REFERENCES public.cobranca(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pagamento pagamento_forma_pagamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento
    ADD CONSTRAINT pagamento_forma_pagamento_id_fkey FOREIGN KEY (forma_pagamento_id) REFERENCES public.forma_pagamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pagamento pagamento_registrado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento
    ADD CONSTRAINT pagamento_registrado_por_usuario_id_fkey FOREIGN KEY (registrado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: papel_permissao papel_permissao_papel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel_permissao
    ADD CONSTRAINT papel_permissao_papel_id_fkey FOREIGN KEY (papel_id) REFERENCES public.papel(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: papel_permissao papel_permissao_permissao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel_permissao
    ADD CONSTRAINT papel_permissao_permissao_id_fkey FOREIGN KEY (permissao_id) REFERENCES public.permissao(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: profissional_especialidade profissional_especialidade_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidade
    ADD CONSTRAINT profissional_especialidade_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidade(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: profissional_especialidade profissional_especialidade_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidade
    ADD CONSTRAINT profissional_especialidade_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissional(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: profissional_servico profissional_servico_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_servico
    ADD CONSTRAINT profissional_servico_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissional(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: profissional_servico profissional_servico_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_servico
    ADD CONSTRAINT profissional_servico_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES public.servico(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: profissional profissional_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional
    ADD CONSTRAINT profissional_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: registro_clinico registro_clinico_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_clinico
    ADD CONSTRAINT registro_clinico_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: registro_clinico registro_clinico_autor_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_clinico
    ADD CONSTRAINT registro_clinico_autor_usuario_id_fkey FOREIGN KEY (autor_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: registro_clinico registro_clinico_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registro_clinico
    ADD CONSTRAINT registro_clinico_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: reserva_sessao reserva_sessao_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_sessao
    ADD CONSTRAINT reserva_sessao_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamento(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: reserva_sessao reserva_sessao_criada_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_sessao
    ADD CONSTRAINT reserva_sessao_criada_por_usuario_id_fkey FOREIGN KEY (criada_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: reserva_sessao reserva_sessao_movimento_consumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_sessao
    ADD CONSTRAINT reserva_sessao_movimento_consumo_id_fkey FOREIGN KEY (movimento_consumo_id) REFERENCES public.movimento_sessao(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: reserva_sessao reserva_sessao_pacote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserva_sessao
    ADD CONSTRAINT reserva_sessao_pacote_id_fkey FOREIGN KEY (pacote_id) REFERENCES public.pacote(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: responsavel_legal responsavel_legal_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_legal
    ADD CONSTRAINT responsavel_legal_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.paciente(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: retificacao_clinica retificacao_clinica_autor_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retificacao_clinica
    ADD CONSTRAINT retificacao_clinica_autor_usuario_id_fkey FOREIGN KEY (autor_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: retificacao_clinica retificacao_clinica_registro_original_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retificacao_clinica
    ADD CONSTRAINT retificacao_clinica_registro_original_id_fkey FOREIGN KEY (registro_original_id) REFERENCES public.registro_clinico(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: segredo_recuperacao_senha segredo_recuperacao_senha_criado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segredo_recuperacao_senha
    ADD CONSTRAINT segredo_recuperacao_senha_criado_por_usuario_id_fkey FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: segredo_recuperacao_senha segredo_recuperacao_senha_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segredo_recuperacao_senha
    ADD CONSTRAINT segredo_recuperacao_senha_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: servico servico_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servico
    ADD CONSTRAINT servico_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinica(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sessao_autenticacao sessao_autenticacao_revogada_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessao_autenticacao
    ADD CONSTRAINT sessao_autenticacao_revogada_por_usuario_id_fkey FOREIGN KEY (revogada_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sessao_autenticacao sessao_autenticacao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessao_autenticacao
    ADD CONSTRAINT sessao_autenticacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario usuario_inativado_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_inativado_por_usuario_id_fkey FOREIGN KEY (inativado_por_usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_papel usuario_papel_papel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_papel
    ADD CONSTRAINT usuario_papel_papel_id_fkey FOREIGN KEY (papel_id) REFERENCES public.papel(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario_papel usuario_papel_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_papel
    ADD CONSTRAINT usuario_papel_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict tlfgoldene16

