// TechLab Fisio — módulo de profissionais (M3).
//
// Etapa 2.3B: `ProfissionalService.alterarSituacao` nasceu como fluxo interno,
// sem rota. Fatia PRO-A (`docs/18`, D-PRO1-01): o módulo passa a expor o
// cadastro (PRO-001), os serviços realizados (PRO-004) e a situação (PRO-005)
// por `ProfissionaisController`, sob `profissionais.gerenciar`.
//
// PRO-003 (`docs/16`, D-PRO3-02): `DisponibilidadeController` acrescenta
// `GET`/`PUT /profissionais/:profissionalId/disponibilidade`, sob a MESMA
// permissão (D-PRO3-08 — nenhuma permissão nova) e SEM auditoria (D-PRO3-09).
// A regra reutilizável que a agenda consumirá vive em
// `../agenda/verificador-disponibilidade-profissional.ts` e, como o
// `VerificadorHorarioFuncionamento` de CFG-002, NÃO é registrada em módulo
// algum enquanto a fatia de agenda não existir.
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
import { DisponibilidadeController } from "./disponibilidade.controller.js";
import { DisponibilidadeService } from "./disponibilidade.service.js";
import { ProfissionaisController } from "./profissionais.controller.js";
import { ProfissionaisService } from "./profissionais.service.js";
import { ProfissionalService } from "./profissional.service.js";

@Module({
  imports: [DatabaseModule, AuthzModule, AuditModule],
  controllers: [ProfissionaisController, DisponibilidadeController],
  providers: [ProtecaoCsrfGuard, ProfissionalService, ProfissionaisService, DisponibilidadeService],
  exports: [ProfissionalService, ProfissionaisService, DisponibilidadeService],
})
export class ProfissionalModule {}
