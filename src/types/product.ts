/**
 * Tipos del catálogo público (ver docs/modelo-de-datos.md). La regla de publicación
 * (habilitado + foto principal + al menos una variante con precio) la aplica la base de datos.
 */
export type Category = {
  slug: string;
  name: string;
  /** Slug de la categoría principal si esta es una subcategoría. */
  parentSlug?: string | null;
  /** 1 a 4 en las categorías principales destacadas; null en las demás. */
  featuredPosition?: number | null;
  /** Foto de la tarjeta de categoría; null = se muestra un ícono. */
  imageUrl?: string | null;
};

/** Banner activo del carrusel «Promociones y combos» (vista pública public_promo_banners). */
export type PromoBanner = {
  id: string;
  title: string | null;
  body: string | null;
  badge: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  imageUrl: string;
  imageAlt: string | null;
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
