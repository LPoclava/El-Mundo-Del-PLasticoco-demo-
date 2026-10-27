import Image from "next/image";
import Link from "next/link";

/**
 * Logo real recortado de la guía de identidad (public/brand/logo-horizontal.png).
 * Pendiente: reemplazar por el archivo original en vector (SVG) cuando esté disponible.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-brand-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <Link href="/" aria-label="El Mundo del Plástico — inicio" className="shrink-0">
          <Image
            src="/brand/logo-horizontal.png"
            alt="El Mundo del Plástico"
            width={900}
            height={329}
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>
        <nav aria-label="Principal" className="flex items-center text-sm text-brand-ink/70">
          <Link href="/#buscar" className="px-3 py-2.5 hover:text-brand-ink">
            Buscar
          </Link>
          <Link href="/#categorias" className="px-3 py-2.5 hover:text-brand-ink">
            Categorías
          </Link>
        </nav>
      </div>
    </header>
  );
}
