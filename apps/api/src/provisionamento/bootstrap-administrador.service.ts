// TechLab Fisio — bootstrap manual e idempotente do primeiro Administrador
// (Etapa 2.3D-B / F5; `D-2.3D-10`, `docs/12` §5.10).
//
// `D-2.3D-10`, literal e integral:
//   - bootstrap MANUAL;
//   - bootstrap IDEMPOTENTE;
//   - credencial recebida por ambiente/stdin ou mecanismo seguro equivalente;
//   - segredo NUNCA versionado (TLF-BASE-V1 §14);
//   - a atribuição do papel Administrador é auditada com
//     `usuario.papeis.alterados` — ação JÁ pertencente ao catálogo homologado
//     (`docs/09` §12.2);
//   - NÃO se cria silenciosamente uma ação `usuario.criado` (`P-2.3D-05`).
//
// ---------------------------------------------------------------------------
// CORREÇÃO CENTRAL DESTA RODADA — serialização (`F5-R-01`)
// ---------------------------------------------------------------------------
// As duas revisões independentes reproduziram, em processos CLI reais contra
// PostgreSQL real, DOIS "primeiros Administradores" criados simultaneamente,
// ambos com saída 0. A verificação era TOCTOU: um `SELECT` puro seguido de
// decisão em memória, sob `READ COMMITTED`.
//
// Agora a transação adquire o advisory lock do provisionamento ANTES de
// qualquer leitura decisória, e TODAS as leituras que sustentam a decisão
// acontecem depois dele. Duas execuções concorrentes serializam:
//   - identidades DIFERENTES ...... a segunda relê, vê o Administrador já
//                                   commitado e recusa `ADMINISTRADOR_JA_EXISTE`;
//   - MESMA identidade ............ a segunda relê, vê que já é Administrador
//                                   e devolve `JA_CONFORME` — sem `P2002`.
// Tratar `P2002` jamais resolveria o caso perigoso: a PK de `usuario_papel` é
// `(usuario_id, papel_id)` e identidades diferentes NÃO colidem.
//
// O DIGEST ARGON2 É CALCULADO FORA DA TRANSAÇÃO, antes do lock. Argon2id sob
// `D-2.3D-02` custa dezenas de milissegundos; mantê-lo dentro da seção crítica
// multiplicaria o tempo de retenção do lock e o de uma transação aberta. O
// preço é calcular, em alguns caminhos, um hash que não será usado — custo
// aceito e deliberado. O que NÃO é aceitável, e não acontece, é reabrir a
// janela TOCTOU: a decisão continua inteiramente depois do lock.
//
// ---------------------------------------------------------------------------
// MANUAL — o que isso significa, mecanicamente
// ---------------------------------------------------------------------------
//   - NÃO existe endpoint, rota, controller ou DTO HTTP para esta operação;
//   - `BootstrapModule` NÃO é importado pelo `AppModule`: o processo normal da
//     API não resolve este serviço e não pode executá-lo;
//   - o único acionador é `provisionamento/cli.ts`, executado deliberadamente.
//
// SEGREDO — garantias: a senha em claro é convertida em digest pelo
// `CredencialService` da F1 (política de `D-2.3D-02` NÃO reimplementada aqui)
// e nunca é persistida, registrada ou ecoada. Nenhuma função deste arquivo
// escreve em `console`. Erros são identificados por `motivo` de conjunto
// fechado — nenhuma mensagem carrega e-mail, nome, senha, digest ou
// justificativa.
//
// FAIL-CLOSED: outro Administrador existente, alvo inativo ou papel ausente
// recusam a operação. Nenhum caminho aumenta privilégio em silêncio.
//
// ATOMICIDADE: lock, leituras, criação/obtenção do usuário, vínculo e evento
// em UMA transação. Falha da auditoria faz rollback da atribuição.
//
// O QUE ESTE SERVIÇO NÃO FAZ: não cria sessão, não emite cookie/token/segredo
// de recuperação, não ativa nem inativa usuário (AUT-005 permanece fora), não
// altera identidade preexistente e não concede permissão avulsa.

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AuditWriter } from "../audit/audit-writer.js";
import { CredencialService } from "../auth/credencial.service.js";
import { normalizarIdentificadorLogin } from "../auth/identificador-login.js";
import { DatabaseService } from "../database/database.service.js";
import { bloquearProvisionamento } from "./bloqueio-provisionamento.js";
import { CODIGO_PAPEL_ADMINISTRADOR } from "./catalogo-rbac.js";

/** `alvo_tipo` do evento — `D-AUD-03`: nome físico da tabela do alvo. */
const ALVO_USUARIO = "usuario";

