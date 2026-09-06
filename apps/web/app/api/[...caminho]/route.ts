// TechLab Fisio — Proxy de desenvolvimento Same-Origin para a API interna.
//
// Encaminha requisições de `/api/*` para a API NestJS interna preservando:
//   1. `Host` público original recebido do navegador (ex: `localhost:3000`),
//      garantindo que `Origin.host === Host` na `ProtecaoCsrfGuard`;
//   2. Cabeçalho `X-TLF-Requisicao` e `Content-Type: application/json`;
//   3. Fetch Metadata (`Sec-Fetch-*`);
//   4. `Set-Cookie` (inclusive múltiplos cookies de sessão e atributos HttpOnly/SameSite/Path).
//
// Zero dependências externas: utiliza estritamente `node:http` da plataforma Node 24.

import http from "node:http";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const URL_API_INTERNA = process.env["URL_API_INTERNA"] || "http://localhost:3001";

async function proxyRequisicao(
  request: NextRequest,
  context: { params: Promise<{ caminho: string[] }> },
): Promise<Response> {
  const { caminho } = await context.params;
  const path = caminho.join("/");
  const urlRequisicao = new URL(request.url);
  const baseInterna = new URL(URL_API_INTERNA);
  const baseInternaSemBarra = URL_API_INTERNA.replace(/\/+$/, "");
  const destinoUrl = new URL(`${baseInternaSemBarra}/${path}${urlRequisicao.search}`);

  // Proteção fail-closed contra SSRF: o destino nunca pode escapar da origem interna configurada.
  if (destinoUrl.origin !== baseInterna.origin) {
    return NextResponse.json({ erro: "CAMINHO_INVALIDO" }, { status: 400 });
  }

  const headersEnvio: Record<string, string> = {};
  for (const [chave, valor] of request.headers.entries()) {
    headersEnvio[chave.toLowerCase()] = valor;
  }

  // Preserva o host público da requisição original para a ProtecaoCsrfGuard.
  const hostOriginal = request.headers.get("host");
  if (hostOriginal) {
    headersEnvio["host"] = hostOriginal;
  }

  let corpoBuffer: Buffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength > 0) {
      corpoBuffer = Buffer.from(arrayBuffer);
      headersEnvio["content-length"] = String(corpoBuffer.length);
    }
  }

  return new Promise<Response>((resolve) => {
    if (request.signal.aborted) {
      resolve(new Response(null, { status: 499 }));
      return;
    }

    const proxyReq = http.request(
      destinoUrl,
      {
        method: request.method,
        headers: headersEnvio,
      },
      (proxyRes) => {
        const headersResposta = new Headers();
        for (const [chave, valor] of Object.entries(proxyRes.headers)) {
          if (Array.isArray(valor)) {
            for (const v of valor) {
              headersResposta.append(chave, v);
            }
          } else if (valor !== undefined) {
            headersResposta.set(chave, valor);
          }
        }

        const corpoReadableStream = new ReadableStream({
          start(controller) {
            proxyRes.on("data", (chunk) => controller.enqueue(chunk));
            proxyRes.on("end", () => controller.close());
            proxyRes.on("error", (err) => controller.error(err));
          },
          cancel() {
            proxyRes.destroy();
          },
        });

        resolve(
          new NextResponse(corpoReadableStream, {
            status: proxyRes.statusCode ?? 502,
            statusText: proxyRes.statusMessage,
            headers: headersResposta,
          }),
        );
      },
    );

    const onAbort = () => {
      proxyReq.destroy();
    };
    request.signal.addEventListener("abort", onAbort, { once: true });

    proxyReq.on("error", () => {
      if (request.signal.aborted) {
        return;
      }
      resolve(
        NextResponse.json(
          { erro: "FALHA_CONEXAO_API" },
          { status: 502 },
        ),
      );
    });

    if (corpoBuffer) {
      proxyReq.write(corpoBuffer);
    }
    proxyReq.end();
  });
}

export const GET = proxyRequisicao;
export const POST = proxyRequisicao;
export const PUT = proxyRequisicao;
export const PATCH = proxyRequisicao;
export const DELETE = proxyRequisicao;
export const HEAD = proxyRequisicao;
