import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand-loader";
import { RoleGuard } from "@/components/panel/role-guard";
import { ProductEditor } from "@/components/panel/sections/product-form";

export const metadata: Metadata = { title: "Crear producto" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  // Lee ?codigo= y ?volver= de la dirección en el navegador: hasta entonces, pantalla de carga.
  return (
    <Suspense fallback={<BrandLoader />}>
      <RoleGuard min="gerente"><ProductEditor productId={null} /></RoleGuard>
    </Suspense>
  );
}
