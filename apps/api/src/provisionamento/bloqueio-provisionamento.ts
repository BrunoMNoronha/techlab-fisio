// TechLab Fisio — serialização das operações de provisionamento
// (Etapa 2.3D-B / F5 — fatia corretiva).
//
// POR QUE ESTE ARQUIVO EXISTE. As duas revisões técnicas independentes
// reproduziram, contra PostgreSQL real, a corrida abaixo:
//
//   Tx A: SELECT ... FROM usuario_papel WHERE papel_id = <admin>   -> vazio
//   Tx B: SELECT ... FROM usuario_papel WHERE papel_id = <admin>   -> vazio
//   Tx A: cria usuário A + vínculo + evento                        -> COMMIT
//   Tx B: cria usuário B + vínculo + evento                        -> COMMIT
//
// Resultado medido: DOIS "primeiros Administradores", ambos com saída 0.
//
// A causa é estrutural, não um descuido pontual:
//   - o isolamento efetivo é `READ COMMITTED` (medido: `SHOW
//     default_transaction_isolation`), sob o qual duas transações observam
//     legitimamente o mesmo estado "não existe Administrador";
//   - a leitura decisória é um `SELECT` puro — não há linha a bloquear,
//     porque a decisão depende da AUSÊNCIA de linhas, e `SELECT ... FOR
//     UPDATE` não bloqueia linhas inexistentes (não há predicate locking em
//     `READ COMMITTED`);
//   - a PK de `usuario_papel` é `(usuario_id, papel_id)`: identidades
//     DIFERENTES não colidem por unicidade, de modo que tratar `P2002` jamais
//     resolveria o caso — e é exatamente o caso perigoso.
//
// POR QUE ADVISORY LOCK, e não as alternativas:
//
//   `SELECT ... FOR UPDATE` na linha de `papel` ... FUNCIONA para o bootstrap
//       (a linha canônica do papel existe e serve de ponto de rendez-vous),
//       mas NÃO serve ao seed, cuja seção crítica inclui a CRIAÇÃO dessa
//       mesma linha — no primeiro seed ela ainda não existe.
//   `SERIALIZABLE` + retry ....... resolveria, mas espalharia laço de retry
//       por toda a fronteira transacional única da aplicação
//       (`DatabaseService.transacao`), que é compartilhada com fluxos alheios
//       a esta fatia. Ampliação de superfície desproporcional.
//   índice único parcial ......... exigiria MIGRATION. A F5 não reabre a
//       persistência (`docs/12` §7.4), e o enunciado da fatia corretiva pede
//       explicitamente evitá-la.
//
// O advisory lock TRANSACIONAL (`pg_advisory_xact_lock`) é liberado
// automaticamente no COMMIT ou no ROLLBACK — inclusive em queda de conexão ou
// término abrupto do processo. Não existe caminho em que ele vaze e trave o
// provisionamento permanentemente.
//
// UM ÚNICO LOCK PARA TODO O DOMÍNIO — e por quê: com um só lock não existe
// ORDEM de aquisição a definir e, portanto, não existe deadlock possível
// entre as operações desta fatia. `seed`, `bootstrap-admin` e as duas
// combinadas por `provisionar` serializam entre si. `provisionar` executa as
// duas operações em transações SEPARADAS e sequenciais, jamais aninhadas —
// logo nenhuma transação tenta adquirir o lock duas vezes.
//
// A CHAVE é fixa, documentada e estável entre versões: o par de `int4`
// `(2337, 5)` — 2337 identifica a Etapa "2.3D" e 5 a fatia "F5". Advisory
// locks vivem em um espaço de nomes próprio do PostgreSQL, por banco de
// dados; nenhum objeto do schema é tocado e nada é persistido.

import type { TransacaoPersistencia } from "@techlab-fisio/database";

/** Chave alta do advisory lock — Etapa 2.3D. Estável por contrato. */
const CHAVE_ETAPA = 2337;
/** Chave baixa do advisory lock — fatia F5. Estável por contrato. */
const CHAVE_FATIA = 5;

/**
 * Adquire, na transação recebida, o lock exclusivo do provisionamento.
 *
 * DEVE ser a PRIMEIRA operação da transação, ANTES de qualquer leitura
 * decisória: um lock adquirido depois da leitura não fecha a janela TOCTOU —
 * apenas a estreita. Toda leitura que sustente uma decisão precisa acontecer
 * DEPOIS desta chamada.
 *
 * Bloqueia até que a transação concorrente termine (commit ou rollback). Não
 * há timeout próprio: o `statement_timeout`/`lock_timeout` do banco continua
 * sendo a política de última instância, e nenhuma delas é alterada aqui.
 */
export async function bloquearProvisionamento(
  tx: TransacaoPersistencia,
): Promise<void> {
  // `$executeRaw`, e não `$queryRaw`, por um motivo MEDIDO: o retorno de
  // `pg_advisory_xact_lock` é do tipo `void`, e o desserializador do Prisma
  // rejeita essa coluna ("Failed to deserialize column of type 'void'").
  // `$executeRaw` não desserializa colunas — devolve apenas a contagem de
  // linhas —, o que é exatamente o que se precisa aqui.
  //
  // A EFETIVIDADE do lock não depende deste comentário: se ele deixasse de
  // ser adquirido, os cenários concorrentes de
  // `provisionamento-rbac.integration.spec.ts` e
  // `provisionamento-cli.integration.spec.ts` voltariam a medir dois
  // Administradores e falhariam.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAVE_ETAPA}::int4, ${CHAVE_FATIA}::int4)`;
}

/** Chaves expostas apenas para prova em teste — não são configuráveis. */
export const CHAVES_BLOQUEIO_PROVISIONAMENTO = Object.freeze({
  etapa: CHAVE_ETAPA,
  fatia: CHAVE_FATIA,
});
