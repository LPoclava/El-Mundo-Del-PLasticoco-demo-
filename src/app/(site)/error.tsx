"use client";

/**
 * Falla la carga del catálogo: la navegación y el pie siguen disponibles y se puede reintentar. La marca
 * data-catalog-ready avisa a la pantalla de carga que no hay nada más que esperar.
 */
export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <span hidden data-catalog-ready />
      <div className="rounded-2xl border border-brand-line bg-surface px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">No pudimos cargar el catálogo</h1>
        <p className="mt-1 text-brand-muted">Revisá tu conexión e intentá de nuevo.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-11 rounded-full bg-brand-orange px-6 text-sm font-semibold text-brand-charcoal hover:brightness-105"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
