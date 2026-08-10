# Modelo de Domínio e Fronteiras Arquiteturais Preliminares — TechLab Fisio

> **Documento:** `docs/06-modelo-dominio.md` **Projeto:** TechLab Fisio **Fase:** 2 — Modelagem — **Etapa 2.1: Modelo de Domínio e fronteiras arquiteturais preliminares** **Status:** **HOMOLOGADO — REV. 3 — ETAPA 2.1 CONCLUÍDA** **Homologação:** decisões **H2-01 a H2-12** aprovadas em conjunto por **Bruno Menezes Noronha** em **10 de agosto de 2026** **Data:** 10 de agosto de 2026 **Idioma oficial:** Português do Brasil

---

## 1. Status e fontes

### 1.1 Status

Documento de **consolidação final da Etapa 2.1**. As decisões **H2-01 a H2-12 estão HOMOLOGADAS** (10/08/2026). As decisões da REV. 2 que foram substituídas por essas homologações **deixam de ser vigentes** (ver 1.6). Este documento descreve **domínio e fronteiras conceituais**; **não** contém — e **não antecipa** — schema/Prisma, migrations, modelo físico, índices físicos, endpoints, DTOs, OpenAPI, código, infraestrutura ou qualquer decisão da **Etapa 2.2**. As pendências remanescentes estão identificadas na seção 18.

### 1.2 Fontes e hierarquia (TLF-BASE-V1 §15)

1. **`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`** — fonte fundamental e imutável (não modificada).
2. `docs/02-requisitos.md`, `docs/03-regras-negocio.md`, `docs/04-perfis-permissoes.md`, `docs/05-jornadas-fluxos.md` (branch `agent/fase1-documentacao-homologada`).
3. Aprovação explícita de Bruno das decisões H2-01..H2-12 (precedência §15.1 da Base).

### 1.3 Regra de resolução de conflito

Divergências entre Fase 1 e a Base são registradas (seção 18) e a decisão afetada é interrompida, sem escolha silenciosa (TLF-BASE-V1 §15). As homologações H2 respeitam integralmente a Base.

### 1.4 Baseline do repositório

No clone local inspecionado, a branch `main` possui `README.md` versionado e `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` presente no working tree como arquivo *untracked*. `docs/02..05` existem apenas na branch `agent/fase1-documentacao-homologada`. A colocação física deste documento é decisão de Bruno (seção 20). Nenhum commit/push/PR/merge/rebase havia sido realizado até a consolidação deste documento.

### 1.5 Histórico de revisões

- **REV. 1** — proposta inicial.
- **REV. 2** — correções do parecer: Agendamento≠Atendimento; não congelar cardinalidade clínica; atomicidade síncrona; escopo do pacote pendente; remoção de estratégias técnicas; GAP-DOM-01/02.
- **REV. 3 (esta) — CONSOLIDAÇÃO FINAL** — homologação de H2-01..H2-12; separação estrutural Reserva×Movimento; pacote com serviço específico; precedência de estado; bloqueio de ajuste negativo; ciclo financeiro pós-estorno (novo pagamento e cancelamento); correções de cardinalidade.

### 1.6 Registro de homologação e decisões substituídas

**Mapeamento H2 → identificadores internos e efeito nesta REV. 3:**

| H2 Decisão homologada Ref. interna Efeito  |                                                                                                                               |                    |                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| **H2-01**                                  | `Agendamento` (M5) e `Atendimento` (M6) distintos; `Agendamento 1 → 0..1 Atendimento`                                         | D2.1-01            | Vigente                                                                                           |
| **H2-02**                                  | M7 é único dono de Pacote, **`Reserva de Sessão`** e **`Movimento de Sessão`** (conceitos distintos); saldo e disponibilidade | D2.1-02 (refinado) | **Reserva separada de Movimento; tipos de Movimento = CONSUMO/AJUSTE\_POSITIVO/AJUSTE\_NEGATIVO** |
| **H2-03**                                  | Decomposição clínica **e** aggregate root de `Atendimento` **adiados** (P-CLIN)                                               | D2.1-05/08         | `Atendimento` **não** é aggregate root nesta etapa                                                |
| **H2-04**                                  | Operações críticas síncronas/transacionais (T-01, T-02, T-08, T-09)                                                           | D2.1-04            | Vigente                                                                                           |
| **H2-05**                                  | Consumo único por `(atendimento, pacote)`                                                                                     | I-26, T-02         | Vigente                                                                                           |
| **H2-06**                                  | Pacote e Cobrança como aggregate roots; Atendimento **não**                                                                   | D2.1-06/07         | Vigente                                                                                           |
| **H2-07**                                  | Pacote vinculado a **exatamente um Serviço** no MVP                                                                           | P-04 resolvida     | Dependência M7→M2 firme                                                                           |
| **H2-08**                                  | Financeiro nunca cria/remove/devolve/ajusta sessão                                                                            | D2.1-10, I-39      | D-03 preservado                                                                                   |
| **H2-09**                                  | Estado do pacote por precedência `CANCELADO > EXPIRADO > ESGOTADO > ATIVO`                                                    | I-30b              | GAP-DOM-01 resolvido                                                                              |
| **H2-10**                                  | Ajuste negativo rejeitado se `saldo_de_direito < reservas_ativas`                                                             | I-24b              | GAP-DOM-01 (parte) resolvido                                                                      |
| **H2-11**                                  | Cobrança `ESTORNADO` (não cancelada, obrigação válida) pode **receber novo pagamento** e re-derivar estado                    | GAP-DOM-02         | `ESTORNADO → PARCIALMENTE_PAGO/PAGO`                                                              |
| **H2-12**                                  | Cobrança `ESTORNADO` pode ser **cancelada** com autorização/auditoria, preservando histórico                                  | GAP-DOM-02         | `ESTORNADO → CANCELADO`                                                                           |

**Decisões da REV. 2 que deixam de ser vigentes:** (a) `RESERVA`/`LIBERACAO_RESERVA` como *tipos de Movimento de Sessão* (substituído por H2-02 — Reserva é conceito próprio); (b) qualquer multiplicidade fixada para `Atendimento ↔ Registro clínico` (substituído por H2-03 — não definida, P-CLIN); (c) escopo do pacote como pendência em aberto (substituído por H2-07 — serviço específico); (d) `Atendimento` como aggregate root (substituído por H2-03/H2-06 — adiado); (e) relação simétrica `0..1 — 0..1` entre Agendamento e Pacote (corrigida — seção 9).

---

## 2. Objetivo e escopo

### 2.1 Objetivo

Consolidar, com H2-01..H2-12, o **modelo de domínio do MVP** como **monólito modular** (TLF-BASE-V1 §4.6), com fronteiras por **ownership de regras e de dados**.

### 2.2 Escopo incluído

Mapa de módulos; entidades, agregados e VOs necessários; cardinalidades preliminares; invariantes; máquinas de estado herdadas; transações críticas; concorrência/idempotência; ownership; dependências; eventos conceituais; matriz de rastreabilidade.

### 2.3 Escopo excluído (TLF-BASE-V1 §13)

Multitenancy, multiempresa, convênios/TISS, emissão fiscal, conciliação, comissão, portal do paciente, mensageria distribuída, microserviços, event sourcing, CQRS, política automática de consumo/cobrança por falta, bloqueio por inadimplência, novos estados de pacote, estorno parcial de um mesmo pagamento.

