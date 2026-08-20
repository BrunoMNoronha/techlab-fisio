# Modelo de Persistência, Integridade e Concorrência — TechLab Fisio

> **Documento:** `docs/07-modelo-persistencia.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Modelagem — **Etapa 2.2: Modelo de Persistência, Integridade Transacional e Concorrência**
> **Status:** **HOMOLOGADO — REV. 2 — ETAPA 2.2 CONCLUÍDA**
> **Homologação:** decisões **`H2.2-01` a `H2.2-18`**, **P-CLIN (Alternativa A)**, **`PROP-RN-2.2-01`** e **`PROP-RN-2.2-02`** aprovadas em conjunto por **Bruno Menezes Noronha** em **19 de agosto de 2026**
> **Data:** 19 de agosto de 2026
> **Idioma oficial:** Português do Brasil

---

## 1. Status, fontes e histórico de revisões

### 1.1 Status

**HOMOLOGADO — REV. 2 — ETAPA 2.2 CONCLUÍDA.** As decisões **`H2.2-01` a `H2.2-18`**, a resolução de **P-CLIN pela Alternativa A**, e as regras **`PROP-RN-2.2-01`** e **`PROP-RN-2.2-02`** estão **HOMOLOGADAS** por Bruno Menezes Noronha em 19/08/2026 (registro em §1.5).

**A homologação NÃO autoriza implementação.** Permanecem expressamente não autorizados: `schema.prisma`, migrations, DDL, instalação de dependências, commit, push, merge, deploy, endpoints, DTOs, serviços NestJS, frontend e infraestrutura. A próxima etapa deve **primeiro fixar e verificar as versões técnicas aplicáveis** (§28.2, Categoria C) e **então** produzir o plano de implementação física (§28.4).

O conteúdo desta revisão resulta de **revisão arquitetural independente e adversarial da REV. 1**, cujo objetivo declarado foi **refutar** a proposta anterior. O que sobreviveu está aqui; o que não sobreviveu está registrado em §2 com a justificativa da mudança.

### 1.2 Fontes e hierarquia de autoridade (TLF-BASE-V1 §15)

1. Autorização explícita e atual de **Bruno Menezes Noronha**.
2. **`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`** — TLF-BASE-V1 — **IMUTÁVEL**. Não modificada.
3. Decisões homologadas: `D-01..D-07`, `HOM-01..HOM-05`, `H2-01..H2-12`.
4. Documentação versionada: `docs/02` a `docs/06` — **não alteradas**.
5. Código, migrations, testes — inexistentes.
6. Propostas e conversas — inclui este documento.

### 1.3 Histórico de revisões

- **REV. 1** — primeira proposta física da Etapa 2.2, com `H2.2-01`..`H2.2-18`.
- **REV. 2 (esta) — CONSOLIDAÇÃO HOMOLOGADA** — revisão arquitetural independente seguida de homologação. Correções materiais em `H2.2-02`, `H2.2-04`, `H2.2-06`, `H2.2-10` e **substituição da recomendação de P-CLIN** (`H2.2-16`); remoção de três elementos sem sustentação nas fontes; resolução das lacunas `P2.2-03` e `P2.2-04` em regras formais; simulação de 12 cenários concorrentes (§25); matriz de homologação (§27). **Homologada em 19/08/2026** — P-CLIN resolvida pela Alternativa A e aplicada ao modelo físico; aggregate root de `Atendimento` mantido deliberadamente em aberto.

### 1.4 Registro de homologação e efeitos

**Aprovação conjunta de Bruno Menezes Noronha — 19 de agosto de 2026.**

| Decisão | Conteúdo homologado | Efeito nesta consolidação |
| --- | --- | --- |
| **P-CLIN — Alternativa A** | Um `RegistroClinico` por `Atendimento`, contendo avaliação, plano, evolução e demais componentes clínicos necessários | **Aplicada ao modelo físico:** `registro_clinico.atendimento_id NOT NULL UNIQUE` (§7.6, §8, U-13, IDX-N2); âncora de `anexo_clinico` resolvida; §21 passa de proposta a decisão |
| **Aggregate root de `Atendimento`** | **Permanece deliberadamente em aberto.** `Atendimento` **não** é promovido; **H2-06 permanece vigente nesse aspecto** | Nenhuma alteração de H2-06. Registrado como pendência remanescente `P2.2-10` (§28.1) |
| **`PROP-RN-2.2-01`** | Data de referência de cobrança avulsa **acompanha a remarcação válida** do agendamento; pagamentos/estornos **não** congelam nem alteram a referência por si só; alterações preservam auditoria | §20.3 passa a regra vigente; T-01 incorpora o recálculo auditado |
| **`PROP-RN-2.2-02`** | Cancelamento de Agendamento **não** cancela automaticamente Cobrança; cancelamento ou resolução financeira exige operação explícita, autorização adequada e preservação do histórico | §20-A passa a regra vigente |
| **`H2.2-06`** | Proteção estrutural contra sobreposição temporal do mesmo profissional e do mesmo paciente por exclusion constraints PostgreSQL; **dependências técnicas, inclusive `btree_gist`, verificadas antes da implementação** | §17.2 vigente; verificação permanece obrigatória (§28.2, Categoria C) |
| **`H2.2-08`** | Estorno parcial de um mesmo Pagamento **fora do MVP e fisicamente irrepresentável**; cada Pagamento admite no máximo um Estorno integral | §19.3 vigente |
| **`H2.2-11`** | FK física entre `movimento_sessao` e `atendimento`, **sem transferência de ownership** e **sem autorização para M7 acessar conteúdo clínico de M6** | §15 vigente; a restrição de ownership é reafirmada como condição da aprovação |
| **`H2.2-13`** | CPF **opcional**; quando informado, **normalizado e único**. Pacientes inativos **permanecem abrangidos pela unicidade** e devem ser **localizados/reativados**, nunca recadastrados como nova identidade | §11.4 atualizada — **normalização passa a exigência homologada**, não detalhe de implementação |
| **Demais `H2.2-01`..`H2.2-18`** | Itens com parecer **APROVAR** ou **APROVAR COM CORREÇÃO** | Homologados conforme o conteúdo consolidado desta REV. 2 |

**Efeito de governança sobre H2-03.** A homologação de P-CLIN — Alternativa A **encerra parcialmente H2-03** em dois dos três itens adiados: **multiplicidade `Atendimento ↔ Registro clínico`** e **decomposição clínica para o MVP**. O terceiro item — **aggregate root de `Atendimento`** — **permanece adiado por decisão expressa**. H2-03 continua vigente nesse aspecto residual.

**Efeito sobre H2-06.** **Nenhum.** H2-06 permanece integralmente vigente: `Pacote` e `Cobrança` são aggregate roots; `Atendimento` não é. A supersessão parcial que a REV. 2 havia declarado como *possível* **não** ocorreu, porque a promoção não foi homologada.

**Efeito sobre riscos herdados.** O risco `R-13` de `docs/06` §19 ("ambiguidade do gatilho se a multiplicidade clínica for definida sem cuidado") está **eliminado**: com um único registro por atendimento, a primeira finalização válida é única por construção, independentemente da unicidade de consumo que já a protegia.

**Regras novas e sua absorção documental.** `PROP-RN-2.2-01` e `PROP-RN-2.2-02` são regras de negócio homologadas nesta etapa. `docs/03-regras-negocio.md` **não foi alterado** — sua atualização é ação de governança separada, registrada como `P2.2-11` (§28.1). Até lá, **este documento é a fonte vigente dessas duas regras**.

### 1.5 Estado do repositório verificado

| Item | Verificado em 19/08/2026 |
| --- | --- |
| Diretório | `C:\Users\bruno\Workspace\techlab-fisio` |
| Branch | `agent/fase2-etapa2.2-persistencia` |
| HEAD | `f9d8296` — descende de `origin/agent/fase1-documentacao-homologada` (confirmado) |
| `git status` | `?? TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`, `?? docs/07-modelo-persistencia.md` |
| `docs/02`..`docs/06` | intactos (`git diff --stat HEAD -- docs/` vazio) |
| Base Imutável | md5 inalterado; **não versionada** — risco de governança registrado (§26, `R2.2-16`), **não resolvido nesta tarefa** |
| Prisma / PostgreSQL | **sem versão fixada** — nenhuma afirmação de suporte declarada como fato (§23) |

---

## 2. O que mudou da REV. 1 para a REV. 2

### 2.1 Correções materiais

| # | Item | REV. 1 | REV. 2 | Motivo |
| --- | --- | --- | --- | --- |
| **C-01** | **P-CLIN** (`H2.2-16`) | Recomendava **múltiplos registros tipados** por atendimento | **Recomenda um registro clínico por atendimento** | A REV. 1 apoiou-se na inferência de que avaliação/plano precisariam existir fora de um atendimento. **As fontes dizem o contrário** — TLF-BASE-V1 §7 passos 7–8, FC-05 passo 2 e `docs/06` §6.6 (§21.3) |
| **C-02** | **`reserva_sessao`** (`H2.2-02`) | Enum `situacao ATIVA/LIBERADA/CONSUMIDA` **+** `encerrada_em` **+** `motivo_encerramento` | **Sem enum de situação.** Representação por fatos: `encerrada_em`, `motivo_encerramento`, `movimento_consumo_id` | `situacao` e `motivo_encerramento` codificavam o mesmo fato em duas colunas, exigindo CHECK para mantê-las sincronizadas — redundância eliminável (§13.2) |
| **C-03** | **Consumo único** (`H2.2-04`) | `UNIQUE(atendimento_id, pacote_id)` simples, escolhido por ser expressável no Prisma | **Índice único parcial `WHERE tipo = 'CONSUMO'`** | O critério "mais fácil no Prisma" era inválido: a equivalência dependia de uma `CHECK` que **também** exige migration SQL. Sem ganho real de categoria, prevalece a expressão direta da regra (§16.2) |
| **C-04** | **Conflito de agenda** (`H2.2-06`) | Estados ativos = `AGENDADO, CONFIRMADO, AGUARDANDO, EM_ATENDIMENTO` | **Inclui `CONCLUIDO`** | **Defeito da REV. 1.** `CANCELADO` e `FALTA` liberam o horário (AGD-003); `CONCLUIDO` **não** — o profissional esteve ocupado. Excluí-lo permitiria criar agendamento retroativo sobreposto a atendimento realizado (§17.2) |
| **C-05** | **Data de referência** (`H2.2-10`) | Regra híbrida: congela após haver pagamento | **Referência dinâmica**, independente de pagamentos | A regra híbrida **contradizia** a invariante literal de IND-005: "pagamento ou estorno não altera, por si só, a receita prevista" (§20, `PROP-RN-2.2-01`) |
| **C-06** | **Append-only** (`H2.2-14`/§22) | "privilégios e/ou triggers" genericamente | **Priorizado:** `REVOKE` para 4 tabelas puramente append-only; **trigger apenas** para as 2 tabelas clínicas com imutabilidade condicional | Trigger condicional só é necessário onde a imutabilidade depende do estado da linha (§22) |

### 2.2 Elementos removidos por falta de sustentação nas fontes

| Elemento removido | Onde estava | Motivo |
| --- | --- | --- |
| `atendimento.profissional_id NOT NULL` | REV. 1 §5.6 | **Segunda fonte de verdade.** O profissional do atendimento é o do agendamento. `docs/06` §6.6 declara que `Atendimento` referencia **Agendamento e Paciente** — não profissional. IND-008 agrega por `agendamento`. |
| `reserva_sessao.situacao` (enum) | REV. 1 §10.1 | Redundante com `motivo_encerramento`/`encerrada_em` (C-02) |
| `evento_auditoria.resultado` como enum fechado `SUCESSO/NEGADO/FALHA` | REV. 1 §18.1 | **Enumeração inferida.** AUD-003 exige o campo "resultado" mas **não enumera valores**. Mantido o campo; os valores passam a **catálogo documentado da aplicação**, não enum derivado de fonte (§22.2) |

### 2.3 Elementos mantidos, com a suspeita da revisão formalmente refutada

| Suspeita levantada na revisão | Veredito | Evidência |
| --- | --- | --- |
| `EM_ELABORACAO` seria **estado inventado** para viabilizar atomicidade | **REFUTADA — o estado é explícito nas fontes** | PRN-003 ("Estado inicial: `EM_ELABORACAO`"); PRN-004 ("Transição: `EM_ELABORACAO -> FINALIZADO`"); RN-023; `docs/03` §5.2; `docs/05` §3.2; `docs/06` §6.6 e §11.2. **Mantido sem alteração** — removê-lo é que contrariaria as fontes |
| Constraint de sobreposição do **mesmo paciente** seria criada "por parecer razoável" | **REFUTADA — há regra explícita** | **D-06**: "o sistema deve impedir sobreposição temporal de agendamentos do mesmo paciente"; RN-015.3; AGD-005 conflito 3 |
| FK `movimento_sessao → atendimento` violaria ownership modular | **MANTIDA COM PARECER** — não viola | §15 — análise em quatro camadas |

### 2.4 Observação de nomenclatura

`docs/03` §5.2 nomeia os estados da retificação como `RETIFICACAO_EM_ELABORACAO -> RETIFICACAO_EFETIVADA`, enquanto PRN-005 e `docs/06` §6.6 usam `EM_ELABORACAO -> EFETIVADA`. **As fontes divergem apenas na forma, não na semântica.** Esta proposta adota `EM_ELABORACAO/EFETIVADA` (forma de `docs/06`, documento homologado mais recente), em coluna **própria** de `retificacao_clinica`, o que elimina qualquer ambiguidade com o estado do registro. Registrado como divergência formal menor, sem impacto de regra.

---

## 3. Objetivo e escopo

### 3.1 Objetivo

Entregar uma proposta de **modelo físico/persistente do MVP** precisa o bastante para que a implementação de schema e migrations **não precise rediscutir regra de negócio**, e submetê-la à homologação com pareceres explícitos.

### 3.2 Escopo excluído

`schema.prisma`, DDL, migrations, código, API, DTOs, OpenAPI, frontend, infraestrutura, dependências. Também excluídas: decisões que pertencem à API (§28.3). Não introduzidos: microserviços, multitenancy, CQRS, event sourcing, filas, consistência eventual (TLF-BASE-V1 §4.6, §13).

> **Convenção de notação.** Ao longo do documento, expressões como `UNIQUE(...)`, `CHECK (...)` e `EXCLUDE ...` são **descrições conceituais da restrição**, não DDL a ser aplicado. Nenhum artefato executável é produzido nesta etapa.

---

## 4. Premissas herdadas da Etapa 2.1 (não reabertas)

| Decisão | Conteúdo | Materialização nesta proposta |
| --- | --- | --- |
| **H2-01** | `Agendamento` ≠ `Atendimento`; `1 → 0..1`; máquina operacional só no Agendamento | §7.5, §7.6, §10; `UNIQUE(agendamento_id)` em `atendimento`; `atendimento` sem coluna de estado |
| **H2-02** | M7 dono de Pacote, Reserva e Movimento; Reserva ≠ Movimento; 3 tipos de Movimento | §13 e §14 — tabelas distintas; enum de 3 valores |
| **H2-03** | Decomposição clínica, multiplicidade e aggregate root de `Atendimento` adiados (P-CLIN) | **PARCIALMENTE ENCERRADA em 19/08/2026** (§1.4): multiplicidade e decomposição **resolvidas** pela Alternativa A; **aggregate root de `Atendimento` permanece adiado** — H2-03 vigente apenas nesse aspecto residual |
| **H2-04** | Operações críticas síncronas e transacionais | §24 |
| **H2-05** | Consumo único por `(atendimento, pacote)`; falha do consumo impede finalização | §16 |
| **H2-06** | `Pacote` e `Cobrança` aggregate roots; `Atendimento` **não** | §17, §19 — a linha do root é o ponto de serialização. **Efeito de governança de P-CLIN sobre H2-06 declarado em §21.5** |
| **H2-07** | Pacote vinculado a exatamente um Serviço | §7.7, §17.4 |
| **H2-08** | Financeiro nunca cria/remove/devolve/ajusta sessão | §19.6 — verificação item a item |
| **H2-09** | Precedência `CANCELADO > EXPIRADO > ESGOTADO > ATIVO` | §12.3 — derivada, não persistida |
| **H2-10** | `AJUSTE_NEGATIVO` rejeitado se `saldo < reservas` | §17.4, §24 T-06 |
| **H2-11** | `ESTORNADO` não cancelada recebe novo pagamento e re-deriva | §19.4 |
| **H2-12** | `ESTORNADO` pode ser cancelada, preservando histórico | §19.4 |

---

## 5. Convenções físicas — **H2.2-01**

| Aspecto | Convenção | Fonte |
| --- | --- | --- |
| Tabelas / colunas | `snake_case`, singular; FKs `<entidade>_id` | convenção |
| Chave primária | `uuid` | TLF-BASE-V1 §9 |
| Instantes | `timestamptz` (UTC) | TLF-BASE-V1 §9; CFG-006; RN-060 |
| Datas civis | `date` | §22 |
| Horários locais recorrentes | `time` + `dia_semana` | CFG-002; PRO-003 |
| Monetário | `numeric(12,2)` — **nunca `float`/`double`** | RN-042; FIN-001..008 |
| Quantidades de sessão | `integer` | PKG-001 |
| Enums | tipos ENUM nativos, **somente** para conjuntos enumerados nas fontes | `docs/03` §5 |
| Conjuntos não enumerados nas fontes | `text` + catálogo documentado da aplicação | §22.2 |
| `criado_em` | `timestamptz NOT NULL` em toda tabela | RN-061 |
| `atualizado_em` | **somente** em tabelas mutáveis | RN-024; RN-044 |
| `deleted_at` | **não utilizado** — demonstrado conceito a conceito em §23 | RN-007 |

**Regra de disciplina adotada nesta revisão:** um conjunto de valores só vira `ENUM` se estiver **enumerado** em fonte homologada. Caso contrário é `text` com catálogo. Isso impede que a modelagem física congele vocabulário que o negócio ainda não fixou.

---

## 6. Estados armazenados × derivados

### 6.1 Classificação

| Valor | Classificação | Justificativa |
| --- | --- | --- |
| `agendamento.estado` | **ARMAZENADO com validação** | Fato registrado por comando (AGD-002/003/006/007/008); enumerado em `docs/03` §5.1 |
| `registro_clinico.estado` | **ARMAZENADO com validação** | PRN-003/PRN-004; `docs/03` §5.2 |
| `retificacao_clinica.estado` | **ARMAZENADO com validação** | PRN-005; RN-027 |
| `sessao_autenticacao.estado` | **ARMAZENADO com validação** | RN-004 |
| **Situação do Pacote** | **DERIVADA — não persistida** | §12.3; H2-09 |
| **Situação da Cobrança** | **DERIVADA — não persistida** | §19.4; RN-045/048 |
| `pacote.quantidade_contratada` | **ARMAZENADO** | é o contrato (PKG-001) |
| `saldo_de_direito`, `reservas_ativas`, `disponivel`, consumidas, ajustes | **CALCULADOS** | RN-030/031; I-22/I-23/I-24 |
| `recebido_liquido` | **CALCULADO** | RN-045 |
| `cobranca.valor_liquido` | **CALCULADO NA LINHA** (coluna gerada) | §19.2 |
| `cobranca.data_referencia` | **ARMAZENADO com regra de determinação e atualização** | §20 |
| `ativo`/`inativado_em` | **ARMAZENADO** | RN-007/008 |
| Indicadores IND-001..008 | **CALCULADOS sob demanda** | `H-06` |
| Recibo (FIN-007) | **DERIVADO** de `pagamento` | `H-05` |
| "Reserva ativa" | **DERIVADA de fato** (`encerrada_em IS NULL`) | §13.2 |

**Nenhum valor é simultaneamente armazenado e calculável.**

### 6.2 Análise de materialização — **H2.2-09** (revisada)

A revisão exigiu que a não-materialização **não** fosse defendida por princípio. Análise por estado:

**Pacote.** Fatos autoritativos: `quantidade_contratada`, movimentos, `cancelado_em`, `validade_ate`, data civil de referência. Determinístico: sim. Custo de leitura: um agregado sobre `movimento_sessao` filtrado por `pacote_id` (IDX-M1) — dezenas de linhas por pacote no MVP. **Risco se persistido: alto e qualitativamente diferente dos demais** — `EXPIRADO` é função do **tempo**, não de uma escrita. Uma coluna `situacao` fica objetivamente errada no instante em que `validade_ate` é ultrapassada sem que nenhuma transação toque a linha; corrigir exigiria job periódico, que o MVP não prevê (TLF-BASE-V1 §4.5). **Veredito: derivar. Não é preferência estética — é a única opção correta sem infraestrutura adicional.**

**Cobrança.** Fatos autoritativos: `valor_liquido`, pagamentos, estornos, `cancelada_em`. Determinístico: sim. Custo: agregado sobre `pagamento` + anti-join com `estorno`, ambos indexados, tipicamente 1–3 linhas por cobrança. Risco se persistido: divergência entre coluna e movimentos (risco `R-10` de `docs/06` §19). **Veredito: derivar no MVP.** Diferentemente do Pacote, aqui **a materialização seria tecnicamente defensável** — o estado só muda por escrita — e pode ser reavaliada se relatórios financeiros de grande volume exigirem. Registrado como caminho de evolução legítimo, **não** como rejeição de princípio.

---

## 7. Catálogo de entidades/tabelas candidatas

Notação: `PK`, `FK`, `NN` = `NOT NULL`, `U` = unicidade, `∅` = anulável.

### 7.1 M1 — Identity & Access

**`usuario`** — `id PK`; `email text NN U`; `senha_hash text NN`; `nome text NN`; `ativo boolean NN`; `inativado_em timestamptz ∅`; `inativado_por_usuario_id FK ∅`; `criado_em`; `atualizado_em`. *(AUT-001, AUT-005, RN-001, RN-007)*

**`papel`** / **`permissao`** — `id PK`; `codigo text NN U`; `nome text NN`. Códigos de permissão conforme catálogo de `docs/04` §5. *(AUT-003)*

**`usuario_papel`** / **`papel_permissao`** — PK composta. *(`docs/06` §9: `* — *`)*

**`sessao_autenticacao`** — `id PK`; `usuario_id FK NN`; `estado ENUM(ATIVA, EXPIRADA, REVOGADA) NN`; `criada_em`; `expira_em timestamptz NN`; `encerrada_em timestamptz ∅`; `revogada_por_usuario_id FK ∅`. *(AUT-002, RN-004)*

**`segredo_recuperacao_senha`** — `id PK`; `usuario_id FK NN`; `hash_segredo text NN`; `expira_em timestamptz NN`; `consumido_em timestamptz ∅`; `criado_por_usuario_id FK NN`. **O segredo em claro nunca é persistido.** *(AUT-004, D-04, RN-005, TLF-BASE-V1 §10)*

### 7.2 M2 — Clinic Configuration

**`clinica`** — `id PK`; `nome_cadastral text NN`; `nome_operacional text ∅`; endereço/contatos; `logotipo_chave text ∅`; **`fuso_horario text NN`** (identificador IANA); `duracao_padrao_atendimento_min integer ∅`. **Clínica única** garantida por restrição de linha única. *(CFG-001, TLF-BASE-V1 §5.2)*

**`horario_funcionamento`** — `id PK`; `clinica_id FK NN`; `dia_semana smallint NN` (0..6); `hora_inicio time NN`; `hora_fim time NN`; `CHECK (hora_fim > hora_inicio)`. *(CFG-002)*

**`servico`** — `id PK`; `clinica_id FK NN`; `nome text NN`; `duracao_min integer NN`; `preco_referencia numeric(12,2) NN`; `ativo boolean NN`; `inativado_em timestamptz ∅`. **O preço de referência nunca reescreve cobrança histórica** (CFG-003) — a cobrança copia o valor na criação. *(CFG-003, RN-008)*

**`forma_pagamento`**, **`motivo_cancelamento`** — `id PK`; `clinica_id FK NN`; descrição; `ativo boolean NN`; `inativado_em timestamptz ∅`. *(CFG-004, CFG-005, RN-007)*

### 7.3 M3 — Professionals

**`profissional`** — `id PK`; `usuario_id FK ∅ U`; `nome text NN`; `registro_profissional text ∅`; `ativo boolean NN`; `inativado_em timestamptz ∅`. *(PRO-001, PRO-005)*

**`especialidade`**; **`profissional_especialidade`**; **`profissional_servico`** (PK composta — a existência da linha **é** a condição de elegibilidade de PRO-004/RN-013).

**`disponibilidade_profissional`** — `id PK`; `profissional_id FK NN`; `dia_semana smallint NN`; `hora_inicio time NN`; `hora_fim time NN`; `vigencia_inicio date ∅`; `vigencia_fim date ∅`. Mudanças criam novas vigências; **não reescrevem atendimentos passados** (PRO-003).

### 7.4 M4 — Patients

**`paciente`** — `id PK`; `nome text NN`; `data_nascimento date ∅`; **`cpf text ∅ U`** — armazenado **normalizado (11 dígitos, sem máscara)**, com `CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')`; contatos; `ativo boolean NN`; `inativado_em timestamptz ∅`. *(PAC-001, PAC-003, PAC-006, RN-010; `H2.2-13` homologada)* — §11.4.

