import type { CartLine } from "./cart";

/**
 * Lo que el punto de venta sabe de un producto y sus variantes, y cuándo se puede vender (sin React ni Supabase:
 * se prueba con node --test). La base vuelve a validar todo en confirm_sale(); esto solo evita ofrecer lo que va a rechazar.
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
