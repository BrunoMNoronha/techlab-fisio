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
// Fatia AGD-A (`docs/15` D-AGD-01, autorizada por Bruno Menezes Noronha em
// 17/09/2026): `AgendaModule` entra como módulo funcional do M5 e publica as
// seis rotas de `/agendamentos` mais `GET /agenda/opcoes`. Ele é o consumidor
// dos verificadores de RN-014 que CFG-002 e PRO-003 deixaram prontos e sem
// registro. Nenhuma rota de AGD-B, AGD-C, AGD-D ou AGD-E nasce aqui.
//
// Etapa 2.3D-B / F4: `AuthzModule` entra como módulo SEM CONTROLLER. Ele
// registra o mecanismo de autorização RBAC (`D-2.3D-09`) no grafo real, para
// que seus providers sejam os mesmos singletons que a aplicação usaria — e
// NÃO publica rota alguma. As rotas da aplicação continuam sendo exatamente
// `/health`, `/auth/login` e `/auth/logout`.

import { Module } from "@nestjs/common";

import { AgendaModule } from "./agenda/agenda.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuditoriaConsultaModule } from "./audit/auditoria-consulta.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuthzModule } from "./authz/authz.module.js";
import { ClinicaModule } from "./clinica/clinica.module.js";
import { ServicosModule } from "./servicos/servicos.module.js";
import { FormasPagamentoModule } from "./formas-pagamento/formas-pagamento.module.js";
import { MotivosCancelamentoModule } from "./motivos-cancelamento/motivos-cancelamento.module.js";
import { PacientesModule } from "./pacientes/pacientes.module.js";
import { RecuperacaoSenhaModule } from "./recuperacao-senha/recuperacao-senha.module.js";
import { CobrancaModule } from "./cobranca/cobranca.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProfissionalModule } from "./profissional/profissional.module.js";
import { SessoesModule } from "./sessoes/sessoes.module.js";
import { UsuariosModule } from "./auth/usuarios.module.js";

@Module({
  imports: [
    HealthModule,
    AuditModule,
    AuthModule,
    AuthzModule,
    RecuperacaoSenhaModule,
    SessoesModule,
    UsuariosModule,
    AuditoriaConsultaModule,
    DatabaseModule,
    ProfissionalModule,
    CobrancaModule,
    ClinicaModule,
    ServicosModule,
    FormasPagamentoModule,
    MotivosCancelamentoModule,
    PacientesModule,
    AgendaModule,
  ],
})
export class AppModule {}
