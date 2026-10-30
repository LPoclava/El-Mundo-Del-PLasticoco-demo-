import { resolveCatalogQuery } from "@/lib/catalog/query";
import type { RawParams } from "@/lib/catalog/url";
import { CategoryNav } from "./category-nav";

/** Lee la URL (request-time); debe renderizarse dentro de <Suspense>. */
export async function CatalogControls({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  return <CategoryNav categories={categories} active={query.category} q={query.q} />;
}

export function CatalogControlsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando categorías" className="motion-safe:animate-pulse">
      <div className="h-11 border-b border-brand-line" />
    </div>
  );
}
