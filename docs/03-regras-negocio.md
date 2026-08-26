# Regras de Negócio — TechLab Fisio

> **Documento:** `docs/03-regras-negocio.md`  
> **Projeto:** TechLab Fisio  
> **Fase:** 1 — Requisitos, Regras de Negócio e Fluxos Críticos  
> **Status:** HOMOLOGADO — APTO PARA VERSIONAMENTO  
> **Data:** 10 de agosto de 2026  
> **Fonte fundamental:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — TLF-BASE-V1  
> **Decisões incorporadas:** D-01 a D-07  
> **Homologações incorporadas:** HOM-01 a HOM-05

## 1. Propósito

Este documento consolida as regras de negócio do MVP do TechLab Fisio. Ele não descreve schema, tabelas, endpoints ou detalhes de implementação. As regras aqui registradas devem ser observadas pela interface, backend, persistência, testes e documentação técnica futura.

A TLF-BASE-V1 permanece superior a este documento. Regras futuras que a contradigam exigem proposta formal de nova versão da Base.

## 2. Convenções

- `RN-XXX`: regra de negócio aprovada.
- `D-XX`: decisão funcional aprovada na Fase 1.
- **Invariante:** condição que deve permanecer verdadeira independentemente da interface ou caminho de execução.
- **Movimento:** registro de efeito histórico que não deve ser substituído por edição destrutiva.

---

# 3. Decisões funcionais aprovadas

## D-01 — Autoridade para retificação clínica

1. Fisioterapeuta pode efetivar retificação de registro clínico do qual é autor, desde que possua a permissão correspondente.
2. Retificação exige justificativa.
3. Retificação de registro produzido por outro fisioterapeuta exige permissão excepcional específica.
4. A retificação excepcional deve possuir auditoria reforçada, identificando autor da retificação, registro original, justificativa e data/hora.
5. Administrador, Gestor ou Recepcionista sem papel/capacidade clínica não podem efetivar retificação clínica.
6. Usuário que também seja fisioterapeuta recebe autoridade clínica por sua capacidade/permissão clínica, não por ser administrador ou gestor.

**Racional:** preservar responsabilidade profissional, privilégio mínimo e autoria clínica sem introduzir novo perfil de supervisor no MVP.

## D-02 — Evento de consumo de sessão e faltas/cancelamentos

1. O consumo ocorre na primeira finalização válida do **registro clínico correspondente ao atendimento** associado ao pacote.
2. Agendamento, confirmação, check-in, início do atendimento, transição para `CONCLUIDO` e pagamento não consomem sessão por si próprios.
3. Cancelamento não consome sessão automaticamente.
4. Falta não consome sessão automaticamente.
5. Se política comercial futura desejar cobrança/consumo por falta ou cancelamento tardio, isso deverá ser novo requisito explícito e aprovado.
6. Ajuste manual não deve ser usado para ocultar uma política automática não documentada.

## D-03 — Separação entre contratação, cobrança/pagamento e consumo

1. Contratação do pacote cria direito a sessões.
2. Cobrança representa obrigação financeira.
3. Pagamento/estorno representa movimentos financeiros.
4. Consumo/ajuste representa movimentos de sessão.
5. Criar pacote não consome sessão.
6. Criar cobrança não consome sessão.
7. Pagar não consome sessão.
8. Estornar pagamento não devolve sessão automaticamente.
9. Consumir sessão não cria pagamento automaticamente.
10. No MVP, situação financeira não bloqueia automaticamente atendimento ou consumo. Qualquer política de inadimplência exige requisito futuro explícito.

## D-04 — Recuperação de senha sem canal transacional integrado

1. Recuperação é iniciada por administrador autorizado.
2. O sistema gera token/segredo de uso único e curta validade.
3. O segredo é apresentado uma única vez para entrega externa segura.
4. O administrador não define nem conhece a nova senha do usuário.
5. Ao concluir recuperação, o segredo é invalidado e sessões anteriores são revogadas.

