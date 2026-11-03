import { CATALOG_COPY } from "@/config/catalog-copy";
import { BANNER_RATIO } from "@/lib/banners/rules";
import { getPromoBanners } from "@/lib/catalog/repository";
import { PromoCarousel } from "./promo-carousel";

/**
 * Slider principal: solo los banners cargados en el panel, sin títulos ni textos agregados. Sin banners vigentes no se
 * dibuja nada. Lee datos en caché compartida de vida corta (como el resto del catálogo): debe renderizarse dentro de
 * <Suspense>.
 */
export async function PromoSection() {
  const banners = await getPromoBanners();
  if (banners.length === 0) return null;

  return (
    <section id="promociones" aria-labelledby="promo-title" className="min-w-0 scroll-mt-4">
      <h2 id="promo-title" className="sr-only">{CATALOG_COPY.promotions.title}</h2>
      <PromoCarousel banners={banners} />
    </section>
  );
}

export function PromoSkeleton() {
  return <div aria-hidden className="rounded-2xl bg-brand-sand motion-safe:animate-pulse sm:rounded-3xl" style={{ aspectRatio: BANNER_RATIO }} />;
}
