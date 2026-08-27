# Registro de Decisão P-2.3C-01 — `PROP-RN-2.3C-01`: Aplicação de desconto em cobrança com preservação do recebido

> **Documento:** `docs/11-registro-decisao-p-2.3c-01.md`
> **Projeto:** TechLab Fisio
> **Fase:** 2 — Frente de backend (`apps/api`) — Etapa 2.3C
> **Status:** **DECIDIDO — `PROP-RN-2.3C-01` registrada pela reautorização da Etapa 2.3C, decisão de orquestração de 27/08/2026 sob a autoridade de Bruno Menezes Noronha (TLF-BASE-V1 §15, item 1)**
> **Data:** 27 de agosto de 2026
> **Natureza:** registro normativo da resolução da pendência `P-2.3C-01` (levantada e devolvida pela primeira execução da 2.3C — `docs/10` §6-B). Este documento segue o padrão de `docs/09` (pacote de decisão com registro normativo próprio) e **não altera** `TECHLAB_FISIO_BASE_IMUTAVEL_V1.md` nem `docs/02`..`docs/07`. A eventual absorção desta regra em `docs/03` é ação de governança separada, no mesmo padrão de `P2.2-11`.

---

## 1. A lacuna resolvida

`P-2.3C-01` (registrada em `docs/10` §6-B, 27/08/2026): nenhuma fonte homologada determinava a pré-condição **"cobrança em estado compatível"** de FIN-003 — `docs/07` §19.2 é circular ("mutáveis enquanto a cobrança admitir alteração"); RN-046/RN-047 normatizam apenas pagamento; a alteração de desconto não integra o catálogo transacional T-01..T-09. O pacote de decisão com evidências, opções conservadora/flexível, impactos e testes por alternativa foi devolvido no relatório de execução da primeira 2.3C.

## 2. `PROP-RN-2.3C-01` — texto da regra decidida

**A operação FIN-003 é exclusivamente uma operação de AUMENTO do desconto**, pois seu objetivo normativo é reduzir o valor devido.

1. Cobrança com `cancelada_em IS NOT NULL` **rejeita** alteração de desconto.
2. Para uma mutação efetiva: `valor_desconto_novo > valor_desconto_anterior`.
3. Repetir exatamente o desconto vigente é **no-op**: nenhuma mutação; nenhum evento de auditoria duplicado.
4. Redução do desconto (`valor_desconto_novo < valor_desconto_anterior`) **não pertence a FIN-003** e deve ser rejeitada. Nenhuma funcionalidade de revogação/redução de desconto é criada silenciosamente.
5. Permanecem obrigatórias: `valor_desconto_novo >= 0`; `valor_bruto - valor_desconto_novo >= 0` (RN-042); precisão decimal exata compatível com `numeric(12,2)`; **nunca** float/double em cálculo monetário.
6. Dentro da **mesma transação** e após serialização adequada da cobrança: `recebido_liquido <= valor_liquido_novo`.
7. Pagamentos e estornos já registrados permanecem **intocados** (RN-044/RN-048).
8. A situação continua exclusivamente **derivada** (RN-045; `docs/07` §19.4):

   | Situação derivada | Comportamento sob FIN-003 |
   | --- | --- |
   | `PENDENTE` | pode receber aumento de desconto |
   | `PARCIALMENTE_PAGO` | pode receber aumento desde que o novo líquido não fique abaixo do recebido; igualdade `valor_liquido_novo == recebido_liquido` rederiva para `PAGO` |
   | `PAGO` | aumento rejeitado pela invariante `recebido <= líquido` |
   | `ESTORNADO` | pode receber aumento, sujeito às mesmas invariantes |
   | `CANCELADO` | rejeitado |

9. Nomes canônicos de situação, únicos admitidos em documentação e código: `PENDENTE`, `PARCIALMENTE_PAGO`, `PAGO`, `ESTORNADO`, `CANCELADO`. *(As formas flexionadas `PARCIALMENTE_PAGA`/`PAGA`/`ESTORNADA`/`CANCELADA`, usadas no relatório de chat da primeira execução da 2.3C, não constam de nenhum documento versionado — conferência mecânica em 27/08/2026 — e ficam expressamente proscritas.)*
10. A alteração ocorre sob o **mesmo ponto de serialização da aggregate root Cobrança** utilizado pelos fluxos financeiros concorrentes (lock da linha `cobranca` — `docs/07` §17.3, T-03/T-04/T-05), com prova concorrente medida em PostgreSQL real (não se assume que READ COMMITTED isolado baste).

## 3. Auditoria vinculada

Cada mutação efetiva gera, na mesma transação, exatamente um evento `cobranca.desconto_aplicado` (D-AUD-01) com `contexto` **exatamente** `valor_desconto_anterior`/`valor_desconto_novo` (whitelist positiva de D-AUD-07), ambos como **string decimal canônica** compatível com `numeric(12,2)`, sob a enforcement fail-closed de D-AUD-08. Nada nesta decisão altera `docs/09` §12.

## 4. Efeitos

- **`P-2.3C-01` — RESOLVIDA** por esta decisão; a implementação da Etapa 2.3C fica desbloqueada nos termos acima.
- O estado vivo de implementação, medições e pendências permanece em `docs/10` (registro vivo, não normativo).

---

**Fim — `docs/11-registro-decisao-p-2.3c-01.md` — `PROP-RN-2.3C-01` registrada; `P-2.3C-01` resolvida em 27/08/2026.**
