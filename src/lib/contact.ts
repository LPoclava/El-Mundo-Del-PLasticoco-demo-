import { CONTACT } from "@/config/contact";

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
