// TechLab Fisio — seed idempotente de papéis, permissões e matriz
// (Etapa 2.3D-B / F5; `D-2.3D-09` e `D-2.3D-14`, `docs/12`).
//
// O QUE ESTE SERVIÇO É: a materialização, em `papel`, `permissao` e
// `papel_permissao`, do catálogo tipado de `catalogo-rbac.ts` — que por sua
// vez É `docs/04` §3/§4/§5. Ele não decide papel, não decide permissão e não
// decide associação: apenas escreve o que a fonte homologada determina.
//
// PERSISTÊNCIA — ZERO ALTERAÇÃO ESTRUTURAL. Consome exclusivamente as três
// tabelas já existentes desde a Fase 2 (`docs/12` §7.4). Nenhuma coluna,
// nenhuma tabela, nenhum índice, nenhuma migration. Seed de DADOS não é
// migration estrutural.
//
// SERIALIZAÇÃO (fatia corretiva): a transação adquire o advisory lock do
// provisionamento ANTES de qualquer leitura. Sem ele, duas execuções
// simultâneas liam o mesmo estado vazio e a segunda morria com violação de
// unicidade (`P2002`) — comportamento medido pelas revisões independentes.
// Com o lock, execuções concorrentes SERIALIZAM: a segunda relê o estado já
// commitado pela primeira e converge para `jaConforme`. Ver
// `bloqueio-provisionamento.ts` para o racional completo.
//
// IDEMPOTÊNCIA — por leitura-e-completação, não por `upsert`: o serviço LÊ o
// estado vigente e ESCREVE apenas o que falta. Uma segunda execução sobre
// banco já semeado não emite nenhum `INSERT` e nenhum `UPDATE`.
//
// CONVERGÊNCIA DE `nome`: `papel`/`permissao` existente com o mesmo `codigo`
// e `nome` divergente da fonte tem o `nome` atualizado — e somente ele, e
// somente quando de fato difere.
//
// ADITIVO, NUNCA DESTRUTIVO — `D-2.3D-14`: um
// seed que removesse associações fora da matriz REVOGARIA silenciosamente as
// concessões que `docs/04` §4 marca como `P` e que só um Administrador
// concede depois. O seed garante que a matriz homologada esteja PRESENTE; ele
// não garante que nada mais exista.
//
// MAS A DIVERGÊNCIA DEIXOU DE SER SILENCIOSA (correção `F5-R-02`). A revisão
// independente mediu que um banco contaminado (papel `SUPERADMIN`, permissão
// `tudo.liberado`, `GESTOR -> pacotes.ajustar_sessao`) produzia a saída
// `+0 ~0 +0`, que um operador lê como "conforme" — inclusive com HOM-01
// violado no estado persistido. Agora o serviço RELATA:
//   - papéis fora do catálogo de `docs/04` §3;
//   - permissões fora do catálogo de `docs/04` §5;
//   - associações além da matriz homologada.
// `jaConforme` passou a significar "nenhuma escrita E nenhuma divergência".
// O modo ESTRITO também aplica/completa a matriz canônica e faz o CHAMADOR
// terminar com saída 3 quando ainda há divergência. Ele não é read-only; sua
// garantia é preservar os excedentes e torná-los bloqueantes para automação
// (`D-2.3D-14`).
//
// PRIVACIDADE DA SAÍDA: códigos fora do catálogo são strings escritas por
// terceiros e podem conter qualquer coisa. Por isso eles NUNCA são
// devolvidos — apenas CONTADOS. Somente pares cujos DOIS lados pertencem ao
// catálogo homologado são nomeados, porque esses são valores conhecidos e
// não sensíveis.
//
// ATOMICIDADE: tudo em UMA transação da fronteira única
// (`DatabaseService.transacao`), no mesmo padrão de `ProfissionalService`.
//
// SEM AUDITORIA: o seed não altera papéis de USUÁRIO algum, e
// `usuario.papeis.alterados` tem o usuário por alvo. Emitir evento para a
// criação do catálogo exigiria ação nova — vedado por `D-AUD-04`/`D-AUD-05`
// sem decisão própria.
//
// SEM ARGON2: este serviço NÃO depende de `CredencialService`. O módulo do
// seed importa apenas `DatabaseModule`, e por isso `seed` roda em máquina
// onde o addon nativo do Argon2 esteja indisponível.

import { Injectable } from "@nestjs/common";