## D-05 — Pacote próximo do término

Um pacote é considerado próximo do término quando atender a pelo menos uma das condições:

- validade dentro dos próximos 30 dias; ou
- disponibilidade operacional de no máximo 2 sessões.

Os limiares devem permanecer documentados e preferencialmente configuráveis quando isso puder ser feito sem abstração prematura.

## D-06 — Conflito do mesmo paciente

Além de conflitos do profissional e de bloqueios, o sistema deve impedir sobreposição temporal de agendamentos do mesmo paciente.

## D-07 — Reserva de sessão em agendamento de pacote

1. Agendamento ativo vinculado a pacote reserva capacidade de uma sessão.
2. Reserva não equivale a consumo.
3. Cancelamento e falta liberam a reserva.
4. A finalização/consumo substitui o efeito da reserva pelo movimento efetivo de consumo.
5. Saldo disponível para novos agendamentos deve considerar reservas ativas.

---

# 4. Regras consolidadas

## 4.1 Identidade, autenticação e autorização

### RN-001 — Usuário inativo não autentica nem mantém sessão utilizável

Ao inativar um usuário, novas autenticações são rejeitadas e sessões existentes devem ser revogadas.

### RN-002 — Operações protegidas são validadas no backend

Esconder botão ou rota de interface não constitui autorização. Toda operação protegida deve ser validada pelo backend.

### RN-003 — Múltiplos papéis não removem restrições clínicas

A união de papéis agrega permissões compatíveis, mas não transforma papel administrativo em capacidade clínica. Restrições específicas sobre prontuário, autoria e operações sensíveis prevalecem.

### RN-004 — Sessões expiradas ou revogadas são terminais

Uma sessão nos estados `EXPIRADA` ou `REVOGADA` não pode voltar a `ATIVA`.

### RN-005 — Recuperação de senha invalida o segredo e revoga sessões anteriores

Após recuperação bem-sucedida, o token de recuperação não pode ser reutilizado e sessões anteriores deixam de autorizar operações.

### RN-006 — Falhas de autenticação não devem facilitar enumeração de contas

Mensagens e comportamento de erro devem evitar revelar desnecessariamente se um identificador de usuário existe.

---

## 4.2 Cadastros e histórico

### RN-007 — Inativação preserva histórico

Usuários, profissionais, pacientes, serviços e formas de pagamento desativados permanecem referenciáveis em dados históricos e não são apagados como consequência da inativação.

### RN-008 — Serviço/profissional inativo não participa de novo agendamento

Inativação impede novo uso operacional, preservando registros passados.

### RN-009 — Conteúdo administrativo e conteúdo clínico são segregados

Observações administrativas não podem funcionar como atalho para armazenar conteúdo de prontuário. Conteúdo clínico segue autorização própria.

### RN-010 — CPF do paciente é opcional

A ausência de CPF não impede cadastro quando os demais requisitos de identificação forem atendidos.

### RN-011 — Possíveis duplicidades devem ser tratadas antes da criação

A aplicação deve pesquisar e sinalizar candidatos a duplicidade. Coincidência provável não autoriza merge automático.

### RN-012 — Coincidência de identidade não é decidida automaticamente em casos ambíguos

Homônimos e dados semelhantes exigem revisão humana. O sistema não deve unir prontuários com base apenas em heurística.

---

## 4.3 Agenda

### RN-013 — Agendamento exige paciente, profissional e serviço elegíveis

Novo agendamento requer entidades ativas e relação profissional-serviço permitida.

### RN-014 — Agendamento deve respeitar horário operacional e disponibilidade

O intervalo deve estar em janela permitida para a clínica/profissional, conforme regras de configuração.

### RN-015 — Sobreposição protegida é proibida

É inválida a sobreposição:

1. do mesmo profissional;
2. com bloqueio do profissional;
3. do mesmo paciente, por D-06.

