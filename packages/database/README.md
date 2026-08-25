# @techlab-fisio/database

Workspace de persistência do TechLab Fisio: `schema.prisma`, as 9 migrations versionadas, o Prisma Client gerado (ESM), o mapeamento de erros por constraint e a suíte de integração.

Pré-requisitos, variáveis de ambiente e o passo a passo completo estão no [README da raiz](../../README.md). Fontes normativas: [`docs/07`](../../docs/07-modelo-persistencia.md) (modelo físico homologado) e [`docs/08`](../../docs/08-baseline-tecnica-plano-implementacao.md) (baseline e registro de execução `E-01`..`E-16`).

## Layout

| Caminho | Conteúdo |
| --- | --- |
| `prisma/schema.prisma` | Categoria A do modelo (tabelas, enums, FKs `Restrict`, uniques e índices simples). **Não** declara índices parciais, CHECKs, exclusions, triggers nem a expressão da coluna gerada — esses objetos vivem só em SQL de migration (`docs/08` C-3) |
| `prisma/migrations/` | Histórico autossuficiente — 9 migrations, da extensão `btree_gist` ao append-only. **Imutáveis**: correção nunca reescreve migration versionada |
| `generated/prisma/` | Prisma Client gerado (`npx prisma generate`) — não versionado |
| `src/errors/constraint-map.ts` | Mapeamento medido de erros (`V-03`): `identificarViolacao`, `ehConsumoDuplicado`, `ehConflitoAgenda` — fail-closed |
| `test/` | Suíte de integração (Jest 30 ESM, sem mocks) + helpers; `guard-anti-drift.spec.ts` é a Guarda 2 |
| `protected-objects.json` | **Fonte única** do inventário de objetos SQL protegidos (36 nomes + coluna gerada + 5 tabelas append-only), consumida pelas Guardas 1 e 2 e pela verificação de catálogo da E-15 |
| `schema.golden.sql` | Golden schema (Guarda 3): `pg_dump --schema-only --no-owner --no-privileges` de instância limpa reconstruída por `migrate deploy`; comparação byte a byte |
| `jest.config.mjs`, `tsconfig.test.json` | Configuração ESM da suíte (`ts-jest`, `--experimental-vm-modules`) |

## Scripts (executar na raiz do repositório)

| Comando | O que faz |
| --- | --- |
| `npm test` | Suíte integral contra banco descartável (`techlab_fisio_it_<sufixo>`) criado na instância do compose; migrations como `tlf_migrator`, testes como `tlf_app`; truncamento determinístico entre testes; teardown destrói o banco |
| `npm run typecheck` | `tsc --noEmit` estrito, código e testes |
| `npm run verify:from-scratch` | Reconstrução E-15 em container/volume descartáveis + verificação de catálogo + suíte integral |
| `npm run lint:migrations` | Guarda 1 — `DROP` de objeto protegido fora da migration de origem falha |
| `npm run schema:verify` | Guarda 3 + alarme `migrate diff --exit-code` |
| `npm run schema:golden:update` | Regera o golden a partir de reconstrução limpa — **ato deliberado**, revisado em diff; nunca no CI |
| `npm run db:validate` / `db:generate` / `db:status` | Atalhos do CLI do Prisma (config em `prisma.config.ts` na raiz) |

## Invariantes operacionais

- **Roles separadas**: `tlf_migrator` (migrations, dono do schema) × `tlf_app` (runtime, sem DDL). A suíte comprova por `current_user` que nunca roda como migrator.
- **Append-only**: `evento_auditoria`, `movimento_sessao`, `pagamento`, `estorno`, `historico_agendamento` têm `UPDATE`/`DELETE` revogados de `tlf_app`; `registro_clinico`/`retificacao_clinica` têm triggers condicionais de imutabilidade por estado.
- **`cobranca.valor_liquido`** é coluna gerada `STORED` — nunca escrever nela (o PostgreSQL rejeita com `428C9`); no schema ela leva `@default(dbgenerated())` deliberadamente sem argumento.
- **`db push` proibido; `db pull` fora do fluxo normal** — política completa em `docs/08` §10.2.
- **Dados exclusivamente sintéticos** — nenhum dado real de paciente, em nenhuma circunstância.
- A validação do catálogo de `evento_auditoria.acao` e da whitelist fail-closed de `contexto` (homologados em `docs/09` §12) é **regra da camada de aplicação** (`docs/07` §22.3) — **não** existe, por desenho, teste dela nesta suíte. `T-AUD-CONTEXTO` está **RECLASSIFICADO** para a frente de `apps/api` (`docs/08` §19 `P-BACK-01`); não implementar validação, trigger, CHECK ou JSON Schema no banco para antecipá-la.
