// TechLab Fisio — contratos HTTP e validações puras de bloqueios de agenda (AGD-C / Issue #107).
//
// Materializa:
//   - docs/19 D-AGDC-02 / D-AGDC-03: corpo estrito de criação (CriarBloqueioDto),
//     projeção devolvida (BloqueioRespostaDto) sem expor criadoPorUsuarioId,
//     normalização rigorosa de motivo sem truncamento;
//   - docs/19 D-AGDC-04: regras temporais puras (avaliarTempoBloqueio),
//     fim > inicio, passado com 422 BLOQUEIO_NO_PASSADO, limites de 365 dias
//     (8.760 horas) e 730 dias futuros como 422 INTERVALO_EXCESSIVO, bloqueios em
//     andamento (inicio < agora e fim > agora) permitidos;
//   - docs/19 D-AGDC-07: parâmetros de consulta (ConsultarBloqueiosQueryDto),
//     janela [de, ate) de no máximo 7 dias;
//   - docs/19 D-AGDC-13: catálogo fechado de erros de bloqueio.
//
// Validação PURA, determinística e fail-closed, sem class-validator, sem I/O,
// sem consulta ao banco e sem acesso a relógio global (o instante `agora` é sempre
// recebido explicitamente como parâmetro Date).

import { ApiProperty } from "@nestjs/swagger";

import { analisarInstante } from "../audit/audit-query.dto.js";
import { ehUuidValido } from "../auth/usuarios.dto.js";

/**
 * Limites dimensionais e temporais de bloqueios de agenda (docs/19 D-AGDC-03, D-AGDC-04, D-AGDC-07).
 */
export const LIMITES_BLOQUEIO = Object.freeze({
  /** Tamanho máximo do texto de motivo do bloqueio (após trim). */
  MOTIVO_TAMANHO_MAX: 500,
  /** Duração máxima de um bloqueio, em horas (365 dias = 8.760 horas). */
  DURACAO_MAX_HORAS: 8760,
  /** Duração máxima de um bloqueio em milissegundos absolutos (365 * 24 * 60 * 60 * 1000). */
  DURACAO_MAX_MS: 31_536_000_000,
  /** Limite máximo para instante inicial no futuro, em dias (730 dias). */
  INICIO_FUTURO_MAX_DIAS: 730,
  /** Limite máximo para instante inicial no futuro em milissegundos (730 * 24 * 60 * 60 * 1000). */
  INICIO_FUTURO_MAX_MS: 63_072_000_000,
  /** Limite máximo da janela de consulta, em dias (visões diária e semanal). */
  JANELA_CONSULTA_MAX_DIAS: 7,
  /** Limite máximo da janela de consulta em milissegundos (7 * 24 * 60 * 60 * 1000). */
  JANELA_CONSULTA_MAX_MS: 604_800_000,
} as const);

/**
 * Códigos de erro de domínio específicos da fatia AGD-C (docs/19 D-AGDC-04, D-AGDC-13).
 *
 * Códigos gerais (`REQUISICAO_INVALIDA`, `FALHA_INTERNA`, auth/authz) e
 * `PROFISSIONAL_INELEGIVEL` pertencem a seus catálogos canônicos e não são
 * redeclarados aqui.
 */
export const ERRO_BLOQUEIO = Object.freeze({
  /** `422` — D-AGDC-04: tentativa de criar bloqueio totalmente no passado (fim <= agora). */
  BLOQUEIO_NO_PASSADO: "BLOQUEIO_NO_PASSADO",
  /** `422` — D-AGDC-04: duração superior a 365 dias ou início além de 730 dias no futuro. */
  INTERVALO_EXCESSIVO: "INTERVALO_EXCESSIVO",
} as const);

// ---------------------------------------------------------------------------
// DTOs públicos (com Swagger decorators)
// ---------------------------------------------------------------------------

/**
 * Corpo de requisição para criação de bloqueio (`POST /agenda/bloqueios`).
 * Contrato exato documentado em docs/19 D-AGDC-03.
 */
export class CriarBloqueioDto {
  @ApiProperty({
    description: "Identificador UUID do profissional que terá a agenda bloqueada.",
    format: "uuid",
    example: "00000000-0000-7000-8000-000000000001",
  })
  readonly profissionalId!: string;

