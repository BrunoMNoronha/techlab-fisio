// TechLab Fisio — `SessaoService` ponta a ponta contra PostgreSQL REAL
// (Etapa 2.3D-B / F2).
//
// Caminho provado: application layer (`SessaoService`, resolvido do container
// Nest real) → `DatabaseService` → cliente real (fábrica pública) → role de
// runtime (`tlf_app`) → PostgreSQL 18 → `sessao_autenticacao`.
//
// Propriedades medidas (NÃO mockadas):
//   - `D-2.3D-01`: token `<sessao_id>.<segredo>`; somente o verificador
//     SHA-256 do segredo é persistido; o segredo não aparece em coluna alguma;
//   - `D-2.3D-04`: expiração absoluta de 8 h, timeout ocioso de 15 min,
//     throttle de ~1 write/min, `expira_em` que não desliza;
//   - `D-2.3D-05`: `ATIVA -> EXPIRADA` e `ATIVA -> REVOGADA`, sem ressurreição;
//   - `R-2.3D-03`: atualização de atividade ATOMICAMENTE monotônica, provada
//     com corrida REAL sobre o lock da linha — não por inspeção.
//
// O RELÓGIO da política (`RELOGIO_SESSAO`) é substituído por um relógio
// controlado: as bordas de `D-2.3D-04` só são alcançáveis no INSTANTE EXATO
// com controle do tempo. O restante do caminho — transação, SQL, locks,
// constraints — é integralmente real.
//
// Fixtures 100 % sintéticas; limpeza determinística entre testes (setup-db).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";

import type { TransacaoPersistencia } from "@techlab-fisio/database";

import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { RELOGIO_SESSAO } from "../../src/auth/relogio-sessao.js";
import type { RelogioSessao } from "../../src/auth/relogio-sessao.js";
import {
  ErroSessao,
  POLITICA_SESSAO,
  SessaoService,
} from "../../src/auth/sessao.service.js";
import type { ResultadoValidacaoSessao } from "../../src/auth/sessao.service.js";
import { calcularVerificadorSessao, gerarSegredoSessao } from "../../src/auth/token-sessao.js";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Instante-base fixo — a suíte nunca depende do relógio da máquina. */
const T0 = new Date("2026-08-25T10:00:00.000Z");

class RelogioControlado implements RelogioSessao {
  #instante = new Date(T0.getTime());

  agora(): Date {
    return new Date(this.#instante.getTime());
  }

  definir(instante: Date): void {
    this.#instante = new Date(instante.getTime());
  }

  reiniciar(): void {
    this.#instante = new Date(T0.getTime());
  }
}

/** `T0 + ms`, para escrever bordas sem aritmética repetida nos testes. */
function em(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

let moduleRef: TestingModule;
let app: INestApplication;
let database: DatabaseService;
let sessaoService: SessaoService;
const relogio = new RelogioControlado();

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RELOGIO_SESSAO)
    .useValue(relogio)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  database = moduleRef.get(DatabaseService);
  sessaoService = moduleRef.get(SessaoService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  relogio.reiniciar();
});

// ---------------------------------------------------------------------------
// Fixtures e leituras auxiliares
// ---------------------------------------------------------------------------

async function criarUsuario(opcoes?: { ativo?: boolean }): Promise<string> {
  const sufixo = randomUUID().slice(0, 8);
  return database.transacao(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: `sessao-f2-${sufixo}@sintetico.local`,
        senhaHash: "hash-sintetico-f2",
        nome: "Usuário Sintético F2",
        ativo: opcoes?.ativo ?? true,
      },
      select: { id: true },
    });
    return usuario.id;
  });
}

async function lerSessao(sessaoId: string) {
  return database.transacao(async (tx) =>
    tx.sessaoAutenticacao.findUniqueOrThrow({ where: { id: sessaoId } }),
  );
}

/**
 * FIXTURE, não lógica de produção: reposiciona `ultima_atividade_em` para
 * simular uma atividade legítima ocorrida naquele instante. Necessário para
 * isolar a borda ABSOLUTA da borda OCIOSA — sem isso, chegar às 8 h exigiria
 * dezenas de validações intermediárias só para manter a sessão não-ociosa.
 */
async function simularAtividadeAnterior(sessaoId: string, instante: Date): Promise<void> {
  await database.transacao(async (tx) => {
    await tx.$executeRaw`
      UPDATE sessao_autenticacao
         SET ultima_atividade_em = ${instante}::timestamptz
       WHERE id = ${sessaoId}::uuid
    `;
  });
}

/** Emite uma sessão em `T0` e devolve o par (token, id, usuário). */
async function emitirEmT0(): Promise<{
  usuarioId: string;
  sessaoId: string;
  token: string;
  segredo: string;
}> {
  const usuarioId = await criarUsuario();
  relogio.definir(T0);
  const emitida = await sessaoService.emitir({ usuarioId });
  const segredo = emitida.token.split(".")[1] as string;
  return { usuarioId, sessaoId: emitida.sessaoId, token: emitida.token, segredo };
}

// ---------------------------------------------------------------------------
// Emissão — `D-2.3D-01` / `D-2.3D-04`
// ---------------------------------------------------------------------------

