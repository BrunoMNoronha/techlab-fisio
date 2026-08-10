# Perfis e Permissões — TechLab Fisio

> **Documento:** `docs/04-perfis-permissoes.md`  
> **Projeto:** TechLab Fisio  
> **Fase:** 1 — Requisitos, Regras de Negócio e Fluxos Críticos  
> **Status:** HOMOLOGADO — APTO PARA VERSIONAMENTO  
> **Data:** 10 de agosto de 2026  
> **Fonte fundamental:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — TLF-BASE-V1  
> **Decisões relevantes:** D-01, D-03, D-04, D-06, D-07  
> **Homologação relevante:** HOM-01 — Gestor somente leitura por padrão; mutações exigem permissão específica

## 1. Objetivo

Este documento define a matriz funcional preliminar de perfis, permissões, restrições e escopos do MVP. Ele deve orientar a futura implementação de RBAC e autorização por recurso, sem fixar ainda nomes técnicos de claims, tabelas, decorators, guards ou endpoints.

## 2. Princípios

### 2.1 Privilégio mínimo

Cada usuário recebe somente as permissões necessárias às suas atribuições.

### 2.2 Negação por padrão

Operações protegidas não explicitamente permitidas devem ser negadas.

### 2.3 Backend como autoridade

A interface pode ocultar ações, mas toda permissão deve ser validada novamente no backend.

### 2.4 Papéis múltiplos com restrições clínicas

Um usuário pode possuir mais de um papel. As permissões compatíveis podem ser combinadas, porém restrições clínicas específicas permanecem válidas.

Exemplo: um usuário `Administrador + Fisioterapeuta` pode realizar operações clínicas porque também possui papel/capacidade clínica. Um `Administrador` isolado não pode registrar ou retificar evolução apenas pelo papel administrativo.

### 2.5 Escopo por recurso

Permissão abstrata não implica acesso global. O backend deve considerar a relação do usuário com o recurso.

Escopos funcionais previstos:

- **PRÓPRIO:** recurso produzido/pertencente ao próprio usuário quando aplicável.
- **RELACIONADO:** paciente, atendimento ou agenda ligado ao trabalho do usuário.
- **OPERACIONAL:** informações mínimas necessárias à execução administrativa.
- **GLOBAL:** acesso amplo concedido explicitamente a funções de administração/gestão, sujeito às restrições clínicas.

### 2.6 Segregação administrativo x clínico

Dados administrativos de paciente, agenda e financeiro não autorizam automaticamente acesso ao prontuário.

---

# 3. Perfis do MVP

## 3.1 Administrador

### Responsabilidades

- gerenciar usuários, papéis e permissões;
- configurar clínica e cadastros estruturais;
- gerenciar profissionais;
- operar módulos administrativos conforme permissão;
- consultar auditoria;
- executar operações sensíveis administrativas quando explicitamente autorizado.

### Limites

- não possui autoridade clínica apenas por ser administrador;
- não deve usar privilégio administrativo para ler ou produzir conteúdo clínico fora das permissões clínicas aplicáveis;
- retificação clínica somente é possível se o mesmo usuário também possuir capacidade clínica e a permissão necessária.

## 3.2 Gestor

### Responsabilidades

- acompanhar operação;
- consultar indicadores e relatórios;
- consultar financeiro conforme permissão;
- executar mutações administrativas somente quando receber permissão específica adicional.

### Limites

- **somente leitura por padrão**;
- o papel `Gestor` isolado não concede escrita em agenda, pacotes, cobranças, pagamentos ou outras operações mutáveis;
- não gerencia permissões críticas;
- não produz conteúdo clínico apenas por ser gestor;
- não acessa prontuário clínico detalhado por padrão.

## 3.3 Recepcionista

### Responsabilidades

- cadastrar/localizar paciente em nível administrativo;
- operar agenda;
- registrar check-in;
- operar cobranças e pagamentos autorizados;
- consultar informações administrativas mínimas necessárias.

### Limites

- não acessa conteúdo clínico detalhado;
- não registra avaliação, plano, evolução ou retificação;
- não recebe automaticamente permissão para desconto, estorno, ajuste de pacote ou auditoria.

## 3.4 Fisioterapeuta

### Responsabilidades

