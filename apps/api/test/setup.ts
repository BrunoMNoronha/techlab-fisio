// Carregado via `setupFiles` antes de cada arquivo de teste — os decorators
// do NestJS exigem a shim global de metadata (mesma primeira linha de
// src/main.ts no runtime real).
import "reflect-metadata";

// `F-02` — `TLF_AMBIENTE` passou a ser OBRIGATÓRIA: a aplicação não assume
// ambiente por omissão, e o provider de política de cookie aborta o bootstrap
// sem ela. As suítes declaram `teste`, que é um dos quatro valores homologados
// e o único que descreve corretamente este processo. Declarado aqui — em
// `setupFiles`, antes de qualquer import de módulo da aplicação — para que
// nenhum arquivo de teste precise repetir a configuração.
//
// Uma suíte que precise medir OUTRO ambiente sobrescreve a variável dentro do
// próprio caso e a restaura, como faz `auth.module.integration.spec.ts`.
process.env["TLF_AMBIENTE"] ??= "teste";
