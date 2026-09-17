// TechLab Fisio — contexto mínimo do provisionamento da clínica (fatia CFG-001B;
// `docs/14` D-CFG-12).
//
// Fora do `AppModule`: só `provisionamento/cli.ts` o carrega, via
// `createApplicationContext` — sem servidor HTTP, sem rota. Não provê
// `CredencialService`: o comando `bootstrap-clinica` não depende de Argon2.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { BootstrapClinicaService } from "./bootstrap-clinica.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [BootstrapClinicaService],
  exports: [BootstrapClinicaService],
})
export class BootstrapClinicaModule {}
