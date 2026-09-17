# Pacote de Decisão do Cadastro de Profissionais (`PRO-001`, `PRO-002`, `PRO-004`, `PRO-005`) — `PRO-PREP1`

> **Documento:** `docs/18-pacote-decisao-cadastro-profissionais.md` *(criado como `docs/17-pacote-decisao-cadastro-profissionais.md`; renumerado na integração local `integration/local-fase4` — `D-INTEG-01`, REV. 3)*
> **Projeto:** TechLab Fisio
> **Frente:** FASE 3 — Profissionais (módulo M3), fatia 3B
> **Status:** **HOMOLOGADO — `D-PRO1-01`..`D-PRO1-10` APROVADAS CONFORME AS RECOMENDAÇÕES POR BRUNO MENEZES NORONHA EM 17/09/2026**, inclusive a alteração estrutural de banco de `D-PRO1-07`; **fatia PRO-A implementada e medida** (`docs/10` §6-AD) — **integrada na branch local `integration/local-fase4`, não publicada na `main`** (`docs/10` §6-AE). §§1–7 permanecem como a proposta submetida.
> **Data:** 17 de setembro de 2026
> **Base medida:** `origin/main` = `218960c`. Referências **locais não integradas** consideradas: `docs/15` (agenda, `D-AGD-*`) e `docs/16` (disponibilidade, `D-PRO3-*`), homologados em 17/09/2026 em worktree de outra sessão, sem commit.
> **Natureza:** pacote de análise somente leitura, no precedente de `CFG-PREP0`..`CFG-PREP5` e `PRO-PREP3`.
> **Numeração:** `docs/15` e `docs/16` já estão em uso localmente por outra sessão; este pacote usou `docs/17` para evitar colisão. Na integração das quatro frentes o ordinal 17 permaneceu com `docs/17-pacote-decisao-pacientes.md` (sequência da frente de configuração horária/pacientes) e este pacote passou a `docs/18` (`D-INTEG-01`, decisão de Bruno Menezes Noronha); os identificadores `D-PRO1-*` não mudaram.
> **Escopo:** PRO-001 (cadastro), PRO-002 (especialidades), PRO-004 (serviços realizados) e a exposição HTTP de PRO-005 (situação). PRO-003 **está fora** — já decidido em `docs/16`.

---

## 1. Fontes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md` §5.3, §6, §8, §14 — não alterada.
- `docs/02` PRO-001..PRO-005; matriz FT-02 (`T-PRO-CREATE`, `T-PRO-INACTIVE`, `T-PRO-SERVICE-AUTH`).
- `docs/03` RN-007, RN-008, RN-013.
- `docs/04` §4 (matriz: "Gerenciar profissionais" `✓ — — —`; "Consultar profissionais" `✓ ✓ ✓ ✓`), §5.2 (`profissionais.gerenciar`: "Cadastro, disponibilidade, serviços e situação").
- `docs/06` §6 M3, §7.3.
- `docs/07` §7.3, §10.1 `U-08`, §17.4 (T-01, passo de `profissional_servico`), §23.
- `docs/09` §12.2 (`profissional.situacao.alterada`, whitelist vazia), `D-AUD-01` (catálogo fechado).
- `docs/14` §3.11 (`D-CFG-22`..`D-CFG-33`) e §3.12 (`D-CFG-34`..`D-CFG-45`) — padrão de catálogo homologado.
- Locais: `docs/15` `D-AGD-01` (AGD-A depende de "PRO-001 mínimo (profissional com situação e `usuario_id`)" e de PRO-004), `D-AGD-*` passos 5 e 7 de T-01, escopo "próprio" por `profissional.usuario_id`; `docs/16` §5.2 ("Pacote mínimo de PRO-001 e PRO-004 — A INICIAR").

## 2. Fatos de partida

