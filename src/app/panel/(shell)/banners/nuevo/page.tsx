import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { BannerEditor } from "@/components/panel/sections/banners-section";

export const metadata: Metadata = { title: "Nuevo banner" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="gerente"><BannerEditor bannerId={null} /></RoleGuard>;
}