**Eventos/fatos de domínio** são **linguagem conceitual**; **não** implicam broker, fila, event bus, consistência eventual ou execução assíncrona. Coordenação crítica é **síncrona e transacional** (H2-04).

---

## 3. Princípios de modelagem

1. Ownership único de regra e dado (referência por id).
2. Monólito modular **síncrono** (crítico transacional; sem microserviços/mensageria/assíncrono).
3. Regras críticas no backend (RN-002).
4. Separação administrativo × clínico (RN-009, PAC-007).
5. Integridade clínica append-only (RN-024..027).
6. Movimentos, não edição destrutiva; saldos/situações são **derivados** (RN-030/044/045).
7. Efeitos independentes com vínculo rastreável (D-03).
8. Consumo exatamente-uma-vez por **(atendimento, pacote)**; gatilho único = primeira finalização válida do registro clínico; `Atendimento` (M6) é referência estável (D-02, HOM-04, RN-034; H2-01/H2-05).
9. Concorrência por **propriedade** ("não produzir dois resultados válidos incompatíveis"); mecanismo decidido na Etapa 2.2.
10. Privilégio mínimo e negação por padrão (docs/04 §2).
11. UTC persistido, negócio no fuso configurado (CFG-006, RN-060).
12. Simplicidade do MVP; não congelar decomposições que a Base não obriga (§8; H2-03/P-CLIN).
13. Simetria de autorização em leitura agregada (RN-059, IND-009).

---

## 4. Mapa dos módulos

| # Módulo Sigla Responsabilidade central (dono de…)  |                             |     |                                                                                                                    |
| --------------------------------------------------- | --------------------------- | --- | ------------------------------------------------------------------------------------------------------------------ |
| M1                                                  | **Identity & Access**       | AUT | Usuário, credencial, sessão, papel, permissão, escopo                                                              |
| M2                                                  | **Clinic Configuration**    | CFG | Clínica única, horário, catálogo de serviços, formas de pagamento, motivos de cancelamento, fuso                   |
| M3                                                  | **Professionals**           | PRO | Profissional, especialidade, disponibilidade, serviços realizados                                                  |
| M4                                                  | **Patients**                | PAC | Paciente (administrativo), contato de emergência, responsável legal, consentimentos, observação administrativa     |
| M5                                                  | **Scheduling**              | AGD | Agendamento, bloqueio, histórico, **máquina de estados do agendamento**, vínculo agendamento↔pacote                |
| M6                                                  | **Clinical Care & Records** | PRN | **Atendimento (encontro clínico)**, registro clínico, retificação, anexo, autoria clínica                          |
| M7                                                  | **Packages / Sessions**     | PKG | Pacote, saldo de direito, disponibilidade, **`Reserva de Sessão`** e **`Movimento de Sessão`** (distintos — H2-02) |
| M8                                                  | **Finance**                 | FIN | Cobrança, pagamento, estorno, desconto, recibo simples                                                             |
| M9                                                  | **Reporting / Indicators**  | IND | Cálculo/agregação (somente leitura)                                                                                |
| M10                                                 | **Audit**                   | AUD | Trilha append-only de operações sensíveis                                                                          |

### 4.1 Fronteiras homologadas

- **H2-01** — `Agendamento` (M5) e `Atendimento` (M6) são entidades distintas; a **máquina operacional permanece exclusivamente no Agendamento**; nenhum módulo adicional é criado.
- **H2-02** — M7 é o único dono de Pacote, `Reserva de Sessão` e `Movimento de Sessão`.
- **D2.1-03** — M9 é somente-leitura/agregação, sem dado autoritativo próprio.

---

## 5. Dependências entre módulos

### 5.1 Grafo (direção = "depende de / consulta")

```
                         ┌──────────────────────────┐
                         │  M1 Identity & Access     │
                         └──────────────────────────┘
                                    ▲ (autorização — todos)
   M2 Clinic Config   M3 Profissionais   M4 Patients
        ▲   ▲              ▲                 ▲   ▲
   ┌────┴───┴──────────────┴─────────────────┴───┐   ┌───────────────────┐
   │            M5 Scheduling (Agenda)            │◀─▶│  M7 Packages       │
   │  consulta: PAC, PRO, CFG, PKG(disponibilidade│   │  consulta: PAC,    │
   │  via porta). Emite fatos de reserva a M7      │   │  CFG(Serviço) firme│
   └───────────────────────────────────────────────┘   └───────────────────┘
        ▲ (M6 lê Agendamento)                                 ▲
   ┌────┴───────────────────────────┐                         │ consumo (gatilho)
   │ M6 Clinical Care & Records      │─────────────────────────┘
   │ dono: Atendimento, Registro     │
   └─────────────────────────────────┘

   M8 Finance → PAC, CFG(forma pagto); referencia origem AGD/PKG (id, leitura). NUNCA escreve em PKG (H2-08).
   M9 Reporting/Indicators → lê AGD, PKG, FIN, PRN(metadados), PRO.
   M10 Audit ← registros append-only de todos.

```

### 5.2 Tabela de dependências

| Módulo Depende de Aciona / emite fato Proibido depender de  |                                                   |                                  |                              |
| ----------------------------------------------------------- | ------------------------------------------------- | -------------------------------- | ---------------------------- |
| M1                                                          | —                                                 | authz a todos; grava M10         | módulos de negócio           |
| M2                                                          | M1                                                | M10                              | M5–M9                        |
| M3                                                          | M1, M2                                            | M10                              | M5–M9                        |
| M4                                                          | M1                                                | M10                              | M5–M9                        |
| M5                                                          | M1, M2, M3, M4, M7 (disponibilidade via porta)    | M7 (reserva/liberação), M10      | **M6**, M8                   |
| M6                                                          | M1, M4, **M5 (Agendamento)**                      | **M7 (gatilho de consumo)**, M10 | M8, M9; não escreve em M5/M7 |
| M7                                                          | M1, M4, **M2 (Serviço do pacote — firme, H2-07)** | M10                              | M6, M8                       |
| M8                                                          | M1, M2, M4; referencia AGD/PKG por id             | M10                              | **M7/sessões (H2-08)**, M6   |
| M9                                                          | M1 + leitura das fontes                           | —                                | (não muta)                   |
| M10                                                         | M1                                                | —                                | (só metadados)               |

### 5.3 Acoplamentos com atenção (sem ciclo de domínio)

- **M5↔M7** bidirecional em runtime: M5 lê disponibilidade via **porta** e solicita reserva **na mesma transação** (T-01). Sem publicação assíncrona (R-02).
- **M6→M5** unidirecional; "iniciar atendimento" é orquestrado na aplicação (T-09), sem ciclo de domínio.
- **M6→M7** unidirecional; M7 recebe só ids `(atendimentoId, pacoteId)`, nunca conteúdo clínico (RN-062).

---

## 6. Descrição de cada módulo

### 6.1 M1 — Identity & Access

Autenticação, identidade, sessão, papéis/permissões/escopo; autoridade de autorização. Dados: Usuário, Sessão (`ATIVA/EXPIRADA/REVOGADA`), Papel, Permissão, associações, segredo de recuperação. AUT-001..006. Invariantes RN-001/003/004/005/006. Transação T-07. Autorização: `usuarios.gerenciar`, `permissoes.gerenciar`, `sessoes.revogar_terceiro`, `senha.recuperar_terceiro`. Regras: AUT-001..006; D-04; FC-01.

### 6.2 M2 — Clinic Configuration

