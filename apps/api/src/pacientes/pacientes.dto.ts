// TechLab Fisio — contratos HTTP da fatia mínima de pacientes (PAC-A;
// `docs/17` D-PAC-01..D-PAC-04).
//
// Materializa:
//   - D-PAC-01: nome 1–200 (trim, espaços internos colapsados, sem controle);
//     dataNascimento obrigatória, civil válida, >= 1900-01-01 e não futura
//     (data local da clínica — verificada no serviço, que conhece o fuso);
//     CPF opcional com ou sem máscara, persistido só com dígitos, DV válido e
//     sem sequência repetida; telefone opcional até 32 (texto livre); e-mail
//     opcional com o predicado exato de D-CFG-04-A;
//   - D-PAC-02: corpos EXATOS; resposta EXATA; códigos novos
//     PACIENTE_NAO_ENCONTRADO, CPF_JA_CADASTRADO e POSSIVEL_DUPLICIDADE;
//   - D-PAC-04: busca por corpo `{ nome, cpf, dataNascimento, ativo }`, ao menos
//     um de nome/cpf/dataNascimento, nome com no mínimo 3 caracteres.
//
// Nenhuma mensagem, erro ou log carrega valor pessoal (Base §10, RN-063).
// Validação pura sem class-validator (mesmo padrão de `clinica.dto.ts`).

import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import {
  contarCaracteres,
  ehEmailEstruturalmenteValido,
  ERRO_CLINICA,
} from "../clinica/clinica.dto.js";

/** Limites homologados por D-PAC-01 e D-PAC-04. */
export const LIMITES_PACIENTE = Object.freeze({
  NOME: 200,
  TELEFONE: 32,
  EMAIL: 254,
  NOME_BUSCA_MIN: 3,
  RESULTADOS_BUSCA: 20,
  DATA_MINIMA: "1900-01-01",
} as const);

export const CHAVES_CORPO_CRIAR = Object.freeze([
  "nome",
  "dataNascimento",
  "cpf",
  "telefone",
  "email",
  "confirmarPossivelDuplicidade",
] as const);
export const CHAVES_CORPO_ATUALIZAR = Object.freeze(["nome", "dataNascimento", "cpf", "telefone", "email"] as const);
export const CHAVES_CORPO_BUSCA = Object.freeze(["nome", "cpf", "dataNascimento", "ativo"] as const);

/** Códigos de erro específicos de pacientes (D-PAC-02). */
export const ERRO_PACIENTE = Object.freeze({
  PACIENTE_NAO_ENCONTRADO: "PACIENTE_NAO_ENCONTRADO",
  CPF_JA_CADASTRADO: "CPF_JA_CADASTRADO",
  POSSIVEL_DUPLICIDADE: "POSSIVEL_DUPLICIDADE",
} as const);

/** Qualquer caractere de controle C0/C1. */
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;
const FORMA_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMA_CPF = /^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;

// ---------------------------------------------------------------------------
// DTOs (OpenAPI)
// ---------------------------------------------------------------------------

export class CriarPacienteRequisicaoDto {
  @ApiProperty({ minLength: 1, maxLength: LIMITES_PACIENTE.NOME, example: "Maria Sintética" })
  readonly nome!: string;

  @ApiProperty({ description: "Data civil YYYY-MM-DD, não futura, a partir de 1900-01-01.", format: "date", example: "1990-05-17" })
  readonly dataNascimento!: string;

  @ApiProperty({ description: "CPF opcional, 11 dígitos com ou sem máscara; vazio vira null.", nullable: true, type: String, example: null })
  readonly cpf!: string | null;

  @ApiProperty({ maxLength: LIMITES_PACIENTE.TELEFONE, nullable: true, type: String, example: null })
  readonly telefone!: string | null;

  @ApiProperty({ maxLength: LIMITES_PACIENTE.EMAIL, nullable: true, type: String, example: null })
  readonly email!: string | null;

  @ApiProperty({ description: "`true` confirma a criação apesar de coincidência forte de nome e data (D-PAC-03).", type: Boolean, example: false })
  readonly confirmarPossivelDuplicidade!: boolean;
}

export class AtualizarPacienteRequisicaoDto {
  @ApiProperty({ minLength: 1, maxLength: LIMITES_PACIENTE.NOME })
  readonly nome!: string;

  @ApiProperty({ format: "date" })
  readonly dataNascimento!: string;

  @ApiProperty({ nullable: true, type: String })
  readonly cpf!: string | null;

  @ApiProperty({ maxLength: LIMITES_PACIENTE.TELEFONE, nullable: true, type: String })
  readonly telefone!: string | null;

  @ApiProperty({ maxLength: LIMITES_PACIENTE.EMAIL, nullable: true, type: String })
  readonly email!: string | null;
}

