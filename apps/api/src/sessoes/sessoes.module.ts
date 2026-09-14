// TechLab Fisio — módulo de gestão administrativa de sessões (P-2.3D-07 / AUT-002).
//
// Módulo PRÓPRIO, e não uma extensão do AuthModule: a fronteira da F3 é
// provada por igualdade exata (controllers === [AuthController], imports
// === [DatabaseModule, AuditModule], exports fechados).
//
// IMPORTS:
//   AuthzModule ... traz @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule (SessaoService) e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para usuario.sessao.revogacao.
//
// ProtecaoCsrfGuard é provida no injetor do módulo do controller.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { SessoesController } from "./sessoes.controller.js";
import { SessoesService } from "./sessoes.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [SessoesController],
  providers: [
    ProtecaoCsrfGuard,
    SessoesService,
  ],
})
export class SessoesModule {}
