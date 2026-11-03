import type { ProductDetail } from "@/types/product";
import { distinctValues } from "./product";

/** Características que se muestran de un producto: solo datos cargados, nada supuesto. */
export function productFeatures(product: ProductDetail): [string, string][] {
  const sizes = distinctValues(product.variants, "size");
  const colors = distinctValues(product.variants, "color");
  const features: [string, string][] = [];
  if (product.brand) features.push(["Marca", product.brand]);
  features.push(["Categoría", product.parentCategory ? `${product.parentCategory.name} › ${product.category.name}` : product.category.name]);
  if (sizes.length) features.push([sizes.length > 1 ? "Medidas" : "Medida", sizes.join(", ")]);
  if (colors.length) features.push([colors.length > 1 ? "Colores" : "Color", colors.join(", ")]);
  if (product.variants.length > 1) features.push(["Opciones", `${product.variants.length} disponibles`]);
  return features;
}