describe("emissão", () => {
  it("nasce ATIVA, com ultima_atividade_em = criada_em e expira_em = criada_em + 8h", async () => {
    const usuarioId = await criarUsuario();
    relogio.definir(T0);

    const emitida = await sessaoService.emitir({ usuarioId });

    expect(emitida.criadaEm.toISOString()).toBe(T0.toISOString());
    expect(emitida.ultimaAtividadeEm.toISOString()).toBe(emitida.criadaEm.toISOString());
    expect(emitida.expiraEm.getTime() - emitida.criadaEm.getTime()).toBe(8 * HORA);
    expect(POLITICA_SESSAO.expiracaoAbsolutaMs).toBe(8 * HORA);

    const linha = await lerSessao(emitida.sessaoId);
    expect(linha.estado).toBe("ATIVA");
    expect(linha.usuarioId).toBe(usuarioId);
    expect(linha.criadaEm.toISOString()).toBe(T0.toISOString());
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
    expect(linha.expiraEm.toISOString()).toBe(em(8 * HORA).toISOString());
    expect(linha.encerradaEm).toBeNull();
    expect(linha.revogadaPorUsuarioId).toBeNull();
  });

  it("o instante de criação vem do RELÓGIO DA APLICAÇÃO, não do DEFAULT do banco", async () => {
    const usuarioId = await criarUsuario();
    // T0 é uma data fixa do passado: se `criada_em` viesse de CURRENT_TIMESTAMP,
    // este valor seria o instante da execução, não T0.
    relogio.definir(T0);
    const emitida = await sessaoService.emitir({ usuarioId });
    const linha = await lerSessao(emitida.sessaoId);
    expect(linha.criadaEm.toISOString()).toBe(T0.toISOString());
    expect(Math.abs(linha.criadaEm.getTime() - Date.now())).toBeGreaterThan(HORA);
  });

  it("o token tem a forma `<sessao_id>.<segredo>` estabelecida", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const partes = token.split(".");
    expect(partes).toHaveLength(2);
    expect(partes[0]).toBe(sessaoId);
    expect(partes[1]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("o banco armazena APENAS o SHA-256 do segredo", async () => {
    const { sessaoId, segredo } = await emitirEmT0();
    const linha = await lerSessao(sessaoId);
    expect(linha.tokenHash).toBe(calcularVerificadorSessao(segredo));
    expect(linha.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nem o segredo nem o token completo aparecem em coluna alguma da linha", async () => {
    const { sessaoId, token, segredo } = await emitirEmT0();
    const linhas = await database.transacao(async (tx) =>
      tx.$queryRaw<Array<Record<string, string | null>>>`
        SELECT id::text, usuario_id::text, token_hash, estado::text,
               criada_em::text, ultima_atividade_em::text, expira_em::text,
               encerrada_em::text, revogada_por_usuario_id::text
          FROM sessao_autenticacao
         WHERE id = ${sessaoId}::uuid
      `,
    );
    expect(linhas).toHaveLength(1);
    const serializada = JSON.stringify(linhas[0]);
    expect(serializada).not.toContain(segredo);
    expect(serializada).not.toContain(token);
  });

  it("sessões diferentes recebem segredos e verificadores diferentes", async () => {
    const usuarioId = await criarUsuario();
    relogio.definir(T0);
    const a = await sessaoService.emitir({ usuarioId });
    const b = await sessaoService.emitir({ usuarioId });

    expect(a.sessaoId).not.toBe(b.sessaoId);
    expect(a.token.split(".")[1]).not.toBe(b.token.split(".")[1]);
    const [linhaA, linhaB] = await Promise.all([lerSessao(a.sessaoId), lerSessao(b.sessaoId)]);
    expect(linhaA.tokenHash).not.toBe(linhaB.tokenHash);
  });

  it("rejeita usuário inexistente e usuário inativo com motivo estável (integridade)", async () => {
    relogio.definir(T0);
    await expect(sessaoService.emitir({ usuarioId: randomUUID() })).rejects.toThrow(ErroSessao);

    const inativo = await criarUsuario({ ativo: false });
    await expect(sessaoService.emitir({ usuarioId: inativo })).rejects.toMatchObject({
      name: "ErroSessao",
      motivo: "USUARIO_INATIVO",
    });

    const total = await database.transacao(async (tx) => tx.sessaoAutenticacao.count());
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Verificação
// ---------------------------------------------------------------------------

describe("verificação", () => {
  it("token correto de sessão ativa é válido", async () => {
    const { token, sessaoId, usuarioId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    const resultado = await sessaoService.validar(token);

    expect(resultado.valida).toBe(true);
    if (!resultado.valida) throw new Error("inalcançável");
    expect(resultado.sessaoId).toBe(sessaoId);
    expect(resultado.usuarioId).toBe(usuarioId);
  });

  it("segredo incorreto é inválido e NÃO registra atividade", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const tokenForjado = `${sessaoId}.${gerarSegredoSessao()}`;
    relogio.definir(em(2 * MINUTO));

    const resultado = await sessaoService.validar(tokenForjado);

    expect(resultado).toEqual({ valida: false, motivo: "SEGREDO_INVALIDO" });
    const linha = await lerSessao(sessaoId);
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
    expect(linha.estado).toBe("ATIVA");
    expect(token).toContain(sessaoId); // o id não é segredo — e não bastou
  });

  it("sessao_id inexistente é inválido", async () => {
    await emitirEmT0();
    const resultado = await sessaoService.validar(`${randomUUID()}.${gerarSegredoSessao()}`);
    expect(resultado).toEqual({ valida: false, motivo: "SESSAO_INEXISTENTE" });
  });

  it.each([
    ["vazio", ""],
    ["sem separador", "sem-separador"],
    ["somente o id", randomUUID()],
    ["id não-UUID", `qualquer-coisa.${gerarSegredoSessao()}`],
    ["nulo", null],
    ["indefinido", undefined],
    ["objeto", { token: "x" }],
  ])("token %s é FAIL-CLOSED (TOKEN_MALFORMADO), sem tocar o banco", async (_rotulo, entrada) => {
    const { sessaoId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    const resultado = await sessaoService.validar(entrada);

    expect(resultado).toEqual({ valida: false, motivo: "TOKEN_MALFORMADO" });
    const linha = await lerSessao(sessaoId);
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
  });

  it("sessão REVOGADA é inválida", async () => {
    const { token } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));
    await sessaoService.revogar(token);

    relogio.definir(em(3 * MINUTO));
    expect(await sessaoService.validar(token)).toEqual({
      valida: false,
      motivo: "SESSAO_REVOGADA",
    });
  });

  it("sessão EXPIRADA é inválida", async () => {
    const { token } = await emitirEmT0();
    relogio.definir(em(20 * MINUTO));
    expect((await sessaoService.validar(token)).valida).toBe(false);

    relogio.definir(em(21 * MINUTO));
    expect(await sessaoService.validar(token)).toEqual({
      valida: false,
      motivo: "SESSAO_EXPIRADA",
    });
  });
});

// ---------------------------------------------------------------------------
// Expiração — `D-2.3D-04` / `D-2.3D-05`
// ---------------------------------------------------------------------------

describe("expiração absoluta (8 h)", () => {
  it("um milissegundo ANTES do limite absoluto a sessão é válida", async () => {
    const { token, sessaoId } = await emitirEmT0();
    // Atividade recente: isola a borda absoluta da borda ociosa.
    await simularAtividadeAnterior(sessaoId, em(8 * HORA - MINUTO));
    relogio.definir(em(8 * HORA - 1));

    expect((await sessaoService.validar(token)).valida).toBe(true);
    expect((await lerSessao(sessaoId)).estado).toBe("ATIVA");
  });

  it("EXATAMENTE no limite absoluto a sessão expira", async () => {
    const { token, sessaoId } = await emitirEmT0();
    await simularAtividadeAnterior(sessaoId, em(8 * HORA - MINUTO));
    relogio.definir(em(8 * HORA));

    expect(await sessaoService.validar(token)).toEqual({
      valida: false,
      motivo: "SESSAO_EXPIRADA",
    });
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.encerradaEm?.toISOString()).toBe(em(8 * HORA).toISOString());
  });

  it("DEPOIS do limite absoluto a sessão expira", async () => {
    const { token, sessaoId } = await emitirEmT0();
    await simularAtividadeAnterior(sessaoId, em(8 * HORA - MINUTO));
    relogio.definir(em(8 * HORA + 1));

    expect((await sessaoService.validar(token)).valida).toBe(false);
    expect((await lerSessao(sessaoId)).estado).toBe("EXPIRADA");
  });
});

describe("expiração por inatividade (15 min)", () => {
  it("um milissegundo ANTES de 15 min ociosos a sessão é válida", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(15 * MINUTO - 1));

    expect((await sessaoService.validar(token)).valida).toBe(true);
    expect((await lerSessao(sessaoId)).estado).toBe("ATIVA");
  });

  it("EXATAMENTE em 15 min ociosos a sessão expira", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(15 * MINUTO));

    expect(await sessaoService.validar(token)).toEqual({
      valida: false,
      motivo: "SESSAO_EXPIRADA",
    });
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.encerradaEm?.toISOString()).toBe(em(15 * MINUTO).toISOString());
  });

  it("DEPOIS de 15 min ociosos a sessão expira", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(15 * MINUTO + 1));

    expect((await sessaoService.validar(token)).valida).toBe(false);
    expect((await lerSessao(sessaoId)).estado).toBe("EXPIRADA");
    expect(POLITICA_SESSAO.timeoutOciosoMs).toBe(15 * MINUTO);
  });

  it("a atividade renova a janela ociosa, mas NUNCA além do teto absoluto", async () => {
    const { token, sessaoId } = await emitirEmT0();
    // Sucessivas atividades dentro da janela ociosa mantêm a sessão viva...
    for (let passo = 1; passo <= 4; passo += 1) {
      relogio.definir(em(passo * 14 * MINUTO));
      expect((await sessaoService.validar(token)).valida).toBe(true);
    }
    // ...e ainda assim o teto absoluto continua o mesmo instante de sempre.
    const linha = await lerSessao(sessaoId);
    expect(linha.expiraEm.toISOString()).toBe(em(8 * HORA).toISOString());
  });
});