import { PERMISSOES } from "../authz/permissoes.catalogo.js";
import { DatabaseService } from "../database/database.service.js";
import { bloquearProvisionamento } from "./bloqueio-provisionamento.js";
import {
  ASSOCIACOES_SEED,
  DESCRICAO_PERMISSAO,
  PAPEIS,
} from "./catalogo-rbac.js";

/**
 * Divergências entre o estado persistido e a matriz homologada. São sempre
 * ADITIVAS (algo a mais no banco) — o seed garante que nada esteja faltando.
 */
export interface DivergenciasRbac {
  /** Papéis persistidos fora de `docs/04` §3. Apenas contados. */
  readonly papeisDesconhecidos: number;
  /** Permissões persistidas fora de `docs/04` §5. Apenas contadas. */
  readonly permissoesDesconhecidas: number;
  /** Associações além da matriz homologada. */
  readonly associacoesExcedentes: number;
  /**
   * Subconjunto SEGURO de nomear: pares cujos dois lados pertencem ao
   * catálogo homologado (ex.: `GESTOR -> pacotes.ajustar_sessao`). Ordenado.
   */
  readonly associacoesExcedentesCanonicas: readonly string[];
  /** Soma das três contagens — zero significa banco exatamente conforme. */
  readonly total: number;
}

/** Contagens medidas de uma execução do seed — a prova da idempotência. */
export interface ResultadoSeedRbac {
  readonly papeisCriados: number;
  readonly papeisAtualizados: number;
  readonly permissoesCriadas: number;
  readonly permissoesAtualizadas: number;
  readonly associacoesCriadas: number;
  /** `true` sse nenhuma escrita foi necessária E não há divergência alguma. */
  readonly jaConforme: boolean;
  readonly divergencias: DivergenciasRbac;
}

export type MotivoFalhaSeedRbac = "ASSOCIACAO_NAO_RESOLVIVEL";

export class ErroSeedRbac extends Error {
  override readonly name = "ErroSeedRbac";

