"use client";

import Link from "next/link";

export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="contenido" className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-brand-line bg-surface px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">No pudimos cargar este producto</h1>
        <p className="mt-1 text-brand-muted">Revisá tu conexión e intentá de nuevo.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-lg bg-brand-ink px-5 text-sm font-medium text-on-ink hover:bg-brand-ink/85"
          >
            Reintentar
          </button>
          <Link href="/#catalogo" className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-surface px-5 text-sm font-medium hover:border-brand-ink">
            Ver el catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
