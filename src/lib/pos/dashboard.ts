import type { SupabaseClient } from "@supabase/supabase-js";

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
