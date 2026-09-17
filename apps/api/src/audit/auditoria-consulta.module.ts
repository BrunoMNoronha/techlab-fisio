// TechLab Fisio — módulo da consulta da trilha de auditoria (AUD-004 /
// `PBACK-AUD-08`, `docs/09` §13.9).
//
// Separado do `AuditModule` de propósito: o `AuthzModule` (guards RBAC)
// importa o `AuditModule` para emitir `autorizacao.negada`; registrar aqui a
// rota protegida por `@RequerPermissao` dentro do `AuditModule` criaria
// importação circular. Este módulo NÃO importa `AuditModule` nem o
// `AuditWriter` — a consulta não emite evento de auditoria.

import { Module } from "@nestjs/common";

import { AuthzModule } from "../authz/authz.module.js";
import { AuditController } from "./audit.controller.js";
import { AuditQueryService } from "./audit-query.service.js";

@Module({
  imports: [AuthzModule],
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditoriaConsultaModule {}
