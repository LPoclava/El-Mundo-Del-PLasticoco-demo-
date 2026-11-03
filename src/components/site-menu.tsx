"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ContactIcon } from "@/components/contact/contact-icon";
import { CategoryIcon } from "@/components/catalog/category-icon";
import { CHANNEL_TILE, type ContactChannel } from "@/lib/contact";

export type MenuCategory = { slug: string; name: string; href: string };

const ITEM =
  "flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 text-[0.95rem] font-medium hover:bg-brand-sand active:bg-brand-sand motion-safe:transition-colors";

/**
 * Menú lateral: categorías y contacto (en celular, también los enlaces de la barra). Es un <dialog> modal: foco
 * atrapado, Escape y el clic afuera cierran, y al cerrar el foco vuelve al botón. Elegir una opción lo cierra.
 */
export function SiteMenu({ categories, channels, mapsHref, address, globe, sections }: {
  categories: MenuCategory[];
  channels: ContactChannel[];
  mapsHref: string | null;
  address: string | null;
  /** Globo animado (viene dibujado desde el servidor). */
  globe: ReactNode;
  /** Enlaces de la barra, solo visibles en celular. */
  sections: { label: string; href: string }[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      const frame = requestAnimationFrame(() => el.setAttribute("data-state", "open"));
      return () => cancelAnimationFrame(frame);
    }
    if (el.open) {
      el.setAttribute("data-state", "closed");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const timer = window.setTimeout(() => el.close(), reduced ? 0 : 200);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir el menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid size-11 shrink-0 place-items-center rounded-full text-on-nav hover:bg-white/10 focus-visible:outline-on-nav motion-safe:transition-colors"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>

      <dialog
        ref={ref}
        aria-label="Menú"
        data-state="closed"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="site-menu m-0 h-dvh max-h-none w-[min(23rem,88vw)] max-w-none rounded-r-3xl border-0 bg-surface p-0 text-brand-ink shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
            <p className="text-lg font-semibold tracking-tight">Menú</p>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar el menú"
              className="-mr-1.5 grid size-11 place-items-center rounded-full hover:bg-brand-sand motion-safe:transition-colors"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 pb-6">
            <nav aria-label="Secciones" className="md:hidden">
              <ul>
                {sections.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} onClick={close} className={ITEM}>{s.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            {categories.length > 0 && (
              <nav aria-labelledby="menu-categorias">
                <h2 id="menu-categorias" className="px-2 pb-1 text-sm font-semibold text-brand-muted">Categorías de productos</h2>
                <ul>
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={c.href} onClick={close} className={ITEM}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tint-green text-brand-green-ink">
                          <CategoryIcon slug={c.slug} className="size-5" />
                        </span>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <section aria-labelledby="menu-contacto">
              <h2 id="menu-contacto" className="px-2 pb-1 text-sm font-semibold text-brand-muted">Contacto</h2>
              <ul>
                {channels.map((c) => (
                  <li key={c.id}>
                    <a
                      href={c.href ?? undefined}
                      onClick={close}
                      {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className={ITEM}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${CHANNEL_TILE[c.id]}`}>
                        <ContactIcon id={c.id} className="size-5" />
                      </span>
                      {c.id === "phone" ? "Teléfono" : c.label}
                    </a>
                  </li>
                ))}
                {mapsHref && (
                  <li>
                    <a href={mapsHref} onClick={close} target="_blank" rel="noopener noreferrer" className={ITEM}>
                      <span className="size-9 shrink-0">{globe}</span>
                      <span className="min-w-0">
                        Nuestra ubicación
                        {address && <span className="block text-sm font-normal text-brand-muted">{address}</span>}
                      </span>
                    </a>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}
