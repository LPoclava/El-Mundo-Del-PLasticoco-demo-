import type { Metadata } from "next";
import { LoginForm } from "@/components/panel/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PanelLoginPage() {
  return <LoginForm />;
}
