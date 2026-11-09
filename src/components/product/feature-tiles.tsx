import type { ReactNode } from "react";

/** Íconos de cada tipo de dato. Solo existen los datos que el modelo registra (marca, categoría, medida, color, opciones). */
const ICON: Record<string, ReactNode> = {
  Marca: <path d="M3 12V4h8l9 9-8 8-9-9ZM7.5 7.5h.01" />,
  Categoría: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5" />,
  Medida: <path d="M3 17 17 3l4 4L7 21l-4-4ZM8 12l2 2M11 9l2 2M14 6l2 2" />,
  Color: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  Opciones: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
};

function iconFor(term: string): ReactNode {
  if (term.startsWith("Medida")) return ICON.Medida;
  if (term.startsWith("Color")) return ICON.Color;
  return ICON[term] ?? ICON.Opciones;
}

/**
 * Características como bloques visuales (un dato por bloque, con su ícono) en lugar de una tabla. Solo muestra lo que el
 * producto tiene cargado: nunca se completa con datos supuestos (no hay materiales ni dimensiones inventadas).
 */
export function FeatureTiles({ features }: { features: [string, string][] }) {
  if (features.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-2.5 min-[22rem]:grid-cols-2">
      {features.map(([term, value]) => (
        <div key={term} className="flex min-w-0 items-start gap-3 rounded-xl border border-brand-line bg-brand-card p-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-tint-green text-brand-green-ink">
            <svg viewBox="0 0 24 24" className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              {iconFor(term)}
            </svg>
          </span>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-[0.06em] text-brand-muted">{term}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold leading-snug">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
