import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/lib/supabase/errors";
import type { PreparedImage } from "./image";

/**
 * Acceso a datos del panel de banners con la sesión real de quien administra. Toda operación
 * pasa por RLS y por las restricciones de la tabla promo_banners: acá solo se orquesta el orden
 * (subir archivo, guardar fila, limpiar lo que quedó huérfano si algo falla).
 */
export const BUCKET = "product-images";

export type AdminBanner = {
  id: string;
  title: string | null;
  body: string | null;
  badge: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  imageAlt: string | null;
  imagePath: string;
  mobileImagePath: string | null;
  isActive: boolean;
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

export type BannerInput = {
  title: string | null;
  body: string | null;
  badge: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  imageAlt: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type Row = {
  id: string; title: string | null; body: string | null; badge: string | null; cta_label: string | null;
  link_url: string | null; image_alt: string | null; image_path: string; image_mobile_path?: string | null; is_active: boolean;
  position: number; starts_at: string | null; ends_at: string | null; updated_at: string;
};

const LEGACY_COLUMNS = "id,title,body,badge,cta_label,link_url,image_alt,image_path,is_active,position,starts_at,ends_at,updated_at";
const FULL_COLUMNS = `${LEGACY_COLUMNS},image_mobile_path`;
/** La columna image_mobile_path llega con la migración 20261103000001; listBanners detecta si ya está aplicada. */
let mobileColumnAvailable = true;
const columns = () => (mobileColumnAvailable ? FULL_COLUMNS : LEGACY_COLUMNS);
const MIGRATION_PENDING = "Para guardar una imagen de celular falta aplicar la migración 20261103000001 en la base de datos.";

/** Cambios en el arte para celular: null reemplaza por la imagen dada o, con remove, la quita. */
export type MobileImageChange = { image: PreparedImage | null; remove: boolean };

const fromRow = (r: Row): AdminBanner => ({
  id: r.id, title: r.title, body: r.body, badge: r.badge, ctaLabel: r.cta_label, linkUrl: r.link_url,
  imageAlt: r.image_alt, imagePath: r.image_path, mobileImagePath: r.image_mobile_path ?? null, isActive: r.is_active, position: r.position,
  startsAt: r.starts_at, endsAt: r.ends_at, updatedAt: r.updated_at,
});

const toRow = (b: BannerInput) => ({
  title: b.title, body: b.body, badge: b.badge, cta_label: b.ctaLabel, link_url: b.linkUrl,
  image_alt: b.imageAlt, is_active: b.isActive, starts_at: b.startsAt, ends_at: b.endsAt,
});

export async function listBanners(db: SupabaseClient): Promise<AdminBanner[]> {
  const read = (cols: string) => db.from("promo_banners").select(cols).order("position").order("created_at");
  mobileColumnAvailable = true;
  let { data, error } = await read(FULL_COLUMNS);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    mobileColumnAvailable = false;
    ({ data, error } = await read(LEGACY_COLUMNS));
  }
  if (error) throw new Error(friendlyError(error));
  return ((data ?? []) as unknown as Row[]).map(fromRow);
}

async function upload(db: SupabaseClient, folder: "banners" | "categories", image: PreparedImage): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.${image.extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(friendlyError(error));
  return path;
}

/** Borra un archivo; devuelve false si no se pudo (no es un error para quien administra). */
export async function removeFile(db: SupabaseClient, path: string): Promise<boolean> {
  const { error } = await db.storage.from(BUCKET).remove([path]);
  return !error;
}

/** Cuenta cuántas filas de promo_banners usan una ruta; se consulta antes de borrar un archivo. */
async function isPathInUse(db: SupabaseClient, path: string): Promise<boolean> {
  const { count, error } = await db.from("promo_banners").select("id", { count: "exact", head: true }).eq("image_path", path);
  // Ante la duda no se borra: un archivo huérfano es inofensivo, uno borrado de más rompe un banner.
  return error ? true : (count ?? 0) > 0;
}

export async function createBanner(db: SupabaseClient, input: BannerInput, image: PreparedImage, nextPosition: number, mobileImage: PreparedImage | null = null): Promise<AdminBanner> {
  if (mobileImage && !mobileColumnAvailable) throw new Error(MIGRATION_PENDING);
  const path = await upload(db, "banners", image);
  const mobilePath = mobileImage ? await upload(db, "banners", mobileImage) : null;
  const { data, error } = await db
    .from("promo_banners")
    .insert({ ...toRow(input), image_path: path, ...(mobilePath ? { image_mobile_path: mobilePath } : {}), position: nextPosition })
    .select(columns())
    .single();
  if (error) {
    // La fila no se creó: no dejar archivos sueltos.
    await removeFile(db, path);
    if (mobilePath) await removeFile(db, mobilePath);
    throw new Error(friendlyError(error));
  }
  return fromRow(data as unknown as Row);
}

/** Con `image` reemplaza la foto: sube la nueva, actualiza la fila y recién entonces borra la vieja. */
export async function updateBanner(
  db: SupabaseClient,
  current: AdminBanner,
  input: BannerInput,
  image: PreparedImage | null,
  mobile: MobileImageChange = { image: null, remove: false },
): Promise<{ banner: AdminBanner; oldFileKept: boolean }> {
  if (mobile.image && !mobileColumnAvailable) throw new Error(MIGRATION_PENDING);
  const newPath = image ? await upload(db, "banners", image) : null;
  const newMobilePath = mobile.image ? await upload(db, "banners", mobile.image) : null;
  const mobileChange = newMobilePath ? { image_mobile_path: newMobilePath } : mobile.remove ? { image_mobile_path: null } : {};
  const { data, error } = await db
    .from("promo_banners")
    .update({ ...toRow(input), ...(newPath ? { image_path: newPath } : {}), ...mobileChange })
    .eq("id", current.id)
    .select(columns())
    .single();
  if (error) {
    if (newPath) await removeFile(db, newPath);
    if (newMobilePath) await removeFile(db, newMobilePath);
    throw new Error(friendlyError(error));
  }
  if ((newMobilePath || mobile.remove) && current.mobileImagePath) await removeFile(db, current.mobileImagePath);
  let oldFileKept = false;
  if (newPath && newPath !== current.imagePath) {
    oldFileKept = (await isPathInUse(db, current.imagePath)) || !(await removeFile(db, current.imagePath));
  }
  return { banner: fromRow(data as unknown as Row), oldFileKept };
}

export async function setBannerActive(db: SupabaseClient, id: string, isActive: boolean): Promise<void> {
  const { error } = await db.from("promo_banners").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(friendlyError(error));
}

export async function deleteBanner(db: SupabaseClient, banner: AdminBanner): Promise<{ fileKept: boolean }> {
  const { error } = await db.from("promo_banners").delete().eq("id", banner.id);
  if (error) throw new Error(friendlyError(error));
  const fileKept = (await isPathInUse(db, banner.imagePath)) || !(await removeFile(db, banner.imagePath));
  if (banner.mobileImagePath) await removeFile(db, banner.mobileImagePath);
  return { fileKept };
}

export async function reorderBanners(db: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await db.rpc("reorder_promo_banners", { ids });
  if (error) throw new Error(friendlyError(error));
}

// ---- Categorías principales (foto de la tarjeta) ----

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  featuredPosition: number | null;
  imagePath: string | null;
};

export async function listMainCategories(db: SupabaseClient): Promise<AdminCategory[]> {
  const { data, error } = await db
    .from("categories")
    .select("id,name,slug,featured_position,image_path")
    .not("featured_position", "is", null)
    .order("featured_position");
  if (error) {
    // Antes de aplicar la migración las columnas no existen: la sección simplemente no se muestra.
    if (error.code === "42703") return [];
    throw new Error(friendlyError(error));
  }
  return (data as { id: string; name: string; slug: string; featured_position: number | null; image_path: string | null }[]).map((c) => ({
    id: c.id, name: c.name, slug: c.slug, featuredPosition: c.featured_position, imagePath: c.image_path,
  }));
}

export async function setCategoryImage(db: SupabaseClient, category: AdminCategory, image: PreparedImage | null): Promise<void> {
  const newPath = image ? await upload(db, "categories", image) : null;
  const { error } = await db.from("categories").update({ image_path: newPath }).eq("id", category.id);
  if (error) {
    if (newPath) await removeFile(db, newPath);
    throw new Error(friendlyError(error));
  }
  if (category.imagePath) await removeFile(db, category.imagePath);
}