### RN-016 — Remarcação revalida as regras de criação

Remarcar não contorna conflito, disponibilidade, serviço, estado ou reserva de pacote.

### RN-017 — Mudanças relevantes da agenda mantêm histórico

Confirmação, remarcação, cancelamento, check-in, início, conclusão e falta devem ser atribuíveis conforme nível de auditoria/histórico definido.

### RN-018 — Check-in não consome sessão

A transição para `AGUARDANDO` apenas registra chegada.

### RN-019 — Início de atendimento exige fisioterapeuta autorizado

Usuário administrativo sem papel/capacidade clínica não inicia atendimento clínico.

### RN-020 — Cancelamento e falta são terminais para o agendamento original

O agendamento original não deve ser reutilizado silenciosamente após `CANCELADO` ou `FALTA`. Novo compromisso exige nova marcação ou fluxo explícito de remarcação antes do fechamento, conforme máquina de estados.

---

## 4.4 Integridade clínica

### RN-021 — Registro clínico é produzido por profissional autorizado

Avaliação, diagnóstico/hipótese fisioterapêutica, plano, conduta e evolução são registrados pelo fisioterapeuta responsável conforme escopo e permissão.

### RN-022 — O sistema não produz decisão clínica autônoma

O TechLab Fisio não gera diagnóstico, prescrição ou decisão clínica autônoma. Ele registra informações e decisões profissionais.

### RN-023 — Registro em elaboração pode ser alterado somente dentro do escopo autorizado

Enquanto `EM_ELABORACAO`, o conteúdo pode ser ajustado por usuário autorizado conforme regras de autoria/escopo.

### RN-024 — Registro clínico finalizado é imutável

Após `FINALIZADO`, o conteúdo original não pode ser apagado, reescrito ou retornado a rascunho pelo fluxo comum.

### RN-025 — Correção posterior usa retificação append-only

Toda correção de registro finalizado deve criar nova retificação vinculada ao original.

### RN-026 — Retificação preserva integralmente o original

Nenhum campo do original é substituído pela retificação. Visualizações podem apresentar o contexto consolidado, mas o histórico original permanece recuperável e íntegro.

### RN-027 — Retificação efetivada também é imutável

Se uma retificação precisar ser corrigida, cria-se outra retificação, preservando a anterior.

### RN-028 — Retificação exige justificativa e capacidade clínica

Aplica D-01 integralmente.

### RN-029 — Exportação clínica é operação sensível

Exportação/impressão exige autorização adequada e deve ser auditável.

---

## 4.5 Pacotes e movimentos de sessão

### RN-030 — Saldo de pacote não é número livremente editável

O saldo deve ser derivado do direito contratado e dos movimentos de sessão, não de alteração manual direta sem trilha.

### RN-031 — Saldo de direito e disponibilidade operacional são conceitos diferentes

Conceitualmente:

`saldo_de_direito = quantidade_contratada + ajustes_positivos - ajustes_negativos - consumos`

`disponivel_para_novos_agendamentos = saldo_de_direito - reservas_ativas`

### RN-032 — Agendamento de pacote cria reserva, não consumo

Aplica D-07.

### RN-033 — Consumo ocorre na primeira finalização válida do registro clínico

Aplica D-02 e HOM-04. O gatilho é a primeira finalização válida do registro clínico correspondente ao atendimento vinculado ao pacote. `CONCLUIDO` na agenda não é gatilho primário e não pode criar segunda baixa.

### RN-034 — Consumo é idempotente por atendimento/pacote

Para um mesmo atendimento e pacote existe no máximo um movimento efetivo de consumo.

### RN-035 — Retry não pode produzir nova baixa

Repetição da mesma operação finalizada deve retornar resultado consistente sem duplicar movimento.

### RN-036 — Cancelamento libera reserva sem consumo

