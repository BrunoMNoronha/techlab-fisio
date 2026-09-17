// TechLab Fisio — fronteira HTTP do horário de funcionamento da clínica única
// (CFG-002; `docs/14` D-CFG-13..D-CFG-21).
//
//   - GET /horario-funcionamento — @RequerPermissao("clinica.configurar");
//     método seguro, sem CSRF; Cache-Control: no-store; sem auditoria;
//   - PUT /horario-funcionamento — @RequerPermissao("clinica.configurar") +
//     ProtecaoCsrfGuard; substitui a grade inteira; ator só da sessão;
//   - 404 CLINICA_NAO_CONFIGURADA sem a linha de clinica (D-CFG-21);
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
import { ErroClinicaDto, ERRO_CLINICA } from "./clinica.dto.js";
import { ErroClinica } from "./clinica.service.js";
import { FiltroErroClinica } from "./erro-clinica.filter.js";
import {
  GradeFuncionamentoDto,
  validarCorpoGradeFuncionamento,
  type JanelaFuncionamento,
} from "./horario-funcionamento.dto.js";
import { HorarioFuncionamentoService } from "./horario-funcionamento.service.js";

function paraResposta(janelas: readonly JanelaFuncionamento[]): GradeFuncionamentoDto {
  return {
    janelas: janelas.map((j) => ({ diaSemana: j.diaSemana, horaInicio: j.horaInicio, horaFim: j.horaFim })),
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroClinica && erro.motivo === "CLINICA_NAO_CONFIGURADA") {
    throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
  }
  throw erro;
}

@ApiTags("Configuração da Clínica")
@Controller("horario-funcionamento")
@UseFilters(FiltroErroClinica)
export class HorarioFuncionamentoController {
  constructor(private readonly horarios: HorarioFuncionamentoService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("clinica.configurar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta a grade semanal de funcionamento da clínica (CFG-002).",
    description:
      "Exige clinica.configurar. Método seguro, sem CSRF e sem auditoria. Grade vazia retorna lista vazia (D-CFG-21).",
  })
  @ApiResponse({ status: 200, description: "Grade semanal vigente.", type: GradeFuncionamentoDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroClinicaDto })
  @ApiResponse({ status: 403, description: "Sem a permissão clinica.configurar.", type: ErroClinicaDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroClinicaDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroClinicaDto })
  async consultar(): Promise<GradeFuncionamentoDto> {
    try {
      return paraResposta(await this.horarios.consultar());
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("clinica.configurar")
  // Abaixo de @RequerPermissao: a CSRF roda ANTES da sessão e da permissão
  // (mesma ordem de `ClinicaController`).
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader({
    name: CABECALHO_REQUISICAO_TLF,
    required: true,
    description:
      "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer valor não vazio.",
  })
  @ApiOperation({
    summary: "Substitui a grade semanal de funcionamento da clínica (CFG-002).",
    description:
      "Exige clinica.configurar. Corpo estrito { janelas }; até 4 janelas por dia, HH:MM, fim > início, " +
      "sem sobreposição nem adjacência. Alteração efetiva emite um configuracao.alterada (alvo clinica); " +
      "grade idêntica retorna 200 sem escrita e sem auditoria.",
  })
  @ApiResponse({ status: 200, description: "Grade vigente após a operação.", type: GradeFuncionamentoDto })
  @ApiResponse({ status: 400, description: "Payload inválido.", type: ErroClinicaDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroClinicaDto })
  @ApiResponse({
    status: 403,
    description: "Sem a permissão clinica.configurar ou falha na validação CSRF.",
    type: ErroClinicaDto,
  })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroClinicaDto })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroClinicaDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroClinicaDto })
  async substituir(
    @Body() corpo: GradeFuncionamentoDto,
    @UsuarioAutenticado() contexto: ContextoAutenticado,
  ): Promise<GradeFuncionamentoDto> {
    const validacao = validarCorpoGradeFuncionamento(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    try {
      const resultado = await this.horarios.substituir({
        atorUsuarioId: contexto.usuarioId,
        janelas: validacao.valor,
      });
      return paraResposta(resultado.janelas);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
