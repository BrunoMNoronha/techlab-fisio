// TechLab Fisio — testes unitários da validação de `PUT /clinica`
// (fatia CFG-001A; `docs/14` D-CFG-03, D-CFG-04, D-CFG-07).

import { describe, expect, it } from "@jest/globals";

import {
  ehEmailEstruturalmenteValido,
  ehFusoHorarioValido,
  LIMITES_CLINICA,
  validarCorpoAtualizarClinica,
} from "../src/clinica/clinica.dto.js";

function corpoValido(): Record<string, unknown> {
  return {
    nomeCadastral: "Clínica Sintética Ltda.",
    nomeOperacional: "Clínica Sintética",
    endereco: "Rua Sintética, 100",
    telefone: "(11) 0000-0000",
    email: "contato@clinica.exemplo",
    fusoHorario: "America/Sao_Paulo",
  };
}

function valido(corpo: unknown) {
  const r = validarCorpoAtualizarClinica(corpo);
  if (!r.valido) throw new Error("esperado válido");
  return r.valor;
}

function invalido(corpo: unknown): void {
  expect(validarCorpoAtualizarClinica(corpo).valido).toBe(false);
}

describe("D-CFG-03 — corpo estrito", () => {
  it("aceita o corpo com exatamente as 6 chaves", () => {
    expect(valido(corpoValido())).toEqual(corpoValido());
  });

  it.each([null, undefined, "texto", 42, true, [], [corpoValido()]])("rejeita corpo não objeto: %p", (corpo) => {
    invalido(corpo);
  });

  it.each(["nomeCadastral", "nomeOperacional", "endereco", "telefone", "email", "fusoHorario"])(
    "rejeita chave ausente: %s",
    (chave) => {
      const corpo = corpoValido();
      delete corpo[chave];
      invalido(corpo);
    },
  );

  it.each(["id", "criadoEm", "logotipoChave", "duracaoPadraoAtendimentoMin", "atorUsuarioId", "clinicaId"])(
    "rejeita chave extra (mass assignment): %s",
    (chave) => {
      invalido({ ...corpoValido(), [chave]: "123e4567-e89b-12d3-a456-426614174000" });
    },
  );

  it("rejeita chave com grafia diferente (case-sensitive) mesmo com a contagem correta", () => {
    const corpo = corpoValido();
    delete corpo["email"];
    corpo["Email"] = "contato@clinica.exemplo";
    invalido(corpo);
  });

  it("rejeita objeto com protótipo não plano", () => {
    class Falso {
      nomeCadastral = "x";
    }
    invalido(Object.assign(new Falso(), corpoValido()));
  });
});

describe("D-CFG-04 — sem coerção de tipos", () => {
  it.each([
    ["nomeCadastral", 123],
    ["nomeCadastral", null],
    ["nomeOperacional", 1],
    ["endereco", true],
    ["telefone", 11999999999],
    ["email", ["a@b.c"]],
    ["fusoHorario", null],
    ["fusoHorario", { id: "UTC" }],
  ])("rejeita %s com valor %p", (chave, valor) => {
    invalido({ ...corpoValido(), [chave]: valor });
  });
});

describe("D-CFG-04 — normalização e limites", () => {
  it("aplica trim em todos os textos", () => {
    const v = valido({
      nomeCadastral: "  Clínica  ",
      nomeOperacional: " Op ",
      endereco: " Rua ",
      telefone: " 11 ",
      email: " a@b.co ",
      fusoHorario: " UTC ",
    });
    expect(v).toEqual({
      nomeCadastral: "Clínica",
      nomeOperacional: "Op",
      endereco: "Rua",
      telefone: "11",
      email: "a@b.co",
      fusoHorario: "UTC",
    });
  });

  it("opcionais vazios ou só espaços viram null; null permanece null", () => {
    const v = valido({ ...corpoValido(), nomeOperacional: "", endereco: "   ", telefone: null, email: " " });
    expect(v.nomeOperacional).toBeNull();
    expect(v.endereco).toBeNull();
    expect(v.telefone).toBeNull();
    expect(v.email).toBeNull();
  });

  it.each(["", "   "])("nomeCadastral vazio é rejeitado: %p", (nome) => {
    invalido({ ...corpoValido(), nomeCadastral: nome });
  });

  it.each([
    ["nomeCadastral", LIMITES_CLINICA.NOME_CADASTRAL],
    ["nomeOperacional", LIMITES_CLINICA.NOME_OPERACIONAL],
    ["endereco", LIMITES_CLINICA.ENDERECO],
    ["telefone", LIMITES_CLINICA.TELEFONE],
  ])("%s aceita exatamente %i caracteres e rejeita um a mais", (chave, limite) => {
    valido({ ...corpoValido(), [chave]: "a".repeat(limite) });
    invalido({ ...corpoValido(), [chave]: "a".repeat(limite + 1) });
  });

  it("limite é medido após o trim", () => {
    valido({ ...corpoValido(), nomeCadastral: `  ${"a".repeat(LIMITES_CLINICA.NOME_CADASTRAL)}  ` });
  });

  it("email aceita 254 caracteres e rejeita 255", () => {
    const dominio = "@clinica.exemplo";
    valido({ ...corpoValido(), email: "a".repeat(LIMITES_CLINICA.EMAIL - dominio.length) + dominio });
    invalido({ ...corpoValido(), email: "a".repeat(LIMITES_CLINICA.EMAIL + 1 - dominio.length) + dominio });
  });

  it("telefone é texto livre", () => {
    expect(valido({ ...corpoValido(), telefone: "ramal 12 / recepção" }).telefone).toBe("ramal 12 / recepção");
  });
});

describe("D-CFG-04-A — predicado exato do e-mail", () => {
  it.each(["a@b.co", "a@b.c", "contato@clinica.exemplo", "x.y+z@sub.dominio.com.br"])("aceita %s", (e) => {
    expect(ehEmailEstruturalmenteValido(e)).toBe(true);
  });

  it.each(["semarroba", "a@b", "@dominio.com", "local@", "a@@b.com", "a@b@c.com", "a@dominio", "a@.com", "a@dominio.", "a b@c.com"])(
    "rejeita %s",
    (e) => {
      expect(ehEmailEstruturalmenteValido(e)).toBe(false);
      invalido({ ...corpoValido(), email: e });
    },
  );
});

describe("D-CFG-04 — fuso IANA case-sensitive, UTC aceito", () => {
  it.each(["UTC", "America/Sao_Paulo", "America/Manaus", "Europe/Lisbon"])("aceita %s", (fuso) => {
    expect(ehFusoHorarioValido(fuso)).toBe(true);
    expect(valido({ ...corpoValido(), fusoHorario: fuso }).fusoHorario).toBe(fuso);
  });

  it.each(["", "   ", "Foo/Bar", "-03:00", "GMT-3", "america/sao_paulo", "AMERICA/SAO_PAULO", "utc"])(
    "rejeita %p",
    (fuso) => {
      invalido({ ...corpoValido(), fusoHorario: fuso });
    },
  );
});
