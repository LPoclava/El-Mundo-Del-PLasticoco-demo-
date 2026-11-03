import { Suspense } from "react";
import { ProductModal } from "@/components/product/product-modal";
import { ProductQuickView } from "@/components/product/product-quick-view";

/**
 * Ruta interceptada: al entrar a /producto/... desde el catálogo (navegación del navegador, sin recargar) se muestra
 * la ficha como ventana flotante sobre el catálogo. Abrir la dirección directamente o recargar muestra la página
 * individual de siempre (producto/[slug]/page.tsx), que no se toca.
 */
export default function ProductModalPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <ProductModal>
      <Suspense fallback={<p role="status" className="grid min-h-[min(32rem,70dvh)] place-items-center px-6 text-center text-sm text-brand-muted">Cargando el producto…</p>}>
        <ProductQuickView params={params} />
      </Suspense>
    </ProductModal>
  );
}
