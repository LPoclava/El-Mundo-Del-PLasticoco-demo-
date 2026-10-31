"use client";

import { useLinkStatus } from "next/link";

/**
 * Respuesta al toque mientras se abre una categoría o filtro. Aparece a los 120 ms (si la navegación es
 * instantánea no se ve) y sin movimiento con «reducir movimiento». Debe ir DENTRO de un <Link> con posición
 * relativa.
 * - overlay: velo claro con indicador (tarjetas de categoría);
 * - bar: línea bajo el texto (pestañas de subcategorías).
 */
export function LinkPending({ variant = "overlay" }: { variant?: "overlay" | "bar" }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  if (variant === "bar") {
    return <span aria-hidden className="link-pending pointer-events-none absolute inset-x-3 bottom-0 h-0.5 bg-brand-ink/40 motion-safe:animate-pulse" />;
  }
  return (
    <span aria-hidden className="link-pending pointer-events-none absolute inset-0 grid place-items-center bg-white/45">
      <span className="size-7 rounded-full border-[3px] border-brand-ink/20 border-t-brand-ink motion-safe:animate-spin" />
    </span>
  );
}
