// TechLab Fisio — Página de horário de funcionamento (/configuracoes/horario-funcionamento).
//
// Server Component: estrutura e metadados. A edição (Client Component) consome
// `GET`/`PUT /api/horario-funcionamento` (CFG-002; `docs/14` D-CFG-66). A
// autorização é do backend (`clinica.configurar`); a tela apenas reflete 401/403.

import type { Metadata } from "next";
import Link from "next/link";
import { EditorGrade } from "./editor-grade";

export const metadata: Metadata = {
  title: "Horário de funcionamento — TechLab Fisio",
  description: "Configure a grade semanal de funcionamento da clínica.",
};

export default function PaginaHorarioFuncionamento() {
  return (
    <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <h1 id="horario-titulo" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Horário de funcionamento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina, para cada dia da semana, as janelas em que a clínica funciona. Dia sem janela fica fechado.
            A alteração vale para novos agendamentos e remarcações; agendamentos existentes não são alterados.
          </p>
        </header>

        <section aria-labelledby="horario-titulo" className="mt-6">
          <EditorGrade />
        </section>

        <footer className="mt-8 text-sm">
          <Link href="/" className="text-primary hover:underline">
            ← Voltar para a página inicial
          </Link>
        </footer>
      </div>
    </main>
  );
}
