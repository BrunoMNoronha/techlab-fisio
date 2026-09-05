// TechLab Fisio — recuperação segura de senha (Etapa 2.3D-B / F6).
//
// Materializa AUT-004 (`docs/02` — "Recuperar senha com mecanismo seguro"),
// D-04 (`docs/03` §3), RN-005, T-07 (`docs/06` §12.7; `docs/07` §24.2 —
// "consumo do segredo + revogação atômicos"), `D-2.3D-08` (`docs/12` §5.8) e a
// segunda metade de `D-2.3D-06` (§5.6), consumindo — sem duplicar — o
// `CredencialService` (F1), o `SessaoService` (F2), o `AuditWriter` (2.3B) e
// a fronteira transacional única (`DatabaseService`).
//
// O FLUXO HOMOLOGADO, passo a passo (AUT-004 "Fluxo principal aprovado"):
//
//   1. administrador autorizado inicia ........ `iniciar`, sob
//      `senha.recuperar_terceiro` (`docs/04` §5.1), com o ator vindo da
//      sessão validada — nunca do corpo;
//   2. o sistema gera segredo de uso único e curta validade ... 256 bits
//      (`D-2.3D-08`), 30 minutos, hash SHA-256 persistido;
//   3. apresentado UMA vez para entrega por canal externo ..... devolvido no
//      corpo de `iniciar`, e em nenhum outro lugar. NENHUM e-mail, SMS ou
//      WhatsApp: fora do MVP (TLF-BASE-V1 §13), e D-04 dispensa canal
//      integrado por construção;
//   4. usuário apresenta o segredo válido ..................... `concluir`,
//      sem sessão, localizado pelo hash do próprio segredo;
//   5. usuário define nova senha .............................. Argon2id da
//      F1 (`D-2.3D-02`), calculado FORA da transação;
//   6. segredo é invalidado ................................... `consumido_em`
//      por UPDATE condicional atômico (uso único, replay impossível);
//   7. sessões anteriores são revogadas ....................... todas as
//      sessões `ATIVA` do usuário, na MESMA transação (RN-005, T-07).
//
// `D-2.3D-08`: "no máximo um segredo pendente por usuário; ao emitir um novo,
// o anterior é invalidado/expirado" — `iniciar` serializa por lock da linha
// do usuário (`SELECT ... FOR UPDATE`) e EXPIRA (`expira_em = agora`) todo
// segredo ainda pendente antes de inserir o novo. "A conclusão não cria
// automaticamente nova sessão" — `concluir` não emite sessão nem cookie.
//
// ATOMICIDADE (T-07): consumo do segredo, troca da senha, revogação das
// sessões e evento de auditoria vivem em UMA transação. Qualquer falha —
// inclusive da auditoria — reverte tudo: o segredo continua pendente, a senha
// antiga continua válida, as sessões continuam `ATIVA`.
//
// CONCORRÊNCIA: nenhuma decisão de escrita é tomada em memória. O consumo é
// um UPDATE cujo predicado inteiro (`consumido_em IS NULL AND expira_em >
// agora`) é avaliado pelo PostgreSQL sob o lock da linha; sob READ COMMITTED,
// a transação perdedora reavalia o predicado sobre a versão commitada e casa
// zero linhas. Duas conclusões simultâneas com o mesmo segredo produzem
// EXATAMENTE uma troca de senha e um evento. A troca da senha é igualmente
// condicionada (`ativo = true`), e o `rehash` do login (`F-04`) já é
// condicionado ao digest verificado — uma sessão de login concorrente jamais
// ressuscita a senha antiga.
//
// ORDEM DE LOCKS — ÚNICA E GLOBAL PARA ESTE MÓDULO:
//
//        usuario  →  segredo_recuperacao_senha  →  sessao_autenticacao
//
// `iniciar` e `concluir` tocam o MESMO par de linhas (a do usuário e a do
// segredo) e, antes desta disciplina, o faziam em ordens INVERSAS: o início
// bloqueava `usuario` e depois o segredo; a conclusão consumia o segredo e só
// então atualizava `usuario`. Um início e uma conclusão simultâneos para o
// mesmo usuário fechavam o ciclo de espera e o PostgreSQL abortava um dos
// lados com `40P01` (deadlock detected) — que, atravessando o filtro, viraria
// `500 FALHA_INTERNA` para um cliente que não errou em nada.
//
// A causa é removida na origem, e NÃO por captura de `40P01` nem por retry:
// a transação T-07 adquire a linha de `usuario` com `SELECT ... FOR UPDATE`
// ANTES de tocar o segredo e ANTES de revogar as sessões, exatamente como o
// início já fazia. Com uma ordem única não existe ciclo possível; as duas
// operações passam a SERIALIZAR de forma determinística no lock do usuário.
// A ordem coincide com a lista de tabelas de T-07 em `docs/07` §24.2
// (`usuario`, `segredo_recuperacao_senha`, `sessao_autenticacao`).
//
// ANTI-ENUMERAÇÃO (RN-006; TLF-BASE-V1 §10): a conclusão responde de forma
// UNIFORME para segredo malformado, inexistente, expirado, consumido e
// usuário inativo, e nenhum identificador de usuário participa do contrato.
// O início é autenticado e autorizado; ainda assim, inexistente, inativo e
// auto-alvo colapsam num único desfecho.
//
// SEGREDOS NUNCA VAZAM: nenhuma função deste arquivo escreve em `console`;
// nenhum evento de auditoria carrega segredo, hash, senha ou identificador
// (`docs/09` §5: chaves proibidas "segredo/token, hash" e "segredo, nova
// senha"; `D-AUD-07`); o segredo em claro existe apenas no valor de retorno
// de `iniciar`.

