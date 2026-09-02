// TechLab Fisio — Etapa 2.3D-B / F5 — seed RBAC + bootstrap do primeiro
// Administrador, ponta a ponta contra PostgreSQL REAL.
//
// Caminho provado, sem mock no meio: serviço resolvido do container Nest real
// → `DatabaseService` → cliente real (fábrica pública) → role de runtime
// (`tlf_app`) → PostgreSQL 18 → `papel` / `permissao` / `papel_permissao` /
// `usuario` / `usuario_papel` → `AuditContextValidator` → `evento_auditoria`.
//
// A prova mais importante da fatia está em "a cadeia inteira": o `catálogo
// semeado` é lido de volta do banco pelo `PermissoesService` da F4 — o MESMO
// que decide autorização em produção. É assim que se mede
// `catálogo seed == catálogo homologado == catálogo usado pelo RBAC`, em
// CONTEÚDO, e não por coincidência de contagem.
//
// Fixtures 100% sintéticas; limpeza determinística entre testes (setup-db).

import { randomUUID } from "node:crypto";

import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";

import { AuditWriter } from "../../src/audit/audit-writer.js";
import { CredencialService } from "../../src/auth/credencial.service.js";
import { AuthzModule } from "../../src/authz/authz.module.js";
import { PermissoesService } from "../../src/authz/permissoes.service.js";
import { PERMISSOES } from "../../src/authz/permissoes.catalogo.js";
import { DatabaseService } from "../../src/database/database.service.js";
import {
  BootstrapAdministradorService,
  ErroBootstrapAdministrador,
} from "../../src/provisionamento/bootstrap-administrador.service.js";
import {
  ASSOCIACOES_SEED,
  DESCRICAO_PERMISSAO,
  MATRIZ_RBAC,
  PAPEIS,
} from "../../src/provisionamento/catalogo-rbac.js";
import { BootstrapModule } from "../../src/provisionamento/bootstrap.module.js";
import { SeedModule } from "../../src/provisionamento/seed.module.js";
import { SeedRbacService } from "../../src/provisionamento/seed-rbac.service.js";
import { limparTabelasDeDominio } from "./helpers-integracao.js";

let moduleRef: TestingModule;
let app: INestApplication;
let database: DatabaseService;
let seed: SeedRbacService;
let bootstrap: BootstrapAdministradorService;
let permissoes: PermissoesService;
let credenciais: CredencialService;
let auditWriter: AuditWriter;

