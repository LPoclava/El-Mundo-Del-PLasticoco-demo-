import { Suspense } from "react";
import { parseCatalogParams, type RawParams } from "@/lib/catalog/url";
import { BusinessIntro } from "./business-intro";
import { CategoryTickets, CategoryTicketsSkeleton } from "./category-tickets";
import { PromoSection, PromoSkeleton } from "./promo-section";

/**
 * Parte de arriba de la portada: slider, presentación y categorías. Con una búsqueda activa (?q=) no se muestra: los
 * resultados quedan justo debajo de la navegación. Lee la URL (request-time): debe renderizarse dentro de <Suspense>.
 */
export async function HomeFront({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { q } = parseCatalogParams(await searchParams);
  if (q) return <h1 className="sr-only">Resultados de búsqueda en El Mundo del Plástico</h1>;
  return (
    <>
      <Suspense fallback={<PromoSkeleton />}>
        <PromoSection />
      </Suspense>
      <BusinessIntro />
      <Suspense fallback={<CategoryTicketsSkeleton />}>
        <CategoryTickets searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Reserva el espacio de la parte de arriba mientras se lee la URL (evita que el catálogo salte al cargar). */
export function HomeFrontSkeleton() {
  return (
    <div aria-hidden>
      <PromoSkeleton />
      <CategoryTicketsSkeleton />
    </div>
  );
}
