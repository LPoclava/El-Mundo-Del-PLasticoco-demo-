/**
 * Reglas de los banners promocionales, compartidas por el catálogo público y el panel.
 * Reflejan las restricciones de la tabla promo_banners (supabase/migrations/20261030000001...),
 * que son la protección real: estas sirven para dar mensajes claros antes de llegar a la base.
 * Sin dependencias de React ni de Supabase: se prueban con node --test.
 */

export const BANNER_LIMITS = {
  title: 80,
  body: 240,
  badge: 24,
  cta: 30,
  alt: 140,
  link: 500,
} as const;

/** Proporción única de todos los banners (ancho / alto) y tolerancia al subir una imagen. */
export const BANNER_RATIO = 16 / 7;
export const BANNER_RATIO_MIN = 2.0;
export const BANNER_RATIO_MAX = 2.6;
export const BANNER_RECOMMENDED_SIZE = "1600 × 700 px";
export const BANNER_MIN_WIDTH = 800;
/** Arte para celular (opcional): más alto que el apaisado, para que el texto se lea en una pantalla angosta. */
export const BANNER_MOBILE_RATIO = 4 / 3;
export const BANNER_MOBILE_RECOMMENDED_SIZE = "1200 × 900 px";
export const BANNER_MOBILE_MIN_WIDTH = 600;
export const BANNER_MOBILE_MAX_OUTPUT_WIDTH = 1200;
/** Se reduce al subir: más ancho no mejora la imagen en pantalla y pesa más. */
export const BANNER_MAX_OUTPUT_WIDTH = 1920;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const AUTOPLAY_MS = 10_000;

/** Ruta interna ("/", "/?categoria=cocina") o https. Descarta javascript:, http:, "//dominio" y espacios. */
export function isSafeBannerLink(value: string): boolean {
  if (value.length === 0 || value.length > BANNER_LIMITS.link) return false;
  if (/\s/.test(value)) return false;
  if (value.startsWith("/")) return value === "/" || !/^\/[/\\]/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function isExternalLink(value: string): boolean {
  return !value.startsWith("/");
}

export type BannerStatus = "active" | "scheduled" | "expired" | "inactive";

export const STATUS_LABEL: Record<BannerStatus, string> = {
  active: "Activo",
  scheduled: "Programado",
  expired: "Vencido",
  inactive: "Inactivo",
};

type Schedule = { isActive: boolean; startsAt: string | null; endsAt: string | null };

/** Misma regla que la vista pública public_promo_banners. */
export function bannerStatus(b: Schedule, now: number): BannerStatus {
  if (!b.isActive) return "inactive";
  if (b.startsAt && Date.parse(b.startsAt) > now) return "scheduled";
  if (b.endsAt && Date.parse(b.endsAt) <= now) return "expired";
  return "active";
}

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "El archivo debe ser una imagen JPG, PNG o WebP.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "La imagen pesa más de 5 MB. Probá con una más liviana.";
  }
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export function validateImageSize(width: number, height: number): string | null {
  if (!(width > 0 && height > 0)) return "No se pudo leer el tamaño de la imagen.";
  if (width < BANNER_MIN_WIDTH) {
    return `La imagen es muy chica (${width} px de ancho). Usá al menos ${BANNER_MIN_WIDTH} px; lo ideal es ${BANNER_RECOMMENDED_SIZE}.`;
  }
  const ratio = width / height;
  if (ratio < BANNER_RATIO_MIN || ratio > BANNER_RATIO_MAX) {
    return `La proporción no es la de un banner (${width} × ${height}). Tiene que ser apaisada, de unos ${BANNER_RECOMMENDED_SIZE}, para que no se recorte nada.`;
  }
  return null;
}

/** Imagen del banner para celular: no se recorta, así que la proporción tiene que ser la del espacio que ocupa. */
export function validateBannerMobileSize(width: number, height: number): string | null {
  if (!(width > 0 && height > 0)) return "No se pudo leer el tamaño de la imagen.";
  if (width < BANNER_MOBILE_MIN_WIDTH) {
    return `La imagen para celular es muy chica (${width} px de ancho). Usá al menos ${BANNER_MOBILE_MIN_WIDTH} px; lo ideal es ${BANNER_MOBILE_RECOMMENDED_SIZE}.`;
  }
  const ratio = width / height;
  if (ratio < 1.2 || ratio > 1.45) {
    return `La proporción no sirve para celular (${width} × ${height}). Tiene que ser de unos ${BANNER_MOBILE_RECOMMENDED_SIZE}, para que no se recorte nada.`;
  }
  return null;
}

/** Foto de la tarjeta de categoría (se muestra en 5:4 o 4:3): proporción más cuadrada que el banner. */
export const CATEGORY_RECOMMENDED_SIZE = "1200 × 900 px";

export function validateCategoryImageSize(width: number, height: number): string | null {
  if (!(width > 0 && height > 0)) return "No se pudo leer el tamaño de la imagen.";
  if (width < 600) {
    return `La imagen es muy chica (${width} px de ancho). Usá al menos 600 px; lo ideal es ${CATEGORY_RECOMMENDED_SIZE}.`;
  }
  const ratio = width / height;
  if (ratio < 1.1 || ratio > 1.6) {
    return `La proporción no sirve para una tarjeta (${width} × ${height}). Usá una imagen apenas apaisada, de unos ${CATEGORY_RECOMMENDED_SIZE}.`;
  }
  return null;
}

