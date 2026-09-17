// TechLab Fisio — serviço do horário de funcionamento da clínica única
// (CFG-002; `docs/14` D-CFG-13..D-CFG-21).
//
//   - D-CFG-15: substituição integral da grade em transação única serializada
//     por `SELECT ... FOR UPDATE` na linha de `clinica`; linhas anteriores
//     removidas fisicamente; grade idêntica -> sem escrita e sem auditoria;
//   - D-CFG-16: a não sobreposição é garantida pela validação (DTO) sob o lock;
//   - D-CFG-17: UM `configuracao.alterada` com alvo `clinica`, contexto VAZIO,
//     na mesma transação (rollback conjunto);
//   - D-CFG-21: sem linha de `clinica` -> CLINICA_NAO_CONFIGURADA.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import { ErroClinica } from "./clinica.service.js";
import { ordenarJanelas, type JanelaFuncionamento } from "./horario-funcionamento.dto.js";

const ALVO_CLINICA = "clinica";

export interface ComandoSubstituirGrade {
  readonly atorUsuarioId: string;
  /** Grade já validada por `validarCorpoGradeFuncionamento`. */
  readonly janelas: readonly JanelaFuncionamento[];
}

export interface ResultadoSubstituirGrade {
  readonly janelas: JanelaFuncionamento[];
  readonly mutacaoExecutada: boolean;
}

interface LinhaJanela {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

/** 0 linhas -> não configurada; >1 -> falha técnica (invariante física). */
function idClinicaUnica(linhas: Array<{ id: string }>): string {
  const [primeira] = linhas;
  if (primeira === undefined) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
  if (linhas.length > 1) {
    throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
  }
  return primeira.id;
}

async function lerGrade(tx: TransacaoPersistencia, clinicaId: string): Promise<JanelaFuncionamento[]> {
  const linhas = await tx.$queryRaw<LinhaJanela[]>`
    SELECT dia_semana,
           to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
           to_char(hora_fim, 'HH24:MI') AS hora_fim
      FROM horario_funcionamento
     WHERE clinica_id = ${clinicaId}::uuid
  `;
  return ordenarJanelas(
    linhas.map((l) => ({ diaSemana: Number(l.dia_semana), horaInicio: l.hora_inicio, horaFim: l.hora_fim })),
  );
}

function mesmaGrade(a: readonly JanelaFuncionamento[], b: readonly JanelaFuncionamento[]): boolean {
  return (
    a.length === b.length &&
    a.every((j, i) => {
      const o = b[i];
      return (
        o !== undefined &&
        j.diaSemana === o.diaSemana &&
        j.horaInicio === o.horaInicio &&
        j.horaFim === o.horaFim
      );
    })
  );
}

@Injectable()
export class HorarioFuncionamentoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  async consultar(): Promise<JanelaFuncionamento[]> {
    return this.database.transacao(async (tx) => {
      const clinicaId = idClinicaUnica(await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clinica`);
      return lerGrade(tx, clinicaId);
    });
  }

  async substituir(comando: ComandoSubstituirGrade): Promise<ResultadoSubstituirGrade> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx: TransacaoPersistencia) => {
      // 1. D-CFG-15 — lock da linha única de clinica
      const clinicaId = idClinicaUnica(
        await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM clinica FOR UPDATE`,
      );
      const novas = ordenarJanelas(comando.janelas);

      // 2. Grade idêntica -> sem escrita e sem auditoria
      if (mesmaGrade(await lerGrade(tx, clinicaId), novas)) {
        return { janelas: novas, mutacaoExecutada: false };
      }

      // 3. Substituição integral
      await tx.$executeRaw`DELETE FROM horario_funcionamento WHERE clinica_id = ${clinicaId}::uuid`;
      for (const janela of novas) {
        await tx.$executeRaw`
          INSERT INTO horario_funcionamento (id, clinica_id, dia_semana, hora_inicio, hora_fim)
          VALUES (${randomUUID()}::uuid, ${clinicaId}::uuid, ${janela.diaSemana}::smallint,
                  ${janela.horaInicio}::time, ${janela.horaFim}::time)
        `;
      }

      // 4. D-CFG-17 — um evento, alvo clinica, contexto VAZIO
      await this.auditWriter.registrar(tx, {
        acao: "configuracao.alterada",
        ocorridoEm: new Date(),
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: ALVO_CLINICA,
        alvoId: clinicaId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      });

      return { janelas: novas, mutacaoExecutada: true };
    });
  }
}
