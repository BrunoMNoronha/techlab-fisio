// TechLab Fisio — catálogo RBAC de seed (Etapa 2.3D-B / F5).
//
// FONTE ÚNICA E EXAUSTIVA: `docs/04-perfis-permissoes.md` — §3 (os quatro
// papéis do MVP), §4 (matriz funcional) e §5 (catálogo funcional de
// permissões), homologado em 10/08/2026. Este arquivo é a materialização
// TIPADA daquela fonte — ele NÃO decide nada, NÃO cria papel, NÃO cria
// permissão e NÃO amplia a matriz. Mesmo precedente, mesma disciplina e mesma
// forma de `authz/permissoes.catalogo.ts` (que materializa `docs/04` §5) e de
// `audit/audit.catalog.ts` (que materializa `docs/09` §12).
//
// `D-2.3D-09` (`docs/12` §5.9), literal: "o seed inicial futuro deverá
// refletir EXATAMENTE a matriz homologada de papéis/permissões de `docs/04`".
//
// NENHUM CATÁLOGO PARALELO DE PERMISSÃO NASCE AQUI. O conjunto fechado dos 29
// identificadores continua sendo `authz/permissoes.catalogo.ts` — o tipo
// `Permissao` importado abaixo é o mesmo que o RBAC da F4 usa para decidir
// acesso, e o `satisfies` garante em COMPILAÇÃO que toda permissão do catálogo
// tenha descrição declarada e que nenhuma associação cite identificador
// inexistente. Divergência entre seed e catálogo é erro de compilação, não
// desvio silencioso em runtime.
//
// POR QUE O SEED VIVE EM `apps/api` E NÃO EM `packages/database`: o catálogo
// tipado de permissões, a política Argon2 (`CredencialService`), o
// `AuditWriter` e a fronteira transacional (`DatabaseService`) são todos de
// `apps/api`. Semear a partir de `packages/database` exigiria ou duplicar o
// catálogo — criando as duas fontes divergentes que `D-2.3D-09` quer impedir
// — ou inverter a dependência (`packages/database` -> `apps/api`), que é
// acoplamento proibido pela arquitetura vigente.

import type { Permissao } from "../authz/permissoes.catalogo.js";

/**
 * `docs/04` §3 — os QUATRO papéis funcionais do MVP, na ordem da fonte.
 *
 * `nome` é o título de §3, byte a byte. `codigo` é o identificador técnico de
 * `papel.codigo` (`U-11`, `docs/07` §10.1): `docs/04` §3 NÃO cataloga códigos
 * de papel, e `docs/09` §12.1 (item 2) registra expressamente essa ausência.
 * A forma adotada — o nome do papel em CAIXA ALTA, sem acentos — é decisão
 * LOCAL de implementação, declarada em `docs/10`, e segue o precedente de
 * forma já vigente no schema homologado para todo identificador técnico
 * enumerado (`ATIVA`, `EXPIRADA`, `REVOGADA`, `EM_ELABORACAO`, ...).
 *
 * Nenhum papel auxiliar existe: não há `SuperAdmin`, `Root`, `System`,
 * `Owner`, `Developer` nem `Support`. São EXATAMENTE quatro, por decisão de
 * fonte, e a prova mecânica está em `test/catalogo-rbac.spec.ts`.
 */
export const PAPEIS = Object.freeze([
  { codigo: "ADMINISTRADOR", nome: "Administrador" },
  { codigo: "GESTOR", nome: "Gestor" },
  { codigo: "RECEPCIONISTA", nome: "Recepcionista" },
  { codigo: "FISIOTERAPEUTA", nome: "Fisioterapeuta" },
] as const);

/** Identificador técnico de papel — conjunto FECHADO por `docs/04` §3. */
export type CodigoPapel = (typeof PAPEIS)[number]["codigo"];

/** Código do papel administrativo — alvo do bootstrap de `D-2.3D-10`. */
export const CODIGO_PAPEL_ADMINISTRADOR = "ADMINISTRADOR" satisfies CodigoPapel;

const CODIGOS_DE_PAPEL: ReadonlySet<string> = new Set(
  PAPEIS.map((papel) => papel.codigo),
);

/** `true` sse `codigo` é um dos quatro papéis homologados por `docs/04` §3. */
export function ehCodigoPapel(codigo: unknown): codigo is CodigoPapel {
  return typeof codigo === "string" && CODIGOS_DE_PAPEL.has(codigo);
}

