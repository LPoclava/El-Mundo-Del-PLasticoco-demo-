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
      : "text-brand-ink/65 hover:text-brand-ink",
  ].join(" ");
}

/** Pestañas con subrayado de acento y desplazamiento horizontal; mantienen la búsqueda activa. */
export function CategoryNav({ categories, active, q }: Props) {
  return (
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
        {categories.map((c) => (
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
  );
}
