// TechLab Fisio — Etapa 2.3D-B / F1 — `CredencialService`.
//
// Prova `D-2.3D-02` (`docs/12` §5.2) contra o Argon2 REAL — nenhum mock do
// `argon2`: mockar a primitiva criptográfica esvaziaria exatamente a prova que
// esta fatia precisa dar.
//
// Todas as senhas são SINTÉTICAS (TLF-BASE-V1 §10): nenhuma senha real, nenhum
// hash de usuário real, nenhum segredo.
//
// SEM ASSERÇÃO DE TEMPO: a simetria do caminho dummy é provada de forma
// ESTRUTURAL (o `verify` acontece; o dummy não é regerado por tentativa), não
// por `duração < X ms` — comparação temporal em teste unitário é frágil e não
// prova a propriedade. `T-AUTH-ENUMERATION` ponta a ponta pertence à F3.

import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { argon2i, hash as argon2Hash } from "argon2";

import {
  CredencialService,
  ErroCredencial,
  POLITICA_ARGON2,
} from "../src/auth/credencial.service.js";

const SENHA_SINTETICA = "senha-sintetica-f1-nao-real";
const SENHA_SINTETICA_OUTRA = "outra-senha-sintetica-f1";

// Argon2 com m=19456 é deliberadamente custoso; a suíte gera poucos hashes,
// mas o default de 5 s do Jest não é suficiente com folga em CI compartilhada.
jest.setTimeout(60_000);

/**
 * Captura o erro lançado pela ação. Mesmo padrão de `capturarErro` já provado
 * em `packages/database/test/helpers/erros.ts`: a rejeição esperada DEVE
 * ocorrer — ausência de erro falha o teste em vez de passar silenciosamente.
 */
async function capturarErroCredencial(
  acao: () => Promise<unknown>,
): Promise<ErroCredencial> {
  try {
    await acao();
  } catch (erro) {
    return erro as ErroCredencial;
  }
  throw new Error("a rejeição esperada não ocorreu");
}

let servico: CredencialService;
let hashVigente: string;

beforeAll(async () => {
  servico = new CredencialService();
  hashVigente = await servico.gerarHash(SENHA_SINTETICA);
});

describe("D-2.3D-02 — forma do hash gerado", () => {
  it("produz saída no formato PHC", () => {
    // PHC: `$id$v=..$params$salt$hash` — cinco campos após o `$` inicial.
    expect(hashVigente.startsWith("$")).toBe(true);
    expect(hashVigente.split("$")).toHaveLength(6);
  });

  it("usa a variante Argon2id — nunca Argon2i nem Argon2d", () => {
    expect(hashVigente.startsWith("$argon2id$")).toBe(true);
    expect(hashVigente).not.toContain("$argon2i$");
    expect(hashVigente).not.toContain("$argon2d$");
  });

  it("registra no PHC exatamente m=19456, t=2 e p=1", () => {
    // O campo de parâmetros é o terceiro segmento; a ORDEM em que a biblioteca
    // os serializa não é contrato — por isso cada par é conferido
    // individualmente, e não por comparação de string inteira.
    const parametros = hashVigente.split("$")[3] ?? "";
    const pares = new Map(
      parametros.split(",").map((p) => {
        const [chave, valor] = p.split("=") as [string, string];
        return [chave, valor];
      }),
    );
    expect(pares.get("m")).toBe("19456");
    expect(pares.get("t")).toBe("2");
    expect(pares.get("p")).toBe("1");
  });

  it("a política aplicada é exatamente a homologada", () => {
    expect(POLITICA_ARGON2.memoryCost).toBe(19456);
    expect(POLITICA_ARGON2.timeCost).toBe(2);
    expect(POLITICA_ARGON2.parallelism).toBe(1);
  });

  it("a mesma senha gera hashes distintos — o salt é aleatório por chamada", async () => {
    const outro = await servico.gerarHash(SENHA_SINTETICA);
    expect(outro).not.toBe(hashVigente);
    // Ambos continuam verificando a MESMA senha: são hashes válidos distintos,
    // não valores corrompidos.
    expect(await servico.verificarSenha(outro, SENHA_SINTETICA)).toBe(true);
  });

  it("rejeita senha vazia com motivo de conjunto fechado, sem ecoar valor", async () => {
    await expect(servico.gerarHash("")).rejects.toBeInstanceOf(ErroCredencial);
    const erro = await capturarErroCredencial(() => servico.gerarHash(""));
    expect(erro.motivo).toBe("SENHA_INVALIDA");
    expect(erro.message).not.toContain(SENHA_SINTETICA);
  });
});

