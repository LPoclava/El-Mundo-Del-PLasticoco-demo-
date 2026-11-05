import { CATALOG_COPY } from "@/config/catalog-copy";

/** Conceptos del negocio, sin garantías ni certificaciones. Íconos de trazo en un mismo grosor. */
const BENEFITS = [
  { label: "Calidad y durabilidad", icon: "M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3Zm-3 9 2.2 2.2L15.5 10" },
  { label: "Variedad para tu día a día", icon: "M4 4h6.5v6.5H4V4Zm9.5 0H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5Zm9.5 0H20V20h-6.5v-6.5Z" },
  { label: "Atención personalizada", icon: "M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5ZM8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01" },
  { label: "Un negocio familiar y local", icon: "M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M12 17s-3-1.8-3-3.8a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 2-3 3.8-3 3.8Z" },
] as const;

/**
 * Franja de beneficios: verde oscuro, con divisores finos y un detalle naranja en cada extremo. En celular y tablet
 * los cuatro se ordenan de a dos.
 */
export function BenefitsBand() {
  return (
    <section aria-label={CATALOG_COPY.benefits.title} className="relative mt-14 overflow-hidden rounded-2xl bg-nav text-on-nav sm:mt-20 sm:rounded-3xl">
      <span aria-hidden className="absolute inset-y-6 left-0 w-1 rounded-r-full bg-brand-orange" />
      <span aria-hidden className="absolute inset-y-6 right-0 w-1 rounded-l-full bg-brand-orange" />
      <ul className="grid grid-cols-2 gap-y-6 px-4 py-7 sm:px-6 lg:grid-cols-4 lg:py-8">
        {BENEFITS.map((benefit, i) => (
          <li
            key={benefit.label}
            className={`flex flex-col items-center gap-2.5 px-3 text-center lg:flex-row lg:gap-3 lg:px-6 lg:text-left ${i % 2 === 1 ? "border-l border-white/20" : ""} ${i === 2 ? "lg:border-l lg:border-white/20" : ""}`}
          >
            <svg viewBox="0 0 24 24" className="size-8 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={benefit.icon} />
            </svg>
            <span className="text-sm font-medium leading-snug text-balance sm:text-[0.95rem]">{benefit.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
