import Link from "next/link";
import { CATALOG_COPY, CATEGORY_TICKET } from "@/config/catalog-copy";
import { getDiscovery, getPromoBanners } from "@/lib/catalog/repository";
import { catalogHref, parseCatalogParams, type RawParams } from "@/lib/catalog/url";
import { CategoryIcon } from "./category-icon";
import { ProductCard } from "./product-card";

/**
 * «Todo lo que necesitás, en un mismo lugar» hecho recorrido: un vistazo REAL a cada rubro del local, con sus productos
 * en un carril que se desliza (cada rubro con su banda de boleto, igual que las categorías). Se pueden agregar al pedido
 * ahí mismo. Todo sale del catálogo publicado: un rubro sin productos no aparece y, sin ninguno, la sección no se
 * muestra. El acceso a promociones solo existe si hay banners vigentes. Con una búsqueda o un filtro activo no se muestra
 * (el catálogo filtrado ya es el contenido). Lee la URL: debe renderizarse dentro de <Suspense>.
 */
export async function DiscoverySection({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { q, category } = parseCatalogParams(await searchParams);
  if (q || category) return null;
  const [groups, banners] = await Promise.all([getDiscovery(), getPromoBanners().catch(() => [])]);
  if (groups.length === 0) return null;
  const { discovery } = CATALOG_COPY;

  return (
    <section id="descubrir" aria-labelledby="descubrir-titulo" className="mt-8 scroll-mt-4 sm:mt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-green-ink">
            <span aria-hidden className="flex items-center gap-1">
              <span className="h-1 w-8 rounded-full bg-brand-orange" />
              <span className="h-1 w-3 rounded-full bg-brand-green" />
            </span>
            {discovery.kicker}
          </p>
          <h2 id="descubrir-titulo" className="mt-1.5 font-display text-2xl font-extrabold leading-tight text-balance sm:text-[1.75rem]">{discovery.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-muted text-pretty sm:text-[0.9375rem]">{discovery.text}</p>
        </div>
        {banners.length > 0 && (
          <Link href="/#promociones" className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-brand-orange px-4 text-sm font-semibold text-brand-orange-ink hover:bg-brand-orange/10 motion-safe:transition-colors">
            Ver promociones vigentes
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        )}
      </div>

      <div className="mt-5 space-y-7 sm:space-y-9">
        {groups.map(({ category: cat, products }, i) => {
          const green = i % 2 === 0;
          const number = CATEGORY_TICKET[cat.slug] ?? String(i + 1).padStart(3, "0");
          const headingId = `descubrir-${cat.slug}`;
          return (
            <div key={cat.slug}>
              {/* Banda de boleto del rubro: mismo lenguaje que las categorías (numeración gráfica MP y talón). */}
              <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 sm:px-4 ${green ? "bg-brand-green text-white" : "bg-brand-orange text-brand-charcoal"}`}>
                <CategoryIcon slug={cat.slug} className="size-7 shrink-0 sm:size-8" />
                <div className="min-w-0 flex-1">
                  <p aria-hidden className="text-[0.6875rem] font-medium tabular-nums tracking-[0.12em]">MP / {number}</p>
                  <h3 id={headingId} className="truncate font-display text-lg font-extrabold leading-tight sm:text-xl">{cat.name}</h3>
                </div>
                <Link
                  href={`${catalogHref({ category: cat.slug })}#catalogo`}
                  aria-label={`${discovery.seeAll} ${cat.name}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-current/50 px-3.5 text-sm font-semibold hover:bg-white/15 motion-safe:transition-colors"
                >
                  {discovery.seeAll}
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              </div>

              <ul
                role="region"
                aria-labelledby={headingId}
                tabIndex={0}
                className="rail -mx-3 mt-3 flex gap-3 overflow-x-auto px-3 pb-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand-ink sm:-mx-4 sm:px-4"
              >
                {products.map((p) => (
                  <li key={p.id} className="w-44 shrink-0 sm:w-52">
                    <ProductCard product={p} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DiscoverySkeleton() {
  return (
    <div aria-hidden className="mt-8 sm:mt-12">
      <div className="h-7 w-72 max-w-full rounded bg-brand-sand motion-safe:animate-pulse" />
      <div className="mt-5 h-14 rounded-2xl bg-brand-sand motion-safe:animate-pulse" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-72 w-44 shrink-0 rounded-2xl bg-brand-sand motion-safe:animate-pulse sm:w-52" />
        ))}
      </div>
    </div>
  );
}
