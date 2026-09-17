# Decisões da Configuração da Clínica (`CFG-001`..`CFG-006`)

> **Documento:** `docs/14-decisoes-configuracao-clinica.md`
> **Projeto:** TechLab Fisio
> **Frente:** Fase 3 — Configuração da Clínica (módulo M2, `CFG-001..CFG-006`)
> **Status:** **DECIDIDO — `D-CFG-01`..`D-CFG-08` E ADENDOS `D-CFG-03-A` E `D-CFG-04-A` HOMOLOGADOS POR BRUNO MENEZES NORONHA EM 17/09/2026; `D-CFG-09`..`D-CFG-12` (PROVISIONAMENTO DA CLÍNICA) HOMOLOGADAS EM 17/09/2026; `D-CFG-13`..`D-CFG-21` (HORÁRIO DE FUNCIONAMENTO, CFG-002) HOMOLOGADAS EM 17/09/2026; `D-CFG-22`..`D-CFG-33` (CATÁLOGO DE SERVIÇOS, CFG-003) HOMOLOGADAS EM 17/09/2026; `D-CFG-34`..`D-CFG-45` (FORMAS DE PAGAMENTO, CFG-004) HOMOLOGADAS EM 17/09/2026** (TLF-BASE-V1 §15, item 1).
> **Data:** 17 de setembro de 2026
> **Insumo decisório:** pacotes de análise somente leitura `CFG-PREP0` (`D-CFG-01`..`D-CFG-08`, sobre `origin/main` = `63bb058`), `CFG-PREP1` (`D-CFG-09`..`D-CFG-12`), `CFG-PREP2` (`D-CFG-13`..`D-CFG-21`), `CFG-PREP3` (`D-CFG-22`..`D-CFG-33`) e `CFG-PREP4` (`D-CFG-34`..`D-CFG-45`); a base medida de cada um consta da respectiva seção.
> **Natureza:** registro normativo das decisões. A materialização da fatia `CFG-001A` (autorizada por Bruno em 17/09/2026) é registrada factualmente em `docs/10` §6-W; nenhuma decisão foi alterada por ela.
> **Por que um documento próprio:** precedente do projeto para decisões por frente (`docs/09`, `docs/11`, `docs/12`, `docs/13`). Um documento dedicado também evita edição concorrente de `docs/10` e `docs/12`, em uso por frentes paralelas.

---

## 1. Fontes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` §5.2, §9, §11, §13, §14, §15 — **não alterada**.
- `docs/02` CFG-001..CFG-006; `docs/03` RN-007, RN-008, RN-014, RN-060.
- `docs/04` §4 (matriz) e §5.2 (`clinica.configurar`).
- `docs/06` §6.2 (M2); `docs/07` §7.2 (`clinica`) e restrição de clínica única; `docs/08` §8 (Categoria C).
- `docs/09` §13.4.1 (`L-07`) e §13.6 (`configuracao.alterada`).
- `docs/12` §5.21 (precedente de contrato HTTP administrativo).

## 2. Fatos constatados em `CFG-PREP0` (base das decisões)

| # | Fato | Evidência |
| --- | --- | --- |
| F-01 | Tabelas `clinica`, `horario_funcionamento`, `servico`, `forma_pagamento`, `motivo_cancelamento` existem fisicamente; todas as dependentes têm `clinica_id` NOT NULL | migrations `20260820121255`, `20260820121900` |
| F-02 | `clinica.nome_cadastral` e `clinica.fuso_horario` são NOT NULL; não há `atualizado_em` nem coluna de versão | migration `20260820121255` |
| F-03 | **A restrição física de clínica única não existe.** `docs/07` a afirma; `docs/08` §8 a classifica como Categoria C (migration SQL); `schema.prisma` a remete a "etapa própria" | `schema.prisma` (comentários de `E-06`/`E-07` e de `Clinica`) |
| F-04 | Nenhum runtime, API, teste funcional ou frontend de Configuração da Clínica existe | `apps/api/src`, `apps/api/test`, `apps/web` |
| F-05 | `clinica.configurar` está no catálogo e é concedida **somente** ao `ADMINISTRADOR` | `apps/api/src/authz/permissoes.catalogo.ts`; `apps/api/src/provisionamento/catalogo-rbac.ts` |
| F-06 | `configuracao.alterada` está no catálogo com whitelist de `contexto` **vazia** | `apps/api/src/audit/audit.catalog.ts`; `docs/09` §13.6 |
| F-07 | Negação `403` em `clinica.configurar` **não** gera evento: a lista fechada de `L-07` contém apenas `senha.recuperar_terceiro` | `apps/api/src/authz/auditoria-negacao-autorizacao.ts`; `docs/09` §13.4.1 |
| F-08 | Nenhuma fonte definia quem cria a linha de `clinica`, o contrato HTTP, as validações, o tratamento de concorrência ou do no-op | `CFG-PREP0` |

## 3. Decisões

### 3.1 `D-CFG-01` — Origem da linha única

- A linha única de `clinica` é criada por **processo de provisionamento**.
- A API de configuração **apenas consulta e atualiza**; não cria nem remove a linha.
- Ausência da linha resulta em **`404 CLINICA_NAO_CONFIGURADA`** (GET e PUT).

### 3.2 `D-CFG-02` — Garantia física da clínica única

- A invariante de clínica única é garantida **fisicamente no PostgreSQL**, por **migration SQL** com restrição/índice único apropriado.
- **Sem** multitenancy, **sem** `tenant_id`, **sem** abstração para múltiplas clínicas.

### 3.3 `D-CFG-03` — Contrato HTTP da fatia

- `GET /clinica` — consulta.
- `PUT /clinica` — **substituição total**, com **corpo estrito** (conjunto exato de chaves; qualquer chave extra ou ausente é rejeitada).

#### 3.3.1 `D-CFG-03-A` — Representação da resposta *(adendo homologado em 17/09/2026)*

