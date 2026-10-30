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
  /** Texto breve de la categoría (editable desde el panel). */
  description?: string | null;
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

/** Variante pública: solo las que tienen precio (vista public_product_variants). */
export type ProductVariant = {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
};

/** Ficha de un producto publicado. Nunca incluye stock, SKU ni código de barras. */
export type ProductDetail = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  category: { slug: string; name: string };
  /** Categoría principal cuando el producto está en una subcategoría; null si ya es la principal. */
  parentCategory: { slug: string; name: string } | null;
  /** Primero la foto principal; hasta 5. */
  images: { url: string; isPrimary: boolean }[];
  /** Vacío solo si la base todavía no tiene la vista de variantes (se muestra el precio general). */
  variants: ProductVariant[];
  price: number;
  hasPriceRange: boolean;
};
