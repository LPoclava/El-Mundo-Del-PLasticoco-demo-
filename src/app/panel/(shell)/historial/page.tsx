import type { Metadata } from "next";
import { HistorySection } from "@/components/panel/sections/history-section";


export const metadata: Metadata = { title: "Historial de cambios" };

// El panel depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <HistorySection />;
}
