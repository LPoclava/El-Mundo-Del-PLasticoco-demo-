import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderSearch } from "./catalog/header-search";
import { SearchForm } from "./catalog/search-form";
import { ThemeToggle } from "./theme-toggle";

/**
 * Encabezado compacto: logo y buscador. En el celular el buscador va en una segunda línea a todo el ancho;
 * desde tablet comparten una sola fila. Logo real de la guía de identidad (public/brand/logo-horizontal.png).
 * Pendiente: reemplazar por el archivo original en vector (SVG) cuando esté disponible.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-brand-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1.5 px-4 pb-2.5 pt-1.5 sm:flex-nowrap sm:py-2.5">
        <Link
          href="/"
          aria-label="El Mundo del Plástico — inicio"
          className="inline-flex min-h-11 shrink-0 items-center rounded-md"
        >
          <Image
            src="/brand/logo-horizontal.png"
            alt="El Mundo del Plástico"
            width={900}
            height={329}
            sizes="(min-width: 640px) 131px, 98px"
            preload
            className="h-9 w-auto sm:h-12"
          />
        </Link>
        {/* Celular: el botón del tema queda en la primera fila, a la derecha del logo. */}
        <div className="order-2 ml-auto sm:order-3"><ThemeToggle /></div>
        <div className="order-3 w-full sm:order-2 sm:ml-auto sm:max-w-md lg:max-w-lg">
          {/* El buscador lee la URL en el navegador; mientras tanto se ve igual pero vacío. */}
          <Suspense fallback={<SearchForm />}>
            <HeaderSearch />
          </Suspense>
        </div>
      </div>
      {/* Franja bicolor, los colores del logo: naranja y verde. */}
      <div aria-hidden className="flex h-1">
        <span className="w-24 bg-brand-orange sm:w-40" />
        <span className="w-12 bg-brand-green sm:w-20" />
      </div>
    </header>
  );
}
