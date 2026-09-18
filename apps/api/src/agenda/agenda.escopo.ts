// TechLab Fisio — escopo operacional × próprio da agenda (`docs/15` D-AGD-12;
// materializa a célula `C` de `docs/04` §4 para o módulo M5, que FA-09 registra
// como não materializada pelo RBAC).
//
// A `PermissoesGuard` decide SE o ator possui a permissão da operação
// (`agenda.gerenciar`, `agenda.checkin` ou `agenda.falta`). Este componente
// decide SOBRE QUE agendamentos essa permissão vale — e essa é a única
// pergunta que ele responde. Ele NÃO concede, NÃO amplia e NÃO substitui a
// permissão: um ator sem a permissão exigida nunca chega até aqui.
//
// REGRA HOMOLOGADA (D-AGD-12), literal:
//   - ator com papel `ADMINISTRADOR` ou `RECEPCIONISTA` **que conceda a
//     permissão** -> escopo OPERACIONAL (todos os agendamentos);
//   - ator cuja permissão provém **apenas** de papel `FISIOTERAPEUTA` ->
//     escopo PRÓPRIO: somente agendamentos cujo `profissional.usuario_id` é o
//     ator; criação só com o `profissionalId` próprio;
//   - papel customizado sem esses códigos -> PRÓPRIO, fail-closed.
//
// Por isso a consulta não pergunta "quais papéis o usuário tem", e sim "quais
// papéis do usuário CONCEDEM a permissão da operação": um Fisioterapeuta que
// também seja Recepcionista por um papel que não conceda aquela permissão não
// deve ganhar escopo operacional por associação.
//
// LIMITE DECLARADO (o mesmo de D-AGD-12): o escopo é derivado do CÓDIGO do
// papel enquanto `P2.2-05` não define o mecanismo geral de escopo relacional.
// Nada aqui antecipa `P2.2-05`, e nenhuma permissão nova é criada.
//
// PRÓPRIO SEM PROFISSIONAL VINCULADO é um estado coerente e NÃO é erro: o ator
// simplesmente não possui agendamento algum no seu escopo — lista vazia, `404`
// em qualquer id e `403` na criação. Fail-closed por construção.

import { Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

/**
 * Códigos de papel que, quando concedem a permissão de agenda da operação, dão escopo
 * operacional (`docs/04` §3; D-AGD-12).
 *
 * POR QUE OS LITERAIS SÃO REPETIDOS AQUI, e não importados de
 * `provisionamento/catalogo-rbac.ts`, que também os declara: o provisionamento
 * é uma fatia ISOLADA por decisão, e `provisionamento.fronteira.spec.ts` prova
 * mecanicamente que o fecho transitivo de `main.ts`/`app.module.ts` NÃO a
 * alcança. Importá-la a partir de um módulo de runtime arrastaria o seed — CLI,
 * bootstrap de Administrador e catálogo de seed — para dentro do artefato que
 * serve tráfego. A duplicação é de DOIS literais, e não fica sem guarda: a
 * igualdade com `PAPEIS` de `catalogo-rbac.ts` é provada em
 * `agenda-estados-escopo.spec.ts`, que é teste e portanto está fora do fecho da
 * aplicação.
 */
export const PAPEIS_ESCOPO_OPERACIONAL: readonly string[] = Object.freeze([
  "ADMINISTRADOR",
  "RECEPCIONISTA",
]);

/** Permissão de gestão de AGD-A (D-AGD-12 — nenhuma permissão nova). */
export const PERMISSAO_AGENDA_GERENCIAR = "agenda.gerenciar";
/** Permissão de check-in de AGD-B (D-AGD-12 — nenhuma permissão nova). */
export const PERMISSAO_AGENDA_CHECKIN = "agenda.checkin";
/** Permissão de falta de AGD-B (D-AGD-12 — nenhuma permissão nova). */
export const PERMISSAO_AGENDA_FALTA = "agenda.falta";

export type EscopoAgenda =
  /** Todos os agendamentos da clínica. */
  | { readonly tipo: "OPERACIONAL" }
  /**
   * Somente os agendamentos do profissional vinculado ao ator.
   * `profissionalId === null` = ator sem vínculo: escopo vazio.
   */
  | { readonly tipo: "PROPRIO"; readonly profissionalId: string | null };

@Injectable()
export class EscopoAgendaService {
  /**
   * Resolve o escopo do ator DENTRO da transação da operação — a mesma leitura
   * que decide o filtro da consulta e a autorização da criação, sem janela
   * entre uma e outra.
   */
  async resolver(
    tx: TransacaoPersistencia,
    usuarioId: string,
    permissaoAgenda: string = PERMISSAO_AGENDA_GERENCIAR,
  ): Promise<EscopoAgenda> {
    const papeis = await tx.$queryRaw<Array<{ codigo: string }>>`
      SELECT DISTINCT p.codigo
        FROM usuario_papel up
        JOIN papel p ON p.id = up.papel_id
        JOIN papel_permissao pp ON pp.papel_id = p.id
        JOIN permissao perm ON perm.id = pp.permissao_id
       WHERE up.usuario_id = ${usuarioId}::uuid
         AND perm.codigo = ${permissaoAgenda}
    `;
    const concedentes = new Set(papeis.map((linha) => linha.codigo));
    if (PAPEIS_ESCOPO_OPERACIONAL.some((codigo) => concedentes.has(codigo))) {
      return { tipo: "OPERACIONAL" };
    }

    // U-08: `profissional.usuario_id` é ÚNICO e anulável — no máximo uma linha.
    const vinculos = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM profissional WHERE usuario_id = ${usuarioId}::uuid
    `;
    return { tipo: "PROPRIO", profissionalId: vinculos[0]?.id ?? null };
  }
}

/**
 * Restrição a aplicar à LEITURA da agenda.
 *
 * Os três casos são DISTINTOS de propósito: `VAZIO` jamais pode colapsar em
 * `SEM_RESTRICAO`. Um `profissionalId` nulo representado como "sem filtro"
 * transformaria o ator sem vínculo — o caso fail-closed — em leitor de toda a
 * clínica, que é exatamente a falha que D-AGD-12 impede.
 */
export type RestricaoLeitura =
  | { readonly tipo: "SEM_RESTRICAO" }
  | { readonly tipo: "PROFISSIONAL"; readonly profissionalId: string }
  | { readonly tipo: "VAZIO" };

/**
 * No escopo próprio o `profissionalId` pedido pelo cliente é IGNORADO e
 * substituído pelo do ator (D-AGD-14); sem vínculo, a leitura é `VAZIO`.
 */
export function restricaoDaLeitura(
  escopo: EscopoAgenda,
  profissionalIdPedido: string | null,
): RestricaoLeitura {
  if (escopo.tipo === "OPERACIONAL") {
    return profissionalIdPedido === null
      ? { tipo: "SEM_RESTRICAO" }
      : { tipo: "PROFISSIONAL", profissionalId: profissionalIdPedido };
  }
  return escopo.profissionalId === null
    ? { tipo: "VAZIO" }
    : { tipo: "PROFISSIONAL", profissionalId: escopo.profissionalId };
}

/** `true` sse o escopo alcança agendamentos do profissional informado. */
export function escopoAlcanca(escopo: EscopoAgenda, profissionalId: string): boolean {
  return escopo.tipo === "OPERACIONAL" || escopo.profissionalId === profissionalId;
}
