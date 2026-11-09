import type { Role } from "../panel/roles";

/**
 * Reglas puras de la pantalla «Usuarios y permisos» (sin red ni React, para poder probarlas). Lo que se permite lo
 * decide la base: admin_list_users() y admin_* exigen CEO activo, nadie cambia su propio rol ni estado y no se
 * puede dejar la aplicación sin un CEO activo. Esto solo evita ofrecer acciones que la base va a rechazar.
 */
export type ManagedUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role | null;
  active: boolean | null;
  hasProfile: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

const ROLE_VALUES: readonly string[] = ["empleado", "gerente", "ceo"];

export const NAME_MAX = 80;

/** Fila de admin_list_users() a ManagedUser; null si la fila no tiene la forma esperada. */
export function parseUserRow(row: unknown): ManagedUser | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.user_id !== "string" || typeof r.created_at !== "string") return null;
  const hasProfile = r.has_profile === true;
  const role = typeof r.role === "string" && ROLE_VALUES.includes(r.role) ? (r.role as Role) : null;
  if (hasProfile && !role) return null;
  return {
    userId: r.user_id,
    email: typeof r.email === "string" ? r.email : "",
    displayName: typeof r.display_name === "string" ? r.display_name : null,
    role: hasProfile ? role : null,
    active: hasProfile ? r.active === true : null,
    hasProfile,
    createdAt: r.created_at,
    lastSignInAt: typeof r.last_sign_in_at === "string" ? r.last_sign_in_at : null,
  };
}

export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Escribí un nombre.";
  if (name.length > NAME_MAX) return `El nombre admite hasta ${NAME_MAX} caracteres.`;
  return null;
}

/** Acciones que la pantalla ofrece sobre una persona; la base las vuelve a comprobar. */
export function canManage(selfId: string, user: ManagedUser): { changeRole: boolean; toggleActive: boolean; rename: boolean } {
  const self = user.userId === selfId;
  return { changeRole: user.hasProfile && !self, toggleActive: user.hasProfile && !self, rename: user.hasProfile };
}

/** Mensaje específico para los rechazos conocidos de las funciones admin_*; null si no es uno de ellos. */
export function userActionMessage(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const message = error.message ?? "";
  if (error.code === "PGRST202" || /could not find the function/i.test(message)) {
    return "Falta aplicar en Supabase la migración 20261108000001_admin_list_users. Hasta entonces no se puede listar el equipo.";
  }
  if (/sin un CEO activo/i.test(message)) return "No se puede dejar la aplicación sin un CEO activo.";
  if (/propio rol|tu propio/i.test(message)) return "No podés cambiar tu propio rol ni tu estado.";
  if (/no existe en Auth/i.test(message)) return "Esa cuenta no existe en Supabase Auth. Creala primero ahí.";
  if (error.code === "23505" || /duplicate key|already exists/i.test(message)) return "Esa cuenta ya tiene un perfil.";
  if (/Perfil no encontrado/i.test(message)) return "No se encontró el perfil. Actualizá la lista.";
  return null;
}
