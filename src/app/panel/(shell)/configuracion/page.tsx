import type { Metadata } from "next";
import { RoleGuard } from "@/components/panel/role-guard";
import { SettingsSection } from "@/components/panel/sections/settings-section";

export const metadata: Metadata = { title: "Configuración" };

// El panel depende de la sesión de demostración del navegador: no hay contenido que mostrar antes de hidratar.
export const instant = false;

export default function Page() {
  return <RoleGuard min="ceo"><SettingsSection /></RoleGuard>;
}
