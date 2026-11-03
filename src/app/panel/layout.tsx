import type { Metadata } from "next";
import { DemoProvider } from "@/components/panel/demo-provider";

// La demo no es parte del sitio público: no debe indexarse.
export const metadata: Metadata = {
  title: { template: "%s · Panel (demo)", default: "Panel de administración (demo)" },
  description: "Demostración del panel de administración de Mundo del Plástico.",
  robots: { index: false, follow: false },
  openGraph: null,
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    // El panel no tiene modo oscuro: «panel-light» conserva sus colores claros aunque el catálogo esté en oscuro.
    <div className="panel-light flex-1">
      <DemoProvider>{children}</DemoProvider>
    </div>
  );
}
