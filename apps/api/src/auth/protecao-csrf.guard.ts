// TechLab Fisio — proteção CSRF da primeira API JSON (Etapa 2.3D-B / F3).
//
// Materializa a metade "CSRF" de `D-2.3D-07` (`docs/12` §5.7) — a baseline
// homologada, exatamente e nada além dela:
//
//   1. custom request header OBRIGATÓRIO nas mutações;
//   2. Fetch Metadata;
//   3. validação de `Origin` como fallback/defesa complementar;
//   4. `SameSite=Strict` (em `politica-cookie.ts`);
//   5. somente `application/json` nos contratos mutáveis relevantes;
//   6. CORS desabilitado enquanto a arquitetura for same-origin (em `main.ts`
//      — pela AUSÊNCIA de `enableCors`; ver `openapi`/testes de fronteira).
//
// NÃO IMPLEMENTA synchronizer token, e não o registra como obrigação futura
// (`D-2.3D-07`, alternativa A-10 de `docs/12` §6). `P-2.3D-04` permanece
// ABERTA para reavaliação quando o `apps/web` real existir.
//
// POR QUE CADA CAMADA EXISTE — e por que nenhuma sozinha basta:
//   - o CUSTOM HEADER é a barreira primária: um `<form>` cross-site não
//     consegue emiti-lo, e um `fetch` cross-site que tente emiti-lo dispara
//     preflight CORS — que ninguém responde, porque CORS está desabilitado;
//   - `application/json` fecha a brecha clássica do formulário HTML, que só
//     produz `text/plain`, `application/x-www-form-urlencoded` e
//     `multipart/form-data`;
//   - FETCH METADATA rejeita a navegação/subrecurso cross-site em navegadores
//     que a enviam, ANTES de qualquer raciocínio sobre `Origin`;
//   - `ORIGIN` é a defesa complementar de `D-2.3D-07`: quando presente, tem de
//     ser a própria origem.
//
// FAIL-CLOSED SEM QUEBRAR O LEGÍTIMO: cabeçalho ausente NÃO é tratado como
// cabeçalho válido — mas a ausência de `Origin`/Fetch Metadata (clientes não
// navegador; `curl` do operador; o smoke da CI) não derruba sozinha a
// requisição, porque a barreira primária — o custom header — é obrigatória em
// todos os casos e é justamente a que um navegador atacante não transpõe.
// Quando esses cabeçalhos VÊM, eles precisam estar corretos.
//
// A GUARD NÃO AUTENTICA NADA. Ela não lê cookie, não consulta banco, não
// emite auditoria e não distingue usuário — é anterior a tudo isso. Guards e
// decorators de AUTORIZAÇÃO (RBAC) são da F4 e não nascem aqui.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { POLITICA_COOKIE_SESSAO } from "./politica-cookie.js";
import type { PoliticaCookieSessao } from "./politica-cookie.js";

/**
 * DECISÃO LOCAL DE IMPLEMENTAÇÃO (não é norma permanente): `D-2.3D-07` exige
 * "custom request header obrigatório" e não fixa o nome. Adotado
 * `X-TLF-Requisicao` — prefixo do produto, claro, estável e sem colisão com
 * cabeçalho padronizado. O que confere a proteção é o NOME ser não-simples
 * (obriga preflight cross-origin), não o valor; por isso exige-se presença e
 * valor não vazio, e nenhum valor mágico é comparado.
 */
export const CABECALHO_REQUISICAO_TLF = "x-tlf-requisicao";

/** Content type único admitido nas mutações (`D-2.3D-07`). */
const TIPO_CONTEUDO_EXIGIDO = "application/json";

/** `Sec-Fetch-Site` aceitos: a própria origem, ou origem nenhuma (barra de endereço). */
const SITES_ACEITOS: ReadonlySet<string> = new Set(["same-origin", "none"]);

/** `Sec-Fetch-Dest` aceito: requisição de dados, nunca navegação/subrecurso. */
const DESTINOS_ACEITOS: ReadonlySet<string> = new Set(["empty"]);

/** `Sec-Fetch-Mode` recusado explicitamente: navegação de topo. */
const MODOS_RECUSADOS: ReadonlySet<string> = new Set(["navigate", "nested-navigate"]);

export type MotivoRejeicaoCsrf =
  | "CONTENT_TYPE_INVALIDO"
  | "CABECALHO_REQUISICAO_AUSENTE"
  | "FETCH_METADATA_INCOMPATIVEL"
  | "ORIGIN_INVALIDA";

/**
 * Forma mínima da requisição consumida por esta guard. Estrutural de
 * propósito: a fronteira não se acopla ao tipo de nenhuma plataforma HTTP.
 */
