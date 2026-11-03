"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ventana flotante del producto (se muestra por una ruta interceptada: la dirección cambia a /producto/..., el
 * catálogo queda detrás y conserva su posición). Es un <dialog> modal: foco atrapado, lo de atrás no responde,
 * Escape y el clic afuera cierran, y el botón X siempre está a la vista. Cerrar vuelve atrás en el historial
 * (router.back), así el botón «atrás» del navegador también la cierra. Fondo desenfocado y oscurecido.
 */
export function ProductModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.showModal();
    // El estado «open» se pone en el cuadro siguiente para que la entrada se anime desde afuera.
    const frame = requestAnimationFrame(() => el.setAttribute("data-state", "open"));
    return () => cancelAnimationFrame(frame);
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
      aria-label="Detalle del producto"
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
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar la ventana del producto"
          className="sticky top-2 z-10 float-right mr-2 mt-2 grid size-11 place-items-center rounded-full border border-brand-line bg-surface/90 text-brand-ink shadow-sm backdrop-blur-sm hover:bg-surface"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  );
}
