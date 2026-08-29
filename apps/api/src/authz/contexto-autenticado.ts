// TechLab Fisio — contexto autenticado da requisição (Etapa 2.3D-B / F4).
//
// A MENOR abstração possível para "quem é o usuário desta requisição", e
// nada além dela. Materializa a exigência de `AUT-003` de que a autorização
// parta de uma "sessão autenticada válida", e a de `D-2.3D-09`/TLF-BASE-V1
// §4.7 de que a decisão viva no backend.
//
// PROPRIEDADE CENTRAL — A IDENTIDADE NÃO É CONTROLÁVEL PELO CLIENTE. O
// contexto é gravado sob uma CHAVE DE SÍMBOLO privada deste módulo:
//
//   - símbolo NÃO registrado (`Symbol(...)`, nunca `Symbol.for(...)`): não é
//     alcançável por nome a partir do registro global;
//   - nenhum corpo JSON, nenhuma query string e nenhum cabeçalho HTTP produz
//     uma propriedade de símbolo no objeto de requisição — o parser escreve
//     em `req.body`, `req.query` e `req.headers`, que são propriedades de
//     STRING de outros objetos;
//   - portanto não existe forma de um CLIENTE injetar, sobrescrever ou
//     adivinhar esta chave. Nenhum `usuarioId`, `papel` ou `permissao` vindo
//     do pedido participa da decisão (`docs/04` §2.3).
//
// LIMITE DECLARADO DO MODELO DE CONFIANÇA — o que esta técnica NÃO promete:
// ela protege contra o cliente HTTP, e **não** contra código arbitrário
// dentro do mesmo processo. Um símbolo não registrado continua enumerável por
// `Object.getOwnPropertySymbols` em qualquer objeto que já o carregue, de
// modo que código do processo com acesso a uma requisição já processada pode
// descobri-lo. A garantia que sustenta a autorização não é o sigilo do
// símbolo: é a regra de `anexarContextoAutenticado` abaixo — a identidade
// validada pelo `SessaoService` SEMPRE substitui o que estiver na requisição,
// de modo que uma contaminação anterior não sobrevive à guard.
//
// O QUE ESTE MÓDULO DELIBERADAMENTE NÃO É: não é DTO global, não é framework
// de request context, não usa `AsyncLocalStorage`, não guarda permissões
// resolvidas, não guarda papéis e não guarda o token. Guardar permissões aqui
// criaria um SNAPSHOT de autorização — exatamente o que `docs/12` §16 e o
// enunciado da fatia proíbem antecipar: a fonte autoritativa continua sendo a
// persistência, consultada no momento da decisão.

import { createParamDecorator, ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import { ERRO_AUTORIZACAO } from "./erro-autorizacao.js";

/**
 * Chave privada do contexto no objeto de requisição. `Symbol(...)` — NÃO
 * `Symbol.for(...)`: o registro global tornaria a chave alcançável por
 * qualquer código do processo a partir de uma string.
 */
const CHAVE_CONTEXTO_AUTENTICADO = Symbol("tlf.contexto_autenticado");

/**
 * Identidade da requisição, derivada EXCLUSIVAMENTE da sessão validada pelo
 * `SessaoService` da F2. Ambos os campos vêm da linha persistida de
 * `sessao_autenticacao`, nunca do pedido.
 */
export interface ContextoAutenticado {
  readonly usuarioId: string;
  readonly sessaoId: string;
}

/** Objeto de requisição sob o ponto de vista deste módulo — estrutural. */
export interface RequisicaoComContexto {
  [CHAVE_CONTEXTO_AUTENTICADO]?: ContextoAutenticado;
}

/**
 * Grava o contexto na requisição. Chamado por UM único ponto — o
 * `SessaoAutenticadaGuard` —, depois de a sessão ter sido validada.
 *
 * SOBRESCREVE SEMPRE — correção `R4-01`. A versão anterior PRESERVAVA um
 * contexto preexistente, sob a premissa de que "duas gravações só poderiam
 * vir de duas validações de sessão". A premissa não é garantida, e a revisão
 * independente mediu a consequência: o símbolo é recuperável por
 * `Object.getOwnPropertySymbols` a partir de qualquer requisição já
 * processada, de modo que um contexto SEMEADO antes da guard sobrevivia à
 * gravação — e a `PermissoesGuard` decidia sobre a identidade semeada, não
 * sobre a validada.
 *
 * A regra correta é a inversa, e é a que vale agora: **a identidade
 * recém-validada pelo `SessaoService` é autoritativa e substitui qualquer
 * valor previamente colocado na requisição**. Duas validações legítimas
 * escrevem a mesma identidade; uma contaminação anterior é descartada.
 *
 * Por isso a propriedade é `configurable: true` — sem isso a redefinição
 * lançaria. Ela permanece `writable: false` e `enumerable: false`: o valor
 * não é mutável por atribuição direta, e não vaza em enumeração nem em JSON.
 */
export function anexarContextoAutenticado(
  requisicao: unknown,
  contexto: ContextoAutenticado,
): void {
  if (typeof requisicao !== "object" || requisicao === null) return;
  const alvo = requisicao as RequisicaoComContexto;
  Object.defineProperty(alvo, CHAVE_CONTEXTO_AUTENTICADO, {
    value: Object.freeze({
      usuarioId: contexto.usuarioId,
      sessaoId: contexto.sessaoId,
    }),
    enumerable: false,
    writable: false,
    configurable: true,
  });
}

/**
 * Lê o contexto da requisição. FAIL-CLOSED: devolve `null` para qualquer coisa
 * que não seja um contexto íntegro gravado por `anexarContextoAutenticado` —
 * ausência, tipo errado, campo faltando ou campo vazio.
 */
export function lerContextoAutenticado(
  requisicao: unknown,
): ContextoAutenticado | null {
  if (typeof requisicao !== "object" || requisicao === null) return null;
  const bruto = (requisicao as RequisicaoComContexto)[CHAVE_CONTEXTO_AUTENTICADO];
  if (typeof bruto !== "object" || bruto === null) return null;
  const { usuarioId, sessaoId } = bruto;
  if (typeof usuarioId !== "string" || usuarioId === "") return null;
  if (typeof sessaoId !== "string" || sessaoId === "") return null;
  return bruto;
}

/**
 * Recuperação declarativa do usuário autenticado no controller:
 *
 *     metodo(@UsuarioAutenticado() usuario: ContextoAutenticado)
 *
 * FAIL-CLOSED: se o contexto não existe — isto é, se a rota foi anotada sem o
 * `SessaoAutenticadaGuard` —, o decorator NEGA em vez de entregar `undefined`
 * ao handler. Entregar `undefined` faria um controller descuidado operar com
 * identidade vazia; negar torna o erro de fiação imediatamente visível e
 * jamais permissivo.
 */
export const UsuarioAutenticado = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): ContextoAutenticado => {
    const requisicao: unknown = contexto.switchToHttp().getRequest();
    const autenticado = lerContextoAutenticado(requisicao);
    if (autenticado === null) {
      throw new ForbiddenException({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
    }
    return autenticado;
  },
);
