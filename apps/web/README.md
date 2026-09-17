# `@techlab-fisio/web` — frontend do TechLab Fisio

Workspace do frontend (Next.js 16, App Router, React 19, TypeScript 6 estrito, Tailwind CSS 4). Criado na sprint **FRONT-F0 — Fundação do Frontend** como **fundação técnica** (sem funcionalidade de negócio e sem comunicação com `apps/api`). **Atualização factual de 06/09/2026 (Fatia 1, PR #27):** recebeu integração inicial com `apps/api` via proxy same-origin (`/api/*`), client HTTP tipado com mitigação de Client-Side CSRF (`lib/api-cliente.ts`) e tela de login em `/login` (`app/login/`). As demais áreas do produto (pacientes, agenda, prontuário, financeiro, indicadores) permanecem não iniciadas.

A base formal vigente é a [`TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`](../../TECHLAB_FISIO_BASE_IMUTAVEL_V2.md) (§2 idioma/mobile first, §9 arquitetura de referência com pnpm workspaces, §11 requisitos não funcionais), homologada por Bruno Menezes Noronha; a [`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`](../../TECHLAB_FISIO_BASE_IMUTAVEL_V1.md) permanece intacta e preservada como versão histórica substituída. A baseline de versões é [`docs/08`](../../docs/08-baseline-tecnica-plano-implementacao.md) §6; a execução de `V-06.c` (teto do TypeScript 6.0 × Next.js 16) está registrada em `docs/08` §12.1/§12.2.

## Comandos

Todos a partir da raiz do monorepositório (após `pnpm install --frozen-lockfile`).

| Comando | O que faz |
| --- | --- |
| `pnpm --filter @techlab-fisio/web run dev` | Servidor de desenvolvimento (`next dev`) |
| `pnpm --filter @techlab-fisio/web run typecheck` | `next typegen` (gera os tipos de rota em `.next/types`) e depois `tsc --noEmit` |
| `pnpm --filter @techlab-fisio/web run build` | Build de produção (`next build`; inclui a verificação de tipos do Next) |
| `pnpm --filter @techlab-fisio/web run start` | Serve o build de produção (`next start`) |
| `pnpm --filter @techlab-fisio/web run test` | Executa a bateria de verificações de integração e segurança do frontend (`verify-web-integration.mjs` — 24 verificações; executada na CI) e as verificações da lógica da grade de funcionamento (`verify-grade-funcionamento.mjs` — 21 verificações) |
| `pnpm --filter @techlab-fisio/web run test:e2e` | Executa a suíte de smoke E2E browser-based com Playwright contra o build de produção real no Chromium (`playwright test`) |
| `pnpm --filter @techlab-fisio/web exec playwright install chromium` | Baixa o binário do Chromium necessário para execução local do Playwright |
| `pnpm run verify:web-api-e2e` | (requer Chromium do Playwright instalado) Prova E2E real automatizada same-origin executando simultaneamente PostgreSQL 18 descartável, NestJS compilado, Next.js compilado com Route Handler proxy, `ProtecaoCsrfGuard` real e cookie real (`verify-web-api-e2e.mjs` — 24 verificações; executada na CI) |

Os comandos raiz `pnpm run typecheck` e `pnpm run build` já incluem este workspace. O Playwright também roda na CI desde a fatia `CI-E2E0` (PR [#58](https://github.com/BrunoMNoronha/techlab-fisio/pull/58); trace em falha pela PR [#59](https://github.com/BrunoMNoronha/techlab-fisio/pull/59)) — detalhes em [`README.md` › CI](../../README.md#e2e-playwright-na-ci-ci-e2e0).

## Arquitetura mínima

```text
apps/web/
├── app/
│   ├── api/[...caminho]/ route.ts # Proxy transparente same-origin para apps/api
│   ├── configuracoes/horario-funcionamento/
│   │   ├── editor-grade.tsx       # Client Component: edição da grade semanal (CFG-002, D-CFG-66)
│   │   └── page.tsx               # Server Component da rota /configuracoes/horario-funcionamento
│   ├── login/
│   │   ├── formulario-login.tsx   # Client Component do formulário acessível
│   │   └── page.tsx               # Server Component da rota /login
│   ├── globals.css                # Tailwind 4 + tokens semânticos (@theme inline) + estilos base
│   ├── layout.tsx                 # layout raiz: <html lang="pt-BR">, metadados mínimos
│   ├── not-found.tsx              # página 404 própria em pt-BR
│   └── page.tsx                   # página inicial com navegação para /login
├── e2e/
│   ├── horario-funcionamento.spec.ts # E2E da tela de horário (API simulada no navegador)
│   └── smoke.spec.ts              # Smoke tests E2E browser-based (Playwright)
├── lib/
│   ├── api-cliente.ts             # Client HTTP tipado com proteção contra Client-Side CSRF
│   └── grade-funcionamento.ts     # Lógica pura da grade (espelho das regras D-CFG-13/18/59)
├── scripts/
│   ├── verify-grade-funcionamento.mjs # Verificações da lógica pura da grade (21)
│   ├── verify-web-api-e2e.mjs     # Prova E2E automatizada real same-origin (50 verificações)
│   └── verify-web-integration.mjs # Bateria de 24 verificações de integração e segurança
├── next.config.ts                 # configuração do Next.js
├── playwright.config.ts           # Configuração do Playwright (Chromium, porta 3100, webServer)
├── postcss.config.mjs             # plugin oficial @tailwindcss/postcss
├── package.json
└── tsconfig.json                  # estende ../../tsconfig.base.json
```

- **App Router** (`app/`), sem `src/` e sem alias de import — o template oficial do `create-next-app@16.3.4` (`app-tw`) serviu de referência de configuração; nenhum asset, fonte ou texto do template foi copiado.
- **Server Components por padrão.** A fundação tem **zero** Client Components (`"use client"`), nenhum estado global e nenhuma dependência além de `next`, `react`, `react-dom` e o tooling de Tailwind/tipos.
- **Idioma e locale:** `lang="pt-BR"`, textos em português do Brasil, metadados mínimos (`title`/`description`). Nenhum texto comercial.
- **Mobile first:** classes base para viewport estreita, `sm:`/`lg:` apenas para espaçamento em telas maiores.
- **Acessibilidade estrutural:** landmark `main`, um `h1` e um `h2` em hierarquia, `section` rotulada por `aria-labelledby`, lista semântica, `:focus-visible` global para elementos interativos futuros. Não há animação (logo nada a reduzir por `prefers-reduced-motion`).
- **Tipografia:** pilha de sistema padrão do Tailwind (`--font-sans`). Nenhuma fonte externa (`next/font/google` **não** é usado).
- **Ícone:** nenhum `favicon`/`icon` foi definido — identidade visual não decidida. O navegador recebe `404` em `/favicon.ico`; isso não é erro da aplicação.

## Tokens semânticos (identidade visual parametrizável)

`app/globals.css` define, em `:root`, custom properties **provisórias** (`--background`, `--foreground`, `--surface`, `--surface-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--destructive`, `--destructive-foreground`, `--ring`, `--radius`) e as expõe ao Tailwind via `@theme inline` (`bg-surface`, `text-muted-foreground`, `border-border`, `rounded-md`, ...). Os valores atuais **não** são a identidade visual do produto — são apenas o ponto único a alterar quando ela for decidida.

Limites deliberados: **um** tema (claro; dark mode não é requisito vigente), sem theme engine, sem editor de temas, sem persistência de tema, sem personalização por clínica (multitenancy está fora do MVP — TLF-BASE-V2 §13).

## Decisões técnicas locais da fundação

| Decisão | Motivo |
| --- | --- |
| `tsconfig.json` **estende** `tsconfig.base.json` e sobrescreve apenas `lib`, `module`, `moduleResolution`, `jsx`, `resolveJsonModule`, `incremental`, `plugins` | Preserva `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules` e **`skipLibCheck: false`** da base; as chaves sobrescritas são as que o Next exige (bundler + JSX automático + DOM) |
| `lib` = `["dom", "dom.iterable", "esnext"]` (valor do template oficial) | Com `es2023` herdado da base, as declarações do próprio `next` (`PromiseWithResolvers`, ES2024) falham sob `skipLibCheck: false`. Foi um erro de **configuração**, não incompatibilidade TS 6 × Next 16 — corrigido alinhando ao valor oficial, sem relaxar `skipLibCheck` |
| `types: ["node"]` + `@types/node 24.13.3` no workspace | Mesma razão de `apps/api`: impede que o `@types/node` 26.x hoisted na raiz (transitivo do Jest) vaze para o typecheck |
| `typecheck` = `next typegen && tsc --noEmit` | `next-env.d.ts` e `.next/types` são gerados (e ignorados pelo Git); o `typegen` garante que `LayoutProps<"/">` e os tipos de rota existam num clone limpo, sem depender de um `build` prévio |
| TypeScript **6.0.3** (raiz) em vez do `^5` sugerido pelo template | Baseline homologada (`docs/08` §6.3); `V-06.c` mede exatamente essa combinação |
| Tailwind CSS **4.3.3** exato (com `@tailwindcss/postcss` 4.3.3) | `docs/08` §6 delegava a versão ao scaffold do frontend, "junto com a versão que o `create-next-app` do Next 16 instalar" — o template `app-tw` declara `^4`, que resolve para 4.3.3 na data da sprint; `saveExact: true` (`pnpm-workspace.yaml`) fixa o valor |
| Sem ESLint, sem testes, sem Storybook, sem state manager, sem client HTTP | Fundação sem lógica; introduzir infraestrutura sem consumidor seria complexidade prematura (TLF-BASE-V2 §4.5). **Superado em 06/09/2026 pela Fatia 1** quanto a *testes* e *client HTTP*: `scripts/verify-web-integration.mjs` e `lib/api-cliente.ts` passaram a existir porque houve consumidor. ESLint, Storybook e state manager continuam ausentes |
| `next.config.ts` vazio | Nenhum header, rewrite ou proxy foi desativado ou configurado; isso pertence à primeira fatia funcional. **Estado em 06/09/2026:** o objeto de configuração **segue vazio** — o roteamento `/api/*` é feito por Route Handler (`app/api/[...caminho]/route.ts`), não por `rewrites` |
| Playwright **1.63.0** exato em `devDependencies` | Fixado no workspace com `saveExact: true` na fatia `FRONT-E2E0` para a fundação E2E browser-based; sem lifecycle scripts (`allowBuilds` preservado) |
| Chromium como único browser da fundação | Decisão local reversível da fatia `FRONT-E2E0` para comprovar o harness E2E sobre o build real sem antecipar política multi-browser |
| WebServer na porta dedicada `3100` | Configurado em `playwright.config.ts` para servir `next start` isolado de `3000` (Next dev), `3001` (NestJS) e portas efêmeras de outras suítes; configurável por `PORT`. `reuseExistingServer: false` — porta ocupada falha a execução em vez de testar em silêncio um servidor de outra árvore |

## Horário de funcionamento (CFG-002 — tela local, 17/09/2026)

- Rota `/configuracoes/horario-funcionamento`, consumindo `GET`/`PUT /api/horario-funcionamento` pelo proxy same-origin; comportamento conforme [`docs/14`](../../docs/14-decisoes-configuracao-clinica.md) `D-CFG-66`.
- Aberto/fechado derivado das janelas; até 4 janelas por dia; validação local apenas como ajuda (o backend é a autoridade); salvar envia a grade inteira num único `PUT`; `401`/`403`/`404 CLINICA_NAO_CONFIGURADA` apresentados sem editor; `400` com mensagem genérica.
- Ordem de exibição segunda → domingo (escolha de UI); o contrato mantém `diaSemana` 0 = domingo.
- Não há menu nem verificação prévia de permissão no frontend: a página inicial apenas oferece o link e a autorização é decidida pelo backend (`clinica.configurar`).
- Provas: `verify-grade-funcionamento.mjs` (lógica), `e2e/horario-funcionamento.spec.ts` (7 testes Playwright com API simulada via `page.route`) e o **Cenário 8** de `verify-web-api-e2e.mjs` (16 verificações em Chromium real contra PostgreSQL 18 descartável + NestJS + Next.js compilados, sem mocks): 401 real sem sessão, login pelo formulário, grade vazia, edição e salvamento, grade persistida no banco, um `configuracao.alterada` com ator da sessão, recarga, adjacência bloqueada na tela sem `PUT`, `400` e `403` (CSRF) do backend sem mutação nem auditoria, no-op sem auditoria, fechamento total e ausência de overflow em 375px. O **Cenário 9** (10 verificações) cobre o `403` por falta de `clinica.configurar` com um Recepcionista real: a única etapa por SQL insere a linha do usuário (sem senha utilizável) e o vínculo ao papel `RECEPCIONISTA` semeado por `provisionar`, pois não existe API de criação de usuário; a senha é definida pelo fluxo real de recuperação (AUT-004) e o login ocorre pelo formulário. Prova: tela sem editor e com mensagem de ausência de permissão, `GET`/`PUT` diretos com a sessão real → `403 ACESSO_NEGADO`, grade inalterada e nenhum evento de auditoria (`L-07`). Validado por mutação local (usuário vinculado a `ADMINISTRADOR` → 6 falhas detectadas).

## Estado da integração com `apps/api` (Fatia 1 / P-2.3D-04 / P-2.3D-08)

- **Integração inicial concluída (Fatia 1):** proxy same-origin implementado em `app/api/[...caminho]/route.ts`, client HTTP tipado com mitigação de Client-Side CSRF em `lib/api-cliente.ts`, tela de login e formulário acessível em `app/login/`.
- **CSRF e Same-Origin:** a topologia é **same-origin** — o proxy preserva `Host` público, `Origin`, `Sec-Fetch-*` e `X-TLF-Requisicao`, CORS permanece desabilitado e a baseline de `D-2.3D-07` é preservada **sem enfraquecimento** (nenhum synchronizer token, nenhuma exceção no guard).
- **Baterias automatizadas integradas à CI:**
  - `verify-web-integration.mjs` (24 verificações): executada na CI via step `Frontend — prova de integração da fundação web (sanitização de caminhos)`;
  - `verify-web-api-e2e.mjs` (50 verificações — 24 de sessão/CSRF e 26 da tela de horário em Chromium real; a CI instala o Chromium antes deste passo): executada na CI via script raiz `verify:web-api-e2e` e step `E2E — prova real same-origin Web + API + PostgreSQL (P-2.3D-08 / D-2.3D-20)`;
  - `smoke.spec.ts` (3 testes Playwright, `CI-E2E0`): executada na CI via step `E2E (FRONT-E2E0) — smoke tests Playwright (/, /login, 404) em Chromium real`.
- **`P-2.3D-04` ENCERRADA em 15/09/2026**: Encerrada em 15/09/2026 após a integração do PR #47 (merge commit `89fa492603bdb6e90693b03544c7857ee7d7fb3d`) que versionou `apps/web/scripts/verify-web-api-e2e.mjs` e o passo correspondente na CI, executando simultaneamente PostgreSQL real em container, NestJS real compilado, Next.js real compilado com Route Handler de proxy same-origin (`/api/*`), `ProtecaoCsrfGuard` real e cookie real de sessão, provando que a baseline de CSRF de `D-2.3D-07` (`SameSite=Strict`, cabeçalho obrigatório `X-TLF-Requisicao` nas mutações, Fetch Metadata, validação de `Origin`, ausência de CORS) protege a fronteira de ponta a ponta sem necessidade de synchronizer token adicional.
- **Identidade visual definitiva, dark mode, PWA, i18n, portal do paciente, multitenancy:** fora do escopo do MVP (TLF-BASE-V2 §13).
