// TechLab Fisio — fronteira HTTP da recuperação de senha (Etapa 2.3D-B / F6).
//
// Duas operações, e só elas — exatamente o que `docs/12` §9 atribui à F6
// ("início e conclusão + rate limiting próprio"):
//
//   POST /auth/recuperacao-senha ............ INÍCIO, pelo Administrador
//        `@RequerPermissao("senha.recuperar_terceiro")` (`docs/04` §4: "Iniciar
//        recuperação de senha de terceiro" — ✓ só para Administrador) sobre a
//        sessão de `D-2.3D-07`; responde o segredo UMA vez (AUT-004, passo 3);
//   POST /auth/recuperacao-senha/concluir ... CONCLUSÃO, pelo usuário, SEM
//        sessão (`docs/04` §4: "Recuperar própria senha via fluxo autorizado" —
//        ✓ para todos os papéis); limitada por IP (`D-2.3D-06`).
//
// DECISÕES LOCAIS DE IMPLEMENTAÇÃO — rotuladas como tais, reversíveis, no
// mesmo precedente de `L-01`..`L-04` da F3 (nenhuma fonte fixa rota, status
// ou formato):
//   L-F6-01  rotas acima, sob o prefixo `/auth` de M1 — Identity & Access;
//   L-F6-02  `201` com `{ segredo, expiraEm }` no início (um recurso foi
//            criado); `204` sem corpo na conclusão — nada a devolver, e
//            nenhuma sessão nasce (`D-2.3D-08`);
//   L-F6-04  `422 ALVO_NAO_ELEGIVEL` para alvo inexistente/inativo/próprio
//            (requisição bem-formada, semanticamente recusada — distinto de
//            `400` payload e de `403` autorização); `401
//            RECUPERACAO_INVALIDA` uniforme na conclusão (o segredo é uma
//            credencial; falha de credencial é `401`, como no login).
//
// A baseline CSRF de `D-2.3D-07` aplica-se às DUAS mutações. A ordem das
// guards é a do Nest: a de classe (CSRF) precede as de método
// (sessão -> permissão) instaladas por `@RequerPermissao`.
//
// O QUE ESTA FRONTEIRA NÃO FAZ: não emite sessão nem cookie na conclusão; não
// devolve `usuarioId`, id de segredo, hash ou senha; não distingue os motivos
// internos de recusa; não recebe identificador na conclusão; não envia
// e-mail/SMS/WhatsApp; não oferece auto-solicitação (D-04: início é do
// Administrador); não expõe ativação/inativação de usuário (AUT-005 segue
// fora).

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { extrairIp } from "../auth/auth.controller.js";
import type { RequisicaoAutenticacao } from "../auth/auth.controller.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { UsuarioAutenticado } from "../authz/contexto-autenticado.js";
import type { ContextoAutenticado } from "../authz/contexto-autenticado.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  ConcluirRecuperacaoRequisicaoDto,
  ERRO_RECUPERACAO,
  ErroRecuperacaoSenhaDto,
  IniciarRecuperacaoRequisicaoDto,
  IniciarRecuperacaoRespostaDto,
  validarCorpoConcluirRecuperacao,
  validarCorpoIniciarRecuperacao,
} from "./recuperacao-senha.dto.js";
import { RecuperacaoSenhaService } from "./recuperacao-senha.service.js";

/** Forma mínima da resposta: apenas a escrita de cabeçalhos. */
interface RespostaComCabecalhos {
  setHeader(nome: string, valor: string): unknown;
}

