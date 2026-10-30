/** Encabezado de sección del catálogo: acento bicolor (naranja y verde, como el logo), título y texto breve. */
export function SectionHeading({ id, title, subtitle, level = 2 }: {
  id: string;
  title: string;
  subtitle?: string;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-4 sm:mb-5">
      <span aria-hidden className="mb-2 flex items-center gap-1">
        <span className="h-1 w-8 rounded-full bg-brand-orange" />
        <span className="h-1 w-3 rounded-full bg-brand-green" />
      </span>
      <Heading id={id} className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
        {title}
      </Heading>
      {subtitle && <p className="mt-1 max-w-2xl text-brand-muted text-pretty">{subtitle}</p>}
    </div>
  );
}
