// TechLab Fisio — fronteira HTTP da consulta da trilha de auditoria (AUD-004 /
// `PBACK-AUD-08`, `docs/09` §13.9).
//
//   - GET /auditoria/eventos — somente leitura; nenhuma rota de alteração ou
//     exclusão de eventos existe (AUD-005);
//   - @RequerPermissao("auditoria.ler") — mecanismo RBAC vigente
//     (SessaoAutenticadaGuard + PermissoesGuard); nenhuma checagem por papel;
//   - SEM ProtecaoCsrfGuard: método seguro, sem corpo e sem efeito;
//   - Cache-Control: no-store — a trilha administrativa não deve ser cacheada;
//   - nenhum evento de auditoria é emitido pela consulta.

import { Controller, Get, Header, HttpCode, HttpStatus, Query } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { RequerPermissao } from "../authz/requer-permissao.decorator.js";
import { NOME_ESQUEMA_SESSAO } from "../openapi/documento-openapi.js";
import {
  ErroConsultaAuditoriaDto,
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  PaginaEventosAuditoriaDto,
  validarConsultaAuditoria,
} from "./audit-query.dto.js";
import { AuditQueryService } from "./audit-query.service.js";
import { ACOES_AUDITORIA } from "./audit.catalog.js";
import { RESULTADOS_AUDITORIA } from "./audit.types.js";

const INSTANTE =
  "Instante ISO-8601 com fuso explícito (`Z` ou `±HH:MM`), precisão máxima de milissegundo.";

@ApiTags("Auditoria")
@Controller("auditoria")
export class AuditController {
  constructor(private readonly consulta: AuditQueryService) {}

  @Get("eventos")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @RequerPermissao("auditoria.ler")
  @ApiCookieAuth(NOME_ESQUEMA_SESSAO)
  @ApiOperation({
    summary: "Consulta paginada da trilha de auditoria (AUD-004, PBACK-AUD-08).",
    description:
      "Exige a permissão auditoria.ler. Filtros fechados sobre colunas próprias de " +
      "evento_auditoria; qualquer outro parâmetro é 400. Sem busca textual, sem filtro por " +
      "contexto ou justificativa, sem resolução do alvo; justificativa não é devolvida. " +
      "Ordem ocorridoEm DESC, id DESC; " +
      "paginação por cursor opaco. A consulta não é auditada. Resposta com " +
      "Cache-Control: no-store.",
  })
  @ApiQuery({ name: "ocorridoDe", required: false, type: String, format: "date-time", description: `Início do período, inclusivo. ${INSTANTE}` })
  @ApiQuery({ name: "ocorridoAte", required: false, type: String, format: "date-time", description: `Fim do período, inclusivo. ${INSTANTE} Deve ser >= ocorridoDe.` })
  @ApiQuery({ name: "atorUsuarioId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "acao", required: false, enum: ACOES_AUDITORIA, description: "Ação do catálogo homologado; valor exato." })
  @ApiQuery({ name: "alvoTipo", required: false, type: String, description: "Nome físico da tabela do alvo; valor exato (`^[a-z][a-z0-9_]{0,62}$`)." })
  @ApiQuery({ name: "alvoId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "correlacaoId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "resultado", required: false, enum: RESULTADOS_AUDITORIA })
  @ApiQuery({
    name: "limite",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: LIMITE_MAXIMO, default: LIMITE_PADRAO },
    description: `Itens por página. Padrão ${LIMITE_PADRAO}; acima de ${LIMITE_MAXIMO} é 400.`,
  })
  @ApiQuery({ name: "cursor", required: false, type: String, description: "Valor de proximoCursor da página anterior, sem alteração." })
  @ApiResponse({ status: 200, description: "Página de eventos.", type: PaginaEventosAuditoriaDto })
  @ApiResponse({ status: 400, description: "Parâmetro desconhecido, repetido ou inválido; cursor adulterado.", type: ErroConsultaAuditoriaDto })
  @ApiResponse({ status: 401, description: "Sessão ausente, inválida, expirada ou revogada.", type: ErroConsultaAuditoriaDto })
  @ApiResponse({ status: 403, description: "Sessão válida sem a permissão auditoria.ler.", type: ErroConsultaAuditoriaDto })
  @ApiResponse({ status: 500, description: "Falha técnica.", type: ErroConsultaAuditoriaDto })
  async consultarEventos(@Query() query: unknown): Promise<PaginaEventosAuditoriaDto> {
    return this.consulta.consultar(validarConsultaAuditoria(query));
  }
}
