"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { PLANE_PATH } from "@/lib/geo";

/** Duración de la secuencia y de la salida; deben coincidir con las de .intro en globals.css. */
const SEQUENCE_MS = 1850;
const LEAVE_MS = 300;

/** Rodea al globo sin cruzar las letras del logo. */
const ORBIT = "M-138 0A138 116 0 1 1 138 0A138 116 0 1 1-138 0";

function subscribe(callback: () => void) {
  window.addEventListener("mp-intro-end", callback);
  return () => window.removeEventListener("mp-intro-end", callback);
}
const isActive = () => document.documentElement.hasAttribute("data-intro");

/**
 * Pantalla de carga de marca: el globo del logo, el avión que le da una vuelta y el nombre que se despliega. Se ve solo
 * en la primera entrada de la sesión a la portada, nunca con movimiento reducido, ni en la navegación interna, ni al
 * abrir un producto.
 *
 * No espera datos ni imágenes y no depende de React: el script de src/app/layout.tsx la activa y atiende «saltar» (una
 * tecla, un toque, la rueda), y el CSS la retira al terminar la secuencia. Lo de atrás queda fuera del foco mientras
 * dura. Si la carga real tarda más, la página muestra sus esqueletos y si falla, su pantalla de error. Este componente
 * solo pone el foco en «Saltar» y limpia la marca cuando termina.
 */
export function IntroLoader() {
  const active = useSyncExternalStore(subscribe, isActive, () => true);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const clear = () => {
      root.removeAttribute("data-intro");
      window.dispatchEvent(new Event("mp-intro-end"));
    };
    let timer = window.setTimeout(clear, Math.max(0, SEQUENCE_MS + LEAVE_MS - performance.now()));
    const observer = new MutationObserver(() => {
      if (root.getAttribute("data-intro") !== "leaving") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(clear, LEAVE_MS);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    if (root.getAttribute("data-intro") === "play") skipRef.current?.focus({ preventScroll: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="intro" role="status" aria-label="Cargando El Mundo del Plástico">
      <div className="intro-stage">
        <div className="intro-globe">
          {/* Disco crema como el del volante del negocio: las líneas verdes del logo no se leen sobre verde oscuro. */}
          <span className="block size-full rounded-full bg-brand-cream-fixed p-[3%]">
            <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="168px" loading="eager" className="size-full" />
          </span>
          <svg viewBox="-150 -150 300 300" aria-hidden className="intro-orbit">
            <g transform="rotate(-18)">
              <path d={ORBIT} pathLength={1} fill="none" stroke="var(--color-brand-orange)" strokeWidth="2.5" strokeLinecap="round" className="intro-trail" />
              <g className="intro-plane">
                <path d={PLANE_PATH} fill="var(--color-brand-orange)" stroke="var(--color-brand-forest)" strokeWidth="1" />
                <animateMotion dur="0.95s" begin="0.3s" fill="freeze" rotate="auto" path={ORBIT} calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.45 0.05 0.55 0.95" />
              </g>
            </g>
          </svg>
        </div>
        <div className="intro-name">
          <div className="intro-name-inner">
            <span aria-hidden className="intro-rule" />
            <Image src="/brand/logo-nombre-claro.png" alt="El Mundo del Plástico" width={554} height={196} sizes="248px" loading="eager" className="intro-wordmark" />
          </div>
        </div>
      </div>
      <button ref={skipRef} type="button" className="intro-skip">Saltar</button>
    </div>
  );
}