export type MotivoFalhaBootstrapAdministrador =
  /** O seed não rodou: `papel` com código `ADMINISTRADOR` não existe. */
  | "PAPEL_ADMINISTRADOR_AUSENTE"
  /** Já existe OUTRO usuário com o papel Administrador — fail-closed. */
  | "ADMINISTRADOR_JA_EXISTE"
  /** A identidade informada existe e está INATIVA. */
  | "USUARIO_ALVO_INATIVO"
  /** E-mail ausente, vazio ou de tipo inválido. */
  | "EMAIL_INVALIDO"
  /** Nome ausente, vazio ou de tipo inválido. */
  | "NOME_INVALIDO"
  /** Senha ausente, vazia ou de tipo inválido. */
  | "SENHA_AUSENTE"
  /** Justificativa operacional ausente, vazia ou de tipo inválido. */
  | "JUSTIFICATIVA_AUSENTE"
  /** Justificativa com caractere de controle (CR, LF, NUL, ...). */
  | "JUSTIFICATIVA_INVALIDA";

/**
 * Falha do bootstrap identificada por motivo de conjunto fechado.
 *
 * A mensagem é derivada EXCLUSIVAMENTE do motivo — jamais do e-mail, do nome,
 * da senha, do digest ou da justificativa.
 */
export class ErroBootstrapAdministrador extends Error {
  override readonly name = "ErroBootstrapAdministrador";

  constructor(readonly motivo: MotivoFalhaBootstrapAdministrador) {
    super(`Bootstrap do primeiro Administrador recusado: ${motivo}.`);
  }
}

export interface ComandoBootstrapAdministrador {
  /** Identificador de acesso; normalizado por `D-2.3D-03` antes de qualquer uso. */
  readonly email: string;
  readonly nome: string;
  /** Senha em claro — convertida em digest Argon2id e jamais persistida assim. */
  readonly senha: string;
  /**
   * Justificativa OPERACIONAL da execução (`F5-R-03`). Persistida em
   * `evento_auditoria.justificativa`, que `docs/07` §22.3 prevê como coluna
   * livre e que NÃO pertence ao mecanismo de whitelist de `contexto`
   * (`D-AUD-07`). Restaura rastreabilidade sem inventar ator sintético e sem
   * ampliar catálogo ou whitelist de auditoria.
   */
  readonly justificativa: string;
}

export type DesfechoBootstrapAdministrador =
  /** Usuário inexistente: criado, papel atribuído, evento emitido. */
  | "USUARIO_CRIADO"
  /** Usuário já existia sem o papel: papel atribuído, evento emitido. */
  | "PAPEL_ATRIBUIDO"
  /** Nada a fazer: a identidade já é o Administrador. Zero escrita. */
  | "JA_CONFORME";

export interface ResultadoBootstrapAdministrador {
  readonly desfecho: DesfechoBootstrapAdministrador;
  readonly usuarioId: string;
  /** Correlação do evento emitido; `null` quando nada foi escrito. */
  readonly correlacaoId: string | null;
}

/** Qualquer caractere de controle C0/C1 — inclui NUL, CR e LF. */
const CONTROLE = /[\u0000-\u001F\u007F-\u009F]/;

function exigirTextoNaoVazio(
  valor: unknown,
  motivo: MotivoFalhaBootstrapAdministrador,
): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroBootstrapAdministrador(motivo);
  }
  return valor;
}

