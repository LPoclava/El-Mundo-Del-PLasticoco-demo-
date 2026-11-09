"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/async";
import { loginFailureMessage, NO_ACCESS_MESSAGE, profileFromRow, shouldRefresh, type Profile } from "@/lib/panel/session";
import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";

/**
 * Sesión REAL del panel: Supabase Auth con correo y contraseña. El rol y el estado se leen de public.profiles
 * (nunca del token ni de user_metadata). Esto solo decide qué se muestra; lo que cada persona puede hacer lo decide
 * la base con RLS y funciones por rol, así que alterar este estado en el navegador no concede ningún permiso.
 */
const TIMEOUT_MS = 15_000;

export type AuthState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "out" }
  | { status: "error"; message: string }
  | { status: "forbidden"; email: string }
  | { status: "in"; userId: string; email: string; profile: Profile };

type Api = {
  state: AuthState;
  /** Cliente de Supabase con la sesión; null si el sitio no tiene la conexión configurada. */
  db: SupabaseClient | null;
  /** Inicia sesión. Devuelve null si quedó adentro, o el mensaje para mostrar. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<Api | null>(null);

export function useAuth(): Api {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

/** Sesión iniciada y con perfil habilitado. Solo se usa en pantallas que el marco del panel muestra con sesión. */
export function useSession(): Extract<AuthState, { status: "in" }> & { db: SupabaseClient } {
  const { state, db } = useAuth();
  if (state.status !== "in" || !db) throw new Error("useSession se usa solo con una sesión iniciada");
  return { ...state, db };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => (isBrowserSupabaseConfigured ? getBrowserSupabase() : null), []);
  const [state, setState] = useState<AuthState>(db ? { status: "loading" } : { status: "unconfigured" });
  const alive = useRef(true);
  // Cuándo empezó la última evaluación y cuál es la más reciente: si una vieja termina después de una nueva, se descarta.
  const lastStartedAt = useRef(0);
  const latest = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const evaluate = useCallback(async (): Promise<AuthState> => {
    if (!db) return { status: "unconfigured" };
    const mine = ++latest.current;
    lastStartedAt.current = Date.now();
    let next: AuthState;
    try {
      const { data } = await withTimeout(db.auth.getSession(), TIMEOUT_MS);
      const user = data.session?.user;
      if (!user) {
        next = { status: "out" };
      } else {
        const res = await withTimeout(
          db.from("profiles").select("role,active,display_name").eq("user_id", user.id).maybeSingle(),
          TIMEOUT_MS,
        );
        if (res.error) throw new Error(res.error.message);
        const profile = profileFromRow(res.data, user.email ?? "");
        next = profile
          ? { status: "in", userId: user.id, email: user.email ?? "", profile }
          : { status: "forbidden", email: user.email ?? "" };
      }
    } catch (e) {
      next = { status: "error", message: e instanceof Error ? e.message : "No se pudo verificar la sesión." };
    }
    if (alive.current && mine === latest.current) {
      // Un fallo pasajero de red no saca de su sesión a quien ya está adentro.
      setState((prev) => (next.status === "error" && prev.status === "in" ? prev : next));
    }
    return next;
  }, [db]);

  useEffect(() => {
    if (!db) return;
    void evaluate();
    const { data: sub } = db.auth.onAuthStateChange(() => {
      // Se difiere: dentro del callback no se deben hacer más llamadas a Supabase.
      setTimeout(() => void evaluate(), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [db, evaluate]);

  // Al volver a una pestaña que estuvo inactiva se reevalúa la sesión y el perfil: si la cuenta se desactivó mientras
  // tanto, el panel deja de mostrarse y se vuelve al ingreso. Solo cambia lo que se ve: las operaciones ya las rechaza
  // la base (has_role_at_least exige un perfil activo) aunque esta pantalla tarde en enterarse.
  useEffect(() => {
    if (!db) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      if (shouldRefresh(lastStartedAt.current, Date.now())) void evaluate();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [db, evaluate]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!db) return "La conexión con la base de datos no está configurada. Avisá a quien administra el sistema.";
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return loginFailureMessage(error);
      const next = await evaluate();
      if (next.status === "in") return null;
      if (next.status === "forbidden") return NO_ACCESS_MESSAGE;
      return next.status === "error" ? loginFailureMessage({ message: next.message }) : "No se pudo iniciar sesión.";
    },
    [db, evaluate],
  );

  const signOut = useCallback(async () => {
    if (db) await db.auth.signOut();
    if (alive.current) setState(db ? { status: "out" } : { status: "unconfigured" });
  }, [db]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void evaluate();
  }, [evaluate]);

  const value = useMemo<Api>(() => ({ state, db, signIn, signOut, retry }), [state, db, signIn, signOut, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
