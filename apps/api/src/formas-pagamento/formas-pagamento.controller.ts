// TechLab Fisio — fronteira HTTP das formas de pagamento (CFG-004; `docs/14` §3.12).
//
//   - GET   /formas-pagamento[?ativo=]                    — lista sem paginação, ordem canônica;
//   - GET   /formas-pagamento/:formaPagamentoId           — consulta individual;
//   - POST  /formas-pagamento                             — criação, sempre ativa;
//   - PUT   /formas-pagamento/:formaPagamentoId           — substituição da descrição;
//   - PATCH /formas-pagamento/:formaPagamentoId/situacao  — inativação/reativação idempotente.
//
// Todas exigem `clinica.configurar` (D-CFG-43). GETs são métodos seguros, sem
// CSRF e com Cache-Control: no-store; as mutações usam ProtecaoCsrfGuard
// declarada ABAIXO de @RequerPermissao (a CSRF roda antes da sessão, mesma
// ordem de `ServicosController`). Ator só da sessão. Não existe DELETE
// (D-CFG-36). Erros normalizados para `{ erro }` por `FiltroErroFormasPagamento`.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { ehUuidValido } from "../auth/usuarios.dto.js";
import {
  UsuarioAutenticado,
  type ContextoAutenticado,
} from "../authz/contexto-autenticado.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import { FiltroErroFormasPagamento } from "./erro-formas-pagamento.filter.js";
import {
  ErroFormaPagamentoDto,
  ERRO_FORMA_PAGAMENTO,
  FormaPagamentoRequisicaoDto,
  FormaPagamentoRespostaDto,
  SituacaoFormaPagamentoRequisicaoDto,
  validarCorpoFormaPagamento,
  validarCorpoSituacaoFormaPagamento,
  validarFiltroFormasPagamento,
} from "./formas-pagamento.dto.js";
import {
  ErroFormaPagamento,
  FormasPagamentoService,
  type DadosFormaPagamento,
} from "./formas-pagamento.service.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_FORMA_PAGAMENTO_ID = {
  name: "formaPagamentoId",
  description: "Identificador UUID da forma de pagamento.",
  format: "uuid",
  required: true,
} as const;

function paraResposta(forma: DadosFormaPagamento): FormaPagamentoRespostaDto {
  return {
    id: forma.id,
    descricao: forma.descricao,
    ativo: forma.ativo,
    inativadoEm: forma.inativadoEm ? forma.inativadoEm.toISOString() : null,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroFormaPagamento) {
    switch (erro.motivo) {
      case "CLINICA_NAO_CONFIGURADA":
        throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
      case "FORMA_PAGAMENTO_NAO_ENCONTRADA":
        throw new NotFoundException({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_NAO_ENCONTRADA });
      case "FORMA_PAGAMENTO_DUPLICADA":
        throw new ConflictException({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_DUPLICADA });
      case "FORMA_PAGAMENTO_EM_USO":
        throw new ConflictException({ erro: ERRO_FORMA_PAGAMENTO.FORMA_PAGAMENTO_EM_USO });
    }
  }
  throw erro;
}

