"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * El buscador dentro de la navegación. Desde escritorio se ve siempre en la cápsula; en pantallas chicas se abre con la
 * lupa en un renglón debajo, para que esté a mano en todo el recorrido sin angostar la barra. Escape lo cierra.
 */
export function SiteNavSearch({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.querySelector("input")?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="buscador-navegacion"
        aria-label={open ? "Cerrar el buscador" : "Abrir el buscador"}
        className="grid size-11 shrink-0 place-items-center rounded-full text-on-nav hover:bg-white/10 focus-visible:outline-on-nav active:bg-white/20 motion-safe:transition-colors lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>}
        </svg>
      </button>
      <div
        ref={panel}
        id="buscador-navegacion"
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            setOpen(false);
            button.current?.focus();
          }
        }}
        className={`${open ? "block" : "hidden"} absolute inset-x-0 top-full mt-2 rounded-full shadow-lg lg:static lg:mt-0 lg:block lg:w-64 lg:shadow-none xl:w-80`}
      >
        {children}
      </div>
    </>
  );
}
