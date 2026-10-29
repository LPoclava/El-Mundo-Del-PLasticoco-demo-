import { cacheLife } from "next/cache";
import type { CatalogProduct, Category, PromoBanner } from "@/types/product";
import { isSafeBannerLink } from "@/lib/banners/rules";
import { getSupabase, isSupabaseConfigured, productImageUrl } from "@/lib/supabase/public";

/**
 * Único punto de acceso a datos del catálogo.
 * - Con Supabase configurado: lee las vistas públicas public_catalog y public_categories,
 *   que ya aplican la regla de publicación en la base. Filtra, ordena y pagina en la consulta.
 * - Sin configurar: el catálogo queda vacío (no hay datos de ejemplo).
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

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  if (!isSupabaseConfigured) return [];
  return fetchCategories();
}

type CategoryRow = {
  slug: string;
  name: string;
  parent_slug?: string | null;
  featured_position?: number | null;
  image_path?: string | null;
};

/**
 * Columnas agregadas por la migración 20261030000001 (jerarquía de categorías). Mientras esa
 * migración no esté aplicada en la base, PostgREST responde con un error de columna inexistente
 * (42703 / PGRST204): el sitio sigue funcionando con el esquema anterior.
 */
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message ?? "");
}

async function fetchCategories(): Promise<Category[]> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const supabase = getSupabase();
  const full = await supabase
    .from("public_categories")
    .select("slug,name,parent_slug,featured_position,image_path")
    .order("name");
  let rows: CategoryRow[];
  if (full.error) {
    if (!isMissingColumn(full.error)) {
      throw new Error(`No se pudieron leer las categorías: ${full.error.message}`);
    }
    const legacy = await supabase.from("public_categories").select("slug,name").order("name");
    if (legacy.error) throw new Error(`No se pudieron leer las categorías: ${legacy.error.message}`);
    rows = (legacy.data ?? []) as CategoryRow[];
  } else {
    rows = (full.data ?? []) as CategoryRow[];
  }
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    parentSlug: r.parent_slug ?? null,
    featuredPosition: r.featured_position ?? null,
    imageUrl: r.image_path ? productImageUrl(r.image_path) : null,
  }));
}

type BannerRow = {
  id: string;
  title: string | null;
  body: string | null;
  badge: string | null;
  cta_label: string | null;
  link_url: string | null;
  image_path: string;
  image_alt: string | null;
};

/**
 * Banners vigentes, en el orden definido en el panel. La vista public_promo_banners ya filtra
 * por estado y fechas en la base. Si la vista todavía no existe o falla la consulta, el carrusel
 * se oculta: una promoción no debe romper el catálogo.
 */
export async function getPromoBanners(): Promise<PromoBanner[]> {
  if (!isSupabaseConfigured) return [];
  return fetchPromoBanners();
}

async function fetchPromoBanners(): Promise<PromoBanner[]> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const { data, error } = await getSupabase()
    .from("public_promo_banners")
    .select("id,title,body,badge,cta_label,link_url,image_path,image_alt")
    .order("position")
    .order("id")
    .limit(10);
  if (error) {
    console.error(`No se pudieron leer los banners: ${error.message}`);
    return [];
  }
  return ((data ?? []) as BannerRow[]).map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    badge: b.badge,
    ctaLabel: b.cta_label,
    linkUrl: b.link_url && isSafeBannerLink(b.link_url) ? b.link_url : null,
    imageUrl: productImageUrl(b.image_path),
    imageAlt: b.image_alt,
  }));
}

export async function getCatalogPage(query: CatalogQuery): Promise<CatalogPage> {
  return isSupabaseConfigured ? fromSupabase(query) : { items: [], total: 0, page: 1, pageCount: 1 };
}

async function fromSupabase(query: CatalogQuery): Promise<CatalogPage> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const supabase = getSupabase();
  const term = query.q ? normalize(query.q).trim() : "";

  // Una categoría principal incluye los productos de sus subcategorías (main_category_slug).
  // Antes de aplicar la migración esa columna no existe: se filtra solo por la categoría exacta.
  let hierarchy = true;
  const fetchPage = async (page: number): Promise<{ rows: CatalogRow[]; total: number }> => {
    let request = supabase
      .from("public_catalog")
      .select(CATALOG_COLUMNS, { count: "exact" })
      .order("name_sort")
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (query.category) {
      // El slug llega de la URL: solo se arma el filtro "o" si tiene la forma de un slug.
      request =
        hierarchy && SLUG.test(query.category)
          ? request.or(`category_slug.eq.${query.category},main_category_slug.eq.${query.category}`)
          : request.eq("category_slug", query.category);
    }
    if (term) request = request.ilike("search_text", `%${escapeLike(term)}%`);
    const { data, error, count } = await request;
    if (error) {
      if (hierarchy && query.category && isMissingColumn(error)) {
        hierarchy = false;
        return fetchPage(page);
      }
      throw new Error(`No se pudo leer el catálogo: ${error.message}`);
    }
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
