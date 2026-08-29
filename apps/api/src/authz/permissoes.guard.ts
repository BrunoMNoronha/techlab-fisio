// TechLab Fisio — guard de autorização RBAC (Etapa 2.3D-B / F4).
//
// O ponto onde `AUT-003` e `D-2.3D-09` deixam de ser texto: a requisição só
// alcança o handler se o usuário da SESSÃO possuir, na persistência, a
// permissão declarada pela rota.
//
// Ela é instalada pelo `@RequerPermissao(...)` e não deve ser aplicada à mão
// — a instalação manual continua funcionando e continua fail-closed, mas o
// caminho suportado é o decorator, que garante também a guard de sessão e a
// ordem entre as duas.
//
// CONTRATO DE DESFECHOS:
//
//   não autenticado ................. `SessaoAutenticadaGuard` -> `401`
//   autenticado sem permissão ....... `403`
//   autenticado com permissão ....... prossegue
//
// FALTA DE PERMISSÃO NUNCA VIRA `401`. E `401` nunca é emitido por esta
// guard: ela não autentica.
//
// UMA PERMISSÃO, LIDA SOMENTE DO HANDLER (fatia corretiva). Não há metadata
// de classe, herança, união classe+método, override nem composição `AND`/`OR`
// — ver `permissao-exigida.metadata.ts` para o fundamento. A leitura é um
// `reflector.get` sobre o método, e nada mais.
//
// FAIL-CLOSED — o que ela NEGA sem hesitar:
//   - metadata AUSENTE ......... guard aplicada à mão, sem declaração;
//   - metadata INVÁLIDA ........ array, string fora do catálogo, tipo errado;
//   - contexto autenticado ausente ... erro de fiação; nega, não autentica;
//   - usuário inexistente ...... sessão aponta para conta que não existe;
//   - usuário inativo .......... defesa em profundidade (§6-K, `L-F4-02`);
//   - a permissão exigida ausente do conjunto efetivo.
//
// FAIL-CLOSED NÃO É "SEMPRE `403`". Uma falha TÉCNICA na resolução — banco
// indisponível, erro de driver — sobe como exceção e vira `500`. Isso É
// fail-closed (o handler não é alcançado) e preserva a observabilidade:
// converter indisponibilidade de infraestrutura em "sem permissão" faria todo
// incidente parecer erro de configuração de papéis. Mesmo racional já
// homologado do `FiltroErroAutenticacao` ("falha técnica nunca vira `401`").
//
// SEM AUDITORIA DE NEGAÇÃO — fronteira, não esquecimento: `autorizacao.negada`
// é uma das ações RC/SF que `D-AUD-04`/`D-AUD-05` mantêm EXPRESSAMENTE FORA do
// catálogo homologado (`docs/09` §12). Emiti-la aqui ampliaria o catálogo sem
// decisão própria.
//
// SEM CACHE: a decisão consulta a persistência a cada requisição. Nenhum
// snapshot de permissão na sessão, nenhum token com papéis, nenhum Redis
// (`docs/12` §16).
//
// GARANTIA TEMPORAL (TOCTOU) — declarada, não eliminada: a autorização
// representa o estado consultado NO INSTANTE DA EXECUÇÃO DESTA GUARD. Uma
// permissão removida depois disso não interrompe o handler já autorizado.
// Operações sensíveis futuras poderão exigir revalidação dentro da própria
// transação de negócio; nenhuma serialização global, lock ou cache é
// introduzida aqui para isso.

import { CanActivate, ForbiddenException, Injectable } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { lerContextoAutenticado } from "./contexto-autenticado.js";
import { ERRO_AUTORIZACAO } from "./erro-autorizacao.js";
import {
  CHAVE_PERMISSAO_EXIGIDA,
  normalizarPermissaoExigida,
} from "./permissao-exigida.metadata.js";
import { PermissoesService } from "./permissoes.service.js";
import type { Permissao } from "./permissoes.catalogo.js";

/**
 * Lê a permissão exigida pelo HANDLER. `null` — que a guard trata como
 * negação — para metadata ausente ou inválida.
 */
export function lerPermissaoExigida(
  reflector: Reflector,
  contexto: ExecutionContext,
): Permissao | null {
  return normalizarPermissaoExigida(
    reflector.get<unknown>(CHAVE_PERMISSAO_EXIGIDA, contexto.getHandler()),
  );
}

/**
 * Corpo ÚNICO de toda negação. Nenhuma variação — nem a permissão que faltou,
 * nem o motivo interno, nem a existência do usuário — chega ao cliente.
 */
function negado(): { readonly erro: string } {
  return { erro: ERRO_AUTORIZACAO.ACESSO_NEGADO };
}

@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissoes: PermissoesService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const exigida = lerPermissaoExigida(this.reflector, contexto);
    if (exigida === null) throw new ForbiddenException(negado());

    // A identidade vem do contexto gravado pela guard de sessão sob chave de
    // símbolo privada — nunca do corpo, da query ou de um cabeçalho.
    const requisicao: unknown = contexto.switchToHttp().getRequest();
    const autenticado = lerContextoAutenticado(requisicao);
    if (autenticado === null) throw new ForbiddenException(negado());

    const resolucao = await this.permissoes.resolverDoUsuario(autenticado.usuarioId);
    if (!resolucao.resolvido) throw new ForbiddenException(negado());

    if (!resolucao.permissoes.includes(exigida)) throw new ForbiddenException(negado());
    return true;
  }
}
