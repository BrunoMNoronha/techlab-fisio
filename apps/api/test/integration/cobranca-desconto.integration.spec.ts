// TechLab Fisio — fluxo interno `cobranca.desconto_aplicado` ponta a ponta
// contra PostgreSQL REAL (Etapa 2.3C; FIN-003, PROP-RN-2.3C-01).
//
// Caminho provado: CobrancaService (container Nest real) → DatabaseService →
// cliente real (fábrica pública) → role de runtime (tlf_app) → PostgreSQL 18
// → lock da linha `cobranca` (mesmo ponto de serialização de T-03/T-04/T-05,
// docs/07 §17.3) → AuditContextValidator → `evento_auditoria` com CONTEXTO
// NÃO VAZIO (primeira prova real de whitelist POSITIVA — R2.2-04).
//
// Propriedades medidas (não mockadas):
//   - autorização REAL pela cadeia Usuario → UsuarioPapel → Papel →
//     PapelPermissao → Permissao (`financeiro.desconto.aplicar`);
//   - PROP-RN-2.3C-01: aumento-somente, no-op de igualdade, invariantes
//     RN-042 e recebido ≤ líquido novo, CANCELADO rejeitado;
//   - situação DERIVADA (docs/07 §19.4) rederivada corretamente, inclusive
//     PARCIALMENTE_PAGO → PAGO por igualdade e ESTORNADO preservado;
//   - whitelist positiva: par homologado aceito e persistido byte a byte;
//     chave extra / objeto / array / número não finito → ROLLBACK integral;
//   - atomicidade real: falha do AuditWriter desfaz a mutação; falha da
//     mutação não deixa evento;
//   - concorrência real: desconto×desconto, desconto×pagamento (duas
//     ordens), desconto×cancelamento, desconto×estorno — o par
//     anterior/novo auditado sempre reflete a ordem serializada; nunca se
//     commita `recebido_liquido > valor_liquido`.
//
// Os fluxos de pagamento/estorno/cancelamento (T-03/T-04/T-05) ainda não
// existem na aplicação; os helpers abaixo os SIMULAM com o protocolo físico
// homologado (lock da cobrança + invariantes RN-046/RN-047), exclusivamente
// para medir as corridas. Fixtures 100% sintéticas.

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

import { AppModule } from "../../src/app.module.js";
import { ErroContextoAuditoria } from "../../src/audit/audit-context.validator.js";
import { AuditWriter } from "../../src/audit/audit-writer.js";
import {
  CobrancaService,
  ErroDescontoCobranca,
  PERMISSAO_APLICAR_DESCONTO,
} from "../../src/cobranca/cobranca.service.js";
import { DatabaseService } from "../../src/database/database.service.js";

let moduleRef: TestingModule;
let app: INestApplication;
let database: DatabaseService;
let cobrancaService: CobrancaService;
let auditWriter: AuditWriter;

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  database = moduleRef.get(DatabaseService);
  cobrancaService = moduleRef.get(CobrancaService);
  auditWriter = moduleRef.get(AuditWriter);
});

afterAll(async () => {
  await app.close();
});

/** Centavos exatos a partir de texto decimal (aceita "80", "80.5", "80.00"). */
function centavosDe(texto: string): bigint {
  const [inteiro = "0", fracao = ""] = texto.split(".");
  return BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, "0").slice(0, 2));
}

type SituacaoDerivada =
  | "CANCELADO"
  | "ESTORNADO"
  | "PENDENTE"
  | "PARCIALMENTE_PAGO"
  | "PAGO";

interface Fixtures {
  atorId: string;
  cobrancaId: string;
  formaPagamentoId: string;
}

