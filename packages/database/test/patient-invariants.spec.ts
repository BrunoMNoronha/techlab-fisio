// TechLab Fisio — E-14 — T-CPF-01..T-CPF-04 — identidade do paciente.
//
// Fontes: docs/07 §11.4 (H2.2-13 homologada), §10.1 U-07, §10.2 (CHECK
// `ck_paciente_cpf_formato`); docs/08 §14. Sem mocks: todas as violações são
// provocadas no PostgreSQL real via Prisma Client + adapter-pg como `tlf_app`.
//
// T-CPF-03 (formato): a borda "menos de 11 caracteres" já possui prova
// permanente em constraint-errors.spec.ts (E-12: cpf "123" → 23514
// ck_paciente_cpf_formato) e é REUTILIZADA na matriz da E-14 — não duplicada.
// Este spec complementa as bordas restantes: mais de 11 dígitos, caractere não
// numérico e valor mascarado (não normalizado).
//
// CPFs exclusivamente sintéticos: apenas a forma de 11 dígitos interessa à
// persistência (docs/07 §11.4.1); dígito verificador é regra de aplicação e
// NÃO é testado aqui.

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { identificarViolacao } from "../src/errors/constraint-map.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { criarClienteApp } from "./helpers/db.js";
import { capturarErro } from "./helpers/erros.js";

const CPF_SINTETICO_A = "12345678901";
const CPF_SINTETICO_B = "10987654321";

let prisma: PrismaClient;

beforeAll(() => {
  prisma = criarClienteApp();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("T-CPF-01 — CPF normalizado é único (U-07, H2.2-13)", () => {
  it("rejeita a segunda identidade com o mesmo CPF normalizado", async () => {
    await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-01A", ativo: true, cpf: CPF_SINTETICO_A },
    });
    const erro = await capturarErro(() =>
      prisma.paciente.create({
        data: { nome: "Paciente Sintético CPF-01B", ativo: true, cpf: CPF_SINTETICO_A },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.modelo).toBe("Paciente");
    expect(v?.camposUnique).toEqual(["cpf"]);

    const total = await prisma.paciente.count({ where: { cpf: CPF_SINTETICO_A } });
    expect(total).toBe(1);
  });
});

describe("T-CPF-02 — CPF nulo permitido, múltiplas vezes (RN-010, §10.1)", () => {
  it("permite a coexistência de vários pacientes sem CPF", async () => {
    const p1 = await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-02A", ativo: true },
    });
    const p2 = await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-02B", ativo: true },
    });
    const p3 = await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-02C", ativo: false, inativadoEm: new Date() },
    });
    const semCpf = await prisma.paciente.findMany({
      where: { id: { in: [p1.id, p2.id, p3.id] } },
    });
    expect(semCpf).toHaveLength(3);
    for (const paciente of semCpf) {
      expect(paciente.cpf).toBeNull();
    }
  });
});

describe("T-CPF-03 — formato fora de ^[0-9]{11}$ é rejeitado (ck_paciente_cpf_formato)", () => {
  // Borda "menos de 11" reutilizada de constraint-errors.spec.ts (E-12).
  const casosInvalidos: Array<{ rotulo: string; cpf: string }> = [
    { rotulo: "mais de 11 dígitos", cpf: "123456789012" },
    { rotulo: "11 caracteres com não numérico", cpf: "1234567890a" },
    { rotulo: "valor mascarado, não normalizado", cpf: "123.456.789-01" },
  ];

  it.each(casosInvalidos)("rejeita $rotulo", async ({ cpf }) => {
    const erro = await capturarErro(() =>
      prisma.paciente.create({
        data: { nome: "Paciente Sintético CPF-03", ativo: true, cpf },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("CHECK");
    expect(v?.sqlstate).toBe("23514");
    expect(v?.constraint).toBe("ck_paciente_cpf_formato");
  });

  it("aceita exatamente 11 dígitos (contraprova da CHECK)", async () => {
    const criado = await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-03V", ativo: true, cpf: CPF_SINTETICO_B },
    });
    expect(criado.cpf).toBe(CPF_SINTETICO_B);
  });
});

describe("T-CPF-04 — paciente inativo continua ocupando o CPF (§11.4.2)", () => {
  it("rejeita nova identidade com CPF de paciente inativado", async () => {
    const original = await prisma.paciente.create({
      data: { nome: "Paciente Sintético CPF-04", ativo: true, cpf: CPF_SINTETICO_A },
    });

    // Inativação conforme o modelo físico (RN-007: ativo + inativado_em).
    await prisma.paciente.update({
      where: { id: original.id },
      data: { ativo: false, inativadoEm: new Date() },
    });

    const erro = await capturarErro(() =>
      prisma.paciente.create({
        data: { nome: "Paciente Sintético CPF-04B", ativo: true, cpf: CPF_SINTETICO_A },
      }),
    );
    const v = identificarViolacao(erro);
    expect(v?.classe).toBe("UNIQUE");
    expect(v?.sqlstate).toBe("23505");
    expect(v?.camposUnique).toEqual(["cpf"]);

    // A inativação NÃO liberou o CPF: a única linha com esse CPF segue sendo a
    // identidade original, inativa.
    const donos = await prisma.paciente.findMany({ where: { cpf: CPF_SINTETICO_A } });
    expect(donos).toHaveLength(1);
    expect(donos[0]?.id).toBe(original.id);
    expect(donos[0]?.ativo).toBe(false);
    expect(donos[0]?.inativadoEm).not.toBeNull();
  });
});
