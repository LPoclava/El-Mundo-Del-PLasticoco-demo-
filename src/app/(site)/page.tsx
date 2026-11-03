import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactIcon } from "@/components/contact/contact-icon";
import {
  CatalogControls,
  CatalogControlsSkeleton,
} from "@/components/catalog/catalog-controls";
import {
  CatalogResults,
  CatalogResultsSkeleton,
} from "@/components/catalog/catalog-results";
import { BenefitsBand } from "@/components/catalog/benefits-band";
import { HomeFront, HomeFrontSkeleton } from "@/components/catalog/home-front";
import { WhatsAppFloat } from "@/components/catalog/whatsapp-float";
import { CATALOG_COPY } from "@/config/catalog-copy";
import { CONTACT } from "@/config/contact";
import { publicSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = publicSiteUrl() ? { alternates: { canonical: "/" } } : {};

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
 * Portada, de arriba hacia abajo: slider, presentación, categorías, catálogo y beneficios. La navegación y el pie, que
 * reúne contacto, ubicación y formas de pago, están en el layout. Cada parte que lee datos o la URL llega por separado.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main id="contenido" className="mx-auto max-w-6xl px-3 pt-3 sm:px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STORE_JSON_LD).replace(/</g, "\\u003c") }} />

      <div id="inicio">
        <Suspense fallback={<HomeFrontSkeleton />}>
          <HomeFront searchParams={searchParams} />
        </Suspense>
      </div>

      <section id="catalogo" aria-labelledby="catalogo-titulo" className="mt-7 scroll-mt-4 sm:mt-9">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <h2 id="catalogo-titulo" className="font-display text-2xl font-extrabold sm:text-[1.75rem]">{CATALOG_COPY.catalog.title}</h2>
          <p className="flex items-start gap-2 text-sm text-brand-muted text-pretty sm:items-center sm:text-[0.95rem]">
            <ContactIcon id="whatsapp" className="mt-0.5 size-5 shrink-0 text-brand-green-ink sm:mt-0" />
            {CATALOG_COPY.catalog.howToBuy}
          </p>
        </div>

        <div className="mt-3">
          <Suspense fallback={<CatalogControlsSkeleton />}>
            <CatalogControls searchParams={searchParams} />
          </Suspense>
        </div>

        <div className="mt-2">
          <Suspense fallback={<CatalogResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      <BenefitsBand />
      <WhatsAppFloat />
    </main>
  );
}