function exigirFormaPagamentoId(formaPagamentoId: string): void {
  if (!ehUuidValido(formaPagamentoId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Configuração da Clínica")
@Controller("formas-pagamento")
@UseFilters(FiltroErroFormasPagamento)
export class FormasPagamentoController {
  constructor(private readonly formas: FormasPagamentoService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista as formas de pagamento (CFG-004).",
    description:
      "Exige clinica.configurar. Sem paginação; ativas e inativas, na ordem ativo DESC, descrição sem caixa, id. " +
      "Filtro opcional ativo=true|false; qualquer outro parâmetro é rejeitado. Sem CSRF e sem auditoria.",
  })
  @ApiQuery({ name: "ativo", required: false, enum: ["true", "false"], description: "Filtra pela situação." })
  @ApiResponse({ status: 200, description: "Formas de pagamento na ordem canônica.", type: FormaPagamentoRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Parâmetro de consulta inválido.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroFormaPagamentoDto })
  async listar(@Query() query: unknown): Promise<FormaPagamentoRespostaDto[]> {
    const filtro = validarFiltroFormasPagamento(query);
    if (!filtro.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    return (await this.formas.listar(filtro.valor)).map(paraResposta);
  }

  @Get(":formaPagamentoId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta uma forma de pagamento (CFG-004).",
    description: "Exige clinica.configurar. Sem CSRF e sem auditoria.",
  })
  @ApiParam(PARAMETRO_FORMA_PAGAMENTO_ID)
  @ApiResponse({ status: 200, description: "Forma de pagamento.", type: FormaPagamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 404, description: "Forma inexistente (FORMA_PAGAMENTO_NAO_ENCONTRADA).", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroFormaPagamentoDto })
  async consultar(@Param("formaPagamentoId") formaPagamentoId: string): Promise<FormaPagamentoRespostaDto> {
    exigirFormaPagamentoId(formaPagamentoId);
    try {
      return paraResposta(await this.formas.consultar(formaPagamentoId));
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Cria uma forma de pagamento, sempre ativa (CFG-004).",
    description:
      "Exige clinica.configurar. Corpo estrito com exatamente descricao. " +
      "Emite configuracao.alterada na mesma transação.",
  })
  @ApiResponse({ status: 201, description: "Forma de pagamento criada.", type: FormaPagamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 409, description: "Descrição equivalente a forma existente, ativa ou inativa (FORMA_PAGAMENTO_DUPLICADA).", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroFormaPagamentoDto })
  async criar(
    @Body() corpo: FormaPagamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<FormaPagamentoRespostaDto> {
    const validacao = validarCorpoFormaPagamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.formas.criar({ atorUsuarioId: contexto.usuarioId, dados: validacao.valor }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":formaPagamentoId")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Atualiza a descrição de uma forma de pagamento (CFG-004).",
    description:
      "Exige clinica.configurar. Substituição total da descrição; não altera a situação e é permitida em forma inativa. " +
      "Forma já referenciada por pagamento não pode ser renomeada (FORMA_PAGAMENTO_EM_USO). " +
      "Alteração efetiva emite configuracao.alterada; sem alteração retorna 200 sem auditoria.",
  })
  @ApiParam(PARAMETRO_FORMA_PAGAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: FormaPagamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 404, description: "Forma inexistente (FORMA_PAGAMENTO_NAO_ENCONTRADA).", type: ErroFormaPagamentoDto })
  @ApiResponse({
    status: 409,
    description:
      "Descrição equivalente a outra forma (FORMA_PAGAMENTO_DUPLICADA) ou forma já referenciada por pagamento (FORMA_PAGAMENTO_EM_USO).",
    type: ErroFormaPagamentoDto,
  })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroFormaPagamentoDto })
  async atualizar(
    @Param("formaPagamentoId") formaPagamentoId: string,
    @Body() corpo: FormaPagamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<FormaPagamentoRespostaDto> {
    exigirFormaPagamentoId(formaPagamentoId);
    const validacao = validarCorpoFormaPagamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.formas.atualizar({
        atorUsuarioId: contexto.usuarioId,
        formaPagamentoId,
        dados: validacao.valor,
      });
      return paraResposta(resultado.formaPagamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Patch(":formaPagamentoId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Inativa ou reativa uma forma de pagamento (CFG-004).",
    description:
      "Exige clinica.configurar. Corpo exato { ativo }. Permitido com ou sem pagamentos referenciando a forma. " +
      "Mudança efetiva emite configuracao.alterada; pedido do estado já vigente retorna 200 sem mutação e sem auditoria. " +
      "Pagamentos nunca são alterados.",
  })
  @ApiParam(PARAMETRO_FORMA_PAGAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: FormaPagamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 404, description: "Forma inexistente (FORMA_PAGAMENTO_NAO_ENCONTRADA).", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroFormaPagamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroFormaPagamentoDto })
  async alterarSituacao(
    @Param("formaPagamentoId") formaPagamentoId: string,
    @Body() corpo: SituacaoFormaPagamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<FormaPagamentoRespostaDto> {
    exigirFormaPagamentoId(formaPagamentoId);
    const validacao = validarCorpoSituacaoFormaPagamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.formas.alterarSituacao({
        atorUsuarioId: contexto.usuarioId,
        formaPagamentoId,
        ativo: validacao.valor.ativo,
      });
      return paraResposta(resultado.formaPagamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