@Injectable()
export class BootstrapAdministradorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credenciais: CredencialService,
    private readonly auditWriter: AuditWriter,
  ) {}

  /**
   * Executa o bootstrap. Idempotente e serializado:
   *
   *   banco vazio ................. cria o usuário, atribui o papel, audita;
   *   segunda execução idêntica ... `JA_CONFORME`, zero INSERT, zero evento;
   *   usuário sem o papel ......... atribui o papel e audita (convergência);
   *   outro Administrador existe .. `ADMINISTRADOR_JA_EXISTE` (recusa);
   *   usuário alvo inativo ........ `USUARIO_ALVO_INATIVO` (recusa);
   *   papel inexistente ........... `PAPEL_ADMINISTRADOR_AUSENTE` (recusa);
   *   execuções concorrentes ...... serializam pelo advisory lock.
   */
  async executar(
    comando: ComandoBootstrapAdministrador,
  ): Promise<ResultadoBootstrapAdministrador> {
    // Validação de forma ANTES de qualquer trabalho caro, de qualquer consulta
    // e de abrir a transação: entrada malformada não paga Argon2 nem banco.
    const emailBruto = exigirTextoNaoVazio(comando.email, "EMAIL_INVALIDO");
    const nome = exigirTextoNaoVazio(comando.nome, "NOME_INVALIDO").trim();
    exigirTextoNaoVazio(comando.senha, "SENHA_AUSENTE");
    const justificativa = exigirTextoNaoVazio(
      comando.justificativa,
      "JUSTIFICATIVA_AUSENTE",
    ).trim();
    if (CONTROLE.test(justificativa)) {
      throw new ErroBootstrapAdministrador("JUSTIFICATIVA_INVALIDA");
    }

    // `D-2.3D-03`: a mesma normalização usada pelo login — sem ela, o
    // bootstrap poderia criar identidade inalcançável pela autenticação.
    const email = normalizarIdentificadorLogin(emailBruto);

    // DIGEST FORA DA TRANSAÇÃO E FORA DA SEÇÃO CRÍTICA (ver cabeçalho). Em
    // caminhos que não criam usuário este valor é descartado — custo aceito.
    const senhaHash = await this.credenciais.gerarHash(comando.senha);

    // Uma correlação por OPERAÇÃO (precedente de `ProfissionalService`).
    const correlacaoId = randomUUID();

    return this.database.transacao(async (tx) => {
      // SERIALIZAÇÃO — a PRIMEIRA operação da transação. Tudo que decide vem
      // depois desta linha.
      await bloquearProvisionamento(tx);

      const papel = await tx.papel.findUnique({
        where: { codigo: CODIGO_PAPEL_ADMINISTRADOR },
        select: { id: true },
      });
      if (papel === null) {
        throw new ErroBootstrapAdministrador("PAPEL_ADMINISTRADOR_AUSENTE");
      }

      // Releituras SOB O LOCK — este é o estado autoritativo da decisão.
      const usuario = await tx.usuario.findUnique({
        where: { email },
        select: { id: true, ativo: true },
      });

      const administradores = await tx.usuarioPapel.findMany({
        where: { papelId: papel.id },
        select: { usuarioId: true },
      });

      const jaEhAdministrador =
        usuario !== null &&
        administradores.some((vinculo) => vinculo.usuarioId === usuario.id);

      // FAIL-CLOSED: qualquer Administrador que não seja a identidade
      // informada bloqueia a operação.
      const existeOutroAdministrador = administradores.some(
        (vinculo) => vinculo.usuarioId !== usuario?.id,
      );
      if (existeOutroAdministrador) {
        throw new ErroBootstrapAdministrador("ADMINISTRADOR_JA_EXISTE");
      }

      if (jaEhAdministrador) {
        // Segunda execução com a mesma identidade: nada é criado, nada é
        // atualizado e NENHUM evento é emitido — um segundo evento afirmaria
        // uma alteração de papéis que não ocorreu.
        return {
          desfecho: "JA_CONFORME" as const,
          usuarioId: usuario.id,
          correlacaoId: null,
        };
      }

      if (usuario !== null && !usuario.ativo) {
        throw new ErroBootstrapAdministrador("USUARIO_ALVO_INATIVO");
      }

      const ocorridoEm = new Date();

      let usuarioId: string;
      let desfecho: DesfechoBootstrapAdministrador;
      if (usuario === null) {
        // A senha em claro nunca toca a persistência: só `senhaHash` é
        // escrito (AUT-001; TLF-BASE-V1 §10).
        const criado = await tx.usuario.create({
          data: { email, nome, senhaHash, ativo: true },
          select: { id: true },
        });
        usuarioId = criado.id;
        desfecho = "USUARIO_CRIADO";
      } else {
        // Identidade PREEXISTENTE: nada dela é alterado — nem senha, nem
        // nome, nem situação. A operação se limita a atribuir o papel.
        usuarioId = usuario.id;
        desfecho = "PAPEL_ATRIBUIDO";
      }

      await tx.usuarioPapel.create({ data: { usuarioId, papelId: papel.id } });

      // `D-2.3D-10` — a atribuição do papel Administrador é auditada.
      //
      //   acao            = usuario.papeis.alterados   (catálogo D-AUD-01)
      //   resultado       = SUCESSO                    (catálogo D-AUD-02)
      //   alvo_tipo       = "usuario"                  (D-AUD-03: nome físico)
      //   alvo_id         = usuario.id                 (o alvo é quem mudou)
      //   justificativa   = a operacional informada    (ver abaixo)
      //   contexto        = {} (OMITIDO)               (whitelist VAZIA)
      //   ator_usuario_id = NULL                       (ação de sistema)
      //
      // `contexto` é OMITIDO em vez de enviado como `{}`: o validator trata
      // ausente e vazio identicamente e a coluna fica `NULL`. Mesmo precedente
      // de `usuario.autenticacao` (`D-2.3D-12`), do logout e de
      // `profissional.situacao.alterada`. NENHUMA chave é introduzida —
      // `papeis_anteriores`/`papeis_novos` seguem NÃO homologadas
      // (`docs/09` §12.6) e a whitelist NÃO é ampliada.
      //
      // AUTORIA — `ator_usuario_id = NULL` (`D-2.3D-15`; `L-F5-08` permanece
      // alias histórico em `docs/10`). `docs/07` §22.3 admite `NULL` em ação de
      // sistema; a revisão independente observou, com razão, que um bootstrap
      // MANUAL tem autor humano e que TLF-BASE-V1 §4.3 exige atribuibilidade.
      // A decisão homologada NÃO inventa um ator nem responsabiliza o
      // usuário recém-criado pela própria elevação — foi tornar OBRIGATÓRIA a
      // `justificativa` operacional, coluna que as fontes já preveem e que
      // fica fora do mecanismo de whitelist. A trilha passa a conter o motivo
      // declarado da execução, além de alvo, correlação e instante.
      await this.auditWriter.registrar(tx, {
        acao: "usuario.papeis.alterados",
        ocorridoEm,
        atorUsuarioId: null,
        alvoTipo: ALVO_USUARIO,
        alvoId: usuarioId,
        resultado: "SUCESSO",
        justificativa,
        correlacaoId,
      });

      return { desfecho, usuarioId, correlacaoId };
    });
  }
}
