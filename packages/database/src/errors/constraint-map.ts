// TechLab Fisio — E-12 — Mapeamento de erro por constraint (decisão C-6).
//
// Este módulo reflete EXCLUSIVAMENTE o comportamento MEDIDO pela verificação
// V-03 (docs/08 §12.2, registro na revisão de execução da E-12), contra
// PostgreSQL 18 real, Prisma Client 7.9.1 e @prisma/adapter-pg 7.9.1, com a
// role de runtime `tlf_app`. Nada aqui presume comportamento documentado do
// Prisma que não tenha sido observado.
//
// Forma medida do erro que chega à aplicação (as quatro classes):
//
//   | Violação        | code Prisma | SQLSTATE | identificação estruturada     |
//   | --------------- | ----------- | -------- | ----------------------------- |
//   | UNIQUE (parcial)| P2002       | 23505    | kind=UniqueConstraintViolation|
//   |                 |             |          | + meta.modelName              |
//   |                 |             |          | + cause.constraint.fields     |
//   | CHECK           | P2039       | 23514    | somente SQLSTATE; nome apenas |
//   |                 |             |          | na mensagem do PostgreSQL     |
//   | EXCLUSION       | P2039       | 23P01    | somente SQLSTATE; nome apenas |
//   |                 |             |          | na mensagem do PostgreSQL     |
//   | FOREIGN KEY     | P2003       | 23503    | cause.constraint.index (nome) |
//
// Em todos os casos o SQLSTATE original chega ESTRUTURADO em
// `erro.meta.driverAdapterError.cause.originalCode` (e, para kind="postgres",
// também em `.code`). Violações provocadas via `tx.$queryRaw` chegam como
// P2010 com a MESMA causa estruturada do driver — o mapeamento abaixo lê a
// causa e portanto cobre os dois caminhos de escrita.
//
// Consequência para C-6: a exclusion constraint É deterministicamente
// reconhecível pelo caminho normal do Prisma (SQLSTATE 23P01 estruturado).
// O fallback homologado de envolver a inserção de `agendamento` em
// `tx.$queryRaw` NÃO precisou ser acionado.
//
// Sobre nomes de constraint: para UNIQUE e FK o identificador estruturado
// medido é usado como critério primário. Para CHECK e EXCLUSION o Prisma
// 7.9.1 NÃO expõe o nome em campo estruturado (fato medido); o nome é
// extraído do formato FIXO de mensagem do PostgreSQL (`violates ... constraint
// "nome"`), premissa válida com `lc_messages` em inglês — configuração da
// imagem oficial `postgres:18-bookworm` usada pelo projeto. A CLASSE da
// violação, que é o que decide comportamento, nunca depende de mensagem:
// vem sempre do SQLSTATE estruturado.
//
// Política de segurança do mapeamento (docs/07 §18, C-01 × C-04):
//   - consumo duplicado  -> SUCESSO IDEMPOTENTE (RN-035, I-27);
//   - conflito de agenda -> ERRO DE CONFLITO;
//   - JAMAIS o inverso; erro desconhecido NUNCA é classificado como nenhum
//     dos dois (fail closed: os predicados retornam `false`).

/** Índice único parcial de consumo único (U-03/IDX-M2, migration E-10). */
export const CONSTRAINT_CONSUMO_UNICO =
  "ux_movimento_sessao_consumo_atendimento_pacote";

/** Exclusion constraints de conflito de agenda (IDX-A1/IDX-A2, migration E-10). */
export const CONSTRAINTS_CONFLITO_AGENDA = [
  "ex_agendamento_profissional",
  "ex_agendamento_paciente",
] as const;

/** Identificação estruturada medida do consumo único sob P2002. */
const MODELO_CONSUMO = "MovimentoSessao";
const CAMPOS_CONSUMO = ["atendimento_id", "pacote_id"] as const;

export type ClasseViolacao = "UNIQUE" | "CHECK" | "EXCLUSION" | "FOREIGN_KEY";

const CLASSE_POR_SQLSTATE: Readonly<Record<string, ClasseViolacao>> = {
  "23505": "UNIQUE",
  "23514": "CHECK",
  "23P01": "EXCLUSION",
  "23503": "FOREIGN_KEY",
};

export interface ViolacaoConstraint {
  classe: ClasseViolacao;
  /** SQLSTATE do PostgreSQL, sempre estruturado (fato medido em V-03). */
  sqlstate: string;
  /** Nome da constraint, quando identificável (ver nota de cabeçalho). */
  constraint: string | null;
  /** Código Prisma do erro externo (P2002, P2003, P2039, P2010...). */
  codigoPrisma: string | null;
  /** `meta.modelName` do erro Prisma, quando presente. */
  modelo: string | null;
  /** `cause.constraint.fields` medido para violações UNIQUE. */
  camposUnique: readonly string[] | null;
}

