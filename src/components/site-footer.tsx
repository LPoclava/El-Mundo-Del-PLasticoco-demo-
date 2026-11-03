import Image from "next/image";
import { ContactIcon } from "@/components/contact/contact-icon";
import { CopyrightYear } from "@/components/copyright-year";
import { CONTACT } from "@/config/contact";
import { CHANNEL_TILE, getContactChannels } from "@/lib/contact";

/**
 * Pie: cierra la página con el logo y la barra de contacto. Solo aparecen los canales configurados: Instagram queda
 * preparado (CONTACT.instagramUrl) y su botón aparece recién cuando exista la cuenta. Los medios de pago están
 * en la sección de contacto y no se repiten acá.
 */
export function SiteFooter() {
  const channels = getContactChannels().filter((c) => c.href);
  const place = [CONTACT.address, CONTACT.locality].filter(Boolean).join(" · ");

  return (
    <footer className="mt-14 rounded-t-[2rem] bg-nav text-on-nav sm:mt-20 sm:rounded-t-[2.5rem]">
      <div aria-hidden className="mx-auto h-1 w-20 rounded-b-full bg-brand-orange" />
      <div className="mx-auto grid max-w-7xl gap-8 px-5 pb-8 pt-9 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14 lg:px-8">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-cream-fixed p-1">
            <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="64px" className="size-full" />
          </span>
          <div className="min-w-0">
            <Image src="/brand/logo-nombre-claro.png" alt="El Mundo del Plástico" width={554} height={196} sizes="124px" className="h-11 w-auto" />
            <p className="mt-2 text-sm text-on-nav-muted text-pretty">Un mundo para descubrir.</p>
          </div>
        </div>

        <nav aria-label="Contacto" className="lg:justify-self-end">
          <ul className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
            {channels.map((channel) => (
              <li key={channel.id}>
                <a
                  href={channel.href ?? undefined}
                  {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex min-h-12 items-center gap-2.5 rounded-full bg-white/10 py-1.5 pl-1.5 pr-5 text-sm font-medium ring-1 ring-white/15 hover:bg-white/20 focus-visible:outline-on-nav motion-safe:transition-colors"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${CHANNEL_TILE[channel.id]}`}>
                    <ContactIcon id={channel.id} className="size-5" />
                  </span>
                  {channel.id === "phone" ? "Teléfono" : channel.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 pb-20 pt-4 text-sm sm:pb-4 text-on-nav-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© <CopyrightYear /> El Mundo del Plástico. Todos los derechos reservados.</p>
          {place && <p>{place}</p>}
        </div>
      </div>
    </footer>
  );
}