describe("D-2.3D-02 — verificação de senha", () => {
  it("senha correta verifica como verdadeiro", async () => {
    expect(await servico.verificarSenha(hashVigente, SENHA_SINTETICA)).toBe(true);
  });

  it("senha incorreta verifica como falso", async () => {
    expect(await servico.verificarSenha(hashVigente, SENHA_SINTETICA_OUTRA)).toBe(false);
    expect(await servico.verificarSenha(hashVigente, "")).toBe(false);
    expect(await servico.verificarSenha(hashVigente, `${SENHA_SINTETICA} `)).toBe(false);
  });

  it("o hash NUNCA é aceito como se fosse a senha (nenhuma comparação por igualdade)", async () => {
    // Se a verificação usasse `===` sobre o digest, passar o próprio digest
    // como senha autenticaria. Delegação ao Argon2 impede isso.
    expect(await servico.verificarSenha(hashVigente, hashVigente)).toBe(false);
  });
});

describe("D-2.3D-02 — fail-closed diante de digest malformado", () => {
  // Comportamento MEDIDO em argon2@0.45.1: parte destes casos faz `verify`
  // lançar TypeError, outra parte devolve false. Ambos DEVEM virar false aqui —
  // corrupção de credencial jamais pode virar autenticação positiva.
  const malformados: Array<[string, string]> = [
    ["cadeia vazia", ""],
    ["sem `$` inicial", "nao-e-phc"],
    ["PHC truncado, sem campo de hash", "$argon2id$v=19$m=19456,t=2,p=1"],
    ["algoritmo desconhecido", "$scrypt$x"],
    ["campos vazios", "$$$$$"],
    ["salt/hash não-base64", "$argon2id$v=19$m=19456,t=2,p=1$!!!$!!!"],
  ];

  for (const [rotulo, digest] of malformados) {
    it(`não autentica com digest malformado: ${rotulo}`, async () => {
      await expect(servico.verificarSenha(digest, SENHA_SINTETICA)).resolves.toBe(false);
    });
  }

  it("não lança para nenhum digest malformado — a exceção original é contida", async () => {
    for (const [, digest] of malformados) {
      await expect(servico.verificarSenha(digest, SENHA_SINTETICA)).resolves.toBe(false);
    }
  });
});

describe("D-2.3D-02 — rehash por defasagem de parâmetros", () => {
  it("hash com os parâmetros vigentes NÃO precisa de rehash", () => {
    expect(servico.precisaRehash(hashVigente)).toBe(false);
  });

  it("memoryCost diferente precisa de rehash", async () => {
    const antigo = await argon2Hash(SENHA_SINTETICA, {
      ...POLITICA_ARGON2,
      memoryCost: 65536,
    });
    expect(servico.precisaRehash(antigo)).toBe(true);
  });

  it("timeCost diferente precisa de rehash", async () => {
    const antigo = await argon2Hash(SENHA_SINTETICA, { ...POLITICA_ARGON2, timeCost: 3 });
    expect(servico.precisaRehash(antigo)).toBe(true);
  });

  it("parallelism diferente precisa de rehash", async () => {
    const antigo = await argon2Hash(SENHA_SINTETICA, {
      ...POLITICA_ARGON2,
      parallelism: 2,
    });
    expect(servico.precisaRehash(antigo)).toBe(true);
  });

  it("variante NÃO vigente (Argon2i) nunca é tratada como plenamente atual", async () => {
    // Fato MEDIDO: `needsRehash` de argon2@0.45.1 compara apenas m/t/p/version
    // e devolveria `false` para este digest. A verificação de variante por
    // prefixo PHC é o que impede o falso "está em dia".
    const argon2iVigenteEmParametros = await argon2Hash(SENHA_SINTETICA, {
      ...POLITICA_ARGON2,
      type: argon2i,
    });
    expect(argon2iVigenteEmParametros.startsWith("$argon2i$")).toBe(true);
    expect(servico.precisaRehash(argon2iVigenteEmParametros)).toBe(true);
  });

  it("digest malformado é fail-closed: precisa de rehash, nunca é vigente", () => {
    for (const digest of ["", "nao-e-phc", "$argon2id$", "$scrypt$x", "$argon2id$lixo"]) {
      expect(servico.precisaRehash(digest)).toBe(true);
    }
  });

  it("decidir rehash NÃO regenera nada — o serviço não possui a senha em claro", () => {
    const antes = hashVigente;
    servico.precisaRehash(hashVigente);
    expect(hashVigente).toBe(antes);
  });
});

