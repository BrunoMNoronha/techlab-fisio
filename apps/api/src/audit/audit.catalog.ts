// TechLab Fisio — catálogo homologado de auditoria (P-BACK-01).
//
// FONTE ÚNICA E EXAUSTIVA: docs/09 §12 (decisões D-AUD-01 e D-AUD-07,
// homologadas por Bruno Menezes Noronha em 25/08/2026). Este arquivo é a
// materialização tipada daquele registro — ele NÃO decide nada.
//
// Regras de manutenção (vinculantes):
//   - nenhuma ação entra aqui sem decisão homologada própria — em particular
//     as ações RC/SF de docs/09 §5 (`paciente.cadastro.alterado`,
//     `prontuario.acessado`, `autorizacao.negada`, `auditoria.consultada`,
//     ...) permanecem FORA (D-AUD-04/D-AUD-05);
//   - nenhuma chave entra em whitelist sem decisão homologada própria — em
//     particular as "chaves mínimas" apenas propostas em docs/09 §§1..11
//     (`ativo_anterior`, `ativo_novo`, `campos_alterados`, `atendimento_id`,
//     `pacote_id`, `motivo_cancelamento_id`, `pagamento_id`, `formato`,
//     `tipo`, `quantidade`, `agendamento_id`, `papeis_anteriores`,
//     `papeis_novos`, `autor_original_usuario_id`) NÃO são homologadas;
//   - `autor_original_usuario_id` foi EXPRESSAMENTE recusada (docs/09 §12.6);
//   - as lacunas L-05..L-08, a abrangência de `configuracao.alterada` e o
//     alvo de `prontuario.exportado` seguem ADIADAS — nada aqui as decide.

/**
 * D-AUD-01 (docs/09 §12.2) — as 24 ações homologadas do catálogo inicial de
 * `evento_auditoria.acao`. Exaustivo por decisão; ordem igual à da fonte.
 */
export const ACOES_AUDITORIA = [
  "usuario.autenticacao",
  "usuario.sessao.logout",
  "usuario.sessao.revogacao",
  "usuario.senha.recuperacao_iniciada",
  "usuario.senha.recuperacao_concluida",
  "usuario.situacao.alterada",
  "usuario.papeis.alterados",
  "configuracao.alterada",
  "profissional.situacao.alterada",
  "agendamento.criado",
  "agendamento.remarcado",
  "agendamento.cancelado",
  "atendimento.iniciado",
  "registro_clinico.finalizado",
  "retificacao_clinica.efetivada",
  "retificacao_clinica.efetivada_terceiro",
  "prontuario.exportado",
  "sessao.consumida",
  "sessao.ajustada",
  "cobranca.desconto_aplicado",
  "cobranca.cancelada",
  "cobranca.data_referencia_recalculada",
  "pagamento.registrado",
  "pagamento.estornado",
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

const ACOES_CONHECIDAS: ReadonlySet<string> = new Set(ACOES_AUDITORIA);

/** `true` sse `acao` é uma das 24 ações homologadas por D-AUD-01. */
export function ehAcaoAuditoria(acao: string): acao is AcaoAuditoria {
  return ACOES_CONHECIDAS.has(acao);
}

/**
 * D-AUD-07 (docs/09 §12.6) — whitelist fail-closed de `contexto`, EXAUSTIVA.
 *
 * Regra base: whitelist VAZIA. Somente as três ações abaixo possuem chaves
 * expressamente homologadas; as demais 21 ações não admitem contexto não
 * vazio. O `satisfies` garante em compilação que TODA ação do catálogo tem
 * sua whitelist declarada aqui — não existe caso "não mapeado" em runtime.
 */
export const WHITELIST_CONTEXTO = {
  "usuario.autenticacao": [],
  "usuario.sessao.logout": [],
  "usuario.sessao.revogacao": [],
  "usuario.senha.recuperacao_iniciada": [],
  "usuario.senha.recuperacao_concluida": [],
  "usuario.situacao.alterada": [],
  "usuario.papeis.alterados": [],
  "configuracao.alterada": [],
  "profissional.situacao.alterada": [],
  "agendamento.criado": [],
  "agendamento.remarcado": [],
  "agendamento.cancelado": [],
  "atendimento.iniciado": [],
  "registro_clinico.finalizado": [],
  "retificacao_clinica.efetivada": [],
  "retificacao_clinica.efetivada_terceiro": ["registro_original_id"],
  "prontuario.exportado": [],
  "sessao.consumida": [],
  "sessao.ajustada": [],
  "cobranca.desconto_aplicado": [
    "valor_desconto_anterior",
    "valor_desconto_novo",
  ],
  "cobranca.cancelada": [],
  "cobranca.data_referencia_recalculada": [
    "data_referencia_anterior",
    "data_referencia_nova",
  ],
  "pagamento.registrado": [],
  "pagamento.estornado": [],
} as const satisfies Record<AcaoAuditoria, readonly string[]>;
