// TechLab Fisio — Página de Login (/login).
//
// Server Component com formulário acessível para autenticação no sistema.
// Segue os princípios de TLF-BASE-V1: mobile first, acessibilidade e idioma pt-BR.

import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = {
  title: "Login — TechLab Fisio",
  description: "Acesse o sistema de gestão clínica TechLab Fisio.",
};

export default function PaginaLogin() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm">
        <header className="text-center">
          <h1 id="login-titulo" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            TechLab Fisio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe suas credenciais para acessar a clínica
          </p>
        </header>

        <section
          aria-labelledby="login-titulo"
          className="mt-8 rounded-md border border-border bg-surface p-6 shadow-xs sm:p-8"
        >
          <FormularioLogin />
        </section>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="text-primary hover:underline"
          >
            ← Voltar para a página inicial
          </Link>
        </footer>
      </div>
    </main>
  );
}