- acessar agenda relacionada ao próprio trabalho;
- consultar pacientes relacionados;
- acessar prontuário no escopo clínico permitido;
- registrar avaliação, plano, atendimento e evolução;
- anexar documentos clínicos;
- finalizar registros;
- retificar conforme D-01;
- consultar indicadores próprios apenas se essa permissão for prevista.

### Limites

- não administra usuários/permissões;
- não acessa financeiro por padrão;
- não acessa globalmente todos os prontuários apenas por ter papel clínico;
- retificação de registro de terceiro exige permissão excepcional.

---

# 4. Matriz funcional preliminar

Legenda:

- **✓** permitido por padrão para o papel.
- **C** condicionado a escopo, relação com recurso ou configuração operacional.
- **P** exige permissão específica adicional.
- **—** não permitido por padrão.

| Operação | Administrador | Gestor | Recepcionista | Fisioterapeuta |
|---|---:|---:|---:|---:|
| Autenticar/logout próprio | ✓ | ✓ | ✓ | ✓ |
| Recuperar própria senha via fluxo autorizado | ✓ | ✓ | ✓ | ✓ |
| Iniciar recuperação de senha de terceiro | ✓ | — | — | — |
| Gerenciar usuários | ✓ | — | — | — |
| Gerenciar papéis/permissões | ✓ | — | — | — |
| Revogar sessões de terceiro | ✓ | — | — | — |
| Configurar clínica | ✓ | — | — | — |
| Gerenciar serviços | ✓ | — | — | — |
| Gerenciar formas de pagamento | ✓ | — | — | — |
| Gerenciar motivos de cancelamento | ✓ | — | — | — |
| Gerenciar profissionais | ✓ | — | — | — |
| Consultar profissionais | ✓ | ✓ | ✓ | ✓ |
| Cadastrar paciente administrativo | ✓ | — | ✓ | C |
| Editar dados administrativos do paciente | ✓ | — | ✓ | C |
| Localizar paciente | ✓ | C | ✓ | C relacionado |
| Ver observação administrativa | ✓ | — | ✓ | C mínimo |
| Ver prontuário clínico | —* | — | — | C relacionado |
| Criar avaliação/anamnese/plano | —* | — | — | C relacionado |
| Criar evolução | —* | — | — | C relacionado |
| Finalizar registro clínico | —* | — | — | C próprio/relacionado |
| Retificar registro próprio | —* | — | — | P |
| Retificar registro de outro fisioterapeuta | —* | — | — | P excepcional |
| Anexar documento clínico | —* | — | — | C relacionado |
| Exportar relatório clínico | —* | — | — | P relacionado |
| Criar agendamento | ✓ | P | ✓ | C |
| Confirmar agendamento | ✓ | P | ✓ | C |
| Remarcar agendamento | ✓ | P | ✓ | C |
| Cancelar agendamento | ✓ | P | ✓ | C |
| Criar bloqueio de agenda | ✓ | P | P/✓ conforme política | C próprio |
| Efetuar check-in | ✓ | — | ✓ | C |
| Registrar falta | ✓ | P | ✓ | C |
| Iniciar atendimento clínico | —* | — | — | C próprio |
| Concluir atendimento clínico | —* | — | — | C próprio |
| Criar pacote contratado | ✓ | P | ✓ | — |
| Vincular pacote ao agendamento | ✓ | P | ✓ | C leitura mínima |
| Consultar saldo administrativo de pacote | ✓ | ✓ | ✓ | C mínimo |
| Consultar histórico detalhado de movimentos | ✓ | C | C | C mínimo |
| Ajustar sessões manualmente | P | P | — | — |
| Criar cobrança | ✓ | P | ✓ | — |
| Registrar pagamento | ✓ | P | ✓ | — |
| Aplicar desconto | ✓/P | P | P | — |
| Cancelar cobrança | ✓/P | P | P | — |
| Estornar pagamento | ✓/P | P | P | — |
| Emitir recibo simples | ✓ | P | ✓ | — |
| Consultar financeiro global | ✓ | ✓ | — | — |
| Consultar financeiro operacional do paciente | ✓ | ✓ | C | — |
| Consultar indicadores globais | ✓ | ✓ | — | — |
| Consultar indicadores operacionais | ✓ | ✓ | C | C próprio se autorizado |
| Consultar auditoria | ✓ | — | — | — |

`—*`: o papel Administrador isoladamente não concede capacidade clínica. Se o usuário também tiver papel Fisioterapeuta, as permissões clínicas serão avaliadas a partir desse papel e do escopo do recurso.

