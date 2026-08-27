// TechLab Fisio — Etapa 2.3D-B / F0 — invariantes FÍSICAS da sessão de
// autenticação abertas pela decisão `D-2.3D-01`
// (`docs/12-decisoes-autenticacao-autorizacao.md` §5.1).
//
// Fontes: AUT-001, AUT-002, RN-004; `docs/07` §7.1, §10.2; `docs/12` §5.1/§5.4.
//
// LIMITE DELIBERADO DE ESCOPO — a F0 prova PERSISTÊNCIA, não lógica de runtime.
// Este spec NÃO testa: emissão ou verificação de token, hash SHA-256, política
// de expiração absoluta/ociosa, throttle de atividade, atualização monotônica,
// transições de estado, login, logout ou revogação. Tudo isso pertence às
// fatias F1..F7 e será provado quando os serviços existirem. Aqui se prova
// apenas o que o BANCO passou a garantir sozinho.
//
// Cobertura complementar (sem duplicação — `docs/08` §14): a EXISTÊNCIA da
// `ck_sessao_autenticacao_atividade` no catálogo e a REJEIÇÃO dos dois casos
// fora da janela vivem em guard-anti-drift.spec.ts (Guarda 2). Este arquivo
// cobre o lado que a Guarda 2 não cobre: os casos ACEITOS pela CHECK e o
// NOT NULL físico das duas colunas novas.
//
// Sem mocks: PostgreSQL 18 real, como `tlf_app`, no banco descartável da E-13.
// Dados 100% sintéticos (TLF-BASE-V1 §10) — nenhum token, segredo ou senha real.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "../generated/prisma/client.js";
import { criarClienteApp } from "./helpers/db.js";
import { capturarErro, extrairSqlstate } from "./helpers/erros.js";
import { criarBaseSintetica, TOKEN_HASH_SINTETICO } from "./helpers/fixtures.js";

/** Janela homologada em `docs/12` §5.1 para os casos de borda da CHECK. */
const CRIADA_EM = "2026-08-25T10:00:00Z";
const EXPIRA_EM = "2026-08-25T18:00:00Z";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("T-SESS-01 — ck_sessao_autenticacao_atividade ACEITA a janela homologada", () => {
  it("aceita ultima_atividade_em == criada_em (sessão recém-criada, borda inferior)", async () => {
    const base = await criarBaseSintetica(prisma);
    const sessao = await prisma.sessaoAutenticacao.create({
      data: {
        usuarioId: base.usuarioId,
        tokenHash: TOKEN_HASH_SINTETICO,
        estado: "ATIVA",
        criadaEm: new Date(CRIADA_EM),
        ultimaAtividadeEm: new Date(CRIADA_EM),
        expiraEm: new Date(EXPIRA_EM),
      },
    });
    expect(sessao.ultimaAtividadeEm).toEqual(new Date(CRIADA_EM));
    expect(sessao.criadaEm).toEqual(new Date(CRIADA_EM));
    expect(sessao.expiraEm).toEqual(new Date(EXPIRA_EM));
  });

  it("aceita criada_em < ultima_atividade_em < expira_em (atividade no meio da janela)", async () => {
    const base = await criarBaseSintetica(prisma);
    const atividade = "2026-08-25T12:00:00Z";
    const sessao = await prisma.sessaoAutenticacao.create({
      data: {
        usuarioId: base.usuarioId,
        tokenHash: TOKEN_HASH_SINTETICO,
        estado: "ATIVA",
        criadaEm: new Date(CRIADA_EM),
        ultimaAtividadeEm: new Date(atividade),
        expiraEm: new Date(EXPIRA_EM),
      },
    });
    expect(sessao.ultimaAtividadeEm).toEqual(new Date(atividade));
  });

  it("aceita ultima_atividade_em == expira_em (borda superior inclusiva)", async () => {
    const base = await criarBaseSintetica(prisma);
    const sessao = await prisma.sessaoAutenticacao.create({
      data: {
        usuarioId: base.usuarioId,
        tokenHash: TOKEN_HASH_SINTETICO,
        estado: "ATIVA",
        criadaEm: new Date(CRIADA_EM),
        ultimaAtividadeEm: new Date(EXPIRA_EM),
        expiraEm: new Date(EXPIRA_EM),
      },
    });
    expect(sessao.ultimaAtividadeEm).toEqual(new Date(EXPIRA_EM));
  });
});

