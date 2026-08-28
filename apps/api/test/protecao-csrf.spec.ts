// TechLab Fisio — Etapa 2.3D-B / F3 — baseline CSRF (`D-2.3D-07`).
//
// Prova a regra pura (`avaliarProtecaoCsrf`) camada por camada e a guard
// (`ProtecaoCsrfGuard`) como fronteira de rejeição uniforme. A prova de que a
// guard está de fato APLICADA às rotas — e de que CORS não está habilitado —
// é feita contra o servidor HTTP real na suíte de integração.

import { describe, expect, it } from "@jest/globals";
import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import {
  CABECALHO_REQUISICAO_TLF,
  ProtecaoCsrfGuard,
  avaliarProtecaoCsrf as avaliarBruto,
} from "../src/auth/protecao-csrf.guard.js";
import type { RequisicaoInspecionavel } from "../src/auth/protecao-csrf.guard.js";
import { resolverPoliticaCookieSessao } from "../src/auth/politica-cookie.js";

/** Ambiente HTTPS — o que produção e homologação usam (`F-13`). */
const PROTEGIDO = resolverPoliticaCookieSessao({ TLF_AMBIENTE: "producao" });
/** Ambiente local, onde `http:` também é origem legítima. */
const LOCAL = resolverPoliticaCookieSessao({ TLF_AMBIENTE: "desenvolvimento" });

/**
 * Avalia no ambiente PROTEGIDO por padrão — é onde a regra é mais estrita e,
 * portanto, onde os testes precisam morar.
 */
function avaliarProtecaoCsrf(
  requisicao: RequisicaoInspecionavel,
  protocolos: readonly string[] = PROTEGIDO.protocolosDeOrigem,
): ReturnType<typeof avaliarBruto> {
  return avaliarBruto(requisicao, protocolos);
}

const ANFITRIAO = "app.techlab.local";

/** Requisição legítima do frontend same-origin previsto pelos documentos. */
function requisicaoLegitima(
  ajustes: Record<string, string | string[] | undefined> = {},
): RequisicaoInspecionavel {
  return {
    headers: {
      "content-type": "application/json",
      [CABECALHO_REQUISICAO_TLF]: "1",
      host: ANFITRIAO,
      origin: `https://${ANFITRIAO}`,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      ...ajustes,
    },
  };
}

describe("D-2.3D-07 — requisição legítima passa", () => {
  it("o cenário completo do frontend same-origin é aceito", () => {
    expect(avaliarProtecaoCsrf(requisicaoLegitima())).toBeNull();
  });

  it("parâmetros do content-type não invalidam o media type", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({ "content-type": "application/json; charset=utf-8" }),
      ),
    ).toBeNull();
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ "content-type": "APPLICATION/JSON" })),
    ).toBeNull();
  });

  it("cliente NÃO navegador (sem Origin e sem Fetch Metadata) é aceito", () => {
    // Fail-closed sem quebrar o legítimo: o smoke da CI e o `curl` do operador
    // não emitem Origin nem Sec-Fetch-*. A barreira primária — o custom header
    // — continua obrigatória para eles.
    expect(
      avaliarProtecaoCsrf({
        headers: {
          "content-type": "application/json",
          [CABECALHO_REQUISICAO_TLF]: "1",
          host: ANFITRIAO,
        },
      }),
    ).toBeNull();
  });

  it("Sec-Fetch-Site: none (barra de endereço) é aceito", () => {
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ "sec-fetch-site": "none" })),
    ).toBeNull();
  });
});

describe("D-2.3D-07 — content type", () => {
  it.each([
    ["application/x-www-form-urlencoded", "formulário HTML clássico"],
    ["multipart/form-data", "formulário com upload"],
    ["text/plain", "formulário com enctype text/plain"],
    ["application/xml", "outro media type"],
  ])("%s é rejeitado (%s)", (tipo) => {
    expect(avaliarProtecaoCsrf(requisicaoLegitima({ "content-type": tipo }))).toBe(
      "CONTENT_TYPE_INVALIDO",
    );
  });

  it("content-type ausente é rejeitado", () => {
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ "content-type": undefined })),
    ).toBe("CONTENT_TYPE_INVALIDO");
  });
});

describe("D-2.3D-07 — custom request header obrigatório", () => {
  it("header ausente é rejeitado", () => {
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ [CABECALHO_REQUISICAO_TLF]: undefined })),
    ).toBe("CABECALHO_REQUISICAO_AUSENTE");
  });

  it("header vazio ou só com espaços é rejeitado", () => {
    for (const valor of ["", "   "]) {
      expect(
        avaliarProtecaoCsrf(requisicaoLegitima({ [CABECALHO_REQUISICAO_TLF]: valor })),
      ).toBe("CABECALHO_REQUISICAO_AUSENTE");
    }
  });

  it("qualquer valor não vazio serve — a proteção está no NOME do header", () => {
    for (const valor of ["1", "true", "tlf", "x"]) {
      expect(
        avaliarProtecaoCsrf(requisicaoLegitima({ [CABECALHO_REQUISICAO_TLF]: valor })),
      ).toBeNull();
    }
  });

  it("o nome do header é específico do produto e não colide com padronizados", () => {
    expect(CABECALHO_REQUISICAO_TLF).toBe("x-tlf-requisicao");
  });
});