// ---------------------------------------------------------------------------
// Leitura estrutural do erro — sem instanceof de classes do Prisma, para não
// depender de identidade de módulo; apenas a forma medida em V-03.
// ---------------------------------------------------------------------------

function comoRegistro(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : null;
}

function textoOuNull(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

/** Formato fixo das mensagens do PostgreSQL para violação de constraint. */
const PADRAO_NOME_CONSTRAINT =
  /violates (?:unique|check|exclusion|foreign key) constraint "([^"]+)"/;

function extrairNomeDaMensagem(mensagem: string | null): string | null {
  if (mensagem === null) return null;
  const m = PADRAO_NOME_CONSTRAINT.exec(mensagem);
  return m?.[1] ?? null;
}

/**
 * Identifica uma violação de constraint a partir do erro que chega à
 * aplicação. Retorna `null` para QUALQUER erro que não seja uma das quatro
 * classes medidas em V-03 — nunca classifica erro desconhecido.
 */
export function identificarViolacao(erro: unknown): ViolacaoConstraint | null {
  const raiz = comoRegistro(erro);
  if (raiz === null) return null;

  const meta = comoRegistro(raiz["meta"]);
  if (meta === null) return null;

  const driverAdapterError = comoRegistro(meta["driverAdapterError"]);
  const cause = comoRegistro(driverAdapterError?.["cause"]);
  if (cause === null) return null;

  const sqlstate =
    textoOuNull(cause["originalCode"]) ?? textoOuNull(cause["code"]);
  if (sqlstate === null) return null;

  const classe = CLASSE_POR_SQLSTATE[sqlstate];
  if (classe === undefined) return null;

  const constraintEstruturada = comoRegistro(cause["constraint"]);
  const nomeEstruturado = textoOuNull(constraintEstruturada?.["index"]);
  const camposBrutos = constraintEstruturada?.["fields"];
  const camposUnique =
    Array.isArray(camposBrutos) && camposBrutos.every((c) => typeof c === "string")
      ? (camposBrutos as string[])
      : null;

  return {
    classe,
    sqlstate,
    // FK expõe o nome estruturado (`constraint.index`); as demais classes só
    // o expõem na mensagem original do PostgreSQL (fato medido em V-03).
    constraint:
      nomeEstruturado ??
      extrairNomeDaMensagem(textoOuNull(cause["originalMessage"])),
    codigoPrisma: textoOuNull(raiz["code"]),
    modelo: textoOuNull(meta["modelName"]),
    camposUnique,
  };
}

// ---------------------------------------------------------------------------
// Predicados das duas invariantes opostas de docs/07 §18 (C-04 × C-01).
// Disjuntos POR CONSTRUÇÃO: um exige classe UNIQUE, o outro classe EXCLUSION.
// ---------------------------------------------------------------------------

function conjuntosIguais(
  a: readonly string[],
  b: readonly string[],
): boolean {
  return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * C-04 — retry de consumo. `true` sse o erro é a violação do índice único
 * parcial de consumo único, e de NENHUMA outra constraint. O chamador deve
 * traduzir em SUCESSO IDEMPOTENTE (RN-035, I-27): nenhuma segunda baixa,
 * nenhum movimento adicional, nenhuma auditoria de novo consumo.
 *
 * Critério primário estruturado (medido): classe UNIQUE + modelo
 * `MovimentoSessao` + campos (`atendimento_id`, `pacote_id`). O nome extraído
 * da mensagem, quando disponível, é aceito como critério equivalente — em
 * V-03 os dois sinais chegaram sempre juntos.
 */
export function ehConsumoDuplicado(erro: unknown): boolean {
  const v = identificarViolacao(erro);
  if (v === null || v.classe !== "UNIQUE") return false;
  if (v.constraint === CONSTRAINT_CONSUMO_UNICO) return true;
  return (
    v.modelo === MODELO_CONSUMO &&
    v.camposUnique !== null &&
    conjuntosIguais(v.camposUnique, CAMPOS_CONSUMO)
  );
}

/**
 * C-01 — conflito de agenda. `true` sse o erro é violação de EXCLUSION
 * (SQLSTATE 23P01, estruturado) de uma das duas exclusion constraints de
 * agenda. O chamador deve traduzir em ERRO DE CONFLITO — nunca em sucesso.
 *
 * Exige o nome da constraint (extraído do formato fixo de mensagem do
 * PostgreSQL — único mecanismo disponível, fato medido): um 23P01 de uma
 * exclusion constraint futura desconhecida NÃO é classificado como conflito
 * de agenda e cai no tratamento de erro desconhecido (fail closed).
 */
export function ehConflitoAgenda(erro: unknown): boolean {
  const v = identificarViolacao(erro);
  return (
    v !== null &&
    v.classe === "EXCLUSION" &&
    v.constraint !== null &&
    (CONSTRAINTS_CONFLITO_AGENDA as readonly string[]).includes(v.constraint)
  );
}
