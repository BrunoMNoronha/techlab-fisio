# `@techlab-fisio/web` — frontend do TechLab Fisio

Workspace do frontend (Next.js 16, App Router, React 19, TypeScript 6 estrito, Tailwind CSS 4). Criado na sprint **FRONT-F0 — Fundação do Frontend** como **fundação técnica** (sem funcionalidade de negócio e sem comunicação com `apps/api`). **Atualização factual de 06/09/2026 (Fatia 1, PR #27):** recebeu integração inicial com `apps/api` via proxy same-origin (`/api/*`), client HTTP tipado com mitigação de Client-Side CSRF (`lib/api-cliente.ts`) e tela de login em `/login` (`app/login/`). As demais áreas do produto (pacientes, agenda, prontuário, financeiro, indicadores) permanecem não iniciadas.

Os fundamentos transversais e a governança vigentes estão em [`docs/01-fundamentos-governanca.md`](../../docs/01-fundamentos-governanca.md) (§2 idioma/mobile first, §9 arquitetura de referência, §11 requisitos não funcionais). A baseline de versões é [`docs/08`](../../docs/08-baseline-tecnica-plano-implementacao.md) §6; a execução de `V-06.c` (teto do TypeScript 6.0 × Next.js 16) está registrada em `docs/08` §12.1/§12.2.

## Comandos

Todos a partir da raiz do monorepositório (após `npm ci`).

| Comando | O que faz |
| --- | --- |
| `npm run dev --workspace @techlab-fisio/web` | Servidor de desenvolvimento (`next dev`) |
| `npm run typecheck --workspace @techlab-fisio/web` | `next typegen` (gera os tipos de rota em `.next/types`) e depois `tsc --noEmit` |
| `npm run build --workspace @techlab-fisio/web` | Build de produção (`next build`; inclui a verificação de tipos do Next) |
| `npm run start --workspace @techlab-fisio/web` | Serve o build de produção (`next start`) |
| `npm run test --workspace @techlab-fisio/web` | Executa a bateria local de verificações de integração e segurança do frontend (`verify-web-integration.mjs` — 24 verificações; não executada na CI) |

Os comandos raiz `npm run typecheck` e `npm run build` já incluem este workspace.

## Arquitetura mínima

```text
apps/web/
├── app/
│   ├── api/[...caminho]/ route.ts # Proxy transparente same-origin para apps/api
│   ├── login/
│   │   ├── formulario-login.tsx   # Client Component do formulário acessível
│   │   └── page.tsx               # Server Component da rota /login
│   ├── globals.css                # Tailwind 4 + tokens semânticos (@theme inline) + estilos base
│   ├── layout.tsx                 # layout raiz: <html lang="pt-BR">, metadados mínimos
│   ├── not-found.tsx              # página 404 própria em pt-BR
│   └── page.tsx                   # página inicial com navegação para /login
├── lib/
│   └── api-cliente.ts             # Client HTTP tipado com proteção contra Client-Side CSRF
├── scripts/
│   └── verify-web-integration.mjs # Bateria de 24 verificações de integração e segurança
├── next.config.ts                 # configuração do Next.js
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

Limites deliberados: **um** tema (claro; dark mode não é requisito vigente), sem theme engine, sem editor de temas, sem persistência de tema, sem personalização por clínica (multitenancy está fora do MVP — `docs/01` §13).

## Decisões técnicas locais da fundação

| Decisão | Motivo |
| --- | --- |
| `tsconfig.json` **estende** `tsconfig.base.json` e sobrescreve apenas `lib`, `module`, `moduleResolution`, `jsx`, `resolveJsonModule`, `incremental`, `plugins` | Preserva `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules` e **`skipLibCheck: false`** da base; as chaves sobrescritas são as que o Next exige (bundler + JSX automático + DOM) |
| `lib` = `["dom", "dom.iterable", "esnext"]` (valor do template oficial) | Com `es2023` herdado da base, as declarações do próprio `next` (`PromiseWithResolvers`, ES2024) falham sob `skipLibCheck: false`. Foi um erro de **configuração**, não incompatibilidade TS 6 × Next 16 — corrigido alinhando ao valor oficial, sem relaxar `skipLibCheck` |
| `types: ["node"]` + `@types/node 24.13.3` no workspace | Mesma razão de `apps/api`: impede que o `@types/node` 26.x hoisted na raiz (transitivo do Jest) vaze para o typecheck |
| `typecheck` = `next typegen && tsc --noEmit` | `next-env.d.ts` e `.next/types` são gerados (e ignorados pelo Git); o `typegen` garante que `LayoutProps<"/">` e os tipos de rota existam num clone limpo, sem depender de um `build` prévio |
| TypeScript **6.0.3** (raiz) em vez do `^5` sugerido pelo template | Baseline homologada (`docs/08` §6.3); `V-06.c` mede exatamente essa combinação |
| Tailwind CSS **4.3.3** exato (com `@tailwindcss/postcss` 4.3.3) | `docs/08` §6 delegava a versão ao scaffold do frontend, "junto com a versão que o `create-next-app` do Next 16 instalar" — o template `app-tw` declara `^4`, que resolve para 4.3.3 na data da sprint; `save-exact=true` (`.npmrc`) fixa o valor |
| Sem ESLint, sem testes, sem Storybook, sem state manager, sem client HTTP | Fundação sem lógica; introduzir infraestrutura sem consumidor seria complexidade prematura (`docs/01` §4, item 5). **Superado em 06/09/2026 pela Fatia 1** quanto a *testes* e *client HTTP*: `scripts/verify-web-integration.mjs` e `lib/api-cliente.ts` passaram a existir porque houve consumidor. ESLint, Storybook e state manager continuam ausentes |
| `next.config.ts` vazio | Nenhum header, rewrite ou proxy foi desativado ou configurado; isso pertence à primeira fatia funcional. **Estado em 06/09/2026:** o objeto de configuração **segue vazio** — o roteamento `/api/*` é feito por Route Handler (`app/api/[...caminho]/route.ts`), não por `rewrites` |

## Estado da integração com `apps/api` (Fatia 1: P-2.3D-04)

- **Integração inicial concluída:** proxy same-origin implementado em `app/api/[...caminho]/route.ts`, client HTTP tipado com mitigação de Client-Side CSRF em `lib/api-cliente.ts`, tela de login e formulário acessível em `app/login/`.
- **CSRF e Same-Origin:** a topologia é **same-origin** — o proxy preserva `Host` público, `Origin`, `Sec-Fetch-*` e `X-TLF-Requisicao`, CORS permanece desabilitado e a baseline de `D-2.3D-07` é preservada **sem enfraquecimento** (nenhum synchronizer token, nenhuma exceção no guard).
- **Bateria local de verificações (`scripts/verify-web-integration.mjs` — 24 verificações):** não é executada pela CI. A bateria decompõe-se estritamente em:
  - **Código real executado (8 verificações):** validação unitária direta de `sanitizarCaminhoApi` importada de `lib/api-cliente.ts` contra URLs absolutas, protocol-relative e path traversal;
  - **Repasse HTTP simulado (5 verificações):** simulação direta via `node:http` (cliente e servidor locais) testando a recepção dos cabeçalhos repassados, **sem executar o Route Handler real do Next.js** (`app/api/[...caminho]/route.ts`);
  - **Avaliação de compatibilidade por reprodução local (3 verificações):** avaliação dos cabeçalhos simulados contra a função local `avaliarGuard` (definida dentro do próprio script de teste), **sem instanciar a API nem executar a `ProtecaoCsrfGuard` real do NestJS**;
  - **Inspeção estática (8 verificações):** verificação de existência de arquivos no disco e busca textual por atributos de acessibilidade, labels e referências de rota;
  - **O que ainda NÃO foi comprovado:** o fluxo integrado ponta a ponta (navegador ou teste e2e submetendo requisição pelo Route Handler do Next.js até a API NestJS real com a `ProtecaoCsrfGuard` ativa em runtime) **não foi executado** e permanece como pendência de prova futura associada a `P-2.3D-04`.
- **`P-2.3D-04` permanece ABERTA** (`docs/12` §11). Esta fatia torna a reavaliação de `D-2.3D-07` materialmente possível e a **mede** sob as condições descritas acima; ela **não a homologa**. O encerramento formal da pendência é ato expresso de Bruno Menezes Noronha (`docs/01` §15, item 1) e vive em `docs/12`, não aqui. Registro pós-medição em `docs/08` REV. 26 e `docs/10` REV. 38.
- **Identidade visual definitiva, dark mode, PWA, i18n, portal do paciente, multitenancy:** fora do escopo do MVP (`docs/01` §13).
