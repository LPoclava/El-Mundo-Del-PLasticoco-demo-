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

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-4 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Catálogo de productos
      </h1>
      <span aria-hidden className="mt-2 block h-0.5 w-8 bg-brand-orange" />

      <div className="mt-5">
        <Suspense fallback={<CatalogControlsSkeleton />}>
          <CatalogControls searchParams={searchParams} />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<CatalogResultsSkeleton />}>
          <CatalogResults searchParams={searchParams} />
        </Suspense>
      </div>

      <ContactSection />
    </main>
  );
}
