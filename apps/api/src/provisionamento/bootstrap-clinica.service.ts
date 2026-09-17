// TechLab Fisio — provisionamento manual e idempotente da linha única de
// `clinica` (fatia CFG-001B; `docs/14` D-CFG-01, D-CFG-09..D-CFG-12).
//
//   - D-CFG-01: a linha única é criada por provisionamento; a API
//     (`GET/PUT /clinica`) só consulta e atualiza;
//   - D-CFG-09: a criação emite `configuracao.alterada` (alvo `clinica`) na
//     MESMA transação do INSERT, com `ator_usuario_id = NULL`, justificativa
//     operacional OBRIGATÓRIA (persistida, nunca impressa) e `contexto` vazio
//     — extensão do precedente `D-2.3D-15`;
//   - D-CFG-10: mesma clínica -> `JA_CONFORME` (zero escrita, zero evento);
//     dados divergentes -> `CLINICA_JA_EXISTE` (nada é sobrescrito);
//   - D-CFG-11: `nomeCadastral` e `fusoHorario` validados e normalizados por
//     D-CFG-04; opcionais permanecem NULL.
//
// SERIALIZAÇÃO — sem advisory lock. Diferentemente do bootstrap do
// Administrador, a unicidade é FÍSICA (`ux_clinica_linha_unica`, D-CFG-02):
// duas criações concorrentes não podem ambas commitar. A perdedora recebe
// violação de unicidade, a transação dela sofre rollback (sem evento) e a
// decisão é refeita UMA vez sobre o estado já commitado — resultando em
// `JA_CONFORME` ou `CLINICA_JA_EXISTE`, nunca em falha não controlada.
//
// SEGREDO/VALORES: nenhuma função deste arquivo escreve em `console`; erros
// carregam só `motivo` de conjunto fechado, jamais nome, fuso ou justificativa.

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { identificarViolacao } from "@techlab-fisio/database";

import { AuditWriter } from "../audit/audit-writer.js";
import {
  contarCaracteres,
  ehFusoHorarioValido,
  LIMITES_CLINICA,
} from "../clinica/clinica.dto.js";
import { DatabaseService } from "../database/database.service.js";

/** `alvo_tipo` do evento — `D-AUD-03`: nome físico da tabela do alvo. */
const ALVO_CLINICA = "clinica";

/** Qualquer caractere de controle C0/C1 — inclui NUL, CR e LF. */
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;

export type MotivoFalhaBootstrapClinica =
  /** `nomeCadastral` ausente, vazio ou acima de 200 caracteres (D-CFG-04). */
  | "NOME_CADASTRAL_INVALIDO"
  /** `fusoHorario` ausente ou não reconhecido (D-CFG-04). */
  | "FUSO_HORARIO_INVALIDO"
  /** Justificativa operacional ausente ou vazia (D-CFG-09). */
  | "JUSTIFICATIVA_AUSENTE"
  /** Justificativa com caractere de controle (D-CFG-09). */
  | "JUSTIFICATIVA_INVALIDA"
  /** Já existe clínica com dados divergentes; nada é sobrescrito (D-CFG-10). */
  | "CLINICA_JA_EXISTE";

export class ErroBootstrapClinica extends Error {
  override readonly name = "ErroBootstrapClinica";

  constructor(readonly motivo: MotivoFalhaBootstrapClinica) {
    super(`Provisionamento da clínica recusado: ${motivo}.`);
  }
}

export interface ComandoBootstrapClinica {
  readonly nomeCadastral: string;
  readonly fusoHorario: string;
  readonly justificativa: string;
}

export type DesfechoBootstrapClinica = "CLINICA_CRIADA" | "JA_CONFORME";

export interface ResultadoBootstrapClinica {
  readonly desfecho: DesfechoBootstrapClinica;
  readonly clinicaId: string;
  /** Correlação do evento emitido; `null` quando nada foi escrito. */
  readonly correlacaoId: string | null;
}

export interface EntradaValidada {
  readonly nomeCadastral: string;
  readonly fusoHorario: string;
  readonly justificativa: string;
}

/**
 * Validação PURA da entrada (D-CFG-04, D-CFG-09) — exportada para que o CLI a
 * execute ANTES de abrir o contexto Nest (cuja inicialização conecta ao banco):
 * entrada inválida produz o motivo fechado sem contato com o banco, mesmo com
 * o banco indisponível. O serviço a reaplica como defesa em profundidade.
 */