Clínica única e catálogos. Dados: Clínica, Horário, Serviço (duração, preço de referência, situação), Forma de pagamento, Motivo de cancelamento, Fuso. CFG-001..006. Invariantes: clínica única (CFG-001); inativos preservam histórico (RN-007/008); preço não reescreve cobrança histórica; UTC+fuso (CFG-006, RN-060). Autorização: `clinica.configurar`. **H2-07:** o catálogo de Serviço é referenciado por Pacote (M7), que se vincula a exatamente um Serviço.

### 6.3 M3 — Professionals

Profissional, especialidade, disponibilidade, serviços realizados. PRO-001..005. Inativo não recebe novo agendamento (RN-007/008); serviço não associado rejeitado (PRO-004). Autorização: `profissionais.gerenciar`.

### 6.4 M4 — Patients

Dados administrativos e prevenção de duplicidade; sem conteúdo clínico. Dados: Paciente (CPF opcional), Contato de emergência, Responsável legal (condicional), Consentimento, Observação administrativa. PAC-001..007. Invariantes RN-009/010/011/012, PAC-007. Concorrência C-07 (propriedade; sem merge automático). Autorização: `pacientes.administrativo.gerenciar`, `pacientes.localizar`.

### 6.5 M5 — Scheduling

Reserva de horário, prevenção de conflitos, ciclo operacional do compromisso, vínculo opcional a pacote. **Dono exclusivo da máquina de estados do agendamento (H2-01).** Não é dono do `Atendimento`. Dados: Agendamento (início/fim, serviço, estado, modalidade avulsa/pacote, vínculo a pacote), Bloqueio, Histórico. AGD-001..009. Invariantes: sem sobreposição de profissional/bloqueio/mesmo paciente (D-06, RN-015); remarcação revalida (RN-016); agenda não consome sessão (D-02); conflito seguro (propriedade — AGD-005, RN-065); máquina 11.1. Relação com M6: ao `AGUARDANDO → EM_ATENDIMENTO` (AGD-007), a aplicação cria o `Atendimento` em M6 (T-09). Depende de M1/M2/M3/M4/M7(porta). Evita M6, M8. Transações T-01, T-08, T-09. Autorização: `agenda.gerenciar/checkin/falta/bloqueio`; início exige capacidade clínica (RN-019). Regras: AGD-001..009; RN-013..020; D-06/D-07; FC-03/FC-04; PKG-004.

### 6.6 M6 — Clinical Care & Records

Encontro clínico e conteúdo clínico, com finalização imutável, retificação append-only e anexos privados. **Único gatilho de consumo.**

- **`Atendimento`** — encontro clínico; **referência clínica estável** para prontuário, autoria e consumo; existe **quando há execução clínica**; referencia Agendamento (id) e Paciente (id); **sem máquina de estados operacional própria** (a operacional é exclusiva do Agendamento — H2-01). **Classificação como aggregate root ADIADA (H2-03/H2-06/P-CLIN).**
- **Registro clínico** — `EM_ELABORACAO/FINALIZADO`; autoria; vinculado ao Atendimento.
- **Retificação clínica** — vinculada ao original; `EM_ELABORACAO/EFETIVADA`.
- **Anexo clínico** — referência privada.
- Avaliação fisioterapêutica, plano terapêutico, evolução e demais registros permanecem nesta fronteira; **decomposição (entidades × componentes) e multiplicidade Atendimento↔Registro ADIADAS (H2-03/P-CLIN)**.

Operações PRN-001..008. Invariantes: finalizado imutável (RN-024); correção só por retificação (RN-025/026); retificação efetivada imutável (RN-027); autoria/escopo (RN-021, D-01); retificação de terceiro exige permissão excepcional (D-01); sem decisão clínica autônoma (RN-022); anexos privados (RN-064). **Gatilho de consumo inequívoco (preservado):** a **primeira finalização válida do registro clínico correspondente ao** **`Atendimento`** aciona o consumo daquele atendimento (D-02, HOM-04, RN-033/070); a unicidade `(atendimentoId, pacoteId)` garante consumo único independentemente da decomposição/multiplicidade a definir na P-CLIN. Depende de M1/M4/M5. Aciona M7. Evita M8/M9; não escreve em M5/M7. Transações T-09, T-02. Autorização: `prontuario.ler/escrever/finalizar/retificar_proprio/retificar_terceiro/exportar`. Regras: PRN-001..008; RN-021..029; D-01; HOM-04; FC-05/FC-06.

### 6.7 M7 — Packages / Sessions

**Dono único de Pacote,** **`Reserva de Sessão`****,** **`Movimento de Sessão`****, saldo de direito e disponibilidade (H2-02).**

- **Pacote** — paciente (id); **exatamente um Serviço (id) — H2-07**; quantidade contratada; validade opcional; situação **derivada** `ATIVO/ESGOTADO/EXPIRADO/CANCELADO` (por precedência — H2-09).
- **`Reserva de Sessão`** *(conceito operacional — H2-02, distinto de Movimento)* — **referencia um** **`Agendamento`**; representa **capacidade operacional reservada**; **não reduz consumo efetivo**; participa de `reservas_ativas`; é **criada, atualizada ou liberada pelos fluxos de agenda** conforme D-07 (criada no agendamento; liberada em cancelamento/falta/desvinculação; resolvida na finalização/consumo). **Sua representação física é ADIADA para a Etapa 2.2.**
- **`Movimento de Sessão`** *(razão histórica/efetiva — H2-02)* — imutável no fluxo comum; **tipos conceituais aprovados nesta etapa:** **`CONSUMO`****,** **`AJUSTE_POSITIVO`****,** **`AJUSTE_NEGATIVO`**. **`RESERVA`** **e** **`LIBERACAO_RESERVA`** **NÃO são tipos de Movimento de Sessão.** Consumo referencia `Atendimento` (id); ajuste referencia ator/justificativa.

**Fórmulas (H2-02):**

- `saldo_de_direito = quantidade_contratada + Σ AJUSTE_POSITIVO − Σ AJUSTE_NEGATIVO − Σ CONSUMO`
- `reservas_ativas = quantidade de Reserva de Sessão ativas`
- `disponivel_para_novos_agendamentos = saldo_de_direito − reservas_ativas`

Operações PKG-001..009. **Invariantes:** contratar/cobrar/pagar não consome (D-03); saldo derivado, não editável (RN-030); reserva ≠ consumo (D-07, RN-032); consumo só na finalização válida (D-02, HOM-04, RN-033/070); **no máximo um** **`CONSUMO`** **por** **`(atendimento, pacote)`** (RN-034, H2-05); retry não duplica (RN-035); cancelamento/falta liberam `Reserva de Sessão` sem consumo (RN-036/037); ajuste é movimento auditado (RN-038/039); **`AJUSTE_NEGATIVO`** **rejeitado se resultar em** **`saldo_de_direito < reservas_ativas`** **(H2-10)**; estados por **precedência** **`CANCELADO > EXPIRADO > ESGOTADO > ATIVO`** **(H2-09)**; cancelar pacote não cancela agendamento (RN-071, HOM-05); estorno financeiro não devolve sessão (RN-049, D-03, H2-08); **agendamento vinculado a pacote deve casar o Serviço do pacote (H2-07)**. Depende de M1/M4/M2(Serviço). Recebe fatos de M5 (reserva) e M6 (consumo). Evita M6/M8. Transações T-01(reserva)/T-02(consumo)/T-06(ajuste)/T-08(liberação). Autorização: `pacotes.gerenciar`, `pacotes.ajustar_sessao`. Regras: PKG-001..009; RN-030..040, RN-070/071; D-02/D-03/D-05/D-07; HOM-04/HOM-05; FC-07.

