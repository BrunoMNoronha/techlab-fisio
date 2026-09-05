// TechLab Fisio — primitiva interna de sessão (Etapa 2.3D-B / F2).
//
// Materializa `D-2.3D-01` (token e verificador), `D-2.3D-04` (política
// temporal e atualização monotônica) e `D-2.3D-05` (estados terminais) —
// `docs/12` §5.1, §5.4 e §5.5. Requisitos: AUT-002; RN-004.
//
// FATIA TÉCNICA INTERNA — LIMITE DE AUTORIZAÇÃO (vinculante):
//   - NÃO existe controller, rota, DTO HTTP, cookie, CSRF, rate limiting,
//     OpenAPI, guard ou decorator de RBAC nesta fatia; o serviço é
//     exercitado exclusivamente por testes;
//   - NENHUM evento de auditoria é emitido aqui: `usuario.autenticacao`
//     (`D-2.3D-12`) e a auditoria de logout pertencem à F3 — `AuthModule` NÃO
//     importa `AuditModule`;
//   - a decisão de AUTENTICAR (identificador, senha, caminho dummy,
//     anti-abuso) permanece fora daqui; F2 apenas emite, verifica, mantém e
//     encerra a sessão de quem o fluxo de login já autenticou.
//
// SEGREDOS NUNCA VAZAM: nenhuma função deste arquivo escreve em `console`, e
// nenhuma mensagem de erro ou valor de retorno carrega token, segredo,
// `token_hash` ou detalhe interno de banco. As rejeições são identificadas
// por um `motivo` de conjunto fechado — mesmo padrão de `ErroCredencial`,
// `ErroContextoAuditoria` e `ErroSituacaoProfissional`.
//
// CONCORRÊNCIA (`R-2.3D-03` — risco principal desta fatia): NENHUMA decisão de
// escrita é tomada em memória. Toda mutação de estado ou de atividade é um
// UPDATE **condicional**, com o predicado inteiro dentro do `WHERE`, avaliado
// atomicamente pelo PostgreSQL sob o lock da própria linha. Sob READ
// COMMITTED, uma transação concorrente que encontre a linha já alterada
// bloqueia no lock e **reavalia o predicado sobre a versão commitada** — de
// modo que um candidato ANTIGO nunca satisfaz um predicado que exige avanço
// sobre o `ultima_atividade_em` já vigente. O GREATEST da cláusula SET é a
// segunda barreira, independente da primeira, e materializa literalmente a
// fórmula de `D-2.3D-04`. Não existe SELECT -> decisão em memória -> UPDATE
// incondicional em ponto algum deste arquivo.

import { Inject, Injectable } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { DatabaseService } from "../database/database.service.js";
import { RELOGIO_SESSAO } from "./relogio-sessao.js";
import type { RelogioSessao } from "./relogio-sessao.js";
import {
  calcularVerificadorSessao,
  comporTokenSessao,
  decomporTokenSessao,
  gerarSegredoSessao,
  verificadorConfere,
  VERIFICADOR_SINTETICO_DE_AUSENCIA,
} from "./token-sessao.js";

/**
 * Política temporal homologada em `D-2.3D-04` (`docs/12` §5.4). Congelada e
 * NÃO configurável por ambiente: alterá-la é reabrir uma decisão homologada.
 * É a fonte única — os predicados SQL derivam destes valores, nunca de
 * literais `interval` duplicados na consulta.
 */
export const POLITICA_SESSAO = Object.freeze({
  /** Teto ABSOLUTO, fixado na criação; nunca desliza. */
  expiracaoAbsolutaMs: 8 * 60 * 60 * 1000,
  /** Timeout ocioso, derivado de `ultima_atividade_em`. */
  timeoutOciosoMs: 15 * 60 * 1000,
  /** Throttle de escrita de atividade: no máximo ~1 write por sessão/minuto. */
  throttleAtividadeMs: 60 * 1000,
});

