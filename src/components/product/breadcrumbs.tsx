import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** Inicio > Categoría > Producto. El último paso es la página actual (sin enlace). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-x-1 text-sm text-brand-muted">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-x-1">
            {i > 0 && (
              <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            )}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-brand-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="line-clamp-1 font-medium text-brand-ink">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