### 6.8 M8 — Finance

Cobranças, pagamentos, estornos, descontos, recibo; **nunca cria, remove, devolve ou ajusta sessão (H2-08, D-03)**: pagamento não consome sessão; estorno não devolve sessão; consumo não cria pagamento. Dados: Cobrança (origem funcional por id, valor bruto/desconto/líquido, data de referência, situação derivada), Pagamento, Estorno (integral), Recibo. FIN-001..008. Invariantes: valor líquido ≥ 0 (RN-042); desconto exige permissão (RN-043); pagamentos preservados (RN-044); situação derivada (RN-045/048); excesso bloqueado (RN-046); cancelada não aceita pagamento (RN-047); estorno é movimento integral (RN-048/069, HOM-03); estorno não devolve sessão (RN-049); cancelamento com pagamentos exige resolução explícita e histórico preservado (RN-050); recibo não fiscal (RN-051); financeiro não bloqueia atendimento/consumo (RN-052). **Ciclo pós-estorno:** cobrança `ESTORNADO` não cancelada e ainda obrigação válida pode **receber novo pagamento** e re-derivar `PARCIALMENTE_PAGO`/`PAGO` (H2-11); e pode ser **cancelada** com autorização/auditoria, preservando todo o histórico → `CANCELADO` (H2-12). Transações T-03/T-04/T-05. Autorização: `financeiro.*`. Regras: FIN-001..008; RN-041..052, RN-068/069; D-03; HOM-02/HOM-03; FC-08.

### 6.9 M9 — Reporting / Indicators

Indicadores reproduzíveis, sem dado autoritativo próprio, sem duplicar regras. Fonte: AGD, PKG, FIN, PRO, PRN(metadados). IND-001..009. Invariantes RN-053..060; autorização antes da agregação (RN-059); fuso (RN-060). Somente leitura. Autorização: `indicadores.globais.ler`, `indicadores.proprios.ler`, `financeiro.relatorio.ler`.

### 6.10 M10 — Audit

Trilha append-only. Evento de auditoria (ator, ação, alvo, data/hora, resultado, justificativa). AUD-001..006. Invariantes RN-061..066; não copia clínico/segredo; não editável (RN-066). Autorização: `auditoria.ler`.

---

## 7. Entidades e responsabilidades

### 7.1 M1 — Usuário; Sessão; Papel; Permissão; Segredo de recuperação; associações N\:N.

### 7.2 M2 — Clínica; Serviço; Forma de pagamento; Motivo de cancelamento; Horário; Fuso.

### 7.3 M3 — Profissional; Especialidade; Disponibilidade; Profissional↔Serviço.

### 7.4 M4 — Paciente; Contato de emergência; Responsável legal; Consentimento; Observação administrativa.

### 7.5 M5 — Agendamento; Bloqueio de agenda; Histórico de agenda.

### 7.6 M6 — Atendimento; Registro clínico; Retificação clínica; Anexo clínico. *(Decomposição/aggregate root adiados — P-CLIN.)*

### 7.7 M7 — **Pacote** (paciente id, **Serviço id — H2-07**, quantidade, validade opcional, situação derivada). **`Reserva de Sessão`** (referencia Agendamento; conceito operacional; representação física adiada). **`Movimento de Sessão`** (`CONSUMO`/`AJUSTE_POSITIVO`/`AJUSTE_NEGATIVO`; consumo referencia Atendimento). *(Reserva e Movimento são conceitos distintos — H2-02.)*

### 7.8 M8 — Cobrança; Pagamento; Estorno; Recibo.

### 7.9 M9 — Definições/parâmetros de indicador.

### 7.10 M10 — Evento de auditoria.

---

## 8. Agregados (somente onde justificados)

### 8.1 Pacote como Aggregate Root conceitual (M7) — H2-06, refinado por H2-02

- **Root:** Pacote. **Internos:** `Reserva de Sessão` e `Movimento de Sessão`.
- **Invariantes do agregado:** `count(CONSUMO por (atendimento,pacote)) ≤ 1` (H2-05); `reservas_ativas ≤ saldo_de_direito`; `AJUSTE_NEGATIVO` não deixa `saldo_de_direito < reservas_ativas` (H2-10); situação derivada por precedência `CANCELADO > EXPIRADO > ESGOTADO > ATIVO` (H2-09).

### 8.2 Cobrança como Aggregate Root conceitual (M8) — H2-06

- **Root:** Cobrança. **Internos:** Pagamentos e Estornos.
- **Invariantes:** `recebido_líquido ≤ valor_líquido`; situação = função determinística dos movimentos, incluindo o ciclo pós-estorno (H2-11: novo pagamento re-deriva; H2-12: cancelamento autorizado → CANCELADO); movimentos nunca apagados.

### 8.3 Fronteira clínica append-only (M6) — H2-03 / H2-06

- **Homologado:** registros/retificações clínicos são append-only; `Atendimento` é referência estável.
- **ADIADO (P-CLIN):** designação de aggregate root do `Atendimento`; decomposição (avaliação/plano/evolução como entidades × componentes); multiplicidade Atendimento↔Registro.
- **Invariantes da fronteira:** registro `FINALIZADO` nunca muta; retificação sempre vinculada; retificação efetivada imutável; `(atendimento, pacote)` consome no máximo uma vez.

### 8.4 Não promovidos a agregado

Agendamento (M5) — conflito é inter-agendamentos, resolvido por concorrência no serviço (C-01). Usuário (M1), Paciente (M4) — entidades simples. **`Atendimento`** **(M6) — NÃO homologado como aggregate root nesta etapa (H2-03/H2-06).**

---

## 9. Cardinalidades preliminares

Itens adiados marcados. Correções da REV. 2 aplicadas.

