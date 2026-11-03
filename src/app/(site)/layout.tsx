import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Marco del catálogo público (cabecera y pie). El panel tiene el suyo en /panel. La ranura «modal» muestra la ficha de un producto como ventana flotante cuando se llega desde el catálogo. */
export default function SiteLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-brand-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      {/* Ventana flotante de producto (ruta interceptada): se dibuja encima del catálogo, que sigue ahí detrás. */}
      {modal}
      <SiteFooter />
    </>
  );
}
