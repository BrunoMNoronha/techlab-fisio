// TechLab Fisio — normalização do identificador de login (Etapa 2.3D-B / F1).
//
// Materializa `D-2.3D-03` (`docs/12` §5.3): o identificador `usuario.email` é
// normalizado por **`trim` + `lowercase`** — na escrita, no login e em todo
// ponto de comparação futuro.
//
// FRONTEIRA DESTA FATIA: esta é uma função PURA de aplicação. A F1 NÃO
// consulta banco, NÃO altera `usuario.email` já persistido, NÃO cria migration,
// NÃO introduz `citext`, NÃO cria índice funcional e NÃO faz backfill
// (`docs/12` §5.3, explícito). A unicidade continua sendo a `U-01` homologada
// (`docs/07` §10.1); a normalização é responsabilidade da aplicação.
//
// LOCALE-INVARIANTE POR CONSTRUÇÃO: usa `String.prototype.toLowerCase()`, cuja
// especificação é o mapeamento Unicode padrão — NÃO `toLocaleLowerCase()`, que
// depende da locale do processo e produziria resultado diferente em pt-BR, en-US
// e tr-TR para os mesmos bytes. Um identificador de login precisa normalizar
// igual em qualquer máquina, sempre.
//
// ESCOPO DELIBERADAMENTE ESTREITO: `trim` + `lowercase`, nada mais. NÃO se
// aplica normalização Unicode (NFC/NFKC), NÃO se removem pontos, sinais de mais
// ou espaços internos, NÃO se valida formato de e-mail e NÃO se aplica qualquer
// política de tamanho ou complexidade. Nenhuma dessas transformações está
// homologada, e cada uma delas mudaria a identidade de contas reais.

/**
 * Normaliza o identificador de acesso conforme `D-2.3D-03`: remove espaços em
 * volta e converte para minúsculas, de forma determinística e idempotente.
 *
 * Não valida o valor: normalizar e validar são responsabilidades distintas, e a
 * validação de formato pertence à fatia que expuser o contrato HTTP (F3).
 */
export function normalizarIdentificadorLogin(identificador: string): string {
  return identificador.trim().toLowerCase();
}
