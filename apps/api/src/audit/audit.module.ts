// TechLab Fisio — módulo de auditoria da aplicação (P-BACK-01).
//
// Nesta fatia o módulo é NORMA + enforcement: catálogo tipado (D-AUD-01/02),
// representação de `alvo_tipo` (D-AUD-03) e validação fail-closed de
// contexto (D-AUD-07/08). A emissão efetiva de eventos pertence às fatias
// que criarem os fluxos correspondentes — por isso não há aqui repository,
// event bus, decorators ou pipeline.

import { Module } from "@nestjs/common";

import { AuditContextValidator } from "./audit-context.validator.js";

@Module({
  providers: [AuditContextValidator],
  exports: [AuditContextValidator],
})
export class AuditModule {}
