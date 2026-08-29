// TechLab Fisio — catálogo tipado de permissões (Etapa 2.3D-B / F4).
//
// FONTE ÚNICA E EXAUSTIVA: `docs/04-perfis-permissoes.md` §5 — "Catálogo
// funcional de permissões sensíveis", homologado em 10/08/2026. Este arquivo
// é a materialização TIPADA daquele catálogo — ele NÃO decide nada, NÃO cria
// permissão e NÃO é catálogo paralelo. Mesmo precedente, mesma disciplina e
// mesma forma de `audit/audit.catalog.ts`, que materializa `docs/09` §12 sem
// decidir coisa alguma.
//
// `D-2.3D-09` (`docs/12` §5.9), literal: "os identificadores técnicos de
// permissão continuam sendo os nomes funcionais homologados em `docs/04` §5".
// A lista abaixo reproduz esses nomes na ORDEM DA FONTE, byte a byte.
//
// POR QUE ELE EXISTE — e o que ele impede: sem um conjunto fechado em tipo, um
// `@RequerPermissao("usuarios.gerenciarr")` compilaria, jamais casaria com
// nenhuma permissão persistida e produziria uma rota permanentemente negada —
// ou, pior, um erro de digitação em sentido contrário casaria com o código
// errado. Aqui o erro é de COMPILAÇÃO. O arquivo não substitui a persistência:
// a fonte de verdade sobre QUEM tem QUAL permissão continua sendo
// `usuario_papel` / `papel_permissao` / `permissao` no banco.
//
// REGRAS DE MANUTENÇÃO (vinculantes):
//   - nenhum identificador entra ou sai daqui sem alteração correspondente e
//     homologada de `docs/04` §5 — a prova mecânica dessa correspondência é
//     `test/permissoes.catalogo.spec.ts`, que LÊ o documento e compara;
//   - a existência de um identificador aqui NÃO materializa o fluxo que ele
//     governa: `senha.recuperar_terceiro` está no catálogo e a recuperação de
//     senha (F6) permanece NÃO INICIADA;
//   - nenhum seed, nenhuma associação papel↔permissão e nenhum registro de
//     banco nasce deste arquivo (F5 permanece NÃO INICIADA).

/**
 * `docs/04` §5 — as 29 permissões funcionais homologadas. Exaustivo por
 * decisão; ordem idêntica à da fonte (§5.1 → §5.8).
 */
export const PERMISSOES = Object.freeze([
  // §5.1 — Identidade
  "usuarios.gerenciar",
  "permissoes.gerenciar",
  "sessoes.revogar_terceiro",
  "senha.recuperar_terceiro",
  // §5.2 — Clínica e profissionais
  "clinica.configurar",
  "profissionais.gerenciar",
  // §5.3 — Pacientes
  "pacientes.administrativo.gerenciar",
  "pacientes.localizar",
  // §5.4 — Agenda
  "agenda.gerenciar",
  "agenda.checkin",
  "agenda.falta",
  "agenda.bloqueio",
  // §5.5 — Prontuário
  "prontuario.ler",
  "prontuario.escrever",
  "prontuario.finalizar",
  "prontuario.retificar_proprio",
  "prontuario.retificar_terceiro",
  "prontuario.exportar",
  // §5.6 — Pacotes
  "pacotes.gerenciar",
  "pacotes.ajustar_sessao",
  // §5.7 — Financeiro
  "financeiro.cobranca.gerenciar",
  "financeiro.pagamento.registrar",
  "financeiro.desconto.aplicar",
  "financeiro.cobranca.cancelar",
  "financeiro.pagamento.estornar",
  "financeiro.relatorio.ler",
  // §5.8 — Indicadores e auditoria
  "indicadores.globais.ler",
  "indicadores.proprios.ler",
  "auditoria.ler",
] as const);

/** Identificador técnico de permissão — conjunto FECHADO por `docs/04` §5. */
export type Permissao = (typeof PERMISSOES)[number];

const PERMISSOES_CONHECIDAS: ReadonlySet<string> = new Set(PERMISSOES);

/** `true` sse `codigo` é um dos 29 identificadores homologados por `docs/04` §5. */
export function ehPermissao(codigo: unknown): codigo is Permissao {
  return typeof codigo === "string" && PERMISSOES_CONHECIDAS.has(codigo);
}
