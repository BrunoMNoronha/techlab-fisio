// TechLab Fisio — Etapa 2.3D-B / F3 — política de cookie de sessão.
//
// Prova `D-2.3D-07` (atributos por ambiente) e `R-2.3D-04` (a aplicação NÃO
// sobe com configuração insegura de cookie). O fail-fast é testado aqui na
// função pura e, de novo, contra o container NestJS real em
// `auth.module.integration.spec.ts` — as duas provas são complementares:
// esta fixa a REGRA, aquela fixa que a regra está de fato ligada ao bootstrap.

import { describe, expect, it } from "@jest/globals";

import {
  AMBIENTES,
  ErroPoliticaCookie,
  NOME_COOKIE_DESENVOLVIMENTO,
  NOME_COOKIE_PROTEGIDO,
  exigirPoliticaSeguraEmAmbienteProtegido,
  lerCookieSessao,
  montarCabecalhoLimpeza,
  montarCabecalhoSessao,
  resolverPoliticaCookieSessao,
} from "../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../src/auth/politica-cookie.js";

const TOKEN_SINTETICO =
  "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("D-2.3D-07 — atributos do cookie por ambiente", () => {
  it.each(["producao", "homologacao"])(
    "%s usa __Host-tlf_sessao com HttpOnly, Secure, SameSite=Strict, Path=/ e sem Domain",
    (ambiente) => {
      const politica = resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente });
      expect(politica.nome).toBe(NOME_COOKIE_PROTEGIDO);
      expect(politica.httpOnly).toBe(true);
      expect(politica.secure).toBe(true);
      expect(politica.sameSite).toBe("Strict");
      expect(politica.path).toBe("/");
      expect(politica.domain).toBeUndefined();

      const cabecalho = montarCabecalhoSessao(politica, TOKEN_SINTETICO);
      expect(cabecalho).toContain(`${NOME_COOKIE_PROTEGIDO}=${TOKEN_SINTETICO}`);
      expect(cabecalho).toContain("HttpOnly");
      expect(cabecalho).toContain("Secure");
      expect(cabecalho).toContain("SameSite=Strict");
      expect(cabecalho).toContain("Path=/");
      expect(cabecalho).not.toContain("Domain");
    },
  );

  it.each(["desenvolvimento", "teste"])(
    "%s usa o nome DISTINTO tlf_sessao_dev e não marca Secure sobre HTTP local",
    (ambiente) => {
      const politica = resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente });
      expect(politica.nome).toBe(NOME_COOKIE_DESENVOLVIMENTO);
      expect(politica.secure).toBe(false);
      // Os DEMAIS atributos seguros aplicáveis ao ambiente são preservados.
      expect(politica.httpOnly).toBe(true);
      expect(politica.sameSite).toBe("Strict");
      expect(politica.path).toBe("/");
      expect(politica.domain).toBeUndefined();

      const cabecalho = montarCabecalhoSessao(politica, TOKEN_SINTETICO);
      expect(cabecalho).toContain("HttpOnly");
      expect(cabecalho).toContain("SameSite=Strict");
      expect(cabecalho).not.toContain("Secure");
      expect(cabecalho).not.toContain("Domain");
    },
  );

  it("o nome de desenvolvimento é SEMPRE distinto do de produção", () => {
    expect(NOME_COOKIE_DESENVOLVIMENTO).not.toBe(NOME_COOKIE_PROTEGIDO);
    // E não pode carregar o prefixo __Host-, que exige Secure por especificação.
    expect(NOME_COOKIE_DESENVOLVIMENTO.startsWith("__Host-")).toBe(false);
  });

  it("F-02 — TLF_AMBIENTE AUSENTE faz FALHAR; não existe default", () => {
    // Correção pós-revisão: a versão anterior assumia `desenvolvimento` por
    // omissão, e um deploy de produção que esquecesse a variável subia
    // emitindo `tlf_sessao_dev` sem `Secure` — o modo de falha exato que
    // `R-2.3D-04` vigia.
    for (const env of [{}, { TLF_AMBIENTE: "" }, { TLF_AMBIENTE: "   " }]) {
      expect(() => resolverPoliticaCookieSessao(env)).toThrow(ErroPoliticaCookie);
    }
    try {
      resolverPoliticaCookieSessao({});
      throw new Error("deveria ter falhado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPoliticaCookie);
      expect((erro as ErroPoliticaCookie).motivo).toBe("AMBIENTE_AUSENTE");
    }
  });

  it("F-02 — nem mesmo um deploy realista sem variável alguma sobe", () => {
    // Cenário medido pela revisão: container com DATABASE_URL e PORT, sem
    // TLF_AMBIENTE e sem NODE_ENV=production.
    expect(() =>
      resolverPoliticaCookieSessao({
        DATABASE_URL: "postgresql://runtime",
        PORT: "3000",
      }),
    ).toThrow(ErroPoliticaCookie);
  });

  it("normaliza caixa e espaços do valor declarado", () => {
    expect(resolverPoliticaCookieSessao({ TLF_AMBIENTE: "  PRODUCAO " }).nome).toBe(
      NOME_COOKIE_PROTEGIDO,
    );
  });

  it("nenhuma variável de ambiente afrouxa os atributos de produção", () => {
    // Não existe escape: qualquer coisa fora de TLF_AMBIENTE é ignorada.
    const politica = resolverPoliticaCookieSessao({
      TLF_AMBIENTE: "producao",
      TLF_COOKIE_SECURE: "false",
      TLF_COOKIE_SAMESITE: "None",
      TLF_COOKIE_DOMAIN: "exemplo.test",
      COOKIE_INSEGURO: "1",
    });
    expect(politica.secure).toBe(true);
    expect(politica.sameSite).toBe("Strict");
    expect(politica.domain).toBeUndefined();
    expect(politica.nome).toBe(NOME_COOKIE_PROTEGIDO);
  });
});