- `GET /clinica` e `PUT /clinica` (200) retornam **exatamente**: `{ id, nomeCadastral, nomeOperacional, endereco, telefone, email, fusoHorario }`.
- `id` é o UUID da clínica; `nomeOperacional`, `endereco`, `telefone` e `email` são `string | null`; `nomeCadastral` e `fusoHorario` são `string`.
- No `PUT`, o corpo é o **estado vigente após a operação** (valores normalizados), inclusive no no-op.
- **Não** são retornados: `logotipoChave`, `duracaoPadraoAtendimentoMin` (`D-CFG-07`), `criadoEm` nem nomes físicos de coluna.
- Erros: corpo `{ erro: <código> }`.

### 3.4 `D-CFG-04` — Validação e normalização

| Campo | Regra |
| --- | --- |
| todos os textos | aplicar `trim` |
| opcionais | vazios (após `trim`) tornam-se `null` |
| `nomeCadastral` | **obrigatório**, 1–200 caracteres |
| `nomeOperacional` | opcional, máximo 200 |
| `endereco` | opcional, máximo 500 |
| `telefone` | opcional, máximo 32; **texto livre** nesta fatia |
| `email` | opcional, máximo 254; validação **estrutural mínima** |
| `fusoHorario` | **obrigatório**, **case-sensitive**; deve ser timezone IANA reconhecido pelo runtime; `UTC` **explicitamente aceito** |

- **Sem coerção de tipos.**
- **Sem dependência nova** para essas validações.

#### 3.4.1 `D-CFG-04-A` — Predicado exato do e-mail *(adendo homologado em 17/09/2026)*

Após `trim`, um `email` não nulo é aceito **se e somente se**:

1. não contém caractere de espaço em branco;
2. contém **exatamente um** `@`;
3. a parte local (antes do `@`) não é vazia;
4. o domínio (depois do `@`) não é vazio, contém um `.` que **não** é seu primeiro caractere e **não** termina em `.`;
5. respeita o máximo de 254 caracteres.

Nenhuma outra restrição é aplicada (Unicode e TLD de um caractere são aceitos; não há verificação de DNS). Exemplos: aceitos `a@b.co`, `a@b.c`; rejeitados `a@b`, `a@@b.com`, `@example.com`, `a@.com`, `a@dominio.`, `a b@c.com`.

### 3.5 `D-CFG-05` — Concorrência

- Serialização por `SELECT ... FOR UPDATE` na linha de `clinica`; a **última escrita válida prevalece**.
- **Não** se introduz coluna de versão, `If-Match` nem resposta `409` nesta fatia.
- Limitação aceita: atualização perdida entre administradores concorrentes não é detectada.

### 3.6 `D-CFG-06` — PUT sem alteração efetiva

- Retorna **`200`**, **sem `UPDATE`** e **sem evento de auditoria**.

### 3.7 `D-CFG-07` — Escopo de campos

- **Logotipo** (`logotipo_chave`) e **`duracao_padrao_atendimento_min`** ficam **fora desta fatia**.
- Ambos **permanecem no escopo futuro do MVP** (TLF-BASE-V1 §5.2).

### 3.8 `D-CFG-08` — Leitura e troca de fuso

- Nesta fatia, **GET e PUT exigem `clinica.configurar`**.
- A **troca de fuso é permitida** enquanto não existirem módulos dependentes que exijam regra de transição adicional; a introdução de tais módulos deve reavaliar este ponto.

### 3.9 Provisionamento da linha única — `D-CFG-09`..`D-CFG-12` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP1`)*

**Fatos de base.** `D-CFG-01` atribui a criação da linha a processo de provisionamento, sem fatia. O único acionador de provisionamento é `apps/api/src/provisionamento/cli.ts` (`seed`, `bootstrap-admin`, `provisionar`), fora do `AppModule`. Não há Administrador autenticado no momento da criação. `D-2.3D-15` (`docs/12` §5.15) é o precedente de autoria nula com justificativa obrigatória. A unicidade física `ux_clinica_linha_unica` (`D-CFG-02`) impede segunda linha.

#### 3.9.1 `D-CFG-09` — Autoria e auditoria da criação

- A criação emite `configuracao.alterada` com `alvo_tipo = "clinica"`, `alvo_id = clinica.id`, `resultado = SUCESSO` e `contexto` **vazio**, na **mesma transação** do `INSERT` (falha da auditoria → rollback conjunto).
- **`ator_usuario_id = NULL`** — sem identidade sintética —, estendendo a esta operação inaugural o precedente de `D-2.3D-15`.
- **Justificativa operacional obrigatória**, não vazia e sem caractere de controle, validada antes da transação, persistida em `evento_auditoria.justificativa`, **nunca impressa** e fora de `contexto`.
- Nenhuma ação, chave de `contexto` ou whitelist é criada ou ampliada.

#### 3.9.2 `D-CFG-10` — Reexecução

- Linha existente com **mesmos** `nomeCadastral` e `fusoHorario` (após normalização de `D-CFG-04`) → desfecho **`JA_CONFORME`**, saída `0`, **sem escrita e sem evento**.
- Linha existente com dados **divergentes** → **`CLINICA_JA_EXISTE`**, saída `1`, **sem sobrescrever**; alterações seguem por `PUT /clinica`.
- Criação concorrente perdida (`23505` em `ux_clinica_linha_unica`) é tratada pela mesma regra, nunca como falha não controlada.

#### 3.9.3 `D-CFG-11` — Entrada

- Somente por variáveis de ambiente (nunca `argv`): `TLF_BOOTSTRAP_CLINICA_NOME_CADASTRAL`, `TLF_BOOTSTRAP_CLINICA_FUSO_HORARIO` e `TLF_BOOTSTRAP_CLINICA_JUSTIFICATIVA`.
- `nomeCadastral` e `fusoHorario` validados e normalizados por `D-CFG-04`; campos opcionais da clínica ficam `NULL` e são preenchidos por `PUT /clinica`.
- Mensagens e saídas usam motivos de conjunto fechado, sem valores.

