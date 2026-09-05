// TechLab Fisio — normalização dos erros da fronteira de autenticação
// (Etapa 2.3D-B / F3).
//
// POR QUE ESTE FILTRO EXISTE — a lacuna que ele fecha foi MEDIDA, não
// suposta: um corpo JSON sintaticamente inválido nunca chega ao controller.
// Ele é rejeitado pelo body parser, registrado como middleware global pelo
// próprio `NestFactory`, e o desfecho padrão é
//
//   400 {"message":"Expected property name or '}' in JSON at position 1 ...",
//        "error":"Bad Request","statusCode":400}
//
// Isso viola duas exigências desta fatia ao mesmo tempo: o corpo NÃO é o
// contrato fechado que o OpenAPI declara para `400` (contrato e runtime
// divergentes — `D-2.3D-11`), e a mensagem é um detalhe do parser, não uma
// decisão da fronteira ("os erros HTTP da F3 devem ser deliberados, estáveis
// e testáveis"). Um filtro de controller não alcança o caso, porque o erro
// nasce ANTES do roteamento.
//
// CORREÇÕES DA REVISÃO INDEPENDENTE:
//   `F-06` o escopo passa a reconhecer as variantes de caminho que o próprio
//         roteador do Express aceita (`/auth/login/`, `/AUTH/LOGIN`), pelas
//         quais o vazamento do parser reaparecia;
//   `F-07` o filtro passa a exigir também o MÉTODO `POST`, de modo que um
//         `GET /auth/login` receba o `404` normal da plataforma em vez de um
//         status não documentado com corpo do contrato;
//   `F-03` erro 4xx do cliente vindo do body parser (`400` malformado, `413`
//         acima do limite) deixa de virar `500 FALHA_INTERNA` com log de erro.
//
// CORREÇÃO `F3R-01` (segunda revisão independente) — REQUEST-TARGET
// ABSOLUTE-FORM. O reconhecimento comparava a URL CRUA. O RFC 7230 §5.3.2
// obriga o servidor a aceitar também a forma absoluta
//
//     POST http://host/auth/login
//
// que o roteador do Express ROTEIA normalmente para o login — medido: devolve
// `401` com corpo bem-formado. O filtro, porém, não a reconhecia, e por ela
// reapareciam os dois defeitos que `F-06`/`F-03` diziam ter fechado: o corpo
// cru do parser vazava no lugar do contrato fechado, e o `413` produzia
// entrada de log de nível ERROR com stack trace — acionável SEM cabeçalho
// algum, porque o body parser roda antes da guard CSRF.
//
// A decisão passa a usar o PATHNAME EFETIVO, na mesma semântica do roteador.
// Medição que fundamenta a escolha (18 variantes de request-target contra o
// Express real): `req.path` reproduz EXATAMENTE a decisão de roteamento —
// as 8 variantes que o roteador leva ao login normalizam para `/auth/login`,
// e as 10 que ele devolve como `404` continuam distintas.
//
// POR QUE NÃO `new URL()`: a normalização WHATWG é EXCESSIVA e passaria a
// capturar rotas que o roteador não trata como login. Medido:
//
//     new URL("/auth/./login")    -> "/auth/login"   (roteador: 404)
//     new URL("/auth/x/../login") -> "/auth/login"   (roteador: 404)
//     new URL("//auth/login")     -> "/login"        (roteador: 404)
//
// `req.path` (parseurl) não colapsa dot segments, não decodifica
// percent-encoding e não funde barras repetidas — exatamente o que se quer.
//
// ESCOPO DELIBERADAMENTE ESTREITO: o filtro só age nas rotas da F3. Para
// qualquer outro caminho ele delega ao comportamento padrão do Nest
// (`super.catch`) sem alterar coisa alguma — o `404` de rota desconhecida e o
// `GET /health` continuam exatamente como eram. Ele NÃO é um tratador de
// erros de aplicação inteira, e não deve virar um.
//
// FALHA TÉCNICA NÃO É MASCARADA COMO CREDENCIAL INVÁLIDA. Uma exceção
// inesperada — erro do driver de persistência, falha do addon do Argon2,
// indisponibilidade do banco — vira `500 FALHA_INTERNA`, jamais `401`.
// Devolver `401` para uma falha de infraestrutura destruiria a
// observabilidade operacional (todo incidente pareceria senha errada) e
// mentiria para o cliente.
//
// LOG SEM CONTEÚDO — decisão deliberada e sua limitação declarada: o registro
// leva a CLASSE da exceção e uma correlação, nunca `message` nem `stack`.
// Mensagens de erro do Prisma podem carregar a consulta e seus parâmetros
// (isto é, o identificador tentado), e mensagens do Argon2 podem carregar o
// digest — exatamente o que a TLF-BASE-V1 §10 e `D-2.3D-12` proíbem
// registrar. A perda de detalhe no log é o preço aceito por essa proibição, e
// fica registrada como limitação, não como propriedade.

import { ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { randomUUID } from "node:crypto";

import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { ERRO_RECUPERACAO } from "../recuperacao-senha/recuperacao-senha.dto.js";
import { ERRO } from "./auth.dto.js";

/**
 * Rotas cujo contrato de erro é fechado — e somente elas.
 *
 * ACRÉSCIMO DA F6: as duas rotas de recuperação de senha entram no MESMO
 * escopo, pela MESMA razão que fez este filtro existir (§ cabeçalho): sem ele,
 * um JSON malformado ou um corpo acima do limite nessas rotas devolveria o
 * corpo cru do parser, e não o contrato fechado que o OpenAPI declara. O
 * escopo continua ESTREITO e enumerado; nada fora destas quatro operações
 * `POST` é tocado.
 */
const ROTAS_DA_FRONTEIRA: ReadonlySet<string> = new Set([
  "/auth/login",
  "/auth/logout",
  "/auth/recuperacao-senha",
  "/auth/recuperacao-senha/concluir",
]);

/**
 * Método das operações da F3. `F-07`: o filtro NÃO captura outros métodos —
 * um `GET /auth/login` recebe o `404` normal da plataforma e não pertence ao
 * contrato OpenAPI dos endpoints POST. Normalizar aquele `404` para o corpo
 * fechado era o que criava um status não documentado no runtime.
 */
const METODO_DA_FRONTEIRA = "POST";

/**
 * Códigos que a própria fronteira produz e que passam intactos: os da F3, o
 * código único da autorização (a rota de início da F6 é protegida por
 * `@RequerPermissao`, cujas guards emitem `SESSAO_INVALIDA`/`ACESSO_NEGADO`)
 * e os dois da F6. Qualquer outro corpo é normalizado para o contrato.
 */
const CODIGOS_DA_FRONTEIRA: ReadonlySet<string> = new Set([
  ...Object.values(ERRO),
  ...Object.values(ERRO_AUTORIZACAO),
  ...Object.values(ERRO_RECUPERACAO),
]);

interface RequisicaoDaFronteira {
  readonly url?: string | undefined;
  /**
   * Pathname já extraído pela plataforma — `req.path` no Express, que é o
   * `pathname` de `parseurl` e portanto a MESMA leitura que o roteador usa
   * para casar a rota (`F3R-01`). Opcional para que a interface siga
   * estrutural: quando ausente, o pathname é derivado de `url`.
   */
  readonly path?: string | undefined;
  readonly method?: string | undefined;
}

interface RespostaEscrevivel {
  status(codigo: number): RespostaEscrevivel;
  json(corpo: unknown): unknown;
}

/**
 * Extrai o pathname de um request-target CRU, sem normalizar coisa alguma
 * além de descartar o que não é caminho (`F3R-01`).
 *
 * É a retaguarda para quando a plataforma não oferece `path` — o caminho
 * normal usa `req.path`. Trata as duas formas que o RFC 7230 §5.3 admite em
 * requisição a servidor de origem:
 *
 *   origin-form ..... `/auth/login?x=1`
 *   absolute-form ... `http://host/auth/login?x=1`
 *
 * Deliberadamente NÃO decodifica percent-encoding, NÃO colapsa dot segments e
 * NÃO funde barras repetidas: qualquer uma dessas normalizações faria o filtro
 * capturar caminhos que o roteador devolve como `404`.
 */
function pathnameDoRequestTarget(url: string | undefined): string {
  if (typeof url !== "string") return "";
  const semFragmento = url.split("#", 1)[0] as string;
  const semQuery = semFragmento.split("?", 1)[0] as string;
  const esquema = /^[a-z][a-z0-9+\-.]*:\/\//i.exec(semQuery);
  if (esquema === null) return semQuery;
  const inicioDoCaminho = semQuery.indexOf("/", esquema[0].length);
  return inicioDoCaminho === -1 ? "/" : semQuery.slice(inicioDoCaminho);
}

/**
 * Pathname efetivo da requisição, na semântica do roteador (`F3R-01`).
 *
 * Prefere o `path` da própria plataforma — no Express é o `pathname` de
 * `parseurl`, isto é, exatamente o valor contra o qual a rota é casada, e já
 * resolve absolute-form e query string sem parser próprio.
 */
function pathnameEfetivo(requisicao: RequisicaoDaFronteira): string {
  if (typeof requisicao.path === "string" && requisicao.path !== "") {
    return requisicao.path;
  }
  return pathnameDoRequestTarget(requisicao.url);
}

/**
 * Normaliza o caminho para o mesmo critério com que o roteador do Express
 * casa a rota (`F-06`).
 *
 * O roteador aceita `/auth/login/` e `/AUTH/LOGIN` para o MESMO handler; o
 * filtro anterior comparava a URL crua e não reconhecia essas variantes, de
 * modo que o erro do body parser voltava a vazar por elas — exatamente o
 * defeito que o filtro existe para corrigir. Normaliza-se APENAS o que o
 * roteador já trata como equivalente: caixa e barra final. Nenhum outro
 * caminho é colapsado.
 */
function caminhoNormalizado(requisicao: RequisicaoDaFronteira): string {
  const minusculo = pathnameEfetivo(requisicao).toLowerCase();
  if (minusculo.length > 1 && minusculo.endsWith("/")) {
    return minusculo.slice(0, -1);
  }
  return minusculo;
}

/** `true` sse a requisição é uma das duas operações da F3. */
function ehOperacaoDaFronteira(requisicao: RequisicaoDaFronteira): boolean {
  return (
    requisicao.method?.toUpperCase() === METODO_DA_FRONTEIRA &&
    ROTAS_DA_FRONTEIRA.has(caminhoNormalizado(requisicao))
  );
}

/** `true` sse a exceção já carrega o contrato fechado da fronteira. */
function codigoDaFronteira(excecao: HttpException): string | null {
  const corpo: unknown = excecao.getResponse();
  if (typeof corpo !== "object" || corpo === null) return null;
  const codigo = (corpo as Record<string, unknown>)["erro"];
  if (typeof codigo !== "string" || !CODIGOS_DA_FRONTEIRA.has(codigo)) return null;
  return codigo;
}

/**
 * Status 4xx declarado por erros que NÃO são `HttpException` (`F-03`).
 *
 * O body parser roda como middleware global, antes do roteamento, e rejeita
 * corpo malformado e corpo acima do limite com erros do contrato
 * `http-errors` — que expõem `status`/`statusCode` mas não são
 * `HttpException`. A versão anterior os classificava no ramo genérico e
 * devolvia `500 FALHA_INTERNA` com log de ERRO: um corpo de 200 KB,
 * enviado por QUALQUER cliente sem custom header e sem autenticação, gerava
 * uma entrada de log de erro. Isso poluía o log e destruía o significado
 * operacional de `500` — que existe justamente para marcar incidente de
 * infraestrutura.
 */
function statusDeErroDoCliente(excecao: unknown): number | null {
  if (typeof excecao !== "object" || excecao === null) return null;
  const candidato = excecao as { status?: unknown; statusCode?: unknown };
  const bruto =
    typeof candidato.status === "number"
      ? candidato.status
      : typeof candidato.statusCode === "number"
        ? candidato.statusCode
        : null;
  if (bruto === null || !Number.isInteger(bruto) || bruto < 400 || bruto > 499) {
    return null;
  }
  return bruto;
}

@Catch()
export class FiltroErroAutenticacao extends BaseExceptionFilter {
  readonly #logger = new Logger("Autenticacao");

  override catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const requisicao = contexto.getRequest<RequisicaoDaFronteira>();
    if (!ehOperacaoDaFronteira(requisicao)) {
      super.catch(excecao, host);
      return;
    }

    const resposta = contexto.getResponse<RespostaEscrevivel>();

    if (excecao instanceof HttpException) {
      const codigo = codigoDaFronteira(excecao);
      if (codigo !== null) {
        // Caminho normal: a própria fronteira decidiu. Reescrito aqui — e não
        // delegado — para que TODA resposta destas rotas saia por um ponto só.
        resposta.status(excecao.getStatus()).json({ erro: codigo });
        return;
      }
      // `HttpException` de terceiros: status preservado, corpo normalizado.
      resposta
        .status(excecao.getStatus())
        .json({ erro: ERRO.REQUISICAO_INVALIDA });
      return;
    }

    // Erro 4xx do CLIENTE que não é `HttpException` — tipicamente o body
    // parser (`400` malformado, `413` acima do limite). Status real
    // preservado, corpo normalizado e NENHUM log de erro: a falha é do
    // pedido, não do serviço.
    const statusDoCliente = statusDeErroDoCliente(excecao);
    if (statusDoCliente !== null) {
      resposta.status(statusDoCliente).json({ erro: ERRO.REQUISICAO_INVALIDA });
      return;
    }

    // Exceção NÃO-HTTP e não atribuível ao pedido: falha técnica. Nunca vira
    // `401` — devolver credencial inválida para uma indisponibilidade
    // destruiria a observabilidade operacional e mentiria para o cliente.
    const correlacaoId = randomUUID();
    this.#logger.error(
      `Falha inesperada na fronteira de autenticação. classe=${
        excecao instanceof Error ? excecao.name : typeof excecao
      } correlacao=${correlacaoId}`,
    );
    resposta.status(500).json({ erro: ERRO.FALHA_INTERNA });
  }
}
