import Image from "next/image";
import Link from "next/link";
import { CATALOG_COPY, CATEGORY_TONE } from "@/config/catalog-copy";
import type { Category } from "@/types/product";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { GlobeMotif } from "./globe-motif";
import { SectionHeading } from "./section-heading";

type Tone = "orange" | "green";

const GRID_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** Clases por tono. Escritas completas (Tailwind no detecta nombres armados con variables). */
const TONE = {
  orange: {
    tint: "bg-brand-orange/10",
    tile: "text-brand-orange",
    globe: "text-brand-orange/20",
    chip: "bg-brand-orange text-brand-ink",
    hoverBorder: "hover:border-brand-orange/60",
  },
  green: {
    tint: "bg-brand-green/10",
    tile: "text-brand-green",
    globe: "text-brand-green/20",
    chip: "bg-brand-green text-white",
    hoverBorder: "hover:border-brand-green/60",
  },
} satisfies Record<Tone, Record<string, string>>;

/** Las cuatro categorías principales como accesos grandes. Solo aparecen las que tienen productos publicados. */
export async function MainCategories({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  const featured = categories
    .filter((c) => c.featuredPosition != null && !c.parentSlug)
    .sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0));
  if (featured.length === 0) return null;

  const active = categories.find((c) => c.slug === query.category);
  const activeMain = active ? (active.parentSlug ?? active.slug) : undefined;

  return (
    <section aria-labelledby="categorias-principales" className="mt-6 sm:mt-10">
      <SectionHeading
        id="categorias-principales"
        title={CATALOG_COPY.categories.title}
        subtitle={CATALOG_COPY.categories.subtitle}
      />
      <ul className={`grid grid-cols-2 gap-3 sm:gap-5 ${GRID_COLUMNS[featured.length] ?? GRID_COLUMNS[4]}`}>
        {featured.map((category, i) => (
          <li
            key={category.slug}
            className="motion-safe:animate-[rise-in_0.45s_ease-out_both]"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <CategoryCard
              category={category}
              tone={CATEGORY_TONE[category.slug] ?? (i % 2 === 0 ? "orange" : "green")}
              href={`${catalogHref({ q: query.q, category: category.slug })}#catalogo`}
              current={activeMain === category.slug}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Tarjeta de navegación. Toda la tarjeta es el enlace. Estados:
 * - reposo: sombra discreta; - hover (solo con mouse): se eleva, la imagen amplía apenas y la flecha se
 *   tiñe; - presionada: se hunde un poco (también en pantallas táctiles); - foco de teclado: contorno visible.
 * Con «reducir movimiento» no hay desplazamientos ni zoom: solo cambian sombra y color.
 */
function CategoryCard({ category, tone, href, current }: { category: Category; tone: Tone; href: string; current: boolean }) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm outline-offset-4 [-webkit-tap-highlight-color:transparent] motion-safe:transition motion-safe:duration-200 hover:shadow-lg motion-safe:hover:-translate-y-1 active:shadow-sm active:bg-brand-sand motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] ${
        current ? "border-brand-orange ring-2 ring-brand-orange" : `border-brand-line ${t.hoverBorder}`
      }`}
    >
      <div className={`relative aspect-[3/2] overflow-hidden sm:aspect-[4/3] ${t.tint}`}>
        {category.imageUrl ? (
          // alt vacío: el nombre de la categoría está escrito justo debajo.
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <>
            <GlobeMotif className={`absolute -bottom-8 -right-8 size-32 sm:size-40 ${t.globe}`} />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-20 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-brand-line motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105 sm:size-24">
                <CategoryIcon slug={category.slug} className={`size-12 sm:size-14 ${t.tile}`} />
              </span>
            </span>
          </>
        )}
        {current && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-ink px-2.5 py-1 text-xs font-medium text-white">
            Seleccionada
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-balance sm:text-xl">{category.name}</h3>
          <p className="mt-0.5 text-sm text-brand-muted">{CATALOG_COPY.categories.cta}</p>
        </div>
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-full ${t.chip} motion-safe:transition motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5 group-hover:shadow-md sm:size-10`}
        >
          <svg viewBox="0 0 24 24" className="size-4 sm:size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

/** Íconos decorativos de las cuatro categorías; las demás usan uno genérico. */
function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const common = {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (slug) {
    case "cocina":
      return (
        <svg {...common}>
          <path d="M8 22h32l-3 16a4 4 0 0 1-4 3H15a4 4 0 0 1-4-3L8 22Z" />
          <path d="M6 22h36M18 22v-4a6 6 0 0 1 12 0v4M16 13c0-3 3-3 3-6M24 13c0-3 3-3 3-6" />
        </svg>
      );
    case "bano":
      return (
        <svg {...common}>
          <path d="M6 24h36v4a10 10 0 0 1-10 10H16A10 10 0 0 1 6 28v-4Z" />
          <path d="M12 24V12a5 5 0 0 1 9-3M14 38l-2 4M34 38l2 4" />
        </svg>
      );
    case "libreria":
      return (
        <svg {...common}>
          <path d="M8 8h26a4 4 0 0 1 4 4v28H12a4 4 0 0 1-4-4V8Z" />
          <path d="M8 36a4 4 0 0 1 4-4h26M16 16h14M16 22h10" />
        </svg>
      );
    case "regaleria":
      return (
        <svg {...common}>
          <rect x="6" y="18" width="36" height="8" rx="2" />
          <path d="M9 26v14a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V26M24 18v24" />
          <path d="M24 18c-4 0-10-1-10-6a4 4 0 0 1 7-2l3 8Zm0 0c4 0 10-1 10-6a4 4 0 0 0-7-2l-3 8Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="7" y="7" width="14" height="14" rx="3" />
          <rect x="27" y="7" width="14" height="14" rx="3" />
          <rect x="7" y="27" width="14" height="14" rx="3" />
          <rect x="27" y="27" width="14" height="14" rx="3" />
        </svg>
      );
  }
}

export function MainCategoriesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando categorías" className="mt-8 sm:mt-10">
      <div className="mb-4 h-16 w-72 max-w-full rounded bg-brand-sand motion-safe:animate-pulse sm:mb-5" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-56 rounded-2xl bg-brand-sand motion-safe:animate-pulse sm:h-64" />
        ))}
      </div>
    </div>
  );
}
