/**
 * Reglas de las operaciones de stock desde el escáner (sin React ni Supabase: se prueban con node --test).
 * Son una ayuda para dar mensajes claros; la base valida de nuevo (receive_stock / adjust_stock).
 */

export type StockMode = "entrada" | "ajuste";
export type AdjustDirection = "sumar" | "restar";

export const STOCK_MAX = 1_000_000;
export const NOTE_MAX = 200;

export type StockInput = {
  mode: StockMode;
  direction: AdjustDirection;
  /** Lo escrito en el campo de cantidad. */
  quantity: string;
  note: string;
  current: number;
};

export type StockCheck =
  | { ok: true; delta: number; resulting: number }
  | { ok: false; error: string };

/** Cantidad entera positiva; null si no es válida. */
export function parseStockQuantity(raw: string): number | null {
  if (!/^\d{1,7}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= STOCK_MAX ? n : null;
}

/** Valida y calcula el movimiento. La entrada siempre suma; el ajuste suma o resta y exige motivo. */
export function checkStockOperation(i: StockInput): StockCheck {
  const qty = parseStockQuantity(i.quantity);
  if (qty === null) {
    return { ok: false, error: i.mode === "entrada" ? "Escribí cuántas unidades recibiste (un entero de 1 en adelante)." : "Escribí cuántas unidades ajustar (un entero de 1 en adelante)." };
  }
  const note = i.note.trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `El texto es demasiado largo (máximo ${NOTE_MAX} caracteres).` };
  if (i.mode === "ajuste" && note.length === 0) return { ok: false, error: "Indicá el motivo del ajuste." };

  const delta = i.mode === "entrada" || i.direction === "sumar" ? qty : -qty;
  const resulting = i.current + delta;
  if (resulting < 0) return { ok: false, error: `No se puede dejar el stock en negativo: hay ${i.current} y querés restar ${qty}.` };
  if (resulting > STOCK_MAX) return { ok: false, error: "El stock resultante es demasiado alto." };
  return { ok: true, delta, resulting };
}

export const STOCK_LABEL: Record<StockMode, string> = {
  entrada: "Entrada de mercadería",
  ajuste: "Ajuste de inventario",
};

/** Mensaje para quien opera según el error devuelto por la base. */
export function describeStockError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "No se pudo registrar el movimiento.";
  if (error.code === "42501") return "Tu cuenta no tiene permiso para modificar el stock. Pedile a un gerente que lo haga.";
  if (error.code === "23514") return "El stock no puede quedar en negativo. Actualizá los datos y revisá la cantidad.";
  if (error.code === "22023") return "Revisá los datos: la cantidad tiene que ser un entero positivo y el ajuste lleva motivo.";
  if (error.code === "P0002") return "La variante ya no existe. Volvé a escanear el producto.";
  return "No se pudo registrar el movimiento. Probá de nuevo; si el problema sigue, avisá a un responsable.";
}