Se agendamento de pacote for cancelado antes de consumo, a reserva é liberada e nenhum movimento de consumo é criado.

### RN-037 — Falta libera reserva sem consumo

Aplica D-02 e D-07.

### RN-038 — Ajuste de sessão exige permissão e justificativa

Ajustes positivos ou negativos são movimentos explícitos, auditados e excepcionais.

### RN-039 — Ajuste não altera retroativamente movimentos anteriores

Correções de saldo são registradas por novo movimento; consumos históricos permanecem.

### RN-040 — Pacote pode estar ativo, esgotado, expirado ou cancelado

- `ATIVO`: elegível conforme saldo/validade;
- `ESGOTADO`: saldo de direito igual a zero;
- `EXPIRADO`: validade atingida;
- `CANCELADO`: encerrado administrativamente.

Para agendamento/remarcação, a validade é verificada contra a **data/hora do atendimento**. Cancelar o pacote não cancela automaticamente agendamentos existentes; o vínculo torna-se inelegível e deve ser resolvido antes da finalização clínica por outro pacote elegível ou atendimento avulso.

Estados adicionais não fazem parte do MVP aprovado.

---

## 4.6 Financeiro

### RN-041 — Contratação, cobrança, pagamento e consumo possuem efeitos independentes

Aplica D-03 integralmente.

### RN-042 — Valor líquido de cobrança não pode ser negativo

Desconto autorizado não pode resultar em valor devido abaixo de zero.

### RN-043 — Desconto exige permissão específica

A possibilidade de operar cobranças não concede automaticamente permissão para desconto.

### RN-044 — Pagamentos são movimentos preservados individualmente

Um pagamento registrado não é substituído pela atualização de um campo total; histórico dos recebimentos deve ser preservado.

### RN-045 — Situação financeira decorre do efeito líquido dos movimentos

Para cobrança ativa:

- recebido líquido = 0 → `PENDENTE`;
- 0 < recebido líquido < valor líquido → `PARCIALMENTE_PAGO`;
- recebido líquido = valor líquido → `PAGO`.

### RN-046 — Pagamento acima do saldo devido é bloqueado no MVP

O MVP não modela crédito/saldo a favor como funcionalidade implícita.

### RN-047 — Cobrança cancelada não aceita novo pagamento

Operação financeira deve respeitar estado da cobrança.

### RN-048 — Pagamento não é apagado por estorno

Estorno cria novo movimento financeiro e preserva o pagamento original. No MVP, o estorno é **integral por movimento de pagamento**; estorno parcial de um mesmo pagamento está fora do escopo.

Após estorno:
- recebimento líquido > 0 e < valor devido → `PARCIALMENTE_PAGO`;
- recebimento líquido = valor devido → `PAGO`;
- houve recebimento e todos os pagamentos efetivos foram integralmente estornados → `ESTORNADO`.

### RN-049 — Estorno não devolve sessão automaticamente

Aplica D-03.

### RN-050 — Cobrança com pagamento não é simplesmente cancelada para ocultar recebimento

Antes de cancelamento, os movimentos existentes devem ser tratados de forma explícita e auditável.

### RN-051 — Recibo simples não é documento fiscal

O sistema não deve representar recibo como nota fiscal nem afirmar emissão fiscal.

### RN-052 — Situação financeira não bloqueia atendimento automaticamente

No MVP, inadimplência não impede agendamento, atendimento ou consumo por regra automática. Mudança futura exige requisito aprovado.

---

## 4.7 Indicadores

### RN-053 — Atendimentos realizados são agendamentos concluídos

Contagem baseada em `CONCLUIDO` no período operacional.

### RN-054 — Taxa de faltas exclui cancelamentos

Fórmula:

`faltas / (concluidos + faltas) * 100`

quando o denominador for maior que zero.

### RN-055 — Pacientes atendidos são pacientes distintos com atendimento concluído

Múltiplas sessões do mesmo paciente no período contam uma única vez para esse indicador.