| Relação Cardinalidade Observações               |                                                                             |                                                                                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clínica — Serviço                               | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Clínica — Forma de pagamento / Motivo           | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Usuário — Papel / Papel — Permissão             | `*` — `*`                                                                   |                                                                                                                                                                                                                            |
| Usuário — Sessão                                | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Profissional — Especialidade / Serviço          | `*` — `*`                                                                   |                                                                                                                                                                                                                            |
| Profissional — Disponibilidade                  | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Paciente — Contato emergência                   | 1 — `0..*`                                                                  |                                                                                                                                                                                                                            |
| Paciente — Responsável legal                    | 1 — `0..1`                                                                  |                                                                                                                                                                                                                            |
| Paciente — Consentimento                        | 1 — `0..*`                                                                  |                                                                                                                                                                                                                            |
| Paciente / Profissional / Serviço — Agendamento | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| **Agendamento → Pacote (vínculo) — CORRIGIDO**  | Agendamento referencia **`0..1`** **Pacote**                                | (não simétrico)                                                                                                                                                                                                            |
| **Pacote → Agendamentos — CORRIGIDO**           | Pacote relaciona-se a **`0..*`** **Agendamentos**                           | um pacote pode ter vários agendamentos                                                                                                                                                                                     |
| **Serviço → Pacote (H2-07)**                    | **`1 → 0..*`** (Serviço 1 → 0..\* Pacotes)                                  | **cada Pacote referencia exatamente 1 Serviço**                                                                                                                                                                            |
| Paciente — Pacote                               | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| **Pacote — Reserva de Sessão (H2-02)**          | 1 — `*`                                                                     | reservas do pacote                                                                                                                                                                                                         |
| **Agendamento — Reserva de Sessão**             | 1 — `0..1`                                                                  | reserva por agendamento de pacote                                                                                                                                                                                          |
| **Pacote — Movimento de Sessão (H2-02)**        | 1 — `*`                                                                     | razão (CONSUMO/AJUSTE\_POSITIVO/AJUSTE\_NEGATIVO)                                                                                                                                                                          |
| **Atendimento — Movimento de CONSUMO**          | 1 — `0..1`                                                                  | unicidade `(atendimento, pacote)` (RN-034, H2-05)                                                                                                                                                                          |
| Agendamento — Atendimento (H2-01)               | 1 — `0..1`                                                                  | Atendimento só em execução clínica                                                                                                                                                                                         |
| **Atendimento → Registro clínico**              | **NÃO DEFINIDA — P-CLIN (H2-03)**                                           | multiplicidade não congelada nesta etapa                                                                                                                                                                                   |
| Paciente — Registro clínico                     | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Registro clínico — Retificação / Anexo          | 1 — `0..*`                                                                  | append-only / privados                                                                                                                                                                                                     |
| Paciente — Cobrança                             | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| **Cobrança → origem funcional**                 | cada Cobrança tem **exatamente uma origem funcional** aplicável ao seu tipo | origem = agendamento/atendimento avulso, Pacote, ou cobrança administrativa, conforme regras vigentes; **multiplicidade inversa origem→Cobrança adiada (Etapa 2.2), salvo regra homologada — sem** **`1:1`** **inventado** |
| Cobrança — Pagamento                            | 1 — `*`                                                                     |                                                                                                                                                                                                                            |
| Pagamento — Estorno                             | 1 — `0..1`                                                                  | integral (RN-069)                                                                                                                                                                                                          |
| Operação sensível — Evento de auditoria         | 1 — `1..*`                                                                  |                                                                                                                                                                                                                            |

---

## 10. Invariantes (consolidado)

### 10.1 Identidade

I-01 inativo não cria/mantém sessão (RN-001); I-02 sessão terminal não reativa (RN-004); I-03 authz no backend (RN-002); I-04 união de papéis não concede clínico (RN-003, D-01); I-05 papel+permissão+escopo; I-06 recuperação atômica (RN-005).

### 10.2 Separação administrativo × clínico

I-07 observação adm. sem clínico (RN-009); I-08 recepção/gestor sem narrativa clínica; I-09 auditoria/logs sem clínico (RN-062/063); I-10 indicadores respeitam permissão (RN-059).

### 10.3 Agenda

I-11 sem sobreposição de profissional/bloqueio/mesmo paciente (D-06, RN-015); I-12 conflito seguro (propriedade); I-13 remarcação revalida (RN-016); I-14 `CONCLUIDO/FALTA/CANCELADO` terminais (RN-020); I-15 agenda não consome sessão (D-02).

### 10.4 Prontuário / Atendimento

I-16 finalizado imutável (RN-024); I-17 correção append-only (RN-025); I-18 original inalterado (RN-026); I-19 retificação efetivada imutável (RN-027); I-20 retificação de terceiro com permissão excepcional (D-01); I-21 autoria atribuível (RN-021); I-21b `Atendimento` é referência estável, sem máquina de estados própria (H2-01).

### 10.5 Pacotes (H2-02/07/09/10)

- I-22 saldo derivado de `Movimento de Sessão`, não editável (RN-030).
- I-23 `saldo_de_direito = quantidade_contratada + Σ AJUSTE_POSITIVO − Σ AJUSTE_NEGATIVO − Σ CONSUMO` (RN-031).
- I-24 `disponivel = saldo_de_direito − reservas_ativas` (RN-031, D-07); `reservas_ativas` = `Reserva de Sessão` ativas (H2-02).
- **I-24b (H2-10)** — `AJUSTE_NEGATIVO` não pode resultar em `saldo_de_direito < reservas_ativas`; portanto `saldo_de_direito ≥ reservas_ativas` permanece verdadeiro após ajuste (saldo negativo é vedado no fluxo normal). Reduzir além das reservas exige resolver antes as reservas/agendamentos correspondentes.
- I-25 reserva ≠ consumo (D-07); `Reserva de Sessão` e `Movimento de Sessão` são conceitos distintos (H2-02).
- I-26 no máximo um `CONSUMO` por `(atendimento, pacote)` (RN-034, H2-05).
- I-27 consumo idempotente sob retry/concorrência (RN-035).
- I-28 cancelamento/falta liberam `Reserva de Sessão` sem consumo (RN-036/037).
- I-29 cancelar pacote não cancela agendamento (RN-071, HOM-05).
- I-30 estados limitados a `ATIVO/ESGOTADO/EXPIRADO/CANCELADO` (RN-040).
- **I-30b (H2-09)** — situação **derivada por precedência** `CANCELADO > EXPIRADO > ESGOTADO > ATIVO`. Pacote `ESGOTADO` que recebe `AJUSTE_POSITIVO` suficiente retorna a `ATIVO` **se** não estiver cancelado, não estiver expirado e `saldo_de_direito > 0`.
- **I-31c (H2-07)** — agendamento/atendimento vinculado a pacote exige que o Serviço corresponda ao Serviço do pacote.

### 10.6 Integração Prontuário + Pacotes

I-31 gatilho único = primeira finalização válida do registro correspondente ao `Atendimento` (D-02, HOM-04, RN-033/070); I-32 `CONCLUIDO` da agenda não é gatilho e nunca cria segunda baixa (RN-033/070); I-33 finalização + consumo + **resolução da** **`Reserva de Sessão`** + auditoria crítica na **mesma transação**; se o consumo obrigatório falhar, a finalização **não** é confirmada (H2-04/H2-05).

### 10.7 Financeiro

I-34 líquido ≥ 0 / desconto com permissão (RN-042/043); I-35 pagamentos preservados (RN-044); I-36 situação derivada, incluindo ciclo pós-estorno (H2-11 novo pagamento; H2-12 cancelamento) (RN-045/048); I-37 excesso bloqueado (RN-046); I-38 estorno integral por movimento (RN-048/069, HOM-03); **I-39 financeiro nunca cria/remove/devolve/ajusta sessão (D-03, RN-049, H2-08)**; I-40 financeiro não bloqueia atendimento/consumo (RN-052).

### 10.8 Indicadores

I-41 fórmulas únicas (RN-053..058); I-42 authz antes da agregação (RN-059); I-43 fuso configurado (RN-060).

### 10.9 Auditoria

I-44 atribuível (RN-061); I-45 sem cópia de clínico/segredo (RN-062/063); I-46 não editável (RN-066).

---

## 11. Máquinas de estado herdadas da Fase 1

`Atendimento` (M6) **não** introduz máquina nova (a operacional é exclusiva do Agendamento — H2-01).

### 11.1 Agendamento (M5)

```
AGENDADO ── confirmar ──▶ CONFIRMADO
AGENDADO ── check-in ───▶ AGUARDANDO
AGENDADO ── cancelar ───▶ CANCELADO
AGENDADO ── falta ──────▶ FALTA
CONFIRMADO ── check-in ─▶ AGUARDANDO
CONFIRMADO ── cancelar ─▶ CANCELADO
CONFIRMADO ── falta ────▶ FALTA
AGUARDANDO ── iniciar ──▶ EM_ATENDIMENTO   (cria Atendimento clínico em M6 — T-09)
AGUARDANDO ── cancelar (excepcional) ▶ CANCELADO
EM_ATENDIMENTO ── concluir ▶ CONCLUIDO

```

