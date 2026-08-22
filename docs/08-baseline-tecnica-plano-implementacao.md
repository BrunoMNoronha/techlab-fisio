# Baseline Técnica e Plano de Implementação Física — TechLab Fisio

> **Documento:** `docs/08-baseline-tecnica-plano-implementacao.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Modelagem — **Transição Etapa 2.2 → implementação física**
> **Status:** **HOMOLOGADO (ato de homologação: REV. 2) — BASELINE TÉCNICA E PLANO DE IMPLEMENTAÇÃO FÍSICA APROVADOS — REVISÃO VIGENTE: REV. 6**
> **Nota sobre a numeração:** a **REV. 2** é a revisão homologada por Bruno em 20/08/2026 (§0). As **REV. 3**, **REV. 4**, **REV. 5** e **REV. 6** são correções posteriores de **sequenciamento e de registro de execução**, expressamente autorizadas, que **não alteram baseline, arquitetura, requisito ou decisão homologada**.
> **Homologação:** baseline técnica (§6), as seis decisões da Categoria C (§7), a política de migrations e de introspection (§10, §10.2), o plano `E-01`..`E-18` (§13) e a decisão **`D-ESM-01`** (§16) aprovados por **Bruno Menezes Noronha** em **20 de agosto de 2026**
> **Natureza:** documento **MUTÁVEL**. Registra versões, verificações técnicas e plano de execução. Não altera regra de negócio, não altera `docs/07` e não altera a Base Imutável.
> **Data:** 20 de agosto de 2026
> **Autor da análise:** revisão técnica independente (arquiteto/revisor), sem implementação
> **Idioma oficial:** Português do Brasil

### Histórico de revisões

| Rev. | Data | Alterações |
| --- | --- | --- |
| 0 | 20/08/2026 | Redação inicial da baseline técnica e do plano `E-01`..`E-18`. |
| **1** | **20/08/2026** | Correção e consolidação para homologação final. (a) `D-PEND-01` **resolvida** — ESM desde a criação; passa a `D-ESM-01`, decisão consolidada (§16). (b) Justificativa do TypeScript 6.0 reescrita com descrição tecnicamente correta do TypeScript 7.0 (§6, `R-BL-03`). (c) `R-BL-01` reclassificado: a declaração oficial de suporte é citada literalmente e **nenhuma data de EOL é afirmada**; a revisão de janeiro/2027 é declarada **decisão interna de governança** (§15). (d) Conclusão sobre `R2.2-03` reestruturada em **fato documentado / hipótese técnica forte / verificação empírica**, permanecendo **condicionada a `V-04`** (§9.2). (e) Política de `prisma db pull` reescrita e endurecida com base no comportamento oficial vigente, incluindo a indução automática da Preview `partialIndexes` (§10.2). (f) Baseline revalidada em fontes oficiais na data desta revisão (§4, §5, §6, §18). Nenhuma linha da baseline foi alterada. |

| **2** | **20/08/2026** | **HOMOLOGAÇÃO FORMAL.** Registro do ato de homologação (§0). Correção editorial de precisão em §4.3 e na linha do Node.js em §6 — a formulação "único ponto de interseção" foi substituída por formulação exata que **preserva a existência da linha Node 22** como LTS suportada e elegível, preterida por estar em fase de manutenção. **A escolha por Node 24 não foi reaberta.** Nenhuma outra alteração técnica. |
| **3** | **20/08/2026** | **CORREÇÃO DE INCONSISTÊNCIA DE SEQUENCIAMENTO DO PLANO — sem alteração de baseline, arquitetura, requisito ou decisão homologada.** `V-06` era declarada critério de `E-01`, mas exigia `tsc --noEmit` sobre o **Prisma Client gerado**, que só passa a existir em `E-03` (`E-02` depende de `E-01`; `E-03` depende de `E-01` e `E-02`) — ciclo impossível de satisfazer. A verificação **não muda de significado**: sua **execução** passa a ocorrer em dois subchecks, `V-06.a` (em `E-01`) e `V-06.b` (em `E-03`), e `V-06` só é **APROVADA** quando ambos passarem. Nenhuma verificação foi renumerada, criada ou removida; `V-01`..`V-06` permanecem seis. Trechos alterados: tabela de §12, especificação de `V-06` em §12.2, `E-01` e `E-03` em §13, e a linha correspondente de §19. |
| **4** | **20/08/2026** | **CONSOLIDAÇÃO PRÉ-COMMIT DA FUNDAÇÃO `E-01`..`E-03` — sem alteração de baseline, arquitetura, requisito ou decisão homologada.** (a) **`V-06` deixa de ser declarada integralmente aprovada.** A verificação sempre mediu o teto do TypeScript 6.0 contra **Prisma 7 *e* Next.js 16**; a implementação da fundação não cria frontend, logo a metade Next **não foi medida**. Registra-se o subcheck **`V-06.c`** (TypeScript 6.0.x × Next.js 16), **PENDENTE**, e `V-06` passa a **PARCIALMENTE APROVADA** (§12.2). `V-06.c` **não bloqueia `E-04`..`E-07`** e **não autoriza criar `apps/web`**. (b) §12.1 deixa de ser uma declaração estática de "nenhuma verificação executada" e passa a ser o **registro vivo do estado de execução** das seis verificações. (c) `E-01`, `E-02` e `E-03` passam a **EXECUTADAS**, com `V-01` **APROVADA**. (d) Novo risco **`R-BL-09`** — vulnerabilidade transitiva no *tooling* do Prisma (§15, §15.2), em **aceitação temporária monitorada**. (e) `E-04` recebe pré-condição de volume local limpo. **Nenhuma versão da baseline de §6 foi alterada.** |

| **5** | **20/08/2026** | **REGISTRO DE EXECUÇÃO DO BLOCO II (`E-04`..`E-07`) — sem alteração de baseline, arquitetura, requisito ou decisão homologada.** (a) `E-04`, `E-05`, `E-06` e `E-07` passam a **EXECUTADAS**, cada uma com o SQL efetivamente aplicado e a verificação de catálogo correspondente (§13). (b) Duas divergências factuais entre seções de `docs/07` e a enumeração de `E-07` foram encontradas durante a implementação e registradas **sem decisão silenciosa**: **`DIV-04`** (`movimento_sessao.chave_idempotencia`) e **`DIV-05`** (IDX-R3) — §11. (c) `R-BL-09` foi **remedido** sem qualquer intervenção sobre dependências e permanece **ABERTO, em aceitação temporária monitorada** (§15.2, §19). (d) **Nenhuma verificação `V-*` mudou de estado**: `V-02`..`V-05` continuam **PENDENTES**, `V-06.c` continua **PENDENTE** e `V-06` continua **PARCIALMENTE APROVADA** (§12.1). (e) Nenhuma etapa de `E-08` em diante foi iniciada; nenhuma versão da baseline de §6 foi alterada; `docs/02`..`docs/07` e a Base Imutável permanecem intactos. |

| **6** | **21/08/2026** | **CORREÇÃO PRÉ-VERSIONAMENTO DE `E-04`..`E-07`, após revisão técnica independente e adversarial — sem alteração de baseline, arquitetura, requisito ou decisão homologada.** A revisão confrontou o diff local, as quatro migrations e o catálogo do PostgreSQL contra `docs/07`, e classificou a implementação como **apta após correções objetivas**. Bruno aprovou as correções em 21/08/2026. (a) **FK ausente corrigida** — `pacote.cancelado_por_usuario_id → usuario.id`, exigida por §5, §9.2 e §28.2 e omitida na REV. 5, embora as duas colunas irmãs tivessem sido implementadas; total de FKs passa de 69 para **70**. (b) **`DIV-04` decidida: REMOVER** a unicidade de `movimento_sessao.chave_idempotencia`, mantendo a coluna; uniques passam de 13 para **12** (§11). (c) **`DIV-05` decidida: IMPLEMENTAR** IDX-R3 em `reserva_sessao(agendamento_id)`; índices simples passam de 16 para **17** (§11). (d) **`onUpdate: Restrict` mantido**, reclassificado como **decisão de implementação em eixo não normatizado**; as duas justificativas incorretas da REV. 5 — "equivalência semântica" e apelo à Guarda 1 de §9.3 — foram **retiradas** (§13 `E-07`). (e) Correções documentais: a alegação de que "C-06/RN-065 exigem" a unicidade de `movimento_sessao` foi **retirada por ser falsa** (`docs/06` §13 define C-06 para M8); `DIV-05` foi **recaracterizada** como divergência interna a `docs/07` (§10-A × §28.2), e não a este documento; a afirmação de "zero ocorrências de `CASCADE`" foi corrigida; o identificador `DIV-E07-01` do cabeçalho da migration foi unificado em `DIV-04`; as colunas de `consentimento` foram declaradas **placeholder** (§13 `E-06`). (f) **Duas pendências editoriais sobre `docs/07` abertas e remetidas a `E-18`** — retirar o `U` de §14 e incluir IDX-R3 na Categoria A de §28.2. **`docs/07` NÃO foi alterado por esta revisão**, nem `docs/02`..`docs/06`, nem a Base Imutável. Nenhuma `V-*` mudou de estado; nenhum risco foi fechado; `E-08` não foi iniciada; nenhum commit, push, PR ou merge foi realizado. |

| **7** | **21/08/2026** | **REGISTRO DE EXECUÇÃO DE `E-08` E APROVAÇÃO DE `V-02` — sem alteração de baseline, arquitetura, requisito ou decisão homologada.** (a) `E-08` passa a **EXECUTADA**: migration `20260821232217_valor_liquido_gerado` converte `cobranca.valor_liquido` em `GENERATED ALWAYS AS (valor_bruto - valor_desconto) STORED` (§13 `E-08`). (b) **`V-02` passa a APROVADA** — primeira `V-*` a mudar de estado desde a REV. 4 (§12.1). A **estratégia principal da decisão `C-2` foi MANTIDA**; o **fallback de `docs/07` §19.2 (opção c) NÃO foi acionado**. (c) **Ajuste mínimo em `schema.prisma`: `valorLiquido` recebe `@default(dbgenerated())`.** Não é nova decisão: é o que a própria `C-2` exige ao mandar excluir o campo de todo `create`/`update`. Sem ele o campo é **obrigatório** na entrada do Client e `V-02` mediu um impasse — omitir produz `Argument valorLiquido is missing` e informar produz **SQLSTATE 428C9** do PostgreSQL, tornando a criação impossível. Com ele o campo fica opcional na entrada, **nenhum default é emitido em migration** e o `migrate diff` continua vazio (§13 `E-08`). (d) **Nota de ambiente, registrada sem correção nesta tarefa:** o `_prisma_migrations` do banco de desenvolvimento guarda, para `20260820121900_relacoes_fks_unicidades_indices`, o checksum **anterior** à regeneração da REV. 6 — resíduo daquela correção. `migrate dev` pede reset por causa disso; **o reset foi recusado**, e `E-08` seguiu pelo mesmo caminho não interativo já usado em `E-07`. A estrutura do banco **confere** com o arquivo versionado (70 FKs, 12 uniques, IDX-R3) e o replay do histórico do zero reproduz tudo. **Pendência de ambiente, não de repositório** (§13 `E-08`). (e) Nenhuma etapa de `E-09` em diante foi iniciada — **0** CHECKs `ck_*`, **0** exclusion constraints, **0** triggers e **0** índices parciais no catálogo. (f) `DIV-04` e `DIV-05` **não** foram reabertas; as pendências editoriais de `docs/07` remetidas a `E-18` **permanecem abertas**; `R2.2-03`, `R-BL-05` e `R-BL-09` **permanecem abertos**; `V-03`, `V-04`, `V-05` e `V-06.c` **permanecem PENDENTES**. Nenhuma versão da baseline de §6 foi alterada; nenhuma Preview Feature foi introduzida; `docs/02`..`docs/07` e a Base Imutável permanecem intactos. Nenhum commit, push, PR ou merge foi realizado. |

**Escopo destas revisões.** Somente `docs/08` foi alterado. Nenhuma decisão homologada de `docs/02`..`docs/07` foi reaberta, alterada ou reinterpretada. As revisões 0 a 4 não iniciaram implementação; a **REV. 5** registra a execução do Bloco II do plano (`E-04`..`E-07`) como **registro de execução, sem alteração da homologação técnica**.

---

## 0. Registro formal de homologação

> **HOMOLOGADO — BASELINE TÉCNICA E PLANO DE IMPLEMENTAÇÃO FÍSICA APROVADOS, COM VERIFICAÇÕES `V-01` A `V-06` PENDENTES PARA EXECUÇÃO NAS ETAPAS CORRESPONDENTES.**

| Item | Registro |
| --- | --- |
| **Autoridade** | **Bruno Menezes Noronha** — proprietário do produto e autoridade final do projeto (TLF-BASE-V1 §15, item 1) |
| **Data da homologação** | **20 de agosto de 2026** |
| **Objeto** | `docs/08-baseline-tecnica-plano-implementacao.md`, REV. 2 |
| **Fase** | Fase 2 — Modelagem. **Encerramento documental** da transição Etapa 2.2 → implementação física |

### 0.1 O que fica homologado

| # | Objeto homologado | Seção |
| --- | --- | --- |
| 1 | **Baseline técnica de versões** — Node.js 24.x LTS, PostgreSQL 18, Prisma ORM 7.x + `@prisma/adapter-pg`, TypeScript 6.0.x, Next.js 16.x, NestJS 11.x, Jest 30.x | §6 |
| 2 | **`D-ESM-01`** — backend e workspace de banco em **ESM desde a criação**; **não se aguardará o NestJS 12** para iniciar o backend | §16 |
| 3 | **As seis decisões da Categoria C** — `btree_gist` por migration dedicada; `valor_liquido` como coluna gerada `STORED`; SQL customizado para objetos não representáveis; `SELECT ... FOR UPDATE` via `tx.$queryRaw`; `READ COMMITTED` com locks explícitos; mapeamento de erro por constraint com nomes determinísticos | §7 |
| 4 | **Política de migrations** e **política restritiva de introspection (`prisma db pull`)** | §10, §10.2 |
| 5 | **Tríade de guardas anti-drift** e o workflow operacional seguro | §9.3 |
| 6 | **Plano de implementação física `E-01`..`E-18`**, com objetivos, dependências, validações, critérios de aceite, riscos e reversibilidade | §13 |
| 7 | **Critérios mínimos de testes** | §14 |

Permanecem **PENDENTES por escopo**, conforme já declarado: Tailwind CSS, Playwright, provedor de armazenamento S3-compatível e versão concreta de engine Docker (§6, §6.1).

### 0.2 O que a homologação não altera

As **verificações `V-01` a `V-06` permanecem pendentes por desenho** (§12.1). Elas medem comportamento que só existe quando o ambiente existe, e pertencem às etapas que as consomem.

> **Nota da REV. 4.** O parágrafo acima registra o estado **no ato da homologação (20/08/2026)** e é mantido como registro histórico. O **estado de execução corrente** das seis verificações passou a ser mantido em **§12.1**, que é a fonte a consultar.

> **Pendências experimentais não anulam a homologação documental.** A homologação aprova **as decisões, a baseline e o plano**. Ela **não** declara verificado o que não foi executado, e **não** encerra riscos condicionados a verificação.

Em consequência, permanecem expressamente **abertos** após esta homologação:

- **`R2.2-03`** — perda silenciosa de objetos SQL customizados: **reduzido, não encerrado**, e condicionado a **`V-04`** (§9.2.4);
- **`R-BL-05`** — índices parciais na zona cinzenta de C-3: aberto até `V-04`;
- **`R-BL-01`** — governança da baseline Prisma, com revisão interna programada para janeiro de 2027, que **não é EOL do Prisma** (§15.1);
- **`R-BL-02`** — validação prática da configuração ESM, na etapa que criar `apps/api`.

### 0.3 O que a homologação autoriza e o que não autoriza

- **Autoriza** abrir a implementação física a partir de `E-01`, em tarefa própria, observando integralmente o plano de §13 e as políticas de §9.3, §10 e §10.2.
- **Não autoriza**, por si só: alterar `docs/02`..`docs/07`; incorporar Preview Features à baseline; declarar encerrado qualquer risco condicionado a `V-*`; nem merge em `main`, PR, tag, release ou deploy — que seguem sujeitos a TLF-BASE-V1 §14.

---

## 1. Finalidade e limites deste documento

Este documento responde à instrução registrada em `docs/07-modelo-persistencia.md` §1.1 e §28.4 item 2:

> "fixar as versões de PostgreSQL e Prisma e **verificar toda a Categoria C** (`P2.2-08`), produzindo em seguida o **plano de implementação física**."

Ele **fecha a pendência `P2.2-08`** e produz o plano executável. Ele **não** implementa nada.

### 1.1 O que este documento faz

1. Resolve integralmente os **seis itens da Categoria C** de `docs/07` §28.2.
2. Fixa a baseline de versões técnicas do projeto (§6).
3. Valida a preservação do modelo físico homologado sob PostgreSQL + Prisma Migrate (§8, §9).
4. Define a política operacional de migrations (§10).
5. Produz o plano de implementação física em etapas verificáveis (§13).
6. Registra divergências encontradas contra `docs/07` (§11) e consolida a decisão de formato de módulo — **ESM** (§16).

### 1.2 O que este documento não faz

Não cria `schema.prisma`; não gera nem aplica migrations; não cria tabelas; não instala dependências; não executa `npm install`; não altera contratos de API; não implementa backend ou frontend; não faz commit, push, PR, merge ou deploy; não trabalha em `main`; não altera `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`; não altera `docs/02`..`docs/07`.

### 1.3 Hierarquia de autoridade aplicada (TLF-BASE-V1 §15)

1. Autorização explícita e atual de **Bruno Menezes Noronha**.
2. `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — **IMUTÁVEL** — em especial §9 (arquitetura de referência), §4.5 (simplicidade do MVP), §14 (governança).
3. `docs/07-modelo-persistencia.md` — **HOMOLOGADO — REV. 2**.
4. `docs/02` a `docs/06` — homologados.
5. Este documento — **homologado em 20/08/2026** (§0), mutável quanto a versões e plano.

**Regra aplicada em todo o texto:** TLF-BASE-V1 §9 fixa **quais** tecnologias; **versões exatas são explicitamente delegadas a documento mutável** ("Versões exatas e provedores de infraestrutura são decisões mutáveis e devem ser documentados fora desta base"). Este documento é esse destino. Nenhuma tecnologia foi acrescentada ao baseline além das já listadas em TLF-BASE-V1 §9.

---

## 2. Estado do repositório — verificação independente

Verificado em **20/08/2026**, antes de qualquer alteração. O relato anterior (`docs/07` §1.5) foi **confirmado ponto a ponto**, sem divergência material.