### RN-056 — Receita recebida usa movimentos financeiros efetivos

`receita_recebida = pagamentos_efetivos - estornos_efetivos` no período definido.

### RN-057 — Produtividade não é receita

Produtividade por profissional é contagem de atendimentos concluídos, salvo futura decisão aprovada em contrário.

### RN-058 — Pacote próximo do término segue D-05

Validade ≤ 30 dias ou disponibilidade operacional ≤ 2 sessões.

### RN-059 — Indicadores aplicam permissão antes da exposição

Um agregado não pode ser usado para contornar restrição de acesso ao dado subjacente.

### RN-060 — Datas de indicadores respeitam fuso configurado

Mesmo persistindo UTC, agrupamentos por dia/período devem usar o fuso operacional da clínica.

---

## 4.8 Auditoria, privacidade e segurança

### RN-061 — Operações sensíveis são atribuíveis

Eventos de auditoria devem identificar ator, ação, alvo, data/hora, resultado e justificativa quando obrigatória.

### RN-062 — Auditoria não é cópia de prontuário

Conteúdo clínico integral não deve ser duplicado em evento de auditoria ou log técnico.

### RN-063 — Logs técnicos não contêm segredos nem conteúdo clínico sensível

Proibido registrar senha, token, cookie e prontuário sensível em logs, URLs, erros ou telemetria.

### RN-064 — Acesso a anexos clínicos é privado e autorizado

Arquivos clínicos devem ser acessíveis apenas por mecanismos autorizados e temporários conforme arquitetura futura.

### RN-065 — Operações críticas devem ser transacionais/idempotentes quando necessário

Especialmente: criação de agenda sob concorrência, finalização/consumo, pagamentos e outros fluxos com risco de duplicidade.

### RN-066 — Auditoria comum não é editável pelo fluxo operacional

Usuários não devem alterar ou apagar eventos históricos por operações normais do produto.

---

## 4.9 Regras especializadas pela homologação da Fase 1

### RN-067 — Gestor é somente leitura por padrão

O papel `Gestor` possui por padrão consulta/acompanhamento. Toda mutação operacional exige permissão específica adicional.

### RN-068 — Receita prevista usa data de referência da cobrança

`receita_prevista = soma dos valores líquidos das cobranças não canceladas cuja data de referência pertença ao período`.

Referência funcional: atendimento avulso → data do atendimento; pacote → data da contratação; cobrança administrativa não vinculada → data explicitamente atribuída. Pagamentos/estornos afetam receita recebida; cancelamento exclui o valor da previsão.

### RN-069 — Estorno parcial de um mesmo pagamento não faz parte do MVP

Cada pagamento somente pode ser estornado integralmente. Pagamentos múltiplos continuam permitidos, e o estado da cobrança é recalculado pelo efeito líquido.

### RN-070 — Finalização do registro clínico é o gatilho inequívoco de consumo

Especializa RN-033: a primeira finalização válida do registro clínico correspondente ao atendimento vinculado ao pacote dispara o consumo. `CONCLUIDO` da agenda não consome por si só.

### RN-071 — Validade e cancelamento de pacote preservam coerência da agenda

A validade para agendamento/remarcação é avaliada na data/hora do atendimento. Cancelar o pacote não cancela automaticamente agendamento existente; o vínculo inelegível precisa ser resolvido antes da finalização clínica por outro pacote elegível ou atendimento avulso.

---

# 5. Máquinas de estado normativas no nível funcional

## 5.1 Agenda

Estados permanentes da Base:

- `AGENDADO`
- `CONFIRMADO`
- `AGUARDANDO`
- `EM_ATENDIMENTO`
- `CONCLUIDO`
- `FALTA`
- `CANCELADO`

Transições aprovadas:

