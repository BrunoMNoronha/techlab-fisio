// TechLab Fisio — fronteira HTTP do cadastro de profissionais (fatia PRO-A;
// `docs/18` §4, D-PRO1-02..D-PRO1-10).
//
//   - GET   /profissionais[?ativo=]                       — lista sem paginação, ordem canônica;
//   - GET   /profissionais/:profissionalId                — consulta individual;
//   - POST  /profissionais                                — criação, sempre ativo (PRO-001);
//   - PUT   /profissionais/:profissionalId                — substituição de nome, registro e vínculo;
//   - PATCH /profissionais/:profissionalId/situacao       — inativação/reativação idempotente (PRO-005);
//   - GET   /profissionais/:profissionalId/servicos       — serviços realizados (PRO-004);
//   - PUT   /profissionais/:profissionalId/servicos       — substituição do conjunto (PRO-004).
//
// Todas exigem `profissionais.gerenciar` (D-PRO1-09). GETs são métodos
// seguros, sem CSRF e com Cache-Control: no-store; as mutações usam
// ProtecaoCsrfGuard declarada ABAIXO de @RequerPermissao (a CSRF roda antes
// da sessão). Ator só da sessão. Não existe DELETE. Só a situação é auditada
// (D-PRO1-08). Erros normalizados para `{ erro }` por `FiltroErroProfissionais`.

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
  UnprocessableEntityException,
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
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import { FiltroErroProfissionais } from "./erro-profissionais.filter.js";
import {
  ErroProfissionalDto,
  ERRO_PROFISSIONAL,
  ProfissionalRequisicaoDto,
  ProfissionalRespostaDto,
  ServicoDoProfissionalRespostaDto,
  ServicosProfissionalRequisicaoDto,
  SituacaoProfissionalRequisicaoDto,
  validarCorpoProfissional,
  validarCorpoServicosProfissional,
  validarCorpoSituacaoProfissional,
  validarFiltroProfissionais,
} from "./profissionais.dto.js";
import { ErroProfissional, ProfissionaisService } from "./profissionais.service.js";
import type { DadosProfissional } from "./profissional.leitura.js";
import { ErroSituacaoProfissional, ProfissionalService } from "./profissional.service.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_PROFISSIONAL_ID = {
  name: "profissionalId",
  description: "Identificador UUID do profissional.",
  format: "uuid",
  required: true,
} as const;

const SEM_PERMISSAO = "Sem a permissão profissionais.gerenciar.";
const SEM_PERMISSAO_OU_CSRF = "Sem a permissão profissionais.gerenciar ou falha na validação CSRF.";

