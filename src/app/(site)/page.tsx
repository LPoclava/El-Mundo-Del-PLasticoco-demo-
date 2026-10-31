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
import { HomeFront, HomeFrontSkeleton } from "@/components/catalog/home-front";
import { HowToBuy } from "@/components/catalog/how-to-buy";
import { WhatsAppFloat } from "@/components/catalog/whatsapp-float";
import { CATALOG_COPY } from "@/config/catalog-copy";

/**
 * Portada: promociones → categorías → productos, sin bloque de bienvenida (el buscador está en el
 * encabezado). El título de la página queda para lectores de pantalla y buscadores.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">{CATALOG_COPY.hero.title}</h1>

      <Suspense fallback={<HomeFrontSkeleton />}>
        <HomeFront searchParams={searchParams} />
      </Suspense>

      <div id="catalogo" className="scroll-mt-4 border-t border-brand-line pt-6 lg:pt-8">
        <Suspense fallback={<CatalogControlsSkeleton />}>
          <CatalogControls searchParams={searchParams} />
        </Suspense>

        <div className="mt-5">
          <Suspense fallback={<CatalogResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>

      <HowToBuy />
      <ContactSection />
      <WhatsAppFloat />
    </main>
  );
}
