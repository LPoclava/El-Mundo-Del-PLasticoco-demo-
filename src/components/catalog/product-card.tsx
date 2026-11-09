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
 * Tarjeta de producto: ÚNICA para portada, búsqueda, categorías, relacionados y descubrimiento. La FOTO manda: ocupa la
 * mitad de la tarjeta, se ve entera (contain, sin recortes ni ampliaciones) sobre un fondo neutro y se acerca un poco al
 * apuntarla. Debajo, marca (si existe), nombre y precio con jerarquía. Una línea de corte, como la de un boleto (la
 * identidad de las categorías), separa la información de las acciones: «Agregar» al pedido y la consulta por WhatsApp.
 * Toda la tarjeta abre la ficha (el enlace está en el nombre y su área se extiende a la tarjeta); los botones van por encima.
 *
 * Disponibilidad: no se muestra. La vista pública no expone stock y el negocio no decidió publicarlo.
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
    <article className="product-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-green/20 bg-brand-card shadow-sm outline-offset-2 [-webkit-tap-highlight-color:transparent] motion-safe:transition motion-safe:duration-200 hover:border-brand-green/40 hover:shadow-md motion-safe:hover:-translate-y-0.5 has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-brand-ink">
      {/* La foto es lo principal: altura uniforme, se ve completa y casi sin margen. */}
      <div className="relative aspect-square overflow-hidden bg-brand-photo sm:aspect-[5/4]">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1152px) 276px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          quality={90}
          className="card-photo object-contain p-1.5"
          unoptimized={product.imageUrl.endsWith(".svg")}
          {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
        />
        {product.hasPriceRange && (
          <span className="absolute left-2 top-2 rounded-full bg-brand-charcoal/85 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            Varias opciones
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        {product.brand && <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand-green-ink">{product.brand}</p>}
        <h3 className="line-clamp-2 min-h-[2.6em] text-[0.9375rem] font-semibold leading-snug text-brand-ink">
          <Link
            href={path}
            scroll={false}
            className="outline-none focus-visible:outline-none after:absolute after:inset-0 after:z-0"
          >
            {highlightParts(product.name, highlight).map((part, i) =>
              part.match ? <mark key={i} className="search-mark rounded-sm">{part.text}</mark> : part.text,
            )}
            {/* Dentro del enlace: es lo único que le permite enterarse de que la navegación está en curso. */}
            <LinkPending />
          </Link>
        </h3>
        <p className="mt-1 font-display text-xl font-extrabold leading-none tabular-nums text-brand-orange-ink">
          {product.hasPriceRange && <span className="mr-1 font-sans text-xs font-normal text-brand-muted">Desde</span>}
          {formatPrice(product.price)}
        </p>

        {/* Línea de corte del boleto: separa la información de las acciones. */}
        <div className="-mx-3 mb-2.5 mt-3" aria-hidden>
          <div className="perforation" />
        </div>

        {/* Tarjeta angosta (celulares chicos o texto muy agrandado): los dos botones se apilan y cada uno dice lo que hace. */}
        <div className="relative z-10 mt-auto grid grid-cols-1 gap-2 min-[24rem]:grid-cols-[minmax(0,1fr)_auto]">
          <AddToCartButton product={product} path={path} />
          {inquiry && (
            <a
              href={inquiry}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Consultar por WhatsApp sobre ${product.name}`}
              title="Consultar por WhatsApp"
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-whatsapp text-sm font-semibold text-white hover:bg-whatsapp-hover active:bg-whatsapp-active motion-safe:transition-colors min-[24rem]:w-11"
            >
              <ContactIcon id="whatsapp" className="size-5 shrink-0" />
              <span className="min-[24rem]:hidden">Consultar</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
