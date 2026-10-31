import { CATALOG_COPY } from "@/config/catalog-copy";
import { getPromoBanners } from "@/lib/catalog/repository";
import { PromoCarousel } from "./promo-carousel";
import { SectionHeading } from "./section-heading";

/**
 * «Promociones y combos»: solo los banners, sin marco ni textos agregados. Sin banners vigentes no se dibuja
 * nada: ni título ni espacio vacío. Lee datos en caché compartida de vida corta (como el resto del
 * catálogo): debe renderizarse dentro de <Suspense>.
 */
export async function PromoSection() {
  const banners = await getPromoBanners();
  if (banners.length === 0) return null;

  return (
    <section data-promo aria-labelledby="promo-title" className="min-w-0">
      <SectionHeading id="promo-title" title={CATALOG_COPY.promotions.title} compact />
      <PromoCarousel banners={banners} />
    </section>
  );
}
