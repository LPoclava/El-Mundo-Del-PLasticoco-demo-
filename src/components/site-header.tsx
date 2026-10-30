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
            sizes="(min-width: 640px) 156px, 120px"
            priority
            className="h-11 w-auto sm:h-14"
          />
        </Link>
      </div>
      {/* Franja bicolor, los colores del logo: naranja y verde. */}
      <div aria-hidden className="flex h-1">
        <span className="w-24 bg-brand-orange sm:w-40" />
        <span className="w-12 bg-brand-green sm:w-20" />
      </div>
    </header>
  );
}
