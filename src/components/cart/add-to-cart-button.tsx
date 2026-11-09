"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CatalogProduct } from "@/types/product";
import { getSupabase } from "@/lib/supabase/public";
import { variantLabel } from "@/lib/catalog/product";
import { useCart } from "./cart-provider";

type VariantRow = { id: string; size: string | null; color: string | null; price: number };

/** Texto del aviso según lo que pasó al agregar (compartido por la tarjeta y la ficha). */
export function addedMessage(status: "added" | "increased" | "capped" | "full", name: string, label?: string | null): string {
  if (status === "added") return `Agregado al pedido: ${name}${label ? ` (${label})` : ""}`;
  if (status === "increased") return `Otra unidad de ${name} en el pedido`;
  if (status === "capped") return "Llegaste al máximo de unidades para este producto.";
  return "El pedido ya tiene muchos productos distintos: consultalo y armá otro.";
}

/**
 * «Agregar» desde una tarjeta del catálogo. La tarjeta no conoce las variantes, así que se consultan al tocar:
 * con una sola (o ninguna cargada) se agrega directo; con varias hay que elegir, y se abre la ficha del producto.
 */
export function AddToCartButton({ product, path }: { product: CatalogProduct; path: string }) {
  const { add, notify } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function onClick() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const { data, error } = await getSupabase()
        .from("public_product_variants")
        .select("id,size,color,price,position")
        .eq("product_id", product.id)
        .order("position");
      const variants = error ? null : ((data ?? []) as VariantRow[]);
      if (variants && variants.length > 1) {
        notify("Elegí una opción en la ficha del producto.");
        router.push(path, { scroll: false });
        return;
      }
      const only = variants?.[0];
      const label = only ? variantLabel(only) : null;
      const status = add({
        productId: product.id,
        variantId: only?.id ?? null,
        name: product.name,
        variantLabel: label,
        unitPrice: only?.price ?? product.price,
        imageUrl: product.imageUrl,
        path,
      });
      notify(addedMessage(status, product.name, label));
    } catch {
      notify("No pudimos agregarlo. Probá de nuevo o abrí el producto.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      aria-label={`Agregar ${product.name} al pedido`}
      className="relative z-10 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-orange text-sm font-semibold text-brand-charcoal hover:bg-brand-orange/85 active:bg-brand-orange/75 disabled:opacity-60 motion-safe:transition-colors"
    >
      <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
      {busy ? "Agregando…" : "Agregar"}
    </button>
  );
}
