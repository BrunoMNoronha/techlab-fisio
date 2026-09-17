// TechLab Fisio — disponibilidade versionada do profissional
// (PRO-003; `docs/16` §4, D-PRO3-01, D-PRO3-03, D-PRO3-05, D-PRO3-07..D-PRO3-10).
//
// Materializa:
//   - D-PRO3-01: a VERSÃO é o conjunto de linhas de
//     `disponibilidade_profissional` do mesmo profissional com o mesmo par
//     (`vigencia_inicio`, `vigencia_fim`). Não existe tabela de versão, nem
//     linha representando "versão vazia";
//   - D-PRO3-03: semântica do `PUT` — 422 no passado, substituição das versões
//     com `vigencia_inicio >= D`, encerramento da versão anterior em `D - 1`,
//     inserção só com grade não vazia, no-op sem escrita;
//   - D-PRO3-05: o `PUT` NÃO consulta, cancela, remarca, invalida nem altera
//     agendamento algum, e não emite aviso;
//   - D-PRO3-07: transação única serializada por `SELECT ... FOR UPDATE` na
//     linha de `profissional`. `hoje`, a leitura das versões, a comparação de
//     no-op e todas as escritas ocorrem SOB o lock. Última escrita válida
//     prevalece — sem `If-Match`, sem coluna de versão, sem ETag;
//   - D-PRO3-09: SEM evento de auditoria (limitação declarada: o sistema
//     preserva O QUE vigorou e QUANDO, mas não QUEM alterou);
//   - D-PRO3-10: sem versões => `{ versoes: [] }`; profissional inexistente =>
//     PROFISSIONAL_NAO_ENCONTRADO; sem linha de clínica no `PUT` (necessária
//     para `hoje`) => CLINICA_NAO_CONFIGURADA.
//
// NÃO há validação cruzada com o horário de funcionamento da clínica
// (D-CFG-62 / D-PRO3-04): as camadas são independentes e a interseção é
// responsabilidade da agenda. A disponibilidade pode, isoladamente,
// ultrapassar a grade da clínica — e não é cortada nem corrigida aqui.

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { paraInstanteLocal } from "../agenda/horario-funcionamento.regra.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import type { JanelaFuncionamento } from "../clinica/horario-funcionamento.dto.js";
import { DatabaseService } from "../database/database.service.js";
import { deslocarDataCivil, type DisponibilidadeValidada } from "./disponibilidade.dto.js";
import { ErroProfissional } from "./profissionais.service.js";
import { lerLinhaProfissional } from "./profissional.leitura.js";

/** Rejeição própria da disponibilidade (D-PRO3-03, regra 1). */
export class ErroDisponibilidade extends Error {
  override readonly name = "ErroDisponibilidade";

  constructor(readonly motivo: "VIGENCIA_RETROATIVA") {
    super(`Operação de disponibilidade rejeitada: ${motivo}.`);
  }
}

/** Uma versão da disponibilidade — agrupamento de linhas, não tabela (D-PRO3-01). */
export interface VersaoDisponibilidadeProfissional {
  /** Data civil `YYYY-MM-DD`. */
  readonly vigenciaInicio: string;
  /** Data civil `YYYY-MM-DD` inclusiva, ou `null` na versão ABERTA. */
  readonly vigenciaFim: string | null;
  /** Janelas em ordem canônica: dia, início, fim. */
  readonly janelas: readonly JanelaFuncionamento[];
}

export interface ResultadoSubstituirDisponibilidade {
  readonly versoes: VersaoDisponibilidadeProfissional[];
  readonly mutacaoExecutada: boolean;
}

