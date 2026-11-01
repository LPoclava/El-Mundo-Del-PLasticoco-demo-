import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine, SaleProblem } from "./cart";
import { describeStockError } from "./stock";

/**
 * Acceso a datos del punto de venta con la sesión real de quien vende. Toda la validación
 * definitiva (permisos, precios, stock, total) ocurre en PostgreSQL: pos_find() y confirm_sale().
 */

export type PosVariant = { id: string; size: string | null; color: string | null; price: number | null; stock: number };

export type PosProduct = {
  productId: string;
  name: string;
  brand: string | null;
  description: string | null;
  barcode: string | null;
  imagePath: string | null;
  archived: boolean;
  variants: PosVariant[];
};

export type PaymentMethod = { code: string; label: string };

export type Receipt = {
  id: string;
  number: number;
  createdAt: string;
  userName: string;
  paymentMethod: string;
  paymentLabel: string;
  total: number;
  replayed: boolean;
  stockUpdated: boolean;
  items: {
    productName: string;
    variantLabel: string | null;
    barcode: string | null;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    stockAfter: number | null;
  }[];
};

export type SaleFailure = {
  /** rejected: la base rechazó la venta (carrito intacto, hay que corregir). unknown: no se sabe si se registró. */
  kind: "rejected" | "forbidden" | "unknown" | "invalid";
  message: string;
  problems: SaleProblem[];
};

type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

export const variantLabel = (v: Pick<PosVariant, "size" | "color">): string | null =>
  [v.size, v.color].filter(Boolean).join(" · ") || null;

export const isBarcode = (value: string) => /^[0-9]{8,14}$/.test(value.trim());

export function toCartLine(product: PosProduct, variant: PosVariant): Omit<CartLine, "quantity"> {
  return {
    variantId: variant.id,
    productId: product.productId,
    name: product.name,
    variantLabel: variantLabel(variant),
    barcode: product.barcode,
    imagePath: product.imagePath,
    unitPrice: variant.price ?? 0,
    stock: variant.stock,
  };
}

/** Una variante se puede vender si tiene precio válido y stock; el producto no puede estar archivado. */
export function sellable(product: PosProduct, variant: PosVariant): boolean {
  return !product.archived && variant.price !== null && variant.price > 0 && variant.stock > 0;
}

export function describeSaleError(error: DbError): SaleFailure {
  const message = error?.message ?? "";
  if (message === "SALE_REJECTED") {
    let problems: SaleProblem[] = [];
    try {
      problems = (JSON.parse(error?.details ?? "{}") as { problems?: SaleProblem[] }).problems ?? [];
    } catch {
      problems = [];
    }
    return { kind: "rejected", message: "La venta no se registró. Revisá lo que se indica y volvé a confirmar.", problems };
  }
  if (error?.code === "42501" || /No autorizado|row-level security|permission denied/i.test(message)) {
    return { kind: "forbidden", message: "Tu cuenta no tiene permiso para vender. Avisá a un responsable.", problems: [] };
  }
  if (error?.code === "22023") {
    return { kind: "invalid", message: "Los datos de la venta no son válidos. Revisá el carrito.", problems: [] };
  }
  return {
    kind: "unknown",
    message: "No pudimos confirmar si la venta se registró (¿se cortó la conexión?). Tocá «Reintentar registro»: si ya estaba registrada no se duplica.",
    problems: [],
  };
}

type ReceiptRow = {
  id: string; number: number; created_at: string; user_name: string; payment_method: string; payment_label: string;
  total: number; replayed?: boolean; stock_updated?: boolean;
  items: { product_name: string; variant_label: string | null; barcode: string | null; unit_price: number; quantity: number; subtotal: number; stock_after: number | null }[];
};

const toReceipt = (r: ReceiptRow): Receipt => ({
  id: r.id, number: r.number, createdAt: r.created_at, userName: r.user_name, paymentMethod: r.payment_method,
  paymentLabel: r.payment_label, total: Number(r.total), replayed: Boolean(r.replayed), stockUpdated: r.stock_updated !== false,
  items: r.items.map((i) => ({
    productName: i.product_name, variantLabel: i.variant_label, barcode: i.barcode, unitPrice: Number(i.unit_price),
    quantity: i.quantity, subtotal: Number(i.subtotal), stockAfter: i.stock_after,
  })),
});

type ProductRow = {
  product_id: string; name: string; brand: string | null; description?: string | null; barcode: string | null; image_path: string | null; archived: boolean;
  variants: { id: string; size: string | null; color: string | null; price: number | null; stock: number }[];
};

export async function findProducts(db: SupabaseClient, term: string): Promise<PosProduct[]> {
  const { data, error } = await db.rpc("pos_find", { p_term: term.trim() });
  if (error) throw new Error(error.code === "42501" ? "Tu cuenta no tiene permiso para vender." : "No se pudo buscar el producto. Probá de nuevo.");
  return ((data ?? []) as ProductRow[]).map((p) => ({
    productId: p.product_id, name: p.name, brand: p.brand, description: p.description ?? null, barcode: p.barcode, imagePath: p.image_path, archived: p.archived,
    variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.price === null ? null : Number(v.price), stock: v.stock })),
  }));
}

