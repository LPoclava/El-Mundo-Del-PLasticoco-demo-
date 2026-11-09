/**
 * Comprobante INTERNO de la operación: texto plano para compartirlo. Solo usa los datos que devolvió el servidor al
 * confirmar la venta. No es una factura ni un comprobante fiscal autorizado, y así lo dice (RECEIPT_NOTICE).
 */
export type ReceiptLike = {
  number: number | string;
  createdAt: string;
  userName: string;
  paymentLabel: string;
  total: number;
  items: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number; subtotal: number }[];
};

export const BUSINESS_NAME = "El Mundo del Plástico";

/** Leyenda obligatoria: evita que el cliente tome este comprobante por una factura. */
export const RECEIPT_NOTICE = "Comprobante interno de operación. No es una factura ni un comprobante fiscal.";

export type ReceiptBusiness = { name?: string; address?: string | null; locality?: string | null };

/** Identificación del negocio: nombre y, si están cargados, dirección y localidad (src/config/contact.ts). */
export function receiptHeader(business?: ReceiptBusiness): string[] {
  return [business?.name || BUSINESS_NAME, business?.address, business?.locality].filter((l): l is string => Boolean(l));
}

/** Datos mínimos de una venta ya registrada (la lista de ventas) para reabrir su comprobante. */
export type SaleLike = {
  number: number | string;
  createdAt: string;
  userName: string;
  total: number;
  lines: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number; subtotal: number }[];
};

/** Arma el comprobante de una venta ya registrada a partir de lo que guardó la base (no recalcula nada). */
export function saleToReceipt(sale: SaleLike, paymentLabel: string): ReceiptLike {
  return {
    number: sale.number,
    createdAt: sale.createdAt,
    userName: sale.userName,
    paymentLabel,
    total: sale.total,
    items: sale.lines.map((l) => ({ productName: l.productName, variantLabel: l.variantLabel, quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.subtotal })),
  };
}

/** Título del documento al imprimir: es el nombre sugerido del archivo cuando se elige «Guardar como PDF». */
export function receiptDocumentTitle(r: Pick<ReceiptLike, "number">): string {
  return `Comprobante interno ${String(r.number).padStart(6, "0")}`;
}

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export function receiptText(r: ReceiptLike, business?: ReceiptBusiness): string {
  const lines = [
    ...receiptHeader(business),
    `Comprobante de venta #${r.number}`,
    date.format(new Date(r.createdAt)),
    "",
    ...r.items.map((i) => `${i.quantity} × ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""} — ${money(i.subtotal)}`),
    "",
    `Total: ${money(r.total)}`,
    `Medio de pago: ${r.paymentLabel}`,
    `Atendió: ${r.userName}`,
    "",
    RECEIPT_NOTICE,
  ];
  return lines.join("\n");
}
