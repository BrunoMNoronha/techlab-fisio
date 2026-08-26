// TechLab Fisio — ponto de entrada público de `@techlab-fisio/database`
// (Etapa 2.3A — Bloco C).
//
// Este arquivo NÃO altera a camada de persistência encerrada (schema,
// migrations, golden, constraints, triggers, regras): ele apenas materializa
// como API pública consumível por outros workspaces o que o README deste
// pacote já documentava como superfície pública — o mapeamento medido de
// erros por constraint (V-03, decisão C-6).
//
// O Prisma Client gerado (`generated/prisma/`) NÃO é reexportado aqui de
// propósito: ele é artefato de `prisma generate` (não versionado) e a decisão
// de como expô-lo ao backend (provider, ciclo de vida, credenciais) pertence
// à fatia que criar o primeiro fluxo que precise de banco — não à fundação.

export {
  CONSTRAINT_CONSUMO_UNICO,
  CONSTRAINTS_CONFLITO_AGENDA,
  identificarViolacao,
  ehConsumoDuplicado,
  ehConflitoAgenda,
} from "./errors/constraint-map.js";

export type {
  ClasseViolacao,
  ViolacaoConstraint,
} from "./errors/constraint-map.js";
