// TechLab Fisio — normalização dos erros das rotas `/formas-pagamento` (CFG-004).
//
// Filtro de CONTROLLER (não global): o filtro global `FiltroErroAutenticacao`
// tem escopo enumerado às rotas de autenticação e não é alterado por esta
// fatia. Mesmo desenho de `FiltroErroClinica`: contrato fechado `{ erro }` para
// tudo o que ocorre a partir das guards e dos handlers de `/formas-pagamento`:
//
//   - `HttpException` com código conhecido ... status e código preservados;
//   - `HttpException` sem código conhecido .... status preservado, corpo
//                                                REQUISICAO_INVALIDA;
//   - qualquer outra exceção ................. 500 FALHA_INTERNA, log com
//                                                classe e correlação apenas
//                                                (nenhum valor de campo, nenhuma
//                                                mensagem do driver).
//
// LIMITE CONHECIDO (medido na F3, `erro-autenticacao.filter.ts`): erros do body
// parser (JSON malformado, `413`) nascem ANTES do roteamento e não alcançam
// filtros de controller — o status é o correto, mas o corpo é o padrão da
// plataforma. Mesmo estado já vigente em `PATCH /auth/usuarios/:id/situacao`.

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { ERRO } from "../auth/auth.dto.js";
import { ERRO_AUTORIZACAO } from "../authz/erro-autorizacao.js";
import { ERRO_CLINICA } from "../clinica/clinica.dto.js";
import { ERRO_FORMA_PAGAMENTO } from "./formas-pagamento.dto.js";

const CODIGOS_CONHECIDOS: ReadonlySet<string> = new Set([
  ...Object.values(ERRO),
  ...Object.values(ERRO_AUTORIZACAO),
  ...Object.values(ERRO_CLINICA),
  ...Object.values(ERRO_FORMA_PAGAMENTO),
]);

interface RespostaEscrevivel {
  status(codigo: number): RespostaEscrevivel;
  json(corpo: unknown): unknown;
}

@Catch()
export class FiltroErroFormasPagamento implements ExceptionFilter {
  readonly #logger = new Logger("FormasPagamento");

  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<RespostaEscrevivel>();

    if (excecao instanceof HttpException) {
      const corpo: unknown = excecao.getResponse();
      const codigo =
        typeof corpo === "object" && corpo !== null
          ? (corpo as Record<string, unknown>)["erro"]
          : undefined;
      resposta.status(excecao.getStatus()).json({
        erro:
          typeof codigo === "string" && CODIGOS_CONHECIDOS.has(codigo)
            ? codigo
            : ERRO.REQUISICAO_INVALIDA,
      });
      return;
    }

    const correlacaoId = randomUUID();
    this.#logger.error(
      `Falha inesperada nas formas de pagamento. classe=${
        excecao instanceof Error ? excecao.name : typeof excecao
      } correlacao=${correlacaoId}`,
    );
    resposta.status(500).json({ erro: ERRO.FALHA_INTERNA });
  }
}
