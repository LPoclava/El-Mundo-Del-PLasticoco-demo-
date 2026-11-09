"use client";

import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/panel/roles";
import { useSession } from "../auth-provider";

/**
 * Sesión del panel para vender y consultar stock. Pueden usarla los perfiles activos de empleado, gerente o CEO
 * (el marco del panel ya dejó pasar solo a esos). Lo decide la base: confirm_sale y pos_find exigen el rol.
 */
export function PosGate({ children }: { children: (ctx: { db: SupabaseClient; name: string; role: Role }) => ReactNode }) {
  const { db, profile } = useSession();
  return <>{children({ db, name: profile.displayName, role: profile.role })}</>;
}
