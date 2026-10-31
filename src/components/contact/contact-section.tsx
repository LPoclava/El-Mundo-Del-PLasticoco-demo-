import { CONTACT } from "@/config/contact";
import { getContactChannels, type ContactChannel } from "@/lib/contact";
import { ContactIcon } from "./contact-icon";

// En celular solo el ícono (48 × 48); desde 640 px, ícono y nombre. Los botones pasan de renglón si no entran.
const buttonBase =
  "flex h-12 min-w-12 items-center justify-center gap-2.5 rounded-lg border px-3 text-sm font-medium sm:px-4";

function ChannelButton({ channel }: { channel: ContactChannel }) {
  const content = (
    <>
      <ContactIcon id={channel.id} className="size-6 shrink-0 text-brand-green sm:size-5" />
      {/* En celular solo se ve el ícono; el nombre queda disponible para lectores de pantalla. */}
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">{channel.label}</span>
    </>
  );

  if (!channel.href) {
    // Solo llega acá en desarrollo: un canal pendiente nunca es un enlace.
    return (
      <span
        aria-disabled="true"
        title="Pendiente de configurar en src/config/contact.ts"
        className={`${buttonBase} cursor-not-allowed border-dashed border-brand-line text-brand-ink/45`}
      >
        {content}
      </span>
    );
  }

  return (
    <a
      href={channel.href}
      {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${buttonBase} border-brand-line bg-white hover:border-brand-ink active:bg-brand-sand`}
    >
      {content}
    </a>
  );
}

/**
 * Contacto. Las redes (incluido Facebook) se muestran solo acá, no en el pie. La dirección y los
 * horarios aparecen únicamente si están confirmados en src/config/contact.ts (hoy no lo están).
 */
export function ContactSection() {
  const isDev = process.env.NODE_ENV !== "production";
  const channels = getContactChannels().filter((c) => c.href || isDev);
  const address = CONTACT.address?.trim() || null;
  const hours = CONTACT.hours?.map((h) => h.trim()).filter(Boolean) ?? [];
  if (channels.length === 0 && !address && hours.length === 0) return null;

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-titulo"
      className="mt-10 scroll-mt-4 border-t border-brand-line pt-6 lg:pt-8"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="contacto-titulo" className="text-xl font-semibold tracking-tight">
            ¿Tenés alguna consulta?
          </h2>
          <span aria-hidden className="mt-2 block h-0.5 w-8 bg-brand-orange" />
          <p className="mt-3 text-brand-muted">
            Contactanos a través de nuestras redes o por teléfono.
          </p>
          {(address || hours.length > 0) && (
            <dl className="mt-3 grid gap-1 text-sm">
              {address && (
                <div className="flex gap-2"><dt className="font-medium">Dirección:</dt><dd className="text-brand-muted">{address}</dd></div>
              )}
              {hours.length > 0 && (
                <div className="flex gap-2"><dt className="font-medium">Horarios:</dt><dd className="text-brand-muted">{hours.map((h) => <span key={h} className="block">{h}</span>)}</dd></div>
              )}
            </dl>
          )}
        </div>
        {channels.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {channels.map((channel) => (
              <li key={channel.id}>
                <ChannelButton channel={channel} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {isDev && channels.some((c) => !c.href) && (
        <p className="mt-4 text-xs text-brand-muted">
          Solo en desarrollo: los canales con borde punteado están pendientes de configurar en
          src/config/contact.ts y no se muestran al público.
        </p>
      )}
    </section>
  );
}
