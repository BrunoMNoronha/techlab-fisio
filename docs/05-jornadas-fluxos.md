# Jornadas e Fluxos Críticos — TechLab Fisio

> **Documento:** `docs/05-jornadas-fluxos.md`  
> **Projeto:** TechLab Fisio  
> **Fase:** 1 — Requisitos, Regras de Negócio e Fluxos Críticos  
> **Status:** HOMOLOGADO — APTO PARA VERSIONAMENTO  
> **Data:** 10 de agosto de 2026  
> **Fonte fundamental:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — TLF-BASE-V1  
> **Decisões incorporadas:** D-01 a D-07  
> **Homologações incorporadas:** HOM-01 a HOM-05

## 1. Objetivo

Formalizar as jornadas operacionais e os nove fluxos críticos mínimos do MVP, incluindo atores, pré-condições, estados, exceções, invariantes, auditoria, critérios de aceite e cenários de teste.

Este documento descreve comportamento funcional. Não define endpoints, schema, componentes de UI, filas, eventos técnicos ou mecanismo específico de persistência.

---

# 2. Jornada operacional principal

```text
Administrador configura clínica, usuários, profissionais, serviços e formas de pagamento
        ↓
Recepção localiza ou cadastra paciente
        ↓
Recepção agenda serviço com profissional disponível
        ↓
Agendamento pode ser confirmado, remarcado ou cancelado
        ↓
Paciente chega → recepção efetua check-in
        ↓
Fisioterapeuta inicia atendimento
        ↓
Fisioterapeuta registra avaliação/evolução
        ↓
Fisioterapeuta finaliza registro clínico
        ↓
Se vinculado a pacote → sistema consome uma sessão exatamente uma vez
        ↓
Recepção registra cobrança/pagamento conforme aplicável
        ↓
Atendimento é concluído
        ↓
Gestores/administradores consultam indicadores autorizados
```

Pontos essenciais:

- dados clínicos permanecem restritos durante toda a jornada;
- pacote e financeiro são fluxos relacionados, porém independentes;
- auditoria acompanha operações sensíveis;
- nenhuma etapa autoriza diagnóstico ou decisão clínica autônoma do sistema.

---

# 3. Máquinas de estado

## 3.1 Agenda

```text
AGENDADO
  ├── confirmar ───────────────> CONFIRMADO
  ├── check-in ────────────────> AGUARDANDO
  ├── cancelar ────────────────> CANCELADO
  └── registrar falta ─────────> FALTA

CONFIRMADO
  ├── check-in ────────────────> AGUARDANDO
  ├── cancelar ────────────────> CANCELADO
  └── registrar falta ─────────> FALTA

AGUARDANDO
  ├── iniciar atendimento ─────> EM_ATENDIMENTO
  └── cancelar excepcional ────> CANCELADO

EM_ATENDIMENTO
  └── concluir ────────────────> CONCLUIDO
```

### Estados terminais

- `CONCLUIDO`
- `FALTA`
- `CANCELADO`

### Remarcação

Remarcação não é estado. É operação sobre agendamento ainda elegível que:

1. recebe novo intervalo e, quando permitido, novo profissional/serviço;
2. revalida disponibilidade e conflitos;
3. revalida reserva de pacote;
4. registra histórico relevante.

## 3.2 Registro clínico

```text
EM_ELABORACAO
      |
      | finalizar
      v
 FINALIZADO
```

`FINALIZADO` é terminal para o original.

Correção posterior cria retificação separada:

```text
RETIFICACAO_EM_ELABORACAO
      |
      | efetivar
      v
RETIFICACAO_EFETIVADA
```

A retificação não substitui o original.

## 3.3 Sessão de autenticação

```text
ATIVA ── expiração ──> EXPIRADA
  |
  └── revogação ─────> REVOGADA
```

## 3.4 Pacote