**HOM-01:** qualquer `P` na coluna Gestor é uma exceção explícita ao modo somente leitura; não existe mutação implícita pelo papel.

---

# 5. Catálogo funcional de permissões sensíveis

Os nomes abaixo são **nomes funcionais**, não contratos técnicos definitivos. A Fase de arquitetura/API poderá estabelecer identificadores técnicos equivalentes sem alterar o significado.

## 5.1 Identidade

### `usuarios.gerenciar`

Permite criar, ativar/inativar e administrar contas, respeitando regras de segurança.

### `permissoes.gerenciar`

Permite atribuir/remover papéis e permissões críticas.

### `sessoes.revogar_terceiro`

Permite revogar sessões de outro usuário.

### `senha.recuperar_terceiro`

Permite iniciar D-04 para outro usuário.

## 5.2 Clínica e profissionais

### `clinica.configurar`

Configuração cadastral e operacional.

### `profissionais.gerenciar`

Cadastro, disponibilidade, serviços e situação.

## 5.3 Pacientes

### `pacientes.administrativo.gerenciar`

Dados administrativos permitidos, sem incluir prontuário.

### `pacientes.localizar`

Pesquisa respeitando minimização e escopo.

## 5.4 Agenda

### `agenda.gerenciar`

Criar/confirmar/remarcar/cancelar conforme escopo.

### `agenda.checkin`

Registrar chegada.

### `agenda.falta`

Registrar não comparecimento.

### `agenda.bloqueio`

Criar/remover bloqueios conforme escopo.

## 5.5 Prontuário

### `prontuario.ler`

Exige papel/capacidade clínica e relação apropriada com o paciente/atendimento.

### `prontuario.escrever`

Criar/editar conteúdo clínico em elaboração.

### `prontuario.finalizar`

Efetivar registro clínico do próprio atendimento/escopo.

### `prontuario.retificar_proprio`

Efetivar retificação conforme D-01 quando o usuário for autor do original.

### `prontuario.retificar_terceiro`

Permissão excepcional para fisioterapeuta retificar registro de outro profissional. Exige justificativa e auditoria reforçada.

### `prontuario.exportar`

Gerar impressão/exportação autorizada.

## 5.6 Pacotes

### `pacotes.gerenciar`

Criar/administrar pacote no nível operacional permitido.

### `pacotes.ajustar_sessao`

Operação sensível. Exige justificativa e auditoria.

## 5.7 Financeiro

### `financeiro.cobranca.gerenciar`

Criar/operar cobranças comuns.

### `financeiro.pagamento.registrar`

Registrar recebimentos.

### `financeiro.desconto.aplicar`

Aplicar desconto dentro das regras do MVP.

### `financeiro.cobranca.cancelar`

Cancelar cobrança elegível.

### `financeiro.pagamento.estornar`

Estornar pagamento. Operação sensível e auditada.

### `financeiro.relatorio.ler`

Consultar relatórios financeiros no escopo autorizado.

## 5.8 Indicadores e auditoria

### `indicadores.globais.ler`

Indicadores gerenciais globais, incluindo financeiro quando cabível.

### `indicadores.proprios.ler`

Indicadores restritos ao próprio profissional.

### `auditoria.ler`

Consultar trilha de auditoria conforme escopo administrativo.

---

# 6. Regras de combinação de papéis

## 6.1 União permitida

Quando um usuário possui mais de um papel, permissões compatíveis podem ser unidas.

Exemplo:

- `Administrador + Fisioterapeuta` pode configurar a clínica e atender pacientes relacionados, se possuir as permissões clínicas exigidas.

## 6.2 União proibida por inferência

Não é permitido inferir permissões sensíveis apenas por papel amplo.

Exemplos:

- `Administrador` não recebe `prontuario.retificar_terceiro` automaticamente.
- `Recepcionista` não recebe `financeiro.pagamento.estornar` automaticamente.
- `Gestor` não recebe `permissoes.gerenciar` automaticamente.
- `Fisioterapeuta` não recebe `indicadores.globais.ler` automaticamente.

## 6.3 Restrições clínicas prevalecem

Mesmo que uma permissão administrativa permita consultar “paciente”, isso não inclui prontuário. A autorização clínica deve ser avaliada separadamente.

---

# 7. Escopo de acesso clínico

## 7.1 Paciente relacionado

