import Link from "next/link";
import { getCatalogPage } from "@/lib/catalog/repository";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { GlobeMotif } from "./globe-motif";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";

/** Lee la URL (request-time) y consulta; debe renderizarse dentro de <Suspense>. */
export async function CatalogResults({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query } = await resolveCatalogQuery(searchParams);
  const result = await getCatalogPage(query);
  const hasFilters = Boolean(query.q || query.category);

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-4 text-sm">
        <p className="text-brand-ink/65" aria-live="polite">
          {result.total === 1 ? "1 producto" : `${result.total} productos`}
        </p>
        {hasFilters && (
          <Link href="/" className="py-2 font-medium underline underline-offset-4 hover:text-brand-green">
            Quitar filtros
          </Link>
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-brand-line bg-white px-6 py-12 text-center">
          <GlobeMotif className="mx-auto size-10 text-brand-green" />
          {hasFilters ? (
            <>
              <p className="mt-4 text-lg font-semibold">No encontramos ese producto</p>
              <p className="mt-1 text-brand-ink/65">Probá con otra palabra o mirá todo el catálogo.</p>
              <Link
                href={catalogHref({})}
                className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-ink px-5 text-sm font-medium text-white hover:bg-brand-ink/85"
              >
                Ver todo el catálogo
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg font-semibold">Todavía no hay productos publicados</p>
              <p className="mt-1 text-brand-ink/65">Estamos cargando el catálogo. Volvé a visitarnos pronto.</p>
            </>
          )}
        </div>
      ) : (
        <ProductGrid products={result.items} />
      )}

      <Pagination page={result.page} pageCount={result.pageCount} query={query} />
    </>
  );
}

export function CatalogResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando productos" className="animate-pulse">
      <div className="mb-4 h-4 w-24 rounded bg-brand-sand" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="aspect-square rounded-lg bg-brand-sand" />
            <div className="mt-2 h-4 w-3/4 rounded bg-brand-sand" />
            <div className="mt-2 h-4 w-1/3 rounded bg-brand-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}
