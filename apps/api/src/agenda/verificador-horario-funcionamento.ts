// TechLab Fisio — verificador transacional de RN-014, parcela da clínica
// (`docs/14` D-CFG-60, D-CFG-61, D-CFG-63; `docs/07` §17.4, passo 3 de T-01).
//
// Destinado a ser chamado DENTRO da transação de criação/remarcação de
// agendamento (T-01), após autorização e elegibilidade e antes da
// disponibilidade do profissional. Lê o fuso e a grade VIGENTES na mesma
// transação, SEM lock em `clinica` (D-CFG-61): um `PUT` concorrente da grade é
// tolerado por D-CFG-63. Não é aplicado a confirmação, check-in, início,
// conclusão, falta ou cancelamento.
//
// A fatia de agenda (rotas, T-01, PRO-003) NÃO existe ainda; este componente
// não registra rota, permissão, auditoria nem módulo no `AppModule`.

import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { ErroClinica } from "../clinica/clinica.service.js";
import {
  avaliarHorarioFuncionamento,
  type JanelaGrade,
  type MotivoForaDoHorario,
} from "./horario-funcionamento.regra.js";

/** Códigos de erro da agenda definidos por decisão vigente. */
export const ERRO_AGENDA = Object.freeze({
  /** `422` — D-CFG-61. Não expõe a grade nem valores. */
  FORA_DO_HORARIO_FUNCIONAMENTO: "FORA_DO_HORARIO_FUNCIONAMENTO",
  /** `422` — `docs/15` D-AGD-04 (passo 9), `docs/16` D-PRO3-04. Não expõe a grade do profissional. */
  FORA_DA_DISPONIBILIDADE: "FORA_DA_DISPONIBILIDADE",
} as const);

/** Status HTTP a ser usado pela futura fronteira da agenda (D-CFG-61). */
export const STATUS_FORA_DO_HORARIO_FUNCIONAMENTO = 422;

export class ErroForaDoHorarioFuncionamento extends Error {
  override readonly name = "ErroForaDoHorarioFuncionamento";
  readonly codigo = ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO;

  /** `motivo` é diagnóstico interno; nunca deve ir ao corpo HTTP. */
  constructor(readonly motivo: MotivoForaDoHorario) {
    super("Agendamento fora do horário de funcionamento da clínica.");
  }
}

export interface IntervaloAgendamento {
  readonly inicio: Date;
  readonly fim: Date;
}

@Injectable()
export class VerificadorHorarioFuncionamento {
  /**
   * Lança `ErroForaDoHorarioFuncionamento` se o intervalo não satisfaz
   * D-CFG-61; `ErroClinica("CLINICA_NAO_CONFIGURADA")` sem a linha de clínica.
   */
  async exigirConforme(tx: TransacaoPersistencia, intervalo: IntervaloAgendamento): Promise<void> {
    const clinicas = await tx.$queryRaw<Array<{ id: string; fuso_horario: string }>>`
      SELECT id, fuso_horario FROM clinica
    `;
    const [clinica] = clinicas;
    if (clinica === undefined) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
    if (clinicas.length > 1) {
      throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
    }

    const linhas = await tx.$queryRaw<Array<{ dia_semana: number; hora_inicio: string; hora_fim: string }>>`
      SELECT dia_semana,
             to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
             to_char(hora_fim, 'HH24:MI') AS hora_fim
        FROM horario_funcionamento
       WHERE clinica_id = ${clinica.id}::uuid
    `;
    const janelas: JanelaGrade[] = linhas.map((l) => ({
      diaSemana: Number(l.dia_semana),
      horaInicio: l.hora_inicio,
      horaFim: l.hora_fim,
    }));

    const resultado = avaliarHorarioFuncionamento({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      fusoHorario: clinica.fuso_horario,
      janelas,
    });
    if (!resultado.conforme) throw new ErroForaDoHorarioFuncionamento(resultado.motivo);
  }
}
