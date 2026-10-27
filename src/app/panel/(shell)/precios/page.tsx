import type { Metadata } from "next";
import { PriceLookupSection } from "@/components/panel/sections/price-lookup-section";


export const metadata: Metadata = { title: "Consulta de precios" };

// El panel depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <PriceLookupSection />;
}