```text
ATIVO ── saldo zero ──> ESGOTADO
  |
  ├── validade ───────> EXPIRADO
  └── cancelamento ───> CANCELADO
```

Para agendamento/remarcação, a validade é verificada contra a **data/hora do atendimento**. Cancelar o pacote não cancela automaticamente agendamento existente; o vínculo precisa ser resolvido antes da finalização clínica por outro pacote elegível ou atendimento avulso.

Não existem no MVP estados de suspensão, congelamento ou renovação automática.

## 3.5 Cobrança

```text
PENDENTE
  ├── pagamento parcial ───────> PARCIALMENTE_PAGO
  ├── pagamento total ─────────> PAGO
  └── cancelamento elegível ───> CANCELADO

PARCIALMENTE_PAGO
  ├── novos pagamentos até quitação ───> PAGO
  ├── estorno integral de um pagamento,
  |   restando recebimento > 0 ─────────> PARCIALMENTE_PAGO
  └── estorno integral de todos os
      pagamentos efetivos ──────────────> ESTORNADO

PAGO
  ├── estorno integral de um pagamento,
  |   restando recebimento > 0 ─────────> PARCIALMENTE_PAGO
  └── estorno integral de todos os
      pagamentos efetivos ──────────────> ESTORNADO
```

No MVP, um movimento de pagamento só pode ser estornado **integralmente**. Não há estorno parcial do mesmo pagamento. Pagamentos e estornos permanecem preservados; o estado é derivado do efeito líquido.

---

# 4. FC-01 — Autenticação e autorização

## Objetivo

Permitir acesso apenas a usuário válido, ativo e autorizado, com sessão expirável/revogável e validação de permissão no backend.

## Atores

- Usuário.
- Administrador para operações administrativas de identidade.
- Sistema para autenticação/autorização.

## Pré-condições

- usuário existente e ativo para sucesso do login;
- credencial cadastrada;
- aplicação disponível.

## Gatilho

Usuário submete credenciais ou tenta executar operação protegida.

## Fluxo principal

1. validar entrada;
2. localizar identidade sem revelar existência indevida;
3. validar senha;
4. validar situação do usuário;
5. criar sessão `ATIVA`;
6. carregar papéis/permissões;
7. usuário solicita recurso;
8. backend valida sessão, permissão, escopo e estado do recurso;
9. operação é autorizada ou negada;
10. eventos sensíveis são auditados.

## Exceções

- usuário inexistente;
- senha inválida;
- usuário inativo;
- sessão expirada;
- sessão revogada;
- permissão ausente;
- recurso fora do escopo;
- tentativa abusiva.

## Invariantes

- usuário inativo não autentica;
- sessão revogada/expirada não volta a ativa;
- frontend não é a autoridade de autorização;
- administrador sem capacidade clínica não produz conteúdo clínico;
- segredos não aparecem em logs.

## Auditoria

- login bem-sucedido;
- falhas relevantes;
- logout;
- revogação administrativa;
- recuperação de senha;
- mudanças de papéis/permissões.

## Critérios de aceite

1. credencial válida + usuário ativo → sessão criada;
2. credencial inválida → nenhuma sessão;
3. usuário inativo → nenhuma sessão;
4. sessão revogada → API rejeita;
5. usuário sem permissão → API rejeita mesmo via chamada direta;
6. múltiplos papéis respeitam restrições clínicas.

## Cenários de teste

- `T-AUTH-LOGIN` — sucesso.
- `T-AUTH-INVALID` — senha incorreta.
- `T-AUTH-INACTIVE` — usuário inativo.
- `T-AUTH-EXPIRED` — sessão expirada.
- `T-AUTH-REVOKE` — sessão revogada.
- `T-AUTH-RBAC` — acesso sem permissão.
- `T-AUTH-CLINICAL-BOUNDARY` — administrador sem papel clínico.
- `T-AUTH-ENUMERATION` — respostas não revelam existência de conta.
- `T-AUTH-RECOVERY` — D-04 completo, incluindo reutilização e expiração do token.

