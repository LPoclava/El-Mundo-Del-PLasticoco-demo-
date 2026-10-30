"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CATALOG_COPY } from "@/config/catalog-copy";
import type { PromoBanner } from "@/types/product";
import { AUTOPLAY_MS, BANNER_RATIO, isExternalLink, stepIndex, swipeDirection } from "@/lib/banners/rules";

type Props = {
  banners: PromoBanner[];
  /** Milisegundos entre banners. */
  intervalMs?: number;
};

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

/** En pantallas anchas las flechas van sobre la imagen; en celular, en la barra de abajo, para no tapar el banner. */
const ARROW_OVERLAY =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-ink shadow-md hover:bg-white sm:grid";
const ARROW_BAR = "grid size-11 place-items-center rounded-full text-brand-ink hover:bg-brand-sand sm:hidden";

/**
 * Carrusel «Promociones y combos». Avanza solo cada 5 s y se detiene cuando el usuario lo está
 * usando (cursor encima, foco dentro, dedo apoyado, botón de pausa), cuando la pestaña no está
 * visible y siempre que el sistema pida movimiento reducido. Todo temporizador se limpia al
 * cambiar de estado o desmontar. La proporción es fija: cambiar de banner no mueve la página.
 */
export function PromoCarousel({ banners, intervalMs = AUTOPLAY_MS }: Props) {
  const count = banners.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const current = Math.min(index, Math.max(count - 1, 0));
  const withCaption = banners.some(hasCaption);
  const playing = count > 1 && !reduced && !userPaused && !hovered && !focused && !touching && !hidden;

  const go = useCallback((direction: 1 | -1) => setIndex((i) => stepIndex(i, count, direction)), [count]);

  // Un temporizador por banner: si el usuario cambia a mano, la cuenta de 5 s vuelve a empezar.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, current, intervalMs, go]);

  if (count === 0) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={CATALOG_COPY.promotions.title}
      onKeyDown={onKeyDown}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl bg-brand-sand"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
          swiped.current = false;
          if (e.pointerType !== "mouse") setTouching(true);
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          setTouching(false);
          if (!start || count < 2) return;
          const direction = swipeDirection(e.clientX - start.x, e.clientY - start.y);
          if (direction !== 0) {
            swiped.current = true;
            go(direction);
          }
        }}
        onPointerCancel={() => {
          swipe.current = null;
          setTouching(false);
        }}
        // Un deslizamiento no debe abrir el enlace del banner sobre el que terminó el gesto.
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        <div
          className="flex motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
          aria-live={playing ? "off" : "polite"}
        >
          {banners.map((banner, i) => (
            <Slide
              key={banner.id}
              banner={banner}
              position={i + 1}
              count={count}
              active={i === current}
              eager={i === 0}
              withCaption={withCaption}
            />
          ))}
        </div>

        {count > 1 && (
          // Las flechas se centran sobre la IMAGEN (no sobre el texto de abajo) y no tapan sus bordes.
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ aspectRatio: BANNER_RATIO }}>
            <button type="button" onClick={() => go(-1)} aria-label="Promoción anterior" className={`${ARROW_OVERLAY} pointer-events-auto left-3`}>
              <Chevron direction="left" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Promoción siguiente" className={`${ARROW_OVERLAY} pointer-events-auto right-3`}>
              <Chevron direction="right" />
            </button>
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label="Promoción anterior" className={ARROW_BAR}>
            <Chevron direction="left" />
          </button>
          {!reduced && (
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? "Reanudar el avance automático" : "Pausar el avance automático"}
              className="grid size-11 place-items-center rounded-full text-brand-ink hover:bg-brand-sand"
            >
              {userPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}
          <ul className="flex items-center">
            {banners.map((banner, i) => (
              <li key={banner.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ir a la promoción ${i + 1} de ${count}`}
                  aria-current={i === current ? "true" : undefined}
                  className="grid h-11 min-w-11 place-items-center"
                >
                  <span
                    aria-hidden
                    className={`block h-2.5 rounded-full motion-safe:transition-all ${
                      i === current ? "w-6 bg-brand-orange" : "w-2.5 bg-brand-ink/30"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => go(1)} aria-label="Promoción siguiente" className={ARROW_BAR}>
            <Chevron direction="right" />
          </button>
        </div>
      )}
    </div>
  );
}

function hasCaption(b: PromoBanner): boolean {
  return Boolean(b.title || b.body || b.badge || (b.ctaLabel && b.linkUrl));
}

/**
 * Una diapositiva: la imagen se ve COMPLETA y sin nada encima (muchos banners ya traen su texto
 * dentro). Si el banner tiene título, etiqueta, texto o botón, van debajo, en una franja aparte.
 * El enlace toma su nombre del contenido (descripción de la imagen y textos), no de la posición.
 */
function Slide({
  banner,
  position,
  count,
  active,
  eager,
  withCaption,
}: {
  banner: PromoBanner;
  position: number;
  count: number;
  active: boolean;
  eager: boolean;
  withCaption: boolean;
}) {
  const alt = banner.imageAlt ?? banner.title ?? "Promoción de El Mundo del Plástico";

  const content = (
    <>
      <span className="relative block w-full" style={{ aspectRatio: BANNER_RATIO }}>
        <Image
          src={banner.imageUrl}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="object-cover"
          draggable={false}
          {...(eager ? { priority: true } : {})}
        />
      </span>
      {withCaption && (
        <span className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-brand-line bg-white px-4 py-3 sm:px-5">
          <span className="min-w-0">
            {banner.badge && (
              <span className="mr-2 inline-block rounded bg-brand-orange px-2 py-0.5 align-middle text-xs font-semibold text-brand-ink">
                {banner.badge}
              </span>
            )}
            {banner.title && <span className="align-middle text-base font-semibold sm:text-lg">{banner.title}</span>}
            {banner.body && <span className="mt-0.5 block line-clamp-2 text-sm text-brand-muted">{banner.body}</span>}
          </span>
          {banner.ctaLabel && banner.linkUrl && (
            <span className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-brand-ink px-4 text-sm font-semibold text-white group-hover:bg-brand-ink/85">
              {banner.ctaLabel}
            </span>
          )}
        </span>
      )}
    </>
  );

  const inner = "group flex h-full w-full flex-col";
  return (
    <div
      role="group"
      aria-roledescription="diapositiva"
      aria-label={`Promoción ${position} de ${count}`}
      aria-hidden={!active || undefined}
      inert={!active || undefined}
      className="flex w-full shrink-0 grow-0 basis-full flex-col"
    >
      {!banner.linkUrl ? (
        <div className={inner}>{content}</div>
      ) : isExternalLink(banner.linkUrl) ? (
        <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={inner}>{content}</a>
      ) : (
        <Link href={banner.linkUrl} className={inner}>{content}</Link>
      )}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}
