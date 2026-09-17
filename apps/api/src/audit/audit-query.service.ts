// TechLab Fisio — consulta paginada da trilha de auditoria (AUD-004 /
// `PBACK-AUD-08`, `docs/09` §13.9).
//
// Leitura pura de `evento_auditoria`: `select` explícito das colunas próprias,
// SEM `include`, SEM relação (`ator`) e SEM qualquer tabela de domínio — o par
// `alvo_tipo` + `alvo_id` nunca é resolvido. `justificativa` não é lida
// (omitida por decisão de 17/09/2026 — `docs/10` §7.6.1). Não depende do `AuditWriter`:
// consultar a trilha não emite evento (`auditoria.consultada` não existe).
//
// Paginação keyset sobre (ocorrido_em DESC, id DESC): o `id` desempata
// instantes iguais, de modo que nenhuma linha se perde nem se repete entre
// páginas. Busca `limite + 1` linhas para saber se há próxima página.
//
// Premissa de precisão: o `AuditWriter` grava `ocorrido_em` a partir de `Date`
// (milissegundos), portanto o cursor (também em milissegundos) é exato.

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import {
  serializarCursor,
  type EventoAuditoriaDto,
  type FiltrosConsultaAuditoria,
  type PaginaEventosAuditoriaDto,
} from "./audit-query.dto.js";
import type { ValorContexto } from "./audit.types.js";

/** Colunas devolvidas — exatamente as de `EventoAuditoriaDto`. */
export const COLUNAS_CONSULTA_AUDITORIA = Object.freeze({
  id: true,
  ocorridoEm: true,
  atorUsuarioId: true,
  acao: true,
  alvoTipo: true,
  alvoId: true,
  resultado: true,
  correlacaoId: true,
  contexto: true,
} as const);

@Injectable()
export class AuditQueryService {
  constructor(private readonly database: DatabaseService) {}

  async consultar(filtros: FiltrosConsultaAuditoria): Promise<PaginaEventosAuditoriaDto> {
    const e: Record<string, unknown>[] = [];
    if (filtros.ocorridoDe !== undefined) e.push({ ocorridoEm: { gte: filtros.ocorridoDe } });
    if (filtros.ocorridoAte !== undefined) e.push({ ocorridoEm: { lte: filtros.ocorridoAte } });
    if (filtros.atorUsuarioId !== undefined) e.push({ atorUsuarioId: filtros.atorUsuarioId });
    if (filtros.acao !== undefined) e.push({ acao: filtros.acao });
    if (filtros.alvoTipo !== undefined) e.push({ alvoTipo: filtros.alvoTipo });
    if (filtros.alvoId !== undefined) e.push({ alvoId: filtros.alvoId });
    if (filtros.correlacaoId !== undefined) e.push({ correlacaoId: filtros.correlacaoId });
    if (filtros.resultado !== undefined) e.push({ resultado: filtros.resultado });
    if (filtros.cursor !== undefined) {
      const { ocorridoEm, id } = filtros.cursor;
      e.push({ OR: [{ ocorridoEm: { lt: ocorridoEm } }, { ocorridoEm, id: { lt: id } }] });
    }

    const linhas = await this.database.transacao((tx) =>
      tx.eventoAuditoria.findMany({
        where: { AND: e },
        orderBy: [{ ocorridoEm: "desc" }, { id: "desc" }],
        take: filtros.limite + 1,
        select: COLUNAS_CONSULTA_AUDITORIA,
      }),
    );

    const pagina = linhas.slice(0, filtros.limite);
    const ultimo = pagina[pagina.length - 1];
    const proximoCursor =
      linhas.length > filtros.limite && ultimo !== undefined
        ? serializarCursor({ ocorridoEm: ultimo.ocorridoEm, id: ultimo.id })
        : null;

    const itens: EventoAuditoriaDto[] = pagina.map((linha) => ({
      id: linha.id,
      ocorridoEm: linha.ocorridoEm.toISOString(),
      atorUsuarioId: linha.atorUsuarioId,
      acao: linha.acao,
      alvoTipo: linha.alvoTipo,
      alvoId: linha.alvoId,
      resultado: linha.resultado,
      correlacaoId: linha.correlacaoId,
      contexto: (linha.contexto ?? null) as Readonly<Record<string, ValorContexto>> | null,
    }));

    return { itens, proximoCursor };
  }
}
