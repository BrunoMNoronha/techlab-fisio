# TechLab Fisio — Base de Conhecimento Imutável

> **Identificador:** TLF-BASE-V1  
> **Versão:** 1.0  
> **Status:** IMUTÁVEL  
> **Data de congelamento:** 10 de agosto de 2026  
> **Idioma oficial:** Português do Brasil

## 1. Finalidade deste documento

Este documento registra os fundamentos permanentes do projeto **TechLab Fisio**. Ele deve ser utilizado como fonte-base por todos os chats, agentes de IA, desenvolvedores, revisores e documentos derivados.

Este arquivo não é backlog, diário de desenvolvimento, especificação de sprint nem registro de decisões temporárias. Versões de bibliotecas, tarefas, cronogramas, detalhes ainda não aprovados e estado momentâneo do código devem permanecer em documentos mutáveis separados.

### Regra de imutabilidade

1. Não editar, sobrescrever, resumir ou “corrigir” este arquivo.
2. Não reinterpretar seu conteúdo silenciosamente.
3. Se uma mudança estrutural for necessária, registrar primeiro uma proposta e seus impactos.
4. Somente após aprovação explícita de Bruno Menezes Noronha poderá ser criado um novo arquivo versionado, como `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md`.
5. A nova versão deve manter histórico das mudanças e indicar expressamente qual versão substitui.
6. Documentos derivados nunca podem alterar esta base por implicação.

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

## 4. Princípios permanentes

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

## 5. Escopo funcional permanente do MVP

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

Versões exatas e provedores de infraestrutura são decisões mutáveis e devem ser documentados fora desta base.

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

## 11. Requisitos não funcionais permanentes

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

## 14. Governança permanente

- O repositório GitHub é a fonte oficial do código e da documentação versionada.
- Não trabalhar diretamente na `main` durante implementações.
- Não realizar commit, push, merge, pull request, deploy ou publicação sem autorização explícita.
- Não executar comandos destrutivos nem remover conteúdo sem autorização.
- Preservar alterações preexistentes.
- Mudanças em arquitetura, schema ou contratos precisam de impacto, alternativa e aprovação.
- Dependências novas precisam de justificativa.
- Segredos nunca entram no repositório.
- Tarefas devem ser pequenas, revisáveis e verificáveis.
- Código, testes e documentação devem permanecer coerentes.
- Fatos, hipóteses, recomendações e decisões devem ser identificados separadamente.

## 15. Hierarquia em caso de conflito

1. Autorização explícita e atual de Bruno Menezes Noronha.
2. Esta base imutável, enquanto não for formalmente substituída.
3. Decisões arquiteturais aprovadas e documentação versionada.
4. Código, migrations e testes vigentes no repositório.
5. Backlog, planos e conversas dos chats.

Se duas fontes de mesmo nível divergirem, interromper a decisão afetada, apresentar a divergência e solicitar resolução. Nenhum agente deve escolher silenciosamente a interpretação mais conveniente.

## 16. Critério de sucesso do produto

O MVP será considerado bem-sucedido quando permitir, com segurança e rastreabilidade, executar o fluxo completo de uma clínica de fisioterapia: configurar a operação, cadastrar paciente, agendar, realizar e documentar o atendimento, consumir sessão quando aplicável, registrar pagamento e consultar indicadores básicos, respeitando os perfis e as regras de integridade clínica.

---

**Fim da Base de Conhecimento Imutável — TLF-BASE-V1.**
