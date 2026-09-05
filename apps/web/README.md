# `@techlab-fisio/web` — frontend do TechLab Fisio

Workspace do frontend (Next.js 16, App Router, React 19, TypeScript 6 estrito, Tailwind CSS 4). Criado na sprint **FRONT-F0 — Fundação do Frontend**: é uma **fundação técnica**, não uma entrega funcional. Nenhuma funcionalidade do produto (autenticação, pacientes, agenda, prontuário, financeiro, indicadores) existe aqui; nada se comunica com `apps/api`.

A fonte fundamental é [`TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`](../../TECHLAB_FISIO_BASE_IMUTAVEL_V1.md) (§2 idioma/mobile first, §9 arquitetura de referência, §11 requisitos não funcionais). A baseline de versões é [`docs/08`](../../docs/08-baseline-tecnica-plano-implementacao.md) §6; a execução de `V-06.c` (teto do TypeScript 6.0 × Next.js 16) está registrada em `docs/08` §12.1/§12.2.

## Comandos

Todos a partir da raiz do monorepositório (após `npm ci`).

| Comando | O que faz |
| --- | --- |
| `npm run dev --workspace @techlab-fisio/web` | Servidor de desenvolvimento (`next dev`) |
| `npm run typecheck --workspace @techlab-fisio/web` | `next typegen` (gera os tipos de rota em `.next/types`) e depois `tsc --noEmit` |
| `npm run build --workspace @techlab-fisio/web` | Build de produção (`next build`; inclui a verificação de tipos do Next) |
| `npm run start --workspace @techlab-fisio/web` | Serve o build de produção (`next start`) |

Os comandos raiz `npm run typecheck` e `npm run build` já incluem este workspace.

Não há lint nem testes configurados neste workspace: o repositório não possui infraestrutura de ESLint, e nenhum framework de testes foi introduzido só para produzir um teste artificial na fundação. Playwright (E2E, TLF-BASE-V1 §9) permanece `PENDENTE` em `docs/08` §6 até existir um fluxo funcional a cobrir.

## Arquitetura mínima

```text
apps/web/
├── app/
│   ├── globals.css      # Tailwind 4 + tokens semânticos (@theme inline) + estilos base
│   ├── layout.tsx       # layout raiz: <html lang="pt-BR">, metadados mínimos
│   └── page.tsx         # página inicial da fundação (Server Component, sem interação)
├── next.config.ts       # configuração mínima do Next (nenhuma opção sobrescrita)
├── postcss.config.mjs   # plugin oficial @tailwindcss/postcss
├── package.json
└── tsconfig.json        # estende ../../tsconfig.base.json com as chaves exigidas pelo Next
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

Limites deliberados: **um** tema (claro; dark mode não é requisito vigente), sem theme engine, sem editor de temas, sem persistência de tema, sem personalização por clínica (multitenancy está fora do MVP — TLF-BASE-V1 §13).

## Decisões técnicas locais da fundação

| Decisão | Motivo |
| --- | --- |
| `tsconfig.json` **estende** `tsconfig.base.json` e sobrescreve apenas `lib`, `module`, `moduleResolution`, `jsx`, `resolveJsonModule`, `incremental`, `plugins` | Preserva `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules` e **`skipLibCheck: false`** da base; as chaves sobrescritas são as que o Next exige (bundler + JSX automático + DOM) |
| `lib` = `["dom", "dom.iterable", "esnext"]` (valor do template oficial) | Com `es2023` herdado da base, as declarações do próprio `next` (`PromiseWithResolvers`, ES2024) falham sob `skipLibCheck: false`. Foi um erro de **configuração**, não incompatibilidade TS 6 × Next 16 — corrigido alinhando ao valor oficial, sem relaxar `skipLibCheck` |
| `types: ["node"]` + `@types/node 24.13.3` no workspace | Mesma razão de `apps/api`: impede que o `@types/node` 26.x hoisted na raiz (transitivo do Jest) vaze para o typecheck |
| `typecheck` = `next typegen && tsc --noEmit` | `next-env.d.ts` e `.next/types` são gerados (e ignorados pelo Git); o `typegen` garante que `LayoutProps<"/">` e os tipos de rota existam num clone limpo, sem depender de um `build` prévio |
| TypeScript **6.0.3** (raiz) em vez do `^5` sugerido pelo template | Baseline homologada (`docs/08` §6.3); `V-06.c` mede exatamente essa combinação |
| Tailwind CSS **4.3.3** exato (com `@tailwindcss/postcss` 4.3.3) | `docs/08` §6 delegava a versão ao scaffold do frontend, "junto com a versão que o `create-next-app` do Next 16 instalar" — o template `app-tw` declara `^4`, que resolve para 4.3.3 na data da sprint; `save-exact=true` (`.npmrc`) fixa o valor |
| Sem ESLint, sem testes, sem Storybook, sem state manager, sem client HTTP | Fundação sem lógica; introduzir infraestrutura sem consumidor seria complexidade prematura (TLF-BASE-V1 §4.5) |
| `next.config.ts` vazio | Nenhum header, rewrite ou proxy foi desativado ou configurado; isso pertence à primeira fatia funcional |

## Limites atuais e próximos passos (fora desta sprint)

- **Sem integração com `apps/api`**: nenhum client HTTP, hook de dados, Server Action, cookie de sessão ou tratamento de CSRF. A comunicação será materializada quando existir um fluxo funcional com contrato definido.
- **CSRF**: `docs/12` §5.7 (`D-2.3D-07`) determina que a proteção seja **reavaliada contra a arquitetura real do `apps/web`** (`P-2.3D-04`). A existência deste workspace torna essa reavaliação tecnicamente elegível; **nenhuma estratégia foi antecipada aqui**.
- **Identidade visual, dark mode, PWA, i18n, portal do paciente, multitenancy**: fora do escopo.