async function criarFixtures(opcoes?: {
  valorBruto?: string;
  atorAtivo?: boolean;
  /** false = ator sem NENHUM vínculo de papel. */
  comPapel?: boolean;
  /** true = papel do ator carrega OUTRA permissão, não a de desconto. */
  permissaoErrada?: boolean;
}): Promise<Fixtures> {
  const sufixo = randomUUID().slice(0, 8);
  return database.transacao(async (tx) => {
    const clinica = await tx.clinica.create({
      data: {
        nomeCadastral: "Clínica Sintética 2.3C",
        fusoHorario: "America/Sao_Paulo",
      },
    });
    const formaPagamento = await tx.formaPagamento.create({
      data: { clinicaId: clinica.id, descricao: "PIX sintético", ativo: true },
    });
    const ator = await tx.usuario.create({
      data: {
        email: `ator-23c-${sufixo}@sintetico.local`,
        senhaHash: "hash-sintetico-23c",
        nome: "Ator Sintético 2.3C",
        ativo: opcoes?.atorAtivo ?? true,
      },
    });
    if (opcoes?.comPapel !== false) {
      const permissao = await tx.permissao.create({
        data: {
          codigo: opcoes?.permissaoErrada
            ? `financeiro.pagamento.registrar`
            : PERMISSAO_APLICAR_DESCONTO,
          nome: "Permissão sintética 2.3C",
        },
      });
      const papel = await tx.papel.create({
        data: { codigo: `papel-23c-${sufixo}`, nome: "Papel Sintético 2.3C" },
      });
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
      await tx.usuarioPapel.create({
        data: { usuarioId: ator.id, papelId: papel.id },
      });
    }
    const paciente = await tx.paciente.create({
      data: { nome: "Paciente Sintético 2.3C", ativo: true },
    });
    const cobranca = await tx.cobranca.create({
      data: {
        pacienteId: paciente.id,
        origemTipo: "ADMINISTRATIVA",
        valorBruto: opcoes?.valorBruto ?? "100.00",
        dataReferencia: new Date("2026-08-27"),
        criadoPorUsuarioId: ator.id,
      },
    });
    return {
      atorId: ator.id,
      cobrancaId: cobranca.id,
      formaPagamentoId: formaPagamento.id,
    };
  });
}

async function lerCobranca(id: string) {
  return database.transacao(async (tx) => {
    const linhas = await tx.$queryRaw<
      Array<{
        valor_bruto: string;
        valor_desconto: string;
        valor_liquido: string;
        cancelada: boolean;
        desconto_por_usuario_id: string | null;
      }>
    >`
      SELECT valor_bruto::text AS valor_bruto,
             valor_desconto::text AS valor_desconto,
             valor_liquido::text AS valor_liquido,
             (cancelada_em IS NOT NULL) AS cancelada,
             desconto_por_usuario_id::text AS desconto_por_usuario_id
      FROM cobranca WHERE id = ${id}::uuid
    `;
    const linha = linhas[0];
    if (linha === undefined) throw new Error("cobrança inexistente no teste");
    return linha;
  });
}

async function lerEventosDesconto() {
  return database.transacao(async (tx) =>
    tx.eventoAuditoria.findMany({
      where: { acao: "cobranca.desconto_aplicado" },
      orderBy: { criadoEm: "asc" },
    }),
  );
}

async function contarTodosEventos(): Promise<number> {
  return database.transacao(async (tx) => tx.eventoAuditoria.count());
}

/** Derivação da situação — implementação de teste de docs/07 §19.4. */
async function derivarSituacao(cobrancaId: string): Promise<SituacaoDerivada> {
  return database.transacao(async (tx) => {
    const cobranca = await tx.cobranca.findUniqueOrThrow({
      where: { id: cobrancaId },
      select: { canceladaEm: true, valorLiquido: true },
    });
    const pagamentos = await tx.pagamento.findMany({
      where: { cobrancaId },
      select: { valor: true, estorno: { select: { id: true } } },
    });
    const houveRecebimento = pagamentos.length > 0;
    const recebido = pagamentos
      .filter((p) => p.estorno === null)
      .reduce((acc, p) => acc + centavosDe(p.valor.toString()), 0n);
    const liquido = centavosDe(cobranca.valorLiquido.toString());
    if (cobranca.canceladaEm !== null) return "CANCELADO";
    if (houveRecebimento && recebido === 0n) return "ESTORNADO";
    if (recebido === 0n) return "PENDENTE";
    if (recebido < liquido) return "PARCIALMENTE_PAGO";
    return "PAGO";
  });
}

// --- Simulações dos fluxos financeiros concorrentes (protocolo T-03/T-04/
// --- T-05 de docs/07 §17.3/§24.2: lock da cobrança + invariantes) -----------

