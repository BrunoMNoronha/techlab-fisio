# Requisitos Funcionais — TechLab Fisio

> **Documento:** `docs/02-requisitos.md`  
> **Projeto:** TechLab Fisio  
> **Fase:** 1 — Requisitos, Regras de Negócio e Fluxos Críticos  
> **Status:** HOMOLOGADO — APTO PARA VERSIONAMENTO  
> **Data:** 10 de agosto de 2026  
> **Fonte fundamental:** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — TLF-BASE-V1  
> **Decisões funcionais incorporadas:** D-01 a D-07, aprovadas em 10 de agosto de 2026  
> **Homologações incorporadas:** HOM-01 a HOM-05, aprovadas em 10 de agosto de 2026

## 1. Objetivo

Este documento consolida os requisitos funcionais do MVP do TechLab Fisio. Ele deriva da TLF-BASE-V1 e das decisões funcionais aprovadas na Fase 1. Seu objetivo é orientar, sem antecipar decisões de implementação, a modelagem de domínio, arquitetura, banco de dados, API, testes e desenvolvimento.

Este documento não substitui nem altera a TLF-BASE-V1. Em caso de conflito, prevalece a hierarquia definida na Base Imutável.

## 2. Escopo

O MVP cobre os módulos:

1. autenticação e autorização;
2. configuração da clínica;
3. profissionais;
4. pacientes;
5. agenda;
6. prontuário;
7. sessões e pacotes;
8. financeiro básico;
9. indicadores;
10. auditoria.

Permanecem fora do MVP os itens explicitamente excluídos pela TLF-BASE-V1, incluindo aplicativo móvel nativo, portal do paciente, agendamento público, telemedicina, decisões clínicas por IA, canais transacionais integrados, assinatura ICP-Brasil, emissão fiscal, conciliação bancária, convênios/TISS, estoque, repasses complexos, multiempresa, multitenancy, funcionamento offline e BI avançado.

## 3. Convenções

### 3.1 Identificadores

- `AUT-XXX`: autenticação e autorização.
- `CFG-XXX`: configuração da clínica.
- `PRO-XXX`: profissionais.
- `PAC-XXX`: pacientes.
- `AGD-XXX`: agenda.
- `PRN-XXX`: prontuário.
- `PKG-XXX`: sessões e pacotes.
- `FIN-XXX`: financeiro básico.
- `IND-XXX`: indicadores.
- `AUD-XXX`: auditoria.

### 3.2 Classificação

- **Obrigatório:** requisito diretamente exigido pela TLF-BASE-V1 ou por decisão funcional aprovada.
- **Condicionado:** obrigatório quando a situação descrita ocorrer.
- **Derivado:** necessário para cumprir uma obrigação explícita da Base sem ampliar o escopo funcional.

### 3.3 Princípios transversais

Todos os requisitos devem respeitar:

- privilégio mínimo;
- validação de permissões, estados, cálculos e invariantes no backend;
- proteção de dados pessoais e clínicos sensíveis;
- rastreabilidade de operações sensíveis;
- imutabilidade de registros clínicos finalizados;
- transacionalidade e idempotência nas operações críticas, quando aplicável;
- persistência de datas em UTC e apresentação no fuso configurado;
- responsividade, abordagem mobile first e acessibilidade;
- ausência de dados reais de pacientes em desenvolvimento e testes.

---

# 4. Autenticação e autorização

## AUT-001 — Autenticar usuário ativo

- **Classificação:** Obrigatório.
- **Ator:** Usuário.
- **Objetivo:** Iniciar uma sessão autenticada de forma segura.
- **Pré-condições:** usuário existente; usuário ativo; credencial cadastrada.
- **Gatilho:** submissão de credenciais na tela de login.
- **Fluxo principal:**
  1. usuário informa identificador de acesso e senha;
  2. sistema valida o formato das entradas;
  3. sistema localiza a identidade sem revelar desnecessariamente a existência da conta;
  4. sistema verifica a credencial;
  5. sistema verifica se o usuário está ativo;
  6. sistema cria a sessão autenticada;
  7. sistema aplica papéis, permissões e escopos do usuário;
  8. sistema registra evento de autenticação apropriado.
- **Exceções:** credencial inválida; usuário inexistente; usuário inativo; tentativa abusiva; falha ao criar sessão.
- **Permissões:** não se aplica antes da autenticação.
- **Dados envolvidos:** identificador de acesso, credencial protegida, usuário, sessão de autenticação, papéis e permissões.
- **Dados alterados:** sessão de autenticação; metadados de segurança estritamente necessários.
- **Invariantes:** usuário inativo não cria sessão; senha não é armazenada nem registrada em claro; erros não devem facilitar enumeração de contas.
- **Auditoria:** sucesso e falhas relevantes de autenticação, sem registrar senha, token ou cookie.
- **Critérios de aceite:** credenciais válidas autenticam usuário ativo; credenciais inválidas não autenticam; usuário inativo não autentica.
- **Cenários de teste:** login válido; senha inválida; usuário inexistente; usuário inativo; tentativas repetidas; erro seguro; sessão criada com permissões corretas.
- **Dependências:** AUT-002, AUT-003, AUD-001.
- **Riscos:** enumeração de usuário; brute force; vazamento de credenciais; sessão indevida.
- **Pendências:** nenhuma funcional bloqueante.

## AUT-002 — Encerrar, expirar e revogar sessões

- **Classificação:** Obrigatório.
- **Ator:** Usuário; Administrador autorizado; sistema.
- **Objetivo:** Garantir que sessões possam terminar por logout, expiração ou revogação.
- **Pré-condições:** sessão existente.
- **Gatilho:** logout; expiração; revogação administrativa; inativação do usuário; recuperação/troca de senha conforme política aprovada.
- **Fluxo principal:** sistema altera a situação da sessão e passa a rejeitar seu uso.
- **Estados:** `ATIVA`, `EXPIRADA`, `REVOGADA`.
- **Transições:** `ATIVA -> EXPIRADA`; `ATIVA -> REVOGADA`.
- **Permissões:** usuário pode encerrar a própria sessão; revogação de terceiros exige permissão administrativa.
- **Invariantes:** sessão expirada ou revogada nunca volta a ativa.
- **Auditoria:** logout e revogações administrativas; expiração automática pode ser registrada conforme necessidade operacional.
- **Critérios de aceite:** token/cookie de sessão encerrada não autoriza novas operações.
- **Testes:** logout; timeout; revogação; inativação de usuário; tentativa de reutilização.
- **Dependências:** AUT-001, AUT-005, AUT-004.

