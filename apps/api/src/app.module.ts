// TechLab Fisio — módulo raiz do monólito modular (Etapa 2.3A).
//
// A fundação registra somente o que existe de fato: o health check de
// infraestrutura (Bloco D). Módulos funcionais (autenticação, pacientes,
// agenda, ...) pertencem a fatias futuras e NÃO nascem aqui.

import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [HealthModule],
})
export class AppModule {}
