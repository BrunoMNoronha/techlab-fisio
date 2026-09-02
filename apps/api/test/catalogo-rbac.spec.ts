// TechLab Fisio — Etapa 2.3D-B / F5 — o catálogo de seed É `docs/04`.
//
// Mesmo propósito, mesma disciplina e mesmo mecanismo de
// `permissoes.catalogo.spec.ts` (F4): em vez de reafirmar à mão o que o código
// declara — o que só provaria que alguém copiou duas vezes —, esta suíte LÊ o
// documento homologado e DERIVA dele a expectativa.
//
// Três provas independentes, e é a terceira que sustenta `D-2.3D-09`:
//   1. os quatro papéis do código são os quatro títulos de `docs/04` §3;
//   2. `permissao.nome` é, para cada identificador, o parágrafo descritivo de
//      `docs/04` §5, byte a byte;
//   3. a MATRIZ do código é EXATAMENTE o que a regra de derivação declarada em
//      `catalogo-rbac.ts` produz quando aplicada, célula a célula, à tabela de
//      `docs/04` §4 — que esta suíte também lê do disco.
//
// Consequência mecânica: alterar a matriz no código sem alteração homologada
// correspondente em `docs/04` faz esta prova falhar. É a mesma disciplina de
// anti-drift que o golden schema exerce sobre a persistência.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@jest/globals";

import { PERMISSOES } from "../src/authz/permissoes.catalogo.js";
import type { Permissao } from "../src/authz/permissoes.catalogo.js";
import {
  ASSOCIACOES_SEED,
  DESCRICAO_PERMISSAO,
  MATRIZ_RBAC,
  PAPEIS,
  ehCodigoPapel,
} from "../src/provisionamento/catalogo-rbac.js";
import type { CodigoPapel } from "../src/provisionamento/catalogo-rbac.js";

const raizRepo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const DOCUMENTO = readFileSync(
  path.join(raizRepo, "docs", "04-perfis-permissoes.md"),
  "utf8",
);

function secao(inicio: string, fim: string): string {
  const a = DOCUMENTO.indexOf(inicio);
  const b = DOCUMENTO.indexOf(fim);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(b).toBeGreaterThan(a);
  return DOCUMENTO.slice(a, b);
}

// ---------------------------------------------------------------------------
// §3 — os quatro papéis
// ---------------------------------------------------------------------------

