"use client";

import type { ReactNode } from "react";
import { atLeast, type Role } from "@/lib/panel-demo/roles";
import { useDemo } from "./demo-provider";
import { NotAvailable } from "./panel-shell";

/** Muestra la sección solo si el perfil de demostración la incluye. No es seguridad real. */
export function RoleGuard({ min, children }: { min: Role; children: ReactNode }) {
  const { role } = useDemo();
  if (!role) return null;
  if (!atLeast(role, min)) return <NotAvailable role={role} />;
  return <>{children}</>;
}
