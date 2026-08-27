// TechLab Fisio — testes unitários (SEM banco) do fluxo interno FIN-003
// `CobrancaService.aplicarDesconto` (Etapa 2.3C; PROP-RN-2.3C-01).
//
// O que esta suíte prova (a prova transacional/concorrente real vive em
// test/integration/cobranca-desconto.integration.spec.ts):
//   - fronteira monetária: somente string decimal canônica entra; float,
//     number, vírgula, notação científica, sinal e casas erradas são
//     rejeitados ANTES de qualquer transação;
//   - ordem e motivos das rejeições (ator → permissão → cobrança → regra);
//   - no-op de igualdade: sem mutação, sem evento, sem erro;
//   - redução rejeitada (FIN-003 é operação de AUMENTO);
//   - invariantes RN-042 e recebido ≤ líquido novo (em centavos BigInt);
//   - o contexto do evento é EXATAMENTE o par homologado, ambos strings.
//
// O AuditWriter e o AuditContextValidator usados são os REAIS — o caminho de
// política de auditoria não é mockado; apenas a persistência é um fake.

import { describe, expect, it } from "@jest/globals";

import { AuditContextValidator } from "../src/audit/audit-context.validator.js";
import { AuditWriter } from "../src/audit/audit-writer.js";
import {
  CobrancaService,
  ErroDescontoCobranca,
} from "../src/cobranca/cobranca.service.js";
import type { DatabaseService } from "../src/database/database.service.js";

interface ConfiguracaoFakeTx {
  ator?: { ativo: boolean } | null;
  temPermissao?: boolean;
  cobranca?: {
    valor_bruto: string;
    valor_desconto: string;
    cancelada: boolean;
  } | null;
  recebido?: string;
  updateCount?: number;
}

interface RegistroChamadas {
  updateMany: unknown[];
  eventos: unknown[];
  transacaoAberta: boolean;
}

function criarAmbiente(config: ConfiguracaoFakeTx = {}): {
  service: CobrancaService;
  chamadas: RegistroChamadas;
} {
  const chamadas: RegistroChamadas = {
    updateMany: [],
    eventos: [],
    transacaoAberta: false,
  };

  // Fake do cliente TRANSACIONAL: sem $connect/$disconnect (o AuditWriter
  // real verifica isso), com a superfície exata que o serviço usa.
  const tx = {
    usuario: {
      findUnique: async () => config.ator === undefined ? { ativo: true } : config.ator,
    },
    usuarioPapel: {
      findFirst: async () =>
        (config.temPermissao ?? true) ? { papelId: "papel-fake" } : null,
    },
    cobranca: {
      updateMany: async (args: unknown) => {
        chamadas.updateMany.push(args);
        return { count: config.updateCount ?? 1 };
      },
    },
    eventoAuditoria: {
      create: async (args: unknown) => {
        chamadas.eventos.push(args);
        return {};
      },
    },
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("FROM cobranca")) {
        const linha =
          config.cobranca === undefined
            ? { valor_bruto: "100.00", valor_desconto: "0.00", cancelada: false }
            : config.cobranca;
        return linha === null ? [] : [linha];
      }
      if (sql.includes("FROM pagamento")) {
        return [{ recebido: config.recebido ?? "0.00" }];
      }
      throw new Error(`fake tx: consulta inesperada: ${sql}`);
    },
  };

  const database = {
    transacao: async <T>(corpo: (t: unknown) => Promise<T>): Promise<T> => {
      chamadas.transacaoAberta = true;
      return corpo(tx);
    },
  } as unknown as DatabaseService;

  const service = new CobrancaService(
    database,
    new AuditWriter(new AuditContextValidator()),
  );
  return { service, chamadas };
}

const COMANDO_BASE = {
  cobrancaId: "3b241101-e2bb-4255-8caf-4136c566a962",
  atorUsuarioId: "5b0e2f4a-6a1b-4b6e-9a44-9c2a2f9b1d10",
};

