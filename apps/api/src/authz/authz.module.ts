// TechLab Fisio — módulo de autorização RBAC (Etapa 2.3D-B / F4).
//
// Materializa `D-2.3D-09` (`docs/12` §5.9) e a parte de RBAC de `AUT-003`.
// Reúne o mecanismo e NADA além dele: a resolução das permissões efetivas, a
// guard de sessão que estabelece a identidade e a guard que decide o acesso.
//
// SEM CONTROLLER — deliberado. A F4 entrega o MECANISMO de autorização, não
// funcionalidade nova. Nenhuma rota de produção nasce aqui, e o conjunto de
// rotas publicadas pela aplicação continua sendo exatamente `/health`,
// `/auth/login` e `/auth/logout` (provado por `auth.module.integration.spec.ts`
// e por `openapi.spec.ts`, ambos inalterados).
//
// POR QUE ELE É REGISTRADO NO `AppModule` mesmo sem rota: para que os
// providers sejam resolvidos pelo container REAL, como singletons do grafo de
// produção — o mesmo precedente de `audit.module.integration.spec.ts` e
// `auth.module.integration.spec.ts` ("provar que o serviço exercido pela
// aplicação é o MESMO coberto pelos testes"). Um módulo montado só dentro de
// um teste provaria a fixture, não o produto.
//
// IMPORTS — os três mínimos, e por quê:
//   `DatabaseModule` .. `PermissoesService` consulta a persistência homologada
//                       pela fronteira transacional única (`DatabaseService`);
//   `AuthModule` ...... `SessaoAutenticadaGuard` consome o `SessaoService` e a
//                       política de cookie da F3. A F4 CONSOME a autenticação
//                       vigente; não a substitui, não a duplica e não
//                       reimplementa leitura de cookie, verificação de token
//                       ou política temporal;
//   `AuditModule` ..... (L-07 — PBACK-AUD-09) `AuditoriaNegacaoAutorizacao`
//                       escreve `autorizacao.negada` pelo `AuditWriter`
//                       existente, em transação dedicada. O emissor vive AQUI,
//                       e não em `audit/`, porque a lista fechada de permissões
//                       auditáveis é política de AUTORIZAÇÃO; `audit/` continua
//                       sem conhecer permissões. Exportado porque a
//                       `PermissoesGuard` é instanciada no injetor do módulo do
//                       controller (`R4-05`) e precisa resolvê-lo lá.
//
// O QUE ESTE MÓDULO NÃO CONTÉM — e nenhuma linha dele prepara: seed de papéis
// ou permissões, associação papel↔permissão, bootstrap do primeiro
// Administrador (F5, `D-2.3D-10`); recuperação de senha (F6, `D-2.3D-08`);
// revogação de sessão de terceiro; autorização clínica contextual por relação
// profissional↔paciente (`P2.2-05`); cache de autorização, Redis, snapshot de
// permissão na sessão, JWT ou refresh token (`docs/12` §16).

import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AuditoriaNegacaoAutorizacao } from "./auditoria-negacao-autorizacao.js";
import { PermissoesGuard } from "./permissoes.guard.js";
import { PermissoesService } from "./permissoes.service.js";
import { SessaoAutenticadaGuard } from "./sessao-autenticada.guard.js";

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  providers: [
    PermissoesService,
    AuditoriaNegacaoAutorizacao,
    SessaoAutenticadaGuard,
    PermissoesGuard,
  ],
  // REEXPORTAÇÃO DE `DatabaseModule` E `AuthModule` — opção adotada para
  // ENCAPSULAR as dependências exigidas pelas guards e evitar que cada módulo
  // consumidor tenha de repeti-las. É uma escolha, não a única possibilidade:
  // a redação anterior ("necessidade medida do NestJS") era mais forte que a
  // evidência, e a revisão independente mediu as três configurações
  // (correção `R4-05`):
  //
  //   (a) não exportar nada além dos próprios providers .... FALHA
  //       "Nest can't resolve dependencies of the SessaoAutenticadaGuard" —
  //       o Nest instancia as guards de `@UseGuards` no injetor do módulo do
  //       CONTROLLER e resolve as dependências delas contra os `exports` dos
  //       módulos que ESSE módulo importa;
  //   (b) exportar providers específicos vindos de módulos importados ......
  //       REJEITADO PELO FRAMEWORK — "Nest cannot export a provider/module
  //       that is not a part of the currently processed module";
  //   (c) não reexportar e fazer cada consumidor importar `AuthzModule` +
  //       `AuthModule` + `DatabaseModule` ................... FUNCIONA.
  //
  // Adotada (b→) a reexportação por manter o consumidor com um único import.
  // TRADE-OFF DECLARADO: o consumidor passa a enxergar também
  // `CredencialService`, `AutenticacaoService`, `SessaoService`,
  // `POLITICA_COOKIE_SESSAO` e `DatabaseService`, que não pediu. A alternativa
  // (c) reduz essa superfície ao custo de vazar, para o consumidor, quais são
  // as dependências internas das guards. Nada de novo é criado em nenhuma das
  // duas: os providers reexportados são os singletons já existentes do grafo.
  exports: [
    DatabaseModule,
    AuthModule,
    PermissoesService,
    AuditoriaNegacaoAutorizacao,
    SessaoAutenticadaGuard,
    PermissoesGuard,
  ],
})
export class AuthzModule {}