interface LinhaJanelaVersionada {
  vigencia_inicio: string;
  vigencia_fim: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

/**
 * Lê TODAS as versões do profissional em ordem canônica.
 *
 * A ordenação é feita no SQL e é totalmente determinística: versões por
 * `vigencia_inicio` DESCENDENTE (a aberta primeiro, por ser a de maior
 * início), janelas por dia, início e fim.
 */
async function lerVersoes(
  tx: TransacaoPersistencia,
  profissionalId: string,
): Promise<VersaoDisponibilidadeProfissional[]> {
  const linhas = await tx.$queryRaw<LinhaJanelaVersionada[]>`
    SELECT to_char(vigencia_inicio, 'YYYY-MM-DD') AS vigencia_inicio,
           to_char(vigencia_fim, 'YYYY-MM-DD') AS vigencia_fim,
           dia_semana,
           to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
           to_char(hora_fim, 'HH24:MI') AS hora_fim
      FROM disponibilidade_profissional
     WHERE profissional_id = ${profissionalId}::uuid
     ORDER BY vigencia_inicio DESC, vigencia_fim DESC NULLS FIRST,
              dia_semana, hora_inicio, hora_fim
  `;

  const versoes: Array<{ vigenciaInicio: string; vigenciaFim: string | null; janelas: JanelaFuncionamento[] }> = [];
  for (const linha of linhas) {
    const ultima = versoes[versoes.length - 1];
    const atual =
      ultima !== undefined &&
      ultima.vigenciaInicio === linha.vigencia_inicio &&
      ultima.vigenciaFim === linha.vigencia_fim
        ? ultima
        : (() => {
            const nova = { vigenciaInicio: linha.vigencia_inicio, vigenciaFim: linha.vigencia_fim, janelas: [] as JanelaFuncionamento[] };
            versoes.push(nova);
            return nova;
          })();
    atual.janelas.push({
      diaSemana: Number(linha.dia_semana),
      horaInicio: linha.hora_inicio,
      horaFim: linha.hora_fim,
    });
  }
  return versoes;
}

function mesmasJanelas(a: readonly JanelaFuncionamento[], b: readonly JanelaFuncionamento[]): boolean {
  return (
    a.length === b.length &&
    a.every((j, i) => {
      const o = b[i];
      return o !== undefined && j.diaSemana === o.diaSemana && j.horaInicio === o.horaInicio && j.horaFim === o.horaFim;
    })
  );
}

function mesmasVersoes(
  a: readonly VersaoDisponibilidadeProfissional[],
  b: readonly VersaoDisponibilidadeProfissional[],
): boolean {
  return (
    a.length === b.length &&
    a.every((v, i) => {
      const o = b[i];
      return (
        o !== undefined &&
        v.vigenciaInicio === o.vigenciaInicio &&
        v.vigenciaFim === o.vigenciaFim &&
        mesmasJanelas(v.janelas, o.janelas)
      );
    })
  );
}

/**
 * Estado resultante do `PUT` sobre `vigentes` — função PURA, espelho exato das
 * regras 2–5 de D-PRO3-03. É o que permite decidir o no-op (regra 6) por
 * COMPARAÇÃO do estado final com o estado lido sob o lock, sem campo
 * artificial e sem consultar a agenda.
 *
 * Pressupõe `D >= hoje` (regra 1 já aplicada) e `vigentes` em ordem canônica.
 */
export function estadoResultante(
  vigentes: readonly VersaoDisponibilidadeProfissional[],
  vigenciaInicio: string,
  janelas: readonly JanelaFuncionamento[],
): VersaoDisponibilidadeProfissional[] {
  const vespera = deslocarDataCivil(vigenciaInicio, -1);
  const resultado: VersaoDisponibilidadeProfissional[] = [];

  // Regra 4/5: a nova versão, quando a grade não é vazia, é sempre a de maior
  // `vigenciaInicio` — logo, a primeira na ordem decrescente.
  if (janelas.length > 0) {
    resultado.push({ vigenciaInicio, vigenciaFim: null, janelas: [...janelas] });
  }

  for (const versao of vigentes) {
    // Regra 2: versões com `vigencia_inicio >= D` são substituídas (removidas).
    if (versao.vigenciaInicio >= vigenciaInicio) continue;
    // Regra 3: a versão que abrange `D` é encerrada na véspera. As demais,
    // integralmente passadas, permanecem intactas.
    const encerra = versao.vigenciaFim === null || versao.vigenciaFim >= vigenciaInicio;
    resultado.push({
      vigenciaInicio: versao.vigenciaInicio,
      vigenciaFim: encerra ? vespera : versao.vigenciaFim,
      janelas: versao.janelas,
    });
  }
  return resultado;
}

@Injectable()
export class DisponibilidadeService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * `GET` — todas as versões, inclusive de profissional INATIVO (D-PRO3-02).
   * Não exige clínica configurada: `hoje` não é usado na leitura.
   */
  async consultar(profissionalId: string): Promise<VersaoDisponibilidadeProfissional[]> {
    return this.database.transacao(async (tx) => {
      if ((await lerLinhaProfissional(tx, profissionalId, false)) === null) {
        throw new ErroProfissional("PROFISSIONAL_NAO_ENCONTRADO");
      }
      return lerVersoes(tx, profissionalId);
    });
  }

