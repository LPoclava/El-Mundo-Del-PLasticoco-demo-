import type { Metadata } from "next";
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
import { BenefitsBand } from "@/components/catalog/benefits-band";
import { HeaderSearch } from "@/components/catalog/header-search";
import { HomeFront, HomeFrontSkeleton } from "@/components/catalog/home-front";
import { SearchForm } from "@/components/catalog/search-form";
import { WhatsAppFloat } from "@/components/catalog/whatsapp-float";
import { CATALOG_COPY } from "@/config/catalog-copy";
import { CONTACT } from "@/config/contact";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Datos del local para buscadores: solo lo configurado en src/config/contact.ts. */
const STORE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "El Mundo del Plástico",
  ...(CONTACT.phone ? { telephone: `+${CONTACT.phone.replace(/\D/g, "")}` } : {}),
  ...(CONTACT.address ? { address: { "@type": "PostalAddress", streetAddress: CONTACT.address, addressLocality: CONTACT.locality ?? undefined, addressCountry: "AR" } } : {}),
  ...(CONTACT.facebookUrl ? { sameAs: [CONTACT.facebookUrl] } : {}),
};

/**
 * Portada, de arriba hacia abajo: slider, presentación, categorías, separador, catálogo, beneficios, contacto y
 * formas de pago (la navegación y el pie están en el layout). Cada parte que lee datos o la URL llega por separado.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-3 pt-3 sm:px-4 sm:pt-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STORE_JSON_LD).replace(/</g, "\\u003c") }} />

      <Suspense fallback={<HomeFrontSkeleton />}>
        <HomeFront searchParams={searchParams} />
      </Suspense>

      <section id="catalogo" aria-labelledby="catalogo-titulo" className="mt-8 scroll-mt-4 sm:mt-12">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-10">
          <div>
            <h2 id="catalogo-titulo" className="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance sm:text-4xl">{CATALOG_COPY.catalog.title}</h2>
            <p className="mt-1.5 text-brand-muted text-pretty">{CATALOG_COPY.catalog.subtitle}</p>
          </div>
          {/* El buscador lee la URL en el navegador; mientras tanto se ve igual pero vacío. */}
          <Suspense fallback={<SearchForm />}>
            <HeaderSearch />
          </Suspense>
        </div>

        <div className="mt-5">
          <Suspense fallback={<CatalogControlsSkeleton />}>
            <CatalogControls searchParams={searchParams} />
          </Suspense>
        </div>

        <div className="mt-5">
          <Suspense fallback={<CatalogResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <BenefitsBand />
      <ContactSection />
      <WhatsAppFloat />
    </main>
  );
}
