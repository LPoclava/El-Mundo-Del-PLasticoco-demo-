import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";
import { productPath } from "@/lib/catalog/product";
import { LinkPending } from "./link-pending";

type Props = {
  product: CatalogProduct;
  /** Carga la foto de inmediato (primeras tarjetas, visibles sin desplazarse). */
  eager?: boolean;
};

/**
 * Tarjeta de producto: ÚNICA para portada, búsqueda, categorías y relacionados. Toda la tarjeta es el enlace a
 * la ficha (el enlace está en el nombre y su área se extiende a toda la tarjeta: una sola parada de teclado).
 * «Ver producto» es solo un indicador visual, no un segundo enlace. La consulta por WhatsApp está en la ficha.
 *
 * Disponibilidad: no se muestra. La vista pública del catálogo no expone stock y no hay una decisión del negocio
 * para publicarlo; cuando exista el dato real, va entre el nombre y el precio (ver docs del catálogo).
 */
export function ProductCard({ product, eager = false }: Props) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-brand-green/20 bg-brand-card shadow-sm outline-offset-2 [-webkit-tap-highlight-color:transparent] motion-safe:transition motion-safe:duration-200 hover:border-brand-green/40 hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.985] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-brand-ink">
      {/* Área de imagen uniforme: la foto se ve entera (contain), centrada y sin ampliarse más de lo que su resolución permite. */}
      <div className="relative aspect-square bg-brand-photo">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          quality={90}
          className="object-contain p-2"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.75em] text-sm font-medium leading-snug text-brand-ink">
          <Link
            href={productPath(product)}
            scroll={false}
            className="outline-none focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-lg font-semibold tabular-nums text-brand-orange-ink">
          {product.hasPriceRange && <span className="mr-1 text-xs font-normal text-brand-muted">Desde</span>}
          {formatPrice(product.price)}
        </p>

        <div className="mt-2.5 border-t border-brand-line pt-2.5">
          <span
            aria-hidden
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-green/10 text-sm font-medium text-brand-green-ink motion-safe:transition-colors group-hover:bg-brand-green/15"
          >
            Ver producto
            <svg viewBox="0 0 24 24" className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
      <LinkPending />
    </article>
  );
}