describe("expiração — persistência da detecção", () => {
  it("a detecção PERSISTE o estado EXPIRADA e preenche encerrada_em", async () => {
    const { token, sessaoId } = await emitirEmT0();
    expect((await lerSessao(sessaoId)).estado).toBe("ATIVA");

    relogio.definir(em(30 * MINUTO));
    await sessaoService.validar(token);

    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.encerradaEm?.toISOString()).toBe(em(30 * MINUTO).toISOString());
    expect(linha.revogadaPorUsuarioId).toBeNull();
  });

  it("uma segunda detecção não reescreve encerrada_em nem ressuscita a sessão", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(30 * MINUTO));
    await sessaoService.validar(token);
    const primeira = await lerSessao(sessaoId);

    relogio.definir(em(31 * MINUTO));
    expect((await sessaoService.validar(token)).valida).toBe(false);
    relogio.definir(em(5 * MINUTO)); // relógio "recuado": nem assim revive
    expect((await sessaoService.validar(token)).valida).toBe(false);

    const depois = await lerSessao(sessaoId);
    expect(depois.estado).toBe("EXPIRADA");
    expect(depois.encerradaEm?.toISOString()).toBe(primeira.encerradaEm?.toISOString());
  });

  it("a atividade NUNCA altera expira_em", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const antes = await lerSessao(sessaoId);

    relogio.definir(em(2 * MINUTO));
    await sessaoService.validar(token);
    relogio.definir(em(10 * MINUTO));
    await sessaoService.validar(token);

    const depois = await lerSessao(sessaoId);
    expect(depois.expiraEm.toISOString()).toBe(antes.expiraEm.toISOString());
    expect(depois.ultimaAtividadeEm.toISOString()).toBe(em(10 * MINUTO).toISOString());
  });
});

