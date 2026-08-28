// TechLab Fisio — política de cookie de sessão (Etapa 2.3D-B / F3).
//
// Materializa a metade "cookie" de `D-2.3D-07` (`docs/12` §5.7):
//
//   HTTPS (produção/homologação)
//     __Host-tlf_sessao · HttpOnly · Secure · SameSite=Strict · Path=/ · sem Domain
//
//   Desenvolvimento HTTP local — nome SEMPRE distinto
//     tlf_sessao_dev · HttpOnly · SameSite=Strict · Path=/ · sem Domain
//
// e o tratamento de `R-2.3D-04` ("configuração insegura de cookie vazar para
// produção"), cujo tratamento homologado é **falha no bootstrap**.
//
// FONTE ÚNICA — set E clear (exigência explícita do enunciado da F3): as duas
// operações derivam do MESMO objeto `PoliticaCookieSessao`. Não existe neste
// arquivo, nem em nenhum outro, um segundo lugar onde o nome ou os atributos
// do cookie sejam escritos. `montarCabecalhoLimpeza` reaproveita literalmente
// os atributos de `montarCabecalhoSessao`: divergir é impossível por
// construção, e não apenas por disciplina.
//
// SEM DETECÇÃO DE NAVEGADOR (`D-2.3D-07`, alternativa A-09 rejeitada em
// `docs/12` §6): a decisão é do AMBIENTE do processo, tomada uma única vez no
// bootstrap. Nenhum cabeçalho de requisição participa dela.
//
// SEM DEPENDÊNCIA NOVA: a serialização de `Set-Cookie` é uma concatenação de
// atributos de conjunto FECHADO — nenhum valor arbitrário do usuário entra no
// cabeçalho (o token é validado quanto à forma antes, e seu alfabeto é
// `base64url` + `.`). `cookie`/`cookie-parser` resolveriam um problema que
// aqui não existe (TLF-BASE-V1 §14 — dependência nova exige justificativa).

/** Ambientes reconhecidos. Conjunto FECHADO — valor fora dele é rejeitado. */
export const AMBIENTES = ["producao", "homologacao", "desenvolvimento", "teste"] as const;

export type Ambiente = (typeof AMBIENTES)[number];

/** Ambientes que `D-2.3D-07` trata como servidos por HTTPS. */
const AMBIENTES_PROTEGIDOS: ReadonlySet<Ambiente> = new Set<Ambiente>([
  "producao",
  "homologacao",
]);

/** Variável que declara o ambiente do processo. OBRIGATÓRIA (`F-02`). */
export const VARIAVEL_AMBIENTE = "TLF_AMBIENTE";

export const NOME_COOKIE_PROTEGIDO = "__Host-tlf_sessao";
export const NOME_COOKIE_DESENVOLVIMENTO = "tlf_sessao_dev";

/**
 * Protocolos de origem aceitáveis por ambiente — consumido pela validação de
 * `Origin` da baseline CSRF (`F-13`).
 *
 * Ambiente protegido é servido por HTTPS (`D-2.3D-07`), logo uma `Origin`
 * `http:` nunca é legítima ali. Em desenvolvimento/teste os dois protocolos
 * são admitidos: o padrão é HTTP local, mas certificados locais são um arranjo
 * corriqueiro e recusá-los quebraria cenário legítimo sem ganho algum — o
 * ambiente já não emite cookie `Secure`.
 */
const PROTOCOLOS_POR_AMBIENTE: Readonly<Record<Ambiente, readonly string[]>> =
  Object.freeze({
    producao: ["https:"],
    homologacao: ["https:"],
    desenvolvimento: ["http:", "https:"],
    teste: ["http:", "https:"],
  });

export type MotivoFalhaCookie =
  /** `TLF_AMBIENTE` ausente ou vazia — `F-02`, fail-closed. */
  | "AMBIENTE_AUSENTE"
  /** `TLF_AMBIENTE` presente com valor fora do conjunto fechado. */
  | "AMBIENTE_DESCONHECIDO"
  /** `NODE_ENV=production` sem ambiente protegido declarado — `R-2.3D-04`. */
  | "AMBIENTE_INCOERENTE_COM_NODE_ENV"
  /** A política construída para ambiente protegido não é a segura — `R-2.3D-04`. */
  | "POLITICA_INSEGURA_EM_AMBIENTE_PROTEGIDO";

export class ErroPoliticaCookie extends Error {
  override readonly name = "ErroPoliticaCookie";