describe("fronteira monetária — string decimal canônica obrigatória", () => {
  const invalidos = [
    "-5.00", // sinal (desconto negativo)
    "10.5", // uma casa
    "10", // sem casas
    "10.000", // três casas
    "abc",
    "1e3", // notação científica
    "10,00", // vírgula
    "NaN",
    "Infinity",
    " 10.00", // espaço
    "010.00", // zero à esquerda
    "",
    "10000000000.00", // 11 dígitos inteiros — excede numeric(12,2)
  ];

  for (const valor of invalidos) {
    it(`rejeita "${valor}" sem sequer abrir transação`, async () => {
      const { service, chamadas } = criarAmbiente();
      await expect(
        service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: valor }),
      ).rejects.toMatchObject({ motivo: "VALOR_DESCONTO_INVALIDO" });
      expect(chamadas.transacaoAberta).toBe(false);
    });
  }

  it("rejeita number injetado como any (float jamais participa)", async () => {
    const { service, chamadas } = criarAmbiente();
    await expect(
      service.aplicarDesconto({
        ...COMANDO_BASE,
        valorDescontoNovo: 50.0 as unknown as string,
      }),
    ).rejects.toMatchObject({ motivo: "VALOR_DESCONTO_INVALIDO" });
    expect(chamadas.transacaoAberta).toBe(false);
  });

  it("aceita o maior valor representável em numeric(12,2)", async () => {
    const { service } = criarAmbiente({
      cobranca: {
        valor_bruto: "9999999999.99",
        valor_desconto: "0.00",
        cancelada: false,
      },
    });
    const resultado = await service.aplicarDesconto({
      ...COMANDO_BASE,
      valorDescontoNovo: "9999999999.99",
    });
    expect(resultado.mutado).toBe(true);
  });
});

