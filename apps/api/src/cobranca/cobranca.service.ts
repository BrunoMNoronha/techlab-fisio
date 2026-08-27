// TechLab Fisio — fluxo interno `cobranca.desconto_aplicado`
// (Etapa 2.3C; FIN-003, RN-042/043/045/046, PROP-RN-2.3C-01 — registro em
// docs/11; auditoria por D-AUD-01/D-AUD-07 — docs/09 §12).
//
// FATIA TÉCNICA INTERNA: NÃO existe controller, endpoint ou rota; a operação
// é exercitada exclusivamente por testes. Nenhum RBAC global/decorator/guard
// é criado — a autorização é provada AQUI, no backend, contra o modelo real
// `Usuario → UsuarioPapel → Papel → PapelPermissao → Permissao` (RN-002).
//
// CONTRATO NORMATIVO (PROP-RN-2.3C-01):
//   - FIN-003 é exclusivamente operação de AUMENTO do desconto (reduzir o
//     valor devido); redução é rejeitada — nenhuma funcionalidade de
//     revogação de desconto nasce silenciosamente aqui;
//   - repetir exatamente o desconto vigente é NO-OP: nenhuma mutação e
//     nenhum evento de auditoria (não é erro);
//   - cobrança com `cancelada_em IS NOT NULL` rejeita a alteração;
//   - invariantes: `valor_desconto_novo >= 0` e
//     `valor_bruto - valor_desconto_novo >= 0` (RN-042; CHECK físico como
//     retaguarda) e, sob o lock, `recebido_liquido <= valor_liquido_novo`
//     (extensão homologada do racional de RN-046);
//   - pagamentos e estornos já registrados permanecem intocados (RN-044);
//   - a situação da cobrança segue exclusivamente DERIVADA (RN-045) — nada
//     aqui escreve situação.
//
// DINHEIRO SEM FLOAT: o valor novo entra como STRING DECIMAL CANÔNICA
// (exatamente duas casas, sem sinal, compatível com `numeric(12,2)`); os
// valores lidos do banco chegam como `::text` do próprio PostgreSQL; toda
// comparação usa CENTAVOS em BigInt. Nenhum float/double participa de
// cálculo ou do `contexto` do evento.
//
// CONCORRÊNCIA: Cobrança é aggregate root (H2-06) e o desconto altera o
// limite contra o qual pagamentos são aceitos. A operação serializa no MESMO
// ponto dos fluxos financeiros T-03/T-04/T-05 (`docs/07` §17.3): lock da
// linha `cobranca` (`SELECT ... FOR UPDATE`) antes de qualquer decisão.
// Estado, recebido líquido e o par anterior/novo auditado são todos
// determinados SOB o lock — o par reflete sempre a ordem efetivamente
// serializada. A mutação permanece condicional (defesa em profundidade).
//
// PROPRIEDADE TRANSACIONAL: mutação + evento `cobranca.desconto_aplicado` =
// UMA transação. Contexto do evento é exatamente o par homologado
// `valor_desconto_anterior`/`valor_desconto_novo` (whitelist POSITIVA de
// D-AUD-07), ambos como string decimal canônica. Falha do validator, do
// AuditWriter ou da mutação → ROLLBACK integral.

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";

/** Código de catálogo da permissão exigida por FIN-003/RN-043 (docs/04 §5). */
export const PERMISSAO_APLICAR_DESCONTO = "financeiro.desconto.aplicar";

/**
 * Forma canônica de valor monetário na fronteira desta operação: dígitos,
 * ponto, exatamente duas casas; sem sinal, sem zeros à esquerda, até 10
 * dígitos inteiros — o espaço exato de `numeric(12,2)` não negativo.
 * Qualquer outra representação (float, notação científica, vírgula, casas a
 * mais/menos) é rejeitada ANTES de qualquer acesso ao banco.
 */
const FORMATO_DECIMAL_CANONICO = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;

/** Converte string decimal canônica em centavos (inteiro exato — sem float). */
function centavos(valorCanonico: string): bigint {
  const [inteiro, fracao] = valorCanonico.split(".") as [string, string];
  return BigInt(inteiro) * 100n + BigInt(fracao);
}