describe("D-2.3D-02 — caminho dummy para conta inexistente", () => {
  it("ausência de hash NÃO autentica, qualquer que seja a senha", async () => {
    for (const ausente of [null, undefined, ""]) {
      expect(await servico.verificarComCaminhoDummy(ausente, SENHA_SINTETICA)).toBe(false);
      expect(await servico.verificarComCaminhoDummy(ausente, "")).toBe(false);
    }
  });

  it("o caminho ausente executa um verify Argon2 REAL contra o hash dummy", async () => {
    const espia = jest.spyOn(servico, "verificarSenha");
    try {
      const dummy = await servico.obterHashDummyParaProva();
      espia.mockClear();
      await servico.verificarComCaminhoDummy(null, SENHA_SINTETICA);
      // Exatamente uma verificação criptográfica ocorreu, e contra o dummy —
      // não um `return false` barato que puliria o trabalho do Argon2.
      expect(espia).toHaveBeenCalledTimes(1);
      expect(espia.mock.calls[0]?.[0]).toBe(dummy);
      expect(espia.mock.calls[0]?.[1]).toBe(SENHA_SINTETICA);
    } finally {
      espia.mockRestore();
    }
  });

  it("o caminho existente usa o hash recebido, não o dummy", async () => {
    const espia = jest.spyOn(servico, "verificarSenha");
    try {
      espia.mockClear();
      expect(await servico.verificarComCaminhoDummy(hashVigente, SENHA_SINTETICA)).toBe(
        true,
      );
      expect(espia).toHaveBeenCalledTimes(1);
      expect(espia.mock.calls[0]?.[0]).toBe(hashVigente);
    } finally {
      espia.mockRestore();
    }
  });

  it("o hash dummy é gerado UMA vez e reutilizado — nunca um hash() por tentativa", async () => {
    const primeiro = await servico.obterHashDummyParaProva();
    for (let i = 0; i < 3; i += 1) {
      await servico.verificarComCaminhoDummy(null, `tentativa-sintetica-${i}`);
    }
    const depois = await servico.obterHashDummyParaProva();
    // Identidade de valor: um novo `hash()` produziria salt diferente, logo
    // string diferente. Estabilidade prova a memoização.
    expect(depois).toBe(primeiro);
  });

  it("chamadas concorrentes durante a inicialização compartilham UM único dummy", async () => {
    const novo = new CredencialService();
    const dummies = await Promise.all([
      novo.obterHashDummyParaProva(),
      novo.obterHashDummyParaProva(),
      novo.obterHashDummyParaProva(),
    ]);
    expect(new Set(dummies).size).toBe(1);
  });

  it("o dummy usa a política Argon2id vigente e não pertence a nenhum usuário", async () => {
    const dummy = await servico.obterHashDummyParaProva();
    expect(dummy.startsWith("$argon2id$")).toBe(true);
    expect(servico.precisaRehash(dummy)).toBe(false);
    // Mesmo quem conhecer a senha sintética do dummy não autentica por ele.
    expect(
      await servico.verificarComCaminhoDummy(
        null,
        "credencial-dummy-sintetica-sem-usuario-real",
      ),
    ).toBe(false);
  });

  it("onModuleInit aquece o dummy antes do primeiro caminho de autenticação", async () => {
    const novo = new CredencialService();
    await novo.onModuleInit();
    const aquecido = await novo.obterHashDummyParaProva();
    expect(aquecido.startsWith("$argon2id$")).toBe(true);
    // Após o aquecimento, o dummy permanece o mesmo objeto memoizado.
    expect(await novo.obterHashDummyParaProva()).toBe(aquecido);
  });
});

describe("D-2.3D-02 — nada sensível é registrado ou exposto", () => {
  it("o serviço não escreve em console em nenhuma operação", async () => {
    const metodos = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const espioes = metodos.map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const h = await servico.gerarHash(SENHA_SINTETICA);
      await servico.verificarSenha(h, SENHA_SINTETICA);
      await servico.verificarSenha(h, SENHA_SINTETICA_OUTRA);
      await servico.verificarSenha("digest-malformado", SENHA_SINTETICA);
      await servico.verificarComCaminhoDummy(null, SENHA_SINTETICA);
      servico.precisaRehash(h);
      servico.precisaRehash("lixo");
      await servico.gerarHash("").catch(() => undefined);
      for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled();
    } finally {
      for (const espiao of espioes) espiao.mockRestore();
    }
  });

  it("a mensagem do erro não carrega senha nem digest", async () => {
    const erro = await capturarErroCredencial(() => servico.gerarHash(""));
    expect(erro).toBeInstanceOf(ErroCredencial);
    expect(erro.message).toBe("Credencial rejeitada: SENHA_INVALIDA.");
    expect(erro.message).not.toContain("$argon2");
  });

  it("o hash gerado não contém a senha em claro", async () => {
    expect(hashVigente).not.toContain(SENHA_SINTETICA);
  });
});
