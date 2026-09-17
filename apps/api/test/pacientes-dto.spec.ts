// TechLab Fisio — testes unitários da validação de pacientes (PAC-A;
// `docs/17` D-PAC-01..D-PAC-04, D-PAC-06). Dados 100% sintéticos; os CPFs
// abaixo são números de teste com dígitos verificadores válidos.

import { describe, expect, it } from "@jest/globals";

import {
  chaveComparacaoNome,
  ehCpfValido,
  normalizarCpf,
  normalizarNomePaciente,
  validarCorpoAtualizarPaciente,
  validarCorpoBuscaPacientes,
  validarCorpoCriarPaciente,
  validarCorpoSituacaoPaciente,
  validarDataCivil,
} from "../src/pacientes/pacientes.dto.js";
import { resolverEscopoPacientes } from "../src/pacientes/pacientes.service.js";

const CPF_A = "52998224725";
const CPF_B = "11144477735";

const base = {
  nome: "Maria Sintética",
  dataNascimento: "1990-05-17",
  cpf: null,
  telefone: null,
  email: null,
};

describe("D-PAC-01 — CPF", () => {
  it("aceita dígitos e máscara, devolve só dígitos", () => {
    expect(normalizarCpf(CPF_A)).toBe(CPF_A);
    expect(normalizarCpf("529.982.247-25")).toBe(CPF_A);
    expect(normalizarCpf(" 111.444.777-35 ")).toBe(CPF_B);
  });

  it("vazio e null viram null", () => {
    expect(normalizarCpf(null)).toBeNull();
    expect(normalizarCpf("")).toBeNull();
    expect(normalizarCpf("   ")).toBeNull();
  });

  it.each([
    ["DV inválido", "52998224726"],
    ["sequência repetida", "111.111.111-11"],
    ["10 dígitos", "5299822472"],
    ["máscara parcial", "529982247-25"],
    ["letras", "5299822472a"],
    ["número JSON", 52998224725],
  ])("rejeita %s", (_rotulo, valor) => {
    expect(normalizarCpf(valor)).toBeUndefined();
  });

  it("ehCpfValido rejeita todas as sequências repetidas", () => {
    for (let d = 0; d <= 9; d++) expect(ehCpfValido(String(d).repeat(11))).toBe(false);
  });
});

describe("D-PAC-01 — nome e data", () => {
  it("nome: trim e espaços internos colapsados; controle rejeitado", () => {
    expect(normalizarNomePaciente("  Maria   da  Silva ")).toBe("Maria da Silva");
    expect(normalizarNomePaciente("Maria\tSilva")).toBeUndefined();
    expect(normalizarNomePaciente("   ")).toBeUndefined();
    expect(normalizarNomePaciente("a".repeat(201))).toBeUndefined();
    expect(normalizarNomePaciente("a".repeat(200))).toBe("a".repeat(200));
  });

  it("data civil válida no gregoriano e >= 1900-01-01", () => {
    expect(validarDataCivil("2024-02-29")).toBe("2024-02-29");
    expect(validarDataCivil("1900-01-01")).toBe("1900-01-01");
    expect(validarDataCivil("2023-02-29")).toBeUndefined();
    expect(validarDataCivil("1899-12-31")).toBeUndefined();
    expect(validarDataCivil("1990-5-17")).toBeUndefined();
    expect(validarDataCivil("1990-05-17T00:00:00Z")).toBeUndefined();
  });

  it("chave de comparação ignora caixa, acentos e espaços extras (D-PAC-03)", () => {
    expect(chaveComparacaoNome("  JOÃO   Conceição ")).toBe(chaveComparacaoNome("joao conceicao"));
    expect(chaveComparacaoNome("Maria")).not.toBe(chaveComparacaoNome("Mario"));
  });
});

