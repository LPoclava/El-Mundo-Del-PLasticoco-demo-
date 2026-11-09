import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedImage } from "@/lib/banners/image";
import { friendlyError } from "@/lib/supabase/errors";
import {
  escapeLike, normalizeSearch, orphanedPaths, publishBlockers, removedIds, storagePathFor,
} from "./rules";

/**
 * Acceso a datos de productos con la sesión REAL de quien administra. Cada operación pasa por
 * RLS (gerente o superior) y por las restricciones de las tablas; acá solo se ordena la
 * secuencia para que una falla a medias nunca deje un producto publicado sin foto principal ni
 * archivos huérfanos, y para que reintentar no duplique nada.
 *
 * Convención de rutas (migración 20261028000005): products/{product_id}/{uuid}.webp en el
 * bucket público product-images.
 */
export const BUCKET = "product-images";
export const ADMIN_PAGE_SIZE = 10;

export type ProductImageRow = { id: string; path: string; isPrimary: boolean; position: number };
export type ProductVariantRow = { id: string; size: string | null; color: string | null; price: number | null; position: number };

export type AdminProduct = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  publishEnabled: boolean;
  archivedAt: string | null;
  variants: ProductVariantRow[];
  images: ProductImageRow[];
};

export type ProductListItem = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  categoryId: string;
  publishEnabled: boolean;
  archivedAt: string | null;
  prices: (number | null)[];
  /** Unidades de cada variante (gerente o superior las lee; la base las oculta al público). */
  stocks: number[];
  primaryPath: string | null;
};

export type CategoryOption = { id: string; name: string; parentId: string | null; label: string };

export type StatusFilter = "todos" | "publicados" | "sin-publicar" | "archivados";
export type ListFilters = { q: string; categoryId: string; status: StatusFilter; page: number };

// ---------------------------------------------------------------- errores

type DbError = { code?: string; message?: string; statusCode?: string | number } | null | undefined;

/** Mensajes concretos para las restricciones propias de productos; el resto, los genéricos. */
export function productError(error: DbError): string {
  const message = error?.message ?? "";
  if (error?.code === "23505") {
    if (/barcode/i.test(message)) return "Ese código de barras ya pertenece a otro producto.";
    if (/sku/i.test(message)) return "Ese SKU ya pertenece a otro producto.";
    if (/one_primary_image/i.test(message)) return "Otra persona cambió la foto principal al mismo tiempo. Recargá el producto y probá de nuevo.";
  }
  if (/máximo 5 fotos/i.test(message)) return "Un producto admite como máximo 5 fotos.";
  if (error?.code === "23503") return "La categoría elegida ya no existe. Recargá la pantalla.";
  if (error?.code === "23514") return "Alguno de los datos no es válido. Revisá el nombre, el código de barras, los precios y los largos.";
  return friendlyError(error);
}

/**
 * Falla de guardado. Lleva lo que SÍ quedó guardado (id del producto, fotos y variantes ya
 * insertadas) para que la pantalla pase a modo edición y un reintento no cree duplicados.
 */
export class SaveError extends Error {
  readonly productId: string | null;
  readonly created: boolean;
  readonly images: Record<string, { id: string; path: string }>;
  readonly variants: Record<string, string>;
  constructor(
    message: string,
    productId: string | null,
    created: boolean,
    images: Record<string, { id: string; path: string }>,
    variants: Record<string, string>,
  ) {
    super(message);
    this.name = "SaveError";
    this.productId = productId;
    this.created = created;
    this.images = images;
    this.variants = variants;
  }
}

// ---------------------------------------------------------------- lectura

type ListRow = {
  id: string; name: string; brand: string | null; barcode: string | null; category_id: string;
  publish_enabled: boolean; archived_at: string | null;
  product_variants: { price: number | null; stock: number | null }[] | null;
  product_images: { path: string; is_primary: boolean }[] | null;
};

const LIST_COLUMNS =
  "id,name,brand,barcode,category_id,publish_enabled,archived_at,product_variants(price,stock),product_images(path,is_primary)";

