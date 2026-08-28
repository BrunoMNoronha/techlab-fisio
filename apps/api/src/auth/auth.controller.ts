// TechLab Fisio — fronteira HTTP de autenticação (Etapa 2.3D-B / F3).
//
// Os PRIMEIROS endpoints REST autenticados do produto. Materializam AUT-001 e
// AUT-002 sobre as decisões `D-2.3D-06`, `D-2.3D-07`, `D-2.3D-11` e
// `D-2.3D-12`.
//
// DECISÕES LOCAIS DE IMPLEMENTAÇÃO — rotuladas como tais, NÃO são requisito
// permanente e são reversíveis sem reabrir decisão homologada. Nenhuma fonte
// homologada fixa rota, status ou formato exato destes endpoints; adota-se a
// alternativa REST mínima e convencional:
//
//   L-01  rotas `POST /auth/login` e `POST /auth/logout`;
//   L-02  `200` com corpo mínimo no login; `204` sem corpo no logout — não há
//         representação a devolver, e o único artefato do logout é o
//         `Set-Cookie` de limpeza;
//   L-03  corpo de erro único `{ "erro": "<CODIGO>" }`, código de conjunto
//         fechado (`ERRO` em `auth.dto.ts`);
//   L-04  `401` para falha de autenticação e para sessão inválida; `429` para
//         rate limit; `403` para recusa da baseline CSRF; `400` para payload
//         malformado; `413` para corpo acima do limite do parser;
//   L-05  o IP da dimensão de `D-2.3D-06` vem do SOCKET, nunca de
//         `X-Forwarded-For` — ver `extrairIp`.
//
//   A-05  (observação da revisão independente da F2, `docs/10` §6-E.9 — NÃO é
//         requisito homologado): os cinco motivos internos de sessão inválida
//         do `SessaoService` (`TOKEN_MALFORMADO`, `SESSAO_INEXISTENTE`,
//         `SEGREDO_INVALIDO`, `SESSAO_EXPIRADA`, `SESSAO_REVOGADA`) colapsam
//         em UMA única resposta HTTP. ADOTADA nesta fatia como decisão local
//         reversível, por ser coerente com a disciplina anti-enumeração de
//         AUT-001/`D-2.3D-12` e com o critério do enunciado de que o logout
//         "não deve virar oráculo desnecessário sobre o estado interno da
//         sessão". Coberta por teste.
//
// O QUE ESTA FRONTEIRA NÃO FAZ — e não pode fazer nesta fatia: nenhum guard ou
// decorator de AUTORIZAÇÃO (RBAC é `D-2.3D-09`/F4); nenhum endpoint de
// profissionais, pacientes ou agenda; nenhuma rota de recuperação de senha
// (F6); nenhuma revogação de sessão de terceiro; nenhum refresh token;
// nenhum JWT.

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AutenticacaoService } from "./autenticacao.service.js";
import {
  ERRO,
  ErroAutenticacaoDto,
  LoginRequisicaoDto,
  LoginRespostaDto,
  validarCorpoLogin,
} from "./auth.dto.js";
import {
  POLITICA_COOKIE_SESSAO,
  lerCookieSessao,
  montarCabecalhoLimpeza,
  montarCabecalhoSessao,
  type PoliticaCookieSessao,
} from "./politica-cookie.js";
import { CABECALHO_REQUISICAO_TLF, ProtecaoCsrfGuard } from "./protecao-csrf.guard.js";

/**
 * Forma mínima da requisição consumida por este controller. Estrutural de
 * propósito — a fronteira não se acopla ao tipo da plataforma HTTP.
 */
interface RequisicaoAutenticacao {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly socket?: { readonly remoteAddress?: string | undefined };
}

/** Forma mínima da resposta: apenas a escrita de cabeçalhos. */
interface RespostaAutenticacao {
  setHeader(nome: string, valor: string): unknown;
}

/** Valor usado quando o socket não expõe endereço (nunca deve ocorrer em TCP). */
const IP_DESCONHECIDO = "desconhecido";

