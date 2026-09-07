# TechLab Fisio — Fundamentos e Governança

> **Documento:** `docs/01-fundamentos-governanca.md`  
> **Identificador:** TLF-FUNDAMENTOS  
> **Status:** VIGENTE — DOCUMENTO NORMATIVO MUTÁVEL E VERSIONADO  
> **Data de criação:** 7 de setembro de 2026  
> **Substitui normativamente:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` / `TLF-BASE-V1`  
> **Idioma oficial:** Português do Brasil

## 1. Finalidade e regime documental

Este documento registra os fundamentos transversais vigentes do projeto **TechLab Fisio** e é a entrada normativa principal para decisões que atravessam mais de uma frente do produto.

Ele substitui o modelo anterior de uma "base imutável". A partir de 7 de setembro de 2026, os fundamentos do projeto são **mutáveis, versionados no Git e sujeitos ao mesmo processo de revisão, decisão e rastreabilidade aplicado ao restante da documentação**.

Este arquivo não é backlog, diário de desenvolvimento, especificação de sprint nem registro de estado momentâneo do código. Versões exatas de bibliotecas, tarefas, cronogramas, pendências, medições de CI e detalhes temporários continuam em documentos especializados.

### 1.1 Regra de evolução

1. O histórico Git preserva versões anteriores; não é necessário congelar um arquivo para preservar rastreabilidade.
2. Mudanças neste documento devem ser explícitas, revisáveis e coerentes com decisões aprovadas.
3. Antes de criar uma nova fonte normativa, verificar se um documento vigente pode ser atualizado.
4. Regras específicas devem permanecer em documentos de domínio quando isso reduzir duplicação.
5. Uma decisão nova que substitua regra anterior deve identificar claramente o que foi substituído e seus impactos.
6. Documentos históricos não possuem autoridade normativa corrente, salvo quando uma decisão vigente os referenciar expressamente como evidência histórica.

### 1.2 Compatibilidade com referências históricas

Referências existentes a `TLF-BASE-V1 §N`, `Base Imutável §N` ou `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md §N` são mantidas como **aliases de compatibilidade documental** e devem ser interpretadas como referência à seção de mesmo número deste documento, enquanto a migração textual dessas referências não for concluída.

Esse alias existe apenas para evitar uma migração destrutiva de centenas de registros históricos. Ele **não restaura autoridade normativa** ao arquivo antigo e **não cria obrigação de consultá-lo**.

## 2. Identidade do projeto

- **Nome:** TechLab Fisio.
- **Natureza:** sistema web de gestão para clínicas e consultórios de fisioterapia.
- **Público inicial:** clínicas de pequeno e médio porte, fisioterapeutas, recepcionistas, gestores e administradores.
- **Localidade inicial:** Brasil.
- **Idioma da interface:** português do Brasil.
- **Moeda inicial:** real brasileiro (BRL).
- **Aplicação:** web responsiva, com abordagem mobile first.
- **Repositório oficial:** https://github.com/BrunoMNoronha/techlab-fisio
- **Diretório local principal:** `C:\Users\bruno\Workspace\techlab-fisio`
- **Branch principal:** `main`.
- **Sistema operacional predominante de desenvolvimento:** Windows.
- **Referência funcional:** https://www.igutclinicas.com.br/

A referência iGUT Clínicas serve apenas para estudo de categorias funcionais e fluxos. Não copiar código, textos, imagens, marca, identidade visual, componentes ou layout proprietário.

## 3. Visão do produto

O TechLab Fisio centralizará a operação clínica e administrativa de uma clínica de fisioterapia. O sistema deverá reduzir o uso de papéis, planilhas e aplicativos desconectados, oferecendo rastreabilidade do atendimento, padronização dos registros clínicos, organização da agenda, controle das sessões e visão financeira básica.

O produto não substitui o julgamento profissional do fisioterapeuta e não deverá produzir diagnósticos, prescrições ou decisões clínicas autônomas.

## 4. Princípios vigentes

1. **Segurança e privacidade desde a concepção:** dados de saúde são sensíveis.
2. **Privilégio mínimo:** cada perfil acessa somente o necessário.
3. **Rastreabilidade:** alterações sensíveis precisam ser atribuíveis a usuário, data e ação.
4. **Integridade clínica:** registros finalizados não são apagados ou reescritos; correções usam retificação auditável.
5. **Simplicidade do MVP:** evitar infraestrutura, abstrações e funcionalidades prematuras.
6. **Monólito modular primeiro:** microserviços somente diante de necessidade comprovada e aprovação.
7. **Regras críticas no backend:** permissões, estados, cálculos e invariantes não dependem exclusivamente da interface.
8. **Documentação junto do código:** decisões e comportamento implementado devem permanecer sincronizados.
9. **Acessibilidade e responsividade:** recepção produtiva no desktop e atendimento confortável em celular ou tablet.
10. **Decisões verificáveis:** requisitos devem possuir critérios de aceite e testes proporcionais ao risco.

## 5. Escopo funcional de referência do MVP

Os requisitos detalhados e critérios de aceite vivem em `docs/02-requisitos.md`; as regras de negócio vivem em `docs/03-regras-negocio.md`. Esta seção mantém apenas o limite transversal de escopo.

### 5.1 Autenticação e acesso

- Login e logout.
- Recuperação segura de senha.
- Usuários ativos e inativos.
- Papéis e permissões.
- Sessões expiradas e revogáveis.
- Auditoria de ações sensíveis.

### 5.2 Configuração da clínica

- Dados cadastrais e contatos.
- Endereço, logotipo e horário de funcionamento.
- Serviços, preços de referência e formas de pagamento.
- Duração padrão de atendimentos.
- Motivos padronizados de cancelamento.

O MVP atende inicialmente uma única clínica. Multiempresa e multitenancy não fazem parte desta versão.

### 5.3 Profissionais

- Dados pessoais e profissionais.
- Registro profissional e especialidades.
- Disponibilidade e horários.
- Serviços realizados.
- Situação ativa ou inativa.

### 5.4 Pacientes

- Dados pessoais e de contato.
- CPF opcional.
- Contato de emergência.
- Responsável legal quando aplicável.
- Consentimentos e bases de tratamento aplicáveis.
- Situação ativa ou inativa.
- Prevenção de cadastros duplicados.
- Separação entre observações administrativas e registros clínicos.

### 5.5 Agenda

- Visões diária e semanal, inclusive por profissional.
- Agendamento, confirmação, remarcação, cancelamento e bloqueio.
- Prevenção de conflitos.
- Vínculo entre paciente, profissional e serviço.
- Atendimento avulso ou associado a pacote.
- Check-in manual.
- Estados: agendado, confirmado, aguardando, em atendimento, concluído, falta e cancelado.
- Histórico das mudanças relevantes.

### 5.6 Prontuário eletrônico de fisioterapia

- Histórico cronológico do paciente.
- Anamnese e avaliação inicial.
- Queixa principal, histórico e antecedentes relevantes.
- Avaliações de dor e funcionalidade.
- Medidas e escalas necessárias ao atendimento.
- Diagnóstico ou hipótese fisioterapêutica registrada pelo profissional.
- Objetivos e plano terapêutico.
- Condutas, orientações, intercorrências e evolução por sessão.
- Anexos clínicos.
- Identificação do autor, data e horário.
- Finalização do registro.
- Retificação posterior auditável, preservando o original.
- Impressão ou exportação autorizada de relatórios.

### 5.7 Sessões e pacotes

- Quantidade contratada e validade opcional.
- Sessões agendadas, realizadas, canceladas e restantes.
- Consumo vinculado ao atendimento.
- Proteção contra contagem duplicada.
- Ajustes somente com permissão, justificativa e auditoria.

### 5.8 Financeiro básico

- Valores previstos e recebidos.
- Cobranças avulsas ou vinculadas a pacotes.
- Descontos autorizados.
- Pagamentos integrais e parciais.
- Estados: pendente, parcialmente pago, pago, cancelado e estornado.
- Formas de pagamento controladas.
- Recibo simples.
- Relatórios básicos por período, profissional, serviço e forma de pagamento.
- Auditoria de cancelamentos, estornos e alterações.

O módulo não é um sistema contábil completo.

### 5.9 Indicadores

- Atendimentos do dia e por período.
- Distribuição por estado do agendamento.
- Taxa de faltas.
- Quantidade de pacientes atendidos.
- Receita prevista e recebida.
- Pacotes próximos do término.
- Produtividade por profissional.

Toda métrica precisa de regra de cálculo documentada e testável.

## 6. Perfis e limites de acesso

A matriz detalhada e vigente de perfis/permissões vive em `docs/04-perfis-permissoes.md`. Estes limites transversais permanecem obrigatórios.

### Administrador

Gerencia usuários, permissões, configurações, cadastros estruturais, auditoria e todos os módulos autorizados.

### Gestor

Acompanha operação, indicadores, relatórios e financeiro, sem administrar configurações técnicas ou permissões críticas.

### Recepcionista

Gerencia dados administrativos de pacientes, agenda, check-in, cobranças e pagamentos autorizados. Não acessa conteúdo clínico detalhado além do mínimo necessário.

### Fisioterapeuta

Acessa agenda e pacientes relacionados ao seu trabalho; registra avaliação, plano, atendimento e evolução; anexa documentos; finaliza registros e solicita retificações conforme as regras.

Um usuário pode possuir mais de um papel. A união de permissões deve continuar respeitando restrições específicas sobre dados clínicos e operações sensíveis.

## 7. Fluxo operacional de referência

Os fluxos detalhados vivem em `docs/05-jornadas-fluxos.md`.

1. O administrador configura clínica, usuários, profissionais, serviços e formas de pagamento.
2. A recepção cadastra ou localiza o paciente.
3. A recepção agenda o serviço com profissional disponível.
4. O atendimento é confirmado, remarcado ou cancelado.
5. Na chegada, a recepção registra o check-in.
6. O fisioterapeuta inicia o atendimento e consulta o histórico permitido.
7. O profissional registra avaliação ou evolução.
8. O registro clínico é finalizado.
9. Quando aplicável, a sessão é consumida do pacote uma única vez.
10. A recepção registra cobrança e pagamento.
11. O atendimento é concluído.
12. Gestores acompanham os indicadores conforme suas permissões.

## 8. Entidades conceituais

O modelo de domínio vigente e suas invariantes vivem em `docs/06-modelo-dominio.md`; o modelo físico e as decisões de persistência vivem em `docs/07-modelo-persistencia.md`.

- Clínica.
- Usuário, papel, permissão e sessão de autenticação.
- Profissional e especialidade.
- Paciente, responsável legal e consentimento.
- Serviço e disponibilidade profissional.
- Agendamento e seu histórico.
- Avaliação fisioterapêutica.
- Plano terapêutico.
- Atendimento e evolução clínica.
- Retificação clínica.
- Anexo.
- Pacote e movimento de sessão.
- Cobrança, pagamento e forma de pagamento.
- Auditoria.

Esta relação é conceitual. Ela não obriga uma tabela por item nem dispensa modelagem de cardinalidades, invariantes, índices e transações.

## 9. Arquitetura técnica de referência

- TypeScript estrito.
- Node.js em versão LTS suportada.
- Monorepositório com npm workspaces.
- Frontend com Next.js e React.
- Backend com NestJS.
- API REST documentada com OpenAPI.
- PostgreSQL.
- Prisma ORM e migrations reproduzíveis.
- Tailwind CSS.
- Jest para testes unitários e de integração.
- Playwright para fluxos de ponta a ponta.
- Docker e Docker Compose no desenvolvimento.
- Armazenamento S3 compatível para arquivos privados.
- GitHub Actions para lint, tipos, testes e build.
- Autenticação segura baseada em sessão e cookies protegidos.
- Controle de acesso baseado em papéis e permissões.
- UUIDs; datas persistidas em UTC e exibidas no fuso configurado.
- Exclusão lógica e auditoria onde a preservação for necessária.

Versões exatas, compatibilidades medidas e provedores de infraestrutura são decisões mutáveis e devem ser registradas em documentação técnica vigente, especialmente `docs/08-baseline-tecnica-plano-implementacao.md`.

## 10. Segurança, privacidade e conformidade

- Considerar a LGPD e a natureza sensível dos dados de saúde em todo o ciclo.
- Nunca usar dados reais de pacientes em desenvolvimento, demonstração ou testes.
- Não registrar senhas, tokens ou conteúdo clínico sensível em logs.
- Proteger senhas com algoritmo moderno e parâmetros seguros.
- Criptografar o tráfego e avaliar proteção em repouso.
- Usar acesso temporário e autorizado para anexos privados.
- Proteger contra CSRF, XSS, injeção, enumeração e abuso de autenticação.
- Implementar trilha de auditoria para acesso e mudança de dados sensíveis.
- Definir backup, restauração, retenção, descarte e resposta a incidentes.
- Não expor informação sensível em erros, URLs ou telemetria.
- Submeter afirmações de conformidade e decisões regulatórias à validação jurídica e profissional competente.

Implementação técnica, isoladamente, não autoriza afirmar conformidade legal definitiva.

## 11. Requisitos não funcionais vigentes

- Mobile first, responsivo e acessível.
- Boa produtividade no desktop.
- Paginação, filtros e índices para consultas frequentes.
- Operações críticas transacionais e idempotentes quando necessário.
- API versionada e validada no servidor.
- Logs estruturados sem dados sensíveis.
- Ambientes de desenvolvimento, teste e produção separados.
- Health checks, observabilidade mínima e backups verificáveis.
- Compatibilidade com navegadores modernos suportados.

## 12. Baseline de qualidade

Toda funcionalidade deve ter critérios de aceite. Regras críticas devem possuir testes de caminho feliz, vazio, borda, duplicidade, autorização e volume compatível.

Fluxos críticos mínimos:

1. Autenticação e autorização.
2. Cadastro e localização de paciente.
3. Agendamento sem conflito.
4. Check-in e atendimento.
5. Registro e finalização da evolução.
6. Retificação com preservação do original.
7. Consumo único de sessão.
8. Cobrança e pagamento.
9. Indicadores respeitando regras e permissões.

## 13. Itens explicitamente fora do MVP

- Aplicativo móvel nativo.
- Portal do paciente.
- Agendamento público e check-in autônomo.
- Telemedicina.
- Diagnóstico, prescrição ou decisão clínica por IA.
- Reconhecimento automático de imagens clínicas.
- WhatsApp, SMS, e-mail transacional e URA.
- Assinatura ICP-Brasil.
- Emissão fiscal e conciliação bancária.
- Integração com cartões.
- TISS, convênios e glosas.
- Estoque e compras.
- Comissões ou repasses complexos.
- Integração com equipamentos ou sistemas externos.
- Multiempresa, multitenancy ou SaaS.
- Construtor genérico de formulários.
- Funcionamento offline.
- Business intelligence avançado.

Esses itens podem ser avaliados no futuro, mas não justificam complexidade antecipada.

## 14. Governança do projeto

- O repositório GitHub é a fonte oficial do código e da documentação versionada.
- A documentação vigente é mutável; o histórico Git preserva versões anteriores.
- Não trabalhar diretamente na `main` durante implementações.
- Não realizar commit, push, merge, pull request, deploy ou publicação sem autorização explícita compatível com a ação.
- Autorização para implementar não implica automaticamente autorização para publicar.
- Não executar comandos destrutivos nem remover conteúdo sem autorização compatível.
- Preservar alterações preexistentes e mudanças fora do escopo.
- Mudanças em arquitetura, schema, migrations, enums controlados, relacionamentos ou contratos de API exigem análise de impacto, migração/reversibilidade, testes e aprovação quando estruturais.
- Dependências novas precisam de justificativa e versões devem ser verificadas antes da instalação.
- Segredos nunca entram no repositório.
- Tarefas devem ser pequenas, revisáveis e verificáveis.
- Código, testes e documentação devem permanecer coerentes.
- Fatos, hipóteses, recomendações e decisões devem ser identificados separadamente quando materialmente relevante.
- ADRs registram decisões arquiteturais; documentos especializados registram requisitos e decisões de domínio; backlog e planos não substituem normas vigentes.
- Documentos históricos devem ser marcados como históricos/superados quando deixarem de ser normativos.

## 15. Hierarquia em caso de conflito

1. **Autorização explícita e atual de Bruno Menezes Noronha.**
2. **Decisões e ADRs aprovados que indiquem expressamente a regra substituída ou refinada.**
3. **Este documento e os documentos normativos especializados vigentes.** Dentro deste nível, a fonte mais específica governa seu domínio quando não houver contradição; uma contradição material exige decisão explícita, não escolha silenciosa.
4. **Contratos, schema, migrations, código e testes vigentes no repositório**, como evidência do comportamento implementado; eles não criam requisito de negócio por si só.
5. **Backlog, planos, relatórios de execução e documentos históricos.**
6. **Conversas de chats/agentes não materializadas na documentação versionada.**

Se duas fontes de mesmo nível divergirem, interromper apenas a decisão afetada, apresentar a divergência e resolvê-la explicitamente. Nenhum agente deve escolher silenciosamente a interpretação mais conveniente.

## 16. Critério de sucesso do produto

O MVP será considerado bem-sucedido quando permitir, com segurança e rastreabilidade, executar o fluxo completo de uma clínica de fisioterapia: configurar a operação, cadastrar paciente, agendar, realizar e documentar o atendimento, consumir sessão quando aplicável, registrar pagamento e consultar indicadores básicos, respeitando os perfis e as regras de integridade clínica.

## 17. Mapa da documentação vigente

Este documento concentra **fundamentos transversais e governança**. O detalhe deve permanecer em uma única fonte especializada sempre que possível:

| Documento | Responsabilidade principal |
| --- | --- |
| `docs/01-fundamentos-governanca.md` | fundamentos transversais, escopo de referência, governança e hierarquia |
| `docs/02-requisitos.md` | requisitos funcionais e critérios de aceite |
| `docs/03-regras-negocio.md` | regras de negócio e invariantes funcionais |
| `docs/04-perfis-permissoes.md` | papéis, permissões e limites de acesso |
| `docs/05-jornadas-fluxos.md` | jornadas e fluxos críticos |
| `docs/06-modelo-dominio.md` | modelo conceitual, entidades, estados e invariantes de domínio |
| `docs/07-modelo-persistencia.md` | modelo físico, persistência, migrations e invariantes de banco |
| `docs/08-baseline-tecnica-plano-implementacao.md` | baseline técnica, compatibilidades medidas, plano e estado técnico transversal |
| `docs/09-pacote-decisao-p-e14-01.md` | decisões normativas de auditoria e temas correlatos registrados na frente |
| `docs/10-backend-implementacao.md` | estado vivo e evidências de implementação do backend |
| `docs/11-registro-decisao-p-2.3c-01.md` | registro histórico/normativo da decisão específica indicada no próprio documento |
| `docs/12-decisoes-autenticacao-autorizacao.md` | decisões normativas de autenticação e autorização |
| `docs/13-pacote-decisao-l-07-negacoes-autorizacao.md` | pacote e evidências da decisão de auditoria de negações de autorização |

### 17.1 Regra de consulta para humanos e agentes

Antes de planejar, implementar ou revisar:

1. consultar este documento quando o trabalho envolver fundamentos transversais, escopo, arquitetura de referência, segurança ou governança;
2. consultar apenas os documentos especializados relacionados ao escopo;
3. inspecionar o estado real do código/schema/testes antes de afirmar implementação;
4. não exigir leitura do arquivo histórico `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md`;
5. tratar referências antigas a `TLF-BASE-V1` como aliases definidos em §1.2.

## 18. Registro da substituição da Base Imutável

Em **7 de setembro de 2026**, Bruno Menezes Noronha autorizou expressamente a consolidação da documentação e a remoção da necessidade de um documento imutável. Essa decisão substitui a antiga regra de imutabilidade e encerra a necessidade de criar `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`.

A transição preserva o conteúdo substantivo da antiga `TLF-BASE-V1` nas seções 2 a 16 deste documento, atualizando apenas o regime de governança, a hierarquia documental e os ponteiros para fontes especializadas. O arquivo antigo permanece no repositório somente como **ponteiro histórico de compatibilidade**; seu conteúdo anterior continua recuperável pelo histórico Git.

---

**Fim — Fundamentos e Governança do TechLab Fisio.**
