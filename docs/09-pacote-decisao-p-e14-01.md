# Pacote de Decisão P-E14-01 — Catálogo de auditoria e whitelist de `contexto`

> **Documento:** `docs/09-pacote-decisao-p-e14-01.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Implementação física — `E-18A`
> **Status:** **DECIDIDO — DECISÕES `D-AUD-01`..`D-AUD-08` HOMOLOGADAS POR BRUNO MENEZES NORONHA EM 25/08/2026 — REGISTRO NORMATIVO EM §12**
> **Data:** 25 de agosto de 2026 (proposta e decisão)
> **Natureza:** §§1..11 são preservados **como a proposta original submetida à decisão** (insumo decisório histórico, sem valor normativo próprio); **§12 é o registro normativo da decisão homologada** de `P-E14-01`. Onde §12 divergir de §§1..11, **§12 prevalece**. Este documento não altera `docs/02`..`docs/07`.

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

**Fim — §§1..11: proposta histórica; §12: decisão homologada em 25/08/2026. `P-E14-01` ENCERRADA; `T-AUD-CONTEXTO` RECLASSIFICADO — PENDENTE DA CAMADA DE APLICAÇÃO; `R2.2-04` transferido para a frente de backend (`P-BACK-01`).**