describe("D-PAC-02 — corpos estritos", () => {
  it("criação válida", () => {
    const r = validarCorpoCriarPaciente({
      ...base,
      cpf: "529.982.247-25",
      telefone: " (11) 90000-0000 ",
      email: "  a@b.co ",
      confirmarPossivelDuplicidade: false,
    });
    expect(r).toEqual({
      valido: true,
      valor: {
        dados: { ...base, cpf: CPF_A, telefone: "(11) 90000-0000", email: "a@b.co" },
        confirmarPossivelDuplicidade: false,
      },
    });
  });

  it.each([
    ["sem confirmarPossivelDuplicidade", { ...base }],
    ["confirmação não booleana", { ...base, confirmarPossivelDuplicidade: "true" }],
    ["chave extra", { ...base, confirmarPossivelDuplicidade: false, ativo: true }],
    ["dataNascimento null (obrigatória na API)", { ...base, dataNascimento: null, confirmarPossivelDuplicidade: false }],
    ["e-mail inválido", { ...base, email: "a@b", confirmarPossivelDuplicidade: false }],
    ["telefone > 32", { ...base, telefone: "1".repeat(33), confirmarPossivelDuplicidade: false }],
    ["corpo array", [base]],
    ["corpo null", null],
  ])("criação rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoCriarPaciente(corpo).valido).toBe(false);
  });

  it("edição não aceita confirmarPossivelDuplicidade nem ativo", () => {
    expect(validarCorpoAtualizarPaciente(base).valido).toBe(true);
    expect(validarCorpoAtualizarPaciente({ ...base, confirmarPossivelDuplicidade: true }).valido).toBe(false);
    expect(validarCorpoAtualizarPaciente({ ...base, ativo: true }).valido).toBe(false);
  });

  it("situação exige exatamente { ativo: boolean }", () => {
    expect(validarCorpoSituacaoPaciente({ ativo: false })).toEqual({ valido: true, valor: { ativo: false } });
    expect(validarCorpoSituacaoPaciente({ ativo: "false" }).valido).toBe(false);
    expect(validarCorpoSituacaoPaciente({ ativo: true, motivo: "x" }).valido).toBe(false);
  });
});

describe("D-PAC-04 — busca", () => {
  const vazio = { nome: null, cpf: null, dataNascimento: null, ativo: null };

  it("aceita cada filtro isolado e normaliza", () => {
    expect(validarCorpoBuscaPacientes({ ...vazio, nome: "  mar  " })).toEqual({
      valido: true,
      valor: { ...vazio, nome: "mar" },
    });
    expect(validarCorpoBuscaPacientes({ ...vazio, cpf: "529.982.247-25" })).toEqual({
      valido: true,
      valor: { ...vazio, cpf: CPF_A },
    });
    expect(validarCorpoBuscaPacientes({ ...vazio, dataNascimento: "1990-05-17", ativo: false }).valido).toBe(true);
  });

  it.each([
    ["nenhum filtro principal", { ...vazio }],
    ["só ativo", { ...vazio, ativo: true }],
    ["nome com 2 caracteres", { ...vazio, nome: "ma" }],
    ["cpf vazio", { ...vazio, cpf: "" }],
    ["cpf inválido", { ...vazio, cpf: "123" }],
    ["data inválida", { ...vazio, dataNascimento: "1990-02-30" }],
    ["ativo textual", { ...vazio, nome: "maria", ativo: "true" }],
    ["chave ausente", { nome: "maria", cpf: null, dataNascimento: null }],
    ["chave extra", { ...vazio, nome: "maria", telefone: "1" }],
  ])("rejeita %s", (_rotulo, corpo) => {
    expect(validarCorpoBuscaPacientes(corpo).valido).toBe(false);
  });
});

describe("D-PAC-06 — escopo por código de papel (fail-closed)", () => {
  it.each([
    [["ADMINISTRADOR"], "OPERACIONAL"],
    [["RECEPCIONISTA"], "OPERACIONAL"],
    [["RECEPCIONISTA", "FISIOTERAPEUTA"], "OPERACIONAL"],
    [["ADMINISTRADOR", "GESTOR"], "OPERACIONAL"],
    [["FISIOTERAPEUTA"], "RELACIONADO"],
    [["GESTOR", "FISIOTERAPEUTA"], "RELACIONADO"],
    [["GESTOR"], "NEGADO"],
    [["papel-customizado"], "RELACIONADO"],
    [[], "RELACIONADO"],
  ])("papéis %j → %s", (papeis, esperado) => {
    expect(resolverEscopoPacientes(papeis)).toBe(esperado);
  });
});
