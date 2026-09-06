// TechLab Fisio — Client HTTP tipado do frontend (@techlab-fisio/web).
//
// Regras de segurança vinculantes (D-2.3D-07 e mitigação de Client-Side CSRF):
//   1. Rotas estritamente relativas iniciando em `/api/` — rejeição em runtime
//      de qualquer URL absoluta (http:, https:, //) ou protocolo arbitrário;
//   2. Injeção automática e mandatória de `x-tlf-requisicao: "1"` em todas as
//      mutações (POST, PUT, PATCH, DELETE);
//   3. Injeção automática de `Content-Type: application/json` quando há corpo;
//   4. Envio padrão same-origin de credenciais/cookies pelo navegador;
//   5. Tipagem e tratamento uniforme dos envelopes de sucesso e erro.

export const CABECALHO_REQUISICAO_TLF = "x-tlf-requisicao";

export type CodigoErroApi =
  | "REQUISICAO_INVALIDA"
  | "CREDENCIAIS_INVALIDAS"
  | "SESSAO_INVALIDA"
  | "TENTATIVAS_EXCEDIDAS"
  | "REQUISICAO_NAO_AUTORIZADA"
  | "FALHA_INTERNA"
  | "FALHA_REDE"
  | "RESPOSTA_INESPERADA";

export interface RespostaSucesso<T> {
  readonly sucesso: true;
  readonly status: number;
  readonly dados: T;
}

export interface RespostaFalha {
  readonly sucesso: false;
  readonly status: number;
  readonly erro: CodigoErroApi;
  readonly mensagem: string;
  readonly retryAfterSegundos?: number;
}

export type ResultadoApi<T> = RespostaSucesso<T> | RespostaFalha;

/**
 * Valida se o caminho é uma rota interna relativa válida iniciando com `/api/`.
 * Lança erro explícito contra vetores de Client-Side CSRF.
 */
export function sanitizarCaminhoApi(caminho: string): string {
  const limpo = caminho.trim();
  if (
    limpo.startsWith("http:") ||
    limpo.startsWith("https:") ||
    limpo.startsWith("//") ||
    limpo.includes("://") ||
    limpo.includes("/../") ||
    limpo.endsWith("/..") ||
    !limpo.startsWith("/api/")
  ) {
    throw new Error(
      `Caminho de API inválido: "${caminho}". Apenas rotas internas relativas iniciando com "/api/" são permitidas.`,
    );
  }
  return limpo;
}

export interface OpcoesRequisicao {
  readonly headers?: Record<string, string>;
}

export async function requisitarApi<T>(
  caminho: string,
  metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  corpo?: unknown,
  opcoes?: OpcoesRequisicao,
): Promise<ResultadoApi<T>> {
  const urlRelativa = sanitizarCaminhoApi(caminho);

  const headers: Record<string, string> = {
    accept: "application/json",
    ...opcoes?.headers,
  };

  const ehMutacao = metodo !== "GET";
  if (ehMutacao) {
    headers[CABECALHO_REQUISICAO_TLF] = "1";
    headers["content-type"] = "application/json";
  }

  let resposta: Response;
  try {
    resposta = await fetch(urlRelativa, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch (err) {
    return {
      sucesso: false,
      status: 0,
      erro: "FALHA_REDE",
      mensagem: err instanceof Error ? err.message : "Falha de conexão com o servidor.",
    };
  }

  const retryAfterHeader = resposta.headers.get("retry-after");
  const retryAfterSegundos = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : undefined;

  if (resposta.status === 204) {
    return {
      sucesso: true,
      status: 204,
      dados: undefined as unknown as T,
    };
  }

  let jsonResposta: unknown;
  try {
    jsonResposta = await resposta.json();
  } catch {
    jsonResposta = null;
  }

  if (!resposta.ok) {
    let codigoErro: CodigoErroApi = "RESPOSTA_INESPERADA";
    if (
      typeof jsonResposta === "object" &&
      jsonResposta !== null &&
      "erro" in jsonResposta &&
      typeof (jsonResposta as Record<string, unknown>)["erro"] === "string"
    ) {
      codigoErro = (jsonResposta as Record<string, unknown>)["erro"] as CodigoErroApi;
    }

    let mensagemAmigavel = "Ocorreu um erro no processamento da solicitação.";
    if (codigoErro === "CREDENCIAIS_INVALIDAS") {
      mensagemAmigavel = "E-mail ou senha incorretos.";
    } else if (codigoErro === "TENTATIVAS_EXCEDIDAS") {
      mensagemAmigavel = retryAfterSegundos
        ? `Muitas tentativas. Aguarde ${retryAfterSegundos} segundos para tentar novamente.`
        : "Muitas tentativas. Tente novamente em alguns minutos.";
    } else if (codigoErro === "REQUISICAO_NAO_AUTORIZADA") {
      mensagemAmigavel = "Acesso recusado pelas políticas de segurança.";
    } else if (codigoErro === "REQUISICAO_INVALIDA") {
      mensagemAmigavel = "Preencha todos os campos obrigatórios corretamente.";
    }

    return {
      sucesso: false,
      status: resposta.status,
      erro: codigoErro,
      mensagem: mensagemAmigavel,
      retryAfterSegundos,
    };
  }

  return {
    sucesso: true,
    status: resposta.status,
    dados: jsonResposta as T,
  };
}

export const clienteHttp = {
  get: <T>(caminho: string, opcoes?: OpcoesRequisicao) =>
    requisitarApi<T>(caminho, "GET", undefined, opcoes),
  post: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) =>
    requisitarApi<T>(caminho, "POST", corpo, opcoes),
  put: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) =>
    requisitarApi<T>(caminho, "PUT", corpo, opcoes),
  patch: <T>(caminho: string, corpo?: unknown, opcoes?: OpcoesRequisicao) =>
    requisitarApi<T>(caminho, "PATCH", corpo, opcoes),
  delete: <T>(caminho: string, opcoes?: OpcoesRequisicao) =>
    requisitarApi<T>(caminho, "DELETE", undefined, opcoes),
};
