import { cacheLife } from "next/cache";
import type { CatalogProduct, Category } from "@/types/product";
import { getSupabase, isSupabaseConfigured, productImageUrl } from "@/lib/supabase/public";
import { toCatalogProduct } from "./publication-rules";
import { SAMPLE_CATEGORIES, SAMPLE_PRODUCTS } from "./sample-data";

/**
 * Único punto de acceso a datos del catálogo.
 * - Con Supabase configurado: lee las vistas públicas public_catalog y public_categories,
 *   que ya aplican la regla de publicación en la base. Filtra, ordena y pagina en la consulta.
 * - Sin configurar: usa datos de ejemplo.
 */
export const PAGE_SIZE = 12;

export type CatalogQuery = {
  q?: string;
  category?: string;
  page?: number;
};

export type CatalogPage = {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageCount: number;
};

type CatalogRow = {
  id: string;
  name: string;
  brand: string | null;
  category_slug: string;
  image_path: string;
  price: number;
  has_price_range: boolean;
};

const CATALOG_COLUMNS = "id,name,brand,category_slug,image_path,price,has_price_range";

/** Minúsculas y sin tildes: igual que la columna search_text de la base. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Escapa los comodines de LIKE para que el texto buscado sea literal. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * Caché compartida entre visitantes: un cambio de precio o de producto se ve en menos de
 * 2 minutos (fresco 60 s; pasado ese tiempo se renueva; a los 120 s sin visitas se descarta).
 * Evita consultar Supabase en cada visita cuando el catálogo se comparte por WhatsApp.
 */
const CATALOG_CACHE = { stale: 30, revalidate: 60, expire: 120 };

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return SAMPLE_CATEGORIES;
  return fetchCategories();
}

async function fetchCategories(): Promise<Category[]> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const { data, error } = await getSupabase()
    .from("public_categories")
    .select("slug,name")
    .order("name");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []) as Category[];
}

export async function getCatalogPage(query: CatalogQuery): Promise<CatalogPage> {
  return isSupabaseConfigured ? fromSupabase(query) : fromSamples(query);
}

async function fromSupabase(query: CatalogQuery): Promise<CatalogPage> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const supabase = getSupabase();
  const term = query.q ? normalize(query.q).trim() : "";

  const fetchPage = async (page: number) => {
    let request = supabase
      .from("public_catalog")
      .select(CATALOG_COLUMNS, { count: "exact" })
      .order("name_sort")
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (query.category) request = request.eq("category_slug", query.category);
    if (term) request = request.ilike("search_text", `%${escapeLike(term)}%`);
    const { data, error, count } = await request;
    if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
    return { rows: (data ?? []) as CatalogRow[], total: count ?? 0 };
  };

  let page = Math.max(1, query.page ?? 1);
  let { rows, total } = await fetchPage(page);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) {
    page = pageCount;
    ({ rows, total } = await fetchPage(page));
  }

  const items: CatalogProduct[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    categorySlug: r.category_slug,
    imageUrl: productImageUrl(r.image_path),
    price: r.price,
    hasPriceRange: r.has_price_range,
  }));

  return { items, total, page, pageCount };
}

async function fromSamples(query: CatalogQuery): Promise<CatalogPage> {
  const term = query.q ? normalize(query.q) : "";

  const matches = SAMPLE_PRODUCTS.map(toCatalogProduct)
    .filter((p): p is CatalogProduct => p !== null)
    .filter(
      (p) =>
        (!query.category || p.categorySlug === query.category) &&
        (!term || normalize(`${p.name} ${p.brand ?? ""}`).includes(term)),
    );

  const total = matches.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return { items: matches.slice(start, start + PAGE_SIZE), total, page, pageCount };
}
