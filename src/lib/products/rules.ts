/**
 * Reglas de los productos del panel, compartidas por el formulario y la capa de datos.
 * Reflejan las restricciones de las tablas products / product_variants / product_images
 * (supabase/migrations/20261028000002...): la base es la protección real, estas reglas dan
 * mensajes claros antes de llegar a ella. Sin dependencias de React ni de Supabase: se prueban
 * con node --test.
 */

export const PRODUCT_LIMITS = {
  name: 200,
  description: 2000,
  brand: 80,
  sku: 60,
  variantText: 40,
} as const;

export const PRICE_MAX = 1_000_000_000; // exclusivo, igual que la base
export const BARCODE_PATTERN = /^[0-9]{8,14}$/;

export type VariantDraft = {
  /** Identificador local para React; no se guarda. */
  key: string;
  /** Id real si la variante ya existe en la base. */
  id: string | null;
  size: string;
  color: string;
  /** Texto del campo; vacío = todavía sin precio (la variante no cuenta para publicar). */
  price: string;
};

export type ProductFormValues = {
  name: string;
  brand: string;
  description: string;
  categoryId: string;
  barcode: string;
  sku: string;
  variants: VariantDraft[];
  imageCount: number;
};

export type VariantErrors = { size?: string; color?: string; price?: string; duplicate?: string };

export type ProductFormErrors = {
  name?: string;
  brand?: string;
  description?: string;
  categoryId?: string;
  barcode?: string;
  sku?: string;
  images?: string;
  variants: Record<string, VariantErrors>;
};

/** Pesos enteros. Vacío es válido y significa "sin precio" (null). */
export function parsePrice(raw: string): { ok: true; value: number | null } | { ok: false } {
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (!/^[0-9]+$/.test(text)) return { ok: false };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0 || value >= PRICE_MAX) return { ok: false };
  return { ok: true, value };
}

const tooLong = (value: string, max: number) => value.trim().length > max;

export function validateProductForm(v: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = { variants: {} };
  if (!v.name.trim()) errors.name = "Escribí el nombre del producto.";
  else if (tooLong(v.name, PRODUCT_LIMITS.name)) errors.name = `El nombre admite hasta ${PRODUCT_LIMITS.name} caracteres.`;
  if (tooLong(v.brand, PRODUCT_LIMITS.brand)) errors.brand = `La marca admite hasta ${PRODUCT_LIMITS.brand} caracteres.`;
  if (tooLong(v.description, PRODUCT_LIMITS.description)) {
    errors.description = `La descripción admite hasta ${PRODUCT_LIMITS.description} caracteres.`;
  }
  if (!v.categoryId) errors.categoryId = "Elegí una categoría.";

  const barcode = v.barcode.trim();
  if (barcode && !BARCODE_PATTERN.test(barcode)) errors.barcode = "El código de barras tiene entre 8 y 14 dígitos, solo números.";
  if (tooLong(v.sku, PRODUCT_LIMITS.sku)) errors.sku = `El SKU admite hasta ${PRODUCT_LIMITS.sku} caracteres.`;
  if (v.imageCount > 5) errors.images = "Un producto admite como máximo 5 fotos.";

  const seen = new Map<string, string>();
  for (const variant of v.variants) {
    const e: VariantErrors = {};
    if (tooLong(variant.size, PRODUCT_LIMITS.variantText)) e.size = `Hasta ${PRODUCT_LIMITS.variantText} caracteres.`;
    if (tooLong(variant.color, PRODUCT_LIMITS.variantText)) e.color = `Hasta ${PRODUCT_LIMITS.variantText} caracteres.`;
    if (!parsePrice(variant.price).ok) e.price = "Pesos enteros, mayores que 0 y sin centavos.";
    const signature = `${variant.size.trim().toLowerCase()}|${variant.color.trim().toLowerCase()}`;
    const first = seen.get(signature);
    if (first) e.duplicate = "Ya cargaste una variante con el mismo tamaño y color.";
    else seen.set(signature, variant.key);
    if (Object.keys(e).length > 0) errors.variants[variant.key] = e;
  }
  return errors;
}

export function hasErrors(e: ProductFormErrors): boolean {
  return Object.keys(e.variants).length > 0 || Object.entries(e).some(([k, val]) => k !== "variants" && Boolean(val));
}

/** Motivos por los que un producto NO se mostraría en el catálogo público (misma regla que public_catalog). */
export function publishBlockers(input: {
  hasPrimaryImage: boolean;
  prices: (number | null)[];
}): string[] {
  const reasons: string[] = [];
  if (!input.hasPrimaryImage) reasons.push("Falta una foto principal.");
  if (!input.prices.some((p) => p !== null && p > 0)) reasons.push("Falta al menos una variante con precio válido.");
  return reasons;
}

/** Precios del formulario ya interpretados (los inválidos cuentan como sin precio). */
export function pricesOf(variants: VariantDraft[]): (number | null)[] {
  return variants.map((v) => {
    const parsed = parsePrice(v.price);
    return parsed.ok ? parsed.value : null;
  });
}

export type ListedState = {
  publishEnabled: boolean;
  archivedAt: string | null;
  hasPrimaryImage: boolean;
  prices: (number | null)[];
};

/** Por qué un producto del listado no aparece en el catálogo (vacío = se muestra). */
export function hiddenReasons(p: ListedState): string[] {
  const reasons: string[] = [];
  if (p.archivedAt) reasons.push("Archivado");
  if (!p.publishEnabled) reasons.push("Sin publicar");
  reasons.push(...publishBlockers({ hasPrimaryImage: p.hasPrimaryImage, prices: p.prices }).map((r) => r.replace(/\.$/, "")));
  return reasons;
}

// ---- Fotos: orden y principal ----

export type ImageLike = { isPrimary: boolean };

/** Deja exactamente una principal si hay fotos: la marcada primero, o la primera de la lista. */
export function ensureSinglePrimary<T extends ImageLike>(items: T[]): T[] {
  if (items.length === 0) return items;
  const index = Math.max(0, items.findIndex((i) => i.isPrimary));
  return items.map((item, i) => (item.isPrimary === (i === index) ? item : { ...item, isPrimary: i === index }));
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Ids que existían y ya no están en la lista deseada: son las filas a eliminar. */
export function removedIds(existing: string[], kept: (string | null)[]): string[] {
  const keep = new Set(kept.filter((id): id is string => id !== null));
  return existing.filter((id) => !keep.has(id));
}

/** Rutas de Storage que quedan libres al quitar filas, sin contar las que otras filas siguen usando. */
export function orphanedPaths(removed: string[], stillUsed: string[]): string[] {
  const used = new Set(stillUsed);
  return [...new Set(removed)].filter((path) => !used.has(path));
}

export function storagePathFor(productId: string, extension: string, uuid: string): string {
  return `products/${productId}/${uuid}.${extension}`;
}

/** Normaliza para buscar: minúsculas y sin tildes (igual que products.search_text). */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Escapa los comodines de LIKE para que el texto buscado sea literal. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
