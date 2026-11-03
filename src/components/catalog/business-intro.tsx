import { LocationGlobe } from "@/components/location-globe";
import { CATALOG_COPY } from "@/config/catalog-copy";
import { CONTACT } from "@/config/contact";

/**
 * Presentación del negocio: la frase con su remate en naranja, quiénes somos y de dónde, y el globo con el avión. El globo
 * marca el lugar real del local y es decorativo: la dirección para el visitante está en el pie. En pantallas chicas no
 * aparece, para llegar antes a los productos.
 */
export function BusinessIntro() {
  const [first, second] = CATALOG_COPY.intro.title;
  return (
    <section aria-labelledby="presentacion" className="reveal mt-4 grid items-center gap-3 sm:mt-6 md:grid-cols-[minmax(0,auto)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto]">
      <h1 id="presentacion" className="font-display text-[1.9rem] font-extrabold leading-[1.1] text-balance sm:text-[2.5rem] lg:text-[2.75rem]">
        {first} <span className="block text-brand-orange-ink">{second}</span>
      </h1>
      <div className="md:border-l md:border-brand-line md:pl-8">
        <p className="max-w-[56ch] leading-relaxed text-brand-muted text-pretty">{CATALOG_COPY.intro.text}</p>
        <p className="mt-1.5 text-sm font-semibold text-brand-green-ink">
          {CATALOG_COPY.intro.concept}{CONTACT.locality ? `, desde ${CONTACT.locality}` : ""}.
        </p>
      </div>
      <LocationGlobe className="hidden size-40 lg:block" />
    </section>
  );
}
