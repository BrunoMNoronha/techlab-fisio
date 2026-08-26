// TechLab Fisio — tipos do domínio de auditoria da aplicação
// (P-BACK-01; fonte normativa: docs/09 §12 — D-AUD-02, D-AUD-03).

/**
 * Catálogo homologado de `resultado` (D-AUD-02, docs/09 §12.3).
 *
 * É catálogo TIPADO DA APLICAÇÃO: nenhum enum SQL existe nem deve ser criado
 * para ele — a coluna física permanece como está (a persistência da Fase 2
 * está encerrada).
 */
export const RESULTADOS_AUDITORIA = ["SUCESSO", "NEGADO", "FALHA"] as const;

export type ResultadoAuditoria = (typeof RESULTADOS_AUDITORIA)[number];

/**
 * `alvo_tipo` (D-AUD-03, docs/09 §12.4) — nome físico da tabela do alvo do
 * evento, registrado como METADADO HISTÓRICO. Regras homologadas que este
 * tipo representa (e que nenhum código pode contornar):
 *
 *   (a) é metadado histórico do evento;
 *   (b) NÃO autoriza despacho dinâmico de SQL a partir do valor;
 *   (c) NÃO concede acesso ao alvo;
 *   (d) rename físico futuro NÃO reescreve eventos antigos — cada evento
 *       preserva o nome vigente à época do registro.
 *
 * Por isso o tipo é uma string documentada, não um enum: o conjunto de nomes
 * físicos pertence ao schema encerrado e não é duplicado aqui; nenhum
 * mecanismo de resolução dinâmica é construído sobre ele.
 */
export type AlvoTipo = string;

/**
 * Valor admissível em uma chave de `contexto` já permitida pela whitelist:
 * exclusivamente escalares JSON. Objetos e arrays são rejeitados pelo
 * validator — é a barreira estrutural contra serialização genérica de
 * DTO/request em `contexto` (D-AUD-07/D-AUD-08; proibições F-04).
 */
export type ValorContexto = string | number | boolean | null;

/** Contexto candidato, antes da validação fail-closed. */
export type ContextoCandidato = Readonly<Record<string, unknown>>;
