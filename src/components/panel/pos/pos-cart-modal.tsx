"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/catalog/url";
import { cartIssues, cartTotal, cartUnits, lineSubtotal, type Cart } from "@/lib/pos/cart";
import type { PaymentMethod, Receipt } from "@/lib/pos/api";
import { Icon } from "../icons";
import { Button, Dialog } from "../ui";
import { QuantityStepper, Thumb } from "./pos-parts";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export type CartActions = {
  setQuantity: (variantId: string, n: number) => void;
  step: (variantId: string, d: 1 | -1) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  cart: Cart;
  actions: CartActions;
  methods: PaymentMethod[] | null;
  method: string | null;
  onMethod: (code: string) => void;
  busy: boolean;
  failure: { message: string; details: string[] } | null;
  receipt: Receipt | null;
  onConfirm: () => void;
  onNewSale: () => void;
};

/**
 * Detalle de la venta. Pasos: 1) carrito (editar), 2) revisar y elegir medio de pago, 3) comprobante.
 * El carrito solo se vacía cuando el servidor confirma la venta.
 */
export function CartModal({ open, onClose, cart, actions, methods, method, onMethod, busy, failure, receipt, onConfirm, onNewSale }: Props) {
  const [review, setReview] = useState(false);
  const [clearing, setClearing] = useState(false);
  const issues = cartIssues(cart);
  const total = cartTotal(cart);
  const title = receipt ? "Venta registrada" : review ? "Confirmar venta" : "Carrito de venta";

  return (
    <>
      <Dialog open={open} onClose={onClose} variant="sheet" title={title}>
        {receipt ? (
          <ReceiptView receipt={receipt} onNew={() => { setReview(false); onNewSale(); }} />
        ) : cart.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-medium">El carrito está vacío</p>
            <p className="mt-1 text-sm text-brand-muted">Escaneá un producto y elegí «Agregar al carrito».</p>
            <Button className="mt-4" onClick={onClose}>Seguir escaneando</Button>
          </div>
        ) : !review ? (
          <div className="space-y-4">
            <ul className="divide-y divide-brand-line">
              {cart.map((line) => {
                const issue = issues.find((i) => i.variantId === line.variantId);
                return (
                  <li key={line.variantId} className="py-3">
                    <div className="flex items-start gap-3">
                      <Thumb path={line.imagePath} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{line.name}</p>
                        <p className="text-xs text-brand-muted">{line.variantLabel ?? "Variante única"}{line.barcode ? ` · ${line.barcode}` : ""}</p>
                        <p className="text-xs tabular-nums text-brand-muted">{formatPrice(line.unitPrice)} c/u · Stock {line.stock}</p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">{formatPrice(lineSubtotal(line))}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        name={line.name} value={line.quantity} max={line.stock}
                        onChange={(n) => actions.setQuantity(line.variantId, n)} onStep={(d) => actions.step(line.variantId, d)}
                      />
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => actions.remove(line.variantId)} aria-label={`Quitar ${line.name}`}>Quitar</Button>
                    </div>
                    {issue && (
                      <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-brand-danger">
                        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />{issue.message}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-baseline justify-between border-t border-brand-line pt-3">
              <p className="text-sm text-brand-muted">{cartUnits(cart)} {cartUnits(cart) === 1 ? "unidad" : "unidades"}</p>
              <p className="text-2xl font-semibold tabular-nums" aria-live="polite">Total {formatPrice(total)}</p>
            </div>

            <div className="grid gap-2">
              <Button
                variant="primary" className="h-14 w-full text-base" disabled={issues.length > 0}
                onClick={() => setReview(true)}
              >
                Registrar venta
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={onClose}>Seguir escaneando</Button>
                <Button variant="ghost" className="border border-brand-line" onClick={() => setClearing(true)}>Vaciar carrito</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
              {cart.map((l) => (
                <li key={l.variantId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">{l.quantity} × {l.name}{l.variantLabel ? ` (${l.variantLabel})` : ""}<span className="block text-xs text-brand-muted tabular-nums">{formatPrice(l.unitPrice)} c/u</span></span>
                  <span className="shrink-0 font-medium tabular-nums">{formatPrice(lineSubtotal(l))}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-baseline justify-between text-2xl font-semibold tabular-nums"><span>Total</span><span>{formatPrice(total)}</span></p>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Medio de pago (obligatorio)</legend>
              {methods === null ? (
                <p className="text-sm text-brand-muted">Cargando medios de pago…</p>
              ) : methods.length === 0 ? (
                <p className="text-sm text-brand-danger">No hay medios de pago habilitados. Avisá a un responsable.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {methods.map((m) => (
                    <label
                      key={m.code}
                      className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink ${
                        method === m.code ? "border-brand-ink bg-brand-sand" : "border-brand-line bg-white hover:border-brand-ink"
                      }`}
                    >
                      <input type="radio" name="pos-method" value={m.code} checked={method === m.code} disabled={busy} onChange={() => onMethod(m.code)} className="size-4 accent-brand-green" />
                      {m.label}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {failure && (
              <div role="alert" className="rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm">
                <p className="font-medium text-brand-danger">{failure.message}</p>
                {failure.details.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">{failure.details.map((m, i) => <li key={i}>{m}</li>)}</ul>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Button variant="primary" className="h-14 w-full text-base" disabled={busy || method === null || issues.length > 0} onClick={onConfirm}>
                {busy ? "Registrando la venta…" : "Confirmar venta"}
              </Button>
              {method === null && !busy && <p className="text-center text-xs text-brand-muted">Elegí un medio de pago para confirmar.</p>}
              <Button variant="ghost" className="border border-brand-line" disabled={busy} onClick={() => setReview(false)}>Volver al carrito</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={clearing} onClose={() => setClearing(false)} title="Vaciar el carrito">
        <p className="text-sm text-brand-muted">Se van a quitar los {cart.length} productos del carrito. No se descuenta stock ni se registra nada.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setClearing(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { actions.clear(); setClearing(false); setReview(false); }}>Vaciar</Button>
        </div>
      </Dialog>
    </>
  );
}

function ReceiptView({ receipt, onNew }: { receipt: Receipt; onNew: () => void }) {
  return (
    <div role="status" className="space-y-3">
      <p className="flex items-center gap-2 font-semibold text-brand-green-ink">
        <Icon name="check" className="size-5" />
        {receipt.replayed ? "Esta venta ya estaba registrada" : "Venta confirmada"}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-brand-muted">Número</dt><dd className="font-medium tabular-nums">#{receipt.number}</dd>
        <dt className="text-brand-muted">Fecha</dt><dd className="tabular-nums">{dateTime.format(new Date(receipt.createdAt))}</dd>
        <dt className="text-brand-muted">Vendió</dt><dd>{receipt.userName}</dd>
        <dt className="text-brand-muted">Medio de pago</dt><dd>{receipt.paymentLabel}</dd>
      </dl>
      <ul className="divide-y divide-brand-line border-y border-brand-line text-sm">
        {receipt.items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3 py-1.5">
            <span className="min-w-0">{i.quantity} × {i.productName}{i.variantLabel ? ` (${i.variantLabel})` : ""}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-lg font-semibold tabular-nums"><span>Total cobrado</span><span>{formatPrice(receipt.total)}</span></p>
      <p className="text-xs text-brand-muted">
        {receipt.stockUpdated ? "Stock descontado: " : ""}
        {receipt.items.filter((i) => i.stockAfter !== null).map((i) => `${i.productName}: quedan ${i.stockAfter}`).join(" · ")}
      </p>
      <Button variant="primary" className="h-12 w-full" onClick={onNew}>Nueva venta</Button>
    </div>
  );
}