**`contato_emergencia`** (`1 — 0..*`); **`responsavel_legal`** (`paciente_id FK NN U` → `1 — 0..1`); **`consentimento`** (evidência operacional; conteúdo jurídico é pendência — PAC-005, `D2.1-11`); **`observacao_administrativa`** (`paciente_id`, `texto`, `autor_usuario_id`, `criado_em`).

> **Limite reconhecido:** RN-009/PAC-007 (segregação administrativo × clínico) **não é enforçável por schema** — nenhuma constraint detecta conteúdo clínico redigido em texto livre. É regra de aplicação, autorização e treinamento. Risco `R2.2-05`.

### 7.5 M5 — Scheduling

**`agendamento`**

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `paciente_id`, `profissional_id`, `servico_id` | `FK NN` | AGD-001, RN-013 |
| `inicio`, `fim` | `timestamptz NN` | `CHECK (fim > inicio)` |
| `estado` | `ENUM(AGENDADO, CONFIRMADO, AGUARDANDO, EM_ATENDIMENTO, CONCLUIDO, FALTA, CANCELADO) NN` | `docs/03` §5.1 |
| `modalidade` | `ENUM(AVULSO, PACOTE) NN` | AGD-001 |
| `pacote_id` | `FK pacote ∅` | `Agendamento → 0..1 Pacote` |
| `motivo_cancelamento_id` | `FK ∅` | AGD-003 |
| `cancelado_em`, `cancelado_por_usuario_id` | `∅` | |
| `criado_por_usuario_id` | `FK NN` | AGD-009 |
| `criado_em`, `atualizado_em` | | |

`CHECK ((modalidade = 'PACOTE') = (pacote_id IS NOT NULL))`.

**`bloqueio_agenda`** — `id PK`; `profissional_id FK NN`; `inicio`/`fim timestamptz NN`; `motivo text ∅`; `criado_por_usuario_id FK NN`. *(AGD-004)*

**`historico_agendamento`** — **append-only**; `id PK`; `agendamento_id FK NN`; **`operacao text NN`** (catálogo documentado — **não enum**, pois AGD-009 não enumera operações); `estado_anterior`/`estado_novo ENUM ∅`; `inicio_anterior`/`fim_anterior`/`inicio_novo`/`fim_novo timestamptz ∅`; `ator_usuario_id FK NN`; `ocorrido_em timestamptz NN`; `motivo_cancelamento_id FK ∅`. *(AGD-009, RN-017)*

### 7.6 M6 — Clinical Care & Records

**`atendimento`** — `id PK`; **`agendamento_id FK NN U`**; `paciente_id FK NN`; `iniciado_em timestamptz NN`; `criado_em`.

- `U` sobre `agendamento_id` materializa **H2-01** (`Agendamento 1 → 0..1 Atendimento`).
- **Sem coluna de estado** — a máquina operacional é exclusiva do Agendamento (H2-01, I-21b).
- **Sem `pacote_id`** — o vínculo mora só no agendamento (**H2.2-12**, §17.4).
- **Sem `profissional_id`** — removido na REV. 2 por duplicar fonte de verdade (§2.2). `docs/06` §6.6 declara que o Atendimento referencia **Agendamento e Paciente**.

**`registro_clinico`** — `id PK`; **`atendimento_id FK atendimento NN U`** — **P-CLIN Alternativa A, homologada**; `paciente_id FK NN`; `autor_usuario_id FK NN`; `estado ENUM(EM_ELABORACAO, FINALIZADO) NN`; `finalizado_em timestamptz ∅`; `criado_em`; **componentes clínicos** (avaliação, plano, evolução e demais elementos de PRN-002/PRN-003) — **estrutura interna de campos permanece pendente de definição clínica (`P2.2-07`)**.
`CHECK ((estado = 'FINALIZADO') = (finalizado_em IS NOT NULL))`. *(PRN-003, PRN-004, RN-024; P-CLIN homologada)*

> **Leitura de `NN U`:** a coluna é obrigatória e única **no lado do registro**, o que materializa `Atendimento 1 → 0..1 Registro clínico`. Um atendimento pode existir sem registro (encontro iniciado e ainda não documentado); um registro nunca existe sem atendimento. **A decomposição é por componentes do registro, não por múltiplas linhas** (TLF-BASE-V1 §7 passos 7–8; §8 "não obriga uma tabela por item").

**`retificacao_clinica`** — `id PK`; `registro_original_id FK NN`; `autor_usuario_id FK NN`; `justificativa text NN` com `CHECK` de não-vazio; `estado ENUM(EM_ELABORACAO, EFETIVADA) NN`; `efetivada_em timestamptz ∅`; **conteúdo retificador** — estrutura de campos espelha a do `registro_clinico` e permanece **pendente de definição clínica (`P2.2-07`)**, não de P-CLIN. *(PRN-005, RN-025..028, D-01)*

**`anexo_clinico`** — `id PK`; **`registro_clinico_id FK NN`** — âncora **resolvida** pela homologação de P-CLIN (com `1 — 0..1` entre atendimento e registro, ancorar no registro é equivalente a ancorar no atendimento e mantém uma única fronteira de autorização); `paciente_id FK NN`; `chave_objeto text NN`; `nome_original`; `mime_type`; `tamanho_bytes`; `enviado_por_usuario_id FK NN`; `criado_em`. **Nenhuma URL pública persistida.** *(PRN-006, RN-064; P-CLIN homologada)*

### 7.7 M7 — Packages / Sessions

**`pacote`** — aggregate root (H2-06).

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `paciente_id` | `FK NN` | |
| `servico_id` | `FK NN` | **H2-07** |
| `quantidade_contratada` | `integer NN CHECK > 0` | PKG-001 |
| `data_contratacao` | `date NN` | civil; base de RN-068 para pacote |
| `validade_ate` | `date ∅` | validade opcional |
| `cancelado_em`, `cancelado_por_usuario_id`, `motivo_cancelamento` | `∅` | entradas da derivação (H2-09) |
| `criado_por_usuario_id` | `FK NN` | |
| `criado_em`, `atualizado_em` | | |

**Sem coluna `situacao`** (§6.2). **Sem coluna de saldo** (RN-030).

**`reserva_sessao`** — §13. **`movimento_sessao`** — §14.

### 7.8 M8 — Finance

**`cobranca`**, **`pagamento`**, **`estorno`** — §19. **Recibo:** derivado, sem tabela no MVP (`H-05`, FIN-007) — reavaliar se numeração sequencial for exigida (`P2.2-02`).

### 7.9 M9 / M10

**M9 — nenhuma tabela** (`D2.1-03`; somente leitura). Limiares de D-05 em configuração documentada, não em tabela (IND-007).
**M10 — `evento_auditoria`** — §22.2.

---

## 8. Relacionamentos e cardinalidades físicas

Derivados **exclusivamente** de `docs/06` §9. Onde a Etapa 2.1 não fixou multiplicidade, esta proposta **não inventa**.

| Relação | Cardinalidade homologada | Materialização |
| --- | --- | --- |
| Clínica → Serviço / Forma pagto / Motivo / Horário | `1 — *` | FK `clinica_id NN` |
| Usuário ↔ Papel; Papel ↔ Permissão; Profissional ↔ Especialidade/Serviço | `* — *` | junção com PK composta |
| Usuário → Sessão; Profissional → Disponibilidade | `1 — *` | FK `NN` |
| Paciente → Contato emergência / Consentimento | `1 — 0..*` | FK `NN` |
| Paciente → Responsável legal | `1 — 0..1` | FK `NN` + `UNIQUE` |
| Paciente / Profissional / Serviço → Agendamento | `1 — *` | FKs `NN` |
| **Agendamento → Pacote** | `0..1` | `agendamento.pacote_id ∅` |
| **Pacote → Agendamentos** | `0..*` | inverso; **sem unicidade** |
| **Serviço → Pacote** | `1 → 0..*` | `pacote.servico_id NN` (H2-07) |
| Paciente → Pacote | `1 — *` | `pacote.paciente_id NN` |
| **Pacote → Reserva de Sessão** | `1 — *` | `reserva_sessao.pacote_id NN` |
| **Agendamento → Reserva de Sessão** | `1 — 0..1` | `reserva_sessao.agendamento_id NN` + **único parcial sobre reservas não encerradas** (§13.4) |
| **Pacote → Movimento de Sessão** | `1 — *` | `movimento_sessao.pacote_id NN` |
| **Atendimento → Movimento de CONSUMO** | `1 — 0..1` por pacote | único parcial `WHERE tipo='CONSUMO'` (§16) |
| **Agendamento → Atendimento** | `1 — 0..1` | `atendimento.agendamento_id NN U` (H2-01) |
| **Atendimento → Registro clínico** | **`1 — 0..1`** — **P-CLIN Alternativa A, HOMOLOGADA** | `registro_clinico.atendimento_id NN` + **`UNIQUE`** (U-13) — §21 |
| **Registro clínico → Anexo clínico** | `1 — 0..*` | `anexo_clinico.registro_clinico_id NN` |
| Paciente → Registro clínico | `1 — *` | `registro_clinico.paciente_id NN` |
| Registro clínico → Retificação / Anexo | `1 — 0..*` | FK no lado `*` |
| Paciente → Cobrança | `1 — *` | `cobranca.paciente_id NN` |
| **Cobrança → origem funcional** | exatamente uma origem; **inversa adiada** | `origem_tipo` + colunas exclusivas (§19.1); **nenhuma unicidade inversa** |
| Cobrança → Pagamento | `1 — *` | `pagamento.cobranca_id NN` |
| Pagamento → Estorno | `1 — 0..1` | `estorno.pagamento_id NN U` (§19.3) |
| Operação sensível → Evento de auditoria | `1 — 1..*` | `(alvo_tipo, alvo_id)` + `correlacao_id` |