---

# 5. FC-02 — Cadastro e localização de paciente

## Objetivo

Encontrar paciente existente ou criar novo cadastro administrativo minimizando duplicidades e exposição de dados.

## Ator principal

Recepcionista.

## Pré-condições

- sessão válida;
- permissão administrativa de paciente.

## Gatilho

Necessidade de agendar, atender ou operar paciente não selecionado.

## Fluxo principal

1. recepcionista informa critérios de busca;
2. sistema normaliza critérios e procura correspondências permitidas;
3. sistema exibe candidatos com dados administrativos mínimos;
4. recepcionista seleciona paciente existente; ou
5. se não houver correspondência adequada, inicia cadastro;
6. sistema verifica duplicidades novamente antes da criação;
7. se houver possível duplicidade, apresenta alerta/candidatos;
8. usuário decide selecionar existente ou prosseguir justificadamente;
9. cadastro é criado.

## Exceções

- CPF já associado a outro cadastro;
- homônimo;
- nome/data/telefone semelhantes;
- dados obrigatórios insuficientes;
- usuário sem permissão.

## Invariantes

- CPF é opcional;
- não existe merge automático;
- conteúdo clínico não aparece na pesquisa da recepção;
- inativação não apaga histórico.

## Auditoria

Alterações sensíveis do cadastro quando aplicável.

## Critérios de aceite

1. paciente existente pode ser localizado;
2. CPF duplicado não cria silenciosamente novo cadastro;
3. homônimo não é unido automaticamente;
4. recepção não recebe prontuário;
5. paciente novo válido pode ser criado sem CPF.

## Testes

- `T-PAC-SEARCH`;
- `T-PAC-CREATE`;
- `T-PAC-NO-CPF`;
- `T-PAC-CPF-DUP`;
- `T-PAC-SIMILAR`;
- `T-PAC-HOMONYM`;
- `T-PAC-PERMISSION`;
- `T-PAC-NO-CLINICAL-LEAK`.

---

# 6. FC-03 — Agendamento sem conflito

## Objetivo

Criar/remarcar agendamento sem sobrepor profissional, bloqueio ou o próprio paciente, incluindo proteção sob concorrência.

## Ator principal

Recepcionista.

## Pré-condições

- paciente ativo;
- profissional ativo;
- serviço ativo;
- profissional realiza o serviço;
- horário dentro das regras operacionais;
- pacote elegível quando vinculado.

## Gatilho

Recepção solicita novo agendamento ou remarcação.

## Fluxo principal

1. selecionar paciente;
2. selecionar serviço;
3. selecionar profissional;
4. selecionar data/hora;
5. se pacote, selecionar pacote elegível;
6. validar funcionamento e disponibilidade;
7. validar conflitos do profissional;
8. validar bloqueios;
9. validar conflito do mesmo paciente por D-06;
10. validar disponibilidade de pacote considerando reservas por D-07;
11. efetivar agendamento de maneira concorrente-segura;
12. criar reserva de sessão, se pacote;
13. registrar histórico/auditoria apropriada.

## Exceções

- profissional indisponível;
- serviço incompatível;
- conflito temporal;
- bloqueio;
- paciente já agendado em sobreposição;
- pacote esgotado/expirado/cancelado;
- reservas já comprometem todo o saldo;
- concorrência entre duas tentativas.

## Invariantes

- criação não consome sessão;
- agendamento válido não viola conflitos aprovados;
- reserva não excede saldo operacional disponível;
- remarcação revalida tudo.

## Critério crítico de concorrência

Duas requisições concorrentes que disputam o mesmo recurso protegido não podem ambas ser confirmadas como válidas.

## Testes

