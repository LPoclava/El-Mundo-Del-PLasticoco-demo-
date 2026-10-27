/**
 * Modelo de producto acordado (ver docs/modelo-de-datos.md).
 * Un producto tiene variantes (tamaño/color) con su propio precio, hasta 5 fotos
 * (una principal), y datos de identificación a nivel producto.
 */
export type Category = {
  slug: string;
  name: string;
};

export type ProductImage = {
  url: string;
  isPrimary: boolean;
};

export type ProductVariant = {
  id: string;
  size: string | null;
  color: string | null;
  /** Precio manual en pesos; null si todavía no fue cargado. */
  price: number | null;
};

/** Producto tal como se guardaría en la base de datos (puede estar incompleto). */
export type Product = {
  id: string;
  name: string;
  categorySlug: string;
  description: string | null;
  brand: string | null;
  /** Código interno del negocio. */
  sku: string | null;
  /** Código de barras del producto (único); lo usará la consulta de precios. */
  barcode: string | null;
  /** Habilitación explícita para publicar. */
  publishEnabled: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
};

export const MAX_IMAGES_PER_PRODUCT = 5;

/** Vista pública derivada: solo existe si el producto cumple la regla de publicación. */
export type CatalogProduct = Pick<Product, "id" | "name" | "categorySlug" | "brand"> & {
  imageUrl: string;
  /** Menor precio válido entre las variantes. */
  price: number;
  /** true si las variantes tienen precios distintos (se muestra "Desde"). */
  hasPriceRange: boolean;
};
