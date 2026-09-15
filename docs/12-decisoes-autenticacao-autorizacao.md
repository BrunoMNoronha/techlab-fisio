# Decisões de Autenticação e Autorização — `D-2.3D-01`..`D-2.3D-20`

> **Documento:** `docs/12-decisoes-autenticacao-autorizacao.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Frente de backend (`apps/api`) — Etapa 2.3D-B, fatia **F0**
> **Status:** **DECIDIDO — `D-2.3D-01`..`D-2.3D-20` homologadas por Bruno Menezes Noronha (`D-2.3D-01`..`D-2.3D-12` em 27/08/2026; `D-2.3D-13` em 28/08/2026; `D-2.3D-14` e `D-2.3D-15` em 31/08/2026; `D-2.3D-16`, `D-2.3D-17` e `D-2.3D-18` em 05/09/2026; `D-2.3D-19` em 06/09/2026; `D-2.3D-20` em 07/09/2026 — TLF-BASE-V1 §15, item 1)**
> **Data:** 27 de agosto de 2026 (REV. 3 a REV. 5 em 28/08/2026; REV. 6 em 31/08/2026; REV. 7 em 02/09/2026; REV. 8 e REV. 9 em 05/09/2026; REV. 10 e REV. 11 em 06/09/2026; REV. 12 em 14/09/2026; REV. 13 e REV. 14 em 15/09/2026)
> **Natureza:** registro **normativo** das decisões que governam a implementação de autenticação e autorização da Etapa 2.3D. Segue o padrão de `docs/09` §12 e de `docs/11` (registro de decisão com valor normativo próprio). **Não altera** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` nem `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md` nem `docs/02`..`docs/07`; **não reabre** `D-AUD-01`..`D-AUD-08` (`docs/09` §12).
> **Revisão vigente:** REV. 14 (15/09/2026) — **SINCRONIZAÇÃO PÓS-INTEGRAÇÃO DE `P-2.3D-08` / `D-2.3D-20` NA `main` (PR #47, MERGE `89fa492`) E ENCERRAMENTO FACTUAL DE `P-2.3D-04` MEDIANTE PROVA E2E REAL SAME-ORIGIN**. Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-20` vigentes; Base Imutável V2 intacta; zero drift de persistência (`packages/database`); zero dependências adicionadas. **(a) Sincronização pós-integração:** `D-2.3D-20` (`GET /auth/sessao`) e a prova E2E real same-origin integradas na `main` em 15/09/2026 via PR [#47](https://github.com/BrunoMNoronha/techlab-fisio/pull/47) (commit `4f78c4ed2de5b2e9f358f55accfa021b027fc124`, merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`, CI run `34983136046`). `P-2.3D-08` passa a **CONCLUÍDA / INTEGRADA NA `main`**. **(b) Encerramento formal de `P-2.3D-04`:** Encerrada em 15/09/2026 após a integração do PR #47 (merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`) que versionou `apps/web/scripts/verify-web-api-e2e.mjs` e o passo correspondente na CI, executando simultaneamente PostgreSQL real em container, NestJS real compilado, Next.js real compilado com Route Handler de proxy same-origin (`/api/*`), `ProtecaoCsrfGuard` real e cookie real de sessão, provando que a baseline de CSRF de `D-2.3D-07` (`SameSite=Strict`, cabeçalho obrigatório `X-TLF-Requisicao` nas mutações, Fetch Metadata, validação de `Origin`, ausência de CORS) protege a fronteira de ponta a ponta sem necessidade de synchronizer token adicional.
> **Estado anterior preservado:** REV. 13 (15/09/2026) — **ACRÉSCIMO DE UMA DECISÃO NOVA: `D-2.3D-20` (§5.20) — consulta da sessão autenticada atual por `GET /auth/sessao`**, homologada por Bruno Menezes Noronha em 07/09/2026. Atualização factual da integração de `P-2.3D-07` na `main` em 14/09/2026 (PR [#46](https://github.com/BrunoMNoronha/techlab-fisio/pull/46), commit `540302e5a95ae733ad07647af8318891b4ec9ee4`, merge commit `b6427e1ab999aae40f41e7745fe374f32b719836`, CI run `34884210876`). Abertura e materialização de `P-2.3D-08` (§10.5, §11) para implementação da rota no backend e prova E2E automatizada real same-origin com PostgreSQL 18 descartável, NestJS compilado, Next.js com proxy Route Handler, `ProtecaoCsrfGuard` real e cookie real.
> **Estado anterior preservado:** REV. 12 (14/09/2026) — conclusão técnica e validação de `P-2.3D-07` / AUT-002 em branch própria (`agent/p-2.3d-07-revogacao-sessao-terceiro`), critérios `A-01`..`A-22` concluídos.
> **Estado anterior preservado:** REV. 11 (06/09/2026) — sincronização factual pós-integração da REV. 10 na `main` (PR [#26](https://github.com/BrunoMNoronha/techlab-fisio/pull/26), merge commit `aba939c`) e medição same-origin de `apps/web` (PR [#27](https://github.com/BrunoMNoronha/techlab-fisio/pull/27), merge commit `0d76474`).
> **Estado anterior preservado:** REV. 10 (06/09/2026) — acréscimo de `D-2.3D-19` (§5.19) — revogação administrativa de sessão de terceiro; rodada exclusivamente normativa e documental.
> **Estado anterior preservado:** REV. 9 (05/09/2026) — acréscimo de `D-2.3D-18` (§5.18) e encerramento da Etapa 2.3D pela F7; `Q-01` resolvido; `L-F6-07` não promovida, com `Q-02` aberta e não bloqueante.
> **Estado anterior preservado:** REV. 8 (05/09/2026) — acréscimo de `D-2.3D-16` (§5.16) e `D-2.3D-17` (§5.17); F6 CONCLUÍDA em §9; AUT-004 MATERIALIZADA em §12.
> **Estado anterior preservado:** REV. 7 (02/09/2026) — atualização **exclusivamente factual**: a fatia **F5** passa a **CONCLUÍDA** em §9, por ter sido homologada por Bruno Menezes Noronha e integrada na `main` em 02/09/2026 (merge commit `657676b`, PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18); `docs/10` §6-O.8; §11, REV. 29). **Nenhuma decisão foi modificada, renumerada, reduzida, acrescentada ou reaberta** — `D-2.3D-01`..`D-2.3D-15` permanecem exatamente como homologadas; **`D-2.3D-14` e `D-2.3D-15` não foram tocadas**. **F6 permanece NÃO INICIADA.**
> **Estado anterior preservado:** REV. 6 (31/08/2026) — acréscimo de **duas decisões novas**, homologadas por Bruno Menezes Noronha: `D-2.3D-14` (§5.14), que fixa a semântica aditiva e convergente do seed RBAC, inclusive no modo estrito; e `D-2.3D-15` (§5.15), que fixa a autoria nula com justificativa operacional obrigatória no bootstrap inaugural. Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta. A F5 permanece não integrada e sujeita à homologação técnica própria.
> **Estado anterior preservado:** REV. 5 (28/08/2026) — atualização **exclusivamente factual**: a fatia **F4** passa a **CONCLUÍDA** em §9, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 (`docs/10` §6-L; §11, REV. 23). **Nenhuma decisão foi modificada, renumerada, reduzida, acrescentada ou reaberta** — `D-2.3D-01`..`D-2.3D-13` permanecem exatamente como homologadas; **`D-2.3D-09` não foi tocada**; **`D-2.3D-10` não foi tocada** e a **F5 permanece NÃO INICIADA**; **nenhuma `D-2.3D-14` foi criada**. Estado anterior preservado: REV. 4 (28/08/2026) — atualização **exclusivamente factual**: a fatia **F3 passa a CONCLUÍDA** em §9, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 (`docs/10` §6-I; §11, REV. 19). **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas, e nenhuma pendência de §11 foi alterada ou encerrada. Estado anterior preservado: REV. 3 (28/08/2026) — **acréscimo de UMA decisão nova: `D-2.3D-13` — proteção de concorrência em voo do limitador de login** (§5.13), homologada por Bruno Menezes Noronha após a segunda revisão técnica independente adversarial da F3, que a classificou como decisão comportamental e recusou homologá-la em nome dele. **Nenhuma decisão anterior foi modificada, renumerada ou reaberta** — `D-2.3D-01`..`D-2.3D-12` seguem exatamente como homologadas; em particular `D-2.3D-06` permanece intacta, e `D-2.3D-13` a COMPLEMENTA sem alterar a política de falhas/janela. A implementação registrava o comportamento como decisão local `L-11` (`docs/10` §6-G.2); `L-11` passa a ser **alias histórico** de `D-2.3D-13`. Estado anterior preservado: REV. 2 (27/08/2026) — atualização exclusivamente factual: `R-2.3D-03` **ENCERRADO** pela prova de monotonicidade atômica produzida na F2 (`docs/10` §6-E.5/§6-E.9/§9), por decisão de Bruno Menezes Noronha. **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-12` seguem como homologadas; em particular `D-2.3D-04` permanece intacta. REV. 1 (27/08/2026) — atualização exclusivamente factual: `P-2.3D-02` ENCERRADA pelo benchmark da F1 (`docs/10` §6-D.5). **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-12` seguem como homologadas. REV. 0 (27/08/2026): F0 executada — decisões registradas + única reabertura física da persistência de sessão.

---

## 1. Identificação e status

| Campo | Valor |
| --- | --- |
| Identificadores | `D-2.3D-01` .. `D-2.3D-20` |
| Autoridade | Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) |
| Data da homologação | 27/08/2026 (`D-2.3D-01`..`D-2.3D-12`) · 28/08/2026 (`D-2.3D-13`) · 31/08/2026 (`D-2.3D-14` e `D-2.3D-15`) · 05/09/2026 (`D-2.3D-16`, `D-2.3D-17` e `D-2.3D-18`) · 06/09/2026 (`D-2.3D-19`) · 07/09/2026 (`D-2.3D-20`) |
| Baseline de código na homologação | `main` = `53f9fc5777759388bfb4bcaa429f4f607733b422` |
| Fatia que materializou este registro | **F0** — decisões normativas + reabertura física controlada da persistência de sessão |
| Efeito físico na F0 | **exclusivamente `D-2.3D-01`**; as demais são normativas e produzem efeito nas fatias F1..F7 (`D-2.3D-13` foi acrescentada em 28/08/2026; `D-2.3D-14` e `D-2.3D-15`, em 31/08/2026; `D-2.3D-16`, `D-2.3D-17` e `D-2.3D-18`, em 05/09/2026; `D-2.3D-19`, em 06/09/2026; `D-2.3D-20`, em 07/09/2026). **`D-2.3D-19` e `D-2.3D-20` NÃO têm efeito físico**: usam persistência já existente sem migration |

Este documento é a **baseline normativa da Etapa 2.3D**. Onde uma fatia posterior divergir dele, prevalece este registro até que uma decisão expressa de Bruno o altere.

## 2. Escopo

**Dentro do escopo deste registro:** persistência de sessão; hash de senha; normalização do login; política de sessão; estados terminais; anti-abuso; cookie e CSRF; recuperação de senha; RBAC inicial; primeiro Administrador; OpenAPI; auditoria de autenticação; **revogação administrativa de sessão de terceiro** (`D-2.3D-19`); **consulta da sessão autenticada atual** (`D-2.3D-20`, homologada em 07/09/2026).

**Fora do escopo deste registro:** qualquer alteração de `docs/02`..`docs/07`; qualquer alteração do catálogo de auditoria ou da whitelist de `contexto` (`docs/09` §12, `D-AUD-01`/`D-AUD-07`); autorização clínica por relação profissional↔paciente (`P2.2-05`); ativação/inativação de usuários (AUT-005).

**Escopo executado na F0 — e apenas ele:**

1. o registro normativo de `D-2.3D-01`..`D-2.3D-12` (este documento);
2. a materialização física de `D-2.3D-01` em `sessao_autenticacao` — duas colunas e uma CHECK;
3. a atualização das guardas anti-drift e do golden schema decorrentes de (2);
4. os testes de persistência que provam (2).

**Nada de F1+ foi iniciado na F0.** Em particular, NÃO existem neste ponto: `CredencialService`, Argon2, `SessaoService`, geração ou hash de token em código, controllers, guards, decorators de autorização, rate limiting, cookies, CSRF, OpenAPI, seeds, bootstrap de Administrador, recuperação de senha, endpoints, alteração de `usuario.email`, nova ação de auditoria ou ampliação de whitelist. **Nenhuma dependência foi instalada.**

## 3. Fontes

| Fonte | Papel neste registro |
| --- | --- |
| `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` | Autoridade superior. §5.1 (escopo de autenticação), §9 (arquitetura de referência: sessão + cookies protegidos, RBAC, OpenAPI), §10 (segurança: senha com algoritmo moderno; nunca registrar senha/token; proteção contra CSRF e abuso de autenticação), §14 (governança), §15 (hierarquia) |
| `docs/02-requisitos.md` | AUT-001..AUT-006; FC-01 e sua matriz de testes |
| `docs/03-regras-negocio.md` | RN-004 (estados da sessão), RN-001/005 |
| `docs/04-perfis-permissoes.md` | §3 (papéis), §5 (identificadores funcionais de permissão), §10 |
| `docs/05-jornadas-fluxos.md` | FC-01 — jornada de autenticação e auditoria |
| `docs/06-modelo-dominio.md` | §9 (operação sensível → evento de auditoria); entidades de identidade |
| `docs/07-modelo-persistencia.md` | §5 (convenções físicas), §7.1 (`sessao_autenticacao`, `usuario`, `segredo_recuperacao_senha`), §10.2 (CHECK constraints), §10-A (IDX-S1), §22.1/§22.3, §24.2 (T-07) |
| `docs/08-baseline-tecnica-plano-implementacao.md` | §9.3 (Guardas 1–3), §10 (política de migrations), §10.2 (proibição de `db pull`), §13 (`E-09`, `E-15`, `E-16`), §14 (rastreabilidade) |
| `docs/09-pacote-decisao-p-e14-01.md` §12 | `D-AUD-01`..`D-AUD-08` — fonte normativa **exclusiva** e **não reaberta** por este documento |
| `docs/10-backend-implementacao.md` | Registro vivo da frente de backend; estado de entrada da Etapa 2.3D |
| `docs/11-registro-decisao-p-2.3c-01.md` | Precedente de forma para registro de decisão normativa |
| Código vigente | `packages/database/prisma/schema.prisma`, migrations, `schema.golden.sql`, `protected-objects.json`, `test/guard-anti-drift.spec.ts`, `scripts/lint-migrations.mjs`, `scripts/schema-snapshot.mjs`, `scripts/verify-from-scratch.mjs` |

## 4. Contexto

A persistência da Fase 2 foi **formalmente encerrada** (`docs/08` REV. 19/20) e a frente de backend passou a consumi-la apenas por sua API pública (`docs/10` §1). As Etapas 2.3A, 2.3B e 2.3C entregaram fundação, provider de persistência e o primeiro fluxo com whitelist positiva — **sem nenhum endpoint HTTP, sem RBAC e sem autenticação**.

A Etapa 2.3D é a primeira a exigir autenticação real. O modelo físico homologado de `sessao_autenticacao` (`docs/07` §7.1) descreve `id`, `usuario_id`, `estado`, `criada_em`, `expira_em`, `encerrada_em` e `revogada_por_usuario_id` — e **não possui onde guardar o verificador do token de sessão** nem como sustentar o timeout ocioso previsto para a política de sessão. Nenhuma das duas lacunas é contornável na camada de aplicação sem inventar armazenamento paralelo, o que contrariaria `docs/07` §5 e a disciplina de fonte única do modelo físico.

Daí a decisão de **reabrir pontualmente a persistência** — uma única vez, com escopo fechado e sob todas as guardas vigentes — antes de escrever qualquer linha de serviço de autenticação. A F0 existe precisamente para que essa reabertura seja um ato deliberado e auditável, e não um efeito colateral da implementação.

## 5. Decisões homologadas

### 5.1 `D-2.3D-01` — Persistência de sessão *(única decisão com efeito físico na F0)*

Aprovada a **reabertura pontual da persistência** para acrescentar a `sessao_autenticacao`:

```text
token_hash          TEXT        NOT NULL
ultima_atividade_em TIMESTAMPTZ NOT NULL
```

e a CHECK física obrigatória:

```text
ck_sessao_autenticacao_atividade
  CHECK (criada_em <= ultima_atividade_em AND ultima_atividade_em <= expira_em)
```

**Nome da constraint.** `ck_sessao_autenticacao_atividade` — conforme sugerido e **coincidente** com a convenção determinística `ck_<tabela>_<regra>` já vigente no repositório desde `E-09` (`docs/08` §10, ponto 5; C-6). Nenhum padrão divergente precisou ser preservado.

**Coexistência com a CHECK anterior.** `ck_sessao_autenticacao_expiracao` (`expira_em > criada_em`, `docs/07` §10.2) permanece **intacta**. As duas são complementares: a existente garante que a janela absoluta não seja degenerada; a nova garante que a atividade viva **dentro** dessa janela.

**Limites inclusivos.** `>=` e `<=`, não `>` e `<`. Uma sessão recém-criada tem legitimamente `ultima_atividade_em = criada_em`, e uma atividade no instante exato de `expira_em` ainda pertence à janela — o corte de expiração é decisão da aplicação (§5.4), e um limite estrito rejeitaria fisicamente uma escrita legítima de borda.

**Token de sessão.** Conceitualmente `<sessao_id>.<segredo>`. O `id` da sessão **não é segredo**. Somente o **verificador SHA-256 do segredo** é persistido em `token_hash`; o segredo em claro **nunca** é persistido — mesma disciplina já aplicada a `segredo_recuperacao_senha.hash_segredo` (`docs/07` §7.1; TLF-BASE-V1 §10).

**Ausência de DEFAULT — deliberada.** Nenhuma das duas colunas recebe DEFAULT. Não há valor neutro legítimo para um verificador de token, e um `DEFAULT now()` em `ultima_atividade_em` faria o backend **parecer** aplicar a política de §5.4 enquanto o banco a preenchesse sozinho. O instante é decidido pela aplicação — na criação e na renovação monotônica.

**Backfill.** Não é necessário: `sessao_autenticacao` estava **vazia** (0 linha medida no banco de desenvolvimento em 27/08/2026) e, no replay a partir de banco vazio (`E-15`, shadow database, CI), chega a esse ponto sem linhas por construção. Se em algum ambiente a tabela tiver linhas, o `ALTER` falhará de forma ruidosa e deliberada: popular sessões existentes exigiria **decisão própria**, nunca um default improvisado.

**O que NÃO foi criado:** coluna separada de expiração ociosa; coluna de IP; user-agent; refresh token; dispositivo; versão do token; qualquer outro campo.

### 5.2 `D-2.3D-02` — Hash de senha *(normativa; efeito na F1)*

- **Argon2id**, pacote `argon2@0.45.1`.
- Parâmetros iniciais: `memoryCost = 19456 KiB`; `timeCost = 2`; `parallelism = 1`.
- Formato **PHC**.
- **Rehash** quando os parâmetros persistidos estiverem defasados em relação aos vigentes.
- **Caminho dummy** para usuário inexistente — o custo de verificação não pode distinguir conta existente de inexistente (§5.12).
- **Benchmark empírico obrigatório na F1** antes de considerar os parâmetros operacionais encerrados.
- `scrypt` nativo permanece **apenas** como fallback, e somente se `argon2` for tecnicamente vetado **após medição**.

`argon2` **não é instalado na F0**.

### 5.3 `D-2.3D-03` — Normalização do login *(normativa)*

O identificador `usuario.email` é normalizado por **`trim` + `lowercase`**: na escrita, no login e em todo ponto de comparação futuro.

**Nenhuma alteração de schema de e-mail nesta etapa.** Não se introduz `citext`, índice funcional nem migration adicional. A unicidade continua sendo a `U-01` já homologada (`docs/07` §10.1); a normalização é responsabilidade da aplicação.

### 5.4 `D-2.3D-04` — Política de sessão *(normativa)*

| Parâmetro | Valor |
| --- | --- |
| Expiração absoluta | **8 horas** |
| Timeout ocioso | **15 minutos** |
| `expira_em` | prazo **absoluto**, fixado na criação — **não é sliding** |
| `ultima_atividade_em` | instante da última atividade válida da sessão |
| Enforcement | **sempre no backend** (TLF-BASE-V1 §4.7) |
| Throttle de atualização | no máximo **~1 write por sessão por minuto** |
| Atualização | **monotônica** |

A atualização de atividade **não pode** ser um last-writer-wins simples que admita regressão temporal. A regra deve preservar conceitualmente:

```text
ultima_atividade_em = GREATEST(ultima_atividade_em, instante_candidato)
```

ou mecanismo equivalente **atomicamente** monotônico.

**Nenhuma sessão sobrevive a `expira_em`, independentemente da atividade.** A expiração ociosa é *derivada* de `ultima_atividade_em` pelo backend; não existe coluna própria para ela (§5.1).

Nenhuma lógica de runtime foi implementada na F0.

### 5.5 `D-2.3D-05` — Estados terminais *(normativa)*

- Logout do próprio usuário → **`REVOGADA`**, com `revogada_por_usuario_id` = o próprio usuário.
- Expiração absoluta **ou** ociosa detectada → **`EXPIRADA`**.
- **Nenhum novo estado de sessão** é criado — o enum `EstadoSessaoAutenticacao` (`ATIVA`, `EXPIRADA`, `REVOGADA`) permanece exatamente como homologado em RN-004 / `docs/07` §11.1.

Compatível com AUT-002: `ATIVA -> EXPIRADA`, `ATIVA -> REVOGADA`; sessão terminal nunca volta a ativa.

### 5.6 `D-2.3D-06` — Anti-abuso *(normativa; efeito em F3/F6)*

**Login**

| Dimensão | Limite |
| --- | --- |
| Por identificador normalizado **e hasheado** | 5 falhas / 15 minutos |
| Por IP | 30 falhas / 15 minutos |

**Conclusão de recuperação de senha**

| Dimensão | Limite |
| --- | --- |
| Por IP | 10 tentativas / 15 minutos |

Regras vinculantes:

- mecanismo **interno ao monólito** do MVP (TLF-BASE-V1 §4.5/§4.6 — nenhuma infraestrutura nova);
- **sem lockout duro de conta** — o limite é temporal, não bloqueio permanente;
- resposta **`429` uniforme** com `Retry-After`;
- o rate limit ocorre **antes** da operação custosa de Argon2;
- a estrutura em memória deve possuir **expiração/poda** e **limite máximo de entradas**;
- o identificador entra no contador **hasheado**, nunca em claro;
- **restart zera os contadores** — limitação documentada e aceita do MVP.

Não implementado na F0.

### 5.7 `D-2.3D-07` — Cookie e CSRF *(normativa)*

**HTTPS (produção/homologação)**

```text
__Host-tlf_sessao
  HttpOnly · Secure · SameSite=Strict · Path=/ · sem Domain
```

**Desenvolvimento HTTP local** — nome **sempre distinto**:

```text
tlf_sessao_dev
```

com configuração explicitamente restrita a desenvolvimento. **Não se usa detecção de navegador.** Produção e homologação **não podem iniciar** com configuração insegura de cookie: a aplicação deve **falhar no bootstrap** se detectá-la.

**CSRF para a primeira API JSON** — baseline:

- **custom request header obrigatório** para mutações;
- **Fetch Metadata**;
- validação de **`Origin`** como fallback/defesa complementar;
- **`SameSite=Strict`**;
- somente **`application/json`** para os contratos mutáveis relevantes;
- **CORS desabilitado** enquanto a arquitetura for same-origin.

**Synchronizer token NÃO é registrado como obrigação futura.** Quando `apps/web` (Next.js) existir, a proteção CSRF será **reavaliada contra a arquitetura real**; synchronizer token só será adicionado mediante necessidade demonstrada.

Não implementado na F0.

### 5.8 `D-2.3D-08` — Recuperação de senha *(normativa)*

- Segredo com **256 bits** de entropia.
- Persistência **somente do hash** (`segredo_recuperacao_senha.hash_segredo` — já existente).
- Validade: **30 minutos**.
- **No máximo um segredo pendente por usuário**; ao emitir um novo, o anterior é invalidado/expirado.
- A conclusão **não cria automaticamente** nova sessão.
- A conclusão **revoga as sessões existentes**, conforme T-07 (`docs/07` §24.2) e RN-005.

Coerente com AUT-004 e D-04. Não implementado na F0; **nenhuma coluna nova** foi criada para esta decisão.

### 5.9 `D-2.3D-09` — RBAC inicial *(normativa)*

- Os **identificadores técnicos de permissão continuam sendo os nomes funcionais homologados em `docs/04` §5** (`usuarios.gerenciar`, `permissoes.gerenciar`, `sessoes.revogar_terceiro`, `senha.recuperar_terceiro`, `clinica.configurar`, `profissionais.gerenciar`, …). Preserva-se o precedente já adotado na Etapa 2.3C.
- O seed inicial futuro deverá refletir **exatamente** a matriz homologada de papéis/permissões de `docs/04`.
- Um usuário pode possuir **múltiplos papéis**; a união de permissões continua sujeita às restrições de domínio e de dados clínicos (TLF-BASE-V1 §6; AUT-003).

**Nenhum seed foi criado na F0.**

### 5.10 `D-2.3D-10` — Primeiro Administrador *(normativa)*

- Bootstrap **manual** e **idempotente**.
- Credencial recebida por **ambiente/stdin** ou mecanismo seguro equivalente.
- **Segredo nunca versionado** (TLF-BASE-V1 §14).
- A atribuição do papel Administrador é auditada com **`usuario.papeis.alterados`** — ação já pertencente ao catálogo homologado (`docs/09` §12.2).
- **Não se cria silenciosamente** uma ação `usuario.criado`. A eventual auditoria de criação de usuário exige **decisão própria futura**.

Não implementado na F0.

### 5.11 `D-2.3D-11` — OpenAPI *(normativa)*

- OpenAPI entra na **F3**, junto com os primeiros endpoints REST de autenticação.
- Baseline candidata: **`@nestjs/swagger@11.4.7`**.
- A compatibilidade real com **ESM/`nodenext`** (`D-ESM-01`, `docs/08` §16) deve ser **medida na F3** — não é assumida.
- **Decorators explícitos**; código e contrato OpenAPI permanecem sincronizados (TLF-BASE-V1 §4.8).
- Se o pacote falhar tecnicamente na baseline, o fallback é: documento OpenAPI **autoral e versionado** + **teste automático de contrato**.

`@nestjs/swagger` **não é instalado na F0**.

### 5.12 `D-2.3D-12` — Auditoria de autenticação *(normativa)*

Regra final homologada. **Toda** tentativa de autenticação que seja simultaneamente:

1. bem-formada;
2. admitida pelo rate limiter;
3. rejeitada pela autenticação;

gera exatamente:

```text
acao      = usuario.autenticacao
resultado = FALHA
```

com os campos:

| Situação | `ator_usuario_id` | `alvo_id` | `contexto` |
| --- | --- | --- | --- |
| Conta **existente** | `NULL` | `usuario.id` | `{}` |
| Conta **inexistente** | `NULL` | `NULL` | `{}` |

**Nunca registrar:** e-mail tentado; senha; token; cookie; segredo; ou qualquer derivação reversível desses valores (AUD-002/003/006; RN-062/063; TLF-BASE-V1 §10; `docs/07` §22.3).

**Não geram evento de autenticação:**

- payload HTTP malformado/rejeitado **antes** da autenticação;
- requisições bloqueadas previamente pelo rate limiter com `429`.

O objetivo é eliminar a **diferença estrutural de processamento** entre "senha incorreta de conta existente" e "identificador inexistente" — mitigação direta do risco de enumeração de contas registrado em AUT-001 e testado por `T-AUTH-ENUMERATION` (`docs/02` §764).

**Relação com `docs/09` §12 — sem reabertura.** `usuario.autenticacao` **já pertence** ao catálogo homologado `D-AUD-01`, e sua whitelist de `contexto` **já é vazia** por `D-AUD-07` (regra base fail-closed). Esta decisão **não amplia** `D-AUD-07`, **não acrescenta** ação ao catálogo e **não introduz** chave de `contexto`: `contexto = {}` é exatamente o que a whitelist vazia permite. `resultado = FALHA` pertence ao catálogo de `D-AUD-02`.

### 5.13 `D-2.3D-13` — Proteção de concorrência em voo do limitador de login *(normativa; efeito na F3)*

**Origem.** A primeira revisão independente da F3 mediu que o gate de `D-2.3D-06` era um *check-then-act*: 12 tentativas simultâneas contra o limite 5 produziam 12 execuções de Argon2 e zero bloqueios. A correção introduziu **reserva de tentativa em voo**. A segunda revisão independente classificou esse mecanismo como **decisão comportamental, e não detalhe de implementação**, e recusou-se a homologá-lo em nome de Bruno (TLF-BASE-V1 §15: nenhum agente escolhe silenciosamente a interpretação mais conveniente). Esta decisão resolve o ponto.

**O que fica homologado.** O limitador possui uma **proteção de concorrência em voo**, *separada* da política de falhas persistidas:

| Dimensão | Máximo SIMULTÂNEO |
| --- | --- |
| Por identificador normalizado e hasheado | **5** |
| Por IP normalizado | **30** |

Quando uma dimensão está sem vaga, e a causa é **exclusivamente** saturação concorrente transitória, a resposta é:

```text
HTTP 429
Retry-After: 1
```

**Regras vinculantes:**

- a requisição rejeitada nesse gate **não chegou à verificação da credencial** e, portanto, **não conta como falha de autenticação persistida**;
- ela **não altera a janela de falhas de `D-2.3D-06`**;
- ela **não pode produzir lockout persistente por si só**;
- a aquisição entre identificador e IP permanece **all-or-nothing**;
- toda reserva adquirida é **liberada exatamente uma vez**, inclusive em erro técnico;
- quando a mesma chave também tem falhas persistidas suficientes, prevalece o **cálculo real da janela** de `D-2.3D-06`, não o `Retry-After: 1`.

**Relação com `D-2.3D-06` — sem reabertura.** `D-2.3D-06` **não é alterada**. Seus limites (5 falhas/15 min por identificador; 30 falhas/15 min por IP), a janela deslizante, a ausência de lockout duro, o `429` uniforme com `Retry-After`, a ordem antes do Argon2, a poda, o teto de entradas e o identificador hasheado permanecem exatamente como homologados. `D-2.3D-13` **acrescenta** uma segunda proteção, de natureza distinta — concorrência, não acúmulo — que existe para que a primeira seja verdadeira sob carga simultânea.

**Risco residual — declarado e aceito.** Um atacante pode ocupar temporariamente as vagas simultâneas de um identificador e provocar `429` para um usuário legítimo. **Aceito nesta fase** como contrapartida da proteção dos recursos de Argon2 (19 MiB por operação; 45 simultâneos foram medidos como vetor de esgotamento de memória), **desde que não gere bloqueio persistente** — e não gera: as reservas se desfazem em milissegundos e nenhuma falha é contabilizada.

**Distinção em relação a `A-08`.** A alternativa rejeitada `A-08` era *lockout duro de conta após N falhas* — bloqueio **persistente** disparado por falhas. `D-2.3D-13` é o oposto: **transitório**, não contabilizado, e some sozinho. A rejeição de `A-08` permanece integralmente vigente.

**Alias histórico.** A implementação registrou este comportamento como decisão local **`L-11`** (`docs/10` §6-G.2). `L-11` permanece citável como referência histórica, mas a fonte normativa passa a ser `D-2.3D-13`.

### 5.14 `D-2.3D-14` — Semântica operacional do seed RBAC *(normativa; complementa `D-2.3D-09`; efeito na F5)*

**Origem.** A revisão independente da F5 encontrou uma ambiguidade entre a expressão “refletir exatamente” de `D-2.3D-09` e a necessidade de não revogar silenciosamente concessões posteriores, inclusive associações marcadas como `P` em `docs/04`. A implementação já adotava convergência aditiva e relatava excedentes; Bruno homologou expressamente essa alternativa em 31/08/2026.

**Regra vinculante.** A matriz canônica inicial de `docs/04` deve ficar **integralmente presente**: os quatro papéis, as 29 permissões, seus nomes canônicos e as 37 associações derivadas da matriz homologada. O seed cria o que faltar e corrige nomes canônicos, de forma idempotente.

**Tratamento dos excedentes.** Papéis, permissões e associações além da matriz canônica **não são removidos pelo seed**. Eles são preservados, contados e relatados sem ecoar identificadores de terceiros. Assim, “exatamente” em `D-2.3D-09` qualifica a composição da **matriz inicial que deve estar presente**, e não autoriza reconciliação destrutiva do estado posterior.

**Estados e saídas:**

- `jaConforme = true` somente quando nenhuma escrita foi necessária **e** não há divergências;
- no modo normal, a matriz canônica é aplicada, divergências são preservadas e relatadas, e a execução termina com saída 0;
- `seed --estrito` **também aplica e completa a matriz canônica**; se divergências persistirem, termina com saída 3;
- portanto, `--estrito` **não é modo somente leitura**. Sua garantia adicional é tornar divergências remanescentes bloqueantes para automação, nunca removê-las.

### 5.15 `D-2.3D-15` — Autoria do bootstrap inaugural *(normativa; complementa `D-2.3D-10`; efeito na F5)*

**Origem.** A revisão independente da F5 apontou que o bootstrap é iniciado manualmente, mas ocorre antes de existir um Administrador autenticado apto a figurar como ator persistido. Bruno decidiu expressamente a representação dessa autoria em 31/08/2026.

**Regra vinculante.** No bootstrap inaugural, o evento `usuario.papeis.alterados` usa **`ator_usuario_id = NULL`**. Não se cria identidade sintética e o usuário recém-criado ou promovido **não é registrado como ator da própria elevação**.

**Atribuibilidade operacional.** A execução exige justificativa operacional não vazia, fornecida por canal seguro, validada antes da transação e persistida em `evento_auditoria.justificativa`. A justificativa não é impressa, não integra `contexto` e não amplia a whitelist de `D-AUD-07`. A trilha conserva ainda ação, resultado, alvo, correlação e instante. A combinação de ator nulo com justificativa obrigatória é a representação homologada para esta operação inaugural e excepcional.

### 5.16 `D-2.3D-16` — Titularidade do início da recuperação de senha *(normativa; complementa `D-2.3D-08`; efeito na F6)*

**Origem.** `D-2.3D-08` fixa entropia, validade, unicidade do segredo pendente e os efeitos da conclusão, mas **não** diz quem pode iniciar. `docs/04` §4 nomeia a permissão como “Iniciar recuperação de senha **de terceiro**” (✓ somente Administrador) e §5.1 a define como “iniciar D-04 **para outro usuário**”; D-04, item 4, pressupõe que quem inicia **não** define a senha. A F6 implementou a leitura literal e a registrou como decisão local `L-F6-03`, apresentando-a para decisão expressa em vez de homologá-la sozinha (TLF-BASE-V1 §15). Bruno homologou o comportamento vigente em 05/09/2026.

**Regra vinculante.** O início da recuperação de senha é uma operação **sobre terceiro**. O titular da permissão `senha.recuperar_terceiro` **não pode** iniciar a recuperação da própria senha: o alvo do início deve ser um usuário **distinto** do ator autenticado.

**Ator e alvo.** O ator é a identidade da **sessão validada**, nunca um campo do corpo da requisição. O alvo é identificado pelo identificador de acesso normalizado por `D-2.3D-03`. O ator é persistido em `segredo_recuperacao_senha.criado_por_usuario_id` e é o ator do evento `usuario.senha.recuperacao_iniciada`.

**Resposta uniforme — condição da regra, não acessório.** A recusa do auto-início deve ser **indistinguível**, no envelope HTTP, da recusa por alvo inexistente e por alvo inativo: **mesmo status, mesmo código de erro, mesmo corpo e mesmo conjunto de cabeçalhos**, sem cookie. Uma recusa distinguível transformaria a rota num oráculo de existência e situação de contas para o Administrador autenticado, contra RN-006 e TLF-BASE-V1 §10.

**Limite declarado — esta decisão NÃO exige uniformidade temporal.** O alcance da regra é o envelope HTTP, que é o que a F6 implementa e prova. A implementação vigente **não** equaliza latência entre os três motivos: o `SELECT ... FOR UPDATE` do início adquire o lock da linha quando o alvo existe — e pode esperar por ele — enquanto um alvo inexistente retorna sem contenção. O canal temporal residual é **conhecido e aceito** nesta fase: a rota é autenticada e exige `senha.recuperar_terceiro`, de modo que o observador já é um Administrador; e nenhuma medição de tempo integra os critérios de aceite da F6. Equalização temporal, se vier a ser exigida, demanda decisão própria e prova própria — não é afirmada aqui.

**O que esta decisão NÃO faz.** Não cria autosserviço de recuperação (D-04 mantém o início com o Administrador); não altera `D-2.3D-08`; não define canal de entrega do segredo; não cria permissão nova nem altera a matriz de `docs/04`.

**Alias histórico.** A implementação registrou este comportamento como decisão local **`L-F6-03`** (`docs/10` §6-P.7). `L-F6-03` permanece citável como referência histórica, mas a fonte normativa passa a ser `D-2.3D-16`.

### 5.17 `D-2.3D-17` — Semântica de “tentativa” no limite de conclusão da recuperação *(normativa; complementa `D-2.3D-06`; efeito na F6)*

**Origem.** `D-2.3D-06` usa **duas palavras diferentes** nas suas duas metades: “5 **falhas** / 15 minutos” para o login e “10 **tentativas** / 15 minutos” para a conclusão da recuperação. A revisão da F6 apontou que a diferença admitia mais de uma leitura e que a escolha é comportamental. A implementação adotou a leitura literal — a mais restritiva — e a registrou como decisão local `L-F6-05`, apresentando-a para decisão expressa. Bruno homologou o comportamento vigente em 05/09/2026.

**Regra vinculante.** No limite de conclusão de recuperação de senha (por IP), a unidade contada é a **tentativa admitida**, e não a falha. Toda tentativa que atravessa o gate é contabilizada **no ato da admissão**, qualquer que seja o desfecho posterior — inclusive a conclusão **bem-sucedida**.

**Consequências vinculantes:**

- a contagem ocorre **antes** da validação de forma do segredo, da consulta ao banco e do Argon2, preservando a ordem já exigida por `D-2.3D-06`;
- dentro da janela de 15 minutos, a **10ª** tentativa do mesmo IP ainda é admitida e a **11ª** é bloqueada com `429` e `Retry-After`, **mesmo que o segredo apresentado seja válido**;
- como a admissão **é** a ocorrência, não existe estado “em voo” separado da contagem: a proteção de concorrência de `D-2.3D-13` **não se aplica** a esta dimensão e não deve ser replicada nela;
- uma requisição rejeitada pela **validação estrutural do payload**, antes de chegar ao gate, **não** consome a dimensão — ela não custa banco nem Argon2 e não é uma tentativa de conclusão.

**Finalidade declarada.** O segredo tem 256 bits (`D-2.3D-08`) e não é enumerável; este limite **não** existe contra adivinhação, mas contra **abuso de custo** — a operação sensível protegida é o Argon2 da nova senha. Contar tentativas admitidas, e não apenas falhas, limita esse custo de forma estritamente mais eficaz.

**Alcance restrito.** Esta decisão fixa a semântica **exclusivamente** da metade “conclusão de recuperação de senha” de `D-2.3D-06`. A metade do **login** permanece contando **falhas**, exatamente como homologada, e nenhuma outra dimensão ou limitador futuro herda esta leitura sem decisão própria.

**Risco residual — declarado e aceito.** Um IP compartilhado (NAT) pode esgotar as 10 tentativas com conclusões legítimas em 15 minutos e bloquear transitoriamente um usuário de boa-fé. **Aceito nesta fase**: o limite é temporal, não há lockout duro, e a janela libera sozinha — as mesmas garantias já vinculantes em `D-2.3D-06`.

**Alias histórico.** A implementação registrou este comportamento como decisão local **`L-F6-05`** (`docs/10` §6-P.7). `L-F6-05` permanece citável como referência histórica, mas a fonte normativa passa a ser `D-2.3D-17`.

### 5.18 `D-2.3D-18` — Autoria da revogação em massa da T-07 *(normativa; complementa `D-2.3D-05`; efeito na F6)*

**Origem.** `D-2.3D-05` fixa `revogada_por_usuario_id` = o próprio usuário **apenas para o logout**; nenhuma fonte fixava o valor na revogação em massa disparada pela conclusão da recuperação de senha (T-07). A F6 implementou o próprio usuário e registrou a escolha como decisão local `L-F6-06`. Duas tentativas de encerrá-la foram recusadas por revisão independente — a primeira por analogia com `D-2.3D-05` (PR #21), a segunda por apoiar-se em `docs/09` §5 (PR #22). A F7 apurou a governança de `docs/09` e a semântica real do campo; Bruno homologou o comportamento vigente em 05/09/2026.

**Precedência documental apurada (`Q-01`, resolvido).** `docs/09` declara em seu cabeçalho que **§§1..11 são a proposta original, "insumo decisório histórico, sem valor normativo próprio"**, e que **§12 é o registro normativo**, prevalecendo em caso de divergência; §12 repete que "para efeito normativo, vale exclusivamente esta seção". A tabela de §5 — que atribui ator **Administrador** a `usuario.sessao.revogacao` com a menção "em massa via T-07" — pertence a §§1..11 e, portanto, **não é fonte normativa**. `D-AUD-01` (§12.2) homologa **somente os 24 nomes de ações**, não as colunas de ator, descrição ou resultado. Não existe, assim, conflito normativo: **nenhuma fonte vinculante determina o ator da revogação da T-07**.

**Regra vinculante.** Na revogação em massa de sessões executada pela conclusão da recuperação de senha (T-07), `revogada_por_usuario_id` recebe o **`usuario_id` da própria sessão revogada** — o titular da conta cuja senha foi redefinida. O valor é derivado da própria linha (`SET revogada_por_usuario_id = usuario_id`), nunca de parâmetro, de modo que é impossível atribuí-lo a outro usuário.

**Fundamento — escolha por eliminação, declarada como tal.** Nenhuma fonte determina o valor; a decisão fixa a única alternativa compatível com o modelo vigente:

- **`NULL`** colide com o significado que a coluna já tem: `NULL` marca sessão **não revogada** (`ATIVA` ou `EXPIRADA` — a transição de expiração não toca a coluna). Adotá-lo destruiria a invariante vigente `estado = 'REVOGADA'` ⟺ coluna preenchida, e afirmaria ação de sistema, que o modelo **não representa** (não há usuário sintético nem flag).
- **O Administrador que iniciou a recuperação** é factualmente falso: ele iniciou a emissão do segredo; a revogação ocorre **somente se e quando** alguém concluir o fluxo, até 30 minutos depois, e pode nunca ocorrer. Sua única base era a tabela **não normativa** de `docs/09` §5.
- **Coluna ou enum novos** de origem da revogação: rejeitados — o contrato vigente representa o requisito, e a decisão não justifica migration nem drift de persistência.

Resta o próprio usuário, que é também o único ator **presente no ato** e coincide com o único precedente do campo (`D-2.3D-05`).

**Alcance restrito.** Esta decisão vale **exclusivamente** para a revogação em massa da T-07. Ela **não** determina o valor para a revogação administrativa de terceiro (`sessoes.revogar_terceiro`, `docs/04` §5.1/§8), ainda **não implementada**, nem generaliza para revogações futuras.

**Limite declarado.** A rota de conclusão não é autenticada: o sistema prova **posse do segredo**, não identidade de quem o apresenta. A atribuição ao titular é uma presunção — declarada aqui, e não escondida.

**Alias histórico.** A implementação registrou este comportamento como decisão local **`L-F6-06`** (`docs/10` §6-P.7). `L-F6-06` permanece citável como referência histórica, mas a fonte normativa passa a ser `D-2.3D-18`.

### 5.19 `D-2.3D-19` — Revogação administrativa de sessão de terceiro *(normativa; abre exceção delimitada ao desenho de autoria; **não** altera `D-2.3D-05` nem `D-2.3D-18`; efeito em fatia futura)*

**Origem.** `docs/02` AUT-002 lista a **revogação administrativa** entre os gatilhos de encerramento de sessão e determina que "revogação de terceiros exige permissão administrativa"; `docs/04` §5.1 define `sessoes.revogar_terceiro` como "revogar sessões de outro usuário", §4 a concede **somente ao Administrador** e §8 a classifica como operação sensível com **auditoria** obrigatória; `docs/05` FC-01 §Auditoria lista "revogação administrativa" entre os eventos a auditar. A operação nunca foi implementada: `D-2.3D-18` declarou expressamente que **não** determina o valor de `revogada_por_usuario_id` para ela, e a homologação técnica independente de 06/09/2026 confirmou mecanicamente que não existe rota, service, DTO nem emissor de auditoria — a permissão está catalogada e **órfã**. A lacuna era **normativa**, não técnica: o desenho vigente deriva a autoria da própria linha, de modo que a operação administrativa não era implementável sem decisão expressa. Bruno homologou esta decisão em 06/09/2026, **antes** de qualquer implementação, para que a fatia futura não precise tomar nenhuma decisão de produto.

**Natureza da operação — individual, e nada além disso.** `sessoes.revogar_terceiro` é operação administrativa de segurança sobre **uma sessão individual pertencente a outro usuário**, identificada por `sessao_id`. Ela **não é** logout (`D-2.3D-05`), **não é** a revogação em massa da T-07 (`D-2.3D-18`), **não é** expiração (`D-2.3D-04`), **não é** inativação de usuário e **não pertence** à AUT-005. Ela **não** revoga automaticamente as demais sessões do usuário-alvo: revogar todas exige tantas operações quantas forem as sessões, ou fatia própria com decisão própria.

**`sessao_id` é identificador, não credencial.** O token e o segredo da sessão-alvo **não são exigidos nem expostos** pela operação. Isso é o oposto do logout, e é deliberado: `docs/10` §6-E registra que `revogar` recebe o **token** justamente para que a posse prove a titularidade; aqui a titularidade é provada pela **permissão administrativa**, e exigir o token do terceiro seria impossível e inseguro. `A-02` (§6) permanece válida no seu contexto — o `sessao_id` continua não sendo credencial de autenticação; ele é apenas o endereço do alvo de uma operação que já está autorizada por RBAC.

**Ator — regra vinculante.** O ator da revogação é o usuário **Administrador/autorizado proveniente exclusivamente da sessão autenticada e validada pelo backend** que executa a operação. Consequências vinculantes, ambas obrigatórias e sobre o **mesmo** usuário:

```text
sessao_autenticacao.revogada_por_usuario_id = ator autenticado da operação administrativa
evento_auditoria.ator_usuario_id           = o mesmo ator autenticado
```

O ator **não pode** vir do corpo da requisição, de query string, de path parameter, de cabeçalho arbitrário, de DTO, de qualquer outro mecanismo fornecido pelo cliente, **nem ser inferido do proprietário da sessão-alvo**. Ele é derivado do contexto autenticado **já validado** — o mesmo contexto que `D-2.3D-16` exige para o início da recuperação de senha, e que a cadeia CSRF → sessão → permissão de `D-2.3D-07`/`D-2.3D-09` produz. Um campo de ator que exista no contrato e seja meramente **ignorado** pelo runtime **também viola** esta decisão: o contrato não deve possuí-lo.

**Exceção delimitada à derivação da autoria pela própria linha.** Esta decisão cria, e declara como tal, a **primeira e única** exceção ao desenho segundo o qual a autoria das revogações é derivada da própria linha (`SET revogada_por_usuario_id = usuario_id`, `docs/10` §6-E/§6-P). A exceção vale **exclusivamente** para `sessoes.revogar_terceiro`:

| Operação | Autoria persistida | Fonte normativa | Estado |
| --- | --- | --- | --- |
| Logout do próprio usuário | proprietário da própria sessão | **`D-2.3D-05`** — **INALTERADA** | vigente e implementada |
| Revogação em massa da T-07 | `usuario_id` da própria sessão revogada | **`D-2.3D-18`** — **INALTERADA** | vigente e implementada |
| **Revogação administrativa de terceiro** | **Administrador autenticado executor** | **`D-2.3D-19`** (esta) | **decidida; NÃO implementada** |

A exceção **não se generaliza**. Nenhuma forma futura de revogação herda esta leitura sem decisão própria — mesma disciplina de alcance restrito já adotada por `D-2.3D-17` e `D-2.3D-18`.

**Proibição de autorrevogação pela capacidade administrativa.** A permissão é `sessoes.revogar_terceiro`. Se `sessao.usuario_id == ator_autenticado.usuario_id`, a capacidade administrativa **não efetua** a revogação. O logout (`D-2.3D-05`) continua sendo o mecanismo para encerrar a própria sessão. A regra impede que uma permissão declaradamente "de terceiro" se transforme silenciosamente numa segunda semântica de logout, com autoria e trilha diferentes para o mesmo fato — é o mesmo princípio que `D-2.3D-16` já fixou para `senha.recuperar_terceiro`.

**Envelope uniforme — condição da regra, não acessório.** A operação é **idempotente** e **não pode funcionar como oráculo de sessões**. Para um `sessao_id` estruturalmente válido, o envelope HTTP deve ser **o mesmo** em todos estes casos:

1. sessão ativa de terceiro efetivamente revogada;
2. sessão inexistente;
3. sessão já `REVOGADA`;
4. sessão já `EXPIRADA`;
5. sessão pertencente ao próprio ator e, por isso, não elegível à operação administrativa.

Envelope adotado: **`204 No Content`, sem corpo**, sem cookie emitido ou alterado. A uniformidade é de **status, corpo e cabeçalhos funcionais relevantes**. Uma resposta distinguível transformaria a rota em oráculo de existência e situação de sessões e de contas, contra RN-006 e TLF-BASE-V1 §10.

**Limite declarado — esta decisão NÃO exige uniformidade temporal.** Mesmo alcance e mesmo racional de `D-2.3D-16`: a regra governa o envelope HTTP. A rota é autenticada e exige `sessoes.revogar_terceiro`, de modo que o observador já é um Administrador. Equalização de latência, se vier a ser exigida, demanda decisão própria e prova própria — **não é afirmada aqui**.

**O que NÃO é absorvido pelo `204`.** Um identificador **estruturalmente inválido** continua sujeito à validação HTTP normal e pode resultar em `400`, conforme o padrão vigente da API. Falhas de autenticação, de autorização, de CSRF, de conteúdo e de infraestrutura continuam seguindo os contratos gerais já existentes (`D-2.3D-07`, `D-2.3D-09`, `D-2.3D-11`) e **não** devem ser mascaradas como `204`. O `204` uniformiza os **cinco casos acima**, e apenas eles.

**Estado temporal — não se atribui ao Administrador uma revogação que não ocorreu.** A operação administrativa **não** transforma em `REVOGADA` uma sessão já efetivamente inválida pela política temporal de `D-2.3D-04`. Se, no instante da operação, a sessão já está vencida por expiração **absoluta** ou **ociosa**, ela preserva a semântica de **expiração**, pelos mecanismos vigentes de detecção e persistência. Somente uma sessão realmente `ATIVA` e ainda válida pela política temporal sofre `ATIVA -> REVOGADA` por esta operação. A trilha forense deve refletir o que de fato aconteceu; atribuir ao Administrador a autoria de uma revogação inexistente falsearia a auditoria — mesmo princípio que sustentou a rejeição do "Administrador iniciador" em `D-2.3D-18`.

**Atomicidade e concorrência.** A mudança de estado é **atômica**. A implementação deve convergir para **um único estado terminal coerente** sob concorrência com: outra revogação administrativa; logout do próprio usuário; validação/registro de atividade; e expiração. São **invariantes vinculantes**:

- **não pode existir** cenário em que a operação reporte `204` de revogação **efetiva** e a sessão permaneça utilizável;
- **não pode existir** ressurreição — `REVOGADA -> ATIVA` e `EXPIRADA -> ATIVA` são impossíveis, conforme AUT-002, RN-004 e `D-2.3D-05`;
- os estados e transições de `D-2.3D-05` permanecem **exatamente** como homologados; **nenhum estado novo é criado**.

O desenho concreto de *locking* e de SQL é **decisão de implementação**, desde que cumpra estas invariantes — mesmo tratamento que `R-2.3D-03` recebeu na F2, onde a propriedade foi exigida e a técnica ficou livre.

**Auditoria da revogação efetiva — obrigatória.** Ocorrida a transição administrativa efetiva `ATIVA -> REVOGADA`, registra-se **um** evento, com valores já homologados e **sem criar nada novo**:

| Campo | Valor | Fonte |
| --- | --- | --- |
| `acao` | `usuario.sessao.revogacao` | `D-AUD-01` — já no catálogo das 24 ações; **nenhuma ação é acrescentada** |
| `ator_usuario_id` | Administrador autenticado executor | esta decisão |
| `alvo_tipo` | `"sessao_autenticacao"` | `D-AUD-03` — nome físico da tabela do alvo |
| `alvo_id` | `id` da sessão efetivamente revogada | `D-AUD-03` |
| `resultado` | `SUCESSO` | `D-AUD-02` — valor já homologado; **nenhum enum novo** |
| `justificativa` | `NULL` | nenhuma fonte exige justificativa nesta operação |
| `correlacao_id` | novo por operação | `docs/07` §22.3 |
| `contexto` | **vazio** | `D-AUD-07` — a whitelist de `usuario.sessao.revogacao` é **VAZIA** e **permanece vazia** |

O alvo é a **sessão**, não o usuário: é a sessão que muda de estado, e `alvo_tipo` é o nome físico da sua tabela. **Nunca** podem ser gravados: token, hash de token, cookie, senha, segredo, payload HTTP, cabeçalhos sensíveis, identificadores de autenticação desnecessários ou qualquer dado que permita reconstruir o token — proibições absolutas de `D-AUD-07`/F-04 e de TLF-BASE-V1 §10, aqui apenas reafirmadas.

**Atomicidade entre a revogação e a sua trilha — diferente de `autorizacao.negada`.** `PBACK-AUD-09` (Q2) admitiu, para `autorizacao.negada`, que a falha de gravação preserve o `403`: ali **não há mutação**, e perder a trilha de uma negação não cria estado inconsistente. Aqui **há mutação de segurança efetiva**. Portanto:

> a transição `ATIVA -> REVOGADA` e o evento `usuario.sessao.revogacao` pertencem **à mesma transação de banco**.

Se o evento obrigatório não puder ser persistido, a revogação sofre **rollback**. **Não pode existir sessão revogada sem a sua trilha obrigatória.** A falha segue o contrato seguro de erro técnico vigente (`D-2.3D-12`; `docs/10` §6-F.9): **não** vira um falso `204`, **não** vira `401` nem `403`, e **não** vaza detalhe interno. **Nenhum retry implícito** é introduzido. Esta exigência não demanda infraestrutura nova: o `AuditWriter` já **recusa** cliente não transacional, precisamente para tornar impossível escrever a trilha fora da transação da mutação.

**No-op não produz auditoria falsa de sucesso.** Quando não houver transição efetiva para `REVOGADA` — sessão inexistente, já revogada, já expirada, ou autorrevogação recusada —, a resposta permanece uniforme (`204`), mas **nenhum evento `usuario.sessao.revogacao` de sucesso é emitido**. A auditoria representa **fatos ocorridos**; um evento de sucesso sem mutação corresponde ao mesmo defeito que `D-2.3D-18` recusou ao rejeitar autoria factualmente falsa. Esta decisão **não** cria ação de "tentativa de revogação": a uniformidade do envelope é para o cliente, não para a trilha.

**Esta decisão NÃO amplia `autorizacao.negada` nem `PBACK-AUD-09`.** A lista fechada de permissões cujas negações são auditadas continua contendo **um** item — `senha.recuperar_terceiro`. `D-2.3D-19` **não** acrescenta `sessoes.revogar_terceiro` a essa lista, **não** altera o `PermissoesGuard` por implicação e **não** modifica `PBACK-AUD-09`. `PBACK-AUD-09` (D-1) determina expressamente que ampliar a lista é **nova decisão normativa, nunca ajuste técnico**; interesse forense futuro na tentativa negada desta permissão será objeto de decisão própria. A operação **bem-sucedida** continua obrigatoriamente auditada por `usuario.sessao.revogacao`, que é obrigação independente e já homologada.

**Zero drift de persistência.** Esta decisão **não autoriza migration**. `sessao_autenticacao.revogada_por_usuario_id` já é FK anulável para `usuario`, **sem CHECK** (`docs/10` §6-Q.2), e comporta um Administrador sem qualquer alteração estrutural; `evento_auditoria` já possui todas as colunas necessárias. A implementação é esperada **sem** alteração de `schema.prisma`, migration, `schema.golden.sql`, `protected-objects.json` ou dependência. Se a inspeção técnica da fatia encontrar impossibilidade **concreta** que exija coluna, enum, FK, índice, CHECK ou migration, a implementação **para nesse ponto** e devolve análise estrutural para nova aprovação (TLF-BASE-V1 §14) — **não** improvisa.

**Contrato e OpenAPI.** Esta decisão fixa a operação **conceitualmente**; a sintaxe final da rota é materializada pela implementação, seguindo os padrões reais já vigentes em `apps/api` (`@Controller`/`@RequerPermissao`/`@HttpCode`), **sem inventar um novo estilo de API**. A especificação deve garantir: `sessao_id` é o **único** identificador do alvo necessário; **não existe** `ator_usuario_id` no request nem campo equivalente capaz de escolher o ator; autenticação obrigatória; `sessoes.revogar_terceiro` obrigatória; `204` uniforme documentado; erros estruturais e de segurança pelos contratos vigentes (`D-2.3D-11`).

**O que esta decisão NÃO faz.** Não cria permissão nova nem altera a matriz de `docs/04`. Não cria ação de auditoria, valor de `resultado` ou chave de `contexto`. Não altera `D-2.3D-05`, `D-2.3D-18` ou qualquer outra decisão homologada. Não materializa AUT-005 nem a inativação de usuário. Não implementa revogação em massa administrativa. Não altera logout, T-07, expiração, login, RBAC ou recuperação de senha. **E não implementa nada**: a AUT-002 permanece **NÃO IMPLEMENTADA** (§12), com a fatia rastreada como `P-2.3D-07` (§11) e os critérios de aceite em §10.4.

### 5.20 `D-2.3D-20` — Consulta da sessão autenticada atual por `GET /auth/sessao` *(normativa; homologada em 07/09/2026 por Bruno Menezes Noronha)*

**Origem.** Com a integração da topologia same-origin entre `apps/web` e `apps/api` via Route Handler proxy (`/api/[...caminho]`), surge a necessidade operacional legítima do frontend verificar o estado de autenticação corrente do usuário no carregamento inicial da aplicação ou em transições de rota, sem precisar inferir ou decodificar cookies `HttpOnly` no cliente. Bruno Menezes Noronha homologou em 07/09/2026 a decisão normativa `D-2.3D-20` que fixa o contrato e as garantias de segurança para esta consulta.

**Contrato mínimo vinculante:**
- **Método e caminho:** `GET /auth/sessao`.
- **Operação segura de leitura (Safe Method, RFC 7231 / RFC 9110):**
  - Como operação puramente de consulta segura, **não altera estado do servidor** nem produz efeitos colaterais.
  - **Não executa `ProtecaoCsrfGuard`:** métodos seguros (GET/HEAD) são imunes a mutações forçadas por CSRF; formulários e fetches de navegação não enviam cabeçalhos customizados. Exigir `X-TLF-Requisicao` ou `Content-Type: application/json` em GET violaria a semântica HTTP padrão e quebraria a navegação segura same-origin.
  - **Sem synchronizer token:** complexidade desnecessária e rejeitada para leituras seguras.
  - **Sem corpo (body) e sem parâmetros de query:** a requisição não aceita payload.
- **Autenticação e resolução de identidade:**
  - Exige sessão válida mediante `SessaoAutenticadaGuard`, consumindo exclusivamente o cookie `tlf_sessao` (desenvolvimento ou produção) enviado na requisição.
  - O guard anexa `ContextoAutenticado` (`usuarioId`, `sessaoId`) à requisição após validar o token e o timeout de ociosidade/expiração absoluta contra o banco.
  - **Zero consultas adicionais ao banco:** o handler consome a identidade já resolvida e validada pelo guard, evitando queries redundantes de usuário.
- **Respostas e cabeçalhos:**
  - **`200 OK`:**
    - Corpo estritamente tipado via `ConsultarSessaoRespostaDto`:
      ```json
      {
        "usuarioId": "uuid",
        "sessaoId": "uuid"
      }
      ```
    - Ambos os campos são strings em formato UUID v4.
    - **Nenhum dado adicional:** não expõe e-mail, nome, papéis, permissões, status de ativação ou segredos.
    - **Cabeçalho obrigatório:** `Cache-Control: no-store` (essencial para evitar cache intermediário ou local de estado de sessão autenticada).
    - **Sem cookie:** a consulta não renova nem emite `Set-Cookie`.
  - **`401 Unauthorized`:**
    - Emitido quando o cookie de sessão estiver ausente, malformado, inexistente, expirado (absoluto ou ocioso) ou revogado.
    - Corpo no envelope uniforme de erro da fronteira: `{"erro": "SESSAO_INVALIDA"}`. Normalizado pelo `FiltroErroAutenticacao`.
  - **`500 Internal Server Error`:**
    - Falha técnica inesperada devolve envelope uniforme `{"erro": "FALHA_INTERNA"}`.
- **Proibição expressa de evento de auditoria:**
  - É **expressamente proibido** emitir evento de auditoria para a consulta de sessão (como `usuario.sessao.consultada` ou qualquer outra denominação). A consulta é operação de alta frequência acionada em renderizações; emitir eventos saturaria o log de auditoria, violaria o princípio de relevância forense e introduziria ação não existente no catálogo fechado de `D-AUD-01` e `docs/09` §12.
- **Não-objetivos:**
  - Não implementa `AUT-005` (ativação e inativação de usuários) nem módulos administrativos de usuário.
  - Não relaxa o CORS (CORS permanece desligado no backend; Next.js atua como proxy same-origin).
  - Zero drift de persistência: nenhuma migration, nenhuma alteração em schema ou tabelas.

## 6. Alternativas rejeitadas

| # | Alternativa | Por que foi rejeitada |
| --- | --- | --- |
| A-01 | Persistir o token de sessão em claro | Contraria TLF-BASE-V1 §10 e a disciplina já aplicada ao segredo de recuperação. Vazamento do banco equivaleria a vazamento de todas as sessões |
| A-02 | Usar apenas `sessao_id` como token, sem segredo | O `id` é previsível o suficiente para ser tratado como identificador, não como credencial; e vaza por logs/URLs sem consequência esperada |
| A-03 | Tornar `expira_em` deslizante (*sliding*) em vez de acrescentar `ultima_atividade_em` | Aboliria o teto absoluto de 8 horas: uma sessão ativa nunca expiraria. Contraria AUT-002 e `D-2.3D-04` |
| A-04 | Coluna própria de expiração ociosa (`expira_ocioso_em`) | Estado derivável de `ultima_atividade_em` + política; duas fontes para o mesmo fato admitiriam divergência (mesmo racional de `docs/07` §19.2, coluna gerada) |
| A-05 | `DEFAULT now()` em `ultima_atividade_em` | Faria o banco aplicar silenciosamente uma regra cujo *ownership* é do backend, mascarando ausência de implementação (§5.1) |
| A-06 | CHECK com limites estritos (`>` / `<`) | Rejeitaria fisicamente a sessão recém-criada (`ultima_atividade_em = criada_em`), que é o caso legítimo mais comum |
| A-07 | `citext` ou índice funcional `lower(email)` para o login | Exigiria migration adicional fora do escopo autorizado; a normalização na aplicação (`D-2.3D-03`) resolve o caso sem tocar o schema |
| A-08 | Lockout duro de conta após N falhas | Converte o rate limit em vetor de negação de serviço contra usuários legítimos; rejeitado em `D-2.3D-06` |
| A-09 | Detecção de navegador para decidir atributos de cookie | Frágil e falsificável; substituída pela separação explícita por ambiente (`D-2.3D-07`) |
| A-10 | Synchronizer token CSRF como obrigação desde já | Complexidade antecipada (TLF-BASE-V1 §4.5) antes de existir o frontend real que a justificaria |
| A-11 | Criar ação de auditoria `usuario.criado` no bootstrap do Administrador | Ampliaria o catálogo de `D-AUD-01` sem decisão própria; `usuario.papeis.alterados` já cobre a atribuição do papel (`D-2.3D-10`) |
| A-12 | Registrar o e-mail tentado no `contexto` da falha de autenticação | Proibição absoluta de `D-AUD-07`/F-04 e da TLF-BASE-V1 §10 |
| A-13 | Fazer o seed remover papéis, permissões ou associações excedentes para impor igualdade física | Poderia revogar silenciosamente concessões posteriores legítimas; substituída pela convergência aditiva com relato e modo estrito bloqueante (`D-2.3D-14`) |
| A-14 | Registrar o usuário criado/promovido ou uma identidade sintética como ator do bootstrap inaugural | Falsearia a autoria da própria elevação ou inventaria uma identidade; substituída por ator nulo com justificativa operacional obrigatória (`D-2.3D-15`) |
| A-15 | Derivar também a autoria da revogação administrativa da própria linha (`revogada_por_usuario_id = usuario_id`), preservando a invariante vigente sem exceção | Registraria o **usuário-alvo** como autor da revogação sofrida — factualmente falso e forensicamente inútil: a trilha da operação administrativa não distinguiria um logout de uma revogação imposta por Administrador. `docs/04` §8 exige auditoria justamente para identificar **quem** revogou. Substituída pela exceção delimitada de `D-2.3D-19` |
| A-16 | Aceitar o ator da revogação administrativa por campo de request (corpo, query, path ou cabeçalho), ainda que o backend o ignorasse | Um campo de ator no contrato é convite a confiar nele — por regressão, por refactor ou por outro consumidor. A autoria é insumo forense de operação sensível (`docs/04` §8) e não pode ter origem controlável pelo cliente. `D-2.3D-19` proíbe o campo **no contrato**, não apenas o seu uso |
| A-17 | Responder com códigos distintos por situação da sessão-alvo (por exemplo `404` para inexistente, `409` para já revogada) na revogação administrativa | Transformaria a rota em **oráculo** de existência e situação de sessões e de contas, contra RN-006 e TLF-BASE-V1 §10 — mesmo defeito que `D-2.3D-16` já recusou no início da recuperação. Substituída pelo `204` uniforme de `D-2.3D-19` |
| A-18 | Tratar a auditoria da revogação administrativa como *best-effort*, preservando o `204` se a gravação do evento falhar — por analogia com a Q2 de `PBACK-AUD-09` | A analogia não se sustenta: `autorizacao.negada` audita um evento **sem mutação**, enquanto a revogação administrativa **muda estado de segurança**. Aceitar *best-effort* admitiria sessão revogada sem trilha obrigatória, contra `docs/04` §8 e TLF-BASE-V1 §10. Substituída pela atomicidade transacional de `D-2.3D-19` |
| A-19 | Aplicar `ProtecaoCsrfGuard` em `GET /auth/sessao` | GET é método seguro e idempotente (RFC 7231 / RFC 9110). Exigir cabeçalho customizado `X-TLF-Requisicao` ou `Content-Type: application/json` em requisição GET contraria os padrões HTTP e quebra navegação e carregamentos legítimos em same-origin |
| A-20 | Expor dados ampliados de usuário (e-mail, nome, permissões) em `GET /auth/sessao` | Viola o princípio do menor privilégio e mistura verificação de sessão com resolução de perfil/RBAC; dados de domínio e permissões devem ser consultados em endpoints dedicados quando autorizados |
| A-21 | Emitir evento de auditoria `usuario.sessao.consultada` a cada `GET /auth/sessao` | Poluiria massivamente a trilha de auditoria com tráfego ordinário de leitura de alta frequência, violaria o catálogo fechado de 24 ações de `D-AUD-01` e não agregaria valor forense |
| A-22 | Deslizar a expiração absoluta ou emitir novo cookie em `GET /auth/sessao` | Quebraria a invariante de expiração absoluta de 8 horas fixada na criação (`D-2.3D-04`); a atividade ociosa é atualizada de forma monotônica pelo `SessaoService` sob throttle, sem necessidade de reemissão de token |
| A-23 | Habilitar CORS no backend para permitir acesso cross-origin ao endpoint de sessão | Contraria a arquitetura de referência de segurança (proxy same-origin no frontend); habilitar CORS exporia credenciais a origens arbitrárias e aumentaria a superfície de ataque CSRF |
| A-24 | Exigir synchronizer token no `GET /auth/sessao` | Complexidade antecipada desnecessária para operações seguras de leitura (`D-2.3D-07`) |
| A-25 | Diferenciar respostas de erro entre "cookie ausente", "token malformado" e "sessão revogada" | Funcionaria como oráculo de validação e estado interno; a uniformidade do envelope `401 {"erro": "SESSAO_INVALIDA"}` garante consistência e anti-enumeração |
| A-26 | Consultar novamente a tabela `usuario` no controller para validar se o usuário ainda existe | O `SessaoAutenticadaGuard` já valida a sessão ativa e extrai o contexto validado (`usuarioId`, `sessaoId`). Uma nova consulta seria redundante, onerando o banco de dados desnecessariamente |

## 7. Impactos

### 7.1 Impacto físico (F0 — executado)

| Objeto | Mudança |
| --- | --- |
| `sessao_autenticacao.token_hash` | **coluna adicionada** — `text NOT NULL`, sem default |
| `sessao_autenticacao.ultima_atividade_em` | **coluna adicionada** — `timestamptz(6) NOT NULL`, sem default |
| `ck_sessao_autenticacao_atividade` | **CHECK adicionada** |
| Todo o restante do schema | **sem alteração** — medição em §10.3 |

### 7.2 Impacto documental

Este documento **não edita** `docs/02`..`docs/07`, seguindo o mesmo precedente de `docs/09` e `docs/11`. Consequências explícitas, registradas para que nada seja reinterpretado silenciosamente (TLF-BASE-V1 §15):

- `docs/07` §7.1 descreve `sessao_autenticacao` **sem** `token_hash` e `ultima_atividade_em`; `docs/07` §10.2 lista **uma** CHECK para a tabela. Ambas as seções passam a estar **incompletas**, não incorretas: nada do que elas afirmam foi revogado. **Para a composição vigente da tabela, este documento (§5.1) é a fonte normativa**, e o schema físico provado é a evidência (§10).
- A absorção editorial dessas duas colunas e da nova CHECK em `docs/07` é **ação de governança separada**, no mesmo padrão adotado para `P2.2-11` e `PROP-RN-2.3C-01` — registrada como pendência em §11 (`P-2.3D-01`).
- `docs/09` §12 permanece **integralmente vigente e não reaberto** (§5.12).
- `docs/08` permanece a baseline técnica; a política de migrations de §10 foi seguida integralmente (§10.1).

### 7.3 Impacto sobre as guardas

- `packages/database/protected-objects.json` — **fonte única** das três guardas — passa de 25 para **26** CHECK constraints. A nova entrada carrega sua migration de origem, como todas as demais.
- Guarda 1 (`lint-migrations`) passa a proteger `ck_sessao_autenticacao_atividade` contra `DROP CONSTRAINT` fora da migration de origem.
- Guarda 2 (`guard-anti-drift.spec.ts`) passa a exigir a existência das 26 e a provar o **efeito** da nova CHECK.
- Guarda 3 (golden schema) incorpora as três mudanças físicas e nada mais.

### 7.4 Impacto sobre as fatias seguintes

O `token_hash` **habilita** a F1/F2 (credencial e sessão) sem nova reabertura de persistência. Nenhuma das decisões §5.2..§5.15 exige alteração adicional de schema — verificado uma a uma: `D-2.3D-03` dispensa migration por construção; `D-2.3D-08` reutiliza `segredo_recuperacao_senha`; `D-2.3D-09` e `D-2.3D-14` usam `papel`/`permissao`/`papel_permissao`/`usuario_papel` já existentes; `D-2.3D-06` é memória de processo; `D-2.3D-12` e `D-2.3D-15` operam dentro de `evento_auditoria`.

O mesmo vale para as decisões acrescentadas depois: `D-2.3D-16`, `D-2.3D-17` e `D-2.3D-18` não exigiram alteração de schema, e **`D-2.3D-19` também não**. A revogação administrativa usa `sessao_autenticacao.revogada_por_usuario_id` — FK anulável para `usuario`, **sem CHECK**, que já comporta um Administrador — e `evento_auditoria` com as colunas e o catálogo já homologados (`usuario.sessao.revogacao`, `SUCESSO`, `alvo_tipo = "sessao_autenticacao"`, `contexto` vazio). **Nenhuma migration decorre de `D-2.3D-19`**; qualquer necessidade estrutural concreta descoberta na implementação interrompe a fatia e volta para aprovação (§5.19).

## 8. Riscos

| ID | Risco | Severidade | Tratamento |
| --- | --- | --- | --- |
| `R-2.3D-01` | Parâmetros de Argon2id inadequados ao hardware real (lentos demais → DoS; rápidos demais → fracos) | Média | Benchmark empírico **obrigatório** na F1 (`D-2.3D-02`); parâmetros só encerram como operacionais após medição |
| `R-2.3D-02` | Contadores de rate limit em memória zerados por restart | Baixa (MVP) | **Aceito e documentado** (`D-2.3D-06`). Reavaliar antes de produção com múltiplas instâncias |
| `R-2.3D-08` | Atacante ocupa as vagas simultâneas de um identificador e provoca `429` transitório para usuário legítimo | Baixa | **ACEITO E DECLARADO** em `D-2.3D-13` (§5.13) como contrapartida da proteção dos recursos de Argon2. Limitado por construção: as reservas se desfazem em milissegundos, nenhuma falha é contabilizada e **nenhum bloqueio persistente** decorre daí. Reavaliar quando existir o `apps/web` real e houver tráfego legítimo concorrente medido |
| ~~`R-2.3D-03`~~ | Atualização de `ultima_atividade_em` implementada como last-writer-wins, permitindo regressão temporal e estendendo sessão indevidamente | Média | **ENCERRADO em 27/08/2026** — a prova exigida foi produzida pela F2 e registrada em `docs/10` §6-E.5/§6-E.9/§9: `UPDATE` condicional atômico (predicado inteiro no `WHERE`), `GREATEST(ultima_atividade_em, instante_candidato)` medido como barreira real, predicado de throttle que exige avanço sobre o valor vigente e portanto também barra atividade regressiva, testes concorrentes contra PostgreSQL real com espera de lock confirmada, mutation challenge de last-writer-wins detectado (3/3 em reprodução independente) e confirmação de que a correção `C-01` de `revogar` não enfraqueceu a proteção. Limites da evidência, registrados como limites e **não** como risco aberto: prova sob `READ COMMITTED`, na arquitetura vigente de PostgreSQL autoritativo compartilhado — onde a propriedade é sustentada pela própria operação SQL atômica. **`D-2.3D-04` NÃO foi alterada**: a decisão permanece exatamente como homologada, agora com a prova que ela própria exigia |
| `R-2.3D-04` | Configuração insegura de cookie vazar para produção | Alta | `D-2.3D-07` exige **falha no bootstrap**; teste obrigatório na F3 |
| `R-2.3D-05` | Diferença de tempo entre conta existente e inexistente permitir enumeração | Média | Caminho dummy (`D-2.3D-02`) + simetria estrutural de auditoria (`D-2.3D-12`); `T-AUTH-ENUMERATION` na F3 |
| `R-2.3D-06` | `@nestjs/swagger` incompatível com ESM/`nodenext` | Média | Medição na F3 e fallback autoral já decidido (`D-2.3D-11`) |
| `R-2.3D-07` | `docs/07` §7.1/§10.2 divergirem do schema físico até a absorção editorial | Baixa | Divergência **declarada** em §7.2 e rastreada como `P-2.3D-01`; o golden schema e a Guarda 2 impedem que a divergência se torne silenciosa |

| `R-2.3D-09` | O `204` uniforme de `D-2.3D-19` impede o Administrador de distinguir "revoguei uma sessão ativa" de "o identificador não correspondia a nada" | Baixa | **ACEITO E DECLARADO** em `D-2.3D-19` (§5.19) como contrapartida direta da anti-enumeração — a mesma troca já aceita em `D-2.3D-16`. A informação não se perde: a trilha `usuario.sessao.revogacao` registra as revogações **efetivas**, e é por ela que a operação se confirma. Reavaliar apenas se existir superfície administrativa real que demonstre necessidade operacional; nunca por conveniência de depuração |
| `R-2.3D-10` | A atomicidade obrigatória entre a revogação e a sua trilha (`D-2.3D-19`) faz uma falha da escrita de auditoria impedir a revogação de uma sessão que se deseja encerrar | Baixa | **ACEITO E DECLARADO** em `D-2.3D-19` (§5.19), por escolha consciente entre dois males: sessão revogada **sem trilha** viola `docs/04` §8 e TLF-BASE-V1 §10 de forma silenciosa e permanente, enquanto a falha transacional é **visível, transitória e repetível** pelo Administrador. Nenhum retry implícito é introduzido. O `AuditWriter` já recusa cliente não transacional, o que torna a exigência exequível sem infraestrutura nova |

Riscos herdados e **não** alterados por este registro: `R2.2-04`, `R-BL-09`, `V-06.c` (`docs/10` §9).

## 9. Dependências entre as fatias F0..F7

| Fatia | Conteúdo | Depende de | Habilitada por |
| --- | --- | --- | --- |
| **F0** | Registro normativo + persistência de sessão | — | **CONCLUÍDA** |
| F1 | `CredencialService` / Argon2id | `D-2.3D-02`, `D-2.3D-03` | F0 |
| F2 | `SessaoService` — emissão, verificação, atividade monotônica, estados terminais | `D-2.3D-01`, `D-2.3D-04`, `D-2.3D-05` | **F0 (colunas + CHECK)**, F1 |
| **F3** | Endpoints REST de autenticação, cookies, CSRF, OpenAPI, rate limiting do login | `D-2.3D-06`, `D-2.3D-07`, `D-2.3D-11`, `D-2.3D-12`, `D-2.3D-13` | **CONCLUÍDA** (homologada em 28/08/2026 — `docs/10` §6-I) |
| **F4** | Guards e decorators de autorização (RBAC) | `D-2.3D-09` | **CONCLUÍDA** (homologada em 28/08/2026 — `docs/10` §6-L) |
| **F5** | Seed de papéis/permissões + bootstrap do primeiro Administrador | `D-2.3D-09`, `D-2.3D-10`, `D-2.3D-14`, `D-2.3D-15` | **CONCLUÍDA** (homologada e integrada na `main` em 02/09/2026 — `docs/10` §6-O.8; merge `657676b`, PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18)) |
| **F6** | Recuperação de senha (início e conclusão) + rate limiting próprio | `D-2.3D-06`, `D-2.3D-08`, `D-2.3D-16`, `D-2.3D-17` | **CONCLUÍDA** (integrada na `main` em 05/09/2026 — `docs/10` §6-P.18; merge `cbd02eb`, PR [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20)) |
| **F7** | Consolidação, revisão independente e rito de integração | todas | **CONCLUÍDA** (revisão independente executada e Etapa 2.3D encerrada em 05/09/2026 — `docs/10` §6-Q) |

`D-2.3D-01` é a **única** dependência de persistência de toda a etapa: nenhuma fatia posterior exige nova reabertura física.

**Fora da Etapa 2.3D — encerrada em 05/09/2026.** A **revogação administrativa de sessão de terceiro** (`D-2.3D-19`, §5.19) **não pertence a nenhuma das fatias F0..F7**: a decisão foi homologada em 06/09/2026, depois do encerramento da Etapa, e a sua implementação é **fatia própria, ainda não atribuída e sujeita a autorização própria** (`P-2.3D-07`, §11). Ela **depende** de `D-2.3D-04`, `D-2.3D-05`, `D-2.3D-07`, `D-2.3D-09`, `D-2.3D-11`, `D-2.3D-12` e `D-2.3D-19`, todas já vigentes e implementadas, exceto a última — e **não** depende de AUT-005, que permanece NÃO MATERIALIZADA e é escopo distinto. **Nenhuma fatia F0..F7 foi reaberta por esta decisão.**

## 10. Critérios de aceite

### 10.1 Da F0 — todos verificados

| # | Critério | Estado |
| --- | --- | --- |
| 1 | Base Imutável lida integralmente | ✅ |
| 2 | Estado Git inicial medido e registrado | ✅ `main` = `53f9fc5` |
| 3 | Branch própria (`agent/fase2-etapa2.3d-f0-auth-persistencia`) | ✅ |
| 4 | `D-2.3D-01`..`D-2.3D-12` registradas | ✅ (§5) |
| 5 | Somente a alteração estrutural aprovada implementada | ✅ (§10.3) |
| 6 | **Uma única** migration aditiva | ✅ `20260827175151_sessao_autenticacao_token_atividade` |
| 7 | Prisma coerente (`validate`, `migrate status`, `migrate diff`) | ✅ |
| 8 | Golden atualizado pelo **fluxo oficial** (`npm run schema:golden:update`) | ✅ |
| 9 | Protected objects / anti-drift atualizados | ✅ 25 → 26 CHECKs |
| 10 | CHECK temporal provada — aceites e rejeições | ✅ (§10.2) |
| 11 | NOT NULL das duas colunas provado | ✅ 23502 em ambas |
| 12 | Replay *from scratch* verde | ✅ `verify:from-scratch` |
| 13 | Diff físico contém **exclusivamente** os objetos autorizados | ✅ (§10.3) |
| 14 | Guardas 1–3 verdes | ✅ |
| 15 | Documentação e schema sincronizados | ✅ (§7.2) |
| 16 | Nenhuma dependência nova instalada | ✅ |
| 17 | Nenhuma implementação de F1+ iniciada | ✅ (§2) |

### 10.2 Evidência da CHECK `ck_sessao_autenticacao_atividade`

Base comum: `criada_em = 10:00`, `expira_em = 18:00` (2026-08-25, UTC).

| Caso | `ultima_atividade_em` | Resultado | Onde é provado |
| --- | --- | --- | --- |
| Borda inferior — sessão recém-criada | `10:00` | **ACEITO** | `session-invariants.spec.ts` T-SESS-01 |
| Meio da janela | `12:00` | **ACEITO** | `session-invariants.spec.ts` T-SESS-01 |
| Borda superior | `18:00` | **ACEITO** | `session-invariants.spec.ts` T-SESS-01 |
| Anterior à criação | `09:00` | **REJEITADO** — 23514, `ck_sessao_autenticacao_atividade` | `guard-anti-drift.spec.ts` |
| Posterior à expiração | `19:00` | **REJEITADO** — 23514, `ck_sessao_autenticacao_atividade` | `guard-anti-drift.spec.ts` |

`token_hash = NULL` e `ultima_atividade_em = NULL` são rejeitados fisicamente com **23502** (`session-invariants.spec.ts` T-SESS-02). A ausência de DEFAULT nas duas colunas é provada contra o catálogo em T-SESS-03.

### 10.3 Medição do drift físico — golden `53f9fc5` × golden desta fatia

```text
Tabelas ............ 37 → 37   (nenhuma criada, nenhuma removida)
Tabela alterada .... sessao_autenticacao (1 de 37)
  + coluna ......... token_hash text NOT NULL
  + coluna ......... ultima_atividade_em timestamp(6) with time zone NOT NULL
  + CHECK .......... ck_sessao_autenticacao_atividade
Enums .............. 8 → 8     (sem alteração)
Índices ............ 35 → 35   (sem alteração)
Constraints ........ 109 → 109 (sem alteração)
Triggers ........... 2 → 2     (sem alteração)
Funções ............ 2 → 2     (sem alteração)
GRANT/REVOKE ....... sem alteração
```

`GRANT`/`REVOKE` não constam do golden por decisão de `docs/08` §9.3 (`pg_dump --no-privileges`); sua preservação é provada pela Guarda 2 (matriz de privilégios + rejeição 42501), verde nesta fatia.

### 10.4 Critérios de aceite normativos da futura implementação da AUT-002 (`D-2.3D-19`)

Esta matriz é **parte da decisão**. A rodada de implementação da revogação administrativa de sessão de terceiro deve **provar** cada item contra PostgreSQL real, com testes que falhem quando a propriedade for removida. Enquanto ela não for executada, **todos os itens estão PENDENTES** — nenhum é dado por satisfeito por analogia com logout, com a T-07 ou com qualquer fatia anterior.

| ID | Critério de aceite | Origem em §5.19 | Estado |
| --- | --- | --- | --- |
| `A-01` | Administrador com `sessoes.revogar_terceiro` revoga uma sessão **ativa** de outro usuário | natureza da operação | **CONCLUÍDO** |
| `A-02` | `sessao_autenticacao.revogada_por_usuario_id` recebe o **Administrador autenticado** executor | ator | **CONCLUÍDO** |
| `A-03` | `evento_auditoria.ator_usuario_id` recebe **exatamente o mesmo** Administrador de `A-02` | ator | **CONCLUÍDO** |
| `A-04` | **Não existe** campo HTTP — corpo, query, path, cabeçalho ou DTO — capaz de substituir ou injetar o ator; o contrato **não possui** campo equivalente, ainda que fosse ignorado | ator | **CONCLUÍDO** |
| `A-05` | Usuário autenticado **sem** `sessoes.revogar_terceiro` **não** executa a operação | RBAC (`D-2.3D-09`) | **CONCLUÍDO** |
| `A-06` | Autorrevogação pela capacidade administrativa **não altera** a sessão | proibição de autorrevogação | **CONCLUÍDO** |
| `A-07` | Sessão **inexistente** produz **o mesmo envelope** da operação efetiva | envelope uniforme | **CONCLUÍDO** |
| `A-08` | Sessão **já revogada** produz o mesmo envelope | envelope uniforme | **CONCLUÍDO** |
| `A-09` | Sessão **já expirada** produz o mesmo envelope | envelope uniforme | **CONCLUÍDO** |
| `A-10` | Sessão efetivamente vencida pela política temporal (`D-2.3D-04`) **não** é reclassificada como `REVOGADA` pelo Administrador; preserva a semântica de **expiração** | estado temporal | **CONCLUÍDO** |
| `A-11` | Revogação efetiva e evento de auditoria são **atômicos** — mesma transação | atomicidade | **CONCLUÍDO** |
| `A-12` | Falha da escrita de auditoria **impede** a revogação efetiva (rollback), sem falso `204`, sem `401`/`403` e sem vazamento interno | atomicidade | **CONCLUÍDO** |
| `A-13` | Token, hash de token, cookie, senha, segredo, payload e cabeçalhos sensíveis **nunca** entram na auditoria; `contexto` permanece **vazio** | auditoria | **CONCLUÍDO** |
| `A-14` | Após revogação efetiva, o token antigo **não autoriza** nenhuma operação | AUT-002; `D-2.3D-05` | **CONCLUÍDO** |
| `A-15` | Duas revogações administrativas **concorrentes** sobre a mesma sessão convergem para estado terminal único e coerente, com autoria coerente e **sem** evento duplicado de sucesso | concorrência; no-op | **CONCLUÍDO** |
| `A-16` | Revogação administrativa **×** logout do próprio usuário converge corretamente, com autoria compatível com a operação que efetivamente venceu | concorrência | **CONCLUÍDO** |
| `A-17` | Revogação administrativa **×** validação/registro de atividade converge corretamente; **não existe janela** em que o `204` seja reportado e a sessão siga utilizável | concorrência | **CONCLUÍDO** |
| `A-18` | Revogação administrativa **×** expiração converge corretamente, sem estado contraditório e sem ressurreição | concorrência; estado temporal | **CONCLUÍDO** |
| `A-19` | **Logout mantém `D-2.3D-05`** — `revogada_por_usuario_id` continua sendo o proprietário da própria sessão, sem regressão | exceção delimitada | **CONCLUÍDO** |
| `A-20` | **T-07 mantém `D-2.3D-18`** — a revogação em massa continua derivando a autoria da própria linha, sem regressão | exceção delimitada | **CONCLUÍDO** |
| `A-21` | **Nenhum artefato de AUT-005** é introduzido — sem ativação/inativação de usuário, sem módulo `usuario-administrativo`, sem enum, erro ou contrato exclusivos de AUT-005 | escopo | **CONCLUÍDO** |
| `A-22` | **Nenhum drift de persistência** — `schema.prisma`, migrations, `schema.golden.sql`, `protected-objects.json` e lockfiles inalterados | zero drift | **CONCLUÍDO** |

**Provas de poder exigidas.** Não basta que a bateria passe: a fatia deve demonstrar que os testes **detectam** a violação. São obrigatórios, no mínimo, quatro *mutation challenges* — origem do ator (`A-02`/`A-03`), checagem de permissão (`A-05`), inutilização efetiva da sessão (`A-14`) e auditoria de sucesso (`A-03`/`A-13`) —, cada um detectado pela suíte e integralmente revertido com prova por diff/hash. É o mesmo padrão já aplicado na F2, na F5 e em `L-07`.

### 10.5 Critérios de aceite normativos de `P-2.3D-08` / `D-2.3D-20` (consulta da sessão e prova E2E real)

Esta matriz governa a implementação do endpoint `GET /auth/sessao` e da prova ponta a ponta real same-origin com Next.js e NestJS:

| ID | Critério de aceite | Origem em §5.20 | Estado |
| --- | --- | --- | --- |
| `A-01` | `GET /auth/sessao` com cookie `tlf_sessao` válido responde `200 OK` com `{ usuarioId, sessaoId }` | contrato mínimo | **CONCLUÍDO** |
| `A-02` | `GET /auth/sessao` sem cookie responde `401 {"erro": "SESSAO_INVALIDA"}` | autenticação | **CONCLUÍDO** |
| `A-03` | `GET /auth/sessao` com cookie malformado ou assinatura corrompida responde `401 {"erro": "SESSAO_INVALIDA"}` | autenticação | **CONCLUÍDO** |
| `A-04` | `GET /auth/sessao` com sessão revogada (após logout ou revogação administrativa) responde `401 {"erro": "SESSAO_INVALIDA"}` | estados terminais | **CONCLUÍDO** |
| `A-05` | `GET /auth/sessao` com sessão expirada (absoluta ou ociosa) responde `401 {"erro": "SESSAO_INVALIDA"}` | estados terminais | **CONCLUÍDO** |
| `A-06` | Resposta de `200 OK` inclui cabeçalho obrigatório `Cache-Control: no-store` | segurança HTTP | **CONCLUÍDO** |
| `A-07` | Operação segura: `ProtecaoCsrfGuard` NÃO roda em `GET /auth/sessao`; não exige `X-TLF-Requisicao` nem `Content-Type` | safe method | **CONCLUÍDO** |
| `A-08` | `GET /auth/sessao` NÃO emite cabeçalho `Set-Cookie` (consulta idempotente sem alteração de token) | leitura pura | **CONCLUÍDO** |
| `A-09` | Proibição estrita de auditoria: nenhum evento `usuario.sessao.consultada` ou similar é emitido | auditoria | **CONCLUÍDO** |
| `A-10` | DTO `ConsultarSessaoRespostaDto` expõe exclusivamente `usuarioId` e `sessaoId` (UUID); sem dados de perfil ou segredos | menor privilégio | **CONCLUÍDO** |
| `A-11` | Erros normalizados pelo `FiltroErroAutenticacao` para o contrato fechado da fronteira | envelope estável | **CONCLUÍDO** |
| `A-12` | Zero queries extras ao banco no controller (consome `ContextoAutenticado` injetado pelo guard) | performance/design | **CONCLUÍDO** |
| `A-13` | Prova E2E real (`apps/web/scripts/verify-web-api-e2e.mjs`) provisiona PostgreSQL 18 descartável com `migrateDeploy` | infra descartável | **CONCLUÍDO** |
| `A-14` | Prova E2E executa processo real compilado do NestJS (`node apps/api/dist/main.js`) em porta dinâmica | runtime real | **CONCLUÍDO** |
| `A-15` | Prova E2E executa processo real do Next.js (`next start`) com proxy Route Handler (`/api/[...caminho]`) | runtime real | **CONCLUÍDO** |
| `A-16` | Prova E2E testa login positivo same-origin com captura de cookie e consulta positiva de sessão via proxy | fluxo integrado | **CONCLUÍDO** |
| `A-17` | Prova E2E testa cenários negativos via proxy (cookie ausente, malformado e sessão revogada) | fluxo integrado | **CONCLUÍDO** |
| `A-18` | Prova E2E valida a proteção CSRF do backend no proxy: sem `X-TLF-Requisicao` -> 403; Origin hostil -> 403 | CSRF real | **CONCLUÍDO** |
| `A-19` | Limpeza determinística em `finally`: encerra processos filhos e destrói container/volume descartáveis | higiene | **CONCLUÍDO** |
| `A-20` | Script `verify:web-api-e2e` integrado no `package.json` da raiz e na pipeline de CI (`.github/workflows/ci.yml`) | automação CI | **CONCLUÍDO** |
| `A-21` | Quatro mutation challenges obrigatórios (M1..M4) executados, detectados e revertidos com prova | poder de teste | **CONCLUÍDO** |
| `A-22` | Zero drift de persistência (0 migrations, schemas intocados) e zero dependências de produção novas | governança | **CONCLUÍDO** |

## 11. Pendências mantidas abertas

| ID | Pendência | Estado |
| --- | --- | --- |
| `P-2.3D-01` | Absorção editorial de `token_hash`, `ultima_atividade_em` e `ck_sessao_autenticacao_atividade` em `docs/07` §7.1/§10.2 | **ABERTA** — ação de governança separada (§7.2) |
| ~~`P-2.3D-02`~~ | Benchmark empírico dos parâmetros de Argon2id | **ENCERRADA em 27/08/2026** — benchmark executado na F1 e registrado em `docs/10` §6-D.5: `hash` p50 39,16 ms · `verify` válido p50 38,70 ms · `verify` inválido p50 39,67 ms · ~19 MiB por operação (Node 24, win32-x64, i5-1235U, 30 amostras, warm-up 5). Sem ressalva material. **`D-2.3D-02` NÃO foi alterada**: os parâmetros homologados `m=19456`/`t=2`/`p=1` permanecem exatamente como decididos, agora com a medição que a própria decisão exigia. Limitação declarada: medição em máquina de desenvolvimento — remedir em hardware de produção antes do go-live é prudência operacional, não condição pendente |
| ~~`P-2.3D-03`~~ | Medição de compatibilidade ESM/`nodenext` de `@nestjs/swagger@11.4.7` | **ENCERRADA em 05/09/2026** — medida e verde desde a F3 (`docs/10` §6-F.7), com encerramento formal reservado a decisão expressa; a F7 a encerra. A prova é permanente e executa a cada CI: `verify:openapi-runtime` constrói o documento a partir do `AppModule` **compilado**, fora do Jest, e verifica **19/19** itens. **`D-2.3D-11` NÃO é alterada** |
| ~~`P-2.3D-04`~~ | Reavaliação da proteção CSRF contra a arquitetura real do `apps/web` | **ENCERRADA em 15/09/2026** — Encerrada em 15/09/2026 após a integração do PR #47 (merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`) que versionou `apps/web/scripts/verify-web-api-e2e.mjs` e o passo correspondente na CI, executando simultaneamente PostgreSQL real em container, NestJS real compilado, Next.js real compilado com Route Handler de proxy same-origin (`/api/*`), `ProtecaoCsrfGuard` real e cookie real de sessão, provando que a baseline de CSRF de `D-2.3D-07` (`SameSite=Strict`, cabeçalho obrigatório `X-TLF-Requisicao` nas mutações, Fetch Metadata, validação de `Origin`, ausência de CORS) protege a fronteira de ponta a ponta sem necessidade de synchronizer token adicional |
| `P-2.3D-05` | Eventual auditoria de criação de usuário (`usuario.criado`) | **ABERTA** — exige decisão própria (`D-2.3D-10`) |
| `P-2.3D-06` | Contadores de rate limit resilientes a restart / múltiplas instâncias | **ADIADA** — limitação aceita do MVP (`D-2.3D-06`) |
| ~~`P-2.3D-07`~~ | **Implementação da revogação administrativa de sessão de terceiro (AUT-002 / `sessoes.revogar_terceiro`), conforme `D-2.3D-19`** | **CONCLUÍDA / INTEGRADA NA main em 14/09/2026 (PR [#46](https://github.com/BrunoMNoronha/techlab-fisio/pull/46))** — Commit da fatia `540302e5a95ae733ad07647af8318891b4ec9ee4`, merge commit `b6427e1ab999aae40f41e7745fe374f32b719836`, CI verde na run `34884210876`. Rota `DELETE /auth/sessoes/:sessaoId` integrada com RBAC, envelope uniforme 204, atomicidade da auditoria (`usuario.sessao.revogacao`), 4 mutation challenges provados e zero drift |
| ~~`P-2.3D-08`~~ | **Materializar D-2.3D-20 (`GET /auth/sessao`) e construir prova E2E real same-origin** | **CONCLUÍDA / INTEGRADA NA main em 15/09/2026 (PR [#47](https://github.com/BrunoMNoronha/techlab-fisio/pull/47))** — Commit da fatia `4f78c4ed2de5b2e9f358f55accfa021b027fc124`, merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`, CI verde na run `34983136046`. Endpoint `GET /auth/sessao` entregue sob `SessaoAutenticadaGuard`, `Cache-Control: no-store`, envelope estrito `ConsultarSessaoRespostaDto` `{ usuarioId, sessaoId }`, sem CSRF guard, sem emissão de auditoria. Prova E2E real automatizada `verify-web-api-e2e.mjs` com PostgreSQL 18 descartável, NestJS compilado, Next.js com proxy Route Handler, `ProtecaoCsrfGuard` real e cookies reais integrada à CI e ao `package.json` raiz (`verify:web-api-e2e`). Critérios `A-01`..`A-22` atendidos, 4 mutation challenges provados e zero drift |

| ~~`Q-01`~~ | Suposto conflito entre `docs/09` §5 e `docs/06` §12.7 sobre a auditoria e a autoria da revogação em massa da T-07 | **RESOLVIDO em 05/09/2026 — não havia conflito normativo.** `docs/09` declara §§1..11 "insumo decisório histórico, **sem valor normativo próprio**", com §12 prevalecendo; `D-AUD-01` (§12.2) homologa **apenas os 24 nomes de ações**, não as colunas de ator ou descrição. A linha invocada pertence a §5 e não vincula. **`docs/09` NÃO foi alterado** — o próprio documento manda preservar §§1..11 intactos, e sua regra de precedência já resolve a leitura. Decidiu `L-F6-06` (→ `D-2.3D-18`) |
| `Q-02` | Auditoria de **tentativas recusadas** de recuperação de senha (segredo inválido, expirado, consumido) | **ABERTA — NÃO BLOQUEANTE.** `docs/05` FC-01 lista "falhas relevantes" ao lado de "login bem-sucedido", e a leitura de que isso alcança a recuperação **não é inequívoca**; o catálogo de `D-AUD-01` não possui ação para tentativa de recuperação falha, e uma recusa por segredo inválido **não localiza usuário**, de modo que não haveria `ator_usuario_id` nem `alvo_id` sem violar `D-AUD-03`. Por isso `L-F6-07` **não** foi promovida a normativa: permanece decisão local, com o comportamento vigente (auditoria só do sucesso) preservado. Exige decisão própria se vier a ser reaberta |

Pendências herdadas e **não** alteradas por este registro: `P-BACK-01`, `R2.2-04`, `L-05`..`L-08`, `P2.2-05`, `configuracao.alterada`, `prontuario.exportado`, `autor_original_usuario_id`, `R-BL-09`, `V-06.c` (`docs/10` §9).

## 12. Relação com AUT-001..AUT-006

| Requisito | Decisões que o materializam | Observação |
| --- | --- | --- |
| **AUT-001** — Autenticar usuário ativo | `D-2.3D-02` (verificação de credencial + caminho dummy), `D-2.3D-03` (localização por identificador normalizado), `D-2.3D-01`/`D-2.3D-04` (criação da sessão), `D-2.3D-12` (evento de autenticação), **`D-2.3D-20` (consulta da sessão autenticada ativa)** | A invariante "erros não devem facilitar enumeração" é atendida por `D-2.3D-02` + `D-2.3D-12` em conjunto. `D-2.3D-20` permite validação imediata da sessão ativa pelo frontend |
| **AUT-002** — Encerrar, expirar e revogar sessões | `D-2.3D-01` (janela física), `D-2.3D-04` (expiração absoluta e ociosa), `D-2.3D-05` (estados terminais), `D-2.3D-18` (autoria da revogação em massa da T-07), **`D-2.3D-19` (revogação administrativa de terceiro — INTEGRADA na main em 14/09/2026, PR #46)**, **`D-2.3D-20` (consulta de sessão)** | **PARCIAL.** Estados e transições preservados **sem alteração**: `ATIVA -> EXPIRADA`, `ATIVA -> REVOGADA`. **Implementados:** logout, expiração, revogação em massa da T-07, revogação administrativa de terceiro (`D-2.3D-19` / `P-2.3D-07`, PR #46) e consulta da sessão atual (`D-2.3D-20` / `P-2.3D-08`). **NÃO implementada e sem decisão nesta revisão:** inativação de usuário (AUT-005) |
| **AUT-003** — Autorizar por papel, permissão, escopo e recurso | `D-2.3D-09` | Enforcement no backend (F4). `P2.2-05` (escopo clínico) permanece fora desta etapa |
| **AUT-004** — Recuperar senha com mecanismo seguro | `D-2.3D-08`, `D-2.3D-06` (limite de conclusão), `D-2.3D-16` (início é sobre terceiro), `D-2.3D-17` (semântica de “tentativa”) | Preserva D-04 e T-07: conclusão revoga sessões anteriores. **MATERIALIZADA** pela F6 (integrada em 05/09/2026) |
| **AUT-005** — Ativar e inativar usuários | `D-2.3D-05` (revogação), `D-2.3D-10` (papel do Administrador) | A revogação por inativação usa os mesmos estados terminais |
| **AUT-006** — Auditar ações sensíveis | `D-2.3D-12` | Sem senha, token ou cookie; dentro do catálogo de `docs/09` §12 |

Nenhum requisito AUT foi ampliado, reduzido ou reinterpretado por este registro.

## 13. Relação com a auditoria (`D-AUD-01`..`D-AUD-08`)

| Item | Situação após este registro |
| --- | --- |
| `D-AUD-01` — catálogo de 24 ações | **INALTERADO.** `usuario.autenticacao`, `usuario.sessao.logout`, `usuario.sessao.revogacao`, `usuario.senha.recuperacao_iniciada`, `usuario.senha.recuperacao_concluida` e `usuario.papeis.alterados` já pertencem ao catálogo. **Nenhuma ação acrescentada** — `D-2.3D-20` **proíbe terminantemente** evento de auditoria para consulta de sessão (`usuario.sessao.consultada` inexistente e vedada) |
| `D-AUD-02` — `SUCESSO`/`NEGADO`/`FALHA` | **INALTERADO.** `D-2.3D-12` usa `FALHA` e `D-2.3D-19` usa `SUCESSO` — ambos valores já homologados. **Nenhum valor novo; nenhum enum SQL** |
| `D-AUD-03` — `alvo_tipo` = nome físico da tabela | **INALTERADO.** O alvo da falha de autenticação, quando existe, é `usuario`; o alvo da revogação administrativa de `D-2.3D-19` é a **sessão** — `alvo_tipo = "sessao_autenticacao"`, `alvo_id = sessao.id` —, aplicação direta da regra, sem exceção |
| `D-AUD-04`/`D-AUD-05`/`D-AUD-06` | **INALTERADOS.** Nenhuma ação RC ou SF foi promovida; `L-05`..`L-08` permanecem adiadas |
| `D-AUD-07` — whitelist fail-closed | **NÃO AMPLIADA.** `usuario.autenticacao` mantém whitelist **vazia**; `D-2.3D-12` fixa `contexto = {}`, que é exatamente o que a regra base permite. `D-2.3D-19` **mantém vazia** a whitelist de `usuario.sessao.revogacao` — nenhuma chave é acrescentada, e as proibições absolutas de F-04 são reafirmadas |
| `D-AUD-08` — ownership da validação | **INALTERADO.** A emissão dos eventos de autenticação usará o catálogo tipado e o validator fail-closed já existentes em `apps/api` |

| `PBACK-AUD-09` — `autorizacao.negada` (25ª ação) | **NÃO AMPLIADA.** `D-2.3D-19` **não** acrescenta `sessoes.revogar_terceiro` à lista fechada de permissões cujas negações são auditadas — que continua com **um** item, `senha.recuperar_terceiro` —, **não** altera o `PermissoesGuard` por implicação e **não** modifica `PBACK-AUD-09`, cuja decisão D-1 exige nova decisão normativa expressa para qualquer ampliação. A **Q2** daquela decisão (auditoria *best-effort* preservando o `403`) **não se estende** a `D-2.3D-19`: ali não há mutação, aqui há, e a atomicidade é obrigatória (§5.19, A-18 em §6) |

**Declaração expressa:** este documento **não reabre** `docs/09` §12 sob nenhum aspecto, e a REV. 10 **não reabre** `docs/09` §13 nem `PBACK-AUD-01`..`PBACK-AUD-09`.

## 14. Histórico de revisões

| REV. | Data | Conteúdo |
| --- | --- | --- |
| **14** | 15/09/2026 | **SINCRONIZAÇÃO PÓS-INTEGRAÇÃO DE `P-2.3D-08` / `D-2.3D-20` NA `main` (PR #47, MERGE `89fa492`) E ENCERRAMENTO FACTUAL DE `P-2.3D-04` MEDIANTE PROVA E2E REAL SAME-ORIGIN.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-20` permanecem exatamente como homologadas. **(a) Sincronização de `P-2.3D-08`:** integrada na `main` em 15/09/2026 via PR [#47](https://github.com/BrunoMNoronha/techlab-fisio/pull/47) (commit `4f78c4ed2de5b2e9f358f55accfa021b027fc124`, merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`, CI verde run `34983136046`). `P-2.3D-08` passa a **CONCLUÍDA / INTEGRADA NA `main`**. **(b) Encerramento formal de `P-2.3D-04`:** Encerrada em 15/09/2026 após a integração do PR #47 (merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`) que versionou `apps/web/scripts/verify-web-api-e2e.mjs` e o passo correspondente na CI, executando simultaneamente PostgreSQL real em container, NestJS real compilado, Next.js real compilado com Route Handler de proxy same-origin (`/api/*`), `ProtecaoCsrfGuard` real e cookie real de sessão, provando que a baseline de CSRF de `D-2.3D-07` (`SameSite=Strict`, cabeçalho obrigatório `X-TLF-Requisicao` nas mutações, Fetch Metadata, validação de `Origin`, ausência de CORS) protege a fronteira de ponta a ponta sem necessidade de synchronizer token adicional. **(c) Demais pendências:** `P-2.3D-01`, `P-2.3D-05`, `P-2.3D-06` e `Q-02` permanecem inalteradas; **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**. |
| **13** | 15/09/2026 | **ACRÉSCIMO DE UMA DECISÃO NOVA — `D-2.3D-20` (§5.20): consulta da sessão autenticada atual por `GET /auth/sessao`, homologada por Bruno Menezes Noronha em 07/09/2026 (TLF-BASE-V1 §15, item 1). SINCRONIZAÇÃO FACTUAL DA INTEGRAÇÃO DE `P-2.3D-07` NA `main` E MATERIALIZAÇÃO DE `P-2.3D-08`.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-19` permanecem exatamente como homologadas. **(a) `D-2.3D-20` (§5.20):** fixa a operação segura de leitura `GET /auth/sessao` para consulta da sessão autenticada via cookie `tlf_sessao`; safe method isento de `ProtecaoCsrfGuard`; resposta `200 OK` com `ConsultarSessaoRespostaDto` `{ usuarioId, sessaoId }` estritamente tipada em UUID; cabeçalho obrigatório `Cache-Control: no-store`; sem emissão de cookie (`Set-Cookie` ausente); respostas `401` (`SESSAO_INVALIDA`) e `500` (`FALHA_INTERNA`) normalizadas pelo `FiltroErroAutenticacao`; **proibição estrita e expressa de auditoria** (`usuario.sessao.consultada` vedada por ser leitura de alta frequência sem relevância forense e alheia a `D-AUD-01`); zero queries adicionais ao banco. **(b) Sincronização pós-integração de `P-2.3D-07`:** integrada na `main` em 14/09/2026 por Bruno Menezes Noronha via PR [#46](https://github.com/BrunoMNoronha/techlab-fisio/pull/46) (commit `540302e5a95ae733ad07647af8318891b4ec9ee4`, merge commit `b6427e1ab999aae40f41e7745fe374f32b719836`, CI run `34884210876`). **(c) Abertura e materialização de `P-2.3D-08`:** implementação da rota no backend e construção da prova E2E real automatizada `apps/web/scripts/verify-web-api-e2e.mjs` exercitando PostgreSQL 18 descartável, NestJS compilado, Next.js com Route Handler proxy, `ProtecaoCsrfGuard` e cookies reais. Critérios `A-01`..`A-22` (§10.5) atendidos e provados. **(d) Correção do cabeçalho:** cabeçalho harmonizado com o histórico de revisões (REV. 10 → REV. 13). **`P-2.3D-04` permanece ABERTA** (encerramento formal reservado a rito pós-integração na `main`). **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**. |
| **12** | 14/09/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-19` permanecem exatamente como homologadas, byte a byte em conteúdo normativo; nenhuma decisão foi renumerada, reduzida, acrescentada ou reaberta; **nenhuma `D-2.3D-20` foi criada**. **(a) Conclusão e materialização de `P-2.3D-07` / `AUT-002` (`sessoes.revogar_terceiro`) em branch própria.** A implementação técnica da revogação administrativa de sessão de terceiro foi concluída na branch `agent/p-2.3d-07-revogacao-sessao-terceiro` em conformidade estrita com `D-2.3D-19` (§5.19) e os critérios de aceite normativos `A-01`..`A-22` (§10.4) foram todos atendidos (**CONCLUÍDO**). Rota `DELETE /auth/sessoes/:sessaoId` entregue com RBAC, derivação exclusiva de ator via sessão autenticada, envelope anti-oráculo uniforme 204, atomicidade estrita da mutação e auditoria (`usuario.sessao.revogacao`), e zero drift físico ou de dependências. Quatro mutation challenges mandatórios executados, detectados e revertidos com verificação por hash. **(b) Atualizações de status:** §10.4 com critérios `A-01`..`A-22` atualizados para **CONCLUÍDO**; em §11, **`P-2.3D-07` passa a IMPLEMENTADA EM BRANCH PRÓPRIA** (aguardando homologação e integração na `main`); em §12, **AUT-002** atualizada para registrar a materialização da revogação administrativa na branch. **(c) Demais pendências:** `P-2.3D-01`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06` e `Q-02` permanecem inalteradas; **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**. |
| **11** | 06/09/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-19` permanecem exatamente como homologadas, byte a byte em conteúdo normativo; **`D-2.3D-07` e `D-2.3D-19` em particular estão intactas**; nenhuma decisão foi renumerada, reduzida, acrescentada ou reaberta; **nenhuma `D-2.3D-20` foi criada**. Mesma forma e mesmo precedente das REV. 1, 2, 4, 5 e 7. **(a) Publicação da REV. 10.** A rodada normativa de `D-2.3D-19` foi integrada na `main` em 06/09/2026 pela PR [#26](https://github.com/BrunoMNoronha/techlab-fisio/pull/26) (commit `0444fef`, merge commit `aba939c` sobre `867e9d2`, CI verde na run 34009649437), por ato de Bruno Menezes Noronha; **somente `docs/10` e `docs/12`** foram tocados. **`P-2.3D-07` permanece ABERTA e a revogação administrativa de sessão de terceiro permanece NÃO IMPLEMENTADA** — a integração publica a **decisão**, não a implementação. **(b) Único campo alterado nesta revisão:** a linha de **`P-2.3D-04`** em §11, que **continua ABERTA** e passa a registrar o fato medido de que o `apps/web` real integrou-se a `apps/api` em 06/09/2026 (PR [#27](https://github.com/BrunoMNoronha/techlab-fisio/pull/27), merge `0d76474`) sob topologia **same-origin**, com a baseline de `D-2.3D-07` **preservada sem enfraquecimento** — proxy transparente preservando `Host` público, `Origin`, `Sec-Fetch-*` e `X-TLF-Requisicao`, CORS desabilitado, compatibilidade de cabeçalhos avaliada por 3 provas via função local de reprodução (`avaliarGuard`, sem executar o guard real do backend nem o Route Handler real) e **sem** synchronizer token; a bateria (24 verificações) não roda na CI e a prova de fluxo integrado ponta a ponta permanece não realizada. **A reavaliação tornou-se possível e foi medida sob esses limites; ela NÃO foi homologada** — o encerramento da pendência é ato expresso de Bruno (TLF-BASE-V1 §15, item 1), e esta revisão **não** o antecipa. **(c) Divergência registrada:** o `README.md` de `apps/web`, como integrado pela PR #27, afirmava `P-2.3D-04` "resolvida sob a topologia same-origin **aprovada por Bruno Menezes Noronha**" sem que exista tal registro aqui, em `docs/09` §12/§13 ou em `docs/08`; pelo precedente de `F0H-01` (`docs/08` REV. 23/24), a asserção foi **reescrita para o que está medido**, sem homologar em nome de Bruno e sem tocar código. **(d) Nada mais muda:** `Q-02`, `P-2.3D-01`, `P-2.3D-05`, `P-2.3D-06` e `P-2.3D-07` permanecem como estavam; **AUT-002 continua PARCIAL**; **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**. Registro pós-medição completo em `docs/08` REV. 26 e `docs/10` REV. 38. |
| **10** | 06/09/2026 | **ACRÉSCIMO DE UMA DECISÃO NOVA — `D-2.3D-19` (§5.19): revogação administrativa de sessão de terceiro —, homologada por Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1). Rodada EXCLUSIVAMENTE NORMATIVA E DOCUMENTAL: nenhuma alteração de runtime, schema, migration, dependência, contrato, OpenAPI, teste ou configuração.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-18` permanecem exatamente como homologadas, e **`D-2.3D-05` e `D-2.3D-18` em particular estão intactas**. **(a) Origem.** A homologação técnica independente de 06/09/2026 comprovou que a implementação administrativa **não existe** (sem rota, service, DTO ou emissor; `sessoes.revogar_terceiro` catalogada e **órfã**) e que a decisão que a autorizaria **não existia** — o registro terminava em `D-2.3D-18`, que declara expressamente **não** determinar `revogada_por_usuario_id` para a operação administrativa. A lacuna era **normativa**: o desenho vigente deriva a autoria da própria linha, tornando a operação inimplementável sem decisão expressa. Mesmo precedente das REV. 3, 6, 8 e 9 — a decisão é homologada por Bruno, **not** pelo implementador; e desta vez **antes** do código, para que a fatia futura não tome nenhuma decisão de produto. **(b) `D-2.3D-19`** fixa: operação **individual** sobre sessão de terceiro identificada por `sessao_id` (identificador, **não** credencial — o token do alvo não é exigido nem exposto); **ator** exclusivamente derivado da sessão autenticada e validada, persistido em `revogada_por_usuario_id` **e** em `evento_auditoria.ator_usuario_id`, **proibido** vir do cliente por qualquer mecanismo ou ser inferido do dono da sessão-alvo, e **proibido** existir como campo de contrato ainda que ignorado; **exceção delimitada** — primeira e única — ao desenho de autoria derivada da própria linha, válida **somente** para `sessoes.revogar_terceiro` e **não generalizável**; **autorrevogação recusada** pela capacidade administrativa, com o logout mantido como via própria; **`204 No Content` uniforme** para revogação efetiva, sessão inexistente, já revogada, já expirada e alvo do próprio ator, sem corpo e sem cookie, com **limite declarado** de que a uniformidade é de envelope e **não** temporal, e sem absorver `400` estrutural nem falhas de autenticação, autorização, CSRF, conteúdo ou infraestrutura; **estado temporal** preservado — sessão já vencida por `D-2.3D-04` **não** é reclassificada como revogada pelo Administrador; **atomicidade e convergência** sob concorrência, com as invariantes de que o `204` efetivo nunca coexiste com sessão utilizável e de que não há ressurreição; **auditoria obrigatória** da transição efetiva por `usuario.sessao.revogacao`, `alvo_tipo = "sessao_autenticacao"`, `alvo_id = sessao.id`, `resultado = SUCESSO`, `justificativa = NULL`, `contexto` **vazio**, sem token, hash, cookie, senha, segredo ou payload; **atomicidade transacional** entre a mutação e a trilha, com rollback da revogação se o evento não puder ser persistido — expressamente **distinta** da Q2 *best-effort* de `PBACK-AUD-09`, porque ali não há mutação e aqui há; **no-op não emite auditoria falsa de sucesso**, e nenhuma ação de "tentativa" é criada; **zero drift** — nenhuma migration autorizada, com parada e devolução para aprovação se a implementação encontrar impossibilidade estrutural concreta. **(c) Não ampliação declarada:** `D-AUD-01`, `D-AUD-02`, `D-AUD-03`, `D-AUD-07` e **`PBACK-AUD-09`** permanecem **inalterados**; `sessoes.revogar_terceiro` **não** entra na lista fechada de `autorizacao.negada`, que continua com **um** item. **(d) Acrescentados:** §10.4 com os critérios de aceite normativos **`A-01`..`A-22`** e as quatro provas de poder exigidas; alternativas rejeitadas **A-15**..**A-18**; riscos **`R-2.3D-09`** (o `204` uniforme impede o Administrador de distinguir revogação efetiva de alvo inexistente) e **`R-2.3D-10`** (falha de auditoria impede a revogação), ambos aceitos e declarados; pendência **`P-2.3D-07`** (implementação da fatia). **(e) AUT-002 continua PARCIAL e a revogação administrativa continua NÃO IMPLEMENTADA** (§12) — esta revisão fecha **somente** a decisão. **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**; `Q-02`, `P-2.3D-01`, `P-2.3D-04`, `P-2.3D-05` e `P-2.3D-06` permanecem como estavam. **(f) Correção editorial:** a faixa de decisões do cabeçalho e do rodapé passa de `..D-2.3D-15`/`..D-2.3D-18` para `..D-2.3D-19`; o cabeçalho havia permanecido em `..D-2.3D-15` e em "REV. 7" através das REV. 8 e REV. 9, que acrescentaram `D-2.3D-16`..`D-2.3D-18` sem atualizá-lo. Correção **factual**, sem efeito sobre decisão alguma. |
| **9** | 05/09/2026 | **ACRÉSCIMO DE UMA DECISÃO NOVA — `D-2.3D-18` (§5.18), homologada por Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) — E ENCERRAMENTO DA ETAPA 2.3D PELA F7.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-17` permanecem exatamente como homologadas, e **`D-2.3D-05` em particular está intacta**. **(a) `Q-01` RESOLVIDO — não havia conflito normativo.** A revisão da PR [#22](https://github.com/BrunoMNoronha/techlab-fisio/pull/22) apontou, com razão, que `docs/06` §12.7 define T-07 exclusivamente como recuperação de senha, o que parecia pôr `docs/09` §5 em conflito consigo mesmo. A apuração da **governança** de `docs/09` dissolveu a questão: seu cabeçalho declara §§1..11 "insumo decisório histórico, **sem valor normativo próprio**", §12 prevalece, e `D-AUD-01` homologa **apenas os 24 nomes de ações**. A linha invocada é de §5 e **não vincula**. **`docs/09` NÃO foi alterado** — o próprio documento manda preservar §§1..11 intactos, e sua regra de precedência já resolve a leitura; a desambiguação é de rastreabilidade e vive aqui e em `docs/10` §6-Q. **(b) `D-2.3D-18`** fecha `L-F6-06`: na revogação em massa da T-07, `revogada_por_usuario_id` recebe o `usuario_id` da própria linha. O fundamento é declarado como **escolha por eliminação** — nenhuma fonte determina o valor; `NULL` colidiria com o significado vigente da coluna e quebraria a invariante `REVOGADA` ⟺ preenchido; o Administrador iniciador é factualmente falso e tinha por única base a tabela não normativa de §5; coluna nova é desnecessária. Regra **restrita à T-07**, com o limite de que a conclusão prova **posse do segredo**, não identidade. **`L-F6-06` vira alias histórico.** **(c) `L-F6-07` NÃO foi promovida** e permanece decisão local: a nova pendência **`Q-02`** (§11, **não bloqueante**) registra que a auditoria de tentativas recusadas não é inequivocamente sustentada — "falhas relevantes" em `docs/05` FC-01 não alcança a recuperação de forma clara, o catálogo não tem ação para o caso e uma recusa por segredo inválido não localiza usuário. **(d) Encerramentos factuais:** **F7 → CONCLUÍDA** em §9; **`P-2.3D-03` → ENCERRADA** em §11 (medida e verde desde a F3, provada a cada CI por `verify:openapi-runtime`, 19/19 — `D-2.3D-11` não alterada); **AUT-002 → PARCIAL** em §12, citando `D-2.3D-18` e nomeando o que falta (revogação administrativa de terceiro e inativação). **(e) ETAPA 2.3D ENCERRADA.** Permanecem abertas, fora da Etapa: `Q-02`, `P-2.3D-01`, `P-2.3D-04`, `P-2.3D-05` e `P-2.3D-06` (adiada). **AUT-005 permanece NÃO MATERIALIZADA**; `P2.2-05` permanece **NÃO INICIADA**; a revogação administrativa de sessão de terceiro permanece **NÃO IMPLEMENTADA**. |
| **8** | 05/09/2026 | **ACRÉSCIMO DE DUAS DECISÕES NOVAS — `D-2.3D-16` (§5.16) e `D-2.3D-17` (§5.17), homologadas por Bruno Menezes Noronha em 05/09/2026 (TLF-BASE-V1 §15, item 1).** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-15` permanecem exatamente como homologadas, e **`D-2.3D-06` e `D-2.3D-08` em particular estão intactas**. Mesmo precedente e mesma forma da REV. 3 (`L-11` → `D-2.3D-13`) e da REV. 6 (`L-F5-07`/`L-F5-08` → `D-2.3D-14`/`D-2.3D-15`): a implementação da F6 registrou os dois comportamentos como decisões locais e **recusou-se a homologá-los** em nome de Bruno, devolvendo-os como pendências com alternativas e recomendação. `D-2.3D-16` fixa que o início da recuperação é operação **sobre terceiro** — o titular de `senha.recuperar_terceiro` não inicia a própria —, com ator vindo da sessão validada e **recusa uniforme no envelope HTTP** (status, código, corpo e cabeçalhos) com alvo inexistente e inativo, condição da regra e não acessório; declara expressamente que **não** exige uniformidade temporal e registra o canal de tempo residual do `FOR UPDATE` como limite conhecido e aceito. `D-2.3D-17` fixa que a unidade contada no limite de conclusão é a **tentativa admitida**, contabilizada no ato da admissão e inclusive em caso de sucesso, com alcance **restrito** a essa metade de `D-2.3D-06` — a metade do login continua contando **falhas**; declara ainda que `D-2.3D-13` não se aplica a essa dimensão e aceita expressamente o risco residual de IP compartilhado. **`L-F6-03` e `L-F6-05` viram aliases históricos.** Atualizada também, de forma factual, a linha da fatia **F6** em §9, que passa a **CONCLUÍDA** por ter sido integrada na `main` em 05/09/2026 por merge commit `cbd02eb` (PR [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20)), com CI verde sobre o HEAD integrado; e a linha de **AUT-004** em §12, que passa a **MATERIALIZADA**. Registro em `docs/10` §6-P.18 e §11, REV. 33. **`L-F6-06` e `L-F6-07` NÃO foram promovidas nesta revisão.** `L-F6-07` permanece decisão local sustentada por `docs/09` §5, que responde expressamente “resultado necessário? Não” para as duas ações. **`L-F6-06` permanece PENDENTE de decisão expressa**: `D-2.3D-05` governa o **logout do próprio usuário** e **não** determina `revogada_por_usuario_id` na revogação em massa de T-07 — a ambiguidade segue aberta, com o comportamento vigente preservado. **AUT-005 permanece NÃO MATERIALIZADA / NÃO ENCERRADA**; `P2.2-05` permanece **NÃO INICIADA**; **a F7 permanece NÃO INICIADA**. Nenhuma pendência de §11 foi alterada ou encerrada. |
| **7** | 02/09/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-15` permanecem exatamente como homologadas, byte a byte em conteúdo normativo; **`D-2.3D-14` e `D-2.3D-15` não foram tocadas nem reabertas**; nenhuma decisão foi renumerada, reduzida ou acrescentada. Único campo alterado: a linha da fatia **F5** em §9, que passa a **CONCLUÍDA**, por ter sido homologada por Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) e integrada na `main` em 02/09/2026 por merge commit `657676b` (PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18)), com CI verde sobre o HEAD integrado e validação local pós-merge integralmente verde. Registro em `docs/10` §6-O.8 e §11, REV. 29. **AUT-005 permanece NÃO MATERIALIZADA / NÃO ENCERRADA**; `P2.2-05` permanece **NÃO INICIADA**; **a F6 permanece NÃO INICIADA**. Mesma forma e mesmo precedente das REV. 1, 2, 4 e 5. |
| **6** | 31/08/2026 | **ACRÉSCIMO DE DUAS DECISÕES NOVAS — `D-2.3D-14` (§5.14) e `D-2.3D-15` (§5.15), homologadas por Bruno Menezes Noronha.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta. `D-2.3D-14` resolve a ambiguidade observada na revisão da F5: a matriz inicial de `D-2.3D-09` deve estar integralmente presente, mas o seed é aditivo e não remove excedentes; o modo estrito também converge o estado canônico e termina com saída 3 quando divergências persistem — não é somente leitura. `D-2.3D-15` resolve a autoria do bootstrap inaugural: `ator_usuario_id = NULL`, sem identidade sintética e sem autoatribuição fictícia, com justificativa operacional obrigatória persistida fora de `contexto`. Acrescentadas as alternativas rejeitadas A-13/A-14 e atualizada a dependência da F5. A implementação da F5 permanece não integrada e sujeita à homologação técnica própria. |
| **5** | 28/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-13` permanecem exatamente como homologadas, byte a byte em conteúdo normativo; **`D-2.3D-09` não foi tocada nem reaberta**; **`D-2.3D-10` não foi tocada**; nenhuma decisão foi renumerada, reduzida ou acrescentada; **nenhuma `D-2.3D-14` foi criada**. Único campo alterado: a linha da fatia **F4** em §9, que passa a **CONCLUÍDA**, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 (TLF-BASE-V1 §15, item 1) após a **segunda** revisão técnica independente adversarial devolver **`A — APTO À HOMOLOGAÇÃO E VERSIONAMENTO`** (0 BLOQUEANTES, 0 ALTOS, 0 MÉDIOS; 1 BAIXO documental `R4R2-01`, corrigido antes do commit). Registro em `docs/10` §6-L e §11, REV. 23. **A F5 permanece NÃO INICIADA** e a **F6 permanece NÃO INICIADA**; **AUT-005 permanece NÃO MATERIALIZADA / NÃO ENCERRADA**; a autorização clínica contextual (`P2.2-05`) permanece **NÃO INICIADA**. Esta revisão **não** afirma integração na `main`: o registro factual do merge pertence a execução documental posterior. |
| **4** | 28/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-13` permanecem exatamente como homologadas. Único campo alterado: a linha da fatia **F3** em §9, que passa a **CONCLUÍDA**, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 após a terceira revisão técnica independente adversarial (veredito `A`). Mesma forma e mesmo precedente das REV. 1 e REV. 2. **Nenhuma pendência de §11 foi alterada ou encerrada**; em particular `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05` e `P-2.3D-06` seguem como estavam, e `R-2.3D-08` permanece registrado em §8 como risco aceito. A evidência da homologação e o rito de integração vivem em `docs/10` §6-I — este documento continua sendo apenas o registro normativo das decisões. |
| **3** | 28/08/2026 | **ACRÉSCIMO DE UMA DECISÃO NOVA — `D-2.3D-13` (§5.13), homologada por Bruno Menezes Noronha.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas em 27/08/2026, e **`D-2.3D-06` em particular está intacta**. **Fundamento:** a segunda revisão técnica independente adversarial da F3 classificou a proteção de concorrência em voo do limitador — registrada pela implementação como decisão local `L-11` — como **decisão comportamental, e não detalhe de implementação**, por três razões medidas: o teto de simultaneidade (5 e 30) foi acoplado ao limite de falhas sem que fonte alguma o fixasse; `Retry-After: 1` não é derivável de fonte homologada; e o `429` transitório é invisível ao contador de falhas, alterando a semântica de `429` que o próprio OpenAPI descreve. A revisão **recusou-se a homologá-la** em nome de Bruno (TLF-BASE-V1 §15) e a devolveu como decisão pendente, com alternativas e recomendação. Bruno homologou a opção recomendada — manter o comportamento como está — e ela passa a ser normativa como `D-2.3D-13`. **`L-11` vira alias histórico.** Acrescentado também o risco `R-2.3D-08` em §8, declarando e aceitando o risco residual de `429` transitório contra usuário legítimo. `D-2.3D-13` foi acrescentada à linha da F3 em §9. Nenhuma pendência de §11 foi alterada. |
| **2** | 27/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas; **`D-2.3D-04` não foi tocada**. Único campo alterado: a linha de acompanhamento de **`R-2.3D-03`** em §8, que passa a **ENCERRADO em 27/08/2026** — mesma forma e mesmo precedente da REV. 1 para `P-2.3D-02`. Fundamento: a F2 produziu a prova que o risco vigiava (`UPDATE` condicional atômico, `GREATEST`, throttle que barra regressão, testes concorrentes contra PostgreSQL real, mutation challenge de last-writer-wins detectado, e `C-01` sem enfraquecimento da proteção) — evidência integral em `docs/10` §6-E.5/§6-E.9/§9. Os limites da evidência (`READ COMMITTED`; PostgreSQL autoritativo compartilhado) ficam registrados como **limites da prova**, não como risco aberto; escrita distribuída/multi-primary está fora da arquitetura vigente e não é antecipada. Nenhuma pendência de §11 foi alterada. |
| **1** | 27/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas em 27/08/2026; nenhum parâmetro, prazo, nome ou regra foi alterado, acrescentado ou removido. Única mudança: em §11, `P-2.3D-02` (benchmark empírico do Argon2id) passa de **ABERTA** a **ENCERRADA**, por ter sido cumprida na F1 — a medição está registrada em `docs/10` §6-D.5 e sustenta a manutenção dos parâmetros de `D-2.3D-02`, que **não é reaberta**. A F1 em si (implementação de `CredencialService`, `argon2@0.45.1`, normalização do login) é registrada em `docs/10` §6-D, não aqui: este documento é normativo, não registro de execução. |
| **0** | 27/08/2026 | Criação. Registro normativo de `D-2.3D-01`..`D-2.3D-12` homologadas por Bruno Menezes Noronha. Execução da fatia **F0**: materialização física exclusiva de `D-2.3D-01` (`sessao_autenticacao.token_hash`, `sessao_autenticacao.ultima_atividade_em`, `ck_sessao_autenticacao_atividade`) na migration `20260827175151_sessao_autenticacao_token_atividade`; atualização de `protected-objects.json` (25 → 26 CHECKs), da Guarda 2 e do golden schema pelo fluxo oficial; testes de aceite/rejeição da CHECK e de NOT NULL. Nenhuma dependência instalada; nenhuma implementação de F1+ iniciada |

---

**Fim — `docs/12-decisoes-autenticacao-autorizacao.md` — `D-2.3D-01`..`D-2.3D-20` registradas; F0 da Etapa 2.3D-B executada em 27/08/2026; `D-2.3D-13` homologada em 28/08/2026; `D-2.3D-14` e `D-2.3D-15` homologadas em 31/08/2026; `D-2.3D-16`, `D-2.3D-17` e `D-2.3D-18` homologadas em 05/09/2026; F0..F7 CONCLUÍDAS e Etapa 2.3D ENCERRADA em 05/09/2026; `D-2.3D-19` homologada em 06/09/2026 e integrada na `main` em 14/09/2026 (PR #46); `D-2.3D-20` homologada em 07/09/2026 e integrada na `main` em 15/09/2026 (PR #47); REV. 14 (15/09/2026) registra a integração de `D-2.3D-20` e da prova E2E real same-origin (`P-2.3D-08`, PR #47, merge `89fa492`) e o encerramento factual de `P-2.3D-04`.**
