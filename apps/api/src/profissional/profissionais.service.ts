// TechLab Fisio — cadastro de profissionais e serviços realizados
// (PRO-001, PRO-004; `docs/18` §4).
//
// Materializa:
//   - D-PRO1-02: nenhum caminho de exclusão; `ativo` só pela operação própria
//     (`ProfissionalService.alterarSituacao`); criação sempre ativa;
//   - D-PRO1-04: vínculo opcional com usuário EXISTENTE e ATIVO (lido com
//     `FOR SHARE`, serializando com a inativação do usuário); o 23505 SOMENTE
//     de `profissional_usuario_id_key` (U-08) vira USUARIO_JA_VINCULADO;
//     nenhum papel é exigido, criado ou alterado;
//   - D-PRO1-05: substituição do conjunto de serviços; serviço NOVO precisa
//     existir e estar ativo (lido com `FOR SHARE`); associação mantida com
//     serviço que ficou inativo é preservada; conjunto idêntico não escreve;
//     permitido para profissional inativo;
//   - D-PRO1-08: SEM evento de auditoria (limitação declarada);
//   - D-PRO1-10: `SELECT ... FOR UPDATE` na linha do profissional em PUT e
//     PUT de serviços; no-op decidido sob o lock; última escrita válida
//     prevalece.

import { Injectable } from "@nestjs/common";

import { identificarViolacao, type TransacaoPersistencia } from "@techlab-fisio/database";

import { DatabaseService } from "../database/database.service.js";
import type { DadosProfissionalValidados } from "./profissionais.dto.js";
import {
  lerLinhaProfissional,
  mapearProfissional,
  type DadosProfissional,
  type LinhaProfissional,
} from "./profissional.leitura.js";

/** Unicidade `U-08` (`docs/07` §10.1), criada pela migration de relações. */
export const INDICE_USUARIO_PROFISSIONAL = "profissional_usuario_id_key";

export type MotivoRejeicaoProfissional =
  | "PROFISSIONAL_NAO_ENCONTRADO"
  | "USUARIO_JA_VINCULADO"
  | "USUARIO_INELEGIVEL"
  | "SERVICO_INELEGIVEL";

export class ErroProfissional extends Error {
  override readonly name = "ErroProfissional";

  constructor(readonly motivo: MotivoRejeicaoProfissional) {
    super(`Operação de cadastro de profissional rejeitada: ${motivo}.`);
  }
}

export interface ServicoDoProfissional {
  readonly servicoId: string;
  readonly nome: string;
  readonly ativo: boolean;
}

/** `true` sse o erro é a violação da unicidade de vínculo com usuário — e de nenhuma outra restrição. */
export function ehUsuarioJaVinculado(erro: unknown): boolean {
  const violacao = identificarViolacao(erro);
  return violacao !== null && violacao.classe === "UNIQUE" && violacao.constraint === INDICE_USUARIO_PROFISSIONAL;
}

async function traduzirVinculo<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao;
  } catch (erro) {
    if (ehUsuarioJaVinculado(erro)) throw new ErroProfissional("USUARIO_JA_VINCULADO");
    throw erro;
  }
}

@Injectable()
export class ProfissionaisService {
  constructor(private readonly database: DatabaseService) {}

  async listar(ativo: boolean | null): Promise<DadosProfissional[]> {
    return this.database.transacao(async (tx) => {
      const linhas =
        ativo === null
          ? await tx.$queryRaw<LinhaProfissional[]>`
              SELECT id, nome, registro_profissional, usuario_id, ativo, inativado_em
                FROM profissional
               ORDER BY ativo DESC, lower(nome), id`
          : await tx.$queryRaw<LinhaProfissional[]>`
              SELECT id, nome, registro_profissional, usuario_id, ativo, inativado_em
                FROM profissional
               WHERE ativo = ${ativo}
               ORDER BY ativo DESC, lower(nome), id`;
      return linhas.map(mapearProfissional);
    });
  }

