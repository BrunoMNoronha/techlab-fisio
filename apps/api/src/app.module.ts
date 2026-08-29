// TechLab Fisio — módulo raiz do monólito modular (Etapa 2.3A; provider de
// persistência acrescentado na Etapa 2.3B).
//
// O módulo raiz registra somente o que existe de fato: o health check de
// infraestrutura, a norma de auditoria da aplicação (P-BACK-01) e, desde a
// 2.3B, o provider de persistência (conexão eager — a API NÃO sobe sem banco
// válido e sem a postura de privilégios de runtime). Módulos funcionais com
// exposição HTTP (pacientes, agenda, ...) pertencem a fatias futuras e NÃO
// nascem aqui. `AuthModule` (Etapa 2.3D-B / F1) é registrado como fatia
// técnica INTERNA — só a fronteira de credenciais, sem controller nem rota.
//
// Etapa 2.3D-B / F4: `AuthzModule` entra como módulo SEM CONTROLLER. Ele
// registra o mecanismo de autorização RBAC (`D-2.3D-09`) no grafo real, para
// que seus providers sejam os mesmos singletons que a aplicação usaria — e
// NÃO publica rota alguma. As rotas da aplicação continuam sendo exatamente
// `/health`, `/auth/login` e `/auth/logout`.

import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuthzModule } from "./authz/authz.module.js";
import { CobrancaModule } from "./cobranca/cobranca.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProfissionalModule } from "./profissional/profissional.module.js";

@Module({
  imports: [
    HealthModule,
    AuditModule,
    AuthModule,
    AuthzModule,
    DatabaseModule,
    ProfissionalModule,
    CobrancaModule,
  ],
})
export class AppModule {}