/** Foto de producto: se muestra cuadrada en el catálogo (object-cover), por eso se pide casi cuadrada. */
export const PRODUCT_RECOMMENDED_SIZE = "1000 × 1000 px";
/** Ancho mínimo recomendado: por debajo, la foto se ve borrosa en la ficha (se avisa, no se bloquea). */
export const PRODUCT_MIN_WIDTH = 800;
/** Ancho por debajo del cual la foto no sirve ni de excepción (se rechaza). */
export const PRODUCT_HARD_MIN_WIDTH = 300;
export const PRODUCT_MAX_OUTPUT_WIDTH = 1600;
export const PRODUCT_MAX_IMAGES = 5;

/**
 * Aviso (no bloquea) para fotos de menos de PRODUCT_MIN_WIDTH: se aceptan como excepción, pero en la ficha del
 * producto se van a ver con menos nitidez porque nadie puede recuperar el detalle que la foto no tiene.
 */
export function productImageWarning(width: number, height: number): string | null {
  if (Math.max(width, height) >= PRODUCT_MIN_WIDTH) return null;
  return `La foto es de ${width} × ${height} px, menos de los ${PRODUCT_MIN_WIDTH} px recomendados: se va a ver con menos nitidez en la ficha del producto. Si podés, subí una más grande (lo ideal es ${PRODUCT_RECOMMENDED_SIZE}).`;
}

export function validateProductImageSize(width: number, height: number): string | null {
  if (!(width > 0 && height > 0)) return "No se pudo leer el tamaño de la imagen.";
  if (width < PRODUCT_HARD_MIN_WIDTH || height < PRODUCT_HARD_MIN_WIDTH * 0.6) {
    return `La imagen es muy chica (${width} × ${height} px) y no se puede usar. Usá una de al menos ${PRODUCT_MIN_WIDTH} px de ancho; lo ideal es ${PRODUCT_RECOMMENDED_SIZE}.`;
  }
  const ratio = width / height;
  if (ratio < 0.7 || ratio > 1.5) {
    return `La proporción no sirve para una foto de producto (${width} × ${height}). Usá una imagen casi cuadrada, de unos ${PRODUCT_RECOMMENDED_SIZE}, para que el catálogo no la recorte.`;
  }
  return null;
}

export type BannerFormValues = {
  title: string;
  body: string;
  badge: string;
  ctaLabel: string;
  linkUrl: string;
  imageAlt: string;
  startsAt: string;
  endsAt: string;
  hasImage: boolean;
};

export type BannerFormErrors = Partial<Record<keyof BannerFormValues, string>>;

function tooLong(value: string, max: number, label: string): string | undefined {
  return value.trim().length > max ? `${label}: máximo ${max} caracteres.` : undefined;
}

/** `startsAt` y `endsAt` son valores de <input type="datetime-local"> o vacío. */
export function validateBannerForm(v: BannerFormValues): BannerFormErrors {
  const errors: BannerFormErrors = {};
  if (!v.hasImage) errors.hasImage = "Elegí una imagen para el banner.";

  const title = tooLong(v.title, BANNER_LIMITS.title, "El título");
  if (title) errors.title = title;
  const body = tooLong(v.body, BANNER_LIMITS.body, "El texto");
  if (body) errors.body = body;
  const badge = tooLong(v.badge, BANNER_LIMITS.badge, "La etiqueta");
  if (badge) errors.badge = badge;
  const cta = tooLong(v.ctaLabel, BANNER_LIMITS.cta, "El texto del botón");
  if (cta) errors.ctaLabel = cta;
  const alt = tooLong(v.imageAlt, BANNER_LIMITS.alt, "La descripción de la imagen");
  if (alt) errors.imageAlt = alt;

  const link = v.linkUrl.trim();
  if (link && !isSafeBannerLink(link)) {
    errors.linkUrl = "El enlace tiene que empezar con / (una página de este sitio) o con https://.";
  }
  if (v.ctaLabel.trim() && !link) {
    errors.ctaLabel = "Para mostrar un botón hace falta un enlace de destino.";
  }

  const start = v.startsAt ? Date.parse(v.startsAt) : null;
  const end = v.endsAt ? Date.parse(v.endsAt) : null;
  if (start !== null && Number.isNaN(start)) errors.startsAt = "La fecha de inicio no es válida.";
  if (end !== null && Number.isNaN(end)) errors.endsAt = "La fecha de fin no es válida.";
  if (start !== null && end !== null && !Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
    errors.endsAt = "La fecha de fin tiene que ser posterior a la de inicio.";
  }
  return errors;
}

/** Valor para <input type="datetime-local"> (hora local) a partir de un ISO. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO UTC a partir de un valor datetime-local (hora local del navegador); null si está vacío. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Índice siguiente o anterior con vuelta al principio/final. */
export function stepIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  return (current + direction + count) % count;
}

/** Deslizamiento horizontal: devuelve 1 (siguiente), -1 (anterior) o 0 si fue vertical o muy corto. */
export function swipeDirection(dx: number, dy: number, threshold = 40): 1 | -1 | 0 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}
