import { CATALOG_COPY } from "@/config/catalog-copy";
import { CONTACT } from "@/config/contact";
import { formatCoordinates } from "@/lib/geo";
import { GlobeMotif } from "./globe-motif";

/**
 * Presentación del negocio: la frase con su remate en naranja y el texto, en horizontal desde escritorio. Los detalles
 * son de mapa: el globo de la marca y las coordenadas reales del local (sin coordenadas configuradas, no aparecen).
 */
export function BusinessIntro() {
  const [first, second] = CATALOG_COPY.intro.title;
  return (
    <section aria-labelledby="presentacion" className="reveal relative mt-10 overflow-hidden sm:mt-14">
      <GlobeMotif className="pointer-events-none absolute -right-12 -top-10 size-56 text-brand-green/10 sm:-right-6 sm:size-72" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
        <h1 id="presentacion" className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
          {first} <span className="block text-brand-orange-ink">{second}</span>
        </h1>
        <div>
          <p className="max-w-[56ch] text-lg leading-relaxed text-brand-muted text-pretty">{CATALOG_COPY.intro.text}</p>
          {CONTACT.location && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm font-medium tabular-nums text-brand-green-ink">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-orange" />
              {CONTACT.locality && <span>{CONTACT.locality}</span>}
              <span className="text-brand-muted">{formatCoordinates(CONTACT.location)}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