beforeAll(async () => {
  // `AuthzModule` entra para que a prova da cadeia use o MESMO
  // `PermissoesService` que o RBAC de produção usa — não uma cópia.
  moduleRef = await Test.createTestingModule({
    imports: [SeedModule, BootstrapModule, AuthzModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  database = moduleRef.get(DatabaseService);
  seed = moduleRef.get(SeedRbacService);
  bootstrap = moduleRef.get(BootstrapAdministradorService);
  permissoes = moduleRef.get(PermissoesService);
  credenciais = moduleRef.get(CredencialService);
  auditWriter = moduleRef.get(AuditWriter);
});

afterAll(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Leituras diretas da persistência (a fonte de verdade das asserções)
// ---------------------------------------------------------------------------

async function contarTudo(): Promise<{
  papeis: number;
  permissoes: number;
  vinculos: number;
  usuarios: number;
  usuarioPapeis: number;
  eventos: number;
}> {
  return database.transacao(async (tx) => ({
    papeis: await tx.papel.count(),
    permissoes: await tx.permissao.count(),
    vinculos: await tx.papelPermissao.count(),
    usuarios: await tx.usuario.count(),
    usuarioPapeis: await tx.usuarioPapel.count(),
    eventos: await tx.eventoAuditoria.count(),
  }));
}

/** Matriz EFETIVAMENTE persistida, lida por join e normalizada. */
async function matrizPersistida(): Promise<Record<string, string[]>> {
  const papeis = await database.transacao(async (tx) =>
    tx.papel.findMany({
      select: {
        codigo: true,
        permissoes: { select: { permissao: { select: { codigo: true } } } },
      },
    }),
  );
  const matriz: Record<string, string[]> = {};
  for (const papel of papeis) {
    matriz[papel.codigo] = papel.permissoes
      .map((vinculo) => vinculo.permissao.codigo)
      .sort();
  }
  return matriz;
}

function matrizEsperada(): Record<string, string[]> {
  const esperada: Record<string, string[]> = {};
  for (const papel of PAPEIS) esperada[papel.codigo] = [...MATRIZ_RBAC[papel.codigo]].sort();
  return esperada;
}

async function lerEventos() {
  return database.transacao(async (tx) =>
    tx.eventoAuditoria.findMany({ orderBy: { criadoEm: "asc" } }),
  );
}

/**
 * Limpeza entre RODADAS dentro de um mesmo `it`. O `setup-db` limpa entre
 * testes (afterEach); os cenários concorrentes repetem várias rodadas no
 * mesmo teste e precisam do estado zerado a cada uma.
 */
async function limparParaRodada(): Promise<void> {
  await limparTabelasDeDominio();
}

const SENHA_SINTETICA = "senha-sintetica-f5-bootstrap-9x7";

const JUSTIFICATIVA_SINTETICA = "provisionamento inicial - chamado SINTETICO-001";

function comandoAdmin(
  sobrescritas?: Partial<{
    email: string;
    nome: string;
    senha: string;
    justificativa: string;
  }>,
) {
  return {
    email: sobrescritas?.email ?? "admin.f5@sintetico.local",
    nome: sobrescritas?.nome ?? "Administrador Sintético F5",
    senha: sobrescritas?.senha ?? SENHA_SINTETICA,
    justificativa: sobrescritas?.justificativa ?? JUSTIFICATIVA_SINTETICA,
  };
}

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

describe("`D-2.3D-09` — seed do catálogo RBAC sobre banco vazio", () => {
  it("cria exatamente 4 papéis, 29 permissões e 37 associações", async () => {
    // Não vacuidade: o banco começa limpo (setup-db trunca entre testes).
    expect(await contarTudo()).toMatchObject({ papeis: 0, permissoes: 0, vinculos: 0 });

    const resultado = await seed.executar();
    expect(resultado.papeisCriados).toBe(4);
    expect(resultado.permissoesCriadas).toBe(PERMISSOES.length);
    expect(resultado.associacoesCriadas).toBe(ASSOCIACOES_SEED.length);
    expect(resultado.papeisAtualizados).toBe(0);
    expect(resultado.permissoesAtualizadas).toBe(0);
    expect(resultado.jaConforme).toBe(false);

    const contagens = await contarTudo();
    expect(contagens.papeis).toBe(4);
    expect(contagens.permissoes).toBe(29);
    expect(contagens.vinculos).toBe(37);
  });

  it("os papéis persistidos são EXATAMENTE os quatro de `docs/04` §3", async () => {
    await seed.executar();
    const persistidos = await database.transacao(async (tx) =>
      tx.papel.findMany({ select: { codigo: true, nome: true }, orderBy: { codigo: "asc" } }),
    );
    expect(persistidos).toEqual(
      [...PAPEIS].map((p) => ({ codigo: p.codigo, nome: p.nome })).sort((a, b) =>
        a.codigo.localeCompare(b.codigo),
      ),
    );
  });

  it("as permissões persistidas são EXATAMENTE o catálogo homologado, com as descrições da fonte", async () => {
    await seed.executar();
    const persistidas = await database.transacao(async (tx) =>
      tx.permissao.findMany({ select: { codigo: true, nome: true } }),
    );
    // Conjunto exato: nenhuma faltante, nenhuma excedente, nenhuma duplicada.
    expect(persistidas.map((p) => p.codigo).sort()).toEqual([...PERMISSOES].sort());
    expect(new Set(persistidas.map((p) => p.codigo)).size).toBe(persistidas.length);
    for (const permissao of persistidas) {
      expect(permissao.nome).toBe(
        DESCRICAO_PERMISSAO[permissao.codigo as keyof typeof DESCRICAO_PERMISSAO],
      );
    }
  });

  it("a matriz PERSISTIDA é a matriz homologada, papel a papel", async () => {
    await seed.executar();
    expect(await matrizPersistida()).toEqual(matrizEsperada());
  });

  it("PERM-T01 — o Administrador NÃO recebe permissão clínica alguma no banco", async () => {
    await seed.executar();
    const clinicas = await database.transacao(async (tx) =>
      tx.papelPermissao.count({
        where: {
          papel: { codigo: "ADMINISTRADOR" },
          permissao: { codigo: { startsWith: "prontuario." } },
        },
      }),
    );
    expect(clinicas).toBe(0);
  });

  it("HOM-01 — o Gestor tem no banco somente as três permissões de leitura", async () => {
    await seed.executar();
    const doGestor = (await matrizPersistida())["GESTOR"];
    expect(doGestor).toEqual([
      "financeiro.relatorio.ler",
      "indicadores.globais.ler",
      "pacientes.localizar",
    ]);
  });

  it("as permissões `P` de `docs/04` §8 não pertencem a papel algum no banco", async () => {
    await seed.executar();
    const sensiveis = [
      "prontuario.retificar_proprio",
      "prontuario.retificar_terceiro",
      "prontuario.exportar",
      "pacotes.ajustar_sessao",
      "financeiro.desconto.aplicar",
      "financeiro.cobranca.cancelar",
      "financeiro.pagamento.estornar",
      "indicadores.proprios.ler",
    ];
    const vinculos = await database.transacao(async (tx) =>
      tx.papelPermissao.count({ where: { permissao: { codigo: { in: sensiveis } } } }),
    );
    expect(vinculos).toBe(0);
    // Controle positivo: as permissões EXISTEM, apenas não estão associadas.
    const existentes = await database.transacao(async (tx) =>
      tx.permissao.count({ where: { codigo: { in: sensiveis } } }),
    );
    expect(existentes).toBe(sensiveis.length);
  });
});

describe("`D-2.3D-09` — idempotência do seed", () => {
  it("a segunda execução não escreve NADA e devolve `jaConforme`", async () => {
    await seed.executar();
    const antes = await contarTudo();

    const segunda = await seed.executar();
    expect(segunda).toEqual({
      papeisCriados: 0,
      papeisAtualizados: 0,
      permissoesCriadas: 0,
      permissoesAtualizadas: 0,
      associacoesCriadas: 0,
      jaConforme: true,
      divergencias: {
        papeisDesconhecidos: 0,
        permissoesDesconhecidas: 0,
        associacoesExcedentes: 0,
        associacoesExcedentesCanonicas: [],
        total: 0,
      },
    });
    expect(await contarTudo()).toEqual(antes);
  });

  it("a terceira execução também é estável — nenhuma duplicata acumulada", async () => {
    await seed.executar();
    await seed.executar();
    await seed.executar();
    const contagens = await contarTudo();
    expect(contagens.papeis).toBe(4);
    expect(contagens.permissoes).toBe(29);
    expect(contagens.vinculos).toBe(37);
    expect(await matrizPersistida()).toEqual(matrizEsperada());
  });

  it("banco PARCIALMENTE semeado converge sem duplicar registro algum", async () => {
    // Estado parcial artificial: um papel, três permissões e UMA associação.
    await database.transacao(async (tx) => {
      const papel = await tx.papel.create({
        data: { codigo: "GESTOR", nome: "Gestor" },
      });
      const permissao = await tx.permissao.create({
        data: {
          codigo: "indicadores.globais.ler",
          nome: DESCRICAO_PERMISSAO["indicadores.globais.ler"],
        },
      });
      await tx.permissao.create({
        data: { codigo: "auditoria.ler", nome: DESCRICAO_PERMISSAO["auditoria.ler"] },
      });
      await tx.permissao.create({
        data: {
          codigo: "pacientes.localizar",
          nome: DESCRICAO_PERMISSAO["pacientes.localizar"],
        },
      });
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
    });

    const resultado = await seed.executar();
    expect(resultado.papeisCriados).toBe(3);
    expect(resultado.permissoesCriadas).toBe(26);
    expect(resultado.associacoesCriadas).toBe(36);
    expect(resultado.jaConforme).toBe(false);

    const contagens = await contarTudo();
    expect(contagens.papeis).toBe(4);
    expect(contagens.permissoes).toBe(29);
    expect(contagens.vinculos).toBe(37);
    expect(await matrizPersistida()).toEqual(matrizEsperada());
  });

  it("`nome` divergente converge para a fonte — e SOMENTE `nome`", async () => {
    await database.transacao(async (tx) => {
      await tx.papel.create({ data: { codigo: "ADMINISTRADOR", nome: "Admin (legado)" } });
      await tx.permissao.create({
        data: { codigo: "auditoria.ler", nome: "descrição antiga" },
      });
    });

    const resultado = await seed.executar();
    expect(resultado.papeisAtualizados).toBe(1);
    expect(resultado.permissoesAtualizadas).toBe(1);
    expect(resultado.papeisCriados).toBe(3);

    const papel = await database.transacao(async (tx) =>
      tx.papel.findUniqueOrThrow({ where: { codigo: "ADMINISTRADOR" } }),
    );
    expect(papel.nome).toBe("Administrador");
    const permissao = await database.transacao(async (tx) =>
      tx.permissao.findUniqueOrThrow({ where: { codigo: "auditoria.ler" } }),
    );
    expect(permissao.nome).toBe(DESCRICAO_PERMISSAO["auditoria.ler"]);

    // E a execução seguinte volta a ser um no-op.
    expect((await seed.executar()).jaConforme).toBe(true);
  });

  it("o seed é ADITIVO — uma concessão `P` posterior NÃO é revogada", async () => {
    // Propriedade DECLARADA (não defeito): `docs/04` §4 marca `P` operações
    // cuja concessão é ato posterior de um Administrador. Um seed destrutivo
    // as revogaria silenciosamente a cada execução.
    await seed.executar();
    await database.transacao(async (tx) => {
      const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
      const permissao = await tx.permissao.findUniqueOrThrow({
        where: { codigo: "pacotes.ajustar_sessao" },
      });
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
    });

    const resultado = await seed.executar();
    // Nada foi removido — o seed continua aditivo...
    expect(resultado.associacoesCriadas).toBe(0);
    expect((await matrizPersistida())["GESTOR"]).toContain("pacotes.ajustar_sessao");
    expect(await contarTudo()).toMatchObject({ vinculos: 38 });
    // ...mas a divergência DEIXOU de ser silenciosa (`F5-R-02`): antes desta
    // rodada o resultado era `jaConforme: true`, que o operador lia como
    // "banco conforme" mesmo com HOM-01 violado no estado persistido.
    expect(resultado.jaConforme).toBe(false);
    expect(resultado.divergencias.associacoesExcedentes).toBe(1);
    expect(resultado.divergencias.associacoesExcedentesCanonicas).toEqual([
      "GESTOR -> pacotes.ajustar_sessao",
    ]);
    expect(resultado.divergencias.total).toBe(1);
  });
});

describe("a cadeia inteira — seed lido de volta pelo RBAC da F4", () => {
  it("um usuário com papel Administrador resolve EXATAMENTE as 18 permissões semeadas", async () => {
    await seed.executar();
    const usuarioId = await database.transacao(async (tx) => {
      const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "ADMINISTRADOR" } });
      const usuario = await tx.usuario.create({
        data: {
          email: `cadeia-${randomUUID().slice(0, 8)}@sintetico.local`,
          senhaHash: "hash-sintetico-cadeia",
          nome: "Usuário da Cadeia",
          ativo: true,
        },
      });
      await tx.usuarioPapel.create({ data: { usuarioId: usuario.id, papelId: papel.id } });
      return usuario.id;
    });

    const resolucao = await permissoes.resolverDoUsuario(usuarioId);
    expect(resolucao.resolvido).toBe(true);
    if (!resolucao.resolvido) throw new Error("resolução inesperada");
    expect([...resolucao.permissoes]).toEqual([...MATRIZ_RBAC.ADMINISTRADOR].sort());
    expect(resolucao.permissoes).toHaveLength(18);
    // Prova de conteúdo, não de contagem: nenhuma permissão clínica.
    expect(resolucao.permissoes.filter((p) => p.startsWith("prontuario."))).toEqual([]);
  });

  it("cada um dos quatro papéis resolve exatamente sua linha da matriz", async () => {
    await seed.executar();
    for (const papelDefinido of PAPEIS) {
      const usuarioId = await database.transacao(async (tx) => {
        const papel = await tx.papel.findUniqueOrThrow({
          where: { codigo: papelDefinido.codigo },
        });
        const usuario = await tx.usuario.create({
          data: {
            email: `${papelDefinido.codigo.toLowerCase()}-${randomUUID().slice(0, 8)}@sintetico.local`,
            senhaHash: "hash-sintetico-papel",
            nome: `Usuário ${papelDefinido.nome}`,
            ativo: true,
          },
        });
        await tx.usuarioPapel.create({ data: { usuarioId: usuario.id, papelId: papel.id } });
        return usuario.id;
      });
      const resolucao = await permissoes.resolverDoUsuario(usuarioId);
      if (!resolucao.resolvido) throw new Error("resolução inesperada");
      expect([...resolucao.permissoes]).toEqual([...MATRIZ_RBAC[papelDefinido.codigo]].sort());
    }
  });

  it("todo código semeado é reconhecido pelo catálogo tipado do RBAC — e vice-versa", async () => {
    await seed.executar();
    const doBanco = await database.transacao(async (tx) =>
      tx.permissao.findMany({ select: { codigo: true } }),
    );
    // Igualdade de CONJUNTO, nos dois sentidos — não `29 === 29`.
    const noBanco = new Set(doBanco.map((p) => p.codigo));
    const noCatalogo = new Set<string>(PERMISSOES);
    expect([...noBanco].filter((c) => !noCatalogo.has(c))).toEqual([]);
    expect([...noCatalogo].filter((c) => !noBanco.has(c))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BOOTSTRAP
// ---------------------------------------------------------------------------

describe("`D-2.3D-10` — bootstrap do primeiro Administrador", () => {
  it("banco semeado e sem Administrador: cria usuário, atribui papel e audita", async () => {
    await seed.executar();
    const resultado = await bootstrap.executar(comandoAdmin());

    expect(resultado.desfecho).toBe("USUARIO_CRIADO");
    expect(resultado.correlacaoId).not.toBeNull();

    const usuario = await database.transacao(async (tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id: resultado.usuarioId } }),
    );
    expect(usuario.email).toBe("admin.f5@sintetico.local");
    expect(usuario.nome).toBe("Administrador Sintético F5");
    expect(usuario.ativo).toBe(true);

    // O papel foi atribuído — e é o Administrador.
    const vinculos = await database.transacao(async (tx) =>
      tx.usuarioPapel.findMany({
        where: { usuarioId: usuario.id },
        select: { papel: { select: { codigo: true } } },
      }),
    );
    expect(vinculos.map((v) => v.papel.codigo)).toEqual(["ADMINISTRADOR"]);

    // Nenhuma sessão de autenticação nasce do bootstrap.
    expect(await database.transacao(async (tx) => tx.sessaoAutenticacao.count())).toBe(0);
  });

  it("a senha é persistida SOMENTE como digest Argon2id da política vigente", async () => {
    await seed.executar();
    const resultado = await bootstrap.executar(comandoAdmin());
    const usuario = await database.transacao(async (tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id: resultado.usuarioId } }),
    );

    // Digest real da política homologada (`D-2.3D-02`), não placeholder.
    expect(usuario.senhaHash.startsWith("$argon2id$")).toBe(true);
    expect(usuario.senhaHash).toContain("m=19456");
    expect(usuario.senhaHash).toContain("t=2");
    expect(usuario.senhaHash).toContain("p=1");
    expect(credenciais.precisaRehash(usuario.senhaHash)).toBe(false);

    // Verifica de verdade — e só a senha correta verifica.
    expect(await credenciais.verificarSenha(usuario.senhaHash, SENHA_SINTETICA)).toBe(true);
    expect(await credenciais.verificarSenha(usuario.senhaHash, "outra-senha")).toBe(false);

    // A senha em claro não aparece em NENHUMA coluna de texto do usuário.
    expect(usuario.senhaHash).not.toContain(SENHA_SINTETICA);
    expect(usuario.nome).not.toContain(SENHA_SINTETICA);
    expect(usuario.email).not.toContain(SENHA_SINTETICA);
  });

  it("o evento é `usuario.papeis.alterados` com os campos homologados", async () => {
    await seed.executar();
    const resultado = await bootstrap.executar(comandoAdmin());

    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    const evento = eventos[0];
    if (evento === undefined) throw new Error("evento ausente");

    expect(evento.acao).toBe("usuario.papeis.alterados");
    expect(evento.resultado).toBe("SUCESSO");
    expect(evento.alvoTipo).toBe("usuario");
    expect(evento.alvoId).toBe(resultado.usuarioId);
    // `F5-R-03`: a justificativa operacional passou a ser OBRIGATÓRIA e é
    // persistida na coluna que `docs/07` §22.3 já previa como livre.
    expect(evento.justificativa).toBe(JUSTIFICATIVA_SINTETICA);
    expect(evento.correlacaoId).toBe(resultado.correlacaoId);
    // Whitelist VAZIA (`D-AUD-07`): contexto ausente => coluna NULL.
    expect(evento.contexto).toBeNull();
    // AUTORIA: ação de sistema — não existe ator autenticado antes do
    // primeiro Administrador (`docs/07` §22.3; RN-061).
    expect(evento.atorUsuarioId).toBeNull();
  });

  it("nenhuma chave proibida entra em `contexto` — nem e-mail, nem papéis", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin());
    const serializado = JSON.stringify(await lerEventos());
    expect(serializado).not.toContain("admin.f5@sintetico.local");
    expect(serializado).not.toContain(SENHA_SINTETICA);
    expect(serializado).not.toContain("papeis_anteriores");
    expect(serializado).not.toContain("papeis_novos");
    expect(serializado).not.toContain("$argon2id$");
  });
});

