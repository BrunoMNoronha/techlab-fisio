// TechLab Fisio — módulo de configuração da clínica única (fatia CFG-001A; `docs/14`).
//
// IMPORTS:
//   AuthzModule ... @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para configuracao.alterada.
//
// ProtecaoCsrfGuard é provida no injetor do módulo do controller.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ClinicaController } from "./clinica.controller.js";
import { ClinicaService } from "./clinica.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [ClinicaController],
  providers: [ProtecaoCsrfGuard, ClinicaService],
  exports: [ClinicaService],
})
export class ClinicaModule {}
