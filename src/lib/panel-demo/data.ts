/**
 * DATOS FICTICIOS de la demostración. No son el inventario, los usuarios ni las ventas reales
 * del negocio, y nunca se leen ni se escriben en Supabase. Se reemplazan por consultas reales
 * cuando se conecte el panel definitivo.
 */
import { ean13 } from "@/lib/barcode/ean";
import type { Role } from "./roles";
import type { AuditEntry, DemoCategory, DemoProduct, DemoState, DemoUser } from "./types";

export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: "cat-baldes", name: "Baldes y tachos" },
  { id: "cat-vasos", name: "Vasos y botellas" },
  { id: "cat-cocina", name: "Cocina y organización" },
  { id: "cat-limpieza", name: "Limpieza" },
  { id: "cat-jardin", name: "Jardín y macetas" },
  { id: "cat-fiesta", name: "Descartables" },
];

type P = [name: string, brand: string, categoryId: string, price: number, published: boolean, archived?: boolean, noCode?: boolean];

const PRODUCT_ROWS: P[] = [
  ["Balde 10 litros con asa", "Hogarplast", "cat-baldes", 4890, true],
  ["Balde 15 litros reforzado", "Hogarplast", "cat-baldes", 6350, true],
  ["Tacho de basura 50 L con tapa", "Norte", "cat-baldes", 12900, true],
  ["Palangana redonda 30 cm", "Norte", "cat-baldes", 3250, true],
  ["Vaso térmico 450 ml", "Aura", "cat-vasos", 3790, true],
  ["Jarra con tapa 2 litros", "Aura", "cat-vasos", 4650, true],
  ["Set de 6 vasos de colores", "Aura", "cat-vasos", 5200, false, false, true],
  ["Botella deportiva 750 ml", "Aura", "cat-vasos", 3980, true],
  ["Recipiente hermético 1,5 L", "Casaplast", "cat-cocina", 4320, true],
  ["Set de 5 recipientes herméticos", "Casaplast", "cat-cocina", 11800, true],
  ["Escurridor de platos", "Casaplast", "cat-cocina", 7450, true],
  ["Organizador apilable chico", "Casaplast", "cat-cocina", 5890, false, false, true],
  ["Cesto de ropa calado", "Norte", "cat-limpieza", 8990, true],
  ["Balde exprimidor con ruedas", "Limpia", "cat-limpieza", 21500, true],
  ["Cepillo de piso", "Limpia", "cat-limpieza", 2990, true],
  ["Set pala y escobillón", "Limpia", "cat-limpieza", 6790, false],
  ["Maceta 20 cm", "Verdelia", "cat-jardin", 2790, true],
  ["Maceta colgante", "Verdelia", "cat-jardin", 3450, true],
  ["Regadera 5 litros", "Verdelia", "cat-jardin", 5290, true],
  ["Plato para maceta 25 cm", "Verdelia", "cat-jardin", 1590, false, false, true],
  ["Platos descartables x50", "Festiva", "cat-fiesta", 3290, true],
  ["Vasos descartables x100", "Festiva", "cat-fiesta", 2850, true],
  ["Cubiertos descartables x50", "Festiva", "cat-fiesta", 2490, false, true],
  ["Bandeja rectangular", "Festiva", "cat-fiesta", 4150, false, true],
];

/**
 * Códigos EAN-13 válidos con prefijo 200 (rango que GS1 reserva para uso interno): se pueden
 * escanear de verdad desde otra pantalla y nunca coinciden con un producto real.
 */
export const demoCode = (n: number) => ean13(`200000100${String(n).padStart(3, "0")}`);

export const DEMO_PRODUCTS: DemoProduct[] = PRODUCT_ROWS.map(
  ([name, brand, categoryId, price, published, archived = false, noCode = false], i) => ({
    id: `prod-${i + 1}`,
    name,
    brand,
    categoryId,
    price,
    barcode: noCode ? null : demoCode(i + 1),
    published,
    archived,
  }),
);

/** Códigos que la pantalla de consulta ofrece para simular un escaneo. */
export const SAMPLE_CODES = {
  found: [demoCode(1), demoCode(5), demoCode(9)],
  unknown: ean13("200000199901"),
} as const;

export const DEMO_USERS: DemoUser[] = [
  { id: "usr-ceo", name: "Cuenta CEO (demo)", email: "ceo@ejemplo.test", role: "ceo", active: true, createdAt: "2026-09-01T10:00:00-03:00" },
  { id: "usr-gerente", name: "Martín Gómez", email: "martin.gomez@ejemplo.test", role: "gerente", active: true, createdAt: "2026-09-08T09:30:00-03:00" },
  { id: "usr-empleado", name: "Carla Ríos", email: "carla.rios@ejemplo.test", role: "empleado", active: true, createdAt: "2026-09-15T11:00:00-03:00" },
  { id: "usr-empleado-2", name: "Joaquín Pérez", email: "joaquin.perez@ejemplo.test", role: "empleado", active: true, createdAt: "2026-10-02T14:15:00-03:00" },
  { id: "usr-gerente-2", name: "Sofía Luna", email: "sofia.luna@ejemplo.test", role: "gerente", active: false, createdAt: "2026-09-20T16:40:00-03:00" },
];

/** Usuario ficticio que representa a cada perfil elegido en el login de demostración. */
export const SESSION_USER: Record<Role, { id: string; name: string }> = {
  empleado: { id: "usr-empleado", name: "Carla Ríos" },
  gerente: { id: "usr-gerente", name: "Martín Gómez" },
  ceo: { id: "usr-ceo", name: "Cuenta CEO (demo)" },
};

type A = [at: string, userId: string, action: AuditEntry["action"], target: string, from?: string, to?: string];

