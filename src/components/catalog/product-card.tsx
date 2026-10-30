import Image from "next/image";
import type { CatalogProduct } from "@/types/product";
import { formatPrice } from "@/lib/catalog/url";
import { productInquiryHref } from "@/lib/contact";
import { ContactIcon } from "@/components/contact/contact-icon";

type Props = {
  product: CatalogProduct;
  /** Carga la foto de inmediato (primeras tarjetas, visibles sin desplazarse). */
  eager?: boolean;
};

export function ProductCard({ product, eager = false }: Props) {
  // Sin número comercial configurado no hay botón. Abrir WhatsApp no es una venta ni una consulta enviada.
  const inquiry = productInquiryHref({ name: product.name, price: formatPrice(product.price), fromPrice: product.hasPriceRange });
  return (
    <article className="flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-sand">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
      </div>
      <h3 className="mt-2.5 line-clamp-2 min-h-[2.6em] text-sm leading-snug text-brand-ink">
        {product.name}
      </h3>
      <p className="mb-2 mt-1 text-base font-semibold tabular-nums">
        {product.hasPriceRange && (
          <span className="mr-1 text-xs font-normal text-brand-muted">Desde</span>
        )}
        {formatPrice(product.price)}
      </p>
      {inquiry && (
        <a
          href={inquiry}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Consultar por WhatsApp: ${product.name}`}
          className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-green/50 bg-white px-3 text-sm font-medium text-brand-green-ink hover:bg-brand-green/10 active:bg-brand-green/15 motion-safe:transition-colors"
        >
          <ContactIcon id="whatsapp" className="size-4 shrink-0" />
          Consultar por WhatsApp
        </a>
      )}
    </article>
  );
}
