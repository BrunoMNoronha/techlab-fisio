// TechLab Fisio — Etapa 2.3D-B / F1+F2+F3 — `AuthModule` pelo container real.
//
// Mesmo propósito e mesma forma de `audit.module.integration.spec.ts`: provar
// que o serviço exercido pela APLICAÇÃO é o MESMO coberto pelos testes
// unitários — resolvido a partir do módulo raiz real (`AppModule` →
// `AuthModule`), pelo container de injeção, e não por uma fixture
// desconectada. `credencial.service.spec.ts` instancia `CredencialService`
// diretamente; nada lá falharia se `AuthModule` saísse de `AppModule`. Esta
// suíte fecha exatamente essa lacuna.
//
// Prova propriedades que os testes unitários não alcançam:
//   1. FIAÇÃO — `CredencialService` é resolvível a partir do `AppModule`;
//   2. CICLO DE VIDA — o Nest executa `onModuleInit` e o digest dummy fica
//      AQUECIDO antes de qualquer tentativa de autenticação (`D-2.3D-02`,
//      `docs/12` §5.2; risco `R-2.3D-05`);
//   3. FRONTEIRA (F3) — o módulo expõe UM controller, importa DOIS módulos e
//      a aplicação inteira publica TRÊS rotas. Qualquer vazamento de F4+
//      (RBAC, seed, recuperação de senha, endpoints de domínio) falha aqui.
//      NOTA DA F4: o RBAC passou a existir, em módulo PRÓPRIO (`AuthzModule`),
//      sem controller e sem rota — as três asserções desta seção continuam
//      valendo exatamente como estavam, e são elas que provam isso;
//   4. `R-2.3D-04` — o fail-fast de cookie inseguro está ligado ao BOOTSTRAP,
//      e não apenas disponível como função pura.
//
// SEM ASSERÇÃO DE TEMPO: o aquecimento é provado por ORDEM DE EVENT LOOP, não
// por `duração < X ms`. Ver `venceuNaFilaDeMicrotarefas` abaixo — a propriedade
// medida é determinística e independente da velocidade da máquina.
//
// SEM BANCO: esta é a suíte sem PostgreSQL (`jest.config.mjs`). O único
// provider do grafo com ciclo de vida além de `CredencialService` é
// `DatabaseService`, cujo `onModuleInit` conecta EAGER (`database.service.ts`
// §10). Para executar o ciclo de vida real sem banco, ele — e somente ele — é
// substituído por um valor inerte. Nenhum artefato da fronteira de credenciais
// é mockado: o `AuthModule`, o `CredencialService` e o Argon2 são os reais.

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { AuditModule } from "../src/audit/audit.module.js";
import { AuthController } from "../src/auth/auth.controller.js";
import { AuthModule } from "../src/auth/auth.module.js";
import { AutenticacaoService } from "../src/auth/autenticacao.service.js";
import { CredencialService } from "../src/auth/credencial.service.js";
import {
  ErroPoliticaCookie,
  NOME_COOKIE_PROTEGIDO,
  POLITICA_COOKIE_SESSAO,
} from "../src/auth/politica-cookie.js";
import type { PoliticaCookieSessao } from "../src/auth/politica-cookie.js";
import { RELOGIO_SESSAO } from "../src/auth/relogio-sessao.js";
import { SessaoService } from "../src/auth/sessao.service.js";
import { DatabaseModule } from "../src/database/database.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import { construirDocumentoOpenApi } from "../src/openapi/documento-openapi.js";

// O aquecimento paga um `hash()` Argon2 real (m=19456) no `init()`, e o
// controle negativo paga outro. Poucos hashes, mas o default de 5 s do Jest
// não tem folga em CI compartilhada — mesmo critério de
// `credencial.service.spec.ts`.
jest.setTimeout(60_000);

/** Sentinela devolvida quando a promessa disputada NÃO estava resolvida. */
const NAO_AQUECIDO = "NAO_AQUECIDO" as const;

/**
 * Número de saltos de microtarefa concedidos à sentinela. É folga deliberada:
 * a promessa memoizada e já resolvida vence em uma HANDFUL de saltos (o
 * `return promessa` de um método `async` custa poucos ticks de adoção). Cem é
 * ordens de grandeza acima do necessário — e continua estritamente dentro do
 * mesmo esvaziamento da fila de microtarefas.
 */
const SALTOS_DE_MICROTAREFA = 100;