export type MotivoSessaoInvalida =
  /** Entrada não é `<uuid>.<segredo>` bem formado. */
  | "TOKEN_MALFORMADO"
  /** Não existe sessão com o `sessao_id` informado. */
  | "SESSAO_INEXISTENTE"
  /** O segredo oferecido não corresponde ao verificador persistido. */
  | "SEGREDO_INVALIDO"
  /** Sessão terminal por expiração absoluta ou ociosa. */
  | "SESSAO_EXPIRADA"
  /** Sessão terminal por revogação. */
  | "SESSAO_REVOGADA";

export type MotivoRejeicaoEmissao = "USUARIO_INEXISTENTE" | "USUARIO_INATIVO";

/**
 * Falha de emissão identificada por motivo de conjunto fechado. A mensagem
 * deriva EXCLUSIVAMENTE do motivo — nunca de token, segredo, verificador ou
 * mensagem do driver de banco.
 */
export class ErroSessao extends Error {
  override readonly name = "ErroSessao";

  constructor(readonly motivo: MotivoRejeicaoEmissao) {
    super(`Emissão de sessão rejeitada: ${motivo}.`);
  }
}

export interface SessaoEmitida {
  readonly sessaoId: string;
  readonly usuarioId: string;
  /**
   * Token composto `<sessao_id>.<segredo>` — ÚNICA forma pela qual o segredo
   * deixa este serviço. Ele NÃO é exposto separadamente: o consumidor não tem
   * uso legítimo para o segredo isolado, e uma segunda via de saída seria uma
   * segunda via de vazamento.
   */
  readonly token: string;
  readonly criadaEm: Date;
  readonly ultimaAtividadeEm: Date;
  readonly expiraEm: Date;
}

export type ResultadoValidacaoSessao =
  | {
      readonly valida: true;
      readonly sessaoId: string;
      readonly usuarioId: string;
      readonly expiraEm: Date;
      readonly ultimaAtividadeEm: Date;
      /** `false` quando a sessão é válida mas a escrita foi throttled. */
      readonly atividadeRegistrada: boolean;
    }
  | { readonly valida: false; readonly motivo: MotivoSessaoInvalida };

export type ResultadoRevogacaoSessao =
  | {
      readonly revogada: true;
      readonly sessaoId: string;
      readonly usuarioId: string;
      readonly encerradaEm: Date;
    }
  | { readonly revogada: false; readonly motivo: MotivoSessaoInvalida };

/** Projeção mínima usada na classificação; nunca sai do serviço. */
const PROJECAO_SESSAO = {
  id: true,
  usuarioId: true,
  tokenHash: true,
  estado: true,
  ultimaAtividadeEm: true,
  expiraEm: true,
} as const;

