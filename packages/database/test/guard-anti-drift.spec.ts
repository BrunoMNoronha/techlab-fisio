// TechLab Fisio — E-16 — GUARDA 2: existência E efeito dos objetos protegidos
// (docs/08 §9.3; `H2.2-18`: "o teste é a proteção contra perda silenciosa").
//
// FONTE ÚNICA da lista: packages/database/protected-objects.json — a mesma
// consumida pela Guarda 1 (scripts/lint-migrations.mjs) e pela verificação de
// catálogo da E-15 (scripts/verify-from-scratch.mjs). Nenhum objeto protegido
// pode desaparecer da cobertura por esquecimento: se sair do JSON, as três
// guardas o perdem juntas e o diff denuncia; se sair do banco, ESTE spec falha.
//
// Para cada categoria crítica: (A) existência/configuração esperada no
// catálogo; (B) comportamento real (violação rejeitada / efeito observável).
// REUSO declarado (docs/08 §14 — sem duplicar cenários já provados de forma
// permanente):
//   - efeito do índice único parcial de consumo (U-03) -> constraint-errors.spec.ts (C-04);
//   - efeito de `ex_agendamento_profissional` -> constraint-errors.spec.ts + scheduling-concurrency.spec.ts;
//   - efeito de `ck_paciente_cpf_formato` -> constraint-errors.spec.ts + patient-invariants.spec.ts;
//   - INSERT permitido em movimento_sessao/pagamento/estorno -> package-invariants/financial-invariants.
//
// IMPORTANTE (docs/08 §9.3 / enunciado E-16 §7): o golden da Guarda 3 usa
// `--no-privileges`, portanto a prova dos REVOKEs append-only vive AQUI —
// matriz de privilégios (existência) + rejeição real com 42501 (efeito).
//
// Toda a suíte roda como `tlf_app` (runtime real) no banco descartável da
// E-13; nenhum mock; dados 100% sintéticos.

