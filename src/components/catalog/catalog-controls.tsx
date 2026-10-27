import { resolveCatalogQuery } from "@/lib/catalog/query";
import type { RawParams } from "@/lib/catalog/url";
import { CategoryNav } from "./category-nav";
import { SearchForm } from "./search-form";

/** Lee la URL (request-time); debe renderizarse dentro de <Suspense>. */
export async function CatalogControls({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { query, categories } = await resolveCatalogQuery(searchParams);
  return (
    <div className="space-y-4">
      <div className="max-w-xl">
        <SearchForm q={query.q} category={query.category} />
      </div>
      <CategoryNav categories={categories} active={query.category} q={query.q} />
    </div>
  );
}

export function CatalogControlsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando buscador" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-[3.5rem] max-w-xl rounded-lg bg-brand-sand" />
      <div className="h-11 border-b border-brand-line" />
    </div>
  );
}
