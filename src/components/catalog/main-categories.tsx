import Image from "next/image";
import Link from "next/link";
import { CATALOG_COPY, CATEGORY_TONE } from "@/config/catalog-copy";
import type { Category } from "@/types/product";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";
import { GlobeMotif } from "./globe-motif";
import { LinkPending } from "./link-pending";
import { SectionHeading } from "./section-heading";

type Tone = "orange" | "green";

/** Fondo de cada tarjeta mientras carga la ilustración (y de la tarjeta sin foto). Escritas completas para Tailwind. */
const TONE = {
  orange: { tint: "bg-[#fdf1e7]", tile: "text-brand-orange", globe: "text-brand-orange/20" },
  green: { tint: "bg-[#eaf4ec]", tile: "text-brand-green", globe: "text-brand-green/20" },
} satisfies Record<Tone, Record<string, string>>;

/**
 * Columnas según el ANCHO DISPONIBLE (consulta de contenedor), no según la pantalla: en escritorio, junto
 * al banner, quedan en 2 × 2; a todo el ancho (tablet, o sin banners) van en una fila. Con menos de cuatro
 * categorías no quedan huecos.
 */
const WIDE_COLUMNS: Record<number, string> = {
  1: "@2xl:grid-cols-1 @2xl:max-w-xs",
  2: "@2xl:grid-cols-2 @2xl:max-w-2xl",
  3: "@2xl:grid-cols-3",
  4: "@2xl:grid-cols-4",
};

/**
 * Las categorías principales como accesos visuales: la tarjeta es SOLO la ilustración (cada una ya trae su
 * nombre dibujado), sin títulos, textos ni botones debajo. El nombre accesible es el de la categoría.
 * Celular: dos columnas. A todo el ancho: una fila de hasta cuatro. Junto al banner (escritorio): 2 × 2.
 * Solo aparecen las que tienen productos publicados.
 */
export async function MainCategories({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  const featured = categories
    .filter((c) => c.featuredPosition != null && !c.parentSlug)
    .sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0));
  if (featured.length === 0) return null;

  const active = categories.find((c) => c.slug === query.category);
  const activeMain = active ? (active.parentSlug ?? active.slug) : undefined;

  return (
    <section aria-labelledby="categorias-principales" className="@container min-w-0">
      <SectionHeading id="categorias-principales" title={CATALOG_COPY.categories.title} />
      <ul className={`grid grid-cols-2 gap-3 ${WIDE_COLUMNS[featured.length] ?? WIDE_COLUMNS[4]}`}>
        {featured.map((category, i) => (
          <li key={category.slug}>
            <CategoryCard
              category={category}
              tone={CATEGORY_TONE[category.slug] ?? (i % 2 === 0 ? "orange" : "green")}
              href={`${catalogHref({ q: query.q, category: category.slug })}#catalogo`}
              current={activeMain === category.slug}
              eager
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Toda la tarjeta es el enlace. La ilustración se ve completa: la tarjeta tiene su misma proporción (4:3),
 * así que no se recorta ni se deforma. Estados: hover (con mouse) se eleva apenas; al tocar se hunde; la
 * elegida lleva borde y marca; mientras abre la categoría muestra un indicador. Sin zoom de la imagen: ampliar
 * un mapa de bits la desenfoca.
 */
function CategoryCard({ category, tone, href, current, eager }: {
  category: Category; tone: Tone; href: string; current: boolean; eager: boolean;
}) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`group relative block aspect-[4/3] overflow-hidden rounded-xl border-2 ${t.tint} outline-offset-4 [-webkit-tap-highlight-color:transparent] motion-safe:transition motion-safe:duration-200 motion-safe:ease-out hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] active:shadow-none ${
        current ? "border-brand-ink" : "border-transparent hover:border-brand-ink/15"
      }`}
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt={category.name}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 672px) 25vw, 50vw"
          quality={90}
          className="object-cover"
          {...(eager ? { loading: "eager" as const } : {})}
        />
      ) : (
        // Sin ilustración cargada: ícono y nombre visibles (si no, la tarjeta quedaría sin rótulo).
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          <GlobeMotif className={`absolute -bottom-8 -right-8 size-32 ${t.globe}`} />
          <span className="relative grid size-14 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-brand-line sm:size-16">
            <CategoryIcon slug={category.slug} className={`size-9 sm:size-10 ${t.tile}`} />
          </span>
          <span className="relative text-base font-semibold leading-tight">{category.name}</span>
        </span>
      )}
      {current && (
        <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-brand-ink text-white shadow-sm">
          <span className="sr-only">Categoría elegida</span>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
      <LinkPending />
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
    <div aria-busy="true" aria-label="Cargando categorías" className="@container">
      <div className="mb-3 h-7 w-56 max-w-full rounded bg-brand-sand motion-safe:animate-pulse sm:mb-4" />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[4/3] rounded-xl bg-brand-sand motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