- `T-AGD-CREATE`;
- `T-AGD-OVERLAP-FULL`;
- `T-AGD-OVERLAP-PARTIAL`;
- `T-AGD-EDGE-NON-OVERLAP`;
- `T-AGD-BLOCK`;
- `T-AGD-PATIENT-CONFLICT`;
- `T-AGD-SERVICE-NOT-ALLOWED`;
- `T-AGD-OUTSIDE-AVAILABILITY`;
- `T-AGD-PACKAGE-RESERVE`;
- `T-AGD-PACKAGE-OVERBOOK`;
- `T-AGD-CONCURRENCY`;
- `T-AGD-RESCHEDULE`.

---

# 7. FC-04 — Check-in e atendimento

## Objetivo

Registrar chegada e iniciar atendimento somente com profissional autorizado.

## Atores

- Recepcionista: check-in e operação administrativa.
- Fisioterapeuta: início do atendimento clínico.

## Pré-condições

- agendamento existente;
- estado elegível;
- paciente presente para check-in.

## Fluxo principal

1. recepção localiza agendamento;
2. executa check-in;
3. estado muda para `AGUARDANDO`;
4. fisioterapeuta autorizado acessa sua agenda;
5. inicia atendimento;
6. estado muda para `EM_ATENDIMENTO`;
7. profissional acessa histórico clínico permitido.

## Exceções

- check-in em estado inválido;
- profissional diferente sem permissão/escopo;
- paciente/agendamento incompatível;
- sessão do usuário expirada.

## Invariantes

- check-in não consome sessão;
- recepção não ganha acesso clínico;
- somente fisioterapeuta autorizado inicia atendimento.

## Critérios de aceite

1. `AGENDADO|CONFIRMADO -> AGUARDANDO` funciona;
2. estado inválido é rejeitado;
3. fisioterapeuta relacionado pode iniciar;
4. usuário administrativo sem capacidade clínica não inicia;
5. início não duplica consumo de pacote.

## Testes

- `T-CHK-VALID`;
- `T-CHK-INVALID-STATE`;
- `T-CHK-NO-CONSUME`;
- `T-ATT-START-AUTH`;
- `T-ATT-WRONG-PROFESSIONAL`;
- `T-ATT-ADMIN-BLOCKED`;
- `T-ATT-NO-CLINICAL-LEAK-RECEPTION`.

---

# 8. FC-05 — Registro e finalização da evolução

## Objetivo

Permitir que o fisioterapeuta documente a sessão e transforme o registro em histórico clínico imutável.

## Ator

Fisioterapeuta relacionado ao atendimento.

## Pré-condições

- atendimento acessível;
- usuário com permissão clínica;
- registro em elaboração.

## Fluxo principal

1. profissional abre atendimento;
2. registra avaliação/evolução necessária;
3. salva alterações enquanto `EM_ELABORACAO`;
4. solicita finalização;
5. sistema valida requisitos e escopo;
6. sistema registra autor e data/hora;
7. muda para `FINALIZADO`;
8. torna conteúdo imutável;
9. registra auditoria;
10. se vinculado a pacote, executa FC-07 idempotentemente;
11. atendimento pode seguir para conclusão operacional.

## Exceções

- usuário fora do escopo;
- registro já finalizado;
- informação obrigatória ausente conforme formulário futuro;
- conflito de operação concorrente;
- falha transacional no consumo de pacote.

## Invariantes

- registro finalizado não retorna a rascunho;
- conteúdo original não é alterado após finalização;
- sistema não produz diagnóstico automaticamente;
- consumo, quando aplicável, ocorre no máximo uma vez.

## Critérios de aceite

1. rascunho pode ser salvo por profissional autorizado;
2. finalização válida produz estado terminal;
3. edição posterior comum é rejeitada;
4. autoria/data/hora permanecem disponíveis;
5. finalização repetida não gera nova sessão consumida.

## Testes

- `T-PRN-DRAFT`;
- `T-PRN-FINALIZE`;
- `T-PRN-IMMUTABLE`;
- `T-PRN-AUTH`;
- `T-PRN-DOUBLE-FINALIZE`;
- `T-PRN-AUDIT`;
- `T-PRN-PACKAGE-INTEGRATION`.

