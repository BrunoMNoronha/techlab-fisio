# Pacote de Decisão Mínimo de Pacientes (cadastro administrativo e situação) — `PAC-PREP1`

> **Documento:** `docs/17-pacote-decisao-pacientes.md`
> **Projeto:** TechLab Fisio
> **Frente:** Pacientes (módulo M4) — fatia mínima **PAC-A**: cadastro administrativo, localização, prevenção de duplicidade e situação ativo/inativo
> **Status:** **HOMOLOGADO — `D-PAC-01`..`D-PAC-10` APROVADAS INTEGRALMENTE CONFORME AS RECOMENDAÇÕES POR BRUNO MENEZES NORONHA EM 17/09/2026** (TLF-BASE-V1 §15, item 1), inclusive as escolhas `P-PAC-01`..`P-PAC-09`, a **ampliação do catálogo de auditoria** de `D-PAC-07` (`paciente.cadastro.alterado` e `paciente.situacao.alterada`, `contexto` vazio) e a **alteração estrutural de banco** de `D-PAC-09` (CHECK de situação e índice por `data_nascimento`). As marcas **[DERIVADA]**/**[ESCOLHA]** permanecem como registro de origem. A homologação autorizou a materialização documental; a **implementação da fatia PAC-A** — runtime, migration de `D-PAC-09` e ampliação de `audit.catalog.ts` de `D-PAC-07` — foi **autorizada por Bruno Menezes Noronha em 17/09/2026** e está registrada em `docs/10` §6-AC (§5.2 e REV. 4 deste documento). PAC-B, PAC-C e PAC-D seguem sem autorização de implementação.
> **Data:** 17 de setembro de 2026
> **Base medida:** workspace local sobre `bd772a3`, com `docs/14` (REV. 23), `docs/15` (REV. 3) e `docs/16` (REV. 2) locais.
> **Natureza:** registro normativo das decisões da fatia PAC-A, originado do pacote de análise `PAC-PREP1`. Este documento, por si, não altera código, schema, migration ou teste; a autorização de implementação da fatia PAC-A consta do Status acima.
> **Por que um documento próprio:** este pacote é pré-requisito de AGD-A (`docs/15` `D-AGD-01`, §5.2). Pacientes formam o módulo M4, distinto de M2, M3 e M5.

---

## 1. Fontes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` §4 (privilégio mínimo, rastreabilidade), §5.4, §6, §10 (sem informação sensível em erros, URLs e logs), §11 (paginação, filtros e índices), §13 — **não alterada**.
- `docs/02` PAC-001..PAC-007; `docs/03` RN-007, RN-009..RN-013, RN-062, RN-063.
- `docs/04` §2 (escopos), §4 (linhas de pacientes), §5.3, §7.1, §10.
- `docs/06` §6 M4; `docs/07` §7.4, §10.1 (U-07), §10.2, §11.4 (H2.2-13), §23.
- `docs/09` §5 (proposta `paciente.cadastro.alterado`), `D-AUD-04`, §13.5 (`PBACK-AUD-04` — política L-08 **fechada**, materialização pendente).
- `docs/10` §7.3 (política runtime de `contexto` só com escalares).
- `docs/14` `D-CFG-04`, `D-CFG-04-A`, `D-CFG-22`..`D-CFG-27`; `docs/15` `D-AGD-04`, `D-AGD-12`.

## 2. Fatos de partida

| # | Fato | Evidência |
| --- | --- | --- |
| FPA-01 | A tabela `paciente` existe com `id`, `nome text` NN, `data_nascimento date` anulável, `cpf text` anulável e **único** (`paciente_cpf_key`), `telefone`, `email`, `ativo boolean` NN (sem default), `inativado_em`, `criado_em`. **Não** há `atualizado_em`, autor da criação, CHECK de coerência `ativo`/`inativado_em` nem índice por nome | migrations `20260820121255`, `20260820121900`; `schema.prisma` |
| FPA-02 | `ck_paciente_cpf_formato` exige `cpf IS NULL OR cpf ~ '^[0-9]{11}$'`. O CPF é persistido **normalizado**, e o dígito verificador é regra de aplicação | migration `20260822144354`; `docs/07` §11.4.1 |
| FPA-03 | **H2.2-13 (homologada):** o CPF de paciente inativo **não é liberado**. Diante de duplicata, o fluxo é **localizar e reativar**, nunca criar nova identidade, e a aplicação deve converter a rejeição em fluxo de localização | `docs/07` §11.4.2 |
| FPA-04 | RN-011/RN-012 e PAC-003: pesquisar e sinalizar candidatos, **sem merge** e sem decisão automática de identidade; "continuidade justificada" é permitida | `docs/02`, `docs/03` |
| FPA-05 | Tabelas `contato_emergencia`, `responsavel_legal`, `consentimento` e `observacao_administrativa` existem (PAC-004, PAC-005, PAC-007) | `schema.prisma` |
| FPA-06 | Permissões no seed: `pacientes.administrativo.gerenciar` → Administrador e Recepcionista; `pacientes.localizar` → Administrador, Recepcionista, Gestor (célula **C**) e Fisioterapeuta (**C relacionado**). O Fisioterapeuta **não** recebe `gerenciar` | `catalogo-rbac.ts`; `docs/04` §4 |
| FPA-07 | A política L-08 está **fechada**: são sensíveis **CPF, responsável legal, consentimentos e situação**; **não** são sensíveis nome, data de nascimento, telefone, e-mail, contato de emergência e observação. O nome das ações, o `alvo_tipo` e as chaves ficam **para a fatia de pacientes** | `docs/09` §13.5 |
| FPA-08 | Conflito já registrado: `campos_alterados` (lista) colide com a política runtime de `contexto`, que aceita só escalares | `docs/09` §13.5; `docs/10` §7.3 |
| FPA-09 | O catálogo **não** tem `paciente.cadastro.alterado` nem `paciente.situacao.alterada` | `audit.catalog.ts` |
| FPA-10 | A Base §10 e a RN-063 proíbem informação sensível em **URLs**, erros, logs e telemetria | Base; `docs/03` |
| FPA-11 | O banco **não** tem `unaccent` nem `pg_trgm`; a busca por nome só dispõe de `lower`/`ILIKE` sensíveis a acento | migrations (ausência) |
| FPA-12 | "Relacionado" (fisioterapeuta ↔ paciente) não está definido (P2.2-05). `docs/15` `D-AGD-12` adotou escopo por código de papel e `profissional.usuario_id` para a agenda | `docs/04` §7.1; `docs/15` |
| FPA-13 | Não existe runtime de pacientes | `apps/api/src` |

## 3. Escopo da fatia PAC-A

| Incluído | Excluído (fatias futuras do MVP) |
| --- | --- |
| PAC-001 (criação e edição dos dados administrativos da tabela `paciente`) | PAC-004 — contato de emergência e responsável legal (**PAC-B**) |
| PAC-002 (localização) | PAC-005 — consentimentos; conteúdo jurídico pendente (**PAC-C**) |
| PAC-003 (prevenção de duplicidade) | PAC-007 — observações administrativas (**PAC-D**) |
| PAC-006 (ativar e inativar) | Qualquer superfície clínica (L-06 bloqueada) |

O escopo de PAC-A é o mínimo que AGD-A exige (`D-AGD-04`: paciente existente e ativo) mais o que a Base e a H2.2-13 tornam inseparável da criação (localizar e prevenir duplicidade).

## 4. Decisões homologadas

### 4.1 `D-PAC-01` — Dados e validação **[ESCOLHA]** sobre fontes **[DERIVADAS]**

| Campo | Regra |
| --- | --- |
| `nome` | string; `trim`; espaços internos repetidos reduzidos a um; **1–200** code points; sem caracteres de controle; **obrigatório** |
| `dataNascimento` | data civil `YYYY-MM-DD` válida no calendário gregoriano; **não futura** (data local da clínica) e **>= 1900-01-01**; **[ESCOLHA] obrigatória na API** |
| `cpf` | opcional (RN-010). Aceita string de 11 dígitos, com ou sem a máscara `000.000.000-00`. É persistido **só com dígitos** (H2.2-13), com **dígito verificador válido**; sequências de 11 dígitos repetidos são rejeitadas; vazio ou `null` vira `null` |
| `telefone` | opcional; `trim`; máximo 32; texto livre (precedente `D-CFG-04`); vazio vira `null` |
| `email` | opcional; `trim`; máximo 254; predicado exato de `D-CFG-04-A`; vazio vira `null` |

- Corpo estrito, sem coerção de tipos; violação → `400 REQUISICAO_INVALIDA`. A resposta **não** detalha o campo nem ecoa o valor (Base §10).
- **[ESCOLHA] `dataNascimento` obrigatória:** a coluna é anulável, mas a data é o segundo atributo da detecção de duplicidade (`D-PAC-03`) e condiciona o responsável legal (PAC-004). Assim a API exige o que o schema permite omitir.
  - *Alternativa:* opcional, com detecção por nome e data só quando ambos existem. Aumenta o risco de duplicidade não sinalizada.
- **Sem campo clínico** e sem observação livre nesta fatia (RN-009, PAC-007).

### 4.2 `D-PAC-02` — Contrato HTTP **[ESCOLHA]**

| Rota | Sucesso | Erros específicos |
| --- | --- | --- |
| `POST /pacientes/busca` | `200` lista | `400` |
| `GET /pacientes/:pacienteId` | `200` | `400` id malformado; `404 PACIENTE_NAO_ENCONTRADO` |
| `POST /pacientes` | `201` | `400`; `409 CPF_JA_CADASTRADO`; `409 POSSIVEL_DUPLICIDADE` |
| `PUT /pacientes/:pacienteId` | `200` | `400`; `404 PACIENTE_NAO_ENCONTRADO`; `409 CPF_JA_CADASTRADO` |
| `PATCH /pacientes/:pacienteId/situacao` | `200` | `400`; `404 PACIENTE_NAO_ENCONTRADO` |

- **Busca por `POST` com corpo**, nunca por query string. Nome, CPF e data de nascimento são dados pessoais e não podem ir para URL, logs de acesso ou histórico do navegador (Base §10, RN-063). É leitura sem efeito colateral: sem auditoria e com `Cache-Control: no-store`, mas sujeita ao `ProtecaoCsrfGuard` por ser `POST`.
- Corpo de `POST /pacientes`: exatamente `{ nome, dataNascimento, cpf, telefone, email, confirmarPossivelDuplicidade }`. O último campo é booleano obrigatório (`D-PAC-03`).
- Corpo de `PUT`: exatamente `{ nome, dataNascimento, cpf, telefone, email }`, com substituição total. O `PUT` é permitido sobre paciente inativo e **não** altera a situação.
- Corpo de `PATCH .../situacao`: exatamente `{ ativo: boolean }`.
- Resposta (detalhe, criação, edição e situação): exatamente `{ id, nome, dataNascimento, cpf, telefone, email, ativo, inativadoEm }`. `cpf` só com dígitos ou `null`; a máscara é da interface. No `PUT` e no `PATCH`, a resposta traz o estado vigente, inclusive em no-op.
- **Sem `DELETE`** (RN-007, `docs/07` §23).
- Erros no envelope `{ erro }`, **sem dados adicionais**. `401`, `403` e `500 FALHA_INTERNA` seguem os contratos gerais.
- Códigos novos: `PACIENTE_NAO_ENCONTRADO`, `CPF_JA_CADASTRADO` e `POSSIVEL_DUPLICIDADE`.

### 4.3 `D-PAC-03` — Duplicidade **[DERIVADA]** (CPF) e **[ESCOLHA]** (coincidência forte)

- **CPF (H2.2-13):**
  - CPF já presente em paciente **ativo ou inativo** → `409 CPF_JA_CADASTRADO`, tanto na criação quanto na edição.
  - A rejeição concorrente pelo índice (`23505` em `paciente_cpf_key`) tem o mesmo desfecho; `23505` em qualquer outra restrição não é traduzido.
  - A resposta **não** informa id nem dados do paciente existente.
  - A interface converte o erro em **fluxo de localização**: busca pelo mesmo CPF (`D-PAC-04`), que devolve o cadastro, inclusive inativo, para abertura ou reativação.
- **Coincidência forte [ESCOLHA]:**
  - Existe candidato quando **nome normalizado** e **data de nascimento** são iguais aos de paciente ativo ou inativo. Normalização do nome: `trim`, espaços colapsados, minúsculas e remoção de diacríticos, feita na aplicação.
  - Na criação com `confirmarPossivelDuplicidade = false` e ao menos um candidato → `409 POSSIVEL_DUPLICIDADE`, sem mutação e sem dados do candidato. A interface busca por nome e data (`D-PAC-04`) e mostra os candidatos, e o usuário **seleciona o existente** ou **reenvia** com `confirmarPossivelDuplicidade = true`.
  - Com `true`, a criação prossegue mesmo com candidatos (homônimos legítimos — RN-012).
  - Coincidência só de nome **não** bloqueia; a interface pode sinalizá-la a partir da busca.
  - **Sem merge** e sem vínculo automático, em qualquer caso.
  - A comparação da coincidência forte é feita em aplicação sobre os pacientes com a **mesma `data_nascimento`** (seleção indexável; ver `D-PAC-09`).
- **Limitação [ESCOLHA]:** a "continuidade justificada" de PAC-003 é registrada **apenas** pela confirmação explícita. **Não** se persiste texto de justificativa: não há coluna e o dado não é sensível pela política L-08.
  - *Alternativa:* justificativa obrigatória em nova coluna ou evento, com migration e ampliação de catálogo.
- A edição (`PUT`) **não** verifica coincidência forte, apenas CPF.

### 4.4 `D-PAC-04` — Localização **[ESCOLHA]**

- Corpo exato de `POST /pacientes/busca`: `{ nome, cpf, dataNascimento, ativo }`. Todos os campos aceitam `null`, e **pelo menos um entre `nome`, `cpf` e `dataNascimento`** deve estar preenchido.
- Filtros:
  - `cpf`: normalizado com a regra de `D-PAC-01`, igualdade exata.
  - `dataNascimento`: igualdade.
  - `nome`: **mínimo de 3 caracteres** após normalização; casa com `lower(nome)` **contendo** o termo em minúsculas.
  - `ativo`: `true`, `false` ou `null` (todos).
  - Os filtros informados combinam por **E**.
- **Limitação declarada:** a busca por nome é **sensível a acentos** (FPA-11). Não se introduz extensão agora.
  - *Alternativa futura:* coluna normalizada ou `unaccent`, com migration.
- Resultado: **no máximo 20** pacientes, ordem `lower(nome)`, `data_nascimento`, `id`, com o campo `truncado: boolean` indicando que havia mais. **Sem paginação**: é localização, não listagem (Base §11 atendida pelo limite e pelos filtros obrigatórios).
- Forma: `{ pacientes: [{ id, nome, dataNascimento, cpf, ativo }], truncado }`. Telefone e e-mail **não** aparecem na busca (minimização) e só vêm no detalhe.

### 4.5 `D-PAC-05` — Situação **[DERIVADA]**

- Inativação: `ativo = false`, `inativado_em = now()`. Reativação: `ativo = true`, `inativado_em = NULL`. Pedido igual ao vigente → `200` sem mutação e sem auditoria.
- Inativar **não** cancela nem altera agendamentos, pacotes, cobranças ou prontuário (PAC-006, RN-007). Paciente inativo não participa de **novo** agendamento (`D-AGD-04` → `422 PACIENTE_INELEGIVEL`). Agendamentos existentes seguem, na mesma estratégia flexível de `D-CFG-63`.
- **[ESCOLHA]** A inativação é permitida **mesmo com agendamentos futuros ativos**, sem aviso no MVP.
  - *Alternativa:* bloquear com `409` enquanto houver compromissos futuros. É mais protetora, mas acopla M4 a M5.
- Criação sempre com `ativo = true`.

### 4.6 `D-PAC-06` — Autorização e escopo **[DERIVADA]** com escopo **[ESCOLHA]**

| Operação | Permissão | Escopo |
| --- | --- | --- |
| Criar, editar, alterar situação | `pacientes.administrativo.gerenciar` | operacional (Administrador, Recepcionista) |
| Buscar, detalhar | `pacientes.localizar` | ver abaixo |

- **Escopo da localização [ESCOLHA]**, pelo mesmo mecanismo de `D-AGD-12` (código de papel, *fail-closed*):
  - **Administrador e Recepcionista:** operacional, todos os pacientes.
  - **Fisioterapeuta** (permissão vinda só desse papel): **relacionado** = pacientes com **algum agendamento** cujo `profissional.usuario_id` é o ator, em qualquer estado. Até a agenda existir, o conjunto é vazio.
  - **Gestor** (célula **C**, "apenas quando houver finalidade e permissão"): **sem acesso** no MVP inicial → `403 ACESSO_NEGADO` em busca e detalhe. A finalidade não está definida.
- Fora do escopo: detalhe → `404 PACIENTE_NAO_ENCONTRADO` (sem oráculo); a busca simplesmente não inclui o paciente.
- A criação para outro papel **não** existe: o Fisioterapeuta não cria paciente, conforme o seed (FPA-06), apesar da célula **C** de `docs/04`.
- `403` por falta de permissão **não** gera evento (L-07). **Nenhuma permissão nova.**
- **Limitação:** "relacionado por agendamento" é critério **administrativo** para localização e **não** define acesso clínico (L-06/P2.2-05 permanecem abertas).

### 4.7 `D-PAC-07` — Auditoria (materializa `docs/09` §13.5) **[ESCOLHA — ampliação de catálogo]**

- **Novas ações homologáveis** (a política já está fechada em L-08; falta o catálogo):
  - `paciente.cadastro.alterado` — emitida quando o **CPF** passa a ter valor na **criação** ou é **incluído, alterado ou removido** na edição.
  - `paciente.situacao.alterada` — inativação e reativação efetivas.
- Ambas com `alvo_tipo = "paciente"`, `alvo_id = paciente.id`, ator da sessão, `SUCESSO`, `justificativa = null` e **`contexto` vazio**, na mesma transação da mutação (falha → rollback conjunto). Uma edição que altere CPF emite **um** evento.
- **`campos_alterados` não é criada:** com a whitelist vazia, o conflito com a política de escalares (FPA-08) é evitado, e a ação só é emitida por mudança de CPF, o que dispensa a lista.
- **Não** geram evento: criação sem CPF; edição que não altere CPF; no-op; busca; detalhe; validação rejeitada; `409`; `403`. Os demais dados não são sensíveis para o gatilho (FPA-07) e continuam protegidos por controle de acesso.
- Responsável legal e consentimentos (também sensíveis) serão auditados em **PAC-B** e **PAC-C**.
- **Nenhum valor pessoal** (nome, CPF, contatos) em evento, log ou mensagem de erro (RN-062, RN-063).
- *Alternativa:* auditar toda criação e edição com ação própria. Contradiz a política L-08 homologada.

### 4.8 `D-PAC-08` — Concorrência **[DERIVADA]**

- `PUT` e `PATCH`: `SELECT ... FOR UPDATE` na linha de `paciente`; a comparação de no-op e a detecção de mudança de CPF ocorrem **sob o lock**. A última escrita válida prevalece; sem coluna de versão nem `If-Match`.
- Criação concorrente com o mesmo CPF: o índice único decide (`409`).
- Criação concorrente de coincidência forte sem CPF: **não** é serializada. Dois cadastros podem passar juntos, risco residual aceito, coerente com RN-012 (a duplicidade não-CPF não é invariante física).

### 4.9 `D-PAC-09` — Invariantes físicas e índices **[ESCOLHA — estrutural]**

- **Migration futura autorizável, com aprovação expressa:**
  - `CHECK (ativo = (inativado_em IS NULL))` em `paciente` (precedente de `D-CFG-23`, `D-CFG-35`, `D-CFG-47`);
  - índice `(data_nascimento)` para a detecção de coincidência forte e a busca por data;
  - índice `(lower(nome) text_pattern_ops)` **não** é criado. A busca por "contém" não o aproveita, e o volume de clínica pequena ou média não o justifica agora; reavaliar com medição.
- **Não** se torna `data_nascimento NOT NULL` no banco. A exigência fica na API (`D-PAC-01`), o que preserva a possibilidade de flexibilizar sem migration.
- Nomes físicos, golden SQL, inventário protegido e alinhamento de `docs/07` ficam para a implementação; `docs/07` só é atualizado após a migration integrada.

### 4.10 `D-PAC-10` — Contrato para a agenda **[DERIVADA]**

- `paciente.id` é a identidade estável referenciada por `agendamento`.
- Elegibilidade para novo agendamento: `ativo = true` (RN-013), verificada em T-01 **sem lock** do paciente. Uma inativação concorrente é tolerada (mesmo racional de `D-CFG-63`).
- A resposta da agenda usa só `{ id, nome }` do paciente (`D-AGD-05`).

## 5. Registro de homologação e pendências

### 5.1 Escolhas homologadas (17/09/2026)

| ID | Decisão | Recomendação | Estado |
| --- | --- | --- | --- |
| P-PAC-01 | Escopo PAC-A e fatias PAC-B..D (§3) | adotar | **HOMOLOGADA** |
| P-PAC-02 | `dataNascimento` obrigatória na API (`D-PAC-01`) | obrigatória | **HOMOLOGADA** |
| P-PAC-03 | Contrato, com busca por `POST` (`D-PAC-02`) | adotar | **HOMOLOGADA** |
| P-PAC-04 | Coincidência forte nome + data com confirmação explícita, sem justificativa persistida (`D-PAC-03`) | adotar | **HOMOLOGADA** |
| P-PAC-05 | Busca: mínimo de 3 caracteres, limite 20, sensível a acento (`D-PAC-04`) | adotar | **HOMOLOGADA** |
| P-PAC-06 | Inativação permitida com agendamentos futuros (`D-PAC-05`) | permitir | **HOMOLOGADA** |
| P-PAC-07 | Escopo: Fisioterapeuta relacionado por agendamento; Gestor sem acesso (`D-PAC-06`) | adotar | **HOMOLOGADA** |
| P-PAC-08 | **Ampliação do catálogo** com `paciente.cadastro.alterado` e `paciente.situacao.alterada`, `contexto` vazio (`D-PAC-07`) | aprovar | **HOMOLOGADA** |
| P-PAC-09 | **Migration** de CHECK de situação e índice por data de nascimento (`D-PAC-09`) | aprovar | **HOMOLOGADA** |

- **[DERIVADAS] homologadas em bloco** na mesma data: `D-PAC-05` (exceto o ponto [ESCOLHA], homologado em `P-PAC-06`), `D-PAC-08`, `D-PAC-10`, a parte de CPF de `D-PAC-03` e as permissões de `D-PAC-06`.

### 5.2 Pendências abertas após a homologação

| Item | Estado |
| --- | --- |
| Implementação de PAC-A (rotas, validação, duplicidade, busca, situação, escopo, auditoria) | **IMPLEMENTADA E MEDIDA** (autorizada por Bruno em 17/09/2026; `docs/10` §6-AC) — **INTEGRADA NA BRANCH LOCAL `integration/local-fase4` — NÃO PUBLICADA NA `main`** (`docs/10` §6-AE) |
| Migration de `D-PAC-09` | **IMPLEMENTADA** (`20260917180000_paciente_situacao_invariantes`; golden regerado) — **INTEGRADA NA BRANCH LOCAL `integration/local-fase4` — NÃO PUBLICADA NA `main`**; `docs/07` alinhado só após integração na `main` |
| Registro da ampliação do catálogo em `docs/09` e em `apps/api/src/audit/audit.catalog.ts` (`D-PAC-07`) | **MATERIALIZADO** — `docs/09` §15; catálogo com 27 ações — **INTEGRADA NA BRANCH LOCAL `integration/local-fase4` — NÃO PUBLICADA NA `main`** |
| PAC-B (contato de emergência, responsável legal — auditoria do responsável), PAC-C (consentimentos), PAC-D (observações administrativas) | **A INICIAR** — pacotes próprios |
| Busca insensível a acentos | **MELHORIA FUTURA** (`D-PAC-04`) |
| Finalidade de acesso do Gestor a pacientes | **FORA DESTE PACOTE** (`D-PAC-06`) |
| Acesso clínico (L-06, P2.2-05) | **NÃO AFETADO** — permanece aberto |

## 6. Matriz de testes de aceite (PAC-A)

| ID | Cenário | Esperado |
| --- | --- | --- |
| TP-01 | Criação válida sem CPF pela Recepção | `201`; `ativo = true`; **nenhum** evento |
| TP-02 | Criação com CPF mascarado válido | `201`; CPF persistido com 11 dígitos; **um** `paciente.cadastro.alterado` sem valores |
| TP-03 | CPF com DV inválido, repetido (`111.111.111-11`), 10 dígitos; data futura; data < 1900; nome vazio; chave extra; tipo coerido | `400`; nada persistido; valor não ecoado |
| TP-04 | CPF de paciente **inativo** existente | `409 CPF_JA_CADASTRADO`; a busca pelo CPF devolve o inativo |
| TP-05 | Duas criações concorrentes com o mesmo CPF | exatamente um `201` e um `409` |
| TP-06 | Mesmo nome (acentos e caixa diferentes) e mesma data, sem confirmação | `409 POSSIVEL_DUPLICIDADE`; com `confirmarPossivelDuplicidade = true` → `201` |
| TP-07 | Mesmo nome, data diferente | `201` sem `409` |
| TP-08 | Edição trocando telefone; trocando CPF; removendo CPF; idêntica | `200` sem evento; `200` + 1 evento; `200` + 1 evento; `200` no-op |
| TP-09 | Inativar, reinativar, repetir | `200` + evento; `200` + evento; `200` no-op sem evento |
| TP-10 | Busca por nome com 2 caracteres; sem filtro | `400`; `400` |
| TP-11 | Busca que casa com mais de 20 | 20 resultados; `truncado = true` |
| TP-12 | Busca e detalhe sem `pacientes.localizar`; Gestor; Fisioterapeuta sem agendamentos | `403`; `403`; lista vazia e detalhe `404` |
| TP-13 | Criação/edição sem `pacientes.administrativo.gerenciar` (Fisioterapeuta); sem sessão; sem CSRF | `403` sem evento; `401`; `403 REQUISICAO_NAO_AUTORIZADA` |
| TP-14 | Nenhum CPF, nome ou contato em logs, URLs ou corpos de erro | verificação por inspeção dos logs do teste de integração |
| TP-15 | Migration (`D-PAC-09`): `ativo = false` com `inativado_em NULL` | rejeitado pelo banco |

## 7. Histórico de revisões

| REV. | Data | Descrição |
| --- | --- | --- |
| **4** | 17/09/2026 | Alinhamento editorial `D-INTEG-02` (Bruno Menezes Noronha), na integração local das quatro frentes: Status e Natureza deixam de afirmar que a implementação da fatia PAC-A não está autorizada (a autorização de 17/09/2026 já constava de §5.2 e de `docs/10`); estados de §5.2 passam a refletir a consolidação na branch local `integration/local-fase4`. Nenhuma decisão `D-PAC-*` criada, alterada ou reaberta; PAC-B/C/D inalterados. |
| **3** | 17/09/2026 | Atualização factual de §5.2: PAC-A implementada e medida localmente, sem commit (`docs/10` §6-AC); `docs/09` §15 registra o catálogo. Nenhuma decisão alterada. |
| **2** | 17/09/2026 | **Homologação** por Bruno Menezes Noronha: `D-PAC-01`..`D-PAC-10` aprovadas integralmente conforme as recomendações, inclusive `P-PAC-01`..`P-PAC-09`, a ampliação do catálogo de auditoria (`D-PAC-07`) e a migration futura (`D-PAC-09`). Status, §4 e §5 atualizados (§5.1 registro; §5.2 pendências). Nenhum conteúdo decisório alterado; nenhum código alterado; implementação não autorizada. |
| **1** | 17/09/2026 | Pacote inicial `PAC-PREP1`: fatos, escopo PAC-A, `D-PAC-01`..`D-PAC-10` propostas (derivadas × escolhas), pendências `P-PAC-01`..`P-PAC-09` e matriz de aceite. Nada homologado; nenhum código alterado. |

---

**Fim — `docs/17-pacote-decisao-pacientes.md`.**
