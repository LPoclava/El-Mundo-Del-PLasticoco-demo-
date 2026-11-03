"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CATALOG_COPY } from "@/config/catalog-copy";
import type { PromoBanner } from "@/types/product";
import { AUTOPLAY_MS, BANNER_MOBILE_RATIO, BANNER_RATIO, isExternalLink, stepIndex, swipeDirection } from "@/lib/banners/rules";

const DESKTOP_SIZES = "(min-width: 1152px) 1120px, 100vw";

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

/** Flechas sobre la imagen solo desde 768 px (escritorio y tablet ancha); en celular se cambia deslizando. Discretas, de 44 px. */
const ARROW_OVERLAY =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/80 text-brand-ink shadow-sm backdrop-blur-sm hover:bg-surface motion-safe:transition-colors md:grid";

/**
 * Slider de promociones: solo la imagen, con flechas encima e indicadores debajo, para no tapar productos ni textos.
 * Con todos los banners con arte para celular, en pantallas angostas usa esa imagen y esa proporción. Avanza solo cada 10 s y vuelve al primero
 * al llegar al último. La cuenta se reinicia al cambiar a mano y se detiene cuando el usuario lo está usando
 * (cursor encima, foco dentro, dedo apoyado), cuando el carrusel no está en pantalla, cuando la pestaña está
 * oculta y siempre que el sistema pida movimiento reducido (en ese caso solo se cambia con las flechas o
 * deslizando). Con un solo banner no hay flechas ni rotación. Todo temporizador se limpia al cambiar de estado
 * o desmontar. La proporción es fija: cambiar de banner no mueve la página.
 */
export function PromoCarousel({ banners, intervalMs = AUTOPLAY_MS }: Props) {
  const count = banners.length;
  // La proporción es la misma para todos: si falta el arte de uno, el celular usa la apaisada en todos (no salta).
  const mobileArt = count > 0 && banners.every((b) => b.mobileImageUrl);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  // Visible en pantalla (IntersectionObserver): fuera de la vista no corre ningún temporizador.
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const current = Math.min(index, Math.max(count - 1, 0));
  const [paused, setPaused] = useState(false);
  const playing = count > 1 && !reduced && !paused && inView && !hovered && !focused && !touching && !hidden;

  const go = useCallback((direction: 1 | -1) => setIndex((i) => stepIndex(i, count, direction)), [count]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Un temporizador por banner: si el usuario cambia a mano, la cuenta de 10 s vuelve a empezar.
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
      ref={rootRef}
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
        className="relative aspect-[var(--ratio-mobile)] overflow-hidden rounded-2xl bg-brand-sand sm:rounded-3xl md:aspect-auto md:h-[min(46svh,22.5rem)]"
        style={{ "--ratio-mobile": mobileArt ? BANNER_MOBILE_RATIO : BANNER_RATIO, touchAction: "pan-y" } as React.CSSProperties}
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
          className="flex h-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out"
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
              mobileArt={Boolean(mobileArt)}
            />
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Promoción anterior" className={`${ARROW_OVERLAY} left-3`}>
              <Chevron direction="left" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Promoción siguiente" className={`${ARROW_OVERLAY} right-3`}>
              <Chevron direction="right" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-0.5 flex items-center justify-center">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir a la promoción ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
              className="group/dot grid size-11 place-items-center rounded-full"
            >
              <span className={`block rounded-full motion-safe:transition-all ${i === current ? "h-2 w-5 bg-brand-green" : "size-2 bg-brand-ink/35 group-hover/dot:bg-brand-ink/60"}`} />
            </button>
          ))}
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Reanudar el cambio automático" : "Detener el cambio automático"}
              className="grid size-11 place-items-center rounded-full text-brand-muted hover:text-brand-ink motion-safe:transition-colors"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                {paused ? <path d="M8 5v14l11-7L8 5Z" /> : <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />}
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Una diapositiva: SOLO la imagen promocional, completa y sin nada encima ni debajo (los banners ya traen su
 * texto). Con destino configurado toda la imagen es el enlace; sin destino es una imagen sin acción.
 * El nombre accesible sale de la descripción de la imagen (o del título cargado en el panel).
 */
function Slide({ banner, position, count, active, eager, mobileArt }: {
  banner: PromoBanner;
  position: number;
  count: number;
  active: boolean;
  eager: boolean;
  mobileArt: boolean;
}) {
  const alt = banner.imageAlt ?? banner.title ?? "Promoción de El Mundo del Plástico";
  const image = (
    <>
      {/* Solo desde tablet, donde el alto limitado puede dejar márgenes a los costados de la imagen. */}
      <Image src={banner.imageUrl} alt="" aria-hidden fill sizes={DESKTOP_SIZES} quality={90} draggable={false} className="hidden scale-110 object-cover blur-2xl md:block" />
      {mobileArt && banner.mobileImageUrl ? (
        <ArtDirectedImage desktop={banner.imageUrl} mobile={banner.mobileImageUrl} alt={alt} eager={eager} />
      ) : (
        <Image
          src={banner.imageUrl}
          alt={alt}
          fill
          sizes={DESKTOP_SIZES}
          quality={90}
          className="object-cover md:object-contain"
          draggable={false}
          preload={eager}
        />
      )}
    </>
  );
  // El contorno de foco va hacia adentro: el contenedor recorta lo que sobresale.
  const box = "relative block h-full w-full rounded-xl focus-visible:-outline-offset-4";
  return (
    <div
      role="group"
      aria-roledescription="diapositiva"
      aria-label={`Promoción ${position} de ${count}`}
      aria-hidden={!active || undefined}
      inert={!active || undefined}
      className="relative h-full w-full shrink-0 grow-0 basis-full"
    >
      {!banner.linkUrl ? (
        <div className={box}>{image}</div>
      ) : isExternalLink(banner.linkUrl) ? (
        <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={box}>{image}</a>
      ) : (
        <Link href={banner.linkUrl} className={box}>{image}</Link>
      )}
    </div>
  );
}

/** Una imagen para cada ancho (no un recorte de la misma): el navegador baja solo la que corresponde. */
function ArtDirectedImage({ desktop, mobile, alt, eager }: { desktop: string; mobile: string; alt: string; eager: boolean }) {
  const common = { alt, fill: true, quality: 90 };
  const { props: { srcSet: desktopSet } } = getImageProps({ ...common, src: desktop, sizes: DESKTOP_SIZES });
  const { props: { src, ...mobileProps } } = getImageProps({ ...common, src: mobile, sizes: "100vw", loading: eager ? "eager" : "lazy" });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktopSet} sizes={DESKTOP_SIZES} />
      <img {...mobileProps} src={src} alt={alt} draggable={false} className="object-cover md:object-contain" />
    </picture>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

