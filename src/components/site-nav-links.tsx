"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Section = "inicio" | "catalogo" | "promociones" | "contacto";

let initialHashHandled = false;

const LINK =
  "relative inline-flex h-11 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-on-nav motion-safe:transition-colors active:bg-white/20";

/** Inicio, Catálogo, Promociones y Contacto. Sin banners vigentes, Promociones no aparece (no habría a dónde ir). */
export function NavLinkList({ active, hasPromos, onSelect }: {
  active: Section | null;
  hasPromos: boolean;
  onSelect?: (section: Section) => void;
}) {
  const items: { id: Section; label: string; href: string }[] = [
    { id: "inicio", label: "Inicio", href: "/" },
    { id: "catalogo", label: "Catálogo", href: "/#catalogo" },
    ...(hasPromos ? [{ id: "promociones" as const, label: "Promociones", href: "/#promociones" }] : []),
    { id: "contacto", label: "Contacto", href: "#contacto" },
  ];
  return (
    <ul className="flex items-center">
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
 * Enlaces con la sección actual resaltada, según lo que ocupa el centro de la pantalla: Contacto con el pie a la vista,
 * Catálogo en esa sección, Promociones si se llegó con su enlace y Inicio mientras se recorre la parte de arriba. En la
 * franja de beneficios y fuera de la portada no se marca ninguno (salvo Contacto, porque el pie está en todas).
 */
export function SiteNavLinks({ hasPromos }: { hasPromos: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [inHero, setInHero] = useState(true);
  const [inCatalog, setInCatalog] = useState(false);
  const [inFooter, setInFooter] = useState(false);
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
    if (typeof IntersectionObserver === "undefined") return;
    const band = { rootMargin: "-45% 0px -50% 0px" };
    const watch = (id: string, onChange: (visible: boolean) => void, options?: IntersectionObserverInit) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const observer = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), options);
      observer.observe(el);
      return observer;
    };
    const observers = [
      watch("inicio", (visible) => {
        setInHero(visible);
        if (!visible) setPromoSelected(false);
      }, band),
      watch("catalogo", setInCatalog, band),
      watch("contacto", setInFooter, { threshold: 0.2 }),
    ];
    return () => observers.forEach((o) => o?.disconnect());
  }, [onHome]);

  const active: Section | null = inFooter
    ? "contacto"
    : !onHome
      ? null
      : inCatalog
        ? "catalogo"
        : promoSelected && inHero
          ? "promociones"
          : inHero
            ? "inicio"
            : null;

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
