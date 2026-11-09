/**
 * Roles y secciones del panel.
 * Lo que se ve en el menú sale del rol que la base guarda en public.profiles. El menú es comodidad, no seguridad:
 * la autorización real vive en la base (has_role_at_least, RLS y funciones por rol); ver docs/autorizacion-roles.md.
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
  gerente: "Todo lo del empleado, más control de stock, gestión de productos, categorías y banners promocionales.",
  ceo: "Todo lo del gerente, más usuarios y roles.",
};

export type SectionId =
  | "inicio"
  | "precios"
  | "stock"
  | "productos"
  | "categorias"
  | "banners"
  | "usuarios";

export type IconName =
  | "home" | "barcode" | "box" | "tag" | "image" | "chart" | "history" | "users" | "settings"
  | "search" | "plus" | "edit" | "archive" | "eye" | "eyeOff" | "check" | "x" | "menu"
  | "logout" | "chevronLeft" | "chevronRight" | "chevronDown" | "alert" | "info" | "link"
  | "sort" | "lock" | "refresh" | "user" | "trash" | "dashboard" | "scan" | "boxes" | "cart" | "receipt" | "camera";

export type GroupId = "operacion" | "catalogo" | "gestion";

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
  { id: "usuarios", href: "/panel/usuarios", label: "Usuarios y permisos", icon: "users", minRole: "ceo", group: "gestion", description: "Quién accede al panel y qué puede hacer." },
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

/** El menú lateral de un rol: grupos con sus secciones, sin los grupos vacíos. */
export function menuGroups(role: Role): { id: GroupId; label: string; items: Section[] }[] {
  const sections = sectionsFor(role);
  return GROUPS.map((g) => ({ ...g, items: sections.filter((s) => s.group === g.id) })).filter((g) => g.items.length > 0);
}

/** true si el rol puede ver esa dirección del panel. Una dirección que no es de ninguna sección no se concede. */
export function canAccessPath(role: Role, pathname: string): boolean {
  const section = sectionOf(pathname);
  return section ? atLeast(role, section.minRole) : false;
}
