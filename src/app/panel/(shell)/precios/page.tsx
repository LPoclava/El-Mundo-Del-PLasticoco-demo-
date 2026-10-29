import type { Metadata } from "next";
import { ScannerSection } from "@/components/panel/sections/scanner-section";


export const metadata: Metadata = { title: "Escáner y ventas" };

// El panel depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <ScannerSection />;
}
