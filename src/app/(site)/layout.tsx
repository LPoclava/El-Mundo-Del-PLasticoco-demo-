import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isSupabaseConfigured } from "@/lib/supabase/public";

/** Marco del catálogo público (cabecera, pie, aviso de prueba). El panel tiene el suyo en /panel. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-brand-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      {!isSupabaseConfigured && (
        <p className="bg-brand-sand px-4 py-1.5 text-center text-xs text-brand-muted">
          Vista de prueba · los productos y precios son de ejemplo
        </p>
      )}
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
