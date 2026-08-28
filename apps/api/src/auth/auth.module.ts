// TechLab Fisio — módulo de autenticação (Etapa 2.3D-B / F1 + F2 + F3).
//
// A F3 é a primeira fatia desta frente com EXPOSIÇÃO HTTP: `AuthController`
// (`POST /auth/login`, `POST /auth/logout`) entra aqui, e com ele a política
// de cookie (`D-2.3D-07`), o limitador de login (`D-2.3D-06`) e a orquestração
// que emite os eventos de autenticação (`D-2.3D-12`).
//
// AMPLIAÇÃO DE FRONTEIRA — a única, e ela é consequência esperada da F3:
// `AuditModule` passa a ser importado. Até a F2 ele estava deliberadamente
// fora, porque `usuario.autenticacao` e a auditoria de logout pertenciam a
// esta fatia e não deviam nascer por antecipação (`docs/12` §9). Agora
// pertencem, e o import é exatamente o necessário — nem um módulo a mais.
// Provado por `auth.module.integration.spec.ts`, que falha se qualquer outro
// import aparecer.
//
// O QUE CONTINUA FORA — F4 em diante, e nenhuma linha aqui prepara nada disso:
// guards/decorators de RBAC (`D-2.3D-09`), resolução de papéis e permissões,
// seed de papéis, bootstrap do primeiro Administrador (`D-2.3D-10`),
// recuperação de senha (`D-2.3D-08`), revogação de sessão de terceiro,
// refresh token, JWT, CORS, multitenancy e frontend.

import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuditModule } from "../audit/audit.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuthController } from "./auth.controller.js";
import { AutenticacaoService } from "./autenticacao.service.js";
import { CredencialService } from "./credencial.service.js";
import { FiltroErroAutenticacao } from "./erro-autenticacao.filter.js";
import { LimitadorLogin } from "./limitador-login.js";
import {
  POLITICA_COOKIE_SESSAO,
  resolverPoliticaCookieSessao,
} from "./politica-cookie.js";
import { ProtecaoCsrfGuard } from "./protecao-csrf.guard.js";
import { RELOGIO_SESSAO, relogioDoSistema } from "./relogio-sessao.js";
import { SessaoService } from "./sessao.service.js";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [
    CredencialService,
    // Relógio de PRODUÇÃO — o relógio do sistema. Substituído apenas no
    // container de testes, para alcançar as bordas exatas de `D-2.3D-04`.
    { provide: RELOGIO_SESSAO, useValue: relogioDoSistema },
    SessaoService,
    // `R-2.3D-04` — FAIL-FAST DE BOOTSTRAP: esta fábrica é resolvida quando o
    // container instancia o grafo, isto é, dentro de `NestFactory.create`.
    // Configuração de cookie insegura ou ambiguamente declarada faz a
    // aplicação NÃO SUBIR, que é o tratamento homologado do risco
    // (`docs/12` §8) — nunca subir com cookie de desenvolvimento.
    {
      provide: POLITICA_COOKIE_SESSAO,
      useFactory: (): ReturnType<typeof resolverPoliticaCookieSessao> =>
        resolverPoliticaCookieSessao(),
    },
    // Instância única de processo: os contadores de `D-2.3D-06` só fazem
    // sentido compartilhados por todas as requisições (e por isso são zerados
    // por restart — limitação homologada, `R-2.3D-02`/`P-2.3D-06`).
    { provide: LimitadorLogin, useFactory: (): LimitadorLogin => new LimitadorLogin() },
    ProtecaoCsrfGuard,
    AutenticacaoService,
    // Registrado por `APP_FILTER` — e não em `main.ts` — de propósito: assim o
    // filtro acompanha o MÓDULO, e toda aplicação montada a partir do
    // `AppModule` (inclusive a dos testes de integração) tem exatamente o
    // mesmo contrato de erro que a de produção. Ele delega ao comportamento
    // padrão do Nest fora das rotas da F3.
    { provide: APP_FILTER, useClass: FiltroErroAutenticacao },
  ],
  exports: [CredencialService, SessaoService, AutenticacaoService],
})
export class AuthModule {}