/** Títulos `## 3.N <Nome>` de `docs/04` §3, na ordem da fonte. */
function papeisDoDocumento(): readonly string[] {
  const trecho = secao("# 3. Perfis do MVP", "# 4. Matriz funcional preliminar");
  return [...trecho.matchAll(/^## 3\.\d+ (.+?)\s*$/gm)].map((m) => String(m[1]));
}

// ---------------------------------------------------------------------------
// §5 — identificadores e descrições
// ---------------------------------------------------------------------------

/** Pares `identificador -> parágrafo descritivo` de `docs/04` §5. */
function descricoesDoDocumento(): ReadonlyMap<string, string> {
  const trecho = secao(
    "# 5. Catálogo funcional de permissões sensíveis",
    "# 6. Regras de combinação de papéis",
  );
  const pares = new Map<string, string>();
  for (const casamento of trecho.matchAll(
    /^### `([a-z0-9_.]+)`\s*\n\s*\n(.+?)\s*$/gm,
  )) {
    pares.set(String(casamento[1]), String(casamento[2]));
  }
  return pares;
}

// ---------------------------------------------------------------------------
// §4 — a matriz funcional
// ---------------------------------------------------------------------------

/**
 * Mapa OPERAÇÃO (linha de §4) -> identificador de §5, ou `null` quando a
 * tradução não é objetivamente determinável.
 *
 * É a única parte desta suíte escrita à mão, e ela é auditável linha a linha
 * contra o documento: a prova de exaustividade abaixo exige que TODA linha da
 * tabela esteja aqui e que nenhuma entrada daqui deixe de existir lá — um
 * rótulo alterado em `docs/04` derruba a suíte em vez de passar despercebido.
 *
 * Os `null` são as lacunas DECLARADAS, justificadas uma a uma no cabeçalho de
 * `catalogo-rbac.ts` e registradas em `docs/10`.
 */
const PERMISSAO_DA_LINHA: Readonly<Record<string, Permissao | null>> = {
  "Autenticar/logout próprio": null,
  "Recuperar própria senha via fluxo autorizado": null,
  "Iniciar recuperação de senha de terceiro": "senha.recuperar_terceiro",
  "Gerenciar usuários": "usuarios.gerenciar",
  "Gerenciar papéis/permissões": "permissoes.gerenciar",
  "Revogar sessões de terceiro": "sessoes.revogar_terceiro",
  "Configurar clínica": "clinica.configurar",
  "Gerenciar serviços": "clinica.configurar",
  "Gerenciar formas de pagamento": "clinica.configurar",
  "Gerenciar motivos de cancelamento": "clinica.configurar",
  "Gerenciar profissionais": "profissionais.gerenciar",
  "Consultar profissionais": null,
  "Cadastrar paciente administrativo": "pacientes.administrativo.gerenciar",
  "Editar dados administrativos do paciente": "pacientes.administrativo.gerenciar",
  "Localizar paciente": "pacientes.localizar",
  "Ver observação administrativa": "pacientes.administrativo.gerenciar",
  "Ver prontuário clínico": "prontuario.ler",
  "Criar avaliação/anamnese/plano": "prontuario.escrever",
  "Criar evolução": "prontuario.escrever",
  "Finalizar registro clínico": "prontuario.finalizar",
  "Retificar registro próprio": "prontuario.retificar_proprio",
  "Retificar registro de outro fisioterapeuta": "prontuario.retificar_terceiro",
  "Anexar documento clínico": "prontuario.escrever",
  "Exportar relatório clínico": "prontuario.exportar",
  "Criar agendamento": "agenda.gerenciar",
  "Confirmar agendamento": "agenda.gerenciar",
  "Remarcar agendamento": "agenda.gerenciar",
  "Cancelar agendamento": "agenda.gerenciar",
  "Criar bloqueio de agenda": "agenda.bloqueio",
  "Efetuar check-in": "agenda.checkin",
  "Registrar falta": "agenda.falta",
  "Iniciar atendimento clínico": null,
  "Concluir atendimento clínico": null,
  "Criar pacote contratado": "pacotes.gerenciar",
  "Vincular pacote ao agendamento": "pacotes.gerenciar",
  "Consultar saldo administrativo de pacote": null,
  "Consultar histórico detalhado de movimentos": null,
  "Ajustar sessões manualmente": "pacotes.ajustar_sessao",
  "Criar cobrança": "financeiro.cobranca.gerenciar",
  "Registrar pagamento": "financeiro.pagamento.registrar",
  "Aplicar desconto": "financeiro.desconto.aplicar",
  "Cancelar cobrança": "financeiro.cobranca.cancelar",
  "Estornar pagamento": "financeiro.pagamento.estornar",
  "Emitir recibo simples": null,
  "Consultar financeiro global": "financeiro.relatorio.ler",
  "Consultar financeiro operacional do paciente": "financeiro.relatorio.ler",
  "Consultar indicadores globais": "indicadores.globais.ler",
  "Consultar indicadores operacionais": null,
  "Consultar auditoria": "auditoria.ler",
};

/** Colunas da tabela de §4, na ordem do documento. */
const COLUNAS: readonly CodigoPapel[] = [
  "ADMINISTRADOR",
  "GESTOR",
  "RECEPCIONISTA",
  "FISIOTERAPEUTA",
];

interface LinhaMatriz {
  readonly operacao: string;
  readonly celulas: readonly string[];
}

/** Linhas de dados da tabela de `docs/04` §4 (sem cabeçalho nem separador). */
function linhasDaMatriz(): readonly LinhaMatriz[] {
  const trecho = secao("# 4. Matriz funcional preliminar", "`—*`:");
  return trecho
    .split("\n")
    .filter((linha) => linha.startsWith("|"))
    .map((linha) =>
      linha
        .split("|")
        .slice(1, -1)
        .map((celula) => celula.trim()),
    )
    .filter((celulas) => celulas.length === 5)
    .filter((celulas) => celulas[0] !== "Operação" && !celulas[0]?.startsWith("---"))
    .map((celulas) => ({
      operacao: String(celulas[0]),
      celulas: celulas.slice(1),
    }));
}

/**
 * Classificação de UMA célula de §4 pela regra declarada em
 * `catalogo-rbac.ts`. Fail-closed: célula de forma desconhecida LANÇA, em vez
 * de ser silenciosamente tratada como negação — o teste passaria a provar
 * menos do que afirma.
 */
function classificar(celula: string): "CONCEDE" | "NEGA" {
  // Qualquer `P` isolado (`P`, `✓/P`, `P/✓ …`, `P excepcional`, `P relacionado`)
  // é permissão específica ADICIONAL — nunca padrão do papel (HOM-01).
  if (/(^|[\s/])P($|[\s/])/.test(celula)) return "NEGA";
  // "C próprio se autorizado" — autorização adicional explícita.
  if (/se autorizado/i.test(celula)) return "NEGA";
  // "C mínimo" / "C leitura mínima" — acesso REDUZIDO que o identificador de
  // §5 não expressa; concedê-lo daria mais do que a célula permite.
  if (/mínim/i.test(celula)) return "NEGA";
  if (celula.startsWith("—")) return "NEGA";
  if (celula === "✓") return "CONCEDE";
  if (/^C(\s|$)/.test(celula)) return "CONCEDE";
  throw new Error(`Célula de forma não prevista na regra de derivação: "${celula}"`);
}

/**
 * Expectativa DERIVADA do documento: para cada papel, o conjunto de permissões
 * cujas linhas de §4 TODAS concedem (interseção — a combinação que nunca
 * amplia privilégio).
 */
function matrizEsperadaDoDocumento(): Readonly<Record<CodigoPapel, readonly string[]>> {
  const concede = new Map<CodigoPapel, Map<Permissao, boolean>>(
    COLUNAS.map((papel) => [papel, new Map<Permissao, boolean>()]),
  );

  for (const linha of linhasDaMatriz()) {
    const permissao = PERMISSAO_DA_LINHA[linha.operacao];
    if (permissao === undefined) {
      throw new Error(`Linha de §4 sem mapeamento declarado: "${linha.operacao}"`);
    }
    if (permissao === null) continue;
    COLUNAS.forEach((papel, indice) => {
      const veredito = classificar(String(linha.celulas[indice]));
      const acumulado = concede.get(papel);
      if (acumulado === undefined) throw new Error("coluna não inicializada");
      const anterior = acumulado.get(permissao);
      // INTERSEÇÃO: basta uma linha negar para o papel não receber.
      acumulado.set(permissao, (anterior ?? true) && veredito === "CONCEDE");
    });
  }

  const esperada = {} as Record<CodigoPapel, readonly string[]>;
  for (const papel of COLUNAS) {
    const acumulado = concede.get(papel);
    if (acumulado === undefined) throw new Error("coluna não inicializada");
    esperada[papel] = [...acumulado.entries()]
      .filter(([, permitido]) => permitido)
      .map(([permissao]) => permissao)
      .sort();
  }
  return esperada;
}

function ordenado(valores: readonly string[]): readonly string[] {
  return [...valores].sort();
}

// ---------------------------------------------------------------------------

describe("`docs/04` §3 — os quatro papéis do MVP", () => {
  it("a extração do documento encontra papéis — controle de não vacuidade", () => {
    expect(papeisDoDocumento().length).toBe(4);
  });

  it("os nomes do código são EXATAMENTE os títulos de §3, na mesma ordem", () => {
    expect(PAPEIS.map((papel) => papel.nome)).toEqual([...papeisDoDocumento()]);
  });

  it("são exatamente quatro, sem papel auxiliar inventado", () => {
    expect(PAPEIS).toHaveLength(4);
    const codigos = PAPEIS.map((papel) => papel.codigo);
    expect(new Set(codigos).size).toBe(4);
    for (const proibido of [
      "SuperAdmin",
      "SUPERADMIN",
      "Root",
      "ROOT",
      "System",
      "SYSTEM",
      "Owner",
      "OWNER",
      "Developer",
      "DEVELOPER",
      "Support",
      "SUPPORT",
    ]) {
      expect(ehCodigoPapel(proibido)).toBe(false);
    }
  });

  it("`ehCodigoPapel` é fail-closed", () => {
    for (const codigo of PAPEIS.map((papel) => papel.codigo)) {
      expect(ehCodigoPapel(codigo)).toBe(true);
    }
    for (const invalido of [
      "administrador",
      "ADMINISTRADOR ",
      "",
      null,
      undefined,
      0,
      true,
      {},
      [],
    ]) {
      expect(ehCodigoPapel(invalido)).toBe(false);
    }
  });

  it("o array de papéis é congelado", () => {
    expect(Object.isFrozen(PAPEIS)).toBe(true);
  });
});

describe("`docs/04` §5 — `permissao.nome` é a descrição da fonte", () => {
  it("a extração encontra uma descrição por identificador do catálogo", () => {
    const doDocumento = descricoesDoDocumento();
    expect(doDocumento.size).toBe(PERMISSOES.length);
  });

  it("as chaves do mapa de descrições são EXATAMENTE as 29 permissões", () => {
    expect(ordenado(Object.keys(DESCRICAO_PERMISSAO))).toEqual(ordenado([...PERMISSOES]));
  });

  it("cada descrição é o parágrafo do documento, byte a byte", () => {
    const doDocumento = descricoesDoDocumento();
    for (const codigo of PERMISSOES) {
      expect(DESCRICAO_PERMISSAO[codigo]).toBe(doDocumento.get(codigo));
    }
  });

  it("nenhuma descrição é vazia — a coluna `permissao.nome` é NOT NULL", () => {
    for (const codigo of PERMISSOES) {
      expect(DESCRICAO_PERMISSAO[codigo].trim().length).toBeGreaterThan(0);
    }
  });
});

describe("`D-2.3D-09` — a matriz do seed é derivada de `docs/04` §4", () => {
  it("a tabela de §4 é lida por inteiro — controle de não vacuidade", () => {
    const linhas = linhasDaMatriz();
    expect(linhas.length).toBe(49);
    for (const linha of linhas) expect(linha.celulas).toHaveLength(4);
  });

  it("TODA linha da tabela tem mapeamento declarado, e vice-versa", () => {
    const operacoesDoDocumento = linhasDaMatriz().map((linha) => linha.operacao);
    expect(ordenado(operacoesDoDocumento)).toEqual(
      ordenado(Object.keys(PERMISSAO_DA_LINHA)),
    );
  });

  it("toda célula da tabela é classificável pela regra declarada", () => {
    for (const linha of linhasDaMatriz()) {
      for (const celula of linha.celulas) {
        expect(["CONCEDE", "NEGA"]).toContain(classificar(celula));
      }
    }
  });

  it("a matriz do código É a expectativa derivada do documento", () => {
    const esperada = matrizEsperadaDoDocumento();
    for (const papel of COLUNAS) {
      expect(ordenado([...MATRIZ_RBAC[papel]])).toEqual([...esperada[papel]]);
    }
  });

  it("a derivação não é vazia — controle contra tautologia", () => {
    const esperada = matrizEsperadaDoDocumento();
    const total = COLUNAS.reduce((soma, papel) => soma + esperada[papel].length, 0);
    expect(total).toBeGreaterThan(20);
  });
});

describe("propriedades vinculantes da matriz — `docs/04` §2, §3, §6, §8, §9", () => {
  it("toda permissão da matriz pertence ao catálogo de §5", () => {
    const catalogo = new Set<string>(PERMISSOES);
    for (const papel of COLUNAS) {
      for (const permissao of MATRIZ_RBAC[papel]) expect(catalogo.has(permissao)).toBe(true);
    }
  });

  it("nenhum papel tem permissão duplicada", () => {
    for (const papel of COLUNAS) {
      expect(new Set(MATRIZ_RBAC[papel]).size).toBe(MATRIZ_RBAC[papel].length);
    }
  });

  it("PERM-T01 — o Administrador NÃO recebe capacidade clínica alguma", () => {
    const clinicas = [...MATRIZ_RBAC.ADMINISTRADOR].filter((permissao) =>
      permissao.startsWith("prontuario."),
    );
    expect(clinicas).toEqual([]);
  });

  it("o Administrador NÃO recebe as 29 permissões — recebe 18", () => {
    expect(MATRIZ_RBAC.ADMINISTRADOR).toHaveLength(18);
    expect(MATRIZ_RBAC.ADMINISTRADOR.length).toBeLessThan(PERMISSOES.length);
  });

  it("HOM-01 — o Gestor recebe SOMENTE leitura, e nada de mutação", () => {
    expect(ordenado([...MATRIZ_RBAC.GESTOR])).toEqual([
      "financeiro.relatorio.ler",
      "indicadores.globais.ler",
      "pacientes.localizar",
    ]);
    for (const proibida of [
      "permissoes.gerenciar",
      "usuarios.gerenciar",
      "agenda.gerenciar",
      "agenda.checkin",
      "agenda.falta",
      "agenda.bloqueio",
      "pacotes.gerenciar",
      "pacotes.ajustar_sessao",
      "financeiro.cobranca.gerenciar",
      "financeiro.pagamento.registrar",
      "financeiro.desconto.aplicar",
      "financeiro.cobranca.cancelar",
      "financeiro.pagamento.estornar",
      "pacientes.administrativo.gerenciar",
    ] satisfies Permissao[]) {
      expect(MATRIZ_RBAC.GESTOR).not.toContain(proibida);
    }
  });

  it("§6.2 — nenhuma permissão sensível é concedida por papel amplo", () => {
    expect(MATRIZ_RBAC.ADMINISTRADOR).not.toContain("prontuario.retificar_terceiro");
    expect(MATRIZ_RBAC.RECEPCIONISTA).not.toContain("financeiro.pagamento.estornar");
    expect(MATRIZ_RBAC.GESTOR).not.toContain("permissoes.gerenciar");
    expect(MATRIZ_RBAC.FISIOTERAPEUTA).not.toContain("indicadores.globais.ler");
  });

  it("as permissões `P` de §8/§9 não são concedidas a papel algum", () => {
    const semPapel: Permissao[] = [
      "prontuario.retificar_proprio",
      "prontuario.retificar_terceiro",
      "prontuario.exportar",
      "pacotes.ajustar_sessao",
      "financeiro.desconto.aplicar",
      "financeiro.cobranca.cancelar",
      "financeiro.pagamento.estornar",
      "indicadores.proprios.ler",
    ];
    for (const permissao of semPapel) {
      for (const papel of COLUNAS) {
        expect(MATRIZ_RBAC[papel]).not.toContain(permissao);
      }
    }
  });

  it("o Fisioterapeuta recebe a capacidade clínica de §3.4 — e só ela", () => {
    const clinicas = [...MATRIZ_RBAC.FISIOTERAPEUTA].filter((permissao) =>
      permissao.startsWith("prontuario."),
    );
    expect(ordenado(clinicas)).toEqual([
      "prontuario.escrever",
      "prontuario.finalizar",
      "prontuario.ler",
    ]);
  });
});

describe("`ASSOCIACOES_SEED` — o achatamento persistido", () => {
  it("contém exatamente a soma das permissões dos quatro papéis", () => {
    const total = COLUNAS.reduce((soma, papel) => soma + MATRIZ_RBAC[papel].length, 0);
    expect(ASSOCIACOES_SEED).toHaveLength(total);
    expect(ASSOCIACOES_SEED).toHaveLength(37);
  });

  it("não possui par duplicado", () => {
    const chaves = ASSOCIACOES_SEED.map((a) => `${a.papel} ${a.permissao}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("é determinístico e congelado", () => {
    expect(Object.isFrozen(ASSOCIACOES_SEED)).toBe(true);
    expect(ASSOCIACOES_SEED[0]).toEqual({
      papel: "ADMINISTRADOR",
      permissao: "usuarios.gerenciar",
    });
  });

  it("21 das 29 permissões são concedidas a pelo menos um papel", () => {
    const concedidas = new Set(ASSOCIACOES_SEED.map((a) => a.permissao));
    expect(concedidas.size).toBe(21);
    expect(PERMISSOES.length - concedidas.size).toBe(8);
  });
});
