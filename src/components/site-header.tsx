import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CONTACT } from "@/config/contact";
import { getCategories, getPromoBanners } from "@/lib/catalog/repository";
import { catalogHref } from "@/lib/catalog/url";
import { getContactChannels, getMapsHref } from "@/lib/contact";
import { HeaderSearch } from "./catalog/header-search";
import { SearchForm } from "./catalog/search-form";
import { LocationGlobe } from "./location-globe";
import { SiteMenu, type MenuCategory } from "./site-menu";
import { NavLinkList, SiteNavLinks } from "./site-nav-links";
import { SiteNavSearch } from "./site-nav-search";
import { ThemeToggle } from "./theme-toggle";

function Divider({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`h-6 w-px shrink-0 bg-white/25 ${className}`} />;
}

function Menu({ categories, hasPromos }: { categories: MenuCategory[]; hasPromos: boolean }) {
  return (
    <SiteMenu
      categories={categories}
      channels={getContactChannels().filter((c) => c.href && c.id !== "instagram")}
      mapsHref={getMapsHref()}
      address={CONTACT.address}
      globe={<LocationGlobe compact className="size-full" />}
      sections={[
        { label: "Inicio", href: "/" },
        { label: "Catálogo", href: "/#catalogo" },
        ...(hasPromos ? [{ label: "Promociones", href: "/#promociones" }] : []),
      ]}
    />
  );
}

async function MenuWithData() {
  // El menú no debe romper la página: si algo falla, queda sin categorías.
  const [categories, banners] = await Promise.all([
    getCategories().catch(() => []),
    getPromoBanners().catch(() => []),
  ]);
  const featured = categories
    .filter((c) => c.featuredPosition != null && !c.parentSlug)
    .sort((a, b) => (a.featuredPosition ?? 0) - (b.featuredPosition ?? 0))
    .map((c) => ({ slug: c.slug, name: c.name, href: `${catalogHref({ category: c.slug })}#catalogo` }));
  return <Menu categories={featured} hasPromos={banners.length > 0} />;
}

async function LinksWithData() {
  const banners = await getPromoBanners().catch(() => []);
  return <SiteNavLinks hasPromos={banners.length > 0} />;
}

/**
 * Navegación flotante: cápsula verde oscuro, centrada y separada de los bordes, que acompaña todo el recorrido.
 * Orden: menú, logo, divisor, secciones, buscador, tema. El logo es el original: el ícono sobre un disco crema (como
 * en el volante del negocio) y el nombre con las mismas letras en claro, porque el negro no se lee sobre verde.
 * En pantallas chicas las secciones pasan al menú y el buscador se abre con la lupa. Si el texto se agranda, la cápsula
 * crece y pasa a varios renglones; si en un celular ya ocuparía demasiada altura, deja de acompañar el recorrido. No hay acceso de inicio de sesión (reservado para más adelante).
 */
export function SiteHeader() {
  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-2 max-[18rem]:static sm:px-4 sm:pt-3">
      <div className="nav-capsule pointer-events-auto relative mx-auto flex min-h-14 w-full max-w-[70rem] flex-wrap items-center gap-x-1 rounded-[1.75rem] bg-nav px-1.5 text-on-nav ring-1 ring-white/10 sm:gap-x-2 sm:px-2">
        <Suspense fallback={<Menu categories={[]} hasPromos />}>
          <MenuWithData />
        </Suspense>

        <Link
          href="/"
          aria-label="El Mundo del Plástico — inicio"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-full pr-1 focus-visible:outline-on-nav"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-cream-fixed p-0.5">
            <Image src="/brand/logo-icono.png" alt="" width={322} height={323} sizes="40px" preload className="size-full" />
          </span>
          <Image src="/brand/logo-nombre-claro.png" alt="" width={554} height={196} sizes="82px" preload className="hidden h-7 w-auto min-[22.5rem]:block" />
        </Link>

        <Divider className="ml-1 hidden md:block" />

        <nav aria-label="Principal" className="hidden md:block">
          <Suspense fallback={<NavLinkList active={null} hasPromos />}>
            <LinksWithData />
          </Suspense>
        </nav>

        <div className="ml-auto flex items-center gap-x-1 sm:gap-x-2">
          <SiteNavSearch>
            {/* El buscador lee la URL en el navegador; mientras tanto se ve igual pero vacío. */}
            <Suspense fallback={<SearchForm />}>
              <HeaderSearch />
            </Suspense>
          </SiteNavSearch>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
