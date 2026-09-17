// TechLab Fisio — fronteira HTTP dos motivos de cancelamento (CFG-005; `docs/14` §3.13).
//
//   - GET   /motivos-cancelamento[?ativo=]                        — lista sem paginação, ordem canônica;
//   - GET   /motivos-cancelamento/:motivoCancelamentoId          — consulta individual;
//   - POST  /motivos-cancelamento                                 — criação, sempre ativa;
//   - PUT   /motivos-cancelamento/:motivoCancelamentoId          — substituição da descrição;
//   - PATCH /motivos-cancelamento/:motivoCancelamentoId/situacao — inativação/reativação idempotente.
//
// Todas exigem `clinica.configurar` (D-CFG-55). GETs são métodos seguros, sem
// CSRF e com Cache-Control: no-store; as mutações usam ProtecaoCsrfGuard
// declarada ABAIXO de @RequerPermissao (a CSRF roda antes da sessão, mesma
// ordem de `ServicosController`). Ator só da sessão. Não existe DELETE
// (D-CFG-48, D-CFG-54). Erros normalizados para `{ erro }` por
// `FiltroErroMotivosCancelamento`.

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
import { FiltroErroMotivosCancelamento } from "./erro-motivos-cancelamento.filter.js";
import {
  ErroMotivoCancelamentoDto,
  ERRO_MOTIVO_CANCELAMENTO,
  MotivoCancelamentoRequisicaoDto,
  MotivoCancelamentoRespostaDto,
  SituacaoMotivoCancelamentoRequisicaoDto,
  validarCorpoMotivoCancelamento,
  validarCorpoSituacaoMotivoCancelamento,
  validarFiltroMotivosCancelamento,
} from "./motivos-cancelamento.dto.js";
import {
  ErroMotivoCancelamento,
  MotivosCancelamentoService,
  type DadosMotivoCancelamento,
} from "./motivos-cancelamento.service.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_MOTIVO_CANCELAMENTO_ID = {
  name: "motivoCancelamentoId",
  description: "Identificador UUID do motivo de cancelamento.",
  format: "uuid",
  required: true,
} as const;

function paraResposta(motivo: DadosMotivoCancelamento): MotivoCancelamentoRespostaDto {
  return {
    id: motivo.id,
    descricao: motivo.descricao,
    ativo: motivo.ativo,
    inativadoEm: motivo.inativadoEm ? motivo.inativadoEm.toISOString() : null,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroMotivoCancelamento) {
    switch (erro.motivo) {
      case "CLINICA_NAO_CONFIGURADA":
        throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
      case "MOTIVO_CANCELAMENTO_NAO_ENCONTRADO":
        throw new NotFoundException({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_NAO_ENCONTRADO });
      case "MOTIVO_CANCELAMENTO_DUPLICADO":
        throw new ConflictException({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_DUPLICADO });
      case "MOTIVO_CANCELAMENTO_EM_USO":
        throw new ConflictException({ erro: ERRO_MOTIVO_CANCELAMENTO.MOTIVO_CANCELAMENTO_EM_USO });
    }
  }
  throw erro;
}

