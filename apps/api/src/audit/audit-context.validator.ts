// TechLab Fisio — validação fail-closed de ação/contexto de auditoria
// (P-BACK-01; D-AUD-07/D-AUD-08, docs/09 §12.6/§12.7).
//
// Comportamento obrigatório (docs/09 §12 + enunciado da Etapa 2.3A §12):
//   1. ação desconhecida            → rejeição explícita;
//   2. chave fora da whitelist      → rejeição explícita;
//   3. contexto não vazio em ação
//      de whitelist vazia           → rejeição explícita;
//   4. NENHUMA sanitização silenciosa — o validator nunca remove campo,
//      nunca devolve cópia filtrada, nunca prossegue após encontrar
//      irregularidade: ou o contexto candidato é aceito EXATAMENTE como
//      está, ou a operação inteira é rejeitada com erro;
//   5. valores aceitos são exclusivamente escalares JSON VÁLIDOS — objetos e
//      arrays são rejeitados (impossível serializar um DTO/request inteiro
//      dentro de uma chave permitida) e números só são aceitos quando FINITOS:
//      NaN e ±Infinity não existem em JSON e seriam silenciosamente
//      serializados como null na coluna jsonb, o que violaria a proibição de
//      sanitização silenciosa;
//   6. mensagens de erro citam AÇÃO e NOMES de chave, nunca VALORES — um
//      valor recusado pode conter dado sensível e não deve vazar em log.
//
// O ownership desta regra é da APLICAÇÃO (D-AUD-08): nada disto é replicado
// em trigger, CHECK, JSON Schema de banco ou `packages/database`.

import { Injectable } from "@nestjs/common";

import { WHITELIST_CONTEXTO, ehAcaoAuditoria } from "./audit.catalog.js";
import type { AcaoAuditoria } from "./audit.catalog.js";
import type { ContextoCandidato, ValorContexto } from "./audit.types.js";

/** Motivos de rejeição, um por regra violada — estáveis para teste e log. */
export type MotivoRejeicaoContexto =
  | "ACAO_DESCONHECIDA"
  | "CONTEXTO_NAO_OBJETO"
  | "CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA"
  | "CHAVE_FORA_DA_WHITELIST"
  | "VALOR_NAO_ESCALAR";

export class ErroContextoAuditoria extends Error {
  override readonly name = "ErroContextoAuditoria";

  constructor(
    readonly motivo: MotivoRejeicaoContexto,
    readonly acao: string,
    /** Nomes das chaves ofensoras (nunca valores). */
    readonly chaves: readonly string[],
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function rejeitar(
  motivo: MotivoRejeicaoContexto,
  acao: string,
  chaves: readonly string[],
  detalhe: string,
): never {
  const sufixoChaves = chaves.length > 0 ? ` Chaves: ${chaves.join(", ")}.` : "";
  throw new ErroContextoAuditoria(
    motivo,
    acao,
    chaves,
    `Contexto de auditoria rejeitado (${motivo}) para a ação "${acao}": ${detalhe}${sufixoChaves}`,
  );
}

function ehEscalarJson(valor: unknown): valor is ValorContexto {
  return (
    valor === null ||
    typeof valor === "string" ||
    (typeof valor === "number" && Number.isFinite(valor)) ||
    typeof valor === "boolean"
  );
}

@Injectable()
export class AuditContextValidator {
  /**
   * Valida o par ação/contexto contra o catálogo homologado. Fail-closed:
   * retorna a ação tipada quando TUDO é permitido; lança
   * `ErroContextoAuditoria` em qualquer outra hipótese. Nunca altera nem
   * copia o contexto — não existe "contexto saneado" como saída.
   *
   * `contexto` ausente (`undefined`) equivale ao contexto vazio, que é
   * permitido para todas as ações do catálogo (a coluna física tem default
   * `{}`; a whitelist limita o que pode EXISTIR, não obriga presença).
   */
  validar(acao: string, contexto?: ContextoCandidato): AcaoAuditoria {
    if (!ehAcaoAuditoria(acao)) {
      rejeitar(
        "ACAO_DESCONHECIDA",
        acao,
        [],
        "a ação não pertence ao catálogo homologado por D-AUD-01 (docs/09 §12.2).",
      );
    }

    if (contexto === undefined) {
      return acao;
    }

    if (
      typeof contexto !== "object" ||
      contexto === null ||
      Array.isArray(contexto)
    ) {
      rejeitar(
        "CONTEXTO_NAO_OBJETO",
        acao,
        [],
        "o contexto, quando presente, deve ser um objeto plano de chaves nomeadas.",
      );
    }

    const chaves = Object.keys(contexto);
    if (chaves.length === 0) {
      return acao;
    }

    const permitidas: readonly string[] = WHITELIST_CONTEXTO[acao];

    if (permitidas.length === 0) {
      rejeitar(
        "CONTEXTO_NAO_VAZIO_EM_WHITELIST_VAZIA",
        acao,
        chaves,
        "a whitelist homologada desta ação é VAZIA (D-AUD-07); nenhum contexto não vazio é admitido.",
      );
    }

    const foraDaWhitelist = chaves.filter((c) => !permitidas.includes(c));
    if (foraDaWhitelist.length > 0) {
      // A operação INTEIRA é rejeitada — inclusive as chaves válidas que a
      // acompanham. Filtrar e prosseguir seria sanitização silenciosa.
      rejeitar(
        "CHAVE_FORA_DA_WHITELIST",
        acao,
        foraDaWhitelist,
        "há chave não homologada pela whitelist de D-AUD-07 (docs/09 §12.6).",
      );
    }

    const naoEscalares = chaves.filter((c) => !ehEscalarJson(contexto[c]));
    if (naoEscalares.length > 0) {
      rejeitar(
        "VALOR_NAO_ESCALAR",
        acao,
        naoEscalares,
        "valores de contexto devem ser escalares JSON válidos (string, número finito, boolean ou null); objetos, arrays e números não finitos são rejeitados para impedir serialização genérica de DTO/request e valores sem representação em JSON.",
      );
    }

    return acao;
  }
}
