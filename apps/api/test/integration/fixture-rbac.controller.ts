// TechLab Fisio — Etapa 2.3D-B / F4 — fixture EXCLUSIVA DE TESTE.
//
// ESTE ARQUIVO NÃO PUBLICA API DE PRODUÇÃO E NÃO PODE PUBLICAR. Ele vive em
// `test/`, fora de `rootDir: "src"` de `tsconfig.build.json`; nada aqui é
// compilado para `dist/`, nada é importado por `AppModule` e nenhuma destas
// rotas existe no documento OpenAPI da aplicação — as rotas FUNCIONAIS
// publicadas continuam sendo `/health`, `/auth/login` e `/auth/logout`
// (asserção mecânica de `auth.module.integration.spec.ts` e `openapi.spec.ts`),
// além de `/openapi.json`, servida apenas conforme a política de ambiente
// homologada na F3.
//
// POR QUE ELE EXISTE: a F4 entrega o MECANISMO de autorização, e o enunciado
// da fatia proíbe inventar endpoint de negócio só para exercitá-lo. Nenhuma
// rota HOJE publicada tem controle de acesso inequivocamente especificado
// pelas fontes — `/health` é infraestrutura, e `POST /auth/login` /
// `POST /auth/logout` são precisamente as operações que `docs/04` §4 marca
// como permitidas a TODOS os papéis ("Autenticar/logout próprio": ✓ / ✓ / ✓ /
// ✓), isto é, operações sem permissão exigida. Proteger qualquer uma delas
// com RBAC contrariaria a matriz homologada. Resta provar a guard por
// integração sobre um controller de teste — que é o que este arquivo é.
//
// O produto exercitado é REAL em tudo o mais: o decorator, as guards, o
// serviço de resolução, o `SessaoService`, o cookie, o servidor HTTP e o
// PostgreSQL. A fixture contribui apenas com os handlers.
//
// FATIA CORRETIVA (`R4-03`): as rotas protegidas usam EXCLUSIVAMENTE
// `@RequerPermissao(P)`, sem nenhum `@UseGuards` ao lado. É esta a prova de
// que o decorator, sozinho, autentica e autoriza. As duas rotas que ainda
// instalam guard à mão existem apenas para provar o fail-closed da guard
// quando alguém a aplica fora do caminho suportado.

import { Controller, Get, Module, Post, UseGuards } from "@nestjs/common";

import { AuthzModule } from "../../src/authz/authz.module.js";
import { UsuarioAutenticado } from "../../src/authz/contexto-autenticado.js";
import type { ContextoAutenticado } from "../../src/authz/contexto-autenticado.js";
import { PermissoesGuard } from "../../src/authz/permissoes.guard.js";
import { RequerPermissao } from "../../src/authz/requer-permissao.decorator.js";
import { SessaoAutenticadaGuard } from "../../src/authz/sessao-autenticada.guard.js";

/** Prefixo das rotas de fixture — nenhuma colisão com rota de produção. */
export const PREFIXO_FIXTURE = "fixture-f4";

/**
 * Corpo devolvido pelos handlers ALCANÇADOS. Existe para que os testes possam
 * distinguir "autorizado e o handler executou" de "respondeu 200 por acidente
 * de roteamento" — controle de não vacuidade exigido pelo enunciado.
 */
export interface RespostaFixture {
  readonly alcancado: true;
  readonly rota: string;
  readonly usuarioId: string;
  readonly sessaoId: string;
}

@Controller(PREFIXO_FIXTURE)
export class ControladorFixtureF4 {
  /**
   * Apenas AUTENTICADA, sem RBAC: prova a fronteira `401` e o contexto
   * autenticado. Usa a guard de sessão diretamente porque não há permissão a
   * exigir — é o caso legítimo de `@UseGuards(SessaoAutenticadaGuard)`.
   */
  @Get("somente-autenticado")
  @UseGuards(SessaoAutenticadaGuard)
  somenteAutenticado(@UsuarioAutenticado() usuario: ContextoAutenticado): RespostaFixture {
    return {
      alcancado: true,
      rota: "somente-autenticado",
      usuarioId: usuario.usuarioId,
      sessaoId: usuario.sessaoId,
    };
  }

  /**
   * Rota protegida pelo caminho SUPORTADO: só o decorator. Nenhum
   * `@UseGuards` a acompanha — se o decorator deixar de instalar as guards,
   * esta rota passa a responder `200` sem sessão alguma, e a suíte falha.
   */
  @Get("exige-permissao")
  @RequerPermissao("usuarios.gerenciar")
  exigePermissao(@UsuarioAutenticado() usuario: ContextoAutenticado): RespostaFixture {
    return {
      alcancado: true,
      rota: "exige-permissao",
      usuarioId: usuario.usuarioId,
      sessaoId: usuario.sessaoId,
    };
  }

  /** Outra permissão, rota independente — a exigência é por operação. */
  @Get("exige-outra")
  @RequerPermissao("permissoes.gerenciar")
  exigeOutra(@UsuarioAutenticado() usuario: ContextoAutenticado): RespostaFixture {
    return {
      alcancado: true,
      rota: "exige-outra",
      usuarioId: usuario.usuarioId,
      sessaoId: usuario.sessaoId,
    };
  }

  /**
   * Mesma exigência de `exige-permissao`, por `POST`: é a rota usada para
   * provar que corpo, query e cabeçalhos forjados não alteram a decisão.
   */
  @Post("exige-permissao")
  @RequerPermissao("usuarios.gerenciar")
  exigePermissaoPost(@UsuarioAutenticado() usuario: ContextoAutenticado): RespostaFixture {
    return {
      alcancado: true,
      rota: "exige-permissao-post",
      usuarioId: usuario.usuarioId,
      sessaoId: usuario.sessaoId,
    };
  }

  /**
   * `PermissoesGuard` instalada À MÃO e sem metadata — fora do caminho
   * suportado. Deve negar: metadata ausente não é permissão irrestrita.
   */
  @Get("guard-sem-metadata")
  @UseGuards(SessaoAutenticadaGuard, PermissoesGuard)
  guardSemMetadata(): RespostaFixture {
    return { alcancado: true, rota: "guard-sem-metadata", usuarioId: "", sessaoId: "" };
  }

  /**
   * `PermissoesGuard` instalada À MÃO sem a guard de sessão — fiação
   * incorreta em outro sentido. Deve negar, e nunca autenticar por conta
   * própria.
   */
  @Get("rbac-sem-sessao")
  @UseGuards(PermissoesGuard)
  rbacSemSessao(): RespostaFixture {
    return { alcancado: true, rota: "rbac-sem-sessao", usuarioId: "", sessaoId: "" };
  }
}

/** Módulo de fixture. Importa o módulo REAL da F4 — nada é substituído. */
@Module({
  imports: [AuthzModule],
  controllers: [ControladorFixtureF4],
})
export class ModuloFixtureF4 {}
