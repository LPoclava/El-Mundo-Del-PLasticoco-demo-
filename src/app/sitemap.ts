import type { MetadataRoute } from "next";
import { productPath } from "@/lib/catalog/product";
import { getCatalogPage } from "@/lib/catalog/repository";
import { publicSiteUrl } from "@/lib/site-url";

/** Tope de páginas del catálogo que se recorren (12 productos por página): evita un recorrido sin fin. */
const MAX_PAGES = 200;

/**
 * Portada y fichas de los productos publicados, leídos de la vista pública (la regla de publicación vive en la base).
 * No incluye nada del panel. Sin dominio configurado devuelve una lista vacía: las direcciones del sitemap deben ser
 * absolutas y no se inventan ni se usa localhost.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicSiteUrl();
  if (!site) return [];
  const absolute = (path: string) => new URL(path, site).toString();

  const entries: MetadataRoute.Sitemap = [{ url: absolute("/"), changeFrequency: "daily", priority: 1 }];
  try {
    let page = 1;
    let pageCount = 1;
    do {
      const result = await getCatalogPage({ page });
      for (const product of result.items) {
        entries.push({ url: absolute(productPath(product)), changeFrequency: "weekly", priority: 0.7 });
      }
      pageCount = result.pageCount;
      page += 1;
    } while (page <= pageCount && page <= MAX_PAGES);
  } catch {
    // Si el catálogo no responde, el sitemap lleva al menos la portada en lugar de romper la publicación.
  }
  return entries;
}
