"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { swipeDirection } from "@/lib/banners/rules";
import { stageRatio } from "@/lib/catalog/gallery";

type Props = { name: string; images: { url: string }[] };

/**
 * Galería de la ficha con proporciones ADAPTABLES. El escenario toma la forma de la foto principal (más vertical para un
 * termo, más apaisado para una bandeja) dentro de límites razonables, así el producto ocupa el espacio en lugar de flotar
 * en un cuadrado. Las demás fotos se ven enteras dentro del mismo escenario (contain: sin recortes ni deformaciones) y
 * el escenario no cambia de forma al pasar de una a otra, para que la página no salte. Nunca se amplía una foto más allá
 * de su resolución real. Miniaturas debajo (en pantallas anchas, en columna al costado); en celular se desliza; con teclado,
 * flechas sobre las miniaturas.
 */
export function ProductGallery({ name, images }: Props) {
  const [index, setIndex] = useState(0);
  // Hacia dónde se avanzó (0 = todavía no se cambió de foto): la foto nueva entra de ese lado.
  const [direction, setDirection] = useState(0);
  // Resolución real de cada foto, tal como la entrega el servidor (el optimizador nunca agranda).
  const [natural, setNatural] = useState<Record<string, { w: number; h: number }>>({});
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;
  const current = images[Math.min(index, count - 1)];
  const primary = natural[images[0].url];
  const ratio = primary ? stageRatio(primary.w, primary.h) : 1;
  const here = natural[current.url];
  // Nunca por debajo de 320 px (una foto diminuta no debe dejar un cuadro diminuto).
  const maxWidth = here ? Math.max(here.w, 320) : undefined;

  const go = (next: number, focus = false) => {
    const i = (next + count) % count;
    setDirection(Math.sign(next - index));
    setIndex(i);
    if (focus) thumbs.current[i]?.focus();
  };

  const remember = (url: string, el: HTMLImageElement) => {
    if (el.naturalWidth > 0) {
      setNatural((cur) => (cur[url]?.w === el.naturalWidth ? cur : { ...cur, [url]: { w: el.naturalWidth, h: el.naturalHeight } }));
    }
  };

  return (
    <div className={`mx-auto flex w-full flex-col gap-3 ${count > 1 ? "lg:flex-row-reverse lg:items-start" : ""}`} style={{ maxWidth: maxWidth ? maxWidth + (count > 1 ? 88 : 0) : undefined }}>
      <div className="min-w-0 flex-1">
        <div
          className="relative overflow-hidden rounded-2xl border border-brand-line bg-brand-photo shadow-sm"
          style={{ aspectRatio: ratio, touchAction: "pan-y", "--dir": direction } as React.CSSProperties}
          onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = start.current;
            start.current = null;
            if (!s || count < 2) return;
            const d = swipeDirection(e.clientX - s.x, e.clientY - s.y);
            if (d !== 0) go(index + d);
          }}
          onPointerCancel={() => (start.current = null)}
        >
          <Image
            key={current.url}
            src={current.url}
            alt={count > 1 ? `${name}, foto ${index + 1} de ${count}` : name}
            fill
            preload={index === 0}
            sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
            className={`object-contain p-2 ${direction !== 0 ? "gallery-photo" : ""}`}
            unoptimized={current.url.endsWith(".svg")}
            draggable={false}
            onLoad={(e) => remember(current.url, e.currentTarget)}
          />
          {count > 1 && (
            <>
              <ArrowButton side="left" label="Foto anterior" onClick={() => go(index - 1)} />
              <ArrowButton side="right" label="Foto siguiente" onClick={() => go(index + 1)} />
              <span className="absolute bottom-2 right-2 rounded-full bg-brand-charcoal/80 px-2.5 py-0.5 text-xs font-medium tabular-nums text-white" aria-hidden>
                {index + 1} / {count}
              </span>
            </>
          )}
        </div>
      </div>

      {count > 1 && (
        <div role="group" aria-label="Fotos del producto" className="grid grid-cols-5 gap-2 lg:w-20 lg:shrink-0 lg:grid-cols-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              ref={(el) => {
                thumbs.current[i] = el;
              }}
              type="button"
              aria-label={`Ver foto ${i + 1} de ${count}`}
              aria-pressed={i === index}
              onClick={() => go(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  go(i + 1, true);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  go(i - 1, true);
                }
              }}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-brand-photo motion-safe:transition-[border-color,transform] motion-safe:duration-150 motion-safe:active:scale-95 ${
                i === index ? "border-brand-orange" : "border-brand-line hover:border-brand-ink/40"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="96px" className="object-contain p-1" unoptimized={img.url.endsWith(".svg")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrowButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-brand-ink shadow-md hover:bg-surface motion-safe:transition-transform motion-safe:active:scale-90 ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={side === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}