---

## 9. Chaves e foreign keys

### 9.1 Chaves primárias

`uuid` em toda entidade; PK composta apenas nas junções puras (TLF-BASE-V1 §9). A escolha entre geração na aplicação ou no banco, e entre UUID aleatório ou ordenado por tempo, **não afeta regra de negócio**; registrada apenas a observação de fragmentação de índice em `evento_auditoria`, irrelevante no volume do MVP (`R2.2-13`).

### 9.2 Política de `ON DELETE`

**`RESTRICT`/`NO ACTION` em todas as FKs.** Nenhuma entidade é apagada fisicamente pelo fluxo do MVP (§23); `CASCADE` seria destruição silenciosa incompatível com RN-007, RN-024, RN-044, RN-066 e TLF-BASE-V1 §4.4.

---

## 10. Constraints e unicidades

### 10.1 Unicidades que são invariantes de negócio

| # | Constraint | Regra |
| --- | --- | --- |
| U-01 | `usuario.email` | AUT-001 |
| U-02 | `atendimento.agendamento_id` | **H2-01** |
| U-03 | `movimento_sessao (atendimento_id, pacote_id)` **parcial** `WHERE tipo='CONSUMO'` | **H2-05**, RN-034, I-26 — §16 |
| U-04 | `reserva_sessao (agendamento_id)` **parcial** `WHERE encerrada_em IS NULL` | D-07; `Agendamento — Reserva 1 — 0..1` — §13.4 |
| U-05 | `estorno.pagamento_id` | **HOM-03**, RN-048, RN-069 — §19.3 |
| U-06 | `responsavel_legal.paciente_id` | `docs/06` §9 |
| U-07 | `paciente.cpf` (anulável) | PAC-003, RN-010 — §11.4 |
| U-08 | `profissional.usuario_id` (anulável) | PRO-001 |
| U-09/U-10 | `pagamento.chave_idempotencia`, `estorno.chave_idempotencia` (anuláveis) | C-06, RN-065 |
| U-11 | `permissao.codigo`, `papel.codigo` | `docs/04` §5 |
| U-12 | `reserva_sessao.movimento_consumo_id` (anulável) | um consumo resolve no máximo uma reserva |
| **U-13** | **`registro_clinico.atendimento_id`** | **P-CLIN Alternativa A homologada** — `Atendimento 1 → 0..1 Registro clínico`; torna a primeira finalização válida única por construção (HOM-04, RN-070) |

**Comportamento de `NULL` em índice único (PostgreSQL):** valores `NULL` são tratados como **distintos entre si** por padrão. É o que permite que U-07, U-09, U-10 e U-12 convivam com múltiplas linhas nulas. Comportamento padrão e estável; o modificador `NULLS NOT DISTINCT`, quando disponível, **não deve ser usado** aqui.

### 10.2 CHECK constraints

| Tabela | CHECK | Regra |
| --- | --- | --- |
| `agendamento` | `fim > inicio`; `(modalidade='PACOTE') = (pacote_id IS NOT NULL)` | AGD-001, PKG-003 |
| `bloqueio_agenda` | `fim > inicio` | AGD-004 |
| `movimento_sessao` | `quantidade > 0` | RN-031 — sinal vem do `tipo` |
| `movimento_sessao` | `(tipo='CONSUMO') = (atendimento_id IS NOT NULL)` | RN-033/034 — **sustenta U-03** |
| `movimento_sessao` | `tipo <> 'CONSUMO' OR quantidade = 1` | PKG-005 |
| `movimento_sessao` | `tipo='CONSUMO' OR justificativa` não-vazia | RN-038, PKG-007 |
| `reserva_sessao` | `(encerrada_em IS NULL) = (motivo_encerramento IS NULL)` | §13.2 |
| `reserva_sessao` | `(motivo_encerramento='CONSUMO') = (movimento_consumo_id IS NOT NULL)` | §13.2 |
| `pacote` | `quantidade_contratada > 0`; coerência de cancelamento | PKG-001 |
| `cobranca` | `valor_bruto >= 0`; `valor_desconto >= 0`; **`valor_bruto - valor_desconto >= 0`** | **RN-042** |
| `cobranca` | coerência `origem_tipo` × colunas de origem | `docs/06` §9 |
| `pagamento` | `valor > 0` | FIN-004 |
| `paciente` | `cpf IS NULL OR cpf ~ '^[0-9]{11}$'` | **`H2.2-13` homologada** — garante a forma normalizada sobre a qual a unicidade incide (§11.4.1) |
| `registro_clinico` | `(estado='FINALIZADO') = (finalizado_em IS NOT NULL)` | RN-024, PRN-004 |
| `retificacao_clinica` | `(estado='EFETIVADA') = (efetivada_em IS NOT NULL)`; justificativa não-vazia | RN-027, D-01 |
| `horario_funcionamento`, `disponibilidade_profissional` | `hora_fim > hora_inicio`; `dia_semana` 0..6 | CFG-002, PRO-003 |
| `sessao_autenticacao` | `expira_em > criada_em` | AUT-002 |

---

## 10-A. Índices

Somente índices justificados por **unicidade, integridade, prevenção de conflito ou consulta funcional já prevista** em fonte homologada. **Nenhuma otimização especulativa.** As chaves primárias e as unicidades de §10.1 já criam índices e não são repetidas.

| ID | Tabela | Índice | Motivo | Requisito/regra |
| --- | --- | --- | --- | --- |
| IDX-A1 | `agendamento` | **exclusion** `(profissional_id =, intervalo &&)` sobre estados que ocupam o horário | Prevenção de conflito **e** leitura da agenda por profissional/período | AGD-005, RN-015.1, C-01 |
| IDX-A2 | `agendamento` | **exclusion** `(paciente_id =, intervalo &&)` sobre os mesmos estados | Conflito do mesmo paciente | **D-06**, RN-015.3 |
| IDX-A3 | `agendamento` | `btree (inicio)` | Visão diária/semanal da clínica | AGD-001, IND-001/002 |
| IDX-A4 | `agendamento` | `btree (pacote_id)` parcial, onde não nulo | Localizar agendamentos do pacote (cenário 13.6) | HOM-05, RN-071 |
| IDX-A5 | `bloqueio_agenda` | `btree (profissional_id, inicio, fim)` | Detecção de sobreposição com bloqueio | RN-015.2, AGD-004 |
| IDX-A6 | `historico_agendamento` | `btree (agendamento_id, ocorrido_em)` | Reconstrução do histórico | AGD-009 |
| IDX-R1 | `reserva_sessao` | `btree (pacote_id)` parcial, onde `encerrada_em IS NULL` | `reservas_ativas` — lido em T-01 e T-06 | D-07, I-24, H2-10 |
| IDX-R2 | `reserva_sessao` | **único** `(agendamento_id)` parcial, onde `encerrada_em IS NULL` | Reserva ativa única por agendamento (U-04) | §13.4 |
| IDX-R3 | `reserva_sessao` | `btree (agendamento_id)` | Encerramento em T-08; histórico | RN-036, RN-037 |
| IDX-M1 | `movimento_sessao` | `btree (pacote_id, tipo)` | Cálculo de `saldo_de_direito` | RN-031, I-23 |
| IDX-M2 | `movimento_sessao` | **único parcial** `(atendimento_id, pacote_id)` onde `tipo='CONSUMO'` | **Consumo único** (U-03) | **H2-05**, RN-034 |
| IDX-P1 | `pacote` | `btree (paciente_id)` | Pacotes elegíveis do paciente em T-01 | PKG-003 |
| IDX-P2 | `pacote` | `btree (validade_ate)` parcial, onde não cancelado | Pacotes próximos do término (validade ≤ 30 dias) | IND-007, D-05, RN-058 |
| IDX-C1 | `cobranca` | `btree (paciente_id)` | Cobranças do paciente | FIN-008 |
| IDX-C2 | `cobranca` | `btree (data_referencia)` parcial, onde não cancelada | **Receita prevista por período** | IND-005, RN-068, HOM-02 |
| IDX-F1 | `pagamento` | `btree (cobranca_id)` | Derivação da situação; FK | RN-045 |
| IDX-F2 | `pagamento` | `btree (recebido_em)` | **Receita recebida por período** | IND-006, RN-056 |
| IDX-F3 | `pagamento` | `btree (forma_pagamento_id)` | Relatório por forma de pagamento | FIN-008 |
| IDX-F4 | `estorno` | **único** `(pagamento_id)` | Estorno integral e único (U-05) | HOM-03, RN-069 |
| IDX-N1 | `registro_clinico` | `btree (paciente_id, criado_em)` | Histórico clínico cronológico | PRN-001 |
| IDX-N2 | `registro_clinico` | **único** `(atendimento_id)` | **U-13** — P-CLIN Alternativa A; serve também à localização do registro em T-02 | PRN-004, RN-070; P-CLIN |
| IDX-N3 | `retificacao_clinica` | `btree (registro_original_id)` | Cadeia de retificação | RN-025/026 |
| IDX-N4 | `anexo_clinico` | `btree (registro_clinico_id)` | Anexos do registro | PRN-006 |
| IDX-U1 | `evento_auditoria` | `btree (alvo_tipo, alvo_id, ocorrido_em)` | Investigação por recurso | AUD-004 |
| IDX-U2 | `evento_auditoria` | `btree (ator_usuario_id, ocorrido_em)` | Investigação por ator | AUD-004, RN-061 |
| IDX-U3 | `evento_auditoria` | `btree (correlacao_id)` | Reconstrução de uma operação | §22.3 |
| IDX-S1 | `sessao_autenticacao` | `btree (usuario_id, estado)` | Revogação em massa | AUT-002, RN-001/005, T-07 |

**Deliberadamente ausentes:** índice de busca textual em `paciente.nome` — PAC-002 não define o mecanismo de busca, que é decisão da etapa de API/consulta; índices de cobertura; qualquer índice adicional para IND-008 além do já existente em `agendamento`.

---

## 11. Auditoria de invenções — resultado

Conforme exigido, a verificação foi **semântica**, não apenas nominal.

### 11.1 Enumerações confrontadas com as fontes

| Enum proposto | Fonte que o enumera | Veredito |
| --- | --- | --- |
| `agendamento.estado` (7 valores) | `docs/03` §5.1; TLF-BASE-V1 §5.5 | **Fundamentado** |
| `registro_clinico.estado` (`EM_ELABORACAO`, `FINALIZADO`) | PRN-003, PRN-004, RN-023, `docs/03` §5.2 | **Fundamentado** (§2.3) |
| `retificacao_clinica.estado` | PRN-005, `docs/06` §6.6 | **Fundamentado**; divergência de forma em §2.4 |
| `sessao_autenticacao.estado` | `docs/03` §5.3, RN-004 | **Fundamentado** |
| `movimento_sessao.tipo` (3 valores) | **H2-02** (explícito e fechado) | **Fundamentado** |
| `agendamento.modalidade` (`AVULSO`, `PACOTE`) | AGD-001 ("modalidade avulsa/pacote") | **Fundamentado** |
| `cobranca.origem_tipo` (3 valores) | `docs/06` §9 ("agendamento/atendimento avulso, Pacote, ou cobrança administrativa") | **Fundamentado** |
| `reserva_sessao.motivo_encerramento` (`CANCELAMENTO`, `FALTA`, `DESVINCULACAO`, `CONSUMO`) | PKG-004 ("cancelamento, falta ou desvinculação válida"; "conversão de reserva"); D-07 | **Fundamentado** |
| ~~`reserva_sessao.situacao`~~ | — | **REMOVIDO** (§2.2) |
| ~~`evento_auditoria.resultado` como enum fechado~~ | AUD-003 cita o campo, **não enumera valores** | **REMOVIDO como enum**; vira catálogo `text` |
| ~~`historico_agendamento.operacao` como enum fechado~~ | AGD-009 cita "operação", **não enumera** | **REMOVIDO como enum**; vira catálogo `text` |

### 11.2 Obrigatoriedades e cardinalidades confrontadas

| Item | Veredito |
| --- | --- |
| `atendimento.agendamento_id NN U` | **Fundamentado** — H2-01, `docs/06` §9 |
| `atendimento.paciente_id NN` | **Fundamentado** — `docs/06` §6.6 declara referência a Agendamento **e** Paciente |
| ~~`atendimento.profissional_id NN`~~ | **REMOVIDO** — sem fonte; duplicaria `agendamento.profissional_id` (§2.2) |
| `registro_clinico.paciente_id NN` | **Fundamentado** — `docs/06` §9 (`Paciente — Registro clínico 1 — *`) e PRN-001 (histórico cronológico do paciente). Denormalização assumida e justificada, não redundância acidental |
| `registro_clinico.atendimento_id NN U` | **HOMOLOGADO** — P-CLIN Alternativa A (19/08/2026). Sustentado por TLF-BASE-V1 §7 passos 7–8, FC-05 passo 2, `docs/06` §6.6 e HOM-04/RN-070 (§21.3) |
| `anexo_clinico.registro_clinico_id NN` | **HOMOLOGADO** — âncora resolvida por P-CLIN (§7.6) |
| Cobrança ← origem: **sem** unicidade inversa | **Correto** — `docs/06` §9 adiou explicitamente a inversa; nenhum `1:1` inventado |
| `pacote.servico_id NN` | **Fundamentado** — H2-07 |

### 11.3 Regras transacionais confrontadas

Todas as transações de §24 correspondem a `T-01`..`T-09` de `docs/06` §12. **Nenhuma fronteira transacional nova foi criada.** Nenhuma transação atravessa M7 e M8 (H2-08).

### 11.4 `UNIQUE` em `paciente.cpf` — **H2.2-13** (parte)

**Tensão examinada.** RN-011/RN-012 proíbem **merge automático** e **decisão automática de identidade**. Uma `UNIQUE` **não faz merge** — ela rejeita a segunda criação, forçando o operador a localizar o cadastro existente. Isso é exatamente o "tratamento explícito" de PAC-003 e a exceção "CPF já associado de forma conflitante" de PAC-001.

Detecção por nome/data permanece **exclusivamente aplicacional, sem constraint**, porque RN-012 proíbe decisão automática em casos ambíguos.

### 11.4.1 Normalização do CPF — exigência homologada

A homologação de 19/08/2026 acrescentou a **normalização** como requisito, e não como detalhe de implementação. Consequências físicas:

1. **Forma canônica persistida.** `paciente.cpf` armazena **somente os 11 dígitos**, sem pontuação, sem espaços e sem máscara. A formatação é responsabilidade exclusiva da apresentação.
2. **A unicidade incide sobre a forma normalizada.** Como a coluna já guarda apenas a forma canônica, `UNIQUE(cpf)` sobre a própria coluna é suficiente — **não** é necessário índice sobre expressão. `111.444.777-35` e `11144477735` tornam-se o mesmo valor **antes** de chegar ao banco, e portanto colidem.
3. **Garantia de forma no banco.** `CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')` impede que qualquer caminho de escrita insira valor não normalizado, o que **preservaria a unicidade apenas por acidente**. Esta `CHECK` é o que impede que a exigência dependa unicamente da aplicação (RN-002).
4. **Validação de dígito verificador** é regra de aplicação (PAC-001/PAC-003), **não** constraint — o banco garante a forma; a aplicação garante a validade.
5. **`NULL` permanece permitido e múltiplo** — o CPF é opcional (RN-010) e `NULL`s não colidem em índice único (§10.1).

### 11.4.2 Pacientes inativos e a unicidade — regra homologada

**Pacientes inativos permanecem integralmente abrangidos pela unicidade.** O CPF de um paciente inativado **não é liberado para reuso**.

Consequência operacional determinada pela homologação: ao tentar cadastrar alguém cujo CPF já pertence a um paciente inativo, o fluxo correto é **localizar e reativar** o cadastro existente — **nunca** criar nova identidade. Isso é coerente com PAC-006 (inativação não apaga histórico), RN-007 (inativação preserva histórico) e RN-011/RN-012 (não fragmentar identidade). Fragmentar o prontuário em duas identidades para a mesma pessoa seria pior do que qualquer inconveniente de reativação.

