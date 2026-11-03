import Image from "next/image";
import { ContactIcon } from "@/components/contact/contact-icon";
import { PaymentLogos } from "@/components/contact/payment-methods";
import { CopyrightYear } from "@/components/copyright-year";
import { CONTACT } from "@/config/contact";
import { formatPhone, getContactChannels, getMapsHref } from "@/lib/contact";

const COLUMN = "border-t border-white/15 pt-6 first:border-t-0 first:pt-0 md:border-t-0 md:pt-0 lg:border-l lg:pl-7 lg:first:border-l-0 lg:first:pl-0";
const HEADING = "font-display text-base font-extrabold";

/**
 * Pie integral: el único lugar con identidad, contacto, ubicación y medios de pago. Cuatro columnas en escritorio, dos en
 * tablet y bloques apilados en celular, siempre como una sola pieza. Todos los datos salen de src/config/contact.ts: lo que
 * no esté configurado no se muestra. Instagram queda preparado y aparece recién cuando exista la cuenta.
 */
export function SiteFooter() {
  const channels = getContactChannels().filter((c) => c.href);
  const address = CONTACT.address?.trim() || null;
  const locality = CONTACT.locality?.trim() || null;
  const hours = CONTACT.hours?.map((h) => h.trim()).filter(Boolean) ?? [];
  const mapsHref = getMapsHref();
  const number = { phone: formatPhone(CONTACT.phone), whatsapp: formatPhone(CONTACT.whatsapp) } as Record<string, string | null>;

  return (
    <footer id="contacto" className="mt-10 scroll-mt-20 rounded-t-[2rem] bg-nav text-on-nav sm:mt-14 sm:rounded-t-[2.5rem]">
      <div aria-hidden className="mx-auto h-1 w-20 rounded-b-full bg-brand-orange" />
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-5 pb-7 pt-8 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,1.2fr)] lg:gap-7 lg:px-8">
        <div className={COLUMN}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-cream-fixed p-1">
              <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="64px" className="size-full" />
            </span>
            <Image src="/brand/logo-nombre-claro.png" alt="El Mundo del Plástico" width={554} height={196} sizes="116px" className="h-10 w-auto max-w-full object-contain" />
          </div>
          <p className="mt-3 text-sm text-on-nav-muted">Un mundo para descubrir.</p>
        </div>

        {channels.length > 0 && (
          <section aria-labelledby="pie-contacto" className={COLUMN}>
            <h2 id="pie-contacto" className={HEADING}>Contacto</h2>
            <ul className="mt-2">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <a
                    href={channel.href ?? undefined}
                    {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="-mx-2 flex min-h-11 flex-wrap items-center gap-x-3 rounded-lg px-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-on-nav active:bg-white/20 motion-safe:transition-colors"
                  >
                    <ContactIcon id={channel.id} className="size-5 shrink-0" />
                    <span>{channel.id === "phone" ? "Teléfono" : channel.label}</span>
                    {number[channel.id] && <span className="tabular-nums font-normal text-on-nav-muted">{number[channel.id]}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(address || hours.length > 0) && (
          <section aria-labelledby="pie-ubicacion" className={COLUMN}>
            <h2 id="pie-ubicacion" className={HEADING}>Ubicación y horarios</h2>
            {address && mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group -mx-2 mt-2 flex min-h-11 gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/10 focus-visible:outline-on-nav active:bg-white/20 motion-safe:transition-colors"
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-orange" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 21s7-5.6 7-11.5A7 7 0 0 0 5 9.5C5 15.4 12 21 12 21Z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                <span>
                  <span className="block font-medium">{address}</span>
                  {locality && <span className="block text-on-nav-muted">{locality}</span>}
                  <span className="mt-1 inline-block font-semibold underline underline-offset-4 group-hover:decoration-2">
                    Cómo llegar<span className="sr-only"> (abre Google Maps)</span>
                  </span>
                </span>
              </a>
            )}
            {hours.length > 0 && (
              <p className="mt-1 flex gap-3 text-sm">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-orange" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
                <span>{hours.map((h) => <span key={h} className="block">{h}</span>)}</span>
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="pie-pagos" className={COLUMN}>
          <h2 id="pie-pagos" className={HEADING}>Formas de pago</h2>
          <div className="mt-3">
            <PaymentLogos />
          </div>
          <p className="mt-2.5 text-xs text-on-nav-muted">Mastercard y Visa: tarjetas de débito y crédito.</p>
        </section>
      </div>

      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-5 pb-20 pt-4 text-sm text-on-nav-muted sm:pb-4 lg:px-8">
          © <CopyrightYear /> El Mundo del Plástico. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
