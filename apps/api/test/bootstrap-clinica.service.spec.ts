// TechLab Fisio — validação de entrada do provisionamento da clínica
// (fatia CFG-001B; `docs/14` D-CFG-04, D-CFG-09, D-CFG-11).
//
// A validação ocorre ANTES de qualquer acesso ao banco: os colaboradores são
// dublês que falham se tocados.

import { describe, expect, it } from "@jest/globals";

import type { AuditWriter } from "../src/audit/audit-writer.js";
import type { DatabaseService } from "../src/database/database.service.js";
import {
  BootstrapClinicaService,
  ErroBootstrapClinica,
  type ComandoBootstrapClinica,
} from "../src/provisionamento/bootstrap-clinica.service.js";

const intocavel = new Proxy(
  {},
  {
    get() {
      throw new Error("colaborador tocado antes da validação");
    },
  },
);

const servico = new BootstrapClinicaService(
  intocavel as DatabaseService,
  intocavel as AuditWriter,
);

function comando(sobrescrever: Partial<Record<keyof ComandoBootstrapClinica, unknown>> = {}) {
  return {
    nomeCadastral: "Clínica Sintética",
    fusoHorario: "America/Sao_Paulo",
    justificativa: "chamado SINTETICO-CFG-001B",
    ...sobrescrever,
  } as ComandoBootstrapClinica;
}

async function motivo(c: ComandoBootstrapClinica): Promise<string> {
  try {
    await servico.executar(c);
  } catch (erro) {
    if (erro instanceof ErroBootstrapClinica) return erro.motivo;
    throw erro;
  }
  throw new Error("esperada recusa");
}

describe("CFG-001B — validação antes do banco", () => {
  it.each([
    ["nomeCadastral vazio", { nomeCadastral: "   " }, "NOME_CADASTRAL_INVALIDO"],
    ["nomeCadastral não string", { nomeCadastral: 42 }, "NOME_CADASTRAL_INVALIDO"],
    ["nomeCadastral acima de 200", { nomeCadastral: "a".repeat(201) }, "NOME_CADASTRAL_INVALIDO"],
    ["nomeCadastral acima de 200 em code points", { nomeCadastral: "😀".repeat(201) }, "NOME_CADASTRAL_INVALIDO"],
    ["fuso inexistente", { fusoHorario: "Foo/Bar" }, "FUSO_HORARIO_INVALIDO"],
    ["fuso em caixa errada", { fusoHorario: "america/sao_paulo" }, "FUSO_HORARIO_INVALIDO"],
    ["fuso como offset", { fusoHorario: "-03:00" }, "FUSO_HORARIO_INVALIDO"],
    ["justificativa vazia", { justificativa: "  " }, "JUSTIFICATIVA_AUSENTE"],
    ["justificativa não string", { justificativa: null }, "JUSTIFICATIVA_AUSENTE"],
    ["justificativa com LF", { justificativa: "linha1\nlinha2" }, "JUSTIFICATIVA_INVALIDA"],
    ["justificativa com NUL", { justificativa: "a\u0000b" }, "JUSTIFICATIVA_INVALIDA"],
  ])("%s -> %s", async (_rotulo, sobrescrever, esperado) => {
    expect(await motivo(comando(sobrescrever))).toBe(esperado);
  });

  it("a mensagem do erro não contém valores de entrada", async () => {
    try {
      await servico.executar(comando({ nomeCadastral: "", justificativa: "SEGREDO-OPERACIONAL" }));
    } catch (erro) {
      expect(String((erro as Error).message)).not.toContain("SEGREDO-OPERACIONAL");
    }
  });

  it("nomeCadastral com exatamente 200 caracteres e links IANA passam da validação (tocam o banco)", async () => {
    for (const c of [
      comando({ nomeCadastral: "a".repeat(200) }),
      comando({ fusoHorario: "UTC" }),
      comando({ fusoHorario: "US/Eastern" }),
    ]) {
      await expect(servico.executar(c)).rejects.toThrow("colaborador tocado antes da validação");
    }
  });
});
