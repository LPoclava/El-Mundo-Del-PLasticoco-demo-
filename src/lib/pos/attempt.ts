import type { Receipt } from "./api";
import type { SaleFailure } from "./errors";

/**
 * Intento de venta con resultado incierto (hallazgo H1 de la fase 0.4). Sin React ni Supabase: se prueba con node --test.
 *
 * El problema: si se corta la conexión (o se recarga la página) mientras se confirma una venta, la base puede haberla
 * registrado igual. Si la persona vuelve a armar la venta con otra clave de operación, se cobra dos veces y el stock
 * baja dos veces. Solución en dos partes:
 *   1. La clave del intento se guarda en sessionStorage ANTES de enviar, junto con una copia de lo que se envió
 *      (medio de pago y líneas), así sobrevive a una recarga y no depende del borrador del carrito.
 *   2. Mientras un intento esté pendiente (en curso o con resultado desconocido) NO se puede armar otra venta: solo
 *      verificar, reintentar con la MISMA clave y el MISMO contenido, o descartar cuando ya es seguro. Antes de
 *      reenviar se consulta si esa clave ya tiene una venta registrada.
 *
 * Quien garantiza que una clave no confirme dos ventas es la base: unique (user_id, idempotency_key) más un candado
 * por clave dentro de confirm_sale. Todo lo de acá solo evita que la pantalla genere una clave NUEVA para una venta
 * que quizás ya existe.
 */

export const ATTEMPT_KEY = "mp-venta-intento";

/**
 * Tiempo mínimo, desde el último envío, para poder descartar un intento que la consulta no encontró. Una venta que
 * llegó a la base pero todavía no se había confirmado no puede seguir ejecutándose más allá del límite de duración
 * de las consultas de Supabase (segundos); 2 minutos deja un margen muy amplio.
 */
export const DISCARD_AFTER_MS = 120_000;

export type AttemptLine = { variantId: string; quantity: number; unitPrice: number };

/** sending: se está enviando (si la página se recarga en este estado, el resultado es desconocido). unknown: no se supo qué pasó. */
export type AttemptStatus = "sending" | "unknown";

export type Attempt = {
  /** La cuenta que armó la venta: otra cuenta en el mismo navegador no ve ni retoma este intento. */
  userId: string;
  key: string;
  method: string;
  /** Firma del carrito y el medio de pago (attemptSignature): una clave pertenece a UN solo contenido. */
  sig: string;
  lines: AttemptLine[];
  status: AttemptStatus;
  lastSentAt: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultStorage(): StorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Lee lo guardado; algo dañado o con otra forma se descarta entero (nunca se arma un intento a medias). */
export function parseAttempt(raw: string | null): Attempt | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v !== "object" || v === null) return null;
    if (typeof v.userId !== "string" || !UUID.test(v.userId)) return null;
    if (typeof v.key !== "string" || !UUID.test(v.key)) return null;
    if (typeof v.method !== "string" || v.method.length < 1 || v.method.length > 40) return null;
    if (typeof v.sig !== "string" || v.sig.length < 1) return null;
    if (v.status !== "sending" && v.status !== "unknown") return null;
    if (typeof v.lastSentAt !== "number" || !Number.isFinite(v.lastSentAt)) return null;
    if (!Array.isArray(v.lines) || v.lines.length < 1 || v.lines.length > 100) return null;
    for (const l of v.lines as Record<string, unknown>[]) {
      if (typeof l !== "object" || l === null) return null;
      if (typeof l.variantId !== "string" || !UUID.test(l.variantId)) return null;
      if (typeof l.quantity !== "number" || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 9999) return null;
      if (typeof l.unitPrice !== "number" || !Number.isFinite(l.unitPrice) || l.unitPrice <= 0) return null;
    }
    return v as unknown as Attempt;
  } catch {
    return null;
  }
}

/** El intento pendiente de ESTA cuenta, si lo hay. */
export function loadAttempt(userId: string, storage: StorageLike | null = defaultStorage()): Attempt | null {
  try {
    const a = parseAttempt(storage?.getItem(ATTEMPT_KEY) ?? null);
    return a && a.userId === userId ? a : null;
  } catch {
    return null;
  }
}

