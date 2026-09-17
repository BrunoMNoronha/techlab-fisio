// TechLab Fisio — leitura da linha de `profissional` compartilhada pelo
// cadastro (`ProfissionaisService`) e pela situação (`ProfissionalService`).
//
// `bloquear = true` usa `SELECT ... FOR UPDATE` (D-PRO1-10): toda mutação da
// fatia PRO-A serializa na linha do profissional.

import type { TransacaoPersistencia } from "@techlab-fisio/database";

export interface DadosProfissional {
  readonly id: string;
  readonly nome: string;
  readonly registroProfissional: string | null;
  readonly usuarioId: string | null;
  readonly ativo: boolean;
  readonly inativadoEm: Date | null;
}

export interface LinhaProfissional {
  id: string;
  nome: string;
  registro_profissional: string | null;
  usuario_id: string | null;
  ativo: boolean;
  inativado_em: Date | null;
}

export function mapearProfissional(linha: LinhaProfissional): DadosProfissional {
  return {
    id: linha.id,
    nome: linha.nome,
    registroProfissional: linha.registro_profissional,
    usuarioId: linha.usuario_id,
    ativo: linha.ativo,
    inativadoEm: linha.inativado_em,
  };
}

/** Lê a linha; `null` quando inexistente. */
export async function lerLinhaProfissional(
  tx: TransacaoPersistencia,
  profissionalId: string,
  bloquear: boolean,
): Promise<LinhaProfissional | null> {
  const linhas = bloquear
    ? await tx.$queryRaw<LinhaProfissional[]>`
        SELECT id, nome, registro_profissional, usuario_id, ativo, inativado_em
          FROM profissional
         WHERE id = ${profissionalId}::uuid
           FOR UPDATE`
    : await tx.$queryRaw<LinhaProfissional[]>`
        SELECT id, nome, registro_profissional, usuario_id, ativo, inativado_em
          FROM profissional
         WHERE id = ${profissionalId}::uuid`;
  return linhas[0] ?? null;
}
