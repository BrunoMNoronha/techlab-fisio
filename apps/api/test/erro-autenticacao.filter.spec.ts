// TechLab Fisio — testes unitários do filtro de exceções da fronteira de autenticação (`FiltroErroAutenticacao`).

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, Logger, UnauthorizedException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

import { ERRO } from "../src/auth/auth.dto.js";
import { FiltroErroAutenticacao } from "../src/auth/erro-autenticacao.filter.js";
import { ERRO_AUTORIZACAO } from "../src/authz/erro-autorizacao.js";
import { ERRO_RECUPERACAO } from "../src/recuperacao-senha/recuperacao-senha.dto.js";

interface RequisicaoFicticia {
  url?: string;
  path?: string;
  method?: string;
}

interface RespostaFicticia {
  status: jest.MockedFunction<(codigo: number) => RespostaFicticia>;
  json: jest.MockedFunction<(corpo: unknown) => unknown>;
}

function criarHostFicticio(
  req: RequisicaoFicticia,
  res: RespostaFicticia,
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
      getNext: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

function criarRespostaFicticia(): RespostaFicticia {
  const res: Partial<RespostaFicticia> = {};
  res.status = jest.fn((_codigo: number) => res as RespostaFicticia);
  res.json = jest.fn((_corpo: unknown) => res);
  return res as RespostaFicticia;
}

describe("FiltroErroAutenticacao — Escopo de rotas e métodos", () => {
  let filtro: FiltroErroAutenticacao;
  let superCatchSpy: jest.SpiedFunction<typeof BaseExceptionFilter.prototype.catch>;

  beforeEach(() => {
    filtro = new FiltroErroAutenticacao();
    superCatchSpy = jest
      .spyOn(BaseExceptionFilter.prototype, "catch")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("delega para super.catch quando a rota não é da fronteira (ex: /health)", () => {
    const req = { url: "/health", method: "GET" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new Error("Erro genérico fora da fronteira");

    filtro.catch(excecao, host);

    expect(superCatchSpy).toHaveBeenCalledWith(excecao, host);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("delega para super.catch quando o método não é POST (ex: GET /auth/login)", () => {
    const req = { url: "/auth/login", method: "GET" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException("Not Found", HttpStatus.NOT_FOUND);

    filtro.catch(excecao, host);

    expect(superCatchSpy).toHaveBeenCalledWith(excecao, host);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    "/auth/login",
    "/auth/logout",
    "/auth/recuperacao-senha",
    "/auth/recuperacao-senha/concluir",
  ])("intercepta POST para rota da fronteira (%s)", (rota) => {
    const req = { url: rota, method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException({ erro: ERRO.CREDENCIAIS_INVALIDAS }, HttpStatus.UNAUTHORIZED);

    filtro.catch(excecao, host);

    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.CREDENCIAIS_INVALIDAS });
  });

  it("intercepta GET /auth/usuarios/:usuarioId/sessoes (P-2.3D-10) e normaliza falha técnica para 500 FALHA_INTERNA", () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const req = { url: "/auth/usuarios/a0000000-0000-4000-8000-000000000001/sessoes/", method: "GET" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);

    filtro.catch(new Error("falha simulada de banco"), host);

    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
  });

  it.each([
    { url: "/auth/usuarios/a0000000-0000-4000-8000-000000000001/sessoes", method: "POST" },
    { url: "/auth/usuarios/a/b/sessoes", method: "GET" },
    { url: "/auth/usuarios/a0000000-0000-4000-8000-000000000001/sessoes/extra", method: "GET" },
    { url: "/auth/usuarios/sessoes", method: "GET" },
  ])("NÃO amplia o escopo além da listagem exata ($method $url)", (req) => {
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new Error("fora do escopo");

    filtro.catch(excecao, host);

    expect(superCatchSpy).toHaveBeenCalledWith(excecao, host);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("trata variações de caminho como maiúsculas e barra final no POST", () => {
    const req = { url: "/AUTH/LOGIN/", method: "post" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException({ erro: ERRO.CREDENCIAIS_INVALIDAS }, HttpStatus.UNAUTHORIZED);

    filtro.catch(excecao, host);

    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.CREDENCIAIS_INVALIDAS });
  });

  it("suporta request-target em formato absoluto (RFC 7230 absolute-form)", () => {
    const req = { url: "http://host/auth/login?param=1#fragment", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException({ erro: ERRO.CREDENCIAIS_INVALIDAS }, HttpStatus.UNAUTHORIZED);

    filtro.catch(excecao, host);

    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.CREDENCIAIS_INVALIDAS });
  });

  it("dá preferência ao req.path quando presente", () => {
    const req = { url: "http://host/outra-coisa", path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException({ erro: ERRO.CREDENCIAIS_INVALIDAS }, HttpStatus.UNAUTHORIZED);

    filtro.catch(excecao, host);

    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
  });
});

describe("FiltroErroAutenticacao — Tratamento de HttpException", () => {
  let filtro: FiltroErroAutenticacao;

  beforeEach(() => {
    filtro = new FiltroErroAutenticacao();
    jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserva status e erro quando HttpException possui código reconhecido da F3 (ERRO)", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new UnauthorizedException({ erro: ERRO.CREDENCIAIS_INVALIDAS });

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.CREDENCIAIS_INVALIDAS });
  });

  it("preserva status e erro quando HttpException possui código de autorização (ERRO_AUTORIZACAO)", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException(
      { erro: ERRO_AUTORIZACAO.ACESSO_NEGADO },
      HttpStatus.FORBIDDEN,
    );

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO_AUTORIZACAO.ACESSO_NEGADO });
  });

  it("preserva status e erro quando HttpException possui código de recuperação (ERRO_RECUPERACAO)", () => {
    const req = { path: "/auth/recuperacao-senha", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException(
      { erro: ERRO_RECUPERACAO.RECUPERACAO_INVALIDA },
      HttpStatus.UNAUTHORIZED,
    );

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO_RECUPERACAO.RECUPERACAO_INVALIDA });
  });

  it("normaliza para REQUISICAO_INVALIDA mantendo o status em HttpException de terceiros ou sem código reconhecido", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new BadRequestException({ message: "Field email is invalid", error: "Bad Request" });

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("normaliza resposta string em HttpException para REQUISICAO_INVALIDA", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const excecao = new HttpException("Erro cru em string", HttpStatus.BAD_REQUEST);

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
  });
});