#### 3.9.4 `D-CFG-12` — Encaixe na CLI

- Subcomando **novo `bootstrap-clinica`**.
- `seed`, `bootstrap-admin` e **`provisionar` permanecem inalterados**; a inclusão da clínica em `provisionar` poderá ser reavaliada posteriormente, sem que isso esteja autorizado por este registro.

### 3.10 Horário de funcionamento (`CFG-002`) — `D-CFG-13`..`D-CFG-21` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP2`)*

Homologadas por Bruno Menezes Noronha em 17/09/2026, que adotou integralmente as opções recomendadas do pacote `CFG-PREP2` (somente leitura, medido sobre `origin/main` = `6b55dec`). **Registro normativo; nenhum código, schema, migration ou teste alterado.** A implementação de `CFG-002` não é autorizada por este registro.

**Fatos de partida (`CFG-PREP2`).** A tabela `horario_funcionamento` já existe (`id`, `clinica_id` FK NN `RESTRICT`, `dia_semana smallint` 0..6, `hora_inicio`/`hora_fim` `time(6)`, `criado_em`), com os CHECKs protegidos `ck_horario_funcionamento_dia_semana` e `ck_horario_funcionamento_intervalo`; não há unicidade, exclusão de sobreposição, `atualizado_em`, vigência, situação nem tabela de exceções. Não existe módulo de agenda em `apps/api`. RN-014 é garantida pelo backend na fatia de agenda (`docs/07` §17).

#### 3.10.1 `D-CFG-13` — Forma da janela

- **Múltiplas janelas por dia** (turnos), **sem sobreposição e sem adjacência** entre janelas do mesmo dia.
- Dia sem janela = clínica **fechada** nesse dia.

#### 3.10.2 `D-CFG-14` — Meia-noite

- Janelas que atravessam a meia-noite são **proibidas**, coerentes com `ck_horario_funcionamento_intervalo` (`hora_fim > hora_inicio`). Nenhuma alteração do CHECK protegido.

#### 3.10.3 `D-CFG-15` — Contrato

- `GET /horario-funcionamento` e `PUT /horario-funcionamento`.
- O `PUT` **substitui a grade semanal inteira**, em transação única serializada por `SELECT ... FOR UPDATE` na linha de `clinica`.
- A substituição **remove fisicamente** as linhas anteriores de `horario_funcionamento` (tabela sem dependentes), o que é aceito expressamente para esta entidade; a regra geral de não oferecer exclusão física de cadastros (`docs/07` §23) não é alterada para as demais.
- Grade idêntica à vigente → `200` **sem escrita e sem auditoria** (mesmo critério de `D-CFG-06`).

#### 3.10.4 `D-CFG-16` — Garantia de não sobreposição

- **Validação no backend**, sob o lock de `D-CFG-15`. **Sem migration**, sem exclusion constraint e sem `btree_gist`.

#### 3.10.5 `D-CFG-17` — Auditoria

- Substituição efetiva emite **um único** `configuracao.alterada` com `alvo_tipo = "clinica"`, `alvo_id = clinica.id`, ator da sessão, `resultado = SUCESSO`, `justificativa = null`, `contexto` vazio, na mesma transação.
- **Leitura homologada de `docs/09` §13.6:** a grade semanal é tratada como **atributo da clínica**; como as instâncias de `horario_funcionamento` são recriadas a cada substituição, o alvo estável é a clínica. `docs/09` não é alterado; nenhuma ação, chave ou `alvo_tipo` novo.

#### 3.10.6 `D-CFG-18` — Representação e validação

- Horas em `HH:MM` (24h, sem segundos); minutos 00–59, sem arredondamento; `hora_fim > hora_inicio`.
- `dia_semana`: **0 = domingo** .. 6 = sábado.
- No máximo **4 janelas por dia**.
- Corpo estrito, sem coerção de tipos; erros no contrato `{ erro: <código> }`.

#### 3.10.7 `D-CFG-19` — Exceções e feriados

- **Fora desta fatia.** Permanecem pendência do MVP ("quando modeladas", `docs/02` CFG-002).

#### 3.10.8 `D-CFG-20` — Agenda e disponibilidade

- `CFG-002` apenas **persiste e expõe** a grade. A aplicação de RN-014 (e a combinação com a disponibilidade do profissional, PRO-003, e sua vigência) pertence à fatia de agenda.
- Sem vigência no horário da clínica nesta fatia.
- A introdução da agenda deve reavaliar a troca de fuso (`D-CFG-08`).

#### 3.10.9 `D-CFG-21` — Autorização e estados vazios

- `GET` e `PUT` exigem `clinica.configurar`; CSRF somente no `PUT`.
- Clínica sem grade → `200` com lista vazia; linha de `clinica` ausente → `404 CLINICA_NAO_CONFIGURADA`.
- Nenhuma permissão nova.
### 3.11 Catálogo de serviços (`CFG-003`) — `D-CFG-22`..`D-CFG-33` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP3`)*

Homologadas por Bruno Menezes Noronha em 17/09/2026, que aprovou integralmente as decisões `DS-01`..`DS-12` do pacote `CFG-PREP3` (somente leitura, medido sobre `origin/main` = `02cc93d`), **incluindo expressamente a alteração estrutural de banco de `DS-01` e `DS-08`**. **Registro normativo; nenhum código, schema, migration ou teste alterado.** A aprovação autoriza a materialização documental; **não** autoriza ainda implementação de runtime, schema ou migration.

**Fatos de partida (`CFG-PREP3`).** A tabela `servico` já existe (`id uuid PK`; `clinica_id` FK NN `RESTRICT`; `nome text NN`; `duracao_min integer NN`; `preco_referencia numeric(12,2) NN`; `ativo boolean NN` sem default; `inativado_em timestamptz ∅`; `criado_em`), **sem** unicidade, **sem** CHECK, **sem** índice além da PK e **sem** `atualizado_em`. É referenciada por `profissional_servico`, `agendamento` e `pacote` (todas as FKs `RESTRICT`). `docs/07` §23 classifica Serviço como ativo/inativo com preservação histórica e exclusão física **não oferecida pelo fluxo**. `cobranca.valor_bruto` **copia** o preço de referência na criação (`docs/07` §7.2). `configuracao.alterada` já abrange `servico` (`docs/09` §13.6).

