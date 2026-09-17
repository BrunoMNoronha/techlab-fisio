// TechLab Fisio — contratos HTTP do horário de funcionamento da clínica única
// (CFG-002; `docs/14` D-CFG-13..D-CFG-21).
//
// Materializa:
//   - D-CFG-13: múltiplas janelas por dia, sem sobreposição e sem adjacência;
//     dia sem janela = fechado;
//   - D-CFG-14: sem janela que atravesse a meia-noite (`horaFim > horaInicio`);
//   - D-CFG-15: PUT substitui a grade semanal inteira;
//   - D-CFG-18: `HH:MM` 24h sem segundos; `diaSemana` 0 = domingo .. 6 = sábado;
//     no máximo 4 janelas por dia; corpo estrito, sem coerção de tipos.
//
// Escolha técnica local (reversível): corpo e resposta com a forma
// `{ janelas: [{ diaSemana, horaInicio, horaFim }] }`, resposta ordenada por
// dia e início. Validação pura, sem class-validator (padrão de `clinica.dto.ts`).

import { ApiProperty } from "@nestjs/swagger";

/** Limites homologados por D-CFG-18. */
export const LIMITES_HORARIO = Object.freeze({
  JANELAS_POR_DIA: 4,
  DIAS_SEMANA: 7,
} as const);

const CHAVES_CORPO = Object.freeze(["janelas"] as const);
const CHAVES_JANELA = Object.freeze(["diaSemana", "horaInicio", "horaFim"] as const);

/** `HH:MM`, 00:00..23:59 — sem segundos, sem espaços, sem arredondamento. */
const FORMA_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const PADRAO_HORA_OPENAPI = "^([01]\\d|2[0-3]):[0-5]\\d$";

export class JanelaFuncionamentoDto {
  @ApiProperty({ description: "Dia da semana: 0 = domingo .. 6 = sábado.", minimum: 0, maximum: 6, example: 1 })
  readonly diaSemana!: number;

  @ApiProperty({ description: "Início da janela, HH:MM (24h).", pattern: PADRAO_HORA_OPENAPI, example: "08:00" })
  readonly horaInicio!: string;

  @ApiProperty({ description: "Fim da janela, HH:MM (24h); maior que o início.", pattern: PADRAO_HORA_OPENAPI, example: "12:00" })
  readonly horaFim!: string;
}

/** Corpo de `PUT /horario-funcionamento` e resposta de GET/PUT. */
export class GradeFuncionamentoDto {
  @ApiProperty({
    description:
      "Grade semanal completa. Até 4 janelas por dia, sem sobreposição nem adjacência no mesmo dia. " +
      "Lista vazia = clínica fechada todos os dias.",
    type: [JanelaFuncionamentoDto],
    maxItems: LIMITES_HORARIO.JANELAS_POR_DIA * LIMITES_HORARIO.DIAS_SEMANA,
  })
  readonly janelas!: JanelaFuncionamentoDto[];
}

export interface JanelaFuncionamento {
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
}

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

function temExatamente(objeto: Record<string, unknown>, chaves: readonly string[]): boolean {
  const presentes = Object.keys(objeto);
  return (
    presentes.length === chaves.length &&
    chaves.every((chave) => Object.prototype.hasOwnProperty.call(objeto, chave))
  );
}

function minutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/** Ordem canônica: dia, depois início. */
export function ordenarJanelas(janelas: readonly JanelaFuncionamento[]): JanelaFuncionamento[] {
  return [...janelas].sort(
    (a, b) => a.diaSemana - b.diaSemana || minutos(a.horaInicio) - minutos(b.horaInicio),
  );
}

/**
 * Validação do corpo de `PUT /horario-funcionamento` — pura e fail-closed.
 * Retorna a grade em ordem canônica.
 */
export function validarCorpoGradeFuncionamento(
  corpo: unknown,
): { readonly valido: true; readonly valor: JanelaFuncionamento[] } | { readonly valido: false } {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO)) return { valido: false };
  const lista = corpo["janelas"];
  if (!Array.isArray(lista)) return { valido: false };
  if (lista.length > LIMITES_HORARIO.JANELAS_POR_DIA * LIMITES_HORARIO.DIAS_SEMANA) {
    return { valido: false };
  }

  const janelas: JanelaFuncionamento[] = [];
  for (const item of lista) {
    if (!ehObjetoPlano(item) || !temExatamente(item, CHAVES_JANELA)) return { valido: false };
    const { diaSemana, horaInicio, horaFim } = item;
    if (
      typeof diaSemana !== "number" ||
      !Number.isInteger(diaSemana) ||
      diaSemana < 0 ||
      diaSemana > 6 ||
      typeof horaInicio !== "string" ||
      typeof horaFim !== "string" ||
      !FORMA_HORA.test(horaInicio) ||
      !FORMA_HORA.test(horaFim) ||
      minutos(horaFim) <= minutos(horaInicio)
    ) {
      return { valido: false };
    }
    janelas.push({ diaSemana, horaInicio, horaFim });
  }

  const ordenadas = ordenarJanelas(janelas);
  let porDia = 0;
  for (let i = 0; i < ordenadas.length; i++) {
    const atual = ordenadas[i] as JanelaFuncionamento;
    const anterior = i > 0 ? ordenadas[i - 1] : undefined;
    if (anterior !== undefined && anterior.diaSemana === atual.diaSemana) {
      porDia++;
      // D-CFG-13: sem sobreposição e sem adjacência (início estritamente após o fim anterior).
      if (minutos(atual.horaInicio) <= minutos(anterior.horaFim)) return { valido: false };
    } else {
      porDia = 1;
    }
    if (porDia > LIMITES_HORARIO.JANELAS_POR_DIA) return { valido: false };
  }

  return { valido: true, valor: ordenadas };
}
