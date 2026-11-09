"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ProductVariant } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";
import { needsSelection, variantLabel } from "@/lib/catalog/product";
import { MAX_QUANTITY } from "@/lib/cart/public-cart";
import { productInquiryHref } from "@/lib/contact";
import { addedMessage } from "@/components/cart/add-to-cart-button";
import { useCart } from "@/components/cart/cart-provider";
import { ContactIcon } from "@/components/contact/contact-icon";

type Props = {
  /** Para el carrito: identifica el producto y muestra su foto. */
  productId: string;
  imageUrl: string | null;
  name: string;
  path: string;
  variants: ProductVariant[];
  /** Precio general (el menor) y si hay precios distintos: se usan si no hay variantes cargadas. */
  price: number;
  hasPriceRange: boolean;
};

const noop = () => () => undefined;

/**
 * Bloque de compra con forma de boleto: arriba el precio (y la opción elegida), una línea de corte y abajo la elección
 * de la variante, la cantidad, «Agregar al pedido» y la consulta por WhatsApp. Con más de una variante hay que elegir
 * antes de agregar o consultar, para que el pedido y el mensaje digan exactamente qué producto y qué precio. Agregar
 * al pedido y consultar solo ARMAN o ABREN un mensaje: no es una venta ni se registra nada.
 */
