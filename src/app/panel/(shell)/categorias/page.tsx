import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { CategoriesSection } from "@/components/panel/sections/categories-section";

export const metadata: Metadata = { title: "Categorías" };

// El panel depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="gerente"><CategoriesSection /></RoleGuard>;
}
