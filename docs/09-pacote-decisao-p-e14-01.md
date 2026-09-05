# Pacote de Decisão P-E14-01 — Catálogo de auditoria e whitelist de `contexto`

> **Documento:** `docs/09-pacote-decisao-p-e14-01.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Implementação física — `E-18A`
> **Status:** **DECIDIDO — DECISÕES `D-AUD-01`..`D-AUD-08` HOMOLOGADAS POR BRUNO MENEZES NORONHA EM 25/08/2026 (REGISTRO NORMATIVO EM §12); DECISÕES `PBACK-AUD-01`..`PBACK-AUD-08` HOMOLOGADAS EM 05/09/2026 (REGISTRO NORMATIVO EM §13); `PBACK-AUD-09` — REAVALIAÇÃO DE `L-07` SOBRE O PACOTE `docs/13` — DECIDIDA EM 05/09/2026 (REGISTRO NORMATIVO EM §13.4.1: `autorizacao.negada` HOMOLOGADA COMO 25ª AÇÃO, WHITELIST VAZIA, EMISSÃO RESTRITA A `senha.recuperar_terceiro`). `L-06` PERMANECE ABERTA / BLOQUEADA — §13.3**
> **Data:** 25 de agosto de 2026 (proposta e decisão de `P-E14-01`); 05 de setembro de 2026 (decisão de `P-BACK-01-D2` — §13; decisão de reavaliação de `L-07` — §13.4.1)
> **Natureza:** §§1..11 são preservados **como a proposta original submetida à decisão** (insumo decisório histórico, sem valor normativo próprio); **§12 é o registro normativo da decisão homologada** de `P-E14-01`; **§13 é o registro normativo da decisão homologada** de `P-BACK-01-D2`, que cumpre o que `D-AUD-06` adiou. Onde §12 divergir de §§1..11, **§12 prevalece**; §13 **não altera nem reabre** §12. Este documento não altera `docs/02`..`docs/07`.

---

## 1. O que está bloqueado e por quê

`docs/07` §22.3 determina que `evento_auditoria.acao` e `evento_auditoria.resultado` sejam `text` com **catálogo documentado da aplicação** e que `evento_auditoria.contexto` (jsonb) use **lista branca de chaves por ação, validada na aplicação**. Nenhuma fonte homologada, porém, **enumera** as ações, os valores de `resultado` ou as chaves permitidas — a E-14 verificou isso fonte a fonte e registrou o bloqueio como `P-E14-01` (`docs/08` §13 `E-14`, item 4; §19). Consequências vigentes:

- `T-AUD-CONTEXTO` é o único `todo` da suíte (79 passed · 1 todo) e **assim permanece** até a decisão;
- `R2.2-04` (vazamento clínico via `contexto`) permanece aberto — a mitigação homologada depende da whitelist;
- `R2.2-04`/`T-AUD-CONTEXTO` **não bloqueiam** nenhuma outra frente da persistência.

Este pacote reúne o que as fontes **já exigem**, o que **falta decidir**, e uma proposta mínima — separando rigorosamente cada categoria.

## 2. Fatos normativos já presentes nas fontes

| # | Fato | Fonte |
| --- | --- | --- |
| F-01 | Campos mínimos do evento: **ator, ação, tipo/identificador do alvo, data/hora, resultado, justificativa quando obrigatória** | AUD-003; RN-061 |
| F-02 | Eventos mínimos exigidos: alteração de papéis/permissões; situação de usuário; configurações estruturais; alterações relevantes de agenda; finalização/retificação/exportação clínica; ajuste de pacote; desconto; pagamento; cancelamento e estorno financeiro | AUD-001 |
| F-03 | Autenticação: auditar **sucesso e falhas relevantes** de login, logout, revogação administrativa, recuperação de senha (início e conclusão, **sem registrar o segredo**), mudanças de papéis/permissões | AUT-001..006; `docs/05` FC-01 "Auditoria" |
| F-04 | Auditoria **não copia** conteúdo clínico, senha, token, cookie, segredo, arquivo clínico, nem dado pessoal sem necessidade demonstrada | AUD-002/003/006; RN-062/063; `docs/04` §10; TLF-BASE-V1 §10; `docs/07` §22.3 |
| F-05 | Cada `Movimento de Sessão` gera evento de auditoria com o `correlacao_id` da transação | `docs/07` §14; PKG-007; RN-061 |
| F-06 | Desconto: evento com **valor anterior e novo** em `contexto` | `docs/07` §19.2; FIN-003 |
| F-07 | Recálculo de `data_referencia` na remarcação: evento **obrigatório** com **valor anterior e novo** | `PROP-RN-2.2-01` homologada — `docs/07` §20.3 |
| F-08 | Retificação de registro de terceiro exige **auditoria reforçada** (autor da retificação, registro original, justificativa, data/hora) | D-01.4; `docs/04` §8 |
| F-09 | T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08 e T-09 incluem `evento_auditoria` na própria transação | `docs/07` §24.2; `docs/06` §12 |
| F-10 | `historico_agendamento` e `evento_auditoria` **coexistem**: mudança relevante de agenda gera as duas linhas com o mesmo `correlacao_id`; o histórico funcional carrega as colunas tipadas de antes/depois | `docs/07` §22.4; AGD-009 |
| F-11 | Operação sensível → Evento de auditoria é `1 — 1..*` | `docs/06` §9 |
| F-12 | `resultado` existe como campo, mas **os valores não são enumerados por fonte** — enum foi removido exatamente por isso; vira catálogo da aplicação | AUD-003; `docs/07` §2.2, §11.1 |
| F-13 | A validação da whitelist é **da aplicação** (fail-closed por desenho), documentada junto ao catálogo; nenhum serializador genérico escreve em `contexto` | `docs/07` §22.3 |

## 3. Lacunas reais (o que nenhuma fonte define)

| # | Lacuna |
| --- | --- |
| L-01 | **Nomes** das ações (`evento_auditoria.acao`) — as fontes exigem *que* se audite, nunca *como se chama* o evento |
| L-02 | Valores do catálogo de `resultado` |
| L-03 | Whitelist de chaves de `contexto` por ação |
| L-04 | Catálogo de `alvo_tipo` (nome lógico do recurso) |
| L-05 | Quais transições de agenda além de criação/remarcação/cancelamento geram `evento_auditoria` (RN-017 delega ao "nível de auditoria/histórico definido") |
| L-06 | Condição do "quando exigido" de AUD-002 (auditar **acesso de leitura** a dados clínicos) |
| L-07 | Quais **negações** de autorização são auditadas (`docs/04` §10: "quando isso tiver utilidade operacional") |
| L-08 | O que é "alteração sensível" do cadastro de paciente (PAC-001: "conforme política" — política inexistente) |

## 4. Princípios de minimização aplicados à proposta

1. **Proibições absolutas em `contexto`** (deriva de F-04): nome de paciente, CPF, telefone, e-mail, conteúdo de prontuário, anamnese, diagnóstico/hipótese, evolução, conduta, observação clínica, conteúdo de anexos, senha, token, segredo, payload de requisição/resposta, URLs privadas de objeto.
2. **Regra de necessidade**: chave de `contexto` só para valor que **não fica persistido em nenhuma linha de negócio recuperável** — tipicamente o *valor anterior* de uma mutação (é exatamente o racional de `docs/07` §22.3: "investigação exige dados como 'valor anterior do desconto'"). O que o alvo já carrega (`alvo_tipo` + `alvo_id`) ou o `historico_agendamento` já tipifica **não** se duplica em `contexto`.
3. **IDs técnicos** (uuid) somente quando estritamente necessários à rastreabilidade e coerentes com `alvo_tipo`/`alvo_id` — por exemplo, o `registro_original_id` na auditoria reforçada de retificação de terceiro (F-08).
4. `justificativa` usa a **coluna própria** do evento (F-01), nunca `contexto`.

## 5. Candidatos de catálogo de `acao`

Os **nomes são proposta** (padrão `<recurso>.<operacao>` em snake_case); a **obrigação de auditar** é o que cada linha classifica. Legenda: **DD** = DERIVADA DIRETAMENTE (fonte exige o evento); **RC** = RECOMENDAÇÃO (evento coerente/prudente; fonte não o exige expressamente); **SF** = SEM FONTE SUFICIENTE (adotar sem decisão seria invenção).

| Ação candidata | Ator(es) | Evento disparador | `alvo_tipo` | `resultado` necessário? | Chaves mínimas de `contexto` | Chaves expressamente proibidas | Fonte | Classe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `usuario.autenticacao` | Usuário (ator ∅ se falha sem identidade) | Login: sucesso e falha relevante | `usuario` (`alvo_id` ∅ na falha sem conta) | **Sim** (distinguir sucesso × falha) | — (nenhuma) | identificador tentado em texto livre, senha, qualquer credencial | AUT-001; FC-01 | **DD** |
| `usuario.sessao.logout` | Usuário | Logout | `sessao_autenticacao` | Não (só sucesso) | — | token, cookie | AUT-002; FC-01 | **DD** |
| `usuario.sessao.revogacao` | Administrador | Revogação administrativa (própria ou em massa via T-07) | `sessao_autenticacao` ou `usuario` | Não | — | token | AUT-002; `docs/04` §8 | **DD** |
| `usuario.sessao.expiracao` | Sistema | Expiração automática | `sessao_autenticacao` | Não | — | — | AUT-002 ("pode ser registrada conforme necessidade") | **RC** |
| `usuario.senha.recuperacao_iniciada` | Administrador | Início de D-04 | `usuario` | Não | — | segredo/token, hash | AUT-004; D-04 | **DD** |
| `usuario.senha.recuperacao_concluida` | Usuário | Conclusão de D-04 (T-07) | `usuario` | Não | — | segredo, nova senha | AUT-004; D-04; T-07 | **DD** |
| `usuario.situacao.alterada` | Administrador | Ativação/inativação | `usuario` | Não | `ativo_anterior`, `ativo_novo` (boolean) | — | AUT-005; AUD-001 | **DD** |
| `usuario.papeis.alterados` | Administrador | Atribuir/remover papel ou permissão | `usuario` | Não | `papeis_anteriores`, `papeis_novos` (códigos de catálogo — `docs/04` §5) | — | AUD-001; FC-01; `docs/04` §8 | **DD** |
| `configuracao.alterada` | Administrador | Mutação em clínica, serviço, forma de pagamento, motivo, horário, fuso | tabela alvo (`clinica`, `servico`, …) | Não | `campos_alterados` (nomes de campos, **sem valores**, exceto pares anterior/novo de campos não sensíveis a definir) | logotipo binário | AUD-001 ("configurações estruturais"); CFG-001 | **DD** *(granularidade das chaves: decisão)* |
| `profissional.situacao.alterada` | Administrador | Ativação/inativação | `profissional` | Não | `ativo_anterior`, `ativo_novo` | — | PRO-005 | **DD** |
| `paciente.cadastro.alterado` | Recepção/Admin | Alteração "sensível" do cadastro | `paciente` | Não | `campos_alterados` (nomes, sem valores) | **qualquer valor** de dado pessoal (nome, CPF, telefone, e-mail) | PAC-001 ("conforme política" — L-08) | **SF** — a própria política de sensibilidade não existe |
| `paciente.situacao.alterada` | Recepção/Admin | Ativação/inativação/reativação | `paciente` | Não | `ativo_anterior`, `ativo_novo` | dados pessoais | PAC-006; AUD-001 (situação — literal só para usuário) | **RC** |
| `agendamento.criado` | Recepção/Admin/Fisio | T-01 (criação) | `agendamento` | Não | — (antes/depois vive em `historico_agendamento`, F-10) | dados do paciente | AGD-001; T-01 | **DD** |
| `agendamento.remarcado` | Recepção/Admin | T-01 (remarcação) | `agendamento` | Não | — (idem) | — | AGD-002; RN-016/017; T-01 | **DD** |
| `agendamento.cancelado` | Recepção/Admin | T-08 | `agendamento` | Não | `motivo_cancelamento_id` (uuid) | texto livre de motivo clínico | AGD-003 ("auditoria obrigatória"); T-08 | **DD** |
| `agendamento.falta_registrada` | Recepção/Admin | T-08 | `agendamento` | Não | — | — | AGD-008; RN-017 (nível a definir — L-05) | **RC** |
| `agendamento.confirmado` / `agendamento.checkin` | Recepção/Admin | Transições `CONFIRMADO`/`AGUARDANDO` | `agendamento` | Não | — | — | AGD-002/006; RN-017 (L-05) — `historico_agendamento` já cobre o funcional | **RC** |
| `atendimento.iniciado` | Fisioterapeuta | T-09 | `atendimento` | Não | `agendamento_id` (uuid) | conteúdo clínico | AGD-007; T-09 (inclui `evento_auditoria`) | **DD** |
| `agendamento.concluido` | Fisioterapeuta | `EM_ATENDIMENTO → CONCLUIDO` | `agendamento` | Não | — | — | AGD-007; RN-017 (L-05) | **RC** |
| `bloqueio_agenda.criado` | Admin/Recepção | AGD-004 | `bloqueio_agenda` | Não | — | — | AGD-004 (auditoria não exigida expressamente) | **RC** |
| `registro_clinico.finalizado` | Fisioterapeuta | T-02 — primeira finalização válida | `registro_clinico` | Não | `atendimento_id` (uuid) | **todo** conteúdo clínico | PRN-004; AUD-001; T-02 (auditoria crítica) | **DD** |
| `retificacao_clinica.efetivada` | Fisioterapeuta | Efetivação (própria) | `retificacao_clinica` | Não | `registro_original_id` (uuid) | conteúdo clínico, justificativa em contexto (usa a coluna) | PRN-005; D-01; AUD-001 | **DD** |
| `retificacao_clinica.efetivada_terceiro` | Fisioterapeuta c/ permissão excepcional | Efetivação de registro de outro autor — **auditoria reforçada** | `retificacao_clinica` | Não | `registro_original_id`, `autor_original_usuario_id` (uuids) | conteúdo clínico | D-01.3/D-01.4; `docs/04` §8; F-08 | **DD** |
| `prontuario.exportado` | Fisioterapeuta autorizado | Impressão/exportação | `registro_clinico` (ou `paciente`) | Não | `formato` (catálogo curto) | conteúdo exportado, caminho/URL do arquivo | PRN-007; RN-029; AUD-001 | **DD** *(alvo exato: decisão)* |
| `prontuario.acessado` | Fisioterapeuta | **Leitura** de conteúdo clínico | `registro_clinico`/`paciente` | Não | — | conteúdo lido | AUD-002 — "quando exigido" (L-06) | **SF** — a condição de exigência não está definida |
| `anexo_clinico.enviado` | Fisioterapeuta | Upload de anexo | `anexo_clinico` | Não | — | conteúdo, `chave_objeto`, URL | PRN-006 (auditoria não exigida expressamente) | **RC** |
| `pacote.criado` | Recepção/Admin | PKG-001 | `pacote` | Não | — | — | PKG-001 (auditoria não exigida) | **RC** |
| `pacote.cancelado` | Admin autorizado | Cancelamento administrativo | `pacote` | Não | — (motivo na linha do pacote) | — | RN-040; HOM-05 (auditoria não exigida expressamente; operação claramente sensível) | **RC** |
| `sessao.consumida` | Sistema (provocado pela finalização) | T-02 — movimento `CONSUMO` | `movimento_sessao` | Não | `atendimento_id`, `pacote_id` (uuids) | — | PKG-005 ("auditar"); F-05; HOM-04 | **DD** |
| `sessao.ajustada` | Admin/Gestor autorizado | T-06 — `AJUSTE_POSITIVO`/`AJUSTE_NEGATIVO` | `movimento_sessao` | Não | `tipo`, `quantidade` | justificativa em contexto (usa a coluna própria) | PKG-007; AUD-001; RN-038; F-05 | **DD** |
| `cobranca.criada` | Recepção/Admin | FIN-001/002 | `cobranca` | Não | — | — | FIN-001/002 (AUD-001 não lista criação de cobrança) | **RC** |
| `cobranca.desconto_aplicado` | Usuário c/ `financeiro.desconto.aplicar` | FIN-003 | `cobranca` | Não | `valor_desconto_anterior`, `valor_desconto_novo` (decimais como string) | — | FIN-003; AUD-001; **F-06 (chaves literais da fonte)** | **DD** |
| `cobranca.cancelada` | Usuário c/ `financeiro.cobranca.cancelar` | T-05 | `cobranca` | Não | — (motivo na linha; justificativa na coluna) | — | FIN-005 ("auditoria obrigatória"); AUD-001; T-05 | **DD** |
| `cobranca.data_referencia_recalculada` | Sistema (dentro de T-01) | Remarcação válida de agendamento com cobrança avulsa | `cobranca` | Não | `data_referencia_anterior`, `data_referencia_nova` (datas civis ISO) | — | **`PROP-RN-2.2-01` — F-07 (chaves literais da fonte)** | **DD** |
| `pagamento.registrado` | Recepção/Admin | T-03 | `pagamento` | Não | — (valor/forma na própria linha) | — | FIN-004; AUD-001; T-03 | **DD** |
| `pagamento.estornado` | Usuário c/ `financeiro.pagamento.estornar` | T-04 | `estorno` | Não | `pagamento_id` (uuid) | — | FIN-006 ("auditoria obrigatória"); AUD-001; T-04 | **DD** |
| `recibo.emitido` | Recepção/Admin | FIN-007 | `cobranca` | Não | — | — | FIN-007 (auditoria não exigida) | **RC** |
| `auditoria.consultada` | Administrador | AUD-004 | `evento_auditoria` (∅) | Não | `filtros` (nomes, sem valores pessoais) | valores pesquisados com dado pessoal | AUD-004 (consulta autorizada; auditar a consulta não é exigido) | **SF** |
| `autorizacao.negada` | Sistema | Rejeição relevante de segurança | recurso alvo | **Sim** (`NEGADO`) | `permissao_requerida` (código de catálogo) | payload da requisição | `docs/04` §10 — "quando tiver utilidade operacional" (L-07) | **SF** — o critério de relevância não está definido |

## 6. Candidatos para o catálogo de `resultado`

`docs/07` §2.2 removeu o enum `SUCESSO/NEGADO/FALHA` por ser **enumeração inferida** — mas o registrou como o candidato natural de catálogo da aplicação. Proposta (RECOMENDAÇÃO):

- `SUCESSO` — operação efetivada;
- `NEGADO` — rejeitada por autorização/regra de negócio;
- `FALHA` — não efetivada por erro (ex.: credencial inválida no login).

Eventos que só existem em caso de sucesso (a transação faz rollback conjunto — F-09) registrariam sempre `SUCESSO`; a distinção só trabalha de fato em `usuario.autenticacao` e nos eventos SF de negação. **Adotar exige decisão** — inclusive a alternativa legítima de `resultado` com valor único `SUCESSO` no MVP, deixando `NEGADO`/`FALHA` para quando L-06/L-07 forem decididas.

## 7. Candidato para o catálogo de `alvo_tipo`

RECOMENDAÇÃO: o **nome físico da tabela** do alvo (`usuario`, `agendamento`, `registro_clinico`, `movimento_sessao`, `cobranca`, …) — determinístico, estável, sem invenção de vocabulário novo, coerente com `alvo_id` uuid e com IDX-U1.

## 8. Itens que seriam INVENÇÃO se adotados sem decisão

1. **Qualquer nome de ação** — todos os identificadores de §5 são proposta; a fonte nunca nomeia eventos.
2. Os **valores de `resultado`** (§6) — enumeração já retirada uma vez por não ter fonte.
3. As linhas **SF**: `paciente.cadastro.alterado` (política de sensibilidade — L-08), `prontuario.acessado` (condição de AUD-002 — L-06), `autorizacao.negada` (critério de utilidade — L-07), `auditoria.consultada`.
4. A **granularidade** de `configuracao.alterada` (um evento genérico × um por entidade; quais pares anterior/novo).
5. Promover qualquer linha **RC** a obrigatória.
6. Qualquer mecanismo físico novo (enum de banco, CHECK, trigger, JSON Schema em banco) — expressamente vedado por `docs/07` §22.3/§2.2 e pelo enunciado desta tarefa.

## 9. Recomendação mínima para desbloquear `T-AUD-CONTEXTO`

A **menor decisão suficiente** não exige homologar o catálogo inteiro. Basta Bruno:

1. homologar o **conjunto DD de §5** (nomes podem ser ajustados no ato) como catálogo inicial de `acao`, com as chaves mínimas e proibições propostas;
2. decidir §6 (`resultado`) — inclusive a variante mínima "só `SUCESSO` no MVP";
3. confirmar §7 (`alvo_tipo` = nome de tabela);
4. declarar as linhas **RC** e **SF** como *fora do catálogo inicial* (reavaliáveis quando `apps/api` existir e L-05..L-08 forem decididas).

Com isso, `T-AUD-CONTEXTO` passa a ser implementável **contra o catálogo homologado**: o teste materializa a whitelist como fixture da persistência (a validação em si continua sendo da aplicação — F-13) e o `it.todo` é substituído por prova real na etapa que Bruno autorizar (E-18B). `R2.2-04` só encerra quando a validação existir na camada de aplicação.

## 10. Camada de validação — recomendação para o futuro backend

`docs/07` §22.3 permanece determinando validação **na aplicação**. Quando `apps/api` existir:

- **catálogo centralizado** (módulo único, tipado, derivado do catálogo homologado — nunca strings soltas por chamada);
- **whitelist por ação, fail-closed**: ação desconhecida → rejeição; chave de `contexto` fora da whitelist da ação → rejeição;
- **nenhuma sanitização silenciosa** (não remover chaves e prosseguir — falhar ruidosamente);
- **nenhuma serialização indiscriminada** de DTO/entidade/request em `contexto`;
- justificativa obrigatória verificada por ação (D-01, RN-038, FIN-005);
- **testes unitários** do validador e **de integração** do fluxo completo quando `apps/api` existir.

**Nada disso é implementado agora**, e a persistência **não** ganha trigger/CHECK/JSON Schema para compensar a inexistência do backend — o banco garante forma (`jsonb ∅`), a aplicação garante política.

## 11. Perguntas objetivas para Bruno (destravam E-18B)

1. Homologa o conjunto **DD** de §5 como catálogo inicial de `acao` (com ou sem ajuste de nomes)?
2. `resultado`: catálogo `SUCESSO/NEGADO/FALHA` ou variante mínima só-`SUCESSO` no MVP?
3. Confirma `alvo_tipo` = nome físico da tabela?
4. As linhas **RC** entram no catálogo inicial ou ficam adiadas?
5. As lacunas L-05..L-08 (transições de agenda auditadas, acesso de leitura clínica, negações, sensibilidade do cadastro de paciente) ficam adiadas para a fase de `apps/api`?
6. Confirmada a decisão: `T-AUD-CONTEXTO` é implementado em E-18B contra o catálogo homologado, e a validação fail-closed fica registrada como requisito da futura camada de aplicação?

---

## 12. Registro de decisão — homologação de `P-E14-01` (`D-AUD-01`..`D-AUD-08`, 25/08/2026)

Decisões tomadas por **Bruno Menezes Noronha** em **25/08/2026**, consolidadas nesta seção. Elas respondem às perguntas de §11 e **encerram a pendência normativa `P-E14-01`**. §§1..11 permanecem intactos como proposta histórica; para efeito normativo, vale exclusivamente esta seção.

### 12.1 Conferência mecânica e auditoria de fontes prévias (exigência de `D-AUD-01`)

Antes da consolidação, a enumeração de §5 foi conferida mecanicamente e auditada linha a linha contra as fontes superiores (`docs/02`..`docs/07`):

- **Contagem real de §5**: **24 linhas DD**, **11 linhas RC** (12 ações individualizadas — a linha `agendamento.confirmado`/`agendamento.checkin` propõe dois nomes) e **4 linhas SF** — 39 linhas no total.
- O relatório de execução da E-18A afirmava "DERIVADA DIRETAMENTE (20)" e "RECOMENDAÇÃO (9)" — **erro exclusivo do relatório**: este documento nunca conteve contagens. **Nada foi alterado em §5 por causa do relatório**; nenhuma ação foi acrescentada ou removida.
- **Auditoria de fontes das 24 linhas DD: nenhuma linha é infundada** — todas têm base normativa real que exige o evento. Foram, porém, encontradas divergências **de atribuição de fonte** (não de substância), preservadas em §5 como proposta histórica e corrigidas aqui para efeito normativo:
  1. `usuario.senha.recuperacao_iniciada`/`usuario.senha.recuperacao_concluida`: a obrigação de auditar vem de **AUT-004** (e FC-01); D-04 descreve o fluxo do segredo e não exige auditoria — sustenta o gatilho, não a obrigação;
  2. `usuario.papeis.alterados`: os códigos remetidos a `docs/04` §5 são de **permissões**; papéis (`docs/04` §3) não possuem códigos catalogados — a definição das chaves fica adiada com a whitelist (`D-AUD-07`);
  3. `configuracao.alterada`: somente **CFG-001** traz exigência própria de atribuibilidade; a extensão a CFG-002..CFG-006 apoia-se no termo genérico "configurações estruturais" de AUD-001 — a **abrangência exata**, além da granularidade já sinalizada em §5, é decisão adiada;
  4. `agendamento.remarcado`: sustentam a obrigação **AGD-001 ("alterações relevantes"), AUD-001 e T-01 (`docs/07` §24.2)**; AGD-002 não tem bullet de auditoria e RN-016 trata de revalidação de conflito, não de auditoria;
  5. `atendimento.iniciado`: a obrigação vem exclusivamente de **`docs/07` §24.2 (T-09 inclui `evento_auditoria`)**; AGD-007 não contém exigência de auditoria;
  6. `pagamento.registrado`: a obrigação vem de **AUD-001 + `docs/07` §24.2 (T-03)**; FIN-004 não contém bullet de auditoria;
  7. **F-09**: a inclusão de `evento_auditoria` nas nove transações é sustentada por **`docs/07` §24.2**; `docs/06` §12 só menciona auditoria em T-02, T-05 e T-06 — a citação dupla de F-09 era mais forte do que uma de suas fontes;
  8. o rótulo "**chaves literais da fonte**" nas linhas de desconto e de `data_referencia` é impreciso: **literal nas fontes é o par "valor anterior e novo"** (`docs/07` §19.2 e §20.3); os **nomes** `valor_desconto_anterior`/`valor_desconto_novo` e `data_referencia_anterior`/`data_referencia_nova` são proposta deste documento — e são **fixados agora** por `D-AUD-07`;
  9. **divergência substantiva única**: a chave `autor_original_usuario_id` (linha `retificacao_clinica.efetivada_terceiro`) **não deriva de fonte** — D-01.4 exige identificar o **autor da retificação** (já coberto pela coluna própria `ator_usuario_id` — F-01) e o **registro original** (coberto por `registro_original_id`). Tratamento fail-closed em `D-AUD-07`.

### 12.2 `D-AUD-01` — catálogo inicial de `acao`

Homologado como catálogo inicial **somente** o conjunto classificado em §5 como **DERIVADA DIRETAMENTE — 24 ações**, com os nomes propostos preservados (nenhum erro objetivo de nome foi demonstrado):

`usuario.autenticacao` · `usuario.sessao.logout` · `usuario.sessao.revogacao` · `usuario.senha.recuperacao_iniciada` · `usuario.senha.recuperacao_concluida` · `usuario.situacao.alterada` · `usuario.papeis.alterados` · `configuracao.alterada` · `profissional.situacao.alterada` · `agendamento.criado` · `agendamento.remarcado` · `agendamento.cancelado` · `atendimento.iniciado` · `registro_clinico.finalizado` · `retificacao_clinica.efetivada` · `retificacao_clinica.efetivada_terceiro` · `prontuario.exportado` · `sessao.consumida` · `sessao.ajustada` · `cobranca.desconto_aplicado` · `cobranca.cancelada` · `cobranca.data_referencia_recalculada` · `pagamento.registrado` · `pagamento.estornado`

As sub-decisões sinalizadas em §5 — granularidade **e abrangência** de `configuracao.alterada` (12.1, item 3) e alvo exato de `prontuario.exportado` — permanecem **adiadas** para a frente de `apps/api`, sem efeito sobre a inclusão das ações no catálogo.

### 12.3 `D-AUD-02` — catálogo de `resultado`

Homologado o catálogo de §6: **`SUCESSO`**, **`NEGADO`**, **`FALHA`**. **Nenhum enum SQL é criado; nenhuma migration ou alteração de schema decorre desta decisão** — é catálogo documentado da aplicação, exatamente como `docs/07` §2.2/§22.3 determinam.

### 12.4 `D-AUD-03` — `alvo_tipo`

Homologado: `alvo_tipo` usa o **nome físico da tabela** do alvo como identificador histórico. Registra-se expressamente que: (a) é **metadado histórico** do evento; (b) **não autoriza despacho dinâmico de SQL** a partir do valor; (c) **não concede acesso** ao alvo; (d) **eventual rename físico futuro não reescreve eventos históricos** — eventos antigos preservam o nome vigente à época do registro.

### 12.5 `D-AUD-04` / `D-AUD-05` / `D-AUD-06` — o que fica fora do catálogo inicial

- **`D-AUD-04` — RECOMENDAÇÃO (RC): ADIADAS.** As 12 ações RC de §5 **não** entram no catálogo inicial. Nenhuma recomendação é promovida a requisito sem fonte normativa.
- **`D-AUD-05` — SEM FONTE SUFICIENTE (SF): continuam fora.** Não se inventa `paciente.cadastro.alterado`, `prontuario.acessado`, `autorizacao.negada`, `auditoria.consultada` nem qualquer equivalente sem decisão futura.
- **`D-AUD-06` — L-05..L-08: ADIADAS para a frente de `apps/api`** — transições adicionais de agenda; condição de auditoria de leitura clínica; política de auditoria de negações; definição de alteração sensível do cadastro do paciente. **Não são resolvidas silenciosamente por este registro.**

### 12.6 `D-AUD-07` — whitelist de `contexto` (fail-closed)

Modelo **fail-closed** homologado. Regra base: **whitelist VAZIA** para toda ação do catálogo que não possua chave expressamente derivada das fontes. Whitelist inicial homologada — **exaustiva**:

| Ação | Chaves permitidas em `contexto` | Fundamento |
| --- | --- | --- |
| `cobranca.desconto_aplicado` | `valor_desconto_anterior`, `valor_desconto_novo` | F-06 — `docs/07` §19.2/FIN-003 exigem o par anterior/novo; os nomes são fixados por esta decisão |
| `cobranca.data_referencia_recalculada` | `data_referencia_anterior`, `data_referencia_nova` | F-07 — `docs/07` §20.3 (`PROP-RN-2.2-01` homologada) exige o par anterior/novo; nomes fixados por esta decisão |
| `retificacao_clinica.efetivada_terceiro` | `registro_original_id` | F-08 — D-01.4 exige identificar o registro original. **A chave `autor_original_usuario_id` proposta em §5 NÃO é homologada** (12.1, item 9 — sem fonte: o autor da retificação já é a coluna `ator_usuario_id`); sua eventual inclusão exige decisão expressa futura |
| **todas as demais 21 ações do catálogo** | **(vazia)** | regra base fail-closed |

Permanecem **proibições absolutas** em `contexto` (F-04, §4): nome, CPF, telefone, e-mail, conteúdo clínico, anexos, senha, token, segredo, payload HTTP/DTO indiscriminado, URL privada, qualquer dado pessoal sem necessidade demonstrada. **Sem sanitização silenciosa**: chave fora da whitelist deverá provocar **rejeição explícita** na aplicação — nunca remoção seguida de prosseguimento. As demais "chaves mínimas" propostas em §5 (ex.: `ativo_anterior`/`ativo_novo`, `campos_alterados`, `atendimento_id`, `pacote_id`, `motivo_cancelamento_id`, `pagamento_id`, `formato`, `tipo`, `quantidade`, `agendamento_id`, `papeis_anteriores`/`papeis_novos`) **não são homologadas agora** — permanecem proposta, reavaliável na frente de `apps/api`.

### 12.7 `D-AUD-08` — ownership da validação e reclassificação de `T-AUD-CONTEXTO`

A validação runtime do catálogo e da whitelist pertence ao **backend/aplicação** (`docs/07` §22.3 — F-13). Quando `apps/api` existir: **catálogo tipado centralizado**; **validação fail-closed**; **ação desconhecida rejeitada**; **chave desconhecida rejeitada**; **testes unitários e de integração**; **nenhuma serialização genérica de request/DTO em `contexto`**. **Nada disso é implementado agora**: não se cria `apps/api`, não se cria trigger/CHECK/JSON Schema no PostgreSQL, e a regra **não** é deslocada para `packages/database` pela mera inexistência do backend.

Consequência sobre `T-AUD-CONTEXTO`: a sugestão de §9 — materializar a whitelist como fixture da persistência em E-18B — **NÃO foi acolhida**. O teste é, por natureza, **teste de regra de aplicação/backend**, e fica **RECLASSIFICADO**: *"teste de regra de aplicação/backend — executar quando `apps/api` existir"*. O identificador `T-AUD-CONTEXTO` é **preservado na rastreabilidade** (`docs/08` §14 e §13 `E-14`). O `it.todo` de `packages/database` é removido **somente após** este registro documental, porque a inspeção confirmou que **não existe comportamento de persistência legítimo** que ele pudesse medir — o banco garante apenas a forma (`jsonb ∅`); a política é da aplicação. `T-AUD-CONTEXTO` **não é** marcado como aprovado/passed. Estado correto: **RECLASSIFICADO / PENDENTE DA CAMADA DE APLICAÇÃO**.

### 12.8 Efeitos sobre pendências e riscos

- **`P-E14-01` — ENCERRADA por decisão** (este registro).
- **`R2.2-04`** — a política deixa de estar indefinida, mas o risco **não é encerrado**: a enforcement runtime pertence ao futuro `apps/api`. **Transferido para a frente de backend** (rastreado como `P-BACK-01` em `docs/08` §19), sem bloquear o encerramento específico da camada de persistência.
- Encerramentos formais de `R2.2-03` e `R-BL-05` e manutenção de `R-BL-09` em aceitação temporária monitorada: registrados em `docs/08` (REV. 17).

---

## 13. Registro de decisão — `P-BACK-01-D2`: lacunas de auditoria e sub-decisões de catálogo (`PBACK-AUD-01`..`PBACK-AUD-08`, 05/09/2026)

Decisões tomadas por **Bruno Menezes Noronha** em **05/09/2026**, sobre as pendências que `D-AUD-06` adiou para a frente de `apps/api` (`L-05`..`L-08`) e sobre as sub-decisões de catálogo que `D-AUD-01`/`D-AUD-07` deixaram expressamente em aberto.

**Relação com §12.** Esta seção **não altera, não reabre e não reinterpreta** `D-AUD-01`..`D-AUD-08`. Ela **cumpre** o que `D-AUD-06` remeteu à frente de backend. Onde §13 for silente, §12 continua valendo integralmente. §§1..11 permanecem o que sempre foram: proposta histórica sem valor normativo próprio.

**Colisão de identificadores — advertência de leitura.** Neste documento, `L-05`..`L-08` designam **exclusivamente** as lacunas de auditoria enumeradas em §3. Os identificadores homônimos `L-05`..`L-08` que aparecem em `docs/10` são **decisões locais de autenticação** da Etapa 2.3D-B / F3, sem nenhuma relação com esta seção.

### 13.1 Fatos apurados antes da decisão

Medidos mecanicamente sobre a `main` em `c4c9ba2`, e não presumidos:

| # | Fato |
| --- | --- |
| G-01 | O catálogo tipado (`apps/api/src/audit/audit.catalog.ts`) contém exatamente as **24 ações** de `D-AUD-01`, na ordem da fonte; a whitelist declara as 24, com **3 positivas** e **21 vazias** |
| G-02 | **7 das 24 ações possuem emissor real** em `apps/api/src/`: `usuario.autenticacao` (`SUCESSO` e `FALHA`), `usuario.sessao.logout`, `usuario.senha.recuperacao_iniciada`, `usuario.senha.recuperacao_concluida`, `usuario.papeis.alterados`, `profissional.situacao.alterada`, `cobranca.desconto_aplicado`. As **17 restantes não têm emissor** — os módulos de domínio correspondentes (agenda, prontuário, paciente, pacote, configuração) **não existem** em `apps/api/src/` |
| G-03 | **ERRATA (revisão corretiva de 05/09/2026) — o fato originalmente registrado aqui estava ERRADO.** A redação original afirmava que *nenhuma rota de produção declara `@RequerPermissao`* e que o RBAC estava provado apenas sobre controller de teste. **Fato verificado no código:** `POST /auth/recuperacao-senha` declara **`@RequerPermissao("senha.recuperar_terceiro")`** (`apps/api/src/recuperacao-senha/recuperacao-senha.controller.ts:100`); o `RecuperacaoSenhaModule` está registrado no `AppModule` (`apps/api/src/app.module.ts:35`); a cadeia de guards é `ProtecaoCsrfGuard` (controller) → `SessaoAutenticadaGuard` → `PermissoesGuard` (instaladas por `@RequerPermissao`, `apps/api/src/authz/requer-permissao.decorator.ts:79`); e a negação real é provada por integração em `apps/api/test/integration/recuperacao-senha.integration.spec.ts:460` (`403 ACESSO_NEGADO` para usuário autenticado sem a permissão, inclusive com `usuarios.gerenciar`/`permissoes.gerenciar`) e `:442`/`:451` (`401` sem sessão / sessão revogada), com prova de que **nenhum evento de auditoria é emitido na negação**. A rota está **implementada e integrada na `main`** desde o merge da F6 (`cbd02eb`, PR #20); *implantação em produção* é fato distinto, não presumido aqui. As demais rotas publicadas (`/health`, `/auth/login`, `/auth/logout`, `/auth/recuperacao-senha/concluir`) não exigem permissão. Origem do erro: a apuração da execução de análise grepou decorators de rota sem grepar `RequerPermissao`, e não confrontou `docs/10` §6-P, que já documentava a rota protegida. **Consequência normativa em §13.4 (nota de revisão).** |
| G-04 | `historico_agendamento` existe fisicamente e já carrega, **tipado**: `operacao`, `estado_anterior`, `estado_novo`, `inicio_anterior`/`inicio_novo`, `fim_anterior`/`fim_novo`, `ator_usuario_id` (`NOT NULL`, FK), `ocorrido_em` e `motivo_cancelamento_id`, com índice `(agendamento_id, ocorrido_em)` — IDX-A6 |
| G-05 | `registro_clinico.autor_usuario_id` existe (uuid, FK `Restrict/Restrict`), e a migration `20260822151743_append_only` instala `trg_registro_clinico_imutavel_finalizado` (`BEFORE UPDATE OR DELETE`), que impede alteração após a finalização. Como a retificação só existe sobre registro `FINALIZADO` (PRN-005), o autor original é **derivável e imutável** a partir de `registro_original_id` |
| G-06 | Somente **CFG-001** possui bullet próprio de auditoria ("alterações relevantes devem ser atribuíveis"). CFG-002..CFG-006 **não têm** bullet de auditoria — a extensão a elas apoia-se no termo genérico "configurações estruturais" de AUD-001, exatamente como §12.1 item 3 registrou |
| G-07 | As configurações estruturais mapeiam para **5 tabelas** existentes: `clinica` (CFG-001 e CFG-006 — `fuso_horario` é coluna de `clinica`), `horario_funcionamento` (CFG-002), `servico` (CFG-003), `forma_pagamento` (CFG-004) e `motivo_cancelamento` (CFG-005) |
| G-08 | A permissão **`auditoria.ler`** já existe em `docs/04` §5.8 ("Consultar trilha de auditoria conforme escopo administrativo") e no catálogo tipado de permissões — **nenhuma permissão nova é necessária** para a consulta de auditoria |
| G-09 | `evento_auditoria.alvo_id` é **um único** `uuid ∅` — não representa conjunto |
| G-10 | Nenhuma seção "Auditoria" de qualquer fluxo de `docs/05` (FC-01, FC-02, FC-05, FC-06) lista **leitura** ou **acesso**. A única leitura clínica que uma fonte manda auditar expressamente é a **exportação** (PRN-007, RN-029) |

### 13.2 `PBACK-AUD-01` — `L-05`: transições de agenda — **FECHADA**

**Decidido.** O "nível de auditoria/histórico definido" a que RN-017 delega é, para as transições de agenda **não** listadas em `D-AUD-01`, o **`historico_agendamento`**. O catálogo de auditoria permanece com as quatro ações de agenda já homologadas: `agendamento.criado`, `agendamento.remarcado`, `agendamento.cancelado` e `atendimento.iniciado`.

**Permanecem FORA do catálogo**, confirmando `D-AUD-04` (e **não** o reabrindo): `agendamento.confirmado`, `agendamento.checkin`, `agendamento.falta_registrada`, `agendamento.concluido` e `bloqueio_agenda.criado`.

**Fundamento.** RN-017 exige que as transições sejam **atribuíveis**, e delega expressamente *qual mecanismo* cumpre essa exigência. `historico_agendamento` a cumpre integralmente (G-04): `ator_usuario_id` é `NOT NULL` com FK para `usuario`, e `ocorrido_em` é obrigatório. `docs/07` §22.4 já desenhou a divisão: histórico **funcional**, com colunas tipadas de antes/depois (AGD-009), versus trilha **de segurança** homogênea e restrita a metadados — "redundância deliberada, não dupla fonte de verdade". Correlação entre as duas tabelas pelo `correlacao_id` compartilhado.

**Limitação declarada.** A investigação de segurança sobre agenda consulta **duas** tabelas. É consequência aceita do desenho de §22.4, não defeito.

**Nenhuma alteração de catálogo, whitelist, schema ou código decorre desta decisão.**

### 13.3 `PBACK-AUD-02` — `L-06`: acesso a dados clínicos — **ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA**

**`L-06` NÃO está fechada, e NÃO é encerrada por escopo.**

**Decidido.** A lacuna permanece **ABERTA**, formalmente **BLOQUEADA** por dependência funcional-técnica, com retomada **obrigatória** — não facultativa — antes da disponibilização de qualquer superfície real de leitura de prontuário ou de dados clínicos sensíveis.

**Fundamento do não-fechamento.** `TLF-BASE-V1` §10 determina: *"Implementar trilha de auditoria para **acesso** e mudança de dados sensíveis."* É requisito permanente da base imutável e alcança **acesso**, não apenas mutação. Por isso **não é permitido** concluir normativamente que a leitura clínica ordinária ficará sem auditoria no MVP, e **não se registra** que AUD-002 esteja "satisfeita" pelas ações de exportação, finalização e retificação. Essas ações cobrem **mutação e saída** de conteúdo clínico; **não** cobrem acesso de leitura, que é precisamente o objeto de AUD-002 e de `L-06`.

**Fundamento do bloqueio.** Ao mesmo tempo, não existe hoje base suficiente para definir corretamente *quando* e *como* emitir uma futura ação de acesso clínico:

1. o **módulo de prontuário não existe** em `apps/api/src/` (G-02) — não há superfície de leitura sobre a qual a regra incidiria;
2. **`P2.2-05`** — que definirá tecnicamente a relação fisioterapeuta↔paciente e o escopo de acesso (`docs/04` §2.5, §7.1) — **não foi materializada**; sem ela não existe predicado capaz de distinguir acesso dentro do escopo de acesso excepcional;
3. **não há superfície real** sobre a qual medir volume, padrão de acesso e comportamento — e `docs/04` §10 adverte expressamente contra volume e ruído excessivos.

Decidir a regra agora produziria norma vácua (auditar toda leitura, sem medição) ou inaplicável (referenciando um escopo que não existe).

**Consequências operacionais desta decisão.**

- **Não** se cria `prontuario.acessado` nesta fatia.
- **Nenhuma** alteração de catálogo ou whitelist decorre desta decisão.
- `prontuario.exportado` **permanece** como obrigação concreta já homologada por `D-AUD-01` — e **não** é apresentada como cumprimento de AUD-002.
- A retomada de `L-06` fica **vinculada explicitamente** a: (i) a materialização de **`P2.2-05`**; e (ii) a implementação das **rotas de leitura clínica**. Ocorrido o que vier primeiro, `L-06` deve ser reaberta e decidida **antes** de a superfície ser disponibilizada a usuários.
- Enquanto `L-06` permanecer aberta, **`R2.2-04` não pode ser declarado encerrado** por esta via, e nenhuma rota de leitura clínica deve ser publicada sem que esta lacuna seja decidida.

**Estado registrado:** `ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA`.

### 13.4 `PBACK-AUD-03` — `L-07`: negações de autorização — **FECHADA PARA O ESTADO ATUAL**

**Decidido.** Não se cria `autorizacao.negada` no momento. `D-AUD-05` é confirmada nesse ponto.

**Fundamento.** `docs/04` §10 condiciona a auditoria de rejeições a **utilidade operacional**, advertindo contra volume e ruído. A condição não está satisfeita: **não existe endpoint de produção protegido por `@RequerPermissao`** (G-03); portanto não existe superfície operacional real que a emissão pudesse cobrir. Registram-se ainda dois fatos técnicos apurados, relevantes para a reavaliação futura: (a) o guard executa **antes** do handler e **fora** de qualquer transação de negócio, enquanto o `AuditWriter` recusa cliente não transacional por desenho — auditar ali exigiria um padrão transacional novo, não coberto por decisão homologada; (b) a chave candidata `permissao_requerida` viria da metadata do servidor, nunca da requisição, e portanto **não** seria dado controlado pelo atacante.

**Reavaliação obrigatória.** Esta decisão deve ser **obrigatoriamente reavaliada quando o primeiro endpoint RBAC real de produção for publicado**. Não é fechamento definitivo: é fechamento para o estado atual, e o gatilho de reabertura é objetivo e verificável.

**Preservado sem alteração.** O `PermissoesGuard` **não** passa a emitir auditoria. Permanecem intactos: o corpo único de negação (anti-enumeração), o contrato `401` × `403`, e o invariante de que **falha técnica nunca é convertida em negação**.

**Nota.** O valor `NEGADO` de `D-AUD-02` permanece homologado e sem emissor. Isso é consequência conhecida desta decisão, não inconsistência.

> #### Nota de revisão — 05/09/2026 (revisão corretiva de `P-BACK-01-D2`) — FUNDAMENTO CONTESTADO POR EVIDÊNCIA; REAVALIAÇÃO PENDENTE DE BRUNO MENEZES NORONHA
>
> **Pacote decisório completo (PROPOSTA — PENDENTE DE DECISÃO DE BRUNO):** `docs/13-pacote-decisao-l-07-negacoes-autorizacao.md`, preparado em 05/09/2026. Onde esta nota e `docs/13` divergirem em fato, **`docs/13` prevalece** por ser apuração posterior e mais completa; nenhum dos dois tem valor normativo. Errata desta nota: onde abaixo se lê que a tentativa negada "fica visível apenas em log técnico", **o fato verificado é que ela não deixa rastro algum** — nem auditoria nem log (`docs/13` F-07/F-08); e a leitura do gatilho "produção" adotada abaixo é **uma** de três leituras possíveis, submetida a Bruno em `docs/13` §4 (D-0), não declarada satisfeita.
>
> **O texto da decisão acima é preservado exatamente como homologado e NÃO foi alterado.** Esta nota registra, de forma separada, que a **premissa factual** em que o fundamento se apoiou — G-03, "não existe endpoint de produção protegido por `@RequerPermissao`" — **está errada** (ver a errata em G-03, §13.1). Existe hoje uma rota integrada na `main` sob RBAC real: `POST /auth/recuperacao-senha`, com `@RequerPermissao("senha.recuperar_terceiro")`, cadeia de guards efetiva e negação provada por teste de integração.
>
> **Efeito sobre o gatilho de reavaliação.** A própria decisão fixou como gatilho objetivo *"quando o primeiro endpoint RBAC real de produção for publicado"*. Sendo esse endpoint já existente e integrado desde a F6 — antes mesmo desta decisão —, **a condição de reavaliação está materialmente satisfeita no momento em que a decisão foi tomada**, e a decisão foi tomada sob premissa incorreta. Registra-se, portanto, que **`L-07` volta a exigir reavaliação expressa**. A ressalva sobre *implantação em produção* (deploy) é de fato distinta e não altera este efeito: o gatilho, tal como redigido, é a existência de superfície RBAC real no código integrado, e ela existe.
>
> **O que esta nota NÃO faz.** Não cria `autorizacao.negada`; não altera catálogo, whitelist, `PermissoesGuard`, runtime, testes ou contratos; não adota, em nome de Bruno, nenhuma das alternativas abaixo; não reabre `D-AUD-05`. O estado operacional permanece o vigente (nenhuma auditoria de negação é emitida). Os dois fatos técnicos (a) e (b) do fundamento original permanecem verdadeiros e relevantes.
>
> **Análise para decisão** — utilidade operacional, limites e impactos da auditoria de negação sobre a rota existente:
>
> 1. *Natureza da rota.* É operação administrativa **sobre terceiro** (`D-2.3D-16`, `docs/12` §5.16), guardada por permissão de alto privilégio. Uma tentativa negada de iniciar recuperação de senha de outro usuário é, entre todas as negações imagináveis no MVP, uma das de **maior valor forense**: aponta para escalonamento de privilégio ou uso indevido de sessão. A utilidade operacional exigida por `docs/04` §10 é, aqui, **plausível** — o que antes se afirmava inexistente.
> 2. *Limites.* Só chega ao `PermissoesGuard` quem **já possui sessão válida** (`SessaoAutenticadaGuard` roda antes) e passou pelo CSRF; o `401` sem sessão **não** é negação de autorização e não deve ser confundido com ela. A negação `403` é tomada **antes** do handler e **fora** de qualquer transação de negócio, e o `AuditWriter` recusa cliente não transacional por desenho — emitir auditoria ali exigiria uma **fronteira transacional própria para a auditoria de negação**, padrão novo e não coberto por decisão homologada.
> 3. *Catálogo, ator e alvo.* Exigiria criar `autorizacao.negada` (hoje fora por `D-AUD-05`), com `resultado = NEGADO` (dando uso ao valor homologado e ainda sem emissor). **Ator:** o usuário da sessão (existe). **Alvo:** a operação negada ocorre *antes* de o corpo ser lido/validado, logo o alvo pretendido (o usuário-alvo da recuperação) **não está resolvido** no ponto da negação; `alvo_tipo`/`alvo_id` só poderiam designar o recurso-rota de forma abstrata, o que tensiona `D-AUD-03` (nome físico de tabela). Esta é uma **dificuldade de modelagem real**, não detalhe.
> 4. *Minimização.* A única chave útil, `permissao_requerida`, vem da metadata do servidor — **não** é dado controlado pelo atacante; deve ser restrita ao catálogo fechado de `docs/04` §5. Nenhum identificador tentado, corpo ou cabeçalho pode entrar em `contexto` (`D-AUD-07`, F-04).
> 5. *Volume e abuso.* Baixo em regime normal (a negação exige sessão válida e permissão ausente). Vetor residual: um usuário **autenticado** em laço sobre a rota negada escreveria auditoria sem limite específico — o limitador de recuperação (`D-2.3D-06`) atua sobre outra dimensão e não cobre este caso por desenho. Precisaria de limitação própria ou aceitação expressa do risco.
> 6. *Negação × falha técnica.* Invariante preservado em qualquer alternativa: indisponibilidade de banco na resolução de permissões sobe como `500` e **não** é negação; **não** deve gerar `autorizacao.negada`. Só o `403` deliberado da guard seria elegível.
>
> **Alternativa A — conservadora (sem implementação).** Manter o estado operacional atual: nenhuma auditoria de negação; **corrigir apenas o fundamento** da decisão, substituindo a premissa falsa por um fundamento verdadeiro — a saber, que a auditoria de negação exige padrão transacional novo, modelagem de alvo ainda não resolvida e limitação de volume própria, custos que não se justificam enquanto houver **uma única** rota RBAC. Novo gatilho de reavaliação proposto: **quando a primeira rota RBAC de domínio clínico ou financeiro for publicada**, ou quando o visualizador de auditoria (§13.9) existir — momento em que uma trilha de negação teria consumidor. *Custo:* zero código. *Risco:* a tentativa de escalonamento na rota existente ~~fica visível apenas em log técnico, não na trilha~~ — **errata (`docs/13` F-08): não deixa rastro algum, nem em log técnico nem na trilha**.
>
> **Alternativa B — implementação futura, restrita.** Homologar `autorizacao.negada` como ação nova, emitida **exclusivamente** pelo `403` deliberado do `PermissoesGuard` em rotas de um subconjunto fechado de permissões críticas (`senha.recuperar_terceiro`, `sessoes.revogar_terceiro`, `usuarios.gerenciar`, `permissoes.gerenciar`, `prontuario.retificar_terceiro`, `auditoria.ler`), com `resultado = NEGADO`, whitelist `["permissao_requerida"]`, e **decisão expressa** sobre `alvo_tipo`/`alvo_id` (ver item 3). *Custo:* nova fronteira transacional no guard, nova ação e nova chave (ampliação de `D-AUD-01`/`D-AUD-07` por decisão), limitação de volume, testes unitários + integração + mutation challenge. *Risco:* complexidade no guard, hoje deliberadamente simples; risco de DoS por escrita autenticada se a limitação não for adequada.
>
> **Recomendação técnica fundamentada.** **Alternativa A**, com o fundamento corrigido e o novo gatilho. Razões: (i) a rota existente é uma só, e seu risco já é contido por sessão + CSRF + permissão restrita a Administrador; (ii) os três problemas técnicos (transação, alvo, volume) são reais e ainda não têm solução homologada; (iii) uma trilha de negação sem consumidor (o visualizador não existe) tem valor forense apenas potencial. A alternativa B é legítima e deve ser reavaliada com fundamento próprio no novo gatilho. **Isto é recomendação; a decisão é de Bruno.**
>
> **Pergunta objetiva para Bruno Menezes Noronha:** *Diante da evidência de que já existe rota RBAC real integrada, como fica `L-07`?* **(A)** Manter `PBACK-AUD-03` sem auditoria de negação, substituindo o fundamento pela justificativa técnica acima e adotando o novo gatilho de reavaliação; **(B)** autorizar a preparação de uma fatia decisória própria para `autorizacao.negada` restrita a permissões críticas, nos termos da Alternativa B; ou **(C)** outra orientação. **Até a resposta, `PBACK-AUD-03` permanece como homologada, com fundamento contestado, e nada é implementado.**

#### 13.4.1 `PBACK-AUD-09` — reavaliação de `L-07` sobre o pacote `docs/13` — **DECIDIDA em 05/09/2026: AUDITORIA RESTRITA DE NEGAÇÕES**

**Natureza deste registro.** A pergunta da nota de revisão acima foi respondida por **Bruno Menezes Noronha em 05/09/2026** sobre o pacote decisório dedicado `docs/13-pacote-decisao-l-07-negacoes-autorizacao.md` (perguntas `D-0`..`D-6` de `docs/13` §12). O texto de `PBACK-AUD-03` (§13.4) e a nota de revisão são **preservados como estavam**; esta subseção é o registro normativo **posterior** que os supera no ponto em que decidem diferente. A errata de §13.1 G-03 e a errata da nota de revisão (a tentativa negada **não deixava rastro algum**, nem em log técnico) permanecem válidas e são o fato que motivou a reavaliação.

**Decisões homologadas** (formato de resposta de `docs/13` §12):

| Pergunta | Decisão | Efeito normativo |
| --- | --- | --- |
| **D-0** — leitura do gatilho de `PBACK-AUD-03` | **(a)** — "endpoint RBAC real" = código integrado na `main` com rota funcional | O gatilho de reavaliação de `PBACK-AUD-03` está **satisfeito** por `POST /auth/recuperacao-senha` (F6). **Esta leitura vale para `L-07` e não é definição universal de "produção"** para outras decisões: cada gatilho futuro que use a palavra será lido por decisão própria |
| **D-1** — política | **R — auditoria RESTRITA** | **`autorizacao.negada` entra em `D-AUD-01` como 25ª ação** (única acrescentada após 25/08/2026), com **whitelist VAZIA** em `D-AUD-07`. **Primeira e única exceção a `D-AUD-05`**, limitada por decisão à negação deliberada de autorização da permissão **`senha.recuperar_terceiro`**. **Não** se generaliza a todo `403`, toda guard ou toda permissão; a lista de permissões auditáveis é **fechada** e contém **um** item; ampliá-la é nova decisão normativa, nunca ajuste técnico |
| **D-2** — falha na gravação | **Q2 — best-effort com log** | A resposta funcional permanece **`403 ACESSO_NEGADO`**; falha ao persistir o evento **não** vira `500`, **não** é engolida e **não** é repetida: produz **log técnico estruturado seguro** (classe do erro e `correlacao_id`; nunca `message`/`stack`, senha, token, cookie, corpo, e-mail, IP ou dado clínico), no mesmo padrão do `FiltroErroAutenticacao`. **Limitação declarada:** a trilha pode ter lacuna **em falha de infraestrutura**, visível em log — atomicidade "evento acompanha operação" foi desenhada para mutações; uma negação não tem mutação a acompanhar |
| **D-3** — contenção de volume | **V0 — nenhuma limitação adicional** | Um evento por tentativa efetivamente negada; **sem `DimensaoLimite`**, sem agregação, sem amostragem. Fundamento: não existe medição que sustente um `N`; não se cria regra arbitrária. **Risco aceito e registrado** (`docs/10` §9): insider autenticado em laço escreve auditoria sem limite específico; a resposta administrativa (revogar a sessão de terceiro — `AUT-002`/`sessoes.revogar_terceiro`) **não está implementada** |
| **D-4** — alvo do evento | **R** | `acao = autorizacao.negada`; `resultado = NEGADO` (`D-AUD-02` — primeiro emissor do valor); **ator** = usuário autenticado da **sessão persistida**; **`alvo_tipo = "permissao"`** (nome físico da tabela — `D-AUD-03`); **`alvo_id = permissao.id`** da permissão exigida pelo handler, resolvido pelo backend; **contexto vazio** — `permissao_requerida` (R′) e `motivo` (R″) **recusadas**; `justificativa = NULL`; `correlacao_id` **novo por negação**. **Proibido** como alvo: usuário/e-mail do corpo, identificador não resolvido, sentinela, UUID fictício, valor controlado pelo cliente. **O corpo não é lido nem validado para produzir o evento** |
| **D-5** — implementação | **AUTORIZADA** | Fatia de implementação, testes e documentação em branch própria (`agent/p-back-01-d2-auditoria-decisoes`); registro em `docs/10` §7.4 |
| **D-6** — publicação | **NÃO AUTORIZADA** | Sem commit, push, PR, merge, rebase, deploy ou publicação nesta fatia. Será pedida, se cabível, com a evidência de testes |

> **Nota factual posterior à decisão (05/09/2026).** `D-5` e `D-6` registram o estado **no ato da decisão** e **não são alteradas**. A publicação ocorreu **depois**, por ato de Bruno Menezes Noronha: a fatia foi integrada na `main` pela PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23) (commit `62862bf`, merge commit `e1459f6`, 05/09/2026). Registro pós-medição em `docs/10` §7.4.8.

**Regras de emissão homologadas** (observadas pelo emissor `AuditoriaNegacaoAutorizacao`, `apps/api/src/authz/`):

1. emite **somente** a negação **deliberada** decidida pelo `PermissoesGuard` quando a resolução de permissões teve **sucesso técnico** e resultou em **permissão ausente** ou **usuário inativo** (usuário existe — `ator_usuario_id` respeita a FK);
2. **não** emite: `401` de qualquer origem; `403 REQUISICAO_NAO_AUTORIZADA` (CSRF); `422 ALVO_NAO_ELEGIVEL` (recusa de negócio uniforme — `D-2.3D-16`); `500` técnico (falha na resolução sobe **antes** de qualquer emissão); casos de fiação (metadata/contexto ausentes); usuário inexistente; negações em rotas/permissões **fora da lista fechada**;
3. a emissão ocorre no ponto da **decisão de autorização** (guard), **depois** de decidir negar e **antes** de lançar — nunca no handler, nunca no filtro global de erros;
4. **fronteira transacional T1** (`docs/13` §6.1): transação **dedicada** e curta pela fronteira única (`DatabaseService.transacao`), reutilizando o `AuditWriter` **sem relaxar** o invariante de cliente transacional; leitura de `permissao.id` e escrita do evento na **mesma** transação;
5. permissão exigida **sem linha em `permissao`** (estado de provisionamento inconsistente — seed da F5 não aplicado) é falha técnica tratada por **Q2** (log, sem evento) — **nunca** alvo `NULL`, sentinela ou UUID fictício.

**Impactos.** Catálogo tipado: **25** ações (24 de `D-AUD-01` + 1); whitelist: **3** positivas · **22** vazias. `resultado`, `alvo_tipo`, política fail-closed: **inalterados**. **Nenhuma** migration, alteração de schema, enum SQL, dependência nova ou alteração de contrato HTTP/OpenAPI: o `403` e seu corpo são **byte a byte** os mesmos; a auditoria é efeito interno. `PermissoesGuard` ganha **uma** dependência (o emissor) e **nenhuma** política de auditoria própria.

**O que esta decisão NÃO faz.** Não reabre `D-AUD-04`, `D-AUD-05` (fora desta exceção única), `D-AUD-07` ou `D-AUD-08`; não cria `prontuario.acessado`, `auditoria.consultada` nem qualquer outra ação; não altera `PBACK-AUD-01`..`PBACK-AUD-08`; não encerra `L-06`, `R2.2-04`, `P-BACK-01` nem `AUT-005`; não autoriza auditar o `422` (conflito com `D-2.3D-16` registrado em `docs/13` §14, sem decisão); não fixa medições de volume/latência (`docs/13` H-02/H-03 permanecem não medidas).

### 13.5 `PBACK-AUD-04` — `L-08`: alteração sensível do cadastro de paciente — **POLÍTICA NORMATIVA FECHADA / MATERIALIZAÇÃO TÉCNICA PENDENTE**

**Decidido — a política de sensibilidade que PAC-001 remete a "conforme política".** Para efeito do **gatilho de auditoria** de que trata `L-08`, são **alterações sensíveis** do cadastro do paciente:

1. **CPF**;
2. **responsável legal**;
3. **consentimentos e bases de tratamento aplicáveis**;
4. **situação ativo/inativo**.

E **não** são classificadas como sensíveis para esse gatilho específico: **nome**, **data de nascimento**, **telefone**, **e-mail**, **contato de emergência** e **observação administrativa**.

**Advertência normativa de alcance — vinculante.** Esta classificação vale **exclusivamente** para o gatilho de auditoria tratado por `L-08`. Ela **não** significa que os demais dados deixem de ser **dados pessoais**, nem que deixem de exigir proteção, controle de acesso, minimização e as demais garantias de `TLF-BASE-V1` §10, RN-062/063 e `docs/04` §10. Nenhuma leitura em contrário é autorizada por este registro.

**Materialização adiada, por decisão.** **Não** se criam nesta fatia: a ação `paciente.cadastro.alterado`, a ação `paciente.situacao.alterada` (que permanece RC, fora por `D-AUD-04`), nem a chave `campos_alterados`. A forma técnica do evento — nome da ação, `alvo_tipo` e chaves de `contexto` — será decidida **junto da fatia do módulo de pacientes**, quando existir emissor real.

**Fato técnico registrado para essa decisão futura.** A chave candidata `campos_alterados` (nomes de campos, sem valores) **colide** com a política runtime vigente de `contexto`, que aceita **apenas escalares JSON** e rejeita arrays. Essa política é decisão técnica local e reversível (`docs/10` §7.3), **não** integra `D-AUD-07`, e sua eventual revisão exige decisão expressa — não contorno. O registro deste conflito é deliberado, para que a fatia futura não o descubra tarde.

**Nenhuma alteração de catálogo, whitelist, schema ou código decorre desta decisão.**

### 13.6 `PBACK-AUD-05` — `configuracao.alterada`: granularidade, abrangência e whitelist — **FECHADA**

**Decidido.**

- **Granularidade: ação única.** Permanece a ação única `configuracao.alterada`, já homologada por `D-AUD-01`. **Não** se criam ações por entidade.
- **Entidade concreta identificada por `alvo_tipo`**, conforme `D-AUD-03` (nome físico da tabela), com `alvo_id` apontando a instância. As entidades abrangidas são as cinco de G-07: `clinica`, `horario_funcionamento`, `servico`, `forma_pagamento` e `motivo_cancelamento`.
- **Abrangência: CFG-001..CFG-006.** Fundamento: CFG-001 por exigência própria de atribuibilidade; CFG-002..CFG-006 pelo termo "configurações estruturais" de AUD-001 (G-06). Isso resolve a abrangência que §12.1 item 3 deixou adiada.
- **Whitelist: permanece VAZIA.** **Não** se cria `campos_alterados`.

**Fundamento da granularidade.** A distinção por entidade **já é obtida sem criar ação alguma**: o par `(acao="configuracao.alterada", alvo_tipo=<tabela>, alvo_id=<uuid>)` identifica entidade e instância. Criar ações separadas ampliaria o catálogo para obter o que `D-AUD-03` já entrega.

**Limitação conhecida — registrada expressamente.** A trilha registra **quem** alterou, **quando** e **qual entidade/instância** foi alterada, mas **não preserva necessariamente o estado anterior** de cada configuração: diferentemente da agenda, as tabelas de configuração **não possuem histórico funcional**, e o valor anterior se perde no `UPDATE`. Esta limitação é **declarada e aceita** neste registro, e **poderá ser reavaliada** quando existir emissor real e necessidade operacional comprovada — sem reabrir `D-AUD-07` e sem que a reavaliação seja presumida como já autorizada.

**Nenhuma alteração de catálogo, whitelist, schema ou código decorre desta decisão.**

### 13.7 `PBACK-AUD-06` — `prontuario.exportado`: alvo definitivo — **FECHADO COMO `paciente`**

**Decidido.** Para **toda** exportação clínica, uniformemente:

- `alvo_tipo = "paciente"`;
- `alvo_id = paciente.id`.

**Não** se usa alvo variável conforme a quantidade de registros exportados. **Nenhuma** chave de `contexto` é acrescentada — a whitelist da ação permanece **vazia** (em particular, `formato` **não** é homologada).

**Fundamento.** `evento_auditoria.alvo_id` é **um único** uuid (G-09). Uma exportação pode representar um registro, um conjunto cronológico ou um relatório do paciente; `paciente` é o único alvo que representa fielmente as três formas, sempre existe, e mantém a homogeneidade que `docs/07` §22.4 atribui à trilha de segurança. Alvo variável para uma mesma ação comprometeria a consulta investigativa. Isso resolve a sub-decisão que `D-AUD-01` deixou adiada.

**Limitação declarada.** O evento não identifica *quais* registros clínicos específicos foram exportados. Consequência aceita da cardinalidade de `alvo_id`; representá-los exigiria estrutura composta em `contexto`, vedada pela política vigente de escalares e não homologada.

**Registro de segurança.** `alvo_tipo = "paciente"` **não** amplia exposição: `D-AUD-03`(c) é expressa em que `alvo_tipo` **não concede acesso** ao alvo, e `alvo_id` é um uuid, não dado pessoal.

**Nenhuma alteração de catálogo, whitelist, schema ou código decorre desta decisão.**

### 13.8 `PBACK-AUD-07` — `autor_original_usuario_id` — **REJEIÇÃO CONFIRMADA**

**Decidido.** A rejeição vigente estabelecida por `D-AUD-07` (§12.6) é **confirmada**. A chave `autor_original_usuario_id` **não** é acrescentada à whitelist de `retificacao_clinica.efetivada_terceiro`, que permanece com a chave única `registro_original_id`.

**Fundamento — verificado mecanicamente (G-05).** A informação é **derivável de forma confiável** por `registro_original_id → registro_clinico.autor_usuario_id`, e o valor é **imutável**: a retificação só existe sobre registro `FINALIZADO` (PRN-005), e `trg_registro_clinico_imutavel_finalizado` bloqueia `UPDATE`/`DELETE` após a finalização; `docs/07` §23 garante que nada é apagado. A obrigação de D-01.4 permanece integralmente atendida: o **autor da retificação** é a coluna própria `ator_usuario_id` (F-01), o **registro original** é `registro_original_id`, a **justificativa** usa a coluna própria e a **data/hora** é `ocorrido_em`.

**Efeito.** Esta decisão **preserva a minimização** (`docs/09` §4.2) e **preserva o comportamento existente** — o validator já rejeita a chave, e a rejeição é provada por teste. **Nenhuma alteração de código decorre desta decisão.**

### 13.9 `PBACK-AUD-08` — consulta da trilha de auditoria (AUD-004) — **POLÍTICA FECHADA / IMPLEMENTAÇÃO PENDENTE**

**Decidido — política da futura consulta.** A implementação do visualizador é **unidade de trabalho própria** e **não** pertence a esta fatia. A política abaixo é fixada agora para que a implementação futura não a reinterprete.

- **Permissão:** exclusivamente **`auditoria.ler`**, já homologada em `docs/04` §5.8 (G-08). **Nenhuma permissão nova é criada.** Nenhum papel é alterado.
- **Usuário autorizado:** Administrador com `auditoria.ler` (AUD-004 — "Administrador autorizado").
- **Operação:** **somente leitura**. Nenhum caminho de atualização ou exclusão de eventos (AUD-005).
- **Filtros permitidos — conjunto fechado, exclusivamente sobre colunas próprias de `evento_auditoria`:** período (`ocorrido_em`), `ator_usuario_id`, `acao` (restrito ao catálogo fechado de 24), `alvo_tipo`, `alvo_id`, `correlacao_id` e `resultado`.
- **Paginação obrigatória**, com limite máximo imposto pelo servidor.
- **Expressamente vedado:** busca textual livre; filtro por conteúdo de `contexto`; filtro por `justificativa`; **resolver ou expandir** o par `alvo_tipo` + `alvo_id`; qualquer join destinado a retornar dados pessoais ou clínicos do recurso apontado.
- **`auditoria.consultada` NÃO é criada** — permanece fora por `D-AUD-05`; AUD-004 não exige auditar a consulta.

**Fundamento da vedação de expansão.** `D-AUD-03`(b) e (c): `alvo_tipo` **não autoriza despacho dinâmico de SQL** e **não concede acesso** ao alvo. A vedação impede que o visualizador se torne canal indireto de acesso a dado clínico ou pessoal, e preserva a segregação administrativo × clínico de `docs/04` §2.6.

**Risco residual declarado.** Mesmo restrita a metadados, a trilha permite correlação — por exemplo, inferir que determinado paciente teve prontuário exportado em determinada data. É risco inerente a qualquer trilha de auditoria, mitigado por `auditoria.ler` ser permissão restrita e pela ausência de busca livre. **Declarado e aceito, não eliminado.**

**Fato a verificar na implementação (não é decisão).** `evento_auditoria` não possui, no schema vigente, índice declarado para os filtros de período/ator/alvo. A necessidade de índice deve ser **medida** na fatia do visualizador, não antecipada aqui — e nenhuma migration decorre deste registro.

### 13.10 Estado das lacunas após esta decisão

| Item | Estado |
| --- | --- |
| `L-05` — transições de agenda | **FECHADA** (§13.2) |
| `L-06` — acesso a dados clínicos | **ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA** (§13.3) — vinculada a `P2.2-05` + superfície real de leitura clínica |
| `L-07` — negações de autorização | **REAVALIADA E DECIDIDA em 05/09/2026** (§13.4.1, `PBACK-AUD-09`): **auditoria RESTRITA** — `autorizacao.negada` homologada (25ª ação, whitelist vazia), emissão limitada à negação deliberada de `senha.recuperar_terceiro`, Q2, V0, alvo = `permissao`. Implementação autorizada (D-5) e materializada (`docs/10` §7.4); publicação **não autorizada no ato da decisão** (D-6) e ocorrida **posteriormente**, em 05/09/2026, por ato de Bruno — fatia **integrada na `main`** pela PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23) (merge `e1459f6`; `docs/10` §7.4.8). Histórico de §13.4 e da nota de revisão preservado |
| `L-08` — alteração sensível do paciente | **POLÍTICA NORMATIVA FECHADA / MATERIALIZAÇÃO TÉCNICA PENDENTE** (§13.5) |
| `configuracao.alterada` — granularidade | **FECHADA** — ação única (§13.6) |
| `configuracao.alterada` — abrangência | **FECHADA** — CFG-001..CFG-006 (§13.6) |
| `configuracao.alterada` — whitelist | **FECHADA COMO VAZIA NO ESTADO ATUAL** (§13.6) |
| `prontuario.exportado` — alvo | **FECHADO COMO `paciente`** (§13.7) |
| `autor_original_usuario_id` | **REJEIÇÃO CONFIRMADA** (§13.8) |
| Política de consulta de auditoria | **FECHADA; IMPLEMENTAÇÃO PENDENTE** (§13.9) |

### 13.11 Pendências e dependências que permanecem abertas

- **`L-06`** — aberta e bloqueada; retomada obrigatória antes de qualquer superfície de leitura clínica.
- ~~**`L-07` — reavaliação pendente de Bruno**~~ — **RESOLVIDA em 05/09/2026** por `PBACK-AUD-09` (§13.4.1). Permanecem abertas as **dependências e riscos aceitos** dali decorrentes: `AUT-002`/`sessoes.revogar_terceiro` (resposta administrativa à trilha) **não implementada**; volume e latência (`docs/13` H-02/H-03) **não medidos**; ~~**publicação da fatia não autorizada** (D-6)~~ — **superada em 05/09/2026**: fatia integrada na `main` (PR [#23](https://github.com/BrunoMNoronha/techlab-fisio/pull/23), merge `e1459f6`).
- **`P2.2-05`** — relação fisioterapeuta↔paciente / escopo de acesso clínico: **não materializada**; é dependência direta de `L-06`.
- **Visualizador de auditoria (AUD-004)** — política fechada por §13.9; **implementação pendente**, como unidade própria.
- **Emissores ausentes** — 17 das 24 ações homologadas seguem sem emissor (G-02); cada uma será materializada com o módulo de domínio correspondente.
- **`R2.2-04`** — permanece **ABERTO / MITIGADO PARCIALMENTE**. Esta seção **não** o encerra: a validação semântica de `data_referencia_anterior`/`data_referencia_nova` e de `registro_original_id` continua sem regra homologada e sem emissor.
- **`L-08` — materialização técnica** — ação, alvo e chaves a decidir com o módulo de pacientes, considerando o conflito `campos_alterados` × política de escalares (§13.5).
- **`configuracao.alterada` — estado anterior não preservado** — limitação declarada em §13.6, reavaliável com emissor real.

### 13.12 Impactos desta decisão

- **Catálogo de ações:** **inalterado** — permanecem exatamente as **24** ações de `D-AUD-01`. Nenhuma ação acrescentada, nenhuma removida, nenhuma renomeada.
- **Whitelist de `contexto`:** **inalterada** — permanecem **3** positivas e **21** vazias. Nenhuma chave acrescentada.
- **Catálogo de `resultado`, `alvo_tipo`, política fail-closed:** **inalterados**.
- **Schema e migrations:** **nenhuma migration decorre desta seção**, e a razão é estrutural: todas as decisões operam sobre catálogos **da aplicação**, que `docs/07` §22.3/§2.2 determinam expressamente serem documentados e validados na aplicação — nunca em enum SQL, CHECK, trigger ou JSON Schema. Mesmo precedente já registrado por `D-AUD-02`.
- **Dependências:** **nenhuma** instalada ou atualizada.
- **Comportamento funcional:** **nenhum** comportamento novo é introduzido. `AuditWriter`, `AuditContextValidator`, `PermissoesGuard`, controllers, services de domínio, RBAC, permissões e OpenAPI permanecem **intactos**.
- **Código:** apenas **comentários** do catálogo tipado passam a citar estas decisões onde antes descreviam as mesmas matérias como adiadas, e a suíte de não-regressão é fortalecida para travar o estado normativo aqui fixado.

> **Atualização de 05/09/2026 — `PBACK-AUD-09` (§13.4.1).** Os impactos acima descrevem `PBACK-AUD-01`..`PBACK-AUD-08` e permanecem verdadeiros para elas. A reavaliação de `L-07` **altera** o catálogo e a whitelist: **25** ações e **3 positivas · 22 vazias**; **um** comportamento novo (emissão de `autorizacao.negada` pelo caminho da `PermissoesGuard`, restrito a `senha.recuperar_terceiro`). Schema, migrations, dependências, contrato HTTP e OpenAPI continuam **inalterados**. Detalhe da implementação em `docs/10` §7.4.

### 13.13 Expressamente fora do escopo desta seção

Não são objeto nem consequência deste registro: a implementação do endpoint de consulta de auditoria; a criação de `prontuario.acessado`, `autorizacao.negada` *(texto original de 05/09/2026 preservado — a criação de `autorizacao.negada` foi decidida **posteriormente**, na mesma data, por `PBACK-AUD-09`, §13.4.1)*, `auditoria.consultada`, `paciente.cadastro.alterado` ou `paciente.situacao.alterada`; qualquer módulo de domínio (agenda, paciente, prontuário, configuração); a exposição HTTP de `profissional.situacao.alterada` com `profissionais.gerenciar` — que é pendência de **fatia de domínio**, não lacuna normativa de auditoria; `AUT-005`/`RN-001` (revogação de sessões na inativação de usuário); o encerramento de `R2.2-04`; e qualquer revisão da política runtime de escalares.

---

**Fim — §§1..11: proposta histórica; §12: decisão homologada em 25/08/2026 (`D-AUD-01`..`D-AUD-08`); §13: decisão homologada em 05/09/2026 (`PBACK-AUD-01`..`PBACK-AUD-08`); §13.4.1: `PBACK-AUD-09` decidida em 05/09/2026 (reavaliação de `L-07` — auditoria restrita, `autorizacao.negada` homologada). `P-E14-01` ENCERRADA; `T-AUD-CONTEXTO` EXECUTADO (`docs/10` §8.1); `L-05` e `L-08` (política) FECHADAS; `L-07` DECIDIDA (§13.4.1) — implementação autorizada, materializada e **integrada na `main` em 05/09/2026 (PR #23, merge `e1459f6`)**; `D-6` registrou a não autorização no ato da decisão e a publicação foi ato posterior de Bruno Menezes Noronha; `L-06` ABERTA / BLOQUEADA POR DEPENDÊNCIA FUNCIONAL-TÉCNICA; `R2.2-04` permanece ABERTO / MITIGADO PARCIALMENTE.**
