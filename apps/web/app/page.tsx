import Link from "next/link";

// Página inicial da fundação (FRONT-F0). Server Component, sem estado e
// sem interação: existe apenas para provar bootstrap, roteamento, layout,
// estilos e tokens. Não representa nenhuma funcionalidade do produto.
export default function PaginaInicial() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          TechLab Fisio
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">Fundação do frontend</p>

        <section
          aria-labelledby="fundacao-titulo"
          className="mt-8 rounded-md border border-border bg-surface p-5 text-surface-foreground sm:p-6"
        >
          <h2 id="fundacao-titulo" className="text-base font-medium">
            Estado desta fundação
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Workspace técnico <code>apps/web</code>. Nenhuma funcionalidade do
            produto está implementada nesta sprint.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            <li>Next.js 16 com App Router</li>
            <li>React 19 com Server Components</li>
            <li>TypeScript estrito</li>
            <li>Tailwind CSS 4 com tokens semânticos</li>
          </ul>
          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
            <Link
              href="/configuracoes/horario-funcionamento"
              className="inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-90"
            >
              Horário de funcionamento
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Acessar Login →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
