// TechLab Fisio — catálogo homologado de auditoria (P-BACK-01).
//
// FONTE ÚNICA E EXAUSTIVA: docs/09 §12 (decisões D-AUD-01 e D-AUD-07,
// homologadas por Bruno Menezes Noronha em 25/08/2026), docs/09 §13
// (decisões PBACK-AUD-01..PBACK-AUD-08, homologadas em 05/09/2026) e docs/09
// §13.4.1 (PBACK-AUD-09 — reavaliação de L-07, decidida em 05/09/2026 sobre o
// pacote docs/13). Este arquivo é a materialização tipada daquele registro —
// ele NÃO decide nada.
//
// §13 NÃO ALTEROU ESTE ARQUIVO EM SUBSTÂNCIA: as 24 ações e as whitelists
// (3 positivas · 21 vazias) de D-AUD-01/D-AUD-07 foram preservadas por
// PBACK-AUD-01..08, que fecharam as matérias adiadas SEM acrescentar ação nem
// chave.
//
// §13.4.1 (PBACK-AUD-09) ACRESCENTOU UMA ÚNICA AÇÃO: `autorizacao.negada`,
// com whitelist VAZIA — 25 ações · 3 positivas · 22 vazias. É a primeira e
// única exceção a D-AUD-05, restrita por decisão à negação deliberada de
// autorização da permissão `senha.recuperar_terceiro` (lista fechada mantida
// pelo emissor em `authz/auditoria-negacao-autorizacao.ts`, não aqui: este
// catálogo declara ações e chaves, não regras de emissão).
//
// Regras de manutenção (vinculantes):
//   - nenhuma ação entra aqui sem decisão homologada própria — em particular
//     as demais ações RC/SF de docs/09 §5 (`paciente.cadastro.alterado`,
//     `prontuario.acessado`, `auditoria.consultada`, ...) permanecem FORA
//     (D-AUD-04/D-AUD-05, confirmados por §13);
//   - nenhuma chave entra em whitelist sem decisão homologada própria — em
//     particular as "chaves mínimas" apenas propostas em docs/09 §§1..11
//     (`ativo_anterior`, `ativo_novo`, `campos_alterados`, `atendimento_id`,
//     `pacote_id`, `motivo_cancelamento_id`, `pagamento_id`, `formato`,
//     `tipo`, `quantidade`, `agendamento_id`, `papeis_anteriores`,
//     `papeis_novos`, `autor_original_usuario_id`) NÃO são homologadas.
//
// ESTADO DAS MATÉRIAS ANTES ADIADAS (docs/09 §13 — nenhuma delas altera o
// conteúdo deste arquivo):
//   - L-05 (agenda) — FECHADA (§13.2): `agendamento.confirmado`,
//     `agendamento.checkin`, `agendamento.falta_registrada`,
//     `agendamento.concluido` e `bloqueio_agenda.criado` seguem FORA; as
//     demais transições são atribuíveis por `historico_agendamento`;
//   - L-06 (acesso clínico) — **ABERTA / BLOQUEADA** (§13.3). NÃO foi
//     encerrada por escopo: TLF-BASE-V1 §10 exige trilha de auditoria para
//     ACESSO a dados sensíveis, e AUD-002 não é dada por satisfeita pelas
//     ações de exportação/finalização/retificação. Bloqueada por não existir
//     módulo de prontuário nem `P2.2-05`. `prontuario.acessado` continua
//     FORA — e sua eventual inclusão exige decisão formal futura, não
//     inferência a partir deste comentário;
//   - L-07 (negações) — REAVALIADA E DECIDIDA (§13.4.1, PBACK-AUD-09), após
//     a nota de revisão de §13.4 e a errata de §13.1 G-03 (a premissa de que
//     não havia endpoint sob `@RequerPermissao` era FALSA). Decisão
//     (docs/13 D-0..D-4): gatilho (a) satisfeito; política R — auditoria
//     RESTRITA; `autorizacao.negada` ENTRA no catálogo com whitelist VAZIA
//     (D-4: alvo = `permissao`, sem chave de contexto); emissão restrita à
//     permissão `senha.recuperar_terceiro`; Q2 em falha de gravação; V0 sem
//     limitação. Nenhuma outra permissão, guard ou `403` é auditado por
//     implicação;
//   - L-08 (paciente) — POLÍTICA FECHADA / MATERIALIZAÇÃO PENDENTE (§13.5):
//     `paciente.cadastro.alterado`, `paciente.situacao.alterada` e
//     `campos_alterados` NÃO são criados nesta etapa;
//   - `configuracao.alterada` — FECHADA (§13.6): ação única, entidade por
//     `alvo_tipo`, abrangência CFG-001..CFG-006, whitelist VAZIA;
//   - `prontuario.exportado` — FECHADO (§13.7): `alvo_tipo = "paciente"`,
//     `alvo_id = paciente.id`, sem chave de contexto (`formato` NÃO
//     homologada). Regra de EMISSÃO, observada pelo futuro emissor; não é
//     representável nesta estrutura, que só declara ações e chaves;
//   - `autor_original_usuario_id` — REJEIÇÃO CONFIRMADA (§13.8, após
//     D-AUD-07 §12.6): derivável por `registro_original_id` →
//     `registro_clinico.autor_usuario_id`, sobre valor imutável;
//   - consulta da trilha (AUD-004) — política FECHADA (§13.9), implementação
//     PENDENTE: usará `auditoria.ler`, já homologada; `auditoria.consultada`
//     NÃO é criada.