import { afterAll, describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.js";
import { criarClienteApp } from "./helpers/db.js";
import { criarBaseSintetica, criarAgendamento, type BaseSintetica } from "./helpers/fixtures.js";
import { capturarErro, extrairSqlstate } from "./helpers/erros.js";
import { identificarViolacao } from "../src/errors/constraint-map.js";

interface ObjetoNomeado {
  nome: string;
  tabela?: string;
  predicado?: string;
  condicao?: string;
  origem: string;
}

interface Inventario {
  roleRuntime: string;
  extensao: { nome: string; origem: string };
  exclusionConstraints: ObjetoNomeado[];
  indicesParciaisUnicos: ObjetoNomeado[];
  indicesParciaisSimples: ObjetoNomeado[];
  checkConstraints: ObjetoNomeado[];
  triggers: ObjetoNomeado[];
  funcoes: ObjetoNomeado[];
  colunaGerada: { tabela: string; coluna: string; expressao: string; origem: string };
  tabelasAppendOnly: Array<{ tabela: string; origem: string }>;
}

const inventario: Inventario = JSON.parse(
  readFileSync(new URL("../protected-objects.json", import.meta.url), "utf8"),
) as Inventario;

const db: PrismaClient = criarClienteApp();

afterAll(async () => {
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// Fixtures auxiliares (além da base sintética da E-14)
// ---------------------------------------------------------------------------

async function criarPacote(
  base: BaseSintetica,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  return db.pacote.create({
    data: {
      pacienteId: base.paciente1Id,
      servicoId: base.servicoId,
      quantidadeContratada: 10,
      dataContratacao: new Date("2026-08-01"),
      criadoPorUsuarioId: base.usuarioId,
      ...overrides,
    },
  });
}

let sequenciaJanela = 0;

/** Janela horária única por chamada — não colide com as exclusion constraints. */
function proximaJanela(): { inicio: string; fim: string } {
  sequenciaJanela += 1;
  const dia = String(1 + (sequenciaJanela % 27)).padStart(2, "0");
  const hora = String(6 + (sequenciaJanela % 12)).padStart(2, "0");
  return {
    inicio: `2027-03-${dia}T${hora}:00:00Z`,
    fim: `2027-03-${dia}T${hora}:45:00Z`,
  };
}

async function criarAtendimento(base: BaseSintetica): Promise<{ id: string }> {
  const janela = proximaJanela();
  const agendamento = await criarAgendamento(db, base, {
    pacienteId: base.paciente1Id,
    ...janela,
  });
  return db.atendimento.create({
    data: {
      agendamentoId: agendamento.id,
      pacienteId: base.paciente1Id,
      iniciadoEm: new Date(janela.inicio),
    },
  });
}

async function criarRegistroClinico(
  base: BaseSintetica,
  estado: "EM_ELABORACAO" | "FINALIZADO",
): Promise<{ id: string }> {
  const atendimento = await criarAtendimento(base);
  return db.registroClinico.create({
    data: {
      atendimentoId: atendimento.id,
      pacienteId: base.paciente1Id,
      autorUsuarioId: base.usuarioId,
      estado,
      ...(estado === "FINALIZADO" ? { finalizadoEm: new Date("2027-03-01T12:00:00Z") } : {}),
    },
  });
}

async function criarCobranca(
  base: BaseSintetica,
  valorBruto: string,
  valorDesconto: string,
): Promise<{ id: string }> {
  return db.cobranca.create({
    data: {
      pacienteId: base.paciente1Id,
      origemTipo: "ADMINISTRATIVA",
      valorBruto,
      valorDesconto,
      dataReferencia: new Date("2026-08-25"),
      criadoPorUsuarioId: base.usuarioId,
    },
  });
}

// ---------------------------------------------------------------------------
// A. EXISTÊNCIA — catálogo do PostgreSQL, nomes determinísticos (C-6)
// ---------------------------------------------------------------------------

describe("GUARDA 2 — existência e configuração no catálogo", () => {
  it("extensão protegida existe", async () => {
    const linhas = await db.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = ${inventario.extensao.nome}
    `;
    expect(linhas).toHaveLength(1);
  });

  it("as 25 CHECK constraints existem, cada uma na tabela esperada", async () => {
    const nomes = inventario.checkConstraints.map((c) => c.nome);
    expect(nomes).toHaveLength(25);
    const linhas = await db.$queryRaw<Array<{ conname: string; tabela: string }>>`
      SELECT con.conname, rel.relname AS tabela
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE con.contype = 'c' AND con.conname = ANY(${nomes})
    `;
    const porNome = new Map(linhas.map((l) => [l.conname, l.tabela]));
    for (const check of inventario.checkConstraints) {
      expect(porNome.get(check.nome)).toBe(check.tabela);
    }
  });

  it("os 6 índices parciais existem com unicidade e predicado esperados", async () => {
    const todos = [
      ...inventario.indicesParciaisUnicos.map((i) => ({ ...i, unico: true })),
      ...inventario.indicesParciaisSimples.map((i) => ({ ...i, unico: false })),
    ];
    expect(todos).toHaveLength(6);
    const nomes = todos.map((i) => i.nome);
    const linhas = await db.$queryRaw<
      Array<{ nome: string; indisunique: boolean; definicao: string; tabela: string }>
    >`
      SELECT c.relname AS nome,
             i.indisunique,
             pg_get_indexdef(i.indexrelid) AS definicao,
             t.relname AS tabela
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      WHERE i.indpred IS NOT NULL AND c.relname = ANY(${nomes})
    `;
    const porNome = new Map(linhas.map((l) => [l.nome, l]));
    for (const indice of todos) {
      const real = porNome.get(indice.nome);
      expect(real).toBeDefined();
      expect(real?.tabela).toBe(indice.tabela);
      expect(real?.indisunique).toBe(indice.unico);
      expect(real?.definicao).toContain("WHERE");
      expect(real?.definicao).toContain(indice.predicado as string);
    }
  });

  it("as 2 exclusion constraints existem com GiST, tstzrange semiaberto e os 5 estados bloqueantes", async () => {
    const nomes = inventario.exclusionConstraints.map((e) => e.nome);
    expect(nomes).toHaveLength(2);
    const linhas = await db.$queryRaw<
      Array<{ conname: string; tabela: string; definicao: string }>
    >`
      SELECT con.conname, rel.relname AS tabela,
             pg_get_constraintdef(con.oid) AS definicao
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE con.contype = 'x' AND con.conname = ANY(${nomes})
    `;
    const porNome = new Map(linhas.map((l) => [l.conname, l]));
    for (const excl of inventario.exclusionConstraints) {
      const real = porNome.get(excl.nome);
      expect(real).toBeDefined();
      expect(real?.tabela).toBe(excl.tabela);
      expect(real?.definicao).toContain("EXCLUDE USING gist");
      expect(real?.definicao).toContain("tstzrange(inicio, fim, '[)'");
      for (const estado of ["AGENDADO", "CONFIRMADO", "AGUARDANDO", "EM_ATENDIMENTO", "CONCLUIDO"]) {
        expect(real?.definicao).toContain(estado);
      }
    }
    const definicaoProfissional = porNome.get("ex_agendamento_profissional")?.definicao;
    expect(definicaoProfissional).toContain("profissional_id WITH =");
    const definicaoPaciente = porNome.get("ex_agendamento_paciente")?.definicao;
    expect(definicaoPaciente).toContain("paciente_id WITH =");
  });

  it("as 2 triggers condicionais existem, habilitadas, com WHEN e função esperados", async () => {
    for (const trigger of inventario.triggers) {
      const linhas = await db.$queryRaw<
        Array<{ tgname: string; tgenabled: string; definicao: string }>
      >`
        SELECT t.tgname, t.tgenabled::text AS tgenabled,
               pg_get_triggerdef(t.oid) AS definicao
        FROM pg_trigger t
        JOIN pg_class rel ON rel.oid = t.tgrelid
        WHERE t.tgname = ${trigger.nome} AND rel.relname = ${trigger.tabela}
      `;
      expect(linhas).toHaveLength(1);
      expect(linhas[0]?.tgenabled).toBe("O");
      expect(linhas[0]?.definicao).toContain("BEFORE DELETE OR UPDATE");
      expect(linhas[0]?.definicao).toContain("FOR EACH ROW");
      // pg_get_triggerdef normaliza OLD -> old; comparação por fragmento estável
      const condicao = (trigger.condicao as string).replace("OLD.", "old.").toLowerCase();
      expect(linhas[0]?.definicao.toLowerCase()).toContain(condicao.toLowerCase());
    }
  });

  it("as 2 funções de suporte existem em plpgsql", async () => {
    const nomes = inventario.funcoes.map((f) => f.nome);
    expect(nomes).toHaveLength(2);
    const linhas = await db.$queryRaw<Array<{ proname: string; lanname: string }>>`
      SELECT p.proname, l.lanname
      FROM pg_proc p
      JOIN pg_language l ON l.oid = p.prolang
      WHERE p.proname = ANY(${nomes})
    `;
    expect(linhas).toHaveLength(2);
    for (const linha of linhas) {
      expect(linha.lanname).toBe("plpgsql");
    }
  });

  it("cobranca.valor_liquido é GENERATED ... STORED com a expressão homologada", async () => {
    const linhas = await db.$queryRaw<
      Array<{ attgenerated: string; expressao: string | null }>
    >`
      SELECT a.attgenerated::text AS attgenerated,
             pg_get_expr(d.adbin, d.adrelid) AS expressao
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = 'cobranca'::regclass AND a.attname = 'valor_liquido'
    `;
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.attgenerated).toBe("s");
    expect(linhas[0]?.expressao).toBe(inventario.colunaGerada.expressao);
  });

  it("matriz de privilégios da role de runtime nas 5 tabelas append-only (S/I sim, U/D não)", async () => {
    for (const { tabela } of inventario.tabelasAppendOnly) {
      const linhas = await db.$queryRaw<
        Array<{ s: boolean; i: boolean; u: boolean; d: boolean }>
      >`
        SELECT has_table_privilege(${inventario.roleRuntime}, ${tabela}, 'SELECT') AS s,
               has_table_privilege(${inventario.roleRuntime}, ${tabela}, 'INSERT') AS i,
               has_table_privilege(${inventario.roleRuntime}, ${tabela}, 'UPDATE') AS u,
               has_table_privilege(${inventario.roleRuntime}, ${tabela}, 'DELETE') AS d
      `;
      expect({ tabela, ...linhas[0] }).toEqual({ tabela, s: true, i: true, u: false, d: false });
    }
  });
});

// ---------------------------------------------------------------------------
// B. EFEITO — CHECK constraints (violação correspondente rejeitada)
// ---------------------------------------------------------------------------

interface CasoCheck {
  titulo: string;
  /** Constraints admissíveis no erro (uma só, salvo o caso não isolável). */
  esperadas: string[];
  executar: (base: BaseSintetica) => Promise<unknown>;
}

const casosCheck: CasoCheck[] = [
  {
    titulo: "ck_agendamento_intervalo rejeita fim <= inicio",
    esperadas: ["ck_agendamento_intervalo"],
    executar: (base) =>
      criarAgendamento(db, base, {
        pacienteId: base.paciente1Id,
        inicio: "2027-04-01T10:00:00Z",
        fim: "2027-04-01T09:00:00Z",
      }),
  },
  {
    titulo: "ck_agendamento_modalidade_pacote rejeita PACOTE sem pacote_id",
    esperadas: ["ck_agendamento_modalidade_pacote"],
    executar: (base) =>
      criarAgendamento(db, base, {
        pacienteId: base.paciente1Id,
        ...proximaJanela(),
        modalidade: "PACOTE",
      }),
  },
  {
    titulo: "ck_bloqueio_agenda_intervalo rejeita fim <= inicio",
    esperadas: ["ck_bloqueio_agenda_intervalo"],
    executar: (base) =>
      db.bloqueioAgenda.create({
        data: {
          profissionalId: base.profissionalId,
          inicio: new Date("2027-04-01T10:00:00Z"),
          fim: new Date("2027-04-01T10:00:00Z"),
          criadoPorUsuarioId: base.usuarioId,
        },
      }),
  },
  {
    titulo: "ck_movimento_sessao_quantidade_positiva rejeita quantidade 0",
    esperadas: ["ck_movimento_sessao_quantidade_positiva"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      return db.movimentoSessao.create({
        data: {
          pacoteId: pacote.id,
          tipo: "AJUSTE_POSITIVO",
          quantidade: 0,
          usuarioResponsavelId: base.usuarioId,
          justificativa: "ajuste sintético",
        },
      });
    },
  },
  {
    titulo: "ck_movimento_sessao_tipo_atendimento rejeita CONSUMO sem atendimento",
    esperadas: ["ck_movimento_sessao_tipo_atendimento"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      return db.movimentoSessao.create({
        data: {
          pacoteId: pacote.id,
          tipo: "CONSUMO",
          quantidade: 1,
          usuarioResponsavelId: base.usuarioId,
        },
      });
    },
  },
  {
    titulo: "ck_movimento_sessao_consumo_unitario rejeita CONSUMO com quantidade 2",
    esperadas: ["ck_movimento_sessao_consumo_unitario"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      const atendimento = await criarAtendimento(base);
      return db.movimentoSessao.create({
        data: {
          pacoteId: pacote.id,
          tipo: "CONSUMO",
          quantidade: 2,
          atendimentoId: atendimento.id,
          usuarioResponsavelId: base.usuarioId,
        },
      });
    },
  },
  {
    titulo: "ck_movimento_sessao_justificativa_ajuste rejeita ajuste com justificativa em branco",
    esperadas: ["ck_movimento_sessao_justificativa_ajuste"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      return db.movimentoSessao.create({
        data: {
          pacoteId: pacote.id,
          tipo: "AJUSTE_NEGATIVO",
          quantidade: 1,
          usuarioResponsavelId: base.usuarioId,
          justificativa: "   ",
        },
      });
    },
  },
  {
    titulo: "ck_reserva_sessao_encerramento rejeita encerrada_em sem motivo",
    esperadas: ["ck_reserva_sessao_encerramento"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      const agendamento = await criarAgendamento(db, base, {
        pacienteId: base.paciente1Id,
        ...proximaJanela(),
      });
      return db.reservaSessao.create({
        data: {
          pacoteId: pacote.id,
          agendamentoId: agendamento.id,
          criadaPorUsuarioId: base.usuarioId,
          encerradaEm: new Date("2027-04-02T10:00:00Z"),
        },
      });
    },
  },
  {
    titulo: "ck_reserva_sessao_consumo_movimento rejeita motivo CONSUMO sem movimento",
    esperadas: ["ck_reserva_sessao_consumo_movimento"],
    executar: async (base) => {
      const pacote = await criarPacote(base);
      const agendamento = await criarAgendamento(db, base, {
        pacienteId: base.paciente1Id,
        ...proximaJanela(),
      });
      return db.reservaSessao.create({
        data: {
          pacoteId: pacote.id,
          agendamentoId: agendamento.id,
          criadaPorUsuarioId: base.usuarioId,
          encerradaEm: new Date("2027-04-02T10:00:00Z"),
          motivoEncerramento: "CONSUMO",
        },
      });
    },
  },
  {
    titulo: "ck_pacote_quantidade_positiva rejeita quantidade_contratada 0",
    esperadas: ["ck_pacote_quantidade_positiva"],
    executar: (base) => criarPacote(base, { quantidadeContratada: 0 }),
  },
  {
    titulo: "ck_pacote_cancelamento rejeita cancelado_em sem cancelado_por",
    esperadas: ["ck_pacote_cancelamento"],
    executar: (base) => criarPacote(base, { canceladoEm: new Date("2026-08-20T10:00:00Z") }),
  },
  {
    titulo: "ck_cobranca_valor_desconto_nao_negativo rejeita desconto negativo (violação isolada)",
    esperadas: ["ck_cobranca_valor_desconto_nao_negativo"],
    executar: (base) => criarCobranca(base, "10.00", "-1.00"),
  },
  {
    titulo: "ck_cobranca_valor_liquido_nao_negativo rejeita desconto maior que o bruto (violação isolada)",
    esperadas: ["ck_cobranca_valor_liquido_nao_negativo"],
    executar: (base) => criarCobranca(base, "10.00", "20.00"),
  },
  {
    // valor_bruto < 0 é matematicamente inseparável de uma violação irmã:
    // com desconto >= 0 o líquido fica negativo; com desconto < 0 o desconto
    // viola. A rejeição é garantida; o PostgreSQL reporta UMA das constraints
    // monetárias. A definição exata de ck_cobranca_valor_bruto_nao_negativo é
    // provada na existência (pg_get_constraintdef via catálogo).
    titulo: "ck_cobranca_valor_bruto_nao_negativo: bruto negativo é rejeitado (dupla violação inevitável)",
    esperadas: [
      "ck_cobranca_valor_bruto_nao_negativo",
      "ck_cobranca_valor_desconto_nao_negativo",
    ],
    executar: (base) => criarCobranca(base, "-1.00", "-1.00"),
  },
  {
    titulo: "ck_cobranca_origem rejeita AGENDAMENTO_AVULSO sem origem_agendamento_id",
    esperadas: ["ck_cobranca_origem"],
    executar: (base) =>
      db.cobranca.create({
        data: {
          pacienteId: base.paciente1Id,
          origemTipo: "AGENDAMENTO_AVULSO",
          valorBruto: "10.00",
          valorDesconto: "0.00",
          dataReferencia: new Date("2026-08-25"),
          criadoPorUsuarioId: base.usuarioId,
        },
      }),
  },
  {
    titulo: "ck_pagamento_valor_positivo rejeita valor 0",
    esperadas: ["ck_pagamento_valor_positivo"],
    executar: async (base) => {
      const cobranca = await criarCobranca(base, "100.00", "0.00");
      return db.pagamento.create({
        data: {
          cobrancaId: cobranca.id,
          valor: "0.00",
          formaPagamentoId: base.formaPagamentoId,
          recebidoEm: new Date("2026-08-25T10:00:00Z"),
          registradoPorUsuarioId: base.usuarioId,
        },
      });
    },
  },
  {
    titulo: "ck_registro_clinico_finalizacao rejeita FINALIZADO sem finalizado_em",
    esperadas: ["ck_registro_clinico_finalizacao"],
    executar: async (base) => {
      const atendimento = await criarAtendimento(base);
      return db.registroClinico.create({
        data: {
          atendimentoId: atendimento.id,
          pacienteId: base.paciente1Id,
          autorUsuarioId: base.usuarioId,
          estado: "FINALIZADO",
        },
      });
    },
  },
  {
    titulo: "ck_retificacao_clinica_efetivacao rejeita EFETIVADA sem efetivada_em",
    esperadas: ["ck_retificacao_clinica_efetivacao"],
    executar: async (base) => {
      const registro = await criarRegistroClinico(base, "EM_ELABORACAO");
      return db.retificacaoClinica.create({
        data: {
          registroOriginalId: registro.id,
          autorUsuarioId: base.usuarioId,
          justificativa: "justificativa sintética",
          estado: "EFETIVADA",
        },
      });
    },
  },
  {
    titulo: "ck_retificacao_clinica_justificativa rejeita justificativa em branco",
    esperadas: ["ck_retificacao_clinica_justificativa"],
    executar: async (base) => {
      const registro = await criarRegistroClinico(base, "EM_ELABORACAO");
      return db.retificacaoClinica.create({
        data: {
          registroOriginalId: registro.id,
          autorUsuarioId: base.usuarioId,
          justificativa: "   ",
          estado: "EM_ELABORACAO",
        },
      });
    },
  },
  {
    titulo: "ck_horario_funcionamento_intervalo rejeita hora_fim <= hora_inicio",
    esperadas: ["ck_horario_funcionamento_intervalo"],
    executar: (base) =>
      db.horarioFuncionamento.create({
        data: {
          clinicaId: base.clinicaId,
          diaSemana: 1,
          horaInicio: new Date("1970-01-01T10:00:00Z"),
          horaFim: new Date("1970-01-01T09:00:00Z"),
        },
      }),
  },
  {
    titulo: "ck_horario_funcionamento_dia_semana rejeita dia_semana 7",
    esperadas: ["ck_horario_funcionamento_dia_semana"],
    executar: (base) =>
      db.horarioFuncionamento.create({
        data: {
          clinicaId: base.clinicaId,
          diaSemana: 7,
          horaInicio: new Date("1970-01-01T08:00:00Z"),
          horaFim: new Date("1970-01-01T12:00:00Z"),
        },
      }),
  },
  {
    titulo: "ck_disponibilidade_profissional_intervalo rejeita hora_fim <= hora_inicio",
    esperadas: ["ck_disponibilidade_profissional_intervalo"],
    executar: (base) =>
      db.disponibilidadeProfissional.create({
        data: {
          profissionalId: base.profissionalId,
          diaSemana: 2,
          horaInicio: new Date("1970-01-01T14:00:00Z"),
          horaFim: new Date("1970-01-01T14:00:00Z"),
        },
      }),
  },
  {
    titulo: "ck_disponibilidade_profissional_dia_semana rejeita dia_semana 7",
    esperadas: ["ck_disponibilidade_profissional_dia_semana"],
    executar: (base) =>
      db.disponibilidadeProfissional.create({
        data: {
          profissionalId: base.profissionalId,
          diaSemana: 7,
          horaInicio: new Date("1970-01-01T08:00:00Z"),
          horaFim: new Date("1970-01-01T12:00:00Z"),
        },
      }),
  },
  {
    titulo: "ck_sessao_autenticacao_expiracao rejeita expira_em <= criada_em",
    esperadas: ["ck_sessao_autenticacao_expiracao"],
    executar: (base) =>
      db.sessaoAutenticacao.create({
        data: {
          usuarioId: base.usuarioId,
          estado: "ATIVA",
          criadaEm: new Date("2026-08-25T10:00:00Z"),
          expiraEm: new Date("2026-08-25T09:00:00Z"),
        },
      }),
  },
];

describe("GUARDA 2 — efeito das CHECK constraints (violação rejeitada com 23514)", () => {
  // ck_paciente_cpf_formato: efeito REUTILIZADO — já provado permanentemente
  // em constraint-errors.spec.ts (V-03, caso B) e patient-invariants.spec.ts
  // (T-CPF-03). Este bloco cobre as 24 demais; a existência das 25 está no
  // bloco de catálogo acima.
  for (const caso of casosCheck) {
    it(caso.titulo, async () => {
      const base = await criarBaseSintetica(db);
      const erro = await capturarErro(() => caso.executar(base));
      const violacao = identificarViolacao(erro);
      expect(violacao?.classe).toBe("CHECK");
      expect(violacao?.sqlstate).toBe("23514");
      expect(caso.esperadas).toContain(violacao?.constraint ?? "<sem nome>");
    });
  }
});

// ---------------------------------------------------------------------------
// B. EFEITO — índices parciais
// ---------------------------------------------------------------------------

describe("GUARDA 2 — efeito dos índices parciais", () => {
  it("ux_reserva_sessao_ativa_agendamento: segunda reserva ATIVA do mesmo agendamento é rejeitada (23505); reserva encerrada libera", async () => {
    const base = await criarBaseSintetica(db);
    const pacote = await criarPacote(base);
    const agendamento = await criarAgendamento(db, base, {
      pacienteId: base.paciente1Id,
      ...proximaJanela(),
    });
    const primeira = await db.reservaSessao.create({
      data: {
        pacoteId: pacote.id,
        agendamentoId: agendamento.id,
        criadaPorUsuarioId: base.usuarioId,
      },
    });

    const erro = await capturarErro(() =>
      db.reservaSessao.create({
        data: {
          pacoteId: pacote.id,
          agendamentoId: agendamento.id,
          criadaPorUsuarioId: base.usuarioId,
        },
      }),
    );
    const violacao = identificarViolacao(erro);
    expect(violacao?.classe).toBe("UNIQUE");
    expect(violacao?.sqlstate).toBe("23505");
    expect(violacao?.constraint).toBe("ux_reserva_sessao_ativa_agendamento");

    // Predicado comprovado pelo comportamento: encerrada a primeira, nova
    // reserva ativa do MESMO agendamento é aceita (histórico preservado).
    await db.reservaSessao.update({
      where: { id: primeira.id },
      data: {
        encerradaEm: new Date("2027-04-03T10:00:00Z"),
        motivoEncerramento: "DESVINCULACAO",
      },
    });
    const nova = await db.reservaSessao.create({
      data: {
        pacoteId: pacote.id,
        agendamentoId: agendamento.id,
        criadaPorUsuarioId: base.usuarioId,
      },
    });
    expect(nova.id).not.toBe(primeira.id);
  });

  // ux_movimento_sessao_consumo_atendimento_pacote: efeito REUTILIZADO —
  // provado permanentemente em constraint-errors.spec.ts (C-04: retry de
  // consumo idempotente sobre 23505 do próprio índice).

  it("índices parciais não-unique são utilizáveis pelo planner sob o predicado (método validado na E-10)", async () => {
    const consultas: Array<{ indice: string; sql: string }> = [
      {
        indice: "ix_reserva_sessao_ativa_pacote",
        sql: `SELECT id FROM reserva_sessao WHERE pacote_id = '${randomUUID()}' AND encerrada_em IS NULL`,
      },
      {
        indice: "ix_agendamento_pacote",
        sql: `SELECT id FROM agendamento WHERE pacote_id = '${randomUUID()}'`,
      },
      {
        indice: "ix_pacote_validade_ativa",
        sql: `SELECT id FROM pacote WHERE validade_ate <= DATE '2026-09-30' AND cancelado_em IS NULL`,
      },
      {
        indice: "ix_cobranca_data_referencia_ativa",
        sql: `SELECT id FROM cobranca WHERE data_referencia BETWEEN DATE '2026-08-01' AND DATE '2026-08-31' AND cancelada_em IS NULL`,
      },
    ];
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      for (const consulta of consultas) {
        const plano = await tx.$queryRawUnsafe<Array<Record<string, string>>>(
          `EXPLAIN (FORMAT TEXT) ${consulta.sql}`,
        );
        const texto = plano.map((linha) => Object.values(linha).join(" ")).join("\n");
        expect(texto).toContain(consulta.indice);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// B. EFEITO — exclusion constraints (23P01) e extensão
// ---------------------------------------------------------------------------

describe("GUARDA 2 — efeito das exclusion constraints", () => {
  // ex_agendamento_profissional: efeito REUTILIZADO — provado permanentemente
  // em constraint-errors.spec.ts (C-01) e scheduling-concurrency.spec.ts
  // (T-AGD-CONCURRENCY, sob concorrência real).

  it("ex_agendamento_paciente: sobreposição do MESMO paciente com profissionais distintos é rejeitada (23P01) — prova também a extensão btree_gist funcional", async () => {
    const base = await criarBaseSintetica(db);
    const outroProfissional = await db.profissional.create({
      data: { nome: "Profissional Sintético Dois E16", ativo: true },
    });
    await db.agendamento.create({
      data: {
        pacienteId: base.paciente1Id,
        profissionalId: base.profissionalId,
        servicoId: base.servicoId,
        inicio: new Date("2027-05-10T13:00:00Z"),
        fim: new Date("2027-05-10T14:00:00Z"),
        estado: "AGENDADO",
        modalidade: "AVULSO",
        criadoPorUsuarioId: base.usuarioId,
      },
    });
    const erro = await capturarErro(() =>
      db.agendamento.create({
        data: {
          pacienteId: base.paciente1Id,
          profissionalId: outroProfissional.id,
          servicoId: base.servicoId,
          inicio: new Date("2027-05-10T13:30:00Z"),
          fim: new Date("2027-05-10T14:30:00Z"),
          estado: "AGENDADO",
          modalidade: "AVULSO",
          criadoPorUsuarioId: base.usuarioId,
        },
      }),
    );
    const violacao = identificarViolacao(erro);
    expect(violacao?.classe).toBe("EXCLUSION");
    expect(violacao?.sqlstate).toBe("23P01");
    expect(violacao?.constraint).toBe("ex_agendamento_paciente");
  });
});

// ---------------------------------------------------------------------------
// B. EFEITO — triggers de imutabilidade clínica condicional
// ---------------------------------------------------------------------------

describe("GUARDA 2 — efeito das triggers condicionais", () => {
  it("registro_clinico: draft permanece mutável; FINALIZADO rejeita UPDATE e DELETE (P0001)", async () => {
    const base = await criarBaseSintetica(db);
    const draft = await criarRegistroClinico(base, "EM_ELABORACAO");
    // draft mutável (a trigger é CONDICIONAL — não pode ser "boa demais")
    await db.registroClinico.update({
      where: { id: draft.id },
      data: { autorUsuarioId: base.usuarioId },
    });
    // primeira finalização permitida
    await db.registroClinico.update({
      where: { id: draft.id },
      data: { estado: "FINALIZADO", finalizadoEm: new Date("2027-05-01T12:00:00Z") },
    });

    const erroUpdate = await capturarErro(() =>
      db.registroClinico.update({
        where: { id: draft.id },
        data: { estado: "EM_ELABORACAO", finalizadoEm: null },
      }),
    );
    expect(extrairSqlstate(erroUpdate)).toBe("P0001");

    const erroDelete = await capturarErro(() =>
      db.registroClinico.delete({ where: { id: draft.id } }),
    );
    expect(extrairSqlstate(erroDelete)).toBe("P0001");
  });

  it("retificacao_clinica: draft permanece mutável; EFETIVADA rejeita UPDATE e DELETE (P0001)", async () => {
    const base = await criarBaseSintetica(db);
    const registro = await criarRegistroClinico(base, "EM_ELABORACAO");
    const retificacao = await db.retificacaoClinica.create({
      data: {
        registroOriginalId: registro.id,
        autorUsuarioId: base.usuarioId,
        justificativa: "retificação sintética",
        estado: "EM_ELABORACAO",
      },
    });
    await db.retificacaoClinica.update({
      where: { id: retificacao.id },
      data: { justificativa: "retificação sintética revisada" },
    });
    await db.retificacaoClinica.update({
      where: { id: retificacao.id },
      data: { estado: "EFETIVADA", efetivadaEm: new Date("2027-05-01T13:00:00Z") },
    });

    const erroUpdate = await capturarErro(() =>
      db.retificacaoClinica.update({
        where: { id: retificacao.id },
        data: { justificativa: "tentativa pós-efetivação" },
      }),
    );
    expect(extrairSqlstate(erroUpdate)).toBe("P0001");

    const erroDelete = await capturarErro(() =>
      db.retificacaoClinica.delete({ where: { id: retificacao.id } }),
    );
    expect(extrairSqlstate(erroDelete)).toBe("P0001");
  });
});

// ---------------------------------------------------------------------------
// B. EFEITO — coluna gerada valor_liquido
// ---------------------------------------------------------------------------

describe("GUARDA 2 — efeito da coluna gerada valor_liquido", () => {
  it("recalcula quando as parcelas mudam; escrita direta permanece rejeitada (428C9)", async () => {
    const base = await criarBaseSintetica(db);
    const cobranca = await criarCobranca(base, "300.00", "45.50");
    const criada = await db.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(Number(criada.valorLiquido)).toBe(254.5);

    await db.cobranca.update({
      where: { id: cobranca.id },
      data: { valorDesconto: "120.25" },
    });
    const recalculada = await db.cobranca.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(Number(recalculada.valorLiquido)).toBe(179.75);

    // escrita direta via SQL cru — a barreira não depende de disciplina de código
    const erroUpdate = await capturarErro(() =>
      db.$executeRawUnsafe(
        `UPDATE cobranca SET valor_liquido = 1.00 WHERE id = '${cobranca.id}'`,
      ),
    );
    expect(extrairSqlstate(erroUpdate)).toBe("428C9");
  });
});

// ---------------------------------------------------------------------------
// B. EFEITO — REVOKE append-only (não coberto pela Guarda 3: --no-privileges)
// ---------------------------------------------------------------------------

describe("GUARDA 2 — efeito dos REVOKEs append-only como tlf_app", () => {
  const colunaMutavel: Record<string, string> = {
    evento_auditoria: "acao",
    movimento_sessao: "quantidade",
    pagamento: "valor",
    estorno: "motivo",
    historico_agendamento: "operacao",
  };

  for (const { tabela } of inventario.tabelasAppendOnly) {
    it(`${tabela}: UPDATE e DELETE são rejeitados por privilégio (42501); SELECT permanece`, async () => {
      const coluna = colunaMutavel[tabela] as string;
      const erroUpdate = await capturarErro(() =>
        db.$executeRawUnsafe(`UPDATE ${tabela} SET ${coluna} = ${coluna} WHERE false`),
      );
      expect(extrairSqlstate(erroUpdate)).toBe("42501");

      const erroDelete = await capturarErro(() =>
        db.$executeRawUnsafe(`DELETE FROM ${tabela} WHERE false`),
      );
      expect(extrairSqlstate(erroDelete)).toBe("42501");

      const contagem = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS n FROM ${tabela}`,
      );
      expect(contagem).toHaveLength(1);
    });
  }

  it("evento_auditoria: INSERT permanece permitido e a linha inserida é imutável na prática", async () => {
    const base = await criarBaseSintetica(db);
    const evento = await db.eventoAuditoria.create({
      data: {
        ocorridoEm: new Date("2026-08-25T10:00:00Z"),
        atorUsuarioId: base.usuarioId,
        acao: "guarda2.prova_sintetica",
        alvoTipo: "sintetico",
        resultado: "SUCESSO_SINTETICO",
        correlacaoId: randomUUID(),
      },
    });
    const erro = await capturarErro(() =>
      db.$executeRawUnsafe(
        `UPDATE evento_auditoria SET resultado = 'ALTERADO' WHERE id = '${evento.id}'`,
      ),
    );
    expect(extrairSqlstate(erro)).toBe("42501");
    const intacto = await db.eventoAuditoria.findUniqueOrThrow({ where: { id: evento.id } });
    expect(intacto.resultado).toBe("SUCESSO_SINTETICO");
  });

  // INSERT permitido em movimento_sessao, pagamento e estorno: REUTILIZADO —
  // exercitado permanentemente por package-invariants.spec.ts,
  // financial-invariants.spec.ts e constraint-errors.spec.ts.
});
