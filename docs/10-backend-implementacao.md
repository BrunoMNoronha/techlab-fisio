# Implementação do Backend — TechLab Fisio

> **Arquivo:** `docs/10-backend-implementacao.md`
> **Natureza:** documento **MUTÁVEL** — registro vivo de implementação da frente de backend (`apps/api`)
> **Status:** backend **EM CONSTRUÇÃO** — Etapa 2.3A **CONCLUÍDA/HOMOLOGADA/INTEGRADA** (REV. 2); Etapa 2.3B **IMPLEMENTADA E MEDIDA em branch `agent/**`** — provider de persistência + primeiro fluxo transacional real de auditoria (`profissional.situacao.alterada`, fatia técnica INTERNA, sem endpoint/RBAC) — **REVISADA (veredito B — apto após correções pontuais), correções `F-REV-01`/`F-REV-02` aplicadas (REV. 4); aguardando homologação e rito de integração**
> **Revisão vigente:** REV. 4 (26/08/2026)

---

## 0. Status e autoridade documental

Este documento é o **registro vivo autoritativo da frente de backend** para: estado de implementação, verificações executadas e pendências transferidas (`P-BACK-01`, `R-BL-02`, `R2.2-04`, `T-AUD-CONTEXTO`, `L-05`..`L-08`, `P2.2-05`).

Hierarquia preservada, em ordem:

1. autorização explícita e atual de **Bruno Menezes Noronha**;
2. `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — **superior a este documento**; não é alterada por ele;
3. decisões homologadas: `docs/08` permanece a **baseline técnica** e o registro **encerrado** da persistência da Fase 2 (REV. 20; handoff editorial na REV. 21); `docs/09` **§12** permanece a **fonte normativa exclusiva** de `D-AUD-01`..`D-AUD-08`;
4. código, migrations e testes vigentes;
5. este registro e os relatórios de execução.

Este documento **não duplica** conteúdo normativo das fontes anteriores: referencia-as. Nenhuma linha aqui cria, estende ou reinterpreta norma homologada.

## 1. Objetivo da frente de backend

Construir o backend do TechLab Fisio como **monólito modular NestJS** (TLF-BASE-V1 §4.6, §9), em fatias pequenas, verificáveis e homologáveis, consumindo a camada de persistência encerrada da Fase 2 exclusivamente por sua API pública, e materializando na camada de aplicação as regras cujo ownership foi homologado como backend (em especial a auditoria de `docs/09` §12).

## 2. Fontes normativas

| Fonte | Papel |
| --- | --- |
| `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` | Fundamentos permanentes (arquitetura de referência §9; segurança §10; governança §14) |
| `docs/02`..`docs/07` | Requisitos, regras de negócio, perfis, jornadas, domínio e modelo físico homologado |
| `docs/08` (REV. 21) | Baseline técnica (Node 24, TS 6.0, Prisma 7.9.1, PostgreSQL 18); `D-ESM-01`; registro encerrado da persistência; handoff das pendências de backend para este documento |
| `docs/09` §12 | `D-AUD-01`..`D-AUD-08` — catálogo de 24 ações, `resultado`, `alvo_tipo`, whitelist fail-closed, ownership da validação |

## 3. Estado de entrada

Marco de partida da frente de backend (26/08/2026): `main` em `382f366208257bdb1032620c1da3c06c3fb67d3e` — persistência da Fase 2 **formalmente encerrada e integrada** (`docs/08` REV. 19/20); 9 migrations; suíte de persistência 9 suites · 79 passed; golden schema vigente; nenhuma aplicação de backend ou frontend existente.

## 4. Etapa 2.3A — Fundação do Backend

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** (revisão técnica independente, veredito **A**, 26/08/2026; findings apenas BAIXOS — `F-01` e `F-03` corrigidos na consolidação da REV. 1, `F-02` corrigido neste registro; integração registrada pós-medição na REV. 2 — §11).

Entregas — deliberadamente **sem nenhuma funcionalidade de domínio**:

- `apps/api` criado como workspace npm: **NestJS 11.2.3**, **ESM real** (`"type": "module"`, `module`/`moduleResolution` `nodenext`), **Node 24**, **TypeScript estrito** (`skipLibCheck: false`), **build com `tsc`** (sem `@nestjs/cli`/SWC/webpack — ver §6);
- health check mínimo `GET /health` → `{"status":"ok"}` (sem versão interna, segredo, dado de banco ou stack trace);
- integração com `packages/database` **exclusivamente pela API pública** do pacote (`exports`: `types` → `src/index.ts`, `default` → `dist/index.js`), expondo o mapeamento de erros por constraint (V-03/C-6); **o Prisma Client não é exportado nem instanciado** nesta fatia;
- catálogo tipado de auditoria e validator fail-closed (`P-BACK-01` — §7);
- testes unitários e de integração (§8);
- CI estendida com build, suíte, prova runtime do `exports` público (`F-01`) e smoke de bootstrap ESM com cleanup garantido (`F-03`), **sem alterar nenhuma guarda de persistência**.

## 5. Arquitetura implementada

*(Correção da REV. 4 — F-REV-01: a árvore e a contagem abaixo são o **snapshot histórico da arquitetura ao término da Etapa 2.3A**, preservado como registro daquela etapa. Elas NÃO representam o estado vigente: a 2.3B acrescentou `src/database/` — DatabaseModule/DatabaseService —, `src/audit/audit-writer.ts`, `src/profissional/` e as suítes de integração PostgreSQL, descritos em §6-A; as medições vigentes estão em §6-A.5.)*

```text
apps/api/
  src/
    main.ts                      bootstrap ESM (node dist/main.js), PORT, shutdown hooks
    app.module.ts                módulo raiz do monólito modular
    health/                      GET /health
    audit/
      audit.types.ts             SUCESSO|NEGADO|FALHA (D-AUD-02); regra de alvo_tipo (D-AUD-03)
      audit.catalog.ts           24 ações (D-AUD-01) + whitelist exaustiva (D-AUD-07)
      audit-context.validator.ts enforcement fail-closed (D-AUD-08), provider injetável
      audit.module.ts
  test/                          4 suites · 93 testes (medição da 2.3A — ampliada pela 2.3B, §6-A.5)
