// TechLab Fisio — contratos HTTP da fronteira de autenticação (Etapa 2.3D-B / F3).
//
// DTOs de request/response e a validação estrutural do payload. As classes
// existem para DUAS finalidades simultâneas e inseparáveis: descrever o
// schema OpenAPI (`D-2.3D-11` — decorators explícitos) e nomear o contrato no
// código. Elas NÃO validam nada por si: a validação é a função pura
// `validarCorpoLogin`, e é ela que a fronteira executa.
//
// NENHUMA DEPENDÊNCIA NOVA DE VALIDAÇÃO. `class-validator` e
// `class-transformer` são peers OPCIONAIS de `@nestjs/swagger@11.4.7`
// (medido: `peerDependenciesMeta.optional = true` nos dois) e NÃO foram
// instalados. O contrato de login tem dois campos string; a validação cabe em
// uma função explícita de vinte linhas, testável sem container, sem
// metaprogramação e sem decorators de runtime. Instalar um framework de
// validação para isso seria dependência sem justificativa
// (TLF-BASE-V1 §14) e complexidade antecipada (§4.5).
//
// O QUE OS DTOs NÃO PODEM FAZER — e por construção não fazem: devolver senha,
// devolver token, expor hash, expor `token_hash`, expor `sessao_id`, expor
// estado interno de sessão, ou diferenciar conta existente de inexistente por
// detalhe de erro. A resposta de falha é UMA classe com UM campo de conjunto
// fechado.

import { ApiProperty } from "@nestjs/swagger";

/**
 * Limite de tamanho do identificador — comprimento máximo de um endereço de
 * e-mail em RFC 5321 §4.5.3.1.3. É controle de forma e de recurso, NÃO
 * validação de formato de e-mail: `D-2.3D-03` normaliza (`trim` + `lowercase`)
 * e nada mais, e nenhuma política de formato está homologada.
 */
const MAXIMO_IDENTIFICADOR = 320;

/**
 * Limite de tamanho da senha. NÃO é política de senha (nenhuma está
 * homologada): é teto de recurso, para que a fronteira não repasse ao Argon2
 * uma entrada arbitrariamente grande. Folgado o bastante para qualquer
 * passphrase legítima.
 */
const MAXIMO_SENHA = 4096;

/** Corpo aceito por `POST /auth/login`. */
export class LoginRequisicaoDto {
  @ApiProperty({
    description:
      "Identificador de acesso do usuário. Normalizado por trim + lowercase " +
      "antes de qualquer comparação (D-2.3D-03).",
    example: "recepcao@clinica.exemplo",
    maxLength: MAXIMO_IDENTIFICADOR,
    minLength: 1,
  })
  readonly identificador!: string;

  @ApiProperty({
    description:
      "Senha em claro. Trafega exclusivamente no corpo sobre HTTPS, nunca em " +
      "URL, log ou auditoria (TLF-BASE-V1 §10).",
    format: "password",
    maxLength: MAXIMO_SENHA,
    minLength: 1,
  })
  readonly senha!: string;
}

/**
 * Corpo de `200 OK` de `POST /auth/login`.
 *
 * O token de sessão NÃO está aqui e não pode estar (`D-2.3D-07`): ele sai
 * exclusivamente pelo cookie `HttpOnly`. `sessaoId` também não: o cliente não
 * tem uso legítimo para ele, e expô-lo seria superfície sem contrapartida.
 */
export class LoginRespostaDto {
  @ApiProperty({
    description: "Identificador do usuário autenticado.",
    format: "uuid",
  })
  readonly usuarioId!: string;

  @ApiProperty({
    description:
      "Instante da expiração ABSOLUTA da sessão (8 h, D-2.3D-04). É o teto " +
      "fixado na criação e não desliza; o timeout ocioso de 15 min é aplicado " +
      "adicionalmente pelo backend.",
    format: "date-time",
  })
  readonly expiraEm!: string;
}

