// TechLab Fisio — guard de sessão autenticada (Etapa 2.3D-B / F4).
//
// A ponte entre a autenticação já homologada (F2/F3) e a autorização (F4).
// Ela NÃO autentica nada de novo: não lê senha, não chama Argon2, não emite
// sessão, não audita e não altera contrato de rota alguma. Ela apenas
// pergunta ao `SessaoService` — o mecanismo de autenticação VIGENTE — se o
// cookie portado corresponde a uma sessão válida, e publica o resultado como
// contexto autenticado da requisição.
//
// POR QUE ELA EXISTE NESTA FATIA: `AUT-003` condiciona a autorização a
// "sessão autenticada válida", e o enunciado da F4 exige que a identidade
// autorizada derive da autenticação vigente — jamais de `usuarioId` no corpo,
// papel em cabeçalho ou permissão em query. Até a F3 não havia nenhum ponto
// que estabelecesse identidade para rotas comuns: o logout lia o cookie
// dentro do próprio controller. Esta é a menor peça que fecha essa lacuna, e
// ela é ADITIVA — `/auth/login` e `/auth/logout` continuam exatamente como
// homologados, sem esta guard.
//
// `401` E `403` NÃO SE CONFUNDEM. Esta guard produz `401` — e somente ela.
// A ausência de permissão é assunto da `PermissoesGuard`, que produz `403`.
// A ordem de `@UseGuards(SessaoAutenticadaGuard, PermissoesGuard)` é
// significativa: o Nest executa as guards em sequência e interrompe na
// primeira que recusa, de modo que uma requisição sem sessão recebe `401` sem
// jamais alcançar a consulta de permissões.
//
// CONTRATO DE ERRO REUTILIZADO, NÃO REINVENTADO: `401 { "erro":
// "SESSAO_INVALIDA" }` é exatamente o corpo que a F3 já devolve para sessão
// inválida no logout (`auth.dto.ts`, `ERRO.SESSAO_INVALIDA`). Os cinco
// motivos internos do `SessaoService` (`TOKEN_MALFORMADO`,
// `SESSAO_INEXISTENTE`, `SEGREDO_INVALIDO`, `SESSAO_EXPIRADA`,
// `SESSAO_REVOGADA`) colapsam numa resposta única, pelo mesmo racional
// anti-oráculo da decisão local `A-05` da F3.
//
// ATIVIDADE DA SESSÃO: `SessaoService.validar` registra a atividade sob o
// throttle monotônico de `D-2.3D-04`. Isso é o comportamento correto — uma
// requisição autenticada É atividade —, e a política temporal continua tendo
// um dono só. Esta guard não reimplementa nem duplica predicado temporal
// algum.

import { CanActivate, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import { ERRO } from "../auth/auth.dto.js";
import { lerCookieSessao, POLITICA_COOKIE_SESSAO } from "../auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../auth/politica-cookie.js";
import { SessaoService } from "../auth/sessao.service.js";
import { anexarContextoAutenticado } from "./contexto-autenticado.js";

/** Forma mínima da requisição consumida por esta guard — estrutural. */
interface RequisicaoComCookie {
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
}

@Injectable()
export class SessaoAutenticadaGuard implements CanActivate {
  constructor(
    private readonly sessoes: SessaoService,
    @Inject(POLITICA_COOKIE_SESSAO)
    private readonly politica: PoliticaCookieSessao,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoComCookie>();

    // ÚNICA origem do token: o cookie de `D-2.3D-07`, lido pela função da
    // própria F3. Nenhum cabeçalho `Authorization`, nenhum campo de corpo e
    // nenhum parâmetro de query participam — aceitá-los criaria uma segunda
    // via de autenticação fora da decisão homologada.
    const token = lerCookieSessao(requisicao.headers?.["cookie"], this.politica);
    const resultado = await this.sessoes.validar(token);
    if (!resultado.valida) {
      throw new UnauthorizedException({ erro: ERRO.SESSAO_INVALIDA });
    }

    // Os dois valores vêm da LINHA PERSISTIDA, não do pedido.
    anexarContextoAutenticado(requisicao, {
      usuarioId: resultado.usuarioId,
      sessaoId: resultado.sessaoId,
    });
    return true;
  }
}