export function validarEntradaBootstrapClinica(comando: ComandoBootstrapClinica): EntradaValidada {
  const nomeBruto: unknown = comando.nomeCadastral;
  const nomeCadastral = typeof nomeBruto === "string" ? nomeBruto.trim() : "";
  if (
    nomeCadastral.length === 0 ||
    contarCaracteres(nomeCadastral) > LIMITES_CLINICA.NOME_CADASTRAL
  ) {
    throw new ErroBootstrapClinica("NOME_CADASTRAL_INVALIDO");
  }

  const fusoBruto: unknown = comando.fusoHorario;
  const fusoHorario = typeof fusoBruto === "string" ? fusoBruto.trim() : "";
  if (!ehFusoHorarioValido(fusoHorario)) {
    throw new ErroBootstrapClinica("FUSO_HORARIO_INVALIDO");
  }

  const justificativaBruta: unknown = comando.justificativa;
  if (typeof justificativaBruta !== "string" || justificativaBruta.trim() === "") {
    throw new ErroBootstrapClinica("JUSTIFICATIVA_AUSENTE");
  }
  const justificativa = justificativaBruta.trim();
  if (CONTROLE.test(justificativa)) {
    throw new ErroBootstrapClinica("JUSTIFICATIVA_INVALIDA");
  }

  return { nomeCadastral, fusoHorario, justificativa };
}

interface LinhaClinica {
  id: string;
  nome_cadastral: string;
  fuso_horario: string;
}

/** Sinal interno: a criação perdeu a corrida para outra transação. */
class CriacaoConcorrente extends Error {
  override readonly name = "CriacaoConcorrente";
}

@Injectable()
export class BootstrapClinicaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   *   tabela vazia ................ cria a linha e audita (CLINICA_CRIADA);
   *   mesma clínica ............... JA_CONFORME, zero escrita, zero evento;
   *   clínica divergente .......... CLINICA_JA_EXISTE, nada sobrescrito;
   *   criação concorrente perdida . decisão refeita sobre o estado commitado.
   */
  async executar(comando: ComandoBootstrapClinica): Promise<ResultadoBootstrapClinica> {
    // Validação ANTES de qualquer consulta ou transação.
    const entrada = validarEntradaBootstrapClinica(comando);

    try {
      return await this.tentar(entrada);
    } catch (erro) {
      if (!(erro instanceof CriacaoConcorrente)) throw erro;
      // A transação perdedora sofreu rollback (sem linha, sem evento). A
      // segunda tentativa encontra a linha commitada e só pode decidir entre
      // JA_CONFORME e CLINICA_JA_EXISTE.
      return this.tentar(entrada);
    }
  }

  private async tentar(entrada: EntradaValidada): Promise<ResultadoBootstrapClinica> {
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      const linhas = await tx.$queryRaw<LinhaClinica[]>`
        SELECT id, nome_cadastral, fuso_horario FROM clinica
      `;

      if (linhas.length > 1) {
        throw new Error("Invariante de clínica única violada: mais de uma linha em clinica.");
      }

      const existente = linhas[0];
      if (existente !== undefined) {
        if (
          existente.nome_cadastral === entrada.nomeCadastral &&
          existente.fuso_horario === entrada.fusoHorario
        ) {
          return { desfecho: "JA_CONFORME", clinicaId: existente.id, correlacaoId: null };
        }
        throw new ErroBootstrapClinica("CLINICA_JA_EXISTE");
      }

      let clinicaId: string;
      try {
        const criada = await tx.clinica.create({
          data: { nomeCadastral: entrada.nomeCadastral, fusoHorario: entrada.fusoHorario },
          select: { id: true },
        });
        clinicaId = criada.id;
      } catch (erro) {
        if (identificarViolacao(erro)?.classe === "UNIQUE") {
          throw new CriacaoConcorrente();
        }
        throw erro;
      }

      // D-CFG-09 — `contexto` OMITIDO (whitelist vazia); ator NULL com
      // justificativa obrigatória (precedente `D-2.3D-15`).
      await this.auditWriter.registrar(tx, {
        acao: "configuracao.alterada",
        ocorridoEm: new Date(),
        atorUsuarioId: null,
        alvoTipo: ALVO_CLINICA,
        alvoId: clinicaId,
        resultado: "SUCESSO",
        justificativa: entrada.justificativa,
        correlacaoId,
      });

      return { desfecho: "CLINICA_CRIADA", clinicaId, correlacaoId };
    });
  }
}
