// TechLab Fisio — módulo do catálogo de serviços (CFG-003; `docs/14` §3.11).
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
import { ServicosController } from "./servicos.controller.js";
import { ServicosService } from "./servicos.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [ServicosController],
  providers: [ProtecaoCsrfGuard, ServicosService],
  exports: [ServicosService],
})
export class ServicosModule {}
