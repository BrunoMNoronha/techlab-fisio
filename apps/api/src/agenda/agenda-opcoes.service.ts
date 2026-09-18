// TechLab Fisio — `GET /agenda/opcoes` (`docs/15` D-AGD-13; resolve `D-CFG-30`,
// `D-CFG-55` e a parte de catálogos de `D-CFG-65`).
//
// Devolve SOMENTE o que a operação da agenda precisa para montar um
// agendamento ou um cancelamento, e nada além disso:
//
//   - `servicos` .............. somente ATIVOS, com `duracaoMin`. **Sem preço
//     de referência** — privilégio mínimo: `agenda.gerenciar` não é
//     `clinica.configurar`, e a rota administrativa `/servicos` permanece
//     inalterada, sob a permissão dela;
//   - `motivosCancelamento` ... somente ATIVOS, `{ id, descricao }`. Lista
//     vazia é resposta legítima e significa, por D-AGD-07, que nenhum
//     cancelamento é possível até que o Administrador cadastre um motivo;
//   - `horarioFuncionamento` .. a grade semanal vigente, em ordem canônica;
//   - `fusoHorario` ........... o identificador IANA da clínica (D-CFG-60), sem
//     o qual o cliente não sabe interpretar a grade.
//
// Nenhuma permissão nova, nenhuma rota administrativa ampliada, nenhuma
// auditoria (leitura). Uma única transação, para que as quatro leituras sejam
// coerentes entre si.

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import { ordenarJanelas, type JanelaFuncionamento } from "../clinica/horario-funcionamento.dto.js";

export interface ServicoOpcao {
  readonly id: string;
  readonly nome: string;
  readonly duracaoMin: number;
}

export interface MotivoCancelamentoOpcao {
  readonly id: string;
  readonly descricao: string;
}

export interface OpcoesAgenda {
  readonly servicos: readonly ServicoOpcao[];
  readonly motivosCancelamento: readonly MotivoCancelamentoOpcao[];
  readonly horarioFuncionamento: { readonly janelas: readonly JanelaFuncionamento[] };
  readonly fusoHorario: string;
}

@Injectable()
export class AgendaOpcoesService {
  constructor(private readonly database: DatabaseService) {}

  async consultar(): Promise<OpcoesAgenda> {
    return this.database.transacao(async (tx) => {
      const clinicas = await tx.$queryRaw<Array<{ id: string; fuso_horario: string }>>`
        SELECT id, fuso_horario FROM clinica
      `;
      const clinica = clinicas[0];
      if (clinica === undefined) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
      if (clinicas.length > 1) {
        throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
      }

      const servicos = await tx.$queryRaw<Array<{ id: string; nome: string; duracao_min: number }>>`
        SELECT id, nome, duracao_min
          FROM servico
         WHERE clinica_id = ${clinica.id}::uuid AND ativo = true
         ORDER BY lower(nome), id
      `;
      const motivos = await tx.$queryRaw<Array<{ id: string; descricao: string }>>`
        SELECT id, descricao
          FROM motivo_cancelamento
         WHERE clinica_id = ${clinica.id}::uuid AND ativo = true
         ORDER BY lower(descricao), id
      `;
      const janelas = await tx.$queryRaw<
        Array<{ dia_semana: number; hora_inicio: string; hora_fim: string }>
      >`
        SELECT dia_semana,
               to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
               to_char(hora_fim, 'HH24:MI') AS hora_fim
          FROM horario_funcionamento
         WHERE clinica_id = ${clinica.id}::uuid
      `;

      return {
        servicos: servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          duracaoMin: Number(s.duracao_min),
        })),
        motivosCancelamento: motivos.map((m) => ({ id: m.id, descricao: m.descricao })),
        horarioFuncionamento: {
          janelas: ordenarJanelas(
            janelas.map((j) => ({
              diaSemana: Number(j.dia_semana),
              horaInicio: j.hora_inicio,
              horaFim: j.hora_fim,
            })),
          ),
        },
        fusoHorario: clinica.fuso_horario,
      };
    });
  }
}