---

# 9. FC-06 — Retificação preservando o original

## Objetivo

Corrigir registro clínico finalizado sem reescrever ou apagar o conteúdo original.

## Atores

- Fisioterapeuta autor do original.
- Fisioterapeuta de terceiro somente com permissão excepcional.

## Pré-condições

- registro original `FINALIZADO`;
- capacidade clínica;
- permissão conforme D-01;
- justificativa obrigatória.

## Fluxo principal — autor do registro

1. profissional abre registro finalizado;
2. solicita retificação;
3. sistema confirma autoria e permissão;
4. profissional informa justificativa e conteúdo corretivo/complementar;
5. retificação permanece em elaboração até efetivação;
6. profissional efetiva;
7. sistema registra vínculo com original, autor e data/hora;
8. retificação torna-se imutável;
9. auditoria é registrada;
10. visualização clínica apresenta original e retificações em sequência rastreável.

## Fluxo excepcional — registro de terceiro

1. profissional solicita retificação de registro de outro autor;
2. sistema exige `prontuario.retificar_terceiro`;
3. justificativa permanece obrigatória;
4. efetivação gera auditoria reforçada.

## Exceções

- administrador sem papel clínico;
- fisioterapeuta sem permissão de terceiro;
- ausência de justificativa;
- tentativa de editar diretamente o original;
- tentativa de alterar retificação já efetivada.

## Invariantes

- original é byte/logicamente preservado no conteúdo de negócio;
- retificação não substitui original;
- retificação efetivada também é imutável;
- correção de retificação gera nova retificação.

## Critério crítico

A representação persistida do conteúdo original antes e depois da retificação deve permanecer equivalente/inalterada segundo o modelo futuro.

## Testes

- `T-RET-OWN`;
- `T-RET-REASON-REQUIRED`;
- `T-RET-ORIGINAL-UNCHANGED`;
- `T-RET-ADMIN-BLOCKED`;
- `T-RET-OTHER-NO-PERMISSION`;
- `T-RET-OTHER-WITH-PERMISSION`;
- `T-RET-IMMUTABLE`;
- `T-RET-AUDIT`.

---

# 10. FC-07 — Consumo único de sessão

## Objetivo

Consumir exatamente uma sessão do pacote na primeira finalização válida do **registro clínico correspondente ao atendimento** associado, sem dupla baixa sob retry ou concorrência.

## Ator funcional

Sistema, provocado pela finalização do registro clínico pelo fisioterapeuta autorizado. `CONCLUIDO` na agenda não é gatilho primário de consumo.

## Pré-condições

- atendimento vinculado a pacote;
- pacote elegível;
- registro clínico finalizado;
- ausência de movimento de consumo para o mesmo atendimento/pacote.

## Fluxo principal

```text
Finalização válida do registro clínico
        |
        v
Atendimento possui pacote?
   não --------> fim sem consumo
   sim
        |
        v
Já existe consumo efetivo para atendimento/pacote?
   sim --------> retornar resultado idempotente
   não
        |
        v
Criar movimento de consumo (-1)
        |
        v
Remover/absorver reserva correspondente
        |
        v
Recalcular visão de saldo/estado
        |
        v
Auditar
```

## Exceções

- pacote expirado/cancelado de forma incompatível;
- consumo já existente;
- falha transacional;
- duas finalizações concorrentes;
- inconsistência entre reserva e vínculo.

## Invariantes

- máximo de um consumo efetivo por atendimento/pacote;
- retry não duplica;
- cancelamento e falta não consomem;
- pagamento não consome;
- ajuste manual é movimento separado.

## Critérios de aceite

