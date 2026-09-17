// TechLab Fisio — `GET /agenda/opcoes` (`docs/15` D-AGD-13).
//
// Rota SOMENTE LEITURA do módulo de agenda, sob `agenda.gerenciar`. Ela NÃO
// amplia as rotas administrativas: `/servicos`, `/motivos-cancelamento` e
// `/horario-funcionamento` continuam exigindo `clinica.configurar` e continuam
// devolvendo o que sempre devolveram, inclusive itens inativos e preço.
//
// Método seguro: sem CSRF, com `Cache-Control: no-store`, sem auditoria.

import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UseFilters,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import { AgendaOpcoesRespostaDto, ErroAgendamentoDto } from "./agenda.dto.js";
import { AgendaOpcoesService } from "./agenda-opcoes.service.js";
import { FiltroErroAgenda } from "./erro-agenda.filter.js";

@ApiTags("Agenda")
@Controller("agenda")
@UseFilters(FiltroErroAgenda)
export class AgendaOpcoesController {
  constructor(private readonly opcoes: AgendaOpcoesService) {}

  @Get("opcoes")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("agenda.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Catálogos necessários à operação da agenda (D-AGD-13).",
    description:
      "Exige agenda.gerenciar. Devolve somente serviços ATIVOS (sem preço de referência), " +
      "motivos de cancelamento ATIVOS, a grade de funcionamento vigente e o fuso da clínica. " +
      "Não amplia as rotas administrativas, que seguem sob clinica.configurar. " +
      "Sem CSRF e sem auditoria.",
  })
  @ApiResponse({ status: 200, description: "Opções vigentes.", type: AgendaOpcoesRespostaDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 403, description: "Sem a permissão agenda.gerenciar.", type: ErroAgendamentoDto })
  @ApiResponse({ status: 404, description: "Clínica ainda não provisionada (CLINICA_NAO_CONFIGURADA).", type: ErroAgendamentoDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroAgendamentoDto })
  async consultar(): Promise<AgendaOpcoesRespostaDto> {
    try {
      const opcoes = await this.opcoes.consultar();
      return {
        servicos: opcoes.servicos.map((s) => ({ id: s.id, nome: s.nome, duracaoMin: s.duracaoMin })),
        motivosCancelamento: opcoes.motivosCancelamento.map((m) => ({
          id: m.id,
          descricao: m.descricao,
        })),
        horarioFuncionamento: {
          janelas: opcoes.horarioFuncionamento.janelas.map((j) => ({
            diaSemana: j.diaSemana,
            horaInicio: j.horaInicio,
            horaFim: j.horaFim,
          })),
        },
        fusoHorario: opcoes.fusoHorario,
      };
    } catch (erro) {
      if (erro instanceof ErroClinica && erro.motivo === "CLINICA_NAO_CONFIGURADA") {
        throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
      }
      throw erro;
    }
  }
}
