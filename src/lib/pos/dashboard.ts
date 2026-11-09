import type { SupabaseClient } from "@supabase/supabase-js";
import type { MethodRow, MonthlyRow } from "./analytics";

/**
 * Datos reales del inicio. Las funciones de la base corren con los permisos de quien consulta: el
 * empleado ve solo sus ventas; el gerente y el CEO, las de todo el equipo.
 */

export type SalesSummary = {
  salesCount: number;
  revenue: number;
  units: number;
  topProducts: { name: string; variant: string | null; units: number }[];
};

export type LowStockItem = { name: string; variant: string | null; stock: number };

export type MovementItem = {
  id: number;
  createdAt: string;
  reason: "venta" | "entrada" | "ajuste" | "inicial";
  delta: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  productName: string | null;
  variant: string | null;
};

/** Umbral de «stock bajo» (unidades o menos). Un solo lugar para cambiarlo. */
export const LOW_STOCK_THRESHOLD = 5;

/** Límites del día local [hoy 00:00, mañana 00:00) en ISO. */
export function todayRange(now = new Date()): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

type SummaryRow = { sales_count: number; revenue: number; units: number; top_products: { name: string; variant: string | null; units: number }[] };

export async function salesSummary(db: SupabaseClient, from: string, to: string): Promise<SalesSummary> {
  const { data, error } = await db.rpc("sales_summary", { p_from: from, p_to: to });
  if (error) throw new Error("No se pudo leer el resumen de ventas.");
  const r = data as SummaryRow;
  return { salesCount: Number(r.sales_count), revenue: Number(r.revenue), units: Number(r.units), topProducts: r.top_products ?? [] };
}

export async function lowStock(db: SupabaseClient, threshold = LOW_STOCK_THRESHOLD): Promise<LowStockItem[]> {
  const { data, error } = await db.rpc("low_stock_variants", { p_threshold: threshold });
  if (error) throw new Error("No se pudo leer el stock bajo.");
  return (data ?? []) as LowStockItem[];
}

type MovementRow = {
  id: number; created_at: string; reason: MovementItem["reason"]; delta: number; stock_before: number; stock_after: number; note: string | null;
  product_variants: { size: string | null; color: string | null; products: { name: string } | null } | null;
};

/** Últimos movimientos de inventario (solo gerente o superior: la RLS se los oculta al empleado). */
export async function recentMovements(db: SupabaseClient, limit = 8): Promise<MovementItem[]> {
  const { data, error } = await db
    .from("stock_movements")
    .select("id,created_at,reason,delta,stock_before,stock_after,note,product_variants(size,color,products(name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se pudieron leer los movimientos de stock.");
  return ((data ?? []) as unknown as MovementRow[]).map((m) => ({
    id: m.id, createdAt: m.created_at, reason: m.reason, delta: m.delta, stockBefore: m.stock_before, stockAfter: m.stock_after, note: m.note,
    productName: m.product_variants?.products?.name ?? null,
    variant: [m.product_variants?.size, m.product_variants?.color].filter(Boolean).join(" · ") || null,
  }));
}

export type MovementRow2 = MovementItem & { userName: string | null };

/**
 * Historial de movimientos de inventario (solo lectura; solo gerente o superior por RLS). Antes de aplicar la
 * migración 20261101 la columna stock_before no existe: se calcula como stock_after - delta (es lo mismo).
 */
export async function listMovements(db: SupabaseClient, limit = 30): Promise<MovementRow2[]> {
  const select = (cols: string) =>
    db.from("stock_movements").select(cols).order("created_at", { ascending: false }).limit(limit);
  const base = "id,created_at,reason,delta,stock_after,note,user_id,product_variants(size,color,products(name))";
  let res = await select(`${base},stock_before`);
  let withBefore = true;
  if (res.error) {
    withBefore = false;
    res = await select(base);
  }
  if (res.error) throw new Error("No se pudo leer el historial de movimientos.");
  type Row = {
    id: number; created_at: string; reason: MovementItem["reason"]; delta: number; stock_after: number; stock_before?: number; note: string | null;
    user_id: string | null; product_variants: { size: string | null; color: string | null; products: { name: string } | null } | null;
  };
  const rows = (res.data ?? []) as unknown as Row[];

  // Nombres de quienes hicieron los movimientos (si el perfil no se puede leer, se muestra sin nombre).
  const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const profiles = await db.from("profiles").select("user_id,display_name").in("user_id", ids);
    for (const p of (profiles.data ?? []) as { user_id: string; display_name: string | null }[]) {
      if (p.display_name) names.set(p.user_id, p.display_name);
    }
  }
  return rows.map((m) => ({
    id: m.id, createdAt: m.created_at, reason: m.reason, delta: m.delta,
    stockBefore: withBefore && typeof m.stock_before === "number" ? m.stock_before : m.stock_after - m.delta,
    stockAfter: m.stock_after, note: m.note,
    productName: m.product_variants?.products?.name ?? null,
    variant: [m.product_variants?.size, m.product_variants?.color].filter(Boolean).join(" · ") || null,
    userName: m.user_id ? (names.get(m.user_id) ?? null) : null,
  }));
}

export type PaymentAnalysis = { operations: number; revenue: number; methods: (MethodRow & { position: number })[] };

/** Ventas por medio de pago en [desde, hasta). La base aplica los permisos: el empleado ve solo las suyas. */
export async function salesByPaymentMethod(db: SupabaseClient, from: string, to: string): Promise<PaymentAnalysis> {
  const { data, error } = await db.rpc("sales_by_payment_method", { p_from: from, p_to: to });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") throw new Error("Falta aplicar la migración de medios de pago en la base.");
    throw new Error("No se pudo leer el análisis por medio de pago.");
  }
  const r = data as { operations_total: number; revenue_total: number; methods: { code: string; label: string; position: number; operations: number; revenue: number }[] };
  return {
    operations: Number(r.operations_total),
    revenue: Number(r.revenue_total),
    methods: (r.methods ?? []).map((m) => ({ code: m.code, label: m.label, position: m.position, operations: Number(m.operations), revenue: Number(m.revenue) })),
  };
}

/** Contador mensual por medio de pago de los últimos N meses (solo meses y métodos con ventas). */
export async function salesMonthlyByPaymentMethod(db: SupabaseClient, months = 6): Promise<MonthlyRow[]> {
  const { data, error } = await db.rpc("sales_monthly_by_payment_method", { p_months: months });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") throw new Error("Falta aplicar la migración de medios de pago en la base.");
    throw new Error("No se pudo leer el contador mensual.");
  }
  return ((data ?? []) as MonthlyRow[]).map((r) => ({ month: r.month, code: r.code, operations: Number(r.operations), revenue: Number(r.revenue) }));
}
