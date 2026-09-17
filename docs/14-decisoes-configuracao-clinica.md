# Decisões da Configuração da Clínica — Primeira fatia (`CFG-001A`)

> **Documento:** `docs/14-decisoes-configuracao-clinica.md`
> **Projeto:** TechLab Fisio
> **Frente:** Fase 3 — Configuração da Clínica (módulo M2, `CFG-001..CFG-006`)
> **Status:** **DECIDIDO — `D-CFG-01`..`D-CFG-08` E ADENDOS `D-CFG-03-A` E `D-CFG-04-A` HOMOLOGADOS POR BRUNO MENEZES NORONHA EM 17/09/2026; `D-CFG-09`..`D-CFG-12` (PROVISIONAMENTO DA CLÍNICA) HOMOLOGADAS EM 17/09/2026; `D-CFG-13`..`D-CFG-20` (HORÁRIO DE FUNCIONAMENTO, `CFG-002`) HOMOLOGADAS EM 17/09/2026 — IMPLEMENTAÇÃO NÃO INICIADA** (TLF-BASE-V1 §15, item 1).
> **Data:** 17 de setembro de 2026
> **Insumo decisório:** pacote de análise `CFG-PREP0` (somente leitura), executado sobre `origin/main` = `63bb058`.
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

### 3.10 Horário de funcionamento (`CFG-002`) — `D-CFG-13`..`D-CFG-20` *(homologadas em 17/09/2026; insumo: pacote `CFG-PREP2`)*

**Natureza.** Registro normativo, somente documental. **Nenhum código, schema, migration, teste, permissão ou ação/chave de auditoria foi criado ou alterado.** `CFG-002` está **decidido e não implementado**.

**Fatos de partida (`CFG-PREP2`, somente leitura sobre `origin/main` = `02cc93d`; reconferidos sobre `6b55dec`).**

| # | Fato | Evidência |
| --- | --- | --- |
| F-09 | `horario_funcionamento` existe: `id uuid PK`, `clinica_id uuid NN` (FK `clinica`, `ON DELETE/UPDATE RESTRICT`), `dia_semana smallint NN`, `hora_inicio time(6) NN`, `hora_fim time(6) NN`, `criado_em timestamptz NN`; sem `atualizado_em`, situação, versão ou vigência | migrations `20260820121255`, `20260820121900` |
| F-10 | CHECKs protegidos `ck_horario_funcionamento_dia_semana` (`0..6`) e `ck_horario_funcionamento_intervalo` (`hora_fim > hora_inicio`); **nenhuma** UNIQUE, exclusion constraint ou índice além da PK — o banco admite múltiplas linhas por dia, duplicatas e sobreposições | migration `20260822144354`; `protected-objects.json` |
| F-11 | `docs/07` define horários locais recorrentes como `time` + `dia_semana` e atribui ao **backend** a verificação de funcionamento/disponibilidade na agenda (§17, T-01) | `docs/07` |
| F-12 | `docs/09` §13.6 (FECHADA) abrange CFG-001..CFG-006 com a ação única `configuracao.alterada`, entidade concreta por `alvo_tipo` (nome físico, `D-AUD-03`) incluindo `horario_funcionamento`, e whitelist vazia; `evento_auditoria.alvo_id` é `uuid` anulável sem FK | `docs/09` §12.4, §13.6; `schema.prisma` |
| F-13 | Nenhuma fonte definia a convenção do dia 0, a multiplicidade de janelas, o formato da hora, o contrato HTTP nem o alvo de auditoria de uma substituição em lote | `CFG-PREP2` |

#### 3.10.1 `D-CFG-13` — Convenção de dia da semana

- `dia_semana`: **`0` = domingo**, `1` = segunda-feira, `2` = terça-feira, `3` = quarta-feira, `4` = quinta-feira, `5` = sexta-feira, `6` = sábado.
- A mesma convenção é **normativa para `disponibilidade_profissional`**.
- Motivação: compatibilidade direta com o CHECK `0..6` vigente, com `Date.getDay()` e com `EXTRACT(DOW)` do PostgreSQL, evitando conversões na agenda futura.

#### 3.10.2 `D-CFG-14` — Estrutura das janelas

