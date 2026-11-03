/** Íconos de trazo de las categorías principales; las demás usan uno genérico. «bano» es el slug de Limpieza. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const common = {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (slug) {
    case "cocina":
      return (
        <svg {...common}>
          <path d="M8 22h32l-3 16a4 4 0 0 1-4 3H15a4 4 0 0 1-4-3L8 22Z" />
          <path d="M5 22h38M18 22v-4a6 6 0 0 1 12 0v4M17 12c0-3 3-3 3-6M26 12c0-3 3-3 3-6" />
        </svg>
      );
    case "bano":
    case "limpieza":
      return (
        <svg {...common}>
          <path d="M18 18h12l3 6v15a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V24l3-6Z" />
          <path d="M20 18v-6h8v6M20 12V8h13M33 8v4M38 8h.01M38 13h.01M42 10h.01M15 30h18" />
        </svg>
      );
    case "libreria":
      return (
        <svg {...common}>
          <path d="M8 8h26a4 4 0 0 1 4 4v28H12a4 4 0 0 1-4-4V8Z" />
          <path d="M8 36a4 4 0 0 1 4-4h26M16 16h14M16 22h10" />
        </svg>
      );
    case "regaleria":
      return (
        <svg {...common}>
          <rect x="6" y="18" width="36" height="8" rx="2" />
          <path d="M9 26v14a2 2 0 0 0 2 2h26a2 2 0 0 0 2-2V26M24 18v24" />
          <path d="M24 18c-4 0-10-1-10-6a4 4 0 0 1 7-2l3 8Zm0 0c4 0 10-1 10-6a4 4 0 0 0-7-2l-3 8Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="7" y="7" width="14" height="14" rx="3" />
          <rect x="27" y="7" width="14" height="14" rx="3" />
          <rect x="7" y="27" width="14" height="14" rx="3" />
          <rect x="27" y="27" width="14" height="14" rx="3" />
        </svg>
      );
  }
}
