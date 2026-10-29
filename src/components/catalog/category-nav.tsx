import Link from "next/link";
import type { Category } from "@/types/product";
import { catalogHref } from "@/lib/catalog/url";

type Props = {
  categories: Category[];
  active?: string;
  q?: string;
};

function tabClass(isActive: boolean) {
  return [
    "relative flex h-11 shrink-0 snap-start items-center whitespace-nowrap px-3 text-sm",
    isActive
      ? "font-semibold text-brand-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand-orange"
      : "text-brand-muted hover:text-brand-ink",
  ].join(" ");
}

/** Las principales primero (en su orden), después el resto por nombre. */
function sortTop(a: Category, b: Category) {
  const pa = a.featuredPosition ?? Infinity;
  const pb = b.featuredPosition ?? Infinity;
  return pa !== pb ? pa - pb : a.name.localeCompare(b.name, "es");
}

/**
 * Pestañas con subrayado de acento y desplazamiento horizontal; mantienen la búsqueda activa.
 * Si la categoría elegida tiene subcategorías, se muestran en una segunda fila.
 */
export function CategoryNav({ categories, active, q }: Props) {
  const top = categories.filter((c) => !c.parentSlug).sort(sortTop);
  const current = categories.find((c) => c.slug === active);
  const main = current ? (current.parentSlug ?? current.slug) : undefined;
  const mainCategory = categories.find((c) => c.slug === main);
  const children = main ? categories.filter((c) => c.parentSlug === main) : [];

  return (
    <>
      <nav id="categorias" aria-label="Categorías" className="scroll-mt-4 border-b border-brand-line">
        <ul className="no-scrollbar -mx-3 flex snap-x overflow-x-auto">
          <li>
            <Link
              href={catalogHref({ q })}
              aria-current={!active ? "page" : undefined}
              className={tabClass(!active)}
            >
              Todas
            </Link>
          </li>
          {top.map((c) => (
            <li key={c.slug}>
              <Link
                href={catalogHref({ q, category: c.slug })}
                aria-current={active === c.slug ? "page" : undefined}
                className={tabClass(main === c.slug)}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {mainCategory && children.length > 0 && (
        <nav aria-label={`Subcategorías de ${mainCategory.name}`} className="-mt-2 border-b border-brand-line">
          <ul className="no-scrollbar -mx-3 flex snap-x overflow-x-auto">
            <li>
              <Link
                href={catalogHref({ q, category: mainCategory.slug })}
                aria-current={active === mainCategory.slug ? "page" : undefined}
                className={tabClass(active === mainCategory.slug)}
              >
                Todo {mainCategory.name}
              </Link>
            </li>
            {children.map((c) => (
              <li key={c.slug}>
                <Link
                  href={catalogHref({ q, category: c.slug })}
                  aria-current={active === c.slug ? "page" : undefined}
                  className={tabClass(active === c.slug)}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