  @ApiProperty({
    description: "Instante inicial do bloqueio em formato ISO-8601 com offset explícito obrigatório.",
    format: "date-time",
    example: "2028-10-15T08:00:00-03:00",
  })
  readonly inicio!: string;

  @ApiProperty({
    description: "Instante final do bloqueio em formato ISO-8601 com offset explícito obrigatório.",
    format: "date-time",
    example: "2028-10-15T18:00:00-03:00",
  })
  readonly fim!: string;

  @ApiProperty({
    description:
      "Motivo opcional ou justificativa do bloqueio (até 500 caracteres após normalização).",
    required: false,
    nullable: true,
    type: String,
    maxLength: LIMITES_BLOQUEIO.MOTIVO_TAMANHO_MAX,
    example: "Manutenção preventiva das instalações",
  })
  readonly motivo?: string | null;
}

/**
 * Parâmetros de query para consulta de bloqueios (`GET /agenda/bloqueios`).
 * Contrato documentado em docs/19 D-AGDC-07.
 */
export class ConsultarBloqueiosQueryDto {
  @ApiProperty({
    description: "Limite inferior do intervalo de busca em formato ISO-8601 com offset.",
    format: "date-time",
    example: "2028-10-15T00:00:00-03:00",
  })
  readonly de!: string;

  @ApiProperty({
    description:
      "Limite superior do intervalo de busca em formato ISO-8601 com offset (máximo 7 dias a partir de 'de').",
    format: "date-time",
    example: "2028-10-22T00:00:00-03:00",
  })
  readonly ate!: string;

  @ApiProperty({
    description:
      "Identificador UUID opcional para filtrar os bloqueios de um profissional específico.",
    format: "uuid",
    required: false,
    example: "00000000-0000-7000-8000-000000000001",
  })
  readonly profissionalId?: string;
}

/**
 * Projeção pública de um bloqueio de agenda (docs/19 D-AGDC-03, D-AGDC-07).
 * Não expõe dados internos nem `criadoPorUsuarioId`.
 */
export class BloqueioRespostaDto {
  @ApiProperty({
    description: "Identificador único do bloqueio de agenda.",
    format: "uuid",
    example: "00000000-0000-7000-8000-000000000099",
  })
  readonly id!: string;

  @ApiProperty({
    description: "Identificador do profissional bloqueado.",
    format: "uuid",
    example: "00000000-0000-7000-8000-000000000001",
  })
  readonly profissionalId!: string;

  @ApiProperty({
    description: "Instante de início do bloqueio em formato ISO-8601 UTC.",
    format: "date-time",
    example: "2028-10-15T11:00:00.000Z",
  })
  readonly inicio!: string;

  @ApiProperty({
    description: "Instante de término do bloqueio em formato ISO-8601 UTC.",
    format: "date-time",
    example: "2028-10-15T21:00:00.000Z",
  })
  readonly fim!: string;

  @ApiProperty({
    description: "Motivo registrado para o bloqueio, ou null quando não informado.",
    nullable: true,
    type: String,
    example: "Manutenção preventiva das instalações",
  })
  readonly motivo!: string | null;

  @ApiProperty({
    description: "Instante em que o bloqueio foi criado pelo servidor em formato ISO-8601 UTC.",
    format: "date-time",
    example: "2026-09-18T10:30:00.000Z",
  })
  readonly criadoEm!: string;
}

/**
 * Envelope de resposta da listagem de bloqueios (`GET /agenda/bloqueios`).
 */
export class ListarBloqueiosRespostaDto {
  @ApiProperty({
    description: "Lista ordenada de bloqueios que intersectam a janela consultada.",
    type: () => [BloqueioRespostaDto],
  })
  readonly bloqueios!: BloqueioRespostaDto[];
}

// ---------------------------------------------------------------------------
// Tipos e Helpers de Validação Pura
// ---------------------------------------------------------------------------

export type Validacao<T> =
  | { readonly valido: true; readonly valor: T }
  | { readonly valido: false };

const INVALIDO: Validacao<never> = Object.freeze({ valido: false });

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const prototipo: unknown = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

