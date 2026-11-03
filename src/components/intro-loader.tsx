"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PLANE_PATH } from "@/lib/geo";

const SEEN_KEY = "mp-intro";
/** Duración de la secuencia: globo, vuelta del avión y despliegue del nombre. */
const SEQUENCE_MS = 2850;
/** A partir de acá se ofrece reintentar o entrar igual. */
const SLOW_MS = 9000;
/** La primera imagen del slider se espera, pero no a cualquier costo. */
const BANNER_WAIT_MS = 1500;

/** Rodea al globo sin cruzar las letras del logo. */
const ORBIT = "M-138 0A138 116 0 1 1 138 0A138 116 0 1 1-138 0";

function subscribe(callback: () => void) {
  window.addEventListener("mp-intro-end", callback);
  return () => window.removeEventListener("mp-intro-end", callback);
}
const isActive = () => document.documentElement.hasAttribute("data-intro");

/** Espera a que aparezca un elemento: el catálogo llega por streaming después de la primera pintura. */
function waitForElement(selector: string): { promise: Promise<void>; cancel: () => void } {
  let observer: MutationObserver | undefined;
  const promise = new Promise<void>((resolve) => {
    if (document.querySelector(selector)) return resolve();
    observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer?.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  return { promise, cancel: () => observer?.disconnect() };
}

function decodeImage(img: HTMLImageElement | null): Promise<unknown> {
  return img?.decode ? img.decode().catch(() => undefined) : Promise.resolve();
}

/**
 * Pantalla de carga de marca: el globo del logo, el avión que le da una vuelta y el nombre que se despliega. Se ve
 * solo en la primera entrada de la sesión a la portada (lo decide el script de src/app/layout.tsx antes de pintar):
 * ni en la navegación interna ni al abrir un producto. Se retira cuando terminó la secuencia Y está lista la carga
 * real: fuentes, logo, datos del catálogo (marca data-catalog-ready, que el catálogo o su error agregan al llegar) y
 * la primera imagen del slider. No espera las fotos diferidas. Si tarda o no hay conexión ofrece reintentar o entrar;
 * si JavaScript falla, el CSS la retira solo.
 */
export function IntroLoader() {
  const active = useSyncExternalStore(subscribe, isActive, () => true);
  const ref = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const [slow, setSlow] = useState(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Sin almacenamiento se vuelve a ver en la próxima carga completa.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.setAttribute("data-state", "leaving");
    window.setTimeout(() => {
      document.documentElement.removeAttribute("data-intro");
      window.dispatchEvent(new Event("mp-intro-end"));
    }, reduced ? 0 : 430);
  }

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const catalog = waitForElement("[data-catalog-ready]");
    const logo = ref.current?.querySelector("img") ?? null;
    let bannerTimer: number | undefined;
    const ready = Promise.all([document.fonts?.ready, decodeImage(logo), catalog.promise]).then(() => {
      const banner = document.querySelector<HTMLImageElement>("#promociones img");
      return Promise.race([
        decodeImage(banner),
        new Promise((resolve) => {
          bannerTimer = window.setTimeout(resolve, BANNER_WAIT_MS);
        }),
      ]);
    });
    // La animación corre desde la primera pintura, así que se descuenta lo que ya pasó desde que empezó la carga.
    const sequence = new Promise((resolve) => window.setTimeout(resolve, reduced ? 0 : Math.max(0, SEQUENCE_MS - performance.now())));
    let cancelled = false;
    Promise.all([ready, sequence]).then(() => {
      if (!cancelled) finish();
    });

    const showSlow = () => setSlow(true);
    const slowTimer = window.setTimeout(showSlow, SLOW_MS);
    window.addEventListener("offline", showSlow);
    if (navigator.onLine === false) window.setTimeout(showSlow, 0);

    return () => {
      cancelled = true;
      catalog.cancel();
      window.clearTimeout(slowTimer);
      window.clearTimeout(bannerTimer);
      window.removeEventListener("offline", showSlow);
      root.style.overflow = previousOverflow;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div ref={ref} className="intro" role="status" aria-label="Cargando El Mundo del Plástico">
      <div className="flex flex-col items-center">
        <div className="intro-stage">
          <div className="intro-globe">
            {/* Disco crema como el del volante del negocio: las líneas verdes del logo no se leen sobre verde oscuro. */}
            <span className="block size-full rounded-full bg-brand-cream-fixed p-[3%]">
              <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="168px" preload className="size-full" />
            </span>
            <svg viewBox="-150 -150 300 300" aria-hidden className="intro-orbit">
              <g transform="rotate(-18)">
                <path d={ORBIT} pathLength={1} fill="none" stroke="var(--color-brand-orange)" strokeWidth="2.5" strokeLinecap="round" className="intro-trail" />
                <g className="intro-plane">
                  <path d={PLANE_PATH} fill="var(--color-brand-orange)" stroke="var(--color-brand-forest)" strokeWidth="1" />
                  <animateMotion dur="1.5s" begin="0.55s" fill="freeze" rotate="auto" path={ORBIT} calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.45 0.05 0.55 0.95" />
                </g>
              </g>
            </svg>
          </div>
          <div className="intro-name">
            <div className="intro-name-inner">
              <span aria-hidden className="intro-rule" />
              <Image src="/brand/logo-nombre-claro.png" alt="El Mundo del Plástico" width={554} height={196} sizes="248px" preload className="intro-wordmark" />
            </div>
          </div>
        </div>

        {slow && (
          <div className="mt-10 max-w-sm text-center" role="alert">
            <p className="text-sm text-on-nav-muted">La carga está tardando más de lo normal. Revisá tu conexión.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-brand-orange px-5 text-sm font-semibold text-brand-charcoal hover:brightness-105">
                Reintentar
              </button>
              <button type="button" onClick={finish} className="min-h-11 rounded-full px-5 text-sm font-medium text-on-nav ring-1 ring-white/30 hover:bg-white/10">
                Entrar igual
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
