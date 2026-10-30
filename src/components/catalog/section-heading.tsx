/** Encabezado de sección del catálogo: acento bicolor (naranja y verde, como el logo), título y texto breve. */
export function SectionHeading({ id, title, subtitle, level = 2, compact = false }: {
  id: string;
  title: string;
  subtitle?: string;
  level?: 2 | 3;
  /** En celular el título queda solo para lectores de pantalla (gana espacio para el contenido). */
  compact?: boolean;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={compact ? "sm:mb-5" : "mb-4 sm:mb-5"}>
      <span aria-hidden className={`mb-2 items-center gap-1 ${compact ? "hidden sm:flex" : "flex"}`}>
        <span className="h-1 w-8 rounded-full bg-brand-orange" />
        <span className="h-1 w-3 rounded-full bg-brand-green" />
      </span>
      <Heading id={id} className={`${compact ? "sr-only sm:not-sr-only " : ""}text-xl font-semibold tracking-tight text-balance sm:text-2xl`}>
        {title}
      </Heading>
      {subtitle && <p className="mt-1 max-w-2xl text-brand-muted text-pretty">{subtitle}</p>}
    </div>
  );
}