  /** `PUT` — D-PRO3-03 integral, em transação única sob o lock (D-PRO3-07). */
  async substituir(
    profissionalId: string,
    pedido: DisponibilidadeValidada,
  ): Promise<ResultadoSubstituirDisponibilidade> {
    return this.database.transacao(async (tx) => {
      // 1. D-PRO3-07 — lock da linha do profissional; tudo abaixo roda sob ele.
      if ((await lerLinhaProfissional(tx, profissionalId, true)) === null) {
        throw new ErroProfissional("PROFISSIONAL_NAO_ENCONTRADO");
      }

      // 2/3. Fuso da clínica e `hoje` como data civil local, DENTRO da transação.
      const clinicas = await tx.$queryRaw<Array<{ fuso_horario: string }>>`SELECT fuso_horario FROM clinica`;
      const [clinica] = clinicas;
      if (clinica === undefined) throw new ErroClinica("CLINICA_NAO_CONFIGURADA");
      if (clinicas.length > 1) {
        throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
      }
      const hoje = paraInstanteLocal(new Date(), clinica.fuso_horario).data;

      // 4. Regra 1 — o passado nunca é reescrito. Nenhuma escrita ocorreu até aqui.
      const { vigenciaInicio, janelas } = pedido;
      if (vigenciaInicio < hoje) throw new ErroDisponibilidade("VIGENCIA_RETROATIVA");

      // 5/6. Estado vigente e estado resultante, ambos sob o lock.
      const vigentes = await lerVersoes(tx, profissionalId);
      const resultante = estadoResultante(vigentes, vigenciaInicio, janelas);

      // 7. Regra 6 — no-op: nenhuma escrita, resposta com o estado vigente.
      if (mesmasVersoes(vigentes, resultante)) {
        return { versoes: vigentes, mutacaoExecutada: false };
      }

      // 8. Regra 2 — remoção física restrita às versões ainda não iniciadas ou
      //    iniciadas no próprio dia `D`, e só porque `D >= hoje`.
      await tx.$executeRaw`
        DELETE FROM disponibilidade_profissional
         WHERE profissional_id = ${profissionalId}::uuid
           AND vigencia_inicio >= ${vigenciaInicio}::date
      `;

      // 9. Regra 3 — encerramento da versão que abrange `D`, na véspera.
      await tx.$executeRaw`
        UPDATE disponibilidade_profissional
           SET vigencia_fim = ${deslocarDataCivil(vigenciaInicio, -1)}::date
         WHERE profissional_id = ${profissionalId}::uuid
           AND vigencia_inicio < ${vigenciaInicio}::date
           AND (vigencia_fim IS NULL OR vigencia_fim >= ${vigenciaInicio}::date)
      `;

      // 10. Regra 4 — nova versão aberta; regra 5 (grade vazia) não insere nada.
      for (const janela of janelas) {
        await tx.$executeRaw`
          INSERT INTO disponibilidade_profissional
                      (id, profissional_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim)
          VALUES (${randomUUID()}::uuid, ${profissionalId}::uuid, ${janela.diaSemana}::smallint,
                  ${janela.horaInicio}::time, ${janela.horaFim}::time,
                  ${vigenciaInicio}::date, NULL)
        `;
      }

      return { versoes: await lerVersoes(tx, profissionalId), mutacaoExecutada: true };
    });
  }
}
