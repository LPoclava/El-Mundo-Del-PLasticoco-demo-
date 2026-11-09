import { FeatureTiles } from "@/components/product/feature-tiles";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { getProduct } from "@/lib/catalog/repository";
import { productFeatures } from "@/lib/catalog/features";
import { MODAL_TITLE_ID, parseProductSlug, productPath } from "@/lib/catalog/product";

/**
 * Contenido de la ventana flotante: la MISMA composición que la ficha (galería adaptable, rubro y marca, nombre, bloque
 * de compra con elección de variante, descripción y características), sin migas ni relacionados. Un producto
 * inexistente, sin publicar o archivado muestra un aviso.
 */
export async function ProductQuickView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = parseProductSlug(slug);
  const product = id ? await getProduct(id) : null;

  if (!product) {
    return (
      <div className="px-6 py-14 text-center">
        <h2 id={MODAL_TITLE_ID} className="font-display text-lg font-extrabold">Este producto no está disponible</h2>
        <p className="mt-1 text-brand-muted">Puede que ya no esté en el catálogo.</p>
      </div>
    );
  }

  // La marca y la categoría ya están arriba del nombre.
  const tiles = productFeatures(product).filter(([term]) => term !== "Marca" && term !== "Categoría");
  const category = product.parentCategory ? `${product.parentCategory.name} › ${product.category.name}` : product.category.name;

  return (
    <div className="grid gap-5 p-4 [--purchase-bg:var(--color-surface)] sm:p-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-8">
      <ProductGallery name={product.name} images={product.images} />

      <div className="min-w-0 space-y-5 md:pt-1">
        <header className="pr-10">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center rounded-full bg-tint-green px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand-green-ink">{category}</span>
            {product.brand && <span className="text-sm text-brand-muted">Marca <strong className="font-semibold text-brand-ink">{product.brand}</strong></span>}
          </p>
          <h2 id={MODAL_TITLE_ID} className="mt-1.5 font-display text-2xl font-extrabold leading-[1.12] text-balance sm:text-[1.75rem]">{product.name}</h2>
        </header>

        <ProductPurchase
          productId={product.id}
          imageUrl={product.images[0]?.url ?? null}
          name={product.name}
          path={productPath(product)}
          variants={product.variants}
          price={product.price}
          hasPriceRange={product.hasPriceRange}
        />

        {product.description && <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink/90 text-pretty">{product.description}</p>}

        <FeatureTiles features={tiles} />

        {/* Navegación completa (no intercepta: es un enlace normal a la página individual). */}
        <a href={productPath(product)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:decoration-2">
          Ver la página completa del producto
        </a>
      </div>
    </div>
  );
}
