// TechLab Fisio — serviço de configuração dos dados da clínica única
// (CFG-001 sem logotipo + CFG-006 / fatia CFG-001A).
//
// Materializa `docs/14`:
//   - D-CFG-01: a API só consulta e atualiza; ausência da linha ->
//     CLINICA_NAO_CONFIGURADA;
//   - D-CFG-05: `SELECT ... FOR UPDATE` serializa escritores; última escrita
//     válida prevalece; sem versão, sem 409;
//   - D-CFG-06: sem alteração efetiva -> sem UPDATE e sem auditoria;
//   - `docs/09` §13.6: `configuracao.alterada`, alvo `clinica`, contexto
//     VAZIO, na MESMA transação da mutação (rollback conjunto).

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import type { DadosClinicaValidados } from "./clinica.dto.js";

const ALVO_CLINICA = "clinica";

export type MotivoRejeicaoClinica = "CLINICA_NAO_CONFIGURADA";

export class ErroClinica extends Error {
  override readonly name = "ErroClinica";

  constructor(readonly motivo: MotivoRejeicaoClinica) {
    super(`Operação de configuração da clínica rejeitada: ${motivo}.`);
  }
}

export interface DadosClinica extends DadosClinicaValidados {
  readonly id: string;
}

export interface ComandoAtualizarClinica {
  readonly atorUsuarioId: string;
  readonly dados: DadosClinicaValidados;
}

export interface ResultadoAtualizarClinica {
  readonly clinica: DadosClinica;
  readonly mutacaoExecutada: boolean;
}

interface LinhaClinica {
  id: string;
  nome_cadastral: string;
  nome_operacional: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  fuso_horario: string;
}

function mapear(linha: LinhaClinica): DadosClinica {
  return {
    id: linha.id,
    nomeCadastral: linha.nome_cadastral,
    nomeOperacional: linha.nome_operacional,
    endereco: linha.endereco,
    telefone: linha.telefone,
    email: linha.email,
    fusoHorario: linha.fuso_horario,
  };
}

function semAlteracao(atual: DadosClinica, novo: DadosClinicaValidados): boolean {
  return (
    atual.nomeCadastral === novo.nomeCadastral &&
    atual.nomeOperacional === novo.nomeOperacional &&
    atual.endereco === novo.endereco &&
    atual.telefone === novo.telefone &&
    atual.email === novo.email &&
    atual.fusoHorario === novo.fusoHorario
  );
}

/** Garante a invariante: 0 linhas -> não configurada; >1 -> falha técnica. */
function linhaUnica(linhas: LinhaClinica[]): LinhaClinica {
  if (linhas.length === 0) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
  if (linhas.length > 1) {
    throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
  }
  return linhas[0] as LinhaClinica;
}

@Injectable()
export class ClinicaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async consultar(): Promise<DadosClinica> {
    return this.database.transacao(async (tx) => {
      const linhas = await tx.$queryRaw<LinhaClinica[]>`
        SELECT id, nome_cadastral, nome_operacional, endereco, telefone, email, fuso_horario
          FROM clinica
      `;
      return mapear(linhaUnica(linhas));
    });
  }

  async atualizar(comando: ComandoAtualizarClinica): Promise<ResultadoAtualizarClinica> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx: TransacaoPersistencia) => {
      // 1. D-CFG-05 — bloqueio da linha única
      const linhas = await tx.$queryRaw<LinhaClinica[]>`
        SELECT id, nome_cadastral, nome_operacional, endereco, telefone, email, fuso_horario
          FROM clinica
           FOR UPDATE
      `;
      const atual = mapear(linhaUnica(linhas));
      const { dados } = comando;

      // 2. D-CFG-06 — no-op sem UPDATE e sem auditoria
      if (semAlteracao(atual, dados)) {
        return { clinica: atual, mutacaoExecutada: false };
      }

      // 3. Mutação explícita campo a campo (logotipo e duração fora — D-CFG-07)
      await tx.$executeRaw`
        UPDATE clinica
           SET nome_cadastral   = ${dados.nomeCadastral},
               nome_operacional = ${dados.nomeOperacional},
               endereco         = ${dados.endereco},
               telefone         = ${dados.telefone},
               email            = ${dados.email},
               fuso_horario     = ${dados.fusoHorario}
         WHERE id = ${atual.id}::uuid
      `;

      // 4. Auditoria na MESMA transação — contexto VAZIO (docs/09 §13.6)
      await this.auditWriter.registrar(tx, {
        acao: "configuracao.alterada",
        ocorridoEm: new Date(),
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: ALVO_CLINICA,
        alvoId: atual.id,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      });

      return { clinica: { id: atual.id, ...dados }, mutacaoExecutada: true };
    });
  }
}
