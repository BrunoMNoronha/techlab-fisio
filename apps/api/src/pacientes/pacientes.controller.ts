// TechLab Fisio — fronteira HTTP da fatia mínima de pacientes (PAC-A; `docs/17`).
//
//   - POST  /pacientes/busca                 — localização (pacientes.localizar);
//   - GET   /pacientes/:pacienteId           — detalhe administrativo (pacientes.localizar);
//   - POST  /pacientes                       — criação, sempre ativa (pacientes.administrativo.gerenciar);
//   - PUT   /pacientes/:pacienteId           — substituição dos dados administrativos (idem);
//   - PATCH /pacientes/:pacienteId/situacao  — inativação/reativação idempotente (idem).
//
// D-PAC-02: a busca usa POST com corpo — nome, CPF e data de nascimento NUNCA
// trafegam em URL (Base §10, RN-063); é leitura sem auditoria, com
// `Cache-Control: no-store`, e passa pela ProtecaoCsrfGuard por ser POST.
// Todas as mutações usam ProtecaoCsrfGuard declarada ABAIXO de
// @RequerPermissao (a CSRF roda antes da sessão, mesma ordem de
// `ServicosController`). Ator só da sessão. Não existe DELETE. Erros
// normalizados para `{ erro }` por `FiltroErroPacientes`, sem valor pessoal.

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
  Patch,
  Post,
  Put,
  UseFilters,
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
import { ehUuidValido } from "../auth/usuarios.dto.js";
import {
  UsuarioAutenticado,
  type ContextoAutenticado,
} from "../authz/contexto-autenticado.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import { FiltroErroPacientes } from "./erro-pacientes.filter.js";
import {
  AtualizarPacienteRequisicaoDto,
  BuscaPacientesRequisicaoDto,
  BuscaPacientesRespostaDto,
  CriarPacienteRequisicaoDto,
  ErroPacienteDto,
  ERRO_PACIENTE,
  PacienteRespostaDto,
  SituacaoPacienteRequisicaoDto,
  validarCorpoAtualizarPaciente,
  validarCorpoBuscaPacientes,
  validarCorpoCriarPaciente,
  validarCorpoSituacaoPaciente,
} from "./pacientes.dto.js";
import { ErroPaciente, PacientesService, type DadosPaciente } from "./pacientes.service.js";

const CABECALHO_CSRF = {
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description: "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
} as const;

const PARAMETRO_PACIENTE_ID = {
  name: "pacienteId",
  description: "Identificador UUID do paciente.",
  format: "uuid",
  required: true,
} as const;

