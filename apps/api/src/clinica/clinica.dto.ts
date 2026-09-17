// TechLab Fisio — contratos HTTP da configuração dos dados da clínica única
// (CFG-001 sem logotipo + CFG-006 / fatia CFG-001A).
//
// Materializa `docs/14`:
//   - D-CFG-03: GET /clinica e PUT /clinica (substituição total, corpo estrito);
//   - D-CFG-04: trim; opcionais vazios -> null; limites de tamanho; e-mail com
//     validação estrutural mínima; fuso IANA case-sensitive reconhecido pelo
//     runtime, com `UTC` explicitamente aceito; sem coerção de tipos; sem
//     dependência nova;
//   - D-CFG-07: logotipo e duração padrão FORA do contrato;
//   - D-CFG-03-A: resposta exata { id, nomeCadastral, nomeOperacional, endereco,
//     telefone, email, fusoHorario }; D-CFG-04-A: predicado exato do e-mail.
//
// Validação pura sem class-validator (mesmo padrão de `usuarios.dto.ts`).

import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";

/** Limites homologados por D-CFG-04. */
export const LIMITES_CLINICA = Object.freeze({
  NOME_CADASTRAL: 200,
  NOME_OPERACIONAL: 200,
  ENDERECO: 500,
  TELEFONE: 32,
  EMAIL: 254,
} as const);

/** Chaves EXATAS aceitas por `PUT /clinica` (D-CFG-03). */
export const CHAVES_CORPO_CLINICA = Object.freeze([
  "nomeCadastral",
  "nomeOperacional",
  "endereco",
  "telefone",
  "email",
  "fusoHorario",
] as const);

/** Códigos de erro específicos da configuração da clínica. */
export const ERRO_CLINICA = Object.freeze({
  /** A linha única de `clinica` ainda não foi provisionada (D-CFG-01). */
  CLINICA_NAO_CONFIGURADA: "CLINICA_NAO_CONFIGURADA",
} as const);

/** Corpo aceito por `PUT /clinica`. */
export class AtualizarClinicaRequisicaoDto {
  @ApiProperty({ description: "Nome cadastral da clínica.", minLength: 1, maxLength: LIMITES_CLINICA.NOME_CADASTRAL, example: "Clínica Exemplo Ltda." })
  readonly nomeCadastral!: string;

  @ApiProperty({ description: "Nome operacional; vazio vira null.", maxLength: LIMITES_CLINICA.NOME_OPERACIONAL, nullable: true, type: String, example: "Clínica Exemplo" })
  readonly nomeOperacional!: string | null;

  @ApiProperty({ description: "Endereço em texto livre; vazio vira null.", maxLength: LIMITES_CLINICA.ENDERECO, nullable: true, type: String, example: "Rua Exemplo, 100" })
  readonly endereco!: string | null;

  @ApiProperty({ description: "Telefone em texto livre; vazio vira null.", maxLength: LIMITES_CLINICA.TELEFONE, nullable: true, type: String, example: "(11) 0000-0000" })
  readonly telefone!: string | null;

  @ApiProperty({ description: "E-mail de contato; vazio vira null.", maxLength: LIMITES_CLINICA.EMAIL, nullable: true, type: String, example: "contato@clinica.exemplo" })
  readonly email!: string | null;

  @ApiProperty({ description: "Fuso horário operacional IANA (case-sensitive); UTC aceito.", example: "America/Sao_Paulo" })
  readonly fusoHorario!: string;
}

/** Resposta de `GET /clinica` e `PUT /clinica`. */
export class ClinicaRespostaDto {
  @ApiProperty({ description: "Identificador UUID da clínica.", format: "uuid" })
  readonly id!: string;

  @ApiProperty({ description: "Nome cadastral da clínica." })
  readonly nomeCadastral!: string;

  @ApiProperty({ nullable: true, type: String })
  readonly nomeOperacional!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly endereco!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly telefone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly email!: string | null;

  @ApiProperty({ description: "Fuso horário operacional IANA.", example: "America/Sao_Paulo" })
  readonly fusoHorario!: string;
}

/** Corpo de erro padronizado da configuração da clínica. */
export class ErroClinicaDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_CLINICA.CLINICA_NAO_CONFIGURADA,
    ],
  })
  readonly erro!: string;
}

export interface DadosClinicaValidados {
  readonly nomeCadastral: string;
  readonly nomeOperacional: string | null;
  readonly endereco: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
  readonly fusoHorario: string;
}

let fusosPreferidos: ReadonlySet<string> | null = null;

/** Nome IANA: segmentos separados por `/`, cada um iniciando por maiúscula (ex.: `Etc/GMT+3`, `US/Eastern`). */
const FORMA_NOME_IANA = /^[A-Z][A-Za-z0-9_+-]*(\/[A-Z][A-Za-z0-9_+-]*)*$/;