## AUT-003 — Autorizar operações por papel, permissão, escopo e recurso

- **Classificação:** Obrigatório.
- **Ator:** Sistema.
- **Objetivo:** Garantir privilégio mínimo em todos os módulos.
- **Pré-condições:** sessão autenticada válida.
- **Gatilho:** qualquer operação protegida.
- **Fluxo principal:** verificar sessão; reunir papéis; resolver permissões; aplicar restrições específicas de conteúdo clínico e operações sensíveis; verificar escopo sobre o recurso; permitir ou negar.
- **Exceções:** sessão inválida; permissão ausente; recurso fora de escopo; operação incompatível com estado atual.
- **Invariantes:** autorização é validada no backend; múltiplos papéis não removem restrições clínicas específicas; papel administrativo não concede automaticamente capacidade de produzir conteúdo clínico.
- **Auditoria:** operações sensíveis e acessos protegidos conforme política de auditoria.
- **Critérios de aceite:** chamada direta à API sem permissão é rejeitada mesmo que a interface esconda a funcionalidade.
- **Testes:** acesso permitido; acesso negado; múltiplos papéis; administrador sem papel clínico; fisioterapeuta fora do escopo do paciente; sessão revogada.
- **Dependências:** `docs/04-perfis-permissoes.md`.

## AUT-004 — Recuperar senha com mecanismo seguro

- **Classificação:** Obrigatório; decisão D-04.
- **Ator:** Administrador autorizado; Usuário.
- **Objetivo:** Permitir recuperação de acesso sem depender, no MVP, de e-mail/SMS/WhatsApp transacional.
- **Pré-condições:** usuário existente; processo iniciado por agente autorizado.
- **Gatilho:** solicitação de recuperação.
- **Fluxo principal aprovado:**
  1. administrador autorizado inicia a recuperação;
  2. sistema gera token/segredo de uso único e curta validade;
  3. o segredo é apresentado uma única vez para entrega segura por canal externo à aplicação;
  4. usuário apresenta o segredo válido;
  5. usuário define nova senha;
  6. segredo é invalidado;
  7. sessões anteriores são revogadas.
- **Exceções:** token inválido, expirado ou já utilizado; usuário inativo; tentativa de reutilização.
- **Invariantes:** administrador não conhece a nova senha; token é de uso único; token não é persistido em claro quando houver alternativa segura; sessões anteriores são revogadas após sucesso.
- **Auditoria:** início e conclusão da recuperação, sem registrar segredo.
- **Critérios de aceite:** token usado ou expirado é rejeitado; nova senha invalida sessões anteriores.
- **Testes:** fluxo válido; expirado; reutilização; usuário inativo; revogação das sessões.

## AUT-005 — Ativar e inativar usuários preservando histórico

- **Classificação:** Obrigatório.
- **Ator:** Administrador.
- **Objetivo:** Controlar acesso sem eliminar autoria ou histórico.
- **Pré-condições:** usuário existente; administrador autorizado.
- **Fluxo principal:** alterar situação do usuário; ao inativar, revogar sessões ativas.
- **Invariantes:** inativação não remove autoria histórica; usuário inativo não cria sessão nem mantém sessão utilizável.
- **Auditoria:** obrigatória.
- **Testes:** ativação; inativação; revogação; autoria histórica preservada.

## AUT-006 — Auditar ações sensíveis de autenticação e autorização

- **Classificação:** Obrigatório.
- **Ator:** Sistema; Administrador na consulta.
- **Objetivo:** Preservar rastreabilidade sem registrar segredos.
- **Critérios de aceite:** eventos relevantes identificam ator, ação, alvo quando houver, data/hora e resultado, sem senha/token/conteúdo clínico desnecessário.
- **Dependências:** AUD-001 a AUD-006.

---

# 5. Configuração da clínica

## CFG-001 — Manter dados cadastrais, contatos, endereço e logotipo

- **Ator:** Administrador.
- **Objetivo:** Configurar a identidade operacional da única clínica do MVP.
- **Pré-condições:** usuário autorizado.
- **Dados:** nome cadastral/operacional, contatos, endereço, logotipo.
- **Invariantes:** o MVP opera uma única clínica; nenhuma configuração deve introduzir tenant ou multiempresa.
- **Auditoria:** alterações relevantes devem ser atribuíveis.
- **Aceite:** dados válidos podem ser consultados e atualizados por administrador autorizado.

## CFG-002 — Configurar horário de funcionamento

- **Ator:** Administrador.
- **Objetivo:** Definir janelas operacionais usadas como referência para agenda e disponibilidade.
- **Invariantes:** horário de funcionamento não substitui disponibilidade específica do profissional; exceções devem ser tratadas explicitamente quando modeladas.
- **Aceite:** novo agendamento fora dos limites pode ser rejeitado conforme regras da agenda.

## CFG-003 — Configurar serviços, duração e preço de referência

- **Ator:** Administrador.
- **Objetivo:** Manter catálogo operacional do MVP.
- **Dados:** serviço, situação, duração padrão, preço de referência.
- **Invariantes:** serviço inativo não deve ser usado em novos agendamentos; histórico permanece íntegro; preço de referência não reescreve cobranças históricas.
- **Aceite:** serviço ativo pode ser associado a profissional e agendamento; inativo permanece visível no histórico.

## CFG-004 — Manter formas de pagamento

- **Ator:** Administrador.
- **Objetivo:** Controlar formas aceitas no registro financeiro.
- **Invariantes:** inativação impede novo uso, mas preserva pagamentos históricos.
- **Aceite:** apenas formas ativas são selecionáveis para novos pagamentos.

## CFG-005 — Manter motivos padronizados de cancelamento

- **Ator:** Administrador.
- **Objetivo:** Padronizar justificativas de cancelamento da agenda.
- **Invariantes:** motivo desativado não deve desaparecer do histórico.
- **Aceite:** cancelamento que exige motivo utiliza motivo permitido.

## CFG-006 — Configurar fuso horário operacional

