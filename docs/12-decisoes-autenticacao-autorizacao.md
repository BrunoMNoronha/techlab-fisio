# Decisões de Autenticação e Autorização — `D-2.3D-01`..`D-2.3D-13`

> **Documento:** `docs/12-decisoes-autenticacao-autorizacao.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Frente de backend (`apps/api`) — Etapa 2.3D-B, fatia **F0**
> **Status:** **DECIDIDO — `D-2.3D-01`..`D-2.3D-13` homologadas por Bruno Menezes Noronha (`D-2.3D-01`..`D-2.3D-12` em 27/08/2026; `D-2.3D-13` em 28/08/2026 — TLF-BASE-V1 §15, item 1)**
> **Data:** 27 de agosto de 2026 (REV. 3 e REV. 4 em 28/08/2026)
> **Natureza:** registro **normativo** das decisões que governam a implementação de autenticação e autorização da Etapa 2.3D. Segue o padrão de `docs/09` §12 e de `docs/11` (registro de decisão com valor normativo próprio). **Não altera** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` nem `docs/02`..`docs/07`; **não reabre** `D-AUD-01`..`D-AUD-08` (`docs/09` §12).
> **Revisão vigente:** REV. 4 (28/08/2026) — atualização **exclusivamente factual**: a fatia **F3 passa a CONCLUÍDA** em §9, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 (`docs/10` §6-I; §11, REV. 19). **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas, e nenhuma pendência de §11 foi alterada ou encerrada. Estado anterior preservado: REV. 3 (28/08/2026) — **acréscimo de UMA decisão nova: `D-2.3D-13` — proteção de concorrência em voo do limitador de login** (§5.13), homologada por Bruno Menezes Noronha após a segunda revisão técnica independente adversarial da F3, que a classificou como decisão comportamental e recusou homologá-la em nome dele. **Nenhuma decisão anterior foi modificada, renumerada ou reaberta** — `D-2.3D-01`..`D-2.3D-12` seguem exatamente como homologadas; em particular `D-2.3D-06` permanece intacta, e `D-2.3D-13` a COMPLEMENTA sem alterar a política de falhas/janela. A implementação registrava o comportamento como decisão local `L-11` (`docs/10` §6-G.2); `L-11` passa a ser **alias histórico** de `D-2.3D-13`. Estado anterior preservado: REV. 2 (27/08/2026) — atualização exclusivamente factual: `R-2.3D-03` **ENCERRADO** pela prova de monotonicidade atômica produzida na F2 (`docs/10` §6-E.5/§6-E.9/§9), por decisão de Bruno Menezes Noronha. **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-12` seguem como homologadas; em particular `D-2.3D-04` permanece intacta. REV. 1 (27/08/2026) — atualização exclusivamente factual: `P-2.3D-02` ENCERRADA pelo benchmark da F1 (`docs/10` §6-D.5). **Nenhuma decisão foi modificada** — `D-2.3D-01`..`D-2.3D-12` seguem como homologadas. REV. 0 (27/08/2026): F0 executada — decisões registradas + única reabertura física da persistência de sessão.

---

## 1. Identificação e status

| Campo | Valor |
| --- | --- |
| Identificadores | `D-2.3D-01` .. `D-2.3D-13` |
| Autoridade | Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) |
| Data da homologação | 27/08/2026 (`D-2.3D-01`..`D-2.3D-12`) · 28/08/2026 (`D-2.3D-13`) |
| Baseline de código na homologação | `main` = `53f9fc5777759388bfb4bcaa429f4f607733b422` |
| Fatia que materializou este registro | **F0** — decisões normativas + reabertura física controlada da persistência de sessão |
| Efeito físico nesta fatia | **exclusivamente `D-2.3D-01`**; as demais são normativas e produzem efeito nas fatias F1..F7 (`D-2.3D-13` foi acrescentada em 28/08/2026, REV. 3) |

Este documento é a **baseline normativa da Etapa 2.3D**. Onde uma fatia posterior divergir dele, prevalece este registro até que uma decisão expressa de Bruno o altere.

## 2. Escopo

**Dentro do escopo deste registro:** persistência de sessão; hash de senha; normalização do login; política de sessão; estados terminais; anti-abuso; cookie e CSRF; recuperação de senha; RBAC inicial; primeiro Administrador; OpenAPI; auditoria de autenticação.

**Fora do escopo deste registro:** qualquer alteração de `docs/02`..`docs/07`; qualquer alteração do catálogo de auditoria ou da whitelist de `contexto` (`docs/09` §12, `D-AUD-01`/`D-AUD-07`); autorização clínica por relação profissional↔paciente (`P2.2-05`); frontend (`apps/web`).

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

O `token_hash` **habilita** a F1/F2 (credencial e sessão) sem nova reabertura de persistência. Nenhuma das decisões §5.2..§5.12 exige alteração adicional de schema — verificado uma a uma: `D-2.3D-03` dispensa migration por construção; `D-2.3D-08` reutiliza `segredo_recuperacao_senha`; `D-2.3D-09` usa `papel`/`permissao`/`papel_permissao`/`usuario_papel` já existentes; `D-2.3D-06` é memória de processo; `D-2.3D-12` opera dentro de `evento_auditoria`.

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

Riscos herdados e **não** alterados por este registro: `R2.2-04`, `R-BL-09`, `V-06.c` (`docs/10` §9).

## 9. Dependências entre as fatias F0..F7

| Fatia | Conteúdo | Depende de | Habilitada por |
| --- | --- | --- | --- |
| **F0** | Registro normativo + persistência de sessão | — | **CONCLUÍDA** |
| F1 | `CredencialService` / Argon2id | `D-2.3D-02`, `D-2.3D-03` | F0 |
| F2 | `SessaoService` — emissão, verificação, atividade monotônica, estados terminais | `D-2.3D-01`, `D-2.3D-04`, `D-2.3D-05` | **F0 (colunas + CHECK)**, F1 |
| **F3** | Endpoints REST de autenticação, cookies, CSRF, OpenAPI, rate limiting do login | `D-2.3D-06`, `D-2.3D-07`, `D-2.3D-11`, `D-2.3D-12`, `D-2.3D-13` | **CONCLUÍDA** (homologada em 28/08/2026 — `docs/10` §6-I) |
| F4 | Guards e decorators de autorização (RBAC) | `D-2.3D-09` | F2, F3 |
| F5 | Seed de papéis/permissões + bootstrap do primeiro Administrador | `D-2.3D-09`, `D-2.3D-10` | F4 |
| F6 | Recuperação de senha (início e conclusão) + rate limiting próprio | `D-2.3D-06`, `D-2.3D-08` | F1, F2, F5 |
| F7 | Consolidação, revisão independente e rito de integração | todas | F1..F6 |

`D-2.3D-01` é a **única** dependência de persistência de toda a etapa: nenhuma fatia posterior exige nova reabertura física.

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

## 11. Pendências mantidas abertas

| ID | Pendência | Estado |
| --- | --- | --- |
| `P-2.3D-01` | Absorção editorial de `token_hash`, `ultima_atividade_em` e `ck_sessao_autenticacao_atividade` em `docs/07` §7.1/§10.2 | **ABERTA** — ação de governança separada (§7.2) |
| ~~`P-2.3D-02`~~ | Benchmark empírico dos parâmetros de Argon2id | **ENCERRADA em 27/08/2026** — benchmark executado na F1 e registrado em `docs/10` §6-D.5: `hash` p50 39,16 ms · `verify` válido p50 38,70 ms · `verify` inválido p50 39,67 ms · ~19 MiB por operação (Node 24, win32-x64, i5-1235U, 30 amostras, warm-up 5). Sem ressalva material. **`D-2.3D-02` NÃO foi alterada**: os parâmetros homologados `m=19456`/`t=2`/`p=1` permanecem exatamente como decididos, agora com a medição que a própria decisão exigia. Limitação declarada: medição em máquina de desenvolvimento — remedir em hardware de produção antes do go-live é prudência operacional, não condição pendente |
| `P-2.3D-03` | Medição de compatibilidade ESM/`nodenext` de `@nestjs/swagger@11.4.7` | **ABERTA** — F3 (`D-2.3D-11`) |
| `P-2.3D-04` | Reavaliação da proteção CSRF contra a arquitetura real do `apps/web` | **ABERTA** — quando o frontend existir (`D-2.3D-07`) |
| `P-2.3D-05` | Eventual auditoria de criação de usuário (`usuario.criado`) | **ABERTA** — exige decisão própria (`D-2.3D-10`) |
| `P-2.3D-06` | Contadores de rate limit resilientes a restart / múltiplas instâncias | **ADIADA** — limitação aceita do MVP (`D-2.3D-06`) |

Pendências herdadas e **não** alteradas por este registro: `P-BACK-01`, `R2.2-04`, `L-05`..`L-08`, `P2.2-05`, `configuracao.alterada`, `prontuario.exportado`, `autor_original_usuario_id`, `R-BL-09`, `V-06.c` (`docs/10` §9).

## 12. Relação com AUT-001..AUT-006

| Requisito | Decisões que o materializam | Observação |
| --- | --- | --- |
| **AUT-001** — Autenticar usuário ativo | `D-2.3D-02` (verificação de credencial + caminho dummy), `D-2.3D-03` (localização por identificador normalizado), `D-2.3D-01`/`D-2.3D-04` (criação da sessão), `D-2.3D-12` (evento de autenticação) | A invariante "erros não devem facilitar enumeração" é atendida por `D-2.3D-02` + `D-2.3D-12` em conjunto |
| **AUT-002** — Encerrar, expirar e revogar sessões | `D-2.3D-01` (janela física), `D-2.3D-04` (expiração absoluta e ociosa), `D-2.3D-05` (estados terminais) | Estados e transições preservados **sem alteração**: `ATIVA -> EXPIRADA`, `ATIVA -> REVOGADA` |
| **AUT-003** — Autorizar por papel, permissão, escopo e recurso | `D-2.3D-09` | Enforcement no backend (F4). `P2.2-05` (escopo clínico) permanece fora desta etapa |
| **AUT-004** — Recuperar senha com mecanismo seguro | `D-2.3D-08`, `D-2.3D-06` (limite de conclusão) | Preserva D-04 e T-07: conclusão revoga sessões anteriores |
| **AUT-005** — Ativar e inativar usuários | `D-2.3D-05` (revogação), `D-2.3D-10` (papel do Administrador) | A revogação por inativação usa os mesmos estados terminais |
| **AUT-006** — Auditar ações sensíveis | `D-2.3D-12` | Sem senha, token ou cookie; dentro do catálogo de `docs/09` §12 |

Nenhum requisito AUT foi ampliado, reduzido ou reinterpretado por este registro.

## 13. Relação com a auditoria (`D-AUD-01`..`D-AUD-08`)

| Item | Situação após este registro |
| --- | --- |
| `D-AUD-01` — catálogo de 24 ações | **INALTERADO.** `usuario.autenticacao`, `usuario.sessao.logout`, `usuario.sessao.revogacao`, `usuario.senha.recuperacao_iniciada`, `usuario.senha.recuperacao_concluida` e `usuario.papeis.alterados` já pertencem ao catálogo. **Nenhuma ação acrescentada** |
| `D-AUD-02` — `SUCESSO`/`NEGADO`/`FALHA` | **INALTERADO.** `D-2.3D-12` usa `FALHA`, valor já homologado |
| `D-AUD-03` — `alvo_tipo` = nome físico da tabela | **INALTERADO.** O alvo da falha de autenticação, quando existe, é `usuario` |
| `D-AUD-04`/`D-AUD-05`/`D-AUD-06` | **INALTERADOS.** Nenhuma ação RC ou SF foi promovida; `L-05`..`L-08` permanecem adiadas |
| `D-AUD-07` — whitelist fail-closed | **NÃO AMPLIADA.** `usuario.autenticacao` mantém whitelist **vazia**; `D-2.3D-12` fixa `contexto = {}`, que é exatamente o que a regra base permite |
| `D-AUD-08` — ownership da validação | **INALTERADO.** A emissão dos eventos de autenticação usará o catálogo tipado e o validator fail-closed já existentes em `apps/api` |

**Declaração expressa:** este documento **não reabre** `docs/09` §12 sob nenhum aspecto.

## 14. Histórico de revisões

| REV. | Data | Alterações |
| --- | --- | --- |
| **4** | 28/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-13` permanecem exatamente como homologadas. Único campo alterado: a linha da fatia **F3** em §9, que passa a **CONCLUÍDA**, por ter sido homologada por Bruno Menezes Noronha em 28/08/2026 após a terceira revisão técnica independente adversarial (veredito `A`). Mesma forma e mesmo precedente das REV. 1 e REV. 2. **Nenhuma pendência de §11 foi alterada ou encerrada**; em particular `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05` e `P-2.3D-06` seguem como estavam, e `R-2.3D-08` permanece registrado em §8 como risco aceito. A evidência da homologação e o rito de integração vivem em `docs/10` §6-I — este documento continua sendo apenas o registro normativo das decisões. |
| **3** | 28/08/2026 | **ACRÉSCIMO DE UMA DECISÃO NOVA — `D-2.3D-13` (§5.13), homologada por Bruno Menezes Noronha.** Nenhuma decisão anterior foi modificada, renumerada, reduzida ou reaberta: `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas em 27/08/2026, e **`D-2.3D-06` em particular está intacta**. **Fundamento:** a segunda revisão técnica independente adversarial da F3 classificou a proteção de concorrência em voo do limitador — registrada pela implementação como decisão local `L-11` — como **decisão comportamental, e não detalhe de implementação**, por três razões medidas: o teto de simultaneidade (5 e 30) foi acoplado ao limite de falhas sem que fonte alguma o fixasse; `Retry-After: 1` não é derivável de fonte homologada; e o `429` transitório é invisível ao contador de falhas, alterando a semântica de `429` que o próprio OpenAPI descreve. A revisão **recusou-se a homologá-la** em nome de Bruno (TLF-BASE-V1 §15) e a devolveu como decisão pendente, com alternativas e recomendação. Bruno homologou a opção recomendada — manter o comportamento como está — e ela passa a ser normativa como `D-2.3D-13`. **`L-11` vira alias histórico.** Acrescentado também o risco `R-2.3D-08` em §8, declarando e aceitando o risco residual de `429` transitório contra usuário legítimo. `D-2.3D-13` foi acrescentada à linha da F3 em §9. Nenhuma pendência de §11 foi alterada. |
| **2** | 27/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas; **`D-2.3D-04` não foi tocada**. Único campo alterado: a linha de acompanhamento de **`R-2.3D-03`** em §8, que passa a **ENCERRADO em 27/08/2026** — mesma forma e mesmo precedente da REV. 1 para `P-2.3D-02`. Fundamento: a F2 produziu a prova que o risco vigiava (`UPDATE` condicional atômico, `GREATEST`, throttle que barra regressão, testes concorrentes contra PostgreSQL real, mutation challenge de last-writer-wins detectado, e `C-01` sem enfraquecimento da proteção) — evidência integral em `docs/10` §6-E.5/§6-E.9/§9. Os limites da evidência (`READ COMMITTED`; PostgreSQL autoritativo compartilhado) ficam registrados como **limites da prova**, não como risco aberto; escrita distribuída/multi-primary está fora da arquitetura vigente e não é antecipada. Nenhuma pendência de §11 foi alterada. |
| **1** | 27/08/2026 | **Atualização exclusivamente FACTUAL — nenhuma decisão modificada.** `D-2.3D-01`..`D-2.3D-12` permanecem exatamente como homologadas em 27/08/2026; nenhum parâmetro, prazo, nome ou regra foi alterado, acrescentado ou removido. Única mudança: em §11, `P-2.3D-02` (benchmark empírico do Argon2id) passa de **ABERTA** a **ENCERRADA**, por ter sido cumprida na F1 — a medição está registrada em `docs/10` §6-D.5 e sustenta a manutenção dos parâmetros de `D-2.3D-02`, que **não é reaberta**. A F1 em si (implementação de `CredencialService`, `argon2@0.45.1`, normalização do login) é registrada em `docs/10` §6-D, não aqui: este documento é normativo, não registro de execução. |
| **0** | 27/08/2026 | Criação. Registro normativo de `D-2.3D-01`..`D-2.3D-12` homologadas por Bruno Menezes Noronha. Execução da fatia **F0**: materialização física exclusiva de `D-2.3D-01` (`sessao_autenticacao.token_hash`, `sessao_autenticacao.ultima_atividade_em`, `ck_sessao_autenticacao_atividade`) na migration `20260827175151_sessao_autenticacao_token_atividade`; atualização de `protected-objects.json` (25 → 26 CHECKs), da Guarda 2 e do golden schema pelo fluxo oficial; testes de aceite/rejeição da CHECK e de NOT NULL. Nenhuma dependência instalada; nenhuma implementação de F1+ iniciada |

---

**Fim — `docs/12-decisoes-autenticacao-autorizacao.md` — `D-2.3D-01`..`D-2.3D-13` registradas; F0 da Etapa 2.3D-B executada em 27/08/2026; `D-2.3D-13` homologada em 28/08/2026.**
