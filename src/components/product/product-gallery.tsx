"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { swipeDirection } from "@/lib/banners/rules";

type Props = { name: string; images: { url: string }[] };

/**
 * Galería de la ficha: foto grande y miniaturas. La foto se ve entera (sin recortes) porque el
 * cliente decide por ella. En celular se puede deslizar; con teclado, flechas sobre las miniaturas.
 */
export function ProductGallery({ name, images }: Props) {
  const [index, setIndex] = useState(0);
  // Resolución real de cada foto (la que entrega el optimizador, que nunca agranda: si el original es chico,
  // llega chico). Con ella se limita el tamaño en pantalla para no mostrar una foto ampliada y borrosa.
  const [natural, setNatural] = useState<Record<string, number>>({});
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = images.length;
  const current = images[Math.min(index, count - 1)];
  const naturalWidth = natural[current.url];
  // Nunca por debajo de 320 px (una foto diminuta no debe dejar un cuadro diminuto).
  const maxWidth = naturalWidth ? Math.max(naturalWidth, 320) : undefined;

  const go = (next: number, focus = false) => {
    const i = (next + count) % count;
    setIndex(i);
    if (focus) thumbs.current[i]?.focus();
  };

  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-brand-line bg-surface"
        style={{ touchAction: "pan-y" }}
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
          className="object-contain p-2"
          draggable={false}
          onLoad={(e) => {
            const w = e.currentTarget.naturalWidth;
            if (w > 0) setNatural((cur) => (cur[current.url] === w ? cur : { ...cur, [current.url]: w }));
          }}
        />
        {count > 1 && (
          <>
            <ArrowButton side="left" label="Foto anterior" onClick={() => go(index - 1)} />
            <ArrowButton side="right" label="Foto siguiente" onClick={() => go(index + 1)} />
            <span className="absolute bottom-2 right-2 rounded-full bg-brand-ink/75 px-2 py-0.5 text-xs font-medium tabular-nums text-on-ink">
              {index + 1}/{count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div role="group" aria-label="Fotos del producto" className="mt-3 grid grid-cols-5 gap-2">
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
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(i + 1, true);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  go(i - 1, true);
                }
              }}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-surface motion-safe:transition-colors ${
                i === index ? "border-brand-ink" : "border-brand-line hover:border-brand-ink/40"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="96px" className="object-contain p-1" />
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
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-brand-ink shadow-md hover:bg-surface ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={side === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}