1. primeira finalização válida do registro clínico consome uma sessão;
2. segunda chamada idêntica não consome novamente;
3. dez retries resultam em um consumo;
4. concorrência resulta em no máximo um movimento;
5. falta/cancelamento resultam em zero consumo;
6. reserva é liberada/convertida adequadamente.

## Testes

- `T-PKG-CONSUME`;
- `T-PKG-RETRY`;
- `T-PKG-CONCURRENCY`;
- `T-PKG-CANCEL`;
- `T-PKG-NOSHOW`;
- `T-PKG-PAYMENT-NO-CONSUME`;
- `T-PKG-RESERVE-CONVERT`;
- `T-PKG-ADJUST`;
- `T-PKG-ADJUST-AUTH`.

---

# 11. FC-08 — Cobrança e pagamento

## Objetivo

Registrar valor previsto, recebimentos parciais/integrais, cancelamentos e estornos preservando histórico e separação do consumo de sessões.

## Atores

- Recepcionista.
- Administrador.
- Gestor somente com permissão específica de mutação.

## Pré-condições

- paciente identificado;
- usuário com permissão financeira adequada;
- forma de pagamento válida para registro de recebimento.

## Fluxo principal — cobrança e pagamento

1. criar/localizar cobrança;
2. determinar valor bruto;
3. aplicar desconto apenas se autorizado;
4. obter valor líquido;
5. registrar pagamento com valor e forma;
6. recalcular efeito líquido;
7. definir situação: `PENDENTE`, `PARCIALMENTE_PAGO` ou `PAGO`;
8. emitir recibo simples quando solicitado;
9. auditar operações sensíveis.

## Fluxo de estorno

1. usuário solicita estorno integral de um pagamento específico;
2. sistema verifica permissão sensível;
3. valida que o pagamento é elegível e ainda não foi integralmente estornado;
4. cria movimento de estorno pelo valor total daquele pagamento;
5. preserva pagamento original;
6. recalcula o recebimento líquido e deriva `PARCIALMENTE_PAGO`, `PAGO` ou `ESTORNADO`;
7. audita;
8. não devolve sessão automaticamente.

**Limite homologado do MVP:** não existe estorno parcial de um mesmo movimento de pagamento.

## Exceções

- pagamento maior que saldo devido;
- cobrança cancelada;
- forma de pagamento inativa;
- desconto sem permissão;
- estorno sem permissão;
- duplicidade de comando;
- tentativa de cancelar cobrança com pagamentos sem resolver movimentos.

## Invariantes

- valor líquido não negativo;
- pagamento individual preservado;
- estorno é movimento, não delete;
- recibo não é documento fiscal;
- financeiro não altera sessão automaticamente.

## Critérios de aceite

1. pagamento parcial gera `PARCIALMENTE_PAGO`;
2. totalização exata gera `PAGO`;
3. pagamento excessivo é bloqueado;
4. estorno integral preserva pagamento original e recalcula deterministicamente o estado da cobrança;
5. usuário sem permissão não aplica desconto/estorno;
6. estorno não altera saldo de sessões por efeito automático.

## Testes

- `T-FIN-CREATE`;
- `T-FIN-PARTIAL`;
- `T-FIN-MULTI-PARTIAL`;
- `T-FIN-FULL`;
- `T-FIN-OVERPAY`;
- `T-FIN-DISCOUNT-AUTH`;
- `T-FIN-CANCEL`;
- `T-FIN-REFUND`;
- `T-FIN-REFUND-AUTH`;
- `T-FIN-NO-PACKAGE-SIDE-EFFECT`;
- `T-FIN-RECEIPT`.

---

# 12. FC-09 — Indicadores respeitando regras e permissões

## Objetivo

Produzir indicadores reproduzíveis, documentados e autorizados.

## Atores

- Administrador.
- Gestor.
- Recepcionista somente para indicadores operacionais explicitamente permitidos.
- Fisioterapeuta somente para indicadores próprios quando autorizado.

## Pré-condições

