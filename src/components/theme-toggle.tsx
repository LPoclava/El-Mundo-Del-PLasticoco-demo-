"use client";

import { useEffect, useSyncExternalStore } from "react";

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

function apply(next: Theme) {
  document.documentElement.dataset.theme = next;
  window.dispatchEvent(new Event("mp-theme"));
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Interruptor sol / luna de la navegación. El tema se guarda en localStorage y se aplica en <html data-theme> sin
 * recargar; el script de src/app/layout.tsx ya lo puso antes de pintar (no hay destello del tema equivocado). Sin
 * preferencia guardada sigue al sistema operativo. El tema nuevo se despliega en círculo desde el propio botón (View
 * Transitions); sin soporte o con «reducir movimiento», el cambio es inmediato.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const dark = theme === "dark";

  // Sin elección propia, acompaña los cambios del sistema operativo.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (storedTheme() !== "light" && storedTheme() !== "dark") apply(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = dark ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sin almacenamiento (modo privado estricto): el cambio vale para esta visita.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) {
      apply(next);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => apply(next));
    transition.ready
      .then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {
        // La transición se saltea si la pestaña está oculta: el tema ya quedó aplicado.
      });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      aria-label="Tema oscuro"
      title={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="group grid h-11 shrink-0 place-items-center rounded-full px-1 focus-visible:outline-on-nav"
    >
      <span className="relative block h-8 w-[3.75rem] rounded-full bg-white/15 ring-1 ring-white/20 motion-safe:transition-colors group-hover:bg-white/25">
        <span
          aria-hidden
          className={`absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-brand-orange text-brand-charcoal shadow-sm motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${dark ? "translate-x-[1.75rem]" : "translate-x-0"}`}
        >
          <svg viewBox="0 0 24 24" className={`absolute size-4 motion-safe:transition motion-safe:duration-300 ${dark ? "scale-50 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </svg>
          <svg viewBox="0 0 24 24" className={`absolute size-4 motion-safe:transition motion-safe:duration-300 ${dark ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0"}`} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