function paraResposta(p: DadosProfissional): ProfissionalRespostaDto {
  return {
    id: p.id,
    nome: p.nome,
    registroProfissional: p.registroProfissional,
    usuarioId: p.usuarioId,
    ativo: p.ativo,
    inativadoEm: p.inativadoEm ? p.inativadoEm.toISOString() : null,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroProfissional) {
    switch (erro.motivo) {
      case "PROFISSIONAL_NAO_ENCONTRADO":
        throw new NotFoundException({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
      case "USUARIO_JA_VINCULADO":
        throw new ConflictException({ erro: ERRO_PROFISSIONAL.USUARIO_JA_VINCULADO });
      case "USUARIO_INELEGIVEL":
        throw new UnprocessableEntityException({ erro: ERRO_PROFISSIONAL.USUARIO_INELEGIVEL });
      case "SERVICO_INELEGIVEL":
        throw new UnprocessableEntityException({ erro: ERRO_PROFISSIONAL.SERVICO_INELEGIVEL });
    }
  }
  if (erro instanceof ErroSituacaoProfissional && erro.motivo === "PROFISSIONAL_INEXISTENTE") {
    throw new NotFoundException({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
  }
  // ATOR_INEXISTENTE/ATOR_INATIVO: a sessão já foi validada pelas guards; se
  // ocorrer, é falha de integridade — segue como 500 pelo filtro.
  throw erro;
}

function exigirProfissionalId(profissionalId: string): void {
  if (!ehUuidValido(profissionalId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Profissionais")
@Controller("profissionais")
@UseFilters(FiltroErroProfissionais)
export class ProfissionaisController {
  constructor(
    private readonly profissionais: ProfissionaisService,
    private readonly situacao: ProfissionalService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("profissionais.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista os profissionais (PRO-001).",
    description:
      "Exige profissionais.gerenciar. Sem paginação; ativos e inativos, na ordem ativo DESC, nome sem caixa, id. " +
      "Filtro opcional ativo=true|false; qualquer outro parâmetro é rejeitado. Sem CSRF e sem auditoria.",
  })
  @ApiQuery({ name: "ativo", required: false, enum: ["true", "false"], description: "Filtra pela situação." })
  @ApiResponse({ status: 200, description: "Profissionais na ordem canônica.", type: ProfissionalRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Parâmetro de consulta inválido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO, type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async listar(@Query() query: unknown): Promise<ProfissionalRespostaDto[]> {
    const filtro = validarFiltroProfissionais(query);
    if (!filtro.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    return (await this.profissionais.listar(filtro.valor)).map(paraResposta);
  }

  @Get(":profissionalId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("profissionais.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({ summary: "Consulta um profissional (PRO-001).", description: "Exige profissionais.gerenciar. Sem CSRF e sem auditoria." })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Profissional.", type: ProfissionalRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO, type: ErroProfissionalDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async consultar(@Param("profissionalId") profissionalId: string): Promise<ProfissionalRespostaDto> {
    exigirProfissionalId(profissionalId);
    try {
      return paraResposta(await this.profissionais.consultar(profissionalId));
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequerPermissao("profissionais.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Cadastra um profissional, sempre ativo (PRO-001).",
    description:
      "Exige profissionais.gerenciar. Corpo estrito com exatamente nome, registroProfissional e usuarioId " +
      "(os dois últimos aceitam null). O usuário vinculado precisa existir, estar ativo e não estar vinculado a outro profissional. " +
      "Sem auditoria (D-PRO1-08).",
  })
  @ApiResponse({ status: 201, description: "Profissional criado.", type: ProfissionalRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroProfissionalDto })
  @ApiResponse({ status: 409, description: "Usuário já vinculado a outro profissional (USUARIO_JA_VINCULADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 422, description: "Usuário inexistente ou inativo (USUARIO_INELEGIVEL).", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async criar(@Body() corpo: ProfissionalRequisicaoDto): Promise<ProfissionalRespostaDto> {
    const validacao = validarCorpoProfissional(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(await this.profissionais.criar(validacao.valor));
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":profissionalId")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("profissionais.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Atualiza nome, registro e vínculo com usuário de um profissional (PRO-001).",
    description:
      "Exige profissionais.gerenciar. Substituição total; não altera a situação e é permitida em profissional inativo. " +
      "Pedido idêntico ao vigente retorna 200 sem escrita. Sem auditoria (D-PRO1-08).",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: ProfissionalRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroProfissionalDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 409, description: "Usuário já vinculado a outro profissional (USUARIO_JA_VINCULADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 422, description: "Usuário inexistente ou inativo (USUARIO_INELEGIVEL).", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async atualizar(
    @Param("profissionalId") profissionalId: string,
    @Body() corpo: ProfissionalRequisicaoDto,
  ): Promise<ProfissionalRespostaDto> {
    exigirProfissionalId(profissionalId);
    const validacao = validarCorpoProfissional(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta((await this.profissionais.atualizar(profissionalId, validacao.valor)).profissional);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Patch(":profissionalId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("profissionais.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Inativa ou reativa um profissional (PRO-005).",
    description:
      "Exige profissionais.gerenciar. Corpo exato { ativo }. Mudança efetiva emite profissional.situacao.alterada; " +
      "pedido do estado já vigente retorna 200 sem mutação e sem auditoria. Agendamentos existentes não são alterados.",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: ProfissionalRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroProfissionalDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async alterarSituacao(
    @Param("profissionalId") profissionalId: string,
    @Body() corpo: SituacaoProfissionalRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<ProfissionalRespostaDto> {
    exigirProfissionalId(profissionalId);
    const validacao = validarCorpoSituacaoProfissional(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.situacao.alterarSituacao({
        profissionalId,
        atorUsuarioId: contexto.usuarioId,
        ativo: validacao.valor.ativo,
      });
      return paraResposta(resultado.profissional);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Get(":profissionalId/servicos")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("profissionais.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Lista os serviços realizados por um profissional (PRO-004).",
    description: "Exige profissionais.gerenciar. Ordem nome sem caixa, id; inclui serviços que ficaram inativos. Sem CSRF e sem auditoria.",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Serviços associados.", type: ServicoDoProfissionalRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO, type: ErroProfissionalDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async listarServicos(@Param("profissionalId") profissionalId: string): Promise<ServicoDoProfissionalRespostaDto[]> {
    exigirProfissionalId(profissionalId);
    try {
      return await this.profissionais.listarServicos(profissionalId);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":profissionalId/servicos")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("profissionais.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Substitui o conjunto de serviços realizados por um profissional (PRO-004).",
    description:
      "Exige profissionais.gerenciar. Corpo exato { servicoIds } sem duplicatas. Serviço novo precisa existir e estar ativo; " +
      "associação mantida com serviço que ficou inativo é preservada. Conjunto idêntico retorna 200 sem escrita. " +
      "Permitido para profissional inativo. Agendamentos existentes não são alterados. Sem auditoria (D-PRO1-08).",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Serviços associados após a operação.", type: ServicoDoProfissionalRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos (inclusive duplicatas).", type: ErroProfissionalDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroProfissionalDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroProfissionalDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroProfissionalDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroProfissionalDto })
  @ApiResponse({ status: 422, description: "Serviço novo inexistente ou inativo (SERVICO_INELEGIVEL).", type: ErroProfissionalDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroProfissionalDto })
  async substituirServicos(
    @Param("profissionalId") profissionalId: string,
    @Body() corpo: ServicosProfissionalRequisicaoDto,
  ): Promise<ServicoDoProfissionalRespostaDto[]> {
    exigirProfissionalId(profissionalId);
    const validacao = validarCorpoServicosProfissional(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return (await this.profissionais.substituirServicos(profissionalId, validacao.valor)).servicos;
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
