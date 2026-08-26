// TechLab Fisio — módulo raiz do monólito modular (Etapa 2.3A).
//
// A fundação registra somente o que existe de fato: o health check de
// infraestrutura (Bloco D) e a norma de auditoria da aplicação (P-BACK-01,
// Bloco E/F). Módulos funcionais (autenticação, pacientes, agenda, ...)
// pertencem a fatias futuras e NÃO nascem aqui.

import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule, AuditModule],
})
export class AppModule {}
