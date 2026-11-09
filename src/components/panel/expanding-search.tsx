"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Buscador que se despliega: un botón con la lupa que se abre hacia un campo (con foco automático) y se cierra con
 * Escape o con el botón de cerrar. Si hay texto, queda abierto. «Limpiar» borra lo escrito sin cerrar. La animación es
 * solo de ancho y no retrasa nada: el campo ya recibe foco al empezar a abrirse. Con «reducir movimiento» no hay transición.
 * Debajo se muestran los resultados rápidos (children) y el estado de la búsqueda, anunciado a lectores de pantalla.
 */
export function ExpandingSearch({ value, onChange, label, placeholder, status, children }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string;
  /** Texto breve del resultado («12 productos», «Sin resultados…»), anunciado al cambiar. */
  status?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState(value.length > 0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const id = useId();
  const expanded = open || value.length > 0;

  // Foco automático al abrir (sin esperar a que termine la animación).
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function close() {
    onChange("");
    setOpen(false);
    opener.current?.focus();
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {!expanded && (
          <button
            ref={opener}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            aria-controls={id}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3.5 text-sm font-medium hover:border-brand-ink"
          >
            <Icon name="search" className="size-4" />
            Buscar
          </button>
        )}
        <div
          role="search"
          className={`relative overflow-hidden ${expanded ? "w-full max-w-xl opacity-100" : "w-0 opacity-0"} motion-safe:transition-[width,opacity] motion-safe:duration-200 motion-safe:ease-out`}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <label htmlFor={id} className="sr-only">{label}</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-3.5 size-4 text-brand-muted" />
          <input
            id={id}
            ref={input}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-brand-line bg-white pl-9 pr-24 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:border-brand-ink [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute right-1 top-0 flex h-11 items-center">
            {value && (
              <button type="button" onClick={() => { onChange(""); input.current?.focus(); }} className="grid h-11 min-w-11 place-items-center rounded-lg px-2 text-xs font-medium underline underline-offset-4 hover:bg-brand-sand">
                Limpiar
              </button>
            )}
            <button type="button" onClick={close} aria-label="Cerrar la búsqueda" className="grid size-11 place-items-center rounded-lg hover:bg-brand-sand">
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          {children}
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-brand-muted">{status}</p>
        </div>
      )}
    </div>
  );
}