Um fisioterapeuta pode acessar conteúdo clínico quando existir relação legítima com o cuidado/trabalho. A definição técnica exata dessa relação será modelada posteriormente, mas não deve se converter em acesso global irrestrito.

## 7.2 Registro próprio

Registro clínico produzido pelo próprio fisioterapeuta dentro do atendimento permitido.

## 7.3 Registro de terceiro

Registro produzido por outro fisioterapeuta. Leitura pode ser permitida quando necessária ao cuidado e escopo; retificação exige `prontuario.retificar_terceiro` por D-01.

## 7.4 Recepção

Pode visualizar apenas o mínimo administrativo necessário para operar cadastro, agenda, pacote e financeiro. Não deve visualizar narrativa clínica detalhada.

---

# 8. Operações sensíveis e controles mínimos

| Operação | Controle adicional obrigatório |
|---|---|
| Alterar papéis/permissões | auditoria; permissão crítica |
| Revogar sessão de terceiro | auditoria |
| Inativar usuário | auditoria; revogação de sessões |
| Retificar próprio registro | justificativa; autoria; auditoria |
| Retificar registro de terceiro | permissão excepcional; justificativa; auditoria reforçada |
| Exportar prontuário/relatório clínico | autorização clínica; auditoria |
| Ajustar sessões de pacote | permissão específica; justificativa; auditoria |
| Aplicar desconto | permissão específica; auditoria da alteração relevante |
| Cancelar cobrança | permissão específica; validar pagamentos existentes; auditoria |
| Estornar pagamento | permissão específica; movimento de estorno; auditoria |
| Consultar auditoria | permissão específica; escopo apropriado |

---

# 9. Casos de autorização obrigatórios para teste

## PERM-T01 — Administrador sem papel clínico

**Dado:** usuário apenas Administrador.  
**Quando:** tenta abrir evolução clínica ou efetivar retificação.  
**Então:** operação é negada.

## PERM-T02 — Administrador + Fisioterapeuta

**Dado:** usuário com ambos os papéis e paciente relacionado.  
**Quando:** cria evolução dentro do escopo.  
**Então:** autorização clínica é avaliada pelo papel/permissão Fisioterapeuta, não pelo Administrador.

## PERM-T03 — Recepcionista e prontuário

**Quando:** recepcionista consulta paciente para agenda.  
**Então:** recebe dados administrativos mínimos e não recebe conteúdo clínico detalhado.

## PERM-T04 — Fisioterapeuta fora do escopo

**Quando:** fisioterapeuta tenta acessar paciente sem relação autorizada.  
**Então:** acesso é negado.

## PERM-T05 — Retificação própria

**Dado:** fisioterapeuta autor e permissão `retificar_proprio`.  
**Então:** pode efetivar com justificativa.

## PERM-T06 — Retificação de terceiro sem permissão

**Então:** negada.

## PERM-T07 — Retificação de terceiro com permissão excepcional

**Então:** permitida apenas para fisioterapeuta; gera auditoria reforçada.

## PERM-T08 — Desconto sem permissão

**Então:** recepcionista/gestor sem permissão específica não aplica desconto via API.

## PERM-T09 — Estorno sem permissão

**Então:** operação negada e nenhuma alteração financeira ocorre.

## PERM-T10 — Indicador financeiro por usuário não autorizado

**Então:** endpoint/dashboard não retorna receita nem por agregação indireta.

---

# 10. Auditoria de autorização

Devem ser auditadas, no mínimo, operações sensíveis executadas e rejeições relevantes de segurança quando isso tiver utilidade operacional, evitando volume/ruído excessivo.

Evento não deve registrar:

- senha;
- token;
- cookie;
- conteúdo integral do prontuário;
- arquivo clínico;
- dados desnecessários ao objetivo da auditoria.

---

# 11. Pendências para detalhamento técnico

Não alteram a matriz funcional aprovada:

1. identificadores técnicos finais das permissões;
2. mecanismo de representação de escopo por recurso;
3. regras exatas para relacionamento fisioterapeuta-paciente em cada jornada;
4. possibilidade de permissões customizadas fora dos papéis padrão, sem criar complexidade excessiva;
5. política de cache/invalidação de autorização;
6. formato de auditoria para negações e acessos clínicos.

Esses itens devem ser decididos na arquitetura/modelagem, mantendo o comportamento deste documento.