export class SituacaoPacienteRequisicaoDto {
  @ApiProperty({ type: Boolean, example: false })
  readonly ativo!: boolean;
}

export class BuscaPacientesRequisicaoDto {
  @ApiProperty({ description: "Trecho do nome (mínimo 3 caracteres) ou null.", nullable: true, type: String })
  readonly nome!: string | null;

  @ApiProperty({ description: "CPF (igualdade) ou null.", nullable: true, type: String })
  readonly cpf!: string | null;

  @ApiProperty({ description: "Data de nascimento (igualdade) ou null.", nullable: true, type: String, format: "date" })
  readonly dataNascimento!: string | null;

  @ApiProperty({ description: "Filtro de situação ou null (todos).", nullable: true, type: Boolean })
  readonly ativo!: boolean | null;
}

export class PacienteRespostaDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty()
  readonly nome!: string;

  @ApiProperty({ description: "Sempre preenchida pela API; null só em linha legada sem data.", format: "date", nullable: true, type: String })
  readonly dataNascimento!: string | null;

  @ApiProperty({ description: "Somente dígitos, ou null.", nullable: true, type: String })
  readonly cpf!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly telefone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly email!: string | null;

  @ApiProperty()
  readonly ativo!: boolean;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  readonly inativadoEm!: string | null;
}

export class PacienteResumoDto {
  @ApiProperty({ format: "uuid" })
  readonly id!: string;

  @ApiProperty()
  readonly nome!: string;

  @ApiProperty({ format: "date", nullable: true, type: String })
  readonly dataNascimento!: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly cpf!: string | null;

  @ApiProperty()
  readonly ativo!: boolean;
}

export class BuscaPacientesRespostaDto {
  @ApiProperty({ type: [PacienteResumoDto], maxItems: LIMITES_PACIENTE.RESULTADOS_BUSCA })
  readonly pacientes!: PacienteResumoDto[];

  @ApiProperty({ description: "`true` quando havia mais resultados que o limite." })
  readonly truncado!: boolean;
}

export class ErroPacienteDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_CLINICA.CLINICA_NAO_CONFIGURADA,
      ERRO_PACIENTE.PACIENTE_NAO_ENCONTRADO,
      ERRO_PACIENTE.CPF_JA_CADASTRADO,
      ERRO_PACIENTE.POSSIVEL_DUPLICIDADE,
    ],
  })
  readonly erro!: string;
}

// ---------------------------------------------------------------------------
// Validação pura
// ---------------------------------------------------------------------------

export interface DadosPacienteValidados {
  readonly nome: string;
  /** `YYYY-MM-DD`; a regra "não futura" é aplicada no serviço (fuso da clínica). */
  readonly dataNascimento: string;
  readonly cpf: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
}

export interface FiltroBuscaValidado {
  readonly nome: string | null;
  readonly cpf: string | null;
  readonly dataNascimento: string | null;
  readonly ativo: boolean | null;
}

type Validacao<T> = { readonly valido: true; readonly valor: T } | { readonly valido: false };

function ehObjetoPlano(corpo: unknown): corpo is Record<string, unknown> {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) return false;
  const prototipo = Object.getPrototypeOf(corpo);
  return prototipo === Object.prototype || prototipo === null;
}

function temExatamente(corpo: Record<string, unknown>, chaves: readonly string[]): boolean {
  const presentes = Object.keys(corpo);
  return (
    presentes.length === chaves.length &&
    chaves.every((chave) => Object.prototype.hasOwnProperty.call(corpo, chave))
  );
}

/** Nome (D-PAC-01): controle rejeitado em qualquer posição; trim; espaços internos colapsados; 1..200. */
export function normalizarNomePaciente(valor: unknown): string | undefined {
  if (typeof valor !== "string" || CONTROLE.test(valor)) return undefined;
  const normalizado = valor.trim().replace(/\s+/g, " ");
  if (normalizado.length === 0 || contarCaracteres(normalizado) > LIMITES_PACIENTE.NOME) return undefined;
  return normalizado;
}

/** Chave de comparação da coincidência forte (D-PAC-03): minúsculas, sem diacríticos, espaços colapsados. */
export function chaveComparacaoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Data civil `YYYY-MM-DD` válida no gregoriano e >= 1900-01-01. `undefined` indica inválido. */
export function validarDataCivil(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const m = FORMA_DATA.exec(valor);
  if (m === null) return undefined;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  if (valor < LIMITES_PACIENTE.DATA_MINIMA) return undefined;
  return valor;
}

/** Dígitos verificadores do CPF (11 dígitos, sem sequência repetida). */
export function ehCpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const n = [...digitos].map(Number);
  const dv = (quantidade: number): number => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) soma += (n[i] as number) * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

