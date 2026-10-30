import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { NewUserScreen } from "@/components/panel/sections/users-section";

export const metadata: Metadata = { title: "Nuevo usuario" };

// Depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="ceo"><NewUserScreen /></RoleGuard>;
}
