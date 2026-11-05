/** Sello de categoría elegida: en el talón del boleto y en la barra del catálogo, que es donde se aterriza al elegirla. */
export function TicketStamp({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`ticket-stamp ${className}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="16" cy="16" r="14" strokeWidth={2} strokeDasharray="3 4" />
      <path className="ticket-stamp-check" pathLength={1} d="m9.5 16.5 4.5 4.5 9-9.5" strokeWidth={2.8} />
    </svg>
  );
}
