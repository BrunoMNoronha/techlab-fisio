// TechLab Fisio — Lógica pura da tela de horário de funcionamento
// (CFG-002; `docs/14` D-CFG-13, D-CFG-18, D-CFG-58, D-CFG-59, D-CFG-66).
//
// Espelha no cliente as regras do backend APENAS como ajuda ao usuário; o
// servidor (`PUT /horario-funcionamento`) é a única autoridade. Sem imports e
// sem sintaxe não apagável, para ser executável por `node` (type stripping)
// em `scripts/verify-grade-funcionamento.mjs`.

/** Janela no contrato HTTP: `diaSemana` 0 = domingo .. 6 = sábado. */
export interface JanelaApi {
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
}

export interface GradeApi {
  readonly janelas: readonly JanelaApi[];
}

/** Janela em edição; `chave` só identifica a linha na interface. */
export interface JanelaRascunho {
  readonly chave: string;
  readonly horaInicio: string;
  readonly horaFim: string;
}

/** Índice = `diaSemana` (0..6). */
export type Rascunho = readonly (readonly JanelaRascunho[])[];

export const JANELAS_POR_DIA = 4;

/**
 * Ordem de exibição (escolha de UI — D-CFG-66): segunda primeiro.
 * `diaSemana` segue o contrato (0 = domingo).
 */
export const DIAS_EXIBICAO: readonly { readonly diaSemana: number; readonly nome: string }[] = [
  { diaSemana: 1, nome: "Segunda-feira" },
  { diaSemana: 2, nome: "Terça-feira" },
  { diaSemana: 3, nome: "Quarta-feira" },
  { diaSemana: 4, nome: "Quinta-feira" },
  { diaSemana: 5, nome: "Sexta-feira" },
  { diaSemana: 6, nome: "Sábado" },
  { diaSemana: 0, nome: "Domingo" },
];

/** `HH:MM`, 00:00..23:59 — sem segundos (D-CFG-59). */
const FORMA_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horaValida(hora: string): boolean {
  return FORMA_HORA.test(hora);
}

function minutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

let sequencia = 0;
export function novaChave(): string {
  sequencia += 1;
  return `j${sequencia}`;
}

export function rascunhoVazio(): Rascunho {
  return [[], [], [], [], [], [], []];
}

export function gradeParaRascunho(grade: GradeApi): Rascunho {
  const dias: JanelaRascunho[][] = [[], [], [], [], [], [], []];
  for (const j of grade.janelas) {
    dias[j.diaSemana]?.push({ chave: novaChave(), horaInicio: j.horaInicio, horaFim: j.horaFim });
  }
  return dias.map(ordenarPorInicio);
}

function ordenarPorInicio<T extends { readonly horaInicio: string }>(janelas: readonly T[]): T[] {
  return [...janelas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

/** Corpo do `PUT`: a grade inteira, em ordem canônica (dia, início). */
export function rascunhoParaCorpo(rascunho: Rascunho): GradeApi {
  const janelas: JanelaApi[] = [];
  rascunho.forEach((dia, diaSemana) => {
    for (const j of ordenarPorInicio(dia)) {
      janelas.push({ diaSemana, horaInicio: j.horaInicio, horaFim: j.horaFim });
    }
  });
  return { janelas };
}

export function mesmoConteudo(a: Rascunho, b: Rascunho): boolean {
  return JSON.stringify(rascunhoParaCorpo(a)) === JSON.stringify(rascunhoParaCorpo(b));
}

export interface ErrosDia {
  /** Mensagem por `chave` de janela. */
  readonly porJanela: Readonly<Record<string, string>>;
  /** Mensagem do dia (ex.: excesso de janelas). */
  readonly dia: string | null;
}

/** Regras de D-CFG-13, D-CFG-18 e D-CFG-59 para um dia. */
export function validarDia(janelas: readonly JanelaRascunho[]): ErrosDia {
  const porJanela: Record<string, string> = {};
  const completas: JanelaRascunho[] = [];

  for (const j of janelas) {
    if (!horaValida(j.horaInicio) || !horaValida(j.horaFim)) {
      porJanela[j.chave] = "Informe início e fim no formato HH:MM.";
    } else if (minutos(j.horaFim) <= minutos(j.horaInicio)) {
      porJanela[j.chave] = "O fim deve ser depois do início (a janela não pode passar da meia-noite).";
    } else {
      completas.push(j);
    }
  }

  const ordenadas = ordenarPorInicio(completas);
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1] as JanelaRascunho;
    const atual = ordenadas[i] as JanelaRascunho;
    if (minutos(atual.horaInicio) < minutos(anterior.horaFim)) {
      porJanela[atual.chave] = `Sobrepõe a janela ${anterior.horaInicio}–${anterior.horaFim}.`;
    } else if (minutos(atual.horaInicio) === minutos(anterior.horaFim)) {
      porJanela[atual.chave] =
        `Encosta na janela ${anterior.horaInicio}–${anterior.horaFim}. Use uma única janela ${anterior.horaInicio}–${atual.horaFim}.`;
    }
  }

  const dia = janelas.length > JANELAS_POR_DIA ? `No máximo ${JANELAS_POR_DIA} janelas por dia.` : null;
  return { porJanela, dia };
}

export function rascunhoValido(rascunho: Rascunho): boolean {
  return rascunho.every((dia) => {
    const erros = validarDia(dia);
    return erros.dia === null && Object.keys(erros.porJanela).length === 0;
  });
}
