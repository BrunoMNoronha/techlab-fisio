// TechLab Fisio — fronteira interna de credenciais (Etapa 2.3D-B / F1).
//
// Materializa `D-2.3D-02` (`docs/12` §5.2): Argon2id, `argon2@0.45.1`,
// `memoryCost = 19456 KiB`, `timeCost = 2`, `parallelism = 1`, saída PHC,
// rehash por defasagem de parâmetros e caminho dummy para conta inexistente.
// Requisitos: AUT-001 ("senha não é armazenada nem registrada em claro"; "erros
// não devem facilitar enumeração"); TLF-BASE-V1 §10.
//
// FATIA TÉCNICA INTERNA: NÃO existe controller, endpoint, rota, DTO HTTP,
// cookie, sessão, guard, RBAC ou auditoria aqui. Este serviço NÃO consulta o
// banco — ele recebe o hash persistido de quem já o tem. A busca do usuário, a
// emissão de sessão e o evento `usuario.autenticacao` pertencem a F2/F3.
//
// SEGREDOS NUNCA VAZAM: nenhuma função deste arquivo registra log, e nenhuma
// mensagem de erro carrega senha, hash, salt ou qualquer derivação deles. Os
// erros são identificados por um `motivo` de um conjunto fechado — mesmo padrão
// já usado em `ErroContextoAuditoria`, `ErroDescontoCobranca` e
// `ErroSituacaoProfissional`.

import { Injectable, type OnModuleInit } from "@nestjs/common";

import { argon2id, hash, needsRehash, verify } from "argon2";

/**
 * Política de hashing homologada em `D-2.3D-02`. Os quatro valores são
 * passados EXPLICITAMENTE em toda operação: os defaults de `argon2@0.45.1` são
 * outros (`type=argon2id`, `m=65536`, `t=3`, `p=4`) e depender deles faria a
 * política homologada mudar silenciosamente numa atualização do pacote.
 *
 * `P-2.3D-02` (benchmark empírico) mede estes parâmetros; alterá-los exige
 * decisão expressa — este objeto não é configurável por ambiente de propósito.
 */