describe("`D-2.3D-10` — idempotência do bootstrap", () => {
  it("a segunda execução com a mesma identidade não duplica NADA", async () => {
    await seed.executar();
    const primeira = await bootstrap.executar(comandoAdmin());
    const antes = await contarTudo();

    const segunda = await bootstrap.executar(comandoAdmin());
    expect(segunda.desfecho).toBe("JA_CONFORME");
    expect(segunda.usuarioId).toBe(primeira.usuarioId);
    expect(segunda.correlacaoId).toBeNull();

    // Zero usuário novo, zero vínculo novo e — decisivo — zero evento novo:
    // um segundo evento afirmaria uma alteração de papéis que não ocorreu.
    expect(await contarTudo()).toEqual(antes);
    expect(await lerEventos()).toHaveLength(1);
  });

  it("a terceira execução continua estável", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin());
    await bootstrap.executar(comandoAdmin());
    const terceira = await bootstrap.executar(comandoAdmin());
    expect(terceira.desfecho).toBe("JA_CONFORME");
    expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 1, eventos: 1 });
  });

  it("`D-2.3D-03` — o identificador é normalizado: a mesma identidade é reconhecida", async () => {
    await seed.executar();
    const primeira = await bootstrap.executar(comandoAdmin());
    const segunda = await bootstrap.executar(
      comandoAdmin({ email: "  ADMIN.F5@Sintetico.Local  " }),
    );
    expect(segunda.desfecho).toBe("JA_CONFORME");
    expect(segunda.usuarioId).toBe(primeira.usuarioId);
    expect(await contarTudo()).toMatchObject({ usuarios: 1 });
  });

  it("estado PARCIAL (usuário existe, papel não): converge atribuindo o papel", async () => {
    await seed.executar();
    const usuarioId = await database.transacao(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email: "admin.f5@sintetico.local",
          senhaHash: "$argon2id$hash-preexistente-sintetico",
          nome: "Nome Preexistente",
          ativo: true,
        },
      });
      return usuario.id;
    });

    const resultado = await bootstrap.executar(comandoAdmin());
    expect(resultado.desfecho).toBe("PAPEL_ATRIBUIDO");
    expect(resultado.usuarioId).toBe(usuarioId);

    // A identidade preexistente NÃO é alterada — nem senha, nem nome.
    const usuario = await database.transacao(async (tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } }),
    );
    expect(usuario.senhaHash).toBe("$argon2id$hash-preexistente-sintetico");
    expect(usuario.nome).toBe("Nome Preexistente");

    // O papel foi atribuído e o evento emitido.
    expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 1, eventos: 1 });
    const eventos = await lerEventos();
    expect(eventos[0]?.alvoId).toBe(usuarioId);
  });
});

