/**
 * Carrito PÚBLICO del catálogo (sin React ni navegador: se prueba con node --test).
 *
 * El carrito solo arma un pedido para consultar por WhatsApp. NO es una venta: no registra nada en la base, no toca el
 * stock, no emite comprobantes y no reserva productos. Vive en el navegador de cada visitante (localStorage).
 * Los precios son los publicados al momento de agregar; el mensaje aclara que el comercio confirma disponibilidad y
 * precio final.
 */
export type CartLine = {
  /** Identificador de la línea: la variante, o el producto si no tiene variantes cargadas. */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  imageUrl: string | null;
  /** Ruta de la ficha (ej.: /producto/balde-10l-ab12). */
  path: string;
  quantity: number;
};

export type Cart = CartLine[];

export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;
export const STORAGE_KEY = "mp-cart";
const VERSION = 1;

export const lineKey = (productId: string, variantId: string | null) => variantId ?? productId;

const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(n)));

export type AddResult = { cart: Cart; status: "added" | "increased" | "capped" | "full" };

/** Agrega una unidad (o la cantidad indicada). Una misma variante no se duplica: suma cantidad. */
export function addLine(cart: Cart, line: Omit<CartLine, "key" | "quantity">, quantity = 1): AddResult {
  const key = lineKey(line.productId, line.variantId);
  const existing = cart.find((l) => l.key === key);
  if (existing) {
    const next = Math.min(MAX_QUANTITY, existing.quantity + clamp(quantity));
    const status = next === existing.quantity ? "capped" : "increased";
    return { cart: cart.map((l) => (l.key === key ? { ...l, quantity: next } : l)), status };
  }
  if (cart.length >= MAX_LINES) return { cart, status: "full" };
  return { cart: [...cart, { ...line, key, quantity: clamp(quantity) }], status: "added" };
}

/** Fija la cantidad (1 a 99). Una cantidad menor que 1 quita la línea. */
export function setLineQuantity(cart: Cart, key: string, quantity: number): Cart {
  if (!Number.isFinite(quantity) || quantity < 1) return removeLine(cart, key);
  return cart.map((l) => (l.key === key ? { ...l, quantity: clamp(quantity) } : l));
}

export const removeLine = (cart: Cart, key: string): Cart => cart.filter((l) => l.key !== key);

export const lineSubtotal = (l: Pick<CartLine, "unitPrice" | "quantity">) => l.unitPrice * l.quantity;
export const cartTotal = (cart: Cart) => cart.reduce((sum, l) => sum + lineSubtotal(l), 0);
export const cartUnits = (cart: Cart) => cart.reduce((sum, l) => sum + l.quantity, 0);

// ---------------------------------------------------------------- persistencia (validada: lo guardado no es de fiar)

export function serializeCart(cart: Cart): string {
  return JSON.stringify({ v: VERSION, lines: cart });
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** Lee lo guardado. Si está dañado, vacío o es de otra versión devuelve un carrito vacío; las líneas inválidas se descartan. */
export function parseCart(raw: string | null): Cart {
  if (!raw || raw.length > 100_000) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null || (data as { v?: unknown }).v !== VERSION) return [];
  const lines = (data as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  const out: Cart = [];
  for (const item of lines.slice(0, MAX_LINES)) {
    if (typeof item !== "object" || item === null) continue;
    const l = item as Record<string, unknown>;
    const productId = str(l.productId, 64);
    const name = str(l.name, 200);
    const path = str(l.path, 300);
    const variantId = l.variantId === null ? null : str(l.variantId, 64);
    const unitPrice = l.unitPrice;
    const quantity = l.quantity;
    if (!productId || !name || !path || !path.startsWith("/") || path.startsWith("//")) continue;
    if (l.variantId !== null && !variantId) continue;
    if (typeof unitPrice !== "number" || !Number.isInteger(unitPrice) || unitPrice < 1 || unitPrice > 100_000_000) continue;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue;
    const key = lineKey(productId, variantId);
    if (out.some((x) => x.key === key)) continue;
    const label = l.variantLabel === null || l.variantLabel === undefined ? null : str(l.variantLabel, 120);
    const image = l.imageUrl === null || l.imageUrl === undefined ? null : str(l.imageUrl, 500);
    out.push({ key, productId, variantId, name, variantLabel: label, unitPrice, imageUrl: image, path, quantity: clamp(quantity) });
  }
  return out;
}

// ---------------------------------------------------------------- mensaje de WhatsApp

const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

/**
 * Texto del pedido para WhatsApp. Solo datos reales del carrito. Aclara que NO es una compra confirmada: el comercio
 * confirma disponibilidad, precio final y forma de entrega o retiro.
 */
export function cartInquiryText(cart: Cart, origin: string | null): string {
  const lines = ["Hola, quiero consultar por estos productos:", ""];
  for (const l of cart) {
    const name = l.variantLabel ? `${l.name} (${l.variantLabel})` : l.name;
    lines.push(`• ${l.quantity} × ${name} — ${money(l.unitPrice)} c/u — ${money(lineSubtotal(l))}`);
    if (origin) lines.push(`  ${origin}${l.path}`);
  }
  lines.push("", `Total estimado: ${money(cartTotal(cart))}`, "", "Los precios son los publicados en el sitio. ¿Me confirman disponibilidad, precio final y cómo coordinamos la entrega o el retiro?");
  return lines.join("\n");
}

/** Los enlaces de WhatsApp tienen un largo máximo razonable: por encima de este tamaño se avisa que el pedido es muy grande. */
export const MAX_MESSAGE_LENGTH = 3500;