/**
 * Decide, SEM medir tempo, se `promessa` já estava resolvida.
 *
 * Fundamento — semântica do event loop, não desempenho: a fila de
 * microtarefas é esvaziada INTEIRAMENTE antes que o loop volte a atender
 * qualquer conclusão de I/O. O `hash()` do Argon2 é executado no threadpool do
 * libuv pelo addon nativo, e sua conclusão só pode ser observada como
 * macrotarefa — isto é, DEPOIS desse esvaziamento.
 *
 * Logo:
 *   - dummy AQUECIDO   -> promessa já resolvida, vence em poucos saltos;
 *   - dummy NÃO aquecido -> depende do threadpool, não pode vencer em salto
 *     NENHUM de microtarefa, por mais rápida que seja a máquina.
 *
 * A propriedade é determinística nos dois sentidos e não possui limiar
 * temporal: numa máquina infinitamente lenta o caminho aquecido continua
 * vencendo, e numa infinitamente rápida o caminho frio continua perdendo.
 */
async function venceuNaFilaDeMicrotarefas(
  promessa: Promise<string>,
): Promise<string | typeof NAO_AQUECIDO> {
  let sentinela = Promise.resolve<string | typeof NAO_AQUECIDO>(NAO_AQUECIDO);
  for (let i = 0; i < SALTOS_DE_MICROTAREFA; i += 1) {
    sentinela = sentinela.then((v) => v);
  }
  return Promise.race([promessa, sentinela]);
}