describe("R-2.3D-04 — produção/homologação não inicializam com configuração insegura", () => {
  it("TLF_AMBIENTE com valor desconhecido FALHA — nunca degrada para desenvolvimento", () => {
    // Um typo plausível ("prd") e um valor arbitrário: nenhum dos dois pode
    // cair silenciosamente em desenvolvimento.
    for (const valor of ["prd", "PROD", "staging", "valor-arbitrario-x9"]) {
      expect(() => resolverPoliticaCookieSessao({ TLF_AMBIENTE: valor })).toThrow(
        ErroPoliticaCookie,
      );
    }
    try {
      resolverPoliticaCookieSessao({ TLF_AMBIENTE: "valor-arbitrario-x9" });
      throw new Error("deveria ter falhado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPoliticaCookie);
      expect((erro as ErroPoliticaCookie).motivo).toBe("AMBIENTE_DESCONHECIDO");
      // O VALOR recebido nunca é ecoado (pode conter qualquer coisa).
      expect((erro as Error).message).not.toContain("valor-arbitrario-x9");
    }
  });

  it("NODE_ENV=production sem ambiente protegido FALHA o bootstrap", () => {
    for (const ambiente of ["desenvolvimento", "teste"]) {
      expect(() =>
        resolverPoliticaCookieSessao({
          NODE_ENV: "production",
          TLF_AMBIENTE: ambiente,
        }),
      ).toThrow(ErroPoliticaCookie);
    }
    // Caso concreto do risco: deploy que ESQUECEU de declarar TLF_AMBIENTE.
    // Sem TLF_AMBIENTE a falha é a de AUSÊNCIA — que também aborta o
    // bootstrap. `NODE_ENV` nunca substitui a declaração explícita.
    try {
      resolverPoliticaCookieSessao({ NODE_ENV: "production" });
      throw new Error("deveria ter falhado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPoliticaCookie);
      expect((erro as ErroPoliticaCookie).motivo).toBe("AMBIENTE_AUSENTE");
    }
  });

  it("NODE_ENV=production COM ambiente protegido é aceito", () => {
    for (const ambiente of ["producao", "homologacao"]) {
      const politica = resolverPoliticaCookieSessao({
        NODE_ENV: "production",
        TLF_AMBIENTE: ambiente,
      });
      expect(politica.secure).toBe(true);
    }
  });

  it("a barreira independente rejeita QUALQUER política insegura em ambiente protegido", () => {
    // Esta é a barreira que sobrevive a uma reescrita da montagem — é ela que
    // o mutation challenge "não marcar Secure em produção" tem de acionar.
    const base: PoliticaCookieSessao = {
      ambiente: "producao",
      nome: NOME_COOKIE_PROTEGIDO,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      domain: undefined,
      protocolosDeOrigem: ["https:"],
    };
    expect(() => exigirPoliticaSeguraEmAmbienteProtegido(base)).not.toThrow();

    const inseguras: Array<[string, PoliticaCookieSessao]> = [
      ["sem Secure", { ...base, secure: false }],
      ["sem HttpOnly", { ...base, httpOnly: false }],
      ["SameSite frouxo", { ...base, sameSite: "Lax" as unknown as "Strict" }],
      ["Path divergente", { ...base, path: "/api" as unknown as "/" }],
      ["com Domain", { ...base, domain: "exemplo.test" as unknown as undefined }],
      ["nome de desenvolvimento", { ...base, nome: NOME_COOKIE_DESENVOLVIMENTO }],
      ["origem http admitida", { ...base, protocolosDeOrigem: ["http:", "https:"] }],
    ];
    for (const [rotulo, politica] of inseguras) {
      expect(() => exigirPoliticaSeguraEmAmbienteProtegido(politica)).toThrow(
        ErroPoliticaCookie,
      );
      expect(rotulo).toBeTruthy();
    }
  });

  it("a barreira não interfere em ambiente não protegido", () => {
    for (const ambiente of ["desenvolvimento", "teste"] as const) {
      expect(() =>
        exigirPoliticaSeguraEmAmbienteProtegido(
          resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente }),
        ),
      ).not.toThrow();
    }
  });

  it("F-13 — o protocolo de origem aceito deriva do ambiente", () => {
    for (const ambiente of ["producao", "homologacao"]) {
      expect(
        resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente }).protocolosDeOrigem,
      ).toEqual(["https:"]);
    }
    for (const ambiente of ["desenvolvimento", "teste"]) {
      expect(
        resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente }).protocolosDeOrigem,
      ).toEqual(["http:", "https:"]);
    }
  });

  it("o conjunto de ambientes é fechado e conhecido", () => {
    expect([...AMBIENTES]).toEqual([
      "producao",
      "homologacao",
      "desenvolvimento",
      "teste",
    ]);
  });
});

