import Link from "next/link";
import { catalogHref } from "@/lib/catalog/url";
import type { CatalogQuery } from "@/lib/catalog/repository";

type Props = {
  page: number;
  pageCount: number;
  query: CatalogQuery;
};

const base =
  "flex h-11 items-center rounded-lg border border-brand-line bg-surface px-4 text-sm font-medium";

export function Pagination({ page, pageCount, query }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={catalogHref({ ...query, page: page - 1 })} className={`${base} hover:border-brand-ink`}>
          ← Anterior
        </Link>
      ) : (
        <span aria-hidden className={`${base} invisible`}>← Anterior</span>
      )}
      <span className="text-sm text-brand-muted">
        Página {page} de {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={catalogHref({ ...query, page: page + 1 })} className={`${base} hover:border-brand-ink`}>
          Siguiente →
        </Link>
      ) : (
        <span aria-hidden className={`${base} invisible`}>Siguiente →</span>
      )}
    </nav>
  );
}
