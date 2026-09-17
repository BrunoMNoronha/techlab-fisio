# TechLab Fisio

Sistema web de gestão para clínicas de fisioterapia (MVP em desenvolvimento). Monorepositório pnpm workspaces com a camada de persistência (`packages/database`, **encerrada** na Fase 2) e a fundação do backend (`apps/api`, NestJS 11 em ESM — [`apps/api/README.md`](apps/api/README.md); registro vivo em [`docs/10-backend-implementacao.md`](docs/10-backend-implementacao.md)). O frontend (`apps/web`, Next.js 16 + React 19 + Tailwind CSS 4 — [`apps/web/README.md`](apps/web/README.md)) foi estabelecido na sprint `FRONT-F0` como fundação técnica e recebeu na Fatia 1 (PR #27) a infraestrutura inicial de integração com `apps/api` (proxy same-origin em `/api/*`, cliente HTTP tipado e tela de login em `/login`), sem telas ou fluxos de negócio clínicos adicionais.

Este README é **operacional**: como reproduzir o ambiente e executar as verificações. As decisões de arquitetura, regras de negócio e o plano de implementação vivem em [`docs/`](docs/) — em especial [`docs/07-modelo-persistencia.md`](docs/07-modelo-persistencia.md) (modelo físico homologado) e [`docs/08-baseline-tecnica-plano-implementacao.md`](docs/08-baseline-tecnica-plano-implementacao.md) (baseline técnica e plano `E-01`..`E-18`). A base formal vigente do repositório é a [`TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`](TECHLAB_FISIO_BASE_IMUTAVEL_V2.md), homologada por Bruno Menezes Noronha para registrar a migração para pnpm workspaces; a [`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`](TECHLAB_FISIO_BASE_IMUTAVEL_V1.md) permanece intacta e preservada como versão histórica substituída.

## Requisitos

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | **24.x** (Active LTS) | `engines.node: ">=24.0.0 <25"` + `engineStrict: true` (`pnpm-workspace.yaml`) recusam outra linha; `.nvmrc` = `24` |
| pnpm | **12.3.4** | registrado em `packageManager` (`pnpm@12.3.4`) |
| Docker + Docker Compose v2 | qualquer engine atual | o comportamento é fixado pela **tag da imagem**: `postgres:18-bookworm` |

## Instalação

```bash
pnpm install --frozen-lockfile
```

Sempre `pnpm install --frozen-lockfile` (instalação reproduzível pelo `pnpm-lock.yaml` versionado), nunca instalação sem lockfile.

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
pnpm exec prisma generate
```

```bash
pnpm exec prisma validate
```

O Client é gerado em `packages/database/generated/prisma` (fora de `node_modules`, **não versionado** — artefato derivável).

### Migrations

O histórico versionado em `packages/database/prisma/migrations` (9 migrations) é a **fonte de verdade** junto com `schema.prisma`. Aplicar em banco local:

```bash
pnpm exec prisma migrate deploy
```

Regras vinculantes (detalhe em `docs/08` §9.3/§10/§10.2):

- toda mudança de schema nasce em migration (`pnpm exec prisma migrate dev --create-only` + revisão humana do SQL); nada é aplicado manualmente no banco;
- objetos não representáveis no Prisma Schema (CHECKs, índices parciais, exclusion constraints, triggers, `REVOKE`, coluna gerada, extensão) vivem **somente** em SQL de migration, com nomes determinísticos;
- **`prisma db push` é proibido** em qualquer ambiente;
- **`prisma db pull` está fora do fluxo normal**: nenhum script o expõe; investigação começa por `db pull --print` (não escreve em disco); sobrescrever o `schema.prisma` versionado é vedado, `--force` é proibido, e qualquer resultado que introduza `previewFeatures` (ex.: `partialIndexes`) é rejeitado por definição.

## Testes

```bash
pnpm test
```

Suíte de integração (Jest 30, ESM real, sem mocks) contra PostgreSQL real. O globalSetup cria um **banco descartável por execução** (`techlab_fisio_it_<sufixo>`) na instância do compose, aplica as 9 migrations como `tlf_migrator` e executa os testes como `tlf_app`; o globalTeardown destrói o banco. Estado atual: **9 suites · 79 passed · 0 todo**. `T-AUD-CONTEXTO` **não** está nesta suíte por desenho: é teste de regra de aplicação/backend (`docs/09` §12.7) e foi **EXECUTADO/PASSED** na suíte de `apps/api` (`pnpm run test:api` — 4 suites · 93 passed; estado vivo em `docs/10`). `pnpm test` executa as duas suítes em sequência.

Dados **exclusivamente sintéticos** em desenvolvimento e testes — nunca dado real de paciente (TLF-BASE-V2 §10).

## Verificações de integridade

```bash
pnpm run verify:from-scratch
```

Prova de reconstrução (`E-15`): cria container+volume PostgreSQL descartáveis, comprova o banco vazio, reconstrói **apenas** com `pnpm exec prisma migrate deploy`, verifica no catálogo todos os objetos SQL customizados e roda a suíte integral dentro da instância reconstruída; destrói tudo ao final (inclusive em falha).

```bash
pnpm run lint:migrations
```

Guarda 1 anti-drift: falha se qualquer migration contiver `DROP` de objeto protegido (lista única em [`packages/database/protected-objects.json`](packages/database/protected-objects.json)) fora da migration de origem e sem anotação `-- INTENCIONAL:` justificada.

```bash
pnpm run schema:verify
```

Guarda 3 + alarme: reconstrói uma instância limpa, gera `pg_dump --schema-only` dentro do container e compara **byte a byte** com o golden versionado [`packages/database/schema.golden.sql`](packages/database/schema.golden.sql); em seguida roda `pnpm exec prisma migrate diff --from-migrations … --to-schema … --exit-code`. O golden só é atualizado por ato deliberado (`pnpm run schema:golden:update`) revisável em diff — o CI nunca o atualiza.

```bash
pnpm run typecheck
```

TypeScript 6.0.x estrito em todos os workspaces, incluindo os testes; em `apps/web` o comando executa `next typegen` antes do `tsc --noEmit`.

## Frontend (`apps/web`)

Fundação técnica do frontend estabelecida na sprint `FRONT-F0` (Next.js 16 App Router, React 19, TypeScript 6 estrito e Tailwind CSS 4 com tokens semânticos) e expandida na Fatia 1 (PR #27) com a infraestrutura inicial de integração com `apps/api`: proxy same-origin em `/api/*` ([`apps/web/app/api/[...caminho]/route.ts`](apps/web/app/api/[...caminho]/route.ts)), cliente HTTP tipado (`lib/api-cliente.ts`) e tela inicial de login (`app/login/page.tsx`). O frontend não depende de banco nem de Docker. Propósito, arquitetura e limites em [`apps/web/README.md`](apps/web/README.md).

```bash
pnpm --filter @techlab-fisio/web run dev
```

```bash
pnpm --filter @techlab-fisio/web run build
```

O script de verificação (`scripts/verify-web-integration.mjs`) executa 24 verificações sintéticas locais (sanitização de caminho, simulação de repasse de headers de proxy com `node:http`, reprodução local simplificada de guard CSRF e inspeção estática de arquivos). **Atenção de escopo:** esse script roda isoladamente no workspace web e **não** é disparado pelo `pnpm test` da raiz; na CI (`ci.yml`) roda em passo próprio (`pnpm --filter @techlab-fisio/web run test`) e não substitui as provas ponta a ponta descritas na seção [CI](#ci).

`pnpm run typecheck` e `pnpm run build` na raiz já incluem o workspace (`V-06.c` — teto do TypeScript 6.0 × Next.js 16 — foi aprovada nessa combinação; registro em `docs/08` §12.1).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa, na ordem barato→caro: `pnpm install --frozen-lockfile` → `pnpm exec prisma generate`/`validate` → typecheck → Guarda 1 → `verify:from-scratch` (que É a preparação da suíte integral, incluindo a Guarda 2 `guard-anti-drift.spec.ts`) → Guarda 3 + alarme → build dos três workspaces (`packages/database` → `apps/api` → `apps/web`) → provas de runtime e suítes do backend → verificações do frontend (`verify-web-integration.mjs`) → prova E2E real same-origin Web + API + PostgreSQL (`pnpm run verify:web-api-e2e`) → suíte Playwright (`pnpm run test:e2e`, `CI-E2E0`).

### E2E Playwright (`CI-E2E0`)

Comando oficial, **idêntico no local e na CI** (job `integracao`, disparado por `push` em `agent/**`, `pull_request` para `main` e manualmente):

```bash
pnpm run test:e2e
```

Ele executa [`apps/web/scripts/run-playwright-e2e.mjs`](apps/web/scripts/run-playwright-e2e.mjs), que a cada execução monta um ambiente novo e sintético — nada é reaproveitado de execuções anteriores nem de servidores já abertos na máquina:

1. PostgreSQL 18 descartável (container e volume novos, prefixo `techlab-fisio-pwe2e-`) → `prisma migrate deploy`;
2. Administrador e clínica **sintéticos** pelo CLI compilado de provisionamento (`provisionar` e `bootstrap-clinica`);
3. API compilada (`apps/api/dist/main.js`) em porta efêmera, `TLF_AMBIENTE=teste`, readiness por `GET /health`;
4. `playwright test`: o `webServer` do [`playwright.config.ts`](apps/web/playwright.config.ts) sobe o `next start` do build em **outra** porta efêmera com `URL_API_INTERNA` apontando para a API, e só libera os testes quando `GET /api/health` responde 200 **pelo proxy same-origin**. `reuseExistingServer: false`, `retries: 0`, `workers: 1`, `forbidOnly` sob `CI`, Chromium único;
5. no `finally`: API encerrada, container e volume destruídos e resíduo conferido (há handlers de `SIGINT`/`SIGTERM` para o Ctrl+C; uma interrupção **forçada** pode deixar a API filha viva, e o container é varrido na execução seguinte). O exit code é o do Playwright; resíduo descartável também reprova. Órfãos de execuções mortas à força são removidos no início da execução seguinte.

Suítes (`apps/web/e2e/`, 13 testes): `autenticacao.spec.ts` (3 — rota protegida sem sessão, credencial inválida, login pelo formulário → cookie `HttpOnly`/`SameSite=Strict` → `GET /api/auth/sessao` 200 → tela protegida liberada → CSRF → logout → revogação no servidor; sem mocks), `horario-funcionamento.spec.ts` (7 — API simulada no navegador) e `smoke.spec.ts` (3 — `/`, `/login`, 404). Rodar `playwright test` diretamente falha de propósito: a configuração exige as variáveis do orquestrador e nunca cai nas portas padrão (API e `next start` usam 3000; o proxy assume 3001).

Argumentos extras do Playwright (por exemplo `--repeat-each=3` ou `--grep`) devem ser passados pelo comando do workspace — `pnpm --filter @techlab-fisio/web run test:e2e --repeat-each=3` —, porque o script da raiz apenas delega.

Em falha, na CI, `playwright-report/` e `test-results/` (traces `retain-on-failure` e screenshots) são publicados como artefato `playwright-report-ci-e2e0` (7 dias); localmente ficam em `apps/web/test-results/` (ignorado pelo Git). A prova roteirizada `verify:web-api-e2e` continua cobrindo a tela de horário contra a pilha real (persistência, auditoria e `403` com Recepcionista).

Pré-requisitos locais: Docker ativo, `.env` sintético copiado de `.env.example` e, uma vez por árvore:

```bash
pnpm run build
```

```bash
pnpm --filter @techlab-fisio/web exec playwright install chromium
```

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
