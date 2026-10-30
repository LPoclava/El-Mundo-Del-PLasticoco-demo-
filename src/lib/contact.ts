import { CONTACT } from "@/config/contact";
import { inquiryText } from "@/lib/catalog/product";

export type ContactChannelId = "whatsapp" | "phone" | "instagram" | "facebook";

export type ContactChannel = {
  id: ContactChannelId;
  label: string;
  /** null = pendiente de configurar: nunca se renderiza como enlace. */
  href: string | null;
  /** Se abre en una pestaña nueva (enlaces externos). */
  external: boolean;
};

function digits(value: string | null): string | null {
  const d = value?.replace(/\D/g, "") ?? "";
  return d.length >= 8 ? d : null;
}

function httpsUrl(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Número comercial de WhatsApp (solo dígitos) o null si no está configurado. */
export function getWhatsAppNumber(): string | null {
  return digits(CONTACT.whatsapp);
}

/**
 * Enlace de consulta por WhatsApp para un producto, con el mensaje ya escrito. Solo ABRE el chat:
 * el cliente decide si lo envía, así que no se registra ni se cuenta como venta ni como consulta enviada.
 * Devuelve null si no hay número configurado (el botón no se muestra).
 */
export function productInquiryHref(input: Parameters<typeof inquiryText>[0]): string | null {
  const number = getWhatsAppNumber();
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(inquiryText(input))}`;
}

/** Canales en orden de prioridad: WhatsApp y teléfono primero. */
export function getContactChannels(): ContactChannel[] {
  const wa = digits(CONTACT.whatsapp);
  const tel = digits(CONTACT.phone);
  return [
    { id: "whatsapp", label: "WhatsApp", href: wa ? `https://wa.me/${wa}` : null, external: true },
    { id: "phone", label: "Llamar", href: tel ? `tel:+${tel}` : null, external: false },
    { id: "instagram", label: "Instagram", href: httpsUrl(CONTACT.instagramUrl), external: true },
    { id: "facebook", label: "Facebook", href: httpsUrl(CONTACT.facebookUrl), external: true },
  ];
}
