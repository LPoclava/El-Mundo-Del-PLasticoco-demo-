import { BANNER_RATIO } from "@/lib/banners/rules";
import { getPromoBanners } from "@/lib/catalog/repository";
import { PromoCarousel } from "./promo-carousel";

/**
 * Slider principal: solo los banners cargados en el panel, sin títulos ni textos agregados. Sin banners vigentes no se
 * dibuja nada. El nombre de la región lo pone el carrusel: acá no hay título, así el H1 es el primero de la página. Lee
 * datos en caché compartida de vida corta (como el resto del catálogo): debe renderizarse dentro de <Suspense>.
 */
export async function PromoSection() {
  const banners = await getPromoBanners();
  if (banners.length === 0) return null;

  return (
    <div id="promociones" className="min-w-0 scroll-mt-4">
      <PromoCarousel banners={banners} />
    </div>
  );
}

export function PromoSkeleton() {
  return <div aria-hidden className="rounded-2xl bg-brand-sand motion-safe:animate-pulse sm:rounded-3xl" style={{ aspectRatio: BANNER_RATIO }} />;
}
