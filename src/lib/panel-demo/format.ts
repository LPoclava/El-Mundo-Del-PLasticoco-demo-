import type { AuditAction } from "./types";

export { formatPrice } from "@/lib/catalog/url";

// Zona horaria fija: el servidor y el navegador deben mostrar lo mismo.
const TZ = "America/Argentina/Buenos_Aires";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: TZ });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
/** AAAA-MM-DD en hora argentina, para comparar con <input type="date">. */
export const toDayKey = (iso: string) => dayKey.format(new Date(iso));

export const ACTION_LABEL: Record<AuditAction, string> = {
  price: "Cambio de precio",
  create: "Alta de producto",
  link: "Vinculación de código",
  publish: "Publicación",
  unpublish: "Despublicación",
  archive: "Archivado",
  unarchive: "Desarchivado",
  edit: "Edición de producto",
  category: "Categorías",
  user: "Usuarios y roles",
};

export const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
