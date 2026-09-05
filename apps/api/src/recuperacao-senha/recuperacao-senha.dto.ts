// TechLab Fisio — contratos HTTP da recuperação de senha (Etapa 2.3D-B / F6).
//
// Mesma forma e mesma disciplina de `auth/auth.dto.ts` (F3): as classes
// descrevem o schema OpenAPI (`D-2.3D-11`, decorators explícitos) e nomeiam o
// contrato; a validação é função pura, sem `class-validator` e sem nenhuma
// dependência nova (TLF-BASE-V1 §14).
//
// O ÚNICO LUGAR DO PRODUTO EM QUE UM SEGREDO SAI EM CORPO DE RESPOSTA — e ele
// é homologado: AUT-004, passo 3 ("o segredo é apresentado UMA ÚNICA VEZ para
// entrega segura por canal externo à aplicação") e D-04, item 3. A resposta
// de início carrega o segredo em claro EXATAMENTE uma vez, ao Administrador
// autenticado que o iniciou; o produto não o persiste (só o hash), não o
// registra em log nem em auditoria, e não o devolve em nenhuma outra
// operação. `openapi.spec.ts` declara esta exceção nominalmente, em vez de
// afrouxar a varredura de campos secretos.
//
// O QUE OS DTOs NÃO FAZEM: nenhuma resposta carrega senha, hash, `usuarioId`
// do alvo na conclusão, id do segredo, estado interno de sessão ou distinção
// entre segredo inexistente, expirado, consumido e usuário inativo.

import { ApiProperty } from "@nestjs/swagger";

import { ERRO, MAXIMO_IDENTIFICADOR, MAXIMO_SENHA } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";

/**
 * Teto de recurso para o campo `segredo` na CONCLUSÃO. NÃO é a validação de
 * forma do segredo (43 caracteres base64url — `segredo-recuperacao.ts`): um
 * segredo de forma errada é uma TENTATIVA inválida, contabilizada e recusada
 * com `401` uniforme; este teto apenas impede que a fronteira aceite uma
 * entrada arbitrariamente grande.
 */
export const MAXIMO_SEGREDO_RECUPERACAO = 256;

/** Corpo aceito por `POST /auth/recuperacao-senha` (início — Administrador). */
export class IniciarRecuperacaoRequisicaoDto {
  @ApiProperty({
    description:
      "Identificador de acesso do usuário ALVO. Normalizado por trim + " +
      "lowercase antes de qualquer comparação (D-2.3D-03).",
    example: "recepcao@clinica.exemplo",
    maxLength: MAXIMO_IDENTIFICADOR,
    minLength: 1,
  })
  readonly identificador!: string;
}

/** Corpo de `201 Created` de `POST /auth/recuperacao-senha`. */
export class IniciarRecuperacaoRespostaDto {
  @ApiProperty({
    description:
      "Segredo de uso único, 256 bits (D-2.3D-08), apresentado UMA ÚNICA VEZ " +
      "ao Administrador para entrega por canal externo à aplicação (AUT-004, " +
      "passo 3; D-04). Não é persistido em claro, não é registrado e não pode " +
      "ser recuperado depois desta resposta.",
    pattern: "^[A-Za-z0-9_-]{43}$",
  })
  readonly segredo!: string;

  @ApiProperty({
    description: "Instante em que o segredo expira (30 min, D-2.3D-08).",
    format: "date-time",
  })
  readonly expiraEm!: string;
}

/** Corpo aceito por `POST /auth/recuperacao-senha/concluir` (usuário). */
export class ConcluirRecuperacaoRequisicaoDto {
  @ApiProperty({
    description: "Segredo recebido por canal externo. Uso único.",
    format: "password",
    maxLength: MAXIMO_SEGREDO_RECUPERACAO,
    minLength: 1,
  })
  readonly segredo!: string;

  @ApiProperty({
    description:
      "Nova senha em claro. Trafega exclusivamente no corpo sobre HTTPS, " +
      "nunca em URL, log ou auditoria (TLF-BASE-V1 §10). O Administrador " +
      "que iniciou a recuperação NÃO a conhece (AUT-004; D-04, item 4).",
    format: "password",
    maxLength: MAXIMO_SENHA,
    minLength: 1,
  })
  readonly novaSenha!: string;
}

