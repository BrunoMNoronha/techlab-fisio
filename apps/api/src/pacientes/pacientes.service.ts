// TechLab Fisio — serviço da fatia mínima de pacientes (PAC-A; `docs/17`).
//
// Materializa:
//   - D-PAC-01: "não futura" avaliada contra a data civil corrente no fuso da
//     clínica (D-CFG-60), lida na mesma transação;
//   - D-PAC-03: CPF único (ativo OU inativo) → CPF_JA_CADASTRADO, verificado
//     antes da escrita e garantido pelo índice `paciente_cpf_key` (o 23505
//     DAQUELE índice é traduzido; qualquer outro segue como falha); coincidência
//     forte = mesma data de nascimento E mesmo nome sem caixa/acentos/espaços
//     extras → POSSIVEL_DUPLICIDADE, salvo confirmação explícita; a edição só
//     verifica CPF; nenhum dado do paciente existente é devolvido;
//   - D-PAC-04: busca sem SQL dinâmico (parâmetros anuláveis), `position` em vez
//     de LIKE (nenhum curinga vindo do cliente), limite 20 + `truncado`;
//   - D-PAC-05: criação sempre ativa; situação só pela operação própria;
//   - D-PAC-06: escopo por CÓDIGO DE PAPEL, fail-closed — ADMINISTRADOR ou
//     RECEPCIONISTA → operacional; FISIOTERAPEUTA → relacionado (paciente com
//     algum agendamento cujo `profissional.usuario_id` é o ator); só GESTOR →
//     negado (403); qualquer outro papel → relacionado. Fora do escopo, o
//     detalhe responde PACIENTE_NAO_ENCONTRADO (sem oráculo);
//   - D-PAC-07: `paciente.cadastro.alterado` quando o CPF passa a ter valor na
//     criação ou é incluído/alterado/removido na edição; `paciente.situacao.alterada`
//     em inativação/reativação efetivas; contexto VAZIO; mesma transação;
//   - D-PAC-08: `SELECT ... FOR UPDATE` na linha do paciente em PUT/PATCH; no-op
//     e detecção de mudança de CPF SOB o lock.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { identificarViolacao, type TransacaoPersistencia } from "@techlab-fisio/database";

import { paraInstanteLocal } from "../agenda/horario-funcionamento.regra.js";
import type { AcaoAuditoria } from "../audit/audit.catalog.js";
import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import {
  chaveComparacaoNome,
  LIMITES_PACIENTE,
  type DadosPacienteValidados,
  type FiltroBuscaValidado,
} from "./pacientes.dto.js";

const ALVO_PACIENTE = "paciente";

/** Índice único do CPF (migration `20260820121900`, U-07). */
export const INDICE_CPF_PACIENTE = "paciente_cpf_key";

export type MotivoRejeicaoPaciente =
  | "CLINICA_NAO_CONFIGURADA"
  | "PACIENTE_NAO_ENCONTRADO"
  | "CPF_JA_CADASTRADO"
  | "POSSIVEL_DUPLICIDADE"
  | "DADOS_INVALIDOS"
  | "ACESSO_NEGADO";

export class ErroPaciente extends Error {
  override readonly name = "ErroPaciente";

  constructor(readonly motivo: MotivoRejeicaoPaciente) {
    // Nunca incluir valor pessoal na mensagem (RN-063).
    super(`Operação de paciente rejeitada: ${motivo}.`);
  }
}

export type EscopoPacientes = "OPERACIONAL" | "RELACIONADO" | "NEGADO";

/** D-PAC-06 — resolução fail-closed do escopo a partir dos códigos de papel. */
export function resolverEscopoPacientes(codigosPapel: readonly string[]): EscopoPacientes {
  const papeis = new Set(codigosPapel);
  if (papeis.has("ADMINISTRADOR") || papeis.has("RECEPCIONISTA")) return "OPERACIONAL";
  if (papeis.has("FISIOTERAPEUTA")) return "RELACIONADO";
  if (papeis.has("GESTOR")) return "NEGADO";
  return "RELACIONADO";
}

export interface DadosPaciente {
  readonly id: string;
  readonly nome: string;
  readonly dataNascimento: string | null;
  readonly cpf: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
}

export interface ResumoPaciente {
  readonly id: string;
  readonly nome: string;
  readonly dataNascimento: string | null;
  readonly cpf: string | null;
  readonly ativo: boolean;
}

export interface ResultadoBuscaPacientes {
  readonly pacientes: ResumoPaciente[];
  readonly truncado: boolean;
}

interface LinhaPaciente {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  inativado_em: Date | null;
}

function mapear(l: LinhaPaciente): DadosPaciente {
  return {
    id: l.id,
    nome: l.nome,
    dataNascimento: l.data_nascimento,
    cpf: l.cpf,
    telefone: l.telefone,
    email: l.email,
    ativo: l.ativo,
    inativadoEm: l.inativado_em,
  };
}

