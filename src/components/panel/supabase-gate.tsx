"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BrandLoader } from "@/components/brand-loader";
import { withTimeout } from "@/lib/async";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { friendlyError } from "@/lib/supabase/errors";
import { Button, CARD_CLASS, Notice, TextInput } from "./ui";

/**
 * Compuerta de las secciones del panel que guardan datos reales: inicio de sesión de Supabase
 * (no el de demostración) y comprobación del perfil. El rol se lee de public.profiles; lo que
 * cada persona puede hacer lo decide la base con RLS, esta pantalla solo evita mostrar
 * formularios a quien no corresponde.
 */
const SESSION_TIMEOUT_MS = 15_000;

type Gate =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "signedOut" }
  | { state: "forbidden"; email: string }
  | { state: "ready"; name: string };

export function SupabaseGate({ action, children }: { action: string; children: (db: SupabaseClient) => ReactNode }) {
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
      const allowed = !profile.error && profile.data?.active && ["gerente", "ceo"].includes(profile.data.role);
      setGate(allowed ? { state: "ready", name: profile.data?.display_name ?? user.email ?? "" } : { state: "forbidden", email: user.email ?? "" });
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
        <Notice tone="warn" title={`Esta cuenta no está habilitada para ${action}`}>
          {gate.email ? `${gate.email}: ` : ""}Solicitá acceso a un responsable.
        </Notice>
        <Button onClick={() => void db.auth.signOut()}>Cerrar sesión</Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-muted">
        <p>Sesión iniciada como <strong className="font-medium text-brand-ink">{gate.name}</strong></p>
        <Button size="sm" variant="ghost" icon="logout" onClick={() => void db.auth.signOut()}>Cerrar sesión</Button>
      </div>
      {children(db)}
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
    if (failure) setError(/network|fetch/i.test(failure.message) ? friendlyError(failure) : "El correo o la contraseña no son correctos.");
  }

  return (
    <section className={`${CARD_CLASS} max-w-md p-5`} aria-label="Iniciar sesión">
      <Notice title="Ingresá con tu cuenta">
        Esta sección guarda datos de verdad. Usá la cuenta del negocio con permiso de gerente o CEO.
      </Notice>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <TextInput label="Correo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? "Ingresando…" : "Ingresar"}</Button>
      </form>
    </section>
  );
}
