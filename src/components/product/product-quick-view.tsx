import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { getProduct } from "@/lib/catalog/repository";
import { productFeatures } from "@/lib/catalog/features";
import { MODAL_TITLE_ID, parseProductSlug, productPath } from "@/lib/catalog/product";

/**
 * Contenido de la ventana flotante: los mismos datos reales de la ficha (galería, descripción, precio, variantes,
 * WhatsApp), sin migas ni relacionados. Un producto inexistente, sin publicar o archivado muestra un aviso.
 */
export async function ProductQuickView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = parseProductSlug(slug);
  const product = id ? await getProduct(id) : null;

  if (!product) {
    return (
      <div className="px-6 py-14 text-center">
        <h2 id={MODAL_TITLE_ID} className="text-lg font-semibold">Este producto no está disponible</h2>
        <p className="mt-1 text-brand-muted">Puede que ya no esté en el catálogo.</p>
      </div>
    );
  }

  // La categoría ya está arriba del nombre.
  const features = productFeatures(product).filter(([term]) => term !== "Categoría");
  const category = product.parentCategory ? `${product.parentCategory.name} › ${product.category.name}` : product.category.name;

  return (
    <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2 md:gap-8">
      <ProductGallery name={product.name} images={product.images} />

      <div className="min-w-0 md:pt-2">
        <p className="pr-12 text-xs font-medium uppercase tracking-wide text-brand-green-ink">{category}</p>
        <h2 id={MODAL_TITLE_ID} className="mt-1 pr-8 font-display text-xl font-extrabold leading-tight text-balance sm:text-2xl md:pr-10">{product.name}</h2>

        {product.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-ink/90 text-pretty">{product.description}</p>}

        <div className="mt-4 border-t border-brand-line pt-4">
          <ProductPurchase name={product.name} path={productPath(product)} variants={product.variants} price={product.price} hasPriceRange={product.hasPriceRange} />
        </div>

        {features.length > 0 && (
          <dl className="mt-5 divide-y divide-brand-line rounded-xl border border-brand-line text-sm">
            {features.map(([term, value]) => (
              <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-3 px-3 py-2">
                <dt className="text-brand-muted">{term}</dt>
                <dd className="min-w-0 break-words font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Navegación completa (no intercepta: es un enlace normal a la página individual). */}
        <a href={productPath(product)} className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:decoration-2">
          Ver la página completa del producto
        </a>
      </div>
    </div>
  );
}
