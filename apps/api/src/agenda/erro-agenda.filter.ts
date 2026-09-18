// TechLab Fisio — normalização dos erros das rotas da agenda (AGD-A).
//
// Filtro de CONTROLLER (não global), mesmo desenho de
// `FiltroErroMotivosCancelamento` e `FiltroErroProfissionais`: contrato fechado
// `{ erro }` para tudo o que ocorre a partir das guards e dos handlers de
// `/agendamentos` e `/agenda`:
//
//   - `HttpException` com código conhecido ... status e código preservados;
//   - `HttpException` sem código conhecido .... status preservado, corpo
//                                                REQUISICAO_INVALIDA;
//   - qualquer outra exceção ................. 500 FALHA_INTERNA, log com
//                                                classe e correlação apenas
//                                                (nenhum identificador, nenhum
//                                                instante, nenhuma mensagem do
//                                                driver).
//
// O log NUNCA registra `pacienteId`, `profissionalId`, nome de paciente,
// intervalo ou motivo: a agenda é dado de saúde por associação (TLF-BASE §10).
//
// LIMITE CONHECIDO, já vigente em toda a API: erros do body parser (JSON
// malformado, `413`) nascem ANTES do roteamento e não alcançam filtros de
// controller — o status é o correto, o corpo é o padrão da plataforma.

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
import { ERRO_BLOQUEIO } from "./agenda-bloqueios.dto.js";
import { ERRO_AGENDAMENTO } from "./agenda.dto.js";
import { ERRO_AGENDA } from "./verificador-horario-funcionamento.js";

const CODIGOS_CONHECIDOS: ReadonlySet<string> = new Set([
  ...Object.values(ERRO),
  ...Object.values(ERRO_AUTORIZACAO),
  ...Object.values(ERRO_CLINICA),
  ...Object.values(ERRO_AGENDA),
  ...Object.values(ERRO_AGENDAMENTO),
  ...Object.values(ERRO_BLOQUEIO),
]);

interface RespostaEscrevivel {
  status(codigo: number): RespostaEscrevivel;
  json(corpo: unknown): unknown;
}

@Catch()
export class FiltroErroAgenda implements ExceptionFilter {
  readonly #logger = new Logger("Agenda");

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
      `Falha inesperada na agenda. classe=${
        excecao instanceof Error ? excecao.name : typeof excecao
      } correlacao=${correlacaoId}`,
    );
    resposta.status(500).json({ erro: ERRO.FALHA_INTERNA });
  }
}