export type MotivoRejeicaoDescontoCobranca =
  | "VALOR_DESCONTO_INVALIDO"
  | "ATOR_INEXISTENTE"
  | "ATOR_INATIVO"
  | "ATOR_SEM_PERMISSAO"
  | "COBRANCA_INEXISTENTE"
  | "COBRANCA_CANCELADA"
  | "REDUCAO_DE_DESCONTO_NAO_PERMITIDA"
  | "DESCONTO_EXCEDE_VALOR_BRUTO"
  | "RECEBIDO_EXCEDE_NOVO_LIQUIDO"
  | "MUTACAO_NAO_EFETIVADA";

export class ErroDescontoCobranca extends Error {
  override readonly name = "ErroDescontoCobranca";

  constructor(readonly motivo: MotivoRejeicaoDescontoCobranca) {
    // Mensagem estável, sem ecoar valores monetários ou identificadores.
    super(`Aplicação de desconto rejeitada: ${motivo}.`);
  }
}

export interface ComandoAplicarDescontoCobranca {
  readonly cobrancaId: string;
  /** Ator — validado como existente, ativo E portador da permissão. */
  readonly atorUsuarioId: string;
  /** Novo desconto TOTAL da cobrança, string decimal canônica ("25.00"). */
  readonly valorDescontoNovo: string;
}

export interface ResultadoAplicarDescontoCobranca {
  readonly cobrancaId: string;
  /** Desconto vigente no instante serializado (string canônica do banco). */
  readonly valorDescontoAnterior: string;
  readonly valorDescontoNovo: string;
  /** `false` = no-op (novo desconto idêntico ao vigente; nada persistido). */
  readonly mutado: boolean;
  /** Correlação do evento persistido; `null` no no-op (não há evento). */
  readonly correlacaoId: string | null;
}

/** Linha da cobrança lida SOB lock (valores como texto do PostgreSQL). */
interface LinhaCobrancaSobLock {
  valor_bruto: string;
  valor_desconto: string;
  cancelada: boolean;
}