// ---------------------------------------------------------------------------
// Logout / revogação — `D-2.3D-05`
// ---------------------------------------------------------------------------

describe("logout", () => {
  it("ATIVA -> REVOGADA, com revogada_por = o próprio usuário e encerrada_em preenchido", async () => {
    const { token, sessaoId, usuarioId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    const resultado = await sessaoService.revogar(token);

    expect(resultado).toEqual({
      revogada: true,
      sessaoId,
      usuarioId,
      encerradaEm: em(2 * MINUTO),
    });
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("REVOGADA");
    expect(linha.revogadaPorUsuarioId).toBe(usuarioId);
    expect(linha.encerradaEm?.toISOString()).toBe(em(2 * MINUTO).toISOString());
  });

  it("chamada repetida não ressuscita nem corrompe o estado", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));
    await sessaoService.revogar(token);
    const primeira = await lerSessao(sessaoId);

    relogio.definir(em(5 * MINUTO));
    expect(await sessaoService.revogar(token)).toEqual({
      revogada: false,
      motivo: "SESSAO_REVOGADA",
    });

    const depois = await lerSessao(sessaoId);
    expect(depois.estado).toBe("REVOGADA");
    expect(depois.encerradaEm?.toISOString()).toBe(primeira.encerradaEm?.toISOString());
    expect(depois.revogadaPorUsuarioId).toBe(primeira.revogadaPorUsuarioId);
  });

  it("sessão já EXPIRADA não vira REVOGADA silenciosamente", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(20 * MINUTO));
    await sessaoService.validar(token); // detecta e persiste EXPIRADA

    relogio.definir(em(21 * MINUTO));
    expect(await sessaoService.revogar(token)).toEqual({
      revogada: false,
      motivo: "SESSAO_EXPIRADA",
    });
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.revogadaPorUsuarioId).toBeNull();
  });

  it("sessão ociosamente vencida mas ainda ATIVA é fechada como EXPIRADA, não REVOGADA", async () => {
    const { token, sessaoId } = await emitirEmT0();
    expect((await lerSessao(sessaoId)).estado).toBe("ATIVA");

    relogio.definir(em(20 * MINUTO));
    expect(await sessaoService.revogar(token)).toEqual({
      revogada: false,
      motivo: "SESSAO_EXPIRADA",
    });
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.revogadaPorUsuarioId).toBeNull();
    expect(linha.encerradaEm?.toISOString()).toBe(em(20 * MINUTO).toISOString());
  });

  it("logout exige POSSE do segredo — o sessao_id sozinho não revoga", async () => {
    const { sessaoId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    expect(await sessaoService.revogar(`${sessaoId}.${gerarSegredoSessao()}`)).toEqual({
      revogada: false,
      motivo: "SEGREDO_INVALIDO",
    });
    expect((await lerSessao(sessaoId)).estado).toBe("ATIVA");
  });

  it("token malformado e sessão inexistente são FAIL-CLOSED", async () => {
    expect(await sessaoService.revogar("")).toEqual({
      revogada: false,
      motivo: "TOKEN_MALFORMADO",
    });
    expect(await sessaoService.revogar(`${randomUUID()}.${gerarSegredoSessao()}`)).toEqual({
      revogada: false,
      motivo: "SESSAO_INEXISTENTE",
    });
  });
});

// ---------------------------------------------------------------------------
// Throttle — `D-2.3D-04`
// ---------------------------------------------------------------------------