```

Ausências deliberadas (escopo 2.3B+): autenticação, sessão, RBAC, Prisma/Nest provider, CRUDs, fluxos emissores de auditoria, OpenAPI, frontend, repository genérico, event bus, CQRS, filas, cache. *(Nota da REV. 3: a 2.3B implementou o provider de persistência e o primeiro fluxo emissor INTERNO — §6-A; as demais ausências permanecem.)*

## 6. Decisões técnicas de implementação

Decisões **locais de implementação** — reversíveis, não normativas:

1. **Build por `tsc` puro** (decorators via `experimentalDecorators` + `emitDecoratorMetadata`), sem `@nestjs/cli`/SWC. Cumpre `D-ESM-01` com zero dependência de tooling adicional. `docs/08` §15/§16 citavam SWC como caminho previsto — era descrição de mitigação, não norma; nada foi reaberto.
2. **API pública de `packages/database`** no padrão de pacote interno de monorepo: `exports.types` → fonte (`src/index.ts`, typecheck sem build prévio) e `exports.default` → `dist/index.js` (runtime real, coberto pela prova F-01 da CI). Mudança **aditiva**, sem efeito físico na persistência.
3. **`"types": ["node"]`** no tsconfig da API — resolução determinística para o `@types/node` 24.13.3 fixado no workspace, imune ao `@types/node` 26 transitivo hoisted na raiz.
4. **Testes HTTP com `fetch` nativo** sobre porta efêmera (sem `supertest`).
5. **Hardening de escalares em `contexto`** — ver §7.3.
6. A suíte da API mapeia `@techlab-fisio/database` para o mesmo entrypoint público em fonte (`moduleNameMapper`); o caminho runtime real (`exports.default`) é provado fora do Jest pela CI (F-01).

## 6-A. Etapa 2.3B — Provider de persistência + primeiro fluxo transacional de auditoria

**Estado: IMPLEMENTADA E MEDIDA (branch `agent/fase2-etapa2.3b-persistencia-provider`) — aguardando revisão independente e rito de integração.** Escopo executado conforme autorização própria da 2.3B; **zero mudança física de persistência** (schema, migrations, golden e `protected-objects.json` byte a byte idênticos à baseline `b84ae6a` — diff vazio medido).

### 6-A.1 Fábrica pública de persistência (`packages/database`)

`packages/database` é o **proprietário da instanciação do Prisma Client**: fábrica pública `criarClientePersistencia({ url })` (Prisma Client 7.9.1 + `@prisma/adapter-pg`, conexão lazy — o ciclo de vida é do chamador) e tipos `ClientePersistencia`/`TransacaoPersistencia` na API pública. `apps/api` **não importa** `@prisma/client`, `@prisma/adapter-pg` nem `generated/prisma` por caminho profundo (verificado mecanicamente no challenge pré-versionamento). Ajuste mínimo de build: o pacote passou a compilar também o client gerado (`rootDir: "."`; `exports.default` → `dist/src/index.js`); a prova **F-01** da CI cobre o novo caminho runtime e a presença da fábrica. Nenhum repository genérico, Unit of Work ou workspace novo.

### 6-A.2 Provider Nest com ciclo de vida e guarda de postura de role

`apps/api/src/database/` — `DatabaseModule` + `DatabaseService` (singleton; cliente privado; **nenhum caminho público fora de `transacao()`**): `onModuleInit` valida configuração **sem ecoar valor** (`DATABASE_URL` ausente/inválida → aborto com motivo estável), conecta **eager/fail-fast** e **prova a postura de privilégios** da role corrente sobre `evento_auditoria` (capability-based via `has_table_privilege`, sem hardcode de nome de role): `SELECT` e `INSERT` **permitidos**; `UPDATE`, `DELETE` e `TRUNCATE` **proibidos**. Role privilegiada (`tlf_migrator`/superuser) **aborta o bootstrap ruidosamente**; nenhuma mensagem registra connection string ou credencial. `onModuleDestroy` encerra o pool; segundo `onModuleInit` é recusado (prevenção de pool duplicado). Fato medido registrado: no Prisma 7.9.1 o proxy transacional remove `$connect`/`$disconnect` mas **mantém** `$transaction` (transações aninhadas) — o discriminador estrutural usa o par de conexão.

### 6-A.3 AuditWriter transacional

`AuditWriter` (AuditModule) separa **política** (`AuditContextValidator` — D-AUD-07/08, executado SEMPRE antes de escrever) de **escrita**: recebe `TransacaoPersistencia` explicitamente, mapeia **campo a campo** (nunca Request/Response/DTO, nunca spread do candidato), persiste **somente CREATE**, não sanitiza nada silenciosamente, não ecoa valores em erro e não oferece update/delete. A verificação estrutural de cliente transacional é defesa em profundidade; a prova de atomicidade é a suíte PostgreSQL real (6-A.5).

### 6-A.4 Fluxo interno `profissional.situacao.alterada` — limite de autorização

`ProfissionalService.alterarSituacao({ profissionalId, atorUsuarioId, ativo })` (PRO-005; ação homologada por D-AUD-01). **Fatia técnica interna**: **não** existe controller/endpoint/rota; a funcionalidade administrativa **não** está disponível ao usuário. Registro normativo desta REV.: **"ator existente/ativo" = INTEGRIDADE da operação** (o evento exige ator real e válido — RN-061); **"ator autorizado" = responsabilidade AINDA NÃO IMPLEMENTADA nesta fatia** — RBAC/`profissionais.gerenciar` continua obrigatório antes de qualquer exposição futura, e nenhum caminho utilizável externamente contorna essa distinção. Regras: profissional deve existir; a situação deve realmente mudar (mutação **condicional** — `updateMany` com o estado anterior no predicado; sem SELECT → decisão em memória → UPDATE incondicional); mutação + evento na **mesma transação**; whitelist **vazia** (sem `contexto` — nem `ativo_anterior`/`ativo_novo`); `justificativa` NULL; `resultado` `SUCESSO`; `correlacao_id` gerado uma vez por operação.

### 6-A.5 Provas medidas (PostgreSQL 18 real, runtime `tlf_app`)

Suíte de integração da API (`apps/api/test/integration/`, banco descartável E-13; runtime exclusivamente `tlf_app`, migrator só em setup/limpeza; execução serial como na E-13): **3 suites · 21 passed**. Cobertura: provider resolvido pelo container Nest real (AppModule), conexão eager, singleton, postura aceita para `tlf_app` e **rejeitada para `tlf_migrator`**; segundo init recusado; `UPDATE`/`DELETE` em `evento_auditoria` **negados na prática** à role de runtime (E-11); fluxo feliz de inativação e reativação (1 mutação + **exatamente 1 evento** com campos homologados, `contexto` NULL); rejeições de integridade (profissional inexistente, ator inexistente, ator inativo, estado já vigente, repetição) com **zero evento**; **concorrência**: duas solicitações para o mesmo novo estado → exatamente uma vence, nenhum evento duplicado (READ COMMITTED + update condicional foi suficiente — nenhum lock adicional necessário); **atomicidade real**: falha do AuditWriter (contexto proibido e ação desconhecida) → ROLLBACK integral da mutação; falha da mutação → zero evento; escrita válida commitada. Suíte unitária da API (sem banco): **5 suites · 108 passed** (validação de configuração do provider sem vazar segredo, contrato do AuditWriter, T-AUD-CONTEXTO preservado) — *ampliada para **5 suites · 119 passed** pela correção `F-REV-02` (REV. 4)*. Persistência: **9 suites · 79 passed** inalterados.

### 6-A.6 CI da branch

Guardas 1/2/3, from-scratch, golden byte a byte, `migrate diff --exit-code`, build ESM e F-01 **preservados** (F-01 atualizado para o novo caminho `dist/src/index.js` + fábrica). Passos **acrescentados**: `verify:api-integration` (instância PostgreSQL 18 descartável fail-closed → suíte de integração da API) e smoke **R-BL-02 adaptado** (`scripts/smoke-api.mjs`): como o provider conecta eager, o smoke provisiona banco descartável + `migrate deploy` antes de executar o **processo real** `node apps/api/dist/main.js`, preservando `/health` 200, 404 sem stack, encerramento limpo por SIGTERM e cleanup garantido mesmo em falha. A evidência da run verde da CI desta branch pertence ao relatório de execução; o registro pós-integração ocorrerá na REV. seguinte (mesmo rito da 2.3A).

## 7. Auditoria — `P-BACK-01`

### 7.1 Estado

```text
P-BACK-01 — EM ANDAMENTO
```

**Concluído na 2.3A:** catálogo tipado centralizado (24 ações de `D-AUD-01`, conferência mecânica contra `docs/09` §12.2 — iguais e na mesma ordem); catálogo `SUCESSO | NEGADO | FALHA` (`D-AUD-02`, sem enum SQL); representação da regra de `alvo_tipo` (`D-AUD-03` — metadado histórico; sem despacho dinâmico de SQL; não concede acesso; rename não reescreve histórico); whitelist fail-closed exaustiva (`D-AUD-07` — 3 ações com chaves, 21 vazias); enforcement runtime (`D-AUD-08` — ação desconhecida, chave fora da whitelist, contexto não vazio em whitelist vazia e valor não escalar → rejeição explícita; sem sanitização silenciosa; mensagens citam chaves, nunca valores); `T-AUD-CONTEXTO` (§8).

**Concluído na 2.3B (medido; aguardando revisão/integração):** o **primeiro fluxo emissor real** existe — `operação → AuditContextValidator → AuditWriter → evento_auditoria` na **mesma transação** da mutação de negócio, exercitado ponta a ponta contra PostgreSQL real por `profissional.situacao.alterada` (§6-A). O validator está comprovadamente no caminho de escrita real (contexto proibido → rollback da operação inteira).

**Ainda aberto (nada disto foi decidido):** `L-05`, `L-06`, `L-07`, `L-08`; granularidade/abrangência de `configuracao.alterada`; alvo definitivo de `prontuario.exportado`; eventual `autor_original_usuario_id` (segue **rejeitada** pelo validator até decisão expressa); fluxo real de ação com **whitelist POSITIVA**; encerramento de `R2.2-04`.

### 7.2 `R2.2-04`

```text
R2.2-04 — ABERTO / PARCIALMENTE EXERCITADO POR PRIMEIRO FLUXO REAL
```

A política existe, a enforcement está implementada e testada e, desde a 2.3B, **um fluxo funcional real** executa `operação → validator → gravação em evento_auditoria` ponta a ponta (`profissional.situacao.alterada` — §6-A.5). Entretanto, esse primeiro fluxo prova apenas o caso de **whitelist VAZIA**. O risco **não é encerrado**: o encerramento só poderá ser proposto quando existir também prova ponta a ponta de uma ação com **whitelist POSITIVA** homologada. Candidato recomendado para essa futura fatia: `cobranca.desconto_aplicado` (par `valor_desconto_anterior`/`valor_desconto_novo` — D-AUD-07). **Esta recomendação não autoriza implementação**: a etapa correspondente (2.3C) exige autorização própria.

### 7.3 Hardening de valores escalares — decisão técnica local

A restrição vigente de `contexto` a **valores escalares JSON** (`string | number | boolean | null`; desde a REV. 4, `number` somente **finito** — `NaN`/`±Infinity` rejeitados, correção `F-REV-02`) é **decisão técnica local de implementação**: conservadora, fail-closed e **reversível**. Ela **NÃO constitui nova decisão normativa** e **NÃO integra `D-AUD-07` por implicação**. Registra-se que: todas as chaves atualmente homologadas são compatíveis (valores monetários e datas civis como string/number; UUID como string); objetos e arrays são rejeitados — barreira estrutural contra serialização genérica de DTO/request; eventual necessidade futura de estrutura composta em alguma chave exige **revisão explícita desta política**, não contorno. Não é requisito permanente do produto.

## 8. Testes e verificações

### 8.1 `T-AUD-CONTEXTO`

```text
T-AUD-CONTEXTO — EXECUTADO / PASSED
```

**Medição histórica da 2.3A: 88 testes de auditoria (83 unitários + 5 de integração); à época, a suíte completa de `apps/api` tinha 4 suites · 93 passed**, incluindo bootstrap/health e integração com o pacote de banco. A suíte foi posteriormente ampliada pela 2.3B (API unit **5 suites · 108 passed**; integração PostgreSQL **3 suites · 21 passed** — §6-A.5) e pela correção `F-REV-02` (API unit **5 suites · 119 passed** — REV. 4). A parte de integração resolve o `AuditContextValidator` a partir do **`AppModule`/container de DI real do NestJS** — não é fixture desconectada — e mede a **regra de aplicação**, não o PostgreSQL: por `D-AUD-08`, o ownership da validação é do backend, e nenhuma réplica existe em trigger/CHECK/JSON Schema/`packages/database`.

Cobertura provada: 24 ações aceitas com contexto vazio e ausente; ações inexistentes/RC/SF rejeitadas; as 21 whitelists vazias rejeitam qualquer chave (incl. 13 chaves apenas propostas em `docs/09` §§1..11); pares homologados de desconto e recálculo aceitos e chave extra rejeitada; `registro_original_id` aceito; `autor_original_usuario_id` rejeitada; múltiplas chaves com uma inválida → operação inteira rejeitada; candidato nunca mutado; valores rejeitados nunca aparecem na mensagem de erro; DTO/array rejeitados.

### 8.2 `R-BL-02`

```text
R-BL-02 — ENCERRADO
```

**Evidência técnica** (medida na implementação e reproduzida integralmente pela revisão independente): build ESM real por `tsc`; decorators + metadata exercitados no JS compilado (`__decorate`/`Reflect.metadata`, zero `require`/`module.exports`); artefato executado **diretamente** em Node 24 (`node apps/api/dist/main.js`); `GET /health` → 200 `{"status":"ok"}`; rota inexistente → 404 sem stack trace; encerramento limpo por sinal; import ESM real de `@techlab-fisio/database` **fora do Jest** resolvendo pelo `exports` do pacote; nenhum loader experimental no caminho de produção. **Registro formal:** o encerramento é efetivado por esta REV. 1 e pelo handoff de `docs/08` REV. 21. `D-ESM-01` não foi reaberta — esta é exatamente a validação prática que ela previa.

### 8.3 Bateria de verificação da consolidação

Registrada no relatório de consolidação da 2.3A: `npm ci`; `db:generate`; `db:validate`; `typecheck` (raiz + 2 workspaces, exit 0); `npm test` (persistência **9 suites · 79 passed · 0 todo** + API **4 suites · 93 passed**); `lint:migrations` (Guarda 1 — 36 objetos, nenhuma remoção); `verify:from-scratch` (E-15 + Guarda 2); `schema:verify` (Guarda 3 — golden byte a byte, 59944 bytes + `migrate diff --exit-code` 0); `npm run build`; `git diff --check`; provas runtime da API e do `exports` público. Integridade da persistência contra `382f366`: **diff vazio** em `schema.prisma`, nas 9 migrations e no golden.

## 9. Riscos e pendências transferidas

| Item | Estado vivo (autoritativo aqui) |
| --- | --- |
| `P-BACK-01` | **EM ANDAMENTO** (§7.1) — primeiro fluxo emissor real implementado e medido na 2.3B; RBAC e fluxo de whitelist positiva ainda ausentes |
| `R2.2-04` | **ABERTO / PARCIALMENTE EXERCITADO POR PRIMEIRO FLUXO REAL** (§7.2) |
| `R-BL-02` | **ENCERRADO** (§8.2) — smoke adaptado na 2.3B para banco descartável (provider eager), com todas as verificações preservadas (§6-A.6) |
| `T-AUD-CONTEXTO` | **EXECUTADO / PASSED** (§8.1) |
| RBAC / `profissionais.gerenciar` | **NÃO IMPLEMENTADO** — obrigatório antes de expor `profissional.situacao.alterada` (§6-A.4); "ator existente/ativo" ≠ "ator autorizado" |
| `L-05`..`L-08` | **ADIADAS** — nenhuma decidida; exigem decisão própria homologada |
| `configuracao.alterada` (granularidade/abrangência) | **PENDENTE** |
| `prontuario.exportado` (alvo definitivo) | **PENDENTE** |
| `autor_original_usuario_id` | **NÃO HOMOLOGADA** — rejeitada pelo validator até decisão expressa |
| `P2.2-05` (fisioterapeuta ↔ paciente relacionado) | **PENDENTE** — fatia futura de autorização clínica |
| `R-BL-09` (`deepmerge-ts` transitivo) | **ABERTO** — aceitação temporária monitorada (`docs/08` §15.2); **remedido na 2.3B sem alteração**: mesma cadeia (`prisma@7.9.1 → @prisma/config@7.9.1 → deepmerge-ts@7.1.5`), mesmas 3 high (GHSA-ggr8-5vv4-36mx); nenhuma dependência nova instalada na 2.3B; reavaliação obrigatória a cada atualização do Prisma 7 e antes de CI de produção/deploy |
| `V-06.c` (teto TS 6.0 × Next.js 16) | **PENDENTE** — bloqueia apenas o scaffold de `apps/web` |

## 10. Próximas etapas

Sujeitas a autorização própria, nesta ordem provável:

1. ~~**Rito de integração da 2.3A**~~ — **EXECUTADO em 26/08/2026** (PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3), merge commit `791e862`; registro pós-medição em §11, REV. 2).
2. ~~**Etapa 2.3B — implementação**~~ — **EXECUTADA em 26/08/2026** em branch `agent/**` (§6-A); **revisão independente EXECUTADA** (veredito **B — apto após correções pontuais**) e correções `F-REV-01`/`F-REV-02` aplicadas (REV. 4); pendem a **homologação** e, após ela, o rito de integração com registro pós-medição.
3. **Etapa 2.3C (futura, NÃO autorizada)** — primeiro fluxo real de ação com **whitelist POSITIVA** (candidato recomendado: `cobranca.desconto_aplicado` — §7.2), pré-condição para propor o encerramento de `R2.2-04`.
4. Decisões normativas adiadas (`L-05`..`L-08`, `configuracao.alterada`, `prontuario.exportado`, eventual `autor_original_usuario_id`) e RBAC (`profissionais.gerenciar`) — cada uma por decisão expressa de Bruno, nunca por implicação de implementação.

## 11. Histórico de revisões

| REV. | Data | Conteúdo |
| --- | --- | --- |
| **4** | **26/08/2026** | **CONSOLIDAÇÃO CORRETIVA PÓS-REVISÃO DA ETAPA 2.3B** (revisão técnica independente, veredito **B — apto após correções pontuais**) — nenhuma decisão normativa criada ou reaberta; escopo restrito aos findings autorizados. (a) **`F-REV-01` (documental)**: eliminado o drift factual desta própria página — §5 passou a rotular árvore e contagem (`4 suites · 93`) como **snapshot histórico da 2.3A** com remissão a §6-A; §8.1 deixou de afirmar no presente que a suíte completa da API tem `4 suites · 93 passed`, rotulando o número como medição da 2.3A ampliada pela 2.3B e pela correção `F-REV-02`. Nenhum histórico apagado. (b) **`F-REV-02` (código)**: `ehEscalarJson()` do `AuditContextValidator` passou a aceitar `number` somente quando `Number.isFinite` — `NaN`/`+Infinity`/`-Infinity` (não representáveis em JSON; antes serializados silenciosamente como `null` no `jsonb`) agora são **rejeitados fail-closed** sob o motivo existente `VALOR_NAO_ESCALAR`, sem valor na mensagem, sem sanitização e sem mutação do candidato; §7.3 anotado. **Medições pós-fix**: API unit **5 suites · 119 passed** (11 testes novos: validator NaN/±Infinity rejeitados + finitos `15.5`/`0`/`-0`/`Number.MAX_VALUE` aceitos + mensagens sem valor; AuditWriter com contexto não finito → zero `create`); integração PostgreSQL real **3 suites · 21 passed** inalterada; persistência **9 suites · 79 passed** inalterada; typecheck e build verdes; challenge mecânico sobre o artefato compilado 20/20 PASS. (c) Findings `F-REV-03`..`F-REV-08` (BAIXO/INFORMATIVO) **deliberadamente NÃO alterados** — permanecem documentados no relatório de revisão. (d) A 2.3B **não** está homologada nem integrada por esta REV.; `R2.2-04` segue ABERTO e `P-BACK-01` EM ANDAMENTO; nenhuma mudança em schema/migrations/golden/protected-objects, `docs/09` ou Base Imutável; nenhuma dependência nova; evidência da CI verde do novo HEAD pertence ao relatório de execução. |
| **3** | **26/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA IMPLEMENTAÇÃO DA ETAPA 2.3B** (branch `agent/fase2-etapa2.3b-persistencia-provider`, baseline `b84ae6a`) — nenhuma decisão normativa criada ou reaberta. (a) **Implementado e medido** (§6-A): fábrica pública `criarClientePersistencia` + tipos em `packages/database` (proprietário do Prisma Client; `exports.default` → `dist/src/index.js`, F-01 atualizado); `DatabaseModule`/`DatabaseService` singleton com conexão eager/fail-fast, shutdown limpo e **guarda capability-based de postura de role** em `evento_auditoria` (SELECT/INSERT permitidos; UPDATE/DELETE/TRUNCATE proibidos — role privilegiada aborta o bootstrap); `AuditWriter` transacional (validator sempre no caminho, mapeamento campo a campo, create-only, sem sanitização, sem valores em erro); fluxo interno `profissional.situacao.alterada` (PRO-005) com mutação condicional + evento na mesma transação, whitelist vazia, justificativa NULL, `correlacao_id` único por operação. (b) **Limite de autorização registrado**: sem controller/endpoint/rota; "ator existente/ativo" = integridade; "ator autorizado" = NÃO implementado (RBAC pendente) — §6-A.4. (c) **Medições**: API integração **3 suites · 21 passed** contra PostgreSQL 18 real como `tlf_app` (postura, rejeição do migrator, atomicidade commit/rollback reais, concorrência com exatamente um vencedor/evento); API unit **5 suites · 108 passed**; persistência **9 suites · 79 passed**; Guardas 1/2/3 verdes; golden byte a byte (59944 bytes); `migrate diff` exit 0; F-01 verde; smoke R-BL-02 adaptado verde; `git diff` vazio em schema/migrations/golden/protected-objects contra `b84ae6a`. (d) **Fato técnico medido**: proxy transacional do Prisma 7.9.1 remove `$connect`/`$disconnect` e mantém `$transaction` (§6-A.2). (e) Estados atualizados: `P-BACK-01` EM ANDAMENTO (primeiro fluxo emissor real existe); **`R2.2-04` ABERTO / PARCIALMENTE EXERCITADO POR PRIMEIRO FLUXO REAL** (encerramento exige futura prova com whitelist positiva — candidato `cobranca.desconto_aplicado`, sem autorizar 2.3C); `R-BL-09` remedido sem alteração; demais estados mantidos. (f) Nenhuma migration/schema/golden alterado; `docs/09` e Base Imutável intactos; nenhum merge/deploy/tag/release executado. |
| **2** | **26/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3A NA `main`** — nenhuma decisão reaberta. (a) **Integração executada em 26/08/2026**: **PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3)** (`agent/fase2-etapa2.3a-backend-foundation` → `main`), **merge commit** `791e862f17f77cfafe74d39bad866b11c15c0e98` às 09:07:38Z — método `merge` (sem squash, sem rebase, sem force-push), com proteção de corrida sobre o HEAD aprovado `9d7dcd5`; os **5 commits granulares preservados** como ancestrais da `main` (`b839eb6`, `dd24897`, `bb29caf`, `9d80303`, `9d7dcd5`); árvore da `main` integrada **idêntica** à do HEAD aprovado (diff de 0 bytes). (b) **CI medida sobre a `main` integrada**: o workflow não dispara em push para `main`, então a run foi executada manualmente (`workflow_dispatch --ref main`, precedente da REV. 20 de `docs/08`) — run **`32951372071`**, **`success`** sobre `791e862`, todos os passos verdes: instalação pelo lockfile; Prisma generate/validate; typecheck; **Guarda 1**; **E-15 + Guarda 2** (reconstrução from-scratch + suíte 9 suites · 79 passed); **Guarda 3 + alarme** (golden byte a byte); build ESM dos workspaces; **suíte da API 4 suites · 93 passed** (incl. `T-AUD-CONTEXTO`); **prova runtime do `exports.default` (F-01)**; **smoke ESM de bootstrap (R-BL-02)** com `/health` 200, 404 e cleanup. (c) **Persistência intacta na `main` integrada**: `schema.prisma`, as 9 migrations e o golden byte a byte idênticos; Guardas 1/2/3 verdes na run acima. (d) Estados mantidos: Etapa 2.3A **CONCLUÍDA/HOMOLOGADA/INTEGRADA**; `R-BL-02` **ENCERRADO**; `T-AUD-CONTEXTO` **EXECUTADO/PASSED**; `P-BACK-01` **EM ANDAMENTO**; `R2.2-04` **ABERTO/TRANSFERIDO**; `L-05..L-08` **ADIADAS**; `R-BL-09` **ABERTO** (aceitação temporária monitorada); `V-06.c` **PENDENTE**. (e) **Nenhuma Etapa 2.3B iniciada**; nenhum deploy, tag ou release; `docs/09` e a Base Imutável intactos. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **1** | **26/08/2026** | Criação do documento. Registro da Etapa 2.3A (CONCLUÍDA/HOMOLOGADA — revisão independente, veredito A); correção dos findings `F-01` (prova runtime do `exports.default` na CI) e `F-03` (cleanup garantido do smoke); correção do `F-02` neste registro (contagem correta: 88 testes de auditoria = 83 unitários + 5 integração; suíte da API 4 suites · 93 passed); `R-BL-02` ENCERRADO; `T-AUD-CONTEXTO` EXECUTADO/PASSED; `P-BACK-01` EM ANDAMENTO; `R2.2-04` ABERTO; hardening de escalares registrado como decisão técnica local (§7.3). Handoff recebido de `docs/08` REV. 21 |

---

**Fim — `docs/10-backend-implementacao.md` — REV. 4 — documento mutável; estado vivo das pendências da frente de backend; Etapa 2.3A INTEGRADA NA `main` (merge `791e862`); Etapa 2.3B IMPLEMENTADA, MEDIDA e REVISADA (veredito B) em branch `agent/**`, com correções `F-REV-01`/`F-REV-02` aplicadas, aguardando homologação e integração. Fontes normativas permanecem `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`, `docs/02`..`docs/07`, `docs/08` (baseline) e `docs/09` §12.**
