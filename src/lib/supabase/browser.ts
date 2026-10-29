import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase del NAVEGADOR para el panel (sesión real de quien inicia sesión).
 * Usa solo la clave pública (anon/publishable): lo que cada persona puede hacer lo decide la
 * base con RLS y los roles de public.profiles, no este archivo. Nunca poner acá la clave
 * service_role.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isBrowserSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase no está configurado (ver .env.local.example)");
  }
  client ??= createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "mp-panel-auth" },
  });
  return client;
}