@ApiTags("Autenticação")
@ApiHeader({
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description:
    "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer " +
    "valor não vazio.",
})
@Controller("auth/recuperacao-senha")
@UseGuards(ProtecaoCsrfGuard)
export class RecuperacaoSenhaController {
  constructor(private readonly recuperacao: RecuperacaoSenhaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequerPermissao("senha.recuperar_terceiro")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Inicia a recuperação de senha de um terceiro (AUT-004, D-04).",
    description:
      "Exige sessão válida e a permissão senha.recuperar_terceiro. Gera um " +
      "segredo de uso único de 256 bits com validade de 30 minutos " +
      "(D-2.3D-08), invalida qualquer segredo pendente anterior do mesmo " +
      "usuário e o apresenta UMA ÚNICA VEZ nesta resposta, para entrega por " +
      "canal externo à aplicação. O segredo não é persistido em claro, não é " +
      "registrado e não é recuperável depois. Nenhuma sessão do alvo é " +
      "afetada neste passo. Auditado como usuario.senha.recuperacao_iniciada.",
  })
  @ApiBody({ type: IniciarRecuperacaoRequisicaoDto })
  @ApiResponse({
    status: 201,
    description: "Segredo emitido. Apresentado somente aqui.",
    type: IniciarRecuperacaoRespostaDto,
  })
  @ApiResponse({
    status: 400,
    description: "Payload malformado.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 401,
    description: "Sessão ausente, malformada, inexistente, expirada ou revogada.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 403,
    description:
      "Baseline CSRF de D-2.3D-07 recusou a requisição (REQUISICAO_NAO_AUTORIZADA) " +
      "ou o usuário autenticado não possui senha.recuperar_terceiro (ACESSO_NEGADO).",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 413,
    description: "Corpo acima do limite do parser.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 422,
    description:
      "Alvo não elegível — resposta idêntica para usuário inexistente, " +
      "usuário inativo e tentativa de iniciar a própria recuperação.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 500,
    description: "Falha TÉCNICA inesperada. Nenhum detalhe interno é devolvido.",
    type: ErroRecuperacaoSenhaDto,
  })
  async iniciar(
    @Body() corpo: unknown,
    @UsuarioAutenticado() ator: ContextoAutenticado,
  ): Promise<IniciarRecuperacaoRespostaDto> {
    const validacao = validarCorpoIniciarRecuperacao(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    const resultado = await this.recuperacao.iniciar({
      identificador: validacao.valor.identificador,
      // O ator é a identidade validada pela guard de sessão — nunca do corpo.
      atorUsuarioId: ator.usuarioId,
    });
    if (resultado.desfecho === "ALVO_NAO_ELEGIVEL") {
      throw new UnprocessableEntityException({ erro: ERRO_RECUPERACAO.ALVO_NAO_ELEGIVEL });
    }
    return {
      segredo: resultado.segredo,
      expiraEm: resultado.expiraEm.toISOString(),
    };
  }

  @Post("concluir")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Conclui a recuperação: apresenta o segredo e define a nova senha (AUT-004, RN-005).",
    description:
      "Sem sessão. O segredo é de uso único: é consumido atomicamente com a " +
      "troca da senha e a revogação de TODAS as sessões ativas do usuário " +
      "(T-07). Nenhuma sessão nova é criada (D-2.3D-08). A resposta de recusa " +
      "é uniforme para segredo malformado, inexistente, expirado, já " +
      "utilizado e usuário inativo. Limitada a 10 tentativas / 15 min por IP " +
      "(D-2.3D-06). Auditado como usuario.senha.recuperacao_concluida.",
  })
  @ApiBody({ type: ConcluirRecuperacaoRequisicaoDto })
  @ApiResponse({
    status: 204,
    description: "Senha redefinida; segredo consumido; sessões anteriores revogadas. Sem corpo, sem cookie.",
  })
  @ApiResponse({
    status: 400,
    description: "Payload malformado. Não conta como tentativa.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 401,
    description:
      "Recuperação inválida — resposta idêntica para segredo malformado, " +
      "inexistente, expirado, já utilizado e usuário inativo.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 403,
    description: "Baseline CSRF de D-2.3D-07 recusou a requisição.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 413,
    description: "Corpo acima do limite do parser.",
    type: ErroRecuperacaoSenhaDto,
  })
  @ApiResponse({
    status: 429,
    description:
      "Rate limit de D-2.3D-06 (10 tentativas / 15 min por IP). Acompanha Retry-After.",
    type: ErroRecuperacaoSenhaDto,
    headers: {
      "Retry-After": {
        description: "Segundos até a janela liberar.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Falha TÉCNICA inesperada. Nenhum detalhe interno é devolvido.",
    type: ErroRecuperacaoSenhaDto,
  })
  async concluir(
    @Body() corpo: unknown,
    @Req() requisicao: RequisicaoAutenticacao,
    @Res({ passthrough: true }) resposta: RespostaComCabecalhos,
  ): Promise<void> {
    // Payload rejeitado aqui NÃO é tentativa: não conta no limitador.
    const validacao = validarCorpoConcluirRecuperacao(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    const resultado = await this.recuperacao.concluir({
      segredo: validacao.valor.segredo,
      novaSenha: validacao.valor.novaSenha,
      ip: extrairIp(requisicao),
    });
    if (resultado.desfecho === "BLOQUEADO") {
      resposta.setHeader("Retry-After", String(resultado.retryAfterSegundos));
      throw new HttpException(
        { erro: ERRO.TENTATIVAS_EXCEDIDAS },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (resultado.desfecho === "RECUPERACAO_INVALIDA") {
      throw new UnauthorizedException({ erro: ERRO_RECUPERACAO.RECUPERACAO_INVALIDA });
    }
    // 204: nenhum corpo, nenhum cookie — a conclusão não autentica.
  }
}