describe("throttle de atividade (~1 write/min)", () => {
  it("atividade válida ANTES de 1 minuto não produz escrita — e a sessão continua aceita", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(MINUTO - 1));

    const resultado = await sessaoService.validar(token);

    expect(resultado.valida).toBe(true);
    if (!resultado.valida) throw new Error("inalcançável");
    expect(resultado.atividadeRegistrada).toBe(false);
    const linha = await lerSessao(sessaoId);
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
  });

  it("nenhuma VERSÃO DE LINHA nova é criada quando a escrita é throttled (xmin estável)", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const versaoInicial = await lerVersaoDaLinha(sessaoId);

    for (const instante of [em(1), em(10_000), em(MINUTO - 1)]) {
      relogio.definir(instante);
      expect((await sessaoService.validar(token)).valida).toBe(true);
    }

    expect(await lerVersaoDaLinha(sessaoId)).toBe(versaoInicial);
  });

  it("EXATAMENTE em 1 minuto a atividade é escrita", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(MINUTO));

    const resultado = await sessaoService.validar(token);

    expect(resultado.valida).toBe(true);
    if (!resultado.valida) throw new Error("inalcançável");
    expect(resultado.atividadeRegistrada).toBe(true);
    expect((await lerSessao(sessaoId)).ultimaAtividadeEm.toISOString()).toBe(em(MINUTO).toISOString());
  });

  it("o throttle NÃO estende expira_em nem impede a expiração ociosa", async () => {
    const { token, sessaoId } = await emitirEmT0();

    // Muitas requisições dentro da janela de throttle: nenhuma escreve...
    for (const ms of [1, 2, 3, 10, 30_000, 59_999]) {
      relogio.definir(em(ms));
      expect((await sessaoService.validar(token)).valida).toBe(true);
    }
    expect((await lerSessao(sessaoId)).ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());

    // ...e, por isso mesmo, a ociosidade continua contando a partir de T0.
    relogio.definir(em(15 * MINUTO));
    expect((await sessaoService.validar(token)).valida).toBe(false);
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.expiraEm.toISOString()).toBe(em(8 * HORA).toISOString());
  });
});

async function lerVersaoDaLinha(sessaoId: string): Promise<string> {
  const linhas = await database.transacao(async (tx) =>
    tx.$queryRaw<Array<{ versao: string }>>`
      SELECT xmin::text AS versao FROM sessao_autenticacao WHERE id = ${sessaoId}::uuid
    `,
  );
  const versao = linhas[0]?.versao;
  if (versao === undefined) throw new Error("sessão não encontrada ao ler a versão da linha");
  return versao;
}

// ---------------------------------------------------------------------------
// `R-2.3D-03` — atomicidade e monotonicidade sob concorrência REAL
// ---------------------------------------------------------------------------

/**
 * Bloqueia a linha da sessão numa transação própria, executa `duranteBloqueio`
 * enquanto o lock está tomado, e só então aplica `mutacaoAntesDoCommit` e
 * comita — liberando quem estiver esperando.
 *
 * A corrida é EXERCIDA DE FATO: `esperarStatementBloqueado` falha o teste se o
 * UPDATE concorrente jamais entrar em espera de lock. Sem essa checagem, um
 * "passou" poderia significar apenas que as duas operações se serializaram por
 * acaso, sem disputa alguma.
 */
async function comLinhaBloqueada(
  sessaoId: string,
  opcoes: {
    duranteBloqueio: () => void;
    mutacaoAntesDoCommit: (tx: TransacaoPersistencia) => Promise<void>;
  },
): Promise<void> {
  let sinalizarLockTomado!: () => void;
  const lockTomado = new Promise<void>((resolver) => {
    sinalizarLockTomado = resolver;
  });
  let liberar!: () => void;
  const barreira = new Promise<void>((resolver) => {
    liberar = resolver;
  });

  const transacaoBloqueadora = database.transacao(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM sessao_autenticacao WHERE id = ${sessaoId}::uuid FOR UPDATE
    `;
    sinalizarLockTomado();
    await barreira;
    await opcoes.mutacaoAntesDoCommit(tx);
  });

  await lockTomado;
  opcoes.duranteBloqueio();
  await esperarStatementBloqueado();
  liberar();
  await transacaoBloqueadora;
}

/** Quantos statements de OUTRAS conexões estão esperando lock nesta tabela. */
async function contarStatementsBloqueados(): Promise<number> {
  const linhas = await database.transacao(async (tx) =>
    tx.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total
        FROM pg_stat_activity
       WHERE datname         = current_database()
         AND wait_event_type = 'Lock'
         AND pid            <> pg_backend_pid()
         AND query ILIKE '%sessao_autenticacao%'
    `,
  );
  return Number(linhas[0]?.total ?? 0n);
}

