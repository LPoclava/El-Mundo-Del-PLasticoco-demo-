"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Oculta su contenido en pantallas chicas mientras el catálogo está a la vista (la sección existe desde el primer render). */
export function WhatsAppFloatGuard({ children }: { children: ReactNode }) {
  const [overGrid, setOverGrid] = useState(false);

  useEffect(() => {
    const grid = document.getElementById("catalogo");
    if (!grid || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOverGrid(entry.isIntersecting), { rootMargin: "-10% 0px -10% 0px" });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div data-away={overGrid || undefined}>
      {children}
    </div>
  );
}
