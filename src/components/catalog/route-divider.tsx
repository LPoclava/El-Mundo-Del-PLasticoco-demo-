import { GlobeMotif } from "./globe-motif";

/** Separador entre categorías y catálogo: una ruta punteada verde con el globo de la marca al medio. Decorativo. */
export function RouteDivider() {
  return (
    <div aria-hidden className="mt-10 flex items-center gap-3 text-brand-green sm:mt-14">
      <span className="h-px flex-1 border-t border-dashed border-brand-green/45" />
      <span className="size-1.5 rounded-full bg-brand-orange" />
      <GlobeMotif className="size-6 shrink-0" />
      <span className="size-1.5 rounded-full bg-brand-orange" />
      <span className="h-px flex-1 border-t border-dashed border-brand-green/45" />
    </div>
  );
}