- **Classificação:** Derivado da TLF-BASE-V1.
- **Ator:** Administrador.
- **Objetivo:** Permitir conversão consistente entre datas persistidas em UTC e datas apresentadas ao usuário.
- **Invariantes:** persistência continua em UTC; datas de negócio e indicadores utilizam o fuso configurado.
- **Aceite:** a mesma ocorrência é exibida no horário local correto e agregada no período local correto.

---

# 6. Profissionais

## PRO-001 — Cadastrar dados pessoais e profissionais

- **Ator:** Administrador.
- **Objetivo:** Manter cadastro do fisioterapeuta/profissional necessário à operação.
- **Dados:** dados pessoais necessários, registro profissional, situação e informações profissionais pertinentes.
- **Invariantes:** somente dados necessários ao objetivo do produto devem ser tratados.
- **Aceite:** profissional válido pode ser cadastrado e consultado segundo permissão.

## PRO-002 — Associar especialidades

- **Ator:** Administrador.
- **Objetivo:** Registrar especialidades relevantes do profissional.
- **Aceite:** associações são preservadas historicamente conforme modelagem futura.

## PRO-003 — Definir disponibilidade e horários

- **Ator:** Administrador.
- **Objetivo:** Definir quando o profissional pode receber agendamentos.
- **Invariantes:** disponibilidade não elimina verificação de conflito; mudanças não reescrevem atendimentos passados.
- **Aceite:** agenda rejeita novo horário incompatível com disponibilidade aprovada.

## PRO-004 — Associar serviços realizados

- **Ator:** Administrador.
- **Objetivo:** Restringir agendamentos aos serviços que o profissional realiza.
- **Invariante:** profissional não pode receber novo agendamento de serviço não associado/permitido.
- **Aceite:** serviço autorizado é selecionável; não autorizado é rejeitado no backend.

## PRO-005 — Ativar/inativar profissional

- **Ator:** Administrador.
- **Objetivo:** Controlar capacidade operacional sem apagar histórico.
- **Invariantes:** profissional inativo preserva atendimentos históricos e não recebe novos agendamentos.
- **Auditoria:** alteração de situação deve ser atribuível.
- **Testes:** ativo; inativo; tentativa de novo agendamento; consulta histórica.

---

# 7. Pacientes

## PAC-001 — Cadastrar paciente

- **Ator:** Recepcionista; Administrador; Fisioterapeuta dentro das permissões aprovadas.
- **Objetivo:** Criar cadastro administrativo do paciente.
- **Pré-condições:** pesquisa prévia por possíveis registros existentes.
- **Dados:** dados pessoais e contato; CPF opcional; situação; dados administrativos permitidos.
- **Fluxo principal:** pesquisar; revisar possíveis duplicidades; informar dados; validar; salvar.
- **Exceções:** possível duplicidade; dado obrigatório ausente; CPF já associado de forma conflitante.
- **Invariantes:** CPF é opcional; nenhum dado clínico é inventado no cadastro; conteúdo clínico permanece separado.
- **Auditoria:** alterações sensíveis conforme política.
- **Aceite:** paciente válido é criado; possível duplicidade recebe tratamento explícito.

## PAC-002 — Localizar paciente com segurança

- **Ator:** Recepcionista; Administrador; Fisioterapeuta relacionado ao trabalho; Gestor apenas quando houver finalidade e permissão.
- **Objetivo:** Encontrar cadastro sem expor conteúdo desnecessário.
- **Dados pesquisáveis:** atributos administrativos autorizados, como nome, CPF quando informado, data de nascimento e contatos conforme desenho posterior.
- **Invariantes:** resultados da recepção não incluem anamnese, evolução ou outras informações clínicas detalhadas.
- **Aceite:** paciente existente é localizável por critérios autorizados; resposta respeita escopo e proteção de dados.

## PAC-003 — Prevenir cadastros duplicados

- **Ator:** Sistema com decisão humana quando necessário.
- **Objetivo:** Reduzir duplicidade sem realizar merge automático inseguro.
- **Fluxo:** normalizar atributos; detectar coincidências fortes/exatas; apresentar candidatos; permitir seleção do registro existente ou continuidade justificada.
- **Invariantes:** sistema não conclui automaticamente que duas pessoas são a mesma; não executa merge automático; CPF duplicado deve ser tratado explicitamente.
- **Aceite:** nomes semelhantes geram alerta apropriado sem unir registros.
- **Testes:** CPF duplicado; nome/data semelhantes; homônimos; ausência de CPF.

## PAC-004 — Manter contato de emergência e responsável legal

- **Ator:** Recepcionista; Administrador; demais perfis conforme necessidade e permissão.
- **Objetivo:** Registrar contatos necessários ao atendimento e representação legal quando aplicável.
- **Invariantes:** responsável legal é condicionado à situação do paciente; histórico e minimização de dados devem ser preservados.

## PAC-005 — Registrar consentimentos e bases de tratamento aplicáveis

- **Ator:** Usuário autorizado conforme fluxo futuro.
- **Objetivo:** Registrar evidências operacionais relacionadas ao tratamento de dados quando aplicável.
- **Importante:** a implementação técnica não autoriza afirmação de conformidade jurídica definitiva.
- **Pendência não bloqueante:** conteúdo jurídico final, hipóteses legais, textos e prazos precisam de validação especializada antes de produção.

## PAC-006 — Ativar/inativar paciente preservando histórico

- **Ator:** Recepcionista/Administrador conforme permissão.
- **Invariantes:** inativação não apaga prontuário, agenda, financeiro ou auditoria; paciente inativo não deve ser usado em novos fluxos sem reativação autorizada.

## PAC-007 — Separar observações administrativas de registros clínicos

- **Ator:** Sistema; todos os perfis segundo permissão.
- **Objetivo:** Impedir vazamento ou uso indevido de conteúdo clínico em superfícies administrativas.
- **Invariantes:** observação administrativa não deve ser usada para armazenar evolução, diagnóstico, hipótese, conduta ou outro conteúdo clínico; prontuário possui autorização distinta.
- **Aceite:** recepcionista consegue operar cadastro e agenda sem acessar conteúdo clínico detalhado.

---

# 8. Agenda

## AGD-001 — Criar agendamento