describe("autorização e integridade do ator — zero mutação, zero evento", () => {
  it("ator inexistente", async () => {
    const { service, chamadas } = criarAmbiente({ ator: null });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "ATOR_INEXISTENTE" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("ator inativo", async () => {
    const { service, chamadas } = criarAmbiente({ ator: { ativo: false } });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "ATOR_INATIVO" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("ator sem `financeiro.desconto.aplicar` (cadeia RBAC sem vínculo)", async () => {
    const { service, chamadas } = criarAmbiente({ temPermissao: false });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "ATOR_SEM_PERMISSAO" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });
});

describe("estado da cobrança", () => {
  it("cobrança inexistente", async () => {
    const { service, chamadas } = criarAmbiente({ cobranca: null });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "COBRANCA_INEXISTENTE" });
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("cobrança CANCELADO rejeita alteração (PROP-RN-2.3C-01 regra 1)", async () => {
    const { service, chamadas } = criarAmbiente({
      cobranca: { valor_bruto: "100.00", valor_desconto: "0.00", cancelada: true },
    });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "COBRANCA_CANCELADA" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });
});

describe("PROP-RN-2.3C-01 — aumento, no-op e redução", () => {
  it("igualdade é NO-OP: sem mutação, sem evento, sem erro", async () => {
    const { service, chamadas } = criarAmbiente({
      cobranca: { valor_bruto: "100.00", valor_desconto: "25.00", cancelada: false },
    });
    const resultado = await service.aplicarDesconto({
      ...COMANDO_BASE,
      valorDescontoNovo: "25.00",
    });
    expect(resultado).toMatchObject({
      mutado: false,
      correlacaoId: null,
      valorDescontoAnterior: "25.00",
      valorDescontoNovo: "25.00",
    });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("redução é rejeitada — FIN-003 é exclusivamente AUMENTO", async () => {
    const { service, chamadas } = criarAmbiente({
      cobranca: { valor_bruto: "100.00", valor_desconto: "25.00", cancelada: false },
    });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "REDUCAO_DE_DESCONTO_NAO_PERMITIDA" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });
});

describe("invariantes financeiras (centavos BigInt — sem float)", () => {
  it("desconto acima do bruto → DESCONTO_EXCEDE_VALOR_BRUTO (RN-042)", async () => {
    const { service, chamadas } = criarAmbiente({
      cobranca: { valor_bruto: "100.00", valor_desconto: "0.00", cancelada: false },
    });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "100.01" }),
    ).rejects.toMatchObject({ motivo: "DESCONTO_EXCEDE_VALOR_BRUTO" });
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("novo líquido abaixo do recebido → RECEBIDO_EXCEDE_NOVO_LIQUIDO", async () => {
    const { service, chamadas } = criarAmbiente({ recebido: "80.00" });
    await expect(
      // líquido novo = 100 − 40 = 60 < 80 recebidos
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "40.00" }),
    ).rejects.toMatchObject({ motivo: "RECEBIDO_EXCEDE_NOVO_LIQUIDO" });
    expect(chamadas.updateMany).toHaveLength(0);
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("borda: novo líquido IGUAL ao recebido é aceito (rederiva PAGO)", async () => {
    const { service, chamadas } = criarAmbiente({ recebido: "60.00" });
    const resultado = await service.aplicarDesconto({
      ...COMANDO_BASE,
      valorDescontoNovo: "40.00", // líquido novo = 60.00 == recebido
    });
    expect(resultado.mutado).toBe(true);
    expect(chamadas.eventos).toHaveLength(1);
  });
});

describe("caminho feliz — mutação condicional + evento com o par homologado", () => {
  it("persiste o par exato como strings, e somente ele", async () => {
    const { service, chamadas } = criarAmbiente({
      cobranca: { valor_bruto: "300.00", valor_desconto: "45.50", cancelada: false },
    });
    const resultado = await service.aplicarDesconto({
      ...COMANDO_BASE,
      valorDescontoNovo: "120.25",
    });

    expect(resultado).toMatchObject({
      cobrancaId: COMANDO_BASE.cobrancaId,
      valorDescontoAnterior: "45.50",
      valorDescontoNovo: "120.25",
      mutado: true,
    });
    expect(typeof resultado.correlacaoId).toBe("string");

    expect(chamadas.updateMany).toHaveLength(1);
    expect(chamadas.updateMany[0]).toEqual({
      where: {
        id: COMANDO_BASE.cobrancaId,
        canceladaEm: null,
        valorDesconto: "45.50",
      },
      data: {
        valorDesconto: "120.25",
        descontoPorUsuarioId: COMANDO_BASE.atorUsuarioId,
      },
    });

    expect(chamadas.eventos).toHaveLength(1);
    const evento = chamadas.eventos[0] as {
      data: {
        acao: string;
        alvoTipo: string;
        alvoId: string;
        resultado: string;
        justificativa: null;
        correlacaoId: string;
        contexto: Record<string, unknown>;
      };
    };
    expect(evento.data.acao).toBe("cobranca.desconto_aplicado");
    expect(evento.data.alvoTipo).toBe("cobranca");
    expect(evento.data.alvoId).toBe(COMANDO_BASE.cobrancaId);
    expect(evento.data.resultado).toBe("SUCESSO");
    expect(evento.data.justificativa).toBeNull();
    expect(evento.data.correlacaoId).toBe(resultado.correlacaoId);
    // Contexto: EXATAMENTE as duas chaves homologadas; valores STRING.
    expect(Object.keys(evento.data.contexto).sort()).toEqual([
      "valor_desconto_anterior",
      "valor_desconto_novo",
    ]);
    expect(evento.data.contexto["valor_desconto_anterior"]).toBe("45.50");
    expect(evento.data.contexto["valor_desconto_novo"]).toBe("120.25");
    expect(typeof evento.data.contexto["valor_desconto_anterior"]).toBe("string");
    expect(typeof evento.data.contexto["valor_desconto_novo"]).toBe("string");
  });

  it("mutação condicional sem efeito (count 0) falha ANTES do evento", async () => {
    const { service, chamadas } = criarAmbiente({ updateCount: 0 });
    await expect(
      service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" }),
    ).rejects.toMatchObject({ motivo: "MUTACAO_NAO_EFETIVADA" });
    expect(chamadas.eventos).toHaveLength(0);
  });

  it("erros do serviço são ErroDescontoCobranca com mensagem sem valores", async () => {
    const { service } = criarAmbiente({ temPermissao: false });
    try {
      await service.aplicarDesconto({ ...COMANDO_BASE, valorDescontoNovo: "10.00" });
      throw new Error("deveria ter rejeitado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDescontoCobranca);
      const mensagem = (erro as Error).message;
      expect(mensagem).not.toContain("10.00");
      expect(mensagem).not.toContain(COMANDO_BASE.cobrancaId);
    }
  });
});
