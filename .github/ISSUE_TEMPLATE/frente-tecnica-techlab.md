---
name: Frente técnica TechLab Fisio
about: Especificar implementação, revisão ou validação com escopo, dependências e critérios verificáveis
title: "[ÁREA] "
labels: ""
assignees: ""
---

<!--
Use esta estrutura para tarefas técnicas, funcionais, documentais ou de validação.
Remova instruções e seções não aplicáveis, sem eliminar informações necessárias à governança.
Não altere a Base Imutável; propostas de mudança estrutural exigem análise e autorização próprias.
-->

## Contexto e resultado esperado

<!-- Descreva o problema, a relação com issue-pai/roadmap e o resultado observável esperado. -->

## Fontes e decisões vinculantes

- `TECHLAB_FISIO_BASE_IMUTAVEL_V2.md` — somente leitura.
- <!-- ADRs, decisões homologadas, documentos e issues relacionadas. -->

## Estado conhecido

<!-- Registre apenas fatos medidos. SHA, branch, status e versões devem ser verificados no início da execução, não presumidos. -->

## Escopo autorizado

- <!-- Alterações e comportamentos permitidos. -->

## Regras e contratos

- <!-- Estados, permissões, validações, códigos de erro, dados alterados, auditoria e invariantes. -->

## Fora de escopo

- <!-- Módulos, comportamentos, mudanças estruturais e publicações não autorizados. -->

## Dependências e ordem de execução

- <!-- Issues, frentes e pré-condições obrigatórias, incluindo a ordem quando relevante. -->

## Entregáveis

- <!-- Código, testes, documentação, relatório ou outros artefatos esperados. -->

## Critérios de aceite

- [ ] O escopo autorizado foi integralmente atendido.
- [ ] Caminhos felizes, bordas, rejeições e permissões aplicáveis foram cobertos.
- [ ] Código, testes, contratos e documentação permanecem coerentes.
- [ ] Nenhuma ampliação silenciosa de escopo foi introduzida.

## Testes e verificações

- <!-- Comandos ou tipos de prova exigidos; usar scripts vigentes encontrados no repositório. -->
- [ ] Cada comando executado possui resultado explícito.
- [ ] Validações não executadas são declaradas no relatório final.

## Persistência, segurança e privacidade

- <!-- Migrações, transações, concorrência, RBAC, auditoria, LGPD e ausência de dados reais. -->
- [ ] Nenhum segredo ou dado real de paciente é usado ou registrado.
- [ ] Mudanças estruturais de banco ou contrato possuem autorização explícita, quando aplicável.

## Governança Git

- [ ] Branch, HEAD, status, divergência e alterações preexistentes são medidos antes da edição.
- [ ] A implementação não ocorre diretamente na `main`.
- [ ] Alterações fora da tarefa são preservadas.
- [ ] Nenhum comando destrutivo é executado.
- [ ] Commit, push, PR, merge, deploy e publicação somente ocorrem quando expressamente autorizados.

## Relatório final obrigatório

Registrar:

- resultado alcançado ou bloqueio;
- estado inicial medido;
- arquivos e contratos afetados;
- testes, comandos e resultados;
- persistência, segurança e ausência/presença de drift;
- estado Git final, incluindo SHA e árvore de trabalho;
- pendências, riscos concretos e próximo passo recomendado.