- **Ator:** Recepcionista; Administrador; Fisioterapeuta conforme permissão operacional futura.
- **Objetivo:** Reservar horário para paciente, profissional e serviço.
- **Pré-condições:** paciente ativo; profissional ativo; serviço ativo; profissional habilitado para o serviço; horário compatível com funcionamento e disponibilidade; ausência de conflito; pacote com capacidade disponível quando vinculado.
- **Dados:** paciente, profissional, serviço, início/fim, modalidade avulsa/pacote, vínculo opcional a pacote, estado inicial.
- **Estado inicial:** `AGENDADO`.
- **Invariantes:** criação não consome sessão de pacote; conflito é validado no backend; vínculo de pacote reserva capacidade conforme D-07.
- **Auditoria:** criação e alterações relevantes.
- **Aceite:** agendamento válido é criado; inválido ou conflitante é rejeitado.

## AGD-002 — Confirmar e remarcar agendamento

- **Ator:** Recepcionista; Administrador; demais perfis conforme permissão.
- **Objetivo:** Confirmar comparecimento previsto ou alterar horário mantendo rastreabilidade.
- **Fluxo de remarcação:** receber novo intervalo; revalidar profissional, serviço, disponibilidade, conflito e reserva de pacote; atualizar; registrar antes/depois no histórico apropriado.
- **Invariantes:** remarcação não é novo consumo; regras de conflito são reexecutadas; histórico relevante é preservado.
- **Aceite:** novo horário conflitante é rejeitado; horário válido é aceito com histórico.

## AGD-003 — Cancelar agendamento com motivo

- **Ator:** Recepcionista; Administrador; demais perfis conforme permissão.
- **Objetivo:** Encerrar o compromisso antes da conclusão.
- **Pré-condições:** estado permite cancelamento.
- **Dados alterados:** estado `CANCELADO`; motivo padronizado; observação administrativa opcional quando apropriada.
- **Invariantes:** cancelamento não consome sessão automaticamente conforme D-02; reserva de pacote é liberada; histórico é preservado.
- **Auditoria:** obrigatória para mudança relevante de agenda.
- **Aceite:** cancelamento inválido por estado é rejeitado; cancelamento válido libera capacidade e preserva histórico.

## AGD-004 — Criar bloqueio de agenda

- **Ator:** Administrador/Recepção conforme permissão definida.
- **Objetivo:** Impedir agendamentos em intervalos indisponíveis.
- **Invariantes:** bloqueio participa da detecção de conflito; não apaga agendamentos existentes silenciosamente.
- **Aceite:** novo agendamento sobreposto ao bloqueio é rejeitado.

## AGD-005 — Prevenir conflitos

- **Ator:** Sistema.
- **Objetivo:** Evitar sobreposição operacional inválida.
- **Conflitos aprovados:**
  1. sobreposição para o mesmo profissional;
  2. sobreposição com bloqueio do profissional;
  3. sobreposição do mesmo paciente, conforme D-06.
- **Invariantes:** validação deve resistir a concorrência; a interface não é a única barreira.
- **Aceite crítico:** duas requisições concorrentes para o mesmo intervalo não produzem dois agendamentos válidos para o mesmo recurso protegido.
- **Testes:** borda de horários; intervalos contidos; sobreposição parcial; concorrência; bloqueio; mesmo paciente.

## AGD-006 — Efetuar check-in manual

- **Ator:** Recepcionista; Administrador; Fisioterapeuta se autorizado.
- **Objetivo:** Registrar a chegada do paciente.
- **Pré-condições:** agendamento em `AGENDADO` ou `CONFIRMADO`.
- **Transição:** `AGENDADO|CONFIRMADO -> AGUARDANDO`.
- **Invariantes:** check-in não consome sessão; check-in não concede acesso clínico à recepção.
- **Aceite:** estado inválido é rejeitado; check-in válido registra autor/data/hora conforme necessidade de histórico.

## AGD-007 — Iniciar e concluir atendimento

- **Ator:** Fisioterapeuta autorizado.
- **Objetivo:** Representar o atendimento em execução e sua conclusão operacional.
- **Transições:** `AGUARDANDO -> EM_ATENDIMENTO -> CONCLUIDO`.
- **Pré-condições para início:** fisioterapeuta autorizado e relacionado ao agendamento.
- **Pré-condições para conclusão:** regras clínicas e operacionais satisfeitas, incluindo finalização do registro clínico quando aplicável à sessão.
- **Invariantes:** usuário administrativo sem papel clínico não inicia atendimento clínico; conclusão vinculada a pacote participa do fluxo de consumo único.
- **Aceite:** transições inválidas ou por profissional não autorizado são rejeitadas.

## AGD-008 — Registrar falta

- **Ator:** Recepcionista/Administrador conforme permissão.
- **Objetivo:** Registrar não comparecimento.
- **Estados origem:** `AGENDADO` ou `CONFIRMADO`, respeitada elegibilidade temporal futura.
- **Destino:** `FALTA`.
- **Invariantes:** falta não consome sessão automaticamente conforme D-02; reserva de pacote é liberada.
- **Aceite:** falta registrada preserva histórico e não reduz consumo efetivo do pacote.

## AGD-009 — Preservar histórico de mudanças relevantes

- **Ator:** Sistema.
- **Objetivo:** Rastrear alterações relevantes em agendamentos.
- **Dados mínimos:** ator, data/hora, operação e valores relevantes anteriores/novos quando necessário.
- **Aceite:** remarcação, cancelamento, confirmação e transições relevantes podem ser reconstruídos em nível funcional adequado.

---

# 9. Prontuário

## PRN-001 — Manter histórico clínico cronológico

- **Ator:** Fisioterapeuta autorizado.
- **Objetivo:** Disponibilizar visão cronológica dos registros clínicos permitidos do paciente.
- **Invariantes:** acesso depende de papel clínico e escopo; registros finalizados e retificações mantêm ordem temporal e autoria.

## PRN-002 — Registrar avaliação, anamnese e plano terapêutico

- **Ator:** Fisioterapeuta.
- **Objetivo:** Registrar conteúdo clínico produzido pelo profissional.
- **Dados possíveis:** anamnese, queixa principal, histórico e antecedentes relevantes, dor, funcionalidade, medidas e escalas necessárias, diagnóstico ou hipótese fisioterapêutica registrada pelo profissional, objetivos, plano terapêutico e demais elementos definidos na Base.
- **Invariantes:** o sistema registra o julgamento profissional; não produz diagnóstico, prescrição ou decisão clínica autônoma.
- **Aceite:** somente usuário com capacidade clínica e escopo adequado cria/altera conteúdo em elaboração.

