/**
 * Tipos del catálogo público (ver docs/modelo-de-datos.md). La regla de publicación
 * (habilitado + foto principal + al menos una variante con precio) la aplica la base de datos.
 */
export type Category = {
  slug: string;
  name: string;
};

/** Fila de la vista pública public_catalog, lista para mostrar. */
export type CatalogProduct = {
  id: string;
  name: string;
  categorySlug: string;
  brand: string | null;
  imageUrl: string;
  /** Menor precio válido entre las variantes. */
  price: number;
  /** true si las variantes tienen precios distintos (se muestra "Desde"). */
  hasPriceRange: boolean;
};
