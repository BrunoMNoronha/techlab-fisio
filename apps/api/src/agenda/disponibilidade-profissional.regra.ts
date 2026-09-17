// TechLab Fisio — RN-014, parcela do profissional: contenção de um agendamento
// na disponibilidade VERSIONADA do profissional (`docs/16` D-PRO3-01,
// D-PRO3-04; conversão de `docs/14` D-CFG-60).
//
// Função PURA, sem I/O. Predicado normativo (D-PRO3-04): `[inicio, fim)` está
// disponível se e somente se, convertidos para hora de parede no fuso IANA da
// clínica,
//   1. existe a VERSÃO APLICÁVEL — aquela com
//      `vigenciaInicio <= data_local(inicio)` e `vigenciaFim` nulo ou
//      `>= data_local(inicio)`; e
//   2. a data civil local de `inicio` é igual à de `fim`; e
//   3. existe UMA janela dessa versão, do dia da semana da data local, que
//      contém integralmente `[inicio, fim)` — MESMO predicado de D-CFG-61.
//
// O item 3 NÃO é reimplementado: delega a `avaliarHorarioFuncionamento`, a
// função pura já homologada de CFG-002 (`docs/16` §4.4, "reutilizar a função
// pura de contenção, sem duplicar a lógica").
//
// Sem versão aplicável => NÃO disponível, em modo fail-closed: a ausência de
// versões nunca significa "sempre disponível" (D-PRO3-10). Nenhuma validação
// cruzada com a grade da clínica acontece aqui — as camadas são independentes
// (D-CFG-62 / D-PRO3-04); a interseção é responsabilidade da agenda, que
// aplica as duas regras em sequência.
//
// O `motivo` é diagnóstico interno e NUNCA vai ao corpo HTTP: a fronteira
// expõe um único código, sem revelar a grade do profissional.

import {
  avaliarHorarioFuncionamento,
  paraInstanteLocal,
  type JanelaGrade,
} from "./horario-funcionamento.regra.js";

/**
 * Uma VERSÃO da disponibilidade: conjunto de janelas com a mesma vigência
 * (`docs/16` D-PRO3-01). Datas civis `YYYY-MM-DD`; `vigenciaFim = null` é a
 * versão ABERTA.
 */
export interface VersaoDisponibilidade {
  readonly vigenciaInicio: string;
  readonly vigenciaFim: string | null;
  readonly janelas: readonly JanelaGrade[];
}

export interface EntradaDisponibilidadeProfissional {
  readonly inicio: Date;
  readonly fim: Date;
  /** Identificador IANA de `clinica.fuso_horario`. */
  readonly fusoHorario: string;
  /** Todas as versões conhecidas do profissional, em qualquer ordem. */
  readonly versoes: readonly VersaoDisponibilidade[];
}

/** Motivos internos (diagnóstico/teste); a fronteira HTTP expõe um único código. */
export type MotivoForaDaDisponibilidade =
  | "INTERVALO_INVALIDO"
  | "SEM_VERSAO_APLICAVEL"
  | "ATRAVESSA_MEIA_NOITE_LOCAL"
  | "DIA_SEM_JANELA"
  | "FORA_DAS_JANELAS";

export type ResultadoDisponibilidadeProfissional =
  | { readonly disponivel: true }
  | { readonly disponivel: false; readonly motivo: MotivoForaDaDisponibilidade };

/**
 * A versão aplicável a uma data civil local, ou `undefined`.
 *
 * As versões não se sobrepõem (invariante 1 de D-PRO3-01, garantida no
 * backend sob lock); ainda assim a busca é determinística por construção:
 * entre candidatas, vence a de MAIOR `vigenciaInicio`. Comparação lexicográfica
 * de `YYYY-MM-DD` — equivalente à cronológica nesse formato, e sem fuso.
 */
export function versaoAplicavel(
  versoes: readonly VersaoDisponibilidade[],
  dataLocal: string,
): VersaoDisponibilidade | undefined {
  let escolhida: VersaoDisponibilidade | undefined;
  for (const versao of versoes) {
    if (versao.vigenciaInicio > dataLocal) continue;
    if (versao.vigenciaFim !== null && versao.vigenciaFim < dataLocal) continue;
    if (escolhida === undefined || versao.vigenciaInicio > escolhida.vigenciaInicio) escolhida = versao;
  }
  return escolhida;
}

export function avaliarDisponibilidadeProfissional(
  entrada: EntradaDisponibilidadeProfissional,
): ResultadoDisponibilidadeProfissional {
  const { inicio, fim, fusoHorario, versoes } = entrada;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim.getTime() <= inicio.getTime()) {
    return { disponivel: false, motivo: "INTERVALO_INVALIDO" };
  }

  // A versão é escolhida pela data civil local do INÍCIO (D-PRO3-04).
  const versao = versaoAplicavel(versoes, paraInstanteLocal(inicio, fusoHorario).data);
  if (versao === undefined) return { disponivel: false, motivo: "SEM_VERSAO_APLICAVEL" };

  const resultado = avaliarHorarioFuncionamento({ inicio, fim, fusoHorario, janelas: versao.janelas });
  return resultado.conforme ? { disponivel: true } : { disponivel: false, motivo: resultado.motivo };
}
