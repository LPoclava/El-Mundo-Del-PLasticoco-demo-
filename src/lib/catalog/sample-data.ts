import type { Category, Product, ProductVariant } from "@/types/product";

/**
 * DATOS DE EJEMPLO — NO SON PRODUCTOS, PRECIOS NI CÓDIGOS REALES DEL NEGOCIO.
 * Se reemplazan por Supabase; ver repository.ts.
 */
export const SAMPLE_CATEGORIES: Category[] = [
  { slug: "categoria-a", name: "Categoría A (ejemplo)" },
  { slug: "categoria-b", name: "Categoría B (ejemplo)" },
  { slug: "categoria-c", name: "Categoría C (ejemplo)" },
  { slug: "categoria-d", name: "Categoría D (ejemplo)" },
];

const PLACEHOLDER_IMAGE = "/placeholder-producto.svg";
const IMAGES = [{ url: PLACEHOLDER_IMAGE, isPrimary: true }];
const BRANDS = ["Marca de ejemplo A", "Marca de ejemplo B", null];

function variantsFor(n: number, base: number): ProductVariant[] {
  const id = (s: string) => `ejemplo-${n}-${s}`;
  if (n % 3 === 0) {
    // Tamaños con precios distintos: se muestra "Desde".
    return [
      { id: id("chico"), size: "Chico", color: null, price: base },
      { id: id("grande"), size: "Grande", color: null, price: base + 500 },
    ];
  }
  if (n % 3 === 2) {
    // Colores con el mismo precio: se muestra el precio directo.
    return [
      { id: id("a"), size: null, color: "Color A", price: base },
      { id: id("b"), size: null, color: "Color B", price: base },
    ];
  }
  return [{ id: id("unica"), size: null, color: null, price: base }];
}

const published: Product[] = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  return {
    id: `ejemplo-${n}`,
    name: `Producto de ejemplo ${String(n).padStart(2, "0")}`,
    categorySlug: SAMPLE_CATEGORIES[i % SAMPLE_CATEGORIES.length].slug,
    description: null,
    brand: BRANDS[i % BRANDS.length],
    sku: `EJ-${String(n).padStart(4, "0")}`,
    barcode: null,
    publishEnabled: true,
    images: IMAGES,
    variants: variantsFor(n, 1000 + n * 250),
  };
});

const hiddenBase = {
  description: null,
  brand: null,
  sku: null,
  barcode: null,
  publishEnabled: true,
  images: IMAGES,
  variants: [{ id: "v", size: null, color: null, price: 2000 }] as ProductVariant[],
};

/** Casos que NO deben aparecer: demuestran la regla de publicación. */
const hidden: Product[] = [
  {
    ...hiddenBase,
    id: "ejemplo-sin-precio",
    name: "Producto de ejemplo sin precio",
    categorySlug: "categoria-a",
    variants: [{ id: "v", size: null, color: null, price: null }],
  },
  {
    ...hiddenBase,
    id: "ejemplo-sin-foto",
    name: "Producto de ejemplo sin foto",
    categorySlug: "categoria-b",
    images: [],
  },
  {
    ...hiddenBase,
    id: "ejemplo-deshabilitado",
    name: "Producto de ejemplo deshabilitado",
    categorySlug: "categoria-c",
    publishEnabled: false,
  },
];

export const SAMPLE_PRODUCTS: Product[] = [...published, ...hidden];
