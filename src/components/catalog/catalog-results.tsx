import Link from "next/link";
import { resolveCatalogView } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { ContactIcon } from "@/components/contact/contact-icon";
import { generalInquiryHref } from "@/lib/contact";
import { GlobeMotif } from "./globe-motif";
import { Pagination } from "./pagination";
import { GRID_CLASS, ProductGrid } from "./product-grid";

/** Lee la URL (request-time) y consulta; debe renderizarse dentro de <Suspense>. */
export async function CatalogResults({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, result } = await resolveCatalogView(searchParams);
  const hasFilters = Boolean(query.q || query.category);
  const whatsapp = generalInquiryHref(
    query.q ? `Hola, estoy buscando «${query.q}» y no lo encontré en el catálogo. ¿Me pueden ayudar?` : "Hola, estoy buscando un producto que no encontré en el catálogo. ¿Me pueden ayudar?",
  );

  return (
    <>
      <h2 className="sr-only">Productos</h2>
      <div className="mb-4 flex items-center justify-between gap-4 text-sm">
        <p className="text-brand-muted" aria-live="polite">
          {query.q ? (
            <>
              <span className="font-medium text-brand-ink">
                {result.total === 0 ? "Sin resultados" : result.total === 1 ? "1 resultado" : `${result.total} resultados`}
              </span>{" "}
              para «{query.q}»
            </>
          ) : result.total === 1 ? (
            "1 producto"
          ) : (
            `${result.total} productos`
          )}
        </p>
        {hasFilters && (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4 hover:decoration-2"
          >
            {query.q ? "Ver todo el catálogo" : "Quitar filtros"}
          </Link>
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-brand-line bg-surface px-6 py-12 text-center">
          <GlobeMotif className="mx-auto size-10 text-brand-green" />
          {hasFilters ? (
            <>
              <p className="mt-4 text-lg font-semibold">No encontramos ese producto</p>
              <p className="mt-1 text-brand-muted">¿Buscás algo en particular? Escribinos por WhatsApp y te ayudamos.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-green px-5 text-sm font-semibold text-white hover:bg-brand-green-ink"
                  >
                    <ContactIcon id="whatsapp" className="size-5" />
                    Escribirnos por WhatsApp
                  </a>
                )}
                <Link
                  href={catalogHref({})}
                  className="inline-flex min-h-11 items-center rounded-lg border border-brand-line bg-surface px-5 text-sm font-medium hover:border-brand-ink"
                >
                  Ver todo el catálogo
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg font-semibold">Todavía no hay productos publicados</p>
              <p className="mt-1 text-brand-muted">Estamos cargando el catálogo. Volvé a visitarnos pronto.</p>
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
    <div aria-busy="true" aria-label="Cargando productos" className="motion-safe:animate-pulse">
      <div className="mb-4 h-6 w-24 rounded bg-brand-sand" />
      <div className={GRID_CLASS}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-brand-green/15 bg-surface">
            <div className="aspect-square bg-brand-sand" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-brand-sand" />
              <div className="h-5 w-1/3 rounded bg-brand-sand" />
              <div className="h-9 rounded-lg bg-brand-sand" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