> **Reverificação da REV. 1 (20/08/2026).** O estado do repositório foi inspecionado **novamente**, do zero, antes das correções desta revisão — sem confiar no relato acima. Resultado: branch, HEAD, arquivos rastreados, arquivos não rastreados e ausência de artefatos de implementação **permanecem exatamente como descritos nesta seção**, acrescido de `docs/08` como terceiro arquivo não rastreado. Nenhuma alteração preexistente alheia a esta tarefa foi encontrada; nada foi descartado. Comandos executados: `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, `git log -5 --oneline --decorate`, `git diff`, `git diff --cached`, `git ls-files`, além de varredura por `package.json`, `*.prisma`, `tsconfig*.json`, `Dockerfile*` e lockfiles.

| Item declarado em `docs/07` §1.5 e no enunciado | Verificação | Veredito |
| --- | --- | --- |
| Branch `agent/fase2-etapa2.2-persistencia` | `git rev-parse --abbrev-ref HEAD` → `agent/fase2-etapa2.2-persistencia` | **CONFIRMADO** |
| HEAD `f9d8296` | `git rev-parse HEAD` → `f9d82964818c1119a1b4dcbb86d483762f183489`; `git log -1 --oneline` → `f9d8296 docs: add homologated phase 2.1 domain model` | **CONFIRMADO** |
| `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` não rastreado | `git status --porcelain` → `?? TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` | **CONFIRMADO** |
| `docs/07-modelo-persistencia.md` não rastreado | `git status --porcelain` → `?? docs/07-modelo-persistencia.md` | **CONFIRMADO** |
| Nenhum commit, push, merge, rebase, PR ou deploy da Etapa 2.2 | `git log` não contém commit posterior a `f9d8296`; árvore de trabalho contém apenas os dois arquivos não rastreados | **CONFIRMADO** |
| Nenhum `schema.prisma` ou migration | Inventário completo de arquivos não retorna nenhum artefato Prisma | **CONFIRMADO** |

### 2.1 Inventário técnico real do repositório

`git ls-files` retorna exatamente 6 arquivos rastreados:

```
README.md
docs/02-requisitos.md
docs/03-regras-negocio.md
docs/04-perfis-permissoes.md
docs/05-jornadas-fluxos.md
docs/06-modelo-dominio.md
```

Inventário completo do diretório de trabalho (excluído `.git`): os 6 rastreados, mais `.claude/settings.local.json`, `docs/07-modelo-persistencia.md` e `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`.

**Consequência decisiva para este documento:**

| Artefato técnico procurado | Existe? |
| --- | --- |
| `package.json` | **NÃO** |
| npm workspaces | **NÃO** |
| lockfile (`package-lock.json`) | **NÃO** |
| `Dockerfile` / `docker-compose.yml` | **NÃO** |
| Qualquer arquivo Prisma (`schema.prisma`, `prisma.config.ts`, `migrations/`) | **NÃO** |
| `tsconfig.json` / qualquer configuração TypeScript | **NÃO** |
| Qualquer versão já registrada em qualquer arquivo | **NÃO** |
| `README.md` | Existe, **vazio (0 linhas)** |
| `.github/workflows` | **NÃO** |

**Não há nenhuma versão preexistente no repositório.** Toda a baseline de §6 é decisão nova, sem restrição de compatibilidade retroativa e sem custo de migração. Isso é uma vantagem: permite escolher a combinação conservadora ideal em vez de acomodar decisões passadas.

`docs/02` a `docs/06` foram inspecionados por busca textual em busca de qualquer fixação de tecnologia ou versão. **Nenhum deles fixa versão.** A única menção técnica é `docs/06` §1, que apenas declara que aquele documento **não** antecipa schema/Prisma. Portanto **TLF-BASE-V1 §9 é a única fonte de stack**, e ela delega versões a este documento.

### 2.2 Destino documental — por que um documento novo

Conforme exigido antes de criar arquivo novo:

1. **Existe documento mutável destinado a baseline técnica ou plano de implementação?** Não. `docs/02` a `docs/07` são todos entregáveis **homologados** de Fase 1 e Fase 2; `README.md` está vazio e não é destino apropriado para decisão de arquitetura.
2. **Atualizar documento existente?** Rejeitado. Atualizar `docs/07` apenas para registrar versões técnicas é **expressamente desaconselhado** pela instrução desta tarefa e violaria o status `HOMOLOGADO — REV. 2` sem revisão formal.
3. **Sequência real confirmada:** `docs/02` … `docs/07` existem; **`docs/08` é o próximo número livre** — verificado por listagem de diretório, não presumido.
4. Nome escolhido: `docs/08-baseline-tecnica-plano-implementacao.md`, coerente com o padrão `NN-assunto-em-kebab-case.md`.

---

## 3. Metodologia da pesquisa de versões

Para cada tecnologia foram consultadas **documentação oficial e/ou release notes oficiais**, e registrados: versão estável atual, status de LTS/suporte, EOL, requisitos mínimos, compatibilidades cruzadas, breaking changes e risco para este projeto.

Três colunas são mantidas separadas e **não** são confundidas:

- **versão mais recente** — o que existe hoje;
- **versão recomendável para produção** — o que o fornecedor recomenda;
- **versão escolhida para o TechLab Fisio** — a decisão deste documento.

**Critérios de otimização, na ordem aplicada:** segurança → suporte oficial → previsibilidade → compatibilidade cruzada → simplicidade do MVP (TLF-BASE-V1 §4.5) → manutenção futura.

**Regra de exclusão aplicada sem exceção:** nenhum artefato em estado *Preview*, *Canary*, *RC*, *Beta*, *Early Access* ou *Experimental* entra na baseline. Esta regra **eliminou candidatos numericamente mais novos** — Prisma 8 (Early Access), PostgreSQL 19 (beta) e o recurso `partialIndexes` do Prisma (Preview) — e é a razão de três decisões abaixo.

Nenhuma versão foi escolhida por ser numericamente a mais nova. Em dois casos (Node.js e TypeScript) a versão mais nova foi **deliberadamente rejeitada**.

### 3.1 Revalidação da REV. 1 — data de consulta

Versões, políticas de suporte e comportamento de ferramenta são **mutáveis**. Por isso a REV. 1 **não presumiu** a validade da pesquisa anterior: todas as afirmações relevantes foram reconsultadas nas fontes **oficiais primárias** em **20/08/2026**. Fontes de terceiros não foram usadas como base de nenhuma afirmação sustentada por documentação oficial.

**Resultado da revalidação:** nenhuma linha da baseline de §6 mudou. Quatro ajustes de **redação, classificação ou política** foram necessários e estão registrados no histórico de revisões — nenhum deles altera uma versão escolhida.

| Item revalidado | Fonte oficial | Resultado |
| --- | --- | --- |
| Linhas de release do Node.js | nodejs.org — *Previous Releases* | **Inalterado.** v26 Current; v24 e v22 LTS; v25, v23, v20 e anteriores EOL |
| Suporte do PostgreSQL por major | postgresql.org — *Versioning Policy* | **Inalterado.** 18 → 14/11/2030; 14 → 12/11/2026 |
| Requisitos de sistema do Prisma | prisma.io/docs — *System requirements* | **Inalterado.** Node `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0`; TS 5.4+ |
| Bancos suportados pelo Prisma | prisma.io/docs — *Supported databases* | **Inalterado.** PostgreSQL 9.6–18 |
| Preview features do Prisma | prisma.io/docs — *Preview features* | **Inalterado.** `partialIndexes` em Preview desde 7.4.0; `postgresqlExtensions` **ausente** de ambas as listas |
| Janela de suporte do Prisma 7 | prisma.io/blog — *The Next Evolution of Prisma ORM* (04/03/2026) | **Reclassificado.** Há declaração oficial de suporte; **não há** declaração de EOL — ver §15, `R-BL-01` |
| TypeScript 6.0 e 7.0 | devblogs.microsoft.com/typescript | **Redação corrigida.** 6.0 em 23/03/2026; 7.0 em 08/07/2026 — ver §6 e `R-BL-03` |
| Next.js | nextjs.org/docs — *Installation* | **Inalterado.** Documentação em 16.3.1; Node mínimo 20.9; TS mínimo 5.1 |
| NestJS | github.com/nestjs/nest | **Inalterado.** Linha estável 11.2.x; **v12 não lançada** (PR de release aberto, previsão ~Q3/2026) |
| Jest | jestjs.io — *Jest 30* | **Inalterado.** TS mínimo 5.4; Node 14, 16, 19 e 21 removidos; ESM suportado com configuração |
| Comportamento de `db pull` | prisma.io/docs — *CLI reference*, *Introspection*, *Indexes* | **Política reescrita** — ver §10.2 |

---

## 4. Validação obrigatória — Node.js

### 4.1 Estado oficial das linhas de release

Fonte: [Node.js — Previous Releases](https://nodejs.org/en/about/previous-releases).

| Linha | Status oficial | Observação |
| --- | --- | --- |
| **v26** | **Current** | Primeira release 05/05/2026. Fase *Current*, não LTS |
| v25 | **EOL** | Encerrada em 31/03/2026 |
| **v24 "Krypton"** | **Active LTS** | Linha recomendada para produção |
| v22 "Jod" | **LTS — fase de manutenção** | Ainda suportada, porém mais próxima do fim de ciclo que a v24 |
| v20 "Iron" | **EOL** | Encerrada em 24/03/2026 |
| v18 "Hydrogen" | **EOL** | Encerrada em 27/03/2025 |

### 4.2 Compatibilidade cruzada verificada

| Consumidor | Exigência oficial | Node 24 atende? |
| --- | --- | --- |
| **Prisma ORM 7** | `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0`; política declarada: "supports and tests all *Active LTS* and *Maintenance LTS* Node.js releases" ([System requirements](https://www.prisma.io/docs/orm/reference/system-requirements)) | **Sim** |
| **Next.js 16** | Node.js mínimo **20.9** ([Installation](https://nextjs.org/docs/app/getting-started/installation)) | **Sim** |
| **NestJS 11** | `engines.node: ">= 20"` (campo `engines` de `@nestjs/core`) | **Sim** |
| **Jest 30** | Node mínimo 18.x | **Sim** |
| **GitHub Actions** | `actions/setup-node` suporta a linha LTS corrente | **Sim** |
| **Docker** | Imagem oficial `node:24-*` publicada e mantida | **Sim** |

### 4.3 Decisão e justificativa

**Node.js escolhido: linha 24 (Active LTS, "Krypton").**

1. É a linha **Active LTS**, exatamente o que TLF-BASE-V1 §9 exige ("Node.js em versão LTS suportada").
2. **Node 26 é rejeitado** apesar de numericamente mais novo: está em fase **Current**, não LTS. A instrução de não usar *Current* havendo LTS adequada aplica-se, e **não há justificativa excepcional** — pelo contrário, há impedimento adicional: a faixa suportada pelo Prisma 7 (`^20.19.0 || ^22.12.0 || ^24.0.0`) **não inclui a v26**. Adotar Node 26 quebraria o ORM.
3. **Node 22 é rejeitado** por já estar em fase de manutenção: escolher hoje a mais antiga entre duas linhas suportadas encurta a janela sem ganho.
4. **Node 20 e 18 são inelegíveis** — EOL.

**Formulação precisa da escolha** (correção editorial da homologação, 20/08/2026): Node 24 é a linha **Active LTS** adequada à baseline **e** compatível com a faixa de Node suportada pelo Prisma 7. Node 22 **também** é uma linha LTS suportada e **também** está na faixa do Prisma 7 (`^22.12.0`) — ela é elegível, e não deixa de existir como alternativa; foi preterida pelo item 3 acima (fase de manutenção), não por incompatibilidade. A escolha por 24 é **fundamentada**, não forçada por ausência de alternativa.

### 4.4 Estratégia de pinning

| Camada | Estratégia | Motivo |
| --- | --- | --- |
| `package.json` → `engines.node` | `">=24.0.0 <25"` | Trava a **major**; impede execução acidental em Current ou EOL |
| `.nvmrc` | `24` | Alinha a máquina de desenvolvimento (Windows — TLF-BASE-V1 §2) |
| Imagem Docker | `node:24-bookworm-slim` (major + distro, sem patch) | Recebe patches de segurança da linha sem exigir commit a cada release |
| GitHub Actions | `actions/setup-node` com `node-version-file: .nvmrc` | **Fonte única** de versão; impede divergência CI × local |
| Lockfile | `package-lock.json` **versionado e obrigatório**; CI usa `npm ci` | Reprodutibilidade exata das dependências |

**Racional do pinning por major, não por patch:** o patch exato é responsabilidade do lockfile (dependências) e da imagem (runtime). Pinar patch de Node em quatro lugares gera manutenção recorrente sem ganho de reprodutibilidade.

**npm:** utiliza-se o npm distribuído com a linha Node 24, sem instalação separada. O valor efetivo deve ser registrado no campo `packageManager` do `package.json` **no momento do scaffold** (`E-01`), lido da máquina — não declarado aqui por presunção. Ver `V-06`.

---

## 5. Validação obrigatória — PostgreSQL

### 5.1 Estado oficial de suporte

Fonte: [PostgreSQL Versioning Policy](https://www.postgresql.org/support/versioning/). Política: uma major por ano, **5 anos de suporte** por major; minor a cada ~3 meses.

| Major | EOL oficial |
| --- | --- |
| **18** | **14/11/2030** |
| 17 | 08/11/2029 |
| 16 | 09/11/2028 |
| 15 | 11/11/2027 |
| 14 | **12/11/2026** — expira em menos de 3 meses |

### 5.2 Compatibilidade com Prisma

A matriz oficial de bancos suportados ([Supported databases](https://www.prisma.io/docs/orm/reference/supported-databases)) lista PostgreSQL **9.6, 10, 11, 12, 13, 14, 15, 16, 17 e 18**. **PostgreSQL 18 é oficialmente suportado** pela linha Prisma vigente.

### 5.3 Decisão

**PostgreSQL escolhido: major 18.**

1. **Maior janela de suporte** — EOL 14/11/2030. Escolher 17 consumiria um ano de vida útil no dia zero, sem contrapartida.
2. **Oficialmente suportado pelo Prisma 7**, verificado na matriz oficial.
3. **Não é a "mais nova possível"** — a imagem oficial já publica a linha **19 em beta**. A 19 é **rejeitada** pela regra de exclusão de §3. A escolha da 18 é a *mais nova estável e suportada*, não a mais nova existente.
4. Todos os recursos exigidos por `docs/07` existem e são estáveis na 18 há várias majors — não se está apostando em novidade.

### 5.4 Suporte aos tipos, constraints e comportamentos exigidos por `docs/07`

| Exigência de `docs/07` | Suporte no PostgreSQL 18 | Observação |
| --- | --- | --- |
| `uuid` como PK (§5; TLF-BASE-V1 §9) | Nativo | — |
| `timestamptz` — instantes UTC (§24.1) | Nativo | — |
| `date` — datas civis (§24.1) | Nativo | — |
| `time` + `dia_semana` (§24.1) | Nativo | — |
| `numeric(12,2)` monetário (RN-042) | Nativo, decimal exato | Confirma §19.2: subtração de dois valores de 2 casas é exata |
| `jsonb` (`evento_auditoria.contexto`) | Nativo | — |
| Tipos ENUM nativos (§5) | Nativo | — |
| `CHECK` constraints (§10.2) | Nativo, inclusive operador `~` (regex) para o CPF | — |
| Índices únicos **parciais** (§10-A) | Nativo (`CREATE UNIQUE INDEX ... WHERE`) | — |
| **Exclusion constraints** (IDX-A1, IDX-A2) | Nativo (`EXCLUDE USING gist (...) WHERE (...)`) | Aceita predicado parcial e expressão |
| `tstzrange(inicio, fim, '[)')` calculado na constraint (§24.1) | Nativo; construtor de range é imutável, logo indexável | O intervalo semiaberto resolve a borda `T-AGD-EDGE-NON-OVERLAP` |
| `NULL` distinto em índice único (U-07, U-09, U-10, U-12) | Comportamento **padrão** | `docs/07` §10.1 determina **não** usar `NULLS NOT DISTINCT` — respeitado |
| Coluna gerada `STORED` (`valor_liquido`, §19.2) | Nativo desde a 12 | Ver `C-2` (§7) |
| Triggers `BEFORE UPDATE/DELETE` (§22.2) | Nativo | — |
| `REVOKE UPDATE, DELETE` por role (§22.2) | Nativo | Exige separação de roles — `E-03` |
| `ON DELETE RESTRICT / NO ACTION` (§9.2) | Nativo | — |

**Nenhum objeto do modelo homologado exige recurso ausente, experimental ou exótico do PostgreSQL 18.** O modelo é conservador do lado do banco; toda a dificuldade está do lado do Prisma (§7, §8).

### 5.5 `btree_gist` — condição homologada `H2.2-06`

`docs/07` §28.2 exige que a condição **não** seja considerada satisfeita apenas porque a extensão existe. Verificação em sete pontos:

| # | Pergunta obrigatória | Resposta verificada | Fonte |
| --- | --- | --- | --- |
| 1 | A extensão existe na versão selecionada? | **Sim.** `btree_gist` é módulo *contrib* padrão do PostgreSQL 18 | [PostgreSQL 18 — btree_gist](https://www.postgresql.org/docs/18/btree-gist.html) |
| 2 | Cobre os tipos que o modelo usa? | **Sim — e este é o ponto crítico.** A documentação lista explicitamente `uuid` e `timestamp with time zone` entre os tipos suportados. IDX-A1 (`profissional_id uuid WITH =`) e IDX-A2 (`paciente_id uuid WITH =`) **dependem** disso: sem `btree_gist` não existe operator class GiST para igualdade de `uuid`, e as duas exclusion constraints seriam **impossíveis** | idem |
| 3 | Que privilégio o `CREATE EXTENSION` exige? | **Não exige superusuário.** Citação literal: "This module is considered 'trusted', that is, it can be installed by non-superusers who have `CREATE` privilege on the current database." Basta `CREATE` no banco para a role de migration | idem |
| 4 | Está disponível na imagem/container pretendido? | Os módulos *contrib* acompanham a imagem oficial `postgres`. **Classificado como alta confiança, não como fato verificado** — a verificação executável é `V-01` (§12) e é **critério de aceite bloqueante** de `E-02` | Imagem oficial `postgres` |
| 5 | É necessária no banco principal? | **Sim** — IDX-A1 e IDX-A2 são criadas lá | `docs/07` §10-A |
| 6 | É necessária no **shadow database**? | **Sim. E é satisfeita automaticamente, desde que criada por migration:** o shadow database "reruns the current, existing migration history", ou seja, a migration que cria a extensão roda **também** no shadow. A role do `migrate dev` precisa de `CREATEDB` (criar o shadow) e de `CREATE` no banco criado (instalar a extensão) | [Shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database) |
| 7 | Qual o momento correto de criação? | **Primeira migration do histórico**, isolada e idempotente (`CREATE EXTENSION IF NOT EXISTS btree_gist;`), antes de qualquer objeto dependente — para que shadow database, `migrate reset` e CI a partir de banco vazio reproduzam a mesma ordem | §10, `E-02` |

**Estratégia reproduzível determinada:** extensão criada por **migration dedicada, idempotente e primeira do histórico**. Isso satisfaz simultaneamente banco principal, shadow database, `migrate reset`, CI a partir de banco vazio e qualquer ambiente futuro, sem passo manual fora do histórico versionado. **Nenhum `CREATE EXTENSION` executado fora de migration é aceito** pela política de §10.

**Condição `H2.2-06`: atendida em 6 dos 7 pontos por evidência documental; o ponto 4 é fechado por `V-01` antes de `E-04`.**

> **Atualização da REV. 4.** **`V-01` foi executada e APROVADA** em 20/08/2026, durante `E-02` (§12.1). O ponto 4 deixa de ser "alta confiança" e passa a **fato verificado**: a imagem `postgres:18-bookworm` contém `btree_gist`, e a extensão foi instalada por `tlf_migrator`, role **não superusuária**, seguida da criação efetiva de uma `EXCLUDE` com `uuid WITH =` e `tstzrange WITH &&`. **`H2.2-06` fica atendida nos 7 pontos.** O fallback com `postgresql-contrib` não foi necessário.

### 5.6 Estratégia de imagem e política de minor releases

| Ambiente | Estratégia | Motivo |
| --- | --- | --- |
| Desenvolvimento (`docker-compose`) | `postgres:18-bookworm` | Major travada; minor acompanha |
| CI (service container) | `postgres:18-bookworm` — **mesma tag** | Elimina a classe de bug "passa local, falha no CI" |
| Produção | Major 18 fixa; minor sempre a mais recente | Recomendação oficial: "Always run the current minor release of your major version" |

**Política de minor:** minor releases trazem correções de bug e segurança, e o procedimento é de baixo risco (parar servidor → instalar binários → reiniciar), sem dump/reload. Adotam-se sem cerimônia. **Upgrade de major** exige `pg_upgrade` ou dump/reload e é mudança de arquitetura sujeita a TLF-BASE-V1 §14 — não é decisão de rotina. Reavaliação agendada para antes de novembro de 2030.

**Alpine é rejeitado** em desenvolvimento e CI: a diferença de libc altera *collation*, afetando ordenação e comparação de texto — divergência silenciosa entre ambientes que o projeto não deve carregar por economia de imagem.

---

## 6. Baseline técnica final — matriz de versões

Escopo: as tecnologias de **TLF-BASE-V1 §9**. Nada foi acrescentado por popularidade.

| Tecnologia | Versão avaliada | Versão escolhida | Status de suporte | Motivo | Compatibilidades verificadas | Risco |
| --- | ---: | ---: | --- | --- | --- | --- |
| **Node.js** | 26 (Current), 24 (Active LTS), 22 (Maint. LTS), 20/18 (EOL) | **24.x** | Active LTS | Linha **Active LTS** adequada à baseline e compatível com a faixa do Prisma 7. A v22 é LTS em **manutenção** e também compatível — elegível, porém preterida (§4.3) | Prisma 7 ✔; Next 16 (≥20.9) ✔; Nest 11 (≥20) ✔; Jest 30 ✔; Docker ✔; GH Actions ✔ | **Baixo** |
| **PostgreSQL** | 19 (beta), 18, 17, 16, 15, 14 | **18** | Suportada até 14/11/2030 | Maior janela entre as estáveis; suportada pelo Prisma; cobre 100% de `docs/07` §5.4 | Prisma (matriz oficial) ✔; `btree_gist` ✔; exclusion constraints ✔; colunas geradas ✔ | **Baixo** |
| **Prisma ORM** | 8 (Early Access), **7.x** (estável) | **7.x** (fixar minor no scaffold) | Estável e **declarada pelo fornecedor como versão recomendada para produção**. Sem data de EOL publicada — ver `R-BL-01` | Única linha estável; Prisma 8 é Early Access e proibido por §3 | PostgreSQL 18 ✔; Node 24 ✔; TS ≥5.4 ✔ | **Médio** — `R-BL-01` (governança da baseline) |
| **`@prisma/adapter-pg`** | acompanha o Prisma 7 | **mesma minor do `prisma`/`@prisma/client`** | Estável | **Obrigatório**: driver adapter é mandatório no Prisma 7 | Prisma 7 ✔; PostgreSQL 18 ✔ | **Baixo** |
| **TypeScript** | 7.0 (08/07/2026), 6.0 (23/03/2026), 5.x | **6.0.x** | Estável | Ver §6.3 — maturidade, previsibilidade do ecossistema e menor risco de partida. **Decisão mutável de baseline**, não restrição da Base Imutável | Prisma ≥5.4 ✔; Next ≥5.1 ✔; Jest 30 ≥5.4 ✔ — todos por limite **mínimo**. Teto: **medido e aprovado contra o Prisma 7** (`V-06.b`); **não medido** contra Next 16 (`V-06.c`, pendente) nem contra Jest 30 (`V-05`, pendente) | **Médio** — `R-BL-03` |
| **Next.js** | 16.3 | **16.x** | Active LTS declarado pelo projeto | Linha estável corrente; Node 24 atende com folga | Node ≥20.9 ✔; React 19 ✔; TS ≥5.1 ✔; Tailwind ✔ | **Baixo** |
| **React** | 19 (embutido no App Router do Next 16) | **19.x** | Estável | Determinado pelo Next.js 16 | Next 16 ✔ | **Baixo** |
| **NestJS** | 11.2.x (v12 com PR de release aberto, **não lançada**) | **11.x** | Estável | v12 não existe como release; baseline não adota não lançado. **Não se aguarda a v12** — ver `D-ESM-01` (§16) | Node ≥20 ✔; TS ✔; **ESM: configuração deliberada exigida — `R-BL-02`** | **Médio** — `R-BL-02` |
| **Tailwind CSS** | — | **PENDENTE** | — | **Bloqueio declarado:** não pertence a nenhum dos seis itens da Categoria C nem a qualquer etapa deste plano (que termina na persistência). Fixar na etapa de scaffold do frontend, junto com a versão que o `create-next-app` do Next 16 instalar | — | — |
| **Jest** | 30.x | **30.x** | Estável | Exigido por TLF-BASE-V1 §9; usado nos testes de persistência (`E-13`..`E-16`) | Node ≥18 ✔; TS ≥5.4 ✔; **ESM: suportado, exige configuração — `V-05`** | **Médio** — `R-BL-04` |
| **Playwright** | — | **PENDENTE** | — | **Bloqueio declarado:** E2E não faz parte deste plano; nenhuma interface existe. Fixar na etapa de frontend | — | — |
| **Docker Engine / Compose** | — | **Compose spec v2, sem campo `version:`** | Estável | Apenas desenvolvimento (TLF-BASE-V1 §9). Não se fixa versão de engine: fixa-se a **tag das imagens**, que é o que determina o comportamento | `postgres:18-bookworm` ✔; `node:24-bookworm-slim` ✔ | **Baixo** |
| **GitHub Actions** | — | **runner `ubuntu-latest`; versões de action por major (`@v4`/`@v5`)** | Estável | Node vem de `.nvmrc`; Postgres vem de service container com a mesma tag do dev | Node 24 ✔; `postgres:18` ✔ | **Baixo** |
| **Armazenamento S3-compatível** | — | **PENDENTE** | — | **Bloqueio declarado:** `anexo_clinico` persiste apenas `chave_objeto` (`docs/07` §22.1); nenhuma decisão de provedor é necessária para a persistência. Fixar na etapa de anexos | — | — |

### 6.1 Sobre os `PENDENTE`

Quatro itens ficam `PENDENTE` **por escopo, não por falta de pesquisa**. Fixar hoje a versão de Tailwind, Playwright ou do provedor S3 seria decidir sem o consumidor existir — precisamente o tipo de decisão prematura que TLF-BASE-V1 §4.5 proíbe. O bloqueio de cada um está declarado literalmente na coluna "Motivo" e nenhum deles impede a implementação física da persistência.

### 6.2 Consistência interna da baseline

| Par a validar | Resultado |
| --- | --- |
| Node 24 ↔ Prisma 7 | ✔ `^24.0.0` está na faixa oficial |
| Node 24 ↔ Next 16 | ✔ mínimo 20.9 |
| Node 24 ↔ NestJS 11 | ✔ `engines.node >= 20` |
| Node 24 ↔ Jest 30 | ✔ mínimo 18 |
| Prisma 7 ↔ PostgreSQL 18 | ✔ matriz oficial de bancos suportados |
| Prisma 7 ↔ TypeScript 6.0 | ✔ por mínimo (≥5.4). **Teto CONFIRMADO por execução** — `V-06.b` aprovada em `E-03`: `tsc --noEmit` limpo sobre o Prisma Client 7 gerado, em ESM |
| Next 16 ↔ TypeScript 6.0 | ✔ por mínimo (≥5.1); **teto ainda NÃO medido** — `V-06.c`, pendente até o scaffold do frontend (§12.2) |
| Prisma 7 ↔ NestJS 11 | ⚠ **ESM** — **decisão tomada** (`D-ESM-01`, §16): o backend nasce ESM. A **compatibilidade concreta** (decorators, build, testes) é validada na etapa de implementação do backend, fora deste plano. Ver `R-BL-02` |

A baseline é internamente consistente e cada par foi verificado contra documentação oficial, não por inferência. O único par com ressalva não é uma incompatibilidade declarada pelos fornecedores, e sim uma **exigência de configuração deliberada** já decidida em §16.

### 6.3 TypeScript — por que a baseline permanece em 6.0

**Decisão: TypeScript 6.0.x.** Esta é uma **decisão mutável de baseline** (TLF-BASE-V1 §9 delega versões a documento mutável); a Base Imutável exige apenas "TypeScript estrito", sem fixar linha.

**Descrição tecnicamente correta do estado das duas linhas** (fonte: blog oficial do TypeScript, consultado em 20/08/2026):

- **TypeScript 6.0** — publicado em **23/03/2026**. É descrito pela equipe como pretendido para ser *"the last release based on the current JavaScript codebase"*, ou seja, a última linha da implementação histórica do compilador.
- **TypeScript 7.0** — publicado em **08/07/2026**. É a **nova implementação nativa** do compilador e do *toolchain*, escrita em **Go**. O anúncio oficial a apresenta como um *port* nativo, com ganho de desempenho da ordem de dez vezes sobre a 6.0.

**Portanto, o que se afirma e o que não se afirma:**

- **Afirma-se:** a 7.0 é uma mudança **tecnológica substancial** na implementação do compilador e das ferramentas que o cercam — não é um incremento de features sobre a mesma base de código.
- **Não se afirma:** que a 7.0 seja instável, defeituosa ou inadequada. Ela é uma release estável e oficialmente publicada. A REV. 0 deste documento a descrevia de forma imprecisa ("reescrita completa com ~6 semanas de vida"); a formulação foi corrigida.

**Razão central para permanecer em 6.0**, na ordem de peso aplicada:

1. **Maturidade.** A 6.0 encerra uma linhagem de implementação com anos de exposição a ecossistema real.
2. **Compatibilidade previsível do ecossistema.** Os limites **mínimos** de Prisma 7 (≥5.4), Next 16 (≥5.1) e Jest 30 (≥5.4) estão satisfeitos por ambas as linhas; o que não está estabelecido é o **teto** — nenhum dos três declara oficialmente a 7.0 como versão suportada. `V-06` mede exatamente isso, consumidor a consumidor: **Prisma 7 já medido e aprovado** (`V-06.b`); **Next 16 pendente** (`V-06.c`); Jest 30 coberto por `V-05`, também pendente.
3. **Menor risco no início do projeto.** A partida do TechLab Fisio ocorre sem uma linha de código de aplicação (§2.1); atrito de toolchain nesse momento consome o orçamento de risco que pertence ao modelo de dados.
4. **Ausência de benefício necessário ao MVP.** O ganho da 7.0 é de **velocidade de compilação**. Nenhum requisito de `docs/02`..`docs/07` depende disso, e o MVP não tem volume de código que torne o tempo de `tsc` um problema.

**Condição de reavaliação.** A linha 7.x deve ser reavaliada quando Prisma, Next.js e Jest declararem suporte oficial a ela, ou quando o tempo de compilação se tornar atrito medido — o que ocorrer primeiro. Trocar de linha é mudança de baseline e segue o rito de §15/TLF-BASE-V1 §14: impacto, alternativa, aprovação. **Não é uma decisão travada permanentemente.**

---

## 7. As seis decisões da Categoria C

Os seis itens são os **literalmente** listados na tabela "Categoria C — dependente de versão" de `docs/07` §28.2. Nenhum foi acrescentado, nenhum omitido.

> **Observação de escopo.** Os seis itens são **questões de capacidade Prisma × PostgreSQL**, não escolhas de framework. Tailwind, Jest, Playwright e Docker **não** figuram entre eles; foram tratados na baseline (§6) pela mesma disciplina, mas não são decisões da Categoria C.

### C-1 — Extensão `btree_gist`

- **Problema.** Verificar "se a versão fixada permite declarar extensões no schema ou se a criação deve viver só na migration".
- **Pesquisa.** No Prisma 7, `postgresqlExtensions` **não consta** nem na lista de Preview features ativas nem na lista de features promovidas a GA. A lista de Preview ativas é: `views`, `relationJoins`, `nativeDistinct`, `typedSql`, `strictUndefinedChecks`, `fullTextSearchPostgres`, `shardKeys`, `partialIndexes`. A documentação oficial de extensões PostgreSQL apresenta **exclusivamente** o caminho por migration customizada: "In the new migration file that was created in the `migrations` directory, add the following statement: `CREATE EXTENSION IF NOT EXISTS citext;`".
- **Opções.** (a) declarar no bloco `datasource` via `extensions` — **indisponível**; (b) `CREATE EXTENSION` manual fora do histórico — irreprodutível, quebra shadow database e CI; (c) `CREATE EXTENSION IF NOT EXISTS` na primeira migration.
- **Decisão.** **Opção (c).** A criação vive **só na migration** — não por escolha, mas porque no Prisma 7 não existe outro caminho suportado.
- **Justificativa.** É a única forma reproduzível: a migration roda no banco principal, no shadow database (que reexecuta o histórico), no `migrate reset` e no CI a partir de banco vazio, sempre na mesma ordem. `IF NOT EXISTS` a torna idempotente. `btree_gist` ser *trusted* elimina a necessidade de superusuário (§5.5, ponto 3).
- **Risco.** **Baixo.** Residual: presença do contrib na imagem — fechado por `V-01`. Se a role de migration não tiver `CREATE` no banco, a migration falha **ruidosamente** na primeira execução, não silenciosamente.
- **Classificação:** **C — migration SQL obrigatória.**

### C-2 — Coluna gerada `valor_liquido`

- **Problema.** Verificar o "nível de suporte a colunas geradas — leitura, escrita e comportamento em migração".
- **Pesquisa.** O Prisma **não suporta** colunas geradas no Prisma Schema Language: a palavra-chave `GENERATED` não é representável, e a feature request permanece aberta e não implementada. O caminho documentado é declarar o campo no schema, gerar a migration com `--create-only` e **editar o SQL** para `GENERATED ALWAYS AS (...) STORED`. Advertência oficial relevante: `@default` usa apenas a constraint `DEFAULT`, que **não** mantém o valor sincronizado em `UPDATE` — comportamento diferente de `GENERATED ... STORED`.
- **Dimensões, separadas como exige a instrução:**
  - *PostgreSQL 18* — suporta plenamente `STORED`;
  - *Prisma Schema Language* — **não** representa;
  - *Prisma Migrate* — não gera, mas **preserva** (a coluna existe; a expressão é invisível ao diff);
  - *Prisma Client* — lê normalmente; **não deve escrever**;
  - *Introspection* — não reconstrói a expressão.
- **Opções.** (a) coluna gerada `STORED` via SQL manual — recomendada por `docs/07` §19.2; (b) fallback: coluna comum + `CHECK` — rejeitada em `docs/07` na forma "persistida pela aplicação" por admitir divergência; (c) cálculo na leitura, sem coluna — declarado "fallback aceitável" em `docs/07` §19.2.
- **Decisão.** **Opção (a)** — coluna gerada `STORED`, criada por migration SQL editada, **com uma exigência adicional**: no `schema.prisma` o campo `valorLiquido` deve ser marcado como **somente leitura pela disciplina de código** e excluído de todo `create`/`update`. Um `INSERT` que tente escrever nela é rejeitado pelo PostgreSQL.
- **Justificativa.** Preserva a decisão homologada `H2.2-18`/§19.2 (fonte única, impossível divergir) e mantém o objeto **fora do alcance do diff** do Prisma — a coluna é vista como coluna comum. Se `V-02` demonstrar atrito real na geração de tipos ou nas escritas, o fallback **já está homologado** em `docs/07` §19.2 (opção c), e adotá-lo **não** exige nova homologação.
- **Risco.** **Baixo–Médio.** O risco concreto é o Prisma Client tipar o campo como escrevível e algum caminho de escrita tentar preenchê-lo. Mitigação: teste `T-FIN-GENCOL` (§14) que tenta escrever e **espera falha**.
- **Classificação:** **C — migration SQL obrigatória**, com fallback D→(c) já autorizado.

### C-3 — Preservação de objetos não representáveis

**Este é o item de maior risco (`R2.2-03`) e recebe tratamento próprio em §8 e §9.**

- **Problema.** "Se operações de diff/reset preservam índices parciais, CHECKs, exclusion constraints e triggers, ou se podem descartá-los."
- **Pesquisa.** A introspection do Prisma declara explicitamente **não suportadas**: *Check Constraints (MySQL + PostgreSQL)*, *Exclusion Constraints*, *Expression indexes*, *PostgreSQL Row Level Security*, *partitioned tables*, *deferred constraints*, *index sort order*, *comments*. Ao encontrá-las, "the Prisma CLI will surface detect usage of the feature in your database and return a warning". Triggers, funções e views (estas últimas apenas sob Preview `views`) tampouco são representáveis na Prisma Schema Language. **Reverificado em 20/08/2026:** a lista oficial de *não suportados* da introspection **não menciona** índices parciais nem triggers — a ausência é relevante e tratada abaixo e em §10.2.

**Inferência declarada como tal.** Do modelo mental do Migrate (o diff é calculado entre o **datamodel** e o estado reproduzido no shadow database) segue a expectativa de que **o que o Prisma não modela não entra no diff e, portanto, não recebe `DROP`**. Isto é uma **hipótese técnica forte**, sustentada pela documentação do mecanismo — **não** uma garantia declarada pelo fornecedor para todos os ciclos futuros de migration. Ela é tratada como hipótese em §9.2 e é medida por **`V-04`**.
- **Divisão em três classes, que é a chave da decisão:**

  | Classe | Objetos | Comportamento sob `migrate dev` |
  | --- | --- | --- |
  | **Invisíveis ao Prisma** | `CHECK`, exclusion constraints, triggers, funções, extensões, `REVOKE`, expressão de coluna gerada | **Expectativa de preservação** — não são representados, logo não se espera que entrem no diff. **Hipótese forte, confirmada por `V-04`** |
  | **Visíveis e modelados** | tabelas, colunas, tipos, FKs, enums, índices e uniques **simples** | Gerenciados normalmente pelo Prisma |
  | **Zona cinzenta — o risco real** | **índices únicos parciais** (U-03/IDX-M2, U-04/IDX-R2, IDX-A4, IDX-P2, IDX-C2, IDX-R1) | O Prisma **modela índices**; o predicado `WHERE` só é representável sob a Preview `partialIndexes`. Um índice parcial existente no banco e ausente do `schema.prisma` **pode** ser lido como índice excedente e receber `DROP` |

- **Opções.** (a) ativar a Preview `partialIndexes` — **rejeitada**: viola a regra de exclusão de §3 e `docs/07` §10.1 já veta o uso de recurso equivalente instável; (b) declarar o índice **sem** o predicado no schema e recriá-lo parcial por SQL — **rejeitada**: cria dois objetos concorrentes e o Prisma tentaria reconciliá-los a cada migration; (c) **não declarar** os índices parciais no `schema.prisma`, criá-los apenas por SQL, e **provar por guarda automatizada** que nenhuma migration futura os descarta.
- **Decisão.** **Opção (c)**, acompanhada da tríade de proteção de §9: *lint de migration* + *teste de existência e efeito* + *snapshot golden de schema*. Nenhuma delas depende de o Prisma se comportar bem — as três detectam a perda **antes do merge**.
- **Justificativa.** A instrução é explícita: "Não basta dizer 'usar migration SQL customizada'." A garantia não pode repousar sobre uma expectativa de comportamento do Prisma; repousa sobre **verificação executável**. A tríade transforma "perda silenciosa" em "falha ruidosa de CI", que é a única mitigação aceitável para um risco classificado como **crítico** em `docs/07` §26.
- **Risco.** **Médio; reduzível a Baixo pela tríade, e somente após `V-04`.** A tríade é a mitigação projetada, mas uma mitigação não exercida não é uma mitigação provada — ver §9.2.4. Residual após `V-04`: um objeto criado sem entrar no snapshot golden. Mitigado porque o snapshot é gerado de `pg_dump --schema-only` sobre o banco reconstruído, capturando **tudo**, inclusive o que ninguém lembrou de listar.
- **Classificação:** **C — migration SQL obrigatória + guarda de CI obrigatória.**

### C-4 — Transação interativa com `FOR UPDATE`

- **Problema.** "Forma suportada de executar SQL bruto dentro da transação (§17.1, §17.3)."
- **Por que é crítico.** `docs/07` §17.1 torna o *row lock* do `pacote` o mecanismo **primário** de serialização (`H2.2-05`), e §17.3 faz o mesmo para `cobranca` (`H2.2-07`). Sem `SELECT ... FOR UPDATE` dentro da transação interativa, T-01, T-02, T-03, T-04, T-05, T-06 e T-08 **não são implementáveis como homologadas**. Não existe API declarativa do Prisma Client para *row lock*.
- **Pesquisa.** As transações interativas recebem um cliente `tx` (`$transaction(async (tx) => { ... })`) sobre o qual todas as chamadas ficam encapsuladas. A documentação de raw queries afirma literalmente: **"You can use `.$executeRaw()` and `.$queryRaw()` inside a transaction."** Portanto `tx.$queryRaw` executa na **mesma** transação e o lock é adquirido e mantido até o commit. Opções relevantes: `maxWait` (padrão 2000 ms) e `timeout` (padrão 5000 ms).
- **Opções.** (a) `tx.$queryRaw` com `SELECT ... FOR UPDATE`; (b) advisory locks — já **rejeitado** por `docs/07` §17.1 ("mesma garantia, menor rastreabilidade"); (c) `SERIALIZABLE` — já **rejeitado** por `docs/07` §17.1 (custo desproporcional).
- **Decisão.** **Opção (a).** O lock é adquirido por `tx.$queryRaw` com template tag (nunca `$queryRawUnsafe`, para preservar parametrização e evitar injeção), como **primeira** operação de escrita de cada transação que toque o agregado, na ordem canônica homologada `agendamento` → `pacote` → `cobranca`.
- **Justificativa.** É o único mecanismo que expressa fisicamente a decisão homologada `H2-06`/`H2.2-05` (travar a raiz do agregado) e é oficialmente suportado. Preserva `docs/07` §17.4 passo 5 ("passo 5 antes do 8 é essencial").
- **Risco.** **Médio, operacional.** Dois pontos concretos: (i) `timeout` padrão de 5 s pode abortar transações que aguardam lock sob contenção — deve ser **configurado explicitamente**, não herdado; (ii) `R2.2-07` de `docs/07` (disciplina de lock esquecida) permanece — mitigado por concentrar as mutações de M7/M8 em um serviço por módulo e por testes de concorrência (`T-PKG-CONCURRENCY`, `T-FIN-OVERPAY`).
- **Classificação:** **B — representável com limitação** (funciona plenamente, mas por SQL bruto, fora do Client tipado).

### C-5 — Nível de isolamento por transação

- **Problema.** "Verificar disponibilidade."
- **Pesquisa.** Suportado: `$transaction(fn, { isolationLevel: ... })`. Para PostgreSQL a matriz oficial marca disponíveis `ReadUncommitted`, `ReadCommitted`, `RepeatableRead` e `Serializable` (`Snapshot` é exclusivo do SQL Server). Indisponível apenas no MongoDB.
- **Opções.** (a) manter o padrão do PostgreSQL, `READ COMMITTED`, com locks explícitos; (b) `SERIALIZABLE` global; (c) isolamento por transação, caso a caso.
- **Decisão.** **Opção (a) — `READ COMMITTED` com locks explícitos.** A capacidade existe e fica **disponível como reserva**, mas **não é usada** na baseline.
- **Justificativa.** `docs/07` §28.2 já antecipava: "A recomendação não depende disso — `READ COMMITTED` com locks explícitos é suficiente". A pesquisa **confirma** e ainda remove o argumento de indisponibilidade que poderia ter forçado a mão. `SERIALIZABLE` foi rejeitado em `docs/07` §17.1 por exigir laço de retry em toda operação — rejeição que permanece válida e agora é uma escolha informada, não uma limitação.
- **Risco.** **Baixo.** Nenhuma decisão homologada depende deste item. Se um caso futuro exigir `SERIALIZABLE`, a via está aberta e testada pelo fornecedor.
- **Classificação:** **A — disponível e representável**, deliberadamente não utilizada.

### C-6 — Mapeamento de erro por constraint

- **Problema.** "Se é possível distinguir **qual** constraint foi violada, para escolher entre resposta idempotente (consumo) e erro de conflito (agenda)."
- **Por que é crítico.** `docs/07` §18 exige comportamentos **opostos** para duas violações: `C-04` (retry de consumo) deve ser traduzido em **sucesso idempotente**; `C-01` (conflito de agenda) deve virar **erro de conflito**. Se a aplicação não souber qual constraint falhou, ou trata conflito de agenda como sucesso — corrompendo a agenda — ou trata retry como erro — quebrando a idempotência de `RN-065`. **Não há meio-termo seguro.**
- **Pesquisa.** Cobertura **desigual**, e é preciso dizer isso com precisão:

  | Violação | Código | Identificação disponível |
  | --- | --- | --- |
  | `UNIQUE` / índice único | **P2002** — "Unique constraint failed on the {constraint}" | `error.meta` traz a informação do alvo, por exemplo `{ target: [ 'email' ] }` |
  | FK | **P2003** | Nome do campo |
  | `NOT NULL` | **P2011** | Constraint |
  | **`CHECK`** | **P2004** — "A constraint failed on the database: `{database_error}`" | Genérico. A documentação **não** garante o nome da constraint em campo estruturado |
  | **Exclusion constraint** | Não documentada como código próprio | **Não coberta pela documentação de erros** |

  A documentação oficial **não** afirma que SQLSTATE (`23514` para CHECK, `23P01` para exclusion) ou o nome da constraint sejam expostos em campo estruturado. Ao mesmo tempo, o Prisma 7 exige **driver adapter** (`@prisma/adapter-pg`), de modo que o erro nasce no driver `pg` — que popula `code` (SQLSTATE) e `constraint` — e há a via alternativa de capturar a violação via `tx.$queryRaw`, onde o erro do driver tende a chegar menos encapsulado.
- **Opções.** (a) confiar em P2002 para o caso idempotente e em P2004 para o resto — **insuficiente**, pois não distingue *qual* CHECK nem trata exclusion; (b) extrair SQLSTATE/nome da constraint do erro do adapter — **provável, não documentado**; (c) **evitar a dependência**: nomear deterministicamente cada constraint crítica e desenhar o fluxo para que a distinção necessária recaia sobre **P2002 com `meta`**, que é o único caso oficialmente garantido.
- **Decisão.** **Opção (c) como projeto, (b) como reforço, e `V-03` como prova.**
  1. **Toda** constraint crítica recebe **nome explícito e determinístico** na migration SQL (`uq_movimento_sessao_consumo`, `ex_agendamento_profissional`, `ck_paciente_cpf_formato`, …) — jamais nome gerado pelo banco.
  2. A distinção que o modelo **realmente exige** — consumo duplicado (`C-04`) versus conflito de agenda (`C-01`) — recai sobre duas violações de natureza distinta: a primeira é **índice único** (P2002, com `meta`, oficialmente garantido); a segunda é **exclusion constraint**. Como as duas nunca podem ser confundidas com uma terceira, basta que P2002 seja identificável — **e ele é**.
  3. `V-03` mede, contra o PostgreSQL 18 real e o `@prisma/adapter-pg` real, **exatamente** o que chega à aplicação em cada uma das quatro violações (unique parcial, CHECK, exclusion, FK), e o resultado é registrado como tabela normativa de mapeamento.
  4. **Fallback garantido, caso `V-03` mostre que exclusion chega irreconhecível:** envolver a inserção de `agendamento` em `tx.$queryRaw` explícito, onde o erro do driver `pg` expõe `code` e `constraint`. Isso **não** altera nenhuma decisão homologada — apenas o caminho de escrita.
- **Justificativa.** Reduz-se a dependência ao único mecanismo oficialmente garantido (P2002 + `meta`), em vez de apostar em comportamento não documentado. A nomeação determinística é barata, permanente e é o que torna qualquer estratégia de mapeamento — atual ou futura — possível.
- **Risco.** **Médio até `V-03`; Baixo depois.** É a única incerteza remanescente da Categoria C, e é **fechável por teste local**, não por consulta. Por isso `V-03` é critério de aceite bloqueante de `E-12`.
- **Classificação:** **B — representável com limitação**, com verificação executável obrigatória.

### 7.1 Síntese — nenhum item ficou sem resposta

| # | Item da Categoria C | Classificação final | Decisão | Verificação pendente |
| --- | --- | --- | --- | --- |
| **C-1** | Extensão `btree_gist` | **C** | Migration dedicada, idempotente, primeira do histórico | `V-01` (presença na imagem) |
| **C-2** | Coluna gerada `valor_liquido` | **C** | `GENERATED ... STORED` por SQL editado; fallback já homologado | `V-02` |
| **C-3** | Preservação de objetos não representáveis | **C** | SQL exclusivo + tríade de proteção (§9) | `V-04` (§12) |
| **C-4** | Transação interativa com `FOR UPDATE` | **B** | `tx.$queryRaw` com `SELECT ... FOR UPDATE`; `timeout` explícito | — |
| **C-5** | Nível de isolamento por transação | **A** | Disponível; mantém-se `READ COMMITTED` + locks | — |
| **C-6** | Mapeamento de erro por constraint | **B** | Nomes determinísticos; apoio em P2002+`meta`; fallback via driver | `V-03` (bloqueante) |

**Nenhum item foi classificado como D (não utilizar).** Todos os seis têm estratégia segura e reproduzível.

---

## 8. Classificação A / B / C / D revisada — objetos do `docs/07`

Reclassificação de **todo** o modelo físico homologado contra o Prisma **7**, mantendo separadas as cinco dimensões que a instrução exige não confundir: PostgreSQL, Prisma Client, Prisma Schema Language, introspection e Prisma Migrate.

### Categoria A — representável declarativamente

| Recurso | Objetos de `docs/07` |
| --- | --- |
| Tabelas, colunas, obrigatoriedade, defaults | Todo o catálogo §7 |
| Tipos nativos `uuid`, `timestamptz`, `date`, `time`, `numeric(12,2)`, `jsonb` | §5, §24.1 |
| Enums nativos | §5, §6.1 |
| FKs e `ON DELETE RESTRICT/NO ACTION` | §9.2 — todas |
| `@unique` / `@@unique` **simples** | U-01, U-02, U-05, U-06, U-07, U-08, U-09, U-10, U-11, U-12, **U-13** |
| `@@index` **simples** | IDX-A3, A5, A6, M1, P1, C1, F1, F2, F3, N1, **N2**, N3, **N4**, U1, U2, U3, S1 |
| Nível de isolamento (C-5) | disponível, não utilizado |

**Confere integralmente com a Categoria A de `docs/07` §28.2.** Nenhum objeto saiu, nenhum entrou.

### Categoria B — representável com limitação

| Recurso | Objetos | Limitação |
| --- | --- | --- |
| `SELECT ... FOR UPDATE` | §17.1, §17.3 — T-01..T-08 | Só por SQL bruto (`tx.$queryRaw`), fora do Client tipado (C-4) |
| Mapeamento de erro | §16.4, §18 `C-01`/`C-04` | P2002 garantido; CHECK genérico; exclusion não documentada (C-6) |
| Coluna gerada — **leitura** | `cobranca.valor_liquido` | Client lê; não deve escrever (C-2) |

### Categoria C — migration SQL obrigatória

| Recurso | Objetos | Motivo verificado |
| --- | --- | --- |
| **Índices únicos parciais** | U-03/IDX-M2, U-04/IDX-R2, IDX-A4, IDX-P2, IDX-C2, IDX-R1 | Predicado só sob Preview `partialIndexes` — **excluída** por §3. **Zona cinzenta de C-3** |
| **`CHECK` constraints** | Todas de §10.2, incluindo **RN-042** e o CPF de §11.4.1 | Não representável; introspection declara *não suportado* |
| **Exclusion constraints** | IDX-A1, IDX-A2 | Não representável; introspection declara *não suportado* |
| **Triggers** | Imutabilidade condicional de `registro_clinico` e `retificacao_clinica` (§22.2) | Fora do PSL |
| **Privilégios (`REVOKE`)** | `evento_auditoria`, `movimento_sessao`, `pagamento`, `estorno`, `historico_agendamento` | Fora do PSL; exige separação de roles |
| **Extensão `btree_gist`** | pré-requisito de IDX-A1/A2 | `postgresqlExtensions` inexistente no Prisma 7 (C-1) |
| **Coluna gerada — criação** | `cobranca.valor_liquido` | `GENERATED` não representável (C-2) |
| **Restrição de clínica única** | `clinica` | Índice sobre expressão constante ou CHECK — expression indexes declarados *não suportados* |

### Categoria D — não utilizar

| Recurso | Motivo |
| --- | --- |
| Preview `partialIndexes` | Preview; proibido por §3. Os índices parciais existem, mas por SQL |
| Preview `views` | `docs/07` §6 deriva estados sob demanda; view é evolução futura (`R2.2-08`), não MVP |
| Preview `typedSql`, `relationJoins`, `nativeDistinct`, `strictUndefinedChecks`, `fullTextSearchPostgres`, `shardKeys` | Preview; nenhum é exigido por `docs/07` |
| `NULLS NOT DISTINCT` | **Vetado por `docs/07` §10.1** — decisão homologada preservada |
| Prisma 8 | Early Access |
| PostgreSQL 19 | Beta |
| `prisma db push` como evolução de schema | §10, ponto 9 |

**Nenhum objeto homologado do `docs/07` caiu na Categoria D.** Tudo o que foi homologado é implementável.

---

## 9. Risco principal — preservação de objetos SQL customizados

Resposta direta à pergunta obrigatória: **depois de adicionarmos objetos não representáveis, quais operações do Prisma podem preservá-los, ignorá-los, detectar drift ou gerar alterações destrutivas?**

### 9.1 Comportamento operação a operação

> **Como ler esta tabela.** As colunas separam **fato documentado** de **expectativa**. Onde a documentação oficial descreve o comportamento, a célula o cita. Onde a conclusão decorre do mecanismo mas não é declarada pelo fornecedor, a célula diz **"esperado"** — e a prova é `V-04`. Nenhuma linha desta tabela deve ser lida como garantia contratual do Prisma.

| Operação | Objetos **invisíveis** (CHECK, exclusion, trigger, REVOKE, extensão, expressão de coluna gerada) | Objetos da **zona cinzenta** (índices parciais) | Veredito de segurança |
| --- | --- | --- | --- |
| `prisma migrate dev` | **Preservação esperada** — não são representados, logo não se espera que entrem no diff (hipótese; `V-04`) | **Risco.** Índice presente no shadow e ausente do `schema.prisma` pode ser lido como excedente | ⚠ **Exige guarda** |
| `prisma migrate dev --create-only` | Preservação esperada; e o SQL gerado fica disponível para revisão **antes** de tocar o banco — esta é a parte que **não** depende de hipótese | Mesmo risco, porém **visível na revisão** | ✔ **Modo obrigatório** |
| `prisma migrate deploy` | **Fato documentado.** Só aplica migrations pendentes; a documentação afirma que **não** detecta drift e **não** usa shadow database, não reseta e não gera artefatos | Preservados pelo mesmo motivo | ✔ **Seguro** |
| `prisma migrate diff` | Não gera DDL para o que não modela | Pode reportar diferença | ✔ **Seguro (só leitura)** — é a ferramenta de alarme |
| `prisma db pull` | **Fato documentado.** Sobrescreve o arquivo: *"The command will overwrite the current `schema.prisma` file… Some manual changes or customization can be lost"*. CHECK, exclusion e expression indexes constam da lista oficial de **não suportados** pela introspection e não são reconstruídos. Certas customizações **são** preservadas (ordem de blocos, comentários, `@map`, nomes de `@relation`) — salvo com `--force`, que as descarta | Predicado **é** reconstruído — mas ao custo de a introspection **acrescentar automaticamente `partialIndexes` às `previewFeatures`** (§10.2) | ⛔ **Fora do fluxo normal** — ver política em §10.2 |
| `prisma db push` | Sem histórico de migration, **o objeto simplesmente não existe** no banco resultante | Idem | ⛔ **Proibido** |
| `prisma migrate reset` | **Recriados** — reexecuta todo o histórico, e o SQL customizado está nele. "Resetting drops and recreates the database, which results in data loss" | Recriados | ✔ Seguro em dev; ⛔ **jamais** fora de dev |
| **Shadow database** | **Recriados** — "reruns the current, existing migration history". É por isso que `btree_gist` está disponível lá | Recriados | ✔ **Aliado**, não ameaça |
| **Introspection** | Não reconstrói | Não reconstrói predicado | ⛔ Não é fonte de verdade |
| **Migrations subsequentes** | Preservadas, desde que ninguém rode `db pull` para "atualizar" o schema | **Ponto de perda mais provável** | ⚠ **Exige guarda** |

### 9.2 Conclusão sobre o risco `R2.2-03` — separada em fato, hipótese e verificação

Esta seção é deliberadamente dividida em três níveis de certeza. **A conclusão desta análise reduz `R2.2-03`, mas não o encerra.**

#### 9.2.1 Fato documentado

Sustentado por documentação oficial consultada em 20/08/2026:

1. **Limitações de modelagem e de introspection são reais e declaradas.** `CHECK` constraints, exclusion constraints e expression indexes constam **nominalmente** da lista oficial de recursos **não suportados** pela introspection do Prisma. Triggers, funções e colunas `GENERATED` não são representáveis na Prisma Schema Language. Não há `postgresqlExtensions` no Prisma 7.
2. **SQL customizado é, portanto, obrigatório** para esses objetos — não é preferência de estilo. O caminho oficialmente documentado é `--create-only` → editar o SQL → aplicar → versionar.
3. **`prisma migrate deploy` não detecta drift e não usa shadow database**, e aplica somente migrations pendentes. É o único comando autorizado fora de desenvolvimento (§10, ponto 8).
4. **`prisma db pull` sobrescreve o `schema.prisma`** e pode perder customizações — declarado literalmente pela documentação do CLI.
5. **Índices parciais são modeláveis apenas sob a Preview `partialIndexes`** (desde 7.4.0), excluída da baseline por §3.

#### 9.2.2 Hipótese técnica forte

Decorre do mecanismo documentado, **mas não é uma garantia declarada pelo fornecedor**:

> Objetos que a Prisma Schema Language não representa tendem a **não participar** dos diffs declarativos do Prisma Migrate e, por consequência, tendem a sobreviver a migrations subsequentes.

A hipótese é bem fundamentada: o diff é calculado entre o *datamodel* e o estado reproduzido no shadow database, e um objeto ausente do *datamodel* não tem contraparte a ser reconciliada. **Ela não é, porém, um compromisso de compatibilidade do Prisma para todos os ciclos futuros de migration**, e a baseline não a trata como tal.

Três consequências dessa hipótese, igualmente classificadas como hipótese:

- o grosso dos objetos críticos (CHECK, exclusion, triggers, `REVOKE`, extensão) é **estruturalmente mais seguro** do que `docs/07` supunha;
- o risco **concentra-se** em dois pontos e não em toda a superfície: (i) índices parciais, porque índices *são* modelados; (ii) `db pull`, que sobrescreve o schema;
- `migrate reset` e o shadow database atuam como **aliados**, porque recriam o banco reexecutando o histórico versionado e assim exercitam continuamente a auto-suficiência dele.

#### 9.2.3 Verificação empírica obrigatória — `V-04`

**`V-04` permanece obrigatória e bloqueante.** Ela mede a **sobrevivência efetiva** dos objetos SQL customizados ao **workflow real de migrations planejado para este projeto** — não a um cenário genérico. Nenhuma evidência documental substitui essa medição, porque a evidência documental descreve o que o Prisma *não modela*, e não o que o Prisma *garante preservar*.

#### 9.2.4 Situação normativa de `R2.2-03`

> **`R2.2-03` pode ser reduzido por evidência documental, mas não pode ser considerado definitivamente encerrado antes de `V-04`.**

| Momento | Severidade de `R2.2-03` | Base |
| --- | --- | --- |
| Em `docs/07` (antes desta análise) | **Crítico**, aberto | Nenhuma verificação realizada |
| Após esta análise documental (REV. 1) | **Reduzido — Médio**, ainda **aberto** | Fatos de §9.2.1 + hipótese de §9.2.2 |
| Após `V-04` aprovada e a tríade de §9.3 em CI (`E-16`) | **Baixo**, encerrável | Medição executada + guardas ativas |

**Enquanto `V-04` não for executada, nenhuma seção deste documento pode declarar `R2.2-03` fechado.**

### 9.3 Workflow operacional seguro e reproduzível

Não basta "usar migration SQL customizada". A garantia é a **tríade**, e nenhuma das três depende de o Prisma se comportar bem:

**Guarda 1 — Lint de migration (barato, roda em toda alteração).**
Script que varre `prisma/migrations/**/migration.sql` e **falha** se qualquer migration diferente da que criou o objeto contiver `DROP INDEX`, `DROP CONSTRAINT`, `DROP TRIGGER` ou `DROP EXTENSION` referente a um nome da **lista de objetos protegidos** (nomes determinísticos de C-6), sem uma anotação `-- INTENCIONAL:` acompanhada de justificativa. Converte remoção acidental em falha de CI **antes do merge**.

**Guarda 2 — Testes de existência e de efeito (`H2.2-18`).**
Para cada objeto crítico, **dois** testes: um consulta o catálogo do sistema e afirma que o objeto **existe** com o nome esperado; outro tenta a operação proibida e **espera falha**. `docs/07` §28.2 é explícito: "O teste é a proteção contra perda silenciosa." Existência sem efeito não prova nada — um índice pode existir e não ser único.

**Guarda 3 — Snapshot golden de schema (a rede que pega o que ninguém listou).**
Após reconstruir o banco do zero, gerar `pg_dump --schema-only --no-owner --no-privileges` e comparar com um artefato versionado. Qualquer divergência — inclusive em objetos que ninguém lembrou de proteger — falha o CI. Atualizar o golden é ato **deliberado e revisável** no diff do PR.

**Alarme complementar — drift em ambiente real.**
`prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code` no CI: código de saída 2 significa que `schema.prisma` e histórico divergiram. É alarme, não correção.

**Regras de disciplina que fecham o workflow:**

1. `prisma db pull` **não integra o fluxo normal**. Política completa e vinculante em **§10.2**.
2. `prisma db push` **proibido** em qualquer ambiente.
3. Nenhuma alteração de schema aplicada manualmente no banco. Toda mudança nasce em migration.
4. Toda migration que toque objeto protegido nasce com `--create-only` e é revisada por humano.
5. Fora de desenvolvimento, apenas `prisma migrate deploy`.

---

## 10. Política de migrations — validação ponto a ponto

Os dez pontos propostos, confirmados, corrigidos ou refinados contra documentação oficial:

| # | Ponto proposto | Veredito | Fundamento |
| --- | --- | --- | --- |
| 1 | `schema.prisma` representa tudo que conseguir de forma estável | **CONFIRMADO com refinamento** | "De forma estável" **exclui Preview**. Consequência: índices parciais **não** são declarados (C-3). Refinamento: o schema representa a Categoria A; a Categoria C vive só em SQL |
| 2 | Migrations são artefatos oficiais e versionados | **CONFIRMADO** | O histórico é uma das quatro fontes de verdade do modelo mental do Migrate |
| 3 | Recursos não representáveis via `--create-only` | **CONFIRMADO** | Caminho oficial: gerar sem aplicar → editar → aplicar → versionar |
| 4 | O SQL gerado é revisado | **CONFIRMADO e reforçado** | É a única etapa em que um `DROP` indevido é visto por humano. **Guarda 1 automatiza a revisão** |
| 5 | SQL PostgreSQL necessário acrescentado explicitamente | **CONFIRMADO com exigência adicional** | **Todo objeto recebe nome determinístico** (C-6). Sem isso não há lint, teste de existência nem mapeamento de erro |
| 6 | Migration validada em banco descartável | **CONFIRMADO** | É o que `migrate reset` faz em dev, e o que o service container do CI faz por construção |
| 7 | A sequência funciona a partir de banco vazio | **CONFIRMADO — e é o teste central** | Prova que o histórico é auto-suficiente, incluindo `CREATE EXTENSION`. Etapa `E-15` |
| 8 | `migrate deploy` em ambientes não locais | **CONFIRMADO** | "Applies pending migrations only… does not detect drift, reset the database, generate artifacts, or use a shadow database". **Refinamento obrigatório:** `migrate dev` "is unsupported in non-interactive environments (Docker, Node scripts, bash shells)" — não é preferência, é impedimento técnico |
| 9 | `db push` não é mecanismo normal de evolução | **CONFIRMADO e endurecido para proibição** | `db push` "skips migration history verification"; possui `--accept-data-loss` e `--force-reset`. Sem histórico, os objetos da Categoria C **não existem**. Passa de "não usar normalmente" a **proibido** |
| 10 | Testes automatizados verificam invariantes dependentes de SQL customizado | **CONFIRMADO — é `H2.2-18`** | Refinamento: **existência + efeito** (Guarda 2), mais o snapshot golden (Guarda 3) |

### 10.1 Dois pontos que a política proposta não previa

| # | Acréscimo | Motivo |
| --- | --- | --- |
| **11** | **`prisma db pull` fora do fluxo normal** | Ausente da política proposta e é **o maior vetor de perda**: sobrescreve o `schema.prisma`, e CHECK, exclusion e expression indexes são declaradamente não suportados na introspection. Política detalhada em **§10.2** |
| **12** | **Seed e variáveis de ambiente são passos explícitos** | Mudança de comportamento do Prisma 7: "Seeding no longer runs automatically with migrations" e "Environment variables no longer load automatically". Um plano herdado do Prisma 6 falharia silenciosamente aqui |

### 10.2 Política de introspection (`prisma db pull`) — normativa

Reescrita na REV. 1 após revalidação do comportamento oficial vigente (CLI reference, *Introspection* e *Indexes*, consultados em 20/08/2026).

#### 10.2.1 Comportamento oficial verificado

| Aspecto | Comportamento documentado |
| --- | --- |
| Efeito no arquivo | Sobrescreve o `schema.prisma`: *"The command will overwrite the current `schema.prisma` file… Some manual changes or customization can be lost"*. A documentação recomenda versionar ou fazer cópia **antes** de executar |
| Preservação parcial | Em bancos relacionais, uma reintrospection **preserva** ordem dos blocos de modelo, comentários, atributos `@map` e nomes customizados de `@relation` |
| `--force` | **Descarta** as modificações manuais e gera o schema **exclusivamente** a partir do que foi introspectado |
| `--print` | **Existe e continua disponível.** Imprime o schema resultante no terminal **em vez de** escrever no sistema de arquivos |
| Recursos não suportados | CHECK constraints, exclusion constraints, expression indexes, RLS, tabelas particionadas, deferred constraints, *index sort order* e comentários **não são reconstruídos**; o CLI emite aviso e insere comentários nos modelos afetados |
| **Índices parciais** | **São** reconstruídos — e a introspection **acrescenta automaticamente `partialIndexes` às `previewFeatures`** do generator, representando o predicado por `raw()` na forma **normalizada pelo banco**, que pode diferir do SQL originalmente escrito |

#### 10.2.2 Consequência para a baseline do TechLab Fisio

O último item é decisivo e **não existia na análise da REV. 0**. Uma introspection executada contra o banco do projeto **não é apenas lossy — ela é ativamente contrária a uma decisão de baseline**: introduziria no `schema.prisma` versionado uma **Preview Feature** que §3 excluiu deliberadamente e que a Categoria D de §8 registra como "não utilizar". O resultado seria um schema que **só valida com Preview habilitada**, revertendo por efeito colateral uma decisão tomada por escrito.

Isso soma-se ao vetor de perda já conhecido — CHECK, exclusion constraints e expression indexes simplesmente desaparecem do schema — e converte `db pull` de "comando arriscado" em "comando que altera a baseline sem passar pelo rito de §15".

#### 10.2.3 Política

> **`prisma db pull` não integra o fluxo normal de desenvolvimento e de migrations do TechLab Fisio.** A fonte de verdade do modelo é o par `schema.prisma` + histórico de migrations versionado, nunca o estado introspectado do banco.

Regras vinculantes:

1. **Nenhum script de `package.json`** expõe `db pull`. Ele não pode ser executado por conveniência nem por engano de autocompletar.
2. **Uso excepcional exige intenção explícita** e uma justificativa registrada no PR. Não há caso de uso rotineiro.
3. **Primeiro, sempre a operação não destrutiva.** Qualquer investigação começa **obrigatoriamente** por `prisma db pull --print`, que imprime o resultado sem tocar o sistema de arquivos. Inspecionar é permitido; sobrescrever é o que requer decisão.
4. **Nenhuma sobrescrita do `schema.prisma` versionado.** Se, após o `--print`, houver motivo real para materializar o resultado, ele vai para um arquivo descartável, fora do caminho versionado, e é comparado por **diff explícito** contra o `schema.prisma` vigente. O diff é o artefato revisado — não o arquivo gerado.
5. **`--force` é proibido.** Ele descarta justamente as customizações que a preservação parcial protegeria, sem nenhum ganho para investigação.
6. **Qualquer resultado que exija ou introduza `previewFeatures` é rejeitado por definição** — com destaque para `partialIndexes`. Habilitar Preview na baseline é mudança sujeita a §3 e a TLF-BASE-V1 §14, e não pode ocorrer como efeito colateral de um comando de leitura.
7. **A guarda de CI é o backstop.** Se, apesar de tudo, uma introspection contaminar o `schema.prisma`, o alarme `migrate diff --exit-code` e o snapshot golden (Guarda 3, §9.3) acusam a divergência antes do merge. A política é a primeira linha; a guarda é a última.

**Racional da política ser conservadora e não meramente cautelosa:** a introspection é o único comando do fluxo Prisma capaz de **degradar o artefato versionado a partir do ambiente**, invertendo a direção de autoridade que §10 estabelece. Um comando com essa propriedade não pertence a um fluxo normal, mesmo quando executado corretamente.

---

## 11. Divergências encontradas contra `docs/07`

Conforme exigido, nenhuma correção silenciosa. Três divergências, **nenhuma delas conflita com a Base Imutável** e **nenhuma altera decisão homologada**.

### DIV-01 — Justificativa dos índices parciais

- **Afirmação em `docs/07` §28.2 (Categoria B):** índices únicos parciais exigem SQL porque "O schema declarativo não aceita predicado em índice".
- **Achado:** o Prisma **aceita** predicado desde a v7.4.0, com `@@index([...], where: ...)` e `@@unique([...], where: ...)`, para PostgreSQL — **mas apenas sob a Preview `partialIndexes`**.
- **Classificação:** **mudança de versão** (a capacidade passou a existir depois da redação de `docs/07`), não erro factual do modelo.
- **Impacto:** **nenhum sobre a conclusão.** Os índices parciais continuam em migration SQL, porque §3 proíbe Preview em baseline. **Mas o impacto sobre o risco é real e para pior**, em duas frentes: (i) como o Prisma agora *modela* índices parciais, eles saem da classe "invisível" e entram na **zona cinzenta** de C-3; (ii) a introspection passa a **acrescentar `partialIndexes` às `previewFeatures` automaticamente** ao encontrá-los no banco — razão adicional, verificada na REV. 1, para a política restritiva de §10.2. Ou seja: o motivo mudou, a conclusão não, e o risco **aumentou**.
- **Correção proposta:** na eventual REV. 3 de `docs/07`, trocar o "por quê" da linha para: *"predicado disponível apenas sob Preview `partialIndexes`; excluído da baseline pela política de versões — ver `docs/08` §3 e C-3"*. **Não urgente**, pois não altera nenhuma decisão.
- **Decisão afetada e interrompida:** nenhuma.

### DIV-02 — `postgresqlExtensions` não existe no Prisma 7

- **Afirmação em `docs/07` §28.2 (Categoria C, item 1):** formula a questão como "**se** a versão fixada permite declarar extensões no schema **ou** se a criação deve viver só na migration" — corretamente, como pergunta aberta.
- **Achado:** no Prisma 7 não há `postgresqlExtensions` nem entre as Preview ativas nem entre as promovidas a GA. A alternativa "declarar no schema" **não existe**.
- **Classificação:** **limitação de ferramenta**, com resposta determinada.
- **Impacto:** elimina uma das duas alternativas. **`H2.2-06` permanece integralmente satisfeita** pela via da migration (§5.5).
- **Correção proposta:** registrar em REV. 3 que o item está **fechado** por `docs/08` C-1. Nenhuma decisão interrompida.

### DIV-03 — Conflito estrutural fora do escopo de `docs/07`: ESM

- **Afirmação:** `docs/07` não trata do assunto — corretamente, pois é decisão de aplicação, não de persistência.
- **Achado (reverificado em 20/08/2026):** o **Prisma 7 exige ESM** ("Prisma ORM now ships as an ES module"; `"type": "module"` obrigatório; CommonJS não suportado) e **exige driver adapter**. O NestJS 11 é CommonJS por padrão; ESM é viável (`module`/`moduleResolution` `node16`/`nodenext`, decorators via SWC com `legacyDecorator` e `decoratorMetadata`), mas exige configuração deliberada. A linha NestJS **12**, que move o core para ESM, **continua não lançada** — existe apenas como PR de release com previsão ~Q3/2026 e pacotes de pré-visualização sob a tag `next`. Não pode ser baseline.
- **Classificação:** **conflito estrutural** entre duas tecnologias que a Base Imutável §9 manda usar juntas.
- **Impacto:** **não afeta `docs/07`, não afeta nenhuma decisão homologada e não bloqueia a implementação física da persistência** — o pacote de banco não depende do NestJS (§13, `E-01`). Afeta a Fase 3 (backend).
- **Encaminhamento — atualizado na REV. 1:** o conflito está **resolvido**. A decisão consolidada é `D-ESM-01` (§16): **backend e workspace de banco em ESM desde a criação; não se aguarda o NestJS 12.** A antiga pendência `D-PEND-01` está **encerrada** e não figura mais em §19. Permanece apenas `R-BL-02`, agora restrito ao **esforço de configuração** e à sua **validação durante a implementação** — não mais a uma escolha em aberto.
- **Conflito com a Base Imutável?** **Não.** TLF-BASE-V1 §9 nomeia Prisma e NestJS sem prescrever formato de módulo. Nenhuma alternativa incompatível está sendo proposta.

> **As duas divergências abaixo foram encontradas durante a execução de `E-07` (REV. 5).** Ambas são **internas a `docs/07`** — tensões entre seções do mesmo documento — e nenhuma delas altera regra de negócio. Estão registradas aqui, e não resolvidas silenciosamente, para decisão do revisor.

### DIV-04 — `movimento_sessao.chave_idempotencia`: `U` em §14, ausente da lista de unicidades

- **Afirmação A (`docs/07` §14).** A tabela de `movimento_sessao` declara a coluna como **`text ∅ U`**, com o motivo explícito "comandos de ajuste repetidos (C-06)".
- **Afirmação B (`docs/07` §10.1 e §13 `E-07` deste documento).** A lista numerada de unicidades vai de U-01 a U-13 e **não** inclui esta coluna. U-09/U-10 cobrem apenas `pagamento` e `estorno`.
- **Afirmação C (`docs/07` §10-A).** O catálogo de índices declara: *"As chaves primárias e as unicidades de §10.1 já criam índices e não são repetidas."* Logo, toda unicidade do modelo deve constar de §10.1 **ou** de §10-A. `movimento_sessao` tem apenas IDX-M1 e IDX-M2; **nenhum** sobre `chave_idempotencia`.
- **Afirmação D (`docs/07` §18).** A matriz que declara **quem garante** cada ponto de concorrência mapeia **C-06** para *"`chave_idempotencia` única em **`pagamento` e `estorno`**"*. A seção que existe justamente para dizer onde a chave única vive nomeia duas tabelas, e `movimento_sessao` não é uma delas.
- **Afirmação E (`docs/07` §24.2).** A especificação transacional lista, para **T-03**, a garantia "`chave_idempotencia`", e para **T-04**, "`UNIQUE(pagamento_id)`". Para **T-06 — Ajuste de sessão**, lista *"lock do pacote; verificação **H2-10** antes do insert"* — e nada mais. A transação que usaria a chave não a invoca.
- **Afirmação F (`docs/07` §28.2, Categoria A).** A enumeração do que o schema declarativo cobre é fechada: "U-01, U-02, U-05, U-06, U-07, U-08, U-09, U-10, U-11, U-12, U-13".
- **Erro de escopo na própria Afirmação A.** `docs/06` §13 define **C-06 = "Comando duplicado pagamento/estorno", módulo M8**. `movimento_sessao` é **M7**. O ponto de concorrência de M7 para ajustes é **C-09/H2-10**, cuja propriedade é `saldo_de_direito ≥ reservas_ativas`, garantida por **transação com lock** — não por unicidade. O ponto de idempotência que toca `movimento_sessao` é **C-04** (retry de finalização/consumo), garantido pelo **índice único parcial IDX-M2/U-03**, que pertence a `E-10`. **RN-065** diz "transacionais/idempotentes **quando necessário**" e exemplifica agenda, finalização/consumo e pagamentos — ajuste de sessão não é citado; é autorização condicional, não prescrição de constraint física.
- **Natureza.** Tensão interna a `docs/07`: **cinco seções excluem a unicidade contra uma célula de tabela que a afirma**, e essa célula cita um identificador (`C-06`) definido para outro módulo. A leitura de que o `U` de §14 é **resíduo editorial** é a única que não exige supor cinco omissões independentes.
- **DECISÃO DE BRUNO (revisão pré-versionamento): REMOVER.** A unicidade **não** é criada. A **coluna permanece** — ela é homologada por §14 e continua disponível para idempotência na camada de aplicação. Constava da implementação inicial (`movimento_sessao_chave_idempotencia_key`) por justificativa que a revisão independente demonstrou incorreta, e foi retirada antes de qualquer versionamento.
- **Pendência editorial aberta.** `docs/07` §14 continua marcando a coluna como `U` e citando C-06. A correção desse texto é **ato editorial sobre documento homologado**, a cargo de Bruno, e foi remetida a `E-18`. Enquanto não ocorrer, existe divergência **conhecida e deliberada** entre `docs/07` §14 e o schema físico — registrada aqui exatamente para não ser uma perda silenciosa. **Nenhum `U-14` foi criado:** criar identificação normativa nova exigiria alterar §10.1, §18 e §28.2, o que esta tarefa não faz.

### DIV-05 — IDX-R3: índice simples de §10-A ausente da enumeração de `E-07`

- **Afirmação A (`docs/07` §10-A).** IDX-R3 é `btree (agendamento_id)` sobre `reserva_sessao`, justificado por "encerramento em T-08; histórico" (RN-036, RN-037). **Não é parcial.**
- **Afirmação B (`docs/07` §28.2).** A enumeração da **Categoria A** lista "IDX-A3, A5, A6, M1, P1, C1, F1, F2, F3, N1, N2, N3, N4, U1, U2, U3, S1" — **IDX-R3 não aparece**. A **Categoria B** lista como parciais "IDX-M2, IDX-R2, IDX-A4, IDX-P2, IDX-C2, **IDX-R1**" — **IDX-R3 também não aparece**. O índice está ausente das **duas** categorias, o que caracteriza **omissão**, não classificação deliberada.
- **Origem da divergência — correção da REV. 5.** A linha "Ação" de `E-07` neste documento é **cópia verbatim** da enumeração de `docs/07` §28.2 Categoria A. A REV. 5 caracterizou `DIV-05` como "tensão interna a este documento"; a revisão independente demonstrou que **a omissão nasce em `docs/07` §28.2** e foi apenas herdada por `docs/08`. O "Critério de aceite" de `E-07` ("todos os índices de §10-A **exceto** os parciais") permanece a formulação correta, e **inclui** IDX-R3. IDX-F4, o outro não-parcial ausente de §28.2, **está** coberto por ser a unicidade U-05.
- **Natureza.** Tensão interna a `docs/07`, entre §10-A — **catálogo normativo** do que existe — e §28.2 — **classificação de representabilidade no Prisma**, cuja finalidade é dizer *como* implementar, não *o que* existe. Prevalece §10-A.
- **Não é redundante.** IDX-R2 (`E-10`) é único **parcial** `WHERE encerrada_em IS NULL`: cobre apenas reservas ativas. O uso declarado de IDX-R3 é **histórico** (RN-036, RN-037), que inclui reservas encerradas. O PostgreSQL não cria índice automático para FK. Nenhum outro objeto o cobre.
- **DECISÃO DE BRUNO (revisão pré-versionamento): IMPLEMENTAR em `E-07`.** Criado como `@@index([agendamentoId])` em `ReservaSessao` → `reserva_sessao_agendamento_id_idx`. Com ele, `E-07` passa a cobrir **18** objetos de §10-A — 17 índices simples mais IDX-F4, que é a unicidade U-05.
- **Pendência editorial aberta.** A inclusão de IDX-R3 na Categoria A de `docs/07` §28.2 é **ato editorial sobre documento homologado**, a cargo de Bruno, remetido a `E-18`.

---

## 12. Verificações executáveis exigidas antes da implementação

Cada uma é fechável **por teste local**, sem consulta a Bruno.

| ID | Verificação | Como | Fecha | Bloqueante de |
| --- | --- | --- | --- | --- |
| **V-01** | `btree_gist` presente e instalável na imagem `postgres:18-bookworm` por role não-superusuário com `CREATE` | Subir o container; `CREATE EXTENSION btree_gist;` com a role de migration; criar uma `EXCLUDE` de teste com `uuid WITH =` e `tstzrange WITH &&` | C-1 ponto 4; `H2.2-06` | **`E-04`** |
| **V-02** | Coluna gerada `STORED`: leitura pelo Client, recusa de escrita, sobrevivência a migration subsequente | Migration com `GENERATED ALWAYS AS ... STORED`; ler via Client; tentar escrever e esperar erro; gerar migration seguinte e conferir que a expressão sobrevive | C-2 | `E-08` |
| **V-03** | **Forma exata do erro** em quatro violações: unique parcial, CHECK, exclusion, FK — sob `@prisma/adapter-pg` | Provocar cada violação; capturar o objeto de erro completo (código Prisma, `meta`, e `code`/`constraint` do driver); publicar tabela normativa de mapeamento | **C-6** | **`E-12`** |
| **V-04** | **Sobrevivência dos objetos SQL customizados ao workflow real de migrations do projeto** | Após criar todos os objetos, alterar uma tabela **não relacionada**, rodar `migrate dev --create-only` e inspecionar o SQL gerado em busca de qualquer `DROP` de objeto protegido — com atenção especial aos índices parciais; mais o teste negativo de §12.2 | **C-3 / `R2.2-03`** — reduz, **não encerra sem execução** | **`E-16`** |
| **V-05** | Jest 30 executando testes de integração em pacote ESM que importa o Prisma Client ESM | Suíte mínima com um `import` do Client gerado, rodando contra o Postgres do compose | `R-BL-04` | `E-13` |
| **V-06** | TypeScript 6.0 aceito por Prisma 7 e Next 16 como **teto** (não só como mínimo); e valor efetivo do npm da linha Node 24 | Executada em **três subchecks** (§12.2): **`V-06.a`** — `node -v`/`npm -v` na máquina alvo, `packageManager` registrado do valor real, TypeScript 6.0.x resolvido no workspace e configuração ESM/strict válida; **`V-06.b`** — `tsc --noEmit` sobre o Prisma Client **gerado**; **`V-06.c`** — TypeScript 6.0.x sobre **Next.js 16** efetivamente instalado. `V-06` só é **integralmente APROVADA** com os três | `R-BL-03`; `packageManager` | **`V-06.a` → `E-01`; `V-06.b` → `E-03`; `V-06.c` → scaffold do frontend (fora deste plano)** |

**`V-01`, `V-03` e `V-04` são bloqueantes.** As três fecham condições homologadas ou riscos críticos.

### 12.1 Estado de execução — registro vivo

> **Esta seção é atualizada a cada etapa executada.** Ela substitui, como fonte corrente, a declaração estática que vigorou até a REV. 3 ("nenhuma verificação foi executada"), verdadeira enquanto nenhuma etapa física existia e **superada pelos fatos** a partir de `E-01`. Nenhuma verificação pode ser marcada como concluída sem evidência de execução; a consolidação documental final continua pertencendo a `E-18`.

| ID | Estado | Onde foi executada | Observação |
| --- | --- | --- | --- |
| **`V-01`** | **APROVADA** — 20/08/2026 | `E-02` | `btree_gist` instalada por `tlf_migrator` (**não superusuário**) na imagem `postgres:18-bookworm`; `EXCLUDE USING gist (uuid WITH =, tstzrange WITH &&)` criada, exercitada nos dois sentidos e derrubada. **Fallback `postgresql-contrib` não foi necessário.** Fecha também o ponto 4 de §5.5 |
| **`V-02`** | **APROVADA** — 21/08/2026 | `E-08` | Catálogo: `is_generated = ALWAYS`, `pg_attribute.attgenerated = 's'` (STORED), expressão `(valor_bruto - valor_desconto)`, `numeric(12,2) NOT NULL`. Cálculo `300,00 − 45,50 = 254,50` sem a aplicação informar o campo; `UPDATE` do desconto recalculou para `179,75` e o valor anterior **não** permaneceu persistido. Escrita explícita rejeitada com **428C9** nos três caminhos (`create`, `update`, SQL cru). Expressão sobrevive ao replay do histórico do zero. **Estratégia principal mantida; fallback não acionado** |
| `V-03` | **PENDENTE** | `E-12` | — |
| `V-04` | **PENDENTE** | `E-16` | Enquanto pendente, `R2.2-03` e `R-BL-05` **não** podem ser declarados fechados |
| `V-05` | **PENDENTE** | `E-13` | — |
| **`V-06`** | **PARCIALMENTE APROVADA** | `E-01` + `E-03` | `V-06.a` **APROVADA** em `E-01`; `V-06.b` **APROVADA** em `E-03`; **`V-06.c` PENDENTE** — ver §12.2 |

**Consequência sobre `R-BL-03`:** o risco fica **reduzido, não encerrado**. O teto do TypeScript 6.0 está medido contra o Prisma 7 e **não** contra o Next.js 16.

> **Atualização REV. 5.** A execução de `E-04`..`E-07` **não alterou o estado de nenhuma verificação**. `V-02`, `V-03`, `V-04` e `V-05` permanecem **PENDENTES** — suas etapas (`E-08`, `E-12`, `E-16`, `E-13`) não foram iniciadas. `V-06.c` permanece **PENDENTE** e `V-06`, **PARCIALMENTE APROVADA**: nenhum `apps/web` foi criado, e criá-lo para antecipar a medição continua **não autorizado**. Enquanto `V-04` estiver pendente, `R2.2-03` e `R-BL-05` **continuam abertos**. As validações executadas em `E-04`..`E-07` (`prisma validate`, `prisma generate`, `tsc --noEmit`, `npm run typecheck`, `prisma migrate status`, `prisma migrate diff --exit-code`, consultas ao catálogo do PostgreSQL e reconstrução a partir de volume vazio) são verificações **da etapa**, e **não** substituem nem antecipam nenhuma das seis `V-*`.

> **Atualização REV. 7.** A execução de `E-08` **aprovou `V-02`** — a primeira mudança de estado de uma `V-*` desde a REV. 4. As demais permanecem como estavam: `V-03` (`E-12`), `V-04` (`E-16`) e `V-05` (`E-13`) **PENDENTES**, `V-06.c` **PENDENTE** e `V-06` **PARCIALMENTE APROVADA** — nenhum `apps/web` foi criado e criá-lo continua **não autorizado**. Enquanto `V-04` estiver pendente, `R2.2-03` e `R-BL-05` **continuam abertos**; a aprovação de `V-02` **não os toca**, porque mede a coluna gerada e não a preservação de objetos não representáveis sob `migrate diff`/`reset`. As validações de etapa executadas em `E-08` (`prisma validate`, `prisma generate`, `prisma migrate status`, `prisma migrate diff`, consultas ao catálogo e replay do histórico em banco vazio) **não** substituem nem antecipam nenhuma das `V-*` restantes.

### 12.2 Especificação completa de cada verificação

Para cada verificação: **o que mede**, **quando é executada**, **qual etapa bloqueia**, **o que constitui sucesso** e **o que fazer em caso de falha**.

#### `V-01` — Disponibilidade e permissão para `btree_gist`

- **O que mede.** Se a extensão `btree_gist` está **presente na imagem** `postgres:18-bookworm` e se pode ser instalada por uma role **não superusuária** que detenha apenas `CREATE` no banco — e, na sequência, se uma `EXCLUDE` com `uuid WITH =` e `tstzrange WITH &&` é efetivamente criável.
- **Quando.** Durante `E-02`, imediatamente após o container subir com healthcheck verde.
- **Bloqueia.** `E-04` (migration da extensão) e, por dependência, `E-10`. É **critério de aceite** de `E-02`.
- **Sucesso.** `CREATE EXTENSION btree_gist;` executa com `tlf_migrator`; `SELECT extname FROM pg_extension WHERE extname='btree_gist'` retorna linha; a `EXCLUDE` de teste é criada e derrubada sem erro.
- **Falha.** O plano **para em `E-02`**. Ação: usar a variante `bookworm` com `postgresql-contrib` explicitamente instalado e repetir. Persistindo, `H2.2-06` é **inimplementável na forma homologada** e a questão sobe para Bruno — nenhuma alternativa é adotada por conta própria.

#### `V-02` — Coluna gerada `valor_liquido`

- **O que mede.** Três comportamentos da coluna `GENERATED ALWAYS AS ... STORED`: leitura correta pelo Prisma Client; **recusa** de escrita; e sobrevivência da expressão a uma migration subsequente.
- **Quando.** Durante `E-08`, logo após a migration editada ser aplicada.
- **Bloqueia.** `E-08`.
- **Sucesso.** Alterar `valor_desconto` faz `valor_liquido` acompanhar sem intervenção; tentativa de escrita é rejeitada pelo PostgreSQL; a expressão continua presente no catálogo após a migration seguinte.
- **Falha.** Adotar o **fallback já homologado** em `docs/07` §19.2, opção (c) — cálculo na leitura, sem coluna. Esse fallback **não exige nova homologação**. Registrar a troca em `E-18`.

#### `V-03` — Forma concreta dos erros produzidos pelas constraints

- **O que mede.** O que **exatamente** chega à aplicação, sob `@prisma/adapter-pg`, em **quatro** violações distintas: índice único parcial, `CHECK`, exclusion constraint e FK. Captura o objeto de erro completo — código Prisma, `meta`, e `code`/`constraint` originados no driver `pg`.
- **Quando.** Durante `E-12`, contra PostgreSQL 18 real, com os objetos de `E-09`..`E-11` já criados.
- **Bloqueia.** `E-12`. É **critério de aceite bloqueante** dele.
- **Sucesso.** A tabela normativa de mapeamento é produzida a partir do **medido**, e os dois comportamentos opostos exigidos por `docs/07` §18 são demonstrados por teste: consumo duplicado (`C-04`) → **sucesso idempotente**; conflito de agenda (`C-01`) → **erro de conflito**. Nunca o inverso.
- **Falha.** Se a exclusion constraint chegar irreconhecível, aplicar o **fallback já previsto** em C-6: envolver a inserção de `agendamento` em `tx.$queryRaw` explícito, onde o erro do driver expõe `code` e `constraint`. Isso **não altera nenhuma decisão homologada** — muda apenas o caminho de escrita. Se nem assim a distinção for possível, a implementação de M7/M8 **para** e a questão sobe para Bruno.

#### `V-04` — Sobrevivência dos objetos SQL customizados ao workflow real de migrations

- **O que mede.** Se os objetos da Categoria C — índices parciais, `CHECK`, exclusion constraints, triggers, `REVOKE` e a expressão da coluna gerada — **sobrevivem ao workflow de migrations efetivamente planejado para este projeto** (§9.3 e §10), e não a um cenário genérico. É a **medição da hipótese de §9.2.2**, e a única evidência que pode encerrar `R2.2-03`.
- **Quando.** Durante `E-16`, após todos os objetos existirem e as três guardas estarem em CI.
- **Bloqueia.** `E-16` — e, por consequência, o encerramento de `R2.2-03` e de `R-BL-05`.
- **Sucesso.** Alterar uma tabela **não relacionada**, rodar `migrate dev --create-only` e constatar que o SQL gerado **não contém nenhum `DROP`** de objeto protegido — com atenção especial aos índices parciais. Complementarmente, o **teste negativo** é obrigatório: remover deliberadamente um objeto protegido e confirmar que **o CI falha**. Uma guarda que nunca falhou não está provada.
- **Falha.** Se qualquer `DROP` indevido aparecer, a **Guarda 1** o converte em falha de CI antes do merge — esse é o comportamento desejado, não uma exceção. A ação é registrar o padrão exato do diff, ampliar a lista de objetos protegidos e, se o descarte for sistemático em vez de pontual, reabrir C-3 com evidência e submeter a Bruno. **Em nenhuma hipótese `R2.2-03` é declarado fechado.**

#### `V-05` — Jest 30 sobre pacote ESM importando o Prisma Client

- **O que mede.** Se a suíte de integração executa em pacote **ESM puro** que faz `import` do Client gerado do Prisma 7.
- **Quando.** Durante `E-13`, contra o PostgreSQL do compose.
- **Bloqueia.** `E-13` e, por dependência, `E-14`.
- **Sucesso.** Suíte mínima verde, local **e** no CI, com a mesma tag de imagem.
- **Falha.** Ajustar a configuração de ESM do Jest (o suporte é oficial, porém exige configuração). Persistindo, avaliar executor alternativo **como proposta a Bruno** — TLF-BASE-V1 §9 fixa Jest, e trocá-lo é mudança de arquitetura, não decisão de implementação.

#### `V-06` — TypeScript 6.0 como **teto**, e valor efetivo do npm

- **O que mede.** Duas coisas: (i) se Prisma 7 e Next 16 aceitam TypeScript **6.0** — os três consumidores declaram apenas limites **mínimos**, nunca um teto; (ii) o valor real do npm distribuído com a linha Node 24 na máquina alvo, para preencher `packageManager` sem presunção.

##### Correção de sequenciamento (REV. 3) — por que a execução é dividida

A REV. 2 declarava `V-06` integralmente como critério de `E-01`. Isso é **impossível de satisfazer**: a parte (i) exige `tsc --noEmit` sobre o **Prisma Client gerado**, e o Client só existe após `E-03`, que depende de `E-01` e de `E-02`. Exigir a verificação completa em `E-01` cria um ciclo.

A correção **não altera o que `V-06` mede, nem seu critério de sucesso, nem o risco que fecha**. Altera apenas **quando cada metade é executável**. `V-06.a` e `V-06.b` **não são verificações novas**: são subchecks de `V-06`, que continua sendo uma das seis verificações do plano.

##### `V-06.a` — executada em `E-01`

- **O que mede.** O Node efetivamente em uso e sua pertinência à linha 24.x; o valor real de `npm -v`; o registro de `packageManager` **a partir desse valor real**; a resolução de TypeScript **6.0.x** no workspace (`tsc --version`); e a validade da configuração TypeScript ESM/strict sobre o workspace ainda vazio.
- **Quando.** Durante `E-01`, no scaffold.
- **Bloqueia.** `E-01`. É **critério de aceite** dele. Falhando, **não se avança para `E-02`**.
- **Sucesso.** `node -v` na faixa 24.x; `npm -v` lido e registrado literalmente em `packageManager`; `tsc --version` reportando 6.0.x; configuração TypeScript resolvida sem erro.

##### `V-06.b` — executada em `E-03`

- **O que mede.** Se o Prisma Client **efetivamente gerado** pela versão 7.x selecionada é aceito pelo TypeScript 6.0.x — isto é, a metade **Prisma** do teto que a parte (i) pretende medir.
- **Quando.** Durante `E-03`, após `prisma generate`.
- **Bloqueia.** `E-03`.
- **Sucesso.** `tsc --noEmit` termina limpo sobre o pacote de banco **incluindo/importando** o Client gerado, em ESM.

##### `V-06.c` — a executar no scaffold do frontend

- **Por que existe (REV. 4).** A parte (i) de `V-06` nomeia **dois** consumidores: Prisma 7 **e** Next.js 16. `V-06.b` mede apenas o primeiro. Declarar `V-06` aprovada com base nele estenderia a evidência a um consumidor **que sequer foi instalado**. `V-06.c` é o subcheck que faltava — **não é uma verificação nova**, é a metade não medida da mesma `V-06`.
- **O que mede.** A compatibilidade real do **TypeScript 6.0.x** com a linha **Next.js 16** efetivamente utilizada no futuro `apps/web`.
- **Quando.** Durante o **scaffold inicial do frontend**. Essa etapa **não pertence a este plano**, que termina na persistência.
- **Bloqueia.** Apenas a etapa de scaffold do frontend. **Não bloqueia `E-04`..`E-07`**, nem qualquer outra etapa deste plano: nenhuma delas compila código Next.js.
- **Não autoriza.** Criar `apps/web` para executá-la antecipadamente. Ela ocorre quando o frontend for legitimamente criado, não antes.
- **Sucesso.** Next.js 16 instalado; **TypeScript 6.0.x mantido** — e não substituído pelo que o scaffold sugerir; configuração oficial do Next gerada/ajustada; `tsc --noEmit` ou a verificação de tipos oficial equivalente do Next verde; build mínimo verde.
- **Falha.** **Não alterar silenciosamente** a versão do TypeScript nem a do Next.js para fazer o check passar. Registrar comando, erro, versões e causa provável, e **reabrir a baseline correspondente** pelo rito de §15/TLF-BASE-V1 §14.

##### Resultado de `V-06`

> **`V-06` só é considerada integralmente APROVADA quando `V-06.a`, `V-06.b` e `V-06.c` estiverem as três aprovadas.** Aprovar parte dos subchecks **não** aprova `V-06` e **não** fecha `R-BL-03`.

**Estado corrente (REV. 4):** `V-06.a` **APROVADA** · `V-06.b` **APROVADA** · `V-06.c` **PENDENTE** → **`V-06` = PARCIALMENTE APROVADA** (§12.1).

- **Falha.** Se o teto não se sustentar em `V-06.b` ou em `V-06.c`, recuar para a maior 5.x aceita por todos os consumidores — **mudança de baseline**, sujeita ao rito de §15 e registrada como tal. Não recuar silenciosamente, e **não** confundir erro de configuração com incompatibilidade real.

---

## 13. Plano de implementação física

Etapas pequenas, ordenadas e verificáveis. **Nenhuma é executada nesta tarefa.**

Convenções: **Rev.** = reversibilidade. Todos os caminhos são relativos à raiz do repositório.

> **Revisão da REV. 1.** O plano foi relido integralmente após as correções desta revisão. **Nenhuma etapa mudou de ordem, de dependência ou de critério de aceite.** As alterações são de **fundamentação**, e são três: (a) `E-01` deixa de justificar a ausência de `apps/api` por pendência arquitetural e passa a justificá-la por **escopo**, incorporando `D-ESM-01`; (b) `E-16` e §12.2 explicitam que `V-04` mede o **workflow real** do projeto e que sua ausência impede declarar `R2.2-03` fechado; (c) as etapas que tocam introspection passam a apontar para a política de **§10.2**. **Nenhuma etapa trata `D-PEND-01` como pendente** — a expressão não ocorre mais no plano.
>
> **Consequência transversal de `D-ESM-01` sobre o plano:** `E-01` já criava a raiz com `"type": "module"` — a decisão **confirma** essa escolha em vez de alterá-la. `E-03` (Prisma 7, ESM por exigência do próprio ORM), `E-13` (`V-05`, Jest sobre ESM) e o futuro `apps/api` herdam a mesma decisão. **Nenhuma etapa deste plano cria `apps/api`**, e `D-ESM-01` **não autoriza criá-lo agora**.

### Bloco I — Fundação (E-01 a E-03)

#### `E-01` — Baseline do workspace

- **Objetivo.** Criar o monorepo npm workspaces com a baseline de §6, **sem nenhuma dependência de aplicação**.
- **Arquivos previstos.** `package.json` (raiz, `private: true`, `workspaces`, `engines.node`, `packageManager`, `type: "module"`), `.nvmrc`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `packages/database/package.json`, `packages/database/tsconfig.json`.
- **Dependências.** Nenhuma. É a primeira etapa.
- **Ação.** Definir `packages/database` como **único** workspace inicial. Não criar `apps/api` nem `apps/web` — **por escopo**: nenhum dos dois é necessário para a persistência, e este plano termina nela. A raiz nasce com `"type": "module"`, conforme `D-ESM-01` (§16) e por exigência do próprio Prisma 7.
- **Validação.** `npm ls --workspaces` resolve; **`V-06.a`** (§12.2). A parte da `V-06` que depende do Prisma Client gerado é **`V-06.b`** e pertence a `E-03` — ver a correção de sequenciamento da REV. 3.
- **Critério de aceite.** Workspace resolve; `engines.node` recusa Node fora de 24.x; `package-lock.json` gerado e versionado; **`V-06.a` aprovada**.
- **Estado (REV. 4). EXECUTADA.** Node 24.x e npm reais lidos da máquina e `packageManager` preenchido a partir do valor medido; TypeScript 6.0.x resolvido; `strict` e ESM/`nodenext` comprovados por casos positivos **e** negativos; `package-lock.json` gerado. A recusa de Node fora de 24.x exigiu um `.npmrc` local com `engine-strict=true` — sem ele o npm apenas emite *warning*, o que **não** satisfaz o critério de aceite. **`V-06.a` APROVADA.**
- **Risco.** Baixo. **Rev.** Total.

#### `E-02` — Ambiente PostgreSQL

- **Objetivo.** PostgreSQL 18 reproduzível em desenvolvimento, com **duas roles**, e prova de `btree_gist`.
- **Arquivos previstos.** `docker-compose.yml`, `.env.example`, `docs/` (nota operacional).
- **Dependências.** `E-01`.
- **Ação.** Serviço `postgres:18-bookworm` com volume nomeado e healthcheck. Criar **duas roles distintas, desde o início**: `tlf_migrator` (dono do schema; `CREATE` no banco; `CREATEDB` para o shadow) e `tlf_app` (runtime; sem DDL). A separação é **pré-requisito do `REVOKE`** de `E-11` — introduzi-la depois exigiria refazer objetos. `.env.example` sem segredo real (TLF-BASE-V1 §14).
- **Validação.** **`V-01`.** Healthcheck verde; `SELECT 1`; `CREATE EXTENSION btree_gist` bem-sucedido com `tlf_migrator`; `EXCLUDE` de teste com `uuid WITH =` criada e derrubada.
- **Critério de aceite.** **`V-01` aprovada.** Sem ela, `H2.2-06` não é implementável e o plano **para aqui**.
- **Estado (REV. 4). EXECUTADA.** Container `postgres:18-bookworm` com volume nomeado e healthcheck **verde**; roles `tlf_migrator` (não superusuário, com `CREATEDB`) e `tlf_app` (sem DDL, sem ownership) criadas por script de inicialização versionado; ausência de DDL em `tlf_app` comprovada por tentativas reais rejeitadas; reprodutibilidade a partir de volume vazio comprovada por `down -v` + `up -d`. **`V-01` APROVADA, sem recurso ao fallback.** A extensão criada na prova foi **removida** ao final, para que `E-04` continue sendo a única responsável por instalá-la (§10).
- **Risco.** **Alto se `V-01` falhar** — mitigação: variante `bookworm` com `postgresql-contrib` explicitamente instalado. **Risco realizado: não.** **Rev.** Total (`docker compose down -v`).

#### `E-03` — Instalação do Prisma 7

- **Objetivo.** Fixar Prisma 7 e o adapter, e criar `prisma.config.ts`.
- **Arquivos previstos.** `packages/database/package.json`, `prisma.config.ts`, `packages/database/prisma/schema.prisma` (vazio, só `datasource` e `generator`).
- **Dependências.** `E-01`, `E-02`.
- **Ação.** Instalar `prisma`, `@prisma/client`, `@prisma/adapter-pg` **na mesma minor**. `generator` com `provider = "prisma-client"` e **`output` obrigatório** (Prisma 7). `prisma.config.ts` com `url` (usado pelo CLI nas migrations) e `shadowDatabaseUrl`, carregando variáveis explicitamente — elas **não** são mais carregadas automaticamente.
- **Validação.** `prisma validate`; `prisma generate`; `prisma migrate status` conecta; **`V-06.b`** (§12.2).
- **Critério de aceite.** CLI conecta com `tlf_migrator`; Client gerado no `output` configurado, **fora de `node_modules`**; **`V-06.b` aprovada**.
- **Estado (REV. 4). EXECUTADA.** `prisma`, `@prisma/client` e `@prisma/adapter-pg` na **mesma minor 7.x**; `prisma validate` e `prisma generate` verdes; Client gerado em `packages/database/generated/prisma`, **fora de `node_modules`** e **não versionado**, por regra específica de `.gitignore` (é artefato derivável de `schema.prisma` + versão fixada do Prisma + `package-lock.json` + `prisma generate`; regeneração comprovada byte a byte); conexão do CLI como `tlf_migrator` comprovada no log do servidor. **`V-06.b` APROVADA.** Combinada com `V-06.a`, isso deixa `V-06` **PARCIALMENTE APROVADA** — **não** integralmente: falta `V-06.c` (§12.2). Nesta etapa foi identificado **`R-BL-09`** (§15.2).
- **Risco.** Médio — `output` obrigatório e ESM são as duas fontes de atrito. **Rev.** Total.

### Bloco II — Schema declarativo (E-04 a E-07)

#### `E-04` — Migration 0001: extensão `btree_gist`

- **Objetivo.** Primeira migration do histórico, isolada e idempotente.
- **Arquivos previstos.** `prisma/migrations/0001_extensao_btree_gist/migration.sql`.
- **Dependências.** `E-03`; **`V-01` aprovada** — satisfeita em 20/08/2026 (§12.1).
- **Pré-condição de ambiente (REV. 4).** `E-04` deve **começar a partir de ambiente PostgreSQL local reconstruído com volume limpo** (`docker compose down -v` seguido de `docker compose up -d`). Sem isso, uma extensão remanescente de qualquer prova anterior mascararia a falha de uma migration incompleta, e o critério de aceite abaixo — "sem nenhum passo manual" — seria verificado contra um banco contaminado. **Pré-condição de segurança da própria pré-condição:** destruir **somente** o volume local sintético do TechLab Fisio, e apenas **após confirmar que ele não contém dado a preservar**. O volume é de desenvolvimento e não deve conter dado real (TLF-BASE-V1 §10) — a confirmação é obrigatória mesmo assim.
- **Ação.** `prisma migrate dev --create-only --name extensao_btree_gist` (produz migration vazia), acrescentar `CREATE EXTENSION IF NOT EXISTS btree_gist;`, aplicar.
- **Validação.** `SELECT extname FROM pg_extension WHERE extname = 'btree_gist'` retorna linha; `migrate reset` recria; shadow database a recebe.
- **Critério de aceite.** Extensão presente após `migrate reset` a partir de banco vazio — **sem nenhum passo manual**.
- **Estado (REV. 5). EXECUTADA.** Migration `20260820115547_extensao_btree_gist` — **primeira do histórico**, criada por `prisma migrate dev --create-only --name extensao_btree_gist` (migration vazia), preenchida com uma única instrução, `CREATE EXTENSION IF NOT EXISTS btree_gist;`, revisada e só então aplicada. **Pré-condição cumprida:** o volume `techlab-fisio-postgres-data` foi identificado como pertencente ao projeto Compose `techlab-fisio` (label `com.docker.compose.project`), verificado com **zero tabelas de usuário** e apenas os bancos sintéticos `techlab_fisio`/`techlab_fisio_shadow`, e só então destruído por `docker compose down -v`; nenhum volume alheio foi tocado. Antes de migrar, a ausência de `btree_gist` foi comprovada nos dois bancos, o que elimina falso positivo. Após aplicar, `SELECT extname FROM pg_extension WHERE extname='btree_gist'` retorna linha e o **owner da extensão é `tlf_migrator`** — prova de que quem a criou foi a role de migrations, e não o superusuário nem um passo manual. `prisma migrate reset --force` (autorizado explicitamente por Bruno para o banco local sintético, após a guarda anti-agente do Prisma 7) reconstruiu a extensão a partir de banco vazio. O ciclo mais forte — `docker compose down -v` + `up -d` + `prisma migrate deploy` — foi executado **duas** vezes, partindo de volume inexistente, e produziu a extensão sem intervenção. A shadow database reproduziu a migration em todas as gerações subsequentes (`migrate dev` e `migrate diff` a usam por construção). **Critério de aceite ATENDIDO.**
- **Risco.** Baixo. **Rev.** Total. **Risco realizado: não.**

#### `E-05` — Enums

- **Objetivo.** Tipos ENUM nativos, **somente** os enumerados em fonte homologada.
- **Arquivos previstos.** `schema.prisma`; migration gerada.
- **Dependências.** `E-04`.
- **Ação.** Declarar os enums de `docs/03` §5 e `docs/07` §6.1: estado de `agendamento`, de `registro_clinico`, de `retificacao_clinica` (`EM_ELABORACAO`/`EFETIVADA`, forma de `docs/06` — `docs/07` §2.4), de `sessao_autenticacao`, `tipo` de `movimento_sessao`, `modalidade` de `agendamento`. **Proibido** criar enum para `evento_auditoria.resultado` e para `evento_auditoria.acao`/`alvo_tipo` — `docs/07` §2.2 e §22.3 determinam `text` + catálogo.
- **Validação.** Revisão cruzada de cada enum contra a fonte homologada que o enumera.
- **Critério de aceite.** Todo enum tem fonte citada; nenhum valor inventado.
- **Estado (REV. 5). EXECUTADA.** Migration `20260820120806_enums`, gerada com `--create-only`, lida integralmente e conferida antes de aplicar. O SQL contém **exatamente 8 `CREATE TYPE` e nada mais** — nenhum `CREATE TABLE`, `ALTER`, `DROP`, `INDEX`, `CONSTRAINT`, `TRIGGER`, `GENERATED`, `EXCLUDE`, `REVOKE` ou `CASCADE`. Conferência valor a valor contra a fonte que os **enumera**:

  | Tipo (PostgreSQL) | Valores | Fonte homologada |
  | --- | --- | --- |
  | `estado_agendamento` | `AGENDADO`, `CONFIRMADO`, `AGUARDANDO`, `EM_ATENDIMENTO`, `CONCLUIDO`, `FALTA`, `CANCELADO` | `docs/03` §5.1 (7 valores); `docs/07` §7.5 e §11.1 |
  | `modalidade_agendamento` | `AVULSO`, `PACOTE` | AGD-001; `docs/07` §7.5 e §11.1 |
  | `estado_registro_clinico` | `EM_ELABORACAO`, `FINALIZADO` | PRN-003, PRN-004, RN-023, `docs/03` §5.2; `docs/07` §11.1 |
  | `estado_retificacao_clinica` | `EM_ELABORACAO`, `EFETIVADA` | PRN-005, `docs/06` §6.6 — forma adotada por decisão explícita de `docs/07` §2.4 |
  | `estado_sessao_autenticacao` | `ATIVA`, `EXPIRADA`, `REVOGADA` | `docs/03` §5.3, RN-004; `docs/07` §7.1 e §11.1 |
  | `tipo_movimento_sessao` | `CONSUMO`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO` | **H2-02** ("exatamente os 3"); `docs/07` §14 e §11.1 |
  | `motivo_encerramento_reserva` | `CANCELAMENTO`, `FALTA`, `DESVINCULACAO`, `CONSUMO` | PKG-004, D-07; enumerado em `docs/07` §13.2, fundamentado em §11.1 |
  | `origem_cobranca` | `AGENDAMENTO_AVULSO`, `PACOTE`, `ADMINISTRATIVA` | `docs/06` §9; enumerado em `docs/07` §19.1, fundamentado em §11.1 |

  Os dois últimos **não constam** da enumeração da linha "Ação" acima, que cita `docs/03` §5 e `docs/07` §6.1; ambos são declarados como `ENUM` **pela própria `docs/07`** (§13.2 e §19.1) e auditados como **Fundamentados** em §11.1 — a lista da linha "Ação" é ilustrativa das duas seções que cita, não exaustiva do documento. **Nenhum enum adicional foi criado:** `SELECT count(*) … typtype='e'` retorna **8**. As proibições foram respeitadas — `evento_auditoria.resultado`, `.acao` e `.alvo_tipo`, e `historico_agendamento.operacao`, permanecem `text` + catálogo. As situações de Cobrança (`docs/03` §5.4) e de Pacote (`docs/03` §5.5) **não viraram enum** por serem estados derivados, não persistidos (`docs/07` §6.1). **Critério de aceite ATENDIDO.**
