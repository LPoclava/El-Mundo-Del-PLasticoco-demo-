import { getContactChannels, type ContactChannel } from "@/lib/contact";
import { ContactIcon } from "./contact-icon";

const buttonBase =
  "flex h-12 w-12 items-center justify-center gap-2.5 rounded-lg border text-sm font-medium md:w-full md:px-4";

function ChannelButton({ channel }: { channel: ContactChannel }) {
  const content = (
    <>
      <ContactIcon id={channel.id} className="size-6 shrink-0 text-brand-green md:size-5" />
      {/* En celular solo se ve el ícono; el nombre queda disponible para lectores de pantalla. */}
      <span className="sr-only md:not-sr-only md:truncate">{channel.label}</span>
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
      className={`${buttonBase} border-brand-line bg-white hover:border-brand-ink`}
    >
      {content}
    </a>
  );
}

export function ContactSection() {
  const isDev = process.env.NODE_ENV !== "production";
  const channels = getContactChannels().filter((c) => c.href || isDev);
  if (channels.length === 0) return null;

  return (
    <section
      id="contacto"
      aria-labelledby="contacto-titulo"
      className="mt-14 scroll-mt-4 border-t border-brand-line pt-8"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="contacto-titulo" className="text-xl font-semibold tracking-tight">
            ¿Tenés alguna consulta?
          </h2>
          <span aria-hidden className="mt-2 block h-0.5 w-8 bg-brand-orange" />
          <p className="mt-3 text-brand-muted">
            Contactanos a través de nuestras redes o por teléfono.
          </p>
        </div>
        <ul className="flex gap-3 md:shrink-0">
          {channels.map((channel) => (
            <li key={channel.id} className="md:w-40">
              <ChannelButton channel={channel} />
            </li>
          ))}
        </ul>
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
