# Decisões da Configuração da Clínica (`CFG-001`..`CFG-006`)

> **Documento:** `docs/14-decisoes-configuracao-clinica.md`
> **Projeto:** TechLab Fisio
> **Frente:** Fase 3 — Configuração da Clínica (módulo M2, `CFG-001..CFG-006`)
> **Status:** **DECIDIDO — `D-CFG-01`..`D-CFG-08` E ADENDOS `D-CFG-03-A` E `D-CFG-04-A` HOMOLOGADOS POR BRUNO MENEZES NORONHA EM 17/09/2026; `D-CFG-09`..`D-CFG-12` (PROVISIONAMENTO DA CLÍNICA) HOMOLOGADAS EM 17/09/2026; `D-CFG-13`..`D-CFG-21` (HORÁRIO DE FUNCIONAMENTO, CFG-002) HOMOLOGADAS EM 17/09/2026; `D-CFG-22`..`D-CFG-33` (CATÁLOGO DE SERVIÇOS, CFG-003) HOMOLOGADAS EM 17/09/2026; `D-CFG-34`..`D-CFG-45` (FORMAS DE PAGAMENTO, CFG-004) HOMOLOGADAS EM 17/09/2026; `D-CFG-46`..`D-CFG-57` (MOTIVOS DE CANCELAMENTO, CFG-005) HOMOLOGADAS EM 17/09/2026; `D-CFG-58`..`D-CFG-66` (FECHAMENTO DA CONFIGURAÇÃO HORÁRIA, FRENTE `CFG-HOR`) DECIDIDAS EM 17/09/2026 A PARTIR DAS FONTES VIGENTES, POR SOLICITAÇÃO DE BRUNO MENEZES NORONHA, E HOMOLOGADAS POR ELE EM 17/09/2026, SEM ALTERAÇÃO DE TEOR (REV. 26)** (TLF-BASE-V1 §15, item 1).
> **Data:** 17 de setembro de 2026
> **Insumo decisório:** pacotes de análise somente leitura `CFG-PREP0` (`D-CFG-01`..`D-CFG-08`, sobre `origin/main` = `63bb058`), `CFG-PREP1` (`D-CFG-09`..`D-CFG-12`), `CFG-PREP2` (`D-CFG-13`..`D-CFG-21`), `CFG-PREP3` (`D-CFG-22`..`D-CFG-33`), `CFG-PREP4` (`D-CFG-34`..`D-CFG-45`), `CFG-PREP5` (`D-CFG-46`..`D-CFG-57`) e a frente de fechamento `CFG-HOR` (`D-CFG-58`..`D-CFG-66`, medida no workspace local sobre `bd772a3`); a base medida de cada um consta da respectiva seção.
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

### 3.13 Motivos de cancelamento (`CFG-005`) — `D-CFG-46`..`D-CFG-57` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP5`)*

Homologadas por Bruno Menezes Noronha em 17/09/2026, que aprovou integralmente as recomendações do pacote `CFG-PREP5` (somente leitura, medido sobre `origin/main` = `113acbd`), **incluindo a alteração estrutural de banco de `D-CFG-47`** e a regra de edição de `D-CFG-50`. **Registro normativo; nenhum código, schema, migration ou teste alterado.** A aprovação autoriza a materialização documental; **não** autoriza ainda implementação de runtime, schema ou migration.

**Fatos de partida (`CFG-PREP5`).** A tabela `motivo_cancelamento` já existe com a mesma forma de `forma_pagamento` (`id uuid PK`; `clinica_id` FK NN `RESTRICT`; `descricao text NN`; `ativo boolean NN` sem default; `inativado_em timestamptz ∅`; `criado_em`), **sem** unicidade, **sem** CHECK e **sem** índice além da PK. É referenciada por `agendamento.motivo_cancelamento_id` e por `historico_agendamento.motivo_cancelamento_id` (ambas FK **anuláveis** `RESTRICT`); `historico_agendamento` é append-only (AGD-009, RN-017) e **não copia** a descrição. `pacote.motivo_cancelamento` e `cobranca.motivo_cancelamento` são **texto livre**, sem FK: CFG-005 abrange somente a agenda ("cancelamento da agenda", `docs/02`). AGD-003 prevê "motivo padronizado", mas o schema não exige o motivo nem o vincula a `estado = CANCELADO`, e CFG-005 fala em "cancelamento **que exige** motivo". **RN-007 não lista motivos de cancelamento**; `docs/07` §23 os agrupa com serviço e forma de pagamento (ativo/inativo com preservação histórica). `docs/04` §4 atribui "Gerenciar motivos de cancelamento" somente ao Administrador; "Cancelar agendamento" usa `agenda.gerenciar`. `configuracao.alterada` já abrange `motivo_cancelamento` (`docs/09` §13.6). Não existe runtime de CFG-005 nem de agenda.

#### 3.13.1 `D-CFG-46` — Unicidade da descrição

- Descrição **única por clínica**, abrangendo motivos **ativos e inativos**, comparada **sem distinção de caixa e sem espaços nas bordas**: chave `(clinica_id, lower(btrim(descricao)))`.
- A descrição de motivo inativo **não é liberada para reuso**; o caminho é a reativação.
- Violação → **`409 MOTIVO_CANCELAMENTO_DUPLICADO`**, em criação e em edição. A rejeição concorrente pelo índice (`23505` **naquele índice**) tem o mesmo desfecho; `23505` em qualquer outra restrição não é traduzido para `409`. A detecção de duplicidade **não** compara caixa em JavaScript.

#### 3.13.2 `D-CFG-47` — Invariantes físicas

- **Autorizada a futura migration** com:
  - índice único `(clinica_id, lower(btrim(descricao)))` (`D-CFG-46`);
  - `CHECK` de coerência `ativo = (inativado_em IS NULL)`.
- Nomes físicos, verificação de dados e fixtures, golden SQL, inventário protegido e o alinhamento de `docs/07` §10.1/§10.2 pertencem à fatia de implementação; `docs/07` **só é atualizado após a migration integrada**.
- **Nenhuma** restrição é criada em `agendamento` ou `historico_agendamento` por esta frente (`D-CFG-51`).

#### 3.13.3 `D-CFG-48` — Contrato HTTP

Rotas de nível superior, em módulo próprio:

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `GET /motivos-cancelamento[?ativo=true\|false]` | `200` lista | `400` filtro inválido |
| `GET /motivos-cancelamento/:motivoCancelamentoId` | `200` | `400` id malformado; `404 MOTIVO_CANCELAMENTO_NAO_ENCONTRADO` |
| `POST /motivos-cancelamento` | `201` | `400`; `404 CLINICA_NAO_CONFIGURADA`; `409 MOTIVO_CANCELAMENTO_DUPLICADO` |
| `PUT /motivos-cancelamento/:motivoCancelamentoId` | `200` | `400`; `404 MOTIVO_CANCELAMENTO_NAO_ENCONTRADO`; `409 MOTIVO_CANCELAMENTO_DUPLICADO`; `409 MOTIVO_CANCELAMENTO_EM_USO` |
| `PATCH /motivos-cancelamento/:motivoCancelamentoId/situacao` | `200` | `400`; `404 MOTIVO_CANCELAMENTO_NAO_ENCONTRADO` |

- Corpo de `POST` e `PUT` — **exatamente** `{ descricao }`; `PUT` é substituição total.
- Resposta — **exatamente** `{ id, descricao, ativo, inativadoEm }`; `inativadoEm` em ISO-8601 ou `null`; `clinicaId` e `criadoEm` **não** são expostos. No `PUT` e no `PATCH`, o corpo é o estado vigente após a operação, inclusive no no-op.
- `clinica_id` é resolvido no servidor a partir da linha única de `clinica`; nunca vem do cliente.
- **Não existe rota de exclusão** (`DELETE`), em nenhuma condição (`D-CFG-54`, `docs/07` §23).
- Erros no envelope `{ erro: <código> }`; `401`, `403` e `500 FALHA_INTERNA` pelos contratos gerais. Códigos novos: somente `MOTIVO_CANCELAMENTO_NAO_ENCONTRADO`, `MOTIVO_CANCELAMENTO_DUPLICADO` e `MOTIVO_CANCELAMENTO_EM_USO`.
- Módulo **separado** de `/formas-pagamento`, **sem abstração genérica** compartilhada: as regras de uso diferem (`D-CFG-40` × `D-CFG-50`).

