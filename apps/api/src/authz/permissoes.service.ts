// TechLab Fisio — resolução das permissões efetivas (Etapa 2.3D-B / F4).
//
// A MENOR abstração necessária para responder a UMA pergunta: quais
// permissões o usuário autenticado possui, AGORA, segundo a persistência
// homologada. Materializa a parte "reunir papéis; resolver permissões" de
// `AUT-003` e a regra de união de `D-2.3D-09` (`docs/12` §5.9; TLF-BASE-V1
// §6; `docs/04` §6.1).
//
// PERSISTÊNCIA — ZERO ALTERAÇÃO. Consome exclusivamente as quatro estruturas
// já existentes desde a Fase 2: `usuario`, `usuario_papel`, `papel_permissao`
// e `permissao`. Nenhuma coluna, nenhuma tabela, nenhuma migration
// (`docs/12` §7.4: "`D-2.3D-09` usa `papel`/`permissao`/`papel_permissao`/
// `usuario_papel` já existentes").
//
// PADRÃO DE ACESSO AO BANCO — o já vigente, sem camada nova: `DatabaseService`
// é a fronteira transacional única da aplicação (`docs/10` §5), e este serviço
// a usa como `SessaoService`, `ProfissionalService` e `CobrancaService` já
// fazem. NENHUM repository genérico foi inventado: não existe um no
// repositório, e uma única consulta não justifica criá-lo.
//
// UMA ÚNICA CONSULTA, e por quê: `usuario -> usuario_papel -> papel ->
// papel_permissao -> permissao` desce em um `findUnique` com `select`
// aninhado. Ler papéis e depois permissões em duas viagens abriria uma janela
// em que o conjunto observado pertence a dois instantes diferentes.
//
// SEM CACHE — deliberado (`docs/12` §16 e o enunciado da fatia): nada de
// Redis, nada de snapshot na sessão, nada de permissão no token. A fonte
// autoritativa é a persistência, consultada no momento da decisão. Uma
// permissão revogada passa a valer na requisição seguinte, sem invalidação de
// cache — que é a propriedade correta para privilégio mínimo (TLF-BASE-V1
// §4.2).
//
// FAIL-CLOSED: toda situação em que a autorização não pode ser CONFIRMADA
// devolve um motivo de recusa, nunca um conjunto vazio disfarçado de
// resposta. Falha TÉCNICA (banco indisponível, driver) NÃO é convertida em
// recusa: a exceção sobe: mascará-la como `403` destruiria a observabilidade
// operacional — mesmo racional já homologado do `FiltroErroAutenticacao`
// ("falha técnica nunca vira 401"). Fail-closed significa "não prossegue para
// o handler", não "responde 403 sempre".

import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";

export type MotivoResolucaoIndisponivel =
  /** Não existe `usuario` com o id da sessão — estado inconsistente. */
  | "USUARIO_INEXISTENTE"
  /**
   * Usuário existe e está INATIVO. AUT-001 proíbe sessão para conta inativa e
   * AUT-005 revoga as sessões na inativação; uma sessão viva de conta inativa
   * é, portanto, estado inconsistente. Recusar aqui é a segunda barreira —
   * decisão local `L-F4-02`, registrada em `docs/10`: nenhuma fonte manda o
   * RBAC reavaliar a situação do usuário, e nenhuma fonte a proíbe; na dúvida,
   * nega-se.
   */
  | "USUARIO_INATIVO";

export type ResultadoPermissoesEfetivas =
  | {
      readonly resolvido: true;
      /**
       * União das permissões de TODOS os papéis do usuário, sem duplicatas e
       * em ordem lexicográfica — saída DETERMINÍSTICA para o mesmo estado
       * persistido, independentemente da ordem devolvida pelo banco.
       */
      readonly permissoes: readonly string[];
    }
  | { readonly resolvido: false; readonly motivo: MotivoResolucaoIndisponivel };

/**
 * Projeção mínima da consulta de autorização. Nada além do necessário sai do
 * banco: nem senha, nem hash, nem e-mail, nem nome (minimização —
 * TLF-BASE-V1 §10; `docs/04` §10).
 */
const PROJECAO_PERMISSOES = {
  ativo: true,
  papeis: {
    select: {
      papel: {
        select: {
          permissoes: { select: { permissao: { select: { codigo: true } } } },
        },
      },
    },
  },
} as const;

@Injectable()
export class PermissoesService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Permissões efetivas do usuário — a união dos papéis que ele possui.
   *
   * Casos tratados, todos sem comportamento permissivo:
   *   - `usuarioId` ausente, vazio ou de tipo inválido ... `USUARIO_INEXISTENTE`,
   *     rejeitado ANTES de qualquer consulta ao banco;
   *   - usuário inexistente ....................... `USUARIO_INEXISTENTE`;
   *   - usuário inativo ........................... `USUARIO_INATIVO`;
   *   - ZERO papéis ............................... resolvido com lista VAZIA;
   *   - papel sem permissão alguma ................ contribui com nada;
   *   - a MESMA permissão em vários papéis ........ entra uma única vez;
   *   - múltiplos papéis .......................... união de todos.
   *
   * A lista vazia é uma resposta LEGÍTIMA e é, ela própria, a negação: o
   * usuário existe, está ativo e não possui privilégio algum. Ela nunca é
   * confundida com "não foi possível resolver".
   *
   * Códigos persistidos fora do catálogo de `docs/04` §5 NÃO são filtrados
   * nem normalizados: eles simplesmente jamais casam com uma exigência, que é
   * sempre um identificador do catálogo tipado. Filtrá-los seria inventar
   * política de saneamento sem fonte.
   *
   * LIMITE DECLARADO (`R4-07`): uma string NÃO VAZIA que não seja um UUID
   * válido atravessa a barreira acima e chega ao driver, que a rejeita com
   * erro conhecido do Prisma. A exceção SOBE — desfecho `500`, fail-closed —
   * e não é convertida em negação de permissão, pela mesma razão de qualquer
   * outra falha técnica. Isso NÃO é alcançável pelo cliente na arquitetura
   * vigente: o `usuarioId` vem sempre do contexto autenticado, isto é, da
   * coluna `sessao_autenticacao.usuario_id`. Nenhuma validação de formato de
   * UUID é acrescentada aqui, e nenhuma biblioteca é introduzida para isso.
   */
  async resolverDoUsuario(usuarioId: unknown): Promise<ResultadoPermissoesEfetivas> {
    if (typeof usuarioId !== "string" || usuarioId === "") {
      return { resolvido: false, motivo: "USUARIO_INEXISTENTE" };
    }

    const usuario = await this.database.transacao(async (tx) =>
      tx.usuario.findUnique({
        // O filtro por `id` é a razão de ser desta consulta: sem ele, a
        // resposta não pertenceria ao usuário da sessão.
        where: { id: usuarioId },
        select: PROJECAO_PERMISSOES,
      }),
    );

    if (usuario === null) return { resolvido: false, motivo: "USUARIO_INEXISTENTE" };
    if (!usuario.ativo) return { resolvido: false, motivo: "USUARIO_INATIVO" };

    const codigos = new Set<string>();
    for (const vinculo of usuario.papeis) {
      for (const concessao of vinculo.papel.permissoes) {
        codigos.add(concessao.permissao.codigo);
      }
    }
    return { resolvido: true, permissoes: [...codigos].sort() };
  }
}
