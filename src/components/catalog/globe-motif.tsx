/** Trama de globo en línea fina, eco del globo del logo. Decorativa. */
export function GlobeMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-110 -110 220 220"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
    >
      <circle r="100" />
      <ellipse rx="40" ry="100" />
      <ellipse rx="100" ry="38" />
    </svg>
  );
}
