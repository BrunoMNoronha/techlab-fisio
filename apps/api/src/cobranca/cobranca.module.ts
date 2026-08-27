// TechLab Fisio — módulo do fluxo interno de desconto de cobrança
// (Etapa 2.3C; FIN-003, PROP-RN-2.3C-01). SEM controller: nenhuma rota HTTP
// existe nesta fatia — a operação não está disponível ao usuário.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { CobrancaService } from "./cobranca.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [CobrancaService],
  exports: [CobrancaService],
})
export class CobrancaModule {}
