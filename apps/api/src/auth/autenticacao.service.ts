// TechLab Fisio — orquestração de login e logout (Etapa 2.3D-B / F3).
//
// Materializa `D-2.3D-06` (ordem do rate limit), `D-2.3D-12` (auditoria da
// falha de autenticação) e a auditoria de FC-01 (`docs/05` §4 — "login
// bem-sucedido", "falhas relevantes", "logout"), consumindo — sem duplicar —
// o `CredencialService` da F1 e o `SessaoService` da F2.
//
// ESTE SERVIÇO NÃO REIMPLEMENTA NADA DAS FATIAS ANTERIORES: não sabe o que é
// Argon2, não conhece a política temporal da sessão, não sabe compor, hashear
// ou decompor token e não escreve em `sessao_autenticacao`. Ele apenas ordena
// as fronteiras já homologadas e decide o que é auditável.
//
// ORDEM VINCULANTE DO LOGIN — e a razão de cada passo estar onde está:
//
//   1. o payload já foi validado pela fronteira HTTP (o serviço recebe valores
//      bem-formados) ............ payload rejeitado NÃO chega aqui e, portanto,
//                                 NÃO produz evento (`D-2.3D-12`);
//   2. normalização `D-2.3D-03` .. o contador e a busca precisam da MESMA
//                                 chave; normalizar depois criaria duas;
//   3. CONSULTA ao rate limiter .. ANTES do Argon2 (`D-2.3D-06`, literal).
//                                 Bloqueado => `429` e RETORNO IMEDIATO: sem
//                                 `verify`, sem consulta de usuário e sem
//                                 evento de auditoria (`D-2.3D-12`);
//   4. busca do usuário .......... por identificador normalizado;
//   5. VERIFICAÇÃO com caminho
//      dummy da F1 ............... conta inexistente paga o mesmo Argon2 que
//                                 conta existente com senha errada;
//   6. exigência de conta ativa .. AUT-001 ("usuário inativo não cria sessão");
//   7. falha => contabiliza + audita `usuario.autenticacao`/`FALHA`;
//      sucesso => emite sessão e audita `usuario.autenticacao`/`SUCESSO`,
//      NA MESMA TRANSAÇÃO.
//
// SIMETRIA CONTRA ENUMERAÇÃO (`R-2.3D-05`, `T-AUTH-ENUMERATION`): os passos 4
// a 7 são estruturalmente IDÊNTICOS para conta existente e inexistente — a
// mesma consulta, o mesmo `verify` Argon2, o mesmo registro no limitador, o
// mesmo evento de auditoria com a mesma ação e o mesmo `resultado`, e o mesmo
// desfecho devolvido ao chamador. A ÚNICA diferença permitida é o `alvo_id`
// do evento — que `D-2.3D-12` determina expressamente e que não é observável
// pelo cliente.
//
// SEGREDOS NUNCA VAZAM: nenhuma função deste arquivo escreve em `console`;
// nenhum valor de retorno, mensagem de erro ou evento de auditoria carrega
// identificador tentado, senha, hash, token, segredo ou cookie
// (`D-2.3D-12`; `D-AUD-07`/F-04; TLF-BASE-V1 §10).

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { DatabaseService } from "../database/database.service.js";
import { CredencialService } from "./credencial.service.js";
import { normalizarIdentificadorLogin } from "./identificador-login.js";
import { LimitadorLogin } from "./limitador-login.js";
import type { ReservaTentativa } from "./limitador-login.js";
import { SessaoService } from "./sessao.service.js";
import type { SessaoEmitida } from "./sessao.service.js";

/**
 * Sentinela INTERNA: o digest verificado deixou de ser o corrente entre a
 * leitura e a escrita do rehash. Nunca escapa deste arquivo e nunca chega ao
 * cliente — e convertida no `401` uniforme.
 */
class ErroCredencialSuperada extends Error {
  override readonly name = "ErroCredencialSuperada";
}