**Responsabilidade de camada:** o banco **rejeita** a duplicata; a aplicação **deve** transformar essa rejeição em fluxo de localização/reativação, e não em mensagem de erro genérica — caso contrário a regra vira obstáculo em vez de proteção. O escopo dessa apresentação pertence à etapa de API/UX; a garantia de unicidade pertence a esta etapa.

---

## 12. Pacote — derivação de saldo e situação

### 12.1 Fórmulas (I-23, I-24, H2-09)

```
saldo_de_direito =
      pacote.quantidade_contratada
    + Σ movimento_sessao.quantidade  onde tipo = 'AJUSTE_POSITIVO'
    − Σ movimento_sessao.quantidade  onde tipo = 'AJUSTE_NEGATIVO'
    − Σ movimento_sessao.quantidade  onde tipo = 'CONSUMO'

reservas_ativas =
      COUNT(reserva_sessao) onde pacote_id = P e encerrada_em IS NULL

disponivel_para_novos_agendamentos =
      saldo_de_direito − reservas_ativas
```

### 12.2 Classificação dos valores de PKG-006

| Valor exibido | Classificação | Origem |
| --- | --- | --- |
| contratadas | **PERSISTIDO** | `pacote.quantidade_contratada` |
| agendadas | **CALCULADO** | `reservas_ativas` |
| realizadas | **CALCULADO** | `Σ quantidade WHERE tipo='CONSUMO'` |
| canceladas | **CALCULADO** | `COUNT(reserva_sessao WHERE encerrada_em IS NOT NULL AND motivo_encerramento <> 'CONSUMO')` |
| restantes | **CALCULADO** | `disponivel_para_novos_agendamentos` |

**Cache/projeção: não necessário no MVP.** Atende literalmente PKG-006 ("valores são reproduzíveis a partir do histórico de reservas, movimentos e atendimentos").

### 12.3 Situação por precedência (H2-09)

```
situacao(P, data_civil_de_referencia) =
      CANCELADO   se P.cancelado_em IS NOT NULL
      EXPIRADO    senão se P.validade_ate IS NOT NULL
                          e data_civil_de_referencia > P.validade_ate
      ESGOTADO    senão se saldo_de_direito = 0
      ATIVO       caso contrário
```

O retorno `ESGOTADO → ATIVO` após `AJUSTE_POSITIVO` suficiente (I-30b) é automático numa derivação.

**`data_civil_de_referencia` é parâmetro obrigatório, nunca "hoje" implícito.** Para exibição, é a data corrente no fuso da clínica. Para **elegibilidade de agendamento/remarcação, é a data civil do atendimento agendado** — HOM-05 e RN-071 são explícitos. Consequência de concorrência relevante em §25, cenário 11.

---

## 13. Reserva de Sessão — modelo físico — **H2.2-02** (revisada)

### 13.1 Revisão crítica da REV. 1

A revisão questionou se `ATIVA/LIBERADA/CONSUMIDA` eram domínio ou invenção. **O vocabulário é de domínio** — D-07.5 ("reservas ativas"), D-07.3/PKG-004 ("liberação: cancelamento, falta ou desvinculação"), PKG-004 ("conversão de reserva"), `docs/06` §6.7 ("criada, liberada, resolvida"). Portanto **não eram invenção semântica**.

**Porém, a codificação era redundante:** `situacao` e `motivo_encerramento` representavam o mesmo fato em duas colunas, mantidas coerentes por `CHECK`. A REV. 2 elimina o enum e representa a reserva por **fatos**, o que torna a combinação inválida "consumida mas não encerrada" **irrepresentável** em vez de meramente proibida.

### 13.2 Tabela

**`reserva_sessao`**

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `pacote_id` | `FK pacote NN` | H2-02 |
| `agendamento_id` | `FK agendamento NN` | `docs/06` §6.7 |
| `criada_em` | `timestamptz NN` | |
| `criada_por_usuario_id` | `FK NN` | |
| `encerrada_em` | `timestamptz ∅` | **`NULL` ⇔ reserva ativa** |
| `motivo_encerramento` | `ENUM(CANCELAMENTO, FALTA, DESVINCULACAO, CONSUMO) ∅` | PKG-004, D-07 |
| `movimento_consumo_id` | `FK movimento_sessao ∅ U` | identifica **qual** consumo resolveu esta reserva |

**CHECKs:** `(encerrada_em IS NULL) = (motivo_encerramento IS NULL)`; `(motivo_encerramento = 'CONSUMO') = (movimento_consumo_id IS NOT NULL)`.

**Respostas diretas às perguntas da revisão:**

- **Enum de situação é necessário?** Não. `encerrada_em IS NULL` define "ativa"; `motivo_encerramento` distingue como terminou.
- **Liberação e consumo são mutuamente exclusivos?** Sim — e a exclusividade passa a ser **estrutural**, não uma regra a validar: são valores distintos de uma **única** coluna `motivo_encerramento`. Uma reserva não pode estar simultaneamente liberada por cancelamento e resolvida por consumo, porque a coluna comporta um só valor.
- **Reserva consumida continua identificável como origem do consumo?** Sim — `movimento_consumo_id`, com `U` garantindo que um consumo resolve no máximo uma reserva (PKG-006).
- **PK.** `uuid` própria; **não** `(pacote_id, agendamento_id)`, pois o mesmo par pode repetir no histórico (reservar → desvincular → re-reservar).

### 13.3 Ciclo de vida

```
   (T-01: agendamento de pacote criado / pacote vinculado)
                        |
                        v
                     ATIVA  ( encerrada_em IS NULL )
                        |
        ┌───────────────┴────────────────┐
        │                                │
 cancelamento (RN-036)            primeira finalização
 falta (RN-037)                   válida do registro
 desvinculação (13.6, HOM-05)     clínico (T-02)
        │                                │
        v                                v
 ENCERRADA                        ENCERRADA
 motivo: CANCELAMENTO |           motivo: CONSUMO
         FALTA | DESVINCULACAO    movimento_consumo_id NN
```

Encerramento é **terminal e irreversível**; a linha **nunca é apagada** (PKG-006). Re-reserva do mesmo agendamento é **nova linha**. Esta é a única mutação permitida na tabela — append de linhas + write-once do encerramento.

### 13.4 Unicidade — **H2.2-03**

**Índice único parcial sobre `(agendamento_id)` onde `encerrada_em IS NULL`.**

**Por que por agendamento e não por `(agendamento, pacote)`:** `docs/06` §9 fixa `Agendamento — Reserva de Sessão 1 — 0..1`. A chave `(agendamento, pacote)` permitiria que um mesmo agendamento mantivesse duas reservas ativas em pacotes diferentes — violando a cardinalidade homologada e reservando duas sessões para um único compromisso. **Por agendamento é a única opção compatível com a fonte.**

Isso impede reserva duplicada sob duplo clique, retry e requisições concorrentes, e preserva o histórico (o que uma `UNIQUE` total impediria).

### 13.5 Comportamentos exigidos

| Evento | Comportamento | Fonte |
| --- | --- | --- |
| **Remarcação** | **A reserva não é alterada.** Ela referencia o Agendamento, não o intervalo. Exceção: se o novo horário tornar o pacote inelegível (validade avaliada na **nova** data do atendimento), a operação é rejeitada ou exige desvinculação explícita | `docs/05` §13.1 passos 4–5; HOM-05; RN-071; RN-016 |
| **Cancelamento** | T-08: agendamento → `CANCELADO` **e** reserva encerrada com motivo `CANCELAMENTO`, mesma transação. **Nenhum movimento criado** | RN-036, I-28, `docs/05` §13.2 |
| **Falta** | T-08: agendamento → `FALTA` **e** reserva encerrada com motivo `FALTA`. **Nenhum movimento criado** | RN-037, `docs/05` §13.3 |
| **Consumo** | T-02: reserva encerrada com motivo `CONSUMO` e `movimento_consumo_id` preenchido | D-07.4, PKG-004 |
| **Pacote cancelado com reserva prévia** | **Nenhum efeito automático sobre a reserva nem sobre o agendamento.** O vínculo torna-se inelegível e deve ser resolvido explicitamente antes da finalização clínica — por outro pacote elegível (nova reserva) ou como avulso (desvinculação) | **HOM-05**, RN-071, I-29, `docs/05` §13.6 |

O último caso é o que preserva HOM-05: liberar ou consumir automaticamente seria a "baixa silenciosa" que `docs/05` §13.6 proíbe.

---

## 14. Movimento de Sessão — **H2.2-04** (parte)

**`movimento_sessao`** — **append-only**.

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `pacote_id` | `FK pacote NN` | H2-02 |
| `tipo` | `ENUM(CONSUMO, AJUSTE_POSITIVO, AJUSTE_NEGATIVO) NN` | **exatamente os 3 de H2-02** |
| `quantidade` | `integer NN CHECK > 0` | **sinal vem do `tipo`, nunca do valor** |
| `atendimento_id` | `FK atendimento ∅` | **obrigatório sse `tipo='CONSUMO'`** |
| `usuario_responsavel_id` | `FK usuario NN` | quem finalizou (CONSUMO) ou quem ajustou (PKG-008) |
| `justificativa` | `text ∅` | **obrigatória sse ajuste** (RN-038) |
| `criado_em` | `timestamptz NN` | |
| `chave_idempotencia` | `text ∅ U` | comandos de ajuste repetidos (C-06) |

**Sem `atualizado_em`, sem `deleted_at`, sem `UPDATE`, sem `DELETE`** (RN-039, PKG-008).

**Verificação exigida pela revisão — nenhum mecanismo reintroduz `RESERVA`/`LIBERACAO_RESERVA` como tipo de movimento:**
- o enum tem exatamente 3 valores, fechado;
- reserva vive em **tabela separada** (§13), com colunas e ciclo próprios;
- a criação e o encerramento de reserva **não** inserem em `movimento_sessao` (T-01, T-08 — §24);
- `reserva_sessao.movimento_consumo_id` aponta **do** lado da reserva **para** o consumo, sem criar movimento de reserva;
- `saldo_de_direito` (§12.1) não referencia reserva; `reservas_ativas` não referencia movimento. **As duas grandezas são calculadas de tabelas distintas**, materializando I-25/H2-02.

**Auditoria:** cada movimento gera `evento_auditoria` com o mesmo `correlacao_id` da transação (AUD-001, PKG-007, RN-061).

---

## 15. FK `movimento_sessao.atendimento_id → atendimento.id` — **H2.2-11** — parecer específico

`docs/06` §5.2 lista M6 entre os módulos de que M7 **não deve depender**. A revisão exigiu parecer diferenciando quatro camadas.

| Camada | Esta FK cria? | Análise |
| --- | --- | --- |
| **Dependência de domínio** | **Não** | M7 não consulta, interpreta nem reage a conteúdo clínico. A regra de consumo é de M7; o **fato** que a dispara vem de M6, o que `docs/06` §14 já prevê ("M7 cria movimentos, disparado por fatos de M6") |
| **Dependência de aplicação** | **Não** | M7 não chama M6. O sentido do fluxo é M6 → M7, inalterado |
| **Integridade referencial física** | **Sim — e é o objetivo** | Impede movimento de `CONSUMO` órfão apontando para atendimento inexistente |
| **Leitura de conteúdo clínico** | **Não** | `atendimento` contém apenas metadados operacionais (§7.6); nenhuma coluna clínica. A FK carrega um identificador opaco |

**Por que a FK deve existir.** Sem ela, um `CONSUMO` órfão quebraria simultaneamente H2-05 (a unicidade perderia referente), PKG-006 (reprodutibilidade a partir do histórico) e a auditabilidade do consumo. A alternativa "coluna `uuid` sem FK" preservaria a fronteira **no papel** ao preço de permitir corrupção silenciosa de uma invariante crítica.

**Ownership permanece intacto:** M6 continua sem qualquer permissão de escrita em tabelas de M7; nenhuma FK aponta de M6 para M7.

**Recomendação: manter a FK, com `ON DELETE RESTRICT`.** Registrar formalmente que **integridade referencial física em banco único ≠ dependência de domínio**, e que a proibição de `docs/06` §5.2 se refere à segunda.

---

## 16. Consumo exatamente uma vez — **H2.2-04** (revisada)

### 16.1 Revisão da escolha da REV. 1

A REV. 1 escolheu `UNIQUE(atendimento_id, pacote_id)` simples **porque era expressável no Prisma**. A revisão rejeitou esse critério — corretamente.

**Reanálise.** A equivalência entre a `UNIQUE` simples e o índice parcial depende inteiramente da `CHECK ((tipo='CONSUMO') = (atendimento_id IS NOT NULL))`. Essa `CHECK` **também** exige migration SQL (§23). Logo o suposto ganho de categoria não existe: em qualquer cenário há SQL complementar.

Removido o falso critério, prevalece o critério correto — **a estrutura deve expressar a regra diretamente**:

### 16.2 Garantia adotada

**Índice único parcial sobre `(atendimento_id, pacote_id)` onde `tipo = 'CONSUMO'`**, **mais** a `CHECK` de coerência `(tipo='CONSUMO') = (atendimento_id IS NOT NULL)`.

| Pergunta da revisão | Resposta |
| --- | --- |
| A constraint protege **exatamente** os movimentos `CONSUMO`? | **Sim** — o predicado é literalmente `tipo = 'CONSUMO'`, independente do valor de `atendimento_id` |
| Outro tipo poderia indevidamente receber `atendimento_id`? | **Não** — bloqueado pela `CHECK`. E, mesmo que a `CHECK` fosse removida, o índice parcial continuaria protegendo o consumo |
| É necessário `CHECK`? | **Sim** — por RN-033/034 (coerência tipo × referência), independentemente da unicidade |
| Constraint simples ou índice parcial? | **Índice parcial** — enuncia a regra; a versão simples só é equivalente *dado* o CHECK |

**Fallback registrado:** se a versão de Prisma fixada tornar índices customizados operacionalmente frágeis, a `UNIQUE` simples permanece **logicamente equivalente na presença da CHECK** e é aceitável. A escolha primária não se apoia nisso.

### 16.3 Divisão de responsabilidades

| Camada | Responsabilidade | Garante |
| --- | --- | --- |
| **PostgreSQL** | índice único parcial | Impossibilidade física de dois `CONSUMO` para o mesmo `(atendimento, pacote)` — **independente de lock, isolamento, retry ou ordem** |
| **PostgreSQL** | `UPDATE registro_clinico SET estado='FINALIZADO' WHERE id=? AND estado='EM_ELABORACAO'` — contagem de linhas afetadas | Somente **uma** transação efetua a *primeira* finalização (lock de linha implícito) |
| **Transação** | T-02 abrange finalização + consumo + encerramento da reserva + auditoria | **Falha do consumo obrigatório não confirma a finalização** (H2-05, I-33) |
| **Aplicação** | Traduzir violação de unicidade **daquele índice** em **sucesso idempotente** | RN-035, I-27 |
| **Aplicação** | Validar elegibilidade e vínculo antes de inserir | RN-071, `docs/05` §13.6 |

### 16.4 Padrão de escrita

Verificação prévia isolada (`SELECT`, se não existir `INSERT`) é **incorreta sob concorrência**: em `READ COMMITTED`, duas transações podem ler "não existe" antes de qualquer commit. A verificação prévia serve **apenas** para mensagem amigável; a **garantia** é a constraint. O padrão é **inserir e tratar conflito**, distinguindo "inseriu agora" de "já existia" para não auditar um consumo que não ocorreu.

### 16.5 Sobre `EM_ELABORACAO` — mecanismo mantido — **H2.2-17**

A revisão levantou a hipótese de que `EM_ELABORACAO` fosse estado inventado para viabilizar atomicidade, com instrução de removê-lo caso não estivesse nas fontes.

**Verificação: o estado está explicitamente definido em fonte homologada** — PRN-003 ("Estado inicial: `EM_ELABORACAO`"), PRN-004 ("Transição: `EM_ELABORACAO -> FINALIZADO`"), RN-023, `docs/03` §5.2, `docs/05` §3.2, `docs/06` §6.6 e §11.2.

Nenhuma máquina de estados clínica nova foi criada: a proposta **usa** a máquina que a Fase 1 já homologou. O `UPDATE` condicional é apenas a forma física de "primeira finalização válida" (HOM-04, RN-070). **Mantido sem alteração.**

---

## 17. Concorrência

### 17.1 Serialização do Pacote — **H2.2-05**

> **Toda transação que crie reserva, encerre reserva, crie movimento ou avalie disponibilidade de um pacote adquire primeiro o lock da linha do `pacote` (`SELECT ... FOR UPDATE`).**

**Comparação dos quatro mecanismos exigidos:**

