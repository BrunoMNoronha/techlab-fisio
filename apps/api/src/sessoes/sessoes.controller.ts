// TechLab Fisio — fronteira HTTP da revogação administrativa de sessões (P-2.3D-07 / AUT-002).
//
// Operação administrativa de segurança sobre uma sessão individual pertencente
// a outro usuário. Materializa D-2.3D-19 (docs/12 §5.19) e os critérios de
// aceite A-01..A-22 (docs/12 §10.4):
//   - DELETE /auth/sessoes/:sessaoId
//   - @RequerPermissao("sessoes.revogar_terceiro")
//   - Ator derivado exclusivamente da sessão autenticada (ContextoAutenticado);
//   - Resposta uniforme: 204 No Content sem corpo;
//   - 400 REQUISICAO_INVALIDA para UUID estruturalmente inválido;
//   - Proteção CSRF obrigatória (ProtecaoCsrfGuard).

import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { UsuarioAutenticado } from "../authz/contexto-autenticado.js";
import type { ContextoAutenticado } from "../authz/contexto-autenticado.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import { ErroSessaoAdministrativaDto, ehUuidValido } from "./sessoes.dto.js";
import { SessoesService } from "./sessoes.service.js";

@ApiTags("Autenticação")
@ApiHeader({
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description:
    "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer " +
    "valor não vazio.",
})
@Controller("auth/sessoes")
@UseGuards(ProtecaoCsrfGuard)
export class SessoesController {
  constructor(private readonly sessoes: SessoesService) {}

  @Delete(":sessaoId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequerPermissao("sessoes.revogar_terceiro")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary:
      "Revoga administrativamente uma sessão ativa de outro usuário (AUT-002, D-2.3D-19).",
    description:
      "Operação administrativa de segurança sobre uma sessão individual. Exige a permissão " +
      "sessoes.revogar_terceiro. O ator é derivado exclusivamente do contexto autenticado. " +
      "Retorna envelope uniforme 204 No Content para revogação efetiva, sessão inexistente, " +
      "sessão já revogada, sessão já expirada ou tentativa de autorrevogação recusada.",
  })
  @ApiParam({
    name: "sessaoId",
    description: "Identificador UUID da sessão-alvo a revogar.",
    format: "uuid",
    required: true,
  })
  @ApiResponse({
    status: 204,
    description:
      "Operação aceita com envelope anti-oráculo uniforme. Sem corpo.",
  })
  @ApiResponse({
    status: 400,
    description: "Identificador de sessão estruturalmente inválido (não é UUID).",
    type: ErroSessaoAdministrativaDto,
  })
  @ApiResponse({
    status: 401,
    description: "Sessão do operador ausente ou inválida.",
    type: ErroSessaoAdministrativaDto,
  })
  @ApiResponse({
    status: 403,
    description:
      "Operador não possui a permissão administrativa necessária (sessoes.revogar_terceiro) " +
      "ou a requisição falhou na validação de segurança CSRF.",
    type: ErroSessaoAdministrativaDto,
  })
  @ApiResponse({
    status: 413,
    description: "Corpo de requisição acima do limite permitido.",
    type: ErroSessaoAdministrativaDto,
  })
  @ApiResponse({
    status: 500,
    description: "Falha técnica inesperada na persistência ou infraestrutura.",
    type: ErroSessaoAdministrativaDto,
  })
  async revogarSessao(
    @Param("sessaoId") sessaoId: string,
    @UsuarioAutenticado() ator: ContextoAutenticado,
  ): Promise<void> {
    if (!ehUuidValido(sessaoId)) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    await this.sessoes.revogarSessaoDeTerceiro({
      sessaoId,
      atorUsuarioId: ator.usuarioId,
    });
  }
}