| # | Fato | Evidência |
| --- | --- | --- |
| FP-01 | `profissional`: `id`, `usuario_id` uuid **anulável e único** (`U-08`), `nome text NN`, `registro_profissional text ∅`, `ativo boolean NN` sem default, `inativado_em ∅`, `criado_em`. **Sem** CHECK de situação, **sem** `atualizado_em` | `schema.prisma`; `docs/07` §7.3 |
| FP-02 | `especialidade`: só `id`, `nome`, `criado_em` — **sem** unicidade, **sem** `ativo`, sem `clinica_id` | `schema.prisma` |
| FP-03 | `profissional_especialidade` e `profissional_servico`: PK composta + `criado_em`; **sem** histórico (remover a linha apaga a associação) | `schema.prisma`; `docs/07` §7.3 |
| FP-04 | A existência de `profissional_servico` **é** a elegibilidade de PRO-004/RN-013, verificada no backend em T-01 | `docs/07` §7.3, §17.4 |
| FP-05 | Permissão única `profissionais.gerenciar`, só do Administrador. "Consultar profissionais" **não tem código**; o comentário do catálogo registra a lacuna | `catalogo-rbac.ts:182–185, 242`; `docs/04` §4 |
| FP-06 | Auditoria: só `profissional.situacao.alterada` (PRO-005). **Nenhuma ação** para cadastro, edição, especialidades ou serviços; `D-AUD-01` é catálogo fechado. PRO-001, PRO-002 e PRO-004 **não** têm linha de auditoria em `docs/02` | `docs/09` §12; `docs/02` |
| FP-07 | `ProfissionalService.alterarSituacao` existe (transação + evento), **sem rota e sem RBAC**; no-op é **erro** `SITUACAO_JA_VIGENTE`, divergente do padrão homologado depois (`D-CFG-37`: no-op → 200 sem evento) | `apps/api/src/profissional/profissional.service.ts` |
| FP-08 | AGD-A (local) exige `422 PROFISSIONAL_INELEGIVEL` (inativo) e `422 SERVICO_NAO_HABILITADO`; escopo "próprio" do Fisioterapeuta via `profissional.usuario_id = ator` | `docs/15` (local) |
| FP-09 | Nenhum runtime escreve em `profissional`, `especialidade` ou nas junções | `apps/api/src` |

## 3. Questões centrais

1. **Fatiamento:** PRO-002 depende de modelagem ausente (FP-02, FP-03) e **não é pré-requisito** da agenda; PRO-001/004/005 são (FP-08).
2. **Vínculo com usuário:** o escopo "próprio" da agenda depende de `usuario_id`; é preciso decidir quem vincula, quando e com que restrições.
3. **Auditoria:** catálogo fechado; cadastro e habilitação de serviços não têm ação.
4. **Consulta por outros papéis:** a matriz concede "Consultar" a todos, mas não há código de permissão.

## 4. Decisões propostas

Marcas: **[DERIVADA]** decorre diretamente das fontes; **[ESCOLHA]** exige decisão.

### 4.1 `D-PRO1-01` — Fatiamento **[ESCOLHA]**

- **Recomendação:** fatia **PRO-A** = PRO-001 + PRO-004 + exposição de PRO-005 (pré-requisitos de AGD-A). **PRO-002 adiado** para pacote próprio: exige decidir unicidade, situação e preservação histórica das associações (o aceite de PRO-002 remete a "modelagem futura").
- Alternativa: incluir PRO-002 agora como catálogo mínimo, com migration de unicidade em `especialidade`.

### 4.2 `D-PRO1-02` — Contrato HTTP de PRO-001 **[ESCOLHA]**

Rotas de nível superior, módulo próprio (`profissional/` existente é ampliado):

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `GET /profissionais[?ativo=true\|false]` | `200` lista, sem paginação, ordem `ativo DESC, lower(nome), id` | `400` |
| `GET /profissionais/:profissionalId` | `200` | `400`; `404 PROFISSIONAL_NAO_ENCONTRADO` |
| `POST /profissionais` | `201` | `400`; `409 USUARIO_JA_VINCULADO`; `422 USUARIO_INELEGIVEL` |
| `PUT /profissionais/:profissionalId` | `200` | `400`; `404`; `409 USUARIO_JA_VINCULADO`; `422 USUARIO_INELEGIVEL` |
| `PATCH /profissionais/:profissionalId/situacao` | `200` | `400`; `404` |

