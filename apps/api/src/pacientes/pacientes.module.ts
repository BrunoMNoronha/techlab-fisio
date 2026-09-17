// TechLab Fisio — módulo da fatia mínima de pacientes (PAC-A; `docs/17`).
//
// IMPORTS:
//   AuthzModule ... @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para as ações de paciente.
//
// ProtecaoCsrfGuard é provida no injetor do módulo do controller.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { PacientesController } from "./pacientes.controller.js";
import { PacientesService } from "./pacientes.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [PacientesController],
  providers: [ProtecaoCsrfGuard, PacientesService],
  exports: [PacientesService],
})
export class PacientesModule {}
