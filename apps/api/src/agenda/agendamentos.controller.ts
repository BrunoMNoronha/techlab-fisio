// TechLab Fisio — fronteira HTTP da agenda (AGD-A e AGD-B; `docs/15`).
//
//   - GET  /agendamentos?de=&ate=[&profissionalId=]        — consulta da agenda (D-AGD-14);
//   - GET  /agendamentos/:agendamentoId                    — consulta individual;
//   - POST /agendamentos                                   — criação AVULSO (T-01);
//   - POST /agendamentos/:agendamentoId/confirmacao        — AGENDADO -> CONFIRMADO;
//   - POST /agendamentos/:agendamentoId/remarcacao         — novo intervalo (D-AGD-06);
//   - POST /agendamentos/:agendamentoId/cancelamento       — com motivo padronizado (D-AGD-07);
//   - POST /agendamentos/:agendamentoId/checkin            — AGENDADO/CONFIRMADO -> AGUARDANDO (D-AGD-03);
//   - POST /agendamentos/:agendamentoId/falta              — AGENDADO/CONFIRMADO -> FALTA (D-AGD-03).
//
// Todas exigem `agenda.gerenciar` (D-AGD-12) — **nenhuma permissão nova**. Os
// GETs são métodos seguros, sem CSRF e com `Cache-Control: no-store`; as
// mutações usam `ProtecaoCsrfGuard` declarada ABAIXO de `@RequerPermissao` (a
// CSRF roda antes da sessão, mesma ordem dos demais controllers). O ator vem
// SÓ da sessão.
//
// **SEM `DELETE`** — agendamento nunca é removido (RN-017; `historico_agendamento`
// é append-only). **SEM rotas de AGD-C/D/E**: não há bloqueio, pacote, início
// nem conclusão de atendimento nesta fatia, e o corpo da criação não aceita
// `modalidade` nem `pacoteId`.
//
// Erros normalizados para `{ erro }` por `FiltroErroAgenda`.

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
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
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  AgendamentoRespostaDto,
  CancelarAgendamentoRequisicaoDto,
  ConfirmarAgendamentoRequisicaoDto,
  CriarAgendamentoRequisicaoDto,
  ErroAgendamentoDto,
  ERRO_AGENDAMENTO,
  RemarcarAgendamentoRequisicaoDto,
  validarCorpoCancelamento,
  validarCorpoConfirmacao,
  validarCorpoCriacao,
  validarCorpoRemarcacao,
  validarFiltroAgenda,
} from "./agenda.dto.js";
import { FiltroErroAgenda } from "./erro-agenda.filter.js";
import { PERMISSAO_AGENDA_CHECKIN, PERMISSAO_AGENDA_FALTA } from "./agenda.escopo.js";
import {
  AgendamentosService,
  ErroAgendamento,
  type DadosAgendamento,
} from "./agendamentos.service.js";
import { ErroForaDaDisponibilidade } from "./verificador-disponibilidade-profissional.js";
import {
  ERRO_AGENDA,
  ErroForaDoHorarioFuncionamento,
} from "./verificador-horario-funcionamento.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_AGENDAMENTO_ID = {
  name: "agendamentoId",
  description: "Identificador UUID do agendamento.",
  format: "uuid",
  required: true,
} as const;

const SEM_PERMISSAO = "Sem a permissão agenda.gerenciar.";
const SEM_PERMISSAO_OU_CSRF = "Sem a permissão agenda.gerenciar ou falha na validação CSRF.";
const SEM_PERMISSAO_CHECKIN_OU_CSRF = "Sem a permissão agenda.checkin ou falha na validação CSRF.";
const SEM_PERMISSAO_FALTA_OU_CSRF = "Sem a permissão agenda.falta ou falha na validação CSRF.";
const SEM_CLINICA = "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).";

function paraResposta(a: DadosAgendamento): AgendamentoRespostaDto {
  return {
    id: a.id,
    paciente: a.paciente,
    profissional: a.profissional,
    servico: a.servico,
    inicio: a.inicio.toISOString(),
    fim: a.fim.toISOString(),
    estado: a.estado,
    modalidade: a.modalidade,
    motivoCancelamentoId: a.motivoCancelamentoId,
    canceladoEm: a.canceladoEm === null ? null : a.canceladoEm.toISOString(),
  };
}

/**
 * Traduz as rejeições de domínio nos status homologados por D-AGD-04,
 * D-AGD-02, D-AGD-07 e D-AGD-12. Nenhum corpo carrega dado do recurso
 * conflitante — só o código.
 */