export const POLITICA_ARGON2 = Object.freeze({
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

/**
 * Prefixo PHC exigido pela política vigente. A variante é verificada por este
 * prefixo porque `needsRehash` de `argon2@0.45.1` compara SOMENTE
 * `memoryCost`, `timeCost`, `parallelism` e `version` — comportamento MEDIDO
 * nesta fatia: um digest `$argon2i$` com `m`/`t`/`p` iguais aos vigentes é
 * reportado como "não precisa rehash". Sem esta verificação, um hash de
 * variante não homologada seria tratado como plenamente atual.
 *
 * Comparação de prefixo é deliberadamente a solução mais simples que resolve o
 * problema: nenhum parser PHC artesanal é introduzido.
 */
const PREFIXO_PHC_VIGENTE = `$argon2id$`;

/**
 * Senha sintética do hash dummy (§5.4 do enunciado da F1 / `D-2.3D-02`).
 *
 * NÃO É SEGREDO e não precisa ser: seu único papel é existir um digest válido
 * contra o qual o caminho de conta inexistente possa executar um `verify`
 * Argon2 real, de custo equivalente ao do caminho de conta existente. Nenhum
 * usuário possui esta senha, e conhecê-la não autentica ninguém — o caminho
 * dummy retorna `false` incondicionalmente (ver `verificarComCaminhoDummy`).
 */
const SENHA_DO_HASH_DUMMY = "credencial-dummy-sintetica-sem-usuario-real";

export type MotivoFalhaCredencial =
  /** A senha oferecida não é utilizável como entrada de hashing. */
  | "SENHA_INVALIDA";

/**
 * Falha de credencial identificada por motivo de conjunto fechado.
 *
 * A mensagem é derivada EXCLUSIVAMENTE do motivo — nunca da senha, do hash ou
 * de qualquer valor recebido (AUD-002/006, RN-062/063, TLF-BASE-V1 §10).
 */
export class ErroCredencial extends Error {
  override readonly name = "ErroCredencial";

  constructor(readonly motivo: MotivoFalhaCredencial) {
    super(`Credencial rejeitada: ${motivo}.`);
  }
}

@Injectable()
export class CredencialService implements OnModuleInit {
  /**
   * Hash dummy memoizado como PROMISE (não como string): a memoização da
   * própria promessa garante que chamadas concorrentes durante a inicialização
   * compartilhem UM único `hash()` — nunca um `hash()` caro por tentativa de
   * login, que é justamente o custo que `D-2.3D-02` quer evitar.
   */
  #hashDummy: Promise<string> | null = null;

  /**
   * Aquecimento explícito no bootstrap (`OnModuleInit`).
   *
   * Garante que o digest dummy exista ANTES do primeiro caminho de
   * autenticação que venha a usá-lo, em vez de pagar a primeira geração dentro
   * de uma tentativa de login — o que produziria exatamente a assimetria de
   * tempo que o caminho dummy existe para eliminar. Também aquece o addon
   * nativo do `argon2` (primeira chamada carrega o binding).
   */
  async onModuleInit(): Promise<void> {
    await this.#obterHashDummy();
  }

  /** Gera o digest PHC Argon2id da senha, sob a política homologada. */
  async gerarHash(senha: string): Promise<string> {
    if (typeof senha !== "string" || senha.length === 0) {
      throw new ErroCredencial("SENHA_INVALIDA");
    }
    return hash(senha, POLITICA_ARGON2);
  }

  /**
   * Verifica a senha contra um digest PHC persistido.
   *
   * FAIL-CLOSED: a comparação criptográfica é inteiramente delegada ao Argon2 —
   * nenhuma comparação de string (`===`) participa da decisão. Qualquer digest
   * malformado, truncado ou de outro algoritmo faz `verify` lançar ou devolver
   * `false`; ambos os casos resultam em `false` aqui. Corrupção de credencial
   * NUNCA vira autenticação positiva, e a exceção original — que pode conter o
   * digest — é deliberadamente descartada em vez de propagada ou registrada.
   *
   * (Comportamento MEDIDO em `argon2@0.45.1`: digest vazio, sem `$` inicial ou
   * sem o campo de hash lançam `TypeError`; `"$scrypt$x"` devolve `false`.)
   */
  async verificarSenha(hashPersistido: string, senha: string): Promise<boolean> {
    try {
      return await verify(hashPersistido, senha);
    } catch {
      return false;
    }
  }

  /**
   * Primitiva do caminho dummy — a forma que F2/F3 devem usar no login.
   *
   * `hashPersistido` presente  -> `verify(hashPersistido, senha)`;
   * `hashPersistido` ausente   -> `verify(hashDummy, senha)` e resultado
   *                               OBRIGATORIAMENTE `false`.
   *
   * O `verify` do caminho ausente é real e não é descartável: ele existe para
   * que conta inexistente e senha incorreta de conta existente percorram o
   * mesmo trabalho criptográfico, removendo a diferença estrutural de
   * processamento que permitiria enumerar contas (AUT-001; `D-2.3D-12`,
   * `docs/12` §5.12).
   *
   * O resultado do caminho ausente é forçado a `false` — e não simplesmente
   * devolvido — para que nem mesmo conhecer a senha sintética do dummy possa
   * autenticar alguém.
   */
  async verificarComCaminhoDummy(
    hashPersistido: string | null | undefined,
    senha: string,
  ): Promise<boolean> {
    if (hashPersistido === null || hashPersistido === undefined || hashPersistido === "") {
      const dummy = await this.#obterHashDummy();
      await this.verificarSenha(dummy, senha);
      return false;
    }
    return this.verificarSenha(hashPersistido, senha);
  }

  /**
   * Informa se o digest persistido está defasado da política vigente.
   *
   * Cobre DUAS defasagens, e a segunda não é coberta pela biblioteca:
   *   1. parâmetros (`m`/`t`/`p`/`version`) — via `needsRehash` nativo;
   *   2. VARIANTE — via prefixo PHC, porque `needsRehash` de `argon2@0.45.1`
   *      ignora a variante (medido nesta fatia).
   *
   * Fail-closed: digest malformado (que faz `needsRehash` lançar) é tratado
   * como precisando de rehash — nunca como vigente.
   *
   * Esta operação apenas DECIDE. Ela não regenera nada: o serviço não possui a
   * senha em claro. Quem decide persistir o novo hash é o fluxo de login da F2,
   * e somente após uma autenticação válida, quando a senha em claro está
   * legitimamente em mãos.
   */
  precisaRehash(hashPersistido: string): boolean {
    if (!hashPersistido.startsWith(PREFIXO_PHC_VIGENTE)) return true;
    try {
      return needsRehash(hashPersistido, POLITICA_ARGON2);
    } catch {
      return true;
    }
  }

  /** Digest dummy vigente — exposto para prova em teste, não para uso no login. */
  async obterHashDummyParaProva(): Promise<string> {
    return this.#obterHashDummy();
  }

  #obterHashDummy(): Promise<string> {
    this.#hashDummy ??= hash(SENHA_DO_HASH_DUMMY, POLITICA_ARGON2);
    return this.#hashDummy;
  }
}
