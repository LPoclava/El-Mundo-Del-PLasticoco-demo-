/**
 * Roles y secciones del panel de DEMOSTRACIÓN.
 * Solo gobiernan lo que se ve en la maqueta: no son seguridad. La autorización real vive en la
 * base de datos (public.profiles, has_role_at_least, RLS); ver docs/autorizacion-roles.md.
 */
export type Role = "empleado" | "gerente" | "ceo";

export const ROLES: readonly Role[] = ["empleado", "gerente", "ceo"];

export const ROLE_LABEL: Record<Role, string> = {
  empleado: "Empleado",
  gerente: "Gerente",
  ceo: "CEO",
};

const ROLE_RANK: Record<Role, number> = { empleado: 0, gerente: 1, ceo: 2 };

export function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_SUMMARY: Record<Role, string> = {
  empleado: "Consulta precios por código, los modifica, vincula códigos y da de alta productos desde el escáner.",
  gerente: "Todo lo del empleado, más gestión de productos, categorías, banners promocionales, CRM e informes y auditoría del catálogo.",
  ceo: "Todo lo del gerente, más usuarios y roles, auditoría completa y configuración general.",
};

export type SectionId =
  | "inicio"
  | "precios"
  | "productos"
  | "categorias"
  | "banners"
  | "crm"
  | "historial"
  | "usuarios"
  | "configuracion";

export type IconName =
  | "home" | "barcode" | "box" | "tag" | "image" | "chart" | "history" | "users" | "settings"
  | "search" | "plus" | "edit" | "archive" | "eye" | "eyeOff" | "check" | "x" | "menu"
  | "logout" | "chevronLeft" | "chevronRight" | "chevronDown" | "alert" | "info" | "link"
  | "sort" | "lock" | "refresh" | "user" | "trash";

export type Section = {
  id: SectionId;
  href: string;
  label: string;
  icon: IconName;
  minRole: Role;
};

export const SECTIONS: readonly Section[] = [
  { id: "inicio", href: "/panel", label: "Inicio", icon: "home", minRole: "empleado" },
  { id: "precios", href: "/panel/precios", label: "Consulta de precios", icon: "barcode", minRole: "empleado" },
  { id: "productos", href: "/panel/productos", label: "Productos", icon: "box", minRole: "gerente" },
  { id: "categorias", href: "/panel/categorias", label: "Categorías", icon: "tag", minRole: "gerente" },
  { id: "banners", href: "/panel/banners", label: "Banners promocionales", icon: "image", minRole: "gerente" },
  { id: "crm", href: "/panel/crm", label: "CRM e informes", icon: "chart", minRole: "gerente" },
  { id: "historial", href: "/panel/historial", label: "Historial de cambios", icon: "history", minRole: "empleado" },
  { id: "usuarios", href: "/panel/usuarios", label: "Usuarios y permisos", icon: "users", minRole: "ceo" },
  { id: "configuracion", href: "/panel/configuracion", label: "Configuración", icon: "settings", minRole: "ceo" },
];

export function sectionsFor(role: Role): Section[] {
  return SECTIONS.filter((s) => atLeast(role, s.minRole));
}

/** El empleado ve solo su actividad; el gerente el catálogo; el CEO todo. */
export function historyTitle(role: Role): string {
  return role === "empleado" ? "Mi actividad" : "Historial de cambios";
}

export const DEMO_EMAIL_DOMAIN = "demo.mundodelplastico.test";

export function demoEmail(role: Role): string {
  return `${role}@${DEMO_EMAIL_DOMAIN}`;
}
