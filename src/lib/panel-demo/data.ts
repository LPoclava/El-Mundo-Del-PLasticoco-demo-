/**
 * DATOS FICTICIOS de la demostración. No son el inventario, los usuarios ni las ventas reales
 * del negocio, y nunca se leen ni se escriben en Supabase. Se reemplazan por consultas reales
 * cuando se conecte el panel definitivo.
 */
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

/** Sin productos de ejemplo: el panel de demostración arranca con el listado vacío. */
export const DEMO_PRODUCTS: DemoProduct[] = [];

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
  ["2026-10-26T12:00:00-03:00", "usr-gerente", "category", "Descartables", "Fiesta", "Descartables"],
  ["2026-10-24T11:10:00-03:00", "usr-ceo", "user", "Sofía Luna", "Activa", "Inactiva"],
  ["2026-10-20T16:50:00-03:00", "usr-ceo", "user", "Joaquín Pérez", "Sin acceso", "Empleado"],
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

export const CRM_KPIS: { label: string; value: string; hint: string }[] = [
  { label: "Ventas del mes", value: "$ 5.403.000", hint: "+4,2 % frente al mes anterior" },
  { label: "Operaciones", value: "812", hint: "27 por día en promedio" },
  { label: "Ticket promedio", value: "$ 6.654", hint: "Estable" },
  { label: "Clientes nuevos", value: "46", hint: "Consultas por WhatsApp y local" },
];

export const COMMERCIAL_ACTIVITY: { at: string; text: string }[] = [
  { at: "2026-10-27T12:10:00-03:00", text: "Consulta mayorista por descartables para un evento" },
  { at: "2026-10-27T09:45:00-03:00", text: "Pedido de reposición a un proveedor" },
  { at: "2026-10-26T18:20:00-03:00", text: "Cliente pidió presupuesto por un pedido grande" },
  { at: "2026-10-26T11:05:00-03:00", text: "Reclamo resuelto: cambio de un artículo" },
];

/** Hoy "ficticio" de la demo, para no depender del reloj durante el prerenderizado. */
export const DEMO_TODAY = "2026-10-27T15:00:00-03:00";
