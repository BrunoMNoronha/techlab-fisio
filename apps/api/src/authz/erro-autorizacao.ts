// TechLab Fisio — contrato de erro da fronteira de autorização (Etapa 2.3D-B / F4).
//
// Conjunto FECHADO, no mesmo formato `{ "erro": "<CODIGO>" }` já adotado pela
// F3 (`auth/auth.dto.ts`, decisão local `L-03`) e pela guard de CSRF. A F4 NÃO
// altera `auth.dto.ts`: os códigos da fronteira de autenticação permanecem
// exatamente como homologados, e o código abaixo pertence à fatia nova.
//
// UM ÚNICO CÓDIGO, DELIBERADAMENTE. A negação de autorização não diz QUAL
// permissão faltou, quantas faltaram, quais papéis o usuário tem, se o usuário
// existe ou se está inativo. Informar isso transformaria o `403` em oráculo
// sobre a matriz de permissões e sobre o cadastro — mesma disciplina
// anti-enumeração de AUT-001/`D-2.3D-12` e da decisão local `A-05` da F3. O
// motivo tipado existe para o teste e para o código, nunca para o cliente.

export const ERRO_AUTORIZACAO = Object.freeze({
  /**
   * `403` — a requisição está autenticada e a autorização NÃO pôde ser
   * confirmada. Cobre indistintamente: permissão ausente, metadata ausente ou
   * inválida, contexto autenticado ausente, usuário inexistente e usuário
   * inativo.
   */
  ACESSO_NEGADO: "ACESSO_NEGADO",
} as const);
