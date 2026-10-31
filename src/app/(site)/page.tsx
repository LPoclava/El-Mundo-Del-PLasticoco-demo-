import { Suspense } from "react";
import { ContactSection } from "@/components/contact/contact-section";
import {
  CatalogControls,
  CatalogControlsSkeleton,
} from "@/components/catalog/catalog-controls";
import {
  CatalogResults,
  CatalogResultsSkeleton,
} from "@/components/catalog/catalog-results";
import { MainCategories, MainCategoriesSkeleton } from "@/components/catalog/main-categories";
import { PromoSection } from "@/components/catalog/promo-section";
import { CATALOG_COPY } from "@/config/catalog-copy";

/**
 * Portada: promociones → categorías → productos, sin bloque de bienvenida (el buscador está en el
 * encabezado). El título de la página queda para lectores de pantalla y buscadores.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">{CATALOG_COPY.hero.title}</h1>

      {/* Celular y tablet: promociones arriba y categorías debajo. Escritorio: lado a lado (banner a la
          izquierda, categorías en 2 × 2 a la derecha) para que la primera pantalla muestre las dos cosas.
          Sin banners vigentes, las categorías ocupan todo el ancho. */}
      <div className="grid items-start gap-6 lg:gap-8 lg:has-[>[data-promo]]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Sin banners vigentes la sección no existe, por eso no hay esqueleto: se ocultaría de golpe. */}
        <Suspense fallback={null}>
          <PromoSection />
        </Suspense>

        <Suspense fallback={<MainCategoriesSkeleton />}>
          <MainCategories searchParams={searchParams} />
        </Suspense>
      </div>

      <div id="catalogo" className="mt-8 scroll-mt-4 border-t border-brand-line pt-6 lg:mt-10 lg:pt-8">
        <Suspense fallback={<CatalogControlsSkeleton />}>
          <CatalogControls searchParams={searchParams} />
        </Suspense>

        <div className="mt-5">
          <Suspense fallback={<CatalogResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      <ContactSection />
    </main>
  );
}