| Mecanismo | Funcionamento | Suficiente? | Custo | Veredito |
| --- | --- | --- | --- | --- |
| **Row lock no Pacote** | Serializa por pacote as mutações do agregado; segunda transação bloqueia e relê estado commitado | **Sim** | Granularidade mínima; sem retry; sem extensão; sem isolamento especial | **RECOMENDADO** |
| `SERIALIZABLE` | Detecta anomalias e aborta com `40001` | Sim | Exige laço de retry em toda operação; abortos crescem com concorrência; teste determinístico mais difícil | Rejeitado — custo desproporcional quando o ponto de contenção é conhecido e pontual |
| Advisory lock | Lock por chave derivada do `pacote_id` | Sim | Equivalente ao row lock, porém **sem ancoragem em linha real** — mais fácil de esquecer e de divergir de chave | Rejeitado — mesma garantia, menor rastreabilidade |
| Optimistic / versionamento | Coluna `versao` + `UPDATE ... WHERE versao = n` | **Parcialmente** | Reservas e movimentos **não alteram a linha do pacote**; seria preciso incrementar a versão artificialmente a cada escrita filha, convertendo-o em lock pessimista **com** retry | Rejeitado — mesma serialização, mais código e mais modos de falha |

**Por que o row lock é o correto por construção:** `Pacote` **já é o aggregate root homologado** (H2-06). Travar a raiz do agregado é a expressão física direta dessa decisão, não uma escolha técnica arbitrária.

**Por que constraints não bastam:** as invariantes são **entre agregações de duas tabelas** — `reservas_ativas ≤ saldo_de_direito` (I-24) e o bloqueio de H2-10. `CHECK` vê uma linha; `UNIQUE` vê colunas; `EXCLUDE` vê uma tabela. Nenhum mecanismo declarativo as expressa.

**Ordem canônica de locks (anti-deadlock):** `agendamento` (M5) → `pacote` (M7) → `cobranca` (M8). Nenhuma transação adquire em ordem inversa.

### 17.2 Conflito de agenda — **H2.2-06** (revisada)

**Estados que participam da restrição — corrigido na REV. 2:**

| Estado | Participa? | Fundamento |
| --- | --- | --- |
| `AGENDADO`, `CONFIRMADO`, `AGUARDANDO`, `EM_ATENDIMENTO` | **Sim** | compromissos vigentes (RN-015) |
| **`CONCLUIDO`** | **Sim — correção da REV. 2** | O atendimento **ocorreu**; o profissional esteve ocupado. Nenhuma fonte libera o horário após conclusão. Excluí-lo permitiria criar agendamento retroativo sobreposto a atendimento realizado, corrompendo IND-001/IND-008 |
| `CANCELADO` | **Não** | AGD-003: "cancelamento válido **libera capacidade**"; RN-020 terminal |
| `FALTA` | **Não** | O horário não é reutilizado pelo agendamento original (RN-020), mas **não bloqueia** novo compromisso — o paciente não compareceu e o recurso ficou livre. Preservado historicamente como linha, sem participar da restrição |

**Comparação dos mecanismos:**

| Mecanismo | Cobre | Vantagens | Desvantagens | Veredito |
| --- | --- | --- | --- | --- |
| **Exclusion constraint (GiST + `btree_gist`)** | profissional; paciente — **mesma tabela** | Garantia do índice, imune a race, independente de disciplina de código; intervalo semiaberto resolve a borda "termina 10:00 / começa 10:00" (`T-AGD-EDGE-NON-OVERLAP`); serve também como índice de leitura da agenda | Exige extensão; **não** cobre relação entre tabelas; violação chega como erro de constraint a ser mapeado | **RECOMENDADO** para profissional e paciente |
| Transação + lock | tudo, inclusive bloqueio | Uniforme; mensagens naturais | Correção depende de todo caminho de escrita lembrar do lock; serializa a agenda do profissional | Complementar, não primário |
| `SERIALIZABLE` | tudo | Correção geral | Retry em toda operação de agenda | Rejeitado — custo desproporcional |
| Só validação backend | nada estruturalmente | Simples | **Não satisfaz** o critério crítico de `docs/05` §6 | Rejeitado |

**Divisão final:**

| Conflito | Garantido por | Fonte |
| --- | --- | --- |
| Mesmo profissional | **PostgreSQL** — exclusion constraint | RN-015.1, AGD-005 |
| **Mesmo paciente** | **PostgreSQL** — exclusion constraint | **D-06** (regra explícita), RN-015.3 |
| Bloqueio do profissional | **Backend**, dentro de T-01 | RN-015.2, AGD-004 |
| Horário de funcionamento; disponibilidade | **Backend** (dependem do fuso e de vigência) | RN-014, CFG-002, PRO-003 |
| Profissional realiza o serviço; entidades ativas | **Backend** | PRO-004, RN-013, RN-008 |

**Bloqueio × Agendamento precisam da mesma proteção estrutural?** **Não, segundo as fontes.** AGD-004 estabelece uma regra **direcional** — "novo agendamento sobreposto ao bloqueio é rejeitado" — e determina explicitamente que o bloqueio **não apaga agendamentos existentes silenciosamente**. A coexistência de um bloqueio criado depois sobre um agendamento existente é, portanto, **estado tolerado pela própria regra**, não anomalia a impedir. Validação de backend em T-01 é suficiente; race residual de severidade baixa (`R2.2-09`).

### 17.3 Concorrência financeira — **H2.2-07**

`RN-046` (bloqueio de excesso) e `C-05` também são invariantes entre agregações. Mesmo mecanismo, mesma justificativa (H2-06: Cobrança é aggregate root): **lock da linha `cobranca`** em T-03/T-04/T-05.

`C-06` (comando duplicado) é coberto por `chave_idempotencia` única em `pagamento` e `estorno`. **A obtenção e o transporte da chave são decisão de API** (§28.3).

### 17.4 Ordem das verificações

**T-01 — criar/remarcar agendamento com pacote:**

1. autorização `agenda.gerenciar` (RN-002);
2. entidades ativas e `profissional_servico` (RN-013, PRO-004, RN-008);
3. horário de funcionamento e disponibilidade (RN-014, PRO-003);
4. ausência de sobreposição com `bloqueio_agenda` (RN-015.2);
5. **lock da linha `pacote`**;
6. `pacote.servico_id = agendamento.servico_id` (**H2-07**, I-31c) — invariante entre tabelas, responsabilidade do backend;
7. situação do pacote na **data civil do atendimento** (HOM-05, RN-071, §12.3);
8. `disponivel = saldo_de_direito − reservas_ativas`; **rejeitar se `< 1`** (D-07, PKG-004);
9. gravar `agendamento` — **as exclusion constraints decidem o conflito temporal**;
10. criar `reserva_sessao` — o índice único parcial impede duplicidade;
11. `historico_agendamento`; 12. `evento_auditoria`; 13. commit.

**Passo 5 antes do 8 é essencial** — ler saldo sem o lock reintroduz o overselling.

**T-06 — ajuste manual:**

1. autorização `pacotes.ajustar_sessao` (PKG-007);
2. justificativa não-vazia (RN-038, reforçada por CHECK);
3. **lock da linha `pacote`**;
4. calcular `saldo_de_direito` e `reservas_ativas`;
5. **se `AJUSTE_NEGATIVO`: rejeitar se `saldo_de_direito − quantidade < reservas_ativas`** — **H2-10, I-24b, C-09**;
6. inserir movimento; 7. auditar; 8. commit.

### 17.5 Riscos impedidos

| Risco | Impedido por |
| --- | --- |
| Overselling | Lock do pacote + verificação no passo 8 de T-01 |
| Saldo negativo indevido | H2-10 no passo 5 de T-06; `CHECK quantidade > 0` |
| Duas reservas na mesma disponibilidade inexistente | Lock do pacote — a segunda relê `disponivel = 0` |
| Consumo duplicado | Índice único parcial — **independente do lock** |
| Ajuste negativo invalidando reservas | H2-10 sob o mesmo lock que cria reservas |
| Reservas órfãs | FKs `NN` + `RESTRICT` + encerramento obrigatório em T-08 |

---

## 18. Cobertura dos pontos de concorrência `C-01`..`C-09`

Mapeamento de cada ponto declarado em `docs/06` §13 para o mecanismo físico proposto. A Etapa 2.1 declarou a **propriedade requerida**; esta seção declara **quem a garante**.

| ID | Ponto | Propriedade requerida (`docs/06` §13) | Mecanismo proposto | Garantido por | Cenário §25 |
| --- | --- | --- | --- | --- | --- |
| **C-01** | Dois agendamentos no mesmo recurso | Não produzir dois agendamentos válidos incompatíveis | Exclusion constraint por profissional e por paciente | **PostgreSQL** | 8 |
| **C-02** | Reserva vs. saldo | `reservas_ativas ≤ saldo_de_direito` | Lock da linha `pacote` + verificação após o lock | **Transação** | 1, 2 |
| **C-03** | Finalizações concorrentes do mesmo atendimento | No máximo um `CONSUMO` por `(atendimento, pacote)` | `UPDATE` condicional por estado **+** índice único parcial | **PostgreSQL** (duas camadas) | 3 |
| **C-04** | Retry de finalização/consumo | Idempotente, sem segunda baixa | Índice único parcial + tradução da violação em sucesso idempotente | **PostgreSQL + Aplicação** | 4 |
| **C-05** | Pagamentos concorrentes na mesma cobrança | Soma não ultrapassa o saldo devido | Lock da linha `cobranca` + verificação de RN-046 | **Transação** | 5 |
| **C-06** | Comando duplicado de pagamento/estorno | Idempotência de comando | `chave_idempotencia` única em `pagamento` e `estorno` | **PostgreSQL** (obtenção da chave é da API — §28.3) | 6 |
| **C-07** | Criação concorrente do "mesmo" paciente | CPF sem duplicata; ambiguidade → decisão humana | `UNIQUE(cpf)` para o caso determinístico; **nenhuma constraint** para similaridade (RN-012 proíbe decisão automática) | **PostgreSQL + Humano** | — |
| **C-08** | Uso de sessão vs. revogação | Sessão revogada não autoriza | `estado` terminal em `sessao_autenticacao` validado a cada requisição | **Aplicação** (RN-004) | — |
| **C-09** | `AJUSTE_NEGATIVO` concorrente a reservas | Nunca deixar `saldo_de_direito < reservas_ativas` | Lock da linha `pacote` + verificação **H2-10** antes do insert (T-06 passo 5) | **Transação** | 2 |

**Leitura da matriz.** Onde a propriedade é expressável em uma única tabela (`C-01`, `C-03`, `C-04`, `C-06`, `C-07`), a garantia é do **banco** e independe de disciplina de código. Onde a propriedade é uma relação entre **agregações de duas tabelas** (`C-02`, `C-05`, `C-09`), nenhum mecanismo declarativo a expressa e a garantia é da **transação**, ancorada no lock do aggregate root homologado em H2-06. `C-08` é autorização, não persistência.

---

## 19. Financeiro

### 19.1 `cobranca`

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `paciente_id` | `FK NN` | FIN-001 |
| `origem_tipo` | `ENUM(AGENDAMENTO_AVULSO, PACOTE, ADMINISTRATIVA) NN` | `docs/06` §9 |
| `origem_agendamento_id`, `origem_pacote_id` | `FK ∅` | mutuamente exclusivas por CHECK |
| `valor_bruto` | `numeric(12,2) NN CHECK >= 0` | copiado do preço de referência na criação; **catálogo posterior não reescreve** (CFG-003) |
| `valor_desconto` | `numeric(12,2) NN DEFAULT 0 CHECK >= 0` | FIN-003 |
| `valor_liquido` | **coluna gerada** `valor_bruto - valor_desconto` | §19.2 |
| `data_referencia` | `date NN` | **RN-068, HOM-02** — §20 |
| `desconto_por_usuario_id` | `FK ∅` | RN-043 |
| `cancelada_em`, `cancelada_por_usuario_id`, `motivo_cancelamento` | `∅` | FIN-005, RN-050 |
| `criado_por_usuario_id`, `criado_em`, `atualizado_em` | | |

**Sem coluna `situacao`** (§6.2).

### 19.2 `valor_liquido` — **H2.2-18** (parte)

| Alternativa | Análise | Veredito |
| --- | --- | --- |
| **Coluna gerada (`STORED`)** | Fonte única, calculada pelo banco; impossível divergir; indexável | **RECOMENDADA** |
| Derivada na leitura (sem coluna) | Também sem divergência; expressão repetida em cada consulta; IND-005 não precisa de índice sobre ela (filtra por `data_referencia` e soma) | **Fallback aceitável** |
| Persistida pela aplicação | Admite divergência entre coluna e parcelas | **Rejeitada** |

**Precisão e arredondamento:** `numeric(12,2)` é decimal exato; a subtração de dois valores com duas casas é exata, **sem arredondamento**. `float`/`double` são proibidos (RN-042 exige garantia de não-negatividade, incompatível com erro de ponto flutuante).

**Mutabilidade e auditoria:** `valor_bruto` e `valor_desconto` são mutáveis enquanto a cobrança admitir alteração; `valor_liquido` acompanha automaticamente. A aplicação de desconto exige `financeiro.desconto.aplicar` (RN-043) e gera evento de auditoria com os valores anterior e novo em `contexto` (FIN-003: "alteração relevante é auditada"). `CHECK (valor_bruto - valor_desconto >= 0)` garante RN-042 **no banco**.

### 19.3 `pagamento` e `estorno` — **H2.2-08**

**`pagamento`** (append-only) — `id PK`; `cobranca_id FK NN`; `valor numeric(12,2) NN CHECK > 0`; `forma_pagamento_id FK NN`; `recebido_em timestamptz NN`; `registrado_por_usuario_id FK NN`; `chave_idempotencia text ∅ U`; `criado_em`. A forma deve estar **ativa no momento do registro** (FIN-004, CFG-004); a FK preserva pagamentos históricos com formas depois inativadas (RN-007).

**`estorno`** (append-only) — `id PK`; **`pagamento_id FK NN U`**; `estornado_em timestamptz NN`; `estornado_por_usuario_id FK NN`; `motivo text NN` não-vazio; `chave_idempotencia text ∅ U`; `criado_em`.

**Duas decisões físicas deliberadas:**
1. `UNIQUE(pagamento_id)` — estornar o mesmo pagamento duas vezes é **fisicamente impossível** (`Pagamento — Estorno 1 — 0..1`);
2. **não existe coluna de valor no estorno** — o valor **é** `pagamento.valor`, sempre integral. **Estorno parcial torna-se irrepresentável**, e não apenas proibido — a expressão mais forte possível de HOM-03 / RN-069 / `docs/05` §11.

Reversibilidade: uma decisão futura de admitir estorno parcial exigiria adicionar coluna e remover a unicidade — **reversibilidade média**, registrada.

### 19.4 Derivação da situação

```
recebido_liquido(C) =
    Σ pagamento.valor  onde pagamento.cobranca_id = C
                        e NÃO EXISTE estorno para esse pagamento

houve_recebimento(C) = EXISTE pagamento com cobranca_id = C

situacao(C) =
    CANCELADO           se C.cancelada_em IS NOT NULL
    ESTORNADO           senão se houve_recebimento(C) e recebido_liquido(C) = 0
    PENDENTE            senão se recebido_liquido(C) = 0
    PARCIALMENTE_PAGO   senão se recebido_liquido(C) < C.valor_liquido
    PAGO                senão
```

Conforme RN-045, RN-048, `docs/03` §5.4 e `docs/06` §11.4. **`CANCELADO` tem precedência máxima — exigência de H2-12**, pois o cancelamento autorizado incide justamente sobre cobrança que **teve** recebimento.

### 19.5 Ciclo completo H2-11 / H2-12

Cobrança `C`: `valor_bruto = 300,00`, `valor_desconto = 0`, `valor_liquido = 300,00`.

| # | Evento | Persistido | `recebido_liquido` | Situação derivada | Fonte |
| --- | --- | --- | --- | --- | --- |
| 1 | Cobrança válida criada | `cobranca C` | 0,00 | **`PENDENTE`** | FIN-001, RN-045 |
| 2 | Pagamento integral `P1 = 300,00` | `+ P1` | 300,00 | **`PAGO`** | FIN-004 |
| 3 | Estorno integral de `P1` | `+ E1(P1)`; **`P1` intacto** | 0,00 | **`ESTORNADO`** | FIN-006, RN-048, HOM-03 |
| 4 | Cobrança passa a `ESTORNADO` | — | 0,00 | **`ESTORNADO`** | RN-048 |
| 5 | Novo pagamento `P2 = 120,00` (obrigação válida, não cancelada) | `+ P2` | 120,00 | **`PARCIALMENTE_PAGO`** | **H2-11** |
| 6 | Estado re-derivado | — | 120,00 | **`PARCIALMENTE_PAGO`** | derivação automática |
| 6b | *(variante)* `P2 = 300,00` | `+ P2` | 300,00 | **`PAGO`** | **H2-11** |
| 7 | Cancelamento autorizado posterior | `cancelada_em`, `cancelada_por`, `motivo`; **`P1`, `E1`, `P2` preservados** | 120,00 | **`CANCELADO`** | **H2-12**, RN-050, FIN-005 |

Nenhuma linha apagada ou reescrita em nenhum passo. Entre 3 e 5 a cobrança aceita novo pagamento porque `cancelada_em IS NULL` — é o que H2-11 exige, e a derivação o produz **sem criar estado novo**. Após 7, RN-047 bloqueia novo pagamento (validação sob lock). **Nenhum passo tocou sessão de pacote** (H2-08, RN-049, I-39, `docs/05` §13.5).