/**
 * Fuso IANA reconhecido pelo runtime (D-CFG-04), case-sensitive, com `UTC`
 * aceito explicitamente.
 *
 * `Intl.supportedValuesOf("timeZone")` lista só identificadores PREFERIDOS;
 * links IANA válidos (`US/Eastern`, `Etc/GMT+3`,
 * `America/Argentina/Buenos_Aires`) são reconhecidos por `Intl.DateTimeFormat`.
 * Regra aplicada:
 *   1. `UTC` ou identificador preferido exato -> aceito;
 *   2. senão, exige forma de nome IANA (rejeita offsets como `-03:00`, que o
 *      runtime aceita mas não são IANA), reconhecimento pelo runtime e que o
 *      valor NÃO seja variante de caixa do identificador canônico resolvido.
 * Limite: o runtime não expõe a grafia dos links; uma variante de caixa de um
 * link cujo primeiro caractere de cada segmento é maiúsculo (`US/eastern`) não
 * é distinguível e é aceita.
 */
export function ehFusoHorarioValido(valor: string): boolean {
  if (valor === "UTC") return true;
  if (fusosPreferidos === null) {
    fusosPreferidos = new Set(Intl.supportedValuesOf("timeZone"));
  }
  if (fusosPreferidos.has(valor)) return true;
  if (!FORMA_NOME_IANA.test(valor)) return false;

  let canonico: string;
  try {
    canonico = new Intl.DateTimeFormat("en-US", { timeZone: valor }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  return !(canonico !== valor && canonico.toLowerCase() === valor.toLowerCase());
}

/** Quantidade de CARACTERES (code points), não de unidades UTF-16. */
export function contarCaracteres(valor: string): number {
  let total = 0;
  for (const _ of valor) total++;
  return total;
}

/**
 * Validação estrutural MÍNIMA de e-mail (D-CFG-04; predicado exato em D-CFG-04-A): exatamente um `@`, parte
 * local e domínio não vazios, domínio com ponto interno, sem espaços.
 */
export function ehEmailEstruturalmenteValido(valor: string): boolean {
  if (/\s/.test(valor)) return false;
  const partes = valor.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes as [string, string];
  if (local.length === 0 || dominio.length === 0) return false;
  const ponto = dominio.indexOf(".");
  return ponto > 0 && ponto < dominio.length - 1 && !dominio.endsWith(".");
}

function ehObjetoPlano(corpo: unknown): corpo is Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return false;
  const prototipo = Object.getPrototypeOf(corpo);
  return prototipo === Object.prototype || prototipo === null;
}

/** Obrigatório: string, trim, 1..maximo. `undefined` indica inválido. */
function textoObrigatorio(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== "string") return undefined;
  const aparado = valor.trim();
  if (aparado.length === 0 || contarCaracteres(aparado) > maximo) return undefined;
  return aparado;
}

/** Opcional: string ou null; trim; vazio -> null; `undefined` indica inválido. */
function textoOpcional(valor: unknown, maximo: number): string | null | undefined {
  if (valor === null) return null;
  if (typeof valor !== "string") return undefined;
  const aparado = valor.trim();
  if (aparado.length === 0) return null;
  if (contarCaracteres(aparado) > maximo) return undefined;
  return aparado;
}

/**
 * Validação do corpo de `PUT /clinica` — pura e fail-closed:
 *   - objeto plano com EXATAMENTE as 6 chaves (ausente ou extra -> inválido;
 *     inclui `id`, `criadoEm`, `logotipoChave`, `duracaoPadraoAtendimentoMin`);
 *   - sem coerção de tipos (número/booleano/array nunca viram string);
 *   - normalização de D-CFG-04.
 */
export function validarCorpoAtualizarClinica(
  corpo: unknown,
): { readonly valido: true; readonly valor: DadosClinicaValidados } | { readonly valido: false } {
  if (!ehObjetoPlano(corpo)) return { valido: false };

  const chaves = Object.keys(corpo);
  if (
    chaves.length !== CHAVES_CORPO_CLINICA.length ||
    !CHAVES_CORPO_CLINICA.every((chave) => Object.prototype.hasOwnProperty.call(corpo, chave))
  ) {
    return { valido: false };
  }

  const nomeCadastral = textoObrigatorio(corpo["nomeCadastral"], LIMITES_CLINICA.NOME_CADASTRAL);
  const nomeOperacional = textoOpcional(corpo["nomeOperacional"], LIMITES_CLINICA.NOME_OPERACIONAL);
  const endereco = textoOpcional(corpo["endereco"], LIMITES_CLINICA.ENDERECO);
  const telefone = textoOpcional(corpo["telefone"], LIMITES_CLINICA.TELEFONE);
  const email = textoOpcional(corpo["email"], LIMITES_CLINICA.EMAIL);
  const fusoBruto = corpo["fusoHorario"];

  if (
    nomeCadastral === undefined ||
    nomeOperacional === undefined ||
    endereco === undefined ||
    telefone === undefined ||
    email === undefined ||
    typeof fusoBruto !== "string"
  ) {
    return { valido: false };
  }

  if (email !== null && !ehEmailEstruturalmenteValido(email)) return { valido: false };

  const fusoHorario = fusoBruto.trim();
  if (!ehFusoHorarioValido(fusoHorario)) return { valido: false };

  return {
    valido: true,
    valor: { nomeCadastral, nomeOperacional, endereco, telefone, email, fusoHorario },
  };
}
