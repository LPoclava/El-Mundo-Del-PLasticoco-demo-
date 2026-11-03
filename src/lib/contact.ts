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

/**
 * Enlace de WhatsApp con un mensaje general (sin producto). Solo abre el chat. null si no hay número configurado.
 */
export function generalInquiryHref(text: string): string | null {
  const number = getWhatsAppNumber();
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** «Cómo llegar»: abre Google Maps con la dirección configurada. null si no hay dirección. */
export function getMapsHref(): string | null {
  const place = [CONTACT.address, CONTACT.locality].map((p) => p?.trim()).filter(Boolean).join(", ");
  if (!CONTACT.address?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** Número legible para mostrar: sin código de país y agrupado (2902 40-4916). */
export function formatPhone(value: string | null): string | null {
  const d = digits(value);
  if (!d) return null;
  const local = d.replace(/^549?/, "");
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 6)}-${local.slice(6)}` : local;
}

/** Colores de cada plataforma sobre los que el ícono se lee bien. */
export const CHANNEL_TILE: Record<ContactChannelId, string> = {
  whatsapp: "bg-[#128c7e] text-white",
  facebook: "bg-[#1877f2] text-white",
  phone: "bg-brand-orange text-brand-charcoal",
  instagram: "bg-[#c13584] text-white",
};

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
