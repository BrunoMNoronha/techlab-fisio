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
//
// Listagem administrativa das sessões ativas de um usuário (D-2.3D-22,
// docs/12 §5.22), para localizar o `sessaoId` alvo da revogação:
//   - GET /auth/usuarios/:usuarioId/sessoes
//   - @RequerPermissao("sessoes.revogar_terceiro") — nenhuma permissão nova;
//   - método seguro: sem ProtecaoCsrfGuard (mesmo racional de D-2.3D-20);
//   - 200 { sessoes: [...] } com Cache-Control: no-store; usuário inexistente
//     devolve lista vazia; nenhum evento de auditoria.
//
// O prefixo do controller é `auth` para que as duas rotas convivam no mesmo
// controller do SessoesModule; a CSRF é aplicada por handler, apenas na mutação.

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
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
import {
  ErroSessaoAdministrativaDto,
  ListarSessoesUsuarioRespostaDto,
  ehUuidValido,
} from "./sessoes.dto.js";
import { SessoesService } from "./sessoes.service.js";

@ApiTags("Autenticação")
@Controller("auth")
export class SessoesController {
  constructor(private readonly sessoes: SessoesService) {}

  @Get("usuarios/:usuarioId/sessoes")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("sessoes.revogar_terceiro")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista as sessões ativas de um usuário (AUT-002, D-2.3D-22).",
    description:
      "Consulta administrativa para localizar o sessaoId alvo da revogação. Exige a permissão " +
      "sessoes.revogar_terceiro. Retorna somente sessões ATIVAS e ainda válidas pela política " +
      "temporal, sem token ou hash. Usuário inexistente ou sem sessões ativas retorna lista vazia. " +
      "Método seguro de leitura sem CSRF guard. Não emite evento de auditoria.",
  })
  @ApiParam({
    name: "usuarioId",
    description: "Identificador UUID do usuário cujas sessões ativas serão listadas.",
    format: "uuid",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Lista (possivelmente vazia) das sessões ativas do usuário.",
    type: ListarSessoesUsuarioRespostaDto,
  })
  @ApiResponse({
    status: 400,
    description: "Identificador de usuário estruturalmente inválido (não é UUID).",
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
      "Operador não possui a permissão administrativa necessária (sessoes.revogar_terceiro).",
    type: ErroSessaoAdministrativaDto,
  })
  @ApiResponse({
    status: 500,
    description: "Falha técnica inesperada na persistência ou infraestrutura.",
    type: ErroSessaoAdministrativaDto,
  })
  async listarSessoesDoUsuario(
    @Param("usuarioId") usuarioId: string,
  ): Promise<ListarSessoesUsuarioRespostaDto> {
    if (!ehUuidValido(usuarioId)) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    const sessoes = await this.sessoes.listarSessoesAtivasDoUsuario(usuarioId);
    return {
      sessoes: sessoes.map((sessao) => ({
        sessaoId: sessao.sessaoId,
        criadaEm: sessao.criadaEm.toISOString(),
        ultimaAtividadeEm: sessao.ultimaAtividadeEm.toISOString(),
        expiraEm: sessao.expiraEm.toISOString(),
      })),
    };
  }

  @Delete("sessoes/:sessaoId")
  @ApiHeader({
    name: CABECALHO_REQUISICAO_TLF,
    required: true,
    description:
      "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer " +
      "valor não vazio.",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequerPermissao("sessoes.revogar_terceiro")
  // Declarado ABAIXO de @RequerPermissao de propósito: decorators aplicam de
  // baixo para cima e o Nest concatena guards na ordem de aplicação, de modo
  // que a CSRF continua avaliada ANTES da sessão e da permissão, como quando
  // era guard de classe.
  @UseGuards(ProtecaoCsrfGuard)
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