describe("D-2.3D-07 — Fetch Metadata", () => {
  it.each(["cross-site", "same-site"])(
    "Sec-Fetch-Site: %s é rejeitado",
    (site) => {
      expect(avaliarProtecaoCsrf(requisicaoLegitima({ "sec-fetch-site": site }))).toBe(
        "FETCH_METADATA_INCOMPATIVEL",
      );
    },
  );

  it.each(["navigate", "nested-navigate"])(
    "Sec-Fetch-Mode: %s é rejeitado",
    (modo) => {
      expect(avaliarProtecaoCsrf(requisicaoLegitima({ "sec-fetch-mode": modo }))).toBe(
        "FETCH_METADATA_INCOMPATIVEL",
      );
    },
  );

  it.each(["document", "iframe", "image", "script"])(
    "Sec-Fetch-Dest: %s é rejeitado",
    (destino) => {
      expect(avaliarProtecaoCsrf(requisicaoLegitima({ "sec-fetch-dest": destino }))).toBe(
        "FETCH_METADATA_INCOMPATIVEL",
      );
    },
  );

  it("Fetch Metadata é avaliada mesmo com o custom header presente", () => {
    // As camadas são cumulativas: nenhuma dispensa a outra.
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({
          [CABECALHO_REQUISICAO_TLF]: "1",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe("FETCH_METADATA_INCOMPATIVEL");
  });
});

describe("D-2.3D-07 — Origin como defesa complementar", () => {
  it("Origin de outro host é rejeitada", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({
          origin: "https://atacante.example",
          "sec-fetch-site": undefined,
        }),
      ),
    ).toBe("ORIGIN_INVALIDA");
  });

  it("Origin opaca (literal null) é rejeitada", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({ origin: "null", "sec-fetch-site": undefined }),
      ),
    ).toBe("ORIGIN_INVALIDA");
  });

  it("Origin não analisável é rejeitada", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({ origin: "://quebrado", "sec-fetch-site": undefined }),
      ),
    ).toBe("ORIGIN_INVALIDA");
  });

  it("Origin com porta divergente é rejeitada — o host inclui a porta", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({
          host: "localhost:3000",
          origin: "http://localhost:3001",
          "sec-fetch-site": undefined,
        }),
        LOCAL.protocolosDeOrigem,
      ),
    ).toBe("ORIGIN_INVALIDA");
  });

  it("Origin da própria origem é aceita, inclusive com porta", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({ host: "localhost:3000", origin: "http://localhost:3000" }),
        LOCAL.protocolosDeOrigem,
      ),
    ).toBeNull();
  });

  it("F-13 — em ambiente HTTPS, Origin `http:` do mesmo host é REJEITADA", () => {
    // O host sozinho não basta: para o navegador, `http://x` e `https://x` são
    // origens diferentes. A versão anterior aceitava a primeira.
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ origin: `http://${ANFITRIAO}` })),
    ).toBe("ORIGIN_INVALIDA");
    // A mesma origem sobre HTTPS continua aceita.
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ origin: `https://${ANFITRIAO}` })),
    ).toBeNull();
  });

  it("F-13 — em ambiente LOCAL, `http:` continua legítimo", () => {
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({ origin: `http://${ANFITRIAO}` }),
        LOCAL.protocolosDeOrigem,
      ),
    ).toBeNull();
  });

  it("F-13 — o protocolo NÃO vem de cabeçalho do cliente", () => {
    // `X-Forwarded-Proto` é escrito pelo cliente e a topologia de proxy não
    // está homologada: ele não pode influenciar a decisão.
    expect(
      avaliarProtecaoCsrf(
        requisicaoLegitima({
          origin: `http://${ANFITRIAO}`,
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("ORIGIN_INVALIDA");
  });

  it("Origin presente sem Host é rejeitada — não há contra o que comparar", () => {
    expect(
      avaliarProtecaoCsrf(requisicaoLegitima({ host: undefined })),
    ).toBe("ORIGIN_INVALIDA");
  });
});

describe("ProtecaoCsrfGuard — rejeição uniforme", () => {
  function contexto(requisicao: RequisicaoInspecionavel): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => requisicao }),
    } as unknown as ExecutionContext;
  }

  const guard = new ProtecaoCsrfGuard(PROTEGIDO);

  it("deixa passar a requisição legítima", () => {
    expect(guard.canActivate(contexto(requisicaoLegitima()))).toBe(true);
  });

  it("recusa com 403 e corpo estável, sem revelar QUAL camada recusou", () => {
    const recusadas: RequisicaoInspecionavel[] = [
      requisicaoLegitima({ "content-type": "text/plain" }),
      requisicaoLegitima({ [CABECALHO_REQUISICAO_TLF]: undefined }),
      requisicaoLegitima({ "sec-fetch-site": "cross-site" }),
      requisicaoLegitima({ origin: "https://atacante.example" }),
    ];
    const corpos = new Set<string>();
    for (const requisicao of recusadas) {
      try {
        guard.canActivate(contexto(requisicao));
        throw new Error("deveria ter recusado");
      } catch (erro) {
        expect(erro).toBeInstanceOf(ForbiddenException);
        const resposta = (erro as ForbiddenException).getResponse();
        expect(resposta).toEqual({ erro: "REQUISICAO_NAO_AUTORIZADA" });
        expect((erro as ForbiddenException).getStatus()).toBe(403);
        corpos.add(JSON.stringify(resposta));
      }
    }
    // Um único corpo para as quatro camadas: nenhum oráculo de configuração.
    expect(corpos.size).toBe(1);
  });
});
