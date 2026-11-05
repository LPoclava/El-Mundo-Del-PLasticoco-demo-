import { ContactIcon } from "@/components/contact/contact-icon";
import { generalInquiryHref } from "@/lib/contact";
import { WhatsAppFloatGuard } from "./whatsapp-float-guard";

/**
 * Acceso flotante a WhatsApp en la portada. Pequeño (48 px) y pegado a la esquina para no tapar productos; usa
 * el número configurado (sin número no se dibuja). Solo abre el chat: no registra nada. En celular se aparta mientras
 * se recorre la grilla: taparía la consulta de una tarjeta, que lleva el producto en el mensaje.
 */
export function WhatsAppFloat() {
  const href = generalInquiryHref("Hola, quería hacer una consulta.");
  if (!href) return null;
  return (
    <WhatsAppFloatGuard>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="whatsapp-float fixed bottom-4 right-4 z-30 grid size-12 place-items-center rounded-full bg-whatsapp hover:bg-whatsapp-hover active:bg-whatsapp-active text-white shadow-md sm:bottom-6 sm:right-6"
    >
      <ContactIcon id="whatsapp" className="size-6" />
    </a>
    </WhatsAppFloatGuard>
  );
}