export async function listProducts(db: SupabaseClient, f: ListFilters): Promise<{ items: ProductListItem[]; total: number }> {
  const from = (Math.max(1, f.page) - 1) * ADMIN_PAGE_SIZE;
  let request = db
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("name_sort")
    .order("id")
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  const term = normalizeSearch(f.q);
  if (term) {
    // Solo dígitos: se busca también por código de barras (el texto es seguro dentro del filtro "or").
    request = /^[0-9]+$/.test(term)
      ? request.or(`search_text.ilike.%${term}%,barcode.ilike.%${term}%`)
      : request.ilike("search_text", `%${escapeLike(term)}%`);
  }
  if (f.categoryId) request = request.eq("category_id", f.categoryId);
  if (f.status === "publicados") request = request.eq("publish_enabled", true).is("archived_at", null);
  if (f.status === "sin-publicar") request = request.eq("publish_enabled", false).is("archived_at", null);
  if (f.status === "archivados") request = request.not("archived_at", "is", null);

  const { data, error, count } = await request;
  if (error) throw new Error(productError(error));
  const items = ((data ?? []) as unknown as ListRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    categoryId: r.category_id,
    publishEnabled: r.publish_enabled,
    archivedAt: r.archived_at,
    prices: (r.product_variants ?? []).map((v) => v.price),
    stocks: (r.product_variants ?? []).map((v) => Number(v.stock ?? 0)),
    primaryPath: r.product_images?.find((i) => i.is_primary)?.path ?? null,
  }));
  return { items, total: count ?? 0 };
}

type FullRow = {
  id: string; name: string; description: string | null; brand: string | null; sku: string | null;
  barcode: string | null; category_id: string; publish_enabled: boolean; archived_at: string | null;
  product_variants: { id: string; size: string | null; color: string | null; price: number | null; position: number }[] | null;
  product_images: { id: string; path: string; is_primary: boolean; position: number }[] | null;
};

const FULL_COLUMNS =
  "id,name,description,brand,sku,barcode,category_id,publish_enabled,archived_at,product_variants(id,size,color,price,position),product_images(id,path,is_primary,position)";

export async function getProduct(db: SupabaseClient, id: string): Promise<AdminProduct> {
  const { data, error } = await db
    .from("products")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .order("position", { referencedTable: "product_variants" })
    .order("position", { referencedTable: "product_images" })
    .single();
  if (error) throw new Error(productError(error));
  const r = data as unknown as FullRow;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    brand: r.brand,
    sku: r.sku,
    barcode: r.barcode,
    categoryId: r.category_id,
    publishEnabled: r.publish_enabled,
    archivedAt: r.archived_at,
    variants: (r.product_variants ?? []).map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.price, position: v.position })),
    images: (r.product_images ?? []).map((i) => ({ id: i.id, path: i.path, isPrimary: i.is_primary, position: i.position })),
  };
}

/** "Cocina" para una principal; "Cocina › Utensilios" para una subcategoría. */
function withLabels(rows: { id: string; name: string; parentId: string | null }[]): CategoryOption[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .map((r) => ({ ...r, label: r.parentId && byId.has(r.parentId) ? `${byId.get(r.parentId)!.name} › ${r.name}` : r.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export async function listCategories(db: SupabaseClient): Promise<CategoryOption[]> {
  const full = await db.from("categories").select("id,name,parent_id").order("name");
  if (!full.error) {
    return withLabels((full.data as { id: string; name: string; parent_id: string | null }[]).map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id })));
  }
  // Antes de aplicar la migración de categorías principales la columna parent_id no existe.
  if (full.error.code !== "42703") throw new Error(productError(full.error));
  const legacy = await db.from("categories").select("id,name").order("name");
  if (legacy.error) throw new Error(productError(legacy.error));
  return withLabels((legacy.data as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name, parentId: null })));
}

// ---------------------------------------------------------------- guardado

export type FieldsInput = {
  name: string;
  brand: string | null;
  description: string | null;
  categoryId: string;
  barcode: string | null;
  sku: string | null;
};

export type VariantInput = { key: string; id: string | null; size: string | null; color: string | null; price: number | null };

export type ImageDraft = {
  key: string;
  /** Fila existente en product_images, o null si es una foto nueva. */
  id: string | null;
  path: string | null;
  /** Foto nueva ya procesada, pendiente de subir. */
  image: PreparedImage | null;
  isPrimary: boolean;
};

