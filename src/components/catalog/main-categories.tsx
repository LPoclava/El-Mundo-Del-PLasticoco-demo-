import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/types/product";
import { resolveCatalogQuery } from "@/lib/catalog/query";
import { catalogHref, type RawParams } from "@/lib/catalog/url";

const GRID_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

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
    <section aria-labelledby="categorias-principales" className="mt-6">
      <h2 id="categorias-principales" className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">
        Explorá por categoría
      </h2>
      <ul className={`grid grid-cols-2 gap-3 sm:gap-4 ${GRID_COLUMNS[featured.length] ?? GRID_COLUMNS[4]}`}>
        {featured.map((category, i) => (
          <li key={category.slug}>
            <CategoryCard
              category={category}
              tone={i % 2 === 0 ? "orange" : "green"}
              href={`${catalogHref({ q: query.q, category: category.slug })}#catalogo`}
              current={activeMain === category.slug}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryCard({
  category,
  tone,
  href,
  current,
}: {
  category: Category;
  tone: "orange" | "green";
  href: string;
  current: boolean;
}) {
  const hasImage = Boolean(category.imageUrl);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`group relative flex aspect-[5/4] min-h-32 flex-col justify-end overflow-hidden rounded-xl border p-3 shadow-sm motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-md sm:aspect-[4/3] sm:p-4 ${
        current ? "border-brand-orange ring-2 ring-brand-orange" : "border-brand-line"
      } ${hasImage ? "bg-brand-sand text-white" : tone === "orange" ? "bg-brand-orange/15 text-brand-ink" : "bg-brand-green/15 text-brand-ink"}`}
    >
      {hasImage ? (
        <>
          {/* alt vacío: el nombre de la categoría está escrito sobre la imagen. */}
          <Image
            src={category.imageUrl as string}
            alt=""
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw"
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </>
      ) : (
        <CategoryIcon
          slug={category.slug}
          className={`absolute right-3 top-3 size-14 sm:size-20 ${tone === "orange" ? "text-brand-orange" : "text-brand-green"} motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110`}
        />
      )}
      <span className="relative flex items-center justify-between gap-2 text-lg font-semibold leading-tight sm:text-xl">
        {category.name}
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-full ${hasImage ? "bg-white/90 text-brand-ink" : "bg-white text-brand-ink"} motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5`}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
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
    <div aria-busy="true" aria-label="Cargando categorías" className="mt-6">
      <div className="mb-3 h-7 w-48 rounded bg-brand-sand motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[5/4] min-h-32 rounded-xl bg-brand-sand motion-safe:animate-pulse sm:aspect-[4/3]" />
        ))}
      </div>
    </div>
  );
}
