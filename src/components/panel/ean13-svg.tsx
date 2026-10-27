import { ean13Modules } from "@/lib/barcode/ean";

/** Dibuja un EAN-13 válido para poder escanearlo desde otra pantalla. Solo códigos de la demo. */
export function Ean13Svg({ code, className = "" }: { code: string; className?: string }) {
  const bits = ean13Modules(code);
  const quiet = 9;
  const width = bits.length + quiet * 2;
  const height = 70;
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    const last = bars.at(-1);
    if (last && last.x + last.w === i + quiet) last.w += 1;
    else bars.push({ x: i + quiet, w: 1 });
  }
  return (
    <svg viewBox={`0 0 ${width} ${height + 12}`} role="img" aria-label={`Código de barras ${code}`} className={className}>
      <rect width={width} height={height + 12} fill="#fff" />
      {bars.map((b) => <rect key={b.x} x={b.x} y={4} width={b.w} height={height - 8} fill="#000" />)}
      <text x={width / 2} y={height + 8} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#000">{code}</text>
    </svg>
  );
}
