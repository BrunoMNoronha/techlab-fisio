// TechLab Fisio — primitivas do segredo de recuperação de senha
// (Etapa 2.3D-B / F6; `D-2.3D-08`, `docs/12` §5.8; AUT-004; D-04).
//
// `D-2.3D-08`, literal: segredo com **256 bits** de entropia; persistência
// **somente do hash** em `segredo_recuperacao_senha.hash_segredo`. O hash é o
// SHA-256 do segredo — a MESMA disciplina que `docs/07` §7.1 e `D-2.3D-01`
// declaram compartilhada entre `sessao_autenticacao.token_hash` e
// `hash_segredo`: para um segredo de 256 bits uniformes de CSPRNG, uma função
// lenta (Argon2) não acrescenta segurança, e o hash determinístico é o que
// permite LOCALIZAR a linha pelo próprio segredo apresentado, sem persistir
// nem transmitir identificador algum ao lado dele.
//
// FUNÇÕES PURAS, SEM BANCO E SEM LOG: nada aqui importa `@nestjs/*` nem o
// provider de persistência; nenhuma função escreve em `console` ou coloca
// segredo/hash em mensagem de exceção. Falhas de forma são sinalizadas por
// `false`/`null`. CSPRNG e SHA-256 vêm de `node:crypto` — nenhuma dependência
// nova (TLF-BASE-V1 §14).
//
// DECISÕES LOCAIS DE IMPLEMENTAÇÃO (reversíveis; `D-2.3D-08` fixa a entropia e
// a persistência, não a codificação):
//   - codificação `base64url` (RFC 4648 §5): 43 caracteres para 32 bytes,
//     alfabeto `A-Za-z0-9-_`, sem preenchimento — mesma escolha já vigente
//     para o segredo de sessão (`token-sessao.ts`), segura para transcrição
//     manual e para trânsito em JSON;
//   - o segredo NÃO é composto com identificador (`<id>.<segredo>`): ele é
//     apresentado ao usuário por canal externo (AUT-004, passo 3) e um valor
//     único e curto é o que esse canal comporta. A localização é pelo hash.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 bits — `D-2.3D-08`. */
const BYTES_DO_SEGREDO = 32;

/** 32 bytes em base64url sem preenchimento. */
const COMPRIMENTO_DO_SEGREDO = 43;

const PADRAO_SEGREDO = new RegExp(`^[A-Za-z0-9_-]{${String(COMPRIMENTO_DO_SEGREDO)}}$`);

/** Bytes do digest SHA-256 — dimensiona a comparação de tempo constante. */
const BYTES_DO_HASH = 32;

/** Gera um segredo de recuperação novo com CSPRNG do runtime. */
export function gerarSegredoRecuperacao(): string {
  return randomBytes(BYTES_DO_SEGREDO).toString("base64url");
}

/**
 * FORMA do segredo — não posse. FAIL-CLOSED: qualquer coisa que não seja
 * exatamente 43 caracteres base64url é rejeitada antes de tocar o banco.
 */
export function ehSegredoRecuperacaoBemFormado(candidato: unknown): candidato is string {
  return typeof candidato === "string" && PADRAO_SEGREDO.test(candidato);
}

/** Hash persistido em `hash_segredo`: SHA-256 do segredo, em hexadecimal. */
export function calcularHashSegredoRecuperacao(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

/**
 * Compara, em TEMPO CONSTANTE, o hash persistido com o hash recalculado a
 * partir do segredo oferecido. Nenhum `===` sobre o hash participa da
 * decisão; um `hash_segredo` de tamanho inesperado é fail-closed e ainda
 * assim paga a mesma comparação.
 */
export function hashSegredoRecuperacaoConfere(
  hashPersistido: string,
  segredo: string,
): boolean {
  const calculado = Buffer.from(calcularHashSegredoRecuperacao(segredo), "hex");
  const persistido = Buffer.from(hashPersistido, "hex");
  if (persistido.length !== BYTES_DO_HASH) {
    timingSafeEqual(calculado, calculado);
    return false;
  }
  return timingSafeEqual(persistido, calculado);
}

/**
 * Hash sintético usado no caminho de segredo INEXISTENTE, para que a ausência
 * de linha percorra a mesma comparação de tempo constante que um segredo
 * existente. NÃO É SEGREDO: é o digest de uma constante pública, e nenhum
 * segredo real de 43 caracteres base64url é igual a esta cadeia.
 */
export const HASH_SINTETICO_DE_AUSENCIA = calcularHashSegredoRecuperacao(
  "segredo-de-recuperacao-inexistente-hash-sintetico",
);
