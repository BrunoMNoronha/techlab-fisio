# Implementação do Backend — TechLab Fisio

> **Arquivo:** `docs/10-backend-implementacao.md`
> **Natureza:** documento **MUTÁVEL** — registro vivo de implementação da frente de backend (`apps/api`)
> **Status:** backend **INICIADO** — Etapa 2.3A **CONCLUÍDA, HOMOLOGADA e INTEGRADA NA `main`** (revisão independente com veredito A; integração via PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3), merge commit `791e862`, CI da `main` integrada verde — REV. 2)
> **Revisão vigente:** REV. 2 (26/08/2026)

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
  test/                          4 suites · 93 testes
```

Ausências deliberadas (escopo 2.3B+): autenticação, sessão, RBAC, Prisma/Nest provider, CRUDs, fluxos emissores de auditoria, OpenAPI, frontend, repository genérico, event bus, CQRS, filas, cache.

## 6. Decisões técnicas de implementação

Decisões **locais de implementação** — reversíveis, não normativas:

1. **Build por `tsc` puro** (decorators via `experimentalDecorators` + `emitDecoratorMetadata`), sem `@nestjs/cli`/SWC. Cumpre `D-ESM-01` com zero dependência de tooling adicional. `docs/08` §15/§16 citavam SWC como caminho previsto — era descrição de mitigação, não norma; nada foi reaberto.
2. **API pública de `packages/database`** no padrão de pacote interno de monorepo: `exports.types` → fonte (`src/index.ts`, typecheck sem build prévio) e `exports.default` → `dist/index.js` (runtime real, coberto pela prova F-01 da CI). Mudança **aditiva**, sem efeito físico na persistência.
3. **`"types": ["node"]`** no tsconfig da API — resolução determinística para o `@types/node` 24.13.3 fixado no workspace, imune ao `@types/node` 26 transitivo hoisted na raiz.
4. **Testes HTTP com `fetch` nativo** sobre porta efêmera (sem `supertest`).
5. **Hardening de escalares em `contexto`** — ver §7.3.
6. A suíte da API mapeia `@techlab-fisio/database` para o mesmo entrypoint público em fonte (`moduleNameMapper`); o caminho runtime real (`exports.default`) é provado fora do Jest pela CI (F-01).

## 7. Auditoria — `P-BACK-01`

### 7.1 Estado

```text
P-BACK-01 — EM ANDAMENTO
```

**Concluído nesta etapa:** catálogo tipado centralizado (24 ações de `D-AUD-01`, conferência mecânica contra `docs/09` §12.2 — iguais e na mesma ordem); catálogo `SUCESSO | NEGADO | FALHA` (`D-AUD-02`, sem enum SQL); representação da regra de `alvo_tipo` (`D-AUD-03` — metadado histórico; sem despacho dinâmico de SQL; não concede acesso; rename não reescreve histórico); whitelist fail-closed exaustiva (`D-AUD-07` — 3 ações com chaves, 21 vazias); enforcement runtime (`D-AUD-08` — ação desconhecida, chave fora da whitelist, contexto não vazio em whitelist vazia e valor não escalar → rejeição explícita; sem sanitização silenciosa; mensagens citam chaves, nunca valores); `T-AUD-CONTEXTO` (§8).

**Ainda aberto (nada disto foi decidido):** `L-05`, `L-06`, `L-07`, `L-08`; granularidade/abrangência de `configuracao.alterada`; alvo definitivo de `prontuario.exportado`; eventual `autor_original_usuario_id` (segue **rejeitada** pelo validator até decisão expressa); exercício ponta a ponta por fluxos emissores reais; encerramento de `R2.2-04`.

### 7.2 `R2.2-04`

```text
R2.2-04 — ABERTO / TRANSFERIDO PARA O BACKEND
```

A política de whitelist agora **existe**, e a enforcement está **implementada e testada**. Entretanto, **não existe fluxo funcional real** executando `operação → validator → gravação em evento_auditoria`; o risco não deve ser formalmente encerrado até que fluxos emissores reais o exercitem ponta a ponta.

### 7.3 Hardening de valores escalares — decisão técnica local

A restrição vigente de `contexto` a **valores escalares JSON** (`string | number | boolean | null`) é **decisão técnica local de implementação**: conservadora, fail-closed e **reversível**. Ela **NÃO constitui nova decisão normativa** e **NÃO integra `D-AUD-07` por implicação**. Registra-se que: todas as chaves atualmente homologadas são compatíveis (valores monetários e datas civis como string/number; UUID como string); objetos e arrays são rejeitados — barreira estrutural contra serialização genérica de DTO/request; eventual necessidade futura de estrutura composta em alguma chave exige **revisão explícita desta política**, não contorno. Não é requisito permanente do produto.

## 8. Testes e verificações

### 8.1 `T-AUD-CONTEXTO`

```text
T-AUD-CONTEXTO — EXECUTADO / PASSED
```

**88 testes de auditoria: 83 unitários + 5 de integração** (a suíte completa de `apps/api` tem **4 suites · 93 passed**, incluindo bootstrap/health e integração com o pacote de banco). A parte de integração resolve o `AuditContextValidator` a partir do **`AppModule`/container de DI real do NestJS** — não é fixture desconectada — e mede a **regra de aplicação**, não o PostgreSQL: por `D-AUD-08`, o ownership da validação é do backend, e nenhuma réplica existe em trigger/CHECK/JSON Schema/`packages/database`.

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
| `P-BACK-01` | **EM ANDAMENTO** (§7.1) |
| `R2.2-04` | **ABERTO / TRANSFERIDO PARA O BACKEND** (§7.2) |
| `R-BL-02` | **ENCERRADO** (§8.2) |
| `T-AUD-CONTEXTO` | **EXECUTADO / PASSED** (§8.1) |
| `L-05`..`L-08` | **ADIADAS** — nenhuma decidida; exigem decisão própria homologada |
| `configuracao.alterada` (granularidade/abrangência) | **PENDENTE** |
| `prontuario.exportado` (alvo definitivo) | **PENDENTE** |
| `autor_original_usuario_id` | **NÃO HOMOLOGADA** — rejeitada pelo validator até decisão expressa |
| `P2.2-05` (fisioterapeuta ↔ paciente relacionado) | **PENDENTE** — fatia futura de autorização clínica |
| `R-BL-09` (`deepmerge-ts` transitivo) | **ABERTO** — aceitação temporária monitorada (`docs/08` §15.2); remedido na 2.3A sem alteração: mesma cadeia, mesmas 3 high; reavaliação obrigatória a cada atualização do Prisma 7 e antes de CI de produção/deploy |
| `V-06.c` (teto TS 6.0 × Next.js 16) | **PENDENTE** — bloqueia apenas o scaffold de `apps/web` |

## 10. Próximas etapas

Sujeitas a autorização própria, nesta ordem provável:

1. ~~**Rito de integração da 2.3A**~~ — **EXECUTADO em 26/08/2026** (PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3), merge commit `791e862`; registro pós-medição em §11, REV. 2).
2. **Etapa 2.3B** — provider de persistência (Prisma Client + adapter-pg como provider Nest com ciclo de vida, role `tlf_app`) e **primeiro fluxo emissor de auditoria** ponta a ponta (`operação → validator → evento_auditoria`), que forçará as primeiras decisões reais de `alvo_tipo` em uso e abrirá caminho para encerrar `R2.2-04`.
3. Decisões normativas adiadas (`L-05`..`L-08`, `configuracao.alterada`, `prontuario.exportado`, eventual `autor_original_usuario_id`) — cada uma por decisão expressa de Bruno, nunca por implicação de implementação.

## 11. Histórico de revisões

| REV. | Data | Conteúdo |
| --- | --- | --- |
| **2** | **26/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3A NA `main`** — nenhuma decisão reaberta. (a) **Integração executada em 26/08/2026**: **PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3)** (`agent/fase2-etapa2.3a-backend-foundation` → `main`), **merge commit** `791e862f17f77cfafe74d39bad866b11c15c0e98` às 09:07:38Z — método `merge` (sem squash, sem rebase, sem force-push), com proteção de corrida sobre o HEAD aprovado `9d7dcd5`; os **5 commits granulares preservados** como ancestrais da `main` (`b839eb6`, `dd24897`, `bb29caf`, `9d80303`, `9d7dcd5`); árvore da `main` integrada **idêntica** à do HEAD aprovado (diff de 0 bytes). (b) **CI medida sobre a `main` integrada**: o workflow não dispara em push para `main`, então a run foi executada manualmente (`workflow_dispatch --ref main`, precedente da REV. 20 de `docs/08`) — run **`32951372071`**, **`success`** sobre `791e862`, todos os passos verdes: instalação pelo lockfile; Prisma generate/validate; typecheck; **Guarda 1**; **E-15 + Guarda 2** (reconstrução from-scratch + suíte 9 suites · 79 passed); **Guarda 3 + alarme** (golden byte a byte); build ESM dos workspaces; **suíte da API 4 suites · 93 passed** (incl. `T-AUD-CONTEXTO`); **prova runtime do `exports.default` (F-01)**; **smoke ESM de bootstrap (R-BL-02)** com `/health` 200, 404 e cleanup. (c) **Persistência intacta na `main` integrada**: `schema.prisma`, as 9 migrations e o golden byte a byte idênticos; Guardas 1/2/3 verdes na run acima. (d) Estados mantidos: Etapa 2.3A **CONCLUÍDA/HOMOLOGADA/INTEGRADA**; `R-BL-02` **ENCERRADO**; `T-AUD-CONTEXTO` **EXECUTADO/PASSED**; `P-BACK-01` **EM ANDAMENTO**; `R2.2-04` **ABERTO/TRANSFERIDO**; `L-05..L-08` **ADIADAS**; `R-BL-09` **ABERTO** (aceitação temporária monitorada); `V-06.c` **PENDENTE**. (e) **Nenhuma Etapa 2.3B iniciada**; nenhum deploy, tag ou release; `docs/09` e a Base Imutável intactos. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **1** | **26/08/2026** | Criação do documento. Registro da Etapa 2.3A (CONCLUÍDA/HOMOLOGADA — revisão independente, veredito A); correção dos findings `F-01` (prova runtime do `exports.default` na CI) e `F-03` (cleanup garantido do smoke); correção do `F-02` neste registro (contagem correta: 88 testes de auditoria = 83 unitários + 5 integração; suíte da API 4 suites · 93 passed); `R-BL-02` ENCERRADO; `T-AUD-CONTEXTO` EXECUTADO/PASSED; `P-BACK-01` EM ANDAMENTO; `R2.2-04` ABERTO; hardening de escalares registrado como decisão técnica local (§7.3). Handoff recebido de `docs/08` REV. 21 |

---

**Fim — `docs/10-backend-implementacao.md` — REV. 2 — documento mutável; estado vivo das pendências da frente de backend; Etapa 2.3A INTEGRADA NA `main` (merge `791e862`, CI run `32951372071` verde). Fontes normativas permanecem `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`, `docs/02`..`docs/07`, `docs/08` (baseline) e `docs/09` §12.**