async function registrarPagamentoSimulado(
  f: Fixtures,
  valor: string,
): Promise<string> {
  return database.transacao(async (tx) => {
    const linhas = await tx.$queryRaw<
      Array<{ cancelada: boolean; liquido: string }>
    >`
      SELECT (cancelada_em IS NOT NULL) AS cancelada,
             valor_liquido::text AS liquido
      FROM cobranca WHERE id = ${f.cobrancaId}::uuid FOR UPDATE
    `;
    const cobranca = linhas[0];
    if (cobranca === undefined) throw new Error("SIM_COBRANCA_INEXISTENTE");
    if (cobranca.cancelada) throw new Error("SIM_COBRANCA_CANCELADA"); // RN-047
    const soma = await tx.$queryRaw<Array<{ recebido: string }>>`
      SELECT COALESCE(SUM(p.valor), 0)::numeric(12,2)::text AS recebido
      FROM pagamento p
      WHERE p.cobranca_id = ${f.cobrancaId}::uuid
        AND NOT EXISTS (SELECT 1 FROM estorno e WHERE e.pagamento_id = p.id)
    `;
    const recebido = centavosDe(soma[0]?.recebido ?? "0.00");
    if (recebido + centavosDe(valor) > centavosDe(cobranca.liquido)) {
      throw new Error("SIM_PAGAMENTO_EXCEDE_SALDO"); // RN-046
    }
    const pagamento = await tx.pagamento.create({
      data: {
        cobrancaId: f.cobrancaId,
        valor,
        formaPagamentoId: f.formaPagamentoId,
        recebidoEm: new Date(),
        registradoPorUsuarioId: f.atorId,
      },
    });
    return pagamento.id;
  });
}

async function estornarPagamentoSimulado(
  f: Fixtures,
  pagamentoId: string,
): Promise<void> {
  await database.transacao(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM cobranca WHERE id = ${f.cobrancaId}::uuid FOR UPDATE
    `;
    await tx.estorno.create({
      data: {
        pagamentoId,
        estornadoEm: new Date(),
        estornadoPorUsuarioId: f.atorId,
        motivo: "estorno sintético 2.3C",
      },
    });
  });
}

async function cancelarCobrancaSimulado(f: Fixtures): Promise<void> {
  await database.transacao(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM cobranca WHERE id = ${f.cobrancaId}::uuid FOR UPDATE
    `;
    const mutacao = await tx.cobranca.updateMany({
      where: { id: f.cobrancaId, canceladaEm: null },
      data: {
        canceladaEm: new Date(),
        canceladaPorUsuarioId: f.atorId,
        motivoCancelamento: "cancelamento sintético 2.3C",
      },
    });
    if (mutacao.count !== 1) throw new Error("SIM_CANCELAMENTO_SEM_EFEITO");
  });
}

// ---------------------------------------------------------------------------

