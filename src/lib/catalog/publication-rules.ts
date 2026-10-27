import type { CatalogProduct, Product } from "@/types/product";

/**
 * Regla de publicación: habilitado + foto principal válida + al menos una variante
 * con precio válido. Las variantes sin precio no cuentan. Se aplica en la capa de
 * consulta (repository), no en la UI. Con Supabase esta misma regla debe vivir en
 * la base (vista pública y RLS); ver docs/modelo-de-datos.md.
 */
export function toCatalogProduct(product: Product): CatalogProduct | null {
  if (!product.publishEnabled) return null;

  const image = product.images.find((i) => i.isPrimary && i.url.trim() !== "");
  if (!image) return null;

  const prices = product.variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;

  const price = Math.min(...prices);
  return {
    id: product.id,
    name: product.name,
    categorySlug: product.categorySlug,
    brand: product.brand,
    imageUrl: image.url,
    price,
    hasPriceRange: prices.some((p) => p !== price),
  };
}