import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { CredencialService } from "../auth/credencial.service.js";
import { normalizarIdentificadorLogin } from "../auth/identificador-login.js";
import { RELOGIO_SESSAO } from "../auth/relogio-sessao.js";
import type { RelogioSessao } from "../auth/relogio-sessao.js";
import { SessaoService } from "../auth/sessao.service.js";
import { DatabaseService } from "../database/database.service.js";
import { LimitadorRecuperacao } from "./limitador-recuperacao.js";
import {
  HASH_SINTETICO_DE_AUSENCIA,
  calcularHashSegredoRecuperacao,
  ehSegredoRecuperacaoBemFormado,
  gerarSegredoRecuperacao,
  hashSegredoRecuperacaoConfere,
} from "./segredo-recuperacao.js";

/**
 * Política homologada em `D-2.3D-08`. Congelada e NÃO configurável por
 * ambiente: alterá-la é reabrir uma decisão homologada.
 */
export const POLITICA_RECUPERACAO = Object.freeze({
  /** Validade do segredo — 30 minutos. */
  validadeMs: 30 * 60 * 1000,
});

/** `alvo_tipo` dos dois eventos — `D-AUD-03`: nome físico da tabela. */
const ALVO_USUARIO = "usuario";

/**
 * Sentinela INTERNA: o segredo (ou a conta) deixou de estar apto entre a
 * verificação e o consumo. Nunca escapa deste arquivo — vira o desfecho
 * uniforme `RECUPERACAO_INVALIDA`.
 */
class ErroSegredoSuperado extends Error {
  override readonly name = "ErroSegredoSuperado";
}

export interface ComandoIniciarRecuperacao {
  /** Identificador do usuário ALVO; normalizado por `D-2.3D-03` antes de tudo. */
  readonly identificador: string;
  /** Administrador autenticado que inicia — vem do contexto de sessão, nunca do corpo. */
  readonly atorUsuarioId: string;
}

export type ResultadoIniciarRecuperacao =
  | {
      readonly desfecho: "EMITIDO";
      /** Segredo em claro — a ÚNICA saída dele. Nunca é persistido nem registrado. */
      readonly segredo: string;
      readonly expiraEm: Date;
    }
  /** Uniforme: usuário inexistente, inativo ou o próprio ator. */
  | { readonly desfecho: "ALVO_NAO_ELEGIVEL" };

export interface ComandoConcluirRecuperacao {
  readonly segredo: string;
  readonly novaSenha: string;
  /** Origem da requisição, para a dimensão de IP de `D-2.3D-06`. */
  readonly ip: string;
}

export type ResultadoConcluirRecuperacao =
  | { readonly desfecho: "CONCLUIDA" }
  /** Uniforme: malformado, inexistente, expirado, consumido, usuário inativo. */
  | { readonly desfecho: "RECUPERACAO_INVALIDA" }
  | { readonly desfecho: "BLOQUEADO"; readonly retryAfterSegundos: number };

