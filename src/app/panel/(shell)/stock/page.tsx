import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { StockSection } from "@/components/panel/sections/stock-section";

export const metadata: Metadata = { title: "Control de stock" };

// Depende de la sesión del navegador (demostración y Supabase): no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="gerente"><StockSection /></RoleGuard>;
}