- sessão válida;
- permissão para o indicador;
- período/filtros válidos.

## Fluxo principal

1. usuário seleciona período/filtros;
2. backend verifica permissão;
3. aplica fuso operacional;
4. seleciona universo de dados autorizado;
5. aplica fórmula documentada;
6. agrega;
7. retorna somente dimensões/valores autorizados.

## Regras principais

- atendimentos: `CONCLUIDO`;
- distribuição: contagem por estado;
- taxa de faltas: `faltas / (concluidos + faltas) * 100`;
- pacientes atendidos: pacientes distintos com concluído;
- receita prevista: cobranças não canceladas pela data de referência funcional (avulso = atendimento; pacote = contratação; cobrança administrativa = data explicitamente atribuída);
- receita recebida: pagamentos efetivos menos estornos no período;
- produtividade: concluídos por profissional;
- pacote próximo do término: D-05.

## Exceções

- denominador zero;
- usuário sem permissão financeira;
- filtro fora do escopo;
- fuso na virada do dia;
- nenhum dado no período.

## Invariantes

- agregado não contorna permissão;
- mesma regra gera mesmo resultado em dashboard, API e relatório;
- produtividade não é receita;
- agrupamento diário respeita fuso configurado.

## Critérios de aceite

1. indicador pode ser reproduzido pelos dados fonte;
2. usuário sem financeiro não obtém receita;
3. períodos vazios não geram erro matemático;
4. datas próximas da meia-noite UTC caem no dia local correto;
5. D-05 identifica pacotes elegíveis corretamente.

## Testes

- `T-IND-ATTENDANCE`;
- `T-IND-STATE-DIST`;
- `T-IND-NOSHOW-RATE`;
- `T-IND-ZERO-DENOMINATOR`;
- `T-IND-UNIQUE-PATIENTS`;
- `T-IND-REVENUE`;
- `T-IND-PRODUCTIVITY`;
- `T-IND-PACKAGE-ENDING`;
- `T-IND-TIMEZONE`;
- `T-IND-PERMISSION`;
- `T-IND-EMPTY`.

---

# 13. Fluxos complementares importantes

## 13.1 Remarcação com pacote

1. agendamento possui reserva de pacote;
2. usuário solicita novo horário;
3. sistema revalida conflitos;
4. sistema mantém a mesma reserva lógica enquanto o novo compromisso permanecer elegível;
5. se remarcação deixar pacote inelegível, operação é rejeitada ou exige desvinculação explícita conforme regra futura;
6. nenhum consumo ocorre.

## 13.2 Cancelamento com pacote

1. agendamento ativo possui reserva;
2. usuário cancela com motivo;
3. estado vira `CANCELADO`;
4. reserva é liberada;
5. consumo permanece zero;
6. histórico é preservado.

## 13.3 Falta com pacote

1. agendamento elegível é marcado como `FALTA`;
2. reserva é liberada;
3. consumo permanece zero;
4. eventual política futura de cobrança por falta não está incluída no MVP.

## 13.4 Pacote parcialmente pago

1. pacote contratado existe;
2. cobrança pode estar `PARCIALMENTE_PAGO`;
3. agendamento/consumo segue regras de saldo de sessões e não é automaticamente bloqueado pela situação financeira;
4. relatório financeiro reflete o recebimento parcial.

## 13.5 Estorno após sessões consumidas

1. pagamento é estornado financeiramente;
2. consumo clínico-operacional já realizado permanece;
3. se houver necessidade de ajuste de sessões por motivo extraordinário, usar PKG-007 separadamente com autorização e justificativa;
4. nenhum efeito cruzado automático ocorre.

## 13.6 Pacote cancelado com agendamento ativo

1. o cancelamento do pacote não cancela automaticamente o agendamento;
2. o vínculo/reserva daquele pacote torna-se inelegível;
3. antes da finalização do registro clínico, o atendimento deve ser associado a outro pacote elegível ou tratado como avulso;
4. a resolução preserva histórico e auditoria; não há baixa silenciosa do pacote cancelado.

