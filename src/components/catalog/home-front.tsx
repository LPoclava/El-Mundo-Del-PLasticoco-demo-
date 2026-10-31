import { Suspense } from "react";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/url";
import { MainCategories, MainCategoriesSkeleton } from "./main-categories";
import { PromoSection } from "./promo-section";

/**
 * Parte de arriba de la portada: promociones y categorías. Si hay una búsqueda activa (?q=) no se muestra:
 * los resultados tienen que quedar justo debajo del buscador, sin dos pantallas de por medio. Lee la URL
 * (request-time): debe renderizarse dentro de <Suspense>.
 */
export async function HomeFront({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { q } = parseCatalogParams(await searchParams);
  if (q) return null;
  return (
    // Celular y tablet: promociones arriba y categorías debajo. Escritorio: lado a lado (banner a la izquierda,
    // categorías en 2 × 2 a la derecha). Sin banners vigentes, las categorías ocupan todo el ancho.
    <div className="mb-8 grid items-start gap-6 lg:mb-10 lg:gap-8 lg:has-[>[data-promo]]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      {/* Sin banners vigentes la sección no existe, por eso no hay esqueleto: se ocultaría de golpe. */}
      <Suspense fallback={null}>
        <PromoSection />
      </Suspense>
      <Suspense fallback={<MainCategoriesSkeleton />}>
        <MainCategories searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Reserva el espacio de la parte de arriba mientras se lee la URL (evita que el catálogo salte al cargar). */
export function HomeFrontSkeleton() {
  return (
    <div aria-hidden className="mb-8 grid items-start gap-6 lg:mb-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-8">
      <div className="hidden aspect-[16/7] rounded-xl bg-brand-sand motion-safe:animate-pulse lg:block" />
      <MainCategoriesSkeleton />
    </div>
  );
}
