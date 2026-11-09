/**
 * Cálculos del dashboard (sin React ni Supabase: se prueban con node --test). Cada indicador tiene una definición
 * única y verificable; la pantalla solo los muestra. Todo sale de las ventas registradas (public.sales): no se mezclan con
 * consultas de WhatsApp, pedidos del catálogo ni cobros efectivos (el sistema no verifica acreditaciones).
 *
 * Definiciones:
 *   ventas          = cantidad de ventas del período (una venta confirmada = una operación).
 *   facturación     = suma de sales.total de esas ventas, en pesos enteros.
 *   unidades        = suma de las cantidades vendidas.
 *   ticket promedio = facturación / ventas, redondeado al peso; sin ventas no existe (se muestra «—»).
 *   participación   = facturación del método / facturación total del período; sin facturación no se calcula.
 *   mes             = mes calendario en la hora de Río Turbio (America/Argentina/Rio_Gallegos), igual que la base.
 */
export type PeriodKind = "hoy" | "7dias" | "mes" | "mes-anterior" | "personalizado";

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  hoy: "Hoy",
  "7dias": "Últimos 7 días",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  personalizado: "Elegir fechas",
};

/** Un período personalizado no puede pasar de este largo (acota la consulta). */
export const MAX_CUSTOM_DAYS = 366;

export type PeriodRange = { from: string; to: string; label: string };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const longDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });
const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });

/** yyyy-mm-dd (de un campo de fecha) a medianoche local; null si no es una fecha real. */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/**
 * Límites [desde, hasta) del período, con días completos en la hora local. Devuelve null si el período personalizado es
 * inválido (fechas faltantes, «hasta» anterior a «desde» o más de un año).
 */
export function periodRange(kind: PeriodKind, now = new Date(), custom?: { from: string; to: string }): PeriodRange | null {
  const today = dayStart(now);
  let start: Date;
  let end: Date; // exclusivo
  let label: string;
  switch (kind) {
    case "hoy":
      start = today;
      end = addDays(today, 1);
      label = longDate.format(today);
      break;
    case "7dias":
      start = addDays(today, -6);
      end = addDays(today, 1);
      label = `${longDate.format(start)} al ${longDate.format(today)}`;
      break;
    case "mes":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      label = monthName.format(start);
      break;
    case "mes-anterior":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 1);
      label = monthName.format(start);
      break;
    case "personalizado": {
      const a = custom ? parseDay(custom.from) : null;
      const b = custom ? parseDay(custom.to) : null;
      if (!a || !b || b < a) return null;
      start = a;
      end = addDays(b, 1);
      if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_CUSTOM_DAYS) return null;
      label = a.getTime() === b.getTime() ? longDate.format(a) : `${longDate.format(a)} al ${longDate.format(b)}`;
      break;
    }
  }
  return { from: start.toISOString(), to: end.toISOString(), label };
}

/** Ticket promedio en pesos enteros, o null si no hubo ventas. */
export function averageTicket(revenue: number, salesCount: number): number | null {
  if (!Number.isFinite(revenue) || !Number.isFinite(salesCount) || salesCount <= 0) return null;
  return Math.round(revenue / salesCount);
}

export type MethodRow = { code: string; label: string; operations: number; revenue: number };
export type MethodShare = MethodRow & { share: number | null };

/**
 * Participación de cada método en la facturación del período (en %, con un decimal). Sin facturación no hay porcentaje
 * (null): dividir por cero daría un dato inventado. El porcentaje se muestra tal cual; la suma puede diferir de 100 por
 * el redondeo.
 */
export function methodShares(methods: MethodRow[]): MethodShare[] {
  const total = methods.reduce((s, m) => s + m.revenue, 0);
  return methods.map((m) => ({ ...m, share: total > 0 ? Math.round((m.revenue / total) * 1000) / 10 : null }));
}

export type MonthlyRow = { month: string; code: string; operations: number; revenue: number };
export type MonthTotals = { month: string; operations: number; revenue: number };

/** Totales por mes (de más viejo a más nuevo) a partir de las filas mes × método. */
export function monthTotals(rows: MonthlyRow[]): MonthTotals[] {
  const map = new Map<string, MonthTotals>();
  for (const r of rows) {
    const cur = map.get(r.month) ?? { month: r.month, operations: 0, revenue: 0 };
    cur.operations += r.operations;
    cur.revenue += r.revenue;
    map.set(r.month, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Mes calendario («YYYY-MM») de una fecha en la hora de Río Turbio, el mismo criterio de la base. */
export function monthKey(date: Date, timeZone = "America/Argentina/Rio_Gallegos"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

export function previousMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MonthComparison = {
  current: MonthTotals;
  previous: MonthTotals;
  operationsDelta: number;
  revenueDelta: number;
  /** Variación porcentual de la facturación respecto del mes anterior (un decimal); null si el anterior es 0. */
  revenuePct: number | null;
};

/**
 * Compara el mes en curso con el calendario anterior. SOLO existe si ambos meses tienen ventas: con datos de un solo mes
 * (o un hueco) no hay comparación, y la pantalla lo dice en lugar de inventar una tendencia. El mes en curso es parcial
 * (todavía no terminó): la pantalla lo aclara.
 */
export function compareMonths(rows: MonthlyRow[], currentKey: string): MonthComparison | null {
  const totals = monthTotals(rows);
  const current = totals.find((t) => t.month === currentKey);
  const previous = totals.find((t) => t.month === previousMonthKey(currentKey));
  if (!current || !previous) return null;
  return {
    current,
    previous,
    operationsDelta: current.operations - previous.operations,
    revenueDelta: current.revenue - previous.revenue,
    revenuePct: previous.revenue > 0 ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 1000) / 10 : null,
  };
}

// ---------------------------------------------------------------- actividad reciente (ventas + stock)

export type ActivityKind = "venta" | "entrada" | "ajuste" | "alta";
export type ActivityFilter = "todo" | "ventas" | "stock";

export type Activity = {
  key: string;
  kind: ActivityKind;
  at: string;
  title: string;
  /** Importe en pesos (solo ventas); los movimientos de stock muestran unidades. */
  amount: number | null;
  units: number | null;
  detail: string;
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = { venta: "Venta", entrada: "Ingreso de mercadería", ajuste: "Ajuste de stock", alta: "Stock inicial" };

/** Mezcla ventas y movimientos de stock en una sola lista ordenada del más reciente al más viejo, con un tope. */
export function mergeActivity(items: Activity[], filter: ActivityFilter, limit = 12): Activity[] {
  return items
    .filter((a) => (filter === "todo" ? true : filter === "ventas" ? a.kind === "venta" : a.kind !== "venta"))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
