// TechLab Fisio — contratos HTTP da alteração de situação de usuário (AUT-005 / D-2.3D-21).
//
// DTOs de request/response e validação estrutural do payload.
// Materializa D-2.3D-21:
//   - PATCH /auth/usuarios/:usuarioId/situacao
//   - Body estrito: { "ativo": boolean }
//   - Resposta: { "usuarioId": string, "ativo": boolean, "inativadoEm": string | null }
//   - Validação pura sem class-validator (TLF-BASE-V1 §14)

import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "./auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";

/** Regex de validação do formato canônico de UUID estrutural (RFC 4122 / RFC 9562, 8-4-4-4-12 hex). */
export const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validação estrutural do identificador de usuário informado no path.
 */
export function ehUuidValido(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_UUID.test(valor);
}

/** Corpo aceito por `PATCH /auth/usuarios/:usuarioId/situacao`. */
export class AlterarSituacaoUsuarioRequisicaoDto {
  @ApiProperty({
    description: "Situação da conta do usuário. 'true' para ativa, 'false' para inativa.",
    example: false,
    type: Boolean,
  })
  readonly ativo!: boolean;
}

/** Corpo de resposta de sucesso de `PATCH /auth/usuarios/:usuarioId/situacao`. */
export class AlterarSituacaoUsuarioRespostaDto {
  @ApiProperty({
    description: "Identificador UUID do usuário alterado.",
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  readonly usuarioId!: string;

  @ApiProperty({
    description: "Situação vigente da conta após a operação.",
    example: false,
  })
  readonly ativo!: boolean;

  @ApiProperty({
    description:
      "Instante em que o usuário foi inativado (ISO-8601), ou null se a conta estiver ativa.",
    format: "date-time",
    nullable: true,
    example: "2026-09-16T23:30:00.000Z",
  })
  readonly inativadoEm!: string | null;
}

/** Códigos de erro específicos da gestão de situação de usuários. */
export const ERRO_USUARIOS = Object.freeze({
  /** Alvo inexistente no banco de dados. */
  USUARIO_INEXISTENTE: "USUARIO_INEXISTENTE",
  /** Tentativa de auto-inativação pelo Administrador autenticado (D21-01). */
  AUTO_INATIVACAO_PROIBIDA: "AUTO_INATIVACAO_PROIBIDA",
} as const);

/** Corpo de erro padronizado para a gestão de situação de usuários. */
export class ErroSituacaoUsuarioDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
      ERRO_USUARIOS.USUARIO_INEXISTENTE,
      ERRO_USUARIOS.AUTO_INATIVACAO_PROIBIDA,
    ],
  })
  readonly erro!: string;
}

export interface CorpoAlterarSituacaoValidado {
  readonly ativo: boolean;
}

function ehObjetoPlano(corpo: unknown): corpo is Record<string, unknown> {
  return typeof corpo === "object" && corpo !== null && !Array.isArray(corpo);
}

/**
 * Validação estrutural do corpo de alteração de situação de usuário.
 *
 * Pura, fail-closed:
 *   - exige objeto plano;
 *   - exige propriedade `ativo` estritamente do tipo boolean (sem conversão de string/number);
 *   - rejeita terminantemente propriedades excedentes (inclusive campos de ator);
 */
export function validarCorpoAlterarSituacao(
  corpo: unknown,
): { readonly valido: true; readonly valor: CorpoAlterarSituacaoValidado } | { readonly valido: false } {
  if (!ehObjetoPlano(corpo)) return { valido: false };

  const chaves = Object.keys(corpo);
  if (chaves.length !== 1 || chaves[0] !== "ativo") {
    return { valido: false };
  }

  const { ativo } = corpo;
  if (typeof ativo !== "boolean") {
    return { valido: false };
  }

  return { valido: true, valor: { ativo } };
}
