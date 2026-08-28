// TechLab Fisio — Etapa 2.3D-B / F1 — `AuthModule` pelo container NestJS real.
//
// Mesmo propósito e mesma forma de `audit.module.integration.spec.ts`: provar
// que o serviço exercido pela APLICAÇÃO é o MESMO coberto pelos testes
// unitários — resolvido a partir do módulo raiz real (`AppModule` →
// `AuthModule`), pelo container de injeção, e não por uma fixture
// desconectada. `credencial.service.spec.ts` instancia `CredencialService`
// diretamente; nada lá falharia se `AuthModule` saísse de `AppModule`. Esta
// suíte fecha exatamente essa lacuna.
//
// Prova duas propriedades que os testes unitários não alcançam:
//   1. FIAÇÃO — `CredencialService` é resolvível a partir do `AppModule`;
//   2. CICLO DE VIDA — o Nest executa `onModuleInit` e o digest dummy fica
//      AQUECIDO antes de qualquer tentativa de autenticação (`D-2.3D-02`,
//      `docs/12` §5.2; risco `R-2.3D-05`).
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
import { AuthModule } from "../src/auth/auth.module.js";
import { CredencialService } from "../src/auth/credencial.service.js";
import { DatabaseModule } from "../src/database/database.module.js";
import { DatabaseService } from "../src/database/database.service.js";

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

describe("AuthModule — fronteira da F1+F2 preservada", () => {
  it("não declara controller — F1 e F2 não expõem rota", () => {
    // `controllers` é a chave pública de metadado de `@Module` (Nest
    // `MODULE_METADATA.CONTROLLERS`). Endpoints de autenticação são da F3
    // (`docs/12` §9); nascer um controller aqui é invasão de escopo.
    const controllers: unknown = Reflect.getMetadata("controllers", AuthModule);
    expect(controllers ?? []).toEqual([]);
  });

  it("importa EXCLUSIVAMENTE DatabaseModule — e nunca AuditModule", () => {
    // Mudança de fronteira AUTORIZADA na F2: a sessão é persistida, logo a
    // fatia exige de fato a fronteira transacional (`D-2.3D-01`). O que NÃO
    // muda: `AuditModule` continua fora — `usuario.autenticacao` e a auditoria
    // de logout são da F3 (`D-2.3D-12`, `docs/12` §9) e não entram por
    // antecipação. A F1 não importava nada; esta asserção documenta a única
    // adição legítima e falha se qualquer outra aparecer.
    const imports: unknown = Reflect.getMetadata("imports", AuthModule);
    expect(imports ?? []).toEqual([DatabaseModule]);
  });
});