- **Risco.** **Médio — de fidelidade, não técnico.** Um valor a mais congela vocabulário que o negócio não fixou. **Rev.** Média (alterar enum em uso exige migration cuidadosa). **Risco realizado: não.**

#### `E-06` — Entidades e colunas (Categoria A)

- **Objetivo.** As ~30 tabelas do catálogo `docs/07` §7, com tipos e obrigatoriedade.
- **Arquivos previstos.** `schema.prisma` (organizado por módulo M1..M10); migration gerada.
- **Dependências.** `E-05`.
- **Ação.** Convenções de `docs/07` §5: `snake_case` singular via `@@map`/`@map`; PK `uuid`; `timestamptz`; `date`; `time`+`dia_semana`; `numeric(12,2)` via `@db.Decimal(12,2)` — **nunca** `Float`; `jsonb`; `criado_em` em toda tabela; `atualizado_em` **só** nas mutáveis; **`deleted_at` não existe** (§5). `cobranca.valor_liquido` declarada como coluna comum aqui e **convertida em gerada** em `E-08`.
- **Organização do schema.** Arquivo único com seções comentadas por módulo. Multi-arquivo é rejeitado no MVP por acrescentar configuração sem ganho (TLF-BASE-V1 §4.5).
- **Validação.** `prisma validate`; conferência tabela a tabela contra `docs/07` §7.
- **Critério de aceite.** Toda tabela de §7 existe; nenhuma tabela extra; nenhum `Float` em coluna monetária; nenhum `deleted_at`.
- **Estado (REV. 5). EXECUTADA.** Migration `20260820121255_entidades_e_colunas`, gerada com `--create-only`, lida integralmente (477 linhas) e conferida antes de aplicar. **O número real de tabelas do catálogo de `docs/07` §7 é 36** — o "~30" da linha "Objetivo" é estimativa da redação original, e a contagem foi feita **diretamente na fonte**, não presumida. Distribuição por módulo: **M1 (7)** `usuario`, `papel`, `permissao`, `usuario_papel`, `papel_permissao`, `sessao_autenticacao`, `segredo_recuperacao_senha`; **M2 (5)** `clinica`, `horario_funcionamento`, `servico`, `forma_pagamento`, `motivo_cancelamento`; **M3 (5)** `profissional`, `especialidade`, `profissional_especialidade`, `profissional_servico`, `disponibilidade_profissional`; **M4 (5)** `paciente`, `contato_emergencia`, `responsavel_legal`, `consentimento`, `observacao_administrativa`; **M5 (3)** `agendamento`, `bloqueio_agenda`, `historico_agendamento`; **M6 (4)** `atendimento`, `registro_clinico`, `retificacao_clinica`, `anexo_clinico`; **M7 (3)** `pacote`, `reserva_sessao`, `movimento_sessao`; **M8 (3)** `cobranca`, `pagamento`, `estorno`; **M9 (0)** — nenhuma tabela, conforme `docs/07` §7.9 e `D2.1-03`; **M10 (1)** `evento_auditoria`.

  Verificação no catálogo do PostgreSQL após aplicar: **36 tabelas** (37 com `_prisma_migrations`), **262 colunas** de negócio, **nenhuma tabela extra**. Guardas: `deleted_at` → **0 colunas**; `real`/`double precision`/`money` → **0 colunas**; as **5** colunas monetárias (`servico.preco_referencia`, `cobranca.valor_bruto`, `cobranca.valor_desconto`, `cobranca.valor_liquido`, `pagamento.valor`) são todas `numeric(12,2)`. `criado_em` **ou** `criada_em` presente nas **36** tabelas — onde `docs/07` nomeia a coluna de criação no feminino (§7.1 `sessao_autenticacao`, §13.2 `reserva_sessao`), a forma da fonte foi preservada e **nenhuma coluna duplicada** foi criada. `atualizado_em` existe em **exatamente 4** tabelas — `usuario`, `agendamento`, `pacote`, `cobranca` — as únicas em que `docs/07` §7 o enumera; a convenção de §5 é **restritiva** ("somente em tabelas mutáveis"), não obrigatória, e acrescentá-lo onde a fonte não o lista seria invenção de coluna.

  **`cobranca.valor_liquido` foi criada como coluna comum `numeric(12,2) NOT NULL`**, forma provisória prevista por esta etapa: `information_schema.columns.is_generated = 'NEVER'` e `generation_expression` nula. **A conversão para `GENERATED … STORED` NÃO foi feita e pertence a `E-08`.**

  **Componentes clínicos não foram criados.** `docs/07` §7.6 declara, para `registro_clinico` e `retificacao_clinica`, que "a estrutura interna de campos permanece **pendente** de definição clínica (`P2.2-07`)". Criar colunas de avaliação, plano ou evolução agora **congelaria uma estrutura explicitamente pendente** — seria invenção, e não cumprimento da fonte. As duas tabelas existem com suas colunas estruturais (identidade, âncora, autoria, estado, temporalidade); as colunas de conteúdo entram quando `P2.2-07` for resolvida. Isso é consistente com a linha de `P2.2-07` em §19 ("Não para o schema; sim para `E-06` detalhado").

  **Colunas cuja fonte não decompõe.** `clinica` traz `endereco`, `telefone` e `email` para "endereço/contatos" de §7.2; `paciente` traz `telefone` e `email` para "contatos" de §7.4; `contato_emergencia` traz `nome` e `telefone`, e `responsavel_legal` traz `nome` e `telefone`, para as entidades que §7.4 cita apenas por cardinalidade (PAC-004, com minimização de dados). Nenhuma decomposição adicional foi inventada.

  **`consentimento` — PLACEHOLDER declarado.** `docs/07` §7.4 descreve a entidade apenas como "evidência operacional" e remete o conteúdo jurídico à pendência `D2.1-11`/PAC-005, **sem enumerar coluna alguma**. As quatro colunas implementadas — `tipo` (catálogo `text` da aplicação), `concedido_em`, `revogado_em` e `registrado_por_usuario_id` (com a FK correspondente) — são, portanto, **estrutura mínima de implementação, NÃO conteúdo homologado**. Registrado aqui, por recomendação da revisão independente, para que não sejam lidas como derivadas de fonte. Sua forma definitiva depende de `P2.2-06` (retenção/LGPD) e da validação jurídica exigida por PAC-005. **Critério de aceite ATENDIDO.**
