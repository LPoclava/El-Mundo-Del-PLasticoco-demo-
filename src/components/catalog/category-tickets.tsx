import Link from "next/link";
import { CATALOG_COPY, CATEGORY_TICKET } from "@/config/catalog-copy";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { CategoryIcon } from "./category-icon";
import { GlobeMotif } from "./globe-motif";
import { LinkPending } from "./link-pending";

/** Columnas de escritorio según cuántas categorías haya: una fila sin huecos. Escritas completas para Tailwind. */
const DESKTOP_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1 lg:max-w-sm",
  2: "lg:grid-cols-2 lg:max-w-3xl",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/**
 * «Explorá nuestras categorías» como boletos de avión. Lee las categorías principales reales (public_categories): las
 * que no tienen productos publicados no llegan, así que un ticket nunca lleva a un catálogo vacío. Número e identidad
 * MP son gráficos; el enlace usa el slug real. Lee la URL: debe renderizarse dentro de <Suspense>.
 */
export async function CategoryTickets({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  const featured = categories
    .filter((c) => c.featuredPosition != null && !c.parentSlug)
    .sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0));
  if (featured.length === 0) return null;

  const active = categories.find((c) => c.slug === query.category);
  const activeMain = active ? (active.parentSlug ?? active.slug) : undefined;
  const oddLast = featured.length % 2 === 1;

  return (
    <section aria-labelledby="categorias-titulo" className="reveal mt-12 sm:mt-16">
      <h2 id="categorias-titulo" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {CATALOG_COPY.categories.title}
      </h2>
      <nav aria-labelledby="categorias-titulo" className="mt-5 sm:mt-6">
        <ul className={`grid grid-cols-2 gap-3 sm:gap-4 ${DESKTOP_COLUMNS[featured.length] ?? DESKTOP_COLUMNS[4]}`}>
          {featured.map((category, i) => (
            // Con cantidad impar, en celular y tablet el último ocupa las dos columnas (no queda un hueco).
            <li key={category.slug} className={oddLast && i === featured.length - 1 ? "col-span-2 lg:col-span-1" : undefined}>
              <Ticket
                slug={category.slug}
                name={category.name}
                number={CATEGORY_TICKET[category.slug] ?? String(i + 1).padStart(3, "0")}
                tone={i % 2 === 0 ? "green" : "orange"}
                href={`${catalogHref({ q: query.q, category: category.slug })}#catalogo`}
                current={activeMain === category.slug}
              />
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function Ticket({ slug, name, number, tone, href, current }: {
  slug: string;
  name: string;
  number: string;
  tone: "green" | "orange";
  href: string;
  current: boolean;
}) {
  const colors = tone === "green" ? "bg-brand-green text-white" : "bg-brand-orange text-brand-charcoal";
  return (
    <div className="ticket-wrap rounded-2xl has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand-ink">
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`ticket group relative flex min-h-36 overflow-clip rounded-2xl outline-none [-webkit-tap-highlight-color:transparent] sm:min-h-40 ${colors}`}
      >
        <GlobeMotif className="pointer-events-none absolute -bottom-10 right-8 size-36 opacity-15 sm:right-12 sm:size-44" />

        <span className="relative flex min-w-0 flex-1 flex-col justify-between gap-3 py-3.5 pl-4 pr-3 sm:py-4 sm:pl-6 sm:pr-4">
          <span className="text-xs font-medium tabular-nums tracking-[0.14em]">MP / {number}</span>
          <span className="min-w-0">
            <CategoryIcon slug={slug} className="size-8 sm:size-9" />
            <span className="mt-1 block truncate text-lg font-semibold leading-tight tracking-tight sm:text-xl">{name}</span>
          </span>
          {/* Trazo de ruta: origen, línea punteada y destino. */}
          <svg viewBox="0 0 120 8" aria-hidden className="h-2 w-full max-w-28" fill="none" stroke="currentColor" strokeLinecap="round">
            <circle cx="4" cy="4" r="2.5" fill="currentColor" stroke="none" />
            <path d="M12 4h96" strokeWidth="1.5" strokeDasharray="1 6" />
            <circle cx="116" cy="4" r="2.5" strokeWidth="1.5" />
          </svg>
        </span>

        <span className="relative grid w-[var(--stub)] shrink-0 place-items-center border-l-2 border-dashed border-current/40">
          {current ? (
            <>
              <span className="sr-only">Categoría elegida</span>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </>
          ) : (
            <svg viewBox="0 0 24 24" className="size-6 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </span>
        <LinkPending />
      </Link>
    </div>
  );
}

export function CategoryTicketsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando categorías" className="mt-12 sm:mt-16">
      <div className="h-8 w-72 max-w-full rounded bg-brand-sand motion-safe:animate-pulse" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-brand-sand motion-safe:animate-pulse sm:h-40" />
        ))}
      </div>
    </div>
  );
}
