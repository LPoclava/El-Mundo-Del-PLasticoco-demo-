"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Section = "inicio" | "catalogo" | "promociones";

let initialHashHandled = false;

const LINK =
  "relative inline-flex h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-on-nav motion-safe:transition-colors lg:px-4";

/** Inicio, Catálogo y Promociones. Sin banners vigentes, Promociones no aparece (no habría a dónde ir). */
export function NavLinkList({ active, hasPromos, onSelect }: {
  active: Section | null;
  hasPromos: boolean;
  onSelect?: (section: Section) => void;
}) {
  const items: { id: Section; label: string; href: string }[] = [
    { id: "inicio", label: "Inicio", href: "/" },
    { id: "catalogo", label: "Catálogo", href: "/#catalogo" },
    ...(hasPromos ? [{ id: "promociones" as const, label: "Promociones", href: "/#promociones" }] : []),
  ];
  return (
    <ul className="flex items-center gap-0.5">
      {items.map((item) => {
        const current = active === item.id;
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={current ? "location" : undefined}
              onClick={() => onSelect?.(item.id)}
              className={`${LINK} ${current ? "bg-white/15 text-on-nav" : "text-on-nav-muted hover:bg-white/10 hover:text-on-nav"}`}
            >
              {item.label}
              {/* El estado activo no depende solo del color: lleva una marca debajo. */}
              {current && <span aria-hidden className="absolute bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-brand-orange" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Enlaces con la sección actual resaltada: Catálogo mientras esa sección ocupa el centro de la pantalla; Promociones
 * si se llegó con su enlace y el slider sigue a la vista; Inicio en el resto de la portada. Fuera de la portada,
 * ninguno.
 */
export function SiteNavLinks({ hasPromos }: { hasPromos: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [inCatalog, setInCatalog] = useState(false);
  const [promoSelected, setPromoSelected] = useState(false);

  // Enlace directo a una sección (/?categoria=cocina#catalogo): las partes de arriba llegan después por streaming y
  // desplazan la sección. Se ubica una sola vez, al terminar la carga; después ya no toca el scroll del usuario.
  useEffect(() => {
    if (initialHashHandled) return;
    initialHashHandled = true;
    const target = window.location.hash.slice(1);
    if (!target) return;
    const go = () => document.getElementById(target)?.scrollIntoView();
    if (document.readyState === "complete") {
      go();
      return;
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  useEffect(() => {
    if (!onHome || typeof IntersectionObserver === "undefined") return;
    const catalog = document.getElementById("catalogo");
    const promos = document.getElementById("promociones");
    const central = new IntersectionObserver(([entry]) => setInCatalog(entry.isIntersecting), { rootMargin: "-45% 0px -50% 0px" });
    if (catalog) central.observe(catalog);
    const banner = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPromoSelected(false);
    });
    if (promos) banner.observe(promos);
    return () => {
      central.disconnect();
      banner.disconnect();
    };
  }, [onHome]);

  const active: Section | null = !onHome ? null : inCatalog ? "catalogo" : promoSelected ? "promociones" : "inicio";

  return (
    <NavLinkList
      active={active}
      hasPromos={hasPromos}
      onSelect={(section) => {
        setPromoSelected(section === "promociones");
        // Ya en la portada, «Inicio» vuelve arriba aunque la dirección no cambie.
        if (section === "inicio" && onHome) window.scrollTo({ top: 0 });
      }}
    />
  );
}
