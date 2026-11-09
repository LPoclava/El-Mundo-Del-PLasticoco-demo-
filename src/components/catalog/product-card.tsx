import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ContactIcon } from "@/components/contact/contact-icon";
import type { CatalogProduct } from "@/types/product";
import { highlightParts } from "@/lib/catalog/highlight";
import { formatPrice } from "@/lib/catalog/url";
import { productPath } from "@/lib/catalog/product";
import { productInquiryHref } from "@/lib/contact";
import { publicSiteUrl } from "@/lib/site-url";
import { LinkPending } from "./link-pending";

type Props = {
  product: CatalogProduct;
  /** Carga la foto de inmediato (primeras tarjetas, visibles sin desplazarse). */
  eager?: boolean;
  /** Texto buscado: se destaca dentro del nombre. */
  highlight?: string;
};

/**
 * Tarjeta de producto: ÚNICA para portada, búsqueda, categorías y relacionados. Toda la tarjeta abre la ficha (el enlace
 * está en el nombre y su área se extiende a toda la tarjeta); el único otro control es la consulta por WhatsApp, que va
 * por encima y abre el chat con el producto y el precio. Con opciones de distinto precio, el mensaje dice «desde».
 *
 * Disponibilidad: no se muestra. La vista pública del catálogo no expone stock y no hay una decisión del negocio
 * para publicarlo; cuando exista el dato real, va entre el nombre y el precio (ver docs del catálogo).
 */
export function ProductCard({ product, eager = false, highlight }: Props) {
  const path = productPath(product);
  const site = publicSiteUrl();
  const inquiry = productInquiryHref({
    name: product.name,
    price: formatPrice(product.price),
    fromPrice: product.hasPriceRange,
    url: site ? new URL(path, site).toString() : null,
  });

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-brand-green/20 bg-brand-card shadow-sm outline-offset-2 [-webkit-tap-highlight-color:transparent] motion-safe:transition motion-safe:duration-200 hover:border-brand-green/40 hover:shadow-md motion-safe:hover:-translate-y-0.5 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-brand-ink">
      {/* Área de imagen uniforme: la foto se ve entera (contain), centrada y sin ampliarse más de lo que su resolución permite. */}
      <div className="relative aspect-[4/3] bg-brand-photo">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1152px) 276px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          quality={90}
          className="object-contain p-2"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-brand-ink">
          <Link
            href={path}
            scroll={false}
            className="outline-none focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {highlightParts(product.name, highlight).map((part, i) =>
              part.match ? <mark key={i} className="search-mark rounded-sm">{part.text}</mark> : part.text,
            )}
            {/* Dentro del enlace: es lo único que le permite enterarse de que la navegación está en curso. */}
            <LinkPending />
          </Link>
        </h3>
        <p className="mb-2.5 mt-1 font-display text-lg font-extrabold tabular-nums text-brand-orange-ink">
          {product.hasPriceRange && <span className="mr-1 font-sans text-xs font-normal text-brand-muted">Desde</span>}
          {formatPrice(product.price)}
        </p>

        <div className="mt-auto space-y-1.5">
        <AddToCartButton product={product} path={path} />
        {inquiry && (
          <a
            href={inquiry}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Consultar por WhatsApp sobre ${product.name}`}
            className="relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-green/50 text-sm font-semibold text-brand-green-ink hover:bg-brand-green/10 active:bg-brand-green/20 motion-safe:transition-colors"
          >
            <ContactIcon id="whatsapp" className="size-5 shrink-0" />
            <span className="min-[43.75rem]:hidden">Consultar</span>
            <span className="hidden min-[43.75rem]:inline">Consultar por WhatsApp</span>
          </a>
        )}
        </div>
      </div>
    </article>
  );
}
