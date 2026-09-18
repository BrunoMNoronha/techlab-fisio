# Pacote de Decisão da Agenda (`AGD-001`..`AGD-009`) — `AGD-PREP0`

> **Documento:** `docs/15-pacote-decisao-agenda.md`
> **Projeto:** TechLab Fisio
> **Frente:** Agenda (módulo M5 — Scheduling)
> **Status:** **HOMOLOGADO — `D-AGD-01`..`D-AGD-17` APROVADAS INTEGRALMENTE CONFORME AS RECOMENDAÇÕES POR BRUNO MENEZES NORONHA EM 17/09/2026** (`TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`), inclusive as decisões **[ESCOLHA]** `P-AGD-01`..`P-AGD-12` e a alteração estrutural de `D-AGD-07`. As marcas **[DERIVADA]**/**[ESCOLHA]** permanecem como registro da origem; esta revisão factual não cria nem reabre decisão.
> **Estado de implementação/publicação:** AGD-A integrada pela PR [#90](https://github.com/BrunoMNoronha/techlab-fisio/pull/90), merge `ec688866af4934817730947607d6e4491459c1ed`. AGD-B autorizada pela issue #91 e integrada na `main` pela PR [#99](https://github.com/BrunoMNoronha/techlab-fisio/pull/99), merge `ab6c60143d7195cfaf43fd809119ded7ec4ad54b`, com evidências concluídas nas issues #92, #97, #95, #93 e #94. O PR #103 realiza a sincronização OpenAPI/documental da issue #96. AGD-C, AGD-D e AGD-E permanecem fora desta autorização.
> *(Registro histórico, preservado: até a REV. 5 este cabeçalho declarava que a homologação autorizava a materialização documental e **não** a implementação de runtime, schema ou migration. Essa era a situação então vigente; a autorização acima a substitui apenas quanto a AGD-A.)*
> **Data:** 18 de setembro de 2026
> **Base medida:** `main` em `ab6c60143d7195cfaf43fd809119ded7ec4ad54b`, que já contém AGD-B pelo merge da PR #99; branch `copilot/sync-openapi-verifiers-docs` reconciliada com essa base para a revisão factual/OpenAPI da issue #96.
> **Natureza:** registro normativo das decisões da agenda, originado do pacote de análise `AGD-PREP0`. **Nenhum código, schema, migration ou teste alterado.** Nenhuma implementação é autorizada por este documento.
> **Por que um documento próprio:** precedente de decisões por frente (`docs/09`, `docs/12`, `docs/13`, `docs/14`); a agenda é o módulo M5, distinto da configuração da clínica (M2).

---

## 1. Fontes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md` — **fonte fundamental vigente, não alterada**. A V1 permanece apenas como referência histórica quando explicitamente identificada.
- `docs/02` AGD-001..AGD-009, PRO-003..PRO-005, PKG-003/004, §14, §17, §18.
- `docs/03` RN-013..RN-020, RN-071, D-02, D-06, D-07.
- `docs/04` §2 (escopos), §4 (matriz), §5.4; `apps/api/src/provisionamento/catalogo-rbac.ts`.
- `docs/05` §3 (máquina de estados), FC-03, FC-04, cenários de pacote.
- `docs/06` §6 M5, §11.1, §12 (T-01, T-08, T-09), C-01/C-02.
- `docs/07` §7.5, §10, §17.2, §17.4, §24, §28.3; migrations `20260822144354_check_constraints`, `20260822150506_exclusion_agenda`, `20260822151743_append_only`.
- `docs/09` §13.6 e catálogo `apps/api/src/audit/audit.catalog.ts`.
- `docs/10` (precedentes HTTP; risco de escopo C em §10); `docs/12`; `docs/13` (L-07).
- `docs/14` `D-CFG-30`, `33`, `51`, `52`, `55`, `57`, `60`..`65` (pendências remetidas à agenda).

## 2. Fatos de partida

| # | Fato | Evidência |
| --- | --- | --- |
| FA-01 | Estrutura física da agenda **existe**: `agendamento`, `bloqueio_agenda`, `historico_agendamento` (append-only por `REVOKE`), `reserva_sessao`; exclusion constraints `ex_agendamento_profissional` e `ex_agendamento_paciente` sobre `tstzrange(inicio, fim, '[)')` nos estados `AGENDADO, CONFIRMADO, AGUARDANDO, EM_ATENDIMENTO, CONCLUIDO`; CHECKs `ck_agendamento_intervalo`, `ck_agendamento_modalidade_pacote`, `ck_bloqueio_agenda_intervalo` | migrations citadas; `docs/07` §17.2 |
| FA-02 | **Não** existe CHECK de coerência entre `estado` e `motivo_cancelamento_id`/`cancelado_em`/`cancelado_por_usuario_id` | migration `20260822144354` (ausência) |
| FA-03 | `agendamento` não tem coluna de justificativa, observação, `confirmado_em` nem `checkin_em`; transições além do cancelamento são rastreadas só por `historico_agendamento` | `schema.prisma` |
| FA-04 | Mapeamento de erro pronto para `23P01` nas constraints de agenda (`ehConflitoAgenda`) | `packages/database/src/errors/constraint-map.ts` |
| FA-05 | **Nenhuma rota** de pacientes, profissionais, disponibilidade (PRO-003), `profissional_servico` (PRO-004), pacotes, cobrança, motivos de cancelamento (CFG-005 decidido, implementação não autorizada **na data desta medição** — depois autorizada e implementada; ver §5.2) ou agenda | controllers de `apps/api/src` |
| FA-06 | Componente local de RN-014 (parcela da clínica) pronto e testado, sem consumidor | `docs/14` §5 |
| FA-07 | Permissões existentes: `agenda.gerenciar`, `agenda.checkin`, `agenda.falta`, `agenda.bloqueio`. **Não há** permissão de leitura de agenda nem de iniciar/concluir atendimento | `permissoes.catalogo.ts`; `docs/04` §5 |
| FA-08 | Seed: Administrador recebe as 4; Recepcionista recebe gerenciar/checkin/falta (**não** bloqueio); Fisioterapeuta recebe as 4 (células **C**); Gestor nenhuma (células **P** nunca concedidas) | `catalogo-rbac.ts` |
| FA-09 | Escopo **C** (relacionado/próprio) não é materializado pelo RBAC; P2.2-05 "não iniciada"; `docs/10` §10 exige que o primeiro endpoint materialize o escopo. Vínculo físico disponível: `profissional.usuario_id` (único, anulável) | `docs/10`; `docs/07` P2.2-05; `schema.prisma` |
| FA-10 | Auditoria homologada: `agendamento.criado`, `agendamento.remarcado`, `agendamento.cancelado`, `atendimento.iniciado`, whitelist de `contexto` **vazia**; confirmação, check-in, falta, conclusão e bloqueio ficam no histórico | `docs/09` §13.6; `audit.catalog.ts` |
| FA-11 | Precedentes HTTP: `{ erro }`; `401 SESSAO_INVALIDA`; `403 ACESSO_NEGADO` sem evento (L-07); `422` para regra de negócio; `409` para unicidade/conflito; CSRF só em mutações; `GET` com `no-store` | `docs/10`, `docs/12`, `docs/14` |

## 3. Contradições entre fontes (resolvidas pela homologação)

| # | Contradição | Resolução homologada |
| --- | --- | --- |
| CA-01 | AGD-004 atribui bloqueio a "Administrador/Recepção"; matriz dá `P/✓ conforme política` à Recepção e o seed **não** concede `agenda.bloqueio`; `D-CFG-64` usa bloqueio para fechamentos pontuais | `D-AGD-16` [ESCOLHA] |
| CA-02 | AGD-008 (falta) e FC-04 (check-in) citam só a Recepção/Admin; matriz e seed dão **C** ao Fisioterapeuta | `D-AGD-12` [ESCOLHA]: vale a matriz homologada (`docs/04` prevalece sobre ator descritivo), com escopo próprio |
| CA-03 | `docs/06` lista só `agenda.*` para M5; matriz exige "C próprio" para iniciar/concluir sem permissão em `docs/04` §5 | fora de AGD-A (`D-AGD-01`); exige decisão própria |
| CA-04 | Proposta de `docs/09` §5 incluía `motivo_cancelamento_id` no `contexto`; decisão posterior deixou a whitelist vazia | [DERIVADA] prevalece a whitelist vazia (`D-AGD-10`) |

## 4. Decisões homologadas

### 4.1 `D-AGD-01` — Fatiamento e pré-requisitos **[ESCOLHA]**

- **Contexto.** T-01 depende de paciente, profissional, serviço habilitado (PRO-004), disponibilidade vigente (PRO-003) e, no cancelamento, de motivos (CFG-005) — nenhum com runtime (FA-05).
- **Recomendação.** Fatias sequenciais:

| Fatia | Conteúdo | Pré-requisitos |
| --- | --- | --- |
| **AGD-A** | Consultar agenda; criar agendamento **avulso**; confirmar; remarcar; cancelar | PAC mínimo (cadastro administrativo e situação), PRO-001 mínimo (profissional com situação e `usuario_id`), PRO-004, **PRO-003** (pacote de decisão próprio), CFG-005 implementado |
| **AGD-B** | Check-in e falta | AGD-A; `D-AGD-03` |
| **AGD-C** | Bloqueios de agenda | AGD-A; `D-AGD-16` |
| **AGD-D** | Modalidade `PACOTE` (reserva em T-01, liberação em T-08) | AGD-A; PKG-001..004 |
| **AGD-E** | Iniciar/concluir atendimento (T-09) | AGD-B; prontuário; permissão de início/conclusão; P2.2-05 |

- **Alternativa.** AGD-A antes dos cadastros, com dados apenas por fixture — rejeitada: sem fluxo operável e sem prova de RN-013/RN-014 reais.
- **Consequência.** Antes de AGD-A é necessário decidir **PRO-003** (vigência, sobreposição, erro) e PAC/PRO mínimos; este pacote não os decide.

### 4.2 `D-AGD-02` — Máquina de estados **[DERIVADA]** com um ponto **[ESCOLHA]**

- Transições (docs/05 §3): `AGENDADO → CONFIRMADO | AGUARDANDO | CANCELADO | FALTA`; `CONFIRMADO → AGUARDANDO | CANCELADO | FALTA`; `AGUARDANDO → EM_ATENDIMENTO`; `EM_ATENDIMENTO → CONCLUIDO`. `CANCELADO`, `FALTA` e `CONCLUIDO` são terminais (RN-020). Remarcação é operação, não estado.
- Confirmação só a partir de `AGENDADO`; confirmar `CONFIRMADO` → `200` no-op sem histórico nem auditoria (precedente `D-CFG-06`).
- Transição fora da tabela → **`409 TRANSICAO_INVALIDA`**, sem mutação.
- **[ESCOLHA]** `AGUARDANDO → CANCELADO` ("excepcional e justificado quando permitido", `docs/03`): **não oferecido em AGD-A/AGD-B** — não há permissão excepcional nem coluna de justificativa (FA-03). Recomendação conservadora.

### 4.3 `D-AGD-03` — Regras temporais **[ESCOLHA]**

Nenhuma fonte define (lacuna do levantamento). Recomendação:

| Operação | Regra recomendada | Erro |
| --- | --- | --- |
| Criar / remarcar | `inicio` **não pode ser anterior ao instante do servidor** | `422 AGENDAMENTO_NO_PASSADO` |
| Confirmar / cancelar | permitido enquanto o estado permitir, sem janela temporal | — |
| Check-in (AGD-B) | somente na **data civil local do `inicio`** (fuso da clínica, `D-CFG-60`) | `422 FORA_DA_JANELA_TEMPORAL` |
| Falta (AGD-B) | somente **após o `inicio`** | `422 FORA_DA_JANELA_TEMPORAL` |

- **Motivação.** Impede agendamento retroativo sobreposto a histórico (risco citado em `docs/07` §17.2), falta antecipada e check-in em outro dia.
- **Alternativa.** Permitir passado para registro tardio — rejeitada no MVP; lançamentos retroativos exigiriam permissão e auditoria próprias.

### 4.4 `D-AGD-04` — Validações de criação e códigos **[DERIVADA]** (códigos e ordem **[ESCOLHA]**)

Ordem (T-01, `docs/07` §17.4) e resposta, sem mutação em qualquer falha:

| # | Verificação | Fonte | Erro |
| --- | --- | --- | --- |
| 1 | sessão; permissão; CSRF | `D-2.3D-09` | `401` / `403` |
| 2 | corpo estrito, tipos, instantes ISO-8601 com offset | precedentes | `400 REQUISICAO_INVALIDA` |
| 3 | intervalo: `fim > inicio`; minutos inteiros (segundos e ms = 0); duração 1..1440 min; `inicio` no futuro (`D-AGD-03`) | `D-CFG-27`; `D-AGD-03` | `400` / `422 AGENDAMENTO_NO_PASSADO` |
| 4 | paciente existe e ativo | RN-013 | `422 PACIENTE_INELEGIVEL` |
| 5 | profissional existe e ativo | RN-008, PRO-005 | `422 PROFISSIONAL_INELEGIVEL` |
| 6 | serviço existe e ativo | RN-008, `D-CFG-33` | `422 SERVICO_INELEGIVEL` |
| 7 | profissional habilitado ao serviço | PRO-004 | `422 SERVICO_NAO_HABILITADO` |
| 8 | horário de funcionamento | `D-CFG-61` | `422 FORA_DO_HORARIO_FUNCIONAMENTO` |
| 9 | disponibilidade vigente do profissional | PRO-003 | `422 FORA_DA_DISPONIBILIDADE` |
| 10 | sem sobreposição com bloqueio | RN-015.2 | `409 CONFLITO_BLOQUEIO` |
| 11 | gravação: exclusion constraint do profissional / do paciente | RN-015.1/3 | `409 CONFLITO_PROFISSIONAL` / `409 CONFLITO_PACIENTE` (somente `23P01` **naquela** constraint) |

- Identificador inexistente e inativo recebem **o mesmo** código (sem oráculo de existência para quem agenda).
- Cada código expõe apenas `{ erro }`; nenhum dado do recurso conflitante.

### 4.5 `D-AGD-05` — Contrato HTTP de AGD-A **[ESCOLHA]** (forma) sobre fontes **[DERIVADAS]**

| Rota | Sucesso | Observações |
| --- | --- | --- |
| `GET /agendamentos?de=&ate=[&profissionalId=]` | `200` lista | ver `D-AGD-14` |
| `GET /agendamentos/:agendamentoId` | `200` | `404 AGENDAMENTO_NAO_ENCONTRADO` (também fora do escopo do ator — `D-AGD-12`) |
| `POST /agendamentos` | `201` | corpo `{ pacienteId, profissionalId, servicoId, inicio, fim }` |
| `POST /agendamentos/:agendamentoId/confirmacao` | `200` | corpo `{}` |
| `POST /agendamentos/:agendamentoId/remarcacao` | `200` | corpo `{ inicio, fim }` (`D-AGD-06`) |
| `POST /agendamentos/:agendamentoId/cancelamento` | `200` | corpo `{ motivoCancelamentoId }` (`D-AGD-07`) |

- **Duração (`D-CFG-33`) [ESCOLHA]:** `fim` é **obrigatório no corpo**; a interface propõe `inicio + servico.duracao_min`, e o backend **aceita duração diferente** (sobrescrevível), limitada por `D-AGD-04` item 3. Motivação: a duração real varia por paciente; o backend não precisa inferir.
- Modalidade: AGD-A cria somente `AVULSO`; o corpo não aceita `modalidade` nem `pacoteId` (AGD-D os introduz).
- Resposta: `{ id, paciente: { id, nome }, profissional: { id, nome }, servico: { id, nome }, inicio, fim, estado, modalidade, motivoCancelamentoId, canceladoEm }` — instantes ISO-8601 UTC; **sem** dado clínico (RN-009) e sem campos de auditoria.
- Sem `DELETE`: agendamento nunca é removido (RN-017, `historico_agendamento` append-only).
- Mutações com `ProtecaoCsrfGuard`; `GET` com `Cache-Control: no-store`; erros gerais `401`, `403`, `500 FALHA_INTERNA`.

### 4.6 `D-AGD-06` — Remarcação **[ESCOLHA]**

- Permitida em `AGENDADO` e `CONFIRMADO`; demais estados → `409 TRANSICAO_INVALIDA`.
- Altera **somente** `inicio`/`fim`. Troca de profissional, serviço ou paciente **não** é remarcação: cancelar e criar novo (evita revalidações cruzadas e preserva histórico legível).
- Revalida `D-AGD-04` itens 3, 5..11 com a grade, a disponibilidade e o fuso **vigentes** (RN-016, `D-CFG-63`), excluindo o próprio agendamento do conflito (a constraint já o faz no `UPDATE`).
- **Estado após remarcar `CONFIRMADO`: volta a `AGENDADO`** — a confirmação referia-se ao horário anterior.
- Mesmo intervalo → `200` no-op, sem histórico nem auditoria.
- Remarcação não é novo consumo nem nova reserva (`docs/07`).

### 4.7 `D-AGD-07` — Cancelamento e motivo (resolve `D-CFG-51`, `D-CFG-52`, `D-CFG-57`) **[ESCOLHA]**

- Permitido em `AGENDADO` e `CONFIRMADO` (`D-AGD-02`).
- **Motivo padronizado obrigatório** em todo cancelamento de agendamento (AGD-003 "motivo padronizado"; CFG-005 lido como aplicável a todo cancelamento da agenda).
- Motivo deve existir e estar ativo, verificado sob `SELECT ... FOR SHARE` na linha do motivo (`D-CFG-57`) → senão `422 MOTIVO_CANCELAMENTO_INELEGIVEL`.
- **Sem motivos ativos cadastrados → cancelamento impossível** (`422` acima); consequência: CFG-005 é pré-requisito operacional de AGD-A e o Administrador precisa cadastrar motivos antes do uso.
- Grava `estado = CANCELADO`, `motivo_cancelamento_id`, `cancelado_em = now()`, `cancelado_por_usuario_id = ator`.
- **Migration futura autorizável (estrutural — requer aprovação expressa):** `CHECK ((estado = 'CANCELADO') = (motivo_cancelamento_id IS NOT NULL AND cancelado_em IS NOT NULL AND cancelado_por_usuario_id IS NOT NULL))`. Verificar antes que não há linhas legadas incompatíveis.
- Cancelar não altera cobrança (PROP-RN-2.2-02) e, em AGD-D, libera reserva (T-08).

### 4.8 `D-AGD-08` — Idempotência **[DERIVADA]**

- AGD-A **não** introduz chave de idempotência (`docs/07` C-01 não a prevê). Reenvio da mesma criação colide na constraint do profissional → `409 CONFLITO_PROFISSIONAL`; transições repetidas são no-op (`D-AGD-02`) ou `409`.

### 4.9 `D-AGD-09` — Histórico **[DERIVADA]** (catálogo **[ESCOLHA]**)

- Catálogo fechado de `historico_agendamento.operacao`: `CRIADO`, `CONFIRMADO`, `REMARCADO`, `CANCELADO`, `CHECKIN`, `FALTA`, `INICIADO`, `CONCLUIDO` (AGD-A usa os quatro primeiros).
- **Uma** linha por mutação efetiva, na mesma transação; preenche `estado_anterior`/`estado_novo`, `inicio_anterior`/`inicio_novo`, `fim_anterior`/`fim_novo` quando aplicáveis, `motivo_cancelamento_id` no cancelamento e o ator da sessão.
- No-op, rejeição e negação **não** geram histórico.

### 4.10 `D-AGD-10` — Auditoria **[DERIVADA]** (resolve a parte de auditoria de `D-CFG-65`)

- Criação, remarcação efetiva e cancelamento emitem, cada um, **um** evento (`agendamento.criado`, `agendamento.remarcado`, `agendamento.cancelado`), `alvo_tipo = "agendamento"`, `alvo_id`, ator da sessão, `SUCESSO`, `justificativa = null`, `contexto` **vazio**, na mesma transação e com o **mesmo `correlacao_id`** da linha de histórico (`docs/07`).
- Confirmação: **somente histórico** (fora do catálogo, `docs/09`).
- Rejeições (inclusive `FORA_DO_HORARIO_FUNCIONAMENTO`), no-op e `403` **não** emitem evento. Nenhuma ação, chave ou `alvo_tipo` novo.

### 4.11 `D-AGD-11` — Concorrência **[DERIVADA]**

- Criação: conflitos temporais garantidos pelas exclusion constraints; bloqueio, horário e disponibilidade validados no backend sem lock (race residual `R2.2-09` e `D-CFG-63` aceitos).
- Remarcação, confirmação e cancelamento: `SELECT ... FOR UPDATE` na linha de `agendamento` antes de ler o estado; ordem de locks `agendamento → motivo (FOR SHARE)` (AGD-A); em AGD-D, `agendamento → pacote → cobranca`.
- Sem coluna de versão nem `If-Match`; última escrita válida prevalece entre transições concorrentes compatíveis.

### 4.12 `D-AGD-12` — Autorização e escopo **[ESCOLHA]** (materializa FA-09 para a agenda)

- Mutações de AGD-A exigem `agenda.gerenciar`; AGD-B, `agenda.checkin` / `agenda.falta`; AGD-C, `agenda.bloqueio`. **Nenhuma permissão nova.**
- **Escopo:** ator com papel `ADMINISTRADOR` ou `RECEPCIONISTA` que conceda a permissão → **operacional** (todos os agendamentos). Ator cuja permissão provém **apenas** de papel `FISIOTERAPEUTA` → **próprio**: só agendamentos cujo `profissional.usuario_id = ator`; criação só com `profissionalId` próprio.
- Fora do escopo: leitura/mutação por id → `404 AGENDAMENTO_NAO_ENCONTRADO` (sem oráculo); criação para outro profissional → `403 ACESSO_NEGADO`.
- Limitação declarada: escopo derivado do **código do papel** até que P2.2-05 defina mecanismo geral; papéis customizados sem esses códigos recebem escopo **próprio** (fail-closed).
- **Alternativa.** Negar o Fisioterapeuta na agenda até P2.2-05 — mais simples, mas contraria a matriz homologada (C) e a jornada FC-04 ("acessa sua agenda").

### 4.13 `D-AGD-13` — Leitura de catálogos pela agenda (resolve `D-CFG-30`, `D-CFG-55`, `D-CFG-65`) **[ESCOLHA]**

- Rotas somente leitura **no módulo de agenda**, sob `agenda.gerenciar`, sem alterar as rotas administrativas (`clinica.configurar`):
  - `GET /agenda/opcoes` → `{ servicos: [{ id, nome, duracaoMin }], motivosCancelamento: [{ id, descricao }], horarioFuncionamento: { janelas }, fusoHorario }` — **somente ativos**, sem preço.
- Pacientes e profissionais para seleção vêm das futuras rotas de PAC/PRO, sob suas permissões.
- **Alternativa.** Conceder `GET /servicos` etc. a outros papéis — rejeitada: expõe preço e itens inativos (privilégio mínimo).

### 4.14 `D-AGD-14` — Consulta da agenda **[ESCOLHA]**

- Leitura exige `agenda.gerenciar` (não há permissão de leitura — FA-07), com o escopo de `D-AGD-12`. **Gestor não consulta a agenda** no MVP inicial (sem `agenda.*`); acompanhamento pelo módulo de indicadores.
- `de` e `ate` obrigatórios (ISO-8601 com offset), intervalo `[de, ate)` de **no máximo 7 dias** (visões diária e semanal — TLF-BASE §5.5); `profissionalId` opcional (ignorado/forçado ao próprio no escopo próprio).
- Retorna agendamentos que **intersectam** o intervalo, em todos os estados; ordem `inicio`, `id`; **sem paginação** (limitada pelo intervalo); `Cache-Control: no-store`.
- Parâmetro ausente, inválido, invertido ou > 7 dias → `400 REQUISICAO_INVALIDA`.

### 4.15 `D-AGD-15` — Fronteira com pacotes **[DERIVADA]**

- AGD-A não aceita `PACOTE` (`D-AGD-05`). AGD-D implementa D-07/PKG-004 (reserva em T-01, liberação em T-08) e decide: remarcação que torna o pacote inelegível (docs/05 "regra futura") e serviço inativado com agendamento por pacote (`D-CFG-33`).

### 4.16 `D-AGD-16` — Bloqueios (AGD-C) **[ESCOLHA]** (resolve CA-01)

- Recomendação: **manter o seed** (Recepção sem `agenda.bloqueio`; célula `P/✓ conforme política` tratada como P). Administrador cria bloqueios de qualquer profissional (inclusive fechamentos de `D-CFG-64`); Fisioterapeuta, somente próprios.
- Remoção: **exclusão lógica não existe no schema**; recomenda-se **não oferecer remoção** em AGD-C inicial (bloqueio encerrado por data), decidindo remoção em pacote próprio.
- **Alternativa.** Conceder `agenda.bloqueio` à Recepção — exige alterar o seed e reconciliar `docs/04`; aumenta privilégio.

### 4.17 `D-AGD-17` — Fora do escopo deste pacote **[DERIVADA]**

- AGD-E (iniciar/concluir, T-09): sem permissão definida, dependente do prontuário e de P2.2-05.
- Agendamento público, notificações, recorrência, lista de espera, sugestão automática de horários (TLF-BASE §13).

## 5. Registro de homologação e pendências

### 5.1 Escolhas homologadas (17/09/2026)

| ID | Decisão | Recomendação | Estado |
| --- | --- | --- | --- |
| P-AGD-01 | Fatiamento e pré-requisitos (`D-AGD-01`) | AGD-A..E; decidir PRO-003 e PAC/PRO mínimos antes de AGD-A | **HOMOLOGADA** |
| P-AGD-02 | `AGUARDANDO → CANCELADO` (`D-AGD-02`) | não oferecer por ora | **HOMOLOGADA** |
| P-AGD-03 | Regras temporais (`D-AGD-03`) | sem passado; check-in no dia; falta após início | **HOMOLOGADA** |
| P-AGD-04 | Códigos e ordem de validação (`D-AGD-04`) | tabela proposta | **HOMOLOGADA** |
| P-AGD-05 | Contrato e duração sobrescrevível (`D-AGD-05`) | `fim` obrigatório, sobrescrevível | **HOMOLOGADA** |
| P-AGD-06 | Remarcação (`D-AGD-06`) | só intervalo; `CONFIRMADO` volta a `AGENDADO` | **HOMOLOGADA** |
| P-AGD-07 | Motivo obrigatório, sem motivos ativos e **migration de CHECK** (`D-AGD-07`) | obrigatório; `422`; aprovar migration | **HOMOLOGADA** |
| P-AGD-08 | Catálogo de operações do histórico (`D-AGD-09`) | 8 operações | **HOMOLOGADA** |
| P-AGD-09 | Escopo por código de papel (`D-AGD-12`) | operacional (Admin/Recepção) × próprio (Fisioterapeuta) | **HOMOLOGADA** |
| P-AGD-10 | `GET /agenda/opcoes` (`D-AGD-13`) | adotar | **HOMOLOGADA** |
| P-AGD-11 | Consulta: permissão, Gestor e janela de 7 dias (`D-AGD-14`) | `agenda.gerenciar`; Gestor sem acesso; 7 dias | **HOMOLOGADA** |
| P-AGD-12 | Bloqueio: seed e remoção (`D-AGD-16`) | manter seed; sem remoção inicial | **HOMOLOGADA** |

As decisões **[DERIVADAS]** (`D-AGD-08`, `D-AGD-10`, `D-AGD-11`, `D-AGD-15`, `D-AGD-17` e as partes derivadas de `D-AGD-02`, `D-AGD-04`, `D-AGD-09`) foram **homologadas em bloco** na mesma data.

### 5.2 Pendências abertas após a homologação

| Item | Estado |
| --- | --- |
| Pacote de decisão de **PRO-003** (disponibilidade: vigência, sobreposição, erro) | **HOMOLOGADO E IMPLEMENTADO** — `docs/16` REV. 5 (`D-PRO3-01`..`D-PRO3-10`); publicado na `main` pela PR [#89](https://github.com/BrunoMNoronha/techlab-fisio/pull/89). *(Correção factual da REV. 6: até a REV. 5 esta linha dizia "implementação não autorizada".)* |
| Decisões mínimas de pacientes (PAC) e profissionais (PRO-001, PRO-004) para AGD-A | **PAC: HOMOLOGADO** — `docs/17` REV. 2 (fatia PAC-A, implementada — `docs/10` §6-AC); **PRO-001/PRO-004: HOMOLOGADO** — `docs/18` (`D-PRO1-01`..`D-PRO1-10`; fatia PRO-A implementada — `docs/10` §6-AD); ambas **publicadas na `main`** pela PR [#89](https://github.com/BrunoMNoronha/techlab-fisio/pull/89) (merge `4b2e2c0`) — pré-requisitos de AGD-A **satisfeitos**. *(Correção factual da REV. 6: até a REV. 5 esta linha dizia "integradas na branch local `integration/local-fase4`, não publicadas na `main`", o que era verdade na data daquela medição.)* |
| Implementação de CFG-005 (`P-CFG-06`) | **IMPLEMENTADA** (autorizada por Bruno Menezes Noronha em 17/09/2026; `docs/10` §6-AB) — **publicada na `main`** pela PR [#89](https://github.com/BrunoMNoronha/techlab-fisio/pull/89) (merge `4b2e2c0`) — pré-requisito operacional do cancelamento (`D-AGD-07`) **satisfeito**. *(Correção factual da REV. 6, mesma razão da linha anterior.)* |
| Implementação de AGD-A (rotas, T-01 avulso, histórico, auditoria, escopo, `GET /agenda/opcoes`) e migration do CHECK de `D-AGD-07` | **INTEGRADA NA `main`** pela PR [#90](https://github.com/BrunoMNoronha/techlab-fisio/pull/90), merge `ec688866af4934817730947607d6e4491459c1ed`; materialização em §8 e `docs/10` §6-AI |
| AGD-B | **INTEGRADA NA `main`** pela PR [#99](https://github.com/BrunoMNoronha/techlab-fisio/pull/99), merge `ab6c60143d7195cfaf43fd809119ded7ec4ad54b`; evidências #92/#97/#95/#93/#94 concluídas; sincronização OpenAPI/documental da #96 no PR #103 |
| AGD-C (bloqueios de agenda) | **DETALHAMENTO CONCLUÍDO EM PACOTE PRÓPRIO** — `docs/19-pacote-decisao-bloqueios-agenda.md` (`D-AGDC-01`..`D-AGDC-15`); runtime **não implementado** (aguarda árvore de execução AGD-C) |
| AGD-D (pacotes) | **DECIDIDO NO NÍVEL DESTE PACOTE** — detalhamento na respectiva fatia; implementação não autorizada |
| AGD-E (iniciar/concluir), permissão correspondente, P2.2-05 e `AGUARDANDO → CANCELADO` | **FORA DESTE PACOTE** (`D-AGD-02`, `D-AGD-17`) |
| Remoção de bloqueio (`D-AGD-16`) | **PACOTE PRÓPRIO FUTURO** |
| Remarcação que torna pacote inelegível; serviço inativado com agendamento por pacote (`D-AGD-15`) | **PENDENTE DA FATIA AGD-D** |


## 6. Matriz de testes de aceite (AGD-A)

| ID | Cenário | Esperado |
| --- | --- | --- |
| TA-01 | Criação válida por Recepção | `201`; `AGENDADO`; 1 histórico `CRIADO`; 1 `agendamento.criado` com mesmo `correlacao_id` |
| TA-02 | Paciente/profissional/serviço inativo ou inexistente | `422` respectivo; sem linhas |
| TA-03 | Serviço não habilitado ao profissional | `422 SERVICO_NAO_HABILITADO` |
| TA-04 | Fora da grade (CH-AG-02..08) | `422 FORA_DO_HORARIO_FUNCIONAMENTO`; sem evento |
| TA-05 | Fora da disponibilidade | `422 FORA_DA_DISPONIBILIDADE` |
| TA-06 | Sobre bloqueio | `409 CONFLITO_BLOQUEIO` |
| TA-07 | Sobreposição total/parcial do profissional; borda `10:00`/`10:00` aceita | `409 CONFLITO_PROFISSIONAL` / `201` |
| TA-08 | Mesmo paciente com outro profissional | `409 CONFLITO_PACIENTE` |
| TA-09 | Duas criações concorrentes no mesmo intervalo | exatamente uma `201` |
| TA-10 | Início no passado | `422 AGENDAMENTO_NO_PASSADO` |
| TA-11 | Confirmar `AGENDADO`; reconfirmar | `200` + histórico; `200` no-op |
| TA-12 | Remarcar válido; `CONFIRMADO` remarcado | `200`; histórico `REMARCADO`; evento; estado `AGENDADO` |
| TA-13 | Remarcar para horário conflitante / fora da grade vigente | `409` / `422`; intervalo original intacto |
| TA-14 | Cancelar com motivo ativo; sem motivo; motivo inativo; nenhum motivo cadastrado | `200` + histórico + evento; `400`; `422`; `422` |
| TA-15 | Transição a partir de estado terminal | `409 TRANSICAO_INVALIDA` |
| TA-16 | Fisioterapeuta: lista só própria; acessa id de outro | lista filtrada; `404` |
| TA-17 | Gestor; não autenticado; sem CSRF | `403`; `401`; `403 REQUISICAO_NAO_AUTORIZADA` — sem evento |
| TA-18 | Consulta com intervalo > 7 dias ou invertido | `400` |
| TA-19 | `GET /agenda/opcoes` | só ativos, sem preço |

## 8. Registro de materialização de AGD-A e estado factual da AGD-B (REV. 7, 18/09/2026)

> **Natureza desta seção:** registro **posterior** e **factual** do que foi implementado/publicado. Ela **não** altera, reinterpreta nem reabre `D-AGD-01`..`D-AGD-17` ou `P-AGD-01`..`P-AGD-12`; as atualizações de §5.2 são exclusivamente de estado factual. O detalhamento técnico vive em `docs/10` §6-AI.

### 8.1 Autorização, integração e fronteira

AGD-A foi autorizada e depois integrada na `main` pela PR #90 (`ec688866af4934817730947607d6e4491459c1ed`). A issue #91 autorizou a fatia **AGD-B** estritamente para check-in e falta; as issues #92, #97, #95, #93 e #94 foram concluídas, e a implementação/provas chegaram à `main` pela PR #99 (`ab6c60143d7195cfaf43fd809119ded7ec4ad54b`). O PR #103 reconcilia a superfície OpenAPI e os registros factuais da issue #96. A fatia **AGD-C** teve seu pacote de decisão fechado em `docs/19-pacote-decisao-bloqueios-agenda.md` (`D-AGDC-01`..`D-AGDC-15`), permanecendo **sem implementação de runtime até a execução da árvore de issues**. **AGD-D e AGD-E permanecem não autorizadas nesta frente**; `P2.2-05` não é ampliada por esta revisão.

O registro histórico da branch `agent/agd-a-agenda-core` permanece válido para a REV. 6; o estado atual medido é `main` com AGD-A e AGD-B integradas pelos merges #90 e #99, respectivamente.

### 8.2 Decisões materializadas

| Decisão | Materialização |
| --- | --- |
| `D-AGD-01` | Somente AGD-A: seis rotas de `/agendamentos` + `GET /agenda/opcoes`. Pré-requisitos (PAC-A, PRO-A, PRO-004, PRO-003, CFG-005) confirmados na `main` antes de implementar |
| `D-AGD-02` | `agenda.estados.ts` — função pura; confirmar `CONFIRMADO` é no-op sem histórico e sem auditoria; transição fora da tabela é `409 TRANSICAO_INVALIDA` |
| `D-AGD-03` | `inicio >= instante do servidor`, avaliado dentro da transação; sem lançamento retroativo |
| `D-AGD-04` | Ordem e códigos exatos dos 11 passos, no `AgendamentosService` |
| `D-AGD-05` | Contrato HTTP literal; corpo de criação **sem** `modalidade` e `pacoteId`; resposta exata; sem `DELETE` |
| `D-AGD-06` | Remarcação só de intervalo; revalida os itens 3 e 5..11; `CONFIRMADO` volta a `AGENDADO`; mesmo intervalo é no-op |
| `D-AGD-07` | Motivo obrigatório, existente e ativo sob `FOR SHARE`; quatro campos gravados juntos; **migration `20260917230000_agendamento_cancelamento_coerente`** |
| `D-AGD-08` | Nenhuma chave de idempotência; reenvio colide na exclusion constraint |
| `D-AGD-09` | Catálogo fechado de operações; uma linha por mutação efetiva, na mesma transação |
| `D-AGD-10` | Três ações, `contexto` vazio, mesma transação; confirmação só no histórico |
| `D-AGD-11` | Exclusion constraints na gravação; `FOR UPDATE` no agendamento; ordem `agendamento -> motivo (FOR SHARE)`; sem versão e sem `If-Match` |
| `D-AGD-12` | `EscopoAgendaService` — operacional (Administrador/Recepcionista que **concedam** a permissão) × próprio (demais, fail-closed) |
| `D-AGD-13` | `GET /agenda/opcoes` com o contrato exato, só ativos, sem preço |
| `D-AGD-14` | `[de, ate)` de no máximo 7 dias, intersecção, todos os estados, ordem `inicio, id`, sem paginação, `no-store` |
| `D-AGD-15` / `D-AGD-17` | Nada de `PACOTE`, `reserva_sessao`, bloqueio, início ou conclusão; check-in e falta pertencem à AGD-B já integrada |

### 8.3 Correlação histórico × auditoria — decisão local declarada

`historico_agendamento` **não possui coluna `correlacao_id`**, e a persistência da Fase 2 está encerrada: esta fatia só foi autorizada a criar o CHECK de `D-AGD-07`. A exigência de `docs/07` §22.4 e de `D-AGD-10` — "as duas linhas com o mesmo `correlacao_id`" — foi materializada usando o **mesmo UUID** como `historico_agendamento.id` e como `evento_auditoria.correlacao_id`, de modo que a junção `evento_auditoria.correlacao_id = historico_agendamento.id` é exata. Nenhuma coluna nova foi criada. Alternativa registrada e **não** adotada: acrescentar `correlacao_id` a `historico_agendamento`, o que exigiria decisão estrutural própria.

### 8.4 Matriz `TA-01`..`TA-19` — cobertura

Todos os dezenove cenários estão cobertos por teste automatizado; `TA-09` é provado contra **PostgreSQL real**, com duas requisições HTTP concorrentes. A tabela cenário × teste × resultado está em `docs/10` §6-AI.3.

### 8.5 Limites declarados da implementação

- **Race residual aceita** (`D-AGD-11`, `R2.2-09`, `D-CFG-63`): grade da clínica, disponibilidade e bloqueio são validados **sem lock**; alteração concorrente entre a validação e a gravação não é detectada. Só o conflito entre agendamentos é estrutural.
- **Escopo por código de papel** (`D-AGD-12`): limitação homologada, mantida. `P2.2-05` continua não iniciada.
- **CHECK de `D-AGD-07`**: a expressão homologada compara a **conjunção** dos três campos, de modo que um resíduo parcial em agendamento não cancelado não é rejeitado pelo banco. Nenhum caminho da aplicação o produz; o limite está registrado em teste de efeito e em `docs/07` §10.2 (nota da REV. 2.6).
- **`protected-objects.json` não foi ampliado** (fora do escopo autorizado): a nova CHECK fica coberta pelo golden (Guarda 3) e pelo teste de efeito (Guarda 2), no mesmo precedente de `CFG-003`, `CFG-004`, `CFG-005`, `PAC-A`, `PRO-A` e `PRO-003`.


### 8.6 Estado factual da AGD-B

A AGD-B materializa apenas `POST /agendamentos/:agendamentoId/check-in` e `POST /agendamentos/:agendamentoId/falta`, usando as permissões existentes `agenda.checkin` e `agenda.falta`. As origens válidas são `AGENDADO` e `CONFIRMADO`; check-in leva a `AGUARDANDO`, falta leva a `FALTA`. Estado inválido prevalece como `409 TRANSICAO_INVALIDA`; com estado válido, violação temporal retorna `422 FORA_DA_JANELA_TEMPORAL`. Check-in exige mesma data civil no fuso IANA da clínica; falta exige `agora > inicio`.

Cada operação resolve o escopo pela permissão efetiva, lê sob `SELECT ... FOR UPDATE`, captura o instante uma única vez após validar o estado e grava atualização + exatamente uma linha `CHECKIN`/`FALTA` no histórico na mesma transação. Não há evento de auditoria. As provas integradas pelo PR #99 cobrem as três corridas concorrentes obrigatórias e 11/11 mutation challenges, sem migration, alteração de schema/golden, dependência, permissão ou ação de auditoria nova.

## 7. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **8** | 18/09/2026 | Atualização factual pós-fechamento do pacote normativo de AGD-C: §5.2 e §8.1 passam a apontar para `docs/19-pacote-decisao-bloqueios-agenda.md` (`D-AGDC-01`..`D-AGDC-15`). Registrado que o runtime de AGD-C permanece não implementado, e que AGD-A (#90) e AGD-B (#99/#103) estão integralmente publicadas na `main`. Nenhuma decisão anterior alterada. |
| **7** | 18/09/2026 | Sincronização factual pós-AGD-A/AGD-B: Base ativa passa a V2; AGD-A registrada como integrada pela PR #90 (`ec688866`); AGD-B registrada como autorizada pela #91 e integrada pela PR #99 (`ab6c601`), com #92/#97/#95/#93/#94 concluídas; superfície limitada a check-in/falta, sem AGD-C/D/E; PR #103 assume a sincronização OpenAPI/documental da #96. Nenhuma decisão `D-AGD-*`/`P-AGD-*`, migration, schema, permissão, auditoria ou dependência criada/alterada. |
| **6** | 17/09/2026 | **Registro de materialização de AGD-A** (§8), após autorização expressa e específica de Bruno Menezes Noronha para implementar a fatia AGD-A e a migration estrutural de `D-AGD-07`. Cabeçalho e §5.2 atualizados: a implementação de AGD-A passa de `DECIDIDO — IMPLEMENTAÇÃO NÃO AUTORIZADA` para `AUTORIZADA E IMPLEMENTADA` (branch local, não publicada). Correções **factuais** em §5.2, com registro da correção: CFG-005, PAC-A, PRO-A e PRO-003 deixaram de estar "não publicadas na `main`" — todas foram publicadas pela PR [#89](https://github.com/BrunoMNoronha/techlab-fisio/pull/89) (merge `4b2e2c0`). **Nenhuma decisão `D-AGD-*` ou `P-AGD-*` criada, alterada ou reaberta; §§1–6 preservadas byte a byte.** AGD-B, AGD-C, AGD-D e AGD-E seguem sem autorização de implementação. |
| **5** | 17/09/2026 | Alinhamento editorial `D-INTEG-02` (Bruno Menezes Noronha), na integração local das quatro frentes: §5.2 deixa de afirmar que a implementação de CFG-005 não está autorizada (autorizada e implementada — `docs/10` §6-AB) e registra PRO-001/PRO-004 homologados em `docs/18` com a fatia PRO-A implementada; FA-05 recebe nota de que descreve a base medida. Nenhuma decisão `D-AGD-*` criada, alterada ou reaberta; AGD-A..AGD-D seguem sem autorização de implementação. |
| **4** | 17/09/2026 | Atualização factual de §5.2: pacote mínimo de pacientes homologado (`docs/17` REV. 2); PRO-001/PRO-004 em preparação em outra branch/sessão. Nenhuma decisão alterada. |
| **3** | 17/09/2026 | Atualização factual de §5.2: pacote de PRO-003 homologado (`docs/16` REV. 2). Nenhuma decisão alterada. |
| **2** | 17/09/2026 | **Homologação** por Bruno Menezes Noronha: `D-AGD-01`..`D-AGD-17` aprovadas integralmente conforme as recomendações, inclusive `P-AGD-01`..`P-AGD-12` e a migration futura do CHECK de `D-AGD-07`. Status, §4 e §5 atualizados (§5.1 registro; §5.2 pendências abertas). Nenhum conteúdo decisório alterado; nenhum código alterado; implementação não autorizada. |
| **1** | 17/09/2026 | Pacote inicial `AGD-PREP0`: fatos, contradições, `D-AGD-01`..`D-AGD-17` propostas (derivadas × escolhas), pendências `P-AGD-01`..`P-AGD-12` e matriz de aceite de AGD-A. Nada homologado; nenhum código alterado. |

---

**Fim — `docs/15-pacote-decisao-agenda.md`.**
