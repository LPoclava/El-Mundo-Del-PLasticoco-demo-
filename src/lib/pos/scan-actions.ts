import { sellable, type PosProduct, type PosVariant } from "./sellable.ts";

/**
 * Qué se le ofrece al operador después de leer un código (sin React ni Supabase: se prueba con node --test).
 * Es solo la presentación: cada operación la vuelve a validar la base (RLS y funciones del punto de venta).
 *
 * Tres acciones, cada una con su color:
 *   - «Registrar producto» (amarillo): el código no existe, o el producto existe pero está incompleto.
 *   - «Actualizar stock» (verde): solo gerente o superior, producto completo y no archivado.
 *   - «Registrar venta» (naranja): entra al modo venta. En modo venta las otras dos NO se ofrecen.
 */
export type ScanAction = "registrar-producto" | "completar-producto" | "actualizar-stock" | "registrar-venta" | "agregar";

export type ScanTarget = { kind: "unknown" } | { kind: "product"; product: PosProduct };

export type StatusTone = "ok" | "warn" | "danger";
export type ProductStatus = { tone: StatusTone; label: string };

/** Estado comercial del producto, en una frase para mostrar junto al nombre. */
export function productStatus(product: PosProduct): ProductStatus {
  if (product.archived) return { tone: "danger", label: "Archivado: no se vende" };
  if (product.variants.length === 0) return { tone: "warn", label: "Producto incompleto" };
  const anySellable = product.variants.some((v) => sellable(product, v));
  if (anySellable) return { tone: "ok", label: "Disponible para vender" };
  const noPrice = product.variants.every((v) => v.price === null || v.price <= 0);
  if (noPrice) return { tone: "warn", label: "Sin precio cargado" };
  return { tone: "warn", label: "Sin stock" };
}

export function availableActions(target: ScanTarget, opts: { canManage: boolean; saleMode: boolean }): ScanAction[] {
  if (opts.saleMode) {
    // En modo venta la pantalla solo agrega al carrito: no se registra ni se mueve stock sin salir antes.
    return target.kind === "product" && target.product.variants.length > 0 && !target.product.archived ? ["agregar"] : [];
  }
  if (target.kind === "unknown") return ["registrar-producto"];
  const { product } = target;
  const actions: ScanAction[] = [];
  if (product.variants.length === 0) {
    actions.push("completar-producto");
    return actions;
  }
  if (!product.archived && product.variants.some((v) => sellable(product, v))) actions.push("registrar-venta");
  if (opts.canManage && !product.archived) actions.push("actualizar-stock");
  return actions;
}

/**
 * En modo venta, un producto con una sola variante vendible se agrega solo al escanear. Con varias hay que elegir:
 * devuelve null y la pantalla muestra las variantes.
 */
export function autoAddVariant(product: PosProduct): PosVariant | null {
  const options = product.variants.filter((v) => sellable(product, v));
  const total = product.variants.length;
  return options.length === 1 && total === 1 ? options[0] : null;
}

/** Cancelar una venta pide confirmación si ya hay algo armado. */
export function cancelNeedsConfirmation(units: number): boolean {
  return units > 0;
}

/** Dirección del control de stock con el producto ya identificado (el código viaja en la URL, no se guarda nada). */
export function stockHref(barcode: string | null): string {
  return barcode ? `/panel/stock?codigo=${encodeURIComponent(barcode)}` : "/panel/stock";
}

/** Lee y valida el código que llega por la URL: solo 8 a 14 dígitos. */
export function barcodeFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("codigo")?.trim() ?? "";
  return /^[0-9]{8,14}$/.test(value) ? value : null;
}
