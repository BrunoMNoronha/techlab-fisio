// TechLab Fisio — verificador transacional de RN-014, parcela do profissional
// (`docs/16` D-PRO3-04, D-PRO3-05, D-PRO3-10; `docs/14` D-CFG-60, D-CFG-62;
// `docs/07` §17.4).
//
// Destinado a ser chamado DENTRO da transação de criação/remarcação de
// agendamento (T-01), no passo 9 de `D-AGD-04` — DEPOIS do horário de
// funcionamento da clínica (passo 3) e sem validação cruzada entre as duas
// camadas (D-CFG-62). Lê o fuso e as versões VIGENTES na mesma transação,
// SEM lock em `clinica` nem em `profissional` (D-PRO3-04): um `PUT` de
// disponibilidade concorrente é tolerado pelo mesmo racional de
// D-CFG-61/D-CFG-63.
//
// Não é aplicado a confirmação, check-in, início, conclusão, falta ou
// cancelamento. Não altera agendamento algum (D-PRO3-05).
//
// A fatia de agenda (rotas, T-01) NÃO existe ainda; este componente não
// registra rota, permissão nem auditoria. É a REGRA REUTILIZÁVEL que PRO-003
// entrega à agenda, exportada pelo `ProfissionalModule`.

import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { ErroClinica } from "../clinica/clinica.service.js";
import {
  avaliarDisponibilidadeProfissional,
  type MotivoForaDaDisponibilidade,
  type VersaoDisponibilidade,
} from "./disponibilidade-profissional.regra.js";
import { ERRO_AGENDA, type IntervaloAgendamento } from "./verificador-horario-funcionamento.js";

export class ErroForaDaDisponibilidade extends Error {
  override readonly name = "ErroForaDaDisponibilidade";
  readonly codigo = ERRO_AGENDA.FORA_DA_DISPONIBILIDADE;

  /** `motivo` é diagnóstico interno; nunca deve ir ao corpo HTTP. */
  constructor(readonly motivo: MotivoForaDaDisponibilidade) {
    super("Agendamento fora da disponibilidade do profissional.");
  }
}

interface LinhaJanelaVigente {
  vigencia_inicio: string;
  vigencia_fim: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

/** Agrupa as linhas em versões pelo par (`vigencia_inicio`, `vigencia_fim`) — D-PRO3-01. */
function agruparEmVersoes(linhas: readonly LinhaJanelaVigente[]): VersaoDisponibilidade[] {
  const porVigencia = new Map<string, { inicio: string; fim: string | null; janelas: Array<{ diaSemana: number; horaInicio: string; horaFim: string }> }>();
  for (const linha of linhas) {
    const chave = `${linha.vigencia_inicio}|${linha.vigencia_fim ?? ""}`;
    let versao = porVigencia.get(chave);
    if (versao === undefined) {
      versao = { inicio: linha.vigencia_inicio, fim: linha.vigencia_fim, janelas: [] };
      porVigencia.set(chave, versao);
    }
    versao.janelas.push({
      diaSemana: Number(linha.dia_semana),
      horaInicio: linha.hora_inicio,
      horaFim: linha.hora_fim,
    });
  }
  return [...porVigencia.values()].map((v) => ({
    vigenciaInicio: v.inicio,
    vigenciaFim: v.fim,
    janelas: v.janelas,
  }));
}

@Injectable()
export class VerificadorDisponibilidadeProfissional {
  /**
   * Lança `ErroForaDaDisponibilidade` quando o intervalo não satisfaz
   * D-PRO3-04 — inclusive quando o profissional não tem versão aplicável
   * (fail-closed, D-PRO3-10); `ErroClinica("CLINICA_NAO_CONFIGURADA")` sem a
   * linha de clínica, de onde vem o fuso.
   */
  async exigirDisponivel(
    tx: TransacaoPersistencia,
    profissionalId: string,
    intervalo: IntervaloAgendamento,
  ): Promise<void> {
    const clinicas = await tx.$queryRaw<Array<{ fuso_horario: string }>>`
      SELECT fuso_horario FROM clinica
    `;
    const [clinica] = clinicas;
    if (clinica === undefined) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
    if (clinicas.length > 1) {
      throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
    }

    // Todas as versões do profissional; a aplicável é escolhida pela regra
    // pura, pela data civil local do início. A leitura usa
    // `ix_disponibilidade_profissional_vigencia` (D-PRO3-06). O volume por
    // profissional é pequeno (sem paginação, D-PRO3-02).
    const linhas = await tx.$queryRaw<LinhaJanelaVigente[]>`
      SELECT to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
             to_char(vigencia_fim, 'YYYY-MM-DD') AS vigencia_fim,
             dia_semana,
             to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
             to_char(hora_fim, 'HH24:MI') AS hora_fim
        FROM disponibilidade_profissional
       WHERE profissional_id = ${profissionalId}::uuid
       ORDER BY vigencia_inicio DESC, dia_semana, hora_inicio
    `;

    const resultado = avaliarDisponibilidadeProfissional({
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      fusoHorario: clinica.fuso_horario,
      versoes: agruparEmVersoes(linhas),
    });
    if (!resultado.disponivel) throw new ErroForaDaDisponibilidade(resultado.motivo);
  }
}
