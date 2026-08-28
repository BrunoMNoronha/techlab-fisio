// TechLab Fisio — módulo de autenticação (Etapa 2.3D-B / F1 + F2).
//
// NESTA FATIA ele contém EXCLUSIVAMENTE a fronteira de credenciais
// (`D-2.3D-02`/`D-2.3D-03`, F1) e a primitiva interna de sessão
// (`D-2.3D-01`/`D-2.3D-04`/`D-2.3D-05`, F2). DELIBERADAMENTE sem controller e
// sem rota — o mesmo precedente de `ProfissionalModule` e `CobrancaModule`:
// fatia técnica interna, exercitada por testes.
//
// F2 passou a importar `DatabaseModule`: a sessão é PERSISTIDA, e a fatia
// exige de fato a fronteira transacional. NÃO importa `AuditModule`: o evento
// `usuario.autenticacao` (`D-2.3D-12`) e a auditoria de logout pertencem à F3
// e não nascem aqui por antecipação.
//
// Cookies, CSRF, endpoints, rate limiting, guards, RBAC, recuperação de senha
// e OpenAPI pertencem a F3..F7 e NÃO nascem aqui.

import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { CredencialService } from "./credencial.service.js";
import { RELOGIO_SESSAO, relogioDoSistema } from "./relogio-sessao.js";
import { SessaoService } from "./sessao.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    CredencialService,
    // Relógio de PRODUÇÃO — o relógio do sistema. Substituído apenas no
    // container de testes, para alcançar as bordas exatas de `D-2.3D-04`.
    { provide: RELOGIO_SESSAO, useValue: relogioDoSistema },
    SessaoService,
  ],
  exports: [CredencialService, SessaoService],
})
export class AuthModule {}
