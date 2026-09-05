# Implementação do Backend — TechLab Fisio

> **Arquivo:** `docs/10-backend-implementacao.md`
> **Natureza:** documento **MUTÁVEL** — registro vivo de implementação da frente de backend (`apps/api`)
> **Revisão vigente:** REV. 36 (05/09/2026) — **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DE `L-07` NA `main` (PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23), merge commit `e1459f6`) E DA SPRINT `FRONT-F0` (PR [#24](https://github.com/BrunoMNoronha/techlab-fisio/pull/24), merge commit `80986e7`) — SINCRONIZAÇÃO DOCUMENTAL EXCLUSIVAMENTE FACTUAL.** Nenhuma alteração de código, teste, schema, migration, OpenAPI, dependência ou configuração; nenhuma decisão normativa criada, alterada ou reaberta; nenhum registro histórico reescrito. **`L-07` — INTEGRADA NA `main` em 05/09/2026** (§7.4.8): PR #23 aberta e mesclada por Bruno Menezes Noronha (`BrunoMNoronha`), merge commit `e1459f6` sobre `c4c9ba2`, commit da fatia `62862bf` com CI verde no HEAD da PR (run 33963479328); a decisão `D-6` de `PBACK-AUD-09` registrou a não autorização **no ato da decisão** e é preservada como tal — a publicação é ato posterior do próprio Bruno. **`FRONT-F0` / `apps/web` — INTEGRADA NA `main` em 05/09/2026**: PR #24 mesclada por Bruno, merge commit `80986e7` sobre `e1459f6`, commit `c004f62` com CI verde no HEAD da PR (run 33965553378); `apps/web` passou a existir na `main` como fundação técnica, **sem** funcionalidade de negócio e **sem** integração com `apps/api`; `V-06.c` **APROVADA** (`docs/08` REV. 22–25); `P-2.3D-04` **tecnicamente elegível** para reavaliação, **sem decisão**. `origin/main` = `80986e7`. **Estados preservados:** `AUT-005` NÃO MATERIALIZADA; revogação administrativa de sessão de terceiro (`AUT-002`/`sessoes.revogar_terceiro`) NÃO IMPLEMENTADA; `P-2.3D-04` ABERTA; `P-BACK-01` EM ANDAMENTO; `L-06` ABERTA / BLOQUEADA; `R2.2-04` ABERTO / MITIGADO PARCIALMENTE; `R-BL-03` residual e ABERTO. Atualizados: cabeçalho, §7.1, §7.4 (nota de estado corrente e novo §7.4.8), §9, §10, §11 e rodapé.
> **Estado anterior preservado:** REV. 35 (05/09/2026) — **`P-BACK-01` / `L-07` — AUDITORIA RESTRITA DE NEGAÇÕES DE AUTORIZAÇÃO IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA (`agent/p-back-01-d2-auditoria-decisoes`, a partir de `main` = `origin/main` = `c4c9ba2`) — NÃO INTEGRADA; PUBLICAÇÃO NÃO AUTORIZADA (D-6)** (§7.4). Decisões de Bruno Menezes Noronha sobre o pacote `docs/13` (`D-0a`, `D-1R`, `D-2Q2`, `D-3V0`, `D-4R`, `D-5S`, `D-6` não autorizada) registradas como **`PBACK-AUD-09`** em `docs/09` §13.4.1, preservando `PBACK-AUD-03` e a nota de revisão. **`autorizacao.negada`** homologada como **25ª ação** (whitelist **vazia**; 3 positivas · 22 vazias) e emitida **exclusivamente** pela negação deliberada de **`senha.recuperar_terceiro`** no `PermissoesGuard`, por emissor próprio (`AuditoriaNegacaoAutorizacao`, `authz/`) em **transação dedicada** pelo `AuditWriter` existente; `resultado = NEGADO` (primeiro emissor do valor); ator = usuário da sessão persistida; `alvo_tipo = permissao`, `alvo_id = permissao.id`; contexto vazio; `correlacao_id` novo por negação; **corpo nunca lido**. **Q2:** falha de gravação preserva o `403 ACESSO_NEGADO` e produz log técnico seguro (classe + correlação). **V0:** sem limitação. **`401`, CSRF, `422`, `500`, fiação incorreta, usuário inexistente e outras permissões NÃO emitem.** **Nenhuma migration, alteração de schema, dependência, contrato HTTP ou OpenAPI.** Bateria integral verde no host (§7.4.6). **4 mutation challenges aplicados, 4 detectados, 4 revertidos por hash.** `L-06`, `R2.2-04`, `P-BACK-01` (EM ANDAMENTO) e `AUT-005` **inalterados**; a resposta administrativa à trilha (`AUT-002`/`sessoes.revogar_terceiro`) permanece **não implementada** — risco de V0 aceito e registrado em §9.
> **Estado anterior preservado:** REV. 34 (05/09/2026) — **ETAPA 2.3D-B / F7 (consolidação, revisão independente e rito de integração): EXECUTADA — ETAPA 2.3D ENCERRADA** (§6-Q). **Nenhuma alteração de código, teste, schema, migration, OpenAPI, dependência ou configuração.** A revisão do conjunto integrado F1..F6 e a passagem adversarial sobre 17 hipóteses **não encontraram defeito de código novo**. O achado **`Q-01`** — suposto conflito entre `docs/09` §5 (`usuario.sessao.revogacao`, ator Administrador, "em massa via T-07") e `docs/06` §12.7 (T-07 = recuperação de senha) — foi **RESOLVIDO** pela governança de `docs/09`, que declara §§1..11 "insumo decisório histórico, **sem valor normativo próprio**", com §12 prevalecendo e `D-AUD-01` homologando **apenas os 24 nomes de ações**; **`docs/09` NÃO foi alterado**. **`L-F6-06` PROMOVIDA a `D-2.3D-18`** (`docs/12` §5.18), restrita à T-07, por **eliminação** das alternativas e sem alteração de código; **`L-F6-07` mantida como decisão local**, com a metade não inequívoca registrada como **`Q-02`** (não bloqueante). Bateria integral verde no host: `typecheck` 0; `build` 0; `test:api` **24 · 595**; `verify:api-integration` **10 · 384 + 2 pulados**; `test:integration`/`verify:from-scratch` **10 · 87**; OpenAPI **19/19**; Argon2, `smoke:api`, `lint:migrations` (10 · 37) e `schema:verify` (golden 60 169 bytes; `migrate diff` 0) verdes. **`P-2.3D-03` ENCERRADA**; baseline de §3 corrigida. Matriz normativa sem item `SEM PROVA` ou `INCONSISTENTE`; **dois `PARCIAL` declarados** — AUT-002 e AUT-003, ambos **escopo não atribuído**, não defeito. **F0..F7 CONCLUÍDAS; `D-2.3D-01`..`D-2.3D-18` vigentes.** AUT-005 permanece NÃO MATERIALIZADA; `P2.2-05`, NÃO INICIADA.
> **Estado anterior preservado:** REV. 29 (02/09/2026) — **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F5 NA `main`** (§6-O.8). Registro **exclusivamente factual**, no precedente `MEDIR → REGISTRAR` das REV. 10, REV. 15, REV. 20 e REV. 24: **nenhuma decisão normativa criada, alterada, renumerada ou reaberta; `D-2.3D-14` e `D-2.3D-15` intactas; `docs/09` §12 não reaberto; Base Imutável intacta; nenhuma linha de runtime, persistência ou dependência tocada.** **ETAPA 2.3D-B / F5 (seed de papéis/permissões + bootstrap do primeiro Administrador): CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** — commits `f4b3015` (implementação + testes), `11612b4` (documentação) e `39ad197` (correção de harness de teste após incidente de CI), PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18), merge commit **`657676b`** sobre a baseline `9140620` (merge commit; sem squash, sem rebase, sem force-push), em 02/09/2026 20:45:16Z. **Incidente de CI registrado e corrigido antes do merge:** a primeira run ([33679640038](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33679640038)) passou em todas as 329 provas de integração, mas falhou no `globalTeardown` (`DROP DATABASE ... WITH (FORCE)` como `tlf_migrator` contra uma conexão `tlf_app` ainda viva da suíte do CLI); causa reproduzida de forma determinística no host e corrigida com `afterAll(() => cliente.$disconnect())` — **somente harness de teste**. CI do HEAD integrado **verde** (run [33680739691](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33680739691), 3m24s) e validação integral **pós-merge verde sobre a `main` integrada**: `typecheck` 0; `build` 0; `test:api` **21 · 526**; `verify:api-integration` **9 · 327 + 2 pulados** (sinais POSIX; **329/329 no Linux da CI**); `test:integration` **10 · 87**; `verify:from-scratch` **10 · 87**; `smoke:api` 0; Argon2 runtime **15/15**; OpenAPI runtime **17/17**; Guardas 1–3; golden byte a byte **60 169 bytes**. **Zero drift; zero migration nova; zero dependência nova** (`git diff 9140620 657676b -- packages/database` = 0 linhas; manifests da raiz inalterados; `apps/api/package.json` +4 scripts). `docs/12` recebeu a REV. 7, **exclusivamente factual** (linha da F5 em §9 → CONCLUÍDA). **Pendências vivas preservadas:** AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA e sem fatia atribuída; RN-001 não satisfeita; `P2.2-05` NÃO INICIADA; `R2.2-04` e `P-2.3D-03` com estado vigente preservado; `F5H-03`..`F5H-07` em aberto; risco médio de bloqueio administrativo sem via de recuperação (§6-N.6) mantido. **F6 permanece NÃO INICIADA.** Nenhum deploy, tag ou release.
> **Estado anterior preservado:** REV. 28 (01/09/2026) — **SEGUNDA FATIA CORRETIVA DA F5, PÓS-HOMOLOGAÇÃO TÉCNICA; FATIA NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-O). A revisão técnica independente e adversarial sobre a árvore corrigida devolveu **`B — APTA COM RESSALVAS NÃO BLOQUEANTES`** (0 BLOQUEANTES, 0 ALTOS), reproduziu todas as medições da REV. 27 e provou por mutação a eficácia do advisory lock. As duas ressalvas foram tratadas, e **somente** elas: **`F5H-01`** — as asserções de §6-N que ainda negavam a existência de `D-2.3D-14` e a alteração de `docs/12` foram **datadas e retificadas**, sem reescrever §6-M, que é registro histórico; **`F5H-02`** — o comando composto `provisionar` ganhou **regressão automatizada** (7 provas novas, processos reais contra PostgreSQL 18), incluindo a prova de que `provisionar --estrito` sobre banco divergente termina em **saída 3 com o bootstrap NÃO executado**, validada por **dois mutantes, ambos mortos**. **Nenhuma decisão normativa criada, alterada ou reaberta; `docs/12` NÃO foi tocado nesta rodada; `src/` intocado; nenhuma dependência nova.** Medições: typecheck e build verdes; `test:api` **21 · 526** (inalterado); integração da API **9 suítes · 327 aprovados + 2 sinais POSIX pulados** (era 320 + 2); persistência/from-scratch **10 · 87**; Argon2 **15/15**; OpenAPI **17/17**; Guardas 1–3 e golden **60 169 bytes**; smoke ESM real verde; zero resíduo descartável. Sem commit, push, PR, merge, tag, release ou deploy. **Próximo passo: decisão de Bruno sobre a homologação da fatia e, somente após autorização própria, versionamento/integração.**
> **Estado anterior preservado:** REV. 27 (01/09/2026) — **DECISÕES NORMATIVAS DA F5 HOMOLOGADAS E CORREÇÕES OBJETIVAS REMEDIDAS; FATIA NÃO INTEGRADA.** Por autorização expressa de Bruno Menezes Noronha, `D-2.3D-14` fixa o seed RBAC aditivo e convergente — inclusive em `--estrito`, que aplica/completa a matriz canônica, preserva excedentes e termina com saída 3 — e `D-2.3D-15` fixa `ator_usuario_id = NULL` no bootstrap inaugural, sem identidade sintética, com justificativa operacional obrigatória. Corrigidos o contrato textual que prometia incorretamente modo estrito somente leitura e o rodapé vivo desatualizado; acrescentada regressão de banco simultaneamente parcial e divergente. Medições desta árvore: typecheck e build verdes; `test:api` **21 suítes · 526**; integração da API no host Windows **9 suítes · 320 aprovados + 2 sinais POSIX pulados**; persistência/from-scratch **10 · 87**; Argon2 **15/15**; OpenAPI **17/17**; Guardas 1–3 e golden **60 169 bytes**; smoke ESM real verde; zero resíduo descartável. Sem commit, push, PR, merge, tag, release ou deploy. **Próximo passo: homologação técnica final da árvore exata e, somente após autorização própria, versionamento/integração.**
> **Status:** backend **EM CONSTRUÇÃO** — Etapa 2.3A **CONCLUÍDA/HOMOLOGADA/INTEGRADA** (REV. 2); Etapa 2.3B **CONCLUÍDA/HOMOLOGADA/INTEGRADA NA `main`** (revisão independente veredito B; correções `F-REV-01`/`F-REV-02` aplicadas — REV. 4; integração por merge commit `5aae8de`, PR [#5](https://github.com/BrunoMNoronha/techlab-fisio/pull/5), 27/08/2026 — registro pós-medição em §11, REV. 5) — provider de persistência + primeiro fluxo transacional real de auditoria (`profissional.situacao.alterada`, fatia técnica INTERNA, sem endpoint/RBAC)
> **Estado anterior preservado:** REV. 26 (29/08/2026) — **ETAPA 2.3D-B / F5 CORRIGIDA E REMEDIDA APOS DUAS REVISOES TECNICAS INDEPENDENTES ADVERSARIAIS (veredito consolidado `C — NAO APTO`); permanece NAO HOMOLOGADA / NAO INTEGRADA** (§6-N). Mesma baseline `main` = `origin/main` = `9140620`, mesma branch, mesma working tree nao commitada. Publicacao **nao autorizada**: sem commit, push, PR, merge, tag, release ou deploy. **Achado ALTO corrigido:** as revisoes reproduziram, em processos CLI reais contra PostgreSQL real sob `READ COMMITTED`, **DOIS "primeiros Administradores" criados simultaneamente, ambos com saida 0** — a verificacao era TOCTOU e a PK `(usuario_id, papel_id)` nao impede identidades distintas. A correcao serializa o provisionamento com **advisory lock transacional unico** (`pg_advisory_xact_lock(2337, 5)`) adquirido antes de qualquer leitura decisoria, com releituras sob o lock e o digest Argon2 fora da transacao — **sem migration e sem dependencia nova**. **Demais correcoes:** divergencias do seed deixam de ser silenciosas (deteccao, relato e `--estrito` com saida 3, sempre nao destrutivo); `TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA` **obrigatoria** na trilha de auditoria, sem ampliar a whitelist e sem inventar ator; fronteira de erros do CLI fechada; senha recusa caractere de controle e tem precedencia deterministica; `SIGINT`/`SIGTERM` tratados; contextos de seed e bootstrap separados, com o bootstrap importado **dinamicamente** — e por isso **`seed` funciona com o Argon2 indisponivel**, provado com sabotador e controle positivo. **Retificacao factual:** a afirmacao de §6-M.5 de que os agrupamentos de linhas eram "sem efeito" **era falsa** para "Ver observacao administrativa" — efeito medido **37 x 38 associacoes (Fisioterapeuta 8 x 9)** —, e esta corrigida. **A matriz NAO mudou:** 4 papeis, 29 permissoes, 37 associacoes, 18/3/8/8. **Nenhuma decisao normativa criada, alterada ou reaberta; `docs/12` NAO foi tocado; nenhuma `D-2.3D-14`; catalogo e whitelist de auditoria NAO ampliados; Base Imutavel intacta.** **Medicoes — bateria INTEGRALMENTE VERDE nos DOIS ambientes:** conteiner Linux isolado — `test:api` **21 · 526**, integracao da API **9 · 321**, Argon2 15/15, OpenAPI 17/17; host Windows — `test:api` **21 · 526**, `verify:api-integration` **9 · 319 + 2 pulados**, persistencia **10 · 87**, from-scratch **10 · 87**, Argon2 15/15, OpenAPI 17/17, **`smoke:api` 0**, Guardas 1-3, golden **60 169 bytes**. **MUDANCA DE AMBIENTE registrada:** o bloqueio de Application Control do addon Argon2 **deixou de ocorrer no host** (arquivo ainda `NotSigned`; carregamento medido 3/3) — **nenhuma politica da maquina foi alterada por esta execucao**; com isso `smoke:api` e as verificacoes de runtime, antes NAO EXECUTADOS, passaram a ser medidos e estao verdes. Os **2 casos pulados** no host sao as provas de `SIGINT`/`SIGTERM`, **puladas explicitamente** porque sinais POSIX nao existem no Windows; elas **passam no Linux** (alvo real; CI em `ubuntu-latest`). **Ressalva honesta:** uma execucao isolada de `test:api` no conteiner acusou 525/526; a falha **nao se reproduziu em 7 execucoes** e fica registrada como **transitorio nao identificado** (§6-N.11). **Zero drift; 10 migrations; nenhuma dependencia nova; nenhuma rota nova.** **DUAS DECISOES PERMANECEM RESERVADAS A BRUNO:** a literalidade de `D-2.3D-09` diante de um seed aditivo (§6-N.3) e a qualificacao de um bootstrap manual como "acao de sistema" para `ator_usuario_id = NULL` (§6-N.4). **AUT-005 NAO MATERIALIZADA / NAO ENCERRADA e sem fatia atribuida; RN-001 nao satisfeita; `P2.2-05` NAO INICIADA; F6 NAO INICIADA.** Proximo passo: **NOVA revisao tecnica independente e adversarial sobre a arvore corrigida**. Estado anterior preservado: REV. 25 (29/08/2026) — **ETAPA 2.3D-B / F5 (seed de papéis/permissões + bootstrap do primeiro Administrador) IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA (`agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`), a partir de `main` = `origin/main` = `9140620` — NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-M). Publicação **não autorizada** nesta execução: sem commit, push, PR, merge, tag, release ou deploy. `D-2.3D-09` e `D-2.3D-10` materializadas: seed **idempotente** dos **4** papéis de `docs/04` §3, das **29** permissões de §5 (por REÚSO do catálogo tipado da F4 — nenhum catálogo paralelo) e das **37** associações derivadas célula a célula da matriz de §4 por **regra de derivação declarada** e executada pelo próprio teste, que lê o documento do disco; bootstrap **manual** (o `AppModule` não resolve os serviços — provado), **idempotente**, **fail-closed**, **atômico** e auditado com **`usuario.papeis.alterados`** (`SUCESSO`, `alvo_tipo = usuario`, `contexto` vazio, `ator_usuario_id` **NULL** como **ação de sistema**, por `docs/07` §22.3/RN-061 e precedente de `D-2.3D-12`). **Nenhuma decisão foi criada, alterada, renumerada ou reaberta; `docs/12` NÃO foi tocado; `D-2.3D-09` e `D-2.3D-10` intactas; nenhuma `D-2.3D-14`; `docs/09` §12 não reaberto; `ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` não ampliadas; Base Imutável intacta.** Matriz semeada: Administrador **18** (zero `prontuario.*` — PERM-T01, e **não** as 29), Gestor **3** somente leitura (**HOM-01** preservado), Recepcionista **8**, Fisioterapeuta **8**; **8 das 29** permissões sem papel algum, todas `P` na fonte. Sete decisões locais declaradas (`L-F5-01`..`L-F5-07`), das quais **`L-F5-03` (conflito de Administrador preexistente)** fica **DESTACADA PARA A REVISÃO INDEPENDENTE**. Bateria: `test:api` **21 · 519** (era 19 · 479); integração da API **8 · 273** (era 7 · 239); persistência **10 · 87**; Argon2 runtime **15/15**; OpenAPI runtime **17/17**; Guardas 1–3; golden **60 169 bytes** byte a byte. **13 mutation challenges aplicados, 13 detectados, 13 revertidos** com prova por SHA-256. **Zero drift** (`git diff main -- packages/` = 0 linhas; 10 migrations continuam 10); **nenhuma dependência nova**; **nenhuma rota nova**. **LIMITAÇÃO DE AMBIENTE declarada, preexistente e alheia à F5:** uma política de **Application Control** da máquina local bloqueou o addon nativo não assinado do Argon2, derrubando **no host** `test:api` (5 de 21 suites, **4 intocadas pela fatia**), `verify:api-integration`, `verify:argon2-runtime`, `verify:openapi-runtime` e **`smoke:api`**; tudo que depende de Argon2 foi **medido em contêiner Linux** com `npm ci` limpo e PostgreSQL 18 real, e **nenhuma configuração de segurança da máquina foi alterada**. **AUT-005 permanece NÃO MATERIALIZADA / NÃO ENCERRADA e SEM FATIA ATRIBUÍDA**; **RN-001** não é declarada satisfeita; **`P2.2-05` NÃO INICIADA**; `R2.2-04` e `P-2.3D-03` com estado vigente preservado; **F6 NÃO INICIADA**. Próximo passo: **revisão técnica independente e adversarial da F5**. Estado anterior preservado: REV. 24 (28/08/2026) — **REGISTRO POS-MEDICAO DA INTEGRACAO DA ETAPA 2.3D-B / F4 NA `main`** (§6-L.8). Registro **exclusivamente factual**, no precedente `MEDIR -> REGISTRAR` das REV. 10, REV. 15 e REV. 20: **nenhuma decisao normativa criada, alterada, renumerada ou reaberta; nenhuma `D-2.3D-14`; `docs/12` NAO foi alterado; `docs/09` §12 nao reaberto; Base Imutavel intacta; nenhuma linha de runtime, teste, persistencia ou dependencia tocada.** **ETAPA 2.3D-B / F4 (guards e decorators de autorizacao — RBAC): CONCLUIDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** — commit da fatia `ea8c74d`, PR [#16](https://github.com/BrunoMNoronha/techlab-fisio/pull/16), merge commit **`fce62d9`** sobre a baseline `a9be742` (merge commit; sem squash, sem rebase, sem force-push). CI do PR **verde** (run [33222908307](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33222908307), 2m26s) e validacao integral **pos-merge verde sobre a `main` integrada**: `typecheck` 0; `test:api` **19 · 479**; `verify:api-integration` **7 · 239**; `verify:from-scratch` **10 · 87**; `build` 0; `smoke:api` 0; Argon2 runtime **15/15**; OpenAPI runtime **17/17**; Guardas 1-3; golden byte a byte **60 169 bytes**. **Zero drift; zero migration nova; zero dependencia nova** (`git diff a9be742 fce62d9 -- packages/database` = 0 linhas; manifests inalterados). **Pendencias vivas preservadas: AUT-005 NAO MATERIALIZADA / NAO ENCERRADA** e sem fatia atribuida; **RN-001** aplicavel e nao satisfeito fora do alcance parcial da `PermissoesGuard`; **`P2.2-05`** (autorizacao clinica contextual) **NAO INICIADA**; `R2.2-04` **ABERTO / MITIGADO PARCIALMENTE**; `P-2.3D-03` **MEDIDA E VERDE, encerramento formal PENDENTE**. **F5 e F6 permanecem NAO INICIADAS.** Nenhum deploy, tag ou release. Estado anterior preservado: REV. 23 (28/08/2026) — **ETAPA 2.3D-B / F4 (guards e decorators de autorização — RBAC) HOMOLOGADA POR BRUNO MENEZES NORONHA; APTA AO RITO DE VERSIONAMENTO/INTEGRACAO** (§6-L). Homologada sobre a MESMA baseline `main` = `origin/main` = `a9be742`, na branch `agent/fase2-etapa2.3d-f4-rbac`, apos a **segunda** revisao tecnica independente adversarial devolver **`A — APTO A HOMOLOGACAO E VERSIONAMENTO`** com **0 BLOQUEANTES, 0 ALTOS, 0 MEDIOS** e **1 BAIXO documental (`R4R2-01`)**. **`R4R2-01` corrigido nesta execucao e EXCLUSIVAMENTE documental** (§6-K.6): `apps/api/src/authz/` tem **798 linhas em 9 arquivos** na arvore corrigida; as **745 em 8 arquivos** ficam preservadas como valor **historico** da arvore pre-correcao. **Nenhuma linha de runtime ou de teste foi alterada** — manifesto SHA-256 dos 14 arquivos de runtime/teste identico ao conferido pela revisao. **Nenhuma decisao normativa criada, alterada ou reaberta; `D-2.3D-09` intacta; nenhuma `D-2.3D-14`; Base Imutavel intacta.** `R4-01`..`R4-08` confirmados por evidencia independente; **15 mutation challenges independentes, 15 detectados, 15 revertidos por hash**. Bateria independente verde: `test:api` **19 · 479**; `verify:api-integration` **7 · 239**; `verify:from-scratch` **10 · 87**; Argon2 runtime **15/15**; OpenAPI runtime **17/17**; Guardas 1-3; golden **60 169 bytes**. **Zero drift; zero migration; zero dependencia nova.** **AUT-005 permanece NAO MATERIALIZADA / NAO ENCERRADA**; autorizacao clinica contextual (`P2.2-05`) **NAO INICIADA**; **F5 e F6 NAO INICIADAS**. Nenhum deploy, tag ou release. O registro factual do merge pertence a execucao documental posterior (`MEDIR -> REGISTRAR`). Estado anterior preservado: REV. 22 (28/08/2026) — **ETAPA 2.3D-B / F4 CORRIGIDA APOS REVISAO TECNICA INDEPENDENTE ADVERSARIAL (veredito `B — APTO COM CORRECOES OBJETIVAS`); permanece NAO HOMOLOGADA / NAO INTEGRADA** (§6-K). Mesma baseline `a9be742`, mesma branch, mesma working tree nao commitada. **Nenhuma decisao normativa criada, alterada ou reaberta; `docs/12` NAO foi tocado; `D-2.3D-09` intacta; nenhuma `D-2.3D-14`.** **Corrigidos:** `R4-01` — a identidade validada pelo `SessaoService` passa a SOBRESCREVER qualquer contexto preexistente (a revisao mediu que um contexto semeado prevalecia e a guard decidia sobre ele), e o limite do modelo de confianca passou a ser declarado; `R4-03`/`R4-04` — o decorator plural foi **substituido** por **`@RequerPermissao(P)`**, singular, somente metodo, que INSTALA `SessaoAutenticadaGuard` + `PermissoesGuard` na ordem, tornando declarar-sem-proteger inexpressavel e eliminando a superficie de classe/heranca que podia reduzir exigencia. **`L-F4-01` ENCERRADA POR ELIMINACAO** — nao por decisao normativa: nenhuma operacao de `docs/04` §4/§8 exige duas permissoes, logo a composicao era abstracao antecipada e nao ha `AND`/`OR` a homologar. **`R4-02` retificado sem mudar comportamento:** a cobertura do usuario inativo e **PARCIAL** (defesa em profundidade apenas sob a `PermissoesGuard`); **AUT-005 permanece NAO MATERIALIZADA / NAO ENCERRADA** e RN-001 segue aplicavel, com linha propria em §9. **BAIXOS** `R4-05`..`R4-08` retificados. Bateria integral verde (`test:api` **19 · 479**; integracao **7 · 239**; from-scratch 87; Guardas 1–3; runtime 15/15 e 17/17); **9 mutation challenges detectados e revertidos por hash**; **zero drift**; **nenhuma dependencia nova**; F5/F6 nao iniciadas. Proximo passo: **NOVA revisao independente adversarial sobre a arvore corrigida**. Estado anterior preservado: REV. 21 (28/08/2026) — **ETAPA 2.3D-B / F4 (guards e decorators de autorização — RBAC) IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA (`agent/fase2-etapa2.3d-f4-rbac`), a partir de `main` = `origin/main` = `a9be742` — NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-J). Publicação **não autorizada** nesta execução: sem commit, push, PR, merge, tag, release ou deploy. `D-2.3D-09` e a parte de RBAC de `AUT-003` materializadas: catálogo **tipado** dos 29 identificadores de `docs/04` §5 (materialização, não catálogo paralelo — provado por comparação mecânica contra o documento), resolução das permissões efetivas por **união** dos papéis, decorator declarativo `@RequerPermissoes(...)`, `PermissoesGuard` (`403`) e `SessaoAutenticadaGuard` (`401`), que **consome** a autenticação vigente sem substituí-la. **Nenhuma decisão foi criada, alterada, renumerada ou reaberta; `docs/12` NÃO foi tocado; `docs/09` §12 não foi reaberto; a Base Imutável permanece intacta.** Identidade não controlável pelo cliente (contexto sob símbolo privado); `401` e `403` não se confundem; falha técnica **não** é maquiada como negação. **Nenhuma rota de produção foi protegida — e nenhuma podia ser**, pois as três publicadas não têm permissão exigida pela matriz de `docs/04` §4; a guard é provada por integração sobre **controller exclusivamente de teste**, e as rotas publicadas continuam sendo exatamente `/health`, `/auth/login` e `/auth/logout`. Cinco decisões locais declaradas (`L-F4-01`..`L-F4-05`), das quais **`L-F4-01` — semântica de composição de múltiplas permissões — fica PENDENTE DE DECISÃO DE BRUNO** (adotada a conjunção, alternativa conservadora sob lacuna de fonte). Bateria integral verde (`test:api` **19 suites · 479**; integração **7 suites · 239**; from-scratch 87; Guardas 1–3; runtime Argon2 15/15 e OpenAPI 17/17); **13 mutation challenges detectados e revertidos com prova por hash**; **zero drift** de `packages/database` (10 migrations, hashes idênticos); **nenhuma dependência nova**. **F5 e F6 permanecem NÃO INICIADAS**; autorização clínica contextual (`P2.2-05`) permanece fora. Próximo passo: **revisão técnica independente e adversarial da F4**. Estado anterior preservado: REV. 20 (28/08/2026) — **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F3 NA `main`.** Registro **exclusivamente factual**, no precedente MEDIR → REGISTRAR das REV. 10 e REV. 15: **nenhuma decisão foi criada, alterada ou reaberta** e **nenhuma medição histórica foi reescrita**. Estado: **Etapa 2.3D-B / F3 CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** — PR [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14), HEAD homologado e corrigido `c20cf1c`, **merge commit `35569727789f6f73b4f81fec3cc94c34d4cb0038`**; a `main` passou de `9a22262` para `3556972`. A CI do PR ficou **verde sobre o HEAD integrado**, com **206 provas de integração** (as 203 anteriores mais 3 regressões do harness), depois de uma correção de portabilidade restrita ao cliente HTTP dos testes (§6-I.8) — **sem nenhuma alteração de runtime, contrato ou persistência**. Validação local pós-merge integralmente verde; **zero drift** de `packages/database`; 10 migrations. **F4, F5 e F6 permanecem NÃO INICIADAS**; deploy, tag e release não foram realizados. Estado anterior preservado: REV. 19 (28/08/2026) — **Etapa 2.3D-B / F3 HOMOLOGADA por Bruno Menezes Noronha e submetida ao rito de versionamento e integração** (§6-I). A **terceira** revisão técnica independente adversarial devolveu **`A — APTO À HOMOLOGAÇÃO E VERSIONAMENTO`**, sem nenhum achado BLOQUEANTE, ALTO ou MÉDIO, tendo reproduzido de forma independente as correções `F3R-01` e `F3R-03` (29 variantes de request-target com zero incoerências entre roteador e filtro; oito propriedades do iterador de `Map` sob mutação; saturação a 50 000 buckets). Único achado, **`F3R-08` (BAIXO)** — a tabela viva de §9 ainda rotulava `L-11` como decisão local —, **corrigido nesta revisão**: a linha passa a apontar **`D-2.3D-13`** como fonte normativa e `L-11` como alias histórico. **Nenhuma decisão `D-2.3D-*` foi alterada ou reaberta.** Riscos residuais aceitos e registrados: `R-2.3D-08`, `F-12`, `F3R-06`, `F3R-07`. Bateria integral verde; zero drift; F4/F5/F6 não iniciadas. Estado anterior preservado: REV. 18 (28/08/2026) — **Etapa 2.3D-B / F3 CORRIGIDA PELA SEGUNDA VEZ, após a segunda revisão técnica independente adversarial (veredito `B — APTO COM CORREÇÕES OBJETIVAS`); permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-H). A segunda revisão **confirmou por reprodução própria** que `F-01`, `F-04` e `F-05` estão de fato corrigidos, e não encontrou achado BLOQUEANTE ou ALTO. Corrigidos agora: `F3R-01` (MÉDIO — request-target *absolute-form* reabria o vazamento do parser e o log de ERRO acionável sem autenticação), `F3R-03` (MÉDIO — inanição da amostragem de despejo ancorada na cabeça do `Map`, medida em 2 000/2 000 recusas), `F3R-04` e `F3R-05` (BAIXOS, documentais). **`F3R-02` foi resolvido por DECISÃO DE BRUNO**: `L-11` passou a norma como **`D-2.3D-13`** em `docs/12` REV. 3 — acréscimo de decisão nova, **sem alterar, renumerar ou reabrir `D-2.3D-01`..`D-2.3D-12`**. `F3R-06`, `F3R-07` permanecem OBSERVAÇÃO não tratada e `F-12` permanece BAIXO aceito. Bateria integral verde (`test:api` 437; integração 203); 3 mutation challenges novos (`C-18`..`C-20`) detectados e revertidos; zero drift; F4/F5/F6 não iniciadas. Próximo passo: **nova revisão independente adversarial**. Estado anterior preservado: REV. 17 (28/08/2026) — **Etapa 2.3D-B / F3 CORRIGIDA após revisão técnica independente adversarial (veredito `B — APTO COM CORREÇÕES OBJETIVAS`); permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-G). Doze dos catorze achados corrigidos, `F-07` resolvido por consequência e `F-12` mantido BAIXO com racional. Destaques: o gate de `D-2.3D-06` passou a valer sob **concorrência** (reserva de tentativa em voo — `F-01`, ALTO); `TLF_AMBIENTE` tornou-se **obrigatória**, fechando o cenário principal de `R-2.3D-04` (`F-02`); o **rehash** exigido por `D-2.3D-02` foi materializado no login com escrita condicionada ao digest verificado (`F-04`); o despejo do limitador deixou de sacrificar bloqueios vigentes (`F-05`); erro 4xx do parser deixou de virar `500` (`F-03`). **Nenhuma decisão `D-2.3D-*` alterada; `docs/12` intocado.** Bateria integral verde; 17 mutation challenges detectados e revertidos; zero drift; F4/F5/F6 não iniciadas. Próximo passo: **nova revisão independente adversarial**. Estado anterior preservado: REV. 16 (27/08/2026) — **Etapa 2.3D-B / F3 (endpoints REST de autenticação) IMPLEMENTADA E MEDIDA em branch própria (`agent/fase2-etapa2.3d-f3-auth-http`), a partir de `main` = `9a22262` — NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-F). Publicação **não autorizada** nesta execução: sem commit, push, PR, merge, tag ou deploy. `D-2.3D-06`, `D-2.3D-07`, `D-2.3D-11` e `D-2.3D-12` materializadas; **nenhuma decisão foi criada, alterada ou reaberta** e **`docs/12` não foi tocado**. `P-2.3D-03` **medida e verde** pelo Caminho A (`@nestjs/swagger@11.4.7` compatível com ESM/`nodenext`), com encerramento formal deixado a decisão de Bruno. `T-AUTH-ENUMERATION` provado estruturalmente; `R-2.3D-04` protegido por fail-fast testado em três níveis; 14 challenges de mutação detectados e revertidos; bateria integral verde; zero drift de persistência. Estado corrente: **F0, F1 e F2 INTEGRADAS; F3 IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA, NÃO INTEGRADA; F4/F5/F6 NÃO INICIADAS**. Próximo passo: **revisão técnica independente adversarial da F3**. Estado anterior preservado: REV. 15 (27/08/2026) — **registro pós-medição da INTEGRAÇÃO da Etapa 2.3D-B / F2 na `main`**: commit da fatia `289a94b`, PR [#12](https://github.com/BrunoMNoronha/techlab-fisio/pull/12), **merge commit `70b30aebf09368200343d6a5672b267811f337ee`**; `main` passou de `f4c2466` para `70b30ae`. CI verde no PR e na `main` pós-merge; bateria local pós-merge integralmente verde; zero drift de persistência. Registro **exclusivamente factual** — nenhuma decisão criada, alterada ou reaberta. Estado corrente: **F0, F1 e F2 INTEGRADAS; F3 — endpoints REST de autenticação NÃO INICIADA**. Estado anterior preservado: REV. 14 (27/08/2026) — **F2 HOMOLOGADA por Bruno Menezes Noronha** (TLF-BASE-V1 §15, item 1) e **`R-2.3D-03` ENCERRADO NA F2** (§9): o risco sai de aberto porque a obrigação de monotonicidade atômica de `D-2.3D-04` foi materializada e provada — `UPDATE` condicional atômico, `GREATEST`, predicado de throttle que também barra atividade regressiva, testes concorrentes contra PostgreSQL real, mutation challenge de last-writer-wins detectado, e confirmação de que `C-01` não enfraqueceu a proteção. **`D-2.3D-04` NÃO foi alterada e nenhuma decisão normativa nova foi criada.** Os limites da evidência (`READ COMMITTED`, PostgreSQL autoritativo compartilhado) permanecem registrados como **limites da prova**, não como risco aberto. Esta REV. acompanha o **rito de versionamento e integração da F2**. Estado anterior preservado: REV. 13 (27/08/2026) — Etapa **2.3D-B / F2 (`SessaoService`) REVISADA DE FORMA INDEPENDENTE, CORRIGIDA E REMEDIDA — permanece NÃO INTEGRADA** (§6-E.9): revisão adversarial com veredito **`B — APTO COM CORREÇÕES OBJETIVAS`**; correções obrigatórias **`C-01`** (achado `A-01` — logout que podia informar encerramento deixando a sessão `ATIVA` e utilizável) e **`C-02`** (precisão documental do `verify:argon2-runtime`) aplicadas, com teste de regressão determinístico contra PostgreSQL real. Nenhuma decisão normativa criada ou reaberta; `docs/12` e a Base Imutável **não foram tocados**. `R-2.3D-03` permanece **MITIGADO**, com encerramento **pendente de decisão de Bruno**. Publicação continua **não autorizada**: sem commit, push, PR, merge, tag ou deploy. Estado corrente: **F1 INTEGRADA; F2 CORRIGIDA E MEDIDA EM BRANCH PRÓPRIA, NÃO INTEGRADA; F3 NÃO INICIADA**. Estado anterior preservado: REV. 12 (27/08/2026) — **duas atualizações, uma factual e uma de execução.** (1) **Correção factual:** a Etapa **2.3D-B / F1 (`CredencialService` / Argon2id) foi INTEGRADA NA `main`** por merge commit `f4c246648e436c3a50121c371147768bd8403657`, PR [#11](https://github.com/BrunoMNoronha/techlab-fisio/pull/11) (commit da fatia: `f642b6259b0c916b42d8f8bc77d25258592805a6`) — a REV. 11 a registrava como "não integrada" porque a publicação ainda não havia ocorrido àquela altura; nenhuma decisão foi alterada por esta correção. (2) **Execução:** Etapa **2.3D-B / F2 (`SessaoService`) IMPLEMENTADA E MEDIDA em branch própria (`agent/fase2-etapa2.3d-f2-sessao`), NÃO INTEGRADA** (§6-E): publicação não autorizada nesta execução — sem commit, push, PR, merge, tag ou deploy. Estado anterior preservado: REV. 10 (27/08/2026) — Etapa **2.3D-B / F0 CONCLUÍDA/HOMOLOGADA/INTEGRADA NA `main`** (merge `f612fa7`, PR [#9](https://github.com/BrunoMNoronha/techlab-fisio/pull/9)): decisões `D-2.3D-01`..`D-2.3D-12` registradas em **`docs/12`** e única reabertura física controlada da persistência (`sessao_autenticacao`: +2 colunas, +1 CHECK). Etapa 2.3C permanece **CONCLUÍDA/HOMOLOGADA/INTEGRADA** (merge `58a6e4b`, PR [#7](https://github.com/BrunoMNoronha/techlab-fisio/pull/7) — REV. 9). `R2.2-04` permanece **ABERTO / MITIGADO PARCIALMENTE** (§7.2); ressalvas `F-2.3C-REV-02`/`F-2.3C-REV-03` preservadas sem correção (§9). Estado corrente: **F1 INTEGRADA; F2 IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA, NÃO INTEGRADA; F3 — endpoints REST de autenticação NÃO INICIADA**

---

## 0. Status e autoridade documental

Este documento é o **registro vivo autoritativo da frente de backend** para: estado de implementação, verificações executadas e pendências transferidas (`P-BACK-01`, `R-BL-02`, `R2.2-04`, `T-AUD-CONTEXTO`, `L-05`..`L-08`, `P2.2-05`).

Hierarquia preservada, em ordem:

1. autorização explícita e atual de **Bruno Menezes Noronha**;
2. `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — **superior a este documento**; não é alterada por ele;
3. decisões homologadas: `docs/08` permanece a **baseline técnica** e o registro da persistência da Fase 2 (REV. 20; handoff editorial na REV. 21) — encerrada em 26/08/2026 e **reaberta uma única vez**, de forma controlada, pela decisão `D-2.3D-01` (`docs/12` §5.1; ver REV. 10 em §11); `docs/09` **§12** permanece a **fonte normativa exclusiva** de `D-AUD-01`..`D-AUD-08`; `docs/11` permanece a fonte de `PROP-RN-2.3C-01`; **`docs/12` é a baseline normativa da Etapa 2.3D** (`D-2.3D-01`..`D-2.3D-12`);
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
| `docs/11` | `PROP-RN-2.3C-01` — regra de aplicação de desconto (FIN-003) que desbloqueou a Etapa 2.3C |
| **`docs/12`** | **Baseline normativa da Etapa 2.3D** — `D-2.3D-01`..`D-2.3D-18`: persistência de sessão, hash de senha, normalização do login, política de sessão, estados terminais, anti-abuso, cookie/CSRF, recuperação de senha, RBAC inicial, primeiro Administrador, OpenAPI e auditoria de autenticação. **Somente `D-2.3D-01` teve efeito físico até aqui**; `D-2.3D-02`..`12` produzem efeito nas fatias F1..F7. Este documento **referencia** `docs/12`, não o duplica nem o reinterpreta |

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

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** (revisão técnica independente, veredito **B — apto após correções pontuais**; correções `F-REV-01`/`F-REV-02` aplicadas e re-medidas — REV. 4; homologação no HEAD `a96a328`; integração por merge commit `5aae8de` em 27/08/2026 — §11, REV. 5). Escopo executado conforme autorização própria da 2.3B; **zero mudança física de persistência** (schema, migrations, golden e `protected-objects.json` byte a byte idênticos à baseline `b84ae6a` — diff vazio medido).

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

Guardas 1/2/3, from-scratch, golden byte a byte, `migrate diff --exit-code`, build ESM e F-01 **preservados** (F-01 atualizado para o novo caminho `dist/src/index.js` + fábrica). Passos **acrescentados**: `verify:api-integration` (instância PostgreSQL 18 descartável fail-closed → suíte de integração da API) e smoke **R-BL-02 adaptado** (`scripts/smoke-api.mjs`): como o provider conecta eager, o smoke provisiona banco descartável + `migrate deploy` antes de executar o **processo real** `node apps/api/dist/main.js`, preservando `/health` 200, 404 sem stack, encerramento limpo por SIGTERM e cleanup garantido mesmo em falha. A evidência da run verde da CI desta branch pertence ao relatório de execução; o registro pós-integração está em §11, REV. 5 (CI de homologação run `33009026316`; CI da `main` integrada run `33084407128`).

## 6-B. Etapa 2.3C — bloqueio normativo `P-2.3C-01` (registro histórico) e sua resolução

**Estado: BLOQUEIO REGISTRADO EM 27/08/2026 E RESOLVIDO NO MESMO DIA** por **`PROP-RN-2.3C-01`** — decisão registrada em **`docs/11-registro-decisao-p-2.3c-01.md`** pela reautorização da Etapa 2.3C. O registro do challenge abaixo é preservado como histórico; a implementação decorrente está em §6-C.

*(Registro original do bloqueio — 27/08/2026; branch `agent/fase2-etapa2.3c-desconto-whitelist`, criada do HEAD exato da `main` `0a877fc5de407f22fe01c4eba3d517e12a66f5eb`.)*

A autorização da 2.3C exigia, antes de codificar, a reconstrução independente do contrato de **FIN-003** e a determinação, por fonte, da pré-condição **"cobrança em estado compatível"** — com interrupção obrigatória do fluxo caso as fontes fossem insuficientes. O challenge foi executado contra `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`, `docs/02`..`docs/07` e `docs/09` §12, com o seguinte resultado:

**Determinado inequivocamente pelas fontes** (não é a lacuna):
- permissão específica `financeiro.desconto.aplicar` (RN-043; `docs/04` §catálogo; `docs/07` §19.2);
- valor válido: `valor_desconto >= 0` e `valor_bruto - valor_desconto >= 0`, decimal exato `numeric(12,2)`, CHECKs físicos vigentes (RN-042; `docs/07` §19.2; `docs/08` §13 `E-07` itens 13/14);
- `valor_liquido` é coluna gerada — nunca escrita pela aplicação (`docs/07` §19.2; V-02);
- situação da cobrança é **derivada**, sem coluna física (RN-045; `docs/07` §19.4);
- auditoria: ação `cobranca.desconto_aplicado`, whitelist positiva exatamente `valor_desconto_anterior`/`valor_desconto_novo` (`docs/09` §12.6 — D-AUD-07; F-06).

**Lacuna real (`P-2.3C-01`)**: nenhuma fonte homologada enumera **quais situações derivadas** (`PENDENTE`, `PARCIALMENTE_PAGO`, `PAGO`, `ESTORNADO`) admitem alteração de desconto, nem se `CANCELADO` a veda expressamente. `docs/07` §19.2 diz apenas "mutáveis **enquanto a cobrança admitir alteração**" — formulação circular; RN-047 veda somente **pagamento** em cancelada; RN-046 bloqueia **pagamento** acima do saldo, sem normatizar a mutação inversa (aumento de desconto que tornaria `recebido_liquido > valor_liquido` novo); a alteração de desconto **não figura** no catálogo transacional T-01..T-09 de `docs/07` §24.2 (nenhum protocolo de lock/rollback homologado para ela). Determinar a lista de estados seria invenção normativa, vedada pela hierarquia (TLF-BASE-V1 §15).

**Consequências**: a implementação do fluxo foi **interrompida antes de qualquer código**; zero arquivo de código criado/alterado; zero mudança física de persistência (trivialmente — diff da branch contra a `main` restrito a este documento); o pacote de decisão `P-2.3C-01` (lacuna, evidências, opções conservadora/flexível, comportamento por estado, impacto de pagamentos, caso `recebido_liquido > valor_liquido`, recomendação e testes por alternativa) foi devolvido a Bruno no relatório de execução da etapa. `R2.2-04` permanece **ABERTO** — nenhuma evidência nova de whitelist positiva foi produzida. Conforme a autorização da própria 2.3C (§8 — versionamento condicionado à ausência de bloqueio normativo), **nenhum commit/push foi executado**; este registro permanece na árvore de trabalho da branch até decisão.

## 6-C. Etapa 2.3C — implementação: FIN-003 + primeira whitelist POSITIVA real

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** (revisão técnica independente do HEAD `b386c03` com veredito **APTO COM RESSALVAS NÃO BLOQUEANTES**, após correção `F-2.3C-REV-01` — §6-C.4; integração por merge commit `58a6e4b`, PR [#7](https://github.com/BrunoMNoronha/techlab-fisio/pull/7), 27/08/2026 — §11, REV. 9). Fonte normativa da regra: **`PROP-RN-2.3C-01`** (`docs/11`). **Zero mudança física de persistência** (schema, migrations, golden e `protected-objects.json` idênticos à baseline `0a877fc` — diff vazio medido, inclusive pós-merge).

### 6-C.1 Fluxo interno `cobranca.desconto_aplicado`

`CobrancaService.aplicarDesconto({ cobrancaId, atorUsuarioId, valorDescontoNovo })` (`apps/api/src/cobranca/`) — **fatia técnica interna**, sem controller/endpoint/rota/DTO público/OpenAPI. Propriedades implementadas:

- **fronteira monetária sem float**: o novo desconto entra como **string decimal canônica** (`^(?:0|[1-9]\d{0,9})\.\d{2}$` — o espaço não negativo de `numeric(12,2)`); valores do banco chegam por `::text`; comparações em **centavos BigInt**; float/double não participa de cálculo nem do `contexto`;
- **autorização REAL no backend** (RN-002/RN-043): a permissão `financeiro.desconto.aplicar` é provada pela cadeia vigente `Usuario → UsuarioPapel → Papel → PapelPermissao → Permissao`, dentro da transação; ator inexistente/inativo/sem a permissão → rejeição com **zero mutação e zero evento**. Nenhum RBAC global, guard ou decorator foi criado;
- **serialização da aggregate root**: lock da linha `cobranca` (`SELECT ... FOR UPDATE`) — o **mesmo ponto de serialização** dos fluxos financeiros T-03/T-04/T-05 (`docs/07` §17.3); estado, recebido líquido e o par anterior/novo são determinados **sob o lock**; a mutação permanece condicional (defesa em profundidade);
- **PROP-RN-2.3C-01**: aumento-somente; igualdade → **no-op** (sem mutação, sem evento, sem erro); redução → rejeição; `CANCELADO` → rejeição; RN-042 pré-verificada (CHECK físico como retaguarda); `recebido_liquido <= valor_liquido_novo` verificada sob o lock; pagamentos/estornos intocados; situação segue derivada (nada escreve situação; `valor_liquido` é coluna gerada);
- **auditoria atômica**: mutação + evento `cobranca.desconto_aplicado` na **mesma transação**, via `DatabaseService.transacao()` + `AuditWriter` (validator SEMPRE no caminho); `contexto` exatamente `valor_desconto_anterior`/`valor_desconto_novo` como strings canônicas; `alvo_tipo` `cobranca`; `resultado` `SUCESSO`; `justificativa` NULL; `correlacao_id` único por operação.

### 6-C.2 Provas medidas (PostgreSQL 18 real, runtime `tlf_app`)

Suíte de integração da API ampliada para **4 suites · 53 passed** (32 testes novos, executada 2× para amostrar interleavings): caminhos felizes em `PENDENTE`, `PARCIALMENTE_PAGO` (inclusive rederivação para `PAGO` na igualdade líquido/recebido) e `ESTORNADO` (movimentos preservados) — cada mutação com exatamente 1 alteração + 1 evento com o par exato; encadeamento de pares sem lacuna em aumentos sucessivos; no-op sem evento duplicado; rejeições (redução, negativo, acima do bruto, líquido abaixo do recebido, `CANCELADO`, inexistente) com zero mutação/evento; autorização real (inexistente, inativo, sem papel, papel com outra permissão) com zero mutação/evento; **whitelist POSITIVA no caminho de escrita real**: par homologado aceito e persistido byte a byte; chave extra, objeto, array e número não finito → `ErroContextoAuditoria` + **ROLLBACK integral da mutação** (medido no banco); ação desconhecida → rollback; falha da mutação após evento → zero evento; CHECK físico de RN-042 provado como retaguarda; **concorrência real**: desconto×desconto (pares sempre encadeados na ordem serializada, sem lost update; mesmo alvo → 1 evento + no-op), desconto×pagamento (duas ordens + corrida: **nunca** se commita `recebido_liquido > valor_liquido`), desconto×cancelamento (nenhum desconto commita após cancelamento), desconto×estorno (invariantes e movimentos preservados; rederivação `ESTORNADO` correta). Como T-03/T-04/T-05 ainda não existem na aplicação, pagamento/estorno/cancelamento foram **simulados nos testes com o protocolo físico homologado** (lock da cobrança + RN-046/RN-047) exclusivamente para medir as corridas. Suíte unitária da API ampliada para **6 suites · 147 passed** (28 testes novos: fronteira monetária, motivos de rejeição, no-op, invariantes em BigInt, contexto exato — com AuditWriter/validator REAIS sobre persistência fake). Persistência: **9 suites · 79 passed** inalterados.

### 6-C.3 Limite de autorização e escopo

A operação está **autorizada de fato** no backend (diferentemente da fatia 2.3B, cuja validação de ator era só integridade), mas permanece **INTERNA**: nenhuma exposição HTTP existe, e a exposição futura exige as fatias próprias (autenticação/sessão, RBAC de apresentação). Fora do escopo, preservados: L-05..L-08, `F-REV-03`..`F-REV-08`, `profissionais.gerenciar`, endpoints, frontend, dependências novas (nenhuma instalada).

### 6-C.4 Correção pós-revisão — `F-2.3C-REV-01` (validação semântica da whitelist positiva)

A revisão técnica independente do HEAD `31c2378` retornou **NÃO APTO com 1 finding pontual bloqueante** (fluxo FIN-003, serialização, RBAC, atomicidade e concorrência considerados estruturalmente adequados — nada disso foi reimplementado):

- **`F-2.3C-REV-01` — causa:** o `AuditContextValidator` aceitava **qualquer string** (e qualquer escalar JSON finito) nas chaves homologadas `valor_desconto_anterior`/`valor_desconto_novo`; a forma monetária canônica era garantida apenas pela fronteira do `CobrancaService`. **Impacto:** um emissor futuro incorreto poderia persistir, numa chave monetária homologada, conteúdo arbitrário — inclusive sensível — sem rejeição da política, conflitando com a intenção fail-closed de D-AUD-07/D-AUD-08.
- **Correção aplicada** (localizada, sem reinterpretar D-AUD-07/08 nem `PROP-RN-2.3C-01`): (a) `ehDecimalMonetarioCanonico()` exportada de `audit.catalog.ts` — a MESMA forma `^(?:0|[1-9]\d{0,9})\.\d{2}$` já contratada pela 2.3C, agora fonte única (o `CobrancaService` passou a reutilizá-la, eliminando a duplicação); (b) estrutura tipada mínima `SEMANTICA_CONTEXTO` (predicado por ação/chave) aplicada pelo validator **após** as barreiras estruturais, com novo motivo estável **`VALOR_SEMANTICAMENTE_INVALIDO`** — mensagens citam ação e nomes de chave, **nunca valores**; nenhuma conversão/normalização (sem `"10"`→`"10.00"`, sem number→string). Motivos públicos preexistentes preservados. **O mecanismo suporta** regras semânticas futuras por chave (uma linha por chave), mas **nenhuma regra foi criada** para `cobranca.data_referencia_recalculada` (datas) ou `retificacao_clinica.efetivada_terceiro` (uuid) — sem fonte homologada de formato, essas chaves permanecem só sob as barreiras estruturais (**pendência registrada em §9**), sem ampliação silenciosa de D-AUD-07.
- **Medições pós-correção:** API unit **6 suites · 199 passed** (+52: matriz semântica completa nas duas chaves — `"10"`, `"10.0"`, `"01.00"`, `"-1.00"`, `"+1.00"`, `"1e2"`, `"10,00"`, `"abc"`, vazia, espaços, 11 dígitos, number, null, boolean → `VALOR_SEMANTICAMENTE_INVALIDO`; NaN/±Infinity/objeto/array seguem na barreira estrutural; limite `9999999999.99` aceito; writer com valor monetário inválido → zero create e mensagem sem o valor; testes de F-REV-02 reancorados em chave SEM regra semântica, provando a não-expansão); integração PostgreSQL real **4 suites · 58 passed** (+5, executada 2×): **Cenário A** — escrita DIRETA no `AuditWriter` com par canônico dentro de transação real → commit de mutação + evento com contexto exato; **Cenário B** — chaves homologadas com `"PACIENTE: DADO QUE NÃO DEVE ENTRAR"`, `"10,00"`, `"10"` e number `10` → rejeição semântica no caminho `transação → AuditWriter → AuditContextValidator → PostgreSQL` com **ROLLBACK integral** da mutação de negócio (cobrança restaurada, zero evento) e mensagem sem o valor. Persistência **9 suites · 79 passed** inalterada; typecheck/build/guardas/golden/`migrate diff`/F-01/smoke verdes; diff físico de persistência e lockfile **zero**. Comportamento de FIN-003 **inalterado** (todos os testes da 2.3C originais verdes — nenhuma regressão).

## 6-D. Etapa 2.3D-B / F1 — `CredencialService` / Argon2id

**Estado: CONCLUÍDA / INTEGRADA NA `main`.** Executada em 27/08/2026 na branch `agent/fase2-etapa2.3d-f1-credenciais`, a partir de `main` = `04aa01f`; integrada por **merge commit `f4c246648e436c3a50121c371147768bd8403657`**, PR [#11](https://github.com/BrunoMNoronha/techlab-fisio/pull/11), com o commit da fatia `f642b6259b0c916b42d8f8bc77d25258592805a6`. *(Registro corrigido na REV. 12: a REV. 11 descrevia a fatia como "não integrada" porque a publicação ainda não havia ocorrido quando aquela revisão foi escrita. Nada além do estado de integração mudou — as medições de §6-D.1..§6-D.6 permanecem exatamente como registradas.)*

Fontes normativas: **`D-2.3D-02`** (`docs/12` §5.2) e **`D-2.3D-03`** (`docs/12` §5.3) — **nenhuma delas foi alterada**. Requisito: AUT-001. **Zero mudança física de persistência**: `schema.prisma`, as 10 migrations, `schema.golden.sql` e `protected-objects.json` com hash idêntico a `04aa01f`; `packages/` inteiro com diff vazio.

### 6-D.1 Dependência

`argon2@0.45.1` — a versão **exata** homologada em `D-2.3D-02`, verificada no registry **antes** da instalação (`npm view`): versão `0.45.1` publicada e marcada `latest`; `engines.node >= 16.17.0` (compatível com Node 24 da baseline); licença MIT; tipos próprios embarcados (`argon2.d.cts` — nenhum `@types/*` adicional instalado); exporta `hash`, `verify`, `needsRehash`, `argon2id`, `argon2i`, `argon2d`.

Instalada **apenas** em `@techlab-fisio/api` (`npm install argon2@0.45.1 --workspace @techlab-fisio/api`), com pin exato sem acento circunflexo, no mesmo padrão das demais dependências do repositório. Manifests alterados: `apps/api/package.json` e `package-lock.json`. A raiz e `packages/database` **não** receberam `argon2`.

**Fato operacional medido — addon nativo sob o gate `allow-scripts` do npm 11:** o install script do pacote (`node-gyp-build`) **não é executado** (npm 11.16 exige aprovação explícita) e **isso não impede o funcionamento**: o tarball embarca prebuilds N-API para `win32-x64` (máquina de desenvolvimento) e `linux-x64` (runner da CI), e `node-gyp-build` resolve o binário no `require`. Carregamento e execução foram provados de fato (§6-D.4), não presumidos.

### 6-D.2 Componentes implementados

Fatia técnica **INTERNA** em `apps/api/src/auth/` — **sem controller, rota, DTO HTTP, cookie, sessão, guard, RBAC ou auditoria**; `AuthModule` registrado em `AppModule` no mesmo precedente interno de `ProfissionalModule`/`CobrancaModule`. O módulo **não** importa `DatabaseModule` (a F1 não consulta usuário) nem `AuditModule` (o evento `usuario.autenticacao` é da F3).

`CredencialService` (`credencial.service.ts`) — API pública:

| Operação | Contrato |
| --- | --- |
| `gerarHash(senha)` | digest PHC Argon2id sob a política homologada; senha vazia → `ErroCredencial("SENHA_INVALIDA")` |
| `verificarSenha(hash, senha)` | `boolean`; comparação **inteiramente delegada ao Argon2** — nenhum `===` sobre digests participa da decisão |
| `verificarComCaminhoDummy(hash ou ausente, senha)` | primitiva do login da F2/F3 — ver §6-D.3 |
| `precisaRehash(hash)` | `boolean`; decide, **não** regenera |
| `obterHashDummyParaProva()` | exposição do digest dummy **apenas** para teste |

**Política explícita (`POLITICA_ARGON2`, congelada):** `type: argon2id`, `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`. Os quatro valores são passados em **toda** operação — os defaults de `argon2@0.45.1` são outros (`m=65536`, `t=3`, `p=4`) e depender deles faria a política homologada mudar silenciosamente numa atualização do pacote.

**Fail-closed na verificação:** comportamento **medido** em `argon2@0.45.1` — digest vazio, sem `$` inicial ou sem o campo de hash fazem `verify` lançar `TypeError`; `"$scrypt$x"` devolve `false`. Ambos os casos são convertidos em `false`, e a exceção original (que pode conter o digest) é descartada em vez de propagada ou registrada. Corrupção de credencial **nunca** vira autenticação positiva.

**Rehash** cobre duas defasagens, e a segunda **não** é coberta pela biblioteca: (1) parâmetros `m`/`t`/`p`/`version`, via `needsRehash` nativo; (2) **variante**, via prefixo PHC `$argon2id$`. Fato medido e decisivo: `needsRehash` de `argon2@0.45.1` compara **somente** `timeCost`, `memoryCost`, `parallelism` e `version` — um digest `$argon2i$` com `m`/`t`/`p` iguais aos vigentes é reportado como "não precisa rehash". A verificação de prefixo é a solução mais simples que fecha essa lacuna; **nenhum parser PHC artesanal foi introduzido**. Digest malformado é fail-closed: precisa de rehash, nunca é vigente.

`normalizarIdentificadorLogin` (`identificador-login.ts`) — `D-2.3D-03`: função **pura**, `trim` + `toLowerCase()`. Usa `toLowerCase()` e **não** `toLocaleLowerCase()`, que dependeria da locale do processo. Escopo deliberadamente estreito: **nenhuma** normalização Unicode NFC/NFKC, remoção de pontos, corte de sufixo `+tag` ou validação de formato — nada disso é homologado, e cada uma mudaria a identidade de contas reais. **Nada foi alterado no banco**: sem migration, sem `citext`, sem índice funcional, sem backfill.

### 6-D.3 Caminho dummy

`D-2.3D-02` exige que conta inexistente percorra operação Argon2 equivalente. A F1 **não consulta usuário**; ela entrega a primitiva que o login da F2/F3 usará:

- `hashPersistido` presente → `verify(hashPersistido, senha)`;
- `hashPersistido` ausente (`null`/`undefined`/vazio) → `verify(hashDummy, senha)` e resultado **forçado a `false`**.

O resultado do caminho ausente é forçado — não devolvido — para que nem mesmo conhecer a senha sintética do dummy autentique alguém. O digest dummy é **memoizado como Promise** (chamadas concorrentes na inicialização compartilham um único `hash()`) e **aquecido no `onModuleInit`**, de modo que exista antes do primeiro caminho de autenticação: pagar a primeira geração dentro de uma tentativa de login produziria exatamente a assimetria que o mecanismo existe para eliminar. **Nenhum `hash()` novo por tentativa** — provado por estabilidade do digest entre tentativas. A senha do dummy é sintética e **não é segredo**: nenhum usuário a possui.

### 6-D.4 Provas medidas

- **Suíte da API: 9 suites · 249 passed** (era 6 · 199 — **+3 suites, +50 testes**), contra o **Argon2 real**, sem mock da primitiva criptográfica. Cobre: forma PHC e variante Argon2id; `m=19456`/`t=2`/`p=1` conferidos par a par no digest; salt distinto por chamada; senha correta/incorreta; digest usado como senha **não** autentica; seis formas de digest malformado → `false` sem lançar; rehash por `memoryCost`/`timeCost`/`parallelism`; **Argon2i com parâmetros vigentes → precisa de rehash** (a lacuna do `needsRehash` nativo); dummy não autentica, executa `verify` real contra o digest dummy, usa o hash recebido no caminho existente, não regenera por tentativa e compartilha um único dummy sob concorrência; ausência de escrita em `console` em todas as operações; mensagens de erro sem senha nem digest. **Nenhuma asserção de tempo** — a simetria é provada estruturalmente; `T-AUTH-ENUMERATION` ponta a ponta é da F3.
- **Runtime ESM + addon nativo** (`npm run verify:argon2-runtime --workspace @techlab-fisio/api`): **16/16 verificações**, sobre o artefato **compilado** (`dist/auth/credencial.service.js`), **fora do Jest** — fecha a lacuna de uma biblioteca nativa funcionar sob o runtime de VM do Jest e falhar em `node dist/main.js`.
- **`AuthModule` pelo container NestJS real** (`auth.module.integration.spec.ts`, **9 testes**, no precedente de `audit.module.integration.spec.ts`): `CredencialService` é **resolvido a partir do `AppModule`** — não instanciado diretamente —, é o singleton do container e opera com Argon2 real; `moduleRef.init()` executa o ciclo de vida e o digest dummy fica **comprovadamente aquecido** depois dele; a fronteira é conferida (`AuthModule` sem controller e sem imports). O aquecimento é provado por **ordem de fila de microtarefas**, com controle negativo — **sem limiar temporal**. Verificado por mutação temporária: remover `AuthModule` do `AppModule` derruba 7 dos 9 testes; neutralizar o aquecimento em `onModuleInit` derruba exatamente a asserção correspondente.
- **Smoke `R-BL-02` verde** com `AuthModule` no grafo: o processo real `node apps/api/dist/main.js` sobe, responde `/health` 200, trata 404 sem stack e encerra limpo por SIGTERM. **O que isto prova sobre o Argon2, e só isto:** `dist/main.js` importa `app.module.js` → `auth.module.js` → `credencial.service.js`, cujo `import ... from "argon2"` é estático — o processo não subiria se o addon nativo não fosse **carregável** no runtime ESM real. O smoke **não afere** o aquecimento do dummy; essa prova é do teste de integração acima, não deste passo.
- **Sem regressão:** integração API × PostgreSQL 18 real **4 suites · 58 passed**; persistência **10 suites · 87 passed**; Guarda 1 (10 migrations · 37 objetos), Guarda 2, Guarda 3 (golden byte a byte, 60 169 bytes) e `migrate diff --exit-code` 0; `verify:from-scratch` **exit 0** (a F1 não toca `packages/database/prisma`, logo a precondição de árvore limpa do script é satisfeita mesmo sem commit); typecheck e build verdes.

### 6-D.5 Benchmark `P-2.3D-02`

Medição obrigatória de `D-2.3D-02`, executada sobre o **serviço compilado** (`npm run bench:argon2 --workspace @techlab-fisio/api`). **Não é teste de CI e não aplica limiar**: `docs/12` não fixou um, e o script deliberadamente não inventa. Sem biblioteca de benchmark — `process.hrtime.bigint()`.

Ambiente: Node v24.18.0 · win32 10.0.26200 · x64 · Intel Core i5-1235U (12 lógicas) · 15,7 GiB · `argon2@0.45.1` · Argon2id `m=19456 KiB`, `t=2`, `p=1` · warm-up 5 · 30 amostras por cenário.

| Cenário | min | média | p50 | p95 | max |
| --- | --- | --- | --- | --- | --- |
| `hash` | 37,36 ms | 39,37 ms | 39,16 ms | 41,00 ms | 41,26 ms |
| `verify` válido | 37,21 ms | 39,01 ms | 38,70 ms | 40,49 ms | 40,98 ms |
| `verify` inválido | 38,33 ms | 39,91 ms | 39,67 ms | 41,57 ms | 43,88 ms |

Interpretação: custo estável em torno de **~39 ms** e **~19 MiB** por operação, com dispersão estreita (p95 a menos de 6 % do p50). `verify` válido × inválido são praticamente simétricos (razão de p50 = **1,025**) — o Argon2 recomputa o digest integralmente antes de comparar, o que confirma que a assimetria a eliminar é "conta existe × conta não existe", e não "senha certa × senha errada": exatamente o que o caminho dummy resolve. O custo não é alto a ponto de virar vetor de negação de serviço sob os limites de `D-2.3D-06` (5 falhas/15 min por identificador; 30/15 min por IP), nem baixo a ponto de baratear ataque offline. **Nenhuma ressalva material** foi encontrada — recomendação: **manter os parâmetros homologados**; `D-2.3D-02` não é reaberta.

Limitação declarada: a medição é da **máquina de desenvolvimento**. Remedir em hardware de produção antes do go-live é prudência operacional, não condição pendente de `D-2.3D-02`.

### 6-D.6 Fronteira — o que a F1 deliberadamente NÃO fez

Sem busca de usuário no banco; sem login/logout HTTP; sem `SessaoService`, criação de sessão, `token_hash` de sessão, `ultima_atividade_em`, expiração absoluta/ociosa; sem cookies, CSRF, controllers, DTOs HTTP, rate limiting; sem auditoria `usuario.autenticacao` nem `AuditWriter` no caminho de credencial; sem OpenAPI/`@nestjs/swagger`; sem guards, decorators de RBAC, seed, bootstrap de Administrador, recuperação de senha ou revogação de sessão; sem frontend; sem alteração de schema/migration/golden; **sem `prisma format`**. Nenhuma infraestrutura dessas fatias foi "preparada" por antecipação.

## 6-E. Etapa 2.3D-B / F2 — `SessaoService`

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`.** Executada em 27/08/2026 na branch `agent/fase2-etapa2.3d-f2-sessao`, a partir de `main` = `f4c2466`; revisada de forma independente (veredito **B**, §6-E.9), corrigida (`C-01`/`C-02`), homologada por Bruno Menezes Noronha e integrada por **merge commit `70b30aebf09368200343d6a5672b267811f337ee`**, PR [#12](https://github.com/BrunoMNoronha/techlab-fisio/pull/12), com o commit da fatia `289a94b5aab53b24f9635bb9a3503ce541028737`. `R-2.3D-03` **ENCERRADO** (§9). Registro pós-medição da integração em §11, REV. 15.

Fontes normativas: **`D-2.3D-01`** (`docs/12` §5.1), **`D-2.3D-04`** (§5.4) e **`D-2.3D-05`** (§5.5) — **nenhuma delas foi alterada**. Requisitos: AUT-002; RN-004; FC-01. **Zero mudança física de persistência**: `packages/` inteiro com diff vazio contra `f4c2466` — `schema.prisma`, as 10 migrations, `schema.golden.sql` e `protected-objects.json` com blob idêntico (§6-E.7). **Nenhuma dependência nova** foi instalada: CSPRNG e SHA-256 vêm de `node:crypto`.

### 6-E.1 Componentes implementados

Fatia técnica **INTERNA** em `apps/api/src/auth/` — **sem controller, rota, DTO HTTP, cookie, CSRF, rate limiting, OpenAPI, guard, RBAC ou auditoria**.

| Arquivo | Papel |
| --- | --- |
| `token-sessao.ts` | primitivas **puras** do token: geração do segredo, composição, parser fail-closed, verificador SHA-256, comparação em tempo constante |
| `relogio-sessao.ts` | `RELOGIO_SESSAO` — fonte única do "agora" da política; provider de produção é o relógio do sistema |
| `sessao.service.ts` | `SessaoService` — emissão, validação + atividade, revogação, transições terminais |

**Mudança de fronteira do módulo — única e autorizada:** `AuthModule` passou a importar **`DatabaseModule`**, porque a sessão é de fato persistida (`D-2.3D-01`). **`AuditModule` continua fora**: `usuario.autenticacao` (`D-2.3D-12`) e a auditoria de logout são da F3 e não entram por antecipação. A asserção de fronteira em `auth.module.integration.spec.ts` foi atualizada de "não importa nada" para "importa **exclusivamente** `DatabaseModule`" — ela falha se qualquer outro módulo aparecer.

### 6-E.2 API interna do `SessaoService`

Superfície mínima: **emitir · validar (+ registrar atividade) · revogar**. Nada foi criado em antecipação a consumidores da F3.

| Operação | Contrato |
| --- | --- |
| `emitir({ usuarioId })` | `SessaoEmitida` — `{ sessaoId, usuarioId, token, criadaEm, ultimaAtividadeEm, expiraEm }`; usuário inexistente/inativo → `ErroSessao` |
| `validar(token: unknown)` | `{ valida: true, sessaoId, usuarioId, expiraEm, ultimaAtividadeEm, atividadeRegistrada }` **ou** `{ valida: false, motivo }` |
| `revogar(token: unknown)` | `{ revogada: true, sessaoId, usuarioId, encerradaEm }` **ou** `{ revogada: false, motivo }` |

`motivo` é um conjunto fechado: `TOKEN_MALFORMADO`, `SESSAO_INEXISTENTE`, `SEGREDO_INVALIDO`, `SESSAO_EXPIRADA`, `SESSAO_REVOGADA`. Nenhum retorno ou mensagem carrega token, segredo, `token_hash` ou mensagem do driver de banco.

**Validação e atividade são UMA operação, de propósito.** Separá-las criaria um estado intermediário em que a sessão foi julgada válida mas a atividade poderia deixar de ser registrada — fazendo uma sessão em uso expirar por ociosidade. `atividadeRegistrada = false` distingue "válida, escrita throttled" de "válida, escrita efetuada"; ambos os casos são **aceitos**.

**`revogar` recebe o TOKEN, não `(sessaoId, usuarioId)`.** O `sessao_id` não é segredo (`docs/12` §6, A-02); aceitar o usuário por parâmetro permitiria revogar sessão alheia sem prova de posse. A autoria é derivada da própria linha — `revogada_por_usuario_id = usuario_id` **dentro do SQL** —, de modo que é estruturalmente impossível atribuí-la a outro usuário.

**Nota para a F3 (não é norma):** todo `valida: false` deve ser mapeado para **uma única** resposta HTTP uniforme. Os motivos existem para diagnóstico interno e para os testes; expô-los distinguiria sessão inexistente de segredo incorreto na superfície pública.

### 6-E.3 Token e armazenamento

Forma `<sessao_id>.<segredo>`, conforme `D-2.3D-01`. Persiste-se **exclusivamente** `token_hash = SHA-256(segredo)` em hexadecimal. O segredo em claro existe apenas em memória, é devolvido **uma única vez** dentro do token composto e **não é exposto separadamente** — uma segunda via de saída seria uma segunda via de vazamento.

**Decisões LOCAIS de implementação** (`docs/12` não as fixa; **não** são elevadas a requisito permanente):

| Parâmetro | Valor | Justificativa |
| --- | --- | --- |
| Entropia do segredo | **256 bits** (32 bytes, `randomBytes`) | alinhado ao único parâmetro de entropia já homologado para segredo de uso único (`D-2.3D-08`); satura a saída de 256 bits do SHA-256 — mais bits não fortaleceriam o verificador |
| Codificação | **`base64url`** (43 caracteres, sem preenchimento) | alfabeto `A-Za-z0-9-_`: seguro em cookie e URL, e **não contém `.`** — torna a decomposição não-ambígua por construção |
| Formato de `token_hash` | hexadecimal minúsculo (64 caracteres) | comparação por `timingSafeEqual` sobre 32 bytes |

**SHA-256 puro — e não Argon2 — é o correto e é o que a norma decide:** o segredo tem 256 bits de entropia uniforme de CSPRNG, não é escolhido por humano e não admite dicionário; a função lenta existe para compensar entropia baixa, que aqui não existe.

**Parser fail-closed.** Só `<uuid canônico>.<43 caracteres base64url>` é aceito. A validação do UUID não é cosmética: ela impede que um identificador arbitrário chegue ao `WHERE id = $1::uuid` e produza erro de conversão do PostgreSQL em vez de rejeição limpa da aplicação. Vinte formas de entrada inválida são cobertas por teste, incluindo tentativa de injeção SQL no lugar do id, tipos não-`string` e `null`/`undefined`.

**Ordem obrigatória na validação:** a posse do segredo é conferida **antes de qualquer escrita**. Registrar atividade antes disso permitiria a quem conhece apenas o `sessao_id` manter viva a sessão alheia — provado por teste.

**Simetria do caminho de ausência:** sessão inexistente ainda percorre uma comparação de tempo constante, contra um verificador sintético público (`VERIFICADOR_SINTETICO_DE_AUSENCIA`), que nenhum segredo real pode igualar.

### 6-E.4 Política temporal

`POLITICA_SESSAO` é a **fonte única** — congelada, não configurável por ambiente: `expiracaoAbsolutaMs = 8 h`, `timeoutOciosoMs = 15 min`, `throttleAtividadeMs = 1 min`.

Os limites chegam ao SQL como **instantes já calculados** (`agora − 15 min`, `agora − 1 min`), e **não** como literais `interval` escritos na consulta: assim a política não pode divergir entre o código e a consulta.

| Regra | Materialização | Borda medida |
| --- | --- | --- |
| Nascimento | `estado = ATIVA`, `ultima_atividade_em = criada_em`, `expira_em = criada_em + 8 h`, `encerrada_em = NULL`, `revogada_por = NULL` | — |
| Instante de criação | escrito **explicitamente** pela aplicação; o `@default(now())` de `criada_em` é sobrescrito (`D-2.3D-01`, "Ausência de DEFAULT") | provado com `T0` fixo no passado |
| Expiração absoluta | `expira_em > agora` para valer | `8 h − 1 ms` **válida** · `8 h` **expira** · `8 h + 1 ms` **expira** |
| Expiração ociosa | `ultima_atividade_em > agora − 15 min` para valer | `15 min − 1 ms` **válida** · `15 min` **expira** · `15 min + 1 ms` **expira** |
| Throttle | escreve só se `ultima_atividade_em <= agora − 1 min` | `1 min − 1 ms` **não escreve** (e a sessão continua aceita) · `1 min` **escreve** |
| `expira_em` | **nunca** é tocado por atividade — a janela absoluta não desliza | provado após múltiplas atividades |

O throttle **não** estende `expira_em`, **não** permite regressão, **não** ressuscita sessão terminal e **não** faz sessão ociosamente vencida sobreviver — este último caso é provado explicitamente: 6 requisições dentro da janela de throttle não escrevem nada e, por isso mesmo, a ociosidade continua contando a partir de `T0`.

**Relógio injetável (`RELOGIO_SESSAO`) — decisão local, e a menor possível.** As bordas exigidas só são alcançáveis no **instante exato** com controle do tempo; sem isso restariam espera real (lenta e não determinística) ou escrita direta de timestamps (que provaria o fixture, não a política). A interface tem **um** método, o provider de produção é sempre o relógio do sistema e a substituição ocorre exclusivamente no container de testes.

### 6-E.5 `R-2.3D-03` — prova de atomicidade

**Mecanismo.** Nenhuma decisão de escrita é tomada em memória. Toda mutação é um **UPDATE condicional** com o predicado inteiro no `WHERE`:

```sql
UPDATE sessao_autenticacao
   SET ultima_atividade_em = GREATEST(ultima_atividade_em, $agora)
 WHERE id                  = $sessaoId
   AND estado              = 'ATIVA'
   AND expira_em           > $agora
   AND ultima_atividade_em > $agora - 15 min
   AND ultima_atividade_em <= $agora - 1 min
```

**Por que não há last-writer-wins regressivo.** Sob READ COMMITTED, quando duas transações disputam a linha, a segunda bloqueia no lock e **reavalia o `WHERE` sobre a versão commitada pela primeira**. O predicado de throttle exige `ultima_atividade_em <= agora − 1 min`, isto é, exige que o candidato esteja **adiante** do valor vigente; um candidato mais antigo que o `ultima_atividade_em` já commitado não o satisfaz e a linha é pulada (`count = 0`). Ainda que o predicado fosse satisfeito, a cláusula `SET` é reavaliada sobre a mesma versão nova e `GREATEST` impede a regressão.

**Teste concorrente — corrida REAL, não inspeção.** `sessao.integration.spec.ts` bloqueia a linha numa transação própria (`SELECT ... FOR UPDATE`), dispara `validar` com um candidato **antigo** (`T0 + 2 min`), **espera até `pg_stat_activity` confirmar que o statement entrou em espera de lock** — o teste falha explicitamente se a corrida não for exercida —, então commita um valor **mais novo** (`T0 + 5 min`) e libera. Resultado medido: a requisição antiga permanece **válida**, `atividadeRegistrada = false`, e o valor persistido é `T0 + 5 min`. Um segundo teste dispara 5 validações concorrentes com candidatos **fora de ordem** e mede convergência determinística para o maior instante.

**Challenges executados (mutações temporárias, todas revertidas):**

| # | Mutação | Resultado medido |
| --- | --- | --- |
| 1 | `#registrarAtividade` reescrito como **last-writer-wins** (`SELECT` → decisão em memória → `UPDATE` incondicional) | **DETECTADO.** Medição da fatia: corrida bloqueada falha sempre; convergência fora de ordem falhou em 1 de 2 execuções. **Reprodução independente da revisão (§6-E.9): os DOIS testes falharam em 3 de 3 execuções** — a detecção é mais forte do que a medição original registrou. Reaplicado sobre o código já corrigido por `C-01`: continua detectado |
| 2 | Predicado de throttle removido do `WHERE`, `GREATEST` mantido | **DETECTADO** — 4 falhas (3 de throttle + a asserção de `atividadeRegistrada` da corrida bloqueada). **A não-regressão continuou valendo**: `GREATEST` sozinho barrou o candidato antigo |
| 3 | `GREATEST` removido, `WHERE` mantido | **NÃO DETECTADO** — 51/51 verdes |

**Leitura honesta do challenge 3.** Com o predicado de throttle presente, o `UPDATE` só dispara quando `ultima_atividade_em < agora`; logo `GREATEST(ultima, agora) = agora` **sempre**, e a função é comportamentalmente inobservável — nenhum teste pode distingui-la, e isso é uma propriedade da álgebra dos predicados, não uma lacuna da suíte. **A barreira que sustenta `R-2.3D-03` é o predicado condicional atômico.** `GREATEST` é mantido por duas razões concretas: materializa **literalmente** a fórmula que `D-2.3D-04` nomeia, e é uma barreira **independente e medida** — o challenge 2 demonstrou que, removido o throttle, foi `GREATEST` que impediu a regressão.

**Demais corridas cobertas:** dois logouts concorrentes (exatamente um revoga); duas detecções concorrentes de expiração (um único `encerrada_em`); atividade × logout (o estado terminal vence, nunca volta a `ATIVA`); atividade × expiração (termina `EXPIRADA`, atividade não escreve); **atividade concorrente MAIS ANTIGA intercalada no meio do logout — corrida `A-01`, acrescentada após a revisão independente (§6-E.9)**. A CHECK `ck_sessao_autenticacao_atividade` permanece satisfeita após sequências de atividade — verificada explicitamente.

### 6-E.6 Estados terminais

`ATIVA -> EXPIRADA` e `ATIVA -> REVOGADA`, ambos por UPDATE condicional com `estado = 'ATIVA'` no `WHERE`. **Nenhum statement do arquivo escreve `'ATIVA'`, exceto a criação** — a ressurreição é impossível por construção, não por convenção.

- **Expiração:** detectada por prazo absoluto **ou** ociosidade; persiste `estado = EXPIRADA` e `encerrada_em` = instante da **detecção**; `revogada_por_usuario_id` continua `NULL`. Uma segunda detecção não reescreve `encerrada_em` — provado inclusive com o relógio **recuado**.
- **Logout:** `estado = REVOGADA`, `encerrada_em` = instante da revogação, `revogada_por_usuario_id` = o próprio dono. Chamada repetida devolve `SESSAO_REVOGADA` sem alterar coluna alguma.
- **`EXPIRADA` não vira `REVOGADA` silenciosamente:** uma sessão ainda `ATIVA` no banco mas já vencida por ociosidade é fechada como **`EXPIRADA`** — que é o estado verdadeiro — e o logout devolve `SESSAO_EXPIRADA`. **Desde `C-01` (§6-E.9), a detecção de expiração roda ANTES da revogação**, e o `UPDATE` de revogação exige apenas `estado = 'ATIVA'`: com isso `revogadas === 0` passa a significar exatamente "estado terminal", e a resposta de `revogar` corresponde **sempre** ao estado persistido.
- **Varredura de terminalidade:** para uma sessão expirada e uma revogada, `validar` e `revogar` foram exercidas em 4 instantes distintos (inclusive anteriores ao encerramento); todas rejeitaram, e o estado final permaneceu o mesmo.

### 6-E.7 Provas medidas

- **Suíte da API (sem banco): 10 suites · 291 passed** (era 9 · 249 — **+1 suite, +42 testes**, `token-sessao.spec.ts`). Cobre forma do token, entropia, ausência do separador em 200 amostras, unicidade em 500 amostras, 20 formas de entrada rejeitadas pelo parser, verificador SHA-256, 6 formas de `token_hash` corrompido → fail-closed, ausência de escrita em `console` e ausência de exceção que pudesse carregar o segredo.
- **Integração da API × PostgreSQL 18 real: 5 suites · 111 passed** (era 4 · 58 — **+1 suite, +53 testes**; os 2 últimos são a regressão de `A-01`, §6-E.9). O caminho é `SessaoService` (resolvido do container Nest real) → `DatabaseService` → fábrica pública → `tlf_app` → PostgreSQL 18 → `sessao_autenticacao`. **Nenhum mock de banco**; a prova de atomicidade é feita contra locks reais.
- **Prova de armazenamento:** a linha é lida **coluna a coluna** (`SELECT ... ::text`) e verifica-se que **nem o segredo nem o token completo aparecem em coluna alguma**, e que `token_hash` é exatamente o SHA-256 do segredo. Sessões distintas recebem segredos e verificadores distintos.
- **Prova de ausência de escrita no throttle:** medida por **`xmin`** — a versão física da linha permanece a mesma após 3 validações dentro da janela. Um `UPDATE` no-op criaria versão nova e seria detectado.
- **Sem regressão:** persistência **10 suites · 87 passed** (idêntico à F1); Guarda 1 (10 migrations · 37 objetos protegidos); Guarda 2 (dentro de `verify:from-scratch`); Guarda 3 (golden byte a byte, **60 169 bytes**) e `prisma migrate diff --exit-code` **0**; `verify:from-scratch` **exit 0**; `verify:argon2-runtime` **exit 0, 15 verificações `OK` medidas nesta fatia** (o script não publica contagem própria; a contagem foi lida da saída real); smoke `R-BL-02` verde com `SessaoService` no grafo; typecheck e build verdes.
- **Zero drift de persistência:** `git diff f4c2466 -- packages/` **vazio**; blobs de `schema.prisma`, `protected-objects.json` e `schema.golden.sql` **idênticos** aos da baseline. Nenhum `prisma migrate dev`, `db push`, `db pull` ou `prisma format` foi executado.
- **CI sem alteração:** `.github/workflows/ci.yml` **não foi tocado**. `test:api` descobre `test/**/*.spec.ts` e `verify:api-integration` descobre `test/integration/**/*.spec.ts` — ambos os arquivos novos entram na CI automaticamente pelos passos já existentes.

### 6-E.8 Fronteira — o que a F2 deliberadamente NÃO fez

Sem login/logout HTTP, controllers, rotas, DTOs HTTP, cookies (`__Host-tlf_sessao` ou de desenvolvimento), CSRF, Origin/Fetch Metadata, CORS, rate limiting ou `429`; sem OpenAPI/`@nestjs/swagger`; sem `usuario.autenticacao` ou qualquer auditoria de autenticação; sem guards, decorators de RBAC ou resolução de papéis/permissões; sem seed, bootstrap do primeiro Administrador ou recuperação de senha; sem revogação de sessão **de terceiro** (`sessoes.revogar_terceiro` é RBAC, F4) e sem revogação em massa (T-07/RN-005, F6); sem frontend; sem alteração de Argon2 ou da normalização de login; sem alteração de schema, migration, golden, `protected-objects.json` ou enum; **sem dependência nova**; **sem `prisma format`**. Nenhuma infraestrutura dessas fatias foi "preparada" por antecipação.

### 6-E.9 Revisão independente e correção `C-01` (achado `A-01`)

A F2 foi submetida a **revisão técnica independente e adversarial** antes de qualquer versionamento. Veredito: **`B — APTO COM CORREÇÕES OBJETIVAS`**. A revisão reproduziu por conta própria as evidências desta seção — e, em dois pontos, chegou a conclusões **mais fortes** do que a medição original (§6-E.5, challenge 1; e a sonda que mediu o valor real de `GREATEST`, abaixo). Encontrou **um defeito funcional**, corrigido nesta fatia.

#### O defeito — `A-01` (severidade ALTO na revisão)

Na ordem anterior, `revogar` executava o `UPDATE` de revogação **com predicados temporais** (`expira_em > agora`, `ultima_atividade_em > limiteOcioso`) e só depois chamava a detecção de expiração. **Um `UPDATE` que casa ZERO linhas não adquire lock sobre a linha.** Logo, quando a revogação falhava por ociosidade, existia uma janela — de um round-trip, entre os dois statements — em que a linha ficava **destravada**. Uma `validar` concorrente portando um instante ligeiramente **anterior** conseguia renovar `ultima_atividade_em` nessa janela; a detecção seguinte deixava de disparar; e o chamador recebia:

```text
{ revogada: false, motivo: "SESSAO_EXPIRADA" }
```

enquanto a linha permanecia `estado = ATIVA`, `encerrada_em = NULL` — **e o token continuava plenamente utilizável**. Ou seja: **um logout que falhava em silêncio**, informando encerramento de uma sessão viva. Contraria AUT-002 ("token/cookie de sessão encerrada não autoriza novas operações") e, por consequência, a disciplina de confidencialidade da TLF-BASE-V1 §4/§10.

Probabilidade **baixa** (exige janela de milissegundos com `ultima_atividade_em` numa faixa estreita em torno do limite de ociosidade), impacto **alto**, e — o agravante decisivo — **o chamador não tinha como perceber**.

#### A correção — `C-01`

Inverter a ordem e **remover a classificação temporal duplicada** do `UPDATE` de revogação:

1. `#detectarExpiracao(agora)` roda **primeiro**, atomicamente;
2. o `UPDATE` de revogação passa a exigir **apenas** `id` e `estado = 'ATIVA'`.

Por que fecha a janela — e não a desloca: se a sessão está vencida em `agora`, a detecção a fecha **antes de tudo** e **adquire o lock** da linha (ela casa 1 linha), de modo que nenhuma atividade concorrente pode reanimá-la — todo `UPDATE` de atividade exige `estado = 'ATIVA'`. Se **não** está vencida, a revogação encontra `ATIVA` e vence. Os dois desfechos são verdadeiros.

**Consequência de classificação, e é ela que elimina a classe inteira do defeito:** depois desta ordem, `revogadas === 0` significa **exatamente** `estado <> 'ATIVA'`; como nenhum statement devolve uma sessão a `ATIVA`, o estado relido é necessariamente terminal. A resposta passa a corresponder **sempre** ao estado persistido, sem TOCTOU residual. A correção também deixa o SQL **mais simples** que o anterior — dois predicados a menos.

#### Teste de regressão

`sessao.integration.spec.ts`, bloco `A-01`, **2 testes** contra PostgreSQL real:

- **caso da corrida:** `revogar` opera na borda exata da ociosidade (`T0 + 15 min`) enquanto uma `validar` concorrente porta `T0 + 15 min − 1 ms`. A concorrente é posicionada **deterministicamente** entre o primeiro e o segundo statement da transação do logout, e o teste espera até que ela **termine ou entre em disputa de lock** — falhando explicitamente se nenhuma das duas coisas ocorrer, de modo que a corrida nunca deixa de ser exercida. Invariante essencial verificada **no estado persistido**: a sessão nunca permanece `ATIVA` e utilizável quando o logout não a revogou;
- **controle positivo:** a mesma intercalação sobre sessão **não** vencida precisa revogar de verdade — a correção não pode ter transformado logout legítimo em "expirada".

A instrumentação vive **inteiramente na infraestrutura de teste** (`jest.spyOn` + `Proxy` sobre o cliente transacional): **nenhum hook, flag ou ponto de extensão foi acrescentado ao código de produção**.

**Prova de que o teste detecta a regressão** — verificada por restauração temporária, integralmente revertida: com a lógica anterior, o teste **falha** exatamente na invariante essencial (`estado` = `ATIVA` após um logout que informou encerramento); com a correção, passa. Suíte de sessão executada **3 vezes** após a correção: 53/53 em todas.

#### Achados registrados e deliberadamente NÃO implementados nesta fatia

A revisão levantou outros pontos, todos **classificados como não bloqueantes** e mantidos como observação — **não** são requisitos homologados e **não** foram convertidos em implementação:

| ID | Ponto | Estado |
| --- | --- | --- |
| `A-02` | TOCTOU entre a checagem de usuário ativo e a criação da sessão em `emitir` (janela de microssegundos; o controle autoritativo é a revogação em massa de T-07/RN-005, fatia posterior) | **melhoria futura** — não implementado |
| `A-04` | `verificadorConfere` aceita `token_hash` com sufixo não-hexadecimal (só alcançável por quem já escreve na coluna — não é fronteira de segurança) | **observação** — não implementado |
| `A-05` | `SESSAO_INEXISTENTE` × `SEGREDO_INVALIDO` distinguíveis no contrato interno; a F3 **deve** mapeá-los para resposta HTTP única | **observação para a F3** |
| `A-06` | O teste de convergência depende de leitura síncrona do relógio (modo de falha **seguro**: falha ruidosamente, não produz falso positivo) | **observação** — não implementado |
| `A-03` | Contagem do `verify:argon2-runtime` documentada como "16/16" | **corrigida** (`C-02`) para as **15** verificações efetivamente medidas |

#### Correção da leitura do challenge 3 (`GREATEST`)

A revisão executou uma sonda dedicada, com `WHERE` deliberadamente **fraco** (que permanece verdadeiro após a atualização concorrente), e mediu que a cláusula `SET` **é avaliada sobre a versão NOVA** da linha: `GREATEST` **impediu a regressão** exatamente onde o predicado não protegia — final `10:05`, e não `10:02`. A leitura correta, portanto, é: `GREATEST` **não é decorativo**; é uma barreira **real**, hoje **sombreada** por um predicado mais forte, e por isso comportamentalmente inobservável sob as invariantes atuais. Deve **permanecer**.

## 6-F. Etapa 2.3D-B / F3 — endpoints REST de autenticação

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** — ver §6-I para o rito de fechamento e §11, REV. 19. Esta seção preserva o registro da **primeira execução** da fatia: implementada e medida em 27/08/2026 na branch `agent/fase2-etapa2.3d-f3-auth-http`, a partir de `main` = `9a22262c515c8b97c73dc7cf8493252db07dd501` (baseline confirmada: F0, F1 e F2 integradas; `R-2.3D-03` encerrado; F3 não iniciada). **Naquela execução a publicação não era autorizada** — sem commit, push, PR, merge, tag ou deploy —, e o passo seguinte foi a revisão técnica independente adversarial registrada em §6-G/§6-H.

Fontes normativas materializadas: **`D-2.3D-06`** (`docs/12` §5.6), **`D-2.3D-07`** (§5.7), **`D-2.3D-11`** (§5.11) e **`D-2.3D-12`** (§5.12) — **nenhuma delas foi alterada**, e `docs/12` **não foi tocado**. Requisitos: AUT-001, AUT-002, AUT-006; FC-01 (`docs/05` §4, inclusive o bloco *Auditoria*); `docs/09` §5/§12 (`D-AUD-01`/`D-AUD-03`/`D-AUD-07`/`D-AUD-08`). **Zero mudança física de persistência**: `packages/` inteiro com diff vazio contra `9a22262`. **Uma dependência nova**, prevista pela própria decisão: `@nestjs/swagger@11.4.7` (§6-F.7).

### 6-F.1 Componentes implementados

Primeira fatia da frente de backend com **exposição HTTP real**.

| Arquivo | Papel | Estado |
| --- | --- | --- |
| `src/auth/politica-cookie.ts` | `D-2.3D-07` — resolução da política de cookie por ambiente, fail-fast de `R-2.3D-04`, montagem de `Set-Cookie` de emissão **e** de limpeza (fonte única), leitura fail-closed do cookie | novo (252 linhas) |
| `src/auth/limitador-login.ts` | `D-2.3D-06` — contadores de falha em memória de processo, duas dimensões, janela deslizante, poda, teto de entradas, `Retry-After` | novo (300) |
| `src/auth/protecao-csrf.guard.ts` | `D-2.3D-07` — baseline CSRF: custom header, `application/json`, Fetch Metadata, `Origin`; função pura + guard | novo (169) |
| `src/auth/auth.dto.ts` | contratos HTTP, catálogo fechado de erro, validação estrutural pura do payload | novo (175) |
| `src/auth/autenticacao.service.ts` | orquestração de login/logout e emissão dos eventos de `D-2.3D-12` e de FC-01 | novo (240) |
| `src/auth/auth.controller.ts` | `POST /auth/login`, `POST /auth/logout` + decorators OpenAPI | novo (279) |
| `src/auth/erro-autenticacao.filter.ts` | normalização do contrato de erro das duas rotas (inclusive erros de middleware) | novo (118) |
| `src/openapi/documento-openapi.ts` | `D-2.3D-11` — construção e montagem do documento OpenAPI | novo (129) |
| `src/auth/auth.module.ts` | passa a declarar o controller e a importar `AuditModule` | alterado |
| `src/auth/sessao.service.ts` | acréscimo **aditivo** de `emitirEm` / `revogarEm` (§6-F.2) | alterado |
| `src/main.ts` | montagem do documento OpenAPI entre `create` e `listen`; CORS segue ausente | alterado |
| `scripts/verify-openapi-runtime.mjs` | prova de runtime do OpenAPI contra o `dist/` ESM real | novo (267) |
| `scripts/smoke-api.mjs` (raiz) | duas provas novas no processo real (`/openapi.json`; recusa CSRF) | alterado |
| `.github/workflows/ci.yml` | passo `verify:openapi-runtime` | alterado |
| `.env.example` | variável `TLF_AMBIENTE` documentada | alterado |

### 6-F.2 Ampliação de fronteira — as duas únicas, ambas previstas

1. **`AuthModule` passa a importar `AuditModule`.** Até a F2 ele estava deliberadamente fora, porque `usuario.autenticacao` e a auditoria de logout pertenciam a esta fatia (`docs/12` §9). Agora pertencem. `auth.module.integration.spec.ts` falha se **qualquer outro** módulo aparecer nos imports.
2. **`SessaoService` ganhou `emitirEm(tx, …)` e `revogarEm(tx, …)`** — **aditivos, sem nenhuma mudança de semântica**: `emitir`/`revogar` viraram invólucros transacionais e todo o corpo migrou sem alteração, inclusive a ordem obrigatória de `C-01` (detecção de expiração antes da revogação). **Motivo:** o contrato do `AuditWriter` (`D-AUD-08`) exige que o evento entre na **mesma transação** da mutação de negócio — aqui, a criação e o encerramento da sessão. Sem esse ponto de entrada, o login abriria duas transações independentes e existiria um desfecho em que a sessão nasce sem seu evento. É o mesmo padrão que o `AuditWriter` já adota: quem tem a fronteira transacional a passa explicitamente.

Nada de F4+ nasceu: nenhum guard/decorator de RBAC, nenhuma resolução de papéis, nenhum seed, nenhum bootstrap de Administrador, nenhuma rota de recuperação de senha, nenhuma revogação de terceiro, nenhum refresh token, nenhum JWT, nenhum CORS, nenhum frontend.

### 6-F.3 Contratos HTTP

Rotas, status e formatos **não são fixados por fonte homologada**; adota-se a alternativa REST mínima e convencional, registrada como **decisão local de implementação** (§6-F.8).

| Rota | Método | Requisição | Sucesso | Erros |
| --- | --- | --- | --- | --- |
| `/auth/login` | `POST` | `application/json` + `X-TLF-Requisicao`; `{ identificador, senha }` | `200` `{ usuarioId, expiraEm }` + `Set-Cookie` da sessão | `400` `REQUISICAO_INVALIDA` · `401` `CREDENCIAIS_INVALIDAS` · `403` `REQUISICAO_NAO_AUTORIZADA` · `429` `TENTATIVAS_EXCEDIDAS` + `Retry-After` · `500` `FALHA_INTERNA` |
| `/auth/logout` | `POST` | `application/json` + `X-TLF-Requisicao`; cookie de sessão; sem corpo útil | `204` sem corpo + `Set-Cookie` de limpeza | `401` `SESSAO_INVALIDA` (uniforme) · `403` `REQUISICAO_NAO_AUTORIZADA` · `500` `FALHA_INTERNA` |

Corpo de erro **único** em toda a fronteira: `{ "erro": "<CODIGO>" }`, código de conjunto fechado. O token de sessão **não aparece no corpo em hipótese alguma** — sai exclusivamente pelo cookie `HttpOnly` (`D-2.3D-07`). O logout **não devolve** id, estado, instante ou qualquer informação interna da sessão. O cookie é **limpo em todos os desfechos** do logout, inclusive na falha.

### 6-F.4 `D-2.3D-06` — rate limiting do login

| Item | Materialização |
| --- | --- |
| Limites | **5 falhas / 15 min** por identificador normalizado e hasheado; **30 falhas / 15 min** por IP — exatamente os valores homologados |
| Mecanismo | dois `Map` de processo. **Sem Redis, sem armazenamento externo, sem dependência nova.** Provado negativamente: duas instâncias no mesmo processo não compartilham contador |
| Janela | **deslizante**, por lista de instantes por chave; libera quando a falha mais antiga sai da janela — **sem lockout duro** |
| Hash do identificador | **HMAC-SHA-256 com chave aleatória de processo**, não SHA-256 puro. Um e-mail tem entropia baixa e seu digest simples seria reconstruível; com chave de processo, o mapa não é uma lista de identificadores tentados. Provado: nenhuma chave é, contém ou revela o identificador; duas instâncias produzem chaves diferentes para o mesmo identificador |
| Poda / expiração | por chave em toda leitura, **mais** varredura global periódica a cada 1 000 admissões. **Sem timer** — nenhum `setInterval` segura o event loop no encerramento |
| Teto de entradas | `MAXIMO_DE_ENTRADAS = 50 000` por dimensão. **CORRIGIDO pela revisão independente (`F-05`, §6-G.3): a heurística original — despejar a entrada de expiração mais próxima — removia justamente a vítima BLOQUEADA há mais tempo, e o racional aqui registrado estava materialmente invertido.** Vale agora: bucket bloqueado ou com reserva em voo é indespejável; entre candidatos seguros vence o de menor número de falhas; sem candidato seguro, a admissão é recusada |
| `Retry-After` | segundos até a falha mais antiga sair da janela; **nunca 0** enquanto bloqueado; quando as duas dimensões bloqueiam, prevalece o **maior**. **`F-09` (revisão): o relógio era `Date.now()` — descrito no código como "monotônico", o que era falso — e uma regressão de relógio produzia `Retry-After` de 1 200 s, acima da janela de 900 s. Agora o relógio é de fato monotônico e o valor tem teto (§6-G.1)** |
| **Ordem vs. Argon2** | a **consulta** ao limitador precede a busca do usuário e o `verify`. Tentativa bloqueada retorna `429` **sem executar Argon2, sem consultar o banco e sem emitir evento** — medido por espiã sobre `verificarComCaminhoDummy`, com **controle positivo** (uma tentativa admitida de fato executa o Argon2) |
| Contabilização | `registrarFalha` só é chamado para tentativa **bem-formada, admitida e rejeitada pela autenticação** — a mesma condição de `D-2.3D-12`. Tentativa já bloqueada **não** conta: contá-la converteria o limite temporal no lockout progressivo que a alternativa A-08 rejeita |
| Restart | zera os contadores — **limitação homologada** (`R-2.3D-02`/`P-2.3D-06`), não corrigida aqui |

**Fronteira preservada:** `docs/12` §5.6 tem duas metades. O limite de **conclusão de recuperação de senha** (10 tentativas / 15 min por IP) pertence à F6 e **não** foi implementado, preparado nem parametrizado.

**Limitação declarada, no espírito de `R-2.3D-02`:** sob pressão suficiente para encher uma dimensão, chaves NOVAS passam a ser recusadas transitoriamente (`429`). Nenhum bloqueio vigente é sacrificado — ver `F-05` em §6-G.3, que corrigiu o comportamento anterior. **Restart continua zerando os contadores**, limitação homologada do MVP.

### 6-F.5 `D-2.3D-07` — cookie e CSRF

**Cookie, por ambiente (`TLF_AMBIENTE`):**

| Ambiente | Nome | Atributos |
| --- | --- | --- |
| `producao` / `homologacao` | `__Host-tlf_sessao` | `HttpOnly` · `Secure` · `SameSite=Strict` · `Path=/` · **sem** `Domain` |
| `desenvolvimento` / `teste` | `tlf_sessao_dev` | `HttpOnly` · `SameSite=Strict` · `Path=/` · **sem** `Domain` · sem `Secure` (HTTP local) |

Sem detecção de navegador (alternativa A-09). **Sem `Max-Age`/`Expires`** — decisão local: o cookie é de sessão de navegador e o teto absoluto de 8 h já é enforçado no backend por `D-2.3D-04`; um prazo no cookie seria segunda fonte da mesma verdade. `set` e `clear` derivam do **mesmo** objeto e reutilizam literalmente os mesmos atributos: divergir é impossível por construção, e o teste compara os dois cabeçalhos atributo a atributo nos quatro ambientes.

**`R-2.3D-04` — fail-fast de bootstrap, em três barreiras:**

1. `TLF_AMBIENTE` com valor desconhecido **falha** — nunca degrada silenciosamente para desenvolvimento;
2. `NODE_ENV=production` sem ambiente protegido declarado **falha** — é a barreira que pega o deploy que esqueceu de declarar a variável;
3. a política construída para ambiente protegido é **reverificada** contra a invariante de `D-2.3D-07` antes de ser devolvida.

A resolução acontece numa **fábrica de provider** de `AuthModule`, isto é, dentro de `NestFactory.create`: configuração insegura faz a aplicação **não subir**. Provado em três níveis: função pura (`politica-cookie.spec.ts`), container NestJS real (`auth.module.integration.spec.ts`) e artefato compilado (`verify:openapi-runtime`).

**CSRF — a baseline homologada, e nada além dela:**

| Camada | Comportamento |
| --- | --- |
| Custom request header | `X-TLF-Requisicao` **obrigatório**, qualquer valor não vazio. Decisão local do nome (§6-F.8); a proteção está no nome ser não-simples |
| Content type | somente `application/json` (parâmetros como `; charset=utf-8` são aceitos) — fecha a brecha do formulário HTML |
| Fetch Metadata | `Sec-Fetch-Site` deve ser `same-origin`/`none`; `Sec-Fetch-Mode` não pode ser `navigate`; `Sec-Fetch-Dest` deve ser `empty` — avaliados **quando enviados** |
| `Origin` | quando presente, tem de ser a própria origem (comparação contra `Host`); `null` e valores não analisáveis são recusados |
| `SameSite=Strict` | na política de cookie |
| CORS | **não habilitado** — a ausência de `enableCors` é deliberada e é parte da baseline |

Aplicada também ao **login**, deliberadamente: *login-CSRF* é ataque real e o custo para o cliente legítimo é zero. Rejeição **uniforme**: `403` `{ "erro": "REQUISICAO_NAO_AUTORIZADA" }`, sem dizer qual camada recusou. **Synchronizer token não foi implementado e não é registrado como obrigação futura** (alternativa A-10); `P-2.3D-04` permanece **ABERTA**.

Fail-closed sem quebrar o legítimo: ausência de `Origin`/Fetch Metadata (clientes não navegador, `curl`, o smoke da CI) **não** derruba sozinha a requisição — o custom header continua obrigatório em todos os casos, e é justamente ele que um navegador atacante não transpõe.

### 6-F.6 `D-2.3D-12` e a auditoria de FC-01

**Falha de autenticação — literal, com `contexto` vazio (whitelist vazia de `D-AUD-07`, não ampliada):**

| Situação | `acao` | `resultado` | `ator_usuario_id` | `alvo_tipo` | `alvo_id` | `contexto` |
| --- | --- | --- | --- | --- | --- | --- |
| Conta existente (senha errada) | `usuario.autenticacao` | `FALHA` | `NULL` | `usuario` | `usuario.id` | `{}` |
| Conta **inativa** | `usuario.autenticacao` | `FALHA` | `NULL` | `usuario` | `usuario.id` | `{}` |
| Conta inexistente | `usuario.autenticacao` | `FALHA` | `NULL` | `usuario` | `NULL` | `{}` |

**Não geram evento** — provado negativamente contra o banco: payload malformado (`400`), requisição recusada pela baseline CSRF (`403`) e tentativa bloqueada pelo rate limiter (`429`).

**Auditoria adicional, apenas o que já é normativamente exigido** (FC-01 §Auditoria — "login bem-sucedido", "falhas relevantes", "logout"; `docs/09` §5, ambas as linhas **DD**):

| Evento | `acao` | `resultado` | `ator` | `alvo_tipo` | `alvo_id` |
| --- | --- | --- | --- | --- | --- |
| Login bem-sucedido | `usuario.autenticacao` | `SUCESSO` | `usuario.id` | `usuario` | `usuario.id` |
| Logout | `usuario.sessao.logout` | `SUCESSO` | `usuario.id` | `sessao_autenticacao` | `sessao.id` |

**Nenhuma ação nova foi criada; nenhuma whitelist foi ampliada; nenhuma chave de `contexto` foi introduzida.** `contexto` é **omitido** (coluna `NULL`) em vez de enviado como `{}` — o validator trata ausente e vazio identicamente, e é o precedente já vigente em `profissional.situacao.alterada`. `justificativa` é `NULL` em todos: nenhuma fonte a exige aqui. O catálogo tipado e o validator fail-closed existentes são consumidos sem alteração.

**Atomicidade:** login → `emitirEm` + evento na **mesma** transação; logout → `revogarEm` + evento na **mesma** transação. O evento de **falha** vive em transação própria — é a única forma possível, porque não houve mutação de negócio à qual se acoplar, e não enfraquece garantia alguma.

**Logout com sessão já terminal não emite evento**: nada mudou, e registrar a tentativa transformaria a auditoria num contador de ruído (`docs/09` §5: "resultado necessário? Não — só sucesso").

**Ausência de segredo**, provada por varredura sobre `SELECT * FROM evento_auditoria` e sobre toda escrita em `console`: identificador tentado, senha, token, segredo, cookie e digest Argon2 **não aparecem**.

### 6-F.7 `D-2.3D-11` e `P-2.3D-03` — medição e **Caminho A**

Medição da baseline candidata, executada **antes** de qualquer instalação e depois confirmada em runtime:

```text
npm view @nestjs/swagger@11.4.7 version peerDependencies engines license
  version = 11.4.7
  license = MIT
  engines = (não declarado)
  peerDependencies: @nestjs/core ^11.0.1 · @nestjs/common ^11.0.1 ·
                    reflect-metadata ^0.1.12 || ^0.2.0 ·
                    @fastify/static ^8|^9|^10 (OPCIONAL) ·
                    class-validator * (OPCIONAL) · class-transformer * (OPCIONAL)
  dependencies: lodash · js-yaml · path-to-regexp · swagger-ui-dist ·
                @microsoft/tsdoc · @nestjs/mapped-types
```

**Cadeia transitiva com telemetria, apontada pela revisão independente (`F-11`):** `swagger-ui-dist@5.32.13` traz `@scarf/scarf@1.4.0`, pacote de telemetria de instalação com `postinstall` de rede. Ele **não participa do runtime** (a UI do Swagger não é servida) e foi **desligado explicitamente** por `scarfSettings.enabled = false` no `package.json` da raiz — ver §6-G.8.

`@nestjs/core`/`@nestjs/common` vigentes são `11.2.3` — dentro da faixa. Os três peers restantes são **opcionais** (`peerDependenciesMeta.optional = true`, medido), e **nenhum deles foi instalado**: `class-validator`/`class-transformer` não entraram no projeto.

| Verificação | Resultado |
| --- | --- |
| `tsc --noEmit` com `module`/`moduleResolution` `nodenext` e **`skipLibCheck: false`** | **verde** |
| `tsc -p tsconfig.build.json` (ESM real) | **verde** |
| Import ESM do artefato compilado, fora do Jest (`node`, sem loader) | **verde** |
| `DocumentBuilder` + `SwaggerModule.createDocument` sobre o `AppModule` **compilado** | **verde** |
| Bootstrap do processo real `node apps/api/dist/main.js` servindo `/openapi.json` | **verde** (smoke) |
| `npm ci` reproduzível / lockfile coerente | **verde** — 7 pacotes acrescentados, instalados **apenas** no workspace `@techlab-fisio/api` |

**Nenhuma incompatibilidade técnica reproduzível foi encontrada.** Adotado o **Caminho A**: `@nestjs/swagger@11.4.7`, versão exata, **sem troca silenciosa por versão mais nova**. O fallback autoral previsto por `D-2.3D-11` **não foi necessário** e não foi construído. `D-ESM-01` **não foi alterada**.

Contrato: **decorators explícitos**, sem plugin de compilação — nada é inferido silenciosamente de tipos. **Sem UI**: `swagger-ui-dist` vem como dependência transitiva, mas a interface **não é servida** em caminho algum (provado: `/openapi` responde `404`); só o JSON, e apenas em ambientes não protegidos (decisão local, §6-F.8). Nenhuma dependência extra de UI foi instalada.

**Modos de falha MEDIDOS e corrigidos nesta fatia** — ambos silenciosos, ambos encontrados pelas próprias provas:

1. **`raw` é obrigatório.** Em `@nestjs/swagger@11.4.7`, desligar a UI **não** basta: a rota do documento só é registrada quando `raw` inclui o formato. Sem `raw: ["json"]`, `jsonDocumentUrl` responde `404`.
2. **Ordem de montagem.** O Nest registra o handler de rota desconhecida durante a inicialização; uma rota montada **depois** fica atrás dele e responde `404`. `montarDocumentoOpenApi` roda entre `NestFactory.create` e `listen` — e o smoke prova isso no processo real.

**Estado de `P-2.3D-03`: MEDIDA e verde — encerramento formal PENDENTE de decisão de Bruno Menezes Noronha.** `docs/12` **não foi alterado** nesta execução: o precedente vigente (REV. 1 para `P-2.3D-02`; REV. 2 para `R-2.3D-03`) é o de encerramento **por decisão expressa**, após revisão. `R-2.3D-06` (incompatibilidade de `@nestjs/swagger`) fica **materialmente afastado** pela medição, com a mesma ressalva de forma.

### 6-F.8 Decisões locais de implementação — reversíveis, **não** são norma

Rotuladas como tais no próprio código. Nenhuma reabre, estende ou reinterpreta decisão homologada.

| ID | Decisão | Racional |
| --- | --- | --- |
| `L-01` | Rotas `POST /auth/login` e `POST /auth/logout` | alternativa REST mínima e convencional; nenhuma fonte fixa a rota |
| `L-02` | `200` com corpo mínimo no login; `204` sem corpo no logout | não há representação a devolver no logout, e o único artefato é o `Set-Cookie` de limpeza |
| `L-03` | Corpo de erro único `{ "erro": "<CODIGO>" }`, conjunto fechado | contrato deliberado, estável e testável; nenhuma mensagem livre |
| `L-04` | `401` autenticação/sessão · `429` rate limit · `403` CSRF · `400` payload · `500` falha técnica | convenção HTTP; `500` distinto de `401` por §6-F.9 |
| `L-05` | IP da dimensão de `D-2.3D-06` vem do **socket**, nunca de `X-Forwarded-For` | nenhuma topologia de proxy está homologada; confiar no cabeçalho daria um contador novo por requisição, abolindo a dimensão. Provado por teste |
| `L-06` | Nome do custom header CSRF: `X-TLF-Requisicao` | `D-2.3D-07` exige o header e não fixa o nome; prefixo do produto, estável, sem colisão |
| `L-07` | Segredo do cookie sem `Max-Age`/`Expires` | teto absoluto já é do backend; prazo no cookie seria segunda fonte da mesma verdade |
| `L-08` | Documento OpenAPI **sempre construído**; **rota** exposta só fora de produção/homologação | construir sempre transforma decorator quebrado em falha de bootstrap; publicar o mapa da API de autenticação não tem contrapartida operacional no MVP |
| `L-09` | Falha em `registrarFalha` **não** é limpa por login bem-sucedido | `D-2.3D-06` não decide; não limpar evita que quem conhece uma credencial válida zere o contador de IP |
| `L-10` | Log de falha técnica com **classe + correlação**, sem `message`/`stack` | mensagens do Prisma podem carregar a consulta e seus parâmetros; do Argon2, o digest. Limitação declarada, não propriedade |
| **`A-05`** | Os cinco motivos internos de sessão inválida colapsam numa **única** resposta HTTP | **observação** da revisão independente da F2 (§6-E.9) — **não é requisito homologado**. Adotada por ser coerente com a disciplina anti-enumeração de AUT-001/`D-2.3D-12` e com o critério de que o logout não vire oráculo do estado interno. Coberta por teste |

### 6-F.9 Tratamento de erros — o defeito medido e a correção

Um corpo JSON sintaticamente inválido **nunca chega ao controller**: é rejeitado pelo body parser, registrado como middleware global pelo próprio `NestFactory`. O desfecho padrão, **medido nesta fatia**, era

```text
400 {"message":"Expected property name or '}' in JSON at position 1 ...",
     "error":"Bad Request","statusCode":400}
```

— que **não** é o contrato fechado declarado no OpenAPI para `400` (contrato e runtime divergentes) e cuja mensagem é detalhe do parser, não decisão da fronteira. Um filtro de controller não alcança o caso, porque o erro nasce **antes** do roteamento.

`FiltroErroAutenticacao` (`APP_FILTER`) fecha a lacuna com escopo **deliberadamente estreito**: age **apenas** nas duas operações da F3 e delega ao comportamento padrão do Nest em qualquer outro caminho — o `404` de rota desconhecida e o `GET /health` seguem exatamente como eram. **Ressalva registrada pela revisão independente (`F-06`/`F-07`): na primeira versão o escopo comparava a URL crua e não reconhecia `/auth/login/` nem `/AUTH/LOGIN`, variantes que o próprio roteador aceita — o vazamento reaparecia por elas. Corrigido em §6-G.5, junto com a exigência do método `POST`.**

**Falha técnica não é mascarada como credencial inválida.** Exceção inesperada — erro do driver, falha do addon do Argon2, indisponibilidade — vira `500 FALHA_INTERNA`, **jamais `401`**: devolver `401` destruiria a observabilidade operacional (todo incidente pareceria senha errada) e mentiria para o cliente. Provado com exceção sintética portando um valor sensível, que não chega ao cliente. Nenhuma resposta de erro carrega stack trace, erro Prisma, erro Argon2, hash, token, cookie ou SQL — varrido por teste.

### 6-F.10 `T-AUTH-ENUMERATION`

Prova **estrutural**, não temporal — nenhum limiar de milissegundos participa de asserção alguma.

| Propriedade | Como é provada |
| --- | --- |
| Conta inexistente percorre o **caminho dummy** | espiã sobre `verificarComCaminhoDummy`: chamada **duas** vezes, uma por caso; a existente recebe o digest PHC real, a inexistente recebe `null` e o resultado é `false` |
| Contrato HTTP observável **idêntico** | mesmo status, mesmo corpo, mesmo conjunto de `Set-Cookie` e mesmo conjunto de nomes de cabeçalho (exceto `date`/`etag`) |
| Conta **inativa** indistinguível | mesma comparação, contra o caso inexistente |
| Mesma estrutura de auditoria | duas linhas com mesma `acao`, `resultado`, `ator` (NULL), `alvo_tipo` e `contexto`; a **única** diferença é o `alvo_id`, que `D-2.3D-12` determina e que não é observável pelo cliente |
| Identificador inexistente **não** aparece | varredura de `SELECT * FROM evento_auditoria` e de toda escrita em `console` |
| `429` **antes** do Argon2 | espiã não é chamada com a janela saturada; controle positivo confirma que a espiã discrimina |
| Payload malformado **não** chega à autenticação/auditoria | `400` e zero eventos |
| Contabilização simétrica | existente e inexistente chegam a `429` com o mesmo número de tentativas — um identificador inexistente que não contasse seria, por si só, um oráculo |

**Medição complementar — evidência, não gate.** Cinco amostras por caso, mediana, com falha apenas em diferença **grosseira** (razão ≥ 10, que indicaria um caminho inteiro a mais ou a menos, não ruído):

```text
[T-AUTH-ENUMERATION] mediana existente=33,6 ms · inexistente=34,9 ms · razão=1,04
```

### 6-F.11 Provas medidas

Ambiente: Node 24.18.0 · npm 11.16.0 · win32-x64 · PostgreSQL 18 em instância descartável.

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` | 0 | verde (inclui `tsconfig.test.json`) |
| `npm run test:api` | 0 | **15 suites · 405 passed · 0 failed · 0 skipped** |
| `npm run verify:api-integration` | 0 | **6 suites · 173 passed · 0 failed · 0 skipped** (PostgreSQL real, `tlf_app`) |
| `npm run verify:from-scratch` | 0 | **10 suites · 87 passed** — replay integral do histórico |
| `npm run build` | 0 | verde (`packages/database` → `apps/api`, ESM) |
| `npm run smoke:api` | 0 | processo real `node dist/main.js`: `/health` `200`; `404` sem stack; **`/openapi.json` `200` com as rotas da F3**; **`POST /auth/login` sem custom header → `403` sem cookie**; encerramento limpo |
| `npm run verify:argon2-runtime --workspace @techlab-fisio/api` | 0 | **15/15** verificações |
| `npm run verify:openapi-runtime --workspace @techlab-fisio/api` | 0 | **15/15** verificações (novo) |
| `npm run lint:migrations` | 0 | Guarda 1 — 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` | 0 | Guarda 3 — dump byte a byte idêntico ao golden (60 169 bytes); `migrate diff --exit-code` = 0 |
| `git diff --check` | 0 | limpo |

O enunciado desta fatia cita `npm run verify:argon2-runtime -w api`; o alias `-w api` **não resolve** neste monorepositório — o workspace chama-se `@techlab-fisio/api`. Executado com o nome correto.

### 6-F.12 Challenges de mutação — todos detectados, todos revertidos

Cada mutação foi aplicada temporariamente, o detector executado, a falha confirmada e o arquivo **restaurado com verificação por hash SHA-256**. **Nenhuma mutação sobreviveu**: a árvore final foi reconferida por `grep` e pela bateria integral.

| # | Mutação | Detector | Exit | Detectado |
| --- | --- | --- | --- | --- |
| `C-01` | remover o rate limit por identificador | `test/limitador-login.spec.ts` | 1 | ✅ 9 testes falham |
| `C-02` | mover o rate limit para **depois** do Argon2 | integração — "ORDEM — Argon2 NÃO é executado quando a tentativa já está bloqueada" | 1 | ✅ |
| `C-03` | usar o identificador **em claro** no contador | `test/limitador-login.spec.ts` | 1 | ✅ 2 testes falham |
| `C-04` | não marcar `Secure` em produção (**com a barreira também desligada**) | `test/politica-cookie.spec.ts` | 1 | ✅ 5 testes falham |
| `C-04b` | idem, medido contra o `dist/` ESM real | `verify:openapi-runtime` | 1 | ✅ "produção resolve o cookie SEGURO" falha |
| `C-05` | aceitar mutação **sem** proteção CSRF | integração — "D-2.3D-07 — CSRF na fronteira real" | 1 | ✅ 7 testes falham |
| `C-06` | status **diferente** para conta inexistente | integração — T-AUTH-ENUMERATION "contrato HTTP observável é idêntico" | 1 | ✅ |
| `C-06b` | conta inexistente **pula** o caminho dummy | integração — T-AUTH-ENUMERATION "mesmo caminho de verificação" | 1 | ✅ |
| `C-07` | omitir a auditoria da falha admitida | integração — "D-2.3D-12 — auditoria da falha admitida" | 1 | ✅ 4 testes falham |
| `C-08` | auditar payload rejeitado **antes** da autenticação | integração — "payload REJEITADO ANTES da autenticação NÃO gera evento" | 1 | ✅ |
| `C-09` | auditar tentativa já bloqueada com `429` | integração — "requisição BLOQUEADA com 429 NÃO gera evento adicional" | 1 | ✅ |
| `C-10` | expor o token de sessão no JSON | integração — "o token sai EXCLUSIVAMENTE pelo cookie" | 1 | ✅ |
| `C-11` | remover a documentação OpenAPI do `429` de `/auth/login` | `test/openapi.spec.ts` | 1 | ✅ 2 testes falham |
| `C-11b` | idem, medido contra o `dist/` ESM real | `verify:openapi-runtime` | 1 | ✅ |

### 6-F.13 Zero drift de persistência

```text
git diff 9a22262 -- packages/database          -> VAZIO
git diff 9a22262 -- packages/database/prisma   -> VAZIO
git diff 9a22262 --stat -- packages/           -> VAZIO
```

`schema.prisma`, `schema.golden.sql` e `protected-objects.json` com **blob idêntico** ao da baseline; **10 migrations**, nenhuma nova. `prisma format`, `migrate dev`, `db push` e `db pull` **não** foram executados. Guardas 1 e 3 verdes; Guarda 2 verde dentro de `verify:from-scratch`.

### 6-F.14 Fronteira — o que a F3 deliberadamente NÃO fez

Sem guards ou decorators de RBAC, resolução de papéis/permissões ou `D-2.3D-09` (F4); sem seed de papéis e sem bootstrap do primeiro Administrador (`D-2.3D-10`, F5); sem recuperação de senha e sem o rate limit próprio dela (`D-2.3D-08`/§5.6 segunda metade, F6); sem frontend; sem autorização clínica; sem endpoints de profissionais, pacientes ou agenda; sem refresh token; sem JWT; sem armazenamento externo de rate limit ou Redis; sem multitenancy; sem sessão por dispositivo; sem CORS cross-origin; sem synchronizer token CSRF; sem qualquer ampliação do catálogo de auditoria ou de whitelist de `contexto`; sem alteração de schema, migration, golden ou objetos protegidos; sem alteração de qualquer `D-2.3D-*`. Provado por asserção mecânica: as rotas publicadas pela aplicação são exatamente `/health`, `/auth/login` e `/auth/logout`, e `AuthModule` importa exatamente `DatabaseModule` e `AuditModule`.

**Não materializado por estar fora do escopo enumerado desta fatia:** a **persistência do rehash** de `D-2.3D-02` — `CredencialService.precisaRehash` existe desde a F1 e o registro da F1 remete a decisão de persistir ao fluxo de login. O enunciado da F3 manda materializar **exclusivamente** os dez itens que lista, e rehash não é um deles. Fica registrado em §9 para que não se perca silenciosamente.

## 6-G. Etapa 2.3D-B / F3 — correções pós-revisão independente

**Estado: registro histórico da PRIMEIRA fatia corretiva — superado por §6-H e encerrado por §6-I.** Executada em 28/08/2026 sobre a working tree revisada, a partir da mesma baseline `main` = `9a22262c515c8b97c73dc7cf8493252db07dd501`. **Naquela execução a publicação não era autorizada** — sem commit, push, PR, merge, tag ou deploy. A fatia como um todo foi homologada e integrada em 28/08/2026 (§6-I; §11, REV. 19).

A F3 foi submetida a **revisão técnica independente e adversarial**, com veredito **`B — APTO COM CORREÇÕES OBJETIVAS`** e catorze achados (`F-01`..`F-14`). Esta seção registra o tratamento de cada um. **Nenhuma decisão `D-2.3D-*` foi criada, alterada ou reaberta; `docs/12` não foi tocado.** A §6-F permanece como registro do estado que foi revisado e não é reescrita.

### 6-G.1 Tratamento por achado

| ID | Sev. | Ação | Arquivos | Prova |
| --- | --- | --- | --- | --- |
| `F-01` | ALTO | **CORRIGIDO** — reserva de tentativa em voo (§6-G.2) | `limitador-login.ts`, `autenticacao.service.ts` | `C-01`, `C-02`; testes de concorrência determinísticos |
| `F-02` | MÉDIO | **CORRIGIDO** — `TLF_AMBIENTE` obrigatória (§6-G.4) | `politica-cookie.ts`, `setup.ts`, `smoke-api.mjs`, `.env.example` | `C-04`; prova no processo real |
| `F-03` | MÉDIO | **CORRIGIDO** — 4xx do parser preservado, sem log de erro (§6-G.5) | `erro-autenticacao.filter.ts`, `auth.controller.ts` | `C-06`, `C-13` |
| `F-04` | MÉDIO | **CORRIGIDO** — rehash de `D-2.3D-02` materializado (§6-G.6) | `autenticacao.service.ts` | `C-07`, `C-08` |
| `F-05` | MÉDIO | **CORRIGIDO** — despejo nunca sacrifica bloqueio (§6-G.3) | `limitador-login.ts` | `C-03` |
| `F-06` | BAIXO | **CORRIGIDO** — normalização de caminho no filtro | `erro-autenticacao.filter.ts` | integração: 4 variantes de caminho |
| `F-07` | BAIXO | **RESOLVIDO por consequência** — o filtro passou a exigir `POST`; `GET /auth/login` volta ao `404` da plataforma e sai do contrato | `erro-autenticacao.filter.ts` | integração |
| `F-08` | BAIXO | **CORRIGIDO** — cookie limpo só após o desfecho (§6-G.7) | `auth.controller.ts` | `C-09` |
| `F-09` | BAIXO | **CORRIGIDO** — relógio monotônico + teto de `Retry-After` | `limitador-login.ts` | teste de relógio regressivo |
| `F-10` | BAIXO | **CORRIGIDO** — normalização IPv4-mapped | `limitador-login.ts` | `C-10` |
| `F-11` | BAIXO | **TRATADO E DOCUMENTADO** — opt-out do Scarf (§6-G.8) | `package.json` (raiz), `supply-chain.spec.ts` | `C-12` |
| `F-12` | BAIXO | **MANTIDO — decisão consciente** (§6-G.9) | — | racional registrado |
| `F-13` | BAIXO | **CORRIGIDO** — `Origin` valida protocolo por ambiente | `protecao-csrf.guard.ts`, `politica-cookie.ts` | `C-11` |
| `F-14` | BAIXO | **CORRIGIDO** — linguagem de `R-2.3D-04` requalificada (§9) | `docs/10` | — |

### 6-G.2 `F-01` — o gate de `D-2.3D-06` passa a valer sob concorrência

**O defeito, medido pela revisão.** A sequência era `consultar()` → `await` (leitura + Argon2, ~40 ms) → `registrarFalha()`. Um CHECK-THEN-ACT: todas as requisições em voo atravessavam o gate antes que qualquer falha fosse contabilizada.

```text
12 concorrentes, limite 5  ->  401=12  429=0  argon2=12   (controle sequencial: 401=5 429=7 argon2=5)
45 concorrentes, limite 30 ->  401=45  429=0  argon2=45
```

O limite homologado deixava de valer, e 45 Argon2 simultâneos (19 MiB cada) eram vetor de esgotamento de memória.

**A correção.** O limitador ganhou **reserva de tentativa**. `adquirir()` é síncrono, decide sobre `falhas_vivas + tentativas_em_voo` e reserva a vaga nas **duas** dimensões de uma só vez — antes de qualquer `await`. A reserva é encerrada por `registrarFalha()` (rejeição) ou `liberar()` (sucesso **ou erro técnico**), sempre em `finally`; as duas operações são **idempotentes**, de modo que o `finally` do chamador nunca desfaz uma falha nem decrementa duas vezes.

**Atomicidade entre dimensões:** se a segunda dimensão não couber, a primeira é desfeita. Nunca existe reserva órfã — provado por teste.

**Resultado medido, com barreira determinística sobre o verificador de credencial:**

| Cenário | Limite | Chegaram ao verificador | `401` | `429` | Reservas residuais |
| --- | --- | --- | --- | --- | --- |
| 12 concorrentes, mesmo identificador | 5 | **≤ 5** | ≤ 5 | ≥ 7 | **0** |
| 45 concorrentes, mesmo IP | 30 | **≤ 30** | ≤ 30 | ≥ 15 | **0** |

O teste não depende da velocidade real do Argon2: uma barreira segura as verificações em voo, a convergência do lote é aguardada com teto explícito e falha ruidosa, e a asserção é feita **antes** de liberar. O `verify` real não é executado nesses dois casos — o que se mede é o gate, e disparar 30 Argon2 simultâneos só consumiria memória; as provas de Argon2 real seguem nos demais blocos.

**Erro técnico** libera a reserva **sem** contabilizar falha de credencial: oito `500` seguidos não bloqueiam a conta, e o login seguinte é admitido — provado.

**DECISÃO LOCAL `L-11` (não normativa, reversível).** A reserva limita **tentativas simultâneas**, não apenas falhas. Um lote de logins simultâneos para o mesmo identificador acima das vagas em voo recebe **saturação transitória**: `429` com **`Retry-After: 1`**, e não os 15 minutos da janela. As vagas se devolvem em milissegundos, nenhuma falha é contabilizada e nenhum bloqueio persiste — provado. Quando há falhas **persistidas** suficientes, prevalece o cálculo real da janela.

### 6-G.3 `F-05` — a saturação não reseta mais um bloqueio vigente

**O defeito, medido.** A heurística anterior despejava a entrada de expiração mais próxima — que é exatamente a da vítima bloqueada há mais tempo. `vitimaAindaBloqueada=false` após flooding além do teto. O racional registrado em §6-F.4 (“a menos danosa a se perder”) estava **materialmente invertido** e fica **corrigido aqui**.

**A correção.** Nenhum bucket **bloqueado** e nenhum bucket **com reserva em voo** é despejável. Entre os candidatos seguros vence o de **menor número de falhas**; no empate, o mais antigo. Sem candidato seguro, a admissão é **recusada** (saturação transitória) — nunca se sacrifica um bloqueio para caber uma chave nova.

**Correção adicional de desempenho, descoberta ao escrever o teste.** A varredura da política de despejo percorria o mapa inteiro a cada admissão no teto — **O(n) por requisição**, com a varredura global também disparando por saturação. Sob ataque de saturação sustentada, o próprio mecanismo de defesa virava amplificador de CPU (medido: a suíte não terminava em 8 minutos). Agora o despejo examina uma **amostra limitada** das entradas mais antigas (`AMOSTRA_DE_DESPEJO = 64`) e a varredura global é **estritamente periódica**. Custo constante por requisição, com as duas guardas preservadas.

**Provas, todas com não-vacuidade assegurada** — os testes afirmam explicitamente que o teto foi atingido, porque a primeira versão deles era vacuamente verdadeira (a dimensão de IP saturava antes, e nenhum despejo chegava a ocorrer; defeito encontrado pelo próprio challenge `C-03`):

- vítima bloqueada permanece bloqueada após flooding de `MAXIMO + 500`;
- com **todos** os candidatos bloqueados, a chave nova é **recusada** e o bloqueio mais antigo sobrevive;
- o teto nunca é excedido;
- nenhuma reserva em voo é despejada — um bucket reservado tem zero falhas e seria o primeiro escolhido pelo critério de menor-falhas se a guarda não existisse;
- entradas expiradas são recolhidas antes de qualquer despejo de entrada viva.

### 6-G.4 `F-02` — ambiente fail-closed

`TLF_AMBIENTE` passa a ser **obrigatória**. Ausência, string vazia ou valor desconhecido **abortam o bootstrap**. `NODE_ENV` permanece apenas como checagem de **coerência** — nunca como fallback permissivo.

| Configuração | Antes | Agora |
| --- | --- | --- |
| `TLF_AMBIENTE` ausente | sobe como `desenvolvimento`, cookie `tlf_sessao_dev` sem `Secure` | **FALHA** — `AMBIENTE_AUSENTE` |
| `TLF_AMBIENTE` vazia / só espaços | idem | **FALHA** — `AMBIENTE_AUSENTE` |
| `TLF_AMBIENTE` desconhecida | FALHA | **FALHA** — `AMBIENTE_DESCONHECIDO` |
| Deploy realista só com `DATABASE_URL`/`PORT` | sobe inseguro | **FALHA** |
| `NODE_ENV=production` + ambiente não protegido | FALHA | **FALHA** — `AMBIENTE_INCOERENTE_COM_NODE_ENV` |
| `producao` / `homologacao` | `__Host-tlf_sessao` seguro | inalterado |
| `desenvolvimento` / `teste` | `tlf_sessao_dev` | inalterado |

Declaração explícita adicionada em `.env.example` (já presente), no `setupFiles` das suítes (`teste`) e no processo real do smoke (`desenvolvimento`). O smoke ganhou uma prova nova: **sem `TLF_AMBIENTE`, o processo real aborta o bootstrap** citando a variável — a única forma de provar o fail-closed no artefato que roda em produção.

### 6-G.5 `F-03` / `F-06` / `F-07` — fronteira e contrato do filtro

| Item | Antes | Agora |
| --- | --- | --- |
| Escopo | caminho exato, qualquer método | caminho **normalizado** (caixa e barra final) **e** método `POST` |
| `/auth/login/`, `/AUTH/LOGIN` | vazavam a mensagem do parser | contrato fechado |
| JSON malformado | `400` contrato fechado | inalterado |
| Corpo acima do limite | **`500 FALHA_INTERNA` + log de ERRO** | **`413` `REQUISICAO_INVALIDA`, sem log de erro** |
| `GET /auth/login` | `404` com corpo do contrato (status não documentado) | `404` da plataforma, fora do contrato dos endpoints `POST` |
| Falha técnica real | `500 FALHA_INTERNA` + log | inalterado |

O erro do body parser nasce **antes** da guard CSRF: qualquer cliente, sem custom header e sem autenticação, produzia uma entrada de log de nível ERROR por requisição grande. Isso poluía o log e destruía o significado operacional de `500`, que existe para marcar incidente de infraestrutura. `413` entrou no contrato OpenAPI dos dois endpoints.

### 6-G.6 `F-04` — rehash de `D-2.3D-02` materializado

**Situação encontrada.** `precisaRehash` existia desde a F1 e **nunca era chamado em produção** — código morto que mascarava a lacuna. `D-2.3D-02` lista "rehash quando os parâmetros persistidos estiverem defasados" como item da decisão homologada; a F1 entregou apenas a detecção e remeteu a persistência ao fluxo de login. Esse fluxo é o da F3.

**Isto não é decisão nova.** É o cumprimento de `D-2.3D-02`; `docs/12` não foi alterado.

**Implementação.** Após senha válida e usuário ativo:

1. `precisaRehash(hashVerificado)`;
2. se verdadeiro, o novo digest é gerado **fora da transação** — ~40 ms de Argon2 dentro dela prenderiam conexão e lock sem necessidade;
3. a escrita entra na **mesma transação** que emite a sessão e grava a auditoria de sucesso, **condicionada ao digest efetivamente verificado**:

```sql
UPDATE usuario SET senha_hash = <novo>
 WHERE id = <usuario> AND senha_hash = <o que foi verificado>
```

**Segurança concorrente.** Se a credencial mudou entre leitura e escrita (troca de senha, ação administrativa), o predicado não casa, a transação inteira reverte e o login termina no **`401` uniforme**: a credencial corrente **não** é sobrescrita, o hash antigo **não** é restaurado, nenhuma sessão nasce de credencial superada e o cliente não aprende que houve concorrência. A tentativa é auditada como rejeição, como qualquer outra.

**Provas medidas** (política deliberadamente defasada — `m=8192, t=1, p=1`): senha correta autentica; `precisaRehash` verdadeiro antes e **falso** depois; digest persistido muda, é `$argon2id$` e passa a refletir `m=19456, t=2, p=1`; a senha continua verificável e a incorreta continua recusada; segundo login não regrava; senha incorreta, usuário inativo e usuário inexistente **nunca** geram rehash nem persistência; falha da transação não deixa estado parcial e o rehash é refeito no login seguinte; alteração concorrente não é sobrescrita.

### 6-G.7 `F-08` — o cookie não é mais perdido em rollback

O `Set-Cookie` de limpeza passou a ser escrito **depois** de conhecer o desfecho:

| Desfecho | Cookie limpo? |
| --- | --- |
| Logout encerrado | **sim** |
| Sessão inválida/terminal (desfecho conhecido) | **sim** |
| Falha técnica / rollback (`500`) | **não** |

Medido: com a auditoria falhando, o logout devolve `500`, a sessão permanece `ATIVA` (rollback correto) e **nenhum** `Set-Cookie` é emitido — o cliente conserva a credencial de uma sessão que o banco manteve viva, e um logout posterior a encerra normalmente.

### 6-G.8 `F-11` — telemetria transitiva desligada e declarada

Cadeia: **`@nestjs/swagger@11.4.7` → `swagger-ui-dist@5.32.13` → `@scarf/scarf@1.4.0`**. O `@scarf/scarf` é um pacote de **telemetria de instalação** com `postinstall` que faz requisição de rede; ele não participa do runtime da aplicação (a UI do Swagger não é servida). Opt-out aplicado no `package.json` da **raiz**, que é onde o pacote o procura:

```json
"scarfSettings": { "enabled": false }
```

Nenhuma dependência nova; nenhuma versão atualizada colateralmente; lockfile coerente. `supply-chain.spec.ts` passa a ser o detector — falha se o opt-out sumir ou for reativado, e também se `class-validator`, `class-transformer`, Redis, JWT, `cookie-parser` ou bibliotecas de rate limit externo entrarem no workspace.

### 6-G.9 `F-12` — mantido BAIXO, com racional

`AuditWriter` valida que recebeu cliente transacional; `SessaoService.emitirEm`/`revogarEm` não. A verificação existente é uma **função privada, não exportada**, de `audit-writer.ts`, e `packages/database` — intocável por zero drift — expõe apenas o **tipo** `TransacaoPersistencia`, nenhuma primitiva. Reutilizá-la exigiria criar dependência `auth → audit`, alterar `packages/database`, duplicar lógica privada ou criar abstração sem outro uso. Nenhuma dessas opções se justifica para um achado BAIXO cuja superfície é interna e tipada, e cujo cliente não transacional é privado em `DatabaseService`.

**`F-12` permanece BAIXO, aceito nesta fatia como decisão técnica consciente.**

### 6-G.10 Provas medidas

| Comando | Exit | Suites | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- | --- |
| `npm run typecheck` | 0 | — | — | 0 | — |
| `npm run test:api` | 0 | 16 | 432 | 0 | 0 |
| `npm run verify:api-integration` | 0 | 6 | 194 | 0 | 0 |
| `npm run verify:from-scratch` | 0 | 10 | 87 | 0 | 0 |
| `npm run build` | 0 | — | — | 0 | — |
| `npm run smoke:api` | 0 | — | 6 provas | 0 | — |
| `verify:argon2-runtime` | 0 | — | 15/15 | 0 | — |
| `verify:openapi-runtime` | 0 | — | 17/17 | 0 | — |
| `npm run lint:migrations` | 0 | — | Guarda 1 | 0 | — |
| `npm run schema:verify` | 0 | — | Guarda 3 | 0 | — |
| `git diff --check` | 0 | — | — | — | — |

### 6-G.11 Mutation challenges da fatia corretiva

17 mutações aplicadas, **todas detectadas**, todas revertidas com verificação por hash SHA-256.

| # | Mutação | Detector | Detectado |
| --- | --- | --- | --- |
| `C-01` | remover o controle de tentativas em voo | `limitador-login.spec` | ✅ |
| `C-02` | voltar ao padrão `consultar → await → registrarFalha` | integração `F-01` | ✅ |
| `C-03` | permitir despejo da vítima bloqueada | `limitador-login.spec` | ✅ |
| `C-04` | default de ambiente volta a desenvolvimento | `politica-cookie.spec` | ✅ |
| `C-05` | `Secure` removido em produção | `politica-cookie.spec` | ✅ |
| `C-06` | corpo grande volta a `500` | integração `F-03` | ✅ |
| `C-07` | remover a persistência do rehash | integração `F-04` | ✅ |
| `C-08` | rehash sobrescreve hash alterado concorrentemente | integração `F-04` | ✅ |
| `C-09` | limpar cookie antes do desfecho do logout | integração `F-08` | ✅ |
| `C-10` | remover normalização IPv4-mapped | `limitador-login.spec` | ✅ |
| `C-11` | aceitar `Origin` `http:` em ambiente HTTPS | `protecao-csrf.spec` | ✅ |
| `C-12` | reativar o Scarf | `supply-chain.spec` | ✅ |
| `C-13` | remover `413` do OpenAPI | `openapi.spec` | ✅ |
| `C-14` | expor `/openapi.json` em produção | `verify:openapi-runtime` | ✅ |
| `C-15` | remover o caminho dummy | `credencial.service.spec` | ✅ |
| `C-16` | omitir a auditoria da falha admitida | integração `D-2.3D-12` | ✅ |
| `C-17` | expor o token no JSON | integração | ✅ |

`C-03` merece registro: na primeira rodada ele **não foi detectado**, e a investigação revelou que os testes de saturação eram **vacuamente verdadeiros**. Os testes foram reescritos com não-vacuidade assegurada, e só então o challenge passou a falhar como devia.

### 6-G.12 Regressão da F2 e fronteiras

`SessaoService` não foi alterado nesta fatia. Os testes focais da F2 — monotonicidade atômica, throttle, expiração absoluta e ociosa, revogação, corrida corrigida em `C-01` da F2, ausência de ressurreição de estado terminal — seguem verdes dentro das 194 provas de integração. `emitirEm`/`revogarEm` continuam semanticamente equivalentes aos invólucros públicos.

**F4, F5 e F6 permanecem não iniciadas**; nenhum RBAC, seed, bootstrap de Administrador, recuperação de senha, JWT, refresh token, Redis, CORS cross-origin, synchronizer token, multitenancy, sessão por dispositivo ou frontend. O rehash de `F-04` **não** autoriza recuperação de senha. As rotas publicadas continuam sendo exatamente `/health`, `/auth/login` e `/auth/logout`.

**Zero drift** reconfirmado: `packages/` com diff vazio contra `9a22262`; `schema.prisma`, `schema.golden.sql`, `protected-objects.json` e as 10 migrations com hash idêntico ao da baseline.

## 6-H. Etapa 2.3D-B / F3 — segunda fatia corretiva pós-revisão independente

**Estado: registro da SEGUNDA fatia corretiva — o estado que a revisão de gate aprovou; encerrado por §6-I.** Executada em 28/08/2026 na mesma branch `agent/fase2-etapa2.3d-f3-auth-http`, sobre a mesma baseline `main` = `9a22262`. **Naquela execução a publicação não era autorizada** — sem commit, push, PR, merge, tag ou deploy. A homologação e a integração vieram em seguida (§6-I; §11, REV. 19).

### 6-H.1 Resultado da segunda revisão independente

A revisão adversarial independente da F3 corrigida devolveu **`B — APTO COM CORREÇÕES OBJETIVAS ANTES DO VERSIONAMENTO`**. Ela **confirmou por reprodução própria** que as três correções de fundo da fatia anterior são reais: `F-01` (reserva em voo, medida com concorrência assíncrona real), `F-04` (rehash sob `READ COMMITTED`, reproduzido contra PostgreSQL real inclusive com espera de lock e rollback da transação concorrente) e `F-05` (despejo que não sacrifica bloqueios). Nenhum achado BLOQUEANTE ou ALTO.

| ID | Sev. | Ação nesta fatia | Arquivos |
| --- | --- | --- | --- |
| `F3R-01` | MÉDIO | **CORRIGIDO** — request-target absolute-form (§6-H.2) | `erro-autenticacao.filter.ts` |
| `F3R-02` | MÉDIO | **RESOLVIDO POR DECISÃO DE BRUNO** — `L-11` homologada como **`D-2.3D-13`** (§6-H.3) | `docs/12` |
| `F3R-03` | MÉDIO | **CORRIGIDO** — cursor rotativo + poda local (§6-H.4) | `limitador-login.ts` |
| `F3R-04` | BAIXO | **CORRIGIDO** — `.env.example` deixa de documentar default inexistente | `.env.example` |
| `F3R-05` | BAIXO | **CORRIGIDO** — contagem do smoke de 7 para **6**, confirmada por reexecução | `docs/10` |
| `F3R-06` | OBSERVAÇÃO | **NÃO TRATADO** — fora do escopo autorizado (§9) | — |
| `F3R-07` | OBSERVAÇÃO | **NÃO TRATADO** — fora do escopo autorizado (§9) | — |
| `F-12` | BAIXO | **MANTIDO E ACEITO** — a revisão verificou materialmente e concordou (§6-G.9) | — |

### 6-H.2 `F3R-01` — o absolute-form passa a pertencer ao contrato fechado

**O defeito.** O RFC 7230 §5.3.2 obriga o servidor a aceitar a forma absoluta do request-target. O Express **roteia** `POST http://host/auth/login` para o handler do login — medido: devolve `401` com corpo bem-formado. O filtro, porém, comparava a URL **crua** contra `{"/auth/login","/auth/logout"}`, e o URI absoluto não casava. Por essa porta reapareciam os dois danos que `F-06`/`F-03` diziam ter fechado:

```text
origin-form   413 -> {"erro":"REQUISICAO_INVALIDA"}      log: +0  linhas
absolute-form 413 -> {"statusCode":413,"message":...}    log: +16 linhas ERROR com stack
```

E era alcançável **sem cabeçalho algum** — o body parser roda antes da guard CSRF.

**A correção.** A decisão passa a usar o **pathname efetivo**, preferindo o `path` da própria plataforma (no Express, o `pathname` de `parseurl` — exatamente o valor contra o qual a rota é casada). A retaguarda, quando a plataforma não oferece `path`, extrai o pathname do request-target sem normalizar nada além de descartar query/fragmento e, na forma absoluta, esquema e autoridade.

**Medição que fundamenta a escolha** — 18 variantes contra o Express real. `req.path` reproduz **exatamente** a decisão de roteamento: as 8 variantes que chegam ao login normalizam para `/auth/login`; as 10 que o roteador devolve como `404` continuam distintas e seguem delegadas ao Nest.

**Por que NÃO `new URL()`** — a normalização WHATWG é excessiva e faria o filtro capturar rota que o roteador não trata como login:

```text
new URL("/auth/./login")    -> "/auth/login"   (roteador: 404)
new URL("/auth/x/../login") -> "/auth/login"   (roteador: 404)
new URL("//auth/login")     -> "/login"        (roteador: 404)
```

A regra de método (`POST`) permanece intacta.

### 6-H.3 `F3R-02` / `L-11` — decisão devolvida a Bruno e homologada

A revisão classificou a proteção de concorrência em voo como **decisão comportamental, não detalhe de implementação**, por três razões medidas: o teto de simultaneidade foi acoplado ao limite de falhas sem que fonte alguma o fixasse; `Retry-After: 1` não é derivável de fonte homologada; e o `429` transitório é invisível ao contador de falhas. Ela **recusou-se a homologá-la** em nome de Bruno (TLF-BASE-V1 §15) e devolveu alternativas com recomendação.

**Bruno homologou** a opção recomendada — manter o comportamento como está — e ela foi registrada como **`D-2.3D-13`** em `docs/12` §5.13 (REV. 3), com o risco residual declarado e aceito como **`R-2.3D-08`**. **Nenhuma decisão anterior foi modificada ou renumerada**; `D-2.3D-06` permanece intacta e `D-2.3D-13` a complementa. `L-11` passa a **alias histórico**.

### 6-H.4 `F3R-03` — a amostragem de despejo deixa de sofrer inanição

**O defeito, em duas partes.** A amostra recomeçava **sempre** no primeiro elemento do `Map`; como o `Map` preserva ordem de inserção e bucket bloqueado nunca é despejado, os bloqueados mais antigos **fixavam-se na cabeça**. Medido pela revisão: 64 bloqueados na cabeça, 49 936 candidatos seguros atrás deles, **2 000 de 2 000** identificadores novos recusados. Agravante: a elegibilidade lia `falhas.length` **sem podar**, de modo que um bucket com a janela inteira vencida continuava contando como bloqueado.

**A correção — duas mudanças, ambas de custo constante:**

1. **Cursor persistente por dimensão.** Iterador vivo do `Map`, preservado entre admissões; `next()` é O(1) e o iterador só é recriado quando se esgota. **Não** é "pular N desde o início" — isso voltaria a ser O(n) por requisição.
2. **Poda local do candidato amostrado**, com o mesmo instante monotônico da operação, **antes** de classificá-lo. Só os até 64 amostrados são podados; nenhuma varredura global é reintroduzida. Bucket que fica vazio após a poda é lixo puro e sai na hora.

**O que não mudou:** `AMOSTRA_DE_DESPEJO = 64`; bloqueado e com reserva em voo continuam **indespejáveis**; o critério entre seguros continua "menor número de falhas, desempate no mais antigo"; sem candidato seguro na amostra, a admissão é recusada. O que deixou de existir é a inanição **indefinida** por posição: um prefixo inelegível de `k` entradas é atravessado em ~`ceil(k / 64)` admissões.

### 6-H.5 Testes acrescentados

| Arquivo | Suíte | Propriedades provadas |
| --- | --- | --- |
| `test/integration/auth-http.integration.spec.ts` | `F3R-01 — absolute-form pertence ao contrato fechado` (9 testes) | a forma absoluta **realmente alcança** o handler (não-vacuidade); JSON malformado em 4 variantes absolutas devolve o contrato fechado; `413` absoluto devolve `{"erro":"REQUISICAO_INVALIDA"}`; **zero log de nível ERROR** (sem `PayloadTooLargeError`, sem stack); logout absoluto pelo contrato; e a correção **não** passou a capturar as 10 variantes que o roteador devolve como `404` |
| `test/limitador-login.spec.ts` | `F3R-03 — cursor rotativo e poda local` (5 testes) | **A** prefixo bloqueado do tamanho da amostra não causa inanição; **B** prefixo maior que uma amostra é atravessado em amostras sucessivas, dentro do teto de progresso; **C** falha vencida do candidato amostrado é podada e ele volta a ser elegível; **D** bucket com reserva em voo na cabeça nunca é vítima; **F** nenhuma admissão no teto varre o mapa inteiro |

O caso **E** ("todos os candidatos realmente inelegíveis ⇒ recusa") já era coberto pelo teste vigente *"com TODOS os candidatos bloqueados, a admissão é RECUSADA em vez de despejar"*, que permanece verde com o cursor.

Novo ponto de instrumentação: `medirCandidatosVisitados()`, exposto **exclusivamente para prova** de que o custo por admissão fica limitado pela amostra — não participa de decisão alguma, no mesmo espírito de `medirEntradas`/`medirEmVoo`.

### 6-H.6 Mutation challenges da fatia — `C-18`..`C-20`

3 mutações aplicadas, **todas detectadas**, todas revertidas com verificação por hash SHA-256.

| # | Mutação | Detector | Detectado |
| --- | --- | --- | --- |
| `C-18` | remover suporte a absolute-form do reconhecimento do filtro | integração `F3R-01` | ✅ 5 testes falham |
| `C-19` | reancorar a amostra de despejo no início do `Map` | `limitador-login.spec` `F3R-03` | ✅ testes A e B falham |
| `C-20` | remover a poda/reavaliação do candidato amostrado | `limitador-login.spec` `F3R-03` | ✅ teste C falha |

**`C-20` merece registro — e repete a lição de `C-03`.** Na primeira rodada ele **não foi detectado**: o teste C construía a cabeça do mapa com buckets expirados, mas o **cursor já apontava para a região segura** deixada pelo laço de preenchimento, de modo que a admissão era concedida sem que a poda fosse necessária. O teste era **vacuamente verdadeiro**. Foi reescrito para isolar a poda de verdade: todo bucket do mapa fica **parcialmente vencido** (4 falhas antigas que expiram + 1 recente que sobrevive), o que elimina as duas causas concorrentes — o cursor não ajuda, porque nenhum bucket é elegível sem poda; e a varredura periódica não age, porque a falha mais recente continua viva. Só então o challenge passou a falhar pela razão certa.

### 6-H.7 Bateria integral — medida nesta fatia

| Comando | Exit | Suites | Passed | Failed | Observação |
| --- | --- | --- | --- | --- | --- |
| `npm run typecheck` | 0 | — | — | 0 | — |
| `npm run test:api` | 0 | 16 | **437** | 0 | era 432; +5 de `F3R-03` |
| `npm run verify:api-integration` | 0 | 6 | **203** | 0 | era 194; +9 de `F3R-01` |
| `npm run verify:from-scratch` | 0 | 10 | 87 | 0 | inalterado |
| `npm run build` | 0 | — | — | 0 | — |
| `npm run smoke:api` | 0 | — | **6 provas** | 0 | contagem reconfirmada (`F3R-05`) |
| `verify:argon2-runtime` | 0 | — | 15/15 | 0 | — |
| `verify:openapi-runtime` | 0 | — | 17/17 | 0 | — |
| `npm run lint:migrations` | 0 | — | Guarda 1 | 0 | 10 migrations · 37 objetos |
| `npm run schema:verify` | 0 | — | Guarda 3 | 0 | golden 60 169 B idêntico; `migrate diff` 0 |
| `git diff --check` | 0 | — | — | 0 | — |

### 6-H.8 Regressão, fronteiras e drift

**F1/F2 sem regressão.** `credencial.service.ts` e `sessao.service.ts` **não foram tocados** nesta fatia. Os testes focais de `F-01` (12 simultâneas contra o limite 5; 45 contra 30; atomicidade all-or-nothing; liberação idempotente; erro técnico; falha persistida; `Retry-After`) seguem verdes — a mudança de despejo não os alterou.

**F4, F5 e F6 permanecem não iniciadas**; nenhum RBAC, seed, bootstrap de Administrador, recuperação de senha, JWT, refresh token, Redis, CORS cross-origin, synchronizer token, multitenancy, sessão por dispositivo ou frontend. As rotas publicadas continuam sendo exatamente `/health`, `/auth/login` e `/auth/logout`.

**Zero drift** reconfirmado: `packages/database` com diff vazio contra `9a22262`; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com hash idêntico; 10 migrations. `prisma format`, `migrate dev`, `db push` e `db pull` **não** foram executados.

**A F3 NÃO está homologada nem encerrada.** Próximo passo: **nova revisão técnica independente adversarial**.

## 6-I. Etapa 2.3D-B / F3 — homologação e rito de integração

**Estado: CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** — homologada por Bruno Menezes Noronha em 28/08/2026 (TLF-BASE-V1 §15, item 1) após **três** revisões técnicas independentes adversariais e duas fatias corretivas, e integrada no mesmo dia por **merge commit `3556972`** (PR [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14)) — registro pós-medição em §6-I.8 e §11, REV. 20. Esta seção é o registro autoritativo do fechamento da fatia; §6-F, §6-G e §6-H permanecem como registro histórico das execuções que a produziram.

### 6-I.1 Escopo homologado

`POST /auth/login` e `POST /auth/logout` — os primeiros endpoints REST autenticados do produto. Compõem a fatia: `AuthController`, `AutenticacaoService`, `LimitadorLogin`, `ProtecaoCsrfGuard`, `FiltroErroAutenticacao`, `politica-cookie.ts`, `auth.dto.ts`, o documento OpenAPI e a prova de runtime `verify-openapi-runtime.mjs`. `SessaoService` ganhou apenas os pontos de entrada transacionais `emitirEm`/`revogarEm`, aditivos e sem mudança de semântica.

### 6-I.2 Decisões normativas materializadas

`D-2.3D-06` (anti-abuso), `D-2.3D-07` (cookie e CSRF), `D-2.3D-11` (OpenAPI), `D-2.3D-12` (auditoria de autenticação) e — acrescentada durante o ciclo de revisão — **`D-2.3D-13`** (proteção de concorrência em voo do limitador). O rehash exigido por `D-2.3D-02` foi materializado no login.

**`D-2.3D-13` — origem e natureza.** A implementação registrara o comportamento como decisão local `L-11`. A segunda revisão independente o classificou como **decisão comportamental, não detalhe de implementação**, recusou-se a homologá-lo em nome de Bruno (TLF-BASE-V1 §15) e o devolveu com alternativas. Bruno homologou a opção recomendada, e ela passou a norma em `docs/12` §5.13 (REV. 3). **`L-11` é, desde então, apenas alias histórico** (`F3R-08`). Nenhuma decisão de `D-2.3D-01` a `D-2.3D-12` foi alterada, renumerada ou reaberta — provado por comparação textual: as doze seções §5.1..§5.12 permanecem byte a byte idênticas à baseline.

### 6-I.3 Revisões independentes e findings encerrados

| Rodada | Veredito | Desfecho |
| --- | --- | --- |
| 1ª — F3 implementada | `B` | 14 achados (`F-01` ALTO; `F-02`..`F-05` MÉDIOS; demais BAIXOS) — corrigidos em §6-G, exceto `F-12` |
| 2ª — F3 corrigida | `B` | 3 achados (`F3R-01`, `F3R-02`, `F3R-03` MÉDIOS) + 2 BAIXOS — corrigidos em §6-H; `F3R-02` devolvido a Bruno e homologado como `D-2.3D-13` |
| 3ª — gate final | **`A`** | Nenhum BLOQUEANTE/ALTO/MÉDIO. Um BAIXO (`F3R-08`), corrigido nesta seção |

**Encerrados:** `F-01`..`F-11`, `F-13`, `F-14`, `F3R-01`, `F3R-03`, `F3R-04`, `F3R-05`, `F3R-08`. `F-07` foi resolvido por consequência.

**Evidência material reproduzida pelas revisões, e não apenas declarada:** reserva em voo medida sob concorrência assíncrona real (12/limite 5 e 45/limite 30); corrida do rehash reproduzida contra PostgreSQL 18 real sob `READ COMMITTED`, inclusive com espera de lock confirmada e rollback da transação concorrente; 29 variantes de request-target comparadas entre roteador e filtro, com zero incoerências; oito propriedades do iterador de `Map` sob mutação; saturação a 50 000 buckets em três topologias adversariais.

### 6-I.4 Riscos residuais aceitos

| ID | Severidade | Situação |
| --- | --- | --- |
| `R-2.3D-08` | BAIXO | **ACEITO** — `429` transitório contra usuário legítimo, contrapartida da proteção dos recursos de Argon2; não gera bloqueio persistente (`docs/12` §8) |
| `F-12` | BAIXO | **ACEITO** — guarda de cliente transacional; corrigir exigiria acoplamento `auth → audit` ou alteração de `packages/` (§6-G.9) |
| `F3R-06` | OBSERVAÇÃO | `Origin` comparada ao `Host` da requisição, sem allowlist — inerente ao modelo de ameaça de navegador; não tratado |
| `F3R-07` | OBSERVAÇÃO | Corrida do rehash consome uma falha do orçamento e audita `FALHA` — não tratado |

Pendências **não** encerradas por esta homologação: `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `R-2.3D-04`, `R-2.3D-05`, `R-2.3D-06`. Nenhuma delas foi fechada por implicação.

### 6-I.5 Bateria de homologação

Medida no estado exato que foi versionado. Números em §6-I.6.

### 6-I.6 Zero drift e fronteiras

`packages/database` com **diff vazio** contra `9a22262`; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com hash idêntico; **10 migrations**, nenhuma nova; Guarda 3 com golden byte a byte (60 169 bytes) e `prisma migrate diff --exit-code` 0. `prisma format`, `migrate dev`, `db push` e `db pull` não foram executados em nenhuma das execuções da fatia.

**F4, F5 e F6 permanecem NÃO INICIADAS.** Busca mecânica em `apps/api/src/` confirma zero implementação de RBAC, seeds, bootstrap de Administrador, recuperação de senha, JWT, refresh token, Redis, CORS cross-origin, synchronizer token, multitenancy ou sessão por dispositivo. `apps/web` não existe. Rotas funcionais publicadas: `/health`, `/auth/login` e `/auth/logout`; `/openapi.json` é montada conforme a política de ambiente e **não** é exposta em produção/homologação.

### 6-I.7 Conformidade — limite declarado

Esta homologação é **técnica**. Nos termos da TLF-BASE-V1 §10, implementação técnica isoladamente não autoriza afirmar conformidade legal definitiva: afirmações de conformidade e decisões regulatórias permanecem sujeitas a validação jurídica e profissional competente.

### 6-I.8 Registro pós-medição da integração

Registro **exclusivamente factual** do rito, no precedente MEDIR → REGISTRAR das REV. 10 e REV. 15.

| Item | Valor |
| --- | --- |
| `main` antes | `9a22262c515c8b97c73dc7cf8493252db07dd501` |
| Commit de implementação | `362aefe` — `feat(auth): implement login and logout HTTP flow` |
| Commit de homologação documental | `c755fcb` — `docs(auth): homologate authentication F3` |
| Correção do harness | `c20cf1c` — `test(auth): make HTTP integration helpers IPv6 portable` |
| Pull request | [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14) |
| HEAD homologado e validado pela CI | `c20cf1c05ab7a9e306f2df8fd96c009dac9d2fd0` |
| Merge commit | `35569727789f6f73b4f81fec3cc94c34d4cb0038` |
| `main` depois | `35569727789f6f73b4f81fec3cc94c34d4cb0038` |
| Método | **merge commit** — sem squash, sem rebase, sem force-push |

**Proteção contra corrida.** Imediatamente antes do merge, HEAD local, HEAD remoto da branch e `headRefOid` do PR coincidiam em `c20cf1c` — o mesmo SHA que passou pela CI —, `origin/main` permanecia em `9a22262` desde a homologação, e `merge-base` = `origin/main`. Os três commits foram preservados como ancestrais da `main`.

#### O incidente de CI e sua correção — fato de teste, não requisito

A primeira execução da CI sobre o PR **reprovou**: 15 de 16 etapas verdes e a suíte de integração com `21 failed, 182 passed, 203 total`. **Todas as 21 falhas tinham a mesma causa — `getaddrinfo ENOTFOUND [::1]` — e nenhuma delas chegou a exercitar a aplicação**: morriam no cliente, ao abrir a conexão.

Causa: os dois clientes `node:http` da suíte derivavam o destino de `new URL(baseUrl).hostname`. Quando o Nest escuta em IPv6, `app.getUrl()` devolve `http://[::1]:PORT` e esse `hostname` **preserva os colchetes** — chega `"[::1]"` a `http.request`, que o trata como nome de host. Medido nos dois sistemas com o mesmo script:

```text
linux/x64  node v24.x  hostname "[::1]"  ->  getaddrinfo ENOTFOUND [::1]
win32/x64  node v24.x  hostname "[::1]"  ->  conecta normalmente
```

Foi esse mascaramento por plataforma que fez a bateria passar `203/203` na máquina de desenvolvimento durante as três revisões, enquanto 21 provas jamais alcançavam o produto no Linux — 12 delas (CSRF e escopo do filtro) **nunca haviam rodado de fato na CI**, porque a branch nunca havia sido enviada. `fetch` normaliza a forma com colchetes por conta própria, e por isso só os testes de `node:http` foram afetados.

Correção (`c20cf1c`): o destino passou a ser derivado por **`urlToHttpOptions`**, a mesma conversão que o Node aplica ao receber uma `URL`, preservando **origin-form**, **query** e **absolute-form** — este último verificado no servidor pelo `req.url` literalmente recebido. Efeito colateral corrigido: `path: url.pathname` descartava a query em silêncio.

**A correção não alterou runtime, controller, service, guard, filtro, limitador, persistência nem contrato REST/OpenAPI** — um único arquivo de teste, `+79 −7`. Três provas de regressão passaram a guardar a portabilidade.

**Este incidente é fato de execução do harness. Não cria requisito, não altera decisão e não reabre finding algum.**

#### Medições da CI sobre o HEAD integrado

Run [33176130292](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33176130292) — **pass** sobre `c20cf1c`, todos os passos verdes:

| Etapa | Resultado |
| --- | --- |
| E-15 + Guarda 2 — reconstrução from-scratch | 87 passed |
| Guarda 3 + alarme — golden byte a byte e `migrate diff --exit-code` | verde |
| Suíte de `apps/api` | 16 suites · 437 passed |
| **Integração com PostgreSQL 18 real** | **6 suites · 206 passed** |
| Provas de runtime — Argon2id e OpenAPI no ESM compilado | verdes |

As **21 provas antes bloqueadas passaram a alcançar efetivamente a aplicação** e passaram.

#### Validação local sobre a `main` integrada

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` | 0 | — |
| `npm run test:api` | 0 | 16 suites · 437 passed |
| `npm run verify:api-integration` | 0 | 6 suites · **206 passed** |
| `npm run build` | 0 | — |
| `npm run smoke:api` | 0 | 6 provas |
| `npm run lint:migrations` | 0 | Guarda 1 — 10 migrations · 37 objetos |
| `npm run schema:verify` | 0 | Guarda 3 — golden 60 169 bytes byte a byte |
| `verify:argon2-runtime` | 0 | 15/15 |
| `verify:openapi-runtime` | 0 | 17/17 |
| `git diff --check` | 0 | — |

Os **206** correspondem às **203** provas anteriores mais **3** regressões do harness; as medições históricas de 203 permanecem corretas para os estados em que foram tomadas e **não foram reescritas**.

#### Zero drift na `main` integrada

```text
git diff 9a22262 3556972 -- packages/database ....... 0 linhas

schema.prisma .......... 7bee911e75e4742f = 7bee911e75e4742f   IDÊNTICO
schema.golden.sql ...... c2ad5dc539098f51 = c2ad5dc539098f51   IDÊNTICO
protected-objects.json . 9b4033a3c2cf3a79 = 9b4033a3c2cf3a79   IDÊNTICO
migrations ............. 10 -> 10
```

**F4, F5 e F6 permanecem NÃO INICIADAS.** Nenhum deploy, tag ou release foi realizado.

## 6-J. Etapa 2.3D-B / F4 — guards e decorators de autorização (RBAC)

**Estado: REGISTRO HISTÓRICO DA EXECUÇÃO INICIAL — SUPERADO EM PONTOS ESPECÍFICOS PELA FATIA CORRETIVA DE §6-K.** A F4 permanece **NÃO HOMOLOGADA / NÃO INTEGRADA**. As MEDIÇÕES desta seção continuam válidas para o estado em que foram tomadas e **não foram reescritas**; as afirmações que a revisão técnica independente provou incorretas estão marcadas abaixo com **[RETIFICADO — §6-K]**. Executada em 28/08/2026 na branch `agent/fase2-etapa2.3d-f4-rbac`, criada a partir de `main` = `origin/main` = `a9be742c150ebe43df0d03ef9ec1529cff5d780a` (PR [#15](https://github.com/BrunoMNoronha/techlab-fisio/pull/15), `docs/10` REV. 20). **Publicação não autorizada nesta execução: sem commit, push, PR, merge, rebase de publicação, tag, release ou deploy.**

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta.** `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas; **`docs/12` NÃO foi tocado** por esta execução; a Base Imutável permanece intacta; `docs/09` §12 não foi reaberto.

### 6-J.1 Objetivo e escopo materializado

A F4 entrega o **mecanismo** de autorização — não funcionalidade nova. Requisições autenticadas passam a poder ser autorizadas no backend, de forma declarativa e testável, a partir dos papéis e permissões efetivamente associados ao usuário da sessão.

| Elemento da fatia | Fonte que o governa | Como foi materializado |
| --- | --- | --- |
| Identificadores técnicos de permissão | `D-2.3D-09`; `docs/04` §5 | `permissoes.catalogo.ts` — materialização **tipada** dos 29 nomes funcionais, na ordem da fonte. Mesmo precedente e mesma disciplina de `audit/audit.catalog.ts` para `docs/09` §12: o arquivo **não decide nada** |
| Ausência de catálogo paralelo | `D-2.3D-09` | Provada mecanicamente: `permissoes.catalogo.spec.ts` **lê** `docs/04-perfis-permissoes.md`, extrai os cabeçalhos de §5 e exige igualdade exata, na mesma ordem |
| Múltiplos papéis; união de permissões | `D-2.3D-09`; TLF-BASE-V1 §6; `docs/04` §6.1 | `PermissoesService.resolverDoUsuario` — uma única consulta `usuario → usuario_papel → papel → papel_permissao → permissao`, união deduplicada e ordenada |
| Autorização declarativa | `AUT-003` | `@RequerPermissoes(...)` — apenas metadata. **[RETIFICADO — §6-K]** substituído por `@RequerPermissao(...)`, singular, que também INSTALA as guards |
| Enforcement no backend | `AUT-003`; `docs/04` §2.3; TLF-BASE-V1 §4.7 | `PermissoesGuard`, integrada ao mecanismo padrão de guards do NestJS |
| Sessão autenticada válida como pré-condição | `AUT-003`; `D-2.3D-04`/`D-2.3D-05` | `SessaoAutenticadaGuard`, que **consome** o `SessaoService` da F2 e a política de cookie de `D-2.3D-07` — não reimplementa nenhum dos dois |
| Privilégio mínimo e negação por padrão | TLF-BASE-V1 §4.2; `docs/04` §2.1/§2.2 | Guard **opt-in** por rota; toda dúvida nega; nenhum privilégio implícito |

### 6-J.2 Componentes implementados

| Arquivo | Papel |
| --- | --- |
| `apps/api/src/authz/permissoes.catalogo.ts` | Conjunto FECHADO e tipado dos 29 identificadores de `docs/04` §5; `ehPermissao` |
| `apps/api/src/authz/erro-autorizacao.ts` | Contrato de erro da fatia — um único código, `ACESSO_NEGADO` |
| `apps/api/src/authz/contexto-autenticado.ts` | Contexto autenticado sob **chave de símbolo privada**; `anexarContextoAutenticado`, `lerContextoAutenticado` e o param decorator `@UsuarioAutenticado()` |
| `apps/api/src/authz/requer-permissoes.decorator.ts` | `@RequerPermissoes(...)`, a chave de metadata e a normalização fail-closed. **[RETIFICADO — §6-K]** arquivo REMOVIDO; substituído por `requer-permissao.decorator.ts` + `permissao-exigida.metadata.ts` |
| `apps/api/src/authz/permissoes.service.ts` | Resolução das permissões efetivas contra a persistência homologada |
| `apps/api/src/authz/sessao-autenticada.guard.ts` | Guard de autenticação — produz `401`, e só ela |
| `apps/api/src/authz/permissoes.guard.ts` | Guard de autorização RBAC — produz `403`, e só ela |
| `apps/api/src/authz/authz.module.ts` | Módulo **sem controller**; registrado no `AppModule` |

### 6-J.3 Arquitetura — como a decisão é tomada

```text
requisição HTTP
  -> SessaoAutenticadaGuard
       lê o cookie de D-2.3D-07 pela função da própria F3 (lerCookieSessao)
       chama SessaoService.validar  (F2 — token, estados terminais, atividade)
       inválida  -> 401 { "erro": "SESSAO_INVALIDA" }
       válida    -> grava { usuarioId, sessaoId } sob CHAVE DE SÍMBOLO privada
  -> PermissoesGuard
       reúne a metadata de @RequerPermissoes do HANDLER e da CLASSE (união)
       [RETIFICADO — §6-K] passou a ler UMA permissão, SOMENTE do handler
       metadata ausente/inválida -> 403
       contexto autenticado ausente -> 403
       PermissoesService.resolverDoUsuario(contexto.usuarioId)
         usuário inexistente / inativo -> 403
       falta qualquer permissão exigida -> 403
       caso contrário -> prossegue
  -> handler
```

**A identidade não é controlável pelo cliente.** O contexto vive sob `Symbol("tlf.contexto_autenticado")` — símbolo **não registrado**, privado do módulo. Nenhum corpo JSON, query string ou cabeçalho HTTP produz propriedade de símbolo no objeto de requisição: o parser escreve em `req.body`, `req.query` e `req.headers`, que são propriedades de string de outros objetos. Não existe caminho pelo qual o pedido injete, sobrescreva ou adivinhe essa chave.

**`401` e `403` não se confundem.** A guard de sessão é a única que emite `401`; a guard de RBAC é a única que emite `403` e nunca autentica. A ordem de `@UseGuards(SessaoAutenticadaGuard, PermissoesGuard)` é significativa — o Nest executa as guards em sequência e interrompe na primeira recusa.

**Fail-closed, e o que isso NÃO significa.** Fail-closed é "o handler não é alcançado". Uma falha **técnica** na resolução (banco indisponível, erro de driver) **sobe como exceção** e vira `500`; ela não é maquiada como `403`. Converter indisponibilidade de infraestrutura em "sem permissão" faria todo incidente parecer erro de configuração de papéis — mesmo racional já homologado do `FiltroErroAutenticacao` ("falha técnica nunca vira `401`"). O contrato de erro existente foi preservado, e nenhum código foi acrescentado a `auth.dto.ts`.

**Sem cache, por decisão de escopo** (`docs/12` §16): a persistência é consultada no momento da decisão. Nenhum snapshot de permissão na sessão, nenhum papel no token, nenhum Redis, nenhum JWT, nenhum refresh token. Uma permissão revogada passa a valer na requisição seguinte, sem invalidação de cache.

**Sem auditoria de negação — fronteira, não esquecimento.** `autorizacao.negada` é uma das ações RC/SF que `D-AUD-04`/`D-AUD-05` mantêm **expressamente fora** do catálogo homologado (`docs/09` §12). Emiti-la aqui ampliaria o catálogo sem decisão própria. `docs/04` §10 prevê auditar rejeições relevantes "quando isso tiver utilidade operacional" — a promoção da ação continua sendo decisão de Bruno.

### 6-J.4 Onde o RBAC passou a ser aplicado — e por que só ali

**Nenhuma rota de produção foi protegida nesta fatia, e nenhuma podia ser.** As três rotas FUNCIONAIS publicadas são `/health` (infraestrutura) e `POST /auth/login` / `POST /auth/logout` — a que resta, `/openapi.json`, não é rota funcional e é servida apenas conforme a política de ambiente homologada na F3 (`D-2.3D-11`; `docs/10` §6-I.6) **[precisão acrescentada — §6-K, `R4-08`]** — precisamente as operações que `docs/04` §4 marca como permitidas a **todos** os papéis ("Autenticar/logout próprio": ✓ ✓ ✓ ✓), isto é, operações **sem permissão exigida**. Protegê-las com RBAC contrariaria a matriz homologada. As demais permissões do catálogo governam operações cujos endpoints ainda não existem.

A guard é, portanto, provada por integração sobre um **controller exclusivamente de teste** (`apps/api/test/integration/fixture-rbac.controller.ts`), que vive fora de `rootDir: "src"` de `tsconfig.build.json`, não é compilado para `dist/`, não é importado pelo `AppModule` e não aparece no documento OpenAPI. **O conjunto de rotas publicadas continua sendo exatamente `/health`, `/auth/login` e `/auth/logout`** — asserção mecânica de `auth.module.integration.spec.ts` e de `openapi.spec.ts`, ambas verdes e inalteradas nesse ponto.

O fluxo interno `profissional.situacao.alterada` (§6-A.4) **continua sem exposição HTTP** e, portanto, sem RBAC aplicado: proteger o serviço interno exigiria decidir o ator autorizado sem endpoint, o que não é desta fatia. A pendência "RBAC / `profissionais.gerenciar`" de §9 permanece aberta, agora com o mecanismo disponível.

### 6-J.5 Decisões locais — reversíveis, **não** são norma

| ID | Problema | Alternativas | Escolha | Por que não é decisão normativa |
| --- | --- | --- | --- | --- |
| ~~`L-F4-01`~~ **[ELIMINADA — §6-K]** | Nenhuma fonte homologada define como compor **várias** permissões numa mesma operação | (a) conjunção — todas obrigatórias; (b) disjunção — qualquer uma; (c) oferecer as duas e escolher por rota | **(a) conjunção.** É a única que, na dúvida, **não amplia privilégio**: todo acesso concedido por `AND` também o seria por `OR`. **(c) foi recusada** — obrigaria a escolher a semântica por rota sem fonte que a sustente, transferindo a decisão, em silêncio, para o ponto de uso | É escolha de implementação sob lacuna declarada de fonte. **Adotar a alternativa (b) AMPLIA acesso e, por isso, exige decisão expressa de Bruno.** Fica registrada como pendente de revisão — ver §9 |
| `L-F4-02` | Sessão viva de usuário **inativado** depois do login | (a) autorizar mesmo assim (a sessão é válida); (b) negar a autorização; (c) invalidar a sessão | **(b) negar.** AUT-001 proíbe sessão para conta inativa e AUT-005 revoga sessões na inativação: uma sessão viva de conta inativa é estado **inconsistente**, e o RBAC não é o lugar de consertá-lo — é o lugar de não confiar nele. **(c) foi recusada** por ser mutação de estado de sessão, que pertence à máquina de estados de `D-2.3D-05` | Nenhuma fonte manda o RBAC reavaliar a situação do usuário, e nenhuma o proíbe. Na dúvida, nega-se. Reversível sem tocar decisão homologada |
| `L-F4-03` | Metadata de permissão **ausente** com a guard aplicada | (a) tratar como rota pública; (b) negar | **(b) negar.** "Atribuiu a guard e não declarou nada" é erro de fiação, não autorização irrestrita. A guard é **opt-in** por rota — a ausência da guard, essa sim, deixa a rota fora do RBAC, e isso é explícito no código | Contrato interno do mecanismo, não política de acesso |
| ~~`L-F4-04`~~ **[ELIMINADA — §6-K, `R4-04`]** — a afirmação "a rota de um controller protegido nunca exige menos do que ele" foi MEDIDA como FALSA sob herança: uma subclasse com decorator próprio descarta a exigência da classe-base. A superfície de classe foi removida. | Metadata de **classe** × metadata de **método** | (a) `getAllAndOverride` — o método substitui a classe; (b) união | **(b) união.** `getAllAndOverride` faria um método anotado com permissão barata **descartar** a exigência do controller inteiro | Detalhe de composição do mecanismo; a alternativa (a) reduziria exigência, e por isso foi recusada |
| `L-F4-05` | Corpo do `403` | (a) informar a permissão que faltou; (b) código único opaco | **(b).** Informar transformaria o `403` em oráculo sobre a matriz de permissões e sobre o cadastro — mesma disciplina anti-enumeração de AUT-001/`D-2.3D-12` e da decisão local `A-05` da F3 | Forma de resposta, no precedente já adotado pela F3 |

### 6-J.6 A única alteração em artefato da F3 — e o que ela não faz

`AuthModule` passou a **exportar** `POLITICA_COOKIE_SESSAO`. A mudança é **aditiva e sem nenhuma mudança de comportamento**: o provider já existia desde a F3, já era resolvido no bootstrap (`R-2.3D-04`) e continua sendo o **mesmo singleton**. Ele é exportado para que a `SessaoAutenticadaGuard` leia o cookie pela **fonte única** da política, em vez de resolver uma segunda cópia da mesma configuração de segurança — duas resoluções independentes seriam duas fontes para o mesmo fato.

O que **não** mudou, e é o que a fronteira da F3 protege: `imports` continuam `[DatabaseModule, AuditModule]`; `controllers` continua `[AuthController]`; nenhum artefato de RBAC, seed ou recuperação de senha nasce dentro do `AuthModule`. `credencial.service.ts`, `sessao.service.ts`, `autenticacao.service.ts`, `auth.controller.ts`, `auth.dto.ts`, `politica-cookie.ts`, `protecao-csrf.guard.ts`, `limitador-login.ts`, `erro-autenticacao.filter.ts`, `token-sessao.ts`, `identificador-login.ts`, `relogio-sessao.ts` e o documento OpenAPI **não foram tocados**.

Duas asserções de `auth.module.integration.spec.ts` acompanharam a mudança, e ambas continuam sendo de **igualdade exata**: a lista de `exports` ganhou o token; e o teste cujo título afirmava "nenhum provider de F4+ é resolvível a partir do `AppModule`" foi **renomeado** — a F4 agora existe, foi autorizada, e seus providers são legitimamente resolvíveis pelo `AuthzModule`. Manter o título anterior deixaria uma prova verde afirmando algo falso.

### 6-J.7 Provas medidas

**Unitárias — 42 provas novas, sem banco e sem servidor** (`test:api` passou de 16 suites · 437 para **19 suites · 479**):

| Suíte | Provas | O que mede |
| --- | ---: | --- |
| `permissoes.catalogo.spec.ts` | 8 | O catálogo tipado **é** `docs/04` §5 — comparação contra o documento lido em disco, com controle de não vacuidade da extração; conjunto fechado fail-closed |
| `requer-permissoes.decorator.spec.ts` | 13 | Metadata gravada e congelada; as 29 permissões aceitas; recusa **na declaração** de lista vazia e de identificador fora do catálogo; normalização fail-closed |
| `permissoes.guard.spec.ts` | 21 | Concessão e negação; conjunção `L-F4-01`; união classe+método; metadata ausente/inválida; contexto ausente; usuário inexistente/inativo; `403` e nunca `401`; falha técnica que **não** vira `403`; identidade não forjável; isolamento entre usuários; propriedades do contexto autenticado |

**Integração com PostgreSQL 18 real — 33 provas novas** (`verify:api-integration` passou de 6 suites · 206 para **7 suites · 239**), em `authz-rbac.integration.spec.ts`. Caminho provado inteiro, sem mock no meio: servidor HTTP real → cookie de `D-2.3D-07` → `SessaoAutenticadaGuard` → `SessaoService` → `PermissoesGuard` → `PermissoesService` → `DatabaseService` → `tlf_app` → PostgreSQL 18.

| Caso | Cenário | Resultado medido |
| --- | --- | --- |
| **A** | autenticado + papel A + permissão P; rota exige P | **200**, com o corpo que só existe se o **handler executou**; e o mesmo desfecho partindo do **login real** da F3 |
| **B** | autenticado + papel A sem P; rota exige P | **403** `{"erro":"ACESSO_NEGADO"}`; a MESMA sessão obtém `200` na rota que exige apenas autenticação — controle que separa `401` de `403` |
| **C** | papel A sem P + papel B com P | **200**; união medida como `["auditoria.ler","usuarios.gerenciar"]`; a mesma permissão em dois papéis entra **uma vez**; duas permissões exigidas vindas de papéis diferentes permitem; possuir só uma das duas **nega** |
| **D** | autenticado sem papel algum | **403** nas duas rotas RBAC, `200` na rota apenas autenticada; resolução devolve lista **vazia**, que é resposta legítima e não "não foi possível resolver". Papel **sem permissão alguma** também não concede nada |
| **E** | usuário 1 com P, usuário 2 sem P | `200` e `403`; o cookie do usuário 2 devolve a identidade do usuário 2, e o id do usuário 1 não aparece em resposta alguma |
| **F** | identidade forjada por cabeçalhos, query string e corpo JSON | **403** nos três; **sem cookie**, nem os forjados autenticam — `401`. Controle positivo: o **mesmo** POST forjado, com a permissão real, devolve `201` e alcança o handler |
| **G** | sessão inválida ou terminal | sem cookie, cookie malformado, sessão inexistente e segredo errado → **401**; sessão **revogada** → `401`; expirada por **prazo absoluto** e por **ociosidade** → `401`; usuário **inativado** após o login → `403` (`L-F4-02`). Em cada caso, o token verdadeiro no mesmo cookie continua obtendo `200` — controle positivo |

Provas adicionais medidas na mesma suíte: guard aplicada **sem** `@RequerPermissoes` nega mesmo para quem tem todas as permissões (com controle positivo na rota vizinha); `PermissoesGuard` **sem** a guard de sessão nega e não autentica sozinha; resolução determinística (mesma ordem para o mesmo estado); identificador degenerado não vira consulta permissiva; código persistido **fora** do catálogo de `docs/04` §5 não autoriza nada; e as rotas de autenticação continuam **sem** exigir RBAC, com `/health` público.

**Não vacuidade** — cada caso confirma no banco, antes de asserir, que a fixture gravou de fato: `usuario_papel` e `papel_permissao` são **contados** por consulta própria, e a resolução efetiva é lida diretamente do serviço. Nenhum `403` esperado passa por engano de fixture, `404` de rota ou erro anterior ao RBAC.

**As fixtures de papel/permissão são fixtures de teste, e somente isso.** Nascem e morrem dentro da suíte, sob a limpeza determinística do `setup-db`. Não existe seed, script de seed, associação automática papel↔permissão nem bootstrap de Administrador.

### 6-J.8 Mutation challenges — 13 aplicados, 13 detectados, 13 revertidos

Cada mutação foi aplicada ao código-fonte, medida pela suíte detectora, revertida e teve a reversão **provada por SHA-256** idêntico ao valor anterior à aplicação. Nenhuma sobreviveu.

| # | Mutação | Detectada por | Resultado observado |
| --- | --- | --- | --- |
| `C-F4-01` | `PermissoesGuard.canActivate` sempre devolve `true` | unitária | **13 provas falharam** |
| `C-F4-02` | Comparação invertida — negação vira permissão | unitária | 8 falharam |
| `C-F4-03` | Resolução ignora todos os papéis exceto o primeiro | integração | 3 falharam |
| `C-F4-04` | Metadata ausente/vazia passa a valer como permissão irrestrita | unitária | 2 falharam |
| `C-F4-05` | Guard soma às permissões efetivas as de um cabeçalho HTTP | unitária | 1 falhou |
| `C-F4-06` | Guard consulta um `usuarioId` fixo em vez do da sessão | unitária | 1 falhou |
| `C-F4-07` | Composição `AND` vira `OR` | unitária | 2 falharam |
| `C-F4-08` | Consulta de permissões perde o filtro por `usuario_id` | integração | 5 falharam |
| `C-F4-09` | Falta de permissão passa a responder `401` | unitária | 11 falharam |
| `C-F4-10` | Fail-open: erro técnico na resolução vira acesso permitido | unitária | 3 falharam |
| `C-F4-11` | Catálogo ganha identificador inexistente em `docs/04` §5 | unitária | 1 falhou |
| `C-F4-12` | Identidade passa a ser lida de propriedade de **string** do pedido | unitária | 1 falhou |
| `C-F4-13` | Decorator passa a aceitar lista vazia de permissões | unitária | 2 falharam |

Verificação final da reversão, sobre os oito arquivos de `src/authz/` mais `auth.module.ts` e `app.module.ts`: **todos os SHA-256 idênticos aos medidos antes do primeiro challenge**, e `git status` sem resíduo.

### 6-J.9 Bateria integral — medida nesta fatia

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run test:api` | 0 | **19 suites · 479 passed** (era 16 · 437) |
| `npm run verify:api-integration` | 0 | **7 suites · 239 passed** (era 6 · 206) |
| `npm run verify:from-scratch` | 0 | 10 suites · 87 passed |
| `npm run build` | 0 | — |
| `npm run smoke:api` | 0 | 6 provas |
| `npm run verify:argon2-runtime` | 0 | 15/15 |
| `npm run verify:openapi-runtime` | 0 | 17/17 |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte **60 169 bytes**; `prisma migrate diff --exit-code` **0** |
| `git diff --check` | 0 | — |

Guarda 2 (anti-drift) é executada dentro de `verify:from-scratch`, verde.

### 6-J.10 Regressão de F1/F2/F3

Reexecutadas integralmente e verdes: a suíte de `apps/api` (que cobre credencial/Argon2, token de sessão, política de cookie, CSRF, limitador de login, DTOs, OpenAPI, auditoria e a fiação do `AuthModule`) e a suíte de integração com PostgreSQL real (que cobre login, logout, sessão, expiração, revogação, rate limiting, cookies, CSRF, contrato de erros e a auditoria de autenticação). As **206** provas de integração anteriores continuam passando, ao lado das 33 novas; as **437** provas unitárias anteriores continuam passando, ao lado das 42 novas.

`verify:openapi-runtime` (17/17) prova que o contrato REST não mudou no artefato ESM compilado, e `openapi.spec.ts` continua exigindo que os caminhos documentados sejam exatamente `["/auth/login","/auth/logout","/health"]`.

### 6-J.11 Zero drift de persistência

```text
git diff a9be742 -- packages/database ........ 0 linhas

schema.prisma .......... 7bee911e75e4742f = 7bee911e75e4742f   IDÊNTICO
schema.golden.sql ...... c2ad5dc539098f51 = c2ad5dc539098f51   IDÊNTICO
protected-objects.json . 9b4033a3c2cf3a79 = 9b4033a3c2cf3a79   IDÊNTICO
migrations ............. 10 -> 10   (nenhuma nova)
```

`prisma format`, `prisma migrate dev`, `prisma db push` e `prisma db pull` **NÃO** foram executados em nenhum momento desta fatia. **Nenhuma dependência nova foi instalada**: `package.json`, `package-lock.json` e `apps/api/package.json` com diff vazio contra a baseline. NestJS e TypeScript, já presentes, foram suficientes — nenhum framework de autorização (CASL, Oso, AccessControl ou equivalente) foi cogitado para poucas linhas de RBAC simples.

### 6-J.12 Fronteira — o que a F4 deliberadamente NÃO fez

- **F5 NÃO INICIADA**: nenhum seed de papéis ou permissões, nenhuma associação automática papel↔permissão, nenhum bootstrap ou usuário Administrador inicial, nenhuma senha inicial, nenhum comando ou endpoint de setup, nenhuma variável de ambiente de bootstrap.
- **F6 NÃO INICIADA**: nenhuma recuperação de senha — início, conclusão, segredo, endpoint, rate limiting próprio ou revogação em massa. A presença de `senha.recuperar_terceiro` no catálogo é reprodução do documento homologado e **não** materializa fluxo algum.
- **Autorização clínica contextual NÃO INICIADA**: nada de vínculo profissional↔paciente, atendimento, prontuário ou acesso contextual a dado clínico. `P2.2-05` permanece fora. Possuir uma permissão funcional **não** elimina as futuras restrições contextuais sobre dados clínicos (`docs/04` §2.4/§6.3; TLF-BASE-V1 §6).
- **Sem revogação de sessão de terceiro**, sem JWT, sem refresh token, sem permission token, sem Redis, sem cache distribuído, sem invalidação de cache, sem snapshot de permissão na sessão, sem CORS cross-origin, sem multitenancy, sem `apps/web`.
- **Sem nova ação de auditoria** e sem ampliação de whitelist de `contexto`.
- **Sem novo endpoint de produção**: a fatia não publica rota alguma.

Busca mecânica em `apps/api/src/` confirma que as únicas ocorrências de `seed`, `bootstrap`, `recuperação de senha`, `JWT`, `refresh token`, `Redis`, `multitenancy` e `frontend` são **textuais**, em comentários de fronteira ou no bootstrap pré-existente da aplicação — nenhuma implementação.

### 6-J.13 Riscos e pendências desta fatia

| ID | Severidade | Situação |
| --- | --- | --- |
| ~~`L-F4-01`~~ (semântica de composição) | **ENCERRADA POR ELIMINAÇÃO — §6-K** (não por decisão normativa: a abstração que a exigia foi removida) | A conjunção foi adotada por ser a alternativa conservadora sob lacuna declarada de fonte. Trocá-la por disjunção **amplia acesso** e exige decisão expressa. Enquanto não houver decisão, nenhuma rota deve depender de uma semântica que a fonte não fixou |
| Guard não aplicada a rota de produção | **OBSERVAÇÃO** | Consequência do escopo: nenhuma rota publicada tem permissão exigida pela matriz homologada. O mecanismo está provado por integração, mas seu primeiro uso real ocorrerá quando existir endpoint de domínio |
| Sessão de usuário inativado | **BAIXO** | **[RETIFICADO — §6-K, `R4-02`]** A redação anterior dizia "tratado por `L-F4-02`". A cobertura é **PARCIAL** — defesa em profundidade apenas onde a `PermissoesGuard` está aplicada; uma rota apenas autenticada permanece utilizável. **AUT-005 permanece NÃO MATERIALIZADA e NÃO ENCERRADA**; RN-001 segue aplicável. Ver §6-K.4 |
| Custo da consulta por requisição | **OBSERVAÇÃO** | Uma consulta por requisição autorizada, sem cache, por decisão de escopo (`docs/12` §16). **Nenhum problema de custo foi medido nesta fatia**; se vier a ser medido, é evidência para decisão posterior, não licença para introduzir cache agora |
| Fronteira `auth ↔ authz` no NestJS | **OBSERVAÇÃO** | **[RETIFICADO — §6-K, `R4-05`]** A redação anterior dizia "necessidade medida do framework, não escolha de arquitetura". É **uma opção**, não a única: a revisão mediu que não exportar nada falha, que exportar providers de módulos importados é rejeitado pelo NestJS, e que fazer cada consumidor importar os três módulos **funciona**. Ver §6-K.5 |

Pendências herdadas e **não** alteradas por esta fatia: `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `P-2.3D-01`, `R-2.3D-04`, `R-2.3D-05`, `R-2.3D-06`, `R-2.3D-08`, `F-12`, `F3R-06`, `F3R-07`, `P-BACK-01`, `R2.2-04`, `P2.2-05`, `L-05`..`L-08`.

### 6-J.14 Estado

```text
F4 IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA
NÃO HOMOLOGADA
NÃO INTEGRADA

F5 NÃO INICIADA
F6 NÃO INICIADA
```

**Próximo passo: revisão técnica independente e adversarial da F4 sobre a árvore exata produzida nesta execução.** A F5 não deve ser iniciada antes da homologação e integração da F4.

## 6-K. Etapa 2.3D-B / F4 — fatia corretiva pós-revisão independente

**Estado: REGISTRO HISTÓRICO DA FATIA CORRETIVA — SUPERADO PELO RITO DE HOMOLOGAÇÃO E INTEGRAÇÃO DE §6-L.** As MEDIÇÕES desta seção continuam válidas para o estado em que foram tomadas e **não foram reescritas**. A F4 está hoje **CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** (merge `fce62d9`, §6-L.8).

**Estado no encerramento desta fatia — histórico: CORRIGIDA E REMEDIDA EM BRANCH PRÓPRIA — permanece NÃO HOMOLOGADA / NÃO INTEGRADA.** Executada em 28/08/2026 sobre a MESMA baseline `main` = `origin/main` = `a9be742`, na mesma branch `agent/fase2-etapa2.3d-f4-rbac`, sobre a working tree não commitada que a revisão examinou. **Publicação não autorizada naquele momento: sem commit, push, PR, merge, rebase, tag, release ou deploy** — a autorização de publicação veio depois, com a homologação registrada em §6-L.

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta.** `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas; **`docs/12` NÃO foi tocado**; `D-2.3D-09` permanece intacta; **nenhuma `D-2.3D-14` foi criada**; `docs/09` §12 não foi reaberto; a Base Imutável permanece intacta. §6-J é preservada como registro histórico da execução inicial, com as afirmações que a revisão provou incorretas marcadas **[RETIFICADO — §6-K]** e nenhuma medição reescrita.

### 6-K.1 Parecer recebido

A revisão técnica independente e adversarial devolveu **`B — APTO COM CORREÇÕES OBJETIVAS`**: nenhum achado BLOQUEANTE ou ALTO, nenhum bypass de autorização alcançável pelo cliente HTTP, zero drift real, bateria verde e 7/7 mutações independentes próprias detectadas. Quatro achados MÉDIOS e quatro BAIXOS.

| ID | Sev. | Situação após esta fatia |
| --- | --- | --- |
| `R4-01` | MÉDIO | **CORRIGIDO** (§6-K.2) — a identidade validada passa a ser autoritativa |
| `R4-02` | MÉDIO | **RETIFICADO** (§6-K.4) — cobertura declarada como PARCIAL; AUT-005 aberta |
| `R4-03` | MÉDIO | **CORRIGIDO ESTRUTURALMENTE** (§6-K.3) — o decorator instala as guards |
| `R4-04` | MÉDIO | **ELIMINADO POR REMOÇÃO DE SUPERFÍCIE** (§6-K.3) — não há metadata de classe |
| `R4-05` | BAIXO | **RETIFICADO** (§6-K.5) — justificativa do re-export agora é factual |
| `R4-06` | BAIXO | **CONFERIDO** (§6-K.6) — erro só existiu no relatório em chat |
| `R4-07` | BAIXO | **RETIFICADO** (§6-K.6) — comentário do serviço distingue os dois casos |
| `R4-08` | BAIXO | **RETIFICADO** (§6-K.6) — rotas funcionais × `/openapi.json` |

### 6-K.2 `R4-01` — a identidade validada passa a prevalecer

**O defeito, medido pela revisão.** `anexarContextoAutenticado` retornava cedo quando já havia contexto na requisição, sob a premissa de que "duas gravações só poderiam vir de duas validações de sessão". A premissa não é garantida. A revisão mediu, em três passos: o símbolo privado é recuperável por `Object.getOwnPropertySymbols` a partir de qualquer requisição já processada; um contexto **semeado** antes da guard **sobrevivia** à gravação da identidade validada; e a `PermissoesGuard` então decidia sobre a identidade semeada — autorizando como a vítima.

Não era alcançável pelo cliente HTTP (essa proteção sempre valeu e continua valendo). O defeito era a **política**: das duas alternativas, foi adotada a menos segura, e um teste a consolidava.

**A correção.** A regra passa a ser a inversa e explícita: **a identidade recém-validada pelo `SessaoService` substitui qualquer valor previamente colocado na requisição.** A propriedade é redefinida a cada gravação (`configurable: true`, mantendo `writable: false` e `enumerable: false`). Duas validações legítimas escrevem a mesma identidade; uma contaminação anterior é descartada.

**O limite do modelo de confiança passa a ser declarado no próprio código**, em vez de implícito: a chave de símbolo protege contra o **cliente HTTP** e **não** contra código arbitrário do mesmo processo — um símbolo não registrado continua enumerável em objetos que já o carregam. A garantia que sustenta a autorização não é o sigilo da chave: é a sobrescrita.

**Testes.** O teste `"não sobrescreve um contexto já gravado"` **deixou de existir**. No lugar, três provas: contexto inexistente → identidade validada gravada; contexto semeado com outra identidade → **sobrescrito**; e a guard consulta o dono REAL da sessão (com controle positivo em que o dono real, permissionado, passa).

### 6-K.3 `R4-03` e `R4-04` — decorator único que instala as guards

**Os dois defeitos tinham a mesma raiz:** o decorator era só metadata, e a proteção dependia de um segundo ato manual. A revisão mediu o resultado: uma rota anotada com a permissão e **sem** `@UseGuards` respondia `200` a uma requisição **sem sessão alguma** (`R4-03`). E a composição classe+método, criada para impedir que um método enfraquecesse o controller, **não valia sob herança**: uma subclasse com decorator próprio descartava a exigência da classe-base (`R4-04`).

**A correção é uma redução de superfície**, não código novo:

| Antes | Depois |
| --- | --- |
| `@RequerPermissoes(A, B, …)` — lista | `@RequerPermissao(P)` — **exatamente uma**, garantida pelo tipo |
| metadata de classe + método, unidas por `Reflector.getAll` | metadata **somente do handler**, lida por `reflector.get` |
| composição `AND` (decisão local `L-F4-01`) | **não existe composição** — nada a compor |
| `@UseGuards(...)` manual, obrigatório e esquecível | `applyDecorators(SetMetadata, UseGuards(sessão, permissões))` |
| `MethodDecorator | ClassDecorator` implícito | **`MethodDecorator` explícito** — aplicar a classe é erro de compilação |

**`L-F4-01` deixa de existir — e não por decisão normativa.** A revisão mediu o dado que dissolveu a questão: **não há, na matriz de `docs/04` §4 nem na tabela §8, nenhuma operação que exija duas permissões nomeadas simultaneamente** — toda operação homologada mapeia para exatamente um identificador de §5. A cardinalidade > 1 era abstração antecipada (TLF-BASE-V1 §4.5) que *criava* uma decisão comportamental evitável. Removida a abstração, não há `AND` nem `OR` a homologar. **Nenhuma decisão nova foi pedida a Bruno, e nenhuma foi tomada em nome dele.** Quando a primeira operação real exigir composição, ela virá com fonte e com decisão própria.

Arquivo novo `permissao-exigida.metadata.ts`: existe para que o decorator possa importar as guards sem ciclo (o decorator importa as guards; a guard importa só a metadata).

**Consequência estrutural:** "declarar sem proteger" deixou de ser expressável. A fixture de integração comprova — suas rotas protegidas usam **exclusivamente** `@RequerPermissao(P)`, sem nenhum `@UseGuards` ao lado.

### 6-K.4 `R4-02` — usuário inativo: cobertura PARCIAL e AUT-005 aberta

**O que a fonte exige.** AUT-002 inclui "inativação do usuário" entre os gatilhos de encerramento. AUT-005: "ao inativar, **revogar sessões ativas**"; invariante "usuário inativo não cria sessão **nem mantém sessão utilizável**". RN-001: "sessões existentes **devem ser revogadas**".

**O que existe hoje — medido.** Não há, em `apps/api/src/`, fluxo de ativação/inativação de **usuário** (a única inativação implementada é a de `profissional`, entidade distinta). `SessaoService.validar` **não** consulta `usuario.ativo`. Consequências medidas pela revisão contra PostgreSQL real: uma sessão de conta inativada **continua válida**, permanece **`ATIVA`** no banco, e uma rota **apenas autenticada** responde **`200`**; só onde a `PermissoesGuard` está aplicada há negação (`403`).

**Enquadramento correto, que substitui a redação anterior.** `L-F4-02` é **defesa em profundidade de cobertura PARCIAL** contra um estado inconsistente. Ela **não** materializa AUT-005, **não** substitui a obrigação de revogar as sessões na inativação e **não** protege rotas apenas autenticadas.

**Declaração expressa:**

```text
AUT-005: NÃO MATERIALIZADA / NÃO ENCERRADA
RN-001:  APLICÁVEL e NÃO SATISFEITO fora do alcance do RBAC
```

A revogação por inativação deverá ser materializada **junto ao fluxo que implementar a ativação/inativação de usuários**, usando os estados terminais de `D-2.3D-05`. Este documento **não** fixa em qual fatia isso ocorrerá — atribuir a fatia seria decisão que a documentação ainda não tomou.

**Nada foi alterado no comportamento.** O `403` do RBAC permanece; `SessaoService.validar` **não** foi tocado; nenhuma semântica nova de sessão foi introduzida. O que mudou foi a honestidade do registro — e o teste, que agora declara no próprio corpo que o estado é **artificial** (escrito diretamente na persistência, inalcançável por rota de produção), que **não** prova AUT-005, que a sessão **não** foi revogada e que a cobertura é parcial. Uma asserção nova mede explicitamente o limite: a mesma sessão inativada continua obtendo `200` na rota apenas autenticada.

### 6-K.5 `R4-05` — justificativa do re-export, agora factual

A revisão mediu as três configurações possíveis:

| Alternativa | Resultado medido |
| --- | --- |
| não exportar nada além dos próprios providers | **falha** — `Nest can't resolve dependencies of the SessaoAutenticadaGuard` |
| exportar providers específicos vindos de módulos importados | **rejeitado pelo framework** — `Nest cannot export a provider/module that is not a part of the currently processed module` |
| não reexportar; cada consumidor importa `AuthzModule` + `AuthModule` + `DatabaseModule` | **funciona** |

A configuração vigente foi **mantida** — ela é simples, testada e deixa o consumidor com um único import. O que mudou é a redação: deixou de alegar "necessidade medida do NestJS" e passou a declarar que é **a opção adotada para encapsular as dependências exigidas pelas guards**, com o **trade-off explícito**: o consumidor passa a enxergar também `CredencialService`, `AutenticacaoService`, `SessaoService`, `POLITICA_COOKIE_SESSAO` e `DatabaseService`. Nenhuma abstração foi criada.

### 6-K.6 `R4-06`, `R4-07` e `R4-08`

**`R4-06` — 645 × 745.** Conferido **na árvore PRÉ-correção**: `apps/api/src/authz/` tinha **745** linhas em **8** arquivos (66+118+23+84+126+138+108+82 na medição da primeira revisão independente). A discrepância existiu **apenas no relatório em chat da execução inicial** — as strings `645` e `745` **não constam** de `docs/10` em nenhum momento, e **nenhum arquivo foi omitido** do inventário. Nada foi alterado na documentação para incluir contagem de linhas.

> **[RETIFICAÇÃO — `R4R2-01`, 28/08/2026]** A redação anterior deste parágrafo afirmava, em tempo presente, que `apps/api/src/authz/` "tem **745** linhas", e remetia a §6-K.7 para "a contagem vigente" — mas §6-K.7 é tabela `Arquivo | Situação` e **não contém contagem alguma**. A **segunda** revisão técnica independente adversarial mediu o estado real da árvore corrigida e registrou o finding `R4R2-01` (**BAIXO**, documental, sem impacto de comportamento ou de segurança). Medição vigente, conferida por `wc -l apps/api/src/authz/*.ts`:
>
> ```text
> apps/api/src/authz/ — árvore corrigida e HOMOLOGADA
> 9 arquivos · 798 linhas
> authz.module.ts .................  80
> contexto-autenticado.ts ......... 141
> erro-autorizacao.ts .............  23
> permissao-exigida.metadata.ts ...  44
> permissoes.catalogo.ts ..........  84
> permissoes.guard.ts ............. 114
> permissoes.service.ts ........... 148
> requer-permissao.decorator.ts ...  82
> sessao-autenticada.guard.ts .....  82
> ```
>
> As **745** linhas em **8** arquivos permanecem registradas acima como o valor **histórico** da árvore pré-correção, e **não** foram reescritas: a fatia corretiva acrescentou `permissao-exigida.metadata.ts` e substituiu `requer-permissoes.decorator.ts` por `requer-permissao.decorator.ts` (§6-K.7). A correção desta retificação é **exclusivamente documental** — nenhuma linha de runtime ou de teste foi tocada por ela.

**`R4-07` — identificador não UUID.** Nenhuma validação nova, nenhuma biblioteca. Apenas o comentário do `PermissoesService` passou a distinguir os dois casos: ausente, vazio ou de tipo inválido → recusa **antes** do banco; string não vazia que não seja UUID → o driver rejeita, a exceção **sobe** e vira `500` — fail-closed, e inalcançável pelo cliente, porque o `usuarioId` vem sempre de `sessao_autenticacao.usuario_id`.

**`R4-08` — rotas publicadas.** A redação passou a distinguir **rotas funcionais** (`/health`, `/auth/login`, `/auth/logout`) de `/openapi.json`, que não é rota funcional e é servida apenas conforme a política de ambiente homologada na F3.

### 6-K.7 Componentes após a correção

| Arquivo | Situação |
| --- | --- |
| `apps/api/src/authz/requer-permissao.decorator.ts` | **NOVO** — `@RequerPermissao(P)`: metadata + guards, `MethodDecorator` |
| `apps/api/src/authz/permissao-exigida.metadata.ts` | **NOVO** — chave de metadata e normalização fail-closed |
| ~~`apps/api/src/authz/requer-permissoes.decorator.ts`~~ | **REMOVIDO** |
| `apps/api/src/authz/permissoes.guard.ts` | leitura de UMA permissão, somente do handler; sem `getAll` |
| `apps/api/src/authz/contexto-autenticado.ts` | sobrescrita da identidade validada; limite do modelo de confiança declarado |
| `apps/api/src/authz/permissoes.service.ts` | comentário de `R4-07`; comportamento **inalterado** |
| `apps/api/src/authz/authz.module.ts` | justificativa do re-export retificada; wiring **inalterado** |
| `apps/api/src/authz/permissoes.catalogo.ts` · `erro-autorizacao.ts` · `sessao-autenticada.guard.ts` | inalterados (exceto um exemplo textual no catálogo) |

Fluxo vigente:

```text
@RequerPermissao("usuarios.gerenciar")
  -> SessaoAutenticadaGuard   cookie D-2.3D-07 -> SessaoService.validar
                              inválida -> 401 { "erro": "SESSAO_INVALIDA" }
                              válida   -> grava a identidade VALIDADA (sobrescreve)
  -> PermissoesGuard          lê UMA permissão do handler
                              metadata ausente/inválida     -> 403
                              contexto ausente              -> 403
                              usuário inexistente/inativo   -> 403
                              permissão ausente do conjunto -> 403
  -> handler
```

### 6-K.8 Provas medidas

**Unitárias — 42 provas** (`test:api` **19 suites · 479 passed**, mesmo total da execução inicial por coincidência de composição):

| Suíte | Antes | Depois | O que mede agora |
| --- | ---: | ---: | --- |
| `permissoes.catalogo.spec.ts` | 8 | **8** | inalterada — catálogo ≡ `docs/04` §5 |
| ~~`requer-permissoes.decorator.spec.ts`~~ → `requer-permissao.decorator.spec.ts` | 13 | **12** | aridade 1; recusa de lista; **guards instaladas e na ordem**; método vizinho não decorado sem guard; **nenhuma metadata de classe** |
| `permissoes.guard.spec.ts` | 21 | **22** | sem composição; **`R4-01`** (3 provas + controle positivo); fail-closed incl. metadata em lista; `403` nunca `401`; falha técnica → exceção |

**Integração com PostgreSQL 18 real — 33 provas** (`verify:api-integration` **7 suites · 239 passed**). Removidas as 2 provas de conjunção `L-F4-01`; acrescentadas 2 de exigência por operação (duas rotas independentes; possuir a permissão de uma não abre a outra) e asserções novas dentro de casos existentes. As rotas protegidas da fixture passaram a usar **só** o decorator — se ele deixar de instalar as guards, 16 provas caem.

Cenários preservados e verdes: autorizado (inclusive a partir do **login real**), sem permissão, múltiplos papéis (união, duplicidade), zero papel, papel vazio, isolamento entre usuários, identidade forjada por header/query/body, sessão ausente/malformada/inexistente/segredo errado, revogada, expirada absoluta e ociosa, usuário inativado (agora com limite declarado), guard à mão sem metadata, guard à mão sem sessão, resolução determinística, código fora do catálogo, e as rotas de autenticação sem RBAC com `/health` público.

### 6-K.9 Mutation challenges — 9 aplicados, 9 detectados, 9 revertidos

| # | Mutação | Unitária | Integração | Reversão |
| --- | --- | --- | --- | --- |
| `C-F4C-01` | contexto já gravado volta a NÃO ser sobrescrito (regressão de `R4-01`) | **2 falhas** | 33 passed | SHA idêntico |
| `C-F4C-02` | decorator deixa de instalar `SessaoAutenticadaGuard` | 2 falhas | **16 falhas** | SHA idêntico |
| `C-F4C-03` | decorator deixa de instalar `PermissoesGuard` | 3 falhas | **12 falhas** | SHA idêntico |
| `C-F4C-04` | ordem invertida das guards | 3 falhas | **16 falhas** | SHA idêntico |
| `C-F4C-05` | `PermissoesGuard` sempre permite | **14 falhas** | **14 falhas** | SHA idêntico |
| `C-F4C-06` | consulta sem filtro por `usuario_id` | — | **5 falhas** | SHA idêntico |
| `C-F4C-07` | remove a negação por `usuario.ativo` | — | **1 falha** | SHA idêntico |
| `C-F4C-08` | remove permissão do catálogo | **3 falhas** | — | SHA idêntico |
| `C-F4C-09` | metadata em LISTA volta a ser aceita (reintroduz composição) | **2 falhas** | — | SHA idêntico |

**Registro honesto de `C-F4C-01`:** ele é detectado **apenas pela suíte unitária**; a de integração passa `33/33`. Isso é esperado e não é lacuna — a contaminação de contexto **não é produzível por HTTP**, apenas por código dentro do processo. A prova pertence, corretamente, ao nível unitário.

### 6-K.10 Bateria integral

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run test:api` | 0 | **19 suites · 479 passed** |
| `npm run verify:api-integration` | 0 | **7 suites · 239 passed** |
| `npm run verify:from-scratch` | 0 | 10 suites · 87 passed |
| `npm run build` | 0 | — |
| `npm run smoke:api` | 0 | 6 provas |
| `npm run verify:argon2-runtime` | 0 | 15/15 |
| `npm run verify:openapi-runtime` | 0 | 17/17 |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte **60 169 bytes**; `migrate diff --exit-code` 0 |
| `git diff --check` | 0 | — |

Guarda 2 executada dentro de `verify:from-scratch`, verde.

### 6-K.11 Regressão, drift e fronteiras

F1/F2/F3 reexecutadas integralmente e verdes; nenhum arquivo de `auth/` foi tocado nesta fatia corretiva — a única alteração em artefato da F3 continua sendo o export aditivo de `POLITICA_COOKIE_SESSAO` (§6-J.6), inalterado. Contrato REST e OpenAPI intactos (`verify:openapi-runtime` 17/17; `openapi.spec.ts` exigindo exatamente `["/auth/login","/auth/logout","/health"]`).

```text
git diff a9be742 -- packages/database ........ 0 linhas
schema.prisma / schema.golden.sql / protected-objects.json ... hashes IDÊNTICOS
migrations .................................. 10
prisma format / migrate dev / db push / db pull ... NÃO executados
package.json / apps/api/package.json / package-lock.json ... diff VAZIO
```

```text
F5 NÃO INICIADA
F6 NÃO INICIADA
AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA
autorização clínica contextual NÃO INICIADA (P2.2-05)
frontend NÃO INICIADO · JWT / refresh token / Redis NÃO INTRODUZIDOS
schema NÃO ALTERADO · nenhum endpoint de negócio novo
nenhuma ação de auditoria nova · nenhuma whitelist ampliada
```

### 6-K.12 Riscos e observações mantidos

| Item | Situação |
| --- | --- |
| Cobertura parcial do usuário inativo | **BAIXO — DECLARADO** (§6-K.4). AUT-005 aberta |
| TOCTOU da autorização | **OBSERVAÇÃO** — a decisão representa o estado no instante da guard; permissão removida depois não interrompe o handler. Aceito no MVP; operações sensíveis futuras poderão exigir revalidação na própria transação de negócio. Nenhum lock, cache ou serialização global foi introduzido |
| Transação interativa para leitura única | **OBSERVAÇÃO** — `DatabaseService.transacao` é a API pública disponível (o cliente é privado). Nenhum problema de custo medido; nenhuma abstração criada |
| CSRF não composta pelas guards da F4 | **OBSERVAÇÃO** — registrada para futuras mutações HTTP; a F3 não foi alterada |
| Anti-drift protege sincronia, não estabilidade | **OBSERVAÇÃO** — remoção coordenada em documento **e** código passaria; `docs/04` é controle superior e o risco não justifica mecanismo adicional |
| Guard não aplicada a rota de produção | **OBSERVAÇÃO** — nenhuma rota publicada tem permissão exigida pela matriz de `docs/04` §4 |

### 6-K.13 Estado

```text
F4 CORRIGIDA E REMEDIDA EM BRANCH PRÓPRIA
NÃO HOMOLOGADA
NÃO INTEGRADA
```

**Próximo passo: NOVA revisão técnica independente e adversarial sobre a árvore corrigida.** A F5 não deve ser iniciada antes da homologação e integração da F4.

> **[ESTADO SUPERADO — §6-L]** O bloco acima é o registro **histórico** do estado ao término da fatia corretiva e **não foi reescrito**. A segunda revisão técnica independente adversarial foi executada sobre esta mesma árvore e devolveu **`A — APTO À HOMOLOGAÇÃO E VERSIONAMENTO`**. O estado vigente da F4 está em **§6-L**.

## 6-L. Etapa 2.3D-B / F4 — homologação e rito de versionamento

**Estado: CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** — homologada por Bruno Menezes Noronha em 28/08/2026 (TLF-BASE-V1 §15, item 1), após **duas** revisões técnicas independentes adversariais e uma fatia corretiva, sobre a árvore técnica de `main` = `origin/main` = `a9be742c150ebe43df0d03ef9ec1529cff5d780a`, na branch `agent/fase2-etapa2.3d-f4-rbac`; integrada pelo merge commit `fce62d9a2b79a59a40487c64cc913b2d98049683` (PR [#16](https://github.com/BrunoMNoronha/techlab-fisio/pull/16)) — registro pós-medição em **§6-L.8**.

A homologação abrange **exatamente** a árvore revisada, mais a correção **documental** `R4R2-01`. **Nenhuma linha de runtime ou de teste foi alterada nesta execução** — o manifesto SHA-256 dos 14 arquivos de runtime/teste da F4 é idêntico ao conferido pela segunda revisão.

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta.** `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas; `D-2.3D-09` permanece intacta; **nenhuma `D-2.3D-14` foi criada**; `docs/09` §12 não foi reaberto; a Base Imutável permanece intacta.

### 6-L.1 Escopo homologado

O **mecanismo** de autorização RBAC — não funcionalidade nova, e nenhuma rota de negócio:

| Componente | Papel |
| --- | --- |
| `SessaoAutenticadaGuard` | ponte com a autenticação vigente (F2/F3); `401` e somente `401` |
| `PermissoesGuard` | decisão de acesso; `403` e nunca `401` |
| `PermissoesService` | resolução das permissões efetivas — união dos papéis, consulta única |
| `permissoes.catalogo.ts` | catálogo tipado das **29** permissões de `docs/04` §5 |
| `contexto-autenticado.ts` | identidade da requisição sob chave de símbolo privada |
| `permissao-exigida.metadata.ts` | chave de metadata e normalização fail-closed |
| `@RequerPermissao(P)` | porta pública **singular**, `MethodDecorator`, que **instala** as duas guards na ordem |
| `AuthzModule` | módulo **sem controller**, registrado no `AppModule` |
| suítes da F4 | 3 unitárias + fixture + integração contra PostgreSQL 18 real |

Propriedades homologadas: metadata **exclusivamente por handler**; composição automática `SessaoAutenticadaGuard → PermissoesGuard`; comportamento **fail-closed**; **união de múltiplos papéis**; **ausência de bypass por nome de papel**; **separação entre RBAC e autorização contextual por recurso**.

**A homologação NÃO significa que:**

```text
AUT-005 está implementada
autorização clínica contextual (P2.2-05) está implementada
F5 está iniciada
F6 está iniciada
```

### 6-L.2 Base técnica da decisão — segunda revisão independente

```text
veredito: A — APTO À HOMOLOGAÇÃO E VERSIONAMENTO
0 BLOQUEANTES
0 ALTOS
0 MÉDIOS
1 BAIXO documental — R4R2-01 (corrigido nesta execução, §6-K.6)
```

| Rodada | Veredito | Desfecho |
| --- | --- | --- |
| 1ª — F4 implementada (§6-J) | `B` | `R4-01`..`R4-08` — corrigidos em §6-K |
| 2ª — F4 corrigida (§6-K) | **`A`** | Nenhum BLOQUEANTE/ALTO/MÉDIO. Um BAIXO (`R4R2-01`), corrigido em §6-K.6 |

**Confirmação independente de `R4-01`..`R4-08`** — cada um reproduzido com evidência própria da revisão, não aceito por descrição:

| Finding | Estado confirmado |
| --- | --- |
| `R4-01` contexto sobrescrito | **CONFIRMADAMENTE CORRIGIDO** — contexto semeado é substituído pela identidade validada; descritor medido `{enumerable:false, writable:false, configurable:true}`; descritor adversarial `configurable:false` faz a guard **lançar** (handler inalcançado), nunca aceitar o contexto falso |
| `R4-02` usuário inativo / AUT-005 | **CONFIRMADAMENTE CORRIGIDO** (retificação documental) — RBAC `403`, rota apenas autenticada não protegida, sessão permanece `ATIVA` |
| `R4-03` composição das guards | **CONFIRMADAMENTE CORRIGIDO** — metadata `[SessaoAutenticadaGuard, PermissoesGuard]` **e** ordem de **runtime** medida por instrumentação; sem sessão, a `PermissoesGuard` **não é sequer alcançada** |
| `R4-04` metadata de classe/herança | **CONFIRMADAMENTE CORRIGIDO** — zero ocorrências de `getAll*`/`RequerPermissoes`/`CHAVE_PERMISSOES_EXIGIDAS`; aplicar a classe é **erro de compilação** |
| `R4-05` justificativa do re-export | **CONFIRMADAMENTE CORRIGIDO** — as três configurações reproduzidas pela revisão, com as mensagens do Nest idênticas às documentadas |
| `R4-06` contagem de linhas | **PARCIALMENTE CORRIGIDO** → gerou `R4R2-01`, **encerrado** por §6-K.6 |
| `R4-07` identificador não-UUID | **CONFIRMADAMENTE CORRIGIDO** |
| `R4-08` rotas publicadas | **CONFIRMADAMENTE CORRIGIDO** |

**Perguntas de falsificação da revisão — todas respondidas `NÃO`:** cliente sem sessão não alcança o handler; autenticado sem permissão não alcança o handler; papel chamado "Administrador" não bypassa; identidade falsa pré-carregada não sobrevive; guards executam na ordem alegada; o decorator sozinho instala toda a proteção; não há metadata de classe/herança oculta; múltiplos papéis concedem apenas suas permissões reais; permissão de outro usuário não vaza; erro técnico não abre acesso; a F4 não alega implementar AUT-005; nenhuma correção anterior criou regressão.

### 6-L.3 Mutation challenges independentes da segunda revisão

**15 mutações**, construídas pela revisão (não reaproveitadas do executor), **15 detectadas**, **15 revertidas com conferência de hash**:

| ID | Mutação | Detectada por |
| --- | --- | --- |
| `M-F4R2-01` | remove `SessaoAutenticadaGuard` do decorator | 2 unit · 16 integração |
| `M-F4R2-02` | remove `PermissoesGuard` do decorator | 3 unit · 12 integração |
| `M-F4R2-03` | inverte a ordem das guards | 3 unit · 16 integração |
| `M-F4R2-04` | metadata em array volta a ser aceita | 2 unit |
| `M-F4R2-05` | considera somente o primeiro papel | 3 integração |
| `M-F4R2-06` | remove o filtro por `usuario_id` | 5 integração |
| `M-F4R2-07` | `catch` do resolvedor retorna allow | 1 unit |
| `M-F4R2-08` | remove uma permissão do catálogo | 3 unit |
| `M-F4R2-09` | metadata ausente ⇒ rota liberada | 2 unit · 2 integração |
| `M-F4R2-10` | `anexarContextoAutenticado` preserva contexto antigo | 2 unit |
| `M-F4R2-11` | concede se a permissão existir para qualquer usuário | 5 integração |
| `M-F4R2-12` | usuário inativo deixa de ser negado | 1 integração |
| `M-F4R2-13` | metadata gravada na classe, não no handler | 10 unit · 13 integração |
| `M-F4R2-14` | decorator deixa de instalar guards | 3 unit · 16 integração |
| `M-F4R2-15` | RBAC lê identidade da query se faltar contexto | 1 unit |

Nenhuma mutação perigosa sobreviveu. `M-F4R2-10` e `M-F4R2-15` são mortas apenas pela suíte unitária — ambas descrevem contaminação **intraprocesso**, inalcançável por cliente HTTP, o que é consistente com o modelo de confiança declarado em `contexto-autenticado.ts`.

### 6-L.4 Bateria de homologação — medida pela revisão independente

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run test:api` | 0 | **19 suites · 479 tests** |
| `npm run verify:api-integration` | 0 | **7 suites · 239 tests** |
| `npm run verify:from-scratch` | 0 | **10 suites · 87 tests** |
| `npm run build` | 0 | — |
| `npm run smoke:api` | 0 | 10 migrations aplicadas |
| `npm run verify:argon2-runtime -w @techlab-fisio/api` | 0 | **15/15** |
| `npm run verify:openapi-runtime -w @techlab-fisio/api` | 0 | **17/17** |
| `npm run lint:migrations` (Guarda 1) | 0 | — |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte **60 169 bytes**; `migrate diff --exit-code` 0 |
| `git diff --check` | 0 | — |

Guarda 2 verde dentro de `verify:from-scratch`. As contagens foram **medidas novamente** pela revisão, não copiadas do relatório do executor.

**Catálogo de permissões** — extração mecânica de `docs/04` §5 × TypeScript: **29 × 29**, zero faltantes, zero extras, zero duplicatas, **ordem idêntica**.

**Matriz `401` × `403`** medida por HTTP real contra PostgreSQL 18: sem sessão, cookie irrelevante, sessão malformada, sessão inexistente, segredo errado, sessão revogada e sessão expirada → **`401`**; sessão válida sem a permissão → **`403`**; sessão válida com a permissão → **`200`** com handler efetivamente alcançado. O `403` não é oráculo: causas distintas produzem corpo idêntico `{"erro":"ACESSO_NEGADO"}`, sem nome de papel, permissão, token ou cookie em corpo ou cabeçalho.

### 6-L.5 Zero drift, dependências e fronteiras

```text
packages/database/prisma/schema.prisma ....... zero alteração
packages/database/prisma/migrations/** ....... zero alteração · 10 migrations
packages/database/schema.golden.sql .......... zero alteração · 60 169 bytes
packages/database/protected-objects.json ..... zero alteração
package.json · apps/api/package.json · package-lock.json ... intactos
```

```text
zero drift
zero migration nova
zero dependência nova
```

Rotas publicadas pela aplicação: **`/auth/login`, `/auth/logout`, `/health`** — asserção de igualdade exata inalterada e verde. O `AuthzModule` **não publica rota alguma**; `ModuloFixtureF4` não é referenciado por nenhum arquivo de `src/`.

Nada de F5, seed de papéis/permissões, bootstrap do primeiro Administrador, recuperação de senha, JWT, refresh token, Redis, multitenancy, frontend, `apps/web`, autorização clínica contextual, migration, schema novo, ação nova de auditoria ou ampliação de whitelist entrou nesta fatia.

### 6-L.6 Riscos e limites declarados, aceitos na homologação

| Item | Situação |
| --- | --- |
| **AUT-005** | `NÃO MATERIALIZADA / NÃO ENCERRADA`. `L-F4-02` é defesa em profundidade de cobertura **PARCIAL**: nega sob a `PermissoesGuard`, **não** protege rotas apenas autenticadas e **não** revoga a sessão. `RN-001` segue `APLICÁVEL e NÃO SATISFEITO` fora do alcance do RBAC (§6-K.4, §9) |
| **Autorização clínica contextual (`P2.2-05`)** | `NÃO INICIADA`. A F4 responde apenas à pergunta abstrata "o usuário possui a permissão?", sem escopo por recurso, e **não cria bypass** para a fatia futura |
| **TOCTOU** | A autorização é **snapshot no instante da guard**. Nenhuma fonte homologada exige revalidação transacional nesta fatia; registrado como observação arquitetural para operações sensíveis futuras |
| **Modelo de confiança do símbolo** | Protege contra o **cliente HTTP**; **não** isola contra código arbitrário do mesmo processo. A garantia que sustenta a autorização é a **sobrescrita** da identidade validada, não o sigilo do símbolo |
| **Custo** | Uma consulta por requisição protegida, sem cache — deliberado (`docs/12` §16) |
| **Re-export do `AuthzModule`** | **Opção simples válida**, não necessidade técnica; trade-off declarado em `authz.module.ts`. A alternativa "consumidor importa os três módulos" também funciona |

### 6-L.7 Estado no ato da homologação — registro histórico

```text
F4 — HOMOLOGADA POR BRUNO MENEZES NORONHA
F4 — APTA AO RITO DE VERSIONAMENTO/INTEGRAÇÃO
F5 — NÃO INICIADA
F6 — NÃO INICIADA
```

O registro **factual** do merge — SHA do merge commit, número do PR e medições sobre a `main` integrada — pertence a **execução documental posterior**, seguindo o precedente `MEDIR → REGISTRAR` das integrações F0/F2/F3 (§6-I.8, REV. 15, REV. 20). Este documento **não** afirma, neste momento, que a F4 está integrada na `main`.

> **[ESTADO SUPERADO — §6-L.8]** O bloco e o parágrafo acima são o registro **histórico** do estado no ato da homologação, tomado **antes** do merge, e **não foram reescritos**. O rito foi concluído: a F4 está **INTEGRADA NA `main`** pelo merge commit `fce62d9`. O estado vigente e as medições pós-merge estão em **§6-L.8**. **F5 e F6 permanecem NÃO INICIADAS.**

### 6-L.8 Registro pós-medição da integração

Registro **exclusivamente factual** do rito, no precedente MEDIR → REGISTRAR das REV. 10, REV. 15 e REV. 20 (§6-I.8). **Esta seção não cria, altera ou reabre decisão alguma.**

| Item | Valor |
| --- | --- |
| `main` antes | `a9be742c150ebe43df0d03ef9ec1529cff5d780a` |
| Commit da fatia — implementação + homologação documental + `R4R2-01` | `ea8c74dc89b9aae3aba7ca45d3fc597e0253e484` — `feat(authz): implement RBAC guards and decorators` |
| Pull request | [#16](https://github.com/BrunoMNoronha/techlab-fisio/pull/16) |
| HEAD homologado e validado pela CI | `ea8c74dc89b9aae3aba7ca45d3fc597e0253e484` |
| Merge commit | `fce62d9a2b79a59a40487c64cc913b2d98049683` |
| `main` depois | `fce62d9a2b79a59a40487c64cc913b2d98049683` |
| Método | **merge commit** — sem squash, sem rebase, sem force-push |

**Commit único.** Diferentemente da F3, a F4 foi versionada em **um único commit**: não houve incidente de CI, não houve correção de harness e nenhuma linha de runtime ou de teste precisou ser alterada depois da homologação. O manifesto SHA-256 dos **17** arquivos de runtime/teste da fatia permaneceu idêntico ao conferido pela segunda revisão independente, do gate inicial até o commit.

**Genealogia conferida** — `git show --no-patch --format=fuller fce62d9`:

```text
merge ........ fce62d9a2b79a59a40487c64cc913b2d98049683
parent 1 ..... a9be742c150ebe43df0d03ef9ec1529cff5d780a   (main antes)
parent 2 ..... ea8c74dc89b9aae3aba7ca45d3fc597e0253e484   (fatia F4)
```

**Proteção contra corrida.** Imediatamente antes do merge, HEAD local, HEAD remoto da branch e `headRefOid` do PR coincidiam em `ea8c74d` — o mesmo SHA que passou pela CI —, `origin/main` permanecia em `a9be742` desde a homologação, `merge-base` = `origin/main`, e o PR estava `MERGEABLE` / `CLEAN`. O commit da fatia foi preservado como ancestral da `main`.

#### Medições da CI sobre o HEAD integrado

Run [33222908307](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33222908307) — **success** sobre `ea8c74d`, job único `E-16 — tríade anti-drift + reconstrução from-scratch + suíte integral`, **2m26s** (00:13:59Z → 00:16:25Z), todos os passos verdes:

| Etapa | Resultado |
| --- | --- |
| Guarda 1 — lint de migrations sobre objetos protegidos | `OK — nenhuma remoção de objeto protegido detectada` |
| E-15 + Guarda 2 — reconstrução from-scratch | **10 suites · 87 passed** |
| Guarda 3 + alarme — golden byte a byte e `migrate diff --exit-code` | `OK — dump byte a byte idêntico ao golden versionado (60169 bytes)` |
| Suíte de `apps/api` | **19 suites · 479 passed** |
| **Integração com PostgreSQL 18 real** | **7 suites · 239 passed** |
| Provas de runtime — Argon2id e OpenAPI no ESM compilado | verdes · OpenAPI `17 verificações OK` |
| Histórico de migrations autossuficiente | verde |

As contagens produzidas pela CI no Linux **coincidem exatamente** com as medidas localmente no Windows durante a revisão independente e a homologação — nenhuma divergência por plataforma, ao contrário do incidente IPv6 da F3 (§6-I.8), cuja correção já estava integrada na baseline.

#### Validação local sobre a `main` integrada

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run test:api` | 0 | **19 suites · 479 tests** |
| `npm run verify:api-integration` | 0 | **7 suites · 239 tests** |
| `npm run verify:from-scratch` | 0 | **10 suites · 87 tests** |
| `npm run build` | 0 | — |
| `npm run smoke:api` | 0 | 10 migrations aplicadas |
| `npm run verify:argon2-runtime -w @techlab-fisio/api` | 0 | **15/15** |
| `npm run verify:openapi-runtime -w @techlab-fisio/api` | 0 | **17/17** |
| `npm run lint:migrations` | 0 | Guarda 1 verde |
| `npm run schema:verify` | 0 | Guarda 3 — golden **60 169 bytes** byte a byte |
| `git status --short` | — | árvore limpa |

Executada sobre `main` = `origin/main` = `fce62d9`, após `git pull --ff-only`. As contagens são as mesmas medidas na homologação e pela CI — a integração **não** alterou nenhuma delas.

#### Zero drift na `main` integrada

```text
git diff a9be742 fce62d9 -- packages/database ....... 0 linhas

schema.prisma .......... 7bee911e75e4742f = 7bee911e75e4742f   IDÊNTICO
schema.golden.sql ...... c2ad5dc539098f51 = c2ad5dc539098f51   IDÊNTICO
protected-objects.json . 9b4033a3c2cf3a79 = 9b4033a3c2cf3a79   IDÊNTICO
migrations ............. 10 -> 10
golden ................. 60 169 bytes
```

```text
zero drift · zero migration nova · zero dependência nova
```

`git diff a9be742 fce62d9` sobre `package.json`, `apps/api/package.json`, `package-lock.json` e `packages/database/package.json` → **saída vazia**. Os três hashes de persistência são os **mesmos** registrados na integração da F3 (§6-I.8): a persistência não é tocada desde então.

#### Pendências que permanecem vivas após a integração

| Item | Estado |
| --- | --- |
| **AUT-005** | **NÃO MATERIALIZADA / NÃO ENCERRADA.** Conferido na `main` integrada: não existe fluxo de ativação/inativação de **usuário** em `apps/api/src`; a checagem de `usuario.ativo` vive em `SessaoService.emitirEm` (emissão), e **`SessaoService.validar` não a consulta**. A fatia que a materializará **não foi atribuída** — atribuí-la seria decisão ainda não tomada |
| **RN-001** | **APLICÁVEL e NÃO SATISFEITO** fora do alcance parcial da `PermissoesGuard`. `L-F4-02` continua sendo defesa em profundidade de cobertura **PARCIAL**: nega sob o RBAC, mas não protege rotas apenas autenticadas e não revoga a sessão |
| **`P2.2-05`** | Autorização clínica contextual por relação profissional↔paciente — **NÃO INICIADA**. A F4 não criou bypass para ela |
| **`R2.2-04`** | **ABERTO / MITIGADO PARCIALMENTE** (§7.2) — herdado, não afetado por esta fatia |
| **`P-2.3D-03`** | **MEDIDA E VERDE — encerramento formal PENDENTE de decisão de Bruno Menezes Noronha** — estado corrente preservado, sem encerramento implícito |
| **TOCTOU** | Observação arquitetural registrada em §6-L.6 — a autorização é snapshot no instante da guard. Nenhuma fonte exige revalidação transacional nesta fatia |

**F5 e F6 permanecem NÃO INICIADAS.** Nenhum artefato de seed de papéis/permissões, bootstrap do primeiro Administrador ou recuperação de senha existe em `apps/api/src`; `apps/web` não existe.

#### Publicação

```text
commit da F4 ....... SIM — ea8c74dc89b9aae3aba7ca45d3fc597e0253e484
push da F4 ......... SIM — agent/fase2-etapa2.3d-f4-rbac, sem force
PR da F4 ........... #16
merge da F4 ........ SIM — fce62d9a2b79a59a40487c64cc913b2d98049683
deploy ............. NÃO
tag/release ........ NÃO
```

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta por este registro.** `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas; `D-2.3D-09` e `D-2.3D-10` intactas; **nenhuma `D-2.3D-14`**; `docs/09` §12 não reaberto; `docs/12` **não foi alterado** por esta execução — ele já registra a F4 como `CONCLUÍDA` desde a REV. 5; a Base Imutável permanece **intacta**.

## 6-M. Etapa 2.3D-B / F5 — seed de papéis/permissões + bootstrap do primeiro Administrador

**Estado: IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA — NÃO HOMOLOGADA / NÃO INTEGRADA.** Executada em 29/08/2026 na branch `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`, criada a partir de `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337` (merge da F4 + registro pós-integração; §6-L.8, §11 REV. 24). Working tree limpa no gate inicial. **Publicação não autorizada nesta execução: sem commit, push, PR, merge, rebase, tag, release ou deploy.**

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta.** `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas; **`docs/12` NÃO foi tocado**; `D-2.3D-09` e `D-2.3D-10` permanecem intactas; **nenhuma `D-2.3D-14` foi criada**; `docs/09` §12 não foi reaberto; **nenhuma ação de auditoria foi acrescentada e nenhuma whitelist de `contexto` foi ampliada**; a Base Imutável permanece intacta.

> **[SEÇÃO HISTÓRICA — leia antes de citar.]** §6-M registra a execução de **29/08/2026** e **não é o estado corrente da F5**. O parágrafo acima era verdadeiro naquela data. **[SUPERADO — REV. 27, 31/08/2026]** `D-2.3D-14` e `D-2.3D-15` foram homologadas por Bruno Menezes Noronha e `docs/12` (REV. 6) passou a integrar o conjunto de alterações da F5. O estado corrente está em **§6-O**; a fatia corretiva intermediária, em §6-N. Segue verdadeiro, e não foi superado: **nenhuma decisão anterior** foi alterada, renumerada, reduzida ou reaberta, e catálogo e whitelist de auditoria continuam **não ampliados**.

### 6-M.1 Objetivo e escopo materializado

A F5 entrega os DADOS que o mecanismo da F4 já sabia consumir: os papéis, as permissões, a matriz que os liga e a primeira identidade administrativa. Nenhuma rota nova, nenhum endpoint, nenhuma funcionalidade de usuário final.

| Elemento | Fonte que o governa | Como foi materializado |
| --- | --- | --- |
| Quatro papéis do MVP | `docs/04` §3 | `catalogo-rbac.ts` — `PAPEIS`, com `nome` idêntico ao título de §3 |
| Identificadores de permissão | `D-2.3D-09`; `docs/04` §5 | **Reúso** do catálogo tipado da F4 (`authz/permissoes.catalogo.ts`). Nenhum segundo catálogo nasce nesta fatia |
| `permissao.nome` | `docs/04` §5 | Descrição funcional da fonte, **verbatim** — provada contra o documento lido em disco |
| Matriz papel↔permissão | `D-2.3D-09`; `docs/04` §4 | `MATRIZ_RBAC`, derivada célula a célula por regra declarada (§6-M.4) e provada contra a tabela do documento |
| Seed idempotente | `D-2.3D-09` | `SeedRbacService.executar()` — lê o estado vigente e escreve só o que falta |
| Bootstrap manual e idempotente | `D-2.3D-10` | `BootstrapAdministradorService` + CLI dedicado; `ProvisionamentoModule` **fora** do `AppModule` |
| Credencial por ambiente/stdin | `D-2.3D-10` | `cli.ts` — stdin redirecionado ou `TLF_BOOTSTRAP_ADMIN_SENHA`; **nunca** `argv` |
| Argon2id | `D-2.3D-02` | **Reúso** do `CredencialService` da F1. A política não é redeclarada em lugar algum desta fatia |
| Auditoria da atribuição | `D-2.3D-10`; `docs/09` §12 | `usuario.papeis.alterados`, `SUCESSO`, `alvo_tipo = usuario`, `contexto` vazio, na MESMA transação |

### 6-M.2 Arquivos criados e alterados

| Arquivo | Situação | Motivo |
| --- | --- | --- |
| `apps/api/src/provisionamento/catalogo-rbac.ts` | **NOVO** | `PAPEIS`, `DESCRICAO_PERMISSAO`, `MATRIZ_RBAC`, `ASSOCIACOES_SEED`, `ehCodigoPapel` e a regra de derivação declarada |
| `apps/api/src/provisionamento/seed-rbac.service.ts` | **NOVO** | Seed idempotente e transacional das três tabelas |
| `apps/api/src/provisionamento/bootstrap-administrador.service.ts` | **NOVO** | Bootstrap idempotente, fail-closed e auditado do primeiro Administrador |
| `apps/api/src/provisionamento/provisionamento.module.ts` | **NOVO** | Módulo sem controller, **não** registrado no `AppModule` |
| `apps/api/src/provisionamento/cli.ts` | **NOVO** | Único acionador — processo dedicado, sem servidor HTTP |
| `apps/api/test/catalogo-rbac.spec.ts` | **NOVO** | 26 provas — o catálogo e a matriz **são** `docs/04`, lido do disco |
| `apps/api/test/provisionamento.fronteira.spec.ts` | **NOVO** | 14 provas — bootstrap manual, acoplamento e segredo não versionado |
| `apps/api/test/integration/provisionamento-rbac.integration.spec.ts` | **NOVO** | 34 provas contra PostgreSQL 18 real |
| `apps/api/package.json` | **ALTERADO** — 3 linhas | `provisionar`, `provisionar:seed` e `provisionar:admin`, os comandos deliberados do operador. É a alteração mínima que expõe a operação; nenhuma dependência foi acrescentada |

**Nenhum outro arquivo do repositório foi tocado.** `app.module.ts`, `main.ts`, `auth/**`, `authz/**`, `audit/**`, `database/**`, `packages/database/**`, `scripts/**` e `docs/12` têm diff vazio contra a baseline.

### 6-M.3 Onde o seed vive — e por quê

O seed vive em **`apps/api`**, não em `packages/database`. A escolha foi feita depois de inspecionar o grafo real, e as duas alternativas foram descartadas por razões objetivas:

- **duplicar o catálogo em `packages/database`** criaria as duas fontes divergentes que `D-2.3D-09` existe para impedir — exatamente o defeito que a fatia deve provar ausente;
- **inverter a dependência** (`packages/database` → `apps/api`) contraria a arquitetura vigente: o pacote de persistência é consumido pela aplicação, nunca o contrário.

Em `apps/api` estão, simultaneamente, o catálogo tipado das 29 permissões (F4), a política Argon2id (F1), o `AuditWriter` (2.3B) e a fronteira transacional única (`DatabaseService`). Nenhum deles é replicado.

### 6-M.4 A matriz materializada — regra de derivação declarada

`D-2.3D-09` manda o seed refletir **exatamente** a matriz de `docs/04`. A matriz de §4, porém, é uma tabela de SÍMBOLOS por operação, e §5 é um catálogo de PERMISSÕES: a tradução exigia uma regra. Ela foi declarada, aplicada sem exceção e é executada pelo próprio teste, que lê a tabela do documento:

| Símbolo da célula | Decisão | Fundamento |
| --- | --- | --- |
| `✓` | **CONCEDE** | permitido por padrão para o papel (legenda de §4) |
| `C`, `C relacionado`, `C próprio`, `C próprio/relacionado` | **CONCEDE** | a legenda distingue `C` de `P`: `C` é "condicionado a escopo, relação com recurso ou configuração operacional", e **não** "exige permissão específica adicional". O papel possui a permissão; o estreitamento é enforcement e pertence a `P2.2-05` |
| `C mínimo`, `C leitura mínima` | **NEGA** | a célula autoriza um subconjunto REDUZIDO que o identificador de §5 não expressa; conceder o identificador inteiro daria **mais** do que a matriz permite |
| qualquer célula com `P` (`P`, `P excepcional`, `✓/P`, `P/✓ conforme política`, `C próprio se autorizado`) | **NEGA** | `P` é permissão específica ADICIONAL, nunca padrão do papel — **HOM-01**, §2.1, §2.2, §6.2. Célula ambígua resolve-se pelo lado que **não** amplia privilégio |
| `—`, `—*` | **NEGA** | `—*` é a marca expressa de que o Administrador não possui capacidade clínica |

**Combinação de linhas múltiplas: INTERSEÇÃO, nunca união.** Quando mais de uma linha de §4 mapeia para a mesma permissão de §5, o papel só a recebe se **todas** concederem. A união faria a linha mais permissiva apagar a mais restritiva do mesmo documento. Duas consequências medidas, ambas desejadas:

- a Recepcionista **não** recebe `financeiro.relatorio.ler`: "financeiro operacional do paciente" é `C`, mas "Consultar financeiro global" é `—`;
- o Fisioterapeuta **não** recebe `pacientes.administrativo.gerenciar`: "Cadastrar/Editar paciente administrativo" é `C`, mas "Ver observação administrativa" é `C mínimo`. Coerente com §3.3 (o cadastro administrativo é da Recepcionista) e §3.4 (não consta das responsabilidades do Fisioterapeuta).

**Matriz efetivamente semeada — 37 associações:**

```text
ADMINISTRADOR (18)  agenda.bloqueio · agenda.checkin · agenda.falta · agenda.gerenciar ·
                    auditoria.ler · clinica.configurar · financeiro.cobranca.gerenciar ·
                    financeiro.pagamento.registrar · financeiro.relatorio.ler ·
                    indicadores.globais.ler · pacientes.administrativo.gerenciar ·
                    pacientes.localizar · pacotes.gerenciar · permissoes.gerenciar ·
                    profissionais.gerenciar · senha.recuperar_terceiro ·
                    sessoes.revogar_terceiro · usuarios.gerenciar

GESTOR (3)          financeiro.relatorio.ler · indicadores.globais.ler · pacientes.localizar

RECEPCIONISTA (8)   agenda.checkin · agenda.falta · agenda.gerenciar ·
                    financeiro.cobranca.gerenciar · financeiro.pagamento.registrar ·
                    pacientes.administrativo.gerenciar · pacientes.localizar · pacotes.gerenciar

FISIOTERAPEUTA (8)  agenda.bloqueio · agenda.checkin · agenda.falta · agenda.gerenciar ·
                    pacientes.localizar · prontuario.escrever · prontuario.finalizar ·
                    prontuario.ler
```

**Permissões concedidas a NENHUM papel — 8 de 29,** todas por serem `P` na fonte:

```text
prontuario.retificar_proprio · prontuario.retificar_terceiro · prontuario.exportar
pacotes.ajustar_sessao · financeiro.desconto.aplicar · financeiro.cobranca.cancelar
financeiro.pagamento.estornar · indicadores.proprios.ler
```

Propriedades que a matriz satisfaz e que os testes exigem, uma a uma:

- **o Administrador NÃO recebe as 29 permissões** — recebe 18, e a conversão automática que o enunciado da fatia proíbe não ocorreu em nenhum ponto;
- **o Administrador não recebe NENHUMA permissão `prontuario.*`** (PERM-T01). Capacidade clínica continua vindo do papel Fisioterapeuta, e as restrições clínicas de §6.3 seguem prevalecendo;
- **o Gestor recebe SOMENTE leitura** — HOM-01 preservado: nenhuma permissão de mutação, em nenhuma área;
- as quatro operações que `docs/04` §8 marca como exigindo "permissão específica" (desconto, cancelamento de cobrança, estorno, ajuste de sessão) **não pertencem a papel algum**;
- `indicadores.proprios.ler` não é concedida — `docs/04` §3.4 a condiciona expressamente ("apenas se essa permissão for prevista").

### 6-M.5 Lacunas de tradução — declaradas, não preenchidas por invenção

Seis linhas de `docs/04` §4 **não** possuem identificador objetivamente determinável em §5. Nenhuma associação foi inventada para elas; a lacuna e seu impacto ficam registrados:

| Linha de §4 | Por que não é traduzível | Impacto |
| --- | --- | --- |
| "Autenticar/logout próprio"; "Recuperar própria senha via fluxo autorizado" | §5 não cataloga permissão para operação sobre a PRÓPRIA identidade | **Nenhum.** A F4 já registrou que essas rotas não exigem permissão alguma (§6-J.4) |
| "Consultar profissionais" (`✓ ✓ ✓ ✓`) | §5.2 só cataloga `profissionais.gerenciar` (gestão) | Leitura de profissionais ficará sem permissão própria até que exista endpoint e decisão. Conceder gestão a todos contradiria a linha anterior (`✓ — — —`) |
| "Iniciar/Concluir atendimento clínico" | §5 não cataloga permissão de atendimento | O endpoint clínico, quando existir, precisará de identificador decidido |
| "Consultar saldo administrativo de pacote"; "Consultar histórico detalhado de movimentos" | §5.6 só cataloga permissões de mutação | Leitura de pacote sem permissão própria |
| "Emitir recibo simples" | §5.7 não cataloga permissão de recibo | Idem |
| "Consultar indicadores operacionais" | a linha significa coisas diferentes por coluna: `indicadores.proprios.ler` para o Fisioterapeuta (e ali a célula é `C próprio SE AUTORIZADO`), `indicadores.globais.ler` para Administrador/Gestor, e um `C` reduzido para a Recepcionista | `indicadores.proprios.ler` fica sem papel — coerente com §3.4 |

> **[RETIFICAÇÃO — `F5-R-05`, 29/08/2026]** A redação anterior deste parágrafo afirmava que os **três** agrupamentos eram "**sem efeito** sobre o conjunto concedido (as linhas agrupadas têm a mesma coluna de símbolos)". **A afirmação era FALSA para um dos três**, e a revisão técnica independente a mediu: "Ver observação administrativa" é `✓ — ✓ C mínimo`, enquanto "Cadastrar/Editar paciente administrativo" é `✓ — ✓ C` — as colunas **diferem** na do Fisioterapeuta. A afirmação também **contradizia o próprio §6-M.4**, que declara a consequência. O texto correto é o abaixo.

Três agrupamentos de linhas em um mesmo identificador foram feitos **com base em fonte**. **Dois** deles não têm efeito sobre o conjunto concedido, porque as linhas agrupadas têm de fato a mesma coluna de símbolos: serviços/formas de pagamento/motivos de cancelamento → `clinica.configurar` (`✓ — — —` nas quatro linhas; TLF-BASE-V1 §5.2 os lista como configuração da clínica) e "Anexar documento clínico" → `prontuario.escrever` (`—* — — C relacionado`, idêntica a "Criar evolução").

**O terceiro TEM efeito material e é decisão interpretativa, não agrupamento neutro:** "Ver observação administrativa" → `pacientes.administrativo.gerenciar`. Como essa linha é `C mínimo` na coluna do Fisioterapeuta e a regra de interseção nega `C mínimo`, o agrupamento **retira** `pacientes.administrativo.gerenciar` do Fisioterapeuta. Medição, reproduzida de forma independente pela revisão:

```text
com o agrupamento (adotado) ....... 37 associações · Fisioterapeuta 8
tratando a linha como lacuna ...... 38 associações · Fisioterapeuta 9
```

A escolha é defensável — `docs/04` §3.3 atribui o cadastro administrativo à Recepcionista e §3.4 não o lista entre as responsabilidades do Fisioterapeuta —, mas é **decisão local com efeito medido** (`L-F5-09`, §6-N.7), e não um detalhe inócuo.

### 6-M.6 Desenho do seed

- **Determinístico e repetível.** A ordem é a da fonte (papéis de §3; permissões de §5). A saída não depende da ordem devolvida pelo banco.
- **Idempotente por leitura-e-completação**, não por `upsert`: o serviço lê o estado vigente das três tabelas e escreve somente o que falta. A segunda execução emite **zero** `INSERT` e **zero** `UPDATE`, devolve todas as contagens em zero e `jaConforme: true` — a idempotência é medida, não afirmada. `upsert` com `update: {}` escreveria a cada execução ou dependeria de comportamento não contratado do driver.
- **Convergência de `nome`, e só dela:** `papel`/`permissao` preexistente com o mesmo `codigo` e `nome` divergente da fonte tem o `nome` atualizado — apenas quando de fato difere.
- **ADITIVO, nunca destrutivo.** O seed garante que a matriz homologada esteja presente; ele **não** garante que nada mais exista. A razão é normativa: `docs/04` §4 marca como `P` operações cuja concessão é ato posterior de um Administrador, e um seed destrutivo as revogaria em silêncio a cada execução. **Propriedade declarada e medida em teste** — e o limite correspondente está em §6-M.13.
- **Transacional**, na fronteira única (`DatabaseService.transacao`), pelo mesmo padrão de `ProfissionalService`/`CobrancaService`. Nenhuma abstração nova.
- **Sem auditoria**, e por fronteira: o seed não altera papéis de usuário algum. `usuario.papeis.alterados` tem o usuário por alvo, e aqui não há usuário. Emitir evento para a criação do catálogo exigiria ação nova — vedado por `D-AUD-04`/`D-AUD-05` sem decisão própria.

### 6-M.7 Desenho do bootstrap

**Manual — e a propriedade é estrutural, não uma promessa de comentário:**

```text
ProvisionamentoModule NÃO pertence ao AppModule
  -> node dist/main.js NÃO resolve SeedRbacService
  -> node dist/main.js NÃO resolve BootstrapAdministradorService
  -> único acionador: node dist/provisionamento/cli.js <comando>
     (createApplicationContext — sem servidor HTTP, sem porta, sem rota)
```

Diferença deliberada em relação ao precedente da F4: `AuthzModule` **é** registrado no `AppModule` porque suas guards precisam existir no processo que atende requisições; o provisionamento precisa exatamente do contrário.

**Entrada da credencial**, na ordem de precedência: **stdin redirecionado** (recomendada) e, na ausência dele, **`TLF_BOOTSTRAP_ADMIN_SENHA`** — as duas formas que `D-2.3D-10` admite. `argv` é usado **apenas** para o nome do comando, e isso é provado mecanicamente (`process.argv[2]` é a única ocorrência de `argv` no CLI). Não existe senha padrão, senha embutida, credencial versionada nem senha em log, erro ou auditoria.

**Argon2id reutilizado, não reimplementado:** o digest vem do `CredencialService` da F1, com a `POLITICA_ARGON2` de `D-2.3D-02`. Nenhum parâmetro é redeclarado nesta fatia.

**Desfechos e recusas:**

| Situação | Desfecho | Escritas |
| --- | --- | --- |
| Banco semeado, sem Administrador, identidade inexistente | `USUARIO_CRIADO` | usuário + vínculo + 1 evento |
| Identidade já é o Administrador | `JA_CONFORME` | **nenhuma** — e nenhum evento |
| Identidade existe, ativa, sem o papel, sem outro Administrador | `PAPEL_ATRIBUIDO` | vínculo + 1 evento. Senha, nome e situação preexistentes **não** são tocados |
| Existe OUTRO Administrador | recusa `ADMINISTRADOR_JA_EXISTE` | nenhuma |
| Identidade existe e está INATIVA | recusa `USUARIO_ALVO_INATIVO` | nenhuma |
| Papel Administrador inexistente (seed não rodou) | recusa `PAPEL_ADMINISTRADOR_AUSENTE` | nenhuma |
| E-mail/nome/senha ausentes ou vazios | recusa `EMAIL_INVALIDO`/`NOME_INVALIDO`/`SENHA_AUSENTE` | nenhuma — validação **antes** de Argon2 e de banco |

O identificador é normalizado por `D-2.3D-03` (`trim` + `lowercase`) antes de qualquer consulta — sem isso o bootstrap poderia criar uma identidade inalcançável pelo login.

**O que o bootstrap NÃO faz:** não cria sessão, não emite cookie, token ou segredo de recuperação, não ativa nem inativa usuário, não altera identidade preexistente, não concede permissão avulsa e não amplia a matriz.

### 6-M.8 Atomicidade

Leitura de estado, criação/obtenção do usuário, criação do vínculo `usuario_papel` e evento de auditoria ocorrem em **UMA** transação da fronteira única. Nenhum estado parcial sobrevive, e isso é medido contra PostgreSQL real: com a auditoria falhando **depois** de usuário e vínculo já escritos, o banco volta a zero em `usuario`, `usuario_papel` e `evento_auditoria` — com controle positivo imediato, na mesma prova, de que sem a falha tudo persiste.

Registra-se uma propriedade arquitetural observada durante os mutation challenges: **"remover a transação" não é expressável** nesta arquitetura sem alterar `DatabaseService`, porque o cliente de persistência é privado e o único caminho ao banco é `transacao()`. A defesa em profundidade do `AuditWriter` (recusa de cliente **não** transacional) também foi reexercida nesta fatia.

### 6-M.9 Auditoria — e a autoria do primeiro bootstrap

Campos do evento, medidos no banco:

```text
acao            = usuario.papeis.alterados     (D-AUD-01 — ação já homologada)
resultado       = SUCESSO                      (D-AUD-02)
alvo_tipo       = "usuario"                    (D-AUD-03 — nome físico da tabela)
alvo_id         = usuario.id                   (o alvo é quem teve papéis alterados)
justificativa   = NULL                         (nenhuma fonte a exige)
contexto        = {} — coluna NULL             (whitelist VAZIA, D-AUD-07)
ator_usuario_id = NULL                         (ação de sistema — ver abaixo)
correlacao_id   = uma por operação
```

**Nenhuma ação nova foi criada** (`usuario.criado` continua inexistente e `P-2.3D-05` continua ABERTA); **`ACOES_AUDITORIA` não foi ampliada**; **`WHITELIST_CONTEXTO` não foi ampliada**; `papeis_anteriores`/`papeis_novos` **não** aparecem — continuam não homologadas (`docs/09` §12.6). `contexto` é **omitido** em vez de enviado como `{}`: o validator trata ausente e vazio identicamente e a coluna fica `NULL` — precedente já vigente em `usuario.autenticacao` (que `D-2.3D-12` também descreve como "contexto = {}"), no logout e em `profissional.situacao.alterada`.

**A autoria — o ponto que a fatia foi mandada verificar com rigor.** O bootstrap cria o primeiro Administrador; por construção, não existe Administrador autenticado no instante em que o evento é emitido. As fontes **resolvem** o caso, e por isso ele **não** foi tratado como lacuna de decisão:

- `docs/07` §22.3 define a coluna literalmente como **"`NULL` só em ação de sistema; RN-061"**, e o `schema.prisma` reproduz a mesma anotação em `evento_auditoria.ator_usuario_id`;
- `AuditWriter` já tipa `atorUsuarioId: string | null` com o mesmo comentário normativo;
- existe **precedente homologado idêntico**: `usuario.autenticacao`/`FALHA` grava `ator_usuario_id = NULL` justamente porque "não há ator autenticado" (`D-2.3D-12`; §6-F.6).

O bootstrap é uma operação administrativa executada fora de qualquer sessão — é exatamente a "ação de sistema" que a coluna prevê. As alternativas foram examinadas e descartadas por falta de fundamento, não por conveniência:

| Alternativa | Avaliação |
| --- | --- |
| **(a) `ator_usuario_id = NULL`** — adotada | Único valor com base normativa direta. Rastreabilidade preservada: `alvo_id`, `correlacao_id`, `ocorrido_em` e `acao` identificam integralmente o que aconteceu, e a operação é manual, deliberada e local ao operador com credenciais de banco |
| (b) o usuário recém-criado como ator da própria elevação | Afirmaria uma decisão administrativa que ninguém tomou. Nenhuma fonte a autoriza, e ela degrada a trilha: um leitor futuro concluiria que houve ato de um administrador autenticado |
| (c) ator sintético dedicado | Criaria identidade sem fonte — e uma linha em `usuario` que nada mais usa. Invenção pura |
| (d) recusar o bootstrap por ausência de ator | Tornaria `D-2.3D-10` inimplementável |

**Nenhuma decisão normativa foi tomada aqui:** (a) é a aplicação do que `docs/07` §22.3 já determina. Destaca-se o ponto para a revisão independente por ser o item mais sensível da fatia.

### 6-M.10 Decisões locais — reversíveis, **não** são norma

| ID | Problema | Alternativas | Escolha | Por que não é decisão normativa |
| --- | --- | --- | --- | --- |
| `L-F5-01` | `papel.codigo` não é catalogado por fonte alguma — `docs/09` §12.1 (item 2) registra expressamente essa ausência | (a) nome em CAIXA ALTA sem acentos; (b) minúsculas pontilhadas, como as permissões; (c) UUID opaco | **(a)** `ADMINISTRADOR`/`GESTOR`/`RECEPCIONISTA`/`FISIOTERAPEUTA` — segue o precedente de forma já vigente no schema homologado para todo identificador técnico enumerado (`ATIVA`, `EXPIRADA`, `EM_ELABORACAO`, ...) | É forma de identificador técnico, não semântica de papel. Os quatro papéis e seus nomes vêm de `docs/04` §3, byte a byte. Renomear o código é migração de dados trivial, sem tocar decisão homologada |
| `L-F5-02` | `permissao.nome` é NOT NULL e §5 não oferece "nome curto" | (a) descrição de §5 verbatim; (b) rótulo curto autoral; (c) repetir o `codigo` | **(a)** — a única alternativa que não INVENTA texto. Provada contra o documento, parágrafo a parágrafo | (b) seria autoria nova em registro governado pela matriz homologada; (c) tornaria a coluna redundante. Reversível |
| `L-F5-03` | Conflito: já existe OUTRO Administrador. Nenhuma fonte homologada fixa o comportamento | (a) recusar (fail-closed); (b) criar assim mesmo; (c) transferir o papel | **(a) recusar** — a alternativa conservadora sob lacuna declarada. Nunca se cria um segundo "primeiro Administrador" em silêncio | Lacuna real de fonte, resolvida pelo lado que **não** amplia privilégio. **Destacada para a revisão independente.** (b) e (c) alteram privilégio e exigiriam decisão expressa |
| `L-F5-04` | Identidade preexistente ATIVA, sem o papel, sem outro Administrador | (a) convergir atribuindo o papel, sem tocar a identidade; (b) recusar; (c) sobrescrever senha/nome com os valores informados | **(a)** — é o caso de estado PARCIAL que a idempotência precisa cobrir. **(c) foi recusada**: sobrescrever a senha de uma conta preexistente é tomada de credencial | Comportamento de convergência sob lacuna; a alternativa adotada é a que menos altera estado alheio. Reversível |
| `L-F5-05` | Identidade preexistente INATIVA | (a) recusar; (b) ativar e atribuir | **(a) recusar** — elevar conta inativa contraria AUT-001/AUT-005 e RN-001, e **não existe** fluxo de ativação de usuário (AUT-005 NÃO MATERIALIZADA) | Fail-closed sob lacuna. (b) materializaria parte de AUT-005 sem fatia atribuída |
| `L-F5-06` | O CLI precisa de `CredencialService`; `AuthModule` o exporta | (a) importar `AuthModule`; (b) prover a MESMA classe em `ProvisionamentoModule` | **(b)** — (a) arrastaria para um processo de linha de comando o `AuthController`, o `APP_FILTER` de erros HTTP, o `LimitadorLogin` e a fábrica `POLITICA_COOKIE_SESSAO`, que faz fail-fast exigindo `TLF_AMBIENTE` (`R-2.3D-04`). O provisionamento não emite cookie | **Não há duplicação de política:** é a mesma classe e a mesma constante `POLITICA_ARGON2` de `D-2.3D-02`. É fronteira de módulo, reversível |
| `L-F5-07` | O seed removeria associações fora da matriz? | (a) aditivo; (b) destrutivo/convergente total | **(a) aditivo** — (b) revogaria em silêncio, a cada execução, as concessões `P` que `docs/04` §4 prevê como ato posterior do Administrador | Consequência direta da fonte, mas a escolha é de implementação e está declarada com seu limite (§6-M.13) |

### 6-M.11 Provas medidas

**Unitárias — 40 provas novas** (`test:api` passou de 19 suites · 479 para **21 suites · 519**):

| Suíte | Provas | O que mede |
| --- | ---: | --- |
| `catalogo-rbac.spec.ts` | 26 | Os quatro papéis **são** os títulos de `docs/04` §3; `permissao.nome` **é** a descrição de §5, byte a byte; e — a prova central — a matriz do código **é** a expectativa DERIVADA da tabela de §4, lida do disco e classificada pela regra declarada, com controle de exaustividade (toda linha mapeada, todo mapeamento existente na tabela), controle de não vacuidade e controle contra tautologia |
| `provisionamento.fronteira.spec.ts` | 14 | O `AppModule` **não** resolve os serviços da fatia (com controle positivo de que o grafo montado é o real); `ProvisionamentoModule` importa exatamente dois módulos e não publica controller; nenhum arquivo de `src/` fora da fatia a importa; o CLI não é importado por ninguém; `argv` só carrega o nome do comando; nenhum arquivo da fatia contém senha embutida ou default; nenhum escreve em `console`; os serviços não escrevem em stdout/stderr |

**Integração com PostgreSQL 18 real — 34 provas novas** (`verify:api-integration` passou de 7 suites · 239 para **8 suites · 273**), em `provisionamento-rbac.integration.spec.ts`. Caminho provado inteiro, sem mock no meio: serviço do container Nest real → `DatabaseService` → cliente real → `tlf_app` → PostgreSQL 18 → `papel`/`permissao`/`papel_permissao`/`usuario`/`usuario_papel` → `AuditContextValidator` → `evento_auditoria`.

| Grupo | O que foi medido |
| --- | --- |
| Seed sobre banco vazio | 4 papéis, 29 permissões, 37 associações; papéis persistidos **iguais** a §3; permissões persistidas **iguais** ao catálogo, com as descrições da fonte; matriz persistida **igual** à homologada, papel a papel |
| Restrições da matriz | Administrador com **zero** `prontuario.*`; Gestor com exatamente as três leituras (HOM-01); as 8 permissões `P` sem vínculo algum — com controle positivo de que elas **existem** na tabela |
| Idempotência | 2ª execução: contagens todas zero, `jaConforme`, banco byte a byte igual; 3ª execução estável; banco **parcialmente** semeado converge (+3 papéis, +26 permissões, +36 associações) sem duplicar; `nome` divergente converge e a execução seguinte volta a ser no-op |
| Seed aditivo | Concessão `P` acrescentada por fora **não** é revogada pela execução seguinte |
| **Cadeia inteira** | Um usuário com papel Administrador resolve, pelo `PermissoesService` **da F4**, exatamente as 18 permissões semeadas; cada um dos quatro papéis resolve exatamente sua linha; igualdade de **conjunto** nos dois sentidos entre o catálogo persistido e o catálogo tipado — não `29 == 29` |
| Bootstrap — caminho feliz | `USUARIO_CRIADO`; usuário ativo; vínculo **é** `ADMINISTRADOR`; **zero** sessão criada |
| Bootstrap — segredo | `senha_hash` é PHC `$argon2id$` com `m=19456`, `t=2`, `p=1`; `precisaRehash` falso; a senha correta verifica e a incorreta não; a senha em claro **não** aparece em coluna alguma nem no evento serializado |
| Bootstrap — auditoria | Exatamente 1 evento, com todos os campos de §6-M.9; nenhuma chave proibida no serializado (e-mail, senha, digest, `papeis_anteriores`, `papeis_novos`) |
| Bootstrap — idempotência | 2ª execução `JA_CONFORME` com **zero** escrita e **zero** evento novo; 3ª estável; e-mail com maiúsculas e espaços reconhece a MESMA identidade (`D-2.3D-03`); estado parcial converge para `PAPEL_ATRIBUIDO` sem tocar senha/nome preexistentes |
| Bootstrap — falha segura | Outro Administrador → recusa, banco **inalterado**, e o único administrador continua sendo o primeiro; papel ausente → recusa sem criar usuário; alvo inativo → recusa sem vínculo; entradas malformadas → recusa antes de qualquer escrita; **nenhuma mensagem de erro carrega e-mail, nome ou senha** |
| Bootstrap — atomicidade | Falha da auditoria → **rollback integral** de usuário e vínculo, com controle positivo; violação do vínculo → zero usuário e zero evento; `AuditWriter` recusa cliente não transacional |
| Fronteira | Zero sessão, zero segredo de recuperação, zero usuário inativado; a **única** ação de auditoria da fatia é `usuario.papeis.alterados`; o seed **não** emite evento algum |

**Prova do PROCESSO REAL — o CLI compilado, contra PostgreSQL 18, em banco descartável:**

```text
1ª execução (senha por stdin)
  seed: papeis +4 ~0 · permissoes +29 ~0 · associacoes +37
  bootstrap-admin: USUARIO_CRIADO · usuario=01a04b2b-… · correlacao=44f746e4-…

2ª execução (senha por stdin)
  seed: … +0 ~0 · JA_CONFORME (nenhuma escrita)
  bootstrap-admin: JA_CONFORME · usuario=01a04b2b-…      (mesmo id)

3ª execução (TLF_BOOTSTRAP_ADMIN_SENHA; e-mail "  ADMIN.BOOTSTRAP@CLINICA.LOCAL  ")
  bootstrap-admin: JA_CONFORME · usuario=01a04b2b-…      (D-2.3D-03 confirmada)

outra identidade, com Administrador já existente
  provisionamento: Bootstrap do primeiro Administrador recusado: ADMINISTRADOR_JA_EXISTE.

sem stdin e sem variável de ambiente
  provisionamento: Senha do Administrador não fornecida: redirecione-a pelo stdin
                   ou defina TLF_BOOTSTRAP_ADMIN_SENHA. Senha por argumento de
                   linha de comando não é aceita.
```

Estado lido do banco após as três execuções:

```text
papel 4 · permissao 29 · papel_permissao 37 · usuario 1 · usuario_papel 1
evento_auditoria 1 · sessao_autenticacao 0
usuario ....... email "admin.bootstrap@clinica.local" (normalizado), ativo=true
senha_hash .... $argon2id$v=19$m=19456,p=1,t=2$…  (97 bytes)
evento ........ usuario.papeis.alterados · SUCESSO · alvo_tipo=usuario
                alvo_id = o usuário criado · ator_usuario_id NULL
                justificativa NULL · contexto NULL
senha em claro no banco ........ 0 ocorrências
senha em claro na auditoria .... 0 ocorrências
```

**Prova de que o start normal NÃO faz bootstrap** — processo real `node apps/api/dist/main.js`, banco recém-migrado e vazio, com **todas** as variáveis `TLF_BOOTSTRAP_ADMIN_*` definidas no ambiente:

```text
GET /health -> {"status":"ok"}
após o start e o encerramento por SIGTERM:
  papel 0 · permissao 0 · papel_permissao 0 · usuario 0 · usuario_papel 0 · evento 0
```

### 6-M.12 Mutation challenges — 13 aplicados, 13 detectados, 13 revertidos

Cada mutação foi aplicada ao código-fonte, medida pela suíte detectora, revertida e teve a reversão **provada por SHA-256** idêntico ao valor anterior à aplicação. Nenhuma sobreviveu; `git status` sem resíduo ao final.

| # | Mutação | Detectada por | Resultado observado |
| --- | --- | --- | --- |
| `C-F5-01` | Uma permissão é removida do seed (Administrador perde `auditoria.ler`) | unitária | 4 provas falharam |
| `C-F5-02` | Permissão de mutação indevida ao Gestor (`agenda.gerenciar`) — viola HOM-01 | unitária | 3 falharam |
| `C-F5-03` | Permissão clínica indevida ao Administrador (`prontuario.escrever`) | unitária | 4 falharam |
| `C-F5-04` | Papel auxiliar inventado (`SUPERADMIN`) | unitária | detectado em **compilação** — a suíte não roda (`satisfies` do catálogo) |
| `C-F5-05` | `permissao.nome` divergente de `docs/04` §5 | unitária | 1 falhou |
| `C-F5-06` | Idempotência do seed removida (associações recriadas sempre) | integração | 5 falharam |
| `C-F5-07` | Auditoria obrigatória do bootstrap removida | integração | 6 falharam |
| `C-F5-08` | Falha de auditoria engolida por `try/catch` — estado parcial | integração | 1 falhou |
| `C-F5-09` | Bootstrap aceita conflito (segundo Administrador criado em silêncio) | integração | 2 falharam |
| `C-F5-10` | Senha persistida **em claro** (`senhaHash = comando.senha`) | integração | 1 falhou |
| `C-F5-11` | CLI passa a admitir senha padrão (`?? "senha-padrao-admin"`) | unitária | 1 falhou |
| `C-F5-12` | `ProvisionamentoModule` registrado no `AppModule` — bootstrap automático | unitária | 4 falharam |
| `C-F5-13` | `contexto` não vazio no evento (`papeis_novos`) | integração | 13 falharam |

Verificação final da reversão sobre os arquivos tocados (`catalogo-rbac.ts`, `seed-rbac.service.ts`, `bootstrap-administrador.service.ts`, `cli.ts`, `app.module.ts`): **todos os SHA-256 idênticos aos medidos antes do primeiro challenge**, e `git status` mostrando apenas os arquivos legítimos da fatia.

### 6-M.13 Bateria integral — e a limitação de AMBIENTE medida nesta execução

**Uma condição do ambiente local, PREEXISTENTE e alheia à F5, impede parte da bateria de rodar no host Windows:** uma política de **Application Control** da máquina passou a bloquear o carregamento do addon nativo não assinado do Argon2 (`node_modules/argon2/prebuilds/win32-x64/argon2.glibc.node`, `ERR_DLOPEN_FAILED`). O efeito é **independente da F5** e foi verificado como tal: suítes intocadas por esta fatia (`credencial.service.spec.ts`, `auth.module.integration.spec.ts`, `audit.module.integration.spec.ts`, `openapi.spec.ts`) falham **ao carregar** pelo mesmo motivo, e as mesmas verificações estavam verdes nesta máquina em 28/08/2026 (§6-L.8). O arquivo tem data de 27/08/2026 e não foi tocado. **Nenhuma configuração de segurança da máquina foi alterada para contornar o bloqueio.**

Para medir e não presumir, tudo que depende de Argon2 foi executado em um **contêiner Linux** (`node:24`), com instalação limpa (`npm ci`) e PostgreSQL 18 real — a mesma matriz que a CI usa. A árvore do host **não** foi modificada por essa execução.

| Comando | Onde | Exit | Resultado |
| --- | --- | ---: | --- |
| `npm run typecheck` | host **e** contêiner | 0 | — |
| `npm run build` | host **e** contêiner | 0 | `dist/provisionamento/` emitido (5 arquivos) |
| `npm run test:api` | contêiner | 0 | **21 suites · 519 passed** (era 19 · 479) |
| `npm run test:integration -w @techlab-fisio/api` | contêiner | 0 | **8 suites · 273 passed** (era 7 · 239) |
| `npm run verify:argon2-runtime` | contêiner | 0 | 15/15 · `node v24.20.0 · linux/x64 · argon2 0.45.1` |
| `npm run verify:openapi-runtime` | contêiner | 0 | 17/17 — contrato REST **inalterado**; nenhuma rota de F5 vazou |
| `npm run test:integration` (persistência) | host | 0 | **10 suites · 87 passed** |
| `npm run verify:from-scratch` | host | 0 | 10 suites · 87 passed; Guarda 2 verde |
| `npm run lint:migrations` (Guarda 1) | host | 0 | 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` (Guarda 3) | host | 0 | golden byte a byte **60 169 bytes**; `prisma migrate diff --exit-code` **0** |
| `git diff --check` | host | 0 | — |
| `npm run test:api` | host | **1** | **BLOQUEADO PELO AMBIENTE** — 5 de 21 suites não carregam (4 delas intocadas pela F5) |
| `npm run verify:api-integration` | host | **1** | **BLOQUEADO PELO AMBIENTE** — as 8 suites não carregam |
| `npm run verify:argon2-runtime` | host | **1** | **BLOQUEADO PELO AMBIENTE** |
| `npm run verify:openapi-runtime` | host | **1** | **BLOQUEADO PELO AMBIENTE** |
| `npm run smoke:api` | host | **1** | **BLOQUEADO PELO AMBIENTE** — `ERR_DLOPEN_FAILED` no processo real |

> **[ESTADO SUPERADO — §6-N.11]** O bloqueio descrito nesta seção **deixou de ocorrer em 29/08/2026** e o `smoke:api` passou a ser executado no host, com saída 0. O parágrafo abaixo é preservado como **registro histórico do período bloqueado** e não foi reescrito.

**Limite declarado, e não mascarado:** o `smoke:api` versionado — que orquestra sua própria instância descartável a partir do host — **não** foi executado com sucesso nesta execução. A propriedade que ele mede no que interessa à F5 (o processo real sobe, serve `/health`, encerra por sinal, e **não** semeia nada) foi medida diretamente no contêiner, com o artefato compilado e banco real (§6-M.11). As demais verificações do smoke (CSRF, `/openapi.json`, fail-fast de `TLF_AMBIENTE`) permanecem cobertas por `verify:openapi-runtime` (17/17, verde) e pela suíte de integração (verde). **A execução do `smoke:api` no host permanece pendente de destravar o Argon2 na máquina** — ação de ambiente do titular, não da fatia.

### 6-M.14 Zero drift de persistência

```text
git diff main -- packages/ ........... 0 linhas

schema.prisma .......... 7bee911e75e4742f = 7bee911e75e4742f   IDÊNTICO
schema.golden.sql ...... c2ad5dc539098f51 = c2ad5dc539098f51   IDÊNTICO
protected-objects.json . 9b4033a3c2cf3a79 = 9b4033a3c2cf3a79   IDÊNTICO
migrations ............. 10 -> 10   (nenhuma nova)
golden ................. 60 169 bytes, byte a byte
```

`prisma format`, `prisma migrate dev`, `prisma db push` e `prisma db pull` **NÃO** foram executados em momento algum desta fatia. **Nenhuma dependência nova foi instalada**: `package.json` e `package-lock.json` da raiz com diff **vazio**; o único diff em `apps/api/package.json` são as **três linhas** de `scripts` do comando de provisionamento. **Nenhuma rota nova foi publicada** — `verify:openapi-runtime` (17/17) e `openapi.spec.ts` continuam exigindo exatamente `/auth/login`, `/auth/logout` e `/health`.

Registro de higiene desta execução: durante a preparação dos mutation challenges detectou-se que `seed-rbac.service.ts` fora gravado com **dois bytes NUL** no separador da chave de deduplicação (`\`${papelId}\0${permissaoId}\``). O comportamento era idêntico — NUL e espaço são igualmente válidos como separador, e UUID não contém nenhum dos dois —, mas o byte era **não intencional** e tornava o arquivo binário para as ferramentas de texto. Corrigido para espaço, e a bateria integral foi **reexecutada** depois da correção; todos os números registrados acima são posteriores a ela.

### 6-M.15 Fronteira — o que a F5 deliberadamente NÃO fez

- **AUT-005 NÃO MATERIALIZADA**: nenhum endpoint ou serviço de ativação/inativação de usuário, nenhuma alteração de `usuario.ativo`, nenhuma revogação de sessão por inativação, nenhuma alteração de `SessaoService.validar`, nenhuma emissão de `usuario.situacao.alterada`. **Nenhuma fatia foi atribuída a AUT-005 por esta execução.** A recusa `USUARIO_ALVO_INATIVO` do bootstrap **lê** `usuario.ativo`; ela não o altera e não materializa nada.
- **F6 NÃO INICIADA**: nenhuma recuperação de senha, nenhum segredo, nenhum endpoint, nenhum rate limiting próprio; `D-2.3D-08` continua sem materialização.
- **Nenhuma reabertura de persistência**: nenhuma migration, coluna, tabela, índice, constraint ou enum; nenhuma edição do golden ou de `protected-objects.json`.
- **Nenhum endpoint novo, nenhum frontend, nenhum JWT, nenhum refresh token, nenhum Redis, nenhum cache, nenhuma multitenancy.**
- **Nenhuma ampliação de catálogo ou whitelist de auditoria; nenhuma `D-2.3D-14`; `docs/12` não foi tocado.** — *verdadeiro em 29/08/2026, quando esta seção foi escrita.* **[SUPERADO — REV. 27, 31/08/2026]** `D-2.3D-14` e `D-2.3D-15` foram homologadas por Bruno e `docs/12` (REV. 6) passou a integrar o conjunto de alterações da F5; ver §6-N e §6-O. Catálogo e whitelist de auditoria continuam **não ampliados**, e nenhuma decisão anterior foi alterada ou reaberta.
- **Autorização clínica contextual (`P2.2-05`) NÃO INICIADA**: conceder `prontuario.ler`/`escrever`/`finalizar` ao papel Fisioterapeuta **não** antecipa nem dispensa a avaliação de escopo/relação, que continua fora desta etapa.

### 6-M.16 Riscos, limites e pendências desta fatia

| Item | Severidade | Situação |
| --- | --- | --- |
| Conflito de Administrador preexistente (`L-F5-03`) | **DESTACADO PARA REVISÃO** | Nenhuma fonte fixa o comportamento; adotada a alternativa conservadora (recusa). Aceitar o conflito **amplia privilégio** e exigiria decisão expressa |
| Seed aditivo não revoga associação fora da matriz (`L-F5-07`) | **LIMITE DECLARADO** | Consequência de `P` ser concessão posterior legítima. Um "modo estrito" que reporte divergências sem removê-las é melhoria futura, não desta fatia |
| Lacunas de tradução de §4 → §5 (§6-M.5) | **PENDENTE** | Seis linhas sem identificador objetivo. Cada uma exigirá decisão própria quando o endpoint correspondente existir |
| `ator_usuario_id = NULL` no evento do bootstrap (§6-M.9) | **DESTACADO PARA REVISÃO** | Resolvido por fonte (`docs/07` §22.3 + RN-061 + precedente de `D-2.3D-12`), não por decisão local. Registrado para conferência adversarial |
| `smoke:api` não executado no host (§6-M.13) | **BLOQUEIO DE AMBIENTE** | Application Control bloqueia o addon nativo do Argon2. Preexistente à F5 e alheio a ela; equivalente medido em contêiner. Destravar a máquina é ação do titular |
| RBAC aplicado a rota de produção | **OBSERVAÇÃO herdada** | Continua sem rota de domínio; a F5 entrega dados, não endpoints |

Pendências herdadas e **não** alteradas por esta fatia: `AUT-005`/`RN-001`, `P2.2-05`, `R2.2-04`, `P-BACK-01`, `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `L-05`..`L-08`, `R-BL-09`, `V-06.c`, `F-2.3C-REV-02`, `F-2.3C-REV-03`, `F-12`, `F3R-06`, `F3R-07`, RBAC/`profissionais.gerenciar`, higiene de formatação do `schema.prisma`.

### 6-M.17 Estado

```text
F5 IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA
NÃO HOMOLOGADA
NÃO INTEGRADA

commit: NÃO · push: NÃO · PR: NÃO · merge: NÃO · deploy: NÃO · tag/release: NÃO

AUT-005 = NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA
RN-001  = NÃO declarada satisfeita pela F5
P2.2-05 = NÃO INICIADA
R2.2-04 = estado vigente preservado
P-2.3D-03 = estado vigente preservado
F6 = NÃO INICIADA
```

**[SUPERADO — §6-N]** As duas revisões técnicas independentes ocorreram e devolveram **`C — NÃO APTO`**, com um achado ALTO (corrida que produzia dois "primeiros Administradores"). A fatia corretiva está em **§6-N**; as medições desta seção continuam válidas para o estado em que foram tomadas e **não foram reescritas**.

## 6-N. Etapa 2.3D-B / F5 — fatia corretiva pós-revisões independentes

**Estado: CORRIGIDA E REMEDIDA EM BRANCH PRÓPRIA — permanece NÃO HOMOLOGADA / NÃO INTEGRADA.** Executada em 29/08/2026 sobre a MESMA baseline `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337`, na mesma branch `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`, sobre a working tree não commitada que as revisões examinaram. **Publicação não autorizada: sem commit, push, PR, merge, rebase, tag, release ou deploy.**

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta *pela execução de 29/08/2026*.** `D-2.3D-09` e `D-2.3D-10` intactas; `docs/09` §12 não reaberto; **`ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` NÃO foram ampliadas**; Base Imutável intacta. §6-M é preservada como registro histórico da execução inicial, com a afirmação que a revisão provou incorreta marcada como **[RETIFICAÇÃO — `F5-R-05`]** e **nenhuma medição reescrita**.

> **[ATUALIZAÇÃO — REV. 27, 01/09/2026 — estado CORRENTE desta seção.]** As duas lacunas normativas que esta fatia corretiva devolveu a Bruno (§6-N.3 e §6-N.4) foram **homologadas por Bruno Menezes Noronha em 31/08/2026** como **`D-2.3D-14`** e **`D-2.3D-15`** (`docs/12` §5.14 e §5.15, REV. 6). Em consequência, **`docs/12` PASSOU a integrar o conjunto de alterações da F5** — a redação original desta seção, escrita em 29/08/2026, ainda afirmava o contrário e está retificada aqui. O que permanece verdadeiro: **nenhuma decisão anterior foi alterada, renumerada, reduzida ou reaberta** (`D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas, e `D-2.3D-09`/`D-2.3D-10` em particular), `docs/09` §12 não foi reaberto, catálogo e whitelist de auditoria continuam **não ampliados** e a Base Imutável permanece intacta. A **fatia** F5 continua **NÃO HOMOLOGADA e NÃO INTEGRADA**: a homologação de 31/08/2026 alcança as duas decisões normativas, não a fatia.

### 6-N.1 Pareceres recebidos

Duas revisões técnicas independentes e adversariais (Codex e Claude Code) reproduziram, de forma convergente e contra PostgreSQL real, a mesma falha bloqueante. O parecer consolidado devolveu **`C — NÃO APTO`**, com um achado ALTO, quatro MÉDIOS e cinco BAIXOS/INFORMATIVOS.

| ID | Sev. | Situação após esta fatia |
| --- | --- | --- |
| `F5-R-01` | **ALTO** | **CORRIGIDO** (§6-N.2) — serialização por advisory lock; corrida reproduzida agora falha em produzir dois Administradores |
| `F5-R-02` | MÉDIO | **CORRIGIDO** (§6-N.3) — divergências detectadas, relatadas e modo estrito |
| `F5-R-03` | MÉDIO | **TRATADO** (§6-N.4) — autoria nula mantida por decisão executiva + justificativa operacional obrigatória |
| `F5-R-04` | MÉDIO | **DOCUMENTADO** (§6-N.6) — runbook de recuperação manual; comando de reparo exige fatia própria |
| `F5-R-05` | MÉDIO | **RETIFICADO** (§6-M.5, §6-N.7) — a afirmação falsa foi corrigida e o efeito material declarado |
| `F5-R-06` | BAIXO | **CORRIGIDO** (§6-N.5) — fronteira de erros fechada |
| `F5-R-07` | BAIXO | **CORRIGIDO** (§6-N.5) — caractere de controle recusado |
| `F5-R-08` | BAIXO | **REGISTRADO** (§6-N.9) — risco de permissões `C` antes de `P2.2-05` |
| `F5-R-09` | BAIXO | **CORRIGIDO** (§6-N.7) — inventário de decisões locais completado |
| `F5-R-10` | INFORMATIVO | **REGISTRADO** (§6-N.9) |

### 6-N.2 `F5-R-01` — a serialização do bootstrap

**O defeito, medido pelas duas revisões.** A verificação "já existe Administrador?" era um `SELECT` puro seguido de decisão em memória. Sob `READ COMMITTED` — isolamento efetivo medido —, duas transações observam legitimamente o mesmo estado vazio:

```text
Tx A: SELECT ... FROM usuario_papel WHERE papel_id = <admin>   -> vazio
Tx B: SELECT ... FROM usuario_papel WHERE papel_id = <admin>   -> vazio
Tx A: cria usuário A + vínculo + evento                        -> COMMIT
Tx B: cria usuário B + vínculo + evento                        -> COMMIT
```

Resultado medido em **processos CLI reais**: 2 usuários, 2 vínculos `ADMINISTRADOR`, 2 eventos, **ambos com saída 0**.

**Por que `P2002` jamais resolveria.** A PK de `usuario_papel` é `(usuario_id, papel_id)`: identidades **diferentes** não colidem por unicidade — e é exatamente o caso perigoso. A unicidade só protege o caso do mesmo e-mail, que já funcionava.

**A correção: advisory lock transacional.** `bloqueio-provisionamento.ts` adquire `pg_advisory_xact_lock(2337, 5)` como **primeira operação da transação**, antes de qualquer leitura decisória; **todas** as leituras que sustentam a decisão vêm depois dele. As alternativas foram avaliadas e descartadas com razão declarada:

| Alternativa | Por que não |
| --- | --- |
| `SELECT ... FOR UPDATE` na linha do papel | Serve ao bootstrap, mas **não ao seed**: a seção crítica do seed inclui a CRIAÇÃO dessa mesma linha, que no primeiro seed ainda não existe |
| `SERIALIZABLE` + retry | Espalharia laço de retry pela fronteira transacional única (`DatabaseService.transacao`), compartilhada com fluxos alheios à fatia. Ampliação desproporcional de superfície |
| Índice único parcial | Exigiria **MIGRATION** — a F5 não reabre a persistência (`docs/12` §7.4) |

**Ordem de locks — e por que não há deadlock:** existe **um único lock** para todo o domínio de provisionamento. Com um só lock não há ordem a definir e, portanto, não há deadlock possível entre as operações da fatia. `provisionar` executa seed e bootstrap em transações **separadas e sequenciais**, jamais aninhadas — nenhuma transação tenta adquiri-lo duas vezes. O lock é **transacional**: liberado no COMMIT, no ROLLBACK, em queda de conexão e em término abrupto do processo; não existe caminho em que vaze.

**Chave estável e documentada:** o par de `int4` `(2337, 5)` — 2337 identifica a Etapa "2.3D" e 5 a fatia "F5". Advisory locks vivem em espaço de nomes próprio do PostgreSQL, por banco; **nenhum objeto do schema é tocado e nada é persistido**.

**Detalhe de implementação medido:** a aquisição usa `$executeRaw`, não `$queryRaw`, porque o retorno de `pg_advisory_xact_lock` é `void` e o desserializador do Prisma rejeita essa coluna (`Failed to deserialize column of type 'void'`). `$executeRaw` não desserializa colunas.

**O hash Argon2 saiu da transação.** Ele é calculado **antes** do lock. Argon2id sob `D-2.3D-02` custa dezenas de milissegundos; mantê-lo na seção crítica multiplicaria o tempo de retenção do lock e de uma transação aberta. O preço é calcular, em alguns caminhos, um digest que não será usado — **custo aceito e deliberado**. A janela TOCTOU **não** é reaberta: a decisão continua inteiramente depois do lock, e há teste específico com hash artificialmente lento.

**Comportamento antes × depois — medido:**

| Cenário concorrente | Antes | Depois |
| --- | --- | --- |
| N processos, e-mails **diferentes** | **N Administradores**, todos exit 0 | **1** `USUARIO_CRIADO` (exit 0) + N−1 `ADMINISTRADOR_JA_EXISTE` (exit 1) |
| N chamadas, **mesmo** e-mail | 1 sucesso + `P2002` **cru** | 1 `USUARIO_CRIADO` + N−1 `JA_CONFORME`, **zero erro técnico** |
| N variantes de caixa/espaços | não medido | 1 criação; as demais convergem — mesma identidade |
| N execuções de `seed` | 1 sucesso + `P2002` **cru** | **todas** convergem, exit 0, zero duplicata |

### 6-N.3 `F5-R-02` — divergências deixam de ser silenciosas

**O defeito, medido pela revisão.** Em banco contaminado (papel `SUPERADMIN`, permissão `tudo.liberado`, `GESTOR -> pacotes.ajustar_sessao`), o seed devolvia `+0 ~0 +0` e `jaConforme: true` — que um operador lê como "banco conforme" — **inclusive com HOM-01 violado no estado persistido**.

**Decisão normativa homologada.** `D-2.3D-14` (`docs/12` §5.14) fixa que o seed **continua aditivo e não destrutivo**: um seed destrutivo revogaria em silêncio as concessões que `docs/04` §4 marca como `P` e que só um Administrador concede depois. A divergência é **detectada e relatada**:

- papéis fora do catálogo de `docs/04` §3;
- permissões fora do catálogo de §5;
- associações além da matriz homologada.

`jaConforme` passou a significar **"nenhuma escrita E nenhuma divergência"**.

**Modo estrito — convergente e não destrutivo.** `seed --estrito` aplica/completa a matriz canônica, preserva os excedentes e termina com **saída 3** quando divergências persistem, para uso em pipeline. Portanto, não é modo somente leitura. O modo normal executa a mesma convergência, preserva e relata os excedentes e termina com 0.

**Privacidade da saída.** Códigos fora do catálogo são strings escritas por terceiros e podem conter qualquer coisa: eles são **apenas CONTADOS, nunca ecoados**. Somente pares cujos **dois** lados pertencem ao catálogo homologado são nomeados. Provado por teste, inclusive com a asserção de que o código de terceiro não aparece no resultado serializado.

**Pós-condição homologada:** a matriz inicial homologada está PRESENTE **e** as divergências estão RELATADAS; o banco não precisa conter exclusivamente essa matriz. `D-2.3D-14` resolve a literalidade de `D-2.3D-09` sem autorizar remoção silenciosa.

### 6-N.4 `F5-R-03` — autoria e justificativa operacional

**Decisão normativa homologada:** `D-2.3D-15` (`docs/12` §5.15) fixa `ator_usuario_id = NULL`. Não se usa o usuário recém-criado como ator da própria elevação e **não se cria identidade sintética**.

**O que mudou.** A revisão observou, com razão, que um bootstrap **manual** tem autor humano e que TLF-BASE-V1 §4.3 exige atribuibilidade — de modo que classificá-lo como "ação de sistema" é interpretação, não leitura literal. A resposta desta rodada é tornar **obrigatória** a justificativa operacional, via `TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA`:

- validada **antes** de abrir a transação e antes de qualquer trabalho caro;
- não vazia (após `trim`);
- **recusa caractere de controle** (`JUSTIFICATIVA_INVALIDA`);
- persistida em `evento_auditoria.justificativa` — coluna que `docs/07` §22.3 já prevê como livre;
- **nunca** impressa em stdout ou stderr;
- **nunca** colocada em `contexto`;
- **não amplia** a whitelist de auditoria: `D-AUD-07` governa `contexto`, e `contexto` permanece vazio.

Evento resultante, medido no banco:

```text
acao            = usuario.papeis.alterados     (D-AUD-01 — ação já homologada)
resultado       = SUCESSO                      (D-AUD-02)
alvo_tipo       = "usuario"                    (D-AUD-03)
alvo_id         = usuario.id
justificativa   = a justificativa operacional informada     <-- NOVO
contexto        = {} — coluna NULL             (whitelist VAZIA, D-AUD-07)
ator_usuario_id = NULL                         (D-2.3D-15; L-F5-08 é alias histórico)
```

**Lacuna normativa resolvida.** Bruno homologou a combinação de ator nulo com justificativa operacional obrigatória como representação do bootstrap inaugural. `L-F5-08` permanece apenas como alias histórico de `D-2.3D-15`.

### 6-N.5 `F5-R-06` e `F5-R-07` — fronteira de erros e entrada da senha

**Fronteira de erros.** O `catch` global imprimia `Error.message` de qualquer origem, contra o precedente `L-10` (§9), que declara que mensagens do Prisma podem carregar a consulta e seus parâmetros. Agora:

- a saída é **construída** a partir de um `motivo` de conjunto fechado — **nem mesmo a `message` dos erros próprios** é ecoada;
- erro de origem desconhecida vira `FALHA_INESPERADA (incidente <uuid>)`;
- a detecção usa `name` + formato do `motivo`, e **não** `instanceof`, porque o erro do bootstrap vem de módulo carregado dinamicamente;
- códigos de saída previsíveis: `0` ok · `1` falha controlada · `2` uso inválido · `3` divergência em modo estrito · `130` SIGINT · `143` SIGTERM;
- uma falha em `contexto.close()` **não substitui** a falha original — só propaga quando o corpo terminou bem.

Provado por teste contra processo real: com `DATABASE_URL` inválida, o stderr contém `FALHA_INESPERADA` e **não contém** `prisma`, `SELECT`, `INSERT`, `usuario_papel`, `postgresql://`, `ECONNREFUSED` nem o host.

**Entrada da senha.** Precedência **determinística**, refletida no texto de uso:

1. `TLF_BOOTSTRAP_ADMIN_SENHA`, se definida e não vazia — **o stdin não é lido**, e um pipe ocioso não trava o comando;
2. stdin não-TTY: leitura limitada a **4096 bytes** e a **10 s** por EOF (`TLF_BOOTSTRAP_STDIN_TIMEOUT_MS` apenas para teste);
3. caso contrário, erro controlado `SENHA_NAO_FORNECIDA`.

Espaços — inclusive nas bordas — são **preservados**; qualquer **caractere de controle** (NUL, CR, LF) é **recusado** com `SENHA_COM_CARACTERE_DE_CONTROLE`. Isso fecha o defeito medido: um arquivo de senha com linha em branco ao final produzia, antes, uma senha com `\n` embutido que o operador jamais conseguiria digitar. Senha por `argv` continua impossível — qualquer argumento extra é recusado como `OPCAO_DESCONHECIDA` antes de qualquer leitura.

**Encerramento por sinais.** `SIGINT` e `SIGTERM` fecham o contexto de forma **idempotente**, com teto de 5 s e saída forçada em seguida; a transação em curso sofre ROLLBACK ao cair a conexão, e o advisory lock transacional é liberado com ela. Provado por teste: o processo termina com 130/143 e o banco fica **sem** Administrador parcial.

### 6-N.6 `F5-R-04` — recuperação: o que existe, o que não existe e o runbook

**Comportamento mantido, por decisão executiva:** existindo outro Administrador, o bootstrap **recusa** com `ADMINISTRADOR_JA_EXISTE`. **Nenhum comando de transferência, remoção ou reparo de papel administrativo foi implementado nesta rodada.**

**Por que o bootstrap normal não repara esse estado.** Ele é, por desenho, uma operação de **criação do primeiro** Administrador, não de administração de papéis. Reparar significaria remover ou transferir um vínculo `ADMINISTRADOR` — isto é, **reduzir privilégio de uma conta existente** a partir de um comando de linha, sem autenticação, sem autorização por `permissoes.gerenciar` e sem a auditoria de uma operação de gestão. Fazê-lo aqui converteria o bootstrap em ferramenta de escalonamento/desescalonamento arbitrário.

**Risco de bloqueio administrativo — declarado.** Se o primeiro Administrador for criado com uma credencial que o operador não consegue reproduzir (ou se a conta for perdida), então: não há autenticação possível; o bootstrap recusa; **F6 (recuperação de senha) não existe**; **AUT-005 (gestão de usuários) não existe**; não há endpoint administrativo. O sistema fica sem via de recuperação **dentro do produto**. A recusa de controle de caractere (§6-N.5) reduz muito a chance do gatilho mais provável, mas **não elimina o risco**.

**Runbook de recuperação manual — controlado, fora do produto.** Executado por quem detém credencial de banco, com registro operacional próprio:

```text
1. CONGELAR: interromper execuções de provisionamento em curso.
2. EVIDENCIAR: registrar o estado atual, por consulta somente leitura —
     SELECT u.id, u.email, u.ativo
       FROM usuario u
       JOIN usuario_papel up ON up.usuario_id = u.id
       JOIN papel p          ON p.id = up.papel_id
      WHERE p.codigo = 'ADMINISTRADOR';
3. DECIDIR e AUTORIZAR: a escolha de qual vínculo remover é decisão de
   Bruno, não do operador. Registrar a autorização.
4. BACKUP verificável antes de qualquer escrita.
5. REMOVER o vínculo excedente (DELETE em `usuario_papel`) — jamais o
   usuário, jamais o papel, jamais linha de `evento_auditoria`
   (append-only por E-11).
6. REGISTRAR o ato no processo operacional. A trilha de auditoria NÃO
   contém esse DELETE: `usuario_papel` não é auditada e esta fatia não
   cria ação nova para isso.
7. REEXECUTAR `bootstrap-admin` para a identidade correta e conferir
   `count(administradores) = 1`.
```

**Um comando de reparo exige fatia e autorização próprias**, com decisão sobre autorização, auditoria da remoção e eventual ação de catálogo. Não é desta rodada e **não** foi antecipado.

### 6-N.7 Decisões locais — inventário COMPLETO (`F5-R-09`)

A revisão apurou que o inventário de §6-M.10 omitia resoluções interpretativas com efeito material. O inventário completo passa a ser:

| ID | Situação |
| --- | --- |
| `L-F5-01` | Código de papel em CAIXA ALTA — **inalterada** (§6-M.10) |
| `L-F5-02` | `permissao.nome` = descrição de §5 verbatim — **inalterada** |
| `L-F5-03` | Conflito de Administrador preexistente → recusa — **mantida**, agora com runbook (§6-N.6) e **eficaz sob concorrência** (§6-N.2) |
| `L-F5-04` | Identidade preexistente converge sem sobrescrever credencial — **inalterada** |
| `L-F5-05` | Alvo inativo é recusado — **inalterada** |
| `L-F5-06` | `CredencialService` provido no módulo do bootstrap — **reforçada**: agora é `BootstrapModule`, e `SeedModule` **não** o alcança (§6-N.8) |
| ~~`L-F5-07`~~ → `D-2.3D-14` | Seed aditivo com detecção de divergências — **homologada como norma em 31/08/2026**; o identificador local permanece como alias histórico (§6-N.3; `docs/12` §5.14) |
| ~~`L-F5-08`~~ → `D-2.3D-15` | `ator_usuario_id = NULL` com justificativa operacional obrigatória — **homologada como norma em 31/08/2026**; o identificador local permanece como alias histórico (§6-N.4; `docs/12` §5.15) |
| **`L-F5-09`** | **NOVA (explicitada)** — agrupamento de "Ver observação administrativa" em `pacientes.administrativo.gerenciar`. **Efeito material medido: 37 × 38 associações; Fisioterapeuta 8 × 9** (§6-M.5 retificada) |
| **`L-F5-10`** | **NOVA (explicitada)** — regra de **interseção** quando várias linhas de §4 mapeiam para a mesma permissão de §5. Efeitos medidos: Recepcionista sem `financeiro.relatorio.ler`; Fisioterapeuta sem `pacientes.administrativo.gerenciar`. A união produziria 39 associações |
| **`L-F5-11`** | **NOVA (explicitada)** — resolução de `✓/P` e `P/✓ conforme política` como **negação**. Efeitos medidos: `financeiro.desconto.aplicar`, `financeiro.cobranca.cancelar` e `financeiro.pagamento.estornar` sem papel algum; Recepcionista sem `agenda.bloqueio` |
| **`L-F5-12`** | **NOVA** — advisory lock **único** `(2337, 5)` para todo o domínio de provisionamento, em vez de locks por operação. Elimina ordem de aquisição e, com ela, a possibilidade de deadlock (§6-N.2) |

`L-F5-07` e `L-F5-08` deixaram de ser decisões locais e permanecem apenas como aliases históricos de `D-2.3D-14` e `D-2.3D-15`. `L-F5-09`, `L-F5-10` e `L-F5-11` **não são decisões novas de comportamento**: são escolhas que já governavam a matriz desde §6-M e que agora estão declaradas como interpretativas, com efeito quantificado. A matriz **não mudou** nesta fatia — permanece 4/29/37 e 18/3/8/8.

### 6-N.8 Separação dos contextos e independência do Argon2

`ProvisionamentoModule` foi **substituído** por dois módulos de contexto mínimo:

| Módulo | Imports | Providers |
| --- | --- | --- |
| `SeedModule` | `DatabaseModule` | `SeedRbacService` |
| `BootstrapModule` | `DatabaseModule`, `AuditModule` | `CredencialService`, `BootstrapAdministradorService` |

O CLI importa `BootstrapModule` de forma **DINÂMICA** (`await import(...)`), dentro do ramo que precisa dele. Sem isso, um `import` estático carregaria o addon nativo do Argon2 já na inicialização e derrubaria o comando `seed` em máquina onde esse addon não carregue.

**Prova, e não promessa.** Um sabotador determinístico (`test/integration/sabota-argon2.cjs`) intercepta `process.dlopen` apenas para o `argon2` e reproduz `ERR_DLOPEN_FAILED`. Sob ele: `seed` conclui com saída 0 e contagens canônicas; e o **controle positivo** confirma que `bootstrap-admin` de fato usa o Argon2 sabotado e falha. Sem o controle positivo, o primeiro teste passaria mesmo que a sabotagem não funcionasse.

**Confirmação no mundo real.** No host Windows, onde o bloqueio é uma política de Application Control **de verdade**, a suíte do CLI compilado executa: **17 de 28 casos passam**, e os 11 que falham são exatamente os que precisam criar o Administrador. Entre os que passam: todo o comando `seed`, o modo estrito, a corrida multiprocesso de `seed`, a recusa de senha por `argv`, a fronteira de erros e a validação de entrada.

`AppModule` **continua sem importar qualquer módulo de provisionamento** — agora provado também por **fecho transitivo** de imports (não por regex de primeiro nível) e **também sobre o artefato compilado** em `dist/`.

### 6-N.9 Riscos registrados

| Item | Severidade | Registro |
| --- | --- | --- |
| Permissões `C` semeadas antes de `P2.2-05` (`F5-R-08`) | **BAIXO** | O Fisioterapeuta recebe `prontuario.ler/escrever/finalizar` e `agenda.gerenciar/checkin/falta/bloqueio`. `docs/04` §2.5 exige que o backend considere a relação do usuário com o recurso — e **essa camada não existe**. Hoje inócuo: nenhum endpoint de domínio existe e a guard da F4 é opt-in por rota. Torna-se efetivo no instante em que alguém publicar o primeiro endpoint clínico confiando no seed. **Quem publicar esse endpoint deve materializar o escopo, ou exigir permissão adicional, antes de expô-lo** |
| Bootstrap eleva identidade preexistente com papel clínico (`F5-R-10`) | **INFORMATIVO** | Medido: um usuário com `FISIOTERAPEUTA` recebe `ADMINISTRADOR` e fica com ambos. Combinação legítima (`docs/04` §6.1), mas o operador informa apenas um e-mail e pode não perceber que o primeiro Administrador ganhou capacidade clínica |
| Bloqueio administrativo sem via de recuperação (`F5-R-04`) | **MÉDIO — DECLARADO** | §6-N.6, com runbook. Mitigado pela recusa de caractere de controle, não eliminado |
| Literalidade de `D-2.3D-09` × seed aditivo | **RESOLVIDA — `D-2.3D-14`** | §6-N.3 e `docs/12` §5.14 — matriz canônica integralmente presente; excedentes preservados e relatados; estrito convergente com saída 3 |
| Autoria do bootstrap inaugural | **RESOLVIDA — `D-2.3D-15`** | §6-N.4 e `docs/12` §5.15 — ator nulo, sem identidade sintética, com justificativa operacional obrigatória |

### 6-N.10 Provas — o que foi medido, e onde

**Unitárias — `test:api` passou de 21 suites · 519 para 21 suites · 526** (+7 provas em `provisionamento.fronteira.spec.ts`, agora com fecho transitivo, artefato compilado e contratos de conjunto).

**Integração — `test:integration -w api` passou de 8 suites · 273 para 9 suites · 322** (+49 provas; no Windows: 320 aprovadas + 2 sinais POSIX pulados):

| Suíte | Provas | O que acrescentou |
| --- | ---: | --- |
| `provisionamento-rbac.integration.spec.ts` | 54 (era 34) | 7 cenários de bootstrap concorrente (identidades diferentes, mesma identidade, variantes normalizadas, Administrador preexistente, usuário ativo sem papel, usuário inativo, falha de auditoria, hash lento) **repetidos em 4 rodadas com 4 concorrentes**; 5 cenários de seed concorrente; 4 de divergências; 3 de justificativa |
| `provisionamento-cli.integration.spec.ts` | 29 (**nova**) | O CLI **compilado**, em processos reais: comandos e códigos de saída, independência do Argon2 com sabotador e controle positivo, precedência da senha, pipe ocioso, CRLF, duas quebras, controles embutidos, espaços preservados, `argv`, fronteira de erros, modo estrito, estado simultaneamente parcial e divergente, `SIGINT`/`SIGTERM` e **a corrida entre processos** |

Os cenários concorrentes são **repetidos** deliberadamente: um verde único poderia ser sorte de escalonamento.

### 6-N.11 Bateria integral — por ambiente, sem confundir os dois

> **[ATUALIZAÇÃO DE AMBIENTE — 29/08/2026, medida nesta rodada]** O bloqueio de
> Application Control do addon Argon2 **deixou de ocorrer no host Windows**. O
> arquivo continua `NotSigned`, mas o carregamento passou a ser permitido
> (medido 3/3 com `import('argon2')`). **Nenhuma política da máquina foi
> alterada por esta execução** — a mudança é do ambiente, não da fatia. A
> consequência é boa e é registrada como fato: **a bateria integral passou a
> ser executável também no host**, incluindo `smoke:api`, `verify:argon2-runtime`
> e `verify:openapi-runtime`, que as revisões anteriores tiveram de deixar como
> NÃO EXECUTADOS. As medições abaixo são as vigentes; as anteriores permanecem
> em §6-M.13 como registro histórico e **não foram reescritas**.

> **[ATUALIZAÇÃO PÓS-DECISÃO — 01/09/2026]** Depois de `D-2.3D-14`/`D-2.3D-15`, a bateria do host foi reexecutada. A integração passou a **320 aprovados + 2 pulados** pelo acréscimo da regressão de banco parcial e divergente; as demais contagens permaneceram. A medição Linux abaixo é o snapshot verde de 29/08/2026, anterior a essa única prova nova, e não é rebatizada como reexecução.

> **[SNAPSHOT SUPERADO — REV. 28, 01/09/2026]** As tabelas desta subseção são o registro da bateria **daquela** rodada e não são reescritas. A bateria **corrente** está em **§6-O.5**: a integração da API passou a **9 suítes · 327 aprovados · 2 pulados** com as 7 provas do comando composto `provisionar` (`F5H-02`), e `provisionamento-cli` passou de 29 para **36** casos. As demais contagens permaneceram idênticas.

**Host Windows** (`node v24.18.0`, win32-x64) — **integralmente verde**:

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run build` | 0 | — |
| `npm run test:api` | 0 | **21 suites · 526 passed** |
| `npm run verify:api-integration` | 0 | **9 suites · 320 passed · 2 skipped** (ver nota de plataforma) |
| `npm run test:integration` (persistência) | 0 | 10 suites · 87 passed |
| `npm run verify:from-scratch` (Guarda 2) | 0 | 10 suites · 87 passed |
| `npm run verify:argon2-runtime` | 0 | 15/15 |
| `npm run verify:openapi-runtime` | 0 | 17/17 |
| `npm run smoke:api` | 0 | processo real sobe, `/health`, encerra por sinal |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte **60 169 bytes**; `migrate diff --exit-code` 0 |
| `git diff --check` | 0 | — |

**Contêiner Linux descartável e próprio — snapshot de 29/08/2026, anterior à regressão nova** (`node:24`, `npm ci` pelo lockfile, PostgreSQL 18 isolado, criado e destruído por aquela execução) — **integralmente verde**:

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` · `npm run build` | 0 | — |
| `npm run test:api` | 0 | **21 suites · 526 passed** |
| `npm run test:integration -w @techlab-fisio/api` | 0 | **9 suites · 321 passed** (nada pulado) |
| `npm run verify:argon2-runtime` · `verify:openapi-runtime` | 0 | 15/15 · 17/17 |

Suítes da fatia, medidas isoladamente no Linux naquele snapshot: `catalogo-rbac` **26**, `provisionamento.fronteira` **21**, `provisionamento-rbac` **54**, `provisionamento-cli` **28**. A 29ª prova do CLI foi medida no host em 01/09/2026 e não depende de sinais POSIX.

**NOTA DE PLATAFORMA — os 2 casos pulados no host.** As provas de `SIGINT`/`SIGTERM` são **PULADAS no Windows, de forma explícita e visível na saída do Jest**, nunca silenciosamente aprovadas. A razão é de plataforma, não de implementação: **sinais POSIX não existem no Windows** — o Node documenta que `SIGTERM` nunca é entregue ao handler, e `child.kill()` recorre a `TerminateProcess`, que encerra o processo sem executar handler algum. O contrato de encerramento gracioso só é **medível** em POSIX, que é o alvo real: a CI roda em `ubuntu-latest` e a implantação é Linux. **A implementação não é condicional** — `cli.ts` registra os handlers em qualquer plataforma —, e as duas provas **passam no contêiner Linux** (28/28), onde o comportamento é observável.

**Intermitência observada e NÃO reproduzida — registrada como tal.** Em uma execução de `test:api` no contêiner houve **1 falha isolada** (525/526). Não capturei o log daquela execução e, portanto, **não sei nomear o caso**. A falha **não se reproduziu em 7 execuções subsequentes** (4 seguidas, mais 2 repetindo a sequência exata `rm -rf dist` + `build` + `test`, mais a medição final), todas 526/526, no contêiner e no host. Fica registrada como **transitório não identificado**, e não como suíte verde sem ressalva. A suíte com maior sensibilidade temporal do repositório é `limitador-login.spec.ts` (~28 s, contadores de rate limiting), alheia a esta fatia — hipótese, não conclusão.

### 6-N.12 Zero drift, dependências e fronteiras

```text
git diff main -- packages/ ........... 0 linhas
schema.prisma / golden / protected ... SHA-256 idênticos a `main`
migrations ........................... 10 -> 10   (nenhuma nova)
golden ............................... 60 169 bytes, byte a byte
package.json + package-lock (raiz) ... 0 linhas
apps/api/package.json ................ +4 linhas (apenas scripts de provisionamento)
rotas publicadas ..................... ["/auth/login","/auth/logout","/health"]
```

**Nenhuma dependência nova.** O advisory lock usa uma função nativa do PostgreSQL por `$executeRaw`; o sabotador de teste usa apenas `process.dlopen`. `prisma format`, `migrate dev`, `db push` e `db pull` **não** foram executados. **Nenhuma sessão é criada pelo bootstrap**; **nenhum provisionamento ocorre no start normal da API** — reprovado nesta rodada com o artefato compilado e todas as variáveis de bootstrap definidas.

### 6-N.13 Fronteira — o que a fatia corretiva deliberadamente NÃO fez

- **AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA** — nenhum fluxo de ativação/inativação, nenhuma alteração de `usuario.ativo`, `SessaoService.validar` intocado, `usuario.situacao.alterada` não emitida.
- **F6 NÃO INICIADA.**
- **Nenhum comando de reparo/transferência de papel administrativo** (§6-N.6).
- **Nenhuma migration, coluna, índice, constraint ou enum**; golden e objetos protegidos intocados.
- **Nenhum endpoint, rota, OpenAPI, JWT, Redis, cache ou multitenancy.**
- **`ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` não ampliadas** — nenhuma ação de auditoria nova, nenhuma chave de `contexto` introduzida. **`docs/12` FOI alterado** (REV. 6) para registrar `D-2.3D-14` e `D-2.3D-15`, homologadas por Bruno em 31/08/2026 (§6-N.3 e §6-N.4); **nenhuma decisão anterior foi alterada, renumerada, reduzida ou reaberta**.
- **`P2.2-05` NÃO INICIADA** — a matriz não mudou e o escopo clínico continua fora.

### 6-N.14 Estado

```text
F5 CORRIGIDA E REMEDIDA EM BRANCH PRÓPRIA
NÃO HOMOLOGADA
NÃO INTEGRADA

commit: NÃO · push: NÃO · PR: NÃO · merge: NÃO · deploy: NÃO · tag/release: NÃO

AUT-005 = NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA
RN-001  = NÃO declarada satisfeita pela F5
P2.2-05 = NÃO INICIADA
R2.2-04 = estado vigente preservado
P-2.3D-03 = estado vigente preservado
F6 = NÃO INICIADA
```

**Próximo passo previsto em 29/08/2026:** nova revisão técnica independente e adversarial sobre a árvore corrigida, com atenção prioritária à eficácia do advisory lock sob carga, à política de divergências do seed e às duas decisões então reservadas a Bruno (§6-N.3 e §6-N.4).

> **[ATUALIZAÇÃO — REV. 28, 01/09/2026.]** Esse passo **ocorreu**: as duas decisões foram homologadas em 31/08/2026 (`D-2.3D-14` e `D-2.3D-15`) e a revisão técnica independente final devolveu **`B — APTA COM RESSALVAS NÃO BLOQUEANTES`**, com 0 BLOQUEANTES e 0 ALTOS. As duas ressalvas — `F5H-01` (asserções factuais obsoletas nesta seção) e `F5H-02` (ausência de regressão do comando composto `provisionar`) — foram tratadas na segunda fatia corretiva, **§6-O**. O estado corrente da F5 é o de §6-O.

## 6-O. Etapa 2.3D-B / F5 — segunda fatia corretiva, pós-homologação técnica

**Estado: REGISTRO HISTÓRICO DA SEGUNDA FATIA CORRETIVA — SUPERADO PELO RITO DE INTEGRAÇÃO DE §6-O.8.** As MEDIÇÕES desta seção continuam válidas para o estado em que foram tomadas e **não foram reescritas**. A F5 está hoje **CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** (merge `657676b`, §6-O.8).

**Estado no encerramento desta fatia — histórico: CORRIGIDA — permanecia NÃO HOMOLOGADA COMO FATIA / NÃO INTEGRADA.** Executada em 01/09/2026 sobre a MESMA baseline `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337`, na mesma branch `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`, sobre a mesma working tree não commitada. **Publicação não autorizada: sem commit, push, PR, merge, rebase, tag, release ou deploy.**

**Esta seção é o estado CORRENTE da F5.** §6-M e §6-N permanecem como registro histórico das duas execuções anteriores, com as retificações marcadas no lugar em que a afirmação obsoleta estava.

**Nenhuma decisão normativa foi criada, alterada, renumerada, reduzida ou reaberta por esta fatia.** `D-2.3D-01`..`D-2.3D-15` seguem exatamente como homologadas; **`D-2.3D-14` e `D-2.3D-15` não foram tocadas**; `docs/12` **não** foi alterado nesta rodada; `docs/09` §12 não reaberto; `ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` não ampliadas; Base Imutável intacta.

### 6-O.1 Origem — a revisão técnica final

A revisão técnica independente e adversarial sobre a árvore corrigida devolveu **`B — APTA COM RESSALVAS NÃO BLOQUEANTES`**, com **0 BLOQUEANTES e 0 ALTOS**. Ela reproduziu integralmente as medições declaradas na REV. 27 e provou por **mutação** que a serialização por advisory lock é efetiva: removido o lock do artefato compilado, 4 de 5 rodadas mediram 2 a 4 Administradores; restaurado, 5 rodadas × 6 processos e uma rodada de 12 processos mediram **exatamente 1**, com zero falhas não contratadas.

Esta fatia trata **somente** as duas ressalvas. Nada além delas foi alterado.

| ID | Sev. | Situação após esta fatia |
| --- | --- | --- |
| `F5H-01` | MÉDIO | **CORRIGIDO** (§6-O.2) — asserções factuais obsoletas de §6-N retificadas |
| `F5H-02` | MÉDIO | **CORRIGIDO** (§6-O.3) — regressão automatizada do comando composto `provisionar` |
| `F5H-03` | BAIXO | **NÃO TRATADO — fora do escopo desta rodada** (diagnosticabilidade de erro de configuração) |
| `F5H-04` | BAIXO | **NÃO TRATADO — fora do escopo desta rodada** (logger do Nest em stdout) |
| `F5H-05` | OBSERVAÇÃO | **NÃO TRATADO — fora do escopo** (teto padrão da transação limita a espera pelo lock; medido sem falha a 12 processos) |
| `F5H-06` | OBSERVAÇÃO | **NÃO TRATADO — fora do escopo** (3 provas condicionadas a `dist/`) |
| `F5H-07` | OBSERVAÇÃO | **NÃO TRATADO — fora do escopo** (sinais POSIX não medíveis no host Windows) |

### 6-O.2 `F5H-01` — o que era falso, e o que passou a estar escrito

O cabeçalho de §6-N e a lista de fronteira de §6-N.13 foram escritos em **29/08/2026**, quando ainda não existia `D-2.3D-14`. Ambos afirmavam, sem marca de data, que **`docs/12` não fora tocado** e que **não existia `D-2.3D-14`**. A REV. 27 homologou as duas decisões e atualizou §6-N.3 e §6-N.4 — mas não aquelas duas passagens, que passaram a **contradizer a própria seção** e o conjunto real de alterações da F5.

Correção aplicada, sem reescrever história legítima:

- o cabeçalho de §6-N teve a afirmação **datada** (“*pela execução de 29/08/2026*”) e ganhou um bloco **[ATUALIZAÇÃO — REV. 27]** declarando que `docs/12` **passou** a integrar o conjunto de alterações da F5, com `D-2.3D-14` e `D-2.3D-15` homologadas em 31/08/2026;
- o marcador de §6-N.13 foi reescrito para o estado real: `docs/12` **foi** alterado (REV. 6), **nenhuma decisão anterior** foi alterada, renumerada, reduzida ou reaberta;
- o “próximo passo” ao fim de §6-N foi datado e complementado com **[ATUALIZAÇÃO — REV. 28]**, que registra o desfecho da revisão e aponta para esta seção.

§6-M **não** foi alterada: ela é registro histórico explícito da execução inicial, e §6-N já a declara como tal.

**Distinção preservada, porque ela é material:** o que foi homologado em 31/08/2026 são as **duas decisões normativas**. A **fatia** F5 continua **não homologada e não integrada**.

### 6-O.3 `F5H-02` — regressão do comando composto `provisionar`

`seed` e `bootstrap-admin` já tinham cobertura exaustiva; a **composição** — o comando que o operador de fato executa, exposto como `npm run provisionar` — não tinha nenhuma. Sete provas novas em `apps/api/test/integration/provisionamento-cli.integration.spec.ts`, no mesmo padrão adversarial da suíte: **processo real** do CLI compilado, estado verificado **no PostgreSQL**, sem `sleep`, reusando a infraestrutura descartável existente.

| Cenário | Saída | Administradores | Estado RBAC | Bootstrap | Resultado |
| --- | ---: | ---: | --- | --- | --- |
| Scripts públicos → argv medido | — | — | — | — | `provisionar` e `provisionar:seed:estrito` apontam para o CLI compilado |
| **P1** banco vazio (senha por stdin) | **0** | 1 | 4 papéis · 29 permissões · 37 associações | executado | usuário criado; evento `usuario.papeis.alterados`, `ator = NULL`, justificativa persistida, `contexto` NULL; senha e justificativa ausentes da saída |
| **P2** composição repetida | **0** | 1 | 4 · 29 · 37 (inalterado) | executado, `JA_CONFORME` | seed `JA_CONFORME`; nenhum segundo Administrador, nenhum segundo evento; **mesma** identidade |
| **P3** outro Administrador existe | **1** | 1 | 5 papéis · 29 · **38** | recusado `ADMINISTRADOR_JA_EXISTE` | identidade intrusa **não nasce**; o seed **commitou** (matriz reconvergida, excedentes preservados) — transações separadas |
| **P4** `provisionar --estrito` divergente | **3** | **0** | 5 · 29 · 38, `nome` reconvergido, excedentes preservados | **NÃO executado** | identidade solicitada **não existe**; zero usuário, zero evento; `stdout` sem qualquer `bootstrap-admin` |
| **P4b** controle positivo (mesmo banco, sem `--estrito`) | **0** | 1 | idem, excedentes preservados | executado | prova que P4 não passa por vacuidade |
| **P5** credencial inválida | **1** | 0 | **nada semeado** | não executado | validação da entrada precede o seed; `stdout` vazio |

**Por que P4 é inequívoco.** O banco de P4 **não tem Administrador algum**. Assim, a ausência de Administrador ao final só pode vir do **curto-circuito da saída 3** — nunca de uma recusa `ADMINISTRADOR_JA_EXISTE`, que o teste também exclui explicitamente do `stderr`. **P4b** fecha a única brecha lógica restante: mesmo banco, mesma identidade, única diferença é a opção — e ali o bootstrap **roda** e cria o Administrador.

**Poder de reprovação medido por mutação** (no artefato compilado, git-ignored, restaurado e reconstruído em seguida — SHA-256 idêntico ao build limpo):

| Mutante | O que muda | Efeito medido |
| --- | --- | --- |
| M-1 | remove o `return` do curto-circuito | **P4 reprova** (`status` 0, esperado 3); P4b segue verde |
| M-2 | preserva a saída 3, mas executa o bootstrap antes de retornar | **P4 reprova** pela asserção de que `stdout` **não** contém `bootstrap-admin`; P4b segue verde |

M-2 é o que importa: ele prova que a regressão detecta a **execução do bootstrap**, e não apenas o código de saída. O curto-circuito **antes** do bootstrap está provado automaticamente.

**Nenhuma alteração de comportamento produtivo.** `cli.ts` e os serviços da fatia não foram tocados; nenhum código de saída foi alterado; nenhuma dependência foi instalada.

### 6-O.4 Arquivos alterados nesta fatia

| Arquivo | Situação | Motivo |
| --- | --- | --- |
| `docs/10-backend-implementacao.md` | **ALTERADO** | `F5H-01` (§6-O.2) + esta seção + REV. 28 |
| `apps/api/test/integration/provisionamento-cli.integration.spec.ts` | **ALTERADO** — +7 provas | `F5H-02` (§6-O.3); o arquivo passa de **29** para **36** casos |

**Nenhum outro arquivo foi tocado.** `src/` intocado; `docs/12` intocado; `packages/` intocado; `package.json` intocado.

### 6-O.5 Bateria integral — host Windows, 01/09/2026

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run build` | 0 | — |
| `npm run test:api` | 0 | **21 suites · 526 passed** (inalterado) |
| `npm run test:integration -w @techlab-fisio/api` | 0 | **9 suites · 327 passed · 2 skipped** (era 320 + 2 — as 7 provas novas) |
| `npm run test:integration` (persistência) | 0 | 10 suites · 87 passed |
| `npm run verify:from-scratch` (Guarda 2) | 0 | 10 suites · 87 passed; 0 descartáveis remanescentes |
| `npm run verify:argon2-runtime` | 0 | 15/15 |
| `npm run verify:openapi-runtime` | 0 | 17/17 |
| `npm run smoke:api` | 0 | processo real, `/health`, encerramento por sinal |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte **60 169 bytes**; `migrate diff --exit-code` 0 |
| `git diff --check` | 0 | — |

Os 2 casos pulados continuam sendo **exclusivamente** as provas de `SIGINT`/`SIGTERM`, pela mesma razão de plataforma de §6-N.11 — nota inalterada e ainda vigente.

### 6-O.6 Zero drift e fronteiras

```text
git diff main -- packages/ ........... 0 linhas
git diff main -- apps/api/src/ ....... 0 linhas nesta fatia (src intocado)
schema.prisma / golden / protected ... SHA-256 idênticos a `main`
migrations ........................... 10 -> 10   (nenhuma nova)
golden ............................... 60 169 bytes, byte a byte
package.json (raiz e apps/api) ....... inalterados nesta fatia
dependências novas ................... nenhuma
rotas publicadas ..................... ["/auth/login","/auth/logout","/health"]
```

Fora do escopo desta fatia e **não** tratados: `F5H-03`, `F5H-04`, `F5H-05`, `F5H-06` e `F5H-07` (§6-O.1). **AUT-005** permanece NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA; **F6** NÃO INICIADA; **`P2.2-05`** NÃO INICIADA; **`R2.2-04`** e **`P-2.3D-03`** com estado vigente preservado.

### 6-O.7 Estado no encerramento da segunda fatia corretiva — registro histórico

```text
F5 CORRIGIDA (2ª fatia corretiva) EM BRANCH PRÓPRIA
FATIA: NÃO HOMOLOGADA · NÃO INTEGRADA
DECISÕES D-2.3D-14 e D-2.3D-15: HOMOLOGADAS em 31/08/2026 (docs/12 REV. 6)

commit: NÃO · push: NÃO · PR: NÃO · merge: NÃO · deploy: NÃO · tag/release: NÃO

F5H-01 = CORRIGIDO      F5H-02 = CORRIGIDO
F5H-03, F5H-04, F5H-05, F5H-06, F5H-07 = FORA DO ESCOPO, EM ABERTO
```

**Próximo passo previsto em 01/09/2026: decisão de Bruno Menezes Noronha sobre a homologação da fatia e, somente após autorização própria, o rito de versionamento/integração.** Este documento **não** afirmava, naquele momento, integração, publicação ou merge.

> **[ESTADO SUPERADO — §6-O.8]** O bloco e o parágrafo acima são o registro **histórico** do estado no encerramento da segunda fatia corretiva, tomado **antes** do merge, e **não foram reescritos**. O rito foi concluído em 02/09/2026: a F5 está **INTEGRADA NA `main`** pelo merge commit `657676b`. O estado vigente e as medições pós-merge estão em **§6-O.8**. **F6 permanece NÃO INICIADA.**

### 6-O.8 Registro pós-medição da integração

Registro **exclusivamente factual** do rito, no precedente MEDIR → REGISTRAR das REV. 10, REV. 15, REV. 20 e REV. 24 (§6-I.8, §6-L.8). **Esta seção não cria, altera ou reabre decisão alguma.** `D-2.3D-14` e `D-2.3D-15` permanecem exatamente como homologadas em 31/08/2026.

**Autoridade.** Integração executada em 02/09/2026 por autorização expressa de Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) para integrar a F5 **no estado corrigido e homologado** de §6-O — sem reimplementação, sem reabertura de decisão e sem início da F6.

| Item | Valor |
| --- | --- |
| `main` antes | `91406203cbecb148f395a58adcfeb6b39f825337` |
| Commit 1 — implementação + testes | `f4b301509e9bbc80782e84825f5593fa4b2485d7` — `feat(provisionamento): implement RBAC seed and first Administrator bootstrap` |
| Commit 2 — documentação | `11612b413188ff206a5a455cb8336707cfe31cc6` — `docs(backend): register F5 provisioning slice and decisions D-2.3D-14/15` |
| Commit 3 — correção de harness pós-incidente de CI | `39ad1975119c8a8decc559c90e82955a53e4021a` — `test(provisionamento): close tlf_app client before disposable DB teardown` |
| Pull request | [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18) |
| HEAD validado pela CI e mergeado | `39ad1975119c8a8decc559c90e82955a53e4021a` |
| Merge commit | `657676b3ff28f6257e522bd987beddeea5e6bf8f` |
| `main` depois | `657676b3ff28f6257e522bd987beddeea5e6bf8f` |
| Método | **merge commit** — sem squash, sem rebase, sem force-push |
| Instante do merge | 02/09/2026 20:45:16Z (17:45:16 −03:00) |

**Três commits, por separação lógica e por um incidente.** A árvore homologada de §6-O foi versionada em dois commits logicamente separados sem qualquer rearranjo — implementação/testes (15 arquivos, +4540/−4) e documentação (`docs/10` + `docs/12`, +906/−16) — porque os conjuntos de arquivos são disjuntos. O terceiro commit existe pelo incidente de CI descrito abaixo e altera **um único arquivo de teste** (+11/−1). Os sete arquivos de `apps/api/src/provisionamento/` e o catálogo da F4 têm, na `main` integrada, o mesmo conteúdo conferido no gate inicial desta execução.

**Genealogia conferida** — `git show --no-patch --format=fuller 657676b`:

```text
merge ........ 657676b3ff28f6257e522bd987beddeea5e6bf8f
parent 1 ..... 91406203cbecb148f395a58adcfeb6b39f825337   (main antes)
parent 2 ..... 39ad1975119c8a8decc559c90e82955a53e4021a   (fatia F5)
```

**Proteção contra corrida.** Imediatamente antes do merge, HEAD local, HEAD remoto da branch e `headRefOid` do PR coincidiam em `39ad197` — o mesmo SHA da run verde —, `origin/main` permanecia em `9140620` desde o gate inicial (0 commits novos), `merge-base` = `origin/main`, e o PR estava `MERGEABLE` / `CLEAN`. `git diff 39ad197 657676b` é vazio: a árvore integrada é byte a byte a árvore validada.

#### Incidente de CI — teardown do banco descartável (corrigido antes do merge)

A primeira run do PR ([33679640038](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33679640038), sobre `11612b4`) executou todos os passos anteriores em verde e, no passo de integração da API, **passou em 9 suítes · 329 provas** (no Linux as duas provas de `SIGINT`/`SIGTERM` não são puladas). O passo falhou **depois** da suíte, no `globalTeardown` da E-13:

```text
Jest: Got error running globalTeardown - packages/database/test/global-teardown.mjs,
reason: permission denied to terminate process
```

**Causa, medida.** O teardown executa `DROP DATABASE ... WITH (FORCE)` como `tlf_migrator`, que **não pode terminar sessões de outra role**. `provisionamento-cli.integration.spec.ts` criava no `beforeAll` um cliente `tlf_app` (pool `pg`, cujas conexões ociosas só fecham após 10 s) e nunca o desconectava. Na CI essa suíte terminou ~5 s antes do teardown e a conexão ainda estava viva; no host, a ordem de execução das suítes deixara mais de 10 s entre ela e o teardown, e por isso as medições de §6-N.11 e §6-O.5 nunca acusaram o defeito. **Reprodução determinística:** executar a suíte isolada no host (`jest --config jest.integration.config.mjs test/integration/provisionamento-cli`) falha com o mesmo erro e deixa um banco `techlab_fisio_it_%` órfão na instância de desenvolvimento (removido pelo `globalSetup` seguinte).

**Correção — `39ad197`, exclusivamente harness de teste:** `afterAll(async () => { await cliente.$disconnect(); })`, o mesmo contrato de fechamento que `setup-db.ts` já impõe ao cliente de limpeza. **Nenhuma linha de runtime, contrato, persistência, decisão normativa ou dependência foi tocada.** Remedido antes do push: a suíte isolada passa com teardown limpo e 0 bancos órfãos; `verify:api-integration` 9 · 327 + 2 pulados. Precedente: correção de portabilidade do harness na F3 (`c20cf1c`, §6-I.8). O incidente está registrado no PR ([comentário](https://github.com/BrunoMNoronha/techlab-fisio/pull/18#issuecomment-5516100023)).

#### Medições da CI sobre o HEAD integrado

Run [33680739691](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33680739691) — **success** sobre `39ad197`, job único `E-16 — tríade anti-drift + reconstrução from-scratch + suíte integral`, **3m24s** (20:41:02Z → 20:44:26Z), todos os passos verdes:

| Etapa | Resultado |
| --- | --- |
| Guarda 1 — lint de migrations sobre objetos protegidos | `OK — nenhuma remoção de objeto protegido detectada` |
| E-15 + Guarda 2 — reconstrução from-scratch | **10 suites · 87 passed** |
| Guarda 3 + alarme — golden byte a byte e `migrate diff --exit-code` | `OK — dump byte a byte idêntico ao golden versionado (60169 bytes)` |
| Provas de runtime — Argon2id e OpenAPI no ESM compilado | verdes · OpenAPI `17 verificações OK` |
| Suíte de `apps/api` | **21 suites · 526 passed** |
| Exports público de `@techlab-fisio/database` (F-01) | verde |
| **Integração com PostgreSQL 18 real** | **9 suites · 329 passed** (nada pulado — Linux) |
| Smoke ESM real (R-BL-02) | verde |

As contagens produzidas pela CI no Linux coincidem com as medidas localmente no Windows, com a única diferença **declarada** das 2 provas de sinal POSIX, que o host pula e a CI executa.

#### Validação local sobre a `main` integrada

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run typecheck` | 0 | — |
| `npm run build` | 0 | — |
| `npm run test:api` | 0 | **21 suites · 526 tests** |
| `npm run verify:api-integration` | 0 | **9 suites · 327 passed · 2 skipped** |
| `npm run test:integration` (persistência) | 0 | **10 suites · 87 tests** |
| `npm run verify:from-scratch` (Guarda 2) | 0 | **10 suites · 87 tests** |
| `npm run smoke:api` | 0 | 10 migrations aplicadas; `/health` 200; encerramento por SIGTERM |
| `npm run verify:argon2-runtime -w @techlab-fisio/api` | 0 | **15/15** |
| `npm run verify:openapi-runtime -w @techlab-fisio/api` | 0 | **17/17** |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` (Guarda 3) | 0 | golden **60 169 bytes** byte a byte; `migrate diff --exit-code` 0 |
| `git diff --check` | 0 | — |
| `git status --short` | — | árvore limpa (nenhum arquivo versionado alterado) |

Executada sobre `main` = `origin/main` = `657676b`, após `git pull --ff-only`, no host Windows (`node v24.18.0`). As contagens são as mesmas de §6-O.5 — a integração **não** alterou nenhuma delas. Estado do Docker registrado antes e depois: nenhum contêiner, volume ou banco descartável desta execução remanescente; os bancos da instância de desenvolvimento são idênticos aos do início.

#### Zero drift na `main` integrada

```text
git diff 9140620 657676b -- packages/database ....... 0 linhas
git diff 9140620 657676b -- package.json, package-lock.json, packages/database/package.json ... 0 linhas
git diff 9140620 657676b -- apps/api/package.json .... +4 linhas (scripts provisionar*)

schema.prisma .......... 7bee911e75e4742f   IDÊNTICO à integração da F4
schema.golden.sql ...... c2ad5dc539098f51   IDÊNTICO à integração da F4
protected-objects.json . 9b4033a3c2cf3a79   IDÊNTICO à integração da F4
migrations ............. 10 -> 10
golden ................. 60 169 bytes
diff total ............. 17 arquivos, +5456 / −20
```

```text
zero drift · zero migration nova · zero dependência nova · zero rota nova
```

#### Pendências que permanecem vivas após a integração

| Item | Estado |
| --- | --- |
| **AUT-005** | **NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA.** A F5 não ativa nem inativa usuário e não toca `SessaoService.validar` |
| **RN-001** | **APLICÁVEL e NÃO SATISFEITO** fora do alcance parcial da `PermissoesGuard` (`L-F4-02`) |
| **`P2.2-05`** | Autorização clínica contextual — **NÃO INICIADA**; risco baixo das permissões `C` semeadas antes dela registrado em §6-N.9 |
| **`R2.2-04`** | **ABERTO / MITIGADO PARCIALMENTE** (§7.2) — herdado, não afetado |
| **`P-2.3D-03`** | **MEDIDA E VERDE — encerramento formal PENDENTE de decisão de Bruno** — estado preservado |
| **Bloqueio administrativo sem via de recuperação** | **RISCO MÉDIO DECLARADO** (§6-N.6) — runbook manual; comando de reparo exige fatia e autorização próprias |
| **`F5H-03`..`F5H-07`** | BAIXOS/OBSERVAÇÕES **em aberto**, fora do escopo desta integração (§6-O.1) |

**F6 permanece NÃO INICIADA.** Nenhum artefato de recuperação de senha existe em `apps/api/src`; `apps/web` não existe.

#### Publicação

```text
commit da F5 ....... SIM — f4b3015 (impl/testes) · 11612b4 (docs) · 39ad197 (harness)
push da F5 ......... SIM — agent/fase2-etapa2.3d-f5-seed-bootstrap-admin, sem force
PR da F5 ........... #18
merge da F5 ........ SIM — 657676b3ff28f6257e522bd987beddeea5e6bf8f
deploy ............. NÃO
tag/release ........ NÃO
F6 ................. NÃO INICIADA
```

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta por este registro.** `D-2.3D-01`..`D-2.3D-15` seguem exatamente como homologadas; `D-2.3D-14` e `D-2.3D-15` intactas; `docs/09` §12 não reaberto; `docs/12` recebeu apenas a REV. 7, factual (linha da F5 em §9); a Base Imutável permanece **intacta**.


## 6-P. Etapa 2.3D-B / F6 — recuperação segura de senha

**Estado: IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA — NÃO HOMOLOGADA / NÃO INTEGRADA.** Executada em 03/09/2026 na branch `agent/fase2-etapa2.3d-f6-recuperacao-senha`, criada a partir de `main` = `origin/main` = `caf22804d8438071932d9abc57904aa428684eac` (merge da F5 + registro pós-integração; §6-O.8, §11 REV. 29). Gate inicial: working tree limpa exceto `AGENTS.md` (artefato não rastreado de ferramenta externa, mantido fora do escopo); `ahead/behind = 0/0`; `merge-base = HEAD`; nenhum contêiner ou banco descartável residual. **Publicação não autorizada nesta execução: sem commit, push, PR, merge, rebase, tag, release ou deploy** (TLF-BASE-V1 §14; precedente das execuções iniciais de F3/F4/F5).

**Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta.** `D-2.3D-01`..`D-2.3D-15` seguem exatamente como homologadas; **`docs/12` NÃO foi tocado** (o precedente vigente é atualizá-lo apenas na homologação — REV. 4/5/7); `docs/09` §12 não foi reaberto; **nenhuma ação de auditoria foi acrescentada e nenhuma whitelist de `contexto` foi ampliada**; a Base Imutável permanece intacta. **Nenhuma linha de `packages/` foi tocada**: zero migration, zero coluna, zero índice, zero enum, zero constraint (§6-P.13).

### 6-P.1 Identificação do requisito — divergência de numeração registrada

O enunciado desta fatia referia a recuperação de senha como "relacionada a `AUT-005` se essa identificação continuar vigente". **Não continua**: em `docs/02` vigente, **`AUT-004` é "Recuperar senha com mecanismo seguro"** e **`AUT-005` é "Ativar e inativar usuários preservando histórico"**. A F6 materializa **AUT-004**; AUT-005 permanece **NÃO MATERIALIZADA / SEM FATIA ATRIBUÍDA** (§6-K.4; §9). Nenhuma fonte foi reinterpretada: a numeração vigente de `docs/02` prevalece e o enunciado é lido como referência à funcionalidade, não ao número.

### 6-P.2 Fontes e matriz de decisões (Fase B)

| Aspecto | Fonte vigente | Estado |
| --- | --- | --- |
| Solicitação de recuperação | AUT-004 fluxo 1; D-04 item 1 ("iniciada por administrador autorizado"); `docs/04` §4 "Iniciar recuperação de senha de terceiro" (✓ só Administrador) | **definido** — sem auto-solicitação |
| Identificação do usuário | AUT-004 pré-condição "usuário existente"; `D-2.3D-03` (normalização do identificador) | **definido** (identificador normalizado) — a **forma** do campo é decisão local `L-F6-01` |
| Mecanismo de prova/credencial | AUT-004 fluxo 2; `D-2.3D-08` (256 bits; só o hash persistido) | **definido** |
| Entrega da credencial | AUT-004 fluxo 3; D-04 item 3 ("apresentado uma única vez para entrega externa segura"); TLF-BASE-V1 §13 (e-mail/SMS/WhatsApp fora do MVP) | **definido** — apresentação única na resposta ao Administrador; **nenhum canal integrado** |
| Validade | `D-2.3D-08` — 30 minutos | **definido** |
| Uso único / replay | AUT-004 invariantes; RN-005; `D-2.3D-08` | **definido** |
| Um pendente por usuário | `D-2.3D-08` ("ao emitir um novo, o anterior é invalidado/expirado") | **definido** — mecanismo (`expira_em = agora`) é local `L-F6-08` |
| Usuário inexistente | RN-006; `docs/04` §4 (fluxo autorizado) | **definido** por princípio — resposta uniforme (`L-F6-04`) |
| Usuário inativo | AUT-004 exceções ("usuário inativo"); RN-001 | **definido** |
| Proteção contra enumeração | RN-006; TLF-BASE-V1 §10; precedente `D-2.3D-12`/`A-05` | **definido** |
| Proteção contra abuso | `D-2.3D-06`, segunda metade — 10 tentativas / 15 min por IP, `429` + `Retry-After`, antes do Argon2 | **definido** — leitura literal de "tentativas" é `L-F6-05` |
| Nova senha | AUT-004 fluxo 5; `D-2.3D-02` (Argon2id); nenhuma política de senha homologada | **definido** (hash) / **ausente** (política de senha — não inventada) |
| Sessões existentes | AUT-004 fluxo 7; D-04 item 5; RN-005; T-07; AUT-002 (gatilho "recuperação/troca de senha"); `D-2.3D-08` ("não cria nova sessão") | **definido** — autoria da revogação é `L-F6-06` |
| Auditoria | AUT-004 ("início e conclusão, sem registrar segredo"); `docs/09` §5/§12 — `usuario.senha.recuperacao_iniciada` (ator Administrador) e `usuario.senha.recuperacao_concluida` (ator Usuário), whitelist vazia | **definido** — somente sucesso (`L-F6-07`) |
| Permissões | `docs/04` §5.1 `senha.recuperar_terceiro`; `D-2.3D-09`; mecanismo da F4 | **definido** |
| API/OpenAPI | `D-2.3D-11`; precedente `L-01`..`L-04` da F3 | rota/status/forma **não fixados** — decisões locais `L-F6-01`/`L-F6-02`/`L-F6-04` |
| Persistência | `docs/07` §7.1 `segredo_recuperacao_senha` (já existente); `docs/12` §7.4 ("`D-2.3D-08` reutiliza `segredo_recuperacao_senha`") | **definido** — nenhuma alteração necessária |
| Frontend | `docs/12` §2 ("fora do escopo: frontend") | **fora** — F6 é backend |

**Conclusão da Fase B:** nenhuma lacuna altera materialmente segurança, regra de negócio, persistência ou comportamento público além de forma; todas as lacunas de forma têm precedente homologado de resolução por decisão local declarada. **A F6 não está bloqueada por decisão.** As quatro decisões locais de natureza comportamental estão destacadas em §6-P.7 para que Bruno as homologue ou reverta — nenhuma delas é apresentada como norma.

### 6-P.3 Arquivos criados e alterados

| Arquivo | Situação | Responsabilidade |
| --- | --- | --- |
| `apps/api/src/recuperacao-senha/recuperacao-senha.service.ts` | **NOVO** (340) | `iniciar` (lock da linha do usuário, expiração do pendente, hash, evento) e `concluir` (gate por IP, forma, localização pelo hash, aptidão, Argon2 fora da transação, T-07 atômico) |
| `apps/api/src/recuperacao-senha/recuperacao-senha.controller.ts` | **NOVO** (258) | `POST /auth/recuperacao-senha` (`@RequerPermissao("senha.recuperar_terceiro")`) e `POST /auth/recuperacao-senha/concluir`; decorators OpenAPI; CSRF nas duas |
| `apps/api/src/recuperacao-senha/recuperacao-senha.dto.ts` | **NOVO** (185) | DTOs, `ERRO_RECUPERACAO` (2 códigos), validação estrutural pura |
| `apps/api/src/recuperacao-senha/segredo-recuperacao.ts` | **NOVO** (87) | CSPRNG 256 bits, forma, SHA-256, comparação em tempo constante, hash sintético de ausência |
| `apps/api/src/recuperacao-senha/limitador-recuperacao.ts` | **NOVO** (87) | segunda metade de `D-2.3D-06` sobre `DimensaoLimite` |
| `apps/api/src/recuperacao-senha/recuperacao-senha.module.ts` | **NOVO** (49) | módulo próprio; imports `[AuthzModule, AuditModule]` |
| `apps/api/src/auth/dimensao-limite.ts` | **NOVO** (349) | **extração** da mecânica de janela/poda/teto/despejo/reserva de `limitador-login.ts`, sem mudança de contrato (`L-F6-09`) |
| `apps/api/src/auth/limitador-login.ts` | **ALTERADO** (refatorado: −485/+~130) | passa a compor duas `DimensaoLimite`; API pública, limites, HMAC e semântica de reserva idênticos; suíte da F3 (37 provas) verde sem alteração |
| `apps/api/src/auth/sessao.service.ts` | **ALTERADO** (+49) | `revogarTodasDoUsuarioEm(tx, usuarioId)` — aditivo, ordem de `C-01` (expira vencidas, revoga ativas) |
| `apps/api/src/auth/erro-autenticacao.filter.ts` | **ALTERADO** (+28/−2) | as duas rotas da F6 entram no escopo do contrato fechado; códigos aceitos = `ERRO` ∪ `ERRO_AUTORIZACAO` ∪ `ERRO_RECUPERACAO` |
| `apps/api/src/auth/auth.module.ts` | **ALTERADO** (+9) | exporta `RELOGIO_SESSAO` (aditivo — mesmo racional do export de `POLITICA_COOKIE_SESSAO` na F4) |
| `apps/api/src/auth/auth.dto.ts` | **ALTERADO** (2 linhas) | `MAXIMO_IDENTIFICADOR` e `MAXIMO_SENHA` passam a exportados (tetos reutilizados) |
| `apps/api/src/auth/auth.controller.ts` | **ALTERADO** (2 linhas) | `extrairIp` e `RequisicaoAutenticacao` exportados (fonte única de `L-05`) |
| `apps/api/src/app.module.ts` | **ALTERADO** (+2) | registra `RecuperacaoSenhaModule` |
| `apps/api/src/openapi/documento-openapi.ts` | **ALTERADO** | contrato `0.1.0 → 0.2.0` (aditivo); descrição |
| `apps/api/scripts/verify-openapi-runtime.mjs` | **ALTERADO** | rotas da F6; três verificações novas; contagem dinâmica (19) |
| `scripts/smoke-api.mjs` | **ALTERADO** (+7) | presença das rotas da F6 no documento servido pelo processo real |
| `apps/api/test/integration/recuperacao-senha.integration.spec.ts` | **NOVO** (1 091) | **53 provas** contra PostgreSQL 18 real (§6-P.11) |
| `apps/api/test/limitador-recuperacao.spec.ts`, `segredo-recuperacao.spec.ts`, `recuperacao-senha-dto.spec.ts` | **NOVOS** | 69 provas unitárias novas no total de `test:api` (526 → 595), incluindo fronteira do módulo e metadata das rotas |
| `apps/api/test/openapi.spec.ts`, `auth.module.integration.spec.ts` | **ALTERADOS** | asserções de igualdade exata atualizadas para o conjunto F3 + F6; exceção nominal de `IniciarRecuperacaoRespostaDto.segredo` |

**Nenhum outro arquivo foi tocado.** `packages/**`, `docs/12`, `docs/02`..`docs/09`, `.github/**`, `package.json`/lockfile, `.env.example` e `provisionamento/**` (F5) têm diff vazio contra `caf2280`.

### 6-P.4 Desenho — o fluxo homologado, passo a passo

```text
INÍCIO — POST /auth/recuperacao-senha           (Administrador; CSRF + sessão + senha.recuperar_terceiro)
  1. validação estrutural do corpo { identificador }        -> 400 antes de tudo
  2. normalização D-2.3D-03
  3. transação:  SELECT id, ativo FROM usuario WHERE email = $1 FOR UPDATE   (serialização por alvo)
       inexistente | inativo | próprio ator                  -> 422 ALVO_NAO_ELEGIVEL (uniforme)
       UPDATE segredo_recuperacao_senha SET expira_em = agora
         WHERE usuario_id = alvo AND consumido_em IS NULL AND expira_em > agora   (D-2.3D-08: um pendente)
       INSERT segredo (hash SHA-256, expira_em = agora + 30 min, criado_por = ator, criado_em = agora)
       evento usuario.senha.recuperacao_iniciada / SUCESSO (ator = Administrador, alvo = usuário, contexto omitido)
  4. 201 { segredo, expiraEm }                                (ÚNICA saída do segredo em claro)

CONCLUSÃO — POST /auth/recuperacao-senha/concluir (usuário; CSRF; SEM sessão)
  1. validação estrutural { segredo, novaSenha }             -> 400; NÃO conta como tentativa
  2. LimitadorRecuperacao.tentar(ip)  (10/15 min por IP; admissão = tentativa) -> 429 + Retry-After; sem banco, sem Argon2
  3. forma do segredo (43 base64url)                          -> 401 RECUPERACAO_INVALIDA
  4. transação curta: findFirst por hash; comparação em tempo constante; pendente? não expirado? conta ativa?
                                                              -> 401 RECUPERACAO_INVALIDA (uniforme; sem Argon2)
  5. Argon2id da nova senha — FORA da transação
  6. transação T-07:
       UPDATE segredo SET consumido_em = agora WHERE id = $1 AND consumido_em IS NULL AND expira_em > agora  (count 1 ou aborta)
       UPDATE usuario SET senha_hash = novo WHERE id = $2 AND ativo = true                                     (count 1 ou aborta)
       SessaoService.revogarTodasDoUsuarioEm: ATIVA vencidas -> EXPIRADA; ATIVA -> REVOGADA (revogada_por = usuário)
       evento usuario.senha.recuperacao_concluida / SUCESSO (ator = usuário, alvo = usuário, contexto omitido)
  7. 204 sem corpo, sem cookie (D-2.3D-08: nenhuma sessão nova)
```

Consumo, troca de senha, revogação e evento são **uma** transação (T-07, `docs/07` §24.2: "consumo do segredo + revogação atômicos"). Nenhuma decisão de escrita é tomada em memória: os dois `UPDATE` condicionais carregam o predicado inteiro e, sob `READ COMMITTED`, a transação perdedora reavalia sobre a versão commitada e casa zero linhas.

### 6-P.5 Reúso — nada da F1..F5 foi reimplementado

`CredencialService` (Argon2id, `D-2.3D-02`) para a nova senha; `SessaoService` (ganhou apenas a revogação em massa, no padrão de `emitirEm`/`revogarEm`); `AuditWriter` + validator fail-closed (eventos já pertencentes a `D-AUD-01`, whitelist vazia de `D-AUD-07` respeitada por omissão de `contexto`); `DatabaseService` como fronteira transacional única; `@RequerPermissao` + guards da F4; `ProtecaoCsrfGuard`, `lerCookieSessao`/política de cookie, `extrairIp` (`L-05`), `normalizarIdentificadorLogin` (`D-2.3D-03`), `FiltroErroAutenticacao` (escopo ampliado às duas rotas) e o catálogo tipado de permissões. O limitador da conclusão reutiliza a **mesma** mecânica do limitador do login por extração (§6-P.7, `L-F6-09`) — não por cópia.

### 6-P.6 Fronteira — o que a F6 deliberadamente NÃO fez

- **Nenhum canal de entrega**: sem e-mail, SMS, WhatsApp, serviço de terceiros ou fila (TLF-BASE-V1 §13). O segredo é apresentado uma única vez ao Administrador autenticado (AUT-004, passo 3) e a entrega é externa à aplicação (D-04, item 3).
- **Sem auto-solicitação** ("esqueci minha senha"): D-04 fixa o início pelo Administrador; nada além disso foi criado.
- **AUT-005 NÃO MATERIALIZADA**: nenhuma ativação/inativação de usuário; a recusa de alvo inativo apenas **lê** `usuario.ativo`. O estado inativo dos testes é artificial e declarado como tal.
- **Sem revogação administrativa de sessão de terceiro**, sem listagem de usuários, sem política de senha, sem histórico de senhas, sem frontend, sem JWT/refresh, sem Redis, sem multitenancy.
- **Sem alteração de persistência**: nenhum índice em `hash_segredo`/`usuario_id` (limitação declarada em §6-P.14), nenhuma migration.
- **Sem ampliação de catálogo/whitelist de auditoria; `docs/12` não tocado; F7 não iniciada.**

### 6-P.7 Decisões locais — reversíveis, **não** são norma

| ID | Decisão | Fundamento / alternativa recusada | Destaque |
| --- | --- | --- | --- |
| `L-F6-01` | Rotas `POST /auth/recuperacao-senha` (início) e `POST /auth/recuperacao-senha/concluir`; alvo identificado pelo **identificador** (e-mail normalizado) no corpo do início | Nenhuma fonte fixa rota nem forma; o identificador é o único campo de acesso do modelo e não existe endpoint de listagem que desse ao Administrador um `usuarioId` | — |
| `L-F6-02` | `201 { segredo, expiraEm }` no início; `204` sem corpo na conclusão | Um recurso foi criado; nada a devolver na conclusão e nenhuma sessão nasce (`D-2.3D-08`) | — |
| `L-F6-03` → **`D-2.3D-16`** | O Administrador **não** pode iniciar a própria recuperação (`422` uniforme) | `docs/04` §4/§5.1: "de terceiro" / "para outro usuário"; D-04 item 4 pressupõe que quem inicia não define a senha. Alternativa (permitir) é inócua mas contraria a letra | **DESTACADA** |
| `L-F6-04` | `422 ALVO_NAO_ELEGIVEL` (início: inexistente/inativo/próprio, uniforme); `401 RECUPERACAO_INVALIDA` (conclusão: malformado/inexistente/expirado/consumido/inativo, uniforme) | Precedente `L-04` (`401` para credencial); `422` distingue "bem-formado mas recusado" de `400`/`403` sem virar oráculo | — |
| `L-F6-05` → **`D-2.3D-17`** | "10 **tentativas** / 15 min" lidas literalmente: toda tentativa **admitida** conta, no ato da admissão, qualquer que seja o desfecho | A metade do login diz "falhas"; a da recuperação diz "tentativas". Consequência: não há estado "em voo" separado — a admissão síncrona já é a contagem, e o check-then-act de `F-01` não se reproduz. Alternativa (contar só falhas) é mais permissiva e exigiria reserva em voo como `D-2.3D-13` | **DESTACADA** |
| `L-F6-06` | Na revogação em massa de T-07, `revogada_por_usuario_id` = o **próprio usuário** | `D-2.3D-05` fixa o próprio usuário no logout e nada fixa para T-07; o ator homologado da conclusão é o usuário (`docs/09` §5). Alternativas: `NULL` (afirmaria ação de sistema) ou o Administrador que iniciou (não é quem conclui) | **DESTACADA** |
| `L-F6-07` | Auditoria **somente de sucesso** nos dois eventos; tentativas recusadas não geram evento; a revogação em massa de T-07 **não** emite `usuario.sessao.revogacao` adicional | `docs/09` §5: "resultado necessário? Não" para as duas ações; AUT-004 exige "início e conclusão"; `usuario.sessao.revogacao` tem ator Administrador e cobre a revogação **administrativa** — emiti-la aqui com ator usuário mudaria seu significado. Precedente do logout ("só sucesso") | **DESTACADA** |
| `L-F6-08` | Segredo localizado pelo **hash** (SHA-256 determinístico), sem identificador no contrato de conclusão e sem composição `<id>.<segredo>`; segredo pendente anterior é **expirado** (`expira_em = agora`), não "consumido" | `D-2.3D-08` fixa entropia e persistência do hash, não a localização; `docs/07` §7.1/`D-2.3D-01` declaram a disciplina SHA-256 comum. Registrar consumo de um segredo não usado afirmaria fato falso | — |
| `L-F6-09` | **Extração** de `DimensaoLimite` a partir de `limitador-login.ts`; `LimitadorLogin` passa a compor duas instâncias, com API pública, limites, HMAC e reserva idênticos. Única diferença: a **varredura periódica** de vencidos passa a ser contada/executada por dimensão | Reutilizar o mecanismo revisado da F3 (`F-01`, `F-05`, `F-09`, `F-10`, `F3R-03`) em vez de copiá-lo; usado por exatamente dois consumidores com fonte própria. Suíte da F3 (37) verde sem alteração; cadência de varredura não é parâmetro homologado | — |
| `L-F6-10` | `RELOGIO_SESSAO` reutilizado como relógio da recuperação (validade, consumo, revogação) e exportado pelo `AuthModule` | Uma única fonte de tempo para sessão e recuperação, inclusive sob relógio controlado em teste; mesmo racional do export de `POLITICA_COOKIE_SESSAO` na F4 | — |
| `L-F6-11` | Alvo **inativo** é recusado já no início | AUT-004 lista "usuário inativo" entre as exceções; RN-001; um segredo para conta inativa seria inconcluível. Precedente `L-F5-05` | — |

As quatro decisões **DESTACADAS** têm natureza comportamental comparável a `L-11` (homologada como `D-2.3D-13`) e `L-F5-07`/`L-F5-08` (homologadas como `D-2.3D-14`/`D-2.3D-15`). Este registro **não** as homologa em nome de Bruno: elas são apresentadas para decisão expressa, e a implementação é reversível em qualquer uma delas sem tocar decisão homologada.

> **Atualização de 05/09/2026 (pós-integração).** Bruno decidiu expressamente as quatro. `L-F6-03` e `L-F6-05` foram **promovidas** a `D-2.3D-16` e `D-2.3D-17` (`docs/12` §5.16/§5.17) e passam a ter fonte normativa própria, permanecendo citáveis como aliases históricos. `L-F6-07` **não** foi promovida: decorre diretamente de `docs/09` §5, que responde “resultado necessário? Não” para as duas ações. **`L-F6-06` segue PENDENTE de decisão expressa** — `D-2.3D-05` governa o logout do próprio usuário e não determina a atribuição na revogação em massa de T-07. **Nenhum comportamento mudou por causa dessas decisões.** A tabela acima é preservada como registro do estado no ato da implementação.

### 6-P.8 Segurança — evidência por propriedade

| Propriedade | Como é garantida | Onde é provada |
| --- | --- | --- |
| Enumeração (RN-006) | Conclusão sem identificador no contrato; `401` uniforme para malformado/inexistente/alterado/expirado/consumido/inativo; início `422` uniforme para inexistente/inativo/próprio, com cabeçalhos idênticos; comparação de hash em tempo constante inclusive no caminho de ausência | integração: "MESMO 401 — sem Argon2", "MESMO 422", "usuário INATIVADO" |
| Replay / uso único | `UPDATE ... WHERE consumido_em IS NULL AND expira_em > agora`, `count === 1` ou aborta | "REPLAY" + challenge `C-F6-01` |
| Duplicidade / um pendente | `FOR UPDATE` na linha do usuário + expiração do pendente anterior antes do `INSERT` | "um novo início EXPIRA o anterior" + `C-F6-04`; e, para o `FOR UPDATE` em si, a prova com **barreira** de §6-P.16.2 — que constata em `pg_stat_activity`/`pg_blocking_pids` que o segundo início está de fato esperando o lock. O antigo teste "dois inícios CONCORRENTES" (`Promise.all` sobre HTTP) **não** provava o lock: ele permanecia verde com o `FOR UPDATE` removido, porque o entrelaçamento dependia do scheduler; permanece na suíte como prova de estado final, não de serialização |
| Expiração | 30 min; borda `expira_em > agora` (exatamente no limite = expirado), em memória **e** no `UPDATE` | "um milissegundo antes conclui; EXATAMENTE em 30 min é recusado" + `C-F6-07b` |
| Ordem de locks início × conclusão | ordem única `usuario → segredo_recuperacao_senha → sessões` nas duas operações; T-07 abre com `SELECT ... FOR UPDATE` da linha de `usuario` | §6-P.16.3 — as duas transações reais enfileiradas no mesmo lock, sem `40P01` e sem `500` |
| Concorrência conclusão × conclusão | duas requisições presas numa barreira no Argon2 e liberadas juntas: exatamente uma `204`, uma `401`, uma senha, um evento | "DUAS conclusões SIMULTÂNEAS" |
| Concorrência conclusão × login | rehash do login já condicionado ao digest verificado (`F-04`) | "login concorrente com a senha ANTIGA" |
| Sessões (RN-005/T-07) | todas as `ATIVA` → `REVOGADA` na mesma transação; vencidas → `EXPIRADA`; token antigo obtém `401` em rota real; outros usuários intactos | "TODAS as sessões ATIVA anteriores…", "sessão já vencida…" + `C-F6-02`, `C-F6-08` |
| Abuso (`D-2.3D-06`) | 10/15 min por IP; `429` + `Retry-After`; senha correta também bloqueada; sem banco e sem Argon2 quando bloqueada; janela libera; `X-Forwarded-For` ignorado; payload inválido não conta | bloco "D-2.3D-06 — rate limiting da conclusão" + `C-F6-05` |
| Argon2 só para segredo apto | forma → hash → aptidão antes de `gerarHash`; espiã prova zero chamadas nos inválidos e uma no válido | "sem Argon2" + "controle positivo" |
| Atomicidade / rollback | falha da auditoria ou do hashing ⇒ `500`, segredo pendente, senha antiga, sessões `ATIVA`, **e o mesmo segredo conclui depois** | bloco "T-07 — atomicidade" |
| Segredos fora de log/resposta/auditoria | varredura de todo `console.*` e de `SELECT * FROM evento_auditoria` por segredo, hash, senhas, identificadores e `$argon2`; respostas de erro sem stack/SQL/Prisma | "nenhum segredo em log", "nenhuma resposta de erro carrega…" + `C-F6-06` |
| Identidade do ator | vem do contexto de sessão sob símbolo privado (F4); `atorUsuarioId`/`usuarioId` no corpo são ignorados | "o ator do evento é a identidade da SESSÃO" |
| Contrato fechado | filtro cobre as duas rotas: JSON malformado → `400 REQUISICAO_INVALIDA`; corpo gigante → `413`; falha técnica → `500 FALHA_INTERNA` sem detalhe | integração + `openapi.spec` + `verify:openapi-runtime` |

### 6-P.9 OpenAPI (`D-2.3D-11`)

Contrato `0.2.0` (aditivo). Rotas publicadas: exatamente `/auth/login`, `/auth/logout`, `/auth/recuperacao-senha`, `/auth/recuperacao-senha/concluir`, `/health` — asserção de igualdade exata em `openapi.spec.ts`, `auth.module.integration.spec.ts` e `verify-openapi-runtime.mjs`. Início documenta `201,400,401,403,413,422,500` com `security: sessaoCookie`; conclusão documenta `204,400,401,403,413,429,500` com `Retry-After` no `429` e **sem** `security`. Erros das duas rotas usam um único schema fechado (`ErroRecuperacaoSenhaDto`, 8 códigos). **A única propriedade de resposta com nome da lista proibida em todo o contrato é `IniciarRecuperacaoRespostaDto.segredo`** — a apresentação única homologada por AUT-004 — e as provas a declaram nominalmente em vez de afrouxar a varredura. `novaSenha` existe apenas na requisição de conclusão.

### 6-P.10 Provas medidas — unitárias (sem banco)

`test:api`: **24 suítes · 595 provas** (baseline da F5: 21 · 526; +3 suítes, +69 provas). Novas: `segredo-recuperacao.spec.ts` (geração 256 bits, forma fail-closed, SHA-256 determinístico, comparação, hash sintético); `limitador-recuperacao.spec.ts` (limite 10, janela, `Retry-After`, sem lockout progressivo, IPv4-mapped, contagem na admissão, 40 chamadas síncronas admitem exatamente 10, poda, teto sob flooding, isolamento por processo); `recuperacao-senha-dto.spec.ts` (validação estrutural dos dois corpos, tetos, campos extras ignorados, fronteira do módulo — imports/controllers/exports exatos — e metadata das rotas: permissão `senha.recuperar_terceiro` no início, nenhuma guard na conclusão). `limitador-login.spec.ts` (37) permaneceu **inalterado e verde** após a extração.

### 6-P.11 Provas medidas — integração (PostgreSQL 18 real, `tlf_app`, instância descartável)

`verify:api-integration`: **10 suítes · 383 provas + 2 puladas** (baseline: 9 · 327 + 2; +1 suíte, **+56 provas** — todas em `recuperacao-senha.integration.spec.ts`; as três últimas vieram da rodada corretiva de §6-P.16). Cobertura por bloco: início — caminho feliz (5), autenticação/autorização/CSRF (5), rejeições uniformes e rollback (8), um pendente por usuário incluindo concorrência (3); conclusão — caminho feliz (8), replay/expiração/inválido/inativo/uniformidade (11), rate limiting (5), atomicidade/rollback/concorrência (4), log (1), contrato × runtime (2), além do ciclo completo início → conclusão → novo início → nova conclusão e da autenticação real com a nova senha pela fronteira da F3. As 2 puladas são as provas de sinal POSIX já registradas desde a F5 (executam no Linux da CI).

### 6-P.12 Mutation challenges — 11 aplicados, **8 detectados individualmente**, 3 cobertos por desafio combinado, 11 revertidos

Cada mutação foi aplicada ao código de produção, a suíte de integração da F6 executada contra banco descartável, a falha confirmada e o arquivo **restaurado com conferência de SHA-256**.

| # | Mutação | Detectado | Provas que falham |
| --- | --- | --- | --- |
| `C-F6-01` | consumo sem `consumido_em IS NULL` | ✅ 1 | duas conclusões simultâneas |
| `C-F6-02` | conclusão sem revogar sessões | ✅ 4 | sessões REVOGADA; ociosa EXPIRADA; rollback; concorrência |
| `C-F6-03` | pré-verificação ignora `usuario.ativo` | ⚠️ mascarada pela 2ª barreira (`ativo: true` no `UPDATE`) | — |
| `C-F6-03b` | `UPDATE` da senha sem `ativo: true` | ⚠️ mascarada pela 1ª barreira | — |
| `C-F6-03c` | **ambas** as barreiras removidas | ✅ 1 | usuário INATIVADO após a emissão |
| `C-F6-04` | novo início não expira o pendente anterior | ✅ 2 | um pendente; inícios concorrentes |
| `C-F6-05` | gate da conclusão desligado | ✅ 5 | todo o bloco de rate limiting |
| `C-F6-06` | segredo persistido em claro | ✅ 21 | hash persistido + todo caminho de conclusão |
| `C-F6-07` | borda de expiração `<=` → `<` na pré-verificação | ⚠️ mascarada pelo `expira_em > agora` do `UPDATE` | — |
| `C-F6-07b` | **ambas** as bordas afrouxadas | ✅ 4 | expiração exata; pendente único; sem evento em recusa |
| `C-F6-08` | revogação em massa sem fechar vencidas como `EXPIRADA` | ✅ 1 | sessão ociosa fechada como EXPIRADA |

**Leitura exata da matriz, sem arredondamento:** dos 11 desafios aplicados, **8 foram detectados individualmente** (`C-F6-01`, `C-F6-02`, `C-F6-03c`, `C-F6-04`, `C-F6-05`, `C-F6-06`, `C-F6-07b`, `C-F6-08`) e **3 — `C-F6-03`, `C-F6-03b` e `C-F6-07` — foram MASCARADOS individualmente**, isto é, a suíte permaneceu verde com a mutação isolada aplicada. A propriedade que cada um deles ataca só é observada pelos desafios **combinados** correspondentes (`C-F6-03c` para a situação da conta, `C-F6-07b` para a borda de expiração), que removem as duas barreiras ao mesmo tempo. Todos os 11 foram revertidos com conferência de SHA-256.

O mascaramento **não** é, por si, fraqueza das provas — ele mede que aptidão e situação da conta são verificadas em **duas** barreiras independentes (memória e predicado SQL), cada uma suficiente sozinha. Mas também é um fato declarado, e não convertido em "11 detectados": **nenhuma prova desta suíte falha se apenas uma das duas barreiras for removida**, e essa é a informação que um revisor precisa ter.

### 6-P.13 Bateria integral — host Windows, 03/09/2026 (reexecutada por inteiro após a rodada corretiva de §6-P.16)

Ambiente: Node 24.18.0 · npm 11.16.0 · win32-x64 · PostgreSQL 18 em instâncias descartáveis (Docker) · Argon2 nativo carregando no host (estado medido desde 29/08/2026).

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` | 0 | raiz + `packages/database` + `apps/api` (`tsconfig.json` e `tsconfig.test.json`) |
| `npm run build` | 0 | ESM (`packages/database` → `apps/api`) |
| `npm run test:api` | 0 | **24 suítes · 595 passed · 0 failed · 0 skipped** |
| `npm run verify:api-integration` | 0 | **10 suítes · 383 passed · 2 skipped** (sinais POSIX) · 0 failed; 0 bancos/contêineres/volumes remanescentes |
| `npm run test:integration` | 0 | **10 suítes · 87 passed** (persistência; banco descartável na instância dev, destruído) |
| `npm run verify:from-scratch` | 0 | **10 suítes · 87 passed** — replay integral do histórico em instância limpa |
| `npm run verify:argon2-runtime -w @techlab-fisio/api` | 0 | **15/15** verificações sobre o `dist/` ESM |
| `npm run verify:openapi-runtime -w @techlab-fisio/api` | 0 | **19/19**. A base efetiva anterior era **16** verificações (`conferir(...)` no script), não 17: o literal `17` impresso pelo script era histórico e já divergia da contagem real. A F6 acrescentou **3** (status do início, status da conclusão, propriedades de `IniciarRecuperacaoRespostaDto`) e não removeu nenhuma: **16 + 3 = 19**. A contagem passou a ser **dinâmica** (incrementada em `conferir`), o que elimina a fonte da divergência |
| `npm run smoke:api` | 0 | processo real `node dist/main.js`: `/health` 200; 404 sem stack; `/openapi.json` com as rotas F3+F6; CSRF 403; fail-closed sem `TLF_AMBIENTE`; encerramento limpo |
| `npm run lint:migrations` | 0 | Guarda 1 — 10 migrations · 37 objetos protegidos |
| `npm run schema:verify` | 0 | Guarda 3 — dump byte a byte idêntico ao golden (60 169 bytes); `migrate diff --exit-code` = 0 |
| `git diff --check` | 0 | limpo |

**Zero drift de persistência**: `git diff caf2280 -- packages/` **vazio**; 10 migrations, nenhuma nova; `schema.prisma`, golden e `protected-objects.json` intactos. `prisma format`, `migrate dev`, `db push` e `db pull` não foram executados. Higiene: nenhum contêiner `techlab-fisio-apiit-*`/`smoke-*`/`e15-*`/`e16-*`, nenhum volume e nenhum banco `techlab_fisio_it_%` remanescentes ao final; o banco de desenvolvimento não foi alterado.

### 6-P.14 Riscos, limites e pendências desta fatia

| Item | Severidade | Situação |
| --- | --- | --- |
| Decisões locais `L-F6-03`, `L-F6-05`, `L-F6-06`, `L-F6-07` | **ENCERRADO em 05/09/2026** | Natureza comportamental (precedente `L-11`/`L-F5-07`/`L-F5-08`); implementadas na alternativa conservadora e reversíveis. Decididas expressamente por Bruno: `L-F6-03` → `D-2.3D-16` e `L-F6-05` → `D-2.3D-17` (`docs/12` §5.16/§5.17); `L-F6-07` mantida como local. **`L-F6-06` SEGUE PENDENTE** de decisão expressa. Detalhe em §6-P.18.4 |
| Bloqueio administrativo sem via de recuperação (§6-N.6) | **RISCO MÉDIO — PERMANECE** | A F6 exige um Administrador **autenticado e ativo** para iniciar. Se a única conta administrativa perder a credencial, o produto continua sem via interna; o runbook manual de §6-N.6 segue vigente |
| Localização do segredo por `hash_segredo` sem índice | **LIMITAÇÃO DECLARADA** | `segredo_recuperacao_senha` tem apenas PK e FKs; a busca por hash é sequencial. Volume esperado: no máximo um pendente por usuário + histórico; inócuo no MVP. Criar índice exigiria migration e decisão própria — não antecipado |
| Contadores por IP em memória | herdado | `R-2.3D-02`/`P-2.3D-06` — restart zera; atrás de NAT o orçamento de 10/15 min é compartilhado (mesma limitação aceita do login) |
| Cadência da varredura do limitador por dimensão (`L-F6-09`) | **OBSERVAÇÃO** | Entradas vencidas da dimensão de IP do login podem permanecer mais tempo até a poda por leitura; sem efeito de decisão (poda em toda leitura preservada) |
| AUT-005 / RN-001 | herdado | NÃO MATERIALIZADA; a recusa de alvo inativo apenas lê `usuario.ativo` |
| `docs/12` §9 linha F6 | **ENCERRADO em 05/09/2026** | Passou a **CONCLUÍDA** com a integração na `main` (merge `cbd02eb`, PR #20) — `docs/12` REV. 8 |

Pendências herdadas e **não** alteradas: `P2.2-05`, `R2.2-04`, `P-BACK-01`, `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `L-05`..`L-08`, `R-BL-09`, `V-06.c`, `F-2.3C-REV-02/03`, `F-12`, `F3R-06/07`, `F5H-03`..`F5H-07`, RBAC/`profissionais.gerenciar`, lacunas de tradução `docs/04` §4 → §5, higiene de formatação do `schema.prisma`.

### 6-P.16 Rodada corretiva final da F6 — deadlock `iniciar × concluir` e poder de mutação das provas de lock (03/09/2026)

Rodada **exclusivamente corretiva**, sobre a mesma working tree não commitada e a mesma baseline `main` = `origin/main` = `caf2280`, respondendo aos achados `M-01`, `M-02` e `B-01`/`B-02`/`B-03` da revisão técnica independente. **Nenhuma expansão funcional, nenhuma decisão normativa, `docs/12` não tocado, Base Imutável intacta, zero drift de persistência, nenhuma dependência nova, nenhum contrato HTTP/OpenAPI alterado.** As decisões pendentes `L-F6-05`, `L-F6-06` e `L-F6-07` **não** foram implementadas nem resolvidas: o comportamento vigente foi preservado.

#### 6-P.16.1 `M-01` — deadlock entre `iniciar` e `concluir` (corrigido)

**Causa.** As duas operações tocam o MESMO par de linhas — a do usuário e a do segredo — e o faziam em ordens **inversas**:

| | 1º lock | 2º lock | 3º lock |
| --- | --- | --- | --- |
| `iniciar` (ordem antiga e atual) | `usuario` (`SELECT ... FOR UPDATE`) | `segredo_recuperacao_senha` (`UPDATE ... expira_em`) | — |
| `concluir` / T-07 — **ordem ANTIGA** | `segredo_recuperacao_senha` (`UPDATE ... consumido_em`) | `usuario` (`updateMany`) | `sessao_autenticacao` |
| `concluir` / T-07 — **ordem NOVA** | `usuario` (`SELECT ... FOR UPDATE`) | `segredo_recuperacao_senha` | `sessao_autenticacao` |

Com a ordem antiga, um início e uma conclusão simultâneos para o mesmo usuário fechavam o ciclo de espera e o PostgreSQL abortava um dos lados com **`40P01` (deadlock detected)** — que, atravessando o filtro de erro, virava `500 FALHA_INTERNA` para um cliente que não errou em nada.

**Correção.** Ordem **única e global** para o módulo — `usuario → segredo_recuperacao_senha → sessões` —, coincidente com a lista de tabelas de T-07 em `docs/07` §24.2. A transação T-07 passa a abrir com o lock da linha de `usuario`:

```ts
const travados = await tx.$queryRaw<Array<{ id: string }>>`
  SELECT id FROM usuario WHERE id = ${candidato.usuarioId}::uuid FOR UPDATE
`;
if (travados.length !== 1) throw new ErroSegredoSuperado();
```

A causa foi removida **na origem**: nenhuma captura de `40P01`, nenhum retry, nenhum `advisory lock`. Preservados sem alteração: segredo de uso único (o `UPDATE` condicional continua sendo o único árbitro), atomicidade integral de T-07, Argon2 fora da transação, desfecho uniforme para segredo inexistente/expirado/consumido/inválido, ausência de enumeração, autoria e auditoria, semântica da revogação de sessões e os contratos HTTP/OpenAPI. A linha ausente (usuário removido entre a pré-verificação e a T-07) colapsa no mesmo `RECUPERACAO_INVALIDA`.

**Reprodução mecânica da causa.** Sonda SQL sobre o schema real, em instância descartável, executando os dois passos de cada lado nas duas ordens, três rodadas:

```text
rodada 1 — ordem ANTIGA: [40P01:deadlock detected, ok] · ordem NOVA: [ok, ok]
rodada 2 — ordem ANTIGA: [40P01:deadlock detected, ok] · ordem NOVA: [ok, ok]
rodada 3 — ordem ANTIGA: [40P01:deadlock detected, ok] · ordem NOVA: [ok, ok]
```

#### 6-P.16.2 `M-02` — a prova do `FOR UPDATE` de `iniciar`, agora com poder

**Deficiência do teste antigo.** "dois inícios CONCORRENTES" disparava dois `POST` com `Promise.all` e conferia apenas o estado final. O entrelaçamento era decidido pelo scheduler, que na prática serializava as requisições: **a suíte permanecia verde com o `FOR UPDATE` de `iniciar` removido**. O teste continua na suíte — ele mede um estado final legítimo —, mas deixou de ser citado como prova do lock.

**Nova prova, com barreira.** **Ordem de locks — dois INÍCIOS serializam no FOR UPDATE de `usuario`**:

1. o primeiro `iniciar` entra na transação e adquire o `FOR UPDATE` da linha do usuário;
2. uma **barreira** no `AuditWriter` — último passo de `iniciar`, portanto já sob o lock e antes do commit — impede que ele finalize;
3. o segundo `iniciar` para o mesmo alvo é disparado;
4. o teste **constata positivamente o bloqueio**, consultando `pg_stat_activity` com `pg_blocking_pids()` até existir um backend efetivamente à espera de lock, e confere que o segundo não alcançou o próprio evento de auditoria;
5. a barreira é aberta e ambos terminam com `201`;
6. estado persistido: dois segredos emitidos, **exatamente um pendente**, dois eventos `usuario.senha.recuperacao_iniciada`.

A espera é **balizada e com mensagem própria** (`Tempo esgotado (3000 ms) esperando ...`): o fracasso é atribuível à condição violada, não ao timeout global do Jest.

#### 6-P.16.3 Prova nova de `iniciar × concluir`

`Ordem de locks — INÍCIO × CONCLUSÃO concorrentes não produzem deadlock (M-01)`, dois testes. O entrelaçamento é **controlado**, não sorteado: uma transação de teste ("porta de largada") detém a linha de `usuario`; as duas operações reais são disparadas em sequência conhecida e o teste espera, de novo por `pg_blocking_pids()`, que cada uma tenha **entrado na fila do lock** antes de disparar a seguinte. Como a fila de espera por lock de linha do PostgreSQL é FIFO, a ordem de saída é determinística.

- **início 1º na fila** — exatamente o entrelaçamento que a ordem antiga transformava em deadlock. Medido: nenhum `40P01`, nenhum `500 FALHA_INTERNA`, `201` para o início e `401 RECUPERACAO_INVALIDA` uniforme para a conclusão (o início expirou o segredo apresentado, e o predicado do `UPDATE` casou zero linhas). Invariantes conferidos: senha inalterada, nenhum segredo consumido, exatamente um pendente, sessão anterior ainda `ATIVA` e utilizável, nenhum evento `usuario.senha.recuperacao_concluida`, nenhuma transação parcialmente aplicada;
- **conclusão 1ª na fila** — `204` para a conclusão e `201` para o início seguinte; T-07 aplicada por inteiro (nova senha autentica, sessões revogadas, um evento de conclusão) e o início posterior não desfaz nada dela.

#### 6-P.16.4 Desafios de mutação desta rodada

| # | Mutação temporária | Detectada | Como falhou |
| --- | --- | --- | --- |
| `C-F6-09` (`R8` revisitado) | `FOR UPDATE` removido do `SELECT` de `iniciar` | ✅ **2 provas** | `Ordem de locks — dois INÍCIOS...` falhou em ~3 s com a mensagem própria da espera balizada ("Tempo esgotado (3000 ms) esperando o segundo início ficar bloqueado na fila do lock de `usuario`") — sem o lock nada bloqueia; e `Ordem de locks — INÍCIO × CONCLUSÃO ... conclusão 1ª na fila` falhou com `500` no início |
| `C-F6-10` | ordem ANTIGA de locks restaurada em T-07 (lock de `usuario` removido do início da transação) | ✅ **1 prova** | `Ordem de locks — INÍCIO × CONCLUSÃO ... início 1º na fila` falhou em ~3,5 s em `expect(respostaConclusao.status).not.toBe(500)`, com `PrismaClientKnownRequestError` (`40P01`) registrado pela fronteira de autenticação — falha **determinística por violação do invariante**, não por timeout do Jest |

Ambas as mutações foram revertidas com **conferência de SHA-256** do arquivo (`ec00fffeb22b00c841dddd668ee4684412a1622befc5b33be7b1f69bf56ae245`). Nenhuma mutação, spec auxiliar ou arquivo temporário permaneceu na árvore.

#### 6-P.16.5 Correções documentais

| Achado | O que foi corrigido |
| --- | --- |
| `B-01` | §6-P.12 deixou de afirmar "11 aplicados, 11 detectados". A redação exata é **11 aplicados, 8 detectados individualmente, 3 mascarados individualmente e cobertos pelos desafios combinados correspondentes, 11 revertidos** — e declara que nenhuma prova falha se apenas uma das duas barreiras for removida |
| `B-02` | §6-P.13 deixou de afirmar "17 anteriores + 3". A base efetiva anterior era **16** verificações; o literal `17` impresso pelo script era histórico e já divergia da contagem real. `16 + 3 = 19`. Nenhum teste foi alterado para "fazer a conta bater" — a contagem passou a ser dinâmica |
| `B-03` | §6-P.8 deixou de citar "dois inícios CONCORRENTES" como evidência de que o `FOR UPDATE` estava mecanicamente provado; aponta agora a prova com barreira de §6-P.16.2 e declara que o teste antigo permanecia verde sob a mutação |

`B-04`, `B-05` e `B-06` **não** foram convertidos em alteração de código nesta rodada.

#### 6-P.16.6 Arquivos alterados nesta rodada

| Arquivo | Finalidade |
| --- | --- |
| `apps/api/src/recuperacao-senha/recuperacao-senha.service.ts` | `M-01`: lock da linha de `usuario` no início da T-07; bloco "ORDEM DE LOCKS" no cabeçalho e ajuste da ordem vinculante no JSDoc de `concluir`. Nenhuma outra mudança de comportamento |
| `apps/api/test/integration/recuperacao-senha.integration.spec.ts` | `M-02` + prova de `M-01`: três testes novos com barreira e constatação de bloqueio via `pg_stat_activity`/`pg_blocking_pids`, mais os utilitários `esperarAte`, `backendsBloqueadosEmLock` e `segurarLinhaDoUsuario` (cliente próprio pela fábrica pública, encerrado em `afterAll`) |
| `docs/10-backend-implementacao.md` | `B-01`, `B-02`, `B-03`, esta §6-P.16 e as contagens remedidas |

Nenhum outro arquivo foi tocado. `AGENTS.md` e as demais alterações preexistentes da working tree foram preservadas.

### 6-P.17 Rodada corretiva pós-PR — `M-03`, credencial superada e emissão de sessão (05/09/2026)

Rodada **exclusivamente corretiva**, sobre a branch já publicada, respondendo ao
achado **P1** da revisão automatizada (Codex) na PR #20. **Nenhuma expansão
funcional, nenhuma decisão normativa, `docs/12` não tocado, Base Imutável
intacta, zero drift de persistência, nenhuma dependência nova, nenhum contrato
HTTP/OpenAPI alterado.**

#### 6-P.17.1 `M-03` — login em voo emitia sessão sobrevivente à recuperação (corrigido)

**Causa.** `AutenticacaoService.autenticar` lê o `senha_hash` corrente numa
transação curta, gasta ~40 ms no `verify` Argon2 **fora** de transação e só
então abre a transação que emite a sessão. A reconferência do digest existia
**apenas** no caminho de REHASH (`updateMany` condicionado a `senhaHash =
hashVerificado`, correção `F-04`); o caminho comum — a esmagadora maioria dos
logins, cujo digest está vigente — emitia a sessão **sem reconferir nada**.

**Efeito medido.** Uma conclusão de recuperação que coubesse nessa janela
trocava a senha e revogava todas as sessões `ATIVA`; o login em voo, já
validado contra a credencial **superada**, emitia a sua **logo depois** da
revogação em massa. Quem conhecesse a senha antiga terminava com sessão viva
após a recuperação — exatamente o que RN-005/T-07 existem para impedir.

O cabeçalho de `recuperacao-senha.service.ts` afirmava que "uma sessão de login
concorrente jamais ressuscita a senha antiga". A afirmação era verdadeira
quanto ao **rehash** (o digest novo nunca era sobrescrito) e **falsa** quanto à
**emissão da sessão** — que é a propriedade que RN-005 protege. A prova então
existente (`login concorrente com a senha ANTIGA não ressuscita a credencial
superada`) é **sequencial**: verifica o estado depois da conclusão e não
entrelaça nada, de modo que não tinha poder algum sobre este caminho.

**Correção — na origem, sem retry e sem captura de SQLSTATE.** A transação que
emite a sessão passa a abrir por uma guarda de credencial corrente
**incondicional**:

```sql
SELECT id FROM usuario
 WHERE id = $1 AND ativo = true AND senha_hash = $2
   FOR UPDATE
```

`count !== 1` levanta a sentinela `ErroCredencialSuperada` já existente, que o
fluxo converte no **mesmo `401` uniforme** de qualquer outra rejeição — nenhum
contrato muda e o cliente não aprende que houve concorrência. O predicado
inteiro é avaliado pelo PostgreSQL sob o lock da própria linha: sob READ
COMMITTED, uma transação concorrente que esteja alterando a linha faz o
`SELECT` esperar e **reavaliar** o predicado sobre a versão commitada. O digest
não é trazido para a aplicação.

**Ordem de locks preservada.** O login passa a adquirir `usuario →
sessao_autenticacao`, a **mesma** ordem relativa de `concluir` (`usuario →
segredo_recuperacao_senha → sessões`). Não há ciclo de espera possível, e as
duas ordens de chegada são corretas: se o login vence o lock, sua sessão nasce
antes e é revogada pela recuperação em seguida; se a recuperação vence, o login
encontra o digest novo e é recusado.

**Escopo.** Um único arquivo de `src/` alterado
(`apps/api/src/auth/autenticacao.service.ts`), sem tocar schema, contrato,
OpenAPI, política de sessão nem o caminho de rehash — que permanece como
defesa em profundidade.

#### 6-P.17.2 Prova nova

`M-03 — login EM VOO com a senha antiga não obtém sessão que sobreviva à
recuperação`, em `recuperacao-senha.integration.spec.ts`. O entrelaçamento é
**determinístico**, não disputado no scheduler: o login é congelado no ponto
exato — depois do `verify`, antes da transação — e só é liberado quando a
conclusão já commitou. Verifica `401`, ausência de cookie de sessão, ausência
de qualquer sessão `ATIVA` do usuário ao final e que só a senha nova autentica.

**Poder de mutação medido:** contra a árvore **sem** a correção a prova falha
(`Expected: 401 / Received: 200`); com a correção, passa. `verify:api-integration`
passa de **383** para **384** provas.

#### 6-P.17.3 Correção documental

`L-F6-07A` — identificador que **nunca existiu** na tabela de §6-P.7 — corrigido
para `L-F6-07` nas duas ocorrências (cabeçalho e REV. 31, item (h)).

### 6-P.18 Registro pós-medição da integração

Registro **exclusivamente factual** do rito, no precedente MEDIR → REGISTRAR das REV. 10, REV. 15, REV. 20, REV. 24 e REV. 29 (§6-I.8, §6-L.8, §6-O.8). **Esta seção não cria, altera ou reabre decisão alguma.** As decisões `D-2.3D-16` e `D-2.3D-17`, homologadas em 05/09/2026, são registradas em `docs/12` §5.16/§5.17 — não aqui.

**Autoridade.** Integração executada em 05/09/2026 por autorização expressa de Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1) para integrar a F6 **no estado corrigido de §6-P.17** — sem reimplementação, sem reabertura de decisão e sem início da F7.

| Item | Valor |
| --- | --- |
| `main` antes | `caf22804d8438071932d9abc57904aa428684eac` |
| Commit 1 — implementação + testes + documentação | `a60fe696245038599bf868b42206dd9828250b63` — `feat(recuperacao-senha): F6 — recuperação segura de senha (AUT-004, D-04, RN-005, T-07)` (24 arquivos, +3817/−487) |
| Commit 2 — correção `M-03` pós-review | `f6f507f44dc0392824efe53c201ba9ae129e1fb5` — `fix(auth): M-03 — reconferir a credencial corrente ao emitir a sessão` (3 arquivos, +187/−2) |
| Pull request | [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20) |
| HEAD validado pela CI e mergeado | `f6f507f44dc0392824efe53c201ba9ae129e1fb5` |
| Merge commit | `cbd02eba39bc83d58c09c635b0e7f3b28816adbb` |
| `main` depois | `cbd02eba39bc83d58c09c635b0e7f3b28816adbb` |
| Método | **merge commit** — sem squash, sem rebase, sem force-push |
| Instante do merge | 05/09/2026 07:36:03Z (04:36:03 −03:00) |

**Dois commits, e o segundo tem causa.** O primeiro versionou a árvore inteira de §6-P.16 — implementação, testes e documentação — sem rearranjo. O segundo existe **exclusivamente** pelo achado `M-03`, levantado pela revisão automatizada **depois** da abertura da PR e tratado em §6-P.17; ele altera um arquivo de `src/`, um de teste e `docs/10`.

**Genealogia conferida** — `git show --no-patch cbd02eb`:

```text
merge ........ cbd02eba39bc83d58c09c635b0e7f3b28816adbb
parent 1 ..... caf22804d8438071932d9abc57904aa428684eac   (main antes)
parent 2 ..... f6f507f44dc0392824efe53c201ba9ae129e1fb5   (fatia F6 corrigida)
```

`git diff f6f507f cbd02eb` é **vazio**: a árvore integrada é byte a byte a árvore validada pela CI.

**Proteção contra corrida.** Imediatamente antes do merge, HEAD local, HEAD remoto da branch e `headRefOid` do PR coincidiam em `f6f507f` — o mesmo SHA da run verde —, o PR estava `MERGEABLE` / `CLEAN`, `reviewDecision` vazio (nenhuma mudança solicitada) e `origin/main` permanecia em `caf2280` desde o gate inicial.

#### 6-P.18.1 Cronologia do rito — sete passos, na ordem em que ocorreram

O registro preserva a ordem real dos fatos; **a correção `M-03` não existia na implementação original**.

| # | Passo | Evidência |
| --- | --- | --- |
| 1 | Implementação da F6, medida em branch própria | §6-P.1..§6-P.15; commit `a60fe69` |
| 2 | Publicação da branch e abertura do PR [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20); CI verde sobre `a60fe69` | run [33951970796](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33951970796) — **success**, 3m44s |
| 3 | Revisão automatizada devolve achado **P1** sobre `a60fe69` | [comentário inline](https://github.com/BrunoMNoronha/techlab-fisio/pull/20#discussion_r3939847915) |
| 4 | Reprodução do TOCTOU por prova com entrelaçamento determinístico | falha medida `Expected: 401 / Received: 200` (§6-P.17.2) |
| 5 | Correção na origem — guarda de credencial corrente incondicional | commit `f6f507f` (§6-P.17.1) |
| 6 | CI verde sobre o SHA corrigido | run [33952810239](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33952810239) — **success**, 3m33s |
| 7 | Merge e registro pós-medição | merge `cbd02eb`; esta seção |

A run do passo 2 **não** validou a árvore integrada: ela pertence a `a60fe69`, SHA superado pela correção. A única run que vale para o HEAD mergeado é a do passo 6.

#### 6-P.18.2 Medições da CI sobre o HEAD integrado

Run [33952810239](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33952810239) — **success** sobre `f6f507f`, job único `E-16 — tríade anti-drift + reconstrução from-scratch + suíte integral`, **3m33s** (07:31:48Z → 07:35:24Z), todos os passos verdes:

| Etapa | Resultado |
| --- | --- |
| Guarda 1 — lint de migrations sobre objetos protegidos | `OK — nenhuma remoção de objeto protegido detectada` |
| E-15 + Guarda 2 — reconstrução from-scratch | **10 suites · 87 passed** |
| Guarda 3 + alarme — golden byte a byte e `migrate diff --exit-code` | `OK — dump byte a byte idêntico ao golden versionado (60169 bytes)` |
| Provas de runtime — Argon2id e OpenAPI no ESM compilado | verdes · OpenAPI `19 verificações OK` |
| Suíte de `apps/api` | **24 suites · 595 passed** |
| Exports público de `@techlab-fisio/database` (F-01) | verde |
| **Integração com PostgreSQL 18 real** | **10 suites · 386 passed** (nada pulado — Linux) |
| Smoke ESM real (R-BL-02) | verde |

As contagens da CI no Linux coincidem com as medidas no host Windows, com a única diferença **declarada** das 2 provas de sinal POSIX, que o host pula e a CI executa: **386 = 384 + 2**.

#### 6-P.18.3 Resultado da integração

- **AUT-004 MATERIALIZADA** e integrada na `main`; **RN-005** satisfeita pela conclusão da recuperação, com a revogação em massa agora protegida também contra login em voo (`M-03`);
- `D-2.3D-08` e a segunda metade de `D-2.3D-06` materializadas; `D-2.3D-16` e `D-2.3D-17` homologadas e registradas em `docs/12`;
- **zero drift de persistência**: nenhuma migration, coluna, índice, enum ou constraint; golden byte a byte idêntico;
- **nenhuma dependência nova**; nenhum canal de e-mail/SMS/WhatsApp;
- contrato OpenAPI em `0.2.0`, acréscimo **aditivo** de duas rotas; nenhuma operação anterior alterada;
- **AUT-005 permanece NÃO MATERIALIZADA**; **F7 NÃO INICIADA**.

#### 6-P.18.4 Decisões locais — situação após a integração

| Decisão | Situação |
| --- | --- |
| `L-F6-03` | **PROMOVIDA** a `D-2.3D-16` (`docs/12` §5.16) em 05/09/2026. Permanece citável como alias histórico |
| `L-F6-05` | **PROMOVIDA** a `D-2.3D-17` (`docs/12` §5.17) em 05/09/2026. Permanece citável como alias histórico |
| `L-F6-06` | **NÃO promovida — PENDENTE de decisão expressa.** A implementação vigente é preservada. `D-2.3D-05` governa o **logout do próprio usuário** e **não** determina `revogada_por_usuario_id` na revogação em massa de T-07; a linha de §6-P.7 continua correta ao registrar que nada fixa esse valor para T-07 e ao listar `NULL` e o Administrador que iniciou como alternativas. A analogia com o logout é **argumento**, não decisão homologada — a ambiguidade comportamental segue aberta |
| `L-F6-07` | **NÃO promovida** — mantida como decisão local. `docs/09` §5 responde expressamente "resultado necessário? Não" para as duas ações; e uma conclusão recusada por segredo inválido não localiza usuário algum, de modo que não haveria ator nem `alvo_id` para preencher sem violar `D-AUD-03` |
| `L-F6-01`, `L-F6-02`, `L-F6-04`, `L-F6-08`..`L-F6-11` | Mantidas como decisões locais reversíveis, sem destaque para decisão expressa |

### 6-P.15 Estado

```text
F6 IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA
RODADA CORRETIVA FINAL APLICADA (M-01, M-02, B-01/B-02/B-03 — §6-P.16)
NÃO HOMOLOGADA
NÃO INTEGRADA

branch: agent/fase2-etapa2.3d-f6-recuperacao-senha (a partir de main = origin/main = caf2280)
commit: NÃO · push: NÃO · PR: NÃO · merge: NÃO · deploy: NÃO · tag/release: NÃO

AUT-004 = MATERIALIZADA NESTA BRANCH (sujeita a revisão independente e homologação)
AUT-005 = NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA
RN-005  = satisfeita pela conclusão da recuperação (provada); RN-001 segue como em §9
docs/12 = NÃO TOCADO
F7      = NÃO INICIADA
```

**Estado superado — o bloco acima é o snapshot do encerramento de §6-P.16, preservado como evidência temporal.** O estado consolidado após a rodada corretiva de §6-P.17 e a integração de §6-P.18 é:

```text
F6 INTEGRADA NA `main` EM 05/09/2026
CORREÇÃO M-03 APLICADA ANTES DO MERGE (§6-P.17)

merge: cbd02eb (PR #20) · HEAD integrado: f6f507f · método: merge commit
CI verde sobre o HEAD integrado (run 33952810239)

AUT-004 = MATERIALIZADA E INTEGRADA
AUT-005 = NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA
RN-005  = satisfeita pela conclusão da recuperação; RN-001 segue como em §9
docs/12 = D-2.3D-16 e D-2.3D-17 acrescentadas em 05/09/2026 (L-F6-03, L-F6-05)
L-F6-06 = PENDENTE de decisão expressa (atribuição de revogada_por na T-07)
F7      = NÃO INICIADA
```

## 6-Q. Etapa 2.3D-B / F7 — consolidação, revisão independente e encerramento da Etapa 2.3D

Última fatia da Etapa 2.3D (`docs/12` §9: "Consolidação, revisão independente e rito de integração"). Executada em 05/09/2026 a partir de `main` = `origin/main` = `50412d9`. **Nenhuma expansão funcional e nenhuma alteração de código.**

**Resultado: a Etapa 2.3D é ENCERRADA.** A revisão independente **não encontrou defeito de código novo** e nenhuma alteração de código foi necessária. O achado `Q-01` — um suposto conflito entre `docs/09` §5 e `docs/06` §12.7 — foi resolvido pela apuração da **governança documental** de `docs/09`, que retira valor normativo à linha invocada; **`docs/09` não foi alterado**. `L-F6-06` foi promovida a `D-2.3D-18`; `L-F6-07` permanece decisão local, com a metade não inequívoca registrada como `Q-02`, não bloqueante.

### 6-Q.1 Estado recebido de F1..F6

F1..F6 integradas na `main`; `D-2.3D-01`..`D-2.3D-17` vigentes; AUT-004 materializada. Uma ambiguidade comportamental permanecia deliberadamente aberta — **`L-F6-06`** —, tratada como primeiro gate desta fatia.

### 6-Q.2 `L-F6-06` e `L-F6-07` — apuração, `Q-01` e decisões

A questão foi **reaberta do zero**. A tentativa anterior de encerrá-la por analogia com `D-2.3D-05` havia sido recusada, com razão, pela revisão da PR #21.

**Semântica do campo, apurada no código integrado.** `sessao_autenticacao.revogada_por_usuario_id` é FK anulável para `usuario`, sem CHECK:

| Aspecto | Constatação |
| --- | --- |
| Escritas | **três**, todas em `sessao.service.ts`: `NULL` na emissão (`:206`); o próprio usuário no logout (`:382`); o próprio usuário na revogação em massa da T-07 (`:447`) |
| Leituras por código de aplicação | **nenhuma** — é trilha forense, não insumo de decisão de runtime |
| `NULL` ocorre em | toda sessão `ATIVA` e toda `EXPIRADA` — a transição de expiração **não toca** a coluna |
| Invariante vigente | `estado = 'REVOGADA'` ⟺ coluna preenchida (não imposta por CHECK; verdadeira por construção) |
| Revogação administrativa de terceiro | **não implementada** — `sessoes.revogar_terceiro` (`docs/04` §5.1/§8) não possui rota |

**Os atores da T-07, e quais existem de fato no modelo:**

| Conceito | Existe no modelo? | Representação |
| --- | --- | --- |
| Administrador iniciador | **Sim** | `segredo_recuperacao_senha.criado_por_usuario_id`; ator de `usuario.senha.recuperacao_iniciada` |
| Usuário alvo | **Sim** | `sessao_autenticacao.usuario_id` |
| Executor da conclusão | **Não como identidade** | a rota é sem sessão: prova-se **posse do segredo**, não identidade |
| Sistema | **Não** | não há usuário sintético nem flag; a única representação livre seria `NULL`, que já significa outra coisa |

**Um critério foi cogitado e descartado**: o de que o campo registraria o ator que `docs/09` §5 fixa para o evento correspondente. Ele não decide — a apuração da governança de `docs/09` mostrou que **§5 não é fonte normativa** (ver `Q-01` abaixo).

#### `Q-01` — o suposto conflito, e por que ele não existe

A revisão da PR #22 apontou, **com razão**, que `docs/06` §12.7 define **T-07 = "Recuperação de senha / revogação (M1)"** — a **única** T-07 do projeto. Isso parecia pôr `docs/09` §5 em conflito consigo mesmo:

| Fonte | O que diz |
| --- | --- |
| `docs/09` **§5** | `usuario.sessao.revogacao` — ator **Administrador** — "Revogação administrativa (própria ou **em massa via T-07**)" |
| `docs/09` **§5** | `usuario.senha.recuperacao_concluida` — ator **Usuário** — "Conclusão de D-04 (**T-07**)" |

Duas linhas atribuindo atores diferentes à **mesma** transação, sendo que na conclusão **não existe Administrador autenticado**.

**A governança de `docs/09` dissolve a questão.** O cabeçalho do documento é expresso:

> §§1..11 são preservados **como a proposta original submetida à decisão** (insumo decisório histórico, **sem valor normativo próprio**); **§12 é o registro normativo** da decisão homologada. Onde §12 divergir de §§1..11, **§12 prevalece**.

E §12 repete: "§§1..11 permanecem intactos como proposta histórica; **para efeito normativo, vale exclusivamente esta seção**". `D-AUD-01` (§12.2) homologa **somente os 24 nomes de ações** — não as colunas de ator, descrição, alvo ou "resultado necessário". §12.1 ainda registra que divergências de §5 ficam "preservadas em §5 como proposta histórica e **corrigidas aqui** para efeito normativo".

Ambas as linhas invocadas pertencem a **§5**. Nenhuma vincula. **Não há conflito normativo** — e, portanto, **nenhuma fonte vinculante determina o ator da revogação da T-07**.

**`docs/09` NÃO foi alterado.** A desambiguação que se cogitou fazer em §5 seria contrária à instrução do próprio documento de preservar §§1..11 intactos, e é desnecessária: a regra de precedência já resolve a leitura. O registro da desambiguação, para rastreabilidade, vive em `docs/12` §11 (`Q-01`) e nesta seção.

Confirma-se ainda, pela fonte que **é** normativa: `docs/05` FC-01 §Auditoria lista "revogação **administrativa**" — e a revogação da T-07 não é administrativa (a operação administrativa é `sessoes.revogar_terceiro`, `docs/04` §5.1/§8, **não implementada**). Nenhuma fonte exige emitir `usuario.sessao.revogacao` na conclusão da recuperação.

#### Decisão sobre `L-F6-06` — promovida

Com `Q-01` resolvido, as alternativas se reduzem por **eliminação**, e não por determinação de fonte:

| Alternativa | Situação |
| --- | --- |
| **A — próprio usuário** (vigente) | Único ator **presente no ato**; coincide com o único precedente do campo (`D-2.3D-05`); preserva a invariante `REVOGADA ⟺ preenchido`; derivada da própria linha, impossível forjar. **ADOTADA** |
| B — Administrador iniciador | **Perdeu sua única base** (a tabela não normativa de §5) e é factualmente falsa: a revogação só ocorre se e quando alguém concluir, e pode nunca ocorrer |
| C — `NULL` | Colide com o significado vigente (`ATIVA`/`EXPIRADA`); quebra a invariante; afirmaria "sistema", que o modelo não representa |
| D — coluna/enum de origem | Exigiria migration e drift; o contrato vigente já representa o requisito |

Promovida a **`D-2.3D-18`** (`docs/12` §5.18), **restrita à T-07**, com o fundamento declarado como escolha por eliminação e com o limite de que a conclusão prova **posse do segredo**, não identidade. **Nenhuma alteração de código.** A prova regressiva já existe: `recuperacao-senha.integration.spec.ts:678` e `:701`; `sessao.integration.spec.ts:477`, `:176`/`:424`, `:511`/`:525`.

#### Decisão sobre `L-F6-07` — NÃO promovida

Avaliada **separadamente**, como exige o rito. Ela tem duas metades, e só uma está inequivocamente sustentada:

- **não emitir `usuario.sessao.revogacao` na T-07** — **sustentado**: nenhuma fonte normativa o exige, e `docs/05` FC-01 pede auditoria de revogação **administrativa**, que esta não é;
- **auditar somente o sucesso** — **não inequívoco**: `docs/05` FC-01 lista "falhas relevantes" ao lado de "login bem-sucedido", e a leitura de que isso alcança a recuperação é discutível. Contra a exigência pesam o catálogo de `D-AUD-01`, que **não tem ação** para tentativa de recuperação falha, e o fato de que uma recusa por segredo inválido **não localiza usuário** — não haveria `ator_usuario_id` nem `alvo_id` sem violar `D-AUD-03`.

Como a segunda metade não é inequívoca, **`L-F6-07` permanece decisão local**, com o comportamento vigente preservado, e a questão fica registrada como **`Q-02`** em `docs/12` §11 — **pendência não bloqueante**, por não haver defeito nem violação de fonte vinculante.

### 6-Q.3 Revisão independente de F1..F6 — achados

A revisão percorreu o conjunto integrado, e não apenas o diff recente: autenticação e credencial, rate limiting das duas metades, ciclo de vida da sessão, recuperação de senha, autorização, auditoria e concorrência/transações. Segunda passagem adversarial sobre 17 hipóteses de ataque.

**Nenhum defeito de código novo.** Os defeitos reais da Etapa foram achados e corrigidos nas revisões das próprias fatias — `F-01`, `F-04`, `F-05`, `F-09`, `F-10`, `F3R-03` (F3); `M-01`, `M-02` (F6, pré-PR); **`M-03`** (F6, pós-review da PR #20).

Pontos de maior risco verificados e confirmados corretos:

- **`#registrarAtividade` não é TOCTOU.** O `UPDATE` condicional exige `estado = 'ATIVA' AND expira_em > agora AND ultima_atividade_em > limiteOcioso`. `registrou = true` implica, **atomicamente**, sessão válida.
- **Usuário inativado perde acesso imediatamente.** `PermissoesService.resolverDoUsuario` recusa com `USUARIO_INATIVO` antes de resolver permissões, mesmo com sessão `ATIVA`. A única rota autenticada sem `@RequerPermissao` é `/auth/logout`, para a qual isso é inócuo.
- **Guards fail-closed.** `PermissoesGuard` nega quando não há permissão declarada no handler e quando não há contexto autenticado.
- **Autoria não é parametrizável.** Logout e T-07 derivam `revogada_por_usuario_id` da própria linha (`= usuario_id`), nunca de argumento.
- **`M-03` fecha o último TOCTOU conhecido do login**, e a guarda incondicional cobre também a inativação concorrente (`AND ativo = true`).

**Achados desta fatia:**

| # | Severidade | Achado | Situação |
| --- | --- | --- | --- |
| `Q-01` | Normativo | Suposto conflito entre `docs/09` §5 e `docs/06` §12.7 sobre a auditoria e a autoria da revogação em massa da T-07 | **RESOLVIDO** — §5 não é fonte normativa (governança de `docs/09`); `docs/09` **não** alterado. Decidiu `L-F6-06` → `D-2.3D-18` |
| `Q-02` | P3 (normativo, **não bloqueante**) | A auditoria de **tentativas recusadas** de recuperação não é inequivocamente resolvida por `docs/05` FC-01 ("falhas relevantes") | **ABERTA** — `docs/12` §11. Por isso `L-F6-07` não foi promovida; comportamento vigente preservado |
| `Q-03` | P3 (documental) | `docs/10` §3 descrevia a baseline normativa como `D-2.3D-01`..`D-2.3D-13`, desatualizada desde a F5 | **CORRIGIDO** |
| `Q-04` | P3 (documental) | `P-2.3D-03` constava **ABERTA**, embora medida e verde desde a F3 | **ENCERRADA** em `docs/12` §11; `D-2.3D-11` não alterada |
| `Q-05` | P3 (observação) | A T-07 calcula `agora` em `concluir` e a revogação em massa calcula o seu próprio em `revogarTodasDoUsuarioEm` | **Sem efeito** — a diferença é de microssegundos e a ordem resultante reflete a ordem real das operações. Não corrigido |

### 6-Q.4 Matriz normativa — decisão × implementação × prova

| Regra | Implementação | Prova | Estado |
| --- | --- | --- | --- |
| `D-2.3D-01` persistência de sessão | migration `20260827175151` | guardas 1–3; golden byte a byte | `COBERTA` |
| `D-2.3D-02` Argon2id | `credencial.service.ts` | `verify:argon2-runtime`; benchmark §6-D.5 | `COBERTA` |
| `D-2.3D-03` normalização | `identificador-login.ts` | unitárias + integração | `COBERTA` |
| `D-2.3D-04` política de sessão | `POLITICA_SESSAO` | `sessao.integration.spec.ts` | `COBERTA` |
| `D-2.3D-05` estados terminais | `revogar`/expiração | `:463`, `:511`, `:525` | `COBERTA` |
| `D-2.3D-06` anti-abuso (login) | `LimitadorLogin` + `DimensaoLimite` | `limitador-login.spec.ts` | `COBERTA` |
| `D-2.3D-06` anti-abuso (recuperação) | `LimitadorRecuperacao` | `limitador-recuperacao.spec.ts`; integração | `COBERTA` |
| `D-2.3D-07` cookie e CSRF | `politica-cookie.ts`, `ProtecaoCsrfGuard` | `verify:openapi-runtime` (`F-02`); integração | `COBERTA` |
| `D-2.3D-08` recuperação de senha | `recuperacao-senha/` | integração F6 (56 provas) | `COBERTA` |
| `D-2.3D-09` RBAC inicial | `authz/` | suíte F4 | `COBERTA` |
| `D-2.3D-10` primeiro Administrador | `provisionamento/` | integração F5 | `COBERTA` |
| `D-2.3D-11` OpenAPI | `documento-openapi.ts` | `openapi.spec.ts`; `verify:openapi-runtime` 19/19 | `COBERTA` |
| `D-2.3D-12` auditoria de autenticação | `autenticacao.service.ts` | integração F3 | `COBERTA` |
| `D-2.3D-13` reserva em voo | `DimensaoLimite` | `limitador-login.spec.ts` | `COBERTA` |
| `D-2.3D-14` seed RBAC | `provisionamento/seed` | integração F5 | `COBERTA` |
| `D-2.3D-15` autoria do bootstrap | `provisionamento/bootstrap` | integração F5 | `COBERTA` |
| `D-2.3D-16` início sobre terceiro | `recuperacao-senha.service.ts:197` | `:528` (três motivos, mesmo envelope) | `COBERTA` |
| `D-2.3D-17` "tentativa admitida" | `LimitadorRecuperacao.tentar` | `:888`, `:930` | `COBERTA` |
| `D-2.3D-18` autoria da revogação T-07 | `sessao.service.ts:447` | `:678`, `:701` | `COBERTA` |
| **AUT-001** | login + sessão | integração F3 | `COBERTA` |
| **AUT-002** | logout, expiração, revogação em massa da T-07 | `sessao.integration.spec.ts`; integração F6 | **`PARCIAL`** — revogação administrativa de terceiro e inativação (AUT-005) **não implementadas** |
| **AUT-003** | RBAC por papel e permissão | suíte F4 | **`PARCIAL`** — escopo e recurso (`P2.2-05`, autorização clínica contextual) **NÃO INICIADOS** |
| **AUT-004** | fluxo completo da F6 | integração F6 | `COBERTA` |
| **AUT-006** | `AuditWriter` + validator fail-closed | integração 2.3B/F3 | `COBERTA` |
| **D-04** | início por Administrador; segredo único | integração F6 | `COBERTA` |
| **RN-005** | revogação em massa + `M-03` | `:663`, `M-03` | `COBERTA` |
| **T-07** | transação única | `:952`, `:997`, `:1209` | `COBERTA` — atomicidade, consumo, revogação e evento provados |

**Nenhum item `SEM PROVA` ou `INCONSISTENTE`.** Os dois `PARCIAL` são declarados e **não decorrem de defeito**: ambos são escopo não atribuído (AUT-002 — revogação administrativa e inativação; AUT-003 — escopo/recurso de `P2.2-05`).

### 6-Q.5 Pendências que permanecem abertas

| Pendência | Estado | Razão |
| --- | --- | --- |
| ~~`Q-01`~~ | **RESOLVIDO** | Não havia conflito normativo — `docs/09` §5 é proposta histórica sem valor normativo. `docs/09` não alterado |
| `Q-02` | **ABERTA — não bloqueante** | Auditoria de tentativas recusadas de recuperação. Mantém `L-F6-07` como decisão local |
| `P-2.3D-01` | **ABERTA** | Absorção editorial de colunas em `docs/07` — governança documental separada |
| `P-2.3D-04` | **ABERTA** | Reavaliação do CSRF contra o `apps/web` real, que **não existe** |
| `P-2.3D-05` | **ABERTA** | Eventual auditoria de criação de usuário — exige decisão própria |
| `P-2.3D-06` | **ADIADA** | Rate limit resiliente a restart/múltiplas instâncias (`R-2.3D-02`) |
| `R-2.3D-08` | **ACEITO** | `429` transitório contra usuário legítimo — declarado em `D-2.3D-13` |
| AUT-005 | **NÃO MATERIALIZADA** | Sem fatia atribuída |
| `P2.2-05` | **NÃO INICIADA** | Autorização clínica contextual — escopo/recurso de AUT-003 |

### 6-Q.6 Estado

```text
ETAPA 2.3D — ENCERRADA em 05/09/2026

F0..F7 = CONCLUÍDAS
decisões normativas = D-2.3D-01..D-2.3D-18

L-F6-06 = FECHADA (-> D-2.3D-18)
L-F6-07 = decisão LOCAL mantida; metade não inequívoca registrada como Q-02 (não bloqueante)
Q-01 = RESOLVIDO (docs/09 §5 não é fonte normativa; docs/09 NÃO alterado)
P-2.3D-03 = ENCERRADA

AUT-001, AUT-004, AUT-006 = MATERIALIZADAS
AUT-002 = PARCIAL (sem revogação administrativa de terceiro; sem inativação)
AUT-003 = PARCIAL (RBAC sim; escopo/recurso de P2.2-05 não iniciados)
AUT-005 = NÃO MATERIALIZADA / SEM FATIA ATRIBUÍDA
```

Os dois `PARCIAL` são **escopo não atribuído**, não defeito: nenhuma fatia da Etapa 2.3D os prometeu. Permanecem visíveis no roadmap com dono.

## 7. Auditoria — `P-BACK-01`

### 7.1 Estado

```text
P-BACK-01 — EM ANDAMENTO
```

**Concluído na 2.3A:** catálogo tipado centralizado (24 ações de `D-AUD-01`, conferência mecânica contra `docs/09` §12.2 — iguais e na mesma ordem); catálogo `SUCESSO | NEGADO | FALHA` (`D-AUD-02`, sem enum SQL); representação da regra de `alvo_tipo` (`D-AUD-03` — metadado histórico; sem despacho dinâmico de SQL; não concede acesso; rename não reescreve histórico); whitelist fail-closed exaustiva (`D-AUD-07` — 3 ações com chaves, 21 vazias); enforcement runtime (`D-AUD-08` — ação desconhecida, chave fora da whitelist, contexto não vazio em whitelist vazia e valor não escalar → rejeição explícita; sem sanitização silenciosa; mensagens citam chaves, nunca valores); `T-AUD-CONTEXTO` (§8).

**Concluído na 2.3B (medido; aguardando revisão/integração):** o **primeiro fluxo emissor real** existe — `operação → AuditContextValidator → AuditWriter → evento_auditoria` na **mesma transação** da mutação de negócio, exercitado ponta a ponta contra PostgreSQL real por `profissional.situacao.alterada` (§6-A). O validator está comprovadamente no caminho de escrita real (contexto proibido → rollback da operação inteira).

**Concluído na 2.3C (medido nesta branch; aguardando revisão/integração):** o primeiro fluxo real com **whitelist POSITIVA** — `cobranca.desconto_aplicado` emitindo `contexto` não vazio com o par homologado, ponta a ponta contra PostgreSQL real, com prova positiva (par aceito e persistido) e negativa (chave extra/objeto/array/não finito/ação desconhecida → rollback integral do fluxo de negócio) — §6-C.

**Decidido em 05/09/2026 (`P-BACK-01-D2` — registro normativo em `docs/09` §13, `PBACK-AUD-01`..`PBACK-AUD-08`):** as lacunas que `D-AUD-06` havia adiado e as sub-decisões de catálogo foram resolvidas, **sem alterar catálogo, whitelist, schema ou comportamento** — as 24 ações e as 3 whitelists positivas / 21 vazias permanecem exatamente como estavam.

- `L-05` — **FECHADA** (`docs/09` §13.2): as transições de agenda fora das 4 ações homologadas seguem atribuíveis por `historico_agendamento`; `agendamento.confirmado`, `agendamento.checkin`, `agendamento.falta_registrada`, `agendamento.concluido` e `bloqueio_agenda.criado` permanecem fora do catálogo.
- `L-07` — **REAVALIADA E DECIDIDA em 05/09/2026** (`docs/09` §13.4.1, `PBACK-AUD-09`), depois de a nota de revisão de `docs/09` §13.4 e a errata de §13.1 G-03 registrarem que a premissa de `PBACK-AUD-03` era falsa (`POST /auth/recuperacao-senha` já estava sob `@RequerPermissao("senha.recuperar_terceiro")`) e de o pacote `docs/13` apurar que a negação **não deixava rastro algum**. Decisão: **auditoria RESTRITA** — `autorizacao.negada` **criada** (25ª ação, whitelist vazia), emitida exclusivamente pela negação deliberada de `senha.recuperar_terceiro`, Q2, V0, alvo `permissao`. **Implementada (§7.4) e integrada na `main` em 05/09/2026 — PR #23, merge `e1459f6` (§7.4.8).** *(Histórico preservado: até a decisão, `autorizacao.negada` não existia e o `PermissoesGuard` não emitia auditoria.)*
- `L-08` — **POLÍTICA NORMATIVA FECHADA / MATERIALIZAÇÃO TÉCNICA PENDENTE** (`docs/09` §13.5): são sensíveis, para o gatilho de auditoria, alterações de CPF, responsável legal, consentimentos/bases e situação ativo/inativo. `paciente.cadastro.alterado`, `paciente.situacao.alterada` e `campos_alterados` **não** foram criados — a forma técnica será decidida com o módulo de pacientes.
- `configuracao.alterada` — **FECHADA** (`docs/09` §13.6): ação única, entidade concreta por `alvo_tipo`, abrangência CFG-001..CFG-006, whitelist **vazia**. Limitação declarada: a trilha não preserva necessariamente o estado anterior da configuração.
- `prontuario.exportado` — **FECHADO** (`docs/09` §13.7): `alvo_tipo = "paciente"`, `alvo_id = paciente.id`, uniformemente; nenhuma chave de contexto.
- `autor_original_usuario_id` — **REJEIÇÃO CONFIRMADA** (`docs/09` §13.8): derivável por `registro_original_id → registro_clinico.autor_usuario_id`, sobre valor tornado imutável por `trg_registro_clinico_imutavel_finalizado`. Segue **rejeitada** pelo validator; nenhum código mudou.
- Consulta da trilha (AUD-004) — **política FECHADA, implementação PENDENTE** (`docs/09` §13.9): usará exclusivamente `auditoria.ler`, já homologada; **nenhuma permissão nova**; somente leitura, filtros fechados sobre colunas próprias, paginação obrigatória, sem busca livre e **sem resolver/expandir** `alvo_tipo`+`alvo_id`. O endpoint **não** foi implementado.

**Ainda aberto — `L-06` (acesso a dados clínicos):** **ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA** (`docs/09` §13.3). **Não foi encerrada por escopo.** `TLF-BASE-V1` §10 exige trilha de auditoria para **acesso** a dados sensíveis, de modo que não é permitido concluir que a leitura clínica ordinária ficará sem auditoria no MVP — e **não se registra** que AUD-002 esteja satisfeita por exportação/finalização/retificação. Ao mesmo tempo, a regra não pode ser definida agora: o módulo de prontuário não existe, `P2.2-05` (relação fisioterapeuta↔paciente / escopo) não foi materializada, e não há superfície real sobre a qual medir volume e comportamento. **Retomada obrigatória** antes da disponibilização de qualquer superfície real de leitura de prontuário/dados clínicos sensíveis, vinculada a `P2.2-05` e às rotas de leitura clínica. `prontuario.acessado` **não** foi criado.

### 7.2 `R2.2-04`

```text
R2.2-04 — ABERTO / MITIGADO PARCIALMENTE (reclassificação conservadora determinada pela revisão de F-2.3C-REV-01)
```

*(Correção da REV. 8: a REV. 7 registrara "ENCERRADO NA 2.3C" — classificação retirada por determinação da revisão independente; o histórico permanece em §11.)*

O que está **comprovadamente protegido**: os dois regimes de whitelist têm emissor real seguro provado ponta a ponta contra PostgreSQL — whitelist **VAZIA** (2.3B — `profissional.situacao.alterada`, §6-A.5) e whitelist **POSITIVA** (2.3C — `cobranca.desconto_aplicado`, §6-C.2/§6-C.4), esta última agora também com **validação SEMÂNTICA fail-closed** das chaves monetárias na camada de política (F-2.3C-REV-01): valor semanticamente inválido em chave homologada → rejeição + rollback integral, mesmo se enviado diretamente ao `AuditWriter` por um emissor incorreto. Nenhum caminho de escrita em `evento_auditoria` existe fora de `AuditWriter → AuditContextValidator`.

O que **impede o encerramento global**: as demais ações de whitelist positiva (`cobranca.data_referencia_recalculada` — par de datas; `retificacao_clinica.efetivada_terceiro` — `registro_original_id`) **não têm validação semântica definida/implementada** (sem regra de formato homologada) e seus emissores não existem. O risco genérico de vazamento via `contexto` permanece portanto **ABERTO / MITIGADO PARCIALMENTE**. **Pendência registrada (§9)**: definir/implementar a validação semântica dessas chaves quando seus emissores forem implementados ou sua regra for formalmente decidida — sem reabrir D-AUD-07 e sem inventar formatos de data/uuid por implicação.

### 7.3 Hardening de valores escalares — decisão técnica local

A restrição vigente de `contexto` a **valores escalares JSON** (`string | number | boolean | null`; desde a REV. 4, `number` somente **finito** — `NaN`/`±Infinity` rejeitados, correção `F-REV-02`) é **decisão técnica local de implementação**: conservadora, fail-closed e **reversível**. Ela **NÃO constitui nova decisão normativa** e **NÃO integra `D-AUD-07` por implicação**. Registra-se que: todas as chaves atualmente homologadas são compatíveis (valores monetários e datas civis como string/number; UUID como string); objetos e arrays são rejeitados — barreira estrutural contra serialização genérica de DTO/request; eventual necessidade futura de estrutura composta em alguma chave exige **revisão explícita desta política**, não contorno. Não é requisito permanente do produto.

### 7.4 `L-07` — auditoria restrita de negações de autorização (implementação, 05/09/2026)

```text
L-07 — DECIDIDA (docs/09 §13.4.1, PBACK-AUD-09) / IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA / NÃO INTEGRADA — PUBLICAÇÃO NÃO AUTORIZADA (D-6)
```

> **Atualização factual — 05/09/2026 (REV. 36), estado CORRENTE.** O bloco acima é o estado **no encerramento da fatia** e fica preservado como registro histórico. A fatia foi **integrada na `main`** no mesmo dia pela PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23) (merge commit `e1459f6`) — registro pós-medição em **§7.4.8**. `D-6` de `PBACK-AUD-09` permanece registrada como decidida no seu momento; a publicação é ato posterior de Bruno Menezes Noronha, que abriu e mesclou a PR. Nenhuma medição de §7.4.1..§7.4.7 foi reescrita.

Branch `agent/p-back-01-d2-auditoria-decisoes`, a partir de `main` = `origin/main` = `c4c9ba2` (0 à frente / 0 atrás no início da fatia). Working tree preservada: as alterações preexistentes da fatia `P-BACK-01-D2` (catálogo comentado, validator spec, `docs/09` §13, este documento) e o `AGENTS.md` untracked foram mantidos intocados naquilo que não pertence a `L-07`.

#### 7.4.1 Decisões materializadas (`docs/13` §12 → `docs/09` §13.4.1)

| Decisão | Escolha | Materialização |
| --- | --- | --- |
| D-0 | (a) | gatilho satisfeito pelo código integrado; leitura restrita a `L-07` |
| D-1 | R | `autorizacao.negada` no catálogo tipado (25ª, ao final); whitelist vazia; **lista fechada** de permissões auditáveis no emissor = `{senha.recuperar_terceiro}` |
| D-2 | Q2 | emissor **nunca lança**: falha → `Logger.error("[Autorizacao] ... classe=<nome> permissao=<código> correlacao=<uuid>")`, sem `message`/`stack`; `403` preservado; sem retry |
| D-3 | V0 | sem `DimensaoLimite`; um evento por tentativa negada |
| D-4 | R | `NEGADO`; ator = `usuarioId` do contexto autenticado; `alvo_tipo = "permissao"`; `alvo_id = SELECT id FROM permissao WHERE codigo = <metadata do handler>`; contexto omitido; `justificativa = NULL`; `correlacao_id = randomUUID()` por negação |
| D-5 | S | esta fatia |
| D-6 | não | nenhum commit/push/PR/merge/rebase/deploy |

#### 7.4.2 Arquivos criados e alterados

| Arquivo | Situação | Responsabilidade |
| --- | --- | --- |
| `apps/api/src/authz/auditoria-negacao-autorizacao.ts` | **NOVO** | emissor `AuditoriaNegacaoAutorizacao` (P2): lista fechada, transação dedicada (T1) pela fronteira única, `SELECT permissao` + `AuditWriter.registrar` na mesma transação, Q2 |
| `apps/api/src/authz/permissoes.guard.ts` | **ALTERADO** | terceira dependência (emissor); emissão **apenas** em "permissão ausente" e "usuário inativo", `await` antes de lançar; cabeçalho revisto (a fronteira "sem auditoria de negação" da F4 foi superada por decisão) |
| `apps/api/src/authz/authz.module.ts` | **ALTERADO** | `imports += AuditModule`; `providers`/`exports += AuditoriaNegacaoAutorizacao` (a guard resolve dependências no injetor do módulo do controller — `R4-05`) |
| `apps/api/src/audit/audit.catalog.ts` | **ALTERADO** | `autorizacao.negada` (+1 ação, +1 whitelist vazia); comentários citam `PBACK-AUD-09` |
| `apps/api/test/auditoria-negacao-autorizacao.spec.ts` | **NOVO** (38 provas) | emissor em isolamento: 28 permissões não emitem; contrato D-4; correlação nova; Q2 em três falhas; log seguro; controle positivo sem log |
| `apps/api/test/permissoes.guard.spec.ts` | **ALTERADO** (+8 provas) | quando a guard emite (ausente, inativo) e quando não (concessão, inexistente, fiação, falha técnica); emissão aguardada; N negações → N entregas |
| `apps/api/test/audit-context.validator.spec.ts` | **ALTERADO** | contadores 25/22; `autorizacao.negada` sai das rejeitadas (variantes de caixa/sufixo continuam rejeitadas); A-12 com 9 chaves recusadas |
| `apps/api/test/integration/recuperacao-senha.integration.spec.ts` | **ALTERADO** (+13 provas) | bloco L-07 contra PostgreSQL real; asserções de zero evento nos casos `401`/CSRF/`422` preexistentes; teste `:460` **inalterado** |
| `apps/api/test/integration/authz-rbac.integration.spec.ts` | **ALTERADO** (+1 prova) | A-11 lista fechada, com poder de mutação |

**Intocados:** `packages/**` (schema, migrations, golden), `package.json`/lockfile, OpenAPI (`documento-openapi.ts`, descrição do `403` inalterada), `recuperacao-senha/**`, `erro-autenticacao.filter.ts`, `audit-writer.ts`, `audit-context.validator.ts`, `AGENTS.md`.

#### 7.4.3 Comportamento comprovado (PostgreSQL 18 real, `tlf_app`, banco descartável)

- **Cadeia** CSRF ✓ → sessão ✓ → `PermissoesGuard` nega → emissor → `evento_auditoria`: `403 {erro:"ACESSO_NEGADO"}` **byte a byte igual** ao anterior, sem cookie; **exatamente 1** evento por negação, `acao = autorizacao.negada`, `resultado = NEGADO`, `ator_usuario_id = usuário da sessão`, `alvo_tipo = permissao`, `alvo_id = permissao.id`, `contexto` vazio, `justificativa` NULL, `correlacao_id` uuid **distinto** por negação; nenhum segredo, nenhum `usuario.senha.recuperacao_iniciada`.
- **Inativo** com sessão viva: `403` + 1 evento (A-02).
- **Corpo não confiável:** `{}`, `{identificador: 7}`, array e corpo com identidade/permissão forjadas — todos **JSON válidos** (alcançam a guard) e semanticamente inválidos/forjados — recebem `403` + 1 evento; nada do corpo, cookie, token, e-mail/id do alvo, cabeçalhos forjados ou IP aparece na tabela inteira (`SELECT *`) nem em log. Controle: os mesmos corpos, **com** a permissão, chegam ao handler e recebem `400` — a validação vive no handler, a negação não depende dela.
- **Fora do escopo — zero eventos:** `401` (sem sessão; revogada), `403 REQUISICAO_NAO_AUTORIZADA` (CSRF), fluxo autorizado (`201`, só `recuperacao_iniciada`), `422 ALVO_NAO_ELEGIVEL`, `500` por falha técnica na resolução (`resolverDoUsuario` rejeitando), negações em `usuarios.gerenciar`/`permissoes.gerenciar` (fixture F4, inclusive por inativo, com as linhas de `permissao` presentes).
- **Q2:** `AuditWriter.registrar` lançando para `autorizacao.negada` (mensagem com marcadores sensíveis e nome de classe do driver) → `403 ACESSO_NEGADO` idêntico; `RecuperacaoSenhaService.iniciar` **não** chamado; writer chamado **uma** vez (sem retry); **1** `Logger.error` com `classe=`, `permissao=`, `correlacao=` e **sem** message/stack/marcadores/ids/cookie; **zero** eventos; **zero** `unhandledRejection` (ouvinte no processo durante o caso). Variante **real, sem mock:** permissão não provisionada em `permissao` → `403`, zero eventos, `classe=ErroPermissaoNaoPersistida`.
- **Concorrência (V0):** 8 negações simultâneas do mesmo usuário → 8 × `403`, 8 eventos, 8 correlações; sem dedupe, sem deadlock.

#### 7.4.4 Segurança

Evento e log carregam somente: ação, resultado, uuid do ator (sessão), `permissao`/uuid da permissão, instante, correlação. **Ausentes por prova:** identificador/e-mail tentado, id do alvo, corpo, cookie, token, senha, hash, cabeçalhos, IP, `message`/`stack`. O log do Q2 cita a permissão **exigida** (metadata do servidor, catálogo fechado) — nunca dado do cliente. A resposta HTTP não muda por existir ou falhar a auditoria (nenhum oráculo novo); a latência adicional do `403` (uma transação curta) **não** é equalizada, no mesmo limite declarado por `D-2.3D-16`.

#### 7.4.5 Mutation challenges — 4 aplicados, 4 detectados, 4 revertidos (hash SHA-256 conferido após cada reversão)

| # | Mutação | Detectada por |
| --- | --- | --- |
| M1 | emissor removido da guard (`registrarNegacao` vira no-op) | unitário guard **4 falhas**; integração recuperação **11 falhas** |
| M2 | alvo passa a `usuario`/ator em vez de `permissao`/`permissao.id` | unitário emissor **1 falha**; integração **7 falhas** |
| M3 | Q2 convertido em propagação (`throw` no `catch`) | unitário emissor **4 falhas**; integração **3 falhas** (`500` no lugar de `403`) |
| M4 | lista fechada ampliada com `usuarios.gerenciar` | unitário emissor **2 falhas**; integração A-11 **1 falha** — *na primeira execução A-11 ficou vacuamente verde (linha de `permissao` ausente → Q2 engolia a escrita); a fixture foi corrigida para persistir as linhas das rotas negadas e a mutação passou a ser detectada* |

Originais restaurados a partir de cópia no scratchpad; `sha256sum -c` OK para `permissoes.guard.ts` e `auditoria-negacao-autorizacao.ts` após cada mutação.

#### 7.4.6 Bateria integral — host Windows, 05/09/2026

Executada em sequência sobre a working tree desta fatia (após as quatro mutações revertidas e antes das edições finais de documentação; `git diff --check` reexecutado ao final com os documentos):

| Comando | Exit | Resultado |
| --- | --- | --- |
| `npm run typecheck` (raiz + 2 workspaces) | 0 | — |
| `npm run build` | 0 | — |
| `npm run test:api` | 0 | **25 suites · 659 passed** (era 24 · 595 — +1 suite, +64 provas) |
| `npm run verify:api-integration` (PostgreSQL 18 descartável, `tlf_app`) | 0 | **10 suites · 399 passed + 2 skipped** (era 384 + 2; os 2 pulados são `SIGINT`/`SIGTERM`, POSIX); 0 bancos, 0 containers, 0 volumes remanescentes |
| `npm run test:integration` (persistência) | 0 | 10 suites · 87 passed |
| `npm run verify:from-scratch` | 0 | 10 suites · 87 passed; histórico de migrations autossuficiente; 0 resíduos |
| `verify:openapi-runtime` | 0 | 19 verificações OK — contrato **inalterado** |
| `verify:argon2-runtime` | 0 | addon carrega e opera no ESM compilado |
| `npm run smoke:api` | 0 | bootstrap ESM real com banco descartável verde |
| `npm run lint:migrations` (Guarda 1) | 0 | 10 migrations · 37 objetos protegidos; nenhuma remoção |
| `npm run schema:verify` (Guarda 3) | 0 | golden byte a byte (60 169 bytes); `migrate diff` exit 0 — **zero drift** |
| `git diff --check` | 0 | sem whitespace error |

Suítes focais (executadas antes da bateria, com `--runInBand`): unitárias `permissoes.guard` + `audit-context.validator` + `auditoria-negacao-autorizacao` — **3 suites · 226 passed**; integração `recuperacao-senha` + `authz-rbac` — **2 suites · 105 passed**.

#### 7.4.7 Riscos, limites e pendências desta fatia

| Item | Estado |
| --- | --- |
| Volume por insider autenticado (V0) | **RISCO ACEITO por decisão (D-3)** — sem limitador; cada tentativa negada custa 1 transação (1 `SELECT` + 1 `INSERT`). Resposta administrativa (`AUT-002`/`sessoes.revogar_terceiro`) **não implementada** — dependência registrada |
| Lacuna da trilha em falha de infraestrutura (Q2) | **LIMITAÇÃO DECLARADA** — visível em log (`[Autorizacao] ... correlacao=`); não monitorado por alarme |
| Latência do `403` (H-03) | **NÃO MEDIDA** — A-15 pendente; sem limiar fixado |
| Volume real de `403` (H-02) | **NÃO MEDIDO** — sem produção/telemetria |
| Permissão não provisionada em `permissao` | **DECISÃO LOCAL** — tratada como falha técnica Q2 (log, sem evento); o seed da F5 garante a linha em ambiente provisionado. Observação: o teste preexistente `recuperacao-senha.integration.spec.ts:460` não provisiona a linha e, por isso, exercita este caminho (2 logs Q2 na saída da suíte) — comportamento correto, teste inalterado e verde |
| Alvo pretendido pelo cliente | **NÃO REGISTRADO por desenho** (F-04 de `docs/13`): a trilha responde "quem tentou usar a capacidade", não "contra quem" |
| `422` × `D-2.3D-16` | conflito registrado em `docs/13` §14; **sem decisão**; `422` **não** auditado |
| `L-06`, `R2.2-04`, `P-BACK-01`, `AUT-005` | **INALTERADOS** — nenhum encerrado por esta fatia |

#### 7.4.8 Registro pós-medição da integração (05/09/2026)

Registro **exclusivamente factual**, no precedente `MEDIR → REGISTRAR` de §6-I.8, §6-L.8, §6-O.8 e §6-P.18. Nenhuma medição de §7.4.1..§7.4.7 foi reescrita.

| Item | Fato medido (`git`/`gh`, 05/09/2026) |
| --- | --- |
| PR | [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23) — "L-07 — auditoria restrita de negações de autorização (PBACK-AUD-09)"; branch `agent/p-back-01-d2-auditoria-decisoes` → `main`; autor e responsável pelo merge: `BrunoMNoronha` (Bruno Menezes Noronha) |
| Commit da fatia | `62862bf` — `feat(api): L-07 — auditoria restrita de negações de autorização`; CI do HEAD da PR **verde** (run [33963479328](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33963479328), `success`) |
| Merge | merge commit **`e1459f64548af89f668165eeb5a4c4c2a444d1ce`** sobre a baseline `c4c9ba2` (pais: `c4c9ba2`, `62862bf`), em 05/09/2026 11:33:36Z; método merge commit, sem squash, sem rebase, sem force-push |
| Arquivos integrados | **12** — `apps/api/src/audit/audit.catalog.ts`, `apps/api/src/authz/auditoria-negacao-autorizacao.ts`, `apps/api/src/authz/authz.module.ts`, `apps/api/src/authz/permissoes.guard.ts`, os cinco specs de §7.4.2 em `apps/api/test/**`, `docs/09`, `docs/10` e `docs/13` — exatamente o conjunto de §7.4.2 |
| Persistência | `packages/**` não tocado pela PR — zero drift; 10 migrations; golden inalterado |
| CI sobre a `main` integrada | **Não medida por run própria**: o workflow da `main` é acionado manualmente (`workflow_dispatch`) e não existe run para `e1459f6` nem para `80986e7`; a evidência de CI é a do HEAD da PR (acima) e a bateria integral local de §7.4.6 sobre a mesma árvore |
| `main` posterior | a sprint `FRONT-F0` (PR [#24](https://github.com/BrunoMNoronha/techlab-fisio/pull/24), merge commit `80986e7`, 05/09/2026 12:20:42Z) foi integrada **sobre** `e1459f6` — `apps/web` passou a existir na `main`; nenhum arquivo de `apps/api/**` ou `packages/**` foi tocado por ela (`docs/08` REV. 25) |

**O que esta integração NÃO altera:** `AUT-002`/`sessoes.revogar_terceiro` (resposta administrativa à trilha) permanece **NÃO IMPLEMENTADA** — o risco de V0 continua aceito e registrado (§7.4.7, §9); `AUT-005` NÃO MATERIALIZADA; H-02/H-03 não medidos; `422` não auditado; `L-06`, `R2.2-04` e `P-BACK-01` inalterados. A publicação **não encerra** `P-BACK-01`.

## 8. Testes e verificações

### 8.1 `T-AUD-CONTEXTO`

```text
T-AUD-CONTEXTO — CONCLUÍDO (EXECUTADO / PASSED — unitário + integração; emissor real com contexto NÃO vazio desde a 2.3C; validação SEMÂNTICA de chave monetária desde F-2.3C-REV-01)
```

Evidências que sustentam o estado CONCLUÍDO (todas medidas): ação desconhecida → rejeitada; chave extra → rejeitada; objeto/array → rejeitados; whitelist vazia → contexto não vazio rejeitado; whitelist positiva válida → aceita e persistida byte a byte; **valor semanticamente inválido em chave monetária → rejeitado (`VALOR_SEMANTICAMENTE_INVALIDO`), inclusive por chamada direta ao writer**; nenhuma sanitização silenciosa (candidato nunca mutado, sem conversão `"10"`→`"10.00"`/number→string); **rollback integral do fluxo de negócio** quando a auditoria é inválida (PostgreSQL real); nenhum valor rejeitado ecoado em mensagem de erro.

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
| `P-BACK-01` | **EM ANDAMENTO** (§7.1) — fluxos reais de whitelist vazia (2.3B) e positiva (2.3C) entregues; **lacunas normativas decididas em 05/09/2026** por `P-BACK-01-D2` (`docs/09` §13); **`L-07` decidida (`PBACK-AUD-09`), implementada (§7.4) e integrada na `main` em 05/09/2026 (PR #23, merge `e1459f6` — §7.4.8) — primeiro emissor de `NEGADO`**. **Resta**: `L-06` (ABERTA / BLOQUEADA), a materialização técnica de `L-08`, a implementação do visualizador de auditoria e os emissores das 17 ações que ainda não têm módulo de domínio. A pendência de exposição HTTP de `profissional.situacao.alterada` com `profissionais.gerenciar` é **fatia de domínio**, não lacuna normativa de auditoria |
| `R2.2-04` | **ABERTO / MITIGADO PARCIALMENTE** (§7.2 — reclassificação conservadora da REV. 8): `cobranca.desconto_aplicado` comprovadamente protegido, inclusive semanticamente; demais whitelists positivas sem validação semântica definida |
| `P-2.3C-01` | **RESOLVIDA em 27/08/2026** — `PROP-RN-2.3C-01` registrada em `docs/11` (§6-B); implementação decorrente em §6-C |
| `F-2.3C-REV-01` | **ENCERRADO** — correção (§6-C.4) confirmada pela revisão independente do HEAD `b386c03` |
| `F-2.3C-REV-02` | **BAIXO / dívida técnica — NÃO corrigido por decisão** (revisão de `b386c03`): chaves internas de `SEMANTICA_CONTEXTO` tipadas como `Record<string, …>` — typo compilaria; risco contido pela matriz de testes; melhoria futura: tipagem-subconjunto da whitelist ou teste de inclusão |
| `F-2.3C-REV-03` | **INFORMATIVO — NÃO corrigido por decisão** (revisão de `b386c03`): detalhe da mensagem de `VALOR_SEMANTICAMENTE_INVALIDO` cita "chave monetária"; ao adicionar a primeira regra semântica não monetária, acoplar o texto de detalhe à regra |
| Validação semântica das demais whitelists positivas | **PENDENTE** — `data_referencia_anterior`/`data_referencia_nova` (datas) e `registro_original_id` (uuid) sem regra de formato homologada; definir quando os emissores forem implementados ou por decisão expressa (sem reabrir D-AUD-07) |
| `R-BL-02` | **ENCERRADO** (§8.2) — smoke adaptado na 2.3B para banco descartável (provider eager), com todas as verificações preservadas (§6-A.6) |
| `T-AUD-CONTEXTO` | **EXECUTADO / PASSED** (§8.1) |
| **AUT-005 / RN-001 — revogação de sessões na inativação de usuário** | **NÃO MATERIALIZADA / NÃO ENCERRADA** (§6-K.4). AUT-002 lista a inativação entre os gatilhos de encerramento; AUT-005 exige "ao inativar, revogar sessões ativas" e que o inativo "não mantenha sessão utilizável"; RN-001 repete a obrigação. Não existe fluxo de ativação/inativação de **usuário** em `apps/api/src/`, e `SessaoService.validar` não consulta `usuario.ativo`. A negação do RBAC (`L-F4-02`) é defesa em profundidade PARCIAL e **não** substitui a obrigação. Deverá ser materializada junto ao fluxo que implementar a ativação/inativação de usuários, com os estados terminais de `D-2.3D-05`; **este documento não fixa a fatia** |
| RBAC / `profissionais.gerenciar` | **NÃO IMPLEMENTADO** — obrigatório antes de expor `profissional.situacao.alterada` (§6-A.4); "ator existente/ativo" ≠ "ator autorizado" |
| `L-05` (agenda) | **FECHADA em 05/09/2026** — `docs/09` §13.2 (`PBACK-AUD-01`): transições fora das 4 ações homologadas seguem atribuíveis por `historico_agendamento`; as 5 ações RC de agenda permanecem fora do catálogo |
| **`L-06` (acesso a dados clínicos)** | **ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA** — `docs/09` §13.3 (`PBACK-AUD-02`). **NÃO encerrada por escopo**: `TLF-BASE-V1` §10 exige trilha de auditoria para **acesso** a dados sensíveis, e AUD-002 **não** é dada por satisfeita por exportação/finalização/retificação. Bloqueada porque o módulo de prontuário não existe, `P2.2-05` não foi materializada e não há superfície real para medir volume/comportamento. **Retomada obrigatória antes de disponibilizar qualquer superfície de leitura clínica**; `prontuario.acessado` não foi criado |
| `L-07` (negações de autorização) | **DECIDIDA em 05/09/2026 (`docs/09` §13.4.1, `PBACK-AUD-09`) — IMPLEMENTADA E MEDIDA (§7.4) E INTEGRADA NA `main` em 05/09/2026** (PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23), merge `e1459f6` — §7.4.8). Histórico: `PBACK-AUD-03` fechou-a sob premissa falsa (errata em `docs/09` §13.1 G-03; nota de revisão em §13.4); o pacote `docs/13` apurou que a negação **não deixava rastro algum**; Bruno decidiu `D-0a`, `D-1R`, `D-2Q2`, `D-3V0`, `D-4R`, `D-5S`, `D-6` não autorizada (estado no ato da decisão; a publicação ocorreu depois, pela PR #23 aberta e mesclada pelo próprio Bruno). Estado atual: `autorizacao.negada` **criada** (25ª ação, whitelist vazia); emitida **somente** pela negação deliberada de `senha.recuperar_terceiro` no `PermissoesGuard`; `403` inalterado; falha técnica continua não virando negação; Q2 provado; 4 mutações detectadas. **Riscos abertos:** volume sem limitação (V0) com resposta administrativa (`AUT-002`) não implementada; H-02/H-03 não medidos |
| `L-08` (alteração sensível de paciente) | **POLÍTICA NORMATIVA FECHADA / MATERIALIZAÇÃO TÉCNICA PENDENTE** — `docs/09` §13.5 (`PBACK-AUD-04`): sensíveis = CPF, responsável legal, consentimentos/bases, situação ativo/inativo. `paciente.cadastro.alterado`, `paciente.situacao.alterada` e `campos_alterados` **não** criados; forma técnica decidida com o módulo de pacientes (conflito conhecido `campos_alterados` × política de escalares) |
| `configuracao.alterada` (granularidade/abrangência/whitelist) | **FECHADA em 05/09/2026** — `docs/09` §13.6 (`PBACK-AUD-05`): ação única; entidade concreta por `alvo_tipo`; abrangência CFG-001..CFG-006; whitelist **vazia**. Limitação declarada: o estado anterior da configuração não é necessariamente preservado — reavaliável com emissor real |
| `prontuario.exportado` (alvo definitivo) | **FECHADO em 05/09/2026** — `docs/09` §13.7 (`PBACK-AUD-06`): `alvo_tipo = "paciente"`, `alvo_id = paciente.id`, uniformemente; sem chave de contexto (`formato` não homologada) |
| `autor_original_usuario_id` | **REJEIÇÃO CONFIRMADA em 05/09/2026** — `docs/09` §13.8 (`PBACK-AUD-07`): derivável por `registro_original_id → registro_clinico.autor_usuario_id`, imutável por `trg_registro_clinico_imutavel_finalizado`. Segue rejeitada pelo validator; nenhum código alterado |
| Consulta da trilha de auditoria (AUD-004) | **POLÍTICA FECHADA / IMPLEMENTAÇÃO PENDENTE** — `docs/09` §13.9 (`PBACK-AUD-08`): usará exclusivamente `auditoria.ler` (**nenhuma permissão nova**); somente leitura; filtros fechados sobre colunas próprias; paginação obrigatória; sem busca livre, sem filtro por `contexto`/`justificativa` e **sem resolver/expandir** `alvo_tipo`+`alvo_id`. `auditoria.consultada` não criada. Endpoint **não** implementado — unidade de trabalho própria |
| `P2.2-05` (fisioterapeuta ↔ paciente relacionado) | **PENDENTE** — fatia futura de autorização clínica |
| `F-REV-03`..`F-REV-08` (revisão da 2.3B) | **NÃO BLOQUEANTES / NÃO CORRIGIDOS por decisão** — `F-REV-03` BAIXO; `F-REV-04`..`F-REV-08` INFORMATIVOS, conforme o relatório de revisão; permanecem documentados para eventual tratamento futuro |
| `R-BL-09` (`deepmerge-ts` transitivo) | **ABERTO** — aceitação temporária monitorada (`docs/08` §15.2); **remedido na 2.3B sem alteração**: mesma cadeia (`prisma@7.9.1 → @prisma/config@7.9.1 → deepmerge-ts@7.1.5`), mesmas 3 high (GHSA-ggr8-5vv4-36mx); nenhuma dependência nova instalada na 2.3B; reavaliação obrigatória a cada atualização do Prisma 7 e antes de CI de produção/deploy |
| `V-06.c` (teto TS 6.0 × Next.js 16) | **APROVADA em 05/09/2026** — executada no scaffold legítimo de `apps/web` (sprint `FRONT-F0`; `docs/08` REV. 22, §12.1/§12.2; reproduzida pela homologação independente na REV. 23); `apps/web` **integrado na `main`** pela PR [#24](https://github.com/BrunoMNoronha/techlab-fisio/pull/24) (merge `80986e7`). `V-06` integralmente aprovada; **`R-BL-03` permanece residual e ABERTO** — encerramento formal é ato de Bruno (`docs/08` §15) |
| `P-2.3D-01` (absorção de `D-2.3D-01` em `docs/07`) | **ENCERRADA em 27/08/2026** — `docs/07` REV. 2.2 (editorial) passou a refletir `token_hash`, `ultima_atividade_em` e `ck_sessao_autenticacao_atividade` em §7.1/§10.2, com a origem em `docs/12` explicitada e `docs/07` §28.1 atualizado. A fonte normativa continua sendo `docs/12` §5.1 |
| `P-2.3D-02` (benchmark empírico do Argon2id) | **ENCERRADA em 27/08/2026** — benchmark executado na F1 (§6-D.5): `hash` p50 39,16 ms · `verify` válido p50 38,70 ms · `verify` inválido p50 39,67 ms · ~19 MiB por operação, em Node 24 / win32-x64 / i5-1235U. Sem ressalva material; parâmetros homologados **mantidos** e `D-2.3D-02` **não reaberta**. Remedir em hardware de produção antes do go-live é prudência operacional, não condição pendente |
| Argon2 sob o gate `allow-scripts` do npm 11 | **OBSERVADO / SEM AÇÃO** — o install script (`node-gyp-build`) de `argon2@0.45.1` não roda sob npm 11.16 sem aprovação; os prebuilds N-API embarcados (`win32-x64`, `linux-x64`) tornam isso inócuo, o que foi **provado** (§6-D.4) e não presumido. Reavaliar se a matriz de plataformas mudar ou se um prebuild deixar de existir |
| `P-2.3D-03` (ESM/`nodenext` × `@nestjs/swagger@11.4.7`) | **PENDENTE — F3** — compatibilidade a **medir**, não presumir; fallback autoral já decidido em `D-2.3D-11` |
| `P-2.3D-04` (reavaliação de CSRF) | **ABERTA** — `apps/web` existe na `main` desde 05/09/2026 (PR #24, merge `80986e7`; fundação técnica **sem** integração com `apps/api`), o que torna a reavaliação **tecnicamente elegível**; ela **não foi realizada nem decidida** — nenhuma estratégia CSRF foi antecipada (`docs/08` REV. 22/24; `apps/web/README.md`). Synchronizer token só mediante necessidade demonstrada (`D-2.3D-07`) |
| `P-2.3D-05` (eventual `usuario.criado`) | **PENDENTE** — exige decisão própria; `D-2.3D-10` **não** cria a ação e usa `usuario.papeis.alterados`, já no catálogo |
| `P-2.3D-06` (rate limit resiliente a restart) | **ADIADA** — limitação aceita e documentada do MVP (`D-2.3D-06`) |
| ~~`R-2.3D-03`~~ (regressão temporal de `ultima_atividade_em`) | **ENCERRADO NA F2 em 27/08/2026 — por decisão de Bruno Menezes Noronha** (TLF-BASE-V1 §15, item 1), após a revisão técnica independente (§6-E.9). Fundamentação técnica: a F2 materializou e provou a obrigação de monotonicidade atômica de `D-2.3D-04` por (1) `UPDATE` **condicional atômico**, com o predicado inteiro no `WHERE` e nenhuma decisão de escrita tomada em memória; (2) `GREATEST(ultima_atividade_em, instante_candidato)` na cláusula `SET`, medido como barreira real — a sonda da revisão provou que o `SET` é avaliado sobre a versão **nova** da linha; (3) predicado de throttle que exige avanço sobre o valor vigente e, por isso, **também bloqueia atividade temporalmente regressiva**; (4) testes de integração **concorrentes** contra PostgreSQL real, com espera de lock confirmada em `pg_stat_activity` — o teste falha se a corrida não for exercida — e convergência determinística de 5 atualizações fora de ordem; (5) **mutation challenge last-writer-wins** que faz os detectores falharem (reproduzido 3/3 pela revisão independente); (6) confirmação de que a correção `C-01` de `revogar` **não enfraqueceu** a proteção — o challenge de LWW foi reaplicado sobre o código já corrigido e continua sendo detectado. **Limites da evidência, registrados como tais e NÃO como risco aberto:** a prova foi executada em PostgreSQL sob `READ COMMITTED`, na arquitetura vigente de **PostgreSQL autoritativo compartilhado** — que é onde a propriedade é sustentada, pela própria operação SQL atômica. Cenários de escrita distribuída/multi-primary estão **fora da arquitetura vigente** (TLF-BASE-V1 §4.5/§4.6, §13) e não devem ser antecipados. **`D-2.3D-04` NÃO foi alterada** e nenhuma decisão normativa nova foi criada: o risco encerra porque a obrigação que ele vigiava foi cumprida e provada |
| `P-2.3D-03` (compatibilidade ESM de `@nestjs/swagger@11.4.7`) | **MEDIDA E VERDE NA F3 — encerramento formal PENDENTE de decisão de Bruno Menezes Noronha** (§6-F.7). Medição: typecheck `nodenext` com `skipLibCheck: false` verde; build ESM verde; import ESM do `dist/` fora do Jest verde; documento construído a partir do `AppModule` compilado; `/openapi.json` servido pelo processo real `node dist/main.js` no smoke; lockfile coerente com 7 pacotes acrescentados apenas no workspace da API; os três peers pesados (`class-validator`, `class-transformer`, `@fastify/static`) são **opcionais** e **não** foram instalados. **Caminho A adotado**; o fallback autoral de `D-2.3D-11` não foi necessário e não foi construído. `docs/12` **não foi alterado**: o precedente vigente (REV. 1 / REV. 2) é o de encerramento por decisão expressa após revisão |
| `R-2.3D-06` (`@nestjs/swagger` incompatível com ESM) | **MATERIALMENTE AFASTADO pela medição da F3** (§6-F.7) — mesma ressalva de forma de `P-2.3D-03`: baixa formal pertence a decisão de Bruno |
| `R-2.3D-04` (cookie inseguro em produção) | **TRATADO — agora fail-closed; ENCERRAMENTO FORMAL PENDENTE de decisão de Bruno.** A revisão independente (`F-02`) mediu que o tratamento da §6-F.5 **não fechava** o cenário principal do risco: sem `TLF_AMBIENTE` e sem `NODE_ENV=production`, um deploy de produção subia emitindo `tlf_sessao_dev` sem `Secure` — o default era fail-OPEN. Corrigido em §6-G.4: a variável passou a ser **obrigatória**, e o processo real aborta o bootstrap sem ela (provado no smoke). A linguagem anterior ("tratado e testado", "protegido por fail-fast") era **mais forte que a evidência** e fica retificada aqui (`F-14`) |
| `R-2.3D-05` (enumeração por diferença de tempo) | **MITIGADO E PROVADO NA F3** (§6-F.10) — `T-AUTH-ENUMERATION` estrutural, com medição temporal complementar registrada como evidência (razão 1,04) e **não** como gate. Encerramento formal pendente de decisão de Bruno |
| `P-2.3D-04` (CSRF reavaliada contra o `apps/web` real) | **ABERTA e inalterada** — a F3 implementou **exatamente** a baseline de `D-2.3D-07`; synchronizer token **não** foi implementado nem registrado como obrigação futura |
| Persistência do **rehash** de `D-2.3D-02` | **MATERIALIZADA na fatia corretiva** (§6-G.6), após a revisão independente (`F-04`) apurar que a obrigação homologada estava aberta e sem dono: `precisaRehash` existia desde a F1 e **nunca era chamado em produção**. A escrita é condicionada ao digest efetivamente verificado e vive na mesma transação da sessão e da auditoria. **Não é decisão nova — é cumprimento de `D-2.3D-02`; `docs/12` não foi alterado** |
| Despejo forçado do limitador sob saturação (`D-2.3D-06`) | **LIMITAÇÃO DECLARADA da F3** (§6-F.4), no mesmo espírito de `R-2.3D-02`: ao atingir `MAXIMO_DE_ENTRADAS`, o despejo é uma via de diluição do contador, limitada na prática pela dimensão de IP. Registrada como limitação do MVP, **não** como propriedade |
| Log de falha técnica sem `message`/`stack` (`L-10`) | **LIMITAÇÃO DECLARADA da F3** (§6-F.9): mensagens do Prisma podem carregar a consulta e seus parâmetros, e do Argon2 o digest — registrá-las violaria TLF-BASE-V1 §10 e `D-2.3D-12`. A perda de detalhe no log é o preço aceito; revisitar com observabilidade estruturada é melhoria futura |
| Revisão independente da F3 (`F-01`..`F-14`) | **CONCLUÍDA em 28/08/2026 — veredito `B — APTO COM CORREÇÕES OBJETIVAS`.** Doze achados corrigidos, um (`F-07`) resolvido por consequência e um (`F-12`) mantido BAIXO com racional (§6-G). Nenhuma decisão `D-2.3D-*` alterada |
| `F-12` (guarda de cliente transacional em `emitirEm`/`revogarEm`) | **BAIXO — ACEITO nesta fatia** (§6-G.9): a verificação existente é função privada não exportada de `audit-writer.ts`, e `packages/database` — intocável por zero drift — expõe apenas o tipo. Corrigir exigiria acoplamento `auth → audit`, alteração de `packages/`, duplicação ou abstração prematura |
| Saturação transitória do limitador (~~`L-11`~~ → **`D-2.3D-13`**) | **HOMOLOGADA COMO NORMA em 28/08/2026 — deixou de ser decisão local** (`F3R-08`). A segunda revisão independente classificou o comportamento como decisão comportamental, e Bruno o homologou: a fonte normativa é **`D-2.3D-13`** (`docs/12` §5.13, REV. 3), e **`L-11` permanece apenas como alias/referência histórica** ao registro de implementação em §6-G.2. O risco residual está declarado e aceito como **`R-2.3D-08`** (`docs/12` §8). O conteúdo material da decisão não é reproduzido aqui: `docs/12` é a fonte |
| Amostra de despejo do limitador (`AMOSTRA_DE_DESPEJO`) | **DECISÃO LOCAL declarada** (§6-G.3): o despejo examina uma amostra limitada em vez do mapa inteiro, porque a varredura total era O(n) por requisição e transformava a saturação em amplificador de CPU. Pode recusar admissão havendo candidato seguro fora da amostra — conservador por desenho |
| ~~`L-F4-01`~~ — semântica de composição de múltiplas permissões | **ENCERRADA POR ELIMINAÇÃO em 28/08/2026** (§6-K.3) — e **não** por decisão normativa. A revisão independente mediu que nenhuma operação de `docs/04` §4/§8 exige duas permissões simultâneas; a cardinalidade > 1 era abstração antecipada (TLF-BASE-V1 §4.5). O decorator passou a aceitar **exatamente uma** permissão, e com isso não há `AND` nem `OR` a homologar. **Nenhuma decisão foi pedida nem tomada em nome de Bruno.** Quando existir operação que exija composição, ela virá com fonte e decisão própria |
| `L-F4-02` — sessão viva de usuário inativado | **DECISÃO LOCAL da F4, com COBERTURA PARCIAL declarada** (§6-K.4): o RBAC **nega** a autorização, como defesa em profundidade contra estado inconsistente. **NÃO materializa AUT-005** e **não** protege rotas apenas autenticadas — medido: uma sessão de conta inativada permanece `ATIVA`, continua válida para o `SessaoService` e obtém `200` em rota sem RBAC. `SessaoService` **não** foi alterado. Reversível sem tocar decisão homologada |
| RBAC aplicado a rota de produção | **OBSERVAÇÃO da F4 SUPERADA pela F6 — esclarecimento da revisão corretiva de 05/09/2026.** O registro histórico de §6-J.4 ("nenhuma rota publicada tem permissão exigida") era verdadeiro em 28/08/2026 e é preservado como tal. **Estado atual:** desde o merge da F6 (`cbd02eb`, PR #20), `POST /auth/recuperacao-senha` é rota de produção sob `@RequerPermissao("senha.recuperar_terceiro")`, registrada no `AppModule`, com cadeia CSRF → sessão → permissão e negação provada por integração (§6-P). Esta linha permanecia desatualizada e foi corrigida aqui; nenhuma outra rota publicada exige permissão |
| Custo da consulta de autorização por requisição | **OBSERVAÇÃO da F4** (§6-J.13): uma consulta por requisição autorizada, **sem cache**, por decisão de escopo (`docs/12` §16). Nenhum problema de custo foi medido; se vier a ser, é evidência para decisão posterior, nunca licença para introduzir cache por antecipação |
| `L-F5-03` — conflito de Administrador preexistente no bootstrap | **MANTIDA E AGORA EFICAZ SOB CONCORRÊNCIA** (§6-N.2); risco de bloqueio administrativo e runbook manual registrados em §6-N.6; um comando de reparo exige fatia e autorização próprias. Registro histórico (§6-M.10): nenhuma fonte homologada fixa o comportamento quando já existe outro usuário com o papel Administrador. Adotada a alternativa conservadora e fail-closed — **recusa** (`ADMINISTRADOR_JA_EXISTE`), medida contra PostgreSQL real. Aceitar o conflito **amplia privilégio** e exige decisão expressa de Bruno |
| ~~`L-F5-07`~~ → **`D-2.3D-14`** — seed aditivo, nunca destrutivo | **HOMOLOGADA COMO NORMA em 31/08/2026** (§6-N.3; `docs/12` §5.14). A matriz canônica deve ficar integralmente presente; excedentes são preservados e relatados. `seed --estrito` também converge o estado canônico e termina com saída 3 quando divergências persistem — não é somente leitura. `L-F5-07` permanece apenas como alias histórico |
| Lacunas de tradução `docs/04` §4 → §5 | **PENDENTES** (§6-M.5): seis linhas da matriz não possuem identificador objetivamente determinável em §5 — "Consultar profissionais", "Iniciar/Concluir atendimento clínico", "Consultar saldo administrativo de pacote", "Consultar histórico detalhado de movimentos", "Emitir recibo simples" e "Consultar indicadores operacionais". **Nenhuma associação foi inventada.** Cada uma exigirá decisão própria quando o endpoint correspondente existir; `indicadores.proprios.ler` permanece sem papel |
| Autoria do evento do primeiro bootstrap (~~`L-F5-08`~~ → **`D-2.3D-15`**) | **HOMOLOGADA COMO NORMA em 31/08/2026** (§6-N.4; `docs/12` §5.15). O evento usa `ator_usuario_id = NULL`, sem identidade sintética e sem atribuir ao alvo a autoria da própria elevação; `TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA` é obrigatória, persistida em `evento_auditoria.justificativa` e não amplia a whitelist. `L-F5-08` permanece apenas como alias histórico |
| Argon2 bloqueado por Application Control no host Windows | **DEIXOU DE OCORRER em 29/08/2026 — medido 3/3** (§6-N.11). O arquivo segue `NotSigned`, mas o carregamento passou a ser permitido; **nenhuma política da máquina foi alterada**. Consequência: a bateria integral, inclusive `smoke:api`, `verify:argon2-runtime` e `verify:openapi-runtime`, **passou a ser executável e está verde no host**. Mitigação estrutural da F5 permanece válida e é o que torna o risco não recorrente para o `seed`: ele deixou de depender do Argon2 (§6-N.8). **Como a causa é política de ambiente e pode voltar, o item permanece MONITORADO, não encerrado.** Registro histórico do período bloqueado: §6-M.13 |
| `F5-R-01` — corrida do primeiro Administrador | **CORRIGIDO em 29/08/2026** (§6-N.2). Duas revisões independentes reproduziram, em processos CLI reais, DOIS "primeiros Administradores" com ambos os processos em saída 0, sob `READ COMMITTED`. Correção: advisory lock transacional único `pg_advisory_xact_lock(2337, 5)` adquirido ANTES de qualquer leitura decisória, com todas as releituras sob o lock; hash Argon2 movido para fora da transação. Sem migration, sem dependência nova. Provado por cenários concorrentes repetidos, in-process e **entre processos** |
| `L-F5-08`..`L-F5-12` — inventário interpretativo | **ATUALIZADO** (§6-N.7): `L-F5-08` foi homologada como `D-2.3D-15` e permanece alias histórico; `L-F5-09`..`L-F5-12` seguem registradas com efeito quantificado. Nenhuma altera a matriz vigente (4/29/37, 18/3/8/8) |
| Permissões `C` semeadas antes de `P2.2-05` | **RISCO BAIXO REGISTRADO** (§6-N.9): o Fisioterapeuta possui `prontuario.ler/escrever/finalizar` e `agenda.*` sem que a camada de escopo de `docs/04` §2.5 exista. Inócuo hoje (nenhum endpoint de domínio; guard opt-in). **Quem publicar o primeiro endpoint clínico deve materializar o escopo, ou exigir permissão adicional, antes de expô-lo** |
| Bloqueio administrativo sem via de recuperação | **RISCO MÉDIO DECLARADO** (§6-N.6): recusa `ADMINISTRADOR_JA_EXISTE` mantida; sem F6 e sem AUT-005, não há recuperação dentro do produto. Runbook manual controlado registrado. Um comando de reparo exige **fatia e autorização próprias** |
| Higiene de formatação do `schema.prisma` | **PENDENTE — fora da F0 por decisão** — `prisma format` reformataria 7 modelos alheios ao escopo (condição **preexistente** à F0); merece PR próprio de formatação isolada, nunca misturado a uma fatia funcional |

## 10. Próximas etapas

Sujeitas a autorização própria, nesta ordem provável:

1. ~~**Rito de integração da 2.3A**~~ — **EXECUTADO em 26/08/2026** (PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3), merge commit `791e862`; registro pós-medição em §11, REV. 2).
2. ~~**Etapa 2.3B — implementação, revisão e integração**~~ — implementação **EXECUTADA em 26/08/2026** (§6-A); revisão independente com veredito **B** e correções `F-REV-01`/`F-REV-02` aplicadas (REV. 4); **homologada no HEAD `a96a328` e INTEGRADA NA `main` em 27/08/2026** (PR [#5](https://github.com/BrunoMNoronha/techlab-fisio/pull/5), merge commit `5aae8de`; registro pós-medição em §11, REV. 5).
3. ~~**Etapa 2.3C — implementação, revisão e integração**~~ — bloqueio `P-2.3C-01` resolvido (`PROP-RN-2.3C-01`, `docs/11`); implementação **EXECUTADA em 27/08/2026** (§6-B/§6-C); correção `F-2.3C-REV-01` aplicada (§6-C.4); revisão independente do HEAD `b386c03` com veredito **APTO COM RESSALVAS NÃO BLOQUEANTES**; **INTEGRADA NA `main` em 27/08/2026** (PR [#7](https://github.com/BrunoMNoronha/techlab-fisio/pull/7), merge commit `58a6e4b`; registro pós-medição em §11, REV. 9).
4. ~~**Etapa 2.3D-B / F0 — decisões de autenticação e persistência de sessão**~~ — decisões `D-2.3D-01`..`D-2.3D-12` registradas em **`docs/12`**; `D-2.3D-01` implementada como única reabertura física controlada; **INTEGRADA NA `main` em 27/08/2026** (commit `89abfd6`, PR [#9](https://github.com/BrunoMNoronha/techlab-fisio/pull/9), merge commit `f612fa7`; registro pós-medição em §11, REV. 10).
5. ~~**`F1 — CredencialService / Argon2id`**~~ — implementação **EXECUTADA em 27/08/2026** (§6-D), na branch `agent/fase2-etapa2.3d-f1-credenciais` a partir de `04aa01f`; `D-2.3D-02` e `D-2.3D-03` materializadas; `argon2@0.45.1` instalada apenas em `@techlab-fisio/api`; `P-2.3D-02` medida e encerrada (§6-D.5); **INTEGRADA NA `main` em 27/08/2026** (commit `f642b62`, PR [#11](https://github.com/BrunoMNoronha/techlab-fisio/pull/11), merge commit `f4c2466`; registro pós-medição em §11, REV. 12).
6. ~~**`F2 — SessaoService`**~~ — implementação **EXECUTADA em 27/08/2026** (§6-E), revisão técnica independente com veredito **B** e correções `C-01`/`C-02` aplicadas (§6-E.9); `R-2.3D-03` **ENCERRADO** por decisão de Bruno (§9); **HOMOLOGADA e INTEGRADA NA `main` em 27/08/2026** (commit `289a94b`, PR [#12](https://github.com/BrunoMNoronha/techlab-fisio/pull/12), merge commit `70b30ae`; registro pós-medição em §11, REV. 15).
7. ~~**`F3 — endpoints REST de autenticação`**~~ — **CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** (§6-F a §6-I). Implementação executada em 27/08/2026 na branch `agent/fase2-etapa2.3d-f3-auth-http` a partir de `9a22262`; `D-2.3D-06`, `D-2.3D-07`, `D-2.3D-11`, `D-2.3D-12` e `D-2.3D-13` materializadas. **Três** revisões técnicas independentes adversariais — vereditos `B`, `B` e **`A`** — com duas fatias corretivas (§6-G, §6-H); `L-11` devolvida a Bruno e homologada como **`D-2.3D-13`**. Homologada em 28/08/2026 e integrada por **merge commit `3556972`**, PR [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14), com os commits `362aefe`, `c755fcb` e `c20cf1c`. CI verde sobre o HEAD integrado (206 provas de integração) e validação local pós-merge verde; zero drift. Registro pós-medição em §6-I.8 e §11, REV. 20.
8. ~~**`F4 — guards e decorators de autorização (RBAC)`**~~ — **CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** (§6-J a §6-L). Implementação executada em 28/08/2026 na branch `agent/fase2-etapa2.3d-f4-rbac` a partir de `main` = `a9be742`; `D-2.3D-09` e a parte de RBAC de `AUT-003` materializadas. **Duas** revisões técnicas independentes adversariais — vereditos `B` e **`A`** — com uma fatia corretiva (§6-K); `L-F4-01` **encerrada por eliminação da abstração**, não por decisão normativa. Homologada por Bruno Menezes Noronha em 28/08/2026 e integrada por **merge commit `fce62d9`**, PR [#16](https://github.com/BrunoMNoronha/techlab-fisio/pull/16), a partir do commit único `ea8c74d`. CI verde (run `33222908307`) e validação integral pós-merge verde sobre a `main` integrada; zero drift de persistência; nenhuma migration nova; nenhuma dependência nova; nenhuma rota nova publicada. Limites preservados: **AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA**, sem fatia atribuída, e autorização clínica contextual (`P2.2-05`) **NÃO INICIADA**. Registro pós-medição em §6-L.8 (REV. 24).
9. ~~**`F5 — seed de papéis/permissões + bootstrap do primeiro Administrador`**~~ — **CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`** (§6-M a §6-O). Implementação executada em 29/08/2026 na branch `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin` a partir de `main` = `9140620`; `D-2.3D-09`, `D-2.3D-10`, `D-2.3D-14` e `D-2.3D-15` materializadas. **Três** revisões técnicas independentes adversariais — vereditos `C` (consolidado das duas primeiras) e **`B`** — com duas fatias corretivas (§6-N, §6-O); `L-F5-07` e `L-F5-08` devolvidas a Bruno e homologadas como **`D-2.3D-14`** e **`D-2.3D-15`** em 31/08/2026. Integrada em 02/09/2026 por **merge commit `657676b`**, PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18), com os commits `f4b3015`, `11612b4` e `39ad197` (este último, correção de harness de teste após incidente de CI no teardown do banco descartável — §6-O.8). CI verde sobre o HEAD integrado; validação local pós-merge integralmente verde; zero drift; 10 migrations. Registro pós-medição em **§6-O.8** e §11, REV. 29.
10. **`F6 — recuperação de senha`** — **HOMOLOGADA E INTEGRADA NA `main` em 05/09/2026** (§6-P; rito em §6-P.18). Merge commit `cbd02eb` (PR [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20)) sobre o HEAD `f6f507f`, a partir de `main` = `caf2280`; método merge commit, CI verde sobre o HEAD integrado (run 33952810239). AUT-004, D-04, RN-005, T-07, `D-2.3D-08` e a segunda metade de `D-2.3D-06` materializadas; zero drift de persistência; nenhuma dependência nova; nenhum canal de entrega. **Rodada corretiva final pré-PR** (§6-P.16): `M-01` (deadlock `40P01` entre `iniciar` e `concluir`) eliminado por ordem única de locks; `M-02` substituída por prova com barreira e constatação de bloqueio real; `B-01`/`B-02`/`B-03` corrigidos. **Rodada corretiva pós-review** (§6-P.17): `M-03` — a emissão de sessão do login reconferia o digest apenas no caminho de rehash, deixando um login em voo emitir sessão após a revogação em massa de T-07 — corrigido na origem por guarda de credencial corrente incondicional, com prova de entrelaçamento determinístico. **Decisões locais `L-F6-03` e `L-F6-05` promovidas a `D-2.3D-16` e `D-2.3D-17`** (`docs/12` §5.16/§5.17); `L-F6-07` mantida como local; **`L-F6-06` segue pendente** de decisão expressa. Passo seguinte: **F7 — consolidação, revisão independente e rito de integração**, por autorização própria.
11. **`F7 — consolidação da Etapa 2.3D`** — **CONCLUÍDA em 05/09/2026; ETAPA 2.3D ENCERRADA** (§6-Q). Revisão independente do conjunto integrado F1..F6 e passagem adversarial sobre 17 hipóteses: **nenhum defeito de código novo**; **nenhuma alteração de código**. O achado `Q-01` — suposto conflito entre `docs/09` §5 e `docs/06` §12.7 — foi **resolvido** pela governança de `docs/09`, cujo cabeçalho retira valor normativo a §§1..11; **`docs/09` não foi alterado**. `L-F6-06` promovida a **`D-2.3D-18`**; `L-F6-07` mantida como decisão local, com a metade não inequívoca registrada como `Q-02` (não bloqueante). `P-2.3D-03` encerrada. Matriz normativa sem item `SEM PROVA` ou `INCONSISTENTE`; dois `PARCIAL` declarados (AUT-002 e AUT-003), ambos escopo não atribuído. Próximo marco: **AUT-005** e a revogação administrativa de sessão de terceiro — sem fatia atribuída, por autorização própria.
11. Decisões normativas de auditoria — **resolvidas em 05/09/2026** por `P-BACK-01-D2` (`docs/09` §13, `PBACK-AUD-01`..`PBACK-AUD-08`), por decisão expressa de Bruno e sem alteração de catálogo, whitelist, schema ou comportamento. **Permanece aberta apenas `L-06`** (acesso a dados clínicos), ABERTA / BLOQUEADA por dependência de `P2.2-05` e da superfície real de leitura clínica. A exposição HTTP com `profissionais.gerenciar` continua pendente como **fatia de domínio**, não como lacuna normativa.
12. ~~**`L-07` — auditoria restrita de negações de autorização**~~ — **DECIDIDA (`PBACK-AUD-09`, `docs/09` §13.4.1), IMPLEMENTADA E MEDIDA (§7.4) e INTEGRADA NA `main` em 05/09/2026** — PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23), merge commit `e1459f6`, por ato de Bruno Menezes Noronha (§7.4.8). Permanecem: `AUT-002`/`sessoes.revogar_terceiro` **não implementada** (risco V0 aceito), H-02/H-03 **não medidos**, `422` **não auditado**.
13. **`FRONT-F0` — fundação do frontend (`apps/web`)** — **INTEGRADA NA `main` em 05/09/2026** (PR [#24](https://github.com/BrunoMNoronha/techlab-fisio/pull/24), merge commit `80986e7`; registro em `docs/08` REV. 22–25). Fundação técnica **sem** funcionalidade de negócio e **sem** integração com `apps/api`; `V-06.c` aprovada; **`P-2.3D-04` (CSRF × `apps/web` real) tecnicamente elegível, sem decisão**. Próximo marco do backend permanece **AUT-005** e a revogação administrativa de sessão de terceiro — sem fatia atribuída, por autorização própria.

## 11. Histórico de revisões

| REV. | Data | Conteúdo |
| --- | --- | --- |
| **36** | **05/09/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DE `L-07` E DA `FRONT-F0` NA `main` — sincronização documental exclusivamente factual.** **(a) `L-07` INTEGRADA:** PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23) aberta e mesclada por Bruno Menezes Noronha (`BrunoMNoronha`); commit da fatia `62862bf` (CI verde no HEAD da PR, run 33963479328); merge commit `e1459f6` sobre `c4c9ba2` em 05/09/2026 11:33:36Z; 12 arquivos, exatamente os de §7.4.2; `packages/**` intocado (§7.4.8). `D-6` de `PBACK-AUD-09` permanece registrada como decidida no ato; a publicação é ato posterior do próprio Bruno. **(b) `FRONT-F0` INTEGRADA:** PR [#24](https://github.com/BrunoMNoronha/techlab-fisio/pull/24) mesclada por Bruno; commit `c004f62` (CI verde no HEAD da PR, run 33965553378); merge commit `80986e7` sobre `e1459f6` em 05/09/2026 12:20:42Z; `apps/web` passou a existir na `main`, sem tocar `apps/api/**` nem `packages/**` (`docs/08` REV. 25). **(c) Nenhuma run de CI sobre os merge commits da `main`** (workflow manual, `workflow_dispatch`); evidência = CI dos HEADs das PRs + baterias locais registradas (§7.4.6; `docs/08` REV. 24). **(d) Estado vivo atualizado, sem reescrever histórico:** cabeçalho; §7.1; nota de estado corrente em §7.4 e novo §7.4.8; §9 (`P-BACK-01`, `L-07`, `V-06.c` → APROVADA, `P-2.3D-04` → ABERTA e tecnicamente elegível); §10 (itens 12 e 13); rodapé (F5/F6/F7 e `P-2.3D-03` alinhados ao que §6-O.8, §6-P.18 e §6-Q já registravam; `V-06.c`; `L-07`; `docs/12` até `D-2.3D-18`). **(e) Nada encerrado, nada implementado:** `AUT-005` NÃO MATERIALIZADA; revogação administrativa de sessão de terceiro NÃO IMPLEMENTADA; `P-2.3D-04` ABERTA; `P-BACK-01` EM ANDAMENTO; `L-06` ABERTA / BLOQUEADA; `R2.2-04` ABERTO / MITIGADO PARCIALMENTE; `R-BL-03` residual e ABERTO. **Nenhuma alteração de código, teste, schema, migration, OpenAPI ou dependência; Base Imutável intacta.** Mesmo precedente `MEDIR → REGISTRAR` das REV. 10, 15, 20, 24, 29 e 33. |
| **35** | **05/09/2026** | **`P-BACK-01` / `L-07` — AUDITORIA RESTRITA DE NEGAÇÕES DE AUTORIZAÇÃO IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA; NÃO INTEGRADA; PUBLICAÇÃO NÃO AUTORIZADA** (§7.4). **(a) Decisão:** Bruno Menezes Noronha respondeu ao pacote `docs/13` (`D-0a`, `D-1R`, `D-2Q2`, `D-3V0`, `D-4R`, `D-5S`, `D-6` não autorizada); registro normativo **`PBACK-AUD-09`** em `docs/09` §13.4.1, preservando `PBACK-AUD-03` e a nota de revisão; `docs/13` passa a DECIDIDO com §15 (materialização), §§1–14 preservados. **(b) Código:** `autorizacao.negada` como 25ª ação (whitelist vazia — 3 positivas · 22 vazias); emissor novo `AuditoriaNegacaoAutorizacao` em `authz/` (lista fechada = `{senha.recuperar_terceiro}`, transação dedicada, Q2, nunca lança); `PermissoesGuard` emite **só** em permissão ausente/usuário inativo, após decidir e antes de lançar; `AuthzModule` importa `AuditModule`. **Nenhuma** migration, schema, dependência, contrato HTTP ou OpenAPI alterados. **(c) Provas:** 3 suítes unitárias focais (guard +8, emissor 38 novas, validator 25/22 + A-12) e 2 de integração contra PostgreSQL real (recuperação +13, RBAC +1): A-01..A-08, A-10..A-14 provados; A-09 não aplicável (V0); A-15 não medido. **4 mutation challenges** (emissor removido; alvo ≠ permissão; Q2 → `500`; lista ampliada) **detectados e revertidos por hash** — a A-11 foi fortalecida após ficar vacuamente verde na primeira execução. **(d) Bateria integral verde no host** (§7.4.6). **(e) Inalterados:** `L-06`, `R2.2-04`, `P-BACK-01` (EM ANDAMENTO), `AUT-005`; risco de volume (V0) aceito com `AUT-002` não implementada. §7.1, §7.4 (novo), §9, §10 e cabeçalho atualizados. |
| **34** | **05/09/2026** | **ETAPA 2.3D-B / F7 — CONSOLIDAÇÃO, REVISÃO INDEPENDENTE E ENCERRAMENTO DA ETAPA 2.3D** (§6-Q). **Nenhuma alteração de código, teste, schema, migration, OpenAPI, dependência ou configuração.** **(a) `Q-01` RESOLVIDO — não havia conflito normativo.** A revisão da PR [#22](https://github.com/BrunoMNoronha/techlab-fisio/pull/22) apontou, com razão, que `docs/06` §12.7 define T-07 exclusivamente como recuperação de senha, o que parecia pôr `docs/09` §5 em conflito consigo mesmo (`usuario.sessao.revogacao`, ator Administrador, "em massa via T-07" × `usuario.senha.recuperacao_concluida`, ator Usuário). A apuração da **governança** de `docs/09` dissolveu a questão: o cabeçalho declara §§1..11 "insumo decisório histórico, **sem valor normativo próprio**", §12 prevalece, e `D-AUD-01` homologa **apenas os 24 nomes de ações** — não as colunas de ator ou descrição. **`docs/09` NÃO foi alterado**, porque o próprio documento manda preservar §§1..11 intactos e sua regra de precedência já resolve a leitura. **(b) `L-F6-06` PROMOVIDA a `D-2.3D-18`** (`docs/12` §5.18, REV. 9), restrita à T-07, com fundamento declarado como **escolha por eliminação**: nenhuma fonte determina o valor; `NULL` colidiria com o significado vigente da coluna; o Administrador iniciador é factualmente falso e tinha por única base a tabela não normativa de §5; coluna nova é desnecessária. Sem alteração de código; prova regressiva já existente. **(c) `L-F6-07` NÃO promovida:** avaliada separadamente, só uma de suas metades é inequívoca (não emitir `usuario.sessao.revogacao`, já que `docs/05` FC-01 pede auditoria de revogação **administrativa**); a outra — auditar só o sucesso — fica como **`Q-02`**, pendência **não bloqueante**. **(d) Revisão de F1..F6: nenhum defeito de código novo**; registrados como corretos `#registrarAtividade` (atômico, não TOCTOU), a recusa de usuário inativado por `resolverDoUsuario`, os guards fail-closed, a autoria não parametrizável e o fechamento do último TOCTOU do login por `M-03`. **(e) Matriz normativa** `D-2.3D-01`..`D-2.3D-18` + AUT/D-04/RN-005/T-07 sem `SEM PROVA` ou `INCONSISTENTE`; **dois `PARCIAL` declarados** — AUT-002 e AUT-003, ambos escopo não atribuído. **(f) Correções documentais:** baseline de §3 e `P-2.3D-03` **ENCERRADA**. **(g) ETAPA 2.3D ENCERRADA.** Permanecem fora da Etapa: `Q-02`, `P-2.3D-01`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06` (adiada), **AUT-005** e a revogação administrativa de sessão de terceiro. |
| **33** | **05/09/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F6 NA `main` (§6-P.18) + PROMOÇÃO DE DUAS DECISÕES LOCAIS A NORMATIVAS.** O registro da integração é **exclusivamente factual**, no precedente MEDIR → REGISTRAR das REV. 10, 15, 20, 24 e 29: F6 integrada em 05/09/2026 por **merge commit `cbd02eb`** (PR [#20](https://github.com/BrunoMNoronha/techlab-fisio/pull/20)) sobre o HEAD `f6f507f`, `main` `caf2280` → `cbd02eb`, método merge commit, `git diff f6f507f cbd02eb` vazio; CI verde sobre o HEAD integrado (run 33952810239, 3m33s — `test:api` 24 · 595; integração 10 · 386; from-scratch 10 · 87; OpenAPI 19/19; golden 60 169 bytes idêntico). A cronologia dos sete passos do rito está preservada em §6-P.18.1 — em particular, **a correção `M-03` não existia na implementação original**: veio da revisão automatizada da PR, foi reproduzida, corrigida e revalidada antes do merge (§6-P.17). **Acrescentadas duas decisões normativas em `docs/12` (REV. 8):** `D-2.3D-16` (§5.16), promovendo `L-F6-03` — o início da recuperação é operação **sobre terceiro**, com ator vindo da sessão validada e recusa **uniforme no envelope HTTP** (status, código, corpo e cabeçalhos) com alvo inexistente e inativo, declarando expressamente que **não** exige uniformidade temporal e registrando o canal de tempo residual do `FOR UPDATE` como limite conhecido e aceito; e `D-2.3D-17` (§5.17), promovendo `L-F6-05` — a unidade contada no limite de conclusão é a **tentativa admitida**, no ato da admissão e inclusive em caso de sucesso, com alcance **restrito** a essa metade de `D-2.3D-06` e declaração de que `D-2.3D-13` não se aplica a essa dimensão. **`L-F6-07` NÃO foi promovida** (§6-P.18.4): sustentada por `docs/09` §5. **`L-F6-06` NÃO foi promovida e SEGUE PENDENTE** de decisão expressa: `D-2.3D-05` governa o logout do próprio usuário e **não** determina `revogada_por_usuario_id` na revogação em massa de T-07 — a ambiguidade permanece aberta, com o comportamento vigente preservado. **Nenhuma decisão anterior foi modificada, renumerada ou reaberta; `D-2.3D-06` e `D-2.3D-08` estão intactas.** Atualizados o cabeçalho (REV. 33), §6-P.7 (nota de pós-integração; tabela preservada como registro do ato da implementação), §6-P.15 (estado consolidado acrescentado; snapshot anterior preservado como evidência temporal) e §10 item 10. **NENHUMA alteração de código, teste, schema, migration, OpenAPI, dependência ou configuração nesta revisão.** AUT-005 permanece NÃO MATERIALIZADA; **F7 NÃO INICIADA**. |
| **32** | **05/09/2026** | **ETAPA 2.3D-B / F6 — RODADA CORRETIVA PÓS-PR** (§6-P.17), respondendo ao achado **P1** da revisão automatizada na PR #20. **(a) `M-03` corrigido:** a emissão de sessão do login reconferia o digest **apenas** no caminho de rehash; no caminho comum, um login em voo validado contra a credencial já superada emitia sessão **depois** da revogação em massa de T-07, deixando viva uma sessão baseada na senha antiga — frustrando RN-005/T-07. Acrescentada guarda de credencial corrente **incondicional** (`SELECT ... WHERE id = ? AND ativo = true AND senha_hash = ? FOR UPDATE`) abrindo a transação de emissão; `count !== 1` reusa a sentinela `ErroCredencialSuperada` e o `401` uniforme já existentes. Causa removida **na origem** — sem retry, sem captura de SQLSTATE, sem alteração de contrato, schema, OpenAPI ou política de sessão. Ordem de locks `usuario → sessões` idêntica à de `concluir`: nenhum ciclo possível. **(b) Prova nova com entrelaçamento determinístico** (login congelado entre o `verify` e a transação): falha `401→200` na árvore sem a correção, passa com ela; `verify:api-integration` **383 → 384**. **(c) Correção documental:** `L-F6-07A`, ID inexistente, corrigido para `L-F6-07` em duas ocorrências. **(d) Zero drift:** nenhuma migration, enum, índice, constraint, rota ou dependência nova; `docs/12` não tocado; decisões `L-F6-03`/`L-F6-05`/`L-F6-06`/`L-F6-07` seguem pendentes de decisão expressa, com o comportamento vigente preservado. |
| **31** | **03/09/2026** | **ETAPA 2.3D-B / F6 — RODADA CORRETIVA FINAL sobre a mesma working tree não commitada; permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-P.16). Mesma baseline `main` = `origin/main` = `caf2280`, mesma branch `agent/fase2-etapa2.3d-f6-recuperacao-senha`. **Publicação não autorizada: sem commit, push, PR, merge, rebase, tag, release ou deploy.** **(a) `M-01` corrigido:** `iniciar` e `concluir` adquiriam a linha de `usuario` e a do segredo em ordens INVERSAS, fechando ciclo de espera e produzindo `40P01` (→ `500 FALHA_INTERNA`) para início e conclusão simultâneos do mesmo usuário. Estabelecida a ordem **única e global** `usuario → segredo_recuperacao_senha → sessões`: a T-07 abre com `SELECT id FROM usuario ... FOR UPDATE`. Causa removida **na origem** — nenhuma captura de `40P01`, nenhum retry. Preservados uso único, atomicidade de T-07, Argon2 fora da transação, desfechos uniformes, ausência de enumeração, autoria/auditoria, revogação de sessões e contratos HTTP/OpenAPI. **(b) `M-02` corrigido:** a prova antiga (`Promise.all` sobre HTTP) permanecia verde com o `FOR UPDATE` de `iniciar` removido; substituída por prova com **barreira** no `AuditWriter` e **constatação positiva de bloqueio** via `pg_stat_activity`/`pg_blocking_pids()`, com espera balizada e mensagem própria. **(c) Prova nova de `iniciar × concluir`:** dois testes com entrelaçamento controlado por porta de largada e fila FIFO de locks — sem `40P01`, sem `500`, serialização determinística e invariantes de senha/segredo/sessões conferidos. **(d) Mutações:** `FOR UPDATE` de `iniciar` removido → **2 provas falharam** em ~3 s; ordem antiga de locks restaurada em T-07 → **1 prova falhou** em ~3,5 s com `40P01`; ambas revertidas com SHA-256 conferido. Reprodução direta da causa por sonda SQL: ordem antiga `40P01` em **3/3**, ordem nova limpa em **3/3**. **(e) `B-01`/`B-02`/`B-03`:** redações corrigidas (8 detectados + 3 combinados; base efetiva de 16 verificações do `verify:openapi-runtime`, `16 + 3 = 19`; o teste antigo deixou de ser citado como prova do lock). **(f) Bateria integral reexecutada e verde:** `typecheck` 0; `build` 0; `test:api` **24 · 595**; `verify:api-integration` **10 · 383 + 2 pulados**; `test:integration` **10 · 87**; `verify:from-scratch` **10 · 87**; Argon2 e OpenAPI (**19/19**); `smoke:api`; `lint:migrations` (10 · 37); `schema:verify` (golden 60 169 bytes; `migrate diff` 0); `git diff --check` 0. **(g) Zero drift:** `git diff -- packages/` vazio; nenhuma migration, enum, índice, constraint ou dependência nova; nenhuma rota nova. **(h) Fora de escopo, preservados:** `L-F6-05`, `L-F6-06`, `L-F6-07` (pendentes de Bruno), `B-04`, `B-05`, `B-06`. **(i) Higiene:** nenhuma mutação, spec auxiliar ou arquivo temporário na árvore; nenhum contêiner, volume ou banco descartável remanescente; `AGENTS.md` e demais alterações preexistentes preservados. |
| **30** | **03/09/2026** | **ETAPA 2.3D-B / F6 — recuperação segura de senha — IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA; NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-P). Acrescentados §6-P.1..§6-P.15; §10 item 10 atualizado; cabeçalho atualizado. **Nenhuma decisão normativa criada, alterada, renumerada ou reaberta; `docs/12` não tocado; `docs/09` §12 não reaberto; Base Imutável intacta; zero drift de persistência; nenhuma dependência nova.** Divergência de numeração registrada em §6-P.1 (a recuperação de senha é AUT-004; AUT-005 é ativação/inativação e permanece NÃO MATERIALIZADA). Decisões locais `L-F6-01`..`L-F6-11` inventariadas, quatro destacadas para decisão de Bruno. Bateria integral verde (§6-P.13); 11 mutation challenges aplicados — **8 detectados individualmente e 3 cobertos apenas pelos desafios combinados** (§6-P.12, redação corrigida na REV. 31). Publicação não autorizada nesta execução. |
| **29** | **02/09/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F5 NA `main`** (§6-O.8) — registro **exclusivamente factual**, no precedente `MEDIR → REGISTRAR` das REV. 10, REV. 15, REV. 20 e REV. 24. **Nenhuma decisão normativa criada, alterada, renumerada ou reaberta; `D-2.3D-14` e `D-2.3D-15` intactas; `docs/09` §12 não reaberto; Base Imutável intacta; nenhuma linha de runtime, persistência ou dependência tocada** — os arquivos alterados por esta execução documental são `docs/10` e `docs/12` (REV. 7, factual). **(a) Fatos registrados:** `main` antes `91406203cbecb148f395a58adcfeb6b39f825337`; commits da fatia `f4b3015` (implementação + testes), `11612b4` (documentação) e `39ad197` (harness); PR [#18](https://github.com/BrunoMNoronha/techlab-fisio/pull/18); merge commit **`657676b3ff28f6257e522bd987beddeea5e6bf8f`** (merge commit, sem squash/rebase/force-push; parent 1 = `9140620`, parent 2 = `39ad197`), 02/09/2026 20:45:16Z. **(b) Incidente de CI, corrigido antes do merge:** a run [33679640038](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33679640038) passou nas 329 provas de integração e falhou no `globalTeardown` (`DROP DATABASE ... WITH (FORCE)` como `tlf_migrator` contra conexão `tlf_app` ainda viva da suíte do CLI, cujo pool só fecha ociosas após 10 s); reproduzido de forma determinística no host e corrigido com `afterAll(() => cliente.$disconnect())` em `provisionamento-cli.integration.spec.ts` — **somente harness**; run [33680739691](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33680739691) **verde** (3m24s): from-scratch **10 · 87**; `test:api` **21 · 526**; integração **9 · 329** (nada pulado no Linux); Argon2 e OpenAPI **17/17**; Guardas 1–3; golden **60 169 bytes**; smoke verde. **(c) Validação local pós-merge sobre `main` = `657676b`:** `typecheck` 0; `build` 0; `test:api` **21 · 526**; `verify:api-integration` **9 · 327 + 2 pulados** (sinais POSIX); `test:integration` **10 · 87**; `verify:from-scratch` **10 · 87**; `smoke:api` 0; Argon2 **15/15**; OpenAPI **17/17**; Guardas 1–3; golden **60 169 bytes**; `git diff --check` 0; árvore limpa; zero resíduo Docker. **(d) Zero drift:** `git diff 9140620 657676b -- packages/database` = 0 linhas; manifests da raiz inalterados; `apps/api/package.json` +4 scripts; hashes de `schema.prisma`/golden/`protected-objects.json` idênticos aos da integração da F4; 10 migrations; nenhuma dependência nova; nenhuma rota nova. **(e) Estado:** **F5 CONCLUÍDA / HOMOLOGADA / VERSIONADA / INTEGRADA NA `main`**; §6-O passa a registro histórico com marcador **[ESTADO SUPERADO — §6-O.8]**; §10 item 9 riscado. **(f) Pendências preservadas:** AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA e sem fatia atribuída; RN-001 não satisfeita; `P2.2-05` NÃO INICIADA; `R2.2-04` e `P-2.3D-03` com estado vigente; `F5H-03`..`F5H-07` em aberto; risco médio de bloqueio administrativo (§6-N.6). **F6 NÃO INICIADA.** Nenhum deploy, tag ou release. |
| **28** | **01/09/2026** | **SEGUNDA FATIA CORRETIVA DA ETAPA 2.3D-B / F5, pós-homologação técnica — `F5H-01` e `F5H-02` TRATADOS; a FATIA permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-O). Mesma baseline `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337`, mesma branch `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`, mesma working tree não commitada, staging vazio. **Publicação não autorizada: sem commit, push, PR, merge, rebase, tag, release ou deploy.** **Nenhuma decisão normativa criada, alterada, renumerada, reduzida ou reaberta** — `D-2.3D-01`..`D-2.3D-15` seguem exatamente como homologadas, **`D-2.3D-14` e `D-2.3D-15` não foram tocadas** e **`docs/12` NÃO foi alterado nesta rodada**; `docs/09` §12 não reaberto; catálogo e whitelist de auditoria não ampliados; Base Imutável intacta. **(a) Origem:** a revisão técnica independente e adversarial sobre a árvore corrigida devolveu **`B — APTA COM RESSALVAS NÃO BLOQUEANTES`**, com **0 BLOQUEANTES e 0 ALTOS**; reproduziu todas as medições da REV. 27 com números idênticos e provou por **mutação** que a serialização é efetiva — removido o advisory lock do artefato compilado, 4 de 5 rodadas mediram 2 a 4 Administradores; restaurado, 5 rodadas × 6 processos e uma de 12 processos mediram exatamente 1, com zero falhas não contratadas. **(b) `F5H-01` CORRIGIDO** (§6-O.2): o cabeçalho de §6-N e o marcador de §6-N.13 afirmavam, sem marca de data, que `docs/12` não fora tocado e que não existia `D-2.3D-14` — escritos em 29/08/2026 e tornados falsos pela homologação de 31/08/2026, contradizendo §6-N.3 e §6-N.4 na mesma seção. As afirmações foram **datadas** e **retificadas** com blocos de atualização explícitos; **§6-M não foi alterada**, por ser registro histórico declarado da execução inicial. Preservada a distinção material: o que foi homologado em 31/08/2026 são as **duas decisões**, não a fatia. **(c) `F5H-02` CORRIGIDO** (§6-O.3): o comando composto `provisionar` — exposto como `npm run provisionar` e até então sem regressão alguma — ganhou **7 provas** em `provisionamento-cli.integration.spec.ts` (de 29 para **36** casos no arquivo), com processo real do CLI compilado e verificação de estado no PostgreSQL: **P1** banco vazio (saída 0, 1 Administrador, evento com `ator = NULL` e justificativa persistida); **P2** composição idempotente (saída 0, `JA_CONFORME` nos dois estágios, mesma identidade); **P3** outro Administrador existente (saída 1, identidade intrusa não nasce, e o seed **commitou** — transações separadas); **P4** `provisionar --estrito` sobre banco divergente (**saída 3, bootstrap NÃO executado**, identidade solicitada inexistente, matriz canônica aplicada e excedentes preservados por `D-2.3D-14`); **P4b** controle positivo contra vacuidade; **P5** credencial inválida recusada **antes** do seed. **(d) Poder de reprovação medido:** dois mutantes aplicados ao artefato compilado, **ambos mortos** — remover o `return` do curto-circuito derruba P4 pelo código de saída, e preservar a saída 3 executando o bootstrap derruba P4 pela asserção de que `stdout` não contém `bootstrap-admin`; o segundo prova que a regressão detecta a **execução do bootstrap**, não apenas o código de saída. Artefato compilado restaurado e reconstruído, com SHA-256 idêntico ao build limpo. **(e) Nenhuma alteração de comportamento produtivo:** `src/` intocado, códigos de saída inalterados, advisory lock inalterado, nenhuma dependência instalada, `package.json` inalterado nesta rodada. **(f) Bateria integral verde** (§6-O.5): typecheck 0; build 0; `test:api` **21 · 526** (inalterado); integração da API **9 suítes · 327 passed · 2 skipped**; persistência **10 · 87**; `verify:from-scratch` (Guarda 2) 10 · 87; `verify:argon2-runtime` 15/15; `verify:openapi-runtime` 17/17; `smoke:api` verde; Guarda 1 (10 migrations · 37 objetos); Guarda 3 (golden byte a byte **60 169 bytes**, `migrate diff --exit-code` 0); `git diff --check` 0. **(g) Zero drift:** `packages/` com diff vazio; schema, golden e objetos protegidos com hash idêntico; 10 migrations continuam 10. **(h) Fora do escopo e EM ABERTO:** `F5H-03`, `F5H-04`, `F5H-05`, `F5H-06` e `F5H-07`. **(i) Estados preservados:** **AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA**; **RN-001** não declarada satisfeita; **`P2.2-05` NÃO INICIADA**; **`R2.2-04`** e **`P-2.3D-03`** com estado vigente preservado; **F6 NÃO INICIADA**. **Próximo passo: decisão de Bruno Menezes Noronha sobre a homologação da fatia e, somente após autorização própria, o rito de versionamento/integração.** |
| **27** | **01/09/2026** | **DECISÕES NORMATIVAS DA F5 HOMOLOGADAS E CORREÇÕES OBJETIVAS REMEDIDAS; FATIA NÃO INTEGRADA.** Por autorização expressa de Bruno Menezes Noronha, foram acrescentadas a `docs/12` REV. 6: **`D-2.3D-14`**, que fixa a matriz canônica integralmente presente com seed aditivo, preservação/relato de excedentes e `--estrito` convergente com saída 3; e **`D-2.3D-15`**, que fixa `ator_usuario_id = NULL` no bootstrap inaugural, sem identidade sintética e com justificativa operacional obrigatória fora de `contexto`. `L-F5-07` e `L-F5-08` permanecem apenas como aliases históricos. Corrigida a promessa textual incorreta de que o modo estrito não alteraria banco; acrescentada prova de estado simultaneamente parcial e divergente, que confirma reparo da matriz, preservação do excedente e ausência da mensagem “nada foi alterado”; atualizado o rodapé vivo que ainda parava na REV. 20/F4 não iniciada/F5 não iniciada. Medições: typecheck/build verdes; API unit **21 · 526**; integração no host **9 · 320 aprovados + 2 sinais POSIX pulados**; persistência/from-scratch **10 · 87**; Argon2 15/15; OpenAPI 17/17; Guardas 1–3; golden **60 169 bytes**; smoke real verde; `git diff --check` limpo; zero container/volume/banco descartável residual. Nenhum commit, push, PR, merge, tag, release ou deploy. Próximo passo: homologação técnica final da árvore exata e autorização própria para versionamento/integração. |
| **26** | **29/08/2026** | **FATIA CORRETIVA DA ETAPA 2.3D-B / F5, apos DUAS revisoes tecnicas independentes adversariais (veredito consolidado `C — NAO APTO`); permanece NAO HOMOLOGADA / NAO INTEGRADA** (§6-N). Mesma baseline `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337`, mesma branch, mesma working tree nao commitada. **Nenhuma decisao normativa criada, alterada, renumerada ou reaberta; `docs/12` NAO foi tocado; `D-2.3D-09` e `D-2.3D-10` intactas; nenhuma `D-2.3D-14`; `docs/09` §12 nao reaberto; `ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` NAO ampliadas; Base Imutavel intacta.** **(a) `F5-R-01` (ALTO) CORRIGIDO** — as duas revisoes reproduziram, em processos CLI reais contra PostgreSQL real e sob `READ COMMITTED`, **DOIS "primeiros Administradores" com ambos os processos em saida 0**: a verificacao era TOCTOU e a PK `(usuario_id, papel_id)` nao impede identidades distintas. Correcao: **advisory lock transacional unico** `pg_advisory_xact_lock(2337, 5)`, adquirido como PRIMEIRA operacao da transacao, com todas as releituras decisorias sob ele; o digest Argon2 saiu da transacao. Um unico lock para todo o dominio elimina ordem de aquisicao e, com ela, deadlock. **Sem migration e sem dependencia nova.** **(b) `F5-R-02` (MEDIO) CORRIGIDO** — o seed segue **aditivo e nao destrutivo**, mas passa a DETECTAR e RELATAR papeis/permissoes fora do catalogo e associacoes excedentes; `jaConforme` passou a significar "nenhuma escrita **E** nenhuma divergencia"; `seed --estrito` termina com **saida 3** sem alterar o banco. Codigos de terceiros sao **contados, nunca ecoados**. **(c) `F5-R-03` (MEDIO) TRATADO** — `ator_usuario_id = NULL` **mantido** por decisao executiva (sem ator sintetico, sem responsabilizar o usuario recem-criado); passa a constar como **decisao local `L-F5-08`**, e nao como "resolvida por fonte". Mitigacao: `TLF_BOOTSTRAP_ADMIN_JUSTIFICATIVA` **obrigatoria**, validada antes da transacao, sem caractere de controle, persistida em `evento_auditoria.justificativa`, **nunca impressa** e **fora de `contexto`**. **A qualificacao normativa permanece DECISAO PENDENTE de Bruno.** **(d) `F5-R-04` (MEDIO) DOCUMENTADO** — recusa mantida; risco de bloqueio administrativo declarado e **runbook manual controlado** registrado; comando de reparo exige fatia e autorizacao proprias. **(e) `F5-R-05` (MEDIO) RETIFICADO** — §6-M.5 afirmava que os tres agrupamentos eram "sem efeito"; **era falso para um deles** e contradizia §6-M.4. Efeito medido e agora declarado: **37 x 38 associacoes; Fisioterapeuta 8 x 9**. **(f) `F5-R-06`/`F5-R-07` (BAIXOS) CORRIGIDOS** — fronteira de erros do CLI fechada (saida construida a partir de motivo de conjunto fechado; `FALHA_INESPERADA` + incidente para origem desconhecida; nada de `message`/`stack`/`code`); senha recusa **caractere de controle**, precedencia deterministica (ambiente antes de stdin, sem travar em pipe ocioso), leitura limitada a 4096 bytes e 10 s; `SIGINT`/`SIGTERM` com fechamento idempotente e saidas 130/143. **(g) Contextos separados** — `SeedModule` (banco) e `BootstrapModule` (banco + auditoria + credencial); o CLI importa o bootstrap **dinamicamente**, e por isso **`seed` funciona com o runtime Argon2 indisponivel** — provado por sabotador deterministico **com controle positivo** e confirmado no host realmente bloqueado (17 de 28 casos do CLI passam ali). **(h) `L-F5-08`..`L-F5-12`** explicitadas como decisoes locais interpretativas, com efeito quantificado; **a matriz NAO mudou** (4/29/37; 18/3/8/8). **(i) Medicoes — bateria INTEGRALMENTE VERDE nos dois ambientes:** conteiner Linux isolado — `test:api` **21 · 526** (era 21 · 519), integracao da API **9 · 321** (era 8 · 273), Argon2 15/15, OpenAPI 17/17, typecheck e build 0. Host Windows — `test:api` **21 · 526**, `verify:api-integration` **9 · 319 + 2 pulados**, persistencia **10 · 87**, `verify:from-scratch` **10 · 87**, Argon2 15/15, OpenAPI 17/17, **`smoke:api` 0**, Guardas 1-3, golden **60 169 bytes**, `git diff --check` 0. **MUDANCA DE AMBIENTE:** o bloqueio de Application Control do addon Argon2 **deixou de ocorrer no host** (arquivo ainda `NotSigned`; carregamento medido 3/3) — **nenhuma politica da maquina foi alterada**; `smoke:api` e as verificacoes de runtime, antes NAO EXECUTADOS, agora sao medidos e estao verdes. Os **2 pulados** sao `SIGINT`/`SIGTERM`, **pulados explicitamente** por sinais POSIX nao existirem no Windows, e **passam no Linux** (CI em `ubuntu-latest`). **Ressalva:** uma execucao isolada de `test:api` no conteiner acusou 525/526; **nao reproduzida em 7 execucoes**, registrada como transitorio nao identificado (§6-N.11). **(j) Zero drift:** `git diff main -- packages/` **0 linhas**; hashes de schema/golden/objetos protegidos identicos; **10 migrations continuam 10**; manifests da raiz com diff vazio; `apps/api/package.json` +4 linhas de scripts; rotas continuam `/auth/login`, `/auth/logout`, `/health`. **(k) Estados preservados:** **AUT-005 NAO MATERIALIZADA / NAO ENCERRADA / SEM FATIA ATRIBUIDA**; **RN-001** nao declarada satisfeita; **`P2.2-05` NAO INICIADA**; `R2.2-04` e `P-2.3D-03` inalterados; **F6 NAO INICIADA**. **Proximo passo: NOVA revisao tecnica independente e adversarial sobre a arvore corrigida.** |
| **25** | **29/08/2026** | **IMPLEMENTAÇÃO DA ETAPA 2.3D-B / F5 — seed de papéis/permissões e bootstrap do primeiro Administrador** (§6-M), em branch própria `agent/fase2-etapa2.3d-f5-seed-bootstrap-admin`, a partir de `main` = `origin/main` = `91406203cbecb148f395a58adcfeb6b39f825337`. **NÃO HOMOLOGADA / NÃO INTEGRADA; sem commit, push, PR, merge, tag, release ou deploy.** **Nenhuma decisão normativa criada, alterada, renumerada ou reaberta:** `D-2.3D-01`..`D-2.3D-13` intactas; **`docs/12` NÃO foi tocado**; `D-2.3D-09` e `D-2.3D-10` intactas; **nenhuma `D-2.3D-14`**; `docs/09` §12 não reaberto; **`ACOES_AUDITORIA` e `WHITELIST_CONTEXTO` não ampliadas**; Base Imutável intacta. **(a) Materializado:** seed idempotente dos **4** papéis de `docs/04` §3, das **29** permissões de §5 (por REÚSO do catálogo tipado da F4 — nenhum catálogo paralelo) e das **37** associações derivadas célula a célula da matriz de §4 por regra declarada e mecanicamente executada pelo teste; bootstrap **manual**, **idempotente**, **fail-closed**, **atômico** e auditado com `usuario.papeis.alterados` (`SUCESSO`, `alvo_tipo = usuario`, `contexto` vazio, `ator_usuario_id` NULL como **ação de sistema** — `docs/07` §22.3/RN-061, com precedente de `D-2.3D-12`). **(b) Matriz semeada:** Administrador **18** (zero `prontuario.*` — PERM-T01), Gestor **3** somente leitura (**HOM-01** preservado), Recepcionista **8**, Fisioterapeuta **8**; **8 das 29** permissões sem papel algum, todas `P` na fonte. O Administrador **não** recebeu as 29. **(c) Arquivos:** 5 novos em `apps/api/src/provisionamento/`, 3 suítes novas, e **3 linhas** de `scripts` em `apps/api/package.json`. Nenhum outro arquivo tocado. **(d) Provas:** `test:api` **21 · 519** (era 19 · 479); integração da API **8 · 273** (era 7 · 239); persistência **10 · 87**; `verify:argon2-runtime` 15/15; `verify:openapi-runtime` 17/17; Guardas 1–3 verdes; golden **60 169 bytes** byte a byte; `migrate diff --exit-code` 0. Prova do **processo real**: CLI compilado executado três vezes contra PostgreSQL 18 (criação, `JA_CONFORME`, `JA_CONFORME` com identificador normalizado), recusa de conflito e recusa por ausência de senha; e `node dist/main.js` subindo com todas as variáveis de bootstrap definidas **sem semear nada** (todas as tabelas em 0). **(e) Mutation challenges:** **13 aplicados, 13 detectados, 13 revertidos**, com reversão provada por SHA-256. **(f) Zero drift:** `git diff main -- packages/` **0 linhas**; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com SHA-256 idênticos; **10 migrations continuam 10**; nenhuma dependência nova; nenhuma rota nova. **(g) LIMITAÇÃO DE AMBIENTE, preexistente e alheia à F5:** uma política de **Application Control** da máquina local passou a bloquear o addon nativo não assinado do Argon2, derrubando **no host** `test:api` (5 de 21 suites, **4 delas intocadas pela fatia**), `verify:api-integration`, `verify:argon2-runtime`, `verify:openapi-runtime` e `smoke:api`. Tudo que depende de Argon2 foi **medido em contêiner Linux** com `npm ci` limpo e PostgreSQL real; **nenhuma configuração de segurança da máquina foi alterada**. O `smoke:api` versionado **não** foi executado com sucesso no host e isso fica declarado, não mascarado (§6-M.13). **(h) Higiene:** dois bytes NUL não intencionais no separador de chave de `seed-rbac.service.ts` foram detectados e corrigidos; a bateria integral foi **reexecutada** depois da correção. **(i) Estados preservados:** **AUT-005 NÃO MATERIALIZADA / NÃO ENCERRADA / SEM FATIA ATRIBUÍDA**; **RN-001 não declarada satisfeita**; **P2.2-05 NÃO INICIADA**; **R2.2-04** e **P-2.3D-03** com estado vigente preservado; **F6 NÃO INICIADA**. **Próximo passo: revisão técnica independente e adversarial da F5.** |
| **24** | **28/08/2026** | **REGISTRO POS-MEDICAO DA INTEGRACAO DA ETAPA 2.3D-B / F4 NA `main`** (§6-L.8) — registro **exclusivamente factual**, no precedente `MEDIR -> REGISTRAR` das REV. 10, REV. 15 e REV. 20. **Nenhuma decisao normativa criada, alterada, renumerada ou reaberta; nenhuma `D-2.3D-14`; `D-2.3D-09` e `D-2.3D-10` intactas; `docs/09` §12 nao reaberto; `docs/12` NAO foi alterado** (ja registra a F4 como `CONCLUIDA` desde a REV. 5); **Base Imutavel intacta**; **nenhuma linha de runtime, teste, persistencia ou dependencia tocada** — o unico arquivo alterado por esta execucao e `docs/10`. **(a) Fatos registrados:** `main` antes `a9be742c150ebe43df0d03ef9ec1529cff5d780a`; commit unico da fatia `ea8c74dc89b9aae3aba7ca45d3fc597e0253e484` (`feat(authz): implement RBAC guards and decorators`); PR [#16](https://github.com/BrunoMNoronha/techlab-fisio/pull/16); merge commit **`fce62d9a2b79a59a40487c64cc913b2d98049683`**; `main` depois `fce62d9`; metodo **merge commit**, sem squash, sem rebase, sem force-push. Genealogia conferida: parent 1 = `a9be742`, parent 2 = `ea8c74d`. **(b) Commit unico:** ao contrario da F3, nao houve incidente de CI nem correcao de harness — o manifesto SHA-256 dos **17** arquivos de runtime/teste permaneceu identico ao conferido pela segunda revisao independente, do gate inicial ate o commit. **(c) Protecao contra corrida:** HEAD local = HEAD remoto = `headRefOid` = `ea8c74d` (o mesmo SHA validado pela CI); `origin/main` permaneceu em `a9be742`; `merge-base` = `origin/main`; PR `MERGEABLE` / `CLEAN`. **(d) CI verde:** run [33222908307](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33222908307), job `E-16`, **success** em 2m26s sobre `ea8c74d`, com `test:api` **19 · 479**, integracao **7 · 239**, from-scratch **10 · 87**, Guardas 1-3 e golden **60 169 bytes** — contagens **identicas** as medidas localmente, sem divergencia por plataforma. **(e) Validacao pos-merge verde sobre a `main` integrada:** `typecheck` 0; `test:api` **19 · 479**; `verify:api-integration` **7 · 239**; `verify:from-scratch` **10 · 87**; `build` 0; `smoke:api` 0; Argon2 **15/15**; OpenAPI **17/17**; `lint:migrations` e `schema:verify` verdes; arvore limpa. **(f) Zero drift:** `git diff a9be742 fce62d9 -- packages/database` = **0 linhas**; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com hashes **identicos** aos da integracao da F3; **10 migrations**; **zero dependencia nova**. **(g) Pendencias vivas preservadas, sem encerramento implicito:** **AUT-005 NAO MATERIALIZADA / NAO ENCERRADA** e **sem fatia atribuida**; **RN-001** aplicavel e nao satisfeito fora do alcance parcial da `PermissoesGuard` (`L-F4-02` e defesa em profundidade PARCIAL); **`P2.2-05`** (autorizacao clinica contextual) **NAO INICIADA**; `R2.2-04` **ABERTO / MITIGADO PARCIALMENTE**; `P-2.3D-03` **MEDIDA E VERDE, encerramento formal PENDENTE de decisao de Bruno**; TOCTOU mantido como observacao arquitetural. **(h) Fronteiras:** **F5 e F6 permanecem NAO INICIADAS** — nenhum artefato de seed, bootstrap de Administrador ou recuperacao de senha existe em `apps/api/src`; `apps/web` nao existe. **Nenhum deploy, tag ou release.** **(i) Preservacao historica:** §6-L.7 (estado no ato da homologacao, anterior ao merge) e §6-K.13 permanecem **integros e nao reescritos**, marcados como estado superado com remissao explicita. |
| **23** | **28/08/2026** | **ETAPA 2.3D-B / F4 (guards e decorators de autorizacao — RBAC) HOMOLOGADA POR BRUNO MENEZES NORONHA — rito de versionamento/integracao** (§6-L). **(a) Veredito recebido:** a **segunda** revisao tecnica independente adversarial, executada sobre a arvore corrigida de §6-K, devolveu **`A — APTO A HOMOLOGACAO E VERSIONAMENTO`** com **0 BLOQUEANTES, 0 ALTOS, 0 MEDIOS** e **1 BAIXO documental (`R4R2-01`)**. **(b) Autoridade:** homologacao explicita de **Bruno Menezes Noronha** (TLF-BASE-V1 §15, item 1), sobre a MESMA baseline `main` = `origin/main` = `a9be742`, branch `agent/fase2-etapa2.3d-f4-rbac`. **(c) Unica correcao desta execucao — `R4R2-01`, EXCLUSIVAMENTE DOCUMENTAL** (§6-K.6): a redacao afirmava em presente que `apps/api/src/authz/` tem 745 linhas e remetia a §6-K.7, que nao contem contagem; medicao real `wc -l` = **798 linhas em 9 arquivos**. O valor historico (**745 em 8 arquivos**, arvore pre-correcao) foi **preservado**, com retificacao explicita acrescentada. **(d) Zero mudanca tecnica:** manifesto SHA-256 dos 14 arquivos de runtime/teste da F4 **identico** ao conferido pela revisao — nenhuma linha de runtime ou de teste alterada. **(e) Confirmacoes independentes:** `R4-01`..`R4-08` reproduzidos com evidencia propria da revisao; **15 mutation challenges independentes aplicados, 15 detectados, 15 revertidos por hash**; catalogo **29 x 29** com ordem identica; matriz `401` x `403` medida por HTTP real (7 cenarios `401`, `403` sem permissao, `200` com permissao e handler alcancado), sem oraculo. **(f) Bateria independente verde:** `typecheck` 0; `test:api` **19 · 479**; `verify:api-integration` **7 · 239**; `verify:from-scratch` **10 · 87**; `build` 0; `smoke:api` 0; Argon2 runtime **15/15**; OpenAPI runtime **17/17**; Guardas 1-3; golden byte a byte **60 169 bytes**; `git diff --check` 0. **(g) Fronteiras:** **zero drift**, **zero migration**, **zero dependencia nova**; rotas seguem `/auth/login`, `/auth/logout`, `/health`; `AuthzModule` sem controller. **(h) Limites declarados e aceitos:** **AUT-005 NAO MATERIALIZADA / NAO ENCERRADA** (`L-F4-02` e defesa em profundidade PARCIAL; `RN-001` aplicavel e nao satisfeito fora do RBAC); autorizacao clinica contextual (`P2.2-05`) **NAO INICIADA**; TOCTOU declarado como snapshot no instante da guard. **(i) Governanca:** nenhuma decisao normativa criada, alterada, renumerada ou reaberta; `D-2.3D-09` intacta; **nenhuma `D-2.3D-14`**; `docs/09` §12 nao reaberto; Base Imutavel intacta. **F5 e F6 permanecem NAO INICIADAS.** **(j) Publicacao:** nenhum deploy, tag ou release. **Este registro NAO afirma integracao na `main`** — o registro factual do merge (SHA, PR, medicoes sobre a `main` integrada) pertence a execucao documental posterior, pelo precedente `MEDIR -> REGISTRAR` (REV. 15, REV. 20). |
| **22** | **28/08/2026** | **ETAPA 2.3D-B / F4 CORRIGIDA APOS REVISAO TECNICA INDEPENDENTE ADVERSARIAL (veredito `B — APTO COM CORRECOES OBJETIVAS`); permanece NAO HOMOLOGADA / NAO INTEGRADA** (§6-K). Executada sobre a MESMA baseline `main` = `origin/main` = `a9be742`, na mesma branch `agent/fase2-etapa2.3d-f4-rbac`, sobre a working tree nao commitada que a revisao examinou. **Publicacao nao autorizada: sem commit, push, PR, merge, rebase, tag, release ou deploy.** **Nenhuma decisao normativa foi criada, alterada, renumerada ou reaberta — `docs/12` NAO foi tocado, `D-2.3D-09` permanece intacta, NENHUMA `D-2.3D-14` foi criada, `docs/09` §12 nao foi reaberto e a Base Imutavel permanece intacta.** A REV. 21 e a §6-J sao preservadas como registro do estado que foi revisado; as afirmacoes que a revisao provou incorretas ficaram marcadas **[RETIFICADO — §6-K]** e **nenhuma medicao foi reescrita**. **(a) Veredito recebido:** nenhum achado BLOQUEANTE ou ALTO; nenhum bypass alcancavel pelo cliente HTTP; zero drift real; bateria verde; 7/7 mutacoes independentes da propria revisao detectadas. Quatro MEDIOS e quatro BAIXOS. **(b) `R4-01` (MEDIO) CORRIGIDO:** `anexarContextoAutenticado` PRESERVAVA um contexto preexistente, e a revisao mediu a consequencia — o simbolo privado e recuperavel por `Object.getOwnPropertySymbols` de qualquer requisicao ja processada, um contexto SEMEADO sobrevivia a gravacao, e a guard decidia sobre a identidade semeada. Agora a **identidade validada pelo `SessaoService` SEMPRE substitui** o que estiver na requisicao. O teste que exigia nao sobrescrever — e que travava a correcao — **deixou de existir**, substituido por tres provas com controle positivo. O limite do modelo de confianca passou a ser DECLARADO no codigo: a chave de simbolo protege contra o cliente HTTP, **nao** contra codigo do mesmo processo. **(c) `R4-03` e `R4-04` (MEDIOS) ELIMINADOS POR REDUCAO DE SUPERFICIE:** o decorator plural foi **removido** e substituido por **`@RequerPermissao(P)`** — aridade EXATAMENTE 1 garantida pelo tipo, `MethodDecorator` explicito, metadata lida SOMENTE do handler, e `applyDecorators` fundindo metadata + `UseGuards(SessaoAutenticadaGuard, PermissoesGuard)` NA ORDEM. Com isso, declarar sem proteger deixou de ser expressavel (a revisao mediu `200` sem sessao numa rota anotada sem `@UseGuards`), e a superficie de metadata de classe — que sob HERANCA descartava a exigencia da classe-base — deixou de existir. Arquivo novo `permissao-exigida.metadata.ts` para quebrar o ciclo decorator/guard. **(d) `L-F4-01` ENCERRADA POR ELIMINACAO, e NAO por decisao normativa:** a revisao mediu que **nenhuma operacao de `docs/04` §4/§8 exige duas permissoes nomeadas simultaneamente**; a cardinalidade > 1 era abstracao antecipada (TLF-BASE-V1 §4.5) que criava uma decisao comportamental evitavel. Sem a abstracao nao ha `AND` nem `OR` a homologar. **Nenhuma decisao foi pedida nem tomada em nome de Bruno.** **(e) `R4-02` (MEDIO) RETIFICADO, sem mudanca de comportamento:** a redacao que dizia o risco tratado por `L-F4-02` passou a declarar **cobertura PARCIAL** — medido: sessao de conta inativada permanece `ATIVA`, continua valida para o `SessaoService` e obtem `200` em rota apenas autenticada; so onde a `PermissoesGuard` esta aplicada ha `403`. **`AUT-005` permanece NAO MATERIALIZADA e NAO ENCERRADA** e **RN-001 segue aplicavel**, agora com linha propria na tabela viva de §9. `SessaoService.validar` **nao** foi alterado e nenhum `403` virou `401`. O teste declara no proprio corpo que o estado e ARTIFICIAL (escrito direto na persistencia, inalcancavel por rota de producao) e mede explicitamente o limite. **A fatia em que a revogacao por inativacao sera materializada NAO foi fixada por este documento.** **(f) BAIXOS tratados:** `R4-05` — a justificativa do re-export deixou de alegar necessidade medida e passou a declarar a opcao adotada, as tres alternativas medidas e o trade-off de superficie exportada, sem redesenho; `R4-06` — a discrepancia 645 x 745 existiu **apenas no relatorio em chat**, nao contaminou `docs/10` e nenhum arquivo foi omitido; `R4-07` — o comentario do servico passou a distinguir rejeicao antes do banco de string nao-UUID que faz o driver lancar (`500`, fail-closed, inalcancavel pelo cliente), sem validacao nova nem biblioteca; `R4-08` — a redacao distingue rotas FUNCIONAIS de `/openapi.json`. **(g) Bateria integral verde:** typecheck 0; `test:api` **19 suites · 479 passed**; `verify:api-integration` **7 suites · 239 passed**; `verify:from-scratch` 10 suites · 87; build 0; `smoke:api` 6 provas; `verify:argon2-runtime` 15/15; `verify:openapi-runtime` 17/17; Guardas 1, 2 e 3 (golden **60 169 bytes**, `migrate diff --exit-code` 0); `git diff --check` limpo. Os totais coincidem com os da REV. 21 por composicao: a suite do decorator passou de 13 para 12 provas e a da guard de 21 para 22; na integracao, 2 provas de conjuncao sairam e 2 de exigencia por operacao entraram. **(h) 9 mutation challenges** (`C-F4C-01`..`C-F4C-09`) aplicados, **todos detectados**, todos revertidos com **SHA-256 identico** — incluindo regressao de `R4-01`, decorator sem cada uma das guards, ordem invertida, guard sempre permissiva, perda do filtro por `usuario_id`, remocao da negacao por `usuario.ativo`, drift do catalogo e reintroducao de metadata em lista. Registrado com honestidade que `C-F4C-01` e detectado **apenas pela suite unitaria** — a contaminacao de contexto nao e produzivel por HTTP. **(i) Zero drift reconfirmado:** `git diff a9be742 -- packages/database` vazio; tres hashes identicos; 10 migrations; `prisma format`/`migrate dev`/`db push`/`db pull` nao executados. **Nenhuma dependencia nova** — tres `package*.json` com diff vazio. **(j) F1/F2/F3 sem regressao:** nenhum arquivo de `auth/` foi tocado nesta fatia; a unica alteracao em artefato da F3 continua sendo o export aditivo de `POLITICA_COOKIE_SESSAO`. **(k) Fronteiras:** F5 e F6 NAO INICIADAS; AUT-005 NAO ENCERRADA; autorizacao clinica contextual (`P2.2-05`) fora; sem JWT, refresh token, Redis, cache, multitenancy ou frontend; schema nao alterado; nenhum endpoint de negocio novo; nenhuma acao de auditoria nova. **Proximo passo: NOVA revisao tecnica independente e adversarial sobre a arvore corrigida — a F4 NAO esta homologada nem versionavel.** |
| **21** | **28/08/2026** | **ETAPA 2.3D-B / F4 (guards e decorators de autorização — RBAC) IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA — NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-J). Executada na branch `agent/fase2-etapa2.3d-f4-rbac` a partir de `main` = `origin/main` = `a9be742c150ebe43df0d03ef9ec1529cff5d780a`, com árvore limpa e nada staged no gate inicial. **Publicação não autorizada nesta execução: sem commit, push, PR, merge, rebase de publicação, tag, release ou deploy.** **Nenhuma decisão normativa foi criada, alterada, renumerada ou reaberta — `D-2.3D-01`..`D-2.3D-13` seguem exatamente como homologadas, `docs/12` NÃO foi tocado, `docs/09` §12 não foi reaberto e a Base Imutável permanece intacta.** **(a) Materializados:** `D-2.3D-09` e a parte de RBAC de `AUT-003` — catálogo **tipado** dos 29 identificadores de `docs/04` §5 (materialização, não catálogo paralelo, no mesmo precedente de `audit.catalog.ts`); resolução das permissões efetivas por **união** dos papéis, deduplicada, ordenada e determinística; decorator declarativo `@RequerPermissoes(...)`, que apenas declara metadata; `PermissoesGuard` integrada ao mecanismo padrão do NestJS; `SessaoAutenticadaGuard`, que **consome** o `SessaoService` da F2 e a política de cookie de `D-2.3D-07` sem reimplementar nenhum dos dois; e o param decorator `@UsuarioAutenticado()`. **(b) Identidade não controlável pelo cliente:** o contexto autenticado vive sob símbolo **não registrado**, privado do módulo — nenhum corpo, query ou cabeçalho produz propriedade de símbolo no objeto de requisição. Medido com corpo, query string e sete cabeçalhos forjados. **(c) `401` e `403` não se confundem:** a guard de sessão é a única que emite `401`; a de RBAC é a única que emite `403` e nunca autentica. **Falha técnica NÃO é maquiada como negação** — sobe como exceção e vira `500`, preservando a observabilidade, no mesmo racional já homologado do `FiltroErroAutenticacao`. **(d) Onde o RBAC foi aplicado:** em **nenhuma** rota de produção, e nenhuma podia ser — `/health` é infraestrutura, e login/logout são as operações que `docs/04` §4 marca como permitidas a todos os papéis. A guard é provada por integração sobre **controller exclusivamente de teste**, fora de `rootDir: "src"`, ausente do `dist/`, do `AppModule` e do OpenAPI. **As rotas publicadas continuam sendo exatamente `/health`, `/auth/login` e `/auth/logout`** — asserção mecânica, verde. **(e) Cinco decisões locais declaradas** (`L-F4-01`..`L-F4-05`, §6-J.5). **`L-F4-01` — a semântica de composição de múltiplas permissões — é registrada como PENDENTE DE DECISÃO DE BRUNO:** nenhuma fonte a define, adotou-se a **conjunção** por ser a única alternativa conservadora sob a lacuna, e a alternativa oposta **amplia acesso**. **(f) Única alteração em artefato da F3, aditiva e sem mudança de comportamento:** `AuthModule` passou a **exportar** `POLITICA_COOKIE_SESSAO` — provider que já existia — para que a guard de sessão leia o cookie pela fonte única, em vez de resolver uma segunda cópia da mesma configuração de segurança. `imports` e `controllers` do `AuthModule` inalterados; nenhum arquivo de serviço, controller, DTO, filtro, limitador ou OpenAPI da F3 foi tocado. Duas asserções de `auth.module.integration.spec.ts` acompanharam a mudança, ambas mantidas como **igualdade exata**, e um título de teste que a F4 tornou falso foi renomeado. **(g) Bateria integral verde:** typecheck 0; `test:api` **19 suites · 479 passed** (era 16 · 437); `verify:api-integration` **7 suites · 239 passed** (era 6 · 206); `verify:from-scratch` 10 suites · 87 passed; build 0; `smoke:api` 6 provas; `verify:argon2-runtime` 15/15; `verify:openapi-runtime` 17/17; Guarda 1 (10 migrations · 37 objetos), Guarda 2 e Guarda 3 (golden byte a byte **60 169 bytes**, `migrate diff --exit-code` 0) verdes; `git diff --check` limpo. **(h) 13 mutation challenges** (`C-F4-01`..`C-F4-13`) aplicados, **todos detectados**, todos revertidos com reversão **provada por SHA-256** idêntico e `git status` sem resíduo — inclusive guard sempre `true`, negação invertida, papéis ignorados, metadata vazia como permissão irrestrita, permissão lida de cabeçalho, identidade fixa, `AND`→`OR`, perda do filtro por `usuario_id`, `403`→`401`, fail-open em erro técnico, drift do catálogo, identidade lida de propriedade de string e decorator aceitando lista vazia. **(i) Não vacuidade assegurada:** cada caso de integração conta no banco os vínculos `usuario_papel`/`papel_permissao` antes de asserir, lê a resolução efetiva do serviço e confirma, por controle positivo, que o handler é alcançado quando autorizado — nenhum `403` esperado passa por engano de fixture, `404` ou erro anterior ao RBAC. **(j) Regressão de F1/F2/F3 ausente:** as 437 provas unitárias e as 206 de integração anteriores continuam passando, ao lado das 42 e 33 novas; login, logout, sessão, expiração, revogação, rate limiting, cookies, CSRF, contrato de erros, auditoria de autenticação e contrato OpenAPI inalterados. **(k) Zero drift:** `git diff a9be742 -- packages/database` vazio; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com hash idêntico; **10 migrations**, nenhuma nova; `prisma format`, `migrate dev`, `db push` e `db pull` **não** executados. **(l) Nenhuma dependência nova:** `package.json`, `package-lock.json` e `apps/api/package.json` com diff vazio — NestJS e TypeScript bastaram, e nenhum framework de autorização foi introduzido. **(m) Fronteiras:** **F5 NÃO INICIADA** (nenhum seed, associação automática papel↔permissão, bootstrap ou usuário Administrador, senha inicial, comando/endpoint de setup ou variável de bootstrap); **F6 NÃO INICIADA** (a presença de `senha.recuperar_terceiro` no catálogo reproduz o documento e não materializa fluxo); **autorização clínica contextual NÃO INICIADA** (`P2.2-05` fora); sem JWT, refresh token, permission token, Redis, cache, snapshot de permissão na sessão, revogação de sessão de terceiro, CORS cross-origin, multitenancy ou `apps/web`; **nenhuma ação de auditoria nova e nenhuma whitelist ampliada** — `autorizacao.negada` permanece fora do catálogo por `D-AUD-04`/`D-AUD-05`. **(n) Pendências herdadas não alteradas:** `P-2.3D-01`, `P-2.3D-03`..`P-2.3D-06`, `R-2.3D-04`, `R-2.3D-05`, `R-2.3D-06`, `R-2.3D-08`, `F-12`, `F3R-06`, `F3R-07`, `P-BACK-01`, `R2.2-04`, `P2.2-05`, `L-05`..`L-08`. **Próximo passo: revisão técnica independente e adversarial da F4 sobre a árvore exata produzida nesta execução — e NÃO a F5.** |
| **20** | **28/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F3 NA `main`** (§6-I.8) — registro **exclusivamente factual**, no precedente MEDIR → REGISTRAR das REV. 10 e REV. 15. **Nenhuma decisão foi criada, alterada, renumerada ou reaberta** — `D-2.3D-01`..`D-2.3D-13` e `D-AUD-01`..`D-AUD-08` permanecem exatamente como estão — e **nenhuma medição histórica foi reescrita**. **(a) Integração executada em 28/08/2026:** PR [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14) (`agent/fase2-etapa2.3d-f3-auth-http` → `main`), **merge commit `35569727789f6f73b4f81fec3cc94c34d4cb0038`** às 13:39:36Z — método `merge` (sem squash, sem rebase, sem force-push); a `main` passou de **`9a22262`** para **`3556972`**. Os três commits foram preservados como ancestrais: `362aefe` (implementação), `c755fcb` (homologação documental) e `c20cf1c` (correção do harness). **HEAD homologado e validado pela CI: `c20cf1c05ab7a9e306f2df8fd96c009dac9d2fd0`.** **(b) Proteção contra corrida confirmada:** imediatamente antes do merge, HEAD local, HEAD remoto da branch e `headRefOid` do PR coincidiam em `c20cf1c` — o mesmo SHA que atravessou a CI —, `origin/main` permanecia em `9a22262` desde a homologação e `merge-base` = `origin/main`. **(c) Incidente de CI, e sua natureza:** a primeira execução reprovou com `21 failed, 182 passed, 203 total`, **todas as 21 com `getaddrinfo ENOTFOUND [::1]` e nenhuma alcançando a aplicação** — os clientes `node:http` da suíte derivavam o destino de `new URL(baseUrl).hostname`, que preserva os colchetes do IPv6 e falha no Linux enquanto conecta no Windows. Era esse mascaramento por plataforma que fazia a bateria passar `203/203` na máquina de desenvolvimento durante as três revisões. Corrigido em `c20cf1c` com `urlToHttpOptions`, preservando origin-form, query e absolute-form, **sem nenhuma alteração de runtime, controller, service, guard, filtro, limitador, persistência ou contrato REST/OpenAPI** — um único arquivo de teste, `+79 −7`, mais três provas de regressão. **É fato de execução do harness: não cria requisito, não altera decisão e não reabre finding.** **(d) CI verde sobre o HEAD integrado** — run [33176130292](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33176130292), `pass`: E-15 + Guarda 2 **87 passed**; Guarda 3 golden byte a byte e `migrate diff --exit-code` 0; suíte de `apps/api` **16 suites · 437 passed**; **integração com PostgreSQL 18 real 6 suites · 206 passed**; provas de runtime do Argon2id e do OpenAPI verdes. As **21 provas antes bloqueadas passaram a alcançar efetivamente a aplicação**. **(e) Validação local pós-merge integralmente verde:** typecheck 0; `test:api` **16 suites · 437**; `verify:api-integration` **6 suites · 206**; build 0; `smoke:api` **6 provas**; `verify:argon2-runtime` **15/15**; `verify:openapi-runtime` **17/17**; Guardas 1 e 3 verdes; `git diff --check` limpo. Os **206** são as **203** provas anteriores mais **3** regressões do harness — as medições históricas de 203 seguem corretas para os estados em que foram tomadas. **(f) Zero drift na `main` integrada:** `git diff 9a22262 3556972 -- packages/database` vazio; `schema.prisma`, `schema.golden.sql` e `protected-objects.json` com hash idêntico; **10 migrations**, nenhuma nova; `prisma format`, `migrate dev`, `db push` e `db pull` não executados. **(g) Estados mantidos:** riscos residuais aceitos `R-2.3D-08` (BAIXO), `F-12` (BAIXO), `F3R-06` e `F3R-07` (OBSERVAÇÃO); pendências `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `R-2.3D-04`, `R-2.3D-05` e `R-2.3D-06` **não** encerradas por implicação. **(h) `docs/12` não foi tocado** nesta revisão — ele já registra `D-2.3D-01`..`D-2.3D-13`, REV. 4 e a fatia F3 como CONCLUÍDA, e delega a evidência do rito de integração a este documento. **(i) F4, F5 e F6 permanecem NÃO INICIADAS**; nenhum deploy, tag ou release. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **19** | **28/08/2026** | **ETAPA 2.3D-B / F3 HOMOLOGADA — rito de versionamento e integração** (§6-I). **(a) Veredito recebido:** a terceira revisão técnica independente adversarial devolveu **`A — APTO À HOMOLOGAÇÃO E VERSIONAMENTO`**, sem achado BLOQUEANTE, ALTO ou MÉDIO, e confirmou por reprodução própria — não por leitura do relatório — que `F3R-01` e `F3R-03` estão materialmente encerrados. **(b) `F3R-08` (BAIXO) corrigido:** a linha de §9 que ainda classificava a saturação transitória do limitador como “DECISÃO LOCAL declarada” passou a registrar **`D-2.3D-13`** como fonte normativa, com `L-11` explicitamente rebaixada a alias/referência histórica e o risco residual apontado para `R-2.3D-08`. O conteúdo material da decisão **não** foi duplicado em `docs/10`: `docs/12` §5.13 continua sendo a fonte. **(c) Homologação registrada em §6-I**, com escopo, decisões materializadas, as três rodadas de revisão, findings encerrados, riscos residuais aceitos, zero drift e fronteiras. Os cabeçalhos de estado de §6-F, §6-G e §6-H foram atualizados para refletir que aquelas execuções são registro histórico e que a fatia foi homologada — **nenhum fato medido naquelas seções foi alterado**. **(d) Nenhuma decisão `D-2.3D-01`..`D-2.3D-13` foi alterada, renumerada ou reaberta**; a Base Imutável permanece intacta. **(e) Pendências NÃO encerradas por implicação:** `P-2.3D-03`, `P-2.3D-04`, `P-2.3D-05`, `P-2.3D-06`, `R-2.3D-04`, `R-2.3D-05`, `R-2.3D-06`. **(f) Riscos residuais aceitos:** `R-2.3D-08` (BAIXO), `F-12` (BAIXO), `F3R-06` e `F3R-07` (OBSERVAÇÃO). **(g) F4, F5 e F6 NÃO INICIADAS.** **(h) Deploy, tag e release NÃO autorizados e não realizados.** O registro pós-medição da integração na `main` — SHAs do commit, do PR e do merge — segue o precedente das REV. 10 e REV. 15 e será feito em atualização factual própria. |
| **18** | **28/08/2026** | **ETAPA 2.3D-B / F3 — SEGUNDA FATIA CORRETIVA PÓS-REVISÃO INDEPENDENTE; permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-H). Executada sobre a mesma baseline `main` = `9a22262`, na branch `agent/fase2-etapa2.3d-f3-auth-http`. **Publicação não autorizada: sem commit, push, PR, merge, tag ou deploy.** A REV. 17 é preservada como registro do estado que foi revisado. **(a) Veredito recebido:** `B — APTO COM CORREÇÕES OBJETIVAS`, sem nenhum achado BLOQUEANTE ou ALTO; a revisão **reproduziu independentemente** e confirmou `F-01` (concorrência assíncrona real), `F-04` (corrida do rehash contra PostgreSQL real, inclusive com espera de lock e rollback da transação concorrente) e `F-05`. **(b) `F3R-01` (MÉDIO) CORRIGIDO:** o RFC 7230 §5.3.2 obriga a aceitar o request-target absoluto, e o Express o ROTEIA para o login, mas o filtro comparava a URL crua — por essa porta o corpo cru do parser voltava a vazar e o `413` produzia log de nível ERROR com stack trace, acionável SEM cabeçalho algum. O reconhecimento passou a usar o **pathname efetivo** da plataforma (`req.path`, o `pathname` de `parseurl`), medido contra 18 variantes: reproduz EXATAMENTE a decisão do roteador. `new URL()` foi deliberadamente REJEITADO por normalizar demais (colapsa dot segments e transforma `//auth/login` em `/login`), o que faria o filtro capturar rota que o roteador devolve como `404`. **(c) `F3R-02` RESOLVIDO POR DECISÃO DE BRUNO:** a revisão classificou `L-11` como decisão comportamental e recusou homologá-la em nome dele (TLF-BASE-V1 §15); Bruno homologou a opção recomendada e ela virou **`D-2.3D-13`** (`docs/12` §5.13, REV. 3), com o risco residual declarado e aceito como **`R-2.3D-08`**. **Nenhuma decisão anterior foi modificada ou renumerada; `D-2.3D-06` permanece intacta**; `L-11` vira alias histórico. **(d) `F3R-03` (MÉDIO) CORRIGIDO:** a amostra de despejo recomeçava sempre na cabeça do `Map`, onde os bloqueados se fixavam — 2 000/2 000 identificadores novos recusados havendo 49 936 candidatos seguros; e a elegibilidade lia `falhas.length` sem podar. Agora há **cursor persistente** por dimensão (iterador vivo, `next()` O(1), jamais skip-desde-o-início) e **poda local** do candidato amostrado com o instante monotônico da operação. `AMOSTRA_DE_DESPEJO = 64`, as duas guardas de indespejabilidade e o critério de seleção permanecem. **(e) `F3R-04` e `F3R-05` CORRIGIDOS:** `.env.example` deixou de documentar um default/fallback que não existe (a variável é obrigatória e o bootstrap aborta sem ela), e a contagem do smoke foi retificada de 7 para **6**, confirmada por reexecução — mesma classe do achado `A-03` da F2. **(f) NÃO tratados, por estarem fora do escopo autorizado:** `F3R-06` (OBSERVAÇÃO — `Origin` comparada ao `Host` sem allowlist) e `F3R-07` (OBSERVAÇÃO — corrida do rehash consome uma falha do orçamento); **`F-12` permanece BAIXO ACEITO**, agora com a concordância material da revisão. **(g) Testes acrescentados:** 9 em `F3R-01` (incluindo prova de não-vacuidade de que a forma absoluta alcança o handler, ausência de log ERROR, e que a correção não passou a capturar as 10 variantes que o roteador devolve como `404`) e 5 em `F3R-03` (prefixo bloqueado, prefixo maior que a amostra, poda por expiração, reserva em voo intocável, custo limitado). **(h) Bateria integral verde:** typecheck 0; `test:api` **16 suites · 437 passed** (era 432); `verify:api-integration` **6 suites · 203 passed** (era 194); `verify:from-scratch` **10 suites · 87 passed**; build 0; `smoke:api` **6 provas**; `verify:argon2-runtime` **15/15**; `verify:openapi-runtime` **17/17**; Guardas 1 e 3 verdes; `git diff --check` limpo. **(i) 3 mutation challenges novos** (`C-18`..`C-20`) aplicados, **todos detectados**, todos revertidos com verificação por hash. **(j) Defeito de TESTE encontrado pelo próprio challenge `C-20`** — repetindo a lição de `C-03`: a primeira versão do teste de poda era **vacuamente verdadeira**, porque o cursor já alcançava região segura do mapa sem precisar da poda; foi reescrita com buckets **parcialmente vencidos**, que eliminam tanto o cursor quanto a varredura periódica como causas alternativas. **(k) Regressão de F1/F2 ausente** — `credencial.service.ts` e `sessao.service.ts` não foram tocados. **(l) Zero drift** reconfirmado por diff e por hash. **(m) F4/F5/F6 NÃO INICIADAS.** **Próximo passo: NOVA revisão técnica independente adversarial da F3 corrigida — a F3 NÃO está homologada nem versionável.** |
| **17** | **28/08/2026** | **ETAPA 2.3D-B / F3 — CORREÇÕES PÓS-REVISÃO INDEPENDENTE; permanece NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-G). Executada sobre a mesma baseline `main` = `9a22262`, na branch `agent/fase2-etapa2.3d-f3-auth-http`. **Publicação não autorizada: sem commit, push, PR, merge, tag ou deploy.** **Nenhuma decisão `D-2.3D-*` foi criada, alterada ou reaberta; `docs/12` NÃO foi tocado; a Base Imutável permanece intacta. A REV. 16 é preservada como registro do estado que foi revisado.** **(a) Veredito recebido:** `B — APTO COM CORREÇÕES OBJETIVAS`, com catorze achados. **(b) Corrigidos:** `F-01` (ALTO — o gate de `D-2.3D-06` era um check-then-act e não valia sob concorrência: 12 tentativas simultâneas contra o limite 5 produziam 12 execuções de Argon2 e zero bloqueios; agora há RESERVA DE TENTATIVA EM VOO, síncrona, atômica nas duas dimensões e idempotente, com no máximo `limite` chegando ao verificador — provado por barreira determinística); `F-02` (MÉDIO — `TLF_AMBIENTE` passa a ser OBRIGATÓRIA; ausência, vazio ou valor desconhecido abortam o bootstrap, e o processo real prova isso no smoke); `F-03` (MÉDIO — erro 4xx do body parser deixa de virar `500 FALHA_INTERNA` com log de ERRO acionável sem CSRF e sem autenticação: corpo acima do limite agora é `413`); `F-04` (MÉDIO — o rehash exigido por `D-2.3D-02` estava aberto e sem dono, com `precisaRehash` como código morto; foi materializado no login com escrita CONDICIONADA ao digest verificado, Argon2 fora da transação e rollback conjunto); `F-05` (MÉDIO — o despejo por saturação removia justamente a vítima bloqueada, e o racional documentado estava invertido; agora bucket bloqueado ou reservado é indespejável e, sem candidato seguro, a admissão é recusada); `F-06`, `F-08`, `F-09`, `F-10`, `F-13` (BAIXOS); `F-11` (telemetria transitiva `@scarf/scarf` declarada e desligada por `scarfSettings.enabled = false`). **(c) `F-07` resolvido por consequência:** o filtro passou a exigir o método `POST`, e `GET /auth/login` volta ao `404` da plataforma. **(d) `F-12` MANTIDO BAIXO por decisão consciente** — corrigi-lo exigiria acoplamento `auth → audit`, alteração de `packages/database` (vedada por zero drift), duplicação de lógica privada ou abstração prematura. **(e) `F-14` corrigido:** a linguagem de `R-2.3D-04` em §9 era mais forte que a evidência e foi retificada; o risco segue **registrado, não encerrado**. **(f) Correção adicional descoberta durante a correção:** a política de despejo varria o mapa inteiro a cada admissão no teto — O(n) por requisição hostil, transformando a saturação em amplificador de CPU; passou a usar amostra limitada e varredura estritamente periódica. **(g) Defeito de TESTE encontrado pelo próprio challenge `C-03`:** os primeiros testes de saturação eram **vacuamente verdadeiros** (a dimensão de IP saturava antes de o mapa atingir o teto); foram reescritos com não-vacuidade assegurada. **(h) Bateria integral verde:** typecheck 0; `test:api` **16 suites · 432 passed**; `verify:api-integration` **6 suites · 194 passed**; `verify:from-scratch` **10 suites · 87 passed**; build 0; `smoke:api` verde com **seis** provas no processo real; `verify:argon2-runtime` **15/15**; `verify:openapi-runtime` **17/17**; Guardas 1 e 3 verdes; `git diff --check` limpo. **(i) 17 mutation challenges** aplicados, **todos detectados**, todos revertidos com verificação por hash. **(j) Regressão da F2 ausente** — `SessaoService` não foi alterado nesta fatia e seus testes focais seguem verdes. **(k) Zero drift** reconfirmado por diff e por hash. **(l) F4/F5/F6 NÃO INICIADAS**; o rehash de `F-04` não autoriza recuperação de senha. **(m) `P-2.3D-03` permanece MEDIDA e verde, sem encerramento autodeclarado; `R-2.3D-04`, `R-2.3D-05` e `R-2.3D-06` permanecem registrados, sem encerramento autodeclarado** — todos pertencem a decisão de Bruno. **Próximo passo: NOVA revisão técnica independente adversarial da F3 corrigida.** |
| **16** | **27/08/2026** | **ETAPA 2.3D-B / F3 (endpoints REST de autenticação) IMPLEMENTADA E MEDIDA em branch própria — NÃO HOMOLOGADA / NÃO INTEGRADA** (§6-F). Executada na branch `agent/fase2-etapa2.3d-f3-auth-http` a partir de `main` = `9a22262c515c8b97c73dc7cf8493252db07dd501`. **Publicação não autorizada nesta execução: sem commit, push, PR, merge, tag ou deploy.** **Nenhuma decisão normativa foi criada, alterada ou reaberta** — `D-2.3D-01`..`D-2.3D-12` seguem exatamente como homologadas e **`docs/12` NÃO foi tocado**; a Base Imutável permanece intacta. **(a) Materializadas:** `D-2.3D-06` (rate limit 5/15 min por identificador hasheado e 30/15 min por IP, janela deslizante, poda, teto de entradas, `429` uniforme com `Retry-After`, consulta **antes** do Argon2, HMAC de processo em vez de digest simples, sem infraestrutura nova); `D-2.3D-07` (cookie `__Host-tlf_sessao` em produção/homologação e `tlf_sessao_dev` em desenvolvimento, fonte única para `set` e `clear`, fail-fast de bootstrap em três barreiras para `R-2.3D-04`; baseline CSRF com custom header `X-TLF-Requisicao`, `application/json`, Fetch Metadata, `Origin` e **CORS não habilitado**, sem synchronizer token); `D-2.3D-11` (**Caminho A** — `@nestjs/swagger@11.4.7` medido e compatível com ESM/`nodenext` sob `skipLibCheck: false`, decorators explícitos, sem UI servida); `D-2.3D-12` (`usuario.autenticacao`/`FALHA` com `ator NULL`, `alvo` conforme a conta e `contexto {}`; ausente para payload malformado, para recusa CSRF e para `429`), mais a auditoria de FC-01 já normativamente exigida (`usuario.autenticacao`/`SUCESSO` e `usuario.sessao.logout`/`SUCESSO`). **Nenhuma ação de auditoria nova; nenhuma whitelist ampliada; nenhuma chave de `contexto` introduzida.** **(b) `P-2.3D-03` MEDIDA E VERDE** (§6-F.7) — encerramento formal deixado a decisão de Bruno, seguindo o precedente das REV. 1/REV. 2 de `docs/12`; `R-2.3D-06` materialmente afastado com a mesma ressalva de forma. **(c) Dois modos de falha silenciosos medidos e corrigidos:** `@nestjs/swagger@11.4.7` só registra a rota do documento com `raw` incluindo o formato, e uma rota montada depois da inicialização do Nest fica atrás do handler de rota desconhecida. **(d) Um defeito de contrato medido e corrigido:** o erro do body parser vazava fora do contrato fechado das rotas da F3 — `FiltroErroAutenticacao`, com escopo estreito a `/auth/login` e `/auth/logout`, normaliza o corpo e mapeia falha técnica para `500 FALHA_INTERNA`, **jamais `401`**. **(e) Duas ampliações de fronteira, ambas previstas:** `AuthModule` passa a importar `AuditModule`; `SessaoService` ganhou `emitirEm`/`revogarEm` **aditivos**, sem mudança de semântica, para que o evento entre na mesma transação da mutação (`D-AUD-08`). **(f) `T-AUTH-ENUMERATION` provado estruturalmente** (§6-F.10), com medição temporal apenas como evidência (mediana 33,6 ms × 34,9 ms; razão 1,04). **(g) Bateria integral verde** (§6-F.11): typecheck 0; `test:api` **15 suites · 405 passed**; `verify:api-integration` **6 suites · 173 passed**; `verify:from-scratch` **10 suites · 87 passed**; build 0; `smoke:api` verde com duas provas novas no processo real; `verify:argon2-runtime` **15/15**; `verify:openapi-runtime` **15/15** (novo); Guarda 1 verde; Guarda 3 golden byte a byte **60 169 bytes** e `migrate diff --exit-code` **0**; `git diff --check` limpo. **(h) 14 challenges de mutação aplicados, todos detectados e todos revertidos com verificação por hash** (§6-F.12) — nenhuma mutação sobreviveu. **(i) Zero drift de persistência:** `packages/` com diff vazio contra `9a22262`; 10 migrations, nenhuma nova; `prisma format`/`migrate dev`/`db push`/`db pull` não executados. **(j) Uma dependência nova, prevista pela própria decisão:** `@nestjs/swagger@11.4.7`, apenas no workspace `@techlab-fisio/api`; `class-validator`/`class-transformer` são peers **opcionais** e **não** foram instalados. **(k) F4, F5 e F6 NÃO INICIADAS**, e nenhum frontend: as rotas publicadas pela aplicação são exatamente `/health`, `/auth/login` e `/auth/logout` — asserção mecânica na suíte. **Próximo passo esperado: revisão técnica independente adversarial da F3, e NÃO a F4.** |
| **15** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F2 NA `main`** — registro **exclusivamente factual** do rito de versionamento; **nenhuma decisão criada, alterada ou reaberta**; `D-2.3D-01`..`D-2.3D-12` intactas; nenhuma medição anterior reescrita. **(a) Integração:** commit da fatia `289a94b5aab53b24f9635bb9a3503ce541028737` ("feat(auth): implement session service"), PR [#12](https://github.com/BrunoMNoronha/techlab-fisio/pull/12), **merge commit `70b30aebf09368200343d6a5672b267811f337ee`** (pais `f4c2466` + `289a94b`), por **merge commit** — preservando o rito das fatias anteriores (PRs #5, #7, #9, #11). `main` passou de `f4c2466` para `70b30ae`. **(b) Proteção contra corrida verificada imediatamente antes do merge:** SHA remoto da branch = `289a94b` (inalterado desde o push), `main` = `f4c2466` (não avançou desde a baseline), exatamente **1 commit** sobre `main`, `mergeable = MERGEABLE`, `mergeStateStatus = CLEAN`. **(c) Conteúdo do commit:** 9 arquivos, 2 165 inserções, 28 remoções — somente `apps/api/src/auth/**`, testes correspondentes e `docs/10`+`docs/12`. **Nenhum arquivo de `packages/`, `.github/`, `package.json` ou `package-lock.json`.** **(d) CI do PR (branch `289a94b`):** run [33131113044](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33131113044) — **success**, 16 passos, todos verdes, incluindo Guarda 1, E-15 + Guarda 2 (reconstrução from-scratch), Guarda 3 + `migrate diff`, prova de runtime do Argon2id no ESM compilado, suíte de `apps/api`, prova do `exports` público de `@techlab-fisio/database`, integração com PostgreSQL 18 real e bootstrap ESM (`R-BL-02`). **(e) CI da `main` pós-merge (`70b30ae`):** run [33131355234](https://github.com/BrunoMNoronha/techlab-fisio/actions/runs/33131355234) — **success**, **zero passos falhos** (a workflow dispara em `agent/**` e por `workflow_dispatch`; a execução em `main` seguiu o precedente das integrações anteriores). Única anotação: aviso pré-existente de depreciação do Node 20 em `actions/checkout@v4`/`actions/setup-node@v4`, alheio a esta fatia. **(f) Bateria local pós-merge sobre `main` = `70b30ae`, toda verde:** typecheck exit 0; `test:api` **10 suites · 291 passed**; `verify:api-integration` **5 suites · 111 passed**; `verify:from-scratch` **10 suites · 87 passed**; build exit 0; `smoke:api` verde; Guarda 1 verde; Guarda 3 golden byte a byte **60 169 bytes** e `migrate diff --exit-code` **0**. **(g) Zero drift confirmado na `main` integrada:** `schema.prisma`, migrations, `schema.golden.sql` e `protected-objects.json` sem alteração; nenhuma dependência nova; `.github/` intocada. **(h) F3 — endpoints REST de autenticação — NÃO INICIADA.** Nenhum controller, rota, DTO HTTP, cookie, CSRF, rate limiting, OpenAPI, guard, RBAC ou auditoria de autenticação foi introduzido. |
| **14** | **27/08/2026** | **HOMOLOGAÇÃO DA F2 + ENCERRAMENTO DE `R-2.3D-03` + RITO DE VERSIONAMENTO** — decisão de **Bruno Menezes Noronha** (TLF-BASE-V1 §15, item 1). **Nenhuma decisão normativa foi criada, alterada ou reaberta**: `D-2.3D-01`..`D-2.3D-12` seguem exatamente como homologadas; em particular **`D-2.3D-04` NÃO foi tocada**. **(a) `R-2.3D-03` ENCERRADO NA F2** (§9): o risco existia para vigiar o cumprimento da obrigação de monotonicidade atômica de `D-2.3D-04`; a obrigação foi materializada e **provada** por `UPDATE` condicional atômico (predicado inteiro no `WHERE`, nenhuma decisão de escrita em memória), `GREATEST(ultima_atividade_em, instante_candidato)` medido como barreira real, predicado de throttle que exige avanço sobre o valor vigente e portanto **também barra atividade temporalmente regressiva**, testes de integração concorrentes contra PostgreSQL real com espera de lock confirmada em `pg_stat_activity`, mutation challenge de **last-writer-wins** que faz os detectores falharem (3/3 na reprodução independente), e confirmação de que a correção `C-01` de `revogar` **não enfraqueceu** a proteção. **(b) Limites da evidência preservados como limites, não como risco:** prova executada em PostgreSQL sob `READ COMMITTED`, na arquitetura vigente de **PostgreSQL autoritativo compartilhado**, que é precisamente onde a propriedade é sustentada pela operação SQL atômica; escrita distribuída/multi-primary está fora da arquitetura vigente e não é antecipada. **(c) `docs/12` sincronizado apenas FACTUALMENTE** (REV. 2 daquele documento — §8, `R-2.3D-03`), seguindo o precedente já vigente de `P-2.3D-02`/REV. 1: nenhuma `D-2.3D-*` foi alterada. **(d) Histórico preservado:** as REV. 11, 12 e 13 e todas as medições anteriores permanecem intactas como registro factual — inclusive o parecer `MANTER MITIGADO` da revisão independente, que era correto no momento em que foi emitido e foi superado pela decisão de Bruno, não por autodeclaração do agente. **(e) Não corrigido nesta fatia, por decisão de escopo:** as ocorrências históricas de "16/16" herdadas da F1 (§6-D.4 e REV. 11) e os achados `A-02`, `A-04`, `A-05` e `A-06`, que permanecem **observações** e não requisitos homologados. **(f) Rito executado:** bateria completa reexecutada sobre o estado exato levado a commit; commit único em Conventional Commits; branch publicada; PR contra `main`; merge por **merge commit**, preservando o precedente das fatias anteriores; medição pós-merge da `main`. **(g) F3 NÃO INICIADA.** |
| **13** | **27/08/2026** | **REVISÃO INDEPENDENTE DA F2 + CORREÇÕES `C-01`/`C-02`** (branch `agent/fase2-etapa2.3d-f2-sessao`, baseline `f4c2466`) — nenhuma decisão normativa criada ou reaberta; `D-2.3D-01`, `D-2.3D-04` e `D-2.3D-05` **não foram alteradas**; `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` e `docs/12` **não foram tocados**. **(a) Revisão adversarial executada** sobre a árvore não commitada da F2, com veredito **`B — APTO COM CORREÇÕES OBJETIVAS`**: a revisão reproduziu de forma independente a semântica READ COMMITTED, a corrida bloqueada de `R-2.3D-03`, os três challenges de mutação e a bateria completa — não aceitou o relatório anterior como prova. **(b) Achado `A-01` (ALTO), reproduzido**: na ordem anterior, `revogar` executava o `UPDATE` de revogação com predicados temporais antes da detecção de expiração; como um `UPDATE` que casa **zero linhas não adquire lock**, abria-se uma janela de um round-trip em que uma `validar` concorrente com instante ligeiramente anterior renovava `ultima_atividade_em`, a detecção deixava de disparar e o chamador recebia `SESSAO_EXPIRADA` enquanto a linha permanecia `estado = ATIVA`, `encerrada_em = NULL` e o token seguia utilizável — **um logout que falhava em silêncio** (contraria AUT-002). **(c) Correção `C-01`**: a detecção de expiração passou a rodar **antes** da revogação, e o `UPDATE` de revogação passou a exigir **apenas** `id` e `estado = 'ATIVA'` — dois predicados a menos. A janela não foi deslocada, foi **eliminada**: se a sessão está vencida, a detecção a fecha atomicamente **e adquire o lock**, e nenhuma atividade concorrente a reanima (todo `UPDATE` de atividade exige `estado = 'ATIVA'`); se não está vencida, a revogação vence. Depois desta ordem, `revogadas === 0` significa exatamente `estado <> 'ATIVA'`, de modo que a resposta corresponde **sempre** ao estado persistido, sem TOCTOU residual. **(d) Teste de regressão** (2 testes, PostgreSQL real): a validação concorrente é posicionada **deterministicamente** entre os dois statements do logout, com espera até que ela termine **ou** entre em disputa de lock — falhando explicitamente se a corrida não for exercida; a invariante essencial é verificada **no estado persistido** (a sessão nunca permanece `ATIVA` e utilizável quando o logout não a revogou), mais um **controle positivo** que impede a correção de transformar logout legítimo em "expirada". A instrumentação vive **inteiramente no teste** (`jest.spyOn` + `Proxy`): **nenhum hook entrou no código de produção**. **Detecção provada por restauração temporária da lógica anterior** (revertida): o teste falha exatamente na invariante essencial e passa com a correção. **(e) `C-02`**: a REV. 12 registrava `verify:argon2-runtime` como "16/16"; a contagem real medida é **15** verificações `OK` (o script não publica contagem própria). Corrigido em §6-E.7 e na REV. 12. As ocorrências equivalentes em **§6-D.4 e na REV. 11 pertencem à F1 já integrada e foram deliberadamente PRESERVADAS** — reescrever registro histórico de fatia integrada exige decisão própria; fica registrado como imprecisão herdada. **(f) `R-2.3D-03` preservado**: a correção não tocou `#registrarAtividade`; `GREATEST`, o predicado de throttle, o `UPDATE` condicional atômico e o `expira_em` absoluto permanecem intactos. O challenge de last-writer-wins foi **reaplicado sobre o código já corrigido e continua sendo detectado**. Parecer isolado da revisão: **`MANTER MITIGADO`** — o risco **não é encerrado** nesta fatia. **(g) Leitura de `GREATEST` corrigida para melhor**: sonda da revisão mediu que a cláusula `SET` é avaliada sobre a versão **nova** da linha e que, com `WHERE` fraco, `GREATEST` **impediu** a regressão — logo ele é barreira **real**, hoje sombreada por um predicado mais forte, e não código decorativo. **(h) Achados não implementados por decisão de escopo**: `A-02` (TOCTOU de `emitir`), `A-04` (formato estrito de `token_hash`), `A-05` (uniformização HTTP — F3) e `A-06` (relógio do teste) permanecem como **observações**, não como requisitos homologados. **(i) Medições pós-correção**: suíte da API **10 suites · 291 passed**; integração × PostgreSQL 18 real **5 suites · 111 passed** (+2 da regressão de `A-01`); persistência **10 suites · 87 passed**; Guardas 1–3 verdes, golden byte a byte **60 169 bytes**, `migrate diff --exit-code` **0**; `verify:from-scratch`, smoke `R-BL-02`, `verify:argon2-runtime` (exit 0, 15 `OK`), typecheck e build verdes; suíte de sessão **53/53 em 3 execuções**. **(j) Zero drift**: `git diff f4c2466 -- packages/` vazio; blobs de persistência idênticos; nenhuma dependência nova; CI intocada. **(k) NÃO INTEGRADA**: sem commit, push, PR, merge, tag ou deploy. Próximo ato: **homologação final da F2 e decisão de Bruno sobre `R-2.3D-03`, seguida do rito de versionamento** — e não o início automático da F3. |
| **12** | **27/08/2026** | **CORREÇÃO FACTUAL DA F1 + REGISTRO PÓS-MEDIÇÃO DA IMPLEMENTAÇÃO DA ETAPA 2.3D-B / F2** (branch `agent/fase2-etapa2.3d-f2-sessao`, baseline `f4c2466`) — nenhuma decisão normativa criada ou reaberta; `D-2.3D-01`, `D-2.3D-04` e `D-2.3D-05` **não foram alteradas**; `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` e `docs/12` **não foram tocados**. **(a) Correção factual**: a F1 está **INTEGRADA NA `main`** desde 27/08/2026 — merge commit `f4c246648e436c3a50121c371147768bd8403657`, PR [#11](https://github.com/BrunoMNoronha/techlab-fisio/pull/11), commit da fatia `f642b6259b0c916b42d8f8bc77d25258592805a6`. A REV. 11 a registrava como "não integrada" porque a publicação ainda não ocorrera quando aquela revisão foi escrita; as medições de §6-D permanecem intactas. **(b) Implementado e medido** (§6-E): `SessaoService`, `token-sessao.ts` (primitivas puras) e `relogio-sessao.ts` em `apps/api/src/auth/` — fatia técnica **INTERNA**, sem controller, rota, DTO HTTP, cookie, CSRF, rate limiting, OpenAPI, guard, RBAC ou auditoria. **Única mudança de fronteira**: `AuthModule` passou a importar `DatabaseModule` (a sessão é persistida); `AuditModule` continua fora. **(c) Token** (`D-2.3D-01`): forma `<sessao_id>.<segredo>`; persiste-se somente `SHA-256(segredo)`; o segredo sai uma única vez, dentro do token composto, e nunca separadamente. Decisões **locais** declaradas como tais: 256 bits de entropia e `base64url` de 43 caracteres — nenhuma delas elevada a requisito permanente. Parser fail-closed com 20 formas de entrada inválida cobertas; `node:crypto` para CSPRNG e SHA-256, **sem dependência nova**. **(d) Política temporal** (`D-2.3D-04`): 8 h absolutas, 15 min ociosos e throttle de ~1 write/min, com fonte única em `POLITICA_SESSAO` e limites levados ao SQL como instantes calculados, nunca como `interval` duplicado na consulta. As três bordas foram medidas no **instante exato** (`−1 ms` / exato / `+1 ms`), o que exigiu o relógio injetável `RELOGIO_SESSAO` — decisão local, interface de um método, substituída apenas no container de testes. Ausência de escrita sob throttle provada por **`xmin`**, não por inferência. `expira_em` nunca desliza. **(e) `R-2.3D-03`**: monotonicidade **atômica no banco** — UPDATE condicional cujo predicado exige avanço sobre o valor vigente, reavaliado sob o lock da linha em READ COMMITTED, com `GREATEST` como segunda barreira. Provado por **corrida real** com espera de lock confirmada em `pg_stat_activity` (o teste falha se a corrida não for exercida) e por convergência determinística de 5 atualizações fora de ordem. **Três challenges de mutação executados e revertidos**: last-writer-wins **detectado**; remoção do throttle **detectada** (e `GREATEST` sozinho ainda barrou a regressão); remoção de `GREATEST` **não detectada** — registrado honestamente em §6-E.5, com a leitura de que a barreira que sustenta o risco é o predicado condicional e de que `GREATEST` é defesa em profundidade medida, não redundância decorativa. O risco passa a **MITIGADO**, com encerramento **condicionado à revisão independente** — não autodeclarado. **(f) Estados terminais** (`D-2.3D-05`): `ATIVA -> EXPIRADA` e `ATIVA -> REVOGADA` por UPDATE condicional; nenhum statement escreve `ATIVA` fora da criação; logout deriva `revogada_por_usuario_id` da própria linha, tornando impossível atribuir a revogação a terceiro; sessão vencida por ociosidade fecha como `EXPIRADA`, não `REVOGADA`. **(g) Medições**: suíte da API **10 suites · 291 passed** (+1 suite, +42); integração × PostgreSQL 18 real **5 suites · 109 passed** (+1 suite, +51); persistência **10 suites · 87 passed** (sem regressão); Guardas 1–3 verdes, golden byte a byte **60 169 bytes**, `migrate diff --exit-code` **0**; `verify:from-scratch`, `verify:argon2-runtime` (exit 0, **15** verificações `OK` medidas — a REV. 12 originalmente registrou "16/16", número herdado de §6-D.4 sem remedição; corrigido nesta revisão), smoke `R-BL-02`, typecheck e build verdes. **(h) Zero drift**: `git diff f4c2466 -- packages/` vazio e blobs de `schema.prisma`/`protected-objects.json`/`schema.golden.sql` idênticos; nenhum `migrate dev`, `db push`, `db pull` ou `prisma format`. **(i) CI não alterada** — os dois arquivos de teste novos entram pelos passos já existentes. **(j) Ajuste de teste herdado**: a asserção de fronteira da F1 "`AuthModule` não importa nada" virou "importa **exclusivamente** `DatabaseModule`" — ela detectou corretamente a mudança autorizada e continua falhando se qualquer outro módulo aparecer. **(k) NÃO INTEGRADA**: sem commit, push, PR, merge, tag ou deploy. Próximo ato: **revisão técnica independente da F2**. |
| **11** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA IMPLEMENTAÇÃO DA ETAPA 2.3D-B / F1** (branch `agent/fase2-etapa2.3d-f1-credenciais`, baseline `04aa01f`) — nenhuma decisão normativa criada ou reaberta; `D-2.3D-02` e `D-2.3D-03` **não foram alteradas**. **(a) Implementado e medido** (§6-D): `CredencialService` e `normalizarIdentificadorLogin` em `apps/api/src/auth/`, com `AuthModule` registrado no `AppModule` como fatia técnica **INTERNA** — sem controller, rota, DTO HTTP, cookie, sessão, guard, RBAC ou auditoria; o módulo não importa `DatabaseModule` nem `AuditModule`. Política Argon2id **explícita e congelada** (`m=19456`, `t=2`, `p=1`), passada em toda operação para não depender dos defaults do pacote (`m=65536`, `t=3`, `p=4`). **(b) Dependência**: `argon2@0.45.1` verificada no registry ANTES da instalação (`latest`, MIT, `engines.node >= 16.17.0`, tipos próprios) e instalada **apenas** em `@techlab-fisio/api`; raiz e `packages/database` intactos; nenhum `@types/*` adicional. Fato operacional medido: o install script `node-gyp-build` não roda sob o gate `allow-scripts` do npm 11.16, e os prebuilds N-API embarcados (`win32-x64`, `linux-x64`) tornam isso inócuo — **provado**, não presumido. **(c) Dois fatos medidos na biblioteca que moldaram o desenho**: `needsRehash` de `argon2@0.45.1` compara somente `m`/`t`/`p`/`version` e **ignora a variante** (um digest `$argon2i$` com parâmetros vigentes é reportado como em dia) — daí a verificação de variante por prefixo PHC, sem parser artesanal; e `verify` **lança** `TypeError` para digest vazio/sem `$`/truncado, mas devolve `false` para `"$scrypt$x"` — daí o fail-closed que converte ambos em `false` e descarta a exceção original em vez de propagá-la ou registrá-la. **(d) Caminho dummy**: primitiva `verificarComCaminhoDummy` com digest dummy **memoizado como Promise** e aquecido no `onModuleInit` — nenhum `hash()` por tentativa; resultado do caminho ausente **forçado a `false`**, de modo que nem conhecer a senha sintética do dummy autentique. **(e) Medições**: suíte da API **9 suites · 249 passed** (era 6 · 199; **+50 testes**, contra Argon2 real, sem mock da primitiva, **sem asserção de tempo**) — inclui `auth.module.integration.spec.ts`, que resolve `CredencialService` pelo **`AppModule` real** e prova o aquecimento do dummy no ciclo de vida por ordem de fila de microtarefas, com controle negativo; prova de **runtime ESM + addon nativo sobre o `dist/` fora do Jest — 16/16**, agora também como **gate de CI**; smoke `R-BL-02` verde com o `AuthModule` no grafo — prova que o addon nativo é **carregável** no processo ESM real (import estático), **não** o aquecimento do dummy, que é provado pelo teste de integração; integração API × PostgreSQL **4 suites · 58 passed**; persistência **10 suites · 87 passed**; Guardas 1/2/3, golden byte a byte (60 169 bytes), `migrate diff` 0 e **`verify:from-scratch` exit 0** (a F1 não toca `packages/database/prisma`); typecheck e build verdes. **(f) Benchmark `P-2.3D-02`** (§6-D.5), sobre o serviço compilado, sem limiar inventado: `hash` p50 **39,16 ms**, `verify` válido p50 **38,70 ms**, `verify` inválido p50 **39,67 ms**, ~19 MiB/operação; razão válido×inválido **1,025**. Sem ressalva material → **`P-2.3D-02` ENCERRADA**, parâmetros **mantidos**, `D-2.3D-02` **não reaberta**; limitação declarada: medição em máquina de desenvolvimento. **(g) Zero drift físico**: `schema.prisma`, 10 migrations, golden e `protected-objects.json` com hash idêntico a `04aa01f`; `packages/` com diff vazio; nenhum `prisma format`. **(h) Fronteira preservada**: nenhuma busca de usuário, sessão, cookie, CSRF, endpoint, rate limiting, RBAC, OpenAPI, seed, bootstrap de Administrador ou recuperação de senha. **(i) Revisão independente adversarial executada** sobre esta mesma árvore não versionada — veredito **B (apto com correções menores)**, **zero achado bloqueante/alto/médio**. Confirmou por leitura do fonte da dependência e por prova controlada os três fatos em que o desenho se apoia (variante ignorada por `needsRehash`; `timingSafeEqual` no `verify`; gate `allow-scripts` real e sem quebra de `npm ci`, pois `strict-allow-scripts=false`), reproduziu as onze provas obrigatórias e mediu a simetria do caminho dummy (conta inexistente ÷ conta existente = **1,008** de p50, sem asserção de tempo em suíte). **Quatro achados BAIXOS, todos documentais/evidenciais, corrigidos nesta mesma árvore**: `A-01` contradição de estado na linha de revisão vigente — o trecho herdado da REV. 10 passou a estar inequivocamente rotulado como histórico, com o estado corrente declarado ao final; `A-03` o smoke reivindicava aferir o aquecimento do dummy — a redação passou a distinguir o que ele prova (carregabilidade do addon por import estático) do que não prova; `A-02` ausência de teste de fiação pelo container — criado `apps/api/test/auth.module.integration.spec.ts` no precedente de `audit.module.integration.spec.ts`, **verificado por mutação temporária** (remover `AuthModule` do `AppModule` derruba 7 de 9 testes; neutralizar o aquecimento derruba exatamente a asserção correspondente); `A-04` `verify:argon2-runtime` fora do CI — acrescentado a `.github/workflows/ci.yml` imediatamente após o build ESM, primeiro ponto com `apps/api/dist/**` disponível, sem mover etapa alguma; `bench:argon2` **deliberadamente NÃO** virou gate, por ser evidência e não teste. Nenhum arquivo de implementação foi tocado na correção: `credencial.service.ts`, `identificador-login.ts` e `auth.module.ts` permanecem com hash idêntico ao revisado. **(j) Publicação NÃO autorizada nesta execução**: nenhum commit, push, PR, merge, tag ou deploy — a fatia está pronta para versionamento controlado. Base Imutável, `docs/02`..`docs/09`, `docs/11` e as decisões de `docs/12` intactos (em `docs/12`, apenas o estado factual de `P-2.3D-02` foi atualizado). |
| **10** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3D-B / F0 NA `main`** — nenhuma decisão normativa criada ou reaberta neste registro; a baseline normativa da Etapa 2.3D é **`docs/12-decisoes-autenticacao-autorizacao.md`** (`D-2.3D-01`..`D-2.3D-12`, homologadas por Bruno Menezes Noronha em 27/08/2026), aqui apenas **referenciada**. **(a) Escopo entregue**: registro normativo das doze decisões + **única reabertura física controlada** da persistência encerrada da Fase 2, materializando **exclusivamente `D-2.3D-01`** — em `sessao_autenticacao`, `token_hash text NOT NULL` e `ultima_atividade_em timestamptz NOT NULL` (ambas **sem DEFAULT**, deliberadamente) e a CHECK `ck_sessao_autenticacao_atividade` (`ultima_atividade_em >= criada_em` **e** `ultima_atividade_em <= expira_em`, limites inclusivos); `ck_sessao_autenticacao_expiracao` **preservada intacta**; migration única `20260827175151_sessao_autenticacao_token_atividade`; **nenhuma das 9 migrations anteriores modificada**; premissa de tabela vazia **medida** (0 linha) antes de depender dela. `D-2.3D-02`..`D-2.3D-12` permanecem **normativas para as fatias F1..F7**, sem uma linha de implementação. **(b) Integração executada em 27/08/2026**: commit F0 **`89abfd69dcb4b753e45310686f0f1540d0aa5cb6`**, **PR [#9](https://github.com/BrunoMNoronha/techlab-fisio/pull/9)** (`agent/fase2-etapa2.3d-f0-auth-persistencia` → `main`), **merge commit `f612fa7db643a80357ccc488e1ebbf03f459c48c`** — método `merge` (sem squash, sem rebase, sem force-push); pais do merge: **`53f9fc5777759388bfb4bcaa429f4f607733b422`** (baseline) e **`89abfd6`** (HEAD homologado). **Proteção contra corrida confirmada**: imediatamente antes do merge, HEAD local, HEAD remoto da branch, `headRefOid` do PR e `main` remota foram reconferidos e coincidiam com os valores homologados; `git log origin/main..HEAD` mostrava exatamente 1 commit; a `main` **não avançou** durante a revisão; `baseRefOid` do merge = `53f9fc5`, isto é, a integração ocorreu **sobre exatamente a base validada**. **(c) CI**: do HEAD homologado — run **`33102338455`**, **`success`** sobre `89abfd6`, **15/15 passos**; da `main` integrada — o workflow não dispara em push para `main` (somente `agent/**` + `workflow_dispatch`), logo run manual (`workflow_dispatch --ref main`, precedente das REV. 2/5/9) — run **`33105379552`**, **`success`** sobre `f612fa7`, **15/15 passos**. **(d) Medições** (pré-commit na branch, pós-commit no commit real e pós-merge na `main`, com resultados idênticos): **`verify:from-scratch` exit 0 no commit real da branch** — o que **eliminou a ressalva procedimental** da execução de implementação, cuja prova dependera de clone descartável por o script exigir árvore Prisma commitada — **e novamente exit 0 na `main` integrada**; **10 migrations**; **26 CHECKs** no catálogo; persistência **10 suites · 87 passed** (era 9 · 79; +8 desta fatia: 6 em `session-invariants.spec.ts` e 2 na Guarda 2); API **6 suites · 199 passed** (inalterada — nenhuma mudança de comportamento); integração API × PostgreSQL 18 real **4 suites · 58 passed** (inalterada); Guarda 1 (10 migrations · 37 objetos protegidos); Guarda 2 (existência das 26 + efeito da nova CHECK em 23514 + NOT NULL em 23502 + REVOKEs em 42501); **Guarda 3 golden byte a byte (60 169 bytes)** + **`migrate diff --exit-code` 0**; build ESM; F-01; smoke R-BL-02. **(e) Drift físico medido** (golden `53f9fc5` × `f612fa7`): **uma** tabela alterada — `sessao_autenticacao`, +2 colunas e +1 CHECK; tabelas 37→37, enums 8→8, índices 35→35, constraints 109→109, triggers 2→2, funções 2→2, REVOKEs sem alteração (fora do golden por `--no-privileges`, provados pela Guarda 2). `protected-objects.json`: **25 → 26** CHECKs, entrada nova com sua migration de origem. **(f) Governança**: **nenhuma dependência instalada** (`package.json`, `package-lock.json` e manifests de workspace com diff vazio contra `53f9fc5`) — `argon2` e `@nestjs/swagger` seguem **ausentes**; **`prisma format` deliberadamente NÃO executado/aplicado** (reformataria 7 modelos alheios ao escopo — condição preexistente, registrada como pendência de higiene em §9); **nenhum deploy, tag ou release**; **F1 NÃO INICIADA**; Base Imutável, `docs/02`..`docs/06`, `docs/09` §12 e `docs/11` **intactos**. **(g) Efeitos sobre pendências**: `P-2.3D-01` **ENCERRADA** pela absorção editorial de `D-2.3D-01` em `docs/07` REV. 2.2 (§7.1, §10.2, §28.1), realizada na mesma branch documental deste registro; `P-2.3D-02` PENDENTE (F1), `P-2.3D-03` PENDENTE (F3), `P-2.3D-04`/`P-2.3D-05` PENDENTES, `P-2.3D-06` ADIADA, `R-2.3D-03` ABERTO (F2). Pendências **herdadas não foram encerradas por implicação**: `P-BACK-01` EM ANDAMENTO; `R2.2-04` ABERTO / MITIGADO PARCIALMENTE; `L-05`..`L-08` ADIADAS; `P2.2-05` PENDENTE; `R-BL-09` ABERTO/monitorado; `V-06.c` PENDENTE; `F-2.3C-REV-02`/`F-2.3C-REV-03` preservados. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **9** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3C NA `main`** — nenhuma decisão normativa criada ou reaberta. (a) **Homologação**: revisão técnica independente do HEAD **`b386c03bb38b5ba53418255ef3c3f4f84c7b6d1b`** com veredito **APTO COM RESSALVAS NÃO BLOQUEANTES** — `F-2.3C-REV-01` **ENCERRADO**; `F-2.3C-REV-02` (BAIXO/dívida técnica) e `F-2.3C-REV-03` (INFORMATIVO) **deliberadamente não corrigidos** no rito (§9); `T-AUD-CONTEXTO` CONCLUÍDO; `R2.2-04` ABERTO / MITIGADO PARCIALMENTE; FIN-003 sem regressão; drift físico/arquitetural inexistente. CI de homologação: run `33095029980`, `success` sobre `b386c03`. (b) **Integração executada em 27/08/2026**: **PR [#7](https://github.com/BrunoMNoronha/techlab-fisio/pull/7)** (`agent/fase2-etapa2.3c-desconto-whitelist` → `main`), **merge commit `58a6e4bb1e6dfd73ab171b7eae901af5fe78cae7`** — método `merge` (sem squash, sem rebase, sem force-push), com proteção de corrida sobre o HEAD homologado (`--match-head-commit b386c03`); pais do merge: `0a877fc` (baseline) e `b386c03` (HEAD homologado); os **6 commits granulares preservados** como ancestrais da `main` (`89a776b`, `59d611f`, `c3bde46`, `31c2378`, `2e17e9f`, `b386c03`); árvore da `main` integrada **idêntica** à do HEAD homologado (diff de 0 linhas). (c) **CI medida sobre a `main` integrada**: workflow não dispara em push para `main` — run manual (`workflow_dispatch --ref main`, precedente das REV. 2/5) — run **`33096316693`**, **`success`** sobre `58a6e4b`. Bateria local pós-merge também verde: Prisma generate/validate; typecheck; **API unit 6 suites · 199 passed**; **integração API×PostgreSQL 18 real 4 suites · 58 passed**; **persistência 9 suites · 79 passed**; Guarda 1; Guarda 2/from-scratch; Guarda 3 (golden byte a byte 59944 bytes + `migrate diff` exit 0); build ESM; F-01; smoke R-BL-02; `git diff --check`. (d) **Persistência intacta na `main` integrada**: diff zero contra `0a877fc` em `schema.prisma`, migrations, golden, `protected-objects.json`, lockfile e manifests; nenhum endpoint novo; nenhuma dependência. (e) Estados vivos: Etapa 2.3C **CONCLUÍDA/HOMOLOGADA/INTEGRADA**; **`P-BACK-01` EM ANDAMENTO**; **`R2.2-04` ABERTO / MITIGADO PARCIALMENTE**; validação semântica das demais whitelists positivas **PENDENTE**; RBAC de exposição **NÃO IMPLEMENTADO** (fluxos internos sem endpoint); `R-BL-09` ABERTO/monitorado; `V-06.c` PENDENTE. (f) Nenhum deploy, tag ou release; `docs/09`, `docs/11` e Base Imutável intactos. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **8** | **27/08/2026** | **CORREÇÃO PRÉ-HOMOLOGAÇÃO `F-2.3C-REV-01`** (revisão técnica independente do HEAD `31c2378`: NÃO APTO, 1 finding pontual bloqueante; FIN-003/serialização/RBAC/atomicidade/concorrência estruturalmente adequados — não reimplementados). (a) **Causa/impacto** (§6-C.4): o validator aceitava qualquer string/escalar finito nas chaves monetárias homologadas de `cobranca.desconto_aplicado` — um emissor incorreto poderia persistir conteúdo arbitrário (inclusive sensível) numa chave monetária. (b) **Correção**: `ehDecimalMonetarioCanonico()` como fonte única do formato (`audit.catalog.ts`, reutilizada pelo `CobrancaService`); mapa tipado `SEMANTICA_CONTEXTO` por ação/chave aplicado pelo `AuditContextValidator` após as barreiras estruturais; novo motivo estável `VALOR_SEMANTICAMENTE_INVALIDO`; sem conversão/normalização; sem valores em mensagem; **sem regra nova para datas/uuid das demais whitelists positivas** (pendência em §9 — nenhuma ampliação silenciosa de D-AUD-07). (c) **Medições**: API unit **6 suites · 199 passed** (+52); integração PostgreSQL real **4 suites · 58 passed** (+5, 2×) incluindo Cenário A (writer direto com par canônico → commit exato) e Cenário B (`"PACIENTE: ..."`, `"10,00"`, `"10"`, number `10` → rejeição semântica + rollback integral no caminho transacional real); persistência **9 suites · 79 passed**; guardas/golden/`migrate diff`/build/F-01/smoke verdes; zero regressão de FIN-003; diff físico zero. (d) **Efeitos**: `T-AUD-CONTEXTO` mantém **CONCLUÍDO** com evidência ampliada (§8.1); **`R2.2-04` reclassificado ABERTO / MITIGADO PARCIALMENTE** (§7.2) — corrige a alegação de encerramento da REV. 7 (postura conservadora determinada pela revisão: emissor de desconto comprovadamente protegido; demais whitelists positivas ainda sem validação semântica); nota corretiva também para o commit `31c2378`, cuja mensagem alegava "R2.2-04 closed on this branch" — corrigido por este registro, sem reescrita de histórico publicado. (e) Nenhum PR/merge/deploy; a branch retorna à revisão independente. |
| **7** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA IMPLEMENTAÇÃO DA ETAPA 2.3C** (branch `agent/fase2-etapa2.3c-desconto-whitelist`, baseline `0a877fc`). (a) **`P-2.3C-01` RESOLVIDA**: `PROP-RN-2.3C-01` registrada em **`docs/11`** pela reautorização da etapa (aumento-somente; no-op na igualdade; redução rejeitada; `CANCELADO` rejeitado; RN-042 + `recebido_liquido <= valor_liquido_novo` sob serialização da cobrança; situação exclusivamente derivada; nomes canônicos de situação fixados — as formas flexionadas do relatório de chat anterior não constavam de documento versionado, conferido mecanicamente). (b) **Implementado e medido** (§6-C): `CobrancaService.aplicarDesconto` (fatia interna, sem endpoint) com fronteira monetária em string decimal canônica + centavos BigInt (zero float), autorização REAL pela cadeia `Usuario → UsuarioPapel → Papel → PapelPermissao → Permissao` (`financeiro.desconto.aplicar`), lock da linha `cobranca` (mesmo ponto de T-03/T-04/T-05 — `docs/07` §17.3), mutação condicional + evento `cobranca.desconto_aplicado` na MESMA transação com o par homologado de D-AUD-07 como strings. (c) **Medições**: API unit **6 suites · 147 passed** (+28); API integração PostgreSQL 18 real **4 suites · 53 passed** (+32, executada 2×); persistência **9 suites · 79 passed** inalterada; Guardas 1/2/3, from-scratch, golden byte a byte, `migrate diff` 0, build ESM, F-01 e smoke R-BL-02 verdes; diff físico de persistência ZERO; nenhuma dependência nova; nenhum import profundo de Prisma em `apps/api`. (d) **Concorrência medida** (não presumida): desconto×desconto, desconto×pagamento (2 ordens + corrida), desconto×cancelamento, desconto×estorno — par auditado sempre coerente com a ordem serializada; jamais `recebido > líquido` commitado. (e) **Efeitos**: `T-AUD-CONTEXTO` **CONCLUÍDO** com emissor real de contexto não vazio (§8.1); **`R2.2-04` ENCERRADO nesta branch** (§7.2 — efetivação na `main` com a integração); `P-BACK-01` segue EM ANDAMENTO (L-05..L-08, sub-decisões, RBAC de exposição). (f) Nenhum PR/merge/deploy/tag; `docs/09` e Base Imutável intactos; 2.3C aguarda revisão independente/homologação. |
| **6** | **27/08/2026** | **REGISTRO DO BLOQUEIO NORMATIVO DA ETAPA 2.3C (`P-2.3C-01`)** — nenhuma decisão normativa criada; nenhuma implementação executada. (a) A 2.3C foi iniciada em 27/08/2026 na branch `agent/fase2-etapa2.3c-desconto-whitelist` (HEAD de partida `0a877fc`), com challenge normativo obrigatório de FIN-003 **antes de qualquer código**. (b) Resultado do challenge (§6-B): permissão, invariantes de valor, coluna gerada, situação derivada e whitelist positiva estão inequivocamente determinadas pelas fontes; a pré-condição **"cobrança em estado compatível" não é determinável por nenhuma fonte homologada** — `docs/07` §19.2 é circular ("enquanto a cobrança admitir alteração"), RN-046/RN-047 normatizam apenas pagamento, e a alteração de desconto não integra o catálogo T-01..T-09. (c) Conforme a autorização da etapa, a implementação do fluxo foi **interrompida** e o pacote de decisão **`P-2.3C-01`** devolvido a Bruno (relatório de execução). (d) Zero mudança de código; zero mudança física de persistência; `R2.2-04` permanece ABERTO sem evidência nova; nenhum commit/push executado (versionamento condicionado à ausência de bloqueio normativo). (e) Estados vivos: nova pendência `P-2.3C-01` ABERTA (§9); demais estados preservados da REV. 5. |
| **5** | **27/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3B NA `main`** — nenhuma decisão normativa criada ou reaberta. (a) **Homologação**: a 2.3B foi homologada tecnicamente no HEAD **`a96a32839e477f0683386496879f4b46dc103261`** (após revisão independente veredito B e correções `F-REV-01`/`F-REV-02` — REV. 4), com CI de homologação **run `33009026316`, `success`** sobre esse HEAD. (b) **Integração executada em 27/08/2026**: **PR [#5](https://github.com/BrunoMNoronha/techlab-fisio/pull/5)** (`agent/fase2-etapa2.3b-persistencia-provider` → `main`), **merge commit `5aae8de167cf24c95b0efcf27aba554673af91c9`** às 14:49:20Z — método `merge` (sem squash, sem rebase, sem force-push), com proteção de corrida sobre o HEAD homologado (`--match-head-commit a96a328`); pais do merge: `b84ae6a` (baseline) e `a96a328` (HEAD homologado); os **10 commits granulares preservados** como ancestrais da `main` (`4f974e8`, `3b9e7de`, `82c0761`, `d87a395`, `1c1f479`, `030b96b`, `60dcb8b`, `ac6e331`, `04e7b12`, `a96a328`); árvore da `main` integrada **idêntica** à do HEAD homologado (diff de 0 bytes). (c) **CI medida sobre a `main` integrada**: o workflow não dispara em push para `main` (somente `agent/**` + `workflow_dispatch`), então a run foi executada manualmente (`workflow_dispatch --ref main`, mesmo precedente das REV. 20 de `docs/08` e REV. 2 deste documento) — run **`33084407128`**, **`success`** sobre `5aae8de`, todos os passos verdes: instalação pelo lockfile; Prisma generate/validate; typecheck; **Guarda 1**; **E-15 + Guarda 2** (from-scratch + suíte integral de persistência **9 suites · 79 passed**); **Guarda 3 + alarme** (golden byte a byte + `migrate diff --exit-code` 0); build ESM; **suíte da API 5 suites · 119 passed**; **prova F-01**; **integração da API com PostgreSQL 18 real 3 suites · 21 passed** (runtime `tlf_app`, fluxo auditado); **smoke R-BL-02** verde. (d) **Persistência intacta na `main` integrada**: diff zero contra `b84ae6a` em `schema.prisma`, nas 9 migrations, no golden, em `protected-objects.json` e no lockfile (nenhuma dependência nova). (e) **Findings**: `F-REV-01` e `F-REV-02` **ENCERRADOS** (corrigidos, re-medidos e integrados); `F-REV-03` mantido **BAIXO** e `F-REV-04`..`F-REV-08` mantidos **INFORMATIVOS** — não corrigidos por decisão, não bloqueantes (§9). (f) Estados vivos preservados: Etapa 2.3B **CONCLUÍDA/HOMOLOGADA/INTEGRADA**; `P-BACK-01` **EM ANDAMENTO**; `R2.2-04` **ABERTO / PARCIALMENTE EXERCITADO POR PRIMEIRO FLUXO REAL** (encerramento segue exigindo prova com whitelist positiva); RBAC/`profissionais.gerenciar` **NÃO IMPLEMENTADO** — o fluxo `profissional.situacao.alterada` permanece INTERNO, sem endpoint, **não disponível ao usuário**; **2.3C NÃO INICIADA / NÃO AUTORIZADA POR IMPLICAÇÃO**; `R-BL-09` **ABERTO/monitorado**; `V-06.c` **PENDENTE**. (g) Nenhum deploy, tag, release ou publicação de aplicação; `docs/09` e Base Imutável intactos. Nota de manutenção futura (fora deste rito): aviso de depreciação do Node 20 nas actions `checkout@v4`/`setup-node@v4`. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **4** | **26/08/2026** | **CONSOLIDAÇÃO CORRETIVA PÓS-REVISÃO DA ETAPA 2.3B** (revisão técnica independente, veredito **B — apto após correções pontuais**) — nenhuma decisão normativa criada ou reaberta; escopo restrito aos findings autorizados. (a) **`F-REV-01` (documental)**: eliminado o drift factual desta própria página — §5 passou a rotular árvore e contagem (`4 suites · 93`) como **snapshot histórico da 2.3A** com remissão a §6-A; §8.1 deixou de afirmar no presente que a suíte completa da API tem `4 suites · 93 passed`, rotulando o número como medição da 2.3A ampliada pela 2.3B e pela correção `F-REV-02`. Nenhum histórico apagado. (b) **`F-REV-02` (código)**: `ehEscalarJson()` do `AuditContextValidator` passou a aceitar `number` somente quando `Number.isFinite` — `NaN`/`+Infinity`/`-Infinity` (não representáveis em JSON; antes serializados silenciosamente como `null` no `jsonb`) agora são **rejeitados fail-closed** sob o motivo existente `VALOR_NAO_ESCALAR`, sem valor na mensagem, sem sanitização e sem mutação do candidato; §7.3 anotado. **Medições pós-fix**: API unit **5 suites · 119 passed** (11 testes novos: validator NaN/±Infinity rejeitados + finitos `15.5`/`0`/`-0`/`Number.MAX_VALUE` aceitos + mensagens sem valor; AuditWriter com contexto não finito → zero `create`); integração PostgreSQL real **3 suites · 21 passed** inalterada; persistência **9 suites · 79 passed** inalterada; typecheck e build verdes; challenge mecânico sobre o artefato compilado 20/20 PASS. (c) Findings `F-REV-03`..`F-REV-08` (BAIXO/INFORMATIVO) **deliberadamente NÃO alterados** — permanecem documentados no relatório de revisão. (d) A 2.3B **não** está homologada nem integrada por esta REV.; `R2.2-04` segue ABERTO e `P-BACK-01` EM ANDAMENTO; nenhuma mudança em schema/migrations/golden/protected-objects, `docs/09` ou Base Imutável; nenhuma dependência nova; evidência da CI verde do novo HEAD pertence ao relatório de execução. |
| **3** | **26/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA IMPLEMENTAÇÃO DA ETAPA 2.3B** (branch `agent/fase2-etapa2.3b-persistencia-provider`, baseline `b84ae6a`) — nenhuma decisão normativa criada ou reaberta. (a) **Implementado e medido** (§6-A): fábrica pública `criarClientePersistencia` + tipos em `packages/database` (proprietário do Prisma Client; `exports.default` → `dist/src/index.js`, F-01 atualizado); `DatabaseModule`/`DatabaseService` singleton com conexão eager/fail-fast, shutdown limpo e **guarda capability-based de postura de role** em `evento_auditoria` (SELECT/INSERT permitidos; UPDATE/DELETE/TRUNCATE proibidos — role privilegiada aborta o bootstrap); `AuditWriter` transacional (validator sempre no caminho, mapeamento campo a campo, create-only, sem sanitização, sem valores em erro); fluxo interno `profissional.situacao.alterada` (PRO-005) com mutação condicional + evento na mesma transação, whitelist vazia, justificativa NULL, `correlacao_id` único por operação. (b) **Limite de autorização registrado**: sem controller/endpoint/rota; "ator existente/ativo" = integridade; "ator autorizado" = NÃO implementado (RBAC pendente) — §6-A.4. (c) **Medições**: API integração **3 suites · 21 passed** contra PostgreSQL 18 real como `tlf_app` (postura, rejeição do migrator, atomicidade commit/rollback reais, concorrência com exatamente um vencedor/evento); API unit **5 suites · 108 passed**; persistência **9 suites · 79 passed**; Guardas 1/2/3 verdes; golden byte a byte (59944 bytes); `migrate diff` exit 0; F-01 verde; smoke R-BL-02 adaptado verde; `git diff` vazio em schema/migrations/golden/protected-objects contra `b84ae6a`. (d) **Fato técnico medido**: proxy transacional do Prisma 7.9.1 remove `$connect`/`$disconnect` e mantém `$transaction` (§6-A.2). (e) Estados atualizados: `P-BACK-01` EM ANDAMENTO (primeiro fluxo emissor real existe); **`R2.2-04` ABERTO / PARCIALMENTE EXERCITADO POR PRIMEIRO FLUXO REAL** (encerramento exige futura prova com whitelist positiva — candidato `cobranca.desconto_aplicado`, sem autorizar 2.3C); `R-BL-09` remedido sem alteração; demais estados mantidos. (f) Nenhuma migration/schema/golden alterado; `docs/09` e Base Imutável intactos; nenhum merge/deploy/tag/release executado. |
| **2** | **26/08/2026** | **REGISTRO PÓS-MEDIÇÃO DA INTEGRAÇÃO DA ETAPA 2.3A NA `main`** — nenhuma decisão reaberta. (a) **Integração executada em 26/08/2026**: **PR [#3](https://github.com/BrunoMNoronha/techlab-fisio/pull/3)** (`agent/fase2-etapa2.3a-backend-foundation` → `main`), **merge commit** `791e862f17f77cfafe74d39bad866b11c15c0e98` às 09:07:38Z — método `merge` (sem squash, sem rebase, sem force-push), com proteção de corrida sobre o HEAD aprovado `9d7dcd5`; os **5 commits granulares preservados** como ancestrais da `main` (`b839eb6`, `dd24897`, `bb29caf`, `9d80303`, `9d7dcd5`); árvore da `main` integrada **idêntica** à do HEAD aprovado (diff de 0 bytes). (b) **CI medida sobre a `main` integrada**: o workflow não dispara em push para `main`, então a run foi executada manualmente (`workflow_dispatch --ref main`, precedente da REV. 20 de `docs/08`) — run **`32951372071`**, **`success`** sobre `791e862`, todos os passos verdes: instalação pelo lockfile; Prisma generate/validate; typecheck; **Guarda 1**; **E-15 + Guarda 2** (reconstrução from-scratch + suíte 9 suites · 79 passed); **Guarda 3 + alarme** (golden byte a byte); build ESM dos workspaces; **suíte da API 4 suites · 93 passed** (incl. `T-AUD-CONTEXTO`); **prova runtime do `exports.default` (F-01)**; **smoke ESM de bootstrap (R-BL-02)** com `/health` 200, 404 e cleanup. (c) **Persistência intacta na `main` integrada**: `schema.prisma`, as 9 migrations e o golden byte a byte idênticos; Guardas 1/2/3 verdes na run acima. (d) Estados mantidos: Etapa 2.3A **CONCLUÍDA/HOMOLOGADA/INTEGRADA**; `R-BL-02` **ENCERRADO**; `T-AUD-CONTEXTO` **EXECUTADO/PASSED**; `P-BACK-01` **EM ANDAMENTO**; `R2.2-04` **ABERTO/TRANSFERIDO**; `L-05..L-08` **ADIADAS**; `R-BL-09` **ABERTO** (aceitação temporária monitorada); `V-06.c` **PENDENTE**. (e) **Nenhuma Etapa 2.3B iniciada**; nenhum deploy, tag ou release; `docs/09` e a Base Imutável intactos. Este registro entra na `main` por branch documental curta + PR com merge commit (MEDIR → REGISTRAR). |
| **1** | **26/08/2026** | Criação do documento. Registro da Etapa 2.3A (CONCLUÍDA/HOMOLOGADA — revisão independente, veredito A); correção dos findings `F-01` (prova runtime do `exports.default` na CI) e `F-03` (cleanup garantido do smoke); correção do `F-02` neste registro (contagem correta: 88 testes de auditoria = 83 unitários + 5 integração; suíte da API 4 suites · 93 passed); `R-BL-02` ENCERRADO; `T-AUD-CONTEXTO` EXECUTADO/PASSED; `P-BACK-01` EM ANDAMENTO; `R2.2-04` ABERTO; hardening de escalares registrado como decisão técnica local (§7.3). Handoff recebido de `docs/08` REV. 21 |

---

**Fim — `docs/10-backend-implementacao.md` — REV. 36 — documento mutável; estado vivo das pendências da frente de backend.**

**Estado corrente das etapas.** Etapa 2.3A **INTEGRADA NA `main`** (merge `791e862`); Etapa 2.3B **CONCLUÍDA/HOMOLOGADA/INTEGRADA** (merge `5aae8de`); Etapa 2.3C **CONCLUÍDA/HOMOLOGADA/INTEGRADA** (merge `58a6e4b`; `P-2.3C-01` resolvida por `PROP-RN-2.3C-01`, `docs/11`).

**Etapa 2.3D-B, por fatia:**

| Fatia | Estado | Rito |
| --- | --- | --- |
| **F0** — decisões + persistência de sessão | **CONCLUÍDA / HOMOLOGADA / INTEGRADA** | commit `89abfd6`, PR #9, merge `f612fa7`; `P-2.3D-01` encerrada por `docs/07` REV. 2.2 |
| **F1** — `CredencialService` / Argon2id | **CONCLUÍDA / INTEGRADA** | commit `f642b62`, PR #11, merge `f4c2466`; revisão independente veredito **B**, achados `A-01`..`A-04` corrigidos; `P-2.3D-02` ENCERRADA pelo benchmark (§6-D.5) |
| **F2** — `SessaoService` | **CONCLUÍDA / HOMOLOGADA / INTEGRADA** | commit `289a94b`, PR #12, merge `70b30ae`; revisão independente veredito **B**, correções `C-01`/`C-02`; `R-2.3D-03` **ENCERRADO** (§9) |
| **F3** — endpoints REST de autenticação | **CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** | commits `362aefe`, `c755fcb`, `c20cf1c`; PR [#14](https://github.com/BrunoMNoronha/techlab-fisio/pull/14), merge **`3556972`**; **três** revisões independentes (`B`, `B`, **`A`**) e duas fatias corretivas; `L-11` homologada como **`D-2.3D-13`** (§6-F a §6-I; REV. 20) |
| **F4** — guards e decorators de autorização (RBAC) | **CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** | commit `ea8c74d`, PR #16, merge `fce62d9`; duas revisões independentes (`B`, `A`) |
| **F5** — seed de papéis/permissões + bootstrap do Administrador | **CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** | commits `f4b3015`, `11612b4`, `39ad197`; PR #18, merge `657676b` (02/09/2026); `D-2.3D-09`, `D-2.3D-10`, `D-2.3D-14`, `D-2.3D-15`; §6-M a §6-O.8; REV. 25–29 |
| **F6** — recuperação de senha | **CONCLUÍDA / HOMOLOGADA / INTEGRADA NA `main`** | PR #20, merge `cbd02eb` (05/09/2026); `D-2.3D-08`, `D-2.3D-16`, `D-2.3D-17`; §6-P/§6-P.18; REV. 30–33 |
| **F7** — consolidação, revisão independente e encerramento da Etapa 2.3D | **CONCLUÍDA — ETAPA 2.3D ENCERRADA em 05/09/2026** | PR #22, merge `c4c9ba2`; `D-2.3D-18`; §6-Q; REV. 34 |

**Pendências vivas:** `P-BACK-01` EM ANDAMENTO; `R2.2-04` ABERTO / MITIGADO PARCIALMENTE (§7.2); `P-2.3D-04`, `P-2.3D-05` e `P-2.3D-06` abertas/adiada (`P-2.3D-03` ENCERRADA — §6-Q, REV. 34); `R-2.3D-04`, `R-2.3D-05` e `R-2.3D-06` registrados sem encerramento autodeclarado. **Riscos residuais aceitos:** `R-2.3D-08` (BAIXO), `F-12` (BAIXO), `F3R-06` e `F3R-07` (OBSERVAÇÃO). `L-05` e `L-08` (política) DECIDIDAS em 05/09/2026 (`docs/09` §13); **`L-07` DECIDIDA (`PBACK-AUD-09`, `docs/09` §13.4.1), IMPLEMENTADA e INTEGRADA NA `main` em 05/09/2026 — PR #23, merge `e1459f6`** (§7.4, §7.4.8); **`L-06` ABERTA / BLOQUEADA** (§13.3), com retomada obrigatória antes de qualquer superfície de leitura clínica; materialização técnica de `L-08` e visualizador de auditoria PENDENTES; `R-BL-09` ABERTO/monitorado; `V-06.c` APROVADA em 05/09/2026 (`apps/web` integrado na `main` pela PR #24, merge `80986e7` — `docs/08` REV. 22–25); `R-BL-03` residual e ABERTO; **AUT-005 NÃO MATERIALIZADA**; revogação administrativa de sessão de terceiro **NÃO IMPLEMENTADA**.

**Fontes normativas:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`, `docs/02`..`docs/07`, `docs/08` (baseline técnica), `docs/09` §12 (`D-AUD-01`..`D-AUD-08`), `docs/11` (`PROP-RN-2.3C-01`) e **`docs/12` (`D-2.3D-01`..`D-2.3D-18`)**.