export interface RequisicaoInspecionavel {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

function cabecalho(
  requisicao: RequisicaoInspecionavel,
  nome: string,
): string | undefined {
  const bruto = requisicao.headers[nome];
  const valor = Array.isArray(bruto) ? bruto[0] : bruto;
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
}

/**
 * Avalia a baseline CSRF sobre uma requisição. Função PURA — devolve o motivo
 * da rejeição ou `null`. Separada da guard para ser provada diretamente, sem
 * container e sem servidor.
 */
export function avaliarProtecaoCsrf(
  requisicao: RequisicaoInspecionavel,
  /**
   * Protocolos que uma `Origin` legítima pode ter neste ambiente (`F-13`).
   * Vem da política de cookie já homologada — produção/homologação são
   * servidas por HTTPS, logo `http:` nunca é origem legítima lá.
   */
  protocolosDeOrigem: readonly string[],
): MotivoRejeicaoCsrf | null {
  // 1. Somente `application/json` (parâmetros como `; charset=utf-8` são
  //    legítimos e não alteram o media type).
  const tipoConteudo = cabecalho(requisicao, "content-type");
  const mediaType = tipoConteudo?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== TIPO_CONTEUDO_EXIGIDO) return "CONTENT_TYPE_INVALIDO";

  // 2. Custom header obrigatório — barreira primária.
  if (cabecalho(requisicao, CABECALHO_REQUISICAO_TLF) === undefined) {
    return "CABECALHO_REQUISICAO_AUSENTE";
  }

  // 3. Fetch Metadata — avaliada apenas quando enviada.
  const site = cabecalho(requisicao, "sec-fetch-site")?.toLowerCase();
  if (site !== undefined && !SITES_ACEITOS.has(site)) {
    return "FETCH_METADATA_INCOMPATIVEL";
  }
  const modo = cabecalho(requisicao, "sec-fetch-mode")?.toLowerCase();
  if (modo !== undefined && MODOS_RECUSADOS.has(modo)) {
    return "FETCH_METADATA_INCOMPATIVEL";
  }
  const destino = cabecalho(requisicao, "sec-fetch-dest")?.toLowerCase();
  if (destino !== undefined && !DESTINOS_ACEITOS.has(destino)) {
    return "FETCH_METADATA_INCOMPATIVEL";
  }

  // 4. `Origin` como defesa complementar: quando presente, tem de ser a
  //    própria origem. A comparação é feita contra o `Host` da requisição —
  //    a arquitetura é same-origin e CORS está desabilitado, logo não existe
  //    lista de origens externas legítimas contra a qual comparar.
  const origem = cabecalho(requisicao, "origin");
  if (origem !== undefined) {
    const anfitriao = cabecalho(requisicao, "host");
    if (anfitriao === undefined) return "ORIGIN_INVALIDA";
    let analisada: URL;
    try {
      analisada = new URL(origem);
    } catch {
      // Inclui o literal `null`, que navegadores enviam em contextos opacos
      // (sandbox, redirecionamento cross-origin) — nunca é a própria origem.
      return "ORIGIN_INVALIDA";
    }
    if (analisada.host.toLowerCase() !== anfitriao.toLowerCase()) {
      return "ORIGIN_INVALIDA";
    }
    // `F-13` — o HOST sozinho não basta: sob HTTPS, uma `Origin` `http://` do
    // mesmo host é outra origem para o navegador e não pode ser legítima. O
    // protocolo esperado vem do AMBIENTE (política de cookie), nunca de
    // `X-Forwarded-Proto`, que é escrito pelo cliente e cuja topologia de
    // proxy não está homologada.
    if (!protocolosDeOrigem.includes(analisada.protocol.toLowerCase())) {
      return "ORIGIN_INVALIDA";
    }
  }

  return null;
}

/**
 * Guard aplicada às MUTAÇÕES da fronteira de autenticação.
 *
 * Inclusive ao LOGIN, deliberadamente: login-CSRF (forçar a vítima a
 * autenticar-se na conta do atacante) é um ataque real, e o custo de proteger
 * é zero para o cliente legítimo, que já emite o header.
 *
 * A rejeição é UNIFORME: `403` com corpo estável, sem dizer QUAL camada
 * recusou. O motivo tipado existe para teste e para o código, não para o
 * cliente — informá-lo ensinaria o atacante exatamente o que ajustar.
 */
@Injectable()
export class ProtecaoCsrfGuard implements CanActivate {
  constructor(
    @Inject(POLITICA_COOKIE_SESSAO)
    private readonly politica: PoliticaCookieSessao,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoInspecionavel>();
    if (avaliarProtecaoCsrf(requisicao, this.politica.protocolosDeOrigem) !== null) {
      throw new ForbiddenException({ erro: "REQUISICAO_NAO_AUTORIZADA" });
    }
    return true;
  }
}