- **Múltiplos intervalos no mesmo dia** são admitidos.
- São **inválidos**: duplicatas exatas; intervalos sobrepostos; **intervalos adjacentes** do mesmo dia.
- Janelas adjacentes devem ser enviadas como **um único intervalo contínuo** — ex.: `08:00–12:00` + `12:00–18:00` é inválido; a representação canônica é `08:00–18:00`.
- O backend **não** funde intervalos silenciosamente: rejeita.
- Finalidade: representação canônica única e no-op determinístico (`D-CFG-20`).

#### 3.10.3 `D-CFG-15` — Representação da hora e limites

- Contrato HTTP textual **`HH:MM`**, relógio de 24 horas, **sem segundos**; regex de referência `^([01]\d|2[0-3]):[0-5]\d$`.
- `00:00` e `23:59` são aceitos; **`24:00` é rejeitado**; qualquer minuto válido é permitido (sem arredondamento).
- Cada intervalo exige `horaInicio < horaFim`.
- Limites: **no máximo 3 intervalos por dia** e **no máximo 21 intervalos na semana**.
- A persistência continua em `time`. A implementação **não deve depender da conversão de `time` para `Date`** ao ler os valores; o contrato externo permanece textual `HH:MM`.

#### 3.10.4 `D-CFG-16` — Dia fechado e semana vazia

- Dia fechado = **ausência de intervalos** para aquele `diaSemana`.
- **Não** se cria flag `fechado`, intervalo sentinela nem `00:00–00:00`.
- `{ "horarios": [] }` é **permitido** e representa clínica sem janela operacional cadastrada.

#### 3.10.5 `D-CFG-17` — Contrato HTTP

- `GET /clinica/horarios` e `PUT /clinica/horarios`.
- O `PUT` realiza **substituição atômica** da configuração semanal.
- Corpo (e resposta de `GET`/`PUT` `200`, no mesmo formato):

```json
{
  "horarios": [
    { "diaSemana": 1, "horaInicio": "08:00", "horaFim": "12:00" },
    { "diaSemana": 1, "horaInicio": "13:30", "horaFim": "18:00" }
  ]
}
```

- **Corpo estrito:** raiz com **exatamente** `horarios` (array); cada item com **exatamente** `diaSemana`, `horaInicio`, `horaFim`. Campos físicos ou internos (`id`, `clinicaId`, `criadoEm`, entre outros) são rejeitados.
- **Tipagem sem coerção:** `diaSemana` é inteiro JSON em `0..6` (rejeitados, entre outros, `"1"`, `1.5`, `null`, `true`); horas são strings estritas `HH:MM` (`D-CFG-15`).
- **Resposta:** ordenação canônica `diaSemana ASC, horaInicio ASC`; **não** expõe IDs, `clinica_id`, `criado_em` nem nomes físicos. No `PUT`, retorna o estado vigente após a operação, inclusive no no-op.
- **Erros** (corpo `{ erro: <código> }`), somente códigos existentes: `400 REQUISICAO_INVALIDA`; `401 SESSAO_INVALIDA`; `403 ACESSO_NEGADO`; `403 REQUISICAO_NAO_AUTORIZADA`; `404 CLINICA_NAO_CONFIGURADA` (linha de `clinica` ausente, `D-CFG-01`); `500 FALHA_INTERNA`. **Nenhum código novo.**
- `GET` responde com `Cache-Control: no-store` e **não** exige CSRF. `PUT` sujeito à proteção CSRF vigente, na ordem já estabelecida (CSRF antes da sessão, como em `PUT /clinica`).

#### 3.10.6 `D-CFG-18` — Auditoria