describe("`D-2.3D-10` — falha segura em conflito e em estado inválido", () => {
  it("já existe OUTRO Administrador: recusa e não altera nada", async () => {
    await seed.executar();
    const primeiro = await bootstrap.executar(comandoAdmin());
    const antes = await contarTudo();

    await expect(
      bootstrap.executar(comandoAdmin({ email: "outro.admin@sintetico.local" })),
    ).rejects.toBeInstanceOf(ErroBootstrapAdministrador);
    await expect(
      bootstrap.executar(comandoAdmin({ email: "outro.admin@sintetico.local" })),
    ).rejects.toMatchObject({ motivo: "ADMINISTRADOR_JA_EXISTE" });

    // Nenhum segundo "primeiro Administrador" foi criado, em silêncio ou não.
    expect(await contarTudo()).toEqual(antes);
    const administradores = await database.transacao(async (tx) =>
      tx.usuarioPapel.findMany({ where: { papel: { codigo: "ADMINISTRADOR" } } }),
    );
    expect(administradores.map((v) => v.usuarioId)).toEqual([primeiro.usuarioId]);
  });

  it("o papel Administrador não existe (seed não rodou): recusa e não cria usuário", async () => {
    await expect(bootstrap.executar(comandoAdmin())).rejects.toMatchObject({
      motivo: "PAPEL_ADMINISTRADOR_AUSENTE",
    });
    expect(await contarTudo()).toMatchObject({ usuarios: 0, usuarioPapeis: 0, eventos: 0 });
  });

  it("a identidade existe e está INATIVA: recusa e não atribui papel", async () => {
    await seed.executar();
    await database.transacao(async (tx) =>
      tx.usuario.create({
        data: {
          email: "admin.f5@sintetico.local",
          senhaHash: "$argon2id$hash-preexistente-sintetico",
          nome: "Inativo Preexistente",
          ativo: false,
        },
      }),
    );

    await expect(bootstrap.executar(comandoAdmin())).rejects.toMatchObject({
      motivo: "USUARIO_ALVO_INATIVO",
    });
    expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 0, eventos: 0 });
  });

  it("entrada malformada é recusada ANTES de qualquer escrita", async () => {
    await seed.executar();
    const antes = await contarTudo();
    for (const [comando, motivo] of [
      [comandoAdmin({ email: "" }), "EMAIL_INVALIDO"],
      [comandoAdmin({ email: "   " }), "EMAIL_INVALIDO"],
      [comandoAdmin({ nome: "" }), "NOME_INVALIDO"],
      [comandoAdmin({ nome: "  " }), "NOME_INVALIDO"],
      [comandoAdmin({ senha: "" }), "SENHA_AUSENTE"],
    ] as const) {
      await expect(bootstrap.executar(comando)).rejects.toMatchObject({ motivo });
    }
    expect(await contarTudo()).toEqual(antes);
  });

  it("nenhuma mensagem de erro carrega e-mail, nome ou senha", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin());
    const erro = await bootstrap
      .executar(comandoAdmin({ email: "vitima@sintetico.local", senha: "segredo-vazado-x" }))
      .catch((causa: unknown) => causa);
    expect(erro).toBeInstanceOf(ErroBootstrapAdministrador);
    const texto = `${(erro as Error).message} ${String((erro as Error).stack)}`;
    expect(texto).not.toContain("vitima@sintetico.local");
    expect(texto).not.toContain("segredo-vazado-x");
  });
});

