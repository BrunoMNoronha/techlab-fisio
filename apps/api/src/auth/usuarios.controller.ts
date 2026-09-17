// TechLab Fisio — fronteira HTTP de gestão de situação de usuários (AUT-005 / D-2.3D-21).
//
// Materializa D-2.3D-21:
//   - PATCH /auth/usuarios/:usuarioId/situacao
//   - @RequerPermissao("usuarios.gerenciar")
//   - ProtecaoCsrfGuard
//   - Ator derivado exclusivamente do contexto autenticado (@UsuarioAutenticado)
//   - 422 AUTO_INATIVACAO_PROIBIDA para auto-inativação do administrador
//   - 404 USUARIO_INEXISTENTE para usuário inexistente
//   - 200 OK com { usuarioId, ativo, inativadoEm } para sucesso e idempotência

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  UnprocessableEntityException,
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

import { ERRO } from "./auth.dto.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "./protecao-csrf.guard.js";
import {
  UsuarioAutenticado,
  type ContextoAutenticado,
} from "../authz/contexto-autenticado.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  AlterarSituacaoUsuarioRequisicaoDto,
  AlterarSituacaoUsuarioRespostaDto,
  ErroSituacaoUsuarioDto,
  ERRO_USUARIOS,
  ehUuidValido,
  validarCorpoAlterarSituacao,
} from "./usuarios.dto.js";
import {
  ErroSituacaoUsuario,
  UsuariosService,
} from "./usuarios.service.js";

@ApiTags("Autenticação")
@ApiHeader({
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description:
    "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
})
@Controller("auth/usuarios")
@UseGuards(ProtecaoCsrfGuard)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Patch(":usuarioId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("usuarios.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Ativa ou inativa um usuário do sistema (AUT-005, D-2.3D-21).",
    description:
      "Operação administrativa de gestão de contas. Exige a permissão usuarios.gerenciar. " +
      "Na inativação, revoga atomicamente todas as sessões ativas do usuário e impede novos logins. " +
      "Auto-inativação pelo próprio administrador é estritamente proibida (422 AUTO_INATIVACAO_PROIBIDA). " +
      "A reativação limpa os metadados de inativação sem criar sessões. " +
      "Operações no-op que solicitem o estado já vigente retornam 200 OK de forma idempotente sem mutação.",
  })
  @ApiParam({
    name: "usuarioId",
    description: "Identificador UUID do usuário-alvo.",
    format: "uuid",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Situação do usuário atualizada com sucesso ou confirmada de forma idempotente.",
    type: AlterarSituacaoUsuarioRespostaDto,
  })
  @ApiResponse({
    status: 400,
    description: "Identificador de usuário ou payload estruturalmente inválidos.",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 401,
    description: "Sessão do operador ausente ou inválida.",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 403,
    description:
      "Operador não possui a permissão administrativa necessária (usuarios.gerenciar) " +
      "ou a requisição falhou na validação de segurança CSRF.",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 404,
    description: "Usuário-alvo não encontrado no sistema.",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 413,
    description: "Corpo de requisição acima do limite permitido.",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 422,
    description: "Auto-inativação pelo próprio administrador é proibida (AUTO_INATIVACAO_PROIBIDA).",
    type: ErroSituacaoUsuarioDto,
  })
  @ApiResponse({
    status: 500,
    description: "Falha técnica inesperada.",
    type: ErroSituacaoUsuarioDto,
  })
  async alterarSituacao(
    @Param("usuarioId") usuarioId: string,
    @Body() corpo: AlterarSituacaoUsuarioRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AlterarSituacaoUsuarioRespostaDto> {
    if (!ehUuidValido(usuarioId)) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    const validacao = validarCorpoAlterarSituacao(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    try {
      const resultado = await this.usuarios.alterarSituacao({
        usuarioId,
        atorUsuarioId: contexto.usuarioId,
        ativo: validacao.valor.ativo,
      });

      return {
        usuarioId: resultado.usuarioId,
        ativo: resultado.ativo,
        inativadoEm: resultado.inativadoEm ? resultado.inativadoEm.toISOString() : null,
      };
    } catch (erro) {
      if (erro instanceof ErroSituacaoUsuario) {
        if (erro.motivo === "USUARIO_INEXISTENTE") {
          throw new NotFoundException({ erro: ERRO_USUARIOS.USUARIO_INEXISTENTE });
        }
        if (erro.motivo === "AUTO_INATIVACAO_PROIBIDA") {
          throw new UnprocessableEntityException({
            erro: ERRO_USUARIOS.AUTO_INATIVACAO_PROIBIDA,
          });
        }
      }
      throw erro;
    }
  }
}