#### 3.13.4 `D-CFG-49` — Criação, situação e validação

- Criação sempre com `ativo = true` e `inativado_em = NULL`; o corpo não aceita `ativo`.
- Situação alterada **somente** por `PATCH /motivos-cancelamento/:motivoCancelamentoId/situacao` com corpo exato `{ ativo: boolean }`. Inativação: `ativo = false`, `inativado_em = now()`; reativação: `ativo = true`, `inativado_em = NULL`.
- Pedido cujo `ativo` já é o vigente → `200` com o estado corrente, **sem** mutação, **sem** alterar `inativado_em` e **sem** auditoria.
- Inativar ou reativar é permitido **com ou sem** referências e **nunca** altera `agendamento` ou `historico_agendamento`.
- `descricao`: string; aplicar `trim`; **1–100** caracteres (code points) após `trim`; **sem caracteres de controle**; persistida já sem espaços de borda. Sem campo de tipo/categoria.
- **Sem coerção de tipos**; corpo estrito (chave extra ou ausente, `null`, array ou objeto não plano → `400 REQUISICAO_INVALIDA`); sem dependência nova.

#### 3.13.5 `D-CFG-50` — Edição de motivo já utilizado

- `PUT` sobre motivo **referenciado por qualquer linha de `agendamento` ou de `historico_agendamento`** → **`409 MOTIVO_CANCELAMENTO_EM_USO`**, sem mutação e sem auditoria. A correção é inativar o motivo e criar outro.
- A verificação de uso consulta **as duas tabelas**: um motivo pode permanecer apenas no histórico (ex.: agendamento posteriormente alterado).
- `PUT` sobre motivo **sem** referência é permitido, inclusive se inativo, e não altera a situação.
- A comparação de no-op **precede** a verificação de uso: `PUT` idêntico ao vigente sobre motivo em uso → `200` sem mutação e sem auditoria.
- A verificação ocorre **sob o lock** de `D-CFG-53`, na mesma transação da mutação.
- Fundamento: `historico_agendamento` é a reconstrução append-only das mudanças de agenda (AGD-009) e referencia o motivo sem copiar sua descrição; renomear motivo usado reescreveria retroativamente a causa de cancelamentos passados. Mesmo racional de `D-CFG-40`.

#### 3.13.6 `D-CFG-51` — Obrigatoriedade do motivo no cancelamento

- **Não decidida nesta frente.** Se todo cancelamento de agendamento exige motivo (AGD-003) ou apenas o "cancelamento que exige motivo" (CFG-005), e a eventual `CHECK` de coerência entre `agendamento.estado` e `motivo_cancelamento_id`, pertencem à **fatia de agenda**.
- CFG-005 apenas mantém o catálogo e **não** cria restrição em `agendamento` ou `historico_agendamento`.

#### 3.13.7 `D-CFG-52` — Sem motivos pré-cadastrados

- Nenhum motivo é criado por provisionamento, seed ou migration; o Administrador os cadastra pela API.
- `bootstrap-clinica` (`D-CFG-10`..`D-CFG-12`) permanece inalterado.
- **Consequência registrada para a agenda:** a fatia de agenda deve definir o comportamento do cancelamento quando **não houver motivo ativo** cadastrado, coerente com o que decidir em `D-CFG-51`.

#### 3.13.8 `D-CFG-53` — Concorrência

- `PUT` e `PATCH` serializam por `SELECT ... FOR UPDATE` na linha de `motivo_cancelamento`; comparação de no-op e verificação de uso ocorrem **sob o lock**; a **última escrita válida prevalece**.
- **Sem** coluna de versão, `If-Match` ou controle otimista; `409` existe **somente** por `D-CFG-46` e `D-CFG-50`.
- Limitação aceita: atualização perdida entre administradores concorrentes não é detectada.

#### 3.13.9 `D-CFG-54` — Preservação histórica e listagem

- Motivo inativo **permanece referenciável** em `agendamento` e `historico_agendamento` e nunca é apagado. Fundamento: invariante de CFG-005 ("motivo desativado não deve desaparecer do histórico") e `docs/07` §23. **RN-007 não é citada como fonte direta**, pois não lista motivos; `docs/03` não é alterado.
- Listagem **sem paginação** e sem busca textual; retorna ativos e inativos; filtro opcional `?ativo=true|false` (qualquer outro valor → `400`); ordem canônica `ativo DESC`, `lower(descricao)`, `id`; `GET` com `Cache-Control: no-store`.

#### 3.13.10 `D-CFG-55` — Autorização

- Todas as rotas exigem **`clinica.configurar`**; `ProtecaoCsrfGuard` **somente** em `POST`, `PUT` e `PATCH`.
- Leitura por outros papéis (ex.: seleção de motivo ativo pela Recepção ao cancelar agendamento com `agenda.gerenciar`) **não** é concedida agora; será decidida na fatia de agenda. **Nenhuma permissão nova.**
- `403` por falta de permissão **não** gera evento (lista fechada de `L-07`).

#### 3.13.11 `D-CFG-56` — Auditoria

- Criação, edição efetiva, inativação e reativação emitem, cada uma, **um** `configuracao.alterada` com `alvo_tipo = "motivo_cancelamento"`, `alvo_id = motivo_cancelamento.id`, ator da sessão, `resultado = SUCESSO`, `justificativa = null`, `contexto` **vazio**, na **mesma transação** da mutação (falha → rollback conjunto).
- No-op, consulta, validação rejeitada, `409` e negação de autorização **não** emitem evento.
- A descrição **nunca** é registrada. Aplicação direta de `docs/09` §13.6; nenhuma ação, chave de `contexto` ou `alvo_tipo` novo. Permanece a limitação declarada de §13.6 (estado anterior não preservado).

#### 3.13.12 `D-CFG-57` — Contrato oferecido à agenda

Registro de fronteira; a agenda **não** é implementada nem decidida aqui.

- **Identidade:** `motivo_cancelamento.id` é o identificador estável referenciado por `agendamento` e `historico_agendamento`.
- **Elegibilidade:** `ativo = true` é o predicado para **novo** cancelamento que informe motivo; referências existentes permanecem íntegras após inativação (`D-CFG-54`).
- **Serialização com `D-CFG-50`:** o cancelamento de agendamento deve bloquear a linha do motivo (`SELECT ... FOR SHARE` ou mais forte) ao verificar sua situação, para não correr com edição ou inativação concorrente.
- **Pendências de fronteira:** obrigatoriedade do motivo e CHECK de coerência (`D-CFG-51`); cancelamento sem motivos ativos (`D-CFG-52`); leitura pela Recepção (`D-CFG-55`). Os motivos de cancelamento de pacote e de cobrança permanecem texto livre, **fora** de CFG-005.

### 3.14 Fechamento da Configuração Horária (`CFG-002` × agenda × `CFG-006`) — `D-CFG-58`..`D-CFG-66` *(decididas em 17/09/2026; frente `CFG-HOR`; **homologadas** por Bruno Menezes Noronha em 17/09/2026 — REV. 26)*

