import { getCatalogPage, getCategories, type CatalogPage, type CatalogQuery } from "./repository";
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

/**
 * Igual que resolveCatalogQuery pero además trae la página de productos.
 * Categorías y productos se piden a la vez; solo si la categoría de la URL no existe
 * (caso raro) se repite la consulta de productos sin ella.
 */
export async function resolveCatalogView(
  searchParams: Promise<RawParams>,
): Promise<{ query: CatalogQuery; result: CatalogPage }> {
  const parsed = parseCatalogParams(await searchParams);
  const [categories, firstTry] = await Promise.all([getCategories(), getCatalogPage(parsed)]);
  const known = !parsed.category || categories.some((c) => c.slug === parsed.category);
  const query = { ...parsed, category: known ? parsed.category : undefined };
  const result = known ? firstTry : await getCatalogPage(query);
  return { query, result };
}