/**
 * `permissao.nome` — a descrição funcional de `docs/04` §5, VERBATIM.
 *
 * A coluna `permissao.nome` é NOT NULL e a fonte homologada oferece, para cada
 * identificador, exatamente um parágrafo descritivo. Usá-lo é a única
 * alternativa que não INVENTA texto: qualquer rótulo curto ("Gerenciar
 * usuários") seria autoria nova, sem fonte, em um registro que a matriz
 * homologada governa. A prova mecânica de igualdade com o documento está em
 * `test/catalogo-rbac.spec.ts`, que LÊ `docs/04` e compara parágrafo a
 * parágrafo.
 */
export const DESCRICAO_PERMISSAO = {
  // §5.1 — Identidade
  "usuarios.gerenciar":
    "Permite criar, ativar/inativar e administrar contas, respeitando regras de segurança.",
  "permissoes.gerenciar": "Permite atribuir/remover papéis e permissões críticas.",
  "sessoes.revogar_terceiro": "Permite revogar sessões de outro usuário.",
  "senha.recuperar_terceiro": "Permite iniciar D-04 para outro usuário.",
  // §5.2 — Clínica e profissionais
  "clinica.configurar": "Configuração cadastral e operacional.",
  "profissionais.gerenciar": "Cadastro, disponibilidade, serviços e situação.",
  // §5.3 — Pacientes
  "pacientes.administrativo.gerenciar":
    "Dados administrativos permitidos, sem incluir prontuário.",
  "pacientes.localizar": "Pesquisa respeitando minimização e escopo.",
  // §5.4 — Agenda
  "agenda.gerenciar": "Criar/confirmar/remarcar/cancelar conforme escopo.",
  "agenda.checkin": "Registrar chegada.",
  "agenda.falta": "Registrar não comparecimento.",
  "agenda.bloqueio": "Criar/remover bloqueios conforme escopo.",
  // §5.5 — Prontuário
  "prontuario.ler":
    "Exige papel/capacidade clínica e relação apropriada com o paciente/atendimento.",
  "prontuario.escrever": "Criar/editar conteúdo clínico em elaboração.",
  "prontuario.finalizar": "Efetivar registro clínico do próprio atendimento/escopo.",
  "prontuario.retificar_proprio":
    "Efetivar retificação conforme D-01 quando o usuário for autor do original.",
  "prontuario.retificar_terceiro":
    "Permissão excepcional para fisioterapeuta retificar registro de outro profissional. Exige justificativa e auditoria reforçada.",
  "prontuario.exportar": "Gerar impressão/exportação autorizada.",
  // §5.6 — Pacotes
  "pacotes.gerenciar": "Criar/administrar pacote no nível operacional permitido.",
  "pacotes.ajustar_sessao": "Operação sensível. Exige justificativa e auditoria.",
  // §5.7 — Financeiro
  "financeiro.cobranca.gerenciar": "Criar/operar cobranças comuns.",
  "financeiro.pagamento.registrar": "Registrar recebimentos.",
  "financeiro.desconto.aplicar": "Aplicar desconto dentro das regras do MVP.",
  "financeiro.cobranca.cancelar": "Cancelar cobrança elegível.",
  "financeiro.pagamento.estornar": "Estornar pagamento. Operação sensível e auditada.",
  "financeiro.relatorio.ler": "Consultar relatórios financeiros no escopo autorizado.",
  // §5.8 — Indicadores e auditoria
  "indicadores.globais.ler":
    "Indicadores gerenciais globais, incluindo financeiro quando cabível.",
  "indicadores.proprios.ler": "Indicadores restritos ao próprio profissional.",
  "auditoria.ler": "Consultar trilha de auditoria conforme escopo administrativo.",
} as const satisfies Record<Permissao, string>;

