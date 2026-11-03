import type { CatalogProduct } from "@/types/product";
import { ProductCard } from "./product-card";

/** Con pocos productos las tarjetas no se estiran ni dejan un hueco de un lado: mantienen su tamaño y quedan centradas. */
export function gridClass(count: number): string {
  const base = "grid gap-3 sm:gap-4";
  if (count === 1) return `${base} grid-cols-[minmax(0,18.5rem)] justify-center`;
  if (count === 2) return `${base} grid-cols-2 md:grid-cols-[repeat(2,minmax(0,18.5rem))] md:justify-center`;
  if (count === 3) return `${base} grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,18.5rem))] lg:justify-center`;
  return `${base} grid-cols-2 md:grid-cols-3 lg:grid-cols-4`;
}

export function ProductGrid({ products, highlight }: {
  products: CatalogProduct[];
  /** Texto buscado: se destaca en el nombre de cada producto. */
  highlight?: string;
}) {
  return (
    <ul className={gridClass(products.length)}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} eager={i < 4} highlight={highlight} />
        </li>
      ))}
    </ul>
  );
}
