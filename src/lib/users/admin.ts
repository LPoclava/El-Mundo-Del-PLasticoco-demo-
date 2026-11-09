import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/panel/roles";
import { friendlyError } from "@/lib/supabase/errors";
import { parseUserRow, userActionMessage, type ManagedUser } from "./rules";

/**
 * Administración de usuarios con la sesión real del CEO. Todo pasa por funciones de la base que exigen CEO activo
 * (admin_list_users, admin_create_profile, admin_set_role, admin_set_active, admin_set_display_name). Las cuentas de
 * Auth se crean a mano en Supabase: desde el navegador no se pueden crear (haría falta la clave service_role).
 */
type Failure = { code?: string; message?: string } | null;

const message = (error: Failure) => userActionMessage(error) ?? friendlyError(error);

export async function listUsers(db: SupabaseClient): Promise<ManagedUser[]> {
  const { data, error } = await db.rpc("admin_list_users");
  if (error) throw new Error(message(error));
  return ((data ?? []) as unknown[]).map(parseUserRow).filter((u): u is ManagedUser => u !== null);
}

/** Cada operación devuelve null si salió bien o el mensaje para mostrar. */
export async function giveAccess(db: SupabaseClient, userId: string, name: string, role: Role): Promise<string | null> {
  const { error } = await db.rpc("admin_create_profile", { p_user_id: userId, p_display_name: name.trim(), p_role: role });
  return error ? message(error) : null;
}

export async function changeRole(db: SupabaseClient, userId: string, role: Role): Promise<string | null> {
  const { error } = await db.rpc("admin_set_role", { p_user_id: userId, p_role: role });
  return error ? message(error) : null;
}

export async function changeActive(db: SupabaseClient, userId: string, active: boolean): Promise<string | null> {
  const { error } = await db.rpc("admin_set_active", { p_user_id: userId, p_active: active });
  return error ? message(error) : null;
}

export async function changeName(db: SupabaseClient, userId: string, name: string): Promise<string | null> {
  const { error } = await db.rpc("admin_set_display_name", { p_user_id: userId, p_display_name: name.trim() });
  return error ? message(error) : null;
}