- Corpo de `POST`/`PUT`: **exatamente** `{ nome, registroProfissional, usuarioId }` (`registroProfissional` e `usuarioId` aceitam `null`); `PUT` é substituição total; `ativo` não é aceito.
- Resposta: **exatamente** `{ id, nome, registroProfissional, usuarioId, ativo, inativadoEm }`. **Não** expõe e-mail ou dados do usuário vinculado.
- **Sem `DELETE`** (RN-007, `docs/07` §23). GETs com `Cache-Control: no-store`; CSRF só nas mutações.

### 4.3 `D-PRO1-03` — Validação **[ESCOLHA]**

- `nome`: string, `trim`, **1–200** code points, sem caractere de controle.
- `registroProfissional`: `null` ou string, `trim`, **1–50** code points, sem caractere de controle; vazio após `trim` → `400` (não vira `null` implicitamente). **Sem** validação de formato de conselho (CREFITO etc.) e **sem unicidade** — `docs/07` não a prevê; homônimos e registros repetidos não são bloqueados.
- `usuarioId`: `null` ou UUID.
- Corpo estrito, sem coerção (mesmo padrão de `D-CFG-38`).

### 4.4 `D-PRO1-04` — Vínculo com usuário **[ESCOLHA]**

- **Recomendação:** vínculo **opcional**, definido e alterado **somente** pelo Administrador, via `usuarioId` no `POST`/`PUT`.
  - Usuário inexistente ou **inativo** → `422 USUARIO_INELEGIVEL` (sem oráculo além de "inelegível").
  - Usuário já vinculado a **outro** profissional → `409 USUARIO_JA_VINCULADO` (tradução **somente** do `23505` de `U-08`).
  - **Não** se exige papel `FISIOTERAPEUTA` no usuário (um Administrador pode atender); **não** se cria usuário nem se altera papel.
  - Desvincular (`usuarioId: null`) e trocar o vínculo são permitidos; o efeito é imediato sobre o escopo "próprio" da agenda (`docs/15`), inclusive sobre agendamentos existentes do profissional.
- Alternativa: vínculo imutável depois de definido (reduz risco de troca de escopo, mas impede correção de erro de cadastro).

### 4.5 `D-PRO1-05` — Serviços realizados (PRO-004) **[ESCOLHA]**

- `GET /profissionais/:profissionalId/servicos` → `200` com `{ servicoId, nome, ativo }` dos serviços associados, ordem `lower(nome), id`.
- `PUT /profissionais/:profissionalId/servicos` com corpo **exato** `{ servicoIds: uuid[] }` → **substituição do conjunto**, sem duplicatas (duplicata → `400`), até 200 itens.
  - Serviço inexistente → `422 SERVICO_INELEGIVEL`.
  - **Acrescentar** serviço **inativo** → `422 SERVICO_INELEGIVEL` (CFG-003: inativo não é associado a novo uso).
  - **Manter** associação já existente com serviço que ficou inativo é permitido (não força limpeza).
  - Remover associação é permitido; **não** altera agendamentos existentes (T-01 só verifica elegibilidade na criação/remarcação).
  - Conjunto idêntico ao vigente → `200` sem escrita.
- Permitido para profissional **inativo** (preparação de reativação).
- Limitação declarada: sem histórico de associações (FP-03); a trilha, se houver, é a de §4.8.

### 4.6 `D-PRO1-06` — Situação (PRO-005) **[DERIVADA]** com ajuste **[ESCOLHA]**

- `PATCH /profissionais/:profissionalId/situacao` com `{ ativo: boolean }`; inativação grava `inativado_em = now()`, reativação o anula.
- **Ajuste recomendado:** alinhar o no-op ao padrão homologado (`D-CFG-37`) — pedido do estado vigente → `200` com o estado atual, **sem** mutação e **sem** evento — substituindo o erro interno `SITUACAO_JA_VIGENTE` (FP-07), que nunca foi exposto.
- Inativação **não** cancela nem altera agendamentos existentes (RN-007; mesma linha de `D-PRO3-05`); novos agendamentos passam a ser rejeitados por T-01 (`PROFISSIONAL_INELEGIVEL`).
- Evento `profissional.situacao.alterada`, contexto vazio, mesma transação (já implementado).

