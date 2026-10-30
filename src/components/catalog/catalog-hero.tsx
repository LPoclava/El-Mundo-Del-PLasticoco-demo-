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
  const { title, subtitle } = CATALOG_COPY.hero;
  return (
    <section
      aria-labelledby="bienvenida"
      className="relative sm:overflow-hidden sm:rounded-2xl sm:border sm:border-brand-line sm:bg-white sm:px-8 sm:py-10 sm:shadow-sm"
    >
      {/* Eco del globo del logo: decorativo, solo en pantallas anchas. */}
      <GlobeMotif className="pointer-events-none absolute -right-6 -top-12 hidden size-72 text-brand-green/10 sm:block" />
      <GlobeMotif className="pointer-events-none absolute -bottom-16 right-24 hidden size-40 text-brand-orange/15 sm:block" />

      <div className="relative max-w-2xl">
        {/* En celular el logo ya dice el nombre: el título queda solo para lectores de pantalla. */}
        <h1 id="bienvenida" className="sr-only sm:not-sr-only sm:text-4xl sm:font-semibold sm:leading-tight sm:tracking-tight sm:text-balance">
          {title}
        </h1>
        <p className="mt-2 hidden max-w-xl text-lg text-brand-muted text-pretty sm:block">{subtitle}</p>
        <div className="max-w-xl sm:mt-5">{children}</div>
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