Terminais: `CONCLUIDO/FALTA/CANCELADO`. Remarcação é operação.

### 11.2 Registro clínico (M6)

```
EM_ELABORACAO ── finalizar ──▶ FINALIZADO   (primeira finalização válida = gatilho de consumo)
RETIFICACAO_EM_ELABORACAO ── efetivar ──▶ RETIFICACAO_EFETIVADA (imutável)

```

### 11.3 Sessão de autenticação (M1)

```
ATIVA ── expiração ──▶ EXPIRADA
ATIVA ── revogação ──▶ REVOGADA

```

### 11.4 Cobrança (M8) — com ciclo pós-estorno (H2-11 / H2-12)

```
PENDENTE ── pagamento parcial ──▶ PARCIALMENTE_PAGO
PENDENTE ── pagamento total ────▶ PAGO
PENDENTE ── cancelamento elegível ▶ CANCELADO
PARCIALMENTE_PAGO ── quitação ──▶ PAGO
PARCIALMENTE_PAGO/PAGO ── estorno (resta recebimento>0) ▶ PARCIALMENTE_PAGO
PARCIALMENTE_PAGO/PAGO ── estorno de todos efetivos ────▶ ESTORNADO
ESTORNADO ── novo pagamento (não CANCELADA, obrigação válida) ──▶ PARCIALMENTE_PAGO | PAGO   (H2-11)
ESTORNADO ── cancelamento autorizado (obrigação invalidada) ─────▶ CANCELADO                 (H2-12)

```

Estado **derivado** do efeito líquido; sem estorno parcial (HOM-03, RN-069); nenhum estado novo criado. Cobrança `CANCELADA` não recebe pagamento (RN-047). No cancelamento pós-estorno (H2-12), pagamentos e estornos são **preservados** (histórico não apagado/reescrito) e a operação é auditada.

### 11.5 Pacote (M7) — estado derivado por precedência (H2-09)

```
Precedência determinística da situação:
  1) CANCELADO   (cancelamento administrativo válido)
  2) EXPIRADO    (validade atingida)
  3) ESGOTADO    (saldo_de_direito = 0)
  4) ATIVO       (caso contrário)

```

`ESGOTADO` + `AJUSTE_POSITIVO` suficiente ⇒ `ATIVO`, se não cancelado, não expirado e `saldo_de_direito > 0` (GAP-DOM-01 resolvido). Validade para agendamento/remarcação avaliada na **data/hora do atendimento** (HOM-05). Sem estados adicionais (RN-040).

---

## 12. Transações críticas

**Diretriz homologada (H2-04): coordenação síncrona e transacional; sem fila/mensageria/assíncrono.** Mecanismo físico (isolamento/unicidade/lock) é pendência da Etapa 2.2 (P-03).

### 12.1 T-01 — Criar/remarcar agendamento + `Reserva de Sessão` (M5 coordena M7) — mesma transação

Revalidar conflitos + (se pacote) verificar `saldo_de_direito − reservas_ativas` e **casar o Serviço do pacote (H2-07)** + persistir agendamento + criar `Reserva de Sessão` ativa. Invariantes I-11/I-12/I-13/I-24/I-31c.

### 12.2 T-02 — Finalização clínica + consumo + resolução da reserva + auditoria (M6→M7) — mesma transação — crítica

Finalizar registro + criar `Movimento CONSUMO` por `(atendimento, pacote)` + **resolver a** **`Reserva de Sessão`** correspondente + auditoria crítica. **Se o consumo obrigatório falhar, a finalização não é confirmada** (rollback conjunto). Unicidade de domínio `(atendimentoId, pacoteId)`; retries idempotentes (H2-05). Invariantes I-16/I-26/I-27/I-31/I-32/I-33.

### 12.3 T-03 — Registrar pagamento (M8)

Validar forma ativa + não ultrapassar saldo + criar Pagamento + rederivar situação (inclui reativação a partir de `ESTORNADO` não cancelada — H2-11). Invariantes I-34..I-37, I-36.

### 12.4 T-04 — Estornar pagamento (M8)

Validar elegibilidade + criar Estorno integral + rederivar. Invariantes I-38, I-39 (não toca sessões).

### 12.5 T-05 — Cancelar cobrança com pagamentos/estornos (M8)

Resolver movimentos explicitamente + cancelar + auditar, **preservando histórico**. Inclui `ESTORNADO → CANCELADO` autorizado (H2-12). I-36, RN-050.

### 12.6 T-06 — Ajuste manual de sessão (M7)

Validar permissão + justificativa + **(se** **`AJUSTE_NEGATIVO`****) garantir** **`saldo_de_direito`** **resultante ≥** **`reservas_ativas`** **(H2-10)** + criar `Movimento AJUSTE_POSITIVO`/`AJUSTE_NEGATIVO` + auditar + rederivar situação por precedência (H2-09). I-22, I-24b, RN-038/039.

### 12.7 T-07 — Recuperação de senha / revogação (M1)

Invalidar segredo + nova senha + revogar sessões. I-06, I-02.

### 12.8 T-08 — Liberar `Reserva de Sessão` por cancelamento/falta/desvinculação (M5→M7) — mesma transação

Transição do agendamento + liberação da `Reserva de Sessão`, sem consumo. I-15, I-25, I-28.

### 12.9 T-09 — Iniciar atendimento clínico (M5 + M6) — mesma transação

Transitar agendamento `AGUARDANDO → EM_ATENDIMENTO` (M5) + criar `Atendimento` (M6), orquestrado na aplicação. RN-019, I-21b. Não consome (I-15).

---

## 13. Pontos de concorrência / idempotência

Declara-se a **propriedade requerida**; o mecanismo é da Etapa 2.2 (P-03).

| ID Ponto Módulos Propriedade requerida  |                                                |         |                                                      |
| --------------------------------------- | ---------------------------------------------- | ------- | ---------------------------------------------------- |
| C-01                                    | Dois agendamentos no mesmo recurso             | M5(+M7) | Não produzir dois agendamentos válidos incompatíveis |
| C-02                                    | `Reserva de Sessão` vs. saldo                  | M5↔M7   | `reservas_ativas ≤ saldo_de_direito`                 |
| C-03                                    | Finalizações concorrentes do mesmo atendimento | M6→M7   | No máximo um `CONSUMO` por `(atendimento, pacote)`   |
| C-04                                    | Retry de finalização/consumo                   | M6→M7   | Idempotente, sem segunda baixa                       |
| C-05                                    | Pagamentos concorrentes na mesma cobrança      | M8      | Soma não ultrapassa o saldo devido                   |
| C-06                                    | Comando duplicado pagamento/estorno            | M8      | Idempotência de comando                              |
| C-07                                    | Criação concorrente do "mesmo" paciente        | M4      | CPF informado sem duplicata; ambiguidade → humano    |
| C-08                                    | Uso de sessão vs. revogação                    | M1      | Sessão revogada não autoriza                         |
| C-09 (H2-10)                            | `AJUSTE_NEGATIVO` concorrente a reservas       | M7      | Nunca deixar `saldo_de_direito < reservas_ativas`    |

Nenhuma estratégia técnica específica é fixada nesta etapa.

---

## 14. Regras de ownership dos dados