describe("caminhos felizes — mutação + evento com whitelist POSITIVA", () => {
  it("PENDENTE: 0.00 → 25.00; 1 mutação, 1 evento, contexto exato", async () => {
    const f = await criarFixtures();

    const resultado = await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "25.00",
    });
    expect(resultado).toMatchObject({
      valorDescontoAnterior: "0.00",
      valorDescontoNovo: "25.00",
      mutado: true,
    });

    const cobranca = await lerCobranca(f.cobrancaId);
    expect(cobranca.valor_desconto).toBe("25.00");
    expect(cobranca.valor_liquido).toBe("75.00"); // coluna GERADA acompanhou
    expect(cobranca.desconto_por_usuario_id).toBe(f.atorId); // RN-043

    const eventos = await lerEventosDesconto();
    expect(eventos).toHaveLength(1);
    const evento = eventos[0];
    expect(evento).toMatchObject({
      acao: "cobranca.desconto_aplicado",
      alvoTipo: "cobranca",
      alvoId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      resultado: "SUCESSO",
      justificativa: null,
      correlacaoId: resultado.correlacaoId,
    });
    // Whitelist POSITIVA persistida: exatamente as duas chaves homologadas,
    // valores STRING decimais canônicos idênticos ao antes/depois da mutação.
    const contexto = evento?.contexto as Record<string, unknown>;
    expect(Object.keys(contexto).sort()).toEqual([
      "valor_desconto_anterior",
      "valor_desconto_novo",
    ]);
    expect(contexto["valor_desconto_anterior"]).toBe("0.00");
    expect(contexto["valor_desconto_novo"]).toBe("25.00");
    expect(typeof contexto["valor_desconto_anterior"]).toBe("string");
    expect(typeof contexto["valor_desconto_novo"]).toBe("string");

    expect(await derivarSituacao(f.cobrancaId)).toBe("PENDENTE");
  });

  it("PARCIALMENTE_PAGO: aumento mantendo líquido acima do recebido", async () => {
    const f = await criarFixtures();
    await registrarPagamentoSimulado(f, "40.00");
    expect(await derivarSituacao(f.cobrancaId)).toBe("PARCIALMENTE_PAGO");

    const resultado = await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "30.00", // líquido 70.00 > recebido 40.00
    });
    expect(resultado.mutado).toBe(true);
    expect((await lerCobranca(f.cobrancaId)).valor_liquido).toBe("70.00");
    expect(await derivarSituacao(f.cobrancaId)).toBe("PARCIALMENTE_PAGO");
    expect(await lerEventosDesconto()).toHaveLength(1);
  });

  it("igualdade líquido == recebido REDERIVA para PAGO", async () => {
    const f = await criarFixtures();
    await registrarPagamentoSimulado(f, "60.00");
    expect(await derivarSituacao(f.cobrancaId)).toBe("PARCIALMENTE_PAGO");

    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "40.00", // líquido 60.00 == recebido 60.00
    });
    expect(await derivarSituacao(f.cobrancaId)).toBe("PAGO");
    expect(await lerEventosDesconto()).toHaveLength(1);
  });

  it("ESTORNADO: aumento válido; pagamento e estorno permanecem intocados", async () => {
    const f = await criarFixtures();
    const pagamentoId = await registrarPagamentoSimulado(f, "80.00");
    await estornarPagamentoSimulado(f, pagamentoId);
    expect(await derivarSituacao(f.cobrancaId)).toBe("ESTORNADO");

    const resultado = await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "30.00", // recebido líquido = 0 ≤ 70.00
    });
    expect(resultado).toMatchObject({
      valorDescontoAnterior: "0.00",
      valorDescontoNovo: "30.00",
      mutado: true,
    });
    // Movimentos preservados (RN-044/RN-048); situação segue ESTORNADO.
    const movimentos = await database.transacao(async (tx) => ({
      pagamentos: await tx.pagamento.count({ where: { cobrancaId: f.cobrancaId } }),
      estornos: await tx.estorno.count({ where: { pagamentoId } }),
    }));
    expect(movimentos).toEqual({ pagamentos: 1, estornos: 1 });
    expect(await derivarSituacao(f.cobrancaId)).toBe("ESTORNADO");
    expect(await lerEventosDesconto()).toHaveLength(1);
  });

  it("aumentos sucessivos encadeiam pares anterior/novo sem lacuna", async () => {
    const f = await criarFixtures();
    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "10.00",
    });
    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "20.00",
    });
    const eventos = await lerEventosDesconto();
    expect(eventos).toHaveLength(2);
    const pares = eventos.map((e) => e.contexto as Record<string, unknown>);
    expect(pares[0]).toEqual({
      valor_desconto_anterior: "0.00",
      valor_desconto_novo: "10.00",
    });
    expect(pares[1]).toEqual({
      valor_desconto_anterior: "10.00",
      valor_desconto_novo: "20.00",
    });
    expect(eventos[0]?.correlacaoId).not.toBe(eventos[1]?.correlacaoId);
  });
});

describe("no-op — repetição do desconto vigente", () => {
  it("nenhuma mutação, nenhum evento duplicado, sem erro", async () => {
    const f = await criarFixtures();
    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "25.00",
    });
    const repeticao = await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "25.00",
    });
    expect(repeticao).toMatchObject({
      mutado: false,
      correlacaoId: null,
      valorDescontoAnterior: "25.00",
      valorDescontoNovo: "25.00",
    });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("25.00");
    expect(await lerEventosDesconto()).toHaveLength(1);
  });
});