#### 3.11.1 `D-CFG-22` — Unicidade do nome (`DS-01`)

- Nome **único por clínica**, abrangendo serviços **ativos e inativos**, comparado **sem distinção de caixa e sem espaços nas bordas**: chave `(clinica_id, lower(btrim(nome)))`.
- O nome de um serviço inativo **não é liberado para reuso**; o caminho é a reativação (mesmo racional de `H2.2-13`).
- Violação → **`409 SERVICO_DUPLICADO`**, em criação e em edição. A rejeição concorrente pelo índice (`23505` **naquele índice**) tem o mesmo desfecho; `23505` em qualquer outra restrição não é traduzido para `409`.

#### 3.11.2 `D-CFG-23` — Invariantes físicas (`DS-08`)

- **Autorizada a futura migration** com:
  - índice único `(clinica_id, lower(btrim(nome)))` (`D-CFG-22`);
  - `CHECK (duracao_min > 0)`;
  - `CHECK (preco_referencia >= 0)`;
  - `CHECK` de coerência `ativo = (inativado_em IS NULL)`.
- As invariantes passam a não depender unicamente da aplicação. Nomes físicos das restrições, verificação de dados e fixtures existentes, golden SQL e o alinhamento editorial de `docs/07` §10.1/§10.2 pertencem à fatia de implementação — `docs/07` **só é atualizado após a migration integrada**, pelo precedente da sua REV. 2.2.

#### 3.11.3 `D-CFG-24` — Contrato HTTP (`DS-02`)

Rotas de nível superior, em módulo próprio:

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `GET /servicos[?ativo=true\|false]` | `200` lista | `400` filtro inválido |
| `GET /servicos/:servicoId` | `200` | `400` id malformado; `404 SERVICO_NAO_ENCONTRADO` |
| `POST /servicos` | `201` | `400`; `404 CLINICA_NAO_CONFIGURADA`; `409 SERVICO_DUPLICADO` |
| `PUT /servicos/:servicoId` | `200` | `400`; `404 SERVICO_NAO_ENCONTRADO`; `409 SERVICO_DUPLICADO` |
| `PATCH /servicos/:servicoId/situacao` | `200` | `400`; `404 SERVICO_NAO_ENCONTRADO` |

- Corpo de `POST` e `PUT` — **exatamente** `{ nome, duracaoMin, precoReferencia }`; `PUT` é substituição total desses três campos.
- Resposta — **exatamente** `{ id, nome, duracaoMin, precoReferencia, ativo, inativadoEm }`; `inativadoEm` em ISO-8601 ou `null`; `clinicaId` e `criadoEm` **não** são expostos. No `PUT` e no `PATCH`, o corpo é o estado vigente após a operação, inclusive no no-op.
- `clinica_id` é resolvido no servidor a partir da linha única de `clinica`; nunca vem do cliente.
- **Não existe rota de exclusão** (`DELETE`), em nenhuma condição (`docs/07` §23, RN-007).
- Erros no envelope `{ erro: <código> }`; `401`, `403` e `500 FALHA_INTERNA` pelos contratos gerais. Códigos novos: somente `SERVICO_NAO_ENCONTRADO` e `SERVICO_DUPLICADO`.

#### 3.11.4 `D-CFG-25` — Situação (`DS-03`)

- Alterada **somente** por `PATCH /servicos/:servicoId/situacao` com corpo exato `{ ativo: boolean }`; o `PUT` não aceita `ativo`.
- Inativação: `ativo = false`, `inativado_em = now()`. Reativação: `ativo = true`, `inativado_em = NULL`.
- Pedido cujo `ativo` já é o vigente → `200` com o estado corrente, **sem** mutação, **sem** alterar `inativado_em` e **sem** auditoria (mesmo critério de `D21-03`).
- Inativar ou reativar **nunca** altera `profissional_servico`, `agendamento`, `pacote` ou `cobranca`.

#### 3.11.5 `D-CFG-26` — Criação sempre ativa (`DS-04`)

- `POST /servicos` cria sempre com `ativo = true` e `inativado_em = NULL`; o corpo não aceita `ativo`.

#### 3.11.6 `D-CFG-27` — Validação e representação (`DS-05`, `DS-06`, `DS-07`)

| Campo | Regra |
| --- | --- |
| `nome` | string; aplicar `trim`; **1–200** caracteres após `trim`; **sem caracteres de controle**; persistido já sem espaços de borda |
| `duracaoMin` | inteiro JSON; **1..1440** minutos; sem exigência de múltiplos |
| `precoReferencia` | **string decimal canônica não negativa** compatível com `numeric(12,2)`: `^(0\|[1-9]\d{0,9})\.\d{2}$`; `"0.00"` aceito; `number` JSON rejeitado |

- **Sem coerção de tipos**; corpo estrito (chave extra ou ausente, `null`, array ou objeto não plano → `400 REQUISICAO_INVALIDA`); sem dependência nova.
- **Dinheiro sem float:** a resposta devolve o preço como string canônica de duas casas, lida do banco sem passar por `number`; comparações (inclusive de no-op) usam a forma canônica ou centavos inteiros — mesmo contrato de `ehDecimalMonetarioCanonico` e `CobrancaService`.

#### 3.11.7 `D-CFG-28` — Listagem (`DS-09`)

- **Sem paginação** e sem busca textual.
- Retorna ativos e inativos; filtro opcional `?ativo=true|false` (qualquer outro valor → `400`).
- Ordem canônica determinística: `ativo DESC`, `lower(nome)`, `id`.
- `GET` com `Cache-Control: no-store`.

