import { Suspense } from "react";
import { ContactSection } from "@/components/contact/contact-section";
import { CatalogHero, HeroSearch, HeroSearchSkeleton } from "@/components/catalog/catalog-hero";
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
    <main id="contenido" className="mx-auto max-w-7xl px-4 pt-5 sm:pt-6">
      <CatalogHero>
        <Suspense fallback={<HeroSearchSkeleton />}>
          <HeroSearch searchParams={searchParams} />
        </Suspense>
      </CatalogHero>

      {/* Sin banners vigentes la sección no existe, por eso no hay esqueleto: se ocultaría de golpe. */}
      <Suspense fallback={null}>
        <PromoSection />
      </Suspense>

      <Suspense fallback={<MainCategoriesSkeleton />}>
        <MainCategories searchParams={searchParams} />
      </Suspense>

      <div id="catalogo" className="mt-10 scroll-mt-4 border-t border-brand-line pt-8 sm:mt-12">
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