/**
 * Corpo de erro — ÚNICO para toda a fronteira de autenticação.
 *
 * `erro` é um código de conjunto fechado. Nenhuma mensagem livre, nenhum
 * detalhe interno, nenhum stack trace, nenhuma distinção entre conta
 * existente e inexistente.
 */
export class ErroAutenticacaoDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      "REQUISICAO_INVALIDA",
      "CREDENCIAIS_INVALIDAS",
      "SESSAO_INVALIDA",
      "TENTATIVAS_EXCEDIDAS",
      "REQUISICAO_NAO_AUTORIZADA",
      "FALHA_INTERNA",
    ],
  })
  readonly erro!: string;
}

/** Códigos de erro da fronteira — fonte única, consumida por código e teste. */
export const ERRO = Object.freeze({
  /** Payload malformado. NÃO gera evento de auditoria (`D-2.3D-12`). */
  REQUISICAO_INVALIDA: "REQUISICAO_INVALIDA",
  /** Falha de autenticação — uniforme para conta existente e inexistente. */
  CREDENCIAIS_INVALIDAS: "CREDENCIAIS_INVALIDAS",
  /** Sessão ausente, malformada, inexistente, expirada ou revogada — uniforme. */
  SESSAO_INVALIDA: "SESSAO_INVALIDA",
  /** Rate limit de `D-2.3D-06`. NÃO gera evento de auditoria (`D-2.3D-12`). */
  TENTATIVAS_EXCEDIDAS: "TENTATIVAS_EXCEDIDAS",
  /** Baseline CSRF de `D-2.3D-07` recusou a mutação. */
  REQUISICAO_NAO_AUTORIZADA: "REQUISICAO_NAO_AUTORIZADA",
  /**
   * Falha TÉCNICA inesperada (persistência, addon nativo, indisponibilidade).
   * Deliberadamente distinta de `CREDENCIAIS_INVALIDAS`: mascarar incidente de
   * infraestrutura como senha errada destruiria a observabilidade operacional
   * e mentiria para o cliente. Não revela nada sobre a conta.
   */
  FALHA_INTERNA: "FALHA_INTERNA",
} as const);

export interface CorpoLoginValidado {
  readonly identificador: string;
  readonly senha: string;
}

/**
 * Validação ESTRUTURAL do corpo de login. Pura, total e fail-closed.
 *
 * Ela decide UMA coisa: se a requisição é bem-formada o bastante para virar
 * uma tentativa de autenticação. Rejeita tipo errado, campo ausente, campo
 * vazio, campo excessivo e corpo que não é objeto plano.
 *
 * NÃO normaliza e NÃO autentica: a normalização de `D-2.3D-03` é aplicada
 * adiante, por `normalizarIdentificadorLogin`, e a decisão de autenticar é do
 * `AutenticacaoService`. Manter as três coisas separadas é o que permite que
 * a fronteira distinga com segurança "payload rejeitado ANTES da
 * autenticação" (sem auditoria — `D-2.3D-12`) de "tentativa rejeitada PELA
 * autenticação" (com auditoria).
 *
 * O identificador é validado quanto ao tamanho APÓS `trim`: espaços em volta
 * são exatamente o que `D-2.3D-03` manda descartar, e um valor que só tem
 * espaços é vazio, não válido.
 */
export function validarCorpoLogin(
  corpo: unknown,
): { readonly valido: true; readonly valor: CorpoLoginValidado } | { readonly valido: false } {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return { valido: false };
  }
  const candidato = corpo as Record<string, unknown>;
  const identificador = candidato["identificador"];
  const senha = candidato["senha"];

  if (typeof identificador !== "string" || typeof senha !== "string") {
    return { valido: false };
  }
  if (identificador.trim().length === 0 || identificador.length > MAXIMO_IDENTIFICADOR) {
    return { valido: false };
  }
  if (senha.length === 0 || senha.length > MAXIMO_SENHA) {
    return { valido: false };
  }
  return { valido: true, valor: { identificador, senha } };
}