#### 3.11.8 `D-CFG-29` — Concorrência (`DS-10`)

- `PUT` e `PATCH` serializam por `SELECT ... FOR UPDATE` na linha de `servico`; a comparação de no-op ocorre **sob o lock**; a **última escrita válida prevalece**.
- **Sem** coluna de versão, `If-Match` ou controle otimista nesta fase; `409` existe **somente** por `D-CFG-22`.
- Limitação aceita: atualização perdida entre administradores concorrentes não é detectada (mesma de `D-CFG-05`).

#### 3.11.9 `D-CFG-30` — Autorização (`DS-11`)

- Todas as rotas exigem **`clinica.configurar`**; `ProtecaoCsrfGuard` **somente** em `POST`, `PUT` e `PATCH`.
- Leitura por outros papéis (ex.: seleção de serviço pela Recepção) **não** é concedida agora; será decidida na fatia de agenda. **Nenhuma permissão nova.**
- `403` por falta de permissão **não** gera evento (lista fechada de `L-07`).

#### 3.11.10 `D-CFG-31` — Edição de serviço inativo (`DS-12`)

- `PUT` é **permitido** sobre serviço inativo e **não** altera a situação.

#### 3.11.11 `D-CFG-32` — Auditoria

- Criação, edição efetiva, inativação e reativação emitem, cada uma, **um** `configuracao.alterada` com `alvo_tipo = "servico"`, `alvo_id = servico.id`, ator da sessão, `resultado = SUCESSO`, `justificativa = null`, `contexto` **vazio**, na **mesma transação** da mutação (falha → rollback conjunto).
- No-op, consulta, validação rejeitada e negação de autorização **não** emitem evento.
- Nome, duração e preço **nunca** são registrados. Aplicação direta de `docs/09` §13.6; nenhuma ação, chave de `contexto` ou `alvo_tipo` novo. Permanece a limitação declarada de §13.6 (estado anterior, inclusive preço anterior, não preservado).

#### 3.11.12 `D-CFG-33` — Contrato oferecido aos módulos futuros

Registro de fronteira; **nenhum** destes módulos é implementado ou decidido aqui.

- **Identidade:** `servico.id` é o identificador estável referenciado por `profissional_servico` (PRO-004), `agendamento` e `pacote` (H2-07).
- **Elegibilidade:** `ativo = true` é o predicado para **novo** uso operacional (CFG-003, RN-008, RN-013); referências existentes permanecem íntegras após inativação (RN-007).
- **Duração:** `duracao_min` é **valor padrão** para o fim proposto de um novo agendamento; o agendamento persiste `inicio`/`fim` próprios e alterações do serviço não os reescrevem. Se a duração é sobrescrevível por agendamento é decisão da fatia de agenda.
- **Preço:** `preco_referencia` é referência para **novas** cobranças, que copiam o valor na criação; alterações nunca reescrevem cobranças existentes.
- **Pendências de fronteira:** novo pacote com serviço inativo e agendamento por pacote cujo serviço foi inativado (H2-07 × RN-013) ficam para as fatias de pacotes e agenda; a relação entre `clinica.duracao_padrao_atendimento_min` (`D-CFG-07`) e `servico.duracao_min` fica para a retomada de `D-CFG-07`.

### 3.12 Formas de pagamento (`CFG-004`) — `D-CFG-34`..`D-CFG-45` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP4`)*

Homologadas por Bruno Menezes Noronha em 17/09/2026, que aprovou integralmente as recomendações do pacote `CFG-PREP4` (somente leitura, medido sobre `origin/main` = `7fa114c`), **incluindo a alteração estrutural de banco de `D-CFG-35`** e a regra de edição de `D-CFG-40`. **Registro normativo; nenhum código, schema, migration ou teste alterado.** A aprovação autoriza a materialização documental; **não** autoriza ainda implementação de runtime, schema ou migration.

**Fatos de partida (`CFG-PREP4`).** A tabela `forma_pagamento` já existe (`id uuid PK`; `clinica_id` FK NN `RESTRICT`; `descricao text NN`; `ativo boolean NN` sem default; `inativado_em timestamptz ∅`; `criado_em`), **sem** unicidade, **sem** CHECK, **sem** índice além da PK e **sem** `atualizado_em`. É referenciada **somente** por `pagamento.forma_pagamento_id` (FK NN `RESTRICT`, índice `pagamento_forma_pagamento_id_idx`); `pagamento` é append-only e **não copia** a descrição da forma (`docs/07`). FIN-004 exige forma **ativa no momento do registro**; RN-007 preserva formas inativas em dados históricos. `docs/04` §4 atribui "Gerenciar formas de pagamento" somente ao Administrador, sem permissão específica no catálogo. `configuracao.alterada` já abrange `forma_pagamento` (`docs/09` §13.6). Não existe runtime de CFG-004 nem de registro de pagamento.

#### 3.12.1 `D-CFG-34` — Unicidade da descrição

- Descrição **única por clínica**, abrangendo formas **ativas e inativas**, comparada **sem distinção de caixa e sem espaços nas bordas**: chave `(clinica_id, lower(btrim(descricao)))`.
- A descrição de forma inativa **não é liberada para reuso**; o caminho é a reativação.
- Violação → **`409 FORMA_PAGAMENTO_DUPLICADA`**, em criação e em edição. A rejeição concorrente pelo índice (`23505` **naquele índice**) tem o mesmo desfecho; `23505` em qualquer outra restrição não é traduzido para `409`. A detecção de duplicidade **não** compara caixa em JavaScript.

#### 3.12.2 `D-CFG-35` — Invariantes físicas

- **Autorizada a futura migration** com:
  - índice único `(clinica_id, lower(btrim(descricao)))` (`D-CFG-34`);
  - `CHECK` de coerência `ativo = (inativado_em IS NULL)`.
- Nomes físicos, verificação de dados e fixtures, golden SQL, inventário protegido e o alinhamento de `docs/07` §10.1/§10.2 pertencem à fatia de implementação; `docs/07` **só é atualizado após a migration integrada**.

