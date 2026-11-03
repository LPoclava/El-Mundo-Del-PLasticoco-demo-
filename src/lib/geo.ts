/**
 * Proyección ortográfica para dibujar el globo de ubicación en SVG, sin librerías: los trazos se calculan una vez
 * en el servidor y el navegador solo recibe rutas. Sin dependencias de React: se prueba con node --test.
 */
export type LatLng = { lat: number; lng: number };
export type Projected = { x: number; y: number; visible: boolean };

const RAD = Math.PI / 180;

/** Silueta del avión de la marca, apuntando hacia +x. La usan el globo y la pantalla de carga. */
export const PLANE_PATH =
  "M16 0C16-1.6 14-2 12-2H4L-4-11H-8L-3.5-2H-10L-13-6H-16L-14 0-16 6H-13L-10 2H-3.5L-8 11H-4L4 2H12C14 2 16 1.6 16 0Z";

/** Centro de la vista del globo: Sudamérica de frente, con la Patagonia a la vista. */
export const GLOBE_CENTER: LatLng = { lat: -30, lng: -65 };

/** Punto sobre la esfera de radio r (y crece hacia abajo, como en SVG). visible = está en la cara de adelante. */
export function project(point: LatLng, center: LatLng = GLOBE_CENTER, r = 100): Projected {
  const phi = point.lat * RAD;
  const phi0 = center.lat * RAD;
  const dLambda = (point.lng - center.lng) * RAD;
  const x = r * Math.cos(phi) * Math.sin(dLambda);
  const y = -r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dLambda));
  const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dLambda);
  return { x: round(x), y: round(y), visible: z >= 0 };
}

function round(value: number): number {
  // El «+ 0» convierte -0 en 0.
  return Math.round(value * 10) / 10 + 0;
}

/** Ruta SVG de una línea: lo que queda detrás del globo se salta (la línea se corta, no cruza por adelante). */
export function linePath(points: LatLng[], center: LatLng = GLOBE_CENTER, r = 100, closed = false): string {
  let d = "";
  let drawing = false;
  for (const point of points) {
    const p = project(point, center, r);
    if (!p.visible) {
      drawing = false;
      continue;
    }
    d += `${drawing ? "L" : "M"}${p.x} ${p.y}`;
    drawing = true;
  }
  return closed && d ? `${d}Z` : d;
}

/** Meridianos y paralelos cada 30°. */
export function graticule(center: LatLng = GLOBE_CENTER, r = 100): string[] {
  const paths: string[] = [];
  for (let lng = -180; lng < 180; lng += 30) {
    const points = Array.from({ length: 37 }, (_, i) => ({ lat: -90 + i * 5, lng }));
    paths.push(linePath(points, center, r));
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = Array.from({ length: 73 }, (_, i) => ({ lat, lng: -180 + i * 5 }));
    paths.push(linePath(points, center, r));
  }
  return paths.filter(Boolean);
}

/** Costa simplificada de Sudamérica (referencia visual del globo; no es un mapa de navegación). */
export const SOUTH_AMERICA: LatLng[] = [
  [12.4, -71.7], [10.6, -61.9], [8.5, -60], [6.8, -58], [5.8, -55], [4.9, -52], [1.7, -50], [-0.5, -48],
  [-2.5, -44], [-3, -40], [-5, -36.5], [-7.5, -34.8], [-11, -37], [-14, -39], [-18, -39.6], [-23, -42],
  [-23.5, -46], [-26, -48.5], [-29, -49.5], [-33, -52.5], [-34.9, -56], [-36.3, -56.8], [-38.5, -58], [-39, -62],
  [-41, -63], [-42.5, -64.5], [-45, -66.5], [-47.5, -66], [-50.5, -69], [-52.3, -68.5], [-54.8, -65.2], [-55.5, -68],
  [-54, -72], [-51, -75], [-47, -75.5], [-43, -74], [-39, -73.5], [-35, -72.5], [-30, -71.5], [-25, -70.5],
  [-18.5, -70.3], [-15, -75.5], [-12, -77.2], [-8, -79.5], [-4.5, -81.3], [-2.5, -80.5], [1, -79], [4, -77.5],
  [7, -77.8], [9, -76.5], [11, -74.8],
].map(([lat, lng]) => ({ lat, lng }));

/** Coordenadas legibles: «51°32′S 72°18′O». */
export function formatCoordinates({ lat, lng }: LatLng): string {
  return `${degrees(lat, "N", "S")} ${degrees(lng, "E", "O")}`;
}

function degrees(value: number, positive: string, negative: string): string {
  const abs = Math.abs(value);
  let whole = Math.floor(abs);
  let minutes = Math.round((abs - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${whole}°${String(minutes).padStart(2, "0")}′${value < 0 ? negative : positive}`;
}
