# Pacote de Decisão L-07 — Auditoria de negações de autorização na rota `POST /auth/recuperacao-senha`

> **Documento:** `docs/13-pacote-decisao-l-07-negacoes-autorizacao.md`
> **Projeto:** TechLab Fisio
> **Frente:** backend — `P-BACK-01` (auditoria), pendência `L-07` de `docs/09` §3
> **Status:** **DECIDIDO POR BRUNO MENEZES NORONHA EM 05/09/2026 (`D-0a`, `D-1R`, `D-2Q2`, `D-3V0`, `D-4R`, `D-5S`, `D-6 NÃO AUTORIZADA`) — REGISTRO NORMATIVO EM `docs/09` §13.4.1 (`PBACK-AUD-09`); IMPLEMENTAÇÃO MATERIALIZADA E MEDIDA EM BRANCH PRÓPRIA (§15); PUBLICAÇÃO NÃO AUTORIZADA.**
> **Data:** 05 de setembro de 2026 (preparação — §§1–14); 05 de setembro de 2026 (decisão e implementação — §15)
> **Natureza:** §§1–14 são preservados **como a proposta submetida à decisão** (insumo decisório histórico, sem valor normativo próprio — mesmo precedente de `docs/09` §§1–11). **§15 registra a decisão e a materialização.** O valor normativo está em `docs/09` §13.4.1; onde §§1–14 divergirem dele, **`docs/09` §13.4.1 prevalece**. O estado vivo da implementação está em `docs/10` §7.4.
> **Por que um documento próprio:** o precedente do projeto para pacotes decisórios é o documento dedicado (`docs/09` para `P-E14-01`, `docs/11` para `P-2.3C-01`). A nota de revisão de `docs/09` §13.4 já registrou o achado; um pacote com contrato, desenho técnico, análise de abuso e matriz de testes não cabe numa nota sem confundir proposta com registro homologado.

---

## 1. Fatos confirmados (código, módulos e testes — verificados nesta sprint, não presumidos)