#### 3.12.3 `D-CFG-36` — Contrato HTTP

Rotas de nível superior, em módulo próprio:

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `GET /formas-pagamento[?ativo=true\|false]` | `200` lista | `400` filtro inválido |
| `GET /formas-pagamento/:formaPagamentoId` | `200` | `400` id malformado; `404 FORMA_PAGAMENTO_NAO_ENCONTRADA` |
| `POST /formas-pagamento` | `201` | `400`; `404 CLINICA_NAO_CONFIGURADA`; `409 FORMA_PAGAMENTO_DUPLICADA` |
| `PUT /formas-pagamento/:formaPagamentoId` | `200` | `400`; `404 FORMA_PAGAMENTO_NAO_ENCONTRADA`; `409 FORMA_PAGAMENTO_DUPLICADA`; `409 FORMA_PAGAMENTO_EM_USO` |
| `PATCH /formas-pagamento/:formaPagamentoId/situacao` | `200` | `400`; `404 FORMA_PAGAMENTO_NAO_ENCONTRADA` |

- Corpo de `POST` e `PUT` — **exatamente** `{ descricao }`; `PUT` é substituição total.
- Resposta — **exatamente** `{ id, descricao, ativo, inativadoEm }`; `inativadoEm` em ISO-8601 ou `null`; `clinicaId` e `criadoEm` **não** são expostos. No `PUT` e no `PATCH`, o corpo é o estado vigente após a operação, inclusive no no-op.
- `clinica_id` é resolvido no servidor a partir da linha única de `clinica`; nunca vem do cliente.
- **Não existe rota de exclusão** (`DELETE`), em nenhuma condição (RN-007, `docs/07` §23).
- Erros no envelope `{ erro: <código> }`; `401`, `403` e `500 FALHA_INTERNA` pelos contratos gerais. Códigos novos: somente `FORMA_PAGAMENTO_NAO_ENCONTRADA`, `FORMA_PAGAMENTO_DUPLICADA` e `FORMA_PAGAMENTO_EM_USO`.

#### 3.12.4 `D-CFG-37` — Criação e situação

- Criação sempre com `ativo = true` e `inativado_em = NULL`; o corpo não aceita `ativo`.
- Situação alterada **somente** por `PATCH /formas-pagamento/:formaPagamentoId/situacao` com corpo exato `{ ativo: boolean }`.
- Inativação: `ativo = false`, `inativado_em = now()`. Reativação: `ativo = true`, `inativado_em = NULL`.
- Pedido cujo `ativo` já é o vigente → `200` com o estado corrente, **sem** mutação, **sem** alterar `inativado_em` e **sem** auditoria.
- Inativar ou reativar é permitido **com ou sem** pagamentos referenciando a forma e **nunca** altera `pagamento`.

#### 3.12.5 `D-CFG-38` — Validação da descrição

- `descricao`: string; aplicar `trim`; **1–100** caracteres (code points) após `trim`; **sem caracteres de controle**; persistida já sem espaços de borda.
- **Não** há campo de tipo/categoria (dinheiro, PIX, cartão etc.) nem integração com meios de pagamento (TLF-BASE-V1 §13).
- **Sem coerção de tipos**; corpo estrito (chave extra ou ausente, `null`, array ou objeto não plano → `400 REQUISICAO_INVALIDA`); sem dependência nova.

#### 3.12.6 `D-CFG-39` — Sem formas pré-cadastradas

- Nenhuma forma de pagamento é criada por provisionamento, seed ou migration; o Administrador as cadastra pela API.
- `bootstrap-clinica` (`D-CFG-10`..`D-CFG-12`) permanece inalterado.

#### 3.12.7 `D-CFG-40` — Edição de forma já utilizada

- `PUT` sobre forma **referenciada por qualquer `pagamento`** → **`409 FORMA_PAGAMENTO_EM_USO`**, sem mutação e sem auditoria. A correção é inativar a forma e criar outra.
- `PUT` sobre forma **sem** pagamento é permitido, inclusive se inativa, e não altera a situação.
- A comparação de no-op **precede** a verificação de uso: `PUT` idêntico ao vigente sobre forma em uso → `200` sem mutação e sem auditoria.
- A verificação ocorre **sob o lock** de `D-CFG-41`, na mesma transação da mutação.
- Fundamento: `pagamento` é evidência financeira append-only que referencia a forma sem copiar sua descrição; renomear forma usada reescreveria retroativamente recibos e relatórios (FIN-008). A diferença em relação a `D-CFG-31` (serviço) é deliberada: o preço do serviço é copiado para a cobrança; a descrição da forma não é copiada.

#### 3.12.8 `D-CFG-41` — Concorrência

- `PUT` e `PATCH` serializam por `SELECT ... FOR UPDATE` na linha de `forma_pagamento`; comparação de no-op e verificação de uso ocorrem **sob o lock**; a **última escrita válida prevalece**.
- **Sem** coluna de versão, `If-Match` ou controle otimista; `409` existe **somente** por `D-CFG-34` e `D-CFG-40`.
- Limitação aceita: atualização perdida entre administradores concorrentes não é detectada.

#### 3.12.9 `D-CFG-42` — Listagem

- **Sem paginação** e sem busca textual.
- Retorna ativas e inativas; filtro opcional `?ativo=true|false` (qualquer outro valor → `400`).
- Ordem canônica determinística: `ativo DESC`, `lower(descricao)`, `id`.
- `GET` com `Cache-Control: no-store`.

#### 3.12.10 `D-CFG-43` — Autorização

- Todas as rotas exigem **`clinica.configurar`**; `ProtecaoCsrfGuard` **somente** em `POST`, `PUT` e `PATCH`.
- Leitura por outros papéis (ex.: seleção de forma ativa pela Recepção ao registrar pagamento) **não** é concedida agora; será decidida na fatia de pagamentos. **Nenhuma permissão nova.**
- `403` por falta de permissão **não** gera evento (lista fechada de `L-07`).