## PRN-003 — Registrar evolução por atendimento

- **Ator:** Fisioterapeuta relacionado ao atendimento.
- **Objetivo:** Documentar condutas, orientações, intercorrências e evolução da sessão.
- **Pré-condições:** atendimento acessível e profissional autorizado.
- **Estado inicial:** `EM_ELABORACAO`.
- **Invariantes:** autoria e data/hora são atribuíveis; conteúdo em elaboração é editável somente conforme permissões e regras.

## PRN-004 — Finalizar registro clínico

- **Ator:** Fisioterapeuta autorizado.
- **Objetivo:** Tornar o registro clínico definitivo e imutável.
- **Gatilho:** comando explícito de finalização.
- **Fluxo:** validar campos necessários; validar autoria/escopo; persistir estado final; registrar autor/data/hora; bloquear mutação comum; registrar auditoria; acionar, quando aplicável, fluxo idempotente de consumo de pacote.
- **Transição:** `EM_ELABORACAO -> FINALIZADO`.
- **Invariantes:** registro `FINALIZADO` não retorna a rascunho; não pode ser apagado ou reescrito; correção posterior usa retificação.
- **Aceite crítico:** tentativa de alterar conteúdo finalizado por endpoint comum é rejeitada.

## PRN-005 — Retificar registro clínico finalizado

- **Classificação:** Obrigatório; decisão D-01.
- **Ator:** Fisioterapeuta autorizado.
- **Objetivo:** Corrigir ou complementar registro finalizado preservando integralmente o original.
- **Pré-condições:** registro original `FINALIZADO`; usuário com permissão adequada; justificativa obrigatória.
- **Regra de autoria aprovada:**
  - fisioterapeuta pode retificar registro do qual é autor, mediante permissão apropriada;
  - retificação de registro de outro fisioterapeuta exige permissão excepcional específica;
  - Administrador, Gestor ou Recepcionista sem papel/capacidade clínica não efetivam retificação clínica.
- **Fluxo:** selecionar registro; informar justificativa; criar retificação em elaboração; revisar; efetivar; vincular ao original; registrar autor/data/hora/auditoria.
- **Estados da retificação:** `EM_ELABORACAO -> EFETIVADA`.
- **Invariantes:** original permanece inalterado; retificação efetivada também é imutável; nova correção gera nova retificação.
- **Aceite crítico:** após a retificação, o conteúdo do registro original permanece idêntico ao conteúdo anterior à retificação.

## PRN-006 — Gerenciar anexos clínicos privados

- **Ator:** Fisioterapeuta autorizado.
- **Objetivo:** Anexar documentos necessários ao prontuário.
- **Invariantes:** anexos são privados; acesso é temporário/autorizado; URLs e logs não expõem dados sensíveis; remoção e retenção devem respeitar regras clínicas e futuras políticas de retenção.
- **Pendência não bloqueante:** política de retenção e descarte requer validação jurídica/profissional antes da produção.

## PRN-007 — Imprimir/exportar relatório clínico autorizado

- **Ator:** Fisioterapeuta autorizado; outros somente se regra futura expressa permitir.
- **Objetivo:** Gerar relatório autorizado sem ampliar acesso clínico.
- **Auditoria:** exportação de conteúdo clínico deve ser auditável.
- **Aceite:** usuário sem permissão clínica adequada não exporta conteúdo clínico.

## PRN-008 — Auditar acesso e operações clínicas

- **Ator:** Sistema.
- **Objetivo:** Rastrear acesso e mudança de dados sensíveis.
- **Invariantes:** auditoria registra metadados suficientes sem duplicar desnecessariamente o conteúdo clínico.

---

# 10. Sessões e pacotes

## PKG-001 — Registrar pacote contratado

- **Ator:** Recepção; Administrador; Gestor somente com permissão específica de mutação.
- **Objetivo:** Registrar direito contratado a uma quantidade de sessões, com validade opcional.
- **Dados:** paciente, serviço/escopo aplicável, quantidade contratada, validade opcional, situação do pacote.
- **Invariantes:** contratação do pacote não representa pagamento nem consumo; conceitos permanecem separados conforme D-03.

## PKG-002 — Controlar quantidade, validade e ciclo de vida

- **Ator:** Sistema e usuários autorizados.
- **Objetivo:** Determinar elegibilidade e disponibilidade de sessões.
- **Ciclo aprovado para documentação:** `ATIVO`, `ESGOTADO`, `EXPIRADO`, `CANCELADO`.
- **Regra homologada de validade (HOM-05):** quando houver validade, a elegibilidade para reserva/agendamento é verificada contra a **data/hora do atendimento agendado**. Remarcação reexecuta essa validação.
- **Cancelamento do pacote com agendamento ativo (HOM-05):** cancelar o pacote não cancela automaticamente o agendamento já existente. O vínculo com o pacote torna-se inelegível e deve ser resolvido antes da finalização clínica por outro pacote elegível ou tratamento como atendimento avulso.
- **Invariantes:** saldo não é campo livremente editável sem movimento auditável; expiração/cancelamento não apagam movimentos históricos; cancelamento do pacote não cancela silenciosamente a agenda.

## PKG-003 — Vincular agendamento/atendimento ao pacote

- **Ator:** Recepção; Sistema.
- **Objetivo:** Identificar que o atendimento utilizará direito de pacote específico.
- **Pré-condições:** pacote do paciente elegível ao serviço; ativo; com capacidade disponível; quando houver validade, a data/hora do atendimento deve estar dentro da validade do pacote.
- **Invariantes:** um agendamento não pode consumir por si só; vínculo deve ser explícito e rastreável.

## PKG-004 — Reservar capacidade de sessão para agendamento ativo

- **Classificação:** decisão D-07.
- **Ator:** Sistema.
- **Objetivo:** Impedir excesso de agendamentos sobre um saldo insuficiente.
- **Regra aprovada:** agendamento ativo vinculado ao pacote reserva capacidade, mas não reduz consumo efetivo.
- **Fórmula conceitual:** `disponível_para_novos_agendamentos = saldo_de_direito - reservas_ativas`.
- **Liberação de reserva:** cancelamento, falta ou desvinculação válida.
- **Conversão de reserva:** finalização/consumo correspondente elimina a reserva e cria consumo efetivo.
- **Aceite:** pacote com uma única sessão disponível não permite múltiplas reservas incompatíveis.