describe("set e clear do cookie não podem divergir", () => {
  it.each([...AMBIENTES])(
    "%s — emissão e limpeza compartilham nome, Path, SameSite, HttpOnly e Secure",
    (ambiente) => {
      const politica = resolverPoliticaCookieSessao({ TLF_AMBIENTE: ambiente });
      const emissao = montarCabecalhoSessao(politica, TOKEN_SINTETICO);
      const limpeza = montarCabecalhoLimpeza(politica);

      const atributosDe = (cabecalho: string): string[] =>
        cabecalho
          .split(";")
          .slice(1)
          .map((p) => p.trim())
          .filter((p) => !p.startsWith("Max-Age="));

      expect(limpeza.startsWith(`${politica.nome}=`)).toBe(true);
      expect(atributosDe(limpeza)).toEqual(atributosDe(emissao));
      // O clear precisa zerar valor E prazo, ou o cookie sobrevive.
      expect(limpeza).toContain("Max-Age=0");
      expect(limpeza).toContain(`${politica.nome}=;`);
    },
  );

  it("a emissão NÃO fixa Max-Age/Expires — cookie de sessão de navegador", () => {
    const politica = resolverPoliticaCookieSessao({ TLF_AMBIENTE: "producao" });
    const emissao = montarCabecalhoSessao(politica, TOKEN_SINTETICO);
    expect(emissao).not.toContain("Max-Age");
    expect(emissao).not.toContain("Expires");
  });
});

describe("leitura do cookie de sessão — fail-closed", () => {
  const politica = resolverPoliticaCookieSessao({ TLF_AMBIENTE: "desenvolvimento" });

  it("extrai o valor do cookie correto entre vários", () => {
    const cabecalho = `outro=1; ${politica.nome}=${TOKEN_SINTETICO}; mais=2`;
    expect(lerCookieSessao(cabecalho, politica)).toBe(TOKEN_SINTETICO);
  });

  it("ignora cookie de nome parecido", () => {
    expect(
      lerCookieSessao(`x${politica.nome}=${TOKEN_SINTETICO}`, politica),
    ).toBeNull();
    expect(
      lerCookieSessao(`${politica.nome}_outro=${TOKEN_SINTETICO}`, politica),
    ).toBeNull();
  });

  it("devolve null — sem lançar — para entrada ausente, vazia ou hostil", () => {
    const hostis: unknown[] = [
      undefined,
      null,
      "",
      42,
      {},
      [],
      ";;;",
      "=semnome",
      `${politica.nome}=`,
      `${politica.nome}`,
    ];
    for (const entrada of hostis) {
      expect(lerCookieSessao(entrada, politica)).toBeNull();
    }
  });

  it("o cookie de produção não é lido pela política de desenvolvimento", () => {
    // Nomes distintos por ambiente significam também isolamento de leitura.
    const cabecalho = `${NOME_COOKIE_PROTEGIDO}=${TOKEN_SINTETICO}`;
    expect(lerCookieSessao(cabecalho, politica)).toBeNull();
  });
});
