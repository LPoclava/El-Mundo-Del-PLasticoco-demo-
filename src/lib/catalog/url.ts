import type { CatalogQuery } from "./repository";

export type RawParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Convierte searchParams crudos en una consulta saneada. */
export function parseCatalogParams(params: RawParams): CatalogQuery {
  const q = first(params.q)?.trim().slice(0, 80) || undefined;
  const category = first(params.categoria)?.trim() || undefined;
  const page = Number.parseInt(first(params.pagina) ?? "1", 10);
  return { q, category, page: Number.isFinite(page) && page > 0 ? page : 1 };
}

/** Arma la URL del catálogo omitiendo valores vacíos. */
export function catalogHref(query: CatalogQuery): string {
  const sp = new URLSearchParams();
  if (query.q) sp.set("q", query.q);
  if (query.category) sp.set("categoria", query.category);
  if (query.page && query.page > 1) sp.set("pagina", String(query.page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}
