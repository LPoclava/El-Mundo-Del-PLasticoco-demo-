import type { CatalogProduct } from "@/types/product";
import { ProductCard } from "./product-card";

/** Misma cuadrícula para el listado y su esqueleto de carga. */
export const GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

export function ProductGrid({ products }: { products: CatalogProduct[] }) {
  return (
    <ul className={GRID_CLASS}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < 4} />
        </li>
      ))}
    </ul>
  );
}
