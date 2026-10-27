import { getCategories, type CatalogQuery } from "./repository";
import { parseCatalogParams, type RawParams } from "./url";
import type { Category } from "@/types/product";

/** Lee la URL y descarta categorías inexistentes en lugar de mostrar un catálogo vacío. */
export async function resolveCatalogQuery(
  searchParams: Promise<RawParams>,
): Promise<{ query: CatalogQuery; categories: Category[] }> {
  const parsed = parseCatalogParams(await searchParams);
  const categories = await getCategories();
  const category = categories.some((c) => c.slug === parsed.category)
    ? parsed.category
    : undefined;
  return { query: { ...parsed, category }, categories };
}