- Aplicação de `docs/09` §13.6 e `D-AUD-03`: `acao = "configuracao.alterada"`, **`alvo_tipo = "horario_funcionamento"`**, ator da sessão, `resultado = SUCESSO`, `contexto = {}`, `justificativa = null`.
- A alteração efetiva da semana gera **um evento por linha efetivamente inserida ou removida**, com `alvo_id` = UUID da respectiva linha. O UUID de linha removida permanece válido como **identificador histórico** do alvo (sem FK).
- **Vedado:** `alvo_tipo = "clinica"` para esta operação; `alvo_id = null` como representação do lote; ação nova; chave de `contexto` nova; sentinela; evento agregador adicional.
- **Privacidade:** nenhum `diaSemana`, `horaInicio`, `horaFim` ou representação textual dos intervalos em `contexto` ou `justificativa`.
- Auditoria na **mesma transação** da mutação; falha da auditoria implica **rollback** conjunto.
- Consequência de aplicação (não decisão nova): linhas idênticas entre o estado vigente e o solicitado **não são removidas nem reinseridas**; apenas as linhas que saem são removidas fisicamente e as que entram são inseridas. A remoção física se restringe a este componente de configuração substituível e **não altera** a regra geral de `docs/07` §23 de não oferecer exclusão física de cadastros.

#### 3.10.7 `D-CFG-19` — Autorização

- `GET` e `PUT` exigem **`clinica.configurar`**.
- **Não** se cria permissão específica para horário de funcionamento; `profissionais.gerenciar` **não** é reutilizada para esta finalidade.

#### 3.10.8 `D-CFG-20` — Concorrência e no-op

- **Extensão expressa de `D-CFG-05` a `CFG-002`:** a linha única de `clinica` é o mutex da configuração estrutural (`SELECT ... FROM clinica ... FOR UPDATE`); escritas concorrentes são serializadas. **Não** se criam coluna de versão, ETag, `409` de concorrência nem advisory lock.
- **Extensão expressa de `D-CFG-06` a `CFG-002`:** estado canônico solicitado idêntico ao persistido → `200`, **nenhum** `DELETE`, `INSERT` ou `UPDATE`, **nenhum** evento de auditoria; as linhas existentes permanecem intactas.

#### 3.10.9 Regras derivadas registradas *(não constituem decisão nova)*

1. `horario_funcionamento` representa **hora de relógio local recorrente** (`docs/07`, `time` + `dia_semana`).
2. Esses valores **não** são convertidos para UTC.
3. Alterar o fuso horário da clínica (`D-CFG-08`) **não altera** linhas de `horario_funcionamento`.
4. A combinação com data concreta e fuso pertence à futura regra da agenda (RN-014, `docs/07` §17, T-01).
5. Travessia de meia-noite permanece **proibida** pelo modelo atual (`ck_horario_funcionamento_intervalo`).
6. A configuração cabe no schema existente.
7. **Nenhuma migration** é necessária para `CFG-002`.
8. **Nenhuma** UNIQUE ou exclusion constraint é adicionada nesta fatia; duplicidade, sobreposição e adjacência são validadas no backend sob o lock de `D-CFG-20`.
9. Exceções, feriados, aplicação de RN-014 na agenda, PRO-003 e bloqueios permanecem **fora desta frente**.

## 4. Consequências normativas já definidas (sem ampliação)

- **Auditoria** (`docs/09` §13.6): mutação efetiva emite `configuracao.alterada` com ator da sessão, `alvo_tipo = "clinica"`, `alvo_id = clinica.id`, `resultado = SUCESSO`, `justificativa = null`, `contexto` vazio, na **mesma transação** da mutação; falha da auditoria implica rollback conjunto. Nenhum valor de campo é registrado. *(Aplica-se às mutações de `clinica` — `CFG-001`/`CFG-006`; para `CFG-002` vale `D-CFG-18`: `alvo_tipo = "horario_funcionamento"`, um evento por linha inserida ou removida.)*
- **Autorização** (`D-2.3D-09`): sem sessão → `401`; sem permissão → `403`; CSRF obrigatório somente na rota mutante.
- **Não ampliação:** nenhuma permissão, ação de auditoria, chave de `contexto` ou dependência nova decorre deste registro.

## 5. Pendências abertas