#### 3.12.11 `D-CFG-44` — Auditoria

- Criação, edição efetiva, inativação e reativação emitem, cada uma, **um** `configuracao.alterada` com `alvo_tipo = "forma_pagamento"`, `alvo_id = forma_pagamento.id`, ator da sessão, `resultado = SUCESSO`, `justificativa = null`, `contexto` **vazio**, na **mesma transação** da mutação (falha → rollback conjunto).
- No-op, consulta, validação rejeitada, `409` e negação de autorização **não** emitem evento.
- A descrição **nunca** é registrada. Aplicação direta de `docs/09` §13.6; nenhuma ação, chave de `contexto` ou `alvo_tipo` novo. Permanece a limitação declarada de §13.6 (estado anterior não preservado).

#### 3.12.12 `D-CFG-45` — Contrato oferecido aos módulos futuros

Registro de fronteira; **nenhum** destes módulos é implementado ou decidido aqui.

- **Identidade:** `forma_pagamento.id` é o identificador estável referenciado por `pagamento`.
- **Elegibilidade:** `ativo = true` é o predicado para **novo** pagamento (FIN-004), verificado no backend dentro de T-03; pagamentos existentes permanecem íntegros e relatáveis (FIN-008) após inativação (RN-007).
- **Serialização com `D-CFG-40`:** T-03 deve bloquear a linha da forma (`SELECT ... FOR SHARE` ou mais forte) ao verificar sua situação, para que o registro de pagamento não corra com edição ou inativação concorrente.
- **Pendências de fronteira:** leitura das formas ativas pela Recepção (`D-CFG-43`) e o detalhamento de T-03 ficam para a fatia de pagamentos.

## 4. Consequências normativas já definidas (sem ampliação)

- **Auditoria** (`docs/09` §13.6): mutação efetiva de `clinica` (`CFG-001`, `CFG-006`) emite `configuracao.alterada` com ator da sessão, `alvo_tipo = "clinica"`, `alvo_id = clinica.id`, `resultado = SUCESSO`, `justificativa = null`, `contexto` vazio, na **mesma transação** da mutação; falha da auditoria implica rollback conjunto. Nenhum valor de campo é registrado. *Alcance por frente:* `CFG-002` usa o mesmo alvo `clinica` por leitura homologada (`D-CFG-17`); `CFG-003` usa `alvo_tipo = "servico"` e `alvo_id = servico.id` (`D-CFG-32`); `CFG-004` usa `alvo_tipo = "forma_pagamento"` e `alvo_id = forma_pagamento.id` (`D-CFG-44`). Em todas, `contexto` vazio e nenhum valor de campo registrado.
- **Autorização** (`D-2.3D-09`): sem sessão → `401`; sem permissão → `403`; CSRF obrigatório somente na rota mutante.
- **Não ampliação:** nenhuma permissão, ação de auditoria, chave de `contexto` ou dependência nova decorre deste registro.

## 5. Pendências abertas

