"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/catalog/url";
import { cartIssues, cartTotal, cartUnits, lineSubtotal, type Cart } from "@/lib/pos/cart";
import type { PaymentMethod, Receipt } from "@/lib/pos/api";
import { CONTACT } from "@/config/contact";
import { RECEIPT_NOTICE, receiptHeader, receiptText } from "@/lib/pos/receipt";
import { Icon } from "../icons";
import { Drawer } from "../drawer";
import { Button, Dialog } from "../ui";
import { QuantityStepper, Thumb } from "./pos-parts";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

/** Identificación del negocio en el comprobante (se edita en src/config/contact.ts). */
const BUSINESS = { address: CONTACT.address, locality: CONTACT.locality };

export type CartActions = {
  setQuantity: (variantId: string, n: number) => void;
  step: (variantId: string, d: 1 | -1) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

/** Una venta con resultado incierto (H1): qué se sabe de ella y qué se puede hacer. */
export type PendingView = {
  units: number;
  total: number;
  check: "checking" | "unknown" | "not-registered" | "lookup-failed";
  /** false si el navegador no pudo guardar el intento: una recarga lo perdería. */
  storageOk: boolean;
  onVerify: () => void;
  onRetry: () => void;
  onDiscard: () => void;
};

type Props = {
  open: boolean;
  /** Cierra el panel; la venta en curso se conserva (el escáner de atrás no se toca). */
  onClose: () => void;
  cart: Cart;
  actions: CartActions;
  methods: PaymentMethod[] | null;
  method: string | null;
  onMethod: (code: string) => void;
  /** true mientras el servidor procesa la venta. */
  busy: boolean;
  /** true con una venta sin confirmar: el carrito y el medio de pago no se pueden cambiar. */
  frozen: boolean;
  pending: PendingView | null;
  failure: { message: string; details: string[]; kind?: string } | null;
  /** Solo existe cuando el servidor confirmó la venta. */
  receipt: Receipt | null;
  onConfirm: () => void;
  onNewSale: () => void;
};

/**
 * Carrito lateral. Tres estados de registro bien distintos:
 *  1. procesando: botón deshabilitado con un carrito que rueda y «Registrando venta…» (no se puede enviar dos veces);
 *  2. concretada: recién cuando el servidor devuelve el comprobante, carrito que se vuelve check y «¡Venta concretada!»;
 *  3. error: mensaje claro, el carrito intacto y el botón pasa a «Reintentar» (la clave de idempotencia evita duplicar).
 * El carrito solo se vacía cuando el servidor confirma: eso lo decide quien usa este componente, no la animación.
 */
export function CartDrawer({ open, onClose, cart, actions, methods, method, onMethod, busy, frozen, pending, failure, receipt, onConfirm, onNewSale }: Props) {
  const [clearing, setClearing] = useState(false);
  const issues = cartIssues(cart);
  const total = cartTotal(cart);
  const units = cartUnits(cart);
  const canSubmit = !busy && method !== null && issues.length === 0 && cart.length > 0;
  const notice = pending && !receipt ? <PendingNotice pending={pending} busy={busy} /> : null;

  // Con una venta sin confirmar no hay botón «Registrar»: se resuelve desde el aviso (verificar, reintentar o descartar).
  const footer = receipt || pending ? null : cart.length === 0 ? null : (
    <div className="space-y-3">
      <p className="flex items-baseline justify-between" aria-live="polite">
        <span className="text-sm text-brand-muted">Total</span>
        <span className="text-2xl font-semibold tabular-nums">{formatPrice(total)}</span>
      </p>

      <fieldset disabled={busy}>
        <legend className="mb-1.5 text-sm font-medium">Medio de pago</legend>
        {methods === null ? (
          <p className="text-sm text-brand-muted">Cargando medios de pago…</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-brand-danger">No hay medios de pago habilitados. Avisá a un responsable.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <label
                key={m.code}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-ink ${
                  method === m.code ? "border-brand-green bg-brand-green/10 text-brand-green-ink" : "border-brand-line bg-white hover:border-brand-ink"
                }`}
              >
                <input type="radio" name="pos-method" value={m.code} checked={method === m.code} onChange={() => onMethod(m.code)} className="size-4 accent-brand-green" />
                {m.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <Button
        variant="primary"
        className="h-12 w-full text-base"
        disabled={!canSubmit}
        aria-busy={busy}
        onClick={onConfirm}
      >
        {busy ? (
          <>
            <span className="sale-roll inline-flex"><Icon name="cart" className="size-5" /></span>
            Registrando venta…
          </>
        ) : (
          <>
            <Icon name={failure ? "refresh" : "receipt"} className="size-5" />
            {failure ? "Reintentar registro" : "Registrar venta"}
          </>
        )}
      </Button>
      {method === null && !busy && <p className="text-center text-xs text-brand-muted">Elegí un medio de pago para registrar la venta.</p>}
    </div>
  );

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={receipt ? "Venta registrada" : "Carrito"}
        meta={receipt ? undefined : cart.length > 0 ? `${units} ${units === 1 ? "unidad" : "unidades"}` : undefined}
        icon={receipt ? "check" : "cart"}
        locked={busy}
        footer={footer}
      >
        {receipt ? (
          <SaleDone receipt={receipt} onNew={onNewSale} />
        ) : cart.length === 0 ? (
          <div className="space-y-3">
            {notice}
            <div className="py-10 text-center">
              <p className="font-medium">El carrito está vacío</p>
              <p className="mt-1 text-sm text-brand-muted">Escaneá un producto y tocá «Agregar».</p>
              <Button className="mt-4" onClick={onClose}>Seguir escaneando</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notice}
            <ul className="divide-y divide-brand-line">
              {cart.map((line) => {
                const issue = issues.find((i) => i.variantId === line.variantId);
                return (
                  <li key={line.variantId} className="py-3">
                    <div className="flex items-start gap-3">
                      <Thumb path={line.imagePath} name={line.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{line.name}</p>
                        {line.variantLabel && <p className="text-sm text-brand-muted">{line.variantLabel}</p>}
                        <p className="text-sm tabular-nums text-brand-muted">{formatPrice(line.unitPrice)} c/u</p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums">{formatPrice(lineSubtotal(line))}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        name={line.name} value={line.quantity} max={line.stock} disabled={frozen}
                        onChange={(n) => actions.setQuantity(line.variantId, n)} onStep={(d) => actions.step(line.variantId, d)}
                      />
                      <Button size="sm" variant="ghost" icon="trash" disabled={busy || frozen} onClick={() => actions.remove(line.variantId)} aria-label={`Quitar ${line.name}`}>Quitar</Button>
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

            {/* «No se registró nada» solo se dice cuando es cierto (la base rechazó). Con resultado incierto lo explica el aviso de arriba. */}
            {failure && !pending && (
              <div role="alert" className="rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm">
                <p className="font-medium text-brand-danger">{failure.message}</p>
                {failure.details.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">{failure.details.map((m, i) => <li key={i}>{m}</li>)}</ul>
                )}
                {failure.kind !== "unknown" && <p className="mt-1.5 text-brand-muted">Tu carrito sigue como estaba. No se registró nada.</p>}
              </div>
            )}

            <Button variant="ghost" size="sm" className="border border-brand-line" disabled={busy || frozen} onClick={() => setClearing(true)}>Vaciar carrito</Button>
          </div>
        )}
      </Drawer>

      <Dialog open={clearing} onClose={() => setClearing(false)} title="Vaciar el carrito">
        <p className="text-sm text-brand-muted">Se van a quitar los {cart.length} productos del carrito. No se descuenta stock ni se registra nada.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setClearing(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => { actions.clear(); setClearing(false); }}>Vaciar</Button>
        </div>
      </Dialog>
    </>
  );
}

const CHECK_TEXT: Record<PendingView["check"], string> = {
  checking: "Consultando si la venta ya quedó registrada…",
  unknown: "No sabemos si esta venta quedó registrada: se cortó la conexión o se recargó la página mientras se confirmaba.",
  "not-registered": "La consulta no encontró esta venta: todavía no figura como registrada.",
  "lookup-failed": "No pudimos consultar si la venta quedó registrada. Revisá la conexión.",
};

/**
 * Venta con resultado incierto: no se puede armar otra hasta resolverla. Reintentar usa la MISMA operación (misma clave y
 * mismo contenido) y primero consulta si ya existe: si existía, se muestra su comprobante y no se duplica.
 */
function PendingNotice({ pending, busy }: { pending: PendingView; busy: boolean }) {
  const checking = pending.check === "checking";
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm">
      <div>
        <p className="font-medium text-brand-danger">Hay una venta sin confirmar</p>
        <p className="mt-0.5 tabular-nums">{pending.units} {pending.units === 1 ? "unidad" : "unidades"} · {formatPrice(pending.total)}</p>
        <p className="mt-1.5">{CHECK_TEXT[pending.check]}</p>
        <p className="mt-1.5 text-brand-muted">
          Hasta resolverla no se puede armar otra venta. Si tocás «Reintentar registro» y la venta ya existía, no se duplica.
        </p>
        {!pending.storageOk && (
          <p className="mt-1.5 font-medium">Este navegador no pudo guardar la operación: no recargues ni cierres la página hasta resolverla.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon="refresh" disabled={busy || checking} onClick={pending.onRetry}>Reintentar registro</Button>
        <Button disabled={busy || checking} onClick={pending.onVerify}>Verificar si se registró</Button>
        {pending.check === "not-registered" && <Button variant="ghost" className="border border-brand-line" disabled={busy} onClick={pending.onDiscard}>Descartar intento</Button>}
      </div>
    </div>
  );
}

/** Éxito: se muestra solo cuando el servidor devolvió el comprobante (la venta ya está guardada). */
function SaleDone({ receipt, onNew }: { receipt: Receipt; onNew: () => void }) {
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
    <div className="space-y-4">
      <div role="status" className="flex flex-col items-center gap-2 pt-2 text-center print:hidden">
        <span className="sale-done-ring relative grid size-16 place-items-center rounded-full bg-brand-green text-white">
          <Icon name="cart" className="sale-done-cart absolute size-8" />
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path className="sale-done-check" d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="text-xl font-semibold text-brand-green-ink">{receipt.replayed ? "Esta venta ya estaba registrada" : "¡Venta concretada!"}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatPrice(receipt.total)}</p>
      </div>

      <div id="comprobante" className="space-y-3 rounded-xl border border-brand-line p-3">
        <div className="text-sm">
          {receiptHeader(BUSINESS).map((line, idx) => (
            <p key={line} className={idx === 0 ? "font-semibold" : "text-xs text-brand-muted"}>{line}</p>
          ))}
        </div>
        <p className="text-sm font-semibold">Comprobante #{receipt.number}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
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
        <p className="text-xs text-brand-muted">{RECEIPT_NOTICE}</p>
        {/* El stock restante es un dato interno: se ve en pantalla para quien vende, pero no se imprime en la copia del cliente. */}
        <p className="text-xs text-brand-muted print:hidden">
          {receipt.stockUpdated ? "Stock descontado: " : ""}
          {receipt.items.filter((i) => i.stockAfter !== null).map((i) => `${i.productName}: quedan ${i.stockAfter}`).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimir</Button>
        <Button icon="link" onClick={() => void share()}>Compartir</Button>
      </div>
      {shared && <p className="text-sm text-brand-muted print:hidden" aria-live="polite">{shared}</p>}
      <Button variant="primary" className="h-12 w-full print:hidden" onClick={onNew}>Nueva venta</Button>
    </div>
  );
}
