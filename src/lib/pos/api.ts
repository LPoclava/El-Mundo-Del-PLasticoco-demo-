import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "./cart";
import { describeSaleError, type SaleFailure } from "./errors";
import type { PosProduct } from "./sellable";
import { describeStockError } from "./stock";

// Las piezas puras viven en sellable.ts y errors.ts (para poder probarlas); se reexportan para no cambiar los imports.
export { describeSaleError, type SaleFailure } from "./errors";
export { isBarcode, sellable, toCartLine, variantLabel, type PosProduct, type PosVariant } from "./sellable";

/**
 * Acceso a datos del punto de venta con la sesión real de quien vende. Toda la validación
 * definitiva (permisos, precios, stock, total) ocurre en PostgreSQL: pos_find() y confirm_sale().
 */

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

type FoundSaleRow = {
  id: string; number: number; created_at: string; user_name: string; payment_method: string; total: number;
  sale_items: { product_name: string; variant_label: string | null; barcode: string | null; unit_price: number; quantity: number; subtotal: number }[];
};

/**
 * ¿Esa clave de operación ya tiene una venta registrada de ESTA cuenta? (hallazgo H1). Se filtra por `user_id`
 * además de la clave: la clave es única por usuario, y un gerente o el CEO ven las ventas de todos, así que sin ese
 * filtro podrían aparecer dos filas. Lee con la sesión de quien consulta (RLS: nadie ve ventas ajenas que no le toquen).
 * Devuelve null si no hay venta; LANZA si no se pudo consultar (distinto de «no hay»).
 * El stock restante no se informa: el empleado no puede leer los movimientos de stock.
 */
export async function findSaleByKey(db: SupabaseClient, userId: string, key: string): Promise<Receipt | null> {
  const { data, error } = await db
    .from("sales")
    .select("id,number,created_at,user_name,payment_method,total,sale_items(product_name,variant_label,barcode,unit_price,quantity,subtotal)")
    .eq("user_id", userId)
    .eq("idempotency_key", key)
    .order("product_name", { referencedTable: "sale_items" })
    .maybeSingle();
  if (error) throw new Error("No se pudo consultar si la venta ya estaba registrada.");
  if (!data) return null;
  const sale = data as unknown as FoundSaleRow;

  // El nombre del medio de pago es un dato de cortesía: si no se puede leer (por ejemplo, ya está deshabilitado), se muestra el código.
  let label = sale.payment_method;
  try {
    const pm = await db.from("payment_methods").select("label").eq("code", sale.payment_method).maybeSingle();
    if (!pm.error && pm.data && typeof (pm.data as { label?: unknown }).label === "string") label = (pm.data as { label: string }).label;
  } catch {
    // Se queda con el código.
  }

  return {
    id: sale.id,
    number: sale.number,
    createdAt: sale.created_at,
    userName: sale.user_name,
    paymentMethod: sale.payment_method,
    paymentLabel: label,
    total: Number(sale.total),
    replayed: true,
    stockUpdated: true,
    items: sale.sale_items.map((i) => ({
      productName: i.product_name, variantLabel: i.variant_label, barcode: i.barcode, unitPrice: Number(i.unit_price),
      quantity: i.quantity, subtotal: Number(i.subtotal), stockAfter: null,
    })),
  };
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