| Item | Estado |
| --- | --- |
| `P-CFG-01` — implementação da fatia `CFG-001A` (migration de linha única, GET/PUT `/clinica`, testes) | **INTEGRADA NA `main`** — PR [#65](https://github.com/BrunoMNoronha/techlab-fisio/pull/65), commit de integração `6ee19f27afc5d7c55667ef910536baa924ecc990` (`docs/10` §6-W, §6-X.5) |
| `P-CFG-02` — provisionamento da linha de `clinica` (`CFG-001B`; `D-CFG-01`, `D-CFG-09`..`D-CFG-12`) | **INTEGRADO NA `main`** — PR [#69](https://github.com/BrunoMNoronha/techlab-fisio/pull/69), merge commit `02cc93d5770003775d3417b1d2ee08a874675d30` (`docs/10` §6-X, §6-X.5) |
| Logotipo e duração padrão (`D-CFG-07`) | **FUTURO DO MVP** — não implementados |
| `P-CFG-03` — `CFG-002` horário de funcionamento (`D-CFG-13`..`D-CFG-20`) | **DECISÕES HOMOLOGADAS E MATERIALIZADAS (§3.10) — IMPLEMENTAÇÃO NÃO INICIADA** |
| Exceções e feriados do horário de funcionamento; aplicação de RN-014 na agenda | **FORA DE `CFG-002`** — fatia de agenda / modelagem futura |
| CFG-003..CFG-005 | **NÃO INICIADOS** |
| Inclusão da clínica no subcomando `provisionar` (`D-CFG-12`) | **NÃO AUTORIZADA** — reavaliação futura possível |
| Alinhamento de `docs/07` (afirmava restrição então inexistente) | **RESOLVIDO** — migration `20260917060000_clinica_linha_unica` (`ux_clinica_linha_unica`) integrada na `main` pela PR #65 |

## 6. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **7** | 17/09/2026 | Acréscimo de `D-CFG-13`..`D-CFG-20` (§3.10) — horário de funcionamento (`CFG-002`): 0 = domingo; múltiplas janelas sem duplicata, sobreposição ou adjacência; `HH:MM` com máx. 3/dia e 21/semana; dia fechado por ausência; `GET`/`PUT /clinica/horarios`; auditoria `configuracao.alterada` com `alvo_tipo = "horario_funcionamento"`, um evento por linha inserida/removida; `clinica.configurar`; extensão de `D-CFG-05`/`D-CFG-06` —, homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP2`. Fatos F-09..F-13 e regras derivadas registrados; nota de alcance em §4; §5 atualizada. Substitui o registro proposto na PR #72 (não integrada). Nenhuma decisão anterior alterada; nenhum código, schema ou migration alterado; implementação não iniciada. |
| **6** | 17/09/2026 | Reconciliação factual pós-integração (`CFG-POST1`) de §5: `P-CFG-01` integrada pela PR #65 (`6ee19f2`) e `P-CFG-02` integrado pela PR #69 (`02cc93d`); alinhamento de `docs/07` resolvido; restrição de `provisionar` (`D-CFG-12`) explicitada como pendência. Os registros das REV. 2 e 5 permanecem como histórico. Nenhuma decisão normativa criada, alterada ou reaberta. |
| **5** | 17/09/2026 | Atualização factual de §5: `P-CFG-02` implementado e medido em branch própria (`docs/10` §6-X); nenhuma decisão criada, alterada ou reaberta. |
| **4** | 17/09/2026 | Acréscimo de `D-CFG-09`..`D-CFG-12` (§3.9) — autoria nula com justificativa, reexecução idempotente, entrada por ambiente e subcomando `bootstrap-clinica` —, homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP1` (opções conservadoras). Nenhuma decisão anterior alterada; nenhum código alterado. |
| **3** | 17/09/2026 | Adendos `D-CFG-03-A` (representação da resposta) e `D-CFG-04-A` (predicado exato do e-mail), homologados por Bruno Menezes Noronha em 17/09/2026 em resposta à revisão do PR #60. Formalizam o comportamento já implementado em `CFG-001A`; nenhuma decisão anterior alterada. |
| **2** | 17/09/2026 | Atualização factual de §5: `P-CFG-01` implementada e medida em branch própria (`docs/10` §6-W); nenhuma decisão criada, alterada ou reaberta. |
| **1** | 17/09/2026 | Registro inicial: `D-CFG-01`..`D-CFG-08` homologadas por Bruno Menezes Noronha a partir do pacote `CFG-PREP0`. Somente documental; nenhum código, migration ou teste alterado. |

---

**Fim — `docs/14-decisoes-configuracao-clinica.md`.**
