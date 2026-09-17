// TechLab Fisio — contratos HTTP da gestão administrativa de sessões (P-2.3D-07 / AUT-002).
//
// Materializa D-2.3D-19 (docs/12 §5.19) e o critério de aceite A-04 (§10.4):
// "Não existe campo HTTP — corpo, query, path, cabeçalho ou DTO — capaz de
// substituir ou injetar o ator; o contrato NÃO possui campo equivalente, ainda
// que fosse ignorado".
//
// NENHUMA DEPENDÊNCIA NOVA DE VALIDAÇÃO: função pura de validação de UUID,
// sem class-validator ou class-transformer (TLF-BASE-V1 §14).

import { ApiProperty } from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";

/** Regex de validação do formato canônico de UUID estrutural (RFC 4122 / RFC 9562, 8-4-4-4-12 hex). */
export const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validação estrutural do identificador de sessão informado no path.
 *
 * Pura, fail-closed: aceita somente strings no formato padrão de UUID.
 * Rejeita qualquer outro formato ou tipo.
 */
export function ehUuidValido(valor: unknown): valor is string {
  return typeof valor === "string" && REGEX_UUID.test(valor);
}

/**
 * Corpo de erro para as rotas administrativas de sessão.
 *
 * Mesma disciplina de formato fechado \`{ "erro": "<CODIGO>" }\`.
 * Não expõe detalhes do banco, tokens ou motivo interno da rejeição.
 */
export class ErroSessaoAdministrativaDto {
  @ApiProperty({
    description: "Código estável do erro.",
    enum: [
      ERRO.REQUISICAO_INVALIDA,
      ERRO.SESSAO_INVALIDA,
      ERRO.REQUISICAO_NAO_AUTORIZADA,
      ERRO.FALHA_INTERNA,
      ERRO_AUTORIZACAO.ACESSO_NEGADO,
    ],
  })
  readonly erro!: string;
}

/**
 * Item da listagem administrativa de sessões ativas (D-2.3D-22).
 *
 * Projeção FECHADA: somente identificador e instantes. Nunca token, hash de
 * token, cookie, estado interno, IP, user agent ou autoria.
 */
export class SessaoAtivaUsuarioDto {
  @ApiProperty({ description: "Identificador da sessão ativa.", format: "uuid" })
  readonly sessaoId!: string;

  @ApiProperty({ description: "Instante de criação da sessão (UTC).", format: "date-time" })
  readonly criadaEm!: string;

  @ApiProperty({ description: "Instante da última atividade registrada (UTC).", format: "date-time" })
  readonly ultimaAtividadeEm!: string;

  @ApiProperty({ description: "Instante de expiração absoluta da sessão (UTC).", format: "date-time" })
  readonly expiraEm!: string;
}

/**
 * Resposta de GET /auth/usuarios/:usuarioId/sessoes (D-2.3D-22).
 *
 * Usuário inexistente, sem sessões ou somente com sessões encerradas/vencidas
 * produz `{ "sessoes": [] }` — o mesmo envelope, sem oráculo de contas.
 */
export class ListarSessoesUsuarioRespostaDto {
  @ApiProperty({
    description: "Sessões ATIVAS e temporalmente válidas do usuário, da mais antiga para a mais recente.",
    type: [SessaoAtivaUsuarioDto],
  })
  readonly sessoes!: SessaoAtivaUsuarioDto[];
}
