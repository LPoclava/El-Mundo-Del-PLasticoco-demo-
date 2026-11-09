/**
 * Forma del escenario de la galería de la ficha (sin React: se prueba con node --test).
 *
 * Toma la proporción (ancho / alto) de la foto principal, limitada para que ni una foto muy alargada deje un escenario
 * inmanejable ni una muy chata deje un escenario diminuto. Una foto vertical (termo, botella) da un escenario vertical;
 * una apaisada (bandeja, caja), uno apaisado. Se redondea para que cambios mínimos no muevan la página.
 */
export const MIN_RATIO = 0.8; // 4:5, el más vertical
export const MAX_RATIO = 1.4; // 7:5, el más apaisado

export function stageRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  const raw = width / height;
  const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw));
  return Math.round(clamped * 20) / 20;
}