## PKG-005 — Consumir sessão uma única vez

- **Classificação:** decisão D-02.
- **Ator funcional:** Sistema, provocado pela finalização do registro clínico pelo fisioterapeuta autorizado.
- **Objetivo:** Registrar exatamente uma baixa para atendimento realizado associado a pacote.
- **Gatilho homologado (HOM-04):** primeira finalização válida do **registro clínico correspondente ao atendimento** vinculado ao pacote.
- **Clarificação:** a transição do agendamento para `CONCLUIDO` não é o gatilho primário de consumo e nunca cria uma segunda baixa.
- **Não consomem:** agendamento; confirmação; check-in; início do atendimento; falta; cancelamento; pagamento.
- **Pré-condições:** atendimento vinculado a pacote elegível; registro clínico finalizado; ausência de consumo prévio para o mesmo atendimento/pacote.
- **Fluxo:** validar finalização; validar vínculo; verificar unicidade; criar movimento de consumo; atualizar visões derivadas; auditar.
- **Invariante crítica:** para um mesmo atendimento e pacote existe no máximo um movimento efetivo de consumo.
- **Aceite crítico:** retries e concorrência não geram segunda baixa.

## PKG-006 — Exibir contratadas, agendadas, realizadas, canceladas e restantes

- **Ator:** usuários autorizados conforme perfil.
- **Objetivo:** Dar visão operacional do pacote.
- **Invariantes:** números exibidos devem derivar de dados/movimentos documentados; `agendada` não equivale a `consumida`.
- **Aceite:** valores são reproduzíveis a partir do histórico de reservas, movimentos e atendimentos.

## PKG-007 — Ajustar sessões manualmente com permissão, justificativa e auditoria

- **Ator:** Administrador ou Gestor especificamente autorizado.
- **Objetivo:** Corrigir excepcionalmente saldo de direito sem editar histórico.
- **Pré-condições:** permissão sensível específica; justificativa obrigatória.
- **Fluxo:** informar tipo/quantidade/justificativa; validar; criar movimento de ajuste positivo ou negativo; auditar.
- **Invariantes:** não existe edição direta de consumo anterior; ajuste não pode ser usado para ocultar política automática de falta/cancelamento.
- **Aceite:** ajuste sem permissão ou justificativa é rejeitado.

## PKG-008 — Manter histórico de movimentos de sessão

- **Ator:** Sistema; consulta por usuários autorizados.
- **Objetivo:** Preservar rastreabilidade de consumos e ajustes.
- **Dados mínimos:** pacote, tipo de movimento, quantidade, origem, atendimento quando aplicável, ator quando aplicável, justificativa e data/hora.
- **Invariantes:** movimentos históricos não são apagados/regravados por fluxo comum.

## PKG-009 — Separar contratação, cobrança/pagamento e consumo

- **Classificação:** decisão D-03.
- **Regra aprovada:**
  - contratar pacote não consome sessão;
  - criar cobrança não consome sessão;
  - pagar não consome sessão;
  - estornar pagamento não devolve sessão automaticamente;
  - consumir sessão não cria pagamento automaticamente.
- **Invariante:** financeiro e razão de sessões possuem vínculos rastreáveis, porém efeitos independentes.
- **Política aprovada para MVP:** situação financeira não bloqueia automaticamente atendimento ou consumo; eventual política de inadimplência futura exige requisito explícito.

---

# 11. Financeiro básico

## FIN-001 — Criar cobrança avulsa

- **Ator:** Recepção; Administrador; Gestor somente com permissão específica de mutação.
- **Objetivo:** Registrar valor previsto para serviço avulso.
- **Dados:** paciente, origem, valor bruto, desconto, valor líquido, data de referência/vencimento quando aplicável, situação.
- **Estado inicial:** `PENDENTE` quando não houver recebimento no ato.
- **Invariantes:** valor líquido não pode ser negativo; cobrança não é documento fiscal.

## FIN-002 — Criar cobrança vinculada a pacote

- **Ator:** Recepção; Administrador; Gestor somente com permissão específica de mutação.
- **Objetivo:** Registrar obrigação financeira associada à contratação do pacote.
- **Invariantes:** cobrança não define saldo de sessões; cancelamento/estorno financeiro não altera automaticamente consumos.

## FIN-003 — Aplicar desconto autorizado

- **Ator:** usuário com permissão específica.
- **Objetivo:** Reduzir valor devido de forma controlada.
- **Pré-condições:** cobrança em estado compatível; valor válido; permissão de desconto.
- **Invariantes:** desconto não produz valor líquido negativo; alteração relevante é auditada.
- **Aceite:** usuário sem permissão não aplica desconto pela API.

## FIN-004 — Registrar pagamento integral ou parcial

- **Ator:** Recepção; Administrador; Gestor somente com permissão específica de mutação.
- **Objetivo:** Registrar recebimento associado a cobrança.
- **Dados:** valor, data/hora, forma de pagamento, cobrança, usuário registrador.
- **Estados derivados:**
  - recebido líquido = 0: `PENDENTE`;
  - 0 < recebido líquido < devido: `PARCIALMENTE_PAGO`;
  - recebido líquido = devido: `PAGO`.
- **Invariantes:** cada pagamento é preservado individualmente; forma de pagamento deve ser válida/ativa no momento do registro; pagamento acima do saldo devido é bloqueado no MVP.
- **Aceite:** múltiplos pagamentos parciais compõem corretamente o total recebido.

## FIN-005 — Cancelar cobrança autorizadamente

- **Ator:** usuário com permissão específica.
- **Objetivo:** Invalidar obrigação financeira ainda cancelável sem apagar histórico.
- **Invariantes:** cobrança com recebimentos não deve ser simplesmente cancelada ocultando pagamentos; deve haver resolução explícita dos movimentos financeiros existentes.
- **Auditoria:** obrigatória, com justificativa quando definida na regra de negócio.

## FIN-006 — Estornar pagamento

