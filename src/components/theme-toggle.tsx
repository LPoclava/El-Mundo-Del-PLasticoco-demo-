"use client";

import { useSyncExternalStore } from "react";

const KEY = "mp-theme";
type Theme = "light" | "dark";

/** Misma pestaña: el evento propio avisa del cambio. Otras pestañas: el evento «storage». */
function subscribe(callback: () => void) {
  window.addEventListener("mp-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("mp-theme", callback);
    window.removeEventListener("storage", callback);
  };
}
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/**
 * Botón sol / luna del encabezado. El tema se guarda en localStorage y se aplica en <html data-theme> sin recargar.
 * El script de src/app/layout.tsx ya lo puso antes de pintar (así no hay destello del tema equivocado).
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    const root = document.documentElement;
    // Fundido breve de colores (se desactiva con «reducir movimiento»); la clase se quita enseguida.
    root.classList.add("theme-changing");
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sin almacenamiento (modo privado estricto): el cambio vale para esta visita.
    }
    window.dispatchEvent(new Event("mp-theme"));
    window.setTimeout(() => root.classList.remove("theme-changing"), 250);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={dark ? "Tema claro" : "Tema oscuro"}
      className="relative grid size-11 shrink-0 place-items-center rounded-lg border border-brand-line bg-surface text-brand-ink hover:border-brand-ink motion-safe:transition-colors"
    >
      {/* Los dos íconos se superponen: el que sobra gira y se desvanece (sutil, sin mover el diseño). */}
      <svg viewBox="0 0 24 24" className={`absolute size-5 motion-safe:transition motion-safe:duration-300 ${dark ? "scale-50 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
      <svg viewBox="0 0 24 24" className={`absolute size-5 motion-safe:transition motion-safe:duration-300 ${dark ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0"}`} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
    </button>
  );
}
