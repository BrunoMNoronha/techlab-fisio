// TechLab Fisio — testes unitários para FiltroErroAutenticacao e statusDeErroDoCliente

import { describe, expect, it, jest } from "@jest/globals";
import { ArgumentsHost, BadRequestException, HttpException } from "@nestjs/common";

import {
  FiltroErroAutenticacao,
  statusDeErroDoCliente,
} from "../src/auth/erro-autenticacao.filter.js";
import { ERRO } from "../src/auth/auth.dto.js";

describe("statusDeErroDoCliente — extração e validação de status 4xx do cliente", () => {
  it("retorna null para valores nulos, indefinios e primitivos não-objeto", () => {
    expect(statusDeErroDoCliente(null)).toBeNull();
    expect(statusDeErroDoCliente(undefined)).toBeNull();
    expect(statusDeErroDoCliente("erro em string")).toBeNull();
    expect(statusDeErroDoCliente(400)).toBeNull();
    expect(statusDeErroDoCliente(true)).toBeNull();
  });

  it("retorna status quando a propriedade status é número 4xx válido", () => {
    expect(statusDeErroDoCliente({ status: 400 })).toBe(400);
    expect(statusDeErroDoCliente({ status: 413 })).toBe(413);
    expect(statusDeErroDoCliente({ status: 499 })).toBe(499);
  });

  it("retorna statusCode quando status está ausente mas statusCode é número 4xx válido", () => {
    expect(statusDeErroDoCliente({ statusCode: 400 })).toBe(400);
    expect(statusDeErroDoCliente({ statusCode: 422 })).toBe(422);
  });

  it("prioriza status sobre statusCode quando ambos estão presentes", () => {
    expect(statusDeErroDoCliente({ status: 404, statusCode: 400 })).toBe(404);
  });

  it("retorna null se nem status nem statusCode forem numéricos", () => {
    expect(statusDeErroDoCliente({ status: "400" })).toBeNull();
    expect(statusDeErroDoCliente({ statusCode: null })).toBeNull();
    expect(statusDeErroDoCliente({})).toBeNull();
  });

  it("retorna null para números não inteiros", () => {
    expect(statusDeErroDoCliente({ status: 400.5 })).toBeNull();
  });

  it("retorna null para códigos de status fora da faixa 400-499", () => {
    expect(statusDeErroDoCliente({ status: 200 })).toBeNull();
    expect(statusDeErroDoCliente({ status: 302 })).toBeNull();
    expect(statusDeErroDoCliente({ status: 399 })).toBeNull();
    expect(statusDeErroDoCliente({ status: 500 })).toBeNull();
    expect(statusDeErroDoCliente({ status: 503 })).toBeNull();
  });
});

describe("FiltroErroAutenticacao — tratamento de exceções na fronteira de autenticação", () => {
  function criarHostSintetico(req: Record<string, unknown>, res: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;
  }

  function criarRespostaSintetica() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  }

  it("delega exceções em rotas fora da fronteira ao super.catch", () => {
    const filtro = new FiltroErroAutenticacao();
    const superCatchSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filtro)), "catch").mockImplementation(() => {});

    const req = { method: "GET", path: "/auth/login" }; // GET não é rota da fronteira
    const res = criarRespostaSintetica();
    const host = criarHostSintetico(req, res);
    const excecao = new Error("rota não capturada");

    filtro.catch(excecao, host);

    expect(superCatchSpy).toHaveBeenCalledWith(excecao, host);
    expect(res.status).not.toHaveBeenCalled();
    superCatchSpy.mockRestore();
  });

  it("normaliza erros 4xx do cliente (não-HttpException) nas rotas da fronteira", () => {
    const filtro = new FiltroErroAutenticacao();
    const req = { method: "POST", path: "/auth/login" };
    const res = criarRespostaSintetica();
    const host = criarHostSintetico(req, res);
    const erroBodyParser = { status: 400, message: "Expected property name or '}' in JSON" };

    filtro.catch(erroBodyParser, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("preserva o código fechado da fronteira se a exceção já for HttpException com código conhecido", () => {
    const filtro = new FiltroErroAutenticacao();
    const req = { method: "POST", path: "/auth/login" };
    const res = criarRespostaSintetica();
    const host = criarHostSintetico(req, res);
    const excecao = new HttpException({ erro: ERRO.CREDENCIAIS_INVALIDAS }, 401);

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.CREDENCIAIS_INVALIDAS });
  });

  it("normaliza HttpException de terceiros para REQUISICAO_INVALIDA", () => {
    const filtro = new FiltroErroAutenticacao();
    const req = { method: "POST", path: "/auth/login" };
    const res = criarRespostaSintetica();
    const host = criarHostSintetico(req, res);
    const excecao = new BadRequestException("Erro genérico");

    filtro.catch(excecao, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.REQUISICAO_INVALIDA });
  });

  it("trata falha inesperada como 500 FALHA_INTERNA", () => {
    const filtro = new FiltroErroAutenticacao();
    const req = { method: "POST", path: "/auth/login" };
    const res = criarRespostaSintetica();
    const host = criarHostSintetico(req, res);
    const falhaInesperada = new Error("Erro de banco de dados");

    filtro.catch(falhaInesperada, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: ERRO.FALHA_INTERNA });
  });
});