const U = Object.fromEntries(DEMO_USERS.map((u) => [u.id, u]));

const AUDIT_ROWS: A[] = [
  ["2026-10-27T11:42:00-03:00", "usr-empleado", "price", "Balde 10 litros con asa", "$ 4.590", "$ 4.890"],
  ["2026-10-27T10:15:00-03:00", "usr-empleado-2", "link", "Vaso térmico 450 ml", "Sin código", demoCode(5)],
  ["2026-10-26T17:05:00-03:00", "usr-gerente", "publish", "Regadera 5 litros", "Sin publicar", "Publicado"],
  ["2026-10-26T16:20:00-03:00", "usr-empleado", "create", "Plato para maceta 25 cm", undefined, "Creado sin publicar"],
  ["2026-10-26T12:00:00-03:00", "usr-gerente", "category", "Descartables", "Fiesta", "Descartables"],
  ["2026-10-25T09:48:00-03:00", "usr-empleado-2", "price", "Jarra con tapa 2 litros", "$ 4.300", "$ 4.650"],
  ["2026-10-24T15:30:00-03:00", "usr-gerente", "archive", "Cubiertos descartables x50", "Activo", "Archivado"],
  ["2026-10-24T11:10:00-03:00", "usr-ceo", "user", "Sofía Luna", "Activa", "Inactiva"],
  ["2026-10-23T18:22:00-03:00", "usr-empleado", "price", "Escurridor de platos", "$ 6.900", "$ 7.450"],
  ["2026-10-23T10:05:00-03:00", "usr-gerente", "edit", "Cesto de ropa calado", undefined, "Campos: nombre, marca"],
  ["2026-10-22T13:40:00-03:00", "usr-gerente", "unpublish", "Set pala y escobillón", "Publicado", "Sin publicar"],
  ["2026-10-21T09:15:00-03:00", "usr-empleado-2", "create", "Organizador apilable chico", undefined, "Creado sin publicar"],
  ["2026-10-20T16:50:00-03:00", "usr-ceo", "user", "Joaquín Pérez", "Sin acceso", "Empleado"],
  ["2026-10-19T12:30:00-03:00", "usr-empleado", "link", "Botella deportiva 750 ml", demoCode(8), ean13("200000100808")],
  ["2026-10-18T10:00:00-03:00", "usr-gerente", "price", "Tacho de basura 50 L con tapa", "$ 11.900", "$ 12.900"],
];

export const DEMO_AUDIT: AuditEntry[] = AUDIT_ROWS.map(([at, userId, action, target, from, to], i) => ({
  id: `aud-seed-${i + 1}`,
  at,
  userId,
  userName: U[userId].name,
  role: U[userId].role,
  action,
  scope: action === "user" ? "usuarios" : "catalogo",
  target,
  from,
  to,
}));

export function initialState(): DemoState {
  return {
    products: DEMO_PRODUCTS.map((p) => ({ ...p })),
    categories: DEMO_CATEGORIES.map((c) => ({ ...c })),
    users: DEMO_USERS.map((u) => ({ ...u })),
    audit: DEMO_AUDIT.map((a) => ({ ...a })),
  };
}

// ---- CRM: cifras inventadas para mostrar el diseño. No hay registro de ventas todavía. ----

export type SalesPeriod = "7d" | "30d" | "12m";

export const SALES_SERIES: Record<SalesPeriod, { label: string; labels: string[]; values: number[] }> = {
  "7d": {
    label: "Últimos 7 días",
    labels: ["Mié", "Jue", "Vie", "Sáb", "Dom", "Lun", "Mar"],
    values: [182000, 214000, 265000, 318000, 96000, 201000, 238000],
  },
  "30d": {
    label: "Últimos 30 días",
    labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
    values: [1210000, 1385000, 1296000, 1512000],
  },
  "12m": {
    label: "Últimos 12 meses",
    labels: ["Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"],
    values: [4100000, 5600000, 4300000, 3900000, 4500000, 4700000, 4400000, 4900000, 5100000, 5000000, 5300000, 5400000],
  },
};

export const TOP_SELLERS: { name: string; units: number; amount: number }[] = [
  { name: "Vasos descartables x100", units: 212, amount: 604200 },
  { name: "Balde 10 litros con asa", units: 148, amount: 723720 },
  { name: "Platos descartables x50", units: 131, amount: 430990 },
  { name: "Recipiente hermético 1,5 L", units: 96, amount: 414720 },
  { name: "Botella deportiva 750 ml", units: 88, amount: 350240 },
];

export const CRM_KPIS: { label: string; value: string; hint: string }[] = [
  { label: "Ventas del mes", value: "$ 5.403.000", hint: "+4,2 % frente al mes anterior" },
  { label: "Operaciones", value: "812", hint: "27 por día en promedio" },
  { label: "Ticket promedio", value: "$ 6.654", hint: "Estable" },
  { label: "Clientes nuevos", value: "46", hint: "Consultas por WhatsApp y local" },
];

export const COMMERCIAL_ACTIVITY: { at: string; text: string }[] = [
  { at: "2026-10-27T12:10:00-03:00", text: "Consulta mayorista por descartables para un evento" },
  { at: "2026-10-27T09:45:00-03:00", text: "Pedido de reposición de baldes (Hogarplast)" },
  { at: "2026-10-26T18:20:00-03:00", text: "Cliente pidió presupuesto por 20 cestos de ropa" },
  { at: "2026-10-26T11:05:00-03:00", text: "Reclamo resuelto: cambio de regadera" },
];

/** Hoy "ficticio" de la demo, para no depender del reloj durante el prerenderizado. */
export const DEMO_TODAY = "2026-10-27T15:00:00-03:00";
