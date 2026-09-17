// TechLab Fisio — fronteira HTTP do catálogo de serviços (CFG-003; `docs/14` §3.11).
//
//   - GET   /servicos[?ativo=]            — lista sem paginação, ordem canônica;
//   - GET   /servicos/:servicoId          — consulta individual;
//   - POST  /servicos                     — criação, sempre ativa;
//   - PUT   /servicos/:servicoId          — substituição de nome/duração/preço;
//   - PATCH /servicos/:servicoId/situacao — inativação/reativação idempotente.
//
// Todas exigem `clinica.configurar` (D-CFG-30). GETs são métodos seguros, sem
// CSRF e com Cache-Control: no-store; as mutações usam ProtecaoCsrfGuard
// declarada ABAIXO de @RequerPermissao (a CSRF roda antes da sessão, mesma
// ordem de `ClinicaController`). Ator só da sessão. Não existe DELETE
// (D-CFG-24). Erros normalizados para `{ erro }` por `FiltroErroServicos`.

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
import { FiltroErroServicos } from "./erro-servicos.filter.js";
import {
  ErroServicoDto,
  ERRO_SERVICO,
  ServicoRequisicaoDto,
  ServicoRespostaDto,
  SituacaoServicoRequisicaoDto,
  validarCorpoServico,
  validarCorpoSituacaoServico,
  validarFiltroServicos,
} from "./servicos.dto.js";
import { ErroServico, ServicosService, type DadosServico } from "./servicos.service.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_SERVICO_ID = {
  name: "servicoId",
  description: "Identificador UUID do serviço.",
  format: "uuid",
  required: true,
} as const;

function paraResposta(servico: DadosServico): ServicoRespostaDto {
  return {
    id: servico.id,
    nome: servico.nome,
    duracaoMin: servico.duracaoMin,
    precoReferencia: servico.precoReferencia,
    ativo: servico.ativo,
    inativadoEm: servico.inativadoEm ? servico.inativadoEm.toISOString() : null,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroServico) {
    switch (erro.motivo) {
      case "CLINICA_NAO_CONFIGURADA":
        throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
      case "SERVICO_NAO_ENCONTRADO":
        throw new NotFoundException({ erro: ERRO_SERVICO.SERVICO_NAO_ENCONTRADO });
      case "SERVICO_DUPLICADO":
        throw new ConflictException({ erro: ERRO_SERVICO.SERVICO_DUPLICADO });
    }
  }
  throw erro;
}

function exigirServicoId(servicoId: string): void {
  if (!ehUuidValido(servicoId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Configuração da Clínica")
@Controller("servicos")
@UseFilters(FiltroErroServicos)
export class ServicosController {
  constructor(private readonly servicos: ServicosService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista o catálogo de serviços (CFG-003).",
    description:
      "Exige clinica.configurar. Sem paginação; ativos e inativos, na ordem ativo DESC, nome sem caixa, id. " +
      "Filtro opcional ativo=true|false; qualquer outro parâmetro é rejeitado. Sem CSRF e sem auditoria.",
  })
  @ApiQuery({ name: "ativo", required: false, enum: ["true", "false"], description: "Filtra pela situação." })
  @ApiResponse({ status: 200, description: "Serviços na ordem canônica.", type: ServicoRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Parâmetro de consulta inválido.", type: ErroServicoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroServicoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroServicoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroServicoDto })
  async listar(@Query() query: unknown): Promise<ServicoRespostaDto[]> {
    const filtro = validarFiltroServicos(query);
    if (!filtro.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    return (await this.servicos.listar(filtro.valor)).map(paraResposta);
  }

  @Get(":servicoId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({ summary: "Consulta um serviço do catálogo (CFG-003).", description: "Exige clinica.configurar. Sem CSRF e sem auditoria." })
  @ApiParam(PARAMETRO_SERVICO_ID)
  @ApiResponse({ status: 200, description: "Serviço.", type: ServicoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroServicoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroServicoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroServicoDto })
  @ApiResponse({ status: 404, description: "Serviço inexistente (SERVICO_NAO_ENCONTRADO).", type: ErroServicoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroServicoDto })
  async consultar(@Param("servicoId") servicoId: string): Promise<ServicoRespostaDto> {
    exigirServicoId(servicoId);
    try {
      return paraResposta(await this.servicos.consultar(servicoId));
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
    summary: "Cria um serviço no catálogo, sempre ativo (CFG-003).",
    description:
      "Exige clinica.configurar. Corpo estrito com exatamente nome, duracaoMin e precoReferencia. " +
      "Emite configuracao.alterada na mesma transação.",
  })
  @ApiResponse({ status: 201, description: "Serviço criado.", type: ServicoRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroServicoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroServicoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroServicoDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroServicoDto })
  @ApiResponse({ status: 409, description: "Nome equivalente a serviço existente, ativo ou inativo (SERVICO_DUPLICADO).", type: ErroServicoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroServicoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroServicoDto })
  async criar(
    @Body() corpo: ServicoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<ServicoRespostaDto> {
    const validacao = validarCorpoServico(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.servicos.criar({ atorUsuarioId: contexto.usuarioId, dados: validacao.valor }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":servicoId")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Atualiza nome, duração e preço de um serviço (CFG-003).",
    description:
      "Exige clinica.configurar. Substituição total de nome, duracaoMin e precoReferencia; não altera a situação " +
      "e é permitida em serviço inativo. Alteração efetiva emite configuracao.alterada; sem alteração retorna 200 sem auditoria.",
  })
  @ApiParam(PARAMETRO_SERVICO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: ServicoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroServicoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroServicoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroServicoDto })
  @ApiResponse({ status: 404, description: "Serviço inexistente (SERVICO_NAO_ENCONTRADO).", type: ErroServicoDto })
  @ApiResponse({ status: 409, description: "Nome equivalente a outro serviço, ativo ou inativo (SERVICO_DUPLICADO).", type: ErroServicoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroServicoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroServicoDto })
  async atualizar(
    @Param("servicoId") servicoId: string,
    @Body() corpo: ServicoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<ServicoRespostaDto> {
    exigirServicoId(servicoId);
    const validacao = validarCorpoServico(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.servicos.atualizar({
        atorUsuarioId: contexto.usuarioId,
        servicoId,
        dados: validacao.valor,
      });
      return paraResposta(resultado.servico);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Patch(":servicoId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Inativa ou reativa um serviço (CFG-003).",
    description:
      "Exige clinica.configurar. Corpo exato { ativo }. Mudança efetiva emite configuracao.alterada; " +
      "pedido do estado já vigente retorna 200 sem mutação e sem auditoria. Referências históricas nunca são alteradas.",
  })
  @ApiParam(PARAMETRO_SERVICO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: ServicoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroServicoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroServicoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroServicoDto })
  @ApiResponse({ status: 404, description: "Serviço inexistente (SERVICO_NAO_ENCONTRADO).", type: ErroServicoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroServicoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroServicoDto })
  async alterarSituacao(
    @Param("servicoId") servicoId: string,
    @Body() corpo: SituacaoServicoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<ServicoRespostaDto> {
    exigirServicoId(servicoId);
    const validacao = validarCorpoSituacaoServico(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.servicos.alterarSituacao({
        atorUsuarioId: contexto.usuarioId,
        servicoId,
        ativo: validacao.valor.ativo,
      });
      return paraResposta(resultado.servico);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