```text
AGENDADO -> CONFIRMADO
AGENDADO -> AGUARDANDO
AGENDADO -> CANCELADO
AGENDADO -> FALTA

CONFIRMADO -> AGUARDANDO
CONFIRMADO -> CANCELADO
CONFIRMADO -> FALTA

AGUARDANDO -> EM_ATENDIMENTO
AGUARDANDO -> CANCELADO   [excepcional e justificado quando permitido]

EM_ATENDIMENTO -> CONCLUIDO
```

`CONCLUIDO`, `FALTA` e `CANCELADO` são terminais para o agendamento original.

Remarcação é operação, não estado. Ela revalida regras de criação e registra histórico.

## 5.2 Registro clínico

```text
EM_ELABORACAO -> FINALIZADO
```

`FINALIZADO` é terminal para o registro original.

Retificação é entidade/registro separado:

```text
RETIFICACAO_EM_ELABORACAO -> RETIFICACAO_EFETIVADA
```

`RETIFICACAO_EFETIVADA` é imutável.

## 5.3 Sessão de autenticação

```text
ATIVA -> EXPIRADA
ATIVA -> REVOGADA
```

## 5.4 Cobrança

Estados funcionais:

- `PENDENTE`
- `PARCIALMENTE_PAGO`
- `PAGO`
- `CANCELADO`
- `ESTORNADO`

Derivação homologada:
- sem recebimento efetivo e cobrança ativa → `PENDENTE`;
- recebimento líquido > 0 e < valor devido → `PARCIALMENTE_PAGO`;
- recebimento líquido = valor devido → `PAGO`;
- cobrança elegivelmente cancelada sem recebimento efetivo → `CANCELADO`;
- houve recebimento e todos os pagamentos efetivos foram integralmente estornados → `ESTORNADO`.

Não existe estorno parcial de um mesmo movimento no MVP. Pagamentos e estornos permanecem no histórico.

## 5.5 Pacote

Estados aprovados na Fase 1:

- `ATIVO`
- `ESGOTADO`
- `EXPIRADO`
- `CANCELADO`

Não introduzir suspensão, congelamento, renovação automática ou outros estados sem necessidade e aprovação.

---

# 6. Regras de autorização sensível

1. Papel `Administrador` isolado não autoriza produção clínica.
2. Papel `Gestor` isolado não autoriza produção clínica e é somente leitura por padrão; toda mutação excepcional exige permissão específica.
3. Papel `Recepcionista` não autoriza acesso ao conteúdo clínico detalhado.
4. Papel `Fisioterapeuta` não autoriza automaticamente acesso global a todos os pacientes; o acesso deve respeitar relação/escopo do trabalho.
5. Retificação de terceiro requer permissão excepcional.
6. Ajuste de sessão, desconto, cancelamento/estorno e exportação clínica exigem permissões específicas.
7. Auditoria é restrita a perfil autorizado.

A matriz completa está em `docs/04-perfis-permissoes.md`.

---

# 7. Regras de teste derivadas

Toda regra crítica deve possuir testes proporcionais ao risco. No mínimo, quando aplicável:

- caminho feliz;
- vazio;
- borda;
- duplicidade;
- autorização;
- concorrência;
- idempotência;
- falha parcial/transacional;
- volume compatível;
- auditoria;
- não exposição de dados sensíveis.

Os nove fluxos críticos e cenários de referência estão em `docs/05-jornadas-fluxos.md`.

---

# 8. Pendências controladas

Não são decisões em aberto sobre D-01 a D-07. São detalhamentos posteriores que não podem alterar as regras acima silenciosamente:

- permissões técnicas exatas e seus identificadores;
- campos/validações detalhadas dos formulários clínicos;
- política de retenção e descarte;
- texto jurídico de consentimentos;
- representação técnica da data de referência da receita prevista, preservando RN-068;
- limites/configuração final dos indicadores de pacote próximo do término;
- mecanismo técnico de concorrência, unicidade e idempotência;
- modelagem de schema/API.
