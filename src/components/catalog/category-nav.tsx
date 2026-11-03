import Link from "next/link";
import type { Category } from "@/types/product";
import { catalogHref } from "@/lib/catalog/url";
import { LinkPending } from "./link-pending";

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

/**
 * Los tickets de «Explorá nuestras categorías» son el acceso principal a las categorías. Esta barra NO
 * las repite: solo aparece cuando hace falta
 * - con una categoría elegida: cuál es, cómo salir de ella y sus subcategorías;
 * - sin categoría elegida: únicamente las categorías que no cuelgan de ninguna de las cuatro principales
 *   (si existen), para que sus productos no queden sin acceso.
 */
export function CategoryNav({ categories, active, q }: Props) {
  const top = categories.filter((c) => !c.parentSlug);
  const others = top
    .filter((c) => c.featuredPosition == null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const current = categories.find((c) => c.slug === active);
  const main = current ? (current.parentSlug ?? current.slug) : undefined;
  const mainCategory = categories.find((c) => c.slug === main);
  const children = main ? categories.filter((c) => c.parentSlug === main) : [];

  if (!mainCategory && others.length === 0) return null;

  if (!mainCategory) {
    return (
      <nav aria-label="Otras categorías" className="border-b border-brand-line">
        <ul className="no-scrollbar -mx-3 flex snap-x overflow-x-auto">
          {others.map((c) => (
            <li key={c.slug}>
              <Link href={catalogHref({ q, category: c.slug })} className={tabClass(false)}>
                {c.name}
                <LinkPending variant="bar" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-base font-semibold">
          <span className="sr-only">Categoría elegida: </span>
          {mainCategory.name}
        </p>
        <Link
          href={catalogHref({ q })}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-muted underline underline-offset-4 hover:text-brand-ink"
        >
          Ver todos los productos
        </Link>
      </div>
      {mainCategory.description && <p className="max-w-2xl text-sm text-brand-muted">{mainCategory.description}</p>}
      {children.length > 0 && (
        <nav aria-label={`Subcategorías de ${mainCategory.name}`} className="border-b border-brand-line">
          <ul className="no-scrollbar -mx-3 flex snap-x overflow-x-auto">
            <li>
              <Link
                href={catalogHref({ q, category: mainCategory.slug })}
                aria-current={active === mainCategory.slug ? "page" : undefined}
                className={tabClass(active === mainCategory.slug)}
              >
                Todo {mainCategory.name}
                <LinkPending variant="bar" />
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
                  <LinkPending variant="bar" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