| # | Fato | Evidência |
| --- | --- | --- |
| F-01 | `POST /auth/recuperacao-senha` declara `@RequerPermissao("senha.recuperar_terceiro")` | `apps/api/src/recuperacao-senha/recuperacao-senha.controller.ts:100` |
| F-02 | O controller é registrado por `RecuperacaoSenhaModule`, importado no `AppModule` — é módulo efetivo da aplicação, não fixture de teste | `apps/api/src/app.module.ts:23`, `:35` |
| F-03 | **Ordem dos guards:** `ProtecaoCsrfGuard` (classe, `:94`) → `SessaoAutenticadaGuard` → `PermissoesGuard`; as duas últimas instaladas por `@RequerPermissao` via `UseGuards(SessaoAutenticadaGuard, PermissoesGuard)`. O próprio controller documenta a ordem | `recuperacao-senha.controller.ts:27-29`; `apps/api/src/authz/requer-permissao.decorator.ts:79` |
| F-04 | **O corpo NÃO é lido nem validado antes da negação.** `@Body() corpo: unknown` é validado por `validarCorpoIniciarRecuperacao` **dentro do handler**, que só executa se todas as guards aprovarem. Consequência: no ponto do `403`, o alvo pretendido (usuário cuja senha se quer recuperar) **não existe como dado confiável** | `recuperacao-senha.controller.ts:158-163` |
| F-05 | **Dados confiáveis no ponto da negação:** `usuarioId` e `sessaoId` do contexto autenticado (ambos lidos da **linha persistida** da sessão, nunca do pedido); a permissão exigida (metadata do handler, do servidor); o motivo tipado interno (`USUARIO_INEXISTENTE`, `USUARIO_INATIVO`, permissão ausente, metadata ausente/inválida, contexto ausente); o handler/rota; o IP do socket (`extrairIp`, `auth.controller.ts:106`). **Nada** do corpo, query ou cabeçalhos do cliente | `apps/api/src/authz/sessao-autenticada.guard.ts` (`anexarContextoAutenticado`); `authz/contexto-autenticado.ts:55-58`; `authz/permissoes.guard.ts` |
| F-06 | **`PermissoesGuard` não emite auditoria** — por fronteira declarada, não esquecimento (comentário "SEM AUDITORIA DE NEGAÇÃO") | `apps/api/src/authz/permissoes.guard.ts` |
| F-07 | **A negação `403 ACESSO_NEGADO` não gera log técnico.** Não há `Logger` em `apps/api/src/authz/`; o `FiltroErroAutenticacao` responde `HttpException` com código de fronteira **sem logar** e só emite `logger.error` para falha **inesperada** (`500`) | `grep Logger apps/api/src/authz/` (vazio); `apps/api/src/auth/erro-autenticacao.filter.ts:255-292` |
| F-08 | **Conclusão de F-06 + F-07:** hoje uma tentativa negada de iniciar recuperação de senha de terceiro **não deixa rastro algum** — nem em `evento_auditoria`, nem em log. *(Corrige a afirmação da nota de revisão de `docs/09` §13.4, que dizia "visível apenas em log técnico" — estava errada.)* | idem |
| F-09 | **Distinção dos desfechos na rota de início:** `403 REQUISICAO_NAO_AUTORIZADA` (CSRF, antes da sessão); `401 SESSAO_INVALIDA` (sem sessão/revogada/expirada — **não** é negação de autorização); `403 ACESSO_NEGADO` (negação deliberada de autorização, única elegível); `400 REQUISICAO_INVALIDA` (payload); `422 ALVO_NAO_ELEGIVEL` (recusa de **negócio**, uniforme — `D-2.3D-16`); `500 FALHA_INTERNA` (falha técnica, logada com correlação) | `recuperacao-senha.controller.ts:113-156`; `permissoes.guard.ts` ("falha técnica sobe como exceção e vira 500") |
| F-10 | `PermissoesService.resolverDoUsuario` já abre transação própria **somente para leitura** (`this.database.transacao`) — a decisão de negar é tomada **fora** dela, no guard | `apps/api/src/authz/permissoes.service.ts:128-135` |
| F-11 | `AuditWriter.registrar(tx, evento)` **exige cliente transacional** e faz `tx.eventoAuditoria.create` após o validator | `apps/api/src/audit/audit-writer.ts` (`exigirClienteTransacional`) |
| F-12 | `DatabaseService.transacao(corpo)` é a única fronteira transacional pública (`$transaction` interativa) | `apps/api/src/database/database.service.ts:184-194` |
| F-13 | **Schema `evento_auditoria`:** `ator_usuario_id` **nullable** com FK `Restrict` para `usuario`; `acao` NN; `alvo_tipo` **NOT NULL**; `alvo_id` nullable, **sem FK**; `resultado` NN; `correlacao_id` **NOT NULL**; `contexto` jsonb nullable. Índices IDX-U1 `(alvo_tipo, alvo_id, ocorrido_em)`, IDX-U2 `(ator_usuario_id, ocorrido_em)`, IDX-U3 `(correlacao_id)` | `packages/database/prisma/schema.prisma`, `model EventoAuditoria` |
| F-14 | Tabela **`permissao`** existe: `id uuid`, `codigo text unique` (os 29 códigos de `docs/04` §5), `nome` | `schema.prisma`, `model Permissao` |
| F-15 | **Nenhuma limitação alcança a negação do início.** O `LimitadorRecuperacao` é aplicado apenas na **conclusão** (`service.ts:268`, por IP); o limitador de login só no login; a `ProtecaoCsrfGuard` e a sessão barram anônimos, mas **não limitam** um usuário autenticado repetindo a tentativa negada | `recuperacao-senha.service.ts:268`; `controller.ts:236` |
| F-16 | Existe primitiva reutilizável de limitação em memória: `DimensaoLimite` (`auth/dimensao-limite.ts`), com `JANELA_MS`, `MAXIMO_DE_ENTRADAS` e despejo amostrado — infraestrutura **já existente**, não nova | `apps/api/src/auth/dimensao-limite.ts:35-134` |
| F-17 | **Cobertura de testes existente sobre a negação real:** sem sessão → `401` e zero segredos/zero eventos (`:442`); sessão revogada → `401` (`:451`); autenticado **sem** a permissão → `403 {erro:"ACESSO_NEGADO"}`, inclusive portando `usuarios.gerenciar`+`permissoes.gerenciar`, zero segredos e **zero eventos `usuario.senha.recuperacao_iniciada`** (`:460-471`); sem header CSRF → `403 REQUISICAO_NAO_AUTORIZADA` (`:474`). O mecanismo genérico tem 20+ casos em `authz-rbac.integration.spec.ts` (casos A–G) sobre controller de teste | `apps/api/test/integration/recuperacao-senha.integration.spec.ts:440-485`; `authz-rbac.integration.spec.ts:285-628` |
| F-18 | **Integrado ≠ implantado.** A rota está na `main` desde o merge da F6 (`cbd02eb`, PR #20). `docs/10` **não registra** nenhum ambiente de produção implantado, deploy ou go-live; as únicas menções a "produção" são condicionais ("antes do go-live", "CI de produção/deploy" como reavaliação futura). Não há evidência de implantação — e este documento não a presume | `docs/10` §9 (linhas 235, 3590) |
| F-19 | O valor `NEGADO` de `D-AUD-02` é homologado e tipado, e **nenhum emissor** o usa (`grep 'resultado: "'` → 7 `SUCESSO`, 1 `FALHA`) | `apps/api/src/**` |

## 2. Lacunas e hipóteses (o que NÃO está provado)

| # | Item | Classificação |
| --- | --- | --- |
| H-01 | "A negação nesta rota tem alto valor forense" | **Hipótese razoável, não fato.** Deriva da natureza da operação (sobre terceiro, privilégio alto — `D-2.3D-16`), não de incidente medido. Nenhum evento real foi observado; não há produção |
| H-02 | "O volume de negações é baixo" | **Hipótese sem medição.** Não existe telemetria, produção nem série histórica. Validação futura: contagem de `403 ACESSO_NEGADO` por janela em ambiente real |
| H-03 | "Custo de um `INSERT` em `evento_auditoria` por negação é desprezível" | **Não medido.** Validação futura: benchmark de `p50/p95` do caminho guard + transação dedicada, na mesma disciplina de `P-2.3D-02` |
| H-04 | "Sem visualizador, a trilha não tem consumidor" | **Parcialmente verdadeiro.** Não há endpoint de consulta (`docs/09` §13.9), mas a trilha é consultável diretamente no banco por quem tiver acesso administrativo; ausência de visualizador **não** anula valor forense retroativo |
| H-05 | Semântica de "endpoint RBAC real de **produção**" no gatilho de `PBACK-AUD-03` | **Ambígua** — ver §4. Não é declarada satisfeita aqui |
| H-06 | Comportamento sob falha de gravação da auditoria de negação (`403` vs `500`) | **Decisão em aberto** — ver §6.3 |

## 3. Necessidade e escopo

### 3.1 Fontes — obrigação expressa, interpretação, recomendação

| Fonte | Texto relevante | Classe |
| --- | --- | --- |
| `TLF-BASE-V1` §4.3 | "alterações sensíveis precisam ser atribuíveis a usuário, data e ação" | **Não alcança negação** — uma tentativa negada não altera nada |
| `TLF-BASE-V1` §10 | "Implementar trilha de auditoria para **acesso** e mudança de dados sensíveis" | **Não alcança negação** — acesso negado não é acesso. Interpretar "acesso" como "tentativa de acesso" seria **interpretação extensiva**, não obrigação expressa |
| `TLF-BASE-V1` §10 | "Proteger contra ... enumeração e abuso de autenticação" | Recomendação de proteção; não impõe auditoria |
| `docs/02` AUT-003 | "verificar sessão; reunir papéis; resolver permissões; ...; permitir ou **negar**" | Exige negar; **não exige auditar** a negação |
| `docs/02` AUD-001 | eventos mínimos: alterações sensíveis (lista fechada) | **Não inclui** negação |
| `docs/04` §10 | "Devem ser auditadas, no mínimo, operações sensíveis executadas **e rejeições relevantes de segurança quando isso tiver utilidade operacional, evitando volume/ruído excessivo**" | **Única fonte que trata de rejeição.** Obrigação **condicionada** a dois testes: (i) relevância de segurança, (ii) utilidade operacional — com advertência contra ruído |
| `docs/04` §11 item 6 | "formato de auditoria para negações e acessos clínicos" é pendência de detalhamento técnico | Reconhece a lacuna; não decide |
| `docs/09` §5 (proposta histórica) | `autorizacao.negada` — SF: "o critério de relevância não está definido" | Proposta, sem valor normativo |
| `docs/09` §12.5 `D-AUD-05` | SF continuam fora — "não se inventa `autorizacao.negada` ... sem decisão futura" | **Decisão homologada vigente**: a ação **não existe** até decisão expressa |
| `docs/09` §12.3 `D-AUD-02` | `NEGADO` homologado | Compatível com uma futura ação de negação; não a exige |
| `docs/09` §13.4 `PBACK-AUD-03` | não criar `autorizacao.negada`; reavaliar no "primeiro endpoint RBAC real de produção" | **Decisão vigente**, com fundamento factual contestado (§13.1 G-03 errata) |

**Síntese.** Não há obrigação **expressa e incondicional** de auditar negações. Há uma obrigação **condicionada** (`docs/04` §10) cujos dois testes — relevância e utilidade — passam a ser **avaliáveis** agora que existe uma rota RBAC real, e cuja resposta este documento **não** decide.

### 3.2 Utilidade operacional da negação na rota atual — avaliação honesta

**A favor (relevância de segurança):** a operação é iniciar a recuperação de senha **de outro usuário** — o que, concluído, permite ao portador do segredo assumir a conta do alvo (`D-2.3D-08`, T-07 revoga as sessões do alvo). Um usuário autenticado sem `senha.recuperar_terceiro` que tenta essa rota está, por definição, tentando uma capacidade que não lhe foi concedida. Isso satisfaz razoavelmente o teste (i) de `docs/04` §10 — **relevância de segurança** — por juízo sobre a natureza da operação, não por incidente medido (H-01).

**A favor (utilidade operacional):** hoje a tentativa **não deixa rastro** (F-08). Se um Administrador precisar responder "alguém tentou recuperar a senha de X?", a resposta atual é "impossível saber". Isso é uma lacuna concreta de investigação, independente de volume.

**Contra / limites:** (a) a negação **não produz efeito** — nenhum segredo é criado, nenhuma sessão é afetada, o corpo nem é lido (F-04, F-17); o dano direto é zero. (b) Sem visualizador, o consumo é manual (H-04). (c) O alvo pretendido é **desconhecido** no ponto da negação (F-04) — a trilha registraria *quem tentou* e *qual permissão faltava*, **não** *contra quem*. Isso limita o valor forense: responde "quem tentou usar a capacidade" mas não "quem foi visado". (d) Volume e custo não medidos (H-02, H-03).

**Conclusão de §3.2:** a utilidade é **plausível e específica** (rastro de tentativa de uso de capacidade de alto privilégio), **limitada** (sem alvo, sem efeito), e **não medida**. É matéria de decisão, não de derivação.

### 3.3 Delimitação — o que a proposta abrange e o que NÃO abrange

**Abrangida (única):** a negação deliberada `403 ACESSO_NEGADO` emitida pelo `PermissoesGuard` na rota `POST /auth/recuperacao-senha`, para usuário **autenticado** cuja resolução de permissões **teve sucesso técnico** e resultou em "permissão ausente" ou "usuário inativo".

**Expressamente NÃO abrangidas por esta proposta** (cada uma exigiria decisão própria):
- `401` de qualquer origem (não é negação de autorização);
- `403 REQUISICAO_NAO_AUTORIZADA` do CSRF (proteção de transporte, ocorre antes da sessão);
- `422 ALVO_NAO_ELEGIVEL` (recusa de negócio, uniforme por `D-2.3D-16` — auditar distinguiria os três motivos que a decisão manda manter indistinguíveis no envelope; **conflito normativo real**, não abordado aqui);
- `500` (falha técnica — nunca vira negação);
- negações em **outras rotas** — hoje não existem; a proposta não se estende automaticamente a rotas futuras, embora o mecanismo, se aprovado, seja reutilizável mediante nova decisão por rota/permissão;
- os casos de fiação (`metadata ausente/inválida`, `contexto autenticado ausente`) — são erro de configuração, não tentativa do usuário (§5, campo *ator*).

## 4. A ambiguidade do gatilho "produção" — a submeter a Bruno

`PBACK-AUD-03` fixou: *"reavaliada quando o primeiro endpoint RBAC real de produção for publicado"*. Três leituras defensáveis:

| Leitura | Significado | Está satisfeita? |
| --- | --- | --- |
| **(a) código de produção** | rota em `apps/api/src/` (não fixture de teste), registrada no `AppModule`, integrada na `main` | **Sim** — F-01, F-02, F-18 |
| **(b) ambiente de produção** | rota exposta em implantação real, atendendo usuários | **Sem evidência** — não há registro de deploy (F-18). Não se presume |
| **(c) rota de domínio** | primeira rota de módulo de negócio (agenda, paciente, prontuário, financeiro) sob RBAC | **Não** — `/auth/recuperacao-senha` é M1 Identity & Access |

A nota de revisão de `docs/09` §13.4 adotou a leitura (a). Este documento **não** declara o gatilho satisfeito: registra que a leitura (a) é a mais coerente com o texto "endpoint RBAC real" (o adjetivo *real* opõe-se a *de teste*, não a *não implantado*), mas que a palavra "produção" admite (b), e que a decisão original pode ter tido (c) em mente. **Bruno decide qual leitura vale** — pergunta D-0 em §12.

## 5. Contrato candidato do evento (Alternativa R) — campo a campo contra `D-AUD-01`..`D-AUD-08` e schema

Tudo abaixo é **candidato**. Nada está homologado.

| Campo | Candidato | Procedência do valor | Confronto normativo/schema |
| --- | --- | --- | --- |
| `acao` | **`autorizacao.negada`** (nome já proposto em `docs/09` §5; SF) | constante | **Exige ampliar `D-AUD-01`** (25ª ação) e revogar parcialmente `D-AUD-05` para esta ação — **decisão expressa**; **não** existe no catálogo tipado nem na whitelist |
| `resultado` | **`NEGADO`** | constante | `D-AUD-02` — **já homologado**; seria o primeiro emissor |
| `ator_usuario_id` | `usuarioId` do contexto autenticado | linha persistida da sessão (F-05) | RN-061 ✓ (ator real). FK `Restrict` (F-13) ⇒ **não pode ser um id inexistente**: no motivo `USUARIO_INEXISTENTE` a inserção falharia por FK. **Proposta:** emitir **somente** nos motivos "permissão ausente" e "usuário inativo" (usuário existe); nos casos de fiação e de usuário inexistente, **não emitir** (não é tentativa do usuário; é estado inconsistente/erro de configuração — candidato a log técnico, fora deste pacote) |
| `alvo_tipo` | **`permissao`** (nome físico da tabela — F-14) | constante | `D-AUD-03` ✓ — nome físico; metadado histórico; não concede acesso. **Rejeitados:** `usuario` com `alvo_id = ator` (auto-referência confunde ator com alvo); qualquer alvo derivado do corpo (F-04 — não validado; **proibido**); `alvo_tipo` abstrato tipo `"rota"` (não é tabela — viola `D-AUD-03`). **Nenhum UUID sentinela** |
| `alvo_id` | **`permissao.id`** da permissão exigida | `SELECT id FROM permissao WHERE codigo = <metadata do handler>` | `alvo_id` nullable, sem FK (F-13) — compatível. Custo: 1 leitura adicional por negação (ou incluí-la na mesma transação da escrita). **Alternativa R′:** `alvo_id = NULL` + chave de contexto `permissao_requerida` — evita a leitura, mas exige ampliar `D-AUD-07` (chave nova) e enfraquece IDX-U1. **Preferência técnica: R (id), porque a regra de necessidade de `docs/09` §4.2 torna a chave redundante — o código é recuperável pelo alvo** |
| `contexto` | **VAZIO** (whitelist vazia — regra base de `D-AUD-07`) | — | Com `alvo = permissao.id`, **nenhuma chave é necessária**: a permissão exigida é o alvo. Chave opcional `motivo` (`SEM_PERMISSAO`/`USUARIO_INATIVO`) teria valor forense mas **amplia `D-AUD-07`** — apresentada como **R″**, não recomendada no primeiro passo. **Proibido em qualquer variante:** identificador tentado, corpo, cabeçalhos, cookie, token, IP em `contexto` (IP não é chave homologada e é dado pessoal) |
| `justificativa` | `NULL` | — | Nenhuma fonte exige justificativa para negação ✓ |
| `correlacao_id` | `randomUUID()` **novo por negação** | gerado no emissor | `correlacao_id` NN (F-13) ✓. Não há transação de negócio a correlacionar; o id correlaciona apenas o(s) evento(s) desta negação. **Não** reutilizar `sessaoId` (misturaria semânticas; IDX-U3 é por operação) |
| `ocorrido_em` | instante da decisão de negar | `new Date()` no emissor | AUD-003 ✓ |
| **Momento de emissão** | **após** a decisão de negar e **antes** de lançar `ForbiddenException` | — | Garante que só a negação **deliberada** emite (F-09); falha técnica na resolução sobe antes deste ponto e **não** emite |
| **Eventos por tentativa** | **exatamente 1** | — | Sem agregação; cada requisição negada é uma tentativa real |

**Ampliações que R exige — explicitamente:** (1) `D-AUD-01`: +1 ação; (2) `D-AUD-05`: exceção para `autorizacao.negada`; (3) catálogo tipado e whitelist: +1 entrada **vazia**; (4) **nenhuma** chave nova (R); (5) **nenhuma** alteração de schema, migration, enum ou contrato HTTP — o `403` e seu corpo permanecem idênticos; (6) OpenAPI: nenhuma alteração de resposta (auditoria é efeito interno) — eventual ajuste **apenas descritivo** na `description` do `403`, a decidir.

## 6. Desenho técnico e falhas (Alternativa R)

### 6.1 Fronteira transacional compatível com o `AuditWriter`

O `AuditWriter` exige `tx` (F-11). No ponto da negação **não há transação de negócio** — o handler nunca executa. Opções:

| Opção | Descrição | Avaliação |
| --- | --- | --- |
| **T1 — transação dedicada** | `database.transacao(tx => auditWriter.registrar(tx, evento))` no emissor | Compatível com F-11/F-12 sem alterar o writer. **Padrão novo** ("transação só de auditoria"), mas com precedente parcial: `PermissoesService` já abre transação só de leitura (F-10). Recomendada |
| T2 — reutilizar a transação de `resolverDoUsuario` | escrever o evento dentro da mesma `tx` da leitura de permissões | Exigiria que o service devolvesse a decisão **e** escrevesse — mistura "resolver" com "auditar" e acopla `authz → audit` no service. Rejeitada |
| T3 — relaxar `exigirClienteTransacional` | permitir escrita sem `tx` | **Rejeitada**: enfraquece o invariante que protege todos os emissores atuais |

### 6.2 Ponto de integração — alternativas ao acoplamento direto no guard

| Opção | Descrição | Prós | Contras |
| --- | --- | --- | --- |
| P1 — dentro do `PermissoesGuard` | guard chama `AuditWriter` diretamente | simples | acopla `authz → audit`; o guard, hoje deliberadamente mínimo, passa a ter I/O de escrita e política de falha |
| **P2 — emissor injetado (`AuditoriaNegacaoAutorizacao`)** | serviço próprio, no módulo `audit` (ou `authz`), com método `registrarNegacao({ atorUsuarioId, permissao, motivo })`; o guard **decide** e delega a emissão | separa decisão de registro; testável isoladamente; o guard permanece legível; a política de falha vive no emissor | +1 provider; o guard ganha uma dependência |
| P3 — `ExceptionFilter` capturando `ForbiddenException` | filtro global identifica `ACESSO_NEGADO` e emite | zero mudança no guard | o filtro **perde o contexto tipado** (motivo, permissão) salvo se a exceção o carregar — o que vazaria detalhe para o objeto de erro; difícil garantir que só negações do RBAC (e não outro `403`) emitam |
| P4 — interceptor | intercepta a rota | roda **depois** dos guards → nunca vê a negação | inviável |

**Recomendação técnica: P2 + T1**, restringindo a emissão por **lista fechada de permissões** configurada no emissor (inicialmente só `senha.recuperar_terceiro`), para que a aprovação desta rota **não** se estenda silenciosamente a rotas futuras.

### 6.3 Se a gravação da auditoria falhar — impactos e decisão necessária (não fixada aqui)

| Política | Comportamento | Impacto | Risco |
| --- | --- | --- | --- |
| **Q1 — fail-closed forte** | falha ao gravar ⇒ `500 FALHA_INTERNA` (com log de correlação, como o filtro já faz para falha inesperada) | mantém o princípio "operação sensível não acontece sem sua trilha" — mas aqui a "operação" **já é uma negação**; o cliente recebe `500` em vez de `403` | **transforma indisponibilidade de auditoria em mudança de resposta**; um atacante que consiga degradar a escrita de auditoria passa a distinguir "negado" de "não sei" — e a negação **continua efetiva** de qualquer forma (o handler não roda). Custo/benefício duvidoso |
| **Q2 — best-effort com log** | falha ao gravar ⇒ responde `403` normalmente e registra `logger.error` com correlação (sem dados sensíveis) | preserva o contrato HTTP e a negação; a trilha pode ter **lacunas** apenas em falha de infraestrutura, **visíveis em log** | lacuna silenciosa se o log não for monitorado; enfraquece a atomicidade "evento acompanha operação" — mas essa atomicidade foi desenhada para **mutações** (F-09), não para negações |
| Q3 — best-effort sem log | falha ⇒ `403`, nada registrado | — | **Rejeitada**: reproduz o estado atual em caso de falha, sem sinal |

**Não se fixa invariante novo aqui.** A escolha entre Q1 e Q2 é **decisão de Bruno** (pergunta D-2 em §12). Observação técnica: Q2 é a única que **não altera o envelope HTTP** e, portanto, não toca OpenAPI nem o contrato provado pelos testes atuais; Q1 exigiria novo caso de teste e revisão da descrição do `500`.

### 6.4 Preservação da distinção negação × falha técnica

Preservada por construção em qualquer variante: o emissor é chamado **somente** no caminho em que `resolverDoUsuario` retornou com sucesso técnico e a decisão foi *negar por permissão ausente/usuário inativo*. Erro do banco na resolução sobe como exceção **antes** desse ponto ⇒ `500`, sem evento. Isso mantém o contrato já homologado do guard ("fail-closed não é sempre `403`").

### 6.5 Concorrência, duplicidade, retries

- **1 evento por requisição negada**; requisições concorrentes do mesmo usuário geram N eventos independentes (cada uma é uma tentativa real) — sem lock, sem dedupe, sem `SELECT FOR UPDATE`.
- Retries do cliente = novas tentativas = novos eventos. Isso é **rastreabilidade correta**, não duplicidade; qualquer supressão perderia informação (ver §7).
- A transação dedicada é curta (1 `SELECT` opcional + 1 `INSERT`); sem interação com locks de negócio, pois nenhum handler executa.

### 6.6 Prevenção de vazamento em eventos, erros e logs

- **Evento:** `contexto` vazio (R); `alvo_id` é uuid de permissão; ator é uuid. Nenhum identificador tentado, corpo, cabeçalho, cookie, token ou IP. Compatível com F-04 de `docs/09` §2, RN-062/063, `TLF-BASE-V1` §10.
- **Resposta HTTP:** **inalterada** — corpo único `{erro:"ACESSO_NEGADO"}`; a existência da auditoria não vaza para o cliente (nem por status, nem por latência deliberada — ressalva: a escrita adiciona latência ao `403`; **não** se propõe equalização temporal, no mesmo limite declarado por `D-2.3D-16`).
- **Log (Q2):** apenas classe do erro e `correlacao_id`, no padrão já adotado por `FiltroErroAutenticacao` (F-07) — nunca `message`/`stack` do driver (limitação `L-10` da F3, `docs/10` §9).

## 7. Volume e abuso

**Proteções existentes que alcançam a negação:** `ProtecaoCsrfGuard` (exige header custom — barra formulários cross-site) e `SessaoAutenticadaGuard` (barra anônimos). **Ambas exigem que o atacante seja um usuário autenticado legítimo.** Isso reduz a superfície a **insiders com sessão válida** — e é exatamente o perfil que a trilha de negação existe para observar.

**O que permanece descoberto (F-15):** nenhum limitador atua sobre o `403` do início. Um usuário autenticado pode repetir a tentativa negada indefinidamente; sob R, cada repetição custa 1 transação + 1 `INSERT` (+1 `SELECT` na variante com `alvo_id`). **Custo real não medido (H-03).**

**Opções de contenção, com o que cada uma perde:**

| Opção | Mecanismo | Perda de rastreabilidade | Infra nova? |
| --- | --- | --- | --- |
| V0 — nenhuma | aceitar o risco; sessão do abusador é revogável pelo Administrador | nenhuma | não — **mas** a revogação administrativa de terceiro (`AUT-002`/`sessoes.revogar_terceiro`) **não está implementada** (`docs/10` §9): hoje o Administrador **não tem** como encerrar a sessão do abusador pela aplicação. **Dependência real** |
| **V1 — limitar por `usuarioId` com `DimensaoLimite`** | reutiliza F-16; acima do limite na janela, a negação continua `403` mas **deixa de emitir** evento (ou emite um evento de saturação — que seria **outra** ação, não proposta) | **sim, deliberada e acotada:** após N negações na janela, as demais **não** são registradas. Perde-se a contagem exata, preserva-se o fato "este usuário atingiu N negações em 15 min" | não — primitiva existente; limitação em memória por processo (mesma restrição declarada em `R-2.3D-02`/`P-2.3D-06`) |
| V2 — agregação (1 evento por usuário/janela com contador) | contador em `contexto` | perde instantes individuais; exige chave nova (`D-AUD-07`) e atualização de evento — **viola AUD-005** (trilha não é atualizada) | rejeitada |
| V3 — amostragem | registra 1 em cada K | perde tentativas arbitrárias; imprevisível para investigação | rejeitada |

**Recomendação técnica:** V1, com limite e janela a **decidir** (sugestão inicial coerente com `D-2.3D-06`: janela de 15 min; N a fixar — sem medição, qualquer N é chute e deve ser declarado como tal). Se Bruno preferir V0, a dependência de `AUT-002`/revogação de terceiro deve ser registrada como risco aceito.

**Medições faltantes (registradas, não inventadas):** taxa real de `403` por usuário/janela; custo `p50/p95` do `INSERT` sob concorrência; efeito na latência do `403`. Validação futura obrigatória antes de qualquer ajuste de N.

## 8. Alternativa T — manutenção temporária do comportamento atual

**O que se mantém:** nenhuma auditoria nem log da negação (F-08). `autorizacao.negada` continua fora. Nenhum código muda.

**Risco declarado, sem a premissa falsa:** existe **uma** rota RBAC real, sobre operação de alto privilégio sobre terceiro, e uma tentativa negada de usá-la **não deixa rastro**. Um insider autenticado pode sondar a capacidade repetidamente sem que nenhum registro exista. O **dano direto é zero** (nada é criado, nada é lido); o **dano indireto** é a **cegueira investigativa** — que só se materializa se houver um incidente a investigar (H-01).

**Proteções efetivamente existentes:** CSRF + sessão + RBAC fail-closed + corpo não lido + zero efeito colateral provado por teste (F-17). A negação é **segura**; é apenas **invisível**.

**Condição objetiva de revisão — candidatas, a submeter (nenhuma adotada):**

| Candidata | Justificativa | Objeção |
| --- | --- | --- |
| C1 — implantação em ambiente de produção (primeiro deploy) | é quando negações reais passam a ocorrer e a cegueira passa a ter custo | pode chegar tarde: decidir depois do deploy é decidir sob incidente |
| C2 — implementação de `AUT-002`/revogação administrativa de terceiro (próximo marco previsto em `docs/10` §9) | é o momento em que o Administrador ganha a **resposta** (revogar) que a trilha de negação informaria — trilha sem resposta possível tem utilidade reduzida (V0) | acopla duas matérias distintas |
| C3 — primeira rota RBAC de domínio clínico/financeiro | amplia a superfície e o valor da trilha genérica | **não** justifica ignorar a rota que já existe — foi a candidata da nota de §13.4, e este documento **não** a adota automaticamente |
| C4 — existência do visualizador (§13.9) | dá consumidor à trilha | H-04: a trilha já é consultável no banco; consumidor não é pré-condição de registro |
| C5 — prazo fixo (ex.: reavaliar na consolidação da próxima etapa) | evita esquecimento | arbitrário |

**Observação:** C2 é a mais coerente com a sequência prevista em `docs/10` (§9: `AUT-005`/`RN-001` e revogação de terceiro como próximo marco) e com a dependência V0 — mas é **sugestão**, submetida em D-1.

## 9. Alternativa R — auditoria restrita de negações (resumo consolidado)

Ação `autorizacao.negada` · `resultado = NEGADO` · ator = usuário da sessão · `alvo_tipo = "permissao"`, `alvo_id = permissao.id` · contexto **vazio** · `correlacao_id` novo · 1 evento por tentativa · emissor P2 com lista fechada de permissões (só `senha.recuperar_terceiro`) · transação dedicada T1 · política de falha Q1 **ou** Q2 (a decidir) · contenção V1 (limite a decidir) **ou** V0 com risco aceito. Sem chave de contexto, sem schema, sem migration, sem alteração de contrato HTTP.

## 10. Comparação

| Critério | T — manutenção temporária | R — auditoria restrita |
| --- | --- | --- |
| Cobertura | nenhuma sobre negações; rastro zero | 1 rota, 1 permissão; registra quem/quando/qual permissão; **não** registra o alvo visado (F-04) |
| Segurança | negação já é efetiva e sem efeito colateral; cegueira investigativa | adiciona visibilidade de insider; vetor de escrita por autenticado (mitigável por V1) |
| Complexidade | zero | +1 ação no catálogo; +1 provider; +1 dependência no guard; transação dedicada; política de falha; limitador; testes |
| Compatibilidade | total | contrato HTTP inalterado (Q2) ou alterado em falha (Q1); OpenAPI intacta (Q2) |
| Custo | zero | implementação + medições faltantes (H-02, H-03) |
| Reversibilidade | n/a | alta: remover o emissor devolve o estado atual; eventos históricos permanecem (AUD-005) |
| Dependências | `AUT-002` (revogação de terceiro) para que a cegueira tenha resposta | as mesmas, mais decisões normativas (D-AUD-01/05 ampliadas) |
| Precedente | preserva `D-AUD-05` literalmente | primeira exceção a `D-AUD-05`; primeiro emissor de `NEGADO` |

## 11. Recomendação fundamentada

**Recomendo a Alternativa R, restrita como descrita, com política de falha Q2, contenção V1 e emissor P2/T1** — **condicionada** a Bruno confirmar a leitura (a) do gatilho (§4).

Razões: (1) o fato novo desta sprint — a negação **não deixa rastro algum** (F-08) — pesa mais do que o "só em log técnico" que a nota de §13.4 presumia; (2) a operação é, por natureza, a de maior privilégio já exposta, e o perfil do abusador (insider autenticado) é precisamente o que uma trilha existe para observar; (3) a proposta é **mínima**: nenhuma chave, nenhum schema, nenhum contrato HTTP alterado, uma única permissão, reversível; (4) as três dificuldades técnicas apontadas na nota de §13.4 (transação, alvo, volume) **têm solução concreta sem infraestrutura nova** — T1, `alvo = permissao`, V1 com `DimensaoLimite`.

Contra a própria recomendação, registro: H-02/H-03 não estão medidos; a trilha registra "quem tentou", não "contra quem"; e sem `AUT-002` o Administrador vê mas **não pode revogar** pela aplicação. Se Bruno considerar que sem resposta possível a trilha é prematura, **T com condição C2** é a alternativa coerente — e não é errada.

**Isto é recomendação. Nenhuma das duas está aprovada.**

## 12. Decisões necessárias — perguntas para Bruno Menezes Noronha

Responda no formato `D-0a, D-1R, ...`. Cada bloco é **independente**; aprovar a política **não** autoriza implementar; autorizar implementar **não** autoriza publicar.

**D-0 — Leitura do gatilho de `PBACK-AUD-03`** (§4)
 (a) "endpoint RBAC real" = código de produção integrado na `main` — **gatilho satisfeito**; `L-07` em reavaliação agora.
 (b) = ambiente de produção implantado — gatilho **não** satisfeito; reavaliar no primeiro deploy.
 (c) = primeira rota de domínio — gatilho **não** satisfeito.

**D-1 — Política** (só se D-0 = a; caso contrário, registrar a condição escolhida)
 (T) Manter o comportamento atual, com o risco de §8 **declarado e aceito**, e condição de revisão: C1 / C2 / C3 / C4 / C5 (indicar).
 (R) Aprovar a política de auditoria restrita de §9 — o que **implica** decisão normativa nova: ampliar `D-AUD-01` com `autorizacao.negada` (whitelist vazia) e abrir exceção a `D-AUD-05` para esta ação, limitada à permissão `senha.recuperar_terceiro`.

**D-2 — Se R: comportamento em falha de gravação** (§6.3)
 (Q1) `500` — fail-closed forte. (Q2) `403` + log com correlação — best-effort visível. **Recomendada: Q2.**

**D-3 — Se R: contenção de volume** (§7)
 (V0) nenhuma; risco aceito com dependência de `AUT-002` registrada. (V1) `DimensaoLimite` por `usuarioId`, janela 15 min, N a fixar por Bruno — e declarado como não medido. **Recomendada: V1.**

**D-4 — Se R: alvo** (§5)
 (R) `alvo_tipo="permissao"`, `alvo_id=permissao.id`, contexto vazio. (R′) `alvo_id=NULL` + chave `permissao_requerida` (amplia `D-AUD-07`). **Recomendada: R.**

**D-5 — Autorização para implementar** (independente de D-1)
 (S) autorizar fatia de implementação conforme §13, em branch própria, sem publicação. (N) não autorizar por ora.

**D-6 — Autorização para publicar** (PR/merge) — **não** solicitada nesta sprint; será pedida, se cabível, ao fim da fatia de implementação com evidência de testes.

**Nenhuma das respostas é presumida.** Até resposta expressa, `PBACK-AUD-03` permanece como homologada (com fundamento contestado) e o comportamento atual permanece.

## 13. Critérios de aceite e matriz de testes da eventual implementação (só se D-1 = R e D-5 = S)

Testes obrigatórios — todos com contraprova positiva para não serem vacuamente verdes; PostgreSQL real onde indicado; dados sintéticos apenas (`TLF-BASE-V1` §10).

| # | Caso | Tipo | Aceite |
| --- | --- | --- | --- |
| A-01 | Autenticado sem `senha.recuperar_terceiro` → `403 {erro:"ACESSO_NEGADO"}` **e** exatamente 1 `evento_auditoria` com `acao=autorizacao.negada`, `resultado=NEGADO`, `ator=usuário`, `alvo_tipo=permissao`, `alvo_id=id de senha.recuperar_terceiro`, `contexto` nulo/vazio, `correlacao_id` novo | integração | corpo HTTP **byte a byte igual** ao atual (teste existente `:460` continua passando sem alteração) |
| A-02 | Autenticado **inativo** → `403` e 1 evento (motivo inativo) | integração | idem |
| A-03 | Sem sessão → `401` e **zero** eventos | integração | preserva `:442` |
| A-04 | Sem header CSRF → `403 REQUISICAO_NAO_AUTORIZADA` e **zero** eventos | integração | CSRF não é negação de autorização |
| A-05 | Autenticado **com** a permissão → `201` e **zero** `autorizacao.negada` (só `usuario.senha.recuperacao_iniciada`) | integração | controle positivo |
| A-06 | Falha técnica em `resolverDoUsuario` (banco indisponível/erro injetado) → `500` e **zero** eventos | unitário + integração | negação ≠ falha técnica |
| A-07 | Falha na **gravação** do evento → conforme D-2: Q2 ⇒ `403` + `logger.error` com correlação e sem dados; Q1 ⇒ `500` | unitário (writer mockado) | política escolhida provada; log sem `message`/`stack` |
| A-08 | N negações concorrentes do mesmo usuário → N eventos, N `403` | integração | sem dedupe, sem deadlock |
| A-09 | Contenção V1: N+1ª negação na janela → ainda `403`, **sem** evento; janela expira → volta a emitir | unitário (relógio controlado) | perda declarada e limitada |
| A-10 | Evento **nunca** contém: identificador tentado, corpo, cookie, token, IP, e-mail — teste que injeta corpo com dados sintéticos sensíveis e verifica o evento | integração | zero vazamento |
| A-11 | Negação em rota **fora** da lista fechada (controller de teste com outra permissão) → `403` e **zero** eventos | integração | escopo não se amplia silenciosamente |
| A-12 | Catálogo: **25** ações; whitelist **25** declaradas, **3** positivas, **22** vazias; `autorizacao.negada` aceita contexto vazio e **rejeita** `permissao_requerida`, `motivo`, `ip`, `identificador` | unitário | atualização deliberada dos contadores de `audit-context.validator.spec.ts` (hoje 24/21) |
| A-13 | `AuditWriter` continua recusando cliente não transacional | unitário | invariante preservado |
| A-14 | Mutation challenges: (i) remover a chamada ao emissor → A-01 falha; (ii) emitir também na falha técnica → A-06 falha; (iii) incluir corpo no contexto → A-10 e validator falham; (iv) ampliar a lista fechada → A-11 falha | mutation | cada mutação detectada por ≥1 teste |
| A-15 | Latência: medir `p50/p95` do `403` antes/depois (benchmark, não gate) | medição | registra H-03; sem limiar fixado |

**Critérios documentais:** registro normativo em `docs/09` (nova subseção de decisão, preservando §13.4 e a nota); `docs/10` §7/§9 atualizados; comentários do catálogo e do guard atualizados; OpenAPI **sem** alteração de contrato (Q2).

## 14. Limites e dependências

- **Não decide** nada; **não implementa** nada; **não** altera runtime, testes, schema, migrations, OpenAPI, dependências ou configuração.
- **Não** encerra `L-07`, `L-06`, `P-BACK-01` nem `R2.2-04`.
- **Não** estende a auditoria de negação a outras rotas, ao `422` de negócio, ao CSRF ou ao `401`.
- **Depende** de: resposta a D-0 (leitura do gatilho); `AUT-002`/revogação administrativa de terceiro para que a trilha tenha resposta operacional (V0) — **próximo marco funcional previsto em `docs/10` §9, sem execução autorizada**; medições H-02/H-03 antes de fixar N em V1.
- **Conflito normativo identificado e não resolvido aqui:** auditar o `422 ALVO_NAO_ELEGIVEL` colidiria com a uniformidade de `D-2.3D-16`; fica registrado para eventual decisão própria, fora deste pacote.

---

## 15. Decisão de Bruno Menezes Noronha (05/09/2026) e materialização

### 15.1 Respostas às perguntas de §12

| Pergunta | Resposta | Observação |
| --- | --- | --- |
| D-0 | **(a)** | gatilho de `PBACK-AUD-03` satisfeito pelo código integrado e rota funcional; **não** é definição universal de "produção" |
| D-1 | **R** | auditoria restrita; `autorizacao.negada` homologada com whitelist vazia; exceção única a `D-AUD-05`, limitada a `senha.recuperar_terceiro` |
| D-2 | **Q2** | `403` preservado; falha de gravação vira log técnico seguro com correlação; não engolida; sem retry |
| D-3 | **V0** | sem `DimensaoLimite`; um evento por tentativa negada; risco de volume registrado, não mitigado |
| D-4 | **R** | `alvo_tipo = "permissao"`, `alvo_id = permissao.id`, contexto vazio; corpo nunca lido |
| D-5 | **S** | implementação autorizada, em branch própria, sem publicação |
| D-6 | **NÃO AUTORIZADA** | sem commit, push, PR, merge, rebase, deploy ou publicação |

Registro normativo: **`docs/09` §13.4.1 (`PBACK-AUD-09`)**, que preserva §13.4 e a nota de revisão.

### 15.2 O que foi implementado (branch `agent/p-back-01-d2-auditoria-decisoes`, 05/09/2026)

Desenho adotado: **P2 + T1** (§6.2/§6.1), como recomendado.

| Arquivo | Situação | Responsabilidade |
| --- | --- | --- |
| `apps/api/src/authz/auditoria-negacao-autorizacao.ts` | **NOVO** | emissor `AuditoriaNegacaoAutorizacao`: lista **fechada** (`senha.recuperar_terceiro`), transação **dedicada** via `DatabaseService.transacao`, `SELECT permissao.id` + `AuditWriter.registrar` na mesma transação, evento conforme D-4, **Q2** (`Logger.error` com classe + `correlacao_id`; nunca `message`/`stack`), nunca lança, nunca repete |
| `apps/api/src/authz/permissoes.guard.ts` | **ALTERADO** | injeta o emissor; chama-o **somente** em permissão ausente e usuário inativo, **depois** de decidir e **antes** de lançar (`await`); fiação incorreta, usuário inexistente e falha técnica **não** emitem |
| `apps/api/src/authz/authz.module.ts` | **ALTERADO** | importa `AuditModule`; provê e exporta o emissor (a guard é instanciada no injetor do módulo do controller — `R4-05`) |
| `apps/api/src/audit/audit.catalog.ts` | **ALTERADO** | `autorizacao.negada` como 25ª ação (ao final, preservando a ordem de `D-AUD-01`); whitelist vazia; comentários atualizados |
| `apps/api/test/auditoria-negacao-autorizacao.spec.ts` | **NOVO** | unitário do emissor: lista fechada (28 permissões não emitem), contrato D-4, correlação nova, Q2 em três falhas (transação, writer, permissão não persistida), log seguro |
| `apps/api/test/permissoes.guard.spec.ts` | **ALTERADO** | terceiro argumento do construtor; bloco L-07: quando a guard emite e quando não |
| `apps/api/test/audit-context.validator.spec.ts` | **ALTERADO** | contadores 25/22; `autorizacao.negada` sai da lista de rejeitadas; A-12 (rejeita `permissao_requerida`, `motivo`, `ip`, `identificador`, ...) |
| `apps/api/test/integration/recuperacao-senha.integration.spec.ts` | **ALTERADO** | bloco L-07 contra PostgreSQL real (A-01, A-02, A-05, A-06, A-07, A-08, A-10, corpo não confiável, Q2 real por permissão não provisionada); asserções de zero evento nos casos `401`, CSRF e `422` preexistentes |
| `apps/api/test/integration/authz-rbac.integration.spec.ts` | **ALTERADO** | A-11 (lista fechada) com poder de mutação (linhas de `permissao` das rotas negadas existem) |

**Não alterados:** schema Prisma, migrations, dependências, OpenAPI/contrato HTTP (o `403 {erro:"ACESSO_NEGADO"}` é byte a byte o mesmo; a descrição do `403` no OpenAPI **não** foi tocada), `RecuperacaoSenhaController`/`Service`, `FiltroErroAutenticacao`, `AuditWriter`, `AuditContextValidator`, `packages/**`.

**Decisão local de implementação (rotulada, reversível):** permissão exigida **sem linha em `permissao`** (seed da F5 não aplicado) é tratada como falha técnica **Q2** — log e nenhum evento — porque as alternativas (alvo `NULL`, sentinela, UUID fictício) são proibidas por D-4. Em produção o seed garante a linha; a suíte de integração prova o caminho sem mock.

### 15.3 Matriz de §13 — estado após a implementação

| # | Estado | Onde |
| --- | --- | --- |
| A-01 | **PROVADO** — 403 idêntico + 1 evento por negação, ator/alvo/contexto conforme D-4, correlação nova; teste preexistente `:460` **inalterado e verde** | integração |
| A-02 | **PROVADO** — inativo => 403 + 1 evento | integração + unitário da guard |
| A-03 | **PROVADO** — `401` (sem sessão; revogada) => zero eventos | integração (preexistente + asserção nova) |
| A-04 | **PROVADO** — CSRF => zero eventos | integração |
| A-05 | **PROVADO** — autorizado => 201, zero `autorizacao.negada` | integração |
| A-06 | **PROVADO** — falha técnica na resolução => 500, zero eventos | integração + unitário |
| A-07 | **PROVADO (Q2)** — writer falha => 403, handler não executa, 1 log seguro, zero eventos, zero unhandled rejection; variante **real** sem mock (permissão não provisionada) | integração + unitário |
| A-08 | **PROVADO** — 8 negações concorrentes => 8 × 403, 8 eventos, 8 correlações | integração |
| A-09 | **NÃO APLICÁVEL** — D-3 = V0 | — |
| A-10 | **PROVADO** — e-mail/id do alvo, cookie, token, senha/token no corpo, cabeçalhos forjados e IP ausentes do evento e dos logs | integração |
| A-11 | **PROVADO** — `usuarios.gerenciar`/`permissoes.gerenciar` negadas (inclusive por inativo) => zero eventos, com linhas de `permissao` presentes | integração + unitário (28 permissões) |
| A-12 | **PROVADO** — 25 ações; 3 positivas · 22 vazias; chaves cogitadas rejeitadas | unitário |
| A-13 | **PROVADO** — inalterado (`audit-writer.spec.ts`) | unitário |
| A-14 | **PROVADO** — 4 mutações manuais aplicadas, detectadas e revertidas por hash (`docs/10` §7.4) | mutação manual |
| A-15 | **NÃO MEDIDO** — latência do `403` antes/depois permanece pendência (H-03) | — |

### 15.4 O que permanece aberto após esta fatia

- **Publicação** (D-6): não autorizada — commit/PR/merge dependem de autorização própria.
- **`AUT-002` / `sessoes.revogar_terceiro`**: a resposta administrativa à trilha não existe; risco de V0 aceito e registrado.
- **H-02/H-03**: volume real e custo do `INSERT` por negação não medidos.
- **Conflito `422` × `D-2.3D-16`** (§14): registrado, sem decisão — o `422` **não** é auditado.
- **`L-06`, `R2.2-04`, `P-BACK-01`, `AUT-005`**: estados **inalterados** por esta fatia.

---

**Fim — §§1–14: proposta histórica (05/09/2026); §15: decisão de Bruno Menezes Noronha e materialização (05/09/2026). Registro normativo em `docs/09` §13.4.1 (`PBACK-AUD-09`); estado vivo em `docs/10` §7.4. Publicação NÃO autorizada.**
