// TechLab Fisio — módulo do fluxo interno de profissional (Etapa 2.3B).
//
// DELIBERADAMENTE sem controller e sem rota: a operação
// `profissional.situacao.alterada` é uma fatia técnica interna (D-1 da
// autorização da 2.3B), exercitada por testes de integração. A exposição
// HTTP futura exige antes RBAC real (`profissionais.gerenciar`), que NÃO
// está implementado.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProfissionalService } from "./profissional.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [ProfissionalService],
  exports: [ProfissionalService],
})
export class ProfissionalModule {}