describe("T-SESS-02 — NOT NULL físico das colunas abertas por `D-2.3D-01`", () => {
  // O Prisma Client já exige os dois campos no tipo; a prova FÍSICA da coluna
  // NOT NULL exige SQL cru com NULL explícito — mesmo método de T-CLIN-01.
  // 23502 = not_null_violation, deliberadamente fora do constraint-map (que só
  // cobre as quatro classes medidas em V-03).

  it("rejeita token_hash NULL", async () => {
    const base = await criarBaseSintetica(prisma);
    const erro = await capturarErro(() =>
      prisma.$executeRaw`
        INSERT INTO "sessao_autenticacao"
          ("id", "usuario_id", "token_hash", "estado",
           "criada_em", "ultima_atividade_em", "expira_em")
        VALUES
          (gen_random_uuid(), ${base.usuarioId}::uuid, NULL, 'ATIVA',
           ${CRIADA_EM}::timestamptz, ${CRIADA_EM}::timestamptz, ${EXPIRA_EM}::timestamptz)
      `,
    );
    expect(extrairSqlstate(erro)).toBe("23502");
    expect(await prisma.sessaoAutenticacao.count()).toBe(0);
  });

  it("rejeita ultima_atividade_em NULL", async () => {
    const base = await criarBaseSintetica(prisma);
    const erro = await capturarErro(() =>
      prisma.$executeRaw`
        INSERT INTO "sessao_autenticacao"
          ("id", "usuario_id", "token_hash", "estado",
           "criada_em", "ultima_atividade_em", "expira_em")
        VALUES
          (gen_random_uuid(), ${base.usuarioId}::uuid, ${TOKEN_HASH_SINTETICO}, 'ATIVA',
           ${CRIADA_EM}::timestamptz, NULL, ${EXPIRA_EM}::timestamptz)
      `,
    );
    expect(extrairSqlstate(erro)).toBe("23502");
    expect(await prisma.sessaoAutenticacao.count()).toBe(0);
  });
});

describe("T-SESS-03 — nenhum default silencioso nas colunas abertas por `D-2.3D-01`", () => {
  // `docs/12` §5.1: `token_hash` e `ultima_atividade_em` NÃO têm DEFAULT — o
  // valor é decidido pela aplicação. Um `DEFAULT now()` em
  // `ultima_atividade_em` faria o backend PARECER aplicar `D-2.3D-04` enquanto
  // o banco preenchesse sozinho. Esta prova impede que um default apareça por
  // conveniência numa migration futura sem passar por decisão.
  it("o catálogo confirma NOT NULL e ausência de default nas duas colunas", async () => {
    const linhas = await prisma.$queryRaw<
      Array<{ column_name: string; is_nullable: string; column_default: string | null }>
    >`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessao_autenticacao'
        AND column_name IN ('token_hash', 'ultima_atividade_em')
      ORDER BY column_name
    `;
    expect(linhas).toHaveLength(2);
    for (const coluna of linhas) {
      expect(coluna.is_nullable).toBe("NO");
      expect(coluna.column_default).toBeNull();
    }
    // `criada_em` mantém o default homologado de `E-06` — o contraste prova
    // que a ausência acima é deliberada, não um efeito colateral da migration.
    const criadaEm = await prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessao_autenticacao'
        AND column_name = 'criada_em'
    `;
    expect(criadaEm[0]?.column_default).toBe("CURRENT_TIMESTAMP");
  });
});
