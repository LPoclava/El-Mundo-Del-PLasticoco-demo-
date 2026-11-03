import { cacheLife } from "next/cache";
import type { CatalogProduct, Category, ProductDetail, PromoBanner } from "@/types/product";
import { isSafeBannerLink } from "@/lib/banners/rules";
import { displayName } from "@/lib/catalog/product";
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
  description?: string | null;
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
  // Cada migración agregó columnas: se prueba de la más nueva a la más vieja, así el sitio funciona
  // con cualquier versión de la base (la columna description llegó con la migración 20261101).
  const attempts = [
    "slug,name,parent_slug,featured_position,image_path,description",
    "slug,name,parent_slug,featured_position,image_path",
    "slug,name",
  ];
  let rows: CategoryRow[] | null = null;
  for (const columns of attempts) {
    const result = await supabase.from("public_categories").select(columns).order("name");
    if (!result.error) {
      rows = (result.data ?? []) as unknown as CategoryRow[];
      break;
    }
    if (!isMissingColumn(result.error)) {
      throw new Error(`No se pudieron leer las categorías: ${result.error.message}`);
    }
  }
  if (!rows) throw new Error("No se pudieron leer las categorías");
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    parentSlug: r.parent_slug ?? null,
    featuredPosition: r.featured_position ?? null,
    description: r.description ?? null,
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
  image_mobile_path?: string | null;
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

  // La columna del arte para celular llega con la migración 20261103000001: sin ella se lee lo anterior.
  const read = (columns: string) =>
    getSupabase().from("public_promo_banners").select(columns).order("position").order("id").limit(10);
  const base = "id,title,body,badge,cta_label,link_url,image_path,image_alt";
  let { data, error } = await read(`${base},image_mobile_path`);
  if (error && isMissingColumn(error)) ({ data, error } = await read(base));
  if (error) {
    console.error(`No se pudieron leer los banners: ${error.message}`);
    return [];
  }
  return ((data ?? []) as unknown as BannerRow[]).map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    badge: b.badge,
    ctaLabel: b.cta_label,
    linkUrl: b.link_url && isSafeBannerLink(b.link_url) ? b.link_url : null,
    imageUrl: productImageUrl(b.image_path),
    mobileImageUrl: b.image_mobile_path ? productImageUrl(b.image_mobile_path) : null,
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
    name: displayName(r.name),
    brand: r.brand,
    categorySlug: r.category_slug,
    imageUrl: productImageUrl(r.image_path),
    price: r.price,
    hasPriceRange: r.has_price_range,
  }));

  return { items, total, page, pageCount };
}

type DetailRow = CatalogRow & { description: string | null; main_category_slug?: string | null };
type ImageRow = { path: string; is_primary: boolean; position: number };
type VariantRow = { id: string; size: string | null; color: string | null; price: number; position: number };

/** La vista todavía no existe en la base (migración 20261102000001 sin aplicar). */
function isMissingRelation(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message ?? "");
}

/**
 * Ficha de un producto. Devuelve null si no existe, no está publicado o está archivado: la vista
 * public_catalog ya aplica la regla de publicación, así que una URL directa no expone nada más.
 */
export async function getProduct(id: string): Promise<ProductDetail | null> {
  if (!isSupabaseConfigured) return null;
  return fetchProduct(id);
}

async function fetchProduct(id: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const supabase = getSupabase();
  const [row, images, variants, categories] = await Promise.all([
    supabase
      .from("public_catalog")
      .select(`${CATALOG_COLUMNS},description,main_category_slug`)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("public_product_images").select("path,is_primary,position").eq("product_id", id),
    supabase.from("public_product_variants").select("id,size,color,price,position").eq("product_id", id),
    fetchCategories(),
  ]);
  if (row.error) throw new Error(`No se pudo leer el producto: ${row.error.message}`);
  const p = row.data as DetailRow | null;
  if (!p) return null;

  // Sin las vistas de la ficha se muestra lo que ya publica el catálogo: foto principal y precio general.
  for (const r of [images, variants]) {
    if (r.error && !isMissingRelation(r.error)) throw new Error(`No se pudo leer el producto: ${r.error.message}`);
  }
  const imageRows = images.error ? [] : ((images.data ?? []) as ImageRow[]);
  const variantRows = variants.error ? [] : ((variants.data ?? []) as VariantRow[]);

  const sortedImages = [...imageRows].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position);
  const imageList = sortedImages.length
    ? sortedImages.map((i) => ({ url: productImageUrl(i.path), isPrimary: i.is_primary }))
    : [{ url: productImageUrl(p.image_path), isPrimary: true }];

  const name = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  const main = p.main_category_slug && p.main_category_slug !== p.category_slug ? p.main_category_slug : null;

  return {
    id: p.id,
    name: displayName(p.name),
    brand: p.brand,
    description: p.description?.trim() || null,
    category: { slug: p.category_slug, name: name(p.category_slug) },
    parentCategory: main ? { slug: main, name: name(main) } : null,
    images: imageList,
    variants: [...variantRows]
      .sort((a, b) => a.position - b.position || a.price - b.price)
      .map((v) => ({ id: v.id, size: v.size, color: v.color, price: Number(v.price) })),
    price: Number(p.price),
    hasPriceRange: p.has_price_range,
  };
}

/** Hasta 6 productos publicados de la misma categoría principal (o de la misma categoría). */
export async function getRelatedProducts(product: ProductDetail): Promise<CatalogProduct[]> {
  if (!isSupabaseConfigured) return [];
  return fetchRelated(product.id, product.parentCategory?.slug ?? product.category.slug);
}

async function fetchRelated(id: string, categorySlug: string): Promise<CatalogProduct[]> {
  "use cache";
  cacheLife(CATALOG_CACHE);

  const request = (column: string) =>
    getSupabase().from("public_catalog").select(CATALOG_COLUMNS).eq(column, categorySlug).neq("id", id).order("name_sort").limit(6);
  let result = await request("main_category_slug");
  if (result.error && isMissingColumn(result.error)) result = await request("category_slug");
  if (result.error) {
    // Los relacionados son un extra: si fallan, la ficha se muestra igual.
    console.error(`No se pudieron leer los productos relacionados: ${result.error.message}`);
    return [];
  }
  return ((result.data ?? []) as CatalogRow[]).map((r) => ({
    id: r.id,
    name: displayName(r.name),
    brand: r.brand,
    categorySlug: r.category_slug,
    imageUrl: productImageUrl(r.image_path),
    price: r.price,
    hasPriceRange: r.has_price_range,
  }));
}