### 4.7 `D-PRO1-07` — Invariantes físicas **[ESCOLHA — estrutural]**

- Migration com `CHECK ck_profissional_situacao (ativo = (inativado_em IS NULL))`, no precedente de `D-CFG-23`/`D-CFG-35`.
- **Nenhuma** unicidade de nome ou registro.

### 4.8 `D-PRO1-08` — Auditoria de cadastro e serviços **[ESCOLHA]**

- **Recomendação:** **sem** evento para criação, edição e alteração de serviços; só PRO-005 é auditado (já no catálogo). Limitação declarada, consistente com `D-PRO3-09` (disponibilidade sem evento) e com a ausência de linha de auditoria em PRO-001/004. Nenhuma ampliação de `D-AUD-01`.
- Alternativa: nova ação `profissional.cadastro.alterado` (whitelist vazia) cobrindo criação, edição, vínculo de usuário e serviços — exige decisão normativa de ampliação do catálogo (`docs/09`).
- Observação de risco: a troca de `usuarioId` muda o escopo de acesso à agenda sem rastro, se a recomendação for aceita.

### 4.9 `D-PRO1-09` — Autorização e consulta por outros papéis **[ESCOLHA]**

- Todas as rotas desta fatia exigem **`profissionais.gerenciar`**.
- **Recomendação:** **não** criar agora `profissionais.consultar`; a seleção de profissional pela Recepção e pelo Fisioterapeuta é decidida na fatia de agenda (AGD-A), que já embute `profissional: { id, nome }` nas respostas — mesmo tratamento de `D-CFG-43`.
- Alternativa: criar `profissionais.consultar` concedida aos quatro papéis (matriz `docs/04` §4), restrita a `GET` com resposta mínima `{ id, nome, ativo }`, com seed aditivo convergente (`D-2.3D-14`).

### 4.10 `D-PRO1-10` — Concorrência e erros **[DERIVADA]**

- `PUT`, `PATCH` e `PUT .../servicos` serializam por `SELECT ... FOR UPDATE` na linha de `profissional`; no-op decidido sob o lock; última escrita válida prevalece (limitação aceita, como `D-CFG-29`/`D-CFG-41`).
- `23505` traduzido **somente** na constraint de `U-08`; qualquer outra violação → `500 FALHA_INTERNA`.
- Envelope `{ erro }`; `401`/`403`/`500` pelos contratos gerais; `403` não gera evento.

## 5. Perguntas para Bruno Menezes Noronha

| ID | Pergunta | Recomendação |
| --- | --- | --- |
| P-PRO1-01 | Fatiamento (`D-PRO1-01`) | PRO-001 + PRO-004 + PRO-005 agora; PRO-002 adiado |
| P-PRO1-02 | Contrato, validação e serviços (`D-PRO1-02`, `-03`, `-05`) | aprovar como propostos |
| P-PRO1-03 | Vínculo com usuário (`D-PRO1-04`) | opcional, editável pelo Administrador, sem exigir papel |
| P-PRO1-04 | No-op de situação 200 (`D-PRO1-06`) | alinhar a `D-CFG-37` |
| P-PRO1-05 | **Migration** `ck_profissional_situacao` (`D-PRO1-07`) | aprovar |
| P-PRO1-06 | Auditoria de cadastro/serviços (`D-PRO1-08`) | sem evento; limitação declarada |
| P-PRO1-07 | `profissionais.consultar` (`D-PRO1-09`) | não criar agora; decidir em AGD-A |
| P-PRO1-08 | Autorizar implementação da fatia PRO-A em branch local, sem publicação | a critério de Bruno |

**Nada é presumido.** A homologação autoriza a materialização documental; a implementação depende de P-PRO1-08.

## 6. Matriz de testes de aceite (se aprovado)

