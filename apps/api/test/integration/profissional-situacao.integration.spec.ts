// TechLab Fisio — fluxo interno `profissional.situacao.alterada` ponta a
// ponta contra PostgreSQL REAL (Etapa 2.3B).
//
// Caminho provado: application layer (ProfissionalService, resolvido do
// container Nest real) → DatabaseService → cliente real (fábrica pública)
// → role de runtime (tlf_app) → PostgreSQL 18 → `profissional` →
// AuditContextValidator → `evento_auditoria`.
//
// Propriedades medidas (não mockadas):
//   - mutação + evento de auditoria na MESMA transação (commit conjunto);
//   - falha do AuditWriter → ROLLBACK integral da mutação;
//   - falha da mutação → ZERO evento;
//   - idempotência/duplicidade: repetição e estado já vigente rejeitados
//     sem novo evento; concorrência → exatamente um vencedor e um evento;
//   - campos do evento conforme D-AUD-01/02/03 + whitelist vazia (D-AUD-07):
//     contexto NULL, justificativa NULL, resultado SUCESSO, correlacao_id
//     único por operação.
//
// Fixtures 100% sintéticas; limpeza determinística entre testes (setup-db).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

import { AppModule } from "../../src/app.module.js";
import { ErroContextoAuditoria } from "../../src/audit/audit-context.validator.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import { DatabaseService } from "../../src/database/database.service.js";
import {
  ErroSituacaoProfissional,
  ProfissionalService,
} from "../../src/profissional/profissional.service.js";

let moduleRef: TestingModule;
let app: INestApplication;
let database: DatabaseService;
let profissionalService: ProfissionalService;
let auditWriter: AuditWriter;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  database = moduleRef.get(DatabaseService);
  profissionalService = moduleRef.get(ProfissionalService);
  auditWriter = moduleRef.get(AuditWriter);
});

afterAll(async () => {
  await app.close();
});

interface Fixtures {
  atorId: string;
  profissionalId: string;
}

async function criarFixtures(opcoes?: {
  atorAtivo?: boolean;
  profissionalAtivo?: boolean;
}): Promise<Fixtures> {
  const sufixo = randomUUID().slice(0, 8);
  return database.transacao(async (tx) => {
    const ator = await tx.usuario.create({
      data: {
        email: `ator-23b-${sufixo}@sintetico.local`,
        senhaHash: "hash-sintetico-23b",
        nome: "Ator Sintético 2.3B",
        ativo: opcoes?.atorAtivo ?? true,
      },
    });
    const profissional = await tx.profissional.create({
      data: {
        nome: "Profissional Sintético 2.3B",
        ativo: opcoes?.profissionalAtivo ?? true,
      },
    });
    return { atorId: ator.id, profissionalId: profissional.id };
  });
}

async function lerProfissional(id: string) {
  return database.transacao(async (tx) =>
    tx.profissional.findUniqueOrThrow({
      where: { id },
      select: { ativo: true, inativadoEm: true },
    }),
  );
}

async function lerEventos() {
  return database.transacao(async (tx) =>
    tx.eventoAuditoria.findMany({ orderBy: { criadoEm: "asc" } }),
  );
}

describe("fluxo feliz — mutação + evento atômicos", () => {
  it("inativação: 1 mutação + exatamente 1 evento com os campos homologados", async () => {
    const { atorId, profissionalId } = await criarFixtures();

    const resultado = await profissionalService.alterarSituacao({
      profissionalId,
      atorUsuarioId: atorId,
      ativo: false,
    });
    expect(resultado.profissionalId).toBe(profissionalId);
    expect(resultado.ativo).toBe(false);

    const profissional = await lerProfissional(profissionalId);
    expect(profissional.ativo).toBe(false);
    expect(profissional.inativadoEm).toBeInstanceOf(Date);

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    const evento = eventos[0];
    expect(evento).toMatchObject({
      acao: "profissional.situacao.alterada",
      alvoTipo: "profissional",
      alvoId: profissionalId,
      atorUsuarioId: atorId,
      resultado: "SUCESSO",
      justificativa: null,
      contexto: null, // whitelist VAZIA — nada de ativo_anterior/ativo_novo
      correlacaoId: resultado.correlacaoId,
    });
    expect(evento?.ocorridoEm).toBeInstanceOf(Date);
  });

  it("reativação: situação volta a ativa, inativadoEm limpo, 1 evento próprio", async () => {
    const { atorId, profissionalId } = await criarFixtures({
      profissionalAtivo: false,
    });

    const resultado = await profissionalService.alterarSituacao({
      profissionalId,
      atorUsuarioId: atorId,
      ativo: true,
    });

    const profissional = await lerProfissional(profissionalId);
    expect(profissional.ativo).toBe(true);
    expect(profissional.inativadoEm).toBeNull();

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.correlacaoId).toBe(resultado.correlacaoId);
  });

  it("operações distintas geram correlacao_id distintos", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    const inativacao = await profissionalService.alterarSituacao({
      profissionalId,
      atorUsuarioId: atorId,
      ativo: false,
    });
    const reativacao = await profissionalService.alterarSituacao({
      profissionalId,
      atorUsuarioId: atorId,
      ativo: true,
    });
    expect(inativacao.correlacaoId).not.toBe(reativacao.correlacaoId);
    const eventos = await lerEventos();
    expect(eventos).toHaveLength(2);
  });
});

