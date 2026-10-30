import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { RoleGuard } from "@/components/panel/role-guard";
import { EditCategoryRoute } from "@/components/panel/sections/categories-section";

export const metadata: Metadata = { title: "Editar categoría" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  // El id se lee de la dirección en el navegador: hasta entonces se ve la pantalla de carga.
  return (
    <Suspense fallback={<BrandLoader />}>
      <RoleGuard min="gerente"><EditCategoryRoute /></RoleGuard>
    </Suspense>
  );
}
