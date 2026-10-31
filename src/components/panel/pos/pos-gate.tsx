"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLoader } from "@/components/brand-loader";
import { withTimeout } from "@/lib/async";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";
import { Button, CARD_CLASS, Notice, TextInput } from "../ui";

/**
 * Sesión REAL de Supabase para vender (no la del panel de demostración). Pueden vender los perfiles
 * activos de empleado, gerente o CEO; lo decide la base (confirm_sale exige el rol): esta pantalla
 * solo evita mostrar un punto de venta a quien no va a poder usarlo.
 */
const SESSION_TIMEOUT_MS = 15_000;

type Gate =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "signedOut" }
  | { state: "forbidden"; email: string }
  | { state: "ready"; name: string; role: "empleado" | "gerente" | "ceo" };

export function PosGate({ children }: { children: (ctx: { db: SupabaseClient; name: string; role: "empleado" | "gerente" | "ceo" }) => ReactNode }) {
  if (!isBrowserSupabaseConfigured) {
    return (
      <Notice tone="warn" title="Falta configurar la conexión">
        Sin la conexión con la base de datos no se pueden buscar productos ni registrar ventas. Avisá a quien administra el sistema.
      </Notice>
    );
  }
  return <Connected>{children}</Connected>;
}

function Connected({ children }: { children: (ctx: { db: SupabaseClient; name: string; role: "empleado" | "gerente" | "ceo" }) => ReactNode }) {
  const db = getBrowserSupabase();
  const [gate, setGate] = useState<Gate>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Sin red o con el servidor caído, la verificación termina en un aviso con «Reintentar»: la pantalla de
    // carga nunca queda visible para siempre.
    async function evaluate() {
      try {
        await check();
      } catch (e) {
        if (!cancelled) setGate({ state: "error", message: e instanceof Error ? e.message : "No se pudo verificar la sesión." });
      }
    }

    async function check() {
      const { data } = await withTimeout(db.auth.getSession(), SESSION_TIMEOUT_MS);
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setGate({ state: "signedOut" });
        return;
      }
      // El rol se lee de public.profiles (nunca del token ni de user_metadata, que el usuario puede editar).
      const profile = await withTimeout(db.from("profiles").select("role,active,display_name").eq("user_id", user.id).maybeSingle(), SESSION_TIMEOUT_MS);
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
  }, [db, attempt]);

  if (gate.state === "loading") return <BrandLoader label="Recuperando tu sesión…" />;
  if (gate.state === "error") {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="No pudimos verificar tu sesión">{gate.message} Revisá la conexión e intentá de nuevo.</Notice>
        <Button
          icon="refresh"
          onClick={() => {
            setGate({ state: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }
  if (gate.state === "signedOut") return <SignIn db={db} />;
  if (gate.state === "forbidden") {
    return (
      <div className="space-y-3">
        <Notice tone="warn" title="Esta cuenta no está habilitada para vender">
          {gate.email ? `${gate.email}: ` : ""}Solicitá acceso a un responsable.
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
      <Notice title="Ingresá con tu cuenta">
        Las ventas se registran de verdad y descuentan stock.
      </Notice>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <TextInput label="Correo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? "Ingresando…" : "Ingresar"}</Button>
      </form>
    </section>
  );
}