describe("FiltroErroAutenticacao — Erros do cliente que não são HttpException (Body Parser / http-errors)", () => {
  let filtro: FiltroErroAutenticacao;
  let loggerSpy: jest.SpiedFunction<typeof Logger.prototype.error>;

  beforeEach(() => {
    filtro = new FiltroErroAutenticacao();
    loggerSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("trata erro 400 do body parser (ex: JSON malformado) preservando status e sem emitir log de erro", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const erroBodyParser = {
      status: 400,
      message: "Expected property name or '}' in JSON at position 1",
    };

    filtro.catch(erroBodyParser, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it("trata erro 413 do body parser (payload too large com statusCode) sem emitir log de erro", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const erroBodyParser = {
      statusCode: 413,
      message: "request entity too large",
    };

    filtro.catch(erroBodyParser, host);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it("desconsidera status fora do intervalo 400-499 como erro de cliente", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const erroComStatus500 = { status: 500, message: "Internal DB error" };

    filtro.catch(erroComStatus500, host);

    // Deve ser tratado no fluxo de erro técnico (500 FALHA_INTERNA)
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
    expect(loggerSpy).toHaveBeenCalled();
  });
});

describe("FiltroErroAutenticacao — Falhas técnicas e exceções não-HTTP", () => {
  let filtro: FiltroErroAutenticacao;
  let loggerSpy: jest.SpiedFunction<typeof Logger.prototype.error>;

  beforeEach(() => {
    filtro = new FiltroErroAutenticacao();
    loggerSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retorna 500 FALHA_INTERNA e registra log mascarado para exceção inesperada (ex: erro de banco/driver)", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);
    const erroInesperado = new Error("PrismaClientKnownRequestError: connection refused");

    filtro.catch(erroInesperado, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
    expect(loggerSpy).toHaveBeenCalledTimes(1);

    const mensagemLog = loggerSpy.mock.calls[0]?.[0];
    expect(mensagemLog).toContain("Falha inesperada na fronteira de autenticação.");
    expect(mensagemLog).toContain("classe=Error");
    expect(mensagemLog).toContain("correlacao=");
    // Garante que detalhes sensíveis como mensagens não vazem no log
    expect(mensagemLog).not.toContain("PrismaClientKnownRequestError");
  });

  it("trata exceção que não é instância de Error (ex: string lançada)", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);

    filtro.catch("string lancada", host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
    expect(loggerSpy).toHaveBeenCalledTimes(1);

    const mensagemLog = loggerSpy.mock.calls[0]?.[0];
    expect(mensagemLog).toContain("classe=string");
  });

  it("trata null ou undefined como exceção não-HTTP", () => {
    const req = { path: "/auth/login", method: "POST" };
    const res = criarRespostaFicticia();
    const host = criarHostFicticio(req, res);

    filtro.catch(null, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });
});

describe("FiltroErroAutenticacao — AUD-004 (GET /auditoria/eventos)", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falha técnica na consulta vira 500 FALHA_INTERNA com contrato fechado", () => {
    const res = criarRespostaFicticia();
    new FiltroErroAutenticacao().catch(
      new Error("detalhe interno do driver"),
      criarHostFicticio({ path: "/auditoria/eventos", method: "GET" }, res),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
  });

  it("outro método no mesmo caminho NÃO é capturado pela fronteira", () => {
    const res = criarRespostaFicticia();
    new FiltroErroAutenticacao().catch(
      new Error("x"),
      criarHostFicticio({ path: "/auditoria/eventos", method: "POST" }, res),
    );
    expect(BaseExceptionFilter.prototype.catch).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
