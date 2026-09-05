import Link from "next/link";

// Página 404 da fundação (FRONT-F0, achado F0H-01). Substitui a página padrão
// do Next, que é apresentada em inglês e sem landmark. Server Component, sem
// estado e sem dependência nova: reusa os mesmos tokens e classes de page.tsx.
export default function PaginaNaoEncontrada() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl">
        <p className="text-sm font-medium text-muted-foreground">Erro 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Página não encontrada
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <p className="mt-8 text-sm">
          <Link
            href="/"
            className="rounded-md text-primary underline underline-offset-4"
          >
            Voltar para a página inicial
          </Link>
        </p>
      </div>
    </main>
  );
}
