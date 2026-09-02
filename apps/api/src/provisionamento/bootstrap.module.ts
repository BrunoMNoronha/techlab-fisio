// TechLab Fisio — módulo do BOOTSTRAP do primeiro Administrador
// (Etapa 2.3D-B / F5 — fatia corretiva).
//
// CONTEXTO MÍNIMO do bootstrap: persistência (fronteira transacional única),
// auditoria (`AuditWriter` + validator fail-closed, para o evento
// `usuario.papeis.alterados` de `D-2.3D-10`) e credencial (Argon2id da F1).
//
// `CredencialService` É PROVIDO AQUI, e NÃO importado de `AuthModule`, por
// fronteira — não por duplicação de política:
//   - a política Argon2id NÃO é replicada: é a MESMA classe da F1 e a MESMA
//     constante `POLITICA_ARGON2` (`D-2.3D-02`). Nenhum parâmetro é
//     redeclarado nesta fatia;
//   - importar `AuthModule` arrastaria para um processo de linha de comando o
//     `AuthController`, o `APP_FILTER` de erros HTTP, o `LimitadorLogin` e a
//     fábrica `POLITICA_COOKIE_SESSAO`, que faz FAIL-FAST exigindo
//     `TLF_AMBIENTE` (`R-2.3D-04`). O provisionamento não emite cookie e não
//     deve depender da configuração de cookie para rodar.
// Decisão local declarada em `docs/10`, reversível sem tocar decisão
// homologada.
//
// ESTE MÓDULO NÃO É IMPORTADO PELO `AppModule` — e essa ausência é a
// materialização mecânica do "bootstrap MANUAL" de `D-2.3D-10`: o processo
// normal da API não resolve `BootstrapAdministradorService` e, portanto, não
// pode executá-lo. A ausência é PROVADA por teste, não prometida.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { CredencialService } from "../auth/credencial.service.js";
import { DatabaseModule } from "../database/database.module.js";
import { BootstrapAdministradorService } from "./bootstrap-administrador.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [CredencialService, BootstrapAdministradorService],
  exports: [BootstrapAdministradorService],
})
export class BootstrapModule {}
