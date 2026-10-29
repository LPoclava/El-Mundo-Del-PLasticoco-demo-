/**
 * Lógica pura del carrito de venta (sin React ni Supabase): se prueba con node --test.
 * El carrito es solo una comodidad de pantalla: el servidor vuelve a validar precios, stock y
 * total en confirm_sale() y es el único que decide.
 */

export type CartLine = {
  variantId: string;
  productId: string;
  name: string;
  /** "M · Azul", o null si el producto tiene una sola variante sin atributos. */
  variantLabel: string | null;
  barcode: string | null;
  imagePath: string | null;
  /** Precio que vio quien vende; se envía como expected_price y el servidor lo contrasta. */
  unitPrice: number;
  quantity: number;
  /** Stock disponible según la última consulta. */
  stock: number;
};

export type Cart = CartLine[];

export const MAX_QUANTITY = 9999;

export type AddResult = { cart: Cart; added: boolean; reason?: "no-stock" | "max-stock" };

/**
 * Suma `quantity` unidades. Si la variante ya está, aumenta esa línea (nunca crea un duplicado)
 * y actualiza precio y stock con los datos recién consultados. No supera el stock disponible.
 */
export function addToCart(cart: Cart, line: Omit<CartLine, "quantity">, quantity = 1): AddResult {
  if (line.stock <= 0) return { cart, added: false, reason: "no-stock" };
  const index = cart.findIndex((l) => l.variantId === line.variantId);
  if (index === -1) {
    return { cart: [...cart, { ...line, quantity: Math.min(quantity, line.stock) }], added: true };
  }
  const current = cart[index];
  const wanted = current.quantity + quantity;
  if (wanted > line.stock) {
    const next = cart.map((l, i) => (i === index ? { ...l, ...line, quantity: Math.min(l.quantity, line.stock) } : l));
    return { cart: next, added: false, reason: "max-stock" };
  }
  return { cart: cart.map((l, i) => (i === index ? { ...l, ...line, quantity: wanted } : l)), added: true };
}

/** Parsea lo escrito en el campo de cantidad: solo enteros positivos. */
export function parseQuantity(raw: string): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_QUANTITY ? n : null;
}

export function setQuantity(cart: Cart, variantId: string, quantity: number): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) return cart;
  return cart.map((l) => (l.variantId === variantId ? { ...l, quantity } : l));
}

export function changeQuantity(cart: Cart, variantId: string, delta: 1 | -1): Cart {
  return cart.map((l) => {
    if (l.variantId !== variantId) return l;
    const next = l.quantity + delta;
    return next < 1 || next > Math.min(l.stock, MAX_QUANTITY) ? l : { ...l, quantity: next };
  });
}

export function removeLine(cart: Cart, variantId: string): Cart {
  return cart.filter((l) => l.variantId !== variantId);
}

export const lineSubtotal = (l: Pick<CartLine, "unitPrice" | "quantity">) => l.unitPrice * l.quantity;
export const cartTotal = (cart: Cart) => cart.reduce((sum, l) => sum + lineSubtotal(l), 0);
export const cartUnits = (cart: Cart) => cart.reduce((sum, l) => sum + l.quantity, 0);

export type CartIssue = { variantId: string; message: string };

/** Problemas que impiden confirmar. Vacío = se puede enviar al servidor. */
export function cartIssues(cart: Cart): CartIssue[] {
  const issues: CartIssue[] = [];
  for (const l of cart) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) issues.push({ variantId: l.variantId, message: "La cantidad tiene que ser 1 o más." });
    else if (l.quantity > l.stock) {
      issues.push({ variantId: l.variantId, message: l.stock <= 0 ? "Sin stock." : `Hay ${l.stock} en stock.` });
    } else if (!(l.unitPrice > 0)) issues.push({ variantId: l.variantId, message: "Sin precio válido." });
  }
  return issues;
}

/** Cambia con cualquier edición del carrito o del medio de pago: identifica un "intento" de venta. */
export function attemptSignature(cart: Cart, method: string | null): string {
  const lines = [...cart].sort((a, b) => a.variantId.localeCompare(b.variantId)).map((l) => `${l.variantId}:${l.quantity}:${l.unitPrice}`);
  return `${method ?? ""}|${lines.join(",")}`;
}

/** Aplica al carrito lo que el servidor dijo al rechazar (precio nuevo, stock real), sin vaciarlo. */
export type SaleProblem = {
  reason: string;
  variant_id?: string;
  name?: string;
  price?: number;
  available?: number;
  requested?: number;
};

export function applyProblems(cart: Cart, problems: SaleProblem[]): Cart {
  return cart.map((l) => {
    const p = problems.find((x) => x.variant_id === l.variantId);
    if (!p) return l;
    if (p.reason === "PRICE_CHANGED" && typeof p.price === "number") return { ...l, unitPrice: p.price };
    if (p.reason === "INSUFFICIENT_STOCK" && typeof p.available === "number") return { ...l, stock: p.available };
    return l;
  });
}

const PROBLEM_TEXT: Record<string, (p: SaleProblem) => string> = {
  NOT_FOUND: () => "Un producto del carrito ya no existe.",
  ARCHIVED: (p) => `«${p.name ?? "Un producto"}» está archivado y no se puede vender.`,
  NO_PRICE: (p) => `«${p.name ?? "Un producto"}» no tiene un precio válido.`,
  PRICE_CHANGED: (p) => `El precio de «${p.name ?? "un producto"}» cambió${typeof p.price === "number" ? ` y ahora es $ ${p.price.toLocaleString("es-AR")}` : ""}. Revisá el total.`,
  QUANTITY: (p) => `La cantidad de «${p.name ?? "un producto"}» es demasiado alta.`,
  INSUFFICIENT_STOCK: (p) =>
    `No alcanza el stock de «${p.name ?? "un producto"}»: hay ${p.available ?? 0} y pediste ${p.requested ?? "más"}.`,
  PAYMENT_METHOD: () => "El medio de pago elegido no está habilitado.",
};

export function describeProblem(p: SaleProblem): string {
  return (PROBLEM_TEXT[p.reason] ?? (() => "No se pudo validar un producto de la venta."))(p);
}
