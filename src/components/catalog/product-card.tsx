import Image from "next/image";
import type { CatalogProduct } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";

type Props = {
  product: CatalogProduct;
  /** Carga la foto de inmediato (primeras tarjetas, visibles sin desplazarse). */
  eager?: boolean;
};

export function ProductCard({ product, eager = false }: Props) {
  return (
    <article>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-sand">
        {/* alt vacío: el nombre del producto está escrito justo debajo. */}
        <Image
          src={product.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
      </div>
      <h3 className="mt-2 line-clamp-2 min-h-[2.6em] text-sm leading-snug text-brand-ink/85">
        {product.name}
      </h3>
      <p className="mt-0.5 text-base font-semibold tabular-nums">
        {product.hasPriceRange && (
          <span className="mr-1 text-xs font-normal text-brand-muted">Desde</span>
        )}
        {formatPrice(product.price)}
      </p>
    </article>
  );
}
