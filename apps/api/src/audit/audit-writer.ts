// TechLab Fisio — escrita transacional de eventos de auditoria (Etapa 2.3B;
// P-BACK-01, docs/09 §12).
//
// Separação de responsabilidades mantida:
//   - AuditContextValidator = POLÍTICA (catálogo D-AUD-01, whitelist
//     fail-closed D-AUD-07/08) — decide o que PODE ser registrado;
//   - AuditWriter            = ESCRITA do evento já validado — decide COMO o
//     registro entra no banco, e nada além disso.
//
// Contrato vinculante do writer:
//   1. recebe o contexto TRANSACIONAL explicitamente (TransacaoPersistencia)
//      — o evento entra na MESMA transação da mutação de negócio; se o
//      writer falhar, a transação inteira sofre rollback;
//   2. executa o AuditContextValidator SEMPRE, antes de qualquer escrita;
//   3. mapeia campo a campo, explicitamente — nunca recebe Request/Response/
//      DTO genérico e nunca usa spread do candidato;
//   4. persiste somente CREATE — nenhuma API de update/delete existe aqui, e
//      a role de runtime nem possui esses privilégios (E-11);
//   5. não sanitiza nada silenciosamente (a rejeição do validator é
//      propagada como está);
//   6. nenhum VALOR de contexto aparece em mensagem de erro (garantia do
//      validator, preservada aqui).
//
// A verificação estrutural de que o objeto recebido é de fato um cliente
// TRANSACIONAL é defesa em profundidade; a prova real de atomicidade é a
// suíte de integração contra PostgreSQL (test/integration/).

import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { AuditContextValidator } from "./audit-context.validator.js";
import type {
  ContextoCandidato,
  ResultadoAuditoria,
  ValorContexto,
} from "./audit.types.js";

/**
 * Evento candidato — campos nomeados um a um (F-01 de docs/09 §2: ator,
 * ação, alvo, data/hora, resultado, justificativa quando obrigatória).
 * Nenhum campo é opcionalmente "extra": o que não está aqui não entra no
 * evento.
 */
export interface EventoAuditoriaCandidato {
  readonly acao: string;
  readonly ocorridoEm: Date;
  /** NULL somente em ação de sistema (RN-061). */
  readonly atorUsuarioId: string | null;
  /** Nome físico da tabela do alvo (D-AUD-03 — metadado histórico). */
  readonly alvoTipo: string;
  readonly alvoId: string | null;
  readonly resultado: ResultadoAuditoria;
  /** NULL quando a fonte não exige justificativa. */
  readonly justificativa: string | null;
  /** Gerado UMA vez por operação; compartilhado pelas linhas da transação. */
  readonly correlacaoId: string;
  /** Contexto candidato — validado fail-closed antes de persistir. */
  readonly contexto?: ContextoCandidato;
}

export class ErroEscritaAuditoria extends Error {
  override readonly name = "ErroEscritaAuditoria";
}

/** Defesa em profundidade: rejeita cliente NÃO transacional. Discriminador
 * medido no Prisma 7.9.1: o proxy transacional REMOVE `$connect`/`$disconnect`
 * (denylist do runtime), mas MANTÉM `$transaction` (transações aninhadas) —
 * por isso a checagem usa exclusivamente o par de conexão. */
function exigirClienteTransacional(tx: TransacaoPersistencia): void {
  const candidato = tx as { $connect?: unknown; $disconnect?: unknown };
  if (
    typeof candidato.$connect === "function" ||
    typeof candidato.$disconnect === "function"
  ) {
    throw new ErroEscritaAuditoria(
      "AuditWriter.registrar exige um cliente TRANSACIONAL: escrever auditoria " +
        "fora da transação da mutação quebraria a atomicidade obrigatória.",
    );
  }
}

@Injectable()
export class AuditWriter {
  constructor(private readonly validator: AuditContextValidator) {}

  /**
   * Valida e persiste UM evento de auditoria dentro da transação recebida.
   * Propaga qualquer rejeição do validator sem capturar nem atenuar — o
   * chamador (fronteira transacional) decide, e o rollback é do PostgreSQL.
   */
  async registrar(
    tx: TransacaoPersistencia,
    evento: EventoAuditoriaCandidato,
  ): Promise<void> {
    exigirClienteTransacional(tx);

    // Política primeiro, sempre — fail-closed (D-AUD-07/D-AUD-08).
    const acaoValidada = this.validator.validar(evento.acao, evento.contexto);

    // Mapeamento EXPLÍCITO campo a campo; somente CREATE. O contexto validado
    // contém apenas escalares JSON (garantia do validator) e entra como está;
    // ausente => coluna NULL.
    const dados: {
      ocorridoEm: Date;
      atorUsuarioId: string | null;
      acao: string;
      alvoTipo: string;
      alvoId: string | null;
      resultado: string;
      justificativa: string | null;
      correlacaoId: string;
      contexto?: Readonly<Record<string, ValorContexto>>;
    } = {
      ocorridoEm: evento.ocorridoEm,
      atorUsuarioId: evento.atorUsuarioId,
      acao: acaoValidada,
      alvoTipo: evento.alvoTipo,
      alvoId: evento.alvoId,
      resultado: evento.resultado,
      justificativa: evento.justificativa,
      correlacaoId: evento.correlacaoId,
    };
    if (evento.contexto !== undefined) {
      dados.contexto = evento.contexto as Readonly<Record<string, ValorContexto>>;
    }

    await tx.eventoAuditoria.create({ data: dados });
  }
}
