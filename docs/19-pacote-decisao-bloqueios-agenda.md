# Pacote de Decisão dos Bloqueios de Agenda (`AGD-C`) — `AGD-C-PREP0`

> **Documento:** `docs/19-pacote-decisao-bloqueios-agenda.md`  
> **Projeto:** TechLab Fisio  
> **Frente:** Agenda (módulo M5) — Bloqueios de Agenda (`AGD-C`, requisitos AGD-004 e AGD-005)  
> **Status:** **DECIDIDO TECNICAMENTE — PRONTO PARA IMPLEMENTAÇÃO**  
> **Data:** 18 de setembro de 2026  
> **Base medida:** `main` = `origin/main` no commit `fe19d363e04103ff7d061503591deb79ffe236a8` (pós-integração de AGD-A via PR #90, AGD-B via PR #99 e sincronização OpenAPI/docs via PR #103).  
> **Natureza:** pacote normativo, de contrato e governança de execução para a fatia AGD-C. **Nenhum código de runtime, controller, service, DTO, schema Prisma, migration ou teste de execução foi implementado nesta etapa.** Implementação estritamente desautorizada em PREP0.

---

## 1. Fontes vinculantes

1. `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`: §5.5 (Agenda e agendamentos — visões diária e semanal, bloqueios de horário), §6 (Perfis de acesso), §9 (Segurança e auditoria), §10 (Privacidade e LGPD) e §13 (Limitações do MVP).
2. `docs/02-requisitos.md`: AGD-004 ("Criar bloqueio de agenda"), AGD-005 ("Prevenir conflitos").
3. `docs/03-regras-negocio.md`: RN-002, RN-008, RN-013, RN-014, RN-015 (RN-015.2: sobreposição com bloqueio do profissional), RN-017.
4. `docs/04-perfis-permissoes.md`: permissão `agenda.bloqueio` ("Criar/remover bloqueios conforme escopo").
5. `apps/api/src/provisionamento/catalogo-rbac.ts`: seed vigente concedendo `agenda.bloqueio` a `ADMINISTRADOR` (operacional) e `FISIOTERAPEUTA` (próprio); `RECEPCIONISTA` com `agenda.gerenciar`, `agenda.checkin`, `agenda.falta`, mas sem `agenda.bloqueio`.
6. `docs/05-jornadas-fluxos.md`: FC-03 (agendamento e conflito com bloqueio), FC-04 (fisioterapeuta na sua agenda).
7. `docs/06-modelo-dominio.md`: Módulo M5 (Agenda — Bloqueio, RN-015, I-11, transação T-01).
8. `docs/07-modelo-persistencia.md`: §7.5 (`bloqueio_agenda`), §10.2 (tabela de índices e CHECKs), §17.2 (tabela de conflitos, backend em T-01, coexistência tolerada entre bloqueio e agendamento preexistente), §22.4, §24.1 (`R2.2-09` — race residual aceita).
9. `docs/09-pacote-decisao-p-e14-01.md`: §12.2 e §13.2 (ação `bloqueio_agenda.criado` mantida fora do catálogo de auditoria).
10. `apps/api/src/audit/audit.catalog.ts`: linha 67 confirmando que `bloqueio_agenda.criado` segue FORA do catálogo de auditoria.
11. `docs/14-decisoes-configuracao-clinica.md`: `D-CFG-64` (fechamentos pontuais, feriados, reformas e eventos operados por bloqueio de agenda de AGD-004).
12. `docs/15-pacote-decisao-agenda.md`: `D-AGD-01` (fatiamento AGD-A..E), `D-AGD-04` (ordem de validação e códigos de erro), `D-AGD-11` (concorrência e locks), `D-AGD-12` (escopo operacional × próprio), `D-AGD-14` (consulta da agenda), `D-AGD-16` (bloqueios no seed vigente e sem remoção inicial).
13. `docs/16-pacote-decisao-disponibilidade-profissional.md`: §68 (ausências pontuais como férias, cursos e consultas operadas por bloqueio de agenda).
14. `packages/database/prisma/schema.prisma`: modelo `BloqueioAgenda` (linhas 709–724).
15. `packages/database/schema.golden.sql`: linhas 239–248, 802–803, 1103, 1479–1488.
16. `packages/database/protected-objects.json`: linha 63 (`ck_bloqueio_agenda_intervalo`).
17. `apps/api/src/agenda/`: implementação atual de AGD-A e AGD-B (`agendamentos.service.ts`, `agenda.escopo.ts`, `agenda.dto.ts`, `erro-agenda.filter.ts`).

---

## 2. Fatos medidos no repositório

| # | Fato medido | Evidência no repositório | Consequência para AGD-C |
|---|---|---|---|
| **FM-01** | Tabela `bloqueio_agenda` possui exatamente 7 colunas: `id` (UUID PK), `profissional_id` (UUID FK NN), `inicio` (timestamptz NN), `fim` (timestamptz NN), `motivo` (text ∅), `criado_por_usuario_id` (UUID FK NN) e `criado_em` (timestamptz NN default now()). | `schema.prisma`:709-724; `schema.golden.sql`:239-248 | Zero alteração estrutural necessária na persistência. |
| **FM-02** | O campo `motivo` é anulável no schema (`String?` / `text NULL`). Não há enum ou tabela de motivos padronizados para bloqueio (ao contrário do cancelamento de agendamento em `CFG-005`). | `schema.prisma`:714; `schema.golden.sql`:244 | Motivo aceita texto livre opcional, sanitizado/normalizado ou `null`. |
| **FM-03** | Chaves estrangeiras com `ON DELETE RESTRICT ON UPDATE RESTRICT` para `profissional(id)` e `usuario(id)`. | `schema.golden.sql`:1479-1488 | Integridade referencial assegurada pelo banco para profissional e criador. |
| **FM-04** | CHECK físico `ck_bloqueio_agenda_intervalo CHECK ((fim > inicio))` existe na migration `20260822144354` e está registrado em `protected-objects.json`. | `protected-objects.json`:63; `guard-anti-drift.spec.ts`:339-350 | O banco já rejeita `fim <= inicio`. Validação de backend deve falhar fast com `400 REQUISICAO_INVALIDA`. |
| **FM-05** | Índice B-Tree `bloqueio_agenda_profissional_id_inicio_fim_idx` sobre `(profissional_id, inicio, fim)` existe no golden. | `schema.golden.sql`:1103; migration `20260820121900` | Consultas e verificações de sobreposição utilizam índice existente. |
| **FM-06** | Ausência absoluta de exclusão lógica (`excluido_em`) e de data de atualização (`atualizado_em`). | `schema.prisma`:709-724; `schema.golden.sql`:239-248 | Bloqueio é rigorosamente append-only. Não há edição nem deleção no schema. |
| **FM-07** | Ausência de exclusion constraint no PostgreSQL entre bloqueios (não há exclusion `bloqueio && bloqueio`). | `schema.golden.sql`:236-248 | PostgreSQL não impede bloqueios sobrepostos estruturalmente. |
| **FM-08** | Ausência de exclusion constraint ou trigger entre bloqueio e agendamento. | `docs/07` §17.2; `schema.golden.sql` | Relação direcional garantida no backend: agendamento verifica bloqueio, bloqueio não apaga agendamento existente. |
| **FM-09** | Ausência atual de rota pública para bloqueios de agenda. | `openapi.spec.ts`:175; `agenda-agd-a.integration.spec.ts`:1966-1968 | `/agenda/bloqueios` e `/bloqueios` retornam 404; termo "bloqueio" consta na lista de termos proibidos do verificador OpenAPI. |
| **FM-10** | AGD-A consulta `bloqueio_agenda` no passo 10 da validação (`RN-015.2`) usando `tstzrange(inicio, fim, '[)') && tstzrange(...)` e rejeita com `409 CONFLITO_BLOQUEIO`. | `agendamentos.service.ts`:779-787 | Conexão funcional entre bloqueio e agendamento já está operando em produção/testes. |
| **FM-11** | Permissão `agenda.bloqueio` já existe no catálogo RBAC (`permissoes.catalogo.ts`:52). Seed vigente concede a `ADMINISTRADOR` e a `FISIOTERAPEUTA`, mas NÃO a `RECEPCIONISTA`. | `catalogo-rbac.ts`:248, 286, 301 | Nenhuma nova permissão necessária. Recepção não cria bloqueios no seed vigente. |
| **FM-12** | Ação `bloqueio_agenda.criado` NÃO existe no catálogo de eventos de auditoria e foi deliberadamente excluída pela homologação normativa. | `audit.catalog.ts`:67; `docs/09` §13.2 | Criação de bloqueio não emite evento de auditoria; a linha de bloqueio é seu próprio registro funcional. |
| **FM-13** | Mecanismo de escopo relacional operacional × próprio já está implementado em `EscopoAgendaService.resolver(tx, usuarioId, permissao)`. | `agenda.escopo.ts`:76-107 | Reutilização direta do serviço existente para resolver o escopo sob a permissão `agenda.bloqueio`. |
| **FM-14** | Resolução do profissional vinculado ao usuário já existe e está coberta (`SELECT id FROM profissional WHERE usuario_id = ...`). | `agenda.escopo.ts`:103; `catalogo-rbac.ts` | Fisioterapeuta sem profissional vinculado já resulta em `profissionalId: null` (fail-closed). |
| **FM-15** | Filtro de erro de controller `FiltroErroAgenda` já intercepta exceções da agenda e normaliza para `{ erro }`. | `erro-agenda.filter.ts`:53-82 | Novo controller de bloqueios utilizará o mesmo filtro padronizado. |
| **FM-16** | Risco de concorrência agendamento × bloqueio (`R2.2-09`) foi formalmente classificado como severidade baixa e homologado como risco aceito. | `docs/07` §17.2, §24.1; `docs/15` `D-AGD-11` | Não se exige lock em agendamentos ao criar bloqueio nem vice-versa. |
| **FM-17** | Teste estrutural do CHECK `ck_bloqueio_agenda_intervalo` já existe na suíte de persistência. | `packages/database/test/guard-anti-drift.spec.ts`:339-350 | Prova estrutural contra drift já está verde e ativa. |

---

## 3. Reconciliação normativa e alternativas avaliadas

### 3.1 Superfície HTTP: Consulta em recurso próprio vs. Modificação de `GET /agendamentos`
- **Alternativa A (Rejeitada):** Estender `GET /agendamentos` para retornar também bloqueios na mesma lista ou em propriedade adicional `{ agendamentos, bloqueios }`.  
  *Motivo da rejeição:* quebra o contrato fechado de `GET /agendamentos` publicado em AGD-A (`D-AGD-05`, `D-AGD-14`), mistura tipos heterogêneos de domínio em um mesmo endpoint, viola o princípio da responsabilidade única e exigiria reabertura de verificadores de AGD-A.
- **Alternativa B (Adotada):** Recurso próprio e explícito `GET /agenda/bloqueios` ao lado de `POST /agenda/bloqueios`.  
  *Motivação:* preserva `GET /agendamentos` intacto; fornece os dados necessários para que as visões diária e semanal (TLF-BASE §5.5) exibam as faixas de indisponibilidade com parâmetros temporais idênticos `[de, ate)` limitados a 7 dias; permite concessão de leitura à Recepção (via `agenda.gerenciar`) sem conceder permissão de criação.

### 3.2 Sobreposição entre bloqueios do mesmo profissional
- **Alternativa A (Rejeitada):** Bloquear sobreposições entre bloqueios no backend com erro `409 CONFLITO_BLOQUEIO`.  
  *Motivo da rejeição:* Como o MVP inicial de AGD-C é estritamente append-only (não oferece edição nem deleção de bloqueios), proibir sobreposição causaria um bloqueio operacional insolúvel. Se um fisioterapeuta já tiver lançado um bloqueio de 1 hora para consulta médica e a clínica precisar registrar um fechamento pontual para a semana toda (conforme `D-CFG-64`), o sistema rejeitaria o fechamento e ninguém conseguiria remover o bloqueio menor anterior. Além disso, sem exclusion constraint no PostgreSQL (cuja introdução exigiria migration e alteração do golden não autorizadas), a rejeição no backend manteria uma janela de corrida concorrente.
- **Alternativa B (Adotada):** Bloqueios sobrepostos são tolerados no modelo de dados e na criação.  
  *Motivação:* Coerente com o modelo append-only. A verificação de agendamentos em `AgendamentosService` faz `LIMIT 1`, de modo que um ou múltiplos bloqueios produzem exatamente o mesmo efeito de proteção (`409 CONFLITO_BLOQUEIO`). A consulta `GET /agenda/bloqueios` retorna os registros ordenados determinística e monotonamente por `inicio ASC, id ASC`, permitindo que a interface faça o agrupamento visual seguro.

### 3.3 Bloqueio com início no passado e término no futuro
- **Alternativa A (Rejeitada):** Rejeitar qualquer bloqueio com `inicio < instante_servidor` (simetria rígida com `D-AGD-03`).  
  *Motivo da rejeição:* Impede o registro de fechamentos operacionais pontuais (`D-CFG-64`) realizados no próprio dia após a abertura da clínica (ex.: emergência médica do profissional iniciada há 20 minutos ou decisão às 08:30 de fechar a clínica o dia todo por manutenção emergencial).
- **Alternativa B (Adotada):** Rejeitar apenas bloqueio totalmente no passado (`fim <= instante_servidor`). Permitir bloqueio iniciado no passado se `fim > instante_servidor`.  
  *Motivo:* Atende à realidade operacional sem violar a regra de proteção para horários futuros. Bloqueio totalmente no passado não oferece benefício protetivo e é rejeitado com `422 BLOQUEIO_NO_PASSADO`.

### 3.4 Permissões na leitura de bloqueios
- **Alternativa A (Rejeitada):** Exigir `agenda.bloqueio` tanto para criar quanto para ler `GET /agenda/bloqueios`.  
  *Motivo da rejeição:* O seed vigente não concede `agenda.bloqueio` à Recepcionista. Isso impediria a Recepção de enxergar os bloqueios ao montar a grade de horários do dia, gerando tentativas frustradas de agendamento sobre horários bloqueados.
- **Alternativa B (Adotada):** `POST /agenda/bloqueios` exige estritamente `agenda.bloqueio`. `GET /agenda/bloqueios` exige `agenda.gerenciar` OU `agenda.bloqueio`.  
  *Motivo:* Permite à Recepção (que possui `agenda.gerenciar`) consultar os bloqueios da clínica (escopo operacional) para prestar atendimento aos pacientes, sem conceder-lhe o privilégio de criar novos bloqueios.

---

## 4. Pacote de Decisões Técnicas (`D-AGDC-01` a `D-AGDC-15`)

### 4.1 `D-AGDC-01` — Subordinação e fronteira normativa [DERIVADA]
1. Este pacote subordina-se diretamente a `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md` e às decisões homologadas de `docs/15-pacote-decisao-agenda.md` (`D-AGD-01` a `D-AGD-17`).
2. Nenhuma decisão homologada anterior é reaberta ou enfraquecida.
3. Não há criação de nova permissão, nem alteração do seed RBAC vigente, nem inclusão de nova ação de auditoria no catálogo.
4. **Zero migration, zero alteração de schema Prisma e zero alteração de `schema.golden.sql`**. Nenhuma dependência externa ou lockfile é alterado.
5. Fatias AGD-D (pacotes) e AGD-E (início/conclusão de atendimento) permanecem estritamente fora de escopo.

### 4.2 `D-AGDC-02` — Superfície HTTP e rotas canônicas [ESCOLHA]
1. As rotas canônicas de bloqueio são expostas no módulo `agenda` sob o prefixo `/agenda/bloqueios`:
   - `POST /agenda/bloqueios` — criação de bloqueio;
   - `GET /agenda/bloqueios` — consulta de bloqueios em janela temporal.
2. Inexistência de rotas de mutação avulsa: `PUT`, `PATCH` e `DELETE` **não existem** para `/agenda/bloqueios` ou sub-rotas.
3. Qualquer requisição com método não suportado recebe `405 Method Not Allowed` ou `404 Not Found` (comportamento da plataforma).

### 4.3 `D-AGDC-03` — Contrato de criação (`POST /agenda/bloqueios`) [ESCOLHA]
1. **Cabeçalhos obrigatórios:**
   - Cookie de autenticação de sessão (`sessaoCookie`);
   - CSRF token: cabeçalho `x-tlf-requisicao: 1` obrigatório.
2. **Corpo da requisição (`CriarBloqueioDto`) — modo estrito:**
   ```json
   {
     "profissionalId": "00000000-0000-7000-8000-000000000001",
     "inicio": "2028-10-15T08:00:00-03:00",
     "fim": "2028-10-15T18:00:00-03:00",
     "motivo": "Manutenção preventiva das instalações"
   }
   ```
3. **Regras dos campos:**
   - `profissionalId`: string UUID obrigatória.
   - `inicio`: string ISO-8601 com offset explícito obrigatório (`Z` ou `±HH:MM`), segundos obrigatórios, milissegundos opcionais (até 3 dígitos).
   - `fim`: string ISO-8601 com offset explícito obrigatório.
   - `motivo`: string opcional/anulável. Se ausente, nulo, vazio ou contendo apenas espaços, é normalizado para `null`. Se preenchido, sofre `trim()` e tem tamanho máximo de 500 caracteres.
   - **Corpo estrito:** o envio de qualquer chave adicional (ex.: `id`, `criadoPorUsuarioId`, `criadoEm`, `observacao`) resulta imediatamente em `400 REQUISICAO_INVALIDA`.
4. **Projeção de resposta (`201 Created`):**
   - Cabeçalho `Location: /agenda/bloqueios/{id}`;
   - Corpo da resposta (`BloqueioRespostaDto`):
     ```json
     {
       "id": "00000000-0000-7000-8000-000000000099",
       "profissionalId": "00000000-0000-7000-8000-000000000001",
       "inicio": "2028-10-15T11:00:00.000Z",
       "fim": "2028-10-15T21:00:00.000Z",
       "motivo": "Manutenção preventiva das instalações",
       "criadoEm": "2026-09-18T10:30:00.000Z"
     }
     ```
   - O campo `criadoPorUsuarioId` **não é exposto** na API pública para resguardar a privacidade e o privilégio mínimo dos operadores.
   - `criadoEm` e instantes temporais são devolvidos em formato ISO-8601 UTC.

### 4.4 `D-AGDC-04` — Regras temporais e fronteiras [ESCOLHA]
1. `fim > inicio`: obrigatório. Se `fim <= inicio`, erro `400 REQUISICAO_INVALIDA`.
2. Bloqueio totalmente no passado (`fim <= agora` no instante da avaliação da transação no servidor): erro `422 BLOQUEIO_NO_PASSADO`.
3. Bloqueio em andamento (`inicio < agora` e `fim > agora`): permitido. O bloqueio passa a vigorar imediatamente para impedir novos agendamentos no restante do período.
4. Bloqueio no presente ou futuro (`inicio >= agora`): permitido.
5. Duração e amplitude:
   - Bloqueio pode atravessar meia-noite e cobrir múltiplos dias (férias, licenças, reformas, fechamentos de feriado prolongado — `D-CFG-64`, `docs/16` §68).
   - Duração máxima por bloqueio: 365 dias (8.760 horas). Violação: `422 INTERVALO_EXCESSIVO`.
   - Limite futuro de início: até 730 dias no futuro a partir do instante atual. Violação: `422 INTERVALO_EXCESSIVO`.
6. Relação com clínica e disponibilidade:
   - O bloqueio de agenda **não é limitado** pelas janelas de horário de funcionamento da clínica nem pela grade de disponibilidade do profissional. O bloqueio é uma interdição total do profissional no período informado.

### 4.5 `D-AGDC-05` — RBAC e escopo na criação (`POST /agenda/bloqueios`) [DERIVADA]
1. Exige estritamente a permissão `agenda.bloqueio`.
2. A resolução de escopo utiliza `EscopoAgendaService.resolver(tx, usuarioId, "agenda.bloqueio")`:
   - **Administrador:** papel `ADMINISTRADOR` concede `agenda.bloqueio` -> escopo **OPERACIONAL**. Pode criar bloqueio para qualquer profissional elegível.
   - **Fisioterapeuta:** papel `FISIOTERAPEUTA` concede `agenda.bloqueio` -> escopo **PRÓPRIO**. Pode criar bloqueio somente para o profissional que possui `profissional.usuario_id == ator.id`.
     - Se informar `profissionalId` de outro profissional: `403 ACESSO_NEGADO`.
     - Se o usuário Fisioterapeuta não tiver vínculo com nenhum profissional (`profissionalId === null`): `403 ACESSO_NEGADO` (fail-closed).
   - **Recepcionista:** o papel `RECEPCIONISTA` **não concede** `agenda.bloqueio` no seed vigente -> `403 ACESSO_NEGADO`.
   - **Papéis customizados / outros:** sem a permissão `agenda.bloqueio` recebem `403 ACESSO_NEGADO`. Se possuírem a permissão por papel customizado diferente de `ADMINISTRADOR`, operam sob escopo próprio (fail-closed).
3. Ator não autenticado: `401 REQUISICAO_NAO_AUTENTICADA`.
4. Ausência de CSRF: `403 REQUISICAO_NAO_AUTORIZADA`.

### 4.6 `D-AGDC-06` — Validação de elegibilidade do profissional [DERIVADA]
1. `profissionalId` deve existir na tabela `profissional` e possuir `ativo = true`.
2. Se o profissional não existir ou estiver inativo (`ativo = false`): erro `422 PROFISSIONAL_INELEGIVEL` (mesmo status e código de AGD-A, aplicando RN-008 e RN-013).
3. A validação de elegibilidade ocorre dentro da transação antes da gravação.

### 4.7 `D-AGDC-07` — Contrato e autorização da consulta (`GET /agenda/bloqueios`) [ESCOLHA]
1. **Cabeçalhos:** Cookie de sessão (`sessaoCookie`). Sem CSRF (operação segura de leitura).
2. **Autorização:** exige a permissão `agenda.gerenciar` OU `agenda.bloqueio`.
   - Administrador: escopo operacional (vê todos os bloqueios da clínica no período).
   - Recepcionista (possui `agenda.gerenciar`): escopo operacional (vê todos os bloqueios da clínica no período; necessário para exibir os horários bloqueados nas visões diária e semanal sem ter permissão de criar).
   - Fisioterapeuta: escopo próprio (vê exclusivamente os bloqueios do próprio profissional vinculado; se o parâmetro `profissionalId` for enviado na query, é forçado/sobrescrito para o seu próprio vínculo; se não possuir profissional vinculado, retorna `{ bloqueios: [] }`).
   - Gestor / perfis sem nenhuma das duas permissões: `403 ACESSO_NEGADO`.
3. **Parâmetros de query:**
   - `de` (obrigatório): string ISO-8601 com offset explícito.
   - `ate` (obrigatório): string ISO-8601 com offset explícito.
   - `profissionalId` (opcional): UUID. No escopo operacional, filtra por esse profissional; se omitido, retorna os bloqueios de todos os profissionais. No escopo próprio, é ignorado e forçado ao do ator.
4. **Validações de query:**
   - Janela temporal semiaberta `[de, ate)`.
   - `ate > de`: obrigatório. Se `de >= ate`, `400 REQUISICAO_INVALIDA`.
   - Limite máximo da janela: `ate - de <= 7 dias` (604.800.000 ms). Se exceder: `400 REQUISICAO_INVALIDA` (idêntico a `D-AGD-14`).
5. **Semântica de busca e ordenação:**
   - Retorna bloqueios que **intersectam** a janela: `tstzrange(inicio, fim, '[)') && tstzrange(de, ate, '[)')`.
   - Ordenação determinística obrigatória: `ORDER BY inicio ASC, id ASC`.
   - Sem paginação (volume limitado pela janela máxima de 7 dias).
   - Cabeçalho de resposta: `Cache-Control: no-store`.
6. **Resposta (`200 OK`):**
   ```json
   {
     "bloqueios": [
       {
         "id": "00000000-0000-7000-8000-000000000099",
         "profissionalId": "00000000-0000-7000-8000-000000000001",
         "inicio": "2028-10-15T11:00:00.000Z",
         "fim": "2028-10-15T21:00:00.000Z",
         "motivo": "Manutenção preventiva das instalações",
         "criadoEm": "2026-09-18T10:30:00.000Z"
       }
     ]
   }
   ```

### 4.8 `D-AGDC-08` — Coexistência com agendamentos existentes [DERIVADA]
1. Criar um bloqueio **não cancela, não remarca, não altera e não exclui** agendamentos existentes no mesmo período (AGD-004).
2. Não gera linhas em `historico_agendamento` e não emite eventos de auditoria sobre agendamentos preexistentes.
3. A coexistência temporária de um bloqueio com um agendamento já marcado é um **estado tolerado pelo domínio** (`docs/07` §17.2). Cabe à recepção/administração consultar a grade e, se necessário, realizar a remarcação ou o cancelamento manual com motivo do agendamento afetado.
4. Novos agendamentos (ou remarcações de agendamentos para o período bloqueado) continuam sendo terminantemente rejeitados com `409 CONFLITO_BLOQUEIO` no passo 10 do serviço de agendamentos (`RN-015.2`).

### 4.9 `D-AGDC-09` — Sobreposição entre bloqueios [ESCOLHA]
1. Bloqueios sobrepostos, idênticos, adjacentes ou contidos do mesmo profissional são aceitos e gravados como registros independentes na tabela `bloqueio_agenda`.
2. Não há chave de idempotência nem restrição no backend para criação de bloqueios redundantes. Reenviar a requisição gera um novo registro.
3. A adjacência exata (`bloqueio1.fim == bloqueio2.inicio`) é permitida por definição das faixas semiabertas `[inicio, fim)`.
4. A verificação de bloqueio em agendamentos (`LIMIT 1`) comporta-se de forma idêntica existindo um ou mais bloqueios no intervalo.
5. Na leitura `GET /agenda/bloqueios`, todos os bloqueios intersectantes são devolvidos com ordenação determinística (`inicio ASC, id ASC`).

### 4.10 `D-AGDC-10` — Persistência, transação e concorrência [DERIVADA]
1. A criação de bloqueio é executada dentro de uma transação gerenciada via `DatabaseService.transaction(async (tx) => { ... })`.
2. Ordem estrita dentro da transação:
   1. Resolução do escopo do ator (`EscopoAgendaService.resolver`);
   2. Verificação de elegibilidade de escopo próprio (fail-closed com `403 ACESSO_NEGADO`);
   3. Verificação do profissional na base (`SELECT ativo FROM profissional WHERE id = ...`) -> `422 PROFISSIONAL_INELEGIVEL` se inativo ou ausente;
   4. Validação temporal (`fim > inicio`, `fim > agora`, limites de duração);
   5. Inserção append-only na tabela `bloqueio_agenda`.
3. Sem necessidade de locks pessimistas (`FOR UPDATE`/`FOR SHARE`).
4. A concorrência entre criação de bloqueio e criação de agendamento é a race residual `R2.2-09`, expressamente aceita por `docs/07` §17.2 e `D-AGD-11`.
5. Rollback total em qualquer erro ou exceção não tratada.
6. Ausência de controle de concorrência otimista (`ETag`, `If-Match`, coluna de versão).

### 4.11 `D-AGDC-11` — Imutabilidade e encerramento de bloqueio [DERIVADA]
1. O bloqueio encerra-se exclusivamente pelo decurso natural de seu tempo de término (`fim`).
2. O modelo não oferece rotas de atualização (`PUT`, `PATCH`) nem de exclusão (`DELETE`).
3. Não há colunas de controle de edição (`atualizado_em`) ou exclusão lógica (`excluido_em`).
4. A edição e a remoção de bloqueios permanecem como evolução futura reservada a um pacote próprio (`D-AGD-16`), sem qualquer preparação prematura de rotas ou colunas neste momento.

### 4.12 `D-AGDC-12` — Auditoria e rastreabilidade [DERIVADA]
1. A criação de bloqueio **não gera evento** no subsistema de auditoria (`audit.catalog.ts`).
2. A ação `bloqueio_agenda.criado` continua deliberadamente FORA do catálogo de auditoria, conforme `docs/09` §13.2.
3. A própria tabela `bloqueio_agenda` atua como trilha funcional append-only, armazenando deterministicamente `criado_por_usuario_id` e `criado_em`.
4. Rejeições (400, 401, 403, 422) não geram registros persistentes.
5. O conteúdo do campo `motivo` nunca deve ser emitido em logs técnicos estruturados para resguardo de privacidade e LGPD (TLF-BASE §10).

### 4.13 `D-AGDC-13` — Catálogo fechado de erros [ESCOLHA]
Todos os erros emitidos pela superfície de bloqueios utilizam o envelope padrão `{ erro: CODIGO }`:

| Status HTTP | Código de erro (`erro`) | Cenário de disparo |
|---|---|---|
| `400` | `REQUISICAO_INVALIDA` | JSON malformado; chaves adicionais no corpo (modo estrito); tipos inválidos; instantes sem offset; `fim <= inicio`; `de` ou `ate` ausentes na consulta; `de >= ate`; consulta com janela > 7 dias; tamanho de motivo > 500 caracteres. |
| `401` | `REQUISICAO_NAO_AUTENTICADA` | Sem cookie de sessão, sessão inexistente, expirada ou revogada. |
| `403` | `REQUISICAO_NAO_AUTORIZADA` | Falha de validação do token CSRF no `POST`. |
| `403` | `ACESSO_NEGADO` | Ator sem permissão necessária (`agenda.bloqueio` no POST; nem `agenda.gerenciar` nem `agenda.bloqueio` no GET); Fisioterapeuta tentando criar para outro profissional; Fisioterapeuta sem profissional vinculado tentando criar bloqueio. |
| `413` | `CARGA_EXCESSIVA` | Payload excede o limite aceito pelo servidor. |
| `422` | `PROFISSIONAL_INELEGIVEL` | Profissional não existe ou está com `ativo = false`. |
| `422` | `BLOQUEIO_NO_PASSADO` | Bloqueio com término no passado (`fim <= instante_servidor`). |
| `422` | `INTERVALO_EXCESSIVO` | Duração do bloqueio > 365 dias ou início > 730 dias no futuro. |
| `500` | `FALHA_INTERNA` | Exceção não tratada ou indisponibilidade de banco de dados. |

### 4.14 `D-AGDC-14` — Superfície OpenAPI e verificadores [DERIVADA]
1. As duas novas rotas são documentadas na OpenAPI sob tags apropriadas de agenda:
   - `POST /agenda/bloqueios`: security `[sessaoCookie]`, cabeçalho `x-tlf-requisicao`, corpo `CriarBloqueioDto`, respostas `201, 400, 401, 403, 413, 422, 500`.
   - `GET /agenda/bloqueios`: security `[sessaoCookie]`, parâmetros `de`, `ate`, `profissionalId`, resposta `200, 400, 401, 403, 500`. Sem cabeçalho CSRF.
2. Atualizações obrigatórias nos verificadores:
   - `apps/api/test/openapi.spec.ts`: remoção do termo `"bloqueio"` da lista de termos proibidos; inclusão de `/agenda/bloqueios` na lista exata de caminhos documentados; provas negativas atestando a ausência de métodos `PUT`, `PATCH` e `DELETE`.
   - `apps/api/test/auth.module.integration.spec.ts`: inclusão de `/agenda/bloqueios` na lista fechada de rotas do runtime montado.
   - `apps/api/scripts/verify-openapi-runtime.mjs`: inclusão de `/agenda/bloqueios` nas listas fechadas de rotas e verificações de métodos.

### 4.15 `D-AGDC-15` — Governança de branch e PR única [ESCOLHA]
1. **Branch de integração única:** `agent/agd-c-bloqueios`.
2. **PR única:** a implementação completa de AGD-C será consolidada e entregue em um único Pull Request para `main`. Nenhuma issue filha abre PR isolada contra `main`.
3. Todas as 6 issues filhas trabalham coordenadas nessa árvore, com isolamento seguro de arquivos nas fases paralelas.

---

## 5. Matriz de testes de aceite (`TC-01` a `TC-26`)

| ID | Cenário / Descrição | Ator | Entrada / Condição | Resultado esperado |
|---|---|---|---|---|
| **TC-01** | Criação válida de bloqueio por Administrador | Administrador | `POST /agenda/bloqueios` com profissional ativo, início futuro e motivo | `201 Created`, cabeçalho `Location`, projeção devolvida, linha persistida em `bloqueio_agenda`. |
| **TC-02** | Criação válida de bloqueio próprio por Fisioterapeuta | Fisioterapeuta | `POST /agenda/bloqueios` com o próprio `profissionalId` vinculado | `201 Created`, linha persistida atribuída ao ator. |
| **TC-03** | Fisioterapeuta tentando criar bloqueio para outro profissional | Fisioterapeuta | `POST /agenda/bloqueios` com `profissionalId` de terceiro | `403 ACESSO_NEGADO`, nenhuma linha persistida. |
| **TC-04** | Fisioterapeuta sem cadastro profissional vinculado | Fisioterapeuta | `POST /agenda/bloqueios` com qualquer `profissionalId` | `403 ACESSO_NEGADO` (fail-closed). |
| **TC-05** | Recepcionista tentando criar bloqueio | Recepcionista | `POST /agenda/bloqueios` | `403 ACESSO_NEGADO` (ausência de `agenda.bloqueio`). |
| **TC-06** | Papel customizado sem `agenda.bloqueio` | Customizado | `POST /agenda/bloqueios` | `403 ACESSO_NEGADO` (fail-closed). |
| **TC-07** | Criação para profissional inexistente | Administrador | `POST /agenda/bloqueios` com UUID aleatório | `422 PROFISSIONAL_INELEGIVEL`. |
| **TC-08** | Criação para profissional inativo (`ativo = false`) | Administrador | `POST /agenda/bloqueios` com profissional inativo | `422 PROFISSIONAL_INELEGIVEL`. |
| **TC-09** | Intervalo com `fim <= inicio` | Administrador | `inicio: 10:00`, `fim: 10:00` ou `fim: 09:00` | `400 REQUISICAO_INVALIDA`. |
| **TC-10** | Intervalo totalmente no passado (`fim <= agora`) | Administrador | `inicio: ontem`, `fim: ontem` | `422 BLOQUEIO_NO_PASSADO`. |
| **TC-11** | Intervalo em andamento (`inicio < agora` e `fim > agora`) | Administrador | `inicio: 30min atrás`, `fim: 2h no futuro` | `201 Created`, bloqueio criado com sucesso. |
| **TC-12** | Bloqueio de múltiplos dias / atravessando meia-noite | Administrador | Intervalo de 5 dias contínuos | `201 Created`, aceito. |
| **TC-13** | Bloqueio excedendo duração máxima (> 365 dias) | Administrador | Intervalo de 400 dias | `422 INTERVALO_EXCESSIVO`. |
| **TC-14** | Bloqueio com data futura superior a 730 dias | Administrador | Início daqui a 3 anos | `422 INTERVALO_EXCESSIVO`. |
| **TC-15** | Normalização de motivo (espaços e nulo) | Administrador | `motivo: "   "` ou `motivo: "  ferias  "` | Persistido como `null` ou `"ferias"`. |
| **TC-16** | Motivo excedendo 500 caracteres | Administrador | String de 501 caracteres | `400 REQUISICAO_INVALIDA`. |
| **TC-17** | Bloqueios sobrepostos do mesmo profissional | Administrador | Criar dois bloqueios que coincidem total ou parcialmente | Ambos `201 Created`, linhas independentes persistidas. |
| **TC-18** | Coexistência com agendamento preexistente | Administrador | Criar agendamento às 10h; criar bloqueio das 09h às 12h | Bloqueio `201 Created`; agendamento das 10h permanece intacto em `AGENDADO`. |
| **TC-19** | Novo agendamento após criação de bloqueio | Recepcionista | Tentar agendar horário que colide com o bloqueio | `409 CONFLITO_BLOQUEIO` (RN-015.2). |
| **TC-20** | Consulta de bloqueios por Recepcionista | Recepcionista | `GET /agenda/bloqueios?de=...&ate=...` | `200 OK`, lista todos os bloqueios da clínica no período. |
| **TC-21** | Consulta de bloqueios por Fisioterapeuta | Fisioterapeuta | `GET /agenda/bloqueios?de=...&ate=...` | `200 OK`, retorna exclusivamente os bloqueios do próprio profissional. |
| **TC-22** | Consulta com janela inválida (`de >= ate` ou > 7 dias) | Administrador | `de > ate` ou intervalo de 8 dias | `400 REQUISICAO_INVALIDA`. |
| **TC-23** | Proteção contra CSRF na criação | Administrador | `POST /agenda/bloqueios` sem cabeçalho `x-tlf-requisicao` | `403 REQUISICAO_NAO_AUTORIZADA`. |
| **TC-24** | Ausência de autenticação (sessão anônima) | Anônimo | `POST` ou `GET` sem cookie de sessão | `401 REQUISICAO_NAO_AUTENTICADA`. |
| **TC-25** | Prova negativa de mutação e remoção | Administrador | `PUT`, `PATCH` ou `DELETE` em `/agenda/bloqueios` | `404 Not Found` ou `405 Method Not Allowed`. |
| **TC-26** | Prova de ausência de eventos de auditoria | Administrador | Criar bloqueio com sucesso | 0 novos eventos na tabela `evento_auditoria`. |

---

## 6. Lista mínima de Mutation Challenges obrigatórios

A implementação de AGD-C deverá submeter o código aos seguintes desafios de mutação intencional para provar que a suíte de testes falha imediatamente diante de qualquer regressão:

1. **Mutação MC-01 (RBAC de criação):** Trocar a permissão exigida no controller de `agenda.bloqueio` para `agenda.gerenciar`.  
   *Detecção esperada:* falha nos testes onde Recepcionista deve receber `403` ao tentar criar bloqueio.
2. **Mutação MC-02 (Escopo do fisioterapeuta):** Remover a verificação de igualdade entre `dados.profissionalId` e `escopo.profissionalId` no serviço.  
   *Detecção esperada:* falha nos testes onde Fisioterapeuta tenta criar bloqueio para outro profissional.
3. **Mutação MC-03 (Rejeição de passado):** Desativar a checagem de `fim <= instante_servidor`.  
   *Detecção esperada:* falha nos testes de tentativa de bloqueio totalmente no passado.
4. **Mutação MC-04 (CHECK no backend):** Remover a validação de `fim > inicio` no DTO/serviço.  
   *Detecção esperada:* falha nos testes de validação com `fim <= inicio` esperando `400 REQUISICAO_INVALIDA`.
5. **Mutação MC-05 (Ator da sessão):** Obter o `criadoPorUsuarioId` a partir do corpo da requisição em vez da sessão autenticada.  
   *Detecção esperada:* falha no teste de corpo estrito e injeção de ator.
6. **Mutação MC-06 (Filtro do escopo na consulta):** Desativar o filtro forçado de `profissionalId` na leitura do Fisioterapeuta.  
   *Detecção esperada:* falha nos testes onde Fisioterapeuta tenta consultar bloqueios de outros profissionais.
7. **Mutação MC-07 (Janela máxima de consulta):** Desativar a validação de limite de 7 dias na consulta.  
   *Detecção esperada:* falha no teste de consulta com intervalo de 8 dias.
8. **Mutação MC-08 (Auditoria vazia):** Inserir uma chamada para emissão de evento de auditoria ao criar bloqueio.  
   *Detecção esperada:* falha no teste de invariante que exige zero eventos de auditoria emitidos.

---

## 7. Arquitetura da implementação e árvore de execução

### 7.1 Árvore de issues e grafo de dependências

Para evitar os conflitos ocorridos em frentes anteriores com múltiplas PRs concorrentes, a execução técnica de AGD-C é estruturada sob a issue-pai [#106 — AGD-C: implementar bloqueios de agenda](https://github.com/BrunoMNoronha/techlab-fisio/issues/106), **uma única branch de integração** (`agent/agd-c-bloqueios`) e **uma única PR final para `main`**.

O grafo de execução entre as issues filhas é estritamente sequencial no núcleo e bifurca em paralelismo seguro após o congelamento dos contratos:

```text
Filha 1 (#107 — Contratos e Validações Puras)
   │
   ▼
Filha 2 (#108 — Serviço, Persistência e Escopo)
   │
   ▼
Filha 3 (#109 — Exposição HTTP e RBAC)
   │
   ├───────────────────────────────┐
   ▼                               ▼
Filha 4 (#110 — Integração)      Filha 5 (#111 — OpenAPI e Docs)
   │                               │
   └───────────────┬───────────────┘
                   ▼
Filha 6 (#112 — Gate Final e Relatório de Escopo)
```

```text
#107 → #108 → #109 → ┬→ #110 ─┐
                     └→ #111 ─┴→ #112
```

### 7.2 Matriz de responsabilidade e propriedade de arquivos

| Issue | Papel | Arquivos exclusivos / prioritários |
|---|---|---|
| **Filha 1** ([#107](https://github.com/BrunoMNoronha/techlab-fisio/issues/107)) | Contrato e validações puras | `apps/api/src/agenda/agenda-bloqueios.dto.ts`, `apps/api/test/agenda-bloqueios-dto.spec.ts` |
| **Filha 2** ([#108](https://github.com/BrunoMNoronha/techlab-fisio/issues/108)) | Serviço e persistência | `apps/api/src/agenda/agenda-bloqueios.service.ts`, `apps/api/test/agenda-bloqueios-service.spec.ts` |
| **Filha 3** ([#109](https://github.com/BrunoMNoronha/techlab-fisio/issues/109)) | Controller HTTP e rotas | `apps/api/src/agenda/agenda-bloqueios.controller.ts`, `apps/api/src/agenda/agenda.module.ts`, `apps/api/test/agenda-bloqueios-controller.spec.ts` |
| **Filha 4** ([#110](https://github.com/BrunoMNoronha/techlab-fisio/issues/110)) | Integração e concorrência *(paralelo com 5)* | `apps/api/test/integration/agenda-bloqueios.integration.spec.ts` |
| **Filha 5** ([#111](https://github.com/BrunoMNoronha/techlab-fisio/issues/111)) | OpenAPI e documentação *(paralelo com 4)* | `apps/api/test/openapi.spec.ts`, `apps/api/test/auth.module.integration.spec.ts`, `apps/api/scripts/verify-openapi-runtime.mjs`, `docs/10-backend-implementacao.md` |
| **Filha 6** ([#112](https://github.com/BrunoMNoronha/techlab-fisio/issues/112)) | Gate final e relatório de escopo | Execução completa de testes, verificação de zero drift, consolidação e abertura do PR final. |

---

## 8. Histórico de revisões

| REV. | Data | Autor | Descrição |
|---|---|---|---|
| **1** | 18/09/2026 | Responsável Técnico (AGD-C-PREP0) | Fechamento integral das decisões normativas, HTTP, RBAC, temporais, transacionais e de governança de AGD-C (`D-AGDC-01` a `D-AGDC-15`). Matriz de aceite `TC-01`..`TC-26`, mutation challenges e estratégia de árvore de issues com PR única. Estado: DECIDIDO TECNICAMENTE — PRONTO PARA IMPLEMENTAÇÃO. |

---

**Fim — `docs/19-pacote-decisao-bloqueios-agenda.md`.**
