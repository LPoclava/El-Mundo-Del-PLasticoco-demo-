import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/product/breadcrumbs";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SectionHeading } from "@/components/catalog/section-heading";
import { getProduct, getRelatedProducts } from "@/lib/catalog/repository";
import { productFeatures } from "@/lib/catalog/features";
import { parseProductSlug, productPath, productSlug } from "@/lib/catalog/product";
import { catalogHref, formatPrice } from "@/lib/catalog/url";
import type { ProductDetail } from "@/types/product";

/** Ficha válida para el segmento de la URL, o null (404). El id manda: el nombre es solo legible. */
async function loadProduct(params: Promise<{ slug: string }>): Promise<{ product: ProductDetail | null; slug: string }> {
  const { slug } = await params;
  const id = parseProductSlug(slug);
  return { product: id ? await getProduct(id) : null, slug };
}

const categoryHref = (slug: string) => `${catalogHref({ category: slug })}#catalogo`;

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { product } = await loadProduct(params);
  if (!product) return { title: "Producto no disponible — El Mundo del Plástico", robots: { index: false } };

  const title = `${product.name} — El Mundo del Plástico`;
  const price = `${product.hasPriceRange ? "Desde " : ""}${formatPrice(product.price)}`;
  const summary = (product.description ?? `${product.name} en ${product.category.name}.`).replace(/\s+/g, " ").slice(0, 140);
  return {
    title,
    description: `${summary} ${price}.`,
    alternates: { canonical: productPath(product) },
    openGraph: {
      type: "website",
      title,
      description: `${price}. ${summary}`,
      url: productPath(product),
      images: [{ url: product.images[0].url, alt: product.name }],
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  const { product, slug } = await loadProduct(params);
  // Inexistente, sin publicar o archivado: la vista pública no lo devuelve.
  if (!product) notFound();
  // Una sola URL por producto: si el nombre cambió (o el enlace llegó distinto), se redirige a la vigente.
  if (safeDecode(slug) !== productSlug(product)) permanentRedirect(productPath(product));

  const back = product.parentCategory ?? product.category;
  const crumbs: Crumb[] = [{ label: "Inicio", href: "/" }];
  if (product.parentCategory) crumbs.push({ label: product.parentCategory.name, href: categoryHref(product.parentCategory.slug) });
  crumbs.push({ label: product.category.name, href: categoryHref(product.category.slug) });
  crumbs.push({ label: product.name });

  const features = productFeatures(product);

  const prices = product.variants.length ? product.variants.map((v) => v.price) : [product.price];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: product.category.name,
    image: product.images.map((i) => i.url),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "ARS",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
    },
  };

  return (
    <main id="contenido" className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-2 grid gap-6 sm:mt-3 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
        <ProductGallery name={product.name} images={product.images} />

        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">{product.name}</h1>

          <div className="mt-4 border-t border-brand-line pt-5">
            <ProductPurchase
              name={product.name}
              path={productPath(product)}
              variants={product.variants}
              price={product.price}
              hasPriceRange={product.hasPriceRange}
            />
          </div>

          {product.description && (
            <section aria-labelledby="descripcion" className="mt-8">
              <h2 id="descripcion" className="text-lg font-semibold">Descripción</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-brand-ink/90 text-pretty">{product.description}</p>
            </section>
          )}

          <section aria-labelledby="caracteristicas" className="mt-8">
            <h2 id="caracteristicas" className="text-lg font-semibold">Características</h2>
            <dl className="mt-2 divide-y divide-brand-line rounded-xl border border-brand-line bg-surface text-sm">
              {features.map(([term, value]) => (
                <div key={term} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[8rem_1fr]">
                  <dt className="text-brand-muted">{term}</dt>
                  <dd className="min-w-0 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Link
            href={categoryHref(back.slug)}
            className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Volver a {back.name}
          </Link>
        </div>
      </div>

      {/* Los relacionados llegan aparte: la ficha se muestra sin esperarlos. */}
      <Suspense fallback={null}>
        <RelatedProducts product={product} category={back} />
      </Suspense>
    </main>
  );
}

async function RelatedProducts({ product, category }: { product: ProductDetail; category: { slug: string; name: string } }) {
  const related = await getRelatedProducts(product);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="relacionados" className="mt-12 border-t border-brand-line pt-8">
      <SectionHeading id="relacionados" title={`Más de ${category.name}`} />
      <ProductGrid products={related} />
      <Link
        href={categoryHref(category.slug)}
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-ink px-5 text-sm font-medium text-white hover:bg-brand-ink/85"
      >
        Ver todo {category.name}
      </Link>
    </section>
  );
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}