// ---------------------------------------------------------------------------
// REGRA DE DERIVAÇÃO DA MATRIZ — declarada, mecânica e uniforme
// ---------------------------------------------------------------------------
//
// `MATRIZ_RBAC` abaixo é derivada célula a célula da matriz de `docs/04` §4,
// pela regra a seguir. A regra é aplicada SEM EXCEÇÃO e cada célula está
// anotada com seu símbolo de origem, para conferência linha a linha contra o
// documento.
//
//   `✓` ................................. CONCEDIDA no seed.
//   `C`, `C relacionado`, `C próprio`,
//   `C próprio/relacionado` ............. CONCEDIDA no seed. A legenda de §4
//       distingue `C` de `P`: `C` é "condicionado a escopo, relação com
//       recurso ou configuração operacional" e NÃO "exige permissão
//       específica adicional". Logo o papel POSSUI a permissão; o
//       estreitamento por escopo/relação é enforcement e pertence à
//       autorização clínica contextual (`P2.2-05`), NÃO INICIADA. Conceder
//       aqui não a antecipa nem a dispensa (`docs/04` §2.4/§6.3;
//       TLF-BASE-V1 §6).
//   `C mínimo`, `C leitura mínima` ...... NÃO CONCEDIDA. A célula autoriza um
//       subconjunto REDUZIDO que o identificador de §5 não sabe expressar;
//       conceder o identificador inteiro daria MAIS do que a matriz permite.
//       Lacuna de granularidade declarada, não invenção.
//   qualquer célula que contenha `P`
//   (`P`, `P excepcional`, `✓/P`,
//    `P/✓ conforme política`,
//    `C próprio se autorizado`) ......... NÃO CONCEDIDA. `P` é, por definição
//       da legenda, permissão específica ADICIONAL — nunca padrão do papel
//       (`docs/04` §2.1, §2.2, §6.2; **HOM-01**). Célula ambígua que contenha
//       `P` resolve-se pelo lado que NÃO amplia privilégio.
//   `—`, `—*` ........................... NÃO CONCEDIDA. `—*` é a marca
//       expressa de que o papel Administrador NÃO possui capacidade clínica
//       (`docs/04` §3.1, §4 nota de rodapé, §6.2; PERM-T01).
//
// VÁRIAS LINHAS PARA O MESMO IDENTIFICADOR — regra de combinação: quando mais
// de uma linha de §4 mapeia para a MESMA permissão de §5, o papel a recebe
// somente se TODAS essas linhas concederem (INTERSEÇÃO, nunca união). É a
// única combinação que não amplia privilégio: a união faria a linha mais
// permissiva apagar a mais restritiva do mesmo documento. Duas consequências
// medidas, ambas desejadas:
//   - Recepcionista NÃO recebe `financeiro.relatorio.ler`: "Consultar
//     financeiro operacional do paciente" é `C`, mas "Consultar financeiro
//     global" é `—`, e o identificador de §5.7 não distingue os dois;
//   - Fisioterapeuta NÃO recebe `pacientes.administrativo.gerenciar`:
//     "Cadastrar/Editar paciente administrativo" é `C`, mas "Ver observação
//     administrativa" é `C mínimo` — acesso reduzido que o identificador não
//     expressa. Coerente com `docs/04` §3.3, que atribui o cadastro
//     administrativo à Recepcionista, e com §3.4, que não o lista entre as
//     responsabilidades do Fisioterapeuta.
//
// OPERAÇÕES DE §4 SEM IDENTIFICADOR OBJETIVO EM §5 — lacunas DECLARADAS, não
// preenchidas por invenção (registradas em `docs/10`):
//   - "Autenticar/logout próprio" e "Recuperar própria senha via fluxo
//     autorizado": `✓` para os quatro papéis. §5 não cataloga permissão para
//     operação sobre a PRÓPRIA identidade — e a F4 já registrou que essas
//     rotas não exigem permissão alguma (`docs/10` §6-J.4);
//   - "Consultar profissionais" (`✓ ✓ ✓ ✓`): §5.2 só cataloga
//     `profissionais.gerenciar` (gestão). Conceder gestão a todos para cobrir
//     uma leitura seria ampliação grosseira e contradiria "Gerenciar
//     profissionais" (`✓ — — —`), a linha imediatamente anterior;
//   - "Iniciar/Concluir atendimento clínico": §5 não cataloga permissão de
//     atendimento;
//   - "Consultar saldo administrativo de pacote" e "Consultar histórico
//     detalhado de movimentos": §5.6 só cataloga `pacotes.gerenciar` e
//     `pacotes.ajustar_sessao`, ambos de mutação;
//   - "Emitir recibo simples": §5.7 não cataloga permissão de recibo;
//   - "Consultar indicadores operacionais": a linha significa coisas
//     diferentes por coluna — para o Fisioterapeuta seria
//     `indicadores.proprios.ler`, e ali a célula é `C próprio SE AUTORIZADO`;
//     para Administrador e Gestor o acesso já vem de `indicadores.globais.ler`
//     pela linha anterior; para a Recepcionista é um `C` reduzido sem
//     identificador. Nenhum identificador único é objetivamente determinável,
//     e por isso `indicadores.proprios.ler` NÃO é concedida a papel algum —
//     coerente com `docs/04` §3.4 ("apenas se essa permissão for prevista").
//
// AGRUPAMENTOS DE LINHAS EM UM MESMO IDENTIFICADOR — todos com base em fonte,
// e todos SEM efeito sobre o conjunto concedido (as linhas agrupadas têm
// exatamente a mesma coluna de símbolos):
//   - "Gerenciar serviços", "Gerenciar formas de pagamento" e "Gerenciar
//     motivos de cancelamento" -> `clinica.configurar`. TLF-BASE-V1 §5.2
//     ("Configuração da clínica") lista expressamente serviços, formas de
//     pagamento e motivos padronizados de cancelamento como configuração da
//     clínica; `docs/04` §5.2 define `clinica.configurar` como "Configuração
//     cadastral e operacional";
//   - "Ver observação administrativa" -> `pacientes.administrativo.gerenciar`
//     ("Dados administrativos permitidos, sem incluir prontuário");
//   - "Anexar documento clínico" -> `prontuario.escrever` ("Criar/editar
//     conteúdo clínico em elaboração"), que o Fisioterapeuta já recebe pela
//     linha "Criar evolução".
//
// PROPRIEDADES QUE A MATRIZ ABAIXO SATISFAZ — e que os testes exigem:
//   - Administrador NÃO recebe as 29 permissões: recebe 18;
//   - Administrador NÃO recebe NENHUMA permissão `prontuario.*` (`—*`);
//   - Gestor recebe SOMENTE leitura — HOM-01 preservado, zero mutação;
//   - as três operações financeiras sensíveis (`desconto.aplicar`,
//     `cobranca.cancelar`, `pagamento.estornar`) e `pacotes.ajustar_sessao`
//     não são concedidas a papel algum: são `P` para todos, e `docs/04` §8
//     exige "permissão específica" para cada uma;
//   - `prontuario.retificar_proprio`, `prontuario.retificar_terceiro` e
//     `prontuario.exportar` não são concedidas: são `P` (`docs/04` §9,
//     PERM-T05..PERM-T07);
//   - `indicadores.proprios.ler` não é concedida: `docs/04` §3.4 a condiciona
//     expressamente ("apenas se essa permissão for prevista").

