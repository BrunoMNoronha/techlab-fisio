// TechLab Fisio — módulo dos motivos de cancelamento (CFG-005; `docs/14` §3.13).
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
import { MotivosCancelamentoController } from "./motivos-cancelamento.controller.js";
import { MotivosCancelamentoService } from "./motivos-cancelamento.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [MotivosCancelamentoController],
  providers: [ProtecaoCsrfGuard, MotivosCancelamentoService],
  exports: [MotivosCancelamentoService],
})
export class MotivosCancelamentoModule {}