- **Risco.** Médio — volume. **Rev.** Alta enquanto não houver dados. **Risco realizado: não.**

#### `E-07` — Relações, FKs e unicidades simples

- **Objetivo.** Cardinalidades de `docs/07` §8 e Categoria A de §28.2.
- **Arquivos previstos.** `schema.prisma`; migration gerada.
- **Dependências.** `E-06`.
- **Ação.** Todas as FKs com **`onDelete: Restrict`** (§9.2) — `Cascade` é **proibido**. Unicidades simples U-01, U-02, U-05..U-13, incluindo **U-13 `registro_clinico.atendimento_id`** (P-CLIN Alternativa A). Índices simples IDX-A3, A5, A6, M1, P1, C1, F1, F2, F3, N1, N2, N3, N4, U1, U2, U3, S1. **Não declarar** os parciais (C-3). `evento_auditoria.alvo_id` **sem FK** (alvo polimórfico, §22.3).
- **Validação.** Diff da migration não contém `CASCADE`; `\d` confirma FKs e uniques.
- **Critério de aceite.** U-13 presente e única; nenhum `ON DELETE CASCADE`; todos os índices de §10-A **exceto** os parciais.
- **Estado (REV. 6). EXECUTADA, com correção pré-versionamento aplicada.** Migration `20260820121900_relacoes_fks_unicidades_indices`. **Nota de procedimento:** `prisma migrate dev --create-only` **não pôde ser usada nesta etapa** — a criação de índices únicos faz o Prisma 7 emitir um aviso que exige confirmação em TTY, e o comando aborta com "environment is non-interactive". O SQL foi então gerado pelo caminho oficial não interativo `prisma migrate diff --from-migrations … --to-schema … --script`, **lido integralmente antes de qualquer aplicação**, e aplicado com `prisma migrate deploy`. A disciplina de §10 (ponto 3 e ponto 4) foi preservada em substância: SQL gerado, revisado por humano, versionado e só então aplicado. **`db push` e `db pull` não foram usados** (§9.3, §10.2).

  **Regeneração na REV. 6.** Como a migration ainda **não estava versionada**, as três correções aprovadas por Bruno foram incorporadas **regenerando o corpo do arquivo** — e não por migration corretiva adicional, que deixaria objetos de `E-07` espalhados em duas migrations. Procedimento: o diretório da migration foi retirado temporariamente, `migrate diff --from-migrations` (agora com `E-04`..`E-06`) `--to-schema --script` produziu o corpo novo, o diretório foi restaurado e o arquivo regravado. O `diff` entre o corpo antigo e o novo contém **exatamente três alterações e nenhuma outra**: `− CREATE UNIQUE INDEX movimento_sessao_chave_idempotencia_key`, `+ CREATE INDEX reserva_sessao_agendamento_id_idx`, `+ ALTER TABLE pacote ADD CONSTRAINT pacote_cancelado_por_usuario_id_fkey`.

  **FKs — 70, todas com `ON DELETE RESTRICT`.** Verificação no catálogo: `SELECT confdeltype, confupdtype, count(*) FROM pg_constraint WHERE contype='f'` retorna uma única linha, `r | r | 70`. **Nenhuma ação referencial em cascata**, em delete ou update. Nas relações **opcionais** o `onDelete: Restrict` explícito é indispensável: o padrão do Prisma nelas seria `SetNull`, o que violaria §9.2.

  A 70ª FK é `pacote.cancelado_por_usuario_id → usuario.id`, **acrescentada na correção pré-versionamento**. A revisão independente apurou que a implementação inicial a havia omitido, embora tivesse criado as duas colunas irmãs — `agendamento.cancelado_por_usuario_id` (§7.5) e `cobranca.cancelada_por_usuario_id` (§19.1) — que nascem de linhas de `docs/07` formatadas de modo idêntico. A FK é exigida pela convenção de §5 ("FKs `<entidade>_id`"), por §9.2 ("RESTRICT em **todas** as FKs") e por §28.2 Categoria A ("**todas as FKs**"). Sem ela, quem cancelou um pacote — entrada da derivação H2-09 (§7.7) — ficaria sem integridade referencial.

  **`ON UPDATE RESTRICT` nas 70 — decisão de implementação, não requisito homologado.** **Nenhuma fonte homologada fixa política de `ON UPDATE`**: `docs/07` §9.2 tem título "Política de `ON DELETE`" e todo o seu racional trata de deleção. Não existe opção neutra — omitir a ação no Prisma produz o comportamento em cascata por padrão, igualmente não homologado. Adotou-se `Restrict` por ser a conservadora e a coerente com o racional de §9.2: propagar uma alteração de PK reescreveria valores de FK silenciosamente em todo o grafo, exatamente a classe de reescrita que RN-007, RN-024, RN-044 e RN-066 proíbem. **Decisão aprovada por Bruno na revisão pré-versionamento.**

  A REV. 5 justificava essa escolha por dois argumentos que a revisão independente **refutou** e que foram retirados: (a) que `Restrict` seria "semanticamente equivalente" a `Cascade` — as duas só coincidem **enquanto nenhuma PK for alterada**, o que é equivalência condicional, não semântica; (b) que a escolha tornaria "a guarda de lint de §9.3 trivialmente verificável" — a **Guarda 1** de §9.3 varre `DROP INDEX`, `DROP CONSTRAINT`, `DROP TRIGGER` e `DROP EXTENSION` sobre a lista de objetos protegidos, e **não** procura ações referenciais. A ausência do token no DDL **não é objetivo em si**; o requisito homologado é impedir deleção em cascata.

  **`evento_auditoria.alvo_id` permanece SEM FK** — verificado no catálogo: a única FK da tabela é `evento_auditoria_ator_usuario_id_fkey`. O alvo é polimórfico (`docs/07` §22.3) e nenhuma FK foi criada por conveniência.

  **Unicidades — 12 índices únicos não-PK, exatamente a enumeração de §10.1 e §28.2**: **U-01** `usuario_email_key`; **U-02** `atendimento_agendamento_id_key`; **U-05** `estorno_pagamento_id_key` (= IDX-F4); **U-06** `responsavel_legal_paciente_id_key`; **U-07** `paciente_cpf_key`; **U-08** `profissional_usuario_id_key`; **U-09** `pagamento_chave_idempotencia_key`; **U-10** `estorno_chave_idempotencia_key`; **U-11** `papel_codigo_key` **e** `permissao_codigo_key` (a linha U-11 de §10.1 cobre duas tabelas); **U-12** `reserva_sessao_movimento_consumo_id_key`; **U-13** `registro_clinico_atendimento_id_key`. Nenhuma usa `NULLS NOT DISTINCT`, conforme §10.1.

  `movimento_sessao.chave_idempotencia` **não** recebe unicidade — a implementação inicial a havia criado e ela foi **removida na correção pré-versionamento**, por decisão de Bruno. A coluna permanece. Ver **`DIV-04`** (§11).

  **U-13 confirmada:** `registro_clinico_atendimento_id_key` existe, é **única** e **não parcial** (`indisunique = true`, `indpred IS NULL`). É a materialização física de P-CLIN Alternativa A (HOM-04, RN-070).

  **Índices simples — 17 não-únicos**, mais IDX-N2 (que é a própria U-13) e IDX-F4 (que é U-05), totalizando os **18** objetos de §10-A atribuídos a esta etapa: IDX-A3 `agendamento(inicio)`; IDX-A5 `bloqueio_agenda(profissional_id, inicio, fim)`; IDX-A6 `historico_agendamento(agendamento_id, ocorrido_em)`; **IDX-R3 `reserva_sessao(agendamento_id)`**; IDX-M1 `movimento_sessao(pacote_id, tipo)`; IDX-P1 `pacote(paciente_id)`; IDX-C1 `cobranca(paciente_id)`; IDX-F1 `pagamento(cobranca_id)`; IDX-F2 `pagamento(recebido_em)`; IDX-F3 `pagamento(forma_pagamento_id)`; IDX-N1 `registro_clinico(paciente_id, criado_em)`; IDX-N3 `retificacao_clinica(registro_original_id)`; IDX-N4 `anexo_clinico(registro_clinico_id)`; IDX-U1 `evento_auditoria(alvo_tipo, alvo_id, ocorrido_em)`; IDX-U2 `evento_auditoria(ator_usuario_id, ocorrido_em)`; IDX-U3 `evento_auditoria(correlacao_id)`; IDX-S1 `sessao_autenticacao(usuario_id, estado)`.

  **IDX-R3 foi acrescentado na correção pré-versionamento**, por decisão de Bruno — ver **`DIV-05`** (§11). Com ele, a auditoria integral de §10-A fecha: dos 27 IDs do catálogo, **18 pertencem a `E-07` e os 18 existem**; os 9 restantes (IDX-A1, A2, A4, R1, R2, M2, P2, C2 e a unicidade parcial U-03) pertencem a `E-10` e **nenhum foi antecipado**.

  **Nenhum índice parcial foi antecipado:** `SELECT count(*) … indpred IS NOT NULL` retorna **0**. IDX-M2/U-03, IDX-R2/U-04, IDX-R1, IDX-A4, IDX-P2 e IDX-C2 continuam pertencendo a `E-10`. Igualmente **0** CHECK constraints, **0** exclusion constraints, **0** triggers e **0** colunas geradas. **Critério de aceite ATENDIDO.**