describe("`D-2.3D-10` — atomicidade: nenhum estado parcial sobrevive", () => {
  it("falha da auditoria → ROLLBACK do usuário E do vínculo de papel", async () => {
    await seed.executar();
    const antes = await contarTudo();

    // A auditoria obrigatória falha DEPOIS de o usuário e o vínculo já terem
    // sido escritos na transação. O rollback é do PostgreSQL, não de mock.
    const espia = jest
      .spyOn(auditWriter, "registrar")
      .mockRejectedValueOnce(new Error("falha sintética de auditoria"));

    await expect(bootstrap.executar(comandoAdmin())).rejects.toThrow(
      "falha sintética de auditoria",
    );
    espia.mockRestore();

    // Nem usuário criado sem papel, nem papel atribuído sem auditoria.
    expect(await contarTudo()).toEqual(antes);
    expect(await contarTudo()).toMatchObject({ usuarios: 0, usuarioPapeis: 0, eventos: 0 });

    // Controle positivo: sem a falha, a mesma chamada persiste tudo.
    const resultado = await bootstrap.executar(comandoAdmin());
    expect(resultado.desfecho).toBe("USUARIO_CRIADO");
    expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 1, eventos: 1 });
  });

  it("falha do vínculo de papel → ZERO usuário e ZERO evento persistem", async () => {
    await seed.executar();
    const antes = await contarTudo();

    // Papel removido entre a leitura e a escrita não é reproduzível aqui; o
    // equivalente observável é a violação de PK do vínculo. Reproduz-se o
    // caminho com um segundo `create` do MESMO par dentro de uma transação
    // que já criou usuário e evento — a transação inteira é desfeita.
    await expect(
      database.transacao(async (tx) => {
        const papel = await tx.papel.findUniqueOrThrow({
          where: { codigo: "ADMINISTRADOR" },
        });
        const usuario = await tx.usuario.create({
          data: {
            email: "parcial@sintetico.local",
            senhaHash: "hash-sintetico-parcial",
            nome: "Parcial",
            ativo: true,
          },
        });
        await auditWriter.registrar(tx, {
          acao: "usuario.papeis.alterados",
          ocorridoEm: new Date(),
          atorUsuarioId: null,
          alvoTipo: "usuario",
          alvoId: usuario.id,
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
        });
        await tx.usuarioPapel.create({ data: { usuarioId: usuario.id, papelId: papel.id } });
        await tx.usuarioPapel.create({ data: { usuarioId: usuario.id, papelId: papel.id } });
      }),
    ).rejects.toBeDefined();

    expect(await contarTudo()).toEqual(antes);
  });

  it("o `AuditWriter` recusa cliente NÃO transacional — a auditoria não escapa da transação", async () => {
    await expect(
      auditWriter.registrar(
        // @ts-expect-error — prova deliberada: cliente não transacional.
        { $connect: () => undefined, $disconnect: () => undefined },
        {
          acao: "usuario.papeis.alterados",
          ocorridoEm: new Date(),
          atorUsuarioId: null,
          alvoTipo: "usuario",
          alvoId: randomUUID(),
          resultado: "SUCESSO",
          justificativa: null,
          correlacaoId: randomUUID(),
        },
      ),
    ).rejects.toThrow(/TRANSACIONAL/);
  });
});

