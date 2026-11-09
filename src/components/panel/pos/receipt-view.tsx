"use client";

import Image from "next/image";
import { useState } from "react";
import { CONTACT } from "@/config/contact";
import { formatPrice } from "@/lib/catalog/url";
import { RECEIPT_NOTICE, receiptDocumentTitle, receiptHeader, receiptText, type ReceiptLike } from "@/lib/pos/receipt";
import { Button, Dialog } from "../ui";

const BUSINESS = { address: CONTACT.address, locality: CONTACT.locality };
const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

/**
 * Comprobante INTERNO de una operación: logo y datos del comercio, número y fecha, productos con variante, cantidad,
 * precio unitario y subtotal, total y medio de pago. Dice de forma explícita que NO es una factura ni un comprobante
 * fiscal. Solo muestra lo que guardó la base; el stock restante y los códigos no se incluyen (son datos internos).
 * Lo que está dentro de #comprobante es lo único que se imprime (ver @media print en globals.css).
 */
export function ReceiptView({ receipt }: { receipt: ReceiptLike }) {
  const [header, ...rest] = receiptHeader(BUSINESS);
  return (
    <article id="comprobante" aria-label={`Comprobante interno número ${receipt.number}`} className="space-y-3 rounded-xl border border-brand-line bg-white p-4 text-brand-charcoal">
      <div className="flex items-center gap-3">
        <Image src="/brand/logo-horizontal.png" alt="" width={900} height={329} className="h-12 w-auto shrink-0" priority />
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{header}</p>
          {rest.map((line) => <p key={line} className="text-xs text-brand-muted print:text-black">{line}</p>)}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-brand-line pt-3">
        <p className="text-base font-semibold">Comprobante interno #{receipt.number}</p>
        <p className="text-sm tabular-nums text-brand-muted print:text-black">{dateTime.format(new Date(receipt.createdAt))}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-brand-muted print:text-black">Atendió</dt><dd>{receipt.userName}</dd>
        <dt className="text-brand-muted print:text-black">Medio de pago</dt><dd>{receipt.paymentLabel}</dd>
      </dl>
      <table className="w-full text-sm">
        <caption className="sr-only">Detalle de la venta</caption>
        <thead>
          <tr className="border-y border-brand-line text-left text-xs text-brand-muted print:text-black">
            <th scope="col" className="py-1.5 pr-2 font-medium">Producto</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Cant.</th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Precio</th>
            <th scope="col" className="py-1.5 pl-2 text-right font-medium">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {receipt.items.map((i, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1.5 pr-2">{i.productName}{i.variantLabel ? <span className="block text-xs text-brand-muted print:text-black">{i.variantLabel}</span> : null}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{i.quantity}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatPrice(i.unitPrice)}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">{formatPrice(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex justify-between border-t border-brand-line pt-2 text-lg font-semibold tabular-nums"><span>Total</span><span>{formatPrice(receipt.total)}</span></p>
      <p className="text-xs font-medium">{RECEIPT_NOTICE}</p>
    </article>
  );
}

/** Abre el diálogo de impresión del navegador (ahí también se elige «Guardar como PDF»), con un nombre de archivo claro. */
export function printReceipt(receipt: Pick<ReceiptLike, "number">) {
  const previous = document.title;
  document.title = receiptDocumentTitle(receipt);
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/** Imprimir / guardar como PDF y compartir como texto. No registra nada: es solo salida de un comprobante ya guardado. */
export function ReceiptActions({ receipt }: { receipt: ReceiptLike }) {
  const [shared, setShared] = useState<string | null>(null);

  async function share() {
    const text = receiptText(receipt, BUSINESS);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Comprobante #${receipt.number}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("Comprobante copiado: pegalo donde quieras compartirlo.");
    } catch (e) {
      // Cerrar el menú de compartir no es un error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setShared("No se pudo compartir desde este navegador. Probá con Imprimir.");
    }
  }

  return (
    <div className="print:hidden">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button icon="receipt" onClick={() => printReceipt(receipt)}>Imprimir o guardar PDF</Button>
        <Button icon="link" onClick={() => void share()}>Compartir</Button>
      </div>
      <p className="mt-2 text-xs text-brand-muted">En la ventana de impresión elegí «Guardar como PDF» como destino para obtener el archivo.</p>
      {shared && <p className="mt-1 text-sm text-brand-muted" aria-live="polite">{shared}</p>}
    </div>
  );
}

/** Vista previa del comprobante de una venta ya registrada (desde el detalle de la venta). */
export function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptLike | null; onClose: () => void }) {
  return (
    <Dialog open={receipt !== null} onClose={onClose} title="Comprobante interno" description="Vista previa de lo que se imprime.">
      {receipt && (
        <div className="space-y-4">
          <ReceiptView receipt={receipt} />
          <ReceiptActions receipt={receipt} />
        </div>
      )}
    </Dialog>
  );
}