function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroAgendamento) {
    switch (erro.motivo) {
      case "ACESSO_NEGADO":
        throw new ForbiddenException({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
      case "AGENDAMENTO_NAO_ENCONTRADO":
        throw new NotFoundException({ erro: ERRO_AGENDAMENTO.AGENDAMENTO_NAO_ENCONTRADO });
      case "AGENDAMENTO_NO_PASSADO":
        throw new UnprocessableEntityException({ erro: ERRO_AGENDAMENTO.AGENDAMENTO_NO_PASSADO });
      case "PACIENTE_INELEGIVEL":
        throw new UnprocessableEntityException({ erro: ERRO_AGENDAMENTO.PACIENTE_INELEGIVEL });
      case "PROFISSIONAL_INELEGIVEL":
        throw new UnprocessableEntityException({ erro: ERRO_AGENDAMENTO.PROFISSIONAL_INELEGIVEL });
      case "SERVICO_INELEGIVEL":
        throw new UnprocessableEntityException({ erro: ERRO_AGENDAMENTO.SERVICO_INELEGIVEL });
      case "SERVICO_NAO_HABILITADO":
        throw new UnprocessableEntityException({ erro: ERRO_AGENDAMENTO.SERVICO_NAO_HABILITADO });
      case "MOTIVO_CANCELAMENTO_INELEGIVEL":
        throw new UnprocessableEntityException({
          erro: ERRO_AGENDAMENTO.MOTIVO_CANCELAMENTO_INELEGIVEL,
        });
      case "TRANSICAO_INVALIDA":
        throw new ConflictException({ erro: ERRO_AGENDAMENTO.TRANSICAO_INVALIDA });
      case "CONFLITO_BLOQUEIO":
        throw new ConflictException({ erro: ERRO_AGENDAMENTO.CONFLITO_BLOQUEIO });
      case "CONFLITO_PROFISSIONAL":
        throw new ConflictException({ erro: ERRO_AGENDAMENTO.CONFLITO_PROFISSIONAL });
      case "CONFLITO_PACIENTE":
        throw new ConflictException({ erro: ERRO_AGENDAMENTO.CONFLITO_PACIENTE });
    }
  }
  // O `motivo` interno dos dois verificadores é diagnóstico e NUNCA vai ao
  // corpo HTTP: a fronteira expõe um único código, sem revelar a grade da
  // clínica nem a do profissional (D-CFG-61, D-PRO3-04).
  if (erro instanceof ErroForaDoHorarioFuncionamento) {
    throw new UnprocessableEntityException({ erro: ERRO_AGENDA.FORA_DO_HORARIO_FUNCIONAMENTO });
  }
  if (erro instanceof ErroForaDaDisponibilidade) {
    throw new UnprocessableEntityException({ erro: ERRO_AGENDA.FORA_DA_DISPONIBILIDADE });
  }
  if (erro instanceof ErroClinica && erro.motivo === "CLINICA_NAO_CONFIGURADA") {
    throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
  }
  throw erro;
}

function exigirAgendamentoId(agendamentoId: string): void {
  if (!ehUuidValido(agendamentoId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Agenda")
@Controller("agendamentos")
@UseFilters(FiltroErroAgenda)
export class AgendamentosController {
  constructor(private readonly agendamentos: AgendamentosService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("agenda.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta a agenda em uma janela de até 7 dias (AGD-001, D-AGD-14).",
    description:
      "Exige agenda.gerenciar. Devolve os agendamentos que INTERSECTAM [de, ate), em todos os " +
      "estados, na ordem inicio, id, sem paginação. Ator com escopo próprio (Fisioterapeuta) " +
      "recebe apenas os próprios agendamentos, e o profissionalId informado é ignorado. " +
      "Sem CSRF e sem auditoria.",
  })
  @ApiQuery({
    name: "de",
    required: true,
    description: "Início da janela, ISO-8601 com offset explícito.",
    example: "2026-10-01T00:00:00-03:00",
  })
  @ApiQuery({
    name: "ate",
    required: true,
    description: "Fim EXCLUSIVO da janela, ISO-8601 com offset explícito; no máximo 7 dias após de.",
    example: "2026-10-08T00:00:00-03:00",
  })
  @ApiQuery({
    name: "profissionalId",
    required: false,
    format: "uuid",
    description: "Restringe a um profissional. Ignorado no escopo próprio.",
  })
  @ApiResponse({ status: 200, description: "Agendamentos da janela.", type: AgendamentoRespostaDto, isArray: true })
  @ApiResponse({ status: 400, description: "Janela ausente, inválida, invertida ou maior que 7 dias.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO, type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async listar(
    @Query() query: unknown,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto[]> {
    const filtro = validarFiltroAgenda(query);
    if (!filtro.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    const agendamentos = await this.agendamentos.listar({
      atorUsuarioId: contexto.usuarioId,
      filtro: filtro.valor,
    });
    return agendamentos.map(paraResposta);
  }

  @Get(":agendamentoId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("agenda.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta um agendamento (D-AGD-05).",
    description:
      "Exige agenda.gerenciar. Agendamento fora do escopo do ator recebe o MESMO 404 de um " +
      "agendamento inexistente — sem oráculo de existência. Sem CSRF e sem auditoria.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Agendamento.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente ou fora do escopo (AGENDAMENTO_NAO_ENCONTRADO).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async consultar(
    @Param("agendamentoId") agendamentoId: string,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    try {
      return paraResposta(
        await this.agendamentos.consultar({ atorUsuarioId: contexto.usuarioId, agendamentoId }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequerPermissao("agenda.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Cria um agendamento AVULSO (AGD-001, T-01).",
    description:
      "Exige agenda.gerenciar. Corpo estrito com exatamente pacienteId, profissionalId, " +
      "servicoId, inicio e fim; modalidade e pacoteId NÃO são aceitos — AGD-A cria somente " +
      "AVULSO. O fim é obrigatório e pode divergir da duração do serviço (D-AGD-05), limitado a " +
      "1..1440 minutos. Emite agendamento.criado e uma linha de histórico CRIADO na mesma transação.",
  })
  @ApiResponse({ status: 201, description: "Agendamento criado no estado AGENDADO.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido (REQUISICAO_INVALIDA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: `${SEM_PERMISSAO_OU_CSRF} Também quando o escopo próprio não alcança o profissionalId (ACESSO_NEGADO).`, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: SEM_CLINICA, type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "CONFLITO_BLOQUEIO, CONFLITO_PROFISSIONAL ou CONFLITO_PACIENTE.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({
    status: 422,
    description:
      "AGENDAMENTO_NO_PASSADO, PACIENTE_INELEGIVEL, PROFISSIONAL_INELEGIVEL, SERVICO_INELEGIVEL, " +
      "SERVICO_NAO_HABILITADO, FORA_DO_HORARIO_FUNCIONAMENTO ou FORA_DA_DISPONIBILIDADE.",
    type: ErroAgendamentoDto,
  })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async criar(
    @Body() corpo: CriarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    const validacao = validarCorpoCriacao(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.agendamentos.criar({
          atorUsuarioId: contexto.usuarioId,
          dados: validacao.valor,
        }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post(":agendamentoId/confirmacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("agenda.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Confirma um agendamento (AGD-002, D-AGD-02).",
    description:
      "Exige agenda.gerenciar. Corpo exato {}. AGENDADO -> CONFIRMADO grava uma linha de " +
      "histórico CONFIRMADO e NENHUM evento de auditoria (a confirmação está fora do catálogo " +
      "homologado). Confirmar um agendamento já CONFIRMADO devolve 200 sem mutação, sem " +
      "histórico e sem auditoria. Qualquer outro estado é 409 TRANSICAO_INVALIDA.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente ou fora do escopo (AGENDAMENTO_NAO_ENCONTRADO).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "Transição não admitida (TRANSICAO_INVALIDA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async confirmar(
    @Param("agendamentoId") agendamentoId: string,
    @Body() corpo: ConfirmarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    if (!validarCorpoConfirmacao(corpo).valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    try {
      const resultado = await this.agendamentos.confirmar({
        atorUsuarioId: contexto.usuarioId,
        agendamentoId,
      });
      return paraResposta(resultado.agendamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post(":agendamentoId/remarcacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("agenda.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Remarca um agendamento (AGD-002, D-AGD-06).",
    description:
      "Exige agenda.gerenciar. Corpo exato { inicio, fim }. Altera SOMENTE o intervalo — trocar " +
      "profissional, serviço ou paciente não é remarcação. Permitida em AGENDADO e CONFIRMADO; " +
      "remarcar um CONFIRMADO o devolve a AGENDADO. Revalida regra temporal, elegibilidade do " +
      "profissional e do serviço, habilitação, grade da clínica, disponibilidade vigente e " +
      "bloqueios. Mesmo intervalo devolve 200 sem mutação. Emite agendamento.remarcado e uma " +
      "linha de histórico REMARCADO na mesma transação.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente, fora do escopo ou clínica não provisionada.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "TRANSICAO_INVALIDA, CONFLITO_BLOQUEIO, CONFLITO_PROFISSIONAL ou CONFLITO_PACIENTE.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({
    status: 422,
    description:
      "AGENDAMENTO_NO_PASSADO, PROFISSIONAL_INELEGIVEL, SERVICO_INELEGIVEL, " +
      "SERVICO_NAO_HABILITADO, FORA_DO_HORARIO_FUNCIONAMENTO ou FORA_DA_DISPONIBILIDADE.",
    type: ErroAgendamentoDto,
  })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async remarcar(
    @Param("agendamentoId") agendamentoId: string,
    @Body() corpo: RemarcarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    const validacao = validarCorpoRemarcacao(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.agendamentos.remarcar({
        atorUsuarioId: contexto.usuarioId,
        agendamentoId,
        intervalo: validacao.valor,
      });
      return paraResposta(resultado.agendamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post(":agendamentoId/cancelamento")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("agenda.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Cancela um agendamento com motivo padronizado (AGD-003, D-AGD-07).",
    description:
      "Exige agenda.gerenciar. Corpo exato { motivoCancelamentoId }. O motivo é OBRIGATÓRIO e " +
      "precisa existir e estar ATIVO — inexistente, inativo e catálogo sem motivo ativo algum " +
      "recebem o mesmo 422 MOTIVO_CANCELAMENTO_INELEGIVEL. Permitido em AGENDADO e CONFIRMADO. " +
      "Grava estado, motivo, instante e ator do cancelamento, uma linha de histórico CANCELADO e " +
      "o evento agendamento.cancelado, tudo na mesma transação. Não há DELETE de agendamento.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_OU_CSRF, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente ou fora do escopo (AGENDAMENTO_NAO_ENCONTRADO).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "Transição não admitida (TRANSICAO_INVALIDA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 422, description: "Motivo inexistente, inativo ou catálogo sem ativos (MOTIVO_CANCELAMENTO_INELEGIVEL).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async cancelar(
    @Param("agendamentoId") agendamentoId: string,
    @Body() corpo: CancelarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    const validacao = validarCorpoCancelamento(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      const resultado = await this.agendamentos.cancelar({
        atorUsuarioId: contexto.usuarioId,
        agendamentoId,
        motivoCancelamentoId: validacao.valor.motivoCancelamentoId,
      });
      return paraResposta(resultado.agendamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post(":agendamentoId/checkin")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao(PERMISSAO_AGENDA_CHECKIN)
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Registra check-in (AGD-B, D-AGD-03).",
    description:
      "Exige agenda.checkin. Corpo exato {}. Permitido somente em AGENDADO e CONFIRMADO no mesmo " +
      "dia civil local da clínica; escreve uma linha CHECKIN no histórico e nenhum evento de auditoria.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_CHECKIN_OU_CSRF, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente ou fora do escopo (AGENDAMENTO_NAO_ENCONTRADO).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "Transição não admitida (TRANSICAO_INVALIDA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async checkin(
    @Param("agendamentoId") agendamentoId: string,
    @Body() corpo: ConfirmarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    if (!validarCorpoConfirmacao(corpo).valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    try {
      const resultado = await this.agendamentos.checkin({
        atorUsuarioId: contexto.usuarioId,
        agendamentoId,
      });
      return paraResposta(resultado.agendamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post(":agendamentoId/falta")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao(PERMISSAO_AGENDA_FALTA)
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Registra falta (AGD-B, D-AGD-03).",
    description:
      "Exige agenda.falta. Corpo exato {}. Permitido somente em AGENDADO e CONFIRMADO após o início; " +
      "escreve uma linha FALTA no histórico e nenhum evento de auditoria.",
  })
  @ApiParam(PARAMETRO_AGENDAMENTO_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: AgendamentoRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: SEM_PERMISSAO_FALTA_OU_CSRF, type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Inexistente ou fora do escopo (AGENDAMENTO_NAO_ENCONTRADO).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 409, description: "Transição não admitida (TRANSICAO_INVALIDA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async falta(
    @Param("agendamentoId") agendamentoId: string,
    @Body() corpo: ConfirmarAgendamentoRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<AgendamentoRespostaDto> {
    exigirAgendamentoId(agendamentoId);
    if (!validarCorpoConfirmacao(corpo).valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }
    try {
      const resultado = await this.agendamentos.registrarFalta({
        atorUsuarioId: contexto.usuarioId,
        agendamentoId,
      });
      return paraResposta(resultado.agendamento);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