@Injectable()
export class CobrancaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Operação INTERNA FIN-003: aumento auditado do desconto de uma cobrança,
   * atômico com o evento `cobranca.desconto_aplicado` (whitelist positiva).
   */
  async aplicarDesconto(
    comando: ComandoAplicarDescontoCobranca,
  ): Promise<ResultadoAplicarDescontoCobranca> {
    const novo = comando.valorDescontoNovo;
    if (typeof novo !== "string" || !FORMATO_DECIMAL_CANONICO.test(novo)) {
      // Cobre negativo, casas erradas, vírgula, notação científica, NaN,
      // Infinity, number serializado etc. — nada disso chega ao banco.
      throw new ErroDescontoCobranca("VALOR_DESCONTO_INVALIDO");
    }
    const novoCentavos = centavos(novo);

    // Uma correlação por OPERAÇÃO efetiva.
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      // 1. Ator: existente e ativo (integridade — RN-061)...
      const ator = await tx.usuario.findUnique({
        where: { id: comando.atorUsuarioId },
        select: { ativo: true },
      });
      if (ator === null) {
        throw new ErroDescontoCobranca("ATOR_INEXISTENTE");
      }
      if (!ator.ativo) {
        throw new ErroDescontoCobranca("ATOR_INATIVO");
      }

      // 2. ...e AUTORIZADO (RN-043): a permissão é provada pela cadeia real
      // Usuario → UsuarioPapel → Papel → PapelPermissao → Permissao. Nenhum
      // atalho: método interno NÃO dispensa autorização (RN-002).
      const vinculoComPermissao = await tx.usuarioPapel.findFirst({
        where: {
          usuarioId: comando.atorUsuarioId,
          papel: {
            permissoes: {
              some: { permissao: { codigo: PERMISSAO_APLICAR_DESCONTO } },
            },
          },
        },
        select: { papelId: true },
      });
      if (vinculoComPermissao === null) {
        throw new ErroDescontoCobranca("ATOR_SEM_PERMISSAO");
      }

      // 3. Serialização da aggregate root: lock da linha `cobranca` — o MESMO
      // ponto de serialização dos fluxos financeiros T-03/T-04/T-05
      // (docs/07 §17.3). Todo o estado decisório é lido SOB o lock.
      const linhas = await tx.$queryRaw<LinhaCobrancaSobLock[]>`
        SELECT valor_bruto::text            AS valor_bruto,
               valor_desconto::text         AS valor_desconto,
               (cancelada_em IS NOT NULL)   AS cancelada
        FROM cobranca
        WHERE id = ${comando.cobrancaId}::uuid
        FOR UPDATE
      `;
      const cobranca = linhas[0];
      if (cobranca === undefined) {
        throw new ErroDescontoCobranca("COBRANCA_INEXISTENTE");
      }
      if (cobranca.cancelada) {
        throw new ErroDescontoCobranca("COBRANCA_CANCELADA");
      }

      const anterior = cobranca.valor_desconto;
      const anteriorCentavos = centavos(anterior);
      const brutoCentavos = centavos(cobranca.valor_bruto);

      // 4. PROP-RN-2.3C-01: igualdade é NO-OP (sem mutação, sem evento);
      // redução não pertence a FIN-003.
      if (novoCentavos === anteriorCentavos) {
        return {
          cobrancaId: comando.cobrancaId,
          valorDescontoAnterior: anterior,
          valorDescontoNovo: novo,
          mutado: false,
          correlacaoId: null,
        };
      }
      if (novoCentavos < anteriorCentavos) {
        throw new ErroDescontoCobranca("REDUCAO_DE_DESCONTO_NAO_PERMITIDA");
      }

      // 5. RN-042: líquido novo não pode ser negativo (o CHECK físico é a
      // retaguarda que não depende de disciplina de código).
      if (novoCentavos > brutoCentavos) {
        throw new ErroDescontoCobranca("DESCONTO_EXCEDE_VALOR_BRUTO");
      }
      const liquidoNovoCentavos = brutoCentavos - novoCentavos;

      // 6. Invariante de PROP-RN-2.3C-01 (racional de RN-046), avaliada SOB o
      // lock: o recebimento líquido efetivo nunca pode exceder o novo líquido.
      const somaRecebido = await tx.$queryRaw<Array<{ recebido: string }>>`
        SELECT COALESCE(SUM(p.valor), 0)::numeric(12,2)::text AS recebido
        FROM pagamento p
        WHERE p.cobranca_id = ${comando.cobrancaId}::uuid
          AND NOT EXISTS (
            SELECT 1 FROM estorno e WHERE e.pagamento_id = p.id
          )
      `;
      const recebido = somaRecebido[0]?.recebido ?? "0.00";
      if (centavos(recebido) > liquidoNovoCentavos) {
        throw new ErroDescontoCobranca("RECEBIDO_EXCEDE_NOVO_LIQUIDO");
      }

      // 7. Mutação CONDICIONAL (defesa em profundidade sob o lock): o
      // predicado repete o desconto anterior e a não-cancelada. `valor_liquido`
      // é coluna gerada — o banco a recalcula; nada a escreve aqui.
      const ocorridoEm = new Date();
      const mutacao = await tx.cobranca.updateMany({
        where: {
          id: comando.cobrancaId,
          canceladaEm: null,
          valorDesconto: anterior,
        },
        data: {
          valorDesconto: novo,
          descontoPorUsuarioId: comando.atorUsuarioId,
        },
      });
      if (mutacao.count !== 1) {
        // Sob o lock isto é inalcançável; se ocorrer, a operação inteira
        // falha ruidosamente (rollback) em vez de auditar um par falso.
        throw new ErroDescontoCobranca("MUTACAO_NAO_EFETIVADA");
      }

      // 8. Evento obrigatório — MESMA transação; contexto é EXATAMENTE o par
      // homologado, ambos string decimal canônica (nunca number).
      await this.auditWriter.registrar(tx, {
        acao: "cobranca.desconto_aplicado",
        ocorridoEm,
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: "cobranca",
        alvoId: comando.cobrancaId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
        contexto: {
          valor_desconto_anterior: anterior,
          valor_desconto_novo: novo,
        },
      });

      return {
        cobrancaId: comando.cobrancaId,
        valorDescontoAnterior: anterior,
        valorDescontoNovo: novo,
        mutado: true,
        correlacaoId,
      };
    });
  }
}
