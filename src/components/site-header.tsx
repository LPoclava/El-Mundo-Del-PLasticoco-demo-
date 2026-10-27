import Image from "next/image";
import Link from "next/link";

/**
 * Logo real recortado de la guía de identidad (public/brand/logo-horizontal.png).
 * Pendiente: reemplazar por el archivo original en vector (SVG) cuando esté disponible.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-brand-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <Link
          href="/"
          aria-label="El Mundo del Plástico — inicio"
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <Image
            src="/brand/logo-horizontal.png"
            alt="El Mundo del Plástico"
            width={900}
            height={329}
            sizes="(min-width: 640px) 132px, 110px"
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>
        <nav aria-label="Principal" className="flex items-center text-sm text-brand-muted">
          <Link href="/#buscar" className="inline-flex min-h-11 items-center px-3 hover:text-brand-ink">
            Buscar
          </Link>
          <Link href="/#categorias" className="inline-flex min-h-11 items-center px-3 hover:text-brand-ink">
            Categorías
          </Link>
        </nav>
      </div>
    </header>
  );
}
