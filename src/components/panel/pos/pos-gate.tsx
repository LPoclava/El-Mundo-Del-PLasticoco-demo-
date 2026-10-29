"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { Button, CARD_CLASS, Notice, TextInput } from "../ui";

/**
 * Sesión REAL de Supabase para vender (no la del panel de demostración). Pueden vender los perfiles
 * activos de empleado, gerente o CEO; lo decide la base (confirm_sale exige el rol): esta pantalla
 * solo evita mostrar un punto de venta a quien no va a poder usarlo.
 */
type Gate =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "forbidden"; email: string }
  | { state: "ready"; name: string; role: "empleado" | "gerente" | "ceo" };

export function PosGate({ children }: { children: (ctx: { db: SupabaseClient; name: string; role: "empleado" | "gerente" | "ceo" }) => ReactNode }) {
  if (!isBrowserSupabaseConfigured) {
    return (
      <Notice tone="warn" title="Supabase no está configurado">
        Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.local.example). Sin ellas el punto de venta no puede
        buscar productos ni registrar ventas.
      </Notice>
    );
  }
  return <Connected>{children}</Connected>;
}

function Connected({ children }: { children: (ctx: { db: SupabaseClient; name: string; role: "empleado" | "gerente" | "ceo" }) => ReactNode }) {
  const db = getBrowserSupabase();
  const [gate, setGate] = useState<Gate>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      const { data } = await db.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setGate({ state: "signedOut" });
        return;
      }
      // El rol se lee de public.profiles (nunca del token ni de user_metadata, que el usuario puede editar).
      const profile = await db.from("profiles").select("role,active,display_name").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      const ok = !profile.error && profile.data?.active && ["empleado", "gerente", "ceo"].includes(profile.data.role);
      setGate(
        ok
          ? { state: "ready", name: profile.data?.display_name ?? user.email ?? "", role: profile.data?.role as "empleado" | "gerente" | "ceo" }
          : { state: "forbidden", email: user.email ?? "" },
      );
    }

    void evaluate();
    const { data: sub } = db.auth.onAuthStateChange(() => {
      // Se difiere: dentro del callback no se deben hacer más llamadas a Supabase.
      setTimeout(() => void evaluate(), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [db]);

  if (gate.state === "loading") return <p role="status" className="text-sm text-brand-muted">Verificando tu sesión…</p>;
  if (gate.state === "signedOut") return <SignIn db={db} />;
  if (gate.state === "forbidden") {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="Tu cuenta no puede vender">
          {gate.email ? `${gate.email} no` : "Esta cuenta no"} tiene un perfil activo. Pedile a un responsable que lo revise.
        </Notice>
        <Button onClick={() => void db.auth.signOut()}>Cerrar sesión</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-muted">
        <p>Vendiendo como <strong className="font-medium text-brand-ink">{gate.name}</strong></p>
        <Button size="sm" variant="ghost" icon="logout" onClick={() => void db.auth.signOut()}>Cerrar sesión</Button>
      </div>
      {children({ db, name: gate.name, role: gate.role })}
    </div>
  );
}

function SignIn({ db }: { db: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Ingresá tu correo y tu contraseña.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: failure } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (failure) setError(/network|fetch/i.test(failure.message) ? "No hay conexión con el servidor. Probá de nuevo." : "El correo o la contraseña no son correctos.");
  }

  return (
    <section className={`${CARD_CLASS} max-w-md p-5`} aria-label="Iniciar sesión">
      <Notice title="Cuenta real, no la de demostración">
        Las ventas se registran de verdad y descuentan stock. Ingresá con tu cuenta de Supabase.
      </Notice>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <TextInput label="Correo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? "Ingresando…" : "Ingresar"}</Button>
      </form>
    </section>
  );
}
