import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";
import { productPath } from "@/lib/catalog/product";

type Props = {
  product: CatalogProduct;
  /** Carga la foto de inmediato (primeras tarjetas, visibles sin desplazarse). */
  eager?: boolean;
};

/**
 * Tarjeta del catálogo. Toda la tarjeta lleva a la ficha del producto: el enlace está en el nombre y
 * su área se extiende a la tarjeta completa (una sola parada de teclado, foto incluida). La consulta
 * por WhatsApp está en la ficha, donde se elige la variante.
 */
export function ProductCard({ product, eager = false }: Props) {
  return (
    <article className="group relative flex h-full flex-col rounded-lg motion-safe:transition-transform motion-safe:active:scale-[0.98] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand-ink">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-sand">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
      </div>
      <h3 className="mt-2.5 line-clamp-2 min-h-[2.6em] text-sm leading-snug text-brand-ink">
        <Link href={productPath(product)} className="outline-none focus-visible:outline-none after:absolute after:inset-0 after:rounded-lg group-hover:underline group-hover:underline-offset-2">
          {product.name}
        </Link>
      </h3>
      <p className="mb-2 mt-1 text-base font-semibold tabular-nums">
        {product.hasPriceRange && (
          <span className="mr-1 text-xs font-normal text-brand-muted">Desde</span>
        )}
        {formatPrice(product.price)}
      </p>
      <span
        aria-hidden
        className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-sm font-medium text-brand-ink group-hover:border-brand-ink motion-safe:transition-colors"
      >
        Ver producto
        <svg viewBox="0 0 24 24" className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </article>
  );
}