### 19.6 Isolamento M8 × M7 (H2-08) — verificação item a item

- `cobranca` referencia `pacote.id` **apenas** como origem funcional para RN-068 — leitura, nunca escrita;
- **não existe** FK de tabela de M8 para `movimento_sessao` ou `reserva_sessao`;
- **não existe** trigger, coluna calculada ou rotina ligando evento financeiro a sessão;
- **nenhuma** das transações T-03/T-04/T-05 toca tabelas de M7 (§24);
- `estorno` não possui, e não deve possuir, referência a pacote ou movimento.

`docs/05` §13.5 atendido: ajuste extraordinário de sessões passa obrigatoriamente por PKG-007/T-06, com permissão e justificativa próprias.

---

## 20. Data de referência financeira — **H2.2-10** (revisada) e **`PROP-RN-2.2-01`**

### 20.1 Regra funcional vigente (não modificada)

RN-068/HOM-02/IND-005: `receita_prevista` = soma dos valores líquidos das cobranças **não canceladas** cuja **data de referência** pertença ao período. Origem funcional: avulso → **data do atendimento**; pacote → **data da contratação**; administrativa → **data explicitamente atribuída**.

### 20.2 Representação física

**`cobranca.data_referencia date NOT NULL`** — materializada como **data civil no fuso da clínica**.

**Por que materializar:** (a) é `date`, e a agregação por período usa o fuso da clínica (RN-060) — resolver a conversão uma única vez elimina a classe de erro de agrupar por dia UTC; (b) é indexável (IDX-C2), e IND-005 é consulta por faixa; (c) para origem `ADMINISTRATIVA` **não existe origem derivável** — o valor só pode ser atributo próprio.

### 20.3 `PROP-RN-2.2-01` — Data de referência após remarcação

**Status: REGRA HOMOLOGADA em 19/08/2026.** Texto homologado: *"a data de referência de cobrança avulsa acompanha a remarcação válida do agendamento. Pagamentos ou estornos não congelam nem alteram essa referência por si só. Alterações devem preservar auditoria."*

**Lacuna real:** RN-068 diz "atendimento avulso → data do atendimento", sem dizer se a referência acompanha uma remarcação.

| Opção | Descrição | Análise |
| --- | --- | --- |
| **A — dinâmica** | Acompanha a data do atendimento após remarcação, sempre | **Aderente à letra de RN-068** ("data do atendimento", sem qualificação temporal) |
| **B — congelada** | Fixada na criação da cobrança | Diverge de RN-068 quando há remarcação: a previsão passa a apontar para uma data em que nenhum atendimento ocorrerá |
| **C — híbrida** | Acompanha até haver pagamento; depois congela | **Contradiz a invariante explícita de IND-005** |

**Argumento decisivo.** IND-005 declara textualmente: *"pagamento ou estorno não altera, por si só, a receita prevista; esses movimentos afetam a receita recebida."* A opção C faz exatamente o que essa invariante proíbe — deixa um movimento financeiro alterar o comportamento da receita prevista. **A opção C, adotada na REV. 1, era incompatível com a fonte e foi retirada.**

Isso valida, contra as fontes, a interpretação levantada na revisão: **receita prevista reflete a referência funcional atual da obrigação; receita recebida deriva dos movimentos financeiros efetivos** (RN-056/IND-006 usam a data dos movimentos, não a de referência). São grandezas com temporalidades distintas por desenho.

**Opção A — HOMOLOGADA.**

| Situação | Comportamento |
| --- | --- |
| Remarcação de agendamento com cobrança avulsa **não cancelada** | `data_referencia` **recalculada** na mesma transação (T-01), **independentemente de haver pagamentos**, com evento de auditoria registrando valor anterior e novo |
| Cobrança **cancelada** | Não recalcular — já está fora da previsão (RN-068) |
| Origem `PACOTE` | Imutável — `data_contratacao` não muda |
| Origem `ADMINISTRATIVA` | Só muda por operação explícita, autorizada e auditada |

**Estabilização natural:** remarcação só é possível enquanto o agendamento não é terminal (RN-020). Após `CONCLUIDO`/`FALTA`/`CANCELADO`, a data **se estabiliza por efeito da máquina de estados** — sem necessidade de regra de congelamento inventada. Este é o argumento que torna a Opção A segura na prática.

**Reprodutibilidade histórica:** a alteração é auditada (AUD-001), permitindo reconstruir por que um relatório de período mudou. RN-051 registra que o sistema não é documento fiscal nem contábil, o que torna a previsão legitimamente recalculável.

**Nota de implementação decorrente da homologação:** o recálculo é **obrigatório** e ocorre **dentro de T-01** (§24.2), acompanhado de evento de auditoria com valor anterior e novo — a auditoria é condição expressa da regra homologada, não recomendação. Registro documental: `docs/03-regras-negocio.md` **não foi alterado**; a absorção desta regra é ação de governança separada (`P2.2-11`).

### 20.4 Demais comportamentos

| Situação | Comportamento |
| --- | --- |
| Cancelamento do agendamento | `data_referencia` inalterada; efeito sobre a cobrança tratado em `PROP-RN-2.2-02` |
| Cancelamento da cobrança | Data preservada; valor sai da previsão pelo filtro `cancelada_em IS NULL` |
| UTC × data civil | Conversão ocorre **uma vez**, na determinação; nenhuma consulta de IND-005 converte fuso |

---

## 20-A. `PROP-RN-2.2-02` — Cancelamento de Agendamento × Cobrança avulsa

**Status: REGRA HOMOLOGADA em 19/08/2026.** Texto homologado: *"cancelamento de Agendamento não cancela automaticamente Cobrança. Qualquer cancelamento ou resolução financeira exige operação explícita, autorização adequada e preservação do histórico."*

**Lacuna real:** nenhuma fonte estabelece o que acontece com a cobrança avulsa quando o agendamento de origem é cancelado.

### Análise dos casos

| Caso | Situação | Sob a recomendação |
| --- | --- | --- |
| **1** | Agendamento avulso cancelado + cobrança sem pagamento | Cobrança permanece `PENDENTE`; sinalizada para resolução explícita |
| **2** | Cancelado + cobrança parcialmente paga | Permanece `PARCIALMENTE_PAGO`; RN-050 exige resolução explícita dos movimentos |
| **3** | Cancelado + cobrança integralmente paga | Permanece `PAGO`; eventual devolução é **estorno** (FIN-006), operação própria e autorizada |
| **4** | Cancelamento por falta/no-show | `FALTA` é estado distinto de `CANCELADO`; **nenhum efeito financeiro automático** — D-02.5 exige requisito futuro explícito para cobrança por falta |
| **5** | Cobrança administrativa não originada do agendamento | Fora do escopo — sem vínculo, nada a propagar |

### Opções

| Opção | Veredito |
| --- | --- |
| **A — cancelamento nunca altera automaticamente a cobrança** | **HOMOLOGADA** |
| B — cancela automaticamente a cobrança sem pagamentos; com pagamentos exige resolução | **Rejeitada** — ver argumento decisivo |
| C — outro comportamento | Não fundamentado |

### Argumento decisivo contra a Opção B

Cancelar cobrança exige a permissão **`financeiro.cobranca.cancelar`** (`docs/04` §5.7, FIN-005). Cancelar agendamento exige **`agenda.gerenciar`** (`docs/04` §5.4). **São permissões distintas e nenhuma implica a outra.**

A Opção B faria com que um usuário com apenas `agenda.gerenciar` — tipicamente a recepção — provocasse, por efeito colateral, uma operação que as fontes reservam a quem tem permissão financeira específica. Isso é **escalada de privilégio por efeito colateral**, contrária a `docs/04` §2.1 (privilégio mínimo), §2.2 (negação por padrão) e RN-002 (autorização validada no backend por operação).

**Precedente de estilo nas fontes:** HOM-05/RN-071 estabelecem que cancelar o **pacote** não cancela o agendamento — o vínculo torna-se inelegível e exige **resolução explícita**. A Opção A aplica o mesmo princípio ao par agendamento/cobrança, mantendo coerência com a decisão já homologada.

A recomendação também não cria taxa de cancelamento, multa, estorno automático, apagamento de pagamento nem qualquer efeito sobre sessões de pacote — todos vedados pelas fontes (D-02.5, D-03, RN-044, RN-048, H2-08).

### Consequência a declarar

Enquanto a cobrança não for explicitamente cancelada, **ela continua compondo a receita prevista** (RN-068), mesmo com o agendamento cancelado. Isso é a leitura literal da regra vigente, **não** um defeito introduzido aqui.

Mitigação **operacional**, não automática: lista de "cobranças de agendamentos cancelados pendentes de resolução", exposta a quem tem permissão financeira. A homologação confirmou que qualquer resolução financeira exige **operação explícita, autorização adequada e preservação do histórico** — portanto nenhum efeito automático pode ser introduzido por decisão de persistência. Registro documental: absorção em `docs/03` é ação separada (`P2.2-11`).

---

## 21. P-CLIN — **DECISÃO HOMOLOGADA** (Alternativa A) — **H2.2-16**

> **Status desta seção:** **HOMOLOGADA em 19/08/2026.** A Alternativa A foi aprovada por Bruno Menezes Noronha e **já está aplicada ao modelo físico** (§7.6, §8, U-13, IDX-N2). A promoção de `Atendimento` a aggregate root **não** foi homologada e permanece deliberadamente em aberto (§21.6, `P2.2-10`).

### 21.1 O que o modelo já definia **sem** depender de P-CLIN

Autoria, timestamps, imutabilidade do finalizado, retificação append-only, cadeia de rastreabilidade, justificativa obrigatória, anexos privados, ausência de conteúdo clínico fora de M6 (§7.6, §22.1), `atendimento` completo, gatilho de consumo (§16.5) e unicidade de consumo (§16.2) — **todos funcionam sob qualquer alternativa**.

### 21.2 O que estava bloqueado — e o que restou

| Item antes bloqueado | Situação após a homologação |
| --- | --- |
| Obrigatoriedade/unicidade de `registro_clinico.atendimento_id` | **RESOLVIDO** — `NN U` (§7.6, U-13) |
| Existência de coluna `tipo` no registro | **RESOLVIDO** — não existe; a decomposição é por **componentes** |
| Âncora de `anexo_clinico` | **RESOLVIDO** — `registro_clinico_id NN` (§7.6) |
| Modelagem do **conteúdo** (campos, escalas, validações) | **PERMANECE ABERTO** — `P2.2-07`, definição **clínica**, não arquitetural |
| Encadeamento de retificação de retificação | **PERMANECE ABERTO** — `P2.2-01`; **deixou de depender de P-CLIN** e passou a questão isolada de modelagem da cadeia |
| **Aggregate root de `Atendimento`** | **PERMANECE ABERTO POR DECISÃO EXPRESSA** — `P2.2-10`; H2-06 vigente |

### 21.3 Fundamentação nas fontes — a questão central da revisão

A revisão perguntou: **as fontes realmente exigem que Avaliação/Plano existam fora de um Atendimento, ou a REV. 1 inferiu isso?**

**Verificação: a REV. 1 inferiu — e as fontes indicam o contrário.**

| Evidência | Texto | Implicação |
| --- | --- | --- |
| **TLF-BASE-V1 §7**, passos 7–8 | "7. O profissional registra **avaliação ou evolução**. / 8. **O registro clínico** é finalizado." | Avaliação e evolução ocorrem **dentro** do fluxo do atendimento, e o que se finaliza é **um** registro clínico (singular) |
| **FC-05**, passo 2 | "registra **avaliação/evolução** necessária" | Um mesmo registro comporta avaliação **ou** evolução, conforme o encontro |
| **`docs/06` §6.6** | "Registro clínico — `EM_ELABORACAO/FINALIZADO`; autoria; **vinculado ao Atendimento**" | Vínculo direto e singular |
| **HOM-04 / RN-070** | "primeira finalização válida **do registro clínico correspondente ao atendimento**" | Artigo definido e singular |
| **PRN-002** | Lista "Dados possíveis: anamnese, queixa principal, ... objetivos, plano terapêutico ..." | Redação de **componentes de um registro**, não de entidades autônomas |

**Nenhuma fonte descreve conteúdo clínico produzido fora de um atendimento.** O fluxo operacional da Base (§7) exige agendamento → check-in → atendimento antes de qualquer registro. O argumento central da REV. 1 era, portanto, sem sustentação.

### 21.4 Alternativas

#### Alternativa A — um `RegistroClinico` por `Atendimento`, com componentes

`registro_clinico.atendimento_id NOT NULL UNIQUE`; avaliação, plano e evolução são **componentes** do registro do encontro.

| Critério | Avaliação |
| --- | --- |
| PRN-001 (histórico cronológico) | Atendido — ordenação por `finalizado_em`/`criado_em` |
| PRN-002 / PRN-003 | Atendidos como componentes do registro do encontro, conforme Base §7 passo 7 |
| PRN-004 (finalização) | **Trivialmente inequívoca** — um registro, uma finalização |
| PRN-005 (retificação) / PRN-006 (anexos) | Âncora clara e única: o registro |
| RN-021..RN-028 | Atendidos |
| **HOM-04 / H2-05 (gatilho)** | **Ambiguidade eliminada por construção** — risco `R-13` de `docs/06` §19 deixa de existir, em vez de ser neutralizado |
| Simplicidade | **Máxima** |
| Expansão futura | Média — novos componentes entram como estrutura interna; um segundo registro no mesmo atendimento exigiria migração |
| Risco de inconsistência | **Mínimo** |

#### Alternativa B — múltiplos registros, eventualmente tipados

`atendimento_id` anulável, sem unicidade; `tipo` distinguindo avaliação/plano/evolução.

| Critério | Avaliação |
| --- | --- |
| PRN-001..PRN-006 | Atendidos |
| **HOM-04 / H2-05** | Gatilho passa a "primeira finalização de **qualquer** registro do atendimento" — ambiguidade **neutralizada** pela unicidade de consumo, mas **não eliminada** |
| Simplicidade | Menor — exige regras de obrigatoriedade por tipo |
| Expansão futura | Maior |
| Risco de inconsistência | Moderado — `R-13` permanece latente |
| Sustentação nas fontes | **Nenhuma fonte a exige**; a Base sugere o oposto (§21.3) |

### 21.5 Decisão — **HOMOLOGADA: Alternativa A**

**Alternativa A homologada em 19/08/2026:** um `RegistroClinico` por `Atendimento`, contendo avaliação, plano, evolução e demais componentes clínicos necessários.

Fundamentação: (1) é a leitura literal de TLF-BASE-V1 §7, FC-05 e `docs/06` §6.6; (2) elimina — não apenas mitiga — o risco `R-13`, satisfazendo com folga a restrição registrada em `docs/06` §18.1 ("deve ser inequívoco qual primeira finalização válida aciona o consumo"); (3) é a opção mais simples, conforme TLF-BASE-V1 §4.5; (4) TLF-BASE-V1 §8 é explícito em **não** obrigar uma tabela por item conceitual, o que autoriza tratar avaliação/plano/evolução como componentes.

**Custo aceito e declarado:** se o negócio vier a exigir dois registros clínicos distintos no mesmo atendimento, será necessária migração (relaxar a unicidade e introduzir `tipo`). Reversibilidade **média**. A modelagem do **conteúdo** permanece pendente de definição **clínica** (`P2.2-07`), não arquitetural — a homologação de P-CLIN **não** a substitui.

### 21.6 Efeito de governança sobre H2-03 e H2-06 — declaração formal

**Sobre H2-03 — efetivado.** H2-03 adiou três itens: decomposição, multiplicidade e aggregate root. A homologação da Alternativa A **resolveu a multiplicidade** e **fixou a decomposição como componentes**, **encerrando parcialmente H2-03**. H2-03 permanece vigente **apenas** quanto ao aggregate root de `Atendimento`.

**Sobre H2-06 — declaração explícita.** H2-06 registrou que `Atendimento` **não** é aggregate root. A Alternativa A **não promove automaticamente** `Atendimento` a aggregate root: ela fixa uma cardinalidade, e o registro clínico pode continuar sendo a raiz da fronteira clínica. **Portanto, a Alternativa A, isoladamente, não altera H2-06 — e a homologação de 19/08/2026 confirmou expressamente que H2-06 permanece vigente nesse aspecto.**

**Contudo**, a Alternativa A torna coerente uma decisão adicional — promover `Atendimento` a aggregate root da fronteira clínica (raiz sobre registro, retificações e anexos). **Essa decisão é separada e não é recomendada nem assumida aqui.** Se Bruno optar por tomá-la:

- ela **modifica materialmente H2-06**, no aspecto específico "Atendimento não é aggregate root";
- **não** afeta `Pacote` nem `Cobrança`, que permanecem aggregate roots;
- exige registro formal como **supersessão parcial de H2-06**, e não como esclarecimento;
- **permanece não vigente até homologação explícita.**

Esta proposta **não** afirma que a mudança "não altera H2-06" — ela altera, caso adotada, e o efeito está declarado.

---

## 22. Integridade clínica, append-only e auditoria

