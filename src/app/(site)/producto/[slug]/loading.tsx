/** Esqueleto de la ficha mientras se lee el producto. */
export default function Loading() {
  return (
    <main id="contenido" aria-busy="true" aria-label="Cargando producto" className="mx-auto max-w-7xl px-4 pt-2 sm:pt-4">
      <div className="h-11 w-64 max-w-full rounded bg-brand-sand motion-safe:animate-pulse" />
      <div className="mt-2 grid gap-6 sm:mt-3 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
        <div className="aspect-square rounded-2xl bg-brand-sand motion-safe:animate-pulse" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-brand-sand motion-safe:animate-pulse" />
          <div className="h-10 w-40 rounded bg-brand-sand motion-safe:animate-pulse" />
          <div className="h-24 rounded-xl bg-brand-sand motion-safe:animate-pulse" />
          <div className="h-13 w-64 max-w-full rounded-xl bg-brand-sand motion-safe:animate-pulse" />
        </div>
      </div>
    </main>
  );
}