function paraResposta(p: DadosPaciente): PacienteRespostaDto {
  return {
    id: p.id,
    nome: p.nome,
    dataNascimento: p.dataNascimento,
    cpf: p.cpf,
    telefone: p.telefone,
    email: p.email,
    ativo: p.ativo,
    inativadoEm: p.inativadoEm ? p.inativadoEm.toISOString() : null,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroPaciente) {
    switch (erro.motivo) {
      case "CLINICA_NAO_CONFIGURADA":
        throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
      case "PACIENTE_NAO_ENCONTRADO":
        throw new NotFoundException({ erro: ERRO_PACIENTE.PACIENTE_NAO_ENCONTRADO });
      case "CPF_JA_CADASTRADO":
        throw new ConflictException({ erro: ERRO_PACIENTE.CPF_JA_CADASTRADO });
      case "POSSIVEL_DUPLICIDADE":
        throw new ConflictException({ erro: ERRO_PACIENTE.POSSIVEL_DUPLICIDADE });
      case "DADOS_INVALIDOS":
        throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
      case "ACESSO_NEGADO":
        throw new ForbiddenException({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    }
  }
  throw erro;
}

function exigirPacienteId(pacienteId: string): void {
  if (!ehUuidValido(pacienteId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Pacientes")
@Controller("pacientes")
@UseFilters(FiltroErroPacientes)
export class PacientesController {
  constructor(private readonly pacientes: PacientesService) {}

  @Post("busca")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("pacientes.localizar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Localiza pacientes por nome, CPF e/ou data de nascimento (PAC-002).",
    description:
      "Exige pacientes.localizar, com escopo por papel (D-PAC-06). Filtros no CORPO — nunca em URL. " +
      "Ao menos um de nome (mínimo 3 caracteres), cpf ou dataNascimento. No máximo 20 resultados; truncado indica excedente. Sem auditoria.",
  })
  @ApiResponse({ status: 200, description: "Resultado da localização.", type: BuscaPacientesRespostaDto })
  @ApiResponse({ status: 400, description: "Filtro inválido.", type: ErroPacienteDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroPacienteDto })
  @ApiResponse({ status: 403, description: "Sem permissão, papel sem escopo de localização ou falha na validação CSRF.", type: ErroPacienteDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroPacienteDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroPacienteDto })
  async buscar(
    @Body() corpo: BuscaPacientesRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<BuscaPacientesRespostaDto> {
    const validacao = validarCorpoBuscaPacientes(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return await this.pacientes.buscar(contexto.usuarioId, validacao.valor);
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Get(":pacienteId")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("pacientes.localizar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta os dados administrativos de um paciente (PAC-002).",
    description: "Exige pacientes.localizar, com escopo por papel (D-PAC-06). Fora do escopo responde 404. Sem CSRF e sem auditoria.",
  })
  @ApiParam(PARAMETRO_PACIENTE_ID)
  @ApiResponse({ status: 200, description: "Paciente.", type: PacienteRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroPacienteDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroPacienteDto })
  @ApiResponse({ status: 403, description: "Sem permissão ou papel sem escopo de localização.", type: ErroPacienteDto })
  @ApiResponse({ status: 404, description: "Paciente inexistente ou fora do escopo (PACIENTE_NAO_ENCONTRADO).", type: ErroPacienteDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroPacienteDto })
  async consultar(
    @Param("pacienteId") pacienteId: string,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<PacienteRespostaDto> {
    exigirPacienteId(pacienteId);
    try {
      return paraResposta(await this.pacientes.consultar(contexto.usuarioId, pacienteId));
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequerPermissao("pacientes.administrativo.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Cadastra paciente administrativo, sempre ativo (PAC-001, PAC-003).",
    description:
      "Exige pacientes.administrativo.gerenciar. Corpo estrito. CPF de paciente ativo ou inativo → 409 CPF_JA_CADASTRADO; " +
      "mesmo nome normalizado e mesma data sem confirmarPossivelDuplicidade → 409 POSSIVEL_DUPLICIDADE. " +
      "CPF informado emite paciente.cadastro.alterado na mesma transação.",
  })
  @ApiResponse({ status: 201, description: "Paciente criado.", type: PacienteRespostaDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroPacienteDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroPacienteDto })
  @ApiResponse({ status: 403, description: "Sem permissão ou falha na validação CSRF.", type: ErroPacienteDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroPacienteDto })
  @ApiResponse({ status: 409, description: "CPF_JA_CADASTRADO ou POSSIVEL_DUPLICIDADE.", type: ErroPacienteDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroPacienteDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroPacienteDto })
  async criar(
    @Body() corpo: CriarPacienteRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<PacienteRespostaDto> {
    const validacao = validarCorpoCriarPaciente(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.pacientes.criar({
          atorUsuarioId: contexto.usuarioId,
          dados: validacao.valor.dados,
          confirmarPossivelDuplicidade: validacao.valor.confirmarPossivelDuplicidade,
        }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":pacienteId")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("pacientes.administrativo.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Atualiza os dados administrativos de um paciente (PAC-001).",
    description:
      "Exige pacientes.administrativo.gerenciar. Substituição total; permitida em paciente inativo, sem alterar a situação. " +
      "Mudança de CPF emite paciente.cadastro.alterado; sem alteração retorna 200 sem auditoria.",
  })
  @ApiParam(PARAMETRO_PACIENTE_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: PacienteRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroPacienteDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroPacienteDto })
  @ApiResponse({ status: 403, description: "Sem permissão ou falha na validação CSRF.", type: ErroPacienteDto })
  @ApiResponse({ status: 404, description: "PACIENTE_NAO_ENCONTRADO ou CLINICA_NAO_CONFIGURADA.", type: ErroPacienteDto })
  @ApiResponse({ status: 409, description: "CPF de outro paciente, ativo ou inativo (CPF_JA_CADASTRADO).", type: ErroPacienteDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroPacienteDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroPacienteDto })
  async atualizar(
    @Param("pacienteId") pacienteId: string,
    @Body() corpo: AtualizarPacienteRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<PacienteRespostaDto> {
    exigirPacienteId(pacienteId);
    const validacao = validarCorpoAtualizarPaciente(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.pacientes.atualizar({ atorUsuarioId: contexto.usuarioId, pacienteId, dados: validacao.valor }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Patch(":pacienteId/situacao")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("pacientes.administrativo.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Inativa ou reativa um paciente (PAC-006).",
    description:
      "Exige pacientes.administrativo.gerenciar. Corpo exato { ativo }. Mudança efetiva emite paciente.situacao.alterada; " +
      "pedido do estado vigente retorna 200 sem mutação e sem auditoria. Agenda, pacotes, cobranças e prontuário não são alterados.",
  })
  @ApiParam(PARAMETRO_PACIENTE_ID)
  @ApiResponse({ status: 200, description: "Estado vigente após a operação.", type: PacienteRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroPacienteDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroPacienteDto })
  @ApiResponse({ status: 403, description: "Sem permissão ou falha na validação CSRF.", type: ErroPacienteDto })
  @ApiResponse({ status: 404, description: "Paciente inexistente (PACIENTE_NAO_ENCONTRADO).", type: ErroPacienteDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroPacienteDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroPacienteDto })
  async alterarSituacao(
    @Param("pacienteId") pacienteId: string,
    @Body() corpo: SituacaoPacienteRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<PacienteRespostaDto> {
    exigirPacienteId(pacienteId);
    const validacao = validarCorpoSituacaoPaciente(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta(
        await this.pacientes.alterarSituacao({
          atorUsuarioId: contexto.usuarioId,
          pacienteId,
          ativo: validacao.valor.ativo,
        }),
      );
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
