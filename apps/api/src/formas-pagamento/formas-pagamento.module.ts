// TechLab Fisio — módulo das formas de pagamento (CFG-004; `docs/14` §3.12).
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
import { FormasPagamentoController } from "./formas-pagamento.controller.js";
import { FormasPagamentoService } from "./formas-pagamento.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [FormasPagamentoController],
  providers: [ProtecaoCsrfGuard, FormasPagamentoService],
  exports: [FormasPagamentoService],
})
export class FormasPagamentoModule {}