| Dado Dono Quem lê (id) Quem NUNCA escreve                                          |        |                                    |                                                                        |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------- | ---------------------------------------------------------------------- |
| Usuário/sessão/papel/permissão                                                     | M1     | Todos (authz)                      | Todos exceto M1                                                        |
| Clínica/serviço/forma pagto/motivo/fuso                                            | M2     | M5, M7, M8, M9                     | Todos exceto M2                                                        |
| Profissional/disponibilidade/serviços                                              | M3     | M5, M9                             | Todos exceto M3                                                        |
| Paciente administrativo/observação adm.                                            | M4     | M5, M6, M7, M8, M9                 | Todos exceto M4                                                        |
| Agendamento/estado/bloqueio/histórico                                              | M5     | M6, M8(origem), M9                 | M6, M8                                                                 |
| **Atendimento**                                                                    | **M6** | M7 (id p/ consumo), M9 (metadados) | M5, M7, M8                                                             |
| Registro clínico/retificação/anexo/autoria                                         | M6     | M9 (só metadados)                  | Todos exceto M6                                                        |
| Pacote / **Reserva de Sessão** / **Movimento de Sessão** / saldo / disponibilidade | M7     | M5 (disponibilidade), M9           | **M5, M6, M8** (emitem fatos/gatilho; **M7** cria reservas/movimentos) |
| Cobrança/pagamento/estorno/recibo                                                  | M8     | M9                                 | **M7** (nunca; H2-08), M6                                              |
| Fórmulas/parâmetros de indicador                                                   | M9     | —                                  | —                                                                      |
| Evento de auditoria                                                                | M10    | M1                                 | Fluxo operacional (append-only)                                        |

**Notas:** `Reserva de Sessão` e `Movimento de Sessão` são criados **por M7**, disparados por fatos de M5 (reserva) e M6 (consumo), na mesma transação (H2-02/H2-04). `Atendimento` pertence a M6; `Agendamento` a M5 (ownership distinto — H2-01). Data de referência da receita prevista (RN-068/HOM-02) deriva de M5/M7/M8; representação persistida é pendência técnica (Etapa 2.2).

---

## 15. Matriz entidade / regra / requisito

| Entidade Regras principais Requisitos Fluxo(s)  |                                             |                     |                   |
| ----------------------------------------------- | ------------------------------------------- | ------------------- | ----------------- |
| Usuário / Sessão                                | RN-001/004/005                              | AUT-001/002/004/005 | FC-01             |
| Papel / Permissão                               | RN-002/003                                  | AUT-003             | FC-01; PERM-T\*   |
| Serviço                                         | RN-008, CFG-003; **H2-07 (Pacote→Serviço)** | CFG-003             | FC-03             |
| Paciente                                        | RN-009..012                                 | PAC-001..007        | FC-02             |
| Agendamento (M5)                                | RN-013..020; **Agendamento→0..1 Pacote**    | AGD-001..009        | FC-03/FC-04       |
| Atendimento (M6)                                | RN-021, RN-033/070, RN-019; **H2-01**       | AGD-007, PRN-003    | FC-04/FC-05/FC-07 |
| Registro clínico                                | RN-021..024                                 | PRN-001..004        | FC-05             |
| Retificação                                     | RN-025..028, D-01                           | PRN-005             | FC-06             |
| Pacote                                          | RN-030/031/040/071; **H2-07/09**            | PKG-001/002         | FC-07; 13.6       |
| Reserva de Sessão (H2-02)                       | RN-032, D-07                                | PKG-004             | FC-03; 13.1–13.3  |
| Movimento — CONSUMO                             | RN-033/034/035/070; **H2-05**               | PKG-005             | FC-07             |
| Movimento — AJUSTE\_POSITIVO/NEGATIVO           | RN-038/039; **H2-10**                       | PKG-007             | FC-07             |
| Cobrança                                        | RN-042/045/047/068; **H2-11/12**            | FIN-001/002/003     | FC-08             |
| Pagamento / Estorno                             | RN-044/045/046/048/049/069                  | FIN-004/006         | FC-08; 13.5       |
| Indicador                                       | RN-053..060, D-05                           | IND-001..009        | FC-09             |
| Evento de auditoria                             | RN-061..066                                 | AUD-001..006        | transversal       |

---

## 16. Decisões — status (H2-01 a H2-12 HOMOLOGADAS)

| ID Decisão Status Ref. interna  |                                                                                                             |                            |                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------ |
| H2-01                           | Agendamento e Atendimento distintos (`1 → 0..1`); máquina operacional só no Agendamento                     | **HOMOLOGADA**             | D2.1-01                  |
| H2-02                           | M7 dono; `Reserva de Sessão` ≠ `Movimento de Sessão`; Movimento = CONSUMO/AJUSTE\_POSITIVO/AJUSTE\_NEGATIVO | **HOMOLOGADA**             | D2.1-02 (refinado)       |
| H2-03                           | Decomposição clínica e aggregate root de Atendimento adiados (P-CLIN)                                       | **HOMOLOGADA** (adiamento) | D2.1-05/08               |
| H2-04                           | Operações críticas síncronas e transacionais (T-01/02/08/09)                                                | **HOMOLOGADA**             | D2.1-04                  |
| H2-05                           | Consumo único por `(atendimento, pacote)`; falha de consumo aborta finalização                              | **HOMOLOGADA**             | I-26, T-02               |
| H2-06                           | Pacote e Cobrança aggregate roots; Atendimento não                                                          | **HOMOLOGADA**             | D2.1-06/07               |
| H2-07                           | Pacote vinculado a **exatamente um Serviço** (MVP)                                                          | **HOMOLOGADA**             | P-04 resolvida           |
| H2-08                           | Financeiro nunca cria/remove/devolve/ajusta sessão                                                          | **HOMOLOGADA**             | D2.1-10, I-39            |
| H2-09                           | Precedência `CANCELADO > EXPIRADO > ESGOTADO > ATIVO`                                                       | **HOMOLOGADA**             | I-30b (GAP-DOM-01)       |
| H2-10                           | `AJUSTE_NEGATIVO` rejeitado se `saldo < reservas`                                                           | **HOMOLOGADA**             | I-24b, T-06 (GAP-DOM-01) |
| H2-11                           | `ESTORNADO` (não cancelada) recebe novo pagamento e re-deriva                                               | **HOMOLOGADA**             | GAP-DOM-02               |
| H2-12                           | `ESTORNADO` pode ser cancelada (autorizada/auditada, histórico preservado) → `CANCELADO`                    | **HOMOLOGADA**             | GAP-DOM-02               |

Complementares vigentes e coerentes: D2.1-03 (M9 leitura), D2.1-11 (consentimentos como evidência operacional, validação jurídica pendente).

---

## 17. Hipóteses (a confirmar em etapas posteriores)

- **H-01** — existe registro clínico correspondente ao `Atendimento` cuja primeira finalização válida dispara o consumo; **multiplicidade Atendimento↔Registro adiada (P-CLIN)**; unicidade `(atendimento, pacote)` mantém consumo único.
- **H-02** — relação fisioterapeuta–paciente (escopo RELACIONADO) derivável do vínculo agenda/atendimento; definição técnica pendente (docs/04 §7.1, §11.3).
- **H-05** — recibo derivado de pagamentos, sem entidade persistida obrigatória (FIN-007) — a decidir.
- **H-06** — indicadores sem materialização no MVP (cálculo sob demanda) — revisável por desempenho.