- **Risco.** Médio. **Rev.** Alta. **Risco realizado: não.**

### Bloco III — Objetos SQL customizados (E-08 a E-12)

> Todas as etapas deste bloco usam **obrigatoriamente** `--create-only` e **nomes determinísticos**.

#### `E-08` — Coluna gerada `valor_liquido`

- **Objetivo.** `cobranca.valor_liquido` como `GENERATED ALWAYS AS (valor_bruto - valor_desconto) STORED` (`H2.2-18`, §19.2).
- **Arquivos previstos.** `prisma/migrations/00XX_valor_liquido_gerado/migration.sql`.
- **Dependências.** `E-07`.
- **Ação.** `--create-only`; substituir a definição pela forma `GENERATED`. Marcar o campo como não-escrevível por disciplina de código.
- **Validação.** **`V-02`.** Alterar `valor_desconto` e conferir que `valor_liquido` acompanha; tentar escrever e esperar falha.
- **Critério de aceite.** `V-02` aprovada; `valor_liquido` nunca divergente.
- **Estado (REV. 7). EXECUTADA.** Migration `20260821232217_valor_liquido_gerado`.

  **Nota de procedimento.** Como em `E-07`, `prisma migrate dev --create-only` **não pôde ser usada** — ver a *nota de ambiente* abaixo. O caminho foi o mesmo já praticado e registrado: `prisma migrate diff --from-migrations … --to-schema … --script` para apurar o que o Prisma tinha a dizer, SQL **escrito e revisado integralmente antes de qualquer aplicação**, e `prisma migrate deploy` para aplicar. **`db push` e `db pull` não foram usados** (§9.3, §10.2). O diff do Prisma retornou **"This is an empty migration"**, o que é o resultado esperado e **confirma `C-2` na prática**: `GENERATED` não é representável na Prisma Schema Language, logo 100% do SQL desta etapa é humano.

  **SQL aplicado.** `ALTER TABLE "cobranca" DROP COLUMN "valor_liquido";` seguido de `ALTER TABLE "cobranca" ADD COLUMN "valor_liquido" numeric(12,2) NOT NULL GENERATED ALWAYS AS ("valor_bruto" - "valor_desconto") STORED;`. O `DROP`+`ADD` **não é preferência**: o PostgreSQL não converte coluna comum em coluna gerada — `ALTER COLUMN … SET EXPRESSION` (17+) só troca a expressão de uma coluna **já** gerada. A recriação **não perde dado neste ponto do histórico**: `cobranca` nasce em `E-06` e, no replay do zero, chega a `E-08` sem linhas. Efeito colateral aceito: a coluna passa a ser a última de `cobranca`; nenhuma fonte homologada fixa ordem de colunas.

  **Ajuste em `schema.prisma` — `valorLiquido` recebe `@default(dbgenerated())`.** É o **ajuste mínimo indispensável** previsto pela própria `C-2`, que manda excluir o campo de todo `create`/`update`. Sem ele o campo é **obrigatório** na entrada do Client, e `V-02` mediu um **impasse fechado**: omitir dá `Argument valorLiquido is missing` (validação do Prisma, em TypeScript *e* em runtime) e informar dá **428C9** do PostgreSQL — nenhum caminho de criação seria possível. Com `@default(dbgenerated())` o campo vira `valorLiquido?` na entrada, **nenhum `DEFAULT` é emitido em migration** e `migrate diff --from-migrations --to-schema` **continua retornando vazio**. A leitura permanece intacta e o campo continua **não-nulo** no tipo do modelo. **Não é decisão nova nem reabertura**: a fonte única continua sendo o banco.

  **Verificação de catálogo.** `information_schema.columns`: `is_generated = ALWAYS`, `generation_expression = (valor_bruto - valor_desconto)`, `numeric(12,2)`, `is_nullable = NO`. `pg_attribute`: `attgenerated = 's'` (**STORED**, não `VIRTUAL`) e `attnotnull = t`. Guardas monetárias mantidas: **0** colunas `real`/`double precision`/`money` no schema e as **5** colunas monetárias seguem `numeric(12,2)`.

  **`V-02` — APROVADA.** Evidência, com dados exclusivamente sintéticos, removidos ao final (contagem final: 0 cobranças, 0 pacientes, 0 usuários):
  1. **Cálculo sem participação da aplicação** — `create` omitindo o campo: `valor_bruto = 300,00`, `valor_desconto = 45,50` → `valor_liquido = 254,50`. O desconto **não é zero** de propósito: com `0` um erro de expressão passaria despercebido.
  2. **Recálculo** — `update` de `valor_desconto` para `120,25` → `179,75`; releitura confirma que **254,50 não permaneceu persistido**. Segundo caso com as duas parcelas mudando: `1000,00 − 0,01 = 999,99`.
  3. **Escrita explícita rejeitada nos três caminhos** — `create` com o campo: `428C9` `cannot insert a non-DEFAULT value into column "valor_liquido"` (Prisma `P2039`); `update` do campo: `428C9` `column "valor_liquido" can only be updated to DEFAULT`; **SQL cru** (`$executeRawUnsafe`): mesmo `428C9`. Após as tentativas, o registro seguia coerente — a barreira **não depende de disciplina de código**.
  4. **Prisma Client** — `prisma validate` e `prisma generate` (7.9.1) passam; `create` omitindo o campo **compila** (`tsc`) e executa; `update` legítimo de `valorDesconto` funciona; a leitura devolve `valorLiquido` corretamente.
  5. **Sobrevivência** — `migrate diff --from-migrations --to-schema` vazio (o Prisma **não** tenta desfazer a coluna) e o replay do histórico completo em banco vazio reproduz `attgenerated = 's'` com a mesma expressão.
  6. **Invariante** — em toda a bateria, `valor_liquido = valor_bruto − valor_desconto` **nunca divergiu**; varredura final: **0 linhas divergentes**.

  **Estratégia principal `GENERATED … STORED`: MANTIDA.** O **fallback** de `docs/07` §19.2 (opção c, cálculo na leitura) **NÃO foi acionado** — não houve atrito residual depois do ajuste que a própria `C-2` prescreve. O risco de `C-2` ("o Client tipar o campo como escrevível e algum caminho de escrita tentar preenchê-lo") está **medido e contido**, não apenas mitigado: o PostgreSQL recusa.

  **Nota de ambiente — pendência aberta, NÃO corrigida nesta tarefa.** O `_prisma_migrations` do banco de desenvolvimento guarda, para `20260820121900_relacoes_fks_unicidades_indices`, o checksum **anterior** à regeneração do arquivo na REV. 6 — resíduo daquela correção, que reescreveu o corpo da migration já aplicada. Consequência: `prisma migrate dev` classifica como *drift* e **pede reset do banco**. **O reset foi recusado** (dado sintético é reproduzível, mas aceitar reset automático mascararia a causa). Diagnóstico: as três primeiras migrations têm checksum **idêntico** ao arquivo; só a quarta diverge. A **estrutura** do banco confere com o arquivo versionado — **70** FKs, **0** unicidade em `movimento_sessao.chave_idempotencia`, **IDX-R3 presente** — e `migrate diff` entre datasource e schema é **vazio**. `migrate status` reporta *up to date* e `migrate deploy` funciona normalmente. **É inconsistência de ambiente local, não do repositório**: em clone limpo com banco vazio o histórico aplica os cinco arquivos e grava os checksums corretos, como o replay em banco vazio comprovou. Fica **registrada e aberta** para decisão do orquestrador.

  **Nada de `E-09` em diante foi antecipado** — catálogo: **0** CHECKs `ck_*`, **0** exclusion constraints, **0** triggers, **0** índices parciais. A CHECK de RN-042 (`valor_bruto - valor_desconto >= 0`) **continua pertencendo a `E-09`**. Migrations `E-04`..`E-07` **bit a bit inalteradas**. Nenhuma Preview Feature. **Critério de aceite ATENDIDO.**
