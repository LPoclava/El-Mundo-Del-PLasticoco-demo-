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

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-4 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Catálogo de productos
      </h1>
      <span aria-hidden className="mt-2 block h-0.5 w-8 bg-brand-orange" />

      {/* Sin banners vigentes la sección no existe, por eso no hay esqueleto: se ocultaría de golpe. */}
      <Suspense fallback={null}>
        <PromoSection />
      </Suspense>

      <Suspense fallback={<MainCategoriesSkeleton />}>
        <MainCategories searchParams={searchParams} />
      </Suspense>

      <div id="catalogo" className="mt-8 scroll-mt-4">
        <Suspense fallback={<CatalogControlsSkeleton />}>
          <CatalogControls searchParams={searchParams} />
        </Suspense>

        <div className="mt-6">
          <Suspense fallback={<CatalogResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      <ContactSection />
    </main>
  );
}