### 22.1 Integridade clínica

| Exigência | Materialização | Fonte |
| --- | --- | --- |
| Autor | `autor_usuario_id NN` em registro e retificação | RN-021, I-21 |
| Timestamp | `criado_em`, `finalizado_em`, `efetivada_em` | PRN-003/004 |
| Original preservado | `FINALIZADO` nunca recebe `UPDATE`/`DELETE` | RN-024, RN-026 |
| Retificação | Tabela própria com FK para o original | RN-025 |
| Cadeia de rastreabilidade | `registro_original_id` + ordem por `efetivada_em`; retificação efetivada imutável | RN-027 |
| Justificativa | `text NN` + CHECK de não-vazio | D-01, RN-028 |
| Anexos privados | `chave_objeto`; **nenhuma URL pública persistida**; acesso temporário em runtime | RN-064, PRN-006 |
| Sem conteúdo clínico fora de M6 | Nenhuma coluna clínica em M5/M7/M8/M10; M7 recebe só `atendimento_id` | RN-062, I-09 |

### 22.2 Append-only — proteção priorizada (revisada)

A revisão exigiu que não se presumisse trigger para toda entidade histórica. Classificação por **necessidade real**:

| Estrutura | Proteção recomendada | Por quê |
| --- | --- | --- |
| **`evento_auditoria`** | **`REVOKE UPDATE, DELETE`** da role de runtime | AUD-005 tem critério de aceite explícito; a tabela **nunca** recebe update/delete, então revogar é a proteção mais simples e sem efeito colateral. Trigger seria redundante |
| **`movimento_sessao`**, **`pagamento`**, **`estorno`** | **`REVOKE UPDATE, DELETE`** | Mesma situação: nada jamais atualiza estas tabelas. Custo zero, defesa real (RN-039, RN-044, RN-048) |
| **`registro_clinico`** | **Trigger condicional** em `UPDATE`/`DELETE` quando `OLD.estado = 'FINALIZADO'` | Imutabilidade é **condicional ao estado** — privilégio de tabela não distingue linhas; PRN-004 tem critério de aceite **crítico** |
| **`retificacao_clinica`** | **Trigger condicional** quando `OLD.estado = 'EFETIVADA'` | Mesma natureza (RN-027) |
| `historico_agendamento` | `REVOKE UPDATE, DELETE` | Append-only puro (AGD-009) |
| `reserva_sessao` | **Nenhuma proteção adicional** | Não é append-only puro: o encerramento é um `UPDATE` legítimo. Protegida por CHECKs + validação de aplicação |

**Defesa em profundidade:** aplicação (nunca emite o comando) → privilégio ou trigger (impede no banco) → teste de integração que tenta a operação e **espera falha**.

### 22.3 `evento_auditoria` — **H2.2-14**

| Coluna | Tipo | Observações |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `ocorrido_em` | `timestamptz NN` | AUD-003 |
| `ator_usuario_id` | `FK ∅` | `NULL` só em ação de sistema; RN-061 |
| `acao` | `text NN` | catálogo documentado |
| `alvo_tipo` | `text NN` | nome lógico do recurso |
| `alvo_id` | `uuid ∅` | |
| `resultado` | `text NN` | **catálogo documentado, não enum** — AUD-003 não enumera valores (§11.1) |
| `justificativa` | `text ∅` | obrigatória quando a regra exige (D-01, RN-038, FIN-005) |
| `correlacao_id` | `uuid NN` | correlaciona os eventos de uma mesma operação/transação |
| `contexto` | `jsonb ∅` | **lista branca de chaves por `acao`** |

Conjunto mínimo idêntico ao exigido por AUD-003/RN-061. **Proibido armazenar** (RN-062, RN-063, AUD-002/006, TLF-BASE-V1 §10): senha ou hash; token, cookie, segredo de recuperação; conteúdo clínico; payload de prontuário; conteúdo de anexo; qualquer dado pessoal sem necessidade demonstrada.

`contexto` existe porque investigação exige dados como "valor anterior do desconto". Para não virar vazamento por conveniência: **lista branca por ação, validada na aplicação e documentada junto ao catálogo**; nenhum serializador genérico de entidade escreve nela. Recomenda-se teste que **rejeite** chaves fora da lista (`R2.2-04`).

**Alvo polimórfico sem FK:** FK polimórfica é impossível e FKs para todas as tabelas tornariam a trilha frágil. Como nada é apagado (§23), o risco de id inexistente é residual.

### 22.4 `historico_agendamento` × `evento_auditoria`

Coexistem por atenderem requisitos distintos: histórico **funcional** consultado na operação, com colunas tipadas de antes/depois (AGD-009), versus trilha **de segurança** homogênea e restrita a metadados (AUD-001..006). Uma mudança relevante gera as duas linhas com o mesmo `correlacao_id`. **Redundância deliberada, não dupla fonte de verdade** — nenhuma regra de negócio deriva estado de qualquer uma delas.

---

## 23. Exclusão, inativação e retenção — **H2.2-13**

### 23.1 Classificação conceito a conceito

Categorias exigidas pela revisão: **AI** ativo/inativo; **CA** cancelável; **PH** preservação histórica; **EL** exclusão lógica; **EF** exclusão física tecnicamente possível; **EP** exclusão proibida pelo fluxo.

| Conceito | AI | CA | PH | EL | EF | EP | Fonte |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| **Usuário** | **Sim** | — | Sim | Não | Tecnicamente sim, enquanto sem dependentes — **não oferecida pelo fluxo** | — | AUT-005, RN-001, RN-007 |
| **Profissional** | **Sim** | — | Sim | Não | idem | — | PRO-005, RN-007/008 |
| **Paciente** | **Sim** | — | Sim | Não | idem | — | PAC-006 ("inativação não apaga prontuário, agenda, financeiro ou auditoria") |
| **Serviço / Forma pagto / Motivo** | **Sim** | — | Sim | Não | idem | — | CFG-003/004/005, RN-007/008 |
| **Agendamento** | — | **Sim** (`CANCELADO`) | Sim | Não | Não | **Sim** | AGD-003, RN-020 |
| **Atendimento** | — | Não | **Sim** | Não | Não | **Sim** | H2-01, I-21b |
| **Registro clínico / Retificação** | — | Não | **Sim** | Não | Não | **Sim** | RN-024/025/026/027; TLF-BASE-V1 §4.4 |
| **Anexo clínico** | — | Não | **Sim no MVP** | Não | — | **Sim no MVP** | PRN-006 — remoção sujeita a política futura (`P2.2-06`) |
| **Pacote** | — | **Sim** (`cancelado_em`) | Sim | Não | Não | **Sim** | RN-040, H2-09 |
| **Cobrança** | — | **Sim** (`cancelada_em`) | Sim | Não | Não | **Sim** | FIN-005, RN-050 |
| **Pagamento / Estorno** | — | Não | **Sim** | Não | Não | **Sim** | RN-044, RN-048 |
| **Auditoria** | — | Não | **Sim** | Não | Não | **Sim (estrita)** | RN-066, AUD-005 |
| **Reserva de sessão** | — | Encerrável | **Sim** | Não | Não | **Sim** | PKG-006, §13.3 |
| **Movimento de sessão** | — | Não | **Sim** | Não | Não | **Sim** | RN-039, PKG-008 |

### 23.2 Conclusão demonstrada

**Nenhuma tabela do MVP recebe `deleted_at`** — e isso agora está demonstrado conceito a conceito, não afirmado como princípio: em cada grupo há **inativação funcional**, **estado de negócio** ou **preservação obrigatória**. Não sobra caso para exclusão lógica genérica.

**Exclusão física** permanece tecnicamente possível para cadastros sem dependentes (um paciente criado por engano, sem agendamento), mas **o MVP não oferece essa operação** — nenhuma fonte a requisita, e criá-la seria ampliar escopo. Registrado, não implementado.

### 23.3 Retenção — pendência jurídica

Prazos de retenção clínica, descarte, anonimização e pedido de eliminação de titular (LGPD) **não estão definidos** em fonte alguma. TLF-BASE-V1 §10 exige validação jurídica competente; PAC-005 e PRN-006 registram a mesma pendência. **Esta proposta não define política de retenção nem modela mecanismo de descarte** (`P2.2-06`). A tensão entre preservação obrigatória de prontuário (RN-024) e eventual pedido de eliminação **não é decisão de arquitetura**.

---

## 24. Temporalidade e transações críticas

### 24.1 Semântica temporal — **H2.2-15**

| Semântica | Tipo | Ocorrências |
| --- | --- | --- |
| **Instante** | `timestamptz` (UTC) | `agendamento.inicio/fim`, `atendimento.iniciado_em`, `registro_clinico.finalizado_em`, `pagamento.recebido_em`, `movimento_sessao.criado_em`, `reserva_sessao.encerrada_em`, `evento_auditoria.ocorrido_em`, todos os `criado_em` |
| **Data civil** | `date` | `cobranca.data_referencia`, `pacote.validade_ate`, `pacote.data_contratacao`, `paciente.data_nascimento`, vigências |
| **Horário local recorrente** | `time` + `dia_semana` | `horario_funcionamento`, `disponibilidade_profissional` |
| **Intervalo** | par `inicio`/`fim` + CHECK; intervalo **calculado** na exclusion constraint | `agendamento`, `bloqueio_agenda` |
| **Fuso configurado** | `text` (IANA) | `clinica.fuso_horario` |

O intervalo **não** é materializado como coluna de range: o par é mais natural para leitura e API, e a expressão é avaliada pelo índice sem coluna adicional.

**Por que a distinção é normativa:** IND-001..004/006 agrupam por período **local** (RN-060) — agrupar por dia UTC erra na virada do dia; `data_referencia` é `date` para que IND-005 não converta fuso na leitura; horários recorrentes como `timestamptz` exigiriam uma linha por ocorrência e quebrariam em horário de verão; `validade_ate` é data civil por natureza.

**Validade do pacote (HOM-05, RN-071):** compara a data civil do atendimento, convertida pelo `clinica.fuso_horario`, com `validade_ate`. **Responsabilidade do backend** — a comparação depende de coluna em outra tabela, fora do alcance de `CHECK`. Revalidada na criação **e** na remarcação (RN-016).

### 24.2 Transações críticas

Mapeamento de `docs/06` §12. Todas síncronas e transacionais (H2-04). Ordem de locks: `agendamento` → `pacote` → `cobranca`.

| T | Escopo | Garantias | Falha ⇒ |
| --- | --- | --- | --- |
| **T-01** Criar/remarcar agendamento + reserva | `agendamento`, `reserva_sessao`, `historico_agendamento`, `evento_auditoria`, `cobranca.data_referencia` (§20.3) | lock do pacote; exclusion constraints; único parcial de reserva | rollback total |
| **T-02** Finalização + consumo + encerramento da reserva + auditoria | `registro_clinico`, `movimento_sessao`, `reserva_sessao`, `evento_auditoria` | `UPDATE` condicional por estado; lock do pacote; único parcial de consumo | **rollback conjunto — finalização não confirmada (H2-05, I-33)** |
| **T-03** Registrar pagamento | `pagamento`, `evento_auditoria` | lock da cobrança; `chave_idempotencia` | rollback |
| **T-04** Estornar pagamento | `estorno`, `evento_auditoria` | lock da cobrança; `UNIQUE(pagamento_id)` | rollback; **nunca toca sessão (I-39)** |
| **T-05** Cancelar cobrança | `cobranca`, `evento_auditoria` | lock da cobrança; movimentos preservados (RN-050, H2-12) | rollback |
| **T-06** Ajuste de sessão | `movimento_sessao`, `evento_auditoria` | lock do pacote; verificação **H2-10** antes do insert | rollback |
| **T-07** Recuperação de senha / revogação | `usuario`, `segredo_recuperacao_senha`, `sessao_autenticacao`, `evento_auditoria` | consumo do segredo + revogação atômicos | rollback |
| **T-08** Encerrar reserva por cancelamento/falta/desvinculação | `agendamento`, `reserva_sessao`, `historico_agendamento`, `evento_auditoria` | lock do pacote (altera `reservas_ativas`) | rollback |
| **T-09** Iniciar atendimento | `agendamento`, `atendimento`, `evento_auditoria` | `UPDATE` condicional `AGUARDANDO`; `UNIQUE(agendamento_id)` | rollback; **não consome (I-15)** |

**Transações entre módulos:** T-01 (M5+M7), T-02 (M6+M7), T-08 (M5+M7), T-09 (M5+M6) — exatamente as de `docs/06` §12. Nenhuma atravessa M7 e M8.

---

## 25. Testes conceituais de concorrência

Simulação obrigatória antes de recomendar homologação.

| # | Cenário | Estado inicial | Operações concorrentes | Proteção | Resultado válido | Resultado proibido |
| --- | --- | --- | --- | --- | --- | --- |
| **1** | Duas reservas para a última sessão | `disponivel = 1` | Duas T-01 no mesmo pacote | Lock do pacote; verificação após o lock | Uma reserva criada; a outra rejeitada por indisponibilidade | Duas reservas ativas (**overselling**) |
| **2** | Reserva concorrente com ajuste negativo | `saldo = 2`, `reservas = 1` | T-01 (nova reserva) ‖ T-06 (`AJUSTE_NEGATIVO` de 1) | Ambas sob lock do pacote; H2-10 avaliado com o estado commitado | Ordem A: reserva criada (`reservas=2`), ajuste **rejeitado** (2−1 < 2). Ordem B: ajuste aplicado (`saldo=1`), reserva **rejeitada** | `saldo < reservas` (**reserva órfã**, `R-15`) |
| **3** | Dois consumos concorrentes | Atendimento com pacote, registro `EM_ELABORACAO` | Duas T-02 sobre o mesmo registro | `UPDATE ... WHERE estado='EM_ELABORACAO'` (0 linhas na 2ª) **+** índice único parcial | Um `CONSUMO`; segunda transação sem efeito | Dois movimentos de consumo |
| **4** | Retry após timeout de finalização | Registro finalizado, consumo gravado, resposta perdida | Cliente repete T-02 | Índice único parcial → `23505` traduzido em sucesso idempotente | Um consumo; resposta consistente | Segunda baixa (FC-07 critério 3) |
| **5** | Dois pagamentos simultâneos | `valor_liquido = 100`, recebido `0` | Dois T-03 de `80` | Lock da cobrança; soma verificada após o lock | Um aceito (`80`), outro rejeitado por exceder saldo (RN-046) | Recebido `160 > 100` |
| **6** | Estorno seguido de novo pagamento | `PAGO` (`P1=300`) | T-04(`P1`) então T-03(`120`) | `UNIQUE(estorno.pagamento_id)`; derivação | `ESTORNADO` → `PARCIALMENTE_PAGO` (H2-11); `P1` e `E1` preservados | Pagamento apagado; estado travado em `ESTORNADO` |
| **7** | Cancelamento de cobrança após estorno | `ESTORNADO` com histórico | T-05 autorizada | `cancelada_em` com precedência máxima na derivação | `CANCELADO`; **todo** o histórico preservado (H2-12) | Movimentos apagados; RN-047 violado depois |
| **8** | Agendamentos concorrentes do mesmo profissional | Horário livre | Duas T-01 no mesmo intervalo | **Exclusion constraint** — decide no índice | Um criado; outro rejeitado por conflito | Dois válidos e sobrepostos (`docs/05` §6) |
| **9** | Remarcação com cobrança avulsa existente | Agendamento 20/08, cobrança `PENDENTE`, `data_referencia = 20/08` | T-01 remarca para 03/09 | Mesma transação; `PROP-RN-2.2-01` opção A | Agendamento e `data_referencia` = 03/09, com auditoria | Data divergente da do atendimento; alteração não auditada |
| **10** | Cancelamento de agendamento com cobrança paga | Agendamento ativo, cobrança `PAGO` | T-08/cancelamento | `PROP-RN-2.2-02` opção A | Agendamento `CANCELADO`; cobrança **inalterada**, sinalizada para resolução explícita | Cancelamento ou estorno automático da cobrança (**escalada de privilégio**) |
| **11** | Pacote expirando entre leitura e gravação | `validade_ate` próxima | T-01 em execução no limite | **Não é race:** a validade é comparada com a **data civil do atendimento** (HOM-05), valor fixo na transação — não com "agora" | Decisão determinística e reproduzível | Aceitar/rejeitar conforme o relógio no meio da transação |
| **12** | Pacote cancelado com agendamento futuro | Reserva ativa; pacote cancelado | T-06/cancelamento do pacote ‖ T-02 posterior | Nenhum efeito automático (HOM-05, RN-071); T-02 valida elegibilidade sob o lock | Agendamento e reserva **preservados**; finalização **rejeitada** até resolução explícita (13.6) | Baixa silenciosa em pacote cancelado; cancelamento automático do agendamento |

**Observações extraídas da simulação:**

