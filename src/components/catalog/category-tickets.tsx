import Link from "next/link";
import { CATALOG_COPY, CATEGORY_TICKET } from "@/config/catalog-copy";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { CategoryIcon } from "./category-icon";
import { GlobeMotif } from "./globe-motif";
import { LinkPending } from "./link-pending";

/**
 * «Explorá nuestras categorías» como boletos de viaje. Lee las categorías principales reales (public_categories): las
 * que no tienen productos publicados no llegan, así que un ticket nunca lleva a un catálogo vacío. Número e identidad
 * MP son gráficos y secundarios (no los lee un lector de pantalla); el enlace usa el slug real. Todos miden lo mismo: en
 * celular van de a dos o, con cantidad impar, uno por renglón (ninguno queda suelto ni más grande). Lee la URL: debe
 * renderizarse dentro de <Suspense>.
 */
export async function CategoryTickets({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  const featured = categories
    .filter((c) => c.featuredPosition != null && !c.parentSlug)
    .sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0));
  if (featured.length === 0) return null;

  const active = categories.find((c) => c.slug === query.category);
  const activeMain = active ? (active.parentSlug ?? active.slug) : undefined;
  const odd = featured.length % 2 === 1;

  return (
    <section aria-labelledby="categorias-titulo" className="reveal mt-4 sm:mt-8">
      <h2 id="categorias-titulo" className="font-display text-xl font-extrabold text-balance sm:text-2xl">
        {CATALOG_COPY.categories.title}
      </h2>
      <nav aria-label="Categorías" className="mt-2.5 sm:mt-3">
        <ul className={`flex flex-wrap gap-2 sm:gap-3 ${odd ? "md:flex-nowrap" : "lg:flex-nowrap"}`}>
          {featured.map((category, i) => (
            <li key={category.slug} className={odd ? "w-full md:w-auto md:min-w-0 md:flex-1 md:basis-0" : "w-[calc(50%-0.25rem)] sm:w-[calc(50%-0.375rem)] lg:w-auto lg:min-w-0 lg:flex-1 lg:basis-0"}>
              <Ticket
                slug={category.slug}
                name={category.name}
                number={CATEGORY_TICKET[category.slug] ?? String(i + 1).padStart(3, "0")}
                tone={i % 2 === 0 ? "green" : "orange"}
                href={`${catalogHref({ q: query.q, category: category.slug })}#catalogo`}
                current={activeMain === category.slug}
                wide={odd}
              />
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function Ticket({ slug, name, number, tone, href, current, wide }: {
  slug: string;
  name: string;
  number: string;
  tone: "green" | "orange";
  href: string;
  current: boolean;
  /** A lo ancho en celular: ícono y nombre en una línea, y menos alto. */
  wide: boolean;
}) {
  const colors = tone === "green" ? "bg-brand-green text-white" : "bg-brand-orange text-brand-charcoal";
  return (
    <div className="ticket-wrap h-full rounded-2xl has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand-ink">
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={`ticket group relative flex h-full ${wide ? "min-h-14 md:min-h-24" : "min-h-24"} overflow-clip rounded-2xl outline-none [-webkit-tap-highlight-color:transparent] ${colors}`}
      >
        <GlobeMotif className="pointer-events-none absolute -bottom-8 right-6 size-28 opacity-15 sm:right-10" />

        <span className={`relative flex min-w-0 flex-1 justify-center ${wide ? "flex-row-reverse items-center gap-3 py-1.5 md:flex-col md:items-stretch md:gap-1 md:py-2.5" : "flex-col gap-1 py-2.5"} pl-3 pr-2 sm:pl-5`}>
          <span aria-hidden className={`text-[0.6875rem] font-medium tabular-nums tracking-[0.12em] ${wide ? "shrink-0 max-md:ml-auto" : ""}`}>MP / {number}</span>
          <span className={`flex min-w-0 ${wide ? "flex-1 flex-row items-center gap-2.5" : "flex-col gap-1 sm:flex-row sm:items-center sm:gap-2.5"}`}>
            <CategoryIcon slug={slug} className="size-7 shrink-0 sm:size-9" />
            <span className="min-w-0 font-display text-[1.0625rem] font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-xl">{name}</span>
          </span>
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
            <svg viewBox="0 0 24 24" className="size-5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1 sm:size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    <div aria-busy="true" aria-label="Cargando categorías" className="mt-6 sm:mt-8">
      <div className="h-7 w-72 max-w-full rounded bg-brand-sand motion-safe:animate-pulse" />
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-brand-sand motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
