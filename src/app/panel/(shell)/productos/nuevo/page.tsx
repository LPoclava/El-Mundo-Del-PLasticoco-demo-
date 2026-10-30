import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { ProductEditor } from "@/components/panel/sections/product-form";

export const metadata: Metadata = { title: "Crear producto" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="gerente"><ProductEditor productId={null} /></RoleGuard>;
}