---

# 14. Mapa fluxo → requisitos → regras → testes

| Fluxo | Requisitos | Regras principais | Testes de referência |
|---|---|---|---|
| FC-01 | AUT-001..006 | RN-001..006 | T-AUTH-* |
| FC-02 | PAC-001..007 | RN-007, RN-009..012 | T-PAC-* |
| FC-03 | AGD-001..005, AGD-009, PKG-004 | RN-013..017, RN-031..032 | T-AGD-* |
| FC-04 | AGD-006..008 | RN-018..020 | T-CHK-*, T-ATT-* |
| FC-05 | PRN-001..004, PRN-008 | RN-021..024 | T-PRN-* |
| FC-06 | PRN-005, PRN-008 | RN-025..029 | T-RET-* |
| FC-07 | PKG-003..009 | RN-030..040 | T-PKG-* |
| FC-08 | FIN-001..008 | RN-041..052 | T-FIN-* |
| FC-09 | IND-001..009 | RN-053..060 | T-IND-* |

---

# 15. Critérios de conclusão funcional por fluxo

## FC-01 concluído quando

- login/logout/expiração/revogação funcionam;
- autorização de backend bloqueia acesso indevido;
- recuperação D-04 funciona sem canal transacional integrado.

## FC-02 concluído quando

- paciente pode ser encontrado/criado;
- duplicidade provável não passa silenciosamente;
- recepção não vê prontuário.

## FC-03 concluído quando

- conflitos funcionam inclusive sob concorrência;
- D-06 e D-07 estão cobertos;
- remarcação preserva histórico.

## FC-04 concluído quando

- check-in e início respeitam estados e papéis;
- check-in não consome sessão.

## FC-05 concluído quando

- registro pode ser finalizado;
- original finalizado é imutável;
- autoria e auditoria são preservadas.

## FC-06 concluído quando

- D-01 é aplicado;
- original permanece intacto;
- retificações ficam rastreáveis e imutáveis após efetivação.

## FC-07 concluído quando

- D-02, D-03 e D-07 são preservados;
- retry/concorrência resultam em exatamente um consumo.

## FC-08 concluído quando

- parcial/total/estorno funcionam sem apagar histórico;
- operações sensíveis respeitam permissões;
- financeiro não altera sessões implicitamente.

## FC-09 concluído quando

- fórmulas são reproduzíveis;
- D-05 funciona;
- permissões e fuso são respeitados.

---

# 16. Riscos que os testes devem atacar

1. **Race condition de agenda:** duas reservas no mesmo intervalo.
2. **Duplo consumo:** retries ou chamadas paralelas.
3. **Mutação clínica indevida:** update de registro finalizado.
4. **Retificação destrutiva:** substituição do original.
5. **Escalada de privilégio:** administrador acessando operação clínica por papel amplo.
6. **Vazamento clínico:** recepção recebendo campos de prontuário.
7. **Acoplamento financeiro:** estorno alterando pacote automaticamente.
8. **Cálculo inconsistente:** indicadores divergentes por fuso/filtro.
9. **Auditoria sensível:** conteúdo clínico ou segredo gravado em log.

---

# 17. Pendências não bloqueantes para arquitetura/modelagem

- estratégia técnica de idempotência e constraints;
- definição formal das cardinalidades;
- formato de histórico de agenda;
- escopo técnico de fisioterapeuta-paciente;
- detalhes de atomicidade entre finalização e consumo;
- representação de reservas de pacote;
- mecanismo técnico do estorno integral por movimento; estorno parcial do mesmo pagamento permanece fora do MVP;
- campos obrigatórios dos formulários clínicos;
- contratos da API e códigos de erro.

Nenhuma pendência permite alterar silenciosamente as decisões D-01 a D-07 ou os princípios da TLF-BASE-V1.
