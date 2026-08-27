// TechLab Fisio — módulo de auditoria da aplicação (P-BACK-01).
//
// Norma + enforcement + escrita: catálogo tipado (D-AUD-01/02), representação
// de `alvo_tipo` (D-AUD-03), validação fail-closed de contexto (D-AUD-07/08)
// e, desde a Etapa 2.3B, o AuditWriter — escrita transacional do evento já
// validado (create-only, mapeamento explícito). A emissão pertence aos fluxos
// que recebem o cliente transacional — por isso continua não existindo aqui
// repository genérico, event bus, decorators ou pipeline.

import { Module } from "@nestjs/common";

import { AuditContextValidator } from "./audit-context.validator.js";
import { AuditWriter } from "./audit-writer.js";

@Module({
  providers: [AuditContextValidator, AuditWriter],
  exports: [AuditContextValidator, AuditWriter],
})
export class AuditModule {}
