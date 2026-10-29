import { getPromoBanners } from "@/lib/catalog/repository";
import { PromoCarousel } from "./promo-carousel";

/**
 * «Promociones y combos». Sin banners vigentes no se dibuja nada: ni título ni espacio vacío.
 * Lee datos en caché compartida de vida corta (como el resto del catálogo): debe renderizarse
 * dentro de <Suspense>.
 */
export async function PromoSection() {
  const banners = await getPromoBanners();
  if (banners.length === 0) return null;

  return (
    <section aria-labelledby="promo-title" className="mt-5">
      <h2 id="promo-title" className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">
        Promociones y combos
      </h2>
      <PromoCarousel banners={banners} />
    </section>
  );
}