- **Cenário 11 revela um não-problema:** por HOM-05 usar a data do atendimento e não "agora", a expiração deixa de ser condição de corrida. Decisão de regra que produziu robustez técnica.
- **Cenário 12 revela um risco operacional real:** a finalização clínica pode falhar por causa de um pacote cancelado dias antes. É o comportamento que I-33/H2-05 determinam, mas exige que a resolução prevista em `docs/05` §13.6 seja **visível na operação**, não descoberta no momento da finalização. Registrado como `R2.2-17`.
- **Cenário 4 confirma** que a idempotência não depende de lock nem de isolamento — apenas da constraint e da tradução do erro.

---

## 26. Riscos

### Críticos

| ID | Risco | Mitigação | Residual |
| --- | --- | --- | --- |
| `R2.2-01` | **Consumo duplicado** (R-06) | Quatro camadas (§16.3); cenários 3 e 4 | Muito baixo |
| `R2.2-02` | **Race de agenda** (R-01) | Exclusion constraints; cenário 8 | Baixo nos dois conflitos cobertos |
| `R2.2-03` | **Perda silenciosa de objeto SQL** em operação de migração | `H2.2-18`: migrations dedicadas + testes que verificam o **efeito** de cada constraint | Médio até `P2.2-08` |

### Altos

| ID | Risco | Mitigação | Residual |
| --- | --- | --- | --- |
| `R2.2-04` | Vazamento clínico via `evento_auditoria.contexto` | Lista branca por ação; teste que rejeita chaves fora da lista | Médio — depende de revisão de código |
| `R2.2-05` | Conteúdo clínico em `observacao_administrativa` | **Não enforçável por schema**; regra de aplicação e autorização | Médio — reconhecido |
| `R2.2-06` | **Estrutura clínica homologada antes da definição do conteúdo** | A homologação fixou a **forma** (um registro por atendimento, componentes), não os **campos**. A definição clínica (`P2.2-07`) pode revelar necessidade de estrutura distinta | Médio — reversibilidade média declarada em §21.5 |
| `R2.2-07` | Disciplina de lock esquecida em novo caminho de escrita | Mutações de M7/M8 concentradas em um serviço por módulo; testes de concorrência | Médio |
| `R2.2-17` | **Finalização clínica rejeitada por pacote cancelado dias antes** (cenário 12) | Resolução de `docs/05` §13.6 precisa ser exposta na operação, não descoberta na finalização | Médio — **item de UX/processo, não de schema** |

### Médios

| ID | Risco |
| --- | --- |
| `R2.2-08` | Desempenho de estados derivados — mitigado pelo volume do MVP; evolução por view |
| `R2.2-09` | Race `bloqueio_agenda` × `agendamento` — estado tolerado por AGD-004 |
| `R2.2-10` | Redundância `historico_agendamento` × `evento_auditoria` — papéis distintos, documentados |
| `R2.2-11` | Alteração retroativa de receita prevista por remarcação — auditada; `PROP-RN-2.2-01` |
| `R2.2-12` | Leitura da FK M7→M6 como violação de fronteira — parecer em §15 |
| `R2.2-16` | **Base Imutável não versionada** — governança; **não resolvido nesta tarefa por instrução** |
| `R2.2-18` | Cobrança de agendamento cancelado permanece na previsão (`PROP-RN-2.2-02`) — mitigação operacional |

### Baixos

`R2.2-13` fragmentação de índice por UUID aleatório; `R2.2-14` CPF único bloqueando cadastro cujo CPF pertence a paciente inativo; `R2.2-15` alvo polimórfico de auditoria sem FK.

---

## 27. Matriz final de homologação — **TODAS HOMOLOGADAS**

> **Homologação conjunta de Bruno Menezes Noronha — 19/08/2026.** Nenhum item permanece pendente de decisão nesta matriz. O que resta em aberto está em §28.1 e é de outra natureza (definição clínica, jurídica, técnica de versão ou governança documental).

| ID | Tema | Parecer da revisão | Conteúdo consolidado | Impacto | Status |
| --- | --- | --- | --- | --- | --- |
| **H2.2-01** | Convenções físicas | **APROVAR** | Manter; reforçada a regra "enum só se enumerado em fonte" | Todo o schema | **HOMOLOGADA** |
| **H2.2-02** | `reserva_sessao` | **APROVAR COM CORREÇÃO** | Enum `situacao` **removido**; representação por fatos | M7, T-01/02/08 | **HOMOLOGADA** |
| **H2.2-03** | Unicidade de reserva ativa | **APROVAR COM CORREÇÃO** | Predicado passa a `encerrada_em IS NULL`; unicidade **por agendamento** confirmada contra `docs/06` §9 | M7 | **HOMOLOGADA** |
| **H2.2-04** | Consumo único | **APROVAR COM CORREÇÃO** | Passa a **índice único parcial `WHERE tipo='CONSUMO'`** + CHECK | M7, T-02 | **HOMOLOGADA** |
| **H2.2-05** | Lock do agregado Pacote | **APROVAR** | Mantido; comparados 4 mecanismos (§17.1) | T-01/02/06/08 | **HOMOLOGADA** |
| **H2.2-06** | Conflito de agenda | **APROVAR COM CORREÇÃO** | **`CONCLUIDO` incluído** nos estados ativos; simetria com bloqueio descartada por AGD-004 | M5 | **HOMOLOGADA** |
| **H2.2-07** | Lock da Cobrança + idempotência | **APROVAR** | Mantido | M8 | **HOMOLOGADA** |
| **H2.2-08** | Estorno fisicamente integral | **APROVAR** | Mantido — estorno parcial irrepresentável | M8 | **HOMOLOGADA** |
| **H2.2-09** | Estados derivados | **APROVAR** | Mantido; justificativa refeita por estado, não por princípio | Leitura | **HOMOLOGADA** |
| **H2.2-10** | Data de referência | **APROVAR COM CORREÇÃO** | Materialização mantida; regra de atualização substituída (§20.3) | M8, T-01 | **HOMOLOGADA** |
| **H2.2-11** | FK M7→M6 | **APROVAR** | Manter FK com `RESTRICT`; parecer em quatro camadas (§15) | M7 | **HOMOLOGADA** |
| **H2.2-12** | Vínculo de pacote só no agendamento | **APROVAR** | Mantido; reforçado pela remoção de `atendimento.profissional_id` | M5/M6/M7 | **HOMOLOGADA** |
| **H2.2-13** | Inativação, sem `deleted_at`, CPF | **APROVAR COM CORREÇÃO** | Classificação conceito a conceito (§23.1); **CPF normalizado e único; inativos abrangidos — localizar/reativar, nunca recadastrar** (§11.4.1–11.4.2) | Todo o schema | **HOMOLOGADA** |
| **H2.2-14** | Auditoria append-only | **APROVAR COM CORREÇÃO** | `resultado` deixa de ser enum; proteção priorizada (§22.2) | M10 | **HOMOLOGADA** |
| **H2.2-15** | Temporalidade tipada | **APROVAR** | Mantido | Todo o schema | **HOMOLOGADA** |
| **H2.2-16** | **P-CLIN** | **REJEITAR a recomendação da REV. 1** | **SUBSTITUÍDA e HOMOLOGADA:** **Alternativa A** — um registro por atendimento, aplicada ao modelo físico (§21) | M6 | **HOMOLOGADA** |
| **H2.2-17** | Gate de primeira finalização | **APROVAR** | Mantido; suspeita de estado inventado **refutada** (§16.5) | M6, T-02 | **HOMOLOGADA** |
| **H2.2-18** | Objetos fora do Prisma | **APROVAR** | Mantido; inclui `valor_liquido` (§19.2) e proteção append-only (§22.2) | Processo | **HOMOLOGADA** |
| **P-CLIN** | Multiplicidade / decomposição / aggregate root | **BLOQUEADO → resolvido** | **Alternativa A homologada** para multiplicidade e decomposição; **aggregate root permanece deliberadamente aberto** (`P2.2-10`, §21.6) | M6, governança | **HOMOLOGADA (parcial — ver §21.6)** |
| **`PROP-RN-2.2-01`** | Data de referência após remarcação | **BLOQUEADO POR REGRA AUSENTE → resolvido** | **Opção A — dinâmica**, com auditoria obrigatória | IND-005, M8 | **HOMOLOGADA** |
| **`PROP-RN-2.2-02`** | Cancelamento de agendamento × cobrança | **BLOQUEADO POR REGRA AUSENTE → resolvido** | **Opção A — nunca automático**; resolução exige operação explícita e autorizada | M5/M8, autorização | **HOMOLOGADA** |

**Nenhum ID morto:** todos os `H2.2-01`..`H2.2-18` permanecem vigentes e homologados; nenhum foi removido ou fundido. Os **elementos** removidos estão listados em §2.2 e não constituíam decisões próprias.

**Condições expressas registradas na homologação:** (a) `H2.2-06` — dependências técnicas, inclusive `btree_gist`, **devem ser verificadas antes da implementação**; (b) `H2.2-11` — a FK **não transfere ownership** nem autoriza M7 a acessar conteúdo clínico de M6.

---

## 28. Pendências, limites Prisma/PostgreSQL e plano

### 28.1 Pendências

| ID | Pendência | Natureza |
| --- | --- | --- |
| ~~**P-CLIN**~~ | Multiplicidade e decomposição | **ENCERRADA em 19/08/2026** — Alternativa A homologada (§21) |
| **`P2.2-10`** | **Aggregate root de `Atendimento`** | **Aberta por decisão expressa** — H2-06 vigente; reavaliar somente se surgir necessidade concreta (§21.6) |
| **`P2.2-11`** | Absorção de `PROP-RN-2.2-01` e `PROP-RN-2.2-02` em `docs/03-regras-negocio.md` | **Governança documental** — até lá, este documento é a fonte vigente dessas regras |
| `P2.2-01` | Encadeamento de retificação de retificação | Modelagem — **deixou de depender de P-CLIN**; questão isolada da cadeia |
| `P2.2-02` | Recibo com numeração sequencial persistida? | Regra de negócio |
| ~~`P2.2-03`~~ | **ENCERRADA** → `PROP-RN-2.2-01` homologada | — |
| ~~`P2.2-04`~~ | **ENCERRADA** → `PROP-RN-2.2-02` homologada | — |
| `P2.2-05` | Escopo técnico "fisioterapeuta ↔ paciente relacionado" (`H-02`) | Autorização — `docs/04` §7.1 |
| `P2.2-06` | Retenção, descarte e pedido de eliminação (LGPD) | **Jurídica** |
| `P2.2-07` | Conteúdo e validação dos componentes clínicos do `registro_clinico` | **Clínica** — não substituída pela homologação de P-CLIN |
| `P2.2-08` | Versões de PostgreSQL e Prisma; verificação da Categoria C | Técnica |
| `P2.2-09` | Versionamento dos documentos e da Base Imutável | Governança — fora desta tarefa |

### 28.2 Prisma × PostgreSQL — classificação A / B / C

> **Base da classificação:** o repositório **não fixa versão** de Prisma nem de PostgreSQL. **Nenhuma documentação externa foi consultada nesta tarefa**, logo **nenhum suporte de versão é declarado como fato verificado**. A categoria C existe precisamente para os itens cuja resposta depende da versão que for fixada.

**Categoria A — representável diretamente no Prisma Schema**

Tabelas, colunas, obrigatoriedade, valores padrão; tipos nativos (`uuid`, `timestamptz`, `date`, `time`, `decimal(12,2)`); enums; FKs e ações referenciais; `@unique` / `@@unique` simples; `@@index` simples.

Cobre: U-01, U-02, U-05, U-06, U-07, U-08, U-09, U-10, U-11, U-12, **U-13**; todas as FKs; IDX-A3, A5, A6, M1, P1, C1, F1, F2, F3, N1, **N2**, N3, **N4**, U1, U2, U3, S1.

**Categoria B — exige migration SQL complementar (alta confiança; confirmar na versão fixada)**

| Recurso | Onde | Por quê |
| --- | --- | --- |
| **Índices únicos parciais** | U-03/IDX-M2 (consumo), U-04/IDX-R2 (reserva ativa), IDX-A4, IDX-P2, IDX-C2, IDX-R1 | O schema declarativo não aceita predicado em índice |
| **CHECK constraints** | Todas de §10.2, incluindo **RN-042** | Não há construção de `CHECK` no schema declarativo |
| **Exclusion constraints** | IDX-A1, IDX-A2 (agenda) | Não há construção equivalente |
| **Triggers** | Imutabilidade condicional de `registro_clinico` e `retificacao_clinica` | Fora do schema declarativo |
| **Privilégios (`REVOKE`)** | Append-only de auditoria, movimentos, pagamentos, estornos | Fora do schema declarativo; exige separação entre role de migration e role de runtime |
| **Restrição de clínica única** | `clinica` | Índice sobre expressão constante ou CHECK |

**Categoria C — dependente de versão — VERIFICAR ANTES DA IMPLEMENTAÇÃO**

| Recurso | Questão a verificar |
| --- | --- |
| **Extensão `btree_gist`** | Se a versão fixada permite declarar extensões no schema ou se a criação deve viver só na migration |
| **Coluna gerada `valor_liquido`** | Nível de suporte a colunas geradas — leitura, escrita e comportamento em migração. **Fallback definido:** coluna comum + CHECK, ou cálculo na leitura (§19.2) |
| **Preservação de objetos não representáveis** | Se operações de diff/reset preservam índices parciais, CHECKs, exclusion constraints e triggers, ou se podem descartá-los. **Este é o item de maior risco** (`R2.2-03`) |
| **Transação interativa com `FOR UPDATE`** | Forma suportada de executar SQL bruto dentro da transação (§17.1, §17.3) |
| **Nível de isolamento por transação** | Verificar disponibilidade. **A recomendação não depende disso** — `READ COMMITTED` com locks explícitos é suficiente |
| **Mapeamento de erro por constraint** | Se é possível distinguir **qual** constraint foi violada, para escolher entre resposta idempotente (consumo) e erro de conflito (agenda) |

**`H2.2-18`:** objetos das categorias B e C vivem em **migrations SQL controladas, versionadas e revisadas**, acompanhadas de **testes de integração que verificam a existência e o efeito de cada constraint crítica**. O teste é a proteção contra perda silenciosa.

### 28.3 Decisões que pertencem à API, não à persistência

Transporte e obtenção da chave de idempotência; códigos de erro e status HTTP; formato de paginação; contratos de leitura de saldo; cache; mecanismo de busca de paciente (PAC-002); geração de URL temporária de anexo. A persistência define apenas as **colunas e constraints** de suporte.

### 28.4 Plano posterior — implementação ainda não autorizada

1. ~~Homologação de `H2.2-01`..`H2.2-18`, de P-CLIN e das duas `PROP-RN`~~ — **CONCLUÍDA em 19/08/2026**.
2. **PRÓXIMA ETAPA AUTORIZADA A PLANEJAR:** fixar as versões de PostgreSQL e Prisma e **verificar toda a Categoria C** (`P2.2-08`), produzindo em seguida o **plano de implementação física**. A homologação **não** autoriza executar os passos 4 em diante.
3. Etapa 2.3 sugerida — modelo de leitura, escopo clínico (`P2.2-05`) e paginação, antes de congelar índices.
4. `schema.prisma` (Categoria A).
5. Migrations SQL controladas (Categorias B e C).
6. Testes de constraint: `T-AGD-CONCURRENCY`, `T-PKG-CONCURRENCY`, `T-PKG-RETRY`, `T-FIN-OVERPAY`, `T-FIN-REFUND`, imutabilidade de auditoria e de registro finalizado.
7. Serviços transacionais T-01..T-09 com a ordem de locks de §17.1.
8. **Somente então** — endpoints, DTOs, OpenAPI.

---

## 29. Declaração de conformidade

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — **não editado, não resumido, não reinterpretado**; md5 inalterado.
- `docs/02` a `docs/06` — **não alterados**.
- Nenhum `schema.prisma`, DDL, migration, banco, entidade NestJS, endpoint, DTO ou frontend criado.
- Nenhuma dependência instalada; nenhum `package.json` criado.
- Nenhum commit, push, PR, merge, rebase ou deploy realizado; não se trabalhou em `main`.
- Nenhum microserviço, multitenancy, CQRS, event sourcing, fila ou consistência eventual.
- **P-CLIN resolvida por homologação expressa** (Alternativa A, 19/08/2026) e aplicada ao modelo físico. **Aggregate root de `Atendimento` permanece deliberadamente em aberto** (`P2.2-10`).
- Efeito de governança sobre H2-03 (encerramento parcial) e H2-06 (**sem alteração**) **declarado explicitamente** (§1.4, §21.6), não minimizado.
- `PROP-RN-2.2-01` e `PROP-RN-2.2-02` são regras homologadas registradas **neste** documento; `docs/03` não foi alterado (`P2.2-11`).
- Nenhum material proprietário do iGUT; nenhum dado real de paciente; nenhum dado clínico exposto.
- **Nenhuma decisão marcada como homologada sem aprovação explícita de Bruno Menezes Noronha**, registrada em §1.4 com data.
- A homologação **não** autoriza `schema.prisma`, migrations, dependências, commit, push, merge ou deploy.

---

**Fim do documento — HOMOLOGADO — REV. 2 — `docs/07-modelo-persistencia.md` — ETAPA 2.2 CONCLUÍDA.**