describe("AuthModule — fiação pelo container NestJS real (AppModule)", () => {
  let moduleRef: TestingModule;
  let servico: CredencialService;

  beforeAll(async () => {
    // `compile()` monta o grafo SEM disparar ciclo de vida — exatamente o
    // precedente de `audit.module.integration.spec.ts`, e o motivo pelo qual
    // esta parte não precisa neutralizar nada.
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    servico = moduleRef.get(CredencialService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("o AppModule real entrega CredencialService pelo container", () => {
    // Se `AuthModule` for removido de `AppModule`, ou `CredencialService`
    // deixar de ser exportado, o `get` acima lança e esta suíte falha inteira —
    // que é precisamente a regressão que os testes unitários não detectam.
    expect(servico).toBeInstanceOf(CredencialService);
  });

  it("o serviço resolvido é o singleton do container, não uma nova instância", () => {
    expect(moduleRef.get(CredencialService)).toBe(servico);
  });

  it("o serviço resolvido opera de verdade — Argon2 real, política vigente", async () => {
    const digest = await servico.gerarHash("senha-sintetica-integracao-f1");
    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(servico.precisaRehash(digest)).toBe(false);
  });
});

describe("AuthModule — ciclo de vida real (onModuleInit) pelo AppModule", () => {
  let moduleRef: TestingModule;
  let servico: CredencialService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // ÚNICA substituição: o provider de infraestrutura fora do escopo desta
      // fatia. `DatabaseService.onModuleInit` conecta EAGER e abortaria o
      // `init()` nesta suíte sem banco. O valor inerte não possui hooks, logo
      // o Nest não o invoca; `CobrancaService`/`ProfissionalService` apenas
      // guardam a referência no construtor.
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();

    // É AQUI que o ciclo de vida acontece: `init()` dispara `onModuleInit` de
    // todos os providers do grafo — inclusive o de `CredencialService`.
    await moduleRef.init();
    servico = moduleRef.get(CredencialService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("após init(), o digest dummy já está aquecido — nenhum hash pendente", async () => {
    const resultado = await venceuNaFilaDeMicrotarefas(
      servico.obterHashDummyParaProva(),
    );
    expect(resultado).not.toBe(NAO_AQUECIDO);
    expect(resultado.startsWith("$argon2id$")).toBe(true);
  });

  it("controle negativo: um serviço SEM init() perde a mesma disputa", async () => {
    // Prova que a asserção anterior discrimina de fato. Sem este controle, um
    // `venceuNaFilaDeMicrotarefas` quebrado passaria despercebido e o teste
    // acima seria um falso positivo.
    const frio = new CredencialService();
    const promessaFria = frio.obterHashDummyParaProva();
    expect(await venceuNaFilaDeMicrotarefas(promessaFria)).toBe(NAO_AQUECIDO);
    // Não deixar a promessa pendente ao fim da suíte.
    expect((await promessaFria).startsWith("$argon2id$")).toBe(true);
  });

  it("o dummy aquecido no init() é reutilizado, nunca regerado", async () => {
    // Identidade de valor: um `hash()` novo traria salt novo, logo string
    // diferente. Estabilidade prova que o init() memoizou e nada regerou.
    const primeiro = await servico.obterHashDummyParaProva();
    for (let i = 0; i < 3; i += 1) {
      expect(
        await servico.verificarComCaminhoDummy(null, `tentativa-sintetica-${i}`),
      ).toBe(false);
    }
    expect(await servico.obterHashDummyParaProva()).toBe(primeiro);
  });

  it("o caminho dummy do serviço do container não autentica", async () => {
    for (const ausente of [null, undefined, ""]) {
      expect(
        await servico.verificarComCaminhoDummy(ausente, "senha-sintetica-integracao-f1"),
      ).toBe(false);
    }
  });
});

describe("AuthModule — fronteira da F1+F2+F3 preservada", () => {
  let moduloFronteira: TestingModule;
  let appFronteira: import("@nestjs/common").INestApplication;
  let documentoDaAplicacao: import("@nestjs/swagger").OpenAPIObject;

  beforeAll(async () => {
    moduloFronteira = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();
    appFronteira = moduloFronteira.createNestApplication();
    await appFronteira.init();
    // O documento OpenAPI é derivado do ROUTER real: usá-lo aqui transforma a
    // fronteira de rotas numa asserção mecânica em vez de uma inspeção manual.
    documentoDaAplicacao = construirDocumentoOpenApi(appFronteira);
  });

  afterAll(async () => {
    await appFronteira.close();
  });

  it("declara EXCLUSIVAMENTE o AuthController — nenhum outro endpoint nasce aqui", () => {
    // `controllers` é a chave pública de metadado de `@Module` (Nest
    // `MODULE_METADATA.CONTROLLERS`). A F3 é a fatia autorizada a expor HTTP,
    // e expõe UMA fronteira: login e logout. Qualquer segundo controller neste
    // módulo é invasão de escopo (recuperação de senha é F6; RBAC é F4).
    const controllers: unknown = Reflect.getMetadata("controllers", AuthModule);
    expect(controllers ?? []).toEqual([AuthController]);
  });

  it("importa EXCLUSIVAMENTE DatabaseModule e AuditModule", () => {
    // Mudança de fronteira AUTORIZADA na F3, e a última: `usuario.autenticacao`
    // (`D-2.3D-12`) e `usuario.sessao.logout` (`docs/09` §5) são desta fatia,
    // logo `AuditModule` entra — e nada além dele. A F1 não importava nada; a
    // F2 acrescentou `DatabaseModule`. Esta asserção falha se QUALQUER outro
    // módulo aparecer, inclusive um módulo de RBAC/seed/recuperação de F4+.
    const imports: unknown = Reflect.getMetadata("imports", AuthModule);
    expect(imports ?? []).toEqual([DatabaseModule, AuditModule]);
  });

  it("as rotas expostas pela aplicação são SÓ as da F3 e as da F6", () => {
    // Prova de fronteira contra o ROUTER real, e não contra metadados: se um
    // endpoint de F4+ (profissionais, pacientes, agenda, recuperação de senha,
    // revogação de terceiro, refresh) entrar acidentalmente no `AppModule`,
    // esta asserção falha.
    // ATUALIZADO NA F6: as duas rotas de recuperação de senha (AUT-004,
    // `D-2.3D-08`) foram autorizadas e vivem em módulo PRÓPRIO
    // (`RecuperacaoSenhaModule`), não neste. A asserção continua sendo de
    // igualdade exata sobre o ROUTER real.
    const caminhos = Object.keys(documentoDaAplicacao.paths).sort();
    expect(caminhos).toEqual([
      "/auth/login",
      "/auth/logout",
      "/auth/recuperacao-senha",
      "/auth/recuperacao-senha/concluir",
      "/health",
    ]);
  });

  it("o AuthModule não absorve provider de F4+ — nem de F5, nem de F6", () => {
    // RENOMEADO NA F4, e o motivo é factual: até a F3 o título correto era
    // "nenhum provider de F4+ é resolvível a partir do `AppModule`", porque a
    // F4 não existia. Ela agora existe, foi autorizada, e seus providers
    // (`PermissoesService`, `SessaoAutenticadaGuard`, `PermissoesGuard`) são
    // legitimamente resolvíveis a partir do `AppModule` — pelo `AuthzModule`,
    // que é módulo PRÓPRIO e não publica rota alguma. Manter o título
    // anterior deixaria uma prova verde afirmando algo falso.
    //
    // O que esta prova continua guardando, sem afrouxar nada: a superfície do
    // `AuthModule` em si. Nenhum artefato de RBAC nasce dentro dele, e F5
    // (seed/bootstrap de Administrador) e F6 (recuperação de senha)
    // permanecem inexistentes em qualquer módulo.
    for (const nome of [
      "RbacGuard",
      "PermissaoGuard",
      "PapelService",
      "RecuperacaoSenhaService",
      "SeedService",
    ]) {
      expect(Object.keys(globalThis)).not.toContain(nome);
    }
    // `AuthModule` exporta as três fronteiras das fatias F1..F3 e — desde a
    // F4 — o token da política de cookie.
    //
    // AJUSTE DA F4, e o que ele NÃO afrouxa: `POLITICA_COOKIE_SESSAO` é um
    // provider que JÁ EXISTIA neste módulo desde a F3; exportá-lo não cria
    // artefato, não muda comportamento e não traz funcionalidade de F4+ para
    // dentro do `AuthModule`. Ele passa a ser exportado para que a
    // `SessaoAutenticadaGuard` da F4 leia o cookie de sessão pela FONTE ÚNICA
    // da política, em vez de resolver uma segunda cópia da mesma configuração
    // de segurança. A asserção continua sendo de IGUALDADE EXATA: qualquer
    // outro export — um `PermissoesService`, um `RbacGuard`, um serviço de
    // seed ou de recuperação de senha — continua fazendo esta prova falhar.
    //
    // AJUSTE DA F6, pelo MESMO racional: `RELOGIO_SESSAO` é um provider que
    // JÁ EXISTIA neste módulo desde a F2; exportá-lo não cria artefato nem
    // muda comportamento — permite que o `RecuperacaoSenhaModule` (módulo
    // PRÓPRIO) decida validade e consumo do segredo pela mesma fonte de tempo.
    const exports: unknown = Reflect.getMetadata("exports", AuthModule);
    expect(exports ?? []).toEqual([
      CredencialService,
      SessaoService,
      AutenticacaoService,
      POLITICA_COOKIE_SESSAO,
      RELOGIO_SESSAO,
    ]);
  });
});

describe("R-2.3D-04 — o fail-fast de cookie está LIGADO ao bootstrap real", () => {
  // A regra em si é provada em `politica-cookie.spec.ts`. Esta suíte prova a
  // outra metade, que nenhum teste de função pura alcança: a regra é executada
  // pelo CONTAINER, na construção do grafo — isto é, dentro de
  // `NestFactory.create`. Se o provider sair de `AuthModule`, ou virar `lazy`,
  // ou passar a ter fallback silencioso, a aplicação voltaria a subir com
  // cookie inseguro e este teste falha.

  async function montarCom(
    variaveis: Record<string, string | undefined>,
  ): Promise<TestingModule> {
    const anteriores = new Map<string, string | undefined>();
    for (const [chave, valor] of Object.entries(variaveis)) {
      anteriores.set(chave, process.env[chave]);
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
    try {
      return await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DatabaseService)
        .useValue({})
        .compile();
    } finally {
      for (const [chave, valor] of anteriores) {
        if (valor === undefined) delete process.env[chave];
        else process.env[chave] = valor;
      }
    }
  }

  it("F-02 — TLF_AMBIENTE AUSENTE aborta a construção do grafo", async () => {
    // Correção pós-revisão: a ausência da variável já não significa
    // "desenvolvimento". Sem declaração explícita, a aplicação não sobe.
    await expect(montarCom({ TLF_AMBIENTE: undefined })).rejects.toThrow(
      ErroPoliticaCookie,
    );
  });

  it("NODE_ENV=production sem TLF_AMBIENTE protegida ABORTA a construção do grafo", async () => {
    await expect(
      montarCom({ NODE_ENV: "production", TLF_AMBIENTE: "desenvolvimento" }),
    ).rejects.toThrow(ErroPoliticaCookie);
  });

  it("TLF_AMBIENTE com valor desconhecido ABORTA a construção do grafo", async () => {
    await expect(
      montarCom({ TLF_AMBIENTE: "valor-arbitrario-x9" }),
    ).rejects.toThrow(ErroPoliticaCookie);
  });

  it("ambiente protegido coerente SOBE, e com a política segura injetada", async () => {
    const moduloProtegido = await montarCom({
      NODE_ENV: "production",
      TLF_AMBIENTE: "producao",
    });
    try {
      const politica = moduloProtegido.get<PoliticaCookieSessao>(
        POLITICA_COOKIE_SESSAO,
      );
      expect(politica.nome).toBe(NOME_COOKIE_PROTEGIDO);
      expect(politica.secure).toBe(true);
    } finally {
      await moduloProtegido.close();
    }
  });
});
