"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-brand-line bg-surface px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">No pudimos cargar el catálogo</h1>
        <p className="mt-1 text-brand-muted">Revisá tu conexión e intentá de nuevo.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 h-11 rounded-lg bg-brand-ink px-5 text-sm font-medium text-white hover:bg-brand-ink/85"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
