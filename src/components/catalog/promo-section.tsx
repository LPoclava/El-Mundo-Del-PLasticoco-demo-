import { CATALOG_COPY } from "@/config/catalog-copy";
import { getPromoBanners } from "@/lib/catalog/repository";
import { PromoCarousel } from "./promo-carousel";
import { SectionHeading } from "./section-heading";

/**
 * «Promociones y combos», dentro de un marco que las destaca. Sin banners vigentes no se dibuja
 * nada: ni título ni espacio vacío. Lee datos en caché compartida de vida corta (como el resto del
 * catálogo): debe renderizarse dentro de <Suspense>.
 */
export async function PromoSection() {
  const banners = await getPromoBanners();
  if (banners.length === 0) return null;

  return (
    <section
      aria-labelledby="promo-title"
      className="mt-4 sm:mt-8 sm:rounded-2xl sm:border sm:border-brand-line sm:bg-white sm:p-5 sm:shadow-sm"
    >
      <SectionHeading id="promo-title" title={CATALOG_COPY.promotions.title} compact />
      <PromoCarousel banners={banners} />
    </section>
  );
}
