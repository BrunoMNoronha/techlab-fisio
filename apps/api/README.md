# @techlab-fisio/api

Backend do TechLab Fisio — monólito modular **NestJS 11** em **ESM real** (`module: nodenext`, `"type": "module"`), Node 24, TypeScript estrito. Fundação criada na **Etapa 2.3A**; fontes normativas: [`docs/08`](../../docs/08-baseline-tecnica-plano-implementacao.md) (`D-ESM-01`, `R-BL-02`, `P-BACK-01`) e [`docs/09` §12](../../docs/09-pacote-decisao-p-e14-01.md) (`D-AUD-01`..`D-AUD-08`).

## O que esta fundação contém — e nada além

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.ts` | Bootstrap ESM (`node dist/main.js`), porta via `PORT`, shutdown hooks (`R-BL-02`) |
| `src/app.module.ts` | Módulo raiz do monólito modular |
| `src/health/` | `GET /health` → `{"status":"ok"}` — payload mínimo, sem versão/segredo/detalhe interno |
| `src/audit/audit.catalog.ts` | **Fonte única tipada** das 24 ações homologadas (`D-AUD-01`) e da whitelist fail-closed de `contexto` (`D-AUD-07`) — exaustiva; nenhuma entrada nova sem decisão homologada própria |
| `src/audit/audit.types.ts` | Catálogo `SUCESSO \| NEGADO \| FALHA` (`D-AUD-02`, sem enum SQL) e regra de `alvo_tipo` (`D-AUD-03`) |
| `src/audit/audit-context.validator.ts` | Enforcement fail-closed (`D-AUD-08`): ação desconhecida, chave fora da whitelist, contexto não vazio em whitelist vazia e valor não escalar → rejeição explícita; **nunca** sanitização silenciosa; mensagens citam chaves, nunca valores |
| `test/` | `T-AUD-CONTEXTO` (unitário + integração via container NestJS real), bootstrap/health, consumo da API pública de `@techlab-fisio/database` |

Módulos funcionais (autenticação, pacientes, agenda, prontuário, financeiro, ...) **não existem ainda** — pertencem a fatias futuras, assim como as lacunas normativas adiadas `L-05`..`L-08`, a abrangência de `configuracao.alterada`, o alvo de `prontuario.exportado`, a eventual chave `autor_original_usuario_id` e `P2.2-05`.

## Integração com `packages/database`

Exclusivamente pela API pública do pacote (`@techlab-fisio/database`, campo `exports`): mapeamento de erros por constraint (`identificarViolacao`, `ehConsumoDuplicado`, `ehConflitoAgenda` — V-03/C-6). O Prisma Client **não** é instanciado nesta fatia; o provider de banco nasce com o primeiro fluxo que precisar dele. Schema, migrations e golden são intocáveis a partir daqui (persistência da Fase 2 encerrada).

## Scripts (na raiz do repositório)

| Comando | O que faz |
| --- | --- |
| `npm run build` | `packages/database` → `apps/api` (tsc, ESM) |
| `npm run test:api` | Suíte da API (Jest 30 ESM, sem banco) |
| `npm run start --workspace @techlab-fisio/api` | Executa `dist/main.js` (exige build prévio) |
| `npm run typecheck` | Inclui `apps/api` (src + testes, estrito, `skipLibCheck: false`) |
