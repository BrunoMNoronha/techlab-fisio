# Pacote de Decisão da Disponibilidade do Profissional (`PRO-003`) — `PRO-PREP3`

> **Documento:** `docs/16-pacote-decisao-disponibilidade-profissional.md`
> **Projeto:** TechLab Fisio
> **Frente:** Profissionais (módulo M3) — disponibilidade e horários (`PRO-003`)
> **Status:** **HOMOLOGADO — `D-PRO3-01`..`D-PRO3-10` APROVADAS INTEGRALMENTE CONFORME AS RECOMENDAÇÕES POR BRUNO MENEZES NORONHA EM 17/09/2026** (TLF-BASE-V1 §15, item 1), inclusive as escolhas `P-PRO3-01`..`P-PRO3-06` e a **alteração estrutural de banco** de `D-PRO3-06` (CHECK de vigência, `vigencia_inicio NOT NULL` e índice). As marcas **[DERIVADA]**/**[ESCOLHA]** permanecem como registro de origem. **Na homologação (REV. 2), a implementação de runtime, schema e migration ainda NÃO estava autorizada — esse registro histórico é preservado.** A implementação foi autorizada expressamente por Bruno Menezes Noronha em ato posterior e **EXECUTADA na REV. 5** (§5.3), em branch local não publicada.
> **Data:** 17 de setembro de 2026
> **Base medida:** workspace local sobre `bd772a3`, com `docs/14` (REV. 23) e `docs/15` (REV. 2, homologado) locais.
> **Natureza:** registro normativo das decisões de PRO-003, originado do pacote de análise `PRO-PREP3`. **Nenhum código, schema, migration ou teste alterado.** Nenhuma implementação autorizada.
> **Por que um documento próprio:** pré-requisito explícito de AGD-A (`docs/15` `D-AGD-01`, §5.2); PRO-003 pertence ao módulo M3, distinto de M2 (`docs/14`) e M5 (`docs/15`).

---

## 1. Fontes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` §5.3 ("Disponibilidade e horários"), §5.5, §6, §8 ("Serviço e disponibilidade profissional"), §9, §13 — **não alterada**.
- `docs/02` PRO-003, PRO-005, AGD-001, AGD-002; `docs/03` RN-008, RN-014, RN-016.
- `docs/04` §4 ("Gerenciar profissionais"), §5.2 (`profissionais.gerenciar`: "Cadastro, disponibilidade, serviços e situação").
- `docs/05` FC-03 (passo 6; teste `T-AGD-OUTSIDE-AVAILABILITY`), remarcação (§3).
- `docs/06` §6 M3, §7.3, cardinalidade Profissional — Disponibilidade `1 — *`.
- `docs/07` §7.3, §10.2, §17.2, §17.4 (passo 3 de T-01), §24.1 (H2.2-15).
- `docs/09` §12.2 (catálogo de ações), §13.6.
- `docs/14` `D-CFG-13`, `D-CFG-18`, `D-CFG-59`..`D-CFG-63`; `docs/15` `D-AGD-01`, `D-AGD-04`, `D-AGD-06`, `D-AGD-11`, `D-AGD-12`.

## 2. Fatos de partida

| # | Fato | Evidência |
| --- | --- | --- |
| FP-01 | Tabela `disponibilidade_profissional` existe: `id`, `profissional_id` FK NN `RESTRICT`, `dia_semana smallint` NN, `hora_inicio`/`hora_fim time` NN, **`vigencia_inicio date` anulável**, **`vigencia_fim date` anulável**, `criado_em` | migration `20260820121255`; `schema.prisma` |
| FP-02 | CHECKs físicos: `ck_disponibilidade_profissional_intervalo` (`hora_fim > hora_inicio`) e `ck_disponibilidade_profissional_dia_semana` (0..6). **Não há** CHECK de vigência (`vigencia_fim >= vigencia_inicio`), unicidade, exclusão de sobreposição nem índice além da PK e da FK | migration `20260822144354`; `docs/08` §8 |
| FP-03 | `docs/07` §7.3: "Mudanças criam **novas vigências**; **não reescrevem atendimentos passados** (PRO-003)"; `docs/07` §17.2: disponibilidade é garantida no **backend** porque "depende do fuso e de vigência" | `docs/07` |
| FP-04 | Vigência é **data civil** (`date`), horário é **hora local recorrente** (`time` + `dia_semana`) | `docs/07` §24.1 (H2.2-15) |
| FP-05 | Permissão `profissionais.gerenciar` ("Cadastro, disponibilidade, serviços e situação"), concedida **somente** ao Administrador | `catalogo-rbac.ts`; `docs/04` §4 |
| FP-06 | Catálogo de auditoria **não** tem ação para disponibilidade; `profissional.situacao.alterada` cobre só PRO-005; `configuracao.alterada` abrange só entidades de CFG (`docs/09` §13.6) | `audit.catalog.ts`; `docs/09` |
| FP-07 | PRO-003 **não** tem linha de auditoria (PRO-005 tem: "alteração de situação deve ser atribuível") | `docs/02` |
| FP-08 | Não há rota de profissionais; `ProfissionalService` só oferece `alterarSituacao` interno (sem RBAC exposto) | `apps/api/src/profissional/` |
| FP-09 | Tabela sem linhas produzidas por runtime (nenhum escritor existe); só testes de guarda física a exercitam | `packages/database/test/guard-anti-drift.spec.ts` |
| FP-10 | Regra de contenção da clínica pronta e reutilizável (função pura por janelas + fuso) | `apps/api/src/agenda/horario-funcionamento.regra.ts`; `docs/14` §5 |
| FP-11 | Camadas independentes, interseção só na agenda, sem validação cruzada com a grade da clínica | `docs/14` `D-CFG-62` |
| FP-12 | A agenda rejeita fora da disponibilidade com `422 FORA_DA_DISPONIBILIDADE`, no passo 9, após o horário da clínica | `docs/15` `D-AGD-04` |

## 3. Questões e alternativas centrais

### 3.1 Modelo de alteração (resolvido por `D-PRO3-01`: opção B)

| Opção | Descrição | Custo / risco |
| --- | --- | --- |
| **A — Grade substituível** (como CFG-002) | `PUT` substitui todas as linhas; vigência ignorada | Simples; **contraria** `docs/07` §7.3 ("mudanças criam novas vigências"); impede programar mudança futura sem afetar a agenda já marcada |
| **B — Versões com vigência** *(recomendada)* | Cada definição é uma **versão** (conjunto de janelas) válida a partir de uma data; a versão anterior é encerrada na véspera; versões futuras ainda não iniciadas podem ser substituídas | Aderente a `docs/07`; permite programar mudança ("a partir de 01/10"); custo moderado de validação |
| C — Vigência por janela, CRUD linha a linha | Cada janela com datas próprias | Máxima flexibilidade; estados intermediários inválidos e validação combinatória — rejeitada |

### 3.2 Onde garantir não sobreposição

Backend sob lock do profissional (precedente `D-CFG-16`) × exclusion constraint com `daterange` e `btree_gist`. A exclusão física de sobreposição **entre janelas de versões distintas** exigiria constraint composta de data e hora — desproporcional.

## 4. Decisões homologadas

### 4.1 `D-PRO3-01` — Modelo por versões com vigência **[DERIVADA]** (forma **[ESCOLHA]**)

- Adota-se a **opção B**.
- **Versão** = conjunto de janelas de um profissional com o mesmo par (`vigencia_inicio`, `vigencia_fim`). Não há tabela de versão: a versão é o agrupamento dessas linhas.
- `vigencia_inicio` é **sempre preenchida** pela API; `vigencia_fim = NULL` significa versão **aberta** (sem término).
- Invariantes, por profissional:
  1. versões **não se sobrepõem** em datas;
  2. no máximo **uma** versão aberta, e ela é a de maior `vigencia_inicio`;
  3. dentro da versão, as janelas seguem **as mesmas regras da grade da clínica**: múltiplas por dia, no máximo 4, sem sobreposição e **sem adjacência**, `HH:MM` 00:00..23:59, `hora_fim > hora_inicio`, sem meia-noite (`D-CFG-13`, `D-CFG-14`, `D-CFG-18`, `D-CFG-59`);
  4. versão com **zero janelas** é válida e significa "sem disponibilidade no período". Como a tabela só guarda janelas, esse caso é representado **pelo encerramento da versão anterior sem nova versão** (`D-PRO3-03`).
- Ausências pontuais (férias, curso, consulta médica) **não** são versões: usam **bloqueio de agenda** (AGD-004, fatia AGD-C).

### 4.2 `D-PRO3-02` — Contrato HTTP **[ESCOLHA]**

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `GET /profissionais/:profissionalId/disponibilidade` | `200` | `400` id malformado; `404 PROFISSIONAL_NAO_ENCONTRADO` |
| `PUT /profissionais/:profissionalId/disponibilidade` | `200` | `400`; `404 PROFISSIONAL_NAO_ENCONTRADO`; `404 CLINICA_NAO_CONFIGURADA`; `422 VIGENCIA_RETROATIVA` |

- **Corpo do `PUT`**, exatamente: `{ vigenciaInicio: "YYYY-MM-DD", janelas: [{ diaSemana, horaInicio, horaFim }] }` — corpo estrito, sem coerção; data civil válida no calendário gregoriano.
- **Resposta** (`GET` e `PUT`), exatamente: `{ versoes: [{ vigenciaInicio, vigenciaFim, janelas: [...] }] }` com **todas** as versões, ordenadas por `vigenciaInicio` **decrescente**; janelas ordenadas por dia e início; `vigenciaFim` é `null` na versão aberta. No `PUT`, o corpo é o estado após a operação, inclusive no no-op.
- Sem paginação (volume por profissional é pequeno); `GET` com `Cache-Control: no-store`; `ProtecaoCsrfGuard` só no `PUT`.
- **Sem `DELETE`** e sem edição linha a linha.
- Profissional **inativo** pode ter a disponibilidade consultada e alterada (PRO-005 já impede novos agendamentos).
- Rotas no módulo de profissionais (M3), independentes da fatia de cadastro, mas **dependentes de existir profissional** (PRO-001 — ver §5).

### 4.3 `D-PRO3-03` — Semântica do `PUT` **[ESCOLHA]**

Dados `D = vigenciaInicio` e `hoje` = data civil corrente no fuso da clínica (`D-CFG-60`):

1. `D < hoje` → **`422 VIGENCIA_RETROATIVA`**, sem mutação. Datas passadas nunca são alteradas.
2. Versões com `vigencia_inicio >= D` (futuras, ou iniciadas exatamente em `D`) são **substituídas**: suas linhas são removidas fisicamente. Ainda não produziram efeito passado, porque `D >= hoje`.
3. A versão que contém `D - 1` (com `vigencia_inicio < D` e `vigencia_fim` nulo ou `>= D`) é **encerrada**: `vigencia_fim = D - 1`. Linhas de dias passados **não** são removidas nem reescritas.
4. Se `janelas` não for vazio, insere-se a nova versão com `vigencia_inicio = D` e `vigencia_fim = NULL`.
5. Se `janelas` for vazio, nada é inserido: a partir de `D`, o profissional fica **sem disponibilidade** até nova definição.
6. **No-op:** se o estado resultante for idêntico ao vigente, responde `200` sem escrita. Exemplo: já existe versão aberta iniciada em `D`, com as mesmas janelas e sem versões posteriores.

- **Motivação:** implementa "mudanças criam novas vigências" sem reescrever o passado e permite programar mudanças. A remoção física restringe-se a versões **ainda não iniciadas ou iniciadas no próprio dia `D >= hoje`**. É o único caso de exclusão física, mesmo racional de `D-CFG-15`.
- **Limitação aceita:** uma versão iniciada **hoje** e substituída hoje não deixa rastro da definição anterior.

### 4.4 `D-PRO3-04` — Regra de disponibilidade para a agenda **[DERIVADA]**

Para o passo 9 de `D-AGD-04` (criação e toda remarcação), com a conversão de `D-CFG-60`:

- A **versão aplicável** é a do profissional com `vigencia_inicio <= data_local(inicio)` e `vigencia_fim` nulo ou `>= data_local(inicio)`.
- O agendamento está **disponível** se e somente se:
  - existe versão aplicável;
  - `data_local(inicio) = data_local(fim)`;
  - existe **uma** janela dessa versão, do dia da semana local, que contém `[inicio, fim)`, com o mesmo predicado de `D-CFG-61`.
- Caso contrário: **`422 FORA_DA_DISPONIBILIDADE`** (`D-AGD-04`), sem expor janelas.
- Implementação recomendada: **reutilizar** a função pura de contenção (FP-10) sobre as janelas da versão aplicável, sem duplicar a lógica.
- Leitura **sem lock** na transação de T-01. Um `PUT` concorrente é tolerado, pelo mesmo racional de `D-CFG-61`/`D-CFG-63`.
- **Sem validação cruzada** com a grade da clínica (`D-CFG-62`).

### 4.5 `D-PRO3-05` — Agendamentos existentes e retroatividade **[DERIVADA]**

- Mesma estratégia flexível de `D-CFG-63`. O `PUT` **não consulta** a agenda e nunca cancela, remarca ou altera agendamentos.
- A nova versão vale só para criações e remarcações que a consultem depois.
- Agendamentos existentes fora da nova disponibilidade permanecem válidos e seguem as transições normais. A remarcação revalida contra a versão aplicável à **nova** data (RN-016).
- PRO-003 "mudanças não reescrevem atendimentos passados" é atendida em duplo sentido: agendamentos têm `inicio`/`fim` próprios e versões passadas não são alteradas (`D-PRO3-03`).
- **Sem** aviso de agendamentos afetados no MVP (melhoria futura).

### 4.6 `D-PRO3-06` — Invariantes físicas **[ESCOLHA — estrutural]**

- **Autorizável, com aprovação expressa, a futura migration** com:
  - `CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)`;
  - `vigencia_inicio SET NOT NULL`. Pré-condição verificável: a tabela não tem linhas de runtime (FP-09); fixtures de teste devem ser ajustadas;
  - índice `(profissional_id, vigencia_inicio)` para a leitura da versão aplicável.
- **Não** se cria exclusion constraint de sobreposição entre versões nem entre janelas: garantia no backend, sob lock (`D-PRO3-07`), como em `D-CFG-16`.
- Nomes físicos, golden SQL, inventário protegido e alinhamento de `docs/07` §7.3/§10 ficam para a fatia de implementação, com `docs/07` atualizado **só após a migration integrada**.
- **Alternativa:** nenhuma migration, com as invariantes só no backend. Mais barata, mas mantém `NULL` ambíguo em `vigencia_inicio` e deixa a coerência das datas sem garantia física.

### 4.7 `D-PRO3-07` — Concorrência **[DERIVADA]**

- `PUT` em transação única serializada por `SELECT ... FOR UPDATE` na linha de `profissional`. O cálculo das versões afetadas, a comparação de no-op e as escritas ocorrem **sob o lock**.
- Última escrita válida prevalece. Não há coluna de versão nem `If-Match`, e atualização perdida não é detectada (mesma limitação de `D-CFG-05`).
- `hoje` é calculado **dentro** da transação, com o fuso lido nela.

### 4.8 `D-PRO3-08` — Autorização **[DERIVADA]** e leitura por outros papéis **[ESCOLHA]**

- `GET` e `PUT` exigem **`profissionais.gerenciar`** (FP-05). Sem sessão → `401`; sem permissão → `403` **sem** evento (`L-07`). Nenhuma permissão nova.
- **[ESCOLHA]** O Fisioterapeuta **não** consulta nem altera a própria disponibilidade por estas rotas. A matriz não prevê essa operação, e PRO-003 tem o Administrador como ator.
- A agenda aplica a regra internamente (`D-PRO3-04`) sem exigir `profissionais.gerenciar` do ator (precedente `D-CFG-65`).
- A exposição da disponibilidade na tela da agenda fica fora deste pacote. `GET /agenda/opcoes` (`D-AGD-13`) **não** a inclui.

### 4.9 `D-PRO3-09` — Auditoria **[ESCOLHA]**

- **Recomendação: sem evento de auditoria** para alterações de disponibilidade no MVP.
  - PRO-003 não exige atribuição (FP-07).
  - O catálogo não tem ação adequada (FP-06).
  - A disponibilidade é dado operacional, não sensível (TLF-BASE §4.3 exige rastreabilidade de alterações **sensíveis**).
  - O modelo por versões preserva o histórico **do que** vigorou e **quando**, mas não **quem** alterou.
- Limitação declarada: autoria da mudança não registrada.
- **Alternativa 1:** nova ação `profissional.disponibilidade.alterada` (`alvo_tipo = "profissional"`, `contexto` vazio). Exige ampliar o catálogo de `docs/09`.
- **Alternativa 2:** coluna `criado_por_usuario_id` nas linhas. É migration adicional e não atribui o encerramento de versões.

### 4.10 `D-PRO3-10` — Estados vazios e erros **[DERIVADA]**

- Profissional sem versões → `200 { versoes: [] }`. A agenda rejeita todo agendamento com `FORA_DA_DISPONIBILIDADE`, em modo fail-closed, sem "disponível sempre" implícito, mesmo racional de `D-CFG-58`.
- Profissional inexistente → `404 PROFISSIONAL_NAO_ENCONTRADO`. Linha de clínica ausente no `PUT`, necessária para `hoje` → `404 CLINICA_NAO_CONFIGURADA`.
- Erros no envelope `{ erro }`; `500 FALHA_INTERNA` pelos contratos gerais.
- Códigos novos: `PROFISSIONAL_NAO_ENCONTRADO` e `VIGENCIA_RETROATIVA`. `FORA_DA_DISPONIBILIDADE` já está decidido em `docs/15`.

## 5. Registro de homologação e pendências

### 5.1 Escolhas homologadas (17/09/2026)

| ID | Decisão | Recomendação | Estado |
| --- | --- | --- | --- |
| P-PRO3-01 | Modelo por versões e sua forma (`D-PRO3-01`) | opção B | **HOMOLOGADA** |
| P-PRO3-02 | Contrato HTTP (`D-PRO3-02`) | `GET`/`PUT` por profissional, resposta com todas as versões | **HOMOLOGADA** |
| P-PRO3-03 | Semântica do `PUT`, retroatividade e substituição de versões futuras (`D-PRO3-03`) | regras 1–6 | **HOMOLOGADA** |
| P-PRO3-04 | **Migration** de CHECK de vigência, `NOT NULL` e índice (`D-PRO3-06`) | aprovar | **HOMOLOGADA** |
| P-PRO3-05 | Fisioterapeuta sem acesso à própria disponibilidade (`D-PRO3-08`) | manter sem acesso | **HOMOLOGADA** |
| P-PRO3-06 | Auditoria (`D-PRO3-09`) | sem evento; limitação declarada | **HOMOLOGADA** |

- **[DERIVADAS] homologadas em bloco** na mesma data: `D-PRO3-04`, `D-PRO3-05`, `D-PRO3-07`, `D-PRO3-10` e as partes derivadas de `D-PRO3-01` e `D-PRO3-08`.

### 5.2 Pendências abertas após a homologação

| Item | Estado |
| --- | --- |
| Implementação de PRO-003 (rotas, regra de versões, migration de `D-PRO3-06`) | **IMPLEMENTADA E MEDIDA** em branch local `agent/pro-003-disponibilidade-profissional`, a partir de `origin/main` = `92bcf6e` — **NÃO PUBLICADA** (§5.3; `docs/10` §6-AF) |
| Consumo da regra pela agenda (`D-PRO3-04`) | **REGRA MATERIALIZADA E TESTADA, SEM CONSUMIDOR** — `VerificadorDisponibilidadeProfissional` existe e está coberto, mas AGD-A / T-01 ainda não existe para chamá-lo (§5.3) |
| Pacote mínimo de **PRO-001** (cadastro de profissional) e **PRO-004** (serviços realizados) | **HOMOLOGADO** — `docs/18` (`D-PRO1-01`..`D-PRO1-10`); fatia PRO-A implementada (`docs/10` §6-AD), integrada na branch local `integration/local-fase4`, não publicada na `main` — dependência de implementação desta frente e de AGD-A |
| Pacote mínimo de **PAC** (paciente administrativo e situação) | **HOMOLOGADO** — `docs/17` REV. 2 |
| Exposição da disponibilidade na interface da agenda; acesso do Fisioterapeuta à própria disponibilidade | **FORA DESTE PACOTE** (`D-PRO3-08`) |
| Aviso de agendamentos afetados por nova versão | **MELHORIA FUTURA** (`D-PRO3-05`) |
| Autoria das alterações de disponibilidade | **LIMITAÇÃO ACEITA** (`D-PRO3-09`) — reavaliável |

### 5.3 Registro de materialização (REV. 5 — 17/09/2026)

Registro **exclusivamente factual**, acrescentado em revisão posterior à homologação. **Nenhuma decisão `D-PRO3-01`..`D-PRO3-10` foi criada, alterada, reaberta ou reinterpretada**; §4 permanece como homologado em 17/09/2026.

| Decisão | Como foi materializada |
| --- | --- |
| `D-PRO3-01` | Versões como agrupamento de linhas por (`vigencia_inicio`, `vigencia_fim`); **sem** tabela de versão e **sem** linha de "versão vazia". Invariantes garantidas no backend sob lock. Janelas validadas pela função pura já homologada de CFG-002, sem duplicar o algoritmo |
| `D-PRO3-02` | `GET`/`PUT /profissionais/:profissionalId/disponibilidade`; **sem** `POST`, `PATCH` ou `DELETE`; corpo e resposta exatos; versões em `vigenciaInicio` decrescente e janelas por dia, início e fim; sem paginação; `no-store` no `GET`; CSRF só no `PUT` |
| `D-PRO3-03` | Regras 1–6 implementadas na função pura `estadoResultante` mais as três escritas físicas (remoção das versões com `vigencia_inicio >= D`, encerramento da anterior em `D-1`, inserção da nova quando a grade não é vazia); no-op por comparação de estados |
| `D-PRO3-04` | Função pura `avaliarDisponibilidadeProfissional` + adaptador transacional `VerificadorDisponibilidadeProfissional`, sem lock, delegando a contenção à função de CFG-002. **Não integrada a fluxo algum** — a agenda não existe |
| `D-PRO3-05` | O `PUT` não consulta, cancela, remarca, invalida nem altera agendamento; provado por `xmin` do agendamento, histórico vazio e ausência de evento |
| `D-PRO3-06` | Migration `20260917210000_disponibilidade_profissional_vigencia`, comprovada em reconstrução limpa e no golden; efeito de `NOT NULL`, do CHECK e a presença do índice provados contra o banco real |
| `D-PRO3-07` | Transação única com `SELECT ... FOR UPDATE` na linha do profissional; `hoje`, leitura, validação, no-op e escritas sob o lock; sem `If-Match`, coluna de versão ou ETag |
| `D-PRO3-08` | Ambas as rotas sob `profissionais.gerenciar`; nenhuma permissão nova; Fisioterapeuta sem acesso, inclusive ao próprio profissional; a regra da agenda não exige a permissão do ator |
| `D-PRO3-09` | **Nenhum** evento de auditoria criado ou reutilizado; nenhuma coluna de autoria. A limitação homologada permanece declarada |
| `D-PRO3-10` | `{ versoes: [] }`, `PROFISSIONAL_NAO_ENCONTRADO`, `CLINICA_NAO_CONFIGURADA`, `VIGENCIA_RETROATIVA`, `REQUISICAO_INVALIDA`, `401`, `403`, `FALHA_INTERNA`; nenhum código novo além dos já previstos |

A matriz `TD-01`..`TD-13` de §6 foi coberta integralmente; o detalhamento das provas, das baterias medidas, dos mutation challenges e das limitações está em `docs/10` §6-AF. **Limite declarado:** `TD-12` é provado de forma proporcional ao estado real, porque AGD-A ainda não existe (`docs/10` §6-AF.5).

## 6. Matriz de testes de aceite

| ID | Cenário | Esperado |
| --- | --- | --- |
| TD-01 | `PUT` com `vigenciaInicio = hoje` e grade válida, sem versões | `200`; uma versão aberta |
| TD-02 | Nova versão em `D` futuro com versão aberta iniciada antes | versão anterior com `vigenciaFim = D-1`; nova aberta em `D` |
| TD-03 | `PUT` com `D` anterior à versão futura já programada | versão futura removida; nova aberta em `D` |
| TD-04 | `vigenciaInicio` ontem (fuso da clínica, inclusive na virada UTC) | `422 VIGENCIA_RETROATIVA`; sem mutação |
| TD-05 | `janelas: []` a partir de `D` | versão anterior encerrada em `D-1`; nenhuma nova |
| TD-06 | Janelas com sobreposição, adjacência, 5/dia, `24:00`, segundos, meia-noite, data inválida (`2026-02-30`), chave extra | `400`; sem mutação |
| TD-07 | `PUT` idêntico ao estado vigente | `200` sem escrita |
| TD-08 | Profissional inexistente; inativo | `404`; `200` (inativo editável) |
| TD-09 | Sem sessão; sem `profissionais.gerenciar` (Recepção, Fisioterapeuta); sem CSRF | `401`; `403` sem evento; `403 REQUISICAO_NAO_AUTORIZADA` |
| TD-10 | Dois `PUT` concorrentes no mesmo profissional | serializados; versões nunca sobrepostas |
| TD-11 | Agenda (unitário da regra): dentro da versão aplicável; em data da versão encerrada; sem versão; fora das janelas; dia local ≠ dia UTC | conforme / conforme pela versão antiga / `FORA_DA_DISPONIBILIDADE` / idem / avaliado no dia local |
| TD-12 | Agendamento existente fora de nova versão | intacto; remarcação revalida contra a versão da nova data |
| TD-13 | Migration (`D-PRO3-06`) | `vigencia_fim < vigencia_inicio` e `vigencia_inicio NULL` rejeitados pelo banco |

## 7. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **5** | 17/09/2026 | **Registro factual de MATERIALIZAÇÃO** (§5.3) após autorização expressa de implementação por Bruno Menezes Noronha: `D-PRO3-01`..`D-PRO3-10` implementadas e medidas em branch local não publicada; §5.2 atualizada; cabeçalho passa a distinguir o que valia na homologação (REV. 2) do que foi autorizado depois. **Nenhuma decisão `D-PRO3-*` criada, alterada ou reaberta**; §4 e §6 preservados na íntegra. |
| **4** | 17/09/2026 | Atualização factual de §5.2 na integração local das quatro frentes: pacote mínimo de PRO-001/PRO-004 homologado em `docs/18` e fatia PRO-A implementada (antes registrado como "A INICIAR"). Nenhuma decisão `D-PRO3-*` criada, alterada ou reaberta; PRO-003 segue sem autorização de implementação. |
| **3** | 17/09/2026 | Atualização factual de §5.2: pacote mínimo de pacientes homologado (`docs/17` REV. 2). Nenhuma decisão alterada. |
| **2** | 17/09/2026 | **Homologação** por Bruno Menezes Noronha: `D-PRO3-01`..`D-PRO3-10` aprovadas integralmente conforme as recomendações, inclusive `P-PRO3-01`..`P-PRO3-06` e a migration futura de `D-PRO3-06`. Status, §4 e §5 atualizados (§5.1 registro; §5.2 pendências). Nenhum conteúdo decisório alterado; nenhum código alterado; implementação não autorizada. |
| **1** | 17/09/2026 | Pacote inicial `PRO-PREP3`: fatos, alternativas de modelo, `D-PRO3-01`..`D-PRO3-10` propostas (derivadas × escolhas), pendências `P-PRO3-01`..`P-PRO3-06` e matriz de aceite. Nada homologado; nenhum código alterado. |

---

**Fim — `docs/16-pacote-decisao-disponibilidade-profissional.md`.**
