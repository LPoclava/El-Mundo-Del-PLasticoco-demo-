import Image from "next/image";
import { CopyrightYear } from "@/components/copyright-year";

/** Pie del sitio. Las redes sociales están solo en la sección de contacto (no se repiten acá). */
export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-brand-line">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-6">
        {/* Decorativa: el nombre del negocio está escrito al lado. */}
        <Image
          src="/brand/logo-icono.png"
          alt=""
          width={322}
          height={323}
          sizes="36px"
          className="size-9"
        />
        <div className="text-sm">
          <p className="font-medium">El Mundo del Plástico</p>
          <p className="text-brand-muted">
            © <CopyrightYear /> Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
