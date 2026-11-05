import type { CatalogProduct } from "@/types/product";
import { ProductCard } from "./product-card";

/**
 * Con pocos productos las tarjetas no se estiran ni dejan un hueco de un lado: mantienen su tamaño y quedan centradas.
 * El corte en rem hace que, con el texto del navegador muy agrandado en un celular, pasen a una columna.
 */
export function gridClass(count: number): string {
  const base = "grid gap-3 sm:gap-4";
  if (count === 1) return `${base} grid-cols-[minmax(0,18.5rem)] justify-center`;
  if (count === 2) return `${base} grid-cols-1 min-[18rem]:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,18.5rem))] md:justify-center`;
  if (count === 3) return `${base} grid-cols-1 min-[18rem]:grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,18.5rem))] lg:justify-center`;
  return `${base} grid-cols-1 min-[18rem]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`;
}

/** Tarjetas que aterrizan una detrás de otra; el resto llega junto con la última. */
const LANDING_STAGGER = 7;

export function ProductGrid({ products, highlight }: {
  products: CatalogProduct[];
  /** Texto buscado: se destaca en el nombre de cada producto. */
  highlight?: string;
}) {
  return (
    // La clave cambia con la lista: un filtro, una búsqueda o una página nueva vuelven a hacer aterrizar las tarjetas.
    <ul key={products.map((p) => p.id).join()} className={gridClass(products.length)}>
      {products.map((p, i) => (
        <li key={p.id} className="card-land" style={{ "--i": Math.min(i, LANDING_STAGGER) } as React.CSSProperties}>
          <ProductCard product={p} eager={i < 4} highlight={highlight} />
        </li>
      ))}
    </ul>
  );
}