*(A antiga hipótese de "reserva como projeção" foi resolvida por H2-02:* *`Reserva de Sessão`* *é conceito próprio de M7, com representação física adiada.)*

---

## 18. Pendências

### 18.1 Mantidas (genuinamente em aberto)

- **P-CLIN** — decomposição clínica (avaliação/plano/evolução como entidades × componentes), **multiplicidade** Atendimento↔Registro e **aggregate root de Atendimento**. Restrição preservada: deve ser inequívoco qual primeira finalização válida aciona o consumo.
- **Desenho físico das** **`Reserva de Sessão`** (representação persistida) — Etapa 2.2.
- **Mecanismos técnicos de concorrência/isolamento/unicidade/lock** (P-03) — Etapa 2.2.
- **Representação física da data de referência financeira** (mantendo RN-068/HOM-02).
- **Contratos de API**; **formulários clínicos** (campos obrigatórios); **retenção/consentimentos** (validação jurídica); versões/infra.
- **Colocação do documento** no repositório (branch/base de destino).

### 18.2 Resolvidas / removidas

- **GAP-DOM-01 → RESOLVIDO por H2-09/H2-10** (precedência de estado + bloqueio de ajuste negativo).
- **GAP-DOM-02 → RESOLVIDO por H2-11/H2-12** (novo pagamento e cancelamento após estorno).
- **P-04 (escopo do Pacote) → RESOLVIDO por H2-07** (serviço específico).
- **Dúvida "Pacote possui Serviço?" → RESOLVIDA por H2-07.**
- **Dúvida "Reserva é Movimento?" → RESOLVIDA por H2-02** (conceitos distintos).

### 18.3 Conflitos/divergências

- **CONF-01** — decomposição clínica: mantida sob **P-CLIN** por decisão de adiamento (H2-03); coerente com TLF-BASE-V1 §8 ("não obriga uma tabela por item"). **Não convertida em decisão nesta revisão.**
- **CONF-02** — RESOLVIDO (Atendimento é entidade clínica distinta — H2-01).

---

## 19. Riscos

**Críticos**

- **R-01 — Race de agenda.** Mitigação: I-12, C-01, T-01; mecanismo na Etapa 2.2.
- **R-06 — Consumo duplicado.** Mitigação: I-26/I-27, T-02 (mesma transação, rollback conjunto), unicidade `(atendimento, pacote)`, resolução da reserva; mecanismo na Etapa 2.2.
- **R-07 — Vazamento clínico.** Mitigação: I-07..I-10; M7 recebe só ids; M9 só metadados.

**Médios**

- **R-02 — Acoplamento circular M5↔M7.** Mitigação: porta + coordenação síncrona (H2-04).
- **R-04 — Ownership ambíguo de sessões.** Mitigação: H2-02 (M7 único dono de Pacote/Reserva/Movimento).
- **R-05 — Efeito financeiro em sessões.** Mitigação: I-39, H2-08.
- **R-09 — Permissão ampla demais.** Mitigação: I-04, docs/04 §6.2.
- **R-10 — Estado derivado duplicado.** Mitigação: I-22/I-36; derivação única; precedência H2-09.
- **R-13 — Ambiguidade do gatilho se a multiplicidade clínica for definida sem cuidado.** Mitigação: restrição em P-CLIN + unicidade `(atendimento, pacote)`.
- **R-15 — Reserva órfã por ajuste negativo.** Mitigação: H2-10 / I-24b / C-09.

**Baixos**

- R-03 edição destrutiva (append-only I-16..I-19/I-22/I-46); R-08 duplicidade de paciente (C-07); R-11 indicadores divergentes (D2.1-03); R-12 data de referência (RN-068/HOM-02).

---

## 20. Questões remanescentes (etapas posteriores — não decidir sem ordem)

1. **P-CLIN** — decomposição clínica, multiplicidade Atendimento↔Registro e aggregate root do Atendimento.
2. **P-03 / desenho físico** — porta M5↔M7, mecanismo de transação/concorrência/unicidade, representação física de reservas e da data de referência financeira (Etapa 2.2).
3. **Colocação do documento** — branch/base de destino para versionar `docs/06-modelo-dominio.md` (a pasta `docs/` só existe hoje em `agent/fase1-documentacao-homologada`). Nenhum commit/push sem autorização.

---

## 21. Rastreabilidade de validação final (REV. 3)

Cruzado contra TLF-BASE-V1 (§4–§16), D-01..D-07, HOM-01..HOM-05, RN-001..RN-071, FC-01..FC-09 e H2-01..H2-12.

| # Verificação Resultado  |                                                                   |                                                        |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------ |
| 1                        | Agendamento ≠ Atendimento                                         | OK — H2-01 (4.1, 6.5, 6.6)                             |
| 2                        | Atendimento pertence a M6                                         | OK — 6.6, 14                                           |
| 3                        | Sem cardinalidade congelada Atendimento↔Registro                  | OK — "NÃO DEFINIDA — P-CLIN" (9)                       |
| 4                        | Atendimento NÃO homologado como aggregate root                    | OK — 8.3, 8.4, H2-03/H2-06                             |
| 5                        | Reserva de Sessão ≠ Movimento de Sessão                           | OK — 6.7, 7.7, H2-02                                   |
| 6                        | M7 é dono dos dois                                                | OK — 6.7, 14                                           |
| 7                        | Pacote referencia exatamente um Serviço                           | OK — 6.7, 9, H2-07                                     |
| 8                        | Um Pacote pode ter múltiplos Agendamentos                         | OK — cardinalidade corrigida (9)                       |
| 9                        | Sem `1:1` inventado em Cobrança↔origem                            | OK — origem única funcional; inversa adiada (9)        |
| 10                       | Consumo único por `(atendimento, pacote)`                         | OK — I-26, T-02, H2-05                                 |
| 11                       | Finalização e consumo atômicos                                    | OK — I-33, T-02, H2-04                                 |
| 12                       | Ajuste negativo nunca deixa saldo < reservas                      | OK — I-24b, T-06, C-09, H2-10                          |
| 13                       | Estado de pacote por precedência homologada                       | OK — I-30b, 11.5, H2-09                                |
| 14                       | `ESTORNADO → novo pagamento` documentado                          | OK — 11.4, T-03, H2-11                                 |
| 15                       | `ESTORNADO → CANCELADO` autorizado documentado                    | OK — 11.4, T-05, H2-12                                 |
| 16                       | Financeiro nunca altera sessões                                   | OK — I-39, H2-08                                       |
| 17                       | Nenhum estado novo criado                                         | OK — 11.4/11.5 preservam estados da Fase 1             |
| 18                       | Nenhuma decisão física da Etapa 2.2 antecipada                    | OK — mecanismos/representações marcados como pendência |
| 19                       | Base Imutável intacta                                             | OK — não modificada                                    |
| 20                       | Sem contradição entre texto, tabelas, diagramas e rastreabilidade | OK — revisado nesta consolidação                       |

**Cobertura de decisões/homologações:** D-01 (I-20); D-02 (I-31/32, T-02); D-03 (I-39, H2-08); D-04 (T-07); D-05 (M9); D-06 (I-11); D-07 (I-24/25, C-02). HOM-01 (R-09); HOM-02 (RN-068); HOM-03 (I-38); HOM-04 (I-31); HOM-05 (I-29, 11.5). H2-01..H2-12: seção 16.

---

**Fim do documento —** **`docs/06-modelo-dominio.md`** **— HOMOLOGADO — REV. 3 — ETAPA 2.1 CONCLUÍDA.**