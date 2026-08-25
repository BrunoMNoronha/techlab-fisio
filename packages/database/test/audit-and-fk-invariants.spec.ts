// TechLab Fisio — E-14 — T-FK-RESTRICT — política referencial homologada.
//
// T-FK-RESTRICT (docs/07 §9.2; docs/08 §14): `ON DELETE RESTRICT` em TODAS as
// FKs; cascata de exclusão é proibida. A prova integral vem do CATÁLOGO do
// PostgreSQL (`pg_constraint`), não de inspeção textual do Prisma, e não
// depende de número hardcoded de FKs: a contagem é validada por casamento
// cruzado com `information_schema.referential_constraints`.
//
// ---------------------------------------------------------------------------
// T-AUD-CONTEXTO — RECLASSIFICADO (E-18B) — não pertence a esta suíte.
//
// O item viveu aqui como `it.todo` enquanto a política de whitelist de
// `evento_auditoria.contexto` era indefinida (P-E14-01). Com a homologação de
// docs/09 §12 (D-AUD-01..D-AUD-08, 25/08/2026), a decisão D-AUD-08 confirmou
// docs/07 §22.3: a validação fail-closed do catálogo de `acao` e da whitelist
// de `contexto` é regra da CAMADA DE APLICAÇÃO. O banco garante apenas a
// forma (`jsonb`, colunas NN) — já coberta pela Guarda 2 e pelo golden — e
// não existe comportamento de persistência legítimo que este item pudesse
// medir sem inventar implementação sem consumidor.
// T-AUD-CONTEXTO fica RECLASSIFICADO: teste de regra de aplicação/backend,
// a executar quando `apps/api` existir (rastreado em docs/08 §19 P-BACK-01;
// registro da reclassificação em docs/09 §12.7 e docs/08 §13 E-14/REV. 17).
// Ele NÃO foi aprovado nem convertido em teste artificial nesta suíte.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "../generated/prisma/client.js";
import { criarClienteApp } from "./helpers/db.js";
import { capturarErro, extrairSqlstate } from "./helpers/erros.js";
import { criarBaseSintetica } from "./helpers/fixtures.js";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("T-FK-RESTRICT — nenhuma FK apaga em cascata (docs/07 §9.2)", () => {
  it("catálogo integral: todas as FKs do schema usam ON DELETE RESTRICT", async () => {
    interface LinhaFk {
      tabela: string;
      constraint: string;
      ondelete: string;
      onupdate: string;
    }
    // `confdeltype`/`confupdtype` são "char" do catálogo — cast a text para o
    // deserializador do driver adapter.
    const fks = await prisma.$queryRaw<LinhaFk[]>`
      SELECT conrelid::regclass::text AS tabela,
             conname                  AS constraint,
             confdeltype::text        AS ondelete,
             confupdtype::text        AS onupdate
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
      ORDER BY conname
    `;
    expect(fks.length).toBeGreaterThan(0);

    // Casamento cruzado com information_schema: protege o teste contra uma
    // consulta de catálogo acidentalmente vazia/errada, sem hardcoded count.
    const contagemCruzada = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total
      FROM information_schema.referential_constraints
      WHERE constraint_schema = 'public'
    `;
    expect(fks.length).toBe(Number(contagemCruzada[0]?.total));

    // confdeltype: 'r' RESTRICT · 'a' NO ACTION · 'c' CASCADE · 'n' SET NULL
    // · 'd' SET DEFAULT. A política homologada materializada pelas migrations
    // é RESTRICT em todas; qualquer desvio é listado nominalmente na falha.
    const foraDaPolitica = fks.filter((fk) => fk.ondelete !== "r");
    expect(foraDaPolitica).toEqual([]);

    // ON UPDATE: eixo não normatizado, decidido como Restrict (D-ONUPD-01,
    // docs/08 §19). Cascata de update reescreveria FKs silenciosamente —
    // mesma classe de reescrita proibida; nenhuma deve existir.
    const cascataUpdate = fks.filter((fk) => fk.onupdate === "c");
    expect(cascataUpdate).toEqual([]);
  });

  it("efeito representativo: excluir pai referenciado é rejeitado e o filho permanece", async () => {
    const base = await criarBaseSintetica(prisma);
    const contato = await prisma.contatoEmergencia.create({
      data: {
        pacienteId: base.paciente1Id,
        nome: "Contato Sintético E14",
        telefone: "+55 00 00000-0000",
      },
    });

    const erro = await capturarErro(() =>
      prisma.paciente.delete({ where: { id: base.paciente1Id } }),
    );
    // Fato medido nesta etapa: DELETE bloqueado por `ON DELETE RESTRICT` chega
    // com SQLSTATE 23001 (restrict_violation) — evidência ESPECÍFICA da
    // política RESTRICT (NO ACTION produziria 23503). Classe deliberadamente
    // fora do constraint-map, que só cobre as quatro classes medidas em V-03.
    expect(extrairSqlstate(erro)).toBe("23001");

    // Pai e filho intactos: nada foi removido em cascata.
    await expect(
      prisma.paciente.findUniqueOrThrow({ where: { id: base.paciente1Id } }),
    ).resolves.toBeDefined();
    await expect(
      prisma.contatoEmergencia.findUniqueOrThrow({ where: { id: contato.id } }),
    ).resolves.toBeDefined();
  });
});
