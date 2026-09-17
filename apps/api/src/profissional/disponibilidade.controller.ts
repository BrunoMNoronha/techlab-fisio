// TechLab Fisio — fronteira HTTP da disponibilidade do profissional
// (PRO-003; `docs/16` §4, D-PRO3-02, D-PRO3-08, D-PRO3-10).
//
//   - GET /profissionais/:profissionalId/disponibilidade — todas as versões;
//   - PUT /profissionais/:profissionalId/disponibilidade — nova versão a
//     partir de uma data civil.
//
// **Não existe `POST`, `PATCH` nem `DELETE` de disponibilidade** e não há
// edição linha a linha (D-PRO3-02).
//
// Ambas exigem `profissionais.gerenciar` (D-PRO3-08) — nenhuma permissão nova.
// O Fisioterapeuta NÃO consulta nem altera a própria disponibilidade por estas
// rotas, e não ganha exceção por ser o profissional correspondente. A agenda
// aplica a regra internamente (`VerificadorDisponibilidadeProfissional`) sem
// exigir a permissão do ator.
//
// `GET` é método seguro: sem CSRF e com `Cache-Control: no-store`. O `PUT` usa
// `ProtecaoCsrfGuard` declarada ABAIXO de `@RequerPermissao` (a CSRF roda antes
// da sessão), preservando a ordem já estabelecida no projeto. Sem paginação —
// o volume por profissional é pequeno. Profissional INATIVO pode ser
// consultado e alterado. **Sem auditoria** (D-PRO3-09). Erros normalizados
// para `{ erro }` por `FiltroErroProfissionais`.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
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
import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { ErroClinica } from "../clinica/clinica.service.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  DisponibilidadeRequisicaoDto,
  DisponibilidadeRespostaDto,
  ErroDisponibilidadeDto,
  ERRO_DISPONIBILIDADE,
  validarCorpoDisponibilidade,
} from "./disponibilidade.dto.js";
import {
  DisponibilidadeService,
  ErroDisponibilidade,
  type VersaoDisponibilidadeProfissional,
} from "./disponibilidade.service.js";
import { FiltroErroProfissionais } from "./erro-profissionais.filter.js";
import { ERRO_PROFISSIONAL } from "./profissionais.dto.js";
import { ErroProfissional } from "./profissionais.service.js";

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

function paraResposta(versoes: readonly VersaoDisponibilidadeProfissional[]): DisponibilidadeRespostaDto {
  return {
    versoes: versoes.map((v) => ({
      vigenciaInicio: v.vigenciaInicio,
      vigenciaFim: v.vigenciaFim,
      janelas: v.janelas.map((j) => ({ diaSemana: j.diaSemana, horaInicio: j.horaInicio, horaFim: j.horaFim })),
    })),
  };
}

function traduzirErro(erro: unknown): never {
  if (erro instanceof ErroProfissional && erro.motivo === "PROFISSIONAL_NAO_ENCONTRADO") {
    throw new NotFoundException({ erro: ERRO_PROFISSIONAL.PROFISSIONAL_NAO_ENCONTRADO });
  }
  if (erro instanceof ErroClinica) {
    throw new NotFoundException({ erro: ERRO_CLINICA.CLINICA_NAO_CONFIGURADA });
  }
  if (erro instanceof ErroDisponibilidade) {
    throw new UnprocessableEntityException({ erro: ERRO_DISPONIBILIDADE.VIGENCIA_RETROATIVA });
  }
  throw erro;
}

function exigirProfissionalId(profissionalId: string): void {
  if (!ehUuidValido(profissionalId)) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
}

@ApiTags("Profissionais")
@Controller("profissionais")
@UseFilters(FiltroErroProfissionais)
export class DisponibilidadeController {
  constructor(private readonly disponibilidade: DisponibilidadeService) {}

  @Get(":profissionalId/disponibilidade")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("profissionais.gerenciar")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta a disponibilidade versionada de um profissional (PRO-003).",
    description:
      "Exige profissionais.gerenciar. Devolve TODAS as versões, ordenadas por vigenciaInicio decrescente; " +
      "janelas por dia, início e fim. vigenciaFim é null na versão aberta. Profissional inativo pode ser consultado. " +
      "Lista vazia significa SEM disponibilidade definida — nunca 'sempre disponível'. " +
      "Sem paginação, sem CSRF e sem auditoria.",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Versões da disponibilidade.", type: DisponibilidadeRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador malformado.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 403, description: "Sem a permissão profissionais.gerenciar.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 404, description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO).", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroDisponibilidadeDto })
  async consultar(@Param("profissionalId") profissionalId: string): Promise<DisponibilidadeRespostaDto> {
    exigirProfissionalId(profissionalId);
    try {
      return paraResposta(await this.disponibilidade.consultar(profissionalId));
    } catch (erro) {
      traduzirErro(erro);
    }
  }

  @Put(":profissionalId/disponibilidade")
  @HttpCode(HttpStatus.OK)
  @RequerPermissao("profissionais.gerenciar")
  @UseGuards(ProtecaoCsrfGuard)
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiHeader(CABECALHO_CSRF)
  @ApiOperation({
    summary: "Define a disponibilidade do profissional a partir de uma data (PRO-003).",
    description:
      "Exige profissionais.gerenciar. Corpo exato { vigenciaInicio, janelas }. vigenciaInicio é data civil do fuso da clínica " +
      "e nunca pode ser anterior a hoje (422 VIGENCIA_RETROATIVA). Versões com vigenciaInicio >= a data são substituídas; " +
      "a versão anterior que abrange a data é encerrada na véspera; janelas vazias encerram sem criar nova versão. " +
      "Pedido idêntico ao estado vigente retorna 200 sem escrita. As janelas NÃO são confrontadas com o horário de " +
      "funcionamento da clínica (camadas independentes). Agendamentos existentes NÃO são consultados nem alterados. " +
      "Permitido para profissional inativo. Sem auditoria (D-PRO3-09). A resposta é o estado completo após a operação.",
  })
  @ApiParam(PARAMETRO_PROFISSIONAL_ID)
  @ApiResponse({ status: 200, description: "Estado completo após a operação.", type: DisponibilidadeRespostaDto })
  @ApiResponse({ status: 400, description: "Identificador ou payload inválidos.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 401, description: "Sessão ausente ou inválida.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 403, description: "Sem a permissão profissionais.gerenciar ou falha na validação CSRF.", type: ErroDisponibilidadeDto })
  @ApiResponse({
    status: 404,
    description: "Profissional inexistente (PROFISSIONAL_NAO_ENCONTRADO) ou clínica não configurada (CLINICA_NAO_CONFIGURADA).",
    type: ErroDisponibilidadeDto,
  })
  @ApiResponse({ status: 413, description: "Corpo de requisição acima do limite permitido.", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 422, description: "Vigência anterior a hoje no fuso da clínica (VIGENCIA_RETROATIVA).", type: ErroDisponibilidadeDto })
  @ApiResponse({ status: 500, description: "Falha técnica inesperada.", type: ErroDisponibilidadeDto })
  async substituir(
    @Param("profissionalId") profissionalId: string,
    @Body() corpo: DisponibilidadeRequisicaoDto,
  ): Promise<DisponibilidadeRespostaDto> {
    exigirProfissionalId(profissionalId);
    const validacao = validarCorpoDisponibilidade(corpo);
    if (!validacao.valido) throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    try {
      return paraResposta((await this.disponibilidade.substituir(profissionalId, validacao.valor)).versoes);
    } catch (erro) {
      traduzirErro(erro);
    }
  }
}
