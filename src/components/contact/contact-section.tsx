import { LocationGlobe } from "@/components/location-globe";
import { CONTACT } from "@/config/contact";
import { formatPhone, getMapsHref, generalInquiryHref } from "@/lib/contact";
import { PaymentMethods } from "./payment-methods";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3 py-2.5">
      <dt className="text-sm text-brand-muted">{term}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

/**
 * Contacto y ubicación: globo, datos del local y formas de pago; en celular se apilan. Todos los datos salen de
 * src/config/contact.ts: el que no esté configurado no se muestra. «Cómo llegar» abre Google Maps con la dirección.
 */
export function ContactSection() {
  const address = CONTACT.address?.trim() || null;
  const locality = CONTACT.locality?.trim() || null;
  const hours = CONTACT.hours?.map((h) => h.trim()).filter(Boolean) ?? [];
  const phone = formatPhone(CONTACT.phone);
  const whatsapp = formatPhone(CONTACT.whatsapp);
  const whatsappHref = generalInquiryHref("Hola, quería hacer una consulta.");
  const mapsHref = getMapsHref();
  const globeLabel = locality ? `Globo terráqueo con un marcador en ${locality}` : "Globo terráqueo";

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-titulo"
      className="reveal mt-14 grid scroll-mt-4 gap-10 sm:mt-20 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12"
    >
      <div className="mx-auto w-full max-w-72 self-center md:max-w-none">
        <LocationGlobe title={globeLabel} className="w-full" />
      </div>

      <div className="min-w-0">
        <h2 id="contacto-titulo" className="text-2xl font-semibold tracking-tight">Dónde encontrarnos</h2>
        <dl className="mt-3 divide-y divide-brand-line">
          {address && <Row term="Dirección">{address}</Row>}
          {locality && <Row term="Localidad">{locality}</Row>}
          {hours.length > 0 && <Row term="Horarios">{hours.map((h) => <span key={h} className="block">{h}</span>)}</Row>}
          {phone && <Row term="Teléfono"><a href={`tel:+${CONTACT.phone?.replace(/\D/g, "")}`} className="underline-offset-4 hover:underline">{phone}</a></Row>}
          {whatsapp && whatsappHref && (
            <Row term="WhatsApp"><a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{whatsapp}</a></Row>
          )}
        </dl>
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-orange px-6 font-semibold text-brand-charcoal hover:brightness-105 motion-safe:transition motion-safe:active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s7-5.6 7-11.5A7 7 0 0 0 5 9.5C5 15.4 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            Cómo llegar
            <span className="sr-only"> (abre Google Maps)</span>
          </a>
        )}
      </div>

      <div className="min-w-0 md:col-span-2 lg:col-span-1">
        <PaymentMethods />
      </div>
    </section>
  );
}
