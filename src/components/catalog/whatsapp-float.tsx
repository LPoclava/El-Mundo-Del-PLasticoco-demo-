import { ContactIcon } from "@/components/contact/contact-icon";
import { generalInquiryHref } from "@/lib/contact";

/**
 * Acceso flotante a WhatsApp en la portada. Pequeño (48 px) y pegado a la esquina para no tapar productos; usa
 * el número configurado (sin número no se dibuja). Solo abre el chat: no registra nada.
 */
export function WhatsAppFloat() {
  const href = generalInquiryHref("Hola, quería hacer una consulta.");
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="fixed bottom-4 right-4 z-30 grid size-12 place-items-center rounded-full bg-whatsapp hover:bg-whatsapp-hover active:bg-whatsapp-active text-white shadow-md  motion-safe:transition motion-safe:active:scale-95 sm:bottom-6 sm:right-6"
    >
      <ContactIcon id="whatsapp" className="size-6" />
    </a>
  );
}