async function esperarStatementBloqueado(): Promise<void> {
  for (let tentativa = 0; tentativa < 150; tentativa += 1) {
    if ((await contarStatementsBloqueados()) > 0) return;
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
  throw new Error(
    "o UPDATE concorrente nunca entrou em espera de lock: a corrida de R-2.3D-03 não foi exercida",
  );
}

describe("R-2.3D-03 — atividade atomicamente monotônica", () => {
  it("um candidato ANTIGO bloqueado por um candidato NOVO não faz ultima_atividade_em regredir", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const candidatoAntigo = em(2 * MINUTO);
    const candidatoNovo = em(5 * MINUTO);

    let validacaoAntiga!: ReturnType<typeof sessaoService.validar>;

    await comLinhaBloqueada(sessaoId, {
      duranteBloqueio: () => {
        // O candidato ANTIGO parte de ultima_atividade_em = T0 e, sozinho,
        // passaria no throttle — ele SÓ é barrado pelo valor mais novo que
        // será commitado enquanto ele espera no lock.
        relogio.definir(candidatoAntigo);
        validacaoAntiga = sessaoService.validar(token);
      },
      mutacaoAntesDoCommit: async (tx) => {
        await tx.$executeRaw`
          UPDATE sessao_autenticacao
             SET ultima_atividade_em = ${candidatoNovo}::timestamptz
           WHERE id = ${sessaoId}::uuid
        `;
      },
    });

    const resultado = await validacaoAntiga;

    // A requisição antiga continua sendo uma requisição VÁLIDA...
    expect(resultado.valida).toBe(true);
    if (!resultado.valida) throw new Error("inalcançável");
    // ...mas não escreveu nada...
    expect(resultado.atividadeRegistrada).toBe(false);
    // ...e o valor persistido é o MAIS NOVO, não o mais antigo.
    const linha = await lerSessao(sessaoId);
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(candidatoNovo.toISOString());
    expect(linha.ultimaAtividadeEm.getTime()).toBeGreaterThan(candidatoAntigo.getTime());
    expect(linha.estado).toBe("ATIVA");
  });

  it("N atualizações concorrentes FORA DE ORDEM convergem para o maior instante válido", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const candidatos = [
      em(10 * MINUTO),
      em(2 * MINUTO),
      em(8 * MINUTO),
      em(4 * MINUTO),
      em(6 * MINUTO),
    ];

    const resultados = await Promise.all(
      candidatos.map((instante) => {
        // `validar` lê o relógio SINCRONAMENTE, antes do primeiro await:
        // cada chamada carrega o seu próprio candidato.
        relogio.definir(instante);
        return sessaoService.validar(token);
      }),
    );

    expect(resultados.every((r) => r.valida)).toBe(true);
    const linha = await lerSessao(sessaoId);
    const maior = candidatos.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(maior.toISOString());
    expect(linha.estado).toBe("ATIVA");
  });

  it("a CHECK física continua satisfeita: criada_em <= ultima_atividade_em <= expira_em", async () => {
    const { token, sessaoId } = await emitirEmT0();
    for (const ms of [MINUTO, 3 * MINUTO, 7 * MINUTO, 12 * MINUTO]) {
      relogio.definir(em(ms));
      await sessaoService.validar(token);
    }
    const linha = await lerSessao(sessaoId);
    expect(linha.criadaEm.getTime()).toBeLessThanOrEqual(linha.ultimaAtividadeEm.getTime());
    expect(linha.ultimaAtividadeEm.getTime()).toBeLessThanOrEqual(linha.expiraEm.getTime());
  });
});

describe("concorrência — estados terminais", () => {
  it("dois logouts concorrentes: exatamente um revoga, e nada é corrompido", async () => {
    const { token, sessaoId, usuarioId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    const resultados = await Promise.all([
      sessaoService.revogar(token),
      sessaoService.revogar(token),
    ]);

    expect(resultados.filter((r) => r.revogada)).toHaveLength(1);
    expect(resultados.filter((r) => !r.revogada)).toHaveLength(1);
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("REVOGADA");
    expect(linha.revogadaPorUsuarioId).toBe(usuarioId);
    expect(linha.encerradaEm?.toISOString()).toBe(em(2 * MINUTO).toISOString());
  });

  it("duas detecções concorrentes de expiração: um único encerramento", async () => {
    const { token, sessaoId } = await emitirEmT0();
    relogio.definir(em(20 * MINUTO));

    const resultados = await Promise.all([
      sessaoService.validar(token),
      sessaoService.validar(token),
    ]);

    expect(resultados.every((r) => !r.valida)).toBe(true);
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.encerradaEm?.toISOString()).toBe(em(20 * MINUTO).toISOString());
  });

  it("atividade × logout concorrentes: o estado terminal vence e nunca volta a ATIVA", async () => {
    const { token, sessaoId, usuarioId } = await emitirEmT0();
    relogio.definir(em(2 * MINUTO));

    await Promise.all([sessaoService.validar(token), sessaoService.revogar(token)]);

    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("REVOGADA");
    expect(linha.revogadaPorUsuarioId).toBe(usuarioId);

    relogio.definir(em(3 * MINUTO));
    expect(await sessaoService.validar(token)).toEqual({
      valida: false,
      motivo: "SESSAO_REVOGADA",
    });
  });

  it("atividade × expiração concorrentes: a sessão termina EXPIRADA e não é reanimada", async () => {
    const { token, sessaoId } = await emitirEmT0();

    relogio.definir(em(16 * MINUTO));
    const expiracao = sessaoService.validar(token);
    relogio.definir(em(17 * MINUTO));
    const atividade = sessaoService.validar(token);
    const resultados = await Promise.all([expiracao, atividade]);

    expect(resultados.every((r) => !r.valida)).toBe(true);
    const linha = await lerSessao(sessaoId);
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
  });

  it("nenhum caminho leva EXPIRADA ou REVOGADA de volta a ATIVA", async () => {
    const expirada = await emitirEmT0();
    relogio.definir(em(20 * MINUTO));
    await sessaoService.validar(expirada.token);

    const revogada = await emitirEmT0();
    relogio.definir(em(MINUTO));
    await sessaoService.revogar(revogada.token);

    // Todo o restante da superfície pública, em qualquer instante plausível.
    for (const instante of [em(0), em(MINUTO), em(2 * HORA), em(9 * HORA)]) {
      relogio.definir(instante);
      for (const alvo of [expirada, revogada]) {
        expect((await sessaoService.validar(alvo.token)).valida).toBe(false);
        expect((await sessaoService.revogar(alvo.token)).revogada).toBe(false);
      }
    }

    expect((await lerSessao(expirada.sessaoId)).estado).toBe("EXPIRADA");
    expect((await lerSessao(revogada.sessaoId)).estado).toBe("REVOGADA");
  });
});

