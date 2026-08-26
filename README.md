# TechLab Fisio

Sistema web de gestão para clínicas de fisioterapia (MVP em desenvolvimento). Monorepositório npm workspaces com a camada de persistência (`packages/database`, **encerrada** na Fase 2) e a fundação do backend (`apps/api`, NestJS 11 em ESM — [`apps/api/README.md`](apps/api/README.md); registro vivo em [`docs/10-backend-implementacao.md`](docs/10-backend-implementacao.md)). Não existe ainda `apps/web`.

Este README é **operacional**: como reproduzir o ambiente e executar as verificações. As decisões de arquitetura, regras de negócio e o plano de implementação vivem em [`docs/`](docs/) — em especial [`docs/07-modelo-persistencia.md`](docs/07-modelo-persistencia.md) (modelo físico homologado) e [`docs/08-baseline-tecnica-plano-implementacao.md`](docs/08-baseline-tecnica-plano-implementacao.md) (baseline técnica e plano `E-01`..`E-18`). A fonte fundamental é [`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`](TECHLAB_FISIO_BASE_IMUTAVEL_V1.md).

## Requisitos

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | **24.x** (Active LTS) | `engines.node: ">=24.0.0 <25"` + `engine-strict=true` (`.npmrc`) recusam outra linha; `.nvmrc` = `24` |
| npm | o distribuído com o Node 24 | registrado em `packageManager` (`npm@11.16.0`) |
| Docker + Docker Compose v2 | qualquer engine atual | o comportamento é fixado pela **tag da imagem**: `postgres:18-bookworm` |

## Instalação

```bash
npm ci
```

Sempre `npm ci` (instalação reproduzível pelo `package-lock.json` versionado), nunca `npm install` casual.

## Variáveis de ambiente

```bash
cp .env.example .env
```

`.env` é ignorado pelo Git. Todos os valores de `.env.example` são **sintéticos** de desenvolvimento — nenhum é credencial real, e nenhum segredo real pode entrar no repositório. As três URLs relevantes:

- `DATABASE_URL` — runtime, role **`tlf_app`** (sem DDL);
- `MIGRATE_DATABASE_URL` — CLI do Prisma/migrations, role **`tlf_migrator`** (nunca `tlf_app`);
- `SHADOW_DATABASE_URL` — shadow database do `prisma migrate dev`.

O Prisma 7 **não** carrega `.env` automaticamente; o carregamento explícito está em [`prisma.config.ts`](prisma.config.ts).

## Subir o PostgreSQL

```bash
docker compose up -d
```

Sobe `postgres:18-bookworm` com healthcheck e volume nomeado `techlab-fisio-postgres-data`. O script [`infra/postgres/initdb/01-roles.sh`](infra/postgres/initdb/01-roles.sh) cria, já na inicialização, as **duas roles obrigatórias**:

- **`tlf_migrator`** — dona do schema; executa migrations; `CREATEDB` (shadow database);
- **`tlf_app`** — runtime; sem DDL; não é dona de nenhum objeto. As migrations de append-only (`E-11`) revogam `UPDATE`/`DELETE` dela em 5 tabelas.

A separação de roles é pré-requisito do modelo — não conecte a aplicação/testes como `tlf_migrator` nem rode migrations como `tlf_app`.

## Prisma

```bash
npx prisma generate
```

```bash
npx prisma validate
```

O Client é gerado em `packages/database/generated/prisma` (fora de `node_modules`, **não versionado** — artefato derivável).

### Migrations

O histórico versionado em `packages/database/prisma/migrations` (9 migrations) é a **fonte de verdade** junto com `schema.prisma`. Aplicar em banco local:

```bash
npx prisma migrate deploy
```

Regras vinculantes (detalhe em `docs/08` §9.3/§10/§10.2):

- toda mudança de schema nasce em migration (`prisma migrate dev --create-only` + revisão humana do SQL); nada é aplicado manualmente no banco;
- objetos não representáveis no Prisma Schema (CHECKs, índices parciais, exclusion constraints, triggers, `REVOKE`, coluna gerada, extensão) vivem **somente** em SQL de migration, com nomes determinísticos;
- **`prisma db push` é proibido** em qualquer ambiente;
- **`prisma db pull` está fora do fluxo normal**: nenhum script o expõe; investigação começa por `db pull --print` (não escreve em disco); sobrescrever o `schema.prisma` versionado é vedado, `--force` é proibido, e qualquer resultado que introduza `previewFeatures` (ex.: `partialIndexes`) é rejeitado por definição.

## Testes

```bash
npm test
```

Suíte de integração (Jest 30, ESM real, sem mocks) contra PostgreSQL real. O globalSetup cria um **banco descartável por execução** (`techlab_fisio_it_<sufixo>`) na instância do compose, aplica as 9 migrations como `tlf_migrator` e executa os testes como `tlf_app`; o globalTeardown destrói o banco. Estado atual: **9 suites · 79 passed · 0 todo**. `T-AUD-CONTEXTO` **não** está nesta suíte por desenho: é teste de regra de aplicação/backend (`docs/09` §12.7) e foi **EXECUTADO/PASSED** na suíte de `apps/api` (`npm run test:api` — 4 suites · 93 passed; estado vivo em `docs/10`). `npm test` executa as duas suítes em sequência.

Dados **exclusivamente sintéticos** em desenvolvimento e testes — nunca dado real de paciente (TLF-BASE-V1 §10).

## Verificações de integridade

```bash
npm run verify:from-scratch
```

Prova de reconstrução (`E-15`): cria container+volume PostgreSQL descartáveis, comprova o banco vazio, reconstrói **apenas** com `prisma migrate deploy`, verifica no catálogo todos os objetos SQL customizados e roda a suíte integral dentro da instância reconstruída; destrói tudo ao final (inclusive em falha).

```bash
npm run lint:migrations
```

Guarda 1 anti-drift: falha se qualquer migration contiver `DROP` de objeto protegido (lista única em [`packages/database/protected-objects.json`](packages/database/protected-objects.json)) fora da migration de origem e sem anotação `-- INTENCIONAL:` justificada.

```bash
npm run schema:verify
```

Guarda 3 + alarme: reconstrói uma instância limpa, gera `pg_dump --schema-only` dentro do container e compara **byte a byte** com o golden versionado [`packages/database/schema.golden.sql`](packages/database/schema.golden.sql); em seguida roda `prisma migrate diff --from-migrations … --to-schema … --exit-code`. O golden só é atualizado por ato deliberado (`npm run schema:golden:update`) revisável em diff — o CI nunca o atualiza.

```bash
npm run typecheck
```

TypeScript 6.0.x estrito, incluindo os testes.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa, na ordem barato→caro: `npm ci` → `prisma generate`/`validate` → typecheck → Guarda 1 → `verify:from-scratch` (que É a preparação da suíte integral, incluindo a Guarda 2 `guard-anti-drift.spec.ts`) → Guarda 3 + alarme.

## Desligar o ambiente

```bash
docker compose down
```

Para descartar também o volume de dados (banco local sintético — confirme antes que não há nada a preservar):

```bash
docker compose down -v
```

## Documentação do workspace de banco

Detalhes específicos de `packages/database` (layout, objetos protegidos, golden, testes) estão em [`packages/database/README.md`](packages/database/README.md).
