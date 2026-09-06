"use client";

// TechLab Fisio — Formulário de Login (Client Component).
//
// Comunica-se com o backend via clientHttp (/api/auth/login).
// O cookie de sessão é gerenciado de forma transparente pelo navegador via Set-Cookie.

import { useState } from "react";
import { clienteHttp } from "../../lib/api-cliente";

interface LoginResposta {
  readonly usuarioId: string;
  readonly expiraEm: string;
}

export function FormularioLogin() {
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagemErro(null);

    const idLimpo = identificador.trim();
    if (!idLimpo || !senha) {
      setMensagemErro("Preencha o identificador e a senha.");
      return;
    }

    setSubmetendo(true);
    try {
      const resultado = await clienteHttp.post<LoginResposta>(
        "/api/auth/login",
        {
          identificador: idLimpo,
          senha,
        },
      );

      if (!resultado.sucesso) {
        setMensagemErro(resultado.mensagem);
        setSubmetendo(false);
        return;
      }

      setSucesso(true);
      // Navegação completa para a raiz para recarregar com a sessão ativa
      window.location.href = "/";
    } catch {
      setMensagemErro("Falha inesperada ao comunicar com o servidor.");
      setSubmetendo(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
      aria-labelledby="login-titulo"
    >
      {mensagemErro && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {mensagemErro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
        >
          Autenticado com sucesso. Redirecionando...
        </div>
      )}

      <div>
        <label
          htmlFor="identificador"
          className="block text-sm font-medium text-surface-foreground"
        >
          E-mail ou usuário
        </label>
        <input
          id="identificador"
          name="identificador"
          type="text"
          autoComplete="username"
          required
          maxLength={320}
          disabled={submetendo || sucesso}
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-surface-foreground shadow-xs transition-colors placeholder:text-muted-foreground disabled:opacity-50 sm:text-sm"
          placeholder="exemplo@clinica.com.br"
        />
      </div>

      <div>
        <label
          htmlFor="senha"
          className="block text-sm font-medium text-surface-foreground"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          maxLength={4096}
          disabled={submetendo || sucesso}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-surface-foreground shadow-xs transition-colors placeholder:text-muted-foreground disabled:opacity-50 sm:text-sm"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={submetendo || sucesso}
        aria-busy={submetendo}
        className="flex w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submetendo ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