// ---------------------------------------------------------------------------
// `A-01` — regressão da corrida de logout encontrada pela revisão independente
// ---------------------------------------------------------------------------

/**
 * Executa `corpo` posicionando `intromissao` DETERMINISTICAMENTE entre o
 * primeiro e o segundo `$executeRaw` da transação que `corpo` abrir.
 *
 * POR QUE INSTRUMENTAR: a corrida de `A-01` acontece entre dois statements da
 * MESMA transação, e num ponto em que a linha NÃO está travada — um UPDATE que
 * casa zero linhas não adquire lock. Logo ela não é alcançável pela barreira de
 * lock usada nos testes de `R-2.3D-03`: não há lock em que esperar. A janela é
 * de um round-trip e, sem posicionamento explícito, o teste seria uma loteria.
 *
 * A instrumentação vive INTEIRAMENTE no teste: envolve `DatabaseService` por
 * fora, via `jest.spyOn` + `Proxy` sobre o cliente transacional. NENHUM hook,
 * flag ou ponto de extensão foi acrescentado ao código de produção — o
 * `SessaoService` exercitado aqui é exatamente o que roda em produção.
 */
async function comIntromissaoEntreStatements<T>(
  intromissao: () => Promise<void>,
  corpo: () => Promise<T>,
): Promise<T> {
  const transacaoOriginal = database.transacao.bind(database);
  let armado = true;
  const espiao = jest
    .spyOn(database, "transacao")
    .mockImplementation(async (recebido: (tx: never) => Promise<unknown>) => {
      if (!armado) return transacaoOriginal(recebido as never);
      armado = false; // instrumenta APENAS a primeira transação (a de `corpo`)
      return transacaoOriginal(async (tx) => {
        let statements = 0;
        const proxy = new Proxy(tx as object, {
          get(alvo, prop, receptor) {
            const valor = Reflect.get(alvo, prop, receptor) as unknown;
            if (prop === "$executeRaw" && typeof valor === "function") {
              return async (...args: unknown[]) => {
                const r = await (valor as (...a: unknown[]) => Promise<number>).apply(alvo, args);
                statements += 1;
                if (statements === 1) await intromissao();
                return r;
              };
            }
            return typeof valor === "function"
              ? (valor as (...a: unknown[]) => unknown).bind(alvo)
              : valor;
          },
        });
        return recebido(proxy as never);
      });
    });
  try {
    return await corpo();
  } finally {
    espiao.mockRestore();
  }
}

/**
 * Espera até que a operação concorrente TERMINE ou entre em DISPUTA DE LOCK —
 * o que vier primeiro —, e falha se nenhuma das duas coisas acontecer.
 *
 * Os dois desfechos são informativos e distinguem exatamente os dois regimes:
 *   - TERMINOU sem disputa  -> o statement anterior do logout não travou a
 *                              linha (regime do defeito `A-01`);
 *   - ENTROU EM DISPUTA     -> o statement anterior travou a linha, e a
 *                              atividade concorrente só será reavaliada depois
 *                              do commit (regime corrigido).
 * Em ambos os casos a corrida é REAL — nunca um `sleep` esperançoso.
 */
