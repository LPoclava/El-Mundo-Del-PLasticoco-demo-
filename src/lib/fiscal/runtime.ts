import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFiscalConfig } from "./config.ts";
import type { HandlerDeps } from "./handlers.ts";
import { createArcaProvider } from "./provider.ts";
import { FiscalDbError, type FiscalDb, type FiscalDoc, type FiscalEnv, type FiscalStatus } from "./service.ts";

/**
 * Conexión real del circuito fiscal (solo servidor). Cada llamada a la base se hace con el token de sesión de LA PERSONA
 * que pide la operación (cabecera Authorization), con la clave pública (anon): las políticas RLS y las funciones de la
 * base corren como ella y vuelven a exigir acceso de desarrollo. NO se usa la clave service_role ni ningún secreto de
 * Supabase; las credenciales de ARCA, cuando existan, se leerán de variables de entorno del servidor (ver config.ts).
 */
function clientFor(token: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase no está configurado");
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

type DocRow = { id: string; sale_id: string; environment: FiscalEnv; status: FiscalStatus; last_error: string | null };
const toDoc = (r: DocRow): FiscalDoc => ({ id: r.id, saleId: r.sale_id, environment: r.environment, status: r.status, lastError: r.last_error });
const COLUMNS = "id,sale_id,environment,status,last_error";

function fail(error: { code?: string; message?: string }): never {
  throw new FiscalDbError(error.code ?? "XX000", error.message ?? "error");
}

function dbFor(token: string): FiscalDb {
  const db = clientFor(token);
  return {
    async getDocument(id) {
      const { data, error } = await db.from("fiscal_documents").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) fail(error);
      return data ? toDoc(data as DocRow) : null;
    },
    async listDocuments(saleId, limit) {
      let q = db.from("fiscal_documents").select(COLUMNS).order("requested_at", { ascending: false }).limit(limit);
      if (saleId) q = q.eq("sale_id", saleId);
      const { data, error } = await q;
      if (error) fail(error);
      return ((data ?? []) as DocRow[]).map(toDoc);
    },
    async getSettings() {
      const { data, error } = await db.from("fiscal_settings").select("production_enabled").maybeSingle();
      if (error) fail(error);
      return { productionEnabled: Boolean((data as { production_enabled: boolean } | null)?.production_enabled) };
    },
    async requestIssue(saleId, idempotencyKey, environment) {
      const { data, error } = await db.rpc("fiscal_request_issue", { p_sale_id: saleId, p_idempotency_key: idempotencyKey, p_environment: environment });
      if (error) fail(error);
      return data as { id: string; status: FiscalStatus; environment: FiscalEnv; created: boolean };
    },
    async transition(id, to, note = null, result = null) {
      const { data, error } = await db.rpc("fiscal_transition", { p_document_id: id, p_to: to, p_note: note, p_result: result });
      if (error) fail(error);
      return { status: (data as { status: FiscalStatus }).status };
    },
    async logEvent(id, kind, payload = null, note = null) {
      const { error } = await db.rpc("fiscal_log_event", { p_document_id: id, p_kind: kind, p_payload: payload, p_note: note });
      if (error) fail(error);
    },
  };
}

/** Dependencias reales de los manejadores. El proveedor es el de ARCA SIN integrar: no emite nada. */
export function fiscalDeps(): HandlerDeps {
  return {
    config: () => readFiscalConfig(),
    async isDeveloper(token) {
      const { data, error } = await clientFor(token).rpc("is_developer");
      if (error) {
        // Sin permiso para ejecutarla (por ejemplo, la sesión es anónima): no es de desarrollo.
        if (error.code === "42501") return false;
        // Token inválido o vencido: PostgREST responde con un error de JWT (no es un error del servidor).
        if (error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(error.message ?? "")) return null;
        throw new Error("No se pudo verificar el acceso");
      }
      return data === true;
    },
    service(token) {
      return { db: dbFor(token), provider: createArcaProvider(), config: readFiscalConfig() };
    },
  };
}