const CHAVES_CRIACAO_OBRIGATORIAS: readonly string[] = Object.freeze([
  "profissionalId",
  "inicio",
  "fim",
]);

const CHAVES_CRIACAO_PERMITIDAS: ReadonlySet<string> = new Set([
  "profissionalId",
  "inicio",
  "fim",
  "motivo",
]);

export interface CriacaoBloqueioValidada {
  readonly profissionalId: string;
  readonly inicio: Date;
  readonly fim: Date;
  readonly motivo: string | null;
}

/**
 * Validação sintática e estrutural do corpo de criação de bloqueio (docs/19 D-AGDC-03).
 *
 * Pura, estrita e sem coerção de tipos:
 * - Exige objeto plano sem chaves adicionais;
 * - Valida `profissionalId` como UUID válido;
 * - Valida `inicio` e `fim` como instantes ISO-8601 com offset explícito;
 * - Exige `fim > inicio` (invariante do banco ck_bloqueio_agenda_intervalo);
 * - Normaliza `motivo`: ausente/null/vazio/espaços -> null; texto preenchido -> trim();
 * - Rejeita `motivo` que após trim exceda 500 caracteres (sem truncamento silencioso).
 *
 * Falhas nesta função representam erro 400 REQUISICAO_INVALIDA.
 * Regras temporais relativas ao relógio do servidor pertencem a `avaliarTempoBloqueio`.
 */
export function validarCriacaoBloqueio(valor: unknown): Validacao<CriacaoBloqueioValidada> {
  if (!ehObjetoPlano(valor)) return INVALIDO;

  const chaves = Object.keys(valor);
  for (const obrigatoria of CHAVES_CRIACAO_OBRIGATORIAS) {
    if (!Object.prototype.hasOwnProperty.call(valor, obrigatoria)) {
      return INVALIDO;
    }
  }

  for (const chave of chaves) {
    if (!CHAVES_CRIACAO_PERMITIDAS.has(chave)) {
      return INVALIDO;
    }
  }

  const profissionalId = valor["profissionalId"];
  if (typeof profissionalId !== "string" || !ehUuidValido(profissionalId)) {
    return INVALIDO;
  }

  const inicioBruto = valor["inicio"];
  const fimBruto = valor["fim"];
  if (typeof inicioBruto !== "string" || typeof fimBruto !== "string") {
    return INVALIDO;
  }

  const inicio = analisarInstante(inicioBruto);
  const fim = analisarInstante(fimBruto);
  if (inicio === null || fim === null) {
    return INVALIDO;
  }

  if (fim.getTime() <= inicio.getTime()) {
    return INVALIDO;
  }

  let motivo: string | null = null;
  if (Object.prototype.hasOwnProperty.call(valor, "motivo")) {
    const motivoBruto = valor["motivo"];
    if (motivoBruto !== null && motivoBruto !== undefined) {
      if (typeof motivoBruto !== "string") {
        return INVALIDO;
      }
      const aparado = motivoBruto.trim();
      if (aparado.length > LIMITES_BLOQUEIO.MOTIVO_TAMANHO_MAX) {
        return INVALIDO;
      }
      motivo = aparado.length > 0 ? aparado : null;
    }
  }

  return {
    valido: true,
    valor: {
      profissionalId,
      inicio,
      fim,
      motivo,
    },
  };
}

export type ResultadoTempoBloqueio =
  | { readonly valido: true }
  | { readonly valido: false; readonly erro: typeof ERRO_BLOQUEIO.BLOQUEIO_NO_PASSADO }
  | { readonly valido: false; readonly erro: typeof ERRO_BLOQUEIO.INTERVALO_EXCESSIVO };

/**
 * Avaliação das regras temporais da criação de bloqueio (docs/19 D-AGDC-04).
 *
 * Pura, sem dependência de relógio global — o instante de referência deve ser
 * passado explicitamente como `agora`.
 *
 * Precedência de regras:
 * 1. `fim <= agora` -> BLOQUEIO_NO_PASSADO (422);
 * 2. Duração > 365 dias (8.760h) -> INTERVALO_EXCESSIVO (422);
 * 3. Início > agora + 730 dias -> INTERVALO_EXCESSIVO (422);
 * 4. Demais casos (inclusive bloqueio iniciado no passado e em andamento:
 *    inicio < agora e fim > agora) -> válido.
 */
