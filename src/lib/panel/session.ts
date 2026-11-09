import type { Role } from "./roles";

// Sin importar valores de otros módulos: así la prueba de Node carga este archivo directamente. Una prueba
// comprueba que esta lista coincide con ROLES.
const ROLE_VALUES: readonly string[] = ["empleado", "gerente", "ceo"];

/**
 * Lógica pura de la sesión del panel (sin React ni red), para poder probarla.
 * El rol y el estado salen SOLO de una fila de public.profiles: nunca del token ni de user_metadata, que la
 * persona puede editar. Quien decide qué puede hacer cada rol es la base (RLS y funciones).
 */
export type Profile = { role: Role; displayName: string };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_VALUES.includes(value);
}

/** Perfil habilitado a partir de una fila de public.profiles; null si no hay fila, está inactivo o el rol no existe. */
export function profileFromRow(row: unknown, fallbackName = ""): Profile | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (r.active !== true || !isRole(r.role)) return null;
  const name = typeof r.display_name === "string" ? r.display_name.trim() : "";
  return { role: r.role, displayName: name || fallbackName };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginErrors = { email?: string; password?: string };

export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  const mail = email.trim();
  if (!mail) errors.email = "Ingresá tu correo electrónico.";
  else if (!EMAIL_RE.test(mail)) errors.email = "El correo no tiene un formato válido.";
  if (!password) errors.password = "Ingresá tu contraseña.";
  return errors;
}

type AuthFailure = { message?: string; status?: number; code?: string } | null | undefined;

/** Mensaje para quien intentó entrar. No distingue «correo inexistente» de «contraseña incorrecta». */
export function loginFailureMessage(error: AuthFailure): string {
  if (!error) return "No se pudo iniciar sesión.";
  const message = error.message ?? "";
  if (/failed to fetch|network|fetch failed|timeout|tardó demasiado/i.test(message)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }
  if (error.status === 429 || /rate limit|too many/i.test(message) || error.code === "over_request_rate_limit") {
    return "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.";
  }
  if (error.status && error.status >= 500) return "El servidor no pudo responder. Probá de nuevo en unos minutos.";
  return "El correo o la contraseña no son correctos.";
}

/** Mínimo entre dos reevaluaciones de la sesión al volver a la pestaña, para no consultar de más al cambiar de ventana. */
export const REFRESH_MIN_GAP_MS = 10_000;

export function shouldRefresh(lastStartedAt: number, now: number, minGapMs: number = REFRESH_MIN_GAP_MS): boolean {
  return now - lastStartedAt >= minGapMs;
}

export const NO_ACCESS_MESSAGE = "Esta cuenta no tiene acceso habilitado al panel. Pedile a un responsable que te dé acceso.";