describe("rejeições de integridade — nenhuma mutação, ZERO evento", () => {
  it("profissional inexistente", async () => {
    const { atorId } = await criarFixtures();
    await expect(
      profissionalService.alterarSituacao({
        profissionalId: randomUUID(),
        atorUsuarioId: atorId,
        ativo: false,
      }),
    ).rejects.toMatchObject({ motivo: "PROFISSIONAL_INEXISTENTE" });
    expect(await lerEventos()).toHaveLength(0);
  });

  it("ator inexistente — profissional intocado", async () => {
    const { profissionalId } = await criarFixtures();
    await expect(
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: randomUUID(),
        ativo: false,
      }),
    ).rejects.toMatchObject({ motivo: "ATOR_INEXISTENTE" });
    expect((await lerProfissional(profissionalId)).ativo).toBe(true);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("ator inativo — profissional intocado (integridade, não autorização)", async () => {
    const { atorId, profissionalId } = await criarFixtures({ atorAtivo: false });
    await expect(
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: atorId,
        ativo: false,
      }),
    ).rejects.toBeInstanceOf(ErroSituacaoProfissional);
    expect((await lerProfissional(profissionalId)).ativo).toBe(true);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("estado já desejado é rejeitado sem evento", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    await expect(
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: atorId,
        ativo: true, // já é ativo
      }),
    ).rejects.toMatchObject({ motivo: "SITUACAO_JA_VIGENTE" });
    expect(await lerEventos()).toHaveLength(0);
  });

  it("repetição da mesma inativação: segunda rejeitada, ainda exatamente 1 evento", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    await profissionalService.alterarSituacao({
      profissionalId,
      atorUsuarioId: atorId,
      ativo: false,
    });
    await expect(
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: atorId,
        ativo: false,
      }),
    ).rejects.toMatchObject({ motivo: "SITUACAO_JA_VIGENTE" });
    expect(await lerEventos()).toHaveLength(1);
  });
});

describe("concorrência — mutação condicional sob READ COMMITTED", () => {
  it("duas solicitações concorrentes para o MESMO novo estado: exatamente uma vence, 1 evento", async () => {
    const { atorId, profissionalId } = await criarFixtures();

    const resultados = await Promise.allSettled([
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: atorId,
        ativo: false,
      }),
      profissionalService.alterarSituacao({
        profissionalId,
        atorUsuarioId: atorId,
        ativo: false,
      }),
    ]);

    const vitorias = resultados.filter((r) => r.status === "fulfilled");
    const derrotas = resultados.filter((r) => r.status === "rejected");
    expect(vitorias).toHaveLength(1);
    expect(derrotas).toHaveLength(1);
    const derrota = derrotas[0] as PromiseRejectedResult;
    expect(derrota.reason).toMatchObject({ motivo: "SITUACAO_JA_VIGENTE" });

    expect((await lerProfissional(profissionalId)).ativo).toBe(false);
    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1); // nenhum evento duplicado
  });
});

describe("atomicidade REAL — commit e rollback no PostgreSQL", () => {
  it("falha do AuditWriter (contexto proibido) → ROLLBACK integral da mutação", async () => {
    const { atorId, profissionalId } = await criarFixtures();

    await expect(
      database.transacao(async (tx) => {
        // Mesma forma de mutação do fluxo real...
        const mutacao = await tx.profissional.updateMany({
          where: { id: profissionalId, ativo: true },
          data: { ativo: false, inativadoEm: new Date() },
        });
        expect(mutacao.count).toBe(1);
        // ...seguida de auditoria REJEITADA pela política (whitelist vazia):
        await auditWriter.registrar(tx, {
          acao: "profissional.situacao.alterada",
          ocorridoEm: new Date(),
          atorUsuarioId: atorId,
          alvoTipo: "profissional",
          alvoId: profissionalId,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
          contexto: { ativo_anterior: true, ativo_novo: false },
        });
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);

    // A mutação foi DESFEITA pelo banco — não por mock.
    expect((await lerProfissional(profissionalId)).ativo).toBe(true);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("falha do AuditWriter (ação desconhecida) → ROLLBACK integral da mutação", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    await expect(
      database.transacao(async (tx) => {
        await tx.profissional.updateMany({
          where: { id: profissionalId, ativo: true },
          data: { ativo: false, inativadoEm: new Date() },
        });
        await auditWriter.registrar(tx, {
          acao: "acao.fora.do.catalogo",
          ocorridoEm: new Date(),
          atorUsuarioId: atorId,
          alvoTipo: "profissional",
          alvoId: profissionalId,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
        });
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    expect((await lerProfissional(profissionalId)).ativo).toBe(true);
    expect(await lerEventos()).toHaveLength(0);
  });

  it("falha da mutação (após evento na mesma transação) → ZERO evento persiste", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    await expect(
      database.transacao(async (tx) => {
        await auditWriter.registrar(tx, {
          acao: "profissional.situacao.alterada",
          ocorridoEm: new Date(),
          atorUsuarioId: atorId,
          alvoTipo: "profissional",
          alvoId: profissionalId,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
        });
        // Mutação inválida: FK inexistente força erro do banco → rollback.
        await tx.profissional.update({
          where: { id: profissionalId },
          data: { usuarioId: randomUUID() },
        });
      }),
    ).rejects.toThrow();
    expect(await lerEventos()).toHaveLength(0);
  });

  it("AuditWriter dentro da transação COMMITA quando a política aceita", async () => {
    const { atorId, profissionalId } = await criarFixtures();
    const correlacaoId = randomUUID();
    await database.transacao(async (tx) =>
      auditWriter.registrar(tx, {
        acao: "profissional.situacao.alterada",
        ocorridoEm: new Date(),
        atorUsuarioId: atorId,
        alvoTipo: "profissional",
        alvoId: profissionalId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
      }),
    );
    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.correlacaoId).toBe(correlacaoId);
  });
});