export type SaveArgs = {
  productId: string | null;
  /** Estado leído de la base antes de editar (null al crear). */
  baseline: AdminProduct | null;
  fields: FieldsInput;
  variants: VariantInput[];
  images: ImageDraft[];
  wantPublished: boolean;
};

export type SaveOutcome = {
  productId: string;
  published: boolean;
  notes: string[];
  /** Archivos que no se pudieron borrar de Storage; no afectan al producto. */
  filesKept: string[];
};

const fieldsRow = (f: FieldsInput) => ({
  name: f.name,
  brand: f.brand,
  description: f.description,
  category_id: f.categoryId,
  barcode: f.barcode,
  sku: f.sku,
});

async function removeFiles(db: SupabaseClient, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { error } = await db.storage.from(BUCKET).remove(paths);
  return error ? paths : [];
}

/**
 * Guarda un producto completo. Orden pensado para no perder nunca una foto buena ni publicar
 * a medias:
 *  1. producto (alta SIEMPRE sin publicar; si se pide despublicar, se despublica primero);
 *  2. subir fotos nuevas y recién después insertar sus filas;
 *  3. variantes (altas y cambios antes de las bajas);
 *  4. foto principal en dos pasos, con compensación si el segundo falla;
 *  5. orden de las fotos y baja de filas;
 *  6. SOLO con las filas ya confirmadas, borrar de Storage los archivos que nadie más usa;
 *  7. publicar al final, y solo si hay foto principal y un precio válido.
 */