export function avaliarTempoBloqueio(
  intervalo: { readonly inicio: Date; readonly fim: Date },
  agora: Date,
): ResultadoTempoBloqueio {
  const agoraMs = agora.getTime();
  const inicioMs = intervalo.inicio.getTime();
  const fimMs = intervalo.fim.getTime();

  // 1. Término no passado ou exatamente no instante atual
  if (fimMs <= agoraMs) {
    return { valido: false, erro: ERRO_BLOQUEIO.BLOQUEIO_NO_PASSADO };
  }

  // 2. Duração máxima de 365 dias (8.760 horas absolutas)
  const duracaoMs = fimMs - inicioMs;
  if (duracaoMs > LIMITES_BLOQUEIO.DURACAO_MAX_MS) {
    return { valido: false, erro: ERRO_BLOQUEIO.INTERVALO_EXCESSIVO };
  }

  // 3. Limite de início no futuro até 730 dias a partir de agora
  if (inicioMs > agoraMs + LIMITES_BLOQUEIO.INICIO_FUTURO_MAX_MS) {
    return { valido: false, erro: ERRO_BLOQUEIO.INTERVALO_EXCESSIVO };
  }

  // 4. Bloqueio válido (em andamento ou totalmente futuro)
  return { valido: true };
}

const CHAVES_CONSULTA_OBRIGATORIAS: readonly string[] = Object.freeze(["de", "ate"]);

const CHAVES_CONSULTA_PERMITIDAS: ReadonlySet<string> = new Set([
  "de",
  "ate",
  "profissionalId",
]);

export interface ConsultaBloqueiosValidada {
  readonly de: Date;
  readonly ate: Date;
  readonly profissionalId?: string;
}

/**
 * Validação estrutural dos parâmetros de query de consulta de bloqueios (docs/19 D-AGDC-07).
 *
 * Pura, estrita e fail-closed:
 * - Exige objeto plano;
 * - Exige `de` e `ate` presentes como instantes ISO-8601 com offset explícito;
 * - Rejeita chaves adicionais desconhecidas;
 * - Rejeita repetição de parâmetros (arrays);
 * - Exige `de < ate`;
 * - Exige janela temporal [de, ate) de no máximo 7 dias absolutos;
 * - `profissionalId` é opcional; quando fornecido, deve ser UUID válido.
 *
 * Falhas nesta função representam erro 400 REQUISICAO_INVALIDA.
 */
export function validarConsultaBloqueios(valor: unknown): Validacao<ConsultaBloqueiosValidada> {
  if (!ehObjetoPlano(valor)) return INVALIDO;

  const chaves = Object.keys(valor);
  for (const obrigatoria of CHAVES_CONSULTA_OBRIGATORIAS) {
    if (!Object.prototype.hasOwnProperty.call(valor, obrigatoria)) {
      return INVALIDO;
    }
  }

  for (const chave of chaves) {
    if (!CHAVES_CONSULTA_PERMITIDAS.has(chave)) {
      return INVALIDO;
    }
  }

  const deBruto = valor["de"];
  const ateBruto = valor["ate"];
  if (typeof deBruto !== "string" || typeof ateBruto !== "string") {
    return INVALIDO;
  }

  const de = analisarInstante(deBruto);
  const ate = analisarInstante(ateBruto);
  if (de === null || ate === null) {
    return INVALIDO;
  }

  if (ate.getTime() <= de.getTime()) {
    return INVALIDO;
  }

  const duracaoMs = ate.getTime() - de.getTime();
  if (duracaoMs > LIMITES_BLOQUEIO.JANELA_CONSULTA_MAX_MS) {
    return INVALIDO;
  }

  let profissionalId: string | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(valor, "profissionalId")) {
    const profissionalIdBruto = valor["profissionalId"];
    if (typeof profissionalIdBruto !== "string" || !ehUuidValido(profissionalIdBruto)) {
      return INVALIDO;
    }
    profissionalId = profissionalIdBruto;
  }

  return {
    valido: true,
    valor: {
      de,
      ate,
      ...(profissionalId !== undefined ? { profissionalId } : {}),
    },
  };
}
