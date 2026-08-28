// TechLab Fisio — primitivas do token de sessão (Etapa 2.3D-B / F2).
//
// Materializa a parte criptográfica de `D-2.3D-01` (`docs/12` §5.1): o token
// de sessão é conceitualmente `<sessao_id>.<segredo>`; o `sessao_id` NÃO é
// segredo; somente o **verificador SHA-256 do segredo** é persistido em
// `sessao_autenticacao.token_hash`. O segredo em claro nunca é persistido,
// registrado em log, ecoado em erro ou exposto separadamente ao consumidor.
//
// FUNÇÕES PURAS, SEM BANCO E SEM LOG: este arquivo não importa `@nestjs/*`
// nem o provider de persistência; nenhuma função aqui escreve em `console` ou
// coloca segredo/token/verificador em mensagem de exceção. Todas as falhas de
// forma são sinalizadas por `null` — fail-closed, sem exceção que carregue
// valor.
//
// SEM DEPENDÊNCIA EXTERNA: CSPRNG e SHA-256 vêm de `node:crypto`
// (TLF-BASE-V1 §14 — dependência nova exige justificativa; aqui não há
// nenhuma necessidade que a plataforma já não atenda).

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * DECISÃO LOCAL DE IMPLEMENTAÇÃO (não é norma permanente).
 *
 * `docs/12` §5.1 fixa a FORMA do token e o algoritmo do verificador, mas não
 * fixa tamanho nem codificação do segredo. Adotam-se **256 bits (32 bytes)**
 * de CSPRNG, alinhados ao único parâmetro de entropia já homologado no
 * projeto para um segredo de uso único (`D-2.3D-08`, segredo de recuperação
 * de senha — `docs/12` §5.8). 256 bits tornam a busca exaustiva inviável e
 * saturam a saída de 256 bits do SHA-256: aumentar o segredo não aumentaria a
 * força do verificador.
 *
 * Alterar este valor é decisão de implementação, não reabertura de decisão
 * homologada.
 */
const BYTES_DO_SEGREDO = 32;

/**
 * DECISÃO LOCAL: `base64url` (RFC 4648 §5) — 43 caracteres sem preenchimento
 * para 32 bytes. Escolhida por ser a codificação mais simples que é
 * simultaneamente segura para cookie e URL (alfabeto `A-Za-z0-9-_`, sem `=`,
 * sem `+`, sem `/`) e que NÃO contém o separador `.`, o que torna a
 * decomposição do token não-ambígua por construção.
 */
const COMPRIMENTO_DO_SEGREDO = 43;

/** Separador do token composto. Ausente do UUID e do alfabeto base64url. */
const SEPARADOR = ".";

/** UUID canônico (a `sessao_autenticacao.id` é UUIDv7 — `@default(uuid(7))`). */
const PADRAO_SESSAO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const PADRAO_SEGREDO = new RegExp(`^[A-Za-z0-9_-]{${String(COMPRIMENTO_DO_SEGREDO)}}$`);

/** Bytes do digest SHA-256 — usado para dimensionar a comparação de tempo constante. */
const BYTES_DO_VERIFICADOR = 32;

/** Partes do token composto, já validadas quanto à FORMA (não quanto à posse). */
export interface TokenSessaoDecomposto {
  /** Identificador da sessão — NÃO é segredo (`docs/12` §5.1, A-02). */
  readonly sessaoId: string;
  /** Segredo em claro — vive apenas em memória, pelo tempo da verificação. */
  readonly segredo: string;
}

/** Gera um segredo de sessão novo com CSPRNG do runtime. */
export function gerarSegredoSessao(): string {
  return randomBytes(BYTES_DO_SEGREDO).toString("base64url");
}

/** Compõe o token entregue ao consumidor: `<sessao_id>.<segredo>`. */
export function comporTokenSessao(sessaoId: string, segredo: string): string {
  return `${sessaoId}${SEPARADOR}${segredo}`;
}

/**
 * Decompõe e valida a FORMA do token. FAIL-CLOSED: qualquer entrada que não
 * seja exatamente `<uuid>.<43 caracteres base64url>` devolve `null` — token
 * vazio, sem separador, com separador extra, com `sessao_id` não-UUID, com
 * segredo de tamanho ou alfabeto errado, ou de tipo diferente de `string`.
 *
 * A validação do `sessao_id` como UUID não é cosmética: ela impede que um
 * identificador arbitrário chegue ao `WHERE id = $1::uuid` e produza um erro
 * de conversão do PostgreSQL em vez de uma rejeição limpa da aplicação.
 */
export function decomporTokenSessao(token: unknown): TokenSessaoDecomposto | null {
  if (typeof token !== "string") return null;
  const partes = token.split(SEPARADOR);
  if (partes.length !== 2) return null;
  const [sessaoId, segredo] = partes as [string, string];
  if (!PADRAO_SESSAO_ID.test(sessaoId)) return null;
  if (!PADRAO_SEGREDO.test(segredo)) return null;
  return { sessaoId, segredo };
}

/**
 * Verificador persistido em `token_hash`: SHA-256 do segredo, em hexadecimal.
 *
 * SHA-256 puro — e NÃO Argon2 — é o correto e é o que `D-2.3D-01` decide: o
 * segredo tem 256 bits de entropia uniforme de CSPRNG, não é escolhido por
 * humano e não admite ataque de dicionário; a função lenta existe para
 * compensar entropia baixa, que aqui não existe. O `sessao_id` NÃO entra no
 * digest: a norma manda persistir o verificador **do segredo**.
 */
export function calcularVerificadorSessao(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

/**
 * Compara, em TEMPO CONSTANTE, o verificador persistido com o verificador
 * recalculado a partir do segredo oferecido.
 *
 * Nenhum `===` sobre o verificador participa da decisão. Um `token_hash`
 * corrompido ou de tamanho inesperado é fail-closed (`false`) e ainda assim
 * paga a mesma comparação, para não criar atalho mensurável.
 */
export function verificadorConfere(
  verificadorPersistido: string,
  segredo: string,
): boolean {
  const calculado = Buffer.from(calcularVerificadorSessao(segredo), "hex");
  const persistido = Buffer.from(verificadorPersistido, "hex");
  if (persistido.length !== BYTES_DO_VERIFICADOR) {
    // Trabalho equivalente ao do caminho normal; resultado sempre negativo.
    timingSafeEqual(calculado, calculado);
    return false;
  }
  return timingSafeEqual(persistido, calculado);
}

/**
 * Verificador sintético usado no caminho de sessão INEXISTENTE, para que a
 * ausência de linha percorra a mesma comparação de tempo constante que uma
 * sessão existente com segredo errado.
 *
 * NÃO É SEGREDO: é o digest de uma constante pública e nenhuma sessão real
 * pode tê-lo como `token_hash` — nenhum segredo de 43 caracteres base64url é
 * igual a esta cadeia. Conhecê-lo não autentica ninguém.
 */
export const VERIFICADOR_SINTETICO_DE_AUSENCIA = calcularVerificadorSessao(
  "sessao-inexistente-verificador-sintetico",
);