- **Ator:** usuário com permissão sensível específica.
- **Objetivo:** Reverter efeito financeiro mantendo o pagamento original no histórico.
- **Regra homologada (HOM-03):** no MVP, o estorno é **integral por movimento de pagamento**. Não existe estorno parcial de um mesmo pagamento.
- **Invariantes:** estorno é novo movimento; não elimina pagamento anterior; não devolve sessão automaticamente.
- **Estados derivados após estorno:**
  - recebimento líquido > 0 e < valor devido → `PARCIALMENTE_PAGO`;
  - recebimento líquido = valor devido → `PAGO`;
  - houve recebimento e todos os pagamentos efetivos foram integralmente estornados → `ESTORNADO`.
- **Auditoria:** obrigatória.

## FIN-007 — Emitir recibo simples

- **Ator:** Recepção; Administrador; Gestor somente com permissão específica de mutação.
- **Objetivo:** Produzir comprovante simples de recebimento.
- **Invariantes:** não apresentar o documento como nota fiscal; refletir pagamentos registrados.

## FIN-008 — Consultar relatórios financeiros básicos

- **Ator:** Administrador; Gestor; Recepção apenas no escopo operacional autorizado.
- **Objetivo:** Consultar valores previstos/recebidos por período, profissional, serviço e forma de pagamento.
- **Invariantes:** regras de cálculo são únicas e documentadas; permissões são aplicadas antes da exposição dos dados.

---

# 12. Indicadores

## IND-001 — Atendimentos por dia e período

- **Regra:** contar agendamentos em estado `CONCLUIDO` dentro do período operacional definido no fuso configurado.
- **Aceite:** valor reproduzível por consulta equivalente aos registros de agenda.

## IND-002 — Distribuição por estado do agendamento

- **Regra:** contar agendamentos por estado no período/filtro informado.
- **Aceite:** soma por estados é consistente com universo filtrado.

## IND-003 — Taxa de faltas

- **Regra aprovada para documentação:** `faltas / (concluidos + faltas) * 100`, quando o denominador for maior que zero.
- **Tratamento de vazio:** quando não houver elegíveis no período, apresentar ausência de taxa/zero conforme decisão de UX posterior, sem divisão por zero.
- **Invariante:** cancelados não entram no denominador.

## IND-004 — Quantidade de pacientes atendidos

- **Regra:** número de pacientes distintos com pelo menos um atendimento `CONCLUIDO` no período.

## IND-005 — Receita prevista

- **Regra homologada (HOM-02):** soma dos valores líquidos das cobranças **não canceladas** cuja data de referência pertença ao período consultado.
- **Data de referência funcional:**
  - atendimento avulso → data do atendimento;
  - pacote → data da contratação;
  - cobrança administrativa não vinculada → data de referência explicitamente atribuída à cobrança.
- **Invariante:** pagamento ou estorno não altera, por si só, a receita prevista; esses movimentos afetam a receita recebida. Cancelamento da cobrança exclui seu valor da previsão.
- **Pendência apenas técnica:** a representação persistida da data de referência será definida na modelagem/schema sem alterar esta regra funcional.

## IND-006 — Receita recebida

- **Regra:** soma dos pagamentos efetivos no período menos estornos financeiros correspondentes, usando a data dos movimentos financeiros.

## IND-007 — Pacotes próximos do término

- **Classificação:** decisão D-05.
- **Regra aprovada:** pacote elegível quando possuir validade dentro dos próximos 30 dias **ou** disponibilidade operacional de no máximo 2 sessões.
- **Implementação futura:** os limiares não devem ficar ocultos; devem ser documentados e preferencialmente configuráveis quando isso puder ser feito sem complexidade desnecessária.

## IND-008 — Produtividade por profissional

- **Regra:** quantidade de atendimentos `CONCLUIDO` atribuídos ao profissional no período.
- **Invariante:** produtividade não é sinônimo de receita.

## IND-009 — Respeitar permissões antes da agregação/exposição

- **Ator:** Sistema.
- **Objetivo:** Impedir que indicadores contornem controles de acesso dos dados subjacentes.
- **Invariantes:** usuário sem permissão financeira não recebe receita por dashboard alternativo; fisioterapeuta recebe apenas indicadores próprios quando essa permissão existir.
- **Aceite:** endpoints de indicadores aplicam autorização de forma equivalente aos módulos fonte.

---

# 13. Auditoria

## AUD-001 — Registrar alterações sensíveis

- **Ator:** Sistema.
- **Objetivo:** Preservar atribuição de mudanças relevantes.
- **Eventos mínimos:** alteração de papéis/permissões; situação de usuário; configurações estruturais; alterações relevantes de agenda; finalização/retificação/exportação clínica; ajuste de pacote; desconto; pagamento; cancelamento e estorno financeiro.

## AUD-002 — Registrar acessos a dados clínicos sensíveis quando exigido

- **Ator:** Sistema.
- **Objetivo:** Fornecer trilha de acesso compatível com a sensibilidade do prontuário.
- **Invariante:** não copiar o conteúdo clínico para o evento de auditoria.

## AUD-003 — Preservar metadados mínimos de auditoria

- **Dados mínimos:** ator, ação, tipo/identificador do alvo, data/hora, resultado e justificativa quando obrigatória.
- **Invariantes:** segredos e conteúdo clínico detalhado não são armazenados desnecessariamente.

## AUD-004 — Consultar auditoria segundo permissão

- **Ator:** Administrador autorizado.
- **Objetivo:** Permitir investigação operacional e de segurança.
- **Invariantes:** consulta à auditoria também respeita privilégio mínimo.

## AUD-005 — Impedir edição comum da trilha de auditoria

- **Ator:** Sistema.
- **Objetivo:** Preservar confiabilidade da trilha.
- **Aceite:** fluxos comuns da aplicação não oferecem atualização/exclusão de eventos históricos de auditoria.

## AUD-006 — Manter logs técnicos sem dados sensíveis

- **Ator:** Sistema.
- **Objetivo:** Separar observabilidade técnica de auditoria e conteúdo clínico.
- **Invariantes:** logs não contêm senhas, tokens ou conteúdo clínico sensível; URLs, erros e telemetria não expõem prontuário.

---

# 14. Critérios de aceite consolidados do MVP

