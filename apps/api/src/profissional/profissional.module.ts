// TechLab Fisio — módulo de profissionais (M3).
//
// Etapa 2.3B: `ProfissionalService.alterarSituacao` nasceu como fluxo interno,
// sem rota. Fatia PRO-A (`docs/18`, D-PRO1-01): o módulo passa a expor o
// cadastro (PRO-001), os serviços realizados (PRO-004) e a situação (PRO-005)
// por `ProfissionaisController`, sob `profissionais.gerenciar`.
//
// IMPORTS:
//   AuthzModule ... @RequerPermissao (guards de sessão e permissão) e reexporta
//                   AuthModule e DatabaseModule;
//   AuditModule ... AuditWriter + validator fail-closed para
//                   profissional.situacao.alterada.
//
// ProtecaoCsrfGuard é provida no injetor do módulo do controller.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProfissionaisController } from "./profissionais.controller.js";
import { ProfissionaisService } from "./profissionais.service.js";
import { ProfissionalService } from "./profissional.service.js";

@Module({
  imports: [DatabaseModule, AuthzModule, AuditModule],
  controllers: [ProfissionaisController],
  providers: [ProtecaoCsrfGuard, ProfissionalService, ProfissionaisService],
  exports: [ProfissionalService, ProfissionaisService],
})
export class ProfissionalModule {}
