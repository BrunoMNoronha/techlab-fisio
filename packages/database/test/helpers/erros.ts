// TechLab Fisio — E-14 — helpers de captura e leitura estrutural de erro.
//
// `capturarErro` reproduz o padrão já provado em constraint-errors.spec.ts
// (E-12): a violação esperada DEVE ocorrer — ausência de erro falha o teste.
//
// `extrairSqlstate` lê o SQLSTATE estruturado da mesma forma medida em V-03
// (`meta.driverAdapterError.cause.originalCode`/`.code`). Existe porque
// `identificarViolacao` (src/errors/constraint-map.ts) classifica DELIBERADAMENTE
// apenas as quatro classes medidas em V-03 (UNIQUE/CHECK/EXCLUSION/FK); testes
// de invariante também precisam reconhecer 23502 (NOT NULL), sem ampliar o
// mapeamento de produção.

function comoRegistro(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : null;
}

/** Executa a ação e devolve o erro lançado; falha se nenhum erro ocorrer. */
export async function capturarErro(acao: () => Promise<unknown>): Promise<unknown> {
  try {
    await acao();
  } catch (erro) {
    return erro;
  }
  throw new Error("a violação esperada não ocorreu");
}

/** SQLSTATE estruturado do PostgreSQL, na forma medida em V-03, ou null. */
export function extrairSqlstate(erro: unknown): string | null {
  const raiz = comoRegistro(erro);
  const meta = comoRegistro(raiz?.["meta"]);
  const driverAdapterError = comoRegistro(meta?.["driverAdapterError"]);
  const cause = comoRegistro(driverAdapterError?.["cause"]);
  if (cause === null) return null;
  const original = cause["originalCode"];
  if (typeof original === "string") return original;
  const codigo = cause["code"];
  return typeof codigo === "string" ? codigo : null;
}
