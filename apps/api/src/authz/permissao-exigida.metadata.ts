// TechLab Fisio — metadata da permissão exigida (Etapa 2.3D-B / F4, fatia corretiva).
//
// Módulo deliberadamente MÍNIMO: a chave de metadata e a leitura fail-closed
// dela. Ele existe para que o decorator público possa INSTALAR as guards
// (`applyDecorators`) sem criar ciclo de import — o decorator importa as
// guards, e a guard de permissões importa apenas este módulo.
//
// UMA PERMISSÃO POR OPERAÇÃO — decisão de orquestração desta fatia corretiva.
// A versão anterior aceitava lista e precisava decidir como compor várias
// permissões (`AND` vs `OR`), decisão que NENHUMA fonte homologada fixa. A
// revisão independente mediu o dado que resolveu a questão: **não existe, na
// matriz de `docs/04` §4 nem na tabela §8, nenhuma operação que exija duas
// permissões nomeadas simultaneamente** — toda operação homologada mapeia
// para exatamente UM identificador de `docs/04` §5. A cardinalidade > 1 era,
// portanto, abstração antecipada (TLF-BASE-V1 §4.5) que CRIAVA uma decisão
// comportamental evitável.
//
// Eliminada a abstração, a decisão deixa de existir: não há `AND`, não há
// `OR`, não há política de composição a homologar. Quando a primeira operação
// real exigir composição, ela virá com fonte e com decisão própria de Bruno.
//
// SOMENTE HANDLER. A metadata é lida exclusivamente do método. Não existe
// metadata de classe, herança de exigência, união classe+método nem override
// — superfície que a revisão mediu como capaz de REDUZIR silenciosamente a
// exigência quando um controller herda de outro.

import type { Permissao } from "./permissoes.catalogo.js";
import { ehPermissao } from "./permissoes.catalogo.js";

/** Chave de metadata escrita pelo decorator e lida pela `PermissoesGuard`. */
export const CHAVE_PERMISSAO_EXIGIDA = "tlf:permissao_exigida";

/**
 * Normaliza a metadata bruta do handler.
 *
 * FAIL-CLOSED e sem tolerância: devolve `null` — que a guard trata como
 * NEGAÇÃO — para tudo que não seja EXATAMENTE um identificador do catálogo
 * homologado de `docs/04` §5. Em particular, um array é recusado: a metadata
 * plural deixou de pertencer ao contrato, e aceitá-la reintroduziria pela
 * porta dos fundos a composição que esta fatia removeu.
 */
export function normalizarPermissaoExigida(bruto: unknown): Permissao | null {
  return ehPermissao(bruto) ? bruto : null;
}