/** Códigos de erro próprios da F6 — fonte única, consumida por código e teste. */
export const ERRO_RECUPERACAO = Object.freeze({
  /**
   * Início recusado: o alvo não existe, está inativo ou é o próprio ator.
   * UNIFORME entre os três motivos — o Administrador autenticado não recebe
   * um oráculo de existência/situação de contas a partir desta rota.
   */
  ALVO_NAO_ELEGIVEL: "ALVO_NAO_ELEGIVEL",
  /**
   * Conclusão recusada: segredo malformado, inexistente, expirado, já
   * consumido ou usuário inativo — UNIFORME (AUT-004: "token inválido,
   * expirado ou já utilizado; usuário inativo").
   */
  RECUPERACAO_INVALIDA: "RECUPERACAO_INVALIDA",
} as const);

/**
 * Corpo de erro das duas rotas — mesma forma `{ "erro": "<CODIGO>" }` da F3
 * (decisão local `L-03`), conjunto FECHADO: os códigos da fronteira de
 * autenticação, o código único da autorização e os dois desta fatia.
 */
export class ErroRecuperacaoSenhaDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.TENTATIVAS_EXCEDIDAS,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_RECUPERACAO.ALVO_NAO_ELEGIVEL,
      ERRO_RECUPERACAO.RECUPERACAO_INVALIDA,
    ],
  })
  readonly erro!: string;
}

export interface CorpoIniciarRecuperacaoValidado {
  readonly identificador: string;
}

export interface CorpoConcluirRecuperacaoValidado {
  readonly segredo: string;
  readonly novaSenha: string;
}

function ehObjetoPlano(corpo: unknown): corpo is Record<string, unknown> {
  return typeof corpo === "object" && corpo !== null && !Array.isArray(corpo);
}

/**
 * Validação ESTRUTURAL do corpo de início. Pura, total e fail-closed — mesma
 * regra do login: tamanho do identificador conferido APÓS `trim`, sem
 * normalizar (a normalização de `D-2.3D-03` tem um dono só, no serviço) e sem
 * validar formato de e-mail (nenhuma política de formato é homologada).
 */
export function validarCorpoIniciarRecuperacao(
  corpo: unknown,
):
  | { readonly valido: true; readonly valor: CorpoIniciarRecuperacaoValidado }
  | { readonly valido: false } {
  if (!ehObjetoPlano(corpo)) return { valido: false };
  const identificador = corpo["identificador"];
  if (typeof identificador !== "string") return { valido: false };
  if (identificador.trim().length === 0 || identificador.length > MAXIMO_IDENTIFICADOR) {
    return { valido: false };
  }
  return { valido: true, valor: { identificador } };
}

/**
 * Validação ESTRUTURAL do corpo de conclusão. Decide UMA coisa: se a
 * requisição é bem-formada o bastante para virar uma TENTATIVA de conclusão
 * — que então passa pelo rate limiter e pela verificação do segredo. A senha
 * NUNCA é normalizada; nenhuma política de senha está homologada, e aqui só
 * há teto de recurso.
 */
export function validarCorpoConcluirRecuperacao(
  corpo: unknown,
):
  | { readonly valido: true; readonly valor: CorpoConcluirRecuperacaoValidado }
  | { readonly valido: false } {
  if (!ehObjetoPlano(corpo)) return { valido: false };
  const segredo = corpo["segredo"];
  const novaSenha = corpo["novaSenha"];
  if (typeof segredo !== "string" || typeof novaSenha !== "string") {
    return { valido: false };
  }
  if (segredo.length === 0 || segredo.length > MAXIMO_SEGREDO_RECUPERACAO) {
    return { valido: false };
  }
  if (novaSenha.length === 0 || novaSenha.length > MAXIMO_SENHA) {
    return { valido: false };
  }
  return { valido: true, valor: { segredo, novaSenha } };
}