/**
 * IP para a dimensão de `D-2.3D-06`.
 *
 * DECISÃO LOCAL `L-05` — deliberada e restritiva: a origem é o ENDEREÇO DO
 * SOCKET, e nenhum cabeçalho participa. `X-Forwarded-For` é escrito pelo
 * cliente e só é confiável atrás de um proxy reverso cuja topologia esteja
 * homologada; nenhuma está. Confiar nele agora daria a qualquer atacante um
 * contador de IP novo por requisição — isto é, aboliria a dimensão inteira.
 * Quando existir proxy homologado, isto vira decisão própria.
 */
function extrairIp(requisicao: RequisicaoAutenticacao): string {
  return requisicao.socket?.remoteAddress ?? IP_DESCONHECIDO;
}

@ApiTags("Autenticação")
@ApiHeader({
  name: CABECALHO_REQUISICAO_TLF,
  required: true,
  description:
    "Custom request header obrigatório da baseline CSRF (D-2.3D-07). Qualquer " +
    "valor não vazio. Um formulário cross-site não consegue emiti-lo, e um " +
    "fetch cross-site que tente dispara preflight — que ninguém responde, " +
    "porque CORS está desabilitado.",
})
@Controller("auth")
@UseGuards(ProtecaoCsrfGuard)
export class AuthController {
  constructor(
    private readonly autenticacao: AutenticacaoService,
    @Inject(POLITICA_COOKIE_SESSAO)
    private readonly politicaCookie: PoliticaCookieSessao,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Autentica um usuário ativo e emite a sessão (AUT-001).",
    description:
      "Em caso de sucesso a sessão é entregue EXCLUSIVAMENTE pelo cookie " +
      "HttpOnly de D-2.3D-07; o token nunca aparece no corpo. A resposta de " +
      "falha é uniforme para conta inexistente, senha incorreta e conta " +
      "inativa (AUT-001: erros não devem facilitar enumeração de contas).",
  })
  @ApiBody({ type: LoginRequisicaoDto })
  @ApiResponse({
    status: 200,
    description: "Autenticado. Cookie de sessão emitido no Set-Cookie.",
    type: LoginRespostaDto,
  })
  @ApiResponse({
    status: 400,
    description: "Payload malformado. Não gera evento de auditoria (D-2.3D-12).",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 401,
    description:
      "Credenciais inválidas — resposta idêntica para conta inexistente, " +
      "senha incorreta e conta inativa.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 403,
    description: "Baseline CSRF de D-2.3D-07 recusou a requisição.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 429,
    description:
      "Rate limit de D-2.3D-06 (5 falhas/15 min por identificador; 30/15 min " +
      "por IP). Acompanha Retry-After. Não gera evento de auditoria.",
    type: ErroAutenticacaoDto,
    headers: {
      "Retry-After": {
        description: "Segundos até a janela liberar.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiResponse({
    status: 413,
    description:
      "Corpo acima do limite do parser. Rejeitado ANTES do controller; não " +
      "gera evento de auditoria e não é registrado como falha do serviço.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 500,
    description:
      "Falha TÉCNICA inesperada. Deliberadamente distinta de 401: uma " +
      "indisponibilidade de infraestrutura nunca é reportada como credencial " +
      "inválida. Nenhum detalhe interno é devolvido.",
    type: ErroAutenticacaoDto,
  })
  async login(
    @Body() corpo: unknown,
    @Req() requisicao: RequisicaoAutenticacao,
    @Res({ passthrough: true }) resposta: RespostaAutenticacao,
  ): Promise<LoginRespostaDto> {
    // Validação estrutural ANTES de tudo. Uma rejeição aqui não é tentativa de
    // autenticação: não conta no rate limiter e não audita (`D-2.3D-12`).
    const validacao = validarCorpoLogin(corpo);
    if (!validacao.valido) {
      throw new BadRequestException({ erro: ERRO.REQUISICAO_INVALIDA });
    }

    const resultado = await this.autenticacao.autenticar({
      identificador: validacao.valor.identificador,
      senha: validacao.valor.senha,
      ip: extrairIp(requisicao),
    });

    if (resultado.desfecho === "BLOQUEADO") {
      // `Retry-After` é escrito ANTES da exceção: o filtro de exceção do Nest
      // escreve status e corpo na MESMA resposta, preservando os cabeçalhos.
      resposta.setHeader("Retry-After", String(resultado.retryAfterSegundos));
      throw new HttpException(
        { erro: ERRO.TENTATIVAS_EXCEDIDAS },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (resultado.desfecho === "CREDENCIAIS_INVALIDAS") {
      throw new UnauthorizedException({ erro: ERRO.CREDENCIAIS_INVALIDAS });
    }

    // ÚNICA saída do token (`D-2.3D-07`): o cookie. O corpo abaixo não o
    // contém, e a montagem do cabeçalho é a fonte única de `politica-cookie.ts`.
    resposta.setHeader(
      "Set-Cookie",
      montarCabecalhoSessao(this.politicaCookie, resultado.token),
    );
    return {
      usuarioId: resultado.usuarioId,
      expiraEm: resultado.expiraEm.toISOString(),
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Encerra a própria sessão (AUT-002, D-2.3D-05).",
    description:
      "Revoga a sessão portada pelo cookie e limpa o cookie no agente do " +
      "usuário. A sessão passa a REVOGADA; nenhum estado terminal volta a " +
      "ATIVA. Toda sessão inválida — ausente, malformada, inexistente, " +
      "expirada ou revogada — produz a MESMA resposta (decisão local A-05).",
  })
  @ApiResponse({
    status: 204,
    description: "Sessão encerrada. Cookie limpo no Set-Cookie. Sem corpo.",
  })
  @ApiResponse({
    status: 401,
    description:
      "Sessão inválida — resposta única para os cinco motivos internos. " +
      "O cookie é limpo também neste caso.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 403,
    description: "Baseline CSRF de D-2.3D-07 recusou a requisição.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 413,
    description:
      "Corpo acima do limite do parser. Rejeitado ANTES do controller; não " +
      "gera evento de auditoria e não é registrado como falha do serviço.",
    type: ErroAutenticacaoDto,
  })
  @ApiResponse({
    status: 500,
    description:
      "Falha TÉCNICA inesperada. Deliberadamente distinta de 401: uma " +
      "indisponibilidade de infraestrutura nunca é reportada como credencial " +
      "inválida. Nenhum detalhe interno é devolvido.",
    type: ErroAutenticacaoDto,
  })
  async logout(
    @Req() requisicao: RequisicaoAutenticacao,
    @Res({ passthrough: true }) resposta: RespostaAutenticacao,
  ): Promise<void> {
    const token = lerCookieSessao(requisicao.headers["cookie"], this.politicaCookie);

    // CORREÇÃO `F-08`: o cookie só é limpo DEPOIS de conhecer o desfecho.
    //
    // A versão anterior escrevia o `Set-Cookie` de limpeza antes de chamar o
    // serviço. Quando a transação do logout revertia (falha ao escrever a
    // auditoria), a sessão permanecia `ATIVA` no banco — corretamente — mas o
    // cliente já havia perdido o cookie: ficava sem como encerrá-la, e a
    // sessão seguia utilizável por quem tivesse capturado o token. Medido pela
    // revisão independente (status 500, estado ATIVA, cookie limpo, token
    // ainda válido).
    //
    // Se `encerrar` LANÇAR, nada abaixo executa e o cookie é preservado: o
    // cliente conserva a credencial de uma sessão que o banco manteve viva.
    const resultado = await this.autenticacao.encerrar(token);

    // Desfechos CONHECIDOS — encerrada, ou sessão inválida/terminal: nos dois
    // casos o cliente não deve seguir portando o cookie.
    resposta.setHeader("Set-Cookie", montarCabecalhoLimpeza(this.politicaCookie));
    if (resultado.desfecho !== "ENCERRADA") {
      throw new UnauthorizedException({ erro: ERRO.SESSAO_INVALIDA });
    }
    // 204: nenhum corpo. Nada do estado interno da sessão é devolvido —
    // nem id, nem instante, nem estado.
  }
}
