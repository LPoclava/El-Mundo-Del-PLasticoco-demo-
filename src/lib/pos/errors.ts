import type { SaleProblem } from "./cart";

/**
 * Cómo se le explica a quien vende lo que respondió la base al confirmar (sin React ni Supabase: se prueba con node --test).
 * Lo importante es la diferencia entre «la base rechazó» (no se registró nada, se corrige el carrito) y «no sabemos»
 * (se cortó la conexión: puede haberse registrado, y reintentar con la misma clave no duplica).
 */
export type SaleFailure = {
  /** rejected: la base rechazó la venta (carrito intacto, hay que corregir). unknown: no se sabe si se registró. */
  kind: "rejected" | "forbidden" | "unknown" | "invalid";
  message: string;
  problems: SaleProblem[];
};

export type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

export function describeSaleError(error: DbError): SaleFailure {
  const message = error?.message ?? "";
  if (message === "SALE_REJECTED") {
    let problems: SaleProblem[] = [];
    try {
      problems = (JSON.parse(error?.details ?? "{}") as { problems?: SaleProblem[] }).problems ?? [];
    } catch {
      problems = [];
    }
    return { kind: "rejected", message: "La venta no se registró. Revisá lo que se indica y volvé a confirmar.", problems };
  }
  if (error?.code === "42501" || /No autorizado|row-level security|permission denied/i.test(message)) {
    return { kind: "forbidden", message: "Tu cuenta no tiene permiso para vender. Avisá a un responsable.", problems: [] };
  }
  if (error?.code === "22023") {
    return { kind: "invalid", message: "Los datos de la venta no son válidos. Revisá el carrito.", problems: [] };
  }
  return {
    kind: "unknown",
    message: "No pudimos confirmar si la venta se registró (¿se cortó la conexión?). Tocá «Reintentar registro»: si ya estaba registrada no se duplica.",
    problems: [],
  };
}
