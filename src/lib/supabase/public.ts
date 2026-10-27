import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de SOLO LECTURA PÚBLICA para el catálogo. Usa la clave pública (anon/publishable),
 * que el esquema limita a las vistas public_catalog y public_categories.
 * Nunca usar acá la clave service_role.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase no está configurado (ver .env.local.example)");
  }
  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** URL pública de una foto del bucket product-images. */
export function productImageUrl(path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/product-images/${encoded}`;
}
