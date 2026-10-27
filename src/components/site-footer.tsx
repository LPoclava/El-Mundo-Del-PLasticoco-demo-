import Image from "next/image";
import { CopyrightYear } from "@/components/copyright-year";
import { ContactIcon } from "@/components/contact/contact-icon";
import { getContactChannels } from "@/lib/contact";

export function SiteFooter() {
  const socials = getContactChannels().filter(
    (c) => (c.id === "instagram" || c.id === "facebook") && c.href,
  );

  return (
    <footer className="mt-14 border-t border-brand-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo-icono.png" alt="" width={322} height={323} className="size-9" />
          <div className="text-sm">
            <p className="font-medium">El Mundo del Plástico</p>
            <p className="text-brand-ink/60">
              © <CopyrightYear /> Todos los derechos reservados.
            </p>
          </div>
        </div>
        {socials.length > 0 && (
          <ul className="flex items-center gap-1">
            {socials.map((s) => (
              <li key={s.id}>
                <a
                  href={s.href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid size-11 place-items-center rounded-lg text-brand-ink/70 hover:text-brand-green"
                >
                  <ContactIcon id={s.id} className="size-5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
