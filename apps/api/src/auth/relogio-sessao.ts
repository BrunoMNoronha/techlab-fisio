// TechLab Fisio — relógio da política de sessão (Etapa 2.3D-B / F2).
//
// POR QUE ESTA ABSTRAÇÃO EXISTE — e por que ela é a menor possível:
// `D-2.3D-04` fixa limites TEMPORAIS exatos (8 h absolutas, 15 min ociosos,
// throttle de ~1 min). `docs/12` §10.2 e a disciplina de qualidade da
// TLF-BASE-V1 §12 exigem prova de borda — inclusive do **instante exato** da
// expiração. Sem um ponto único de leitura do tempo, essa borda só seria
// alcançável por espera real (teste lento e não determinístico) ou por
// escrita direta de timestamps no banco (que provaria o fixture, não a
// política). A interface tem UM método e nenhuma configuração.
//
// O provider de produção é o relógio do sistema, sempre. Nada aqui é
// configurável por ambiente: substituição acontece exclusivamente no
// container de testes, por `overrideProvider`.
//
// FRONTEIRA: `D-2.3D-01` proíbe delegar a política temporal a defaults de
// banco ("o instante é decidido pela aplicação"). Este módulo é justamente
// onde a aplicação decide — e o instante decidido aqui é o MESMO que viaja
// como parâmetro para os predicados SQL de `SessaoService`.

/** Fonte única do "agora" da política de sessão. */
export interface RelogioSessao {
  agora(): Date;
}

/** Token de injeção do relógio. */
export const RELOGIO_SESSAO = Symbol("RELOGIO_SESSAO");

/** Relógio de produção — o relógio do sistema. */
export const relogioDoSistema: RelogioSessao = Object.freeze({
  agora(): Date {
    return new Date();
  },
});