**Natureza e autoridade.** Frente de **fechamento de contrato**, conduzida por solicitação de Bruno Menezes Noronha em 17/09/2026 para eliminar as ambiguidades restantes da configuração horária, decidindo autonomamente o que é **determinável pelas fontes vigentes** (TLF-BASE-V1 §5.2, §5.5, §9, §13; `docs/02` CFG-002, CFG-006, PRO-003, AGD-001..005; `docs/03` RN-014..RN-016, RN-060; `docs/07` §17.2, §17.4, §24.1; `D-CFG-08`, `D-CFG-13`..`D-CFG-21`, `D-CFG-33`) e escolhendo, entre alternativas, a mais simples compatível com essas fontes. Estas decisões **não** alteram `D-CFG-13`..`D-CFG-21` nem o runtime integrado pela PR #76; `D-CFG-64` **refina** a classificação de `D-CFG-19` e `D-CFG-63` **conclui** a reavaliação prevista em `D-CFG-08`/`D-CFG-20`, ambas de forma explícita. **Registro normativo; nenhum código, schema, migration ou teste alterado.** Nenhuma implementação de agenda é autorizada por este registro.

**Fatos de partida (medidos no workspace sobre `bd772a3`).**

| # | Fato | Evidência |
| --- | --- | --- |
| FH-01 | `GET`/`PUT /horario-funcionamento` integrados: grade `{ janelas: [{ diaSemana, horaInicio, horaFim }] }`, `HH:MM` 00:00..23:59, `horaFim > horaInicio`, ≤ 4 janelas/dia, sem sobreposição nem adjacência, substituição integral sob `FOR UPDATE` em `clinica`, no-op sem auditoria, `400 REQUISICAO_INVALIDA` sem detalhamento do campo | `apps/api/src/clinica/horario-funcionamento.{dto,service,controller}.ts`; `docs/10` §6-Y |
| FH-02 | `horario_funcionamento` sem vigência, sem unicidade e sem tabela de exceções; CHECKs `ck_horario_funcionamento_dia_semana` e `ck_horario_funcionamento_intervalo` | `packages/database/prisma/schema.prisma`; `docs/08` §8 |
| FH-03 | `disponibilidade_profissional` é camada **separada** (`dia_semana`, `hora_inicio`/`hora_fim`, vigência `date`), de PRO-003 | `schema.prisma`; `docs/07` §7.3 |
| FH-04 | `agendamento.inicio/fim` e `bloqueio_agenda.inicio/fim` são `timestamptz`; conflito temporal é semiaberto (exclusion constraint); bloqueio é **por profissional** | `schema.prisma`; `docs/07` §17.2, §24.1 |
| FH-05 | `docs/07` §17.2 atribui horário de funcionamento e disponibilidade ao **backend**; §17.4 põe RN-014 no passo 3 de T-01 | `docs/07` |
| FH-06 | Não há módulo de agenda nem de disponibilidade em `apps/api`; não há tela de configuração em `apps/web` | `apps/api/src`, `apps/web/app` |
| FH-07 | O projeto usa `422` para regra de negócio violada (`AUTO_INATIVACAO_PROIBIDA`, `ALVO_NAO_ELEGIVEL`) | `apps/api/src/auth/usuarios.controller.ts`; `recuperacao-senha.controller.ts` |

#### 3.14.1 Mapa do estado (antes desta frente)

| Tema | Estado anterior | Fonte | Resolução |
| --- | --- | --- | --- |
| Unidade da configuração | DECIDIDO | TLF-BASE §5.2; `D-CFG-02`, `D-CFG-17` | confirmada em `D-CFG-58` |
| Dias da semana | DECIDIDO | `D-CFG-18` (0 = domingo) | — |
| Múltiplos intervalos por dia | DECIDIDO | `D-CFG-13`, `D-CFG-18` | — |
| Dia fechado | DECIDIDO | `D-CFG-13` (ausência de janela) | explicitada a grade vazia em `D-CFG-58` |
| Intervalo de almoço | DECIDIDO (implícito) | `D-CFG-13` | explicitado em `D-CFG-58` |
| Sobreposição / adjacência | DECIDIDO | `D-CFG-13`, `D-CFG-16` | — |
| Limites e precisão | PARCIAL (23:59 e 00:00 não explicitados) | `D-CFG-18` | `D-CFG-59` |
| Meia-noite | DECIDIDO (grade) / A DECIDIR (agendamento) | `D-CFG-14` | `D-CFG-61` |
| Exceção por data / feriados | FUTURO sem contrato | `D-CFG-19` | `D-CFG-64` |
| Profissional × clínica | PARCIAL | CFG-002, RN-014, `D-CFG-20` | `D-CFG-62` |
| Duração do atendimento | PARCIAL | `D-CFG-07`, `D-CFG-33` | `D-CFG-62` |
| Timezone na avaliação | PARCIAL | TLF-BASE §9; CFG-006; `docs/07` §24.1 | `D-CFG-60` |
| Regra da agenda (contenção, bordas) | A DECIDIR | RN-014 | `D-CFG-61` |
| Edição futura / impacto em agendamentos / retroatividade | A DECIDIR | PRO-003 (análogo); AGD-004; `D-CFG-08` | `D-CFG-63` |
| Auditoria | DECIDIDO | `D-CFG-17` | fronteira em `D-CFG-65` |
| Permissões | DECIDIDO (gestão) / PARCIAL (uso pela agenda) | `D-CFG-21` | `D-CFG-65` |
| Concorrência | DECIDIDO (grade) / A DECIDIR (grade × agendamento) | `D-CFG-15` | `D-CFG-61` |
| Persistência | DECIDIDO | FH-02; `D-CFG-15`, `D-CFG-16` | `D-CFG-58` (sem mudança de schema) |
| Frontend | A DECIDIR (comportamento) | TLF-BASE §4.9, §11 | `D-CFG-66` |

#### 3.14.2 `D-CFG-58` — Unidade, grade inicial e forma consolidada

- **Contexto.** O prompt de fechamento exige confirmar a entidade dona e a semântica de dia fechado e de almoço.
- **Decisão.**
  - A grade semanal pertence à **clínica única** (`horario_funcionamento.clinica_id`); **não** existe unidade, filial, sala ou tenant (TLF-BASE §5.2, §13).
  - **Não há grade pré-cadastrada**: provisionamento, seed e migration não criam janelas; `bootstrap-clinica` permanece inalterado (mesmo racional de `D-CFG-39`/`D-CFG-52`).
  - **Grade vazia** = clínica fechada em todos os dias; a agenda rejeita todo agendamento novo (`D-CFG-61`). Não existe "sem configuração = aberto 24h".
  - Dia **fechado** = dia sem janela. **Não** há estado persistido `ABERTO`/`FECHADO` — um único predicado elimina a contradição "aberto sem janela" / "fechado com janela".
  - **Almoço** e outros fechamentos intermediários são expressos por **duas ou mais janelas** (ex.: `08:00–12:00` + `14:00–18:00`); não existe campo `intervalo_almoco`.
  - **Adjacência** (`08:00–12:00` + `12:00–18:00`) é **rejeitada** (`D-CFG-13`), nunca normalizada: o Administrador informa `08:00–18:00`. Sobreposição é rejeitada; não há fusão silenciosa.
- **Motivação.** Coerência com as decisões integradas e com a clínica única; fail-closed sem configuração.
- **Impactos.** Nenhuma mudança de schema, migration ou API. A agenda depende da grade estar cadastrada para aceitar agendamentos.
- **Alternativas.** Grade padrão (ex.: seg–sex 08–18) no provisionamento — rejeitada: inventaria horário que a clínica não declarou. Estado explícito por dia — rejeitado: cria estados contraditórios.
- **Aceite / testes.** Já provados pela PR #76 (`docs/10` §6-Y.2); o comportamento com grade vazia na agenda é provado pela fatia de agenda (`CH-AG-07`).

#### 3.14.3 `D-CFG-59` — Limites do dia e precisão