/** `true` sse o erro é a violação do índice único do CPF — e de nenhuma outra restrição. */
export function ehCpfDuplicado(erro: unknown): boolean {
  const violacao = identificarViolacao(erro);
  return violacao !== null && violacao.classe === "UNIQUE" && violacao.constraint === INDICE_CPF_PACIENTE;
}

async function traduzirCpfDuplicado<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehCpfDuplicado(erro)) throw new ErroPaciente("CPF_JA_CADASTRADO");
    throw erro;
  }
}

@Injectable()
export class PacientesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async buscar(atorUsuarioId: string, filtro: FiltroBuscaValidado): Promise<ResultadoBuscaPacientes> {
    return this.database.transacao(async (tx) => {
      const escopo = await this.#escopo(tx, atorUsuarioId);
      if (escopo === "NEGADO") throw new ErroPaciente("ACESSO_NEGADO");
      const relacionado = escopo === "RELACIONADO";
      const termo = filtro.nome === null ? null : filtro.nome.toLowerCase();

      const linhas = await tx.$queryRaw<LinhaPaciente[]>`
        SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
               cpf, NULL::text AS telefone, NULL::text AS email, ativo, inativado_em
          FROM paciente
         WHERE (${filtro.cpf}::text IS NULL OR cpf = ${filtro.cpf}::text)
           AND (${filtro.dataNascimento}::date IS NULL OR data_nascimento = ${filtro.dataNascimento}::date)
           AND (${termo}::text IS NULL OR position(${termo}::text in lower(nome)) > 0)
           AND (${filtro.ativo}::boolean IS NULL OR ativo = ${filtro.ativo}::boolean)
           AND (${relacionado}::boolean = false OR id IN (
                 SELECT a.paciente_id
                   FROM agendamento a
                   JOIN profissional p ON p.id = a.profissional_id
                  WHERE p.usuario_id = ${atorUsuarioId}::uuid))
         ORDER BY lower(nome), data_nascimento, id
         LIMIT ${LIMITES_PACIENTE.RESULTADOS_BUSCA + 1}
      `;
      const truncado = linhas.length > LIMITES_PACIENTE.RESULTADOS_BUSCA;
      return {
        pacientes: linhas.slice(0, LIMITES_PACIENTE.RESULTADOS_BUSCA).map((l) => ({
          id: l.id,
          nome: l.nome,
          dataNascimento: l.data_nascimento,
          cpf: l.cpf,
          ativo: l.ativo,
        })),
        truncado,
      };
    });
  }

  async consultar(atorUsuarioId: string, pacienteId: string): Promise<DadosPaciente> {
    return this.database.transacao(async (tx) => {
      const escopo = await this.#escopo(tx, atorUsuarioId);
      if (escopo === "NEGADO") throw new ErroPaciente("ACESSO_NEGADO");
      const linha = await this.#ler(tx, pacienteId, false);
      if (escopo === "RELACIONADO" && !(await this.#relacionado(tx, atorUsuarioId, pacienteId))) {
        throw new ErroPaciente("PACIENTE_NAO_ENCONTRADO");
      }
      return mapear(linha);
    });
  }

  async criar(comando: {
    atorUsuarioId: string;
    dados: DadosPacienteValidados;
    confirmarPossivelDuplicidade: boolean;
  }): Promise<DadosPaciente> {
    const correlacaoId = randomUUID();
    return traduzirCpfDuplicado(
      this.database.transacao(async (tx) => {
        const { dados } = comando;
        await this.#exigirNascimentoNaoFuturo(tx, dados.dataNascimento);

        if (dados.cpf !== null) {
          const existentes = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM paciente WHERE cpf = ${dados.cpf}::text`;
          if (existentes.length > 0) throw new ErroPaciente("CPF_JA_CADASTRADO");
        }

        if (!comando.confirmarPossivelDuplicidade) {
          const mesmaData = await tx.$queryRaw<Array<{ nome: string }>>`
            SELECT nome FROM paciente WHERE data_nascimento = ${dados.dataNascimento}::date`;
          const chave = chaveComparacaoNome(dados.nome);
          if (mesmaData.some((l) => chaveComparacaoNome(l.nome) === chave)) {
            throw new ErroPaciente("POSSIVEL_DUPLICIDADE");
          }
        }

        const criado = await tx.paciente.create({
          data: {
            nome: dados.nome,
            dataNascimento: new Date(`${dados.dataNascimento}T00:00:00.000Z`),
            cpf: dados.cpf,
            telefone: dados.telefone,
            email: dados.email,
            ativo: true,
            inativadoEm: null,
          },
          select: { id: true },
        });

        if (dados.cpf !== null) {
          await this.#auditar(tx, "paciente.cadastro.alterado", comando.atorUsuarioId, criado.id, correlacaoId);
        }
        return mapear(await this.#ler(tx, criado.id, false));
      }),
    );
  }

  async atualizar(comando: {
    atorUsuarioId: string;
    pacienteId: string;
    dados: DadosPacienteValidados;
  }): Promise<DadosPaciente> {
    const correlacaoId = randomUUID();
    return traduzirCpfDuplicado(
      this.database.transacao(async (tx) => {
        const atual = mapear(await this.#ler(tx, comando.pacienteId, true));
        const { dados } = comando;
        await this.#exigirNascimentoNaoFuturo(tx, dados.dataNascimento);

        if (
          atual.nome === dados.nome &&
          atual.dataNascimento === dados.dataNascimento &&
          atual.cpf === dados.cpf &&
          atual.telefone === dados.telefone &&
          atual.email === dados.email
        ) {
          return atual;
        }

        const cpfMudou = atual.cpf !== dados.cpf;
        if (cpfMudou && dados.cpf !== null) {
          const existentes = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM paciente WHERE cpf = ${dados.cpf}::text AND id <> ${atual.id}::uuid`;
          if (existentes.length > 0) throw new ErroPaciente("CPF_JA_CADASTRADO");
        }

        await tx.$executeRaw`
          UPDATE paciente
             SET nome            = ${dados.nome},
                 data_nascimento = ${dados.dataNascimento}::date,
                 cpf             = ${dados.cpf}::text,
                 telefone        = ${dados.telefone}::text,
                 email           = ${dados.email}::text
           WHERE id = ${atual.id}::uuid
        `;
        if (cpfMudou) {
          await this.#auditar(tx, "paciente.cadastro.alterado", comando.atorUsuarioId, atual.id, correlacaoId);
        }
        return mapear(await this.#ler(tx, atual.id, false));
      }),
    );
  }

  async alterarSituacao(comando: {
    atorUsuarioId: string;
    pacienteId: string;
    ativo: boolean;
  }): Promise<DadosPaciente> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const atual = mapear(await this.#ler(tx, comando.pacienteId, true));
      if (atual.ativo === comando.ativo) return atual;

      if (comando.ativo) {
        await tx.$executeRaw`UPDATE paciente SET ativo = true, inativado_em = NULL WHERE id = ${atual.id}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE paciente SET ativo = false, inativado_em = now() WHERE id = ${atual.id}::uuid`;
      }
      await this.#auditar(tx, "paciente.situacao.alterada", comando.atorUsuarioId, atual.id, correlacaoId);
      return mapear(await this.#ler(tx, atual.id, false));
    });
  }

  async #escopo(tx: TransacaoPersistencia, atorUsuarioId: string): Promise<EscopoPacientes> {
    const papeis = await tx.$queryRaw<Array<{ codigo: string }>>`
      SELECT p.codigo
        FROM usuario_papel up
        JOIN papel p ON p.id = up.papel_id
       WHERE up.usuario_id = ${atorUsuarioId}::uuid`;
    return resolverEscopoPacientes(papeis.map((l) => l.codigo));
  }

  async #relacionado(tx: TransacaoPersistencia, atorUsuarioId: string, pacienteId: string): Promise<boolean> {
    const linhas = await tx.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM agendamento a
          JOIN profissional p ON p.id = a.profissional_id
         WHERE a.paciente_id = ${pacienteId}::uuid
           AND p.usuario_id = ${atorUsuarioId}::uuid
      ) AS existe`;
    return linhas[0]?.existe === true;
  }

  /** D-PAC-01: data de nascimento não futura na data civil local da clínica. */
  async #exigirNascimentoNaoFuturo(tx: TransacaoPersistencia, dataNascimento: string): Promise<void> {
    const clinicas = await tx.$queryRaw<Array<{ fuso_horario: string }>>`SELECT fuso_horario FROM clinica`;
    const [clinica] = clinicas;
    if (clinica === undefined) throw new ErroPaciente("CLINICA_NAO_CONFIGURADA");
    if (clinicas.length > 1) {
      throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
    }
    const hoje = paraInstanteLocal(new Date(), clinica.fuso_horario).data;
    if (dataNascimento > hoje) throw new ErroPaciente("DADOS_INVALIDOS");
  }

  async #ler(tx: TransacaoPersistencia, pacienteId: string, bloquear: boolean): Promise<LinhaPaciente> {
    const linhas = bloquear
      ? await tx.$queryRaw<LinhaPaciente[]>`
          SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                 cpf, telefone, email, ativo, inativado_em
            FROM paciente
           WHERE id = ${pacienteId}::uuid
             FOR UPDATE`
      : await tx.$queryRaw<LinhaPaciente[]>`
          SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                 cpf, telefone, email, ativo, inativado_em
            FROM paciente
           WHERE id = ${pacienteId}::uuid`;
    const linha = linhas[0];
    if (linha === undefined) throw new ErroPaciente("PACIENTE_NAO_ENCONTRADO");
    return linha;
  }

  async #auditar(
    tx: TransacaoPersistencia,
    acao: Extract<AcaoAuditoria, "paciente.cadastro.alterado" | "paciente.situacao.alterada">,
    atorUsuarioId: string,
    pacienteId: string,
    correlacaoId: string,
  ): Promise<void> {
    await this.auditWriter.registrar(tx, {
      acao,
      ocorridoEm: new Date(),
      atorUsuarioId,
      alvoTipo: ALVO_PACIENTE,
      alvoId: pacienteId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId,
    });
  }
}