@Injectable()
export class SessaoService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(RELOGIO_SESSAO) private readonly relogio: RelogioSessao,
  ) {}

  /**
   * Emite uma sessão nova (`D-2.3D-01`, `D-2.3D-04`).
   *
   * A linha nasce `ATIVA`, com `ultima_atividade_em = criada_em` e
   * `expira_em = criada_em + 8 h`. Os três instantes são escritos
   * EXPLICITAMENTE pela aplicação: o `@default(now())` de `criada_em` é
   * deliberadamente sobrescrito para que a política temporal inteira tenha um
   * único dono e um único relógio (`D-2.3D-01`, "Ausência de DEFAULT").
   *
   * A validação de usuário existente e ativo é INTEGRIDADE — mesmo precedente
   * declarado em `ProfissionalService`. Ela existe para que a violação de
   * chave estrangeira nunca escape como erro do driver (erros estáveis, sem
   * detalhe interno de banco) e para que nenhuma sessão possa nascer para
   * conta inativa (AUT-001). Ela NÃO é a decisão de autenticação, que
   * permanece na F3.
   */
  async emitir(comando: { readonly usuarioId: string }): Promise<SessaoEmitida> {
    return this.database.transacao(async (tx) => this.emitirEm(tx, comando));
  }

  /**
   * Mesma emissão de `emitir`, sobre uma transação JÁ ABERTA pelo chamador.
   *
   * ACRÉSCIMO DA F3 — ADITIVO, sem nenhuma mudança de semântica: `emitir`
   * passou a ser o invólucro transacional deste método, e todo o corpo veio
   * de lá sem alteração. A F2 permanece exatamente como homologada.
   *
   * POR QUE ELE EXISTE: `D-2.3D-12` e FC-01 exigem que o login emita evento
   * de auditoria, e o contrato do `AuditWriter` (`docs/09` §12, `D-AUD-08`)
   * exige que o evento entre na MESMA transação da mutação de negócio — aqui,
   * a própria criação da sessão. Sem este ponto de entrada, o login abriria
   * duas transações independentes e existiria um desfecho em que a sessão
   * nasce sem seu evento. É exatamente o mesmo padrão que o `AuditWriter` já
   * adota: quem tem a fronteira transacional a passa explicitamente.
   */
  async emitirEm(
    tx: TransacaoPersistencia,
    comando: { readonly usuarioId: string },
  ): Promise<SessaoEmitida> {
    const criadaEm = this.relogio.agora();
    const expiraEm = new Date(criadaEm.getTime() + POLITICA_SESSAO.expiracaoAbsolutaMs);
    const segredo = gerarSegredoSessao();

    const usuario = await tx.usuario.findUnique({
      where: { id: comando.usuarioId },
      select: { ativo: true },
    });
    if (usuario === null) throw new ErroSessao("USUARIO_INEXISTENTE");
    if (!usuario.ativo) throw new ErroSessao("USUARIO_INATIVO");

    const sessao = await tx.sessaoAutenticacao.create({
      data: {
        usuarioId: comando.usuarioId,
        tokenHash: calcularVerificadorSessao(segredo),
        estado: "ATIVA",
        criadaEm,
        ultimaAtividadeEm: criadaEm,
        expiraEm,
        encerradaEm: null,
        revogadaPorUsuarioId: null,
      },
      select: { id: true, criadaEm: true, ultimaAtividadeEm: true, expiraEm: true },
    });

    return {
      sessaoId: sessao.id,
      usuarioId: comando.usuarioId,
      token: comporTokenSessao(sessao.id, segredo),
      criadaEm: sessao.criadaEm,
      ultimaAtividadeEm: sessao.ultimaAtividadeEm,
      expiraEm: sessao.expiraEm,
    };
  }

  /**
   * Valida o token e, no mesmo passo transacional, registra a atividade sob
   * throttle monotônico (`D-2.3D-04`).
   *
   * As duas operações são combinadas de propósito: separá-las criaria um
   * estado intermediário em que a sessão foi julgada válida e a atividade
   * poderia deixar de ser registrada, fazendo uma sessão em uso expirar por
   * ociosidade. FAIL-CLOSED em toda rejeição.
   *
   * ORDEM OBRIGATÓRIA: a posse do segredo é conferida ANTES de qualquer
   * escrita. Registrar atividade antes de conferir o segredo permitiria a
   * quem conhece apenas o `sessao_id` — que não é segredo — manter viva a
   * sessão alheia.
   */
  async validar(token: unknown): Promise<ResultadoValidacaoSessao> {
    const decomposto = decomporTokenSessao(token);
    if (decomposto === null) return { valida: false, motivo: "TOKEN_MALFORMADO" };
    const { sessaoId, segredo } = decomposto;
    const agora = this.relogio.agora();

    return this.database.transacao(async (tx) => {
      const sessao = await tx.sessaoAutenticacao.findUnique({
        where: { id: sessaoId },
        select: PROJECAO_SESSAO,
      });
      if (sessao === null) {
        verificadorConfere(VERIFICADOR_SINTETICO_DE_AUSENCIA, segredo);
        return { valida: false, motivo: "SESSAO_INEXISTENTE" };
      }
      if (!verificadorConfere(sessao.tokenHash, segredo)) {
        return { valida: false, motivo: "SEGREDO_INVALIDO" };
      }

      const registrou = await this.#registrarAtividade(tx, sessaoId, agora);
      if (registrou) {
        return {
          valida: true,
          sessaoId,
          usuarioId: sessao.usuarioId,
          expiraEm: sessao.expiraEm,
          ultimaAtividadeEm: agora,
          atividadeRegistrada: true,
        };
      }

      // A atividade não foi escrita. Isso é, por construção, throttle OU
      // terminalidade — e a distinção é feita contra o estado FRESCO, depois
      // de tentar a transição de expiração (também condicional e atômica).
      await this.#detectarExpiracao(tx, sessaoId, agora);
      const atual = await tx.sessaoAutenticacao.findUnique({
        where: { id: sessaoId },
        select: PROJECAO_SESSAO,
      });
      if (atual === null) return { valida: false, motivo: "SESSAO_INEXISTENTE" };
      if (atual.estado === "REVOGADA") return { valida: false, motivo: "SESSAO_REVOGADA" };
      if (atual.estado !== "ATIVA") return { valida: false, motivo: "SESSAO_EXPIRADA" };
      if (this.#estaTemporalmenteExpirada(atual, agora)) {
        // Inalcançável em operação normal — a transição acima teria fechado a
        // sessão. Mantido como fail-closed: na dúvida, a sessão não vale.
        return { valida: false, motivo: "SESSAO_EXPIRADA" };
      }
      return {
        valida: true,
        sessaoId,
        usuarioId: atual.usuarioId,
        expiraEm: atual.expiraEm,
        ultimaAtividadeEm: atual.ultimaAtividadeEm,
        atividadeRegistrada: false,
      };
    });
  }

  /**
   * Logout do próprio usuário (`D-2.3D-05`): `ATIVA -> REVOGADA`, com
   * `revogada_por_usuario_id` = o próprio dono da sessão e `encerrada_em` no
   * instante da revogação.
   *
   * A operação recebe o TOKEN, não um par `(sessaoId, usuarioId)`: o
   * `sessao_id` não é segredo, e aceitar o usuário por parâmetro criaria a
   * possibilidade de revogar sessão alheia sem prova de posse. A autoria da
   * revogação é derivada da própria linha (`revogada_por_usuario_id =
   * usuario_id`), não de um argumento — é impossível atribuí-la a outro.
   *
   * IDEMPOTENTE E SEGURA SOB REPETIÇÃO/RACE: o WHERE exige `estado =
   * 'ATIVA'`; uma segunda chamada, ou uma chamada concorrente, não altera
   * nada e não reescreve `encerrada_em`. Uma sessão que já passou do prazo
   * absoluto ou do limite de ociosidade NÃO vira `REVOGADA`: ela é fechada
   * como `EXPIRADA`, que é o estado verdadeiro.
   *
   * A RESPOSTA CORRESPONDE SEMPRE AO ESTADO PERSISTIDO: a detecção de
   * expiração roda ANTES da revogação — ver o comentário no corpo. Não existe
   * desfecho em que esta operação informe encerramento e a sessão continue
   * `ATIVA` e utilizável.
   */
  async revogar(token: unknown): Promise<ResultadoRevogacaoSessao> {
    return this.database.transacao(async (tx) => this.revogarEm(tx, token));
  }

  /**
   * Mesma revogação de `revogar`, sobre uma transação JÁ ABERTA pelo chamador.
   *
   * ACRÉSCIMO DA F3 — ADITIVO, sem mudança de semântica, pelo mesmo motivo e
   * com o mesmo cuidado de `emitirEm`: `usuario.sessao.logout` (`docs/09` §5,
   * linha DD; FC-01 §Auditoria) precisa entrar na MESMA transação que fecha a
   * sessão. A ordem obrigatória de `C-01` (detecção de expiração antes da
   * revogação) é preservada literalmente — nada do corpo mudou.
   */
  async revogarEm(
    tx: TransacaoPersistencia,
    token: unknown,
  ): Promise<ResultadoRevogacaoSessao> {
    const decomposto = decomporTokenSessao(token);
    if (decomposto === null) return { revogada: false, motivo: "TOKEN_MALFORMADO" };
    const { sessaoId, segredo } = decomposto;
    const agora = this.relogio.agora();

    {
      const sessao = await tx.sessaoAutenticacao.findUnique({
        where: { id: sessaoId },
        select: PROJECAO_SESSAO,
      });
      if (sessao === null) {
        verificadorConfere(VERIFICADOR_SINTETICO_DE_AUSENCIA, segredo);
        return { revogada: false, motivo: "SESSAO_INEXISTENTE" };
      }
      if (!verificadorConfere(sessao.tokenHash, segredo)) {
        return { revogada: false, motivo: "SEGREDO_INVALIDO" };
      }

      // ORDEM OBRIGATÓRIA (correção `A-01`, revisão independente da F2): a
      // DETECÇÃO DE EXPIRAÇÃO vem ANTES da revogação, e o UPDATE de revogação
      // NÃO repete predicado temporal algum.
      //
      // POR QUE A ORDEM IMPORTA — o defeito que esta ordem elimina: um UPDATE
      // que casa ZERO linhas NÃO adquire lock sobre a linha. Na ordem anterior
      // (revogação com predicados temporais primeiro, detecção depois), a
      // revogação de uma sessão ociosa devolvia 0 sem travar nada, e uma
      // `validar` concorrente portando um instante ligeiramente ANTERIOR podia
      // renovar `ultima_atividade_em` exatamente nessa janela; a detecção
      // seguinte então não disparava, e o chamador recebia `SESSAO_EXPIRADA`
      // para uma sessão que permanecia `ATIVA` e plenamente utilizável — um
      // logout que falhava em silêncio (AUT-002: "token/cookie de sessão
      // encerrada não autoriza novas operações").
      //
      // Nesta ordem a janela deixa de existir: se a sessão está vencida em
      // `agora`, a detecção a fecha ATOMICAMENTE antes de qualquer outra
      // coisa, e nenhuma atividade concorrente pode reanimá-la — todo UPDATE
      // de atividade exige `estado = 'ATIVA'`. Se NÃO está vencida, a
      // revogação encontra `ATIVA` e vence. Os dois desfechos são verdadeiros.
      //
      // CONSEQUÊNCIA DE CLASSIFICAÇÃO: depois desta ordem, `revogadas === 0`
      // significa EXATAMENTE `estado <> 'ATIVA'`. Como nenhum statement deste
      // arquivo devolve uma sessão a `ATIVA` (§`#detectarExpiracao`), o estado
      // relido é necessariamente terminal — e a resposta passa a corresponder
      // sempre ao estado persistido, sem TOCTOU residual.
      await this.#detectarExpiracao(tx, sessaoId, agora);

      const revogadas = await tx.$executeRaw`
        UPDATE sessao_autenticacao
           SET estado                  = 'REVOGADA',
               encerrada_em            = ${agora}::timestamptz,
               revogada_por_usuario_id = usuario_id
         WHERE id     = ${sessaoId}::uuid
           AND estado = 'ATIVA'
      `;
      if (revogadas === 1) {
        return {
          revogada: true,
          sessaoId,
          usuarioId: sessao.usuarioId,
          encerradaEm: agora,
        };
      }

      const atual = await tx.sessaoAutenticacao.findUnique({
        where: { id: sessaoId },
        select: PROJECAO_SESSAO,
      });
      if (atual === null) return { revogada: false, motivo: "SESSAO_INEXISTENTE" };
      if (atual.estado === "REVOGADA") return { revogada: false, motivo: "SESSAO_REVOGADA" };
      return { revogada: false, motivo: "SESSAO_EXPIRADA" };
    }
  }

  /**
   * REVOGAÇÃO EM MASSA das sessões de um usuário (RN-005; T-07; AUT-002:
   * "recuperação/troca de senha conforme política aprovada" como gatilho),
   * sobre uma transação JÁ ABERTA pelo chamador — ACRÉSCIMO ADITIVO DA F6,
   * no mesmo padrão de `emitirEm`/`revogarEm`.
   *
   * Dois UPDATEs condicionais, na ORDEM de `C-01` e pelas MESMAS razões:
   *   1. sessões `ATIVA` já vencidas (absoluta ou ociosa) são fechadas como
   *      `EXPIRADA` — o estado verdadeiro — e não como `REVOGADA`;
   *   2. as `ATIVA` restantes passam a `REVOGADA`, com `encerrada_em` no
   *      instante da operação e `revogada_por_usuario_id = usuario_id`.
   *
   * `revogada_por_usuario_id` = o PRÓPRIO usuário — DECISÃO LOCAL `L-F6-06`
   * (reversível): `D-2.3D-05` fixa o próprio usuário para o logout e nada
   * fixa para T-07; o ator homologado da conclusão da recuperação é o
   * usuário (`docs/09` §5), que é quem, ao definir a nova senha, encerra as
   * sessões anteriores. Nenhuma identidade sintética e nenhum `NULL` que
   * afirmasse ação de sistema.
   *
   * Nenhum statement devolve sessão a `ATIVA`; `expira_em` não é tocado;
   * `IDX-S1` (`usuario_id, estado`) é exatamente o índice previsto para esta
   * operação (`docs/07` §10-A: "revogação em massa — T-07").
   */
  async revogarTodasDoUsuarioEm(
    tx: TransacaoPersistencia,
    usuarioId: string,
  ): Promise<{ readonly expiradas: number; readonly revogadas: number }> {
    const agora = this.relogio.agora();
    const limiteOcioso = new Date(agora.getTime() - POLITICA_SESSAO.timeoutOciosoMs);
    const expiradas = await tx.$executeRaw`
      UPDATE sessao_autenticacao
         SET estado       = 'EXPIRADA',
             encerrada_em = ${agora}::timestamptz
       WHERE usuario_id = ${usuarioId}::uuid
         AND estado     = 'ATIVA'
         AND (   expira_em           <= ${agora}::timestamptz
              OR ultima_atividade_em <= ${limiteOcioso}::timestamptz)
    `;
    const revogadas = await tx.$executeRaw`
      UPDATE sessao_autenticacao
         SET estado                  = 'REVOGADA',
             encerrada_em            = ${agora}::timestamptz,
             revogada_por_usuario_id = usuario_id
       WHERE usuario_id = ${usuarioId}::uuid
         AND estado     = 'ATIVA'
    `;
    return { expiradas, revogadas };
  }

  /**
   * `R-2.3D-03` — atualização ATOMICAMENTE MONOTÔNICA de atividade.
   *
   * Um único statement carrega TODA a decisão:
   *   - `estado = 'ATIVA'` .................. não ressuscita sessão terminal;
   *   - `expira_em > agora` ................. respeita o teto absoluto;
   *   - `ultima_atividade_em > limiteOcioso`. não revive sessão já ociosa;
   *   - `ultima_atividade_em <= limiteThrottle` ... throttle de ~1 write/min;
   *   - `SET ... = GREATEST(ultima_atividade_em, agora)` ... monotonicidade.
   *
   * POR QUE NÃO HÁ LAST-WRITER-WINS REGRESSIVO. Sob READ COMMITTED, quando
   * duas transações disputam a linha, a segunda bloqueia no lock e reavalia o
   * WHERE **sobre a versão commitada pela primeira**. O predicado de throttle
   * exige `ultima_atividade_em <= agora - 1 min`, isto é, exige que o
   * candidato esteja ADIANTE do valor vigente; um candidato mais antigo que o
   * `ultima_atividade_em` já commitado não satisfaz esse predicado e a linha é
   * simplesmente pulada (count = 0). Ainda que o predicado fosse satisfeito, a
   * cláusula SET é reavaliada sobre a mesma versão nova e GREATEST impede a
   * regressão. São duas barreiras independentes, ambas dentro do statement.
   *
   * `expira_em` NUNCA é tocado aqui — a janela absoluta não desliza
   * (`D-2.3D-04`; alternativa A-03 rejeitada em `docs/12` §6).
   *
   * Os limites chegam ao SQL como INSTANTES já calculados a partir de
   * `POLITICA_SESSAO`, e não como literais `interval` escritos na consulta:
   * assim a política tem uma fonte única e não pode divergir entre código e
   * consulta.
   */
  async #registrarAtividade(
    tx: TransacaoPersistencia,
    sessaoId: string,
    agora: Date,
  ): Promise<boolean> {
    const limiteOcioso = new Date(agora.getTime() - POLITICA_SESSAO.timeoutOciosoMs);
    const limiteThrottle = new Date(agora.getTime() - POLITICA_SESSAO.throttleAtividadeMs);
    const atualizadas = await tx.$executeRaw`
      UPDATE sessao_autenticacao
         SET ultima_atividade_em = GREATEST(ultima_atividade_em, ${agora}::timestamptz)
       WHERE id                  = ${sessaoId}::uuid
         AND estado              = 'ATIVA'
         AND expira_em           > ${agora}::timestamptz
         AND ultima_atividade_em > ${limiteOcioso}::timestamptz
         AND ultima_atividade_em <= ${limiteThrottle}::timestamptz
    `;
    return atualizadas === 1;
  }

  /**
   * `D-2.3D-05` — transição `ATIVA -> EXPIRADA` por prazo absoluto OU por
   * ociosidade, com `encerrada_em` no instante da DETECÇÃO.
   *
   * Condicional e atômica: `estado = 'ATIVA'` garante que nem duas detecções
   * concorrentes, nem uma detecção que corra contra um logout, produzam
   * reescrita de estado terminal. Quem chegar depois observa count = 0 e lê o
   * estado verdadeiro. Não existe caminho que leve `EXPIRADA` ou `REVOGADA` de
   * volta a `ATIVA` — nenhum statement deste arquivo escreve `'ATIVA'`, exceto
   * a criação.
   */
  async #detectarExpiracao(
    tx: TransacaoPersistencia,
    sessaoId: string,
    agora: Date,
  ): Promise<boolean> {
    const limiteOcioso = new Date(agora.getTime() - POLITICA_SESSAO.timeoutOciosoMs);
    const expiradas = await tx.$executeRaw`
      UPDATE sessao_autenticacao
         SET estado       = 'EXPIRADA',
             encerrada_em = ${agora}::timestamptz
       WHERE id     = ${sessaoId}::uuid
         AND estado = 'ATIVA'
         AND (   expira_em           <= ${agora}::timestamptz
              OR ultima_atividade_em <= ${limiteOcioso}::timestamptz)
    `;
    return expiradas === 1;
  }

  /**
   * Espelho em memória dos predicados temporais — usado APENAS no ramo
   * fail-closed de `validar`, nunca para decidir uma escrita.
   */
  #estaTemporalmenteExpirada(
    sessao: { readonly expiraEm: Date; readonly ultimaAtividadeEm: Date },
    agora: Date,
  ): boolean {
    return (
      sessao.expiraEm.getTime() <= agora.getTime() ||
      sessao.ultimaAtividadeEm.getTime() <= agora.getTime() - POLITICA_SESSAO.timeoutOciosoMs
    );
  }
}