- **Decisão.**
  - Formato `HH:MM` 24h, minutos `00`–`59`, **sem segundos** e **sem arredondamento** (`D-CFG-18`); qualquer outra forma → `400 REQUISICAO_INVALIDA`.
  - `00:00` é aceito como **início**; o **maior fim representável é `23:59`**. `24:00` não é aceito. Consequência aceita: o minuto `23:59–24:00` nunca é horário de funcionamento; não há janela "dia inteiro" exata.
  - `horaInicio = horaFim` (ex.: `08:00–08:00`) e `horaInicio > horaFim` (ex.: `18:00–08:00`) → `400`; não há interpretação como "atravessa a meia-noite" (`D-CFG-14`).
  - A janela é o intervalo **semiaberto** `[horaInicio, horaFim)` para fins de agenda (`D-CFG-61`); a borda final é alcançável pelo **fim** de um agendamento.
- **Motivação.** Registra o comportamento integrado (`FORMA_HORA` e CHECK físico) e remove a dúvida sobre 24:00, sem alterar o CHECK protegido.
- **Alternativas.** Aceitar `24:00` — rejeitada: exige mudança no CHECK/tipo `time` e na validação integrada sem requisito demonstrado para clínica de fisioterapia.
- **Testes.** Já cobertos por `apps/api/test/horario-funcionamento-dto.spec.ts` (`00:00–23:59` aceito; `24:00`, segundos, `8:00` e `22:00–02:00` rejeitados).

#### 3.14.4 `D-CFG-60` — Interpretação temporal e fuso

- **Decisão.**
  - A grade é **horário local de parede** no fuso IANA de `clinica.fuso_horario` (CFG-006). Não existe fuso por janela, por profissional ou por usuário.
  - Instantes (`agendamento.inicio/fim`, `bloqueio_agenda`) permanecem `timestamptz` em UTC (TLF-BASE §9). Nenhuma coluna da grade guarda UTC.
  - Para avaliar um agendamento, o backend converte `inicio` e `fim` para data civil e hora local usando o **fuso vigente no momento da validação**, com as regras IANA (inclusive eventual horário de verão). O **dia da semana** considerado é o da **data civil local do início**.
  - A conversão para RN-014 é feita **na aplicação** (API `Intl` do runtime — a mesma base que valida `fusoHorario` em `D-CFG-04`), por **função pura** testável; a grade é lida em `HH:MM` como hoje. Esta decisão resolve, **somente para RN-014**, o item "local da conversão UTC ↔ local" de §5; indicadores (RN-060) seguem pendentes da sua fatia.
- **Motivação.** Evita a divergência entre bases de fusos da aplicação e do PostgreSQL no ponto em que o fuso já foi validado; mantém a regra unitariamente testável.
- **Alternativas.** Converter no SQL (`AT TIME ZONE`) — rejeitada para RN-014: exige verificar compatibilidade de `pg_timezone_names` com a base do runtime. Persistir a grade em UTC — rejeitada por `docs/07` §24.1 (quebra com horário de verão).
- **Testes futuros.** `America/Sao_Paulo`: agendamento `11:00Z–12:00Z` = `08:00–09:00` local de segunda aceito em `08:00–12:00`; instante UTC do dia seguinte que ainda é o dia anterior local avaliado pelo dia local; fuso com horário de verão (ex.: `America/New_York`) em data de transição avaliado pela hora de parede.

#### 3.14.5 `D-CFG-61` — Regra da agenda (RN-014, parcela da clínica)

- **Decisão (predicado normativo).** Um agendamento `[inicio, fim)` satisfaz o horário de funcionamento **se e somente se**, após a conversão de `D-CFG-60`:
  1. a data civil local de `inicio` é **igual** à de `fim` (agendamento que atravessa a meia-noite local é rejeitado); e
  2. existe **uma única janela** `J` do dia da semana dessa data com `J.horaInicio ≤ hora_local(inicio)` **e** `hora_local(fim) ≤ J.horaFim`, comparando com a precisão integral do instante.
- **Consequências normativas.**
  - Início **exatamente** na abertura: aceito. Fim **exatamente** no fechamento: aceito.
  - Início antes da abertura ou fim depois do fechamento: rejeitado.
  - Agendamento que **atravessa** fechamento intermediário (ex.: `11:30–12:30` com `08:00–12:00` + `14:00–18:00`): rejeitado — nunca se somam janelas (adjacência é proibida, logo não há janelas contíguas a unir).
  - Dia sem janela (inclusive grade vazia): rejeitado.
- **Onde se aplica.** Na **criação** (AGD-001) e em **toda remarcação** (AGD-002, RN-016), no passo 3 de T-01 (`docs/07` §17.4), antes da disponibilidade do profissional. **Não** se aplica a confirmação, check-in, início, conclusão, falta ou cancelamento.
- **Erro.** `422 FORA_DO_HORARIO_FUNCIONAMENTO`, no envelope `{ erro: <código> }`, sem expor a grade nem valores. Validação estrutural do corpo continua `400`.
- **Concorrência grade × agendamento.** A validação lê a grade **dentro** da transação de T-01, **sem** lock em `clinica`. Um agendamento validado contra a grade anterior a um `PUT` concorrente equivale a um agendamento criado imediatamente antes da alteração e é tolerado por `D-CFG-63`. Não se introduz `FOR SHARE`, versão ou `SERIALIZABLE`.
- **Motivação.** RN-014 exige "janela permitida"; o intervalo semiaberto é o mesmo da exclusion constraint (`docs/07` §17.2); o `422` segue o padrão do projeto para regra de negócio (FH-07).
- **Alternativas.** Aceitar agendamento que cruze fechamento intermediário se a soma cobrir — rejeitada (contradiz o fechamento declarado). Lock compartilhado em `clinica` em T-01 — rejeitado: serializaria toda a agenda com a configuração sem risco que o justifique.
- **Critérios de aceite / testes futuros.** `CH-AG-01`..`CH-AG-09` (§3.14.11).

#### 3.14.6 `D-CFG-62` — Camadas: clínica × disponibilidade × bloqueio × serviço

- **Decisão.**
  - **Configuração horária** = quando **a clínica** funciona. **Disponibilidade** (PRO-003) = quando **o profissional** atende. **Bloqueio** (AGD-004) = indisponibilidade pontual do profissional. **Serviço** (CFG-003) = duração padrão do atendimento.
  - Um agendamento novo é válido quando está contido numa janela da clínica (`D-CFG-61`) **e** numa disponibilidade vigente do profissional (PRO-003) **e** não sobrepõe bloqueio (RN-015.2) — equivale à **interseção** das camadas, avaliada **somente na agenda**.
  - **Sem validação cruzada na escrita:** cadastrar disponibilidade fora do horário da clínica **não** é rejeitado pela configuração, e alterar a grade **não** altera nem invalida disponibilidades; a parte fora da grade é simplesmente ineficaz para novos agendamentos.
  - A configuração horária **não** contém duração, granularidade de slot ou múltiplos obrigatórios. O `fim` avaliado é o `fim` do agendamento (proposto a partir de `servico.duracao_min`, `D-CFG-33`); se a duração é sobrescrevível permanece decisão da agenda.
  - Regras próprias de disponibilidade (vigência, sobreposição, erro) pertencem à fatia de PRO-003 e **não** são decididas aqui.
- **Motivação.** CFG-002 ("não substitui disponibilidade específica"), TLF-BASE §5.3 e §8 (disponibilidade é entidade do profissional).
- **Alternativas.** Exigir disponibilidade contida na grade da clínica — rejeitada: acopla cadastros e tornaria uma redução da grade uma cascata de invalidações.

#### 3.14.7 `D-CFG-63` — Alteração da grade ou do fuso com agendamentos existentes; retroatividade

