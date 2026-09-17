// TechLab Fisio — fronteira HTTP da configuração dos dados da clínica única
// (CFG-001 sem logotipo + CFG-006 / fatia CFG-001A; `docs/14`).
//
//   - GET /clinica  — @RequerPermissao("clinica.configurar"); método seguro,
//                     sem CSRF; Cache-Control: no-store; sem auditoria;
//   - PUT /clinica  — @RequerPermissao("clinica.configurar") + ProtecaoCsrfGuard;
//                     substituição total com corpo estrito; ator só da sessão;
//   - 404 CLINICA_NAO_CONFIGURADA quando a linha não foi provisionada (D-CFG-01);
//   - erros normalizados para `{ erro }` por `FiltroErroClinica`.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ERRO } from "../auth/auth.dto.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import {
  UsuarioAutenticado,
  type ContextoAutenticado,
} from "../authz/contexto-autenticado.js";
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  AtualizarClinicaRequisicaoDto,
  ClinicaRespostaDto,
  ErroClinicaDto,
  ERRO_CLINICA,
  validarCorpoAtualizarClinica,
} from "./clinica.dto.js";
import { ClinicaService, ErroClinica, type DadosClinica } from "./clinica.service.js";
import { FiltroErroClinica } from "./erro-clinica.filter.js";

function paraResposta(clinica: DadosClinica): ClinicaRespostaDto {
  return {
    id: clinica.id,
    nomeCadastral: clinica.nomeCadastral,
    nomeOperacional: clinica.nomeOperacional,
    endereco: clinica.endereco,
    telefone: clinica.telefone,
    email: clinica.email,
    fusoHorario: clinica.fusoHorario,
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroClinica && erro.motivo === "CLINICA_NAO_CONFIGURADA") {
    throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
  }
  throw erro;
}

@ApiTags("Configuração da Clínica")
@Controller("clinica")
@UseFilters(FiltroErroClinica)
export class ClinicaController {
  constructor(private readonly clinicas: ClinicaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta os dados da clínica única (CFG-001, CFG-006).",
    description:
      "Exige clinica.configurar. Método seguro de leitura, sem CSRF e sem evento de auditoria. " +
      "Logotipo e duração padrão não fazem parte deste contrato (D-CFG-07).",
  })
  @ApiResponse({ status: 200, description: "Dados da clínica.", type: ClinicaRespostaDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroClinicaDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroClinicaDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroClinicaDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroClinicaDto })
  async consultar(): Promise<ClinicaRespostaDto> {
    try {
      return paraResposta(await this.clinicas.consultar());
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  // Abaixo de @RequerPermissao de propósito: decorators aplicam de baixo para
  // cima, logo a CSRF roda ANTES da sessão e da permissão (mesma ordem de
  // `UsuariosController`, onde a guard é de classe).
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader({
    name: CABECALHO_REQUISICAO_TLF,
    required: true,
    description:
      "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
  })
  @ApiOperation({
    summary: "Atualiza os dados da clínica única por substituição total (CFG-001, CFG-006).",
    description:
      "Exige clinica.configurar. Corpo estrito com exatamente nomeCadastral, nomeOperacional, endereco, " +
      "telefone, email e fusoHorario. Alteração efetiva emite configuracao.alterada na mesma transação; " +
      "sem alteração efetiva retorna 200 sem mutação e sem auditoria (D-CFG-06).",
  })
  @ApiResponse({ status: 200, description: "Dados vigentes após a operação.", type: ClinicaRespostaDto })
  @ApiResponse({ status: 400, description: "Payload estruturalmente inválido.", type: ErroClinicaDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroClinicaDto })
  @ApiResponse({
    status: 403,
    description: "Sem a permissão clinica.configurar ou falha na validação CSRF.",
    type: ErroClinicaDto,
  })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroClinicaDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroClinicaDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroClinicaDto })
  async atualizar(
    @Body() corpo: AtualizarClinicaRequisicaoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<ClinicaRespostaDto> {
    const validacao = validarCorpoAtualizarClinica(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    try {
      const resultado = await this.clinicas.atualizar({
        atorUsuarioId: contexto.usuarioId,
        dados: validacao.valor,
      });
      return paraResposta(resultado.clinica);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
