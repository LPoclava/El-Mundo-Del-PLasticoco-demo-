/**
 * Borrador de la venta en curso, guardado en sessionStorage (solo esta pestaña, solo esta sesión del navegador).
 * Es una comodidad para no perder el carrito al recargar: NO es el registro de la venta. La venta existe
 * recién cuando el servidor confirma confirm_sale(); mientras tanto, precios y stock se vuelven a validar allá.
 */
import type { Cart, CartLine } from "./cart";

export const DRAFT_KEY = "mp-venta-borrador";

function isLine(v: unknown): v is CartLine {
  if (typeof v !== "object" || v === null) return false;
  const l = v as Record<string, unknown>;
  const str = (x: unknown) => typeof x === "string" && x.length > 0;
  const nullableStr = (x: unknown) => x === null || typeof x === "string";
  const posInt = (x: unknown) => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 9999;
  return (
    str(l.variantId) && str(l.productId) && str(l.name) && nullableStr(l.variantLabel) && nullableStr(l.barcode) && nullableStr(l.imagePath) &&
    typeof l.unitPrice === "number" && Number.isFinite(l.unitPrice) && l.unitPrice > 0 &&
    posInt(l.quantity) && typeof l.stock === "number" && Number.isInteger(l.stock) && l.stock >= 0
  );
}

/** Lee lo guardado: un borrador dañado o de otra versión se descarta entero (nunca se arma un carrito a medias). */
export function parseDraft(raw: string | null): Cart {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isLine)) return [];
    const seen = new Set<string>();
    for (const l of value) {
      if (seen.has(l.variantId)) return []; // una línea por variante
      seen.add(l.variantId);
    }
    return value;
  } catch {
    return [];
  }
}

export function loadDraft(): Cart {
  try {
    return parseDraft(sessionStorage.getItem(DRAFT_KEY));
  } catch {
    return [];
  }
}

export function saveDraft(cart: Cart): void {
  try {
    if (cart.length === 0) sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(cart));
  } catch {
    // Sin almacenamiento disponible, el carrito sigue funcionando; solo no se recupera tras recargar.
  }
}

export function hasDraft(): boolean {
  try {
    return parseDraft(sessionStorage.getItem(DRAFT_KEY)).length > 0;
  } catch {
    return false;
  }
}
