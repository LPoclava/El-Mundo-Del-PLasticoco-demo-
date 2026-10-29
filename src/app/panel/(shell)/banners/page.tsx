import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { BannersSection } from "@/components/panel/sections/banners-section";

export const metadata: Metadata = { title: "Banners promocionales" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="gerente"><BannersSection /></RoleGuard>;
}