- **Risco.** Baixo–Médio. **Fallback já homologado** (`docs/07` §19.2, opção c) — não exige nova homologação. **Rev.** Média. **Risco realizado: parcialmente** — o atrito de tipagem previsto por `C-2` **ocorreu** e foi resolvido dentro da própria decisão, sem recorrer ao fallback.

#### `E-09` — CHECK constraints

- **Objetivo.** **Todas** as CHECKs de `docs/07` §10.2.
- **Arquivos previstos.** `prisma/migrations/00XX_check_constraints/migration.sql`.
- **Dependências.** `E-08`.
- **Ação.** Nomes `ck_<tabela>_<regra>`. Cobertura integral e sem exceção: `agendamento` (`fim > inicio`; coerência modalidade×pacote); `bloqueio_agenda`; `movimento_sessao` (4 CHECKs, incluindo a que **sustenta U-03**); `reserva_sessao` (2); `pacote`; `cobranca` (incluindo **RN-042** `valor_bruto - valor_desconto >= 0` e coerência de origem); `pagamento`; **`paciente` (`cpf IS NULL OR cpf ~ '^[0-9]{11}$'` — `H2.2-13`, §11.4.1)**; `registro_clinico`; `retificacao_clinica`; `horario_funcionamento` e `disponibilidade_profissional`; `sessao_autenticacao`.
- **Validação.** Inserção violadora rejeitada, uma por CHECK.
- **Critério de aceite.** Todas as linhas de §10.2 implementadas e testadas; **nenhuma omitida**.
- **Risco.** Baixo. **Rev.** Total.

#### `E-10` — Índices parciais e exclusion constraints

- **Objetivo.** Os seis índices parciais e as duas exclusion constraints — **o núcleo de `H2.2-06` e da zona cinzenta de C-3**.
- **Arquivos previstos.** `prisma/migrations/00XX_indices_parciais/migration.sql`, `prisma/migrations/00XX_exclusion_agenda/migration.sql` (separadas, para isolar falha).
- **Dependências.** `E-09`; `E-04` (extensão).
- **Ação.**
  - Parciais: **IDX-M2** único `(atendimento_id, pacote_id) WHERE tipo='CONSUMO'` (U-03); **IDX-R2** único `(agendamento_id) WHERE encerrada_em IS NULL` (U-04); IDX-R1; IDX-A4; IDX-P2; IDX-C2.
  - Exclusion, com os **cinco** estados corrigidos na REV. 2 — `AGENDADO`, `CONFIRMADO`, `AGUARDANDO`, `EM_ATENDIMENTO` e **`CONCLUIDO`** (`docs/07` §17.2, correção C-04):
    - `ex_agendamento_profissional`: `EXCLUDE USING gist (profissional_id WITH =, tstzrange(inicio, fim, '[)') WITH &&) WHERE (estado IN (...))`;
    - `ex_agendamento_paciente`: idem para `paciente_id` (**D-06**).
  - Registrar os nomes na **lista de objetos protegidos** da Guarda 1.
- **Validação.** Sobreposição rejeitada; **`T-AGD-EDGE-NON-OVERLAP`** — agendamento que termina 10:00 e outro que começa 10:00 é **aceito** (intervalo semiaberto); agendamento `CANCELADO`/`FALTA` **não** bloqueia; `CONCLUIDO` **bloqueia**.
- **Critério de aceite.** Todos os testes acima; nomes na lista protegida.
- **Risco.** **Alto** — é o objeto mais crítico e o mais exposto a C-3. **Rev.** Total antes de dados.

#### `E-11` — Triggers e privilégios (append-only)

- **Objetivo.** Proteção priorizada de `docs/07` §22.2 — **sem uniformizar**.
- **Arquivos previstos.** `prisma/migrations/00XX_append_only/migration.sql`.
- **Dependências.** `E-10`; roles de `E-02`.
- **Ação.** `REVOKE UPDATE, DELETE` de `tlf_app` em `evento_auditoria`, `movimento_sessao`, `pagamento`, `estorno`, `historico_agendamento`. **Trigger condicional** apenas nas duas tabelas clínicas: `registro_clinico` quando `OLD.estado = 'FINALIZADO'` e `retificacao_clinica` quando `OLD.estado = 'EFETIVADA'`. **`reserva_sessao` não recebe proteção adicional** — o encerramento é `UPDATE` legítimo (§22.2).
- **Validação.** Como `tlf_app`, `UPDATE`/`DELETE` nas cinco tabelas **falha**; `UPDATE` em registro `FINALIZADO` **falha**; `UPDATE` em registro `EM_ELABORACAO` **é permitido**; `UPDATE` em `reserva_sessao` **é permitido**.
- **Critério de aceite.** Todos acima. **O teste do caso permitido é tão obrigatório quanto o do proibido** — uma trigger boa demais quebra a finalização.
- **Risco.** Médio. **Rev.** Total.

#### `E-12` — Mapeamento de erro por constraint

- **Objetivo.** Fechar **C-6** com evidência medida.
- **Arquivos previstos.** `packages/database/src/errors/constraint-map.ts`; `packages/database/test/constraint-errors.spec.ts`; seção normativa em `docs/08`.
- **Dependências.** `E-11`.
- **Ação.** **`V-03`**: provocar as quatro violações e capturar o erro completo sob `@prisma/adapter-pg`. Publicar a tabela normativa. Implementar o mapeamento **sobre o que foi medido**, priorizando P2002+`meta`. Se exclusion chegar irreconhecível, aplicar o fallback já previsto (inserção via `tx.$queryRaw`).
- **Validação.** Consumo duplicado → **sucesso idempotente**; conflito de agenda → **erro de conflito**. Nunca o inverso.
- **Critério de aceite.** **`V-03` aprovada**; os dois comportamentos opostos demonstrados por teste.
- **Risco.** **Médio — maior incerteza remanescente**, fechável localmente. **Rev.** Total (só código).

### Bloco IV — Verificação (E-13 a E-17)

#### `E-13` — Infraestrutura de testes de integração

- **Objetivo.** Jest 30 contra PostgreSQL real. **Sem mock de banco** — constraints só se testam no banco.
- **Arquivos previstos.** `jest.config.ts`, `packages/database/test/setup.ts`, `test/helpers/db.ts`.
- **Dependências.** `E-03`.
- **Ação.** Banco descartável por execução; `migrate deploy` no bootstrap; truncamento entre testes.
- **Validação.** **`V-05`** (Jest ESM + Client ESM).
- **Critério de aceite.** `V-05` aprovada; suíte roda local e no CI com a mesma tag de imagem.
- **Risco.** Médio (`R-BL-04`). **Rev.** Total.

#### `E-14` — Testes de invariantes (§14)

- **Objetivo.** Cobrir integralmente a lista mínima de §14.
- **Arquivos previstos.** `packages/database/test/*.spec.ts`.
- **Dependências.** `E-13`, `E-12`.
- **Ação.** Implementar §14 item a item. **Dados exclusivamente sintéticos** — TLF-BASE-V1 §10 e §14 deste plano.
- **Validação.** Suíte verde; cobertura conferida contra a lista.
- **Critério de aceite.** **Todos** os itens de §14 com teste; nenhum dado real.
- **Risco.** Baixo. **Rev.** Total.

#### `E-15` — Reconstrução a partir de banco vazio

- **Objetivo.** Provar que o histórico é **auto-suficiente** (política §10, ponto 7).
- **Arquivos previstos.** `.github/workflows/ci.yml`; `scripts/verify-from-scratch.*`.
- **Dependências.** `E-14`.
- **Ação.** Job que sobe `postgres:18-bookworm` limpo, roda **apenas** `prisma migrate deploy` e executa a suíte inteira. **Nenhum passo manual permitido** — inclusive a extensão.
- **Validação.** Job verde do zero absoluto.
- **Critério de aceite.** Banco vazio → schema completo com **todos** os objetos das Categorias A, B e C, sem intervenção.
- **Risco.** Baixo. **Rev.** Total.

#### `E-16` — Guardas anti-drift (a tríade de §9.3)

- **Objetivo.** Impedir perda silenciosa — **`R2.2-03`**.
- **Arquivos previstos.** `scripts/lint-migrations.*`, `scripts/schema-snapshot.*`, `packages/database/schema.golden.sql`, job de CI.
- **Dependências.** `E-15`.
- **Ação.** Guarda 1 (lint sobre a lista de objetos protegidos); Guarda 2 (testes de existência **e** efeito); Guarda 3 (`pg_dump --schema-only --no-owner --no-privileges` comparado ao golden). Alarme `migrate diff --exit-code`. Executar **`V-04`** contra o **workflow de migrations efetivamente adotado** pelo projeto (§9.3, §10), não contra um cenário genérico. Nenhum uso de `db pull` — §10.2.
- **Validação.** **`V-04` aprovada.** Teste negativo obrigatório: remover deliberadamente um objeto protegido e confirmar que **o CI falha**.
- **Critério de aceite.** **`V-04` aprovada** e o teste negativo falhando como esperado. Uma guarda que nunca falhou não está provada.
- **Risco.** **Alto se falhar** — é a mitigação do único risco crítico remanescente. **Rev.** Total.

#### `E-17` — Seeds sintéticos (condicional)

- **Objetivo.** Massa mínima **sintética** para desenvolvimento.
- **Arquivos previstos.** `packages/database/prisma/seed.ts`.
- **Dependências.** `E-15`.
- **Ação.** Executar **somente se** os testes de integração demonstrarem necessidade real de massa compartilhada. **Chamada explícita** — no Prisma 7 o seed **não** roda automaticamente com migrations. Nomes fictícios, CPFs sintéticos com forma válida (11 dígitos), **nenhum dado clínico realista**.
- **Validação.** Seed roda em banco recém-migrado; revisão explícita de ausência de dado real.
- **Critério de aceite.** **Zero** dado real (TLF-BASE-V1 §10); seed idempotente ou claramente destinado a banco limpo.
- **Risco.** **Alto se negligenciado** — é o vetor mais provável de entrada de dado real no repositório. **Rev.** Total.

