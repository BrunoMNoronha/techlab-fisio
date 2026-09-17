// TechLab Fisio — módulo de configuração da clínica única (fatias CFG-001A e CFG-002; `docs/14`).
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
import { HorarioFuncionamentoController } from "./horario-funcionamento.controller.js";
import { HorarioFuncionamentoService } from "./horario-funcionamento.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [ClinicaController, HorarioFuncionamentoController],
  providers: [ProtecaoCsrfGuard, ClinicaService, HorarioFuncionamentoService],
  exports: [ClinicaService],
})
export class ClinicaModule {}