| ID | Cenário | Esperado |
| --- | --- | --- |
| TP-01 | Criar profissional válido, com e sem `registroProfissional`/`usuarioId` | `201`, 6 campos, ativo |
| TP-02 | Nome/registro inválidos, chave extra, `ativo` no corpo, coerção | `400`, sem escrita |
| TP-03 | `usuarioId` inexistente ou de usuário inativo | `422 USUARIO_INELEGIVEL` |
| TP-04 | `usuarioId` já vinculado a outro profissional (sequencial e concorrente) | `409 USUARIO_JA_VINCULADO` |
| TP-05 | `PUT` idêntico; troca e remoção de vínculo | `200`; no-op sem escrita (xmin) |
| TP-06 | Listagem: ordem, filtro, `no-store`; GET por id 200/404/400 | conforme contrato |
| TP-07 | Serviços: substituição, duplicata `400`, inexistente/inativo novo `422`, inativo mantido `200`, conjunto idêntico sem escrita | conforme `D-PRO1-05` |
| TP-08 | Situação: inativar/reativar com evento; repetição `200` sem evento; agendamentos intactos | conforme `D-PRO1-06` |
| TP-09 | Falha da auditoria na situação → `500` e rollback | sem mutação |
| TP-10 | `401`, `403` sem `profissionais.gerenciar` (inclusive Gestor/Recepção/Fisioterapeuta), CSRF nas mutações, GET sem CSRF, sem `DELETE` | conforme contrato |
| TP-11 | Leitura sob lock (`PUT`, `PATCH`, serviços) | serialização provada |
| TP-12 | Banco rejeita situação incoerente (`ck_profissional_situacao`) | CHECK |
| TP-13 | OpenAPI × runtime (rotas, status, sem `DELETE`) | `openapi.spec.ts`, `verify:openapi-runtime` |

## 7. Dependências e riscos

- **Conflito de integração** com frentes locais paralelas: `docs/15`/`docs/16` (agenda e disponibilidade, que também tocarão `apps/api/src/profissional/`), CFG-005 e CFG-004 (listas de rotas, `app.module.ts`, golden).
- PRO-003 (`docs/16`) usa `profissionais.gerenciar` e a mesma linha de `profissional` para lock — a implementação de PRO-A e PRO-003 deve compartilhar o módulo.
- Se `D-PRO1-08` for aceita sem evento, alterações de vínculo de usuário (que mudam escopo de acesso à agenda) ficam sem trilha.

## 8. Decisão de Bruno Menezes Noronha (17/09/2026)

| Pergunta | Resposta |
| --- | --- |
| P-PRO1-01 fatiamento | **Aprovado** — PRO-A = PRO-001 + PRO-004 + exposição de PRO-005; PRO-002 adiado |
| P-PRO1-02 contrato, validação e serviços | **Aprovados** como propostos |
| P-PRO1-03 vínculo com usuário | **Opcional e editável** pelo Administrador; usuário existente e ativo; único; sem exigir papel |
| P-PRO1-04 no-op de situação | **Alinhado a `D-CFG-37`** (`200` sem mutação e sem evento) |
| P-PRO1-05 migration `ck_profissional_situacao` | **Aprovada** |
| P-PRO1-06 auditoria de cadastro/serviços | **Sem evento**; limitação declarada |
| P-PRO1-07 `profissionais.consultar` | **Não criada agora**; decisão na fatia de agenda |
| P-PRO1-08 implementação | **Autorizada** em branch local, sem commit, push, PR ou merge |

## 9. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **3** | 17/09/2026 | Renumeração documental `D-INTEG-01` (Bruno Menezes Noronha): `docs/17-pacote-decisao-cadastro-profissionais.md` → `docs/18-pacote-decisao-cadastro-profissionais.md`, para eliminar a colisão de ordinal com `docs/17-pacote-decisao-pacientes.md`. Referências atualizadas no código, nos testes, em `schema.prisma` e em `docs/10`. Status atualizado da implementação "em branch local, sem commit" para a consolidação na branch local `integration/local-fase4`. Identificadores `D-PRO1-*` e conteúdo normativo inalterados. |
| **2** | 17/09/2026 | Registro factual: fatia PRO-A implementada e medida em branch local sem commit (`docs/10` §6-AD). Nenhuma decisão criada, alterada ou reaberta. |
| **1** | 17/09/2026 | Homologação integral conforme as recomendações e autorização de implementação da fatia PRO-A (§8). |
| **0** | 17/09/2026 | Pacote `PRO-PREP1` submetido à decisão. Somente documental. |