function exigirMotivoCancelamentoId(motivoCancelamentoId: string): void {
  if (!ehUuidValido(motivoCancelamentoId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Configuração da Clínica")
@Controller("motivos-cancelamento")
@UseFilters(FiltroErroMotivosCancelamento)
export class MotivosCancelamentoController {
  constructor(private readonly motivos: MotivosCancelamentoService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista os motivos de cancelamento (CFG-005).",
    description:
      "Exige clinica.configurar. Sem paginação; ativos e inativos, na ordem ativo DESC, descrição sem caixa, id. " +
      "Filtro opcional ativo=true|false; qualquer outro parâmetro é rejeitado. Sem CSRF e sem auditoria.",
  })
  @ApiQuery({ name: "ativo", required: false, enum: ["true", "false"], description: "Filtra pela situação." })
  @ApiResponse({ status: 200, description: "Motivos na ordem canônica.", type: MotivoCancelamentoRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Parâmetro de consulta inválido.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroMotivoCancelamentoDto })
  async listar(@Query() query: unknown): Promise<MotivoCancelamentoRespostaDto[]> {
    const filtro = validarFiltroMotivosCancelamento(query);
    if (!filtro.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    return (await this.motivos.listar(filtro.valor)).map(paraResposta);
  }

  @Get(":motivoCancelamentoId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({ summary: "Consulta um motivo de cancelamento (CFG-005).", description: "Exige clinica.configurar. Sem CSRF e sem auditoria." })
  @ApiParam(PARAMETRO_MOTIVO_CANCELAMENTO_ID)
  @ApiResponse({ status: 200, description: "Motivo de cancelamento.", type: MotivoCancelamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 404, description: "Motivo inexistente (MOTIVO_CANCELAMENTO_NAO_ENCONTRADO).", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroMotivoCancelamentoDto })
  async consultar(@Param("motivoCancelamentoId") motivoCancelamentoId: string): Promise<MotivoCancelamentoRespostaDto> {
    exigirMotivoCancelamentoId(motivoCancelamentoId);
    try {
      return paraResposta(await this.motivos.consultar(motivoCancelamentoId));
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
    summary: "Cria um motivo de cancelamento, sempre ativo (CFG-005).",
    description:
      "Exige clinica.configurar. Corpo estrito com exatamente descricao. Emite configuracao.alterada na mesma transação.",
  })
  @ApiResponse({ status: 201, description: "Motivo criado.", type: MotivoCancelamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 409, description: "Descrição equivalente a motivo existente, ativo ou inativo (MOTIVO_CANCELAMENTO_DUPLICADO).", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroMotivoCancelamentoDto })
  async criar(
    @Body() corpo: MotivoCancelamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<MotivoCancelamentoRespostaDto> {
    const validacao = validarCorpoMotivoCancelamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.motivos.criar({ atorUsuarioId: contexto.usuarioId, dados: validacao.valor }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":motivoCancelamentoId")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Atualiza a descrição de um motivo de cancelamento (CFG-005).",
    description:
      "Exige clinica.configurar. Substituição total da descrição; não altera a situação e é permitida em motivo inativo. " +
      "Motivo referenciado por agendamento ou historico_agendamento não pode ser editado. " +
      "Alteração efetiva emite configuracao.alterada; sem alteração retorna 200 sem auditoria.",
  })
  @ApiParam(PARAMETRO_MOTIVO_CANCELAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: MotivoCancelamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 404, description: "Motivo inexistente (MOTIVO_CANCELAMENTO_NAO_ENCONTRADO).", type: ErroMotivoCancelamentoDto })
  @ApiResponse({
    status: 409,
    description:
      "Descrição equivalente a outro motivo, ativo ou inativo (MOTIVO_CANCELAMENTO_DUPLICADO), " +
      "ou motivo já utilizado na agenda (MOTIVO_CANCELAMENTO_EM_USO).",
    type: ErroMotivoCancelamentoDto,
  })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroMotivoCancelamentoDto })
  async atualizar(
    @Param("motivoCancelamentoId") motivoCancelamentoId: string,
    @Body() corpo: MotivoCancelamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<MotivoCancelamentoRespostaDto> {
    exigirMotivoCancelamentoId(motivoCancelamentoId);
    const validacao = validarCorpoMotivoCancelamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.motivos.atualizar({
        atorUsuarioId: contexto.usuarioId,
        motivoCancelamentoId,
        dados: validacao.valor,
      });
      return paraResposta(resultado.motivoCancelamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Patch(":motivoCancelamentoId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Inativa ou reativa um motivo de cancelamento (CFG-005).",
    description:
      "Exige clinica.configurar. Corpo exato { ativo }. Mudança efetiva emite configuracao.alterada; " +
      "pedido do estado já vigente retorna 200 sem mutação e sem auditoria. Referências da agenda nunca são alteradas.",
  })
  @ApiParam(PARAMETRO_MOTIVO_CANCELAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: MotivoCancelamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar ou falha na validação CSRF.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 404, description: "Motivo inexistente (MOTIVO_CANCELAMENTO_NAO_ENCONTRADO).", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroMotivoCancelamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroMotivoCancelamentoDto })
  async alterarSituacao(
    @Param("motivoCancelamentoId") motivoCancelamentoId: string,
    @Body() corpo: SituacaoMotivoCancelamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<MotivoCancelamentoRespostaDto> {
    exigirMotivoCancelamentoId(motivoCancelamentoId);
    const validacao = validarCorpoSituacaoMotivoCancelamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.motivos.alterarSituacao({
        atorUsuarioId: contexto.usuarioId,
        motivoCancelamentoId,
        ativo: validacao.valor.ativo,
      });
      return paraResposta(resultado.motivoCancelamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
