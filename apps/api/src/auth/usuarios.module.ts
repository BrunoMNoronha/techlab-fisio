// TechLab Fisio — módulo de gestão de usuários (AUT-005 / D-2.3D-21).
//
// Módulo PRÓPRIO para manter a integridade modular e a fronteira da F3
// do AuthModule estritamente preservada (sem controllers ou rotas excedentes).
//
// IMPORTS:
//   AuthzModule ... traz @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule (SessaoService) e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para usuario.situacao.alterada.
//
// ProtecaoCsrfGuard é provida no injetor do módulo do controller.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsuariosController } from "./usuarios.controller.js";
import { UsuariosService } from "./usuarios.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [UsuariosController],
  providers: [
    ProtecaoCsrfGuard,
    UsuariosService,
  ],
  exports: [UsuariosService],
})
export class UsuariosModule {}
