/**
 * Reglas puras de la ficha de producto: URL, variantes y mensaje de consulta.
 * Sin dependencias (se prueban con node --test desde scripts/).
 */

const UUID_AT_END = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const MAX_NAME_PART = 60;

/** Nombre en minúsculas, sin tildes y con guiones: "Balde 10 L Rojo" -> "balde-10-l-rojo". */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= MAX_NAME_PART) return slug;
  const cut = slug.slice(0, MAX_NAME_PART);
  return cut.slice(0, cut.lastIndexOf("-") > 0 ? cut.lastIndexOf("-") : MAX_NAME_PART);
}

/**
 * Segmento de la URL de la ficha: nombre legible + id del producto. El id hace la URL estable (si se
 * cambia el nombre, el enlace viejo sigue llevando al producto y redirige al nuevo) sin agregar columnas.
 */
export function productSlug(product: { id: string; name: string }): string {
  return `${slugify(product.name) || "producto"}-${product.id.toLowerCase()}`;
}

export function productPath(product: { id: string; name: string }): string {
  return `/producto/${productSlug(product)}`;
}

/** Extrae el id del segmento de la URL; null si no tiene la forma esperada. */
export function parseProductSlug(raw: string): string | null {
  let value: string;
  try {
    value = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  if (value.length > MAX_NAME_PART + 50) return null;
  return value.match(UUID_AT_END)?.[1] ?? null;
}

export type VariantFields = { size: string | null; color: string | null };

/** "20 L · Rojo"; null si la variante no tiene medida ni color (variante única). */
export function variantLabel(v: VariantFields): string | null {
  const parts = [v.size?.trim(), v.color?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Con más de una variante el cliente tiene que elegir antes de consultar. */
export function needsSelection(variants: readonly unknown[]): boolean {
  return variants.length > 1;
}

/** Valores distintos de un campo, en el orden en que aparecen. */
export function distinctValues(variants: readonly VariantFields[], field: keyof VariantFields): string[] {
  const seen = new Set<string>();
  for (const v of variants) {
    const value = v[field]?.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

/** Texto de la consulta por WhatsApp. Solo datos reales del producto; la URL identifica el producto. */
export function inquiryText(input: {
  name: string;
  price: string;
  fromPrice?: boolean;
  variant?: string | null;
  url?: string | null;
}): string {
  const product = input.variant ? `${input.name} (${input.variant})` : input.name;
  const lines = [
    `Hola, me interesa el producto ${product}.`,
    `Precio publicado: ${input.fromPrice ? "desde " : ""}${input.price}.`,
  ];
  if (input.url) lines.push(`Link: ${input.url}`);
  lines.push("¿Me podrían confirmar disponibilidad?");
  return lines.join("\n");
}