describe("rejeições funcionais — zero mutação, zero evento", () => {
  it("redução do desconto (FIN-003 é aumento-somente)", async () => {
    const f = await criarFixtures();
    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "25.00",
    });
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "REDUCAO_DE_DESCONTO_NAO_PERMITIDA" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("25.00");
    expect(await lerEventosDesconto()).toHaveLength(1);
  });

  it("desconto negativo (formato canônico não admite sinal)", async () => {
    const f = await criarFixtures();
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "-5.00",
      }),
    ).rejects.toMatchObject({ motivo: "VALOR_DESCONTO_INVALIDO" });
    expect(await contarTodosEventos()).toBe(0);
  });

  it("desconto acima do valor bruto (RN-042)", async () => {
    const f = await criarFixtures();
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "100.01",
      }),
    ).rejects.toMatchObject({ motivo: "DESCONTO_EXCEDE_VALOR_BRUTO" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  });

  it("novo líquido abaixo do recebido efetivo", async () => {
    const f = await criarFixtures();
    await registrarPagamentoSimulado(f, "80.00");
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "30.00", // líquido 70.00 < recebido 80.00
      }),
    ).rejects.toMatchObject({ motivo: "RECEBIDO_EXCEDE_NOVO_LIQUIDO" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await lerEventosDesconto()).toHaveLength(0);
  });

  it("cobrança CANCELADO", async () => {
    const f = await criarFixtures();
    await cancelarCobrancaSimulado(f);
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "COBRANCA_CANCELADA" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await lerEventosDesconto()).toHaveLength(0);
  });

  it("cobrança inexistente", async () => {
    const f = await criarFixtures();
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: randomUUID(),
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "COBRANCA_INEXISTENTE" });
    expect(await lerEventosDesconto()).toHaveLength(0);
  });
});

describe("autorização REAL — cadeia Usuario→UsuarioPapel→Papel→PapelPermissao→Permissao", () => {
  it("ator inexistente: zero mutação, zero evento", async () => {
    const f = await criarFixtures();
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: randomUUID(),
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "ATOR_INEXISTENTE" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  });

  it("ator inativo: zero mutação, zero evento", async () => {
    const f = await criarFixtures({ atorAtivo: false });
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "ATOR_INATIVO" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  });

  it("ator sem papel algum: ATOR_SEM_PERMISSAO", async () => {
    const f = await criarFixtures({ comPapel: false });
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "ATOR_SEM_PERMISSAO" });
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  });

  it("papel com OUTRA permissão não autoriza desconto (RN-043)", async () => {
    const f = await criarFixtures({ permissaoErrada: true });
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toBeInstanceOf(ErroDescontoCobranca);
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  });
});

