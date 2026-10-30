import Link from "next/link";
import { GlobeMotif } from "@/components/catalog/globe-motif";

/** Producto inexistente, sin publicar o archivado: la misma respuesta para los tres (no se revela cuál). */
export default function ProductNotFound() {
  return (
    <main id="contenido" className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-brand-line bg-white px-6 py-12 text-center">
        <GlobeMotif className="mx-auto size-10 text-brand-green" />
        <h1 className="mt-4 text-lg font-semibold">Este producto no está disponible</h1>
        <p className="mt-1 text-brand-muted">Puede que ya no esté en el catálogo o que el enlace esté incompleto.</p>
        <Link
          href="/#catalogo"
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-ink px-5 text-sm font-medium text-white hover:bg-brand-ink/85"
        >
          Ver el catálogo
        </Link>
      </div>
    </main>
  );
}
