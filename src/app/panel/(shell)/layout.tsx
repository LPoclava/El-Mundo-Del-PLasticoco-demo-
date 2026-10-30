import { Suspense } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { PanelShell } from "@/components/panel/panel-shell";

// El marco lee la dirección (menú activo, título) y la sesión del navegador. En las pantallas con id
// (/panel/productos/[id]) la dirección recién se conoce en el navegador: hasta entonces, pantalla de carga.
export default function ShellLayout({ children }: LayoutProps<"/panel">) {
  return (
    <Suspense fallback={<BrandLoader fullscreen label="Cargando el panel…" />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}
