"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Le pone un fin al movimiento del globo: el avión da una vuelta cuando el globo aparece en pantalla y se queda quieto, y
 * da otra si se le pasa el cursor por encima. Fuera de pantalla no corre nada. Sin JavaScript sigue dando vueltas.
 */
export function GlobeMotion({ lapMs, children }: { lapMs: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const stop = () => {
      window.clearTimeout(timer);
      timer = undefined;
      svg.pauseAnimations();
      svg.setAttribute("data-still", "");
    };
    const fly = () => {
      if (timer !== undefined) return;
      svg.unpauseAnimations();
      svg.removeAttribute("data-still");
      timer = window.setTimeout(stop, lapMs);
    };
    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? fly() : stop()));
    observer.observe(svg);
    svg.addEventListener("pointerenter", fly);
    return () => {
      observer.disconnect();
      svg.removeEventListener("pointerenter", fly);
      window.clearTimeout(timer);
    };
  }, [lapMs]);

  return <span ref={ref} className="contents">{children}</span>;
}
