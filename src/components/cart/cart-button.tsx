"use client";

import { useCart } from "./cart-provider";

/** Botón del carrito en la navegación: muestra la cantidad de unidades y abre el carrito lateral. */
export function CartButton() {
  const { units, ready, openCart } = useCart();
  const label = ready && units > 0 ? `Abrir el pedido: ${units} ${units === 1 ? "unidad" : "unidades"}` : "Abrir el pedido (vacío)";
  return (
    <button
      type="button"
      onClick={openCart}
      aria-haspopup="dialog"
      aria-label={label}
      className="relative grid size-11 shrink-0 place-items-center rounded-full text-on-nav hover:bg-white/10 focus-visible:outline-on-nav motion-safe:transition-colors"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.95-1.5L21 8H6.2" />
        <circle cx="10" cy="20" r="1.2" />
        <circle cx="17" cy="20" r="1.2" />
      </svg>
      {ready && units > 0 && (
        <span key={units} aria-hidden className="cart-bump absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand-orange px-1 text-[0.7rem] font-bold leading-5 tabular-nums text-brand-charcoal">
          {units > 99 ? "99+" : units}
        </span>
      )}
    </button>
  );
}