- **Estratégia conservadora (avaliada).** Rejeitar o `PUT` (`409`) enquanto houver agendamento futuro ativo fora da nova grade. *Custo/risco:* altera o contrato integrado de `D-CFG-15`, acopla CFG a AGD, exige varrer e travar a agenda futura, impede fechar a clínica (ex.: reforma) sem antes remarcar tudo, e não tem apoio em fonte.
- **Estratégia flexível (adotada).**
  - O `PUT /horario-funcionamento` **não consulta** agendamentos e **nunca** cancela, remarca, altera estado ou reclassifica agendamento, bloqueio ou disponibilidade.
  - A nova grade vale **somente para validações posteriores** (criação e remarcação). Agendamentos já existentes fora dela **permanecem válidos** e seguem normalmente confirmação, check-in, atendimento, conclusão, falta e cancelamento, sem revalidação de horário.
  - **Remarcação** de qualquer agendamento é validada contra a grade **vigente** (RN-016), inclusive a de um agendamento criado sob grade anterior.
  - **Sem retroatividade:** nada do passado é reavaliado; histórico, indicadores e auditoria não são reescritos. Não há vigência na grade (`D-CFG-20`); a grade anterior não é preservada (limitação já aceita em `docs/10` §6-Y.5).
  - **Troca de fuso** (reavaliação de `D-CFG-08` concluída): continua **permitida**, sem regra de transição; os instantes UTC dos agendamentos são preservados e passam a ser **exibidos** no novo fuso (TLF-BASE §9); validações posteriores usam o novo fuso.
  - **Sem** aviso ou listagem de agendamentos afetados no MVP (melhoria futura possível, não autorizada).
- **Motivação.** Precedentes de não apagamento silencioso (AGD-004) e de não reescrita (PRO-003); contrato integrado (`D-CFG-15`, `D-CFG-20`); simplicidade do MVP (TLF-BASE §4.5).
- **Risco aceito.** A agenda pode conter agendamentos fora da grade vigente após redução; é estado **tolerado**, análogo ao bloqueio criado sobre agendamento existente (`docs/07` §17.2).
- **Testes futuros.** `CH-ALT-01`..`CH-ALT-04` (§3.14.11).

#### 3.14.8 `D-CFG-64` — Exceções por data e feriados (**Opção A**; refina `D-CFG-19`)

- **Decisão.**
  - O MVP opera **somente a grade semanal recorrente**. **Não** há entidade, tabela, rota ou regra de exceção por data nesta frente nem como pré-requisito da agenda.
  - **Fechamento pontual** (feriado, manutenção, evento interno) é operado por **bloqueio de agenda** por profissional (AGD-004, `agenda.bloqueio`), que já rejeita novos agendamentos e não apaga os existentes.
  - **Abertura extraordinária** fora da grade **não é suportada** por exceção; exige alteração da grade, com os efeitos de `D-CFG-63`.
  - **Feriados** não são tratados automaticamente: sem calendário embutido e **sem API externa**.
  - Refinamento de `D-CFG-19`: exceções por data deixam de ser pendência bloqueante e passam a **melhoria futura** condicionada (CFG-002 "quando modeladas"). Sua modelagem exigirá pacote de decisão próprio (entidade, precedência sobre a grade, fechamento total × horário especial, auditoria, efeito sobre agendamentos existentes).
- **Motivação.** TLF-BASE §5.2 exige "horário de funcionamento", sem exceções; §5.5 já prevê bloqueio; menor superfície para o MVP.
- **Custo aceito.** Fechar a clínica inteira numa data exige um bloqueio por profissional.
- **Alternativa (Opção B).** Grade + exceção por data — rejeitada **para o MVP** por ausência de requisito e custo de modelo, API, UI e testes; permanece como evolução.

#### 3.14.9 `D-CFG-65` — Permissões e auditoria na fronteira

- **Decisão.**
  - **Gestão** (`GET`/`PUT /horario-funcionamento`): exclusivamente `clinica.configurar` (somente Administrador); sem sessão → `401`; sem permissão → `403` **sem** evento (`L-07`); CSRF só no `PUT` (`D-CFG-21`). Nenhuma permissão nova.
  - **Aplicação de RN-014** pela agenda é leitura **interna** do backend: o ator do agendamento (ex.: Recepcionista com `agenda.gerenciar`) **não** precisa de `clinica.configurar`.
  - **Leitura da grade via HTTP por outros perfis** (ex.: sombrear horários fechados na tela da agenda) **não** é concedida agora; a fatia de agenda decide se expõe e sob qual permissão existente. Não bloqueia implementação: o backend rejeita de qualquer forma.
  - **Auditoria:** confirma `D-CFG-17` (um `configuracao.alterada`, alvo `clinica`, `contexto` vazio, na mesma transação). Rejeição de agendamento por `FORA_DO_HORARIO_FUNCIONAMENTO` **não** emite `configuracao.alterada`; se emite evento de agenda é decisão da fatia de agenda. Nenhum dado clínico é registrado.

#### 3.14.10 `D-CFG-66` — Comportamento esperado do frontend (sem layout)

- Tela acessível somente a usuário com `clinica.configurar`; a ocultação na UI **não** substitui o `403` do backend.
- Web responsiva, mobile first, acessível (rótulos por dia e por janela; erros anunciados; operável por teclado).
- Para cada um dos 7 dias: estado **aberto/fechado derivado** (fechado = sem janela); adicionar janela (até 4); remover janela; horas em `HH:MM` 24h sem segundos. Ordem de exibição dos dias é escolha de UI, mapeada para `diaSemana` 0 = domingo.
- Marcar um dia como fechado remove suas janelas no rascunho; um dia "aberto" sem janela é salvo como fechado.
- Validação no cliente espelha `D-CFG-13`/`D-CFG-18`/`D-CFG-59` (fim > início, sem sobreposição **nem adjacência**, ≤ 4/dia) apenas para ajuda; como o servidor responde `400 REQUISICAO_INVALIDA` sem detalhar o campo, a UI apresenta mensagem genérica quando o servidor rejeitar.
- **Salvar envia a grade inteira** num único `PUT` e renderiza a resposta como estado vigente; sem salvamento por dia ou por janela.
- Não criar componente visual proprietário nem copiar a referência funcional (TLF-BASE §2).

#### 3.14.11 Matriz de cenários e critérios de aceite

