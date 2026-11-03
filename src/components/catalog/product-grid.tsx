import type { CatalogProduct } from "@/types/product";
import { ProductCard } from "./product-card";

/** Misma cuadrícula para el listado y su esqueleto de carga. */
export const GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

export function ProductGrid({ products, highlight }: {
  products: CatalogProduct[];
  /** Texto buscado: se destaca en el nombre de cada producto. */
  highlight?: string;
}) {
  return (
    <ul className={GRID_CLASS}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < 4} highlight={highlight} />
        </li>
      ))}
    </ul>
  );
}