1. Usuário ativo autentica; inativo não autentica.
2. Sessões podem expirar e ser revogadas.
3. Backend rejeita operação sem permissão mesmo via chamada direta.
4. Administrador sem papel clínico não produz nem retifica conteúdo clínico.
5. Paciente pode ser localizado sem exposição do prontuário à recepção.
6. Possíveis duplicidades são tratadas antes da criação.
7. Agendamentos concorrentes não podem violar conflito de profissional/bloqueio/paciente.
8. Check-in registra `AGUARDANDO` sem consumir sessão.
9. Apenas profissional autorizado inicia atendimento clínico.
10. Registro clínico finalizado é imutável.
11. Retificação preserva integralmente o original e possui autoria, data e justificativa.
12. Agendamento reserva capacidade do pacote sem consumir sessão.
13. A primeira finalização válida do registro clínico consome exatamente uma sessão quando aplicável; concluir o agendamento não cria nova baixa.
14. Falta e cancelamento não consomem sessão automaticamente.
15. Ajustes de sessão exigem permissão, justificativa e auditoria.
16. Cobrança, pagamento e consumo de sessão permanecem funcionalmente separados.
17. Pagamentos parciais e integrais atualizam corretamente a situação financeira sem apagar movimentos.
18. Estorno integral preserva o pagamento original, recalcula deterministicamente a cobrança e não altera sessões automaticamente.
19. Todos os indicadores têm regras documentadas e testáveis.
20. Indicadores respeitam permissões.
21. Auditoria identifica operações sensíveis sem copiar segredos ou prontuário.
22. Datas exibidas/agregadas respeitam fuso configurado, embora persistidas em UTC.

---

# 15. Matriz requisito → fluxo crítico/complementar → testes

| Fluxo crítico | Requisitos principais | Testes mínimos de referência |
|---|---|---|
| FC-01 Autenticação e autorização | AUT-001..006 | T-AUTH-LOGIN, T-AUTH-INACTIVE, T-AUTH-SESSION, T-AUTH-REVOKE, T-AUTH-RBAC, T-AUTH-ENUMERATION |
| FC-02 Cadastro/localização | PAC-001..007 | T-PAC-CREATE, T-PAC-SEARCH, T-PAC-CPF-DUP, T-PAC-SIMILAR, T-PAC-PERMISSION |
| FC-03 Agendamento sem conflito | AGD-001..005, AGD-009, PKG-004 | T-AGD-CREATE, T-AGD-OVERLAP, T-AGD-BLOCK, T-AGD-PATIENT-CONFLICT, T-AGD-CONCURRENCY, T-AGD-RESCHEDULE |
| FC-04 Check-in e atendimento | AGD-006..008 | T-CHK-VALID, T-CHK-INVALID-STATE, T-ATT-START-AUTH, T-ATT-WRONG-PROFESSIONAL |
| FC-05 Evolução/finalização | PRN-001..004, PRN-008 | T-PRN-DRAFT, T-PRN-FINALIZE, T-PRN-IMMUTABLE, T-PRN-AUTH |
| FC-06 Retificação | PRN-005, PRN-008 | T-RET-OWN, T-RET-OTHER-AUTH, T-RET-ORIGINAL, T-RET-UNAUTHORIZED, T-RET-AUDIT |
| FC-07 Consumo único | PKG-003..009 | T-PKG-RESERVE, T-PKG-CONSUME, T-PKG-RETRY, T-PKG-CONCURRENCY, T-PKG-CANCEL, T-PKG-NOSHOW, T-PKG-ADJUST |
| FC-08 Cobrança/pagamento | FIN-001..008 | T-FIN-PARTIAL, T-FIN-FULL, T-FIN-DISCOUNT, T-FIN-CANCEL, T-FIN-REFUND, T-FIN-DUP |
| FC-09 Indicadores | IND-001..009 | T-IND-FORMULA, T-IND-TIMEZONE, T-IND-FILTER, T-IND-PERMISSION, T-IND-EMPTY |
| FT-01 Configuração da clínica | CFG-001..006 | T-CFG-CRUD-AUTH, T-CFG-INACTIVE-HISTORY, T-CFG-TIMEZONE |
| FT-02 Profissionais | PRO-001..005 | T-PRO-CREATE, T-PRO-INACTIVE, T-PRO-AVAILABILITY, T-PRO-SERVICE-AUTH |
| FT-03 Auditoria transversal | AUD-001..006 | T-AUD-SENSITIVE-ACTION, T-AUD-READ-AUTH, T-AUD-IMMUTABLE, T-AUD-NO-SENSITIVE-LOG |

`FT-*` identifica fluxo transversal/complementar, não um novo fluxo crítico. Todas as famílias de requisitos ficam assim explicitamente ligadas a fluxo e testes de referência.

Para cada fluxo crítico ou transversal, aplicar ainda, quando pertinente: caminho feliz, vazio, borda, duplicidade, autorização, concorrência, idempotência, volume compatível, auditoria e não vazamento de dados sensíveis.

---

# 16. Dependências documentais

- `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` — autoridade fundamental.
- `docs/03-regras-negocio.md` — detalha invariantes e decisões funcionais.
- `docs/04-perfis-permissoes.md` — define matriz preliminar de acesso.
- `docs/05-jornadas-fluxos.md` — formaliza jornadas, máquinas de estado e cenários críticos.

# 17. Riscos funcionais principais

1. **Integridade clínica:** mutação indevida de registro finalizado.
2. **Duplo consumo:** retries/concorrência baixando mais de uma sessão.
3. **Conflito de agenda:** race condition permitindo sobreposição.
4. **Acoplamento financeiro/pacote:** pagamento alterando saldo de sessões indevidamente.
5. **Permissão administrativa excessiva:** administração usada para contornar restrição clínica.
6. **Indicadores divergentes:** fórmulas diferentes entre tela, API e relatório.
7. **Auditoria excessiva:** duplicação de conteúdo clínico em logs/eventos.

# 18. Pendências para fases posteriores

Estas pendências não alteram o escopo aprovado e devem ser resolvidas antes da implementação correspondente:

- campos obrigatórios específicos por formulário clínico;
- política jurídica final de consentimentos, retenção e descarte;
- formato final de relatórios/exportações clínicas;
- representação técnica/persistida da data de referência da receita prevista, mantendo HOM-02;
- granularidade final das permissões técnicas a partir da matriz funcional;
- estruturas de dados, cardinalidades, índices, transações e contratos de API;
- versões exatas das dependências e detalhes de infraestrutura.

Nenhum desses pontos autoriza alterar a Base ou ampliar o MVP silenciosamente.