export function ProductPurchase({ productId, imageUrl, name, path, variants, price, hasPriceRange }: Props) {
  const { add, notify, openCart, units } = useCart();
  const mustChoose = needsSelection(variants);
  const [selectedId, setSelectedId] = useState<string | null>(mustChoose ? null : (variants[0]?.id ?? null));
  const [warn, setWarn] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const addedTimer = useRef<number | undefined>(undefined);
  const legendId = useId();
  // La dirección completa del producto va en el mensaje; en el servidor no se conoce el dominio.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => null);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const shownPrice = selected?.price ?? price;
  const prices = new Set(variants.map((v) => v.price));
  const fromPrice = !selected && (mustChoose ? prices.size > 1 : hasPriceRange);
  const label = selected ? variantLabel(selected) : null;
  const pricesDiffer = prices.size > 1;

  const inquiry =
    mustChoose && !selected
      ? null
      : productInquiryHref({ name, price: formatPrice(shownPrice), fromPrice, variant: label, url: origin ? `${origin}${path}` : null });
  const whatsappAvailable = productInquiryHref({ name, price: "" }) !== null;

  function requireChoice() {
    setWarn(true);
    groupRef.current?.focus();
  }

  function addToCart() {
    if (mustChoose && !selected) return requireChoice();
    const status = add({ productId, variantId: selected?.id ?? null, name, variantLabel: label, unitPrice: shownPrice, imageUrl, path }, quantity);
    notify(addedMessage(status, name, label));
    if (status === "added" || status === "increased") {
      window.clearTimeout(addedTimer.current);
      setAdded(true);
      addedTimer.current = window.setTimeout(() => setAdded(false), 1800);
    }
  }

  return (
    <section aria-label="Precio y compra" className="purchase-ticket relative overflow-hidden rounded-2xl border border-brand-green/25 bg-brand-card shadow-sm [--perf-bg:var(--purchase-bg,var(--color-brand-cream))]">
      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
        <p className="flex flex-wrap items-baseline gap-x-2 font-display text-[2.125rem] font-extrabold leading-none tabular-nums text-brand-orange-ink sm:text-[2.5rem]" aria-live="polite">
          {fromPrice && <span className="font-sans text-sm font-normal text-brand-muted">Desde</span>}
          <span>{formatPrice(shownPrice)}</span>
          {label && <span className="sr-only"> para {label}</span>}
        </p>
        <p className="mt-1.5 min-h-5 text-sm text-brand-muted">
          {selected
            ? <>Elegiste: <span className="font-medium text-brand-ink">{label ?? "opción única"}</span></>
            : mustChoose
              ? "Elegí una opción para ver su precio exacto."
              : label
                ? <>Opción: <span className="font-medium text-brand-ink">{label}</span></>
                : "Precio publicado en el sitio."}
        </p>
      </div>

      <div className="perforation" aria-hidden />

      <div className="space-y-4 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        {mustChoose && (
          <fieldset ref={groupRef} aria-describedby={warn ? `${legendId}-warn` : undefined} tabIndex={-1} className="min-w-0 outline-none">
            <legend id={legendId} className="mb-2 text-sm font-semibold">
              Elegí una opción <span className="font-normal text-brand-muted">({variants.length} disponibles)</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
              {variants.map((v) => {
                const checked = v.id === selectedId;
                return (
                  <label
                    key={v.id}
                    data-checked={checked}
                    className={`variant-chip relative flex min-h-12 min-w-0 cursor-pointer flex-col justify-center rounded-xl border-2 px-3 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink motion-safe:transition-[border-color,background-color,transform] motion-safe:duration-150 motion-safe:active:scale-[0.98] ${
                      checked ? "border-brand-orange bg-brand-orange/10" : "border-brand-line bg-surface hover:border-brand-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`variante-${productId}`}
                      value={v.id}
                      checked={checked}
                      onChange={() => {
                        setSelectedId(v.id);
                        setWarn(false);
                      }}
                      className="sr-only"
                    />
                    <span className="break-words pr-5 font-semibold leading-tight">{variantLabel(v) ?? "Opción única"}</span>
                    {pricesDiffer && <span className="text-xs tabular-nums text-brand-muted">{formatPrice(v.price)}</span>}
                    {checked && (
                      <svg viewBox="0 0 24 24" className="variant-check absolute right-2 top-2 size-4 text-brand-orange-ink" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </label>
                );
              })}
            </div>
            {warn && (
              <p id={`${legendId}-warn`} role="alert" className="mt-2 text-sm font-medium text-brand-danger">
                Elegí una opción para continuar.
              </p>
            )}
          </fieldset>
        )}

        <div className="flex items-stretch gap-2">
          <div role="group" aria-label="Cantidad" className="inline-flex shrink-0 items-center rounded-xl border-2 border-brand-line bg-surface">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Una unidad menos" className="grid size-11 place-items-center rounded-l-xl text-lg hover:bg-brand-sand disabled:opacity-40">
              <span aria-hidden>−</span>
            </button>
            <span key={quantity} className="qty-pop min-w-8 text-center text-base font-semibold tabular-nums" aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} aria-label="Una unidad más" className="grid size-11 place-items-center rounded-r-xl text-lg hover:bg-brand-sand disabled:opacity-40">
              <span aria-hidden>+</span>
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            key={added ? "added" : "idle"}
            className={`inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-semibold shadow-sm motion-safe:transition-colors active:scale-[0.99] ${
              added ? "added-pop bg-brand-green text-white" : "bg-brand-orange text-brand-charcoal hover:bg-brand-orange/85"
            }`}
          >
            {added ? (
              <>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                Agregado al pedido
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
                Agregar al pedido
              </>
            )}
          </button>
        </div>

        {units > 0 && (
          <button type="button" onClick={openCart} className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-brand-line text-sm font-semibold hover:border-brand-ink/40 motion-safe:transition-colors">
            Ver mi pedido <span className="tabular-nums text-brand-muted">({units} {units === 1 ? "unidad" : "unidades"})</span>
          </button>
        )}

        {whatsappAvailable && (
          <div>
            {inquiry ? (
              <a
                href={inquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-whatsapp px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-whatsapp-hover active:bg-whatsapp-active active:scale-[0.99] motion-safe:transition"
              >
                <ContactIcon id="whatsapp" className="size-5 shrink-0" />
                Consultar solo este producto
              </a>
            ) : (
              <button
                type="button"
                onClick={requireChoice}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-brand-green/50 bg-surface px-5 py-2.5 text-base font-semibold text-brand-green-ink"
              >
                <ContactIcon id="whatsapp" className="size-5 shrink-0" />
                Elegí una opción para consultar
              </button>
            )}
            <p className="mt-2 text-xs text-brand-muted text-pretty">
              Armás tu pedido y lo consultás por WhatsApp: se abre el chat con el mensaje listo y vos decidís si lo enviás.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
