import { CATALOG_COPY } from "@/config/catalog-copy";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import type { RawParams } from "@/lib/catalog/url";
import { GlobeMotif } from "./globe-motif";
import { SearchForm } from "./search-form";

/**
 * Portada del catálogo: mensaje de bienvenida y buscador. El texto no depende de la URL (se
 * prerenderiza); el buscador sí (recuerda lo buscado), por eso va aparte, dentro de <Suspense>.
 */
export function CatalogHero({ children }: { children: React.ReactNode }) {
  const { eyebrow, title, subtitle } = CATALOG_COPY.hero;
  return (
    <section
      aria-labelledby="bienvenida"
      className="relative overflow-hidden rounded-2xl border border-brand-line bg-white px-5 py-7 shadow-sm sm:px-8 sm:py-10"
    >
      {/* Eco del globo del logo: decorativo y apenas visible. */}
      <GlobeMotif className="pointer-events-none absolute -right-10 -top-12 size-56 text-brand-green/10 sm:-right-6 sm:size-72" />
      <GlobeMotif className="pointer-events-none absolute -bottom-16 right-24 hidden size-40 text-brand-orange/15 sm:block" />

      <div className="relative max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-medium text-brand-green-ink">
          <span aria-hidden className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-brand-orange" />
            <span className="size-2 rounded-full bg-brand-green" />
          </span>
          {eyebrow}
        </p>
        <h1 id="bienvenida" className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-base text-brand-muted text-pretty sm:text-lg">{subtitle}</p>
        <div className="mt-5 max-w-xl">{children}</div>
      </div>
    </section>
  );
}

/** Buscador de la portada. Lee la URL (request-time): renderizar dentro de <Suspense>. */
export async function HeroSearch({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query } = await resolveCatalogQuery(searchParams);
  return <SearchForm q={query.q} category={query.category} />;
}

export function HeroSearchSkeleton() {
  return <div aria-busy="true" aria-label="Cargando buscador" className="h-[3.5rem] rounded-lg bg-brand-sand motion-safe:animate-pulse" />;
}