/** Devuelve false si no se pudo guardar (almacenamiento lleno, bloqueado o ventana privada). */
export function saveAttempt(attempt: Attempt, storage: StorageLike | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

export function clearAttempt(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(ATTEMPT_KEY);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

export const attemptTotal = (a: Pick<Attempt, "lines">) => a.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
export const attemptUnits = (a: Pick<Attempt, "lines">) => a.lines.reduce((s, l) => s + l.quantity, 0);

/** El comprobante que volvió es el de lo que se envió (mismo total y mismas unidades). */
export function receiptMatchesAttempt(a: Pick<Attempt, "lines">, r: Pick<Receipt, "total" | "items">): boolean {
  return r.total === attemptTotal(a) && r.items.reduce((s, i) => s + i.quantity, 0) === attemptUnits(a);
}

/**
 * Se puede descartar un intento solo si la consulta confirmó que NO hay venta con esa clave y pasó el margen desde el
 * último envío (ver DISCARD_AFTER_MS). Con la consulta fallida (null) o con la venta registrada, nunca.
 */
export function canDiscard(a: Pick<Attempt, "lastSentAt">, registered: boolean | null, now: number): boolean {
  return registered === false && now - a.lastSentAt >= DISCARD_AFTER_MS;
}

/** Qué hacer con un intento pendiente cuando la persona intenta confirmar. */
export function planConfirm(pending: Pick<Attempt, "sig"> | null, sig: string): "new" | "resume" | "blocked" {
  if (!pending) return "new";
  return pending.sig === sig ? "resume" : "blocked";
}

// ---------------------------------------------------------------------------------------------------------------
// Orquestación (pura): recibe sus dependencias, así se puede probar con un «servidor» simulado.

export type ConfirmDeps = {
  uuid: () => string;
  now: () => number;
  /** Busca una venta propia por clave. Lanza si no se pudo consultar. */
  find: (key: string) => Promise<Receipt | null>;
  /** Envía la venta (confirm_sale). No lanza: devuelve el comprobante o la falla. */
  send: (key: string, method: string, lines: AttemptLine[]) => Promise<{ receipt: Receipt } | { failure: SaleFailure }>;
  /** Guarda el intento; false si no se pudo. */
  save: (attempt: Attempt) => boolean;
  clear: () => void;
};

export type ConfirmOutcome =
  /** La venta existe. via: la envió esta llamada, ya estaba registrada (la consulta o la base la reconocieron). */
  | { kind: "registered"; receipt: Receipt; via: "sent" | "found" | "replayed"; persisted: boolean }
  /** La base rechazó o no autorizó: NO se registró nada y el intento se cierra. */
  | { kind: "failed"; failure: SaleFailure }
  /** No se sabe si se registró: el intento queda pendiente y bloquea otra venta. */
  | { kind: "unknown"; attempt: Attempt; failure: SaleFailure; persisted: boolean }
  /** No se pudo consultar si la venta ya estaba registrada: no se reenvía; sigue pendiente. */
  | { kind: "lookup-failed"; attempt: Attempt; persisted: boolean }
  /** Hay un intento pendiente con otro contenido: no se mezcla. */
  | { kind: "blocked"; attempt: Attempt }
  /** La clave ya tenía una venta con otro contenido: no se la presenta como la venta de ahora. */
  | { kind: "mismatch"; receipt: Receipt };

const UNKNOWN: SaleFailure = {
  kind: "unknown",
  message: "No pudimos confirmar si la venta se registró.",
  problems: [],
};

/**
 * Confirma una venta sin poder duplicarla:
 *  - sin intento pendiente: crea la clave, la GUARDA y recién entonces envía;
 *  - con un intento pendiente del mismo contenido: primero consulta si esa clave ya tiene una venta; si la tiene,
 *    la devuelve y cierra el intento; si no, reenvía con la MISMA clave;
 *  - con un intento pendiente de otro contenido: no hace nada (blocked).
 */
export async function runConfirm(input: {
  userId: string;
  pending: Attempt | null;
  sig: string;
  method: string;
  lines: AttemptLine[];
  deps: ConfirmDeps;
}): Promise<ConfirmOutcome> {
  const { deps } = input;
  const plan = planConfirm(input.pending, input.sig);
  if (plan === "blocked") return { kind: "blocked", attempt: input.pending as Attempt };

  const base: Attempt =
    plan === "resume" && input.pending
      ? input.pending
      : { userId: input.userId, key: deps.uuid(), method: input.method, sig: input.sig, lines: input.lines, status: "sending", lastSentAt: deps.now() };

  // 1. La clave y lo que se va a enviar se guardan ANTES de tocar la red.
  let persisted = deps.save({ ...base, status: "sending", lastSentAt: deps.now() });

  const finish = (receipt: Receipt, via: "sent" | "found" | "replayed"): ConfirmOutcome => {
    deps.clear();
    return receiptMatchesAttempt(base, receipt) ? { kind: "registered", receipt, via, persisted } : { kind: "mismatch", receipt };
  };

  // 2. Si es un reintento, antes de reenviar se pregunta si esa clave ya tiene una venta.
  if (plan === "resume") {
    let found: Receipt | null;
    try {
      found = await deps.find(base.key);
    } catch {
      persisted = deps.save({ ...base, status: "unknown", lastSentAt: base.lastSentAt }) && persisted;
      return { kind: "lookup-failed", attempt: { ...base, status: "unknown" }, persisted };
    }
    if (found) return finish(found, "found");
  }

  // 3. Se envía. La base reconoce la clave: si ya existía devuelve esa venta (replayed) y no registra otra.
  let out: { receipt: Receipt } | { failure: SaleFailure };
  try {
    out = await deps.send(base.key, base.method, base.lines);
  } catch {
    out = { failure: UNKNOWN };
  }
  if ("receipt" in out) return finish(out.receipt, out.receipt.replayed ? "replayed" : "sent");

  if (out.failure.kind === "unknown") {
    const attempt: Attempt = { ...base, status: "unknown", lastSentAt: deps.now() };
    persisted = deps.save(attempt) && persisted;
    return { kind: "unknown", attempt, failure: out.failure, persisted };
  }
  // Rechazo, falta de permiso o datos inválidos: la base no registró nada, el intento se cierra.
  deps.clear();
  return { kind: "failed", failure: out.failure };
}

export type VerifyOutcome =
  | { kind: "registered"; receipt: Receipt }
  | { kind: "not-registered" }
  | { kind: "lookup-failed" };

/** Solo consulta (sin reenviar): si la venta existe, cierra el intento y devuelve su comprobante. */
export async function verifyAttempt(attempt: Attempt, deps: Pick<ConfirmDeps, "find" | "clear">): Promise<VerifyOutcome> {
  let found: Receipt | null;
  try {
    found = await deps.find(attempt.key);
  } catch {
    return { kind: "lookup-failed" };
  }
  if (!found) return { kind: "not-registered" };
  deps.clear();
  return { kind: "registered", receipt: found };
}
