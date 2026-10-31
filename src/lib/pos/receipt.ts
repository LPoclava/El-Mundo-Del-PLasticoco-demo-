/** Texto plano del comprobante, para compartirlo. Solo usa los datos que devolvió el servidor al confirmar la venta. */
export type ReceiptLike = {
  number: number | string;
  createdAt: string;
  userName: string;
  paymentLabel: string;
  total: number;
  items: { productName: string; variantLabel: string | null; quantity: number; unitPrice: number; subtotal: number }[];
};

const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export function receiptText(r: ReceiptLike): string {
  const lines = [
    "El Mundo del Plástico",
    `Comprobante de venta #${r.number}`,
    date.format(new Date(r.createdAt)),
    "",
    ...r.items.map((i) => `${i.quantity} × ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""} — ${money(i.subtotal)}`),
    "",
    `Total: ${money(r.total)}`,
    `Medio de pago: ${r.paymentLabel}`,
    `Atendió: ${r.userName}`,
  ];
  return lines.join("\n");
}