| Item | Estado |
| --- | --- |
| `P-CFG-01` — implementação da fatia `CFG-001A` (migration de linha única, GET/PUT `/clinica`, testes) | **INTEGRADA NA `main`** — PR [#65](https://github.com/BrunoMNoronha/techlab-fisio/pull/65), commit de integração `6ee19f27afc5d7c55667ef910536baa924ecc990` (`docs/10` §6-W, §6-X.5) |
| `P-CFG-02` — provisionamento da linha de `clinica` (`CFG-001B`; `D-CFG-01`, `D-CFG-09`..`D-CFG-12`) | **INTEGRADO NA `main`** — PR [#69](https://github.com/BrunoMNoronha/techlab-fisio/pull/69), merge commit `02cc93d5770003775d3417b1d2ee08a874675d30` (`docs/10` §6-X, §6-X.5) |
| Logotipo e duração padrão (`D-CFG-07`) | **FUTURO DO MVP** — não implementados |
| `P-CFG-03` — implementação de `CFG-002` (`D-CFG-13`..`D-CFG-21`) | **INTEGRADA NA `main`** — PR [#76](https://github.com/BrunoMNoronha/techlab-fisio/pull/76), merge commit `ad2bcf8041635f469db6c799e7405f455d836d30` (`docs/10` §6-Y, §6-Y.6) |
| Exceções e feriados do horário de funcionamento (`D-CFG-19`) | **FUTURO DO MVP** |
| Aplicação de RN-014 e reavaliação da troca de fuso (`D-CFG-20`, `D-CFG-08`) | **PENDENTE DA FATIA DE AGENDA** |
| `P-CFG-04` — implementação de `CFG-003` (`D-CFG-22`..`D-CFG-33`: migration de unicidade e CHECKs de `servico`, rotas `/servicos`, testes) | **IMPLEMENTADA E MEDIDA EM BRANCH PRÓPRIA (`agent/cfg-003-catalogo-servicos`) — NÃO INTEGRADA** (`docs/10` §6-Z); implementação autorizada por Bruno Menezes Noronha em 17/09/2026 |
| Alinhamento de `docs/07` §10.1/§10.2 às restrições de `D-CFG-23` | **PENDENTE** — após integração da migration |
| Leitura do catálogo de serviços por outros papéis; pacote/agendamento com serviço inativo; duração sobrescrevível (`D-CFG-30`, `D-CFG-33`) | **PENDENTE DAS FATIAS DE AGENDA E PACOTES** |
| CFG-002 | **INTEGRADO NA `main`** (exceto exceções/feriados e aplicação de RN-014, acima) |
| CFG-003 | **IMPLEMENTADO EM BRANCH PRÓPRIA — NÃO INTEGRADO** (`docs/10` §6-Z) |
| `P-CFG-05` — implementação de `CFG-004` (`D-CFG-34`..`D-CFG-45`: migration de unicidade e CHECK de `forma_pagamento`, rotas `/formas-pagamento`, testes) | **DECIDIDO — IMPLEMENTAÇÃO NÃO AUTORIZADA** |
| Alinhamento de `docs/07` §10.1/§10.2 às restrições de `D-CFG-35` | **PENDENTE** — após integração da migration |
| Leitura das formas de pagamento por outros papéis; bloqueio da forma em T-03 (`D-CFG-43`, `D-CFG-45`) | **PENDENTE DA FATIA DE PAGAMENTOS** |
| CFG-005 | **NÃO INICIADO** |
| Inclusão da clínica no subcomando `provisionar` (`D-CFG-12`) | **NÃO AUTORIZADA** — reavaliação futura possível |
| Alinhamento de `docs/07` (afirmava restrição então inexistente) | **RESOLVIDO** — migration `20260917060000_clinica_linha_unica` (`ux_clinica_linha_unica`) integrada na `main` pela PR #65 |

## 6. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **13** | 17/09/2026 | Atualização factual de §5: `P-CFG-04` (`CFG-003`) implementada e medida em branch própria (`docs/10` §6-Z), após autorização de implementação por Bruno Menezes Noronha. Nenhuma decisão criada, alterada ou reaberta. |
| **12** | 17/09/2026 | Reconciliação factual pós-integração de §5: `P-CFG-03` / `CFG-002` integrada pela PR #76 (merge `ad2bcf8`). O registro da REV. 10 permanece como histórico. Nenhuma decisão normativa criada, alterada ou reaberta. |
| **11** | 17/09/2026 | Acréscimo de `D-CFG-34`..`D-CFG-45` (§3.12) — formas de pagamento (`CFG-004`) —, homologadas por Bruno Menezes Noronha a partir das recomendações do pacote `CFG-PREP4`: unicidade da descrição e CHECK de coerência (migration futura autorizada); rotas `/formas-pagamento` sem `DELETE`; descrição 1–100 sem campo de tipo; sem formas pré-cadastradas; `409 FORMA_PAGAMENTO_EM_USO` na edição de forma referenciada por pagamento; `FOR UPDATE`; `clinica.configurar`; auditoria com `alvo_tipo = "forma_pagamento"`; contrato de fronteira com T-03. Cabeçalho, §4 e §5 atualizados. Nenhuma decisão anterior alterada; nenhum código alterado; implementação não autorizada. |
| **10** | 17/09/2026 | Atualização factual de §5: `P-CFG-03` implementada e medida em branch própria (`docs/10` §6-Y); nenhuma decisão criada, alterada ou reaberta. |
| **9** | 17/09/2026 | Correções editoriais: título e insumo decisório do cabeçalho abrangem `CFG-001`..`CFG-006` e os pacotes `CFG-PREP0`..`CFG-PREP3`; referência de exclusão física em §3.10.3 corrigida de `docs/07` §28 para §23; nota de alcance da auditoria em §4 (`D-CFG-17`, `D-CFG-32`); §5 sem linhas duplicadas de CFG-002/CFG-003 e `P-CFG-03` com a autorização de implementação dada por Bruno em 17/09/2026. Nenhuma decisão criada, alterada ou reaberta. |
| **8** | 17/09/2026 | Acréscimo de `D-CFG-22`..`D-CFG-33` (§3.11) — catálogo de serviços (`CFG-003`) —, homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP3` (`DS-01`..`DS-12`), incluindo a autorização expressa da futura migration de unicidade do nome e CHECKs de `servico`. §5 atualizada. Integrada após `CFG-002` (REV. 7, PR #72), cujas `D-CFG-13`..`D-CFG-21` e §3.10 são preservadas. Nenhuma decisão anterior alterada; nenhum código, schema ou migration alterado. |
| **7** | 17/09/2026 | Acréscimo de `D-CFG-13`..`D-CFG-21` (§3.10) — horário de funcionamento (`CFG-002`) —, homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP2` (opções recomendadas, inclusive 0 = domingo e limite de 4 janelas/dia). Inclui leitura homologada de `docs/09` §13.6 (alvo `clinica`). §5 atualizada. Nenhuma decisão anterior alterada; nenhum código alterado. |
| **6** | 17/09/2026 | Reconciliação factual pós-integração (`CFG-POST1`) de §5: `P-CFG-01` integrada pela PR #65 (`6ee19f2`) e `P-CFG-02` integrado pela PR #69 (`02cc93d`); alinhamento de `docs/07` resolvido; restrição de `provisionar` (`D-CFG-12`) explicitada como pendência. Os registros das REV. 2 e 5 permanecem como histórico. Nenhuma decisão normativa criada, alterada ou reaberta. |
| **5** | 17/09/2026 | Atualização factual de §5: `P-CFG-02` implementado e medido em branch própria (`docs/10` §6-X); nenhuma decisão criada, alterada ou reaberta. |
| **4** | 17/09/2026 | Acréscimo de `D-CFG-09`..`D-CFG-12` (§3.9) — autoria nula com justificativa, reexecução idempotente, entrada por ambiente e subcomando `bootstrap-clinica` —, homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP1` (opções conservadoras). Nenhuma decisão anterior alterada; nenhum código alterado. |
| **3** | 17/09/2026 | Adendos `D-CFG-03-A` (representação da resposta) e `D-CFG-04-A` (predicado exato do e-mail), homologados por Bruno Menezes Noronha em 17/09/2026 em resposta à revisão do PR #60. Formalizam o comportamento já implementado em `CFG-001A`; nenhuma decisão anterior alterada. |
| **2** | 17/09/2026 | Atualização factual de §5: `P-CFG-01` implementada e medida em branch própria (`docs/10` §6-W); nenhuma decisão criada, alterada ou reaberta. |
| **1** | 17/09/2026 | Registro inicial: `D-CFG-01`..`D-CFG-08` homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP0`. Somente documental; nenhum código, migration ou teste alterado. |

---

**Fim — `docs/14-decisoes-configuracao-clinica.md`.**