| ID | Cenário | Esperado | Decisão | Prova |
| --- | --- | --- | --- | --- |
| CH-G-01 | Segunda `08:00–18:00` | aceito | `D-CFG-13` | existente (PR #76) |
| CH-G-02 | Sábado reduzido `08:00–12:00` | aceito | `D-CFG-13` | existente |
| CH-G-03 | Domingo sem janela | aceito; domingo fechado | `D-CFG-58` | existente |
| CH-G-04 | `08:00–12:00` + `14:00–18:00` no mesmo dia | aceito | `D-CFG-58` | existente |
| CH-G-05 | `08:00–12:00` + `11:00–14:00` | `400`, sem mutação | `D-CFG-13` | existente |
| CH-G-06 | `08:00–12:00` + `12:00–18:00` | `400`, sem normalização | `D-CFG-58` | existente |
| CH-G-07 | `08:00–08:00` | `400` | `D-CFG-59` | existente |
| CH-G-08 | `18:00–08:00` / `22:00–02:00` | `400` | `D-CFG-14`, `D-CFG-59` | existente |
| CH-G-09 | `08:00:00`, `8:00`, `24:00`, número em vez de string | `400` | `D-CFG-59` | existente |
| CH-G-10 | 5 janelas no mesmo dia | `400` | `D-CFG-18` | existente |
| CH-G-11 | Grade vazia `{ janelas: [] }` | `200`; todos os dias fechados | `D-CFG-58` | existente |
| CH-AG-01 | Agendamento `09:00–10:00` com `08:00–18:00` | aceito | `D-CFG-61` | fatia de agenda |
| CH-AG-02 | `07:30–08:30` | `422 FORA_DO_HORARIO_FUNCIONAMENTO` | `D-CFG-61` | fatia de agenda |
| CH-AG-03 | `17:30–18:30` | `422` | `D-CFG-61` | fatia de agenda |
| CH-AG-04 | `11:30–12:30` com `08:00–12:00` + `14:00–18:00` | `422` | `D-CFG-61` | fatia de agenda |
| CH-AG-05 | `08:00–09:00` (início na abertura) | aceito | `D-CFG-61` | fatia de agenda |
| CH-AG-06 | `17:00–18:00` (fim no fechamento) | aceito | `D-CFG-61` | fatia de agenda |
| CH-AG-07 | Qualquer agendamento em dia sem janela ou com grade vazia | `422` | `D-CFG-58`, `D-CFG-61` | fatia de agenda |
| CH-AG-08 | Agendamento que cruza a meia-noite local | `422` | `D-CFG-61` | fatia de agenda |
| CH-AG-09 | Instante UTC cujo dia local difere do dia UTC | avaliado pelo dia/hora local do fuso da clínica | `D-CFG-60` | fatia de agenda (unitário) |
| CH-AG-10 | Dentro da grade, fora da disponibilidade do profissional | rejeitado pela regra de PRO-003 | `D-CFG-62` | fatias PRO-003/agenda |
| CH-ALT-01 | Ampliar `08:00–16:00` → `08:00–18:00` | `200`; novo agendamento `17:00` passa a ser aceito | `D-CFG-63` | integração CFG + agenda |
| CH-ALT-02 | Reduzir `08:00–18:00` → `08:00–16:00` sem agendamentos afetados | `200`; um evento de auditoria | `D-CFG-63` | existente (grade) + agenda |
| CH-ALT-03 | Reduzir para `08:00–16:00` com agendamento futuro às `17:00` | `200`; agendamento **intacto** e com transições normais; novo às `17:00` → `422`; remarcá-lo para `17:30` → `422` | `D-CFG-63` | fatia de agenda |
| CH-ALT-04 | Trocar fuso com agendamentos existentes | `200`; instantes UTC inalterados; novas validações no novo fuso | `D-CFG-63` | fatia de agenda |
| CH-P-01 | Administrador autenticado com `clinica.configurar` | `GET`/`PUT` permitidos | `D-CFG-65` | existente |
| CH-P-02 | Autenticado sem `clinica.configurar` (ex.: Recepcionista) | `403`, sem evento | `D-CFG-65` | existente |
| CH-P-03 | Não autenticado | `401` | `D-CFG-65` | existente |
| CH-P-04 | Recepcionista com `agenda.gerenciar` cria agendamento | RN-014 aplicada sem exigir `clinica.configurar` | `D-CFG-65` | fatia de agenda |

#### 3.14.12 Impactos futuros (nenhum implementado por este registro)

- **Banco:** nenhuma migration exigida para a grade (FH-02 satisfaz `D-CFG-58`..`D-CFG-65`); a não sobreposição segue no backend (`D-CFG-16`). Exceção por data, se decidida no futuro, exigirá tabela e decisões próprias.
- **Backend:** função pura de contenção (`D-CFG-60`, `D-CFG-61`) consumida pelo serviço de agenda no passo 3 de T-01, em criação e remarcação; leitura da grade na transação; código `FORA_DO_HORARIO_FUNCIONAMENTO` (`422`) no OpenAPI da agenda; nenhuma alteração em `/horario-funcionamento`.
- **Frontend:** tela de grade conforme `D-CFG-66`, consumindo o contrato integrado.
- **Agenda:** aplicar `D-CFG-61`..`D-CFG-63`; decidir exposição da grade a outros perfis e evento de auditoria de rejeição (`D-CFG-65`); implementar PRO-003 como camada própria (`D-CFG-62`).

#### 3.14.13 Classificação de escopo

| Tema | Classificação |
| --- | --- |
| Grade semanal, múltiplas janelas, dia fechado, limites (`D-CFG-58`, `D-CFG-59`) | requisito do MVP — **integrado** |
| Fuso na avaliação e contenção RN-014 (`D-CFG-60`, `D-CFG-61`) | requisito do MVP — decisão técnica para a fatia de agenda |
| Camadas clínica × profissional × serviço (`D-CFG-62`) | requisito do MVP — fronteira |
| Estratégia flexível e troca de fuso (`D-CFG-63`) | decisão técnica; **risco aceito** (agendamentos fora da grade vigente) |
| Aviso de agendamentos afetados por alteração da grade | melhoria futura |
| Exceções por data, horário especial, abertura extraordinária (`D-CFG-64`) | melhoria futura |
| Feriados automáticos, API externa de feriados | fora de escopo |
| Fechamento pontual via bloqueio por profissional | requisito do MVP (AGD-004) — custo operacional aceito |
| Atualização perdida entre administradores; grade anterior não preservada | dívida técnica aceita (`D-CFG-05`, `docs/10` §6-Y.5) |
| Tela de configuração horária (`D-CFG-66`) | requisito do MVP — não implementado |
| Agenda inteligente, otimização, escala complexa, múltiplos fusos, ponto/jornada, Google Calendar | fora de escopo |

## 4. Consequências normativas já definidas (sem ampliação)

- **Auditoria** (`docs/09` §13.6): mutação efetiva de `clinica` (`CFG-001`, `CFG-006`) emite `configuracao.alterada` com ator da sessão, `alvo_tipo = "clinica"`, `alvo_id = clinica.id`, `resultado = SUCESSO`, `justificativa = null`, `contexto` vazio, na **mesma transação** da mutação; falha da auditoria implica rollback conjunto. Nenhum valor de campo é registrado. *Alcance por frente:* `CFG-002` usa o mesmo alvo `clinica` por leitura homologada (`D-CFG-17`); `CFG-003` usa `alvo_tipo = "servico"` e `alvo_id = servico.id` (`D-CFG-32`); `CFG-004` usa `alvo_tipo = "forma_pagamento"` e `alvo_id = forma_pagamento.id` (`D-CFG-44`); `CFG-005` usa `alvo_tipo = "motivo_cancelamento"` e `alvo_id = motivo_cancelamento.id` (`D-CFG-56`). Em todas, `contexto` vazio e nenhum valor de campo registrado.
- **Autorização** (`D-2.3D-09`): sem sessão → `401`; sem permissão → `403`; CSRF obrigatório somente na rota mutante.
- **Não ampliação:** nenhuma permissão, ação de auditoria, chave de `contexto` ou dependência nova decorre deste registro.

## 5. Pendências abertas

| Item | Estado |
| --- | --- |
| `P-CFG-01` — implementação da fatia `CFG-001A` (migration de linha única, GET/PUT `/clinica`, testes) | **INTEGRADA NA `main`** — PR [#65](https://github.com/BrunoMNoronha/techlab-fisio/pull/65), commit de integração `6ee19f27afc5d7c55667ef910536baa924ecc990` (`docs/10` §6-W, §6-X.5) |
| `P-CFG-02` — provisionamento da linha de `clinica` (`CFG-001B`; `D-CFG-01`, `D-CFG-09`..`D-CFG-12`) | **INTEGRADO NA `main`** — PR [#69](https://github.com/BrunoMNoronha/techlab-fisio/pull/69), merge commit `02cc93d5770003775d3417b1d2ee08a874675d30` (`docs/10` §6-X, §6-X.5) |
| Logotipo e duração padrão (`D-CFG-07`) | **FUTURO DO MVP** — não implementados |
| `P-CFG-03` — implementação de `CFG-002` (`D-CFG-13`..`D-CFG-21`) | **INTEGRADA NA `main`** — PR [#76](https://github.com/BrunoMNoronha/techlab-fisio/pull/76), merge commit `ad2bcf8041635f469db6c799e7405f455d836d30` (`docs/10` §6-Y, §6-Y.6) |
| Exceções e feriados do horário de funcionamento (`D-CFG-19`) | **MELHORIA FUTURA** — refinado por `D-CFG-64` (Opção A): MVP só com grade semanal; fechamento pontual por bloqueio de agenda (AGD-004); feriados sem automação nem API externa |
| Aplicação de RN-014 e reavaliação da troca de fuso (`D-CFG-20`, `D-CFG-08`) | **CONTRATO DECIDIDO** (`D-CFG-60`..`D-CFG-63`: predicado de contenção, `422 FORA_DO_HORARIO_FUNCIONAMENTO`, estratégia flexível, troca de fuso permitida sem transição). **COMPONENTE IMPLEMENTADO (17/09/2026) — INTEGRADO NA BRANCH LOCAL `integration/local-fase4`, NÃO PUBLICADO NA `main`**: regra pura `apps/api/src/agenda/horario-funcionamento.regra.ts` e `VerificadorHorarioFuncionamento` (`verificador-horario-funcionamento.ts`), que lê fuso e grade na transação recebida, sem lock, e lança `ErroForaDoHorarioFuncionamento` (código `FORA_DO_HORARIO_FUNCIONAMENTO`, status `422` reservado) ou `CLINICA_NAO_CONFIGURADA`; provas: `test/agenda-horario-funcionamento.regra.spec.ts` (16, CH-AG-01..09, horário de verão, precisão de milissegundos) e `test/integration/agenda-horario-funcionamento.integration.spec.ts` (7, PostgreSQL real: grade gravada por CFG-002, fuso lido do banco, grade nova só para validações posteriores, ausência de escrita/auditoria e de bloqueio sob `FOR UPDATE` concorrente); mutações locais `FOR SHARE`, borda `<=`→`<` e remoção da checagem de meia-noite detectadas. **NÃO CONECTADO A NENHUMA OPERAÇÃO:** a fatia de agenda (rotas, T-01 de criação/remarcação, mapeamento HTTP do `422`, PRO-003) não existe e depende de decisões próprias; o verificador não está registrado em módulo do `AppModule` |
| Exposição da grade a outros perfis na agenda; evento de auditoria da rejeição por horário (`D-CFG-65`) | **DECIDIDO EM `docs/15`** — grade exposta em `GET /agenda/opcoes` sob `agenda.gerenciar` (`D-AGD-13`); rejeição por horário sem evento (`D-AGD-10`); implementação não autorizada |
| Tela de configuração horária (`D-CFG-66`) | **IMPLEMENTADA (17/09/2026) — INTEGRADA NA BRANCH LOCAL `integration/local-fase4`, NÃO PUBLICADA NA `main`**: `apps/web/app/configuracoes/horario-funcionamento/`, `apps/web/lib/grade-funcionamento.ts`; provas locais `verify-grade-funcionamento.mjs` (21/21), `e2e/horario-funcionamento.spec.ts` (7/7, API simulada) e Cenário 8 de `apps/web/scripts/verify-web-api-e2e.mjs` e Cenário 9 (Chromium real + NestJS + PostgreSQL 18 descartável; execução completa 50/50 em 17/09/2026), incluindo `403` sem `clinica.configurar` com Recepcionista real, sem mutação nem auditoria |
| `P-CFG-04` — implementação de `CFG-003` (`D-CFG-22`..`D-CFG-33`: migration de unicidade e CHECKs de `servico`, rotas `/servicos`, testes) | **INTEGRADA NA `main`** — PR [#80](https://github.com/BrunoMNoronha/techlab-fisio/pull/80), merge commit `fd3c205f420b9cb201dad46fe946b3df7354b9ba` (`docs/10` §6-Z, §6-Z.7) |
| Alinhamento de `docs/07` §10.1/§10.2 às restrições de `D-CFG-23` | **RESOLVIDO** — `docs/07` REV. 2.3 (§1.3, §7.2, §10.1 `U-14`, §10.2, §28.1) |
| Leitura do catálogo de serviços por outros papéis; pacote/agendamento com serviço inativo; duração sobrescrevível (`D-CFG-30`, `D-CFG-33`) | **PARCIALMENTE DECIDIDO EM `docs/15`** — leitura de serviços ativos sem preço em `GET /agenda/opcoes` (`D-AGD-13`); duração sobrescrevível com `fim` obrigatório (`D-AGD-05`); pacote/agendamento com serviço inativo **PENDENTE DA FATIA AGD-D** (`D-AGD-15`) |
| CFG-002 | **INTEGRADO NA `main`** (exceto exceções/feriados e aplicação de RN-014, acima) |
| CFG-003 | **INTEGRADO NA `main`** (exceto pendências de fronteira, acima) |
| `P-CFG-05` — implementação de `CFG-004` (`D-CFG-34`..`D-CFG-45`: migration de unicidade e CHECK de `forma_pagamento`, rotas `/formas-pagamento`, testes) | **INTEGRADA NA `main`** em 17/09/2026 pela PR [#86](https://github.com/BrunoMNoronha/techlab-fisio/pull/86) (merge `e17024c`), a partir da branch `integration/local-fase4` (`docs/10` §6-AA, §6-AE); auditoria de fechamento em `docs/10` §6-AF |
| Alinhamento de `docs/07` §10.1/§10.2 às restrições de `D-CFG-35` | **RESOLVIDO** — `docs/07` REV. 2.4 (§1.3, §7.2, §10.1 `U-15`, §10.2 `ck_forma_pagamento_situacao`, §28.1 `P-CFG-D07-02`, §28.2), após a integração da migration pela PR [#86](https://github.com/BrunoMNoronha/techlab-fisio/pull/86) |
| Leitura das formas de pagamento por outros papéis; bloqueio da forma em T-03 (`D-CFG-43`, `D-CFG-45`) | **PENDENTE DA FATIA DE PAGAMENTOS** |
| `P-CFG-06` — implementação de `CFG-005` (`D-CFG-46`..`D-CFG-57`: migration de unicidade e CHECK de `motivo_cancelamento`, rotas `/motivos-cancelamento`, testes) | **INTEGRADA NA `main`** em 17/09/2026 pela PR [#86](https://github.com/BrunoMNoronha/techlab-fisio/pull/86) (merge `e17024c`), a partir da branch `integration/local-fase4` (`docs/10` §6-AB, §6-AE); auditoria de fechamento em `docs/10` §6-AF |
| Alinhamento de `docs/07` §10.1/§10.2 às restrições de `D-CFG-47` | **RESOLVIDO** — `docs/07` REV. 2.4 (§1.3, §7.2, §10.1 `U-16`, §10.2 `ck_motivo_cancelamento_situacao`, §28.1 `P-CFG-D07-02`, §28.2), após a integração da migration pela PR [#86](https://github.com/BrunoMNoronha/techlab-fisio/pull/86) |
| Obrigatoriedade do motivo no cancelamento e CHECK de coerência `estado`/motivo; cancelamento sem motivos ativos; leitura dos motivos por outros papéis; bloqueio do motivo no cancelamento (`D-CFG-51`, `D-CFG-52`, `D-CFG-55`, `D-CFG-57`) | **DECIDIDO EM `docs/15`** (`D-AGD-07`, `D-AGD-13`): motivo obrigatório; sem motivo ativo → `422 MOTIVO_CANCELAMENTO_INELEGIVEL`; migration futura do CHECK de coerência aprovada; motivos ativos em `GET /agenda/opcoes`; `FOR SHARE` no motivo — implementação não autorizada |
| CFG-006 — fuso horário operacional (`D-CFG-04`, `D-CFG-08`, `D-CFG-11`) | **DECIDIDO E INTEGRADO NA `main`** — materializado com `CFG-001A` (PR [#65](https://github.com/BrunoMNoronha/techlab-fisio/pull/65), `P-CFG-01`) e `CFG-001B` (PR [#69](https://github.com/BrunoMNoronha/techlab-fisio/pull/69), `P-CFG-02`); nenhum módulo consumidor do fuso existe na `main` |
| CFG-006 — pendências de fronteira: demonstração do aceite (exibição e agregação no período local); local da conversão UTC ↔ local (aplicação ou banco — **resolvido somente para RN-014 por `D-CFG-60`: aplicação**) e compatibilidade entre as bases de fusos do runtime e do PostgreSQL; leitura do fuso por outros papéis; distinção da troca de fuso na trilha de auditoria (limitação de `docs/09` §13.6) | **PENDENTE DAS FATIAS DE AGENDA, INDICADORES E FRONTEND** — registro factual, sem decisão; a reavaliação da troca de fuso segue na linha de `D-CFG-08` acima |
| Inclusão da clínica no subcomando `provisionar` (`D-CFG-12`) | **NÃO AUTORIZADA** — reavaliação futura possível |
| Alinhamento de `docs/07` (afirmava restrição então inexistente) | **RESOLVIDO** — migration `20260917060000_clinica_linha_unica` (`ux_clinica_linha_unica`) integrada na `main` pela PR #65 |

## 6. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **27** | 17/09/2026 | Atualização **factual** de §5 após a integração da PR [#86](https://github.com/BrunoMNoronha/techlab-fisio/pull/86) (merge `e17024c`): `P-CFG-05` (`CFG-004`) e `P-CFG-06` (`CFG-005`) passam de "integradas na branch local" para **INTEGRADAS NA `main`**, e os dois alinhamentos de `docs/07` §10.1/§10.2 (`D-CFG-35`, `D-CFG-47`) passam de **PENDENTE** para **RESOLVIDO** (`docs/07` REV. 2.4). Registro exclusivamente factual da auditoria de fechamento (`docs/10` §6-AF): **nenhuma decisão criada, alterada, renumerada ou reaberta**; as pendências de fronteira de `D-CFG-43`/`D-CFG-45` (pagamentos) e `D-CFG-51`/`D-CFG-52`/`D-CFG-55`/`D-CFG-57` (agenda) permanecem exatamente como estavam. |
| **26** | 17/09/2026 | Alinhamento editorial `D-INTEG-02` (Bruno Menezes Noronha), na integração local das quatro frentes: `D-CFG-58`..`D-CFG-66` registradas como **HOMOLOGADAS** (Status e título de §3.14), exatamente como decididas na REV. 18, **sem alteração de teor**; estados de §5 de RN-014, tela de configuração horária, `P-CFG-05` e `P-CFG-06` atualizados para a consolidação na branch local `integration/local-fase4` (`docs/10` §6-AE). Nenhuma decisão criada, alterada ou reaberta. |
| **25** | 17/09/2026 | Atualização factual de §5: `P-CFG-06` (`CFG-005`) implementada e medida no ambiente local, sem commit (`docs/10` §6-AB; numeração fixada na integração local; registrada na origem como REV. 18), após autorização de implementação por Bruno Menezes Noronha. Nenhuma decisão criada, alterada ou reaberta. |
| **24** | 17/09/2026 | Atualização factual de §5: `P-CFG-05` (`CFG-004`) implementada e medida em branch local sem commit (`docs/10` §6-AA; numeração fixada na integração local; registrada na origem como REV. 18), após autorização de implementação por Bruno Menezes Noronha. Nenhuma decisão criada, alterada ou reaberta. |
| **23** | 17/09/2026 | Atualização factual de §5: pendências de fronteira `D-CFG-30`, `D-CFG-33` (parcial), `D-CFG-51`, `D-CFG-52`, `D-CFG-55`, `D-CFG-57` e `D-CFG-65` decididas no pacote da agenda homologado (`docs/15` REV. 2). Nenhuma decisão deste documento criada, alterada ou reaberta. |
| **22** | 17/09/2026 | Atualização factual de §5: componente de RN-014 (parcela da clínica, `D-CFG-60`/`D-CFG-61`) implementado localmente, ainda sem consumidor — a fatia de agenda não existe. Nenhuma decisão criada, alterada ou reaberta. |
| **21** | 17/09/2026 | Atualização factual de §5: `403` sem `clinica.configurar` coberto na prova E2E real (Cenário 9). Nenhuma decisão criada, alterada ou reaberta. |
| **20** | 17/09/2026 | Atualização factual de §5: tela de configuração horária incluída na prova E2E real same-origin (`verify-web-api-e2e.mjs`, Cenário 8). Nenhuma decisão criada, alterada ou reaberta. |
| **19** | 17/09/2026 | Atualização factual de §5: tela de configuração horária (`D-CFG-66`) implementada localmente, sem publicação Git. Nenhuma decisão criada, alterada ou reaberta. |
| **18** | 17/09/2026 | Acréscimo de §3.14 (`D-CFG-58`..`D-CFG-66`) — fechamento da configuração horária (frente `CFG-HOR`), decidido a partir das fontes vigentes por solicitação de Bruno Menezes Noronha: mapa de estado; grade vazia fail-closed e sem grade pré-cadastrada; limites `00:00`/`23:59`; grade como hora local no fuso da clínica com conversão na aplicação para RN-014; predicado de contenção em janela única, bordas inclusivas no intervalo semiaberto e `422 FORA_DO_HORARIO_FUNCIONAMENTO`; camadas clínica × disponibilidade × bloqueio × serviço; estratégia flexível sem retroatividade e troca de fuso sem transição (conclui a reavaliação de `D-CFG-08`); Opção A para exceções e feriados (refina a classificação de `D-CFG-19`); permissões e auditoria de fronteira; comportamento do frontend; matriz de cenários; impactos e classificação de escopo. Cabeçalho e §5 atualizados. Nenhuma decisão anterior revogada; nenhum código, schema, migration ou teste alterado. |
| **17** | 17/09/2026 | Atualização factual de §5: alinhamento de `docs/07` às restrições de `D-CFG-23` resolvido pela REV. 2.3 daquele documento. Nenhuma decisão normativa criada, alterada ou reaberta. |
| **16** | 17/09/2026 | Reconciliação factual pós-integração de §5: `P-CFG-04` / `CFG-003` integrada pela PR #80 (merge `fd3c205`). O registro da REV. 15 permanece como histórico. Nenhuma decisão normativa criada, alterada ou reaberta. |
| **15** | 17/09/2026 | Atualização factual de §5: `P-CFG-04` (`CFG-003`) implementada e medida em branch própria (`docs/10` §6-Z), após autorização de implementação por Bruno Menezes Noronha. Nenhuma decisão criada, alterada ou reaberta. |
| **14** | 17/09/2026 | Atualização factual de §5 (análise `CFG-PREP6`, somente leitura sobre `origin/main` = `41cb0ff`): linha própria de `CFG-006` como decidido e integrado (PRs #65 e #69) e registro das pendências de fronteira do fuso para as fatias de agenda, indicadores e frontend. Nenhuma decisão criada, alterada ou reaberta; nenhum código alterado. |
| **13** | 17/09/2026 | Acréscimo de `D-CFG-46`..`D-CFG-57` (§3.13) — motivos de cancelamento (`CFG-005`) —, homologadas por Bruno Menezes Noronha a partir das recomendações do pacote `CFG-PREP5`: unicidade da descrição e CHECK de coerência (migration futura autorizada); rotas `/motivos-cancelamento` sem `DELETE`; descrição 1–100; `409 MOTIVO_CANCELAMENTO_EM_USO` na edição de motivo referenciado por `agendamento` ou `historico_agendamento`; obrigatoriedade do motivo, ausência de motivos ativos e leitura por outros papéis remetidas à fatia de agenda; sem motivos pré-cadastrados; preservação fundamentada em CFG-005 e `docs/07` §23 (RN-007 não os lista); `FOR UPDATE`; `clinica.configurar`; auditoria com `alvo_tipo = "motivo_cancelamento"`. Cabeçalho, §4 e §5 atualizados. Nenhuma decisão anterior alterada; nenhum código alterado; implementação não autorizada. Registrada originalmente como REV. 12 (PR #79, base `113acbd`); renumerada para REV. 13 na reconciliação com a PR #78 (base `7e67765`), sem alteração de conteúdo decisório. |
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