### Bloco V — Documentação (E-18)

#### `E-18` — Sincronização documental

- **Objetivo.** Manter código e documentação coerentes (TLF-BASE-V1 §4.8).
- **Arquivos previstos.** `docs/08` (atualização), `README.md` (hoje vazio), `packages/database/README.md`.
- **Dependências.** `E-17`.
- **Ação.** Registrar em `docs/08` os resultados de `V-01`..`V-06`, a tabela normativa de erros e a lista final de objetos protegidos. Registrar em `README.md` como subir o ambiente. Documentar o catálogo de `evento_auditoria.acao`/`resultado` e a **lista branca de `contexto`** (`docs/07` §22.3, risco `R2.2-04`).
- **Validação.** Revisão cruzada `docs/07` × schema × migrations.
- **Critério de aceite.** Nenhuma decisão de `docs/07` sem contrapartida física; nenhum objeto físico sem fonte homologada.
- **Risco.** Baixo. **Rev.** Total.

### 13.1 Mapa etapa → exigência do enunciado

| Exigência (§13 do enunciado) | Etapa |
| --- | --- |
| 1 baseline do workspace | `E-01` |
| 2 dependências | `E-01`, `E-03` |
| 3 configuração PostgreSQL | `E-02` |
| 4 configuração Prisma | `E-03` |
| 5 organização do schema | `E-06` |
| 6 criação das entidades | `E-06` |
| 7 enums | `E-05` |
| 8 relações | `E-07` |
| 9 constraints representáveis | `E-07` |
| 10 migrations SQL customizadas | `E-08`..`E-11` |
| 11 `btree_gist` | `E-04` (+`V-01` em `E-02`) |
| 12 exclusion constraints | `E-10` |
| 13 CHECK constraints | `E-09` |
| 14 índices | `E-07` (simples), `E-10` (parciais) |
| 15 triggers | `E-11` |
| 16 normalização/unicidade de CPF | `E-07` (U-07) + `E-09` (CHECK de forma) + `E-14` (testes) |
| 17 integridade do registro clínico | `E-07` (U-13) + `E-11` (trigger) |
| 18 transações/invariantes críticas | `E-12` + `E-14` |
| 19 seeds sintéticos | `E-17` |
| 20 testes de integração | `E-13`, `E-14` |
| 21 testes de migrations de banco vazio | `E-15` |
| 22 validação de drift/reprodutibilidade | `E-16` |
| 23 documentação | `E-18` |

**As 23 exigências estão cobertas.**

---

## 14. Critérios mínimos de testes

Cobertura obrigatória. **Nenhum dado real de paciente em nenhuma circunstância** (TLF-BASE-V1 §10).

| ID | Teste | Objeto verificado | Etapa |
| --- | --- | --- | --- |
| `T-MIG-01` | Banco vazio → schema completo só por migrations | Auto-suficiência do histórico | `E-15` |
| `T-MIG-02` | Migration subsequente **não** descarta objeto SQL customizado | **`R2.2-03`** / `V-04` | `E-16` |
| `T-MIG-03` | `pg_dump --schema-only` idêntico ao golden | Reprodutibilidade integral | `E-16` |
| `T-EXT-01` | `btree_gist` presente após reconstrução | **`H2.2-06`** | `E-04` |
| `T-CPF-01` | CPF normalizado é único | U-07, `H2.2-13` | `E-14` |
| `T-CPF-02` | **CPF nulo permitido, múltiplas vezes** | RN-010; `NULL` distinto (§10.1) | `E-14` |
| `T-CPF-03` | CPF fora de `^[0-9]{11}$` **rejeitado** | CHECK de §11.4.1 | `E-14` |
| `T-CPF-04` | **CPF de paciente inativo não pode ser reusado** | §11.4.2 — unicidade abrange inativos | `E-14` |
| `T-CLIN-01` | `registro_clinico.atendimento_id` **NOT NULL** | U-13 / P-CLIN | `E-14` |
| `T-CLIN-02` | **Dois registros clínicos no mesmo atendimento são impossíveis** | U-13 / IDX-N2 | `E-14` |
| `T-CLIN-03` | `anexo_clinico` exige FK para registro clínico | PRN-006, §22.1 | `E-14` |
| `T-CLIN-04` | `UPDATE`/`DELETE` em registro `FINALIZADO` **falha** | RN-024, PRN-004 — trigger | `E-11` |
| `T-CLIN-05` | `UPDATE` em registro `EM_ELABORACAO` **é permitido** | Trigger **condicional**, não geral | `E-11` |
| `T-AGD-CONFLICT` | Sobreposição do mesmo profissional **rejeitada** | IDX-A1, RN-015.1 | `E-10` |
| `T-AGD-PACIENTE` | Sobreposição do mesmo paciente **rejeitada** | IDX-A2, **D-06** | `E-10` |
| `T-AGD-EDGE-NON-OVERLAP` | Fim 10:00 / início 10:00 **aceito** | Intervalo semiaberto `[)` | `E-10` |
| `T-AGD-LIBERA` | `CANCELADO` e `FALTA` **não** bloqueiam | AGD-003, §17.2 | `E-10` |
| `T-AGD-CONCLUIDO` | **`CONCLUIDO` bloqueia** | **Correção C-04 da REV. 2** | `E-10` |
| `T-AGD-CONCURRENCY` | Duas transações simultâneas → só uma vence | `C-01`, cenário 8 | `E-14` |
| `T-PKG-CONCURRENCY` | Reservas concorrentes não excedem o saldo | `C-02`, lock do pacote | `E-14` |
| `T-PKG-RETRY` | Retry de consumo é **idempotente** | `C-04` + C-6 | `E-14` |
| `T-PKG-AJUSTE` | `AJUSTE_NEGATIVO` que invalidaria reservas é **rejeitado** | `C-09`, H2-10 | `E-14` |
| `T-IDX-PARCIAL` | Índices parciais existem **e** têm efeito | U-03, U-04 e demais | `E-10` |
| `T-CHK-ALL` | Uma inserção violadora por CHECK de §10.2 | Todas as CHECKs | `E-09` |
| `T-FIN-OVERPAY` | Pagamentos concorrentes não excedem o devido | `C-05`, RN-046 | `E-14` |
| `T-FIN-REFUND` | Segundo estorno do mesmo pagamento **falha** | U-05, `H2.2-08` | `E-14` |
| `T-FIN-IDEMP` | `chave_idempotencia` duplicada **rejeitada** | `C-06`, U-09/U-10 | `E-14` |
| `T-FIN-GENCOL` | `valor_liquido` acompanha; escrita **falha** | C-2 / `V-02` | `E-08` |
| `T-AUD-APPEND` | `UPDATE`/`DELETE` nas 5 tabelas append-only **falha** como `tlf_app` | AUD-005, `REVOKE` | `E-11` |
| `T-AUD-CONTEXTO` | Chave fora da lista branca de `contexto` **rejeitada** | **`R2.2-04`** — vazamento clínico | `E-14` |
| `T-FK-RESTRICT` | Nenhuma FK apaga em cascata | §9.2 | `E-14` |

**Cobertura da lista mínima do enunciado §14:** os 17 itens exigidos estão contemplados — criação por migrations (`T-MIG-01`), unicidade de CPF (`T-CPF-01`), CPF nulo (`T-CPF-02`), formato (`T-CPF-03`), CPF de inativo (`T-CPF-04`), `atendimento_id NOT NULL UNIQUE` (`T-CLIN-01`/`02`), FK de anexo (`T-CLIN-03`), conflito de agenda (`T-AGD-CONFLICT`/`PACIENTE`/`CONCURRENCY`), exclusion constraint (`T-AGD-EDGE-NON-OVERLAP`/`LIBERA`/`CONCLUIDO`), `btree_gist` (`T-EXT-01`), índices parciais (`T-IDX-PARCIAL`), CHECKs (`T-CHK-ALL`), triggers (`T-CLIN-04`/`05`), reconstrução (`T-MIG-01`/`03`), migration subsequente sem perda (`T-MIG-02`), permissões e invariantes críticas (`T-AUD-APPEND`, `T-AUD-CONTEXTO`, `T-FK-RESTRICT`, família `T-PKG-*`/`T-FIN-*`).

---

## 15. Riscos da baseline

| ID | Risco | Severidade | Mitigação | Residual |
| --- | --- | --- | --- | --- |
| **`R-BL-01`** | **Governança e manutenção da baseline Prisma.** Risco de **governança**, não de fim de vida anunciado — ver §15.1 | **Média** | Revisão técnica interna programada (§15.1). A tríade de guardas (§9.3) é o que tornará qualquer migração futura auditável | Médio — **inevitável**: não existe linha estável alternativa |
| **`R-BL-02`** | **Custo de configuração do ESM.** Prisma 7 exige ESM; NestJS 11 é CommonJS por padrão. **A escolha está feita** (`D-ESM-01`, §16); o que resta é o esforço de configurar build, decorators e testes, e comprová-lo | **Média** | Backend nasce ESM, quando existir (`node16`/`nodenext`; decorators via SWC com `legacyDecorator` + `decoratorMetadata`). **Não bloqueia a persistência** — `packages/database` é ESM puro sem NestJS. Validação concreta ocorre na etapa de implementação do backend, fora deste plano | Médio até a validação prática — **não mais uma decisão em aberto** |
| **`R-BL-03`** | **TypeScript 6.0 × 7.0.** A 7.0 é a nova implementação nativa (Go) do compilador; nenhum dos três consumidores (Prisma, Next, Jest) declara oficialmente suporte a ela | **Média** | Baseline em 6.0 por maturidade e previsibilidade (§6.3); `V-06` confirma o **teto**; reavaliar quando houver suporte oficial declarado | **Reduzido, não encerrado.** `V-06.b` mediu o teto contra o **Prisma 7** — aprovado. O teto contra o **Next.js 16** permanece **não medido** (`V-06.c`, §12.2) e contra o **Jest 30** depende de `V-05` |
| **`R-BL-04`** | **Jest 30 + ESM + decorators.** Jest suporta ESM, mas exige configuração; a combinação com decorators do NestJS é o ponto sensível | **Média** | `V-05` fecha para o pacote de banco (que **não** usa decorators). Para o backend, decorre de `D-ESM-01` (§16) e é validado na etapa que criar `apps/api` | Baixo na persistência |
| **`R-BL-05`** | **Índices parciais na zona cinzenta de C-3** — o Prisma modela índices e pode propor `DROP` | **Alta se não mitigada** | Tríade de §9.3 + `V-04` bloqueante em `E-16` | **Aberto até `V-04`**; Baixo somente após `E-16` |
| **`R-BL-06`** | **`db pull` executado por engano** degrada o `schema.prisma` — perde objetos não representáveis **e** pode injetar a Preview `partialIndexes` na baseline | **Média** | Política normativa de **§10.2**: fora do fluxo normal; nenhum script no `package.json`; `--print` antes de qualquer materialização; `--force` proibido; snapshot golden e `migrate diff --exit-code` como backstop | Baixo |
| **`R-BL-07`** | **Roles não separadas** tornariam o `REVOKE` de `E-11` inócuo | **Média** | Separação criada já em `E-02`, **antes** de qualquer objeto | Baixo |
| **`R-BL-08`** | **`timeout` padrão de 5 s** do `$transaction` abortando transações sob contenção de lock | **Média** | Configurar `timeout`/`maxWait` explicitamente; cobrir em `T-PKG-CONCURRENCY` | Baixo |
| **`R-BL-09`** | **Vulnerabilidade transitiva no *tooling* do Prisma.** `deepmerge-ts` em versão vulnerável, alcançada pela cadeia `prisma` → `@prisma/config` → `deepmerge-ts` — ver §15.2 | **Alta na publicação do advisory; exposição concreta do projeto reduzida pelo contexto de uso** | **Aceitação temporária monitorada** (§15.2). Não há correção disponível dentro da linha Prisma 7; a única remediação automática oferecida pelo npm é um recuo de major para Prisma 6, que **mudaria a baseline** | **ABERTO** — reavaliar a cada atualização do Prisma 7 e obrigatoriamente antes de CI de produção/deploy |

**Riscos herdados de `docs/07` §26 que este documento move:** `R2.2-03` (perda silenciosa) é **reduzido** de "Crítico, aberto" para **"Médio, aberto"** pela evidência documental de §9.2.1, e torna-se **Baixo somente após `V-04` aprovada e a tríade ativa em `E-16`** — ver §9.2.4. **Este documento não fecha `R2.2-03`.** O que este documento fecha é **`P2.2-08`** (fixação de versões e verificação da Categoria C).

### 15.1 `R-BL-01` — o que é fato e o que é governança

Esta seção existe porque a REV. 0 apresentava como **fato de EOL** algo que a evidência oficial não sustenta nessa forma.

**Fato oficial, citado literalmente.** O anúncio *The Next Evolution of Prisma ORM*, publicado pela Prisma em **04/03/2026**, afirma sobre a linha 7:

> *"It remains the recommended version of Prisma for production applications and will continue to receive updates and support for the next 12 months."*

**O que esse fato sustenta e o que não sustenta:**

| Afirmação | Situação |
| --- | --- |
| A Prisma declarou que a linha 7 é a **versão recomendada para produção** | **Fato**, com fonte |
| A Prisma declarou compromisso de **atualizações e suporte** para a linha 7 | **Fato**, com fonte |
| O Prisma 8 está em **Early Access** e não é elegível para a baseline (§3) | **Fato**, com fonte |
| A Prisma publicou uma **data de EOL** para a linha 7 | **Não sustentado.** A página oficial de *releases and maturity levels* descreve cadência e níveis de maturidade, mas **não trata de janelas de suporte, EOL ou duração de suporte de versões major** |
| "O suporte do Prisma 7 vai até aproximadamente março de 2027" | **Removido.** Era uma **derivação aritmética** da citação acima, apresentada com peso de fato oficial. **Nenhuma data de EOL do Prisma é afirmada por este documento.** |

**Reclassificação do risco.** `R-BL-01` deixa de ser "janela de suporte com prazo conhecido" e passa a ser **risco de governança e manutenção da baseline**: o ORM e seu ecossistema evoluem rapidamente, a linha seguinte já existe em Early Access, e o projeto precisa de um momento programado para reavaliar — não de uma contagem regressiva inventada.

**Decisão de governança do TechLab Fisio:**

> A baseline Prisma 7 deve ser reavaliada periodicamente, em razão da evolução rápida do ORM e do ecossistema. Fica recomendada uma **revisão técnica interna em janeiro de 2027**, antes de qualquer ciclo relevante de atualização de dependências.
>
> **Essa data é uma decisão interna de governança do TechLab Fisio. Ela não representa EOL oficial do Prisma, nem qualquer prazo declarado pelo fornecedor.**

A revisão deve consultar as fontes oficiais **na data em que ocorrer** — nunca reaproveitar as conclusões desta seção — e verificar: maturidade da linha 8, existência (ou não) de política de suporte publicada, e compatibilidade com Node, PostgreSQL e TypeScript vigentes. Migrar de linha major é mudança de baseline, sujeita ao rito de TLF-BASE-V1 §14. A tríade de guardas de §9.3 é o que tornará essa migração auditável.


---

### 15.2 `R-BL-09` — vulnerabilidade transitiva em *tooling* Prisma

Registrada na **REV. 4**, a partir de medição executada na consolidação de `E-01`..`E-03`. Esta seção separa **fato medido**, **exposição** e **tratamento**, e não confunde as três coisas.

#### 15.2.1 Fato

Tudo abaixo foi **medido no repositório**, não presumido, e conferido contra o advisory oficial.

| Item | Valor |
| --- | --- |
| Pacote afetado | **`deepmerge-ts`** (npm) |
| Versão efetivamente instalada | **`7.1.5`** |
| Cadeia de dependência | `prisma@7.9.1` → `@prisma/config@7.9.1` → `deepmerge-ts@7.1.5` — **transitiva de terceiro nível**, declarada como `dependencies` do `@prisma/config`, não escolhida por este projeto |
| Advisory | **GHSA-ggr8-5vv4-36mx** — *"DeepmergeTS has stack exhaustion when merging recursive object graphs"* |
| CVE | **CVE-2026-40345** |
| Severidade publicada | **Alta (High)** — CVSS **8.2** |
| Classe | **CWE-674** — *Uncontrolled Recursion* |
| Faixa vulnerável | `< 8.0.0` |
| Versão corrigida segundo o advisory | **`8.0.0`** (a linha 8 já está publicada: `8.0.0`, `8.0.1`) |
| Natureza | A biblioteca não faz detecção de ciclo. Ao mesclar dois objetos com auto-referência no mesmo caminho de propriedade, a recursão não termina e a pilha estoura (`RangeError: Maximum call stack size exceeded`). É **negação de serviço**, não execução de código nem vazamento de dados |
| Contagem do `npm audit` | **3 vulnerabilidades altas** — que são **a mesma cadeia contada três vezes** (`deepmerge-ts`, `@prisma/config` e `prisma`), e não três problemas distintos |

**Não existe correção dentro da linha Prisma 7 na data desta revisão.** Verificado pacote a pacote: `@prisma/config` nas versões `7.8.0`, `7.9.0` e `7.9.1` — a mais recente publicada — depende de `deepmerge-ts@7.1.5`. A única remediação que o `npm audit` oferece automaticamente é `prisma@6.12.0`, marcada por ele próprio como `isSemVerMajor: true`.

#### 15.2.2 Exposição do TechLab Fisio

**Classificação: risco de *supply chain* / *tooling*, com exposição concreta atual reduzida pelo contexto de uso — não nula.**

O que sustenta a redução:

1. `@prisma/config` é a camada que **lê e mescla a configuração do CLI** (`prisma.config.ts` e padrões). Ela é exercitada em tempo de **desenvolvimento e de migrations**, não no caminho de requisição da aplicação.
2. `@prisma/client` e `@prisma/adapter-pg` — os pacotes que efetivamente entram no runtime — **não** têm `deepmerge-ts` em sua cadeia.
3. As entradas mescladas hoje são **autoria do próprio repositório** (o `prisma.config.ts` versionado) e não dados de usuário. Um grafo recursivo malicioso não tem por onde chegar.
4. O impacto do defeito é **exaustão de pilha**, cujo pior efeito neste contexto é a queda de um comando de CLI executado por um desenvolvedor.

O que **impede** declarar ausência de risco:

1. **A dependência está instalada.** Ela existe na árvore do repositório e no `package-lock.json`, e é código de terceiro executado na máquina de quem desenvolve e, futuramente, no runner de CI.
2. **A fronteira "tooling" não é garantida por contrato.** Ela decorre de como o Prisma organiza seus pacotes hoje, e pode mudar sem aviso em uma minor.
3. **Superfície de *supply chain* permanece.** Um pacote vulnerável e desatualizado na cadeia é um indicador de manutenção que merece acompanhamento, independentemente do vetor específico.

> **Este documento não afirma que `R-BL-09` é "sem risco".** Afirma que, no uso atual, a exposição é reduzida — e que essa redução é **circunstancial**, não estrutural.

#### 15.2.3 Tratamento — aceitação temporária monitorada

**Decisão:** manter **`prisma@7.9.1`** e aceitar o risco temporariamente, sob monitoramento.

O que **não** se faz, e por quê:

| Ação descartada | Motivo |
| --- | --- |
| `npm audit fix --force` | Instalaria **`prisma@6.12.0`** — recuo de **major** fora da baseline homologada de §6, revertendo por efeito colateral de um comando de conveniência uma decisão tomada por escrito. Exatamente o tipo de mudança que TLF-BASE-V1 §14 e §15 sujeitam a rito |
| Recuar para Prisma 6 | Mudança de baseline. Além disso, o Prisma 6 não tem a arquitetura de driver adapter e `prisma.config.ts` sobre a qual `E-03` foi construída |
| Avançar para Prisma 8 | **Early Access** — proibido pela regra de exclusão de §3 |
| `overrides` forçando `deepmerge-ts@8` | Alteraria uma dependência transitiva **fora do contrato declarado pelo fornecedor**. O `@prisma/config` fixa `7.1.5` exatamente, não uma faixa; forçar a linha 8 (que é major) sem que o Prisma a tenha validado troca um risco conhecido e delimitado por um risco desconhecido de incompatibilidade silenciosa no caminho de migrations — o caminho de que depende toda a integridade do modelo físico |

**Regime de monitoramento — vinculante:**

1. **Reavaliar a cada atualização da linha Prisma 7.** Verificar se `@prisma/config` passou a depender de `deepmerge-ts >= 8.0.0`.
2. **Se uma versão 7.x corrigir a cadeia sem quebrar a baseline, propor o upgrade** — atualização de patch/minor dentro da linha homologada, não mudança de baseline.
3. **Verificar novamente antes de qualquer CI de produção ou deploy.** Aceitar o risco em desenvolvimento não o aceita em produção.
4. **A aceitação deixa de ser suficiente** — e o risco deve ser reaberto imediatamente — se `deepmerge-ts` passar a participar de **caminho de runtime com entrada não confiável**, ou se o advisory for reclassificado.
5. Insumo obrigatório da revisão de governança de §15.1, junto com `R-BL-01`.

**Nenhuma versão da baseline de §6 foi alterada por este registro.**

---

## 16. Decisão consolidada — formato de módulo (ESM)

**Nenhuma decisão deste documento permanece pendente de arbitragem arquitetural.** A única que estava em aberto na REV. 0 foi **resolvida** na REV. 1.

### `D-ESM-01` — Formato de módulo do backend e do workspace de banco

> **DECISÃO CONSOLIDADA (REV. 1):** **Backend e workspace de banco devem ser configurados para ESM desde sua criação. Não se aguardará o NestJS 12 para iniciar o backend.**

- **Substitui.** A antiga pendência **`D-PEND-01`**, que ficou **encerrada** e foi removida da lista de pendências (§19). Referências a ela em outras seções foram atualizadas.
- **Questão original.** O Prisma 7 **exige** ESM (`"type": "module"`; CommonJS não suportado) e **exige** driver adapter. O NestJS 11 é CommonJS por padrão. Como configurar o backend?
- **Alternativa escolhida.** A **Alternativa A** da análise abaixo — ESM desde o início — que já era a recomendação técnica da REV. 0.
- **Alternativa descartada.** A **Alternativa B** — manter CommonJS atrás de uma fronteira, aguardando o NestJS 12. Descartada porque aposta em uma release **não lançada** (PR de release aberto, previsão ~Q3/2026) e paga atrito estrutural todos os dias até ela chegar.

| | **Alternativa A — escolhida** | **Alternativa B — descartada** |
| --- | --- | --- |
| **Descrição** | Backend NestJS 11 configurado como **ESM desde o início** (`node16`/`nodenext`, decorators via SWC com `legacyDecorator` + `decoratorMetadata`) | Manter o backend em **CommonJS** e isolar o Prisma atrás de uma fronteira, aguardando o NestJS 12 |
| **Custo** | Configuração inicial de build e testes; imports com extensão explícita; ajuste do Jest | Camada de isolamento artificial; **atrito permanente** entre um app CJS e um Client ESM; risco de a fronteira vazar |
| **Risco** | Médio e **concentrado no início**, quando não há código a migrar | Médio e **crescente**; depende de release não lançada; migração futura sobre base já construída |
| **Reversibilidade** | Alta hoje; baixa depois do backend pronto | Baixa — a fronteira vira dívida estrutural |

- **Justificativa.** O repositório **não tem uma linha de código de aplicação** (§2.1). O custo do ESM é mínimo agora e cresce monotonicamente a cada arquivo escrito. A decisão também alinha o projeto ao NestJS 12 quando este for lançado, em vez de exigir uma migração posterior sobre base já construída.

#### 16.1 Consequências vinculantes

1. **Prisma 7 opera em sua configuração ESM suportada** — que é, de resto, a única suportada pela linha 7.
2. **O futuro `apps/api`, com NestJS 11, nasce compatível com ESM.** Nenhuma fronteira de isolamento CJS/ESM será construída.
3. **`package.json`, `tsconfig` e Jest devem ser configurados de maneira coerente** com ESM em todo o monorepo — raiz com `"type": "module"`, `module`/`moduleResolution` em `node16`/`nodenext`, e a configuração de ESM do Jest exercitada por `V-05`.
4. **A compatibilidade concreta será validada durante as etapas de implementação**, não aqui. `V-05` cobre o pacote de banco; a validação do backend (decorators, build, testes) pertence à etapa que criar `apps/api`. `R-BL-02` permanece aberto **como esforço de configuração a comprovar**, não como decisão a tomar.
5. **Esta decisão não autoriza criar `apps/api` agora.** Nenhuma etapa deste plano o cria, e o escopo desta fase termina na persistência.

#### 16.2 Situação quanto a autorização

A decisão é registrada como **consolidada** neste documento mutável, no destino correto para decisões de arquitetura mutáveis (TLF-BASE-V1 §9). Ela **não conflita com a Base Imutável**: TLF-BASE-V1 §9 nomeia Prisma e NestJS sem prescrever formato de módulo. Como toda a §13, ela integrou o conjunto submetido a Bruno e foi **homologada em 20/08/2026** (§0.1, item 2) — o ato de autorização previsto em TLF-BASE-V1 §14 e §15.

#### 16.3 Observação de baseline decorrente (não é decisão)

Registrado como **fato verificado, sem impacto na baseline atual**: o roadmap público do NestJS 12 prevê, além do ESM, substituições de ferramental — entre elas Vitest no lugar do Jest. Isso **não altera nada** neste documento: TLF-BASE-V1 §9 fixa Jest, a v12 não existe como release, e nenhuma decisão é tomada aqui a respeito. Fica como **insumo para a revisão de governança de §15.1**, não como pendência.

---

## 17. Validação final

### 17.1 Checklist obrigatório

| Verificação exigida | Resultado |
| --- | --- |
| Os seis itens de §28.2 foram relidos e todos respondidos | ✔ §7 — C-1 a C-6, com decisão, justificativa e risco |
| Consistência entre as versões escolhidas | ✔ §6.2 — 8 pares verificados; o único com ressalva (ESM) tem **decisão consolidada** em `D-ESM-01` (§16) |
| Baseline revalidada em fontes oficiais na data desta revisão | ✔ §3.1 — 11 itens reconsultados em 20/08/2026; nenhuma linha da baseline alterada |
| Nenhuma decisão simultaneamente aprovada e pendente | ✔ `D-PEND-01` encerrada em §16 e removida de §19; `P2.2-08` encerrada e riscada em §19 |
| Nenhum risco declarado encerrado com `V-*` pendente | ✔ `R2.2-03` e `R-BL-05` permanecem **abertos** até `V-04` (§9.2.4, §15) |
| Nenhuma verificação marcada como executada | ✔ **no ato da homologação** — `V-01`..`V-06` estavam então todas pendentes. **Estado corrente em §12.1**, atualizado pela REV. 4 |
| Homologação registrada formalmente | ✔ §0 — autoridade, data, objeto, o que fica homologado e o que **não** é alterado por ela |
| Status do documento coerente em todas as áreas | ✔ cabeçalho, histórico de revisões, §0, §1.3, §16.2, §17.3, §17.4, §19, §20.1 e encerramento sincronizados |
| Compatibilidade Node ↔ Prisma ↔ Next ↔ Nest | ✔ §4.2 — cada uma contra requisito oficial |
| Compatibilidade Prisma ↔ PostgreSQL | ✔ §5.2 — matriz oficial lista PostgreSQL 18 |
| Estratégia de `btree_gist` | ✔ §5.5 — 7 pontos; 6 fechados por documentação e o 7º (ponto 4) **fechado por `V-01`, aprovada em 20/08/2026** (REV. 4) |
| Estratégia para objetos SQL customizados | ✔ §9 — comportamento por operação + tríade de guardas |
| Nenhuma decisão homologada de `docs/07` perdida | ✔ §17.2 |
| Nenhuma Base Imutável modificada | ✔ §17.3 |
| `git diff` e `git status` executados | ✔ §17.4 |
| Arquivos alterados listados | ✔ §17.4 |

