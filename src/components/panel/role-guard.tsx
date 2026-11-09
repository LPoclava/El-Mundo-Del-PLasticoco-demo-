"use client";

import type { ReactNode } from "react";
import { atLeast, type Role } from "@/lib/panel/roles";
import { useSession } from "./auth-provider";
import { NotAvailable } from "./panel-shell";

/**
 * Muestra la sección solo si el rol del perfil real alcanza. No es seguridad: la base rechaza igualmente cualquier
 * operación de quien no tiene el rol (RLS y funciones con has_role_at_least).
 */
export function RoleGuard({ min, children }: { min: Role; children: ReactNode }) {
  const { profile } = useSession();
  if (!atLeast(profile.role, min)) return <NotAvailable role={profile.role} />;
  return <>{children}</>;
}
