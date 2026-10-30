import type { SupabaseClient } from "@supabase/supabase-js";
import { setCategoryImage, type AdminCategory as ImageCategory } from "@/lib/banners/admin";
import type { PreparedImage } from "@/lib/banners/image";

/**
 * Administración real de categorías (gerente o superior; la RLS lo exige). Las cuatro principales
 * se reordenan con reorder_main_categories() y se eliminan con delete_category_safe(), que no deja
 * productos sin categoría.
 */
export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  featuredPosition: number | null;
  imagePath: string | null;
  description: string | null;
  active: boolean;
  productCount: number;
  childCount: number;
};

export const CATEGORY_DESCRIPTION_MAX = 200;

type Row = {
  id: string; name: string; slug: string; parent_id: string | null; featured_position: number | null;
  image_path: string | null; description: string | null; active: boolean;
};

function message(error: { code?: string; message?: string } | null): string {
  if (!error) return "No se pudo completar la operación.";
  if (error.code === "42501") return "Tu cuenta no tiene permiso para administrar categorías.";
  if (error.code === "23505") return "Ya existe una categoría con ese nombre.";
  if (error.code === "23514") return "Revisá los datos: el nombre no puede estar vacío y la descripción tiene un máximo de 200 caracteres.";
  if (error.code === "23503") return error.message ?? "La categoría tiene productos o subcategorías.";
  if (error.code === "22023") return error.message ?? "Datos inválidos.";
  return "No se pudo completar la operación. Probá de nuevo.";
}

export async function listAllCategories(db: SupabaseClient): Promise<AdminCategoryRow[]> {
  const [cats, products] = await Promise.all([
    db.from("categories").select("id,name,slug,parent_id,featured_position,image_path,description,active").order("name"),
    db.from("products").select("category_id").limit(20000),
  ]);
  if (cats.error) {
    if (cats.error.code === "42703") throw new Error("Falta aplicar la migración 20261101000001 (descripción y estado de las categorías).");
    throw new Error(message(cats.error));
  }
  if (products.error) throw new Error(message(products.error));
  const counts = new Map<string, number>();
  for (const p of (products.data ?? []) as { category_id: string }[]) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  const rows = (cats.data ?? []) as Row[];
  return rows.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, parentId: c.parent_id, featuredPosition: c.featured_position, imagePath: c.image_path,
    description: c.description, active: c.active, productCount: counts.get(c.id) ?? 0,
    childCount: rows.filter((x) => x.parent_id === c.id).length,
  }));
}

export async function updateCategory(db: SupabaseClient, id: string, patch: { name: string; description: string | null; active: boolean }): Promise<void> {
  const { error } = await db.from("categories").update(patch).eq("id", id);
  if (error) throw new Error(message(error));
}

export async function changeCategoryImage(db: SupabaseClient, c: AdminCategoryRow, image: PreparedImage | null): Promise<void> {
  const target: ImageCategory = { id: c.id, name: c.name, slug: c.slug, featuredPosition: c.featuredPosition, imagePath: c.imagePath };
  await setCategoryImage(db, target, image);
}

export async function reorderMainCategories(db: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await db.rpc("reorder_main_categories", { p_ids: ids });
  if (error) throw new Error(message(error));
}

/** Devuelve cuántos productos se pasaron a la otra categoría antes de eliminar. */
export async function deleteCategory(db: SupabaseClient, id: string, reassignTo: string | null): Promise<number> {
  const { data, error } = await db.rpc("delete_category_safe", { p_id: id, p_reassign_to: reassignTo });
  if (error) throw new Error(message(error));
  return Number(data);
}
