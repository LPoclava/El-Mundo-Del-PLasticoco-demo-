"use client";

import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { atLeast } from "@/lib/panel/roles";
import { useSession } from "./auth-provider";
import { Notice } from "./ui";

/**
 * Compuerta de las secciones que administran datos (gerente o CEO). La sesión es la del panel: no hay un segundo
 * inicio de sesión. El rol viene de public.profiles; esta pantalla solo evita mostrar formularios a quien no
 * corresponde, y la base vuelve a controlarlo con RLS en cada operación.
 */
export function SupabaseGate({ action, children }: { action: string; children: (db: SupabaseClient) => ReactNode }) {
  const { db, email, profile } = useSession();
  if (!atLeast(profile.role, "gerente")) {
    return (
      <Notice tone="warn" title={`Tu cuenta no está habilitada para ${action}`}>
        {email ? `${email}: ` : ""}solicitá acceso a un responsable.
      </Notice>
    );
  }
  return <>{children(db)}</>;
}
