"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import type { IconName } from "@/lib/panel-demo/roles";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto corto a la derecha del título (por ejemplo, la cantidad de unidades). */
  meta?: string;
  icon?: IconName;
  /** Parte fija inferior (siempre visible; el contenido de arriba es el que se desplaza). */
  footer?: ReactNode;
  /** Mientras es true no se puede cerrar (por ejemplo, mientras se registra una venta). */
  locked?: boolean;
  children: ReactNode;
};

/**
 * Panel lateral que entra desde la derecha, sin reemplazar la pantalla de atrás: en celular ocupa ~90 % del
 * ancho (queda una franja del escáner a la izquierda) y desde tablet ~45 %. Usa <dialog> modal: el foco queda
 * atrapado adentro, lo de atrás no responde, Escape cierra, y al cerrar el foco vuelve al botón que lo abrió.
 * La pantalla de atrás sigue montada y conserva su estado. Con «reducir movimiento» no hay desplazamiento.
 */
export function Drawer({ open, onClose, title, meta, icon, footer, locked = false, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  // El contenido sigue dibujado mientras dura la animación de salida (si no, el panel se vaciaría antes de irse).
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  // Abrir: showModal() y, en el cuadro siguiente, el estado «open» (así el CSS anima desde afuera de la pantalla).
  // Cerrar: el estado «closed» anima la salida y recién después se cierra el <dialog>.
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

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-state="closed"
      // Escape: se pasa por nuestro cierre animado (y se respeta el bloqueo).
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      // Un clic en el fondo (el propio <dialog>, fuera del panel) cierra.
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="drawer m-0 ml-auto h-dvh max-h-none w-[90vw] max-w-none border-0 bg-white p-0 text-brand-ink shadow-xl md:w-[45vw] md:min-w-[26rem]"
    >
      {(open || mounted) && (
        <div className="flex h-full flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-brand-line px-4 py-3">
            {icon && (
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-orange/15 text-brand-orange-ink">
                <Icon name={icon} className="size-5" />
              </span>
            )}
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold">
              {title}
              {meta && <span className="ml-2 text-sm font-normal text-brand-muted">{meta}</span>}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              aria-label={`Cerrar ${title.toLowerCase()}`}
              className="-mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-brand-ink hover:bg-brand-sand disabled:opacity-40"
            >
              <Icon name="x" />
            </button>
          </header>
          {/* Solo esta zona se desplaza: el encabezado y el pie quedan fijos. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
          {footer && <div className="shrink-0 border-t border-brand-line bg-white px-4 pb-4 pt-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.25)]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
