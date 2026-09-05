// TechLab Fisio — documento OpenAPI da API REST (Etapa 2.3D-B / F3).
//
// Materializa `D-2.3D-11` (`docs/12` §5.11) pelo **Caminho A**: o pacote
// homologado como baseline candidata, `@nestjs/swagger@11.4.7`, foi MEDIDO
// contra a baseline real (ESM/`nodenext`, `D-ESM-01`, `skipLibCheck: false`,
// Node 24) e funciona. O fallback autoral previsto pela decisão não foi
// necessário — a medição está registrada em `docs/10` §6-F.
//
// DECORATORS EXPLÍCITOS (`D-2.3D-11`, literal): nenhum plugin de compilação
// (`@nestjs/swagger/plugin`, `CLI plugin`) é usado. O contrato é o que os
// decorators dizem, e nada é inferido silenciosamente de tipos — inferência
// implícita é justamente o que faz contrato e código divergirem sem que
// ninguém perceba.
//
// SEM UI: `swagger-ui-dist` vem como dependência transitiva do pacote, mas a
// interface NÃO é servida. `D-2.3D-11` exige contrato sincronizado, não
// console de exploração; e uma UI pública numa API de autenticação é
// superfície sem contrapartida. A montagem da rota é decidida em `main.ts`,
// por ambiente.

import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

/**
 * Versão do CONTRATO, independente da versão do pacote. `0.1.0` cobria apenas
 * a fronteira de autenticação da F3; `0.2.0` acrescenta, de forma ADITIVA e
 * sem alterar nenhuma operação anterior, as duas rotas de recuperação de
 * senha da F6 (AUT-004). Os demais módulos ainda não têm exposição HTTP.
 */
export const VERSAO_CONTRATO = "0.2.0";

export const TITULO_CONTRATO = "TechLab Fisio — API";

/** Caminho do documento JSON, quando montado (ver `main.ts`). */
export const ROTA_DOCUMENTO_JSON = "openapi.json";

/**
 * Caminho reservado à interface do Swagger UI. Declarado porque
 * `SwaggerModule.setup` exige um caminho base — a UI em si NÃO é servida
 * (`ui: false`), e este caminho fica deliberadamente vazio.
 */
const ROTA_BASE_UI = "openapi";

/**
 * Nome do security scheme no documento. Declarado EXPLICITAMENTE: o default
 * de `addCookieAuth` é o genérico `"cookie"`, que não diz qual cookie é.
 */
export const NOME_ESQUEMA_SESSAO = "sessaoCookie";

/**
 * Constrói o documento OpenAPI a partir da aplicação REAL — os mesmos
 * controllers, os mesmos DTOs, os mesmos decorators que servem o tráfego.
 *
 * É esta função que o teste de contrato e a prova de runtime contra o `dist/`
 * ESM executam. Nenhuma das duas monta um app sintético: se um endpoint sair
 * do `AppModule`, some do documento; se perder seus decorators, o teste de
 * contrato falha.
 */
export function construirDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const configuracao = new DocumentBuilder()
    .setTitle(TITULO_CONTRATO)
    .setDescription(
      "API REST do TechLab Fisio. Nesta versão o contrato cobre a fronteira de " +
        "autenticação (AUT-001/AUT-002) e a recuperação segura de senha " +
        "(AUT-004/D-04). Os demais módulos ainda não possuem exposição HTTP.",
    )
    .setVersion(VERSAO_CONTRATO)
    // Sessão por COOKIE (`D-2.3D-07`) — nunca bearer/JWT. O nome declarado é
    // o de ambiente protegido; em desenvolvimento o cookie tem nome distinto,
    // por decisão homologada.
    .addCookieAuth("__Host-tlf_sessao", {
      type: "apiKey",
      in: "cookie",
      name: "__Host-tlf_sessao",
      description:
        "Cookie de sessão HttpOnly · Secure · SameSite=Strict · Path=/ · sem " +
        "Domain (D-2.3D-07). Emitido por POST /auth/login e limpo por " +
        "POST /auth/logout. O token NUNCA aparece em corpo de resposta.",
    }, NOME_ESQUEMA_SESSAO)
    .build();

  return SwaggerModule.createDocument(app, configuracao);
}

/**
 * Ambientes em que a ROTA do documento não é montada.
 *
 * DECISÃO LOCAL DE IMPLEMENTAÇÃO (reversível; `D-2.3D-11` não decide isto): o
 * contrato é sempre CONSTRUÍDO — inclusive em produção, e a construção falha o
 * bootstrap se algum decorator estiver quebrado, que é a forma mais barata de
 * manter contrato e código sincronizados. Só a EXPOSIÇÃO é restrita: publicar
 * o mapa da API de autenticação na internet não tem contrapartida operacional
 * no MVP.
 */
const AMBIENTES_SEM_DOCUMENTO_EXPOSTO: ReadonlySet<string> = new Set([
  "producao",
  "homologacao",
]);

/** `true` sse a rota do documento deve ser montada neste ambiente. */
export function deveExporDocumento(ambiente: string): boolean {
  return !AMBIENTES_SEM_DOCUMENTO_EXPOSTO.has(ambiente);
}

/**
 * Constrói o documento e, quando o ambiente permite, monta a rota que o serve.
 *
 * Vive aqui — e não em `main.ts` — para que a decisão de montagem seja
 * exercitável contra o `dist/` ESM real pela prova de runtime
 * (`scripts/verify-openapi-runtime.mjs`), e não apenas no bootstrap de
 * produção, onde nenhum teste chega.
 */
export function montarDocumentoOpenApi(
  app: INestApplication,
  ambiente: string,
): OpenAPIObject {
  const documento = construirDocumentoOpenApi(app);
  if (deveExporDocumento(ambiente)) {
    SwaggerModule.setup(ROTA_BASE_UI, app, documento, {
      // Somente o JSON do contrato. MEDIDO em `@nestjs/swagger@11.4.7`: a rota
      // do documento só é registrada quando `raw` inclui o formato — desligar a
      // UI não basta, e sem `raw` o `jsonDocumentUrl` responde 404.
      swaggerUiEnabled: false,
      raw: ["json"],
      jsonDocumentUrl: ROTA_DOCUMENTO_JSON,
    });
  }
  return documento;
}
