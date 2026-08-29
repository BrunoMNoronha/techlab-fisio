// TechLab Fisio — decorator de autorização RBAC (Etapa 2.3D-B / F4, fatia corretiva).
//
// A ÚNICA porta pública da autorização por permissão:
//
//     @RequerPermissao("usuarios.gerenciar")
//
// e mais nada. Materializa `AUT-003` e `D-2.3D-09` na forma mais estreita que
// as fontes sustentam.
//
// -----------------------------------------------------------------------
// POR QUE ELE INSTALA AS GUARDS — correção `R4-03`
// -----------------------------------------------------------------------
// Na versão anterior o decorator apenas DECLARAVA metadata, e proteger de
// fato a rota exigia um segundo ato manual (`@UseGuards(...)`). A revisão
// independente MEDIU o modo de falha: uma rota anotada com a permissão e sem
// o `@UseGuards` respondia `200` a uma requisição SEM SESSÃO ALGUMA — a
// declaração era silenciosamente inócua.
//
// A correção é ESTRUTURAL, não uma varredura de testes: `applyDecorators`
// funde, num único ato, a metadata e as duas guards, NA ORDEM. Não existe
// mais "declarar sem proteger": o esquecimento que produzia a falha deixou de
// ser expressável.
//
// ORDEM VINCULANTE — e o que ela garante:
//
//     SessaoAutenticadaGuard  ->  sessão inválida ....... 401
//     PermissoesGuard         ->  sem a permissão ....... 403
//                                 com a permissão ....... prossegue
//
// O Nest executa as guards na ordem declarada e interrompe na primeira que
// recusa. Invertê-las faria uma requisição sem sessão receber `403` (a guard
// de RBAC não encontraria contexto) em vez de `401` — confusão que o contrato
// desta fatia proíbe e que os testes detectam.
//
// -----------------------------------------------------------------------
// UMA PERMISSÃO, SOMENTE MÉTODO — elimina `L-F4-01` e corrige `R4-04`
// -----------------------------------------------------------------------
// Aridade EXATAMENTE 1, garantida pelo TIPO. Não há `AND`, `OR`, `ANY`,
// `ALL`, lista, spread ou metadata de classe. As razões estão em
// `permissao-exigida.metadata.ts`: nenhuma operação de `docs/04` exige duas
// permissões, e a superfície de classe+herança foi medida como capaz de
// REDUZIR a exigência de um controller-base sem que nada avisasse.
//
// `MethodDecorator` explícito: aplicá-lo a uma classe é erro de COMPILAÇÃO.

import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import { CHAVE_PERMISSAO_EXIGIDA } from "./permissao-exigida.metadata.js";
import type { Permissao } from "./permissoes.catalogo.js";
import { ehPermissao } from "./permissoes.catalogo.js";
import { PermissoesGuard } from "./permissoes.guard.js";
import { SessaoAutenticadaGuard } from "./sessao-autenticada.guard.js";

/**
 * Erro de DECLARAÇÃO — lançado na avaliação do decorator, isto é, no
 * carregamento do módulo. Uma rota mal declarada faz a aplicação NÃO SUBIR,
 * em vez de subir com uma exigência que jamais casaria. Mesmo tratamento
 * fail-fast de `R-2.3D-04` (`politica-cookie.ts`).
 */
export class ErroDeclaracaoPermissao extends Error {
  override readonly name = "ErroDeclaracaoPermissao";
}

/**
 * Protege UM método com autenticação de sessão e UMA permissão do catálogo
 * homologado de `docs/04` §5.
 *
 * O tipo `Permissao` já barra identificador inválido em compilação; a
 * checagem de runtime existe porque o decorator também é alcançável a partir
 * de código não tipado.
 */
export function RequerPermissao(permissao: Permissao): MethodDecorator {
  if (!ehPermissao(permissao)) {
    throw new ErroDeclaracaoPermissao(
      "RequerPermissao recebeu identificador fora do catálogo homologado de docs/04 §5.",
    );
  }
  return applyDecorators(
    SetMetadata(CHAVE_PERMISSAO_EXIGIDA, permissao),
    UseGuards(SessaoAutenticadaGuard, PermissoesGuard),
  );
}