/**
 * D-AUD-01 (docs/09 §12.2) — as 24 ações homologadas do catálogo inicial de
 * `evento_auditoria.acao`, na ordem da fonte — mais `autorizacao.negada`,
 * 25ª ação, acrescentada por PBACK-AUD-09 (docs/09 §13.4.1) ao final da
 * lista, para que a ordem de D-AUD-01 permaneça reconhecível. Exaustivo por
 * decisão.
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
  // PBACK-AUD-09 (docs/09 §13.4.1) — negação DELIBERADA de autorização,
  // `resultado = NEGADO`, `alvo_tipo = "permissao"`, `alvo_id = permissao.id`.
  // Emissão RESTRITA por lista fechada (hoje: só `senha.recuperar_terceiro`).
  "autorizacao.negada",
] as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[number];

const ACOES_CONHECIDAS: ReadonlySet<string> = new Set(ACOES_AUDITORIA);

/** `true` sse `acao` é uma das 25 ações homologadas (D-AUD-01 + PBACK-AUD-09). */
export function ehAcaoAuditoria(acao: string): acao is AcaoAuditoria {
  return ACOES_CONHECIDAS.has(acao);
}

/**
 * D-AUD-07 (docs/09 §12.6) — whitelist fail-closed de `contexto`, EXAUSTIVA.
 *
 * Regra base: whitelist VAZIA. Somente as três ações abaixo possuem chaves
 * expressamente homologadas; as demais 22 ações (inclusive
 * `autorizacao.negada` — PBACK-AUD-09 recusou `permissao_requerida`, `motivo`
 * e qualquer outra chave: a permissão exigida É o alvo) não admitem contexto
 * não vazio. O `satisfies` garante em compilação que TODA ação do catálogo
 * tem sua whitelist declarada aqui — não existe caso "não mapeado" em runtime.
 */
/**
 * Forma canônica de valor monetário aceito em chave de contexto monetária:
 * string decimal com exatamente duas casas, sem sinal, sem zeros à esquerda,
 * até 10 dígitos inteiros — o espaço NÃO NEGATIVO de `numeric(12,2)`
 * (`docs/07` §19.2; contrato adotado por PROP-RN-2.3C-01 — `docs/11`).
 * É a MESMA fronteira usada pelo emissor de FIN-003 (`CobrancaService`).
 */
const FORMATO_MONETARIO_CANONICO = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;

/**
 * `true` sse `valor` é uma STRING decimal monetária canônica não negativa
 * compatível com `numeric(12,2)`. Qualquer outro tipo (number inclusive) ou
 * forma ("10", "10.0", "01.00", "-1.00", "1e2", "10,00", espaços, vazio) é
 * falso — nenhuma conversão/normalização é feita aqui ou em outro lugar.
 */
export function ehDecimalMonetarioCanonico(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_MONETARIO_CANONICO.test(valor);
}

/**
 * F-2.3C-REV-01 — validação SEMÂNTICA fail-closed por ação/chave, aplicada
 * pelo `AuditContextValidator` DEPOIS das barreiras estruturais (whitelist e
 * escalar JSON). Uma chave listada aqui só é aceita se o predicado aprovar o
 * valor; chave sem predicado permanece sob as barreiras estruturais apenas.
 *
 * Escopo deliberadamente restrito (sem ampliação silenciosa de D-AUD-07):
 *   - `cobranca.desconto_aplicado`: as duas chaves monetárias homologadas
 *     exigem string decimal canônica de `numeric(12,2)` — fonte: `docs/07`
 *     §19.2 + PROP-RN-2.3C-01 + autorização de F-2.3C-REV-01;
 *   - `cobranca.data_referencia_recalculada` e
 *     `retificacao_clinica.efetivada_terceiro`: NENHUMA regra semântica é
 *     definida aqui — o formato dessas chaves (data civil ISO; uuid) não tem
 *     regra homologada própria e será decidido quando seus emissores forem
 *     implementados (pendência registrada em `docs/10`). O mecanismo suporta
 *     acrescentá-las com uma linha por chave, mediante decisão expressa.
 */
export const SEMANTICA_CONTEXTO: Readonly<
  Partial<Record<AcaoAuditoria, Readonly<Record<string, (valor: unknown) => boolean>>>>
> = {
  "cobranca.desconto_aplicado": {
    valor_desconto_anterior: ehDecimalMonetarioCanonico,
    valor_desconto_novo: ehDecimalMonetarioCanonico,
  },
};

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
  "autorizacao.negada": [],
} as const satisfies Record<AcaoAuditoria, readonly string[]>;
