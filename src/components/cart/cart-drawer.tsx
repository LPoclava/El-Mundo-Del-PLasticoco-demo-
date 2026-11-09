"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ContactIcon } from "@/components/contact/contact-icon";
import { MAX_MESSAGE_LENGTH, MAX_QUANTITY, cartInquiryText, lineSubtotal } from "@/lib/cart/public-cart";
import { formatPrice } from "@/lib/catalog/url";
import { generalInquiryHref } from "@/lib/contact";
import { useCart } from "./cart-provider";

const noOrigin = () => (typeof window === "undefined" ? null : window.location.origin);

/**
 * Carrito lateral: entra desde la derecha (sin movimiento si el visitante pidió reducirlo), con el contenido de atrás
 * intacto. Usa <dialog> modal: foco atrapado, Escape cierra y el foco vuelve al botón que lo abrió. Termina SOLO en
 * WhatsApp (no hay pago ni venta): el mensaje se arma con los datos del carrito y el cliente decide si lo envía.
 */
export function CartDrawer() {
  const { cart, units, total, open, closeCart, setQuantity, remove, clear, notify } = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const [mounted, setMounted] = useState(open);
  const [confirmClear, setConfirmClear] = useState(false);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    window.clearTimeout(closeTimer.current);
    if (open) {
      if (!el.open) el.showModal();
      const frame = requestAnimationFrame(() => el.setAttribute("data-state", "open"));
      return () => cancelAnimationFrame(frame);
    }
    if (el.open) {
      el.setAttribute("data-state", "closed");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      closeTimer.current = window.setTimeout(() => {
        el.close();
        setMounted(false);
      }, reduced ? 0 : 200);
    }
    return () => window.clearTimeout(closeTimer.current);
  }, [open]);

  const text = useMemo(() => cartInquiryText(cart, open ? noOrigin() : null), [cart, open]);
  const href = cart.length > 0 ? generalInquiryHref(text) : null;
  const tooBig = text.length > MAX_MESSAGE_LENGTH;
  const whatsappConfigured = generalInquiryHref("x") !== null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-state="closed"
      onCancel={(e) => {
        e.preventDefault();
        closeCart();
      }}
      onClick={(e) => {
        if (e.target === ref.current) closeCart();
      }}
      className="drawer m-0 ml-auto h-dvh max-h-none w-[min(26rem,92vw)] max-w-none border-0 bg-brand-card p-0 text-brand-ink shadow-xl"
    >
      {(open || mounted) && (
        <div className="flex h-full flex-col">
          <header className="relative flex shrink-0 items-center gap-3 border-b-2 border-dashed border-brand-line px-4 py-3">
            <span aria-hidden className="absolute inset-x-0 top-0 flex h-1"><span className="flex-1 bg-brand-orange" /><span className="w-1/4 bg-brand-green" /></span>
            <div className="min-w-0 flex-1">
              <p aria-hidden className="text-[0.6875rem] font-medium tabular-nums tracking-[0.12em] text-brand-muted">MP / PEDIDO</p>
              <h2 id={titleId} className="truncate font-display text-lg font-extrabold leading-tight">
                Tu pedido
                {units > 0 && <span className="ml-2 font-sans text-sm font-normal text-brand-muted">{units} {units === 1 ? "unidad" : "unidades"}</span>}
              </h2>
            </div>
            <button type="button" onClick={closeCart} aria-label="Cerrar el carrito" className="-mr-1 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-brand-sand">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {cart.length === 0 ? (
              <div className="grid h-full place-content-center gap-3 text-center">
                <p className="font-display text-lg font-extrabold">Todavía no agregaste nada</p>
                <p className="text-sm text-brand-muted text-pretty">Elegí productos del catálogo y armá tu pedido: después lo consultás por WhatsApp.</p>
                <Link
                  href="/#catalogo"
                  onClick={closeCart}
                  className="mx-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-brand-charcoal hover:bg-brand-orange/85"
                >
                  Ver el catálogo
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-brand-line">
                {cart.map((l) => (
                  <li key={l.key} className="cart-line-in flex gap-3 py-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-brand-photo">
                      {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="64px" className="object-contain p-1" unoptimized={l.imageUrl.endsWith(".svg")} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={l.path} onClick={closeCart} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">{l.name}</Link>
                      {l.variantLabel && <p className="text-xs text-brand-muted">{l.variantLabel}</p>}
                      <p className="mt-0.5 text-xs tabular-nums text-brand-muted">{formatPrice(l.unitPrice)} c/u</p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div role="group" aria-label={`Cantidad de ${l.name}`} className="inline-flex items-center rounded-lg border border-brand-line">
                          <button type="button" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label={l.quantity === 1 ? `Quitar ${l.name}` : `Una unidad menos de ${l.name}`} className="grid size-11 place-items-center rounded-l-lg hover:bg-brand-sand">
                            <span aria-hidden className="text-lg leading-none">−</span>
                          </button>
                          <span key={l.quantity} className="qty-pop min-w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{l.quantity}</span>
                          <button type="button" onClick={() => setQuantity(l.key, l.quantity + 1)} disabled={l.quantity >= MAX_QUANTITY} aria-label={`Una unidad más de ${l.name}`} className="grid size-11 place-items-center rounded-r-lg hover:bg-brand-sand disabled:opacity-40">
                            <span aria-hidden className="text-lg leading-none">+</span>
                          </button>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">{formatPrice(lineSubtotal(l))}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(l.key)} aria-label={`Quitar ${l.name} del pedido`} className="-mr-1 grid size-11 shrink-0 place-items-center self-start rounded-lg text-brand-muted hover:bg-brand-sand hover:text-brand-ink">
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {cart.length > 0 && (
            <footer className="shrink-0 bg-brand-card pb-4 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.25)] [--perf-bg:var(--color-brand-card)]">
              <div className="perforation" aria-hidden />
              <div className="space-y-3 px-4 pt-3">
              <p className="flex items-baseline justify-between text-lg font-semibold tabular-nums">
                <span className="font-display font-extrabold">Total estimado</span>
                <span>{formatPrice(total)}</span>
              </p>
              <p className="text-xs text-brand-muted text-pretty">
                No es una compra: el pedido se consulta por WhatsApp y el comercio confirma disponibilidad, precio final y entrega o retiro.
              </p>
              {tooBig && <p role="alert" className="text-sm font-medium text-brand-danger">El pedido es muy largo para un solo mensaje. Quitá algunos productos o consultalos en dos pedidos.</p>}
              {whatsappConfigured && href && !tooBig ? (
                <a
                  href={href}
                  onClick={() => notify("Se abrió WhatsApp con tu pedido. Sigue acá hasta que lo vacíes.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-whatsapp px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-whatsapp-hover active:bg-whatsapp-active motion-safe:transition"
                >
                  <ContactIcon id="whatsapp" className="size-5 shrink-0" />
                  Consultar pedido por WhatsApp
                </a>
              ) : (
                <p className="text-sm text-brand-muted">{whatsappConfigured ? "" : "La consulta por WhatsApp no está disponible por ahora."}</p>
              )}
              {confirmClear ? (
                <div role="alertdialog" aria-label="Confirmar vaciado" className="flex items-center justify-between gap-2 rounded-lg border border-brand-danger/40 p-2 text-sm">
                  <span>¿Vaciar el pedido?</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => setConfirmClear(false)} className="min-h-11 rounded-lg px-3 hover:bg-brand-sand">No</button>
                    <button type="button" onClick={() => { clear(); setConfirmClear(false); }} className="min-h-11 rounded-lg bg-brand-danger px-3 font-semibold text-white">Sí, vaciar</button>
                  </span>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 w-full rounded-lg text-sm text-brand-muted hover:bg-brand-sand hover:text-brand-ink">Vaciar pedido</button>
              )}
              </div>
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
