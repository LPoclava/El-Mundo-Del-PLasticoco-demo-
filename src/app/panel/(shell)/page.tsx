import type { Metadata } from "next";
import { HomeSection } from "@/components/panel/sections/home-section";

export const metadata: Metadata = { title: "Inicio" };

// El panel depende de la sesión de Supabase del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function PanelHomePage() {
  return <HomeSection />;
}
