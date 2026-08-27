// TechLab Fisio — E-14 — fixtures sintéticas mínimas compartilhadas.
//
// Dados 100% sintéticos (TLF-BASE-V1 §10): nenhum nome real, nenhum CPF real,
// nenhum contato real, nenhum conteúdo clínico realista. CPFs usados nos specs
// interessam à persistência apenas pela FORMA homologada de 11 dígitos
// (docs/07 §11.4.1) — nenhum algoritmo de dígito verificador é introduzido.
//
// Diferente do padrão de rollback da E-12, os specs da E-14 COMMITAM dados
// (os cenários de concorrência exigem estado commitado observável por outras
// conexões); a limpeza determinística entre testes é o truncamento da E-13
// (test/setup.ts).

import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

type Escritor = PrismaClient | Prisma.TransactionClient;

export interface BaseSintetica {
  usuarioId: string;
  clinicaId: string;
  servicoId: string;
  profissionalId: string;
  paciente1Id: string;
  paciente2Id: string;
  formaPagamentoId: string;
}

/** Entidades base exigidas pelas FKs NOT NULL dos cenários da E-14. */
export async function criarBaseSintetica(db: Escritor): Promise<BaseSintetica> {
  const sufixo = randomUUID().slice(0, 8);
  const usuario = await db.usuario.create({
    data: {
      email: `spec-e14-${sufixo}@sintetico.local`,
      senhaHash: "hash-sintetico-spec",
      nome: "Usuário Sintético E14",
      ativo: true,
    },
  });
  const clinica = await db.clinica.create({
    data: { nomeCadastral: "Clínica Sintética E14", fusoHorario: "America/Sao_Paulo" },
  });
  const servico = await db.servico.create({
    data: {
      clinicaId: clinica.id,
      nome: "Serviço Sintético E14",
      duracaoMin: 60,
      precoReferencia: "100.00",
      ativo: true,
    },
  });
  const profissional = await db.profissional.create({
    data: { nome: "Profissional Sintético E14", ativo: true },
  });
  const paciente1 = await db.paciente.create({
    data: { nome: "Paciente Sintético Um E14", ativo: true },
  });
  const paciente2 = await db.paciente.create({
    data: { nome: "Paciente Sintético Dois E14", ativo: true },
  });
  const formaPagamento = await db.formaPagamento.create({
    data: { clinicaId: clinica.id, descricao: "Forma Sintética E14", ativo: true },
  });
  return {
    usuarioId: usuario.id,
    clinicaId: clinica.id,
    servicoId: servico.id,
    profissionalId: profissional.id,
    paciente1Id: paciente1.id,
    paciente2Id: paciente2.id,
    formaPagamentoId: formaPagamento.id,
  };
}

/** Agendamento sintético; janelas distintas evitam as exclusion constraints. */
export function criarAgendamento(
  db: Escritor,
  base: BaseSintetica,
  opts: {
    pacienteId: string;
    inicio: string;
    fim: string;
    modalidade?: "AVULSO" | "PACOTE";
    pacoteId?: string;
  },
) {
  return db.agendamento.create({
    data: {
      pacienteId: opts.pacienteId,
      profissionalId: base.profissionalId,
      servicoId: base.servicoId,
      inicio: new Date(opts.inicio),
      fim: new Date(opts.fim),
      estado: "AGENDADO",
      modalidade: opts.modalidade ?? "AVULSO",
      ...(opts.pacoteId === undefined ? {} : { pacoteId: opts.pacoteId }),
      criadoPorUsuarioId: base.usuarioId,
    },
  });
}

/**
 * Valor sintético para `sessao_autenticacao.token_hash` (Etapa 2.3D-B / F0,
 * `D-2.3D-01`). A F0 prova PERSISTÊNCIA, não lógica de autenticação: nenhum
 * SHA-256 é calculado aqui e nenhum segredo real existe. A coluna guardará o
 * verificador do segredo de `<sessao_id>.<segredo>`; para o banco ela é apenas
 * um `text NOT NULL`, e é exatamente isso que os specs desta fatia exercitam.
 */
export const TOKEN_HASH_SINTETICO = "token-hash-sintetico-f0-sem-valor-real";
