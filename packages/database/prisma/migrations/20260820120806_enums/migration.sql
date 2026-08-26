-- CreateEnum
CREATE TYPE "estado_agendamento" AS ENUM ('AGENDADO', 'CONFIRMADO', 'AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'FALTA', 'CANCELADO');

-- CreateEnum
CREATE TYPE "modalidade_agendamento" AS ENUM ('AVULSO', 'PACOTE');

-- CreateEnum
CREATE TYPE "estado_registro_clinico" AS ENUM ('EM_ELABORACAO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "estado_retificacao_clinica" AS ENUM ('EM_ELABORACAO', 'EFETIVADA');

-- CreateEnum
CREATE TYPE "estado_sessao_autenticacao" AS ENUM ('ATIVA', 'EXPIRADA', 'REVOGADA');

-- CreateEnum
CREATE TYPE "tipo_movimento_sessao" AS ENUM ('CONSUMO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO');

-- CreateEnum
CREATE TYPE "motivo_encerramento_reserva" AS ENUM ('CANCELAMENTO', 'FALTA', 'DESVINCULACAO', 'CONSUMO');

-- CreateEnum
CREATE TYPE "origem_cobranca" AS ENUM ('AGENDAMENTO_AVULSO', 'PACOTE', 'ADMINISTRATIVA');
