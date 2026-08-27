// TechLab Fisio — módulo de autenticação (Etapa 2.3D-B / F1).
//
// NESTA FATIA ele contém EXCLUSIVAMENTE a fronteira de credenciais
// (`D-2.3D-02`/`D-2.3D-03`). DELIBERADAMENTE sem controller e sem rota — o
// mesmo precedente de `ProfissionalModule` e `CobrancaModule`: fatia técnica
// interna, exercitada por testes.
//
// NÃO importa `DatabaseModule`: a F1 não consulta usuário. NÃO importa
// `AuditModule`: o evento `usuario.autenticacao` (`D-2.3D-12`) pertence à F3.
// Ambos entrarão quando a fatia que realmente os exigir for autorizada — não
// por antecipação.
//
// `SessaoService`, cookies, CSRF, guards, RBAC, recuperação de senha e OpenAPI
// pertencem a F2..F7 e NÃO nascem aqui.

import { Module } from "@nestjs/common";

import { CredencialService } from "./credencial.service.js";

@Module({
  providers: [CredencialService],
  exports: [CredencialService],
})
export class AuthModule {}