describe("whitelist positiva — política fail-closed no caminho de escrita REAL", () => {
  async function tentarEscritaComContexto(
    f: Fixtures,
    contexto: Record<string, unknown>,
    acao = "cobranca.desconto_aplicado",
  ): Promise<void> {
    await database.transacao(async (tx) => {
      // Mesma forma de mutação do fluxo real...
      const mutacao = await tx.cobranca.updateMany({
        where: { id: f.cobrancaId, canceladaEm: null, valorDesconto: "0.00" },
        data: { valorDesconto: "10.00", descontoPorUsuarioId: f.atorId },
      });
      expect(mutacao.count).toBe(1);
      // ...seguida do evento com o candidato sob teste:
      await auditWriter.registrar(tx, {
        acao,
        ocorridoEm: new Date(),
        atorUsuarioId: f.atorId,
        alvoTipo: "cobranca",
        alvoId: f.cobrancaId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId: randomUUID(),
        contexto,
      });
    });
  }

  async function esperarRollbackIntegral(f: Fixtures): Promise<void> {
    // A mutação foi DESFEITA pelo PostgreSQL — não por mock — e zero evento.
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
    expect(await contarTodosEventos()).toBe(0);
  }

  it("Cenário A (F-2.3C-REV-01): escrita DIRETA no writer com par canônico → COMMIT de mutação + evento exatos", async () => {
    const f = await criarFixtures();
    const correlacaoId = randomUUID();
    await database.transacao(async (tx) => {
      const mutacao = await tx.cobranca.updateMany({
        where: { id: f.cobrancaId, canceladaEm: null, valorDesconto: "0.00" },
        data: { valorDesconto: "10.00", descontoPorUsuarioId: f.atorId },
      });
      expect(mutacao.count).toBe(1);
      await auditWriter.registrar(tx, {
        acao: "cobranca.desconto_aplicado",
        ocorridoEm: new Date(),
        atorUsuarioId: f.atorId,
        alvoTipo: "cobranca",
        alvoId: f.cobrancaId,
        resultado: "SUCESSO",
        justificativa: null,
        correlacaoId,
        contexto: {
          valor_desconto_anterior: "0.00",
          valor_desconto_novo: "10.00",
        },
      });
    });
    // Caminho real transação → AuditWriter → validator → PostgreSQL, commitado:
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("10.00");
    const eventos = await lerEventosDesconto();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.correlacaoId).toBe(correlacaoId);
    expect(eventos[0]?.contexto).toEqual({
      valor_desconto_anterior: "0.00",
      valor_desconto_novo: "10.00",
    });
  });

  it.each([
    ["string sensível arbitrária", "PACIENTE: DADO QUE NÃO DEVE ENTRAR"],
    ['string "10,00" (vírgula)', "10,00"],
    ['string "10" (sem casas)', "10"],
    ["number 10", 10],
  ])(
    "Cenário B (F-2.3C-REV-01): chave monetária homologada com %s → rejeição semântica + ROLLBACK integral",
    async (_rotulo, valor) => {
      const f = await criarFixtures();
      let mensagem = "";
      try {
        await tentarEscritaComContexto(f, {
          valor_desconto_anterior: "0.00",
          valor_desconto_novo: valor,
        });
        throw new Error("a escrita deveria ter sido rejeitada");
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroContextoAuditoria);
        expect((erro as { motivo: string }).motivo).toBe(
          "VALOR_SEMANTICAMENTE_INVALIDO",
        );
        mensagem = (erro as Error).message;
      }
      // Nenhum valor rejeitado ecoado (proteção contra vazamento):
      expect(mensagem).toContain("valor_desconto_novo");
      expect(mensagem).not.toContain(String(valor));
      // A mutação de negócio foi DESFEITA pelo PostgreSQL; zero evento:
      await esperarRollbackIntegral(f);
    },
  );

  it("chave extra além do par homologado → operação INTEIRA desfeita", async () => {
    const f = await criarFixtures();
    await expect(
      tentarEscritaComContexto(f, {
        valor_desconto_anterior: "0.00",
        valor_desconto_novo: "10.00",
        paciente_nome: "NUNCA", // chave proibida
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    await esperarRollbackIntegral(f);
  });

  it("objeto onde escalar é esperado → rollback integral", async () => {
    const f = await criarFixtures();
    await expect(
      tentarEscritaComContexto(f, {
        valor_desconto_anterior: "0.00",
        valor_desconto_novo: { valor: "10.00" }, // DTO embutido
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    await esperarRollbackIntegral(f);
  });

  it("array onde escalar é esperado → rollback integral", async () => {
    const f = await criarFixtures();
    await expect(
      tentarEscritaComContexto(f, {
        valor_desconto_anterior: ["0.00"],
        valor_desconto_novo: "10.00",
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    await esperarRollbackIntegral(f);
  });

  it("número NÃO finito (NaN) → rollback integral (contrato do validator)", async () => {
    const f = await criarFixtures();
    await expect(
      tentarEscritaComContexto(f, {
        valor_desconto_anterior: "0.00",
        valor_desconto_novo: Number.NaN,
      }),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    await esperarRollbackIntegral(f);
  });

  it("ação desconhecida → rollback integral", async () => {
    const f = await criarFixtures();
    await expect(
      tentarEscritaComContexto(
        f,
        {
          valor_desconto_anterior: "0.00",
          valor_desconto_novo: "10.00",
        },
        "cobranca.desconto_revogado", // fora do catálogo D-AUD-01
      ),
    ).rejects.toBeInstanceOf(ErroContextoAuditoria);
    await esperarRollbackIntegral(f);
  });

  it("representação monetária inadequada na FRONTEIRA do serviço → rejeição sem transação", async () => {
    const f = await criarFixtures();
    for (const invalido of ["50.5", "abc", "1e3", "50,00"]) {
      await expect(
        cobrancaService.aplicarDesconto({
          cobrancaId: f.cobrancaId,
          atorUsuarioId: f.atorId,
          valorDescontoNovo: invalido,
        }),
      ).rejects.toMatchObject({ motivo: "VALOR_DESCONTO_INVALIDO" });
    }
    await esperarRollbackIntegral(f);
  });
});

describe("atomicidade REAL — commit e rollback no PostgreSQL", () => {
  it("falha da mutação (após evento na mesma transação) → ZERO evento persiste", async () => {
    const f = await criarFixtures();
    await expect(
      database.transacao(async (tx) => {
        await auditWriter.registrar(tx, {
          acao: "cobranca.desconto_aplicado",
          ocorridoEm: new Date(),
          atorUsuarioId: f.atorId,
          alvoTipo: "cobranca",
          alvoId: f.cobrancaId,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
          contexto: {
            valor_desconto_anterior: "0.00",
            valor_desconto_novo: "10.00",
          },
        });
        // Mutação inválida: FK inexistente força erro do banco → rollback.
        await tx.cobranca.update({
          where: { id: f.cobrancaId },
          data: { descontoPorUsuarioId: randomUUID() },
        });
      }),
    ).rejects.toThrow();
    expect(await contarTodosEventos()).toBe(0);
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
  });

  it("CHECK físico do banco é retaguarda: escrita direta acima do bruto falha", async () => {
    const f = await criarFixtures();
    await expect(
      database.transacao(async (tx) =>
        tx.cobranca.updateMany({
          where: { id: f.cobrancaId },
          data: { valorDesconto: "150.00" }, // violaria RN-042 no CHECK
        }),
      ),
    ).rejects.toThrow();
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("0.00");
  });
});

describe("concorrência REAL — serialização pela linha da cobrança", () => {
  it("A. desconto × desconto (alvos distintos): pares refletem a ordem serializada, sem lost update", async () => {
    const f = await criarFixtures();
    const resultados = await Promise.allSettled([
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "20.00",
      }),
    ]);

    const eventos = await lerEventosDesconto();
    const pares = eventos.map(
      (e) => e.contexto as { valor_desconto_anterior: string; valor_desconto_novo: string },
    );
    // Encadeamento sem lacuna a partir de 0.00 — o par auditado SEMPRE
    // reflete a ordem efetivamente commitada:
    let vigente = "0.00";
    for (const par of pares) {
      expect(par.valor_desconto_anterior).toBe(vigente);
      expect(centavosDe(par.valor_desconto_novo)).toBeGreaterThan(
        centavosDe(par.valor_desconto_anterior),
      );
      vigente = par.valor_desconto_novo;
    }
    // O valor final da cobrança é exatamente o último `novo` auditado.
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe(vigente);

    // Resultados possíveis: [10 → 20] (ambos aplicam) ou [20; 10 rejeitado
    // como redução]. Nunca lost update silencioso.
    const sucessos = resultados.filter((r) => r.status === "fulfilled");
    if (sucessos.length === 2) {
      expect(pares).toHaveLength(2);
      expect(vigente).toBe("20.00");
    } else {
      expect(sucessos).toHaveLength(1);
      expect(pares).toHaveLength(1);
      expect(vigente).toBe("20.00");
      const rejeicao = resultados.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejeicao.reason).toMatchObject({
        motivo: "REDUCAO_DE_DESCONTO_NAO_PERMITIDA",
      });
    }
  });

  it("A2. desconto × desconto (MESMO alvo): exatamente um evento; o outro é no-op", async () => {
    const f = await criarFixtures();
    const resultados = await Promise.all([
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "15.00",
      }),
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "15.00",
      }),
    ]);
    const mutados = resultados.filter((r) => r.mutado);
    expect(mutados).toHaveLength(1); // um venceu; o outro serializou depois e viu igualdade
    expect(await lerEventosDesconto()).toHaveLength(1);
    expect((await lerCobranca(f.cobrancaId)).valor_desconto).toBe("15.00");
  });

  it("B. desconto × pagamento concorrentes: NUNCA se commita recebido > líquido", async () => {
    const f = await criarFixtures();
    const [desconto, pagamento] = await Promise.allSettled([
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "30.00", // deixaria líquido 70.00
      }),
      registrarPagamentoSimulado(f, "80.00"), // exigiria líquido ≥ 80.00
    ]);

    // Incompatíveis entre si: exatamente UM dos dois pode ter commitado.
    expect(
      [desconto, pagamento].filter((r) => r.status === "fulfilled"),
    ).toHaveLength(1);

    // Invariante pós-estado, medida no banco:
    const cobranca = await lerCobranca(f.cobrancaId);
    const recebido = await database.transacao(async (tx) => {
      const soma = await tx.$queryRaw<Array<{ recebido: string }>>`
        SELECT COALESCE(SUM(p.valor), 0)::numeric(12,2)::text AS recebido
        FROM pagamento p
        WHERE p.cobranca_id = ${f.cobrancaId}::uuid
          AND NOT EXISTS (SELECT 1 FROM estorno e WHERE e.pagamento_id = p.id)
      `;
      return soma[0]?.recebido ?? "0.00";
    });
    expect(centavosDe(recebido) <= centavosDe(cobranca.valor_liquido)).toBe(true);

    // Evento existe sse o desconto commitou.
    const eventos = await lerEventosDesconto();
    expect(eventos).toHaveLength(desconto.status === "fulfilled" ? 1 : 0);
  });

  it("B2. ordem pagamento → desconto: desconto que esmagaria o recebido é rejeitado", async () => {
    const f = await criarFixtures();
    await registrarPagamentoSimulado(f, "80.00");
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "30.00",
      }),
    ).rejects.toMatchObject({ motivo: "RECEBIDO_EXCEDE_NOVO_LIQUIDO" });
    expect(await lerEventosDesconto()).toHaveLength(0);
  });

  it("B3. ordem desconto → pagamento: pagamento acima do novo líquido é rejeitado (RN-046)", async () => {
    const f = await criarFixtures();
    await cobrancaService.aplicarDesconto({
      cobrancaId: f.cobrancaId,
      atorUsuarioId: f.atorId,
      valorDescontoNovo: "30.00", // líquido 70.00
    });
    await expect(registrarPagamentoSimulado(f, "80.00")).rejects.toThrow(
      "SIM_PAGAMENTO_EXCEDE_SALDO",
    );
    await registrarPagamentoSimulado(f, "70.00"); // exatamente o líquido novo
    expect(await derivarSituacao(f.cobrancaId)).toBe("PAGO");
  });

  it("C. desconto × cancelamento concorrentes: nenhum desconto commita APÓS o cancelamento", async () => {
    const f = await criarFixtures();
    const [desconto] = await Promise.allSettled([
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
      cancelarCobrancaSimulado(f),
    ]);

    const cobranca = await lerCobranca(f.cobrancaId);
    expect(cobranca.cancelada).toBe(true); // o cancelamento sempre completa
    const eventos = await lerEventosDesconto();
    if (desconto.status === "fulfilled") {
      // Desconto serializou ANTES do cancelamento — mutação e evento válidos.
      expect(cobranca.valor_desconto).toBe("10.00");
      expect(eventos).toHaveLength(1);
    } else {
      // Cancelamento venceu — desconto rejeitado, nada persistido.
      expect((desconto as PromiseRejectedResult).reason).toMatchObject({
        motivo: "COBRANCA_CANCELADA",
      });
      expect(cobranca.valor_desconto).toBe("0.00");
      expect(eventos).toHaveLength(0);
    }
  });

  it("C2. cancelamento já commitado: desconto posterior nunca passa", async () => {
    const f = await criarFixtures();
    await cancelarCobrancaSimulado(f);
    await expect(
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "10.00",
      }),
    ).rejects.toMatchObject({ motivo: "COBRANCA_CANCELADA" });
    expect(await lerEventosDesconto()).toHaveLength(0);
  });

  it("D. desconto × estorno concorrentes: invariantes e movimentos preservados", async () => {
    const f = await criarFixtures();
    const pagamentoId = await registrarPagamentoSimulado(f, "80.00");

    const [desconto] = await Promise.allSettled([
      cobrancaService.aplicarDesconto({
        cobrancaId: f.cobrancaId,
        atorUsuarioId: f.atorId,
        valorDescontoNovo: "30.00", // só é possível com o estorno commitado antes
      }),
      estornarPagamentoSimulado(f, pagamentoId),
    ]);

    // Movimentos NUNCA são tocados pelo desconto (RN-044/RN-048).
    const movimentos = await database.transacao(async (tx) => ({
      pagamentos: await tx.pagamento.count({ where: { cobrancaId: f.cobrancaId } }),
      estornos: await tx.estorno.count({ where: { pagamentoId } }),
    }));
    expect(movimentos).toEqual({ pagamentos: 1, estornos: 1 });

    const cobranca = await lerCobranca(f.cobrancaId);
    const eventos = await lerEventosDesconto();
    if (desconto.status === "fulfilled") {
      // Estorno serializou primeiro: recebido 0 → desconto válido.
      expect(cobranca.valor_desconto).toBe("30.00");
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.contexto).toEqual({
        valor_desconto_anterior: "0.00",
        valor_desconto_novo: "30.00",
      });
    } else {
      // Desconto serializou primeiro, com recebido 80 > líquido 70 → rejeitado.
      expect((desconto as PromiseRejectedResult).reason).toMatchObject({
        motivo: "RECEBIDO_EXCEDE_NOVO_LIQUIDO",
      });
      expect(cobranca.valor_desconto).toBe("0.00");
      expect(eventos).toHaveLength(0);
    }
    // Rederivação: houve recebimento e recebido líquido = 0 → ESTORNADO.
    expect(await derivarSituacao(f.cobrancaId)).toBe("ESTORNADO");
  });
});
