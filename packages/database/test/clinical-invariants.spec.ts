// TechLab Fisio — E-14 — T-CLIN-01..T-CLIN-03 — integridade clínica estrutural.
//
// Fontes: docs/07 §7.6 (P-CLIN Alternativa A homologada), §10.1 U-13/IDX-N2,
// §8 (`Registro clínico → Anexo clínico`); docs/08 §14.
//
// Dados clínicos MÍNIMOS e totalmente sintéticos: nenhum conteúdo clínico é
// modelado nesta etapa (P2.2-07 pendente) e nenhum é inventado aqui — os
// registros carregam apenas as colunas estruturais existentes no schema.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { identificarViolacao } from "../src/errors/constraint-map.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { criarClienteApp } from "./helpers/db.js";
import { capturarErro, extrairSqlstate } from "./helpers/erros.js";
import { criarAgendamento, criarBaseSintetica, type BaseSintetica } from "./helpers/fixtures.js";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function criarAtendimentoSintetico(base: BaseSintetica) {
  const agendamento = await criarAgendamento(prisma, base, {
    pacienteId: base.paciente1Id,
    inicio: "2026-09-02T13:00:00Z",
    fim: "2026-09-02T14:00:00Z",
  });
  return prisma.atendimento.create({
    data: {
      agendamentoId: agendamento.id,
      pacienteId: base.paciente1Id,
      iniciadoEm: new Date("2026-09-02T13:05:00Z"),
    },
  });
}

describe("T-CLIN-01 — registro_clinico.atendimento_id NOT NULL (U-13/P-CLIN)", () => {
  it("rejeita fisicamente registro clínico sem atendimento", async () => {
    const base = await criarBaseSintetica(prisma);
    // O Prisma Client já exige `atendimentoId` no tipo; a prova FÍSICA da
    // coluna NOT NULL exige SQL cru com NULL explícito.
    const erro = await capturarErro(() =>
      prisma.$executeRaw`
        INSERT INTO "registro_clinico"
          ("id", "atendimento_id", "paciente_id", "autor_usuario_id", "estado", "criado_em")
        VALUES
          (gen_random_uuid(), NULL, ${base.paciente1Id}::uuid, ${base.usuarioId}::uuid,
           'EM_ELABORACAO', now())
      `,
    );
    // 23502 = not_null_violation — classe deliberadamente fora do
    // constraint-map (que só cobre as quatro classes medidas em V-03).
    expect(extrairSqlstate(erro)).toBe("23502");

    const total = await prisma.registroClinico.count();
    expect(total).toBe(0);
  });
});

describe("T-CLIN-02 — um único registro clínico por atendimento (U-13/IDX-N2)", () => {
  it("rejeita o segundo registro para o mesmo atendimento", async () => {
    const base = await criarBaseSintetica(prisma);
    const atendimento = await criarAtendimentoSintetico(base);

    const primeiro = await prisma.registroClinico.create({
      data: {
        atendimentoId: atendimento.id,
        pacienteId: base.paciente1Id,
        autorUsuarioId: base.usuarioId,
        estado: "EM_ELABORACAO",
      },
    });

    const erro = await capturarErro(() =>
      prisma.registroClinico.create({
        data: {
          atendimentoId: atendimento.id,
          pacienteId: base.paciente1Id,
          autorUsuarioId: base.usuarioId,
          estado: "EM_ELABORACAO",
        },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.modelo).toBe("RegistroClinico");
    expect(v?.camposUnique).toEqual(["atendimento_id"]);

    const registros = await prisma.registroClinico.findMany({
      where: { atendimentoId: atendimento.id },
    });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.id).toBe(primeiro.id);
  });
});

describe("T-CLIN-03 — anexo_clinico exige FK para registro_clinico (PRN-006)", () => {
  it("rejeita anexo referenciando registro clínico inexistente", async () => {
    const base = await criarBaseSintetica(prisma);
    const erro = await capturarErro(() =>
      prisma.anexoClinico.create({
        data: {
          registroClinicoId: randomUUID(), // registro inexistente
          pacienteId: base.paciente1Id,
          chaveObjeto: "sintetico/anexo-e14",
          nomeOriginal: "anexo-sintetico.txt",
          mimeType: "text/plain",
          tamanhoBytes: 1,
          enviadoPorUsuarioId: base.usuarioId,
        },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("FOREIGN_KEY");
    expect(v?.sqlstate).toBe("23503");
    expect(v?.constraint).toBe("anexo_clinico_registro_clinico_id_fkey");

    const total = await prisma.anexoClinico.count();
    expect(total).toBe(0);
  });
});
