// TechLab Fisio — ponto de entrada público de `@techlab-fisio/database`
// (Etapa 2.3A — Bloco C).
//
// Este arquivo NÃO altera a camada de persistência encerrada (schema,
// migrations, golden, constraints, triggers, regras): ele apenas materializa
// como API pública consumível por outros workspaces o que o README deste
// pacote já documentava como superfície pública — o mapeamento medido de
// erros por constraint (V-03, decisão C-6).
//
// Etapa 2.3B: a superfície pública ganhou a fábrica do cliente de
// persistência (`criarClientePersistencia`) — este pacote é o proprietário da
// instanciação do Prisma Client + adapter. O Prisma Client gerado
// (`generated/prisma/`) continua NÃO sendo reexportado como módulo: somente a
// fábrica e os tipos mínimos necessários ao consumo (cliente e transação) são
// públicos; provider, ciclo de vida e credenciais pertencem à aplicação.

export {
  criarClientePersistencia,
} from "./persistencia/cliente-persistencia.js";

export type {
  ClientePersistencia,
  OpcoesClientePersistencia,
  TransacaoPersistencia,
} from "./persistencia/cliente-persistencia.js";

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