/**
 * Matriz papel -> permissões CONCEDIDAS NO SEED, derivada de `docs/04` §4 pela
 * regra declarada acima. Ordem: a do catálogo (`PERMISSOES`), para saída
 * determinística.
 */
export const MATRIZ_RBAC = {
  ADMINISTRADOR: [
    "usuarios.gerenciar", //                 ✓ — "Gerenciar usuários"
    "permissoes.gerenciar", //               ✓ — "Gerenciar papéis/permissões"
    "sessoes.revogar_terceiro", //           ✓ — "Revogar sessões de terceiro"
    "senha.recuperar_terceiro", //           ✓ — "Iniciar recuperação de senha de terceiro"
    "clinica.configurar", //                 ✓ — "Configurar clínica" + serviços/formas/motivos
    "profissionais.gerenciar", //            ✓ — "Gerenciar profissionais"
    "pacientes.administrativo.gerenciar", // ✓ — "Cadastrar/Editar paciente administrativo"
    "pacientes.localizar", //                ✓ — "Localizar paciente"
    "agenda.gerenciar", //                   ✓ — "Criar/Confirmar/Remarcar/Cancelar agendamento"
    "agenda.checkin", //                     ✓ — "Efetuar check-in"
    "agenda.falta", //                       ✓ — "Registrar falta"
    "agenda.bloqueio", //                    ✓ — "Criar bloqueio de agenda"
    "pacotes.gerenciar", //                  ✓ — "Criar pacote contratado" / "Vincular pacote"
    "financeiro.cobranca.gerenciar", //      ✓ — "Criar cobrança"
    "financeiro.pagamento.registrar", //     ✓ — "Registrar pagamento"
    "financeiro.relatorio.ler", //           ✓ — "Consultar financeiro global"
    "indicadores.globais.ler", //            ✓ — "Consultar indicadores globais"
    "auditoria.ler", //                      ✓ — "Consultar auditoria"
    // NÃO concedidas ao Administrador, e por quê:
    //   prontuario.*                  -> `—*` (o papel administrativo NÃO
    //                                    concede capacidade clínica)
    //   pacotes.ajustar_sessao        -> `P`
    //   financeiro.desconto.aplicar   -> `✓/P`
    //   financeiro.cobranca.cancelar  -> `✓/P`
    //   financeiro.pagamento.estornar -> `✓/P`
    //   indicadores.proprios.ler      -> lacuna declarada da linha "Consultar
    //                                    indicadores operacionais"; §5.8
    //                                    restringe ao "próprio profissional" e
    //                                    o acesso do Administrador já vem de
    //                                    `indicadores.globais.ler`
  ],
  GESTOR: [
    "pacientes.localizar", //      C — "Localizar paciente" (leitura; HOM-01 intacto)
    "financeiro.relatorio.ler", // ✓ — "Consultar financeiro global"
    "indicadores.globais.ler", //  ✓ — "Consultar indicadores globais"
    // HOM-01: todas as demais colunas do Gestor em §4 são `—` ou `P`. Nenhuma
    // permissão de mutação é concedida — nem agenda, nem pacotes, nem
    // cobrança, nem pagamento, nem desconto, nem estorno, nem permissões.
  ],
  RECEPCIONISTA: [
    "pacientes.administrativo.gerenciar", // ✓ — "Cadastrar/Editar paciente administrativo"
    "pacientes.localizar", //                ✓ — "Localizar paciente"
    "agenda.gerenciar", //                   ✓ — "Criar/Confirmar/Remarcar/Cancelar agendamento"
    "agenda.checkin", //                     ✓ — "Efetuar check-in"
    "agenda.falta", //                       ✓ — "Registrar falta"
    "pacotes.gerenciar", //                  ✓ — "Criar pacote contratado" / "Vincular pacote"
    "financeiro.cobranca.gerenciar", //      ✓ — "Criar cobrança"
    "financeiro.pagamento.registrar", //     ✓ — "Registrar pagamento"
    // NÃO concedidas:
    //   agenda.bloqueio               -> `P/✓ conforme política` (contém `P`)
    //   financeiro.desconto.aplicar   -> `P`
    //   financeiro.cobranca.cancelar  -> `P`
    //   financeiro.pagamento.estornar -> `P`
    //   financeiro.relatorio.ler      -> `—` em "Consultar financeiro global";
    //                                    o `C` de "financeiro operacional do
    //                                    paciente" é acesso REDUZIDO que o
    //                                    identificador de §5.7 não expressa
    //   prontuario.*                  -> `—` (§3.3: sem conteúdo clínico)
  ],
  FISIOTERAPEUTA: [
    "pacientes.localizar", //                C relacionado — "Localizar paciente"
    "agenda.gerenciar", //                   C — "Criar/Confirmar/Remarcar/Cancelar agendamento"
    "agenda.checkin", //                     C — "Efetuar check-in"
    "agenda.falta", //                       C — "Registrar falta"
    "agenda.bloqueio", //                    C próprio — "Criar bloqueio de agenda"
    "prontuario.ler", //                     C relacionado — "Ver prontuário clínico"
    "prontuario.escrever", //                C relacionado — "Criar avaliação/evolução/anexo"
    "prontuario.finalizar", //               C próprio/relacionado — "Finalizar registro clínico"
    // NÃO concedidas:
    //   prontuario.retificar_proprio  -> `P`
    //   prontuario.retificar_terceiro -> `P excepcional`
    //   prontuario.exportar           -> `P relacionado`
    //   pacientes.administrativo.gerenciar -> interseção: "Cadastrar/Editar
    //                                    paciente administrativo" é `C`, mas
    //                                    "Ver observação administrativa" é
    //                                    `C mínimo`
    //   pacotes.gerenciar             -> `—` em "Criar pacote contratado" e
    //                                    `C leitura mínima` em "Vincular"
    //   financeiro.*                  -> `—`
    //   indicadores.proprios.ler      -> `C próprio SE AUTORIZADO` (§3.4)
  ],
} as const satisfies Record<CodigoPapel, readonly Permissao[]>;

/** Associação papel↔permissão do seed, na forma persistida. */
export interface AssociacaoSeed {
  readonly papel: CodigoPapel;
  readonly permissao: Permissao;
}

/**
 * Associações papel↔permissão do seed, achatadas e em ordem determinística
 * (papéis na ordem de `docs/04` §3; permissões na ordem do catálogo §5). É
 * exatamente o conjunto que `SeedRbacService` persiste em `papel_permissao`.
 */
export const ASSOCIACOES_SEED: readonly AssociacaoSeed[] = Object.freeze(
  PAPEIS.flatMap((papel) =>
    MATRIZ_RBAC[papel.codigo].map(
      (permissao): AssociacaoSeed => ({ papel: papel.codigo, permissao }),
    ),
  ),
);