  constructor(
    readonly motivo: MotivoFalhaCookie,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Política resolvida do cookie de sessão. Imutável. */
export interface PoliticaCookieSessao {
  readonly ambiente: Ambiente;
  readonly nome: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict";
  readonly path: "/";
  /** SEMPRE ausente: `__Host-` a proíbe, e o MVP é same-origin. */
  readonly domain: undefined;
  /** Protocolos que uma `Origin` legítima pode ter neste ambiente (`F-13`). */
  readonly protocolosDeOrigem: readonly string[];
}

/** Token de injeção da política resolvida. */
export const POLITICA_COOKIE_SESSAO = Symbol("POLITICA_COOKIE_SESSAO");

function normalizar(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim().toLowerCase();
  return limpo === "" ? undefined : limpo;
}

function ehAmbiente(valor: string): valor is Ambiente {
  return (AMBIENTES as readonly string[]).includes(valor);
}

/**
 * Resolve a política de cookie a partir do ambiente do processo — e FALHA
 * quando a configuração observada não é seguramente interpretável.
 *
 * `R-2.3D-04` em QUATRO barreiras, todas fail-closed:
 *
 *   1. `TLF_AMBIENTE` AUSENTE ou vazia é ERRO — correção `F-02`. A versão
 *      anterior assumia `desenvolvimento` por omissão, e a revisão
 *      independente mediu o modo de falha exato que o risco vigia: um deploy
 *      de produção que não declarasse a variável (nem `NODE_ENV=production`)
 *      subia emitindo `tlf_sessao_dev` sem `Secure`. Omissão não pode
 *      significar "é desenvolvimento": significa que ninguém declarou nada, e
 *      a aplicação não tem como saber onde está;
 *   2. `TLF_AMBIENTE` com valor desconhecido também é erro — um typo
 *      (`producao` → `prd`) nunca degrada para dev;
 *   3. `NODE_ENV=production` com ambiente não protegido é erro. Barreira de
 *      COERÊNCIA adicional; jamais um fallback permissivo que substitua a
 *      declaração explícita;
 *   4. a política construída para ambiente protegido é REVERIFICADA contra a
 *      invariante de `D-2.3D-07` antes de ser devolvida. É redundante por
 *      construção, e deliberadamente: ela transforma qualquer futura
 *      alteração da montagem (um `secure: false` introduzido por engano) em
 *      falha de bootstrap em vez de cookie inseguro em produção.
 *
 * NÃO EXISTE ESCAPE: nenhuma variável de ambiente afrouxa os atributos, e não
 * existe default. A única entrada é a declaração explícita de qual ambiente é
 * este.
 */
export function resolverPoliticaCookieSessao(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PoliticaCookieSessao {
  const declarado = normalizar(env[VARIAVEL_AMBIENTE]);
  if (declarado === undefined) {
    throw new ErroPoliticaCookie(
      "AMBIENTE_AUSENTE",
      `${VARIAVEL_AMBIENTE} não declarada: a aplicação NÃO assume ambiente por ` +
        `omissão. Declare um valor do conjunto homologado (${AMBIENTES.join(", ")}). ` +
        "O bootstrap foi abortado (R-2.3D-04, D-2.3D-07).",
    );
  }
  if (!ehAmbiente(declarado)) {
    // O VALOR não é ecoado: variável de ambiente pode conter qualquer coisa.
    throw new ErroPoliticaCookie(
      "AMBIENTE_DESCONHECIDO",
      `${VARIAVEL_AMBIENTE} inválida: o valor não pertence ao conjunto homologado ` +
        `(${AMBIENTES.join(", ")}). O bootstrap foi abortado — a aplicação não assume ` +
        "desenvolvimento por omissão de valor válido.",
    );
  }
  const ambiente: Ambiente = declarado;

  const nodeEnv = normalizar(env["NODE_ENV"]);
  if (nodeEnv === "production" && !AMBIENTES_PROTEGIDOS.has(ambiente)) {
    throw new ErroPoliticaCookie(
      "AMBIENTE_INCOERENTE_COM_NODE_ENV",
      `NODE_ENV=production exige ${VARIAVEL_AMBIENTE} declarada como "producao" ou ` +
        `"homologacao"; o ambiente resolvido foi "${ambiente}". O bootstrap foi ` +
        "abortado para que produção NUNCA inicialize com cookie de desenvolvimento " +
        "(R-2.3D-04, D-2.3D-07).",
    );
  }

  const protegido = AMBIENTES_PROTEGIDOS.has(ambiente);
  const politica: PoliticaCookieSessao = Object.freeze({
    ambiente,
    nome: protegido ? NOME_COOKIE_PROTEGIDO : NOME_COOKIE_DESENVOLVIMENTO,
    httpOnly: true,
    secure: protegido,
    sameSite: "Strict",
    path: "/",
    domain: undefined,
    protocolosDeOrigem: PROTOCOLOS_POR_AMBIENTE[ambiente],
  });

  exigirPoliticaSeguraEmAmbienteProtegido(politica);
  return politica;
}

/**
 * Barreira 3 de `R-2.3D-04`. Separada da montagem de propósito: é a única
 * parte do arquivo que sobreviveria intacta a uma reescrita da montagem, e é
 * ela que o mutation challenge "não marcar cookie Secure em produção" atinge.
 */
export function exigirPoliticaSeguraEmAmbienteProtegido(
  politica: PoliticaCookieSessao,
): void {
  if (!AMBIENTES_PROTEGIDOS.has(politica.ambiente)) return;

  const violacoes: string[] = [];
  if (politica.nome !== NOME_COOKIE_PROTEGIDO) violacoes.push("nome");
  if (!politica.nome.startsWith("__Host-")) violacoes.push("prefixo __Host-");
  if (!politica.secure) violacoes.push("Secure");
  if (!politica.httpOnly) violacoes.push("HttpOnly");
  if (politica.sameSite !== "Strict") violacoes.push("SameSite=Strict");
  if (politica.path !== "/") violacoes.push("Path=/");
  if (politica.domain !== undefined) violacoes.push("ausência de Domain");
  if (
    politica.protocolosDeOrigem.length !== 1 ||
    politica.protocolosDeOrigem[0] !== "https:"
  ) {
    violacoes.push("origem exclusivamente https:");
  }

  if (violacoes.length > 0) {
    throw new ErroPoliticaCookie(
      "POLITICA_INSEGURA_EM_AMBIENTE_PROTEGIDO",
      `Configuração insegura de cookie em ambiente "${politica.ambiente}": ` +
        `${violacoes.join(", ")}. O bootstrap foi abortado (R-2.3D-04, D-2.3D-07).`,
    );
  }
}

/**
 * Atributos comuns a `Set-Cookie` de emissão e de limpeza — a razão pela qual
 * set e clear não podem divergir.
 */
function atributos(politica: PoliticaCookieSessao): string[] {
  const partes = [`Path=${politica.path}`, `SameSite=${politica.sameSite}`];
  if (politica.httpOnly) partes.push("HttpOnly");
  if (politica.secure) partes.push("Secure");
  // `Domain` NUNCA é emitido — nem em desenvolvimento (`D-2.3D-07`).
  return partes;
}

/**
 * `Set-Cookie` que ENTREGA o token de sessão.
 *
 * SEM `Max-Age`/`Expires` — DECISÃO LOCAL DE IMPLEMENTAÇÃO (não é norma
 * permanente): o cookie é de sessão de navegador, e some ao fechá-lo.
 * `D-2.3D-07` não fixa persistência, e `D-2.3D-04` já enforça o teto absoluto
 * de 8 h NO BACKEND. Um `Max-Age` seria, na melhor hipótese, uma segunda
 * fonte da mesma verdade; na pior, um cookie sobrevivente ao fechamento do
 * navegador sem ganho algum de segurança. Reverter esta escolha é decisão de
 * implementação, não reabertura de decisão homologada.
 */
export function montarCabecalhoSessao(
  politica: PoliticaCookieSessao,
  token: string,
): string {
  return [`${politica.nome}=${token}`, ...atributos(politica)].join("; ");
}

/**
 * `Set-Cookie` que INVALIDA o cookie de sessão no agente do usuário.
 *
 * Valor vazio + `Max-Age=0`: o cookie só é substituído quando nome, `Path` e
 * `Domain` coincidem com os da emissão — daí a reutilização literal de
 * `atributos()`. Um clear com atributos divergentes deixaria o cookie
 * original vivo no navegador, que é o defeito clássico desta operação.
 */
export function montarCabecalhoLimpeza(politica: PoliticaCookieSessao): string {
  return [`${politica.nome}=`, ...atributos(politica), "Max-Age=0"].join("; ");
}

/**
 * Extrai o valor do cookie de sessão do cabeçalho `Cookie` bruto.
 *
 * FAIL-CLOSED: devolve `null` para cabeçalho ausente, vazio, malformado ou
 * sem o cookie procurado. Nunca lança — um cabeçalho hostil não pode derrubar
 * a fronteira HTTP nem produzir mensagem que ecoe seu conteúdo.
 *
 * O primeiro par com o nome procurado vence: duplicatas (possíveis com
 * escopos de `Path`/`Domain` diferentes) não são combinadas nem concatenadas.
 */
export function lerCookieSessao(
  cabecalhoCookie: unknown,
  politica: PoliticaCookieSessao,
): string | null {
  if (typeof cabecalhoCookie !== "string" || cabecalhoCookie === "") return null;
  for (const par of cabecalhoCookie.split(";")) {
    const separador = par.indexOf("=");
    if (separador <= 0) continue;
    const nome = par.slice(0, separador).trim();
    if (nome !== politica.nome) continue;
    const valor = par.slice(separador + 1).trim();
    return valor === "" ? null : valor;
  }
  return null;
}
