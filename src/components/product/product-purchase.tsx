"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import type { ProductVariant } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";
import { needsSelection, variantLabel } from "@/lib/catalog/product";
import { productInquiryHref } from "@/lib/contact";
import { ContactIcon } from "@/components/contact/contact-icon";

type Props = {
  name: string;
  path: string;
  variants: ProductVariant[];
  /** Precio general (el menor) y si hay precios distintos: se usan si no hay variantes cargadas. */
  price: number;
  hasPriceRange: boolean;
};

const noop = () => () => undefined;

/**
 * Precio, elección de variante y consulta por WhatsApp. Con más de una variante hay que elegir antes de
 * consultar, para que el mensaje diga exactamente qué producto y qué precio. Consultar solo ABRE el chat:
 * no es una venta ni se registra nada.
 */
export function ProductPurchase({ name, path, variants, price, hasPriceRange }: Props) {
  const mustChoose = needsSelection(variants);
  const [selectedId, setSelectedId] = useState<string | null>(mustChoose ? null : (variants[0]?.id ?? null));
  const [warn, setWarn] = useState(false);
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const legendId = useId();
  // La dirección completa del producto va en el mensaje; en el servidor no se conoce el dominio.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => null);

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const shownPrice = selected?.price ?? price;
  const fromPrice = !selected && (mustChoose ? new Set(variants.map((v) => v.price)).size > 1 : hasPriceRange);
  const label = selected ? variantLabel(selected) : null;

  const inquiry =
    mustChoose && !selected
      ? null
      : productInquiryHref({ name, price: formatPrice(shownPrice), fromPrice, variant: label, url: origin ? `${origin}${path}` : null });
  const whatsappAvailable = productInquiryHref({ name, price: "" }) !== null;

  return (
    <div className="space-y-5">
      <p className="text-3xl font-semibold tabular-nums tracking-tight" aria-live="polite">
        {fromPrice && <span className="mr-1.5 text-base font-normal text-brand-muted">Desde</span>}
        {formatPrice(shownPrice)}
        {label && <span className="sr-only"> para {label}</span>}
      </p>

      {mustChoose && (
        <fieldset ref={groupRef} aria-describedby={warn ? `${legendId}-warn` : undefined} tabIndex={-1} className="outline-none">
          <legend id={legendId} className="mb-2 text-sm font-medium">
            Elegí una opción <span className="font-normal text-brand-muted">({variants.length} disponibles)</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {variants.map((v) => {
              const checked = v.id === selectedId;
              return (
                <label
                  key={v.id}
                  className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 bg-surface px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink motion-safe:transition-colors ${
                    checked ? "border-brand-ink bg-brand-orange/10" : "border-brand-line hover:border-brand-ink/40"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <input
                      type="radio"
                      name="variante"
                      value={v.id}
                      checked={checked}
                      onChange={() => {
                        setSelectedId(v.id);
                        setWarn(false);
                      }}
                      className="size-4 shrink-0 accent-brand-orange"
                    />
                    <span className="font-medium">{variantLabel(v) ?? "Opción única"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-brand-muted">{formatPrice(v.price)}</span>
                </label>
              );
            })}
          </div>
          {warn && (
            <p id={`${legendId}-warn`} role="alert" className="mt-2 text-sm font-medium text-brand-danger">
              Elegí una opción para consultar por ese producto.
            </p>
          )}
        </fieldset>
      )}

      {!mustChoose && label && (
        <p className="text-sm">
          <span className="text-brand-muted">Opción: </span>
          <span className="font-medium">{label}</span>
        </p>
      )}

      {whatsappAvailable && (
        <div>
          {inquiry ? (
            <a
              href={inquiry}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-brand-green px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-green-ink active:scale-[0.99] motion-safe:transition sm:w-auto"
            >
              <ContactIcon id="whatsapp" className="size-5 shrink-0" />
              Consultar por WhatsApp
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                setWarn(true);
                groupRef.current?.focus();
              }}
              className="inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-brand-green/50 bg-surface px-5 py-3 text-base font-semibold text-brand-green-ink sm:w-auto"
            >
              <ContactIcon id="whatsapp" className="size-5 shrink-0" />
              Elegí una opción para consultar
            </button>
          )}
          <p className="mt-2 text-xs text-brand-muted">Se abre WhatsApp con el mensaje listo. Vos decidís si lo enviás.</p>
        </div>
      )}
    </div>
  );
}