/**
 * CPF opcional (D-PAC-01): `null` ou string vazia → `null`; aceita 11 dígitos
 * ou a máscara `000.000.000-00`; devolve só os dígitos. `undefined` = inválido.
 */
export function normalizarCpf(valor: unknown): string | null | undefined {
  if (valor === null) return null;
  if (typeof valor !== "string") return undefined;
  const aparado = valor.trim();
  if (aparado.length === 0) return null;
  if (!FORMA_CPF.test(aparado)) return undefined;
  const digitos = aparado.replace(/\D/g, "");
  return ehCpfValido(digitos) ? digitos : undefined;
}

function textoOpcional(valor: unknown, maximo: number): string | null | undefined {
  if (valor === null) return null;
  if (typeof valor !== "string" || CONTROLE.test(valor)) return undefined;
  const aparado = valor.trim();
  if (aparado.length === 0) return null;
  if (contarCaracteres(aparado) > maximo) return undefined;
  return aparado;
}

function emailOpcional(valor: unknown): string | null | undefined {
  const texto = textoOpcional(valor, LIMITES_PACIENTE.EMAIL);
  if (texto === undefined || texto === null) return texto;
  return ehEmailEstruturalmenteValido(texto) ? texto : undefined;
}

function validarDados(corpo: Record<string, unknown>): Validacao<DadosPacienteValidados> {
  const nome = normalizarNomePaciente(corpo["nome"]);
  const dataNascimento = validarDataCivil(corpo["dataNascimento"]);
  const cpf = normalizarCpf(corpo["cpf"]);
  const telefone = textoOpcional(corpo["telefone"], LIMITES_PACIENTE.TELEFONE);
  const email = emailOpcional(corpo["email"]);
  if (
    nome === undefined ||
    dataNascimento === undefined ||
    cpf === undefined ||
    telefone === undefined ||
    email === undefined
  ) {
    return { valido: false };
  }
  return { valido: true, valor: { nome, dataNascimento, cpf, telefone, email } };
}

/** `POST /pacientes` (D-PAC-02). */
export function validarCorpoCriarPaciente(
  corpo: unknown,
): Validacao<{ readonly dados: DadosPacienteValidados; readonly confirmarPossivelDuplicidade: boolean }> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO_CRIAR)) return { valido: false };
  const confirmar = corpo["confirmarPossivelDuplicidade"];
  if (typeof confirmar !== "boolean") return { valido: false };
  const dados = validarDados(corpo);
  if (!dados.valido) return { valido: false };
  return { valido: true, valor: { dados: dados.valor, confirmarPossivelDuplicidade: confirmar } };
}

/** `PUT /pacientes/:pacienteId` (D-PAC-02). */
export function validarCorpoAtualizarPaciente(corpo: unknown): Validacao<DadosPacienteValidados> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO_ATUALIZAR)) return { valido: false };
  return validarDados(corpo);
}

/** `PATCH /pacientes/:pacienteId/situacao` (D-PAC-02). */
export function validarCorpoSituacaoPaciente(corpo: unknown): Validacao<{ readonly ativo: boolean }> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, ["ativo"])) return { valido: false };
  const ativo = corpo["ativo"];
  if (typeof ativo !== "boolean") return { valido: false };
  return { valido: true, valor: { ativo } };
}

/** `POST /pacientes/busca` (D-PAC-04). */
export function validarCorpoBuscaPacientes(corpo: unknown): Validacao<FiltroBuscaValidado> {
  if (!ehObjetoPlano(corpo) || !temExatamente(corpo, CHAVES_CORPO_BUSCA)) return { valido: false };

  let nome: string | null = null;
  if (corpo["nome"] !== null) {
    const normalizado = normalizarNomePaciente(corpo["nome"]);
    if (normalizado === undefined || contarCaracteres(normalizado) < LIMITES_PACIENTE.NOME_BUSCA_MIN) {
      return { valido: false };
    }
    nome = normalizado;
  }

  const cpfBruto = corpo["cpf"];
  let cpf: string | null = null;
  if (cpfBruto !== null) {
    const normalizado = normalizarCpf(cpfBruto);
    if (normalizado === undefined || normalizado === null) return { valido: false };
    cpf = normalizado;
  }

  let dataNascimento: string | null = null;
  if (corpo["dataNascimento"] !== null) {
    const data = validarDataCivil(corpo["dataNascimento"]);
    if (data === undefined) return { valido: false };
    dataNascimento = data;
  }

  const ativo = corpo["ativo"];
  if (ativo !== null && typeof ativo !== "boolean") return { valido: false };

  if (nome === null && cpf === null && dataNascimento === null) return { valido: false };
  return { valido: true, valor: { nome, cpf, dataNascimento, ativo } };
}
