import { CONTACT } from "@/config/contact";
import { graticule, linePath, PLANE_PATH, project, SOUTH_AMERICA } from "@/lib/geo";
import { GlobeMotion } from "./globe-motion";

const GRID = graticule();
const LAND = linePath(SOUTH_AMERICA, undefined, 100, true);
const ORBIT = "M-122 0A122 44 0 1 1 122 0A122 44 0 1 1-122 0";

/**
 * Globo de la ubicación real: costa de Sudamérica y marcador en las coordenadas de src/config/contact.ts (sin
 * coordenadas, no hay marcador). Es SVG calculado en el servidor: la única animación es un avión lento en órbita y
 * el latido del marcador, ambos anulados con «reducir movimiento». GlobeMotion les pone un fin. Sin librerías 3D.
 */
export function LocationGlobe({ className, title, compact = false }: {
  className?: string;
  /** Texto para lectores de pantalla. Sin título, el globo es decorativo. */
  title?: string;
  /** Versión chica: sin cuadrícula fina ni órbita dibujada. */
  compact?: boolean;
}) {
  const marker = CONTACT.location ? project(CONTACT.location) : null;
  return (
    <GlobeMotion lapMs={(compact ? 9 : 22) * 1000}>
    <svg
      viewBox="-135 -135 270 270"
      className={className}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <circle r="100" className="fill-tint-green stroke-brand-green" strokeWidth={compact ? 5 : 2.5} />
      <g fill="none" className="stroke-brand-green" strokeWidth={compact ? 2.5 : 1} opacity={compact ? 0.5 : 0.42}>
        {(compact ? GRID.filter((_, i) => i % 2 === 0) : GRID).map((d) => <path key={d} d={d} />)}
      </g>
      <path d={LAND} className="fill-brand-green/25 stroke-brand-green" strokeWidth={compact ? 2.5 : 1.4} strokeLinejoin="round" />

      <g transform="rotate(-18)">
        {!compact && <path d={ORBIT} fill="none" className="stroke-brand-orange" strokeWidth="1.4" strokeDasharray="3 7" strokeLinecap="round" opacity="0.75" />}
        <g className="globe-plane fill-brand-orange">
          <path d={PLANE_PATH} transform={compact ? "scale(1.05)" : "scale(0.72)"} />
          <animateMotion dur={compact ? "9s" : "22s"} repeatCount="indefinite" rotate="auto" path={ORBIT} />
        </g>
      </g>

      {marker?.visible && (
        <g transform={`translate(${marker.x} ${marker.y})`}>
          <circle r="7" className="globe-pulse fill-brand-orange" />
          <circle r={compact ? 11 : 6.5} className="fill-brand-orange stroke-brand-cream" strokeWidth="2.5" />
        </g>
      )}
    </svg>
    </GlobeMotion>
  );
}