  async consultar(profissionalId: string): Promise<DadosProfissional> {
    return this.database.transacao(async (tx) => mapearProfissional(await this.#exigir(tx, profissionalId, false)));
  }

  async criar(dados: DadosProfissionalValidados): Promise<DadosProfissional> {
    return traduzirVinculo(
      this.database.transacao(async (tx) => {
        if (dados.usuarioId !== null) await this.#exigirUsuarioElegivel(tx, dados.usuarioId);
        const criado = await tx.profissional.create({
          data: {
            nome: dados.nome,
            registroProfissional: dados.registroProfissional,
            usuarioId: dados.usuarioId,
            ativo: true,
            inativadoEm: null,
          },
          select: { id: true },
        });
        return mapearProfissional(await this.#exigir(tx, criado.id, false));
      }),
    );
  }

  async atualizar(profissionalId: string, dados: DadosProfissionalValidados): Promise<{
    readonly profissional: DadosProfissional;
    readonly mutacaoExecutada: boolean;
  }> {
    return traduzirVinculo(
      this.database.transacao(async (tx) => {
        const atual = mapearProfissional(await this.#exigir(tx, profissionalId, true));
        if (
          atual.nome === dados.nome &&
          atual.registroProfissional === dados.registroProfissional &&
          atual.usuarioId === dados.usuarioId
        ) {
          return { profissional: atual, mutacaoExecutada: false };
        }

        if (dados.usuarioId !== null && dados.usuarioId !== atual.usuarioId) {
          await this.#exigirUsuarioElegivel(tx, dados.usuarioId);
        }

        await tx.$executeRaw`
          UPDATE profissional
             SET nome                  = ${dados.nome},
                 registro_profissional = ${dados.registroProfissional},
                 usuario_id            = ${dados.usuarioId}::uuid
           WHERE id = ${atual.id}::uuid
        `;
        return { profissional: mapearProfissional(await this.#exigir(tx, atual.id, false)), mutacaoExecutada: true };
      }),
    );
  }

  async listarServicos(profissionalId: string): Promise<ServicoDoProfissional[]> {
    return this.database.transacao(async (tx) => {
      await this.#exigir(tx, profissionalId, false);
      return this.#servicosDe(tx, profissionalId);
    });
  }

  async substituirServicos(profissionalId: string, servicoIds: readonly string[]): Promise<{
    readonly servicos: ServicoDoProfissional[];
    readonly mutacaoExecutada: boolean;
  }> {
    return this.database.transacao(async (tx) => {
      await this.#exigir(tx, profissionalId, true);

      const vigentes = await tx.$queryRaw<Array<{ servico_id: string }>>`
        SELECT servico_id FROM profissional_servico WHERE profissional_id = ${profissionalId}::uuid`;
      const atuais = new Set(vigentes.map((v) => v.servico_id));
      const pedidos = new Set(servicoIds);

      const novos = [...pedidos].filter((id) => !atuais.has(id));
      const removidos = [...atuais].filter((id) => !pedidos.has(id));
      if (novos.length === 0 && removidos.length === 0) {
        return { servicos: await this.#servicosDe(tx, profissionalId), mutacaoExecutada: false };
      }

      if (novos.length > 0) {
        const elegiveis = await tx.$queryRaw<Array<{ id: string; ativo: boolean }>>`
          SELECT id, ativo FROM servico WHERE id = ANY(${novos}::uuid[]) FOR SHARE`;
        if (elegiveis.length !== novos.length || elegiveis.some((s) => !s.ativo)) {
          throw new ErroProfissional("SERVICO_INELEGIVEL");
        }
      }

      if (removidos.length > 0) {
        await tx.$executeRaw`
          DELETE FROM profissional_servico
           WHERE profissional_id = ${profissionalId}::uuid
             AND servico_id = ANY(${removidos}::uuid[])`;
      }
      if (novos.length > 0) {
        await tx.$executeRaw`
          INSERT INTO profissional_servico (profissional_id, servico_id)
          SELECT ${profissionalId}::uuid, unnest(${novos}::uuid[])`;
      }
      return { servicos: await this.#servicosDe(tx, profissionalId), mutacaoExecutada: true };
    });
  }

  async #exigir(tx: TransacaoPersistencia, profissionalId: string, bloquear: boolean): Promise<LinhaProfissional> {
    const linha = await lerLinhaProfissional(tx, profissionalId, bloquear);
    if (linha === null) throw new ErroProfissional("PROFISSIONAL_NAO_ENCONTRADO");
    return linha;
  }

  async #exigirUsuarioElegivel(tx: TransacaoPersistencia, usuarioId: string): Promise<void> {
    const usuarios = await tx.$queryRaw<Array<{ ativo: boolean }>>`
      SELECT ativo FROM usuario WHERE id = ${usuarioId}::uuid FOR SHARE`;
    if (usuarios[0]?.ativo !== true) throw new ErroProfissional("USUARIO_INELEGIVEL");
  }

  async #servicosDe(tx: TransacaoPersistencia, profissionalId: string): Promise<ServicoDoProfissional[]> {
    const linhas = await tx.$queryRaw<Array<{ servico_id: string; nome: string; ativo: boolean }>>`
      SELECT s.id AS servico_id, s.nome, s.ativo
        FROM profissional_servico ps
        JOIN servico s ON s.id = ps.servico_id
       WHERE ps.profissional_id = ${profissionalId}::uuid
       ORDER BY lower(s.nome), s.id`;
    return linhas.map((l) => ({ servicoId: l.servico_id, nome: l.nome, ativo: l.ativo }));
  }
}
