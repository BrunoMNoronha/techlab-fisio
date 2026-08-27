// TechLab Fisio — módulo raiz do monólito modular (Etapa 2.3A; provider de
// persistência acrescentado na Etapa 2.3B).
//
// O módulo raiz registra somente o que existe de fato: o health check de
// infraestrutura, a norma de auditoria da aplicação (P-BACK-01) e, desde a
// 2.3B, o provider de persistência (conexão eager — a API NÃO sobe sem banco
// válido e sem a postura de privilégios de runtime). Módulos funcionais com
// exposição HTTP (autenticação, pacientes, agenda, ...) pertencem a fatias
// futuras e NÃO nascem aqui.

import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProfissionalModule } from "./profissional/profissional.module.js";

@Module({
  imports: [HealthModule, AuditModule, DatabaseModule, ProfissionalModule],
})
export class AppModule {}
