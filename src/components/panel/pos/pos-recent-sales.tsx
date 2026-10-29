"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/catalog/url";
import { listSales, type PaymentMethod, type SaleListItem } from "@/lib/pos/api";
import { Badge, CARD_CLASS, INPUT_CLASS } from "../ui";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

/** Medianoche local del día elegido (yyyy-mm-dd) como ISO; con days = 1, la del día siguiente. */
function dayBoundary(value: string, days = 0): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Ventas recientes con filtros por fecha y medio de pago. Lo que aparece lo decide la base (RLS):
 * el empleado ve solo las suyas; el gerente y el CEO, las de todo el equipo. Son de solo lectura.
 */
export function RecentSales({ db, methods, version, showAll }: { db: SupabaseClient; methods: PaymentMethod[]; version: number; showAll: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("");
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSales(db, { from: dayBoundary(from), to: dayBoundary(to, 1), method })
      .then((rows) => {
        if (cancelled) return;
        setSales(rows);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "No se pudieron cargar las ventas."));
    return () => {
      cancelled = true;
    };
  }, [db, from, to, method, version]);

  const label = (code: string) => methods.find((m) => m.code === code)?.label ?? code;
  const filtered = Boolean(from || to || method);

  return (
    <section className={`${CARD_CLASS} p-4 sm:p-5`} aria-labelledby="ventas-recientes">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ventas-recientes" className="text-lg font-semibold">Ventas recientes</h2>
          <p className="text-sm text-brand-muted">{showAll ? "Las ventas de todo el equipo." : "Tus ventas."} Son de solo lectura.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label htmlFor="sales-from" className="mb-1 block text-xs font-medium">Desde</label>
            <input id="sales-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${INPUT_CLASS} h-10`} />
          </div>
          <div>
            <label htmlFor="sales-to" className="mb-1 block text-xs font-medium">Hasta</label>
            <input id="sales-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${INPUT_CLASS} h-10`} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="sales-method" className="mb-1 block text-xs font-medium">Medio de pago</label>
            <select id="sales-method" value={method} onChange={(e) => setMethod(e.target.value)} className={`${INPUT_CLASS} h-10`}>
              <option value="">Todos</option>
              {methods.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-brand-danger">{error}</p>}
      {!error && sales === null && <p role="status" className="mt-3 text-sm text-brand-muted">Cargando ventas…</p>}
      {sales !== null && sales.length === 0 && !error && (
        <p className="mt-4 rounded-lg border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-muted">
          {filtered ? "No hay ventas con esos filtros." : "Todavía no hay ventas registradas."}
        </p>
      )}
      {sales !== null && sales.length > 0 && (
        <ul className="mt-4 divide-y divide-brand-line">
          {sales.map((s) => (
            <li key={s.id}>
              <details className="group py-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold tabular-nums">#{s.number}</span>
                  <span className="tabular-nums text-brand-muted">{dateTime.format(new Date(s.createdAt))}</span>
                  <Badge>{label(s.paymentMethod)}</Badge>
                  {showAll && <span className="text-brand-muted">{s.userName}</span>}
                  <span className="ml-auto font-semibold tabular-nums">{formatPrice(s.total)}</span>
                </summary>
                <ul className="mt-2 space-y-0.5 pl-1 text-sm text-brand-muted">
                  {s.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>{l.quantity} × {l.productName}{l.variantLabel ? ` (${l.variantLabel})` : ""}</span>
                      <span className="tabular-nums">{formatPrice(l.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