/** `alvo_tipo` das ações de autenticação — `D-AUD-03`: nome físico da tabela. */
const ALVO_USUARIO = "usuario";
const ALVO_SESSAO = "sessao_autenticacao";

export interface ComandoLogin {
  readonly identificador: string;
  readonly senha: string;
  /** Origem da requisição, para a dimensão de IP de `D-2.3D-06`. */
  readonly ip: string;
}

export type ResultadoLogin =
  | {
      readonly desfecho: "AUTENTICADO";
      readonly usuarioId: string;
      /** Token `<sessao_id>.<segredo>` — sai APENAS pelo cookie (`D-2.3D-07`). */
      readonly token: string;
      readonly expiraEm: Date;
    }
  /** Uniforme: conta inexistente, senha incorreta e conta inativa. */
  | { readonly desfecho: "CREDENCIAIS_INVALIDAS" }
  | { readonly desfecho: "BLOQUEADO"; readonly retryAfterSegundos: number };

export type ResultadoLogout =
  | { readonly desfecho: "ENCERRADA"; readonly usuarioId: string }
  /** Uniforme: ausente, malformado, inexistente, expirada ou revogada. */
  | { readonly desfecho: "SESSAO_INVALIDA" };

@Injectable()
export class AutenticacaoService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credenciais: CredencialService,
    private readonly sessoes: SessaoService,
    private readonly limitador: LimitadorLogin,
    private readonly auditWriter: AuditWriter,
  ) {}

  async autenticar(comando: ComandoLogin): Promise<ResultadoLogin> {
    const identificador = normalizarIdentificadorLogin(comando.identificador);

    // `D-2.3D-06` — GATE COM RESERVA (correção `F-01`). A aquisição é
    // SÍNCRONA e acontece antes de qualquer `await`: ela decide sobre
    // `falhas_vivas + tentativas_em_voo` e reserva a vaga nas DUAS dimensões
    // de uma só vez. A versão anterior apenas CONSULTAVA aqui e só
    // contabilizava a falha ~40 ms depois; sob concorrência, todas as
    // requisições em voo atravessavam o gate (medido pela revisão
    // independente: 12 concorrentes contra o limite 5 produziram 12 execuções
    // de Argon2 e zero bloqueios).
    //
    // Nada abaixo desta linha é executado para uma tentativa bloqueada — nem
    // a consulta ao banco, nem o Argon2, nem o evento de auditoria
    // (`D-2.3D-12`, segunda exclusão expressa).
    const aquisicao = this.limitador.adquirir(identificador, comando.ip);
    if (!aquisicao.admitida) {
      return {
        desfecho: "BLOQUEADO",
        retryAfterSegundos: aquisicao.veredicto.retryAfterSegundos,
      };
    }
    const reserva = aquisicao.reserva;

    try {
      // A leitura vive numa transação CURTA e própria: manter a transação
      // aberta durante o `verify` Argon2 (dezenas de milissegundos, `docs/10`
      // §6-D.5) prenderia uma conexão do pool por tentativa.
      const usuario = await this.database.transacao(async (tx) =>
        tx.usuario.findUnique({
          where: { email: identificador },
          select: { id: true, senhaHash: true, ativo: true },
        }),
      );

      // Caminho dummy da F1: `null` => `verify` real contra o digest
      // sintético, resultado forçado a `false`. Conta inexistente e senha
      // errada custam o mesmo (`D-2.3D-02`; `R-2.3D-05`).
      const senhaConfere = await this.credenciais.verificarComCaminhoDummy(
        usuario?.senhaHash ?? null,
        comando.senha,
      );

      // A conta INATIVA percorre o Argon2 completo antes de ser recusada — de
      // propósito. Recusá-la antes do `verify` a tornaria distinguível por
      // tempo de uma conta ativa. AUT-001: "usuário inativo não cria sessão".
      if (usuario === null || !senhaConfere || !usuario.ativo) {
        return await this.#rejeitar(reserva, usuario?.id ?? null);
      }

      // `D-2.3D-02` — REHASH (correção `F-04`). A decisão homologada exige
      // rehash "quando os parâmetros persistidos estiverem defasados"; a F1
      // entregou apenas a DETECÇÃO (`precisaRehash`) e remeteu a persistência
      // ao fluxo de login, que é este. Não é decisão nova: é o cumprimento de
      // `D-2.3D-02`, e `docs/12` não foi alterado.
      //
      // O Argon2 do novo digest roda FORA da transação, deliberadamente:
      // ~40 ms de CPU dentro de uma transação prenderiam a conexão e o lock
      // da linha sem necessidade alguma.
      const hashVerificado = usuario.senhaHash;
      const novoHash = this.credenciais.precisaRehash(hashVerificado)
        ? await this.credenciais.gerarHash(comando.senha)
        : null;

      let emitida: SessaoEmitida;
      try {
        // Rehash + sessão + evento na MESMA transação (`D-AUD-08`): não existe
        // desfecho em que a sessão nasça sem seu evento, e um rollback desfaz
        // também o rehash — que é simplesmente refeito no próximo login.
        const correlacaoId = randomUUID();
        emitida = await this.database.transacao(async (tx) => {
          if (novoHash !== null) {
            // ESCRITA CONDICIONADA AO DIGEST EFETIVAMENTE VERIFICADO. Entre a
            // leitura e esta escrita a credencial pode ter mudado (troca de
            // senha, recuperação, ação administrativa). Sobrescrevê-la
            // ressuscitaria uma credencial já superada — o predicado do
            // `WHERE` é avaliado atomicamente pelo PostgreSQL sob o lock da
            // própria linha, e `count` diferente de 1 significa que o hash
            // mudou.
            const atualizadas = await tx.usuario.updateMany({
              where: { id: usuario.id, senhaHash: hashVerificado },
              data: { senhaHash: novoHash },
            });
            if (atualizadas.count !== 1) throw new ErroCredencialSuperada();
          }
          const sessao = await this.sessoes.emitirEm(tx, { usuarioId: usuario.id });
          await this.auditWriter.registrar(tx, {
            acao: "usuario.autenticacao",
            ocorridoEm: sessao.criadaEm,
            // Sucesso TEM ator conhecido — o próprio usuário (`docs/09` §5).
            atorUsuarioId: usuario.id,
            alvoTipo: ALVO_USUARIO,
            alvoId: usuario.id,
            resultado: "SUCESSO",
            justificativa: null,
            correlacaoId,
            // Sem `contexto`: whitelist VAZIA (`D-AUD-07`).
          });
          return sessao;
        });
      } catch (erro) {
        if (!(erro instanceof ErroCredencialSuperada)) throw erro;
        // A credencial verificada deixou de ser a corrente. A transação já
        // reverteu: nenhuma sessão, nenhum evento de sucesso e — o que mais
        // importa — a credencial NOVA permanece intacta. O desfecho é o mesmo
        // `401` uniforme de qualquer outra rejeição: o cliente não aprende que
        // houve concorrência, e nenhuma sessão nasce de credencial vencida.
        return await this.#rejeitar(reserva, usuario.id);
      }

      // Autenticou: a vaga em voo é devolvida SEM virar falha.
      reserva.liberar();
      return {
        desfecho: "AUTENTICADO",
        usuarioId: emitida.usuarioId,
        token: emitida.token,
        expiraEm: emitida.expiraEm,
      };
    } finally {
      // Idempotente: no-op se a reserva já virou falha ou já foi liberada.
      // Garante que NENHUMA reserva vaze, inclusive em erro técnico — caso em
      // que a vaga é devolvida sem contabilizar falha de credencial.
      reserva.liberar();
    }
  }

  /**
   * Desfecho ÚNICO de toda rejeição de autenticação: contabiliza a falha na
   * janela (`D-2.3D-06`), emite o evento de `D-2.3D-12` e devolve o `401`
   * uniforme. Centralizado para que nenhum caminho de rejeição possa divergir
   * dos outros — divergir é exatamente o que abriria o canal de enumeração.
   */
  async #rejeitar(
    reserva: ReservaTentativa,
    usuarioId: string | null,
  ): Promise<ResultadoLogin> {
    reserva.registrarFalha();
    await this.#auditarFalhaDeAutenticacao(usuarioId);
    return { desfecho: "CREDENCIAIS_INVALIDAS" };
  }

  /**
   * Logout (`AUT-002`, `D-2.3D-05`). A máquina de estados é inteiramente do
   * `SessaoService` — este método não repete predicado temporal, não escreve
   * estado e não decide terminalidade. Ele apenas encadeia revogação e
   * auditoria dentro de uma transação.
   *
   * `usuario.sessao.logout` só existe em SUCESSO (`docs/09` §5: "resultado
   * necessário? Não — só sucesso"). Uma tentativa de logout com sessão já
   * terminal não é evento novo: nada mudou, e registrar a tentativa
   * transformaria a auditoria num contador de ruído — além de ampliar, na
   * prática, o que a ação significa.
   */
  async encerrar(token: unknown): Promise<ResultadoLogout> {
    const correlacaoId = randomUUID();
    return this.database.transacao(async (tx) => {
      const resultado = await this.sessoes.revogarEm(tx, token);
      if (!resultado.revogada) {
        // Todos os motivos internos (`TOKEN_MALFORMADO`, `SESSAO_INEXISTENTE`,
        // `SEGREDO_INVALIDO`, `SESSAO_EXPIRADA`, `SESSAO_REVOGADA`) colapsam
        // aqui num único desfecho — ver a decisão local `A-05` no controller.
        // A transação ainda assim COMMITA: se `revogarEm` detectou expiração,
        // essa transição é verdadeira e deve persistir.
        return { desfecho: "SESSAO_INVALIDA" };
      }
      await this.auditWriter.registrar(tx, {
        acao: "usuario.sessao.logout",
        ocorridoEm: resultado.encerradaEm,
        atorUsuarioId: resultado.usuarioId,
        alvoTipo: ALVO_SESSAO,
        alvoId: resultado.sessaoId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      });
      return { desfecho: "ENCERRADA", usuarioId: resultado.usuarioId };
    });
  }

  /**
   * `D-2.3D-12`, literal (`docs/12` §5.12).
   *
   *   acao      = usuario.autenticacao
   *   resultado = FALHA
   *   ator_usuario_id = NULL                       (sempre — não há ator autenticado)
   *   alvo_id         = usuario.id | NULL          (existente | inexistente)
   *   contexto        = {}                         (whitelist vazia, D-AUD-07)
   *
   * O evento é emitido em transação PRÓPRIA porque não existe mutação de
   * negócio a que se acoplar: a tentativa falhou e nada foi escrito. É a única
   * forma possível aqui, e ela não enfraquece nenhuma garantia — não há o que
   * reverter em conjunto.
   *
   * `contexto` é OMITIDO em vez de enviado como `{}`: o validator trata
   * ausente e vazio identicamente (ambos passam a whitelist vazia), e a coluna
   * fica `NULL` — mesmo precedente já vigente em `profissional.situacao.alterada`
   * e no logout acima. Nenhuma chave é introduzida, que é o que `D-2.3D-12`
   * e `D-AUD-07` exigem.
   */
  async #auditarFalhaDeAutenticacao(usuarioId: string | null): Promise<void> {
    const correlacaoId = randomUUID();
    await this.database.transacao(async (tx) => {
      await this.auditWriter.registrar(tx, {
        acao: "usuario.autenticacao",
        ocorridoEm: new Date(),
        atorUsuarioId: null,
        alvoTipo: ALVO_USUARIO,
        alvoId: usuarioId,
        resultado: "FALHA",
        justificativa: null,
        correlacaoId,
      });
    });
  }
}