describe("fronteira da F5 — o que ela deliberadamente NÃO faz", () => {
  it("o bootstrap não cria sessão, não emite segredo de recuperação e não inativa ninguém", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin());
    const contagens = await database.transacao(async (tx) => ({
      sessoes: await tx.sessaoAutenticacao.count(),
      segredos: await tx.segredoRecuperacaoSenha.count(),
      inativos: await tx.usuario.count({ where: { ativo: false } }),
    }));
    expect(contagens).toEqual({ sessoes: 0, segredos: 0, inativos: 0 });
  });

  it("o único evento de auditoria da fatia é `usuario.papeis.alterados`", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin());
    const acoes = new Set((await lerEventos()).map((evento) => evento.acao));
    expect([...acoes]).toEqual(["usuario.papeis.alterados"]);
    // `usuario.criado` NÃO é criada (`P-2.3D-05` permanece ABERTA); e
    // `usuario.situacao.alterada` pertence a AUT-005, fora desta fatia.
    expect(acoes.has("usuario.criado")).toBe(false);
    expect(acoes.has("usuario.situacao.alterada")).toBe(false);
  });

  it("o seed não emite evento de auditoria algum", async () => {
    await seed.executar();
    expect(await lerEventos()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CONCORRÊNCIA — a correção `F5-R-01`
// ---------------------------------------------------------------------------
//
// As duas revisões independentes reproduziram, contra PostgreSQL real, DOIS
// "primeiros Administradores" criados simultaneamente. A causa era TOCTOU sob
// `READ COMMITTED`; a correção é o advisory lock transacional.
//
// Estes testes exercitam a corrida DE VERDADE — várias chamadas disparadas sem
// `await` entre elas, cada uma na sua própria transação e conexão do pool. Por
// serem probabilísticos por natureza, cada cenário é REPETIDO: um verde único
// poderia ser sorte de escalonamento.

/** Repetições de cada cenário concorrente — reduz falso verde. */
const RODADAS = 4;

/** Concorrentes por rodada. */
const CONCORRENTES = 4;

interface Desfechos {
  readonly sucessos: readonly string[];
  readonly motivosDeRecusa: readonly string[];
  readonly errosNaoContratados: readonly string[];
}

/**
 * Dispara as chamadas SIMULTANEAMENTE e classifica cada desfecho. Um erro é
 * "não contratado" quando não é `ErroBootstrapAdministrador` — é exatamente aí
 * que um `P2002` cru apareceria.
 */
async function correr(
  chamadas: readonly (() => Promise<{ desfecho: string }>)[],
): Promise<Desfechos> {
  const resultados = await Promise.allSettled(chamadas.map((c) => c()));
  const sucessos: string[] = [];
  const motivosDeRecusa: string[] = [];
  const errosNaoContratados: string[] = [];
  for (const r of resultados) {
    if (r.status === "fulfilled") {
      sucessos.push(r.value.desfecho);
      continue;
    }
    const causa: unknown = r.reason;
    if (causa instanceof ErroBootstrapAdministrador) {
      motivosDeRecusa.push(causa.motivo);
    } else {
      const nome =
        typeof causa === "object" && causa !== null && "name" in causa
          ? String((causa as { name?: unknown }).name)
          : String(causa);
      const codigo =
        typeof causa === "object" && causa !== null && "code" in causa
          ? String((causa as { code?: unknown }).code)
          : "";
      errosNaoContratados.push(`${nome}${codigo === "" ? "" : `/${codigo}`}`);
    }
  }
  return { sucessos, motivosDeRecusa, errosNaoContratados };
}

async function contarAdministradores(): Promise<number> {
  return database.transacao(async (tx) =>
    tx.usuarioPapel.count({ where: { papel: { codigo: "ADMINISTRADOR" } } }),
  );
}

describe("`F5-R-01` — bootstrap concorrente: a invariante do primeiro Administrador", () => {
  it("identidades DIFERENTES: exatamente uma criação, um vínculo e um evento", async () => {
    for (let rodada = 0; rodada < RODADAS; rodada += 1) {
      await limparParaRodada();
      await seed.executar();

      const desfechos = await correr(
        Array.from({ length: CONCORRENTES }, (_, i) => () =>
          bootstrap.executar(comandoAdmin({ email: `corrida.${i}@sintetico.local` })),
        ),
      );

      // ANTES da correção, esta era a asserção que falhava: todas as chamadas
      // devolviam `USUARIO_CRIADO` e o banco terminava com N Administradores.
      expect(desfechos.sucessos).toEqual(["USUARIO_CRIADO"]);
      expect(desfechos.motivosDeRecusa).toEqual(
        Array.from({ length: CONCORRENTES - 1 }, () => "ADMINISTRADOR_JA_EXISTE"),
      );
      expect(desfechos.errosNaoContratados).toEqual([]);

      expect(await contarAdministradores()).toBe(1);
      const contagens = await contarTudo();
      expect(contagens.usuarios).toBe(1);
      expect(contagens.usuarioPapeis).toBe(1);
      expect(contagens.eventos).toBe(1);
    }
  });

  it("MESMA identidade: um efetivo e os demais `JA_CONFORME`, sem erro técnico", async () => {
    for (let rodada = 0; rodada < RODADAS; rodada += 1) {
      await limparParaRodada();
      await seed.executar();

      const desfechos = await correr(
        Array.from({ length: CONCORRENTES }, () => () => bootstrap.executar(comandoAdmin())),
      );

      expect(desfechos.sucessos.filter((d) => d === "USUARIO_CRIADO")).toHaveLength(1);
      expect(desfechos.sucessos.filter((d) => d === "JA_CONFORME")).toHaveLength(
        CONCORRENTES - 1,
      );
      // O `P2002` cru que a revisão mediu não pode mais ocorrer.
      expect(desfechos.errosNaoContratados).toEqual([]);
      expect(desfechos.motivosDeRecusa).toEqual([]);

      expect(await contarAdministradores()).toBe(1);
      expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 1, eventos: 1 });
    }
  });

  it("variantes de caixa e espaços concorrem como a MESMA identidade", async () => {
    for (let rodada = 0; rodada < RODADAS; rodada += 1) {
      await limparParaRodada();
      await seed.executar();

      const variantes = [
        "admin.f5@sintetico.local",
        "ADMIN.F5@SINTETICO.LOCAL",
        "  Admin.F5@Sintetico.Local  ",
        "\tadmin.F5@sintetico.LOCAL ",
      ];
      const desfechos = await correr(
        variantes.map((email) => () => bootstrap.executar(comandoAdmin({ email }))),
      );

      expect(desfechos.sucessos.filter((d) => d === "USUARIO_CRIADO")).toHaveLength(1);
      expect(desfechos.errosNaoContratados).toEqual([]);
      expect(await contarAdministradores()).toBe(1);
      expect(await contarTudo()).toMatchObject({ usuarios: 1, eventos: 1 });
    }
  });

  it("Administrador PREEXISTENTE: todas as identidades novas são recusadas", async () => {
    await limparParaRodada();
    await seed.executar();
    await bootstrap.executar(comandoAdmin({ email: "titular@sintetico.local" }));
    const antes = await contarTudo();

    const desfechos = await correr(
      Array.from({ length: CONCORRENTES }, (_, i) => () =>
        bootstrap.executar(comandoAdmin({ email: `tardio.${i}@sintetico.local` })),
      ),
    );
    expect(desfechos.sucessos).toEqual([]);
    expect(new Set(desfechos.motivosDeRecusa)).toEqual(new Set(["ADMINISTRADOR_JA_EXISTE"]));
    expect(desfechos.errosNaoContratados).toEqual([]);
    expect(await contarTudo()).toEqual(antes);
    expect(await contarAdministradores()).toBe(1);
  });

  it("usuário ATIVO preexistente sem papel, sob concorrência: um `PAPEL_ATRIBUIDO`", async () => {
    await limparParaRodada();
    await seed.executar();
    await database.transacao(async (tx) =>
      tx.usuario.create({
        data: {
          email: "admin.f5@sintetico.local",
          senhaHash: "$argon2id$hash-preexistente-sintetico",
          nome: "Nome Preexistente",
          ativo: true,
        },
      }),
    );

    const desfechos = await correr(
      Array.from({ length: CONCORRENTES }, () => () => bootstrap.executar(comandoAdmin())),
    );
    expect(desfechos.sucessos.filter((d) => d === "PAPEL_ATRIBUIDO")).toHaveLength(1);
    expect(desfechos.sucessos.filter((d) => d === "JA_CONFORME")).toHaveLength(
      CONCORRENTES - 1,
    );
    expect(desfechos.errosNaoContratados).toEqual([]);
    expect(await contarTudo()).toMatchObject({ usuarios: 1, usuarioPapeis: 1, eventos: 1 });

    // A identidade preexistente permanece intacta.
    const usuario = await database.transacao(async (tx) =>
      tx.usuario.findFirstOrThrow({ select: { nome: true, senhaHash: true } }),
    );
    expect(usuario.nome).toBe("Nome Preexistente");
    expect(usuario.senhaHash).toBe("$argon2id$hash-preexistente-sintetico");
  });

  it("usuário INATIVO preexistente: todas as chamadas concorrentes recusam", async () => {
    await limparParaRodada();
    await seed.executar();
    await database.transacao(async (tx) =>
      tx.usuario.create({
        data: {
          email: "admin.f5@sintetico.local",
          senhaHash: "$argon2id$hash-preexistente-sintetico",
          nome: "Inativo",
          ativo: false,
        },
      }),
    );

    const desfechos = await correr(
      Array.from({ length: CONCORRENTES }, () => () => bootstrap.executar(comandoAdmin())),
    );
    expect(desfechos.sucessos).toEqual([]);
    expect(new Set(desfechos.motivosDeRecusa)).toEqual(new Set(["USUARIO_ALVO_INATIVO"]));
    expect(desfechos.errosNaoContratados).toEqual([]);
    expect(await contarTudo()).toMatchObject({ usuarioPapeis: 0, eventos: 0 });
  });

  it("falha da AUDITORIA sob concorrência: nenhum Administrador sobrevive", async () => {
    await limparParaRodada();
    await seed.executar();
    const espia = jest
      .spyOn(auditWriter, "registrar")
      .mockRejectedValue(new Error("falha sintética de auditoria"));

    const desfechos = await correr(
      Array.from({ length: CONCORRENTES }, (_, i) => () =>
        bootstrap.executar(comandoAdmin({ email: `auditoria.${i}@sintetico.local` })),
      ),
    );
    espia.mockRestore();

    expect(desfechos.sucessos).toEqual([]);
    expect(await contarTudo()).toMatchObject({
      usuarios: 0,
      usuarioPapeis: 0,
      eventos: 0,
    });

    // Controle positivo: sem a falha, a mesma chamada persiste tudo.
    const ok = await bootstrap.executar(comandoAdmin());
    expect(ok.desfecho).toBe("USUARIO_CRIADO");
    expect(await contarAdministradores()).toBe(1);
  });

  it("hash deliberadamente LENTO não reabre a janela TOCTOU", async () => {
    // O digest é calculado FORA da transação. Se a decisão dependesse de algo
    // lido antes do lock, um hash lento escancararia a corrida — aqui ele só
    // atrasa a entrada na seção crítica.
    await limparParaRodada();
    await seed.executar();
    const espia = jest
      .spyOn(credenciais, "gerarHash")
      .mockImplementation(async (senha: string) => {
        await new Promise((r) => setTimeout(r, 150));
        return `$argon2id$v=19$m=19456,t=2,p=1$sintetico$${senha.length}`;
      });

    const desfechos = await correr(
      Array.from({ length: CONCORRENTES }, (_, i) => () =>
        bootstrap.executar(comandoAdmin({ email: `lento.${i}@sintetico.local` })),
      ),
    );
    espia.mockRestore();

    expect(desfechos.sucessos).toEqual(["USUARIO_CRIADO"]);
    expect(desfechos.errosNaoContratados).toEqual([]);
    expect(await contarAdministradores()).toBe(1);
  });
});

describe("`F5-R-01` — seed concorrente converge sem erro não contratado", () => {
  const cenarios: readonly {
    readonly nome: string;
    readonly preparar: () => Promise<void>;
  }[] = [
    { nome: "banco vazio", preparar: async () => undefined },
    {
      nome: "banco parcial",
      preparar: async () => {
        await database.transacao(async (tx) => {
          await tx.papel.create({ data: { codigo: "GESTOR", nome: "Gestor" } });
          await tx.permissao.create({
            data: {
              codigo: "auditoria.ler",
              nome: DESCRICAO_PERMISSAO["auditoria.ler"],
            },
          });
        });
      },
    },
    {
      nome: "banco já conforme",
      preparar: async () => {
        await seed.executar();
      },
    },
    {
      nome: "associação canônica faltante",
      preparar: async () => {
        await seed.executar();
        await database.transacao(async (tx) => {
          const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
          const permissao = await tx.permissao.findUniqueOrThrow({
            where: { codigo: "pacientes.localizar" },
          });
          await tx.papelPermissao.delete({
            where: {
              papelId_permissaoId: { papelId: papel.id, permissaoId: permissao.id },
            },
          });
        });
      },
    },
    {
      nome: "banco contaminado",
      preparar: async () => {
        await seed.executar();
        await database.transacao(async (tx) => {
          const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
          const permissao = await tx.permissao.findUniqueOrThrow({
            where: { codigo: "pacotes.ajustar_sessao" },
          });
          await tx.papelPermissao.create({
            data: { papelId: papel.id, permissaoId: permissao.id },
          });
        });
      },
    },
  ];

  for (const cenario of cenarios) {
    it(`${cenario.nome}: todos convergem, zero duplicata, contagens canônicas`, async () => {
      for (let rodada = 0; rodada < 2; rodada += 1) {
        await limparParaRodada();
        await cenario.preparar();

        const resultados = await Promise.allSettled(
          Array.from({ length: CONCORRENTES }, () => seed.executar()),
        );
        const rejeitados = resultados.filter((r) => r.status === "rejected");
        // A revisão mediu `P2002` cru aqui antes do lock.
        expect(rejeitados).toEqual([]);

        const contagens = await contarTudo();
        expect(contagens.papeis).toBe(4);
        expect(contagens.permissoes).toBe(29);
        // 37 canônicas + as excedentes que o cenário tenha introduzido.
        expect(contagens.vinculos).toBeGreaterThanOrEqual(37);
        expect(contagens.eventos).toBe(0);

        // A matriz canônica está integralmente presente em todos os cenários.
        const persistida = await matrizPersistida();
        const esperada = matrizEsperada();
        for (const papel of PAPEIS) {
          for (const permissao of esperada[papel.codigo] ?? []) {
            expect(persistida[papel.codigo]).toContain(permissao);
          }
        }
      }
    });
  }
});

describe("`F5-R-02` — divergências deixam de ser silenciosas", () => {
  it("banco exatamente conforme: zero divergência e `jaConforme`", async () => {
    await seed.executar();
    const resultado = await seed.executar();
    expect(resultado.jaConforme).toBe(true);
    expect(resultado.divergencias).toEqual({
      papeisDesconhecidos: 0,
      permissoesDesconhecidas: 0,
      associacoesExcedentes: 0,
      associacoesExcedentesCanonicas: [],
      total: 0,
    });
  });

  it("papel e permissão fora do catálogo são CONTADOS — e nunca nomeados", async () => {
    await seed.executar();
    await database.transacao(async (tx) => {
      await tx.papel.create({ data: { codigo: "SUPERADMIN", nome: "Super" } });
      await tx.permissao.create({ data: { codigo: "tudo.liberado", nome: "Tudo" } });
    });

    const resultado = await seed.executar();
    expect(resultado.jaConforme).toBe(false);
    expect(resultado.divergencias.papeisDesconhecidos).toBe(1);
    expect(resultado.divergencias.permissoesDesconhecidas).toBe(1);
    expect(resultado.divergencias.total).toBe(2);

    // Privacidade: códigos de terceiros NÃO aparecem em lugar algum da saída.
    const serializado = JSON.stringify(resultado);
    expect(serializado).not.toContain("SUPERADMIN");
    expect(serializado).not.toContain("tudo.liberado");

    // E nada foi removido — o seed continua aditivo.
    const papeis = await database.transacao(async (tx) => tx.papel.count());
    expect(papeis).toBe(5);
  });

  it("associação excedente entre dois códigos do catálogo É nomeada", async () => {
    await seed.executar();
    await database.transacao(async (tx) => {
      const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "FISIOTERAPEUTA" } });
      const permissao = await tx.permissao.findUniqueOrThrow({
        where: { codigo: "prontuario.exportar" },
      });
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
    });

    const resultado = await seed.executar();
    expect(resultado.divergencias.associacoesExcedentesCanonicas).toEqual([
      "FISIOTERAPEUTA -> prontuario.exportar",
    ]);
    expect(resultado.divergencias.associacoesExcedentes).toBe(1);
  });

  it("associação envolvendo código desconhecido é contada, mas não nomeada", async () => {
    await seed.executar();
    await database.transacao(async (tx) => {
      const papel = await tx.papel.findUniqueOrThrow({ where: { codigo: "GESTOR" } });
      const permissao = await tx.permissao.create({
        data: { codigo: "codigo.de.terceiro", nome: "X" },
      });
      await tx.papelPermissao.create({
        data: { papelId: papel.id, permissaoId: permissao.id },
      });
    });

    const resultado = await seed.executar();
    expect(resultado.divergencias.associacoesExcedentes).toBe(1);
    expect(resultado.divergencias.associacoesExcedentesCanonicas).toEqual([]);
    expect(JSON.stringify(resultado)).not.toContain("codigo.de.terceiro");
  });
});

