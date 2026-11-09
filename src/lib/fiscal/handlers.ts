import type { FiscalConfig } from "./config.ts";
import { FiscalDbError, processDocument, requestIssue, type FiscalDoc, type FiscalEnv, type ServiceDeps } from "./service.ts";

/**
 * Manejadores HTTP del circuito fiscal (solo servidor). Reciben y devuelven objetos web estándar (Request / Response) y
 * todo lo externo llega por «deps», así se prueban sin red. Reglas:
 *   - Solo se aceptan desarrolladores autorizados: la cuenta se identifica con SU token de sesión (cabecera Authorization),
 *     el servidor pregunta a la base si es de desarrollo (is_developer) y, aparte, cada función de la base lo exige de
 *     nuevo. Ser CEO del comercio no alcanza; los permisos no se infieren de ningún rol.
 *   - Sin cookies: el token viaja en una cabecera, así que no hay CSRF. No se usa la clave service_role.
 *   - Las respuestas nunca incluyen secretos, mensajes internos de la base ni de ARCA, ni trazas: errores genéricos.
 *   - Nada se guarda en caché.
 */
export type HandlerDeps = {
  config: () => FiscalConfig;
  /** true = de desarrollo; false = no lo es; null = token inválido o vencido. */
  isDeveloper: (token: string) => Promise<boolean | null>;
  /** Servicio armado con la sesión de ESA persona (las llamadas a la base corren como ella). */
  service: (token: string) => ServiceDeps;
};

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } as const;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9._~+/=-]{20,4096}$/;
const MAX_BODY = 2048;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Extrae el token de «Authorization: Bearer …»; null si falta o no tiene forma de token. */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  return m && TOKEN.test(m[1]) ? m[1] : null;
}

/** Solo desarrolladores autorizados. Devuelve el token o la respuesta de rechazo. */
export async function authorize(req: Request, deps: HandlerDeps): Promise<{ token: string } | Response> {
  const token = bearerToken(req);
  if (!token) return json(401, { error: "No autenticado" });
  let dev: boolean | null;
  try {
    dev = await deps.isDeveloper(token);
  } catch {
    return json(503, { error: "No se pudo verificar el acceso" });
  }
  if (dev === null) return json(401, { error: "No autenticado" });
  if (dev !== true) return json(403, { error: "No autorizado" });
  return { token };
}

async function readBody(req: Request): Promise<Record<string, unknown> | Response> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY) return json(413, { error: "Solicitud demasiado grande" });
  let text: string;
  try {
    text = await req.text();
  } catch {
    return json(400, { error: "Solicitud inválida" });
  }
  if (text.length > MAX_BODY) return json(413, { error: "Solicitud demasiado grande" });
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    /* cae al rechazo de abajo */
  }
  return json(400, { error: "Solicitud inválida" });
}

/** Traduce un error de la base a una respuesta sin detalles internos. */
function dbFailure(e: unknown): Response {
  if (e instanceof FiscalDbError) {
    if (e.code === "42501") return json(403, { error: "No autorizado" });
    if (e.code === "22023") return json(400, { error: "Datos inválidos" });
    if (e.code === "23505") return json(409, { error: "Conflicto de idempotencia" });
    if (e.code === "55000") return json(409, { error: "Operación no permitida en el estado actual o producción deshabilitada" });
  }
  return json(500, { error: "Error interno" });
}

const publicDoc = (d: FiscalDoc) => ({ id: d.id, saleId: d.saleId, environment: d.environment, status: d.status, lastError: d.lastError });

/** GET /api/fiscal/status: configuración (solo qué falta, nunca valores) y llaves de producción. */
export async function handleStatus(req: Request, deps: HandlerDeps): Promise<Response> {
  const auth = await authorize(req, deps);
  if (auth instanceof Response) return auth;
  const config = deps.config();
  try {
    const settings = await deps.service(auth.token).db.getSettings();
    return json(200, {
      configured: config.configured,
      missing: config.missing,
      environment: config.environment,
      productionServerKey: config.productionAllowed,
      productionDatabaseKey: settings.productionEnabled,
      productionEnabled: config.productionAllowed && settings.productionEnabled,
      emission: "no-implementada",
    });
  } catch (e) {
    return dbFailure(e);
  }
}

/** GET /api/fiscal/documents?venta=<uuid>: comprobantes fiscales registrados (la base los limita a desarrollo). */
export async function handleList(req: Request, deps: HandlerDeps): Promise<Response> {
  const auth = await authorize(req, deps);
  if (auth instanceof Response) return auth;
  const sale = new URL(req.url).searchParams.get("venta");
  if (sale !== null && !isUuid(sale)) return json(400, { error: "Datos inválidos" });
  try {
    const docs = await deps.service(auth.token).db.listDocuments(sale, 50);
    return json(200, { documents: docs.map(publicDoc) });
  } catch (e) {
    return dbFailure(e);
  }
}

/** POST /api/fiscal/request {saleId, idempotencyKey, environment?}: registra la solicitud (no envía nada a ARCA). */
export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  const auth = await authorize(req, deps);
  if (auth instanceof Response) return auth;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const { saleId, idempotencyKey } = body;
  const environment = (body.environment ?? "homologacion") as unknown;
  if (!isUuid(saleId) || !isUuid(idempotencyKey) || (environment !== "homologacion" && environment !== "produccion")) {
    return json(400, { error: "Datos inválidos" });
  }
  try {
    const r = await requestIssue(deps.service(auth.token), saleId, idempotencyKey, environment as FiscalEnv);
    return json(r.created ? 201 : 200, { id: r.id, status: r.status, environment: r.environment, created: r.created });
  } catch (e) {
    return dbFailure(e);
  }
}

/** POST /api/fiscal/process {documentId, retry?}: procesa un pendiente. Sin credenciales o sin integración, no emite nada. */
export async function handleProcess(req: Request, deps: HandlerDeps): Promise<Response> {
  const auth = await authorize(req, deps);
  if (auth instanceof Response) return auth;
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const { documentId, retry } = body;
  if (!isUuid(documentId) || (retry !== undefined && typeof retry !== "boolean")) return json(400, { error: "Datos inválidos" });
  try {
    const r = await processDocument(deps.service(auth.token), documentId, { retry: retry === true });
    switch (r.outcome) {
      case "not_found":
        return json(404, { error: "Comprobante inexistente" });
      case "not_configured":
        return json(409, { error: "Faltan credenciales de ARCA en el servidor", missing: r.missing });
      case "production_disabled":
        return json(403, { error: "La emisión fiscal en producción no está habilitada" });
      case "conflict":
        return json(409, { error: "Otro proceso ya está resolviendo este comprobante", status: r.status });
      case "replay":
        return json(200, { outcome: "replay", status: r.status });
      default:
        return json(200, { outcome: r.outcome, status: r.status });
    }
  } catch (e) {
    return dbFailure(e);
  }
}