async function esperarDisputaOuTermino(promessa: Promise<unknown>): Promise<void> {
  let terminou = false;
  const marcar = (): void => {
    terminou = true;
  };
  void promessa.then(marcar, marcar);
  for (let tentativa = 0; tentativa < 200; tentativa += 1) {
    if (terminou) return;
    if ((await contarStatementsBloqueados()) > 0) return;
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
  throw new Error(
    "a operação concorrente não terminou nem entrou em disputa de lock: corrida não exercida",
  );
}

describe("A-01 — logout nunca informa encerramento deixando a sessão viva", () => {
  it("atividade concorrente MAIS ANTIGA intrometida no meio do logout não produz resposta falsa", async () => {
    const { token, sessaoId } = await emitirEmT0(); // ultima_atividade_em = T0

    // `revogar` opera na borda EXATA da ociosidade (T0 + 15 min); a validação
    // concorrente porta um instante 1 ms ANTERIOR — o único regime em que ela
    // conseguiria renovar uma atividade que o logout já considera vencida.
    //
    // A validação concorrente NÃO é aguardada dentro da intromissão: ela
    // representa OUTRA requisição, em outra conexão. Aguardá-la ali dentro
    // travaria o próprio logout contra o lock que a correção passou a manter —
    // que é justamente a propriedade sendo provada.
    let concorrente!: Promise<ResultadoValidacaoSessao>;
    relogio.definir(em(15 * MINUTO));
    const resultado = await comIntromissaoEntreStatements(
      async () => {
        relogio.definir(em(15 * MINUTO - 1));
        concorrente = sessaoService.validar(token); // `agora` é lido aqui
        relogio.definir(em(15 * MINUTO));
        await esperarDisputaOuTermino(concorrente);
      },
      async () => sessaoService.revogar(token),
    );
    await concorrente;

    const linha = await lerSessao(sessaoId);

    // INVARIANTE ESSENCIAL — vale para qualquer desfecho da corrida:
    // a sessão NUNCA permanece utilizável quando o logout não a revogou.
    relogio.definir(em(15 * MINUTO));
    const depois = await sessaoService.validar(token);
    expect(linha.estado).not.toBe("ATIVA");
    expect(depois.valida).toBe(false);

    // ...e a resposta corresponde ao estado realmente persistido.
    if (resultado.revogada) {
      expect(linha.estado).toBe("REVOGADA");
      expect(linha.revogadaPorUsuarioId).toBe(linha.usuarioId);
    } else {
      expect(resultado.motivo).toBe(
        linha.estado === "REVOGADA" ? "SESSAO_REVOGADA" : "SESSAO_EXPIRADA",
      );
    }

    // Desfecho DETERMINÍSTICO desta intercalação: a detecção de expiração roda
    // primeiro e fecha a sessão; a atividade concorrente já não a alcança
    // (todo UPDATE de atividade exige `estado = 'ATIVA'`).
    expect(linha.estado).toBe("EXPIRADA");
    expect(linha.encerradaEm?.toISOString()).toBe(em(15 * MINUTO).toISOString());
    expect(linha.revogadaPorUsuarioId).toBeNull();
    expect(linha.ultimaAtividadeEm.toISOString()).toBe(T0.toISOString());
    expect(resultado).toEqual({ revogada: false, motivo: "SESSAO_EXPIRADA" });
  });

  it("a mesma intromissão sobre sessão NÃO vencida revoga de verdade", async () => {
    const { token, sessaoId, usuarioId } = await emitirEmT0();

    // Controle positivo: sem vencimento em jogo, a intercalação não muda nada
    // e o logout precisa acontecer de fato — a correção não pode ter
    // transformado logout legítimo em "expirada".
    let concorrente!: Promise<ResultadoValidacaoSessao>;
    relogio.definir(em(2 * MINUTO));
    const resultado = await comIntromissaoEntreStatements(
      async () => {
        relogio.definir(em(2 * MINUTO - 1));
        concorrente = sessaoService.validar(token);
        relogio.definir(em(2 * MINUTO));
        await esperarDisputaOuTermino(concorrente);
      },
      async () => sessaoService.revogar(token),
    );
    await concorrente;

    const linha = await lerSessao(sessaoId);
    expect(resultado).toEqual({
      revogada: true,
      sessaoId,
      usuarioId,
      encerradaEm: em(2 * MINUTO),
    });
    expect(linha.estado).toBe("REVOGADA");
    expect(linha.revogadaPorUsuarioId).toBe(usuarioId);
    expect((await sessaoService.validar(token)).valida).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Segurança
// ---------------------------------------------------------------------------

describe("segurança", () => {
  it("nenhuma operação do serviço escreve em console", async () => {
    const { token, sessaoId } = await emitirEmT0();
    const metodos = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const espioes = metodos.map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      const usuarioId = await criarUsuario();
      relogio.definir(em(2 * MINUTO));
      await sessaoService.emitir({ usuarioId });
      await sessaoService.validar(token);
      await sessaoService.validar("lixo");
      await sessaoService.validar(`${sessaoId}.${gerarSegredoSessao()}`);
      await sessaoService.validar(`${randomUUID()}.${gerarSegredoSessao()}`);
      await sessaoService.revogar(token);
      await sessaoService.revogar(token);
      await sessaoService.emitir({ usuarioId: randomUUID() }).catch(() => undefined);
      for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled();
    } finally {
      for (const espiao of espioes) espiao.mockRestore();
    }
  });

  it("os retornos de rejeição carregam APENAS o motivo — nunca token, segredo ou hash", async () => {
    const { token, sessaoId, segredo } = await emitirEmT0();
    const linha = await lerSessao(sessaoId);
    relogio.definir(em(2 * MINUTO));

    const rejeicoes = [
      await sessaoService.validar(""),
      await sessaoService.validar(`${sessaoId}.${gerarSegredoSessao()}`),
      await sessaoService.validar(`${randomUUID()}.${gerarSegredoSessao()}`),
      await sessaoService.revogar("x"),
    ];

    for (const rejeicao of rejeicoes) {
      // Superfície fechada: o discriminante e o motivo, e nada mais.
      const chaves = Object.keys(rejeicao).sort();
      expect(chaves).toHaveLength(2);
      expect(chaves).toContain("motivo");
      const serializada = JSON.stringify(rejeicao);
      expect(serializada).not.toContain(segredo);
      expect(serializada).not.toContain(token);
      expect(serializada).not.toContain(linha.tokenHash);
    }
  });

  it("a mensagem de ErroSessao deriva só do motivo", async () => {
    relogio.definir(T0);
    const erro = await sessaoService
      .emitir({ usuarioId: randomUUID() })
      .then(() => null)
      .catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(ErroSessao);
    expect((erro as ErroSessao).message).toBe(
      "Emissão de sessão rejeitada: USUARIO_INEXISTENTE.",
    );
  });

  it("o resultado de emissão expõe o token composto e NADA além dele", async () => {
    const usuarioId = await criarUsuario();
    relogio.definir(T0);
    const emitida = await sessaoService.emitir({ usuarioId });

    expect(Object.keys(emitida).sort()).toEqual(
      ["criadaEm", "expiraEm", "sessaoId", "token", "ultimaAtividadeEm", "usuarioId"],
    );
    // O segredo NÃO é exposto separadamente, e o verificador nunca sai daqui.
    expect(JSON.stringify(emitida)).not.toContain(calcularVerificadorSessao(
      emitida.token.split(".")[1] as string,
    ));
  });
});
