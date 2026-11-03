"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { MODAL_TITLE_ID } from "@/lib/catalog/product";

/**
 * Devuelve el foco al cerrar: al elemento que abrió la ventana o, si ya no está (el catálogo cambió, o el navegador no
 * le dio foco al hacer clic), a la tarjeta de ese producto; como último recurso, al catálogo.
 */
function restoreFocus(opener: HTMLElement | null, path: string) {
  if (opener?.isConnected) {
    opener.focus({ preventScroll: true });
    if (document.activeElement === opener) return;
  }
  const card = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/producto/']")).find((a) => a.getAttribute("href") === path);
  if (card) {
    card.focus({ preventScroll: true });
    if (document.activeElement === card) return;
  }
  const catalog = document.getElementById("catalogo");
  if (catalog) {
    catalog.setAttribute("tabindex", "-1");
    catalog.focus({ preventScroll: true });
  }
}

/**
 * Ventana flotante del producto (se muestra por una ruta interceptada: la dirección cambia a /producto/..., el
 * catálogo queda detrás y conserva su posición). Es un <dialog> modal: foco atrapado, lo de atrás no responde,
 * Escape y el clic afuera cierran, y el botón X siempre está a la vista. Cerrar vuelve atrás en el historial
 * (router.back), así el botón «atrás» del navegador también la cierra, y devuelve el foco a quien la abrió.
 */
export function ProductModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const restoreTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Next conserva la ruta oculta al volver atrás: este efecto corre de nuevo cada vez que se reabre la ventana.
    window.clearTimeout(restoreTimer.current);
    closing.current = false;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !el.contains(active)) opener.current = active;
    const path = window.location.pathname;
    if (!el.open) el.showModal();
    // El estado «open» se pone en el cuadro siguiente para que la entrada se anime desde afuera.
    const frame = requestAnimationFrame(() => el.setAttribute("data-state", "open"));
    return () => {
      cancelAnimationFrame(frame);
      el.setAttribute("data-state", "closed");
      if (el.open) el.close();
      // Después de que Next oculte la ruta: mientras tanto el elemento todavía puede no recibir foco.
      restoreTimer.current = window.setTimeout(() => {
        restoreFocus(opener.current, path);
        opener.current = null;
      }, 0);
    };
  }, []);

  function close() {
    if (closing.current) return;
    closing.current = true;
    ref.current?.setAttribute("data-state", "closed");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.back(), reduced ? 0 : 180);
  }

  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Detalle del producto"
      aria-labelledby={MODAL_TITLE_ID}
      data-state="closed"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      className="product-modal m-auto max-h-[calc(100dvh-1.5rem)] w-[min(62rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-2xl border border-brand-line bg-surface p-0 text-brand-ink"
    >
      <div className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain">
        {/* Sin alto propio: siempre a la vista al desplazarse, pero no le quita ancho al contenido. */}
        <div className="sticky top-0 z-10 flex h-0 justify-end">
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar la ventana del producto"
            className="mr-2 mt-2 grid size-11 shrink-0 place-items-center rounded-full border border-brand-line bg-surface/90 text-brand-ink shadow-sm backdrop-blur-sm hover:bg-surface"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