export async function saveProduct(db: SupabaseClient, a: SaveArgs): Promise<SaveOutcome> {
  let id = a.productId;
  let created = false;
  const notes: string[] = [];
  const progress = { images: {} as Record<string, { id: string; path: string }>, variants: {} as Record<string, string> };
  const fail = (message: string): never => {
    throw new SaveError(message, id, created, progress.images, progress.variants);
  };

  // 1. Producto.
  if (!id) {
    const { data, error } = await db.from("products").insert({ ...fieldsRow(a.fields), publish_enabled: false }).select("id").single();
    if (error) return fail(productError(error));
    id = (data as { id: string }).id;
    created = true;
  } else {
    if (!a.wantPublished && a.baseline?.publishEnabled) {
      const { error } = await db.from("products").update({ publish_enabled: false }).eq("id", id);
      if (error) return fail(productError(error));
    }
    const { error } = await db.from("products").update(fieldsRow(a.fields)).eq("id", id);
    if (error) return fail(productError(error));
  }
  const productId = id;

  // 2. Fotos nuevas: primero los archivos, después las filas.
  const uploaded: { key: string; path: string }[] = [];
  for (const draft of a.images) {
    if (draft.id || !draft.image) continue;
    const path = storagePathFor(productId, draft.image.extension, crypto.randomUUID());
    const { error } = await db.storage.from(BUCKET).upload(path, draft.image.blob, {
      contentType: draft.image.blob.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      await removeFiles(db, uploaded.map((u) => u.path));
      return fail(`No se pudo subir una foto: ${friendlyError(error)} El producto quedó guardado sin publicar.`);
    }
    uploaded.push({ key: draft.key, path });
  }
  if (uploaded.length > 0) {
    const { data, error } = await db
      .from("product_images")
      .insert(uploaded.map((u) => ({ product_id: productId, path: u.path, is_primary: false, position: 0 })))
      .select("id,path");
    if (error) {
      await removeFiles(db, uploaded.map((u) => u.path)); // las filas no se crearon: no dejar archivos sueltos
      return fail(productError(error));
    }
    for (const row of data as { id: string; path: string }[]) {
      const key = uploaded.find((u) => u.path === row.path)?.key;
      if (key) progress.images[key] = { id: row.id, path: row.path };
    }
  }

  // Filas definitivas, en el orden elegido.
  const rows = a.images.map((d) => ({
    key: d.key,
    id: d.id ?? progress.images[d.key]?.id ?? null,
    path: d.path ?? progress.images[d.key]?.path ?? null,
    isPrimary: d.isPrimary,
  }));

  // 3. Variantes: altas y cambios primero, bajas al final.
  const existingVariantIds = a.baseline?.variants.map((v) => v.id) ?? [];
  for (const [position, v] of a.variants.entries()) {
    const row = { size: v.size, color: v.color, price: v.price, position };
    if (v.id) {
      const { error } = await db.from("product_variants").update(row).eq("id", v.id);
      if (error) return fail(productError(error));
    } else {
      const { data, error } = await db.from("product_variants").insert({ ...row, product_id: productId }).select("id").single();
      if (error) return fail(productError(error));
      progress.variants[v.key] = (data as { id: string }).id;
    }
  }
  const variantsToDelete = removedIds(existingVariantIds, a.variants.map((v) => v.id));
  if (variantsToDelete.length > 0) {
    const { error } = await db.from("product_variants").delete().in("id", variantsToDelete);
    if (error) return fail(productError(error));
  }

  // 4. Foto principal: el índice único admite una sola, así que se hace en dos pasos.
  const wantedPrimary = rows.find((r) => r.isPrimary)?.id ?? rows[0]?.id ?? null;
  const currentPrimary = a.baseline?.images.find((i) => i.isPrimary)?.id ?? null;
  if (wantedPrimary && wantedPrimary !== currentPrimary) {
    if (currentPrimary) {
      const { error } = await db.from("product_images").update({ is_primary: false }).eq("id", currentPrimary);
      if (error) return fail(productError(error));
    }
    const { error } = await db.from("product_images").update({ is_primary: true }).eq("id", wantedPrimary);
    if (error) {
      if (currentPrimary) await db.from("product_images").update({ is_primary: true }).eq("id", currentPrimary); // compensación
      return fail(productError(error));
    }
  }

  // 5. Orden de las fotos y baja de las que se quitaron.
  for (const [position, r] of rows.entries()) {
    if (!r.id) continue;
    const previous = a.baseline?.images.find((i) => i.id === r.id);
    if (previous && previous.position === position) continue;
    const { error } = await db.from("product_images").update({ position }).eq("id", r.id);
    if (error) return fail(productError(error));
  }
  const imagesToDelete = removedIds(a.baseline?.images.map((i) => i.id) ?? [], rows.map((r) => r.id));
  let removedPaths: string[] = [];
  if (imagesToDelete.length > 0) {
    removedPaths = (a.baseline?.images ?? []).filter((i) => imagesToDelete.includes(i.id)).map((i) => i.path);
    const { error } = await db.from("product_images").delete().in("id", imagesToDelete);
    if (error) return fail(productError(error));
  }

  // 6. Con las filas ya confirmadas, recién ahora se borran los archivos que nadie usa.
  let filesKept: string[] = [];
  if (removedPaths.length > 0) {
    const { data } = await db.from("product_images").select("path").in("path", removedPaths);
    const stillUsed = ((data ?? []) as { path: string }[]).map((r) => r.path);
    filesKept = await removeFiles(db, orphanedPaths(removedPaths, stillUsed));
    if (filesKept.length > 0) notes.push("Algunas fotos quitadas quedaron en Storage y se pueden borrar a mano.");
  }

  // 7. Publicación al final, con el estado real de la base.
  let published = false;
  const final = await getProduct(db, productId).catch(() => null);
  if (!final) return { productId, published: false, notes: [...notes, "Se guardó, pero no se pudo releer el producto."], filesKept };
  if (a.wantPublished) {
    const blockers = publishBlockers({ hasPrimaryImage: final.images.some((i) => i.isPrimary), prices: final.variants.map((v) => v.price) });
    if (blockers.length === 0) {
      const { error } = await db.from("products").update({ publish_enabled: true }).eq("id", productId);
      if (error) return fail(productError(error));
      published = true;
    } else {
      notes.push(`Se guardó sin publicar. ${blockers.join(" ")}`);
    }
  }
  return { productId, published, notes, filesKept };
}

/** Archivar no borra nada: solo marca la fecha (y desarchivar la quita). */
export async function setArchived(db: SupabaseClient, id: string, archived: boolean): Promise<void> {
  const { error } = await db.from("products").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(productError(error));
}

export async function setPublished(db: SupabaseClient, id: string, value: boolean): Promise<void> {
  const { error } = await db.from("products").update({ publish_enabled: value }).eq("id", id);
  if (error) throw new Error(productError(error));
}
