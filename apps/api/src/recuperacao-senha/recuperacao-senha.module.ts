// TechLab Fisio — módulo de recuperação de senha (Etapa 2.3D-B / F6).
//
// Módulo PRÓPRIO, e não uma extensão do `AuthModule`: a fronteira da F3 é
// provada por igualdade exata (`controllers === [AuthController]`, `imports
// === [DatabaseModule, AuditModule]`, `exports` fechados) e essa prova
// continua valendo. A F6 CONSOME a autenticação, a autorização, a auditoria
// e a persistência vigentes — não as substitui nem as duplica.
//
// IMPORTS — os dois mínimos, e por quê:
//   `AuthzModule` ... traz `@RequerPermissao` (guards de sessão e de permissão
//                     da F4) e, pela reexportação declarada em `R4-05`, o
//                     `AuthModule` (`CredencialService`, `SessaoService`,
//                     `POLITICA_COOKIE_SESSAO`, `RELOGIO_SESSAO`) e o
//                     `DatabaseModule`;
//   `AuditModule` ... `AuditWriter` + validator fail-closed, para os dois
//                     eventos homologados de `D-AUD-01`.
//
// `ProtecaoCsrfGuard` é PROVIDA aqui pela mesma razão que no `AuthModule`: o
// Nest instancia guards de `@UseGuards` no injetor do módulo do controller.
// `LimitadorRecuperacao` é instância ÚNICA de processo — os contadores de
// `D-2.3D-06` só fazem sentido compartilhados por todas as requisições.
//
// O QUE ESTE MÓDULO NÃO CONTÉM: canal de entrega (e-mail/SMS/WhatsApp — fora
// do MVP), auto-solicitação de recuperação, ativação/inativação de usuário
// (AUT-005), revogação administrativa de sessão de terceiro, listagem de
// usuários, política de senha, frontend.

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { ProtecaoCsrfGuard } from "../auth/protecao-csrf.guard.js";
import { AuthzModule } from "../authz/authz.module.js";
import { LimitadorRecuperacao } from "./limitador-recuperacao.js";
import { RecuperacaoSenhaController } from "./recuperacao-senha.controller.js";
import { RecuperacaoSenhaService } from "./recuperacao-senha.service.js";

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [RecuperacaoSenhaController],
  providers: [
    ProtecaoCsrfGuard,
    {
      provide: LimitadorRecuperacao,
      useFactory: (): LimitadorRecuperacao => new LimitadorRecuperacao(),
    },
    RecuperacaoSenhaService,
  ],
})
export class RecuperacaoSenhaModule {}