@Injectable()
export class RecuperacaoSenhaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credenciais: CredencialService,
    private readonly sessoes: SessaoService,
    private readonly limitador: LimitadorRecuperacao,
    private readonly auditWriter: AuditWriter,
    @Inject(RELOGIO_SESSAO) private readonly relogio: RelogioSessao,
  ) {}

  /**
   * Início (AUT-004, passos 1–3; `usuario.senha.recuperacao_iniciada`).
   *
   * Serializado por usuário: o `FOR UPDATE` na linha de `usuario` é a
   * primeira operação decisória, de modo que dois inícios concorrentes para o
   * mesmo alvo executam um após o outro e o segundo expira o segredo do
   * primeiro. Ao final existe EXATAMENTE um segredo pendente (`D-2.3D-08`).
   *
   * O alvo INATIVO é recusado (AUT-004 lista "usuário inativo" entre as
   * exceções; RN-001 — um segredo para conta inativa seria inconcluível). O
   * PRÓPRIO ator é recusado: a permissão homologada é "iniciar recuperação de
   * senha de TERCEIRO" (`docs/04` §4/§5.1) — decisão local `L-F6-03`.
   */
  async iniciar(comando: ComandoIniciarRecuperacao): Promise<ResultadoIniciarRecuperacao> {
    const email = normalizarIdentificadorLogin(comando.identificador);
    const segredo = gerarSegredoRecuperacao();
    const hashSegredo = calcularHashSegredoRecuperacao(segredo);
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      // O instante é decidido pela aplicação (`D-2.3D-01`, mesmo racional):
      // criação, expiração e evento partilham UM relógio.
      const agora = this.relogio.agora();
      const expiraEm = new Date(agora.getTime() + POLITICA_RECUPERACAO.validadeMs);

      // LOCK da linha do alvo ANTES de qualquer leitura decisória — a linha
      // existe (ao contrário do caso do bootstrap da F5) e serve de ponto de
      // serialização por usuário. `email` é `U-01` (único).
      const linhas = await tx.$queryRaw<Array<{ id: string; ativo: boolean }>>`
        SELECT id, ativo FROM usuario WHERE email = ${email} FOR UPDATE
      `;
      const alvo = linhas[0];
      if (alvo === undefined || !alvo.ativo || alvo.id === comando.atorUsuarioId) {
        return { desfecho: "ALVO_NAO_ELEGIVEL" as const };
      }

      // `D-2.3D-08`: o segredo pendente anterior é EXPIRADO no instante da
      // nova emissão. `expira_em` — e não `consumido_em`: ele não foi usado, e
      // registrar consumo seria afirmar um fato falso.
      await tx.$executeRaw`
        UPDATE segredo_recuperacao_senha
           SET expira_em = ${agora}::timestamptz
         WHERE usuario_id   = ${alvo.id}::uuid
           AND consumido_em IS NULL
           AND expira_em    > ${agora}::timestamptz
      `;

      // Só o HASH toca a persistência (TLF-BASE-V1 §10; `docs/07` §7.1).
      await tx.segredoRecuperacaoSenha.create({
        data: {
          usuarioId: alvo.id,
          hashSegredo,
          expiraEm,
          consumidoEm: null,
          criadoPorUsuarioId: comando.atorUsuarioId,
          criadoEm: agora,
        },
        select: { id: true },
      });

      // `docs/09` §5 / `D-AUD-01`: ator = Administrador, alvo = usuário,
      // contexto OMITIDO (whitelist vazia — `D-AUD-07`), sem justificativa.
      await this.auditWriter.registrar(tx, {
        acao: "usuario.senha.recuperacao_iniciada",
        ocorridoEm: agora,
        atorUsuarioId: comando.atorUsuarioId,
        alvoTipo: ALVO_USUARIO,
        alvoId: alvo.id,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      });

      return { desfecho: "EMITIDO" as const, segredo, expiraEm };
    });
  }

  /**
   * Conclusão (AUT-004, passos 4–7; T-07; `usuario.senha.recuperacao_concluida`).
   *
   * ORDEM VINCULANTE, e a razão de cada passo:
   *   1. rate limiter por IP ......... ANTES de tudo (`D-2.3D-06`): bloqueado
   *                                    => sem banco, sem Argon2, sem evento;
   *   2. forma do segredo ............ malformado é tentativa inválida;
   *   3. localização pelo hash + verificação de tempo constante + aptidão
   *      (pendente, não expirado, conta ativa) — leitura curta e própria;
   *   4. Argon2 da nova senha ........ FORA da transação (dezenas de ms;
   *                                    prender a conexão seria desperdício);
   *   5. transação T-07 .............. lock da linha de `usuario` + consumo
   *                                    condicional + senha + revogação +
   *                                    evento, tudo ou nada.
   *
   * O lock de `usuario` abre a T-07 por disciplina de ORDEM (cabeçalho): é a
   * mesma primeira aquisição de `iniciar`, e é o que elimina o deadlock entre
   * início e conclusão concorrentes para o mesmo usuário.
   *
   * O segredo inválido NÃO paga Argon2 — deliberado: a operação cara só
   * acontece para quem já provou posse de um segredo apto, o que fecha o
   * vetor de esgotamento de memória sem criar oráculo útil (a diferença de
   * tempo só é observável por quem já detém o segredo).
   */
  async concluir(comando: ComandoConcluirRecuperacao): Promise<ResultadoConcluirRecuperacao> {
    // 1. Gate — síncrono; a tentativa admitida já está contabilizada.
    const veredicto = this.limitador.tentar(comando.ip);
    if (veredicto.bloqueado) {
      return { desfecho: "BLOQUEADO", retryAfterSegundos: veredicto.retryAfterSegundos };
    }

    // 2. Forma.
    if (!ehSegredoRecuperacaoBemFormado(comando.segredo)) {
      return { desfecho: "RECUPERACAO_INVALIDA" };
    }
    const hashSegredo = calcularHashSegredoRecuperacao(comando.segredo);

    // 3. Localização e aptidão — transação CURTA e própria.
    const candidato = await this.database.transacao(async (tx) =>
      tx.segredoRecuperacaoSenha.findFirst({
        where: { hashSegredo },
        select: {
          id: true,
          usuarioId: true,
          hashSegredo: true,
          expiraEm: true,
          consumidoEm: true,
          usuario: { select: { ativo: true } },
        },
      }),
    );
    if (candidato === null) {
      // Mesma comparação de tempo constante que o caminho existente.
      hashSegredoRecuperacaoConfere(HASH_SINTETICO_DE_AUSENCIA, comando.segredo);
      return { desfecho: "RECUPERACAO_INVALIDA" };
    }
    if (!hashSegredoRecuperacaoConfere(candidato.hashSegredo, comando.segredo)) {
      return { desfecho: "RECUPERACAO_INVALIDA" };
    }
    const agoraVerificacao = this.relogio.agora();
    if (
      candidato.consumidoEm !== null ||
      candidato.expiraEm.getTime() <= agoraVerificacao.getTime() ||
      !candidato.usuario.ativo
    ) {
      return { desfecho: "RECUPERACAO_INVALIDA" };
    }

    // 4. Argon2id (`D-2.3D-02`) — fora da transação. Se falhar, nada abaixo
    //    executa: o segredo continua pendente e a senha antiga, intacta.
    const novoHash = await this.credenciais.gerarHash(comando.novaSenha);

    // 5. T-07 — atômico.
    const correlacaoId = randomUUID();
    try {
      await this.database.transacao(async (tx) => {
        const agora = this.relogio.agora();

        // LOCK DA LINHA DO USUÁRIO — PRIMEIRO, sempre. É o elo que fixa a
        // ordem única `usuario → segredo → sessões` compartilhada com
        // `iniciar` (ver ORDEM DE LOCKS no cabeçalho): sem ele, um início e
        // uma conclusão simultâneos para o mesmo usuário adquirem as duas
        // mesmas linhas em ordens opostas e fecham um ciclo de espera que o
        // PostgreSQL resolve abortando um dos lados com `40P01`.
        //
        // Não é uma leitura decisória: `ativo` continua sendo reavaliado pelo
        // `UPDATE` condicional abaixo. Linha ausente (usuário removido entre a
        // pré-verificação e aqui) colapsa no mesmo desfecho uniforme.
        const travados = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM usuario WHERE id = ${candidato.usuarioId}::uuid FOR UPDATE
        `;
        if (travados.length !== 1) throw new ErroSegredoSuperado();

        // CONSUMO CONDICIONAL: o predicado inteiro é avaliado pelo PostgreSQL
        // sob o lock da linha. `count !== 1` significa que outra conclusão,
        // ou um novo início, chegou antes — replay/duplicidade impossíveis.
        const consumidos = await tx.$executeRaw`
          UPDATE segredo_recuperacao_senha
             SET consumido_em = ${agora}::timestamptz
           WHERE id           = ${candidato.id}::uuid
             AND consumido_em IS NULL
             AND expira_em    > ${agora}::timestamptz
        `;
        if (consumidos !== 1) throw new ErroSegredoSuperado();

        // Nova senha, só para conta ATIVA — reavaliado dentro da transação.
        const atualizados = await tx.usuario.updateMany({
          where: { id: candidato.usuarioId, ativo: true },
          data: { senhaHash: novoHash },
        });
        if (atualizados.count !== 1) throw new ErroSegredoSuperado();

        // RN-005 / T-07: sessões anteriores deixam de autorizar operações.
        await this.sessoes.revogarTodasDoUsuarioEm(tx, candidato.usuarioId);

        // `docs/09` §5 / `D-AUD-01`: ator = o próprio usuário, alvo = usuário,
        // contexto OMITIDO — e nunca segredo, hash ou senha.
        await this.auditWriter.registrar(tx, {
          acao: "usuario.senha.recuperacao_concluida",
          ocorridoEm: agora,
          atorUsuarioId: candidato.usuarioId,
          alvoTipo: ALVO_USUARIO,
          alvoId: candidato.usuarioId,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId,
        });
      });
    } catch (erro) {
      if (!(erro instanceof ErroSegredoSuperado)) throw erro;
      // A transação já reverteu; o desfecho é o mesmo uniforme de qualquer
      // outra recusa — o cliente não aprende que houve concorrência.
      return { desfecho: "RECUPERACAO_INVALIDA" };
    }

    // `D-2.3D-08`: NENHUMA sessão é criada aqui.
    return { desfecho: "CONCLUIDA" };
  }
}
