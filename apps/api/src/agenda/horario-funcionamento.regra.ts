// TechLab Fisio — RN-014, parcela da clínica: contenção de um agendamento na
// grade semanal de funcionamento (`docs/14` D-CFG-60, D-CFG-61).
//
// Função PURA, sem I/O. Predicado normativo (D-CFG-61): `[inicio, fim)` é
// conforme se e somente se, convertidos para hora de parede no fuso IANA da
// clínica (D-CFG-60, regras IANA inclusive horário de verão),
//   1. a data civil local de `inicio` é igual à de `fim`; e
//   2. existe UMA janela `J` do dia da semana dessa data com
//      `J.horaInicio <= hora_local(inicio)` e `hora_local(fim) <= J.horaFim`,
//      comparando com a precisão integral do instante.
// Janelas nunca são somadas (adjacência é proibida por D-CFG-13).
//
// A conversão usa `Intl` — a mesma base que valida `fusoHorario` em D-CFG-04.
// Fuso não reconhecido lança `RangeError` (falha técnica: o fuso é validado na
// escrita e jamais deveria chegar inválido aqui).

/** Janela da grade: `diaSemana` 0 = domingo .. 6 = sábado; horas `HH:MM`. */
export interface JanelaGrade {
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
}

export interface EntradaHorarioFuncionamento {
  readonly inicio: Date;
  readonly fim: Date;
  /** Identificador IANA de `clinica.fuso_horario`. */
  readonly fusoHorario: string;
  readonly janelas: readonly JanelaGrade[];
}

/** Motivos internos (diagnóstico/teste); a fronteira HTTP expõe um único código (D-CFG-61). */
export type MotivoForaDoHorario =
  | "INTERVALO_INVALIDO"
  | "ATRAVESSA_MEIA_NOITE_LOCAL"
  | "DIA_SEM_JANELA"
  | "FORA_DAS_JANELAS";

export type ResultadoHorarioFuncionamento =
  | { readonly conforme: true }
  | { readonly conforme: false; readonly motivo: MotivoForaDoHorario };

const MS_MINUTO = 60_000;

interface InstanteLocal {
  /** `YYYY-MM-DD` no fuso. */
  readonly data: string;
  readonly diaSemana: number;
  /** Milissegundos desde 00:00 local. */
  readonly msDoDia: number;
}

const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fusoHorario: string): Intl.DateTimeFormat {
  let f = formatadores.get(fusoHorario);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fusoHorario,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatadores.set(fusoHorario, f);
  }
  return f;
}

/** Converte um instante para data civil, dia da semana e hora de parede no fuso. */
export function paraInstanteLocal(instante: Date, fusoHorario: string): InstanteLocal {
  const partes: Record<string, number> = {};
  for (const p of formatador(fusoHorario).formatToParts(instante)) {
    if (p.type !== "literal") partes[p.type] = Number(p.value);
  }
  const ano = partes["year"] as number;
  const mes = partes["month"] as number;
  const dia = partes["day"] as number;
  const hora = partes["hour"] as number;
  const minuto = partes["minute"] as number;
  const segundo = partes["second"] as number;
  const data = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return {
    data,
    diaSemana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(),
    msDoDia: ((hora * 60 + minuto) * 60 + segundo) * 1000 + instante.getUTCMilliseconds(),
  };
}

function msDaHora(hora: string): number {
  return (Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))) * MS_MINUTO;
}

export function avaliarHorarioFuncionamento(entrada: EntradaHorarioFuncionamento): ResultadoHorarioFuncionamento {
  const { inicio, fim, fusoHorario, janelas } = entrada;
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim.getTime() <= inicio.getTime()) {
    return { conforme: false, motivo: "INTERVALO_INVALIDO" };
  }

  const li = paraInstanteLocal(inicio, fusoHorario);
  const lf = paraInstanteLocal(fim, fusoHorario);
  if (li.data !== lf.data) return { conforme: false, motivo: "ATRAVESSA_MEIA_NOITE_LOCAL" };

  const doDia = janelas.filter((j) => j.diaSemana === li.diaSemana);
  if (doDia.length === 0) return { conforme: false, motivo: "DIA_SEM_JANELA" };

  const contida = doDia.some((j) => msDaHora(j.horaInicio) <= li.msDoDia && lf.msDoDia <= msDaHora(j.horaFim));
  return contida ? { conforme: true } : { conforme: false, motivo: "FORA_DAS_JANELAS" };
}