describe("`F5-R-03` — justificativa operacional obrigatória", () => {
  it("é persistida em `justificativa` e não vaza para `contexto`", async () => {
    await seed.executar();
    await bootstrap.executar(comandoAdmin({ justificativa: "chamado OPS-4711" }));
    const eventos = await lerEventos();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.justificativa).toBe("chamado OPS-4711");
    expect(eventos[0]?.contexto).toBeNull();
    // A whitelist de `contexto` (`D-AUD-07`) NÃO foi ampliada.
    expect(eventos[0]?.atorUsuarioId).toBeNull();
  });

  it("ausente, vazia ou só espaços é recusada ANTES de qualquer escrita", async () => {
    await seed.executar();
    const antes = await contarTudo();
    for (const justificativa of ["", "   ", "\t"]) {
      await expect(bootstrap.executar(comandoAdmin({ justificativa }))).rejects.toMatchObject(
        { motivo: "JUSTIFICATIVA_AUSENTE" },
      );
    }
    expect(await contarTudo()).toEqual(antes);
  });

  it("com caractere de controle é recusada", async () => {
    await seed.executar();
    const antes = await contarTudo();
    for (const justificativa of ["ok\nmais", "ok\rmais", "ok\u0000mais"]) {
      await expect(bootstrap.executar(comandoAdmin({ justificativa }))).rejects.toMatchObject(
        { motivo: "JUSTIFICATIVA_INVALIDA" },
      );
    }
    expect(await contarTudo()).toEqual(antes);
  });
});