export async function listPaymentMethods(db: SupabaseClient): Promise<PaymentMethod[]> {
  const { data, error } = await db.from("payment_methods").select("code,label").eq("enabled", true).order("position");
  if (error) throw new Error("No se pudieron cargar los medios de pago.");
  return (data ?? []) as PaymentMethod[];
}

/** Envía la venta. `expected_price` es el precio que vio quien vende: si cambió, el servidor la rechaza. */
export async function confirmSale(
  db: SupabaseClient,
  idempotencyKey: string,
  paymentMethod: string,
  lines: Pick<CartLine, "variantId" | "quantity" | "unitPrice">[],
): Promise<{ receipt: Receipt } | { failure: SaleFailure }> {
  try {
    const { data, error } = await db.rpc("confirm_sale", {
      p_idempotency_key: idempotencyKey,
      p_payment_method: paymentMethod,
      p_items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, expected_price: l.unitPrice })),
    });
    if (error) return { failure: describeSaleError(error) };
    return { receipt: toReceipt(data as ReceiptRow) };
  } catch {
    // Sin respuesta (red): puede que la base sí haya registrado la venta.
    return { failure: describeSaleError(null) };
  }
}

export type SaleListItem = {
  id: string; number: number; createdAt: string; userName: string; paymentMethod: string; total: number;
  lines: { productName: string; variantLabel: string | null; quantity: number; subtotal: number }[];
};

export type SalesFilter = { from: string | null; to: string | null; method: string };

type SaleRow = {
  id: string; number: number; created_at: string; user_name: string; payment_method: string; total: number;
  sale_items: { product_name: string; variant_label: string | null; quantity: number; subtotal: number }[];
};

/** Ventas recientes. La RLS decide qué ve cada rol: el empleado las suyas, el gerente y el CEO todas. */
export async function listSales(db: SupabaseClient, filter: SalesFilter): Promise<SaleListItem[]> {
  let query = db
    .from("sales")
    .select("id,number,created_at,user_name,payment_method,total,sale_items(product_name,variant_label,quantity,subtotal)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (filter.from) query = query.gte("created_at", filter.from);
  if (filter.to) query = query.lt("created_at", filter.to);
  if (filter.method) query = query.eq("payment_method", filter.method);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las ventas recientes.");
  return ((data ?? []) as SaleRow[]).map((s) => ({
    id: s.id, number: s.number, createdAt: s.created_at, userName: s.user_name, paymentMethod: s.payment_method, total: Number(s.total),
    lines: s.sale_items.map((i) => ({ productName: i.product_name, variantLabel: i.variant_label, quantity: i.quantity, subtotal: Number(i.subtotal) })),
  }));
}

export type CategoryOption = { id: string; name: string };

/** Categorías principales activas para elegir al registrar un producto (las lee todo el personal). */
export async function listMainCategories(db: SupabaseClient): Promise<CategoryOption[]> {
  const { data, error } = await db
    .from("categories")
    .select("id,name")
    .not("featured_position", "is", null)
    .eq("active", true)
    .order("featured_position");
  if (error) {
    // Antes de la migración 20261101 no existe la columna active: se listan las principales sin filtrar.
    if (error.code === "42703") {
      const legacy = await db.from("categories").select("id,name").not("featured_position", "is", null).order("featured_position");
      if (legacy.error) throw new Error("No se pudieron cargar las categorías.");
      return (legacy.data ?? []) as CategoryOption[];
    }
    throw new Error("No se pudieron cargar las categorías.");
  }
  return (data ?? []) as CategoryOption[];
}

/**
 * Alta rápida (scan_create_draft): crea el producto SIN publicar y SIN variantes, así que no tiene
 * precio ni stock: no se puede vender ni mover stock hasta que un gerente lo complete.
 */
export async function createDraftProduct(
  db: SupabaseClient,
  input: { barcode: string; name: string; categoryId: string; description: string },
): Promise<string> {
  const { data, error } = await db.rpc("scan_create_draft", {
    p_barcode: input.barcode, p_name: input.name, p_category_id: input.categoryId, p_description: input.description.trim() || null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Ese código ya está asignado a otro producto.");
    if (error.code === "42501") throw new Error("Tu cuenta no tiene permiso para registrar productos.");
    if (error.code === "22023") throw new Error("Revisá los datos: el nombre, la categoría principal y el código tienen que ser válidos.");
    throw new Error("No se pudo registrar el producto. Probá de nuevo.");
  }
  return data as string;
}

/** Entrada de mercadería (receive_stock): devuelve el stock resultante. */
export async function receiveStock(db: SupabaseClient, variantId: string, quantity: number, note: string): Promise<number> {
  const { data, error } = await db.rpc("receive_stock", { p_variant_id: variantId, p_quantity: quantity, p_note: note.trim() || null });
  if (error) throw new Error(describeStockError(error));
  return Number(data);
}

/** Ajuste de inventario con motivo (adjust_stock): `delta` positivo suma, negativo resta. */
export async function adjustStock(db: SupabaseClient, variantId: string, delta: number, note: string): Promise<number> {
  const { data, error } = await db.rpc("adjust_stock", { p_variant_id: variantId, p_delta: delta, p_note: note.trim() });
  if (error) throw new Error(describeStockError(error));
  return Number(data);
}
