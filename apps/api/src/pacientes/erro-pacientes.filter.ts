// TechLab Fisio — normalização dos erros das rotas `/pacientes` (PAC-A; `docs/17`).
//
// Filtro de CONTROLLER, mesmo desenho de `FiltroErroServicos`: contrato fechado
// `{ erro }`; exceção não HTTP vira `500 FALHA_INTERNA` com log só de classe e
// correlação — NUNCA valor pessoal (nome, CPF, contatos), mensagem do driver ou
// corpo da requisição (Base §10, RN-063).
//
// LIMITE CONHECIDO: erros do body parser (JSON malformado, `413`) nascem antes
// do roteamento e não alcançam este filtro (mesmo estado de `/servicos`).

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
import { ERRO_PACIENTE } from "./pacientes.dto.js";

const CODIGOS_CONHECIDOS: ReadonlySet<string> = new Set([
  ...Object.values(ERRO),
  ...Object.values(ERRO_AUTORIZACAO),
  ...Object.values(ERRO_CLINICA),
  ...Object.values(ERRO_PACIENTE),
]);

interface RespostaEscrevivel {
  status(codigo: number): RespostaEscrevivel;
  json(corpo: unknown): unknown;
}

@Catch()
export class FiltroErroPacientes implements ExceptionFilter {
  readonly #logger = new Logger("Pacientes");

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
      `Falha inesperada em pacientes. classe=${
        excecao instanceof Error ? excecao.name : typeof excecao
      } correlacao=${correlacaoId}`,
    );
    resposta.status(500).json({ erro: ERRO.FALHA_INTERNA });
  }
}