  constructor(
    readonly motivo: MotivoFalhaSeedRbac,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

@Injectable()
export class SeedRbacService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Aplica o seed homologado. Determinístico, repetível, idempotente e
   * serializado contra execuções concorrentes.
   */
  async executar(): Promise<ResultadoSeedRbac> {
    return this.database.transacao(async (tx) => {
      // SERIALIZAÇÃO — antes de QUALQUER leitura. Uma execução concorrente
      // espera aqui e, ao prosseguir, enxerga o estado já commitado.
      await bloquearProvisionamento(tx);

      // ---------------------------------------------------------------- papéis
      const codigosDePapel = PAPEIS.map((papel) => papel.codigo);
      const papeisExistentes = await tx.papel.findMany({
        where: { codigo: { in: [...codigosDePapel] } },
        select: { id: true, codigo: true, nome: true },
      });
      const papelPorCodigo = new Map(
        papeisExistentes.map((papel) => [papel.codigo, papel]),
      );

      let papeisCriados = 0;
      let papeisAtualizados = 0;
      for (const papel of PAPEIS) {
        const vigente = papelPorCodigo.get(papel.codigo);
        if (vigente === undefined) {
          const criado = await tx.papel.create({
            data: { codigo: papel.codigo, nome: papel.nome },
            select: { id: true, codigo: true, nome: true },
          });
          papelPorCodigo.set(criado.codigo, criado);
          papeisCriados += 1;
        } else if (vigente.nome !== papel.nome) {
          await tx.papel.update({
            where: { id: vigente.id },
            data: { nome: papel.nome },
          });
          papeisAtualizados += 1;
        }
      }

      // ----------------------------------------------------------- permissões
      const permissoesExistentes = await tx.permissao.findMany({
        where: { codigo: { in: [...PERMISSOES] } },
        select: { id: true, codigo: true, nome: true },
      });
      const permissaoPorCodigo = new Map(
        permissoesExistentes.map((permissao) => [permissao.codigo, permissao]),
      );

      let permissoesCriadas = 0;
      let permissoesAtualizadas = 0;
      for (const codigo of PERMISSOES) {
        const nome = DESCRICAO_PERMISSAO[codigo];
        const vigente = permissaoPorCodigo.get(codigo);
        if (vigente === undefined) {
          const criada = await tx.permissao.create({
            data: { codigo, nome },
            select: { id: true, codigo: true, nome: true },
          });
          permissaoPorCodigo.set(criada.codigo, criada);
          permissoesCriadas += 1;
        } else if (vigente.nome !== nome) {
          await tx.permissao.update({
            where: { id: vigente.id },
            data: { nome },
          });
          permissoesAtualizadas += 1;
        }
      }

      // ------------------------------------------------- matriz papel↔permissão
      const idsDePapel = [...papelPorCodigo.values()].map((papel) => papel.id);
      const vinculosExistentes = await tx.papelPermissao.findMany({
        where: { papelId: { in: idsDePapel } },
        select: { papelId: true, permissaoId: true },
      });
      const vinculoJaExiste = new Set(
        vinculosExistentes.map((vinculo) => `${vinculo.papelId} ${vinculo.permissaoId}`),
      );

      let associacoesCriadas = 0;
      for (const associacao of ASSOCIACOES_SEED) {
        // Ausência aqui seria defeito de programação (o `satisfies` do
        // catálogo já casa os dois conjuntos em compilação). Fail-closed
        // mesmo assim: nunca prosseguir com associação não resolvida.
        const papel = papelPorCodigo.get(associacao.papel);
        const permissao = permissaoPorCodigo.get(associacao.permissao);
        if (papel === undefined || permissao === undefined) {
          throw new ErroSeedRbac(
            "ASSOCIACAO_NAO_RESOLVIVEL",
            `Seed abortado: a associação ${associacao.papel} -> ${associacao.permissao} ` +
              "não pôde ser resolvida contra as linhas persistidas.",
          );
        }
        if (vinculoJaExiste.has(`${papel.id} ${permissao.id}`)) continue;
        await tx.papelPermissao.create({
          data: { papelId: papel.id, permissaoId: permissao.id },
        });
        associacoesCriadas += 1;
      }

      const divergencias = await this.#medirDivergencias(tx);

      return {
        papeisCriados,
        papeisAtualizados,
        permissoesCriadas,
        permissoesAtualizadas,
        associacoesCriadas,
        jaConforme:
          papeisCriados === 0 &&
          papeisAtualizados === 0 &&
          permissoesCriadas === 0 &&
          permissoesAtualizadas === 0 &&
          associacoesCriadas === 0 &&
          divergencias.total === 0,
        divergencias,
      };
    });
  }

  /**
   * Mede o que existe ALÉM da matriz homologada, DEPOIS de o seed ter
   * garantido o que falta. Leitura pura — nada é removido nem alterado.
   */
  async #medirDivergencias(
    tx: Parameters<Parameters<DatabaseService["transacao"]>[0]>[0],
  ): Promise<DivergenciasRbac> {
    const codigosDePapel = new Set<string>(PAPEIS.map((papel) => papel.codigo));
    const codigosDePermissao = new Set<string>(PERMISSOES);

    const papeis = await tx.papel.findMany({ select: { id: true, codigo: true } });
    const permissoes = await tx.permissao.findMany({ select: { id: true, codigo: true } });
    const vinculos = await tx.papelPermissao.findMany({
      select: { papelId: true, permissaoId: true },
    });

    const papelPorId = new Map(papeis.map((papel) => [papel.id, papel.codigo]));
    const permissaoPorId = new Map(permissoes.map((p) => [p.id, p.codigo]));

    const esperadas = new Set(
      ASSOCIACOES_SEED.map((a) => `${a.papel} ${a.permissao}`),
    );

    let associacoesExcedentes = 0;
    const canonicas: string[] = [];
    for (const vinculo of vinculos) {
      const codigoPapel = papelPorId.get(vinculo.papelId);
      const codigoPermissao = permissaoPorId.get(vinculo.permissaoId);
      if (codigoPapel === undefined || codigoPermissao === undefined) {
        // Linha órfã não é alcançável (há FK), mas contá-la é fail-closed.
        associacoesExcedentes += 1;
        continue;
      }
      if (esperadas.has(`${codigoPapel} ${codigoPermissao}`)) continue;
      associacoesExcedentes += 1;
      // Nomear SÓ quando os dois lados são do catálogo homologado.
      if (codigosDePapel.has(codigoPapel) && codigosDePermissao.has(codigoPermissao)) {
        canonicas.push(`${codigoPapel} -> ${codigoPermissao}`);
      }
    }

    const papeisDesconhecidos = papeis.filter((p) => !codigosDePapel.has(p.codigo)).length;
    const permissoesDesconhecidas = permissoes.filter(
      (p) => !codigosDePermissao.has(p.codigo),
    ).length;

    return {
      papeisDesconhecidos,
      permissoesDesconhecidas,
      associacoesExcedentes,
      associacoesExcedentesCanonicas: canonicas.sort(),
      total: papeisDesconhecidos + permissoesDesconhecidas + associacoesExcedentes,
    };
  }
}
