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
  empleado: "Vende con el escáner (carrito, medio de pago y descuento de stock), consulta sus ventas y da de alta productos nuevos.",
  gerente: "Todo lo del empleado, más gestión de productos, categorías, banners promocionales, CRM e informes y auditoría del catálogo.",
  ceo: "Todo lo del gerente, más usuarios y roles, auditoría completa y configuración general.",
};

export type SectionId =
  | "inicio"
  | "precios"
  | "stock"
  | "productos"
  | "categorias"
  | "banners"
  | "crm"
  | "usuarios"
  | "configuracion";

export type IconName =
  | "home" | "barcode" | "box" | "tag" | "image" | "chart" | "history" | "users" | "settings"
  | "search" | "plus" | "edit" | "archive" | "eye" | "eyeOff" | "check" | "x" | "menu"
  | "logout" | "chevronLeft" | "chevronRight" | "chevronDown" | "alert" | "info" | "link"
  | "sort" | "lock" | "refresh" | "user" | "trash" | "dashboard" | "scan" | "boxes" | "cart" | "receipt" | "camera";

export type Section = {
  id: SectionId;
  href: string;
  label: string;
  icon: IconName;
  minRole: Role;
  /** Grupo del menú lateral. */
  group: GroupId;
  /** Qué hace la sección (se muestra bajo el título). */
  description: string;
};

export type GroupId = "operacion" | "catalogo" | "gestion";

export const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: "operacion", label: "Operación diaria" },
  { id: "catalogo", label: "Catálogo" },
  { id: "gestion", label: "Gestión" },
];

export const SECTIONS: readonly Section[] = [
  { id: "inicio", href: "/panel", label: "Dashboard", icon: "dashboard", minRole: "empleado", group: "operacion", description: "Resumen general del negocio." },
  { id: "precios", href: "/panel/precios", label: "Escáner y ventas", icon: "scan", minRole: "empleado", group: "operacion", description: "Consulta de productos y registro de operaciones." },
  { id: "stock", href: "/panel/stock", label: "Control de stock", icon: "boxes", minRole: "gerente", group: "operacion", description: "Ingreso de mercadería y ajustes de inventario." },
  { id: "productos", href: "/panel/productos", label: "Productos", icon: "box", minRole: "gerente", group: "catalogo", description: "Administración del catálogo." },
  { id: "categorias", href: "/panel/categorias", label: "Categorías", icon: "tag", minRole: "gerente", group: "catalogo", description: "Las cuatro categorías principales: nombre, foto, orden y visibilidad." },
  { id: "banners", href: "/panel/banners", label: "Banners promocionales", icon: "image", minRole: "gerente", group: "catalogo", description: "Las imágenes del carrusel de promociones del catálogo." },
  { id: "crm", href: "/panel/crm", label: "CRM e informes", icon: "chart", minRole: "gerente", group: "gestion", description: "Evolución de ventas y actividad comercial." },
  { id: "usuarios", href: "/panel/usuarios", label: "Usuarios y permisos", icon: "users", minRole: "ceo", group: "gestion", description: "Quién accede al panel y qué puede hacer." },
  { id: "configuracion", href: "/panel/configuracion", label: "Configuración", icon: "settings", minRole: "ceo", group: "gestion", description: "Ajustes generales del negocio y del catálogo." },
];

/** Sección a la que pertenece una dirección; las pantallas internas (/panel/productos/nuevo) cuentan como su sección. */
export function sectionOf(pathname: string): Section | undefined {
  return [...SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => pathname === s.href || (s.href !== "/panel" && pathname.startsWith(`${s.href}/`)));
}

export function sectionsFor(role: Role): Section[] {
  return SECTIONS.filter((s) => atLeast(role, s.minRole));
}

export const DEMO_EMAIL_DOMAIN = "demo.mundodelplastico.test";

export function demoEmail(role: Role): string {
  return `${role}@${DEMO_EMAIL_DOMAIN}`;
}