> **Nota da REV. 4.** O checklist acima registra a validação **do documento no ato da homologação**. Ele não é reescrito a cada etapa executada: o estado corrente das verificações vive em **§12.1**, e o dos riscos em **§15**.

### 17.2 Nenhuma decisão homologada foi perdida

| Decisão de `docs/07` | Preservada em |
| --- | --- |
| **P-CLIN Alternativa A** — `registro_clinico.atendimento_id NOT NULL UNIQUE` (U-13, IDX-N2) | `E-07`; `T-CLIN-01`, `T-CLIN-02` |
| **`H2.2-06`** — exclusion constraints com `btree_gist` verificado | §5.5; `E-04`, `E-10`; `T-EXT-01`, `T-AGD-*` |
| **`H2.2-06` correção C-04** — `CONCLUIDO` participa da restrição | `E-10`; **`T-AGD-CONCLUIDO`** |
| **`H2.2-13`** — CPF opcional, normalizado, único, abrangendo inativos | `E-07`, `E-09`; `T-CPF-01`..`04` |
| **`H2.2-08`** — um estorno integral por pagamento | `E-07`; `T-FIN-REFUND` |
| **`H2.2-11`** — FK `movimento_sessao → atendimento` sem ownership | `E-07` |
| **`H2.2-04`/C-03** — índice único **parcial** de consumo | `E-10`; `T-IDX-PARCIAL`, `T-PKG-RETRY` |
| **`H2.2-02`/C-02** — `reserva_sessao` sem enum de situação | `E-06`, `E-09` |
| **`H2.2-05`** — row lock do pacote | **C-4**; `E-12`; `T-PKG-CONCURRENCY` |
| **`H2.2-07`** — lock da cobrança | **C-4**; `T-FIN-OVERPAY` |
| **`H2.2-09`** — estados derivados, não materializados | `E-06` (nenhuma coluna de situação) |
| **`H2.2-10`/`PROP-RN-2.2-01`** — data de referência dinâmica | `E-06`; `docs/07` §20.3 preservado |
| **`PROP-RN-2.2-02`** — cancelamento de agendamento não cancela cobrança | Nenhum objeto físico contraria |
| **`H2.2-14`/C-06** — append-only priorizado: `REVOKE` em 4+1, trigger só nas 2 clínicas | `E-11`; `T-AUD-APPEND`, `T-CLIN-04`, `T-CLIN-05` |
| **`H2.2-15`** — semântica temporal | `E-06` (§5.4) |
| **`H2.2-18`** — objetos B/C em migrations versionadas **com testes de efeito** | §9.3, §10; `E-16` |
| **§10.1** — `NULLS NOT DISTINCT` **não** usado | Categoria D (§8); `T-CPF-02` |
| **§2.2** — `evento_auditoria.resultado` é `text`, não enum | `E-05` (proibição explícita) |
| **§9.2** — `RESTRICT` em todas as FKs | `E-07`; `T-FK-RESTRICT` |
| **§2.4** — nomenclatura `EM_ELABORACAO`/`EFETIVADA` | `E-05` |
| **`P2.2-10`** — aggregate root de `Atendimento` em aberto | **Não reaberto.** Nenhuma etapa o promove |

**Nenhuma decisão homologada foi reaberta, contornada, minimizada ou perdida.** As três divergências de §11 são de **justificativa e escopo**, não de decisão.

### 17.3 Declaração de conformidade

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — **não editado, não resumido, não reinterpretado**. Permanece não rastreado e byte a byte idêntico.
- `docs/02` a `docs/07` — **não alterados**.
- Nenhum `schema.prisma`, migration, DDL, tabela, entidade, endpoint, DTO ou frontend criado.
- Nenhuma dependência instalada; nenhum `npm install`; nenhum `package.json` criado.
- Revisões 0 e 1: nenhum commit, push, PR, merge, rebase ou deploy. **REV. 2:** commit documental e push da branch de trabalho **expressamente autorizados** por Bruno (§0, §20.1); PR, merge, rebase, force push, tag, release e deploy **continuam não realizados**. **Em nenhuma revisão se trabalhou em `main`.**
- Nenhuma alteração preexistente descartada.
- Nenhuma decisão homologada reaberta sem conflito demonstrável.
- Nenhum artefato Preview, Beta, RC, Canary ou Early Access na baseline.
- Nenhum dado real de paciente; nenhum material proprietário de terceiros.
- **Um único arquivo criado:** `docs/08-baseline-tecnica-plano-implementacao.md` — documentação mutável, no destino correto, com sequência numérica verificada.
- **REV. 1:** **um único arquivo alterado** — este mesmo `docs/08`. Nenhum outro arquivo do repositório foi criado, alterado ou removido; nenhum comando de implementação, instalação ou banco foi executado; nenhuma verificação `V-*` foi executada (§12.1).
- **REV. 2:** único arquivo **alterado** continua sendo `docs/08` (registro de homologação em §0, sincronização de status e a correção editorial de §4.3). Os outros dois arquivos foram **adicionados ao controle de versão sem qualquer modificação de conteúdo**. Nenhuma implementação, nenhuma dependência, nenhuma verificação `V-*` executada.

### 17.4 Estado Git

**Revisões 0 e 1** — inicial e final idênticos quanto a commits. Branch `agent/fase2-etapa2.2-persistencia`, HEAD `f9d8296` — inalterado. `git status --porcelain` final:

```
?? TECHLAB_FISIO_BASE_IMUTAVEL_V1.md
?? docs/07-modelo-persistencia.md
?? docs/08-baseline-tecnica-plano-implementacao.md
```

**REV. 2 — versionamento autorizado.** Com a homologação de §0, Bruno autorizou o commit documental. Foi criado **um único commit**, na mesma branch de trabalho, contendo **exclusivamente** os três arquivos acima, e a branch foi publicada em `origin`. Detalhes e efeito sobre `R2.2-16` em **§20.1**.

**Não realizados e não autorizados por este ato:** merge na `main`, pull request, rebase, force push, tag, release e deploy. A branch `main` **não foi tocada**.

**REV. 4 — implementação da fundação, ainda não versionada.** `E-01`..`E-03` foram implementadas na branch de trabalho **`agent/fase2-implementacao-e01-e03`**, criada a partir do commit documental `d20b3b3`. **Nenhum commit, `git add`, push, PR, merge, rebase, tag ou deploy foi realizado**: `HEAD` permanece em `d20b3b3` e a área de stage permanece vazia. Os artefatos de fundação existem apenas como alterações da árvore de trabalho, deliberadamente, para permitir revisão do diff **antes** de qualquer publicação. O Prisma Client gerado **não é versionado** — é artefato derivável de `schema.prisma` + versão fixada do Prisma + `package-lock.json` + `prisma generate`, e está coberto por regra específica de `.gitignore`.

**REV. 5 — implementação do Bloco II, ainda não versionada.** A fundação da REV. 4 foi posteriormente versionada no commit **`b231ff8`** (`feat(database): establish persistence foundation`), na branch `agent/fase2-implementacao-e01-e03`, publicada em `origin`. `E-04`..`E-07` foram implementadas em branch dedicada **`agent/fase2-implementacao-e04-e07`**, criada **exatamente a partir de `b231ff8`**. O commit `b231ff8` **não foi alterado, emendado nem reescrito**; nenhum rebase e nenhum force push ocorreram. **Nenhum `git add`, commit, push, PR, merge, tag, release ou deploy foi realizado nesta etapa**: `HEAD` permanece em `b231ff8`, a área de stage permanece **vazia** e a `main` **não foi tocada**. As alterações de `E-04`..`E-07` — `packages/database/prisma/schema.prisma`, três novas pastas em `packages/database/prisma/migrations/` e este documento — existem apenas como alterações da árvore de trabalho, deliberadamente, para permitir **revisão independente do diff e das migrations antes de qualquer publicação**.

**REV. 6 — correção pré-versionamento, ainda não versionada.** A revisão independente prevista pela REV. 5 foi executada e suas correções aprovadas foram aplicadas **na mesma branch `agent/fase2-implementacao-e04-e07`, sobre a mesma árvore de trabalho**. Nenhum arquivo novo foi criado e nenhum foi removido: o conjunto de alterações continua sendo `schema.prisma`, `docs/08` e as quatro pastas de migration não rastreadas. **`HEAD` permanece em `b231ff8`**, a área de stage permanece **vazia** e a `main` continua não tocada. Nenhum `git add`, commit, push, PR, merge, rebase, tag, release ou deploy foi realizado. `docs/07`, `docs/02`..`docs/06` e `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` permanecem com diff vazio.

---

## 18. Fontes consultadas

### 18.1 Internas

| Fonte | Uso |
| --- | --- |
| `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` (integral) | §2 identidade, §4 princípios, §9 arquitetura, §10 segurança, §14 governança, §15 hierarquia |
| `docs/07-modelo-persistencia.md` (integral) | §5, §6, §7, §9, §10, §10-A, §11.4, §17, §18, §19, §22, §24, §26, §28 |
| `docs/06-modelo-dominio.md` | H2-01..H2-12, `C-01`..`C-09`, T-01..T-09 |
| `docs/02` a `docs/05` | Verificação de ausência de fixação de versão |
| Estado real do repositório | `git rev-parse`, `git log`, `git status`, `git ls-files`, inventário de arquivos |

### 18.2 Fontes revalidadas na REV. 1 — data, URL e fato sustentado

Consultadas em **20/08/2026**, todas **oficiais primárias**. Nenhuma fonte de terceiros foi usada como base de afirmação sustentada por documentação oficial. As duas exceções estão marcadas e são usadas apenas para **contexto de roadmap**, nunca como fato de baseline.

| # | Fonte oficial | URL | Fato que a fonte sustenta |
| --- | --- | --- | --- |
| 1 | Node.js — *Previous Releases* | `https://nodejs.org/en/about/previous-releases` | v26 em **Current** (desde 05/05/2026); **v24 "Krypton"** e v22 "Jod" em LTS; v25, v23, v20 e anteriores **EOL**. Recomendação oficial: produção apenas em Active/Maintenance LTS |
| 2 | PostgreSQL — *Versioning Policy* | `https://www.postgresql.org/support/versioning/` | 5 anos de suporte por major; minor a cada ~3 meses. **18 → EOL 14/11/2030**; 17 → 08/11/2029; 15 → 11/11/2027; **14 → 12/11/2026**. Recomendação de sempre rodar a minor corrente |
| 3 | Prisma — *System requirements* | `https://www.prisma.io/docs/orm/reference/system-requirements` | Node `^20.19.0 \|\| ^22.12.0 \|\| ^24.0.0`; TypeScript **5.4+**; política de testar todas as releases Active/Maintenance LTS |
| 4 | Prisma — *Supported databases* | `https://www.prisma.io/docs/orm/reference/supported-databases` | PostgreSQL **9.6 a 18** oficialmente suportados |
| 5 | Prisma — *Preview features* | `https://www.prisma.io/docs/orm/reference/preview-features/client-preview-features` | `partialIndexes` **em Preview desde 7.4.0**; `postgresqlExtensions` **ausente** das listas de Preview e de GA; `driverAdapters` promovido a GA em 6.16.0 |
| 6 | Prisma — *Upgrade to v7* | `https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7` | **ESM obrigatório** (`"type": "module"`; CommonJS não suportado); **driver adapter obrigatório**; **`output` obrigatório** no generator; variáveis de ambiente **não** carregam automaticamente; seed **não** roda automaticamente |
| 7 | Prisma — *The Next Evolution of Prisma ORM* (04/03/2026) | `https://www.prisma.io/blog/the-next-evolution-of-prisma-orm` | Linha 7 declarada **versão recomendada para produção**, com *"updates and support for the next 12 months"*. Prisma 8 em **Early Access**. **Nenhuma data de EOL declarada** — base de §15.1 |
| 8 | Prisma — *Releases and maturity levels* | `https://www.prisma.io/docs/orm/more/releases` | Define Early Access / Preview / GA e a cadência de releases. **Não trata de janela de suporte, EOL ou duração de suporte de majors** — sustenta a remoção da afirmação de EOL em `R-BL-01` |
| 9 | Prisma — *CLI reference* | `https://www.prisma.io/docs/orm/reference/prisma-cli-reference` | `db pull` sobrescreve o `schema.prisma` (*"Some manual changes or customization can be lost"*); **`--force`** ignora modificações manuais; **`--print`** existe e imprime sem escrever no disco; `db push` possui `--force-reset` e `--accept-data-loss`. Base de §10.2 |
| 10 | Prisma — *Introspection* | `https://www.prisma.io/docs/orm/prisma-schema/introspection` | Lista oficial de **não suportados**: Check Constraints, Exclusion Constraints, Expression indexes, RLS, tabelas particionadas, deferred constraints, index sort order, comentários. Reintrospection **preserva** ordem de blocos, comentários, `@map` e nomes de `@relation`, salvo com `--force`. **Índices parciais e triggers não constam da lista** |
| 11 | Prisma — *Indexes* | `https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes` | Predicado `where` em `@@index`/`@@unique` exige a Preview **`partialIndexes`**; na introspection o Prisma **acrescenta `partialIndexes` às `previewFeatures`** e representa o predicado por `raw()` na forma normalizada do banco. **Expression indexes não suportados.** Base decisiva de §10.2.2 |
| 12 | Prisma — *PostgreSQL extensions* | `https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions` | Caminho oficial é **exclusivamente** migration customizada com `CREATE EXTENSION IF NOT EXISTS`; **não há** campo `extensions` no `datasource` nem Preview correspondente. Sustenta **C-1** |
| 13 | Prisma — *Development and production* | `https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production` | `migrate deploy` **não** detecta drift e **não** usa shadow database; `migrate dev` reexecuta o histórico no shadow; `migrate reset` derruba, recria e reaplica todo o histórico |
| 14 | Prisma — *Limitations and known issues* | `https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues` | `migrate dev` **não é suportado** em ambientes não interativos (Docker, scripts Node, shells). Sustenta §10, ponto 8 |
| 15 | Prisma — *Raw queries* | `https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries` | *"You can use `.$executeRaw()` and `.$queryRaw()` inside a transaction."* `$queryRaw` com template tag gera prepared statements seguros; `$queryRawUnsafe` não. Sustenta **C-4** |
| 16 | TypeScript — blog oficial | `https://devblogs.microsoft.com/typescript/` | **6.0 em 23/03/2026**, pretendida como *"the last release based on the current JavaScript codebase"*; **7.0 em 08/07/2026**, *port* **nativo em Go**, ~10× mais rápido que a 6.0. Base de §6.3 e `R-BL-03` |
| 17 | Next.js — *Installation* | `https://nextjs.org/docs/app/getting-started/installation` | Documentação na versão **16.3.1** (atualizada em 21/07/2026); Node mínimo **20.9**; TypeScript mínimo **5.1** |
| 18 | NestJS — releases no GitHub | `https://github.com/nestjs/nest/releases` | Linha estável corrente **11.2.x**. **Nenhuma release 12.x publicada** |
| 19 | NestJS — PR de release v12.0.0 | `https://github.com/nestjs/nest/pull/16391` | v12 existe como **PR de release aberto**, previsão ~**Q3/2026**, migração completa para ESM. Sustenta que a v12 **não** é elegível para baseline |
| 20 | Jest — *Jest 30* | `https://jestjs.io/blog/2025/06/04/jest-30` | TypeScript mínimo **5.4**; suporte a Node 14, 16, 19 e 21 **removido**; ESM suportado com melhorias (`import.meta`, `.mts`/`.cts`), porém **exigindo configuração** |

> **Nota sobre roadmap de terceiros.** A previsão de que o NestJS 12 substituirá Jest por Vitest e ESLint por oxlint aparece em cobertura de imprensa técnica e em material da comunidade, **não** em documentação oficial de release. Está registrada apenas em §16.3, explicitamente como **insumo de governança futura**, e **nenhuma decisão deste documento se apoia nela**.

### 18.3 Documentação oficial externa — referência completa

**Node.js**
- [Previous Releases](https://nodejs.org/en/about/previous-releases) — status LTS/EOL por linha
- [Download](https://nodejs.org/en/download) — LTS corrente

**PostgreSQL**
- [Versioning Policy](https://www.postgresql.org/support/versioning/) — 5 anos por major; EOL
- [btree_gist (18)](https://www.postgresql.org/docs/18/btree-gist.html) — tipos suportados (inclui `uuid`); status *trusted*
- [Imagem oficial `postgres`](https://hub.docker.com/_/postgres) — tags e variantes

**Prisma ORM**
- [Supported databases](https://www.prisma.io/docs/orm/reference/supported-databases) — PostgreSQL 18
- [System requirements](https://www.prisma.io/docs/orm/reference/system-requirements) — Node `^20.19 || ^22.12 || ^24`; TS ≥5.4
- [Prisma 7 release](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) — Rust-free; `prisma-client`; `prisma.config.ts`
- [Upgrade to Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — ESM obrigatório; adapter obrigatório; `output` obrigatório
- [The Next Evolution of Prisma ORM](https://www.prisma.io/blog/the-next-evolution-of-prisma-orm) — Prisma 8 Early Access; suporte da 7
- [Releases and maturity levels](https://www.prisma.io/docs/orm/more/releases) — Early Access / Preview / GA
- [Preview features](https://www.prisma.io/docs/orm/reference/preview-features/client-preview-features) — `partialIndexes` (7.4.0); **ausência de `postgresqlExtensions`**
- [Indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) — predicado sob Preview; expression indexes não suportados
- [PostgreSQL extensions](https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions) — `CREATE EXTENSION` por migration
- [Unsupported database features](https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features) — `--create-only`
- [Customizing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)
- [Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) — `migrate dev`/`deploy`/`reset`
- [Shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database) — reexecução do histórico; `CREATEDB`
- [Mental model](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/mental-model) — quatro fontes de verdade; drift
- [Limitations and known issues](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues) — `migrate dev` não suportado em ambiente não interativo
- [Introspection](https://www.prisma.io/docs/orm/prisma-schema/introspection) — **CHECK, exclusion e expression indexes declarados não suportados**
- [CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference) — `migrate diff`, `db push`, `db pull`
- [Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — interativas; `isolationLevel`; `maxWait`/`timeout`
- [Raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries) — "You can use `.$executeRaw()` and `.$queryRaw()` inside a transaction"
- [Error reference](https://www.prisma.io/docs/orm/reference/error-reference) — P2002/P2003/P2004/P2011
- [PostgreSQL connector](https://www.prisma.io/docs/orm/overview/databases/postgresql) — `@prisma/adapter-pg`

**Next.js**
- [Installation](https://nextjs.org/docs/app/getting-started/installation) — Node ≥20.9; TS ≥5.1
- [Blog](https://nextjs.org/blog) — 16.3 (03/08/2026); Active/Maintenance LTS

**NestJS**
- [`@nestjs/core` — `package.json`](https://raw.githubusercontent.com/nestjs/nest/master/package.json) — `engines.node: ">= 20"`
- [Releases](https://github.com/nestjs/nest/releases) — 11.2.x
- [PR v12.0.0](https://github.com/nestjs/nest/pull/16391) — ESM no core; **não lançada**

**Jest**
- [Jest 30](https://jestjs.io/blog/2025/06/04/jest-30) — Node ≥18; TS ≥5.4
- [ECMAScript Modules](https://jestjs.io/docs/ecmascript-modules)

**TypeScript**
- [TypeScript Blog](https://devblogs.microsoft.com/typescript/) — 7.0 (08/07/2026, port Go); 6.0 (23/03/2026)

---

## 19. Pendências

| ID | Pendência | Natureza | Bloqueia? |
| --- | --- | --- | --- |
| ~~`P2.2-08`~~ | Versões de PostgreSQL e Prisma; Categoria C | **ENCERRADA por este documento** (§6, §7) | — |
| ~~`D-PEND-01`~~ | Formato de módulo do backend (ESM × CJS) | **ENCERRADA na REV. 1.** Consolidada como **`D-ESM-01`** (§16): ESM desde a criação; não se aguarda o NestJS 12 | — |
| ~~`V-01`~~ | `btree_gist` — disponibilidade e permissão na imagem | **APROVADA em 20/08/2026**, durante `E-02` (§12.1). Fecha `H2.2-06` no ponto 4 de §5.5 | — |
| `V-03` | Forma concreta do erro por constraint | Técnica — teste local — **PENDENTE** | **Bloqueia `E-12`** |
| `V-04` | Sobrevivência dos objetos SQL ao workflow real de migrations | Técnica — teste local — **PENDENTE** | **Bloqueia `E-16`**; impede encerrar `R2.2-03` e `R-BL-05` |
| `V-02`, `V-05` | Coluna gerada; Jest + ESM | Técnica — teste local — **PENDENTES** | Bloqueiam `E-08` e `E-13`, respectivamente |
| `V-06` | Teto do TypeScript 6.0 e npm efetivo | Técnica — teste local — **PARCIALMENTE APROVADA.** `V-06.a` **APROVADA** em `E-01`; `V-06.b` **APROVADA** em `E-03`; **`V-06.c` PENDENTE** (§12.2) | **Não bloqueia mais `E-01` nem `E-03`** — ambas executadas. `V-06.c` bloqueia apenas o scaffold do frontend e **não bloqueia `E-04`..`E-07`**. Impede declarar `R-BL-03` encerrado |
| `R-BL-09` | Vulnerabilidade transitiva em `deepmerge-ts`, via `prisma` → `@prisma/config` | **Segurança de *supply chain* / tooling** (§15.2). **ABERTO — aceitação temporária monitorada.** Remedido em 20/08/2026 durante `E-04`..`E-07`, **sem qualquer intervenção sobre dependências**: `npm ls deepmerge-ts` continua exibindo `prisma@7.9.1 → @prisma/config@7.9.1 → deepmerge-ts@7.1.5`, e `npm audit` reporta as mesmas **3 vulnerabilidades high**. Nenhum `npm audit fix --force`, `overrides` ou `resolutions` foi usado; `package.json` e `package-lock.json` não foram tocados | Não bloqueia `E-04`..`E-18`. **Reavaliação obrigatória** a cada atualização do Prisma 7 e antes de CI de produção/deploy |
| `DIV-04` | `movimento_sessao.chave_idempotencia` — `U` em `docs/07` §14 contra §10.1, §10-A, §18, §24.2 e §28.2 | **Divergência interna a `docs/07`** (§11). **RESOLVIDA quanto à implementação** em 21/08/2026: Bruno decidiu **REMOVER** a unicidade; a coluna permanece. **Permanece ABERTA a correção editorial de `docs/07` §14** — retirar o `U` e a citação a C-06 —, remetida a `E-18`. Nenhum `U-14` foi criado | Não |
| `DIV-05` | IDX-R3 — definido em `docs/07` §10-A, ausente das Categorias A **e** B de `docs/07` §28.2 | **Divergência interna a `docs/07`** (§11). **RESOLVIDA quanto à implementação** em 21/08/2026: Bruno decidiu **IMPLEMENTAR** em `E-07`. **Permanece ABERTA a correção editorial de `docs/07` §28.2** — incluir IDX-R3 na Categoria A —, remetida a `E-18` | Não |
| `D-ONUPD-01` | `ON UPDATE` das FKs — eixo **não normatizado** por nenhuma fonte homologada | **Decisão de implementação** registrada em §13 `E-07`, aprovada por Bruno em 21/08/2026: `Restrict` nas 70 FKs, por conservadoria e coerência com o racional de §9.2. **Não é requisito derivado de fonte.** Reavaliável se alguma etapa futura precisar de PK mutável | Não |
| `R-BL-01` | Revisão de governança da baseline Prisma — janeiro de 2027 | **Governança interna** (§15.1). **Não é EOL do Prisma** | Não |
| `R-BL-02` | Validação prática da configuração ESM do backend | Técnica — pertence à etapa que criar `apps/api` | Não bloqueia a persistência |
| `P2.2-11` | Absorção das duas `PROP-RN` em `docs/03` | Governança documental | Não |
| ~~`R2.2-16`~~ | Versionamento dos documentos e da Base Imutável | **MITIGADO em 20/08/2026** — três documentos versionados e branch publicada (§20.1) | — |
| `P2.2-09` | Integração da documentação da Fase 2 na `main` | Governança — exige autorização própria (PR/merge não realizados) | Não |
| `P2.2-05` | Escopo "fisioterapeuta ↔ paciente relacionado" | Autorização — Etapa 2.3 | Não |
| `P2.2-06` | Retenção e descarte (LGPD) | **Jurídica** | Não |
| `P2.2-07` | Conteúdo dos componentes clínicos | **Clínica** | Não para o schema; sim para `E-06` detalhado |
| `P2.2-01`, `P2.2-02`, `P2.2-10` | Cadeia de retificação; recibo sequencial; aggregate root | Modelagem/negócio | Não |

---

## 20. Observação de governança

`docs/07` §1.5 registra como risco `R2.2-16` que **a Base Imutável não está versionada** no Git. A verificação de §2 confirma: `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` e `docs/07-modelo-persistencia.md` seguem **não rastreados**, e agora `docs/08` nasce na mesma condição.

Isso significava que **os três documentos que governam a implementação existiam apenas no disco local**, sem proteção de histórico. Nas revisões 0 e 1 a instrução proibia commit, e essa proibição foi respeitada. A mitigação — versionar os três — dependia exclusivamente de autorização de Bruno.

### 20.1 `R2.2-16` — mitigado em 20/08/2026

Com a homologação registrada em §0, Bruno autorizou expressamente o versionamento documental. Os três arquivos foram colocados sob controle de versão em **um único commit documental**, na branch de trabalho `agent/fase2-etapa2.2-persistencia`, e a branch foi publicada em `origin`:

```
TECHLAB_FISIO_BASE_IMUTAVEL_V1.md
docs/07-modelo-persistencia.md
docs/08-baseline-tecnica-plano-implementacao.md
```

A Base Imutável entrou no repositório **exatamente como estava**, sem qualquer alteração de conteúdo, formatação ou whitespace — em conformidade com a regra de imutabilidade de TLF-BASE-V1 §1.

**Efeito sobre o risco.** `R2.2-16` passa de **aberto** para **mitigado**: os documentos que governam a implementação passam a ter histórico, rastreabilidade e revisão por diff, como exige TLF-BASE-V1 §14 ("o repositório GitHub é a fonte oficial do código e da documentação versionada").

**Residual declarado.** A branch está publicada, mas **não** integrada à `main`. Merge, PR, tag, release e deploy **não** foram realizados e permanecem sujeitos a autorização própria (TLF-BASE-V1 §14). Enquanto a integração não ocorrer, a `main` continua sem a documentação da Fase 2 — pendência de governança, não de conteúdo.

---

**Fim do documento — HOMOLOGADO (ato: REV. 2) — revisão vigente REV. 4 — `docs/08-baseline-tecnica-plano-implementacao.md` — FASE 2 DOCUMENTAL ENCERRADA; FUNDAÇÃO `E-01`..`E-03` EXECUTADA E PENDENTE DE VERSIONAMENTO.**
