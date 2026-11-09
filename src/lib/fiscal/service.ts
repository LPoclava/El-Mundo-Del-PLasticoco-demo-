import type { FiscalConfig } from "./config.ts";
import type { FiscalProvider, ProviderResult } from "./provider.ts";

/**
 * Orquestación del circuito fiscal en el servidor (sin red ni React: se prueba con node --test y con la base real en
 * PGlite). Separado POR COMPLETO de la venta: la venta no crea ni dispara nada de esto; una solicitud fiscal es una acción
 * explícita de un desarrollador autorizado, sobre una venta ya registrada.
 *
 * Todo lo que cambia de estado pasa por las funciones de la base (fiscal_request_issue, fiscal_transition,
 * fiscal_log_event), que vuelven a exigir acceso de desarrollo, validan las transiciones y bloquean la fila: acá no hay
 * ninguna escritura directa. Cada paso deja un evento (solicitud, solicitud a ARCA, respuesta o error).
 */
export type FiscalStatus = "pendiente" | "en_proceso" | "emitido" | "rechazado" | "error";
export type FiscalEnv = "homologacion" | "produccion";

export type FiscalDoc = { id: string; saleId: string; environment: FiscalEnv; status: FiscalStatus; lastError: string | null };

export type RequestResult = { id: string; status: FiscalStatus; environment: FiscalEnv; created: boolean };

/** Error de la base con su código (por ejemplo 42501 sin permiso, 55000 estado o llave de producción, 22023 dato inválido). */
export class FiscalDbError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FiscalDbError";
    this.code = code;
  }
}

export interface FiscalDb {
  getDocument(id: string): Promise<FiscalDoc | null>;
  listDocuments(saleId: string | null, limit: number): Promise<FiscalDoc[]>;
  /** Llave de producción de la base (fiscal_settings). */
  getSettings(): Promise<{ productionEnabled: boolean }>;
  requestIssue(saleId: string, idempotencyKey: string, environment: FiscalEnv): Promise<RequestResult>;
  transition(id: string, to: FiscalStatus, note?: string | null, result?: Record<string, unknown> | null): Promise<{ status: FiscalStatus }>;
  logEvent(id: string, kind: "solicitud_arca" | "respuesta_arca" | "error", payload?: Record<string, unknown> | null, note?: string | null): Promise<void>;
}

export type ServiceDeps = { db: FiscalDb; provider: FiscalProvider; config: FiscalConfig };

export type Outcome =
  | { outcome: "issued" | "rejected" | "failed"; status: FiscalStatus }
  /** Ya estaba resuelto (o en curso): no se volvió a llamar al proveedor. */
  | { outcome: "replay"; status: FiscalStatus }
  | { outcome: "not_found" }
  | { outcome: "not_configured"; missing: string[] }
  | { outcome: "production_disabled" }
  | { outcome: "conflict"; status: FiscalStatus | null };

const SECRET_KEY = /(token|sign|private_?key|certificate|certificado|password|clave|secret|cert|key)/i;

/** Quita cualquier campo con nombre de credencial de lo que se registra (la base también lo rechaza). */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(k)) continue;
    out[k] = redact(v, depth + 1);
  }
  return out;
}

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (redact(v) as Record<string, unknown>) : null);

/**
 * Solicita (registra) la emisión de una venta: idempotente (una venta, un comprobante; repetir la misma solicitud devuelve
 * el mismo). NO envía nada a ARCA: solo deja el registro en estado «pendiente».
 */
export async function requestIssue(deps: ServiceDeps, saleId: string, idempotencyKey: string, environment: FiscalEnv): Promise<RequestResult> {
  // La llave del servidor se mira antes de la de la base: producción necesita las dos.
  if (environment === "produccion" && !deps.config.productionAllowed) {
    throw new FiscalDbError("55000", "La emisión fiscal en producción no está habilitada");
  }
  return deps.db.requestIssue(saleId, idempotencyKey, environment);
}

/** Procesa un comprobante pendiente (o reintenta uno con error si se pide). Nunca llama dos veces al proveedor por el mismo estado. */
export async function processDocument(deps: ServiceDeps, id: string, opts: { retry?: boolean } = {}): Promise<Outcome> {
  const { db, provider, config } = deps;
  let doc = await db.getDocument(id);
  if (!doc) return { outcome: "not_found" };

  if (doc.status === "emitido" || doc.status === "rechazado" || doc.status === "en_proceso") return { outcome: "replay", status: doc.status };
  if (doc.status === "error") {
    if (!opts.retry) return { outcome: "replay", status: doc.status };
    try {
      await db.transition(id, "pendiente", "Reintento solicitado por un desarrollador.");
    } catch (e) {
      return conflictOrThrow(e, db, id);
    }
    doc = { ...doc, status: "pendiente" };
  }

  if (doc.environment === "produccion" && !config.productionAllowed) {
    await db.logEvent(id, "error", { code: "production_disabled" }, "Producción deshabilitada en el servidor: no se envió nada.").catch(() => undefined);
    return { outcome: "production_disabled" };
  }
  if (!config.configured) {
    // Sin credenciales no hay nada que intentar: queda pendiente y se deja constancia (solo los NOMBRES que faltan).
    await db.logEvent(id, "error", { code: "not_configured", missing: config.missing }, "Faltan credenciales de ARCA en el servidor: no se envió nada.").catch(() => undefined);
    return { outcome: "not_configured", missing: config.missing };
  }

  try {
    await db.transition(id, "en_proceso");
  } catch (e) {
    return conflictOrThrow(e, db, id);
  }

  await db.logEvent(id, "solicitud_arca", { provider: provider.name, environment: doc.environment }, "Solicitud a ARCA.");
  let result: ProviderResult;
  try {
    result = await provider.issue({ documentId: id, saleId: doc.saleId, environment: doc.environment });
  } catch (e) {
    const code = e instanceof Error && "code" in e && typeof (e as { code: unknown }).code === "string" ? (e as { code: string }).code : "provider_error";
    // El motivo que se guarda es genérico: el detalle técnico (que podría tener datos sensibles) no se persiste.
    await db.logEvent(id, "error", { code }, "Falló la comunicación con ARCA.");
    await db.transition(id, "error", code === "not_implemented" ? "Integración con ARCA no implementada: no se emitió nada." : "Error al comunicarse con ARCA.");
    return { outcome: "failed", status: "error" };
  }

  if (result.kind === "rejected") {
    await db.logEvent(id, "respuesta_arca", { ...(asRecord(result.raw) ?? {}), resultado: "rechazado", reason: result.reason }, "ARCA rechazó el comprobante.");
    await db.transition(id, "rechazado", result.reason.slice(0, 500));
    return { outcome: "rejected", status: "rechazado" };
  }

  await db.logEvent(id, "respuesta_arca", { ...(asRecord(result.raw) ?? {}), resultado: "autorizado" }, "ARCA autorizó el comprobante.");
  await db.transition(id, "emitido", null, {
    cae: result.cae,
    doc_type: result.docType,
    point_of_sale: result.pointOfSale,
    number: result.number,
    cae_expires_on: result.caeExpiresOn,
  });
  return { outcome: "issued", status: "emitido" };
}

/** Otro proceso se adelantó (transición no permitida): se informa el estado actual en lugar de fallar. Lo demás se propaga. */
async function conflictOrThrow(e: unknown, db: FiscalDb, id: string): Promise<Outcome> {
  if (e instanceof FiscalDbError && e.code === "55000") {
    const current = await db.getDocument(id).catch(() => null);
    return { outcome: "conflict", status: current?.status ?? null };
  }
  throw e;
}
