"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/catalog/url";
import {
  ACTIVITY_LABEL, PERIOD_LABEL, mergeActivity, methodShares, monthTotals,
  type Activity, type ActivityFilter, type ActivityKind, type MethodRow, type MonthComparison, type MonthlyRow, type PeriodKind,
} from "@/lib/pos/analytics";
import type { IconName } from "@/lib/panel/roles";
import { Icon } from "../icons";
import { Badge, Button, CARD_CLASS, INPUT_CLASS } from "../ui";

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric", timeZone: "UTC" });

export function Panel({ title, subtitle, link, children }: { title: string; subtitle?: string; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className={CARD_CLASS} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-brand-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-brand-muted">{subtitle}</p>}
        </div>
        {link && <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:decoration-2">{link.label}</Link>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-sm text-brand-muted">{children}</p>;
}

// ---------------------------------------------------------------- selector de período

const KINDS: PeriodKind[] = ["hoy", "7dias", "mes", "mes-anterior", "personalizado"];

/**
 * Período del dashboard: opciones rápidas más fechas elegidas a mano. Mientras las fechas no sean válidas no se aplica nada
 * y se dice por qué (el período anterior sigue a la vista).
 */
export function PeriodPicker({ kind, onKind, custom, onCustom, error, label }: {
  kind: PeriodKind; onKind: (k: PeriodKind) => void; custom: { from: string; to: string }; onCustom: (c: { from: string; to: string }) => void;
  error: string | null; label: string;
}) {
  const id = useId();
  return (
    <section aria-label="Período" className={`${CARD_CLASS} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div role="radiogroup" aria-label="Elegir el período" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink motion-safe:transition-colors ${
                kind === k ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white hover:border-brand-ink"
              }`}
            >
              <input type="radio" name={`${id}-periodo`} value={k} checked={kind === k} onChange={() => onKind(k)} className="sr-only" />
              {PERIOD_LABEL[k]}
            </label>
          ))}
        </div>
        <p className="text-sm text-brand-muted" aria-live="polite">Mostrando: <strong className="font-semibold text-brand-ink">{label}</strong></p>
      </div>
      {kind === "personalizado" && (
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-desde`} className="mb-1 block text-xs font-medium">Desde</label>
            <input id={`${id}-desde`} type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor={`${id}-hasta`} className="mb-1 block text-xs font-medium">Hasta (inclusive)</label>
            <input id={`${id}-hasta`} type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className={INPUT_CLASS} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-brand-danger">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- indicadores

export type Kpi = { label: string; value: string; hint: string };

export function KpiGrid({ kpis, ariaLabel }: { kpis: Kpi[]; ariaLabel: string }) {
  return (
    <section aria-label={ariaLabel} className={`${CARD_CLASS} grid grid-cols-2 lg:grid-cols-5`}>
      {kpis.map((k, i) => (
        <div key={k.label} className={`px-4 py-4 sm:px-5 ${i > 1 ? "border-t border-brand-line lg:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-brand-line lg:border-l-0" : ""} ${i > 0 ? "lg:border-l lg:border-brand-line" : ""} ${i === kpis.length - 1 && kpis.length % 2 === 1 ? "col-span-2 lg:col-span-1" : ""}`}>
          <p className="text-sm text-brand-muted">{k.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
          <p className="mt-0.5 text-xs text-brand-muted">{k.hint}</p>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- medios de pago

/**
 * Operaciones, facturación y participación por medio de pago del período elegido. La participación es la facturación del
 * método sobre la facturación total del período; sin facturación no se muestra porcentaje. Incluye QR y cualquier medio
 * habilitado, y los deshabilitados que tengan ventas (compatibilidad con registros anteriores).
 */
export function PaymentPanel({ methods, operations, revenue, period }: { methods: MethodRow[]; operations: number; revenue: number; period: string }) {
  const rows = methodShares(methods);
  return (
    <Panel title="Medios de pago" subtitle={`Ventas del período: ${period}`}>
      {operations === 0 ? (
        <Empty>No hay ventas en este período, así que no hay nada para analizar.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">Operaciones, facturación y participación por medio de pago</caption>
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-muted">
                  <th scope="col" className="px-5 py-2 font-medium">Medio</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Operaciones</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Facturación</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {rows.map((m) => (
                  <tr key={m.code} className={m.operations === 0 ? "text-brand-muted" : ""}>
                    <th scope="row" className="px-5 py-3 text-left font-medium">{m.label}</th>
                    <td className="px-2 py-3 text-right tabular-nums">{m.operations}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{formatPrice(m.revenue)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {m.share !== null && (
                          <span aria-hidden className="hidden h-2 w-20 overflow-hidden rounded-full bg-brand-sand sm:block">
                            <span className="block h-full rounded-full bg-brand-green" style={{ width: `${Math.max(m.share, m.share > 0 ? 3 : 0)}%` }} />
                          </span>
                        )}
                        <span className="w-14 text-right tabular-nums">{m.share === null ? "—" : `${String(m.share).replace(".", ",")} %`}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-brand-line font-semibold">
                  <th scope="row" className="px-5 py-3 text-left">Total</th>
                  <td className="px-2 py-3 text-right tabular-nums">{operations}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatPrice(revenue)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">100 %</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
            La participación es la facturación de cada medio sobre la facturación total del período. Es lo registrado al vender: el
            sistema no verifica que el pago se haya acreditado.
          </p>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- contador mensual

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/**
 * Contador mensual por medio de pago (últimos meses con ventas) y, SOLO si el mes en curso y el anterior tienen ventas,
 * la comparación entre ambos. Con menos datos no hay tendencia que mostrar y se dice. El mes en curso todavía no terminó.
 */
export function MonthlyPanel({ rows, labels, comparison }: { rows: MonthlyRow[]; labels: Record<string, string>; comparison: MonthComparison | null }) {
  const totals = monthTotals(rows);
  const codes = [...new Set(rows.map((r) => r.code))];
  const cell = (month: string, code: string) => rows.find((r) => r.month === month && r.code === code);
  const fmtMonth = (key: string) => monthLabel.format(new Date(`${key}-01T00:00:00Z`));

  return (
    <Panel title="Contador mensual" subtitle="Operaciones por medio de pago en los últimos 6 meses (mes calendario, hora de Río Turbio)">
      {totals.length === 0 ? (
        <Empty>Todavía no hay ventas en los últimos 6 meses.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Operaciones por mes y medio de pago</caption>
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-muted">
                  <th scope="col" className="px-5 py-2 font-medium">Mes</th>
                  {codes.map((c) => <th key={c} scope="col" className="px-2 py-2 text-right font-medium">{labels[c] ?? c}</th>)}
                  <th scope="col" className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {[...totals].reverse().map((t) => (
                  <tr key={t.month}>
                    <th scope="row" className="px-5 py-3 text-left font-medium capitalize">{fmtMonth(t.month)}</th>
                    {codes.map((c) => <td key={c} className="px-2 py-3 text-right tabular-nums">{cell(t.month, c)?.operations ?? 0}</td>)}
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{t.operations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-brand-line px-5 py-4 text-sm">
            {comparison ? (
              <>
                <p className="font-medium">Este mes contra el mes anterior</p>
                <p className="mt-1 text-brand-muted">
                  Operaciones: {comparison.current.operations} contra {comparison.previous.operations} ({sign(comparison.operationsDelta)}{Math.abs(comparison.operationsDelta)}).
                  Facturación: {formatPrice(comparison.current.revenue)} contra {formatPrice(comparison.previous.revenue)}
                  {comparison.revenuePct !== null ? ` (${sign(comparison.revenuePct)}${String(Math.abs(comparison.revenuePct)).replace(".", ",")} %)` : ""}.
                </p>
                <p className="mt-1 text-xs text-brand-muted">El mes en curso todavía no terminó: la comparación se completa a fin de mes.</p>
              </>
            ) : (
              <p className="text-brand-muted">Todavía no hay ventas en dos meses seguidos (el actual y el anterior): no se muestra ninguna comparación.</p>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- actividad reciente

const KIND_ICON: Record<ActivityKind, IconName> = { venta: "receipt", entrada: "plus", ajuste: "edit", alta: "box" };
const KIND_TONE: Record<ActivityKind, "ok" | "warn" | "muted"> = { venta: "ok", entrada: "muted", ajuste: "warn", alta: "muted" };

const FILTERS: [ActivityFilter, string][] = [["todo", "Todo"], ["ventas", "Ventas"], ["stock", "Stock"]];

/**
 * Lista compacta de movimientos recientes: ícono de la operación, descripción, clasificación, fecha y hora, importe a la
 * derecha, estado y acceso al detalle. Mezcla las ventas (ingresos) con los movimientos de inventario (solo gerente o
 * superior). El modelo solo tiene ventas confirmadas: no hay anulaciones ni devoluciones, así que no se muestran.
 */
export function ActivityPanel({ items, onOpenSale, showStock }: { items: Activity[]; onOpenSale: (saleKey: string) => void; showStock: boolean }) {
  const [filter, setFilter] = useState<ActivityFilter>("todo");
  const visible = mergeActivity(items, filter);
  return (
    <Panel title="Movimientos recientes" subtitle={showStock ? "Ventas e inventario, del más reciente al más viejo" : "Tus ventas, de la más reciente a la más vieja"}>
      {showStock && (
        <div role="group" aria-label="Filtrar movimientos" className="flex flex-wrap gap-2 border-b border-brand-line px-5 py-3">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium motion-safe:transition-colors ${filter === value ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white hover:border-brand-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <Empty>{filter === "stock" ? "Todavía no hay movimientos de stock." : filter === "ventas" ? "Todavía no hay ventas registradas." : "Todavía no hay movimientos."}</Empty>
      ) : (
        <ul className="divide-y divide-brand-line">
          {visible.map((a) => (
            <li key={a.key}>
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-2.5 text-sm hover:bg-brand-cream [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-lg ${a.kind === "venta" ? "bg-brand-green/10 text-brand-green-ink" : "bg-brand-orange/15 text-brand-ink"}`}>
                    <Icon name={KIND_ICON[a.kind]} className="size-[1.125rem]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-brand-muted">
                      <Badge tone={KIND_TONE[a.kind]}>{ACTIVITY_LABEL[a.kind]}</Badge>
                      <span className="tabular-nums">{dateTime.format(new Date(a.at))}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">
                      {a.amount !== null ? formatPrice(a.amount) : `${(a.units ?? 0) > 0 ? "+" : ""}${a.units} u.`}
                    </span>
                    <span className="block text-xs text-brand-muted">{a.kind === "venta" ? "Confirmada" : "Registrado"}</span>
                  </span>
                  <Icon name="chevronDown" className="size-4 shrink-0 text-brand-muted motion-safe:transition-transform group-open:rotate-180" />
                  <span className="sr-only">Ver detalle</span>
                </summary>
                <div className="space-y-2 bg-brand-cream/60 px-5 py-3 text-sm">
                  <p className="whitespace-pre-line text-brand-muted">{a.detail}</p>
                  {a.kind === "venta" && <Button size="sm" icon="receipt" onClick={() => onOpenSale(a.key)}>Ver comprobante</Button>}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
        Solo hay ventas confirmadas: todavía no hay anulaciones ni devoluciones en el sistema.
      </p>
    </Panel>
  );
}
